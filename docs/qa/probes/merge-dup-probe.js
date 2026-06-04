/* MERGE-DUP live probe — paste into the running AntCV devtools console with
 * the Settings panel OPEN on the Personal / Writing-style area.
 * Read-only: reports only, mutates nothing. Copy the printed JSON back.
 */
(function () {
  function clean(s){ return String(s==null?'':s).replace(/[\t\n\r ]+/g,' ').trim(); }
  function visible(el){ try{ var c=getComputedStyle(el); if(c.display==='none'||c.visibility==='hidden')return false; var r=el.getBoundingClientRect(); return r.width>2&&r.height>2; }catch(_){ return false; } }
  function inPreview(el){ return !!(el.closest&&el.closest('.antcv-preview-paper,[data-antcv-preview-paper]')); }
  function path(el){ var out=[],n=el,d=0; while(n&&n.nodeType===1&&d<5){ var s=n.tagName.toLowerCase(); if(n.getAttribute&&n.getAttribute('data-antcv-react-island'))s+='[island='+n.getAttribute('data-antcv-react-island')+']'; if(n.getAttribute&&n.getAttribute('data-antcv-section-parent'))s+='[section-parent]'; out.unshift(s); n=n.parentElement; d++; } return out.join('>'); }
  function ancMarker(el){ var n=el,d=0; while(n&&d<8){ if(n.getAttribute&&n.getAttribute('data-antcv-pt-dedup-hidden'))return n.getAttribute('data-antcv-pt-dedup-hidden'); n=n.parentElement; d++; } return null; }

  var report = { version: null, dedupLoaded: null, engineOnWindow: [], styleSelects: [], toneChips: null, saveSlot: null, toneHelperHooks: 0 };
  try { report.version = (window.ANTCV_VERSION||document.querySelector('[data-antcv-version-rewritten]'))&&(window.ANTCV_VERSION||clean(document.querySelector('[data-antcv-version-rewritten]').textContent)); } catch(_){}
  report.dedupLoaded = window.__antcvPersonalTabDedup341 || false;
  ['setWritingStyleWithCascade','saveCurrentAsSlot','AntcvWritingPrefs','__antcvWritingPrefs','readWritingPrefs'].forEach(function(k){ if(typeof window[k]!=='undefined') report.engineOnWindow.push(k); });

  Array.prototype.forEach.call(document.querySelectorAll('select'), function(sel){
    if(inPreview(sel))return;
    var opts=sel.querySelectorAll('option'), hasNordic=false, hasAnn=false;
    Array.prototype.forEach.call(opts,function(o){ if(o.value==='nordic-minimal')hasNordic=true; if(/—\s+was\s+/i.test(o.textContent||''))hasAnn=true; });
    if(!hasNordic)return;
    report.styleSelects.push({ value: sel.value, hasOptgroup: sel.querySelectorAll('optgroup').length>0, hasAnnotation: hasAnn, visible: visible(sel), bridged: sel.getAttribute('data-antcv-pt-dedup-bridged')==='1', hiddenAncestor: ancMarker(sel), path: path(sel) });
  });

  Array.prototype.forEach.call(document.querySelectorAll('div'), function(d){
    if(clean(d.textContent||'')!=='Tone chips')return;
    report.toneChips={ visible: visible(d), hiddenAncestor: ancMarker(d), path: path(d) };
  });
  Array.prototype.forEach.call(document.querySelectorAll('button'), function(b){
    if(clean(b.textContent||'')!=='+ Save current as new slot')return;
    report.saveSlot={ visible: visible(b), hiddenAncestor: ancMarker(b), path: path(b) };
  });
  report.toneHelperHooks = document.querySelectorAll('[data-antcv-tone-helper-save],[data-antcv-tone-helper-load],[data-antcv-tone-helper-slot-select]').length;

  console.log('%c[MERGE-DUP PROBE]','font-weight:700;color:#01B7BB', report);
  console.log(JSON.stringify(report,null,2));
  return report;
})();
