/* antcv-company-match.js — COMPANY-MATCH-001 (owner 2026-11-01, Ambu 3524 / ASSA ABLOY 3525)
 * ============================================================================
 * ONE shared, pure definition of "which application does this text belong to",
 * used by every cross-application guard so they can never disagree:
 *   - antcv-cl-prose-loss-guard-985.js  (never snapshot / reapply another company's prose)
 *   - antcv-app-content-owner-guard.js  (content stamped for another application)
 *   - antcv-export-content-gate.js      (the letter must name the current company)
 *   - antcv-docx-client.js              (hydrate gate + export backstop)
 *
 * The 2026-11-01 incident: the Terma letter was snapshotted under the key
 * "Ambu|Hardware Solution Architect…|en" and exported as the Ambu letter. A letter
 * written for X names X; a letter that names Terma and not Ambu is not Ambu's.
 *
 * Pure functions only (no DOM, no storage). Loaded synchronously early in
 * index.html; also require()-able from node tests.
 */
(function (root) {
  'use strict';
  var VERSION = '1.51.5242';

  // Words that never identify an employer on their own.
  var GENERIC = {
    the: 1, and: 1, of: 1, for: 1, a: 1, an: 1, de: 1, og: 1, i: 1, at: 1,
    group: 1, company: 1, companies: 1, corporation: 1, corp: 1, holding: 1, holdings: 1,
    international: 1, global: 1, technologies: 1, technology: 1, systems: 1, solutions: 1,
    industries: 1, services: 1, career: 1, careers: 1, opportunities: 1, opportunity: 1,
    jobs: 1, job: 1, vacancy: 1, vacancies: 1, position: 1, role: 1, experienced: 1,
    senior: 1, engineer: 1, manager: 1, denmark: 1, danmark: 1, europe: 1, emea: 1, emeia: 1,
    nordic: 1, nordics: 1, scandinavia: 1, opening: 1, openings: 1, danish: 1, swedish: 1,
    norwegian: 1, finnish: 1, german: 1, european: 1, american: 1, scandinavian: 1, royal: 1,
    national: 1, university: 1, institute: 1, copenhagen: 1, kobenhavn: 1, aarhus: 1, malmo: 1
  };
  var LEGAL = /\b(a\/s|aps|a\.s\.|as|ab|asa|oy|oyj|ag|gmbh|kg|se|sa|s\.a\.|sas|srl|spa|bv|b\.v\.|nv|n\.v\.|plc|ltd|limited|llc|inc|inc\.|co|co\.|corp\.|l\.p\.)\b\.?/gi;

  function fold(s) {
    s = String(s == null ? '' : s);
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (_) {}
    return s.toLowerCase()
      .replace(/ø/g, 'o').replace(/æ/g, 'ae').replace(/å/g, 'a').replace(/ß/g, 'ss');
  }
  function clean(s) {
    return fold(s).replace(LEGAL, ' ').replace(/[^a-z0-9&+]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // UNSOL-PILLAR-LANG-001 parity: index.html defines window.__antcvUnsol; fall back to
  // the English/Danish forms for node tests.
  function isUnsolicited(company) {
    var c = String(company == null ? '' : company).trim();
    if (!c) return false;
    try { if (root && typeof root.__antcvUnsol === 'function') return !!root.__antcvUnsol(c); } catch (_) {}
    return /^(unsolicited|open\s+application|n\/?a|uopfordret(\s+ansøgning)?|åben\s+ansøgning)$/i.test(c);
  }
  // A targeted application = a real, named employer.
  function isTargeted(company) {
    var c = String(company == null ? '' : company).trim();
    return !!c && !isUnsolicited(c) && !!clean(c);
  }

  // Name variants that identify the employer in running text.
  //   "ASSA ABLOY (Yale)"        -> ["assa abloy", "yale"]
  //   "Hamamatsu Photonics A/S"  -> ["hamamatsu photonics", "hamamatsu"]
  //   "Terma A/S"                -> ["terma"]
  function tokens(company) {
    var raw = String(company == null ? '' : company);
    var out = [];
    function push(v) {
      v = clean(v);
      if (!v || v.length < 2 || out.indexOf(v) >= 0 || /^[0-9 ]+$/.test(v)) return;
      if (v.split(' ').every(function (w) { return GENERIC[w]; })) return;   // "career opportunities"
      out.push(v);
    }
    var paren = raw.match(/\(([^)]{2,60})\)/g) || [];
    var base = raw.replace(/\([^)]*\)/g, ' ');
    // "Career Opportunities: Experienced Systems Engineer" — the part before ':' is a page title.
    base.split(/\s*[:|–—]\s*|\s+-\s+|,/).forEach(function (part) {
      var c = clean(part);
      if (!c) return;
      push(c);
      var words = c.split(' ').filter(function (w) { return !GENERIC[w]; });
      if (words.length > 1 && words[0].length >= 4) push(words[0]);
      if (words.length && words.join(' ') !== c) push(words.join(' '));
    });
    paren.forEach(function (p) { push(p.slice(1, -1)); });
    return out;
  }

  // Does free text name the company? Whole-word match on any variant.
  function names(text, company) {
    var toks = tokens(company);
    if (!toks.length) return false;
    var t = ' ' + clean(text) + ' ';
    for (var i = 0; i < toks.length; i++) {
      if (t.indexOf(' ' + toks[i] + ' ') >= 0) return true;
    }
    return false;
  }

  function sameCompany(a, b) {
    var ta = tokens(a), tb = tokens(b);
    if (!ta.length && !tb.length) return true;
    if (!ta.length || !tb.length) return false;
    for (var i = 0; i < ta.length; i++) {
      for (var j = 0; j < tb.length; j++) {
        if (ta[i] === tb[j]) return true;
        if ((' ' + ta[i] + ' ').indexOf(' ' + tb[j] + ' ') >= 0) return true;
        if ((' ' + tb[j] + ' ').indexOf(' ' + ta[i] + ' ') >= 0) return true;
      }
    }
    return false;
  }

  function roleWords(r) {
    return clean(r).split(' ').filter(function (w) { return w.length >= 3 && !/^(and|the|for|med|til|with)$/.test(w); });
  }
  // Same posting title? Equal, contained, or >=60% word overlap of the shorter title.
  function sameRole(a, b) {
    var ca = clean(a), cb = clean(b);
    if (ca === cb) return true;
    if (!ca || !cb) return false;
    if ((' ' + ca + ' ').indexOf(' ' + cb + ' ') >= 0 || (' ' + cb + ' ').indexOf(' ' + ca + ' ') >= 0) return true;
    var wa = roleWords(a), wb = roleWords(b);
    if (!wa.length || !wb.length) return false;
    var hit = 0;
    wa.forEach(function (w) { if (wb.indexOf(w) >= 0) hit++; });
    return hit / Math.min(wa.length, wb.length) >= 0.6;
  }

  // Same application: same employer AND same posting. Two unsolicited drafts are one context.
  function sameApp(a, b) {
    a = a || {}; b = b || {};
    var ua = !isTargeted(a.company), ub = !isTargeted(b.company);
    if (ua || ub) return ua && ub;
    return sameCompany(a.company, b.company) && sameRole(a.role, b.role);
  }

  // Which of the given companies does the text name (excluding `except`)?
  function otherCompaniesNamed(text, companies, except) {
    var out = [];
    (companies || []).forEach(function (c) {
      if (!isTargeted(c)) return;
      if (except && sameCompany(c, except)) return;
      if (names(text, c) && out.indexOf(c) < 0) out.push(c);
    });
    return out;
  }

  var API = {
    version: VERSION, fold: fold, clean: clean, tokens: tokens, names: names,
    sameCompany: sameCompany, sameRole: sameRole, sameApp: sameApp,
    isUnsolicited: isUnsolicited, isTargeted: isTargeted, otherCompaniesNamed: otherCompaniesNamed
  };
  if (root) root.AntcvCompanyMatch = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
