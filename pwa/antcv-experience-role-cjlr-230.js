/* AntCV Professional Experience per-role CJLR fix (v1.40.230)
 * - one CJLR button per role/sub-sub-section
 * - each button affects only its own role body/content
 * - applies to all body content lines for that role in the editor and preview
 * - does not align role title, company, or year heading fields
 */
(function(){
  'use strict';
  const VERSION = '1.51.59-idempotent-sweep';
  // v1.40.230-preview-guard: Preview is button-free. Role cards from
  // inside .antcv-preview-paper must not get CJLR buttons.
  const isInPreviewPaper = el => { if(!el) return false; const p=document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]'); return !!(p && p.contains(el)); };
  const KEY = 'antcv.experienceRoleContentAlignment.v2';
  // CJLR-EXPERIENCE-EXPORT-001 (owner 2026-07-13): the export payload builder
  // (antcv-docx-client alignFor) reads antcvItemAlignment[<sid>] and forwards it
  // to the worker as item_alignment. Bridge the experience CJLR here so the PDF
  // stops ignoring it. Keyed by the SAME path the worker reads (paraAlignPath
  // "roles.<ri>.bullets.<bi>").
  const ITEM_ALIGN_KEY = 'antcvItemAlignment';
  const EXP_SID = 'experience';
  const BULLET_PATH_RE = /^roles\.\d+\.bullets\.\d+$/;
  const ALIGN = ['center','justify','left','right'];
  const ICON = { left:'⇤', center:'↔', justify:'☰', right:'⇥' };
  const LABEL = { left:'Left aligned', center:'Centered', justify:'Justified', right:'Right aligned' };
  const clean = s => String(s||'').replace(/\s+/g,' ').trim();
  const visible = el => !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length));
  const readMap = () => { try { const x=JSON.parse(localStorage.getItem(KEY)||'{}'); return x&&typeof x==='object'?x:{}; } catch(_){ return {}; } };
  const writeMap = m => { try { localStorage.setItem(KEY, JSON.stringify(m||{})); } catch(_){} };
  const getAlign = i => { const v=readMap()['role-'+i]; return ALIGN.includes(v)?v:'left'; };
  const setAlign = (i,v) => { const m=readMap(); m['role-'+i]=v; writeMap(m); };
  const next = v => ALIGN[(Math.max(0, ALIGN.indexOf(v))+1)%ALIGN.length];

  function removeOldBrokenButtons(){
    document.querySelectorAll('button[data-antcv-role-content-cjlr="1"]:not([data-antcv-role-cjlr-230="1"])').forEach(b=>{
      try { b.remove(); } catch(_) { b.style.display='none'; }
    });
  }

  // SETTINGS-PERSONAL-FREEZE-001 (owner 2026-07-03): a role card's text is short.
  // Climbing past this size serialized nearly the WHOLE document textContent per
  // textarea per level (the CPU profile's 49% querySelector + clean storm that
  // froze the tab when Settings → Personal added its inputs). Same cap pattern
  // as BOOT-CJLR-PERF-001 in profile-workstyle-cjlr-238.
  const MAX_CARD_TEXT = 4000;
  function roleCardForTextarea(ta){
    let p = ta && ta.parentElement;
    let best = null;
    for(let depth=0; p && depth<10; depth++, p=p.parentElement){
      if(!p.querySelectorAll) continue;
      const raw = p.textContent || '';
      if(raw.length > MAX_CARD_TEXT) break;          // ancestors only grow — none above is a card
      const tas = p.querySelectorAll('textarea');
      const inputs = Array.from(p.querySelectorAll('input'));
      const buttons = p.querySelectorAll('button');
      const txt = clean(raw);
      const looksRole = /\[?Role title\]?/i.test(txt) || inputs.some(i=>/role title/i.test(i.placeholder||i.value||''));
      const hasHeadingFields = inputs.length >= 3 && inputs.some(i=>/company/i.test(i.placeholder||i.value||'')) && inputs.some(i=>/yyyy|year/i.test(i.placeholder||i.value||''));
      if(tas.length === 1 && hasHeadingFields && looksRole && buttons.length >= 2){ best = p; break; }
      if(tas.length === 1 && hasHeadingFields && looksRole) best = p;
      if(tas.length > 1 && best) break;
    }
    return best;
  }

  function findEditorCards(){
    const cards=[];
    document.querySelectorAll('textarea').forEach(ta=>{
      if(isInPreviewPaper(ta)) return;
      const c=roleCardForTextarea(ta);
      if(c && !isInPreviewPaper(c) && !cards.includes(c)) cards.push(c);
    });
    return cards.filter(visible);
  }

  function controlsParent(card){
    const on = Array.from(card.querySelectorAll('button')).find(b=>/^\s*ON\s*$/i.test(b.textContent||''));
    if(on && on.parentElement) return { parent:on.parentElement, before:on };
    const del = Array.from(card.querySelectorAll('button')).find(b=>/^\s*[×x]\s*$/i.test(b.textContent||''));
    if(del && del.parentElement) return { parent:del.parentElement, before:del };
    return { parent:card, before:null };
  }

  function applyEditor(card, align){
    const ta = card && card.querySelector('textarea');
    if(!ta) return;
    // SETTINGS-PERSONAL-FREEZE-001: write-on-change only (v1.50.80 idempotency
    // pattern). Unconditional style/attribute writes retriggered this sidecar's
    // OWN MutationObserver (attributeFilter includes 'style') on every pass —
    // back-to-back multi-second rAF bodies = the owner's button loop / freeze.
    if(ta.style.textAlign !== align) ta.style.textAlign = align;
    if(ta.getAttribute('data-antcv-role-content-align') !== align) ta.setAttribute('data-antcv-role-content-align', align);
  }

  function ensureButton(card, idx){
    const align = getAlign(idx);
    applyEditor(card, align);
    // Remove any accidental extra button inside this card.
    const existing = Array.from(card.querySelectorAll('button[data-antcv-role-cjlr-230="1"]'));
    existing.slice(1).forEach(b=>{ try{ b.remove(); }catch(_){} });
    let btn = existing[0] || null;
    const slot = controlsParent(card);
    if(!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-antcv-role-cjlr-230','1');
      btn.setAttribute('data-antcv-role-content-cjlr','1');
      btn.addEventListener('click', function(ev){
        ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        const cards = findEditorCards();
        const liveIdx = Math.max(0, cards.indexOf(card));
        const current = getAlign(liveIdx);
        const n = next(current);
        setAlign(liveIdx,n);
        paintButton(btn,n);
        applyEditor(card,n);
        applyPreview();
      }, true);
      if(slot.before) slot.parent.insertBefore(btn, slot.before); else slot.parent.appendChild(btn);
    } else if(btn.parentElement !== slot.parent && slot.parent){
      try { if(slot.before) slot.parent.insertBefore(btn, slot.before); else slot.parent.appendChild(btn); } catch(_){}
    }
    paintButton(btn, align);
  }

  function paintButton(btn, align){
    // SETTINGS-PERSONAL-FREEZE-001: every write guarded so a stable state
    // produces ZERO mutations (the observer below watches style/childList).
    const icon = ICON[align] || ICON.left;
    if(btn.textContent !== icon) btn.textContent = icon;
    const title = 'Role content alignment: ' + (LABEL[align] || align) + '. Click to cycle Center, Justify, Left, Right.';
    if(btn.title !== title){ btn.title = title; btn.setAttribute('aria-label', title); }
    if(btn.getAttribute('data-antcv-230-styled') !== '1'){
      btn.setAttribute('data-antcv-230-styled','1');
      Object.assign(btn.style, {
        display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:'30px', minWidth:'30px', height:'26px', minHeight:'26px',
        padding:'0', margin:'0 2px', border:'1px solid #01B7BB', borderRadius:'5px',
        background:'rgba(1, 183, 187, 0.08)', color:'#00746E', fontWeight:'700', fontSize:'14px',
        lineHeight:'1', cursor:'pointer', order:'44', pointerEvents:'auto', opacity:'1'
      });
    }
  }

  function roleData(){
    return findEditorCards().map((card, idx)=>{
      const ta = card.querySelector('textarea');
      const lines = String(ta && ta.value || '').split(/\n+/).map(clean).filter(Boolean);
      return { idx, card, align:getAlign(idx), lines };
    });
  }

  function previewSection(){
    return document.querySelector('[data-sid="experience"], [data-section-id="experience"], section[data-sid="experience"]');
  }

  function textNodesInOrder(root){
    const selector = 'p,li,div,span,td,blockquote';
    return Array.from(root.querySelectorAll(selector)).filter(el=>{
      if(!visible(el)) return false;
      const txt = clean(el.textContent);
      if(!txt) return false;
      if(/professional experience/i.test(txt) && txt.length < 80) return false;
      if(/^\s*(\[?Role title\]?|\[?Company name\]?|\[?YYYY\s*[–-]\s*YYYY\]?)\s*$/i.test(txt)) return false;
      return true;
    });
  }

  function smallestMatchingElement(root, needle, used){
    if(!root || !needle) return null;
    const all = textNodesInOrder(root);
    for(const el of all){
      if(used.has(el)) continue;
      const txt = clean(el.textContent);
      if(!txt.includes(needle)) continue;
      // Prefer a leaf-like text element; if child also contains it, let the child match later.
      const childHas = Array.from(el.children || []).some(ch => clean(ch.textContent).includes(needle));
      if(childHas) continue;
      return el;
    }
    for(const el of all){
      if(!used.has(el) && clean(el.textContent).includes(needle)) return el;
    }
    return null;
  }

  function applyPreviewElement(el, align){
    if(!el) return;
    if(el.style.textAlign !== align) el.style.textAlign = align;
    if(el.getAttribute('data-antcv-role-preview-align') !== align) el.setAttribute('data-antcv-role-preview-align', align);
    // List containers need the same setting, otherwise bullets can stay left while text changes.
    let p = el.parentElement;
    for(let i=0; p && i<3; i++, p=p.parentElement){
      const tag = (p.tagName||'').toLowerCase();
      if(tag === 'ul' || tag === 'ol' || tag === 'p'){
        if(p.style.textAlign !== align) p.style.textAlign = align;
        if(p.getAttribute('data-antcv-role-preview-align') !== align) p.setAttribute('data-antcv-role-preview-align', align);
      }
    }
  }

  // CJLR-EXPERIENCE-EXPORT-001: write-on-change persist of the EFFECTIVE preview
  // alignment into the export bridge. We forward ONLY the role-bullet paths the
  // preview actually resolved this pass, so the PDF mirrors the preview exactly
  // (no index math, no unilateral default — pure parity). Non role-bullet keys
  // already under experience (e.g. a manual __group__) are preserved.
  function persistBridge(bridge){
    try{
      if(typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(ITEM_ALIGN_KEY);
      const all = raw ? (JSON.parse(raw) || {}) : {};
      if(!all || typeof all !== 'object' || Array.isArray(all)) return;
      const prev = (all[EXP_SID] && typeof all[EXP_SID] === 'object' && !Array.isArray(all[EXP_SID])) ? all[EXP_SID] : {};
      const next = {};
      for(const k of Object.keys(prev)) if(!BULLET_PATH_RE.test(k)) next[k] = prev[k];
      for(const k of Object.keys(bridge)) next[k] = bridge[k];
      if(JSON.stringify(prev) === JSON.stringify(next)) return; // no mutation → no write
      if(Object.keys(next).length) all[EXP_SID] = next; else delete all[EXP_SID];
      localStorage.setItem(ITEM_ALIGN_KEY, JSON.stringify(all));
    }catch(_){}
  }

  function applyPreview(){
    const sec = previewSection();
    if(!sec) return;
    const used = new Set();
    const bridge = {};
    roleData().forEach(role=>{
      // Apply every content line for this role, in preview DOM order. This prevents role 1
      // from stealing role 2+ content when placeholder text is repeated.
      role.lines.forEach(line=>{
        const needle = line.length > 90 ? line.slice(0,90) : line;
        if(!needle || needle.length < 3) return;
        const el = smallestMatchingElement(sec, needle, used);
        if(!el) return;
        used.add(el);
        applyPreviewElement(el, role.align);
        // CJLR-EXPERIENCE-EXPORT-001: capture the preview block's own path marker
        // (roles.<t>.bullets.<n>, set in app.src.js) and mirror this alignment to
        // the export bridge so the PDF stops justifying what the preview left/etc.
        try{
          const pe = el.closest ? el.closest('[data-antcv-row-path]') : null;
          const rp = pe && pe.getAttribute('data-antcv-row-path');
          if(rp && BULLET_PATH_RE.test(rp)) bridge[rp] = role.align;
        }catch(_){}
      });
    });
    persistBridge(bridge);
  }

  let pending=false;
  function run(){
    if(pending) return;
    pending=true;
    requestAnimationFrame(()=>{
      pending=false;
      try{
        removeOldBrokenButtons();
        const cards=findEditorCards();
        cards.forEach((c,i)=>ensureButton(c,i));
        applyPreview();
      }catch(e){ try{ console.warn('[experience-role-cjlr-230] failed:', e && e.message); }catch(_){} }
    });
  }

  // SETTINGS-PERSONAL-FREEZE-001: trailing debounce for observer-driven runs.
  // Per-pass cost scales with the number of editor textareas; reacting to every
  // mutation burst back-to-back is what saturated the main thread. 300ms trailing
  // keeps the buttons responsive while merging storms into one pass.
  let moT = null;
  function runSoon(){ if(moT) return; moT = setTimeout(()=>{ moT = null; run(); }, 300); }
  function start(){
    run();
    [100,250,600,1200,2500,4500].forEach(ms=>setTimeout(run,ms));
    try { new MutationObserver(runSoon).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']}); } catch(_){}
    window.addEventListener('input', runSoon, true);
    window.addEventListener('click', ()=>setTimeout(run,0), true);
    window.addEventListener('antcv:sections-updated', runSoon);
    setInterval(run, 2500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.AntcvExperienceRoleCjlr230 = { version: VERSION, run, _findEditorCards: findEditorCards, _applyPreview: applyPreview };
})();
