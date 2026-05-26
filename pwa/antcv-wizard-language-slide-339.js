/* AntCV wizard language slide (v1.40.339-e)
 * ===========================================================================
 * Adds a "Set your languages" step at the END of the wizard, shown right
 * before the AI-Notice modal that gates the final wizard close.
 *
 * v1.40.339-e changes (against v1.40.339-c)
 * -----------------------------------------
 *  Dropped trigger condition (4): localStorage.wizardCompleted truthy.
 *
 *  Why: the wizard's e() handler calls u.set("wizardCompleted", true)
 *  immediately BEFORE AntcvShowAiNotice({onContinue:_antcvCloseWiz}),
 *  but u.set is a React-y state setter — the actual localStorage write
 *  happens via a useEffect that runs AFTER the synchronous code path.
 *  So when our wrapper synchronously inspects LS, wizardCompleted may
 *  still be null → condition fails → pass-through → no language slide.
 *
 *  Conditions (1) one-shot, (2) opts.force !== true, and (3) opts.onContinue
 *  is a function already uniquely identify the wizard's finish/skip
 *  AntcvShowAiNotice call: per v1.40.309 every intermediate step gate
 *  passes force:true, and only the finish/skip paths supply onContinue.
 *  Belt is enough; braces were breaking the trigger.
 *
 *  Side effect: the slide will now also fire on the Skip path (which
 *  also calls AntcvShowAiNotice with onContinue but without force).
 *  That's fine — Skip users can click "Use defaults" in our slide and
 *  proceed to AI Notice exactly like before; one extra click for a
 *  rare path, no break for the common path.
 *
 * v1.40.339-c additive features retained:
 *  - Canonical EN-primary + DA-additional defaults regardless of LS
 *  - Back button (clears wizardCompleted + session flag, no onContinue)
 *  - Defensive z-index 2147483647 + pointer-events:auto on backdrop/panel
 *  - Removed click-outside-to-save handler
 *
 * Storage
 * -------
 * Selections are written via window.AntcvStabilityCore.setEnabledLanguages
 * when available (writes to enabledLanguages, antcv:enabledLanguages,
 * antcv:visibleLanguages, antcv:prefs, personalInfo.stylePrefs.*). Falls
 * back to a direct multi-key write if the stability-core API isn't loaded.
 * ===========================================================================
 */
