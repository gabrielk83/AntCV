/* AntCV v1.40.269
 * Publications & Patent subsubsection repair.
 * - Keeps one compact control strip per publication row.
 * - Removes orphan/redundant controls that older patches appended to the panel bottom.
 * - Makes visibility/delete controls compact so the eye button cannot stretch across the detail field.
 * - Page, CJLR, Compress and Enhance are row-level controls.
 * - Compress and Enhance only modify the second textbox: Journal / patent no. / year / details.
 */
(function(){
  'use strict';
  const VERSION = '1.40.269';
  if (window.__antcvPublicationsRowControls269 === VERSION) return;
  window.__antcvPublicationsRowControls269 = VERSION;

  const PAGE_KEY = 'antcv:itemPages';
  const ALIGN_KEY = 'antcvItemAlignment';
  const SECTIONS_KEY = 'sections';
  const ALIGN = ['center','justify','left','right'];
  const ICON = { center:'↔', justify:'☰', left:'⇤', right:'⇥' };
  const LABEL = { center:'Center', justify:'Justify', left:'Left', right:'Right' };

  const clean = s => String(s || '').replace(/\s+/g,' ').trim();
  const low = s => clean(s).toLowerCase();
  const isVisible = el => !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const parse = (k,f) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v && typeof v === 'object' ? v : f; } catch(_) { return f; } };
  const write = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v || {})); } catch(_) {} };
  const docKind = () => { try { return localStorage.getItem('doc') === 'cl' ? 'cl' : 'cv'; } catch(_) { return 'cv'; } };

  function pulse(source, detail){
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: Object.assign({ source, version: VERSION }, detail || {}) })); } catch(_) {}
  }
  function fire(el){
    if (!el) return;
    ['input','change'].forEach(t => { try { el.dispatchEvent(new Event(t, { bubbles:true })); } catch(_) {} });
  }
  function sections(){
    const all = parse(SECTIONS_KEY, {});
    return Array.isArray(all[docKind()]) ? all[docKind()] : [];
  }
  function pubSection(){
    return sections().find(s => s && String(s.loc || '').toLowerCase() === 'sidebar' && /publication|patent/i.test([s.id,s.title,s.name,s.type].join(' '))) ||
           sections().find(s => s && /publication|patent/i.test([s.id,s.title,s.name,s.type].join(' '))) || null;
  }
  function panelRoot(){
    const heads = Array.from(document.querySelectorAll('h1,h2,h3,b,strong,div,span')).filter(isVisible);
    for (const h of heads) {
      const t = clean(h.textContent || '');
      if (!/publications?\s*(?:&|and)\s*patent/i.test(t) || t.length > 90) continue;
      let p = h;
      for (let i=0; p && p !== document.body && i < 10; i++, p = p.parentElement) {
        const txt = clean(p.textContent || '');
        if (/cv preview|docx/i.test(txt)) continue;
        if (/publications?\s*(?:&|and)\s*patent/i.test(txt) && /←\s*back/i.test(txt) && /\+\s*(publication|entry)/i.test(txt)) return p;
      }
    }
    return null;
  }
  function allFields(row){
    return Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(isVisible);
  }
  function fieldValue(f){ return f ? (f.value !== undefined ? String(f.value) : String(f.textContent || '')) : ''; }
  function setFieldValue(f, v){ if (!f) return; if (f.value !== undefined) f.value = v; else f.textContent = v; fire(f); }
  function rowForField(f, root){
    let p = f.parentElement, best = null;
    for (let d=0; p && p !== root.parentElement && d < 8; d++, p = p.parentElement) {
      const fs = allFields(p);
      if (fs.length >= 2 && fs.length <= 5) best = p;
    }
    return best;
  }
  function rows(root){
    if (!root) return [];
    const out = [];
    const fields = Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f => {
      if (!isVisible(f)) return false;
      const s = [f.value, f.placeholder, f.textContent, f.getAttribute('aria-label')].join(' ');
      return /publication|patent|journal|details|year/i.test(s);
    });
    fields.forEach(f => { const r = rowForField(f, root); if (r && !out.includes(r)) out.push(r); });
    return out;
  }
  function itemKey(i){ return 'items.' + i; }
  function getPage(sid,i){
    const m = parse(PAGE_KEY, {}); const b = m[sid] || {};
    const n = Number(b[String(i)] || b[itemKey(i)] || 1);
    return Number.isFinite(n) && n >= 1 && n <= 4 ? (n|0) : 1;
  }
  function setPage(sid,i,n){
    const m = parse(PAGE_KEY, {}); if (!m[sid] || typeof m[sid] !== 'object') m[sid] = {};
    m[sid][String(i)] = n; m[sid][itemKey(i)] = n;
    write(PAGE_KEY, m); pulse('publications-page', { sid, index:i, page:n });
  }
  function getAlign(sid,i){
    const m = parse(ALIGN_KEY, {}); const b = m[sid] || {};
    const v = b[itemKey(i)] || b[String(i)] || 'left';
    return ALIGN.includes(v) ? v : 'left';
  }
  function setAlign(sid,i,v){
    const m = parse(ALIGN_KEY, {}); if (!m[sid] || typeof m[sid] !== 'object') m[sid] = {};
    m[sid][itemKey(i)] = v; m[sid][String(i)] = v;
    write(ALIGN_KEY, m); pulse('publications-align', { sid, index:i, alignment:v });
  }
  function compressText(s){
    return clean(s)
      .replace(/\bpublication in\b/ig,'in')
      .replace(/\bpublished in\b/ig,'in')
      .replace(/\bpatent number\b/ig,'patent')
      .replace(/\bapproximately\b/ig,'approx.')
      .replace(/\s+([,.;:])/g,'$1');
  }
  function enhanceText(s){
    let t = clean(s);
    if (!t || /^\[.*\]$/.test(t)) return t;
    if (!/[.!?]$/.test(t) && t.length > 80) t += '.';
    return t;
  }
  function isEyeButton(b){
    const t = low((b.textContent||'') + ' ' + (b.title||'') + ' ' + (b.getAttribute('aria-label')||''));
    return /👁|eye|visible|visibility|hide|show|monkey|🙈/.test(t);
  }
  function isDeleteButton(b){
    const t = low((b.textContent||'') + ' ' + (b.title||'') + ' ' + (b.getAttribute('aria-label')||''));
    return t === 'x' || t === '×' || /delete|remove|✕/.test(t);
  }
  function isMoveButton(b){
    const t = low((b.textContent||'') + ' ' + (b.title||'') + ' ' + (b.getAttribute('aria-label')||''));
    return /▲|▼|move up|move down/.test(t);
  }
  function makeBtn(kind){
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-pub269-control', kind);
    Object.assign(b.style, {
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width: kind === 'page' ? '31px' : '24px', minWidth: kind === 'page' ? '31px' : '24px', maxWidth: kind === 'page' ? '31px' : '24px',
      height:'22px', minHeight:'22px', padding:'0', margin:'0', borderRadius:'5px',
      fontSize: kind === 'page' ? '10px' : '12px', lineHeight:'1', fontWeight:'700', cursor:'pointer',
      boxSizing:'border-box', flex:'0 0 auto', position:'static', float:'none'
    });
    if (kind === 'cjlr' || kind === 'compress') { b.style.border = '1px solid #7b2ff2'; b.style.color = '#7b2ff2'; b.style.background = 'rgba(123,47,242,.06)'; }
    else if (kind === 'enhance') { b.style.border = '1px solid #ff8a00'; b.style.color = '#ff8a00'; b.style.background = 'rgba(255,138,0,.06)'; }
    else { b.style.border = '1px solid #01B7BB'; b.style.color = '#00746E'; b.style.background = 'rgba(1,183,187,.08)'; }
    return b;
  }
  function paintPage(b,sid,i){ const p = getPage(sid,i); b.textContent = '📄' + p; b.title = 'Publication row page: ' + p + '. Click to cycle page 1-4.'; b.setAttribute('aria-label', b.title); }
  function paintAlign(b,sid,i){ const a = getAlign(sid,i); b.textContent = ICON[a] || ICON.left; b.title = 'Publication detail alignment: ' + (LABEL[a] || a) + '. Click to cycle Center, Justify, Left, Right.'; b.setAttribute('aria-label', b.title); }
  function applyAlign(row,a){ const f = allFields(row)[1]; if (f) { f.style.textAlign = a; f.setAttribute('data-antcv-pub269-detail-align', a); } }

  function removeOldInjected(root){
    if (!root) return;
    root.querySelectorAll([
      '[data-antcv-pub267-host="1"]',
      '[data-antcv-pub-controls-host="1"]',
      '[data-antcv-pub269-host="1"]',
      'button[data-antcv-pub-control]',
      'button[data-antcv-pub267]',
      'button[data-antcv-pub-injected]',
      'button[data-antcv-pub-mini-kind]',
      '[data-antcv-pub-control]',
      '[data-antcv-pub267]'
    ].join(',')).forEach(el => el.remove());
  }
  function cleanupOrphans(root, validRows){
    if (!root) return;
    const valid = new Set(validRows || []);
    root.querySelectorAll('[data-antcv-pub269-host="1"], button[data-antcv-pub269-control]').forEach(el => {
      const row = el.closest('[data-antcv-pub269-row="1"]');
      if (!row || !valid.has(row)) el.remove();
    });
    Array.from(root.children).forEach(ch => {
      const txt = clean(ch.textContent || '');
      if (!txt) return;
      if (!ch.matches('[data-antcv-pub269-row="1"]') && ch.querySelector && ch.querySelector('button[data-antcv-pub269-control]')) ch.remove();
    });
  }
  function host(row){
    let h = row.querySelector(':scope > [data-antcv-pub269-host="1"]');
    if (!h) {
      h = document.createElement('span');
      h.setAttribute('data-antcv-pub269-host','1');
      Object.assign(h.style, { display:'inline-flex', alignItems:'center', gap:'2px', whiteSpace:'nowrap', flex:'0 0 auto', marginLeft:'2px', order:'40', position:'static', float:'none' });
      row.appendChild(h);
    }
    return h;
  }
  function normalizeNativeButtons(row){
    Array.from(row.querySelectorAll('button')).forEach(b => {
      if (b.closest('[data-antcv-pub269-host="1"]')) return;
      Object.assign(b.style, {
        width:'24px', minWidth:'24px', maxWidth:'24px', height:'22px', minHeight:'22px',
        padding:'0', margin:'0', flex:'0 0 auto', position:'static', float:'none', boxSizing:'border-box'
      });
      if (isEyeButton(b)) { b.setAttribute('data-antcv-pub269-eye','1'); b.style.order = '50'; }
      else if (isDeleteButton(b)) { b.setAttribute('data-antcv-pub269-delete','1'); b.style.order = '60'; }
      else if (isMoveButton(b)) { b.setAttribute('data-antcv-pub269-move','1'); b.style.order = '90'; }
      else { b.style.order = '80'; }
    });
  }
  function wireRow(row, sid, i){
    row.setAttribute('data-antcv-pub269-row','1');
    row.setAttribute('data-antcv-pub-row','1');
    row.setAttribute('data-antcv-pub-row-index', String(i));
    const h = host(row); h.innerHTML = '';
    const page = makeBtn('page');
    const cjlr = makeBtn('cjlr');
    const comp = makeBtn('compress');
    const enh = makeBtn('enhance');
    comp.textContent = '⇥⇤'; comp.title = 'Compress only the Journal / patent no. / year / details field.'; comp.setAttribute('aria-label', comp.title);
    enh.textContent = '✨'; enh.title = 'Enhance only the Journal / patent no. / year / details field.'; enh.setAttribute('aria-label', enh.title);
    paintPage(page,sid,i); paintAlign(cjlr,sid,i);
    [page,cjlr,comp,enh].forEach(b => h.appendChild(b));
    page.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); const n = getPage(sid,i) % 4 + 1; setPage(sid,i,n); paintPage(page,sid,i); };
    cjlr.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); const cur = getAlign(sid,i); const n = ALIGN[(ALIGN.indexOf(cur)+1) % ALIGN.length] || 'center'; setAlign(sid,i,n); paintAlign(cjlr,sid,i); applyAlign(row,n); };
    comp.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); const f = allFields(row)[1]; setFieldValue(f, compressText(fieldValue(f))); pulse('publications-compress', { sid, index:i }); };
    enh.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); const f = allFields(row)[1]; setFieldValue(f, enhanceText(fieldValue(f))); pulse('publications-enhance', { sid, index:i }); };
    applyAlign(row, getAlign(sid,i));
    normalizeNativeButtons(row);
  }

  let lock = false, pending = false;
  function run(){
    if (lock) return;
    lock = true;
    try {
      const root = panelRoot();
      const sec = pubSection();
      if (!root || !sec || !sec.id) return;
      removeOldInjected(root);
      const rs = rows(root);
      rs.forEach((r,i) => wireRow(r, sec.id, i));
      cleanupOrphans(root, rs);
    } finally { lock = false; }
  }
  function soon(){
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => { pending = false; run(); });
  }
  function css(){
    if (document.getElementById('antcv-publications-row-controls-269-css')) return;
    const s = document.createElement('style');
    s.id = 'antcv-publications-row-controls-269-css';
    s.textContent = `
      [data-antcv-pub269-row="1"]{display:flex!important;align-items:center!important;gap:3px!important;flex-wrap:nowrap!important;max-width:calc(100% - 8px)!important;overflow:visible!important;box-sizing:border-box!important;}
      [data-antcv-pub269-row="1"] input,[data-antcv-pub269-row="1"] textarea,[data-antcv-pub269-row="1"] [contenteditable="true"]{min-width:0!important;box-sizing:border-box!important;flex-shrink:1!important;}
      [data-antcv-pub269-row="1"] input:nth-of-type(1){width:52px!important;max-width:78px!important;flex:0 1 60px!important;order:1!important;}
      [data-antcv-pub269-row="1"] input:nth-of-type(2){width:175px!important;max-width:185px!important;flex:1 1 160px!important;order:2!important;}
      [data-antcv-pub269-host="1"]{display:inline-flex!important;align-items:center!important;gap:2px!important;white-space:nowrap!important;flex:0 0 auto!important;order:40!important;position:static!important;float:none!important;margin-left:2px!important;}
      [data-antcv-pub269-row="1"] button{width:24px!important;min-width:24px!important;max-width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;margin:0!important;flex:0 0 auto!important;position:static!important;float:none!important;box-sizing:border-box!important;}
      [data-antcv-pub269-row="1"] button[data-antcv-pub269-control="page"]{width:31px!important;min-width:31px!important;max-width:31px!important;font-size:10px!important;}
      [data-antcv-pub269-eye="1"]{order:50!important;}
      [data-antcv-pub269-delete="1"]{order:60!important;}
      [data-antcv-pub269-move="1"]{order:90!important;}
      [data-antcv-pub269-detail-align="center"]{text-align:center!important;}
      [data-antcv-pub269-detail-align="justify"]{text-align:justify!important;}
      [data-antcv-pub269-detail-align="left"]{text-align:left!important;}
      [data-antcv-pub269-detail-align="right"]{text-align:right!important;}
    `;
    (document.head || document.documentElement).appendChild(s);
  }
  function start(){
    css(); run(); [80,180,400,900,1600,2600].forEach(ms => setTimeout(run,ms));
    try { new MutationObserver(soon).observe(document.body || document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','value'] }); } catch(_) {}
    window.addEventListener('click', () => setTimeout(run,0), true);
    window.addEventListener('input', () => setTimeout(run,0), true);
    window.addEventListener('antcv:sections-updated', () => setTimeout(run,0));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true }); else start();
  window.AntcvPublicationsRowControls269 = { version: VERSION, run };
})();
