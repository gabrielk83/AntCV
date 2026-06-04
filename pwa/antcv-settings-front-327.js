/* AntCV settings front + application-history route hardener (v1.40.327)
 * Brings Settings above preview and forces Open in Settings -> Standard/Application history.
 */
(function(){
  'use strict';
  var VERSION='1.50.109-ah-front';
  if(window.__antcvSettingsFront327===VERSION) return;
  window.__antcvSettingsFront327=VERSION;
  function norm(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function shown(el){if(!el||el.nodeType!==1)return false;try{var cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return false;var r=el.getBoundingClientRect();return r.width>4&&r.height>4;}catch(_){return true;}}
  // v1.50.109 — broadened. The Application-history SUBTAB can render without the
  // STANDARD/ADVANCED tab strip in view, so the old "Settings + STANDARD +
  // ADVANCED" signature missed it and the panel stayed behind the preview. Also
  // accept a large panel that is clearly the AH subtab.
  function settingsRoots(){return Array.from(document.querySelectorAll('div,[role="dialog"],section,main')).filter(function(n){
    if(!shown(n))return false;
    var t=norm(n.textContent).slice(0,6000);
    if(/\bSettings\b/.test(t)&&/\bSTANDARD\b/i.test(t)&&/\bADVANCED\b/i.test(t))return true;
    try{var r=n.getBoundingClientRect();if(r.width>320&&r.height>320&&/application history/i.test(t)&&(/\bAPPLICATIONS\b/i.test(t)||/No applications saved yet/i.test(t)))return true;}catch(_){}
    return false;
  });}
  function isPreviewish(el){try{return !!(el&&el.classList&&(el.classList.contains('antcv-preview-paper')||el.classList.contains('antcv-preview-wrap')||el.classList.contains('antcv-preview-scroll')||el.classList.contains('antcv-preview-v-slider')));}catch(_){return false;}}
  // A leaf z-index of 2 billion does nothing if a positioned ANCESTOR sits in a
  // lower stacking layer than the preview's branch. Lift the whole ancestor
  // chain (excluding the preview's own nodes) so the panel actually escapes the
  // trap. Idempotent; on close React unmounts these nodes so nothing to revert.
  function liftAncestors(el){var n=el&&el.parentElement,d=0;while(n&&n.nodeType===1&&n!==document.body&&d<14){if(!isPreviewish(n)){try{var cs=getComputedStyle(n);if(cs.position&&cs.position!=='static'){n.style.setProperty('z-index','2147483000','important');}n.setAttribute('data-antcv-settings-front-anc-327','1');}catch(_){}}n=n.parentElement;d++;}}
  function bringFront(){settingsRoots().forEach(function(r){try{r.style.setProperty('z-index','2147483600','important');r.style.setProperty('position',getComputedStyle(r).position==='static'?'relative':getComputedStyle(r).position,'important');r.setAttribute('data-antcv-settings-front-327','1');liftAncestors(r);}catch(_){}});}
  function clickText(root,re){var b=Array.from((root||document).querySelectorAll('button,[role="button"],a')).find(function(x){return shown(x)&&re.test(norm(x.textContent));});if(b){try{b.click();return true;}catch(_){}}return false;}
  function forceAppHistory(){bringFront();var root=settingsRoots().sort(function(a,b){return norm(a.textContent).length-norm(b.textContent).length;})[0];if(!root)return false;clickText(root,/^STANDARD$/i);setTimeout(function(){var r=settingsRoots()[0]||root;bringFront();clickText(r,/^Application history$/i);},40);setTimeout(function(){var r=settingsRoots()[0]||root;bringFront();clickText(r,/^Application history$/i);},160);return true;}
  function openAppHistory(){try{localStorage.setItem('settingsTab','standard');localStorage.setItem('settingsSubTab','apps');localStorage.setItem('antcv:settings-route',JSON.stringify({tier:'standard',subtab:'apps',at:Date.now()}));}catch(_){}
    try{if(typeof window._antcvOpenSettingsRoute==='function')window._antcvOpenSettingsRoute({tier:'standard',subtab:'apps',source:'settings-front-327'});else if(typeof window._antcvOpenSettings==='function')window._antcvOpenSettings();}catch(e){try{console.warn('[settings-front-327] open failed',e&&e.message);}catch(_){}}
    [0,80,200,500,1000].forEach(function(ms){setTimeout(forceAppHistory,ms);});
  }
  document.addEventListener('click',function(ev){var t=ev.target&&ev.target.nodeType===1?ev.target:null;if(!t)return;var b=t.closest&&t.closest('button,[role="button"],a,div');if(!b)return;if(!/^Open in Settings\s*→?$/i.test(norm(b.textContent)))return;var n=b,ok=false;for(var i=0;i<9&&n;i++,n=n.parentElement){var tx=norm(n.textContent).slice(0,1500);if(/\bAPPLICATIONS\b/i.test(tx)||/No applications saved yet/i.test(tx)||/Application history/i.test(tx)){ok=true;break;}}if(!ok)return;try{ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation&&ev.stopImmediatePropagation();}catch(_){}openAppHistory();},true);
  // v1.40.327-throttle — LOOP FIX. bringFront WRITES style (z-index/position)
  // and this observer WATCHES style/class document-wide, so it fired ~60x/sec
  // reacting to its own writes and the whole sidecar herd's style churn (a top
  // contributor to the rAF-violation flood + preview bleep). Throttle the
  // scheduler to <=2/sec; reactivity is preserved, the per-frame storm is not.
  var _sfLast=0,_sfPend=false;
  function _sfNow(){return (window.performance&&performance.now)?performance.now():Date.now();}
  function scheduleBringFront(){if(_sfPend)return;_sfPend=true;var wait=Math.max(0,500-(_sfNow()-_sfLast));var fn=function(){_sfPend=false;_sfLast=_sfNow();requestAnimationFrame(bringFront);};if(wait>0)setTimeout(fn,wait);else fn();}
  try{new MutationObserver(scheduleBringFront).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});}catch(_){}
  [0,100,300,800,1600].forEach(function(ms){setTimeout(bringFront,ms);});
  window.AntcvOpenApplicationHistorySettings=openAppHistory;
})();
