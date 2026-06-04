/* AntCV table row page controls (v1.40.328)
 * Adds the same page button behavior to table-style editor rows:
 * - CORE COMPETENCIES
 * - WHAT I BRING
 * Header row 0 is excluded.
 */
(function(){
  'use strict';
  const VERSION='1.50.92-defer-dedicated';
  // v1.40.328-preview-guard: Preview is button-free. After TB-004 made
  // table headers contenteditable, the seed filter started matching
  // <th> cells AND any preview-side input that survived a React
  // rerender, popping page-break buttons into the rendered CV. Reject
  // any element inside .antcv-preview-paper from the entire pipeline.
  const isInPreviewPaper=el=>{if(!el)return false;const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');return !!(p&&p.contains(el));};
  if(window.__antcvTableRowPageControls328===VERSION) return;
  window.__antcvTableRowPageControls328=VERSION;
  const PAGE_KEY='antcv:itemPages';
  const SECTIONS_KEY='sections';
  const COLORS=['#9aa0a6','#8A6BE8','#D98C00','#00746E','#B85E3B'];
  function clean(s){return String(s||'').replace(/[\t\n\r ]+/g,' ').trim();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function read(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function doc(){try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}}
  function sections(){const b=read(SECTIONS_KEY,{});const a=b&&b[doc()];return Array.isArray(a)?a:[];}
  function targetFromText(t){t=clean(t).toLowerCase();if(t.indexOf('core competencies')>=0)return {sid:'core_competencies',rx:/core competenc/i,title:'CORE COMPETENCIES'};if(t.indexOf('what i bring')>=0)return {sid:'what_i_bring',rx:/what i bring/i,title:'WHAT I BRING'};return null;}
  function targetForPanel(root){let p=root;for(let d=0;p&&p!==document.body&&d<8;d++,p=p.parentElement){const t=clean(p.textContent).slice(0,1200);const m=targetFromText(t);if(m)return m;}return null;}
  function targetSid(target){const found=sections().find(s=>s&&target.rx.test(clean([s.title,s.name,s.id].join(' '))));return found&&found.id?String(found.id):target.sid;}
  function pageMap(){return read(PAGE_KEY,{});} 
  function getPage(sid,i){const all=pageMap();const b=all[sid]||{};const n=Number(b[String(i)]||1);return Number.isFinite(n)&&n>=1?Math.min(4,Math.max(1,Math.round(n))):1;}
  function setPage(sid,i,n){const all=pageMap();if(!all[sid]||typeof all[sid]!=='object')all[sid]={};const p=Math.min(4,Math.max(1,Math.round(Number(n)||1)));if(p<=1)delete all[sid][String(i)];else all[sid][String(i)]=p;write(PAGE_KEY,all);try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'table-row-page-controls-328',sid,index:i,page:p}}));}catch(_){} }
  function fields(row){return Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);}
  function rowForField(f,root){let p=f.parentElement,best=null;for(let d=0;p&&p!==root.parentElement&&d<7;d++,p=p.parentElement){const fs=fields(p);if(fs.length>=2&&fs.length<=8)best=p;if(/focus area/i.test(clean(p.textContent))&&/strategic expertise/i.test(clean(p.textContent))&&fs.length>=2){best=p;break;}}return best;}
  function isSeed(f){if(!f)return false;if(f.tagName==='TH')return false;if(isInPreviewPaper(f))return false;return /focus area/i.test((f.value||f.placeholder||f.textContent||''));}
  function panels(){const seeds=Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(isSeed);const roots=[];seeds.forEach(f=>{let p=f.parentElement,best=null;for(let d=0;p&&p!==document.body&&d<10;d++,p=p.parentElement){if(isInPreviewPaper(p))break;const t=clean(p.textContent);if(/\+\s*Row/i.test(t)&&/strategic expertise/i.test(t))best=p;if(targetFromText(t)){best=p;break;}}if(best&&!roots.includes(best))roots.push(best);});return roots.filter(r=>visible(r)&&!isInPreviewPaper(r));}
  function rows(root){const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(isSeed);const out=[];seeds.forEach(f=>{const r=rowForField(f,root);if(r&&visible(r)&&!isInPreviewPaper(r)&&!out.includes(r))out.push(r);});return out;}
  function makeBtn(){const b=document.createElement('button');b.type='button';b.setAttribute('data-antcv-table-page-328','1');Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',minWidth:'30px',width:'30px',height:'24px',padding:'0 2px',margin:'0 2px',borderRadius:'6px',fontSize:'12px',fontWeight:'700',lineHeight:'1',cursor:'pointer',background:'#fff',boxSizing:'border-box',verticalAlign:'middle',flex:'0 0 auto'});return b;}
  function paint(b,sid,i){const p=getPage(sid,i),c=COLORS[p]||COLORS[0];b.textContent='📄 '+p;b.title='Start row '+i+' on page '+p+'. Click to cycle page 1-4.';b.setAttribute('aria-label',b.title);b.style.border='2px solid '+c;b.style.color=c;b.style.background=p>1?'rgba(216,140,0,.08)':'#fff';}
  function hostFor(row){let h=row.querySelector(':scope > [data-antcv-table-page-host-328="1"]');if(!h){h=document.createElement('span');h.setAttribute('data-antcv-table-page-host-328','1');Object.assign(h.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'3px',whiteSpace:'nowrap',verticalAlign:'middle'});const btns=Array.from(row.querySelectorAll('button')).filter(visible);const firstAction=btns.find(b=>/✨|enhance|enrich/i.test(clean((b.title||'')+' '+b.textContent)))||btns[0];if(firstAction&&firstAction.parentElement)firstAction.parentElement.insertBefore(h,firstAction);else row.appendChild(h);}return h;}
  function normalize(){
    try{const paper=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');if(paper){paper.querySelectorAll('[data-antcv-table-page-host-328], [data-antcv-table-page-328]').forEach(n=>{try{n.remove();}catch(_){}});}}catch(_){}
    panels().forEach(root=>{if(isInPreviewPaper(root))return;const target=targetForPanel(root);if(!target)return;const sid=targetSid(target);rows(root).forEach((row,idx)=>{if(isInPreviewPaper(row))return;if(idx===0){row.querySelectorAll('[data-antcv-table-page-328]').forEach(x=>x.remove());return;}
      // v1.50.92 — defer to the dedicated per-table page button. Core rows get
      // one from core-competencies-row-controls-234 (data-antcv-core-page) and
      // WHAT I BRING rows from what-i-bring-row-controls-264
      // (data-antcv-wib264="page"). Adding our own here produced TWO page
      // buttons per row, and ours wrote antcv:itemPages under a *guessed* sid
      // that the preview splitter (table-page-splits-327, keyed by the preview
      // section's data-sid) did not always match — so clicking it only
      // re-painted the label ("flicker") without advancing the row to the next
      // page. When a dedicated button exists, remove ours and skip.
      var dedicated=row.querySelector('[data-antcv-core-page],[data-antcv-wib264="page"]');
      if(dedicated){row.querySelectorAll('[data-antcv-table-page-328]').forEach(function(x){x.remove();});var host=row.querySelector(':scope > [data-antcv-table-page-host-328="1"]');if(host&&!host.querySelector('button'))host.remove();return;}
      let b=row.querySelector('[data-antcv-table-page-328]');if(!b){b=makeBtn();hostFor(row).appendChild(b);}paint(b,sid,idx);b.onclick=function(ev){ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();setPage(sid,idx,getPage(sid,idx)%4+1);paint(b,sid,idx);};});});
  }
  let pending=false;function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;try{normalize();}catch(e){try{console.warn('[table-row-page-controls-328]',e&&e.message);}catch(_){}}});}
  function start(){soon();[100,300,800,1600,3000].forEach(ms=>setTimeout(soon,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){}window.addEventListener('click',()=>setTimeout(soon,0),true);window.addEventListener('input',soon,true);window.addEventListener('antcv:sections-updated',soon);setInterval(soon,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvTableRowPageControls328={version:VERSION,run:soon};
})();
