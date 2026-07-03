/* antcv-cl-slogan-control.js — SLOGAN-CL-EDIT-001 (owner 2026-06-29, "do not forget")
 *
 * Make the COVER LETTER SLOGAN an editable thing with its own control, instead of
 * being silently derived (uppercased) from meta.subtitle with no way to edit or hide it.
 *
 * The slogan is the teal tagline heading at the TOP of the cover-letter body (SLOGAN-CL-001,
 * 1.50.960). Until now it ONLY read meta.subtitle. This control adds standalone localStorage
 * keys (cloud-restore-safe, like the signature control — see sidecar-prefs-clobber-hazard):
 *   antcv:clSlogan        override text  (empty  -> fall back to meta.subtitle, the old default)
 *   antcv:clSloganHidden  '1' | '0'      (default '0')
 *   antcv:clSloganAlign   'left'|'center'|'right'  (default 'center')
 *
 * The three render sites read these keys directly (no dependency on this sidecar):
 *   - app.src.js export srcdoc CL branch (the slogan IIFE at the top of the CL body td)
 *   - app.src.js React on-screen CL preview (slogan element above the section list)
 *   - the worker buildLinearDocument __slogan block, fed via antcv-docx-client meta.slogan*
 * So this file is PURE UI: it writes the keys and pokes a re-render. NO app.js mirror.
 *
 * Mount: ONCE, directly AFTER the CL signature control ([data-antcv-cl-sig-control]) in the
 * Layout tab, so the cover-letter format controls cluster together. Own data-marker
 * (data-antcv-cl-slogan-control); hides any duplicate that leaks into another panel.
 *
 * On change it dispatches 'antcv:sections-updated' so the React preview rebuilds (a localStorage
 * write alone does not re-render React) and the export srcdoc picks up the new value.
 */
