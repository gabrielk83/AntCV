/* AntCV Education row controls (v1.40.257)
 * Adds per-row CJLR and page controls to the EDUCATION sidebar panel.
 * The native Education enhance button is preserved; this overlay must not inject
 * a second enhance button because the legacy enhance path can crash the app.
 *
 * DOM/function contract
 * ---------------------
 * - CJLR writes localStorage['antcvItemAlignment'][sectionId]['items.<rowIndex>']
 *   and mirrors the numeric key for older preview/export fallbacks.
 * - Page writes localStorage['antcv:itemPages'][sectionId]['<rowIndex>'] = 1..4.
 *   antcv-item-pages-render.js and antcv-docx-client.js already consume this map.
 * - No enhance button is injected here. The native Education enhance button remains
 *   the single enhance control for the row.
 * - No delete/X button is injected here. The native Education delete button remains
 *   the single delete control for the row.
 */
(function () {
  'use strict';

  const VERSION = '1.40.257';
  if (window.__antcvEducationRowControls === VERSION) return;
  window.__antcvEducationRowControls = VERSION;

  const ALIGN_KEY = 'antcvItemAlignment';
  const PAGE_KEY = 'antcv:itemPages';
  const SECTIONS_KEY = 'sections';
  const ALIGNMENTS = ['center', 'justify', 'left', 'right'];
  const ICON = { left: '⇤', center: '↔', justify: '☰', right: '⇥' };
  const LABEL = { left: 'Left', center: 'Center', justify: 'Justify', right: 'Right' };

  function safeParse(raw, fallback) {
    try {
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : fallback;
    } catch (_) { return fallback; }
  }
  function readJson(key) { return safeParse(localStorage.getItem(key), {}); }
  function writeJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {} }
  function activeDoc() { try { const d = localStorage.getItem('doc'); return (d === 'cl' || d === 'cv') ? d : 'cv'; } catch (_) { return 'cv'; } }
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return norm(s).toLowerCase(); }
  function itemPath(index) { return 'items.' + index; }
  function cssEscape(s) { if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(s)); return String(s).replace(/["\\]/g, '\\$&'); }

  function readSections() {
    const all = safeParse(localStorage.getItem(SECTIONS_KEY), {});
    const list = all && all[activeDoc()];
    return Array.isArray(list) ? list : [];
  }
  function findEducationSection() {
    const sections = readSections();
    return sections.find(function (s) { return s && s.loc === 'sidebar' && String(s.type || '') === 'education'; }) ||
      sections.find(function (s) { return s && /education/i.test(String(s.title || '')); }) || null;
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
    dispatchUpdate('education-align', { sid, index, alignment: value });
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
    dispatchUpdate('education-page', { sid, index, page: value });
  }

  function dispatchInput(el) {
    if (!el) return;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
  }
  function dispatchUpdate(source, detail) {
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: Object.assign({ source }, detail || {}) })); } catch (_) {}
    try { window.dispatchEvent(new Event('input')); } catch (_) {}
  }

  function makeButton(kind) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-edu-control', kind);
    b.setAttribute('data-antcv-panel-doc', 'Education row control');
    Object.assign(b.style, {
      width: '24px', minWidth: '24px', height: '22px', minHeight: '22px',
      padding: '0', margin: '0 1px', border: kind === 'enhance' ? '1px solid #19b982' : '1px solid #01B7BB',
      borderRadius: '5px', background: kind === 'enhance' ? 'rgba(25,185,130,.08)' : 'rgba(1,183,187,.08)',
      color: '#00746E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: '700', lineHeight: '1', cursor: 'pointer', boxSizing: 'border-box', flex: '0 0 auto'
    });
    return b;
  }
  function paintAlign(btn, sid, index) {
    const a = getAlign(sid, index);
    btn.textContent = ICON[a] || ICON.left;
    btn.title = 'Education row alignment: ' + (LABEL[a] || a) + '. Click to cycle Center, Justify, Left, Right.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-edu-row-index', String(index));
    btn.setAttribute('data-antcv-edu-sid', sid);
    btn.setAttribute('data-antcv-edu-current-align', a);
  }
  function paintPage(btn, sid, index) {
    const p = getPage(sid, index);
    btn.textContent = '📄 ' + p;
    btn.title = 'Start this Education row on page ' + p + '. Click to cycle page 1 to 4.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-edu-row-index', String(index));
    btn.setAttribute('data-antcv-edu-sid', sid);
    btn.setAttribute('data-antcv-edu-current-page', String(p));
  }
  function paintEnhance(btn, sid, index) {
    btn.textContent = '✨';
    btn.title = 'Enhance this Education row detail field.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-edu-row-index', String(index));
    btn.setAttribute('data-antcv-edu-sid', sid);
  }

  function isDeleteButton(btn) {
    const t = low((btn && (btn.textContent || btn.innerText || btn.title || btn.getAttribute('aria-label'))) || '');
    return t === '×' || t === 'x' || t.indexOf('delete') >= 0 || t.indexOf('remove') >= 0;
  }
  function isMoveButton(btn) {
    const t = low((btn && (btn.textContent || btn.innerText || btn.title || btn.getAttribute('aria-label'))) || '');
    return /▲|▼|up|down|move/.test(t);
  }

  function panelRoot() {
    const headers = Array.from(document.querySelectorAll('h1,h2,h3,div,span')).filter(function (el) {
      return /^education\b/i.test(norm(el.textContent || ''));
    });
    for (const h of headers) {
      let p = h;
      for (let i = 0; i < 7 && p; i++, p = p.parentElement) {
        if (!p || p === document.body) break;
        const txt = low(p.textContent);
        if (txt.indexOf('education') >= 0 && txt.indexOf('+ entry') >= 0) return p;
      }
    }
    return null;
  }

  function likelyRows(root) {
    if (!root) return [];
    const candidates = [];
    Array.from(root.querySelectorAll('div,li,tr')).forEach(function (el) {
      if (el.getAttribute('data-antcv-edu-row') === '1') { candidates.push(el); return; }
      if (el.closest('[data-antcv-panel-211]')) return;
      const fields = el.querySelectorAll('input,textarea,[contenteditable="true"]');
      if (fields.length < 2) return;
      const txt = low(el.textContent);
      if (txt.indexOf('education') >= 0 && txt.indexOf('+ entry') >= 0) return;
      if (txt.indexOf('+ entry') >= 0) return;
      const buttons = Array.from(el.querySelectorAll('button'));
      const hasDelete = buttons.some(isDeleteButton);
      const hasEye = buttons.some(function (b) { return /👁|eye|hide|show/.test(low(b.textContent || b.title || b.getAttribute('aria-label'))); });
      if ((hasDelete || hasEye) && buttons.length > 0) candidates.push(el);
    });
    return candidates.filter(function (el, idx) {
      const fieldCount = el.querySelectorAll('input,textarea,[contenteditable="true"]').length;
      const nested = candidates.some(function (other) {
        return other !== el && other.contains(el) && other.querySelectorAll('input,textarea,[contenteditable="true"]').length <= fieldCount;
      });
      return !nested && candidates.indexOf(el) === idx;
    });
  }

  function rowFields(row) { return Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')); }
  function fieldValue(el) { return el ? (el.value != null ? String(el.value) : String(el.textContent || '')) : ''; }
  function setFieldValue(el, value) {
    if (!el) return;
    if (el.value != null) el.value = value;
    else el.textContent = value;
    dispatchInput(el);
  }

  function controlsHost(row) {
    let host = row.querySelector(':scope [data-antcv-edu-controls-host="1"]');
    if (host) return host;
    host = document.createElement('span');
    host.setAttribute('data-antcv-edu-controls-host', '1');
    Object.assign(host.style, { display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '3px', whiteSpace: 'nowrap', verticalAlign: 'middle', flex: '0 0 auto' });

    const directButtons = Array.from(row.querySelectorAll(':scope button'));
    const del = directButtons.find(isDeleteButton);
    const firstMove = directButtons.find(isMoveButton);
    if (firstMove && firstMove.parentElement) firstMove.parentElement.insertBefore(host, firstMove);
    else if (del && del.parentElement) del.parentElement.insertBefore(host, del);
    else row.appendChild(host);
    return host;
  }

  function applyEditorAlignment(row, align) {
    row.setAttribute('data-antcv-edu-editor-align', align);
    rowFields(row).forEach(function (field) {
      field.style.textAlign = align;
      field.setAttribute('data-antcv-edu-field-align', align);
    });
  }
  function applyPreview(sid) {
    const sec = document.querySelector('[data-sid="' + cssEscape(sid) + '"]');
    if (!sec) return;
    const map = readJson(ALIGN_KEY)[sid] || {};
    const items = Array.from(sec.querySelectorAll('[data-antcv-row-path^="items."]'));
    const byIndex = [];
    items.forEach(function (el) {
      const m = String(el.getAttribute('data-antcv-row-path') || '').match(/^items\.(\d+)/);
      if (!m) return;
      const idx = Number(m[1]);
      if (!Number.isFinite(idx)) return;
      if (!byIndex[idx] || byIndex[idx].contains(el)) byIndex[idx] = el;
    });
    byIndex.forEach(function (el, idx) {
      const a = map[itemPath(idx)] || map[String(idx)];
      if (ALIGNMENTS.indexOf(a) < 0) return;
      el.style.textAlign = a;
      el.setAttribute('data-antcv-edu-preview-align', a);
      el.querySelectorAll('[data-antcv-editable-text], span, div, p, li').forEach(function (child) { child.style.textAlign = a; });
    });
  }

  function enhanceEducationRow(row) {
    const fields = rowFields(row);
    const degree = fieldValue(fields[0]).trim();
    const detailField = fields[1] || fields[0];
    const detail = fieldValue(detailField).trim();
    if (!detail || /^\[.*\]$/.test(detail)) return;
    let next = detail.replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
    if (degree && !/^\[.*\]$/.test(degree) && next.toLowerCase().indexOf(degree.toLowerCase()) < 0 && next.indexOf(' – ') < 0 && next.indexOf(' - ') < 0) {
      next = next.replace(/[.!?]?$/, '');
    }
    setFieldValue(detailField, next);
  }

  function wireRow(row, sid, index) {
    row.setAttribute('data-antcv-edu-row', '1');
    row.setAttribute('data-antcv-edu-row-index', String(index));
    const host = controlsHost(row);

    let alignBtn = host.querySelector(':scope [data-antcv-edu-control="cjlr"]');
    if (!alignBtn) { alignBtn = makeButton('cjlr'); host.appendChild(alignBtn); }
    paintAlign(alignBtn, sid, index);

    // Do not inject an Education enhance button. The app already provides one.
    // Remove stale overlay enhance buttons from v1.40.252-v1.40.256.
    host.querySelectorAll(':scope [data-antcv-edu-control="enhance"]').forEach(function (b) { b.remove(); });

    let pageBtn = host.querySelector(':scope [data-antcv-edu-control="page"]');
    if (!pageBtn) { pageBtn = makeButton('page'); host.appendChild(pageBtn); }
    paintPage(pageBtn, sid, index);

    // Defensive cleanup from earlier/mock DOM injections: only keep native row delete buttons.
    Array.from(host.querySelectorAll('button')).forEach(function (b) {
      if (isDeleteButton(b) && !b.hasAttribute('data-antcv-edu-native-delete')) b.remove();
    });

    applyEditorAlignment(row, getAlign(sid, index));

    alignBtn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      const cur = getAlign(sid, index);
      const next = ALIGNMENTS[(ALIGNMENTS.indexOf(cur) + 1) % ALIGNMENTS.length] || 'center';
      setAlign(sid, index, next);
      paintAlign(alignBtn, sid, index);
      applyEditorAlignment(row, next);
      applyPreview(sid);
    };
    pageBtn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      const next = (getPage(sid, index) % 4) + 1;
      setPage(sid, index, next);
      paintPage(pageBtn, sid, index);
    };
  }


  function cleanupForeignRowControls(root) {
    if (!root) return;
    root.querySelectorAll('[data-antcv-pub-controls-host="1"], [data-antcv-cert-controls-host="1"]').forEach(function (el) { el.remove(); });
    root.querySelectorAll('[data-antcv-pub-row="1"], [data-antcv-cert-row="1"]').forEach(function (row) {
      row.removeAttribute('data-antcv-pub-row'); row.removeAttribute('data-antcv-pub-row-index'); row.removeAttribute('data-antcv-pub-editor-align');
      row.removeAttribute('data-antcv-cert-row'); row.removeAttribute('data-antcv-cert-row-index'); row.removeAttribute('data-antcv-cert-editor-align');
    });
  }

  function run() {
    const sec = findEducationSection();
    if (!sec || !sec.id) return;
    const root = panelRoot();
    cleanupForeignRowControls(root);
    if (!root) return;
    const rows = likelyRows(root);
    if (!rows.length) return;
    rows.forEach(function (row, idx) { wireRow(row, sec.id, idx); });
    applyPreview(sec.id);
  }

  function injectCss() {
    if (document.getElementById('antcv-education-row-controls-252-css')) return;
    const s = document.createElement('style');
    s.id = 'antcv-education-row-controls-252-css';
    s.textContent = `
      [data-antcv-edu-row="1"] { overflow: visible !important; }
      [data-antcv-edu-controls-host="1"] button[data-antcv-edu-control] { font-family: inherit !important; }
      [data-antcv-edu-controls-host="1"] button[data-antcv-edu-control="page"] { min-width: 35px !important; width: 35px !important; font-size: 11px !important; }
      [data-antcv-edu-controls-host="1"] button[data-antcv-edu-control="enhance"] { display: none !important; }
      [data-antcv-edu-field-align="justify"] { text-align: justify !important; }
      [data-antcv-edu-field-align="center"] { text-align: center !important; }
      [data-antcv-edu-field-align="left"] { text-align: left !important; }
      [data-antcv-edu-field-align="right"] { text-align: right !important; }
      [data-antcv-edu-preview-align="justify"] { text-align: justify !important; }
      [data-antcv-edu-preview-align="center"] { text-align: center !important; }
      [data-antcv-edu-preview-align="left"] { text-align: left !important; }
      [data-antcv-edu-preview-align="right"] { text-align: right !important; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  injectCss();
  run();
  [150, 400, 900, 1600].forEach(function (ms) { setTimeout(run, ms); });
  try { new MutationObserver(function () { setTimeout(run, 0); }).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  window.addEventListener('storage', run);
  window.addEventListener('antcv:sections-updated', function () { setTimeout(run, 0); });
})();
