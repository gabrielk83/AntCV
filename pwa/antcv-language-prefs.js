/* AntCV language prefs, React-scoped fallback (v1.40.323)
 * One selector only: Settings -> Standard -> Personal, lower/end of tab.
 * Controls top-bar visibility only. Does not start translation.
 */
(function(){
  'use strict';
  const VERSION='1.40.323';
  if(window.__antcvLanguagePrefsInstalled===VERSION)return;
  window.__antcvLanguagePrefsInstalled=VERSION;
  const OPTIONS=[
    {code:'en',label:'EN',name:'English'},
    {code:'da',label:'DA',name:'Dansk'},
    {code:'es',label:'ES',name:'Español'},
    {code:'zh',label:'中文',name:'中文'}
  ];
  const CODES=OPTIONS.map(o=>o.code), DEFAULT=['en','da'];
  function norm(x){return String(x||'').replace(/[ \t\r\n]+/g,' ').trim()}
  function shown(el){if(!el||el.nodeType!==1)return false;try{const cs=getComputedStyle(el);if(cs.display==='none'||cs.visibility==='hidden')return false;const r=el.getBoundingClientRect();return r.width>2&&r.height>2}catch(_){return true}}
  function readJSON(k){try{const raw=localStorage.getItem(k);return raw?JSON.parse(raw):null}catch(_){return null}}
  function valid(a){a=(Array.isArray(a)?a:[]).map(v=>String(v||'').trim().toLowerCase()).filter(v=>CODES.includes(v));a=Array.from(new Set(a));return a.length?a:DEFAULT.slice()}
  function read(){return valid(readJSON('enabledLanguages')||readJSON('antcv:enabledLanguages')||((readJSON('antcv:prefs')||{}).enabledLanguages)||DEFAULT)}
  function write(a){const next=valid(a),raw=JSON.stringify(next);try{localStorage.setItem('enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:visibleLanguages',raw)}catch(_){}try{const prefs=readJSON('antcv:prefs')||{};prefs.enabledLanguages=next;localStorage.setItem('antcv:prefs',JSON.stringify(prefs))}catch(_){}try{window.dispatchEvent(new CustomEvent('antcv:language-prefs-changed',{detail:{enabledLanguages:next,visibleLanguages:next,scope:'topbar-only'}}))}catch(_){}try{window.dispatchEvent(new CustomEvent('antcv:enabled-languages-changed',{detail:{enabledLanguages:next,scope:'topbar-only'}}))}catch(_){}return next}
  function activeish(b){try{if(b.getAttribute('aria-selected')==='true'||b.getAttribute('aria-pressed')==='true')return true;if(/active|selected|current/i.test(String(b.className||'')))return true;const cs=getComputedStyle(b);const s=[cs.backgroundColor,cs.borderColor,cs.color,cs.boxShadow].join(' ');return /rgb\(0, *183, *187\)|rgb\(1, *183, *187\)|rgb\(11, *180, *190\)|#00b7bb|#01b7bb|#0bb4be/i.test(s)}catch(_){return false}}
  function settingsRoot(){let best=null;Array.from(document.querySelectorAll('[role="dialog"],div')).forEach(el=>{if(!shown(el))return;const t=norm(el.textContent).slice(0,10000);if(/\bSettings\b/.test(t)&&/\bSTANDARD\b/i.test(t)&&/\bADVANCED\b/i.test(t)){if(!best||norm(el.textContent).length<norm(best.textContent).length)best=el}});return best}
  function activeButton(root,re){return Array.from(root.querySelectorAll('button,[role="button"],a')).filter(b=>re.test(norm(b.textContent))).find(activeish)||null}
  function isPersonal(root){const top=activeButton(root,/^(STANDARD|ADVANCED|ADMIN)$/i);const sub=activeButton(root,/^(Account|Personal|User|Layout|Application history|Sync|Adv\. Styles|Routing|API Keys|General|Demo|Users|Analytics)$/i);const a=top?norm(top.textContent).toLowerCase():'';let b=sub?norm(sub.textContent).toLowerCase():'';if(b==='user')b='personal';return a==='standard'&&b==='personal'}
  function removeAllExcept(keep){Array.from(document.querySelectorAll('[data-antcv-language-prefs="1"]')).forEach(el=>{if(el!==keep)el.remove()});const root=settingsRoot();if(root){Array.from(root.querySelectorAll('details,section,article,fieldset,div')).forEach(el=>{if(el===keep||el.closest('[data-antcv-language-prefs="1"]'))return;const t=norm(el.textContent).slice(0,300);if(/^LANGUAGES IN THE TOP BAR\b/i.test(t))el.remove()})}}
  function contentHost(root){
    // Prefer lower Personal-area anchors. The host is the smallest visible parent containing those items.
    const anchors=Array.from(root.querySelectorAll('details,summary,div,section')).filter(el=>/^(ADVANCED TONE|BANNED WORDS)\b/i.test(norm(el.textContent).slice(0,120)));
    if(anchors.length){let a=anchors[anchors.length-1];let p=a.parentElement;for(let i=0;i<6&&p&&p!==root;i++,p=p.parentElement){if(p.children&&p.children.length>2)return p}return a.parentElement||root}
    // Fallback: a lower scroll/content area after the subtab row.
    const kids=Array.from(root.children).filter(shown);return kids.length?kids[kids.length-1]:root;
  }
  function build(){
    const wrap=document.createElement('details');wrap.dataset.antcvLanguagePrefs='1';wrap.setAttribute('data-antcv-language-prefs','1');wrap.open=false;wrap.style.cssText='margin:14px 0 16px 0;padding:0;border-radius:8px;';
    const sum=document.createElement('summary');sum.textContent='LANGUAGES IN THE TOP BAR';sum.style.cssText='cursor:pointer;user-select:none;font-size:11px;font-weight:800;color:rgba(255,255,255,.72);padding:9px 12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.15);border-radius:8px;letter-spacing:.25px;list-style:none;text-transform:uppercase;';wrap.appendChild(sum);
    const body=document.createElement('div');body.style.cssText='padding:10px 12px 4px 12px;';const help=document.createElement('div');help.textContent='Choose which language buttons appear in the top bar. This does not translate or regenerate anything. At least one must stay enabled.';help.style.cssText='font-size:10px;color:rgba(255,255,255,.50);line-height:1.45;margin-bottom:10px;';body.appendChild(help);
    function repaint(){const on=new Set(read());body.querySelectorAll('input[data-code]').forEach(cb=>{cb.checked=on.has(cb.dataset.code)})}
    OPTIONS.forEach(o=>{const lab=document.createElement('label');lab.style.cssText='display:flex;align-items:center;gap:8px;padding:6px 8px;margin:0 0 5px 0;border-radius:6px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.08);cursor:pointer;';const cb=document.createElement('input');cb.type='checkbox';cb.dataset.code=o.code;cb.checked=read().includes(o.code);cb.style.cssText='accent-color:#01B7BB;';const span=document.createElement('span');span.textContent=o.label+' — '+o.name;span.style.cssText='font-size:11px;color:rgba(255,255,255,.88);font-weight:700;';lab.appendChild(cb);lab.appendChild(span);body.appendChild(lab);cb.addEventListener('click',ev=>ev.stopPropagation(),true);cb.addEventListener('change',ev=>{ev.stopPropagation();let next=Array.from(body.querySelectorAll('input[data-code]')).filter(x=>x.checked).map(x=>x.dataset.code);if(!next.length){cb.checked=true;next=[o.code]}write(next);repaint()})});wrap.appendChild(body);return wrap
  }
  let busy=false;function apply(){if(busy)return;busy=true;try{const root=settingsRoot();if(!root){removeAllExcept(null);return}if(!isPersonal(root)){removeAllExcept(null);return}let panel=document.querySelector('[data-antcv-language-prefs="1"]');removeAllExcept(panel);if(!panel){panel=build()}const host=contentHost(root);if(!host.contains(panel))host.appendChild(panel);removeAllExcept(panel)}catch(e){console.warn('[antcv-language-prefs] apply failed:',e&&e.message)}finally{busy=false}}
  let scheduled=false;function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;apply()})}
  window.AntcvLanguagePrefs={get:read,set:write,apply,VERSION};if(!readJSON('enabledLanguages'))write(DEFAULT);
  document.addEventListener('click',()=>setTimeout(schedule,0),true);
  try{new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','aria-selected','aria-pressed']})}catch(_){}
  [0,100,300,800,1600,3000].forEach(t=>setTimeout(apply,t));
})();
