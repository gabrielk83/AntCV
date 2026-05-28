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
import { mountPackagePickerIsland } from './islands/PackagePicker/mount';
import { mountWritingStylePickerIsland } from './islands/WritingStylePicker/mount';
import { mountExportOptionsIsland } from './islands/ExportOptions/mount';
import { mountLayoutPickerIsland } from './islands/LayoutPicker/mount';
import { mountBreadcrumbsIsland } from './islands/Breadcrumbs/mount';
import { exposeDebugApi, installWizardStateGuard } from './lib/wizard-state';
import { installPackageBodyBinding, exposePackageDebugApi } from './lib/body-package';
import { installCustomModeApi } from './lib/custom-mode';
import { exposeMigrationDebugApi, runGabrielMigration } from './lib/gabriel-migration';
import { installWritingStyleFetchWrap } from './lib/install-fetch-wrap';
import { exposeObservabilityApi } from './lib/observability';

const VERSION = '1.50.15';

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

// Install the wizard-state guard + body[data-package] binding synchronously —
// before any island mounts — so that even if app.js fires a write between
// bundle boot and DOMContentLoaded, both guards are in place and the visual
// package's CSS variables are bound to <body> on the first paint.
try { installWizardStateGuard(); } catch (e) { console.warn('[react-islands] wizard-state guard install failed', e); }
try { exposeDebugApi(); } catch (e) { console.warn('[react-islands] wizard-state debug api install failed', e); }
try { installPackageBodyBinding(); } catch (e) { console.warn('[react-islands] package body binding failed', e); }
try { exposePackageDebugApi(); } catch (e) { console.warn('[react-islands] package debug api failed', e); }
try { installCustomModeApi(); } catch (e) { console.warn('[react-islands] custom-mode api failed', e); }

// Plan §4.5.2 + §4.5.3 — idempotent v1.50 migration. Sets the default writing
// style and partitions Gabriel's banned items into en / da buckets. Re-running
// is a no-op.
try { runGabrielMigration(); } catch (e) { console.warn('[react-islands] gabriel migration failed', e); }
try { exposeMigrationDebugApi(); } catch (e) { console.warn('[react-islands] migration debug api failed', e); }

// v1.50.1 — outermost fetch wrap that injects writing-style fields from
// personalInfo.writingPrefs + .layoutPrefs into outgoing LLM-shaped POSTs.
// The proxy worker (workers/proxy/src/index.js) reads `_antcv_writing_style`
// and strips it before forwarding to the upstream provider. Installed
// AFTER all defer-loaded sidecars wrap window.fetch so we sit outermost
// per the CLAUDE.md fetch-chain note.
try { installWritingStyleFetchWrap(); } catch (e) { console.warn('[react-islands] writing-style fetch wrap failed', e); }
try { exposeObservabilityApi(); } catch (e) { console.warn('[react-islands] observability api failed', e); }

const api: AntcvReactIslandsAPI = {
  version: VERSION,
  mountAll() {
    try { mountLanguageCardIsland(); } catch (e) { console.warn('[react-islands] LanguageCard mount failed', e); }
    try { mountPreviewToolbarIsland(); } catch (e) { console.warn('[react-islands] PreviewToolbar mount failed', e); }
    try { mountSettingsRouterIsland(); } catch (e) { console.warn('[react-islands] SettingsRouter mount failed', e); }
    try { mountPackagePickerIsland(); } catch (e) { console.warn('[react-islands] PackagePicker mount failed', e); }
    try { mountWritingStylePickerIsland(); } catch (e) { console.warn('[react-islands] WritingStylePicker mount failed', e); }
    try { mountExportOptionsIsland(); } catch (e) { console.warn('[react-islands] ExportOptions mount failed', e); }
    try { mountLayoutPickerIsland(); } catch (e) { console.warn('[react-islands] LayoutPicker mount failed', e); }
    try { mountBreadcrumbsIsland(); } catch (e) { console.warn('[react-islands] Breadcrumbs mount failed', e); }
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
