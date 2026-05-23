/* AntCV v1.40.267
 * Publications & Patent row-control repair plus Core Competencies / What I Bring width guard.
 * - Publications rows keep native delete/visibility/move buttons.
 * - Injects missing Page and CJLR controls beside Compress and Enhance.
 * - Page cycles item page 1..4. CJLR cycles Center, Justify, Left, Right.
 * - Compress and Enhance edit only the descriptive/detail field, never the publication/patent name.
 * - Tightens Core Competencies and What I Bring editors so row controls stay left of the vertical scrollbar.
 */
(function(){
  'use strict';
  const VERSION='1.40.267';
  if(window.__antcvPubCoreWibLayout267===VERSION) return;
  window.__antcvPubCoreWibLayout267=VERSION;

  const PAGE_KEY='antcv:itemPages';
  const ALIGN_KEY='antcvItemAlignment';
  const SECTIONS_KEY='sections';
  const ALIGN=['center','justify','left','right'];
  const ICON={center:'↔',justify:'☰',left:'⇤',right:'⇥'};
  const LABEL={center:'Center',justify:'Justify',left:'Left',right:'Right'};
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const low=s=>clean(s).toLowerCase();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  const parse=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}};
  const write=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v||{}));}catch(_){}};
  const doc=()=>{try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}};
  const esc=s=>window.CSS&&CSS.escape?CSS.escape(String(s)):String(s).replace(/["\\]/g,'\\$&');
  function pulse(source,detail){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:Object.assign({source,version:VERSION},detail||{})}));}catch(_){} }
  function fire(el){['input','change'].forEach(t=>{try{el&&el.dispatchEvent(new Event(t,{bubbles:true}));}catch(_){}});}
  function getSections(){const all=parse(SECTIONS_KEY,{}); return Array.isArray(all[doc()])?all[doc()]:[];}
  function pubSection(){return getSections().find(s=>s&&String(s.loc||'').toLowerCase()==='sidebar'&&/publication|patent/i.test([s.title,s.name,s.type,s.id].join(' ')))||getSections().find(s=>s&&/publication|patent/i.test([s.title,s.name,s.type,s.id].join(' ')))||null;}
  function panelRoot(){
    const heads=Array.from(document.querySelectorAll('h1,h2,h3,b,strong,div,span')).filter(visible);
    for(const h of heads){
      const t=clean(h.textContent||'');
      if(!/publications?\s*(?:&|and)\s*patent/i.test(t) || t.length>100) continue;
      let p=h;
      for(let i=0;p&&p!==document.body&&i<9;i++,p=p.parentElement){
        const txt=clean(p.textContent||'');
        if(/cv preview|docx/i.test(txt)) continue;
        if(/publications?\s*(?:&|and)\s*patent/i.test(txt) && /←\s*back/i.test(txt) && /\+\s*(publication|entry)/i.test(txt)) return p;
      }
    }
    return null;
  }
  function rowForField(f,root){
    let p=f.parentElement,best=null;
    for(let d=0;p&&p!==root.parentElement&&d<8;d++,p=p.parentElement){
      const fs=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
      if(fs.length>=2 && fs.length<=5) best=p;
    }
    return best;
  }
  function pubRows(root){
    if(!root) return [];
    const old=Array.from(root.querySelectorAll('[data-antcv-pub-row="1"]')).filter(visible);
    if(old.length) return old;
    const fields=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>visible(f)&&/publication|patent|journal|details/i.test([f.value,f.placeholder,f.textContent].join(' ')));
    const out=[];
    fields.forEach(f=>{const r=rowForField(f,root); if(r&&!out.includes(r)) out.push(r);});
    return out;
  }
  function fields(row){return Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);}
  function val(f){return f?(f.value!==undefined?String(f.value):String(f.textContent||'')):'';}
  function setVal(f,v){if(!f)return; if(f.value!==undefined)f.value=v; else f.textContent=v; fire(f);}
  function key(i){return 'items.'+i;}
  function getAlign(sid,i){const m=parse(ALIGN_KEY,{}); const b=m[sid]||{}; const v=b[key(i)]||b[String(i)]||'left'; return ALIGN.includes(v)?v:'left';}
  function setAlign(sid,i,v){const m=parse(ALIGN_KEY,{}); if(!m[sid]||typeof m[sid]!=='object')m[sid]={}; m[sid][key(i)]=v; m[sid][String(i)]=v; write(ALIGN_KEY,m); pulse('publications-align',{sid,index:i,alignment:v});}
  function getPage(sid,i){const m=parse(PAGE_KEY,{}); const b=m[sid]||{}; const n=Number(b[String(i)]||b[key(i)]||1); return Number.isFinite(n)&&n>=1&&n<=4?(n|0):1;}
  function setPage(sid,i,n){const m=parse(PAGE_KEY,{}); if(!m[sid]||typeof m[sid]!=='object')m[sid]={}; m[sid][String(i)]=n; write(PAGE_KEY,m); pulse('publications-page',{sid,index:i,page:n});}
  function compressText(s){return clean(s).replace(/\b(published in|publication in)\b/ig,'in').replace(/\bpatent number\b/ig,'patent').replace(/\bapproximately\b/ig,'approx.').replace(/\s+([,.;:])/g,'$1');}
  function enhanceText(s){let t=clean(s); if(!t||/^\[.*\]$/.test(t)) return t; if(!/[.!?]$/.test(t)&&t.length>80)t+='.'; return t;}
  function isDelete(b){const t=low((b.textContent||'')+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||'')); return t==='×'||t==='x'||/delete|remove|✕/.test(t);}
  function isEye(b){const t=low((b.textContent||'')+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||'')); return /👁|eye|visible|hide|show|monkey|🙈/.test(t);}
  function isMove(b){const t=low((b.textContent||'')+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||'')); return /▲|▼|move up|move down/.test(t);}
  function button(kind){
    const b=document.createElement('button'); b.type='button'; b.setAttribute('data-antcv-pub267',kind);
    Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:kind==='page'?'31px':'24px',minWidth:kind==='page'?'31px':'24px',height:'22px',minHeight:'22px',padding:'0',margin:'0',borderRadius:'5px',background:'#fff',fontSize:kind==='page'?'10px':'12px',fontWeight:'700',lineHeight:'1',cursor:'pointer',boxSizing:'border-box',flex:'0 0 auto',position:'static',float:'none'});
    if(kind==='compress'||kind==='cjlr'){b.style.border='1px solid #7b2ff2';b.style.color='#7b2ff2';b.style.background='rgba(123,47,242,.06)';}
    else if(kind==='enhance'){b.style.border='1px solid #ff8a00';b.style.color='#ff8a00';b.style.background='rgba(255,138,0,.06)';}
    else {b.style.border='1px solid #01B7BB';b.style.color='#00746E';b.style.background='rgba(1,183,187,.08)';}
    return b;
  }
  function host(row){
    let h=row.querySelector(':scope > [data-antcv-pub267-host="1"]');
    if(!h){h=document.createElement('span'); h.setAttribute('data-antcv-pub267-host','1'); Object.assign(h.style,{display:'inline-flex',alignItems:'center',gap:'2px',whiteSpace:'nowrap',marginLeft:'3px',marginRight:'3px',flex:'0 0 auto',position:'static',float:'none'}); row.appendChild(h);}
    return h;
  }
  function paintPage(b,sid,i){const p=getPage(sid,i); b.textContent='📄'+p; b.title='Publications & Patent row page: '+p+'. Click to cycle page 1-4.'; b.setAttribute('aria-label',b.title);}
  function paintAlign(b,sid,i){const a=getAlign(sid,i); b.textContent=ICON[a]||ICON.left; b.title='Publication detail alignment: '+(LABEL[a]||a)+'. Click to cycle Center, Justify, Left, Right.'; b.setAttribute('aria-label',b.title);}
  function applyDetailAlign(row,a){const f=fields(row)[1]; if(f){f.style.textAlign=a; f.setAttribute('data-antcv-pub267-detail-align',a);} }
  function wirePub(row,sid,i){
    row.setAttribute('data-antcv-pub-row','1'); row.setAttribute('data-antcv-pub267-row','1'); row.style.maxWidth='100%'; row.style.boxSizing='border-box';
    // Remove older injected controls, but keep native delete/eye/up/down buttons.
    row.querySelectorAll('[data-antcv-pub-controls-host="1"],[data-antcv-pub-control],[data-antcv-pub-injected],[data-antcv-pub-mini-kind]').forEach(x=>x.remove());
    const h=host(row); h.innerHTML='';
    const page=button('page'), cjlr=button('cjlr'), comp=button('compress'), enh=button('enhance');
    comp.textContent='⇥⇤'; comp.title='Compress only the descriptive part of this Publications & Patent row.'; comp.setAttribute('aria-label',comp.title);
    enh.textContent='✨'; enh.title='Enhance only the descriptive part of this Publications & Patent row.'; enh.setAttribute('aria-label',enh.title);
    paintPage(page,sid,i); paintAlign(cjlr,sid,i); [page,cjlr,comp,enh].forEach(b=>h.appendChild(b));
    page.onclick=e=>{e.preventDefault();e.stopPropagation();const n=getPage(sid,i)%4+1;setPage(sid,i,n);paintPage(page,sid,i);};
    cjlr.onclick=e=>{e.preventDefault();e.stopPropagation();const cur=getAlign(sid,i);const nxt=ALIGN[(ALIGN.indexOf(cur)+1)%ALIGN.length]||'center';setAlign(sid,i,nxt);paintAlign(cjlr,sid,i);applyDetailAlign(row,nxt);};
    comp.onclick=e=>{e.preventDefault();e.stopPropagation();const f=fields(row)[1]; setVal(f,compressText(val(f))); pulse('publications-compress',{sid,index:i});};
    enh.onclick=e=>{e.preventDefault();e.stopPropagation();const f=fields(row)[1]; setVal(f,enhanceText(val(f))); pulse('publications-enhance',{sid,index:i});};
    applyDetailAlign(row,getAlign(sid,i));
    Array.from(row.querySelectorAll('button')).forEach(b=>{if(b.closest('[data-antcv-pub267-host="1"]')) return; if(isEye(b)) b.setAttribute('data-antcv-pub267-eye','1'); else if(isDelete(b)) b.setAttribute('data-antcv-pub267-delete','1'); else if(isMove(b)) b.setAttribute('data-antcv-pub267-move','1');});
  }
  let pending=false;
  function run(){
    const sec=pubSection(); const root=panelRoot(); if(sec&&sec.id&&root) pubRows(root).forEach((r,i)=>wirePub(r,sec.id,i));
  }
  function soon(){if(pending)return; pending=true; requestAnimationFrame(()=>{pending=false;run();});}
  function css(){
    if(document.getElementById('antcv-publications-core-wib-layout-267-css')) return;
    const s=document.createElement('style'); s.id='antcv-publications-core-wib-layout-267-css';
    s.textContent=`
      [data-antcv-core-row="1"], [data-antcv-wib264-row="1"], [data-antcv-pub267-row="1"]{max-width:calc(100% - 28px)!important;box-sizing:border-box!important;overflow:visible!important;}
      [data-antcv-core-row="1"] input, [data-antcv-core-row="1"] textarea, [data-antcv-core-row="1"] [contenteditable="true"],
      [data-antcv-wib264-row="1"] input, [data-antcv-wib264-row="1"] textarea, [data-antcv-wib264-row="1"] [contenteditable="true"]{min-width:0!important;box-sizing:border-box!important;flex-shrink:1!important;}
      [data-antcv-core-row="1"] input:nth-of-type(1), [data-antcv-wib264-row="1"] input:nth-of-type(1){width:132px!important;max-width:132px!important;flex:0 1 132px!important;}
      [data-antcv-core-row="1"] input:nth-of-type(2), [data-antcv-wib264-row="1"] input:nth-of-type(2){width:138px!important;max-width:138px!important;flex:0 1 138px!important;}
      [data-antcv-core-row="1"] button, [data-antcv-wib264-row="1"] button{flex:0 0 auto!important;position:static!important;float:none!important;}
      [data-antcv-pub267-row="1"]{display:flex!important;align-items:center!important;gap:3px!important;flex-wrap:wrap!important;}
      [data-antcv-pub267-row="1"] input, [data-antcv-pub267-row="1"] textarea, [data-antcv-pub267-row="1"] [contenteditable="true"]{min-width:0!important;box-sizing:border-box!important;flex-shrink:1!important;}
      [data-antcv-pub267-row="1"] input:nth-of-type(1){width:104px!important;max-width:112px!important;flex:0 1 104px!important;}
      [data-antcv-pub267-row="1"] input:nth-of-type(2){width:150px!important;max-width:160px!important;flex:1 1 145px!important;}
      [data-antcv-pub267-host="1"]{display:inline-flex!important;align-items:center!important;gap:2px!important;white-space:nowrap!important;order:40!important;}
      [data-antcv-pub267-host="1"] button{position:static!important;float:none!important;flex:0 0 auto!important;}
      [data-antcv-pub267-eye="1"]{order:10!important;}
      [data-antcv-pub267-host="1"]{order:40!important;}
      [data-antcv-pub267-delete="1"]{order:80!important;}
      [data-antcv-pub267-move="1"]{order:90!important;}
      [data-antcv-pub267-detail-align="center"]{text-align:center!important;}
      [data-antcv-pub267-detail-align="justify"]{text-align:justify!important;}
      [data-antcv-pub267-detail-align="left"]{text-align:left!important;}
      [data-antcv-pub267-detail-align="right"]{text-align:right!important;}
    `;
    (document.head||document.documentElement).appendChild(s);
  }
  function start(){css(); run(); [100,250,600,1200,2200].forEach(ms=>setTimeout(run,ms)); try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){} window.addEventListener('click',()=>setTimeout(run,0),true); window.addEventListener('input',()=>setTimeout(run,0),true); window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.AntcvPubCoreWibLayout267={version:VERSION,run};
})();
