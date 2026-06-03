/* AntCV section headline controls + role content CJLR (v1.40.351)
 * - Defaults: CAND. center, SIDEBAR center, MAIN justify.
 * - Keeps user-changed headline alignment after first click.
 * - Button order in all section headers: Undo, Fit, Comp-icon, Enr., CJLR, +.
 * - CJLR affects the section headline only.
 *
 * v1.40.351 — STOP injecting Publications mini-buttons
 * ----------------------------------------------------
 * Publications & Patent controls are owned by
 * antcv-publications-strict-row-layout-273.js, which mounts its own
 * page / CJLR / compress / enhance buttons (data-antcv-pub273-control)
 * on the per-publication item rows. 211 used to ALSO inject a pair of
 * Enhance/Compress buttons (data-antcv-pub-injected) onto the
 * Publications SECTION-HEADER row. Those were redundant and unwanted —
 * and because they sit on the section header (outside 273's panelRoot,
 * which requires "← back" + "+ publication" text) 273's own purge()
 * never removed them. They lingered as two empty CSS-glyph buttons.
 *
 * Fix: 211 no longer injects them. ensurePublicationsMiniButtons() is
 * replaced by removePublicationsMiniButtons(), which deletes any
 * data-antcv-pub-injected / data-antcv-pub-mini-kind button that 211 (or
 * an older version) left on the Publications section-header row. 273
 * remains the sole owner of Publications controls.
 *
 * v1.40.350 — FLICKER FIX (retained)
 * ----------------------------------
 * Idempotent setAttr/setOrder/setTextAlign writers + an `applying` guard
 * + mo.takeRecords() so the MutationObserver never re-fires on our own
 * no-op writes. This stopped the endless re-write/flicker loop.
 */
