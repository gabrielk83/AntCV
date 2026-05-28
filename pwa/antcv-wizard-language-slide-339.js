/* AntCV wizard language slide + section-format showcase (v1.40.339-j)
 * ===========================================================================
 * Extends v339-e: the final wizard slide now shows users the seven section
 * format options as a preview alongside the language picker, so they leave
 * the wizard knowing what they can customise per section once they reach
 * the editor.
 *
 * Why this lives here
 * -------------------
 * The Step 10 content used to live in the merged antcv-onboarding.js
 * (v1.40.266) as a fixed overlay that fired after the wizard closed. That
 * sidecar was never wired into index.html and is being deleted in the same
 * commit. The section-format showcase that the user does want to see is
 * extracted and folded into THIS slide, which is already the last user-
 * facing step before AntcvShowAiNotice gates wizard close. One step, one
 * place, no second overlay stack.
 *
 * v339-j changes vs v339-e
 * ------------------------
 *   + FORMATS constant with seven {name, preview} entries (Paragraph,
 *     Bullets, Emoji bullets, Hybrid 1/2/3, Table). Each preview is a
 *     short HTML fragment that visually demonstrates that format.
 *   + Showcase block inserted between the additional-languages row and
 *     the existing hint paragraph.
 *   + Hint text updated to acknowledge the showcase ('above is just a
 *     preview — pick per section in the editor').
 *   + Section-format tiles are read-only — the wizard slide does NOT let
 *     the user choose a default format here. Per-section choice happens
 *     in the editor.
 *
 * Everything else (trigger conditions, persistence helpers, back / skip /
 * continue handling, debug API) is identical to v339-e.
 *
 * Storage
 * -------
 * Same as v339-e — selections written via window.AntcvStabilityCore.
 * setEnabledLanguages when available, falling back to direct multi-key
 * writes. No new keys.
 * ===========================================================================
 */
