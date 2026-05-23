/* AntCV preview action responsive placement (v1.40.325)
 * Desktop/PC: legacy bottom/right FABs are canonical; hide the top React aux buttons.
 * Mobile/tablet narrow: top React aux buttons are canonical; hide bottom/right FABs.
 * This prevents duplicate JD/Fuse/Privacy controls while preserving PDF/DOCX.
 */
(function(){
  'use strict';
  if(window.__antcvPreviewActionsSingleton==='1.40.325')return;
  window.__antcvPreviewActionsSingleton='1.40.325';
  var BREAKPOINT=760;
  function isMobile(){try{return window.matchMedia('(max-width:'+BREAKPOINT+'px)').matches}catch(_){return innerWidth<=BREAKPOINT}}
  function label(b){return String((b&&(b.getAttribute('aria-label')||'')+' '+(b.getAttribute('title')||'')+' '+(b.textContent||''))||'')}
  function isActionFab(b){return b&&b.matches&&b.matches('button.antcv-fab')&&(/Analyze JD|JD analysis|Fusion CL|Fuse|Privacy status|Privacy/i.test(label(b))||b.getAttribute('data-antcv-privacy-led-fab')==='1'||b.getAttribute('data-antcv-recheck-fab')==='1')}
  function inject(){
    var old=document.getElementById('antcv-preview-actions-singleton-style'); if(old) old.remove();
    var s=document.createElement('style');s.id='antcv-preview-actions-singleton-style';
    s.textContent='@media (min-width:761px){.antcv-preview-core-actions{display:none!important;visibility:hidden!important;pointer-events:none!important}}'+
      '@media (max-width:760px){body:has(.antcv-preview-core-actions) button.antcv-fab[aria-label="Analyze JD"],body:has(.antcv-preview-core-actions) button.antcv-fab[aria-label="JD analysis"],body:has(.antcv-preview-core-actions) button.antcv-fab[aria-label="Fusion CL to CV"],body:has(.antcv-preview-core-actions) button.antcv-fab[data-antcv-privacy-led-fab="1"],body:has(.antcv-preview-core-actions) button.antcv-fab[data-antcv-recheck-fab="1"]{display:none!important;visibility:hidden!important;pointer-events:none!important}.antcv-preview-core-actions{display:flex!important}}';
    document.head.appendChild(s);
  }
  function apply(){
    var mobile=isMobile();
    var core=document.querySelector('.antcv-preview-core-actions');
    if(core){
      if(mobile){core.style.setProperty('display','flex','important');core.style.removeProperty('visibility');core.style.removeProperty('pointer-events')}
      else{core.style.setProperty('display','none','important');core.style.setProperty('visibility','hidden','important');core.style.setProperty('pointer-events','none','important')}
    }
    Array.from(document.querySelectorAll('button.antcv-fab')).forEach(function(b){
      if(!isActionFab(b))return;
      if(mobile){b.style.setProperty('display','none','important');b.style.setProperty('visibility','hidden','important');b.style.setProperty('pointer-events','none','important')}
      else{b.style.removeProperty('display');b.style.removeProperty('visibility');b.style.removeProperty('pointer-events');b.style.removeProperty('opacity')}
    });
  }
  inject();
  try{new MutationObserver(function(){requestAnimationFrame(apply)}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','aria-label','title']})}catch(_){}
  window.addEventListener('resize',apply,{passive:true});
  document.addEventListener('click',function(){setTimeout(apply,0);setTimeout(apply,100);setTimeout(apply,300)},true);
  [0,80,200,500,1000,2000,4000].forEach(function(t){setTimeout(apply,t)});
  window.AntcvPreviewActionsSingleton={version:'1.40.325',apply:apply};
})();
