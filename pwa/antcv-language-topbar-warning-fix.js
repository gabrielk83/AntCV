/* AntCV top-bar language support + warning colour fix (v1.40.316)
 * - The Settings > Standard > Personal language checkboxes only control which
 *   language choices are shown in the top-bar language dropdown.
 * - They do NOT start translation, switch document language, or call the LLM.
 * - Each language checkbox toggles independently.
 * - At least one language always remains enabled.
 * - Splits mixed critical/warning generation messages so non-critical warnings
 *   render yellow instead of red.
 */
(function(){
  'use strict';
  if (window.__antcvLanguageTopbarWarningFix === '1.40.316') return;
  window.__antcvLanguageTopbarWarningFix = '1.40.316';

  var ALL = ['en','da','es','zh'];
  var DEFAULTS = ['en'];
  var LABEL_MAP = {
    en: ['english','engelsk','en'],
    da: ['dansk','danish','da'],
    es: ['español','espanol','spanish','spansk','es'],
    zh: ['中文','简体','chinese','kinesisk','zh']
  };
  var inPatch = false;
  var pending = Object.create(null);

  function norm(s){ return String(s || '').replace(/\s+/g, ' ').trim(); }
  function uniqValid(arr){
    arr = (Array.isArray(arr) ? arr : []).map(function(x){ return String(x || '').trim().toLowerCase(); }).filter(function(x){ return ALL.indexOf(x) >= 0; });
    arr = Array.from(new Set(arr));
    return arr.length ? arr : DEFAULTS.slice();
  }
  function readJSON(key){ try { var raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch(_) { return null; } }
  function getEnabled(){ return uniqValid(readJSON('enabledLanguages') || readJSON('antcv:enabledLanguages')); }
  function writeEnabled(arr){
    var next = uniqValid(arr);
    var json = JSON.stringify(next);
    try { localStorage.setItem('enabledLanguages', json); } catch(_) {}
    try { localStorage.setItem('antcv:enabledLanguages', json); } catch(_) {}
    try {
      var prefs = readJSON('antcv:prefs') || {};
      prefs.enabledLanguages = next;
      localStorage.setItem('antcv:prefs', JSON.stringify(prefs));
    } catch(_) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key:'enabledLanguages', newValue:json })); } catch(_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:enabled-languages-changed', { detail:{ enabledLanguages:next, scope:'topbar-only' } })); } catch(_) {}
    return next;
  }
  function containsWord(text, token){
    text = norm(text).toLowerCase();
    token = String(token || '').toLowerCase();
    if (!token) return false;
    if (/^[a-z]{2}$/.test(token)) return new RegExp('(^|[^a-z])' + token.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '([^a-z]|$)', 'i').test(text);
    return text.indexOf(token) >= 0;
  }
  function codeFromSpecificText(t){
    t = norm(t);
    var hits = [];
    ALL.forEach(function(code){
      if (LABEL_MAP[code].some(function(tok){ return containsWord(t, tok); })) hits.push(code);
    });
    return hits.length === 1 ? hits[0] : null;
  }
  function ownLabelText(label){
    if (!label || label.nodeType !== 1) return '';
    var c = label.cloneNode(true);
    try { Array.from(c.querySelectorAll('input,button,select,svg,path')).forEach(function(n){ n.remove(); }); } catch(_) {}
    return norm(c.textContent || '');
  }
  function codeFromControl(el){
    if (!el || el.nodeType !== 1) return null;
    try {
      var ds = el.dataset || {};
      var direct = ds.lang || ds.language || el.getAttribute('data-lang') || el.getAttribute('data-language');
      if (direct && ALL.indexOf(String(direct).toLowerCase()) >= 0) return String(direct).toLowerCase();
      var attrs = [el.getAttribute('aria-label'), el.title, el.name, el.value, el.id].filter(Boolean).join(' ');
      var fromAttrs = codeFromSpecificText(attrs);
      if (fromAttrs) return fromAttrs;
      if (el.matches && el.matches('label')) return codeFromSpecificText(ownLabelText(el));
      if (el.id) {
        var lab = document.querySelector('label[for="' + CSS.escape(el.id) + '"]');
        var fromFor = lab && codeFromSpecificText(ownLabelText(lab));
        if (fromFor) return fromFor;
      }
      if (el.labels && el.labels.length) {
        for (var i=0; i<el.labels.length; i++) {
          var fromLabel = codeFromSpecificText(ownLabelText(el.labels[i]));
          if (fromLabel) return fromLabel;
        }
      }
      var closestLabel = el.closest && el.closest('label');
      if (closestLabel) return codeFromSpecificText(ownLabelText(closestLabel));
    } catch(_) {}
    return null;
  }
  function isLanguageBlock(el){ return !!(el && el.nodeType === 1 && /LANGUAGES IN THE TOP BAR|Languages in the top bar/i.test(norm(el.textContent).slice(0, 1200))); }
  function findLanguageRoot(from){
    var n = from && from.nodeType === 1 ? from : null;
    for (var i=0; i<10 && n; i++, n=n.parentElement) if (isLanguageBlock(n)) return n;
    return null;
  }
  function findAnyLanguageRoot(){
    var best = null;
    Array.from(document.querySelectorAll('[data-antcv-personal-only="languages-top-bar"],div,section,article,details,fieldset')).forEach(function(el){
      if (!isLanguageBlock(el)) return;
      var len = norm(el.textContent).length;
      if (!best || len < norm(best.textContent).length) best = el;
    });
    return best;
  }
  function languageControls(root){
    root = root || findAnyLanguageRoot();
    if (!root) return [];
    var seen = new Set();
    var out = [];
    Array.from(root.querySelectorAll('input[type="checkbox"],input[type="radio"],[role="checkbox"],[data-lang],[data-language],label')).forEach(function(el){
      var code = codeFromControl(el);
      if (!code) return;
      var key = (el.tagName || '') + ':' + code + ':' + (el.id || el.name || out.length);
      if (seen.has(key)) return;
      seen.add(key);
      out.push({ el:el, code:code });
    });
    return out;
  }
  function setChecked(el, checked){
    try {
      if (el.matches && el.matches('input[type="checkbox"],input[type="radio"]')) {
        el.checked = !!checked;
        if (checked) el.setAttribute('checked','checked'); else el.removeAttribute('checked');
      } else if (el.matches && el.matches('label')) {
        var inp = el.querySelector('input[type="checkbox"],input[type="radio"]');
        if (inp) setChecked(inp, checked);
        el.setAttribute('aria-checked', checked ? 'true' : 'false');
      } else {
        el.setAttribute('aria-checked', checked ? 'true' : 'false');
        el.dataset.antcvChecked = checked ? '1' : '0';
      }
    } catch(_) {}
  }
  function syncLanguageUi(){
    var root = findAnyLanguageRoot();
    if (!root) return;
    var enabled = getEnabled();
    languageControls(root).forEach(function(item){
      var wanted = Object.prototype.hasOwnProperty.call(pending, item.code) ? pending[item.code] : enabled.indexOf(item.code) >= 0;
      setChecked(item.el, wanted);
    });
  }
  function interceptLanguageClick(ev){
    if (inPatch) return;
    var target = ev.target;
    if (!target || target.nodeType !== 1) return;
    var root = findLanguageRoot(target);
    if (!root) return;
    var ctl = target.closest && target.closest('input[type="checkbox"],input[type="radio"],[role="checkbox"],[data-lang],[data-language],label');
    if (!ctl || !root.contains(ctl)) return;
    var code = codeFromControl(ctl);
    if (!code) return;
    try { ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); } catch(_) {}
    var enabled = getEnabled();
    var currently = enabled.indexOf(code) >= 0;
    var next;
    if (currently && enabled.length <= 1) {
      next = enabled.slice();
      pending[code] = true;
    } else if (currently) {
      next = enabled.filter(function(x){ return x !== code; });
      pending[code] = false;
    } else {
      next = enabled.concat([code]);
      pending[code] = true;
    }
    next = writeEnabled(next);
    inPatch = true;
    try { languageControls(root).forEach(function(item){ setChecked(item.el, next.indexOf(item.code) >= 0); }); }
    finally { inPatch = false; }
    [40,120,300,800,1500].forEach(function(ms){ setTimeout(function(){ delete pending[code]; syncLanguageUi(); }, ms); });
    return false;
  }

  function escapeHtml(s){ return String(s || '').replace(/[&<>]/g, function(ch){ return ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'; }); }
  function patchWarningBox(el){
    if (!el || el.nodeType !== 1 || el.dataset.antcvWarningSplit === '1') return;
    var text = norm(el.textContent);
    if (!/key section[s]? need[s]? content before you send/i.test(text) || !/Warning\s*[—-]/i.test(text)) return;
    var idx = text.search(/⚠️?\s*Warning\s*[—-]/i);
    if (idx <= 0) return;
    el.dataset.antcvWarningSplit = '1';
    el.style.whiteSpace = 'pre-wrap';
    el.innerHTML = '<span class="antcv-critical-inline" style="color:#ff8b8b">' + escapeHtml(text.slice(0, idx).trim()) + '</span>' +
      '<br><br><span class="antcv-warning-inline" style="color:#f3d36a">' + escapeHtml(text.slice(idx).trim()) + '</span>';
  }
  function scanWarnings(){
    Array.from(document.querySelectorAll('div,section,article,p,pre')).forEach(function(el){
      var t = el.textContent || '';
      if (t.length > 80 && t.length < 5000 && /key section[s]? need[s]? content before you send/i.test(t) && /Warning\s*[—-]/i.test(t)) patchWarningBox(el);
    });
  }
  function injectStyle(){
    if (document.getElementById('antcv-language-topbar-warning-fix-style')) return;
    var st = document.createElement('style');
    st.id = 'antcv-language-topbar-warning-fix-style';
    st.textContent = '.antcv-warning-inline{color:#f3d36a!important}.antcv-critical-inline{color:#ff8b8b!important}' +
      '[data-antcv-personal-only="languages-top-bar"] input[type="checkbox"]{accent-color:#01B7BB}';
    document.head.appendChild(st);
  }
  document.addEventListener('click', interceptLanguageClick, true);
  document.addEventListener('change', interceptLanguageClick, true);
  try { new MutationObserver(function(){ requestAnimationFrame(function(){ injectStyle(); syncLanguageUi(); scanWarnings(); }); }).observe(document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['checked','aria-checked','class','style'] }); } catch(_) {}
  [0,50,150,350,800,1500,3000].forEach(function(t){ setTimeout(function(){ injectStyle(); syncLanguageUi(); scanWarnings(); }, t); });
  window.AntcvLanguageTopbarWarningFix = { version:'1.40.316', getEnabled:getEnabled, setEnabled:writeEnabled, sync:syncLanguageUi, scanWarnings:scanWarnings };
})();
