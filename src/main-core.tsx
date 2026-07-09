// AntCV React islands entry point — CORE bundle.
// Bundled by Vite into pwa/antcv-react-islands.js (IIFE).
// React / ReactDOM are externalised — they come from window.React / window.ReactDOM
// loaded via the UMD <script> tags in pwa/index.html (lines 17-18).
//
// PERF-ISLANDS-SPLIT-001: this file used to mount every island (main.tsx).
// It now mounts only the islands that matter on first paint — the ones
// visible before the user opens Settings — and schedules the "panels"
// bundle (Settings / Package Picker / Export Options / Layout Picker; see
// main-panels.tsx) to load during browser idle time instead of blocking
// the initial script-parse/execute work. Those four islands are gated on
// findSettingsRoot()/isLayoutSubtab() and no-op until Settings is actually
// open, so deferring their code has no user-visible effect except a
// smaller initial JS payload and earlier Time to Interactive.
//
// This bundle never owns the page. It mounts small islands into specific DOM
// anchors rendered by the vanilla pwa/app.js React app. Each island is a
// proper React 18 root.

import { mountLanguageCardIsland } from './islands/LanguageCard/mount';
import { mountPreviewToolbarIsland } from './islands/PreviewToolbar/mount';
import { mountWritingStylePickerIsland } from './islands/WritingStylePicker/mount';
import { mountToneEditorsInto } from './islands/WritingStylePicker/WritingStylePicker';
import { mountBreadcrumbsIsland } from './islands/Breadcrumbs/mount';
import { mountWizardSectionShowcaseIsland } from './islands/WizardSectionShowcase/mount';
import { mountWizardLanguagePickerIsland } from './islands/WizardLanguagePicker/mount';
import { mountJobSearchTargetingIsland } from './islands/JobSearchTargeting/mount';
import { mountJobTrackerIsland } from './islands/JobTracker/mount';
import { exposeDebugApi, installWizardStateGuard } from './lib/wizard-state';
import { installPackageBodyBinding, exposePackageDebugApi } from './lib/body-package';
import { installCustomModeApi } from './lib/custom-mode';
import { exposeMigrationDebugApi, runGabrielMigration } from './lib/gabriel-migration';
import { installWritingStyleFetchWrap } from './lib/install-fetch-wrap';
import { exposeObservabilityApi } from './lib/observability';

const VERSION = '1.51.223';

declare global {
  interface Window {
    AntcvReactIslands?: AntcvReactIslandsAPI;
    __antcvReactIslandsBooted?: string;
  }
}

interface AntcvReactIslandsAPI {
  version: string;
  mountAll: () => void;
  mountToneEditors: (node: HTMLElement) => () => void;
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

// PERF-ISLANDS-SPLIT-001: load the panels bundle during idle time, well
// after the core islands have mounted, so its MutationObservers/heartbeats
// start off the initial-load critical path. requestIdleCallback isn't
// available in Safari — setTimeout is an equally safe fallback since the
// panel islands are gated on Settings being open and cost nothing until then.
const PANELS_SCRIPT_ID = 'antcv-react-panels-script';
function loadPanelsBundle(): void {
  if (document.getElementById(PANELS_SCRIPT_ID)) return;
  const s = document.createElement('script');
  s.id = PANELS_SCRIPT_ID;
  s.src = 'antcv-react-islands-panels.js?v=' + VERSION;
  s.defer = true;
  s.onerror = () => console.warn('[react-islands] panels bundle failed to load');
  document.head.appendChild(s);
}
function schedulePanelsLoad(): void {
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof idle === 'function') idle(loadPanelsBundle, { timeout: 3000 });
  else setTimeout(loadPanelsBundle, 1500);
}

const api: AntcvReactIslandsAPI = {
  version: VERSION,
  mountAll() {
    try { mountLanguageCardIsland(); } catch (e) { console.warn('[react-islands] LanguageCard mount failed', e); }
    try { mountPreviewToolbarIsland(); } catch (e) { console.warn('[react-islands] PreviewToolbar mount failed', e); }
    try { mountWritingStylePickerIsland(); } catch (e) { console.warn('[react-islands] WritingStylePicker mount failed', e); }
    try { mountBreadcrumbsIsland(); } catch (e) { console.warn('[react-islands] Breadcrumbs mount failed', e); }
    try { mountWizardSectionShowcaseIsland(); } catch (e) { console.warn('[react-islands] WizardSectionShowcase mount failed', e); }
    try { mountWizardLanguagePickerIsland(); } catch (e) { console.warn('[react-islands] WizardLanguagePicker mount failed', e); }
    try { mountJobSearchTargetingIsland(); } catch (e) { console.warn('[react-islands] JobSearchTargeting mount failed', e); }
    try { mountJobTrackerIsland(); } catch (e) { console.warn('[react-islands] JobTracker mount failed', e); }
    schedulePanelsLoad();
  },
  mountToneEditors: mountToneEditorsInto,
};

// PERSONAL-MERGE-3 fix: vite's IIFE `name: 'AntcvReactIslands'` reassigns
// window.AntcvReactIslands to the module NAMESPACE ({ api }) AFTER this body runs,
// clobbering the `window.AntcvReactIslands = api` set below — so external callers
// see `.api.mountToneEditors`, not `.mountToneEditors`. Expose the mounter on a
// dedicated global the wrapper never touches, so the Review & Edit modal can find
// it deterministically regardless of the namespace clobber.
(window as unknown as { AntcvMountToneEditors?: (node: HTMLElement) => () => void })
  .AntcvMountToneEditors = mountToneEditorsInto;

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
