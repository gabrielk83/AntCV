/* AntCV wizard language slide (v1.40.339)
 * ===========================================================================
 * Adds a "Set your languages" step to the wizard, shown right before the
 * AI-Notice modal that gates wizard completion.
 *
 * How
 * ---
 * The wizard's finish/skip paths both call window.AntcvShowAiNotice({
 *   onContinue: _antcvCloseWiz
 * }). We wrap that global. The first time it fires per wizard session, we
 * show our own modal instead. When the user clicks Continue in our modal,
 * we save their language selection and call the original AntcvShowAiNotice
 * with the same arguments. After AI-Notice continues, the wizard closes
 * normally.
 *
 * Storage
 * -------
 * Selections are written via window.AntcvStabilityCore.setEnabledLanguages
 * when available (writes to enabledLanguages, antcv:enabledLanguages,
 * antcv:visibleLanguages, antcv:prefs, personalInfo.stylePrefs.*). Falls
 * back to a direct multi-key write if the stability-core API isn't loaded.
 *
 * One-shot
 * --------
 * The slide is shown at most ONCE per wizard pass. After it fires, a flag
 * is set in sessionStorage so re-entries (e.g. Settings -> Re-open wizard
 * inside the same tab) don't repeat it. The flag clears on full reload.
 * ===========================================================================
 */
