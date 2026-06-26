/* AntCV Core Competencies + What I Bring strict row layout (v1.40.274)
 * Applies the same overflow guard used for Publications to:
 * - CORE COMPETENCIES rows
 * - WHAT I BRING rows
 *
 * Purpose:
 * - keep every row control left of the vertical scrollbar/roller
 * - shrink the Focus Area textbox first
 * - keep existing buttons and handlers intact
 * - do not add controls to Core Competencies
 */
(function(){
  'use strict';
  const VERSION='1.50.925-edit-wrap';
  if(window.__antcvCoreWibStrictRowLayout274===VERSION) return;
  window.__antcvCoreWibStrictRowLayout274=VERSION;

  // v1.50.880 BOOT-COREWIB-PERF-001: per-run memo for the pure whitespace-clean.
  // clean() was the file's #1 boot-CPU cost (~104ms) — panelRoot's 10-deep ancestor
  // climb re-cleaned the same large container textContents across every heading. The
  // memo (cleared at run() start) collapses those repeats; behaviour is identical.
  const _cleanMemo=new Map();
  const clean=s=>{const k=String(s||'');let v=_cleanMemo.get(k);if(v===undefined){v=k.replace(/\s+/g,' ').trim();_cleanMemo.set(k,v);}return v;};
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  const isCoreTitle=t=>/core\s+competencies/i.test(t);
  const isWibTitle=t=>/what\s+i\s+bring/i.test(t);

  function panelRoot(){
    // v1.50.880: check the cheap text test BEFORE visible() so getClientRects()
    // (forced layout) only runs on the few title-matching elements, not every
    // h1,h2,h3,b,strong,div,span in the doc. The accepted set is unchanged.
    const heads=Array.from(document.querySelectorAll('h1,h2,h3,b,strong,div,span'));
    for(const h of heads){
      const raw=h.textContent||'';
      if(raw.length>600) continue; // a title is short; big containers are covered by the ancestor climb
      const t=clean(raw);
      if(t.length>120 || (!isCoreTitle(t)&&!isWibTitle(t))) continue;
      if(!visible(h)) continue;
      let p=h;
      for(let d=0;p&&p!==document.body&&d<10;d++,p=p.parentElement){
        const txt=clean(p.textContent||'');
        if(/cv preview|docx/i.test(txt)) continue;
        if((isCoreTitle(txt)||isWibTitle(txt)) && /focus\s*area/i.test(txt) && /strategic\s*expertise/i.test(txt) && /\+\s*row/i.test(txt)){
          return {root:p, kind:isCoreTitle(txt)?'core':'wib'};
        }
      }
    }
    return null;
  }

  function fields(el){return Array.from(el.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);}
  function fieldText(f){return clean([f&&f.value,f&&f.placeholder,f&&f.textContent,f&&f.title,f&&f.getAttribute&&f.getAttribute('aria-label')].join(' '));}
  function buttonText(b){return clean([b&&b.textContent,b&&b.title,b&&b.getAttribute&&b.getAttribute('aria-label')].join(' ')).toLowerCase();}
  function rowOfFocus(f,root){
    let best=null;
    for(let p=f.parentElement,d=0;p&&p!==root.parentElement&&d<8;d++,p=p.parentElement){
      const fs=fields(p);
      if(fs.length>=2 && fs.length<=8 && fs.includes(f)) best=p;
      if(fs.length>=2 && fs.includes(f)) break;
    }
    return best;
  }
  function rows(root){
    const out=[];
    const fs=fields(root).filter(f=>/focus\s*area/i.test(fieldText(f)) || /\[?focus\s*area/i.test(fieldText(f)));
    fs.forEach(f=>{const r=rowOfFocus(f,root); if(r&&visible(r)&&!out.includes(r)) out.push(r);});
    return out;
  }
  function classifyNativeButton(b){
    const t=buttonText(b);
    if(/^(x|×)$|delete|remove/.test(t)) return 'delete';
    if(/👁|eye|visible|visibility|hide|show|🙈/.test(t)) return 'eye';
    if(/📄|page\s*[1-4]/.test(t)) return 'page';
    if(/compress|⇥⇤|⇤⇥|↔/.test(t)) return 'compress';
    if(/enhance|enrich|✨/.test(t)) return 'enhance';
    if(/cjlr|alignment|⇤|⇥|☰/.test(t)) return 'cjlr';
    if(/▲|▼|move up|move down/.test(t)) return 'move';
    return 'other';
  }
  function compactButtons(row){
    Array.from(row.querySelectorAll('button')).forEach(b=>{
      const k=classifyNativeButton(b);
      b.setAttribute('data-antcv-core-wib274-button',k);
      Object.assign(b.style,{
        display:'inline-flex',alignItems:'center',justifyContent:'center',
        width:k==='page'?'30px':'23px',minWidth:k==='page'?'30px':'23px',maxWidth:k==='page'?'30px':'23px',
        height:'22px',minHeight:'22px',padding:'0',margin:'0 1px',
        flex:'0 0 auto',position:'static',float:'none',boxSizing:'border-box',lineHeight:'1'
      });
    });
  }
  function applyRow(row,kind,index){
    const fs=fields(row);
    if(fs.length<2) return;
    const focus=fs[0];
    const strategic=fs[1];
    row.setAttribute('data-antcv-core-wib274-row',kind);
    row.setAttribute('data-antcv-core-wib274-index',String(index));
    // WIB-EDIT-WRAP-001 (owner 2026-06-26): the row was flex-wrap:nowrap with the cells squeezed to
    // ~120/170px so all controls fit one line — cramping the text. Owner: "give more space for text;
    // the buttons can flow to the next row." Now the row WRAPS: the Focus/Strategic boxes take the full
    // panel width on line 1 (flex-grow), and the control buttons spill onto line 2 when they don't fit.
    Object.assign(row.style,{
      display:'flex',alignItems:'center',gap:'3px',flexWrap:'wrap',
      maxWidth:'100%',width:'100%',
      overflow:'visible',boxSizing:'border-box',whiteSpace:'normal'
    });
    focus.setAttribute('data-antcv-core-wib274-focus','1');
    strategic.setAttribute('data-antcv-core-wib274-strategic','1');
    // Cells flex-GROW to fill line 1 (no fixed cap); the buttons wrap below them.
    Object.assign(focus.style,{order:'10',minWidth:'90px',width:'auto',maxWidth:'none',flex:'1 1 130px',boxSizing:'border-box'});
    Object.assign(strategic.style,{order:'20',minWidth:'120px',width:'auto',flex:'2 1 180px',boxSizing:'border-box'});
    // Keep all existing control hosts compact and attached to the row.
    row.querySelectorAll('[data-antcv-core-controls="1"],[data-antcv-wib264-host="1"],[data-antcv-rowfix-host]').forEach(h=>{
      Object.assign(h.style,{display:'inline-flex',alignItems:'center',gap:'2px',whiteSpace:'nowrap',flex:'0 0 auto',position:'static',float:'none',marginLeft:'2px'});
    });
    compactButtons(row);
  }

  function injectCss(){
    if(document.getElementById('antcv-core-wib-strict-row-layout-274-css')) return;
    const s=document.createElement('style');
    s.id='antcv-core-wib-strict-row-layout-274-css';
    s.textContent=`
      [data-antcv-core-wib274-row]{display:flex!important;align-items:center!important;gap:3px!important;flex-wrap:wrap!important;max-width:100%!important;width:100%!important;overflow:visible!important;box-sizing:border-box!important;white-space:normal!important;}
      [data-antcv-core-wib274-row] input,[data-antcv-core-wib274-row] textarea,[data-antcv-core-wib274-row] [contenteditable="true"]{box-sizing:border-box!important;flex-shrink:1!important;}
      [data-antcv-core-wib274-row] [data-antcv-core-wib274-focus="1"]{width:auto!important;max-width:none!important;min-width:90px!important;flex:1 1 130px!important;}
      [data-antcv-core-wib274-row] [data-antcv-core-wib274-strategic="1"]{width:auto!important;min-width:120px!important;flex:2 1 180px!important;}
      [data-antcv-core-wib274-row] button{width:23px!important;min-width:23px!important;max-width:23px!important;height:22px!important;min-height:22px!important;padding:0!important;margin:0 1px!important;flex:0 0 auto!important;position:static!important;float:none!important;box-sizing:border-box!important;line-height:1!important;}
      [data-antcv-core-wib274-row] button[data-antcv-core-wib274-button="page"]{width:30px!important;min-width:30px!important;max-width:30px!important;font-size:10px!important;}
      [data-antcv-core-controls="1"],[data-antcv-wib264-host="1"],[data-antcv-rowfix-host]{display:inline-flex!important;align-items:center!important;gap:2px!important;white-space:nowrap!important;flex:0 0 auto!important;position:static!important;float:none!important;margin-left:2px!important;}
    `;
    (document.head||document.documentElement).appendChild(s);
  }
  let pending=false;
  function run(){
    _cleanMemo.clear();
    const pr=panelRoot(); if(!pr) return;
    injectCss();
    rows(pr.root).forEach((r,i)=>applyRow(r,pr.kind,i));
  }
  function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;try{run();}catch(e){try{console.warn('[core-wib-strict-row-layout-274]',e&&e.message);}catch(_){}}});}
  function start(){injectCss();run();[80,200,500,1000,1800,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){}window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('input',()=>setTimeout(run,0),true);window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvCoreWibStrictRowLayout274={version:VERSION,run};
})();
