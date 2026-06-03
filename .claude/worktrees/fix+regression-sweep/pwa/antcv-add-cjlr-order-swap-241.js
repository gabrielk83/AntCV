/* AntCV Add/CJLR order swap (v1.40.241)
 * Fixes v1.40.240: requested order is CJLR before Add.
 * Applies to SIDEBAR and MAIN top control rows only.
 */
(function(){
  'use strict';
  const TARGET_LOCS = new Set(['sidebar','main']);
  const STYLE_ID = 'antcv-add-cjlr-order-swap-241-style';

  function norm(s){ return String(s||'').trim().toLowerCase(); }
  function locOf(row){
    if(!row) return '';
    return norm(row.getAttribute('data-antcv-panel-loc') ||
           row.getAttribute('data-antcv-panel') ||
           row.getAttribute('data-antcv-section-panel') || '');
  }
  function isPanelRow(el){
    if(!el || !el.querySelectorAll) return false;
    const l = locOf(el);
    if(!TARGET_LOCS.has(l)) return false;
    return !!el.querySelector('button');
  }
  function panelRows(){
    const out = [];
    const seen = new Set();
    document.querySelectorAll('[data-antcv-panel-211], [data-antcv-panel-208], [data-antcv-panel-207], [data-antcv-panel-loc], [data-antcv-panel]').forEach(function(el){
      if(!isPanelRow(el)) return;
      if(seen.has(el)) return;
      seen.add(el); out.push(el);
    });
    return out;
  }
  function isCJLR(btn){
    if(!btn) return false;
    const t = norm(btn.title + ' ' + btn.getAttribute('aria-label'));
    const txt = String(btn.textContent||'').trim();
    return btn.getAttribute('data-antcv-headline-cjlr') === '1' ||
           btn.getAttribute('data-antcv-align-cycler') === 'panel-default' ||
           btn.getAttribute('data-antcv-panel-action-211') === 'cjlr' ||
           btn.getAttribute('data-antcv-panel-action-208') === 'cjlr' ||
           btn.getAttribute('data-antcv-panel-action-207') === 'cjlr' ||
           t.indexOf('cjlr') >= 0 ||
           t.indexOf('align') >= 0 ||
           txt === '↔' || txt === '↤' || txt === '↦' || txt === '↭' || txt === '⇔';
  }
  function isAdd(btn){
    if(!btn) return false;
    const t = norm(btn.title + ' ' + btn.getAttribute('aria-label'));
    const txt = String(btn.textContent||'').trim();
    return btn.getAttribute('data-antcv-panel-action-211') === 'add' ||
           btn.getAttribute('data-antcv-panel-action-208') === 'add' ||
           btn.getAttribute('data-antcv-panel-action-207') === 'add' ||
           t.indexOf('add a ') >= 0 ||
           t.indexOf('add section') >= 0 ||
           txt === '+' || /^\+\s*add/i.test(txt);
  }
  function markButtons(row){
    Array.from(row.querySelectorAll('button')).forEach(function(btn){
      if(isCJLR(btn)){
        btn.setAttribute('data-antcv-add-cjlr-swap-241','cjlr');
        btn.style.order = '45';
      } else if(isAdd(btn)){
        btn.setAttribute('data-antcv-add-cjlr-swap-241','add');
        btn.style.order = '50';
      }
    });
  }
  function run(){ panelRows().forEach(markButtons); }
  function installStyle(){
    if(document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      [data-antcv-panel-loc="sidebar"] button[data-antcv-add-cjlr-swap-241="cjlr"],
      [data-antcv-panel-loc="main"] button[data-antcv-add-cjlr-swap-241="cjlr"],
      [data-antcv-panel="sidebar"] button[data-antcv-add-cjlr-swap-241="cjlr"],
      [data-antcv-panel="main"] button[data-antcv-add-cjlr-swap-241="cjlr"] { order:45 !important; }
      [data-antcv-panel-loc="sidebar"] button[data-antcv-add-cjlr-swap-241="add"],
      [data-antcv-panel-loc="main"] button[data-antcv-add-cjlr-swap-241="add"],
      [data-antcv-panel="sidebar"] button[data-antcv-add-cjlr-swap-241="add"],
      [data-antcv-panel="main"] button[data-antcv-add-cjlr-swap-241="add"] { order:50 !important; }
    `;
    document.head.appendChild(s);
  }
  function start(){
    installStyle();
    run();
    [50,150,300,800,1500,3000].forEach(ms=>setTimeout(run,ms));
    try{ new MutationObserver(function(){ setTimeout(run,0); }).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['data-antcv-panel-action-211','data-antcv-panel-action-208','data-antcv-align-cycler','style','class']}); }catch(_){ }
    window.addEventListener('click', function(){ setTimeout(run,0); }, true);
    window.addEventListener('antcv:sections-updated', function(){ setTimeout(run,0); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true}); else start();
})();
