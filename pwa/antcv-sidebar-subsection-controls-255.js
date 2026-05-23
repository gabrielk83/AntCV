/* AntCV sidebar sub-section row controls (v1.40.265)
 * - Keeps sidebar move-to-next-section triangle controls.
 * - Adds missing Publications & Patent sidebar Enhance and Compress controls.
 * - Normalises sidebar row order left-to-right: move, compress, enhance, visibility, delete.
 * - Publications Compress updates only publication/patent descriptive fields, not names/titles.
 */
(function(){
  'use strict';
  const VERSION='1.40.265';
  if(window.__antcvSidebarSubsectionControls===VERSION) return;
  window.__antcvSidebarSubsectionControls=VERSION;

  const SECTION_NAMES=[
    'TOOLS & METHODS','CERTIFICATIONS','EDUCATION','PUBLICATIONS & PATENT','PUBLICATIONS AND PATENT','REGULATORY CONTEXT','ADDITIONAL INFORMATION'
  ];
  const SECTIONS_KEY='sections';

  function norm(s){return String(s||'').replace(/\s+/g,' ').trim();}
  function low(s){return norm(s).toLowerCase();}
  function txt(el){return low((el&&((el.textContent||'')+' '+(el.getAttribute&&el.getAttribute('title')||'')+' '+(el.getAttribute&&el.getAttribute('aria-label')||'')))||'');}
  function activeDoc(){try{const d=localStorage.getItem('doc');return (d==='cl'||d==='cv')?d:'cv';}catch(_){return 'cv';}}
  function safeParse(raw,f){try{if(!raw)return f;const v=JSON.parse(raw);return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function readSectionsEnvelope(){return safeParse(localStorage.getItem(SECTIONS_KEY),{});}
  function writeSectionsEnvelope(env){try{localStorage.setItem(SECTIONS_KEY,JSON.stringify(env||{}));}catch(_){}}
  function dispatchUpdate(source,detail){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:Object.assign({source},detail||{})}));}catch(_){} try{window.dispatchEvent(new Event('input'));}catch(_){} }

  function rowTitle(row){
    const upper=norm(row&&row.textContent).toUpperCase();
    return SECTION_NAMES.find(function(n){return upper.indexOf(n)>=0;})||'';
  }
  function isPub(row){const t=rowTitle(row);return t.indexOf('PUBLICATIONS')>=0&&t.indexOf('PATENT')>=0;}
  function isHeaderPanel(row){return !!(row&&row.querySelector&&row.querySelector('[data-candidate-drop-loc]'));}
  function findRows(){
    const rows=[];
    Array.from(document.querySelectorAll('button')).forEach(function(btn){
      let p=btn.parentElement;
      for(let i=0;i<6&&p;i++,p=p.parentElement){
        if(!p||p===document.body||isHeaderPanel(p)) continue;
        const name=rowTitle(p);
        if(name&&rows.indexOf(p)<0){rows.push(p);break;}
      }
    });
    return rows.filter(function(r){
      return !rows.some(function(o){return o!==r&&o.contains(r)&&rowTitle(o)===rowTitle(r);});
    });
  }

  function isDelete(b){const t=txt(b);return t==='x'||t==='×'||/\b(delete|remove)\b/.test(t);}
  function isOn(b){const t=txt(b);return /^\s*on\s*$/.test(t)||/\btoggle\b|visible|enabled/.test(t);}
  function isEnhance(b){const t=txt(b);return /enhance|enrich|enr\.?|enh\.?|✨/.test(t);}
  function isCompress(b){const t=txt(b);return /compress|comp\.?|⇥⇤|⇤⇥|↹|↔/.test(t)&&!isPageMove(b);}
  function isDocPageNumber(b){const t=txt(b);return (/📄|document/.test(t)&&/\b[1-4]\b/.test(t))||/^\s*[📄▦□]*\s*[1-4]\s*$/.test(norm(b.textContent||''));}
  function isPageMove(b){
    const raw=norm((b.textContent||'')+' '+(b.getAttribute('title')||'')+' '+(b.getAttribute('aria-label')||''));
    const t=low(raw);
    if(isDocPageNumber(b)) return false;
    if(/headline alignment|alignment|cjlr|compress|enhance|enrich|delete|remove|toggle|visible/.test(t)) return false;
    if(/\b(move|send|push|place)\b.*\b(page|next page|previous page)\b|\b(page move|page break|next page|previous page)\b/.test(t)) return true;
    const glyph=norm(b.textContent||'');
    return /^[←↢↤◀◁‹‹«]$/.test(glyph) || /^[←↢↤◀◁‹«]\s*$/.test(glyph);
  }
  function kind(b){
    if(isPageMove(b)) return 'move';
    if(isDocPageNumber(b)) return 'docPage';
    if(isEnhance(b)) return 'enhance';
    if(isCompress(b)) return 'compress';
    if(isOn(b)) return 'on';
    if(isDelete(b)) return 'delete';
    return '';
  }

  function compressText(v){
    let s=String(v||'').replace(/\s+/g,' ').replace(/\s+([,.;:])/g,'$1').trim();
    s=s.replace(/\b(published in|publication in)\b/ig,'in');
    s=s.replace(/\bpatent number\b/ig,'patent');
    s=s.replace(/\bapproximately\b/ig,'approx.');
    s=s.replace(/\bwith details about\b/ig,'on');
    return s;
  }
  function isNameKey(k){return /^(name|title|publicationName|patentName)$/i.test(k||'')||/(^|_)(name|title)$/i.test(k||'');}
  function isDetailKey(k){return /(detail|description|journal|venue|year|patent|meta|subtitle|text|body|content)/i.test(k||'')&&!isNameKey(k);}
  function compressPublicationValue(item){
    let changed=false;
    if(!item||typeof item!=='object') return changed;
    Object.keys(item).forEach(function(k){
      const v=item[k];
      if(typeof v==='string'&&isDetailKey(k)){
        const n=compressText(v);
        if(n!==v){item[k]=n;changed=true;}
      }else if(v&&typeof v==='object'&&!Array.isArray(v)){
        Object.keys(v).forEach(function(kk){
          if(typeof v[kk]==='string'&&isDetailKey(kk)&&!isNameKey(kk)){
            const n=compressText(v[kk]);
            if(n!==v[kk]){v[kk]=n;changed=true;}
          }
        });
      }
    });
    return changed;
  }
  function compressPublicationsSection(){
    const env=readSectionsEnvelope();
    const doc=activeDoc();
    const list=Array.isArray(env[doc])?env[doc]:[];
    let changed=false;
    list.forEach(function(sec){
      const sTxt=low((sec&&sec.type||'')+' '+(sec&&sec.title||''));
      if(!sec||sTxt.indexOf('publication')<0&&sTxt.indexOf('patent')<0) return;
      ['items','rows','entries','bullets'].forEach(function(key){
        if(Array.isArray(sec[key])) sec[key].forEach(function(item){ if(compressPublicationValue(item)) changed=true; });
      });
      if(sec.data&&typeof sec.data==='object') ['items','rows','entries','bullets'].forEach(function(key){
        if(Array.isArray(sec.data[key])) sec.data[key].forEach(function(item){ if(compressPublicationValue(item)) changed=true; });
      });
    });
    if(changed){writeSectionsEnvelope(env);dispatchUpdate('publications-sidebar-compress',{doc});}
    else dispatchUpdate('publications-sidebar-compress-noop',{doc});
  }

  function makeCompressButton(){
    const b=document.createElement('button');
    b.type='button';
    b.textContent='⇥⇤';
    b.title='Compress Publications & Patent descriptions';
    b.setAttribute('aria-label',b.title);
    b.setAttribute('data-antcv-sidebar-pub-compress','1');
    b.addEventListener('click',function(ev){
      ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
      compressPublicationsSection();
    },true);
    return b;
  }

  function hostFor(row){
    const bs=Array.from(row.querySelectorAll(':scope button'));
    const on=bs.find(isOn), del=bs.find(isDelete), enh=bs.find(isEnhance), doc=bs.find(isDocPageNumber);
    return (doc&&doc.parentElement)||(enh&&enh.parentElement)||(on&&on.parentElement)||(del&&del.parentElement)||row;
  }

  function enhancePublicationText(v){
    const s=String(v||'').replace(/\s+/g,' ').trim();
    if(!s) return s;
    // Safe, local polish only. The row-level AI enhance remains handled inside the subsubsection.
    return s.replace(/\bno\.\b/ig,'number').replace(/\bdept\.\b/ig,'department');
  }
  function enhancePublicationValue(item){
    let changed=false;
    if(!item||typeof item!=='object') return changed;
    Object.keys(item).forEach(function(k){
      const v=item[k];
      if(typeof v==='string'&&isDetailKey(k)){
        const n=enhancePublicationText(v);
        if(n!==v){item[k]=n;changed=true;}
      }else if(v&&typeof v==='object'&&!Array.isArray(v)){
        Object.keys(v).forEach(function(kk){
          if(typeof v[kk]==='string'&&isDetailKey(kk)&&!isNameKey(kk)){
            const n=enhancePublicationText(v[kk]);
            if(n!==v[kk]){v[kk]=n;changed=true;}
          }
        });
      }
    });
    return changed;
  }
  function enhancePublicationsSection(){
    const env=readSectionsEnvelope();
    const doc=activeDoc();
    const list=Array.isArray(env[doc])?env[doc]:[];
    let changed=false;
    list.forEach(function(sec){
      const sTxt=low((sec&&sec.type||'')+' '+(sec&&sec.title||''));
      if(!sec||sTxt.indexOf('publication')<0&&sTxt.indexOf('patent')<0) return;
      ['items','rows','entries','bullets'].forEach(function(key){
        if(Array.isArray(sec[key])) sec[key].forEach(function(item){ if(enhancePublicationValue(item)) changed=true; });
      });
      if(sec.data&&typeof sec.data==='object') ['items','rows','entries','bullets'].forEach(function(key){
        if(Array.isArray(sec.data[key])) sec.data[key].forEach(function(item){ if(enhancePublicationValue(item)) changed=true; });
      });
    });
    if(changed){writeSectionsEnvelope(env);dispatchUpdate('publications-sidebar-enhance',{doc});}
    else dispatchUpdate('publications-sidebar-enhance-noop',{doc});
  }

  function makeEnhanceButton(){
    const b=document.createElement('button');
    b.type='button';
    b.textContent='✨';
    b.title='Enhance Publications & Patent descriptions';
    b.setAttribute('aria-label',b.title);
    b.setAttribute('data-antcv-sidebar-pub-enhance','1');
    b.addEventListener('click',function(ev){
      ev.preventDefault();ev.stopPropagation();if(ev.stopImmediatePropagation)ev.stopImmediatePropagation();
      enhancePublicationsSection();
    },true);
    return b;
  }

  function ensurePubCompress(row){
    if(!isPub(row)) return;
    if(Array.from(row.querySelectorAll('button')).some(function(b){return isCompress(b);})) return;
    const h=hostFor(row);
    const b=makeCompressButton();
    const enh=Array.from(h.querySelectorAll(':scope button')).find(isEnhance);
    const on=Array.from(h.querySelectorAll(':scope button')).find(isOn);
    if(enh) h.insertBefore(b,enh); else if(on) h.insertBefore(b,on); else h.appendChild(b);
  }
  function ensurePubEnhance(row){
    if(!isPub(row)) return;
    if(Array.from(row.querySelectorAll('button')).some(function(b){return isEnhance(b);})) return;
    const h=hostFor(row);
    const b=makeEnhanceButton();
    const on=Array.from(h.querySelectorAll(':scope button')).find(isOn);
    if(on) h.insertBefore(b,on); else h.appendChild(b);
  }
  function normalizeRow(row){
    row.setAttribute('data-antcv-sidebar-subsection-row','1');
    if(isPub(row)) row.setAttribute('data-antcv-sidebar-publications-row','1');
    Array.from(row.querySelectorAll('button')).forEach(function(b){
      const k=kind(b);
      if(k) b.setAttribute('data-antcv-sidebar-button-kind',k);
    });
    ensurePubCompress(row);
    ensurePubEnhance(row);
    Array.from(row.querySelectorAll('button')).forEach(function(b){
      const k=kind(b)||b.getAttribute('data-antcv-sidebar-button-kind')||'';
      if(!k) return;
      b.setAttribute('data-antcv-sidebar-button-kind',k);
      if(k==='move') b.style.order='10';
      if(k==='compress') { b.style.order='20'; b.textContent='⇥⇤'; b.title=b.title||'Compress'; b.setAttribute('aria-label',b.getAttribute('aria-label')||b.title); }
      if(k==='enhance') b.style.order='30';
      if(k==='on') b.style.order='40';
      if(k==='delete') b.style.order='50';
    });
  }

  function injectCss(){
    if(document.getElementById('antcv-sidebar-subsection-controls-255-css')) return;
    const s=document.createElement('style');
    s.id='antcv-sidebar-subsection-controls-255-css';
    s.textContent=`
      [data-antcv-sidebar-subsection-row="1"] { overflow: visible !important; }
      [data-antcv-sidebar-subsection-row="1"] button[data-antcv-sidebar-button-kind] { flex: 0 0 auto !important; }
      [data-antcv-sidebar-subsection-row="1"] button[data-antcv-sidebar-button-kind="move"] { order: 10 !important; }
      [data-antcv-sidebar-subsection-row="1"] button[data-antcv-sidebar-button-kind="compress"] { order: 20 !important; border-color:#7b2ff2 !important; color:#7b2ff2 !important; background:rgba(123,47,242,.06) !important; }
      [data-antcv-sidebar-subsection-row="1"] button[data-antcv-sidebar-button-kind="enhance"] { order: 30 !important; }
      [data-antcv-sidebar-subsection-row="1"] button[data-antcv-sidebar-button-kind="on"] { order: 40 !important; }
      [data-antcv-sidebar-subsection-row="1"] button[data-antcv-sidebar-button-kind="delete"] { order: 50 !important; }
      [data-antcv-sidebar-subsection-row="1"] button[data-antcv-sidebar-button-kind="compress"],
      [data-antcv-sidebar-pub-compress="1"] { width:23px !important; min-width:23px !important; height:23px !important; min-height:23px !important; padding:1px 3px !important; margin-left:3px !important; border:1px solid #7b2ff2 !important; border-radius:5px !important; background:rgba(123,47,242,.06) !important; color:#7b2ff2 !important; font-size:12px !important; font-weight:700 !important; line-height:1 !important; box-sizing:border-box !important; }
      [data-antcv-sidebar-pub-enhance="1"] { width:23px !important; min-width:23px !important; height:23px !important; min-height:23px !important; padding:1px 3px !important; margin-left:3px !important; border:1px solid #02b889 !important; border-radius:5px !important; background:rgba(2,184,137,.06) !important; color:#00746E !important; font-size:12px !important; font-weight:700 !important; line-height:1 !important; box-sizing:border-box !important; }
    `;
    (document.head||document.documentElement).appendChild(s);
  }
  let pending=false;
  function run(){
    injectCss();
    findRows().forEach(normalizeRow);
  }
  function schedule(){if(pending)return;pending=true;requestAnimationFrame(function(){pending=false;try{run();}catch(e){try{console.warn('[sidebar-subsection-controls-255]',e&&e.message);}catch(_){}}});}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',schedule); else schedule();
  [100,250,600,1200,2400,4000].forEach(function(ms){setTimeout(schedule,ms);});
  try{new MutationObserver(schedule).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','title','aria-label']});}catch(_){ }
  window.addEventListener('antcv:sections-updated',schedule);
})();