(function () {
  'use strict';

  var VERSION = '1.50.38-react-showcase';
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

  // v339-j: section-format previews extracted from the retired
  // antcv-onboarding.js Step 10 panel. Each preview is intentionally tiny
  // (~46-60px tall) so all seven fit in a compact 3-column grid on
  // desktop / 2-column on mobile without ballooning the slide height.
  var FORMATS = [
    {
      name: 'Paragraph',
      preview:
        '<div style="font-size:8.5px;line-height:1.55;color:rgba(255,255,255,0.78);">' +
          'Brief context line explaining the role\u2019s scope, then a continuation that flows naturally.' +
        '</div>'
    },
    {
      name: 'Bullets',
      preview:
        '<div style="font-size:9px;line-height:1.55;color:rgba(255,255,255,0.78);">' +
          '\u2022 Outcome one<br>\u2022 Outcome two<br>\u2022 Outcome three' +
        '</div>'
    },
    {
      name: 'Emoji bullets',
      preview:
        '<div style="font-size:9px;line-height:1.55;color:rgba(255,255,255,0.78);">' +
          '\u2728 Outcome one<br>\u2705 Outcome two<br>\uD83D\uDCCC Outcome three' +
        '</div>'
    },
    {
      name: 'Hybrid 1',
      preview:
        '<div style="font-size:9px;line-height:1.45;color:rgba(255,255,255,0.78);">' +
          '<strong style="color:#01B7BB">Senior role</strong><br>\u2022 outcome<br>\u2022 outcome' +
        '</div>'
    },
    {
      name: 'Hybrid 2',
      preview:
        '<div style="font-size:8.5px;line-height:1.5;color:rgba(255,255,255,0.78);">' +
          'Brief intro line.<br>\u2022 outcome<br>\u2022 outcome' +
        '</div>'
    },
    {
      name: 'Hybrid 3',
      preview:
        '<div style="font-size:8.5px;line-height:1.55;color:rgba(255,255,255,0.78);">' +
          'Brief intro. <em style="color:#01B7BB;font-style:normal">item</em>, ' +
          '<em style="color:#01B7BB;font-style:normal">item</em>, ' +
          '<em style="color:#01B7BB;font-style:normal">item</em>' +
        '</div>'
    },
    {
      name: 'Table',
      preview:
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;font-size:8.5px;color:rgba(255,255,255,0.78);">' +
          '<div style="background:rgba(1,183,187,0.22);padding:3px 4px;border-radius:2px;">Role</div>' +
          '<div style="background:rgba(255,255,255,0.07);padding:3px 4px;border-radius:2px;">Year</div>' +
          '<div style="background:rgba(255,255,255,0.07);padding:3px 4px;border-radius:2px;">Org</div>' +
          '<div style="background:rgba(1,183,187,0.22);padding:3px 4px;border-radius:2px;">Loc</div>' +
        '</div>'
    }
  ];

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
      'max-width:520px','width:100%','max-height:88vh','overflow:auto',
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
    addRow.style.cssText = 'display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:18px;';
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

    // --- v339-j: section-format showcase ---------------------------------
    // Extracted from the retired antcv-onboarding.js Step 10 panel. Read-
    // only preview — the actual per-section choice happens in the editor.
    var fmtLabel = document.createElement('div');
    fmtLabel.textContent = 'HOW EACH SECTION CAN LOOK';
    fmtLabel.style.cssText = 'font-size:10.5px;font-weight:800;letter-spacing:.3px;color:rgba(255,255,255,0.6);margin:4px 0 6px;';
    panel.appendChild(fmtLabel);

    var fmtIntro = document.createElement('p');
    fmtIntro.textContent = 'Each CV and cover-letter section can be rendered in one of seven formats. You pick per section in the editor \u2014 these are just previews so you know what\u2019s available.';
    fmtIntro.style.cssText = 'margin:0 0 10px;font-size:11.5px;line-height:1.5;color:rgba(255,255,255,0.7);';
    panel.appendChild(fmtIntro);

    // v1.50.38 — section-format showcase is now a React island
    // (src/islands/WizardSectionShowcase/). Phase A of the wizard
    // step 10 port (see docs/plan/v1.50.37-wizard-step-10-scoping.md).
    // We append an anchor div and dispatch a mount event so the
    // React bundle attaches its root immediately rather than waiting
    // for a MutationObserver tick. The legacy FORMATS constant
    // declared at the top of this file is now dead-code — kept in
    // place for one release cycle so any analytics / a-b tests that
    // pin the version can still introspect it (window.
    // AntcvWizardLanguageSlide._formats below). Will be deleted in
    // Phase B (v1.50.39).
    var fmtAnchor = document.createElement('div');
    fmtAnchor.setAttribute('data-antcv-wizard-section-showcase', '1');
    fmtAnchor.style.cssText = 'min-height:60px;margin-bottom:16px;';
    panel.appendChild(fmtAnchor);
    try {
      window.dispatchEvent(new CustomEvent('antcv:mount-wizard-showcase'));
    } catch (_) {}
    // Defence in depth: if the React bundle hasn't booted yet when
    // we open the modal, mountAll runs on DOMContentLoaded, then our
    // mount.ts's MutationObserver / event listener picks the anchor
    // up. Either path lands us at the same outcome.
    try {
      if (window.AntcvReactIslands && typeof window.AntcvReactIslands.mountAll === 'function') {
        window.AntcvReactIslands.mountAll();
      }
    } catch (_) {}

    var hint = document.createElement('div');
    hint.style.cssText = 'margin:4px 0 18px;padding:10px 12px;background:rgba(1,183,187,0.08);border:1px solid rgba(1,183,187,0.35);border-radius:8px;font-size:11.5px;line-height:1.55;color:rgba(255,255,255,0.85);';
    hint.innerHTML = 'Above is just a preview \u2014 you choose the format per section in the editor. For deeper voice and visual-style control, see <strong>Settings \u2192 Advanced</strong> after the wizard closes.';
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
  // Same v339-e trigger logic; comment retained for context.
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
    try { console.info('[wizard-language-slide-339] wrapped AntcvShowAiNotice (v=' + VERSION + '); section-format showcase embedded in slide'); } catch (_) {}
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
    _looksLikeWizard: looksLikeWizard,
    _formats: FORMATS
  };
})();
