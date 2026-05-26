// AntCV React islands entry point.
// Bundled by Vite into pwa/antcv-react-islands.js (IIFE).
// React / ReactDOM are externalised — they come from window.React / window.ReactDOM
// loaded via the UMD <script> tags in pwa/index.html (lines 17-18).
//
// This bundle never owns the page. It mounts small islands into specific DOM
// anchors rendered by the vanilla pwa/app.js React app. Each island is a
// proper React 18 root.

import { mountLanguageCardIsland } from './islands/LanguageCard/mount';
import { mountPreviewToolbarIsland } from './islands/PreviewToolbar/mount';
import { mountSettingsRouterIsland } from './islands/SettingsRouter/mount';
import { exposeDebugApi, installWizardStateGuard } from './lib/wizard-state';

const VERSION = '1.50.0-pass1';

declare global {
  interface Window {
    AntcvReactIslands?: AntcvReactIslandsAPI;
    __antcvReactIslandsBooted?: string;
  }
}

interface AntcvReactIslandsAPI {
  version: string;
  mountAll: () => void;
}

// Install the wizard-state guard synchronously — before any island mounts —
// so that even if app.js fires a write between bundle boot and DOMContentLoaded,
// the guard is in place.
try { installWizardStateGuard(); } catch (e) { console.warn('[react-islands] wizard-state guard install failed', e); }
try { exposeDebugApi(); } catch (e) { console.warn('[react-islands] wizard-state debug api install failed', e); }

const api: AntcvReactIslandsAPI = {
  version: VERSION,
  mountAll() {
    try { mountLanguageCardIsland(); } catch (e) { console.warn('[react-islands] LanguageCard mount failed', e); }
    try { mountPreviewToolbarIsland(); } catch (e) { console.warn('[react-islands] PreviewToolbar mount failed', e); }
    try { mountSettingsRouterIsland(); } catch (e) { console.warn('[react-islands] SettingsRouter mount failed', e); }
  },
};

if (window.__antcvReactIslandsBooted === VERSION) {
  // double-include guard — same version, no re-init.
} else {
  window.__antcvReactIslandsBooted = VERSION;
  window.AntcvReactIslands = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => api.mountAll(), { once: true });
  } else {
    api.mountAll();
  }
}

export { api };
