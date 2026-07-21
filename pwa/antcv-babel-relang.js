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
  var VERSION = '1.51.1818-en-asymmetry';
  if (window.__antcvBabelRelang === VERSION) return;
  window.__antcvBabelRelang = VERSION;
  try { if (localStorage.getItem('antcv:disable-babel-relang') === '1') return; } catch (_) {}
  // BABEL-FISH-HEADLESS-001 (owner 2026-07-11): one-time purge of the pre-headless
  // langRenders cache. Older builds cached whatever was current under a language key
  // — including MIXED / partially-translated content (English roles interleaved with
  // target-language ones), which then propagated on restore. Drop it once per version
  // so no stale mixed rendering survives the upgrade; clean renderings re-cache lazily.
  try {
    var __seenV = localStorage.getItem('antcv:babel-cache-ver');
    if (__seenV !== VERSION) {
      try { localStorage.removeItem('langRenders'); } catch (_) {}
      try { if (window._antcvCloudWrite) window._antcvCloudWrite({ langRenders: {} }); } catch (_) {}
      localStorage.setItem('antcv:babel-cache-ver', VERSION);
    }
  } catch (_) {}

  // Non-Latin target scripts we can reliably detect (Unicode ranges).
  var SCRIPTS = {
    zh: /[一-鿿㐀-䶿]/g, // CJK
    he: /[֐-׿]/g,             // Hebrew
    am: /[ሀ-፿]/g,             // Ethiopic
    ar: /[؀-ۿ]/g,             // Arabic
  };
  // target-script letters / total letters below this = stale (re-render needed).
  // BABEL-FISH-HEADLESS-001: raised 0.12 -> 0.30. A GOOD non-Latin render still sits
  // well above this (a faithful zh CV runs ~0.40 CJK once the Latin invariants — names,
  // tool/standard codes — are counted), but a MIXED render (half the roles still in
  // English) lands ~0.15-0.25 and used to pass as "fine", so it never got re-rendered
  // and stayed mixed. 0.30 catches the mixed case and triggers a full headless re-render;
  // re-rendering an already-good render is idempotent, so a rare false trigger is safe.
  var THRESHOLD = 0.30;
  // BABEL-RATIO-INVARIANT-001: threshold for the PROSE-only measure (see
  // isInLanguage). Faithful compact zh with stored Latin enums sits ~0.28+;
  // a genuinely mixed render (untranslated roles) sits ~0.18-0.22.
  var THRESHOLD_PROSE = 0.25;
  var MIN_LETTERS = 200;   // ignore the empty skeleton / mid-load
  var BACKOFF_MS = 20000;  // one relang attempt per language per 20s
  // BABEL-FISH-CLOUD-CACHE-001 (owner 2026-07-11): a SINGLE cloud-synced key holds
  // every language's rendering — { <lang>: { sections, meta, hash, at } } — so a
  // rendering produced on one device is available on another (relay allowlists
  // 'langRenders'; settings-sync-extra rides it up/down). Hard-capped so it can
  // never bloat the prefs blob: oldest-.at entries are dropped first.
  var BUNDLE_KEY = 'langRenders';
  var BUNDLE_CAP = 40000;  // max serialized bundle size (chars)
  // RELANG-SINGLE-FLIGHT-001 (owner 2026-07-12 "why is translation working on
  // all tabs in chrome and the claude browser in parallel?"): every throttle in
  // this sidecar (backoff, attempt cap, debounce) was a per-tab in-memory
  // variable, so EVERY open tab over the same localStorage independently fired
  // the SAME heal — and other signed-in browsers joined via the cloud echo.
  // Parallel chunked translates then write-war over sections (jumpy preview,
  // clobbered CL). Two gates: (1) only the VISIBLE tab heals; (2) a cross-tab
  // lease in localStorage makes it ONE healing tab per browser profile at a
  // time. Cross-DEVICE parallelism (two browsers both visible + signed in) is
  // reduced but not eliminated — that needs a cloud-side lease.
  var LEASE_KEY = 'antcv:relang-lease';
  var LEASE_MS = 180000;   // covers a full chunked translate run
  var TAB_ID = 't' + Math.random().toString(36).slice(2, 10);
  function leaseHeld() {
    try {
      var l = JSON.parse(localStorage.getItem(LEASE_KEY) || 'null');
      return !!(l && l.id !== TAB_ID && (Date.now() - (l.at || 0)) < LEASE_MS);
    } catch (_) { return false; }
  }
  function takeLease(L) {
    try { localStorage.setItem(LEASE_KEY, JSON.stringify({ id: TAB_ID, lang: L, at: Date.now() })); } catch (_) {}
  }

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

  // Strong English grammar / connective words that are essentially ABSENT from clean
  // Danish or Spanish prose (which use og/med/til/gennem, y/con/de/a través). A clean
  // da/es rendering scores ~0-3 of these (only inside the odd invariant phrase); a
  // MIXED rendering (half the roles still in English) scores 15+. Grammar words only —
  // no domain nouns like "management" that can sit inside an invariant standard name.
  var EN_MARKER_RE = /\b(the|and|with|through|across|between|which|would|their|there|these|those|were|been|about|while|during|into|over|under|that|this|from|when|where|whose|within|towards|alongside)\b/gi;
  // A clean da/es CV can still carry a few of these inside INVARIANTS that translation
  // keeps verbatim — English quoted publication titles, an English company name ("… of
  // Denmark"). Those top out around 6-10; a genuinely MIXED render (half the roles still
  // English) scores 25+. 12 sits safely between, so invariant residue never trips it.
  var EN_RESIDUE_MAX = 12;

  // BABEL-RATIO-INVARIANT-001: length of the TRANSLATABLE Latin prose only —
  // lowercase-initial Latin tokens (grammar/prose words). Acronyms, capitalised
  // proper nouns and product names are invariants and must not count as "prose".
  function proseLatinLen(txt) {
    var n = 0;
    (txt.match(/[A-Za-z][A-Za-z0-9&\/\.\-]*/g) || []).forEach(function (t) {
      if (/^[a-z]/.test(t) && t.length > 2) n += t.length;
    });
    return n;
  }

  // Is the given text a faithful rendering of language L?
  //  • English target -> BABEL-EN-ASYMMETRY-001: must not be dominated by a non-Latin script.
  //  • Non-Latin target (zh/he/am/ar) -> the prose must be predominantly that script.
  //  • Latin non-English target (da/es/...) -> BABEL-FISH-HEADLESS-001: we cannot
  //    script-detect it, but residual ENGLISH grammar words betray a mixed / partly
  //    untranslated render, so we heal it the same way (return false -> re-render).
  function isInLanguage(txt, L) {
    // BABEL-EN-ASYMMETRY-001 (owner 2026-07-21: "a chinese job was loaded but the
    // language selector stayed english — resulting with chinese all the time").
    // This returned TRUE for 'en' UNCONDITIONALLY on the premise that English is the
    // canonical/native rendering. That made the ONE sidecar that heals a wrong-language
    // document blind in the en direction: a zh rendering sitting under an 'en' ribbon
    // passed as "already correct" and was NEVER re-rendered, so the document stayed
    // Chinese forever (the reverse — English under a zh ribbon — was always caught).
    // It also feeds the 415 role storm: repairExperienceCompleteness compares the
    // ENGLISH personalInfo roles against zh section roles, _samePosition misses
    // cross-script, so it re-adds the same "missing" roles every pass endlessly.
    // Fix: make the en test SYMMETRIC — English content must not be dominated by a
    // non-Latin script. Measured on translatable PROSE (same basis as the non-Latin
    // branch below), so Latin invariants and the odd CJK proper noun inside a
    // genuinely English CV can never trip it.
    if (L === 'en') {
      if (letterCount(txt) < MIN_LETTERS) return null;   // too little to judge
      var enProse = proseLatinLen(txt);
      for (var sk in SCRIPTS) {
        if (!Object.prototype.hasOwnProperty.call(SCRIPTS, sk)) continue;
        var sn = (txt.match(SCRIPTS[sk]) || []).length;
        if (sn && sn / ((sn + enProse) || 1) >= THRESHOLD_PROSE) return false;
      }
      return true;
    }
    var re = SCRIPTS[L];
    if (re) {
      var letters = letterCount(txt);
      if (letters < MIN_LETTERS) return null;   // too little to judge
      // BABEL-RATIO-INVARIANT-001 (owner 2026-07-11 "why does every refresh
      // attempt a translation?"): a COMPACT zh document is INVARIANT-heavy —
      // tool/product names (Jira, Codebeamer, Power BI, MATLAB), standards
      // (ASPICE, ISO 26262, CISPR), company names, and stored data enums
      // ("native / fluent") are Latin by design. The naive script/letters ratio
      // fell under THRESHOLD on a perfectly faithful rendering, so every page
      // load fired a heal. Measure only TRANSLATABLE PROSE: Latin tokens that
      // start lowercase (grammar/prose words). Acronyms, capitalised proper
      // nouns and product names do not count against the rendering. The
      // matched threshold is lower because legit stored enums keep a floor of
      // lowercase Latin even in a faithful render.
      var script = (txt.match(re) || []).length;
      var proseLatin = proseLatinLen(txt);
      return script / ((script + proseLatin) || 1) >= THRESHOLD_PROSE;
    }
    // Latin non-English: measure English residue.
    if (letterCount(txt) < MIN_LETTERS) return null;
    return (txt.match(EN_MARKER_RE) || []).length <= EN_RESIDUE_MAX;
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
  // BABEL-FISH-HEADLESS-001: only cache NON-LATIN targets (SCRIPTS[L] exists), whose
  // faithfulness we can actually verify by script ratio. Latin targets (da/es) can't
  // be verified — a mixed English/Danish render looks "fine" — and the sidecar never
  // restores a Latin cache anyway (isInLanguage returns true for Latin, so the restore
  // branch never runs). Caching them only risks persisting mixed content, so skip it.
  function snapshot(L, sectionsObj) {
    try {
      if (!SCRIPTS[L]) return;
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
  // BABEL-FISH-HEADLESS-001: hard cap on consecutive re-render attempts per language.
  // A successful render (content verified in L) resets it. If a render never satisfies
  // isInLanguage — e.g. a Latin CV whose English residue is all in un-translatable
  // INVARIANTS (quoted English titles) — we stop after MAX_ATTEMPTS instead of looping
  // a translate every BACKOFF_MS forever.
  var attempts = {};
  var MAX_ATTEMPTS = 2;
  // BABEL-FISH-HEADLESS-001: never fire a re-render while a generation is running —
  // sections churn mid-gen and a concurrent translate would race the generator. The
  // post-gen 'antcv:sections-updated' + the timers re-run check() once it settles.
  function genInProgress() {
    try { if (window.__antcvGenRunning) return true; } catch (_) {}
    try { if (localStorage.getItem('kernelShowcaseInProgress') === 'true') return true; } catch (_) {}
    return false;
  }
  // BABEL-FISH-VIEW-GATE-001 (owner 2026-07-11): only auto-translate in the EDITOR.
  // Switching language / writing style while still in the upload / input menu must NOT
  // kick off a translate+adapt cycle — that produced a translate popup every few seconds
  // and partial gen/translation mixes. The app exposes window.__antcvView; we run only
  // when it is 'editor' (post-generate the app switches to 'editor', so a fresh
  // generation still gets healed into its target language). Unknown view (old bundle) ->
  // fall through, so behaviour degrades safely rather than freezing.
  function inEditor() {
    try {
      var v = window.__antcvView;
      if (v === 'upload' || v === 'input' || v === 'generating') return false;
    } catch (_) {}
    return true;
  }
  // UPLOAD-LANG-DEFER-001 (owner 2026-07-11): when the user changed language in the upload
  // menu, the app shows an explicit translate MODAL on editor entry and stamps a guard.
  // Stand down while that guard is fresh so we don't ALSO auto-translate and race the modal
  // (or translate content the user is about to decline). ~3 min window, then normal healing.
  function manualXlateFresh() {
    try {
      var g = parseInt(localStorage.getItem('antcv:manual-xlate-guard') || sessionStorage.getItem('antcv:manual-xlate-guard') || '0', 10);
      return g > 0 && (Date.now() - g) < 180000;
    } catch (_) { return false; }
  }
  function check() {
    var L = lang();
    if (typeof window.__antcvRelang !== 'function') return;   // app not ready yet
    if (genInProgress()) return;                              // wait until generation settles
    if (!inEditor()) return;                                  // never translate in the upload/input menu
    if (manualXlateFresh()) return;                           // an explicit translate modal owns it
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
      attempts[L] = 0;                                          // verified in L -> reset the cap
      snapshot(L, sObj);                                       // keep the cache fresh
      return;
    }
    if (inL === null) return;                                 // not enough content to judge
    if ((attempts[L] || 0) >= MAX_ATTEMPTS) return;           // give up (likely invariant residue, not real mixing)

    // RELANG-SINGLE-FLIGHT-001: background tabs never heal (both the cache
    // restore and the translate MUTATE sections — a hidden tab healing behind
    // the visible one is exactly the write-war), and only one tab per profile
    // heals within the lease window.
    try { if (document.hidden) return; } catch (_) {}
    if (leaseHeld()) return;

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
    takeLease(L);                                             // RELANG-SINGLE-FLIGHT-001
    attempts[L] = (attempts[L] || 0) + 1;                     // count this attempt toward the cap
    verify = { lang: L, src: invariantSet(txt) };             // capture source facts for the post-render check
    try { console.info('[babel-relang] content not in', L, '— re-rendering into ribbon language (' + speed + ')'); } catch (_) {}
    // BABEL-FISH-HEADLESS-001: use the modal-free translate. The old __antcvRelang(L,true)
    // opened a confirmation modal the sidecar could never click, so a zh ribbon over
    // English content stayed mixed/stuck forever. __antcvRelangHeadless runs the same
    // translate pass directly. Fall back to the old call only if the headless export is
    // missing (bundle mismatch) so we never hard-fail.
    try {
      if (typeof window.__antcvRelangHeadless === 'function') window.__antcvRelangHeadless(L);
      else window.__antcvRelang(L, true);
    }
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
  // BABEL-FISH-HEADLESS-001: gen-completion watcher. A generation does not always
  // dispatch 'antcv:sections-updated', so after a native generation finishes (in any
  // language) the sidecar might never re-check and a partly-English render would sit
  // mixed. Poll the gen flag cheaply; on the true->false edge, schedule a check so the
  // post-gen content is healed into the ribbon language. (check() itself no-ops when the
  // content is already clean, so this is safe and self-limiting.)
  var __wasGen = false;
  setInterval(function () {
    var g = genInProgress();
    if (__wasGen && !g) schedule();   // generation just finished -> verify language
    __wasGen = g;
  }, 3000);
  window.AntcvBabelRelang = { version: VERSION, _check: check, _snapshot: snapshot, _restore: restoreCache, _invariants: invariantSet, _missing: missingInvariants, _isInLanguage: isInLanguage, lastDrift: null };
})();
