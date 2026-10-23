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
 * No app.js edit. Kill: localStorage['antcv:disable-proof-points']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.5114-proof-points';
  if (window.__antcvProofPoints === VERSION) return;
  window.__antcvProofPoints = VERSION;

  var ID = 'proof_points', REASON = 'proof-points-sidebar', AUTO = '_proofAuto';
  var MIN = 3, MAX = 5, MAX_CHARS = 64;
  var TITLE = { en: 'Proof points', da: 'Dokumenterede resultater', es: 'Resultados probados' };

  function get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function readJson(k, d) { try { var v = JSON.parse(get(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }
  function bare(v) { return String(v == null ? '' : v).replace(/^"|"$/g, '').trim(); }
  function disabled() { var v = get('antcv:disable-proof-points'); return v === '1' || v === 'true'; }
  function lang() { var v = bare(get('language')).replace(/[^a-z]/gi, '').slice(0, 2).toLowerCase(); return v || 'en'; }
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

  // ---- the section ---------------------------------------------------------------------------
  function hash(items) { return JSON.stringify(items); }
  function build(items) {
    return { id: ID, type: 'bullets', title: TITLE[lang()] || TITLE.en, on: true, loc: 'sidebar',
      items: items.map(function (t) { return { t: t }; }) };
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

  var busy = false;
  function run(ev) {
    if (busy || disabled()) return;
    if (ev && ev.detail && ev.detail.reason === REASON) return;
    busy = true;
    try {
      var secs = readJson('sections', null);
      if (!secs || !Array.isArray(secs.cv)) return;
      var cv = secs.cv.slice();
      var at = -1; for (var i = 0; i < cv.length; i++) if (cv[i] && cv[i].id === ID) { at = i; break; }
      var existing = at >= 0 ? cv[at] : null;
      var edited = !!(existing && existing[AUTO] && hash(existing.items || []) !== existing[AUTO]);
      var changed = false;

      if (!eligible()) {
        if (existing && existing[AUTO] && !edited) { cv.splice(at, 1); changed = true; }
      } else {
        roleGapDefault();
        var items = rank(fragments(secs), get('antcv:lastJdText')).slice(0, MAX);
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
        }
      }
      if (!changed) return;
      secs.cv = cv;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: REASON } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ } finally { busy = false; }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 400, 1200, 2500, 5000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvProofPoints = { version: VERSION, run: run, fragments: fragments, rank: rank, demand: demand, eligible: eligible };
})();
