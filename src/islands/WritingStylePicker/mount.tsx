// Mount the WritingStylePicker above the PackagePicker in Settings → Personal.
// Companion to LanguageCard / PackagePicker; same detection pattern.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { WritingStylePicker } from './WritingStylePicker';
import { findDoneButton, findSettingsRoot, isPersonalSubtab } from '../../lib/settings-dom';

const MOUNT_ID = 'antcv-react-writing-style-picker';
const PACKAGE_PICKER_ID = 'antcv-react-package-picker';

// MERGE-DUP-001 (owner: "we are using the old buttons"): the WritingStylePicker
// island owns the canonical writing-style control, but app.js still renders a
// DUPLICATE legacy <select> in Settings → Personal (12 writing-style options).
// Hide ONLY that <select> element — never its container, which also holds the two
// legacy buttons the owner keeps using. Signature = a non-island select whose
// options include the writing-style names; the custom-slots select ("Custom N
// (empty)") and the language card never match. Idempotent + scoped.
const WS_SIG_A = /nordic minimal/i;
const WS_SIG_B = /achievement[- ]?driven/i;
function hideLegacyWritingStyleSelect(settingsRoot: HTMLElement): void {
  const selects = Array.from(settingsRoot.querySelectorAll<HTMLSelectElement>('select'));
  for (const sel of selects) {
    if (sel.getAttribute('data-antcv-hidden-writing-style-stray') === '1') continue;
    if (sel.closest(`#${MOUNT_ID}`)) continue;                 // the island's own select
    if (sel.closest('#antcv-react-personal-languages')) continue;
    const opts = Array.from(sel.options).map((o) => o.textContent || '').join(' | ');
    if (WS_SIG_A.test(opts) && WS_SIG_B.test(opts)) {
      sel.setAttribute('data-antcv-hidden-writing-style-stray', '1');
      sel.style.setProperty('display', 'none', 'important');
    }
  }
}

// SETTINGS-JUMP-001 (owner 2026-06-18): the app.js native WRITING STYLE block
// (label + the now-hidden select + the long "Restraint…" description) paints
// BEFORE this island mounts, so every time Personal opens the user sees the native
// layout flash and then jump to the island layout. The island renders its OWN
// complete WRITING STYLE header + dropdown + description (see WritingStylePicker
// ~1150), so the native block is pure duplication — hide the WHOLE wrapper (not
// just the select) the instant we find it, so the native version never shows.
function hideNativeWritingStyleBlock(settingsRoot: HTMLElement): void {
  const ws = findWritingStyleControl(settingsRoot);
  if (!ws || ws.id === MOUNT_ID || ws.closest(`#${MOUNT_ID}`)) return;
  if (ws.style.display !== 'none') {
    ws.setAttribute('data-antcv-native-ws-hidden', '1');
    ws.style.setProperty('display', 'none', 'important');
  }
}

let root: Root | null = null;
let container: HTMLElement | null = null;

// v1.50.548 (owner 2026-06-17): the app.js "WRITING STYLE" control (label +
// the now-hidden legacy <select> + a description) sits near the TOP of the
// Personal panel, while the island lived lower (above PackagePicker) — so the
// orphaned description showed "very much above" the real selector. Anchor the
// island just ABOVE that app.js control so the selector moves up to it. Returns
// the control wrapper (the div whose text starts with "WRITING STYLE").
function findWritingStyleControl(settingsRoot: HTMLElement): HTMLElement | null {
  const selects = Array.from(settingsRoot.querySelectorAll<HTMLSelectElement>('select'));
  for (const sel of selects) {
    if (sel.closest(`#${MOUNT_ID}`)) continue;
    const opts = Array.from(sel.options).map((o) => o.textContent || '').join(' | ');
    if (!(WS_SIG_A.test(opts) && WS_SIG_B.test(opts))) continue;
    let n: HTMLElement | null = sel.parentElement;
    for (let hops = 0; n && hops < 4; hops++, n = n.parentElement) {
      if (/^\s*WRITING STYLE/i.test((n.textContent || '').slice(0, 80))) return n;
    }
    return sel.parentElement as HTMLElement | null;
  }
  return null;
}

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  const ws = findWritingStyleControl(settingsRoot);
  let c = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (c) {
    // Re-anchor above the WRITING STYLE control if a re-render moved things.
    if (ws && ws.parentElement && c.nextSibling !== ws) {
      try { ws.parentElement.insertBefore(c, ws); } catch { /* */ }
    }
    return c;
  }
  c = document.createElement('div');
  c.id = MOUNT_ID;
  c.setAttribute('data-antcv-react-mount', 'writing-style-picker');
  // Reserve the island's vertical space from creation so the section list below
  // (BACKGROUND / CV SIDEBAR / …) doesn't jump down when the island paints. Cleared
  // to natural height in applyOnce once the island has rendered children.
  c.style.minHeight = '220px';

  // Prefer anchoring just ABOVE the app.js WRITING STYLE control (top of
  // Personal). Fall back to above the PackagePicker, then the Done button.
  if (ws && ws.parentElement) {
    ws.parentElement.insertBefore(c, ws);
    return c;
  }
  const pkg = document.getElementById(PACKAGE_PICKER_ID);
  if (pkg && pkg.parentElement) {
    pkg.parentElement.insertBefore(c, pkg);
    return c;
  }
  const done = findDoneButton(settingsRoot);
  if (done && done.parentElement) {
    done.parentElement.insertBefore(c, done);
  } else {
    settingsRoot.appendChild(c);
  }
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
  if (!settingsRoot || !isPersonalSubtab(settingsRoot)) {
    unmountIfMounted();
    return;
  }
  const next = ensureMountContainer(settingsRoot);
  if (container !== next) {
    if (root) { try { root.unmount(); } catch { /* */ } root = null; }
    container = next;
  }
  if (!root) {
    root = createRoot(container);
    root.render(createElement(WritingStylePicker));
  }
  // Hide the duplicate legacy writing-style <select> AND the whole native WRITING
  // STYLE block (re-run each pass — app.js re-renders the Personal column on state
  // churn, re-adding them), so the native layout never flashes before the island.
  try { hideLegacyWritingStyleSelect(settingsRoot); } catch { /* */ }
  try { hideNativeWritingStyleBlock(settingsRoot); } catch { /* */ }
  // Release the reserved height once the island has actually painted, so its real
  // (possibly taller/shorter) content isn't clipped or over-padded.
  if (container) {
    if (container.firstElementChild) container.style.minHeight = '';
    else if (!container.style.minHeight) container.style.minHeight = '220px';
  }
}

let booted = false;
let observer: MutationObserver | null = null;

export function mountWritingStylePickerIsland(): void {
  if (booted) return;
  booted = true;

  try { applyOnce(); } catch (e) { console.warn('[WritingStylePicker] initial mount failed', e); }
  let pending = false;
  observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[WritingStylePicker] applyOnce failed', e); }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  (window as unknown as { __antcvReactWritingStylePickerTeardown?: () => void })
    .__antcvReactWritingStylePickerTeardown = () => {
    try { observer?.disconnect(); } catch { /* */ }
    observer = null;
    unmountIfMounted();
    booted = false;
  };
}
