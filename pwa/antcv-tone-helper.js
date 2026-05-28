/* AntCV writing-tone helper sidecar (v1.40.341)
 *
 * v1.40.341: dropdown values are now writer-skill canonical names per
 * Writing System Engine spec §2. findToneSelect() searches for any of
 * the canonical option values (nordic-minimal, measured-professional,
 * achievement-driven) so the helper still anchors after the cultural
 * register names were removed from the dropdown. Backward-compat: also
 * recognises "scandinavian" so the helper works against bundles that
 * haven't shipped the Round 4.1 app.js yet.
 *
 * v1.40.340: findWritingToneWrap() now recognises both "WRITING STYLE"
 * (new label) and "WRITING TONE" (legacy).
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.341';

  // v1.50.23 — BRAND constants. Tone helper sits inside the sidebar
  // tone-bank UI (dark navy bg); colours are editor chrome, constant
  // across all 7 visual packages.
  const BRAND = {
    white:       '#fff',         // option/button text on dark bg
    optionText:  '#1a1a1a',      // dropdown option text (light bg)
    optionBg:    '#ffffff',      // dropdown option bg
    tealBright:  '#01B7BB',      // save-button accent
  };

  const CUSTOMS_KEY = 'antcv:tone:customs';
  const SELECTED_SLOT_KEY = 'antcv:tone:selected-slot';
  const ACTIVE_CUSTOM_KEY = 'antcv:tone:active-custom';
  const HELPER_MARK = 'data-antcv-tone-helper';
  const SYNTH_FLAG = '__antcvSyntheticToneChange';

  if (window.__antcvToneHelperInstalled) return;
  window.__antcvToneHelperInstalled = SCRIPT_VERSION;

  // STANDARD_TONES below is the LEGACY cultural-register set. We keep
  // it untouched for the force-apply preset-chip logic — those code
  // paths only fire if a user's stored toneRegister is one of these
  // cultural names. After v1.40.341 the dropdown only offers writer-
  // skill canonical names, so for new selections these branches are
  // silently inactive. The migration writes a canonical key to LS;
  // STANDARD_TONES.includes(canonical) is false, so force-apply skips.
  // A future round can extend STANDARD_TONES + TONE_PRESETS to the 12
  // canonical names using each style's defaultToneChips from the
  // style-matrix.md, but that is not in scope for Round 4.1.
  const STANDARD_TONES = ['scandinavian', 'usa', 'latam', 'british', 'indian'];

  const TONE_PRESETS = {
    scandinavian: [
      'clear', 'calm', 'direct', 'factual', 'short sentences',
      'concrete examples', 'natural Danish', 'low hype',
      'plain language', 'no filler', 'specific', 'measured',
      'confident without overclaiming',
    ],
    usa: [
      'clear', 'direct', 'concrete examples', 'outcome-focused',
      'specific', 'practical', 'human',
    ],
    latam: [
      'formal', 'descriptive', 'thorough', 'hierarchical',
      'responsibilities + outcomes', 'credentials named',
      'institutional', 'elaborate but precise',
      'confident self-presentation', 'titles and seniority explicit',
    ],
    british: [
      'clear', 'precise', 'measured', 'plain language',
      'no filler', 'professional warmth',
    ],
    indian: [
      'precise', 'professional warmth', 'specific',
      'plain language', 'measured',
    ],
  };

  const LABELS = {
    cvSidebar: 'CV Sidebar Content',
    optional:  'Optional details \u2014 patent, publications, background',
    tone:      'Tone & banned terms',
  };

  // v1.40.341: identifier values used to locate the writing-style select.
  // We check for ANY of these — Round 4.1 ships canonical only; older
  // builds still ship "scandinavian". Either way the helper finds the
  // right select.
  const CANONICAL_OPTION_VALUES = [
    'nordic-minimal', 'measured-professional', 'achievement-driven',
    'context-rich', 'cold-outreach',
    'scandinavian'  // legacy fallback for pre-Round-4.1 bundles
  ];

  function findToneSelect() {
    const sels = document.querySelectorAll('select');
    for (const s of sels) {
      for (const v of CANONICAL_OPTION_VALUES) {
        if (s.querySelector('option[value="' + v + '"]')) return s;
      }
    }
    return null;
  }

  function findWritingToneWrap() {
    const sel = findToneSelect();
    if (!sel) return null;
    let wrap = sel.parentElement;
    for (let i = 0; i < 4 && wrap; i++) {
      const txt = (wrap.textContent || '').trim();
      if (txt.indexOf('WRITING STYLE') === 0 || txt.indexOf('WRITING TONE') === 0) return wrap;
      wrap = wrap.parentElement;
    }
    return sel.parentElement || sel;
  }

  function findPreferredToneBank() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    let node;
    while ((node = walker.nextNode())) {
      if ((node.nodeValue || '').trim() === 'Preferred tone') {
        let cur = node.parentElement;
        for (let i = 0; i < 8 && cur; i++) {
          if (cur.querySelector('input') && cur.querySelector('button')) return cur;
          cur = cur.parentElement;
        }
      }
    }
    return null;
  }

  function findDetailsBySummary(text) {
    const all = document.querySelectorAll('details');
    for (const d of all) {
      const s = d.querySelector(':scope > summary');
      if (!s) continue;
      if ((s.textContent || '').trim() === text) return d;
    }
    return null;
  }

  function readActiveChips(bank) {
    if (!bank) return [];
    const out = [];
    const seen = new Set();
    bank.querySelectorAll('button').forEach(function (b) {
      const t = (b.textContent || '').trim();
      if (t.endsWith('\u00D7')) {
        const term = t.slice(0, -1).trim();
        if (term && !seen.has(term)) {
          seen.add(term);
          out.push(term);
        }
      }
    });
    return out;
  }

  function findBankAddButton(bank, term) {
    if (!bank) return null;
    const buttons = bank.querySelectorAll('button');
    for (const b of buttons) {
      const t = (b.textContent || '').trim();
      if (t.indexOf('+ ') === 0 && t.slice(2).trim() === term) return b;
    }
    return null;
  }

  function findActiveRemoveButton(bank, term) {
    if (!bank) return null;
    const buttons = bank.querySelectorAll('button');
    for (const b of buttons) {
      const t = (b.textContent || '').trim();
      if (t.endsWith('\u00D7') && t.slice(0, -1).trim() === term) return b;
    }
    return null;
  }

  function applyChipSet(target) {
    const bank = findPreferredToneBank();
    if (!bank) return false;
    const current = readActiveChips(bank);
    const targetSet = new Set(target);
    const currentSet = new Set(current);
    window.__antcvForceApplyInProgress = true;
    try {
      for (const term of current) {
        if (!targetSet.has(term)) {
          const btn = findActiveRemoveButton(bank, term);
          if (btn) btn.click();
        }
      }
      for (const term of target) {
        if (!currentSet.has(term)) {
          const btn = findBankAddButton(bank, term);
          if (btn) btn.click();
        }
      }
    } finally {
      Promise.resolve().then(function () {
        window.__antcvForceApplyInProgress = false;
      });
    }
    return true;
  }

  function readCurrentTone() {
    const sel = findToneSelect();
    return sel ? sel.value : null;
  }

  function readCustomsRaw() {
    try {
      const raw = localStorage.getItem(CUSTOMS_KEY);
      if (!raw) return { 1: null, 2: null, 3: null };
      const parsed = JSON.parse(raw);
      return { 1: parsed && parsed[1], 2: parsed && parsed[2], 3: parsed && parsed[3] };
    } catch (_) { return { 1: null, 2: null, 3: null }; }
  }

  function normaliseSlot(raw) {
    if (raw == null) return null;
    if (Array.isArray(raw)) {
      return raw.length ? { tone: null, chips: raw.slice() } : null;
    }
    if (typeof raw === 'object' && Array.isArray(raw.chips) && raw.chips.length) {
      const out = { tone: raw.tone || null, chips: raw.chips.slice() };
      if (raw.name) out.name = raw.name;
      return out;
    }
    return null;
  }

  function writeCustoms(customs) {
    try {
      const out = {};
      for (let n = 1; n <= 3; n++) {
        if (customs[n]) {
          const c = { tone: customs[n].tone || null, chips: customs[n].chips.slice() };
          if (customs[n].name) c.name = customs[n].name;
          out[n] = c;
        } else {
          out[n] = null;
        }
      }
      localStorage.setItem(CUSTOMS_KEY, JSON.stringify(out));
    } catch (_) {}
  }

  function readSelectedSlot() {
    try {
      const raw = localStorage.getItem(SELECTED_SLOT_KEY);
      if (!raw) return 1;
      const n = parseInt(raw, 10);
      return (n >= 1 && n <= 3) ? n : 1;
    } catch (_) { return 1; }
  }

  function writeSelectedSlot(n) {
    try { localStorage.setItem(SELECTED_SLOT_KEY, String(n)); } catch (_) {}
  }

  function readActiveCustom() {
    try {
      const raw = localStorage.getItem(ACTIVE_CUSTOM_KEY);
      if (!raw) return null;
      let v = raw;
      try { const p = JSON.parse(raw); if (typeof p === 'string') v = p; } catch (_) {}
      const m = String(v).match(/^custom_(\d)$/);
      return m ? parseInt(m[1], 10) : null;
    } catch (_) { return null; }
  }

  let lastForcedTone = null;

  function ensurePresetForCurrentTone(forceReapply) {
    const tone = readCurrentTone();
    if (!STANDARD_TONES.includes(tone)) return;
    if (readActiveCustom() !== null) return;
    if (!forceReapply && tone === lastForcedTone) return;
    const preset = TONE_PRESETS[tone];
    if (!preset) return;
    applyChipSet(preset);
    lastForcedTone = tone;
  }

  function isLockedChip(term) {
    if (readActiveCustom() !== null) return false;
    const tone = readCurrentTone();
    if (!STANDARD_TONES.includes(tone)) return false;
    const preset = TONE_PRESETS[tone] || [];
    return preset.indexOf(term) >= 0;
  }

  document.addEventListener('click', function (ev) {
    if (window.__antcvForceApplyInProgress) return;
    const target = ev.target;
    if (!target || !target.closest) return;
    const btn = target.closest('button');
    if (!btn) return;
    const bank = findPreferredToneBank();
    if (!bank || !bank.contains(btn)) return;
    const txt = (btn.textContent || '').trim();
    if (!txt.endsWith('\u00D7')) return;
    const term = txt.slice(0, -1).trim();
    if (!isLockedChip(term)) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const origBg = btn.style.background;
    const origOutline = btn.style.outline;
    btn.style.background = 'rgba(255, 100, 100, 0.35)';
    btn.style.outline = '1px solid rgba(255, 100, 100, 0.6)';
    setTimeout(function () {
      btn.style.background = origBg;
      btn.style.outline = origOutline;
    }, 350);
  }, true);

  function reorderSections() {
    const cvSidebar = findDetailsBySummary(LABELS.cvSidebar);
    const optional  = findDetailsBySummary(LABELS.optional);
    const tone      = findDetailsBySummary(LABELS.tone) ||
                      document.querySelector('details[data-antcv-renamed-from-tone="1"]');
    if (!cvSidebar || !optional || !tone) return false;

    const parent = cvSidebar.parentElement;
    if (!parent || optional.parentElement !== parent || tone.parentElement !== parent) {
      return false;
    }

    const wtWrap = findWritingToneWrap();
    if (!wtWrap) return false;

    if (parent.dataset.antcvSectionParent !== '1') {
      if (parent.style.display !== 'flex') parent.style.display = 'flex';
      if (parent.style.flexDirection !== 'column') parent.style.flexDirection = 'column';
      parent.dataset.antcvSectionParent = '1';
    }

    const advTone = document.querySelector('details[data-antcv-advanced-tone="1"]');

    if (advTone) {
      if (wtWrap.parentElement !== parent) {
        try { parent.appendChild(wtWrap); } catch (_) {}
      }
      if (wtWrap.style.order !== '25') wtWrap.style.order = '25';
    } else {
      if (wtWrap.parentElement !== parent) {
        try { parent.appendChild(wtWrap); } catch (_) {}
      }
      if (wtWrap.style.order !== '30') wtWrap.style.order = '30';
    }

    if (cvSidebar.style.order !== '10') cvSidebar.style.order = '10';
    if (optional.style.order  !== '20') optional.style.order  = '20';
    if (tone.style.order      !== '40') tone.style.order      = '40';

    return true;
  }

  function renderHelper() {
    const wrap = findWritingToneWrap();
    if (!wrap || !wrap.parentElement) return false;

    let helper = document.querySelector('[' + HELPER_MARK + '="1"]');
    if (helper) {
      const advTone = document.querySelector('details[data-antcv-advanced-tone="1"]');
      if (advTone && advTone.contains(helper)) {
        return true;
      }
      if (wrap.nextElementSibling !== helper) {
        try { wrap.parentElement.insertBefore(helper, wrap.nextSibling); } catch (_) {}
      }
      return true;
    }

    const box = document.createElement('div');
    box.setAttribute(HELPER_MARK, '1');
    box.style.cssText = 'margin:8px 0 12px 0;padding:8px 10px;background:rgba(1,183,187,0.04);border:1px dashed rgba(1,183,187,0.25);border-radius:6px;';
    box.style.order = '31';

    const slotRow = document.createElement('div');
    slotRow.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;';

    const slotLabel = document.createElement('span');
    slotLabel.style.cssText = 'min-width:80px;font-size:10px;font-weight:600;color:rgba(255,255,255,0.65);letter-spacing:0.4px;text-transform:uppercase;';
    slotLabel.textContent = (window.AntcvI18n && window.AntcvI18n.t)
      ? window.AntcvI18n.t('tone.custom_slot', 'Custom slot')
      : 'Custom slot';
    slotRow.appendChild(slotLabel);

    const slotSelect = document.createElement('select');
    slotSelect.setAttribute('data-antcv-tone-helper-slot-select', '1');
    slotSelect.style.cssText = `padding:3px 6px;font-size:11px;background:rgba(255,255,255,0.06);color:${BRAND.white};border:1px solid rgba(255,255,255,0.18);border-radius:4px;font-family:inherit;min-width:140px;`;
    for (let n = 1; n <= 3; n++) {
      const o = document.createElement('option');
      o.value = String(n);
      const customBase = (window.AntcvI18n && window.AntcvI18n.t)
        ? window.AntcvI18n.t('tone.custom', 'Custom')
        : 'Custom';
      o.textContent = customBase + ' ' + n;
      o.style.color = BRAND.optionText;
      o.style.background = BRAND.optionBg;
      slotSelect.appendChild(o);
    }
    slotSelect.value = String(readSelectedSlot());
    slotSelect.addEventListener('change', function () {
      writeSelectedSlot(parseInt(slotSelect.value, 10));
      refreshHelperState();
    });
    slotRow.appendChild(slotSelect);

    const saveBtn = makeBtn('Save', BRAND.tealBright);
    saveBtn.setAttribute('data-antcv-tone-helper-save', '1');
    saveBtn.addEventListener('click', function () {
      const bank = findPreferredToneBank();
      if (!bank) return;
      const chips = readActiveChips(bank);
      if (!chips.length) return;
      const customs = readCustomsRaw();
      const n = parseInt(slotSelect.value, 10);
      const normalised = {
        1: normaliseSlot(customs[1]),
        2: normaliseSlot(customs[2]),
        3: normaliseSlot(customs[3]),
      };
      normalised[n] = { tone: readCurrentTone(), chips: chips };
      writeCustoms(normalised);
      refreshHelperState();
    });
    slotRow.appendChild(saveBtn);

    const loadBtn = makeBtn('Load');
    loadBtn.setAttribute('data-antcv-tone-helper-load', '1');
    loadBtn.addEventListener('click', function () {
      const customs = readCustomsRaw();
      const n = parseInt(slotSelect.value, 10);
      const slot = normaliseSlot(customs[n]);
      if (!slot) return;
      try {
        localStorage.setItem(ACTIVE_CUSTOM_KEY, JSON.stringify('custom_' + n));
      } catch (_) {}
      applyChipSet(slot.chips);
      if (slot.tone) {
        const sel = findToneSelect();
        if (sel) {
          window[SYNTH_FLAG] = true;
          try {
            sel.value = slot.tone;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          } finally {
            Promise.resolve().then(function () { window[SYNTH_FLAG] = false; });
          }
        }
      }
      setTimeout(refreshHelperState, 60);
    });
    slotRow.appendChild(loadBtn);

    const clearBtn = makeBtn('Clear');
    clearBtn.setAttribute('data-antcv-tone-helper-clear', '1');
    clearBtn.addEventListener('click', function () {
      const customs = readCustomsRaw();
      const n = parseInt(slotSelect.value, 10);
      const normalised = {
        1: normaliseSlot(customs[1]),
        2: normaliseSlot(customs[2]),
        3: normaliseSlot(customs[3]),
      };
      normalised[n] = null;
      writeCustoms(normalised);
      if (readActiveCustom() === n) {
        try { localStorage.removeItem(ACTIVE_CUSTOM_KEY); } catch (_) {}
      }
      refreshHelperState();
    });
    slotRow.appendChild(clearBtn);

    const status = document.createElement('div');
    status.setAttribute('data-antcv-tone-helper-status', '1');
    status.style.cssText = 'margin-top:6px;font-size:10px;color:rgba(255,255,255,0.55);';

    box.appendChild(slotRow);
    box.appendChild(status);

    wrap.parentElement.insertBefore(box, wrap.nextSibling);
    refreshHelperState();
    return true;
  }

  function makeBtn(label, accent) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    const bg = accent ? 'rgba(1,183,187,0.15)' : 'rgba(255,255,255,0.06)';
    const border = accent ? ('1px solid ' + accent) : '1px solid rgba(255,255,255,0.18)';
    const color = accent || BRAND.white;
    b.style.cssText = 'padding:3px 8px;font-size:11px;font-weight:600;background:' + bg + ';color:' + color + ';border:' + border + ';border-radius:4px;cursor:pointer;font-family:inherit;';
    return b;
  }

  function refreshHelperState() {
    const helper = document.querySelector('[' + HELPER_MARK + '="1"]');
    if (!helper) return;

    const slotSelect = helper.querySelector('[data-antcv-tone-helper-slot-select]');
    const n = readSelectedSlot();
    if (slotSelect && slotSelect.value !== String(n)) {
      slotSelect.value = String(n);
    }

    if (slotSelect) {
      const customs = readCustomsRaw();
      for (const opt of slotSelect.options) {
        const slotNum = parseInt(opt.value, 10);
        const slot = normaliseSlot(customs[slotNum]);
        const label = slot
          ? 'Custom ' + slotNum + ' (' + slot.chips.length + ' chips, ' + (slot.tone || 'no tone') + ')'
          : 'Custom ' + slotNum + ' (empty)';
        if (opt.textContent !== label) opt.textContent = label;
      }
    }

    const status = helper.querySelector('[data-antcv-tone-helper-status]');
    if (status) {
      const customs = readCustomsRaw();
      const slot = normaliseSlot(customs[n]);
      const activeCustom = readActiveCustom();
      let txt = slot
        ? 'Slot ' + n + ': ' + slot.chips.length + ' chips for ' + (slot.tone || 'no tone')
        : 'Slot ' + n + ' is empty';
      if (activeCustom) {
        txt += ' \u2022 Loaded: Custom ' + activeCustom + ' (chips fully editable)';
      } else {
        const tone = readCurrentTone();
        if (STANDARD_TONES.includes(tone)) {
          txt += ' \u2022 ' + tone + ' preset chips locked (can add, cannot remove)';
        }
      }
      status.textContent = txt;
    }
  }

  let pending = null;
  function schedule() {
    if (pending) return;
    pending = setTimeout(function () {
      pending = null;
      try {
        reorderSections();
        renderHelper();
        ensurePresetForCurrentTone(false);
        refreshHelperState();
      } catch (_) {}
    }, 60);
  }

  function boot() {
    if (!window.AntcvToneRebind) window.AntcvToneRebind = {};
    window.AntcvToneRebind._applyChipSet = applyChipSet;
    window.AntcvToneRebind._findPreferredToneBank = findPreferredToneBank;
    window.AntcvToneRebind._readActiveChips = readActiveChips;
    window.AntcvToneRebind._readCurrentTone = readCurrentTone;
    window.AntcvToneRebind.version = SCRIPT_VERSION;

    schedule();
    try {
      const obs = new MutationObserver(schedule);
      obs.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}

    document.addEventListener('change', function (ev) {
      const t = ev.target;
      if (!t || t.tagName !== 'SELECT') return;
      // v1.40.341: identify the writing-style select via any canonical
      // option value present. Same probe used by findToneSelect().
      let isOurs = false;
      for (const v of CANONICAL_OPTION_VALUES) {
        if (t.querySelector('option[value="' + v + '"]')) { isOurs = true; break; }
      }
      if (!isOurs) return;
      if (window[SYNTH_FLAG]) return;
      const v = t.value;
      if (v && v.indexOf('custom_') === 0) return;
      if (!STANDARD_TONES.includes(v)) return;
      try { localStorage.removeItem(ACTIVE_CUSTOM_KEY); } catch (_) {}
      setTimeout(function () {
        ensurePresetForCurrentTone(true);
        refreshHelperState();
      }, 20);
    }, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.AntcvToneHelper = {
    version: SCRIPT_VERSION,
    _findToneSelect: findToneSelect,
    _findWritingToneWrap: findWritingToneWrap,
    _findPreferredToneBank: findPreferredToneBank,
    _readActiveChips: readActiveChips,
    _findBankAddButton: findBankAddButton,
    _findActiveRemoveButton: findActiveRemoveButton,
    _applyChipSet: applyChipSet,
    _readCurrentTone: readCurrentTone,
    _readCustomsRaw: readCustomsRaw,
    _writeCustoms: writeCustoms,
    _normaliseSlot: normaliseSlot,
    _readSelectedSlot: readSelectedSlot,
    _writeSelectedSlot: writeSelectedSlot,
    _readActiveCustom: readActiveCustom,
    _renderHelper: renderHelper,
    _refreshHelperState: refreshHelperState,
    _reorderSections: reorderSections,
    _ensurePresetForCurrentTone: ensurePresetForCurrentTone,
    _isLockedChip: isLockedChip,
    _presets: TONE_PRESETS,
    _standardTones: STANDARD_TONES,
    _canonicalValues: CANONICAL_OPTION_VALUES,
  };
})();
