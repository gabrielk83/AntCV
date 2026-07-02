/* AntCV Additional Information row controls (v1.40.247)
 * Adds per-row CJLR and page controls to the ADDITIONAL INFORMATION sidebar panel.
 *
 * Storage contracts used by existing preview/export code:
 * - localStorage['antcvItemAlignment'][sectionId]['items.<rowIndex>'] =
 *     'center' | 'justify' | 'left' | 'right'
 * - localStorage['antcv:itemPages'][sectionId]['<rowIndex>'] = 1..4
 *
 * The DOCX/PDF payload already forwards both maps through antcv-docx-client.js,
 * so these controls are export-safe. Preview is patched here immediately as a
 * visual fallback, while antcv-item-pages-render.js handles page breaks.
 */
(function () {
  'use strict';

  const VERSION = '1.50.138-cascade';
  if (window.__antcvAdditionalInfoRowControls === VERSION) return;
  window.__antcvAdditionalInfoRowControls = VERSION;
  // v1.40.247-preview-guard: Preview is button-free. panelRoot() and
  // likelyItemRows() must reject any candidate inside .antcv-preview-paper.
  function isInPreviewPaper(el){if(!el)return false;const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');return !!(p&&p.contains(el));}

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
  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value || {})); } catch (_) {}
  }

  function activeDoc() {
    try {
      let d = localStorage.getItem('doc') || '';
      try { const p = JSON.parse(d); if (typeof p === 'string') d = p; } catch (e) {}
      d = String(d).toLowerCase();
      return (d === 'cl' || d === 'cv') ? d : 'cv';
    } catch (_) { return 'cv'; }
  }

  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return norm(s).toLowerCase(); }

  function readSections() {
    const all = safeParse(localStorage.getItem(SECTIONS_KEY), {});
    const list = all && all[activeDoc()];
    return Array.isArray(list) ? list : [];
  }

  function findAdditionalSection() {
    const sections = readSections();
    return sections.find(function (s) {
      return s && s.loc === 'sidebar' && /additional information/i.test(String(s.title || ''));
    }) || sections.find(function (s) {
      return s && /additional information/i.test(String(s.title || ''));
    }) || null;
  }

  function itemPath(index) { return 'items.' + index; }

  function getAlign(sid, index) {
    const map = readJson(ALIGN_KEY);
    const bucket = map[sid] || {};
    const v = bucket[itemPath(index)] || bucket[String(index)] || 'left';
    return ALIGNMENTS.indexOf(v) >= 0 ? v : 'left';
  }

  function setAlign(sid, index, value) {
    const map = readJson(ALIGN_KEY);
    if (!map[sid] || typeof map[sid] !== 'object') map[sid] = {};
    map[sid][itemPath(index)] = value;
    // Keep a bare numeric mirror for older worker/sidecar fallbacks.
    map[sid][String(index)] = value;
    writeJson(ALIGN_KEY, map);
    dispatchUpdate('additional-info-align', { sid, index, alignment: value });
  }

  function getPage(sid, index) {
    // PB-007: app.js paginates the sidebar by section.page (NOT itemPages).
    try {
      const all = readJson(SECTIONS_KEY);
      const list = all && all[activeDoc()];
      if (Array.isArray(list)) {
        for (let i = 0; i < list.length; i++) {
          if (list[i] && String(list[i].id || '') === String(sid)) {
            const n = Number(list[i].page);
            return Number.isFinite(n) && n >= 1 && n <= 4 ? (n | 0) : 1;
          }
        }
      }
    } catch (_) {}
    return 1;
  }

  function setPage(sid, index, value) {
    // PB-007 (Path A): write section.page on the Additional Information section so
    // app.js's native engine moves the whole section. Clear the dead itemPages so
    // 329 doesn't draw a stale/flickering marker. One sections-updated re-render.
    const nv = value <= 1 ? 1 : value;
    try {
      const all = readJson(SECTIONS_KEY);
      const list = all && all[activeDoc()];
      if (Array.isArray(list)) {
        // Cascade: clicked section + all following sidebar sections → nv.
        let startIdx = -1;
        for (let i = 0; i < list.length; i++) { if (list[i] && String(list[i].id || '') === String(sid)) { startIdx = i; break; } }
        if (startIdx >= 0) {
          let changed = false;
          for (let j = startIdx; j < list.length; j++) {
            const s = list[j];
            if (!s || String(s.loc || '').toLowerCase() !== 'sidebar') continue;
            if (s.page !== nv) { s.page = nv; changed = true; }
          }
          if (changed) writeJson(SECTIONS_KEY, all);
        }
      }
    } catch (_) {}
    try { const pm = readJson(PAGE_KEY); if (pm && pm[sid]) { delete pm[sid]; writeJson(PAGE_KEY, pm); } } catch (_) {}
    dispatchUpdate('sidebar-section-page', { sid, index, page: nv });
  }

  function dispatchUpdate(source, detail) {
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: Object.assign({ source }, detail || {})
      }));
    } catch (_) {}
    try { window.dispatchEvent(new Event('input')); } catch (_) {}
  }

  function makeButton(kind) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-addinfo-control', kind);
    b.setAttribute('data-antcv-panel-doc', 'Additional Information row control');
    Object.assign(b.style, {
      width: '24px', minWidth: '24px', height: '22px', minHeight: '22px',
      padding: '0', margin: '0 1px', border: '1px solid #01B7BB',
      borderRadius: '5px', background: 'rgba(1,183,187,.08)', color: '#00746E',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: '700', lineHeight: '1', cursor: 'pointer',
      boxSizing: 'border-box', flex: '0 0 auto'
    });
    return b;
  }

  function paintAlign(btn, sid, index) {
    const a = getAlign(sid, index);
    btn.textContent = ICON[a] || ICON.left;
    btn.title = 'Additional Information row alignment: ' + (LABEL[a] || a) + '. Click to cycle Center, Justify, Left, Right.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-addinfo-row-index', String(index));
    btn.setAttribute('data-antcv-addinfo-sid', sid);
    btn.setAttribute('data-antcv-addinfo-current-align', a);
  }

  function paintPage(btn, sid, index) {
    const p = getPage(sid, index);
    btn.textContent = '📄 ' + p;
    btn.title = 'Start this Additional Information row on page ' + p + '. Click to cycle page 1 to 4.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-addinfo-row-index', String(index));
    btn.setAttribute('data-antcv-addinfo-sid', sid);
    btn.setAttribute('data-antcv-addinfo-current-page', String(p));
  }

  function isButtonLikeDelete(btn) {
    const t = low(btn.textContent || btn.innerText || btn.title || btn.getAttribute('aria-label'));
    return t === '×' || t === 'x' || t.indexOf('delete') >= 0 || t.indexOf('remove') >= 0;
  }

  function panelRoot() {
    const headers = Array.from(document.querySelectorAll('h1,h2,h3,div,span')).filter(function (el) {
      return !isInPreviewPaper(el) && /additional information/i.test(norm(el.textContent || ''));
    });
    for (const h of headers) {
      let p = h;
      for (let i = 0; i < 6 && p; i++, p = p.parentElement) {
        if (!p || p === document.body) break;
        if (isInPreviewPaper(p)) break;
        const txt = low(p.textContent);
        if (txt.indexOf('additional information') >= 0 && txt.indexOf('+ item') >= 0) return p;
      }
    }
    return null;
  }

  function likelyItemRows(root) {
    if (!root) return [];
    const candidates = [];
    const nodes = Array.from(root.querySelectorAll('div,li,tr'));
    nodes.forEach(function (el) {
      if (el.getAttribute('data-antcv-addinfo-row') === '1') { candidates.push(el); return; }
      if (el.closest('[data-antcv-panel-211]')) return;
      const inputs = el.querySelectorAll('input,textarea,[contenteditable="true"]');
      if (!inputs.length) return;
      const txt = low(el.textContent);
      if (/additional information/.test(txt) && txt.indexOf('+ item') >= 0) return;
      if (/rows \(row 0|tap .* hide|\+ item|\+ group heading/.test(txt)) return;
      const buttons = Array.from(el.querySelectorAll('button'));
      const hasEye = buttons.some(function (b) { return /👁|eye|hide|show/.test(low(b.textContent || b.title || b.getAttribute('aria-label'))); });
      const hasDelete = buttons.some(isButtonLikeDelete);
      const hasGroupText = /^group\b/i.test(norm(el.textContent || ''));
      if ((hasEye || hasDelete || hasGroupText) && buttons.length > 0) candidates.push(el);
    });

    // De-duplicate nested rows. Prefer the smallest container that still has fields/buttons.
    return candidates.filter(function (el, idx) {
      return candidates.findIndex(function (other) {
        return other !== el && other.contains(el) && other.querySelectorAll('input,textarea,[contenteditable="true"]').length <= el.querySelectorAll('input,textarea,[contenteditable="true"]').length;
      }) < 0 && candidates.indexOf(el) === idx;
    });
  }

  function rowControlsHost(row) {
    let host = row.querySelector(':scope [data-antcv-addinfo-controls-host="1"]');
    if (host) return host;
    host = document.createElement('span');
    host.setAttribute('data-antcv-addinfo-controls-host', '1');
    Object.assign(host.style, {
      display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '3px',
      whiteSpace: 'nowrap', verticalAlign: 'middle', flex: '0 0 auto'
    });
    const buttons = Array.from(row.querySelectorAll(':scope button'));
    const del = buttons.find(isButtonLikeDelete);
    if (del && del.parentElement) del.parentElement.insertBefore(host, del);
    else row.appendChild(host);
    return host;
  }

  function applyEditorRowAlignment(row, align) {
    row.setAttribute('data-antcv-addinfo-editor-align', align);
    row.querySelectorAll('input,textarea,[contenteditable="true"]').forEach(function (field) {
      field.style.textAlign = align;
      field.setAttribute('data-antcv-addinfo-field-align', align);
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
      el.setAttribute('data-antcv-addinfo-preview-align', a);
      el.querySelectorAll('[data-antcv-editable-text], span, div, p, li').forEach(function (child) {
        child.style.textAlign = a;
      });
    });
  }

  function cssEscape(s) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(s));
    return String(s).replace(/["\\]/g, '\\$&');
  }

  function wireRow(row, sid, index) {
    row.setAttribute('data-antcv-addinfo-row', '1');
    row.setAttribute('data-antcv-addinfo-row-index', String(index));
    const host = rowControlsHost(row);

    let alignBtn = host.querySelector(':scope [data-antcv-addinfo-control="cjlr"]');
    if (!alignBtn) { alignBtn = makeButton('cjlr'); host.appendChild(alignBtn); }
    paintAlign(alignBtn, sid, index);

    // PB-007: app.js paginates the sidebar per-SECTION (section.page), so the
    // page control lives only on the FIRST item = "move the whole sub-section".
    // CJLR stays per item. Remove a stale page button from non-first rows.
    let pageBtn = host.querySelector(':scope [data-antcv-addinfo-control="page"]');
    if (index === 0) {
      if (!pageBtn) { pageBtn = makeButton('page'); host.appendChild(pageBtn); }
      paintPage(pageBtn, sid, index);
    } else if (pageBtn && pageBtn.parentNode) {
      pageBtn.parentNode.removeChild(pageBtn); pageBtn = null;
    }

    applyEditorRowAlignment(row, getAlign(sid, index));

    alignBtn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      const cur = getAlign(sid, index);
      const next = ALIGNMENTS[(ALIGNMENTS.indexOf(cur) + 1) % ALIGNMENTS.length] || 'center';
      setAlign(sid, index, next);
      paintAlign(alignBtn, sid, index);
      applyEditorRowAlignment(row, next);
      applyPreview(sid);
    };

    if (pageBtn) {
      pageBtn.onclick = function (ev) {
        ev.preventDefault(); ev.stopPropagation();
        const next = (getPage(sid, index) % 4) + 1;
        setPage(sid, index, next);
        paintPage(pageBtn, sid, index);
      };
    }
  }

  // v1.50.129 (PB-001): some sidebar sub-section editors (e.g. Regulatory
  // Context) render their item rows inside the same container panelRoot()
  // resolves to, so likelyItemRows() picked them up and run() bound them to
  // the hardcoded 'additional' sid — pressing THEIR page button moved
  // Additional Information instead of their own section. Guard: walk up from a
  // candidate row to its nearest section header; if that header belongs to a
  // different known section, the row is foreign and must not be wired here.
  var FOREIGN_SECTION_RX = /(regulatory context|tools\s*&?\s*methods|tools and methods|\beducation\b|\blanguages\b|\bprofile\b|core competenc|selected outcomes|professional experience|\bpublications?\b|\bpatents?\b|certifications?)/i;
  function rowIsForeign(row) {
    var el = row;
    for (var depth = 0; el && el !== document.body && depth < 10; depth++, el = el.parentElement) {
      var sib = el.previousElementSibling, scanned = 0;
      while (sib && scanned < 8) {
        var t = norm(sib.textContent || '');
        if (t && t.length <= 48) {
          if (/additional information/i.test(t)) return false; // our own header reached first -> not foreign
          if (FOREIGN_SECTION_RX.test(t)) return true;          // a different section's header is nearer
        }
        sib = sib.previousElementSibling; scanned++;
      }
    }
    return false; // no foreign header found -> preserve prior behaviour (wire it)
  }

  function run() {
    const sec = findAdditionalSection();
    if (!sec || !sec.id) return;
    const root = panelRoot();
    if (!root) return;
    const rows = likelyItemRows(root);
    if (!rows.length) return;
    let wi = 0;
    rows.forEach(function (r) {
      if (rowIsForeign(r)) return;       // skip rows belonging to a different sidebar sub-section
      wireRow(r, sec.id, wi);
      wi++;
    });
    applyPreview(sec.id);
  }

  function injectCss() {
    if (document.getElementById('antcv-additional-info-row-controls-247-css')) return;
    const s = document.createElement('style');
    s.id = 'antcv-additional-info-row-controls-247-css';
    s.textContent = `
      [data-antcv-addinfo-row="1"] { overflow: visible !important; }
      [data-antcv-addinfo-controls-host="1"] button[data-antcv-addinfo-control] {
        font-family: inherit !important;
      }
      [data-antcv-addinfo-controls-host="1"] button[data-antcv-addinfo-control="page"] {
        min-width: 35px !important;
        width: 35px !important;
        font-size: 11px !important;
      }
      [data-antcv-addinfo-field-align="justify"] { text-align: justify !important; }
      [data-antcv-addinfo-field-align="center"] { text-align: center !important; }
      [data-antcv-addinfo-field-align="left"] { text-align: left !important; }
      [data-antcv-addinfo-field-align="right"] { text-align: right !important; }
      [data-antcv-addinfo-preview-align="justify"] { text-align: justify !important; }
      [data-antcv-addinfo-preview-align="center"] { text-align: center !important; }
      [data-antcv-addinfo-preview-align="left"] { text-align: left !important; }
      [data-antcv-addinfo-preview-align="right"] { text-align: right !important; }
    `;
    (document.head || document.documentElement).appendChild(s);
  }

  injectCss();
  run();
  [150, 400, 900, 1600].forEach(function (ms) { setTimeout(run, ms); });
  // SETTINGS-PERSONAL-FREEZE-001 (owner 2026-07-03): reacting to EVERY childList
  // mutation with a full norm()/panelRoot() document scan was the top residual
  // CPU consumer in the settings-tab freeze profile. Trailing 300ms debounce
  // merges mutation bursts into one pass; behaviour otherwise unchanged.
  var __moT = null;
  function runSoon() { if (__moT) return; __moT = setTimeout(function () { __moT = null; run(); }, 300); }
  try {
    new MutationObserver(runSoon).observe(document.body || document.documentElement, {
      childList: true, subtree: true
    });
  } catch (_) {}
  window.addEventListener('storage', runSoon);
  window.addEventListener('antcv:sections-updated', runSoon);
})();
