/* antcv-cl-prose-loss-guard-985.js — CL-PROSE-LOSS-GUARD-001 (owner 2026-06-30)
 * ============================================================================
 * LOAD-GRACE GUARD for the cover-letter prose sections.
 *
 * THE BUG (owner): after a fresh CL generation the live preview shows the real
 * who / why / opening / contribute / foundation-lead prose, but exporting AFTER a
 * page refresh (needed to switch to CloudConvert) shows the raw me() TEMPLATE
 * PLACEHOLDERS again ("[Role title]", "[Use Company Info…]", "[Professional
 * identity…]") and drops HOW I WOULD CONTRIBUTE. The refresh triggers a cloud /
 * me()-enforce restore that overwrites the freshly-generated prose with a STALE /
 * template copy. bring / foundation-rows / closure survive because their own
 * sidecars re-apply them; the render-hydrated prose sections have no such guard.
 *
 * THIS GUARD: snapshot each CL prose section's content to a LOCAL-ONLY key
 * (`antcv:clProseGuard`, NOT cloud-synced, so it survives the cloud-restore),
 * keyed by application (meta.company|role). When a later load / restore reverts a
 * snapshotted section to a placeholder, RE-APPLY the snapshot. It only ever
 * replaces a PLACEHOLDER with previously-seen REAL content — it never deletes,
 * empties, or overwrites real content, and never crosses applications. Self-
 * disabling on any error. Disable: localStorage['antcv:disable-cl-prose-guard']='1'.
 *
 * It does NOT touch the CV, the bring rows, or any non-prose section.
 */
