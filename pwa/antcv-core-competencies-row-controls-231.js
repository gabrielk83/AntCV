/* AntCV Core Competencies row controls (v1.40.263)
 *
 * Per-row controls for the Core Competencies table:
 *   - alignment cycle (centre / justify / left / right)
 *   - page-break selector (1-4)
 *   - reorder via single drag handle (pointer events; works for
 *     mouse, touch, and pen). Replaces the ▲▼ pair from v1.40.231.
 *
 * v263 changes:
 *   (a) Header row (index 0) no longer gets controls. The header has
 *       "Focus Area" + "Strategic Expertise" as field placeholders,
 *       which previously satisfied findRows() — meaning the up
 *       button on row 1 swapped row 1 with the table header,
 *       triggering React's "moving above row 0 is not allowed" and
 *       the blue-screen crash Gabriel reported.
 *   (b) All buttons are 24 × 24 px to match the row X (delete)
 *       button, with consistent border, background, and pointer
 *       affordance.
 *   (c) The ▲ + ▼ pair is replaced by a single grip handle (⠿). On
 *       pointerdown, the row enters drag mode; pointermove shows a
 *       drop indicator on the hover target; pointerup commits the
 *       swap. Works identically for mouse, touch (finger), and pen.
 *       Keyboard accessibility is preserved via Tab + Arrow Up /
 *       Arrow Down on the focused handle.
 */
