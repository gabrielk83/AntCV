/* antcv-disclosure-triangle.js — DISCLOSURE-TRIANGLE-CONSISTENCY-001 (owner 2026-06-15)
 * ============================================================================
 * ADVANCED VISUAL STYLES uses a custom LEFT disclosure triangle (▸ collapsed /
 * ▾ expanded; ADV-VISUAL-DISCLOSURE-001). The OTHER Advanced/settings collapsibles
 * are native <details>/<summary> (SPACING & INDENTS, …) showing the browser's
 * default ► marker — inconsistent. This sidecar gives every native <details>
 * the SAME ▸/▾ marker so all collapsibles read alike.
 *
 * Safe + surgical:
 *  - CSS-only marker swap (the native open/close behaviour is untouched).
 *  - The marker is `color: inherit` so it works on any panel background.
 *  - SKIPS a <details> whose <summary> ALREADY shows an inline triangle glyph
 *    (▸▾▼►▲) so a collapsible with its own marker never gets a DOUBLE one.
 *  - ADVANCED VISUAL STYLES is a <div> (not <details>), so it is never touched.
 *
 * Sidecar-only — no app.js change. MutationObserver re-classes on re-render.
 * Disable: localStorage['antcv:disable-disclosure-triangle'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.50.703';
  if (window.__antcvDisclosureTriangle) return;
  window.__antcvDisclosureTriangle = VERSION;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-disclosure-triangle'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  var TRI = /[▸▾▼►▲▶▽▴]/;   // ▸ ▾ ▼ ► ▲ ▶ ▽ ▴

  function ensureStyles() {
    if (document.getElementById('antcv-disclosure-triangle-styles')) return;
    var css = 'details.antcv-disc-tri > summary{list-style:none;}'
      + 'details.antcv-disc-tri > summary::-webkit-details-marker{display:none;}'
      + 'details.antcv-disc-tri > summary::before{content:"\\25B8";display:inline-block;width:.7em;margin-right:.4em;font-size:.8em;opacity:.55;color:inherit;vertical-align:baseline;}'
      + 'details.antcv-disc-tri[open] > summary::before{content:"\\25BE";}';
    var el = document.createElement('style'); el.id = 'antcv-disclosure-triangle-styles'; el.textContent = css;
    (document.head || document.documentElement).appendChild(el);
  }

  function scan() {
    if (disabled()) return;
    var list = document.getElementsByTagName('details');
    for (var i = 0; i < list.length; i++) {
      var d = list[i];
      if (d.classList.contains('antcv-disc-tri')) continue;
      var sum = d.querySelector(':scope > summary');
      if (!sum) continue;
      // skip if the summary already shows its own triangle glyph (no double marker)
      if (TRI.test(sum.textContent || '')) continue;
      d.classList.add('antcv-disc-tri');
    }
  }

  var pending = false, lastAt = 0;
  function schedule() {
    if (pending) return; pending = true;
    var now = (window.performance && performance.now) ? performance.now() : Date.now();
    var wait = Math.max(0, 300 - (now - lastAt));
    var run = function () { pending = false; lastAt = (window.performance && performance.now) ? performance.now() : Date.now(); try { ensureStyles(); scan(); } catch (_) {} };
    if (wait > 0) setTimeout(run, wait); else (window.requestAnimationFrame || setTimeout)(run);
  }

  try { var mo = new MutationObserver(function () { schedule(); }); mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  [500, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });

  window.AntcvDisclosureTriangle = { version: VERSION, _scan: scan };
})();
