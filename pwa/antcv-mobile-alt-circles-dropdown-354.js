/* AntCV mobile alt-circles dropdown (v1.50.113)
 * ---------------------------------------------------------------------------
 * The topbar renders a row of small colour "alt circles" (quick-alternative
 * palette swatches): <div title="#hex" style="width:16px;height:16px;
 * border-radius:50%;cursor:pointer;border:2px solid #fff|rgba(255,255,255,.25)">.
 * The selected one has the opaque white border; each circle's own React onClick
 * switches the palette.
 *
 * Owner request: on mobile, collapse the group to a SINGLE visible circle (the
 * active one). Tapping it reveals the others; tapping one switches (its own
 * handler fires) and collapses again. Desktop is untouched.
 *
 * Mechanism — no DOM removal, no app.js edit, fully reversible:
 *  - paint(): tag each circle group's host + circles + the active trigger.
 *  - CSS (mobile only) hides non-trigger circles while closed.
 *  - A capture-phase click decides: closed → open (swallow the click so nothing
 *    switches); open → let the circle's own handler switch, then close.
 *  - Gated to the topbar (host near the top of the viewport) so settings/preview
 *    swatches are never matched.
 */
(function(){
  'use strict';
  var VERSION='1.50.113';
  if(window.__antcvMobileAltCirclesDropdown354===VERSION)return;
  window.__antcvMobileAltCirclesDropdown354=VERSION;
  var MQ='(max-width: 900px)';
  function isMobile(){try{return window.matchMedia(MQ).matches;}catch(_){return window.innerWidth<=900;}}
  function isCircle(el){
    if(!el||el.nodeType!==1||el.tagName!=='DIV')return false;
    var s=el.getAttribute('style')||'';
    if(!/border-radius:\s*50%/.test(s))return false;
    if(!/cursor:\s*pointer/.test(s))return false;
    if(!/width:\s*1[0-9]px/.test(s))return false;          // ~16px swatch
    return /^#[0-9a-fA-F]{3,8}$/.test((el.getAttribute('title')||'').trim());
  }
  function isActive(el){
    // Selected swatch carries the OPAQUE white border (no rgba alpha).
    return /border:[^;]*\brgb\(255,\s*255,\s*255\)/.test(el.getAttribute('style')||'')
        || /border:[^;]*\bsolid\s*#fff\b/i.test(el.getAttribute('style')||'');
  }
  function groups(){
    var seen=[], out=[];
    Array.prototype.forEach.call(document.querySelectorAll('div[title^="#"]'),function(c){
      if(!isCircle(c))return;
      var p=c.parentElement; if(!p||seen.indexOf(p)>=0)return;
      var kids=Array.prototype.filter.call(p.children,isCircle);
      if(kids.length<2)return;
      var r; try{ r=p.getBoundingClientRect(); }catch(_){ r={top:0}; }
      if(r.top>140)return;                                  // topbar only
      seen.push(p); out.push({host:p,circles:kids});
    });
    return out;
  }
  function injectCss(){
    if(document.getElementById('antcv-altdrop-354-css'))return;
    var st=document.createElement('style');st.id='antcv-altdrop-354-css';
    st.textContent=[
      '@media '+MQ+'{',
      '[data-antcv-altdrop="1"][data-antcv-altdrop-open="0"] [data-antcv-altcircle="1"]:not([data-antcv-alttrigger="1"]){display:none!important;}',
      '[data-antcv-altdrop="1"]{position:relative;}',
      '[data-antcv-altdrop="1"][data-antcv-altdrop-open="1"]{z-index:9002;}',
      '[data-antcv-alttrigger="1"]{position:relative;}',
      /* open DOWN: the other circles drop as an absolute vertical column under
         the trigger (JS sets each one's top). */
      '[data-antcv-altdrop="1"][data-antcv-altdrop-open="1"] [data-antcv-altcircle="1"]:not([data-antcv-alttrigger="1"]){position:absolute!important;left:0!important;margin:0!important;z-index:9003!important;}',
      '[data-antcv-altdrop="1"][data-antcv-altdrop-open="0"] [data-antcv-alttrigger="1"]::after{content:"";position:absolute;right:-2px;bottom:-2px;width:0;height:0;border-left:3px solid transparent;border-right:3px solid transparent;border-top:4px solid rgba(255,255,255,.9);}',
      '}'
    ].join('');
    (document.head||document.documentElement).appendChild(st);
  }
  function clearAll(){
    Array.prototype.forEach.call(document.querySelectorAll('[data-antcv-altdrop="1"]'),function(h){h.removeAttribute('data-antcv-altdrop');h.removeAttribute('data-antcv-altdrop-open');});
    Array.prototype.forEach.call(document.querySelectorAll('[data-antcv-altcircle="1"]'),function(c){c.removeAttribute('data-antcv-altcircle');c.removeAttribute('data-antcv-alttrigger');});
  }
  function paint(){
    if(!isMobile()){clearAll();return;}
    groups().forEach(function(g){
      g.host.setAttribute('data-antcv-altdrop','1');
      if(g.host.getAttribute('data-antcv-altdrop-open')!=='1') g.host.setAttribute('data-antcv-altdrop-open','0');
      var open=g.host.getAttribute('data-antcv-altdrop-open')==='1';
      var trigger=null;
      for(var i=0;i<g.circles.length;i++){ if(isActive(g.circles[i])){trigger=g.circles[i];break;} }
      if(!trigger)trigger=g.circles[0];
      var below=0;
      g.circles.forEach(function(c){
        c.setAttribute('data-antcv-altcircle','1');
        if(c===trigger){ c.setAttribute('data-antcv-alttrigger','1'); c.style.removeProperty('top'); }
        else {
          c.removeAttribute('data-antcv-alttrigger');
          if(open){ below++; c.style.setProperty('top',(below*20)+'px','important'); } // stack downward
          else { c.style.removeProperty('top'); }
        }
      });
    });
  }
  // Capture: collapsed → open (swallow, no switch); open → switch + close.
  document.addEventListener('click',function(ev){
    if(!isMobile())return;
    var t=ev.target; if(!t||!t.closest)return;
    var host=t.closest('[data-antcv-altdrop="1"]'); if(!host)return;
    var circle=t.closest('[data-antcv-altcircle="1"]'); if(!circle||!host.contains(circle))return;
    if(host.getAttribute('data-antcv-altdrop-open')==='1'){
      setTimeout(function(){host.setAttribute('data-antcv-altdrop-open','0');paint();},0);
    }else{
      ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
      host.setAttribute('data-antcv-altdrop-open','1');
      paint();
    }
  },true);
  // Tap elsewhere closes any open group.
  document.addEventListener('click',function(ev){
    if(!isMobile())return;
    Array.prototype.forEach.call(document.querySelectorAll('[data-antcv-altdrop="1"][data-antcv-altdrop-open="1"]'),function(h){
      if(!h.contains(ev.target))h.setAttribute('data-antcv-altdrop-open','0');
    });
  },false);
  function boot(){injectCss();paint();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  [100,300,800,1600,3000].forEach(function(ms){setTimeout(boot,ms);});
  try{new MutationObserver(function(){if(paint._t)return;paint._t=setTimeout(function(){paint._t=0;paint();},120);}).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','title']});}catch(_){}
  try{window.matchMedia(MQ).addEventListener('change',boot);}catch(_){}
  window.AntcvMobileAltCirclesDropdown354={version:VERSION,paint:paint};
})();
