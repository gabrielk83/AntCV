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
  const VERSION='1.50.102-marker';
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
  function clear(sec){ sec.querySelectorAll('[data-antcv-table-page-split="1"]').forEach(n=>n.remove()); }
  // The same full-width "▼ PAGE BREAK ▼" marker app.js draws for What I Bring /
  // Professional Experience, as a full-width table row so it spans both columns.
  function markerRow(){
    const tr=document.createElement('tr'); tr.setAttribute('data-antcv-table-page-split','1'); tr.className='no-print';
    const td=document.createElement('td'); td.setAttribute('colspan','2'); td.style.border='0'; td.style.padding='0';
    const bar=document.createElement('div'); bar.className='no-print';
    Object.assign(bar.style,{borderTop:'3px solid rgba(0,116,110,.55)',margin:'10px 0 5px',display:'flex',justifyContent:'center',background:'rgba(0,116,110,.06)',padding:'2px 0'});
    const span=document.createElement('span'); span.textContent='▼ PAGE BREAK ▼';
    Object.assign(span.style,{background:'rgba(0,116,110,.75)',color:'#fff',fontSize:'8px',padding:'2px 10px',borderRadius:'2px',fontFamily:'Arial,sans-serif',letterSpacing:'.5px'});
    bar.appendChild(span); td.appendChild(bar); tr.appendChild(td); return tr;
  }
  // Show the marker before each break row. What I Bring is skipped — the app
  // renders its own marker natively (segmented wrapper). The REAL page break for
  // the exported document is produced by the DOCX worker from row_pages (which
  // the reliable ↧ toggle + the mirror below populate); this is the on-screen
  // indicator only.
  function apply(sec){
    const sid=sec.getAttribute('data-sid'); if(!sid) return;
    if(NATIVE_SPLIT_IDS[sid]) return;                                   // app shows WIB marker
    if(sec.querySelector('[data-antcv-row-pagebreak-table]')) return;   // app native segmented
    const s=sectionBySid(sid); if(!s||String(s.type||'')!=='table') return;
    const pbr=pbrOf(s); if(!pbr.some(Boolean)) return;
    const table=sec.querySelector('table'); if(!table) return;
    const {headers,body}=tableRows(table); if(!body.length) return;
    body.forEach((row,zero)=>{
      const editorIndex = headers.length ? zero+1 : zero;
      if(!pbr[editorIndex]) return;
      if(row.getAttribute('data-antcv-table-split-done')==='1') return;
      const parent=row.parentNode; if(parent) parent.insertBefore(markerRow(),row);
      row.setAttribute('data-antcv-table-split-done','1');
    });
  }
  function run(){
    try{ mirrorPageBreaks(); }catch(_){}
    try{document.querySelectorAll('[data-sid]').forEach(sec=>{
      if(!visible(sec)) return;
      clear(sec);
      sec.querySelectorAll('[data-antcv-table-split-done]').forEach(r=>r.removeAttribute('data-antcv-table-split-done'));
      apply(sec);
    });}catch(e){try{console.warn('[table-page-splits-327]',e&&e.message);}catch(_){}}
  }
  let pending=false;function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true});}catch(_){}window.addEventListener('storage',e=>{if(!e||e.key===PAGE_KEY||e.key===SECTIONS_KEY)soon();});window.addEventListener('antcv:sections-updated',soon);window.addEventListener('beforeprint',run);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvTablePageSplits324={version:VERSION,run};
})();
