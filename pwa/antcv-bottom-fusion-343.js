/* AntCV bottom-bar Fusion button (v1.40.345)
 * ============================================================================
 *
 * Bundle 2 (part 1 of the analysis-panel rework): relocate the CL->CV Fusion
 * action from the floating overlay FAB into the bottom navigation bar, placed
 * immediately to the RIGHT of the CV/CL switch, as requested.
 *
 * v1.40.345: replaced the label's leading glyph. It was U+2728 SPARKLES (the
 * "enhance" icon), which misrepresented the action. Now a small inline SVG
 * crossroads/merge mark (two paths converging into one) that reads as fuse/
 * merge and renders identically across platforms (no emoji-font variance).
 * The label is built via innerHTML so the SVG + word render together; the
 * busy/restore path captures and restores innerHTML to match.
 *
 * Why a DOM-injection sidecar
 * ---------------------------
 * The bottom nav (.antcv-react-bottom-nav) and the CV/CL switch button are
 * rendered inside the minified app.js React tree, not in the headless React
 * island. Per CLAUDE.md hotfix discipline we do not edit app.js or the bundle;
 * we inject next to a stable anchor using a MutationObserver, the same pattern
 * every other AntCV editor sidecar uses (section-move-button, cl-closure...).
 *
 * Stable anchors (verified against app.js @ sha 251559c5)
 * -------------------------------------------------------
 *   - Bottom nav container:  .antcv-react-bottom-nav
 *   - CV/CL switch button:   button[aria-label="Switch CV or CL"]
 *   - Fusion handler:        window.AntcvFusion()  (= app.js `wl`)
 *       It owns its own confirm() dialog, busy flag (Ra), CV update, and the
 *       "no cover letter content to fuse" guard. We just invoke it. No DOM
 *       click of a hidden button needed (the overlay's old title-fragment
 *       approach is obsolete).
 *
 * Behaviour
 * ---------
 *   - Pill button matching the switch's visual language (teal #087f7a accent,
 *     #dff4f4 ground, height 42, rounded). Label: crossroads SVG + "Fuse"
 *     (compact) so the bar stays within width; full intent in title + aria.
 *   - Click -> window.AntcvFusion(). While running, shows the busy glyph and
 *     disables. Fusion is async; app.js manages the real busy state, so we
 *     restore the button when the promise settles (with a 90s safety cap).
 *   - Idempotent: one button per switch; re-runs of the sweep are no-ops.
 *
 * Companion change (in index.html, hydrateOverlayCfg): the overlay's floating
 * fusion FAB is disabled (enabled.fusionButton=false) so the action lives in
 * exactly one place.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.345';
  if (window.__antcvBottomFusion343 === SCRIPT_VERSION) return;
  window.__antcvBottomFusion343 = SCRIPT_VERSION;

  var SWITCH_SEL = 'button[aria-label="Switch CV or CL"]';
  var MARKER = 'data-antcv-bottom-fusion-343';

  // Crossroads / merge mark: two paths converging into one downward stroke.
  // 14px, currentColor so it inherits the pill's teal text colour.
  var ICON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:5px" aria-hidden="true"><path d="M5 3v4c0 2 1.5 3.5 3.5 4.5S12 13 12 15v6"/><path d="M19 3v4c0 2-1.5 3.5-3.5 4.5"/><path d="M9 18l3 3 3-3"/></svg>';

  function isDanish() {
    try {
      var v = localStorage.getItem('language');
      if (!v) return false;
      try { v = JSON.parse(v); } catch (_) {}
      return String(v).toLowerCase() === 'da';
    } catch (_) { return false; }
  }

  function makeFusionButton() {
    var da = isDanish();
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(MARKER, '1');
    btn.setAttribute('aria-label', da
      ? 'Sammenflet f\u00f8lgebrev til CV'
      : 'Fuse cover letter signals into CV');
    btn.title = da
      ? 'Sammenflet: v\u00e6v f\u00f8lgebrevets signaler ind i CV-ets profil og resultater'
      : 'Fuse: weave the cover letter signals into the CV profile and outcomes';
    btn.innerHTML = ICON + (da ? 'Flet' : 'Fuse');
    // Match the switch pill's visual language: flex:0 0 auto, height 42,
    // rounded, teal accent on a pale-teal ground.
    btn.style.cssText = [
      'flex:0 0 auto',
      'height:42px',
      'padding:0 12px',
      'border-radius:999px',
      'border:1px solid rgba(8,86,96,.20)',
      'background:#dff4f4',
      'color:#07545e',
      'font-weight:900',
      'font-size:12px',
      'cursor:pointer',
      'white-space:nowrap',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
    ].join(';');

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (typeof window.AntcvFusion !== 'function') {
        alert(da
          ? 'Fusion er ikke klar endnu. Gener\u00e9r b\u00e5de CV og f\u00f8lgebrev f\u00f8rst.'
          : 'Fusion is not ready yet. Generate both a CV and a cover letter first.');
        return;
      }
      if (btn.disabled) return;
      var original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = da ? '\u23f3 Fletter\u2026' : '\u23f3 Fusing\u2026';
      btn.style.cursor = 'wait';
      var restored = false;
      var restore = function () {
        if (restored) return;
        restored = true;
        btn.disabled = false;
        btn.innerHTML = original;
        btn.style.cursor = 'pointer';
      };
      // Safety cap so the button never sticks on the busy glyph if the
      // handler resolves without us seeing it.
      var cap = setTimeout(restore, 90000);
      try {
        Promise.resolve(window.AntcvFusion())
          .catch(function () {})
          .finally(function () { clearTimeout(cap); restore(); });
      } catch (_) {
        clearTimeout(cap);
        restore();
      }
    });
    return btn;
  }

  function ensureFusionButton() {
    var switches = document.querySelectorAll(SWITCH_SEL);
    for (var i = 0; i < switches.length; i++) {
      var sw = switches[i];
      if (!sw || !sw.parentNode) continue;
      // Already injected right after this switch?
      var next = sw.nextElementSibling;
      if (next && next.getAttribute && next.getAttribute(MARKER) === '1') continue;
      // Avoid duplicates if a stray button exists elsewhere in this bar.
      if (sw.parentNode.querySelector('[' + MARKER + '="1"]')) continue;
      var btn = makeFusionButton();
      // Insert immediately to the RIGHT of the switch.
      if (sw.nextSibling) sw.parentNode.insertBefore(btn, sw.nextSibling);
      else sw.parentNode.appendChild(btn);
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { ensureFusionButton(); } catch (_) {}
    });
  }

  schedule();
  [200, 600, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  // Re-evaluate label language if the app switches language at runtime.
  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvBottomFusion343 = { version: SCRIPT_VERSION, sweep: ensureFusionButton };

  try { console.debug('[bottom-fusion-343] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
