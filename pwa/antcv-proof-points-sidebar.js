/* antcv-proof-points-sidebar.js — PROOF-POINTS-FIRST-001 / PROOF-POINTS-ORDER-001 /
 * EXPERIENCE-SPACING-001 (owner 2026-10-23, course reviewer feedback on the Veo CV v7)
 * ============================================================================
 * Reviewer: "the proof points (250 -> 10 days, 10x, 20 MP, ~3,400, 7 + 1) ... make the key
 * points visible in the first ten seconds"; "order the proof points by relevance to the ad,
 * with shipped consumer hardware first"; "a bit more space between experiences".
 * Owner: make these the DEFAULT for the Nordic Minimal writing style and the Copenhagen
 * Modern package: two columns, the strength points first on the left, a sidebar rather than
 * the classic heading stack.
 *
 * What this sidecar does (deterministic, no model call, so it adds no hallucination):
 *   1. PROOF POINTS block: builds a sidebar section (id 'proof_points', type bullets) from
 *      numbers the stored sections ALREADY carry - every role's Results line (role.results,
 *      role.outcomes, or a bullet that opens with "Results:") and the proof half of each Core
 *      Competencies row. Fragments are split on ';' / ',' and kept only when they carry a digit,
 *      so nothing is invented and every line traces to a source line.
 *   2. ORDER by relevance to the ad (antcv:lastJdText): each fragment belongs to one group
 *      (volume, cost, time, quality, scale); the group the ad mentions most ranks first; ties
 *      keep source order (newest role first). 4-5 lines, 3 minimum, else no block.
 *   3. PLACES it as the FIRST sidebar section (sidebar = the left column by default).
 *   4. ROLE GAP default: styleConfig.roleGap 14 px (the "CV main · role gap" slider) when the
 *      owner has not set it; done once, so a later slider change wins.
 * Eligible when the writing style is nordic-minimal (the default) or the package is
 * copenhagen-modern; the linear CV layout (antcv:cvLayout=linear) keeps its own order and
 * gets no block. A hand-edited block (items differ from the last auto write) is left alone.
 * Store: localStorage 'sections' (secs.cv), event antcv:sections-updated (own reason ignored).
 * Rules: pwa/gold-rules.json PROOF-POINTS-FIRST-001 / PROOF-POINTS-ORDER-001 / EXPERIENCE-SPACING-001.
 * PROOF-POINTS-LANG-001 (owner 2026-11-05 "some proof-point lines stay English after the DA
 * switch"): the translate pass collects the block's lines by index and applies the LLM's
 * output minutes later by the same index. The belt used to rebuild the block in between
 * (the ribbon flips first, a non-EN ribbon reads the role fragments instead of the kernel
 * lines), so the Danish lines landed on a different block - some lines Danish, some English.
 * Now: while window.__antcvTranslateBusy is set the belt waits; under a non-EN ribbon an
 * existing block keeps its lines (the translation owns them) and only the house title is
 * pinned; the language the block was last written in is stamped in
 * localStorage 'antcv:proofPointsAuto' {lang, hash} (the 763 re-typer drops _proofAuto from
 * the section), and an EN ribbon over a block stamped in another language rebuilds it from
 * the kernel lines - a translation is not the owner's edit.
 * No app.js edit for the block itself; app.js sets window.__antcvTranslateBusy around the pass.
 * Kill: localStorage['antcv:disable-proof-points']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.5905-proof-points-lang-b';
  if (window.__antcvProofPoints === VERSION) return;
  window.__antcvProofPoints = VERSION;

  var ID = 'proof_points', REASON = 'proof-points-sidebar', AUTO = '_proofAuto', STAMP = 'antcv:proofPointsAuto';
  var MIN = 3, MAX = 5, MAX_CHARS = 64, CAP_CHARS = 48;
  // PROOF-POINTS-HOUSE-001 (owner 2026-11-05 "proof points do not match academy format and
  // content"): the house margin CV (gen_margin.py) renders five proof points as a BIG figure
  // in accent type with a small caption ("250 -> 10 days" / "change cycle as change-board
  // chair"), titled "Proof points" / DA "Resultater i tal". This block was 64-char digit
  // fragments cut from role bullets, newest role first - the Trackman internship led and the
  // career figures were tails ("Through to Tier-1 customer sign-off"). Now: the figure and
  // the caption are split deterministically, and an English document takes its lines from
  // the kernel's pinned proof points (personalInfo.proofPoints / ByRole / ByPosition, the
  // owner-curated record) before the role-bullet fragments. Other languages keep the
  // translated fragments (the kernel lines are English) in the same shape.
  var TITLE = { en: 'Proof points', da: 'Resultater i tal', es: 'Resultados probados' };

  function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function readJson(k, d) { try { var v = JSON.parse(get(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }
  function bare(v) { return String(v == null ? '' : v).replace(/^"|"$/g, '').trim(); }
  function disabled() { var v = get('antcv:disable-proof-points'); return v === '1' || v === 'true'; }
  function lang() { var v = bare(get('language')).replace(/[^a-z]/gi, '').slice(0, 2).toLowerCase(); return v || 'en'; }
  // 1.51.5905: the window flag covers this tab; the localStorage marker (lang:epoch ms, written by
  // app.js with the pass, removed in its finally) covers a pass running in another tab of the same
  // profile. A marker older than 5 min is a crashed pass and is ignored.
  function translating() {
    try { if (window.__antcvTranslateBusy) return true; } catch (_) {}
    try {
      var m = String(get('antcv:translateBusy') || ''), at = parseInt(m.split(':')[1], 10);
      return !!m && (!isFinite(at) || Date.now() - at < 300000);
    } catch (_) { return false; }
  }
  function stamp() { var s = readJson(STAMP, null); return s && typeof s === 'object' ? s : null; }
  function writeStamp(l, h) {
    var s = stamp();
    if (s && s.lang === l && s.hash === h) return;
    try { localStorage.setItem(STAMP, JSON.stringify({ lang: l, hash: h })); } catch (_) {}
  }
  function pkg() {
    var p = bare(get('stylePackage'));
    if (!p && typeof document !== 'undefined' && document.body && document.body.dataset) p = document.body.dataset.package || '';
    return p.toLowerCase();
  }
  function style() { return bare(get('writingStyle')).toLowerCase() || 'nordic-minimal'; }
  function eligible() {
    if (bare(get('antcv:cvLayout')) === 'linear') return false;
    return pkg() === 'copenhagen-modern' || style() === 'nordic-minimal';
  }

  // ---- fragments: numbers the sections already carry -------------------------------------
  function text(x) {
    if (x == null) return '';
    if (typeof x === 'string') return x;
    if (typeof x === 'object') return [x.b, x.t, x.text, x.result, x.v, x.l].filter(function (s) { return typeof s === 'string'; }).join(' ');
    return String(x);
  }
  function hasDigit(s) { return /\d/.test(s); }
  function tidy(s) {
    var t = String(s || '').replace(/^\s*results?\s*:\s*/i, '').replace(/\s+/g, ' ').trim();
    t = t.replace(/[.;,]+$/, '').trim();
    if (!t) return '';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  // split a Results line into clauses; a long clause is split again on ','
  function clauses(line) {
    var out = [];
    String(line || '').split(/;|\s[-–—]\s|·/).forEach(function (c) {
      c = c.trim(); if (!c) return;
      if (c.length <= MAX_CHARS) { out.push(c); return; }
      c.split(/,\s+/).forEach(function (p) { if (p.trim()) out.push(p.trim()); });
    });
    return out;
  }
  function valueKey(s) {
    var m = String(s).match(/\d[\d,.]*\s?(?:%|x|\/week|k|m)?/gi);
    return m ? m.map(function (v) { return v.replace(/[,\s]/g, '').toLowerCase(); }).join('|') : s.toLowerCase();
  }
  function isExperience(s) { return !!(s && (s.type === 'experience' || Array.isArray(s.roles))); }
  function isCompetencies(s) {
    return !!(s && s.type === 'table' && (s.id === 'competencies' || s.id === 'core_competencies' ||
      /competenc|what i bring|kernekompetenc|competencias/i.test(String(s.title || ''))));
  }
  function roleResults(role) {
    var out = [];
    if (!role || role.on === false) return out;
    if (typeof role.results === 'string' && role.results.trim()) out.push(role.results);
    if (Array.isArray(role.outcomes)) role.outcomes.forEach(function (o) { if (!(o && o.on === false)) out.push(text(o)); });
    (Array.isArray(role.bullets) ? role.bullets : []).forEach(function (b) {
      var t = text(b); if (/^\s*results?\s*:/i.test(t)) out.push(t);
    });
    return out;
  }
  function fragments(secs) {
    var cv = (secs && Array.isArray(secs.cv)) ? secs.cv : [];
    var raw = [];
    cv.forEach(function (s) {
      if (!s || s.on === false) return;
      if (isExperience(s)) {
        (s.roles || []).forEach(function (r) { roleResults(r).forEach(function (line) { clauses(line).forEach(function (c) { raw.push(c); }); }); });
      } else if (isCompetencies(s)) {
        (s.rows || []).forEach(function (row, i) {
          if (i === 0 && Array.isArray(row) && !row.some(function (c) { return hasDigit(text(c)); })) return;   // header row
          var cells = Array.isArray(row) ? row : (row && typeof row === 'object' ? Object.keys(row).map(function (k) { return row[k]; }) : [row]);
          var last = text(cells[cells.length - 1]);
          clauses(last).forEach(function (c) { raw.push(c); });
        });
      }
    });
    var seen = {}, out = [];
    raw.forEach(function (c) {
      var t = tidy(c);
      if (!t || !hasDigit(t) || t.length > MAX_CHARS || t.length < 8) return;
      var k = valueKey(t); if (seen[k]) return; seen[k] = 1;
      out.push(t);
    });
    return out;
  }

  // ---- order by what the ad stresses --------------------------------------------------------
  var GROUPS = [
    ['volume', /(\bunits?\s*(?:\/|per|a)\s*(?:week|day|month|year)\b|\b\d[\d,.]*k?\s*units?\b|\bshipped\b|\bproduction\s+(?:lines?|runs?|ramp)\b|\bmass\s+production\b|\bdfm\b|\bdfa\b|\bvolumes?\b|\bmanufactur|\bramp-up\b|\bconsumer\s+electronics\b)/i],
    ['cost', /(\bcost|\bprices?\b|\bbom\b|\bmargins?\b|\bcapex\b|\bopex\b|\bbudgets?\b|\$|\bdkk\b|\beur\b|\busd\b|\b\d+x\b)/i],
    ['time', /\b(cycle|days?|weeks?|lead time|schedule|delivery|on time|time-to|faster)\b/i],
    ['quality', /\b(rejects?|defects?|yield|quality|returns?|warranty|first-pass|pass rate)\b/i],
    ['scale', /\b(requirements?|countries|customers?|users?|people|team|engineers?|sites?|clients?|offers?)\b/i],
  ];
  function groupOf(s) { for (var i = 0; i < GROUPS.length; i++) if (GROUPS[i][1].test(s)) return GROUPS[i][0]; return 'other'; }
  function demand(jd) {
    var d = {}, t = String(jd || '').toLowerCase();
    GROUPS.forEach(function (g) { var m = t.match(new RegExp(g[1].source, 'gi')); d[g[0]] = m ? m.length : 0; });
    return d;
  }
  function rank(frags, jd) {
    var d = demand(jd);
    return frags.map(function (f, i) { return { f: f, i: i, s: d[groupOf(f)] || 0 }; })
      .sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); })
      .map(function (o) { return o.f; });
  }

  // ---- PROOF-POINTS-HOUSE-001: pinned lines + figure / caption split ----------------------
  function pinned() {
    var out = [];
    try {
      var pi = readJson('personalInfo', {}) || {}; pi = pi.personalInfo || pi;
      (Array.isArray(pi.proofPoints) ? pi.proofPoints : []).forEach(function (p) {
        var t = typeof p === 'string' ? p : (p && typeof p === 'object' ? (p.text || p.t || '') : '');
        if (t && String(t).trim()) out.push(String(t).trim());
      });
      [].concat(pi.proofPointsByRole || [], pi.proofPointsByPosition || []).forEach(function (p) {
        if (p && typeof p.text === 'string' && p.text.trim()) out.push(p.text.trim());
      });
    } catch (_) {}
    return out;
  }
  var UNITS = '(?:users?|units?\\/(?:week|day|year)|units?|clauses?|countries|sites?|machines?|offers?|clients?|teams?|engineers?|people|persons?|domains?|roles?|papers?|publications?|patents?|lines?|weeks?|months?|days?|years?|hours?|MP|GB|TB'
    + '|brugere|enheder\\/(?:uge|dag|år)|enheder|klausuler|lande|maskiner|tilbud|kunder|teams?|ingeniører|personer|dage|uger|år|timer|krav|linjer)';
  var UNIT_RE = new RegExp('(~?\\$?\\d[\\d,.]*(?:%|[kKmM]\\b)?)(?:-(?=person|unit|week|day|year|site|country|mand))?\\s*(' + UNITS + '\\b)?', 'gi');
  var CAP_KEY = /\b(cost|cut|reduc\w*|faster|saved|shipped|verified|qualified|simplif\w*|omkostning\w*|skåret|reduceret|hurtigere|leveret|verificeret|forenklet)\b/i;
  var TRAIL = /\s+(?:as|of|in|at|to|for|and|the|a|an|with|over|across|from|by|on|via|som|af|i|på|til|for|og|den|det|en|et|med|fra)$/i;
  // numbers that are identifiers, not results: patent / certificate numbers, levels, fiscal years
  function idNumber(s) { return /(?:\bno\.?\s*|\bnr\.?\s*|\bpatent\s+|\blevel\s+|\bfy)\s*[\d,.]+/i.test(s); }
  function caption(rest) {
    var r = String(rest || '').replace(/\s+/g, ' ').replace(/\(\s*\)/g, '').replace(/\s+([,;:.])/g, '$1').replace(/\ba\s+(?=[aeiou])/gi, 'an ').trim();
    r = r.replace(/^[,;:\s]+|[,;:.\s]+$/g, '');
    var cl = r.split(/,\s|;\s|\s\(|\svia\s|\sthrough\s|\sthat\s|\swhich\s|\sgennem\s|\ssom\s/).map(function (c) { return c.trim(); }).filter(Boolean);
    var m = null;
    for (var i = 0; i < cl.length; i++) if (CAP_KEY.test(cl[i])) { m = cl[i]; break; }
    if (!m) m = cl[0] || r;
    m = m.replace(/[.;:,]+$/, '').trim();
    if (m.length > CAP_CHARS) { m = m.slice(0, CAP_CHARS + 1); m = m.replace(/\s+\S*$/, ''); }
    m = m.replace(TRAIL, '').replace(TRAIL, '').trim();
    m = m.replace(/^([A-Z])(?=[a-zs])/, function (c) { return c.toLowerCase(); });   // sentence-case opener; an acronym (ALM, EOL) keeps its caps
    return m.length >= 6 ? m : '';                                                  // a short tail ("one line") is still a caption
  }
  // Returns { big, cap } or null. big <= 18 chars, cap 6..48 chars.
  function figure(line) {
    var s = String(line || '').replace(/\s+/g, ' ').trim();
    if (!s || !hasDigit(s)) return null;
    var m, big, rest;
    if ((m = s.match(/\b(?:from|fra)\s+(?:roughly|about|approximately|around|some|circa|ca\.?|cirka|omkring|godt)?\s*(~?\d[\d,.]*)\s*(%|[a-zæøå][a-zæøå\/-]*)?\s+(?:to|til)\s+(?:roughly|about|approximately|around|some|circa|ca\.?|cirka|omkring|godt)?\s*(~?\d[\d,.]*)\s*(%|[a-zæøå][a-zæøå\/-]*)?/i))) {
      // a) range: "from ~250 to ~10 days" / "from roughly 250 days to about 10" -> "250 → 10 days"
      var __stop = /^(?:as|to|til|at|i|på|and|og|of|af|in|for|with|med|via|through|gennem|a|an|en|et|the|den|det|by|per)$/i;
      var __u = (m[2] && !__stop.test(m[2])) ? m[2] : ((m[4] && !__stop.test(m[4])) ? m[4] : '');
      big = m[1].replace(/^~/, '') + ' → ' + m[3].replace(/^~/, '') + (__u ? ' ' + __u : '');
      rest = s.replace(m[0], '');
    } else if ((m = s.match(/\(?\b(\d+(?:\.\d+)?)\s*[x×]\)?/i))) {
      // b) multiplier: "(10×)" / "10× faster" -> "10x"
      big = m[1] + 'x';
      rest = s.replace(m[0], '').replace(/\b(?:by|med)\s+\d+%\s*/i, '');
    } else if ((m = s.match(/(~?\d[\d,.]*)\s+(?:of|af)\s+(~?\d[\d,.]*)\s+(?=[a-zæøå])/i))) {
      // c) "3,400 of 3,600 requirements" -> "3,400 of 3,600"
      big = m[1] + ' of ' + m[2];
      rest = s.replace(m[0], '');
    } else {
      // d) generic: the largest "number + unit" that is not an identifier; a bare number is not a proof point
      var best = null, mm;
      UNIT_RE.lastIndex = 0;
      while ((mm = UNIT_RE.exec(s))) {
        var tok = mm[0].trim();
        if (!tok) continue;
        if (idNumber(s.slice(Math.max(0, mm.index - 10), mm.index + tok.length))) continue;
        if (!mm[2] && !/[%$]/.test(mm[1])) continue;
        var val = parseFloat(mm[1].replace(/[^\d.]/g, '')) || 0;
        if (!best || val > best.val) best = { tok: tok, val: val, i: mm.index };
      }
      if (!best) return null;
      big = best.tok.replace(/\s+/g, ' ');
      rest = s.slice(0, best.i) + ' ' + s.slice(best.i + best.tok.length);
      rest = rest.replace(/\b(?:a|an|et|en)\s+(?=(?:[a-zæøå-]+\s+)?(?:team|run|line|group|hold))/i, '').replace(/\(\s*\/\s*[^)]*\)/g, '');
    }
    if (!big || big.length > 18) return null;
    var cap = caption(rest);
    if (!cap) return null;
    return { big: big, cap: cap };
  }
  function keyOf(f) { return f.big.toLowerCase().replace(/[^0-9a-zæøå]/g, ''); }
  function pairs(secs) {
    var lines = lang() === 'en' ? pinned() : [];
    var fromPinned = lines.length > 0;
    if (!fromPinned) lines = fragments(secs);
    var seen = {}, out = [];
    var take = function (l) { var f = figure(l); if (!f) return; var k = keyOf(f); if (!k || seen[k]) return; seen[k] = 1; f.src = l; out.push(f); };
    lines.forEach(take);
    if (fromPinned && out.length < MIN) fragments(secs).forEach(take);          // thin kernel: top up from the sections
    // rank by what the ad stresses, judged on the SOURCE line (its words carry the group), source order as the tie-break
    var ranked = rank(out.map(function (f) { return f.src; }), get('antcv:lastJdText'));
    var byLine = {}; out.forEach(function (f) { byLine[f.src] = f; });
    return ranked.map(function (l) { return byLine[l]; }).filter(Boolean).slice(0, MAX).map(function (f) { return { big: f.big, cap: f.cap }; });
  }
  // Preview shape: a bold accent figure on its own line, the caption small below it. The
  // label span carries a trailing ':' text node (labeled_list), hidden by the zero font size
  // on the wrapper while the editable inner span keeps the figure visible.
  function injectCss() {
    try {
      if (typeof document === 'undefined' || !document.head || document.getElementById('antcv-proof-points-house-css')) return;
      var st = document.createElement('style'); st.id = 'antcv-proof-points-house-css';
      st.textContent = '[data-sid="proof_points"] p[data-antcv-row-path] > span:first-child{display:block;font-size:0 !important;line-height:1 !important;}'
        + '[data-sid="proof_points"] p[data-antcv-row-path] > span:first-child > span{font-size:15px !important;font-weight:700 !important;color:var(--sidebar-head-color,#00746E) !important;line-height:1.1 !important;letter-spacing:0 !important;}'
        + '[data-sid="proof_points"] p[data-antcv-row-path]{margin:5px 0 2px !important;}'
        + '[data-sid="proof_points"] p[data-antcv-row-path] > span:not(:first-child){font-size:9.5px !important;line-height:1.2 !important;display:block;}';
      document.head.appendChild(st);
    } catch (_) {}
  }

  // ---- the section ---------------------------------------------------------------------------
  // PROOF-POINTS-HOUSE-001b (owner's live document 2026-11-05): the shape belts add keys to
  // every item (bullets: []), so a whole-item JSON hash never matched the auto hash again and
  // the block read as hand-edited in EN and DA alike - the house shape never applied. Hash
  // the OWNED text only (t, or l + v); accept the legacy whole-item hash by re-deriving the
  // same texts from it; a pre-house bullets block in a translated document is an upgrade,
  // not an edit (the translation pass rewrote its lines, the owner did not).
  function texts(items) {
    return (Array.isArray(items) ? items : []).map(function (i) {
      if (!i || typeof i !== 'object') return String(i == null ? '' : i);
      // PROOF-POINTS-HOUSE-001c: antcv-labeled-list-to-rich-block-763 re-types the block to {b, t}; same owned text
      if (i.l != null || i.v != null) return [String(i.l || ''), String(i.v || '')];
      if (i.b != null) return [String(i.b || ''), String(i.t || '')];
      return String(i.t || '');
    });
  }
  function hash(items) { return JSON.stringify(texts(items)); }
  function isEdited(existing) {
    if (!existing) return false;
    var st = stamp();
    // PROOF-POINTS-LANG-001: the stamp outlives the section key; a block last written under
    // another ribbon carries the translation's lines, not the owner's edit
    if (lang() === 'en' && st && st.lang && st.lang !== 'en') return false;
    var auto = existing[AUTO] != null ? String(existing[AUTO]) : (st && st.hash != null ? String(st.hash) : null);
    if (auto == null) return false;
    var now = hash(existing.items || []);
    if (auto === now) return false;
    try { var legacy = JSON.parse(auto); if (Array.isArray(legacy) && hash(legacy) === now) return false; } catch (_) {}
    if (existing.type === 'bullets' && lang() !== 'en') return false;      // pre-house block, translated: upgrade
    return true;
  }
  function build(items) {
    return { id: ID, type: 'labeled_list', title: TITLE[lang()] || TITLE.en, on: true, loc: 'sidebar',
      items: items.map(function (f) { return { l: f.big, v: f.cap }; }) };
  }
  function firstSidebarIndex(cv) {
    for (var i = 0; i < cv.length; i++) if (cv[i] && cv[i].loc === 'sidebar' && cv[i].id !== ID) return i;
    return cv.length;
  }
  function roleGapDefault() {
    try {
      if (get('antcv:roleGapDefaulted') === '1') return;
      var sc = readJson('styleConfig', null);
      if (!sc || typeof sc !== 'object') sc = {};
      if (sc.roleGap == null) { sc.roleGap = 14; localStorage.setItem('styleConfig', JSON.stringify(sc)); }
      localStorage.setItem('antcv:roleGapDefaulted', '1');
    } catch (_) {}
  }

  var busy = false, retry = 0;
  function run(ev) {
    if (busy || disabled()) return;
    if (ev && ev.detail && ev.detail.reason === REASON) return;
    // PROOF-POINTS-LANG-001: a translate pass is applying by index - wait for it
    if (translating()) { if (!retry) retry = setTimeout(function () { retry = 0; run(); }, 1500); return; }
    busy = true;
    try {
      var secs = readJson('sections', null);
      if (!secs || !Array.isArray(secs.cv)) return;
      var cv = secs.cv.slice();
      var at = -1; for (var i = 0; i < cv.length; i++) if (cv[i] && cv[i].id === ID) { at = i; break; }
      var existing = at >= 0 ? cv[at] : null;
      var edited = isEdited(existing);
      var changed = false;

      if (!eligible()) {
        if (existing && existing[AUTO] && !edited) { cv.splice(at, 1); changed = true; }
      } else if (existing && lang() !== 'en' && existing.type !== 'bullets') {
        // PROOF-POINTS-LANG-001: under a non-EN ribbon the translation owns the lines; pin the
        // house title, keep the block first in the sidebar, record the language
        roleGapDefault();
        injectCss();
        var nt = TITLE[lang()], nx = existing;
        if (nt && existing.title !== nt) { nx = Object.assign({}, existing, { title: nt }); changed = true; }
        cv.splice(at, 1);
        var w2 = firstSidebarIndex(cv);
        cv.splice(w2, 0, nx);
        if (w2 !== at) changed = true;
        writeStamp(lang(), hash(nx.items || []));
      } else {
        roleGapDefault();
        injectCss();
        var items = pairs(secs);
        if (items.length < MIN) {
          if (existing && existing[AUTO] && !edited) { cv.splice(at, 1); changed = true; }
        } else if (!existing) {
          var s = build(items); s[AUTO] = hash(s.items);
          cv.splice(firstSidebarIndex(cv), 0, s); changed = true;
        } else {
          var next = existing;
          if (!edited) {
            var fresh = build(items); fresh[AUTO] = hash(fresh.items);
            if (hash(fresh.items) !== hash(existing.items || []) || existing.loc !== 'sidebar' || existing.title !== fresh.title) {
              next = Object.assign({}, existing, fresh); changed = true;
            }
          }
          cv.splice(at, 1);
          var want = firstSidebarIndex(cv);
          cv.splice(want, 0, next);
          if (want !== at) changed = true;
          writeStamp(lang(), hash(next.items || []));
        }
        if (changed) { var w3 = cv.filter(function (s) { return s && s.id === ID; })[0]; if (w3) writeStamp(lang(), hash(w3.items || [])); }
      }
      if (!changed) return;
      secs.cv = cv;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: REASON } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ } finally { busy = false; }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 400, 1200, 2500, 5000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvProofPoints = { version: VERSION, run: run, fragments: fragments, rank: rank, demand: demand, eligible: eligible, figure: figure, pairs: pairs, pinned: pinned, isEdited: isEdited, stamp: stamp };
})();
