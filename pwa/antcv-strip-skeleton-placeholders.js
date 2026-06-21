/* antcv-strip-skeleton-placeholders.js — SKELETON-LEAK-001 (owner data 2026-06-22)
 * ============================================================================
 * Found on the owner's live CV/CL: real generated content has the me() SKELETON
 * AUTHORING INSTRUCTION appended to it, e.g.
 *   "…AI-assisted engineering workflows.[PROFILE - 2-3 tight sentences positioning
 *    who you are professionally. … NO numbers, NO named systems …]"
 * Six sections affected (profile, work_style, opening, who, why, foundation) — the
 * bracketed instruction would PRINT on the exported CV/cover letter.
 *
 * Fix: strip a TRAILING run of one-or-more "[…]" blocks when that run carries the
 * skeleton-instruction signature (talks about sentence counts, "NO numbers",
 * "describing how you operate", etc.). Trailing-only + signature-gated so a real
 * citation/year in brackets is never touched, and all real content (which precedes
 * the leak) is preserved. Idempotent — once stripped there is no trailing
 * instruction block, so the pass is a no-op. CV + CL. Self-disabling on error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.773';
  if (window.__antcvStripSkeleton === VERSION) return;
  window.__antcvStripSkeleton = VERSION;

  // Signature that marks a bracket block as a me() authoring instruction, not real content.
  var INSTR = /\b(sentences?|NO numbers|NO named|belong in|describing how|positioning who|choose what fits|tight sentence|1-2|2-3|3-5|3-4|e\.g\.,|in your field|placeholder|what you have built|refer to the)\b/i;
  var TRAIL = /((?:\s*\[[^\]]*\])+)\s*$/;   // trailing run of one+ [..] blocks

  function strip(v) {
    if (typeof v !== 'string') return v;
    var m = TRAIL.exec(v);
    if (m && INSTR.test(m[1])) return v.slice(0, m.index).replace(/\s+$/, '');
    return v;
  }

  function readSections() {
    try { var x = JSON.parse(localStorage.getItem('sections') || '{}'); return (x && typeof x === 'object') ? x : {}; }
    catch (_) { return {}; }
  }

  function run() {
    try {
      var secs = readSections();
      var changed = false;
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(secs[doc])) return;
        secs[doc].forEach(function (s) {
          if (!s || typeof s !== 'object') return;
          if (typeof s.content === 'string') { var c = strip(s.content); if (c !== s.content) { s.content = c; changed = true; } }
          if (typeof s.hands_on === 'string') { var h = strip(s.hands_on); if (h !== s.hands_on) { s.hands_on = h; changed = true; } }
          if (typeof s.professionally === 'string') { var p = strip(s.professionally); if (p !== s.professionally) { s.professionally = p; changed = true; } }
          if (Array.isArray(s.items)) s.items.forEach(function (it) {
            if (it && typeof it === 'object') {
              if (typeof it.t === 'string') { var t = strip(it.t); if (t !== it.t) { it.t = t; changed = true; } }
              if (typeof it.v === 'string') { var v = strip(it.v); if (v !== it.v) { it.v = v; changed = true; } }
            }
          });
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'strip-skeleton' } })); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvStripSkeleton = { version: VERSION, run: run, strip: strip };
})();
