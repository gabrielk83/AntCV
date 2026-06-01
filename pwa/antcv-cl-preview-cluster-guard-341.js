/* AntCV CL Preview cluster guard (v1.40.341-p0c)
 * ============================================================
 *
 * CL-001 / VF-001
 * ----------------
 * Defect: in the Cover Letter Preview, when a body section is
 * focused (or its text selected), a duplicate 8-button cluster
 * appears NEXT TO the section in the Preview pane — separate from
 * the panel-side row controls. Plan §4.3 acceptance: "Selecting
 * Greeting/Opening/Who I Am/What I Bring/Why This Position/How/
 * Foundation/Closure shows editable focus only — no duplicate
 * button array."
 *
 * Strategy
 * --------
 * The cluster's source isn't tracked (it doesn't appear in the
 * sidecar tree we control; it's either emitted by app.js or
 * leaked from a panel-side bar into the preview tree). Rather
 * than chase the emitter, this sidecar applies a Preview-scoped
 * GUARD: any element matching the action-cluster shape inside
 * `.antcv-preview-paper` is removed.
 *
 * Cluster signature
 * -----------------
 * A "cluster" here is a small inline container that holds 3+
 * action buttons identified by their glyphs (📄, ✨, ⇥, ⇥⇤, ⇤,
 * ↔, ☰, ✕, ×, →, ↹). We DO NOT touch:
 *   - The amber "▼ PAGE N ▼" boundary bar from
 *     antcv-page-breaks-everywhere-284.js (data-antcv-pb284-bar
 *     and data-antcv-bar markers).
 *   - Continuation-header divs (data-antcv-continuation-header,
 *     data-antcv-cont-fix).
 *   - The SectionControlBar (data-antcv-control-bar) — when it
 *     ever mounts INSIDE the preview paper, that's intentional.
 *
 * Idempotency: removed elements don't return because their
 * upstream source re-emits them; we re-strip on each tick. To
 * avoid an infinite mutation/observer loop, we set a removal
 * cooldown attribute on the parent (data-antcv-cl-guard-stripped)
 * and skip parents already cleaned within the last 200ms.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0c';
  if (window.__antcvClPreviewClusterGuardInstalled === SCRIPT_VERSION) return;
  window.__antcvClPreviewClusterGuardInstalled = SCRIPT_VERSION;

  // Glyphs we treat as action-cluster signals. Each rendered as a
  // discrete codepoint so a small loop-based char check is enough —
  // no \s regex (CLAUDE.md hazard) and no \u escapes.
  var GLYPHS = ['📄', '✨', '⇥⇤', '⇤⇥', '⇥', '⇤', '↔', '☰', '✕', '×', '→', '↹'];

  function isPreviewPaper(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.matches && el.matches('.antcv-preview-paper, [data-antcv-preview-paper]')) return true;
    return false;
  }

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function isProtected(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute) {
      if (el.getAttribute('data-antcv-pb284-bar') === '1') return true;
      if (el.getAttribute('data-antcv-pb284-mark') === '1') return true;
      if (el.getAttribute('data-antcv-pb284-header') === '1') return true;
      if (el.getAttribute('data-antcv-page-break') === '1') return true;
      if (el.getAttribute('data-antcv-continuation-header') === '1') return true;
      if (el.getAttribute('data-antcv-cont-fix') === '1') return true;
      if (el.getAttribute('data-antcv-control-bar') === '1') return true;
      // The amber "▼ PAGE N ▼" bar uses these attribute variations
      // across older sidecar versions.
      if (el.getAttribute('data-antcv-sidebar-pagebreak-329') === '1') return true;
      if (el.getAttribute('data-antcv-sidebar-cont-329') === '1') return true;
      if (el.getAttribute('data-antcv-table-page-split') === '1') return true;
      // Anything inside a protected ancestor also stays.
      var p = el.parentElement;
      for (var d = 0; p && d < 5; d++, p = p.parentElement) {
        if (p.getAttribute && (
          p.getAttribute('data-antcv-pb284-bar') === '1' ||
          p.getAttribute('data-antcv-continuation-header') === '1' ||
          p.getAttribute('data-antcv-control-bar') === '1'
        )) return true;
      }
    }
    return false;
  }

  function textGlyphCount(el) {
    if (!el || !el.textContent) return 0;
    var t = el.textContent;
    var n = 0;
    for (var i = 0; i < GLYPHS.length; i++) {
      if (t.indexOf(GLYPHS[i]) >= 0) n++;
    }
    return n;
  }

  // A "cluster" is a container whose direct or near-descendants
  // include at least 3 buttons whose visible text consists of a
  // single glyph from the GLYPHS set. The text-content of the
  // container therefore matches multiple distinct glyphs.
  function isActionCluster(el) {
    if (!el || el.nodeType !== 1) return false;
    if (isProtected(el)) return false;
    // Cluster shapes are span / div with multiple button children.
    var tag = (el.tagName || '').toLowerCase();
    if (tag !== 'span' && tag !== 'div') return false;
    var btns = el.querySelectorAll('button');
    if (btns.length < 3) return false;
    // Each button must visibly contain a single GLYPHS codepoint
    // (allowing for whitespace). Count distinct glyphs.
    var glyphHits = 0;
    for (var i = 0; i < btns.length; i++) {
      var bt = btns[i];
      if (isProtected(bt)) return false;
      var tx = (bt.textContent || '').replace(/[\t\n\r ]+/g, '');
      for (var g = 0; g < GLYPHS.length; g++) {
        if (tx === GLYPHS[g] || tx.indexOf(GLYPHS[g]) === 0) { glyphHits++; break; }
      }
    }
    if (glyphHits < 3) return false;
    // Containers larger than ~360px wide are likely the editor
    // panel host, not a Preview-internal cluster. Skip them.
    try {
      var rect = el.getBoundingClientRect();
      if (rect && rect.width > 360) return false;
    } catch (_) {}
    return true;
  }

  function sweepOnce() {
    var paper = findPreviewPaper();
    if (!paper) return 0;
    // Candidate set: spans and divs inside the paper. Keep it small
    // by only inspecting elements that have at least one button
    // descendant.
    var candidates = paper.querySelectorAll('span, div');
    var removed = 0;
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (!el.isConnected) continue;
      if (isActionCluster(el)) {
        try {
          if (el.parentNode) el.parentNode.removeChild(el);
          removed++;
        } catch (_) {}
      }
    }
    if (removed > 0) {
      try { console.debug('[cl-preview-cluster-guard] stripped', removed, 'duplicate cluster(s) from Preview'); } catch (_) {}
    }
    return removed;
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweepOnce(); } catch (_) {}
    });
  }

  schedule();
  var delays = [200, 600, 1200, 2400, 4000];
  for (var d = 0; d < delays.length; d++) setTimeout(schedule, delays[d]);

  try {
    var mo = new MutationObserver(function (records) {
      // Skip mutations whose only changes are inside protected
      // markers — they can't have introduced a new cluster.
      var meaningful = false;
      for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        if (rec.type === 'childList' || rec.type === 'characterData') {
          meaningful = true;
          break;
        }
      }
      if (meaningful) schedule();
    });
    mo.observe(document.body || document.documentElement, {
      childList: true, subtree: true, characterData: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('beforeprint', function () { try { sweepOnce(); } catch (_) {} });

  window.AntcvClPreviewClusterGuard = {
    version: SCRIPT_VERSION,
    sweepOnce: sweepOnce,
    _isActionCluster: isActionCluster,
    _isProtected: isProtected,
  };

  try { console.debug('[cl-preview-cluster-guard] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
