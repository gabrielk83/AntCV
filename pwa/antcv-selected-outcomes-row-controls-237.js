/* AntCV Selected Outcomes row controls (v1.40.237)
 * - Adds per-outcome Compress, Enrich and CJLR controls before the delete button.
 * - CJLR affects only that selected-outcome sub-sub-section in editor and preview.
 * - Buttons are sized to match the existing delete/X control.
 */
(function(){
  'use strict';
  const VERSION='1.51.56-preview-mismatch-guard';
  // v1.40.237-preview-guard: Preview is button-free. Reject seeds and
  // hosts inside .antcv-preview-paper.
  const isInPreviewPaper=el=>{if(!el)return false;const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');return !!(p&&p.contains(el));};
  const ALIGN_KEY='antcv.selectedOutcomes.rowAlignment.v1';
  const PAGE_KEY='antcv:itemPages';
  const SECTIONS_KEY='sections';
  const OUTCOME_RX=/selected\s+outcomes?/i;
  const ALIGN=['center','justify','left','right'];
  const ICON={left:'⇤',center:'↔',justify:'☰',right:'⇥'};
  const LABEL={left:'Left aligned',center:'Centered',justify:'Justified',right:'Right aligned'};
  // v1.50.880 BOOT-OUTCOMES-PERF-001: per-run memo for the pure whitespace-clean
  // (cleared at run() start). editorRoot's ancestor climb + previewItems re-clean the
  // same large container textContents repeatedly; the memo collapses those. Pure fn,
  // so behaviour is identical.
  const _cleanMemo=new Map();
  const clean=s=>{const k=String(s||'');let v=_cleanMemo.get(k);if(v===undefined){v=k.replace(/\s+/g,' ').trim();_cleanMemo.set(k,v);}return v;};
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  function readJson(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function activeDoc(){try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}}
  function readAlign(){return readJson(ALIGN_KEY,{});}
  function getAlign(i){const v=readAlign()['row-'+i];return ALIGN.includes(v)?v:'left';}
  function setAlign(i,v){const m=readAlign();m['row-'+i]=v;writeJson(ALIGN_KEY,m);}
  function readPages(){return readJson(PAGE_KEY,{});}
  function getPage(i){const all=readPages();const b=all[outcomeSid()]||all.selected_outcomes||{};const n=Number(b[String(i)]||b[i]||1);return Number.isFinite(n)&&n>=1?Math.min(4,Math.max(1,Math.round(n))):1;}
  function setPage(i,n){const all=readPages();const sid=outcomeSid();if(!all[sid]||typeof all[sid]!=='object')all[sid]={};const nn=Math.min(4,Math.max(1,Math.round(Number(n)||1)));if(nn<=1)delete all[sid][String(i)];else all[sid][String(i)]=nn;writeJson(PAGE_KEY,all);pulsePage();}
  function nextAlign(v){return ALIGN[(Math.max(0,ALIGN.indexOf(v))+1)%ALIGN.length];}
  function sectionsObj(){return readJson(SECTIONS_KEY,null);}
  function sections(){const s=sectionsObj();const a=s&&s[activeDoc()];return Array.isArray(a)?a:[];}
  function outcomeSection(){return sections().find(s=>s&&OUTCOME_RX.test(clean(s.title||s.name||s.id||'')))||null;}
  function outcomeSid(){const s=outcomeSection();return s&&s.id?String(s.id):'selected_outcomes';}
  function pulse(){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'selected-outcomes-row-controls',version:VERSION}}));}catch(_){} try{window.dispatchEvent(new CustomEvent('antcv:item-pages-changed',{detail:{source:'selected-outcomes-row-controls',version:VERSION}}));}catch(_){}}
  // 1.50.218: a PAGE change is not a content change. Firing 'antcv:sections-updated'
  // (as pulse() does) makes the app re-render + re-read the outcomes editor while it
  // is momentarily empty, writing items:[] — i.e. setting a page break DELETED all
  // outcomes. setPage now fires ONLY the page-only event; the native page-box engine
  // reads itemPages on that re-render (which clones in-memory sections, not storage).
  function pulsePage(){try{window.dispatchEvent(new CustomEvent('antcv:item-pages-changed',{detail:{source:'selected-outcomes-page',version:VERSION}}));}catch(_){}}
  function dispatchInput(el){try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){}}

  function editorRoot(){
    const fields=Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>!isInPreviewPaper(f));
    const seed=fields.find(f=>/\[?verb\]?/i.test(String(f.value||f.placeholder||f.textContent||'')));
    if(!seed) return null;
    let p=seed.parentElement,best=null;
    for(let d=0;p&&d<9;d++,p=p.parentElement){
      if(isInPreviewPaper(p)) break;
      const txt=clean(p.textContent);
      const count=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(x=>!isInPreviewPaper(x)&&/\[?verb\]?|outcome text/i.test(String(x.value||x.placeholder||x.textContent||''))).length;
      if(count>=2) best=p;
      if(OUTCOME_RX.test(txt)){best=p;break;}
    }
    return best;
  }
  function directRowForField(f,root){
    let p=f.parentElement,best=null;
    for(let d=0;p&&p!==root.parentElement&&d<7;d++,p=p.parentElement){
      const fields=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
      const buttons=Array.from(p.querySelectorAll('button')).filter(visible);
      if(fields.length>=2&&fields.length<=4) best=p;
      if(fields.length>=2&&buttons.some(b=>/×|x|delete|remove/i.test(clean(b.textContent+' '+(b.title||''))))) {best=p;break;}
    }
    return best;
  }
  function findRows(){
    const root=editorRoot(); if(!root) return [];
    const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>/\[?verb\]?/i.test(String(f.value||f.placeholder||f.textContent||'')));
    const rows=[]; seeds.forEach(f=>{const r=directRowForField(f,root); if(r&&!rows.includes(r)) rows.push(r);});
    return rows.filter(visible);
  }
  function rowFields(row){return Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);}
  function prefixField(row){return rowFields(row)[0]||null;}
  function resultField(row){return rowFields(row)[1]||null;}
  function getVal(f){return f?(f.isContentEditable?f.textContent:f.value)||'':'';}
  function setVal(f,v){if(!f)return;if(f.isContentEditable)f.textContent=v;else f.value=v;dispatchInput(f);}
  function applyEditor(row,a){row.setAttribute('data-antcv-selected-outcome-align',a);rowFields(row).forEach(f=>{f.style.textAlign=a;f.setAttribute('data-antcv-selected-outcome-align',a);});}

  function makeBtn(kind,label,title,ref){
    const b=document.createElement('button'); b.type='button'; b.className='antcv-selected-outcome-'+kind; b.textContent=label; b.title=title; b.setAttribute('aria-label',title); b.setAttribute('data-antcv-selected-outcome-'+kind,'1');
    const w=ref?Math.max(20,Math.round(ref.getBoundingClientRect().width||22)):22;
    const h=ref?Math.max(20,Math.round(ref.getBoundingClientRect().height||22)):22;
    Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:w+'px',minWidth:w+'px',height:h+'px',minHeight:h+'px',padding:'0',margin:'0 1px',border:'1px solid #01B7BB',borderRadius:'4px',background:'rgba(1,183,187,.08)',color:'#00746E',fontWeight:'700',fontSize:'11px',lineHeight:'1',cursor:'pointer',pointerEvents:'auto'});
    return b;
  }
  function paintCJLR(b,a){b.textContent=ICON[a]||ICON.left;b.title='Selected outcome alignment: '+(LABEL[a]||a)+'. Click to cycle Center, Justify, Left, Right.';b.setAttribute('aria-label',b.title);}
  function paintPage(b,i){const p=getPage(i);b.textContent='📄 '+p;b.title='Start this selected outcome on page '+p+'. Click to cycle page 1-4.';b.setAttribute('aria-label',b.title);}
  function deleteButton(row){
    const bs=Array.from(row.querySelectorAll('button')).filter(visible).filter(b=>!b.closest('[data-antcv-selected-outcome-controls="1"]'));
    return bs.find(b=>/×|x|delete|remove/i.test(clean(b.textContent+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||''))))||bs[bs.length-1]||null;
  }
  function controlsHost(row,x){return (x&&x.parentElement)||row;}

  const weakWords=[/\b(successfully\b\s*)/gi,/\b(effectively\b\s*)/gi,/\b(various\b\s*)/gi,/\bmultiple\b/gi,/\bin order to\b/gi,/\bwas responsible for\b/gi];
  function compressText(s){
    let t=clean(s); if(!t) return t;
    weakWords.forEach(rx=>{t=t.replace(rx,'');});
    t=t.replace(/\s*,\s*/g,', ').replace(/\s*;\s*/g,'; ').replace(/\s+/g,' ').trim();
    if(t.length>180){const parts=t.split(/(?<=[.!?])\s+/); if(parts[0]&&parts[0].length>=60)t=parts[0];}
    return t;
  }
  function enrichText(prefix,result){
    const r=clean(result); const p=clean(prefix).replace(/[\[\]]/g,'');
    if(!r) return r;
    if(/\b(by|using|through|with|for)\b/i.test(r) || /\d/.test(r)) return r;
    const lead=p && !/verb/i.test(p) ? p.charAt(0).toUpperCase()+p.slice(1) : '';
    if(lead && !new RegExp('^'+lead.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(r)) return lead+' '+r.charAt(0).toLowerCase()+r.slice(1)+' with clearer scope and result';
    return r+' with clearer scope and result';
  }
  function updateStorageRow(idx, updater){
    const all=sectionsObj(); const doc=activeDoc(); const list=all&&all[doc]; if(!Array.isArray(list)) return;
    const sec=list.find(x=>x&&(String(x.id||'')===outcomeSid()||OUTCOME_RX.test(clean(x.title||x.name||'')))); if(!sec) return;
    const arr=Array.isArray(sec.items)?sec.items:Array.isArray(sec.rows)?sec.rows:Array.isArray(sec.lines)?sec.lines:Array.isArray(sec.outcomes)?sec.outcomes:null;
    if(!arr||idx<0||idx>=arr.length) return;
    arr[idx]=updater(arr[idx]); writeJson(SECTIONS_KEY,all); pulse();
  }
  function syncStorageFromRow(idx,row){
    const pf=getVal(prefixField(row)), rf=getVal(resultField(row));
    updateStorageRow(idx,item=>{
      if(item&&typeof item==='object'){ const n=Object.assign({},item); if('prefix' in n)n.prefix=pf; else if('verb' in n)n.verb=pf; else if('b' in n)n.b=pf; else n.prefix=pf; if('text' in n)n.text=rf; else if('result' in n)n.result=rf; else if('t' in n)n.t=rf; else n.text=rf; return n; }
      return pf ? (pf+' '+rf).trim() : rf;
    });
  }

  function ensureControls(row,idx){
    row.setAttribute('data-antcv-selected-outcome-row','1'); applyEditor(row,getAlign(idx));
    Array.from(row.querySelectorAll('[data-antcv-selected-outcome-controls="1"]')).slice(1).forEach(x=>x.remove());
    let wrap=row.querySelector('[data-antcv-selected-outcome-controls="1"]');
    const x=deleteButton(row);
    if(!wrap){wrap=document.createElement('span');wrap.setAttribute('data-antcv-selected-outcome-controls','1');Object.assign(wrap.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap'});const h=controlsHost(row,x);if(x&&x.parentNode===h)h.insertBefore(wrap,x);else h.appendChild(wrap);}
    const ref=x||wrap.querySelector('button');
    // Keep controls compact enough for the delete/X button to stay on the same line.
    const fields=rowFields(row); if(fields[0]){fields[0].style.maxWidth='124px';fields[0].style.flex='0 1 124px';} if(fields[1]){fields[1].style.minWidth='120px';fields[1].style.flex='1 1 160px';}
    let page=wrap.querySelector('[data-antcv-selected-outcome-page]'); if(!page){page=makeBtn('page','📄 1','Page',ref);page.setAttribute('data-antcv-selected-outcome-page','1');wrap.appendChild(page);}
    let comp=wrap.querySelector('[data-antcv-selected-outcome-compress]'); if(!comp){comp=makeBtn('compress','↹','Fit selected outcome',ref);wrap.appendChild(comp);}
    let enr=wrap.querySelector('[data-antcv-selected-outcome-enrich]'); if(!enr){enr=makeBtn('enrich','✨','Enrich selected outcome',ref);wrap.appendChild(enr);}
    let cjlr=wrap.querySelector('[data-antcv-selected-outcome-cjlr]'); if(!cjlr){cjlr=makeBtn('cjlr','⇤','Selected outcome alignment',ref);wrap.appendChild(cjlr);}
    // GEN-003 standard order: Page Break, CJLR, Enhance, Fit (Delete is owned elsewhere).
    [page,cjlr,enr,comp].forEach(function(b){if(b&&b.parentNode===wrap)wrap.appendChild(b);});
    paintPage(page,idx); paintCJLR(cjlr,getAlign(idx));
    page.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setPage(idx,getPage(idx)%4+1);paintPage(page,idx);applyPreview();};
    comp.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const f=resultField(row);setVal(f,compressText(getVal(f)));syncStorageFromRow(idx,row);applyPreview();};
    enr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const f=resultField(row);setVal(f,enrichText(getVal(prefixField(row)),getVal(f)));syncStorageFromRow(idx,row);applyPreview();};
    cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const n=nextAlign(getAlign(idx));setAlign(idx,n);paintCJLR(cjlr,n);applyEditor(row,n);applyPreview();};
  }

  // OUTCOMES-PREVIEW-MISMATCH-001 (owner 2026-07-03, demo "jumping"): when the CV has NO
  // SELECTED OUTCOMES section (the wizard/demo template), the old fallback matched ANY visible
  // div whose first 160 chars contained "selected outcomes" — a giant app container — and
  // applyPreview stamped its default 'left' onto every td/th/span inside it (incl. the CORE
  // COMPETENCIES header). 234 wrote center/justify back; the two MutationObserver sweeps
  // re-triggered each other in an endless ~10ms center<->left loop. Guard: no outcomes section
  // in the DATA -> nothing to align; the DOM fallback only accepts a [data-sid] host.
  function previewSection(){if(!outcomeSection())return null;const sid=outcomeSid();return document.querySelector('[data-sid="'+CSS.escape(sid)+'"]')||Array.from(document.querySelectorAll('[data-sid]')).find(el=>visible(el)&&OUTCOME_RX.test(clean(el.textContent).slice(0,160)))||null;}
  function previewItems(sec){
    if(!sec)return[];
    const candidates=Array.from(sec.querySelectorAll('li,tr,[data-antcv-row-path^="items."],[data-edit-path*="items."],p,div')).filter(visible).filter(el=>{
      const t=clean(el.textContent); if(!t||OUTCOME_RX.test(t)) return false; if(el.querySelector('input,textarea,button')) return false; return t.length>2;
    });
    const unique=[]; candidates.forEach(el=>{let keep=el; for(let p=el.parentElement;p&&p!==sec&&p.textContent&&clean(p.textContent)===clean(el.textContent);p=p.parentElement) keep=p; if(!unique.some(x=>x===keep||x.contains(keep)||keep.contains(x))) unique.push(keep);});
    return unique.slice(0,findRows().length||unique.length);
  }
  function clearPreview(sec){sec&&sec.querySelectorAll('[data-antcv-selected-outcome-page-break="1"],[data-antcv-selected-outcome-cont-header="1"]').forEach(n=>n.remove());}
  function makeBreak(){const d=document.createElement('div');d.setAttribute('data-antcv-selected-outcome-page-break','1');d.setAttribute('aria-hidden','true');Object.assign(d.style,{breakBefore:'page',pageBreakBefore:'always',height:'0',margin:'0',padding:'0',lineHeight:'0'});return d;}
  function makeContHeader(){const d=document.createElement('div');d.setAttribute('data-antcv-selected-outcome-cont-header','1');Object.assign(d.style,{color:'#00746E',fontWeight:'700',fontSize:'12pt',marginTop:'4pt',marginBottom:'8pt',borderBottom:'1pt solid #00746E',paddingBottom:'2pt',fontFamily:'Trebuchet MS, Calibri, sans-serif'});d.textContent='SELECTED OUTCOMES (CONT.)';return d;}
  function applyPreview(){const sec=previewSection(); if(!sec)return; clearPreview(sec); const items=previewItems(sec); items.forEach((it,i)=>{const a=getAlign(i);it.style.textAlign=a;it.setAttribute('data-antcv-selected-outcome-preview-align',a);Array.from(it.querySelectorAll('span,div,p,td,th,strong,b')).forEach(x=>{x.style.textAlign=a;});}); items.forEach((it,i)=>{if(getPage(i)<2)return;const p=it.parentNode;if(!p)return;p.insertBefore(makeBreak(),it);p.insertBefore(makeContHeader(),it);});}
  let pending=false; function runSoon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function run(){_cleanMemo.clear();try{findRows().forEach(ensureControls);applyPreview();}catch(e){try{console.warn('[selected-outcomes-row-controls-237] failed:',e&&e.message);}catch(_){}}}
  function start(){run();[100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(runSoon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){}window.addEventListener('input',runSoon,true);window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));setInterval(run,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.AntcvSelectedOutcomesRowControls237={version:VERSION,run,_findRows:findRows,_applyPreview:applyPreview};
})();
