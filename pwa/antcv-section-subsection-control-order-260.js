/* AntCV section/subsection control order + visibility icons (v1.40.265)
 * - Sidebar and main subsection rows use the same control order and keep move buttons.
 * - Order, left to right, gives the requested right-to-left stack: move triangle, compress, enhance, visibility, delete.
 * - Visibility buttons show an eye when active and a see-no-evil monkey when hidden/off.
 * - Adds section-level CJLR buttons for Profile and Work style control rows when missing.
 * - DOM-only: keeps native React buttons and click handlers, only reorders/relabels them.
 */
(function(){
  'use strict';
  const VERSION='1.40.265';
  if(window.__antcvSectionSubsectionControlOrder260===VERSION) return;
  window.__antcvSectionSubsectionControlOrder260=VERSION;

  const ALIGN_KEY='antcv.profileWorkstyleParagraphAlignment.v1';
  const ALIGN=['center','justify','left','right'];
  const GLYPH={left:'⇤',center:'↔',justify:'☰',right:'⇥'};

  function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function low(s){return clean(s).toLowerCase();}
  function meta(b){return low((b&&b.textContent||'')+' '+(b&&b.getAttribute&&b.getAttribute('title')||'')+' '+(b&&b.getAttribute&&b.getAttribute('aria-label')||''));}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function activeText(b){return clean(b&&b.textContent||'');}

  function readMap(){try{const v=JSON.parse(localStorage.getItem(ALIGN_KEY)||'{}');return v&&typeof v==='object'?v:{};}catch(_){return {};}}
  function writeMap(m){try{localStorage.setItem(ALIGN_KEY,JSON.stringify(m||{}));}catch(_){}}
  function readAlign(id){const v=readMap()[id];return ALIGN.indexOf(v)>=0?v:'left';}
  function writeAlign(id,v){const m=readMap();m[id]=v;writeMap(m);} 
  function nextAlign(v){const i=ALIGN.indexOf(v);return ALIGN[(i<0?0:i+1)%ALIGN.length];}

  function isDelete(b){const t=meta(b);return /(^|\s)(x|×)(\s|$)/.test(t)||/\b(delete|remove)\b/.test(t);}
  function isVisibility(b){const t=meta(b);return /^on$|^off$|\b(on|off|toggle|visible|hidden|visibility|hide|show)\b|👁|🙈|🐵/.test(t);}
  function isEnhance(b){return /enhance|enrich|enr\.?|enh\.?|✨/.test(meta(b));}
  function isCompress(b){const t=meta(b);return !isPageNumber(b)&&/compress|comp\.?|⇥⇤|⇤⇥|↔|↹/.test(t);}
  function isPageNumber(b){const t=meta(b);return /📄/.test(t)||/^\s*[▦□📄]*\s*[1-4]\s*$/.test(activeText(b))||/\bpage\s*[1-4]\b/.test(t);}
  function isMoveTriangle(b){
    if(isPageNumber(b)||isDelete(b)||isVisibility(b)||isEnhance(b)||isCompress(b)) return false;
    const txt=activeText(b), t=meta(b);
    return /^[▶▷▸►◀◁‹›]$/.test(txt)||/move.*(section|sidebar|main)|send.*(section|sidebar|main)|next section/.test(t);
  }
  function isCjlr(b){return b&&(
    b.getAttribute('data-antcv-profile-workstyle-cjlr')==='1'||
    b.getAttribute('data-antcv-align-cycler')==='panel'||
    b.getAttribute('data-antcv-align-cycler')==='section'||
    /cjlr|alignment/.test(meta(b))
  );}

  function classify(b){
    if(isPageNumber(b)) return 'page';
    if(isMoveTriangle(b)) return 'move';
    if(isCompress(b)) return 'compress';
    if(isEnhance(b)) return 'enhance';
    if(isVisibility(b)) return 'visibility';
    if(isDelete(b)) return 'delete';
    if(isCjlr(b)) return 'cjlr';
    return '';
  }

  function setKind(b,k){
    if(!b||!k) return;
    b.setAttribute('data-antcv-control-kind-260',k);
    const order={move:10,compress:20,enhance:30,cjlr:35,visibility:40,delete:50}[k];
    if(order!=null) b.style.order=String(order);
  }

  function relabelVisibility(b){
    if(!b) return;
    const raw=clean((b.textContent||'')+' '+(b.getAttribute('title')||'')+' '+(b.getAttribute('aria-label')||''));
    const t=raw.toLowerCase();
    /*
     * v1.40.263: do not treat our own monkey glyph as source state.
     * The previous pass could render visible rows as monkeys, and then the
     * monkey text made the next pass keep them hidden forever. Trust only
     * explicit native OFF/hidden state. Default is visible.
     */
    const explicitOff=/^\s*off\s*$/i.test(clean(b.textContent||''))||/\boff\b|\bhidden\b|\bshow\b/.test(t)||b.getAttribute('aria-pressed')==='false'||b.getAttribute('data-hidden')==='true'||b.classList.contains('off')||b.classList.contains('hidden');
    const explicitOn=/^\s*on\s*$/i.test(clean(b.textContent||''))||/\bon\b|\bvisible\b|\bhide\b/.test(t)||b.getAttribute('aria-pressed')==='true';
    const off=explicitOff&&!explicitOn;
    b.setAttribute('data-antcv-visibility-icon-260','1');
    b.setAttribute('data-antcv-visible-state-260',off?'off':'on');
    b.textContent=off?'🙈':'👁';
    b.title=off?'Hidden. Click to show.':'Visible. Click to hide.';
    b.setAttribute('aria-label',b.title);
  }

  function subsectionRows(){
    return Array.from(document.querySelectorAll('[data-section-row-loc="sidebar"], [data-section-row-loc="main"]'))
      .filter(function(r){return visible(r)&&!r.querySelector('[data-candidate-drop-loc]');});
  }

  function normalizeSubsectionRow(row){
    const loc=row.getAttribute('data-section-row-loc')||'';
    row.setAttribute('data-antcv-normalized-subsection-row-260',loc||'1');
    Array.from(row.querySelectorAll(':scope button, button')).forEach(function(b){
      const k=classify(b);
      if(k==='visibility') relabelVisibility(b);
      if(k==='compress'){ b.textContent='⇥⇤'; b.title=b.title||'Compress'; b.setAttribute('aria-label',b.getAttribute('aria-label')||b.title); }
      if(k) setKind(b,k);
    });
  }

  function headerRows(){
    return ['sidebar','main'].map(function(loc){
      const a=document.querySelector('[data-candidate-drop-loc="'+loc+'"]');
      return a&&a.parentElement?{loc,row:a.parentElement}:null;
    }).filter(Boolean);
  }
  function normalizeHeaderRow(row){
    row.setAttribute('data-antcv-normalized-header-row-260','1');
    Array.from(row.querySelectorAll(':scope button')).forEach(function(b){
      const k=classify(b);
      if(k==='visibility') relabelVisibility(b);
    });
  }

  function sectionIdFromRow(row){
    const txt=low(row.textContent).replace(/\(main\)|\(sidebar\)/g,'');
    if(/^\s*profile\b/.test(txt)) return 'profile';
    if(/^\s*work style\b|^\s*workstyle\b/.test(txt)) return 'work_style';
    return '';
  }
  function styleCjlr(btn,id){
    const a=readAlign(id);
    btn.type='button';
    btn.textContent=GLYPH[a]||GLYPH.left;
    btn.setAttribute('data-antcv-profile-workstyle-cjlr','1');
    btn.setAttribute('data-antcv-pw-section',id);
    btn.setAttribute('data-antcv-control-kind-260','cjlr');
    btn.title=(id==='profile'?'Profile':'Work style')+' paragraph alignment: '+a+'. Click to cycle.';
    btn.setAttribute('aria-label',btn.title);
    btn.style.order='35';
  }
  function ensureProfileWorkstyleCjlr(row){
    const id=sectionIdFromRow(row);
    if(!id) return;
    let btn=row.querySelector('button[data-antcv-profile-workstyle-cjlr="1"][data-antcv-pw-section="'+id+'"]');
    const buttons=Array.from(row.querySelectorAll(':scope button, button'));
    const vis=buttons.find(isVisibility), del=buttons.find(isDelete), enh=buttons.find(isEnhance);
    const host=(vis&&vis.parentElement)||(del&&del.parentElement)||(enh&&enh.parentElement)||row;
    if(!btn){
      btn=document.createElement('button');
      btn.addEventListener('click',function(ev){
        ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
        const n=nextAlign(readAlign(id));
        writeAlign(id,n);
        styleCjlr(btn,id);
        try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'profile-workstyle-cjlr-260',section:id,alignment:n}}));}catch(_){ }
        try{window.dispatchEvent(new Event('input'));}catch(_){ }
      },true);
      const before=vis||del||null;
      if(before&&before.parentElement===host) host.insertBefore(btn,before); else host.appendChild(btn);
    }
    styleCjlr(btn,id);
    setKind(btn,'cjlr');
  }

  function injectCss(){
    if(document.getElementById('antcv-section-subsection-control-order-260-css')) return;
    const s=document.createElement('style');
    s.id='antcv-section-subsection-control-order-260-css';
    s.textContent=`
      [data-antcv-normalized-subsection-row-260] { overflow: visible !important; }
      [data-antcv-normalized-subsection-row-260] button[data-antcv-control-kind-260],
      [data-antcv-normalized-header-row-260] button[data-antcv-visibility-icon-260] { flex: 0 0 auto !important; }
      [data-antcv-control-kind-260="move"] { order:10 !important; }
      [data-antcv-control-kind-260="compress"] { order:20 !important; border-color:#7b2ff2 !important; color:#7b2ff2 !important; background:rgba(123,47,242,.06) !important; }
      [data-antcv-control-kind-260="enhance"] { order:30 !important; }
      [data-antcv-control-kind-260="cjlr"] { order:35 !important; border-color:#01B7BB !important; color:#00746E !important; background:rgba(1,183,187,.08) !important; }
      [data-antcv-control-kind-260="visibility"] { order:40 !important; }
      [data-antcv-control-kind-260="delete"] { order:50 !important; }
      button[data-antcv-visibility-icon-260="1"] {
        min-width:24px !important; width:24px !important; height:24px !important; min-height:24px !important;
        padding:1px 3px !important; font-size:13px !important; line-height:1 !important;
        display:inline-flex !important; align-items:center !important; justify-content:center !important;
        border-radius:5px !important;
      }
      button[data-antcv-visible-state-260="on"] { color:#00746E !important; border-color:#01B7BB !important; background:rgba(1,183,187,.08) !important; }
      button[data-antcv-visible-state-260="off"] { color:#666 !important; border-color:#aaa !important; background:#f6f6f6 !important; }
    `;
    (document.head||document.documentElement).appendChild(s);
  }

  let pending=false;
  function run(){
    if(pending) return; pending=true;
    requestAnimationFrame(function(){
      pending=false;
      try{
        injectCss();
        subsectionRows().forEach(function(r){normalizeSubsectionRow(r);ensureProfileWorkstyleCjlr(r);});
        headerRows().forEach(function(x){normalizeHeaderRow(x.row);});
      }catch(e){try{console.warn('[control-order-260]',e&&e.message);}catch(_){}}
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  [100,250,600,1200,2400,4500].forEach(function(ms){setTimeout(run,ms);});
  try{new MutationObserver(run).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','title','aria-label','aria-pressed']});}catch(_){ }
  window.addEventListener('antcv:sections-updated',run);
  window.addEventListener('click',function(){setTimeout(run,0);},true);
  window.AntcvSectionSubsectionControlOrder260={version:VERSION,run:run};
})();
