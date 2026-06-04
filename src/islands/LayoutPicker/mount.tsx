// Mount the LayoutPicker (Section layout) inside Settings → Personal,
// immediately AFTER the native Banned Words section. The Personal subtab is
// an order-based flex column (WRITING STYLE=25, ADVANCED TONE=30, BANNED
// WORDS=40); Section layout takes order 45 so it sits just below Banned
// Words. The flow reads: Writing style → (Languages) → Banned words →
// Section layout.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { LayoutPicker } from './LayoutPicker';
import {
  findDoneButton,
  findSettingsFlexColumn,
  findSettingsRoot,
  isPersonalSubtab,
} from '../../lib/settings-dom';

const MOUNT_ID = 'antcv-react-layout-picker';

// Native Personal-subtab section headers (literal uppercase) used to locate
// the order-based flex column the sections live in.
const PERSONAL_LABELS = [/^WRITING STYLE$/i, /^ADVANCED TONE$/i, /^BANNED WORDS$/i];

// CSS order slot: just after BANNED WORDS (40) → "after the banned words".
const SECTION_LAYOUT_ORDER = '45';

let root: Root | null = null;
let container: HTMLElement | null = null;

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let c = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (!c) {
    c = document.createElement('div');
    c.id = MOUNT_ID;
    c.setAttribute('data-antcv-react-mount', 'layout-picker');
    c.style.order = SECTION_LAYOUT_ORDER;
  }

  // Primary anchor: the order-based flex column of native Personal sections.
  // CSS `order` (45) places Section layout right after Banned Words (40).
  const column = findSettingsFlexColumn(settingsRoot, PERSONAL_LABELS);
  if (column) {
    c.style.order = SECTION_LAYOUT_ORDER;
    if (c.parentElement !== column) column.appendChild(c);
    return c;
  }

  // Fallback (column not detected): just before the Settings "Done" button.
  if (c.parentElement) return c;
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
