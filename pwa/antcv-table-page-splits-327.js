/* AntCV unified table page-break renderer (v1.50.96)
 * ============================================================================
 * SINGLE SOURCE OF TRUTH: section.pageBreakRows (the app-native field that the
 * app's own per-row "↧" toggle writes). Each table section (Core Competencies
 * id="core_comp", What I Bring id="bring") owns its own pageBreakRows array, so
 * the two tables never affect each other.
 *
 * Responsibilities:
 *  1. RENDER the Core Competencies split in the preview from core_comp's
 *     pageBreakRows. (The app already renders the What I Bring split natively,
 *     so we SKIP "bring" to avoid the duplicate/trailing headings that the old
 *     itemPages-based splitters produced.)
 *  2. MIRROR every table section's pageBreakRows into antcv:itemPages[sid] so
 *     the DOCX worker — which reads itemPages — keeps emitting the same page
 *     breaks without a server change.
 *
 * History: this used to read antcv:itemPages and split BOTH tables, which
 * collided with the app's native What I Bring rendering and with
 * core-competencies-row-controls-234's own splitter. Both of those split paths
 * are now retired; this is the only table splitter.
 */
(function(){
  'use strict';
  const VERSION='1.50.96-pagebreakrows-unify';
  if(window.__antcvTablePageSplits324===VERSION) return;
  window.__antcvTablePageSplits324=VERSION;
  const PAGE_KEY='antcv:itemPages';
  const SECTIONS_KEY='sections';
  // App natively splits this section; we must not inject into it.
  const NATIVE_SPLIT_IDS={bring:1};
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function read(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function doc(){try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}}
  function allSections(){return read(SECTIONS_KEY,{});}
  function sectionBySid(sid){const all=allSections();const list=all&&Array.isArray(all[doc()])?all[doc()]:[];return list.find(x=>x&&String(x.id||'')===String(sid))||null;}
  function pbrOf(sec){return sec&&Array.isArray(sec.pageBreakRows)?sec.pageBreakRows:[];}

  // ---- (2) mirror pageBreakRows -> itemPages for DOCX export continuity ----
  // itemPages[sid][i] = 2 means "row i starts on a new page", which is exactly
  // what pageBreakRows[i] === true encodes. Indices match the editor row index
  // convention the old buttons used (0 = header row), so DOCX output is
  // equivalent to before — just driven by the unified field.
  function mirrorPageBreaks(){
    const all=allSections(); if(!all||typeof all!=='object')return;
    const map=read(PAGE_KEY,{}); let changed=false;
    ['cv','cl'].forEach(d=>{
      const list=all[d]; if(!Array.isArray(list))return;
      list.forEach(s=>{
        if(!s||String(s.type||'')!=='table')return;
        const sid=String(s.id||''); if(!sid)return;
        const pbr=pbrOf(s);
        const bucket={};
        for(let i=1;i<pbr.length;i++){ if(pbr[i]) bucket[String(i)]=2; }
        const prev=JSON.stringify(map[sid]||{});
        const next=JSON.stringify(bucket);
        if(prev!==next){ if(Object.keys(bucket).length) map[sid]=bucket; else delete map[sid]; changed=true; }
      });
    });
    if(changed) write(PAGE_KEY,map);
  }

  // ---- (1) render the Core Competencies split from pageBreakRows ----
  function titleOf(secEl,sid){const s=sectionBySid(sid);let t=clean((s&&(s.title||s.name))||'');if(!t){const h=secEl.querySelector('h1,h2,h3,h4,strong,b,[data-antcv-section-title]');t=clean(h&&h.textContent||'');}return (t||'SECTION').toUpperCase();}
  function tableRows(table){
    if(!table)return {headers:[],body:[]};
    const headers=Array.from(table.querySelectorAll('thead tr')).filter(visible);
    let body=Array.from(table.querySelectorAll('tbody tr')).filter(visible);
    if(!body.length){const all=Array.from(table.querySelectorAll('tr')).filter(visible);if(headers.length){body=all.filter(r=>!headers.includes(r));}else{const first=all.find(r=>/focus\s*area|strategic\s*expertise/i.test(clean(r.textContent)));if(first){headers.push(first);body=all.filter(r=>r!==first);}else body=all;}}
    return {headers,body};
  }
  function clear(sec){sec.querySelectorAll('[data-antcv-table-page-split="1"]').forEach(n=>n.remove());}
  function cloneHeader(table){const src=table.querySelector('thead tr')||Array.from(table.querySelectorAll('tr')).find(r=>/focus\s*area|strategic\s*expertise/i.test(clean(r.textContent)))||null;const tr=document.createElement('tr');tr.setAttribute('data-antcv-table-page-split','1');tr.setAttribute('data-antcv-table-header-clone','1');
    if(src){tr.innerHTML=src.innerHTML;Array.from(tr.children).forEach(c=>{c.style.fontWeight='700';});}
    else{const th=document.createElement('th');th.colSpan=2;th.textContent='Continued';tr.appendChild(th);}return tr;}
  function marker(){const d=document.createElement('div');d.setAttribute('data-antcv-table-page-split','1');d.setAttribute('aria-hidden','true');Object.assign(d.style,{breakBefore:'page',pageBreakBefore:'always',height:'0',margin:'0',padding:'0',lineHeight:'0'});return d;}
  function apply(sec){
    const sid=sec.getAttribute('data-sid'); if(!sid) return;
    if(NATIVE_SPLIT_IDS[sid]) return;            // app renders this split itself
    if(sec.querySelector('[data-antcv-row-pagebreak-table]')) return; // app's native segmented wrapper present
    const s=sectionBySid(sid); if(!s||String(s.type||'')!=='table') return;
    const pbr=pbrOf(s); if(!pbr.some(Boolean)) return;
    const table=sec.querySelector('table'); if(!table) return;
    const {headers,body}=tableRows(table); if(!body.length) return;
    body.forEach((row,zero)=>{
      const editorIndex = headers.length ? zero+1 : zero;
      if(!pbr[editorIndex]) return;
      if(row.getAttribute('data-antcv-table-split-done')==='1') return;
      if(zero===0){
        const beforeTable=table.parentNode; if(beforeTable) beforeTable.insertBefore(marker(),table);
      } else {
        const cloned=cloneHeader(table); cloned.style.breakBefore='page'; cloned.style.pageBreakBefore='always';
        const parent=row.parentNode; if(parent) parent.insertBefore(cloned,row);
      }
      row.setAttribute('data-antcv-table-split-done','1');
    });
  }
  function run(){
    try{ mirrorPageBreaks(); }catch(_){}
    try{document.querySelectorAll('[data-sid]').forEach(sec=>{if(!visible(sec))return;clear(sec);sec.querySelectorAll('[data-antcv-table-split-done]').forEach(r=>r.removeAttribute('data-antcv-table-split-done'));apply(sec);});}catch(e){try{console.warn('[table-page-splits-327]',e&&e.message);}catch(_){}}
  }
  let pending=false;function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true});}catch(_){}window.addEventListener('storage',e=>{if(!e||e.key===PAGE_KEY||e.key===SECTIONS_KEY)soon();});window.addEventListener('antcv:sections-updated',soon);window.addEventListener('beforeprint',run);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvTablePageSplits324={version:VERSION,run};
})();
