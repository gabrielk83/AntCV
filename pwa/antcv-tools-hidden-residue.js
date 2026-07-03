/* antcv-tools-hidden-residue.js — TOOLS-HIDDEN-RESIDUE-001 (owner 2026-07-03)
 * ============================================================================
 * Owner: "for the specific application, generate hidden items in the
 * subsection's panel. Example — the stored line 'Lab & fabrication: …, PDMS
 * nanoimprint, …' gets PDMS trimmed by the generation; it moves to
 * 'Hidden - Lab & fabrication: PDMS nanoimprint', which I can review. These
 * Hidden items are only per application and not global."
 *
 * Tools rows are label + compressed comma value, so trimming a token INSIDE a
 * value is invisible to the row eye-toggle — the token is gone from this
 * application with no one-click way back (spec rule 40 hides rows, not
 * tokens). This sidecar is the deterministic bridge:
 *
 *  DIFF    every kernel token (personalInfo.tools, the master that generation
 *          never mutates) missing from the application's TOOLS & METHODS
 *          section is collected into a residue row
 *          { l: 'Hidden - <category>', v: '<missing tokens>', hidden: true }
 *          appended to the section. It shows greyed in the editor panel with
 *          the normal eye-toggle; hidden:true keeps it out of preview AND
 *          export (docx-client also drops 'Hidden - ' rows as a belt).
 *  RESTORE clicking the eye on a residue row (hidden -> false) merges its
 *          tokens back into the matching category row (', ' appended) and
 *          removes the residue row. No matching row -> the residue row
 *          becomes a real visible row under the bare category label.
 *  HEAL    a token re-added by hand (or by a regen) disappears from the
 *          residue row automatically; an emptied residue row is removed.
 *
 * Per-application by construction: `sections` is per-application state; the
 * kernel is never written. Gates: no-op on the skeleton template (every value
 * still bracketed) and when ZERO kernel tokens are present in the section (a
 * different-language or unrelated tools list would otherwise dump the whole
 * kernel as residue). Loop-safe: same-blob bail + write-only-on-change + own
 * tagged event ignored. setTimeout debounce, never rAF (STICKY-LEAK-005:
 * rAF-debounced sidecars freeze in background tabs).
 * Disable: localStorage['antcv:disable-tools-hidden-residue'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvToolsHiddenResidue) return;
  window.__antcvToolsHiddenResidue = '1.51.115';

  var SRC = 'tools-hidden-residue';
  var PREFIX = 'Hidden - ';
  var RESIDUE_RE = /^\s*hidden\s*[-–—:]\s*/i;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-tools-hidden-residue'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function norm(s) {
    return String(s == null ? '' : s)
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  // Split a stored value into tool tokens. Commas and semicolons delimit;
  // bracketed placeholders never count as tokens.
  function tokensOf(v) {
    var raw = Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v);
    return raw.split(/[,;]/).map(function (t) { return t.trim(); })
      .filter(function (t) { return t.length >= 2 && t.indexOf('[') === -1; });
  }

  // Kernel master categories: [{ label, tokens }], merged by normalised label.
  // Accepts {l,v} items and 'Label: v1, v2' strings (both stored shapes).
  function kernelCategories(pi) {
    var p = pi;
    if (p == null) {
      try { p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) { p = {}; }
    }
    p = p.personalInfo || p;
    var tools = Array.isArray(p.tools) ? p.tools : [];
    var byKey = {}, order = [];
    tools.forEach(function (it) {
      var label = '', val = '';
      if (typeof it === 'string') {
        var c = it.indexOf(':');
        if (c > 0) { label = it.slice(0, c).trim(); val = it.slice(c + 1); }
      } else if (it && typeof it === 'object') { label = String(it.l || '').trim(); val = it.v; }
      if (!label || label.indexOf('[') !== -1) return;
      var toks = tokensOf(val);
      if (!toks.length) return;
      var k = norm(label);
      if (!byKey[k]) { byKey[k] = { label: label, tokens: [] }; order.push(k); }
      var seen = {};
      byKey[k].tokens.forEach(function (t) { seen[norm(t)] = true; });
      toks.forEach(function (t) { if (!seen[norm(t)]) { seen[norm(t)] = true; byKey[k].tokens.push(t); } });
    });
    return order.map(function (k) { return byKey[k]; });
  }

  function isResidue(it) {
    return !!(it && typeof it === 'object' && it.group === undefined && RESIDUE_RE.test(String(it.l || '')));
  }

  function hasToken(hayPadded, tok) {
    var n = norm(tok);
    return !!n && hayPadded.indexOf(' ' + n + ' ') !== -1;
  }

  // RESIDUE-RESTORE-PLACEMENT (owner 2026-07-03): a restored token goes back
  // WHERE IT COSTS THE LEAST SPACE, not to the end of the line. Simulate the
  // sidebar word-wrap at a few plausible column widths and pick the insertion
  // index with the fewest total lines (ties -> earliest position, which keeps
  // JD-relevance order mostly intact). Same long+short packing idea as spec
  // rule 40, applied deterministically to one row.
  var WRAP_WIDTHS = [26, 30, 34];
  function simulateLines(text, width) {
    var words = String(text).split(/\s+/).filter(Boolean);
    var lines = 1, cur = 0;
    for (var i = 0; i < words.length; i++) {
      var wl = words[i].length;
      if (cur === 0) cur = wl;
      else if (cur + 1 + wl <= width) cur += 1 + wl;
      else { lines++; cur = wl; }
    }
    return lines;
  }
  function lineCost(label, toks) {
    var text = label + ': ' + toks.join(', ');
    var c = 0;
    for (var i = 0; i < WRAP_WIDTHS.length; i++) c += simulateLines(text, WRAP_WIDTHS[i]);
    return c;
  }
  function insertBest(label, toks, tok) {
    var bestIdx = toks.length, bestCost = Infinity;
    for (var i = 0; i <= toks.length; i++) {
      var trial = toks.slice(0, i).concat([tok], toks.slice(i));
      var c = lineCost(label, trial);
      if (c < bestCost) { bestCost = c; bestIdx = i; }
    }
    return toks.slice(0, bestIdx).concat([tok], toks.slice(bestIdx));
  }

  // Pure reconcile: returns the next items array, or null for no change.
  function reconcile(items, cats) {
    if (!Array.isArray(items) || !Array.isArray(cats) || !cats.length) return null;
    var changed = false;
    var next = items.slice();

    // RESTORE: a residue row the user un-hid folds back into its category row.
    for (var i = next.length - 1; i >= 0; i--) {
      var it = next[i];
      if (!isResidue(it) || it.hidden === true) continue;
      var category = String(it.l || '').replace(RESIDUE_RE, '').trim();
      var toks = tokensOf(it.v);
      var target = -1;
      for (var j = 0; j < next.length; j++) {
        var cand = next[j];
        if (j === i || !cand || typeof cand !== 'object' || cand.group !== undefined || isResidue(cand)) continue;
        if (norm(cand.l) === norm(category)) { target = j; break; }
      }
      if (target >= 0) {
        var row = next[target];
        var hayRow = ' ' + norm((row.l || '') + ' ' + (row.v || '')) + ' ';
        var add = toks.filter(function (t) { return !hasToken(hayRow, t); });
        if (add.length) {
          var rowToks = tokensOf(row.v);
          for (var a = 0; a < add.length; a++) rowToks = insertBest(String(row.l || ''), rowToks, add[a]);
          next[target] = Object.assign({}, row, { v: rowToks.join(', '), hidden: false });
        }
        next.splice(i, 1);
      } else {
        // No surviving category row (renamed / translated): promote in place.
        next[i] = Object.assign({}, it, { l: category, hidden: false });
      }
      changed = true;
    }

    // DIFF vs the kernel over the NON-residue rows.
    var hayParts = [];
    var placeholderOnly = true;
    next.forEach(function (it) {
      if (isResidue(it)) return;
      var txt;
      if (typeof it === 'string') txt = it;
      else if (it && typeof it === 'object') txt = it.group !== undefined ? String(it.group || '') : String(it.l || '') + ' ' + String(it.v == null ? '' : it.v);
      else return;
      if (txt.indexOf('[') === -1 && norm(txt)) placeholderOnly = false;
      hayParts.push(txt);
    });
    if (placeholderOnly) return changed ? next : null;   // skeleton template — nothing generated yet
    var hay = ' ' + norm(hayParts.join(' ')) + ' ';

    var anyPresent = cats.some(function (c) { return c.tokens.some(function (t) { return hasToken(hay, t); }); });
    if (!anyPresent) return changed ? next : null;       // unrelated / other-language list — do not dump the kernel

    cats.forEach(function (c) {
      var missing = c.tokens.filter(function (t) { return !hasToken(hay, t); });
      var idx = -1;
      for (var k = 0; k < next.length; k++) {
        if (isResidue(next[k]) && norm(String(next[k].l).replace(RESIDUE_RE, '')) === norm(c.label)) { idx = k; break; }
      }
      if (!missing.length) {
        if (idx >= 0) { next.splice(idx, 1); changed = true; }
        return;
      }
      var want = missing.join(', ');
      if (idx >= 0) {
        if (String(next[idx].v) !== want) { next[idx] = Object.assign({}, next[idx], { v: want, hidden: true }); changed = true; }
      } else {
        next.push({ l: PREFIX + c.label, v: want, hidden: true });
        changed = true;
      }
    });

    return changed ? next : null;
  }

  var lastSec = null;
  function apply() {
    if (disabled()) return;
    try {
      var raw = localStorage.getItem('sections');
      if (!raw || raw === lastSec) return;
      var cats = kernelCategories();
      if (!cats.length) { lastSec = raw; return; }
      var b = JSON.parse(raw), changed = false;
      var list = b && b.cv;
      if (Array.isArray(list)) list.forEach(function (sec) {
        if (!sec || sec.id !== 'tools' || sec.type !== 'labeled_list' || !Array.isArray(sec.items)) return;
        var next = reconcile(sec.items, cats);
        if (next) { sec.items = next; changed = true; }
      });
      if (changed) {
        var os = JSON.stringify(b); localStorage.setItem('sections', os); lastSec = os;
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
        try { console.info('[tools-hidden-residue] reconciled TOOLS & METHODS vs kernel (residue rows updated)'); } catch (_) {}
      } else lastSec = raw;
    } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { apply(); } catch (_) {} }, 120); }

  [700, 1800, 3200].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'personalInfo' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvToolsHiddenResidue = {
    version: '1.51.115',
    _reconcile: reconcile,
    _kernelCategories: kernelCategories,
    _tokens: tokensOf,
    _norm: norm,
    _insertBest: insertBest,
    _lineCost: lineCost,
    _apply: apply,
  };
})();
