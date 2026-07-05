/* antcv-cluster-demand-live.js — CLUSTER-QUAL-001 stage 2b (owner 2026-07-05)
 * ===========================================================================
 * Section 3.4 "Generation visibility": inject the REAL D1-backed cluster
 * top-20 (application_qualification -> cluster_top_qualifications, stage 1/2a)
 * into the generation prompt, instead of only the static 3-cluster analyst
 * seed baked into antcv-cluster-demand.js (section 7.5).
 *
 * antcv-cluster-demand.js's classifyJD() can ONLY ever pick one of its own
 * 3 hardcoded clusters (its keyword INDEX is built exclusively from its own
 * SEED) — injecting live D1 rows into window.AntcvClusterDemand.clusters
 * would not help the other 9 categories, since classifyJD() would never
 * select them. So this sidecar is a SEPARATE, additive signal: it knows the
 * CURRENT application's real category (CLUSTER-QUAL-001-CATEGORY-001,
 * stored in localStorage 'rationale'.category, PR #324) and asks the
 * access-relay's real GET /api/cluster-top20 endpoint (stage 2b) for that
 * category's cluster + top-20 directly — no keyword classification needed,
 * the category IS the cluster key server-side (clusterForCategory()).
 *
 * __clusterRule in app.js/app.src.js is patched to prefer this live signal
 * (window.AntcvClusterDemandLive.get()) and fall back to the existing
 * classifyJD()+static-seed path unchanged when live data isn't available
 * yet (no sign-in, offline, brand-new category, cold cache).
 *
 * Never blocks generation: every read is synchronous-cache-only; the
 * network fetch always runs in the background and simply warms the cache
 * for the NEXT read. First generate after a fresh JD attach may still use
 * the static-seed fallback — that's fine, it's strictly additive.
 *
 * Kill switch: localStorage['antcv:disable-cluster-demand-live'] = '1'.
 */
(function () {
  'use strict';

  var VERSION = '1.51.167';
  if (window.__antcvClusterDemandLiveInstalled === VERSION) return;
  window.__antcvClusterDemandLiveInstalled = VERSION;

  var KILL_SWITCH = 'antcv:disable-cluster-demand-live';
  var TTL_MS = 10 * 60 * 1000; // re-fetch a category at most every 10 min
  var cache = {};    // category -> { at: epoch-ms, data: {clusterId, cluster}|null }
  var inflight = {}; // category -> Promise (de-dupe concurrent fetches)

  function killed() {
    try { return localStorage.getItem(KILL_SWITCH) === '1'; } catch (_) { return false; }
  }

  function currentCategory() {
    try {
      var raw = localStorage.getItem('rationale');
      if (!raw) return '';
      var r = JSON.parse(raw);
      return (r && typeof r.category === 'string') ? r.category.trim() : '';
    } catch (_) { return ''; }
  }

  function getRelayBase() {
    var v = '';
    try { v = String(localStorage.getItem('relayUrl') || ''); } catch (_) {}
    if (!v && typeof window !== 'undefined' && window.ANTCV_RELAY_URL) {
      v = String(window.ANTCV_RELAY_URL);
    }
    return v.replace(/\/+$/, '');
  }

  function getAuthToken() {
    try { return localStorage.getItem('antcv:auth:token') || ''; } catch (_) { return ''; }
  }

  // Resolves to {clusterId, cluster:{label, top20:[{q, shared}]}} or null.
  // Never throws; a failed/aborted fetch just leaves the cache unchanged.
  function fetchTop20(category) {
    if (inflight[category]) return inflight[category];
    var p = (async function () {
      try {
        var base = getRelayBase();
        var token = getAuthToken();
        if (!base || !token || !category) return null;
        var res = await window.fetch(
          base + '/api/cluster-top20?category=' + encodeURIComponent(category),
          { method: 'GET', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' } }
        );
        if (!res.ok) return null;
        var body;
        try { body = await res.json(); } catch (_) { return null; }
        if (!body || !body.ok || !body.cluster_id || !Array.isArray(body.top20) || !body.top20.length) {
          return null;
        }
        return {
          clusterId: body.cluster_id,
          cluster: {
            label: body.cluster_id,
            top20: body.top20
              .map(function (r) { return { q: String((r && r.qual) || ''), shared: (r && r.shared_clusters) || [] }; })
              .filter(function (r) { return r.q; }),
          },
        };
      } catch (_) { return null; }
    })();
    inflight[category] = p;
    p.then(function (data) {
      cache[category] = { at: +new Date(), data: data };
      delete inflight[category];
    }).catch(function () { delete inflight[category]; });
    return p;
  }

  // Synchronous, cache-only read for __clusterRule. Triggers a background
  // refresh when the cache is missing/stale for the current category, but
  // NEVER waits on it — returns whatever is already cached (or null).
  function get() {
    if (killed()) return null;
    var category = currentCategory();
    if (!category) return null;
    var entry = cache[category];
    if (!entry || (+new Date() - entry.at) > TTL_MS) {
      fetchTop20(category);
    }
    return (entry && entry.data) ? { clusterId: entry.data.clusterId, cluster: entry.data.cluster } : null;
  }

  // Explicit async refresh for callers that DO want to await fresh data
  // (e.g. a future fit panel). Bypasses the TTL.
  function refresh() {
    if (killed()) return Promise.resolve(null);
    var category = currentCategory();
    if (!category) return Promise.resolve(null);
    delete cache[category];
    return fetchTop20(category);
  }

  // ─── Warm-up triggers ──────────────────────────────────────────────
  // The category only becomes known once JD analysis completes and merges
  // into 'rationale' (antcv:rationale-merge, antcv-analysis-merge-344.js).
  // A JD attach (antcv:jd-changed, antcv-jd-watch.js) fires earlier, before
  // analysis resolves, so we poll briefly after it in case rationale-merge
  // is missed (e.g. no re-analysis needed, category already stored).
  function warm() {
    try { get(); } catch (_) {}
  }

  try { window.addEventListener('antcv:rationale-merge', warm); } catch (_) {}
  try {
    window.addEventListener('antcv:jd-changed', function () {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        warm();
        if (tries >= 10) clearInterval(iv); // ~20s of polling, then give up
      }, 2000);
    });
  } catch (_) {}
  setTimeout(warm, 1500); // cover the case where a category is already stored on boot

  window.AntcvClusterDemandLive = {
    version: VERSION,
    get: get,
    refresh: refresh,
    _fetchTop20: fetchTop20,
    _currentCategory: currentCategory,
  };
  try { console.debug('[cluster-demand-live] installed v' + VERSION); } catch (_) {}
})();
