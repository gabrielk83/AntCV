/* AntCV Settings language selector: Standard -> Personal only (v1.40.324)
 * Creates exactly one lower/end selector in Settings > Standard > Personal.
 * Removes/hides every stray language selector elsewhere.
 * This controls top-bar supported languages only. It never starts translation.
 */
(function(){
  'use strict';
  if (window.__antcvSettingsLanguagePersonalOnly === '1.40.324') return;
  window.__antcvSettingsLanguagePersonalOnly = '1.40.324';

  var CARD_ID = 'antcv-personal-language-topbar-card';
  var LANGS = [
    {code:'en', label:'English'},
    {code:'da', label:'Danish'},
    {code:'es', label:'Spanish'},
    {code:'zh', label:'Chinese'}
  ];
  var DEFAULT = ['en'];

  function norm(v){ return String(v || '').replace(/\s+/g, ' ').trim(); }
  function lower(v){ return norm(v).toLowerCase(); }
  function shown(el){
    if(!el || el.nodeType !== 1) return false;
    try{
      var cs = getComputedStyle(el);
      if(cs.display === 'none' || cs.visibility === 'hidden') return false;
      var r = el.getBoundingClientRect();
      return r.width > 4 && r.height > 4;
    } catch(_) { return true; }
  }
  function activeish(el){
    if(!el) return false;
    try{
      if(el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-pressed') === 'true') return true;
      if(/active|selected|current/i.test(String(el.className || ''))) return true;
      var cs = getComputedStyle(el);
      var style = [cs.backgroundColor, cs.borderColor, cs.color, cs.boxShadow].join(' ');
      return /rgb\(0,\s*183,\s*187\)|rgb\(1,\s*183,\s*187\)|rgb\(11,\s*180,\s*190\)|#00b7bb|#01b7bb|#0bb4be/i.test(style);
    } catch(_) { return false; }
  }
  function settingsRoot(){
    var best = null;
    Array.from(document.querySelectorAll('[role="dialog"],main,section,div')).forEach(function(el){
      if(!shown(el)) return;
      var t = norm(el.textContent).slice(0, 10000);
      if(/\bSettings\b/.test(t) && /\bSTANDARD\b/i.test(t) && /\bADVANCED\b/i.test(t)){
        if(!best || norm(el.textContent).length < norm(best.textContent).length) best = el;
      }
    });
    return best;
  }
  function buttons(root){ return Array.from(root.querySelectorAll('button,[role="button"],a')); }
  function activeButton(root, re){
    var all = buttons(root).filter(function(b){ return re.test(norm(b.textContent)); });
    return all.find(activeish) || null;
  }
  function tabState(root){
    var top = activeButton(root, /^(STANDARD|ADVANCED|ADMIN)$/i);
    var sub = activeButton(root, /^(Account|Personal|User|Layout|Application history|Sync|Adv\. Styles|Routing|API Keys|General|Demo|Users|Analytics)$/i);
    var t = top ? lower(top.textContent) : '';
    var s = sub ? lower(sub.textContent) : '';
    if(s === 'user') s = 'personal';
    var body = norm(root.textContent).slice(0, 12000);
    // Fallback: Personal tab contains these own sections.
    if(t === 'standard' && !s && /ADVANCED TONE/i.test(body) && /BANNED WORDS/i.test(body)) s = 'personal';
    return {top:t, sub:s};
  }
  function isPersonal(root){
    var st = tabState(root);
    return st.top === 'standard' && st.sub === 'personal';
  }
  function renameUser(root){
    buttons(root).forEach(function(b){
      if(norm(b.textContent) === 'User') b.textContent = 'Personal';
      if(b.getAttribute('aria-label') === 'User') b.setAttribute('aria-label', 'Personal');
      if(b.title === 'User') b.title = 'Personal';
    });
  }
  function valid(arr){
    arr = Array.isArray(arr) ? arr : [];
    arr = arr.map(function(x){ return String(x || '').trim().toLowerCase(); }).filter(function(x){ return LANGS.some(function(l){ return l.code === x; }); });
    arr = Array.from(new Set(arr));
    return arr.length ? arr : DEFAULT.slice();
  }
  function read(k){ try{ var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; } catch(_){ return null; } }
  function enabled(){
    var prefs = read('antcv:prefs') || {};
    return valid(read('enabledLanguages') || read('antcv:enabledLanguages') || prefs.enabledLanguages);
  }
  function write(arr){
    var next = valid(arr);
    var raw = JSON.stringify(next);
    try{ localStorage.setItem('enabledLanguages', raw); }catch(_){}
    try{ localStorage.setItem('antcv:enabledLanguages', raw); }catch(_){}
    try{ var p = read('antcv:prefs') || {}; p.enabledLanguages = next; localStorage.setItem('antcv:prefs', JSON.stringify(p)); }catch(_){}
    try{ window.dispatchEvent(new CustomEvent('antcv:enabled-languages-changed', {detail:{enabledLanguages:next, scope:'topbar-only'}})); }catch(_){}
    return next;
  }
  function languageHeaders(root){
    return Array.from(root.querySelectorAll('*')).filter(function(el){ return /^LANGUAGES IN THE TOP BAR\b/i.test(norm(el.textContent).slice(0, 400)); });
  }
  function likelyCard(el, root){
    var n = el, best = el;
    for(var i=0; i<8 && n && n.parentElement && n !== root && n !== document.body; i++){
      n = n.parentElement;
      var t = norm(n.textContent).slice(0, 1500);
      if(/LANGUAGES IN THE TOP BAR/i.test(t)) best = n;
      try{ var r = n.getBoundingClientRect(); if(r.width > 160 && r.height > 20 && r.height < 900) best = n; }catch(_){}
      if(n.querySelectorAll && n.querySelectorAll('input,select,textarea,button').length > 20) break;
    }
    return best;
  }
  function hideStrays(root){
    var own = document.getElementById(CARD_ID);
    languageHeaders(root).forEach(function(h){
      if(own && own.contains(h)) return;
      var c = likelyCard(h, root);
      if(c === own) return;
      c.setAttribute('data-antcv-lang-stray-hidden', '1');
      c.style.setProperty('display', 'none', 'important');
      c.style.setProperty('visibility', 'hidden', 'important');
    });
  }
  function makeCard(){
    var card = document.createElement('section');
    card.id = CARD_ID;
    card.setAttribute('data-antcv-lang-topbar-card', 'personal-end');
    card.style.cssText = 'margin-top:16px;border:1px solid rgba(255,255,255,.14);border-radius:8px;padding:12px 14px;background:rgba(255,255,255,.025);color:#d7e6ee;';
    card.innerHTML = '<div style="font-weight:800;letter-spacing:.02em;margin-bottom:8px;color:#d7e6ee;text-transform:uppercase">Languages in the top bar</div>' +
      '<div style="font-size:12px;opacity:.78;margin-bottom:10px">Choose which language buttons are available in the top bar. This does not start translation.</div>' +
      '<div data-antcv-lang-options style="display:grid;grid-template-columns:repeat(2,minmax(120px,1fr));gap:8px"></div>';
    return card;
  }
  function renderCard(card){
    var cur = enabled();
    var box = card.querySelector('[data-antcv-lang-options]');
    if(!box) return;
    box.innerHTML = '';
    LANGS.forEach(function(l){
      var label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 9px;border:1px solid rgba(1,183,187,.35);border-radius:8px;background:rgba(1,183,187,.06);cursor:pointer;';
      var input = document.createElement('input');
      input.type = 'checkbox';
      input.setAttribute('data-lang', l.code);
      input.checked = cur.indexOf(l.code) >= 0;
      input.style.accentColor = '#01B7BB';
      var span = document.createElement('span');
      span.textContent = l.label;
      span.style.fontWeight = '650';
      label.appendChild(input);
      label.appendChild(span);
      box.appendChild(label);
    });
  }
  function insertTarget(root){
    // Place before Done button row if present, otherwise at end of the visible Personal panel.
    var done = buttons(root).filter(function(b){ return /^Done$/i.test(norm(b.textContent)); }).pop();
    if(done){
      var n = done;
      for(var i=0; i<5 && n.parentElement && n.parentElement !== root; i++){
        n = n.parentElement;
        try{ var r = n.getBoundingClientRect(); if(r.width > 200 && r.height < 160) break; }catch(_){}
      }
      return {parent:n.parentElement || root, before:n};
    }
    return {parent:root, before:null};
  }
  function ensureCard(root){
    var card = document.getElementById(CARD_ID);
    if(!card) card = makeCard();
    renderCard(card);
    var t = insertTarget(root);
    if(card.parentElement !== t.parent || card.nextSibling !== t.before){
      try{ t.parent.insertBefore(card, t.before); } catch(_){ root.appendChild(card); }
    }
    card.style.removeProperty('display');
    card.style.removeProperty('visibility');
    return card;
  }
  function apply(){
    var root = settingsRoot();
    if(!root) return;
    renameUser(root);
    var personal = isPersonal(root);
    var card = document.getElementById(CARD_ID);
    if(personal){
      card = ensureCard(root);
      hideStrays(root);
    } else {
      if(card){ card.style.setProperty('display','none','important'); card.style.setProperty('visibility','hidden','important'); }
      hideStrays(root);
    }
  }
  function onClick(e){
    var card = document.getElementById(CARD_ID);
    if(!card || !card.contains(e.target)) return;
    var inp = e.target.closest && e.target.closest('input[data-lang]');
    if(!inp) return;
    try{ e.stopPropagation(); }catch(_){}
    var code = inp.getAttribute('data-lang');
    var cur = enabled();
    var on = cur.indexOf(code) >= 0;
    var next;
    if(on && cur.length <= 1){ next = cur.slice(); }
    else if(on){ next = cur.filter(function(x){ return x !== code; }); }
    else { next = cur.concat([code]); }
    write(next);
    renderCard(card);
    setTimeout(apply, 60);
  }
  document.addEventListener('change', onClick, true);
  document.addEventListener('click', function(){ setTimeout(apply,0); setTimeout(apply,80); setTimeout(apply,250); }, true);
  try{ new MutationObserver(function(){ requestAnimationFrame(apply); }).observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:['style','class','aria-selected','aria-pressed']}); }catch(_){}
  [0,50,150,350,800,1500,3000,6000].forEach(function(t){ setTimeout(apply,t); });
  window.AntcvSettingsLanguagePersonalOnly = {version:'1.40.324', apply:apply, enabled:enabled, write:write};
})();
