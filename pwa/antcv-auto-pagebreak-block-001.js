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

  var VERSION = '1.50.298';
  if (window.__antcvAutoPagebreakInstalled === VERSION) return;
  window.__antcvAutoPagebreakInstalled = VERSION;

  var AUTO_KEY = 'antcv:autoPages';
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
  var WORD_INFLATE = 1.11;
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

  function compute() {
    var doc = activeDoc();
    var list = sectionsFor(doc);
    if (!list.length) return readJson(AUTO_KEY, {});

    // STICKY: carry forward existing auto breaks for sections that
    // still exist. We only DETECT on sections without an auto break.
    var existing = readJson(AUTO_KEY, {});
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
      var limit = USABLE_PDF * scale;   // 1.50.298 Word-equivalent fill (see WORD_INFLATE)
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
          if (idx >= 1) br = snapToGroup(groupStarts(sec), idx);
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
    return map;
  }

  var lastWritten = null;
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

      var map = compute();
      // Mark this source as processed BEFORE any write/fire, so the
      // re-render our own write triggers (same source) early-returns.
      lastSourceFp = fp;

      var next = JSON.stringify(map);
      var cur = localStorage.getItem(AUTO_KEY) || '{}';
      if (next === cur) { lastWritten = next; return; }
      if (next === lastWritten) return;

      // Circuit breaker backstop: > 8 distinct writes in 4s → back off 8s
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

      localStorage.setItem(AUTO_KEY, next);
      lastWritten = next;
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
    setInterval(schedule, 3000);
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
