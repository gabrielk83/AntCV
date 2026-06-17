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
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.534-tone-tense-cleanup';
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

  // #10 — inject the quiz button on the 6C tone step.
  function injectQuizOnTone() {
    try {
      var heads = document.querySelectorAll('h1, h2, h3');
      var card = null;
      for (var i = 0; i < heads.length; i++) {
        if (/what tone fits you/i.test(heads[i].textContent || '')) { card = heads[i].closest('div'); break; }
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

  var pending = false;
  function run() { hideAdvancedTense(); injectQuizOnTone(); }
  function schedule() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { run(); } catch (_) {} }); }
  function boot() {
    schedule();
    [200, 600, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });
    try { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvToneTenseCleanup534 = { version: VERSION, _run: run };
})();
