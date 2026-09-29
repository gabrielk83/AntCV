/* antcv-cv-layout-linear.js — EXEC-LINEAR step 3: the linear CV PREVIEW (plain sections)
 * ============================================================================
 * Spec: docs/design/EXECUTIVE_LINEAR_SPEC_ADDENDUM.md (approved 2026-09-29) + the layout
 * proposal §3.3 UX rule: "Switching to Linear keeps content; it only rewrites loc. Switching
 * back restores the saved two-column map."
 * Store: localStorage['antcv:cvLayout'] = 'linear' | absent (control: antcv-role-line-format.js).
 * Linear:
 *   1. every CV section with loc 'sidebar' moves to 'main', and the CV list is re-ordered in the
 *      addendum order (profile, work style, outcomes, competencies, experience, education,
 *      certificates, tools, then everything else in its old order). The two-column map (order +
 *      loc per id) is saved under 'antcv:cvLayout:twoColMap' first and restored on the way back.
 *   2. body[data-antcv-cv-layout="linear"]: the sidebar column and the column splitter are
 *      hidden and the main column takes the full paper width. Preview pagination measures the
 *      live DOM, so the page boxes follow the wider column.
 * Guard: a generation or cloud restore can write sidebar sections while Linear is on — the
 * sidebar is never hidden while it still holds a section; those sections are re-mapped first.
 * Page model (1.51.4628, live-found 2026-09-29): the paginator's page assignments live in
 * antcv:autoPages / antcv:autoPagesPreview (computed) and antcv:itemPages (manual breaks). Computed
 * for one layout they are WRONG for the other (after a round trip the two-column sidebar was pinned
 * to pages 2-3 and page 1's sidebar was empty). The switch saves them in the map, clears them so the
 * paginator recomputes for the new layout, and restores the saved two-column set on the way back.
 * Letters are untouched (no sidebar). No app.js edit. Kill: antcv:disable-cv-layout-linear=1.
 */
