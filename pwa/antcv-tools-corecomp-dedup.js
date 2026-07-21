/* antcv-tools-corecomp-dedup.js — TOOLS-CORECOMP-DEDUP-001 (owner 2026-07)
 * ============================================================================
 * CORE COMPETENCIES (CV `core_comp`, a 2-column [Focus Area, Strategic Expertise]
 * table) must NOT be repeated as TOOLS & METHODS rows. Owner export review:
 *   "Core expertise replicated into TOOLS & METHODS — redundant, not allowed,
 *    crowding tools — no!" (e.g. a Tools row "Materials & devices: …" / "Optics,
 *    photonics & sensing: …" / "Validation: …" that mirrors a Focus-Area label).
 *
 * THIS PASS: drop a TOOLS rich_block ROW whose lead-in label (`b`) is essentially
 * the SAME concept as a core_comp Focus-Area label — i.e. its significant-word set
 * (words >3 chars) shares >=2 words with a Focus-Area label, OR one label's
 * significant words are fully contained in the other's (sub-/super-set) sharing >=1.
 * GROUP sub-headers (Expertise / Tools / Methods, `grp:true`) and rows with no lead
 * are always kept, as are tool rows that don't mirror a competency. CV only.
 * Idempotent (after the drop a re-run finds nothing to remove). Self-disabling on
 * error. Disable: localStorage['antcv:disable-tools-dedup']='1'.
 *
 * The durable fix is generation not emitting the overlap; this heals already-saved
 * docs the owner won't regenerate, and is a no-op once the data is clean.
 */
