// Mount the LayoutPicker inside Settings → Personal. Placed between the
// WritingStylePicker and the ExportOptionsCard so the user flow reads:
//   Style → Tone chips → Saved tones → Target pages → Bans → SECTION LAYOUT
//   → Export options → Visual package → Languages.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { LayoutPicker } from './LayoutPicker';
import { findDoneButton, findSettingsRoot, isPersonalSubtab } from '../../lib/settings-dom';

const MOUNT_ID = 'antcv-react-layout-picker';
const EXPORT_OPTIONS_ID = 'antcv-react-export-options';
const WRITING_PICKER_ID = 'antcv-react-writing-style-picker';

let root: Root | null = null;
let container: HTMLElement | null = null;

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let c = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (c) return c;
  c = document.createElement('div');
  c.id = MOUNT_ID;
  c.setAttribute('data-antcv-react-mount', 'layout-picker');

  // Preferred anchor: just above the ExportOptionsCard.
  const exp = document.getElementById(EXPORT_OPTIONS_ID);
  if (exp && exp.parentElement) {
    exp.parentElement.insertBefore(c, exp);
    return c;
  }
  // Fallback: just below the WritingStylePicker.
  const writing = document.getElementById(WRITING_PICKER_ID);
  if (writing && writing.parentElement) {
    writing.parentElement.insertBefore(c, writing.nextSibling);
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
