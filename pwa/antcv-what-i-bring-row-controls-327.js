/* AntCV What I Bring row controls (v1.40.264)
 * Actual panel-scoped fix only for WHAT I BRING.
 * Adds missing row Delete (X), Page, and Compress controls to body rows.
 * Keeps Core Competencies untouched.
 * Reuses existing CJLR / Enhance / Eye buttons and their current handlers.
 */
(function(){
  'use strict';
  const VERSION='1.50.121-gen004';
  if(window.__antcvWhatIBringRowControls264===VERSION) return;
  window.__antcvWhatIBringRowControls264=VERSION;
  // v1.40.264-preview-guard: Preview is button-free. Reject seeds and
  // hosts inside .antcv-preview-paper.
  const isInPreviewPaper=el=>{if(!el)return false;const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');return !!(p&&p.contains(el));};

  const PAGE_KEY='antcv:itemPages';
  const SECTIONS_KEY='sections';
  const PANEL_RX=/\bwhat\s+i\s+bring\b/i;
  const CORE_RX=/\bcore\s+competenc/i;
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  const readJson=(k,f)=>{try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}};
  const writeJson=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v||{}));}catch(_){}};
  const activeDoc=()=>{try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}};
  const pulse=(source,detail)=>{try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:Object.assign({source,version:VERSION},detail||{})}));}catch(_){} };
  const fireField=f=>['input','change'].forEach(t=>{try{f&&f.dispatchEvent(new Event(t,{bubbles:true}));}catch(_){}});

  function sectionsBlob(){return readJson(SECTIONS_KEY,{});}
  function sectionList(blob){return blob&&Array.isArray(blob[activeDoc()])?blob[activeDoc()]:[];}
  function whatIBringSection(){
    const blob=sectionsBlob(); const list=sectionList(blob);
    const sec=list.find(s=>s&&PANEL_RX.test(clean([s.title,s.name,s.type,s.id].join(' '))))
      || list.find(s=>s&&String(s.loc||'').toLowerCase()==='main'&&CORE_RX.test(clean([s.title,s.name,s.type,s.id].join(' '))));
    return {blob,list,sec,sid:(sec&&sec.id)||'core_competencies'};
  }

  function activePanel(){
    const heads=Array.from(document.querySelectorAll('h1,h2,h3,strong,b,div,span')).filter(v=>visible(v)&&!isInPreviewPaper(v));
    for(const h of heads){
      const t=clean(h.textContent||'');
      if(!PANEL_RX.test(t) || t.length>90) continue;
      let p=h;
      for(let d=0;p&&p!==document.body&&d<9;d++,p=p.parentElement){
        if(isInPreviewPaper(p)) break;
        const txt=clean(p.textContent||'');
        if(CORE_RX.test(txt) && !PANEL_RX.test(txt)) continue;
        const fields=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>!isInPreviewPaper(f)&&/focus\s*area|strategic\s*expertise/i.test(f.value||f.placeholder||f.textContent||''));
        if(fields.length>=2 && /\+\s*row/i.test(txt)) return p;
      }
    }
    return null;
  }

  function rowForField(f,root){
    let p=f.parentElement,best=null;
    for(let d=0;p&&p!==root.parentElement&&d<7;d++,p=p.parentElement){
      const fields=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
      const txt=clean(p.textContent||'');
      if(fields.length>=2 && fields.length<=6) best=p;
      if(/focus\s*area/i.test(txt)&&/strategic\s*expertise/i.test(txt)&&fields.length>=2){best=p;break;}
    }
    return best;
  }

  function rows(root){
    if(!root) return [];
    const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>/focus\s*area/i.test(f.value||f.placeholder||f.textContent||''));
    const out=[];
    seeds.forEach(f=>{const r=rowForField(f,root); if(r&&visible(r)&&!out.includes(r)) out.push(r);});
    return out;
  }

  function btn(kind,text,title){
    const b=document.createElement('button'); b.type='button'; b.textContent=text; b.title=title; b.setAttribute('aria-label',title); b.setAttribute('data-antcv-wib264',kind);
    Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'26px',minWidth:'26px',height:'24px',padding:'0',margin:'0',borderRadius:'6px',background:'#fff',fontSize:'13px',fontWeight:'700',lineHeight:'1',cursor:'pointer',boxSizing:'border-box',flex:'0 0 auto',position:'static',float:'none'});
    if(kind==='delete'){b.style.border='1px solid #ff4b4b';b.style.color='#ff3333';}
    if(kind==='page'){b.style.border='1px solid #01aeb3';b.style.color='#00746e';b.style.background='rgba(1,183,187,.08)';}
    if(kind==='compress'){b.style.border='1px solid #7b2ff2';b.style.color='#7b2ff2';b.style.background='rgba(123,47,242,.06)';}
    return b;
  }

  function getPage(sid,i){const all=readJson(PAGE_KEY,{}); const b=all[sid]||{}; const n=Number(b[String(i)]||1); return Number.isFinite(n)&&n>0?Math.min(4,Math.max(1,Math.round(n))):1;}
  function setPage(sid,i,n){const all=readJson(PAGE_KEY,{}); if(!all[sid]||typeof all[sid]!=='object') all[sid]={}; const nn=Math.min(4,Math.max(1,Math.round(Number(n)||1))); if(nn<=1) delete all[sid][String(i)]; else all[sid][String(i)]=nn; writeJson(PAGE_KEY,all); pulse('what-i-bring-page',{sid,index:i,page:nn});}
  function paintPage(b,sid,i){const p=getPage(sid,i); b.textContent='📄 '+p; b.title='What I Bring row '+i+' page: '+p+'. Click to cycle page 1-4.'; b.setAttribute('aria-label',b.title);}
  function compressText(s){let t=clean(s); t=t.replace(/\b(responsible for|worked on|helped with|involved in|various|different|extensive|strong|solid)\b/gi,'').replace(/\s*,\s*/g,', ').replace(/\s+/g,' ').trim(); if(t.length>170)t=t.slice(0,167).replace(/\s+\S*$/,'')+'…'; return t;}
  function valueOf(f){return f?(f.value!==undefined?f.value:f.textContent||''):'';}
  function setValue(f,v){if(!f)return; if(f.value!==undefined)f.value=v; else f.textContent=v; fireField(f);}

  function deleteRow(row,rowIndex){
    const ctx=whatIBringSection(); const s=ctx.sec; if(!s) return false;
    const arr=Array.isArray(s.items)?s.items:(Array.isArray(s.rows)?s.rows:(Array.isArray(s.lines)?s.lines:null));
    if(!arr) return false;
    const domRows=rows(activePanel());
    let idx = arr.length===domRows.length-1 ? rowIndex-1 : rowIndex;
    if(idx<0 || idx>=arr.length) idx=rowIndex-1;
    if(idx<0 || idx>=arr.length) return false;
    arr.splice(idx,1);
    writeJson(SECTIONS_KEY,ctx.blob);
    row.remove();
    pulse('what-i-bring-delete',{sid:ctx.sid,index:rowIndex,arrayIndex:idx});
    return true;
  }

  function buttonKind(b){
    const t=clean((b.getAttribute('aria-label')||'')+' '+(b.title||'')+' '+(b.textContent||'')).toLowerCase();
    if(b.matches('[data-antcv-wib264="delete"]')||/delete|remove|×|✕/.test(t)) return 'delete';
    if(b.matches('[data-antcv-wib264="page"]')||/page|📄/.test(t)) return 'page';
    if(b.matches('[data-antcv-wib264="compress"]')||/compress|⇥\s*⇤|⇤\s*⇥|↔/.test(t)) return 'compress';
    if(/align|cjlr|justify|center|left|right|☰|⇤|⇥/.test(t)) return 'cjlr';
    if(/enhance|enrich|✨/.test(t)) return 'enhance';
    if(/hide|show|visible|eye|👁|🐵|🙈/.test(t)) return 'eye';
    return '';
  }

  function ensureHost(row){
    let h=row.querySelector(':scope > [data-antcv-wib264-host="1"]');
    if(!h){h=document.createElement('span'); h.setAttribute('data-antcv-wib264-host','1'); Object.assign(h.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap',verticalAlign:'middle',flex:'0 0 auto',position:'static',float:'none'}); row.appendChild(h);}
    return h;
  }

  function normalize(row,rowIndex,sid){
    if(rowIndex===0) return; // header row is handled by the existing CJLR helper only.
    row.setAttribute('data-antcv-wib264-row','1');
    row.style.overflow='visible'; row.style.maxWidth='100%'; row.style.boxSizing='border-box';

    // Remove old injected hosts so they cannot hide or reorder the new controls.
    Array.from(row.querySelectorAll('[data-antcv-rowfix-host="wib"],[data-antcv-wib-row-control-host-249="1"]')).forEach(x=>x.remove());

    const allButtons=Array.from(row.querySelectorAll('button')).filter(visible);
    let existing={};
    allButtons.forEach(b=>{const k=buttonKind(b); if(k&&!existing[k]) existing[k]=b;});
    const h=ensureHost(row);

    let del=existing.delete || h.querySelector('[data-antcv-wib264="delete"]');
    if(!del) del=btn('delete','×','Delete What I Bring row '+rowIndex);
    del.onclick=function(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();deleteRow(row,rowIndex);};

    let page=existing.page || h.querySelector('[data-antcv-wib264="page"]');
    if(!page) page=btn('page','📄 1','What I Bring row page');
    paintPage(page,sid,rowIndex);
    page.onclick=function(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();setPage(sid,rowIndex,getPage(sid,rowIndex)%4+1);paintPage(page,sid,rowIndex);};

    let comp=existing.compress || h.querySelector('[data-antcv-wib264="compress"]');
    if(!comp) comp=btn('compress','⇥⇤','Fit What I Bring row '+rowIndex+'. Applies to Strategic Expertise only.');
    comp.title='Fit What I Bring row '+rowIndex+'. Applies to Strategic Expertise only.'; comp.setAttribute('aria-label',comp.title);
    comp.onclick=function(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation(); const fs=Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible); setValue(fs[1]||fs[0],compressText(valueOf(fs[1]||fs[0]))); pulse('what-i-bring-compress',{sid,index:rowIndex});};

    const cjlr=existing.cjlr, enhance=existing.enhance, eye=existing.eye;
    [del,page,comp,cjlr,enhance,eye].filter(Boolean).forEach(b=>{ if(b.parentElement!==h) h.appendChild(b); else h.appendChild(b); });

    // Remove duplicates left behind outside the final host, without touching up/down reorder buttons.
    const seen=Object.create(null);
    Array.from(row.querySelectorAll('button')).forEach(b=>{
      if(b.closest('[data-antcv-wib264-host="1"]')) return;
      const k=buttonKind(b); if(!k) return;
      if(['delete','page','compress','cjlr','enhance','eye'].includes(k)) b.remove();
    });
    Array.from(h.querySelectorAll('button')).forEach(b=>{const k=buttonKind(b); if(!k)return; if(seen[k]) b.remove(); else seen[k]=1;});
  }

  let pending=false;
  function run(){try{const root=activePanel(); if(!root) return; const txt=clean(root.textContent||''); if(!PANEL_RX.test(txt)||CORE_RX.test(txt)&&!PANEL_RX.test(txt)) return; const ctx=whatIBringSection(); rows(root).forEach((r,i)=>normalize(r,i,ctx.sid));}catch(e){try{console.warn('[antcv-what-i-bring-row-controls-264]',e&&e.message);}catch(_){}}}
  function soon(){if(pending)return; pending=true; requestAnimationFrame(()=>{pending=false;run();});}
  function css(){if(document.getElementById('antcv-wib264-css'))return; const s=document.createElement('style'); s.id='antcv-wib264-css'; s.textContent='[data-antcv-wib264-host="1"]{display:inline-flex!important;align-items:center!important;gap:2px!important;white-space:nowrap!important;position:static!important;float:none!important;vertical-align:middle!important}[data-antcv-wib264-host="1"] button{position:static!important;float:none!important;flex:0 0 auto!important}'; (document.head||document.documentElement).appendChild(s);}
  function start(){css(); run(); [80,200,500,1000,1800,3000].forEach(ms=>setTimeout(run,ms)); try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){} window.addEventListener('click',()=>setTimeout(run,0),true); window.addEventListener('input',()=>setTimeout(run,0),true); window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.AntcvWhatIBringRowControls264={version:VERSION,run};
})();
