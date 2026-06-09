/* AntCV auto page-break (block-level) sidecar — v1.50.269
 * ============================================================
 * Owner feature AUTO-PAGEBREAK-BLOCK-001 (FEATURES_REGISTRY).
 *
 * ARCHITECTURE PIVOT (1.50.268)
 * -----------------------------
 * v1.50.262–267 MOVED DOM nodes between page-rows to paginate. That
 * is fundamentally incompatible with the React preview, which
 * re-renders on every scroll frame (the vertical-roller's onScroll
 * does setState). React rebuilds its owned DOM, finds the content
 * nodes we relocated, and the two fight — producing the "salmon
 * blinks twice then text disappears at the bottom" corruption the
 * owner reported on 2026-06-07.
 *
 * The app ALREADY has the correct channel:
 *   - antcv:autoPages — a SEPARATE { sid: { itemIndex: page } } map
 *     for AUTOMATIC breaks (distinct from manual antcv:itemPages).
 *   - __antcvEffBucket(sid) = per-key max(manual, auto). The native
 *     React pagination engine (CV sidebar/main flatMap page-box
 *     split + CL __antcvBreaks) reads the effective bucket and
 *     paginates IN React — drawing the salmon, the "(CONT.)" header,
 *     and the page-boxes natively, with NO DOM fighting.
 *   - antcv:auto-pages-changed — a loop-safe re-render trigger
 *     (app.src.js:12977, rAF + snapshot-dedup).
 *
 * So this sidecar is now a pure MEASURER: it detects which item /
 * group / table-row a section overflows at, snaps to a group
 * boundary, and writes antcv:autoPages. It NEVER touches the
 * rendered DOM. React owns the DOM end to end → scroll re-renders
 * are harmless → no blink, no disappearing text.
 *
 * This supersedes the stood-down antcv-auto-overflow-362 (which is
 * removed from index.html in the same release so the two don't
 * fight over antcv:autoPages).
 *
 * Loop-safety (auto-pagination is measure → break → re-measure):
 *  (a) STICKY — once a section has an auto break, we don't re-measure
 *      it (a broken column is short again; re-measuring would clear
 *      the break → re-merge → overflow → oscillate). Group snapping
 *      uses the DATA MODEL (sections[].items[].group), which is
 *      stable regardless of current pagination.
 *  (b) CHANGE-ONLY WRITE — only write + pulse when the computed map
 *      differs from what's stored (JSON snapshot).
 *  (c) rAF + debounce coalescing.
 *  (d) CIRCUIT BREAKER — back off if we somehow write too often.
 *  (e) try/catch throughout; strict no-op when nothing overflows.
 *
 * Scope (1.50.268): sidebar sections (labeled_list / list / education
 * incl. hidden groups) + main non-experience sections + tables
 * (CORE COMPETENCIES / "What I bring"). EXPERIENCE uses the native
 * role.page path (not itemPages/autoPages) — its auto-pagination is
 * a tracked follow-up.
 */
