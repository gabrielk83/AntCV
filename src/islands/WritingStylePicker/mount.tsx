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

let root: Root | null = null;
let container: HTMLElement | null = null;

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let c = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (c) return c;
  c = document.createElement('div');
  c.id = MOUNT_ID;
  c.setAttribute('data-antcv-react-mount', 'writing-style-picker');

  // Prefer inserting just above the PackagePicker so order is:
  // WritingStylePicker → PackagePicker → LanguageCard.
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
  // Hide the duplicate legacy writing-style <select> (re-run each pass — app.js
  // re-renders the Personal column on state churn, re-adding the select).
  try { hideLegacyWritingStyleSelect(settingsRoot); } catch { /* */ }
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
