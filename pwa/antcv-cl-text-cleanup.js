/* antcv-cl-text-cleanup.js — CL render-side text heals (owner 2026-07 export review)
 * ============================================================================
 * Two deterministic, idempotent heals for the cover-letter rich_block prose that
 * the owner won't re-generate. Both are render-faithful (they fix the SAVED text so
 * preview and export agree). Self-disabling on error; kill: antcv:disable-cl-cleanup.
 *
 * C4 — LEAD-CONTINUATION-CASE (owner: "Professionally That" -> "Professionally that").
 *   A bold MARKER-row lead-in (foundation Hands-on / Professionally, the bring /
 *   contribute need bullets) takes NO colon, so the body CONTINUES the lead-in as one
 *   sentence and must start LOWERCASE — except "I" / a proper noun. We lowercase the
 *   body's first letter ONLY when its first word is a known sentence-continuation word
 *   (That, This, By, Through, ...), never a proper noun or acronym.
 *
 * C3 — TRUNCATION CLEANUP (owner: WHAT I BRING bullets cut mid-sentence — "...validation
 *   for", "...commitments, and"). Generation chopped these (the orphan re-tighten rule
 *   was meant to rewrite, not chop) and the fuller text is not recoverable. Make the
 *   bullet read COMPLETE by stripping a trailing dangling connector / comma so it ends
 *   on a content word. Only touches a body that does NOT already end in sentence
 *   punctuation (so a real sentence is never shortened). bring + contribute bullets.
 */
(function () {
  'use strict';
  var VERSION = '1.51.9';
  if (window.__antcvClTextCleanup === VERSION) return;
  window.__antcvClTextCleanup = VERSION;

  function disabled() { try { return localStorage.getItem('antcv:disable-cl-cleanup') === '1'; } catch (_) { return false; } }

  // Words that, when they OPEN a marker-row continuation, are never proper nouns — safe to lowercase.
  var SAFE_LOWER = /^(that|this|these|those|it|its|by|through|with|within|across|using|turning|keeping|building|and|but|so|then|where|when|which|while|a|an|the|each|my|their|his|her|our)$/i;
  // Trailing run of connective words (+ optional comma) that marks a chopped clause.
  var CONN_TAIL = /(?:\s*,?\s*\b(?:for|and|to|of|with|within|under|the|a|an|in|on|by|or|as|that|which)\b)+\s*$/i;

  function c4(body, b, mk, colon) {
    if (!mk || colon || !b) return body;
    var t = String(body == null ? '' : body);
    var m = t.match(/^(\s*)(\S+)/);
    if (!m) return body;
    var fw = m[2];
    if (!/^[A-Z]/.test(fw)) return body;                       // already lowercase
    if (fw === 'I' || fw === 'I,') return body;                // keep "I"
    if (!SAFE_LOWER.test(fw.replace(/[^A-Za-z]/g, ''))) return body; // not a known continuation word
    return t.replace(/^(\s*)(\S)/, function (_, sp, ch) { return sp + ch.toLowerCase(); });
  }

  function c3(body) {
    var t = String(body == null ? '' : body);
    if (/[.!?]\s*$/.test(t)) return t;                         // a real sentence — leave it
    var cleaned = t.replace(CONN_TAIL, '').replace(/[\s,;:]+$/, '');
    return cleaned || t;                                       // never blank a body
  }

  function run() {
    if (disabled()) return;
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      if (!secs || !Array.isArray(secs.cl)) return;
      var changed = false;
      secs.cl.forEach(function (sec) {
        if (!sec || sec.type !== 'rich_block' || !Array.isArray(sec.items)) return;
        var c4Sec = (sec.id === 'foundation' || sec.id === 'bring' || sec.id === 'contribute');
        var c3Sec = (sec.id === 'bring' || sec.id === 'contribute');
        if (!c4Sec && !c3Sec) return;
        sec.items.forEach(function (it) {
          if (!it || typeof it !== 'object' || it.grp) return;
          var orig = String(it.t == null ? '' : it.t);
          var v = orig;
          if (c4Sec) v = c4(v, it.b, it.mk, it.colon);
          if (c3Sec) v = c3(v);
          if (v !== orig) { it.t = v; changed = true; }
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-text-cleanup' } })); } catch (_) {}
      try { console.log('[CL-TEXT-CLEANUP] healed lead-continuation case + dangling truncations'); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  window.addEventListener('antcv:sections-updated', function () { setTimeout(run, 300); });
  [800, 2000, 4000, 8000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvClTextCleanup = { version: VERSION, run: run };
})();
