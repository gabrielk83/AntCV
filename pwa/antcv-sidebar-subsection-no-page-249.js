/* AntCV sidebar subsection page cleanup (v1.40.249)
 * Actual DOM fix:
 * - Remove Page buttons from collapsed sidebar subsection rows.
 * - Publications & Patent: convert Page into Compress instead.
 * - Do not touch PDF/DOCX toolbar or section headers without ON/X.
 */
(function(){
  'use strict';
  const VERSION='1.40.249';
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const text=b=>clean((b&&b.textContent)||'');
  const meta=b=>clean((b&&((b.title||'')+' '+(b.getAttribute('aria-label')||'')+' '+(b.getAttribute('data-antcv-panel-action-211')||'')+' '+(b.getAttribute('data-antcv-panel-action-208')||'')+' '+(b.getAttribute('data-antcv-single-section-page')||'')))||'');
  function buttons(row){return Array.from(row.querySelectorAll('button'));}
  function isOn(b){return /^ON$/i.test(text(b));}
  function isDelete(b){return /^[×x]$/i.test(text(b)) || /delete|remove/i.test(meta(b));}
  function isEnr(b){return /enrich|enhance|sparkle|✨|enr\.?/i.test(meta(b)+' '+text(b)) || b.getAttribute('data-antcv-panel-action-211')==='enr';}
  function isCJLR(b){return /cjlr|align|alignment|⇤|↔|⇥|☰/i.test(meta(b)+' '+text(b)) || b.getAttribute('data-antcv-headline-cjlr')==='1';}
  function isComp(b){return /compress|comp|↹/i.test(meta(b)+' '+text(b)) || b.getAttribute('data-antcv-panel-action-211')==='comp';}
  function isLeftNav(b){return /^[◀‹<←]$/.test(text(b)) || /expand|collapse|open|back/i.test(meta(b)) && !/page/i.test(meta(b));}
  function isPage(b){
    const s=(meta(b)+' '+text(b)).toLowerCase();
    if(b.getAttribute('data-antcv-panel-action-211')==='page' || b.getAttribute('data-antcv-panel-action-208')==='page' || b.getAttribute('data-antcv-single-section-page')==='1') return true;
    if(/page/.test(s)) return true;
    if(/📄|📃|🧾/.test(s) && /\b[1-4]\b/.test(s)) return true;
    if(/^\s*(📄|📃|🧾)?\s*[1-4]\s*$/.test(text(b)) && !isOn(b)) return true;
    return false;
  }
  function rowTitle(row){
    const c=row.cloneNode(true);
    try{c.querySelectorAll('button,[role="button"],input,textarea,select').forEach(n=>n.remove());}catch(_){}
    return clean(c.textContent||row.textContent||'');
  }
  function isEligibleSidebarSubsectionRow(row){
    if(!row || !row.querySelectorAll) return false;
    const bs=buttons(row);
    if(!bs.some(isOn) || !bs.some(isDelete)) return false;
    if(row.querySelector('input,textarea,select,[contenteditable="true"]')) return false;
    const t=(rowTitle(row)+' '+clean(row.textContent)).toLowerCase();
    if(/pdf|docx|preview|download/.test(t)) return false;
    const r=row.getBoundingClientRect ? row.getBoundingClientRect() : {width:300,height:20};
    // Sidebar rows are narrow. This avoids the export toolbar and preview header.
    if(r.width && r.width>760) return false;
    return true;
  }
  function findRows(){
    const rows=[];
    document.querySelectorAll('button').forEach(b=>{
      let p=b.parentElement;
      for(let d=0;p&&d<9;d++,p=p.parentElement){
        if(isEligibleSidebarSubsectionRow(p)){ if(!rows.includes(p)) rows.push(p); break; }
      }
    });
    return rows;
  }
  function parentFor(row){const on=buttons(row).find(isOn);return (on&&on.parentElement)||row;}
  function styleSmall(btn){
    Object.assign(btn.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:'24px',minWidth:'24px',height:'24px',minHeight:'24px',padding:'0',margin:'0 2px',border:'1px solid #01B7BB',borderRadius:'5px',background:'rgba(1,183,187,.08)',color:'#00746E',fontWeight:'700',fontSize:'12px',lineHeight:'1',cursor:'pointer'});
  }
  function convertToCompress(row,b){
    b.setAttribute('data-antcv-panel-action-211','comp');
    b.setAttribute('data-antcv-panel-action-208','comp');
    b.setAttribute('data-antcv-panel-label-211','↹');
    b.setAttribute('data-antcv-pub-comp-replacement','1');
    b.textContent='↹';
    b.title='Compress Publications & Patent';
    b.setAttribute('aria-label',b.title);
    styleSmall(b);
    if(!b.__antcv249CompClick){
      b.__antcv249CompClick=true;
      b.addEventListener('click',function(ev){
        const real=buttons(row).find(x=>x!==b&&isComp(x));
        if(real){ ev.preventDefault(); ev.stopPropagation(); real.click(); }
      },true);
    }
  }
  function ensurePubCompress(row){
    const bs=buttons(row);
    let comp=bs.find(isComp);
    if(comp){ styleSmall(comp); return; }
    let page=bs.find(isPage);
    if(page){ convertToCompress(row,page); return; }
    const donor=Array.from(document.querySelectorAll('button')).find(isComp);
    comp=donor?donor.cloneNode(true):document.createElement('button');
    convertToCompress(row,comp);
    const on=bs.find(isOn); const p=parentFor(row);
    if(on&&on.parentElement===p) p.insertBefore(comp,on); else p.appendChild(comp);
  }
  function removePageButtons(row){
    buttons(row).forEach(b=>{
      if(isPage(b)) { try{ b.remove(); }catch(_){ b.style.setProperty('display','none','important'); } }
    });
  }
  function run(){
    findRows().forEach(row=>{
      const title=rowTitle(row).toLowerCase();
      const pub=/publications?\s*&?\s*patent/.test(title);
      if(pub){
        buttons(row).filter(isPage).forEach(b=>convertToCompress(row,b));
        ensurePubCompress(row);
      } else {
        removePageButtons(row);
      }
    });
  }
  function start(){
    run(); [50,150,300,700,1200,2500,5000].forEach(ms=>setTimeout(run,ms));
    try{new MutationObserver(()=>setTimeout(run,0)).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','title','aria-label','data-antcv-panel-action-211','data-antcv-panel-action-208','data-antcv-single-section-page']});}catch(_){}
    window.addEventListener('click',()=>setTimeout(run,0),true);
    window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));
    setInterval(run,1500);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.AntcvSidebarSubsectionNoPage249={version:VERSION,run};
})();
