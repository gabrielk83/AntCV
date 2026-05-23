/* AntCV v1.40.270
 * Width guard for Core Competencies and What I Bring row editors.
 * Keeps all row controls left of the vertical panel scrollbar by shrinking the Focus Area field first.
 * No new buttons are added and existing handlers are left untouched.
 */
(function(){
  'use strict';
  const VERSION='1.40.270';
  if(window.__antcvCoreWibWidthGuard270===VERSION) return;
  window.__antcvCoreWibWidthGuard270=VERSION;

  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  const CORE=/core\s+competencies/i;
  const WIB=/what\s+i\s+bring/i;

  function activeEditors(){
    const roots=[];
    const heads=Array.from(document.querySelectorAll('h1,h2,h3,b,strong,div,span')).filter(visible);
    for(const h of heads){
      const t=clean(h.textContent||'');
      if(t.length>90 || (!CORE.test(t)&&!WIB.test(t))) continue;
      let p=h;
      for(let d=0;p&&p!==document.body&&d<9;d++,p=p.parentElement){
        const txt=clean(p.textContent||'');
        if(/cv preview|docx/i.test(txt)) continue;
        if((CORE.test(txt)||WIB.test(txt)) && /focus\s*area/i.test(txt) && /strategic\s*expertise/i.test(txt) && /\+\s*row/i.test(txt)){
          if(!roots.includes(p)) roots.push(p);
          break;
        }
      }
    }
    return roots;
  }

  function rowForField(f,root){
    let p=f.parentElement,best=null;
    for(let d=0;p&&p!==root.parentElement&&d<8;d++,p=p.parentElement){
      const fs=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
      if(fs.length>=2 && fs.length<=7) best=p;
    }
    return best;
  }

  function rows(root){
    const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>/focus\s*area/i.test([f.value,f.placeholder,f.textContent].join(' ')));
    const out=[];
    seeds.forEach(f=>{const r=rowForField(f,root); if(r&&visible(r)&&!out.includes(r)) out.push(r);});
    return out;
  }

  function applyRow(row){
    const fs=Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
    if(fs.length<2) return;
    row.setAttribute('data-antcv-core-wib-width270-row','1');
    Object.assign(row.style,{boxSizing:'border-box',overflow:'visible'});
    fs[0].setAttribute('data-antcv-core-wib-focus270','1');
    fs[1].setAttribute('data-antcv-core-wib-strategic270','1');
    // Inline fallback for browsers/components that ignore stylesheet ordering.
    Object.assign(fs[0].style,{minWidth:'0',width:'96px',maxWidth:'104px',boxSizing:'border-box'});
    Object.assign(fs[1].style,{minWidth:'0',maxWidth:'160px',boxSizing:'border-box'});
  }

  let pending=false;
  function run(){
    try{ activeEditors().forEach(root=>rows(root).forEach(applyRow)); }
    catch(e){ try{console.warn('[antcv-core-wib-width-guard-270]',e&&e.message);}catch(_){} }
  }
  function soon(){ if(pending) return; pending=true; requestAnimationFrame(()=>{pending=false;run();}); }

  function css(){
    if(document.getElementById('antcv-core-wib-width-guard-270-css')) return;
    const s=document.createElement('style'); s.id='antcv-core-wib-width-guard-270-css';
    s.textContent=`
      [data-antcv-core-row="1"],
      [data-antcv-wib264-row="1"],
      [data-antcv-core-wib-width270-row="1"]{
        max-width:calc(100% - 58px)!important;
        width:calc(100% - 58px)!important;
        box-sizing:border-box!important;
        overflow:visible!important;
        white-space:nowrap!important;
      }
      [data-antcv-core-row="1"] input,
      [data-antcv-core-row="1"] textarea,
      [data-antcv-core-row="1"] [contenteditable="true"],
      [data-antcv-wib264-row="1"] input,
      [data-antcv-wib264-row="1"] textarea,
      [data-antcv-wib264-row="1"] [contenteditable="true"],
      [data-antcv-core-wib-width270-row="1"] input,
      [data-antcv-core-wib-width270-row="1"] textarea,
      [data-antcv-core-wib-width270-row="1"] [contenteditable="true"]{
        min-width:0!important;
        box-sizing:border-box!important;
        flex-shrink:1!important;
      }
      [data-antcv-core-row="1"] input:nth-of-type(1),
      [data-antcv-wib264-row="1"] input:nth-of-type(1),
      [data-antcv-core-wib-focus270="1"]{
        width:96px!important;
        max-width:104px!important;
        flex:0 1 96px!important;
      }
      [data-antcv-core-row="1"] input:nth-of-type(2),
      [data-antcv-wib264-row="1"] input:nth-of-type(2),
      [data-antcv-core-wib-strategic270="1"]{
        width:clamp(118px,34vw,160px)!important;
        max-width:160px!important;
        flex:1 1 118px!important;
      }
      [data-antcv-core-controls="1"],
      [data-antcv-wib264-host="1"]{
        display:inline-flex!important;
        align-items:center!important;
        gap:2px!important;
        white-space:nowrap!important;
        flex:0 0 auto!important;
        position:static!important;
        float:none!important;
      }
      [data-antcv-core-controls="1"] button,
      [data-antcv-wib264-host="1"] button{
        flex:0 0 auto!important;
        position:static!important;
        float:none!important;
      }
    `;
    (document.head||document.documentElement).appendChild(s);
  }

  function start(){css(); run(); [80,200,500,1000,1800,3000].forEach(ms=>setTimeout(run,ms)); try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){} window.addEventListener('click',()=>setTimeout(run,0),true); window.addEventListener('input',()=>setTimeout(run,0),true); window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.AntcvCoreWibWidthGuard270={version:VERSION,run};
})();
