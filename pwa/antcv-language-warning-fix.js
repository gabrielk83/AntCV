/* AntCV language + warning display fix (v1.40.313)
 * - Makes enabledLanguages persistent and resilient in Settings > Standard > Personal.
 * - Keeps newly ticked languages (notably Chinese) from being immediately unchecked by rerender/normalization.
 * - Splits mixed critical/warning generation messages so non-critical warnings render yellow, not red.
 * - v1.40.314: constrain delegated language click handling to the actual language block only.
 */
(function(){
  'use strict';
  if (window.__antcvLanguageWarningFix === '1.40.314') return;
  window.__antcvLanguageWarningFix = '1.40.314';

  var ALL = ['en','da','es','zh'];
  var LABELS = {
    en: /\b(english|engelsk|en)\b/i,
    da: /\b(dansk|danish|da)\b/i,
    es: /\b(español|espanol|spanish|spansk|es)\b/i,
    zh: /(中文|简体|chinese|kinesisk|zh)/i
  };
  var pending = Object.create(null);

  function parseBoolish(v){
    if (v === true) return true;
    if (v === false || v == null) return false;
    var s = String(v).trim().toLowerCase();
    return !!s && !/^(false|0|null|undefined|no|off)$/.test(s);
  }
  function getEnabled(){
    var raw = null;
    try { raw = localStorage.getItem('enabledLanguages'); } catch(_) {}
    var arr = null;
    try { arr = raw ? JSON.parse(raw) : null; } catch(_) {}
    if (!Array.isArray(arr)) arr = null;
    if (!arr || !arr.length) return ['en','da','es'];
    arr = arr.map(function(x){ return String(x || '').trim().toLowerCase(); }).filter(function(x){ return ALL.indexOf(x) >= 0; });
    return arr.length ? Array.from(new Set(arr)) : ['en'];
  }
  function setEnabled(arr){
    arr = (Array.isArray(arr) ? arr : []).map(function(x){ return String(x || '').trim().toLowerCase(); }).filter(function(x){ return ALL.indexOf(x) >= 0; });
    arr = Array.from(new Set(arr));
    if (!arr.length) arr = ['en'];
    try { localStorage.setItem('enabledLanguages', JSON.stringify(arr)); } catch(_) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key:'enabledLanguages', newValue:JSON.stringify(arr) })); } catch(_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:enabled-languages-changed', { detail:{ enabledLanguages:arr } })); } catch(_) {}
    return arr;
  }
  function codeFromText(t){
    t = String(t || '').replace(/\s+/g, ' ').trim();
    for (var i=0; i<ALL.length; i++) if (LABELS[ALL[i]].test(t)) return ALL[i];
    return null;
  }
  function nearestLabelText(input){
    var parts = [];
    try { if (input.labels) Array.from(input.labels).forEach(function(l){ parts.push(l.textContent || ''); }); } catch(_) {}
    var p = input;
    for (var i=0; i<4 && p; i++, p=p.parentElement) {
      if (p && p.textContent) parts.push(p.textContent);
    }
    try { if (input.name) parts.push(input.name); if (input.value) parts.push(input.value); if (input.id) parts.push(input.id); } catch(_) {}
    return parts.join(' ');
  }
  function isLanguageBlock(el){
    if (!el || el.nodeType !== 1) return false;
    var t = (el.textContent || '').replace(/\s+/g, ' ').trim();
    return /LANGUAGES IN THE TOP BAR|Languages in the top bar/i.test(t);
  }
  function findLanguageRoot(from, allowGlobalFallback){
    var n = from && from.nodeType === 1 ? from : document.body;
    for (var i=0; i<8 && n; i++, n=n.parentElement) if (isLanguageBlock(n)) return n;
    if (!allowGlobalFallback) return null;
    var candidates = Array.from(document.querySelectorAll('div,section,article,details'));
    var best = null;
    candidates.forEach(function(c){
      if (!isLanguageBlock(c)) return;
      var txt = (c.textContent || '').length;
      if (!best || txt < (best.textContent || '').length) best = c;
    });
    return best;
  }
  function languageInputs(root){
    root = root || findLanguageRoot(document.body, true);
    if (!root) return [];
    return Array.from(root.querySelectorAll('input[type="checkbox"],input[type="radio"],button,[role="checkbox"]')).map(function(el){
      var text = nearestLabelText(el);
      var code = codeFromText(text);
      return code ? { el:el, code:code } : null;
    }).filter(Boolean);
  }
  function setControlState(el, checked){
    try {
      if (el.matches && el.matches('input[type="checkbox"],input[type="radio"]')) {
        el.checked = !!checked;
        if (checked) el.setAttribute('checked','checked'); else el.removeAttribute('checked');
      } else {
        el.setAttribute('aria-checked', checked ? 'true' : 'false');
        el.dataset.antcvChecked = checked ? '1' : '0';
      }
    } catch(_) {}
  }
  function syncLanguageUi(){
    var enabled = getEnabled();
    languageInputs().forEach(function(item){
      var wanted = Object.prototype.hasOwnProperty.call(pending, item.code) ? pending[item.code] : enabled.indexOf(item.code) >= 0;
      setControlState(item.el, wanted);
    });
  }
  function handleLanguageToggle(ev){
    var target = ev.target;
    if (!target || target.nodeType !== 1) return;
    var root = findLanguageRoot(target, false);
    if (!root) return;
    var item = languageInputs(root).find(function(x){ return x.el === target || (target.closest && target.closest('label,button,[role="checkbox"]') && (x.el === target.closest('label,button,[role="checkbox"]') || target.closest('label,button,[role="checkbox"]').contains(x.el))); });
    if (!item) return;
    var enabled = getEnabled();
    var currently = enabled.indexOf(item.code) >= 0;
    var nextChecked;
    if (target.matches && target.matches('input[type="checkbox"],input[type="radio"]') && ev.type === 'change') nextChecked = !!target.checked;
    else nextChecked = !currently;
    pending[item.code] = nextChecked;
    var next = enabled.filter(function(x){ return x !== item.code; });
    if (nextChecked) next.push(item.code);
    next = setEnabled(next);
    setControlState(item.el, next.indexOf(item.code) >= 0);
    [0,40,120,300,700].forEach(function(ms){ setTimeout(function(){ delete pending[item.code]; syncLanguageUi(); }, ms); });
  }

  function escapeHtml(s){
    return String(s || '').replace(/[&<>]/g, function(ch){ return ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'; });
  }
  function patchWarningBox(el){
    if (!el || el.nodeType !== 1 || el.dataset.antcvWarningSplit === '1') return;
    var text = (el.textContent || '').trim();
    if (!/key section[s]? need[s]? content before you send/i.test(text) || !/Warning\s*[—-]/i.test(text)) return;
    var idx = text.search(/⚠️?\s*Warning\s*[—-]/i);
    if (idx <= 0) return;
    var critical = text.slice(0, idx).trim();
    var warning = text.slice(idx).trim();
    el.dataset.antcvWarningSplit = '1';
    el.style.whiteSpace = 'pre-wrap';
    el.style.color = '#ff8b8b';
    el.innerHTML = '<span class="antcv-critical-inline" style="color:#ff8b8b">' + escapeHtml(critical) + '</span>' +
      '<br><br><span class="antcv-warning-inline" style="color:#f3d36a">' + escapeHtml(warning) + '</span>';
  }
  function scanWarnings(){
    Array.from(document.querySelectorAll('div,section,article,p,pre')).forEach(function(el){
      var t = el.textContent || '';
      if (t.length > 80 && t.length < 4000 && /key section[s]? need[s]? content before you send/i.test(t) && /Warning\s*[—-]/i.test(t)) patchWarningBox(el);
    });
  }
  function injectStyle(){
    if (document.getElementById('antcv-language-warning-fix-style')) return;
    var st = document.createElement('style');
    st.id = 'antcv-language-warning-fix-style';
    st.textContent = '.antcv-warning-inline{color:#f3d36a!important}.antcv-critical-inline{color:#ff8b8b!important}';
    document.head.appendChild(st);
  }

  document.addEventListener('change', handleLanguageToggle, true);
  document.addEventListener('click', handleLanguageToggle, true);
  try { new MutationObserver(function(){ requestAnimationFrame(function(){ injectStyle(); syncLanguageUi(); scanWarnings(); }); }).observe(document.documentElement, { childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['checked','aria-checked','class','style'] }); } catch(_) {}
  [0,50,150,350,800,1500,3000].forEach(function(t){ setTimeout(function(){ injectStyle(); syncLanguageUi(); scanWarnings(); }, t); });
  window.AntcvLanguageWarningFix = { version:'1.40.314', getEnabled:getEnabled, setEnabled:setEnabled, sync:syncLanguageUi, scanWarnings:scanWarnings };
})();
