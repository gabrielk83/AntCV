/* AntCV embedded row controls guard (v1.40.248)
 * Keeps sidecar-added controls inside the row/section they belong to.
 * Covers recent controls:
 * - How I Would Contribute line and bullet controls
 * - Additional Information row CJLR and page controls
 * - What I Bring/Core row cleanup remnants
 *
 * Documentation attributes added:
 * - data-antcv-control-owner-section: human section name
 * - data-antcv-control-owner-role: row / line / bullet
 * - data-antcv-control-owner-index: row or bullet index when available
 */
(function(){
  'use strict';
  const VERSION='1.40.248';
  if(window.__antcvEmbeddedControlsGuard===VERSION) return;
  window.__antcvEmbeddedControlsGuard=VERSION;

  function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function low(s){return clean(s).toLowerCase();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function cssEscape(s){try{return CSS.escape(String(s));}catch(_){return String(s).replace(/["\\]/g,'\\$&');}}
  function setDoc(el, section, role, index){
    if(!el) return;
    el.setAttribute('data-antcv-control-owner-section', section);
    el.setAttribute('data-antcv-control-owner-role', role);
    if(index!==undefined && index!==null) el.setAttribute('data-antcv-control-owner-index', String(index));
    el.setAttribute('data-antcv-control-embedded', '1');
  }
  function styleButton(btn){
    if(!btn) return;
    btn.style.position='static';
    btn.style.float='none';
    btn.style.flex='0 0 auto';
    btn.style.zIndex='auto';
    btn.style.verticalAlign='middle';
  }
  function ensureHost(row, attr, beforeBtn){
    if(!row) return null;
    let host=row.querySelector(':scope ['+attr+'="1"]');
    if(!host){
      host=document.createElement('span');
      host.setAttribute(attr,'1');
      Object.assign(host.style,{display:'inline-flex',alignItems:'center',gap:'2px',whiteSpace:'nowrap',flex:'0 0 auto',position:'static',float:'none',verticalAlign:'middle',maxWidth:'100%'});
      if(beforeBtn&&beforeBtn.parentElement===row) row.insertBefore(host,beforeBtn);
      else row.appendChild(host);
    }
    host.style.position='static';
    host.style.float='none';
    host.style.zIndex='auto';
    return host;
  }
  function isDelete(btn){
    const t=low((btn&&btn.textContent)||''+' '+(btn&&btn.title||'')+' '+(btn&&btn.getAttribute&&btn.getAttribute('aria-label')||''));
    return t==='×'||t==='x'||t.includes('delete')||t.includes('remove');
  }

  function fixHowContribute(){
    const controls=Array.from(document.querySelectorAll('.antcv-hiwc-page,.antcv-hiwc-compress,.antcv-hiwc-enrich,.antcv-hiwc-cjlr,.antcv-hiwc-bullet-delete,[data-antcv-hiwc-page],[data-antcv-hiwc-compress],[data-antcv-hiwc-enrich],[data-antcv-hiwc-cjlr],[data-antcv-hiwc-bullet-delete]'));
    controls.forEach(btn=>{
      styleButton(btn);
      const bulletRow=btn.closest('[data-antcv-hiwc-bullet-row]');
      if(bulletRow){
        const idx=bulletRow.getAttribute('data-antcv-hiwc-bullet-index')||bulletRow.getAttribute('data-index')||'';
        const host=ensureHost(bulletRow,'data-antcv-hiwc-controls-host',null);
        if(btn.parentElement!==host) host.appendChild(btn);
        setDoc(btn,'How I Would Contribute','bullet',idx);
        setDoc(host,'How I Would Contribute','bullet',idx);
        bulletRow.style.position='relative';
        bulletRow.style.overflow='hidden';
        return;
      }
      const host=btn.closest('[data-antcv-hiwc-controls]');
      if(host){
        const row=host.parentElement;
        const text=low(row&&row.textContent||'');
        const role=text.includes('closing')?'closing':(text.includes('intro')?'intro':'line');
        setDoc(btn,'How I Would Contribute',role,'');
        setDoc(host,'How I Would Contribute',role,'');
        host.style.position='static';
        host.style.float='none';
      }
    });
  }

  function fixAdditionalInfo(){
    const rootCandidates=Array.from(document.querySelectorAll('div,section,main,form')).filter(el=>visible(el)&&/additional information/i.test(clean(el.textContent).slice(0,500))&&/\+\s*item/i.test(clean(el.textContent)));
    const root=rootCandidates.sort((a,b)=>a.textContent.length-b.textContent.length)[0]||null;
    if(!root) return;
    const rows=Array.from(root.querySelectorAll('[data-antcv-addinfo-row="1"]'));
    rows.forEach((row,i)=>{
      row.style.position='relative';
      row.style.overflow='hidden';
      row.style.maxWidth='100%';
      row.style.boxSizing='border-box';
      const del=Array.from(row.querySelectorAll(':scope button')).find(isDelete)||null;
      const host=ensureHost(row,'data-antcv-addinfo-controls-host',del&&del.parentElement===row?del:null);
      host.style.marginLeft='3px';
      Array.from(row.querySelectorAll(':scope [data-antcv-addinfo-control]')).forEach(btn=>{
        styleButton(btn);
        if(btn.parentElement!==host) host.appendChild(btn);
        setDoc(btn,'Additional Information','row',btn.getAttribute('data-antcv-addinfo-row-index')||i);
      });
      setDoc(host,'Additional Information','row',i);
    });
  }

  function fixCoreRows(){
    const rows=Array.from(document.querySelectorAll('[data-antcv-core-row], tr, [data-antcv-row-path^="items."], [data-edit-path*="items."]')).filter(row=>visible(row)&&/what\s+i\s+bring|core\s+competenc/i.test(low((row.closest('[data-sid]')||row.parentElement||row).textContent).slice(0,500)));
    rows.forEach((row,i)=>{
      row.style.position='relative';
      row.querySelectorAll('[data-antcv-core-controls="1"], [data-antcv-core-cjlr], .antcv-core-cjlr, [data-antcv-core-page]').forEach(el=>{
        styleButton(el);
        setDoc(el,'What I Bring','row',i);
      });
    });
  }

  function injectCss(){
    if(document.getElementById('antcv-embedded-controls-248-css')) return;
    const s=document.createElement('style');
    s.id='antcv-embedded-controls-248-css';
    s.textContent=`
      [data-antcv-control-embedded="1"]{position:static!important;float:none!important;z-index:auto!important;box-sizing:border-box!important;}
      [data-antcv-hiwc-bullet-row], [data-antcv-addinfo-row="1"]{contain:layout style!important;max-width:100%!important;}
      [data-antcv-hiwc-controls-host="1"], [data-antcv-addinfo-controls-host="1"], [data-antcv-hiwc-controls]{display:inline-flex!important;align-items:center!important;gap:2px!important;white-space:nowrap!important;flex:0 0 auto!important;position:static!important;float:none!important;z-index:auto!important;}
      [data-antcv-addinfo-row="1"] [data-antcv-addinfo-control],
      [data-antcv-hiwc-bullet-row] .antcv-hiwc-page,
      [data-antcv-hiwc-bullet-row] .antcv-hiwc-compress,
      [data-antcv-hiwc-bullet-row] .antcv-hiwc-enrich,
      [data-antcv-hiwc-bullet-row] .antcv-hiwc-cjlr,
      [data-antcv-hiwc-bullet-row] .antcv-hiwc-bullet-delete{position:static!important;float:none!important;flex:0 0 auto!important;}
    `;
    (document.head||document.documentElement).appendChild(s);
  }

  let pending=false;
  function run(){
    if(pending) return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      try{fixHowContribute();fixAdditionalInfo();fixCoreRows();}catch(e){try{console.warn('[embedded-controls-248]',e&&e.message);}catch(_){}}
    });
  }
  function start(){
    injectCss();
    run();
    [80,200,500,1000,1800,3000].forEach(ms=>setTimeout(run,ms));
    try{new MutationObserver(run).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','data-antcv-addinfo-row','data-antcv-hiwc-bullet-row']});}catch(_){ }
    window.addEventListener('click',()=>setTimeout(run,0),true);
    window.addEventListener('input',()=>setTimeout(run,0),true);
    window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.AntcvEmbeddedControlsGuard248={version:VERSION,run};
})();
