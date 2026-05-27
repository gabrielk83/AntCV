// Mount the ExportOptionsCard inside Settings → Personal, between the
// WritingStylePicker and the PackagePicker.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { ExportOptionsCard } from './ExportOptionsCard';
import { findDoneButton, findSettingsRoot, isPersonalSubtab } from '../../lib/settings-dom';

const MOUNT_ID = 'antcv-react-export-options';
const WRITING_PICKER_ID = 'antcv-react-writing-style-picker';
const PACKAGE_PICKER_ID = 'antcv-react-package-picker';

let root: Root | null = null;
let container: HTMLElement | null = null;

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let c = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (c) return c;
  c = document.createElement('div');
  c.id = MOUNT_ID;
  c.setAttribute('data-antcv-react-mount', 'export-options');

  // Preferred order in Personal:
  //   WritingStylePicker → ExportOptionsCard → PackagePicker → LanguageCard
  // Insert just above PackagePicker if present; else just below
  // WritingStylePicker; else fall back to the standard Done-button anchor.
  const pkg = document.getElementById(PACKAGE_PICKER_ID);
  if (pkg && pkg.parentElement) {
    pkg.parentElement.insertBefore(c, pkg);
    return c;
  }
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
    root.render(createElement(ExportOptionsCard));
  }
}

let booted = false;
let observer: MutationObserver | null = null;

export function mountExportOptionsIsland(): void {
  if (booted) return;
  booted = true;

  try { applyOnce(); } catch (e) { console.warn('[ExportOptions] initial mount failed', e); }
  let pending = false;
  observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[ExportOptions] applyOnce failed', e); }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  (window as unknown as { __antcvReactExportOptionsTeardown?: () => void })
    .__antcvReactExportOptionsTeardown = () => {
    try { observer?.disconnect(); } catch { /* */ }
    observer = null;
    unmountIfMounted();
    booted = false;
  };
}
