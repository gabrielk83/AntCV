/* AntCV Settings language block strict scope (v1.40.321)
 * Keep “Languages in the top bar” only at the END of Standard -> Personal.
 * Hide every duplicate/top insertion in Account/Layout/Application history/Advanced/Admin,
 * and hide the top duplicate when returning to Personal.
 * Checkboxes only select which top-bar language buttons are supported.
 */
(function(){
  'use strict';
  if (window.__antcvSettingsLanguagePersonalOnly === '1.40.321') return;
  window.__antcvSettingsLanguagePersonalOnly = '1.40.321';

  var LANGS=['en','da','es','zh'];
  var DEFAULT=['en'];
  var TOKENS={en:['english','engelsk','en'],da:['danish','dansk','da'],es:['spanish','spansk','español','espanol','es'],zh:['chinese','kinesisk','中文','简体','繁體','zh']};
  var syncing=false;

  function norm(x){return String(x||'').replace(/\s+/g,' ').trim();}
  function low(x){return norm(x).toLowerCase();}
  function shown(el){if(!el||el.nodeType!==1)return false;try{var cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return false;var r=el.getBoundingClientRect();return r.width>2&&r.height>2;}catch(_){return true;}}
  function settingsRoot(){
    var best=null;
    Array.from(document.querySelectorAll('[role="dialog"],div')).forEach(function(el){
      if(!shown(el))return;
      var t=norm(el.textContent).slice(0,9000);
      if(/\bSettings\b/.test(t)&&/\bSTANDARD\b/i.test(t)&&/\bADVANCED\b/i.test(t)){
        if(!best||norm(el.textContent).length<norm(best.textContent).length)best=el;
      }
    });
    return best;
  }
  function activeish(el){try{if(el.getAttribute('aria-selected')==='true'||el.getAttribute('aria-pressed')==='true')return true;if(/active|selected|current/i.test(String(el.className||'')))return true;var cs=getComputedStyle(el);var s=[cs.backgroundColor,cs.borderColor,cs.color,cs.boxShadow].join(' ');return /rgb\(0,\s*183,\s*187\)|rgb\(1,\s*183,\s*187\)|rgb\(11,\s*180,\s*190\)|#00b7bb|#01b7bb|#0bb4be/i.test(s);}catch(_){return false;}}
  function activeButton(root,re){return Array.from(root.querySelectorAll('button,[role="button"],a')).filter(function(b){return re.test(norm(b.textContent));}).find(activeish)||null;}
  function activeTabs(root){var top=activeButton(root,/^(STANDARD|ADVANCED|ADMIN)$/i);var sub=activeButton(root,/^(Account|Personal|User|Layout|Application history|Sync|Adv\. Styles|Routing|API Keys|General|Demo|Users|Analytics)$/i);return{top:top?low(top.textContent):'',sub:sub?(low(sub.textContent)==='user'?'personal':low(sub.textContent)):''};}
  function renameUser(root){Array.from(root.querySelectorAll('button,[role="button"],a')).forEach(function(b){if(norm(b.textContent)==='User')b.textContent='Personal';if(b.getAttribute('aria-label')==='User')b.setAttribute('aria-label','Personal');if(b.title==='User')b.title='Personal';});}
  function isHeader(el){return /^LANGUAGES IN THE TOP BAR\b/i.test(norm(el.textContent).slice(0,500));}
  function nearestCard(el,root){
    var n=el,best=el;
    for(var i=0;i<10&&n&&n.parentElement&&n!==root&&n!==document.body;i++){
      n=n.parentElement;
      var t=norm(n.textContent).slice(0,1800);
      if(/LANGUAGES IN THE TOP BAR/i.test(t))best=n;
      try{var r=n.getBoundingClientRect();if(r.width>180&&r.height>18&&r.height<620)best=n;}catch(_){best=n;}
      if(n.querySelectorAll&&n.querySelectorAll('input,select,textarea,button').length>16)break;
    }
    return best;
  }
  function cards(root){
    var seen=new Set(),out=[];
    Array.from(root.querySelectorAll('*')).forEach(function(el){
      if(!isHeader(el))return;
      var c=nearestCard(el,root);
      if(seen.has(c))return;seen.add(c);out.push(c);
    });
    return out;
  }
  function topOf(el){try{return el.getBoundingClientRect().top;}catch(_){return 0;}}
  function personalMarkerTops(root){
    return Array.from(root.querySelectorAll('*')).filter(function(el){return /^(ADVANCED TONE|BANNED WORDS)\b/i.test(norm(el.textContent).slice(0,80));}).map(topOf).filter(function(x){return isFinite(x);});
  }
  function hide(n){if(!n||n===document.body)return;n.setAttribute('data-antcv-lang-hidden','1');n.style.setProperty('display','none','important');n.style.setProperty('visibility','hidden','important');}
  function show(n){if(!n)return;n.setAttribute('data-antcv-lang-keep','1');n.style.removeProperty('display');n.style.removeProperty('visibility');}
  function chooseKeep(root,cs){
    var tabs=activeTabs(root);
    if(!(tabs.top==='standard'&&tabs.sub==='personal'))return null;
    var markers=personalMarkerTops(root);
    if(!markers.length)return null;
    var minMarker=Math.min.apply(Math,markers);
    var after=cs.filter(function(c){return topOf(c)>minMarker+4;});
    if(!after.length)return null;
    return after.sort(function(a,b){return topOf(b)-topOf(a);})[0];
  }
  function valid(arr){arr=(Array.isArray(arr)?arr:[]).map(function(x){return String(x||'').trim().toLowerCase();}).filter(function(x){return LANGS.indexOf(x)>=0;});arr=Array.from(new Set(arr));return arr.length?arr:DEFAULT.slice();}
  function read(k){try{var v=localStorage.getItem(k);return v?JSON.parse(v):null;}catch(_){return null;}}
  function enabled(){return valid(read('enabledLanguages')||read('antcv:enabledLanguages')||((read('antcv:prefs')||{}).enabledLanguages));}
  function write(arr){var e=valid(arr),raw=JSON.stringify(e);try{localStorage.setItem('enabledLanguages',raw);}catch(_){}try{localStorage.setItem('antcv:enabledLanguages',raw);}catch(_){}try{var p=read('antcv:prefs')||{};p.enabledLanguages=e;localStorage.setItem('antcv:prefs',JSON.stringify(p));}catch(_){}try{window.dispatchEvent(new CustomEvent('antcv:enabled-languages-changed',{detail:{enabledLanguages:e,scope:'topbar-only'}}));}catch(_){}return e;}
  function codeFromText(text){text=low(text);var hits=[];LANGS.forEach(function(code){if(TOKENS[code].some(function(tok){tok=String(tok).toLowerCase();return /^[a-z]{2}$/.test(tok)?new RegExp('(^|[^a-z])'+tok+'([^a-z]|$)','i').test(text):text.indexOf(tok)>=0;}))hits.push(code);});return hits.length===1?hits[0]:null;}
  function ownText(el){var c=el.cloneNode(true);try{Array.from(c.querySelectorAll('input,button,select,svg,path')).forEach(function(n){n.remove();});}catch(_){}return norm(c.textContent);}
  function codeFor(el){if(!el||el.nodeType!==1)return null;var d=(el.dataset&&(el.dataset.lang||el.dataset.language))||el.getAttribute('data-lang')||el.getAttribute('data-language');if(d&&LANGS.indexOf(String(d).toLowerCase())>=0)return String(d).toLowerCase();var c=codeFromText([el.getAttribute('aria-label'),el.title,el.name,el.value,el.id].filter(Boolean).join(' '));if(c)return c;if(el.id){try{var lab=document.querySelector('label[for="'+CSS.escape(el.id)+'"]');c=lab&&codeFromText(ownText(lab));if(c)return c;}catch(_){}}if(el.labels&&el.labels.length){for(var i=0;i<el.labels.length;i++){c=codeFromText(ownText(el.labels[i]));if(c)return c;}}var label=el.closest&&el.closest('label');if(label){c=codeFromText(ownText(label));if(c)return c;}var row=el.closest&&el.closest('button,[role="checkbox"],[data-lang],[data-language],li,div');if(row){c=codeFromText(ownText(row));if(c)return c;}return null;}
  function controls(card){if(!card)return[];var out=[],seen=new Set();Array.from(card.querySelectorAll('input[type="checkbox"],input[type="radio"],[role="checkbox"],[data-lang],[data-language],label,button')).forEach(function(el){var code=codeFor(el);if(!code)return;var key=code+':'+(el.id||el.name||norm(el.textContent)||out.length);if(seen.has(key))return;seen.add(key);out.push({el:el,code:code});});return out;}
  function setChecked(el,on){try{if(el.matches&&el.matches('input[type="checkbox"],input[type="radio"]')){el.checked=!!on;on?el.setAttribute('checked','checked'):el.removeAttribute('checked');}else{el.setAttribute('aria-checked',on?'true':'false');el.dataset.antcvChecked=on?'1':'0';var inp=el.querySelector&&el.querySelector('input[type="checkbox"],input[type="radio"]');if(inp)setChecked(inp,on);}}catch(_){}}
  function sync(card){var e=enabled();controls(card).forEach(function(x){setChecked(x.el,e.indexOf(x.code)>=0);});}
  function apply(){
    var root=settingsRoot();if(!root)return;
    renameUser(root);
    var cs=cards(root);
    if(!cs.length)return;
    var keep=chooseKeep(root,cs);
    cs.forEach(function(c){c.setAttribute('data-antcv-lang-topbar-card','1');c===keep?show(c):hide(c);});
    // Belt and braces: hide any orphan direct header not inside the kept lower card.
    Array.from(root.querySelectorAll('*')).forEach(function(el){if(!isHeader(el))return;if(keep&&keep.contains(el))return;hide(el);if(el.parentElement&&el.parentElement!==root)hide(el.parentElement);});
    if(keep)sync(keep);
  }
  function langClick(e){
    if(syncing)return;var root=settingsRoot();if(!root)return;var keep=chooseKeep(root,cards(root));if(!keep||!keep.contains(e.target))return;
    var ctl=e.target.closest&&e.target.closest('input[type="checkbox"],input[type="radio"],[role="checkbox"],[data-lang],[data-language],label,button');if(!ctl||!keep.contains(ctl))return;
    var code=codeFor(ctl);if(!code)return;
    try{e.preventDefault();e.stopPropagation();e.stopImmediatePropagation&&e.stopImmediatePropagation();}catch(_){}
    var cur=enabled(),on=cur.indexOf(code)>=0,next;if(on&&cur.length<=1)next=cur.slice();else if(on)next=cur.filter(function(x){return x!==code;});else next=cur.concat([code]);next=write(next);
    syncing=true;try{controls(keep).forEach(function(x){setChecked(x.el,next.indexOf(x.code)>=0);});}finally{syncing=false;}
    [40,160,600].forEach(function(ms){setTimeout(apply,ms);});return false;
  }
  document.addEventListener('click',function(){setTimeout(apply,0);setTimeout(apply,80);setTimeout(apply,250);},true);
  document.addEventListener('click',langClick,true);document.addEventListener('change',langClick,true);
  try{new MutationObserver(function(){requestAnimationFrame(apply);}).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['style','class','checked','aria-checked','aria-selected','aria-pressed']});}catch(_){}
  [0,50,150,300,700,1200,2500,5000].forEach(function(t){setTimeout(apply,t);});
  window.AntcvSettingsLanguagePersonalOnly={version:'1.40.321',apply:apply,enabled:enabled,write:write};
})();
