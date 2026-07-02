/* antcv-cl-slogan-element.js — CL-SLOGAN-ELEMENT-001 + CL-SIGNOFF-ELEMENT-001 (owner 2026-07-03, register row 22 phase 1)
 *
 * Owner: "place this as a cover letter settings element — the slogan is supposed to be a
 * rich_content object", "CL slogan is supposed to be the first element in BODY section",
 * "sincerely yours / best regards also need to be panel element and so does signature —
 * signature is the final BODY section element".
 *
 * This sidecar surfaces the three CL frame pieces AS ELEMENTS of the cover-letter sections
 * panel (the Body list), with rich_block-grade affordances (show/hide, inline edit, CJLR):
 *   1. COVER LETTER SLOGAN  — FIRST element, above Greeting   (antcv:clSlogan/-Hidden/-Align)
 *   2. SIGN-OFF             — after the last section (Closure): closing line ("At your
 *      service," / "Best regards,") + sign-off name            (antcv:clClosing/-Align,
 *                                                               antcv:clSignName/-Align)
 *   3. SIGNATURE            — FINAL element: show/hide + CJLR  (antcv:signatureHidden/
 *      for the drawn/uploaded signature image                   signatureAlign/-B64/-Rev)
 *
 * PURE UI over the SAME restore-safe standalone keys the render sites read (see
 * sidecar-prefs-clobber-hazard: these keys exist because cloud-restore clobbered
 * section-based prose; the data deliberately does NOT move into sections.cl here).
 * Phase 2 (row 22) = real sections.cl rich_block objects, which needs coordinated
 * dedupe at the 3 render sites + the worker. Image upload/draw stays in Settings →
 * COVER LETTER FORMAT (the full signature control).
 *
 * Anchor: the deepest node whose text equals the first/last CL section title, whose
 * ancestor row carries the ▲ move button (panel rows only — the on-paper preview has no
 * move buttons), inside a container that also shows the opposite-end title. Foreign-DOM
 * safety: the app loads antcv-react-dom-guard.js; text inputs commit on change (not per
 * keystroke) so the sections-updated re-render doesn't steal the caret.
 * Kill switch: localStorage['antcv:disable-cl-slogan-element']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.91-cl-body-elements';
  if (window.__antcvClSloganElement) return;
  window.__antcvClSloganElement = VERSION;

  var ACCENT = '#01B7BB';
  var K = {
    text: 'antcv:clSlogan', hidden: 'antcv:clSloganHidden', align: 'antcv:clSloganAlign',
    closing: 'antcv:clClosing', closingAlign: 'antcv:clClosingAlign',
    signName: 'antcv:clSignName', signAlign: 'antcv:clSignNameAlign',
    sigB64: 'antcv:signatureB64', sigAlign: 'antcv:signatureAlign', sigHidden: 'antcv:signatureHidden', sigRev: 'antcv:signatureRev'
  };

  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function disabled() { var v = get('antcv:disable-cl-slogan-element', '0'); return v === '1' || v === 'true'; }
  function bump() { try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-slogan-element' } })); } catch (_) {} }
  function sigBump() {
    // the signature render sites listen on their own rev/event (mirror of the sig control)
    set(K.sigRev, String((parseInt(get(K.sigRev, '0'), 10) || 0) + 1));
    try { window.dispatchEvent(new CustomEvent('antcv:signature-changed')); } catch (_) {}
    bump();
  }
  function sanitizeAlign(v, d) {
    var a = String(v == null ? d : v).replace(/["']/g, '').toLowerCase();
    return (a === 'left' || a === 'right' || a === 'center') ? a : d;
  }

  // Effective slogan the CL renders: override key, else the specialisation subtitle,
  // uppercased with " | " shown as " • " (same derivation as the render sites).
  function subtitleFallback() {
    function fromObj(o) {
      try { return String((o && (o.subtitle || o.specialization || (o.meta && o.meta.subtitle))) || ''); } catch (_) { return ''; }
    }
    var s = '';
    try { s = fromObj(JSON.parse(localStorage.getItem('kernelShowcase') || '{}')); } catch (_) {}
    if (!s) { try { s = fromObj(JSON.parse(localStorage.getItem('personalInfo') || '{}')); } catch (_) {} }
    s = String(s || '').replace(/\s*\|\s*/g, ' • ').trim();
    if (!s || /^\[/.test(s)) return '';
    return s.toUpperCase();
  }
  function nameFirstWord() {
    try {
      var p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      var fn = String((p && p.name) || '').trim();
      return fn ? fn.split(/\s+/)[0] : '';
    } catch (_) { return ''; }
  }
  function cfg() {
    return { text: get(K.text, ''), hidden: get(K.hidden, '0') === '1', align: sanitizeAlign(get(K.align, null), 'center') };
  }
  function effectiveText() {
    var c = cfg();
    return (c.text ? c.text.toUpperCase() : subtitleFallback());
  }
  function signoffCfg() {
    return {
      closing: get(K.closing, ''), closingAlign: sanitizeAlign(get(K.closingAlign, null), 'center'),
      name: get(K.signName, ''), nameAlign: sanitizeAlign(get(K.signAlign, null), 'center')
    };
  }
  function sigCfg() {
    return {
      hidden: get(K.sigHidden, '0') === '1',
      align: sanitizeAlign(get(K.sigAlign, null), 'center'),
      stored: !!get(K.sigB64, '')
    };
  }

  // ---- CL panel anchor discovery ----
  function clTitles() {
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      var cl = secs && Array.isArray(secs.cl) ? secs.cl : [];
      var t = [];
      for (var i = 0; i < cl.length; i++) { if (cl[i] && cl[i].title) t.push(String(cl[i].title)); }
      return t;
    } catch (_) { return []; }
  }
  function rowOf(el) {
    // walk up to the panel ROW: the nearest ancestor that carries a ▲ move button
    var a = el;
    for (var i = 0; i < 7 && a && a !== document.body; i++) {
      try {
        var btns = a.querySelectorAll ? a.querySelectorAll('button') : [];
        for (var j = 0; j < btns.length; j++) {
          if (String(btns[j].textContent || '').trim() === '▲') return a;
        }
      } catch (_) {}
      a = a.parentElement;
    }
    return null;
  }
  function findClRow(wantTitle, confirmTitle) {
    var nodes = document.querySelectorAll('div,span');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (String(el.textContent || '').trim() !== wantTitle) continue;
      if (el.querySelector && el.querySelector('div,span')) continue; // want the deepest match
      var row = rowOf(el);
      if (!row || !row.parentElement) continue;
      // CL-panel confirmation: the list container also shows the opposite-end title
      if (String(row.parentElement.textContent || '').indexOf(confirmTitle) === -1) continue;
      return row;
    }
    return null;
  }

  // ---- shared row scaffolding ----
  var openState = { slogan: false, signoff: false, signature: false };
  function mkAlignBtns(key, refresh, afterWrite) {
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:10px;color:#cdd;';
    wrap.appendChild(document.createTextNode('Align:'));
    var btns = {};
    [['Left', 'left'], ['Center', 'center'], ['Right', 'right']].forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = p[0];
      b.style.cssText = 'padding:3px 8px;border-radius:5px;border:1px solid rgba(1,183,187,0.45);font-size:10px;font-weight:600;cursor:pointer;';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); set(key, p[1]); refresh(); (afterWrite || bump)(); });
      btns[p[1]] = b;
      wrap.appendChild(b);
    });
    wrap.__paint = function () {
      var a = sanitizeAlign(get(key, null), 'center');
      for (var k in btns) {
        var on = (k === a);
        btns[k].style.background = on ? ACCENT : 'rgba(1,183,187,0.10)';
        btns[k].style.color = on ? '#04231f' : ACCENT;
      }
    };
    return wrap;
  }
  function mkInput(key, refresh, afterWrite) {
    var input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = 'padding:5px 8px;font-size:11px;background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:4px;font-family:inherit;';
    // commit on change/Enter (NOT per keystroke): the sections-updated re-render would
    // rebuild this foreign row and steal the caret mid-word.
    input.addEventListener('change', function () {
      var v = String(input.value || '').trim();
      if (v) set(key, v); else del(key);
      refresh(); (afterWrite || bump)();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    input.__paint = function () { if (document.activeElement !== input) input.value = get(key, ''); };
    return input;
  }
  function mkShell(kind, label, headTitle) {
    var box = document.createElement('div');
    box.setAttribute('data-antcv-cl-slogan-element', kind);
    box.style.cssText = 'margin:2px 0 4px 0;padding:6px 8px;border:1px dashed rgba(1,183,187,0.4);border-radius:6px;background:rgba(1,183,187,0.05);';
    var head = document.createElement('div');
    head.setAttribute('role', 'button');
    head.title = headTitle;
    head.style.cssText = 'cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.04em;color:' + ACCENT + ';display:flex;align-items:center;gap:6px;user-select:none;';
    var caret = document.createElement('span');
    caret.style.cssText = 'font-size:9px;opacity:.7;';
    var lbl = document.createElement('span');
    lbl.textContent = label;
    var preview = document.createElement('span');
    preview.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400;font-size:9px;opacity:.65;color:#cdd;';
    head.appendChild(caret); head.appendChild(lbl); head.appendChild(preview);
    var body = document.createElement('div');
    body.style.cssText = 'margin-top:6px;display:none;flex-direction:column;gap:6px;';
    box.appendChild(head); box.appendChild(body);
    head.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openState[kind] = !openState[kind];
      if (box.__refresh) box.__refresh();
    });
    return { box: box, head: head, caret: caret, preview: preview, body: body };
  }
  function mkEye(headTitle, isHidden, toggle) {
    var eye = document.createElement('button');
    eye.type = 'button';
    eye.title = headTitle;
    eye.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;padding:0 2px;line-height:1;';
    eye.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); toggle(); });
    eye.__paint = function () { eye.textContent = isHidden() ? '🚫' : '👁'; };
    return eye;
  }
  function mkNote(text) {
    var note = document.createElement('div');
    note.style.cssText = 'font-size:9px;opacity:.55;line-height:1.4;color:#cdd;';
    note.textContent = text;
    return note;
  }
  function mkSub(text) {
    var d = document.createElement('div');
    d.style.cssText = 'font-size:10px;font-weight:600;color:#cdd;';
    d.textContent = text;
    return d;
  }

  // ---- element 1: SLOGAN (first) ----
  function buildSloganRow() {
    var s = mkShell('slogan', 'COVER LETTER SLOGAN', 'The teal tagline at the top of the cover letter — click to edit');
    var eye = mkEye('Show / hide the slogan', function () { return cfg().hidden; }, function () {
      set(K.hidden, cfg().hidden ? '0' : '1'); s.box.__refresh(); bump();
    });
    s.head.appendChild(eye);
    var input = mkInput(K.text, function () { s.box.__refresh(); });
    var alignRow = mkAlignBtns(K.align, function () { s.box.__refresh(); });
    s.body.appendChild(input); s.body.appendChild(alignRow);
    s.body.appendChild(mkNote('Leave empty to use the specialisation line. Same store as Settings → COVER LETTER FORMAT.'));
    s.box.__refresh = function () {
      var c = cfg();
      s.caret.textContent = openState.slogan ? '▾' : '▸';
      s.body.style.display = openState.slogan ? 'flex' : 'none';
      var eff = effectiveText();
      s.preview.textContent = c.hidden ? '(hidden)' : (eff || '(empty)');
      s.preview.style.textDecoration = c.hidden ? 'line-through' : 'none';
      eye.__paint();
      input.__paint();
      input.placeholder = subtitleFallback() || 'e.g. PROCESSES • PRODUCTS • PEOPLE';
      alignRow.__paint();
    };
    s.box.__refresh();
    return s.box;
  }

  // ---- element 2: SIGN-OFF (closing line + typed name; after the last section) ----
  function buildSignoffRow() {
    var s = mkShell('signoff', 'SIGN-OFF', 'The closing line ("At your service," / "Best regards,") and the typed name — click to edit');
    var closingIn = mkInput(K.closing, function () { s.box.__refresh(); });
    var closingAlign = mkAlignBtns(K.closingAlign, function () { s.box.__refresh(); });
    var nameIn = mkInput(K.signName, function () { s.box.__refresh(); });
    var nameAlign = mkAlignBtns(K.signAlign, function () { s.box.__refresh(); });
    s.body.appendChild(mkSub('Closing line'));
    s.body.appendChild(closingIn); s.body.appendChild(closingAlign);
    s.body.appendChild(mkSub('Sign-off name'));
    s.body.appendChild(nameIn); s.body.appendChild(nameAlign);
    s.body.appendChild(mkNote('Order on paper: closing, name, signature. Empty = defaults. Same store as Settings → COVER LETTER FORMAT.'));
    s.box.__refresh = function () {
      var c = signoffCfg();
      s.caret.textContent = openState.signoff ? '▾' : '▸';
      s.body.style.display = openState.signoff ? 'flex' : 'none';
      s.preview.textContent = (c.closing || 'At your service,') + ' ' + (c.name || nameFirstWord() || '');
      closingIn.__paint(); closingIn.placeholder = 'At your service,';
      nameIn.__paint(); nameIn.placeholder = nameFirstWord() || 'e.g. Gabriel';
      closingAlign.__paint(); nameAlign.__paint();
    };
    s.box.__refresh();
    return s.box;
  }

  // ---- element 3: SIGNATURE (image; FINAL element) ----
  function buildSignatureRow() {
    var s = mkShell('signature', 'SIGNATURE', 'The drawn/uploaded signature image — show/hide + alignment');
    var eye = mkEye('Show / hide the signature', function () { return sigCfg().hidden; }, function () {
      set(K.sigHidden, sigCfg().hidden ? '0' : '1'); s.box.__refresh(); sigBump();
    });
    s.head.appendChild(eye);
    var alignRow = mkAlignBtns(K.sigAlign, function () { s.box.__refresh(); }, sigBump);
    s.body.appendChild(alignRow);
    s.body.appendChild(mkNote('Upload / draw / resize the signature in Settings → COVER LETTER FORMAT.'));
    s.box.__refresh = function () {
      var c = sigCfg();
      s.caret.textContent = openState.signature ? '▾' : '▸';
      s.body.style.display = openState.signature ? 'flex' : 'none';
      s.preview.textContent = c.hidden ? '(hidden)' : (c.stored ? '(image stored)' : '(no image yet)');
      s.preview.style.textDecoration = c.hidden ? 'line-through' : 'none';
      eye.__paint();
      alignRow.__paint();
    };
    s.box.__refresh();
    return s.box;
  }

  // ---- mount ----
  var mounted = { slogan: null, signoff: null, signature: null };
  function adoptOrBuild(kind, build) {
    var all = document.querySelectorAll('[data-antcv-cl-slogan-element="' + kind + '"]');
    for (var i = 1; i < all.length; i++) { if (all[i].parentNode) all[i].parentNode.removeChild(all[i]); }
    return (all[0] && all[0].isConnected) ? all[0] : build();
  }
  function scan() {
    if (disabled()) {
      for (var k in mounted) { if (mounted[k] && mounted[k].parentNode) mounted[k].parentNode.removeChild(mounted[k]); mounted[k] = null; }
      return;
    }
    var titles = clTitles();
    if (titles.length < 2) return;
    var first = titles[0], last = titles[titles.length - 1];

    if (!(mounted.slogan && mounted.slogan.isConnected)) {
      var firstRow = findClRow(first, last);
      if (firstRow) {
        mounted.slogan = adoptOrBuild('slogan', buildSloganRow);
        if (!mounted.slogan.isConnected) firstRow.parentElement.insertBefore(mounted.slogan, firstRow);
      }
    } else if (mounted.slogan.__refresh) mounted.slogan.__refresh();

    var lastRow = null;
    function needLastRow() { if (lastRow === null) lastRow = findClRow(last, first) || false; return lastRow; }
    // insertion order below keeps the paper order: … Closure, SIGN-OFF, SIGNATURE(final)
    if (!(mounted.signoff && mounted.signoff.isConnected)) {
      var lr = needLastRow();
      if (lr) {
        mounted.signoff = adoptOrBuild('signoff', buildSignoffRow);
        if (!mounted.signoff.isConnected) lr.parentElement.insertBefore(mounted.signoff, lr.nextSibling);
      }
    } else if (mounted.signoff.__refresh) mounted.signoff.__refresh();

    if (!(mounted.signature && mounted.signature.isConnected)) {
      var anchor = (mounted.signoff && mounted.signoff.isConnected) ? mounted.signoff : needLastRow();
      if (anchor) {
        mounted.signature = adoptOrBuild('signature', buildSignatureRow);
        if (!mounted.signature.isConnected) anchor.parentElement.insertBefore(mounted.signature, anchor.nextSibling);
      }
    } else if (mounted.signature.__refresh) mounted.signature.__refresh();
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; scan(); }, 200); }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      if ((muts[i].addedNodes && muts[i].addedNodes.length) || (muts[i].removedNodes && muts[i].removedNodes.length)) { schedule(); return; }
    }
  });
  function start() { try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {} schedule(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.AntcvClSloganElement = {
    version: VERSION, scan: scan,
    _cfg: cfg, _effectiveText: effectiveText, _clTitles: clTitles,
    _signoffCfg: signoffCfg, _sigCfg: sigCfg
  };
})();
