/* AntCV v1.40.271
 * Publications & Patent row controls - hard placement repair.
 *
 * Purpose:
 * - Keep all row controls on the same publication row.
 * - Add missing Page and CJLR controls.
 * - Keep Compress and Enhance bound only to the second textbox
 *   (Journal / patent no. / year / details).
 * - Keep native Visibility and Delete row buttons, but make them compact.
 * - Remove orphaned/duplicated controls left at the panel bottom or next to
 *   the + Publication button by older overlay patches.
 */
(function(){
  'use strict';
  const VERSION = '1.40.271';
  if (window.__antcvPublicationsRowControls271 === VERSION) return;
  window.__antcvPublicationsRowControls271 = VERSION;

  const PAGE_KEY = 'antcv:itemPages';
  const ALIGN_KEY = 'antcvItemAlignment';
  const SECTIONS_KEY = 'sections';
  const ALIGN = ['center','justify','left','right'];
  const ICON = { center:'↔', justify:'☰', left:'⇤', right:'⇥' };
  const LABEL = { center:'Center', justify:'Justify', left:'Left', right:'Right' };

  const clean = s => String(s || '').replace(/\s+/g,' ').trim();
  const low = s => clean(s).toLowerCase();
  const visible = el => !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const parse = (k,f) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v && typeof v === 'object' ? v : f; } catch(_) { return f; } };
  const write = (k,v) => { try { localStorage.setItem(k, JSON.stringify(v || {})); } catch(_) {} };
  const docKind = () => { try { return localStorage.getItem('doc') === 'cl' ? 'cl' : 'cv'; } catch(_) { return 'cv'; } };
  const fieldText = f => clean([f && f.value, f && f.placeholder, f && f.textContent, f && f.getAttribute && f.getAttribute('aria-label')].join(' '));

  function pulse(source, detail){
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: Object.assign({ source, version: VERSION }, detail || {}) })); } catch(_) {}
  }
  function fire(el){
    if (!el) return;
    ['input','change'].forEach(t => { try { el.dispatchEvent(new Event(t, { bubbles:true })); } catch(_) {} });
  }
  function getValue(el){ return el ? (el.value !== undefined ? String(el.value) : String(el.textContent || '')) : ''; }
  function setValue(el,v){ if (!el) return; if (el.value !== undefined) el.value = v; else el.textContent = v; fire(el); }
  function sections(){
    const all = parse(SECTIONS_KEY, {});
    return Array.isArray(all[docKind()]) ? all[docKind()] : [];
  }
  function pubSection(){
    return sections().find(s => s && String(s.loc || '').toLowerCase() === 'sidebar' && /publication|patent/i.test([s.id,s.title,s.name,s.type].join(' '))) ||
           sections().find(s => s && /publication|patent/i.test([s.id,s.title,s.name,s.type].join(' '))) ||
           { id:'publications' };
  }
  function panelRoot(){
    const heads = Array.from(document.querySelectorAll('h1,h2,h3,b,strong,div,span')).filter(visible);
    for (const h of heads) {
      const t = clean(h.textContent || '');
      if (!/publications?\s*(?:&|and)\s*patent/i.test(t) || t.length > 90) continue;
      let p = h;
      for (let i=0; p && p !== document.body && i < 12; i++, p = p.parentElement) {
        const txt = clean(p.textContent || '');
        if (/cv preview|docx/i.test(txt)) continue;
        if (/publications?\s*(?:&|and)\s*patent/i.test(txt) && /←\s*back/i.test(txt) && /\+\s*(publication|entry)/i.test(txt)) return p;
      }
    }
    return null;
  }
  function getPage(sid,i){
    const m = parse(PAGE_KEY, {}); const b = m[sid] || {};
    const n = Number(b[String(i)] || b['items.' + i] || 1);
    return Number.isFinite(n) && n >= 1 && n <= 4 ? (n|0) : 1;
  }
  function setPage(sid,i,n){
    const m = parse(PAGE_KEY, {}); if (!m[sid] || typeof m[sid] !== 'object') m[sid] = {};
    m[sid][String(i)] = n; m[sid]['items.' + i] = n;
    write(PAGE_KEY, m); pulse('publications-page', { sid, index:i, page:n });
  }
  function getAlign(sid,i){
    const m = parse(ALIGN_KEY, {}); const b = m[sid] || {};
    const v = b['items.' + i] || b[String(i)] || 'left';
    return ALIGN.includes(v) ? v : 'left';
  }
  function setAlign(sid,i,v){
    const m = parse(ALIGN_KEY, {}); if (!m[sid] || typeof m[sid] !== 'object') m[sid] = {};
    m[sid]['items.' + i] = v; m[sid][String(i)] = v;
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
  function isNameField(f){ return /publication\s*name|^publ|patent\s*name/i.test(fieldText(f)); }
  function isDetailField(f){ return /journal|patent\s*no|year|details?/i.test(fieldText(f)); }
  function fields(root){ return Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible); }
  function commonAncestor(a,b,root){
    const seen = new Set(); let p = a;
    while (p && p !== root.parentElement) { seen.add(p); p = p.parentElement; }
    p = b;
    while (p && p !== root.parentElement) { if (seen.has(p)) return p; p = p.parentElement; }
    return null;
  }
  function rowForPair(name, detail, root){
    let ca = commonAncestor(name, detail, root) || detail.parentElement || name.parentElement;
    let best = ca;
    for (let i=0, p=ca; p && p !== root && i < 6; i++, p=p.parentElement) {
      const fs = fields(p);
      const txt = clean(p.textContent || '');
      if (fs.includes(name) && fs.includes(detail) && fs.length <= 4 && !/\+\s*publication/i.test(txt)) best = p;
    }
    return best;
  }
  function publicationRows(root){
    const fs = fields(root);
    const pairs = [];
    for (let i=0; i<fs.length; i++) {
      const a = fs[i], b = fs[i+1];
      if (!a || !b) continue;
      if ((isNameField(a) || /publ/i.test(getValue(a))) && isDetailField(b)) {
        const row = rowForPair(a,b,root);
        if (row && !pairs.some(x => x.row === row)) pairs.push({ row, name:a, detail:b });
      }
    }
    // Fallback: pair fields on the same compact row when placeholders were changed.
    if (!pairs.length) {
      for (let i=0; i<fs.length-1; i+=2) {
        const row = rowForPair(fs[i], fs[i+1], root);
        if (row && !/\+\s*publication/i.test(clean(row.textContent || ''))) pairs.push({ row, name:fs[i], detail:fs[i+1] });
      }
    }
    return pairs;
  }
  function buttonText(b){ return low((b.textContent||'') + ' ' + (b.title||'') + ' ' + (b.getAttribute('aria-label')||'')); }
  function isEyeButton(b){ const t = buttonText(b); return /👁|eye|visible|visibility|hide|show|monkey|🙈/.test(t); }
  function isDeleteButton(b){ const t = buttonText(b); return t === 'x' || t === '×' || /delete|remove|✕/.test(t); }
  function isMoveButton(b){ const t = buttonText(b); return /▲|▼|move up|move down/.test(t); }
  function makeBtn(kind){
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-pub271-control', kind);
    Object.assign(b.style, {
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width: kind === 'page' ? '30px' : '24px', minWidth: kind === 'page' ? '30px' : '24px', maxWidth: kind === 'page' ? '30px' : '24px',
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

  function purge(root){
    if (!root) return;
    root.querySelectorAll([
      '[data-antcv-pub269-host="1"]','[data-antcv-pub271-host="1"]',
      '[data-antcv-pub267-host="1"]','[data-antcv-pub-controls-host="1"]',
      'button[data-antcv-pub269-control]','button[data-antcv-pub271-control]',
      'button[data-antcv-pub-control]','button[data-antcv-pub267]',
      'button[data-antcv-pub-injected]','button[data-antcv-pub-mini-kind]'
    ].join(',')).forEach(el => el.remove());
    // Remove orphan controls left directly under panel or around the + Publication line.
    Array.from(root.querySelectorAll('button')).forEach(b => {
      const t = buttonText(b);
      const isOurKind = /📄|cjlr|alignment|compress|enhance|⇥⇤|✨|↔|☰|⇤|⇥/.test(t + ' ' + (b.textContent||''));
      if (!isOurKind) return;
      const row = b.closest('[data-antcv-pub271-row="1"]');
      if (!row) b.remove();
    });
  }
  function compactNative(row){
    Array.from(row.querySelectorAll('button')).forEach(b => {
      if (b.closest('[data-antcv-pub271-host="1"]')) return;
      Object.assign(b.style, {
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:'24px', minWidth:'24px', maxWidth:'24px', height:'22px', minHeight:'22px',
        padding:'0', margin:'0', flex:'0 0 auto', position:'static', float:'none', boxSizing:'border-box'
      });
      if (isEyeButton(b)) { b.setAttribute('data-antcv-pub271-eye','1'); b.style.order = '70'; }
      else if (isDeleteButton(b)) { b.setAttribute('data-antcv-pub271-delete','1'); b.style.order = '80'; }
      else if (isMoveButton(b)) { b.setAttribute('data-antcv-pub271-move','1'); b.style.order = '90'; }
      else { b.style.order = '85'; }
    });
  }
  function ensureHost(row){
    let h = row.querySelector(':scope > [data-antcv-pub271-host="1"]');
    if (!h) {
      h = document.createElement('span');
      h.setAttribute('data-antcv-pub271-host','1');
      Object.assign(h.style, { display:'inline-flex', alignItems:'center', gap:'2px', whiteSpace:'nowrap', flex:'0 0 auto', order:'40', position:'static', float:'none', marginLeft:'2px' });
      row.appendChild(h);
    }
    return h;
  }
  function wire(pair, sid, index){
    const { row, name, detail } = pair;
    row.setAttribute('data-antcv-pub271-row','1');
    row.setAttribute('data-antcv-pub-row-index', String(index));
    Object.assign(row.style, { display:'flex', alignItems:'center', gap:'3px', flexWrap:'nowrap', maxWidth:'100%', overflow:'visible', boxSizing:'border-box' });
    Object.assign(name.style, { order:'10', minWidth:'0', width:'52px', maxWidth:'72px', flex:'0 1 58px', boxSizing:'border-box' });
    Object.assign(detail.style, { order:'20', minWidth:'0', width:'150px', maxWidth:'170px', flex:'1 1 145px', boxSizing:'border-box', textAlign:getAlign(sid,index) });
    const h = ensureHost(row);
    h.innerHTML = '';
    const page = makeBtn('page');
    const cjlr = makeBtn('cjlr');
    const comp = makeBtn('compress');
    const enh = makeBtn('enhance');
    comp.textContent = '⇥⇤'; comp.title = 'Compress only the Journal / patent no. / year / details field.'; comp.setAttribute('aria-label', comp.title);
    enh.textContent = '✨'; enh.title = 'Enhance only the Journal / patent no. / year / details field.'; enh.setAttribute('aria-label', enh.title);
    paintPage(page,sid,index); paintAlign(cjlr,sid,index);
    [page,cjlr,comp,enh].forEach(b => h.appendChild(b));
    page.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); const n = getPage(sid,index) % 4 + 1; setPage(sid,index,n); paintPage(page,sid,index); };
    cjlr.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); const cur = getAlign(sid,index); const n = ALIGN[(ALIGN.indexOf(cur)+1) % ALIGN.length] || 'center'; setAlign(sid,index,n); paintAlign(cjlr,sid,index); detail.style.textAlign = n; };
    comp.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); setValue(detail, compressText(getValue(detail))); pulse('publications-compress', { sid, index }); };
    enh.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); setValue(detail, enhanceText(getValue(detail))); pulse('publications-enhance', { sid, index }); };
    compactNative(row);
  }

  let pending = false;
  function run(){
    const root = panelRoot(); if (!root) return;
    const sid = (pubSection() || {}).id || 'publications';
    purge(root);
    const pairs = publicationRows(root);
    pairs.forEach((p,i) => wire(p, sid, i));
  }
  function soon(){ if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; run(); }); }
  function css(){
    if (document.getElementById('antcv-publications-row-controls-271-css')) return;
    const s = document.createElement('style');
    s.id = 'antcv-publications-row-controls-271-css';
    s.textContent = `
      [data-antcv-pub271-row="1"]{display:flex!important;align-items:center!important;gap:3px!important;flex-wrap:nowrap!important;max-width:100%!important;overflow:visible!important;box-sizing:border-box!important;}
      [data-antcv-pub271-row="1"] input,[data-antcv-pub271-row="1"] textarea,[data-antcv-pub271-row="1"] [contenteditable="true"]{min-width:0!important;box-sizing:border-box!important;flex-shrink:1!important;}
      [data-antcv-pub271-row="1"] [data-antcv-pub271-host="1"]{display:inline-flex!important;align-items:center!important;gap:2px!important;white-space:nowrap!important;flex:0 0 auto!important;order:40!important;position:static!important;float:none!important;margin-left:2px!important;}
      [data-antcv-pub271-row="1"] button{width:24px!important;min-width:24px!important;max-width:24px!important;height:22px!important;min-height:22px!important;padding:0!important;margin:0!important;flex:0 0 auto!important;position:static!important;float:none!important;box-sizing:border-box!important;}
      [data-antcv-pub271-row="1"] button[data-antcv-pub271-control="page"]{width:30px!important;min-width:30px!important;max-width:30px!important;font-size:10px!important;}
      [data-antcv-pub271-eye="1"]{order:70!important;}
      [data-antcv-pub271-delete="1"]{order:80!important;}
      [data-antcv-pub271-move="1"]{order:90!important;}
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
  window.AntcvPublicationsRowControls271 = { version: VERSION, run };
})();
