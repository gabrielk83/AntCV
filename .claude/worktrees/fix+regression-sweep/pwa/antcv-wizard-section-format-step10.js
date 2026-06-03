/* AntCV wizard section-format visibility guard (v1.40.226)
 * Removes the sticky Section formats card from every wizard step except the real section-format step.
 */
(function(){
  'use strict';
  if (window.__antcvWizardSectionFormatStep10 === '1.40.226') return;
  window.__antcvWizardSectionFormatStep10 = '1.40.226';

  var CARD_RE = /Section\s+formats\s*[—-]\s*pick\s+how\s+each\s+section\s+looks/i;
  var STEP10_RE = /(?:step|stage)\s*10\b|\b10\s*\/\s*(?:10|11|12|13|14|15)\b|\b10\s+of\s+(?:10|11|12|13|14|15)\b/i;
  var STEP_NOT_10_RE = /(?:step|stage)\s*(?:[1-9]|1[1-9])\b|\b(?:[1-9]|1[1-9])\s*\/\s*(?:10|11|12|13|14|15)\b|\b(?:[1-9]|1[1-9])\s+of\s+(?:10|11|12|13|14|15)\b/i;

  function txt(el, max){
    var t = (el && el.textContent || '').replace(/\s+/g,' ').trim();
    return max ? t.slice(0,max) : t;
  }
  function shown(el){
    if(!el || el.nodeType !== 1) return false;
    try{
      var cs = getComputedStyle(el);
      if(cs.display === 'none' || cs.visibility === 'hidden') return false;
      var r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    }catch(_){ return true; }
  }
  function cardRoot(el){
    var n = el, best = el;
    while(n && n !== document.body && n.nodeType === 1){
      var s = txt(n, 1500);
      if(CARD_RE.test(s)) best = n;
      if((/wizard|setup|onboard|first.?run/i.test(n.className || '') || /Skip|Continue|Back|Next/i.test(s)) && n !== el) break;
      n = n.parentElement;
    }
    return best;
  }
  function wizardRoot(){
    var candidates = Array.from(document.querySelectorAll('[class*="wizard"],[id*="wizard"],[class*="setup"],[id*="setup"],main,section,div'));
    var best = null;
    candidates.some(function(el){
      if(!shown(el)) return false;
      var s = txt(el, 6000);
      if(/Skip|Continue|Back|Next|provider|worker|cloud|Section\s+formats/i.test(s) && /wizard|setup|getting started|before you continue|provider|worker|cloud/i.test(s)){
        best = el;
        return true;
      }
      return false;
    });
    return best || document.body;
  }
  function stripCardsFromText(host){
    var clone = host.cloneNode(true);
    Array.from(clone.querySelectorAll('*')).forEach(function(n){
      if(CARD_RE.test(txt(n, 900))) n.textContent = '';
    });
    return txt(clone, 8000);
  }
  function onRealSectionFormatStep(){
    var root = wizardRoot();
    var s = stripCardsFromText(root);
    if(STEP_NOT_10_RE.test(s) && !STEP10_RE.test(s)) return false;
    if(STEP10_RE.test(s)) return true;
    // Fallback for builds with no numeric step label: only allow when actual controls for choosing section formats are present.
    return /choose\s+format|format\s+preview|section\s+look|layout\s+format/i.test(s) && /CV|Cover\s+letter|Professional\s+Experience|Education/i.test(s);
  }
  function hide(card){
    card.setAttribute('data-antcv-section-format-card','1');
    card.setAttribute('data-antcv-hidden-outside-step10','1');
    card.style.setProperty('display','none','important');
    card.style.setProperty('position','static','important');
    card.style.setProperty('top','auto','important');
    card.style.setProperty('z-index','auto','important');
  }
  function show(card){
    card.setAttribute('data-antcv-section-format-card','1');
    card.removeAttribute('data-antcv-hidden-outside-step10');
    card.style.removeProperty('display');
    card.style.removeProperty('position');
    card.style.removeProperty('top');
    card.style.removeProperty('z-index');
  }
  function apply(){
    var allow = onRealSectionFormatStep();
    var nodes = [];
    try{ nodes = Array.from(document.querySelectorAll('div,section,article,aside,[data-antcv-section-format-card]')); }catch(_){ return; }
    nodes.forEach(function(n){
      if(!n || n.nodeType !== 1) return;
      if(!CARD_RE.test(txt(n, 1200)) && !n.hasAttribute('data-antcv-section-format-card')) return;
      var c = cardRoot(n);
      if(allow) show(c); else hide(c);
    });
  }
  try{ new MutationObserver(function(){ requestAnimationFrame(apply); }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','hidden','aria-hidden']}); }catch(_){ }
  [0,50,150,300,600,1000,1800,3000,5000,8000,12000].forEach(function(t){ setTimeout(apply,t); });
  window.addEventListener('hashchange', apply, true);
  window.addEventListener('popstate', apply, true);
  window.addEventListener('click', function(){ setTimeout(apply,0); setTimeout(apply,250); }, true);
  window.AntcvWizardSectionFormatStep10 = { version:'1.40.226', apply:apply };
})();
