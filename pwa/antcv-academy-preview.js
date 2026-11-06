/* antcv-academy-preview.js — ACADEMY-EMPTY-001, preview half (owner 2026-11-06)
 * ============================================================================
 * Owner on a margin-layout preview: "go to academy rule. notice that you lest sub
 * headings empty on application". The preview showed TOOLS & METHODS, CERTIFICATES
 * & COURSES and REGULATORY CONTEXT headings with no rows, "[Language]: [level]"
 * rows, the skeleton's ADDITIONAL INFORMATION instruction, and, under Anita
 * Myre-Kornfeldt's name, the owner's education rows and Communication line.
 *
 * The house CV (pkgs_1050/1051) has no heading without real content and no
 * template text. The export gets that from antcv-academy-format.js apply() in
 * buildPayload; this file gives the PREVIEW the same result from the same rules
 * (AntcvAcademyFormat.plan): it HIDES DOM nodes inside .antcv-preview-paper
 * (display:none + data-antcv-af-hide) and NEVER writes storage or dispatches
 * events, so it cannot join a sections-updated storm. Stored sections stay as
 * they are; the editor panel still lists every row.
 *
 * Scope: the CV preview in the margin layout (body[data-antcv-cv-margin="1"]).
 * A blank template (fewer than 3 sections with real content) is left alone so a
 * new document still shows its skeleton. Kill: antcv:disable-academy-format=1.
 */
(function () {
  'use strict';
  var VERSION = '1.51.6205-academy-pages';
  if (window.__antcvAcademyPreview === VERSION) return;
  window.__antcvAcademyPreview = VERSION;

  var MARK = 'data-antcv-af-hide';
  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function str(k) { var v = readJSON(k); return typeof v === 'string' ? v : String(localStorage.getItem(k) || ''); }
  function active() {
    try {
      if (localStorage.getItem('antcv:disable-academy-format') === '1') return false;
      if (!document.body || document.body.getAttribute('data-antcv-cv-margin') !== '1') return false;
      if ((str('doc') || 'cv') !== 'cv') return false;
      return !!(window.AntcvAcademyFormat && typeof window.AntcvAcademyFormat.plan === 'function');
    } catch (_) { return false; }
  }
  function norm(t) { return String(t || '').toLowerCase().replace(/[^0-9a-zà-ÿæøå]+/g, ' ').trim(); }
  function hide(el, why) { if (el.getAttribute(MARK) !== why) { el.setAttribute(MARK, why); el.style.setProperty('display', 'none', 'important'); } }
  function unhide(el) { el.removeAttribute(MARK); el.style.removeProperty('display'); }

  // smallest element under `root` whose text holds the whole row text
  function rowNode(root, key) {
    var best = null, bestLen = Infinity;
    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.closest('[data-antcv-section-headline]')) continue;
      var t = norm(el.textContent);
      if (t.length >= key.length && t.length < bestLen && t.indexOf(key) >= 0) { best = el; bestLen = t.length; }
    }
    return best;
  }

  function secEls(id) {
    return document.querySelectorAll('.antcv-preview-paper [data-sid="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
  }
  // Hide what `plan` names ({ sections: [id], rows: { id: [text] } }); bring back anything this
  // file hid earlier that the plan no longer names. Returns the count of hidden nodes.
  function applyPlan(plan) {
    var want = [];
    (plan.sections || []).forEach(function (id) {
      var els = secEls(id);
      for (var i = 0; i < els.length; i++) { hide(els[i], 'section'); want.push(els[i]); }
    });
    Object.keys(plan.rows || {}).forEach(function (id) {
      var els = secEls(id);
      plan.rows[id].forEach(function (text) {
        var key = norm(text);
        if (key.length < 3) return;
        for (var i = 0; i < els.length; i++) {
          var n = rowNode(els[i], key);
          if (n && n !== els[i]) { hide(n, 'row'); want.push(n); }
        }
      });
    });
    var now = document.querySelectorAll('.antcv-preview-paper [' + MARK + ']');
    for (var w = 0; w < now.length; w++) if (want.indexOf(now[w]) < 0) unhide(now[w]);
    return want.length;
  }

  var lastSig = '';
  function run() {
    try {
      var papers = document.querySelectorAll('.antcv-preview-paper');
      var mine = document.querySelectorAll('.antcv-preview-paper [' + MARK + ']');
      if (!active()) { for (var u = 0; u < mine.length; u++) unhide(mine[u]); lastSig = ''; return; }
      var secs = readJSON('sections');
      var cv = secs && Array.isArray(secs.cv) ? secs.cv : null;
      if (!cv || !papers.length) return;
      var pi = readJSON('personalInfo') || {};
      var p = pi.personalInfo || pi;
      var lang = (str('language') || 'en').replace(/[^a-z]/gi, '').slice(0, 2).toLowerCase();
      var plan = window.AntcvAcademyFormat.plan(cv, { lang: lang, name: p.name || '', personalInfo: p });
      var live = cv.filter(function (s) { return s && s.on !== false; }).length;
      if (live - plan.sections.length < 3) { for (var v = 0; v < mine.length; v++) unhide(mine[v]); return; }   // blank template
      applyPlan(plan);
      var sig = plan.sections.join(',') + '|' + JSON.stringify(plan.rows);
      if (sig !== lastSig) {
        lastSig = sig;
        if (plan.notes.length) console.info('[ACADEMY-EMPTY-001] preview: ' + plan.notes.join(' | '));
      }
    } catch (_) { /* never break the preview */ }
  }

  var timer = 0;
  function soon() { if (timer) return; timer = setTimeout(function () { timer = 0; run(); }, 120); }
  function start() {
    try {
      // React re-renders replace nodes: watch structure + text, not attributes (our own writes)
      new MutationObserver(soon).observe(document.body, { childList: true, subtree: true, characterData: true });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', soon);
    soon();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.AntcvAcademyPreview = { version: VERSION, run: run, applyPlan: applyPlan };
})();