(function () {
  'use strict';
  var VERSION = '1.51.1772-hide-not-delete';
  if (window.__antcvToolsCoreCompDedup === VERSION) return;
  window.__antcvToolsCoreCompDedup = VERSION;

  function disabled() { try { return localStorage.getItem('antcv:disable-tools-dedup') === '1'; } catch (_) { return false; } }
  function sig(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 3; }); }
  function dup(lw, fw) {
    if (!lw.length || !fw.length) return false;
    var fa = {}; fw.forEach(function (w) { fa[w] = 1; });
    var shared = lw.filter(function (w) { return fa[w]; });
    if (shared.length >= 2) return true;
    var lead = {}; lw.forEach(function (w) { lead[w] = 1; });
    var leadSubset = lw.every(function (w) { return fa[w]; });
    var faSubset = fw.every(function (w) { return lead[w]; });
    return (leadSubset || faSubset) && shared.length >= 1;
  }

  var __recent = [];        // [{ h: serialisedSections, t: ms }] — OSC-GUARD ring
  var OSC_WINDOW_MS = 4000;
  function run() {
    if (disabled()) return;
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || !Array.isArray(secs.cv)) return;
      var cc = secs.cv.filter(function (s) { return s && s.id === 'core_comp' && Array.isArray(s.rows); })[0];
      var tools = secs.cv.filter(function (s) { return s && s.id === 'tools' && Array.isArray(s.items); })[0];
      if (!cc || !tools) return;
      // Focus-Area labels = left column, skip the header row (row 0).
      var faList = cc.rows.slice(1).map(function (r) { return Array.isArray(r) ? sig(r[0]) : []; }).filter(function (w) { return w.length; });
      if (!faList.length) return;
      // TOOLS-CORECOMP-TRIM-001 (owner 2026-07: a TOOLS value's PARENTHETICAL repeated a whole
      // competency — "technical-commercial evaluation (RFQ/RFI, supplier scoring, feasibility,
      // total landed cost)" → keep only "technical-commercial evaluation"). Build the full
      // CORE COMPETENCIES token set (both columns) and drop any parenthetical whose significant
      // tokens are mostly found there.
      var ccTokens = {};
      cc.rows.slice(1).forEach(function (r) { if (Array.isArray(r)) r.forEach(function (c) { sig(c).forEach(function (w) { ccTokens[w] = 1; }); }); });
      var trimParen = function (body) {
        return String(body == null ? '' : body).replace(/\s*\(([^()]+)\)/g, function (m, inner) {
          var it = sig(inner);
          if (it.length >= 2) { var sh = it.filter(function (w) { return ccTokens[w]; }).length; if (sh / it.length >= 0.5) return ''; }
          return m;
        }).replace(/\s{2,}/g, ' ').replace(/\s+([,.;])/g, '$1').replace(/[\s,;]+$/, '').trim();
      };
      // RESIDUE-DEDUP-LOOP-001 (owner 2026-07-03 "regulatory context is very
      // jumpy", caught live with the writer probe: 43 sections writes in ~18s,
      // tools-corecomp-dedup <-> tools-hidden-residue ping-pong): a
      // "Hidden - <category>" REVIEW row carries the category label, so this
      // filter matched it against the same Focus-Area label and DROPPED it —
      // and the residue reconciler re-created it on the next tick, forever.
      // Residue rows never render (RESIDUE-PREVIEW-SKIP + export belt), so
      // dedup must never touch them.
      var isResidueRow = function (it) { return /^\s*hidden\s*[-–—:]\s*/i.test(String((it && (it.b != null ? it.b : it.l)) || '')); };
      // TOOLS-GRP-STORM-CONVERGE-001 (owner 2026-07-21, live-diagnosed on Ibsen Photonics):
      // this pass used to SPLICE the duplicate row out of tools.items. That delete was the
      // engine of a three-way storm that made a TOOLS & METHODS group heading blink in/out:
      //   1. deleting a kernel category row (e.g. "Validation", a word-subset of the CORE
      //      COMPETENCIES focus area "Validation and compliance") shifted every following
      //      index, so the SECTION-LEVEL hidden[] map (rich_block visibility) then pointed at
      //      the wrong rows — __grpHasChild flipped and the heading flapped;
      //   2. the delete made that category's kernel tokens VANISH from the section, so
      //      antcv-tools-hidden-residue re-created a "Hidden - <cat>" residue row;
      //   3. antcv-sidebar-relevance-cut's HEAL pass found JD-passing tokens in that residue
      //      and RESURRECTED a visible category row — which this pass deleted again. Loop.
      // Fix: HIDE the duplicate via the section-level hidden map instead of deleting it
      // (sections-hide-over-delete). Indices never shift, and the row's tokens stay in the
      // residue reconciler's view, so no residue twin is created and heal has nothing to
      // resurrect — the loop reaches a true fixpoint. Render + docx export already drop
      // section-hidden rich rows, so the output is byte-identical to the old delete.
      var trimmed = 0, newlyHidden = 0;
      var hiddenMap = (tools.hidden && typeof tools.hidden === 'object') ? Object.assign({}, tools.hidden) : {};
      tools.items.forEach(function (it, i) {
        if (!it || it.grp || !it.b) return;                      // keep sub-headers + bodyless rows
        if (isResidueRow(it)) return;                            // review artifacts are not duplicates
        if (hiddenMap[i] || it.hidden === true) return;          // already hidden → idempotent, no re-flag
        var lw = sig(it.b);
        for (var f = 0; f < faList.length; f++) {
          if (dup(lw, faList[f])) { hiddenMap[i] = true; newlyHidden++; break; }
        }
      });
      tools.items.forEach(function (it, i) {
        if (!it || it.grp || isResidueRow(it) || hiddenMap[i] || it.hidden === true) return;
        if (typeof it.t === 'string' && it.t.indexOf('(') >= 0) {
          var nt = trimParen(it.t);
          if (nt && nt !== it.t) { it.t = nt; trimmed++; }
        }
      });
      if (!newlyHidden && !trimmed) return;                      // idempotent — nothing duplicated
      if (newlyHidden) tools.hidden = hiddenMap;
      var payload = JSON.stringify(secs);
      // OSC-GUARD (storm-osc-guard family): if a competing writer un-hides a dup row and we
      // re-hide it to the SAME serialised sections we already wrote in the last few seconds,
      // re-dispatching only feeds the loop — hold. A genuinely-new state always writes. The
      // hidden state is already persisted, so holding never leaks a duplicate into the render.
      var nowW = Date.now();
      __recent = __recent.filter(function (e) { return nowW - e.t < OSC_WINDOW_MS; });
      if (__recent.some(function (e) { return e.h === payload; })) {
        try { console.warn('[TOOLS-CORECOMP-DEDUP] oscillation held — a competing writer keeps un-hiding this dup row; not re-dispatching'); } catch (_) {}
        return;
      }
      __recent.push({ h: payload, t: nowW });
      localStorage.setItem('sections', payload);
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'tools-corecomp-dedup' } })); } catch (_) {}
      try { console.log('[TOOLS-CORECOMP-DEDUP] hid ' + newlyHidden + ' TOOLS row(s) duplicating CORE COMPETENCIES' + (trimmed ? (' + trimmed ' + trimmed + ' parenthetical(s)') : '')); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', function () { setTimeout(run, 300); });
  [800, 2000, 4000, 8000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvToolsCoreCompDedup = { version: VERSION, run: run };
})();
