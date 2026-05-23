/* AntCV stability core (v1.40.334)
 * Consolidates the three remaining UI stability fixes without adding duplicate UI:
 * 1) Settings -> language selector is owned by Standard > Personal only.
 * 2) Application history "Open in Settings" routes to Standard > Application history and raises the modal above preview.
 * 3) Preview action placement is single-source: top actions on mobile, floating/FAB actions on desktop, never both.
 */
(function(){
  'use strict';
  var VERSION='1.40.334';
  if(window.__antcvStabilityCore===VERSION) return;
  window.__antcvStabilityCore=VERSION;

  var LANG_CARD_ID='antcv-stability-personal-languages';
  var LANG_OPEN_KEY='antcv:settings:languages-expanded';
  var LANGS=[
    {code:'en',label:'English'},
    {code:'da',label:'Danish'},
    {code:'es',label:'Spanish'},
    {code:'zh',label:'Chinese'}
  ];
  var DEFAULT_LANGS=['en'];
  var BREAKPOINT=760;

  function norm(v){ return String(v||'').replace(/[ \t\n\r]+/g,' ').trim(); }
  function low(v){ return norm(v).toLowerCase(); }
  function visible(el){
    if(!el||el.nodeType!==1) return false;
    try{
      var cs=getComputedStyle(el);
      if(cs.display==='none'||cs.visibility==='hidden'||parseFloat(cs.opacity||'1')===0) return false;
      var r=el.getBoundingClientRect();
      return r.width>3&&r.height>3;
    }catch(_){ return true; }
  }
  function activeish(el){
    if(!el) return false;
    try{
      if(el.getAttribute('aria-selected')==='true'||el.getAttribute('aria-pressed')==='true') return true;
      if(/active|selected|current/i.test(String(el.className||''))) return true;
      var cs=getComputedStyle(el);
      var s=[cs.backgroundColor,cs.borderColor,cs.color,cs.boxShadow].join(' ');
      return /rgb\(0, ?183, ?187\)|rgb\(1, ?183, ?187\)|rgb\(11, ?180, ?190\)|#00b7bb|#01b7bb|#0bb4be/i.test(s);
    }catch(_){ return false; }
  }
  function buttons(root){ return Array.from((root||document).querySelectorAll('button,[role="button"],a')); }
  function closestTextButton(target, re){
    var el=target&&target.nodeType===1?target.closest('button,[role="button"],a,div'):null;
    while(el&&el!==document.body){
      if(re.test(norm(el.textContent))) return el;
      el=el.parentElement;
    }
    return null;
  }
  function settingsRoot(){
    var best=null;
    Array.from(document.querySelectorAll('[role="dialog"],main,section,div')).forEach(function(el){
      if(!visible(el)) return;
      var t=norm(el.textContent).slice(0,12000);
      if(t.indexOf('Settings')>=0 && /STANDARD/i.test(t) && /ADVANCED/i.test(t)){
        if(!best || norm(el.textContent).length < norm(best.textContent).length) best=el;
      }
    });
    return best;
  }
  function activeButton(root,re){
    var all=buttons(root).filter(function(b){return re.test(norm(b.textContent));});
    return all.find(activeish)||null;
  }
  function tabState(root){
    var top=activeButton(root,/^(STANDARD|ADVANCED|ADMIN)$/i);
    var sub=activeButton(root,/^(Account|Personal|User|Layout|Application history|Sync|Adv\. Styles|Routing|API Keys|General|Demo|Users|Analytics)$/i);
    var t=top?low(top.textContent):'';
    var s=sub?low(sub.textContent):'';
    if(s==='user') s='personal';
    var body=norm(root.textContent).slice(0,16000);
    if(t==='standard' && (!s||s==='account') && /ADVANCED TONE/i.test(body) && /BANNED WORDS/i.test(body)) s='personal';
    if(t==='standard' && /SIGN IN/i.test(body) && /Sign in is required/i.test(body)) s=s||'account';
    return {top:t,sub:s};
  }
  function isPersonal(root){ var st=tabState(root); return st.top==='standard' && st.sub==='personal'; }
  function readJSON(key){ try{var raw=localStorage.getItem(key); return raw?JSON.parse(raw):null;}catch(_){return null;} }
  function validLangs(arr){
    var allowed=LANGS.map(function(l){return l.code;});
    arr=Array.isArray(arr)?arr:[];
    arr=arr.map(function(x){return String(x||'').trim().toLowerCase();}).filter(function(x){return allowed.indexOf(x)>=0;});
    arr=Array.from(new Set(arr));
    return arr.length?arr:DEFAULT_LANGS.slice();
  }
  function enabledLangs(){
    var prefs=readJSON('antcv:prefs')||{};
    var pi=readJSON('personalInfo')||{};
    var sp=pi.stylePrefs||{};
    return validLangs(readJSON('enabledLanguages')||readJSON('antcv:enabledLanguages')||prefs.enabledLanguages||sp.visibleLanguages||sp.enabledLanguages);
  }
  function writeLangs(arr){
    var next=validLangs(arr);
    var raw=JSON.stringify(next);
    try{localStorage.setItem('enabledLanguages',raw);}catch(_){}
    try{localStorage.setItem('antcv:enabledLanguages',raw);}catch(_){}
    try{localStorage.setItem('antcv:visibleLanguages',raw);}catch(_){}
    try{var p=readJSON('antcv:prefs')||{}; p.enabledLanguages=next; p.visibleLanguages=next; localStorage.setItem('antcv:prefs',JSON.stringify(p));}catch(_){}
    try{var pi=readJSON('personalInfo')||{}; pi.stylePrefs=pi.stylePrefs||{}; pi.stylePrefs.visibleLanguages=next; pi.stylePrefs.enabledLanguages=next; pi.stylePrefs.languageBar=next; localStorage.setItem('personalInfo',JSON.stringify(pi));}catch(_){}
    try{if(window.AntcvLanguagePrefsDefaults&&typeof window.AntcvLanguagePrefsDefaults.save==='function')window.AntcvLanguagePrefsDefaults.save(next);}catch(_){}
    try{if(window.AntcvLanguagePrefs&&typeof window.AntcvLanguagePrefs.set==='function')window.AntcvLanguagePrefs.set(next);}catch(_){}
    try{window.dispatchEvent(new StorageEvent('storage',{key:'enabledLanguages',newValue:raw}));}catch(_){}
    try{window.dispatchEvent(new CustomEvent('antcv:enabled-languages-changed',{detail:{enabledLanguages:next,visibleLanguages:next,scope:'topbar-only'}}));}catch(_){}
    try{window.dispatchEvent(new CustomEvent('antcv:language-prefs-changed',{detail:{enabledLanguages:next,visibleLanguages:next,scope:'topbar-only'}}));}catch(_){}
    try{if(window.AntcvLangBarFilter&&window.AntcvLangBarFilter._applyAll)window.AntcvLangBarFilter._applyAll();}catch(_){}
    return next;
  }
  function langExpanded(){try{var v=localStorage.getItem(LANG_OPEN_KEY);return v===null?false:v==='1'||v==='true'}catch(_){return false}}
  function setLangExpanded(v){try{localStorage.setItem(LANG_OPEN_KEY,v?'1':'0')}catch(_){}}
  function languageBlockHeads(root){
    return Array.from(root.querySelectorAll('*')).filter(function(el){
      var t=norm(el.textContent).slice(0,500);
      return /^LANGUAGES IN THE TOP BAR/i.test(t) || /^Languages in the top bar/i.test(t);
    });
  }
  function blockRoot(el,root){
    var n=el,best=el;
    for(var i=0;i<8 && n && n.parentElement && n!==root && n!==document.body;i++){
      n=n.parentElement;
      var t=norm(n.textContent).slice(0,1800);
      if(/LANGUAGES IN THE TOP BAR/i.test(t)) best=n;
      try{
        var r=n.getBoundingClientRect();
        if(r.width>180 && r.height>24 && r.height<850) best=n;
      }catch(_){}
      if(n.querySelectorAll && n.querySelectorAll('input,select,textarea,button').length>18) break;
    }
    return best;
  }
  function hideAllLanguageBlocks(root){
    var own=document.getElementById(LANG_CARD_ID);
    languageBlockHeads(root).forEach(function(h){
      if(own && own.contains(h)) return;
      var c=blockRoot(h,root);
      if(c===own) return;
      c.setAttribute('data-antcv-hidden-language-stray','1');
      c.style.setProperty('display','none','important');
      c.style.setProperty('visibility','hidden','important');
      c.style.setProperty('height','0','important');
      c.style.setProperty('margin','0','important');
      c.style.setProperty('padding','0','important');
      c.style.setProperty('overflow','hidden','important');
    });
  }
  function makeLanguageCard(){
    var card=document.createElement('section');
    card.id=LANG_CARD_ID;
    card.setAttribute('data-antcv-language-card','standard-personal-only');
    card.style.cssText='margin-top:16px;border-top:1px dashed rgba(255,255,255,.14);padding-top:10px;color:#d7e6ee;';
    card.innerHTML='<button type="button" data-lang-toggle style="width:100%;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;background:transparent;border:0;color:#d7e6ee;cursor:pointer;text-align:left;text-transform:uppercase;letter-spacing:.08em;font-weight:800"><span><span data-lang-chevron>▾</span> Languages in the top bar</span></button><div data-lang-body><div style="font-size:12px;opacity:.78;margin:6px 0 10px">Choose which language buttons are available in the top bar. This does not start translation.</div><div data-lang-options style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px"></div></div>';
    return card;
  }
  function renderLanguageCard(card){
    var open=langExpanded();
    var body=card.querySelector('[data-lang-body]');
    var chev=card.querySelector('[data-lang-chevron]');
    var toggle=card.querySelector('[data-lang-toggle]');
    if(body)body.style.display=open?'block':'none';
    if(chev)chev.textContent=open?'▾':'▸';
    if(toggle)toggle.setAttribute('aria-expanded',open?'true':'false');
    var cur=enabledLangs();
    var box=card.querySelector('[data-lang-options]');
    if(!box) return;
    box.innerHTML='';
    LANGS.forEach(function(l){
      var label=document.createElement('label');
      label.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid rgba(1,183,187,.35);border-radius:8px;background:rgba(1,183,187,.06);cursor:pointer;';
      var input=document.createElement('input');
      input.type='checkbox';
      input.setAttribute('data-lang',l.code);
      input.checked=cur.indexOf(l.code)>=0;
      input.style.accentColor='#01B7BB';
      var span=document.createElement('span');
      span.textContent=l.label;
      span.style.fontWeight='650';
      label.appendChild(input); label.appendChild(span); box.appendChild(label);
    });
  }
  function insertTarget(root){
    var done=buttons(root).filter(function(b){return /^Done$/i.test(norm(b.textContent));}).pop();
    if(done){
      var n=done;
      for(var i=0;i<5 && n.parentElement && n.parentElement!==root;i++){
        n=n.parentElement;
        try{var r=n.getBoundingClientRect(); if(r.width>200 && r.height<180) break;}catch(_){}
      }
      return {parent:n.parentElement||root,before:n};
    }
    return {parent:root,before:null};
  }
  function ensureLanguageCard(root){
    var card=document.getElementById(LANG_CARD_ID)||makeLanguageCard();
    renderLanguageCard(card);
    var t=insertTarget(root);
    try{t.parent.insertBefore(card,t.before);}catch(_){root.appendChild(card);}
    card.style.removeProperty('display');
    card.style.removeProperty('visibility');
    card.style.removeProperty('height');
    card.style.removeProperty('margin');
    card.style.removeProperty('padding');
    card.style.removeProperty('overflow');
  }
  function routeSettings(mod,sub){
    try{sessionStorage.setItem('antcv:settings-route',JSON.stringify({mode:mod,subtab:sub,ts:Date.now()}));}catch(_){}
    try{localStorage.setItem('settingsTab',mod==='advanced'?'advanced':'standard');}catch(_){}
    try{localStorage.setItem('settingsSubTab',sub);}catch(_){}
  }
  function nonSettingsModalOpen(){
    var sel='.antcv-import-backdrop,.antcv-ai-notice-host,[data-antcv-ai-disclosure],[data-antcv-modal="ai-disclosure"],[data-antcv-portal-modal]';
    var nodes;
    try{nodes=document.querySelectorAll(sel);}catch(_){return false;}
    for(var i=0;i<nodes.length;i++){ if(visible(nodes[i])) return true; }
    return false;
  }
  function raiseSettings(root){
    if(!root) return;
    if(nonSettingsModalOpen()) return;
    var n=root;
    for(var i=0;i<8 && n && n!==document.body;i++,n=n.parentElement){
      try{
        n.style.setProperty('z-index','2147483200','important');
        if(getComputedStyle(n).position==='static') n.style.setProperty('position','relative','important');
      }catch(_){}
    }
  }
  function clickByText(root,re){
    var b=buttons(root).find(function(x){return visible(x)&&re.test(norm(x.textContent));});
    if(b){try{b.click();return true;}catch(_){} }
    return false;
  }
  function forceRoute(){
    var route=null;
    try{route=JSON.parse(sessionStorage.getItem('antcv:settings-route')||'null');}catch(_){}
    if(!route || Date.now()-Number(route.ts||0)>2000) return;
    var root=settingsRoot();
    if(!root) return;
    raiseSettings(root);
    if(route.mode==='advanced') clickByText(root,/^ADVANCED$/i); else clickByText(root,/^STANDARD$/i);
    setTimeout(function(){
      var r=settingsRoot()||root;
      raiseSettings(r);
      if(route.subtab==='application-history') clickByText(r,/^Application history$/i);
      else if(route.subtab==='personal') clickByText(r,/^(Personal|User)$/i);
      else if(route.subtab==='account') clickByText(r,/^Account$/i);
      else if(route.subtab==='sync') clickByText(r,/^Sync$/i);
    },40);
  }
  function openAppHistorySettings(){
    routeSettings('standard','application-history');
    try{
      if(typeof window._antcvOpenSettingsRoute==='function') window._antcvOpenSettingsRoute({tier:'standard',subtab:'application-history',source:'stability-core'});
      else if(typeof window._antcvOpenSettings==='function') window._antcvOpenSettings();
    }catch(e){try{console.warn('[stability-core] open settings failed',e&&e.message);}catch(_){} }
    [0,60,140,300,700,1200].forEach(function(ms){setTimeout(forceRoute,ms);});
  }
  function isMobile(){try{return window.matchMedia('(max-width:'+BREAKPOINT+'px)').matches;}catch(_){return innerWidth<=BREAKPOINT;}}
  function lab(el){return String((el&&((el.getAttribute('aria-label')||'')+' '+(el.getAttribute('title')||'')+' '+(el.textContent||'')))||'');}
  function isActionFab(el){return !!(el&&el.matches&&el.matches('button.antcv-fab')&&(/Analyze JD|JD analysis|Fusion CL|Fuse|Privacy/i.test(lab(el))||el.getAttribute('data-antcv-privacy-led-fab')==='1'||el.getAttribute('data-antcv-recheck-fab')==='1'));}
  function jdFab(){return Array.from(document.querySelectorAll('button.antcv-fab,button')).find(function(b){return !b.closest('.antcv-preview-core-actions') && /Analyze JD|JD analysis/i.test(lab(b));});}
  function applyPreviewActions(){
    var mobile=isMobile();
    var core=document.querySelector('.antcv-preview-core-actions');
    if(core){
      if(mobile){core.style.setProperty('display','flex','important');core.style.removeProperty('visibility');core.style.removeProperty('pointer-events');}
      else{core.style.setProperty('display','none','important');core.style.setProperty('visibility','hidden','important');core.style.setProperty('pointer-events','none','important');}
    }
    var seen={};
    Array.from(document.querySelectorAll('button.antcv-fab')).forEach(function(b){
      if(!isActionFab(b)) return;
      var key=/privacy/i.test(lab(b))?'privacy':/fuse|fusion/i.test(lab(b))?'fuse':'jd';
      var keep=!seen[key]; seen[key]=true;
      if(mobile || !keep){
        b.style.setProperty('display','none','important');
        b.style.setProperty('visibility','hidden','important');
        b.style.setProperty('pointer-events','none','important');
      }else{
        b.style.removeProperty('display'); b.style.removeProperty('visibility'); b.style.removeProperty('pointer-events'); b.style.removeProperty('opacity');
      }
    });
  }
  function applySettings(){
    var root=settingsRoot();
    if(!root) return;
    raiseSettings(root);
    buttons(root).forEach(function(b){ if(norm(b.textContent)==='User') b.textContent='Personal'; });
    hideAllLanguageBlocks(root);
    if(isPersonal(root)) ensureLanguageCard(root);
    else {
      var card=document.getElementById(LANG_CARD_ID);
      if(card){ card.style.setProperty('display','none','important'); card.style.setProperty('visibility','hidden','important'); }
    }
  }
  function applyAll(){ applySettings(); forceRoute(); applyPreviewActions(); }
  function onLangChange(ev){
    var card=document.getElementById(LANG_CARD_ID);
    if(!card || !card.contains(ev.target)) return;
    var inp=ev.target.closest&&ev.target.closest('input[data-lang]');
    if(!inp) return;
    try{ev.stopPropagation();}catch(_){}
    var code=inp.getAttribute('data-lang');
    var cur=enabledLangs();
    var on=cur.indexOf(code)>=0;
    var next=on?(cur.length<=1?cur.slice():cur.filter(function(x){return x!==code;})):cur.concat([code]);
    writeLangs(next);
    renderLanguageCard(card);
  }
  document.addEventListener('change',onLangChange,true);
  document.addEventListener('click',function(ev){
    var target=ev.target&&ev.target.nodeType===1?ev.target:null;
    if(!target) return;
    var langToggle=target.closest&&target.closest('#'+LANG_CARD_ID+' [data-lang-toggle]');
    if(langToggle){try{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}catch(_){} var card=document.getElementById(LANG_CARD_ID); setLangExpanded(!langExpanded()); if(card)renderLanguageCard(card); return false;}
    var openBtn=closestTextButton(target,/^Open in Settings\s*→?$/i);
    if(openBtn){
      var n=openBtn,inApps=false;
      for(var i=0;i<8&&n;i++,n=n.parentElement){
        var t=norm(n.textContent).slice(0,1800);
        if(/APPLICATIONS/i.test(t)||/No applications saved yet/i.test(t)||/Application history/i.test(t)){inApps=true;break;}
      }
      if(inApps){try{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}catch(_){} openAppHistorySettings(); return false;}
    }
    var coreJd=target.closest&&target.closest('.antcv-preview-core-actions button');
    if(coreJd && /JD Analysis/i.test(lab(coreJd))){
      var fab=jdFab();
      if(fab){try{ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();}catch(_){} fab.click(); return false;}
    }
    setTimeout(applyAll,0); setTimeout(applyAll,80); setTimeout(applyAll,250);
  },true);
  try{new MutationObserver(function(){requestAnimationFrame(applyAll);}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class','aria-selected','aria-pressed','title','aria-label']});}catch(_){}
  window.addEventListener('resize',applyPreviewActions,{passive:true});
  [0,50,150,350,800,1500,3000,6000].forEach(function(t){setTimeout(applyAll,t);});
  window.AntcvStabilityCore={version:VERSION,apply:applyAll,openApplicationHistorySettings:openAppHistorySettings,enabledLanguages:enabledLangs,setEnabledLanguages:writeLangs};
})();
