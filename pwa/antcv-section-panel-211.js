/* AntCV section headline controls + Publications buttons + role content CJLR (v1.40.215)
 * - Defaults: CAND. center, SIDEBAR center, MAIN justify.
 * - Keeps user-changed headline alignment after first click.
 * - Button order in all section headers: Undo, Fit, Comp-icon, Enr., CJLR, +.
 * - CJLR affects the section headline only.
 * - Adds missing compact Comp/Enr controls to PUBLICATIONS & PATENT row.
 */
(function () {
  'use strict';

  const VERSION = '1.40.215';
  if (window.__antcvSectionPanel211Installed === VERSION) return;
  window.__antcvSectionPanel211Installed = VERSION;

  const LOCS = ['topbar', 'sidebar', 'main'];
  const TITLE_COLOR = '#01B7BB';
  const STORAGE_KEY = 'antcv.sectionHeadlineAlignment.v1';
  const USER_TOUCHED_KEY = 'antcv.sectionHeadlineAlignment.userTouched.v1';
  const DEFAULTS = { topbar: 'center', sidebar: 'center', main: 'justify' };
  const ALIGNMENTS = ['center', 'justify', 'left', 'right'];
  const GLYPHS = { left: '⇤', center: '↔', right: '⇥', justify: '☰' };

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return clean(s).toLowerCase(); }
  function anchor(loc) { return document.querySelector('[data-candidate-drop-loc="' + loc + '"]'); }
  function row(loc) { const a = anchor(loc); return a ? a.parentElement : null; }

  function readMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch (_) { return {}; }
  }
  function writeMap(map) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {})); } catch (_) {} }
  function hasUserTouched(loc) {
    try {
      const raw = localStorage.getItem(USER_TOUCHED_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return !!(obj && obj[loc]);
    } catch (_) { return false; }
  }
  function markUserTouched(loc) {
    try {
      const raw = localStorage.getItem(USER_TOUCHED_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      obj[loc] = true;
      localStorage.setItem(USER_TOUCHED_KEY, JSON.stringify(obj));
    } catch (_) {}
  }
  function seedDefaults() {
    const map = readMap();
    let changed = false;
    LOCS.forEach(function (loc) {
      const v = map[loc];
      if (!hasUserTouched(loc) && ALIGNMENTS.indexOf(v) < 0) {
        map[loc] = DEFAULTS[loc];
        changed = true;
      }
    });
    if (changed) writeMap(map);
  }
  function readAlign(loc) {
    const v = readMap()[loc];
    return ALIGNMENTS.indexOf(v) >= 0 ? v : DEFAULTS[loc];
  }
  function writeAlign(loc, v) {
    const map = readMap();
    map[loc] = v;
    writeMap(map);
  }
  function nextAlign(v) {
    const i = ALIGNMENTS.indexOf(v);
    return ALIGNMENTS[(i < 0 ? 0 : i + 1) % ALIGNMENTS.length];
  }

  function titleForLoc(loc) { return loc === 'topbar' ? 'CAND.' : loc === 'sidebar' ? 'SIDEBAR' : 'MAIN'; }

  function classify(btn) {
    const title = low(btn.getAttribute('title'));
    const text = low(btn.textContent || btn.innerText);
    const prev = btn.getAttribute('data-antcv-panel-action-211') || btn.getAttribute('data-antcv-panel-action-208') || btn.getAttribute('data-antcv-panel-action-207') || btn.getAttribute('data-antcv-panel-action-206') || btn.getAttribute('data-antcv-main-action') || '';
    const isCjlr = btn.getAttribute('data-antcv-headline-cjlr') === '1' || btn.getAttribute('data-antcv-align-cycler') === 'headline' || btn.getAttribute('data-antcv-align-cycler') === 'panel-default';

    if (isCjlr || prev === 'cjlr') return { key: 'cjlr', order: 45, label: GLYPHS.left };
    if (title.indexOf('undo') >= 0 || prev === 'undo' || /undo|↶|↩/.test(text)) return { key: 'undo', order: 10, label: '↶' };
    if (title.indexOf('make it fit') >= 0 || title.indexOf('fit it') >= 0 || title.indexOf('orphan-cleanup') >= 0 || prev === 'fit' || /\bfit\b/.test(text) || /\bfix\b/.test(text)) return { key: 'fit', order: 20, label: '🎯 Fit' };
    if (title.indexOf('compress') >= 0 || prev === 'comp' || /comp\.?|compress|↹|⇥|→/.test(text)) return { key: 'comp', order: 30, label: '↹' };
    if (title.indexOf('enrich') >= 0 || prev === 'enr' || /enr\.?|enrich|✨/.test(text)) return { key: 'enr', order: 40, label: '✨ Enr.' };
    if (title.indexOf('add a ') >= 0 || title === 'add' || prev === 'add' || /^\+/.test(text) || text.indexOf('add') >= 0) return { key: 'add', order: 50, label: '+' };
    return null;
  }

  function refreshCjlr(btn, loc) {
    const cur = readAlign(loc);
    btn.type = 'button';
    btn.setAttribute('data-antcv-headline-cjlr', '1');
    btn.setAttribute('data-antcv-align-cycler', 'headline');
    btn.setAttribute('data-antcv-panel-default-loc', loc);
    btn.setAttribute('data-antcv-panel-action-211', 'cjlr');
    btn.setAttribute('data-antcv-panel-action-208', 'cjlr');
    btn.setAttribute('data-antcv-panel-action-207', 'cjlr');
    btn.setAttribute('data-antcv-panel-label-211', GLYPHS[cur] || GLYPHS.left);
    btn.setAttribute('data-antcv-panel-label-208', GLYPHS[cur] || GLYPHS.left);
    btn.setAttribute('data-antcv-panel-label-207', GLYPHS[cur] || GLYPHS.left);
    btn.setAttribute('data-antcv-title-align-current', cur);
    btn.title = titleForLoc(loc) + ' headline alignment: ' + cur + ' (click to cycle)';
    btn.setAttribute('aria-label', btn.title);
    btn.style.order = '45';
  }

  function ensureHeadlineCjlr(loc) {
    const r = row(loc);
    if (!r) return null;
    let btn = r.querySelector(':scope button[data-antcv-headline-cjlr="1"]');
    if (!btn) btn = r.querySelector(':scope button[data-antcv-align-cycler="headline"], :scope button[data-antcv-align-cycler="panel-default"]');
    if (!btn) {
      btn = document.createElement('button');
      const add = Array.from(r.querySelectorAll(':scope button')).find(function (b) { return classify(b) && classify(b).key === 'add'; });
      if (add) r.insertBefore(btn, add);
      else r.appendChild(btn);
    }
    refreshCjlr(btn, loc);
    return btn;
  }

  function applyTitleText(loc) {
    const a = anchor(loc);
    if (!a) return;
    if (loc === 'topbar') {
      a.setAttribute('data-antcv-cand-title-211', '1');
      a.setAttribute('data-antcv-cand-title-208', '1');
      a.setAttribute('aria-label', 'CAND.');
    }
  }

  function applyTitleAlignment(loc) {
    const a = anchor(loc);
    const r = row(loc);
    if (!a || !r) return;
    const cur = readAlign(loc);
    r.setAttribute('data-antcv-title-align-row', cur);
    a.setAttribute('data-antcv-title-align', cur);
    a.style.textAlign = cur === 'justify' ? 'justify' : cur;
  }

  function applyPanel(loc) {
    const a = anchor(loc);
    const r = row(loc);
    if (!a || !r) return;
    r.setAttribute('data-antcv-panel-211', loc);
    r.setAttribute('data-antcv-panel-208', loc);
    a.setAttribute('data-antcv-section-title-211', loc);
    a.setAttribute('data-antcv-section-title-208', loc);
    applyTitleText(loc);
    ensureHeadlineCjlr(loc);
    applyTitleAlignment(loc);

    Array.from(r.querySelectorAll(':scope button')).forEach(function (btn) {
      const meta = classify(btn);
      if (!meta) return;
      if (meta.key === 'cjlr') refreshCjlr(btn, loc);
      btn.setAttribute('data-antcv-panel-action-211', meta.key);
      btn.setAttribute('data-antcv-panel-label-211', meta.key === 'cjlr' ? (btn.getAttribute('data-antcv-panel-label-211') || meta.label) : meta.label);
      btn.setAttribute('data-antcv-panel-action-208', meta.key);
      btn.setAttribute('data-antcv-panel-label-208', meta.key === 'cjlr' ? (btn.getAttribute('data-antcv-panel-label-211') || meta.label) : meta.label);
      btn.style.order = String(meta.order);
      if (loc === 'topbar' && meta.key === 'fit') {
        btn.setAttribute('data-antcv-fit-scope', 'topbar');
        btn.setAttribute('data-antcv-cand-fit-211', '1');
        btn.setAttribute('data-antcv-cand-fit-208', '1');
        btn.setAttribute('aria-label', 'Fit CAND. items');
        btn.setAttribute('data-antcv-action', 'fit-candidate-items');
      }
    });
  }

  function installHeadlineClickGuard() {
    if (window.__antcvHeadlineCjlrGuard211) return;
    window.__antcvHeadlineCjlrGuard211 = true;
    document.addEventListener('click', function (ev) {
      const btn = ev.target && ev.target.closest && ev.target.closest('button[data-antcv-headline-cjlr="1"]');
      if (!btn) return;
      let loc = btn.getAttribute('data-antcv-panel-default-loc');
      if (!loc) loc = row('topbar') && row('topbar').contains(btn) ? 'topbar' : row('sidebar') && row('sidebar').contains(btn) ? 'sidebar' : 'main';
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      const nxt = nextAlign(readAlign(loc));
      markUserTouched(loc);
      writeAlign(loc, nxt);
      refreshCjlr(btn, loc);
      applyTitleAlignment(loc);
    }, true);
  }

  function candidateItemRows() {
    return Array.from(document.querySelectorAll('button')).map(function (b) {
      let p = b.parentElement;
      for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
        const txt = low(p.textContent);
        if (txt.indexOf('publications & patent') >= 0 || txt.indexOf('publications and patent') >= 0) return p;
      }
      return null;
    }).filter(Boolean);
  }

  function rowHasText(el, needle) { return low(el.textContent).indexOf(low(needle)) >= 0; }
  function isPubRow(el) { return rowHasText(el, 'PUBLICATIONS & PATENT') || rowHasText(el, 'PUBLICATIONS AND PATENT'); }
  function isSectionHeaderRow(el) { return !!(el && el.querySelector && el.querySelector('[data-candidate-drop-loc]')); }

  function findSubsectionRows() {
    const rows = [];
    Array.from(document.querySelectorAll('button')).forEach(function (btn) {
      let p = btn.parentElement;
      for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
        if (!p || isSectionHeaderRow(p)) continue;
        const txt = clean(p.textContent).toUpperCase();
        if (/TOOLS & METHODS|CERTIFICATIONS|EDUCATION|PUBLICATIONS & PATENT|REGULATORY CONTEXT|ADDITIONAL INFORMATION/.test(txt) && rows.indexOf(p) < 0) {
          rows.push(p);
          break;
        }
      }
    });
    return rows;
  }

  function getButtons(el) { return el ? Array.from(el.querySelectorAll('button')) : []; }
  function miniKind(btn) {
    const t = low((btn.getAttribute('title') || '') + ' ' + (btn.textContent || ''));
    if (t.indexOf('enrich') >= 0 || t.indexOf('enhance') >= 0 || /enr\.?|enh\.?|✨/.test(t)) return 'enr';
    if (t.indexOf('compress') >= 0 || /comp\.?|↹|⇥|→/.test(t)) return 'comp';
    if (/^\s*on\s*$/.test(t) || t.indexOf('toggle') >= 0) return 'on';
    if (/\b1\b|page|📄/.test(t)) return 'page';
    return '';
  }
  function cloneMini(proto, kind) {
    const b = proto ? proto.cloneNode(true) : document.createElement('button');
    b.type = 'button';
    b.removeAttribute('id');
    b.setAttribute('data-antcv-pub-injected', kind);
    b.setAttribute('data-antcv-pub-mini-kind', kind);
    b.setAttribute('data-antcv-panel-label-211', kind === 'comp' ? '↹' : '✨');
    b.setAttribute('data-antcv-panel-action-211', kind);
    b.title = kind === 'comp' ? 'Compress Publications & Patent' : 'Enhance Publications & Patent';
    b.setAttribute('aria-label', b.title);
    // Keep the native React/private properties off cloned elements; this is a DOM-side button.
    Object.keys(b).forEach(function (k) { if (/^__react/.test(k)) { try { delete b[k]; } catch (_) {} } });
    b.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      // Best effort: use the matching real control if React renders it later.
      const row = b.closest('[data-antcv-publications-row="1"]') || b.parentElement;
      const real = getButtons(row).find(function (x) { return x !== b && x.getAttribute('data-antcv-pub-injected') !== kind && miniKind(x) === kind; });
      if (real) real.click();
    }, true);
    return b;
  }

  function ensurePublicationsMiniButtons() {
    const allRows = findSubsectionRows();
    const pub = allRows.find(isPubRow);
    if (!pub) return;
    pub.setAttribute('data-antcv-publications-row', '1');
    const buttons = getButtons(pub);
    const hasComp = buttons.some(function (b) { return miniKind(b) === 'comp'; });
    const hasEnr = buttons.some(function (b) { return miniKind(b) === 'enr'; });
    if (hasComp && hasEnr) return;

    const donor = allRows.find(function (r) { return r !== pub && getButtons(r).some(function (b) { return miniKind(b) === 'comp'; }) && getButtons(r).some(function (b) { return miniKind(b) === 'enr'; }); });
    const donorBtns = getButtons(donor);
    const protoComp = donorBtns.find(function (b) { return miniKind(b) === 'comp'; });
    const protoEnr = donorBtns.find(function (b) { return miniKind(b) === 'enr'; });

    const pageBtn = buttons.find(function (b) { return miniKind(b) === 'page'; });
    const onBtn = buttons.find(function (b) { return miniKind(b) === 'on'; }) || buttons[buttons.length - 2] || null;
    const enrBtn = buttons.find(function (b) { return miniKind(b) === 'enr'; });
    const parent = (enrBtn && enrBtn.parentElement) || (pageBtn && pageBtn.parentElement) || (onBtn && onBtn.parentElement) || pub;

    // Publications & Patent is a sub-section row, not a full section header.
    // Keep its mini controls in the requested order on both desktop and mobile:
    // page selector → Enhance → Compress → ON → delete.
    function placeMini(btn, before) {
      if (!btn || !parent) return;
      if (btn.parentElement !== parent) parent.appendChild(btn);
      if (before && before.parentElement === parent && btn.nextSibling !== before) parent.insertBefore(btn, before);
    }
    const liveButtons = getButtons(pub);
    let liveEnr = liveButtons.find(function (b) { return miniKind(b) === 'enr'; });
    let liveComp = liveButtons.find(function (b) { return miniKind(b) === 'comp'; });
    const liveOn = liveButtons.find(function (b) { return miniKind(b) === 'on'; }) || onBtn;

    if (!liveEnr) {
      liveEnr = cloneMini(protoEnr, 'enr');
      placeMini(liveEnr, liveOn);
    }
    if (!liveComp) {
      liveComp = cloneMini(protoComp, 'comp');
      placeMini(liveComp, liveOn);
    }
    if (liveEnr && liveComp && liveEnr.parentElement === parent && liveComp.parentElement === parent) {
      // Force Compress directly after Enhance, and therefore before ON.
      if (liveEnr.nextSibling !== liveComp) parent.insertBefore(liveComp, liveEnr.nextSibling);
      if (liveOn && liveOn.parentElement === parent && liveComp.compareDocumentPosition(liveOn) & Node.DOCUMENT_POSITION_PRECEDING) {
        parent.insertBefore(liveComp, liveOn);
      }
    }
  }

  function injectCss() {
    const old = document.getElementById('antcv-section-panel-211-css');
    if (old) old.remove();
    const style = document.createElement('style');
    style.id = 'antcv-section-panel-211-css';
    style.textContent = `
      [data-antcv-panel-211] {
        display: flex !important;
        align-items: center !important;
        width: 100% !important;
        box-sizing: border-box !important;
        gap: 5px !important;
      }
      [data-antcv-section-title-211] {
        margin-right: auto !important;
        flex: 1 1 auto !important;
        color: ${TITLE_COLOR} !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        line-height: 1.05 !important;
        font-family: inherit !important;
        letter-spacing: 0 !important;
        white-space: nowrap !important;
        min-width: 0 !important;
      }
      [data-antcv-section-title-211][data-antcv-title-align="left"] { text-align: left !important; }
      [data-antcv-section-title-211][data-antcv-title-align="center"] { text-align: center !important; }
      [data-antcv-section-title-211][data-antcv-title-align="right"] { text-align: right !important; }
      [data-antcv-section-title-211][data-antcv-title-align="justify"] { text-align: justify !important; }
      [data-antcv-section-title-211][data-antcv-title-align="justify"]::after { content: ""; display: inline-block; width: 100%; }

      [data-antcv-cand-title-211="1"] {
        color: transparent !important;
        font-size: 0 !important;
        line-height: 1.05 !important;
        overflow: visible !important;
      }
      [data-antcv-cand-title-211="1"]::before {
        content: "CAND. ▾" !important;
        color: ${TITLE_COLOR} !important;
        font-size: 15px !important;
        font-weight: 800 !important;
        line-height: 1.05 !important;
        font-family: inherit !important;
        letter-spacing: 0 !important;
      }

      [data-antcv-panel-211] button[data-antcv-panel-label-211] {
        font-size: 0 !important;
        white-space: nowrap !important;
        box-sizing: border-box !important;
        min-width: 0 !important;
        width: auto !important;
        height: 24px !important;
        min-height: 24px !important;
        padding: 2px 7px !important;
        border-radius: 5px !important;
        overflow: hidden !important;
      }
      [data-antcv-panel-211] button[data-antcv-panel-label-211]::after {
        content: attr(data-antcv-panel-label-211) !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
      }
      [data-antcv-panel-211] button[data-antcv-panel-action-211="undo"] { order: 10 !important; }
      [data-antcv-panel-211] button[data-antcv-panel-action-211="fit"] { order: 20 !important; }
      [data-antcv-panel-211] button[data-antcv-panel-action-211="comp"] { order: 30 !important; min-width: 31px !important; }
      [data-antcv-panel-211] button[data-antcv-panel-action-211="enr"] { order: 40 !important; }
      [data-antcv-panel-211] button[data-antcv-panel-action-211="cjlr"] { order: 45 !important; border-color: ${TITLE_COLOR} !important; color: #00746E !important; background: rgba(1, 183, 187, 0.08) !important; }
      [data-antcv-panel-211] button[data-antcv-panel-action-211="add"] { order: 50 !important; }

      [data-antcv-publications-row="1"] button[data-antcv-pub-injected] {
        width: 23px !important;
        min-width: 23px !important;
        height: 23px !important;
        min-height: 23px !important;
        padding: 1px 3px !important;
        margin-left: 3px !important;
        font-size: 0 !important;
        line-height: 1 !important;
        border-radius: 5px !important;
        box-sizing: border-box !important;
      }
      [data-antcv-publications-row="1"] button[data-antcv-pub-injected]::after {
        content: attr(data-antcv-panel-label-211) !important;
        font-size: 12px !important;
        line-height: 1 !important;
        font-weight: 700 !important;
      }
      [data-antcv-publications-row="1"] button[data-antcv-pub-injected="comp"] {
        border-color: #8a3ffc !important;
        color: #7b2ff2 !important;
        background: #fff !important;
      }
      [data-antcv-publications-row="1"] button[data-antcv-pub-injected="enr"] {
        border-color: #00a86b !important;
        color: #00a86b !important;
        background: #fff !important;
      }
      [data-antcv-publications-row="1"] button[data-antcv-pub-mini-kind="enr"] { order: 30 !important; }
      [data-antcv-publications-row="1"] button[data-antcv-pub-mini-kind="comp"] { order: 35 !important; }


      [data-antcv-experience-role-card="1"] button[data-antcv-role-content-cjlr="1"] {
        width: 28px !important;
        min-width: 28px !important;
        height: 24px !important;
        min-height: 24px !important;
        padding: 1px 5px !important;
        margin-left: 4px !important;
        border: 1px solid #01B7BB !important;
        border-radius: 5px !important;
        background: rgba(1, 183, 187, 0.08) !important;
        color: #00746E !important;
        font-size: 0 !important;
        line-height: 1 !important;
        box-sizing: border-box !important;
      }
      [data-antcv-experience-role-card="1"] button[data-antcv-role-content-cjlr="1"]::after {
        content: attr(data-antcv-panel-label-211) !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        line-height: 1 !important;
      }
      [data-antcv-role-content-align="justify"] { text-align: justify !important; }
      [data-antcv-role-content-align="center"] { text-align: center !important; }
      [data-antcv-role-content-align="left"] { text-align: left !important; }
      [data-antcv-role-content-align="right"] { text-align: right !important; }

      @media (max-width: 900px), (pointer: coarse) {
        [data-antcv-section-title-211],
        [data-antcv-cand-title-211="1"]::before { font-size: 15px !important; }
        [data-antcv-panel-211] { flex-wrap: nowrap !important; gap: 5px !important; }
        [data-antcv-panel-211] button[data-antcv-panel-label-211] {
          height: 24px !important;
          min-height: 24px !important;
          padding-left: 7px !important;
          padding-right: 7px !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }



  // ─── Professional Experience per-role content CJLR ───────────────
  // Adds a CJLR cycler to each role card in the editor. It targets only
  // the role content textarea/editable body, not the title/company/year
  // heading inputs.
  const ROLE_ALIGN_KEY = 'antcv.experienceRoleContentAlignment.v1';
  const ROLE_ALIGNMENTS = ['center', 'justify', 'left', 'right'];
  const ROLE_GLYPHS = { left: '⇤', center: '↔', right: '⇥', justify: '☰' };

  function readRoleAlignMap() {
    try {
      const raw = localStorage.getItem(ROLE_ALIGN_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      return obj && typeof obj === 'object' ? obj : {};
    } catch (_) { return {}; }
  }
  function writeRoleAlignMap(map) { try { localStorage.setItem(ROLE_ALIGN_KEY, JSON.stringify(map || {})); } catch (_) {} }
  function roleAlignKey(card, idx) {
    const titleInput = Array.from(card.querySelectorAll('input')).find(function (i) { return /role title/i.test(i.value || i.placeholder || ''); });
    const companyInput = Array.from(card.querySelectorAll('input')).find(function (i) { return /company/i.test(i.value || i.placeholder || ''); });
    const yearsInput = Array.from(card.querySelectorAll('input')).find(function (i) { return /yyyy|year/i.test(i.value || i.placeholder || ''); });
    const seed = [titleInput && titleInput.value, companyInput && companyInput.value, yearsInput && yearsInput.value].map(clean).join('|');
    return seed && seed !== '||' ? seed : ('role-' + idx);
  }
  function readRoleAlign(key) {
    const v = readRoleAlignMap()[key];
    return ROLE_ALIGNMENTS.indexOf(v) >= 0 ? v : 'left';
  }
  function writeRoleAlign(key, value) {
    const map = readRoleAlignMap();
    map[key] = value;
    writeRoleAlignMap(map);
    try { window.dispatchEvent(new CustomEvent('antcv:experience-role-content-align-changed', { detail: { key, alignment: value } })); } catch (_) {}
  }
  function nextRoleAlign(v) {
    const i = ROLE_ALIGNMENTS.indexOf(v);
    return ROLE_ALIGNMENTS[(i < 0 ? 0 : i + 1) % ROLE_ALIGNMENTS.length];
  }
  function isLikelyRoleCard(el) {
    if (!el || !el.querySelector) return false;
    if (!el.querySelector('textarea, [contenteditable="true"], [data-edit-path]')) return false;
    const text = clean(el.textContent);
    return /\[Role title\]|Role title/i.test(text) && /Company name|YYYY/i.test(text);
  }
  function findRoleCards() {
    const cards = [];
    Array.from(document.querySelectorAll('textarea')).forEach(function (ta) {
      let p = ta.parentElement;
      for (let i = 0; i < 7 && p; i++, p = p.parentElement) {
        if (isLikelyRoleCard(p)) {
          if (cards.indexOf(p) < 0) cards.push(p);
          break;
        }
      }
    });
    return cards;
  }
  function contentTargetsForRole(card) {
    const targets = [];
    Array.from(card.querySelectorAll('textarea')).forEach(function (t) { targets.push(t); });
    Array.from(card.querySelectorAll('[contenteditable="true"], [data-edit-path]')).forEach(function (t) {
      if (t.matches && t.matches('input, select, button')) return;
      if (t.closest && t.closest('button')) return;
      targets.push(t);
    });
    return targets.filter(function (t, i, arr) { return arr.indexOf(t) === i; });
  }
  function applyRoleContentAlign(card, alignment) {
    contentTargetsForRole(card).forEach(function (t) {
      t.style.textAlign = alignment === 'justify' ? 'justify' : alignment;
      t.setAttribute('data-antcv-role-content-align', alignment);
    });
  }
  function refreshRoleCjlr(btn, alignment) {
    btn.type = 'button';
    btn.setAttribute('data-antcv-role-content-cjlr', '1');
    btn.setAttribute('data-antcv-panel-label-211', ROLE_GLYPHS[alignment] || ROLE_GLYPHS.left);
    btn.title = 'Role content alignment: ' + alignment + ' (click to cycle)';
    btn.setAttribute('aria-label', btn.title);
    btn.style.order = '44';
  }
  function findRoleControlsParent(card) {
    const onBtn = Array.from(card.querySelectorAll('button')).find(function (b) { return /^\s*ON\s*$/i.test(b.textContent || '') || /toggle/i.test(b.title || ''); });
    if (onBtn && onBtn.parentElement) return onBtn.parentElement;
    const btn = card.querySelector('button');
    return btn ? btn.parentElement : card;
  }
  function ensureRoleContentCjlr() {
    // v1.40.227: role-level CJLR is owned by antcv-experience-role-cjlr-227.js.
    // Remove older panel-injected controls so the first role does not get a dead duplicate.
    document.querySelectorAll('button[data-antcv-role-content-cjlr="1"]:not([data-antcv-role-cjlr-227="1"])').forEach(function(btn){
      try { btn.remove(); } catch (_) { btn.style.display = 'none'; }
    });
  }

  let cssReady = false;
  let pending = false;
  function applyAll() {
    seedDefaults();
    LOCS.forEach(applyPanel);
    ensurePublicationsMiniButtons();
    ensureRoleContentCjlr();
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try {
        if (!cssReady) { injectCss(); cssReady = true; }
        installHeadlineClickGuard();
        applyAll();
      } catch (e) {
        try { console.warn('[section-panel-211] failed:', e && e.message); } catch (_) {}
      }
    });
  }
  function start() {
    schedule();
    [80, 180, 400, 900, 1600, 2600, 4000].forEach(function (ms) { setTimeout(schedule, ms); });
    try {
      const mo = new MutationObserver(schedule);
      mo.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'title', 'data-antcv-panel-label-211', 'data-antcv-panel-action-211', 'data-antcv-align-cycler']
      });
    } catch (_) {}
    setInterval(schedule, 1400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AntcvSectionPanel211 = { version: VERSION, _applyAll: applyAll, _readAlign: readAlign, _writeAlign: writeAlign };
})();
