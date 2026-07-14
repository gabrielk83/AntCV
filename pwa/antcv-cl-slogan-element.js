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
    return (a === 'left' || a === 'right' || a === 'center' || a === 'justify') ? a : d;
  }

  // SPEC-SLOGAN-LANG-001 (owner 2026-07-13, "should not be danish if I am set
  // to english spanish chinese etc"): a candidate specialization that is in the
  // WRONG SCRIPT for the current ribbon (e.g. a Latin/Danish triad on a zh/ar/
  // he/ru app) is a stale other-language value — reject it so the generic hint
  // shows instead. Self-contained (no babel-relang dependency); Latin-script
  // ribbons pass through (Danish vs English can't be told apart by script — the
  // source-order flip below handles those).
  var SPEC_SCRIPTS = {
    zh: /[一-鿿]/, ja: /[぀-ヿ一-鿿]/, ko: /[가-힯]/,
    ar: /[؀-ۿ]/, fa: /[؀-ۿ]/, he: /[֐-׿]/,
    ru: /[Ѐ-ӿ]/, el: /[Ͱ-Ͽ]/, th: /[฀-๿]/, am: /[ሀ-፿]/
  };
  function spellsCurrentScript(txt) {
    try {
      var L = String(localStorage.getItem('language') || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2) || 'en';
      var re = SPEC_SCRIPTS[L];
      return re ? re.test(String(txt || '')) : true;
    } catch (_) { return true; }
  }

  // Effective slogan the CL renders: override key, else the specialisation subtitle,
  // uppercased with " | " shown as " • " (same derivation as the render sites).
  function subtitleFallback() {
    // SLOGAN-SMART-STATEMENT-001: targeted app -> the gen's meta.cl_slogan or
    // NOTHING; the specialization triad never doubles as the slogan (owner
    // 2026-07-04). Unsolicited keeps the standing default.
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var co = String(m.company || '').trim();
      if (co && !(window.__ANTCV_UNSOL_RE || /^unsolicited$/i).test(co) && !/^open application$/i.test(co)) { // UNSOL-PILLAR-LANG-001: any language variant
        var sm = String(m.cl_slogan || '').trim();
        // SLOGAN-QUALITY-GATE-001: a low-quality generated slogan renders NOWHERE.
        if (sm && typeof window.__antcvSloganQualityOk === 'function' && !window.__antcvSloganQualityOk(sm, m)) sm = '';
        return (sm && !/^\[/.test(sm)) ? sm.toUpperCase() : '';
      }
    } catch (_) {}
    function fromObj(o) {
      try { return String((o && (o.subtitle || o.specialization || (o.meta && o.meta.subtitle))) || ''); } catch (_) { return ''; }
    }
    // SPEC-SLOGAN-LANG-001: read personalInfo.specialization FIRST — that is the
    // store the header renders from AND the babel-fish translate pass keeps in
    // the current ribbon language (kernelShowcase holds the raw GENERATION-language
    // output and is never re-langed, so it was forcing e.g. the Danish triad on an
    // English/Spanish/Chinese app). kernelShowcase is now the last resort only.
    var s = '';
    try { s = fromObj(JSON.parse(localStorage.getItem('personalInfo') || '{}')); } catch (_) {}
    if (!s) { try { s = fromObj(JSON.parse(localStorage.getItem('kernelShowcase') || '{}')); } catch (_) {} }
    s = String(s || '').replace(/\s*\|\s*/g, ' • ').trim();
    if (!s || /^\[/.test(s)) return '';
    if (!spellsCurrentScript(s)) return '';   // wrong-script stale value -> generic hint
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
    wrap.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:10px;color:#234a46;';
    wrap.appendChild(document.createTextNode('Align:'));
    var btns = {};
    [['Left', 'left'], ['Center', 'center'], ['Right', 'right'], ['Justify', 'justify']].forEach(function (p) {
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
    input.style.cssText = 'padding:5px 8px;font-size:11px;background:#fff;color:#04231f;border:1px solid rgba(1,183,187,0.45);border-radius:4px;font-family:inherit;';
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
    preview.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400;font-size:9px;opacity:.95;color:#234a46;';
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
    note.style.cssText = 'font-size:9px;opacity:.9;line-height:1.4;color:#234a46;';
    note.textContent = text;
    return note;
  }
  function mkSub(text) {
    var d = document.createElement('div');
    d.style.cssText = 'font-size:10px;font-weight:600;color:#234a46;';
    d.textContent = text;
    return d;
  }

  // SLOGAN-ENHANCE-001 (owner 2026-07-14): Enhance (LLM rewrite) + Fit-it (re-apply the 4-8
  // word cap). The app exposes its LLM dispatcher + undo on window (see app.js SLOGAN-ENHANCE-001):
  //   __antcvLLM(messages, prompt, opts)  __antcvLLMProviders  __antcvLLMInit  __antcvJsonRepair
  //   __antcvOverCost  __antcvPushUndo. All read/write the same antcv:clSlogan store; both push
  //   app undo (so the toolbar ↶ reverts them) and cap to 4-8 words.
  function sloganCurrentText() {
    var cur = get(K.text, '') || '';
    try { if (!cur) cur = String(localStorage.getItem('antcv:clSlogan') || ''); } catch (_) {}
    cur = String(cur).replace(/\s*\|\s*/g, ' • ');
    if (window.__antcvSloganCap) { try { cur = window.__antcvSloganCap(cur); } catch (_) {} }
    return String(cur || '').replace(/\s*•\s*/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function sloganFit() {
    var cur = sloganCurrentText();
    if (!cur || /^\[/.test(cur)) { alert('No slogan to fit yet — write or generate one first.'); return; }
    var fit = cur;
    if (window.__antcvSloganCap) { try { fit = window.__antcvSloganCap(cur); } catch (_) {} }
    fit = String(fit).replace(/[.\s]+$/, '').trim();
    if (fit && fit !== cur) {
      try { window.__antcvPushUndo && window.__antcvPushUndo('Fit slogan'); } catch (_) {}
      set(K.text, fit); bump();
    }
  }
  function sloganEnhance() {
    var cur = sloganCurrentText();
    if (!cur || /^\[/.test(cur)) { alert('Write or generate a slogan first, then Enhance it.'); return Promise.resolve(); }
    if (typeof window.__antcvLLM !== 'function') { alert('Enhance is unavailable right now — reload the app and try again.'); return Promise.resolve(); }
    try { if (typeof window.__antcvOverCost === 'function' && window.__antcvOverCost()) { alert('Monthly generation budget reached — Enhance paused.'); return Promise.resolve(); } } catch (_) {}
    if (window.__antcvSloganEnhancing) return Promise.resolve();
    window.__antcvSloganEnhancing = true;
    var lang = 'en';
    try { lang = String(localStorage.getItem('language') || 'en').replace(/"/g, '').slice(0, 2); } catch (_) {}
    var prompt = 'You are a senior copywriter. Sharpen ONE cover-letter positioning line (a short personal tagline). Make it punchier, more concrete and more memorable while KEEPING the same core meaning and the same subject/voice. HARD RULES: 4-8 words; no trailing period; no quotes; no hype or corporate-speak (never "passionate", "driven", "dynamic", "impactful", "world-class", "results-driven", "cutting-edge", "seamless", "leverage"). Calm, factual, senior Scandinavian-professional voice — facts before flair. Output language: ' + lang + '. Return ONLY valid JSON: {"slogan":"..."}. First character "{", last character "}".';
    var provs;
    try { var pf = window.__antcvLLMProviders; provs = ['claude', 'openai', 'mistral', 'gemini'].filter(typeof pf === 'function' ? pf : function () { return true; }); } catch (_) { provs = ['claude']; }
    var attempts = 2 + Math.max(0, provs.length);
    function parse(raw) { try { return JSON.parse(raw); } catch (_) { try { return typeof window.__antcvJsonRepair === 'function' ? window.__antcvJsonRepair(raw) : null; } catch (_) { return null; } } }
    var out = null;
    function attempt(k) {
      if (k >= attempts || out) return Promise.resolve();
      var opt = k <= 1 ? { task: 'enrich' } : { task: 'enrich', forceProvider: provs[k - 2] };
      return Promise.resolve().then(function () {
        return window.__antcvLLM([{ role: 'user', content: 'Current positioning line:\n\n' + JSON.stringify({ type: 'slogan', slogan: cur }) }], prompt, opt);
      }).then(function (raw) {
        var o = parse(raw);
        if (o && o.slogan) { out = o; return; }
        return new Promise(function (r) { setTimeout(r, 1000); }).then(function () { return attempt(k + 1); });
      }, function () { return new Promise(function (r) { setTimeout(r, 1200); }).then(function () { return attempt(k + 1); }); });
    }
    var initChain = Promise.resolve();
    try { if (typeof window.__antcvLLMInit === 'function') initChain = Promise.resolve(window.__antcvLLMInit()); } catch (_) {}
    return initChain.then(function () { return attempt(0); }).then(function () {
      if (!out || !out.slogan) { alert('Enhance failed — try again in a moment.'); return; }
      var ns = String(out.slogan).replace(/^[\s"'“”]+|[\s"'“”.]+$/g, '').replace(/\s*\|\s*/g, ' • ').trim();
      if (window.__antcvSloganCap) { try { ns = window.__antcvSloganCap(ns); } catch (_) {} }
      ns = String(ns || '').trim();
      if (!ns) { alert('Enhance returned nothing usable — try again.'); return; }
      try { window.__antcvPushUndo && window.__antcvPushUndo('Enhance slogan'); } catch (_) {}
      set(K.text, ns);
      try { localStorage.setItem('antcv:clSloganCtx', JSON.stringify({ v: ns })); } catch (_) {}
      bump();
    }).catch(function (e) { try { alert('Enhance slogan failed: ' + (e && e.message)); } catch (_) {} }).then(function () {
      window.__antcvSloganEnhancing = false;
    });
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
    // SLOGAN-ENHANCE-001 (owner 2026-07-14): Enhance (LLM rewrite) + Fit-it (re-apply the
    // 4-8 word cap). Both call the app-exposed window ops (app.js defines __antcvEnhanceSlogan /
    // __antcvFitSlogan next to `il`), are undoable (they push app undo via vr), and read/write
    // the same antcv:clSlogan store as the inline editor.
    var aiRow = document.createElement('div');
    aiRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:#234a46;margin-top:1px;';
    var aiLbl = document.createElement('span'); aiLbl.textContent = 'AI:'; aiLbl.style.cssText = 'color:#234a46;';
    function mkActBtn(txt, title, fn) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = txt; b.title = title;
      b.style.cssText = 'padding:3px 8px;border-radius:5px;border:1px solid rgba(1,183,187,0.45);background:rgba(1,183,187,0.10);color:#04231f;font-size:10px;font-weight:600;cursor:pointer;';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(b); });
      return b;
    }
    var enhBtn = mkActBtn('✨ Enhance', 'Rewrite the slogan sharper (4-8 words, same meaning) — undoable', function (b) {
      if (window.__antcvSloganEnhancing) return;
      var o = b.textContent; b.textContent = '⏳…'; b.style.opacity = '0.7'; b.disabled = true;
      var done = function () { b.textContent = o; b.style.opacity = '1'; b.disabled = false; try { s.box.__refresh(); } catch (_) {} };
      Promise.resolve().then(sloganEnhance).then(function () { setTimeout(done, 200); }, done);
    });
    var fitBtn = mkActBtn('⇥ Fit', 'Trim the slogan to fit (4-8 words) — undoable', function () {
      try { sloganFit(); } catch (_) {}
      setTimeout(function () { try { s.box.__refresh(); } catch (_) {} }, 120);
    });
    aiRow.appendChild(aiLbl); aiRow.appendChild(enhBtn); aiRow.appendChild(fitBtn);
    s.body.appendChild(aiRow);
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
