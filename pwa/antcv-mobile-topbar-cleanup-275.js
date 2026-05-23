/* AntCV mobile topbar cleanup (v1.40.275)
 * - Hides the floating mobile panel-escape X button. The UI already has Back/Preview controls.
 * - Removes/hides stray section controls that appear next to PDF/DOCX in the mobile export toolbar.
 *   Specifically targets Compress/Enhance/CJLR-style mini buttons in the export row only.
 */
(function(){
  'use strict';
  const VERSION='1.40.275';
  if(window.__antcvMobileTopbarCleanup275===VERSION) return;
  window.__antcvMobileTopbarCleanup275=VERSION;

  function txt(el){return String((el&&el.textContent)||'').replace(/\s+/g,' ').trim();}
  function meta(el){return (txt(el)+' '+String(el&&el.title||'')+' '+String(el&&el.getAttribute&&el.getAttribute('aria-label')||'')).toLowerCase();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function isExportButton(b){const t=meta(b);return /^pdf$/i.test(txt(b))||/^docx$/i.test(txt(b))||/\b(pdf|docx)\b/.test(t);}
  function isStrayExportControl(b){
    if(!b||isExportButton(b)) return false;
    const t=meta(b), s=txt(b);
    return /compress|enhance|enrich|cjlr|alignment/.test(t) || /^(✨|↹|⇥⇤|⇤⇥|↔|☰|⇤|⇥)$/.test(s);
  }
  function exportToolbarRoots(){
    const roots=[];
    Array.from(document.querySelectorAll('button,[role="button"],a')).filter(visible).forEach(function(b){
      if(!isExportButton(b)) return;
      let p=b.parentElement;
      for(let i=0;p&&p!==document.body&&i<6;i++,p=p.parentElement){
        const tx=meta(p);
        if(tx.indexOf('pdf')>=0&&tx.indexOf('docx')>=0){
          if(!roots.includes(p)) roots.push(p);
          break;
        }
      }
    });
    return roots;
  }
  function cleanupExportToolbar(){
    exportToolbarRoots().forEach(function(root){
      Array.from(root.querySelectorAll('button,[role="button"],a')).forEach(function(b){
        if(!isStrayExportControl(b)) return;
        b.setAttribute('data-antcv-mobile-export-hidden-275','1');
        b.style.display='none';
        b.style.visibility='hidden';
      });
    });
  }
  function hidePanelEscape(){
    const b=document.getElementById('antcv-panel-escape-btn');
    if(b){
      b.setAttribute('data-antcv-mobile-top-x-hidden-275','1');
      b.style.display='none';
      b.style.visibility='hidden';
      b.style.pointerEvents='none';
    }
  }
  function run(){try{hidePanelEscape();cleanupExportToolbar();}catch(e){try{console.warn('[mobile-topbar-cleanup-275]',e&&e.message);}catch(_){}}}
  function injectCss(){
    if(document.getElementById('antcv-mobile-topbar-cleanup-275-css')) return;
    const s=document.createElement('style');
    s.id='antcv-mobile-topbar-cleanup-275-css';
    s.textContent=`
      #antcv-panel-escape-btn,
      [data-antcv-mobile-top-x-hidden-275="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important;}
      [data-antcv-mobile-export-hidden-275="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important;}
      @media (max-width:900px), (pointer:coarse){
        #antcv-panel-escape-btn{display:none!important;visibility:hidden!important;pointer-events:none!important;}
      }
    `;
    (document.head||document.documentElement).appendChild(s);
  }
  let pending=false;
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;injectCss();run();});}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule,{once:true}); else schedule();
  [80,200,500,1000,2000,4000].forEach(ms=>setTimeout(schedule,ms));
  try{new MutationObserver(schedule).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','title','aria-label']});}catch(_){}
  window.addEventListener('click',function(){setTimeout(schedule,0);},true);
  window.addEventListener('antcv:sections-updated',schedule);
  window.AntcvMobileTopbarCleanup275={version:VERSION,run:schedule};
})();
