/* AntCV mobile bottom-nav compaction (v1.50.104)
 * ---------------------------------------------------------------------------
 * On narrow (mobile) viewports the bottom navigation bar (.antcv-react-bottom-nav)
 * overflows: its buttons keep full desktop text + padding, so the right-hand
 * buttons get clipped off-screen. This sidecar shrinks the button text and
 * padding on mobile ONLY, via a single injected <style> with a max-width media
 * query, so every button fits and stays reachable.
 *
 * CSS-only, mobile-gated, reversible. No DOM mutation, no app.js edit — per
 * CLAUDE.md hotfix discipline. Inline styles on the React buttons are overridden
 * with !important inside the media query so the rules actually win.
 */
(function(){
  'use strict';
  var VERSION='1.50.104';
  if(window.__antcvMobileBottomCompact352===VERSION) return;
  window.__antcvMobileBottomCompact352=VERSION;
  var ID='antcv-mobile-bottom-compact-352-css';
  function inject(){
    if(document.getElementById(ID)) return;
    var st=document.createElement('style');
    st.id=ID;
    st.textContent=[
      '@media (max-width:640px){',
      '  .antcv-react-bottom-nav{gap:2px!important;padding-left:2px!important;padding-right:2px!important;overflow-x:auto!important;}',
      '  .antcv-react-bottom-nav button,.antcv-react-bottom-nav [role="button"]{',
      '    font-size:10px!important;padding:0 6px!important;min-width:0!important;',
      '    height:38px!important;line-height:1.05!important;letter-spacing:0!important;',
      '  }',
      '  .antcv-react-bottom-nav button svg{width:12px!important;height:12px!important;margin-right:3px!important;}',
      '}',
      '@media (max-width:380px){',
      '  .antcv-react-bottom-nav button,.antcv-react-bottom-nav [role="button"]{font-size:9px!important;padding:0 4px!important;}',
      '}'
    ].join('\n');
    (document.head||document.documentElement).appendChild(st);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',inject,{once:true}); else inject();
  // Re-assert if the head is ever cleared by a hard React remount.
  try{ new MutationObserver(function(){ if(!document.getElementById(ID)) inject(); }).observe(document.documentElement,{childList:true,subtree:true}); }catch(_){}
  window.AntcvMobileBottomCompact352={version:VERSION};
})();
