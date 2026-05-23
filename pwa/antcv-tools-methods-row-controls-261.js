/* AntCV Tools & Methods row controls (v1.40.261)
 * Actually adds per-line Page and CJLR controls in the TOOLS & METHODS sidebar subsubsection.
 *
 * DOM/function contract
 * ---------------------
 * - Page writes localStorage['antcv:itemPages'][sectionId]['<rowIndex>'] = 1..4.
 *   Existing preview/DOCX page renderers consume this map.
 * - CJLR writes localStorage['antcvItemAlignment'][sectionId]['items.<rowIndex>']
 *   and a numeric fallback key for older preview/export code.
 * - The controls are scoped only to the open TOOLS & METHODS editor panel.
 * - Native buttons remain connected to their own React handlers: hide/show, delete,
 *   move up/down, compress and enhance.
 */
(function () {
  'use strict';

  const VERSION = '1.40.261';
  if (window.__antcvToolsMethodsRowControls === VERSION) return;
  window.__antcvToolsMethodsRowControls = VERSION;

  const ALIGN_KEY = 'antcvItemAlignment';
  const PAGE_KEY = 'antcv:itemPages';
  const SECTIONS_KEY = 'sections';
  const ALIGNMENTS = ['center', 'justify', 'left', 'right'];
  const ICON = { left: '⇤', center: '↔', justify: '☰', right: '⇥' };
  const LABEL = { left: 'Left', center: 'Center', justify: 'Justify', right: 'Right' };

  function safeParse(raw, fallback) { try { if (!raw) return fallback; const v = JSON.parse(raw); return v && typeof v === 'object' ? v : fallback; } catch (_) { return fallback; } }
  function readJson(key) { return safeParse(localStorage.getItem(key), {}); }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {} }
  function activeDoc() { try { const d = localStorage.getItem('doc'); return (d === 'cl' || d === 'cv') ? d : 'cv'; } catch (_) { return 'cv'; } }
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return norm(s).toLowerCase(); }
  function itemPath(index) { return 'items.' + index; }
  function cssEscape(s) { if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(s)); return String(s).replace(/["\\]/g, '\\$&'); }

  function dispatchUpdate(source, detail) {
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: Object.assign({ source }, detail || {}) })); } catch (_) {}
    try { window.dispatchEvent(new Event('input')); } catch (_) {}
  }

  function readSections() {
    const all = safeParse(localStorage.getItem(SECTIONS_KEY), {});
    const list = all && all[activeDoc()];
    return Array.isArray(list) ? list : [];
  }
  function isToolsMethodsSection(s) {
    const txt = low((s && (s.type || '')) + ' ' + (s && (s.title || '')));
    return txt.indexOf('tools') >= 0 && txt.indexOf('methods') >= 0;
  }
  function findToolsMethodsSection() {
    const sections = readSections();
    return sections.find(function (s) { return s && s.loc === 'sidebar' && isToolsMethodsSection(s); }) ||
      sections.find(isToolsMethodsSection) || null;
  }

  function getAlign(sid, index) {
    const bucket = readJson(ALIGN_KEY)[sid] || {};
    const v = bucket[itemPath(index)] || bucket[String(index)] || 'left';
    return ALIGNMENTS.indexOf(v) >= 0 ? v : 'left';
  }
  function setAlign(sid, index, value) {
    const map = readJson(ALIGN_KEY);
    if (!map[sid] || typeof map[sid] !== 'object') map[sid] = {};
    map[sid][itemPath(index)] = value;
    map[sid][String(index)] = value;
    writeJson(ALIGN_KEY, map);
    dispatchUpdate('tools-methods-align', { sid: sid, index: index, alignment: value });
  }
  function getPage(sid, index) {
    const bucket = readJson(PAGE_KEY)[sid] || {};
    const n = Number(bucket[String(index)] || bucket[itemPath(index)] || 1);
    return Number.isFinite(n) && n >= 1 && n <= 4 ? (n | 0) : 1;
  }
  function setPage(sid, index, value) {
    const map = readJson(PAGE_KEY);
    if (!map[sid] || typeof map[sid] !== 'object') map[sid] = {};
    map[sid][String(index)] = value;
    writeJson(PAGE_KEY, map);
    dispatchUpdate('tools-methods-page', { sid: sid, index: index, page: value });
  }

  function ownText(el) {
    return norm(Array.from(el.childNodes || []).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent || ''; }).join(' '));
  }
  function looksLikeHeader(el) {
    const own = low(ownText(el));
    const all = low(el.textContent || '');
    if (own.indexOf('tools & methods') < 0 && all.indexOf('tools & methods') < 0) return false;
    if (all.indexOf('cv preview') >= 0 || all.indexOf('docx') >= 0) return false;
    let p = el.parentElement;
    for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
      const pt = low(p.textContent || '');
      if (pt.indexOf('cv preview') >= 0 || pt.indexOf('docx') >= 0) return false;
      if (pt.indexOf('← back') >= 0 && (pt.indexOf('+ item') >= 0 || pt.indexOf('+ group heading') >= 0)) return true;
    }
    return /\(sidebar\)/i.test(el.textContent || '');
  }
  function panelRoot() {
    const headers = Array.from(document.querySelectorAll('h1,h2,h3,div,span')).filter(looksLikeHeader);
    for (const h of headers) {
      let p = h;
      for (let i = 0; i < 8 && p; i++, p = p.parentElement) {
        if (!p || p === document.body) break;
        const txt = low(p.textContent || '');
        if (txt.indexOf('cv preview') >= 0 || txt.indexOf('docx') >= 0) continue;
        if (txt.indexOf('tools & methods') >= 0 && txt.indexOf('← back') >= 0 && (txt.indexOf('+ item') >= 0 || txt.indexOf('+ group heading') >= 0)) return p;
      }
    }
    return null;
  }

  function isDeleteButton(btn) {
    const t = low((btn && (btn.textContent || btn.innerText || btn.title || btn.getAttribute('aria-label'))) || '');
    return t === '×' || t === 'x' || t.indexOf('delete') >= 0 || t.indexOf('remove') >= 0;
  }
  function isMoveButton(btn) {
    const t = low((btn && (btn.textContent || btn.innerText || btn.title || btn.getAttribute('aria-label'))) || '');
    return /▲|▼|up|down|move/.test(t);
  }
  function isNativeActionButton(btn) {
    const t = low((btn && (btn.textContent || btn.innerText || btn.title || btn.getAttribute('aria-label'))) || '');
    return isDeleteButton(btn) || isMoveButton(btn) || /👁|eye|hide|show|✨|enhance|compress|→|⇥/.test(t);
  }

  function likelyRows(root) {
    if (!root) return [];
    const candidates = [];
    Array.from(root.querySelectorAll('div,li,tr')).forEach(function (el) {
      if (el.getAttribute('data-antcv-tools-row') === '1') { candidates.push(el); return; }
      if (el.closest('[data-antcv-panel-211]')) return;
      if (el.closest('[data-antcv-pub-row="1"],[data-antcv-edu-row="1"],[data-antcv-cert-row="1"],[data-antcv-addinfo-row="1"]')) return;
      const fields = el.querySelectorAll('input,textarea,[contenteditable="true"]');
      if (!fields.length) return;
      const txt = low(el.textContent || '');
      if (txt.indexOf('tools & methods') >= 0 && (txt.indexOf('+ item') >= 0 || txt.indexOf('+ group heading') >= 0)) return;
      if (txt.indexOf('+ item') >= 0 || txt.indexOf('+ group heading') >= 0) return;
      const buttons = Array.from(el.querySelectorAll('button'));
      if (buttons.some(isNativeActionButton)) candidates.push(el);
    });
    return candidates.filter(function (el, idx) {
      const fieldCount = el.querySelectorAll('input,textarea,[contenteditable="true"]').length;
      const nested = candidates.some(function (other) {
        return other !== el && other.contains(el) && other.querySelectorAll('input,textarea,[contenteditable="true"]').length <= fieldCount;
      });
      return !nested && candidates.indexOf(el) === idx;
    });
  }

  function makeButton(kind) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-tools-control', kind);
    b.setAttribute('data-antcv-panel-doc', 'Tools & Methods row control');
    const purple = kind === 'cjlr';
    Object.assign(b.style, {
      width: kind === 'page' ? '30px' : '24px', minWidth: kind === 'page' ? '30px' : '24px',
      height: '22px', minHeight: '22px', padding: '0', margin: '0 1px',
      border: purple ? '1px solid #7b2ff2' : '1px solid #01B7BB',
      borderRadius: '5px', background: purple ? 'rgba(123,47,242,.06)' : 'rgba(1,183,187,.08)',
      color: purple ? '#7b2ff2' : '#00746E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: kind === 'page' ? '10px' : '12px', fontWeight: '700', lineHeight: '1', cursor: 'pointer',
      boxSizing: 'border-box', flex: '0 0 auto'
    });
    return b;
  }
  function paintPage(btn, sid, index) {
    const p = getPage(sid, index);
    btn.textContent = '📄 ' + p;
    btn.title = 'Start this Tools & Methods row on page ' + p + '. Click to cycle page 1 to 4.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-tools-row-index', String(index));
    btn.setAttribute('data-antcv-tools-sid', sid);
    btn.setAttribute('data-antcv-tools-current-page', String(p));
  }
  function paintAlign(btn, sid, index) {
    const a = getAlign(sid, index);
    btn.textContent = ICON[a] || ICON.left;
    btn.title = 'Tools & Methods row alignment: ' + (LABEL[a] || a) + '. Click to cycle Center, Justify, Left, Right.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-tools-row-index', String(index));
    btn.setAttribute('data-antcv-tools-sid', sid);
    btn.setAttribute('data-antcv-tools-current-align', a);
  }

  function controlsHost(row) {
    let host = row.querySelector(':scope [data-antcv-tools-controls-host="1"]');
    if (host) return host;
    host = document.createElement('span');
    host.setAttribute('data-antcv-tools-controls-host', '1');
    Object.assign(host.style, { display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '3px', whiteSpace: 'nowrap', verticalAlign: 'middle', flex: '0 0 auto' });
    const buttons = Array.from(row.querySelectorAll(':scope button'));
    const firstMove = buttons.find(isMoveButton);
    const del = buttons.find(isDeleteButton);
    // Put Page/CJLR before movement controls when present; otherwise before delete, otherwise at end.
    if (firstMove && firstMove.parentElement) firstMove.parentElement.insertBefore(host, firstMove);
    else if (del && del.parentElement) del.parentElement.insertBefore(host, del);
    else row.appendChild(host);
    return host;
  }

  function applyEditorAlignment(row, align) {
    row.setAttribute('data-antcv-tools-editor-align', align);
    row.querySelectorAll('input,textarea,[contenteditable="true"]').forEach(function (field) {
      field.style.textAlign = align;
      field.setAttribute('data-antcv-tools-field-align', align);
    });
  }
  function applyPreview(sid) {
    const sec = document.querySelector('[data-sid="' + cssEscape(sid) + '"]');
    if (!sec) return;
    const map = readJson(ALIGN_KEY)[sid] || {};
    Array.from(sec.querySelectorAll('[data-antcv-row-path^="items."]')).forEach(function (el) {
      const m = String(el.getAttribute('data-antcv-row-path') || '').match(/^items\.(\d+)/);
      if (!m) return;
      const idx = Number(m[1]);
      const a = map[itemPath(idx)] || map[String(idx)];
      if (ALIGNMENTS.indexOf(a) < 0) return;
      el.style.textAlign = a;
      el.setAttribute('data-antcv-tools-preview-align', a);
    });
  }

  function cleanupForeign(root) {
    if (!root) return;
    root.querySelectorAll('[data-antcv-pub-controls-host="1"],[data-antcv-edu-controls-host="1"],[data-antcv-cert-controls-host="1"],[data-antcv-addinfo-controls-host="1"]').forEach(function (el) { el.remove(); });
  }

  function wireRow(row, sid, index) {
    row.setAttribute('data-antcv-tools-row', '1');
    row.setAttribute('data-antcv-tools-row-index', String(index));
    const host = controlsHost(row);
    Array.from(host.querySelectorAll('button[data-antcv-tools-control]')).slice(2).forEach(function (b) { b.remove(); });

    let pageBtn = host.querySelector(':scope [data-antcv-tools-control="page"]');
    if (!pageBtn) { pageBtn = makeButton('page'); host.appendChild(pageBtn); }
    paintPage(pageBtn, sid, index);

    let alignBtn = host.querySelector(':scope [data-antcv-tools-control="cjlr"]');
    if (!alignBtn) { alignBtn = makeButton('cjlr'); host.appendChild(alignBtn); }
    paintAlign(alignBtn, sid, index);

    pageBtn.style.order = '10';
    alignBtn.style.order = '20';
    applyEditorAlignment(row, getAlign(sid, index));

    pageBtn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      const next = (getPage(sid, index) % 4) + 1;
      setPage(sid, index, next);
      paintPage(pageBtn, sid, index);
    };
    alignBtn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      const cur = getAlign(sid, index);
      const next = ALIGNMENTS[(ALIGNMENTS.indexOf(cur) + 1) % ALIGNMENTS.length] || 'center';
      setAlign(sid, index, next);
      paintAlign(alignBtn, sid, index);
      applyEditorAlignment(row, next);
      applyPreview(sid);
    };
  }

  function run() {
    const root = panelRoot();
    if (!root) return;
    cleanupForeign(root);
    const sec = findToolsMethodsSection();
    if (!sec || !sec.id) return;
    const rows = likelyRows(root);
    rows.forEach(function (row, idx) { wireRow(row, sec.id, idx); });
    applyPreview(sec.id);
  }

  function injectCss() {
    if (document.getElementById('antcv-tools-methods-row-controls-261-css')) return;
    const s = document.createElement('style');
    s.id = 'antcv-tools-methods-row-controls-261-css';
    s.textContent = `
      [data-antcv-tools-row="1"] {
        display: flex !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        gap: 3px !important;
        overflow: visible !important;
      }
      [data-antcv-tools-row="1"] input,
      [data-antcv-tools-row="1"] textarea,
      [data-antcv-tools-row="1"] [contenteditable="true"] {
        min-width: 0 !important;
        flex-shrink: 1 !important;
      }
      [data-antcv-tools-row="1"] input:nth-of-type(1) { flex: 0 1 96px !important; }
      [data-antcv-tools-row="1"] input:nth-of-type(2) { flex: 1 1 165px !important; }
      [data-antcv-tools-row="1"] button { flex: 0 0 auto !important; }
      [data-antcv-tools-controls-host="1"] { order: 55 !important; }
      [data-antcv-tools-controls-host="1"] button[data-antcv-tools-control] { font-family: inherit !important; }
      [data-antcv-tools-field-align="justify"] { text-align: justify !important; }
      [data-antcv-tools-field-align="center"] { text-align: center !important; }
      [data-antcv-tools-field-align="left"] { text-align: left !important; }
      [data-antcv-tools-field-align="right"] { text-align: right !important; }
      [data-antcv-tools-preview-align="justify"] { text-align: justify !important; }
      [data-antcv-tools-preview-align="center"] { text-align: center !important; }
      [data-antcv-tools-preview-align="left"] { text-align: left !important; }
      [data-antcv-tools-preview-align="right"] { text-align: right !important; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  injectCss();
  run();
  [80, 180, 400, 900, 1600].forEach(function (ms) { setTimeout(run, ms); });
  try { new MutationObserver(function () { clearTimeout(window.__antcvToolsMethodsRowControlsTimer); window.__antcvToolsMethodsRowControlsTimer = setTimeout(run, 40); }).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  window.addEventListener('storage', run);
  window.addEventListener('antcv:sections-updated', function () { setTimeout(run, 0); });
})();