(function () {
  'use strict';
  var VERSION = '1.51.120-bucket-ts';
  if (window.__antcvClProseGuard985 === VERSION) return;
  window.__antcvClProseGuard985 = VERSION;

  var STORE = 'antcv:clProseGuard';
  // The CL prose sections that are render-hydrated and lost on a stale restore.
  // (bring is persisted by antcv-nordic-cl-order-971; closure by the editor; both
  //  are included as belt-and-suspenders — re-applying a real value is harmless.)
  var GUARDED = ['opening', 'why', 'who', 'foundation', 'contribute', 'closure', 'bring'];
  // Canonical CL section order — used to re-insert a guarded section that a stale restore
  // DELETED outright at its correct position. See CL-PROSE-LOSS-GUARD-002.
  // CL-V5-STRUCT-001 (2026-07-21): kept in step with antcv-nordic-cl-order-971's ORDER. A
  // stale copy here would re-insert `who` in its OLD mid-letter slot and fight 971's v5
  // order on every restore.
  var ORDER = ['greeting', 'opening', 'why', 'role_view', 'bring', 'contribute', 'who', 'foundation', 'closure'];
  var lastApplyAt = 0;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-cl-prose-guard'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function erasing() { try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); } catch (_) { return false; } }

  // LANG-GUARD-KEY-001 (owner 2026-07-22 "every generation starts in Chinese"): the
  // loss-guard cache is keyed by application (company|role) but was LANGUAGE-BLIND, so a
  // Chinese generation's cached prose was re-injected into a later ENGLISH generation
  // during the skeleton window (empty section -> reapply) — the doc "started in Chinese,
  // then switched to English". Include the current output language in the key so a
  // generation only ever restores from a SAME-LANGUAGE snapshot; a stale zh cache (keyed
  // without a lang suffix) can never poison an en gen — it simply no longer matches.
  function curLang() {
    try { return String(localStorage.getItem('language') || 'en').replace(/["']/g, '').toLowerCase().slice(0, 2) || 'en'; }
    catch (_) { return 'en'; }
  }
  function appKey() {
    var lang = curLang();
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      return String((m.company || '') + '|' + (m.role || '') + '|' + lang).slice(0, 200);
    } catch (_) { return '||' + lang; }
  }
  // CL-PROSE-UNSOL-POISON-001 (owner 2026-07-03): an UNSOLICITED application's CL prose
  // must never be snapshotted or re-applied by this guard. Root cause of "an unsolicited
  // application went all Terma": meta.company was flipped to "Unsolicited" while a prior
  // TARGETED company's CL body was still live in sections, so snapshot() captured that
  // company's prose under the "Unsolicited|<role>" bucket and reapply() re-injected it
  // forever. Unsolicited prose is company-neutral and regenerable — it does not need
  // loss-protection, and skipping the guard here makes cross-company poisoning impossible.
  // (guardKeys() for signature/slogan is NOT gated — those are not company-specific.)
  function isUnsolicited() {
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var c = String(m.company || '').trim().toLowerCase();
      // EXPLICIT "unsolicited" only — an EMPTY company is the transient fresh-generation
      // window (before meta is stamped) that CL-BLANK-CAPTURE-001 relies on to snapshot
      // prose early; gating it would drop real prose. The poison was the explicit
      // "Unsolicited|<role>" bucket, which this catches.
      return c === 'unsolicited' || !!(window.__antcvUnsol && window.__antcvUnsol(c)); // UNSOL-PILLAR-LANG-001: any language variant
    } catch (_) { return false; }
  }
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : null; } catch (_) { return null; }
  }
  function readStore() {
    try { var v = JSON.parse(localStorage.getItem(STORE) || '{}'); return (v && typeof v === 'object') ? v : {}; } catch (_) { return {}; }
  }

  // CL-GUARD-SKELETON-CAPTURE-001 (owner 2026-07-03, the NIL round): the me()
  // skeleton's opening BODY starts with plain words — "I am applying for
  // [Role title] at [Company], where I can contribute to [main JD need 1…]" —
  // so the old first-char-'[' check classified it as REAL and snapshot()
  // captured the SKELETON under the targeted bucket ("NIL Technology|…" held
  // 2164 bytes of template). Template text is bracket-DOMINATED, not
  // bracket-LED: treat >=2 bracketed segments as placeholder too. One
  // bracketed token (e.g. a "[verify]" flag) still counts as real prose.
  function isPlaceholder(t) {
    var s = String(t == null ? '' : t).trim();
    if (!s || s.charAt(0) === '[') return true;
    // CL-GUARD-SKELETON-CAPTURE-002 (owner 2026-07-04, priority 5 "fix"): the
    // >=2 rule missed single-bracket template lines ("I would start by
    // learning where [Company/team] loses time…") — captured as real, never
    // healed, so every stale row-restore of the placeholder contribute stuck.
    // The GUARDED CL prose ids never carry legitimate brackets (the "[verify]"
    // flag lives in application_qa, which is NOT guarded) — so ANY bracketed
    // template segment marks the body as placeholder.
    return (s.match(/\[[^\]]{2,80}\]/g) || []).length >= 1;
  }

  // The primary prose text of a section (decides real vs placeholder).
  function proseOf(sec) {
    if (!sec || typeof sec !== 'object') return '';
    if (sec.type === 'rich_block' && Array.isArray(sec.items)) {
      // CL-BLANK-001: a section is REAL only if a BODY (it.t) is real. The lead LABEL
      // (it.b, e.g. "Who I am") survives an empty generation, so counting it as prose
      // makes an empty-body-but-labelled section masquerade as real and defeats restore.
      for (var i = 0; i < sec.items.length; i++) {
        var it = sec.items[i];
        var t = it && typeof it === 'object' ? it.t : it; // body only — ignore the it.b label
        if (!isPlaceholder(t)) return String(t);
      }
      return '';
    }
    if (typeof sec.content === 'string') return sec.content;
    if (Array.isArray(sec.rows) && sec.rows.length) {
      // bring (table): a real row has a non-placeholder cell
      for (var r = 0; r < sec.rows.length; r++) {
        var row = sec.rows[r];
        if (Array.isArray(row)) for (var c = 0; c < row.length; c++) if (!isPlaceholder(row[c])) return String(row[c]);
      }
      return '';
    }
    return '';
  }
  function isReal(sec) { return !isPlaceholder(proseOf(sec)); }

  // Snapshot real CL prose sections for the current application.
  function snapshot() {
    if (isUnsolicited()) return;   // never capture prose under an unsolicited key
    var secs = readSections(); if (!secs || !Array.isArray(secs.cl)) return;
    // CL-OPENING-EMPTY-GEN-001 (owner 2026-07-29): the OPENING can be persisted EMPTY at
    // GENERATION (LLM omits/rejects the slot) with no snapshot to restore. When the CL is
    // otherwise generated (why is real) but the opening is empty/placeholder and not
    // unsolicited, fill it with a real JD-derived fallback so an empty opening never persists.
    try {
      var __opIdx = -1, __why = null;
      for (var __i = 0; __i < secs.cl.length; __i++) {
        var __c = secs.cl[__i];
        if (__c && __c.id === 'opening') __opIdx = __i;
        if (__c && __c.id === 'why') __why = __c;
      }
      if (__opIdx >= 0 && __why && isReal(__why) && !isReal(secs.cl[__opIdx]) && !isUnsolicited()) {
        var __m = {}; try { __m = JSON.parse(localStorage.getItem('meta') || '{}') || {}; } catch (_) {}
        var __role = String(__m.role || '').trim(), __co = String(__m.company || '').trim();
        if (__role || __co) {
          var __t = 'Following my interest in the ' + (__role || 'role') + (__co ? (' position at ' + __co) : '') +
            ', I am writing to introduce how my background in systems architecture, requirements and cross-domain integration maps to what the role needs.';
          secs.cl[__opIdx] = Object.assign({}, secs.cl[__opIdx], { type: 'rich_block', headlineOff: true, content: '', items: [{ b: '', t: __t, bullets: [] }] });
          try { localStorage.setItem('sections', JSON.stringify(secs)); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-opening-empty-gen-fill' } })); } catch (_) {}
          try { console.log('[CL-PROSE-LOSS-GUARD] CL-OPENING-EMPTY-GEN-001: filled empty opening with JD-derived fallback'); } catch (_) {}
        }
      }
    } catch (_) {}
    var key = appKey();
    var store = readStore();
    var bucket = (store[key] && typeof store[key] === 'object') ? store[key] : {};
    var changed = false;
    secs.cl.forEach(function (sec) {
      if (!sec || GUARDED.indexOf(sec.id) < 0) return;
      if (isReal(sec)) {
        // store a deep copy of the real section
        try { bucket[sec.id] = JSON.parse(JSON.stringify(sec)); changed = true; } catch (_) {}
      }
    });
    if (!changed) return;
    // SCRUB-RECENT-TARGET-GUARD-001 (owner Trackman review 2026-07-03): stamp the
    // capture time. The unsol-company-scrub harvests bucket KEYS as prior-company
    // scrub candidates; a bucket captured MINUTES ago is the CURRENT target mid
    // meta-flip (row 29 family), not a stale carryover — the recency stamp lets
    // the scrub skip it (the Trackman CL lost "Trackman" -> "your organisation"
    // through exactly this window). Underscore-keys are metadata, never sections.
    bucket._ts = Date.now();
    store[key] = bucket;
    // keep the store small: cap at the 6 most-recent application buckets
    try {
      var keys = Object.keys(store);
      if (keys.length > 6) { for (var i = 0; i < keys.length - 6; i++) { if (keys[i] !== key) delete store[keys[i]]; } }
    } catch (_) {}
    try { localStorage.setItem(STORE, JSON.stringify(store)); } catch (_) {}
  }

  // Re-apply a snapshotted real section ONLY where the live one is now a placeholder.
  function reapply() {
    if (isUnsolicited()) return;   // never re-inject a company's prose into an unsolicited app
    var now = (window.performance && performance.now) ? performance.now() : 0;
    if (now && lastApplyAt && (now - lastApplyAt) < 1200) return; // anti-loop
    var secs = readSections(); if (!secs || !Array.isArray(secs.cl)) return;
    var store = readStore();
    var bucket = store[appKey()];
    if (!bucket || typeof bucket !== 'object') return;
    var changed = false;
    var cl = secs.cl.map(function (sec) {
      if (!sec || GUARDED.indexOf(sec.id) < 0) return sec;
      var snap = bucket[sec.id];
      if (!snap || isReal(sec) || !isReal(snap)) return sec; // only placeholder<-real
      changed = true;
      return JSON.parse(JSON.stringify(snap));
    });
    // CL-PROSE-LOSS-GUARD-002 (owner 2026-07: "the whole HOW I WOULD CONTRIBUTE section
    // is gone after an edit"). The placeholder<-snapshot map above can only heal a section
    // that is still PRESENT (as a placeholder). A stale cloud / me()-enforce restore can
    // DELETE a guarded prose section outright — the map never sees it, so HWIC silently
    // vanishes from the export. Re-INSERT any guarded section that has a REAL snapshot but
    // is now ABSENT from cl, at its canonical CL position. Only ever ADDS back previously
    // seen real content; the disable switch + per-application keying still apply. (A
    // deliberate delete of a core CL section is rare and re-hideable; losing HWIC on export
    // is the worse failure — the owner's #1 bug.)
    var liveIds = {};
    cl.forEach(function (s) { if (s && s.id) liveIds[s.id] = true; });
    GUARDED.forEach(function (id) {
      if (liveIds[id]) return;
      var snap = bucket[id];
      if (!snap || !isReal(snap)) return;
      var oi = ORDER.indexOf(id);
      var at = cl.length;
      for (var j = 0; j < cl.length; j++) {
        var jOi = ORDER.indexOf(cl[j] && cl[j].id);
        if (jOi >= 0 && jOi > oi) { at = j; break; }
      }
      cl.splice(at, 0, JSON.parse(JSON.stringify(snap)));
      liveIds[id] = true;
      changed = true;
      try { console.log('[CL-PROSE-LOSS-GUARD] re-inserted missing CL section: ' + id); } catch (_) {}
    });
    if (!changed) return;
    lastApplyAt = now || 1;
    secs.cl = cl;
    try { localStorage.setItem('sections', JSON.stringify(secs)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-prose-loss-guard' } })); } catch (_) {}
    try { console.log('[CL-PROSE-LOSS-GUARD] re-applied real prose over restored placeholders'); } catch (_) {}
  }

  // STANDALONE CL KEYS (signature + editable slogan/closing/name) are ALSO wiped by the
  // refresh-triggered restore (owner: "export PDF has no signature"). Snapshot them to a
  // LOCAL-ONLY stash when non-empty; re-apply when a restore empties them. The signature is
  // skipped if the user explicitly HID it (antcv:signatureHidden='1').
  var SK = ['antcv:signatureB64', 'antcv:signatureAlign', 'antcv:signatureSize', 'antcv:signatureAspect',
    'antcv:clSlogan', 'antcv:clClosing', 'antcv:clSignName', 'antcv:clSloganAlign', 'antcv:clClosingAlign', 'antcv:clSignNameAlign'];
  var SK_STORE = 'antcv:clKeysGuard';
  function guardKeys() {
    var stash = {}; try { stash = JSON.parse(localStorage.getItem(SK_STORE) || '{}') || {}; } catch (_) {}
    var hidden = false; try { hidden = localStorage.getItem('antcv:signatureHidden') === '1'; } catch (_) {}
    var dirty = false, restored = false;
    SK.forEach(function (k) {
      var v = null; try { v = localStorage.getItem(k); } catch (_) {}
      var has = v != null && String(v).trim() !== '';
      if (has) { if (stash[k] !== v) { stash[k] = v; dirty = true; } }
      else if (stash[k] != null && String(stash[k]).trim() !== '') {
        if (k === 'antcv:signatureB64' && hidden) return; // honour an explicit hide
        try { localStorage.setItem(k, stash[k]); restored = true; } catch (_) {}
      }
    });
    if (dirty) { try { localStorage.setItem(SK_STORE, JSON.stringify(stash)); } catch (_) {} }
    if (restored) { try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-keys-guard' } })); } catch (_) {} try { console.log('[CL-PROSE-LOSS-GUARD] re-applied signature / editable CL keys'); } catch (_) {} }
  }

  // CL-GUARD-SKELETON-CAPTURE-001 boot purge: drop bucket sections captured
  // under the OLD isPlaceholder (skeleton/template snapshots — e.g. the owner's
  // "NIL Technology|…" bucket held the me() skeleton). A non-real snapshot can
  // never be re-applied, but purging keeps the store honest and lets a future
  // REAL capture start clean. Runs once per load; drops emptied buckets.
  function purgeSkeletonSnapshots() {
    try {
      var store = readStore();
      var changed = false;
      Object.keys(store).forEach(function (k) {
        var bucket = store[k];
        if (!bucket || typeof bucket !== 'object') return;
        Object.keys(bucket).forEach(function (id) {
          if (id.charAt(0) === '_') return;   // metadata (_ts), not a section snapshot
          if (!isReal(bucket[id])) { delete bucket[id]; changed = true; }
        });
        if (!Object.keys(bucket).some(function (id) { return id.charAt(0) !== '_'; })) { delete store[k]; changed = true; }
      });
      if (changed) {
        localStorage.setItem(STORE, JSON.stringify(store));
        try { console.log('[CL-PROSE-LOSS-GUARD] purged skeleton/template snapshots'); } catch (_) {}
      }
    } catch (_) {}
  }

  var t = null;
  function run() {
    if (disabled() || erasing()) return;
    try { reapply(); snapshot(); guardKeys(); } catch (_) { /* self-disable on error */ }
  }
  function debounced() { if (t) clearTimeout(t); t = setTimeout(run, 400); }

  // CL-BLANK-CAPTURE-001 (owner 2026-07-01: "cover letter mostly empty, needs a 2nd
  // generation"). On the FIRST generation the real who/why/opening prose exists only
  // briefly before a stale cloud / me()-enforce restore reverts those sections to the
  // EMPTY Nordic skeleton ({items:[{b:label,t:""}]}) — and the 400ms-debounced snapshot
  // ran too late, so the guard had no real snapshot to restore from (foundation/bring
  // survive because they apply as direct items; who/why/opening apply as .content +
  // the 987 bridge and are the ones lost). Snapshot SYNCHRONOUSLY on every
  // sections-updated so the real prose is captured the instant it appears, before the
  // clobber. Additive + idempotent: snapshot ONLY ever STORES a real section, never
  // removes or overwrites a real value, so an extra early capture cannot regress
  // anything. Honours the kill switch / erase gate.
  window.addEventListener('antcv:sections-updated', function () {
    if (disabled() || erasing()) return;
    try { snapshot(); } catch (_) { /* self-disable on error */ }
  });
  window.addEventListener('antcv:sections-updated', debounced);
  // Boot sweep + later windows to catch a cloud-restore / me()-enforce that
  // out-races the first pass (restore + the converter sidecars settle by ~5s).
  setTimeout(purgeSkeletonSnapshots, 300);
  [600, 1500, 3500, 7000, 12000].forEach(function (ms) { setTimeout(run, ms); });
  // PROSE-GUARD-POLL-001 (owner 2026-07): on a HEAVY load the cloud / me()-enforce restore
  // can placeholder opening/why/who LONG after the boot sweeps (the renderer freezes 45-60s),
  // so the preview + export stayed half-empty. A forever poll (like sections-normalize-415)
  // keeps restoring — safe because reapply ONLY ever replaces a PLACEHOLDER with a real
  // snapshot, never a real value, so it cannot fight a genuine user edit.
  setInterval(run, 2500);
  window.AntcvClProseGuard = { version: VERSION, run: run, snapshot: snapshot, reapply: reapply, purgeSkeletonSnapshots: purgeSkeletonSnapshots, _isPlaceholder: isPlaceholder };
})();
