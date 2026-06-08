/* AntCV subtitle/specialisation sequencing (v1.50.368)
 * ============================================================
 *
 * Bug
 * ───
 * PREVIEW-SUBTITLE-RACE-001 / KERNEL-SPECIALIZATION-LINE-001.
 * Entering the preview for an application shows the TEMPLATE
 * specialisation placeholder ("[Specialisation — 1-3 focus
 * areas…]") on the FIRST paint and only resolves to the real
 * specialisation after the user switches to another application
 * in history and back. Every OTHER element (name, CV/CL sections,
 * company) is correct on first paint.
 *
 * Why (confirmed from the live boot log + the data layer)
 * ──────────────────────────────────────────────────────
 *   1. boot: `mount-hydrated active application N` stamps the
 *      header line from `io.subtitle` (= localStorage `meta.subtitle`),
 *      which is empty/placeholder at that instant.
 *   2. `[Read from Cloud] unsolicited row` resolves LATER and
 *      carries the real subtitle (the `application` row has had a
 *      persisted `subtitle` column since 1.50.224), but the header
 *      already painted and that one line is not re-rendered.
 *   3. Switching apps re-reads the row → `meta.subtitle` fills →
 *      the line finally shows. That manual switch is the only
 *      thing that currently re-triggers the read.
 *
 * The subtitle is the only field sourced from the late cloud row;
 * name/sections/company come through the kernel-showcase restore
 * that completes before mount, which is why only this line is wrong.
 *
 * What this sidecar does — SEQUENCE THE READ, then CAPTURE
 * ────────────────────────────────────────────────────────
 *   A. On entry to preview (and at boot), resolve the subtitle from
 *      the best available source IN ORDER and commit it to
 *      `meta.subtitle` BEFORE the line settles, so the first useful
 *      paint already has it:
 *         1. live `meta.subtitle`            (already correct → done)
 *         2. the ACTIVE application row's `subtitle`
 *               a. from the local app-cache if present
 *               b. else a direct relay GET /api/applications (one-shot)
 *         3. the kernel-showcase slot's `meta.subtitle`
 *               a. local kernel meta
 *               b. else relay GET /api/kernel-showcase (one-shot)
 *      The first NON-EMPTY, NON-PLACEHOLDER value wins.
 *   B. CAPTURE: once resolved, write it into `meta.subtitle` and fire
 *      the same nudge the editor listens for, so the NEXT
 *      edit→preview round already reads a populated local value and
 *      can never lose the race again. Capture also runs on the
 *      edit→preview transition itself (clicking the Preview tab).
 *
 * Placeholder detection (treated as "not resolved yet"):
 *   empty / whitespace, or  /^\[\s*specialis/i  (EN "[Specialisation…",
 *   DA "[Specialisering…"), or a string containing "fokusområder".
 *
 * Safety
 * ──────
 *   - Only ever WRITES `meta.subtitle`; never touches sections,
 *     company, role, or any other field. If nothing resolvable is
 *     found it does nothing (the app keeps showing its placeholder,
 *     exactly as before — no regression).
 *   - Relay GETs are one-shot per session, fire-and-forget, fully
 *     guarded; offline / no-auth / 401 / parse-error is a silent
 *     no-op. Never blocks paint.
 *   - Re-entrant safe; idempotent (won't rewrite an identical value).
 *   - Escape hatch: localStorage['antcv:disable-subtitle-sequence']='1'.
 *
 * Cooperation
 * ───────────
 *   `antcv-candidate-preview-editor-341.js` owns making the line
 *   EDITABLE and reads `meta.subtitle`; it re-sweeps on the synthetic
 *   `storage` event for the `meta` key, which this sidecar dispatches.
 *   So once we populate `meta.subtitle`, the editor renders it.
 */
