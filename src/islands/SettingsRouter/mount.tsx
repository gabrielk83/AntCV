// Mount the headless SettingsRouter island. See SettingsRouter.tsx for the
// API surface. Pass 1 P0-3.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { SettingsRouter } from './SettingsRouter';

const MOUNT_ID = 'antcv-react-settings-router';

let root: Root | null = null;
let container: HTMLElement | null = null;

export function mountSettingsRouterIsland(): void {
  if (root) return;

  container = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = MOUNT_ID;
    container.setAttribute('data-antcv-react-mount', 'settings-router');
    container.setAttribute('aria-hidden', 'true');
    container.style.position = 'absolute';
    container.style.width = '0';
    container.style.height = '0';
    container.style.overflow = 'hidden';
    container.style.pointerEvents = 'none';
    document.body.appendChild(container);
  }

  root = createRoot(container);
  root.render(createElement(SettingsRouter));

  (window as unknown as { __antcvReactSettingsRouterTeardown?: () => void })
    .__antcvReactSettingsRouterTeardown = () => {
    try { root?.unmount(); } catch { /* */ }
    root = null;
    if (container && container.parentElement) container.parentElement.removeChild(container);
    container = null;
  };
}
