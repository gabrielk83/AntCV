/* AntCV main-column auto-squeeze (v1.50.812, PB-MAIN-OVERFLOW-001 step 2)
 * ──────────────────────────────────────────────────────────────────────
 * WHAT THIS DOES
 * The detector (antcv-main-overflow-detect-364.js) measures the main column
 * and pulses 'antcv:main-overflow-changed' with a verdict. When — and ONLY
 * when — that verdict is 'squeeze' (the main column is 1-3 body lines past a
 * whole-page boundary), this sidecar applies a SMALL, BOUNDED, FULLY-REVERSIBLE
 * density nudge to the preview so those few lines pull back onto the target
 * page and the spurious next page disappears.
 *
 * It does NOTHING for any other verdict:
 *   fits / desync-suspected → nothing to squeeze (a desync is a flag problem,
 *                             not a density problem — squeezing would not fix it
 *                             and could hide it).
 *   too-much                → more than 3 lines over; a density nudge that big
 *                             would wreck readability. Left for the user to trim.
 *   way-over                → a 6-pager. This is a CONTENT problem; no nudge can
 *                             recover whole pages. Never touched.
 * Because it keys off verdict==='squeeze' alone, the 6-page / 4-page case can
 * never trigger it.
 *
 * HOW THE NUDGE WORKS (reversible by construction)
 * We set ONE CSS custom property, --antcv-squeeze (a unitless line-height for
 * body text) plus a paragraph margin, on the preview paper, and ship a <style>
 * block (once) that consumes it. Body paragraphs and list items tighten from
 * ~1.15 toward a floor of 1.11; paragraph bottom-margin tightens slightly.
 * TABLES and HEADINGS are excluded — their line metrics drive column alignment
 * and rule placement, so squeezing them would reintroduce the alignment drift
 * we just fixed elsewhere. Removing the property (or setting step 0) restores
 * the original rendering exactly; nothing is destructive.
 *
 * CLOSED-LOOP, BOUNDED
 * The detector re-measures whenever the DOM changes. So we nudge by ONE small
 * step, then wait for the detector's next snapshot:
 *   - verdict flips to 'fits'  → done, keep the current (minimal) squeeze.
 *   - still 'squeeze'          → step once more, until the floor.
 *   - flips to anything else   → release fully (we over- or under-shot, or the
 *                                content changed under us).
 * Hard cap: MAX_STEPS small steps; the floor line-height; the 3-line budget the
 * detector already enforces. We never escalate past that.
 *
 * EXPORT PARITY — IMPORTANT, READ THIS
 * This is a PREVIEW-ONLY nudge. The DOCX/PDF export renders independently in
 * the docx-worker (generate.js, twips-based spacing) and does NOT yet read this
 * squeeze. So after a squeeze the PREVIEW lands on target but the EXPORT may
 * still place those lines on the next page. To avoid lying to the user we
 * publish the active squeeze to localStorage['antcv:squeezeApplied'] and pulse
 * 'antcv:squeeze-changed' so (a) a future generate.js change can mirror the
 * same density for true parity, and (b) the export-preview UI can warn until
 * then. We do NOT claim parity here.
 *
 * LOOP-SAFETY
 * Unlike the detector, this file MUTATES style — so it must not feed its own
 * scheduler. It (a) acts ONLY on the detector's 'antcv:main-overflow-changed'
 * event, never on a DOM observer of its own; (b) debounces; (c) writes the CSS
 * var only when the step actually changes; (d) ignores the detector event for a
 * short settle window right after it writes, so its own restyle's re-measure
 * cannot ping-pong. CV-only. Kill switch: localStorage['antcv:disable-squeeze']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.50.812-main-overflow-squeeze';
  if (window.__antcvMainSqueeze365 === VERSION) return;
  window.__antcvMainSqueeze365 = VERSION;

  var PAPER_SEL = '.antcv-preview-paper,[data-antcv-preview-paper]';
  var STYLE_ID = 'antcv-squeeze-365-style';
  var OUT_KEY = 'antcv:squeezeApplied';

  // Density ladder. step 0 = no squeeze (original). Each step tightens body
  // line-height and paragraph margin a little. Small steps so we stop as soon
  // as 'fits' is reached, rather than over-tightening.
  var LINE_HEIGHTS = [1.15, 1.14, 1.13, 1.12, 1.11]; // index by step; floor at 1.11
  var PARA_MARGINS = [null, 2.6, 2.4, 2.2, 2.0];     // px; null = leave stylesheet default at step 0
  var MAX_STEPS = LINE_HEIGHTS.length - 1;            // 4 steps available
  var SETTLE_MS = 600;  // ignore detector events this long after we restyle

  function disabled() {
    try { return localStorage.getItem('antcv:disable-squeeze') === '1'; } catch (_) { return false; }
  }
  function paper() { return document.querySelector(PAPER_SEL); }

  // Inject the consuming stylesheet ONCE. It is inert until --antcv-squeeze is
  // set on the paper (default: the var's fallback = the original 1.15 / no
  // change), so its mere presence changes nothing.
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      /* Only body paragraphs and list items inside the MAIN column. NOT tables */
      /* (alignment-critical) and NOT headings (rule placement). The var */
      /* defaults to 1.15 so when unset nothing changes. */
      '.antcv-preview-paper [data-antcv-document-main="true"] p:not([data-antcv-no-squeeze]),',
      '.antcv-preview-paper [data-antcv-document-main="true"] li,',
      '.antcv-preview-paper .antcv-document-main p:not([data-antcv-no-squeeze]),',
      '.antcv-preview-paper .antcv-document-main li {',
      '  line-height: var(--antcv-squeeze, 1.15) !important;',
      '}',
      '.antcv-preview-paper [data-antcv-document-main="true"] p,',
      '.antcv-preview-paper .antcv-document-main p {',
      '  margin-bottom: var(--antcv-squeeze-mb, unset);',
      '}',
      /* Never squeeze inside tables — restore the normal line-height there. */
      '.antcv-preview-paper [data-antcv-document-main="true"] table p,',
      '.antcv-preview-paper [data-antcv-document-main="true"] table li,',
      '.antcv-preview-paper .antcv-document-main table p,',
      '.antcv-preview-paper .antcv-document-main table li {',
      '  line-height: 1.15 !important;',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(st);
  }

  var currentStep = 0;
  var lastWriteTs = 0;

  function applyStep(step) {
    var p = paper();
    if (!p) return;
    step = Math.max(0, Math.min(MAX_STEPS, step));
    ensureStyle();
    if (step === 0) {
      p.style.removeProperty('--antcv-squeeze');
      p.style.removeProperty('--antcv-squeeze-mb');
    } else {
      p.style.setProperty('--antcv-squeeze', String(LINE_HEIGHTS[step]));
      if (PARA_MARGINS[step] != null) p.style.setProperty('--antcv-squeeze-mb', PARA_MARGINS[step] + 'px');
    }
    currentStep = step;
    lastWriteTs = Date.now();
    publish();
  }

  function publish() {
    var payload = {
      ts: Date.now(),
      version: VERSION,
      step: currentStep,
      lineHeight: LINE_HEIGHTS[currentStep],
      active: currentStep > 0,
      // Honest parity flag — the export does NOT yet read this.
      exportParity: false,
    };
    try { localStorage.setItem(OUT_KEY, JSON.stringify(payload)); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:squeeze-changed', { detail: payload })); } catch (_) {}
  }

  function release() {
    if (currentStep !== 0) applyStep(0);
  }

  function onOverflow(ev) {
    if (disabled()) { release(); return; }
    // Ignore our own restyle's echo for a settle window.
    if (Date.now() - lastWriteTs < SETTLE_MS) return;

    var s = (ev && ev.detail) || null;
    if (!s) {
      try { s = JSON.parse(localStorage.getItem('antcv:mainOverflow') || 'null'); } catch (_) { s = null; }
    }
    if (!s || s.doc !== 'cv') { release(); return; }

    switch (s.verdict) {
      case 'squeeze':
        // Step toward 'fits'. One small step per snapshot; the detector
        // re-measures after our restyle and tells us whether to continue.
        if (currentStep < MAX_STEPS) {
          applyStep(currentStep + 1);
        }
        // If we are already at MAX_STEPS and it is STILL 'squeeze', we have
        // done all a bounded nudge may do; stop here (leave the max squeeze on;
        // it is within the 3-line budget the detector enforces).
        break;

      case 'fits':
        // Reached the target. Keep the current minimal squeeze — releasing now
        // would bounce it back to 'squeeze'. (If we were never squeezing,
        // currentStep is 0 and this is a no-op.)
        publish();
        break;

      // Anything the squeeze must not touch → fully release so the page renders
      // at its true density and the correct verdict (too-much / way-over /
      // desync-suspected) is shown to the user without our interference.
      case 'too-much':
      case 'way-over':
      case 'desync-suspected':
      default:
        release();
        break;
    }
  }

  // Debounce the detector events (it can pulse a few in a burst).
  var pending = null;
  function schedule(ev) {
    var detail = ev && ev.detail;
    if (pending) clearTimeout(pending);
    pending = setTimeout(function () { pending = null; onOverflow({ detail: detail }); }, 120);
  }

  window.addEventListener('antcv:main-overflow-changed', schedule);
  // Re-evaluate if the user toggles the kill switch or switches CV/CL.
  window.addEventListener('storage', function (e) {
    if (e && (e.key === 'antcv:disable-squeeze' || e.key === 'doc')) schedule({ detail: null });
  });

  // Public API (manual control + tests).
  window.AntcvMainSqueeze365 = {
    version: VERSION,
    getStep: function () { return currentStep; },
    setStep: applyStep,
    release: release,
    _onOverflow: onOverflow,
  };

  // Seed from any existing snapshot at load (e.g. detector already ran).
  ensureStyle();
  setTimeout(function () { schedule({ detail: null }); }, 1200);

  try { console.debug('[main-squeeze-365] installed ' + VERSION + ' (preview-only, reversible)'); } catch (_) {}
})();