(function () {
  'use strict';
  var VERSION = '1.51.4628-linear-pagemodel';
  if (window.__antcvCvLayoutLinear === VERSION) return;
  window.__antcvCvLayoutLinear = VERSION;

  var KEY = 'antcv:cvLayout', MAP = 'antcv:cvLayout:twoColMap', STYLE_ID = 'antcv-cv-layout-linear-style';
  var PAGE_KEYS = ['antcv:autoPages', 'antcv:autoPagesPreview', 'antcv:itemPages'];
  function pageModelChanged() { try { window.dispatchEvent(new CustomEvent('antcv:item-pages-changed', { detail: { reason: 'cv-layout' } })); } catch (_) {} }
  var ORDER = [
    [/(^|\s)(profile|summary|profil)(\s|$)/, 1], [/work.?style|arbejdsstil/, 2], [/outcome/, 3],
    [/core.?comp|competen|kompetence/, 4], [/(^|\s)experience|erfaring/, 5], [/educat|uddannelse/, 6],
    [/cert|course|kursus/, 7], [/tool|method|skill|expertise|værktøj/, 8],
  ];
  function disabled() { try { var v = localStorage.getItem('antcv:disable-cv-layout-linear'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function isLinear() { try { return localStorage.getItem(KEY) === 'linear'; } catch (_) { return false; } }
  function rank(s) {
    var k = ((s && s.id) || '') + ' ' + ((s && s.title) || '');
    k = k.toLowerCase();
    for (var i = 0; i < ORDER.length; i++) if (ORDER[i][0].test(k)) return ORDER[i][1];
    return 20;
  }
  function readSections() { try { return JSON.parse(localStorage.getItem('sections') || 'null'); } catch (_) { return null; } }
  function writeSections(s, reason) {
    try {
      localStorage.setItem('sections', JSON.stringify(s));
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: reason } }));
    } catch (_) {}
  }

  // 1. sections -> single column in the addendum order (idempotent: writes only on a real change)
  function toLinear() {
    var s = readSections();
    if (!s || !Array.isArray(s.cv) || !s.cv.length) return false;
    var hasSidebar = s.cv.some(function (x) { return x && x.loc === 'sidebar'; });
    if (!hasSidebar) return false;
    try {
      if (!localStorage.getItem(MAP)) {
        var map = { order: [], loc: {}, pages: {} };
        s.cv.forEach(function (x) { if (x && x.id) { map.order.push(x.id); map.loc[x.id] = x.loc || 'main'; } });
        PAGE_KEYS.forEach(function (k) { map.pages[k] = localStorage.getItem(k); });
        localStorage.setItem(MAP, JSON.stringify(map));
      }
      PAGE_KEYS.forEach(function (k) { localStorage.removeItem(k); });
    } catch (_) {}
    var cv = s.cv.map(function (x, i) { return { x: x, i: i, r: rank(x) }; })
      .sort(function (a, b) { return (a.r - b.r) || (a.i - b.i); })
      .map(function (o) {
        if (!o.x || o.x.loc !== 'sidebar') return o.x;
        var c = {}; for (var k in o.x) c[k] = o.x[k]; c.loc = 'main'; return c;
      });
    s.cv = cv;
    writeSections(s, 'cv-layout-linear');
    pageModelChanged();
    return true;
  }
  // back to the saved two-column map (order + loc); sections that did not exist then keep their place at the end
  function toTwoColumn() {
    var raw = null; try { raw = localStorage.getItem(MAP); } catch (_) {}
    if (!raw) return false;
    var m = null; try { m = JSON.parse(raw); } catch (_) {}
    var s = readSections();
    try { localStorage.removeItem(MAP); } catch (_) {}
    if (!m || !s || !Array.isArray(s.cv)) return false;
    var pos = {}; (m.order || []).forEach(function (id, i) { pos[id] = i; });
    var cv = s.cv.map(function (x, i) { return { x: x, i: i, p: (x && x.id in pos) ? pos[x.id] : 1e6 + i }; })
      .sort(function (a, b) { return a.p - b.p; })
      .map(function (o) {
        if (!o.x || !o.x.id || !(o.x.id in (m.loc || {}))) return o.x;
        var c = {}; for (var k in o.x) c[k] = o.x[k]; c.loc = m.loc[o.x.id]; return c;
      });
    s.cv = cv;
    try {
      PAGE_KEYS.forEach(function (k) {
        var v = m.pages ? m.pages[k] : null;
        if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v);
      });
    } catch (_) {}
    writeSections(s, 'cv-layout-two-column');
    pageModelChanged();
    return true;
  }

  // 2. column CSS
  function css(on) {
    try {
      document.body && document.body.setAttribute('data-antcv-cv-layout', on ? 'linear' : 'two_column');
      var st = document.getElementById(STYLE_ID);
      if (!on) { if (st) st.remove(); return; }
      if (!st) { st = document.createElement('style'); st.id = STYLE_ID; document.head.appendChild(st); }
      var P = 'body[data-antcv-cv-layout="linear"] .antcv-preview-paper ';
      st.textContent =
        P + '[data-antcv-document-sidebar]{display:none !important;}' +
        P + '.antcv-col-splitter{display:none !important;}' +
        P + '[data-antcv-document-main]{width:100% !important;max-width:100% !important;flex:1 1 100% !important;}';
    } catch (_) {}
  }
  // the sidebar is only hidden while it is EMPTY - content is never hidden, it is moved first
  function sidebarHoldsContent() {
    try { return !!document.querySelector('.antcv-preview-paper [data-antcv-document-sidebar] [data-sid]'); } catch (_) { return false; }
  }

  var busy = false;
  function apply() {
    if (busy) return;
    busy = true;
    try {
      if (disabled()) { css(false); return; }
      if (isLinear()) {
        toLinear();
        css(!sidebarHoldsContent());
      } else {
        css(false);
        toTwoColumn();
      }
    } finally { busy = false; }
  }
  window.__antcvCvLayoutApply = apply;

  var pending = 0;
  function schedule() { if (pending) return; pending = setTimeout(function () { pending = 0; apply(); }, 200); }
  function start() {
    apply();
    window.addEventListener('storage', function (e) { if (!e || e.key === KEY || e.key === 'sections') schedule(); });
    window.addEventListener('antcv:sections-updated', function (e) {
      var r = e && e.detail && e.detail.reason;
      if (r === 'cv-layout-linear' || r === 'cv-layout-two-column') { setTimeout(function () { css(isLinear() && !disabled() && !sidebarHoldsContent()); }, 350); return; }
      schedule();
    });
    // generations / restores that re-render the preview with sidebar sections while Linear is on
    try {
      new MutationObserver(function () { if (isLinear() && !disabled() && sidebarHoldsContent()) schedule(); })
        .observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
