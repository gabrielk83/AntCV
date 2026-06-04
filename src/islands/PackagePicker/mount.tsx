// Mount the PackagePicker inside Settings → LAYOUT (moved out of Personal in
// v1.50.95). The native Layout subtab already owns package SELECTION via the
// STYLE PACKAGE buttons; this island supplies the parts the native buttons
// lack — the Quick-alternative selector and the Custom-mode explanation —
// anchored immediately below the native STYLE PACKAGE section. The redundant
// 7-package grid is hidden (context="layout"); package choice stays with the
// native buttons. Personal no longer carries any visual-package control.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { PackagePicker } from './PackagePicker';
import {
  findAdvancedStyleButton,
  findDoneButton,
  findSectionBlockBeforeNext,
  findSettingsRoot,
  isLayoutSubtab,
} from '../../lib/settings-dom';
import { applyPackageToBody, exposePackageDebugApi, installPackageBodyBinding } from '../../lib/body-package';

const MOUNT_ID = 'antcv-react-package-picker';

// Native Layout-subtab section headers (literal uppercase). The Layout subtab
// is block-flow (not the order-based flex column Personal uses), so we anchor
// the card immediately after the STYLE PACKAGE section block — proven to be a
// top-level section because SIDEBAR POSITION follows it.
const STYLE_PACKAGE_RE = /^STYLE PACKAGE$/i;
// Contains-match: the following section's full textContent is "SIDEBAR
// POSITION" + its button labels, so this must not be anchored with $.
const SIDEBAR_POSITION_RE = /SIDEBAR POSITION/i;

interface MountState { root: Root | null; container: HTMLElement | null }
const state: MountState = { root: null, container: null };

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let container = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = MOUNT_ID;
    container.setAttribute('data-antcv-react-mount', 'package-picker');
  }

  // Primary anchor: immediately after the native STYLE PACKAGE section, so the
  // Quick-alt / Custom card reads as a continuation of the package buttons.
  const styleSection = findSectionBlockBeforeNext(settingsRoot, STYLE_PACKAGE_RE, SIDEBAR_POSITION_RE);
  if (styleSection) {
    if (container.previousElementSibling !== styleSection) {
      styleSection.insertAdjacentElement('afterend', container);
    }
    return container;
  }

  // Fallbacks: above the "Open Advanced → Style" hand-off button, else above Done.
  if (container.parentElement) return container;
  const advBtn = findAdvancedStyleButton(settingsRoot);
  if (advBtn && advBtn.parentElement) {
    advBtn.parentElement.insertBefore(container, advBtn);
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
  if (!isLayoutSubtab(settingsRoot)) {
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
    state.root.render(createElement(PackagePicker, { context: 'layout' }));
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
