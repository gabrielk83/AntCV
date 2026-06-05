/* AntCV sidebar subsection page breaks (v1.40.329)
 * Regulatory Context + Additional Information sidebar items:
 * - page buttons move the item and following sidebar content to the selected page
 * - item 0 page break moves the whole subsection, including heading
 * - continuation breaks repeat SECTION (Cont.)
 * - sidebar background is extended so continued pages keep the color field
 */
(function(){
  'use strict';
  var VERSION = '1.50.132-flood-fix';
  if (window.__antcvSidebarSubsectionPagebreaks === VERSION) return;
  window.__antcvSidebarSubsectionPagebreaks = VERSION;

  var PAGE_KEY = 'antcv:itemPages';
  var SECTIONS_KEY = 'sections';
  var TARGET = /regulatory context|additional information/i;
  var COLORS = { 1:'#01B7BB', 2:'#D98C00', 3:'#7B2FF2', 4:'#B85E3B' };

  function norm(s){ return String(s || '').replace(/\s+/g,' ').trim(); }
  function readJson(k, fallback){ try{ var v=JSON.parse(localStorage.getItem(k)||''); return v && typeof v === 'object' ? v : fallback; }catch(_){ return fallback; } }
  function activeDoc(){ try{ var d=localStorage.getItem('doc')||''; try{ var p=JSON.parse(d); if(typeof p==='string') d=p; }catch(e){} return String(d).toLowerCase() === 'cl' ? 'cl' : 'cv'; }catch(_){ return 'cv'; } }
  function sections(){ var all=readJson(SECTIONS_KEY,{}); var list=all && all[activeDoc()]; return Array.isArray(list) ? list : []; }
  function sectionBySid(sid){ return sections().find(function(s){ return s && String(s.id||'') === String(sid||''); }) || null; }
  // v1.50.115 — page breaks apply to EVERY sidebar sub/subsection, not just
  // Regulatory Context / Additional Information. Still only acts where a break is
  // actually set (bucket keys >= 2), so untouched sidebar sections stay as-is.
  function isTargetSection(s){ return !!(s && String(s.loc||'').toLowerCase() === 'sidebar'); }
  function readPages(){ return readJson(PAGE_KEY,{}); }
  function bucket(sid){ var m=readPages(); return m && m[sid] && typeof m[sid] === 'object' ? m[sid] : {}; }
  function pageOf(sid, idx){ var b=bucket(sid); var n=Number(b[String(idx)]); return Number.isFinite(n) && n >= 2 && n <= 4 ? (n|0) : 1; }

  function injectCss(){
    if (document.getElementById('antcv-sidebar-subsection-pagebreaks-329-css')) return;
    var st=document.createElement('style');
    st.id='antcv-sidebar-subsection-pagebreaks-329-css';
    st.textContent = [
      '.antcv-preview-paper .antcv-document-sidebar,.antcv-preview-paper [data-antcv-document-sidebar="true"]{background:#283556!important;min-height:1122px!important;align-self:stretch!important;}',
      '.antcv-sidebar-pagebreak-329{break-before:page;page-break-before:always;height:0;margin:0;padding:0;line-height:0;}',
      '.antcv-sidebar-pagebar-329{display:block;margin:8pt 0 6pt 0;padding:4pt 6pt;border:0;border-radius:2px;color:#fff;background:rgba(217,140,0,0.92);font-weight:700;font-size:8.5pt;letter-spacing:.02em;text-transform:uppercase;text-align:center;}',
      '.antcv-sidebar-cont-329{display:block;margin:4pt 0 8pt 0;padding:0 0 3pt 0;border-bottom:1pt solid #01B7BB;color:#01B7BB;font-weight:700;font-size:10pt;text-align:center;}',
      'button[data-antcv-rowfix-control="page"],button[data-antcv-addinfo-control="page"],button[data-antcv-core-page],button.antcv-core-page{transition:border-color .12s,background .12s,color .12s;}',
      '[data-antcv-sidebar-page-p="2"]{border-color:#D98C00!important;color:#D98C00!important;background:rgba(217,140,0,.10)!important;}',
      '[data-antcv-sidebar-page-p="3"]{border-color:#7B2FF2!important;color:#7B2FF2!important;background:rgba(123,47,242,.10)!important;}',
      '[data-antcv-sidebar-page-p="4"]{border-color:#B85E3B!important;color:#B85E3B!important;background:rgba(184,94,59,.10)!important;}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function clearMarkers(root){
    root.querySelectorAll('[data-antcv-sidebar-pagebreak-329="1"],[data-antcv-sidebar-cont-329="1"]').forEach(function(n){ try{ n.remove(); }catch(_){} });
  }
  function findSidebarPaper(){ return document.querySelector('.antcv-preview-paper,[data-antcv-preview-paper]'); }
  function sectionTitle(sid){ var s=sectionBySid(sid); return String((s && s.title) || 'SECTION').toUpperCase(); }
  function itemElements(sectionEl){
    var out=[];
    sectionEl.querySelectorAll('[data-antcv-row-path^="items."]').forEach(function(el){
      var p=String(el.getAttribute('data-antcv-row-path')||'');
      if (!/^items\.\d+$/.test(p)) return;
      var idx=Number(p.split('.')[1]);
      if (!Number.isFinite(idx)) return;
      if (!out[idx] || out[idx].contains(el)) out[idx]=el;
    });
    if (out.filter(Boolean).length) return out;
    var kids=Array.from(sectionEl.children).filter(function(ch){
      if (ch.getAttribute && (ch.getAttribute('data-antcv-sidebar-pagebreak-329') === '1' || ch.getAttribute('data-antcv-sidebar-cont-329') === '1')) return false;
      var tag=(ch.tagName||'').toLowerCase();
      return !/^(h1|h2|h3|hr|table)$/i.test(tag) && norm(ch.textContent).length > 0;
    });
    return kids;
  }
  // PB-003: continuation suffix is localised via antcv-i18n.
  function contSuffix(){
    var i18n = window.AntcvI18n;
    if (i18n && typeof i18n.t === 'function') {
      return i18n.t('pb.cont', '(CONT.)');
    }
    return '(CONT.)';
  }
  function makeBreakBar(page, title, cont){
    var frag=document.createDocumentFragment();
    var suffix = contSuffix();
    var br=document.createElement('div'); br.setAttribute('data-antcv-sidebar-pagebreak-329','1'); br.className='antcv-sidebar-pagebreak-329'; br.setAttribute('aria-hidden','true');
    var bar=document.createElement('div'); bar.setAttribute('data-antcv-sidebar-pagebreak-329','1'); bar.className='antcv-sidebar-pagebar-329'; bar.textContent='PAGE '+page+' — '+title+(cont?' '+suffix:'');
    var head=document.createElement('div'); head.setAttribute('data-antcv-sidebar-cont-329','1'); head.className='antcv-sidebar-cont-329'; head.textContent=title+' '+suffix;
    frag.appendChild(br); frag.appendChild(bar); if(cont) frag.appendChild(head); return frag;
  }
  function applySection(secEl){
    var sid=secEl.getAttribute('data-sid'); if(!sid) return;
    var sec=sectionBySid(sid); if(!isTargetSection(sec)) return;
    clearMarkers(secEl);
    var b=bucket(sid); var keys=Object.keys(b).map(function(k){return parseInt(k,10);}).filter(function(n){return Number.isFinite(n) && Number(b[String(n)]) >= 2;}).sort(function(a,b){return a-b;});
    if(!keys.length) return;
    var title=sectionTitle(sid);
    if(keys.indexOf(0) >= 0){
      var p0=pageOf(sid,0);
      secEl.parentNode && secEl.parentNode.insertBefore(makeBreakBar(p0,title,false),secEl);
      keys=keys.filter(function(k){return k!==0;});
    }
    var items=itemElements(secEl);
    keys.forEach(function(idx){
      var target=items[idx]; if(!target || !target.parentNode) return;
      target.parentNode.insertBefore(makeBreakBar(pageOf(sid,idx),title,true),target);
    });
  }
  function applyPreview(){
    injectCss();
    var paper=findSidebarPaper(); if(!paper) return;
    var sidebar=paper.querySelector('.antcv-document-sidebar,[data-antcv-document-sidebar="true"]') || paper;
    sidebar.setAttribute('data-antcv-sidebar-bg-extended','1');
    // v1.50.132: clear ALL 329 markers from the sidebar root BEFORE re-applying.
    // The item-0 bar is inserted as a sibling *before* the section element, so
    // the per-section clearMarkers(secEl) never removed it and bars accumulated
    // into a flood on every re-run. Root-level clear fixes the accumulation.
    clearMarkers(sidebar);
    Array.from(sidebar.querySelectorAll('[data-sid]')).forEach(applySection);
  }

  function paintPageButtons(){
    document.querySelectorAll('button').forEach(function(b){
      var txt=norm(b.textContent); var m=txt.match(/^📄\s*([1-4])$/); if(!m) return;
      var p=Number(m[1]); b.setAttribute('data-antcv-sidebar-page-p', String(p));
      var c=COLORS[p] || COLORS[1];
      b.style.borderColor=c; b.style.color=c; b.style.background=p===1?'rgba(1,183,187,.08)':'rgba(255,255,255,.10)';
    });
  }
  function schedule(){ clearTimeout(schedule._t); schedule._t=setTimeout(function(){ try{ paintPageButtons(); applyPreview(); }catch(e){ try{console.warn('[sidebar-pagebreaks-329]',e&&e.message);}catch(_){} } },50); }
  document.addEventListener('click', function(ev){
    var b=ev.target && ev.target.closest && ev.target.closest('button');
    if(b && /^📄/.test(norm(b.textContent))) setTimeout(function(){ try{ window.dispatchEvent(new Event('antcv:item-pages-changed')); }catch(_){} schedule(); },80);
  }, true);
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('antcv:item-pages-changed', schedule);
  window.addEventListener('storage', function(ev){ if(ev && ev.key === PAGE_KEY) schedule(); });
  try{ new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,characterData:true}); }catch(_){}
  [0,150,600,1500,3000].forEach(function(t){ setTimeout(schedule,t); });
  window.AntcvSidebarSubsectionPagebreaks329={version:VERSION,apply:applyPreview,paint:paintPageButtons};
})();
