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
 *
 * C6 — CONTRIBUTE BOLD LEAD-INS (owner: the HOW I WOULD CONTRIBUTE action bullets have an
 *   empty bold lead `b`; the first phrase should be the bold lead-in). Split a leadless
 *   contribute action bullet into a bold lead (first clause) + body so it renders
 *   "**Map current change governance flows** to identify ...". See splitLead.
 */
(function () {
  'use strict';
  var VERSION = '1.51.15';
  if (window.__antcvClTextCleanup === VERSION) return;
  window.__antcvClTextCleanup = VERSION;

  function disabled() { try { return localStorage.getItem('antcv:disable-cl-cleanup') === '1'; } catch (_) { return false; } }

  // C6 — CONTRIBUTE BOLD LEAD-INS (owner: the HOW I WOULD CONTRIBUTE action bullets had an
  // empty bold lead `b`; the first phrase should be the bold lead-in — "Map current change
  // governance flows", "Set up KPI reporting", ...). Split a leadless action bullet into a
  // bold lead (first clause) + body: cut at the first connective word / comma (12-48 chars),
  // else the first four words. Conservative — returns null (no split) when no clean lead.
  function splitLead(t) {
    t = String(t == null ? '' : t).trim();
    if (!t) return null;
    var connRe = /\s\b(to|and|by|that|so|with|for|across|under|using|into|on|through|which|linking|including|while)\b\s/ig;
    var m, connIdx = -1;
    while ((m = connRe.exec(t))) { if (m.index >= 12) { connIdx = m.index; break; } }
    var commaIdx = t.indexOf(',');
    var cut = -1;
    if (commaIdx >= 12 && commaIdx <= 48 && (connIdx < 0 || commaIdx < connIdx)) cut = commaIdx;
    else if (connIdx >= 12 && connIdx <= 48) cut = connIdx;
    if (cut < 0) { var w = t.split(/\s+/); if (w.length >= 6) { var l4 = w.slice(0, 4).join(' '); if (l4.length <= 40) cut = l4.length; } }
    if (cut < 12 || cut > 48) return null;
    var lead = t.slice(0, cut).trim().replace(/[,:;]$/, '');
    var body = t.slice(cut).trim().replace(/^[,:;]\s*/, '');
    if (lead.split(/\s+/).length < 2 || lead.length < 10 || body.length < 15) return null;
    return { lead: lead, body: body };
  }

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
    if (/[.!?:]\s*$/.test(t)) return t;                        // a real sentence OR a ":" lead-in — leave it
    var cleaned = t.replace(CONN_TAIL, '').replace(/[\s,;]+$/, '');
    return cleaned || t;                                       // never blank a body
  }

  // C2b — HWIC STRUCTURE (owner 2026-07: HWIC first + last item must be MARKERLESS, intro
  // ends with ":"). The intro is the first row carrying the headline lead ("How I would
  // contribute"), the closing is the last row (the "Goal" line). Make both markerless
  // paragraphs and give the intro a ":" lead-in. Done DIRECTLY here (not via the 760 colon
  // heuristic) so it is self-contained and converges in one synchronous pass — and c3 now
  // preserves a trailing ":" so the colon is not stripped back off. Idempotent.
  function ensureContribStructure(sec) {
    if (!sec || sec.id !== 'contribute' || !Array.isArray(sec.items) || sec.items.length < 2) return false;
    var i0 = sec.items[0];
    if (!i0 || typeof i0 !== 'object' || !/contribut/i.test(String(i0.b || ''))) return false;
    var changed = false;
    var t = String(i0.t == null ? '' : i0.t);
    if (t.trim() && !/[.!?:]\s*$/.test(t)) { i0.t = t.replace(/\s+$/, '') + ':'; changed = true; }
    if (i0.mk) { i0.mk = false; changed = true; }
    var last = sec.items[sec.items.length - 1];
    if (last && last !== i0 && typeof last === 'object' && last.mk) { last.mk = false; changed = true; }
    return changed;
  }

  // C4b — WHAT I BRING colon (owner 2026-07: the bring proof rows read "Need Value" with no
  // ":"; they are label:value, NOT a continuation, so each lead takes a colon). Force colon
  // on every bring proof row (the rows after the intro that carry a lead).
  function ensureBringColons(sec) {
    if (!sec || sec.id !== 'bring' || !Array.isArray(sec.items)) return false;
    var changed = false;
    sec.items.forEach(function (it, i) {
      if (!it || typeof it !== 'object' || it.grp) return;
      if (i > 0 && it.b && String(it.t || '').trim() && it.colon !== true) { it.colon = true; changed = true; }
    });
    return changed;
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
          // C6: give a leadless contribute action bullet a bold lead-in (split the first clause).
          if (sec.id === 'contribute' && it.mk && !it.b) {
            var sp = splitLead(it.t);
            if (sp) { it.b = sp.lead; it.t = sp.body; changed = true; }
          }
          var orig = String(it.t == null ? '' : it.t);
          var v = orig;
          if (c4Sec) v = c4(v, it.b, it.mk, it.colon);
          if (c3Sec) v = c3(v);
          if (v !== orig) { it.t = v; changed = true; }
        });
      });
      // Structure/colon repairs run AFTER the per-item c3/c4 loop so c3 cannot strip the
      // intro colon (c3 also now preserves a trailing ":").
      secs.cl.forEach(function (sec) {
        if (ensureContribStructure(sec)) changed = true;
        if (ensureBringColons(sec)) changed = true;
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
