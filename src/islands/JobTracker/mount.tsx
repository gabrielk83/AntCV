// JOB-TRACKER-001 Phase 3 — mount for the JobTracker island.
// Increment 1: a reliable floating launcher + window.AntcvOpenJobTracker(); the
// panel mounts into a dedicated body-level React root on demand and unmounts on
// close. Precise placement into the upload menu + main nav follows in increment
// 2 (needs live-DOM inspection — the app is React-rendered with no stable ids,
// so we don't guess selectors).

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { JobTracker } from './JobTracker';

const LAUNCHER_ID = 'antcv-job-tracker-launcher';
const PANEL_ID = 'antcv-job-tracker-panel-root';

let panelRoot: Root | null = null;

function closePanel(): void {
  if (panelRoot) { try { panelRoot.unmount(); } catch { /* */ } panelRoot = null; }
  const el = document.getElementById(PANEL_ID);
  if (el && el.parentElement) el.parentElement.removeChild(el);
}

export function openJobTracker(): void {
  if (document.getElementById(PANEL_ID)) return; // already open
  const host = document.createElement('div');
  host.id = PANEL_ID;
  document.body.appendChild(host);
  panelRoot = createRoot(host);
  panelRoot.render(createElement(JobTracker, { onClose: closePanel }));
}

function ensureLauncher(): void {
  if (document.getElementById(LAUNCHER_ID)) return;
  const b = document.createElement('button');
  b.id = LAUNCHER_ID;
  b.type = 'button';
  b.textContent = '📋 Job Tracker';
  b.setAttribute('aria-label', 'Open Job Tracker');
  Object.assign(b.style, {
    position: 'fixed', left: '14px', bottom: '14px', zIndex: '99998',
    background: '#1F3864', color: '#fff', border: 'none', borderRadius: '20px',
    padding: '8px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    boxShadow: '0 3px 12px rgba(0,0,0,0.28)', fontFamily: 'inherit',
  } as CSSStyleDeclaration);
  b.addEventListener('click', () => openJobTracker());
  document.body.appendChild(b);
}

let booted = false;
export function mountJobTrackerIsland(): void {
  if (booted) return;
  booted = true;
  (window as unknown as { AntcvOpenJobTracker?: () => void }).AntcvOpenJobTracker = openJobTracker;
  try { ensureLauncher(); } catch (e) { console.warn('[JobTracker] launcher failed', e); }
  // The vanilla app re-renders and can wipe body children; a light observer
  // re-adds the launcher if it disappears. setTimeout (not rAF) per STICKY-LEAK-005.
  let pending = false;
  const obs = new MutationObserver(() => {
    if (pending) return; pending = true;
    setTimeout(() => { pending = false; try { ensureLauncher(); } catch { /* */ } }, 200);
  });
  obs.observe(document.body, { childList: true });
}
