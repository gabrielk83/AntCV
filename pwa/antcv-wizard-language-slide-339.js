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

  var VERSION = '1.50.431-handoff';
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
    // WIZARD-LANG-SELECTOR-001: app.js reads 'language' through its JSON
    // wrapper (u.get) — a RAW code fails JSON.parse and silently falls
    // back to 'en', so a non-English default never stuck. Store it
    // JSON-stringified like every other u-managed key.
    try { localStorage.setItem('language', JSON.stringify(code)); } catch (_) {}
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

    // --- v1.50.39 Phase B: language picker is now a React island ---------
    // See src/islands/WizardLanguagePicker/. The legacy DOM-building
    // for the primary radio + additional checkboxes is replaced by a
    // single anchor div and a mount dispatch. The legacy LANG_OPTIONS,
    // DEFAULT_PRIMARY, DEFAULT_ADDITIONAL constants at the top of this
    // file are now dead code — kept for one release cycle so any
    // analytics that pin this version can still introspect them via
    // window.AntcvWizardLanguageSlide._formats and friends.
    //
    // Continue handler reads the user's picks via
    // window.AntcvWizardLanguagePicker.getState() instead of walking
    // the DOM. State publish is owned by the React component itself.
    // --- v1.50.284: SELF-CONTAINED language picker --------------------------
    // The React island (WizardLanguagePicker) never rendered any options, so
    // the step showed an empty picker ("no languages options to select").
    // Owner spec: select languages from the table of available languages;
    // ticked ones are included; the FIRST in order is the DEFAULT (shown
    // clearly); the order is changeable (reorder up/down). Built directly in
    // the DOM here so it does not depend on the island booting.
    var selected = defaults.slice();           // ordered; selected[0] = default
    if (!selected.length) selected = [DEFAULT_PRIMARY];

    // WIZARD-LANG-SELECTOR-001 (owner spec 2026-06-07, built 2026-06-13):
    // TWO tables side by side — LEFT = all available languages, RIGHT =
    // the selected subset, reorderable; the FIRST entry on the right is
    // the DEFAULT language.
    var listEl = document.createElement('div');
    listEl.setAttribute('data-antcv-wizard-language-picker', '1');
    listEl.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 4px;';
    panel.appendChild(listEl);

    function optByCode(code) {
      for (var i = 0; i < LANG_OPTIONS.length; i++) {
        if (LANG_OPTIONS[i].code === code) return LANG_OPTIONS[i];
      }
      return { code: code, label: code, native: code };
    }
    function moveSel(idx, delta) {
      var j = idx + delta;
      if (j < 0 || j >= selected.length) return;
      var t = selected[idx]; selected[idx] = selected[j]; selected[j] = t;
      renderPicker();
    }
    function toggleSel(code) {
      var i = selected.indexOf(code);
      if (i >= 0) { if (selected.length > 1) selected.splice(i, 1); } // keep >=1
      else selected.push(code);
      renderPicker();
    }
    function mkRow(isSel) {
      var row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:9px 11px;margin-bottom:7px;border-radius:9px;border:2px solid ' +
        (isSel ? 'rgba(1,183,187,0.55)' : 'rgba(255,255,255,0.12)') +
        ';background:' + (isSel ? 'rgba(1,183,187,0.12)' : 'rgba(255,255,255,0.04)') + ';';
      return row;
    }
    function colBox(title) {
      var wrap = document.createElement('div');
      wrap.style.cssText = 'border:1px solid rgba(255,255,255,0.14);border-radius:10px;padding:8px;background:rgba(255,255,255,0.03);min-height:120px;';
      var h = document.createElement('div');
      h.textContent = title;
      h.style.cssText = 'font-size:10px;font-weight:800;letter-spacing:.35px;color:rgba(255,255,255,0.6);margin:0 0 7px;';
      wrap.appendChild(h);
      return wrap;
    }
    function smallBtn(txt, title, fn, disabled) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = txt; b.title = title || ''; b.disabled = !!disabled;
      b.style.cssText = 'background:transparent;border:1px solid rgba(255,255,255,0.25);color:#fff;border-radius:6px;width:26px;height:26px;cursor:pointer;font-size:12px;' + (disabled ? 'opacity:.3;cursor:default;' : '');
      b.style.setProperty('pointer-events', 'auto', 'important');
      b.addEventListener('click', function (ev) { ev.stopPropagation(); if (!disabled) fn(); });
      return b;
    }
    function renderPicker() {
      listEl.innerHTML = '';
      // LEFT — all available (not yet selected)
      var left = colBox('AVAILABLE LANGUAGES');
      var any = false;
      LANG_OPTIONS.forEach(function (o) {
        if (selected.indexOf(o.code) >= 0) return;
        any = true;
        var row = mkRow(false);
        row.style.cursor = 'pointer';
        row.title = 'Add to your selected languages';
        row.addEventListener('click', function () { toggleSel(o.code); });
        var lab = document.createElement('div');
        lab.style.cssText = 'flex:1;font-size:12.5px;color:rgba(255,255,255,0.85);';
        lab.innerHTML = '<strong>' + o.label + '</strong> <span style="color:rgba(255,255,255,0.45);font-size:11px;">' + o.native + '</span>';
        row.appendChild(lab);
        row.appendChild(smallBtn('→', 'Add', function () { toggleSel(o.code); }));
        left.appendChild(row);
      });
      if (!any) {
        var none = document.createElement('div');
        none.textContent = 'All languages selected.';
        none.style.cssText = 'font-size:11px;color:rgba(255,255,255,0.4);padding:6px 2px;';
        left.appendChild(none);
      }
      listEl.appendChild(left);
      // RIGHT — selected, ordered; first = DEFAULT
      var right = colBox('SELECTED — first is the DEFAULT');
      selected.forEach(function (code, idx) {
        var o = optByCode(code);
        var row = mkRow(true);
        var lab = document.createElement('div');
        lab.style.cssText = 'flex:1;font-size:12.5px;color:#fff;min-width:0;';
        lab.innerHTML = '<strong>' + o.label + '</strong>' + (idx === 0
          ? ' <span style="font-size:9px;font-weight:800;letter-spacing:.4px;color:#06243a;background:#01B7BB;padding:2px 6px;border-radius:5px;white-space:nowrap;vertical-align:middle;">★ DEFAULT</span>'
          : '');
        row.appendChild(lab);
        row.appendChild(smallBtn('↑', 'Move up (first = default)', function () { moveSel(idx, -1); }, idx === 0));
        row.appendChild(smallBtn('↓', 'Move down', function () { moveSel(idx, 1); }, idx === selected.length - 1));
        row.appendChild(smallBtn('←', 'Remove (back to available)', function () { toggleSel(code); }, selected.length <= 1));
        right.appendChild(row);
      });
      listEl.appendChild(right);
    }
    renderPicker();

    var orderHint = document.createElement('div');
    orderHint.innerHTML = 'Move languages right to include them; reorder the right table with ↑ ↓ — the FIRST one (★ DEFAULT) drives generation and the interface.';
    orderHint.style.cssText = 'font-size:11px;line-height:1.5;color:rgba(255,255,255,0.6);margin:2px 0 16px;';
    panel.appendChild(orderHint);

    // Exposed so the Save handler reads the ordered selection (and for debug).
    var getSelectedLangs = function () { return selected.slice(); };

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

    // WIZARD-002 (owner queue 2026-06-13): the "settings hand-off" \u2014 this is the
    // final wizard slide, so before it closes, point the user at the three
    // places they will customise everything else. Replaces the single generic
    // "see Settings -> Advanced" hint with a structured map.
    var handoff = document.createElement('div');
    handoff.setAttribute('data-antcv-wizard-handoff', '1');
    handoff.style.cssText = 'margin:4px 0 18px;padding:12px 14px;background:rgba(1,183,187,0.08);border:1px solid rgba(1,183,187,0.35);border-radius:8px;';
    var hTitle = document.createElement('div');
    hTitle.textContent = 'WHERE TO CUSTOMISE NEXT';
    hTitle.style.cssText = 'font-size:10.5px;font-weight:800;letter-spacing:.3px;color:#01B7BB;margin:0 0 8px;';
    handoff.appendChild(hTitle);
    var HANDOFF_ROWS = [
      ['Settings \u2192 Standard \u2192 Personal', 'Languages in the top bar, experience tense, and your banned-words list.'],
      ['Settings \u2192 Standard \u2192 Layout', 'Profile-photo position & shape, and the visual style package.'],
      ['Settings \u2192 Advanced', 'Writing tone, and page flow \u2014 continuation headings, the repeat header on page 2+, and page numbers.']
    ];
    HANDOFF_ROWS.forEach(function (r) {
      var row = document.createElement('div');
      row.setAttribute('data-antcv-handoff-row', '1');
      row.style.cssText = 'margin:0 0 7px;font-size:11.5px;line-height:1.5;color:rgba(255,255,255,0.85);';
      row.innerHTML = '<strong style="color:#fff">' + r[0] + '</strong> \u2014 ' + r[1];
      handoff.appendChild(row);
    });
    var hNote = document.createElement('div');
    hNote.innerHTML = 'You also choose each section\u2019s format (paragraph, bullets, table\u2026) per section in the editor.';
    hNote.style.cssText = 'margin:8px 0 0;font-size:11px;line-height:1.5;color:rgba(255,255,255,0.6);';
    handoff.appendChild(hNote);
    panel.appendChild(handoff);

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
      // v1.50.284: read the ordered selection from the self-contained DOM
      // picker above. selected[0] is the default/primary; the rest are the
      // additional top-bar languages, in the user's chosen order.
      var ordered = (typeof getSelectedLangs === 'function' ? getSelectedLangs() : null) || [];
      var seen = {};
      var finalList = ordered.filter(function (c) {
        if (seen[c]) return false;
        seen[c] = true;
        return ALL_CODES.indexOf(c) >= 0;
      });
      if (finalList.length === 0) finalList = [DEFAULT_PRIMARY];
      var p = finalList[0];
      try { writeLangsViaStabilityCore(finalList); } catch (_) {}
      try { writePrimaryLanguage(p); } catch (_) {}
      try { console.info('[wizard-language-slide-339] saved order=' + finalList.join(',') + ' (default=' + p + ')'); } catch (_) {}
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
      // 1.50.186: the language slide is the FINAL step of a COMPLETED wizard.
      // When the user SKIPS the wizard, app.js passes skipLanguageSlide:true so
      // we pass straight through to the AI notice (shown only if not yet
      // accepted — orig handles that) and never show the language picker.
      if (opts && opts.skipLanguageSlide === true) {
        try { console.debug('[wizard-language-slide-339] pass-through: skipLanguageSlide (wizard skipped)'); } catch (_) {}
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
