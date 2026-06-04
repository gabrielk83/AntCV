/* AntCV How I Would Contribute controls (v1.40.245)
 * - Converts the Bullets textarea into editable bullet rows in the panel.
 * - Adds page, compress, enrich and CJLR controls to Intro, bullet rows and Closing lines.
 * - Removes duplicate left-side CJLR buttons in What I Bring/Core Competencies; keeps the right-side controls.
 */
(function(){
  'use strict';
  const VERSION='1.50.100-bullet-model';
  let __applying=false; // v1.50.57: re-entrancy guard so our own DOM writes don't re-trigger the observer/flicker.
  const ALIGN_KEY='antcv.hiwc.alignment.v1';
  const PAGE_KEY='antcv:itemPages';
  const SECTIONS_KEY='sections';
  const RX=/how\s+i\s+would\s+contribute/i;
  const CORE_RX=/what\s+i\s+bring|core\s+competenc/i;
  const ALIGN=['center','justify','left','right'];
  const ICON={left:'⇤',center:'↔',justify:'☰',right:'⇥'};
  const LABEL={left:'Left aligned',center:'Centered',justify:'Justified',right:'Right aligned'};
  const clean=s=>String(s||'').replace(/\s+/g,' ').trim();
  const visible=el=>!!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||el.getClientRects().length));
  // v1.40.245-preview-guard: Preview is button-free. All seeds and
  // host resolutions must reject elements inside .antcv-preview-paper.
  const isInPreviewPaper=el=>{if(!el)return false;const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');return !!(p&&p.contains(el));};
  function readJson(k,f){try{const v=JSON.parse(localStorage.getItem(k)||'');return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function writeJson(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function activeDoc(){try{return localStorage.getItem('doc')==='cv'?'cv':'cl';}catch(_){return 'cl';}}
  function sectionsObj(){return readJson(SECTIONS_KEY,null);}
  function sections(){const s=sectionsObj();const a=s&&s[activeDoc()];return Array.isArray(a)?a:[];}
  function sec(){return sections().find(s=>s&&RX.test(clean(s.title||s.name||s.id||'')))||null;}
  function sid(){const s=sec();return s&&s.id?String(s.id):'how_i_would_contribute';}
  function readAlign(){return readJson(ALIGN_KEY,{});}  
  function getAlign(k){const v=readAlign()[k];return ALIGN.includes(v)?v:'left';}
  function setAlign(k,v){const m=readAlign();m[k]=v;writeJson(ALIGN_KEY,m);}
  function nextAlign(v){return ALIGN[(Math.max(0,ALIGN.indexOf(v))+1)%ALIGN.length];}
  function readPages(){return readJson(PAGE_KEY,{});}
  function getPage(k){const all=readPages();const b=all[sid()]||all.how_i_would_contribute||{};const n=Number(b[k]||1);return Number.isFinite(n)&&n>=1?Math.min(4,Math.max(1,Math.round(n))):1;}
  function setPage(k,n){const all=readPages();const s=sid();if(!all[s]||typeof all[s]!=='object')all[s]={};const nn=Math.min(4,Math.max(1,Math.round(Number(n)||1)));if(nn<=1)delete all[s][k];else all[s][k]=nn;writeJson(PAGE_KEY,all);pulse();}

  function injectCss(){
    if(document.getElementById('antcv-hiwc-245-css'))return;
    const st=document.createElement('style');st.id='antcv-hiwc-245-css';st.textContent=`
      .antcv-hiwc-page,.antcv-hiwc-compress,.antcv-hiwc-enrich,.antcv-hiwc-cjlr,.antcv-hiwc-bullet-delete{width:22px!important;min-width:22px!important;max-width:22px!important;height:22px!important;min-height:22px!important;max-height:22px!important;padding:0!important;margin:0 1px!important;box-sizing:border-box!important;font-size:10px!important;line-height:1!important;}
      [data-antcv-hiwc-controls] { gap:2px!important; }
      [data-antcv-hiwc-bullet-row] input { height:22px!important; }
      [data-antcv-hiwc-bullet-list] { max-width:100%!important; overflow:hidden!important; box-sizing:border-box!important; }
      [data-antcv-hiwc-bullet-row] { max-width:100%!important; box-sizing:border-box!important; }
      [data-antcv-hiwc-closing-area] { min-height:44px!important; resize:vertical!important; line-height:1.15!important; }
      textarea[data-antcv-hiwc-field="bullets"] { display:block!important; min-height:96px!important; resize:vertical!important; line-height:1.3!important; width:100%!important; box-sizing:border-box!important; }
      [data-antcv-hiwc-list] { margin:2px 0 4px 0!important; padding-left:1.05em!important; list-style-position:outside!important; }
      [data-antcv-hiwc-list] > li { margin:0 0 2px 0!important; padding-left:0!important; }
    `;document.head&&document.head.appendChild(st);
  }
  function pulse(){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'how-contribute-controls',version:VERSION}}));}catch(_){} try{window.dispatchEvent(new CustomEvent('antcv:item-pages-changed',{detail:{source:'how-contribute-controls',version:VERSION}}));}catch(_){}}
  function dispatchInput(el){try{el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}catch(_){}}
  function getVal(f){return f?(f.isContentEditable?f.textContent:f.value)||'':'';}
  function setVal(f,v){if(!f)return;if(f.isContentEditable)f.textContent=v;else f.value=v;dispatchInput(f);}

  function root(){
    const fields=Array.from(document.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>!isInPreviewPaper(f));
    const seed=fields.find(f=>/intro\s*[—-]|closing\s*[—-]|one sentence framing|one sentence summar/i.test(String(f.value||f.placeholder||f.textContent||'')));
    if(!seed) return null;
    let p=seed.parentElement,best=null;
    for(let d=0;p&&d<10;d++,p=p.parentElement){
      if(isInPreviewPaper(p)) break;
      const txt=clean(p.textContent);
      if(/Intro line/i.test(txt)&&/Closing line/i.test(txt)&&/Bullets/i.test(txt)) best=p;
      if(RX.test(txt)){best=p;break;}
    }
    return best;
  }
  function allFields(r){return Array.from((r||document).querySelectorAll('input,textarea,[contenteditable="true"]')).filter(f=>visible(f)&&!isInPreviewPaper(f));}
  function findIntro(r){return allFields(r).find(f=>/intro\s*[—-]|one sentence framing/i.test(String(f.value||f.placeholder||f.textContent||'')))||allFields(r)[0]||null;}
  function findClosing(r){const fs=allFields(r);return fs.find(f=>/closing\s*[—-]|one sentence summar/i.test(String(f.value||f.placeholder||f.textContent||'')))||fs[fs.length-1]||null;}
  function findBullets(r){const intro=findIntro(r), closing=findClosing(r);return allFields(r).find(f=>f.tagName==='TEXTAREA'&&f!==intro&&f!==closing)||null;}

  function cleanupClosingHelperText(r){
    if(!r)return;
    const rx=/\s*[—-]?\s*appears\s+AFTER\s+bullets\s+as\s+a\s+separate\s+paragraph\s*\(e\.g\.\s*"[\s\S]*?"\)\.\s*This\s+is\s+NOT\s+a\s+bullet\.?/i;
    const walker=document.createTreeWalker(r,NodeFilter.SHOW_TEXT,null);
    const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(n=>{ if(rx.test(n.nodeValue||'')){ n.nodeValue=(n.nodeValue||'').replace(rx,'').replace(/Closing line\s*[—-]?\s*$/i,'Closing line').trimEnd(); }});
  }
  function ensureTextArea(f,k){
    if(!f||k!=='closing'||f.tagName==='TEXTAREA')return f;
    if(f.getAttribute('data-antcv-hiwc-hidden-source')==='1')return null;
    const old=f;
    let ta=old.parentElement&&old.parentElement.querySelector('textarea[data-antcv-hiwc-closing-area="1"]');
    if(!ta){
      ta=document.createElement('textarea');
      ta.setAttribute('data-antcv-hiwc-closing-area','1');
      ta.rows=2; ta.value=getVal(old); ta.placeholder=old.getAttribute('placeholder')||'Closing — one sentence summarising your contribution';
      Object.assign(ta.style,{flex:'1 1 auto',minWidth:'0',width:'100%',boxSizing:'border-box'});
      old.style.display='none'; old.setAttribute('data-antcv-hiwc-hidden-source','1');
      old.parentNode&&old.parentNode.insertBefore(ta,old.nextSibling);
      ta.addEventListener('input',()=>{setVal(old,ta.value);syncSectionField('closing',ta.value);applyPreview();},{passive:true});
      old.addEventListener('input',()=>{if(ta.value!==getVal(old))ta.value=getVal(old);},{passive:true});
    }
    return ta;
  }
  function labelFor(f){
    let p=f&&f.parentElement;
    for(let d=0;p&&d<3;d++,p=p.parentElement){const t=clean(p.textContent); if(/Intro line/i.test(t)) return 'intro'; if(/Closing line/i.test(t)) return 'closing';}
    return null;
  }
  function lineHost(f){
    let p=f&&f.parentElement,best=f&&f.parentElement;
    for(let d=0;p&&d<4;d++,p=p.parentElement){
      const fields=Array.from(p.querySelectorAll('input,textarea,[contenteditable="true"]')).filter(visible);
      if(fields.length===1){best=p;break;}
    }
    return best||f.parentElement;
  }
  function makeBtn(kind,label,title,ref){
    const b=document.createElement('button');b.type='button';b.className='antcv-hiwc-'+kind;b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.setAttribute('data-antcv-hiwc-'+kind,'1');
    const w=22,h=22;
    Object.assign(b.style,{display:'inline-flex',alignItems:'center',justifyContent:'center',width:w+'px',minWidth:w+'px',maxWidth:w+'px',height:h+'px',minHeight:h+'px',maxHeight:h+'px',padding:'0',margin:'0 1px',border:'1px solid #01B7BB',borderRadius:'4px',background:'rgba(1,183,187,.08)',color:'#00746E',fontWeight:'700',fontSize:'10px',lineHeight:'1',cursor:'pointer',pointerEvents:'auto',boxSizing:'border-box'});
    return b;
  }
  function paintCJLR(b,a){b.textContent=ICON[a]||ICON.left;b.title='Alignment: '+(LABEL[a]||a)+'. Click to cycle Center, Justify, Left, Right.';b.setAttribute('aria-label',b.title);}
  function paintPage(b,k){const p=getPage(k);b.textContent='📄 '+p;b.title='Start this line on page '+p+'. Click to cycle page 1-4.';b.setAttribute('aria-label',b.title);}
  const weak=[/\b(successfully\b\s*)/gi,/\b(effectively\b\s*)/gi,/\b(various\b\s*)/gi,/\bmultiple\b/gi,/\bin order to\b/gi,/\bwas responsible for\b/gi];
  function compressText(s){let t=clean(s);weak.forEach(rx=>t=t.replace(rx,''));t=t.replace(/\s*,\s*/g,', ').replace(/\s+/g,' ').trim();if(t.length>190){const parts=t.split(/(?<=[.!?])\s+/);if(parts[0]&&parts[0].length>50)t=parts[0];}return t;}
  function enrichText(s){const t=clean(s);if(!t)return t;if(/\b(because|so that|by|through|using|with)\b/i.test(t)||/\d/.test(t))return t;return t.replace(/[.!?]?$/,'')+' with clearer scope and expected value.';}
  function applyField(f,k){const a=getAlign(k);f.style.textAlign=a;f.setAttribute('data-antcv-hiwc-align',a);}
  function writeDocSpecificSections(doc,list){
    try{localStorage.setItem((doc==='cv'?'cv_pwa_sections':'cl_pwa_sections'),JSON.stringify(list));}catch(_){}
  }
  function syncSectionField(k,v){
    const all=sectionsObj();const doc=activeDoc();const list=all&&all[doc];if(!Array.isArray(list))return;
    const s=list.find(x=>x&&(String(x.id||'')===sid()||RX.test(clean(x.title||x.name||''))));if(!s)return;
    // v1.50.82 — idempotency. This wrote sections + pulse()d (antcv:sections-updated,
    // source 'how-contribute-controls') on EVERY call. pulse -> personality
    // forceRebuild -> app re-renders the section -> this sidecar re-runs -> writes
    // again: the residual re-render loop (and why HIWC was hard to type / the
    // preview bullets duplicated). Only write + pulse when the value changed.
    let changed=false;
    if(k==='intro'){const cur=('intro' in s)?s.intro:('introLine' in s?s.introLine:undefined);if(clean(cur)!==clean(v)){if('intro' in s)s.intro=v;else if('introLine' in s)s.introLine=v;else s.intro=v;changed=true;}}
    if(k==='closing'){const cur=('closing' in s)?s.closing:('closingLine' in s?s.closingLine:undefined);if(clean(cur)!==clean(v)){if('closing' in s)s.closing=v;else if('closingLine' in s)s.closingLine=v;else s.closing=v;changed=true;}}
    if(k==='bullets'){const vals=v.split(/\n+/).map(clean).filter(Boolean);const cur=Array.isArray(s.bullets)?s.bullets:(Array.isArray(s.items)?s.items:[]);if(cur.length!==vals.length||cur.some((x,i)=>clean(x)!==vals[i])){s.bullets=vals;s.items=vals;changed=true;}}
    if(!changed)return;
    writeJson(SECTIONS_KEY,all);writeDocSpecificSections(doc,list);pulse();
  }
  // v1.50.94 — explicit bullet add/delete on the NATIVE bullets textarea.
  // After bullets moved to the stable native-textarea path (1.50.92) the per-
  // bullet "+ Bullet" / "×" affordances were gone and the app swallowed Enter,
  // so the user could only ever have one bullet. These operate directly on the
  // textarea value (one line = one bullet) so they inherit the textarea's
  // stability — no foreign injected rows to be reconciled away.
  function insertAtCaret(f,text){
    try{ const s=f.selectionStart, e=f.selectionEnd, v=f.value; f.value=v.slice(0,s)+text+v.slice(e); const p=s+text.length; f.setSelectionRange(p,p); }
    catch(_){ f.value=(f.value||'')+text; }
    dispatchInput(f);
  }
  function addBulletLine(f){
    if(!f)return;
    const v=String(f.value||'').replace(/\s*$/,'');
    f.value = v ? (v+'\n') : '';
    dispatchInput(f);
    try{ f.focus(); const end=f.value.length; f.setSelectionRange(end,end); }catch(_){}
    syncSectionField('bullets',getVal(f));
  }
  function deleteBulletLineAtCaret(f){
    if(!f)return;
    try{
      const v=String(f.value||''), pos=f.selectionStart||0;
      const start=v.lastIndexOf('\n',pos-1)+1;
      const nl=v.indexOf('\n',pos);
      const end=nl<0?v.length:nl+1;
      f.value=v.slice(0,start)+v.slice(end);
      const np=Math.min(start,f.value.length);
      f.setSelectionRange(np,np);
      dispatchInput(f);
    }catch(_){}
    syncSectionField('bullets',getVal(f));
    try{ f.focus(); }catch(_){}
  }
  function controlsForField(f,k){
    f=ensureTextArea(f,k);
    if(!f)return;
    if(isInPreviewPaper(f))return;
    applyField(f,k);
    // v1.50.92 — mark the native field so isTypingInHiwc() can bail run() while
    // the user types here (prevents the background re-render loop from churning
    // the cluster mid-edit). Bullets now ride this same native-textarea path as
    // intro/closing instead of the fragile injected-row editor.
    if(f.getAttribute('data-antcv-hiwc-field')!==k) f.setAttribute('data-antcv-hiwc-field',k);
    // v1.50.94 — bind the reliable-Enter handler for bullets BEFORE the
    // controls-host resolution below. Adding a second bullet (Enter -> newline)
    // must work even if the cluster host can't be resolved on this sweep.
    if(k==='bullets'&&!f.__antcvHiwcEnterBound){
      f.__antcvHiwcEnterBound=1;
      f.addEventListener('keydown',function(ev){ if(ev.key==='Enter'&&!ev.shiftKey&&!ev.ctrlKey&&!ev.metaKey){ ev.preventDefault(); ev.stopPropagation(); insertAtCaret(f,'\n'); syncSectionField('bullets',getVal(f)); } }, true);
    }
    const h=lineHost(f); if(!h||isInPreviewPaper(h)) return;
    if(h.style){h.style.display=h.style.display||'flex';h.style.alignItems=h.style.alignItems||'center';h.style.gap=h.style.gap||'4px';}
    let wrap=h.querySelector('[data-antcv-hiwc-controls="'+k+'"]');
    if(!wrap){wrap=document.createElement('span');wrap.setAttribute('data-antcv-hiwc-controls',k);Object.assign(wrap.style,{display:'inline-flex',alignItems:'center',gap:'2px',marginLeft:'4px',whiteSpace:'nowrap'});h.appendChild(wrap);}
    let page=wrap.querySelector('[data-antcv-hiwc-page]'); if(!page){page=makeBtn('page','📄 1','Page',f);wrap.appendChild(page);} paintPage(page,k);
    let comp=wrap.querySelector('[data-antcv-hiwc-compress]'); if(!comp){comp=makeBtn('compress','↹','Compress',f);wrap.appendChild(comp);}
    let enr=wrap.querySelector('[data-antcv-hiwc-enrich]'); if(!enr){enr=makeBtn('enrich','✨','Enrich',f);wrap.appendChild(enr);}
    let cjlr=wrap.querySelector('[data-antcv-hiwc-cjlr]'); if(!cjlr){cjlr=makeBtn('cjlr','⇤','Alignment',f);wrap.appendChild(cjlr);} paintCJLR(cjlr,getAlign(k));
    page.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setPage(k,getPage(k)%4+1);paintPage(page,k);applyPreview();};
    comp.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setVal(f,compressText(getVal(f)));syncSectionField(k,getVal(f));applyPreview();};
    enr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setVal(f,enrichText(getVal(f)));syncSectionField(k,getVal(f));applyPreview();};
    cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const n=nextAlign(getAlign(k));setAlign(k,n);paintCJLR(cjlr,n);applyField(f,k);applyPreview();};
    // v1.50.95 — bullets keep ONE shared add button + reliable Enter on the
    // native textarea (edit surface). Per-bullet enhance/page/compress/align/
    // delete live in the separate control strip below (renderBulletControls).
    if(k==='bullets'){
      let addb=wrap.querySelector('[data-antcv-hiwc-bullet-add]');
      if(!addb){ addb=makeBtn('bullet-add','＋','Add a bullet (new line)',f); addb.setAttribute('data-antcv-hiwc-bullet-add','1'); addb.style.borderColor='#008b8b'; addb.style.color='#006b6b'; wrap.appendChild(addb); }
      addb.onclick=ev=>{ev.preventDefault();ev.stopPropagation();addBulletLine(f);renderBulletControls(root(),f);applyPreview();};
    }
    // v1.50.92 — bind the section-sync input listener ONCE. controlsForField
    // runs on every sweep; re-adding the listener each time stacked duplicate
    // syncSectionField calls per keystroke (extra pulses = more churn).
    if(!f.__antcvHiwcInputBound){ f.__antcvHiwcInputBound=1; f.addEventListener('input',()=>syncSectionField(k,getVal(f)),{passive:true}); }
  }

  function bulletRowsFromText(v){return String(v||'').split(/\n+/).map(s=>s.replace(/^\s*[•\-*]\s*/,'').trim()).filter(Boolean);}
  function syncBulletTextarea(ta, rows){setVal(ta,rows.join('\n'));syncSectionField('bullets',rows.join('\n'));}

  // v1.50.95 — per-bullet control strip. The editable surface stays the native
  // textarea (stable, clickable). For each bullet line we render ONE row of
  // controls (page, compress, enrich, align, delete) — the per-bullet enhance/
  // page/compress the owner needs. The strip holds NO focus, so the re-render
  // churn that made the old inline bullet INPUTS un-clickable cannot strand a
  // click here. Rebuilt only when the bullet text / its align+page changes
  // (signature guard) so it does not flicker on every sweep.
  function bulletSig(ta){
    const rows=bulletRowsFromText(getVal(ta));
    const meta=rows.map((_,i)=>getAlign('bullet_'+i)+getPage('bullet_'+i)).join(',');
    return rows.join('')+'||'+meta;
  }
  function renderBulletControls(r,ta){
    if(!ta||isInPreviewPaper(ta))return;
    const host=ta.parentNode; if(!host)return;
    let panel=host.querySelector(':scope > [data-antcv-hiwc-bullet-controls]');
    const sig=bulletSig(ta);
    if(panel && panel.getAttribute('data-antcv-hiwc-bullet-sig')===sig) return;
    if(!panel){
      panel=document.createElement('div');panel.setAttribute('data-antcv-hiwc-bullet-controls','1');
      Object.assign(panel.style,{display:'flex',flexDirection:'column',gap:'3px',margin:'4px 0 6px 0',width:'100%',boxSizing:'border-box'});
      host.insertBefore(panel, ta.nextSibling);
    }
    panel.setAttribute('data-antcv-hiwc-bullet-sig',sig);
    panel.textContent='';
    const rows=bulletRowsFromText(getVal(ta));
    function writeRows(newRows){setVal(ta,newRows.join('\n'));syncSectionField('bullets',newRows.join('\n'));renderBulletControls(r,ta);applyPreview();}
    rows.forEach((txt,idx)=>{
      const key='bullet_'+idx;
      const row=document.createElement('div');row.setAttribute('data-antcv-hiwc-bullet-ctl-row','1');
      Object.assign(row.style,{display:'flex',alignItems:'center',gap:'3px',width:'100%',maxWidth:'100%',boxSizing:'border-box',overflow:'hidden'});
      const lab=document.createElement('span');lab.textContent=(idx+1)+'. '+txt;lab.title=txt;
      Object.assign(lab.style,{flex:'1 1 auto',minWidth:'0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontSize:'11px',lineHeight:'1.2',color:'#3a4a4a'});
      const page=makeBtn('page','📄 1','Page for bullet '+(idx+1),ta);paintPage(page,key);
      const comp=makeBtn('compress','↹','Compress bullet '+(idx+1),ta);
      const enr=makeBtn('enrich','✨','Enrich bullet '+(idx+1),ta);
      const cjlr=makeBtn('cjlr','⇤','Alignment of bullet '+(idx+1),ta);paintCJLR(cjlr,getAlign(key));
      const del=makeBtn('bullet-delete','×','Delete bullet '+(idx+1),ta);del.style.borderColor='#ff5c5c';del.style.color='#e52b2b';del.style.background='transparent';
      page.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setPage(key,getPage(key)%4+1);paintPage(page,key);applyPreview();renderBulletControls(r,ta);};
      comp.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const rr=bulletRowsFromText(getVal(ta));rr[idx]=compressText(rr[idx]||'');writeRows(rr);};
      enr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const rr=bulletRowsFromText(getVal(ta));rr[idx]=enrichText(rr[idx]||'');writeRows(rr);};
      cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const n=nextAlign(getAlign(key));setAlign(key,n);paintCJLR(cjlr,n);applyPreview();renderBulletControls(r,ta);};
      del.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const rr=bulletRowsFromText(getVal(ta));rr.splice(idx,1);writeRows(rr);};
      row.appendChild(lab);row.appendChild(page);row.appendChild(comp);row.appendChild(enr);row.appendChild(cjlr);row.appendChild(del);
      panel.appendChild(row);
    });
  }

  // Find the bullets textarea even after we hide it (stable source of truth).
  function findBulletsAny(r){
    if(!r) return null;
    let ta=r.querySelector('textarea[data-antcv-hiwc-bullets-src="1"]');
    if(ta && ta.isConnected) return ta;
    ta=findBullets(r);
    if(ta) ta.setAttribute('data-antcv-hiwc-bullets-src','1');
    return ta;
  }

  // v1.50.99 — EACH BULLET ITS OWN INPUT. The owner rejected the single shared
  // textarea. Hide the app's "Bullets (one per line)" textarea (kept synced as
  // the source of truth) and render one editable <input> per bullet, each with
  // its own page/compress/enrich/align/delete.
  //
  // Stability: rebuild is keyed to the bullet COUNT + align/page only (NOT the
  // text), so typing never triggers a rebuild that steals the caret; we never
  // rebuild while focused inside the editor; per-keystroke writes are debounced;
  // and noteHiwcFocus/restoreHiwcFocus restores the caret if a rebuild happens.
  function renderBulletEditors(r,ta){
    if(!ta||isInPreviewPaper(ta))return;
    if(ta.style.display!=='none') ta.style.display='none';
    const host=ta.parentNode; if(!host)return;
    const ctxKey=activeDoc()+'/'+sid();
    const taRows=bulletRowsFromText(getVal(ta));
    const focusedHere=!!(document.activeElement && document.activeElement.closest && document.activeElement.closest('[data-antcv-hiwc-bullet-controls]'));
    // Load/refresh the model. Reload from the textarea only on a context switch
    // or a genuine external change (e.g. AI regen) while NOT editing — so an
    // empty new bullet the user just added is never wiped by a rebuild.
    if(__hiwcModel===null || __hiwcModelKey!==ctxKey){ __hiwcModel = taRows.length?taRows.slice():['']; __hiwcModelKey=ctxKey; }
    else if(!focusedHere){
      const mk=__hiwcModel.map(function(x){return String(x).trim();}).filter(Boolean).join('');
      if(mk!==taRows.join('')) __hiwcModel = taRows.length?taRows.slice():[''];
    }
    if(!__hiwcModel.length) __hiwcModel=[''];
    const rows=__hiwcModel;
    const meta=rows.map((_,i)=>getAlign('bullet_'+i)+getPage('bullet_'+i)).join(',');
    const sig=rows.length+'|'+meta;
    let panel=host.querySelector(':scope > [data-antcv-hiwc-bullet-controls]');
    if(panel && panel.isConnected && (panel.getAttribute('data-antcv-hiwc-bullet-sig')===sig || focusedHere)) return;
    if(!panel || !panel.isConnected){
      panel=document.createElement('div');panel.setAttribute('data-antcv-hiwc-bullet-controls','1');
      Object.assign(panel.style,{display:'flex',flexDirection:'column',gap:'4px',margin:'4px 0 6px 0',width:'100%',boxSizing:'border-box'});
      host.insertBefore(panel, ta.nextSibling);
    }
    panel.setAttribute('data-antcv-hiwc-bullet-sig',sig);
    panel.textContent='';
    function inputs(){return Array.from(panel.querySelectorAll('[data-antcv-hiwc-bullet-input]'));}
    // writeAll: refresh model from current inputs (by position), then push the
    // non-empty bullets to the hidden textarea + section.
    function writeAll(){__hiwcModel=inputs().map(function(x){return x.value;});const vals=__hiwcModel.map(function(x){return String(x).trim();}).filter(Boolean);setVal(ta,vals.join('\n'));syncSectionField('bullets',vals.join('\n'));}
    function addRow(txt,idx){
      const key='bullet_'+idx;
      const row=document.createElement('div');row.setAttribute('data-antcv-hiwc-bullet-row','1');
      Object.assign(row.style,{display:'flex',alignItems:'center',gap:'3px',width:'100%',maxWidth:'100%',boxSizing:'border-box',overflow:'hidden'});
      const inp=document.createElement('input');inp.type='text';inp.value=txt||'';inp.placeholder='Bullet text';inp.setAttribute('data-antcv-hiwc-bullet-input','1');
      Object.assign(inp.style,{flex:'1 1 auto',minWidth:'0',height:'26px',boxSizing:'border-box'});applyField(inp,key);
      ['focus','keyup','click','select','input'].forEach(function(ev){inp.addEventListener(ev,function(){noteHiwcFocus(idx,inp);});});
      inp.addEventListener('input',function(){ if(__hiwcModel) __hiwcModel[idx]=inp.value; scheduleBulletSync(writeAll); });
      inp.addEventListener('blur',function(){flushBulletSync(writeAll);});
      inp.addEventListener('keydown',function(ev){if(ev.key==='Enter'){ev.preventDefault();ev.stopPropagation();writeAll();addNew();}});
      const page=makeBtn('page','📄 1','Page for bullet '+(idx+1),inp);paintPage(page,key);
      const comp=makeBtn('compress','↹','Compress bullet '+(idx+1),inp);
      const enr=makeBtn('enrich','✨','Enrich bullet '+(idx+1),inp);
      const cjlr=makeBtn('cjlr','⇤','Alignment of bullet '+(idx+1),inp);paintCJLR(cjlr,getAlign(key));
      const del=makeBtn('bullet-delete','×','Delete bullet '+(idx+1),inp);del.style.borderColor='#ff5c5c';del.style.color='#e52b2b';del.style.background='transparent';
      page.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setPage(key,getPage(key)%4+1);paintPage(page,key);applyPreview();};
      comp.onclick=ev=>{ev.preventDefault();ev.stopPropagation();inp.value=compressText(inp.value);writeAll();applyPreview();};
      enr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();inp.value=enrichText(inp.value);writeAll();applyPreview();};
      cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const n=nextAlign(getAlign(key));setAlign(key,n);paintCJLR(cjlr,n);applyField(inp,key);applyPreview();};
      del.onclick=ev=>{ev.preventDefault();ev.stopPropagation();row.remove();writeAll();applyPreview();};
      row.appendChild(inp);row.appendChild(page);row.appendChild(comp);row.appendChild(enr);row.appendChild(cjlr);row.appendChild(del);
      panel.insertBefore(row, panel.querySelector('[data-antcv-hiwc-bullet-add]')||null);
      return inp;
    }
    function addNew(){__hiwcModel=inputs().map(function(x){return x.value;});__hiwcModel.push('');const idx=__hiwcModel.length-1;const inp=addRow('',idx);panel.setAttribute('data-antcv-hiwc-bullet-sig',__hiwcModel.length+'|'+meta);setTimeout(function(){try{inp.focus();}catch(_){}},0);}
    rows.forEach(function(t,i){addRow(t,i);});
    const add=document.createElement('button');add.type='button';add.textContent='＋ Bullet';add.setAttribute('data-antcv-hiwc-bullet-add','1');
    Object.assign(add.style,{alignSelf:'flex-start',border:'1px solid #008b8b',background:'white',color:'#006b6b',borderRadius:'4px',padding:'3px 10px',cursor:'pointer',marginTop:'2px'});
    add.onclick=ev=>{ev.preventDefault();ev.stopPropagation();addNew();};
    panel.appendChild(add);
    restoreHiwcFocus(panel); setTimeout(function(){restoreHiwcFocus(panel);},0);
  }

  function renderBulletList(r,ta){
    if(!ta||ta.getAttribute('data-antcv-hiwc-bullets-bound')==='1') return;
    ta.setAttribute('data-antcv-hiwc-bullets-bound','1');
    const box=document.createElement('div');box.setAttribute('data-antcv-hiwc-bullet-list','1');Object.assign(box.style,{display:'flex',flexDirection:'column',gap:'4px',margin:'4px 0',width:'100%',maxWidth:'100%',overflow:'hidden',boxSizing:'border-box'});
    function currentInputs(){return Array.from(box.querySelectorAll('[data-antcv-hiwc-bullet-input]'));}
    function syncFromInputs(force){const vals=currentInputs().map(x=>x.value.trim()).filter(Boolean);
      // v1.50.87 — preserve the template. When nothing is typed (all inputs
      // empty) do NOT write an empty bullets[] — that clears the section's
      // template placeholders and the preview shows no HIWC template. Only
      // write once there's a real bullet; the × delete passes force=true to
      // actually clear.
      if(vals.length||force){ syncBulletTextarea(ta,vals); } return vals;}
    function addRow(txt,idx){
      const key='bullet_'+idx;
      const row=document.createElement('div');row.setAttribute('data-antcv-hiwc-bullet-row','1');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'3px',width:'100%',maxWidth:'100%',boxSizing:'border-box',overflow:'hidden'});
      const inp=document.createElement('input');inp.type='text';inp.value=txt||'';inp.placeholder='Bullet text';inp.setAttribute('data-antcv-hiwc-bullet-input','1');Object.assign(inp.style,{flex:'1 1 auto',minWidth:'0',height:'22px',boxSizing:'border-box'});applyField(inp,key);
      ['focus','keyup','click','select'].forEach(function(ev){ inp.addEventListener(ev,function(){ noteHiwcFocus(idx,inp); }); });
      const page=makeBtn('page','📄 1','Page',inp);paintPage(page,key);
      const comp=makeBtn('compress','↹','Compress bullet',inp);
      const enr=makeBtn('enrich','✨','Enrich bullet',inp);
      const cjlr=makeBtn('cjlr','⇤','Alignment',inp);paintCJLR(cjlr,getAlign(key));
      const del=makeBtn('bullet-delete','×','Delete bullet',inp);del.style.borderColor='#ff5c5c';del.style.color='#e52b2b';del.style.background='transparent';
      // v1.50.86 — debounce the section write so typing does NOT pulse a
      // forceRebuild per keystroke (which re-created this input and stole
      // focus = "not typable"). Sync after a short pause, and on blur.
      inp.oninput=()=>{ noteHiwcFocus(idx,inp); scheduleBulletSync(syncFromInputs); };
      inp.addEventListener('blur',()=>{ flushBulletSync(syncFromInputs); });
      page.onclick=ev=>{ev.preventDefault();ev.stopPropagation();setPage(key,getPage(key)%4+1);paintPage(page,key);applyPreview();};
      comp.onclick=ev=>{ev.preventDefault();ev.stopPropagation();inp.value=compressText(inp.value);dispatchInput(inp);syncFromInputs();applyPreview();};
      enr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();inp.value=enrichText(inp.value);dispatchInput(inp);syncFromInputs();applyPreview();};
      cjlr.onclick=ev=>{ev.preventDefault();ev.stopPropagation();const n=nextAlign(getAlign(key));setAlign(key,n);paintCJLR(cjlr,n);applyField(inp,key);applyPreview();};
      del.onclick=ev=>{ev.preventDefault();ev.stopPropagation();row.remove();syncFromInputs(true);applyPreview();};
      row.appendChild(inp);row.appendChild(page);row.appendChild(comp);row.appendChild(enr);row.appendChild(cjlr);row.appendChild(del);box.insertBefore(row,box.querySelector('[data-antcv-hiwc-add]'));
      return inp;
    }
    const add=document.createElement('button');add.type='button';add.textContent='+ Bullet';add.setAttribute('data-antcv-hiwc-add','1');Object.assign(add.style,{alignSelf:'flex-start',border:'1px solid #008b8b',background:'white',color:'#006b6b',borderRadius:'4px',padding:'2px 8px',cursor:'pointer'});
    add.onclick=ev=>{ev.preventDefault();ev.stopPropagation();syncFromInputs();const inp=addRow('',currentInputs().length);setTimeout(()=>inp.focus(),0);};
    ta.style.display='none';ta.parentNode&&ta.parentNode.insertBefore(box,ta);box.appendChild(add);
    const current=bulletRowsFromText(getVal(ta)); if(!current.length) current.push(''); current.forEach((txt,idx)=>addRow(txt,idx));
    // v1.50.89 — restore caret after a rebuild so the user keeps typing.
    restoreHiwcFocus(box); setTimeout(function(){ restoreHiwcFocus(box); }, 0);
  }

  // v1.50.92 — the injected per-bullet row editor (renderBulletList) fought the
  // app re-render loop: React kept reconciling the Bullets container and
  // destroying our foreign <input> rows faster than a click could land, so the
  // bullet inputs were "not clickable" while intro/closing (native textareas)
  // stayed editable. We retire that editor. This restores the app's NATIVE
  // Bullets textarea — un-hide it, drop the bound flag, and remove any leftover
  // injected box — so controlsForField('bullets') can attach to it just like
  // intro/closing. Idempotent: no-ops once nothing injected remains.
  function restoreNativeBullets(r){
    if(!r)return;
    try{
      Array.prototype.forEach.call(r.querySelectorAll('[data-antcv-hiwc-bullet-list]'),function(box){ if(box.parentNode) box.parentNode.removeChild(box); });
      Array.prototype.forEach.call(r.querySelectorAll('textarea[data-antcv-hiwc-bullets-bound]'),function(ta){
        ta.removeAttribute('data-antcv-hiwc-bullets-bound');
        if(ta.style && ta.style.display==='none') ta.style.display='';
      });
    }catch(_){}
  }

  function previewSection(){return document.querySelector('[data-sid="'+CSS.escape(sid())+'"]')||Array.from(document.querySelectorAll('[data-sid],section,div')).find(el=>visible(el)&&RX.test(clean(el.textContent).slice(0,180)));}
  function previewParts(secEl){
    if(!secEl)return{};const els=Array.from(secEl.querySelectorAll('p,li,div,[data-edit-path],[data-antcv-row-path]')).filter(visible).filter(el=>!el.querySelector('input,textarea,button'));
    const out={intro:null,closing:null,bullets:[]};
    els.forEach(el=>{const t=clean(el.textContent); if(!t||RX.test(t))return; const path=String(el.getAttribute('data-edit-path')||el.getAttribute('data-antcv-row-path')||''); if(/intro/i.test(path)||/intro/i.test(t)){out.intro=out.intro||el;} else if(/closing/i.test(path)||/closing/i.test(t)){out.closing=el;} else if((el.tagName||'').toLowerCase()==='li'||/bullets|items/i.test(path)){out.bullets.push(el);} });
    if(!out.intro) out.intro=els[0]||null; if(!out.closing) out.closing=els[els.length-1]||null; return out;
  }
  function makeBreakHeader(){const h=document.createElement('div');h.setAttribute('data-antcv-hiwc-page-break','1');h.textContent='HOW I WOULD CONTRIBUTE (CONT.)';Object.assign(h.style,{breakBefore:'page',pageBreakBefore:'always',color:'#00746E',fontWeight:'700',fontSize:'12pt',marginTop:'4pt',marginBottom:'8pt',borderBottom:'1pt solid #00746E',paddingBottom:'2pt'});return h;}

  function currentBulletValues(){const s=sec();const b=s&&(Array.isArray(s.bullets)?s.bullets:Array.isArray(s.items)?s.items:[]);return (b||[]).map(clean).filter(Boolean);}
  function syncPreviewBulletNodes(secEl,p){
    // v1.50.88 — the app renders the HIWC bullets in the preview from the
    // section data, so injecting our own <ul> produced TWO copies of every
    // bullet (owner screenshot). Remove any list we previously injected and
    // let the app own the bullet rendering; never inject a duplicate.
    if(secEl){ Array.prototype.forEach.call(secEl.querySelectorAll('[data-antcv-hiwc-list]'),function(n){ if(n.parentNode) n.parentNode.removeChild(n); }); }
    return previewParts(secEl);
  }
  function applyPreview(){
    if(__applying)return; __applying=true; try{
    const s=previewSection();if(!s)return; s.querySelectorAll('[data-antcv-hiwc-page-break="1"]').forEach(n=>n.remove());
    let p=previewParts(s); p=syncPreviewBulletNodes(s,p);
    [['intro',p.intro],['closing',p.closing]].forEach(([k,el])=>{if(!el)return; const a=getAlign(k); el.style.textAlign=a; Array.from(el.querySelectorAll('span,div,p')).forEach(x=>x.style.textAlign=a); if(getPage(k)>1&&el.parentNode)el.parentNode.insertBefore(makeBreakHeader(),el);});
    (p.bullets||[]).forEach((el,idx)=>{const k='bullet_'+idx; const a=getAlign(k); el.style.textAlign=a; Array.from(el.querySelectorAll('span,div,p')).forEach(x=>x.style.textAlign=a); if(getPage(k)>1&&el.parentNode)el.parentNode.insertBefore(makeBreakHeader(),el);});
    } finally { __applying=false; }
  }

  function pruneCoreDuplicateCJLR(){
    const rows=Array.from(document.querySelectorAll('[data-antcv-core-row], tr, div')).filter(el=>visible(el)&&CORE_RX.test(clean((el.closest('[data-sid]')||el.parentElement||el).textContent||'')));
    rows.forEach(row=>{
      const c=Array.from(row.querySelectorAll('[data-antcv-core-cjlr], .antcv-core-cjlr')).filter(visible);
      if(c.length>1){ c.slice(0,-1).forEach(b=>{const wrap=b.closest('[data-antcv-core-controls]'); if(wrap&&wrap.querySelectorAll('button').length<=1)wrap.remove(); else b.remove();}); }
    });
  }

  // v1.50.86 — edit-safety helpers for HIWC bullet typing.
  function isTypingInHiwc(){
    // v1.50.87 — bail run() while the user is interacting anywhere in the HIWC
    // bullet editor (input, its row, or controls), not just the text input, so
    // pressing a bullet/control no longer triggers a rebuild = flicker.
    try{ var a=document.activeElement; return !!(a && a.closest && a.closest('[data-antcv-hiwc-bullet-list],[data-antcv-hiwc-bullet-row],[data-antcv-hiwc-field]')); }catch(_){ return false; }
  }
  var __hiwcSyncTimer=null;
  function scheduleBulletSync(syncFn){ clearTimeout(__hiwcSyncTimer); __hiwcSyncTimer=setTimeout(function(){ __hiwcSyncTimer=null; try{ syncFn(); applyPreview(); }catch(_){} }, 600); }
  function flushBulletSync(syncFn){ clearTimeout(__hiwcSyncTimer); __hiwcSyncTimer=null; try{ syncFn(); applyPreview(); }catch(_){} }
  // v1.50.89 — focus preservation. When the app re-renders the HIWC section it
  // re-creates the bullet input, dropping the caret = "hard to type". We track
  // the last-focused bullet index + caret, and after the editor is rebuilt we
  // restore focus to the same input/caret so typing is uninterrupted.
  var __hiwcFocus=null;
  // v1.50.100 — in-memory bullet model: the editor's source of truth so an
  // empty new bullet (and the caret) survives the app re-render that destroys
  // the foreign bullet panel.
  var __hiwcModel=null, __hiwcModelKey='';
  function noteHiwcFocus(idx, inp){ try{ __hiwcFocus={idx:idx, caret:(inp.selectionStart!=null?inp.selectionStart:(inp.value||'').length), at:Date.now()}; }catch(_){} }
  function restoreHiwcFocus(box){
    try{
      if(!__hiwcFocus || (Date.now()-__hiwcFocus.at)>2500) return;
      var inputs=box.querySelectorAll('[data-antcv-hiwc-bullet-input]');
      var t=inputs[__hiwcFocus.idx];
      if(t && document.activeElement!==t){ t.focus(); var c=Math.min(__hiwcFocus.caret,(t.value||'').length); try{ t.setSelectionRange(c,c); }catch(_){} }
    }catch(_){}
  }

  let pending=false;function runSoon(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function run(){if(isTypingInHiwc())return;try{const r=root();if(r){cleanupClosingHelperText(r);controlsForField(findIntro(r),'intro');controlsForField(findClosing(r),'closing');renderBulletEditors(r,findBulletsAny(r));}/* core CJLR cleanup handled by antcv-core-competencies-row-controls; do not prune across the whole Core section */ applyPreview();}catch(e){try{console.warn('[how-contribute-controls-245] failed:',e&&e.message);}catch(_){}}}
  function start(){injectCss();run();[100,300,800,1600,3000].forEach(ms=>setTimeout(run,ms));try{new MutationObserver(()=>{if(__applying)return;runSoon();}).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']});}catch(_){}window.addEventListener('input',runSoon,true);window.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('antcv:sections-updated',()=>setTimeout(run,0));/* v1.50.57: blind setInterval(run,2000) removed — it was the flicker clock. Updates are now event-driven (sections-updated/input/click) plus a slow safety re-sync that no-ops when nothing changed. */setInterval(()=>{if(!__applying)run();},8000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  window.AntcvHowContributeControls239={version:VERSION,run};
})();
