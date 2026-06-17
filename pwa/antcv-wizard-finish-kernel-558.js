/* antcv-wizard-finish-kernel-558.js — wizard-finish baseline kernel (owner 2026-06-17)
 * ============================================================================
 * On the final wizard step ("You're ready 🎉"):
 *   1. Explain the baseline KERNEL — a default UNSOLICITED general application
 *      (CV + cover letter showing the user's full data in AntCV format) that
 *      powers ⚡ Quick generation (fast, lower-priority apps reuse it).
 *   2. On Finish, CONDITIONALLY generate that baseline:
 *        - generate IF the settings changed since the last baseline OR no
 *          baseline exists yet (never ran a wizard / never saved settings);
 *        - SKIP if nothing changed AND a fitting baseline already exists.
 *      The decision = a settings signature vs the stored baseline signature.
 *   3. The actual generation reuses the app's existing UNSOLICITED flow: with an
 *      empty JD (antcv:lastJdText), we click "Generate CV & Cover Letter" once,
 *      guarded against loops / double-fire / clobbering a pasted JD.
 * Sidecar-only; no app.js edit.
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.558-finish-kernel';
  if (window.__antcvWizardFinishKernel558 === VERSION) return;
  window.__antcvWizardFinishKernel558 = VERSION;

  var PENDING_KEY = 'antcv:genBaselinePending';
  var SIG_KEY = 'antcv:baselineSig';

  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }

  // Signature of the settings that shape the baseline application.
  function settingsSig() {
    try {
      var pi = {}; try { pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) {}
      var parts = {
        name: pi.name || '',
        expN: ((pi.experience || pi.workHistory || []) || []).length,
        stylePrefs: pi.stylePrefs || {},
        writingPrefs: pi.writingPrefs || {},
        personality: pi.personality || null,
        langs: lsGet('enabledLanguages'),
        styleConfig: lsGet('styleConfig'),
        pkg: lsGet('antcv:selectedPackage') || lsGet('selectedPackage'),
      };
      var s = JSON.stringify(parts), h = 0;
      for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
      return s.length + ':' + h;
    } catch (_) { return ''; }
  }

  function baselineExists() {
    try {
      var root = JSON.parse(localStorage.getItem('sections') || '{}') || {};
      var cv = Array.isArray(root.cv) ? root.cv : [];
      return cv.some(function (s) { return s && s.on !== false && (s.content || (s.roles && s.roles.length) || (s.items && s.items.length)); });
    } catch (_) { return false; }
  }

  // Returns the new signature when a (re)generation is warranted, else null.
  function shouldGenerate() {
    var sig = settingsSig();
    if (!baselineExists()) return sig;     // never generated → generate
    if (lsGet(SIG_KEY) !== sig) return sig; // settings changed → regenerate
    return null;                            // unchanged + fits → skip
  }

  function findReadyCard() {
    var heads = document.querySelectorAll('h1');
    for (var i = 0; i < heads.length; i++) {
      if (/you.?re ready/i.test(heads[i].textContent || '')) return heads[i].closest('div');
    }
    return null;
  }

  function injectFinishText() {
    var card = findReadyCard();
    if (!card || card.querySelector('[data-antcv-finish-kernel-note]')) {
      if (card) hookFinish(card);
      return;
    }
    var need = shouldGenerate();
    var note = document.createElement('div');
    note.setAttribute('data-antcv-finish-kernel-note', '1');
    note.style.cssText = 'margin:10px 0 0;padding:9px 11px;border-radius:8px;border:1px solid rgba(1,183,187,0.4);background:rgba(1,183,187,0.10);font-size:11.5px;line-height:1.5;color:#cfeff0;';
    note.innerHTML = need
      ? '🧬 <strong>Your baseline application (kernel)</strong> will be generated now — a default unsolicited CV + cover letter showing your full data in AntCV format. It powers <strong>⚡ Quick generation</strong> (faster, lower-priority applications reuse it). Refine it any time in the editor.'
      : '✓ <strong>Your baseline application (kernel) is ready</strong> and fits your current settings — nothing changed, so it will not be re-generated. It powers ⚡ Quick generation.';
    var anchor = null, btns = card.querySelectorAll('button');
    for (var k = 0; k < btns.length; k++) { if (/finish/i.test(btns[k].textContent || '')) { anchor = btns[k].closest('div'); break; } }
    if (anchor && anchor.parentElement === card) card.insertBefore(note, anchor);
    else card.appendChild(note);
    hookFinish(card);
  }

  function hookFinish(card) {
    var btns = card.querySelectorAll('button');
    for (var j = 0; j < btns.length; j++) {
      if (/finish/i.test(btns[j].textContent || '') && !btns[j].__antcvFinishKernelHooked) {
        btns[j].__antcvFinishKernelHooked = 1;
        btns[j].addEventListener('click', function () {
          try { var g = shouldGenerate(); if (g) localStorage.setItem(PENDING_KEY, g); } catch (_) {}
        }, true);
      }
    }
  }

  // On the home screen, fire the unsolicited generation once when pending.
  var fired = false;
  function maybeGenerate() {
    if (fired) return;
    var pending = lsGet(PENDING_KEY);
    if (!pending) return;
    if (findReadyCard()) return;                 // wizard still open
    if (String(lsGet('antcv:lastJdText')).trim()) return; // keep the baseline UNSOLICITED — don't clobber a pasted JD
    var gen = null, btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var t = (btns[i].textContent || '').trim();
      if (/^Generate CV & Cover Letter/i.test(t) && !/Generating/i.test(t) && !btns[i].disabled && btns[i].offsetParent !== null) { gen = btns[i]; break; }
    }
    if (!gen) return;
    // Clear PENDING immediately (prevents a reload loop if generation fails) and
    // store the sig on the next sections-updated (generation completion).
    fired = true;
    try { localStorage.removeItem(PENDING_KEY); } catch (_) {}
    var done = function () { try { localStorage.setItem(SIG_KEY, pending); } catch (_) {} window.removeEventListener('antcv:sections-updated', done); };
    window.addEventListener('antcv:sections-updated', done);
    try { gen.click(); } catch (_) { fired = false; return; }
    try {
      var to = document.createElement('div');
      to.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483600;background:#283556;color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;box-shadow:0 8px 30px rgba(0,0,0,.35);font-family:Calibri,Arial,sans-serif;';
      to.textContent = '🧬 Generating your baseline application…';
      document.body.appendChild(to);
      setTimeout(function () { try { to.remove(); } catch (_) {} }, 6000);
    } catch (_) {}
  }

  var pending = false;
  function run() { try { injectFinishText(); } catch (_) {} try { maybeGenerate(); } catch (_) {} }
  function schedule() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; run(); }); }
  function boot() {
    schedule();
    [300, 800, 1800, 3500].forEach(function (d) { setTimeout(schedule, d); });
    try { new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvWizardFinishKernel558 = { version: VERSION, _settingsSig: settingsSig, _shouldGenerate: shouldGenerate, _baselineExists: baselineExists };
})();
