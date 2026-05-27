// Mount the preview-toolbar controller (Pass 1 P0-2).
//
// During Pass 1 transition antcv-stability-core-334.js still runs
// applyPreviewActions() on its own schedule. Our controller is functionally
// equivalent and idempotent — both writing the same styles is a no-op race.
// Pass 1 cleanup (task #8) deletes stability-core's <script> tag and our
// controller becomes the sole owner.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { PreviewToolbarController } from './PreviewToolbarController';

const MOUNT_ID = 'antcv-react-preview-toolbar-controller';

let root: Root | null = null;
let container: HTMLElement | null = null;

export function mountPreviewToolbarIsland(): void {
  if (root) return;

  container = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = MOUNT_ID;
    container.setAttribute('data-antcv-react-mount', 'preview-toolbar-controller');
    container.setAttribute('aria-hidden', 'true');
    // Headless controller — no layout impact.
    container.style.position = 'absolute';
    container.style.width = '0';
    container.style.height = '0';
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }

  root = createRoot(container);
  root.render(createElement(PreviewToolbarController));

  // Teardown hook for tests / hot-reload.
  (window as unknown as { __antcvReactPreviewToolbarTeardown?: () => void })
    .__antcvReactPreviewToolbarTeardown = () => {
    try { root?.unmount(); } catch { /* */ }
    root = null;
    if (container && container.parentElement) container.parentElement.removeChild(container);
    container = null;
  };
}
