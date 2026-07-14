/* antcv-cl-slogan-fresh.js — SLOGAN-FRESH-GEN-001 (owner 2026-07-03, Trackman review)
 * ============================================================================
 * Owner: "why did the Trackman slogan not regenerate to a new more fit one?"
 * Evidence: the exported Trackman CL still carried the NIL slogan "MAKING THE
 * INVISIBLE MANUFACTURABLE". Root cause: `antcv:clSlogan` is an OVERRIDE key
 * (empty -> render sites fall back to meta.subtitle, the freshly generated
 * slogan) that is GLOBAL and sticky — once a session writes it for one
 * application, every later targeted generation is shadowed, violating spec
 * rules 23/33 ("slogan is per-application content; a standing slogan must not
 * survive a targeted gen").
 *
 * FIX (observer, zero writer patches): this sidecar watches the override key
 * and stamps OWNERSHIP (antcv:clSloganCtx = { v: <value>, app: "Company|Role" })
 * whenever the value changes — any write (panel control, inline preview edit,
 * cloud restore) is attributed to the application active at write time. When
 * the ACTIVE app is targeted (meta.company real) with a REAL fresh
 * meta.subtitle and the override belongs to a DIFFERENT app, the override is
 * DELETED so the render fallback shows the fresh generated slogan.
 *
 * Rules per tick (S = override value, M = meta, cur = company|role key):
 *  - unsolicited meta (company empty/"Unsolicited"): never touch (the standing
 *    motto is the unsolicited design).
 *  - S empty: clear ctx; nothing to own.
 *  - S changed since last stamp: stamp ctx = {v:S, app:cur} (owner-edit-wins —
 *    an edit made while THIS app is active survives its regens).
 *  - S unchanged, ctx.app !== cur, meta targeted, subtitle real and != S:
 *    DELETE override (+ctx) -> fresh slogan renders.
 *  - LEGACY (no ctx, pre-stamp): meta targeted + subtitle real + S != subtitle
 *    -> the override predates stamping and mismatches the fresh gen — stale
 *    carryover by definition (rule 23) -> delete. S == subtitle -> adopt+stamp.
 * The hidden/align keys are never touched (hiding the slogan is orthogonal).
 * Restore-safety: the standalone keys stay the durable backing
 * (sidecar-prefs-clobber-hazard) — this sidecar only ever deletes a STALE
 * override; it never writes slogan text. Ctx rides cl-cloud-sync-extra so two
 * devices agree on ownership.
 * Loop-safe: write-only-on-change; setTimeout debounce (STICKY-LEAK-005: never
 * rAF). Kill: localStorage['antcv:disable-slogan-fresh']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.1404-slogan-lang-gate';
  if (window.__antcvClSloganFresh) return;
  window.__antcvClSloganFresh = VERSION;

  var K_TEXT = 'antcv:clSlogan';
  var K_CTX = 'antcv:clSloganCtx';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-slogan-fresh'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // The prose-loss guard stashes the standalone CL keys (antcv:clKeysGuard) and
  // RE-APPLIES any that empty — a deliberate yield must clear the stash entry
  // too, or the stale slogan resurrects on the guard's next tick.
  function dropOverride() {
    try { localStorage.removeItem(K_TEXT); } catch (_) {}
    try {
      var stash = JSON.parse(localStorage.getItem('antcv:clKeysGuard') || 'null');
      if (stash && typeof stash === 'object' && stash[K_TEXT] != null) {
        delete stash[K_TEXT];
        localStorage.setItem('antcv:clKeysGuard', JSON.stringify(stash));
      }
    } catch (_) {}
  }
  function readMeta() { try { return JSON.parse(localStorage.getItem('meta') || '{}') || {}; } catch (_) { return {}; } }
  function readCtx() { try { return JSON.parse(localStorage.getItem(K_CTX) || 'null'); } catch (_) { return null; } }
  function writeCtx(c) { try { localStorage.setItem(K_CTX, JSON.stringify(c)); } catch (_) {} }
  function dropCtx() { try { localStorage.removeItem(K_CTX); } catch (_) {} }

  function isTargeted(m) {
    var c = String(m.company || '').trim();
    return !!c && !(window.__ANTCV_UNSOL_RE || /^unsolicited$/i).test(c) && !/^open application$/i.test(c); // UNSOL-PILLAR-LANG-001: any language variant
  }
  function appKeyOf(m) { return String(m.company || '').trim() + '|' + String(m.role || m.position || '').trim(); }
  // A REAL fresh slogan: non-empty, not a bracketed template placeholder.
  // SLOGAN-SMART-STATEMENT-001 (owner: "the slogan and the specialization are
  // definitely NOT the same for a specified job"): the gen's DISTINCT smart
  // statement lives in meta.cl_slogan (prompt field since 1.51.127);
  // meta.subtitle is the SPECIALIZATION triad and only serves as the legacy
  // comparison value, never as an adoptable slogan.
  function realText(v) {
    var s = String(v || '').trim();
    if (!s || s.length < 3) return '';
    if (/\[[^\]]*\]/.test(s)) return '';
    return s;
  }
  function realSubtitle(m) { return realText(m.cl_slogan) || realText(m.subtitle); }
  // SLOGAN-QUALITY-GATE-001 (owner: "slogan needs to be a SMART statement" —
  // rule 38: enforce, don't trust the prompt). SLOGAN-PERSONAL-001 (owner
  // 2026-07-05: "the slogan should be professional and personal — e.g. 'As a
  // rugby player and former hockey player, I make hardware platforms work across
  // sports'"): the slogan may now be a longer, first-person PERSONAL statement,
  // so the window is 3-10 words (was 2-8) and the char cap is 110 (was 64). A
  // generated cl_slogan is adopted ONLY when it looks like one: 3-10 words, no
  // bullet-separator keyword-list shape, no banned buzzwords, and NEVER an echo of
  // the specialization triad, the company, or the role title. A failing slogan is
  // treated as ABSENT (no slogan line beats a bad one).
  var BUZZ = /innovation|innovative|cutting[- ]edge|world[- ]class|passionate|dynamic|results[- ]driven|synergy|state[- ]of[- ]the[- ]art|best[- ]in[- ]class/i;
  function normPhrase(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim(); }
  function sloganQualityOk(s, m) {
    s = String(s || '').trim();
    if (!s || s.length > 110) return false;
    if (/[•|]/.test(s)) return false;                                  // triad/keyword-list shape
    if ((s.match(/,/g) || []).length > 2) return false;                 // comma keyword list
    var words = normPhrase(s).split(' ').filter(Boolean);
    if (words.length < 3 || words.length > 10) return false;
    if (BUZZ.test(s)) return false;
    var n = normPhrase(s);
    var against = [m && m.subtitle, m && m.company, m && m.role];
    try { var p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; p = p.personalInfo || p; against.push(p.specialization, p.subtitle); } catch (_) {}
    for (var i = 0; i < against.length; i++) {
      var a = normPhrase(against[i]);
      if (!a) continue;
      if (n === a) return false;
      if (a.length >= 10 && (n.indexOf(a) !== -1 || a.indexOf(n) !== -1)) return false;   // echo/containment
    }
    return true;
  }
  function freshSmart(m) {
    var s = realText(m.cl_slogan);
    return (s && sloganQualityOk(s, m)) ? s : '';
  }

  // SLOGAN-LANG-GATE-001 (owner 2026-07-14): a sticky slogan OVERRIDE
  // (antcv:clSlogan) in the WRONG LANGUAGE for the current ribbon must not win
  // over the app's OWN current-language slogan — the BRANDED and NON-BRANDED
  // exports (and both previews) must all ship the SAME, correct-language line.
  // The gate returns FALSE for an override that carries strong markers of a
  // language OTHER than the ribbon:
  //   - SCRIPT mismatch: a Latin override on a zh/ja/ko/ar/he/ru/el/th/am ribbon,
  //     or a dominantly non-Latin override on a Latin ribbon (generalises the
  //     ad-hoc CL-SLOGAN-ZH-001 check to every non-Latin script).
  //   - LATIN-vs-LATIN: the classic case the owner hit — a Danish standing line
  //     ("JEG FORBINDER TEKNIK MED FORRETNING") on a Swedish/English app. Detected
  //     via language-exclusive letters (æ/ø vs ä/ö) and first-person / function-word
  //     markers, since Danish/Swedish/English share the Latin script.
  // POSITIVE-EVIDENCE-ONLY: an override with no clear foreign markers ALWAYS passes,
  // so a genuine user slogan is never blanked on a hunch — a keyword triad like
  // "Processes • Products • People" has no function words -> ambiguous -> kept.
  // Rejected -> the render/export fall through to the fresh generated slogan /
  // specialization line, which babel-fish keeps in the ribbon language. Shared by
  // both previews + docx-client export (preview == export). Kill:
  // localStorage['antcv:disable-slogan-lang-gate']='1'.
  var GATE_SCRIPTS = {
    zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/, ko: /[가-힯]/,
    ar: /[؀-ۿ]/, fa: /[؀-ۿ]/, he: /[֐-׿]/,
    ru: /[Ѐ-ӿ]/, el: /[Ͱ-Ͽ]/, th: /[฀-๿]/, am: /[ሀ-፿]/
  };
  var GATE_NONLATIN = /[一-鿿぀-ヿ가-힯؀-ۿ֐-׿Ѐ-ӿͰ-Ͽ฀-๿ሀ-፿]/g;
  // family map so da/nb/no do not reject each other, and 2-letter ribbon codes fold.
  var GATE_FAM = { da: 'dano', nb: 'dano', no: 'dano', is: 'dano', sv: 'sv', de: 'de', fi: 'fi', en: 'en', es: 'es', fr: 'fr', it: 'it', nl: 'nl', pt: 'pt' };
  // first-person pronoun / unmistakable marker — a SINGLE hit from a different
  // family rejects (these do not double as other-language words or common names).
  var GATE_STRONG = { dano: ['jeg'], sv: ['jag'], de: ['ich'], fr: ['je'], it: ['io'], nl: ['ik'], es: ['soy', 'hago'], pt: ['sou', 'eu'] };
  // ascii-only function words (diacritics are stripped before scan, so the
  // special-letter detector carries the æ/ø/ä/ö cases separately).
  var GATE_SIG = {
    dano: ['jeg', 'og', 'med', 'til', 'af', 'som', 'ved', 'ikke', 'mine', 'vores', 'begge', 'eller', 'hvor', 'din', 'dit', 'forbinder'],
    sv: ['jag', 'och', 'med', 'till', 'av', 'som', 'inte', 'mina', 'eller', 'din', 'ditt', 'jobbar'],
    en: ['the', 'and', 'with', 'to', 'of', 'as', 'i', 'is', 'are', 'my', 'our', 'both', 'or', 'where', 'when', 'make', 'makes', 'build', 'connect', 'that', 'for', 'from', 'into', 'across', 'we'],
    de: ['und', 'mit', 'ich', 'die', 'der', 'das', 'ist', 'nicht', 'auch', 'oder', 'wir', 'kann'],
    es: ['y', 'con', 'para', 'que', 'el', 'la', 'los', 'las', 'soy', 'hago', 'como', 'donde', 'cuando', 'mi'],
    fr: ['et', 'avec', 'pour', 'je', 'le', 'la', 'les', 'des', 'ne', 'pas', 'ou', 'que', 'mon', 'dans'],
    it: ['con', 'per', 'io', 'il', 'la', 'che', 'non', 'sono', 'dove', 'quando'],
    nl: ['met', 'voor', 'ik', 'de', 'het', 'niet', 'ook', 'dat', 'mijn'],
    pt: ['com', 'para', 'que', 'sou', 'eu', 'meu', 'onde', 'quando', 'faco']
  };
  function sloganLangGateOk(text) {
    var s = String(text == null ? '' : text);
    if (!s.trim()) return true;
    try { if (localStorage.getItem('antcv:disable-slogan-lang-gate') === '1') return true; } catch (_) {}
    var L;
    try { L = String(localStorage.getItem('language') || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2) || 'en'; } catch (_) { L = 'en'; }
    // --- script gate ---
    if (GATE_SCRIPTS[L]) return GATE_SCRIPTS[L].test(s);              // ribbon needs its own script; missing -> reject
    var nlat = (s.match(GATE_NONLATIN) || []).length;
    if (nlat) { var lat = (s.match(/[A-Za-zÀ-ɏ]/g) || []).length; if (nlat > lat) return false; }  // dominantly non-Latin on a Latin ribbon
    var famL = GATE_FAM[L] || L;
    // --- language-exclusive letters ---
    var hasDaNo = /[æøÆØ]/.test(s);              // æ ø -> Danish / Norwegian (/ Icelandic)
    var hasSvDe = !hasDaNo && /[äöÄÖ]/.test(s);  // ä ö -> Swedish / German / Finnish / Estonian
    if (hasDaNo && famL !== 'dano') return false;
    if (hasSvDe && (famL === 'en' || famL === 'es' || famL === 'fr' || famL === 'it' || famL === 'dano' || famL === 'nl' || famL === 'pt')) return false;
    // --- function-word scoring (ascii) ---
    var lower = ' ' + s.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    function has(w) { return lower.indexOf(' ' + w + ' ') !== -1; }
    function score(list) { var n = 0; for (var i = 0; i < list.length; i++) { if (has(list[i])) n++; } return n; }
    // strong pronoun markers from a DIFFERENT family -> reject on a single hit
    for (var g in GATE_STRONG) {
      if (!GATE_STRONG.hasOwnProperty(g) || g === famL) continue;
      var arr = GATE_STRONG[g];
      for (var i = 0; i < arr.length; i++) { if (has(arr[i])) return false; }
    }
    var ribbonScore = score(GATE_SIG[famL] || GATE_SIG.en || []);
    var best = '', bestScore = 0;
    for (var k in GATE_SIG) {
      if (!GATE_SIG.hasOwnProperty(k)) continue;
      var sc = score(GATE_SIG[k]);
      if (sc > bestScore) { bestScore = sc; best = k; }
    }
    if (best && best !== famL && bestScore >= 2 && bestScore > ribbonScore) return false;
    return true;
  }

  function tick() {
    if (disabled()) return;
    try {
      var S = '';
      try { S = String(localStorage.getItem(K_TEXT) || '').trim(); } catch (_) {}
      var ctx = readCtx();
      var m = readMeta();
      var cur = appKeyOf(m);
      if (!isTargeted(m)) {
        // SLOGAN-UNSOL-CLEAR-001 (owner 2026-07-05: "a slogan has stuck over an
        // unsolicited application"): an unsolicited CL carries NO JD-specific slogan.
        // If the current slogan was adopted by slogan-fresh for a DIFFERENT (targeted)
        // app, clear it so it does not leak onto the unsolicited CL. A slogan owned by
        // THIS app (a manual unsolicited slogan) is kept untouched.
        if (S && ctx && typeof ctx === 'object' && ctx.v === S && ctx.app !== cur) {
          dropOverride();
          dropCtx();
          try { console.log('[slogan-fresh] cleared a targeted slogan that stuck over an unsolicited application (SLOGAN-UNSOL-CLEAR-001)'); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'slogan-fresh' } })); } catch (_) {}
          return;
        }
        if (!S && ctx) dropCtx();
        return;
      }
      // ADOPT the gen's smart statement: no override -> the fresh cl_slogan
      // becomes the key (all four render sites read it), stamped to this app.
      var smart = freshSmart(m);
      if (!S) {
        if (ctx) dropCtx();
        if (smart) {
          try { localStorage.setItem(K_TEXT, smart); } catch (_) {}
          writeCtx({ v: smart, app: cur });
          try { console.log('[slogan-fresh] adopted the generated smart slogan for "' + cur + '"'); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'slogan-fresh' } })); } catch (_) {}
        }
        return;
      }
      var sub = realSubtitle(m);
      if (ctx && typeof ctx === 'object' && typeof ctx.v === 'string') {
        if (ctx.v !== S) { writeCtx({ v: S, app: cur }); return; }   // fresh write -> current app owns it
        if (ctx.app === cur) return;                                  // owner's slogan for THIS app — keep across regens
        if (sub && sub !== S) {
          dropOverride();
          dropCtx();
          try { console.log('[slogan-fresh] stale override (owned by "' + ctx.app + '") yields to the fresh generated slogan of "' + cur + '"'); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'slogan-fresh' } })); } catch (_) {}
        }
        return;
      }
      // LEGACY: override predates ownership stamping.
      if (sub) {
        if (S === sub) { writeCtx({ v: S, app: cur }); return; }      // agrees with the fresh gen — adopt
        dropOverride();
        dropCtx();
        try { console.log('[slogan-fresh] legacy sticky slogan dropped — the fresh generated slogan of "' + cur + '" renders (rule 23/33)'); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'slogan-fresh' } })); } catch (_) {}
      } else {
        writeCtx({ v: S, app: cur });                                 // no fresh slogan to compare — assume current app's
      }
    } catch (_) {}
  }

  var pending = false;
  function debounced() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { tick(); } catch (_) {} }, 250); }

  [900, 2500, 5000].forEach(function (d) { setTimeout(debounced, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === 'slogan-fresh')) debounced(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'meta' || e.key === K_TEXT || e.key === null) debounced(); }); } catch (_) {}
  setInterval(debounced, 5000);

  // Shared quality check — the preview fallbacks and the export chain consult
  // the SAME gate so a low-quality cl_slogan renders NOWHERE.
  window.__antcvSloganQualityOk = sloganQualityOk;
  // SLOGAN-LANG-GATE-001: shared wrong-language gate — both previews + the
  // docx-client export reject a stale other-language OVERRIDE through this ONE
  // function so branded == non-branded and the app's own current-language slogan wins.
  window.__antcvSloganLangGate = sloganLangGateOk;
  window.AntcvClSloganFresh = { version: VERSION, _tick: tick, _isTargeted: isTargeted, _realSubtitle: realSubtitle, _appKeyOf: appKeyOf, _qualityOk: sloganQualityOk, _langGateOk: sloganLangGateOk };
})();
