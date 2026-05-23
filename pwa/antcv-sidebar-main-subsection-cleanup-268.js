/* AntCV sidebar/main subsection cleanup (v1.40.268)
 * - Removes document/page buttons from SIDEBAR subsection rows.
 * - Adds a document/page cycler to MAIN subsection rows: Profile and Work style.
 * - Applies Profile/Work style section-level page breaks in preview/print.
 * - Runs after the generic section-control normalizers, so it corrects stale injected controls.
 */
(function(){
  'use strict';
  const VERSION='1.40.268';
  if(window.__antcvSidebarMainSubsectionCleanup268===VERSION) return;
  window.__antcvSidebarMainSubsectionCleanup268=VERSION;

  const STORE='antcv:mainSubsectionPages.v1';
  const SECTIONS_KEY='sections';
  const PAGE_MIN=1, PAGE_MAX=4;

  function clean(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function low(s){return clean(s).toLowerCase();}
  function meta(b){return low((b&&b.textContent||'')+' '+(b&&b.getAttribute&&b.getAttribute('title')||'')+' '+(b&&b.getAttribute&&b.getAttribute('aria-label')||''));}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));}
  function activeDoc(){try{const d=localStorage.getItem('doc');return d==='cl'||d==='cv'?d:'cv';}catch(_){return 'cv';}}
  function parse(raw,fallback){try{const v=JSON.parse(raw||'');return v&&typeof v==='object'?v:fallback;}catch(_){return fallback;}}
  function readStore(){return parse(localStorage.getItem(STORE),{});}
  function writeStore(v){try{localStorage.setItem(STORE,JSON.stringify(v||{}));}catch(_){}}
  function getPage(id){const s=readStore();const d=activeDoc();const n=Number(s[d]&&s[d][id]);return Number.isFinite(n)&&n>=PAGE_MIN&&n<=PAGE_MAX?n:1;}
  function setPage(id,n){const s=readStore();const d=activeDoc();if(!s[d]||typeof s[d]!=='object')s[d]={};s[d][id]=n;writeStore(s);}
  function dispatch(id,page){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'main-subsection-page-268',section:id,page:page}}));}catch(_){} try{window.dispatchEvent(new CustomEvent('antcv:main-subsection-page-changed',{detail:{section:id,page:page}}));}catch(_){} try{window.dispatchEvent(new Event('input'));}catch(_){} }

  function isDocPageButton(b){
    const t=meta(b), text=clean(b&&b.textContent||'');
    return /📄/.test(text)||/document page|start.*page|page\s*[1-4]|\bpage\b/.test(t)&&/^\s*(📄|▦|□)?\s*[1-4]?\s*$/.test(text.replace(/\s/g,''));
  }
  function rowText(row){return low(row&&row.textContent||'').replace(/\(main\)|\(sidebar\)/g,'');}
  function rowId(row){const t=rowText(row);if(/^\s*profile\b/.test(t))return 'profile';if(/^\s*work style\b|^\s*workstyle\b/.test(t))return 'work_style';return '';}
  function rows(loc){return Array.from(document.querySelectorAll('[data-section-row-loc="'+loc+'"]')).filter(function(r){return visible(r)&&!r.querySelector('[data-candidate-drop-loc]');});}

  function removeSidebarPageButtons(){
    rows('sidebar').forEach(function(row){
      Array.from(row.querySelectorAll('button')).forEach(function(b){
        if(isDocPageButton(b)||b.getAttribute('data-antcv-main-subsection-page-268')==='1'){
          try{b.remove();}catch(_){b.style.display='none';}
        }
      });
    });
  }

  function paintPageButton(btn,id){
    const p=getPage(id);
    btn.type='button';
    btn.textContent='📄 '+p;
    btn.setAttribute('data-antcv-main-subsection-page-268','1');
    btn.setAttribute('data-antcv-main-subsection',id);
    btn.setAttribute('data-antcv-control-kind-260','page');
    btn.title=(id==='profile'?'Profile':'Work style')+' starts on page '+p+'. Click to cycle page 1 to 4.';
    btn.setAttribute('aria-label',btn.title);
    btn.style.order='5';
  }

  function insertBeforeFirstControl(row,btn){
    const buttons=Array.from(row.querySelectorAll(':scope button, button')).filter(function(b){return b!==btn;});
    const host=(buttons[0]&&buttons[0].parentElement)||row;
    const first=buttons.find(function(b){return b.parentElement===host;})||null;
    if(first) host.insertBefore(btn,first); else host.appendChild(btn);
  }

  function ensureMainPageButtons(){
    rows('main').forEach(function(row){
      const id=rowId(row);
      if(!id) return;
      let btn=row.querySelector('button[data-antcv-main-subsection-page-268][data-antcv-main-subsection="'+id+'"]');
      if(!btn){
        btn=document.createElement('button');
        btn.addEventListener('click',function(ev){
          ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
          const next=getPage(id)>=PAGE_MAX?PAGE_MIN:getPage(id)+1;
          setPage(id,next);paintPageButton(btn,id);applyPreviewPageBreaks();dispatch(id,next);
        },true);
        insertBeforeFirstControl(row,btn);
      }
      paintPageButton(btn,id);
    });
  }

  function readSections(){return parse(localStorage.getItem(SECTIONS_KEY),{});}
  function sectionTitleMatches(sec,id){
    const title=low(sec&&sec.title||sec&&sec.name||'');
    const type=low(sec&&sec.type||'');
    if(id==='profile') return title==='profile'||type==='profile'||/\bprofile\b/.test(title);
    if(id==='work_style') return title==='work style'||title==='workstyle'||type==='work_style'||/\bwork style\b|\bworkstyle\b/.test(title);
    return false;
  }
  function currentSectionSid(id){
    const env=readSections();const list=Array.isArray(env[activeDoc()])?env[activeDoc()]:[];
    for(const sec of list){if(sectionTitleMatches(sec,id))return sec&&sec.id?String(sec.id):'';}
    return '';
  }
  function previewPapers(){return Array.from(document.querySelectorAll('.cv-preview, .preview, [data-antcv-preview], [data-antcv-paper], .paper, main')).filter(visible);}
  function findPreviewSection(id){
    const sid=currentSectionSid(id);
    if(sid){const bySid=document.querySelector('[data-sid="'+CSS.escape(sid)+'"]');if(bySid)return bySid;}
    const re=id==='profile'?/^profile\b/i:/^work\s*style\b|^workstyle\b/i;
    const candidates=[];
    previewPapers().forEach(function(p){
      Array.from(p.querySelectorAll('[data-sid], section, article, div')).forEach(function(el){
        if(candidates.length>8) return;
        const h=el.querySelector('[data-antcv-section-heading], h1,h2,h3,h4,[role="heading"]');
        const ht=clean(h&&h.textContent||'');
        if(re.test(ht)) candidates.push(el);
      });
    });
    return candidates[0]||null;
  }
  function makeBreak(){
    const div=document.createElement('div');
    div.setAttribute('data-antcv-main-subsection-page-break-268','1');
    div.setAttribute('aria-hidden','true');
    div.style.pageBreakBefore='always';
    div.style.breakBefore='page';
    div.style.height='0';div.style.margin='0';div.style.padding='0';div.style.lineHeight='0';
    return div;
  }
  function clearPreviewBreaks(){
    Array.from(document.querySelectorAll('[data-antcv-main-subsection-page-break-268="1"]')).forEach(function(n){try{n.remove();}catch(_){}});
  }
  function applyPreviewPageBreaks(){
    clearPreviewBreaks();
    ['profile','work_style'].forEach(function(id){
      const p=getPage(id);if(p<2)return;
      const sec=findPreviewSection(id);if(!sec||!sec.parentNode)return;
      sec.parentNode.insertBefore(makeBreak(),sec);
    });
  }

  function injectCss(){
    if(document.getElementById('antcv-sidebar-main-subsection-cleanup-268-css')) return;
    const s=document.createElement('style');
    s.id='antcv-sidebar-main-subsection-cleanup-268-css';
    s.textContent=`
      [data-section-row-loc="sidebar"] button[data-antcv-main-subsection-page-268],
      [data-section-row-loc="sidebar"] button[data-antcv-control-kind-260="page"] { display:none !important; }
      button[data-antcv-main-subsection-page-268="1"]{
        order:5 !important; flex:0 0 auto !important;
        min-width:27px !important; width:auto !important; height:23px !important; min-height:23px !important;
        padding:1px 4px !important; margin-left:3px !important; box-sizing:border-box !important;
        border:1px solid #bbb !important; border-radius:5px !important; background:#f8f8f8 !important;
        color:#555 !important; font-size:11px !important; line-height:1 !important;
        display:inline-flex !important; align-items:center !important; justify-content:center !important;
      }
    `;
    (document.head||document.documentElement).appendChild(s);
  }

  let pending=false;
  function run(){
    if(pending)return;pending=true;
    requestAnimationFrame(function(){pending=false;try{injectCss();removeSidebarPageButtons();ensureMainPageButtons();applyPreviewPageBreaks();}catch(e){try{console.warn('[sidebar-main-subsection-cleanup-268]',e&&e.message);}catch(_){}}});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',run); else run();
  [80,200,500,1000,2000,4000].forEach(function(ms){setTimeout(run,ms);});
  try{new MutationObserver(run).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','title','aria-label']});}catch(_){ }
  window.addEventListener('antcv:sections-updated',run);
  window.addEventListener('antcv:main-subsection-page-changed',run);
  window.addEventListener('click',function(){setTimeout(run,0);},true);
  window.AntcvSidebarMainSubsectionCleanup268={version:VERSION,run:run};
})();
