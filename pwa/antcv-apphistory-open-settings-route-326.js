/* AntCV Application History -> Settings route fix (v1.40.326)
 * Ensures the dropdown's “Open in Settings” button routes directly to
 * Settings -> Standard -> Application history.
 */
(function(){
  'use strict';
  var VERSION='1.40.326';
  if(window.__antcvAppHistoryOpenSettingsRoute===VERSION) return;
  window.__antcvAppHistoryOpenSettingsRoute=VERSION;

  function norm(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function visible(el){
    if(!el||el.nodeType!==1) return false;
    try{var cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') return false; var r=el.getBoundingClientRect(); return r.width>2&&r.height>2;}catch(_){return true;}
  }
  function clickButtonByText(root, re){
    var btns=Array.from((root||document).querySelectorAll('button,[role="button"],a'));
    var b=btns.find(function(x){return visible(x)&&re.test(norm(x.textContent));});
    if(b){ try{b.click(); return true;}catch(_){} }
    return false;
  }
  function settingsRoot(){
    var nodes=Array.from(document.querySelectorAll('div,[role="dialog"],section,main'));
    var best=null;
    nodes.forEach(function(n){
      if(!visible(n)) return;
      var t=norm(n.textContent).slice(0,5000);
      if(/\bSettings\b/.test(t)&&/\bSTANDARD\b/i.test(t)&&/\bADVANCED\b/i.test(t)){
        if(!best||t.length<norm(best.textContent).length) best=n;
      }
    });
    return best;
  }
  function forceTab(){
    try{localStorage.setItem('settingsTab','standard'); localStorage.setItem('settingsSubTab','apps');}catch(_){}
    var root=settingsRoot();
    if(!root) return false;
    clickButtonByText(root,/^STANDARD$/i);
    setTimeout(function(){
      var r=settingsRoot()||root;
      clickButtonByText(r,/^Application history$/i);
    },30);
    setTimeout(function(){
      var r=settingsRoot()||root;
      clickButtonByText(r,/^Application history$/i);
    },120);
    return true;
  }
  function openRoute(){
    try{localStorage.setItem('settingsTab','standard'); localStorage.setItem('settingsSubTab','apps');}catch(_){}
    var ok=false;
    try{
      if(typeof window._antcvOpenSettingsRoute==='function'){
        window._antcvOpenSettingsRoute({tier:'standard',subtab:'apps',source:'app-history-dropdown-sidecar'});
        ok=true;
      }else if(typeof window._antcvOpenSettings==='function'){
        window._antcvOpenSettings();
        ok=true;
      }
    }catch(e){try{console.warn('[apphistory-route-326] route call failed', e&&e.message);}catch(_){}}
    [0,60,180,450,900].forEach(function(ms){setTimeout(forceTab,ms);});
    return ok;
  }
  document.addEventListener('click',function(ev){
    var target=ev.target&&ev.target.nodeType===1?ev.target:null;
    if(!target) return;
    var btn=target.closest&&target.closest('button,[role="button"],a,div');
    if(!btn) return;
    if(!/^Open in Settings\s*→?$/i.test(norm(btn.textContent))) return;
    var n=btn;
    var inApps=false;
    for(var i=0;i<8&&n;i++,n=n.parentElement){
      var t=norm(n.textContent).slice(0,1500);
      if(/\bAPPLICATIONS\b/i.test(t)||/No applications saved yet/i.test(t)||/Application history/i.test(t)){inApps=true;break;}
    }
    if(!inApps) return;
    try{ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();}catch(_){}
    openRoute();
  },true);
  window.AntcvOpenApplicationHistorySettings=openRoute;
})();
