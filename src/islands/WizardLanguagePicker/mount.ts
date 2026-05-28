// Mount the WizardLanguagePicker into the anchor the vanilla wizard
// sidecar appends inside the step-10 modal panel.
//
// Same lifecycle pattern as the WizardSectionShowcase island
// (Phase A v1.50.38) — see that file for the rationale on
// event-driven mount + MutationObserver cleanup.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { WizardLanguagePicker } from './WizardLanguagePicker';

const ANCHOR_ATTR = 'data-antcv-wizard-language-picker';
const MOUNT_EVENT = 'antcv:mount-wizard-language-picker';

let activeRoot: Root | null = null;
let activeAnchor: HTMLElement | null = null;
let mutationObserver: MutationObserver | null = null;

function findAnchor(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[' + ANCHOR_ATTR + ']');
}

function attach(): void {
  if (activeRoot) return;
  const anchor = findAnchor();
  if (!anchor) return;
  activeAnchor = anchor;
  activeRoot = createRoot(anchor);
  activeRoot.render(createElement(WizardLanguagePicker));
}

function detachIfGone(): void {
  if (!activeRoot || !activeAnchor) return;
  if (document.body.contains(activeAnchor)) return;
  try { activeRoot.unmount(); } catch { /* */ }
  activeRoot = null;
  activeAnchor = null;
}

export function mountWizardLanguagePickerIsland(): void {
  attach();
  window.addEventListener(MOUNT_EVENT, () => {
    attach();
  });
  if (mutationObserver) return;
  mutationObserver = new MutationObserver(detachIfGone);
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}
