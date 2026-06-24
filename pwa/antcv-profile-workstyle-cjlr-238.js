/* AntCV Profile + Work Style paragraph CJLR (v1.40.238)
 * - Adds CJLR in section rows between Compress and ON.
 * - Applies only to the single paragraph content for PROFILE and Work style.
 * - Keeps headings and section titles unchanged.
 */
(function(){
  'use strict';
  const VERSION = '1.50.845-boot-perf2';
  // v1.40.238-preview-guard: Preview is button-free. Profile/Work-style
  // CJLR controls must not attach to rows inside .antcv-preview-paper.
  const isInPreviewPaper = el => { if(!el) return false; const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]'); return !!(p && p.contains(el)); };
  const KEY = 'antcv.profileWorkstyleParagraphAlignment.v1';
  const ALIGN = ['center','justify','left','right'];
  const ICON = { left:'⇤', center:'↔', justify:'☰', right:'⇥' };
  const TITLES = { left:'Left aligned', center:'Centered', justify:'Justified', right:'Right aligned' };
  const SECTIONS = [
    { id:'profile', names:['profile'] },
    { id:'work_style', names:['work style','workstyle','work_style'] }
  ];
  const clean = s => String(s||'').replace(/\s+/g,' ').trim();
  const low = s => clean(s).toLowerCase();
  // BOOT-CJLR-PERF-001 (2026-06-23): this sidecar was the single biggest boot-freeze
  // contributor (~6s, ~37% of an owner-scale boot, profiled via diag-boot-cpu-profile.mjs).
  // Cause: panelRows() scanned EVERY button, climbed 7 ancestors each, and called
  // clean(ancestor.textContent) at each level — serializing the WHOLE document text +
  // running /\s+/g over it once PER button (buttons share ancestors, so the giant panel
  // node was re-serialized dozens of times per run, and run() fires many times on boot).
  // Fix: a per-run element→cleaned-text memo collapses those shared serializations to one,
  // and a length cap stops the climb at the first ancestor too big to be a control row.
  // Both are behaviour-preserving (a giant ancestor was never a valid single-section row).
  let __runTextCache = null;   // Map<Element,string> rebuilt each run(); null outside a run
  let __runLowCache = null;    // Map<Element,string> lowercased; same per-run lifecycle as __runTextCache
  const MAX_ROW_TEXT = 300;    // a section control row's cleaned text is short; bigger ⇒ not a row
  function cleanText(el){
    if(!el) return '';
    if(__runTextCache){ const c=__runTextCache.get(el); if(c!==undefined) return c; }
    const t = clean(el.textContent);
    if(__runTextCache) __runTextCache.set(el, t);
    return t;
  }
  // BOOT-CJLR-PERF-002 (nightly 2026-06-24): lowText was the single biggest boot
  // CPU consumer (~696ms self-time, profiled via diag-boot-profile.mjs). cleanText
  // was memoised per run but lowText's .toLowerCase() was NOT — and lowText runs on
  // the SAME big shared ancestors many times per run (editorBlocks' 10-deep climb
  // across every textarea, and findPreviewSection's all-element fallback scan ×2
  // sections). Memoising the lowercased string per run collapses those repeats.
  // Behaviour-preserving (pure memo, same per-run lifecycle as __runTextCache).
  const lowText = el => {
    if(!el) return '';
    if(__runLowCache){ const c=__runLowCache.get(el); if(c!==undefined) return c; }
    const t = cleanText(el).toLowerCase();
    if(__runLowCache) __runLowCache.set(el, t);
    return t;
  };
  const visible = el => !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const readMap = () => { try { const m=JSON.parse(localStorage.getItem(KEY)||'{}'); return m&&typeof m==='object'?m:{}; } catch(_){ return {}; } };
  const writeMap = m => { try { localStorage.setItem(KEY, JSON.stringify(m||{})); } catch(_){} };
  const getAlign = id => { const v=readMap()[id]; return ALIGN.includes(v)?v:'left'; };
  const setAlign = (id,v) => { const m=readMap(); m[id]=v; writeMap(m); };
  const next = v => ALIGN[(Math.max(0, ALIGN.indexOf(v))+1)%ALIGN.length];

  function sectionFromText(txt){
    const t = low(txt).replace(/\(main\)/g,'').trim();
    // PW-CJLR-PHOTO-LEAK-001 (owner 2026-06-17): "PROFILE PHOTO" text-matches
    // "profile" (t.startsWith('profile ')), so the photo card was treated as the
    // profile TEXT section and the cycler leaked between the SHADOW Off/On
    // buttons. The sister guard in sectionFromElement had this; the panel-row
    // path (which uses THIS fn) did not.
    if(/^profile\s*photo\b/.test(t)) return null;
    return SECTIONS.find(s => s.names.some(n => t === n || t.startsWith(n+' ')));
  }

  function sectionFromElement(el){
    if(!el) return null;
    const attrs = [el.getAttribute('data-sid'), el.getAttribute('data-section-id'), el.id, el.className].map(String).join(' ').toLowerCase();
    if(/work[_-]?style/.test(attrs)) return SECTIONS[1];
    if(/profile/.test(attrs)) return SECTIONS[0];
    const txt = lowText(el);
    // PW-CJLR-PHOTO-LEAK-001 (owner 2026-06-13): "PROFILE PHOTO" also starts
    // with "profile" — without this guard the workstyle CJLR cycler injected
    // into the PROFILE PHOTO card's Shape/Contour/Shadow rows (between the
    // SHADOW Off/On buttons), and the photo-bridge sidecar stripped it right
    // back → the button flickered ("blinking"). The photo card is NOT the
    // profile TEXT section.
    if(/^profile\b/.test(txt) && !/^profile\s*photo/.test(txt)) return SECTIONS[0];
    if(/^work style\b/.test(txt)) return SECTIONS[1];
    return null;
  }

  function panelRows(){
    const out=[];
    document.querySelectorAll('button').forEach(btn=>{
      if(isInPreviewPaper(btn)) return;
      // Never treat the PROFILE PHOTO card's Shape/Contour/Shadow rows as a
      // workstyle section (PW-CJLR-PHOTO-LEAK-001).
      if(btn.closest && btn.closest('.antcv-fp-shape-row')) return;
      if(btn.classList && btn.classList.contains('antcv-fp-shape-btn')) return;
      let p=btn.parentElement;
      for(let d=0; p && d<7; d++,p=p.parentElement){
        if(isInPreviewPaper(p)) break;
        // BOOT-CJLR-PERF-001: ancestors only grow going up; once one is bigger than
        // any plausible single-section control row, none above it is a target either,
        // so stop climbing. This is what avoids serializing the whole-document text
        // node (the dominant cost) — and it also skips the expensive shape-card
        // querySelector below on those giant subtrees.
        const text = cleanText(p);
        if(text.length > MAX_ROW_TEXT) break;
        // PW-CJLR-PHOTO-LEAK-001: never climb INTO the PROFILE PHOTO card. Its
        // Shape/Contour/Shadow rows carry the shadow Off/On buttons, and the
        // cycler was landing before that "On". Reject any ancestor that holds a
        // shape button / shadow toggle.
        if(p.querySelector && p.querySelector('.antcv-fp-shape-btn, .antcv-fp-shape-row, [data-shadow]')) continue;
        const sec = sectionFromText(text);
        if(sec && p.querySelectorAll && p.querySelectorAll('button').length>=3){
          if(!out.some(x=>x.row===p)) out.push({row:p, sec});
          break;
        }
      }
    });
    return out.filter(x=>visible(x.row));
  }

  function findButton(row, pred){ return Array.from(row.querySelectorAll(':scope button, button')).find(pred); }
  function findOn(row){ return findButton(row, b => /^\s*ON\s*$/i.test(b.textContent||'')); }
  function findDelete(row){ return findButton(row, b => /^\s*[×x]\s*$/i.test(b.textContent||'')); }
  function findCompress(row){ return findButton(row, b => /compress|comp|↹/i.test((b.title||'')+' '+(b.textContent||''))); }

  function styleButton(btn, id){
    const a = getAlign(id);
    btn.type='button';
    btn.textContent = ICON[a] || ICON.left;
    btn.title = (id==='profile'?'Profile':'Work Style') + ' paragraph alignment: ' + (TITLES[a]||a) + '. Click to cycle Center, Justify, Left, Right.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-profile-workstyle-cjlr','1');
    btn.setAttribute('data-antcv-pw-section', id);
    Object.assign(btn.style, {
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:'24px', minWidth:'24px', height:'24px', minHeight:'24px',
      padding:'0', margin:'0 2px', border:'1px solid #01B7BB', borderRadius:'5px',
      background:'rgba(1,183,187,0.08)', color:'#00746E', fontWeight:'700', fontSize:'13px',
      lineHeight:'1', cursor:'pointer', pointerEvents:'auto', opacity:'1'
    });
  }

  function ensurePanelButton(row, sec){
    row.querySelectorAll('button[data-antcv-profile-workstyle-cjlr="1"]').forEach(b=>{ if(b.getAttribute('data-antcv-pw-section')!==sec.id) b.remove(); });
    let btn = row.querySelector('button[data-antcv-profile-workstyle-cjlr="1"][data-antcv-pw-section="'+sec.id+'"]');
    const on = findOn(row) || findDelete(row);
    if(!btn){
      btn = document.createElement('button');
      btn.addEventListener('click', function(ev){
        ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        const cur = getAlign(sec.id), n = next(cur);
        setAlign(sec.id,n);
        styleButton(btn, sec.id);
        applyEditors();
        applyPreview();
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated',{detail:{source:'profile-workstyle-cjlr-238', section:sec.id, alignment:n}})); } catch(_){}
      }, true);
      if(on && on.parentElement) on.parentElement.insertBefore(btn,on); else row.appendChild(btn);
    } else if(on && btn.nextSibling !== on && btn.parentElement === on.parentElement) {
      try { on.parentElement.insertBefore(btn,on); } catch(_){}
    }
    styleButton(btn, sec.id);
  }

  function editorBlocks(){
    const blocks=[];
    document.querySelectorAll('textarea, [contenteditable="true"]').forEach(el=>{
      let p=el.parentElement, sec=null, host=null;
      for(let d=0; p && d<10; d++,p=p.parentElement){
        sec = sectionFromElement(p);
        if(sec){ host=p; break; }
      }
      if(sec && host && !blocks.some(x=>x.el===el)) blocks.push({el,sec,host});
    });
    return blocks.filter(x=>visible(x.el));
  }

  function applyEditors(){
    editorBlocks().forEach(({el,sec})=>{
      const a=getAlign(sec.id);
      // v1.50.80 — idempotency. These ran unconditionally every sweep on ~12
      // spans, and the sweep is woken ~13x/sec -> ~150 attribute mutations/sec
      // (confirmed top of the mutation-source probe). That storm woke every
      // body-MutationObserver in the app (the re-render loop). Only write when
      // the value actually differs so a stable state produces ZERO mutations.
      if(el.style.textAlign!==a) el.style.textAlign=a;
      if(el.getAttribute('data-antcv-profile-workstyle-align')!==a) el.setAttribute('data-antcv-profile-workstyle-align',a);
    });
  }

  function findPreviewSection(sec){
    const selectors = sec.id==='profile'
      ? ['[data-sid="profile"]','[data-section-id="profile"]','section[data-sid="profile"]']
      : ['[data-sid="work_style"]','[data-sid="workstyle"]','[data-section-id="work_style"]','[data-section-id="workstyle"]','section[data-sid="work_style"]'];
    for(const s of selectors){ const el=document.querySelector(s); if(el) return el; }
    const candidates = Array.from(document.querySelectorAll('[data-sid], [data-section-id], section, article, div'));
    return candidates.find(el => visible(el) && sectionFromElement(el) === sec) || null;
  }

  function textTargets(root){
    if(!root) return [];
    return Array.from(root.querySelectorAll('p,div,span,li,[data-antcv-editable-text="true"],[data-edit-path]')).filter(el=>{
      if(!visible(el)) return false;
      const txt=clean(el.textContent);
      if(!txt || txt.length<5) return false;
      if(/^(profile|work style)$/i.test(txt)) return false;
      if(el.closest('button')) return false;
      return true;
    });
  }

  function applyPreview(){
    SECTIONS.forEach(sec=>{
      const root=findPreviewSection(sec);
      const a=getAlign(sec.id);
      if(!root) return;
      textTargets(root).forEach(el=>{
        const owner = el.closest('[data-sid], [data-section-id]');
        if(owner && owner!==root && sectionFromElement(owner)!==sec) return;
        if(el.style.textAlign!==a) el.style.textAlign=a;
        if(el.getAttribute('data-antcv-profile-workstyle-preview-align')!==a) el.setAttribute('data-antcv-profile-workstyle-preview-align',a);
      });
    });
  }

  let pending=false;
  function run(){
    if(pending) return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      // BOOT-CJLR-PERF-001: fresh per-run text memo. The DOM does not mutate during
      // this synchronous sweep, so caching ancestor textContent within one run is
      // safe and collapses the shared-ancestor re-serialization that made boot slow.
      __runTextCache = new Map();
      __runLowCache = new Map();
      try{
        // PW-CJLR-PHOTO-LEAK-001: strip any cycler that already leaked into the
        // PROFILE PHOTO card (between the SHADOW Off/On buttons) before re-placing.
        document.querySelectorAll('button[data-antcv-profile-workstyle-cjlr="1"]').forEach(b=>{
          if(b.closest && (b.closest('.antcv-fp-shape-row') || b.closest('.antcv-fp-shape-btn'))){ b.remove(); return; }
          const sib = b.parentElement;
          if(sib && sib.querySelector && sib.querySelector('.antcv-fp-shape-btn, [data-shadow]')) b.remove();
        });
        panelRows().forEach(({row,sec})=>ensurePanelButton(row,sec));
        applyEditors();
        applyPreview();
      }catch(e){ try{ console.warn('[profile-workstyle-cjlr-238] failed:', e && e.message); }catch(_){} }
      finally{ __runTextCache = null; __runLowCache = null; }
    });
  }
  function start(){
    run(); [100,250,600,1200,2500,4500].forEach(ms=>setTimeout(run,ms));
    try { new MutationObserver(run).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']}); } catch(_){}
    window.addEventListener('input', run, true);
    window.addEventListener('click', ()=>setTimeout(run,0), true);
    window.addEventListener('antcv:sections-updated', run);
    setInterval(run, 1500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.AntcvProfileWorkstyleCjlr238 = { version: VERSION, run };
})();
