/* antcv-babel-relang.js — BABEL-FISH-RELANG-001 + BABEL-FISH-CACHE-001 (owner 2026-07-11)
 * =====================================================================
 * Babel-fish principle: the canonical truth is language-neutral MEANING; the
 * ribbon language is how it is DISPLAYED. Every language (English included) is a
 * rendering of the same meaning; invariants (numbers, proper nouns, tool /
 * standard names, patent numbers) pass through every rendering unchanged.
 *
 * This sidecar keeps the displayed document in the ribbon language, using the
 * owner's mode split (antcv:genSpeed):
 *
 *   • LAZY + CACHED (fast / balanced): each time the content is confirmed to be
 *     in language L, snapshot it to antcv:langRender:<L>. When you switch to a
 *     language you have already rendered, restore that snapshot INSTANTLY
 *     (window.AntcvApplyStyleKernel) — no re-translation, no LLM call.
 *   • THOROUGH: skip the cache — a full native generation (the honest LANGUAGE:
 *     directive, BABEL-FISH-LANG-NAME-001) is the source of truth; only fall back
 *     to a cheap re-render for immediate correctness while the user regenerates.
 *
 * When no cached rendering exists and the content is in the WRONG script for a
 * non-Latin ribbon (zh/he/am/ar) — e.g. an English kernel served under a zh
 * ribbon — re-render it via the babel-fish translate pass
 * (window.__antcvRelang(L, true)). Non-destructive; invariants stay Latin.
 *
 * Detection runs on the DATA MODEL (localStorage 'sections'), NOT the DOM, so the
 * English app chrome never dilutes the signal. Kill:
 * localStorage['antcv:disable-babel-relang']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.324-babel-invariant';
  if (window.__antcvBabelRelang === VERSION) return;
  window.__antcvBabelRelang = VERSION;
  try { if (localStorage.getItem('antcv:disable-babel-relang') === '1') return; } catch (_) {}

  // Non-Latin target scripts we can reliably detect (Unicode ranges).
  var SCRIPTS = {
    zh: /[一-鿿㐀-䶿]/g, // CJK
    he: /[֐-׿]/g,             // Hebrew
    am: /[ሀ-፿]/g,             // Ethiopic
    ar: /[؀-ۿ]/g,             // Arabic
  };
  var THRESHOLD = 0.12;    // target-script letters / total letters below this = stale
  var MIN_LETTERS = 200;   // ignore the empty skeleton / mid-load
  var BACKOFF_MS = 20000;  // one relang attempt per language per 20s
  // BABEL-FISH-CLOUD-CACHE-001 (owner 2026-07-11): a SINGLE cloud-synced key holds
  // every language's rendering — { <lang>: { sections, meta, hash, at } } — so a
  // rendering produced on one device is available on another (relay allowlists
  // 'langRenders'; settings-sync-extra rides it up/down). Hard-capped so it can
  // never bloat the prefs blob: oldest-.at entries are dropped first.
  var BUNDLE_KEY = 'langRenders';
  var BUNDLE_CAP = 40000;  // max serialized bundle size (chars)

  function lang() {
    try {
      var v = localStorage.getItem('language') || '';
      if (v && v.charAt(0) === '"') v = JSON.parse(v);
      return String(v || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
    } catch (_) { return 'en'; }
  }

  function genSpeed() {
    try {
      var v = JSON.parse(localStorage.getItem('antcv:genSpeed') || '"balanced"');
      return v === 'fast' || v === 'thorough' ? v : 'balanced';
    } catch (_) { return 'balanced'; }
  }

  function collectStrings(node, out) {
    if (node == null) return;
    if (typeof node === 'string') { if (node.trim()) out.push(node); return; }
    if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) collectStrings(node[i], out); return; }
    if (typeof node === 'object') {
      for (var k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) collectStrings(node[k], out); }
    }
  }

  function parse(k) { try { var r = localStorage.getItem(k); return r == null ? null : JSON.parse(r); } catch (_) { return null; } }
  function sectionsRaw() { try { return localStorage.getItem('sections') || ''; } catch (_) { return ''; } }
  function textOf(sectionsObj) { var out = []; collectStrings(sectionsObj, out); return out.join(' '); }

  function letterCount(t) {
    try { return (t.match(/\p{L}/gu) || []).length; }
    catch (_) { return (t.match(/[A-Za-zÀ-ɏЀ-ӿ֐-׿؀-ۿሀ-፿㐀-鿿]/g) || []).length; }
  }

  // Is the given text a faithful rendering of language L? For a non-Latin target
  // the prose must be predominantly that script. For a Latin target we cannot
  // detect it, so we trust the app's own belief (return true) — Latin renderings
  // are produced natively at generation time (BABEL-FISH-LANG-NAME-001).
  function isInLanguage(txt, L) {
    var re = SCRIPTS[L];
    if (!re) return true;                       // Latin target -> trust
    var letters = letterCount(txt);
    if (letters < MIN_LETTERS) return null;     // too little to judge
    return (txt.match(re) || []).length / letters >= THRESHOLD;
  }

  function hashOf(s) { return s.length + ':' + s.slice(0, 24) + ':' + s.slice(-24); }

  function readBundle() { var b = parse(BUNDLE_KEY); return (b && typeof b === 'object' && !Array.isArray(b)) ? b : {}; }
  function writeBundle(b) {
    try {
      var s = JSON.stringify(b);
      // hard size cap: drop the oldest (.at) renderings until under BUNDLE_CAP
      var n = 0;
      while (s.length > BUNDLE_CAP && n++ < 20) {
        var oldest = null, oldestAt = Infinity;
        for (var k in b) { if (b[k] && b[k].at < oldestAt) { oldestAt = b[k].at; oldest = k; } }
        if (oldest == null) break;
        delete b[oldest];
        s = JSON.stringify(b);
      }
      if (s.length <= BUNDLE_CAP) localStorage.setItem(BUNDLE_KEY, s);
    } catch (_) {}
  }

  // Snapshot the current content under language L when it is confirmed to be in L.
  function snapshot(L, sectionsObj) {
    try {
      var raw = sectionsRaw(); if (!raw) return;
      var b = readBundle();
      var h = hashOf(raw);
      if (b[L] && b[L].hash === h) return;      // unchanged -> skip write
      b[L] = { sections: sectionsObj, meta: parse('meta') || {}, hash: h, at: Date.now() };
      writeBundle(b);
    } catch (_) {}
  }

  function restoreCache(L) {
    try {
      var c = readBundle()[L];
      if (!c || !c.sections) return false;
      // guard: the cached rendering must itself be in L (never restore a
      // mislabelled English snapshot under a zh key)
      if (isInLanguage(textOf(c.sections), L) === false) return false;
      if (typeof window.AntcvApplyStyleKernel !== 'function') return false;
      window.AntcvApplyStyleKernel({ sections: c.sections, meta: c.meta || {} });
      try { console.info('[babel-relang] restored cached', L, 'rendering (lazy+cached)'); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  // BABEL-FISH-INVARIANT-001 (Phase 2c): after a render, the INVARIANTS — every
  // number/metric and every ALL-CAPS acronym (tool / standard names: CCB, FMEA,
  // ISO, ASPICE, SQL, EMC) — MUST survive unchanged (the babel fish carries meaning,
  // it never alters facts). Capture the source set just before the translate; verify
  // it against the rendering after. Drift -> warn; severe drift -> do NOT cache the
  // lossy rendering (so a translation that dropped a number never gets persisted).
  function invariantSet(txt) {
    var m = {};
    (txt.match(/\d[\d.,]*\d|\d/g) || []).forEach(function (n) { n = n.replace(/[.,]+$/, ''); if (n) m['#' + n] = 1; });
    (txt.match(/\b[A-Z]{2,}\b/g) || []).forEach(function (a) { m['^' + a] = 1; });
    return m;
  }
  function missingInvariants(srcSet, txt) {
    var have = invariantSet(txt), miss = [];
    for (var k in srcSet) { if (!have[k]) miss.push(k.slice(1)); }
    return miss;
  }
  var DRIFT_SEVERE = 2;
  var verify = { lang: null, src: null };

  var last = { lang: null, at: 0 };
  function check() {
    var L = lang();
    if (typeof window.__antcvRelang !== 'function') return;   // app not ready yet
    var sObj = parse('sections'); if (!sObj) return;
    var txt = textOf(sObj);
    var inL = isInLanguage(txt, L);

    if (inL === true) {                                       // already in the target language
      // fact-preservation verify if we just finished a relang into L
      if (verify.lang === L && verify.src) {
        var miss = missingInvariants(verify.src, txt);
        verify = { lang: null, src: null };
        if (miss.length) {
          try { window.AntcvBabelRelang.lastDrift = { lang: L, missing: miss, at: Date.now() }; } catch (_) {}
          try { console.warn('[babel-relang] invariant drift after ' + L + ' render — missing:', miss.slice(0, 8)); } catch (_) {}
          if (miss.length >= DRIFT_SEVERE) return;            // do NOT cache a lossy rendering
        }
      }
      snapshot(L, sObj);                                       // keep the cache fresh
      return;
    }
    if (inL === null) return;                                 // not enough content to judge

    // Content is NOT in the (non-Latin) ribbon language L.
    var speed = genSpeed();

    // LAZY + CACHED (fast / balanced): instant restore of a previously-rendered L.
    if (speed !== 'thorough' && restoreCache(L)) return;

    // No usable cache (or thorough): re-render into L via the translate pass.
    // (A full native regeneration is the user's explicit Generate action, which
    // is native in thorough mode via BABEL-FISH-LANG-NAME-001; we never auto-fire
    // a multi-minute generation from a passive switch.)
    var now = Date.now();
    if (last.lang === L && (now - last.at) < BACKOFF_MS) return;
    last = { lang: L, at: now };
    verify = { lang: L, src: invariantSet(txt) };             // capture source facts for the post-render check
    try { console.info('[babel-relang] content not in', L, '— re-rendering into ribbon language (' + speed + ')'); } catch (_) {}
    try { window.__antcvRelang(L, true); }
    catch (e) { try { console.warn('[babel-relang] relang failed', e); } catch (_) {} }
  }

  var pending = false;
  function schedule() {
    if (pending) return; pending = true;
    setTimeout(function () { pending = false; try { check(); } catch (_) {} }, 700);
  }
  window.addEventListener('antcv:language-changed', schedule);
  window.addEventListener('antcv:sections-updated', schedule);
  [1800, 4500, 9000].forEach(function (d) { setTimeout(schedule, d); });
  window.AntcvBabelRelang = { version: VERSION, _check: check, _snapshot: snapshot, _restore: restoreCache, _invariants: invariantSet, _missing: missingInvariants, lastDrift: null };
})();
