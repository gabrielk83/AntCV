/* AntCV language prefs defaults (v1.40.322)
 * Storage-only. The UI is owned by antcv-language-prefs.js.
 */
(function(){
  'use strict';
  if(window.__antcvLanguagePrefsDefaults==='1.40.322')return;
  window.__antcvLanguagePrefsDefaults='1.40.322';
  const DEFAULT_LANGS=['en','da'];
  function valid(arr){arr=(Array.isArray(arr)?arr:[]).map(x=>String(x||'').trim().toLowerCase()).filter(x=>['en','da','es','zh'].includes(x));arr=Array.from(new Set(arr));return arr.length?arr:DEFAULT_LANGS.slice()}
  function readStored(){try{const raw=localStorage.getItem('enabledLanguages')||localStorage.getItem('antcv:enabledLanguages')||localStorage.getItem('antcv:visibleLanguages');if(raw)return valid(JSON.parse(raw))}catch(_){}return null}
  function save(arr){const next=valid(arr),raw=JSON.stringify(next);try{localStorage.setItem('enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:enabledLanguages',raw)}catch(_){}try{localStorage.setItem('antcv:visibleLanguages',raw)}catch(_){}try{const pi=JSON.parse(localStorage.getItem('personalInfo')||'{}')||{};pi.stylePrefs=pi.stylePrefs||{};pi.stylePrefs.visibleLanguages=next;pi.stylePrefs.languageBar=next;localStorage.setItem('personalInfo',JSON.stringify(pi))}catch(_){}try{window.dispatchEvent(new CustomEvent('antcv:language-prefs-changed',{detail:{visibleLanguages:next,scope:'topbar-only'}}))}catch(_){}try{if(window.AntcvLangBarFilter&&window.AntcvLangBarFilter._applyAll)window.AntcvLangBarFilter._applyAll()}catch(_){}return next}
  if(!readStored())save(DEFAULT_LANGS);
  window.AntcvLanguagePrefsDefaults={version:'1.40.322',save,readStored};
})();
