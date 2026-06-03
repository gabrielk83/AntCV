/* AntCV What I Bring CJLR cleanup (v1.40.246)
 * Removes the redundant first/left row CJLR buttons in What I Bring / Core Competencies.
 * Leaves the existing end-of-row CJLR buttons intact.
 */
(function(){
  'use strict';
  const VERSION='1.40.246';
  const CORE_RX=/what\s+i\s+bring|core\s+competenc/i;
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function candidateRows(){
    const out=[]; const seen=new Set();
    document.querySelectorAll('[data-antcv-core-row], tr, [data-antcv-row-path^="items."], [data-edit-path*="items."]').forEach(row=>{
      if(!visible(row)||seen.has(row)) return;
      const ctx=row.closest('[data-sid], section, main, form, div') || row.parentElement;
      if(!ctx || !CORE_RX.test(clean(ctx.textContent).slice(0,500))) return;
      seen.add(row); out.push(row);
    });
    return out;
  }
  function isHeader(row){
    const t=clean(row.textContent).toLowerCase();
    return /focus area/.test(t) && /strategic expertise/.test(t);
  }
  function removeRedundant(row){
    // These are the controls added by antcv-core-competencies-row-controls inside the row body.
    // The end-of-row CJLR uses the app's normal panel/action attributes and is not touched here.
    row.querySelectorAll('[data-antcv-core-cjlr], .antcv-core-cjlr').forEach(btn=>{
      const wrap=btn.closest('[data-antcv-core-controls="1"]');
      btn.remove();
      if(wrap && !wrap.querySelector('button')) wrap.remove();
    });
    if(isHeader(row)){
      row.querySelectorAll('[data-antcv-core-page],[data-antcv-core-roller],[data-antcv-core-up],[data-antcv-core-down]').forEach(x=>x.remove());
    }
  }
  function run(){try{candidateRows().forEach(removeRedundant);}catch(e){try{console.warn('[what-i-bring-cjlr-cleanup-246]',e&&e.message);}catch(_){}}}
  function start(){
    run(); [50,150,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));
    try{new MutationObserver(()=>setTimeout(run,0)).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-antcv-core-cjlr']});}catch(_){ }
    window.addEventListener('click',()=>setTimeout(run,0),true);
    window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvWhatIBringCjlrCleanup246={version:VERSION,run};
})();
