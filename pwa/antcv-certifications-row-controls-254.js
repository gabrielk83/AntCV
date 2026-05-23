/* AntCV Certifications row controls (v1.40.254)
 * Adds a safe per-row CJLR button to the CERTIFICATIONS sidebar panel.
 *
 * DOM/function contract
 * ---------------------
 * - CJLR writes localStorage['antcvItemAlignment'][sectionId]['items.<rowIndex>']
 *   and a numeric mirror for older preview/export readers.
 * - It dispatches antcv:sections-updated with source 'certifications-align'.
 * - It never mutates the Certifications item array and never calls delete/remove handlers.
 * - It removes misplaced Additional Information row controls from the Certifications panel,
 *   preventing clicks from being routed to the 'additional' section.
 */
(function () {
  'use strict';

  const VERSION = '1.40.256';
  if (window.__antcvCertificationsRowControls === VERSION) return;
  window.__antcvCertificationsRowControls = VERSION;

  const ALIGN_KEY = 'antcvItemAlignment';
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

  function readSections() {
    const all = safeParse(localStorage.getItem(SECTIONS_KEY), {});
    const list = all && all[activeDoc()];
    return Array.isArray(list) ? list : [];
  }

  function findCertSection() {
    const sections = readSections();
    return sections.find(function (s) { return s && s.loc === 'sidebar' && /certifications?/i.test(String(s.title || s.type || s.id || '')); }) ||
      sections.find(function (s) { return s && /certifications?/i.test(String(s.title || s.type || s.id || '')); }) || null;
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
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'certifications-align', sid, index, alignment: value } })); } catch (_) {}
    try { window.dispatchEvent(new Event('input')); } catch (_) {}
  }

  function ownText(el) {
    return norm(Array.from(el.childNodes || []).filter(function (n) { return n.nodeType === 3; }).map(function (n) { return n.textContent || ''; }).join(' '));
  }

  function looksLikeCertHeader(el) {
    const txt = norm(el.textContent || '');
    const own = ownText(el) || txt;
    if (!/^certifications?\b/i.test(txt) && !/^certifications?\b/i.test(own)) return false;
    if (/\(sidebar\)/i.test(txt)) return true;
    let p = el.parentElement;
    for (let i = 0; i < 3 && p; i++, p = p.parentElement) {
      const pt = low(p.textContent || '');
      if (pt.indexOf('cv preview') >= 0) return false;
      if (pt.indexOf('← back') >= 0 && (pt.indexOf('+ item') >= 0 || pt.indexOf('+ entry') >= 0)) return true;
    }
    return false;
  }

  function panelRoot() {
    const headers = Array.from(document.querySelectorAll('h1,h2,h3,div,span')).filter(looksLikeCertHeader);
    for (const h of headers) {
      let p = h;
      for (let i = 0; i < 7 && p; i++, p = p.parentElement) {
        if (!p || p === document.body) break;
        const txt = low(p.textContent || '');
        if (txt.indexOf('cv preview') >= 0) continue;
        if (txt.indexOf('← back') >= 0 && (txt.indexOf('+ item') >= 0 || txt.indexOf('+ entry') >= 0)) return p;
      }
    }
    return null;
  }

  function isDeleteButton(btn) {
    const t = low((btn && (btn.textContent || btn.innerText || btn.title || btn.getAttribute('aria-label'))) || '');
    return t === '×' || t === 'x' || t.indexOf('delete') >= 0 || t.indexOf('remove') >= 0;
  }

  function likelyRows(root) {
    if (!root) return [];
    const candidates = [];
    Array.from(root.querySelectorAll('div,li,tr')).forEach(function (el) {
      if (el.getAttribute('data-antcv-cert-row') === '1') { candidates.push(el); return; }
      if (el.closest('[data-antcv-panel-211]')) return;
      const fields = el.querySelectorAll('input,textarea,[contenteditable="true"]');
      if (!fields.length) return;
      const txt = low(el.textContent || '');
      if (/certifications?/.test(txt) && (txt.indexOf('+ item') >= 0 || txt.indexOf('+ entry') >= 0)) return;
      if (/\+ item|\+ entry|\+ group heading/.test(txt)) return;
      const buttons = Array.from(el.querySelectorAll('button'));
      const hasEye = buttons.some(function (b) { return /👁|eye|hide|show/.test(low(b.textContent || b.title || b.getAttribute('aria-label'))); });
      const hasDelete = buttons.some(isDeleteButton);
      if ((hasEye || hasDelete) && buttons.length > 0) candidates.push(el);
    });
    return candidates.filter(function (el, idx) {
      const fieldCount = el.querySelectorAll('input,textarea,[contenteditable="true"]').length;
      const nested = candidates.some(function (other) { return other !== el && other.contains(el) && other.querySelectorAll('input,textarea,[contenteditable="true"]').length <= fieldCount; });
      return !nested && candidates.indexOf(el) === idx;
    });
  }

  function rowFields(row) { return Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')); }

  function makeButton() {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-cert-control', 'cjlr');
    b.setAttribute('data-antcv-panel-doc', 'Certifications row CJLR control');
    Object.assign(b.style, { width: '24px', minWidth: '24px', height: '22px', minHeight: '22px', padding: '0', margin: '0 1px', border: '1px solid #01B7BB', borderRadius: '5px', background: 'rgba(1,183,187,.08)', color: '#00746E', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', lineHeight: '1', cursor: 'pointer', boxSizing: 'border-box', flex: '0 0 auto' });
    return b;
  }

  function paint(btn, sid, index) {
    const a = getAlign(sid, index);
    btn.textContent = ICON[a] || ICON.left;
    btn.title = 'Certifications row alignment: ' + (LABEL[a] || a) + '. Click to cycle Center, Justify, Left, Right.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-cert-row-index', String(index));
    btn.setAttribute('data-antcv-cert-sid', sid);
    btn.setAttribute('data-antcv-cert-current-align', a);
  }

  function controlsHost(row) {
    let host = row.querySelector(':scope [data-antcv-cert-controls-host="1"]');
    if (host) return host;
    host = document.createElement('span');
    host.setAttribute('data-antcv-cert-controls-host', '1');
    Object.assign(host.style, { display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '3px', whiteSpace: 'nowrap', verticalAlign: 'middle', flex: '0 0 auto' });
    const buttons = Array.from(row.querySelectorAll(':scope button'));
    const del = buttons.find(isDeleteButton);
    if (del && del.parentElement) del.parentElement.insertBefore(host, del);
    else row.appendChild(host);
    return host;
  }

  function applyEditor(row, align) {
    row.setAttribute('data-antcv-cert-editor-align', align);
    rowFields(row).forEach(function (field) { field.style.textAlign = align; field.setAttribute('data-antcv-cert-field-align', align); });
  }

  function applyPreview(sid) {
    const sec = document.querySelector('[data-sid="' + cssEscape(sid) + '"]');
    if (!sec) return;
    const map = readJson(ALIGN_KEY)[sid] || {};
    Array.from(sec.querySelectorAll('[data-antcv-row-path^="items."]')).forEach(function (el) {
      const m = String(el.getAttribute('data-antcv-row-path') || '').match(/^items\.(\d+)/);
      if (!m) return;
      const a = map[itemPath(Number(m[1]))] || map[String(Number(m[1]))];
      if (ALIGNMENTS.indexOf(a) < 0) return;
      el.style.textAlign = a;
      el.setAttribute('data-antcv-cert-preview-align', a);
      el.querySelectorAll('[data-antcv-editable-text], span, div, p, li').forEach(function (child) { child.style.textAlign = a; });
    });
  }

  function cleanupMiswiredAdditional(root) {
    if (!root) return;
    root.querySelectorAll('[data-antcv-addinfo-controls-host="1"]').forEach(function (host) { host.remove(); });
    root.querySelectorAll('[data-antcv-addinfo-row="1"]').forEach(function (row) {
      row.removeAttribute('data-antcv-addinfo-row');
      row.removeAttribute('data-antcv-addinfo-row-index');
      row.removeAttribute('data-antcv-addinfo-editor-align');
    });
  }

  function wireRow(row, sid, index) {
    row.setAttribute('data-antcv-cert-row', '1');
    row.setAttribute('data-antcv-cert-row-index', String(index));
    const host = controlsHost(row);
    let btn = host.querySelector(':scope [data-antcv-cert-control="cjlr"]');
    if (!btn) { btn = makeButton(); host.appendChild(btn); }
    paint(btn, sid, index);
    applyEditor(row, getAlign(sid, index));
    btn.onclick = function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      const cur = getAlign(sid, index);
      const next = ALIGNMENTS[(ALIGNMENTS.indexOf(cur) + 1) % ALIGNMENTS.length] || 'center';
      setAlign(sid, index, next);
      paint(btn, sid, index);
      applyEditor(row, next);
      applyPreview(sid);
    };
  }


  function cleanupForeignRowControls(root) {
    if (!root) return;
    root.querySelectorAll('[data-antcv-edu-controls-host="1"], [data-antcv-pub-controls-host="1"]').forEach(function (el) { el.remove(); });
    root.querySelectorAll('[data-antcv-edu-row="1"], [data-antcv-pub-row="1"]').forEach(function (row) {
      row.removeAttribute('data-antcv-edu-row'); row.removeAttribute('data-antcv-edu-row-index'); row.removeAttribute('data-antcv-edu-editor-align');
      row.removeAttribute('data-antcv-pub-row'); row.removeAttribute('data-antcv-pub-row-index'); row.removeAttribute('data-antcv-pub-editor-align');
    });
  }

  function run() {
    const sec = findCertSection();
    if (!sec || !sec.id) return;
    const root = panelRoot();
    cleanupMiswiredAdditional(root);
    cleanupForeignRowControls(root);
    if (!root) return;
    const rows = likelyRows(root);
    rows.forEach(function (row, idx) { wireRow(row, sec.id, idx); });
    applyPreview(sec.id);
  }

  function injectCss() {
    if (document.getElementById('antcv-certifications-row-controls-254-css')) return;
    const s = document.createElement('style');
    s.id = 'antcv-certifications-row-controls-254-css';
    s.textContent = '[data-antcv-cert-row="1"]{overflow:visible!important}[data-antcv-cert-controls-host="1"] button{font-family:inherit!important}[data-antcv-cert-field-align="justify"]{text-align:justify!important}[data-antcv-cert-field-align="center"]{text-align:center!important}[data-antcv-cert-field-align="left"]{text-align:left!important}[data-antcv-cert-field-align="right"]{text-align:right!important}[data-antcv-cert-preview-align="justify"]{text-align:justify!important}[data-antcv-cert-preview-align="center"]{text-align:center!important}[data-antcv-cert-preview-align="left"]{text-align:left!important}[data-antcv-cert-preview-align="right"]{text-align:right!important}';
    (document.head || document.documentElement).appendChild(s);
  }

  injectCss();
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; run(); });
  }
  schedule();
  [150, 400, 900, 1600].forEach(function (ms) { setTimeout(schedule, ms); });
  try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  window.addEventListener('storage', schedule);
  window.addEventListener('antcv:sections-updated', schedule);
})();
