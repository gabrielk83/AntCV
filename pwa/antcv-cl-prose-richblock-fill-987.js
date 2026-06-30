/* antcv-cl-prose-richblock-fill-987.js — CL-PROSE-RICHBLOCK-FILL-001 (owner 2026-06-30)
 * ============================================================================
 * THE BUG (owner: "Who I am / opening stay placeholders, did not become real text"):
 * the CL generation APPLY writes the generated prose to a section's `.content`
 *   "opening" -> {…e, content: meta.opening}
 *   "who"     -> {…e, content: who_content}
 *   "why"     -> {…e, content: why_content}
 * BUT the me() Nordic CL sections opening/who/why are type:"rich_block", which renders
 * (and exports) `items[0].t` — NOT `.content`. So the real prose lands in a field the
 * renderer ignores, and the section keeps showing the me() template placeholder
 * ("I am applying for [Role title]…", "[Professional identity…]"). (why rendered only
 * when a converter happened to bridge it; opening/who had no such bridge.)
 *
 * THIS SIDECAR is that missing bridge: for the CL rich_block prose sections, when the
 * lead item's `t` is still a placeholder/empty AND the section's `.content` holds REAL
 * generated prose, copy `.content` -> `items[0].t` so the preview AND the worker export
 * show the real text. Strictly additive: only fills a placeholder from real content,
 * never overwrites real items, never empties. Idempotent (once items[0].t is real it
 * no-ops, so no dispatch loop). Self-disabling. Disable:
 * localStorage['antcv:disable-cl-prose-rbfill']='1'.
 *
 * If `.content` is ALSO empty (the model omitted who_content/opening), this no-ops —
 * that is a generation-completeness issue, not a hydration one.
 */
(function () {
  'use strict';
  var VERSION = '1.50.987-cl-prose-richblock-fill';
  if (window.__antcvClProseRbFill987 === VERSION) return;
  window.__antcvClProseRbFill987 = VERSION;

  var IDS = ['opening', 'who', 'why'];
  // A template line is empty, starts with "[", OR carries an embedded bracket TOKEN
  // (e.g. the opening "I am applying for [Role title] at [Company]…" — real prose has none).
  function isPlaceholder(t) { var s = String(t == null ? '' : t).trim(); return !s || s.charAt(0) === '[' || /\[[^\]]{2,}\]/.test(s); }
  function disabled() { try { var v = localStorage.getItem('antcv:disable-cl-prose-rbfill'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function run() {
    try {
      if (disabled()) return;
      var secs; try { secs = JSON.parse(localStorage.getItem('sections') || '{}'); } catch (_) { return; }
      if (!secs || !Array.isArray(secs.cl)) return;
      var changed = false;
      var cl = secs.cl.map(function (sec) {
        if (!sec || IDS.indexOf(sec.id) < 0 || sec.type !== 'rich_block' || !Array.isArray(sec.items) || !sec.items.length) return sec;
        var lead = sec.items[0];
        if (!lead || typeof lead !== 'object') return sec;
        var prose = String(sec.content == null ? '' : sec.content).trim();
        if (prose && !isPlaceholder(prose) && isPlaceholder(lead.t)) {
          var items = sec.items.slice();
          items[0] = Object.assign({}, lead, { t: prose });
          changed = true;
          return Object.assign({}, sec, { items: items });
        }
        return sec;
      });
      if (!changed) return;
      secs.cl = cl;
      try { localStorage.setItem('sections', JSON.stringify(secs)); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-prose-richblock-fill' } })); } catch (_) {}
      try { console.log('[CL-PROSE-RICHBLOCK-FILL] bridged .content -> items[0].t for CL prose sections'); } catch (_) {}
    } catch (_) { /* self-disable on error */ }
  }

  var t = null;
  function debounced() { if (t) clearTimeout(t); t = setTimeout(run, 350); }
  window.addEventListener('antcv:sections-updated', debounced);
  [400, 1200, 2800, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvClProseRbFill = { version: VERSION, run: run };
})();
