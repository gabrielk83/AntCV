/* AntCV settings Personal tab scope fix (v1.40.316)
 * - Renames Standard > User subtab to Personal.
 * - Shows “Languages in the top bar” only in Standard > Personal.
 * - Does not fall back to Standard when another top tab is active.
 */
(function(){
  'use strict';
  if (window.__antcvSettingsPersonalScopeFix === '1.40.316') return;
  window.__antcvSettingsPersonalScopeFix = '1.40.316';

  function norm(s){ return String(s || '').replace(/\s+/g, ' ').trim(); }
  function visible(el){
    if (!el || el.nodeType !== 1) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      var r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    } catch (_) { return true; }
  }
  function looksActive(btn){
    if (!btn) return false;
    try {
      if (btn.getAttribute('aria-selected') === 'true' || btn.getAttribute('aria-pressed') === 'true') return true;
      var cls = String(btn.className || '');
      if (/active|selected|current/i.test(cls)) return true;
      var cs = getComputedStyle(btn);
      var s = (cs.backgroundColor || '') + ' ' + (cs.borderColor || '') + ' ' + (cs.color || '');
      return /rgb\(1,\s*183,\s*187\)|rgb\(0,\s*183,\s*187\)|rgb\(11,\s*180,\s*190\)|#01b7bb|#00b7bb|#0bb4be/i.test(s);
    } catch (_) { return false; }
  }
  function findSettingsRoot(){
    var best = null;
    Array.prototype.slice.call(document.querySelectorAll('div,[role="dialog"],[class*="modal" i]')).forEach(function(n){
      if (!visible(n)) return;
      var t = norm(n.textContent).slice(0, 6000);
      if (/\bSettings\b/.test(t) && /\bSTANDARD\b/i.test(t) && /\bADVANCED\b/i.test(t)) {
        if (!best || t.length < norm(best.textContent).length) best = n;
      }
    });
    return best;
  }
  function getActive(root, re){
    var btns = Array.prototype.slice.call(root.querySelectorAll('button,[role="button"],a')).filter(function(b){ return re.test(norm(b.textContent)); });
    return btns.find(looksActive) || null;
  }
  function activeTop(root){
    var b = getActive(root, /^(STANDARD|ADVANCED|ADMIN)$/i);
    return b ? norm(b.textContent).toLowerCase() : '';
  }
  function activeSub(root){
    var b = getActive(root, /^(Account|User|Personal|Layout|Application history|Sync|Adv\. Styles|Routing|API Keys|General|Demo|Users|Analytics)$/i);
    return b ? norm(b.textContent).toLowerCase() : '';
  }
  function renameUser(root){
    Array.prototype.slice.call(root.querySelectorAll('button,[role="button"],a')).forEach(function(b){
      if (norm(b.textContent) === 'User') b.textContent = 'Personal';
      if (b.getAttribute('aria-label') === 'User') b.setAttribute('aria-label', 'Personal');
      if (b.title === 'User') b.title = 'Personal';
    });
  }
  function cardRoot(n, root){
    var best = n;
    var cur = n;
    for (var i=0; i<8 && cur && cur.parentElement && cur.parentElement !== root && cur.parentElement !== document.body; i++) {
      cur = cur.parentElement;
      var t = norm(cur.textContent).slice(0, 1200);
      if (/LANGUAGES IN THE TOP BAR/i.test(t)) best = cur;
      try {
        var r = cur.getBoundingClientRect();
        if (r.width > 250 && r.height > 20 && r.height < 800) best = cur;
      } catch(_) {}
      if (cur.querySelectorAll && cur.querySelectorAll('input,select,textarea,button').length > 12) break;
    }
    return best;
  }
  function scopeLanguageBlock(root){
    var top = activeTop(root);
    var sub = activeSub(root);
    var shouldShow = top === 'standard' && (sub === 'personal' || sub === 'user');
    Array.prototype.slice.call(root.querySelectorAll('div,section,article,details,fieldset')).forEach(function(n){
      var t = norm(n.textContent).slice(0, 600);
      if (!/LANGUAGES IN THE TOP BAR/i.test(t)) return;
      var c = cardRoot(n, root);
      c.setAttribute('data-antcv-personal-only', 'languages-top-bar');
      if (shouldShow) {
        c.style.removeProperty('display');
        c.style.removeProperty('visibility');
      } else {
        c.style.setProperty('display', 'none', 'important');
      }
    });
  }
  function apply(){
    var root = findSettingsRoot();
    if (!root) return;
    renameUser(root);
    scopeLanguageBlock(root);
  }
  try { new MutationObserver(function(){ requestAnimationFrame(apply); }).observe(document.documentElement, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['style','class','aria-selected','aria-pressed']}); } catch (_) {}
  document.addEventListener('click', function(){ setTimeout(apply, 0); setTimeout(apply, 80); setTimeout(apply, 250); }, true);
  [0,50,150,350,800,1500,3000].forEach(function(t){ setTimeout(apply, t); });
  window.AntcvSettingsPersonalScopeFix = { version:'1.40.316', apply:apply };
})();
