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
 * Tables (1.51.4686, owner 2026-09-30 "implement the tables for linear"): each preview section is
 * mapped to the SAME kind the linear export uses (docx-worker buildLinearCvDocument kind()), and
 * CSS keyed by section id draws the addendum blocks - competency table -> 3 tiles
 * per row, tools -> 2 tiles per row, education -> 2 columns, the remaining small sections ->
 * label | content details rows. CSS only, so React keeps owning the DOM.
 * 1.51.4706 (owner 2026-09-30): the profile + work-style rows sit in one tinted callout box, the
 * details rows get ONE heading ("Languages, Interests & ..." - the export's first four labels), and
 * certificates render as a full-width "Certificates & courses: a • b • c" row under education.
 * 1.51.4726 (owner 2026-09-30): LINEAR-MERGE-001 - a grid's last row with fewer items than columns
 * merges the last item with the empty space to its right (tiles, tool tiles, education columns).
 * LINEAR-DETAILS-STRUCTURE-001 - publications and long sections (more than 6 rows) are their own
 * blocks under their own heading; only short one-liners stay in the details table, whose heading
 * is "A & B" for up to two labels, else "Additional Details". Same rules in the docx-worker.
 * 1.51.4813 (owner 2026-10-05 "this can be split to more than one table"): LINEAR-DETAILS-GROUPS-001 -
 * the details one-liners form one table PER THEME (credentials; languages & personal; availability &
 * references, which also takes anything unmatched), each under its own heading: the label for a
 * one-row table, else the theme name. Same rules in the docx-worker.
 * 1.51.4873 (owner 2026-10-05 rule sheet, CV_Veo_Director_enriched.pdf): LINEAR-DETAILS-ENRICHED-001 - every table
 * carries its theme name (CREDENTIALS / LANGUAGES & PERSONAL / AVAILABILITY & REFERENCES), a one-row table too;
 * courses/certificates are a CREDENTIALS row (no longer a row under Education) and a stand-alone patent section is
 * a CREDENTIALS row (publications stay a block); rows inside a table keep the enriched order (DETAIL_RANK). The
 * export adds the "(Cont.)" experience heading + page break (LINEAR-CONT-001, docx-worker). Same rules in the worker.
 * Letters are untouched (no sidebar). No app.js edit. Kill: antcv:disable-cv-layout-linear=1.
 */
(function () {
  'use strict';
  var VERSION = '1.51.4873-linear-enriched';
  if (window.__antcvCvLayoutLinear === VERSION) return;
  window.__antcvCvLayoutLinear = VERSION;

  var KEY = 'antcv:cvLayout', MAP = 'antcv:cvLayout:twoColMap', STYLE_ID = 'antcv-cv-layout-linear-style';
  var PAGE_KEYS = ['antcv:autoPages', 'antcv:autoPagesPreview', 'antcv:itemPages'];
  // After a switch the paginator (antcv-auto-pagebreak-block-001.js) must recompute for the new column
  // geometry: AntcvAutoPagebreak.run() clears its source-fingerprint gate and schedules a pass (else it
  // waits for its 3 s poll). Its pass runs on requestAnimationFrame - it proceeds once the tab is visible.
  function pageModelChanged() {
    try { window.dispatchEvent(new CustomEvent('antcv:item-pages-changed', { detail: { reason: 'cv-layout' } })); } catch (_) {}
    try { if (window.AntcvAutoPagebreak && typeof window.AntcvAutoPagebreak.run === 'function') setTimeout(function () { window.AntcvAutoPagebreak.run(); }, 400); } catch (_) {}
  }
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
  // LINEAR-DETAILS-STRUCTURE-001 + LINEAR-DETAILS-GROUPS-001: the details one-liners sit at the end,
  // as in the export, grouped by theme (stable inside a group). Every other section keeps the owner's
  // order. Idempotent - writes only when the order changes. Two-column restores the saved map order,
  // so this never leaks into the two-column layout.
  function detailsLast() {
    var s = readSections();
    if (!s || !Array.isArray(s.cv) || s.cv.length < 2) return false;
    var isD = s.cv.map(function (x) { return !!x && !!x.type && isDetailsKind(linKind(x)); });
    var d = s.cv.map(function (x, j) { return { x: x, j: j }; }).filter(function (o) { return isD[o.j]; })
      .sort(function (a, b) { return (detailGroup(a.x) - detailGroup(b.x)) || (detailRank(a.x) - detailRank(b.x)) || (a.j - b.j); })
      .map(function (o) { return o.x; });
    var cv = s.cv.filter(function (_, j) { return !isD[j]; }).concat(d);
    if (cv.every(function (x, j) { return x === s.cv[j]; })) return false;
    s.cv = cv;
    writeSections(s, 'cv-layout-linear-details');
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

  // 2a. section kinds - a port of the docx-worker linear kind() so preview and export agree
  function linKind(s) {
    if (!s) return 'details';
    var k = ((s.id || '') + ' ' + (s.title || '')).toLowerCase(), t = s.type;
    if (t === 'experience') return 'experience';
    if (t === 'education') return /educat|uddannelse|degree|academ/.test(k) ? 'education' : detailsOrBlock(s, k);
    if (t === 'table') return 'tiles';
    if (/cert|course|credential|licen/.test(k)) return 'certs';
    if ((t === 'labeled_list' || t === 'rich_block') && /tool|method|skill|technical|arsenal|expertise|stack/.test(k)) return 'tools';
    if ((t === 'bullets' || t === 'text_bullets') && !/profile|summary|work.?style/.test(k)) return 'bullets';
    if (/profile|summary|about|work.?style|arbejdsstil|profil|who i am/.test(k) &&
        /^(text|text_inline|text_bullets|rich_block|foundation|bullets)$/.test(t)) return 'profile';
    return detailsOrBlock(s, k);
  }
  // a details row holds a one-liner; publications and long sections keep their own heading and list
  var BLOCK_MIN_ROWS = 7;
  function rowCount(s) {
    if (Array.isArray(s.items)) return s.items.filter(function (x) { return x && !x.grp && !x.hr; }).length;
    if (Array.isArray(s.rows)) return s.rows.length;
    return s.content ? 1 : 0;
  }
  // LINEAR-DETAILS-ENRICHED-001: a stand-alone patent section is a Credentials row; publications stay a block
  function detailsOrBlock(s, k) {
    if (/(^|\s)pubs?(\s|$)|publica|publikation/.test(k)) return 'block';
    return rowCount(s) >= BLOCK_MIN_ROWS ? 'block' : 'details';
  }
  // the details tables hold the one-liners AND the courses/certificates row (a CREDENTIALS row since 1.51.4873)
  function isDetailsKind(k) { return k === 'details' || k === 'certs'; }
  window.__antcvCvLinearKind = linKind;
  // LINEAR-DETAILS-GROUPS-001: theme of a details one-liner -> one table per theme, in this order.
  // Anything unmatched (availability, permit, location, references, ...) lands in the last table.
  // Mirrors the docx-worker DETAIL_GROUPS.
  var DETAIL_GROUPS = [
    [/standard|cert|course|kursus|licen|patent|award|honou?r|membership|clearance/, 'Credentials', 'Kvalifikationer'],
    [/language|sprog|interest|interesse|hobb|rugby|sport|volunt|frivillig|access|personal|personlig/, 'Languages & Personal', 'Sprog & personligt'],
    [null, 'Availability & References', 'Tilgængelighed & referencer'],
  ];
  var OTHER_GROUP = 2;
  function detailGroup(s) {
    var k = (((s && s.id) || '') + ' ' + ((s && s.title) || '')).toLowerCase();
    for (var i = 0; i < DETAIL_GROUPS.length; i++) if (DETAIL_GROUPS[i][0] && DETAIL_GROUPS[i][0].test(k)) return i;
    return OTHER_GROUP;
  }
  window.__antcvCvLinearDetailGroup = detailGroup;
  // LINEAR-DETAILS-ENRICHED-001: row order inside a theme table - Standards, Courses, Patent / Languages, Rugby,
  // Interests, Accessibility / Availability, References; unmatched rows follow in stored order. Mirrors the worker.
  var DETAIL_RANK = [
    [/standard/, /cert|course|kursus|licen/, /patent/],
    [/language|sprog/, /rugby|sport|volunt|frivillig/, /interest|interesse|hobb/, /access|tilg/],
    [/avail|tilg/, /refer|recommend|anbefal/],
  ];
  function detailRank(s) {
    var k = (((s && s.id) || '') + ' ' + ((s && s.title) || '')).toLowerCase(), g = detailGroup(s);
    for (var i = 0; i < DETAIL_RANK[g].length; i++) if (DETAIL_RANK[g][i].test(k)) return i;
    return DETAIL_RANK[g].length;
  }
  window.__antcvCvLinearDetailRank = detailRank;
  // the export's tile/details bar colour: style.accent, else the heading colour
  function accent() {
    try {
      var sc = JSON.parse(localStorage.getItem('styleConfig') || '{}') || {};
      if (/^#?[0-9a-f]{6}$/i.test(String(sc.accent || ''))) return '#' + String(sc.accent).replace(/^#/, '');
      if (/^#?[0-9a-f]{6}$/i.test(String(sc.mainHeadColor || ''))) return '#' + String(sc.mainHeadColor).replace(/^#/, '');
    } catch (_) {}
    return '#0369A1';
  }
  // CSS keyed by section id: the preview re-renders (and replaces) section nodes about once a second,
  // so attributes set on them flicker; selectors built from the stored sections never do.
  function kindsById() {
    var s = readSections(), out = {};
    ((s && s.cv) || []).forEach(function (x) { if (x && x.id) out[x.id] = linKind(x); });
    return out;
  }
  function cssId(id) { return String(id).replace(/["\\]/g, '\\$&'); }
  // export titleCase (docx-worker buildLinearCvDocument): "LANGUAGES & ACCESSIBILITY" -> "Languages & Accessibility"
  function titleCase(t) { return String(t || '').trim().toLowerCase().replace(/(^|[\s(&/-])([a-zæøåéü])/g, function (m, a, b) { return a + b.toUpperCase(); }); }
  // one heading per details table, as the export builds it: the theme name, a one-row table too
  // (LINEAR-DETAILS-ENRICHED-001). Returns [{ id: first visible section of the table, text, group }].
  function detailsHeadings() {
    var s = readSections(), groups = {};
    ((s && s.cv) || []).forEach(function (x) {
      if (!x || !x.id || x.on === false || !isDetailsKind(linKind(x))) return;
      var g = detailGroup(x);
      if (!groups[g]) groups[g] = { id: x.id, group: g };
    });
    var da = cvLang() === 'da';
    return Object.keys(groups).map(Number).sort(function (a, b) { return a - b; }).map(function (g) {
      return { id: groups[g].id, text: DETAIL_GROUPS[g][da ? 2 : 1], group: g };
    });
  }
  function cvLang() {
    try { return String(localStorage.getItem('language') || '').replace(/[^a-z]/gi, '').slice(0, 2).toLowerCase(); } catch (_) { return ''; }
  }
  function headStyle() {
    try {
      var sc = JSON.parse(localStorage.getItem('styleConfig') || '{}') || {};
      var ok = function (v) { return /^#?[0-9a-f]{6}$/i.test(String(v || '')) ? '#' + String(v).replace(/^#/, '') : ''; };
      return { color: ok(sc.mainHeadColor) || '#0369A1', font: String(sc.mainHeadFont || 'Trebuchet MS').replace(/["\\;{}]/g, '') };
    } catch (_) { return { color: '#0369A1', font: 'Trebuchet MS' }; }
  }

  // 2. column CSS
  function css(on) {
    try {
      document.body && document.body.setAttribute('data-antcv-cv-layout', on ? 'linear' : 'two_column');
      var st = document.getElementById(STYLE_ID);
      if (!on) { if (st) st.remove(); return; }
      if (!st) { st = document.createElement('style'); st.id = STYLE_ID; document.head.appendChild(st); }
      var P = 'body[data-antcv-cv-layout="linear"] .antcv-preview-paper ';
      var text =
        P + '[data-antcv-document-sidebar]{display:none !important;}' +
        P + '.antcv-col-splitter{display:none !important;}' +
        P + '[data-antcv-document-main]{width:100% !important;max-width:100% !important;flex:1 1 100% !important;}' +
        tableCss(P + '[data-antcv-document-main] > ', kindsById(), accent(), detailsHeadings(), headStyle());
      if (st.textContent !== text) st.textContent = text;
    } catch (_) {}
  }
  // 2b. addendum table blocks (10 pt = 13.33 px, 9.5 pt = 12.67 px; fills and hairlines as the export)
  function tableCss(M, kinds, A, heads, hs) {
    var ids = { tiles: [], tools: [], education: [], details: [], profile: [], certs: [] };
    Object.keys(kinds).forEach(function (id) { if (ids[kinds[id]]) ids[kinds[id]].push(id); });
    // rule(kind, suffix, body): one selector per section id of that kind
    function rule(kind, suffix, body) {
      if (!ids[kind].length) return '';
      return ids[kind].map(function (id) { return M + '[data-sid="' + cssId(id) + '"]' + suffix; }).join(',') + '{' + body + '}';
    }
    var HEAD = ' > :first-child:not([data-antcv-row-path])', ROW = '[data-antcv-row-path]:not([data-antcv-group-head])';
    // rows of one table join (no double hairline); tables of different themes stay apart
    var grp = {}; ((readSections() || {}).cv || []).forEach(function (x) { if (x && x.id) grp[x.id] = detailGroup(x); });
    var adj = [], tbl = ids.details.concat(ids.certs);
    tbl.forEach(function (x) { tbl.forEach(function (y) { if (x !== y && grp[x] === grp[y]) adj.push(M + '[data-sid="' + cssId(x) + '"] + [data-sid="' + cssId(y) + '"]'); }); });
    return '' +
      // competency table -> 3 equal tiles per row; header row dropped, no line clamp
      rule('tiles', ' [data-table-resize-wrap] > :not(table)', 'display:none !important;') +
      rule('tiles', ' table', 'border:none !important;border-collapse:separate !important;') +
      rule('tiles', ' thead', 'display:none !important;') +
      rule('tiles', ' tbody', 'display:grid !important;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;') +
      // LINEAR-MERGE-001: a short last row - the last tile takes the empty space to its right
      rule('tiles', ' tbody tr:last-child:nth-child(3n+1)', 'grid-column:1 / -1 !important;') +
      rule('tiles', ' tbody tr:last-child:nth-child(3n+2)', 'grid-column:span 2 !important;') +
      rule('tiles', ' tbody tr', 'display:flex !important;flex-direction:column;background:#F1F5F9 !important;border-left:2pt solid ' + A + ';padding:7px 8px;text-align:left !important;') +
      rule('tiles', ' tbody td', 'display:block !important;border:none !important;padding:0 !important;background:transparent !important;font-size:13.33px !important;text-align:left !important;vertical-align:top !important;') +
      rule('tiles', ' tbody td:first-child', 'font-weight:700 !important;color:#0F172A !important;margin-bottom:2px;') +
      rule('tiles', ' tbody td:last-child', 'color:#475569 !important;') +
      rule('tiles', ' tbody td > div', 'display:block !important;-webkit-line-clamp:unset !important;max-height:none !important;text-align:left !important;line-height:1.1 !important;') +
      // tools -> 2 tiles per row (the export drops the group heads too)
      rule('tools', '', 'display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;') +
      rule('tools', HEAD, 'grid-column:1 / -1;') +
      rule('tools', ' > ' + ROW + ':nth-last-child(1 of ' + ROW + '):nth-child(odd of ' + ROW + ')', 'grid-column:1 / -1 !important;') +
      rule('tools', ' > [data-antcv-group-head]', 'display:none !important;') +
      rule('tools', ' > [data-antcv-row-path]', 'margin:0 !important;background:#F8FAFC;border-left:2pt solid ' + A + ';padding:5px 6px;font-size:12.67px !important;line-height:1.1 !important;color:#475569 !important;text-align:left !important;') +
      rule('tools', ' > [data-antcv-row-path] > span:first-child', 'display:block;color:#0F172A !important;margin-bottom:1px;') +
      // education -> 2 columns, no fill, no borders
      rule('education', '', 'display:grid !important;grid-template-columns:repeat(2,minmax(0,1fr));column-gap:14px;') +
      rule('education', HEAD, 'grid-column:1 / -1;') +
      rule('education', ' > ' + ROW + ':nth-last-child(1 of ' + ROW + '):nth-child(odd of ' + ROW + ')', 'grid-column:1 / -1 !important;') +
      // details -> label | content rows: tinted label cell with the accent bar, hairline frame
      rule('details', '', 'display:grid !important;grid-template-columns:127px minmax(0,1fr);margin-bottom:0 !important;border:0.5pt solid #E2E8F0;border-left:none;') +
      (heads || []).map(function (dh) {
        return M + '[data-sid="' + cssId(dh.id) + '"]{border-top:none;margin-top:10px;}' +
        M + '[data-sid="' + cssId(dh.id) + '"]::before{content:"' + cssStr(dh.text.toUpperCase()) + '";grid-column:1 / -1;grid-row:1;display:block;' +
          'font-family:"' + hs.font + '",Arial,sans-serif;font-weight:700;font-size:15px;letter-spacing:0.5px;line-height:1;color:' + hs.color + ';' +
          'padding-bottom:3px;margin-bottom:0;border-bottom:1.5pt solid #777777;}' +
        M + '[data-sid="' + cssId(dh.id) + '"]' + HEAD + '{grid-row:2 / span 40 !important;}';
      }).join('') +
      (adj.length ? adj.join(',') + '{border-top:none;}' : '') +
      rule('details', HEAD, 'grid-column:1;grid-row:1 / span 40;margin:0 !important;background:#F8FAFC;border-left:2pt solid ' + A + ';padding:3px 6px;') +
      rule('details', HEAD + ' [data-antcv-section-headline]', 'font-size:12.67px !important;color:#0F172A !important;letter-spacing:0 !important;text-transform:lowercase !important;line-height:1.15 !important;') +
      rule('details', HEAD + ' [data-antcv-section-headline]::first-letter', 'text-transform:uppercase;') +
      rule('details', HEAD + ' > :not([data-antcv-section-headline])', 'display:none !important;') +
      rule('details', ' > [data-antcv-row-path]', 'grid-column:2;margin:0 !important;padding:2px 6px !important;font-size:12.67px !important;line-height:1.1 !important;text-align:left !important;') +
      rule('details', ' > [data-antcv-row-path] *', 'font-size:inherit !important;') +
      // profile + work style -> one tinted callout box: light fill, accent bar left, hairline frame.
      // Rows carry the box (the section headline stays outside it); adjacent profile sections join.
      rule('profile', ' > [data-antcv-row-path]', 'background:#F8FAFC !important;border-left:3pt solid ' + A + ' !important;border-right:0.5pt solid #E2E8F0;margin:0 !important;padding:2px 12px !important;') +
      rule('profile', HEAD + ' + [data-antcv-row-path]', 'border-top:0.5pt solid #E2E8F0;padding-top:8px !important;') +
      rule('profile', ' > [data-antcv-row-path]:first-child', 'border-top:0.5pt solid #E2E8F0;padding-top:8px !important;') +
      rule('profile', ' > [data-antcv-row-path]:last-child', 'border-bottom:0.5pt solid #E2E8F0;padding-bottom:8px !important;') +
      (adjOf('profile').length ? adjOf('profile').map(function (p) { return p[0] + ':has(+ ' + p[1] + ')'; }).join(',') + '{margin-bottom:0 !important;}' +
        adjOf('profile').map(function (p) { return p[0] + ':has(+ ' + p[1] + ') > [data-antcv-row-path]:last-child'; }).join(',') + '{border-bottom:none;padding-bottom:2px !important;}' +
        adjOf('profile').map(function (p) { return p[0] + ' + ' + p[1] + ' > [data-antcv-row-path]:first-child'; }).join(',') + '{border-top:none;padding-top:2px !important;}' : '') +
      // certificates -> a CREDENTIALS row (LINEAR-DETAILS-ENRICHED-001): the label cell on the left, the items
      // flowing as one run joined by " • " in the content column. Flex (not grid) so the items wrap like text:
      // the label is pulled into the left padding, later lines start at the content column.
      rule('certs', '', 'display:flex !important;flex-wrap:wrap;align-items:stretch;margin:0 !important;padding:0 6px 0 127px;border:0.5pt solid #E2E8F0;border-left:none;text-align:left !important;') +
      rule('certs', '::before', 'flex:0 0 calc(100% + 133px);margin-left:-127px;margin-right:-6px;') +
      rule('certs', HEAD, 'display:block !important;flex:0 0 127px;margin:0 0 0 -127px !important;background:#F8FAFC;border-left:2pt solid ' + A + ';padding:3px 6px;') +
      rule('certs', HEAD + ' [data-antcv-section-headline]', 'display:block !important;font-family:inherit !important;font-size:12.67px !important;color:#0F172A !important;letter-spacing:0 !important;text-transform:lowercase !important;line-height:1.15 !important;') +
      rule('certs', HEAD + ' [data-antcv-section-headline]::first-letter', 'text-transform:uppercase;') +
      rule('certs', HEAD + ' > :not([data-antcv-section-headline])', 'display:none !important;') +
      rule('certs', ' > [data-antcv-row-path]', 'flex:0 1 auto;min-width:0;margin:0 !important;padding:2px 0 2px 6px !important;font-size:12.67px !important;line-height:1.1 !important;color:#475569 !important;') +
      rule('certs', ' > [data-antcv-row-path] *', 'font-size:inherit !important;display:inline !important;') +
      rule('certs', ' > [data-antcv-row-path]:not(:last-child)::after', 'content:"  \\2022  ";white-space:pre;color:#94A3B8;');
    // [prev (full selector), next (bare [data-sid])] pairs of two sections of the same kind, for the joins above
    function adjOf(kind) {
      var out = [];
      ids[kind].forEach(function (x) { ids[kind].forEach(function (y) { if (x !== y) out.push([M + '[data-sid="' + cssId(x) + '"]', '[data-sid="' + cssId(y) + '"]']); }); });
      return out;
    }
  }
  function cssStr(t) { return String(t).replace(/["\\]/g, '\\$&').replace(/[\r\n]+/g, ' '); }
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
        var wrote = toLinear();
        if (!wrote) wrote = detailsLast();
        var stale = sidebarHoldsContent();
        if (stale && !wrote) resync();
        css(!stale);
      } else {
        css(false);
        toTwoColumn();
      }
    } finally { busy = false; }
  }
  window.__antcvCvLayoutApply = apply;

  // LINEAR-RESYNC-001 (1.51.4706, live-found 2026-09-30): storage already holds the linear sections
  // but the preview renders an older in-memory copy with sidebar sections (boot hydration from a
  // snapshot; a sections-update storm used to mask it by re-applying storage many times a second).
  // One forced sections-updated ('standalone' bypasses the app's same-signature early return) makes
  // the app re-read storage. Bounded: at most one per 1.5 s and 5 per page load - never a storm.
  var resyncs = 0, lastResync = 0;
  function resync() {
    var now = Date.now();
    if (resyncs >= 5 || now - lastResync < 1500) return;
    resyncs++; lastResync = now;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cv-layout-linear-resync standalone' } })); } catch (_) {}
  }

  var pending = 0;
  function schedule() { if (pending) return; pending = setTimeout(function () { pending = 0; apply(); }, 200); }
  function start() {
    apply();
    window.addEventListener('storage', function (e) { if (!e || e.key === KEY || e.key === 'sections') schedule(); });
    window.addEventListener('antcv:sections-updated', function (e) {
      var r = e && e.detail && e.detail.reason;
      if (/^cv-layout-(linear|two-column)/.test(String(r || ''))) { setTimeout(function () { css(isLinear() && !disabled() && !sidebarHoldsContent()); }, 350); return; }
      schedule();
    });
    // generations / restores that re-render the preview with sidebar sections while Linear is on
    try {
      new MutationObserver(function () {
        if (!isLinear() || disabled()) return;
        if (sidebarHoldsContent()) schedule();
      })
        .observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
