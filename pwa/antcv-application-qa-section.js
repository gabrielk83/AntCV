/* antcv-application-qa-section.js — APPLICATION-QA-001 P1 (owner 2026-06-22)
 * ============================================================================
 * Some job postings include specific QUESTIONS the applicant must answer as part of the package.
 * When that happens, the cover letter gets an EXTRA PAGE: a candidate header line + a rich_block of
 * the questions and short-paragraph answers grounded in the candidate's experience.
 *
 * This is P1 — the SECTION SCAFFOLD (see docs/plan/CL_APPLICATION_QA_2026-06-22.md). It renders the
 * page from a data source, `localStorage['antcv:applicationQuestions']` (a JSON array of
 * { question, answer } — `q`/`a` aliases accepted), which P2 (JD-analysis detection) and P3
 * (answer generation) will populate. Owner design (confirmed): extra page IN the CL; candidate
 * header = "<Name> - <role>. Responses to your application questions:"; short-paragraph answers.
 *
 * Behaviour:
 *  - When the source is non-empty: ensure a CL section
 *    { id:'application_qa', type:'rich_block', loc:'main', pageBreakBefore:true,
 *      items:[ {grp:true,t:<candidate header>}, {b:<Q>,t:<A>}, … ] } exists after `closure`, and
 *    keep its Q&A rows in sync with the source (the candidate header + any owner-added rows survive).
 *  - When the source is empty: HIDE the section (on:false) rather than delete — so the owner never
 *    loses manual edits, and it simply doesn't render on a normal CL.
 *  - Idempotent + restore-stable (re-runs on antcv:sections-updated + a few delays). CL only.
 *  - Self-disabling on any error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.778';
  if (window.__antcvApplicationQa === VERSION) return;
  window.__antcvApplicationQa = VERSION;

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function readPI() {
    try { var v = JSON.parse(localStorage.getItem('personalInfo') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function readQuestions() {
    try {
      var v = JSON.parse(localStorage.getItem('antcv:applicationQuestions') || '[]');
      if (!Array.isArray(v)) return [];
      return v.map(function (it) {
        if (typeof it === 'string') return { question: it, answer: '' };
        if (it && typeof it === 'object') return { question: String(it.question != null ? it.question : (it.q || '')), answer: String(it.answer != null ? it.answer : (it.a || '')) };
        return null;
      }).filter(function (x) { return x && x.question.trim(); });
    } catch (_) { return []; }
  }
  function candidateHeader() {
    var pi = readPI();
    var name = String(pi.name || '').trim();
    var role = String(pi.headline || '').split(/[|,–—-]/)[0].trim();   // first clause of the headline
    var who = [name, role].filter(Boolean).join(' - ');
    return (who ? who + '. ' : '') + 'Responses to your application questions:';
  }

  function buildItems(qs) {
    var items = [{ grp: true, t: candidateHeader() }];
    qs.forEach(function (qa) { items.push({ b: qa.question, t: qa.answer }); });
    return items;
  }
  function isHeaderRow(it) { return it && it.grp && /responses to your application questions/i.test(String(it.t || '')); }

  function run() {
    try {
      var secs = readSections();
      if (!Array.isArray(secs.cl)) return;
      var qs = readQuestions();
      var idx = secs.cl.findIndex(function (s) { return s && s.id === 'application_qa'; });
      var changed = false;

      if (!qs.length) {
        // No questions → hide the section if present (never delete; preserve manual edits).
        if (idx >= 0 && secs.cl[idx].on !== false) { secs.cl[idx] = Object.assign({}, secs.cl[idx], { on: false }); changed = true; }
        if (!changed) return;
      } else {
        var items = buildItems(qs);
        if (idx < 0) {
          var sec = { id: 'application_qa', title: 'APPLICATION QUESTIONS', loc: 'main', on: true,
            type: 'rich_block', leadBold: true, pageBreakBefore: true, items: items };
          // place AFTER closure (last), so it's the final extra page.
          var ci = secs.cl.findIndex(function (s) { return s && s.id === 'closure'; });
          if (ci >= 0) secs.cl.splice(ci + 1, 0, sec); else secs.cl.push(sec);
          changed = true;
        } else {
          var cur = secs.cl[idx];
          // sync: rebuild header + Q/A rows from the source, but KEEP any extra owner-added rows
          // that are not the header and not part of the generated Q&A (defensive: none by default).
          var nextItems = items.slice();
          var sameLen = Array.isArray(cur.items) && cur.items.length === nextItems.length;
          var same = sameLen && cur.items.every(function (it, i) {
            var n = nextItems[i];
            return !!it && !!n && (it.grp ? (n.grp && it.t === n.t) : (it.b === n.b && it.t === n.t));
          });
          if (!same || cur.on === false || cur.type !== 'rich_block' || !cur.pageBreakBefore) {
            secs.cl[idx] = Object.assign({}, cur, { type: 'rich_block', on: true, leadBold: true, pageBreakBefore: true, items: nextItems });
            changed = true;
          }
        }
      }

      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'application-qa' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  // also re-run when the question source changes in this or another tab.
  window.addEventListener('storage', function (e) { if (e && e.key === 'antcv:applicationQuestions') run(); });
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvApplicationQa = { version: VERSION, run: run, _header: candidateHeader };
})();
