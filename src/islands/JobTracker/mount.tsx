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

// NON-ADMIN fallback anchor: the always-rendered "📎 Attach signal files…"
// button lives in the same upload area and is shown to every signed-in user
// (the re-edit control is admin-only). Match on the leading paperclip emoji —
// it survives UI localisation where the label text does not. Returns the
// button's flex-row wrapper so the Job Tracker button slots in just above it.
function findAttachAnchor(): HTMLElement | null {
  const btns = document.querySelectorAll('button');
  for (const b of Array.from(btns)) {
    if ((b.textContent || '').trim().startsWith('📎')) {
      return (b.parentElement as HTMLElement) || (b as HTMLElement);
    }
  }
  return null;
}

// The upload-area anchor the Job Tracker button sits before: the admin re-edit
// control when present, otherwise the non-admin attach-files row.
function findAnchor(): HTMLElement | null {
  return findReEdit() || findAttachAnchor();
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
  // No per-element click listener — see the delegated document-level listener
  // in mountJobTrackerIsland (BTN-DEAD-CLONE-001): an app re-render can
  // serialize + recreate this button (styles survive as attributes, listeners
  // don't), and ensureButton then sees it "already placed" and keeps the dead
  // clone. Delegation makes ANY #antcv-job-tracker-btn work.
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
  const anchor = findAnchor();
  if (!anchor || !anchor.parentElement) {
    // Upload area with the anchor not on screen yet. Leave the button out; the
    // observer retries on DOM churn. (findAnchor covers both admin re-edit and
    // the non-admin attach-files row, so this is now a timing gate only.)
    return;
  }
  const parent = anchor.parentElement;
  // Already correctly placed immediately before the anchor?
  if (existing && existing.nextElementSibling === anchor && existing.parentElement === parent) return;
  const btn = existing || makeButton();
  if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
  parent.insertBefore(btn, anchor);
}

let booted = false;
export function mountJobTrackerIsland(): void {
  if (booted) return;
  booted = true;
  (window as unknown as { AntcvOpenJobTracker?: () => void }).AntcvOpenJobTracker = openJobTracker;
  // BTN-DEAD-CLONE-001: delegated open — survives the button being serialized
  // + recreated by an app re-render (which strips element listeners).
  document.addEventListener('click', (ev) => {
    try {
      const t = ev.target as HTMLElement | null;
      if (t && typeof t.closest === 'function' && t.closest('#' + BTN_ID)) openJobTracker();
    } catch { /* */ }
  }, true);
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
