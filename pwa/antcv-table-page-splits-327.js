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
  const VERSION='1.50.99-real-split';
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
  // Remove our clone container(s) and un-hide any original table/wrapper we hid.
  // We NEVER moved or removed a React node — only toggled display — so undoing
  // is just flipping display back; nothing in React's tree was disturbed.
  function clear(sec){
    sec.querySelectorAll('[data-antcv-table-split-clone="1"]').forEach(n=>n.remove());
    sec.querySelectorAll('[data-antcv-table-split-hidden="1"]').forEach(n=>{ n.style.display=''; n.removeAttribute('data-antcv-table-split-hidden'); });
  }
  function rowsSig(s){ try{ return JSON.stringify((s&&(s.rows||s.items))||[]); }catch(_){ return ''; } }
  function buildSegment(origTable, headerRow, rowEls){
    const t=origTable.cloneNode(true);
    // drop nested app-segmentation / our own clones / no-print separators
    Array.from(t.querySelectorAll('.no-print,[data-antcv-table-split-clone],[data-antcv-row-pagebreak-table]')).forEach(n=>n.remove());
    Array.from(t.querySelectorAll('tr')).forEach(tr=>tr.remove());
    const head=t.querySelector('thead'); const body=t.querySelector('tbody')||t;
    if(headerRow) (head||body).appendChild(headerRow.cloneNode(true));
    rowEls.forEach(r=> body.appendChild(r.cloneNode(true)));
    return t;
  }
  function contHeading(sec,sid,ref){
    const h=document.createElement('div'); h.textContent=titleOf(sec,sid)+' (Cont.)';
    let color='#00746E', font='Trebuchet MS, Calibri, sans-serif';
    try{ const cs=getComputedStyle(ref); color=cs.color||color; font=cs.fontFamily||font; }catch(_){}
    Object.assign(h.style,{color:color,fontFamily:font,fontWeight:'700',fontSize:'12pt',marginTop:'6pt',marginBottom:'6pt',borderBottom:'1pt solid '+color,paddingBottom:'2pt'});
    return h;
  }
  // Physically split the table into separate tables so the break is REAL in
  // print (a break between block-level tables, like Professional Experience).
  function apply(sec){
    const sid=sec.getAttribute('data-sid'); if(!sid) return;
    const s=sectionBySid(sid); if(!s||String(s.type||'')!=='table') return;
    const pbr=pbrOf(s);
    const nRows=((s.rows||s.items)||[]).length;
    const breaks=[]; for(let i=2;i<nRows;i++){ if(pbr[i]) breaks.push(i); }
    if(!breaks.length) return;                                   // nothing to split
    // Collect the originals (the app may have segmented WIB into several tables
    // inside [data-antcv-row-pagebreak-table]). Gather header + all body rows.
    const wrapper=sec.querySelector('[data-antcv-row-pagebreak-table]');
    const scope=wrapper||sec;
    const origTables=Array.from(scope.querySelectorAll('table')).filter(t=>visible(t)&&!t.closest('[data-antcv-table-split-clone]'));
    if(!origTables.length) return;
    let headerRow=null; const bodyRows=[];
    origTables.forEach(t=>{ const {headers,body}=tableRows(t); if(!headerRow&&headers.length) headerRow=headers[0]; body.forEach(r=>{ const tx=clean(r.textContent); if(/page break/i.test(tx)&&r.children.length<=1) return; bodyRows.push(r); }); });
    if(bodyRows.length<2) return;
    // Split bodyRows at each break index (editorIndex k+1 == break point).
    const segs=[]; let cur=[];
    bodyRows.forEach((r,k)=>{ if(breaks.indexOf(k+1)!==-1 && cur.length){ segs.push(cur); cur=[]; } cur.push(r); });
    segs.push(cur);
    if(segs.length<2) return;
    const cont=document.createElement('div'); cont.setAttribute('data-antcv-table-split-clone','1');
    const origTable=origTables[0];
    segs.forEach((seg,i)=>{
      if(i>0){
        const br=document.createElement('div'); br.setAttribute('aria-hidden','true'); Object.assign(br.style,{breakBefore:'page',pageBreakBefore:'always',height:'0',margin:'0',padding:'0',lineHeight:'0'}); cont.appendChild(br);
        cont.appendChild(contHeading(sec,sid,origTable));
      }
      cont.appendChild(buildSegment(origTable, headerRow, seg));
    });
    // Hide the original(s) IN PLACE (no move/remove → no React-tree corruption).
    if(wrapper){ if(wrapper.style.display!=='none'){ wrapper.style.display='none'; wrapper.setAttribute('data-antcv-table-split-hidden','1'); } }
    else { origTables.forEach(t=>{ if(t.style.display!=='none'){ t.style.display='none'; t.setAttribute('data-antcv-table-split-hidden','1'); } }); }
    // Append our split tables as a TRAILING child (lowest reconciliation risk).
    sec.appendChild(cont);
  }
  function run(){
    try{ mirrorPageBreaks(); }catch(_){}
    try{document.querySelectorAll('[data-sid]').forEach(sec=>{
      if(!visible(sec)) return;
      const sid=sec.getAttribute('data-sid'); if(!sid) return;
      const s=sectionBySid(sid);
      const want = s && String(s.type||'')==='table' && pbrOf(s).some(Boolean);
      const sig = want ? (sid+'|'+pbrOf(s).join(',')+'|'+rowsSig(s)) : '';
      const cur = sec.getAttribute('data-antcv-table-split-sig')||'';
      const haveClone = !!sec.querySelector('[data-antcv-table-split-clone="1"]');
      // Stable: skip when nothing changed and our clones are still attached.
      // This bounds the hide/rebuild (and its flicker) to real data changes and
      // to React re-renders that drop our clones — not every sweep.
      if(sig===cur && (haveClone || !want)) return;
      clear(sec);
      if(want){ apply(sec); }
      if(want && sec.querySelector('[data-antcv-table-split-clone="1"]')) sec.setAttribute('data-antcv-table-split-sig',sig);
      else sec.removeAttribute('data-antcv-table-split-sig');
    });}catch(e){try{console.warn('[table-page-splits-327]',e&&e.message);}catch(_){}}
  }
  let pending=false;function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true});}catch(_){}window.addEventListener('storage',e=>{if(!e||e.key===PAGE_KEY||e.key===SECTIONS_KEY)soon();});window.addEventListener('antcv:sections-updated',soon);window.addEventListener('beforeprint',run);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvTablePageSplits324={version:VERSION,run};
})();
