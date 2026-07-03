/* antcv-emdash-to-hyphen.js — EMDASH-HYPHEN-001 (owner 2026-06-18)
 * ============================================================================
 * Owner: "ALWAYS use only '-' not the long '—'." Normalises the em dash (— U+2014)
 * and en dash (– U+2013) to a plain hyphen (-) across ALL CV/CL section content
 * (titles, bullets, labeled-list item label/value, outcomes, results, …) on every
 * sections update — so BOTH the preview and the worker export use hyphens, no
 * matter whether the long dash came from the kernel, a paste, or LLM generation.
 *
 * EMDASH-META-CL-PROSE-001 (1.51.118, owner 2026-07-04, NIL round-4): the exported
 * CL prose carried em dashes ("nanooptics—where…") because the CL HEADER prose is
 * sourced from `localStorage['meta']` (meta.opening / meta.greeting / meta.subtitle),
 * which this scrub never walked — it only touched `sections`. The generated meta
 * prose (LLM-emitted, not passing the section path) bypassed all three dash layers.
 * Fix: normalise `meta` on the SAME pass as `sections`. Both are export sources.
 *
 * Sidecar-only — no app.src.js / generation change. Loop-safe: a fast string
 * bail (no long dash present → no work, no write) means after one pass there is
 * nothing to do, and our own tagged sections-updated event is ignored.
 * Disable: localStorage['antcv:disable-emdash-hyphen'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvEmdashHyphen) return;
  window.__antcvEmdashHyphen = '1.51.118';

  var SRC = 'emdash-hyphen';
  var DASH = /[—–]/g;            // em dash + en dash → hyphen
  // Persisted stores whose string content reaches the preview AND the worker
  // export. `meta` carries the CL header prose (opening/greeting/subtitle=slogan)
  // that is LLM-generated and never routed through the section normalizers.
  var KEYS = ['sections', 'meta'];
  function disabled() { try { var v = localStorage.getItem('antcv:disable-emdash-hyphen'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  var CHANGED = false;
  function walk(o) {
    if (typeof o === 'string') { if (DASH.test(o)) { CHANGED = true; return o.replace(DASH, '-'); } return o; }
    if (Array.isArray(o)) return o.map(walk);
    if (o && typeof o === 'object') { var m = {}; for (var k in o) { if (Object.prototype.hasOwnProperty.call(o, k)) m[k] = walk(o[k]); } return m; }
    return o;
  }

  function applyKey(key) {
    var raw; try { raw = localStorage.getItem(key); } catch (_) { return false; }
    // Fast bail: nothing to do if there is no long dash anywhere in the blob.
    if (!raw || (raw.indexOf('—') < 0 && raw.indexOf('–') < 0)) return false;
    var b; try { b = JSON.parse(raw); } catch (_) { return false; }
    CHANGED = false;
    var nb = walk(b);
    if (!CHANGED) return false;
    try { localStorage.setItem(key, JSON.stringify(nb)); } catch (_) { return false; }
    try { console.info('[emdash-hyphen] normalised — / – → - in ' + key); } catch (_) {}
    return true;
  }

  function apply() {
    if (disabled()) return;
    var changed = false;
    for (var i = 0; i < KEYS.length; i++) { if (applyKey(KEYS[i])) changed = true; }
    if (!changed) return;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [400, 1200, 2600].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvEmdashHyphen = { version: '1.51.118', _apply: apply, _applyKey: applyKey };
})();
