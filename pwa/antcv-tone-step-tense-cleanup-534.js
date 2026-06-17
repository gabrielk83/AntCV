/* antcv-tone-step-tense-cleanup-534.js — wizard/settings UX (owner 2026-06-17)
 * ============================================================================
 * Two sidecar-only adjustments to app.js-rendered DOM (no app.js edit, so no
 * bluescreen risk — the gated-app.js rule stands):
 *
 *  #7b  Remove the REDUNDANT Experience-tense control from the Advanced
 *       settings menu. The Personal-tab control (antcv-tense-control-422.js,
 *       buttons stamped data-antcv-tense) is the keeper; the Advanced block
 *       (app.js, buttons stamped data-antcv-EXP-tense) is the duplicate. We
 *       hide ONLY the advanced block. The tense FUNCTIONALITY is untouched —
 *       the generation prompt reads styleConfig.expTense, still written by the
 *       Personal + wizard controls — so Professional-Experience results and
 *       Selected-Outcomes still honour the forced past/present tense.
 *
 *  #10  Move the personality-kernel quiz button onto the tone step (6C — "What
 *       tone fits you?"), where tone + personality belong together. The button
 *       was removed from the wizard language slide (antcv-wizard-language-
 *       slide-339.js) in the same release. Opens via AntcvPersonalityQuiz.open.
 *
 *  #8/#4 (1.50.535) De-duplicate Banned WORDS + Banned PHRASES. They appeared in
 *       TWO places: the Writing-Style section island (Settings → Personal,
 *       per-language store extraBannedWords, injected into generation by
 *       src/lib/install-fetch-wrap.ts) AND the app.js Advanced "Tone & banned
 *       terms" controls (stylePrefs.banned_words/phrases string, read by the
 *       prompt). The island is the keeper (it has the per-language en/da/es/zh
 *       selector). We HIDE the two app.js Advanced banned fields. This is
 *       NON-DESTRUCTIVE: any existing stylePrefs.banned_words/phrases is still
 *       read by the prompt; the island's words still reach the worker via the
 *       fetch-wrap. (The Advanced "Preferred tone" field is left untouched.)
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.556-tone-tense-cleanup';
  if (window.__antcvToneTenseCleanup534 === VERSION) return;
  window.__antcvToneTenseCleanup534 = VERSION;

  // #7b — hide the Advanced-menu EXPERIENCE TENSE block (data-antcv-exp-tense).
  function hideAdvancedTense() {
    try {
      var btns = document.querySelectorAll('button[data-antcv-exp-tense]');
      for (var i = 0; i < btns.length; i++) {
        var flex = btns[i].parentElement;
        var wrap = flex && flex.parentElement;
        if (wrap && wrap.getAttribute('data-antcv-exp-tense-hidden') !== '1' &&
            /EXPERIENCE TENSE/.test(wrap.textContent || '')) {
          wrap.style.setProperty('display', 'none', 'important');
          wrap.setAttribute('data-antcv-exp-tense-hidden', '1');
        }
      }
    } catch (_) {}
  }

  // #10 — show the quiz button ONLY on the visible 6C tone step.
  // v1.50.536 fix: the old version appended once and never removed it, and it
  // didn't gate on visibility — so the button stuck to every wizard step. Now
  // we find the VISIBLE "What tone fits you?" card each pass, remove any quiz
  // button that isn't inside it, and inject only when that card is on screen.
  function isVisible(el) {
    try { return !!(el && el.getClientRects && el.getClientRects().length > 0); } catch (_) { return false; }
  }
  function injectQuizOnTone() {
    try {
      var heads = document.querySelectorAll('h1, h2, h3');
      var card = null;
      for (var i = 0; i < heads.length; i++) {
        if (/what tone fits you/i.test(heads[i].textContent || '') && isVisible(heads[i])) { card = heads[i].closest('div'); break; }
      }
      // Remove stray quiz buttons that are NOT in the current visible tone card
      // (covers every other wizard step + the tone step being navigated away).
      var strays = document.querySelectorAll('[data-antcv-tone-quiz-btn]');
      for (var s = 0; s < strays.length; s++) {
        if (!card || !card.contains(strays[s])) { try { strays[s].remove(); } catch (_) {} }
      }
      if (!card || card.querySelector('[data-antcv-tone-quiz-btn]')) return;
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-antcv-tone-quiz-btn', '1');
      b.textContent = '✨ Build your personality kernel (8-question quiz)';
      b.style.cssText = 'margin:12px 0 0;width:100%;padding:10px 12px;border-radius:8px;border:1px solid rgba(1,183,187,0.45);background:rgba(1,183,187,0.12);color:#cfeff0;cursor:pointer;font-size:12px;font-weight:700;font-family:inherit;';
      b.addEventListener('click', function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        try {
          if (window.AntcvPersonalityQuiz && window.AntcvPersonalityQuiz.open) window.AntcvPersonalityQuiz.open();
          else window.dispatchEvent(new CustomEvent('antcv:open-personality-quiz'));
        } catch (_) {}
      });
      // Place it above the Back/Next button row when we can find it, else append.
      var anchor = null;
      var bs = card.querySelectorAll('button');
      for (var k = 0; k < bs.length; k++) {
        if (/^\s*←?\s*Back\b/i.test(bs[k].textContent || '')) { anchor = bs[k].closest('div'); break; }
      }
      if (anchor && anchor.parentElement === card) card.insertBefore(b, anchor);
      else card.appendChild(b);
    } catch (_) {}
  }

  function deepestContaining(marker) {
    var all = document.getElementsByTagName('*');
    var best = null, bestLen = Infinity;
    for (var i = 0; i < all.length; i++) {
      var t = all[i].textContent || '';
      if (t.indexOf(marker) >= 0 && t.length < bestLen) { best = all[i]; bestLen = t.length; }
    }
    return best;
  }
  // v1.50.549 BANNED-FUSION-001: the Writing-Style ISLAND now fuses banned
  // words/phrases (per-language buckets + an "All languages" cross-language scope
  // that edits the SAME stylePrefs.banned_words store + the bank). So the app.js
  // Advanced banned word/phrase fields are now a true DUPLICATE — re-hide them,
  // but ONLY while the island is present (else keep them as a fallback). This is
  // the careful version of 1.50.535 (which hid them with no superset → reverted).
  var BANNED_HELPERS = ['Words you want excluded from generated', 'Multi-word patterns to avoid'];
  function markHidden(el) {
    if (el && el.getAttribute('data-antcv-banned-dedup-hidden') !== '1') {
      el.style.setProperty('display', 'none', 'important');
      el.setAttribute('data-antcv-banned-dedup-hidden', '1');
    }
  }
  function hideAppBannedFields() {
    try {
      // 1. The banned word/phrase vi fields (marginBottom:14 wrappers).
      for (var i = 0; i < BANNED_HELPERS.length; i++) {
        var leaf = deepestContaining(BANNED_HELPERS[i]);
        if (!leaf) continue;
        var n = leaf, hops = 0;
        while (n && hops < 8 && !(n.style && n.style.marginBottom === '14px')) { n = n.parentElement; hops++; }
        if (n && n.style && n.style.marginBottom === '14px') markHidden(n);
      }
      // 2. (#4 step 2) The whole app.js "Advanced Tone" + "Banned Words" <details>
      //    — now fully covered by the island (tone chips + preferred tone + banned
      //    + semantic). display:none keeps textContent so getTabState's personal
      //    heuristic (ADVANCED TONE / BANNED WORDS) still detects the subtab.
      var dets = document.querySelectorAll('details');
      for (var d = 0; d < dets.length; d++) {
        var sum = dets[d].querySelector('summary');
        if (sum && /^(Advanced Tone|Banned Words)$/i.test((sum.textContent || '').trim())) markHidden(dets[d]);
      }
      // 3. The app.js "WRITING STYLE" control (label + hidden select + description)
      //    — the island owns the writing-style header/dropdown now.
      var wsLeaf = deepestContaining('WRITING STYLE');
      if (wsLeaf && wsLeaf.parentElement && wsLeaf.parentElement.querySelector('select')) markHidden(wsLeaf.parentElement);
    } catch (_) {}
  }
  function unhideAppBannedFields() {
    try {
      var hidden = document.querySelectorAll('[data-antcv-banned-dedup-hidden="1"]');
      for (var i = 0; i < hidden.length; i++) {
        try { hidden[i].style.removeProperty('display'); hidden[i].removeAttribute('data-antcv-banned-dedup-hidden'); } catch (_) {}
      }
    } catch (_) {}
  }
  function syncAppBannedFields() {
    // Hide the app.js duplicate only when the island (the superset) is mounted;
    // otherwise restore it so banned words are never unreachable.
    if (document.querySelector('[data-antcv-react-island="writing-style-picker"]')) hideAppBannedFields();
    else unhideAppBannedFields();
  }

  // A (1.50.541) — hide the Layout "SELECTED OUTCOMES" Bullets/Inline toggle.
  // Its function is now covered by the Selected-Outcomes format dropdown in the
  // Layout picker ("Results" option). Matched by its unique helper sentence.
  function hideOutcomesModeToggle() {
    try {
      var leaf = deepestContaining('Show outcomes as their own bullet section');
      if (!leaf) return;
      var n = leaf, hops = 0;
      while (n && hops < 8 && !(n.style && n.style.marginBottom === '14px')) { n = n.parentElement; hops++; }
      if (n && n.style && n.style.marginBottom === '14px' && n.getAttribute('data-antcv-outcomes-toggle-hidden') !== '1') {
        n.style.setProperty('display', 'none', 'important');
        n.setAttribute('data-antcv-outcomes-toggle-hidden', '1');
      }
    } catch (_) {}
  }

  // B/C default — Results is now the DEFAULT outcomes rendering (owner). If the
  // store was never set, seed it to 'results' once (the dropdown can switch back
  // to 'section'). Runs once at boot.
  function defaultOutcomesResults() {
    try {
      if (localStorage.getItem('outcomesMode') == null) {
        localStorage.setItem('outcomesMode', JSON.stringify('results'));
        window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'outcomes-default-results' } }));
      }
    } catch (_) {}
  }

  var pending = false;
  function run() { hideAdvancedTense(); injectQuizOnTone(); syncAppBannedFields(); hideOutcomesModeToggle(); }
  function schedule() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { run(); } catch (_) {} }); }
  function boot() {
    defaultOutcomesResults();
    schedule();
    [200, 600, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });
    try { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvToneTenseCleanup534 = { version: VERSION, _run: run };
})();
