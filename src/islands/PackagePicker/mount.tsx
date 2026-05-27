// Mount the PackagePicker inside Settings → Personal. Companion to the
// LanguageCard mount — same detection (Settings root + Personal subtab),
// same scoped-MutationObserver-on-body pattern, separate anchor id.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { PackagePicker } from './PackagePicker';
import { findDoneButton, findSettingsRoot, isPersonalSubtab } from '../../lib/settings-dom';
import { applyPackageToBody, exposePackageDebugApi, installPackageBodyBinding } from '../../lib/body-package';

const MOUNT_ID = 'antcv-react-package-picker';
const LANG_CARD_ID = 'antcv-react-personal-languages';
const LEGACY_LANG_CARD_ID = 'antcv-stability-personal-languages';

interface MountState { root: Root | null; container: HTMLElement | null }
const state: MountState = { root: null, container: null };

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let container = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (container) return container;

  container = document.createElement('div');
  container.id = MOUNT_ID;
  container.setAttribute('data-antcv-react-mount', 'package-picker');

  // Prefer to mount just above the LanguageCard (or its legacy equivalent)
  // so Personal reads: existing identity / appearance / language. Falls
  // back to "before Done button" or end of root.
  const langCard =
    (document.getElementById(LANG_CARD_ID) as HTMLElement | null) ??
    (document.getElementById(LEGACY_LANG_CARD_ID) as HTMLElement | null);
  if (langCard && langCard.parentElement) {
    langCard.parentElement.insertBefore(container, langCard);
    return container;
  }
  const done = findDoneButton(settingsRoot);
  if (done && done.parentElement) {
    done.parentElement.insertBefore(container, done);
  } else {
    settingsRoot.appendChild(container);
  }
  return container;
}

function unmountIfMounted(): void {
  if (state.root) {
    try { state.root.unmount(); } catch { /* */ }
    state.root = null;
  }
  if (state.container && state.container.parentElement) {
    try { state.container.parentElement.removeChild(state.container); } catch { /* */ }
  }
  state.container = null;
}

function applyOnce(): void {
  const settingsRoot = findSettingsRoot();
  if (!settingsRoot) {
    unmountIfMounted();
    return;
  }
  if (!isPersonalSubtab(settingsRoot)) {
    unmountIfMounted();
    return;
  }
  const container = ensureMountContainer(settingsRoot);
  if (state.container !== container) {
    if (state.root) {
      try { state.root.unmount(); } catch { /* */ }
      state.root = null;
    }
    state.container = container;
  }
  if (!state.root) {
    state.root = createRoot(container);
    state.root.render(createElement(PackagePicker));
  }
}

let booted = false;
let observer: MutationObserver | null = null;

export function mountPackagePickerIsland(): void {
  if (booted) return;
  booted = true;

  // Ensure body[data-package="..."] is in place immediately — even before
  // the picker UI mounts — so the CSS variable bundle is active.
  try { installPackageBodyBinding(); } catch (e) { console.warn('[PackagePicker] body binding failed', e); }
  try { exposePackageDebugApi(); } catch (e) { console.warn('[PackagePicker] debug API failed', e); }
  try { applyPackageToBody(); } catch (e) { console.warn('[PackagePicker] initial apply failed', e); }

  try { applyOnce(); } catch (e) { console.warn('[PackagePicker] initial mount failed', e); }

  let pending = false;
  observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[PackagePicker] applyOnce failed', e); }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  (window as unknown as { __antcvReactPackagePickerTeardown?: () => void })
    .__antcvReactPackagePickerTeardown = () => {
    try { observer?.disconnect(); } catch { /* */ }
    observer = null;
    unmountIfMounted();
    booted = false;
  };
}
