/* AntCV single-paragraph subsection controls (v1.40.248)
 * Adds Page and CJLR on the actual sidebar/main panel rows for:
 * CL: Greeting, Opening, WHO I AM, WHY THIS POSITION, FOUNDATION, Closure.
 * CV: Profile, Work style.
 * Strictly excludes export/PDF/DOCX toolbar rows.
 */
(function(){
  'use strict';
  const VERSION='1.40.248';
  const ALIGN_KEY='antcv.singleSection.alignment.v1';
  const PAGE_KEY='antcv.singleSection.pageShift.v1';
  const ALIGN=['center','justify','left','right'];
  const ICON={left:'⇤',center:'↔',justify:'☰',right:'⇥'};
  const LABEL={left:'Left aligned',center:'Centered',justify:'Justified',right:'Right aligned'};
  const TARGETS=[
    {id:'greeting', names:['greeting','greetings']},
    {id:'opening', names:['opening']},
    {id:'who_i_am', names:['who i am','whoiam','who_i_am']},
    {id:'what_i_bring', names:['what i bring','what_i_bring']},
    {id:'why_this_position', names:['why this position','why this role','why_this_position']},
    {id:'how_i_would_contribute', names:['how i would contribute','how_i_would_contribute']},
    {id:'foundation', names:['foundation','fundation']},
    {id:'closure', names:['closure','closing']},
    {id:'profile', names:['profile']},
    {id:'work_style', names:['work style','workstyle','work_style']}
  ];
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const low=s=>clean(s).toLowerCase().replace(/\(main\)/g,'').trim();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  function readJson(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function readAlign(){return readJson(ALIGN_KEY,{});}  
  function readPages(){return readJson(PAGE_KEY,{});}  
  function getAlign(id){const v=readAlign()[id];return ALIGN.includes(v)?v:'left';}
  function setAlign(id,v){const m=readAlign();m[id]=v;writeJson(ALIGN_KEY,m);}  
  function nextAlign(v){return ALIGN[(Math.max(0,ALIGN.indexOf(v))+1)%ALIGN.length];}
  function getPage(id){const n=Number(readPages()[id]||1);return Number.isFinite(n)&&n>=1?Math.min(4,Math.max(1,Math.round(n))):1;}
  function setPage(id,n){const m=readPages();const nn=Math.min(4,Math.max(1,Math.round(Number(n)||1)));if(nn<=1)delete m[id];else m[id]=nn;writeJson(PAGE_KEY,m);pulse();}
  function pulse(){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'single-section-controls',version:VERSION}}));}catch(_){} try{window.dispatchEvent(new CustomEvent('antcv:item-pages-changed',{detail:{source:'single-section-controls',version:VERSION}}));}catch(_){}}
  function targetFromText(text){
    const raw=low(text)
      .replace(/\(main\)/g,' ')
      .replace(/ON|OFF|NEW|×|x|📄|✨|↹|⇤|⇥|↔|☰|\+/gi,' ')
      .replace(/\s+/g,' ')
      .trim();
    if(!raw) return null;
    // Prefer the first known section title that appears in the row. Panel rows often
    // contain only the title plus button labels, while previous code picked the
    // shortest child text and missed the title entirely.
    for(const x of TARGETS){
      for(const n of x.names){
        if(raw===n || raw.startsWith(n+' ') || raw.includes(' '+n+' ') || raw.includes(n)) return x;
      }
    }
    return null;
  }
  function targetFromAttrs(el){
    const a=[el&&el.getAttribute&&el.getAttribute('data-sid'),el&&el.getAttribute&&el.getAttribute('data-section-id'),el&&el.id,el&&el.className].map(x=>String(x||'')).join(' ').toLowerCase();
    if(/why[_-]?this[_-]?position/.test(a))return TARGETS.find(x=>x.id==='why_this_position');
    if(/who[_-]?i[_-]?am/.test(a))return TARGETS.find(x=>x.id==='who_i_am');
    if(/what[_-]?i[_-]?bring/.test(a))return TARGETS.find(x=>x.id==='what_i_bring');
    if(/how[_-]?i[_-]?would[_-]?contribute/.test(a))return TARGETS.find(x=>x.id==='how_i_would_contribute');
    if(/work[_-]?style/.test(a))return TARGETS.find(x=>x.id==='work_style');
    for(const x of TARGETS){ if(x.names.some(n=>a.includes(n.replace(/ /g,'_'))||a.includes(n.replace(/ /g,'-'))||a.includes(n))) return x; }
    return null;
  }
  function isOn(b){return /^\s*ON\s*$/i.test(b.textContent||'');}
  function isDelete(b){return /^\s*[×x]\s*$/i.test(b.textContent||'')||/delete|remove/i.test((b.title||'')+' '+(b.getAttribute('aria-label')||''));}
  function rowButtons(row){return Array.from(row.querySelectorAll('button')).filter(visible);}
  function exportLike(el){
    const t=low(el&&el.textContent||'');
    return /pdf|docx|preview|candidate|cand\./i.test(t) && !rowButtons(el).some(isOn);
  }
  function titleFromRow(row){
    const clone=row.cloneNode(true);
    try{ clone.querySelectorAll('button,[role="button"],[data-antcv-single-section-page],[data-antcv-single-section-cjlr]').forEach(n=>n.remove()); }catch(_){}
    let t=clean(clone.textContent||row.textContent||'');
    t=t.replace(/\bON\b|\bOFF\b|×|x|📄|✨|↹|⇤|⇥|↔|☰|\+/gi,' ').replace(/\s+/g,' ').trim();
    return t;
  }
  function nearestPanelRow(btn){
    let p=btn&&btn.parentElement;
    for(let d=0;p&&d<7;d++,p=p.parentElement){
      if(exportLike(p)) continue;
      const bs=rowButtons(p);
      if(bs.some(isOn)&&bs.some(isDelete)){
        const tgt=targetFromText(titleFromRow(p));
        if(tgt) return {row:p,target:tgt};
      }
    }
    return null;
  }
  function panelRows(){
    const out=[];
    document.querySelectorAll('button').forEach(b=>{
      if(!isOn(b) && !isDelete(b)) return;
      const found=nearestPanelRow(b);
      if(found && !out.some(x=>x.row===found.row)) out.push(found);
    });
    return out;
  }
  function controlParent(row){
    const on=rowButtons(row).find(isOn), del=rowButtons(row).find(isDelete);
    if(on&&del&&on.parentElement===del.parentElement)return on.parentElement;
    return (on&&on.parentElement)||(del&&del.parentElement)||row;
  }
  function refButton(row){const parent=controlParent(row);return Array.from(parent.querySelectorAll('button')).filter(visible).find(isDelete)||Array.from(parent.querySelectorAll('button')).filter(visible).find(isOn)||rowButtons(row)[0]||null;}
  function makeBtn(kind,label,title,ref){
    const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.setAttribute('data-antcv-single-section-'+kind,'1');
    const r=ref&&ref.getBoundingClientRect?ref.getBoundingClientRect():null;const w=Math.max(22,Math.round((r&&r.width)||24));const h=Math.max(22,Math.round((r&&r.height)||24));
    Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:w+'px',minWidth:w+'px',height:h+'px',minHeight:h+'px',padding:'0',margin:'0 2px',border:'1px solid #01B7BB',borderRadius:'5px',background:'rgba(1,183,187,.08)',color:'#00746E',fontWeight:'700',fontSize:'11px',lineHeight:'1',cursor:'pointer',pointerEvents:'auto',boxSizing:'border-box'});
    return b;
  }
  function labelFor(id){return (TARGETS.find(x=>x.id===id)||{}).names?.[0]||id;}
  function paintPage(b,id){const p=getPage(id);b.textContent='📄 '+p;b.title='Start '+labelFor(id)+' on page '+p+'. Click to cycle page 1-4.';b.setAttribute('aria-label',b.title);}  
  function paintCJLR(b,id){const a=getAlign(id);b.textContent=ICON[a]||ICON.left;b.title=labelFor(id)+' alignment: '+(LABEL[a]||a)+'. Click to cycle Center, Justify, Left, Right.';b.setAttribute('aria-label',b.title);}  
  function ensurePanelControls(row,target){
    const id=target.id;
    if(exportLike(row)) return;
    const parent=controlParent(row);
    const ref=refButton(row);
    // Remove misplaced/wrong-id controls inside this row, then ensure exactly one Page and one CJLR.
    row.querySelectorAll('button[data-antcv-single-section-page="1"]').forEach(b=>{if(b.getAttribute('data-antcv-section-id')!==id)b.remove();});
    row.querySelectorAll('button[data-antcv-single-section-cjlr="1"]').forEach(b=>{if(b.getAttribute('data-antcv-section-id')!==id)b.remove();});
    // v1.40.248: no Page button at sidebar/subsection level. Page shifts belong
    // inside sub-sub-sections, not on the collapsed sidebar section row.
    row.querySelectorAll('button[data-antcv-single-section-page="1"]').forEach(b=>b.remove());
    let cjlr=row.querySelector('button[data-antcv-single-section-cjlr="1"][data-antcv-section-id="'+id+'"]');
    if(!cjlr){cjlr=makeBtn('cjlr','⇤','Alignment',ref);cjlr.setAttribute('data-antcv-section-id',id);}
    const existing=Array.from(parent.querySelectorAll('button')).filter(visible).filter(b=>b!==cjlr);
    const firstAction=existing.find(b=>/enrich|enhance|compress|comp|✨|↹/i.test((b.title||'')+' '+(b.textContent||''))) || existing.find(isOn) || existing.find(isDelete);
    if(firstAction) parent.insertBefore(cjlr,firstAction); else parent.appendChild(cjlr);
    paintCJLR(cjlr,id);
    cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const n=nextAlign(getAlign(id));setAlign(id,n);paintCJLR(cjlr,id);applyEditors();applyPreview();pulse();};
  }
  function editorBlocks(){
    const blocks=[];
    document.querySelectorAll('textarea,input[type="text"], [contenteditable="true"]').forEach(el=>{
      if(!visible(el)||el.closest('button'))return;
      let p=el.parentElement, target=null, host=null;
      for(let d=0;p&&d<9;d++,p=p.parentElement){ target=targetFromAttrs(p)||targetFromText(p.textContent); if(target){host=p;break;} }
      if(target&&host&&!blocks.some(x=>x.el===el)) blocks.push({el,target,host});
    });
    return blocks;
  }
  function applyEditors(){editorBlocks().forEach(({el,target})=>{const a=getAlign(target.id);el.style.textAlign=a;el.setAttribute('data-antcv-single-section-align',a);});}
  function previewSection(target){
    const id=target.id;
    const tries=[`[data-sid="${CSS.escape(id)}"]`,`[data-section-id="${CSS.escape(id)}"]`,`section[data-sid="${CSS.escape(id)}"]`];
    if(id==='work_style')tries.push('[data-sid="workstyle"]','[data-section-id="workstyle"]');
    if(id==='why_this_position')tries.push('[data-sid="why-this-position"]','[data-section-id="why-this-position"]');
    if(id==='what_i_bring')tries.push('[data-sid="what-i-bring"]','[data-section-id="what-i-bring"]');
    if(id==='how_i_would_contribute')tries.push('[data-sid="how-i-would-contribute"]','[data-section-id="how-i-would-contribute"]');
    if(id==='greeting')tries.push('[data-sid="greetings"]','[data-section-id="greetings"]');
    for(const s of tries){const el=document.querySelector(s);if(el)return el;}
    const cands=Array.from(document.querySelectorAll('[data-sid],[data-section-id],section,article,div')).filter(visible);
    return cands.find(el=>targetFromAttrs(el)?.id===id || targetFromText((el.querySelector('h1,h2,h3,h4,strong,b')||el).textContent)?.id===id) || null;
  }
  function contentTargets(root,target){
    if(!root)return[];
    return Array.from(root.querySelectorAll('p,li,div,span,[data-edit-path],[data-antcv-row-path]')).filter(el=>{
      if(!visible(el)||el.closest('button'))return false;
      const t=clean(el.textContent); if(!t||t.length<4)return false;
      if(targetFromText(t)?.id===target.id && t.length<80)return false;
      if(el.querySelector('input,textarea'))return false;
      return true;
    });
  }
  function contHeader(target){
    const h=document.createElement('div');h.setAttribute('data-antcv-single-section-page-break','1');
    h.textContent=labelFor(target.id).toUpperCase()+' (CONT.)';
    Object.assign(h.style,{breakBefore:'page',pageBreakBefore:'always',color:'#00746E',fontWeight:'700',fontSize:'12pt',marginTop:'4pt',marginBottom:'8pt',borderBottom:'1pt solid #00746E',paddingBottom:'2pt'});
    return h;
  }
  function applyPreview(){
    document.querySelectorAll('[data-antcv-single-section-page-break="1"]').forEach(n=>n.remove());
    TARGETS.forEach(target=>{
      const root=previewSection(target); if(!root)return;
      const a=getAlign(target.id);
      contentTargets(root,target).forEach(el=>{el.style.textAlign=a;el.setAttribute('data-antcv-single-section-preview-align',a);});
      if(getPage(target.id)>1&&root.parentNode) root.parentNode.insertBefore(contHeader(target),root);
    });
  }
  function cleanupMisplacedExportControls(){
    document.querySelectorAll('button[data-antcv-single-section-page="1"],button[data-antcv-single-section-cjlr="1"]').forEach(b=>{
      let p=b.parentElement;
      for(let d=0;p&&d<4;d++,p=p.parentElement){
        const t=low(p.textContent||'');
        if(/pdf|docx|cl preview|cv preview/.test(t) && !rowButtons(p).some(isOn)){ try{b.remove();}catch(_){b.style.display='none';} break; }
      }
    });
  }
  let pending=false;
  function run(){
    if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;try{cleanupMisplacedExportControls();panelRows().forEach(x=>ensurePanelControls(x.row,x.target));applyEditors();applyPreview();}catch(e){try{console.warn('[single-section-controls-248] failed:',e&&e.message);}catch(_){}}});
  }
  function start(){run();[100,300,800,1600,3000,5000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(run).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){}window.addEventListener('input',run,true);window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('antcv:sections-updated',run);setInterval(run,2000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvSingleSectionControls248={version:VERSION,run};
})();
