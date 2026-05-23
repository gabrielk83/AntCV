/* AntCV settings front + application-history route hardener (v1.40.327)
 * Brings Settings above preview and forces Open in Settings -> Standard/Application history.
 */
(function(){
  'use strict';
  var VERSION='1.40.327';
  if(window.__antcvSettingsFront327===VERSION) return;
  window.__antcvSettingsFront327=VERSION;
  function norm(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function shown(el){if(!el||el.nodeType!==1)return false;try{var cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return false;var r=el.getBoundingClientRect();return r.width>4&&r.height>4;}catch(_){return true;}}
  function settingsRoots(){return Array.from(document.querySelectorAll('div,[role="dialog"],section,main')).filter(function(n){if(!shown(n))return false;var t=norm(n.textContent).slice(0,6000);return /\bSettings\b/.test(t)&&/\bSTANDARD\b/i.test(t)&&/\bADVANCED\b/i.test(t);});}
  function bringFront(){settingsRoots().forEach(function(r){try{r.style.setProperty('z-index','2147483600','important');r.style.setProperty('position',getComputedStyle(r).position==='static'?'relative':getComputedStyle(r).position,'important');r.setAttribute('data-antcv-settings-front-327','1');}catch(_){}});}
  function clickText(root,re){var b=Array.from((root||document).querySelectorAll('button,[role="button"],a')).find(function(x){return shown(x)&&re.test(norm(x.textContent));});if(b){try{b.click();return true;}catch(_){}}return false;}
  function forceAppHistory(){bringFront();var root=settingsRoots().sort(function(a,b){return norm(a.textContent).length-norm(b.textContent).length;})[0];if(!root)return false;clickText(root,/^STANDARD$/i);setTimeout(function(){var r=settingsRoots()[0]||root;bringFront();clickText(r,/^Application history$/i);},40);setTimeout(function(){var r=settingsRoots()[0]||root;bringFront();clickText(r,/^Application history$/i);},160);return true;}
  function openAppHistory(){try{localStorage.setItem('settingsTab','standard');localStorage.setItem('settingsSubTab','apps');localStorage.setItem('antcv:settings-route',JSON.stringify({tier:'standard',subtab:'apps',at:Date.now()}));}catch(_){}
    try{if(typeof window._antcvOpenSettingsRoute==='function')window._antcvOpenSettingsRoute({tier:'standard',subtab:'apps',source:'settings-front-327'});else if(typeof window._antcvOpenSettings==='function')window._antcvOpenSettings();}catch(e){try{console.warn('[settings-front-327] open failed',e&&e.message);}catch(_){}}
    [0,80,200,500,1000].forEach(function(ms){setTimeout(forceAppHistory,ms);});
  }
  document.addEventListener('click',function(ev){var t=ev.target&&ev.target.nodeType===1?ev.target:null;if(!t)return;var b=t.closest&&t.closest('button,[role="button"],a,div');if(!b)return;if(!/^Open in Settings\s*→?$/i.test(norm(b.textContent)))return;var n=b,ok=false;for(var i=0;i<9&&n;i++,n=n.parentElement){var tx=norm(n.textContent).slice(0,1500);if(/\bAPPLICATIONS\b/i.test(tx)||/No applications saved yet/i.test(tx)||/Application history/i.test(tx)){ok=true;break;}}if(!ok)return;try{ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation&&ev.stopImmediatePropagation();}catch(_){}openAppHistory();},true);
  try{new MutationObserver(function(){requestAnimationFrame(bringFront);}).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class']});}catch(_){}
  [0,100,300,800,1600].forEach(function(ms){setTimeout(bringFront,ms);});
  window.AntcvOpenApplicationHistorySettings=openAppHistory;
})();
