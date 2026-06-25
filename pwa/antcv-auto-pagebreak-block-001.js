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
 *
 * SIDEBAR-SHRINK-RECLAIM-001 (1.50.340, owner 2026-06-11)
 * -------------------------------------------------------
 * Sticky is now ONE-DIRECTIONAL: a carried break is re-measured against the
 * section's TRUE paginated height (unique rows summed across page-box clones)
 * and CLEARED when it fits within (limit − hysteresis), so widening the sidebar
 * flows the ADDITIONAL INFORMATION (CONT.) tail back to page 1. Two-stage band:
 * stable (120px) on the reactive pass, tight (40px) on a delayed routine
 * recheck. On a sidebar/table WIDTH change the narrowed MAIN column is freed
 * from sticky in the same pass so it can grow a fresh break (the coupling the
 * old code ignored). Applies to sidebar, main, and CL body. ONE_PASS /
 * two-phase and the bands are runtime-tunable via AntcvAutoPagebreak.config().
 *
 * SIDEBAR-DRAG-DANCE-001 (1.50.341, owner 2026-06-11): the measurer is now
 * SUSPENDED while a splitter drag is in progress (capture-phase pointerdown on
 * .antcv-col-splitter sets dragActive; window pointerup/cancel clears it and
 * arms ONE settle pass ~350ms later, after React commits the final width). This
 * stops the "sidebar dances during drag, only settles when I click to edit"
 * symptom — the measurer no longer writes against a mid-drag, still-moving
 * layout. Covers both the native left drag and the reverse-drag sidecar.
 */
