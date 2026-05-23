/* AntCV What I Bring row-control normalizer (v1.40.259)
 * - What I Bring uses the same underlying table as Core Competencies, but older
 *   helpers could inject a second page/CJLR control set into each row.
 * - Removes the stale injected Wib controls and deduplicates same-purpose row
 *   buttons, while preserving the native buttons and their existing handlers.
 * - Keeps row controls inside the row so they do not slide under the vertical
 *   preview scroller.
 */
(function(){
  'use strict';
  const VERSION='1.40.259';
  if(window.__antcvWhatIBringRowControls259===VERSION) return;
  window.__antcvWhatIBringRowControls259=VERSION;

  const PANEL_RX=/what\s+i\s+bring/i;
  const FIELD_RX=/focus\s+area|strategic\s+expertise/i;
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));

  function activeWhatIBringPanel(){
    const headers=Array.from(document.querySelectorAll('h1,h2,h3,strong,b,div,span')).filter(visible);
    const h=headers.find(x=>PANEL_RX.test(clean(x.textContent||'')) && clean(x.textContent||'').length<80);
    if(!h) return null;
    let p=h;
    for(let d=0;p&&d<8;d++,p=p.parentElement){
      const fields=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>FIELD_RX.test(f.value||f.placeholder||f.textContent||''));
      if(fields.length>=2) return p;
    }
    const seed=Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]')).find(f=>FIELD_RX.test(f.value||f.placeholder||f.textContent||''));
    if(!seed) return null;
    p=seed.parentElement;
    for(let d=0;p&&d<8;d++,p=p.parentElement){ if(PANEL_RX.test(clean(p.textContent||''))) return p; }
    return null;
  }

  function rowForField(f,root){
    let p=f.parentElement,best=null;
    for(let d=0;p&&p!==root.parentElement&&d<7;d++,p=p.parentElement){
      const fields=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
      if(fields.length>=2&&fields.length<=5) best=p;
      const txt=clean(p.textContent||'');
      if(fields.length>=2&&/focus\s+area/i.test(txt)&&/strategic/i.test(txt)){ best=p; break; }
    }
    return best;
  }

  function rows(root){
    if(!root) return [];
    const seeds=Array.from(root.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>/focus\s+area/i.test(f.value||f.placeholder||f.textContent||''));
    const out=[];
    seeds.forEach(f=>{const r=rowForField(f,root); if(r&&visible(r)&&!out.includes(r)) out.push(r);});
    return out;
  }

  function keyForButton(b){
    const t=clean((b.getAttribute('aria-label')||'')+' '+(b.title||'')+' '+(b.textContent||'')).toLowerCase();
    if(b.matches('[data-antcv-wib-cjlr-249],[data-antcv-wib-page-249]')) return 'stale-wib';
    if(/move row up|\bup\b|▲/.test(t)) return 'up';
    if(/move row down|\bdown\b|▼/.test(t)) return 'down';
    if(/hide|show|👁|⊙|eye/.test(t)) return 'eye';
    if(/delete|remove|×|✕|x/.test(t)) return 'delete';
    if(/enrich|enhance|✨/.test(t)) return 'enhance';
    if(/page|start.*page|📄/.test(t)) return 'page';
    if(/compress|comp\.?|↔|⇔|⇥\s*⇤|⇤\s*⇥/.test(t)) return 'compress';
    if(/alignment|align|cjlr|justify|center|left|right|☰|⇤|⇥/.test(t)) return 'cjlr';
    return '';
  }

  function dedupe(row){
    // Remove the older injected host entirely. Native row buttons keep their handlers.
    // v1.40.262: do not remove the owned What I Bring host; it carries the active CJLR/page controls.

    const seen=Object.create(null);
    const buttons=Array.from(row.querySelectorAll('button')).filter(visible);
    buttons.forEach(b=>{
      const k=keyForButton(b);
      if(!k||k==='up'||k==='down') return;
      if(k==='stale-wib'){ b.remove(); return; }
      if(seen[k]){ b.remove(); return; }
      seen[k]=b;
    });

    // Keep compact row geometry. This prevents controls from drifting behind the
    // preview split scrollbar when the panel is narrow.
    row.style.maxWidth='100%';
    row.style.boxSizing='border-box';
    row.style.overflow='hidden';
    const hosts=Array.from(row.children).filter(el=>el&&el.style);
    hosts.forEach(el=>{ if(el.querySelector&&el.querySelector('button')){ el.style.flexShrink='0'; el.style.maxWidth='100%'; } });
  }

  let pending=false;
  function runSoon(){ if(pending) return; pending=true; requestAnimationFrame(()=>{pending=false;run();}); }
  function run(){ try{ const root=activeWhatIBringPanel(); rows(root).forEach(dedupe); }catch(e){ try{console.warn('[antcv-what-i-bring-row-controls-259] failed:',e&&e.message);}catch(_){} } }
  function start(){ run(); [100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms)); try{ new MutationObserver(runSoon).observe(document.body||document.documentElement,{childList:true,subtree:true}); }catch(_){} window.addEventListener('click',()=>setTimeout(run,0),true); window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0)); }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
  window.AntcvWhatIBringRowControls259={version:VERSION,run};
})();
