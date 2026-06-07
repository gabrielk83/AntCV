/* AntCV auto page-break (block-level) sidecar — v1.50.267
 * ============================================================
 * Owner feature AUTO-PAGEBREAK-BLOCK-001 (FEATURES_REGISTRY).
 *
 * Purpose
 * -------
 * When a single .antcv-page-row's content exceeds A4 height (1123px
 * at 96dpi), split the overflow into a NEW .antcv-page-row appended
 * after it, with a salmon-coloured visual splitter between them.
 *
 * Splits are block-level — a whole top-level section (data-sid="…")
 * moves to the next page, never split mid-section. ANY section
 * containing more than one child block (typically: header +
 * items / roles / bullets / regulatory groups) is intra-section
 * splittable — the header stays on page 1 with the children that
 * fit, the rest move to page 2 wrapped in a clone of the section
 * element. Sections that cannot meaningfully split inside (e.g.
 * CORE COMPETENCIES = header + single table, work_style = single
 * paragraph) fall back to whole-section move automatically because
 * findIntraSectionSplit returns null on header-plus-one-unsplittable.
 *
 * Architecture
 * ------------
 * 1. Find "primary" page-rows (not marked as injected by us).
 * 2. For each primary, FIRST undo any previous auto-splits — collect
 *    children of injected siblings back into the primary, remove the
 *    injected siblings. This makes the sidecar idempotent under
 *    re-renders.
 * 3. Measure each column (sidebar / main) of the primary. Walk
 *    children top to bottom, summing offsetHeight + margins. The
 *    FIRST child whose cumulative bottom exceeds the page limit is
 *    the split candidate.
 * 4. If the offending child is a section with intra-section split
 *    eligibility (currently `experience`): try to split BETWEEN its
 *    own children (header stays on page 1; later roles move to
 *    page 2 wrapped in a clone of the section element, header
 *    omitted).
 * 5. Otherwise (or if intra-split isn't possible): move the
 *    offending child and ALL later siblings to a new page-row.
 * 6. Insert a salmon splitter <div> between the primary and the new
 *    row.
 * 7. Recurse: the new row may itself overflow; loop with a 6-split
 *    safety cap.
 *
 * Both columns split INDEPENDENTLY — sidebar finds its own overflow
 * point, main finds its own. This is standard CV layout: page 2's
 * sidebar starts with whatever section overflowed on page 1, page
 * 2's main does the same. The two columns can end at different Y
 * positions on each page; that's OK on paper.
 *
 * Trade-offs
 * ----------
 * - Intra-section splitting works for ANY section with multiple
 *   children (header + items). Examples: EXPERIENCE roles, OUTCOMES
 *   bullets, REGULATORY group + items, TOOLS rows, CERTIFICATIONS
 *   list, EDUCATION list, PUBLICATIONS list, ADDITIONAL INFO rows.
 * - Sections with only one splittable child fall back to whole-
 *   section move: CORE COMPETENCIES (header + 1 table-wrap),
 *   work_style (1 paragraph), PROFILE (header + 1 paragraph).
 *   Follow-up: table-row split for CORE COMPETENCIES.
 * - Continuation pages have NO header for split sections (the
 *   header stays on page 1). Future: optional "(continued)" header.
 * - Continuation pages have EMPTY sidebars when only main
 *   overflows, and vice versa. Acceptable on paper (blank navy
 *   column / blank white column).
 * - Photo (sidebar's first child without data-sid) is anchored to
 *   page 1 — never moved.
 * - REGULATORY group-labels (sub-headers within the section)
 *   could theoretically orphan if the split lands right after a
 *   group-label. Future: detect group-label boundaries and bias
 *   the split point to BEFORE the orphaned label.
 *
 * Interaction with manual page=2,3,4 markers
 * ------------------------------------------
 * The React render already creates one .antcv-page-row per distinct
 * `s.page` value (manual paging). This sidecar processes each
 * primary page-row INDEPENDENTLY. Manual + auto stack cleanly.
 *
 * DOCX export
 * -----------
 * Unaffected. The docx-worker renders independently with its own
 * `cantSplit`-based pagination.
 */