(function(){
  'use strict';
  const VERSION = '1.40.263';
  const ALIGN_KEY = 'antcv.coreCompetencies.rowAlignment.v1';
  const PAGE_KEY = 'antcv:itemPages';
  const SECTIONS_KEY = 'sections';
  const ALIGN = ['center','justify','left','right'];
  const ICON = { left:'\u21E4', center:'\u2194', justify:'\u2630', right:'\u21E5' };
  const LABEL = { left:'Left aligned', center:'Centered', justify:'Justified', right:'Right aligned' };
  const CORE_RX = /core\s+comp(etenc|atenc|etenc)ies|core\s+competencies/i;
  const HEADER_RX = /^\s*Focus\s+Area\s+Strategic\s+Expert/i;
  const clean = s => String(s||'').replace(/\s+/g,' ').trim();
  const visible = el => !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  function readJson(k, fallback){ try { const v=JSON.parse(localStorage.getItem(k)||''); return v && typeof v==='object' ? v : fallback; } catch(_){ return fallback; } }
  function writeJson(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(_){} }
  function activeDoc(){ try { const d=localStorage.getItem('doc'); return d==='cl'?'cl':'cv'; } catch(_){ return 'cv'; } }

  function readAlignMap(){ return readJson(ALIGN_KEY, {}); }
  function writeAlignMap(m){ writeJson(ALIGN_KEY, m||{}); }
  function getAlign(i){ const v=readAlignMap()['row-'+i]; return ALIGN.includes(v)?v:'left'; }
  function setAlign(i,v){ const m=readAlignMap(); m['row-'+i]=v; writeAlignMap(m); }
  function nextAlign(v){ return ALIGN[(Math.max(0, ALIGN.indexOf(v))+1)%ALIGN.length]; }

  function sections(){ const s=readJson(SECTIONS_KEY, null); const list=s && s[activeDoc()]; return Array.isArray(list)?list:[]; }
  function coreSection(){ return sections().find(s => s && CORE_RX.test(clean(s.title || s.name || s.id || ''))) || null; }
  function coreSid(){ const s=coreSection(); return s && s.id ? String(s.id) : 'core_competencies'; }

  function readPages(){ return readJson(PAGE_KEY, {}); }
  function getPage(i){ const all=readPages(); const b=all[coreSid()] || all.core_competencies || {}; const n=Number(b[String(i)] || b[i] || 1); return Number.isFinite(n) && n>=1 ? Math.min(4, Math.max(1, Math.round(n))) : 1; }
  function setPage(i,n){ const all=readPages(); const sid=coreSid(); if(!all[sid] || typeof all[sid] !== 'object') all[sid]={}; const nn=Math.min(4, Math.max(1, Math.round(Number(n)||1))); if(nn<=1) delete all[sid][String(i)]; else all[sid][String(i)]=nn; writeJson(PAGE_KEY, all); pulse(); }

  // v263: a row is "headerish" if its inputs hold ONLY the labels
  // "Focus Area" / "Strategic Expertise" and nothing else. Those
  // are the column headers, not data rows.
  function isHeaderRow(row){
    if(!row) return true;
    const txt = clean(row.textContent);
    if(HEADER_RX.test(txt)) return true;
    const fields = Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]'));
    if(fields.length === 0) return true;
    // If every visible field's VALUE (not placeholder) is one of the
    // header labels, it's the header.
    const labels = fields.map(f => clean(f.value || f.textContent || ''));
    const allHeaderLabels = labels.length > 0 && labels.every(l =>
      /^Focus\s+Area$/i.test(l) || /^Strategic\s+Expertise$/i.test(l) || l === ''
    );
    if(allHeaderLabels) {
      // Distinguish from an EMPTY new data row by checking placeholders.
      // The header has placeholder = the same label; a data row has
      // placeholder = "[Focus area N]" / "[Strategic expertise]".
      const phs = fields.map(f => clean(f.placeholder || ''));
      const headerPh = phs.some(p => /^Focus\s+Area$|^Strategic\s+Expertise$/i.test(p));
      if(headerPh) return true;
    }
    return false;
  }

  function looksCoreRow(row){
    if(!row || !row.querySelectorAll) return false;
    const txt = clean(row.textContent);
    if(/Core Competencies/i.test(txt) && txt.length < 80) return false;
    const fields = Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]'));
    if(fields.length < 2) return false;
    return fields.some(f => /focus area/i.test((f.value||f.placeholder||f.textContent||''))) || /Focus area\s*\d/i.test(txt);
  }

  function editorContainer(){
    const fields = Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]'));
    const seed = fields.find(f => /focus area/i.test((f.value||f.placeholder||f.textContent||'')));
    if(!seed) return null;
    let p=seed.parentElement, best=null;
    for(let d=0; p && d<9; d++, p=p.parentElement){
      const t=clean(p.textContent);
      const count=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(x=>/focus area|strategic/i.test((x.value||x.placeholder||x.textContent||''))).length;
      if(count>=4) best=p;
      if(CORE_RX.test(t)) { best=p; break; }
    }
    return best;
  }

  function directRowForField(f, root){
    let p=f.parentElement, best=null;
    for(let d=0; p && p!==root.parentElement && d<7; d++, p=p.parentElement){
      const fields=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]'));
      if(fields.length>=2 && fields.length<=4) best=p;
      if(looksCoreRow(p)) { best=p; break; }
    }
    return best;
  }

  function findRows(){
    const root=editorContainer();
    if(!root) return [];
    const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>/focus area/i.test((f.value||f.placeholder||f.textContent||'')));
    const rows=[];
    seeds.forEach(f=>{ const r=directRowForField(f, root); if(r && !rows.includes(r)) rows.push(r); });
    return rows.filter(visible);
  }

  function rowFields(row){ return Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible); }
  function applyEditor(row, align){
    row.setAttribute('data-antcv-core-row-align', align);
    rowFields(row).forEach(f=>{ f.style.textAlign = align; f.setAttribute('data-antcv-core-row-align', align); });
  }

  // v263: uniform 24x24 button sized to match the X (delete)
  // button. Shared style helper so every control we add looks the
  // same and lines up with the existing row buttons.
  function makeButton(cls, text, title){
    const b=document.createElement('button');
    b.type='button';
    b.className=cls;
    b.textContent=text;
    b.title=title;
    b.setAttribute('aria-label', title);
    Object.assign(b.style,{
      display:'inline-flex',
      alignItems:'center',
      justifyContent:'center',
      width:'24px',
      minWidth:'24px',
      height:'24px',
      minHeight:'24px',
      padding:'0',
      margin:'0 2px',
      border:'1px solid #01B7BB',
      borderRadius:'4px',
      background:'rgba(1,183,187,.08)',
      color:'#00746E',
      fontWeight:'700',
      fontSize:'12px',
      lineHeight:'1',
      cursor:'pointer',
      pointerEvents:'auto',
      opacity:'1',
      boxSizing:'border-box'
    });
    return b;
  }
  function paintCJLR(b,a){ b.textContent=ICON[a]||ICON.left; b.title='Core Competencies row alignment: '+(LABEL[a]||a)+'. Click to cycle Center, Justify, Left, Right.'; b.setAttribute('aria-label', b.title); }
  function paintPage(b,i){ const p=getPage(i); b.textContent='\u{1F4C4} '+p; b.title='Start this Core Competencies row on page '+p+'. Click to cycle page 1-4.'; b.setAttribute('aria-label', b.title); }

  function controlsHost(row){
    const buttons=Array.from(row.querySelectorAll('button')).filter(b=>!b.closest('[data-antcv-core-controls="1"]'));
    const last=buttons[buttons.length-1];
    return (last && last.parentElement) || row;
  }

  function moveSectionRow(from,to){
    if(from===to || to<0) return false;
    const s=readJson(SECTIONS_KEY, null); const doc=activeDoc(); const list=s && s[doc]; if(!Array.isArray(list)) return false;
    const sec=list.find(x => x && String(x.id||'')===coreSid()) || list.find(x => x && CORE_RX.test(clean(x.title||'')));
    if(!sec) return false;
    const arr = Array.isArray(sec.items) ? sec.items : Array.isArray(sec.rows) ? sec.rows : Array.isArray(sec.lines) ? sec.lines : null;
    if(!arr || from>=arr.length || to>=arr.length) return false;
    const item=arr.splice(from,1)[0]; arr.splice(to,0,item); writeJson(SECTIONS_KEY,s); pulse(); return true;
  }
  function swapStorageMaps(a,b){
    const am=readAlignMap(); const av=am['row-'+a], bv=am['row-'+b];
    if(av===undefined) delete am['row-'+b]; else am['row-'+b]=av;
    if(bv===undefined) delete am['row-'+a]; else am['row-'+a]=bv;
    writeAlignMap(am);
    const all=readPages(); const sid=coreSid(); const buck=all[sid];
    if(buck){ const ap=buck[String(a)], bp=buck[String(b)]; if(ap===undefined) delete buck[String(b)]; else buck[String(b)]=ap; if(bp===undefined) delete buck[String(a)]; else buck[String(a)]=bp; writeJson(PAGE_KEY,all); }
  }

  // v263: dataRowsOnly() returns findRows() with the header excluded.
  // All swap / move arithmetic uses indices into THIS list, so a
  // swap of "data index 0 and 1" maps to the first two real data
  // rows — never touching the header.
  function dataRowsOnly(){ return findRows().filter(r => !isHeaderRow(r)); }

  function moveDataRow(fromDataIdx, toDataIdx){
    if(fromDataIdx === toDataIdx) return;
    const rows = dataRowsOnly();
    if(fromDataIdx < 0 || toDataIdx < 0 || fromDataIdx >= rows.length || toDataIdx >= rows.length) return;
    swapStorageMaps(fromDataIdx, toDataIdx);
    // Underlying section array is also indexed by data-row position
    // (header is not a section item).
    if(!moveSectionRow(fromDataIdx, toDataIdx)){
      // DOM fallback: only swap data rows, never the header.
      const a = rows[fromDataIdx];
      const b = rows[toDataIdx];
      if(a && b && a.parentNode && b.parentNode === a.parentNode){
        if(fromDataIdx < toDataIdx){
          // moving down — insert a after b
          const next = b.nextSibling;
          a.parentNode.insertBefore(a, next);
        } else {
          // moving up — insert a before b
          a.parentNode.insertBefore(a, b);
        }
      }
      pulse(); runSoon();
    }
  }

  // ----- v263 pointer-events drag handle -----
  //
  // Drag state. Only one row can be in flight at a time.
  let dragState = null;

  function clearDropMarkers(){
    document.querySelectorAll('[data-antcv-core-drop-marker]').forEach(n => {
      try { n.removeAttribute('data-antcv-core-drop-marker'); n.style.boxShadow = ''; } catch(_){}
    });
  }

  function nearestDataRowAt(x, y){
    const rows = dataRowsOnly();
    let best = null; let bestDist = Infinity;
    for(const r of rows){
      const rect = r.getBoundingClientRect();
      // Vertical centre of each row.
      const cy = rect.top + rect.height/2;
      const d = Math.abs(y - cy);
      if(d < bestDist){ bestDist = d; best = r; }
    }
    return best;
  }

  function startDrag(ev, row, dataIdx){
    if(dragState) return;
    if(typeof row.setPointerCapture === 'function' && ev.pointerId !== undefined){
      try { ev.target.setPointerCapture(ev.pointerId); } catch(_){}
    }
    dragState = {
      row: row,
      fromIdx: dataIdx,
      pointerId: ev.pointerId,
      target: null,
      handle: ev.target
    };
    try {
      row.style.outline = '2px dashed #01B7BB';
      row.style.outlineOffset = '2px';
      row.style.opacity = '0.85';
    } catch(_){}
  }

  function moveDrag(ev){
    if(!dragState) return;
    if(ev.pointerId !== undefined && dragState.pointerId !== undefined && ev.pointerId !== dragState.pointerId) return;
    const target = nearestDataRowAt(ev.clientX, ev.clientY);
    if(target === dragState.target) return;
    clearDropMarkers();
    dragState.target = target;
    if(target && target !== dragState.row){
      try {
        target.setAttribute('data-antcv-core-drop-marker', '1');
        target.style.boxShadow = 'inset 0 -3px 0 0 #01B7BB';
      } catch(_){}
    }
  }

  function endDrag(ev){
    if(!dragState) return;
    const target = dragState.target;
    const fromIdx = dragState.fromIdx;
    const row = dragState.row;
    try {
      row.style.outline = '';
      row.style.outlineOffset = '';
      row.style.opacity = '';
    } catch(_){}
    clearDropMarkers();
    if(target && target !== row){
      const rows = dataRowsOnly();
      const toIdx = rows.indexOf(target);
      if(toIdx >= 0 && toIdx !== fromIdx){
        moveDataRow(fromIdx, toIdx);
      }
    }
    dragState = null;
  }

  function cancelDrag(){
    if(!dragState) return;
    const row = dragState.row;
    try {
      row.style.outline = '';
      row.style.outlineOffset = '';
      row.style.opacity = '';
    } catch(_){}
    clearDropMarkers();
    dragState = null;
  }

  // Global listeners installed once. They early-return when there's
  // no active drag, so they're cheap.
  let globalListenersInstalled = false;
  function installGlobalDragListeners(){
    if(globalListenersInstalled) return;
    globalListenersInstalled = true;
    document.addEventListener('pointermove', moveDrag, { passive: true });
    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', cancelDrag);
    document.addEventListener('keydown', function(ev){
      if(ev.key === 'Escape' && dragState){ cancelDrag(); }
    });
  }

  function ensureControls(row, idx){
    // v263: skip the header row entirely. dataRowsOnly() already
    // filters it out; this guard is a belt-and-braces second pass.
    if(isHeaderRow(row)) return;

    row.setAttribute('data-antcv-core-row','1');
    // Look up the row's DATA-row index (not its position in the
    // findRows() list) so storage keys stay stable across renders.
    const rows = dataRowsOnly();
    const dataIdx = rows.indexOf(row);
    if(dataIdx < 0) return;

    applyEditor(row, getAlign(dataIdx));
    let wrap = row.querySelector(':scope > [data-antcv-core-controls="1"]') || row.querySelector('[data-antcv-core-controls="1"]');
    if(!wrap){
      wrap = document.createElement('span');
      wrap.setAttribute('data-antcv-core-controls','1');
      Object.assign(wrap.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap'});
      controlsHost(row).appendChild(wrap);
    }
    Array.from(row.querySelectorAll('[data-antcv-core-controls="1"]')).slice(1).forEach(x=>x.remove());

    // v263: remove any legacy up/down buttons left over from v231.
    Array.from(wrap.querySelectorAll('[data-antcv-core-up],[data-antcv-core-down]')).forEach(x=>x.remove());

    let page = wrap.querySelector('[data-antcv-core-page]');
    if(!page){
      page = makeButton('antcv-core-page','\u{1F4C4} 1','Page');
      page.setAttribute('data-antcv-core-page','1');
      wrap.appendChild(page);
    }

    let grip = wrap.querySelector('[data-antcv-core-grip]');
    if(!grip){
      grip = makeButton('antcv-core-grip','\u2630','Drag to reorder row (or Arrow Up / Arrow Down with focus)');
      grip.setAttribute('data-antcv-core-grip','1');
      // The grip is the only interactive element where we want
      // pointer-down to start a drag, not a click.
      Object.assign(grip.style, { cursor: 'grab', touchAction: 'none', userSelect: 'none' });
      wrap.appendChild(grip);
    }

    let cjlr = wrap.querySelector('[data-antcv-core-cjlr]');
    if(!cjlr){
      cjlr = makeButton('antcv-core-cjlr','\u21E4','Row alignment');
      cjlr.setAttribute('data-antcv-core-cjlr','1');
      wrap.appendChild(cjlr);
    }

    paintPage(page, dataIdx);
    paintCJLR(cjlr, getAlign(dataIdx));

    page.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); setPage(dataIdx, getPage(dataIdx)%4 + 1); paintPage(page,dataIdx); applyPreview(); };
    cjlr.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); const n=nextAlign(getAlign(dataIdx)); setAlign(dataIdx,n); paintCJLR(cjlr,n); applyEditor(row,n); applyPreview(); };

    // Drag handlers on the grip.
    grip.onpointerdown = function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      try { grip.style.cursor = 'grabbing'; } catch(_){}
      // Recompute the data index at drag start in case rows shifted.
      const liveIdx = dataRowsOnly().indexOf(row);
      if(liveIdx < 0) return;
      startDrag(ev, row, liveIdx);
    };
    grip.onpointerup = function(){
      try { grip.style.cursor = 'grab'; } catch(_){}
    };
    grip.onkeydown = function(ev){
      const liveIdx = dataRowsOnly().indexOf(row);
      if(liveIdx < 0) return;
      if(ev.key === 'ArrowUp' && liveIdx > 0){
        ev.preventDefault();
        moveDataRow(liveIdx, liveIdx - 1);
        // Refocus the same grip after the move so chained presses work.
        setTimeout(() => { try { (dataRowsOnly()[liveIdx-1] || row).querySelector('[data-antcv-core-grip]').focus(); } catch(_){} }, 0);
      } else if(ev.key === 'ArrowDown' && liveIdx < dataRowsOnly().length - 1){
        ev.preventDefault();
        moveDataRow(liveIdx, liveIdx + 1);
        setTimeout(() => { try { (dataRowsOnly()[liveIdx+1] || row).querySelector('[data-antcv-core-grip]').focus(); } catch(_){} }, 0);
      }
    };
  }

  function previewSection(){
    const sid=coreSid();
    return document.querySelector('[data-sid="'+CSS.escape(sid)+'"]') || Array.from(document.querySelectorAll('[data-sid], section, div')).find(el=>visible(el) && CORE_RX.test(clean(el.textContent).slice(0,160)));
  }
  function previewRows(sec){
    if(!sec) return [];
    let rows=Array.from(sec.querySelectorAll('tbody tr')).filter(r=>visible(r) && clean(r.textContent));
    if(rows.length) return rows;
    rows=Array.from(sec.querySelectorAll('[data-antcv-row-path^="items."], [data-edit-path*="items."]')).filter(visible);
    const unique=[]; rows.forEach(r=>{ let x=r; for(let d=0; x && d<5; d++, x=x.parentElement){ if((x.tagName||'').toLowerCase()==='tr'){ r=x; break; } } if(!unique.includes(r)) unique.push(r); });
    return unique;
  }
  function clearPreview(sec){ sec && sec.querySelectorAll('[data-antcv-core-page-break="1"],[data-antcv-core-header-clone="1"]').forEach(n=>n.remove()); }
  function cloneHeaderFor(table, row){
    const tr=document.createElement('tr'); tr.setAttribute('data-antcv-core-header-clone','1'); tr.style.breakBefore='page'; tr.style.pageBreakBefore='always';
    let src=table && table.querySelector('thead tr');
    if(!src) src = table && Array.from(table.querySelectorAll('tr')).find(r => r !== row && /focus area|strategic expertise/i.test(clean(r.textContent)));
    if(src){ tr.innerHTML = src.innerHTML; Array.from(tr.children).forEach(c=>{ c.style.fontWeight='700'; c.style.borderBottom='1px solid currentColor'; }); }
    else { const td=document.createElement('td'); td.colSpan=Math.max(1,row.children.length||2); td.textContent='CORE COMPETENCIES (CONT.)'; td.style.fontWeight='700'; tr.appendChild(td); }
    return tr;
  }
  function applyPreview(){
    const sec=previewSection(); if(!sec) return; clearPreview(sec);
    const rows=previewRows(sec); if(!rows.length) return;
    rows.forEach((r,i)=>{
      const a=getAlign(i); r.style.textAlign=a; r.setAttribute('data-antcv-core-row-preview-align',a); Array.from(r.querySelectorAll('td,th,span,div,p')).forEach(x=>{ x.style.textAlign=a; });
    });
    rows.forEach((r,i)=>{
      if(getPage(i)<2) return;
      const table=r.closest('table');
      if(table && r.parentNode){ r.parentNode.insertBefore(cloneHeaderFor(table,r), r); }
      else { const br=document.createElement('div'); br.setAttribute('data-antcv-core-page-break','1'); br.style.breakBefore='page'; br.style.pageBreakBefore='always'; br.style.height='0'; r.parentNode && r.parentNode.insertBefore(br,r); }
    });
  }

  function pulse(){ try{ window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'core-competencies-row-controls', version:VERSION}})); }catch(_){} }
  let pending=false;
  function runSoon(){ if(pending) return; pending=true; requestAnimationFrame(()=>{ pending=false; run(); }); }
  function run(){
    try{
      installGlobalDragListeners();
      const rows = findRows();
      // Render controls for data rows only. The header is skipped
      // inside ensureControls() too, but iterating the full set lets
      // us still see the header in the DOM walk if needed in future.
      rows.forEach(r => { ensureControls(r); });
      applyPreview();
    } catch(e){
      try{ console.warn('[core-competencies-row-controls ' + VERSION + '] failed:', e && e.message); }catch(_){}
    }
  }
  function start(){
    run();
    [100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));
    try{ new MutationObserver(runSoon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']}); }catch(_){}
    window.addEventListener('input',runSoon,true);
    window.addEventListener('click',()=>setTimeout(run,0),true);
    window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));
    setInterval(run,2000);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.AntcvCoreCompetenciesRowControls231 = { version:VERSION, run, _findRows:findRows, _dataRowsOnly:dataRowsOnly, _isHeaderRow:isHeaderRow, _applyPreview:applyPreview };
})();
