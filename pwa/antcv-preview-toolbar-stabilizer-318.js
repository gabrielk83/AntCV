/* AntCV preview toolbar stabilizer (v1.40.318)
 * Keeps the three small preview action buttons (JD Analysis, Fuse CV/CL, Privacy status)
 * in one stable strip immediately before PDF/DOCX. Reparents existing buttons only;
 * does not clone and does not change click handlers.
 */
(function(){
  'use strict';
  if (window.__antcvPreviewToolbarStabilizer === '1.40.318') return;
  window.__antcvPreviewToolbarStabilizer = '1.40.318';

  var ORDER = ['jd','fuse','privacy'];
  function txt(el){ return String((el && (el.getAttribute('aria-label') || el.title || el.textContent)) || '').replace(/\s+/g,' ').trim(); }
  function shown(el){
    if (!el || el.nodeType !== 1) return false;
    try { var cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden') return false; var r=el.getBoundingClientRect(); return r.width>4&&r.height>4; } catch(_) { return true; }
  }
  function kindOf(el){
    var s = txt(el).toLowerCase();
    var cls = String(el.className || '').toLowerCase();
    var id = String(el.id || '').toLowerCase();
    var all = s + ' ' + cls + ' ' + id;
    if (/privacy|shield|data\s*status|led/.test(all) || /🛡|🛡️/.test(el.textContent||'')) return 'privacy';
    if (/jd\s*analysis|job\s*description\s*analysis|analyse\s*jd|analy[sz]e\s*jd|target|bullseye/.test(all) || /🎯/.test(el.textContent||'')) return 'jd';
    if (/fuse|fusion|merge\s*(cv|cover)|cv\s*[\/+]\s*cl|cl\s*[\/+]\s*cv/.test(all) || /🔀|🔁|🧩/.test(el.textContent||'')) return 'fuse';
    return null;
  }
  function isSmallActionButton(el){
    if (!el || el.nodeType !== 1 || !/^BUTTON$/i.test(el.tagName)) return false;
    var k = kindOf(el); if (!k) return false;
    try {
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      var fixed = cs.position === 'fixed' || cs.position === 'absolute';
      var smallSquare = r.width >= 28 && r.width <= 78 && r.height >= 28 && r.height <= 78 && Math.abs(r.width-r.height) < 18;
      var circular = /999|50%|100px/.test(cs.borderRadius || '') || parseFloat(cs.borderRadius || '0') >= 18;
      // Avoid the large Analysis-panel text button "Fuse CL → CV".
      if (/fuse/i.test(txt(el)) && (r.width > 110 || r.height > 86)) return false;
      return fixed || smallSquare || circular || /antcv.*(fab|overlay|privacy|fusion|jd)/i.test(String(el.className||''));
    } catch(_) { return true; }
  }
  function previewToolbar(){ return document.querySelector('.antcv-preview-actions'); }
  function exportButtons(){ return document.querySelector('.antcv-preview-actions .antcv-export-buttons'); }
  function ensureStrip(){
    var bar = previewToolbar(); var exp = exportButtons();
    if (!bar || !exp) return null;
    var strip = bar.querySelector('.antcv-preview-action-strip');
    if (!strip) {
      strip = document.createElement('div');
      strip.className = 'antcv-preview-action-strip no-print';
      strip.setAttribute('data-antcv-preview-action-strip','true');
      exp.parentNode.insertBefore(strip, exp);
    }
    return strip;
  }
  function allCandidateButtons(){
    return Array.from(document.querySelectorAll('button')).filter(isSmallActionButton);
  }
  function normalizeButton(btn, kind){
    btn.setAttribute('data-antcv-preview-action-kind', kind);
    btn.classList.add('antcv-preview-mini-action');
    var title = btn.title || btn.getAttribute('aria-label') || '';
    if (!title) {
      if (kind === 'jd') title = 'JD analysis';
      if (kind === 'fuse') title = 'Fuse CV/CL';
      if (kind === 'privacy') title = 'Privacy status';
      btn.title = title; btn.setAttribute('aria-label', title);
    }
    btn.style.setProperty('position','static','important');
    btn.style.setProperty('inset','auto','important');
    btn.style.setProperty('left','auto','important');
    btn.style.setProperty('right','auto','important');
    btn.style.setProperty('top','auto','important');
    btn.style.setProperty('bottom','auto','important');
    btn.style.setProperty('transform','none','important');
    btn.style.setProperty('margin','0','important');
    btn.style.setProperty('flex','0 0 54px','important');
    btn.style.setProperty('width','54px','important');
    btn.style.setProperty('height','54px','important');
    btn.style.setProperty('min-width','54px','important');
    btn.style.setProperty('min-height','54px','important');
    btn.style.setProperty('max-width','54px','important');
    btn.style.setProperty('max-height','54px','important');
    btn.style.setProperty('border-radius','999px','important');
    btn.style.setProperty('z-index','1','important');
    btn.style.setProperty('display','inline-flex','important');
    btn.style.setProperty('align-items','center','important');
    btn.style.setProperty('justify-content','center','important');
    btn.style.setProperty('box-sizing','border-box','important');
    btn.style.setProperty('overflow','hidden','important');
  }
  function stabilize(){
    var strip = ensureStrip(); var exp = exportButtons(); var bar = previewToolbar();
    if (!strip || !exp || !bar) return;
    var byKind = {};
    allCandidateButtons().forEach(function(btn){
      var k = kindOf(btn); if (!k) return;
      // Prefer buttons already inside the strip or floating overlay. Do not steal export buttons.
      if (btn.closest('.antcv-export-buttons')) return;
      if (!byKind[k] || btn.closest('.antcv-preview-action-strip')) byKind[k] = btn;
    });
    ORDER.forEach(function(k){
      var btn = byKind[k]; if (!btn) return;
      normalizeButton(btn,k);
      if (btn.parentNode !== strip) strip.appendChild(btn);
    });
    // Keep order deterministic.
    ORDER.forEach(function(k){ var b=strip.querySelector('[data-antcv-preview-action-kind="'+k+'"]'); if(b) strip.appendChild(b); });
    // Hide duplicate small action buttons elsewhere in the toolbar/overlay, but keep originals in strip.
    allCandidateButtons().forEach(function(btn){
      var k = kindOf(btn); if (!k || btn.closest('.antcv-preview-action-strip')) return;
      if (byKind[k] && byKind[k] !== btn) btn.style.setProperty('display','none','important');
    });
  }
  function injectStyle(){
    if (document.getElementById('antcv-preview-toolbar-stabilizer-style')) return;
    var st = document.createElement('style');
    st.id = 'antcv-preview-toolbar-stabilizer-style';
    st.textContent = '\n.antcv-preview-actions{display:flex!important;align-items:center!important;gap:8px!important;flex-wrap:nowrap!important;overflow:visible!important;min-height:66px!important;}\n' +
      '.antcv-preview-actions>.antcv-export-buttons{display:flex!important;align-items:center!important;gap:8px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;margin-left:auto!important;}\n' +
      '.antcv-preview-action-strip{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;min-width:178px!important;margin-left:auto!important;}\n' +
      '.antcv-preview-mini-action{box-shadow:0 3px 12px rgba(0,0,0,.16)!important;}\n' +
      '@media (max-width:720px){.antcv-preview-action-strip{gap:6px!important;min-width:154px!important}.antcv-preview-mini-action{width:46px!important;height:46px!important;min-width:46px!important;min-height:46px!important;max-width:46px!important;max-height:46px!important;flex-basis:46px!important}.antcv-preview-actions{gap:6px!important;padding-left:8px!important;padding-right:8px!important}.antcv-preview-actions>.antcv-export-buttons button{min-height:46px!important;padding-left:12px!important;padding-right:12px!important}}';
    document.head.appendChild(st);
  }
  function run(){ injectStyle(); stabilize(); }
  try { new MutationObserver(function(){ requestAnimationFrame(run); }).observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['style','class','title','aria-label']}); } catch(_) {}
  window.addEventListener('resize', run, {passive:true});
  document.addEventListener('click', function(){ setTimeout(run,0); setTimeout(run,80); setTimeout(run,250); }, true);
  [0,50,150,350,800,1500,3000].forEach(function(t){ setTimeout(run,t); });
  window.AntcvPreviewToolbarStabilizer = {version:'1.40.318', run:run};
})();
