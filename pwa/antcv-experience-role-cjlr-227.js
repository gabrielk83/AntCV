/* AntCV Professional Experience per-role CJLR fix (v1.40.227)
 * - one CJLR button per role card
 * - changes only that role's body/content textarea in the panel
 * - mirrors the same alignment into the preview content text
 * - does not align role title, company, or year fields
 */
(function(){
  'use strict';
  const VERSION = '1.40.227';
  const KEY = 'antcv.experienceRoleContentAlignment.v2';
  const ALIGN = ['center','justify','left','right'];
  const ICON = { left:'⇤', center:'↔', justify:'☰', right:'⇥' };
  const LABEL = { left:'Left aligned', center:'Centered', justify:'Justified', right:'Right aligned' };
  const clean = s => String(s||'').replace(/\s+/g,' ').trim();
  const readMap = () => { try { const x=JSON.parse(localStorage.getItem(KEY)||'{}'); return x&&typeof x==='object'?x:{}; } catch(_){ return {}; } };
  const writeMap = m => { try { localStorage.setItem(KEY, JSON.stringify(m||{})); } catch(_){} };
  const getAlign = i => { const v=readMap()['role-'+i]; return ALIGN.includes(v)?v:'left'; };
  const setAlign = (i,v) => { const m=readMap(); m['role-'+i]=v; writeMap(m); };
  const next = v => ALIGN[(Math.max(0, ALIGN.indexOf(v))+1)%ALIGN.length];

  function removeOldBrokenButtons(){
    document.querySelectorAll('button[data-antcv-role-content-cjlr="1"]:not([data-antcv-role-cjlr-227="1"])').forEach(b=>{
      try { b.remove(); } catch(_) { b.style.display='none'; }
    });
  }

  function roleCardForTextarea(ta){
    let p = ta && ta.parentElement;
    let best = null;
    for(let depth=0; p && depth<9; depth++, p=p.parentElement){
      const tas = p.querySelectorAll ? p.querySelectorAll('textarea') : [];
      const inputs = p.querySelectorAll ? p.querySelectorAll('input') : [];
      const buttons = p.querySelectorAll ? p.querySelectorAll('button') : [];
      const txt = clean(p.textContent);
      const looksRole = /\[?Role title\]?/i.test(txt) || Array.from(inputs).some(i=>/role title/i.test(i.placeholder||i.value||''));
      const hasHeadingFields = inputs.length >= 3 && Array.from(inputs).some(i=>/company/i.test(i.placeholder||i.value||'')) && Array.from(inputs).some(i=>/yyyy|year/i.test(i.placeholder||i.value||''));
      if(tas.length === 1 && hasHeadingFields && buttons.length >= 2 && looksRole){ best = p; break; }
      if(tas.length === 1 && hasHeadingFields && looksRole) best = p;
      if(tas.length > 1 && best) break;
    }
    return best;
  }

  function findEditorCards(){
    const cards=[];
    document.querySelectorAll('textarea').forEach(ta=>{
      const c=roleCardForTextarea(ta);
      if(c && !cards.includes(c)) cards.push(c);
    });
    return cards;
  }

  function controlsParent(card){
    const on = Array.from(card.querySelectorAll('button')).find(b=>/^\s*ON\s*$/i.test(b.textContent||''));
    if(on && on.parentElement) return { parent:on.parentElement, before:on };
    const del = Array.from(card.querySelectorAll('button')).find(b=>/^\s*[×x]\s*$/i.test(b.textContent||''));
    if(del && del.parentElement) return { parent:del.parentElement, before:del };
    return { parent:card, before:null };
  }

  function applyEditor(card, align){
    card.querySelectorAll('textarea').forEach(ta=>{
      ta.style.textAlign = align;
      ta.setAttribute('data-antcv-role-content-align', align);
    });
  }

  function ensureButton(card, idx){
    const align = getAlign(idx);
    applyEditor(card, align);
    let btn = card.querySelector('button[data-antcv-role-cjlr-227="1"]');
    const slot = controlsParent(card);
    if(!btn){
      btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-antcv-role-cjlr-227','1');
      btn.setAttribute('data-antcv-role-content-cjlr','1');
      btn.addEventListener('click', function(ev){
        ev.preventDefault(); ev.stopPropagation(); if(ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        const current = getAlign(idx);
        const n = next(current);
        setAlign(idx,n);
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
    btn.textContent = ICON[align] || ICON.left;
    btn.title = 'Role content alignment: ' + (LABEL[align] || align) + '. Click to cycle Center, Justify, Left, Right.';
    btn.setAttribute('aria-label', btn.title);
    Object.assign(btn.style, {
      display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:'30px', minWidth:'30px', height:'26px', minHeight:'26px',
      padding:'0', margin:'0 2px', border:'1px solid #01B7BB', borderRadius:'5px',
      background:'rgba(1, 183, 187, 0.08)', color:'#00746E', fontWeight:'700', fontSize:'14px',
      lineHeight:'1', cursor:'pointer', order:'44', pointerEvents:'auto', opacity:'1'
    });
  }

  function getRoleLines(){
    return findEditorCards().map(card=>{
      const ta = card.querySelector('textarea');
      return String(ta && ta.value || '').split(/\n+/).map(clean).filter(x=>x && !/^\[?bullet \d/i.test(x)).concat(
        String(ta && ta.value || '').split(/\n+/).map(clean).filter(x=>x && /^\[?bullet \d/i.test(x))
      );
    });
  }

  function smallestTextElement(root, needle){
    if(!root || !needle) return null;
    let found = null;
    const all = Array.from(root.querySelectorAll('p,li,div,span,td'));
    for(const el of all){
      const txt = clean(el.textContent);
      if(!txt || !txt.includes(needle)) continue;
      const childHas = Array.from(el.children || []).some(ch => clean(ch.textContent).includes(needle));
      if(!childHas){ found = el; break; }
    }
    return found;
  }

  function applyPreview(){
    const sec = document.querySelector('[data-sid="experience"]');
    if(!sec) return;
    const roleLines = getRoleLines();
    roleLines.forEach((lines, idx)=>{
      const align = getAlign(idx);
      const needles = lines.slice(0,4).filter(x=>x.length >= 5);
      needles.forEach(n=>{
        const el = smallestTextElement(sec, n);
        if(!el) return;
        el.style.textAlign = align;
        el.setAttribute('data-antcv-role-preview-align', align);
        let p = el.parentElement;
        for(let i=0; p && i<2; i++, p=p.parentElement){
          if(clean(p.textContent).includes(n) && !/^\s*(\[?Role title\]?|Professional Experience)/i.test(clean(p.textContent))) {
            p.style.textAlign = align;
            p.setAttribute('data-antcv-role-preview-align', align);
          }
        }
      });
    });
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
      }catch(e){ try{ console.warn('[experience-role-cjlr-227] failed:', e && e.message); }catch(_){} }
    });
  }

  function start(){
    run();
    [100,250,600,1200,2500,4500].forEach(ms=>setTimeout(run,ms));
    try { new MutationObserver(run).observe(document.body||document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style','value']}); } catch(_){}
    window.addEventListener('input', run, true);
    window.addEventListener('antcv:sections-updated', run);
    setInterval(run, 1500);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.AntcvExperienceRoleCjlr227 = { version: VERSION, run, _findEditorCards: findEditorCards, _applyPreview: applyPreview };
})();
