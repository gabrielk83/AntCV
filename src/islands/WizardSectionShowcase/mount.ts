// Mount the WizardSectionShowcase tile grid into the anchor that the
// vanilla wizard-language-slide-339.js sidecar inserts into the modal
// panel.
//
// Anchor convention: <div data-antcv-wizard-section-showcase></div>.
// The sidecar appends the anchor in the same DOM position the legacy
// tile grid used to occupy (between the "HOW EACH SECTION CAN LOOK"
// label / blurb and the hint panel).
//
// Lifecycle:
//   1. main.tsx → mountAll() runs at first paint. The anchor doesn't
//      exist yet because the wizard modal opens later.
//   2. The wizard sidecar opens the modal and inserts the anchor.
//      It then dispatches window CustomEvent
//      `antcv:mount-wizard-showcase` to trigger our mounter.
//   3. We attach a React root to the anchor and render the showcase.
//   4. When the modal closes (back/skip/continue), the anchor is
//      removed from the DOM. We listen for that via MutationObserver
//      and unmount the root so the next open gets a fresh mount.
//
// Why an event-driven mount instead of a polling MutationObserver
// alone: the modal is short-lived (one slide, ~30 s of user time)
// and the event lets us mount immediately instead of waiting for a
// mutation tick. The observer still runs as a safety net for clean-up.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { WizardSectionShowcase } from './WizardSectionShowcase';

const ANCHOR_ATTR = 'data-antcv-wizard-section-showcase';
const MOUNT_EVENT = 'antcv:mount-wizard-showcase';

let activeRoot: Root | null = null;
let activeAnchor: HTMLElement | null = null;
let mutationObserver: MutationObserver | null = null;

function findAnchor(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[' + ANCHOR_ATTR + ']');
}

function attach(): void {
  if (activeRoot) return; // already mounted
  const anchor = findAnchor();
  if (!anchor) return;
  activeAnchor = anchor;
  activeRoot = createRoot(anchor);
  activeRoot.render(createElement(WizardSectionShowcase));
}

function detachIfGone(): void {
  if (!activeRoot || !activeAnchor) return;
  if (document.body.contains(activeAnchor)) return;
  try { activeRoot.unmount(); } catch { /* */ }
  activeRoot = null;
  activeAnchor = null;
}

export function mountWizardSectionShowcaseIsland(): void {
  // Attempt an initial mount in case the wizard already opened
  // before this island was registered (rare but possible on slow
  // first paints).
  attach();

  // Event-driven mount: the wizard sidecar dispatches when it
  // appends the anchor. We re-call attach because activeRoot may
  // be null if no anchor was present at the initial attempt.
  window.addEventListener(MOUNT_EVENT, () => {
    attach();
  });

  // Belt-and-braces clean-up: when the modal closes, the anchor
  // leaves the DOM. We unmount so the next open gets a fresh root.
  if (mutationObserver) return;
  mutationObserver = new MutationObserver(detachIfGone);
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}