(function () {
  'use strict';

  var VERSION = '1.40.339';
  if (window.__antcvWizardLanguageSlide339 === VERSION) return;
  window.__antcvWizardLanguageSlide339 = VERSION;

  var SHOWN_FLAG_KEY = 'antcv:wizard-lang-slide-shown';
  var LANG_OPTIONS = [
    { code: 'en', label: 'English',  native: 'English' },
    { code: 'da', label: 'Danish',   native: 'Dansk' },
    { code: 'es', label: 'Spanish',  native: 'Espanol' },
    { code: 'zh', label: 'Chinese',  native: '中文' }
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
  function readCurrentLangs() {
    var src = readJSON('enabledLanguages') ||
              readJSON('antcv:enabledLanguages') ||
              readJSON('antcv:visibleLanguages');
    if (Array.isArray(src) && src.length) {
      return src.map(function (x) { return String(x || '').toLowerCase(); })
                .filter(function (x) { return ALL_CODES.indexOf(x) >= 0; });
    }
    return [DEFAULT_PRIMARY].concat(DEFAULT_ADDITIONAL);
  }

  // --- One-shot guard ------------------------------------------------------
  function alreadyShown() {
    try { return sessionStorage.getItem(SHOWN_FLAG_KEY) === '1'; } catch (_) { return false; }
  }
  function markShown() {
    try { sessionStorage.setItem(SHOWN_FLAG_KEY, '1'); } catch (_) {}
  }

  // --- Modal renderer ------------------------------------------------------
  function buildModal(onContinue, onSkip) {
    var current = readCurrentLangs();
    var primary = current[0] || DEFAULT_PRIMARY;
    var additional = current.slice(1);

    var backdrop = document.createElement('div');
    backdrop.setAttribute('data-antcv-wizard-language-slide', '1');
    backdrop.style.cssText = [
      'position:fixed','inset:0','z-index:2147483600',
      'background:rgba(8,17,38,0.78)','backdrop-filter:blur(2px)',
      'display:flex','align-items:center','justify-content:center',
      'padding:18px','font-family:Calibri,Arial,sans-serif'
    ].join(';');

    var panel = document.createElement('div');
    panel.style.cssText = [
      'background:#1b2945','color:#fff','border-radius:14px',
      'box-shadow:0 20px 60px rgba(0,0,0,0.5)','padding:22px 22px 18px',
      'max-width:480px','width:100%','max-height:88vh','overflow:auto',
      'border:1px solid rgba(1,183,187,0.4)'
    ].join(';');

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
      // Hide the additional-row entry that matches the primary
      if (opt.code === primary) lab.style.display = 'none';
      addRow.appendChild(lab);
    });
    panel.appendChild(addRow);

    // When the primary radio changes, hide that code in the "additional" row
    primaryRow.addEventListener('change', function () {
      var sel = primaryRow.querySelector('input[type="radio"]:checked');
      var p = sel ? sel.value : DEFAULT_PRIMARY;
      Array.prototype.slice.call(addRow.querySelectorAll('label[data-lang-code]')).forEach(function (lab) {
        lab.style.display = (lab.dataset.langCode === p) ? 'none' : 'flex';
        var cb = lab.querySelector('input[type="checkbox"]');
        if (cb && lab.dataset.langCode === p) cb.checked = false;
      });
    });

    // --- Informational hint about Settings -> Advanced -------------------
    var hint = document.createElement('div');
    hint.style.cssText = 'margin:4px 0 18px;padding:10px 12px;background:rgba(1,183,187,0.08);border:1px solid rgba(1,183,187,0.35);border-radius:8px;font-size:11.5px;line-height:1.55;color:rgba(255,255,255,0.85);';
    hint.innerHTML = 'Looking for more control? <strong>Settings \u2192 Advanced</strong> contains <em>advanced writing tone</em> and <em>advanced layout styles</em> \u2014 fine-tune your CV voice and visual style there whenever you like.';
    panel.appendChild(hint);

    // --- Buttons ---------------------------------------------------------
    var btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:6px;';

    var skipBtn = document.createElement('button');
    skipBtn.type = 'button';
    skipBtn.textContent = 'Use defaults';
    skipBtn.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,0.25);color:rgba(255,255,255,0.85);padding:9px 14px;border-radius:8px;cursor:pointer;font-size:12.5px;font-weight:700;';
    skipBtn.addEventListener('click', function () {
      try { writeLangsViaStabilityCore([DEFAULT_PRIMARY].concat(DEFAULT_ADDITIONAL)); } catch (_) {}
      try { writePrimaryLanguage(DEFAULT_PRIMARY); } catch (_) {}
      try { backdrop.remove(); } catch (_) {}
      try { onSkip && onSkip(); } catch (_) {}
    });
    btnRow.appendChild(skipBtn);

    var contBtn = document.createElement('button');
    contBtn.type = 'button';
    contBtn.textContent = 'Save and continue \u2192';
    contBtn.style.cssText = 'background:#01B7BB;border:0;color:#06243a;padding:10px 16px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:800;';
    contBtn.addEventListener('click', function () {
      var sel = primaryRow.querySelector('input[type="radio"]:checked');
      var p = sel ? sel.value : DEFAULT_PRIMARY;
      var others = Array.prototype.slice
        .call(addRow.querySelectorAll('input[type="checkbox"]:checked'))
        .map(function (cb) { return cb.value; })
        .filter(function (c) { return c !== p; });
      // Final list: primary first, then unique additionals.
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
      try { backdrop.remove(); } catch (_) {}
      try { onContinue && onContinue(); } catch (_) {}
    });
    btnRow.appendChild(contBtn);
    panel.appendChild(btnRow);

    backdrop.appendChild(panel);

    // Click outside the panel = treat as Continue with current selection
    backdrop.addEventListener('click', function (ev) {
      if (ev.target === backdrop) {
        try { contBtn.click(); } catch (_) {}
      }
    });

    return backdrop;
  }

  function showSlide(onContinue, onSkip) {
    try {
      var node = buildModal(onContinue, onSkip);
      (document.body || document.documentElement).appendChild(node);
      // Move keyboard focus into the panel for accessibility
      setTimeout(function () {
        var first = node.querySelector('input[type="radio"]:checked');
        if (first) try { first.focus(); } catch (_) {}
      }, 50);
    } catch (e) {
      try { console.warn('[wizard-language-slide-339] buildModal failed:', e && e.message); } catch (_) {}
      // Fail open - call onContinue so wizard isn't stuck
      try { onContinue && onContinue(); } catch (_) {}
    }
  }

  // --- Wrap AntcvShowAiNotice ----------------------------------------------
  // The wizard's finish + skip paths both call:
  //   window.AntcvShowAiNotice({ onContinue: _antcvCloseWiz })
  // We intercept the FIRST such call after the wizard is open. On Continue
  // in our language modal, we forward to the original AntcvShowAiNotice
  // with the same args. If the language slide has already been shown this
  // session, we pass through immediately.
  function installWrapper() {
    var orig = window.AntcvShowAiNotice;
    if (!orig || typeof orig !== 'function') {
      // Not loaded yet - retry shortly
      setTimeout(installWrapper, 200);
      return;
    }
    if (orig.__antcvWlsWrapped) return;
    var wrapped = function (opts) {
      // Pass through if we've already shown the slide this session.
      if (alreadyShown()) return orig.apply(this, arguments);
      // Skip the slide for AI notices triggered by non-wizard flows.
      // The wizard sets opts.onContinue = _antcvCloseWiz which is an
      // arrow function. Other callers (e.g. Settings -> Advanced -> mode
      // change) also call AntcvShowAiNotice, so we limit our slide to
      // calls where the wizard is actually open.
      var wizardOpen = false;
      try {
        wizardOpen = !!document.querySelector(
          '[data-antcv-wizard], [data-antcv-setup], [data-antcv-wizard-slide], ' +
          '[role="dialog"][aria-label*="wizard" i]'
        );
      } catch (_) {}
      // Fallback signal: when the bundle's wizard step state (hn) is on,
      // the page typically contains the "Welcome to AntCV" heading or
      // any of the wizard step headers. Search visible text quickly.
      if (!wizardOpen) {
        try {
          var bodyText = String((document.body && document.body.innerText) || '').slice(0, 4000);
          if (/Welcome to AntCV|Paste your Worker URL|Add LLM API keys|Test the connection|Upload (?:a )?CV/i.test(bodyText)) {
            wizardOpen = true;
          }
        } catch (_) {}
      }
      if (!wizardOpen) return orig.apply(this, arguments);

      markShown();
      var origArgs = arguments;
      var ctx = this;
      showSlide(
        function continueFn() { try { orig.apply(ctx, origArgs); } catch (_) {} },
        function skipFn()     { try { orig.apply(ctx, origArgs); } catch (_) {} }
      );
    };
    wrapped.__antcvWlsWrapped = VERSION;
    try { window.AntcvShowAiNotice = wrapped; } catch (_) {}
    try { console.info('[wizard-language-slide-339] wrapped AntcvShowAiNotice'); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installWrapper);
  } else {
    setTimeout(installWrapper, 0);
  }

  // Debug API
  window.AntcvWizardLanguageSlide339 = {
    version: VERSION,
    _show: showSlide,
    _resetSession: function () {
      try { sessionStorage.removeItem(SHOWN_FLAG_KEY); } catch (_) {}
    },
    _readCurrent: readCurrentLangs
  };
})();