(function () {
  'use strict';

  var VERSION = '1.50.337-salmon-churn-revert';
  if (window.__antcvAutoPagebreakInstalled === VERSION) return;
  window.__antcvAutoPagebreakInstalled = VERSION;

  var AUTO_KEY = 'antcv:autoPages';
  // 1.50.316 PREVIEW-A4-FILL: the EXPORT (Word/PDF) renders content taller than
  // the compact preview, so the export break is computed at the Word-equivalent
  // line (USABLE_PDF, ~924px) and lands where Word fills A4 — no dead space. The
  // PREVIEW, measured in the same compact px, would break at that same item and
  // leave ~200px empty below it (the page stops short, "doesn't look like A4").
  // Fix: compute a SECOND map at the TRUE A4 line (USABLE, ~1053px) so the preview
  // page fills, and point the preview renderer (__antcvAutoPB → __antcvEffBucket)
  // at it. The export client keeps reading antcv:autoPages unchanged. Owner-chosen
  // decouple (2026-06-08): preview fills A4, export stays exactly as it was.
  var PREVIEW_KEY = 'antcv:autoPagesPreview';
  var SECTIONS_KEY = 'sections';
  var PAGE_H = 1123;       // A4 preview page-box ≈ 1123px at 96dpi
  var SAFETY = 70;         // crowd margin: count near-edge units as overflow
  var USABLE = PAGE_H - SAFETY;
  // 1.50.298 PREVIEW-PDF-PARITY-001: the exported Word/PDF renders the SAME
  // content TALLER than the live preview (larger paragraph spacing + a wider text
  // column → different line wrap). This measurer reads PREVIEW px, so a break that
  // looks right in the preview lands one unit too LATE in the PDF (owner: roles
  // overflow past the salmon, the "(Cont.)" heading sits one role too far). The
  // owner's increment-1 PDF-vs-preview analysis measured ~120px of extra height
  // accumulated over ~10 blocks on a ~1053px page ≈ 11% taller. Shrink the usable
  // preview height by that factor so the measurer breaks where WORD actually
  // breaks. Applied to the WHOLE page (sidebar + main) so the two columns stay in
  // step. TUNABLE: raise toward 1.15 if breaks still land one unit too LATE in the
  // PDF; lower toward 1.05 if page 1 ends up too empty (breaks too EARLY).
  var WORD_INFLATE = 1.14;
  var USABLE_PDF = USABLE / WORD_INFLATE;   // ~949px — the Word-equivalent A4 fill
  var ITEM_PATH_ATTR = 'data-antcv-row-path';

  function readJson(k, f) {
    try {
      var v = JSON.parse(localStorage.getItem(k) || '');
      return v && typeof v === 'object' ? v : f;
    } catch (_) { return f; }
  }
  function activeDoc() {
    try {
      var d = localStorage.getItem('doc') || '';
      try { var p = JSON.parse(d); if (typeof p === 'string') d = p; } catch (e) {}
      return String(d).toLowerCase() === 'cl' ? 'cl' : 'cv';
    } catch (_) { return 'cv'; }
  }
  function sectionsFor(doc) {
    var all = readJson(SECTIONS_KEY, {});
    var l = all && all[doc];
    return Array.isArray(l) ? l : [];
  }
  function sectionById(list, sid) {
    for (var i = 0; i < list.length; i++) {
      if (list[i] && String(list[i].id || '') === String(sid || '')) return list[i];
    }
    return null;
  }
  function visible(el) {
    return !!(el && el.isConnected &&
      (el.offsetWidth || el.offsetHeight ||
        (el.getClientRects && el.getClientRects().length)));
  }

  // GROUP-start indices for a section, from the DATA MODEL. A
  // labeled_list with { group: … } dividers: the group rows are the
  // valid break points (move a whole group, never split mid-group).
  // Hidden groups still have a .group entry in items, so they are
  // honoured even though their label has no DOM node. Non-grouped
  // lists: every index is a valid break.
  function groupStarts(sec) {
    var items = sec && Array.isArray(sec.items) ? sec.items : null;
    if (!items) return null;
    var hasGroups = items.some(function (it) { return it && it.group !== undefined; });
    var out = [];
    for (var i = 0; i < items.length; i++) {
      if (!hasGroups) { out.push(i); continue; }
      if (items[i] && items[i].group !== undefined) out.push(i);
    }
    return out;
  }
  function snapToGroup(starts, idx) {
    if (!starts || !starts.length) return idx;
    var best = starts[0];
    for (var i = 0; i < starts.length; i++) {
      if (starts[i] <= idx) best = starts[i]; else break;
    }
    return best;
  }

  // First item index whose bottom crosses `limit` (relative to
  // columnTop), or -1 if it all fits. Reads data-antcv-row-path so
  // the index is the ORIGINAL item index (matches itemPages/autoPages
  // keying), not a filtered DOM position.
  function firstOverflowItem(sectionEl, columnTop, limit) {
    var rows = sectionEl.querySelectorAll('[' + ITEM_PATH_ATTR + '^="items."]');
    for (var i = 0; i < rows.length; i++) {
      var el = rows[i];
      if (!visible(el)) continue;
      var m = /^items\.(\d+)/.exec(String(el.getAttribute(ITEM_PATH_ATTR) || ''));
      if (!m) continue;
      if (el.getBoundingClientRect().bottom - columnTop > limit) return Number(m[1]);
    }
    return -1;
  }

  // First table-row index (tbody) whose bottom crosses `limit`. The
  // native oMain table path keys autoPages by FULL-TABLE row index
  // (thead counts as row 0), so we add 1 to the tbody-relative index.
  function firstOverflowRow(sectionEl, columnTop, limit) {
    var table = sectionEl.querySelector('table');
    if (!table) return -1;
    var tbody = table.querySelector('tbody');
    if (!tbody) return -1;
    var rows = tbody.children;
    for (var i = 0; i < rows.length; i++) {
      if (!visible(rows[i])) continue;
      if (rows[i].getBoundingClientRect().bottom - columnTop > limit) {
        return i + 1; // +1: full-table index (thead row 0)
      }
    }
    return -1;
  }

  function compute(usableBase, autoKey) {
    var doc = activeDoc();
    var list = sectionsFor(doc);
    if (!list.length) return readJson(autoKey, {});

    // STICKY: carry forward existing auto breaks for sections that
    // still exist. We only DETECT on sections without an auto break.
    var existing = readJson(autoKey, {});
    var map = {};
    for (var ek in existing) {
      if (existing[ek] && typeof existing[ek] === 'object' && sectionById(list, ek)) {
        map[ek] = existing[ek];
      }
    }

    // Measure across every rendered column (sidebar + main), in both
    // CV page-box mode and CL continuous mode. We measure relative to
    // each column's own top so a section already on page >1 is
    // measured within its current page-box.
    var cols = Array.prototype.slice.call(
      document.querySelectorAll(
        '.antcv-document-sidebar, [data-antcv-document-sidebar="true"], .antcv-document-main, [data-antcv-document-main="true"]'
      )
    ).filter(visible);

    for (var c = 0; c < cols.length; c++) {
      var col = cols[c];
      var colTop = col.getBoundingClientRect().top;
      // 1.50.286 SALMON-MOBILE-001: the preview content is CSS
      // transform:scale(ui) — on mobile ui<1 to fit the screen.
      // getBoundingClientRect() returns POST-transform (scaled) pixels, so a
      // section that overflows A4 (USABLE px UNSCALED) measured smaller than
      // USABLE and no break was detected → no salmon on mobile. Recover the
      // scale from the column (rendered width / layout width) and scale the
      // limit by it so the comparison is done in the SAME (scaled) space.
      var scale = col.offsetWidth ? (col.getBoundingClientRect().width / col.offsetWidth) : 1;
      if (!(scale > 0.1 && scale < 10)) scale = 1;
      var limit = usableBase * scale;   // 1.50.298 Word-equivalent fill (see WORD_INFLATE); 1.50.316 per-target base
      var secEls = col.querySelectorAll('[data-sid]');
      for (var s = 0; s < secEls.length; s++) {
        var secEl = secEls[s];
        var sid = secEl.getAttribute('data-sid');
        if (!sid || map[sid]) continue;          // sticky: already broken
        var sec = sectionById(list, sid);
        if (!sec) continue;
        if (sec.type === 'experience') continue;  // measured in the role pass below

        var br = -1;
        if (sec.type === 'table' || secEl.querySelector('table')) {
          var rowIdx = firstOverflowRow(secEl, colTop, limit);
          if (rowIdx >= 1) br = rowIdx;
        } else {
          var idx = firstOverflowItem(secEl, colTop, limit);
          if (idx >= 1) {
            br = snapToGroup(groupStarts(sec), idx);
            // PB-PREVIEW-SIDEBAR-SALMON-PUSH-001 (owner 2026-06-08): when the
            // FIRST group itself overflows the page, snapToGroup falls back to
            // group-start 0 (no earlier boundary to snap to), so br<1 and NO
            // break would be written — the whole sidebar then renders in one
            // page-box and PUSHES the salmon below A4 instead of flowing through
            // it. Owner: "the sidebar text [must go] through the salmon and not
            // push the salmon." So when the group snap yields no valid break
            // point, break at the RAW overflow item (at the A4 line). A single
            // group taller than a page cannot be kept whole anywhere, so a
            // mid-group cut at the line is correct here — the page-box height
            // stays bounded by A4 and the sidebar continues on page 2.
            if (br < 1) br = idx;
          }
        }
        if (br >= 1) { map[sid] = {}; map[sid][String(br)] = 2; }
      }

      // 1.50.276 EXPERIENCE role auto-pagination. Each role renders inside a
      // wrapper carrying data-antcv-role-index (its ORIGINAL index in
      // e.roles). Within THIS page-box column, find the first role whose
      // bottom crosses the usable page height and move it to the next page
      // (autoPages[expId][idx]=2); the render's monotonic role-page floor
      // cascades every later role with it. Whole roles move — a role is the
      // atomic unit, never split. STICKY via map[expId]; one break (page 2)
      // per the measurer's current 2-page scope, same as the other sections.
      try {
        var expSec = null;
        for (var li = 0; li < list.length; li++) {
          if (list[li] && list[li].type === 'experience') { expSec = list[li]; break; }
        }
        if (expSec && expSec.id && !map[expSec.id]) {
          var roleEls = col.querySelectorAll('[data-antcv-role-index]');
          for (var ri = 0; ri < roleEls.length; ri++) {
            if (!visible(roleEls[ri])) continue;
            if (roleEls[ri].getBoundingClientRect().bottom - colTop > limit) {
              var rmi = parseInt(roleEls[ri].getAttribute('data-antcv-role-index'), 10);
              if (rmi >= 1) { map[expSec.id] = {}; map[expSec.id][String(rmi)] = 2; }
              break;
            }
          }
        }
      } catch (_) {}
    }

    // 1.50.310 CL-SALMON: the passes above measure the CV page-box columns
    // (.antcv-document-sidebar / .antcv-document-main). The COVER LETTER is one
    // linear flow with no such column, so it was never measured and the preview
    // never showed a salmon. Measure the CL flow here: find the first section
    // whose bottom crosses the A4 line and move it WHOLE to page 2 via a
    // section-start break — __antcvSecStart reads the effective bucket and draws
    // the salmon before it. Sticky + change-only like the CV passes.
    if (doc === 'cl') {
      try {
        var clCols = Array.prototype.slice.call(
          document.querySelectorAll('[data-antcv-cl-flow="true"]')
        ).filter(visible);
        for (var cc = 0; cc < clCols.length; cc++) {
          var clCol = clCols[cc];
          var clTop = clCol.getBoundingClientRect().top;
          var clScale = clCol.offsetWidth
            ? (clCol.getBoundingClientRect().width / clCol.offsetWidth) : 1;
          if (!(clScale > 0.1 && clScale < 10)) clScale = 1;
          var clLimit = usableBase * clScale;
          var clSecs = clCol.querySelectorAll('[data-sid]');
          for (var cs = 0; cs < clSecs.length; cs++) {
            var clEl = clSecs[cs];
            if (!visible(clEl)) continue;
            var clSid = clEl.getAttribute('data-sid');
            if (!clSid || map[clSid]) continue;   // sticky
            // CL-DOUBLE-SALMON-001 (owner 2026-06-09): the old gate flagged ANY
            // section whose bottom sat past clLimit — but a section that lives
            // ENTIRELY on page 2 also has bottom > clLimit, so every later section
            // got its own hard-coded "page 2" break across successive cycles → two
            // "▼ PAGE 2 ▼" bars for the same page. Only break a section that actually
            // SPANS a page boundary (its top and bottom land on different pages), and
            // label the salmon with the REAL cumulative page it moves onto, not a
            // hard-coded 2. The CL preview is one continuous flow, so absolute
            // position / clLimit gives the page directly.
            var __clTopPx = clEl.getBoundingClientRect().top - clTop;
            var __clBotPx = clEl.getBoundingClientRect().bottom - clTop;
            var __clTopPg = Math.floor(__clTopPx / clLimit);
            var __clBotPg = Math.floor((__clBotPx - 2) / clLimit); // -2px: ignore exact-edge jitter
            if (__clBotPg <= __clTopPg) continue;        // sits within one page → no break
            var __clPageNo = Math.min(4, __clTopPg + 2); // the page this section moves onto
            var __clBoundary = (__clTopPg + 1) * clLimit; // the boundary it crosses
            // This is the first section that overflows the page line. 1.50.315
            // CL-MIDLIST: when it exposes per-item break keys (text_bullets bullets
            // tagged data-antcv-cl-item-key by __antcvBreaks), refine to ITEM level —
            // break BEFORE the first bullet whose bottom crosses the line, so the
            // salmon lands BETWEEN bullets (mid-list) and the worker's renderTextBullets
            // splits there with a "TITLE (Cont.)" heading. If the FIRST keyed item
            // already crosses, that key is its first part → whole-section move (same as
            // before). A non-keyed text section falls back to the whole-section move.
            var clSec = sectionById(list, clSid);
            var keyed = clEl.querySelectorAll('[data-antcv-cl-item-key]');
            var brokeItem = false;
            for (var ki = 0; ki < keyed.length; ki++) {
              var kEl = keyed[ki];
              if (!visible(kEl)) continue;
              if (kEl.getBoundingClientRect().bottom - clTop > __clBoundary) {
                var kKey = kEl.getAttribute('data-antcv-cl-item-key');
                if (kKey) { map[clSid] = {}; map[clSid][kKey] = __clPageNo; brokeItem = true; }
                break;
              }
            }
            // 1.50.316 CL-TABLE: a WHAT-I-BRING (type:"table") section that
            // overflows splits by ROW — find the first table row whose bottom
            // crosses the line and write its full-table row index, so the worker's
            // renderCompetencyTable starts a fresh continuation table (own header +
            // "(Cont.)") at that row instead of moving the whole table whole.
            var brokeRow = false;
            if (!brokeItem && clSec && (clSec.type === 'table' || clEl.querySelector('table'))) {
              var rIdx = firstOverflowRow(clEl, clTop, __clBoundary);
              if (rIdx >= 1) { map[clSid] = {}; map[clSid][String(rIdx)] = __clPageNo; brokeRow = true; }
            }
            if (!brokeItem && !brokeRow) {
              // Mirror app.js __antcvFirstKey so __antcvSecStart picks the break up.
              var fk = (clSec && clSec.type === 'text_bullets')
                ? ((clSec.intro != null && String(clSec.intro).trim()) ? 'intro' : 'bullet_0')
                : '0';
              map[clSid] = {}; map[clSid][fk] = __clPageNo;
            }
            // CL-SALMON-SLOW-001 (owner 2026-06-09 "took a long time"): break EVERY
            // spanning section in ONE pass — matching the CV passes above, which loop
            // all sections. The old `break` wrote one salmon per compute and leaned on
            // incidental re-triggers (a content-height change re-tripping the source
            // fingerprint) to paginate the rest, which is slow and fragile. This is now
            // a single write-cycle; the fingerprint gate + cooldown + 8-writes/4s
            // circuit breaker still guard against churn.
          }
        }
      } catch (_) {}
    }
    return map;
  }

  var lastWritten = null;
  var lastWrittenPreview = null;   // 1.50.316: separate change-guard for the preview map
  var lastSourceFp = null;   // 1.50.269: source fingerprint of last compute
  var writeTimes = [];
  var brokenUntil = 0;
  // 1.50.287 SALMON-LOOP-GUARD: hard cooldown after EVERY write. Our write
  // fires antcv:auto-pages-changed → React re-paginates → that re-render can
  // perturb a watched setting (1.50.281 widened the fingerprint to include
  // style settings), which would change the fingerprint and let run() measure
  // the ALREADY-paginated DOM — the classic oscillation that produces React
  // #185 and makes the salmon fl/ vanish. Refusing to recompute for a short
  // window after our own write breaks that loop regardless of fingerprint, and
  // is purely additive (it can only SKIP work, never trigger a render).
  var cooldownUntil = 0;
  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }

  // 1.50.269: SOURCE fingerprint — the candidate's section DATA + doc +
  // viewport. Crucially this does NOT include the rendered DOM, so a
  // scroll / pagination re-render (which changes the DOM but not the
  // source content) produces the SAME fingerprint and run() no-ops.
  // This is the definitive fix for the React #185 infinite-render loop:
  // the measurer fired antcv:auto-pages-changed -> React re-render ->
  // (previously) the measurer re-ran on the re-paginated DOM, measured
  // differently, wrote again, fired again … now it only recomputes when
  // the SOURCE actually changes (an edit, a language switch, a rotate).
  // 1.50.281: cheap djb2 hash so the fingerprint reflects the WHOLE source,
  // not just its ends.
  function djb2(str) {
    var h = 5381;
    for (var i = 0; i < str.length; i++) h = (((h << 5) + h) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }
  // 1.50.281: layout/style settings that change RENDERED height without
  // changing section CONTENT — sidebar/main border ratio, table ratios, font
  // sizes, the style package, and per-item + header alignment (justified vs
  // left, etc.). A change in any of these can push text across the page edge,
  // so they must re-trigger the measurer. They are user settings (not derived
  // from pagination), so including them is loop-safe.
  var STYLE_KEYS = [
    'cvSidebarRatio', 'cvTableRatio', 'clTableRatio', 'fontSizes',
    'styleConfig', 'headerItemAlign', 'antcvItemAlignment',
  ];
  function settingsFingerprint() {
    var s = '';
    for (var i = 0; i < STYLE_KEYS.length; i++) {
      try { s += STYLE_KEYS[i] + '=' + (localStorage.getItem(STYLE_KEYS[i]) || '') + ';'; } catch (_) {}
    }
    return s;
  }
  function sourceFingerprint() {
    try {
      var secs = localStorage.getItem(SECTIONS_KEY) || '';
      var doc = activeDoc();
      var scroll = document.querySelector('.antcv-preview-scroll');
      var ch = scroll ? scroll.clientHeight : 0;
      var cw = scroll ? scroll.clientWidth : 0;
      // 1.50.281: hash the FULL sections (was first/last 400 chars only — that
      // missed MIDDLE changes, e.g. experience roles filling in on regenerate
      // or a mid-list hide/unhide, so the measurer never re-ran and the salmon
      // never appeared) PLUS the layout/style settings above.
      return doc + '#' + ch + 'x' + cw + '#' + secs.length + '#'
        + djb2(secs) + '#' + djb2(settingsFingerprint());
    } catch (_) { return String(nowMs()); }
  }

  function run() {
    try {
      var now = nowMs();
      if (now < brokenUntil) return;
      // 1.50.287: hard cooldown after our own write — do not re-measure the
      // pagination WE just triggered (breaks the #185 oscillation regardless
      // of fingerprint sensitivity). A genuine user edit lands after this
      // short window and still re-measures.
      if (now < cooldownUntil) return;

      // GATE: skip entirely when the source content + viewport are
      // unchanged since the last compute. Breaks the self-feedback loop.
      var fp = sourceFingerprint();
      if (fp === lastSourceFp) return;

      // 1.50.316: compute BOTH targets in one trigger — the export map at the
      // Word-equivalent line (USABLE_PDF) and the preview map at the true A4 line
      // (USABLE). Each carries its own sticky state via its own storage key.
      var mapExport = compute(USABLE_PDF, AUTO_KEY);
      var mapPreview = compute(USABLE, PREVIEW_KEY);
      // Mark this source as processed BEFORE any write/fire, so the
      // re-render our own write triggers (same source) early-returns.
      lastSourceFp = fp;

      var nextExport = JSON.stringify(mapExport);
      var nextPreview = JSON.stringify(mapPreview);
      var curExport = localStorage.getItem(AUTO_KEY) || '{}';
      var curPreview = localStorage.getItem(PREVIEW_KEY) || '{}';
      var exportChanged = nextExport !== curExport && nextExport !== lastWritten;
      var previewChanged = nextPreview !== curPreview && nextPreview !== lastWrittenPreview;
      if (!exportChanged && !previewChanged) { lastWritten = nextExport; lastWrittenPreview = nextPreview; return; }

      // Circuit breaker backstop: > 8 distinct write-cycles in 4s → back off 8s
      // AND freeze the fingerprint so we stop recomputing.
      writeTimes.push(now);
      writeTimes = writeTimes.filter(function (t) { return now - t < 4000; });
      if (writeTimes.length > 8) {
        brokenUntil = now + 8000;
        writeTimes = [];
        try {
          console.warn('[v' + VERSION + ' auto-pagebreak] write churn — backing off 8s.');
        } catch (_) {}
        return;
      }

      if (exportChanged) { localStorage.setItem(AUTO_KEY, nextExport); lastWritten = nextExport; }
      if (previewChanged) { localStorage.setItem(PREVIEW_KEY, nextPreview); lastWrittenPreview = nextPreview; }
      cooldownUntil = now + 1500;   // 1.50.287: don't re-measure our own pagination for 1.5s
      try {
        window.dispatchEvent(new CustomEvent('antcv:auto-pages-changed', {
          detail: { source: 'auto-pagebreak-001', version: VERSION },
        }));
      } catch (_) {}
    } catch (e) {
      try { console.warn('[v' + VERSION + ' auto-pagebreak] run failed:', e && e.message); } catch (_) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      setTimeout(run, 250);
    });
  }

  function start() {
    // 1.50.337 SALMON-CHURN-REVERT (owner 2026-06-09 "salmon disappeared from CV+CL"):
    // the 1.50.326 "quicker salmon" speed-up (poll 1200ms + 120ms schedule + dense
    // boot delays) raised measurer frequency enough that, under heavy editing + the
    // other sidecars' re-render churn, the 8-writes/4s circuit breaker tripped and
    // FROZE the measurer before the breaks were written → the salmon vanished (and
    // fed the React #185 oscillation). Reverted to the calm, stable cadence; the
    // one-pass CL fix (1.50.324) still makes the salmon appear in a single compute,
    // so it stays responsive without the churn.
    [400, 900, 1800, 3500].forEach(function (d) { setTimeout(schedule, d); });
    // 1.50.269: NO MutationObserver — it fired on our own pagination
    // re-render and was a loop amplifier. Genuine content changes come
    // through the app's explicit events below; the fingerprint gate
    // makes any stray trigger a cheap no-op anyway.
    // 1.50.269: do NOT listen to antcv:auto-pages-changed — that is the
    // event WE fire; listening to it was the direct self-trigger that
    // produced the React #185 loop.
    // 1.50.281: also listen for alignment + style changes (they change
    // rendered height without changing section content). 'antcv:style-changed'
    // is harmless if never fired; the 3s poll + the settings fingerprint catch
    // style changes regardless.
    ['antcv:sections-updated', 'antcv:item-pages-changed',
     'antcv:preview-rescale', 'antcv:item-align-changed',
     'antcv:style-changed'].forEach(function (ev) {
      try { window.addEventListener(ev, schedule); } catch (_) {}
    });
    try { window.addEventListener('resize', schedule, { passive: true }); } catch (_) {}
    setInterval(schedule, 3000);   // 1.50.337: back to the calm poll (was 1200) — see start()
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.AntcvAutoPagebreak = {
    version: VERSION,
    run: function () { lastWritten = null; lastSourceFp = null; schedule(); },
    _compute: compute,
    // Manual reset of auto breaks (e.g. from console) if a stale break
    // ever sticks: AntcvAutoPagebreak.clear()
    clear: function () {
      try {
        localStorage.setItem(AUTO_KEY, '{}');
        lastWritten = '{}';
        lastSourceFp = null;
        window.dispatchEvent(new CustomEvent('antcv:auto-pages-changed',
          { detail: { source: 'auto-pagebreak-001-clear' } }));
      } catch (_) {}
    },
  };
  try { console.debug('[auto-pagebreak-001] installed ' + VERSION + ' (autoPages measurer)'); } catch (_) {}
})();
