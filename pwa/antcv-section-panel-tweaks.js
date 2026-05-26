/* AntCV section-panel tweaks sidecar (v1.40.341)
 * ============================================================
 *
 * v1.40.341: findWritingToneWrap() now searches for any canonical
 * writer-skill option value (nordic-minimal etc.), not just the
 * legacy "scandinavian" value that was removed in Round 4.1 of
 * the Settings refactor. Backward-compat: still recognises
 * "scandinavian" for pre-Round-4.1 bundles.
 *
 * v1.40.340: findWritingToneWrap() recognises both "WRITING STYLE"
 * (new label) and "WRITING TONE" (legacy).
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.341';
  const COMPRESS_NEW_ICON = '\u21B9';
  const COMPRESS_OLD_ICONS = ['\u21E5', '\uD83E\uDD0F'];

  if (window.__antcvSectionPanelTweaksInstalled) return;
  window.__antcvSectionPanelTweaksInstalled = SCRIPT_VERSION;

  // v1.40.341: writing-style select identifier values. The select is
  // located by searching for ANY of these option values, so Round 4.1
  // canonical-only bundles AND pre-Round-4.1 cultural-register bundles
  // both work.
  const CANONICAL_OPTION_VALUES = [
    'nordic-minimal', 'measured-professional', 'achievement-driven',
    'context-rich', 'cold-outreach',
    'scandinavian'  // legacy fallback
  ];

  function isMobileViewport() {
    try {
      return window.innerWidth <= 900 || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (_) { return window.innerWidth <= 900; }
  }

  const PANEL_LOCS = ['topbar', 'sidebar', 'main'];
  const COMPACT_LOCS = ['topbar', 'sidebar'];

  function computeButtonOrder(btn) {
    const t = (btn.title || '').toLowerCase();
    const txt = (btn.textContent || '').trim();
    if (t.indexOf('undo') >= 0) return '10';
    if (btn.getAttribute('data-antcv-align-cycler') === 'panel-default') return '15';
    if (t.indexOf('make it fit') >= 0 || t.indexOf('orphan-cleanup') >= 0) return '20';
    if (t.indexOf('compress') >= 0 && t.indexOf('section') >= 0) return '30';
    if (t.indexOf('enrich') >= 0 && t.indexOf('section') >= 0) return '40';
    if (t.indexOf('add a ') >= 0) return '50';
    if (txt.indexOf('+ Add') === 0) return '50';
    return null;
  }

  function renameCandFixToFit() {
    const row = findPanelRow('topbar');
    if (!row) return;
    const buttons = row.querySelectorAll('button');
    for (const btn of buttons) {
      const t = (btn.title || '').toLowerCase();
      if (t.indexOf('orphan-cleanup') < 0) continue;
      const cur = (btn.textContent || '');
      if (/\bFix\b/.test(cur)) {
        btn.textContent = cur.replace(/\bFix\b/, 'Fit');
      }
    }
  }

  function findPanelRow(loc) {
    const header = document.querySelector('[data-candidate-drop-loc="' + loc + '"]');
    if (!header) return null;
    return header.parentElement || null;
  }

  function applyAllPanelOrder() {
    PANEL_LOCS.forEach(function (loc) {
      const row = findPanelRow(loc);
      if (!row) return;
      row.querySelectorAll('button').forEach(function (btn) {
        const ord = computeButtonOrder(btn);
        if (ord && btn.style.order !== ord) {
          btn.style.order = ord;
        }
      });
    });
  }

  function compactifyPanelButton(btn) {
    if (!btn || !btn.setAttribute) return;
    btn.setAttribute('data-antcv-compact-visual-only', '1');
  }

  function ensureCompactCss() {
    if (document.getElementById('antcv-panel-compact-safe-css')) return;
    const css = document.createElement('style');
    css.id = 'antcv-panel-compact-safe-css';
    css.textContent = `
      @media (max-width: 980px), (pointer: coarse) {
        [data-antcv-panel-compact-row="1"] button[data-antcv-compact-visual-only="1"] {
          max-width: 2.45em !important;
          min-width: 2.15em !important;
          padding-left: .45em !important;
          padding-right: .45em !important;
          overflow: hidden !important;
          white-space: nowrap !important;
          text-overflow: clip !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(css);
  }

  function applyCompactToPanels() {
    ensureCompactCss();
    COMPACT_LOCS.forEach(function (loc) {
      const row = findPanelRow(loc);
      if (!row) return;
      row.setAttribute('data-antcv-panel-compact-row', '1');
      row.querySelectorAll('button').forEach(compactifyPanelButton);
    });
  }

  function applyMainPanelOrder() { applyAllPanelOrder(); }

  function replaceCompressIcons() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(function (btn) {
      const t = btn.textContent || '';
      if (!t.length) return;
      let legacyHit = null;
      for (const legacy of COMPRESS_OLD_ICONS) {
        if (t.indexOf(legacy) === 0) { legacyHit = legacy; break; }
      }
      if (t.indexOf(COMPRESS_NEW_ICON) === 0) return;
      if (!legacyHit) return;
      const replaced = COMPRESS_NEW_ICON + t.slice(legacyHit.length);
      if (replaced !== t) {
        btn.textContent = replaced;
      }
    });
  }

  const ADV_TONE_MARK = 'antcvAdvancedTone';
  const ADV_TONE_OPEN_KEY = 'antcv:advTone:open';

  function readAdvToneOpen() {
    try {
      const v = localStorage.getItem(ADV_TONE_OPEN_KEY);
      if (v === null) return false;
      return v === '1';
    } catch (_) { return false; }
  }
  function writeAdvToneOpen(open) {
    try { localStorage.setItem(ADV_TONE_OPEN_KEY, open ? '1' : '0'); } catch (_) {}
  }
  const BANNED_SUMMARY_TEXT = 'Banned Words';
  const ORIG_SUMMARY_TEXT = 'Tone & banned terms';

  function findDetailsBySummary(text) {
    const all = document.querySelectorAll('details');
    for (const d of all) {
      const s = d.querySelector(':scope > summary');
      if (!s) continue;
      const cur = (s.textContent || '').trim();
      if (cur === text) return d;
      if (text === ORIG_SUMMARY_TEXT && cur === BANNED_SUMMARY_TEXT &&
          d.dataset.antcvRenamedFromTone === '1') return d;
    }
    return null;
  }

  function findPreferredToneViInside(detailsEl) {
    if (!detailsEl) return null;
    const children = detailsEl.children;
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c.tagName === 'SUMMARY') continue;
      const labels = c.querySelectorAll('*');
      for (const el of labels) {
        const t = (el.childNodes.length === 1 && el.firstChild.nodeType === 3)
          ? el.textContent.trim() : '';
        if (t === 'Preferred tone') return c;
      }
    }
    return null;
  }

  function findWritingToneWrap() {
    const sels = document.querySelectorAll('select');
    for (const s of sels) {
      // v1.40.341: probe for any canonical option value.
      let matches = false;
      for (const v of CANONICAL_OPTION_VALUES) {
        if (s.querySelector('option[value="' + v + '"]')) { matches = true; break; }
      }
      if (!matches) continue;
      let wrap = s.parentElement;
      for (let i = 0; i < 4 && wrap; i++) {
        const txt = (wrap.textContent || '').trim();
        if (txt.indexOf('WRITING STYLE') === 0 || txt.indexOf('WRITING TONE') === 0) return wrap;
        wrap = wrap.parentElement;
      }
      return s.parentElement || s;
    }
    return null;
  }

  function findToneHelper() {
    return document.querySelector('[data-antcv-tone-helper="1"]');
  }

  function ensureAdvancedToneAndBannedSplit() {
    let original = findDetailsBySummary(ORIG_SUMMARY_TEXT);
    if (!original) {
      const renamed = document.querySelector('details[data-antcv-renamed-from-tone="1"]');
      if (renamed) original = renamed;
    }
    if (!original) return false;

    const parent = original.parentElement;
    if (!parent) return false;

    let advTone = document.querySelector('details[' + dataAttr(ADV_TONE_MARK) + '="1"]');
    if (!advTone) {
      advTone = document.createElement('details');
      advTone.dataset[ADV_TONE_MARK] = '1';
      advTone.open = readAdvToneOpen();
      advTone.addEventListener('toggle', function () {
        writeAdvToneOpen(advTone.open);
      });
      advTone.dataset.antcvToneToggleBound = '1';
      advTone.style.order = '30';
      advTone.style.marginTop = '8px';
      advTone.style.paddingTop = '8px';
      advTone.style.borderTop = '1px dashed rgba(255,255,255,0.12)';

      const sum = document.createElement('summary');
      sum.textContent = (window.AntcvI18n && window.AntcvI18n.t)
        ? window.AntcvI18n.t('tone.advanced', 'Advanced Tone')
        : 'Advanced Tone';
      sum.style.color = 'rgba(255,255,255,0.5)';
      sum.style.fontSize = '9px';
      sum.style.letterSpacing = '0.8px';
      sum.style.marginBottom = '4px';
      sum.style.textTransform = 'uppercase';
      sum.style.cursor = 'pointer';
      sum.style.userSelect = 'none';
      advTone.appendChild(sum);

      parent.insertBefore(advTone, original);
    } else {
      if (advTone.dataset.antcvToneToggleBound !== '1') {
        advTone.addEventListener('toggle', function () {
          writeAdvToneOpen(advTone.open);
        });
        advTone.dataset.antcvToneToggleBound = '1';
      }
      const sum = advTone.querySelector(':scope > summary');
      if (sum) {
        if (sum.style.fontSize !== '9px') {
          sum.style.color = 'rgba(255,255,255,0.5)';
          sum.style.fontSize = '9px';
          sum.style.letterSpacing = '0.8px';
          sum.style.marginBottom = '4px';
          sum.style.textTransform = 'uppercase';
          sum.style.fontWeight = '';
          sum.style.padding = '';
        }
      }
      if (advTone.style.borderTop !== '1px dashed rgba(255, 255, 255, 0.12)' &&
          advTone.style.borderTop.indexOf('dashed') < 0) {
        advTone.style.marginTop = '8px';
        advTone.style.paddingTop = '8px';
        advTone.style.borderTop = '1px dashed rgba(255,255,255,0.12)';
      }
    }

    const helper = findToneHelper();
    if (helper && helper.parentElement !== advTone) {
      try { advTone.appendChild(helper); } catch (_) {}
    }
    const pt = findPreferredToneViInside(original);
    if (pt) {
      try { advTone.appendChild(pt); } catch (_) {}
    }

    const origSum = original.querySelector(':scope > summary');
    if (origSum) {
      const cur = (origSum.textContent || '').trim();
      if (cur !== BANNED_SUMMARY_TEXT) {
        origSum.textContent = BANNED_SUMMARY_TEXT;
      }
      original.dataset.antcvRenamedFromTone = '1';
    }
    if (original.style.order !== '40') original.style.order = '40';

    return true;
  }

  function dataAttr(camel) {
    return 'data-' + camel.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
  }

  function tick() {
    try {
      ensureAdvancedToneAndBannedSplit();
    } catch (_) {}
  }

  [0, 200, 600, 1500].forEach(function (d) {
    if (d === 0) tick();
    else setTimeout(tick, d);
  });

  try {
    const mo = new MutationObserver(function () { tick(); });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  setInterval(tick, 1500);

  window.AntcvSectionPanelTweaks = {
    version: SCRIPT_VERSION,
    _applyMainPanelOrder: applyMainPanelOrder,
    _applyAllPanelOrder: applyAllPanelOrder,
    _applyCompactToPanels: applyCompactToPanels,
    _compactifyPanelButton: compactifyPanelButton,
    _computeButtonOrder: computeButtonOrder,
    _renameCandFixToFit: renameCandFixToFit,
    _replaceCompressIcons: replaceCompressIcons,
    _ensureAdvancedToneAndBannedSplit: ensureAdvancedToneAndBannedSplit,
    _findPreferredToneViInside: findPreferredToneViInside,
    _findDetailsBySummary: findDetailsBySummary,
    _findPanelRow: findPanelRow,
    _findWritingToneWrap: findWritingToneWrap,
    _tick: tick,
    COMPRESS_NEW_ICON: COMPRESS_NEW_ICON,
    COMPRESS_OLD_ICONS: COMPRESS_OLD_ICONS,
    PANEL_LOCS: PANEL_LOCS,
    COMPACT_LOCS: COMPACT_LOCS,
    CANONICAL_OPTION_VALUES: CANONICAL_OPTION_VALUES,
  };
})();
