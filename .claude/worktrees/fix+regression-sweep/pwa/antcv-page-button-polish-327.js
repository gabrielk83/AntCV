/* AntCV page-button polish + How I Would Contribute order fix (v1.40.324)
 * - Applies per-page colors to all 📄 row/block buttons.
 * - Reorders HOW I WOULD CONTRIBUTE controls to: Page, CJLR, Enhance, Compress, Delete.
 * - Renames + Bullet to + Add.
 */
(function(){
  'use strict';
  const VERSION='1.40.324';
  if(window.__antcvPageButtonPolish324===VERSION) return;
  window.__antcvPageButtonPolish324=VERSION;
  const COLORS={1:'#C9B9F5',2:'#F0B35A',3:'#00746E',4:'#4A8FA8'};
  const BG={1:'rgba(201,185,245,.18)',2:'rgba(240,179,90,.18)',3:'rgba(0,116,110,.14)',4:'rgba(74,143,168,.16)'};
  function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function pageNo(b){const m=clean(b.textContent||b.title||b.getAttribute('aria-label')||'').match(/(?:📄|page)\s*([1-4])/i);return m?Number(m[1]):1;}
  function isPageButton(b){const t=clean((b.textContent||'')+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||''));return b.matches('[data-antcv-core-page],[data-antcv-hiwc-page],[data-antcv-wib264="page"]')||/📄\s*[1-4]/.test(t);}
  function paint(b){const p=pageNo(b);const c=COLORS[p]||COLORS[1];b.style.border='1px solid '+c;b.style.background=BG[p]||BG[1];b.style.color=p===3?'#00746E':'#5B4B7A';b.style.boxShadow=p>1?'0 0 0 1px '+c+'55 inset':'';b.setAttribute('data-antcv-page-color',String(p));}
  function reorderHiwc(){
    document.querySelectorAll('[data-antcv-hiwc-controls]').forEach(w=>{
      const page=w.querySelector('[data-antcv-hiwc-page]');const cjlr=w.querySelector('[data-antcv-hiwc-cjlr]');const enr=w.querySelector('[data-antcv-hiwc-enrich]');const comp=w.querySelector('[data-antcv-hiwc-compress]');[page,cjlr,enr,comp].filter(Boolean).forEach(x=>w.appendChild(x));
    });
    document.querySelectorAll('[data-antcv-hiwc-bullet-row]').forEach(r=>{
      const input=r.querySelector('[data-antcv-hiwc-bullet-input]');const page=r.querySelector('[data-antcv-hiwc-page]');const cjlr=r.querySelector('[data-antcv-hiwc-cjlr]');const enr=r.querySelector('[data-antcv-hiwc-enrich]');const comp=r.querySelector('[data-antcv-hiwc-compress]');const del=r.querySelector('[data-antcv-hiwc-delete],[data-antcv-hiwc-bullet-delete]')||Array.from(r.querySelectorAll('button')).find(b=>/[×x]/i.test(clean(b.textContent)));
      [input,page,cjlr,enr,comp,del].filter(Boolean).forEach(x=>r.appendChild(x));
    });
    document.querySelectorAll('[data-antcv-hiwc-add]').forEach(b=>{b.textContent='+ Add';b.title='Add bullet row';});
  }
  function run(){try{document.querySelectorAll('button').forEach(b=>{if(isPageButton(b))paint(b);});reorderHiwc();}catch(e){try{console.warn('[page-button-polish-324]',e&&e.message);}catch(_){}}}
  let pending=false;function soon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(soon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','title','aria-label']});}catch(_){}window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('antcv:sections-updated',soon);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