(function () {
  'use strict';

  var VERSION = '1.50.368';
  if (window.__antcvSubtitleSequence368 === VERSION) return;
  window.__antcvSubtitleSequence368 = VERSION;

  var META_KEY = 'meta';
  var DISABLE_KEY = 'antcv:disable-subtitle-sequence';
  var TOKEN_KEY = 'antcv:auth:token';

  // One-shot guards so each remote source is fetched at most once/session.
  var triedApplications = false;
  var triedKernel = false;

  function disabled() {
    try {
      var v = localStorage.getItem(DISABLE_KEY);
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(/[\t\n\r ]+/g, ' ').trim();
  }

  // A value counts as "real" only if it is non-empty AND not the
  // localised specialisation placeholder.
  function isResolved(s) {
    var t = clean(s);
    if (!t) return false;
    if (/^\[\s*specialis/i.test(t)) return false;     // [Specialisation… / [Specialisering…
    if (/fokusomr[aå]der/i.test(t)) return false;     // DA placeholder body
    if (/^\[/.test(t) && /\]$/.test(t)) return false; // any bracketed template hint
    return true;
  }

  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return (v && typeof v === 'object') ? v : null;
    } catch (_) { return null; }
  }

  function readMeta() { return readJSON(META_KEY) || {}; }

  // Commit a resolved subtitle into meta and nudge the app + the
  // candidate editor (which re-sweeps on a `meta` storage event).
  function commitSubtitle(sub) {
    var next = clean(sub);
    if (!isResolved(next)) return false;
    var meta = readMeta();
    if (clean(meta.subtitle) === next) return false; // idempotent
    meta.subtitle = next;
    try {
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    } catch (_) { return false; }
    // Same-tab writes don't fire 'storage'; dispatch it so the editor
    // (storage[key===meta]) and the app shell re-render the line.
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: META_KEY, newValue: localStorage.getItem(META_KEY),
      }));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'subtitle-sequence-368' },
      }));
    } catch (_) {}
    try { console.debug('[subtitle-sequence-368] committed subtitle from sequenced read'); } catch (_) {}
    return true;
  }

  // ── Source 1: live meta (already correct) ────────────────────────
  function fromLiveMeta() {
    var s = clean(readMeta().subtitle || '');
    return isResolved(s) ? s : '';
  }

  // ── Identify the active application id from local caches ─────────
  // The app exposes the active app via a few possible shapes across
  // builds; try each defensively (read-only).
  function activeAppId() {
    try {
      if (typeof window.__antcvActiveAppId !== 'undefined' && window.__antcvActiveAppId != null) {
        return String(window.__antcvActiveAppId);
      }
    } catch (_) {}
    var keys = ['antcv:active-application', 'activeApplicationId', 'antcv:activeAppId', 'activeApp'];
    for (var i = 0; i < keys.length; i++) {
      try {
        var raw = localStorage.getItem(keys[i]);
        if (raw == null) continue;
        var t = raw.trim();
        if (t.charAt(0) === '"') { try { t = JSON.parse(t); } catch (_) {} }
        if (t && typeof t === 'object' && t.id != null) return String(t.id);
        if (t) return String(t);
      } catch (_) {}
    }
    return '';
  }

  // ── Source 2a: active application row from a local app-cache ─────
  function fromLocalAppCache() {
    var id = activeAppId();
    var listKeys = ['antcv:applications', 'applications', 'antcv:apps', 'apps'];
    for (var i = 0; i < listKeys.length; i++) {
      var list = null;
      try {
        var raw = localStorage.getItem(listKeys[i]);
        if (!raw) continue;
        list = JSON.parse(raw);
      } catch (_) { continue; }
      if (!Array.isArray(list)) {
        if (list && Array.isArray(list.items)) list = list.items;
        else continue;
      }
      for (var j = 0; j < list.length; j++) {
        var row = list[j];
        if (!row || typeof row !== 'object') continue;
        var match = id ? (String(row.id) === id) : false;
        // If we couldn't determine the active id, prefer the first row
        // that actually carries a resolved subtitle (better than nothing).
        if ((match || !id) && isResolved(row.subtitle)) return clean(row.subtitle);
      }
    }
    return '';
  }

  // ── relay helpers (read-only) ───────────────────────────────────
  function relayBase() {
    function rd(k) {
      try {
        var v = localStorage.getItem(k) || '';
        if (v && v.charAt(0) === '"') v = JSON.parse(v);
        return String(v || '').trim();
      } catch (_) { return ''; }
    }
    var v = rd('relayUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = window.ANTCV_RELAY_URL;
    if (!v) v = rd('proxyUrl'); // last resort
    return String(v || '').replace(/\/+$/, '');
  }
  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }
  function relayGet(path) {
    var base = relayBase(), tok = token();
    if (!base || !tok) return Promise.resolve(null);
    return window.fetch(base + path, {
      method: 'GET', credentials: 'include',
      headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + tok },
    }).then(function (r) {
      if (!r || !r.ok) return null;
      return r.json().catch(function () { return null; });
    }).catch(function () { return null; });
  }

  // ── Source 2b: active application row via relay GET (one-shot) ───
  function fromRelayApplications() {
    if (triedApplications) return Promise.resolve('');
    triedApplications = true;
    return relayGet('/api/applications').then(function (json) {
      if (!json) return '';
      var list = Array.isArray(json) ? json
               : (json.applications || json.items || json.rows || []);
      if (!Array.isArray(list)) return '';
      var id = activeAppId();
      var fallback = '';
      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        if (!row || typeof row !== 'object') continue;
        if (id && String(row.id) === id && isResolved(row.subtitle)) return clean(row.subtitle);
        if (!fallback && isResolved(row.subtitle)) fallback = clean(row.subtitle);
      }
      return id ? '' : fallback; // only use fallback when active id unknown
    });
  }

  // ── Source 3a: kernel-showcase meta from local cache ────────────
  function fromLocalKernel() {
    var keys = ['antcv:kernel-showcase', 'kernelShowcase', 'antcv:kernelShowcase'];
    for (var i = 0; i < keys.length; i++) {
      var obj = readJSON(keys[i]);
      if (!obj) continue;
      var meta = obj.meta || (obj.showcase && obj.showcase.meta) || obj;
      if (meta && isResolved(meta.subtitle)) return clean(meta.subtitle);
    }
    return '';
  }

  // ── Source 3b: kernel-showcase via relay GET (one-shot) ─────────
  function fromRelayKernel() {
    if (triedKernel) return Promise.resolve('');
    triedKernel = true;
    return relayGet('/api/kernel-showcase').then(function (json) {
      if (!json) return '';
      var meta = json.meta || (json.showcase && json.showcase.meta) || json;
      return (meta && isResolved(meta.subtitle)) ? clean(meta.subtitle) : '';
    });
  }

  // ── Resolve in priority order, committing the first hit ──────────
  function resolveAndCommit() {
    if (disabled()) return;

    // 1. Live meta already resolved → nothing to do (and stop fetching).
    if (fromLiveMeta()) return;

    // 2a / 3a — synchronous local sources first (no network, instant).
    var local = fromLocalAppCache() || fromLocalKernel();
    if (local && commitSubtitle(local)) return;

    // 2b — active application row via relay (the row that the late
    // `[Read from Cloud]` carries). One-shot.
    fromRelayApplications().then(function (sub) {
      if (sub && commitSubtitle(sub)) return null;
      // 3b — kernel showcase via relay, last resort. One-shot.
      return fromRelayKernel().then(function (k) {
        if (k) commitSubtitle(k);
      });
    }).catch(function () {});
  }

  // ── Detect the edit → preview transition and capture ────────────
  // The capture-on-transition makes the fix self-reinforcing: the
  // moment the user moves from the editor into the preview we resolve
  // + write meta.subtitle, so the very first preview paint reads a
  // populated local value instead of racing the cloud.
  function previewIsActive() {
    return !!document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function onPossiblePreviewEntry() {
    // Defer one frame so the preview DOM exists, then resolve+capture.
    requestAnimationFrame(function () {
      if (previewIsActive()) resolveAndCommit();
    });
  }

  // Clicks on the bottom-nav / tab Preview button, or any control that
  // surfaces the preview, are the edit→preview transition. We don't
  // depend on a specific selector — any click that ends with the
  // preview present triggers a resolve.
  document.addEventListener('click', function () {
    // microtask + frame: let the app switch views first.
    setTimeout(onPossiblePreviewEntry, 0);
  }, true);

  // The app announces app hydration via `antcv:sections-updated` and
  // (per the log) APPHISTORY-RELOAD/mount-hydrated paths; re-resolve on
  // those so a fresh hydrate that left subtitle empty gets sequenced.
  window.addEventListener('antcv:sections-updated', function (ev) {
    // Ignore our own write to avoid a loop.
    if (ev && ev.detail && ev.detail.source === 'subtitle-sequence-368') return;
    resolveAndCommit();
  });

  // ── Boot: resolve as early as possible, then a few backstops ─────
  function boot() {
    resolveAndCommit();
    var delays = [150, 500, 1200, 2500, 4000];
    for (var i = 0; i < delays.length; i++) setTimeout(resolveAndCommit, delays[i]);
    // Also resolve when the preview first appears.
    try {
      var mo = new MutationObserver(function () {
        if (previewIsActive()) { resolveAndCommit(); }
      });
      mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
      // Stop observing after 15s — by then the row has long resolved.
      setTimeout(function () { try { mo.disconnect(); } catch (_) {} }, 15000);
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Debug API
  window.AntcvSubtitleSequence368 = {
    version: VERSION,
    _resolve: resolveAndCommit,
    _fromLiveMeta: fromLiveMeta,
    _fromLocalAppCache: fromLocalAppCache,
    _fromLocalKernel: fromLocalKernel,
    _activeAppId: activeAppId,
    _isResolved: isResolved,
  };

  try { console.debug('[subtitle-sequence-368] installed v' + VERSION); } catch (_) {}
})();