(function () {
  'use strict';

  var VERSION = '1.40.339-e';
  if (window.__antcvWizardLanguageSlide339 === VERSION) return;
  window.__antcvWizardLanguageSlide339 = VERSION;

  var SHOWN_FLAG_KEY = 'antcv:wizard-lang-slide-shown';
  var LANG_OPTIONS = [
    { code: 'en', label: 'English',  native: 'English' },
    { code: 'da', label: 'Danish',   native: 'Dansk' },
    { code: 'es', label: 'Spanish',  native: 'Espanol' },
    { code: 'zh', label: 'Chinese',  native: '\u4e2d\u6587' }
  ];
  var ALL_CODES = LANG_OPTIONS.map(function (o) { return o.code; });
  var DEFAULT_PRIMARY = 'en';
  var DEFAULT_ADDITIONAL = ['da'];

  // --- Persistence helpers -------------------------------------------------
  function readJSON(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }
  function writeLangsViaStabilityCore(arr) {
    try {
      if (window.AntcvStabilityCore &&
          typeof window.AntcvStabilityCore.setEnabledLanguages === 'function') {
        return window.AntcvStabilityCore.setEnabledLanguages(arr);
      }
    } catch (_) {}
    // Fallback - write directly to the common keys
    var raw = JSON.stringify(arr);
    try { localStorage.setItem('enabledLanguages', raw); } catch (_) {}
    try { localStorage.setItem('antcv:enabledLanguages', raw); } catch (_) {}
    try { localStorage.setItem('antcv:visibleLanguages', raw); } catch (_) {}
    try {
      var p = readJSON('antcv:prefs') || {};
      p.enabledLanguages = arr;
      p.visibleLanguages = arr;
      localStorage.setItem('antcv:prefs', JSON.stringify(p));
    } catch (_) {}
    try {
      var pi = readJSON('personalInfo') || {};
      pi.stylePrefs = pi.stylePrefs || {};
      pi.stylePrefs.visibleLanguages = arr;
      pi.stylePrefs.enabledLanguages = arr;
      pi.stylePrefs.languageBar = arr;
      localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:enabled-languages-changed',
        { detail: { enabledLanguages: arr, visibleLanguages: arr, scope: 'topbar-only' } }));
    } catch (_) {}
    try {
      if (window.AntcvLangBarFilter && window.AntcvLangBarFilter._applyAll) {
        window.AntcvLangBarFilter._applyAll();
      }
    } catch (_) {}
    return arr;
  }
  function writePrimaryLanguage(code) {
    if (!code) return;
    try { localStorage.setItem('language', code); } catch (_) {}
    try { localStorage.setItem('uiLang', code); } catch (_) {}
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: code }));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:language-changed', { detail: { language: code } }));
    } catch (_) {}
  }

  // v1.40.339-c: always return canonical defaults, ignore residual LS.
  function defaultLangs() {
    return [DEFAULT_PRIMARY].concat(DEFAULT_ADDITIONAL);
  }

  // --- One-shot guard ------------------------------------------------------
  function alreadyShown() {
    try { return sessionStorage.getItem(SHOWN_FLAG_KEY) === '1'; } catch (_) { return false; }
  }
  function markShown() {
    try { sessionStorage.setItem(SHOWN_FLAG_KEY, '1'); } catch (_) {}
  }
  function clearShown() {
    try { sessionStorage.removeItem(SHOWN_FLAG_KEY); } catch (_) {}
  }

  // --- Modal renderer ------------------------------------------------------
  function buildModal(onContinue, onSkip, onBack) {
    // v1.40.339-c: always canonical defaults. The wizard step shows a
    // predictable starting state (EN primary, DA additional, ZH unchecked)
    // regardless of what previous sessions or stale cloud data wrote.
    var defaults = defaultLangs();
    var primary = defaults[0];
    var additional = defaults.slice(1);

    var backdrop = document.createElement('div');
    backdrop.setAttribute('data-antcv-wizard-language-slide', '1');
    backdrop.style.cssText = [
      'position:fixed','inset:0',
      'background:rgba(8,17,38,0.78)','backdrop-filter:blur(2px)',
      'display:flex','align-items:center','justify-content:center',
      'padding:18px','font-family:Calibri,Arial,sans-serif'
    ].join(';');
    backdrop.style.setProperty('z-index', '2147483647', 'important');
    backdrop.style.setProperty('pointer-events', 'auto', 'important');

    var panel = document.createElement('div');
    panel.style.cssText = [
      'background:#1b2945','color:#fff','border-radius:14px',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5)','padding:22px 22px 18px',
      'max-width:480px','width:100%','max-height:88vh','overflow:auto',
      'border:1px solid rgba(1,183,187,0.4)','position:relative'
    ].join(';');
    panel.style.setProperty('pointer-events', 'auto', 'important');
    panel.style.setProperty('z-index', '2147483647', 'important');

    var heading = document.createElement('h2');
    heading.textContent = 'Set your languages';
    heading.style.cssText = 'margin:0 0 6px;font-size:18px;font-weight:800;color:#01B7BB;letter-spacing:.5px;';
    panel.appendChild(heading);

    var blurb = document.createElement('p');
    blurb.textContent = 'Pick your default language for the interface and any others you want available in the top bar. You can change this any time in Settings \u2192 Standard \u2192 Personal.';
    blurb.style.cssText = 'margin:0 0 16px;font-size:13px;line-height:1.5;color:rgba(255,255,255,0.78);';
    panel.appendChild(blurb);

    // --- Primary language (radio group) ----------------------------------
    var primaryLabel = document.createElement('div');
    primaryLabel.textContent = 'PRIMARY LANGUAGE';
    primaryLabel.style.cssText = 'font-size:10.5px;font-weight:800;letter-spacing:.3px;color:rgba(255,255,255,0.6);margin:4px 0 8px;';
    panel.appendChild(primaryLabel);

    var primaryRow = document.createElement('div');
    primaryRow.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:18px;';
    LANG_OPTIONS.forEach(function (opt) {
      var lab = document.createElement('label');
      lab.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(255,255,255,0.18);border-radius:8px;background:rgba(255,255,255,0.04);cursor:pointer;font-size:13px;';
      var rb = document.createElement('input');
      rb.type = 'radio';
      rb.name = 'antcv-wls-primary';
      rb.value = opt.code;
      rb.checked = opt.code === primary;
      rb.style.accentColor = '#01B7BB';
      var span = document.createElement('span');
      span.innerHTML = '<strong>' + opt.label + '</strong> <span style="opacity:.65;font-size:11px">' + opt.native + '</span>';
      lab.appendChild(rb);
      lab.appendChild(span);
      primaryRow.appendChild(lab);
    });
    panel.appendChild(primaryRow);

    // --- Additional languages (checkboxes) -------------------------------
    var addLabel = document.createElement('div');
    addLabel.textContent = 'ADDITIONAL LANGUAGES IN TOP BAR';
    addLabel.style.cssText = 'font-size:10.5px;font-weight:800;letter-spacing:.3px;color:rgba(255,255,255,0.6);margin:4px 0 8px;';
    panel.appendChild(addLabel);

    var addRow = document.createElement('div');
    addRow.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:14px;';
    LANG_OPTIONS.forEach(function (opt) {
      var lab = document.createElement('label');
      lab.dataset.langCode = opt.code;
      lab.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(255,255,255,0.18);border-radius:8px;background:rgba(255,255,255,0.04);cursor:pointer;font-size:13px;';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = opt.code;
      cb.checked = additional.indexOf(opt.code) >= 0;
      cb.style.accentColor = '#01B7BB';
      var span = document.createElement('span');
      span.innerHTML = '<strong>' + opt.label + '</strong> <span style="opacity:.65;font-size:11px">' + opt.native + '</span>';
      lab.appendChild(cb);
      lab.appendChild(span);
      if (opt.code === primary) lab.style.display = 'none';
      addRow.appendChild(lab);
    });
    panel.appendChild(addRow);

    primaryRow.addEventListener('change', function () {
      var sel = primaryRow.querySelector('input[type="radio"]:checked');
      var p = sel ? sel.value : DEFAULT_PRIMARY;
      Array.prototype.slice.call(addRow.querySelectorAll('label[data-lang-code]')).forEach(function (lab) {
        lab.style.display = (lab.dataset.langCode === p) ? 'none' : 'flex';
        var cb = lab.querySelector('input[type="checkbox"]');
        if (cb && lab.dataset.langCode === p) cb.checked = false;
      });
    });

    var hint = document.createElement('div');
    hint.style.cssText = 'margin:4px 0 18px;padding:10px 12px;background:rgba(1,183,187,0.08);border:1px solid rgba(1,183,187,0.35);border-radius:8px;font-size:11.5px;line-height:1.55;color:rgba(255,255,255,0.85);';
    hint.innerHTML = 'Looking for more control? <strong>Settings \u2192 Advanced</strong> contains <em>advanced writing tone</em> and <em>advanced layout styles</em> \u2014 fine-tune your CV voice and visual style there whenever you like.';
    panel.appendChild(hint);

    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:6px;';

    var backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.textContent = '\u2190 Back';
    backBtn.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.85);padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;';
    backBtn.style.setProperty('pointer-events', 'auto', 'important');
    backBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      try { console.info('[wizard-language-slide-339] back clicked'); } catch (_) {}
      try { localStorage.removeItem('wizardCompleted'); } catch (_) {}
      try { localStorage.removeItem('antcv:wizardCompleted'); } catch (_) {}
      clearShown();
      try { backdrop.remove(); } catch (_) {}
      try { onBack && onBack(); } catch (_) {}
    });
    btnRow.appendChild(backBtn);

    var rightGroup = document.createElement('div');
    rightGroup.style.cssText = 'display:flex;gap:8px;align-items:center;';

    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.textContent = 'Use defaults';
    skipBtn.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.85);padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;';
    skipBtn.style.setProperty('pointer-events', 'auto', 'important');
    skipBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      try { console.info('[wizard-language-slide-339] use-defaults clicked'); } catch (_) {}
      try { writeLangsViaStabilityCore([DEFAULT_PRIMARY].concat(DEFAULT_ADDITIONAL)); } catch (_) {}
      try { writePrimaryLanguage(DEFAULT_PRIMARY); } catch (_) {}
      markShown();
      try { backdrop.remove(); } catch (_) {}
      try { onSkip && onSkip(); } catch (_) {}
    });
    rightGroup.appendChild(skipBtn);

    var contBtn = document.createElement('button');
    contBtn.type = 'button';
    contBtn.textContent = 'Save and continue \u2192';
    contBtn.style.cssText = 'background:#01B7BB;border:0;color:#06243a;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:800;';
    contBtn.style.setProperty('pointer-events', 'auto', 'important');
    contBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      try { console.info('[wizard-language-slide-339] save-and-continue clicked'); } catch (_) {}
      var sel = primaryRow.querySelector('input[type="radio"]:checked');
      var p = sel ? sel.value : DEFAULT_PRIMARY;
      var others = Array.prototype.slice
        .call(addRow.querySelectorAll('input[type="checkbox"]:checked'))
        .map(function (cb) { return cb.value; })
        .filter(function (c) { return c !== p; });
      var seen = {};
      var finalList = [p].concat(others).filter(function (c) {
        if (seen[c]) return false;
        seen[c] = true;
        return ALL_CODES.indexOf(c) >= 0;
      });
      if (finalList.length === 0) finalList = [DEFAULT_PRIMARY];
      try { writeLangsViaStabilityCore(finalList); } catch (_) {}
      try { writePrimaryLanguage(p); } catch (_) {}
      try { console.info('[wizard-language-slide-339] saved primary=' + p + ' additional=' + others.join(',')); } catch (_) {}
      markShown();
      try { backdrop.remove(); } catch (_) {}
      try { onContinue && onContinue(); } catch (_) {}
    });
    rightGroup.appendChild(contBtn);

    btnRow.appendChild(rightGroup);
    panel.appendChild(btnRow);

    backdrop.appendChild(panel);
    return backdrop;
  }

  function showSlide(onContinue, onSkip, onBack) {
    try {
      var node = buildModal(onContinue, onSkip, onBack);
      (document.body || document.documentElement).appendChild(node);
      setTimeout(function () {
        var first = node.querySelector('input[type="radio"]:checked');
        if (first) try { first.focus(); } catch (_) {}
      }, 50);
    } catch (e) {
      try { console.warn('[wizard-language-slide-339] buildModal failed:', e && e.message); } catch (_) {}
      try { onContinue && onContinue(); } catch (_) {}
    }
  }

  // --- Detection helpers (kept for debug API; no longer used in trigger) ---
  function wizardCompletedFlag() {
    try {
      var raw = localStorage.getItem('wizardCompleted');
      if (raw == null) return false;
      if (raw === 'false' || raw === '"false"' || raw === '0' || raw === 'null' || raw === '') return false;
      return true;
    } catch (_) { return false; }
  }

  function looksLikeWizard() {
    try {
      var sel = document.querySelector(
        '[data-antcv-wizard], [data-antcv-setup], [data-antcv-wizard-slide], ' +
        '[role="dialog"][aria-label*="wizard" i]'
      );
      if (sel) return true;
    } catch (_) {}
    try {
      var bodyText = String((document.body && document.body.innerText) || '').slice(0, 4000);
      if (/Welcome to AntCV|Paste your Worker URL|Add LLM API keys|Test the connection|Upload (?:a )?CV|How should AntCV write|Set your languages/i.test(bodyText)) {
        return true;
      }
    } catch (_) {}
    return false;
  }

  // --- Wrap AntcvShowAiNotice ----------------------------------------------
  // v339-e trigger conditions (ALL must hold):
  //   1. Haven't shown the slide this session.
  //   2. opts.force is NOT true (intermediate step gates pass force:true
  //      per v1.40.309 — byok/demo choice, step 2->3 transition, etc.).
  //   3. opts.onContinue is a function (only the finish/skip paths pass it;
  //      intermediate gates do not).
  //   4. The wizard UI is visible (defensive double-check; falls back to
  //      body-text search for wizard step headers).
  //
  // Dropped vs v339-c: the wizardCompleted localStorage check, because
  // u.set is asynchronous — LS doesn't yet reflect the flag when our
  // synchronous wrapper runs.
  function installWrapper() {
    var orig = window.AntcvShowAiNotice;
    if (!orig || typeof orig !== 'function') {
      setTimeout(installWrapper, 200);
      return;
    }
    if (orig.__antcvWlsWrapped) return;
    var wrapped = function (opts) {
      if (alreadyShown()) {
        try { console.debug('[wizard-language-slide-339] pass-through: already shown this session'); } catch (_) {}
        return orig.apply(this, arguments);
      }
      if (opts && opts.force === true) {
        try { console.debug('[wizard-language-slide-339] pass-through: force:true (intermediate step gate)'); } catch (_) {}
        return orig.apply(this, arguments);
      }
      if (!opts || typeof opts.onContinue !== 'function') {
        try { console.debug('[wizard-language-slide-339] pass-through: no onContinue function'); } catch (_) {}
        return orig.apply(this, arguments);
      }
      if (!looksLikeWizard()) {
        try { console.debug('[wizard-language-slide-339] pass-through: wizard UI not visible'); } catch (_) {}
        return orig.apply(this, arguments);
      }

      try { console.info('[wizard-language-slide-339] intercepting wizard-finish AntcvShowAiNotice (v=' + VERSION + ')'); } catch (_) {}

      var origArgs = arguments;
      var ctx = this;
      showSlide(
        function continueFn() {
          try { orig.apply(ctx, origArgs); } catch (_) {}
        },
        function skipFn() {
          try { orig.apply(ctx, origArgs); } catch (_) {}
        },
        function backFn() {
          // No-op: user is left on the wizard's last setup step.
        }
      );
    };
    wrapped.__antcvWlsWrapped = VERSION;
    try { window.AntcvShowAiNotice = wrapped; } catch (_) {}
    try { console.info('[wizard-language-slide-339] wrapped AntcvShowAiNotice (v=' + VERSION + '); trigger drops wizardCompleted LS check'); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWrapper);
  } else {
    setTimeout(installWrapper, 0);
  }

  window.AntcvWizardLanguageSlide339 = {
    version: VERSION,
    _show: showSlide,
    _resetSession: clearShown,
    _wizardCompletedFlag: wizardCompletedFlag,
    _looksLikeWizard: looksLikeWizard
  };
})();
