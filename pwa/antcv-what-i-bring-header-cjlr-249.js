/* AntCV What I Bring header CJLR + row button order (v1.40.249)
 * - Adds a CJLR alignment button to row 0 in What I Bring.
 *   Row 0 controls only the heading line / table header alignment.
 * - Keeps one CJLR button per row, embedded in that row.
 * - Places CJLR buttons in the same column across header and body rows;
 *   the page button sits after the CJLR so it does not break the CJLR column.
 * - Documents added controls with data-antcv-control-owner-* attributes.
 */
(function(){
  'use strict';
  // v1.40.249-fix-cjlr-isolate (2026-05-28):
  //   1. ALIGN_KEY was shared with Core Competencies, so toggling
  //      CJLR in Core changed What I Bring (and vice-versa). Each
  //      section now owns its own storage key.
  //   2. CORE_RX matched either section name; this script is the
  //      WHAT I BRING handler — tightened to only that title so
  //      Core Competencies never enters this code path.
  //   3. coreSection()/coreSid() renamed mentally — physical names
  //      unchanged to keep this a single-hunk targeted fix.
  const VERSION='1.40.249-fix-cjlr-isolate-preview-guard';
  if(window.__antcvWhatIBringHeaderCjlr249===VERSION) return;
  window.__antcvWhatIBringHeaderCjlr249=VERSION;

  const ALIGN_KEY='antcv.whatIBring.rowAlignment.v1';
  const PAGE_KEY='antcv:itemPages';
  const SECTIONS_KEY='sections';
  const ALIGN=['center','justify','left','right'];
  const ICON={left:'⇤',center:'↔',justify:'☰',right:'⇥'};
  const LABEL={left:'Left aligned',center:'Centered',justify:'Justified',right:'Right aligned'};
  const CORE_RX=/what\s+i\s+bring/i;

  function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  // BOOT-WIB-PERF-001 (nightly 2026-06-24): clean(el.textContent) was called ~5x
  // per table row (header/body filters) + on the 10-ancestor editorRoot climb,
  // each re-serialising the subtree. Per-run memo collapses repeats (boot-perf).
  let __wibTC=null;
  function cleanText(el){if(!el)return '';if(__wibTC){const c=__wibTC.get(el);if(c!==undefined)return c;}const t=clean(el.textContent);if(__wibTC)__wibTC.set(el,t);return t;}
  function readJson(k,fallback){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:fallback;}catch(_){return fallback;}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function activeDoc(){try{return localStorage.getItem('doc')==='cl'?'cl':'cv';}catch(_){return 'cv';}}
  function sections(){const s=readJson(SECTIONS_KEY,null);const list=s&&s[activeDoc()];return Array.isArray(list)?list:[];}
  function coreSection(){return sections().find(s=>s&&CORE_RX.test(clean(s.title||s.name||s.id||'')))||null;}
  function coreSid(){const s=coreSection();return s&&s.id?String(s.id):'core_competencies';}

  function readAlignMap(){return readJson(ALIGN_KEY,{});}
  function getAlign(i){const v=readAlignMap()['row-'+i];return ALIGN.includes(v)?v:'left';}
  function setAlign(i,v){const m=readAlignMap();m['row-'+i]=v;writeJson(ALIGN_KEY,m);}
  function nextAlign(v){return ALIGN[(Math.max(0,ALIGN.indexOf(v))+1)%ALIGN.length];}
  function readPages(){return readJson(PAGE_KEY,{});}
  function getPage(i){const all=readPages();const b=all[coreSid()]||all.core_competencies||{};const n=Number(b[String(i)]||b[i]||1);return Number.isFinite(n)&&n>=1?Math.min(4,Math.max(1,Math.round(n))):1;}
  function setPage(i,n){const all=readPages();const sid=coreSid();if(!all[sid]||typeof all[sid]!=='object')all[sid]={};const nn=Math.min(4,Math.max(1,Math.round(Number(n)||1)));if(nn<=1)delete all[sid][String(i)];else all[sid][String(i)]=nn;writeJson(PAGE_KEY,all);pulse();}

  function looksRow(row){
    if(!row||!row.querySelectorAll) return false;
    const fields=Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
    if(fields.length<2) return false;
    const txt=cleanText(row);
    return /focus area|strategic expertise/i.test(txt) || fields.some(f=>/focus area|strategic/i.test(f.value||f.placeholder||f.textContent||''));
  }
  // v1.50.943 BOOT-WIB-ROOTCACHE-001: editorRoot ran a full-document
  // querySelectorAll('input,textarea,[contenteditable]') to find the focus-area
  // seed on EVERY run() (boot timers + MutationObserver + click/input/
  // sections-updated = dozens of times during the boot storm) though the editor
  // root is the same element each time (~99ms boot self-time). Cache the resolved
  // root across runs + re-validate it cheaply against its OWN subtree (scoped
  // querySelectorAll, not the whole document); only re-scan when stale. Same
  // cross-run cache pattern as 274's panelRoot / BOOT-WM-PERF-001. A preview-paper
  // root is never cached + always invalidated, so the inPreviewPaper guard in
  // findRows behaves exactly as before. Null results are not cached.
  function editorRootValid(p){
    if(!p||!p.isConnected||inPreviewPaper(p)) return false;
    if(CORE_RX.test(cleanText(p))) return true;
    const count=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(x=>/focus area|strategic/i.test(x.value||x.placeholder||x.textContent||'')).length;
    return count>=4;
  }
  let __editorRootCache=null;
  function editorRoot(){
    if(__editorRootCache){ if(editorRootValid(__editorRootCache)) return __editorRootCache; __editorRootCache=null; }
    const seeds=Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>/focus area|strategic expertise/i.test(f.value||f.placeholder||f.textContent||''));
    const seed=seeds[0]; if(!seed) return null;
    let p=seed.parentElement,best=null;
    for(let d=0;p&&d<10;d++,p=p.parentElement){
      const t=cleanText(p);
      const count=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(x=>/focus area|strategic/i.test(x.value||x.placeholder||x.textContent||'')).length;
      if(count>=4) best=p;
      if(CORE_RX.test(t)){best=p;break;}
    }
    if(best && !inPreviewPaper(best)) __editorRootCache=best;
    return best;
  }
  function directRowForField(f,root){
    let p=f.parentElement,best=null;
    for(let d=0;p&&p!==root.parentElement&&d<7;d++,p=p.parentElement){
      const fields=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
      if(fields.length>=2&&fields.length<=5) best=p;
      if(looksRow(p)){best=p;break;}
    }
    return best;
  }
  // v1.40.249-fix-cjlr-isolate-preview-guard (2026-05-28): refuse to
  // treat any row whose ancestor is .antcv-preview-paper as an editor
  // row. Otherwise ensure() mounts the CJLR + page-break host on top
  // of the WHAT I BRING table headers in the CL Preview, which the
  // user is seeing as a duplicate visible button. The applyPreview()
  // function elsewhere in this script handles per-row alignment in
  // the rendered preview without injecting button hosts.
  function inPreviewPaper(el){const paper=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');return !!(paper && el && paper.contains(el));}
  function findRows(){
    const root=editorRoot(); if(!root) return [];
    if(inPreviewPaper(root)) return []; // root resolved inside preview — refuse
    const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>/focus area/i.test(f.value||f.placeholder||f.textContent||''));
    const rows=[];
    seeds.forEach(f=>{const r=directRowForField(f,root); if(r&&visible(r)&&!rows.includes(r)&&!inPreviewPaper(r)) rows.push(r);});
    return rows;
  }
  function rowFields(row){return Array.from(row.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);}
  function makeButton(kind){
    const b=document.createElement('button'); b.type='button'; b.setAttribute('data-antcv-wib-'+kind+'-249','1');
    Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'24px',minWidth:'24px',height:'22px',minHeight:'22px',padding:'0',margin:'0 1px',border:'1px solid #01B7BB',borderRadius:'5px',background:'rgba(1,183,187,.08)',color:'#00746E',fontWeight:'700',fontSize:'12px',lineHeight:'1',cursor:'pointer',pointerEvents:'auto',position:'static',float:'none',flex:'0 0 auto'});
    return b;
  }
  function paintCJLR(b,i){const a=getAlign(i);b.textContent=ICON[a]||ICON.left;b.title='What I Bring row '+i+' alignment: '+(LABEL[a]||a)+'. Click to cycle Center, Justify, Left, Right.';b.setAttribute('aria-label',b.title);}
  function paintPage(b,i){const p=getPage(i);b.textContent='📄 '+p;b.title='Start this What I Bring row on page '+p+'. Click to cycle page 1-4.';b.setAttribute('aria-label',b.title);}
  function host(row){
    let h=row.querySelector(':scope > [data-antcv-wib-row-control-host-249="1"]');
    if(!h){
      h=document.createElement('span'); h.setAttribute('data-antcv-wib-row-control-host-249','1');
      Object.assign(h.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap',position:'static',float:'none',verticalAlign:'middle',flex:'0 0 auto'});
      const fields=rowFields(row); const second=fields[1];
      const anchor=(second&&second.parentElement)||row;
      if(anchor&&anchor.parentElement===row) row.insertBefore(h, anchor.nextSibling);
      else row.appendChild(h);
    }
    return h;
  }
  function applyEditor(row,i){
    const a=getAlign(i); row.setAttribute('data-antcv-core-row-align',a);
    rowFields(row).forEach(f=>{f.style.textAlign=a;f.setAttribute('data-antcv-core-row-align',a);});
  }
  function documentControl(el,i,role){
    el.setAttribute('data-antcv-control-owner-section','What I Bring');
    el.setAttribute('data-antcv-control-owner-role',role||'row');
    el.setAttribute('data-antcv-control-owner-index',String(i));
    el.setAttribute('data-antcv-control-embedded','1');
  }
  function ensure(row,i){
    row.setAttribute('data-antcv-core-row','1');
    row.style.position='relative';
    applyEditor(row,i);
    const h=host(row); documentControl(h,i,'row');

    // Remove older duplicate core CJLR buttons from this row. This script owns the row CJLR now.
    Array.from(row.querySelectorAll('[data-antcv-core-cjlr],.antcv-core-cjlr')).forEach(x=>{ if(!x.hasAttribute('data-antcv-wib-cjlr-249')) x.remove(); });

    let cjlr=h.querySelector(':scope [data-antcv-wib-cjlr-249="1"]');
    if(!cjlr){cjlr=makeButton('cjlr'); h.appendChild(cjlr);}
    cjlr.setAttribute('data-antcv-core-cjlr','1'); cjlr.classList.add('antcv-core-cjlr');
    paintCJLR(cjlr,i); documentControl(cjlr,i,i===0?'heading':'row');
    cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const n=nextAlign(getAlign(i));setAlign(i,n);paintCJLR(cjlr,i);applyEditor(row,i);applyPreview();pulse();};

    let page=h.querySelector(':scope [data-antcv-wib-page-249="1"]');
    // Body rows have page control. Header row 0 only has CJLR.
    if(i===0){ if(page) page.remove(); }
    else{
      if(!page){page=makeButton('page'); h.appendChild(page);}
      page.setAttribute('data-antcv-core-page','1');
      paintPage(page,i); documentControl(page,i,'row-page');
      page.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setPage(i,getPage(i)%4+1);paintPage(page,i);applyPreview();};
      // Keep CJLR before page so every CJLR button sits in the same vertical column.
      if(cjlr.nextSibling!==page) h.insertBefore(cjlr,page);
    }
  }
  function previewSection(){const sid=coreSid();return document.querySelector('[data-sid="'+CSS.escape(sid)+'"]')||Array.from(document.querySelectorAll('[data-sid],section,div')).find(el=>visible(el)&&CORE_RX.test(cleanText(el).slice(0,180)));}
  function clearPreview(sec){sec&&sec.querySelectorAll('[data-antcv-core-page-break="1"],[data-antcv-core-header-clone="1"]').forEach(n=>n.remove());}
  function cloneHeaderFor(table,beforeRow){
    const br=document.createElement('tr'); br.setAttribute('data-antcv-core-page-break','1'); br.style.breakBefore='page'; br.style.pageBreakBefore='always'; br.style.height='0';
    const cols=(beforeRow&&beforeRow.children&&beforeRow.children.length)||2; const td=document.createElement('td'); td.colSpan=cols; td.style.height='0'; td.style.padding='0'; td.style.border='0'; br.appendChild(td);
    const src=Array.from(table.querySelectorAll('tr')).find(r=>/focus area/i.test(cleanText(r))&&/strategic expertise/i.test(cleanText(r)));
    if(src){const clone=src.cloneNode(true); clone.setAttribute('data-antcv-core-header-clone','1'); clone.querySelectorAll('button,[data-antcv-wib-row-control-host-249]').forEach(x=>x.remove()); if(src.parentNode){src.parentNode.insertBefore(br,beforeRow);src.parentNode.insertBefore(clone,beforeRow);return br;}}
    return br;
  }
  function applyPreview(){
    const sec=previewSection(); if(!sec) return; clearPreview(sec);
    const rows=Array.from(sec.querySelectorAll('tr,li,[data-antcv-row-path^="items."],.cv-item')).filter(visible);
    const headerRows=rows.filter(r=>/focus area/i.test(cleanText(r))&&/strategic expertise/i.test(cleanText(r)));
    const bodyRows=rows.filter(r=>/focus area\s*\d/i.test(cleanText(r))&&!headerRows.includes(r));
    function setRowAlign(r,a){r.style.textAlign=a; r.querySelectorAll('td,th,div,span,p,li').forEach(x=>{x.style.textAlign=a;});}
    headerRows.forEach(r=>setRowAlign(r,getAlign(0)));
    bodyRows.forEach((r,idx)=>setRowAlign(r,getAlign(idx+1)));
    bodyRows.forEach((r,idx)=>{const rowIndex=idx+1;if(getPage(rowIndex)<2)return;const table=r.closest('table');if(table&&r.parentNode)r.parentNode.insertBefore(cloneHeaderFor(table,r),r);else{const br=document.createElement('div');br.setAttribute('data-antcv-core-page-break','1');br.style.breakBefore='page';br.style.pageBreakBefore='always';br.style.height='0';r.parentNode&&r.parentNode.insertBefore(br,r);}});
  }
  function pulse(){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'what-i-bring-header-cjlr-249',version:VERSION}}));}catch(_){}}
  function injectCss(){
    if(document.getElementById('antcv-wib-header-cjlr-249-css')) return;
    const s=document.createElement('style'); s.id='antcv-wib-header-cjlr-249-css';
    s.textContent='[data-antcv-wib-row-control-host-249="1"]{display:inline-flex!important;align-items:center!important;gap:2px!important;position:static!important;float:none!important;white-space:nowrap!important;vertical-align:middle!important}[data-antcv-wib-row-control-host-249="1"] button{position:static!important;float:none!important;flex:0 0 auto!important}';
    (document.head||document.documentElement).appendChild(s);
  }
  let pending=false;
  function run(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;__wibTC=new Map();try{findRows().forEach(ensure);applyPreview();}catch(e){try{console.warn('[what-i-bring-header-cjlr-249]',e&&e.message);}catch(_){}}finally{__wibTC=null;}});}
  function start(){injectCss();run();[80,200,500,1000,1800,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(run).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value','data-antcv-core-row']});}catch(_){ }window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('input',()=>setTimeout(run,0),true);window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvWhatIBringHeaderCjlr249={version:VERSION,run,findRows};
})();
