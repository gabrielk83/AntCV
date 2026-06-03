/* AntCV language prefs defaults (v1.40.339)
 * Storage-only. The UI is owned by antcv-language-prefs.js.
 */
(function(){
  'use strict';
  if(window.__antcvLanguagePrefsDefaults==='1.40.339')return;
  window.__antcvLanguagePrefsDefaults='1.40.339';
  const DEFAULT_LANGS=['en','da'];
  function valid(arr){arr=(Array.isArray(arr)?arr:[]).map(x=>String(x||'').trim().toLowerCase()).filter(x=>['en','da','es','zh'].includes(x));arr=Array.from(new Set(arr));return arr.length?arr:DEFAULT_LANGS.slice()}
  function readStored(){try{const raw=localStorage.getItem('enabledLanguages')||localStorage.getItem('antcv:enabledLanguages')||localStorage.getItem('antcv:visibleLanguages');if(raw)return valid(JSON.parse(raw))}catch(_){}return null}
  function save(arr){const next=valid(arr),raw=JSON.stringify(next);try{localStorage.setItem('enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:visibleLanguages',raw)}catch(_){}try{const pi=JSON.parse(localStorage.getItem('personalInfo')||'{}')||{};pi.stylePrefs=pi.stylePrefs||{};pi.stylePrefs.visibleLanguages=next;pi.stylePrefs.languageBar=next;localStorage.setItem('personalInfo',JSON.stringify(pi))}catch(_){}try{window.dispatchEvent(new CustomEvent('antcv:language-prefs-changed',{detail:{visibleLanguages:next,scope:'topbar-only'}}))}catch(_){}try{if(window.AntcvLangBarFilter&&window.AntcvLangBarFilter._applyAll)window.AntcvLangBarFilter._applyAll()}catch(_){}return next}
  // v1.40.339: if the user just deleted, force-reset language storage to
  // EN+DA defaults regardless of what cloud-restore may have written to
  // personalInfo.stylePrefs.visibleLanguages. The antcv-just-deleted cookie
  // is set by antcv-cloud-delete-302 and survives localStorage.clear() and
  // the OAuth round-trip on the next sign-in.
  function justDeletedRecent(){try{const ck=document.cookie||'';const m=ck.match(/(?:^|;\s*)antcv-just-deleted=([^;]+)/);if(!m)return false;const ts=parseInt(decodeURIComponent(m[1]),10);if(!ts)return false;return (Date.now()-ts)<24*60*60*1000}catch(_){return false}}
  if(justDeletedRecent()){try{console.info('[language-prefs-defaults] antcv-just-deleted set; forcing EN+DA defaults')}catch(_){}save(DEFAULT_LANGS);}
  else if(!readStored())save(DEFAULT_LANGS);
  window.AntcvLanguagePrefsDefaults={version:'1.40.339',save,readStored,justDeletedRecent};
})();