(function () {
  'use strict';

  const VERSION = '1.40.351';
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

  // ---- idempotent DOM writers (v1.40.350): never write an unchanged value,
  // so the MutationObserver isn't re-triggered by our own no-op sweeps. ----
  function setAttr(el, name, val) {
    if (!el) return false;
    const cur = el.getAttribute(name);
    if (cur === val) return false;
    el.setAttribute(name, val);
    return true;
  }
  function setOrder(el, val) {
    if (!el) return false;
    const v = String(val);
    if (el.style.order === v) return false;
    el.style.order = v;
    return true;
  }
  function setTextAlign(el, val) {
    if (!el) return false;
    const v = val === 'justify' ? 'justify' : val;
    if (el.style.textAlign === v) return false;
    el.style.textAlign = v;
    return true;
  }

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

  // Attribute-first action classification. Reads stable data-attributes
  // before any text heuristic so CSS-glyph (empty-text) buttons classify
  // correctly.
  function actionAttr(btn) {
    return btn.getAttribute('data-antcv-panel-action-211')
        || btn.getAttribute('data-antcv-panel-action-208')
        || btn.getAttribute('data-antcv-panel-action-207')
        || btn.getAttribute('data-antcv-panel-action-206')
        || btn.getAttribute('data-antcv-main-action')
        || '';
  }

  function classify(btn) {
    const prev = actionAttr(btn);
    const isCjlr = btn.getAttribute('data-antcv-headline-cjlr') === '1' || btn.getAttribute('data-antcv-align-cycler') === 'headline' || btn.getAttribute('data-antcv-align-cycler') === 'panel-default';
    // Stable-attribute fast paths first.
    if (isCjlr || prev === 'cjlr') return { key: 'cjlr', order: 45, label: GLYPHS.left };
    if (prev === 'undo') return { key: 'undo', order: 10, label: '↶' };
    if (prev === 'fit') return { key: 'fit', order: 20, label: '🎯 Fit' };
    if (prev === 'comp') return { key: 'comp', order: 30, label: '↹' };
    if (prev === 'enr') return { key: 'enr', order: 40, label: '✨ Enr.' };
    if (prev === 'add') return { key: 'add', order: 50, label: '+' };
    // Text/title fallback for not-yet-tagged native buttons.
    const title = low(btn.getAttribute('title'));
    const text = low(btn.textContent || btn.innerText);
    if (title.indexOf('undo') >= 0 || /undo|↶|↩/.test(text)) return { key: 'undo', order: 10, label: '↶' };
    if (title.indexOf('make it fit') >= 0 || title.indexOf('fit it') >= 0 || title.indexOf('orphan-cleanup') >= 0 || /\bfit\b/.test(text) || /\bfix\b/.test(text)) return { key: 'fit', order: 20, label: '🎯 Fit' };
    if (title.indexOf('compress') >= 0 || /comp\.?|compress|↹|⇥|→/.test(text)) return { key: 'comp', order: 30, label: '↹' };
    if (title.indexOf('enrich') >= 0 || title.indexOf('enhance') >= 0 || /enr\.?|enrich|✨/.test(text)) return { key: 'enr', order: 40, label: '✨ Enr.' };
    if (title.indexOf('add a ') >= 0 || title === 'add' || /^\+/.test(text) || text.indexOf('add') >= 0) return { key: 'add', order: 50, label: '+' };
    return null;
  }

  function refreshCjlr(btn, loc) {
    const cur = readAlign(loc);
    if (btn.type !== 'button') btn.type = 'button';
    setAttr(btn, 'data-antcv-headline-cjlr', '1');
    setAttr(btn, 'data-antcv-align-cycler', 'headline');
    setAttr(btn, 'data-antcv-panel-default-loc', loc);
    setAttr(btn, 'data-antcv-panel-action-211', 'cjlr');
    setAttr(btn, 'data-antcv-panel-action-208', 'cjlr');
    setAttr(btn, 'data-antcv-panel-action-207', 'cjlr');
    setAttr(btn, 'data-antcv-panel-label-211', GLYPHS[cur] || GLYPHS.left);
    setAttr(btn, 'data-antcv-panel-label-208', GLYPHS[cur] || GLYPHS.left);
    setAttr(btn, 'data-antcv-panel-label-207', GLYPHS[cur] || GLYPHS.left);
    setAttr(btn, 'data-antcv-title-align-current', cur);
    const t = titleForLoc(loc) + ' headline alignment: ' + cur + ' (click to cycle)';
    if (btn.title !== t) btn.title = t;
    setAttr(btn, 'aria-label', t);
    setOrder(btn, 45);
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
      setAttr(a, 'data-antcv-cand-title-211', '1');
      setAttr(a, 'data-antcv-cand-title-208', '1');
      setAttr(a, 'aria-label', 'CAND.');
    }
  }

  function applyTitleAlignment(loc) {
    const a = anchor(loc);
    const r = row(loc);
    if (!a || !r) return;
    const cur = readAlign(loc);
    setAttr(r, 'data-antcv-title-align-row', cur);
    setAttr(a, 'data-antcv-title-align', cur);
    setTextAlign(a, cur);
  }

  function applyPanel(loc) {
    const a = anchor(loc);
    const r = row(loc);
    if (!a || !r) return;
    setAttr(r, 'data-antcv-panel-211', loc);
    setAttr(r, 'data-antcv-panel-208', loc);
    setAttr(a, 'data-antcv-section-title-211', loc);
    setAttr(a, 'data-antcv-section-title-208', loc);
    applyTitleText(loc);
    ensureHeadlineCjlr(loc);
    applyTitleAlignment(loc);

    Array.from(r.querySelectorAll(':scope button')).forEach(function (btn) {
      const meta = classify(btn);
      if (!meta) return;
      if (meta.key === 'cjlr') { refreshCjlr(btn, loc); return; }
      setAttr(btn, 'data-antcv-panel-action-211', meta.key);
      setAttr(btn, 'data-antcv-panel-label-211', meta.label);
      setAttr(btn, 'data-antcv-panel-action-208', meta.key);
      setAttr(btn, 'data-antcv-panel-label-208', meta.label);
      setOrder(btn, meta.order);
      if (loc === 'topbar' && meta.key === 'fit') {
        setAttr(btn, 'data-antcv-fit-scope', 'topbar');
        setAttr(btn, 'data-antcv-cand-fit-211', '1');
        setAttr(btn, 'data-antcv-cand-fit-208', '1');
        setAttr(btn, 'aria-label', 'Fit CAND. items');
        setAttr(btn, 'data-antcv-action', 'fit-candidate-items');
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

  // ─── Publications mini-button REMOVAL (v1.40.351) ───────────────
  // 211 no longer injects Enhance/Compress onto the Publications row.
  // Remove any data-antcv-pub-injected / data-antcv-pub-mini-kind buttons
  // that 211 (or an older version of it) left behind anywhere in the DOM.
  // 273 owns Publications controls now.
  function removePublicationsMiniButtons() {
    var stale = document.querySelectorAll(
      'button[data-antcv-pub-injected],button[data-antcv-pub-mini-kind]'
    );
    for (var i = 0; i < stale.length; i++) {
      var b = stale[i];
      // Defensive: never touch 273's own controls (different attribute).
      if (b.hasAttribute('data-antcv-pub273-control')) continue;
      try { b.remove(); } catch (_) { try { b.style.display = 'none'; } catch (__) {} }
    }
    // Drop the row marker 211 previously set so nothing keys off it.
    var marked = document.querySelectorAll('[data-antcv-publications-row="1"]');
    for (var j = 0; j < marked.length; j++) {
      marked[j].removeAttribute('data-antcv-publications-row');
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

  // ─── Professional Experience per-role content CJLR cleanup ───
  function ensureRoleContentCjlr() {
    // role-level CJLR is owned by antcv-experience-role-cjlr-227.js.
    // Remove older panel-injected controls so the first role does not get a dead duplicate.
    document.querySelectorAll('button[data-antcv-role-content-cjlr="1"]:not([data-antcv-role-cjlr-227="1"])').forEach(function(btn){
      try { btn.remove(); } catch (_) { btn.style.display = 'none'; }
    });
  }

  let cssReady = false;
  let pending = false;
  // v1.40.350: suppress the observer while WE mutate, so our own writes
  // never re-trigger a sweep.
  let mo = null;
  let applying = false;
  function applyAll() {
    seedDefaults();
    LOCS.forEach(applyPanel);
    removePublicationsMiniButtons();
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
        applying = true;
        if (mo) mo.takeRecords();   // drop records accumulated before this sweep
        applyAll();
      } catch (e) {
        try { console.warn('[section-panel-211] failed:', e && e.message); } catch (_) {}
      } finally {
        // Let the microtask/layout settle, then clear our own mutation records
        // and re-enable observer reactions.
        if (mo) { try { mo.takeRecords(); } catch (_) {} }
        applying = false;
      }
    });
  }
  function start() {
    schedule();
    [80, 180, 400, 900, 1600, 2600, 4000].forEach(function (ms) { setTimeout(schedule, ms); });
    try {
      mo = new MutationObserver(function () {
        // Ignore mutations caused by our own sweep.
        if (applying) { try { mo.takeRecords(); } catch (_) {} return; }
        schedule();
      });
      mo.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'title', 'data-antcv-panel-label-211', 'data-antcv-panel-action-211', 'data-antcv-align-cycler']
      });
    } catch (_) {}
    // Lower-frequency safety net; idempotent writers make this a near-no-op.
    setInterval(schedule, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AntcvSectionPanel211 = { version: VERSION, _applyAll: applyAll, _readAlign: readAlign, _writeAlign: writeAlign };
})();
