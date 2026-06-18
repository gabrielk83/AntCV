/* AntCV Core Competencies row controls (v1.40.242)
 * - adds per-row CJLR, page, and reorder controls to Core Competencies rows
 * - CJLR affects only that row/sub-sub-section, both editor and preview
 * - page >= 2 splits the preview table at that row, repeats the table header,
 *   and forces everything below to continue on the next page
 */
(function(){
  'use strict';
  const VERSION = '1.50.691-core-controls';
  // v1.40.242-preview-guard: Preview is button-free. Reject seeds and
  // hosts inside .antcv-preview-paper.
  const isInPreviewPaper = el => { if(!el) return false; const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]'); return !!(p && p.contains(el)); };
  const ALIGN_KEY = 'antcv.coreCompetencies.rowAlignment.v1';
  const PAGE_KEY = 'antcv:itemPages';
  const SECTIONS_KEY = 'sections';
  const ALIGN = ['center','justify','left','right'];
  const ICON = { left:'⇤', center:'↔', justify:'☰', right:'⇥' };
  const LABEL = { left:'Left aligned', center:'Centered', justify:'Justified', right:'Right aligned' };
  const CORE_RX = /core\s+comp(etenc|atenc|etenc)ies|core\s+competencies/i;
  const clean = s => String(s||'').replace(/\s+/g,' ').trim();
  const visible = el => !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));

  function readJson(k, fallback){ try { const v=JSON.parse(localStorage.getItem(k)||''); return v && typeof v==='object' ? v : fallback; } catch(_){ return fallback; } }
  function writeJson(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(_){} }
  function activeDoc(){ try { let d=localStorage.getItem('doc')||''; try { const p=JSON.parse(d); if(typeof p==='string') d=p; } catch(e){} return String(d).toLowerCase()==='cl'?'cl':'cv'; } catch(_){ return 'cv'; } }

  function readAlignMap(){ return readJson(ALIGN_KEY, {}); }
  function writeAlignMap(m){ writeJson(ALIGN_KEY, m||{}); }
  // TABLE-HEADER-CENTER-001 (owner 2026-06-14): the table HEADER row (editor row
  // 0) defaults to CENTER — matching the React <th> and the export (worker
  // s.headerAlign||"center"). Body rows still default left. An explicit CJLR
  // choice (stored in the align map) still wins for any row. Previously row 0
  // also defaulted left, so this sidecar force-left the header cells in the
  // preview even though every export path centers them.
  // CJLR-DEFAULT-CENTER-001 (owner 2026-06-19: "Default - centered"): header (row 0)
  // AND body rows now default to CENTER. An explicit CJLR choice still wins per row.
  function getAlign(i){ const v=readAlignMap()['row-'+i]; if(ALIGN.includes(v)) return v; return 'center'; }
  function setAlign(i,v){ const m=readAlignMap(); m['row-'+i]=v; writeAlignMap(m); }
  function nextAlign(v){ return ALIGN[(Math.max(0, ALIGN.indexOf(v))+1)%ALIGN.length]; }

  function sections(){ const s=readJson(SECTIONS_KEY, null); const list=s && s[activeDoc()]; return Array.isArray(list)?list:[]; }
  function coreSection(){ return sections().find(s => s && CORE_RX.test(clean(s.title || s.name || s.id || ''))) || null; }
  function coreSid(){ const s=coreSection(); return s && s.id ? String(s.id) : 'core_competencies'; }

  function readPages(){ return readJson(PAGE_KEY, {}); }
  function getPage(i){ const all=readPages(); const b=all[coreSid()] || all.core_competencies || {}; const n=Number(b[String(i)] || b[i] || 1); return Number.isFinite(n) && n>=1 ? Math.min(4, Math.max(1, Math.round(n))) : 1; }
  function setPage(i,n){ const all=readPages(); const sid=coreSid(); if(!all[sid] || typeof all[sid] !== 'object') all[sid]={}; const nn=Math.min(4, Math.max(1, Math.round(Number(n)||1))); if(nn<=1) delete all[sid][String(i)]; else all[sid][String(i)]=nn; writeJson(PAGE_KEY, all); pulse(); }

  function looksCoreRow(row){
    if(!row || !row.querySelectorAll) return false;
    const txt = clean(row.textContent);
    if(/Core Competencies/i.test(txt) && txt.length < 80) return false;
    const fields = Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]'));
    if(fields.length < 2) return false;
    return fields.some(f => /focus area/i.test((f.value||f.placeholder||f.textContent||''))) || /Focus area\s*\d/i.test(txt);
  }

  function editorContainer(){
    const fields = Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>!isInPreviewPaper(f));
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
    // v1.50.80 — idempotency: write only on change (was unconditional every
    // sweep -> part of the attribute-mutation storm driving the re-render loop).
    if(row.getAttribute('data-antcv-core-row-align')!==align) row.setAttribute('data-antcv-core-row-align', align);
    rowFields(row).forEach(f=>{
      if(f.style.textAlign!==align) f.style.textAlign = align;
      if(f.getAttribute('data-antcv-core-row-align')!==align) f.setAttribute('data-antcv-core-row-align', align);
    });
  }

  function makeButton(cls, text, title){
    const b=document.createElement('button'); b.type='button'; b.className=cls; b.textContent=text; b.title=title; b.setAttribute('aria-label', title);
    Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'24px',minWidth:'24px',height:'22px',minHeight:'22px',padding:'0',margin:'0 1px',border:'1px solid #01B7BB',borderRadius:'5px',background:'rgba(1,183,187,.08)',color:'#00746E',fontWeight:'700',fontSize:'12px',lineHeight:'1',cursor:'pointer',pointerEvents:'auto',opacity:'1'});
    return b;
  }
  function makeRoller(){
    const wrap=document.createElement('span'); wrap.setAttribute('data-antcv-core-roller','1');
    Object.assign(wrap.style,{display:'inline-flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:'0',marginRight:'5px',verticalAlign:'middle',whiteSpace:'nowrap',lineHeight:'1'});
    const up=makeButton('antcv-core-roll-up','▲','Move row up'); up.setAttribute('data-antcv-core-up','1');
    const down=makeButton('antcv-core-roll-down','▼','Move row down'); down.setAttribute('data-antcv-core-down','1');
    Object.assign(up.style,{width:'14px',minWidth:'14px',height:'11px',minHeight:'11px',fontSize:'9px',margin:'0',padding:'0',border:'0',borderRadius:'0',background:'transparent',color:'#9AA0A6'});
    Object.assign(down.style,{width:'14px',minWidth:'14px',height:'11px',minHeight:'11px',fontSize:'9px',margin:'0',padding:'0',border:'0',borderRadius:'0',background:'transparent',color:'#9AA0A6'});
    wrap.appendChild(up); wrap.appendChild(down); return wrap;
  }
  function rollerHost(row){
    const fields=rowFields(row); const first=fields[0];
    let host=(first && first.parentElement) || row;
    if(host && host.style){ host.style.display = host.style.display || 'inline-flex'; host.style.alignItems = host.style.alignItems || 'center'; }
    return host;
  }
  function paintCJLR(b,a){ b.textContent=ICON[a]||ICON.left; b.title='Core Competencies row alignment: '+(LABEL[a]||a)+'. Click to cycle Center, Justify, Left, Right.'; b.setAttribute('aria-label', b.title); }
  function paintPage(b,i){ const p=getPage(i); b.textContent='📄 '+p; b.title='Start this Core Competencies row on page '+p+'. Click to cycle page 1-4.'; b.setAttribute('aria-label', b.title); }

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
  function moveDomRow(row, dir){
    const rows=findRows(); const i=rows.indexOf(row); const j=i+dir;
    // Row 0 is the table header. Body rows must never move above it.
    if(i<=0 || j<1 || j>=rows.length) return;
    swapStorageMaps(i,j);
    if(!moveSectionRow(i,j)){
      if(dir<0 && rows[j].parentNode) rows[j].parentNode.insertBefore(row, rows[j]);
      if(dir>0 && rows[j].parentNode) rows[j].parentNode.insertBefore(rows[j], row);
      pulse(); runSoon();
    }
  }

  function ensureControls(row, idx){
    row.setAttribute('data-antcv-core-row','1'); applyEditor(row, getAlign(idx));
    // Keep controls strictly per row. Do not allow a section-level cleanup to steal
    // row 0's heading CJLR or leave an extra CJLR on the last row.
    Array.from(row.querySelectorAll('[data-antcv-core-controls="1"]')).forEach((x,n)=>{ if(n>0) x.remove(); });
    Array.from(row.querySelectorAll('[data-antcv-core-roller="1"]')).forEach((x,n)=>{ if(n>0) x.remove(); });

    let wrap=row.querySelector(':scope > [data-antcv-core-controls="1"]') || row.querySelector('[data-antcv-core-controls="1"]');
    if(!wrap){ wrap=document.createElement('span'); wrap.setAttribute('data-antcv-core-controls','1'); Object.assign(wrap.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap'}); controlsHost(row).appendChild(wrap); }

    // v1.40.246: do not create the redundant left-side CJLR button in the row body.
    // The app already provides the CJLR control at the end of each row. Keep that one.
    Array.from(wrap.querySelectorAll('[data-antcv-core-cjlr], .antcv-core-cjlr')).forEach(x=>x.remove());

    let page=wrap.querySelector('[data-antcv-core-page]');
    if(idx===0){
      row.querySelectorAll('[data-antcv-core-page],[data-antcv-core-roller],[data-antcv-core-up],[data-antcv-core-down],[data-antcv-core-cjlr],.antcv-core-cjlr').forEach(x=>x.remove());
      if(wrap && !wrap.querySelector('button')) wrap.remove();
      return;
    }

    if(!page){ page=makeButton('antcv-core-page','📄 1','Page'); page.setAttribute('data-antcv-core-page','1'); wrap.appendChild(page); }
    paintPage(page,idx);
    page.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); setPage(idx, getPage(idx)%4 + 1); paintPage(page,idx); applyPreview(); };

    let roller=row.querySelector('[data-antcv-core-roller="1"]');
    if(!roller){ roller=makeRoller(); const h=rollerHost(row); h.insertBefore(roller, h.firstChild); }
    const up=roller.querySelector('[data-antcv-core-up]');
    const down=roller.querySelector('[data-antcv-core-down]');
    if(up){ up.style.opacity = idx<=1 ? '0.35' : '1'; up.style.cursor = idx<=1 ? 'default' : 'pointer'; up.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); moveDomRow(row,-1); }; }
    if(down){ down.style.opacity = idx>=findRows().length-1 ? '0.35' : '1'; down.style.cursor = idx>=findRows().length-1 ? 'default' : 'pointer'; down.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); moveDomRow(row,1); }; }
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
    const table=rows[0] && rows[0].closest && rows[0].closest('table');
    const headerRows=[];
    if(table){
      table.querySelectorAll('thead tr').forEach(r=>{ if(visible(r) && !headerRows.includes(r)) headerRows.push(r); });
      if(!headerRows.length){
        const first=Array.from(table.querySelectorAll('tr')).find(r=>visible(r) && /focus area|strategic expertise/i.test(clean(r.textContent)));
        if(first) headerRows.push(first);
      }
    }
    const bodyRows = rows.filter(r => !headerRows.includes(r));
    const applyAlign = (r,a) => {
      if(!r) return;
      // v1.50.80 — idempotency (was unconditional every sweep ~25/sec).
      if(r.style.textAlign!==a) r.style.textAlign=a;
      if(r.getAttribute('data-antcv-core-row-preview-align')!==a) r.setAttribute('data-antcv-core-row-preview-align',a);
      Array.from(r.querySelectorAll('td,th,span,div,p')).forEach(x=>{ if(x.style.textAlign!==a) x.style.textAlign=a; });
    };
    // Editor row 0 is the table heading row, so its CJLR controls preview table headings only.
    headerRows.forEach(r=>applyAlign(r,getAlign(0)));
    bodyRows.forEach((r,i)=>applyAlign(r,getAlign(i+1)));
    // 1.50.203: the page split is now rendered NATIVELY in app.js (React) — the
    // table renderer reads the SAME antcv:itemPages model (key = full-table row
    // index) and emits a salmon bar + "CORE COMPETENCIES (Cont.)" + a SEPARATE
    // <table> with a repeated header per segment. Injecting a cloned-header <tr>
    // here only added local heading lines inside the one table (no real new table)
    // and got reconciled away. The page button (setPage, above) still writes the
    // model; rendering is app.js's job. Per-row alignment above is kept.
  }

  function pulse(){ try{ window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'core-competencies-row-controls', version:VERSION}})); }catch(_){} }
  let pending=false; function runSoon(){ if(pending) return; pending=true; requestAnimationFrame(()=>{ pending=false; run(); }); }
  function run(){ try{ const rows=findRows(); rows.forEach(ensureControls); applyPreview(); } catch(e){ try{ console.warn('[core-competencies-row-controls-242] failed:', e && e.message); }catch(_){} } }
  // CORE-COMP-INPUTS-SMALLER-001 (owner 2026-06-19: "make text[areas] for focus area
  // and strategic expertise smaller"): shrink the row inputs so the controls have room.
  function injectCss(){ if(document.getElementById('antcv-core-comp-inputs-css')) return; var s=document.createElement('style'); s.id='antcv-core-comp-inputs-css'; s.textContent='[data-antcv-core-row="1"] input,[data-antcv-core-row="1"] textarea{font-size:11px !important;padding:3px 4px !important;line-height:1.25 !important;}'; (document.head||document.documentElement).appendChild(s); }
  function start(){ injectCss(); run(); [100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms)); try{ new MutationObserver(runSoon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']}); }catch(_){} window.addEventListener('input',runSoon,true); window.addEventListener('click',()=>setTimeout(run,0),true); window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0)); setInterval(run,2000); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.AntcvCoreCompetenciesRowControls242 = { version:VERSION, run, _findRows:findRows, _applyPreview:applyPreview };
})();
