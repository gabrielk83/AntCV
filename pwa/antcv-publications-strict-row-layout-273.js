/* AntCV Publications & Patent strict row layout (v1.40.273)
 * Fixes the Publications & Patent subsubsection row controls:
 * - all controls stay inside the row, left of the vertical scrollbar
 * - Page + CJLR are present
 * - Compress + Enhance only edit the second textbox
 * - native eye/delete/up/down stay connected
 * - orphan/duplicate controls near + Publication or panel bottom are removed
 */
(function(){
  'use strict';
  const VERSION='1.50.682-pub-host-shrink';
  if(window.__antcvPublicationsStrictRowLayout273===VERSION) return;
  window.__antcvPublicationsStrictRowLayout273=VERSION;
  // v1.40.273-preview-guard: Preview is button-free. panelRoot() must
  // never resolve to anything inside .antcv-preview-paper. PP-003
  // territory — this is an EXCLUSION-ONLY change (never broadens
  // detection), so the layout pipeline behaves identically for the
  // editor panel; we just refuse to mount inside Preview.
  const isInPreviewPaper=el=>{if(!el)return false;const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');return !!(p&&p.contains(el));};

  const PAGE_KEY='antcv:itemPages';
  const ALIGN_KEY='antcvItemAlignment';
  const SECTIONS_KEY='sections';
  const ALIGNS=['center','justify','left','right'];
  const AICON={center:'↔',justify:'☰',left:'⇤',right:'⇥'};
  const ALABEL={center:'Center',justify:'Justify',left:'Left',right:'Right'};

  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const low=s=>clean(s).toLowerCase();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  const parse=(key,f)=>{try{const v=JSON.parse(localStorage.getItem(key)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}};
  const write=(key,val)=>{try{localStorage.setItem(key,JSON.stringify(val||{}));}catch(_){}};
  const doc=()=>{try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}};

  function fire(source,detail){
    try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:Object.assign({source,version:VERSION},detail||{})}));}catch(_){}
    try{window.dispatchEvent(new Event('input'));}catch(_){}
  }
  function inputText(f){return clean([f&&f.value,f&&f.placeholder,f&&f.textContent,f&&f.getAttribute&&f.getAttribute('aria-label'),f&&f.title].join(' '));}
  function value(f){return f?(f.value!==undefined?String(f.value):String(f.textContent||'')):'';}
  function setValue(f,v){if(!f)return;if(f.value!==undefined)f.value=v;else f.textContent=v;['input','change'].forEach(t=>{try{f.dispatchEvent(new Event(t,{bubbles:true}));}catch(_){}});}
  function sections(){const all=parse(SECTIONS_KEY,{});return Array.isArray(all[doc()])?all[doc()]:[];}
  function pubSection(){return sections().find(s=>s&&String(s.loc||'').toLowerCase()==='sidebar'&&/publication|patent/i.test([s.id,s.title,s.name,s.type].join(' ')))||sections().find(s=>s&&/publication|patent/i.test([s.id,s.title,s.name,s.type].join(' ')))||{id:'publications'};}

  function panelRoot(){
    const nodes=Array.from(document.querySelectorAll('h1,h2,h3,b,strong,div,span')).filter(n=>visible(n)&&!isInPreviewPaper(n));
    for(const h of nodes){
      const ht=clean(h.textContent||'');
      if(!/publications?\s*(?:&|and)\s*patent/i.test(ht)||ht.length>120) continue;
      let p=h;
      for(let d=0;p&&p!==document.body&&d<10;d++,p=p.parentElement){
        if(isInPreviewPaper(p)) break;
        const txt=clean(p.textContent||'');
        if(/cv preview|docx/i.test(txt)) continue;
        if(/publications?\s*(?:&|and)\s*patent/i.test(txt)&&/←\s*back/i.test(txt)&&/\+\s*(publication|entry)/i.test(txt)) return p;
      }
    }
    return null;
  }

  function getPage(sid,i){const m=parse(PAGE_KEY,{}),b=m[sid]||{};const n=Number(b[String(i)]||b['items.'+i]||1);return Number.isFinite(n)&&n>=1&&n<=4?n|0:1;}
  function setPage(sid,i,n){const m=parse(PAGE_KEY,{});if(!m[sid]||typeof m[sid]!=='object')m[sid]={};m[sid][String(i)]=n;m[sid]['items.'+i]=n;write(PAGE_KEY,m);fire('publications-page',{sid,index:i,page:n});}
  function getAlign(sid,i){const m=parse(ALIGN_KEY,{}),b=m[sid]||{};const v=b['items.'+i]||b[String(i)]||'left';return ALIGNS.includes(v)?v:'left';}
  function setAlign(sid,i,v){const m=parse(ALIGN_KEY,{});if(!m[sid]||typeof m[sid]!=='object')m[sid]={};m[sid]['items.'+i]=v;m[sid][String(i)]=v;write(ALIGN_KEY,m);fire('publications-align',{sid,index:i,alignment:v});}
  function compressText(s){return clean(s).replace(/\bpublished in\b/ig,'in').replace(/\bpublication in\b/ig,'in').replace(/\bpatent number\b/ig,'patent').replace(/\bapproximately\b/ig,'approx.').replace(/\s+([,.;:])/g,'$1');}
  function enhanceText(s){let t=clean(s);if(!t||/^\[.*\]$/.test(t))return t;if(!/[.!?]$/.test(t)&&t.length>80)t+='.';return t;}

  function isNameField(f){return /publication\s*name|patent\s*name|^publ/i.test(inputText(f));}
  function isDetailField(f){return /journal|patent\s*no|patent number|year|detail/i.test(inputText(f));}
  function fields(root){return Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);}
  function common(a,b,limit){const seen=new Set();for(let p=a;p&&p!==limit.parentElement;p=p.parentElement)seen.add(p);for(let p=b;p&&p!==limit.parentElement;p=p.parentElement){if(seen.has(p))return p;}return null;}
  function rowOf(a,b,root){
    let ca=common(a,b,root)||b.parentElement||a.parentElement;
    let best=ca;
    for(let d=0,p=ca;p&&p!==root.parentElement&&d<7;d++,p=p.parentElement){
      const fs=fields(p);const txt=clean(p.textContent||'');
      if(fs.includes(a)&&fs.includes(b)&&fs.length<=4&&!/\+\s*publication/i.test(txt)) best=p;
    }
    return best;
  }
  function rows(root){
    const fs=fields(root), out=[];
    for(let i=0;i<fs.length-1;i++){
      const a=fs[i], b=fs[i+1];
      if((isNameField(a)||/publ/i.test(value(a)))&&isDetailField(b)){
        const row=rowOf(a,b,root); if(row&&!out.some(x=>x.row===row)) out.push({row,name:a,detail:b});
      }
    }
    if(!out.length){
      for(let i=0;i<fs.length-1;i+=2){
        const row=rowOf(fs[i],fs[i+1],root); if(row&&!/\+\s*publication/i.test(clean(row.textContent||''))&&!out.some(x=>x.row===row)) out.push({row,name:fs[i],detail:fs[i+1]});
      }
    }
    return out;
  }
  function btext(b){return low((b.textContent||'')+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||''));}
  function isNativeEye(b){return /👁|🙈|eye|visible|visibility|hide|show/.test(btext(b));}
  function isNativeDelete(b){const t=btext(b);return t==='x'||t==='×'||/delete|remove/.test(t);}
  function isNativeMove(b){return /▲|▼|move up|move down/.test(btext(b));}
  function isOurOrphan(b){return b.matches('[data-antcv-pub273-control],[data-antcv-pub271-control],[data-antcv-pub269-control],[data-antcv-pub-control],[data-antcv-pub267],button[data-antcv-pub-injected],button[data-antcv-pub-mini-kind]');}

  function make(kind){
    const b=document.createElement('button');b.type='button';b.setAttribute('data-antcv-pub273-control',kind);
    Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:kind==='page'?'30px':'23px',minWidth:kind==='page'?'30px':'23px',maxWidth:kind==='page'?'30px':'23px',height:'22px',minHeight:'22px',padding:'0',margin:'0',borderRadius:'5px',fontSize:kind==='page'?'10px':'12px',lineHeight:'1',fontWeight:'700',cursor:'pointer',boxSizing:'border-box',flex:'0 0 auto',position:'static',float:'none'});
    if(kind==='cjlr'||kind==='compress'){b.style.border='1px solid #7b2ff2';b.style.color='#7b2ff2';b.style.background='rgba(123,47,242,.06)';}
    else if(kind==='enhance'){b.style.border='1px solid #ff8a00';b.style.color='#ff8a00';b.style.background='rgba(255,138,0,.06)';}
    else {b.style.border='1px solid #01B7BB';b.style.color='#00746E';b.style.background='rgba(1,183,187,.08)';}
    return b;
  }
  function paintPage(b,sid,i){const p=getPage(sid,i);b.textContent='📄'+p;b.title='Publication row page: '+p+'. Click to cycle page 1-4.';b.setAttribute('aria-label',b.title);}
  function paintAlign(b,sid,i){const a=getAlign(sid,i);b.textContent=AICON[a]||AICON.left;b.title='Publication detail alignment: '+(ALABEL[a]||a)+'. Click to cycle.';b.setAttribute('aria-label',b.title);}
  function host(row){let h=row.querySelector(':scope > [data-antcv-pub273-host="1"]');if(!h){h=document.createElement('span');h.setAttribute('data-antcv-pub273-host','1');Object.assign(h.style,{display:'inline-flex',alignItems:'center',gap:'2px',whiteSpace:'nowrap',flex:'0 0 auto',order:'30',position:'static',float:'none',marginLeft:'2px'});row.appendChild(h);}return h;}

  function purge(root){
    root.querySelectorAll('[data-antcv-pub273-host="1"],[data-antcv-pub271-host="1"],[data-antcv-pub269-host="1"],[data-antcv-pub267-host="1"],[data-antcv-pub-controls-host="1"]').forEach(n=>n.remove());
    Array.from(root.querySelectorAll('button')).forEach(b=>{
      if(isOurOrphan(b)) b.remove();
      else if(/📄|⇥⇤|✨|↔|☰|⇤|⇥/.test(b.textContent||'')&&!b.closest('[data-antcv-pub273-row="1"]')&&!isNativeMove(b)) b.remove();
    });
  }
  function compact(row){
    Array.from(row.querySelectorAll('button')).forEach(b=>{
      if(b.closest('[data-antcv-pub273-host="1"]')) return;
      // PUB-ROW-CONTROLS-002 (owner 2026-06-18): our own row-level controls (the
      // CJLR alignment button now lives next to delete, not in the host) must not
      // be swept into the native-dup hide branch below.
      if(b.matches('[data-antcv-pub273-control]')) return;
      Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'23px',minWidth:'23px',maxWidth:'23px',height:'22px',minHeight:'22px',padding:'0',margin:'0',flex:'0 0 auto',position:'static',float:'none',boxSizing:'border-box'});
      if(isNativeEye(b)){b.setAttribute('data-antcv-pub273-eye','1');b.style.order='40';b.style.display='inline-flex';}
      else if(isNativeDelete(b)){b.setAttribute('data-antcv-pub273-delete','1');b.style.order='50';b.style.display='inline-flex';}
      // Move ▲▼ relocate to the LEFT (compact) — owner wants them off the right edge.
      else if(isNativeMove(b)){b.setAttribute('data-antcv-pub273-move','1');b.style.order='5';b.style.display='inline-flex';}
      // PUB-CONTROL-DEDUP-001 (owner 2026-06-18): the remaining NATIVE glyph
      // controls on a publication row (page / CJLR / ✨ Enhance / ⇥⇤ compress,
      // app.src.js ~6902) DUPLICATE the pub273 host's own — that is the "endless
      // CJLR / Enhance" the owner sees. Keep one set: HIDE the native glyph
      // buttons (display:none, not removed → no React removeChild churn). Native
      // eye/delete/move are kept above; the pub273 host provides page/cjlr/
      // compress/enhance once.
      else { b.style.display='none'; b.setAttribute('data-antcv-pub273-native-dup','1'); }
    });
  }
  function wire(pair,sid,i){
    const {row,name,detail}=pair;
    row.setAttribute('data-antcv-pub273-row','1');
    Object.assign(row.style,{display:'flex',alignItems:'center',gap:'3px',flexWrap:'nowrap',maxWidth:'calc(100% - 54px)',width:'calc(100% - 54px)',overflow:'visible',boxSizing:'border-box',whiteSpace:'nowrap'});
    Object.assign(name.style,{order:'10',minWidth:'0',width:'48px',maxWidth:'58px',flex:'0 1 48px',boxSizing:'border-box'});
    Object.assign(detail.style,{order:'20',minWidth:'0',width:'138px',maxWidth:'150px',flex:'1 1 128px',boxSizing:'border-box',textAlign:getAlign(sid,i)});
    const h=host(row);h.innerHTML='';
    const page=make('page'), cjlr=make('cjlr'), comp=make('compress'), enh=make('enhance');
    comp.textContent='⇥⇤';comp.title='Fit only the Journal / patent no. / year / details field.';comp.setAttribute('aria-label',comp.title);
    enh.textContent='✨';enh.title='Enhance only the Journal / patent no. / year / details field.';enh.setAttribute('aria-label',enh.title);
    paintPage(page,sid,i);paintAlign(cjlr,sid,i);
    // CJLR-NEXT-DELETE-001 (owner 2026-06-18): page / compress / enhance stay in the
    // host group; the CJLR (Center/Justify/Left/Right) alignment button moves OUT to
    // sit directly left of the delete button (row-level flex order 45, delete is 50).
    [page,comp,enh].forEach(x=>h.appendChild(x));
    cjlr.setAttribute('data-antcv-pub273-cjlr','1');cjlr.style.order='45';row.appendChild(cjlr);
    page.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();const n=getPage(sid,i)%4+1;setPage(sid,i,n);paintPage(page,sid,i);};
    cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();const n=ALIGNS[(ALIGNS.indexOf(getAlign(sid,i))+1)%ALIGNS.length]||'center';setAlign(sid,i,n);paintAlign(cjlr,sid,i);detail.style.textAlign=n;};
    comp.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();setValue(detail,compressText(value(detail)));fire('publications-compress',{sid,index:i});};
    enh.onclick=ev=>{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();setValue(detail,enhanceText(value(detail)));fire('publications-enhance',{sid,index:i});};
    compact(row);
  }
  function injectCss(){if(document.getElementById('antcv-publications-strict-row-layout-273-css'))return;const s=document.createElement('style');s.id='antcv-publications-strict-row-layout-273-css';s.textContent=`
    [data-antcv-pub273-row="1"]{display:flex!important;align-items:center!important;gap:3px!important;flex-wrap:nowrap!important;max-width:calc(100% - 54px)!important;width:calc(100% - 54px)!important;overflow:visible!important;box-sizing:border-box!important;white-space:nowrap!important;}
    [data-antcv-pub273-row="1"] input,[data-antcv-pub273-row="1"] textarea,[data-antcv-pub273-row="1"] [contenteditable="true"]{min-width:0!important;box-sizing:border-box!important;flex-shrink:1!important;}
    [data-antcv-pub273-row="1"] [data-antcv-pub273-host="1"]{display:inline-flex!important;align-items:center!important;gap:1px!important;white-space:nowrap!important;flex:0 0 auto!important;order:30!important;position:static!important;float:none!important;margin-left:1px!important;margin-right:1px!important;}
    [data-antcv-pub273-row="1"] button{width:23px!important;min-width:23px!important;max-width:23px!important;height:22px!important;min-height:22px!important;padding:0!important;margin:0!important;flex:0 0 auto!important;position:static!important;float:none!important;box-sizing:border-box!important;}
    [data-antcv-pub273-row="1"] button[data-antcv-pub273-control="page"]{width:30px!important;min-width:30px!important;max-width:30px!important;font-size:10px!important;}
    /* PUB-HOST-SHRINK-001 (owner 2026-06-18): the page / compress / enhance group
       overflowed under the neighbouring controls — make ITS buttons narrower from
       both sides (the row's other buttons keep 23px). */
    [data-antcv-pub273-row="1"] [data-antcv-pub273-host="1"] button{width:19px!important;min-width:19px!important;max-width:19px!important;font-size:11px!important;}
    [data-antcv-pub273-row="1"] [data-antcv-pub273-host="1"] button[data-antcv-pub273-control="page"]{width:25px!important;min-width:25px!important;max-width:25px!important;font-size:9px!important;}
    [data-antcv-pub273-eye="1"]{order:40!important;}
    [data-antcv-pub273-cjlr="1"]{order:45!important;}
    [data-antcv-pub273-delete="1"]{order:50!important;}
    [data-antcv-pub273-move="1"]{order:5!important;}
  `;(document.head||document.documentElement).appendChild(s);}
  let pending=false;
  function run(){const root=panelRoot();if(!root)return;injectCss();const sid=(pubSection()||{}).id||'publications';purge(root);rows(root).forEach((p,i)=>wire(p,sid,i));}
  function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;try{run();}catch(e){try{console.warn('[publications-strict-row-layout-273]',e&&e.message);}catch(_){}}});}
  function start(){injectCss();run();[80,200,500,1000,1800,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){}window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('input',()=>setTimeout(run,0),true);window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvPublicationsStrictRowLayout273={version:VERSION,run};
})();
