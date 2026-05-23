/* AntCV Publications & Patent row controls (v1.40.258)
 * Adds per-row Page, CJLR, Compress, Enhance and preserves the native delete/X.
 *
 * DOM/function contract
 * ---------------------
 * - Page writes localStorage['antcv:itemPages'][sectionId][rowIndex] = 1..4.
 *   Existing preview/DOCX page renderers consume this map.
 * - CJLR writes localStorage['antcvItemAlignment'][sectionId]['items.<rowIndex>']
 *   and a numeric fallback key for older preview/export code.
 * - Compress and Enhance only edit the descriptive field, never the publication/patent name.
 * - The native row delete button is not removed or replaced.
 * - Defensive cleanup removes old Publications section-header buttons that were injected next to
 *   the DOCX/preview toolbar instead of the row editor.
 */
(function () {
  'use strict';

  const VERSION = '1.40.258';
  if (window.__antcvPublicationsRowControls === VERSION) return;
  window.__antcvPublicationsRowControls = VERSION;

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
  function dispatchInput(el) {
    if (!el) return;
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
  }

  function readSections() {
    const all = safeParse(localStorage.getItem(SECTIONS_KEY), {});
    const list = all && all[activeDoc()];
    return Array.isArray(list) ? list : [];
  }
  function isPublicationSection(s) {
    const txt = low((s && (s.type || '')) + ' ' + (s && (s.title || '')));
    return txt.indexOf('publication') >= 0 || txt.indexOf('patent') >= 0;
  }
  function findPublicationSection() {
    const sections = readSections();
    return sections.find(function (s) { return s && s.loc === 'sidebar' && isPublicationSection(s); }) ||
      sections.find(isPublicationSection) || null;
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
    dispatchUpdate('publications-align', { sid, index, alignment: value });
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
    dispatchUpdate('publications-page', { sid, index, page: value });
  }

  function ownText(el) {
    return norm(Array.from(el.childNodes || []).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent || ''; }).join(' '));
  }
  function looksLikePubHeader(el) {
    const own = low(ownText(el));
    const all = low(el.textContent || '');
    const head = own || all;
    if (head.indexOf('publications & patent') < 0 && head.indexOf('publications and patent') < 0) return false;
    if (all.indexOf('cv preview') >= 0 || all.indexOf('docx') >= 0) return false;
    let p = el.parentElement;
    for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
      const pt = low(p.textContent || '');
      if (pt.indexOf('cv preview') >= 0 || pt.indexOf('docx') >= 0) return false;
      if (pt.indexOf('← back') >= 0 && pt.indexOf('+ entry') >= 0) return true;
    }
    return false;
  }
  function panelRoot() {
    const headers = Array.from(document.querySelectorAll('h1,h2,h3,div,span')).filter(looksLikePubHeader);
    for (const h of headers) {
      let p = h;
      for (let i = 0; i < 7 && p; i++, p = p.parentElement) {
        if (!p || p === document.body) break;
        const txt = low(p.textContent || '');
        if (txt.indexOf('cv preview') >= 0 || txt.indexOf('docx') >= 0) continue;
        if ((txt.indexOf('publications & patent') >= 0 || txt.indexOf('publications and patent') >= 0) && txt.indexOf('← back') >= 0 && txt.indexOf('+ entry') >= 0) return p;
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
  function isPreviewOrToolbar(el) {
    if (!el) return false;
    const txt = low(el.textContent || '');
    if (txt.indexOf('docx') >= 0 || txt.indexOf('cv preview') >= 0) return true;
    return !!(el.closest && (el.closest('[data-antcv-panel-211]') || el.closest('[data-antcv-preview-toolbar]')));
  }

  function likelyRows(root) {
    if (!root) return [];
    const candidates = [];
    Array.from(root.querySelectorAll('div,li,tr')).forEach(function (el) {
      if (el.getAttribute('data-antcv-pub-row') === '1') { candidates.push(el); return; }
      if (el.closest('[data-antcv-panel-211]')) return;
      if (el.closest('[data-antcv-edu-row="1"]') || el.closest('[data-antcv-cert-row="1"]')) return;
      if (isPreviewOrToolbar(el)) return;
      const fields = el.querySelectorAll('input,textarea,[contenteditable="true"]');
      if (fields.length < 2) return;
      const txt = low(el.textContent);
      if (txt.indexOf('publications & patent') >= 0 && txt.indexOf('+ entry') >= 0) return;
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
  function setFieldValue(el, value) { if (!el) return; if (el.value != null) el.value = value; else el.textContent = value; dispatchInput(el); }
  function detailField(row) { const fields = rowFields(row); return fields[1] || null; }

  function makeButton(kind) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-pub-control', kind);
    b.setAttribute('data-antcv-panel-doc', 'Publications row control');
    const isPurple = kind === 'compress';
    const isEnhance = kind === 'enhance';
    Object.assign(b.style, {
      width: kind === 'page' ? '30px' : '23px', minWidth: kind === 'page' ? '30px' : '23px',
      height: '22px', minHeight: '22px', padding: '0', margin: '0 1px',
      border: isPurple ? '1px solid #7b2ff2' : isEnhance ? '1px solid #ff8a00' : '1px solid #01B7BB',
      borderRadius: '5px', background: isPurple ? 'rgba(123,47,242,.06)' : isEnhance ? 'rgba(255,138,0,.06)' : 'rgba(1,183,187,.08)',
      color: isPurple ? '#7b2ff2' : isEnhance ? '#ff8a00' : '#00746E', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', fontSize: kind === 'page' ? '10px' : '12px', fontWeight: '700', lineHeight: '1',
      cursor: 'pointer', boxSizing: 'border-box', flex: '0 0 auto'
    });
    return b;
  }
  function paintAlign(btn, sid, index) {
    const a = getAlign(sid, index);
    btn.textContent = ICON[a] || ICON.left;
    btn.title = 'Publication row alignment: ' + (LABEL[a] || a) + '. Click to cycle Center, Justify, Left, Right.';
    btn.setAttribute('aria-label', btn.title);
  }
  function paintPage(btn, sid, index) {
    const p = getPage(sid, index);
    btn.textContent = '📄' + p;
    btn.title = 'Start this Publications & Patent row on page ' + p + '. Click to cycle page 1 to 4.';
    btn.setAttribute('aria-label', btn.title);
  }
  function paintStatic(btn, kind) {
    if (kind === 'compress') {
      btn.textContent = '⇥⇤';
      btn.title = 'Compress only the descriptive part of this Publications & Patent row.';
    } else {
      btn.textContent = '✨';
      btn.title = 'Enhance only the descriptive part of this Publications & Patent row.';
    }
    btn.setAttribute('aria-label', btn.title);
  }

  function controlsHost(row) {
    let host = row.querySelector(':scope [data-antcv-pub-controls-host="1"]');
    if (host) return host;
    host = document.createElement('span');
    host.setAttribute('data-antcv-pub-controls-host', '1');
    Object.assign(host.style, { display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '3px', marginRight: '3px', whiteSpace: 'nowrap', verticalAlign: 'middle', flex: '0 0 auto', order: '60' });
    const directButtons = Array.from(row.querySelectorAll(':scope button'));
    const firstMove = directButtons.find(isMoveButton);
    const del = directButtons.find(isDeleteButton);
    if (del && del.parentElement) del.parentElement.insertBefore(host, del);
    else if (firstMove && firstMove.parentElement) firstMove.parentElement.insertBefore(host, firstMove);
    else row.appendChild(host);
    return host;
  }

  function compressText(text) {
    let s = String(text || '').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
    s = s.replace(/\b(published in|publication in)\b/ig, 'in');
    s = s.replace(/\bpatent number\b/ig, 'patent');
    s = s.replace(/\bapproximately\b/ig, 'approx.');
    return s;
  }
  function enhanceText(text) {
    let s = String(text || '').replace(/\s+/g, ' ').replace(/\s+([,.;:])/g, '$1').trim();
    if (!s || /^\[.*\]$/.test(s)) return s;
    if (!/[.!?]$/.test(s) && s.length > 80) s += '.';
    return s;
  }
  function applyEditorAlignment(row, align) {
    row.setAttribute('data-antcv-pub-editor-align', align);
    const detail = detailField(row);
    if (detail) {
      detail.style.textAlign = align;
      detail.setAttribute('data-antcv-pub-detail-align', align);
    }
  }
  function applyPreview(sid) {
    const sec = document.querySelector('[data-sid="' + cssEscape(sid) + '"]');
    if (!sec) return;
    const map = readJson(ALIGN_KEY)[sid] || {};
    const items = Array.from(sec.querySelectorAll('[data-antcv-row-path^="items."]'));
    items.forEach(function (el) {
      const m = String(el.getAttribute('data-antcv-row-path') || '').match(/^items\.(\d+)/);
      if (!m) return;
      const idx = Number(m[1]);
      const a = map[itemPath(idx)] || map[String(idx)];
      if (ALIGNMENTS.indexOf(a) < 0) return;
      el.style.textAlign = a;
      el.setAttribute('data-antcv-pub-preview-align', a);
    });
  }

  function cleanupBadButtons() {
    Array.from(document.querySelectorAll('button[data-antcv-pub-injected], button[data-antcv-pub-mini-kind]')).forEach(function (b) {
      if (!b.closest('[data-antcv-pub-controls-host="1"]')) b.remove();
    });
    Array.from(document.querySelectorAll('[data-antcv-pub-row="1"] button[data-antcv-pub-control]')).forEach(function (b) {
      if (!b.closest('[data-antcv-pub-controls-host="1"]')) b.remove();
    });
    Array.from(document.querySelectorAll('button')).forEach(function (b) {
      const t = low((b.textContent || '') + ' ' + (b.title || '') + ' ' + (b.getAttribute('aria-label') || ''));
      if ((t.indexOf('compress publications') >= 0 || t.indexOf('enhance publications') >= 0) && !b.closest('[data-antcv-pub-row="1"]')) b.remove();
    });
  }

  function wireRow(row, sid, index) {
    row.setAttribute('data-antcv-pub-row', '1');
    row.setAttribute('data-antcv-pub-row-index', String(index));
    cleanupBadButtons();
    const host = controlsHost(row);

    // Remove duplicate injected purple buttons from older builds, but never native delete/X.
    Array.from(host.querySelectorAll('button[data-antcv-pub-injected], button[data-antcv-pub-mini-kind]')).forEach(function (b) { b.remove(); });
    const redundant = Array.from(host.querySelectorAll(':scope button[data-antcv-pub-control="compress"]'));
    redundant.slice(1).forEach(function (b) { b.remove(); });

    let pageBtn = host.querySelector(':scope [data-antcv-pub-control="page"]');
    if (!pageBtn) { pageBtn = makeButton('page'); host.appendChild(pageBtn); }
    paintPage(pageBtn, sid, index);

    let alignBtn = host.querySelector(':scope [data-antcv-pub-control="cjlr"]');
    if (!alignBtn) { alignBtn = makeButton('cjlr'); host.appendChild(alignBtn); }
    paintAlign(alignBtn, sid, index);

    let compressBtn = host.querySelector(':scope [data-antcv-pub-control="compress"]');
    if (!compressBtn) { compressBtn = makeButton('compress'); host.appendChild(compressBtn); }
    paintStatic(compressBtn, 'compress');

    let enhanceBtn = host.querySelector(':scope [data-antcv-pub-control="enhance"]');
    if (!enhanceBtn) { enhanceBtn = makeButton('enhance'); host.appendChild(enhanceBtn); }
    paintStatic(enhanceBtn, 'enhance');

    pageBtn.style.order = '10';
    alignBtn.style.order = '20';
    compressBtn.style.order = '30';
    enhanceBtn.style.order = '40';
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
    compressBtn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      const f = detailField(row);
      if (f) setFieldValue(f, compressText(fieldValue(f)));
      dispatchUpdate('publications-compress', { sid, index });
      applyPreview(sid);
    };
    enhanceBtn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      const f = detailField(row);
      if (f) setFieldValue(f, enhanceText(fieldValue(f)));
      dispatchUpdate('publications-enhance', { sid, index });
      applyPreview(sid);
    };
  }


  function cleanupForeignRowControls(root) {
    if (!root) return;
    root.querySelectorAll('[data-antcv-edu-controls-host="1"], [data-antcv-cert-controls-host="1"]').forEach(function (el) { el.remove(); });
    root.querySelectorAll('[data-antcv-edu-row="1"], [data-antcv-cert-row="1"]').forEach(function (row) {
      row.removeAttribute('data-antcv-edu-row'); row.removeAttribute('data-antcv-edu-row-index'); row.removeAttribute('data-antcv-edu-editor-align');
      row.removeAttribute('data-antcv-cert-row'); row.removeAttribute('data-antcv-cert-row-index'); row.removeAttribute('data-antcv-cert-editor-align');
    });
  }

  function run() {
    cleanupBadButtons();
    const sec = findPublicationSection();
    if (!sec || !sec.id) return;
    const root = panelRoot();
    cleanupForeignRowControls(root);
    if (!root) return;
    const rows = likelyRows(root);
    rows.forEach(function (row, idx) { wireRow(row, sec.id, idx); });
    applyPreview(sec.id);
  }

  function injectCss() {
    if (document.getElementById('antcv-publications-row-controls-253-css')) return;
    const s = document.createElement('style');
    s.id = 'antcv-publications-row-controls-253-css';
    s.textContent = `
      [data-antcv-pub-row="1"] {
        display: flex !important;
        align-items: center !important;
        flex-wrap: wrap !important;
        gap: 3px !important;
        overflow: visible !important;
      }
      [data-antcv-pub-row="1"] input,
      [data-antcv-pub-row="1"] textarea,
      [data-antcv-pub-row="1"] [contenteditable="true"] {
        min-width: 0 !important;
        flex-shrink: 1 !important;
      }
      [data-antcv-pub-row="1"] input:nth-of-type(1) { flex: 0 1 132px !important; }
      [data-antcv-pub-row="1"] input:nth-of-type(2) { flex: 1 1 150px !important; }
      [data-antcv-pub-row="1"] button { flex: 0 0 auto !important; }
      [data-antcv-pub-row="1"] button:not([data-antcv-pub-control]) { order: 80 !important; }
      [data-antcv-pub-row="1"] button[aria-label*="hide" i],
      [data-antcv-pub-row="1"] button[title*="hide" i],
      [data-antcv-pub-row="1"] button[aria-label*="show" i],
      [data-antcv-pub-row="1"] button[title*="show" i] { order: 0 !important; }
      [data-antcv-pub-row="1"] button[aria-label*="delete" i],
      [data-antcv-pub-row="1"] button[title*="delete" i] { order: 90 !important; }
      [data-antcv-pub-controls-host="1"] { order: 60 !important; }
      [data-antcv-pub-controls-host="1"] button[data-antcv-pub-control] { font-family: inherit !important; }
      [data-antcv-pub-controls-host="1"] button[data-antcv-pub-control="page"] { min-width: 30px !important; width: 30px !important; font-size: 10px !important; }
      [data-antcv-pub-detail-align="justify"] { text-align: justify !important; }
      [data-antcv-pub-detail-align="center"] { text-align: center !important; }
      [data-antcv-pub-detail-align="left"] { text-align: left !important; }
      [data-antcv-pub-detail-align="right"] { text-align: right !important; }
      [data-antcv-pub-preview-align="justify"] { text-align: justify !important; }
      [data-antcv-pub-preview-align="center"] { text-align: center !important; }
      [data-antcv-pub-preview-align="left"] { text-align: left !important; }
      [data-antcv-pub-preview-align="right"] { text-align: right !important; }
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
