// JOB-TRACKER-001 Phase 3 — mount for the JobTracker island.
// The launcher sits in the upload area, just BEFORE the admin-only "Re-edit a
// previous application" control (same place) — but the Job Tracker button is
// shown to ALL signed-in users (gated on login only, not on admin). Never
// visible before login. The panel mounts into a body-level React root on
// demand. Placement into the app's React-rendered DOM is done at runtime by
// locating the re-edit <summary>, kept in place by a MutationObserver.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { JobTracker } from './JobTracker';
import { startFitWatch } from './fitWatch';
import { isAuthed } from './api';

const BTN_ID = 'antcv-job-tracker-btn';
const PANEL_ID = 'antcv-job-tracker-panel-root';

let panelRoot: Root | null = null;

function closePanel(): void {
  if (panelRoot) { try { panelRoot.unmount(); } catch { /* */ } panelRoot = null; }
  const el = document.getElementById(PANEL_ID);
  if (el && el.parentElement) el.parentElement.removeChild(el);
}

export function openJobTracker(): void {
  if (!isAuthed()) return; // never before login
  if (document.getElementById(PANEL_ID)) return;
  const host = document.createElement('div');
  host.id = PANEL_ID;
  document.body.appendChild(host);
  panelRoot = createRoot(host);
  panelRoot.render(createElement(JobTracker, { onClose: closePanel }));
}

// Find the admin-only "Re-edit a previous application" control (its <details>),
// so we can place the Job Tracker button immediately before it.
function findReEdit(): HTMLElement | null {
  const sums = document.querySelectorAll('summary');
  for (const s of Array.from(sums)) {
    if ((s.textContent || '').includes('Re-edit a previous application')) {
      return (s.closest('details') as HTMLElement) || (s.parentElement as HTMLElement);
    }
  }
  return null;
}

function makeButton(): HTMLButtonElement {
  const b = document.createElement('button');
  b.id = BTN_ID;
  b.type = 'button';
  b.textContent = '📋 Job Tracker';
  b.setAttribute('aria-label', 'Open Job Tracker');
  Object.assign(b.style, {
    display: 'block', width: '100%', boxSizing: 'border-box', textAlign: 'left',
    background: 'rgba(126,180,255,0.10)', color: '#9ec8ff', border: '1px solid rgba(126,180,255,0.28)',
    borderRadius: '10px', padding: '10px 12px', marginBottom: '10px', fontSize: '12px', fontWeight: '700',
    letterSpacing: '0.3px', cursor: 'pointer', fontFamily: 'inherit',
  } as CSSStyleDeclaration);
  b.addEventListener('click', () => openJobTracker());
  return b;
}

// Ensure the button is present + correctly placed (before re-edit) when signed
// in; removed when signed out. Idempotent.
function ensureButton(): void {
  const existing = document.getElementById(BTN_ID);
  if (!isAuthed()) {
    if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
    closePanel();
    return;
  }
  const reEdit = findReEdit();
  if (!reEdit || !reEdit.parentElement) {
    // Anchor not on screen yet (or non-admin: the re-edit control isn't
    // rendered). Leave the button out until the upload area with the anchor is
    // present; the observer will retry. (A non-admin anchor is a follow-up.)
    return;
  }
  const parent = reEdit.parentElement;
  // Already correctly placed immediately before re-edit?
  if (existing && existing.nextElementSibling === reEdit && existing.parentElement === parent) return;
  const btn = existing || makeButton();
  if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
  parent.insertBefore(btn, reEdit);
}

let booted = false;
export function mountJobTrackerIsland(): void {
  if (booted) return;
  booted = true;
  (window as unknown as { AntcvOpenJobTracker?: () => void }).AntcvOpenJobTracker = openJobTracker;
  try { ensureButton(); } catch (e) { console.warn('[JobTracker] place button failed', e); }
  try { startFitWatch(); } catch (e) { console.warn('[JobTracker] fit-watch failed', e); }
  // Re-place on DOM churn + on auth changes. setTimeout (not rAF) per STICKY-LEAK-005.
  let pending = false;
  const obs = new MutationObserver(() => {
    if (pending) return; pending = true;
    setTimeout(() => { pending = false; try { ensureButton(); } catch { /* */ } }, 150);
  });
  obs.observe(document.body, { childList: true, subtree: true });
  try {
    const a = (window as unknown as { AntcvAuth?: { subscribe?: (cb: () => void) => void } }).AntcvAuth;
    if (a && typeof a.subscribe === 'function') a.subscribe(() => { try { ensureButton(); } catch { /* */ } });
  } catch { /* */ }
}
