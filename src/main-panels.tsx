// AntCV React islands entry point — PANELS bundle.
// Bundled by Vite into pwa/antcv-react-islands-panels.js (IIFE).
// React / ReactDOM are externalised the same way as the core bundle (see
// main-core.tsx) — they come from window.React / window.ReactDOM.
//
// PERF-ISLANDS-SPLIT-001: this bundle carries the four islands that only
// matter once the user opens Settings — SettingsRouter, PackagePicker,
// ExportOptions, LayoutPicker. main-core.tsx loads this file lazily
// (requestIdleCallback, ~1.5s fallback) after the always-visible islands
// have mounted, so parsing/executing this code never competes with initial
// paint / Time to Interactive. Every mount function here already no-ops
// until its Settings subtab is open (findSettingsRoot() / isLayoutSubtab()),
// so deferring the load changes nothing about behaviour — only timing.
//
// None of these islands expose a global that anything outside this bundle
// depends on synchronously (unlike WritingStylePicker's
// window.AntcvMountToneEditors, which is why WritingStylePicker stays in
// main-core.tsx instead of here).

import { mountSettingsRouterIsland } from './islands/SettingsRouter/mount';
import { mountPackagePickerIsland } from './islands/PackagePicker/mount';
import { mountExportOptionsIsland } from './islands/ExportOptions/mount';
import { mountLayoutPickerIsland } from './islands/LayoutPicker/mount';

const VERSION = '1.51.157';

declare global {
  interface Window {
    AntcvReactPanels?: AntcvReactPanelsAPI;
    __antcvReactPanelsBooted?: string;
  }
}

interface AntcvReactPanelsAPI {
  version: string;
  mountAll: () => void;
}

const api: AntcvReactPanelsAPI = {
  version: VERSION,
  mountAll() {
    try { mountSettingsRouterIsland(); } catch (e) { console.warn('[react-islands-panels] SettingsRouter mount failed', e); }
    try { mountPackagePickerIsland(); } catch (e) { console.warn('[react-islands-panels] PackagePicker mount failed', e); }
    try { mountExportOptionsIsland(); } catch (e) { console.warn('[react-islands-panels] ExportOptions mount failed', e); }
    try { mountLayoutPickerIsland(); } catch (e) { console.warn('[react-islands-panels] LayoutPicker mount failed', e); }
  },
};

if (window.__antcvReactPanelsBooted === VERSION) {
  // double-include guard — same version, no re-init.
} else {
  window.__antcvReactPanelsBooted = VERSION;
  window.AntcvReactPanels = api;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => api.mountAll(), { once: true });
  } else {
    api.mountAll();
  }
}

export { api };