(function () {
  'use strict';

  var VERSION = '1.50.267';
  var PAGE_HEIGHT_PX = 1123; // A4 at 96dpi
  var SALMON = '#fa8072';
  var SPLITTER_CLASS = 'antcv-auto-page-splitter';
  var INJECTED_ATTR = 'data-antcv-auto-pagebreak-injected';
  // Item marker used by the labeled-list React renderer. Children
  // WITH this attribute are list items; children WITHOUT it (other
  // than the section header at index 0) are group sub-headers.
  var ITEM_PATH_ATTR = 'data-antcv-row-path';
  // 1.50.263: removed INTRA_SPLIT_SECTIONS allowlist — any section
  // is intra-section splittable. 1.50.264: when a section is a
  // labeled-list (mix of group sub-headers + items), restrict the
  // valid split points to GROUP BOUNDARIES so groups stay intact
  // across pages (no orphaned sub-header).

  if (window.__antcvAutoPagebreakInstalled) return;
  window.__antcvAutoPagebreakInstalled = VERSION;

  function isInjected(el) {
    return el && el.hasAttribute && el.hasAttribute(INJECTED_ATTR);
  }

  function isSplitter(el) {
    return el && el.classList && el.classList.contains(SPLITTER_CLASS);
  }

  function childHeight(el) {
    var style = getComputedStyle(el);
    var mt = parseFloat(style.marginTop) || 0;
    var mb = parseFloat(style.marginBottom) || 0;
    return el.offsetHeight + mt + mb;
  }

  function columnPadding(col) {
    if (!col) return 0;
    var s = getComputedStyle(col);
    return (parseFloat(s.paddingTop) || 0) + (parseFloat(s.paddingBottom) || 0);
  }

  function findPrimaryPageRows() {
    var rows = document.querySelectorAll('.antcv-page-row');
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      if (!isInjected(rows[i])) out.push(rows[i]);
    }
    return out;
  }

  function undoPreviousSplits(primary) {
    var sib = primary.nextElementSibling;
    while (sib) {
      var next = sib.nextElementSibling;
      if (isSplitter(sib)) {
        sib.remove();
      } else if (isInjected(sib)) {
        // Move children back into the primary's matching columns.
        var injSidebar = sib.querySelector('.antcv-document-sidebar');
        var primSidebar = primary.querySelector('.antcv-document-sidebar');
        if (injSidebar && primSidebar) {
          // If the first child of the injected sidebar is a CLONE of an
          // intra-split section (same data-sid as some child of primary),
          // merge its children back into the original instead of
          // appending the clone. This re-stitches an intra-split.
          mergeColumnTail(injSidebar, primSidebar);
        }
        var injMain = sib.querySelector('.antcv-document-main');
        var primMain = primary.querySelector('.antcv-document-main');
        if (injMain && primMain) {
          mergeColumnTail(injMain, primMain);
        }
        sib.remove();
      } else {
        break; // Stop at any unrelated sibling.
      }
      sib = next;
    }
  }

  function mergeColumnTail(srcCol, dstCol) {
    // For each first-level child of srcCol, if its data-sid matches a
    // descendant section in dstCol, merge its children INTO that
    // existing section (re-stitching an intra-split). For a
    // table-row split (1.50.265), re-stitch the tbody rows instead
    // of appending a second table. Otherwise just append.
    while (srcCol.firstChild) {
      var node = srcCol.firstChild;
      if (node.nodeType === 1 && node.getAttribute) {
        var sid = node.getAttribute('data-sid');
        if (sid) {
          var existing = null;
          var dchildren = dstCol.children;
          for (var k = 0; k < dchildren.length; k++) {
            if (dchildren[k].getAttribute && dchildren[k].getAttribute('data-sid') === sid) {
              existing = dchildren[k];
              break;
            }
          }
          if (existing) {
            // 1.50.266: walk the injected section's children. Skip any
            // child marked as INJECTED (our cloned header + cloned
            // table belong only to the page-2 copy; we must NOT push
            // them back into the page-1 original or we'd duplicate the
            // header and the table). For non-injected tables, merge
            // their tbody rows back into the existing table. For
            // anything else non-injected, move it to existing.
            var srcKids = Array.from(node.children);
            for (var nc = 0; nc < srcKids.length; nc++) {
              var child = srcKids[nc];
              if (isInjected(child)) {
                // Cloned header / cloned table — drop it.
                if (child.tagName === 'TABLE') {
                  // Inside the table-row case, the injected TABLE
                  // CONTAINS the moved tbody rows we DO want to put
                  // back. Pull those rows out, then drop the table.
                  var injTbody = child.querySelector('tbody');
                  var exTable = existing.querySelector && existing.querySelector('table');
                  var exTbody = exTable && exTable.querySelector('tbody');
                  if (injTbody && exTbody) {
                    while (injTbody.firstChild) {
                      exTbody.appendChild(injTbody.firstChild);
                    }
                  }
                }
                try { node.removeChild(child); } catch (_) {}
                continue;
              }
              existing.appendChild(child); // move
            }
            srcCol.removeChild(node);
            continue;
          }
        }
      }
      dstCol.appendChild(node); // appendChild moves the node.
    }
  }

  function isItemChild(el) {
    return !!(el && el.hasAttribute && el.hasAttribute(ITEM_PATH_ATTR));
  }

  function findChildrenLevelSplit(sectionEl, limit) {
    // Walk children: first child is the section header (title + separator),
    // it always stays with the section on page 1. Find the highest DOM
    // index `g` such that children[0..g-1] cumulative heights fit within
    // `limit` AND `g` is a "valid" split point for this section.
    //
    // Valid split points (1.50.266):
    //   - VISIBLE GROUP LABELS (children with no row-path attr beyond
    //     the header) — REGULATORY with the label rendered.
    //   - HIDDEN GROUP BOUNDARIES — when item row-path numbers skip a
    //     value, the missing index corresponds to a group label whose
    //     React render returned null (row.hidden=true OR no visible
    //     item follows). The DOM index immediately after the skip is
    //     a valid split point — the hidden label travels with its
    //     items conceptually even if it has no DOM presence.
    //
    // If neither visible nor hidden boundaries exist, fall back to
    // PLAIN-LIST: any index > 1 is valid. Single-text / header
    // sections still can't intra-split (bestSplit > 1 fails).
    var children = Array.from(sectionEl.children);
    if (children.length <= 1) return null;

    var validSplits = new Set();
    var sawItem = false;
    var lastRowIdx = -1;
    var lastWasItem = false;
    for (var m = 1; m < children.length; m++) {
      var c = children[m];
      if (!isItemChild(c)) {
        // Visible group sub-header.
        validSplits.add(m);
        lastWasItem = false;
        continue;
      }
      sawItem = true;
      var rp = c.getAttribute(ITEM_PATH_ATTR);
      var num = parseInt((rp || '').split('.').pop(), 10);
      if (!isNaN(num) && lastWasItem && num > lastRowIdx + 1) {
        // Row-path gap → hidden group label sat at the missing index.
        validSplits.add(m);
      }
      if (!isNaN(num)) lastRowIdx = num;
      lastWasItem = true;
    }

    var grouped = validSplits.size > 0 && sawItem;

    function isValidSplitIndex(i) {
      if (i <= 1) return false;
      if (grouped) return validSplits.has(i);
      return true;
    }

    var sum = childHeight(children[0]);
    var bestSplit = -1;
    for (var i = 1; i < children.length; i++) {
      if (isValidSplitIndex(i)) bestSplit = i;
      var h = childHeight(children[i]);
      if (sum + h > limit) {
        if (bestSplit > 1) return { startIndex: bestSplit };
        return null;
      }
      sum += h;
    }
    return null;
  }

  // 1.50.265: TABLE-ROW intra-split. Handles CV CORE COMPETENCIES and
  // CL "What I bring". The header row(s) of the table (thead) stay on
  // page 1 AND get cloned onto page 2 so the continuation table still
  // reads cleanly. Body rows from startIndex onward move to page 2.
  // Falls back to null when the section's overhead (section header +
  // table chrome + thead) already exceeds the page space — in that
  // case the column-level whole-section move fires.
  function findTableRowSplit(sectionEl, limit) {
    var table = sectionEl.querySelector && sectionEl.querySelector('table');
    if (!table) return null;
    var tbody = table.querySelector('tbody');
    if (!tbody) return null;
    var rows = Array.from(tbody.children);
    if (rows.length <= 1) return null; // No useful split with 1 or 0 rows.

    // sectionHeight: outer occupied space (offsetHeight + own margins).
    var st = getComputedStyle(sectionEl);
    var sectionHeight = sectionEl.offsetHeight
      + (parseFloat(st.marginTop) || 0)
      + (parseFloat(st.marginBottom) || 0);
    var bodyHeight = 0;
    for (var r = 0; r < rows.length; r++) bodyHeight += childHeight(rows[r]);
    var overhead = sectionHeight - bodyHeight;
    if (overhead < 0) overhead = 0;
    if (overhead >= limit) return null;

    var sum = overhead;
    for (var i = 0; i < rows.length; i++) {
      var h = childHeight(rows[i]);
      if (sum + h > limit) {
        if (i === 0) return null;
        return { startIndex: i };
      }
      sum += h;
    }
    return null;
  }

  function findIntraSectionSplit(sectionEl, limit) {
    // 1.50.265: dispatcher. Try children-level split first (covers
    // EXPERIENCE roles, REGULATORY groups, OUTCOMES bullets, HWIC
    // bullets/closing, Foundation hands_on/professionally, etc.).
    // If no children-level split works, try table-row split.
    var childrenSplit = findChildrenLevelSplit(sectionEl, limit);
    if (childrenSplit) {
      return { kind: 'children', startIndex: childrenSplit.startIndex };
    }
    var tableSplit = findTableRowSplit(sectionEl, limit);
    if (tableSplit) {
      return { kind: 'table-rows', startIndex: tableSplit.startIndex };
    }
    return null;
  }

  function findColumnSplit(column, limit) {
    if (!column) return null;
    var children = Array.from(column.children);
    if (!children.length) return null;
    var sum = 0;
    for (var i = 0; i < children.length; i++) {
      var c = children[i];
      var h = childHeight(c);
      if (sum + h > limit) {
        // 1.50.263: try intra-section split on ANY child that is a
        // section (has data-sid). 1.50.265: intra split may be
        // children-level or table-row-level — passed through via
        // intraKind so processOnce can dispatch the right applier.
        var sid = c.getAttribute && c.getAttribute('data-sid');
        if (sid) {
          var remaining = Math.max(0, limit - sum);
          var intra = findIntraSectionSplit(c, remaining);
          if (intra && intra.startIndex > 0) {
            return {
              kind: 'intra',
              beforeIndex: i,
              section: c,
              startIndex: intra.startIndex,
              intraKind: intra.kind || 'children',
            };
          }
        }
        if (i > 0) return { kind: 'whole', index: i };
        // 1.50.265: first column child overflows AND can't intra-split
        // (typically a single-text section taller than one page —
        // "no internal split of single text/headers" per owner spec).
        // Accept the oversized child on page 1 and KEEP WALKING so the
        // next section gets a chance to trigger a normal whole-section
        // move. Without this fall-through we'd return null and the
        // following section stays glued on the same oversized row.
      }
      sum += h;
    }
    return null;
  }

  function cloneEmptyColumn(srcCol) {
    return srcCol.cloneNode(false); // attrs preserved, no children.
  }

  function cloneEmptyRow(srcRow) {
    var newRow = srcRow.cloneNode(false);
    newRow.setAttribute(INJECTED_ATTR, '1');
    newRow.removeAttribute('data-antcv-page-fit-applied');
    newRow.style.maxHeight = '';
    newRow.style.overflow = 'visible';
    var srcSidebar = srcRow.querySelector('.antcv-document-sidebar');
    if (srcSidebar) newRow.appendChild(cloneEmptyColumn(srcSidebar));
    // Keep the col-splitter widget on continuation rows too (cosmetic).
    var srcColSplitter = srcRow.querySelector('.antcv-col-splitter');
    if (srcColSplitter) newRow.appendChild(srcColSplitter.cloneNode(true));
    var srcMain = srcRow.querySelector('.antcv-document-main');
    if (srcMain) newRow.appendChild(cloneEmptyColumn(srcMain));
    return newRow;
  }

  // 1.50.266: salmon page-drift splitter now carries the running page
  // number ("▼ PAGE N ▼ (auto)") so the user can see which page each
  // chunk lands on, matching the native __antcvSalmon style. The
  // "(auto)" suffix distinguishes from manual (sec.page / itemPages)
  // splitters which read "▼ PAGE N ▼".
  function makeSplitter(nextPg) {
    var el = document.createElement('div');
    el.className = SPLITTER_CLASS + ' no-print';
    el.setAttribute(INJECTED_ATTR, '1');
    el.style.cssText = [
      'border-top:3px solid rgba(250,128,114,0.7)',
      'margin:10px 0 5px',
      'display:flex',
      'justify-content:center',
      'background:rgba(250,128,114,0.08)',
      'padding:2px 0',
      'position:relative',
    ].join(';') + ';';
    var label = document.createElement('span');
    label.style.cssText = [
      'background:' + SALMON,
      'color:#fff',
      'font-size:9px',
      'padding:2px 12px',
      'border-radius:2px',
      'font-family:Arial,sans-serif',
      'letter-spacing:0.5px',
      'white-space:nowrap',
      'font-weight:700',
    ].join(';') + ';';
    label.textContent = '▼ PAGE ' + (nextPg || '?') + ' ▼ (auto)';
    el.appendChild(label);
    el.title = 'Auto page break — content exceeded A4 height (sidecar '
      + VERSION + ')';
    return el;
  }

  // 1.50.266: find the first deepest leaf with non-empty text content
  // (typically the section title <span> inside the header wrapper).
  function findFirstTextLeaf(root) {
    if (!root) return null;
    if (root.children && root.children.length > 0) {
      for (var i = 0; i < root.children.length; i++) {
        var r = findFirstTextLeaf(root.children[i]);
        if (r) return r;
      }
      return null;
    }
    if (root.textContent && root.textContent.trim()) return root;
    return null;
  }

  // 1.50.266: append " (CONT.)" to the cloned section header's title
  // text so the user sees the section name on the continuation page.
  // Removes contenteditable on the modified node so panel edits don't
  // accidentally fire from the continuation copy.
  function appendContSuffix(headerClone) {
    var titleEl = findFirstTextLeaf(headerClone);
    if (!titleEl) return;
    var existing = (titleEl.textContent || '').trim();
    if (!existing) return;
    if (/\(CONT\.\)\s*$/i.test(existing)) return; // already suffixed
    titleEl.textContent = existing + ' (CONT.)';
    try { titleEl.removeAttribute('contenteditable'); } catch (_) {}
  }

  function cloneSectionHeader(sectionEl) {
    var children = Array.from(sectionEl.children);
    if (!children.length) return null;
    var headerClone = children[0].cloneNode(true);
    headerClone.setAttribute(INJECTED_ATTR, '1');
    appendContSuffix(headerClone);
    return headerClone;
  }

  function moveColumnTail(srcCol, dstCol, fromIndex) {
    var children = Array.from(srcCol.children);
    for (var i = fromIndex; i < children.length; i++) {
      dstCol.appendChild(children[i]); // appendChild moves.
    }
  }

  function applyIntraSplit(sectionEl, startIndex, dstCol) {
    // Wrap the moved children in a CLONE of the section element so the
    // styling (background colour, padding, data-sid) is preserved on
    // the continuation page. The header (children[0]) stays with the
    // original on page 1; 1.50.266 also clones it (with " (CONT.)"
    // suffix) into the continuation section so the user sees the
    // section name on page 2.
    var sectionClone = sectionEl.cloneNode(false);
    sectionClone.setAttribute(INJECTED_ATTR, '1');
    var headerClone = cloneSectionHeader(sectionEl);
    if (headerClone) sectionClone.appendChild(headerClone);
    var children = Array.from(sectionEl.children);
    for (var i = startIndex; i < children.length; i++) {
      sectionClone.appendChild(children[i]);
    }
    dstCol.appendChild(sectionClone);
  }

  // 1.50.265: table-row split applier. Clones the section element
  // (shallow), creates a NEW table with a cloned thead + a fresh
  // tbody containing the moved overflow rows. Skips the
  // data-table-resize-wrap (continuation tables don't need a resize
  // handle — that lives only on the page-1 original).
  // 1.50.266: also clones the section header with " (CONT.)" suffix.
  function applyTableRowSplit(sectionEl, startIndex, dstCol) {
    var srcTable = sectionEl.querySelector && sectionEl.querySelector('table');
    if (!srcTable) return;
    var srcTbody = srcTable.querySelector('tbody');
    if (!srcTbody) return;
    var srcThead = srcTable.querySelector('thead');
    var sectionClone = sectionEl.cloneNode(false);
    sectionClone.setAttribute(INJECTED_ATTR, '1');
    var headerClone = cloneSectionHeader(sectionEl);
    if (headerClone) sectionClone.appendChild(headerClone);
    var tableClone = srcTable.cloneNode(false);
    tableClone.setAttribute(INJECTED_ATTR, '1');
    if (srcThead) tableClone.appendChild(srcThead.cloneNode(true));
    var tbodyClone = srcTbody.cloneNode(false);
    var rows = Array.from(srcTbody.children);
    for (var i = startIndex; i < rows.length; i++) {
      tbodyClone.appendChild(rows[i]); // appendChild moves
    }
    tableClone.appendChild(tbodyClone);
    sectionClone.appendChild(tableClone);
    dstCol.appendChild(sectionClone);
  }

  function processOnce(row, nextPg) {
    var sidebarCol = row.querySelector('.antcv-document-sidebar');
    var mainCol = row.querySelector('.antcv-document-main');
    if (!sidebarCol && !mainCol) return null;

    var sidebarLimit = PAGE_HEIGHT_PX - columnPadding(sidebarCol);
    var mainLimit = PAGE_HEIGHT_PX - columnPadding(mainCol);

    var sb = findColumnSplit(sidebarCol, sidebarLimit);
    var mn = findColumnSplit(mainCol, mainLimit);
    if (!sb && !mn) return null;

    var newRow = cloneEmptyRow(row);
    var newSidebar = newRow.querySelector('.antcv-document-sidebar');
    var newMain = newRow.querySelector('.antcv-document-main');

    if (sb && newSidebar) {
      if (sb.kind === 'intra') {
        if (sb.intraKind === 'table-rows') {
          applyTableRowSplit(sb.section, sb.startIndex, newSidebar);
        } else {
          applyIntraSplit(sb.section, sb.startIndex, newSidebar);
        }
        moveColumnTail(sidebarCol, newSidebar, sb.beforeIndex + 1);
      } else {
        moveColumnTail(sidebarCol, newSidebar, sb.index);
      }
    }
    if (mn && newMain) {
      if (mn.kind === 'intra') {
        if (mn.intraKind === 'table-rows') {
          applyTableRowSplit(mn.section, mn.startIndex, newMain);
        } else {
          applyIntraSplit(mn.section, mn.startIndex, newMain);
        }
        moveColumnTail(mainCol, newMain, mn.beforeIndex + 1);
      } else {
        moveColumnTail(mainCol, newMain, mn.index);
      }
    }

    var splitter = makeSplitter(nextPg);
    row.parentNode.insertBefore(splitter, row.nextSibling);
    row.parentNode.insertBefore(newRow, splitter.nextSibling);
    return newRow;
  }

  function processPrimary(primary) {
    try {
      undoPreviousSplits(primary);
      var current = primary;
      var maxIters = 6;
      // 1.50.266: track running page number; the FIRST auto-injected
      // splitter announces "PAGE 2", the next "PAGE 3", etc., per
      // primary chain. (If the primary itself is on a manual page > 1
      // via sec.page/itemPages, the user can read the numbering as
      // relative to this primary; reconciling with manual page= is a
      // tracked follow-up.)
      var nextPg = 2;
      while (maxIters-- > 0) {
        var next = processOnce(current, nextPg);
        if (!next) break;
        nextPg++;
        current = next;
      }
    } catch (e) {
      try {
        console.warn('[v' + VERSION + ' auto-pagebreak] failed:',
          e && e.message);
      } catch (_) {}
    }
  }

  // 1.50.267: content fingerprint of the WHOLE preview (primary rows +
  // injected continuation rows). A scroll-induced React re-render does
  // NOT change document content, so the fingerprint is identical and we
  // skip re-processing entirely — this is what stops the "text blinks
  // on scroll" loop. Only a genuine content edit changes the
  // fingerprint and triggers a real undo + re-split.
  function previewFingerprint() {
    try {
      var scroll = document.querySelector('.antcv-preview-scroll');
      var root = scroll || document.body;
      var rows = root.querySelectorAll('.antcv-page-row');
      var parts = [];
      for (var i = 0; i < rows.length; i++) {
        // textContent of each row, collapsed. Include row count + the
        // sidebar/main split ratio so a width drag still re-paginates.
        var t = (rows[i].textContent || '').replace(/\s+/g, ' ').trim();
        parts.push(t.length + ':' + t.slice(0, 40) + '|' + t.slice(-40));
      }
      // Also fold in the clientHeight of the scroll container — a
      // viewport resize (window/devtools) legitimately changes how much
      // fits per page, so it SHOULD re-paginate.
      var ch = scroll ? scroll.clientHeight : 0;
      return rows.length + '#' + ch + '#' + parts.join('§');
    } catch (_) { return String(Math.random()); }
  }

  var pending = null;
  var applying = false;           // hard guard: true while we mutate the DOM
  var lastFingerprint = null;     // content fingerprint of last successful run
  var runTimes = [];              // circuit-breaker: timestamps of recent runs
  var brokenUntil = 0;            // circuit-breaker: suppress runs until this ts

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }

  function doRun() {
    var now = nowMs();
    if (now < brokenUntil) return; // circuit breaker active

    // Skip if the document content hasn't changed since the last run.
    // This is the primary defence against the scroll re-render loop:
    // scrolling re-renders identical content → fingerprint matches →
    // we do nothing → no DOM mutation → no blink.
    var fp = previewFingerprint();
    if (fp === lastFingerprint) return;

    // Circuit breaker: if we've run > 12 times in the last 3s, the
    // page is fighting us (cross-sidecar feedback). Back off 6s and
    // log once so the situation is visible.
    runTimes.push(now);
    runTimes = runTimes.filter(function (t) { return now - t < 3000; });
    if (runTimes.length > 12) {
      brokenUntil = now + 6000;
      runTimes = [];
      try {
        console.warn('[v' + VERSION + ' auto-pagebreak] feedback detected — '
          + 'backing off 6s to protect the preview.');
      } catch (_) {}
      return;
    }

    applying = true;
    try {
      findPrimaryPageRows().forEach(processPrimary);
      // Fingerprint AFTER splitting: the split moved content into
      // injected rows but total text is unchanged, so the post-split
      // fingerprint equals what a subsequent scroll-render will
      // produce → next tick skips. Store it.
      lastFingerprint = previewFingerprint();
    } catch (e) {
      try {
        console.warn('[v' + VERSION + ' auto-pagebreak] run failed:',
          e && e.message);
      } catch (_) {}
    } finally {
      // Keep the guard up briefly so the trailing async mutations from
      // our own DOM moves (and any ResizeObserver/scroll cascade they
      // provoke in sibling sidecars) don't re-trigger us.
      setTimeout(function () { applying = false; }, 250);
    }
  }

  function schedule() {
    if (applying) return; // never queue while mutating
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () {
      pending = null;
      doRun();
    }, 350);
  }

  try {
    var mo = new MutationObserver(function (mutations) {
      // 1.50.267: hard guard — ignore EVERY mutation while we are (or
      // just were) applying our own DOM changes. This is the core fix
      // for the self-feedback blink: undoPreviousSplits + processOnce
      // move REAL content nodes, which previously read as "relevant"
      // external changes and re-triggered us in a tight loop.
      if (applying) return;
      var relevant = false;
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (m.target && (isInjected(m.target) || isSplitter(m.target))) continue;
        var added = m.addedNodes ? Array.from(m.addedNodes) : [];
        var removed = m.removedNodes ? Array.from(m.removedNodes) : [];
        var onlyOurs = function (n) { return isInjected(n) || isSplitter(n); };
        if ((added.length || removed.length)
          && added.every(onlyOurs) && removed.every(onlyOurs)) continue;
        relevant = true;
        break;
      }
      if (relevant) schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    [200, 800, 1800, 3500].forEach(function (ms) {
      setTimeout(schedule, ms);
    });
    // Genuine content-change signals from the app — these are the
    // events that SHOULD force a re-paginate (they fire on edits,
    // generation, language change, page-button clicks, etc.).
    ['antcv:sections-updated', 'antcv:item-pages-changed',
     'antcv:preview-rescale'].forEach(function (ev) {
      try { window.addEventListener(ev, schedule); } catch (_) {}
    });
  } catch (_) {}

  window.AntcvAutoPagebreak = {
    version: VERSION,
    run: function () { lastFingerprint = null; schedule(); },
  };
})();
