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
  window.__antcvToolsHiddenResidue = '1.51.117';

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

  // RICHBLOCK-SHAPE-001 (owner mobile report 2026-07-03): the TOOLS section is
  // MIGRATED to rich_block at runtime (AI-TO-METHODS-RICHBLOCK-001) — items are
  // {b: label, t: value, bullets: []} with {grp:true, t: name} group rows, and
  // per-item visibility lives in the SECTION-LEVEL hidden index map, not
  // it.hidden. All row access goes through these shape helpers.
  function labelOf(it) { return it && typeof it === 'object' ? (it.l != null ? it.l : (it.b != null ? it.b : '')) : ''; }
  function valOf(it) { return it && typeof it === 'object' ? (it.v != null ? it.v : (it.t != null ? it.t : '')) : (it == null ? '' : it); }
  function isGroupRow(it) { return !!(it && typeof it === 'object' && (it.group !== undefined || it.grp)); }
  function isRichItem(it) { return !!(it && typeof it === 'object' && it.l == null && it.v == null && (it.b !== undefined || it.t !== undefined)); }
  function setVal(it, v) { return it.v != null || it.l != null ? Object.assign({}, it, { v: v }) : Object.assign({}, it, { t: v }); }

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
    return !!(it && typeof it === 'object' && !isGroupRow(it) && RESIDUE_RE.test(String(labelOf(it))));
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
    // (labeled_list eye path; rich_block restores arrive via restoreToken from
    // the long-press menu because rich rows carry no per-item flag.)
    for (var i = next.length - 1; i >= 0; i--) {
      var it = next[i];
      if (!isResidue(it) || it.hidden === true || isRichItem(it)) continue;
      var category = String(labelOf(it)).replace(RESIDUE_RE, '').trim();
      var toks = tokensOf(valOf(it));
      var target = -1;
      for (var j = 0; j < next.length; j++) {
        var cand = next[j];
        if (j === i || !cand || typeof cand !== 'object' || isGroupRow(cand) || isResidue(cand)) continue;
        if (norm(labelOf(cand)) === norm(category)) { target = j; break; }
      }
      if (target >= 0) {
        var row = next[target];
        var hayRow = ' ' + norm(labelOf(row) + ' ' + valOf(row)) + ' ';
        var add = toks.filter(function (t) { return !hasToken(hayRow, t); });
        if (add.length) {
          var rowToks = tokensOf(valOf(row));
          for (var a = 0; a < add.length; a++) rowToks = insertBest(String(labelOf(row)), rowToks, add[a]);
          next[target] = Object.assign({}, setVal(row, rowToks.join(', ')), { hidden: false });
        }
        next.splice(i, 1);
      } else {
        // No surviving category row (renamed / translated): promote in place.
        next[i] = Object.assign({}, it, { l: category, hidden: false });
      }
      changed = true;
    }

    // DIFF vs the kernel over the NON-residue rows.
    var richSection = next.some(function (it) { return isRichItem(it) && !isGroupRow(it); });
    var hayParts = [];
    var placeholderOnly = true;
    next.forEach(function (it) {
      if (isResidue(it)) return;
      var txt;
      if (typeof it === 'string') txt = it;
      else if (it && typeof it === 'object') txt = isGroupRow(it) ? String(it.group !== undefined ? it.group : (it.t || '')) : String(labelOf(it)) + ' ' + String(valOf(it));
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
        if (isResidue(next[k]) && norm(String(labelOf(next[k])).replace(RESIDUE_RE, '')) === norm(c.label)) { idx = k; break; }
      }
      // LONGPRESS-HIDE (owner 2026-07-03): tokens hidden from the preview menu
      // may be EDITED/generated wording absent from the kernel — a residue row
      // keeps those as long as they are still missing from the section, instead
      // of being clobbered by the kernel-only rebuild.
      if (idx >= 0) {
        var kern = {};
        c.tokens.forEach(function (t) { kern[norm(t)] = true; });
        tokensOf(valOf(next[idx])).forEach(function (t) {
          if (!kern[norm(t)] && !hasToken(hay, t)) missing.push(t);
        });
      }
      if (!missing.length) {
        if (idx >= 0) { next.splice(idx, 1); changed = true; }
        return;
      }
      var want = missing.join(', ');
      if (idx >= 0) {
        if (String(valOf(next[idx])) !== want) { next[idx] = setVal(next[idx], want); if (!isRichItem(next[idx])) next[idx].hidden = true; changed = true; }
      } else {
        // Residue rows are created in the SECTION's own shape: rich sections
        // get {b,t,bullets} (renderer-skipped by RESIDUE-PREVIEW-SKIP, no flag
        // needed — the per-item flag is IGNORED by the rich renderer, which is
        // exactly the owner's forever-hidden bug), labeled sections get
        // {l,v,hidden:true}.
        next.push(richSection ? { b: PREFIX + c.label, t: want, bullets: [] } : { l: PREFIX + c.label, v: want, hidden: true });
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
        if (!sec || sec.id !== 'tools' || !Array.isArray(sec.items)) return;
        if (sec.type !== 'labeled_list' && sec.type !== 'rich_block') return;
        var next = reconcile(sec.items, cats);
        if (next) {
          sec.items = next;
          // Rich sections hide via the SECTION-LEVEL index map — drop stale
          // entries pointing at residue rows / beyond the array so a later
          // append can never inherit a foreign hidden flag.
          if (sec.hidden && typeof sec.hidden === 'object') {
            for (var hk in sec.hidden) {
              var hi = parseInt(hk, 10);
              if (!isNaN(hi) && (hi >= next.length || isResidue(next[hi]))) delete sec.hidden[hk];
            }
          }
          changed = true;
        }
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

  // Menu-driven restore (rich rows carry no per-item flag, so the long-press
  // menu calls this directly; works for labeled sections too).
  function restoreToken(sid, category, token) {
    try {
      var raw = localStorage.getItem('sections');
      if (!raw) return false;
      var b = JSON.parse(raw);
      var sec = (b.cv || []).find(function (x) { return x && x.id === sid; });
      if (!sec || !Array.isArray(sec.items)) return false;
      var items = sec.items;
      var resIdx = -1;
      for (var i = 0; i < items.length; i++) {
        if (isResidue(items[i]) && norm(String(labelOf(items[i])).replace(RESIDUE_RE, '')) === norm(category)) { resIdx = i; break; }
      }
      if (resIdx < 0) return false;
      var resToks = tokensOf(valOf(items[resIdx]));
      if (resToks.map(norm).indexOf(norm(token)) === -1) return false;
      var remain = resToks.filter(function (t) { return norm(t) !== norm(token); });
      var target = -1;
      for (var j = 0; j < items.length; j++) {
        if (j === resIdx || !items[j] || typeof items[j] !== 'object' || isGroupRow(items[j]) || isResidue(items[j])) continue;
        if (norm(labelOf(items[j])) === norm(category)) { target = j; break; }
      }
      if (target >= 0) {
        var rowToks = insertBest(String(labelOf(items[target])), tokensOf(valOf(items[target])), token);
        items[target] = setVal(items[target], rowToks.join(', '));
      } else if (isRichItem(items[resIdx])) {
        items.splice(resIdx, 0, { b: category, t: token, bullets: [] });
        resIdx++;
      } else {
        items.splice(resIdx, 0, { l: category, v: token });
        resIdx++;
      }
      if (remain.length) items[resIdx] = setVal(items[resIdx], remain.join(', '));
      else {
        items.splice(resIdx, 1);
        if (sec.hidden && typeof sec.hidden === 'object') {
          for (var hk in sec.hidden) { var hi = parseInt(hk, 10); if (!isNaN(hi) && hi >= resIdx) delete sec.hidden[hk]; }
        }
      }
      var os = JSON.stringify(b);
      localStorage.setItem('sections', os); lastSec = os;
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      return true;
    } catch (_) { return false; }
  }

  window.AntcvToolsHiddenResidue = {
    version: '1.51.117',
    _reconcile: reconcile,
    _kernelCategories: kernelCategories,
    _tokens: tokensOf,
    _norm: norm,
    _labelOf: labelOf,
    _valOf: valOf,
    restoreToken: restoreToken,
    _insertBest: insertBest,
    _lineCost: lineCost,
    _apply: apply,
  };
})();
