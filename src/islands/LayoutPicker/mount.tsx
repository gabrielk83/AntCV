// Mount the LayoutPicker (Section layout) inside Settings → ADVANCED → Style,
// immediately AFTER the native SECTION FORMATS control (the per-section
// Paragraph/Bullets/Table picker, `data-antcv-format-prefs`). Moved out of
// Personal in v1.50.101: the per-section line/format overrides belong next to
// the section-format control, not in Personal. We gate on the presence of the
// SECTION FORMATS block (only rendered in Adv → Style) rather than tab-state
// detection, so the two read as one combined section-layout control.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { LayoutPicker } from './LayoutPicker';
import {
  findSettingsRoot,
  isElementVisible,
} from '../../lib/settings-dom';

const MOUNT_ID = 'antcv-react-layout-picker';

// The native SECTION FORMATS control in Adv → Style. Its presence (visible)
// is our anchor + gate — it is not rendered in any other subtab.
const FORMAT_PREFS_SEL = '[data-antcv-format-prefs]';

function findFormatPrefsBlock(settingsRoot: HTMLElement): HTMLElement | null {
  const el = settingsRoot.querySelector<HTMLElement>(FORMAT_PREFS_SEL);
  return el && isElementVisible(el) ? el : null;
}

let root: Root | null = null;
let container: HTMLElement | null = null;

function ensureMountContainer(formatPrefs: HTMLElement): HTMLElement {
  let c = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (!c) {
    c = document.createElement('div');
    c.id = MOUNT_ID;
    c.setAttribute('data-antcv-react-mount', 'layout-picker');
  }
  // Leftover order from the previous Personal placement would misposition the
  // card in any flex parent — clear it.
  if (c.style.order) c.style.order = '';

  // Primary anchor: immediately after the SECTION FORMATS block, so the
  // per-section line/format overrides read as a continuation of it.
  if (c.previousElementSibling !== formatPrefs || c.parentElement !== formatPrefs.parentElement) {
    formatPrefs.insertAdjacentElement('afterend', c);
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
  if (!settingsRoot) {
    unmountIfMounted();
    return;
  }
  const formatPrefs = findFormatPrefsBlock(settingsRoot);
  if (!formatPrefs) {
    // Not on Adv → Style (SECTION FORMATS absent) — stand down.
    unmountIfMounted();
    return;
  }
  const next = ensureMountContainer(formatPrefs);
  if (container !== next) {
    if (root) { try { root.unmount(); } catch { /* */ } root = null; }
    container = next;
  }
  if (!root) {
    root = createRoot(container);
    root.render(createElement(LayoutPicker));
  }
}

let booted = false;
let observer: MutationObserver | null = null;

export function mountLayoutPickerIsland(): void {
  if (booted) return;
  booted = true;

  try { applyOnce(); } catch (e) { console.warn('[LayoutPicker] initial mount failed', e); }
  let pending = false;
  observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[LayoutPicker] applyOnce failed', e); }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  (window as unknown as { __antcvReactLayoutPickerTeardown?: () => void })
    .__antcvReactLayoutPickerTeardown = () => {
    try { observer?.disconnect(); } catch { /* */ }
    observer = null;
    unmountIfMounted();
    booted = false;
  };
}
