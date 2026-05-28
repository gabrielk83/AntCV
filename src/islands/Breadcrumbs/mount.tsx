// Mount the floating Breadcrumbs panel. Single global instance; lives on
// document.body regardless of which screen the user is on.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { Breadcrumbs } from './Breadcrumbs';

const MOUNT_ID = 'antcv-react-breadcrumbs';

let root: Root | null = null;
let container: HTMLElement | null = null;

export function mountBreadcrumbsIsland(): void {
  if (root) return;

  container = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = MOUNT_ID;
    container.setAttribute('data-antcv-react-mount', 'breadcrumbs');
    document.body.appendChild(container);
  }

  root = createRoot(container);
  root.render(createElement(Breadcrumbs));

  // Window-side helper: lets a power user re-open the panel after they
  // dismissed it, without a full page reload.
  (window as unknown as {
    AntcvBreadcrumbs?: { show: () => void; hide: () => void };
  }).AntcvBreadcrumbs = {
    show: () => {
      try { sessionStorage.removeItem('antcv:breadcrumbs-dismissed'); } catch { /* */ }
      // Re-render by forcing a remount.
      if (root && container) {
        try { root.unmount(); } catch { /* */ }
        root = createRoot(container);
        root.render(createElement(Breadcrumbs));
      }
    },
    hide: () => {
      try { sessionStorage.setItem('antcv:breadcrumbs-dismissed', '1'); } catch { /* */ }
      if (root && container) {
        try { root.unmount(); } catch { /* */ }
        root = createRoot(container);
        root.render(createElement(Breadcrumbs));
      }
    },
  };
}