(function () {
  'use strict';

  var VERSION = '1.50.895-sidebar-inflate-grpwhole';
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
  // SIDEBAR-PREVIEW-BREAK-EARLY-001 (owner 2026-06-21): the PREVIEW sidebar salmon sat
  // too LOW — it broke at the full A4 line (USABLE ~1053px) while the DOCX/worker breaks
  // the sidebar higher (~924px), so the preview showed 2-3 subsubsections MORE on page 1
  // than the PDF (owner screenshot: REGULATORY CONTEXT split late). Pull the PREVIEW
  // sidebar break line up by this factor so it lands at/just past the DOCX line.
  // CRITICAL SAFETY (learnt from the 1st attempt + auto-overflow-362 standdown):
  //   - PREVIEW MAP ONLY. The EXPORT map (antcv:autoPages) sidebar break is LEFT EXACTLY
  //     as-is — the worker needs it for DOCX; removing/moving it breaks the DOCX (owner).
  //   - ONLY-ADJUST, NEVER-FORCE. We only pull up a sidebar break that ALREADY exists at
  //     the normal line; if the sidebar fits the normal line (e.g. it rides the main
  //     column's pagination) we create NOTHING. Forcing a break where none was needed is
  //     what made the maps oscillate + leak a spurious export break last time.
  // Console-tunable: AntcvAutoPagebreak.config({ SIDEBAR_PREVIEW_INFLATE: N }) (1..2).
  // 1.50.749 FORCE variant: this now FORCES a preview sidebar break at usableBase/this
  // even when the sidebar fits the normal A4 line (the preview over-fills page 1 vs the
  // taller PDF). 1.32 ≈ pulls the break up ~2-3 subsubsections so Languages→page 2 like
  // the PDF. Owner-tune live: AntcvAutoPagebreak.config({ SIDEBAR_PREVIEW_INFLATE: N }) —
  // higher = breaks earlier (more sidebar to page 2); 1.0 disables the force entirely.
  var SIDEBAR_PREVIEW_INFLATE = 1.20;
  var ITEM_PATH_ATTR = 'data-antcv-row-path';
  // SIDEBAR-SNAP-GAP-001 (owner 2026-06-11): max page-1 space (UNSCALED px) a
  // group-snap may waste before we abandon the snap and break at the raw overflow
  // item to fill the page. ~90px ≈ a grouped sub-heading + 2 short rows; below
  // that we keep the group whole, above it we fill to the A4 line. Console-tunable
  // via AntcvAutoPagebreak.config({ SNAP_GAP_MAX: N }).
  var SNAP_GAP_MAX = 90;

  // SALMON-UNIFIED-001 Phase B (1.50.814): make the SIDEBAR pass N-PAGE. The
  // legacy sidebar break hard-codes page 2 (map[sid][br]=2) — a sidebar long
  // enough to need a 3rd page gets NO page-2→3 salmon. When this flag is on, we
  // greedily continue past the first break and assign page 3, 4, … to the first
  // item of each subsequent overflowing page, snapped to a group boundary — the
  // same greedy fill the EXPERIENCE roles already use. Gated so the proven
  // 2-page path stays the default until the Phase C coordinator ships.
  // Console-tunable: AntcvAutoPagebreak.config({ SIDEBAR_NPAGE: true }).
  var SIDEBAR_NPAGE = true;

  // SALMON-UNIFIED-001 Phase C (1.50.815): the UNIFIED SHEET COORDINATOR. After
  // both columns paginate independently, align them to ONE shared page boundary
  // per page — the EARLIER column drives each line, the shorter column shows an
  // intentional gap so page N starts straight across the sheet. Tracks the DOCX
  // export line (owner choice #2). Separate flag from SIDEBAR_NPAGE so the proven
  // per-column N-page path (Phase B) can ship even if the coordinator is disabled.
  // Console-tunable: AntcvAutoPagebreak.config({ SIDEBAR_UNIFIED: false }).
  var SIDEBAR_UNIFIED = true;
  // CUMULATIVE-ABSOLUTE-PAGE-001 (owner 2026-06-25): page sidebar items by ABSOLUTE
  // offset from the column top (floor(offset/limit)+1) in the greedy multi-page walk,
  // so a section that sits on page 3 is tagged page 3 — not "page 2". Fixes late sidebar
  // sections (regulatory/languages/interests/accessibility) all stacking on page 2 and
  // cascading the export to extra pages. Live toggle: AntcvAutoPagebreak.config({ ABSOLUTE_PAGING:true }).
  // DEFAULT OFF (owner 2026-06-25 "a lot of text dancing"): on the page-row-split preview the
  // absolute offset is relative to EACH ROW's top, not the document, so re-measures shifted the
  // break pages and INCREASED the dancing — and it never produced the page-3 breaks intended
  // (autoPages stayed all ->2). The real cross-page distribution needs a height-based
  // deterministic coordinator (next). Off = the stable legacy single-increment walk.
  var ABSOLUTE_PAGING = false;
  // DET-COORD page-1 band deduction (preview px): page 1 holds the candidate header band
  // above both columns, so its usable budget is smaller than pages 2+. Owner-tunable live:
  // AntcvAutoPagebreak.config({ PAGE1_BAND:N }). Higher = lighter page 1 (more to page 2).
  var PAGE1_BAND = 200;
  // DET-COORD-004 (owner 2026-06-25 "certs back on page 1"): the SIDEBAR's page 1 is shorter
  // than the main's because the PHOTO (~150-170px) sits at the sidebar/band top, so the sidebar
  // needs a BIGGER page-1 deduction than the main — otherwise certs fits page 1 in the coordinator
  // while it overflows in the real export. Separate knob (default = main band + a photo reserve).
  // Owner-tunable live: AntcvAutoPagebreak.config({ SIDEBAR_PAGE1_BAND:N }). DEFAULT null =
  // AUTO: the sidebar page-1 deduction is computed as PAGE1_BAND + the measured PHOTO height,
  // because the photo's footprint depends on the sidebar/main ratio + photo size/position and
  // differs every generation (owner 2026-06-25). A numeric value here pins it (manual override).
  var SIDEBAR_PAGE1_BAND = null;
  // KEEP-WHOLE only applies to sections up to this FRACTION of a page. A big SIDEBAR section
  // (the 25-item REGULATORY CONTEXT) is ~80% of a page: keeping it whole whole-moves it to the
  // next page and leaves the prior page's sidebar short. Splitting it instead BALANCES it across
  // the page boundary (its first groups stay, the last group + a "(Cont.)" header flow on) — the
  // owner's 2026-06-25 ask. Small sections (certs, education, languages) stay whole. The MAIN
  // column keeps frac=1 (unchanged — owner: "the problem is with the sidebar not main").
  // Owner-tunable live: AntcvAutoPagebreak.config({ KEEP_WHOLE_FRAC:N }) (0..1).
  var KEEP_WHOLE_FRAC = 0.62;
  // Measure the profile photo's height (the reserve the sidebar's page 1 loses to it). 0 when
  // there is no photo (then the sidebar band falls back to PAGE1_BAND).
  function __photoReserve() {
    try {
      var p = document.querySelector('.antcv-preview-paper img[src^="data:"], [data-antcv-preview-paper] img[src^="data:"], .antcv-preview-paper .antcv-photo, .antcv-preview-paper [data-antcv-photo]');
      if (!p) return 0;
      var h = p.getBoundingClientRect().height;
      return (h > 40 && h < 420) ? Math.round(h) : 0;
    } catch (_) { return 0; }
  }

  // ============================================================
  // SIDEBAR-SHRINK-RECLAIM-001 (owner 2026-06-11)
  // ------------------------------------------------------------
  // BUG: dragging the sidebar wider (cvSidebarRatio ↑) made the sidebar
  // text wrap into FEWER lines, so the page-2 ADDITIONAL INFORMATION
  // (CONT.) tail should flow back up to page 1 — but the STICKY rule
  // ("once broken, never re-measure") froze the break at its old index.
  // The salmon never moved; the only visible change was the column
  // re-laying-out at the new width, which read as the sidebar "jumping
  // between two positions" with no reflow. The shrink / pull-back-from-
  // page-2 case was never handled.
  //
  // FIX: sticky is now ONE-DIRECTIONAL. We still carry a break forward
  // (no oscillation when content grows), but every cycle we RE-MEASURE
  // the carried section's TRUE paginated height — the sum of its unique
  // rows across ALL page-box clones it appears in (deduped by the
  // original item index in data-antcv-row-path) — and CLEAR the break
  // when that height fits within (limit − hysteresis). Two-stage band:
  // a STABLE band on the reactive pass (won't flip-flop at the edge) and
  // a TIGHT band on a delayed routine recheck (reclaims the last line).
  //
  // Coupling: widening the sidebar NARROWS the main column, which can
  // make the main text TALLER and create its OWN break in the same
  // gesture. So on a width change we also drop the MAIN column from the
  // sticky skip (RECLAIM_FREE_MAIN) so a newly-narrowed main can grow a
  // fresh break in the same pass. Resolution mode is flagged so we can
  // A/B one-pass vs two-phase.
  var HYST_STABLE = 120;   // px slack below the line before a (CONT.) flows back up (reactive pass)
  var HYST_TIGHT  = 40;    // px slack on the delayed routine recheck (reclaims the last line)
  var ONE_PASS    = true;  // true: clear + create in the same compute; false: two-phase
  var RECHECK_MS  = 2500;  // delay before the tight routine recheck after things settle
  // width-change detection: remember the ratio we last computed against
  var __lastRatioFp = null;
  // MAINBAR-FLIP-FIX-001: per-section "break created at" timestamps. A break
  // younger than HOLD_MS is HELD (never re-measure-cleared) so a freshly created
  // break at the page boundary can't be cleared by the very next pass before the
  // layout has settled — that create→clear→re-create cycle was the dance (seen
  // BOTH ways: rightward narrows main → main item drops; leftward narrows the
  // sidebar → ADDITIONAL INFORMATION splits). Keyed by sid.
  var __breakBornAt = {};
  var HOLD_MS = 3000;   // hold a new break at least this long before it may clear


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

  // SALMON-UNIFIED-001 Phase B: greedy N-page item pagination for a sidebar
  // section. Walks the section's item rows in order and fills page-boxes of
  // height `limit`: an item whose BOTTOM crosses the current page line moves
  // WHOLE to the next page, and that page then starts at the item's TOP. Returns
  // a { itemIndex: page } map for the FIRST item of each page >= 2, snapping each
  // boundary UP to a group start (snapToGroup) the same way the single-break path
  // does, with the same raw-item fallback when the snap is invalid or wastes too
  // much page. `firstPage`/`firstBr` seed the result with the already-computed
  // page-2 break so we never recompute or contradict it. Atomic items (never
  // split). Mirrors the EXPERIENCE role greedy loop.
  function allOverflowPages(sectionEl, sec, columnTop, limit, scale, firstBr) {
    var out = {};
    var rows = sectionEl.querySelectorAll('[' + ITEM_PATH_ATTR + '^="items."]');
    if (!rows.length) { if (firstBr >= 1) out[String(firstBr)] = 2; return out; }
    var starts = groupStarts(sec);
    // ABSOLUTE path (CUMULATIVE-ABSOLUTE-PAGE-001): the page an item lands on = its
    // offset from the column top in whole `limit` strides. Captures the empty space ABOVE
    // a section, so a section starting on page 3 yields page 3 (the old per-section walk
    // collapsed that gap and tagged everything "page 2"). LEGACY path (ABSOLUTE_PAGING off)
    // is the original single-increment walk, preserved for a clean live revert.
    var pageTop = columnTop;     // legacy: viewport-top of the current page being filled
    var curPage = 1;             // legacy page counter
    var lastAbs = 1;             // absolute: highest page already recorded
    for (var i = 0; i < rows.length; i++) {
      var el = rows[i];
      if (!visible(el)) continue;
      var m = /^items\.(\d+)/.exec(String(el.getAttribute(ITEM_PATH_ATTR) || ''));
      if (!m) continue;
      var rawIdx = Number(m[1]);
      var rc = el.getBoundingClientRect();
      var crossed, pageForBreak;
      if (ABSOLUTE_PAGING) {
        pageForBreak = Math.floor((rc.top - columnTop) / limit) + 1;   // 1-based absolute page
        crossed = pageForBreak > lastAbs;
      } else {
        // Overflow if this item's bottom crosses the current page line AND it is
        // not the first block on the page (an item taller than a page can't move).
        crossed = (rc.bottom - pageTop) > limit && (rc.top - pageTop) > 1;
        pageForBreak = curPage + 1;
      }
      if (crossed) {
        if (ABSOLUTE_PAGING) { lastAbs = pageForBreak; } else { curPage++; pageTop = rc.top; }
        // Snap the break UP to a group start (keep groups whole).
        var snapped = snapToGroup(starts, rawIdx);
        if (snapped < 1) snapped = rawIdx;
        if (snapped >= 1 && snapped < rawIdx) {
          var snapEl = sectionEl.querySelector('[' + ITEM_PATH_ATTR + '="items.' + snapped + '"]');
          if (snapEl && visible(snapEl)) {
            var __sr = snapEl.getBoundingClientRect();
            var snapBottomRel = __sr.bottom - columnTop;
            // gap = empty space left below the snapped item on ITS page (absolute) /
            // below the line (legacy). If snapping wastes > SNAP_GAP_MAX, cut at raw.
            var snapPageLine = ABSOLUTE_PAGING
              ? (Math.floor((__sr.top - columnTop) / limit) + 1) * limit
              : limit;
            if ((snapPageLine - snapBottomRel) > (SNAP_GAP_MAX * scale)) snapped = rawIdx;
          }
        }
        // Record the FIRST item of this page only.
        if (!out[String(snapped)]) out[String(snapped)] = pageForBreak;
      }
    }
    if (!Object.keys(out).length && firstBr >= 1) out[String(firstBr)] = 2;
    return out;
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

  // True paginated height of a section that may be split across page-box
  // clones. Each clone carries the same data-sid; its rows carry
  // data-antcv-row-path with the ORIGINAL item index. We sum the UNIQUE rows
  // (deduped by original index) across every visible clone — that is the
  // section's height as if it were NOT paginated, measured while it still IS
  // paginated, with no DOM injection. Tables: sum unique tbody rows by their
  // tbody position. Returns 0 when nothing measurable (caller keeps the break).
  function paginatedContentHeight(sid, isTable) {
    var clones = Array.prototype.slice.call(
      document.querySelectorAll('[data-sid="' + (window.CSS && CSS.escape ? CSS.escape(sid) : sid) + '"]')
    ).filter(visible);
    if (!clones.length) return 0;
    var seen = {}, total = 0, headerH = 0, sawHeader = false;
    for (var c = 0; c < clones.length; c++) {
      var el = clones[c];
      // header height (section title row) counts once
      if (!sawHeader) {
        var h = el.querySelector('[data-antcv-section-header], .antcv-section-header, h2, h3');
        if (h && visible(h)) { headerH = h.getBoundingClientRect().height; sawHeader = true; }
      }
      if (isTable) {
        var tbody = el.querySelector('table tbody');
        if (tbody) {
          var trs = tbody.children;
          for (var r = 0; r < trs.length; r++) {
            if (!visible(trs[r])) continue;
            var key = 't' + r;
            if (seen[key]) continue;
            seen[key] = 1; total += trs[r].getBoundingClientRect().height;
          }
        }
      } else {
        var rows = el.querySelectorAll('[' + ITEM_PATH_ATTR + '^="items."]');
        for (var i = 0; i < rows.length; i++) {
          var row = rows[i];
          if (!visible(row)) continue;
          var m = /^items\.(\d+)/.exec(String(row.getAttribute(ITEM_PATH_ATTR) || ''));
          if (!m) continue;
          var idx = m[1];
          if (seen[idx]) continue;
          seen[idx] = 1; total += row.getBoundingClientRect().height;
        }
      }
    }
    return total + headerH;
  }

  // Current sidebar-ratio fingerprint — used to detect a WIDTH change so the
  // main column can be freed from sticky in the same pass (the narrowed main
  // may need a NEW break the instant the sidebar widens).
  function ratioFp() {
    try {
      return String(localStorage.getItem('cvSidebarRatio') || '')
        + '|' + String(localStorage.getItem('cvTableRatio') || '')
        + '|' + String(localStorage.getItem('clTableRatio') || '');
    } catch (_) { return ''; }
  }

  function compute(usableBase, autoKey, tight) {
    var doc = activeDoc();
    var list = sectionsFor(doc);
    if (!list.length) return readJson(autoKey, {});

    // SIDEBAR-SHRINK-RECLAIM-001: ONE-DIRECTIONAL sticky. Carry a break
    // forward (prevents grow-side oscillation) UNLESS a re-measure shows the
    // section's TRUE paginated height now fits within (limit − hysteresis) —
    // in which case CLEAR it so the (CONT.) tail flows back up. The hysteresis
    // band is STABLE on the reactive pass and TIGHT on the delayed recheck.
    var existing = readJson(autoKey, {});
    var map = {};
    // MAINBAR-FLIP-FIX-001: born-stamps are namespaced per storage key (export
    // AUTO_KEY vs preview PREVIEW_KEY) because compute() runs once per key in the
    // same tick against DIFFERENT usable lines — a shared sid-only registry would
    // let the two maps stomp each other's holds.
    var __ns = autoKey + '|';
    function bornKey(id) { return __ns + id; }
    // Prune born-stamps in THIS namespace for breaks that no longer exist.
    for (var __bk in __breakBornAt) {
      if (__bk.indexOf(__ns) !== 0) continue;            // other namespace, leave it
      var __bkSid = __bk.slice(__ns.length);
      if (!(existing[__bkSid] && sectionById(list, __bkSid))) delete __breakBornAt[__bk];
    }
    // Detect a width change since our last compute. When the sidebar/table
    // ratio moved, the MAIN column may need a brand-new break this pass, so we
    // must NOT let a stale main break suppress detection — those are cleared
    // here and re-detected below (RECLAIM_FREE_MAIN). Sidebar breaks are still
    // re-measured (not blindly cleared) so a still-overflowing sidebar keeps
    // its salmon.
    var __rfp = ratioFp();
    var widthChanged = (__lastRatioFp !== null && __rfp !== __lastRatioFp);
    __lastRatioFp = __rfp;
    // Two-phase mode: on a width change, this pass only CLEARS the freed main
    // breaks; the fresh main detection runs on the NEXT pass (cleaner, salmon
    // moves in two visible steps). One-pass mode re-detects in the same pass.
    var deferMainDetect = widthChanged && !ONE_PASS && !tight;
    if (deferMainDetect) { try { setTimeout(function(){ lastSourceFp=null; schedule(); }, 60); } catch(_){} }
    // MAINBAR-FLIP-FIX-001 (owner 2026-06-11 "works until a mainbar item has to
    // go down, then it dances again — ~every 2.5s"): the flip cadence matched
    // RECHECK_MS, so the TIGHT recheck was clearing a break the stable pass
    // needs. The tight (40px) band is LOOSER than the create line (`limit`), so
    // for an item that JUST overflows, the tight pass found it "fits" and
    // cleared it → re-overflow → re-create → dance. FIX: the CLEAR test ALWAYS
    // uses the conservative stable band, regardless of pass. A break is removed
    // only when the content clears `limit − HYST_STABLE`. The tight recheck no
    // longer changes break EXISTENCE; it only re-measures (catching a stable
    // pass that ran before the layout settled). HYST_TIGHT is retained only for
    // potential future intra-section line reclaim, not for clearing.
    var hyst = HYST_STABLE;
    for (var ek in existing) {
      if (!(existing[ek] && typeof existing[ek] === 'object' && sectionById(list, ek))) continue;
      var __sec = sectionById(list, ek);
      var __isTable = !!(__sec && (__sec.type === 'table'));
      var __isExp = !!(__sec && __sec.type === 'experience');
      // EXPERIENCE keeps its native sticky behaviour (role.page path); don't
      // re-measure-clear it here (its roles are the atomic unit and the role
      // pass below owns it).
      if (__isExp) { map[ek] = existing[ek]; continue; }
      // Re-measure the carried section's true height. usableBase is the
      // UNSCALED page line; paginatedContentHeight returns SCALED px (post-
      // transform), so compare in scaled space using the section's own clone
      // scale (recovered from any visible clone).
      var __h = paginatedContentHeight(ek, __isTable);
      var __cl = document.querySelector('[data-sid="' + (window.CSS && CSS.escape ? CSS.escape(ek) : ek) + '"]');
      var __sc = (__cl && __cl.offsetWidth) ? (__cl.getBoundingClientRect().width / __cl.offsetWidth) : 1;
      if (!(__sc > 0.1 && __sc < 10)) __sc = 1;
      // SIDEBAR-PREVIEW-BREAK-EARLY-001 (force variant): a FORCED preview sidebar
      // break is created against the TIGHTENED line, so it must be CLEARED against
      // the same tightened line — else it would clear the instant its height fits
      // the un-tightened line and re-create next cycle (the section-flip dance).
      var __ubBase = (autoKey === PREVIEW_KEY && __sec && __sec.loc === 'sidebar')
        ? (usableBase / SIDEBAR_PREVIEW_INFLATE) : usableBase;
      var __fitLine = (__ubBase - hyst) * __sc;
      // MAINBAR-FLIP-FIX-001: do NOT clear a break that was just created — hold
      // it for HOLD_MS so the layout settles. Without this, a break created at
      // `limit` is re-measured on the next pass and cleared the instant the
      // content reads even slightly under the line, then re-created → dance.
      var __born = __breakBornAt[bornKey(ek)] || 0;
      var __young = __born && (nowMs() - __born) < HOLD_MS;
      // RICH-BLOCK-OSC-FIX-001 (owner 2026-06-25 "salmon jumping, can't stay in the cut
      // position"): the clear above tests the section's STANDALONE height (__h). A short
      // section (e.g. CERTIFICATES ~247px) fits a page ALONE, so it clears — but at its real
      // POSITION (pushed down by the sidebar content above it) it OVERFLOWS, so the detector
      // re-breaks it next pass → the salmon flip-flops forever. Make the clear POSITION-aware:
      // only clear if the section, collapsed back to one piece at its start, still fits within
      // ITS page (start offset from the column top + height ≤ the page's bottom line). Detector
      // and clearer now use the SAME (positional) test, so a placed break converges.
      var __posOK = true;
      try {
        if (__cl && __cl.closest) {
          var __colEl = __cl.closest('.antcv-document-sidebar,[data-antcv-document-sidebar="true"],.antcv-document-main,[data-antcv-document-main="true"]');
          if (__colEl) {
            var __lineSc = __ubBase * __sc;                                   // scaled page line
            var __startTop = __cl.getBoundingClientRect().top - __colEl.getBoundingClientRect().top;
            var __pageBottom = (Math.floor(Math.max(0, __startTop) / __lineSc) + 1) * __lineSc;
            __posOK = (__startTop + __h) <= (__pageBottom - hyst * __sc);
          }
        }
      } catch (_) {}
      if (__h > 0 && __h <= __fitLine && __posOK && !__young) {
        // Section now fits on one page with margin AND the break has had time to
        // settle → CLEAR the break (omit from map). The (CONT.) tail flows back
        // to page 1. Drop the born-stamp so a future re-break starts a fresh hold.
        delete __breakBornAt[bornKey(ek)];
        continue;
      }
      // Still overflows (or unmeasurable) → keep the break. EXCEPTION: on a
      // width change, the MAIN column gets a fresh detection pass below, so we
      // drop main breaks here and let the detector re-create them at the new
      // (narrower) width. Sidebar / CL keep their carried break.
      // Heuristic for "is main": a table section in CV is CORE COMPETENCIES
      // (main); a non-table, non-list-in-sidebar is main too. We detect column
      // membership at detection time, so here we simply free ALL non-sidebar
      // carried breaks on a width change when the section still overflows —
      // the detector will immediately re-break it if it still must.
      if (widthChanged && !tight && !__young) {
        // RECLAIM_FREE_MAIN: drop and let the detector below re-decide. Safe
        // because the same pass re-detects; if it still overflows it is
        // re-broken at the correct (new-width) index, fixing the coupling where
        // a widened sidebar narrows main past the line. MAINBAR-FLIP-FIX-001:
        // only free a MATURE break — a young one is held (re-freeing it would
        // re-create + re-stamp and reintroduce the boundary flip).
        delete __breakBornAt[bornKey(ek)];
        continue;
      }
      // Keep the carried break; preserve its existing born-stamp so the
      // creation hold runs out normally and a genuinely-fitting section can
      // clear once the hold lapses. (We must NOT refresh here — refreshing on
      // every keep would make the stamp permanently young and the break could
      // never clear.)
      map[ek] = existing[ek];
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

    // SALMON-UNIFIED-001 Phase C: per-column block geometry collected DURING the
    // detection loop (no extra DOM pass), consumed by the coordinator after the
    // loop to align both columns to one shared sheet boundary per page. Each
    // entry: { sid, kind, key, top, bottom } in UNSCALED px from the SHEET top
    // (the column top, which for both columns is the same page-box top). Keyed by
    // column role so the coordinator can tell sidebar from main.
    var __uniBlocks = { sidebar: [], main: [] };

    for (var c = 0; c < cols.length; c++) {
      var col = cols[c];
      var isMainCol = !!(col.classList && (col.classList.contains('antcv-document-main')))
        || col.getAttribute('data-antcv-document-main') === 'true';
      if (deferMainDetect && isMainCol) continue;   // two-phase: detect main next pass
      var colTop = col.getBoundingClientRect().top;
      var __uniBucket = isMainCol ? __uniBlocks.main : __uniBlocks.sidebar;
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
          // SIDEBAR-PREVIEW-BREAK-EARLY-001 (owner 2026-06-21, FORCE variant): the PREVIEW
          // OVER-fills page 1 — it packs MORE sidebar items onto page 1 than the (taller-
          // rendered) PDF page holds, so the sidebar fits the 1123px preview page-box and gets
          // NO break, leaving page-2's sidebar empty while the PDF correctly continues it to
          // page 2. So FORCE a break at the tightened (PDF-equivalent) line even when it fits
          // the normal A4 line, so Languages→page 2 matches the PDF. PREVIEW MAP ONLY: the
          // EXPORT pass (autoKey !== PREVIEW_KEY) is UNTOUCHED → the DOCX keeps its own sidebar
          // break (owner: removing it breaks the DOCX) and we never feed the worker a forwarded
          // sidebar break. Oscillation is prevented by the matching tightened CLEAR line above.
          // SALMON-NPAGE-LIMIT-MISMATCH-001 (2026-06-23): the FORCE-preview sidebar
          // case computes the SEED break at the TIGHTENED line, but the N-page greedy
          // walk below (allOverflowPages) used the FULL `limit` — the two disagreed and
          // emitted DUPLICATE page-2 entries for one section (e.g. {"11":2,"12":2}),
          // a duplicate-salmon source in the preview. Capture the effective line ONCE
          // and use it for BOTH the seed and the greedy walk so every preview sidebar
          // page boundary tracks the same (PDF-equivalent) line. PREVIEW MAP ONLY — the
          // export pass keeps the full `limit` untouched (the DOCX sidebar break safety
          // rule). The matching CLEAR line above already uses this tightened base.
          var __forcePrevSidebar = (!isMainCol && autoKey === PREVIEW_KEY && SIDEBAR_PREVIEW_INFLATE > 1);
          var __effLimit = __forcePrevSidebar ? (limit / SIDEBAR_PREVIEW_INFLATE) : limit;
          var idx = firstOverflowItem(secEl, colTop, __effLimit);
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
            // SIDEBAR-SNAP-GAP-001 (owner 2026-06-11): snapping a list break UP
            // to a group start keeps the group whole, but when the group start
            // sits far above the A4 line it leaves a big DEAD GAP between the last
            // page-1 item and the salmon (owner screenshot + diag: REGULATORY
            // CONTEXT stub ended at ~933 on a 1051 line — 118px wasted — because
            // the break snapped to the next sub-group start instead of filling to
            // the line). The whole-group-tidiness is not worth >SNAP_GAP_MAX px of
            // empty page. So: measure where the SNAPPED item actually sits; if the
            // snap pulls the break more than SNAP_GAP_MAX above the line, fall back
            // to the RAW overflow item (idx) and fill the page, accepting a
            // mid-group cut — same trade-off the br<1 fallback above already makes,
            // just extended from "no boundary exists" to "snapping wastes too much
            // page." When the snap is close to the line (small gap), keep it (group
            // stays whole). Threshold is generous (one short list row ≈ 26px, a
            // grouped sub-heading + first row ≈ 60px) so we only override on a
            // genuinely large waste, never on a 1-row tidy-up.
            if (br >= 1 && br < idx) {
              var __snapEl = secEl.querySelector('[' + ITEM_PATH_ATTR + '="items.' + br + '"]');
              if (__snapEl && visible(__snapEl)) {
                var __snapBottom = __snapEl.getBoundingClientRect().bottom - colTop;
                // __effLimit is the scaled fill line (tightened on the force-preview pass);
                // SNAP_GAP_MAX is unscaled px, scale it. SALMON-NPAGE-LIMIT-MISMATCH-001:
                // measure the wasted gap against the SAME line we fill to.
                if ((__effLimit - __snapBottom) > (SNAP_GAP_MAX * scale)) br = idx;
              }
            }
          }
        }
        if (br >= 1) {
          map[sid] = {};
          // SALMON-UNIFIED-001 Phase B: when the flag is on, expand the sidebar
          // ITEM/LIST branch to N pages (page 3, 4, …) by greedily continuing
          // past the first break. Tables keep the single-break path (their row
          // pagination is handled separately), and the EXPERIENCE main column is
          // untouched here. The greedy map already includes the page-2 seed.
          var __isTable = (sec && sec.type === 'table') || !!secEl.querySelector('table');
          if (SIDEBAR_NPAGE && !isMainCol && !__isTable) {
            // SALMON-NPAGE-LIMIT-MISMATCH-001: greedy walk on the SAME line as the seed.
            var __nmap = allOverflowPages(secEl, sec, colTop, __effLimit, scale, br);
            map[sid] = __nmap && Object.keys(__nmap).length ? __nmap : (function () { var o = {}; o[String(br)] = 2; return o; })();
          } else {
            map[sid][String(br)] = 2;
          }
          if (!__breakBornAt[bornKey(sid)]) __breakBornAt[bornKey(sid)] = nowMs(); }   // MAINBAR-FLIP-FIX-001
      }

      // SALMON-UNIFIED-001 Phase C: record this column's atomic blocks (item rows
      // + experience role wrappers) in UNSCALED px from the column top, for the
      // coordinator below. DET-COORD-001 (owner 2026-06-25): feed it on BOTH passes
      // (export + preview) so the deterministic coordinator unifies the PREVIEW too
      // (that is where the dancing showed). CV only. Tables are recorded by tbody row
      // so a row-split section still contributes a boundary.
      if (SIDEBAR_UNIFIED && doc === 'cv') {
        try {
          var __rowEls = col.querySelectorAll('[' + ITEM_PATH_ATTR + '^="items."]');
          for (var __ri = 0; __ri < __rowEls.length; __ri++) {
            var __rEl = __rowEls[__ri];
            if (!visible(__rEl)) continue;
            var __rm = /^items\.(\d+)/.exec(String(__rEl.getAttribute(ITEM_PATH_ATTR) || ''));
            if (!__rm) continue;
            var __rSidEl = __rEl.closest ? __rEl.closest('[data-sid]') : null;
            var __rc = __rEl.getBoundingClientRect();
            __uniBucket.push({
              sid: __rSidEl ? __rSidEl.getAttribute('data-sid') : null,
              kind: 'item', key: __rm[1],
              top: (__rc.top - colTop) / scale,
              bottom: (__rc.bottom - colTop) / scale,
            });
          }
          var __roleEls2 = col.querySelectorAll('[data-antcv-role-index]');
          for (var __qi = 0; __qi < __roleEls2.length; __qi++) {
            var __qEl = __roleEls2[__qi];
            if (!visible(__qEl)) continue;
            var __qSidEl = __qEl.closest ? __qEl.closest('[data-sid]') : null;
            var __qc = __qEl.getBoundingClientRect();
            __uniBucket.push({
              sid: __qSidEl ? __qSidEl.getAttribute('data-sid') : null,
              kind: 'role', key: __qEl.getAttribute('data-antcv-role-index'),
              top: (__qc.top - colTop) / scale,
              bottom: (__qc.bottom - colTop) / scale,
            });
          }
          // DET-COORD-003 (owner 2026-06-25): TABLE sections (CORE COMPETENCIES) carry real
          // height but had NO row-path / role blocks, so the coordinator under-counted the main
          // column by the table's height and left an extra role on page 1 (System Architect
          // stuck there). Record each table's tbody rows as kind:'table' — their HEIGHT counts
          // in the cumulative flow, but __mapFromPaged never emits a break on them (tables keep
          // their own row-split path), so they push the roles down to the right page.
          var __tblRows = col.querySelectorAll('table tbody tr');
          for (var __wi = 0; __wi < __tblRows.length; __wi++) {
            var __wEl = __tblRows[__wi];
            if (!visible(__wEl)) continue;
            var __wSidEl = __wEl.closest ? __wEl.closest('[data-sid]') : null;
            var __wc = __wEl.getBoundingClientRect();
            __uniBucket.push({
              sid: __wSidEl ? __wSidEl.getAttribute('data-sid') : null,
              kind: 'table', key: 'tr' + __wi,
              top: (__wc.top - colTop) / scale,
              bottom: (__wc.bottom - colTop) / scale,
            });
          }
        } catch (_) {}
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
          // EXP-PREVIEW-GAP-001 (owner 2026-06-11, supersedes EXP-PREVIEW-CROWD-001):
          // experience roles are large ATOMIC blocks (role + 3-5 bullets). The CV
          // PREVIEW paginates into FIXED-HEIGHT page-boxes (1123px) and draws the
          // "▼ PAGE 2 ▼" salmon at the BOX boundary, not at the role's bottom. The
          // earlier crowd fix measured the role against the EXPORT line (USABLE_PDF
          // ~949px) in BOTH maps. In the preview that broke the role ~104px BEFORE
          // the box ends, so the last role on page 1 sat ~104px above the salmon —
          // a big dead gap between the role and the bar (owner screenshot 2026-06-11
          // "big gap between the role and salmon"). Fix: measure each map against
          // ITS OWN line — the export map at USABLE_PDF, the PREVIEW map at the true
          // A4 line (usableBase = USABLE ~1053px) — so the preview page-1 box FILLS
          // to the boundary and the salmon sits immediately after the last role.
          // `limit` is already usableBase*scale for this pass, so reuse it: a role
          // is atomic (never split), so breaking at the box line moves the first
          // role that crosses it wholly to page 2 and leaves the prior role flush
          // against the salmon.
          var __expLimit = limit;
          var roleEls = col.querySelectorAll('[data-antcv-role-index]');
          // SALMON-PAGE3-MISSING-001 (owner 2026-06-22): N-PAGE atomic role pagination.
          // Was 2-page scope — it broke the FIRST role crossing the line to page 2 and
          // stopped, so a 3-page CV had NO page2→3 salmon (owner: "page 3 break should
          // have been around the Security Guard role"). Now GREEDILY fill page-boxes: a
          // role whose bottom crosses the CURRENT page's A4 line moves WHOLE to the next
          // page, and that page then starts at the role's top; record the FIRST role of
          // each new page (2,3,…) — the render's monotonic role-page floor cascades the
          // rest. This pass only runs on the UNPAGINATED column (sticky-skips once a
          // break exists), so the cumulative role positions are measured in one flow.
          var __pageTop = colTop;   // viewport-top of the current page being filled
          var __curPage = 1;
          var __expMap = null;
          for (var ri = 0; ri < roleEls.length; ri++) {
            if (!visible(roleEls[ri])) continue;
            var __rr = roleEls[ri].getBoundingClientRect();
            // Role overflows the current page AND isn't the very first block on it (a role
            // taller than a whole page can't move — leave it to avoid an infinite push).
            if ((__rr.bottom - __pageTop) > __expLimit && (__rr.top - __pageTop) > 1) {
              __curPage++;
              __pageTop = __rr.top;   // the next page begins at this role's top
              var rmi = parseInt(roleEls[ri].getAttribute('data-antcv-role-index'), 10);
              if (rmi >= 1) (__expMap = __expMap || {})[String(rmi)] = __curPage;
            }
          }
          if (__expMap) { map[expSec.id] = __expMap;
            if (!__breakBornAt[bornKey(expSec.id)]) __breakBornAt[bornKey(expSec.id)] = nowMs(); }   // MAINBAR-FLIP-FIX-001
        }
      } catch (_) {}
    }

    // SALMON-UNIFIED-001 Phase C — DETERMINISTIC HEIGHT-BASED COORDINATOR.
    // ------------------------------------------------------------------
    // DET-COORD-001 (owner 2026-06-25 "just solve it / a lot of text dancing"): the prior
    // coordinator paginated by POSITION (block tops). Positions change every time a break
    // re-renders the layout, so the break pages shifted on each re-measure (dancing); and it
    // ran on the EXPORT pass only, so the PREVIEW (where the dancing shows) was never unified.
    // Replace with a DETERMINISTIC pass: order each column's atomic blocks by their DATA
    // position (section order, then item/role index) and paginate by CUMULATIVE INTRINSIC
    // HEIGHT (bottom-top — which does NOT change when the layout re-paginates). Same page
    // budget for both columns, so they align by construction. Runs on BOTH passes with each
    // pass's own budget. Deterministic input -> identical output every pass -> it converges,
    // so the salmon stops dancing AND late sections distribute to page 3/4 instead of piling.
    if (SIDEBAR_UNIFIED && doc === 'cv'
        && (__uniBlocks.sidebar.length || __uniBlocks.main.length)) {
      try {
        // PREVIEW=EXPORT-001 (owner 2026-06-25 "make both page 2 in both representations"):
        // unify BOTH passes on the EXPORT line (USABLE_PDF) instead of each pass's own budget.
        // The preview previously paginated at the taller A4 line, so it kept one more row on
        // page 1 than the export (System Architect stayed page 1 in preview, page 2 in export).
        // Same budget for both => the preview's page assignments match the PDF exactly.
        var __uniLimit = USABLE_PDF;
        function __secOrder(sid) {
          for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === sid) return i; }
          return 9999;
        }
        // Paginate a column's blocks by CUMULATIVE INTRINSIC HEIGHT, in DATA order.
        // band1 = the page-1 budget deduction for THIS column (the sidebar deducts more than
        // the main because the PHOTO sits at the sidebar's top — DET-COORD-004).
        // inflate: preview->export height multiplier for THIS column (sidebar renders ~1.2x
        // taller in the export than the preview measures; the coordinator must paginate in
        // EXPORT units or it over-fills page 2 and the export overflows/slides — owner 2026-06-25).
        // keepWholeFrac: keep-whole threshold (see KEEP_WHOLE_FRAC).
        function __uniPaginate(blocks, band1, inflate, keepWholeFrac) {
          if (band1 == null) band1 = PAGE1_BAND;
          if (!(inflate > 0)) inflate = 1;
          if (!(keepWholeFrac > 0)) keepWholeFrac = 1;
          var ordered = blocks.slice().sort(function (a, b) {
            var sa = __secOrder(a.sid), sb = __secOrder(b.sid);
            if (sa !== sb) return sa - sb;
            return ((parseInt(a.key, 10) || 0) - (parseInt(b.key, 10) || 0));
          });
          // KEEP-WHOLE (DET-COORD-003): per-section total height. A section that fits within a
          // single page is never SPLIT across pages — if it can't fit the space left on the
          // current page it starts whole on the next one (so CERTIFICATES, CORE COMPETENCIES,
          // profile move as a unit, not item-by-item). Big sections (the 12-role experience, a
          // page-plus regulatory) exceed a page, so keep-whole is skipped and they flow per block.
          // GROUP boundaries: a section's items[i].grp marks a group start. Keep-whole then
          // operates per GROUP, not per section — so a big section (REGULATORY CONTEXT) breaks
          // BETWEEN its groups (each group intact), instead of whole-moving and leaving a short
          // page. Sections with no groups = one group = whole-section keep-whole (unchanged).
          var __grpStarts = {};
          (list || []).forEach(function (sec) {
            if (!sec || !Array.isArray(sec.items)) return;
            var st = [];
            sec.items.forEach(function (it, idx) { if (it && it.grp != null && it.grp !== '') st.push(idx); });
            if (st.length) __grpStarts[sec.id] = st;
          });
          function __groupOf(sid, key) {
            var st = __grpStarts[sid];
            if (!st || !st.length) return sid + '#0';
            var k = parseInt(key, 10) || 0, g = st[0];
            for (var j = 0; j < st.length; j++) { if (st[j] <= k) g = st[j]; else break; }
            return sid + '#' + g;
          }
          var grpTot = {};
          ordered.forEach(function (b) { var gk = __groupOf(b.sid, b.key); grpTot[gk] = (grpTot[gk] || 0) + Math.max(0, b.bottom - b.top) * inflate; });
          var used = 0, page = 1, out = [], curGroup = null;
          for (var i = 0; i < ordered.length; i++) {
            var b = ordered[i];
            var h = Math.max(0, b.bottom - b.top) * inflate;
            // PAGE 1 is SHORTER than pages 2+ — the candidate header band sits above both
            // columns (worker: page-1 body ~2978 DXA less). Deduct PAGE1_BAND from page 1's
            // budget so the columns don't over-fill page 1 (which is why certs + the later
            // roles belonged on page 2). A block taller than a page can't move; it stays.
            var cap = (page === 1) ? Math.max(300, __uniLimit - band1) : __uniLimit;
            var gk = __groupOf(b.sid, b.key);
            if (gk !== curGroup) {
              curGroup = gk;
              var gt = grpTot[gk] || 0;
              // keep each GROUP whole: if it won't fit the current page, start it on the next.
              if (used > 0 && gt <= __uniLimit * keepWholeFrac && (used + gt) > cap) { page++; used = 0; cap = __uniLimit; }
            }
            if (used > 0 && (used + h) > cap) { page++; used = 0; }
            used += h;
            out.push({ sid: b.sid, kind: b.kind, key: b.key, page: page });
          }
          return out;
        }
        // First-of-page break map for page > 1 (the render's monotonic floor cascades the rest).
        function __mapFromPaged(paged, isExperience) {
          var perSid = {}, seenPage = {};
          for (var i = 0; i < paged.length; i++) {
            var b = paged[i];
            if (!b.sid) continue;                                      // unkeyed block — never emit a break
            if (isExperience ? (b.kind !== 'role') : (b.kind !== 'item')) continue;
            if (b.page <= 1) continue;
            var sk = b.sid + '@' + b.page;
            if (seenPage[sk]) continue;
            seenPage[sk] = 1;
            (perSid[b.sid] = perSid[b.sid] || {})[String(b.key)] = b.page;
          }
          return perSid;
        }
        // SIDEBAR and MAIN are PARALLEL columns — paginate each on its OWN cumulative height
        // (NOT concatenated; concatenating stacked the sidebar after the main and pushed
        // tools/certs to page 3). The main column carries its ITEM blocks (profile/publications)
        // and its experience ROLE blocks together in document order (one flow); the sidebar is
        // its own flow. Extract item breaks per column + role breaks from the main flow.
        // AUTO sidebar band = main band + the measured photo reserve (per generation), unless
        // pinned by a numeric SIDEBAR_PAGE1_BAND.
        var __sbBand1 = (typeof SIDEBAR_PAGE1_BAND === 'number') ? SIDEBAR_PAGE1_BAND : (PAGE1_BAND + __photoReserve());
        var __sPaged = __uniPaginate(__uniBlocks.sidebar, __sbBand1, SIDEBAR_PREVIEW_INFLATE, KEEP_WHOLE_FRAC);
        var __mPaged = __uniPaginate(__uniBlocks.main, PAGE1_BAND, 1, 1);
        var __reSidebar = __mapFromPaged(__sPaged, false);
        var __reMainItems = __mapFromPaged(__mPaged, false);
        var __reRole = __mapFromPaged(__mPaged, true);

        function __applyUnified(reMap) {
          for (var sid in reMap) {
            if (!reMap.hasOwnProperty(sid)) continue;
            if (!Object.keys(reMap[sid]).length) continue;
            var __sec2 = sectionById(list, sid);
            if (__sec2 && __sec2.type === 'table') continue;   // tables keep their row-split
            map[sid] = reMap[sid];
            if (!__breakBornAt[bornKey(sid)]) __breakBornAt[bornKey(sid)] = nowMs();
          }
        }
        __applyUnified(__reSidebar);
        __applyUnified(__reMainItems);
        __applyUnified(__reRole);
        var __reItem = Object.assign({}, __reSidebar, __reMainItems);   // for RECONCILE below

        // RECONCILE: a coordinator-measured ITEM section that a per-column pass broke but the
        // deterministic pass did NOT re-affirm (it fits page 1 now) -> clear its stale break so
        // `map` matches the deterministic pagination exactly. Tables/experience untouched.
        var __uniSids = {};
        __uniBlocks.sidebar.concat(__uniBlocks.main).forEach(function (b) {
          if (b.sid && b.kind === 'item') __uniSids[b.sid] = 1;
        });
        for (var __ms in map) {
          if (!map.hasOwnProperty(__ms)) continue;
          if (!__uniSids[__ms]) continue;
          if (__reItem[__ms]) continue;
          var __mSec = sectionById(list, __ms);
          if (__mSec && (__mSec.type === 'table' || __mSec.type === 'experience')) continue;
          delete map[__ms];
          delete __breakBornAt[bornKey(__ms)];
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
                if (kKey) { map[clSid] = {}; map[clSid][kKey] = __clPageNo; brokeItem = true;
                  if (!__breakBornAt[bornKey(clSid)]) __breakBornAt[bornKey(clSid)] = nowMs(); }   // MAINBAR-FLIP-FIX-001
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
              if (rIdx >= 1) { map[clSid] = {}; map[clSid][String(rIdx)] = __clPageNo; brokeRow = true;
                if (!__breakBornAt[bornKey(clSid)]) __breakBornAt[bornKey(clSid)] = nowMs(); }   // MAINBAR-FLIP-FIX-001
            }
            if (!brokeItem && !brokeRow) {
              // Mirror app.js __antcvFirstKey so __antcvSecStart picks the break up.
              var fk = (clSec && clSec.type === 'text_bullets')
                ? ((clSec.intro != null && String(clSec.intro).trim()) ? 'intro' : 'bullet_0')
                : '0';
              map[clSid] = {}; map[clSid][fk] = __clPageNo;
              if (!__breakBornAt[bornKey(clSid)]) __breakBornAt[bornKey(clSid)] = nowMs();   // MAINBAR-FLIP-FIX-001
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
  // SIDEBAR-DRAG-DANCE-001 (owner 2026-06-11 "sidebar still dancing; only stops
  // when I click to edit text"): during a splitter drag the sidebar width
  // changes on every pointer tick, so the live layout (and the viewport dims in
  // sourceFingerprint) churns. The measurer fired repeatedly on a DOM React was
  // still re-laying-out → write → re-render → measure → the salmon "danced."
  // Clicking to edit settled the layout into one stable fingerprint, so the next
  // pass converged and the dance stopped. FIX: suspend the measurer WHILE a drag
  // is in progress and run ONE clean settle pass after pointer-up, once the
  // layout has stabilised. Covers both the native left-sidebar drag and the
  // reverse-drag sidecar — both go through the same .antcv-col-splitter element.
  var dragActive = false;
  var dragSettleTimer = 0;
  var dragGuardTimer = 0;
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

  // BOOT-MEASURER-DEFER-001: kill switch (attribution + owner debug, mirrors the
  // storm-damper's antcv:disable-storm-damp). When set, run() early-returns so the
  // expensive compute never blocks the main thread — used to measure the measurer's
  // exact share of boot blocking, and as an escape hatch if pagination ever wedges.
  function measurerDisabled() {
    try { return window.__antcvAutoPBoff === true || localStorage.getItem('antcv:disable-autopagebreak') === '1'; }
    catch (_) { return false; }
  }

  function run() {
    try {
      var now = nowMs();
      if (measurerDisabled()) return;
      // SIDEBAR-DRAG-DANCE-001: never measure mid-drag — the layout is still
      // moving and any write would feed the dance. The pointer-up handler runs
      // one settle pass once things stop.
      if (dragActive) return;
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
      // SIDEBAR-SHRINK-RECLAIM-001: `tight` is set only on the delayed routine
      // recheck (40px band) — the reactive pass uses the stable 120px band.
      var tight = !!run.__tight;
      var mapExport = compute(USABLE_PDF, AUTO_KEY, tight);
      var mapPreview = compute(USABLE, PREVIEW_KEY, tight);
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
      // SIDEBAR-SHRINK-RECLAIM-001: after the stable-band pass settles, run ONE
      // tight-band recheck (40px) to reclaim the last line the stable band held
      // back. Owner spec: "do stable but also execute checks routinely after a
      // few seconds … for 40px." Guarded so it can only fire once per settle
      // (cleared whenever a fresh reactive pass runs) — it cannot loop because
      // tight only ever CLEARS or holds breaks, never widens the source.
      run.__tight = false;
      if (armTightRecheck) armTightRecheck();
    } catch (e) {
      try { console.warn('[v' + VERSION + ' auto-pagebreak] run failed:', e && e.message); } catch (_) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    // A genuine reactive trigger always runs the STABLE band first.
    run.__tight = false;
    requestAnimationFrame(function () {
      pending = false;
      setTimeout(run, 250);
    });
  }

  // SIDEBAR-SHRINK-RECLAIM-001: delayed TIGHT recheck. Armed after a reactive
  // pass settles; fires once with the 40px band to reclaim the last line. It
  // bypasses the source-fingerprint gate (same source, tighter band) by forcing
  // a one-shot recompute, but is still protected by the post-write cooldown and
  // the 8-writes/4s circuit breaker, and cannot loop (tight only clears/holds).
  var __tightTimer = 0;
  function armTightRecheck() {
    try {
      if (__tightTimer) clearTimeout(__tightTimer);
      __tightTimer = setTimeout(function () {
        __tightTimer = 0;
        run.__tight = true;
        lastSourceFp = null;   // one-shot: allow this single tighter recompute
        run();
      }, RECHECK_MS);
    } catch (_) {}
  }

  // SIDEBAR-DRAG-DANCE-001: capture-phase pointerdown on a splitter starts a
  // drag-suspend; window pointerup/cancel ends it and arms one settle pass.
  // Capture phase so we see it even though the splitter handlers stopPropagation.
  function installDragSuspend() {
    function onDown(ev) {
      try {
        var t = ev && ev.target;
        if (!t || !t.closest) return;
        if (!t.closest('.antcv-col-splitter')) return;
        dragActive = true;
        if (dragSettleTimer) { clearTimeout(dragSettleTimer); dragSettleTimer = 0; }
        // Safety: if pointerup is ever missed (released outside the window, lost
        // capture), auto-clear so the measurer can't freeze permanently.
        if (dragGuardTimer) clearTimeout(dragGuardTimer);
        dragGuardTimer = setTimeout(function () {
          dragGuardTimer = 0;
          if (dragActive) { dragActive = false; cooldownUntil = 0; lastSourceFp = null; schedule(); }
        }, 8000);
      } catch (_) {}
    }
    function onUp() {
      if (!dragActive) return;
      dragActive = false;
      if (dragGuardTimer) { clearTimeout(dragGuardTimer); dragGuardTimer = 0; }
      // Let React commit the final width + re-paginate, THEN measure once. The
      // ratio is persisted on pointer-up by the splitter, so the source has
      // genuinely changed; clear the gate so this single settle pass runs even
      // if the cooldown from a pre-drag write is still warm.
      if (dragSettleTimer) clearTimeout(dragSettleTimer);
      dragSettleTimer = setTimeout(function () {
        dragSettleTimer = 0;
        cooldownUntil = 0;
        lastSourceFp = null;
        schedule();
      }, 350);
    }
    try {
      window.addEventListener('pointerdown', onDown, { capture: true, passive: true });
      window.addEventListener('pointerup', onUp, { capture: true, passive: true });
      window.addEventListener('pointercancel', onUp, { capture: true, passive: true });
    } catch (_) {}
  }

  function start() {
    installDragSuspend();
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
    // SIDEBAR-SHRINK-RECLAIM-001 runtime A/B knobs (console-tunable):
    //   AntcvAutoPagebreak.config({ ONE_PASS:false })  // try two-phase
    //   AntcvAutoPagebreak.config({ HYST_STABLE:80 })  // looser stable band
    config: function (o) {
      try {
        if (!o) return { ONE_PASS: ONE_PASS, HYST_STABLE: HYST_STABLE, HYST_TIGHT: HYST_TIGHT, RECHECK_MS: RECHECK_MS, SNAP_GAP_MAX: SNAP_GAP_MAX, SIDEBAR_PREVIEW_INFLATE: SIDEBAR_PREVIEW_INFLATE, SIDEBAR_NPAGE: SIDEBAR_NPAGE, SIDEBAR_UNIFIED: SIDEBAR_UNIFIED, ABSOLUTE_PAGING: ABSOLUTE_PAGING, PAGE1_BAND: PAGE1_BAND, SIDEBAR_PAGE1_BAND: SIDEBAR_PAGE1_BAND, KEEP_WHOLE_FRAC: KEEP_WHOLE_FRAC };
        if (typeof o.ONE_PASS === 'boolean') ONE_PASS = o.ONE_PASS;
        if (typeof o.HYST_STABLE === 'number') HYST_STABLE = o.HYST_STABLE;
        if (typeof o.HYST_TIGHT === 'number') HYST_TIGHT = o.HYST_TIGHT;
        if (typeof o.RECHECK_MS === 'number') RECHECK_MS = o.RECHECK_MS;
        if (typeof o.SNAP_GAP_MAX === 'number') SNAP_GAP_MAX = o.SNAP_GAP_MAX;
        if (typeof o.SIDEBAR_PREVIEW_INFLATE === 'number' && o.SIDEBAR_PREVIEW_INFLATE >= 1 && o.SIDEBAR_PREVIEW_INFLATE <= 2) SIDEBAR_PREVIEW_INFLATE = o.SIDEBAR_PREVIEW_INFLATE;
        if (typeof o.SIDEBAR_NPAGE === 'boolean') SIDEBAR_NPAGE = o.SIDEBAR_NPAGE;
        if (typeof o.SIDEBAR_UNIFIED === 'boolean') SIDEBAR_UNIFIED = o.SIDEBAR_UNIFIED;
        if (typeof o.ABSOLUTE_PAGING === 'boolean') ABSOLUTE_PAGING = o.ABSOLUTE_PAGING;
        if (typeof o.PAGE1_BAND === 'number') PAGE1_BAND = o.PAGE1_BAND;
        if (typeof o.SIDEBAR_PAGE1_BAND === 'number') SIDEBAR_PAGE1_BAND = o.SIDEBAR_PAGE1_BAND;
        if (typeof o.KEEP_WHOLE_FRAC === 'number' && o.KEEP_WHOLE_FRAC > 0 && o.KEEP_WHOLE_FRAC <= 1) KEEP_WHOLE_FRAC = o.KEEP_WHOLE_FRAC;
        lastSourceFp = null; schedule();
        return { ONE_PASS: ONE_PASS, HYST_STABLE: HYST_STABLE, HYST_TIGHT: HYST_TIGHT, RECHECK_MS: RECHECK_MS, SNAP_GAP_MAX: SNAP_GAP_MAX, SIDEBAR_PREVIEW_INFLATE: SIDEBAR_PREVIEW_INFLATE, SIDEBAR_NPAGE: SIDEBAR_NPAGE, SIDEBAR_UNIFIED: SIDEBAR_UNIFIED, ABSOLUTE_PAGING: ABSOLUTE_PAGING, PAGE1_BAND: PAGE1_BAND, SIDEBAR_PAGE1_BAND: SIDEBAR_PAGE1_BAND, KEEP_WHOLE_FRAC: KEEP_WHOLE_FRAC };
      } catch (_) { return null; }
    },
    // Manual reset of auto breaks (e.g. from console) if a stale break
    // ever sticks: AntcvAutoPagebreak.clear()
    clear: function () {
      try {
        // CLEAR-BOTH-MAPS-001 (owner 2026-06-11): clear() pre-dated the
        // preview-map decouple (1.50.316) and only reset AUTO_KEY (the export
        // map). The PREVIEW map (PREVIEW_KEY) was left intact, so a stale
        // experience break — e.g. autoPagesPreview[exp]={"4":2} that the
        // exp-crowd fix should replace with {"3":2} — survived clear() and,
        // because experience is sticky, never flipped. Reset BOTH maps and BOTH
        // change-guards so a single clear() genuinely drops every auto break and
        // the next compute writes fresh in both targets.
        localStorage.setItem(AUTO_KEY, '{}');
        localStorage.setItem(PREVIEW_KEY, '{}');
        lastWritten = '{}';
        lastWrittenPreview = '{}';
        lastSourceFp = null;
        __breakBornAt = {};   // MAINBAR-FLIP-FIX-001
        window.dispatchEvent(new CustomEvent('antcv:auto-pages-changed',
          { detail: { source: 'auto-pagebreak-001-clear' } }));
      } catch (_) {}
    },
  };
  try { console.debug('[auto-pagebreak-001] installed ' + VERSION + ' (autoPages measurer)'); } catch (_) {}
})();
