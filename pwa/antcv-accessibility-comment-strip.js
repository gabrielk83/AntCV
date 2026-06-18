/* antcv-accessibility-comment-strip.js — ACCESS-NO-COMMENT-001 (owner 2026-06-19)
 * ============================================================================
 * Owner QA: the CV ACCESSIBILITY row renders a trailing 3rd-person verdict like
 * "It has not limited his career" (or "...their career" / "...her career").
 * That recommender-style comment ABOUT the candidate belongs ONLY in a cover
 * letter, NEVER in the CV accessibility row — the CV row is first-person-factual
 * (state the accommodation only).
 *
 * The prompt fix (1.50.691) is generation-only: it does not strip data already
 * stored from earlier generations. This restore-proof SIDECAR strips ONLY the
 * trailing "(it/this) has not limited his/their/her career" sentence (and its
 * leading separator/period) from the CV accessibility section's labeled_list
 * `item.v` values. It does NOT touch the CL (the comment is allowed there) and
 * NEVER blanks the field — the real accommodation prose before the sentence is
 * preserved.
 *
 * Shape (antcv-sections-normalize-415.js mk('accessibility',...)):
 *   { id:'accessibility', title:'ACCESSIBILITY', type:'labeled_list',
 *     items:[ { l:'Accessibility', v:'<prose>. It has not limited his career.' } ] }
 *   The editorial sentence is appended to item.v (the render reads row.v).
 *
 * Sidecar-only — no app.js change. Loop-safe: same-blob bail + write-only-on-
 * change + our own tagged event being ignored mean steady state is a no-op.
 * Disable: localStorage['antcv:disable-accessibility-comment-strip'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvAccessibilityCommentStrip) return;
  window.__antcvAccessibilityCommentStrip = '1.50.697';

  var SRC = 'accessibility-comment-strip';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-accessibility-comment-strip'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // Matches a TRAILING editorial sentence of the form
  //   "[separator/period/space] (It|This|That|Which) (has|hasn't|has not|did|does)
  //    [not] (ever) limit(ed) his|her|their|the|this|that career[ trajectory|path]."
  // The leading group eats the separator (period, dash, semicolon, comma) and any
  // whitespace BEFORE the sentence so we don't leave a dangling ". " behind.
  // Anchored to end-of-string ($) so we only strip a TRAILING comment, never a
  // mid-field clause. [^.]*? between limit and career forbids crossing a sentence
  // boundary. Tolerates a trailing period, with or without it.
  var TAIL = /(?:\s*[—–.;,\-]\s*)?\b(?:it|this|that|which)\b\s+(?:has(?:\s*n'?t|\s+not)?|did(?:\s+not)?|does(?:\s*n'?t|\s+not)?|never)\s+(?:ever\s+)?limit(?:ed|s)?\b[^.]*?\bcareer\b[^.]*?\.?\s*$/i;

  function stripComment(v) {
    if (typeof v !== 'string' || !v) return null;
    if (!/\bcareer\b/i.test(v) || !/\blimit/i.test(v)) return null;   // fast bail
    if (!TAIL.test(v)) return null;
    var next = v.replace(TAIL, '');
    next = next.replace(/[\s.;,—–\-]+$/, '');                 // tidy trailing punctuation/space
    if (!next.trim()) return null;        // never blank the field — keep the data
    next = next.trim();
    if (next === String(v).trim()) return null;
    return next;
  }

  function isAccessSection(sec) {
    return sec && sec.type === 'labeled_list' &&
      (sec.id === 'accessibility' || /ACCESSIBILIT/i.test(String(sec.title || '')));
  }

  // Returns true if it changed any item.v in this section.
  function stripSection(sec) {
    if (!isAccessSection(sec) || !Array.isArray(sec.items)) return false;
    var changed = false;
    for (var i = 0; i < sec.items.length; i++) {
      var it = sec.items[i];
      if (!it || typeof it !== 'object') continue;
      var next = stripComment(it.v);
      if (next != null) { it.v = next; changed = true; }
    }
    return changed;
  }

  var lastRaw = null;
  function apply() {
    if (disabled()) return;
    try { var __ae = document.activeElement; if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ""))) return; } catch (_) {}
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;          // same-blob bail
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    // CV ONLY — the editorial comment is allowed in the cover letter.
    var list = b.cv;
    if (Array.isArray(list)) {
      list.forEach(function (sec) { if (stripSection(sec)) changed = true; });
    }
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[accessibility-comment-strip] removed trailing 3rd-person career comment from CV accessibility row(s)'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [500, 1400, 2800].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvAccessibilityCommentStrip = { version: '1.50.697', _apply: apply, _strip: stripComment, _stripSection: stripSection };
})();
