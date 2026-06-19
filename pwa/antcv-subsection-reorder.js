/* antcv-subsection-reorder.js — SUBSECTION-RENAME-REORDER-001 (owner 2026-06-19, feature #3)
 * ============================================================================
 * RENAME already works: a {group} subheading inside a labeled_list section is
 * inline-editable (component B, app.src.js ~5942). This sidecar adds the missing
 * REORDER: small ↑/↓ controls on each subsection subheading that move the WHOLE
 * subsection block (the {group} row + its following {l,v} rows, up to the next
 * {group}) within the section.
 *
 * A "subsection" = one {group:"…"} row followed by every {l,v} row until the next
 * {group} row or end-of-section. Sections affected: any labeled_list with >= 2
 * {group} rows (REGULATORY CONTEXT, TOOLS & METHODS, ADDITIONAL INFORMATION …).
 *
 * Storage-driven (the source of truth) — never guesses group rows from the DOM:
 * reads localStorage 'sections', moves the block in the section's items[], writes
 * back, dispatches antcv:sections-updated (the app re-hydrates the render, proven
 * by the 415 partition path). The injected controls are EDITOR-ONLY chrome — the
 * real DOCX/PDF export is built from the localStorage payload, not this DOM, so the
 * controls can never reach the export; @media print also hides them.
 *
 * Mirrors antcv-section-align.js: MutationObserver + throttle + idempotent marker.
 * Disable: localStorage['antcv:disable-subsection-reorder'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.50.702';
  if (window.__antcvSubsectionReorder) return;
  window.__antcvSubsectionReorder = VERSION;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-subsection-reorder'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function curDoc() { try { var d = JSON.parse(localStorage.getItem('doc') || '"cv"'); return (typeof d === 'string' ? d : 'cv').toLowerCase() === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }

  // ── pure helpers (unit-tested) ──────────────────────────────────────
  function groupIndices(items) { var g = []; if (Array.isArray(items)) items.forEach(function (r, i) { if (r && r.group !== undefined) g.push(i); }); return g; }
  // Split items into a preamble (rows before the first group) + one block per group.
  function splitBlocks(items) {
    var g = groupIndices(items);
    var preamble = items.slice(0, g.length ? g[0] : items.length);
    var blocks = [];
    for (var k = 0; k < g.length; k++) { var s = g[k], e = (k + 1 < g.length) ? g[k + 1] : items.length; blocks.push(items.slice(s, e)); }
    return { preamble: preamble, blocks: blocks };
  }
  // Move the block at group-ordinal `gi` by dir (-1 up / +1 down). Returns a NEW
  // items array, or null if the move is a no-op / out of range.
  function moveBlock(items, gi, dir) {
    if (!Array.isArray(items)) return null;
    var sb = splitBlocks(items), blocks = sb.blocks, tgt = gi + dir;
    if (gi < 0 || gi >= blocks.length || tgt < 0 || tgt >= blocks.length) return null;
    var b = blocks.slice(), m = b.splice(gi, 1)[0]; b.splice(tgt, 0, m);
    var out = sb.preamble.slice();
    b.forEach(function (blk) { out = out.concat(blk); });
    return out;
  }
  window.__antcvSubsectionReorderMove = moveBlock;   // exposed for the unit test

  // ── reorder a section in the store, on click ────────────────────────
  function applyReorder(sectionId, gi, dir) {
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { return; }
    var doc = curDoc(), list = b[doc];
    if (!Array.isArray(list)) return;
    var sec = list.filter(function (s) { return s && s.id === sectionId && s.type === 'labeled_list' && Array.isArray(s.items); })[0];
    if (!sec) return;
    var next = moveBlock(sec.items, gi, dir);
    if (!next) return;
    sec.items = next;
    try { localStorage.setItem('sections', JSON.stringify(b)); } catch (_) { return; }
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'subsection-reorder' } })); } catch (_) {}
  }

  // ── DOM injection (editor-only chrome) ──────────────────────────────
  function ensureStyles() {
    if (document.getElementById('antcv-subsection-reorder-styles')) return;
    var css = '.antcv-subreorder{display:inline-flex;gap:1px;margin-left:6px;vertical-align:middle;user-select:none;}'
      + '.antcv-subreorder button{width:16px;height:16px;line-height:14px;padding:0;font-size:10px;cursor:pointer;'
      + 'border:1px solid rgba(1,183,187,.5);background:rgba(1,183,187,.08);color:#01746e;border-radius:3px;}'
      + '.antcv-subreorder button:hover{background:rgba(1,183,187,.22);}'
      + '.antcv-subreorder button[disabled]{opacity:.25;cursor:default;}'
      + '@media print{.antcv-subreorder{display:none !important;}}';
    var el = document.createElement('style'); el.id = 'antcv-subsection-reorder-styles'; el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function mkArrow(glyph, title, enabled, onClick) {
    var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = glyph; btn.title = title;
    btn.setAttribute('tabindex', '-1'); btn.setAttribute('contenteditable', 'false');
    if (!enabled) btn.disabled = true;
    else btn.addEventListener('mousedown', function (e) { e.preventDefault(); e.stopPropagation(); onClick(); });
    return btn;
  }

  function injectInto(secEl, sectionId, items) {
    var g = groupIndices(items); if (g.length < 2) return;   // need 2+ subsections to reorder
    for (var k = 0; k < g.length; k++) {
      var rowEl = secEl.querySelector('[data-antcv-row-path="items.' + g[k] + '"]');
      if (!rowEl) continue;
      if (rowEl.querySelector(':scope > .antcv-subreorder')) continue;   // idempotent
      var wrap = document.createElement('span'); wrap.className = 'antcv-subreorder'; wrap.setAttribute('contenteditable', 'false');
      (function (ord) {
        wrap.appendChild(mkArrow('▲', 'Move this subsection up', ord > 0, function () { applyReorder(sectionId, ord, -1); }));
        wrap.appendChild(mkArrow('▼', 'Move this subsection down', ord < g.length - 1, function () { applyReorder(sectionId, ord, 1); }));
      })(k);
      rowEl.appendChild(wrap);
    }
  }

  function scan() {
    if (disabled()) return;
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { return; }
    var list = b[curDoc()]; if (!Array.isArray(list)) return;
    var byId = {}; list.forEach(function (s) { if (s && s.id && s.type === 'labeled_list') byId[s.id] = s; });
    var sids = document.querySelectorAll('[data-sid]');
    for (var i = 0; i < sids.length; i++) {
      var el = sids[i], id = el.getAttribute('data-sid'); var sec = byId[id];
      if (sec && Array.isArray(sec.items)) injectInto(el, id, sec.items);
    }
  }

  var pending = false, lastAt = 0;
  function schedule() {
    if (pending) return; pending = true;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var wait = Math.max(0, 300 - (now - lastAt));
    var run = function () { pending = false; lastAt = (window.performance && performance.now) ? performance.now() : Date.now(); try { ensureStyles(); scan(); } catch (_) {} };
    if (wait > 0) setTimeout(run, wait); else (window.requestAnimationFrame || setTimeout)(run);
  }

  try {
    var mo = new MutationObserver(function () { schedule(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  try { window.addEventListener('antcv:sections-updated', function () { schedule(); }); } catch (_) {}
  [600, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });

  window.AntcvSubsectionReorder = { version: VERSION, _move: moveBlock, _scan: scan };
})();
