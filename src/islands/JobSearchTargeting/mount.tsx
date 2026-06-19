// Mount the JobSearchTargeting card in Settings → Personal, just below the
// WritingStylePicker island (or, failing that, above the Done button). Same
// lifecycle as WritingStylePicker: MutationObserver-driven, only while the
// Personal subtab is visible. No app.js edits.
//
// Bundle A surfaces the card in Personal settings; the wizard + a kernel-settings
// anchor are a follow-up that reuses this same component.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { JobSearchTargeting } from './JobSearchTargeting';
import { findDoneButton, findSettingsRoot, isPersonalSubtab } from '../../lib/settings-dom';

const MOUNT_ID = 'antcv-react-job-search-targeting';
const WRITING_STYLE_ID = 'antcv-react-writing-style-picker';
const PACKAGE_PICKER_ID = 'antcv-react-package-picker';

let root: Root | null = null;
let container: HTMLElement | null = null;

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let c = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (c) return c;
  c = document.createElement('div');
  c.id = MOUNT_ID;
  c.setAttribute('data-antcv-react-mount', 'job-search-targeting');
  c.style.margin = '6px 0 2px';
  // Prefer just AFTER the WritingStylePicker island; else above PackagePicker; else
  // above Done; else append.
  const ws = document.getElementById(WRITING_STYLE_ID);
  if (ws && ws.parentElement) { ws.parentElement.insertBefore(c, ws.nextSibling); return c; }
  const pkg = document.getElementById(PACKAGE_PICKER_ID);
  if (pkg && pkg.parentElement) { pkg.parentElement.insertBefore(c, pkg); return c; }
  const done = findDoneButton(settingsRoot);
  if (done && done.parentElement) { done.parentElement.insertBefore(c, done); }
  else { settingsRoot.appendChild(c); }
  return c;
}

function unmountIfMounted(): void {
  if (root) { try { root.unmount(); } catch { /* */ } root = null; }
  if (container && container.parentElement) {
    try { container.parentElement.removeChild(container); } catch { /* */ }
  }
  container = null;
}

function applyOnce(): void {
  const settingsRoot = findSettingsRoot();
  if (!settingsRoot || !isPersonalSubtab(settingsRoot)) { unmountIfMounted(); return; }
  const next = ensureMountContainer(settingsRoot);
  if (container !== next) {
    if (root) { try { root.unmount(); } catch { /* */ } root = null; }
    container = next;
  }
  if (!root) {
    root = createRoot(container);
    root.render(createElement(JobSearchTargeting));
  }
}

let booted = false;
let observer: MutationObserver | null = null;

export function mountJobSearchTargetingIsland(): void {
  if (booted) return;
  booted = true;
  try { applyOnce(); } catch (e) { console.warn('[JobSearchTargeting] initial mount failed', e); }
  let pending = false;
  observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[JobSearchTargeting] applyOnce failed', e); }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  (window as unknown as { __antcvReactJobSearchTargetingTeardown?: () => void })
    .__antcvReactJobSearchTargetingTeardown = () => {
    try { observer?.disconnect(); } catch { /* */ }
    observer = null;
    unmountIfMounted();
    booted = false;
  };
}
