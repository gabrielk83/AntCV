/* AntCV editor layout cleanup (v1.40.331)
 * Replaces the v330 editor DOM sidecar.
 * Goals:
 * - one Foundation control row per Foundation field
 * - one HOW I WOULD CONTRIBUTE control row per intro/bullet/closing field
 * - no endless duplicate buttons
 * - desktop preview shows bottom FABs only; top action duplicates are hidden
 */
(function(){
  'use strict';
  const VERSION='1.50.207-foundation-own-page';
  if(window.__antcvEditorLayoutCleanup331===VERSION) return;
  window.__antcvEditorLayoutCleanup331=VERSION;

  const FOUNDATION_KEY='antcv.foundationControls.v1';
  const HIWC_PAGE_KEY='antcv.hiwc.page.v1';
  const HIWC_ALIGN_KEY='antcv.hiwc.alignment.v1';
  // v1.40.341-p0c-fix10 (F1): per-doc flag tracking whether the
  // template default bullets were already seeded. Prevents the seeds
  // from reappearing if the user intentionally cleared all bullets
  // and reloaded. Set the first time we seed; never cleared
  // automatically. The user can reset via:
  //   localStorage.removeItem('antcv.hiwc.seeded.v1')
  const HIWC_SEEDED_KEY='antcv.hiwc.seeded.v1';
  function activeDocForHIWC(){try{var v=localStorage.getItem('doc');return v==='cl'?'cl':'cv';}catch(_){return 'cv';}}
  function hiwcSeededFor(doc){try{var raw=localStorage.getItem(HIWC_SEEDED_KEY);if(!raw)return false;var v=JSON.parse(raw);return !!(v&&v[doc]);}catch(_){return false;}}
  function markHIWCSeeded(doc){try{var raw=localStorage.getItem(HIWC_SEEDED_KEY);var v=raw?JSON.parse(raw):{};if(!v||typeof v!=='object')v={};v[doc]=true;localStorage.setItem(HIWC_SEEDED_KEY,JSON.stringify(v));}catch(_){}}
  const COLORS=['#9aa0a6','#8A6BE8','#D98C00','#00746E','#B85E3B'];
  const ALIGN=['center','justify','left','right'];
  const ICON={center:'↔',justify:'☰',left:'⇤',right:'⇥'};

  function clean(s){return String(s||'').replace(/[\t\n\r ]+/g,' ').trim();}
  function visible(el){return !!(el&&el.isConnected&&(el.offsetWidth||el.offsetHeight||(el.getClientRects&&el.getClientRects().length)));}
  function read(k,f){try{const raw=localStorage.getItem(k); if(!raw)return f; const v=JSON.parse(raw); return v&&typeof v==='object'?v:f;}catch(_){return f;}}
  function write(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}}
  function fire(el){['input','change'].forEach(t=>{try{el&&el.dispatchEvent(new Event(t,{bubbles:true}));}catch(_){}});}
  function pulse(source){try{window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source,version:VERSION}}));}catch(_){}}
  function val(f){return f?(f.value!==undefined?f.value:f.textContent||''):'';}
  function setVal(f,v){if(!f)return; if(f.value!==undefined)f.value=v; else f.textContent=v; fire(f);}
  function compressText(v){let t=clean(v);t=t.replace(/\b(responsible for|worked on|helped with|involved in|various|different|extensive|strong|solid)\b/gi,'').replace(/,[\t\n\r ]*/g,', ').replace(/[\t\n\r ]+/g,' ').trim();if(t.length>180)t=t.slice(0,177).replace(/[\t\n\r ][^\t\n\r ]*$/,'')+'…';return t;}
  function enrichText(v){const t=clean(v);if(!t)return t;if(/[.;:]$/.test(t))return t;return t+'.';}
  function nextAlign(a){const i=ALIGN.indexOf(a);return ALIGN[(i<0?2:i+1)%ALIGN.length];}

  // P0-C (v1.40.341-p0c): the bespoke toolbar() is replaced by a thin
  // wrapper around window.SectionControlBar (the shared P0-A bar).
  // GEN-003 standard order [Move] PB CJLR Enhance Fit [Delete] is
  // enforced by the bar itself; "Fit" wording replaces "Compress"
  // (GEN-004). The remove() callback (when supplied) wires to
  // capabilities.delete, so the bar's delete button removes a bullet
  // row when used on HIWC bullets.
  //
  // toolbar(key, field, opts) → mount span. Mounted lazily via
  // SectionControlBar so partial-cap visibility (Foundation has no
  // delete, intro/closing has no delete, bullets do) is data-driven.
  function toolbar(key, field, opts) {
    opts = opts || {};
    const wrap = document.createElement('span');
    wrap.setAttribute('data-antcv331-toolbar', key);
    Object.assign(wrap.style, {
      display: 'inline-flex', alignItems: 'center', gap: '2px',
      marginLeft: '4px', whiteSpace: 'nowrap', flex: '0 0 auto',
      verticalAlign: 'middle',
    });

    // Fallback: SectionControlBar not yet installed (very early boot,
    // or a build where P0-A's sidecar didn't load). Render an inert
    // placeholder rather than crashing — the next schedule() tick
    // re-runs run() and the bar mounts properly.
    if (!window.SectionControlBar || typeof window.SectionControlBar.mount !== 'function') {
      try { console.debug('[editor-cleanup-331] SectionControlBar not ready; skipping toolbar for', key); } catch (_) {}
      return wrap;
    }

    const capabilities = {
      pageBreak: true,
      align: true,
      enhance: true,
      fit: true,
      delete: typeof opts.remove === 'function',
    };

    const itemType = /^bullet_/.test(key) ? 'hiwc-bullet'
                   : /^hiwc-/.test(key) ? 'hiwc-line'
                   : /^foundation-/.test(key) ? 'foundation-textbox'
                   : 'editor-line';
    const itemLabel = (function () {
      // Friendly name for the deterministic tooltip template.
      if (key === 'intro') return 'How I Would Contribute — intro';
      if (key === 'closing') return 'How I Would Contribute — closing';
      if (/^bullet_(\d+)$/.test(key)) return 'How I Would Contribute — bullet ' + (Number(key.split('_')[1]) + 1);
      if (key === 'foundation-hands_on') return 'Foundation — hands-on';
      if (key === 'foundation-professionally') return 'Foundation — professionally';
      return key;
    })();

    const readState = () => ({
      page: opts.getPage ? opts.getPage() : 1,
      alignment: opts.getAlign ? opts.getAlign() : 'left',
      pageBreakActive: (opts.getPage ? opts.getPage() : 1) >= 2,
    });

    let unmount = window.SectionControlBar.mount(wrap, {
      itemId: 'cl-editor.' + key,
      itemType: itemType,
      itemLabel: itemLabel,
      capabilities: capabilities,
      state: readState(),
      onAction: function (evt) {
        if (!evt || typeof evt !== 'object') return;
        switch (evt.action) {
          case 'page-break': {
            if (opts.setPage) opts.setPage();
            break;
          }
          case 'align-cycle': {
            let next;
            if (opts.setAlign) {
              next = opts.setAlign();
            } else if (evt.payload && evt.payload.next) {
              next = evt.payload.next;
            }
            if (field && next) field.style.textAlign = next;
            break;
          }
          case 'enhance': {
            if (field) {
              setVal(field, enrichText(val(field)));
              pulse('enhance');
            }
            break;
          }
          case 'fit': {
            if (field) {
              setVal(field, compressText(val(field)));
              pulse('fit');
            }
            break;
          }
          case 'delete': {
            if (typeof opts.remove === 'function') opts.remove();
            break;
          }
        }
        if (typeof unmount.update === 'function') {
          try { unmount.update({ state: readState() }); } catch (_) {}
        }
      },
    });

    return wrap;
  }

  function allFields(root){return Array.from((root||document).querySelectorAll('input[type="text"],textarea,[contenteditable="true"]')).filter(visible);}
  // v1.40.341-p0c-fix5 (2026-05-28): hard guard against mounting any
  // editor toolbar host inside .antcv-preview-paper. When the section
  // panel is opened the foundation/HIWC editors render in a layout
  // that places their fields inside the preview-paper subtree (likely
  // a portal). The foundationRoot()/hiwcRoot() guards check the
  // HEADING but the field can still resolve inside preview via
  // labelledFoundationField()'s fallback to fs[0]/fs[1]. Refuse
  // insertion at the host-creation site so the bleed cannot happen
  // regardless of which path resolved the field.
  function hostAfterField(field,key){if(!field||!field.parentNode)return null;if(isInPreviewPaper(field))return null;let host=field.parentNode.querySelector(':scope > [data-antcv331-host="'+key+'"]');if(!host){host=document.createElement('span');host.setAttribute('data-antcv331-host',key);field.parentNode.insertBefore(host,field.nextSibling);}host.innerHTML='';host.style.display='inline-flex';host.style.alignItems='center';host.style.gap='2px';host.style.marginLeft='4px';return host;}

  function foundationState(){const s=read(FOUNDATION_KEY,{});return {hands_on:Object.assign({page:1,align:'left'},s.hands_on||{}),professionally:Object.assign({page:1,align:'left'},s.professionally||{})};}
  function setFoundation(part,patch){const s=foundationState();s[part]=Object.assign({},s[part]||{},patch||{});write(FOUNDATION_KEY,s);pulse('foundation-controls');return s[part];}
  // ─── Unified CL page cascade (1.50.191) ───────────────────────────────
  // Foundation's page buttons now share the SAME model as HIWC + the 284
  // preview renderer (localStorage['antcv:itemPages']). A part can't sit on a
  // page earlier than the content before it (the "floor"); pressing a button
  // moves that part up (wrapping to the floor, never below it) and carries
  // every item after it — the rest of foundation, then closure / signature /
  // AI notice — onto the same page. Cover-letter equivalent of the
  // Professional-Experience cascade. hands_on = item 0, professionally = item 1.
  const ITEMPAGES_KEY='antcv:itemPages';
  function ipRead(){const v=read(ITEMPAGES_KEY,{});return v&&typeof v==='object'?v:{};}
  function clDocId(){try{return localStorage.getItem('doc')==='cv'?'cv':'cl';}catch(_){return 'cl';}}
  function clSecs(){const s=read('sections',null);const a=s&&s[clDocId()];return Array.isArray(a)?a:[];}
  function bucketMax(b){let m=1;if(b&&typeof b==='object')for(const k in b){const v=Number(b[k]);if(Number.isFinite(v)&&v>m)m=v;}return Math.min(4,m);}
  function foundationSid(){const s=clSecs().find(x=>x&&(x.type==='foundation'||/foundation/i.test(clean(x.title||x.id||''))));return s&&s.id?String(s.id):'foundation';}
  // Highest page reached by every section BEFORE foundation (HIWC etc.).
  function foundationFloor(){const all=ipRead();const fId=foundationSid();let f=1;for(const so of clSecs()){if(!so||!so.id)continue;if(String(so.id)===fId)break;f=Math.max(f,bucketMax(all[String(so.id)]));}return Math.min(4,f);}
  function fEff(part){const st=foundationState();const e0=Math.min(4,Math.max(Number(st.hands_on.page)||1,foundationFloor()));if(part==='hands_on')return e0;return Math.min(4,Math.max(Number(st.professionally.page)||1,e0));}
  // Persist foundation's effective pages into itemPages (so 284 draws the light
  // splitter) and carry sections AFTER foundation to the same page. Change-
  // guarded: writes + pulses only when the map actually changes, so the
  // fixFoundation re-render it triggers converges instead of looping.
  function syncFoundationPages(){
    try{
      const all=ipRead();const before=JSON.stringify(all);const fId=foundationSid();
      // 1.50.207: write foundation's OWN explicit page (NOT the floored effective
      // page) into antcv:itemPages — hands_on=item "0", professionally=item "1".
      // The native renderer applies the monotonic floor at render time. Writing the
      // FLOORED page here meant foundation that merely INHERITED HIWC's page-2 floor
      // (without the user moving it) got its own itemPages["0"]=2 marker, drawing a
      // redundant salmon before FOUNDATION right after a HIWC break (owner: "extra
      // page propagation after HIWC"). With own-page only, foundation just flows
      // after HIWC unless the user explicitly moves it.
      const fst=foundationState();
      const h=Math.min(4,Math.max(1,Math.round(Number(fst.hands_on.page)||1)));
      const pr=Math.min(4,Math.max(1,Math.round(Number(fst.professionally.page)||1)));
      if(!all[fId]||typeof all[fId]!=='object')all[fId]={};
      if(h>1)all[fId]['0']=h;else delete all[fId]['0'];
      if(pr>1)all[fId]['1']=pr;else delete all[fId]['1'];
      if(!Object.keys(all[fId]).length)delete all[fId];
      // No cross-section cascade: the CL preview is a continuous flow, so once
      // foundation moves to page N the sections after it (closure …) flow onto the
      // same page naturally. Tagging each following section with its OWN page>=2
      // marker produced a redundant 2nd salmon bar before CLOSURE (owner flagged
      // this on HIWC; same rule here). Clear any stale following-section markers a
      // prior build left behind.
      let after=false;
      for(const so of clSecs()){if(!so||!so.id)continue;const id=String(so.id);if(id===fId){after=true;continue;}if(!after)continue;
        if(all[id]&&typeof all[id]==='object'&&all[id]['0']!==undefined){delete all[id]['0'];if(!Object.keys(all[id]).length)delete all[id];}
      }
      if(JSON.stringify(all)!==before){write(ITEMPAGES_KEY,all);try{window.dispatchEvent(new CustomEvent('antcv:item-pages-changed',{detail:{source:'foundation-cascade'}}));}catch(_){}pulse('foundation-cascade');}
    }catch(_){}
  }
  // Cycle a foundation part within [floor .. 4], wrapping to floor, then cascade.
  function setFoundationPageCascade(part){
    const floor=part==='hands_on'?foundationFloor():fEff('hands_on');
    const cur=fEff(part);let next=cur>=4?floor:cur+1;next=Math.min(4,Math.max(next,floor,1));
    setFoundation(part,{page:next});syncFoundationPages();return next;
  }
  function isInPreviewPaper(el){const paper=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');return !!(paper && el && paper.contains(el));}
  function foundationRoot(){const heads=Array.from(document.querySelectorAll('h1,h2,h3,strong,b,div,span')).filter(visible);for(const h of heads){if(isInPreviewPaper(h)) continue; /* v1.40.341-p0c-fix2: scope to editor panel — never mount the cluster in Preview */ const t=clean(h.textContent);if(!/^FOUNDATION/i.test(t)||t.length>90)continue;let p=h;for(let d=0;p&&p!==document.body&&d<10;d++,p=p.parentElement){if(isInPreviewPaper(p)) break; const tx=clean(p.textContent).toLowerCase();const fs=allFields(p);if(fs.length>=2&&tx.indexOf('hands')>=0&&tx.indexOf('profession')>=0)return p;}}return null;}
  // v1.40.341-p0c-fix7 (2026-05-28): the previous ancestor-text
  // matcher walked up from each field looking for "hands" or
  // "profession" — but the Foundation panel wrapper always contains
  // BOTH labels, plus the Professionally placeholder contains the
  // word "hands-on", so the matcher resolved both parts to fs[0]
  // and stacked both toolbars after Hands-on, leaving Professionally
  // with no controls. Use position-based mapping instead — the
  // panel deterministically renders Hands-on first and
  // Professionally second.
  //
  // v1.40.341-p0c-fix10 (G1): position-based mapping is fragile —
  // if React ever renders an extra input above either field (a third
  // Foundation slot, a Korean variant, a textarea moved to the top
  // by a future layout change), Hands-on and Professionally would
  // silently swap or both attach to the wrong field. Replace with
  // EXACT-text label detection: walk up from each field looking for
  // a sibling/parent label whose clean lowercase text is EXACTLY
  // "hands-on" / "hands on" or "professionally". The strictness on
  // exact match avoids the fix7 collision (placeholder text contained
  // "hands-on" but never EQUALED it). Falls back to positional
  // mapping if no label is found, preserving fix7 behaviour for
  // builds that don't render explicit labels.
  function foundationLabelFor(field){
    if(!field)return null;
    var seen=new Set();
    var node=field;
    // Walk up looking at preceding siblings at each level. The label
    // is typically a sibling positioned just before the input.
    for(var depth=0;node&&depth<6;depth++,node=node.parentElement){
      var sib=node.previousElementSibling;
      var guard=0;
      while(sib&&guard<8){
        if(!seen.has(sib)){
          seen.add(sib);
          var t=clean(sib.textContent||'').toLowerCase();
          // Strict equality — the placeholder text contains "hands-on"
          // but never EQUALS it. This is what makes the matcher safe
          // against the fix7 collision.
          if(t==='hands-on'||t==='hands on')return 'hands_on';
          if(t==='professionally')return 'professionally';
        }
        sib=sib.previousElementSibling;
        guard++;
      }
    }
    return null;
  }
  function labelledFoundationField(root,part){
    var fs=allFields(root);
    // Prefer label-based detection (G1).
    for(var i=0;i<fs.length;i++){
      if(foundationLabelFor(fs[i])===part)return fs[i];
    }
    // Fallback: positional (preserves fix7 behaviour).
    if(part==='hands_on')return fs[0]||null;
    if(part==='professionally')return fs[1]||fs[0]||null;
    return null;
  }
  function cleanupFoundation(root){if(!root)return;Array.from(root.querySelectorAll('[data-antcv-foundation-host],[data-antcv330-hiwc-toolbar],[data-antcv331-toolbar]')).forEach(n=>n.remove());}
  function fixFoundation(){const r=foundationRoot();if(!r)return;cleanupFoundation(r);const st=foundationState();[['hands_on','hands_on'],['professionally','professionally']].forEach(([part,key])=>{const f=labelledFoundationField(r,part);if(!f)return;f.style.textAlign=st[part].align||'left';const h=hostAfterField(f,'foundation-'+key);if(!h)return;/* v1.40.341-p0c-fix9: hostAfterField now returns null when the field is inside preview-paper (fix5 guard). Without this if(!h) bail, h.appendChild crashes with "Cannot read properties of null" and floods the console hundreds of times per second. */h.appendChild(toolbar('foundation-'+key,f,{getPage:()=>fEff(part),setPage:()=>setFoundationPageCascade(part),getAlign:()=>foundationState()[part].align||'left',setAlign:()=>setFoundation(part,{align:nextAlign(foundationState()[part].align||'left')}).align}));});try{syncFoundationPages();}catch(_){}}

  function hiwcRoot(){const fields=allFields(document).filter(f=>!isInPreviewPaper(f));/* v1.40.341-p0c-fix2: editor-only seeds, never Preview */const seed=fields.find(f=>/Intro[ —-]|one sentence framing/i.test(String(f.value||f.placeholder||f.textContent||'')));if(!seed)return null;let p=seed.parentElement,best=null;for(let d=0;p&&p!==document.body&&d<12;d++,p=p.parentElement){if(isInPreviewPaper(p)) break; const t=clean(p.textContent);if(/HOW I WOULD CONTRIBUTE/i.test(t)||(/Intro line/i.test(t)&&/Closing line/i.test(t)))best=p;}return best;}
  function hiwcFields(root){const fs=allFields(root);const intro=fs.find(f=>/Intro[ —-]|one sentence framing/i.test(String(f.value||f.placeholder||f.textContent||'')))||fs[0]||null;const closing=fs.slice().reverse().find(f=>/Closing[ —-]|one sentence/i.test(String(f.value||f.placeholder||f.textContent||'')))||fs[fs.length-1]||null;let bullet=fs.find(f=>f.tagName==='TEXTAREA'&&f!==intro&&f!==closing)||null;return {intro,bullet,closing};}
  function hp(){return read(HIWC_PAGE_KEY,{});} function ha(){return read(HIWC_ALIGN_KEY,{});} function hgetPage(k){const n=Number(hp()[k]||1);return Number.isFinite(n)?Math.min(4,Math.max(1,Math.round(n))):1;} function hsetPage(k){const m=hp();m[k]=hgetPage(k)%4+1;if(m[k]===1)delete m[k];write(HIWC_PAGE_KEY,m);pulse('hiwc-page');return hgetPage(k);} function hgetAlign(k){const m=ha();return ALIGN.includes(m[k])?m[k]:'left';} function hsetAlign(k){const m=ha();m[k]=nextAlign(hgetAlign(k));write(HIWC_ALIGN_KEY,m);pulse('hiwc-align');return hgetAlign(k);}
  function cleanupHIWC(root){if(!root)return;Array.from(root.querySelectorAll('[data-antcv330-hiwc-bullet-list],[data-antcv331-hiwc-bullet-list],[data-antcv330-hiwc-toolbar],[data-antcv331-toolbar],[data-antcv331-host]')).forEach(n=>n.remove());Array.from(root.querySelectorAll('[data-antcv-hiwc-bullets-bound]')).forEach(n=>{n.removeAttribute('data-antcv-hiwc-bullets-bound');n.style.display='';});}
  // v1.40.341-p0c-fix5: matching guard for HIWC bullet/intro/closing
  // hosts — refuse to mount inside preview-paper for the same reason
  // documented on hostAfterField above.
  function rowHostForField(f,key){if(!f||isInPreviewPaper(f))return null;const p=f.parentElement;if(!p)return null;p.style.display='flex';p.style.alignItems='center';p.style.gap='4px';p.style.flexWrap='nowrap';let h=p.querySelector(':scope > [data-antcv331-host="'+key+'"]');if(!h){h=document.createElement('span');h.setAttribute('data-antcv331-host',key);p.appendChild(h);}h.innerHTML='';return h;}
  function syncBullets(box,source){const vals=Array.from(box.querySelectorAll('[data-antcv331-bullet-text]')).map(i=>clean(i.value)).filter(Boolean);setVal(source,vals.join('\n'));}
  // v1.40.341-p0c-fix6 (2026-05-28): HIWC bullet page-break cascade.
  // When a bullet's page goes from N → N+1, every subsequent bullet
  // whose stored page is < N+1 also moves up so visually the break
  // pushes the WHOLE tail to the next page (matches how Experience
  // page-breaks behave). One-way push: going BACK to page 1 does
  // not demote others, because we cannot tell whether they were
  // pushed up by us or set independently.
  function hsetBulletPageCascade(idx,box){
    const next=hsetPage('bullet_'+idx);
    try{
      const total=box.querySelectorAll('[data-antcv331-bullet-row]').length;
      const m=hp();
      for(let j=idx+1;j<total;j++){
        const bk='bullet_'+j;
        const cur=Number(m[bk]||1);
        if(cur<next) m[bk]=next;
      }
      write(HIWC_PAGE_KEY,m);
      pulse('hiwc-page-cascade');
    }catch(_){}
    return next;
  }
  function addBullet(box,source,text){const idx=box.querySelectorAll('[data-antcv331-bullet-row]').length;const row=document.createElement('div');row.setAttribute('data-antcv331-bullet-row','1');Object.assign(row.style,{display:'flex',alignItems:'center',gap:'4px',margin:'3px 0',width:'100%'});const mark=document.createElement('input');mark.value='•';mark.title='Bullet or emoji';Object.assign(mark.style,{width:'30px',minWidth:'30px',height:'24px',textAlign:'center',boxSizing:'border-box'});const inp=document.createElement('input');inp.type='text';inp.value=text||'';inp.placeholder='Bullet text';inp.setAttribute('data-antcv331-bullet-text','1');Object.assign(inp.style,{flex:'1 1 auto',minWidth:'0',height:'24px',boxSizing:'border-box'});inp.style.textAlign=hgetAlign('bullet_'+idx);inp.oninput=()=>syncBullets(box,source);row.append(mark,inp,toolbar('bullet_'+idx,inp,{getPage:()=>hgetPage('bullet_'+idx),setPage:()=>hsetBulletPageCascade(idx,box),getAlign:()=>hgetAlign('bullet_'+idx),setAlign:()=>hsetAlign('bullet_'+idx),remove:()=>{row.remove();syncBullets(box,source);}}));box.insertBefore(row,box.querySelector('[data-antcv331-add-bullet]'));}
  function fixHIWC(){const r=hiwcRoot();if(!r)return;cleanupHIWC(r);const {intro,bullet,closing}=hiwcFields(r);if(intro){intro.style.textAlign=hgetAlign('intro');const h=rowHostForField(intro,'hiwc-intro');if(h)h.appendChild(toolbar('intro',intro,{getPage:()=>hgetPage('intro'),setPage:()=>hsetPage('intro'),getAlign:()=>hgetAlign('intro'),setAlign:()=>hsetAlign('intro')}));}if(bullet){bullet.style.display='none';const box=document.createElement('div');box.setAttribute('data-antcv331-hiwc-bullet-list','1');Object.assign(box.style,{display:'flex',flexDirection:'column',gap:'2px',margin:'4px 0',width:'100%'});const add=document.createElement('button');add.type='button';add.textContent='+ Add';add.title='Add bullet';add.setAttribute('aria-label','Add bullet');add.setAttribute('data-antcv331-add-bullet','1');add.setAttribute('data-antcv-hiwc-add','1');Object.assign(add.style,{alignSelf:'flex-start',border:'1px solid #008b8b',background:'white',color:'#006b6b',borderRadius:'4px',padding:'2px 8px',cursor:'pointer'});add.onclick=e=>{e.preventDefault();e.stopPropagation();addBullet(box,bullet,'');};box.appendChild(add);bullet.parentNode.insertBefore(box,bullet.nextSibling);const vals=String(bullet.value||'').split(/[\n]+/).map(x=>x.replace(/^[\t ]*[•\-*][\t ]*/,'').trim()).filter(Boolean);/* v1.40.341-p0c-fix6: seed 3 bracketed template placeholders when the section is empty so HIWC matches Foundation/Closure UX of always showing structure. The writing engine and the user can type over each. v1.40.341-p0c-fix10 (F1): only seed ONCE per doc. If the user cleared the bullets intentionally and reloaded, do NOT re-inject seeds. Tracked via localStorage['antcv.hiwc.seeded.v1'][doc]. */const HIWC_DEFAULT_BULLETS=['[Action — what you would do in the first weeks]','[Action — what you would tackle in the first month]','[Action — what you would deliver by quarter end]'];const _hiwcDoc=activeDocForHIWC();const _shouldSeed=!vals.length&&!hiwcSeededFor(_hiwcDoc);const _toRender=vals.length?vals:(_shouldSeed?HIWC_DEFAULT_BULLETS:[]);_toRender.forEach(v=>addBullet(box,bullet,v));if(_shouldSeed)markHIWCSeeded(_hiwcDoc);}if(closing&&closing!==intro&&closing!==bullet){closing.style.textAlign=hgetAlign('closing');/* v1.40.341-p0c-fix8: when Closing is a <textarea> it renders as a multi-line box with resize handle that looks visually different from Intro's single-line input. Force single-line styling so the two surfaces match per CL-002. */if(closing.tagName==='TEXTAREA'){try{closing.rows=1;closing.style.resize='none';closing.style.overflow='hidden';closing.style.minHeight='1.6em';closing.style.height='auto';}catch(_){}}const h=rowHostForField(closing,'hiwc-closing');if(h)h.appendChild(toolbar('closing',closing,{getPage:()=>hgetPage('closing'),setPage:()=>hsetPage('closing'),getAlign:()=>hgetAlign('closing'),setAlign:()=>hsetAlign('closing')}));}}

  function injectCss(){if(document.getElementById('antcv-editor-cleanup-331-css'))return;const s=document.createElement('style');s.id='antcv-editor-cleanup-331-css';s.textContent='@media (min-width:761px){.antcv-preview-core-actions,[data-antcv-mobile-preview-actions-strip-276],.antcv-preview-action-strip{display:none!important;visibility:hidden!important;pointer-events:none!important}}\n[data-antcv331-toolbar] button{font-family:Georgia,serif!important}';document.head.appendChild(s);}
  function run(){try{injectCss();fixFoundation();fixHIWC();}catch(e){try{console.warn('[editor-cleanup-331]',e&&e.message);}catch(_){}}}
  let pending=false;function schedule(){if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;run();});}
  function start(){run();[100,300,700,1500,3000].forEach(t=>setTimeout(run,t));try{new MutationObserver(schedule).observe(document.body||document.documentElement,{childList:true,subtree:true});}catch(_){}document.addEventListener('click',()=>setTimeout(run,0),true);window.addEventListener('resize',schedule,{passive:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  window.AntcvEditorLayoutCleanup331={version:VERSION,run};
})();
