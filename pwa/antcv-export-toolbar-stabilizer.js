/* AntCV export toolbar stabilizer (v1.40.317)
 * Keeps the three auxiliary top-bar actions (JD analysis, CV/CL fuse,
 * privacy status) aligned next to PDF/DOCX after switching between
 * preview and setup screens. These buttons are injected by sidecars,
 * while PDF/DOCX are React-owned, so the guard is DOM-level only.
 */
(function(){
  'use strict';
  if (window.__antcvExportToolbarStabilizer === '1.40.317') return;
  window.__antcvExportToolbarStabilizer = '1.40.317';

  var STYLE_ID = 'antcv-export-toolbar-stabilizer-style';
  var AUX_CLASS = 'antcv-toolbar-aux-action';
  var HOST_CLASS = 'antcv-export-toolbar-stable';
  var SLOT_CLASS = 'antcv-export-toolbar-aux-slot';

  function txt(el){ return ((el && (el.textContent || el.innerText)) || '').replace(/\s+/g,' ').trim(); }
  function label(el){
    if (!el) return '';
    return [
      txt(el),
      el.getAttribute && (el.getAttribute('title') || ''),
      el.getAttribute && (el.getAttribute('aria-label') || ''),
      el.dataset && Object.keys(el.dataset || {}).map(function(k){ return k + ' ' + el.dataset[k]; }).join(' '),
      el.className || '',
      el.id || ''
    ].join(' ').toLowerCase();
  }
  function visible(el){
    if (!el || el.nodeType !== 1) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity || '1') === 0) return false;
      var r = el.getBoundingClientRect();
      return r.width > 8 && r.height > 8;
    } catch(_) { return true; }
  }
  function isPdfButton(el){ return /(^|\s)(⬇\s*)?pdf(\s|$)/i.test(txt(el)) || /export.*pdf|pdf/i.test(label(el)); }
  function isDocxButton(el){ return /docx/i.test(txt(el)) || /export.*docx|docx/i.test(label(el)); }
  function findExportHost(){
    var buttons = Array.prototype.slice.call(document.querySelectorAll('button,[role="button"]'));
    var pdf = buttons.find(function(b){ return visible(b) && isPdfButton(b); });
    if (!pdf) return null;
    var cur = pdf;
    for (var i=0; cur && cur !== document.body && i<8; i++, cur=cur.parentElement) {
      if (!cur) break;
      var hasDocx = Array.prototype.slice.call(cur.querySelectorAll('button,[role="button"]')).some(function(b){ return b !== pdf && visible(b) && isDocxButton(b); });
      if (hasDocx) return { host:cur, pdf:pdf };
    }
    return { host:pdf.parentElement, pdf:pdf };
  }
  function isReactRootOwned(el){
    // Avoid moving React-owned PDF/DOCX/settings controls. Sidecar buttons are
    // normally plain DOM nodes without React's private expando properties.
    try {
      return Object.keys(el || {}).some(function(k){ return /^__react(Fiber|Props)\$/.test(k); });
    } catch(_) { return false; }
  }
  function isAuxAction(el, pdfRect){
    if (!visible(el) || isPdfButton(el) || isDocxButton(el)) return false;
    var l = label(el);
    if (/hard\s*refresh|close|settings|standard|advanced|account|personal|layout|application\s*history/i.test(l)) return false;
    if (/jd|job\s*description|analysis|analyse|fit|question|privacy|private|shield|fuse|fusion|merge|combine|cv.?cl|cover.?letter|graduation|cap|supervisor|word\s*warning/.test(l)) return true;
    if (!pdfRect) return false;
    try {
      var r = el.getBoundingClientRect();
      var nearPdf = Math.abs((r.top + r.height/2) - (pdfRect.top + pdfRect.height/2)) < 46 &&
        r.right <= pdfRect.left + 8 && r.right > pdfRect.left - 260;
      var buttonish = r.width >= 28 && r.width <= 72 && r.height >= 28 && r.height <= 72;
      return nearPdf && buttonish && !isReactRootOwned(el);
    } catch(_) { return false; }
  }
  function ensureStyles(){
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = '\n'
      + '.antcv-export-toolbar-stable{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex-wrap:nowrap!important;overflow:visible!important;min-width:0!important;}\n'
      + '.antcv-export-toolbar-stable>*{flex:0 0 auto!important;}\n'
      + '.antcv-export-toolbar-aux-slot{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:8px!important;flex:0 0 auto!important;flex-wrap:nowrap!important;min-width:max-content!important;overflow:visible!important;}\n'
      + '.antcv-toolbar-aux-action{display:inline-flex!important;align-items:center!important;justify-content:center!important;flex:0 0 auto!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;max-width:44px!important;max-height:44px!important;margin:0!important;position:relative!important;top:auto!important;right:auto!important;bottom:auto!important;left:auto!important;transform:none!important;border-radius:999px!important;white-space:nowrap!important;overflow:visible!important;z-index:2!important;color:#07545e!important;}\n'
      + '.antcv-toolbar-aux-action svg{display:block!important;max-width:22px!important;max-height:22px!important;fill:currentColor!important;stroke:currentColor!important;}\n'
      + '.antcv-toolbar-aux-action:empty::after{content:attr(title);font-size:0;}\n'
      + '@media(max-width:760px){.antcv-toolbar-aux-action{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;max-width:38px!important;max-height:38px!important}.antcv-export-toolbar-stable,.antcv-export-toolbar-aux-slot{gap:6px!important}}\n';
    document.head.appendChild(st);
  }
  function normaliseButton(btn){
    try {
      btn.classList.add(AUX_CLASS);
      btn.classList.add('no-print');
      btn.setAttribute('data-antcv-toolbar-aux','1');
      if (!btn.getAttribute('aria-label') && btn.getAttribute('title')) btn.setAttribute('aria-label', btn.getAttribute('title'));
      if (!btn.getAttribute('title')) {
        var l = label(btn);
        if (/privacy|shield/.test(l)) btn.setAttribute('title','Privacy status');
        else if (/fuse|fusion|merge|combine|cv.?cl|cover.?letter/.test(l)) btn.setAttribute('title','Fuse CV/CL');
        else if (/jd|job\s*description|analysis|fit|question/.test(l)) btn.setAttribute('title','JD analysis');
      }
    } catch(_) {}
  }
  function stabilise(){
    ensureStyles();
    var found = findExportHost();
    if (!found || !found.host || !found.pdf || !visible(found.pdf)) return;
    var host = found.host;
    var pdf = found.pdf;
    host.classList.add(HOST_CLASS);

    var slot = host.querySelector('.' + SLOT_CLASS);
    if (!slot) {
      slot = document.createElement('span');
      slot.className = SLOT_CLASS + ' no-print';
      slot.setAttribute('data-antcv-export-aux-slot','1');
      host.insertBefore(slot, pdf);
    } else if (slot.nextSibling !== pdf) {
      try { host.insertBefore(slot, pdf); } catch(_) {}
    }

    var pdfRect;
    try { pdfRect = pdf.getBoundingClientRect(); } catch(_) { pdfRect = null; }
    var nodes = Array.prototype.slice.call(document.querySelectorAll('button,[role="button"],a[role="button"],div[role="button"]'));
    var aux = nodes.filter(function(n){ return n !== slot && !slot.contains(n) && isAuxAction(n, pdfRect); });

    aux.forEach(function(btn){
      normaliseButton(btn);
      try { slot.appendChild(btn); } catch(_) {}
    });

    // Keep already parked aux buttons normalised after sidecar updates.
    Array.prototype.slice.call(slot.children).forEach(function(btn){
      if (btn && btn.nodeType === 1) normaliseButton(btn);
    });

    // Stable expected order: JD analysis, Fuse CV/CL, Privacy status, then any unknown aux.
    var order = function(el){
      var l = label(el);
      if (/jd|job\s*description|analysis|fit|question/.test(l)) return 1;
      if (/fuse|fusion|merge|combine|cv.?cl|cover.?letter/.test(l)) return 2;
      if (/privacy|private|shield/.test(l)) return 3;
      return 9;
    };
    Array.prototype.slice.call(slot.children).sort(function(a,b){ return order(a)-order(b); }).forEach(function(el){ slot.appendChild(el); });
  }

  var pending = false;
  function schedule(){
    if (pending) return;
    pending = true;
    requestAnimationFrame(function(){ pending = false; stabilise(); });
  }
  try { new MutationObserver(schedule).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','title','aria-label'] }); } catch(_) {}
  window.addEventListener('resize', schedule, true);
  window.addEventListener('hashchange', schedule, true);
  window.addEventListener('popstate', schedule, true);
  window.addEventListener('click', function(){ setTimeout(schedule, 0); setTimeout(schedule, 150); }, true);
  [0,50,150,300,700,1200,2000,3500].forEach(function(t){ setTimeout(schedule, t); });
  window.AntcvExportToolbarStabilizer = { version:'1.40.317', stabilise:stabilise };
})();