(function () {
  'use strict';
  if (window.__antcvClSloganControl) return;
  window.__antcvClSloganControl = true;

  var K = {
    text: 'antcv:clSlogan',
    hidden: 'antcv:clSloganHidden',
    align: 'antcv:clSloganAlign',
    closing: 'antcv:clClosing',   // CL-CLOSING-EDIT-001: editable sign-off closing (default "At your service,")
    closingAlign: 'antcv:clClosingAlign', // CL-SIGNOFF-ALIGN-001: sign-off closing CJLR (default center)
    signName: 'antcv:clSignName',       // CL-SIGNNAME-001: editable sign-off name (default = first word of full name)
    signAlign: 'antcv:clSignNameAlign', // CL-SIGNNAME-001: sign-off name CJLR (default center)
    open: 'antcv:clSloganCtrlOpen'
  };
  var ACCENT = 'rgb(1,183,187)';
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function bump() {
    // The on-screen CL slogan is a React render that reads localStorage on each render; a write
    // alone does not re-render React. Fire the app's existing refresh so the preview rebuilds and
    // the slogan/align/hide change shows immediately. (The migration sidecars on this event are
    // idempotent — cheap no-ops.)
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-slogan-control' } })); } catch (_) {}
  }
  function isOpen() { return get(K.open, '0') === '1'; }
  function setOpen(v) { set(K.open, v ? '1' : '0'); }

  // The default (placeholder) the slogan falls back to = the candidate subtitle, uppercased,
  // with "|" turned into " • ". Read from the stored kernel showcase / personalInfo so the
  // control can SHOW the user what the empty field will render.
  function subtitleFallback() {
    // SLOGAN-SMART-STATEMENT-001 (owner 2026-07-04: "the slogan and the
    // specialization are definitely NOT the same for a specified job"): on a
    // TARGETED application the fallback is the gen's meta.cl_slogan (a smart
    // statement) — NEVER the specialization triad; no cl_slogan -> no slogan
    // line. Unsolicited keeps the standing specialization-derived default.
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var co = String(m.company || '').trim();
      if (co && !/^unsolicited$/i.test(co) && !/^open application$/i.test(co)) {
        var sm = String(m.cl_slogan || '').trim();
        return (sm && !/^\[/.test(sm)) ? sm.toUpperCase() : '';
      }
    } catch (_) {}
    function fromObj(o) {
      try {
        if (!o || typeof o !== 'object') return '';
        var s = o.subtitle || o.specialization || (o.meta && o.meta.subtitle) || '';
        return String(s || '');
      } catch (_) { return ''; }
    }
    var s = '';
    try { s = fromObj(JSON.parse(localStorage.getItem('kernelShowcase') || '{}')); } catch (_) {}
    if (!s) { try { s = fromObj(JSON.parse(localStorage.getItem('personalInfo') || '{}')); } catch (_) {} }
    s = String(s || '').replace(/\s*\|\s*/g, ' • ').trim();
    if (!s || /^\[/.test(s)) return '';
    return s.toUpperCase();
  }

  // The default (placeholder) for the sign-off name = the first word of the candidate's full name.
  function nameFirstWord() {
    try {
      var p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      var fn = String((p && p.name) || '').trim();
      return fn ? fn.split(/\s+/)[0] : '';
    } catch (_) { return ''; }
  }

  // ---- find the CL signature control (its own marker) to mount AFTER it ----
  function sigControl() {
    return document.querySelector('[data-antcv-cl-sig-control]');
  }

  function btn(txt, on) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.style.cssText = 'padding:4px 9px;margin:0;border-radius:5px;border:1px solid rgba(1,183,187,0.45);' +
      'background:rgba(1,183,187,0.10);color:' + ACCENT + ';font-size:10px;font-weight:600;cursor:pointer;';
    if (on) b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); on(b); });
    return b;
  }
  function setAlignActive(buttons, key) {
    var a = String(get(key || K.align, 'center')).replace(/["']/g, '').toLowerCase();
    if (a !== 'left' && a !== 'right' && a !== 'center') a = 'center';
    for (var k in buttons) {
      var active = (k === a);
      buttons[k].style.background = active ? ACCENT : 'rgba(1,183,187,0.10)';
      buttons[k].style.color = active ? '#04231f' : ACCENT;
    }
  }

  function build() {
    var box = document.createElement('div');
    box.setAttribute('data-antcv-cl-slogan-control', '1');
    box.style.cssText = 'margin:8px 0 0 0;padding:8px 10px;border:1px solid rgba(1,183,187,0.25);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);';

    // header (collapsible)
    var head = document.createElement('div');
    head.style.cssText = 'cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.04em;color:' + ACCENT + ';' +
      'display:flex;align-items:center;gap:6px;user-select:none;';
    head.setAttribute('role', 'button');
    head.title = 'Show / hide the cover-letter slogan controls';
    var caret = document.createElement('span');
    caret.style.cssText = 'font-size:9px;opacity:.7;';
    var htxt = document.createElement('span');
    htxt.textContent = 'COVER LETTER SLOGAN';
    head.appendChild(caret);
    head.appendChild(htxt);

    var body = document.createElement('div');
    body.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:8px;';

    // text input
    var textRow = document.createElement('div');
    textRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    var textIn = document.createElement('input');
    textIn.type = 'text';
    textIn.style.cssText = 'padding:6px 8px;font-size:11px;background:rgba(255,255,255,0.06);color:#fff;' +
      'border:1px solid rgba(255,255,255,0.18);border-radius:4px;font-family:inherit;';
    textIn.addEventListener('input', function () {
      var v = String(textIn.value || '').trim();
      if (v) set(K.text, v); else del(K.text);
      bump();
    });
    var note = document.createElement('div');
    note.style.cssText = 'font-size:9px;opacity:.6;line-height:1.4;';
    note.textContent = 'The teal tagline at the top of the cover letter. Leave empty to use the ' +
      'specialisation line. Rendered uppercase, with " | " shown as " • ".';
    textRow.appendChild(textIn);
    textRow.appendChild(note);

    // hidden toggle
    var hiddenRow = document.createElement('label');
    hiddenRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:#cdd;cursor:pointer;';
    var hiddenCb = document.createElement('input');
    hiddenCb.type = 'checkbox';
    hiddenCb.addEventListener('change', function () { set(K.hidden, hiddenCb.checked ? '1' : '0'); bump(); });
    hiddenRow.appendChild(hiddenCb);
    hiddenRow.appendChild(document.createTextNode('Hide the slogan'));

    // alignment
    var alignRow = document.createElement('div');
    alignRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:#cdd;';
    alignRow.appendChild(document.createTextNode('Align:'));
    var alignBtns = {};
    [['left', 'Left'], ['center', 'Center'], ['right', 'Right']].forEach(function (p) {
      var b = btn(p[1], function () { set(K.align, p[0]); setAlignActive(alignBtns); bump(); });
      alignBtns[p[0]] = b;
      alignRow.appendChild(b);
    });

    body.appendChild(textRow);
    body.appendChild(hiddenRow);
    body.appendChild(alignRow);

    // CL-CLOSING-EDIT-001: sign-off closing (the line above the name). Default "At your service,".
    var closingRow = document.createElement('div');
    closingRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;border-top:1px solid rgba(1,183,187,0.18);padding-top:8px;';
    var closingLbl = document.createElement('div');
    closingLbl.style.cssText = 'font-size:10px;font-weight:600;color:#cdd;';
    closingLbl.textContent = 'Sign-off closing';
    var closingIn = document.createElement('input');
    closingIn.type = 'text';
    closingIn.style.cssText = 'padding:6px 8px;font-size:11px;background:rgba(255,255,255,0.06);color:#fff;' +
      'border:1px solid rgba(255,255,255,0.18);border-radius:4px;font-family:inherit;';
    closingIn.placeholder = 'At your service,';
    closingIn.addEventListener('input', function () {
      var v = String(closingIn.value || '').trim();
      if (v) set(K.closing, v); else del(K.closing);
      bump();
    });
    var closingAlignRow = document.createElement('div');
    closingAlignRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:#cdd;';
    closingAlignRow.appendChild(document.createTextNode('Align:'));
    var closingAlignBtns = {};
    [['left', 'Left'], ['center', 'Center'], ['right', 'Right']].forEach(function (p) {
      var b = btn(p[1], function () { set(K.closingAlign, p[0]); setAlignActive(closingAlignBtns, K.closingAlign); bump(); });
      closingAlignBtns[p[0]] = b;
      closingAlignRow.appendChild(b);
    });
    var closingNote = document.createElement('div');
    closingNote.style.cssText = 'font-size:9px;opacity:.6;line-height:1.4;';
    closingNote.textContent = 'The line above your name (was "Kind regards,"). Leave empty for the default. Order: closing, name, signature.';
    closingRow.appendChild(closingLbl);
    closingRow.appendChild(closingIn);
    closingRow.appendChild(closingAlignRow);
    closingRow.appendChild(closingNote);
    body.appendChild(closingRow);

    // CL-SIGNNAME-001: sign-off NAME (the typed name under the signature) — editable + its own CJLR.
    var nameRow = document.createElement('div');
    nameRow.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    var nameLbl = document.createElement('div');
    nameLbl.style.cssText = 'font-size:10px;font-weight:600;color:#cdd;';
    nameLbl.textContent = 'Sign-off name';
    var nameIn = document.createElement('input');
    nameIn.type = 'text';
    nameIn.style.cssText = 'padding:6px 8px;font-size:11px;background:rgba(255,255,255,0.06);color:#fff;' +
      'border:1px solid rgba(255,255,255,0.18);border-radius:4px;font-family:inherit;';
    nameIn.addEventListener('input', function () {
      var v = String(nameIn.value || '').trim();
      if (v) set(K.signName, v); else del(K.signName);
      bump();
    });
    var nameNote = document.createElement('div');
    nameNote.style.cssText = 'font-size:9px;opacity:.6;line-height:1.4;';
    nameNote.textContent = 'The personal name above/below the signature. Defaults to your first name. The header name is unchanged.';
    var nameAlignRow = document.createElement('div');
    nameAlignRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:#cdd;';
    nameAlignRow.appendChild(document.createTextNode('Align:'));
    var nameAlignBtns = {};
    [['left', 'Left'], ['center', 'Center'], ['right', 'Right']].forEach(function (p) {
      var b = btn(p[1], function () { set(K.signAlign, p[0]); setAlignActive(nameAlignBtns, K.signAlign); bump(); });
      nameAlignBtns[p[0]] = b;
      nameAlignRow.appendChild(b);
    });
    nameRow.appendChild(nameLbl);
    nameRow.appendChild(nameIn);
    nameRow.appendChild(nameAlignRow);
    nameRow.appendChild(nameNote);
    body.appendChild(nameRow);

    box.appendChild(head);
    box.appendChild(body);

    head.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      setOpen(!isOpen()); applyOpen();
    });
    function applyOpen() {
      var o = isOpen();
      caret.textContent = o ? '▾' : '▸';
      body.style.display = o ? 'flex' : 'none';
    }
    box.__refresh = function () {
      textIn.value = get(K.text, '');
      var ph = subtitleFallback();
      textIn.placeholder = ph || 'e.g. PROCESSES • PRODUCTS • PEOPLE';
      hiddenCb.checked = get(K.hidden, '0') === '1';
      setAlignActive(alignBtns);
      closingIn.value = get(K.closing, '');
      setAlignActive(closingAlignBtns, K.closingAlign);
      nameIn.value = get(K.signName, '');
      nameIn.placeholder = nameFirstWord() || 'e.g. Gabriel';
      setAlignActive(nameAlignBtns, K.signAlign);
      applyOpen();
    };
    box.__refresh();
    return box;
  }

  var mounted = null;
  function refresh() { if (mounted && mounted.__refresh) mounted.__refresh(); }

  function scan() {
    // hide any duplicate we previously mounted that leaked into another panel
    var existing = document.querySelectorAll('[data-antcv-cl-slogan-control]');
    if (existing.length > 1) {
      for (var j = 1; j < existing.length; j++) { if (existing[j].parentNode) existing[j].parentNode.removeChild(existing[j]); }
    }
    if (mounted && mounted.isConnected) { return; }
    var sig = sigControl();
    if (!sig || !sig.parentNode) return; // wait for the signature control (mounts first, after PROFILE PHOTO)
    // already a slogan control right after the signature control? adopt it.
    if (sig.nextElementSibling && sig.nextElementSibling.getAttribute &&
      sig.nextElementSibling.getAttribute('data-antcv-cl-slogan-control') === '1') {
      mounted = sig.nextElementSibling; refresh(); return;
    }
    mounted = build();
    sig.parentNode.insertBefore(mounted, sig.nextSibling);
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; scan(); }, 150); }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; } }
  });
  function start() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    schedule();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
