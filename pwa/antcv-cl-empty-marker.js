/* antcv-cl-empty-marker.js — ELMA-PREVIEW-001 (owner 2026-11-08)
 * ============================================================================
 * Owner on #3536 Elma Instruments: "the Elma coverletter is empty - wich is
 * reasonable as there is no CL to upload - but the page sould be marked in such
 * case." A CV-only application keeps the skeleton letter (placeholders and
 * bracketed instructions) or nothing, and the CL page showed it without a word.
 *
 * When the letter has no prose in its opening, why and closing parts (the parts
 * every generated or written letter fills; the skeleton holds only [...] text
 * there), the CL preview carries a "No cover letter" note.
 *
 * The note is CSS only: body[data-antcv-cl-empty="1"] + .antcv-preview-paper::after.
 * Nothing is added to the paper, so the PDF preview gate and the print iframe
 * (both serialise the paper's outerHTML, without this body attribute) and the
 * DOCX / PDF worker export (built from sections) never carry it; a print of the
 * page hides it too. Never writes storage or dispatches events.
 * Kill: antcv:disable-cl-empty-marker=1.
 */
(function () {
  'use strict';
  var VERSION = '1.51.6345-elma-preview';
  if (window.__antcvClEmptyMarker === VERSION) return;
  window.__antcvClEmptyMarker = VERSION;

  var ATTR = 'data-antcv-cl-empty';
  var STYLE_ID = 'antcv-cl-empty-css';
  var SPINE = ['opening', 'why', 'closure'];
  // "\A " is a CSS line break; the space ends the hex escape ("\ADenne" would read as U+ADE)
  var TEXT = {
    en: 'NO COVER LETTER\\A This application has no letter text (CV only).\\A This note is not exported.',
    da: 'INTET FØLGEBREV\\A Denne ansøgning har ingen brevtekst (kun CV).\\A Noten kommer ikke med i eksporten.',
  };

  function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function str(k) { var v = readJSON(k); return typeof v === 'string' ? v : String(localStorage.getItem(k) || ''); }

  // text outside [...] (nested brackets included) and the editor's "(click to add)" prompts
  function stripTemplate(t) {
    var s = String(t == null ? '' : t), out = '', depth = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charAt(i);
      if (c === '[') { depth++; continue; }
      if (c === ']') { if (depth) depth--; continue; }
      if (!depth) out += c;
    }
    return out.replace(/\((click to add|klik for at tilføje|haz clic para añadir)\)/gi, ' ');
  }
  function words(t) { return (stripTemplate(t).match(/[A-Za-zÀ-ÿæøåÆØÅ]{2,}/g) || []).length; }
  function sectionText(s) {
    if (!s || typeof s !== 'object') return '';
    var parts = [s.content];
    (Array.isArray(s.items) ? s.items : []).forEach(function (it) {
      if (typeof it === 'string') { parts.push(it); return; }
      if (!it || typeof it !== 'object') return;
      parts.push(it.t);   // it.b is the skeleton's bold lead ("Why this company and position")
      (Array.isArray(it.bullets) ? it.bullets : []).forEach(function (b) { parts.push(typeof b === 'string' ? b : b && b.t); });
    });
    (Array.isArray(s.bullets) ? s.bullets : []).forEach(function (b) { parts.push(typeof b === 'string' ? b : b && b.t); });
    return parts.filter(function (p) { return typeof p === 'string'; }).join(' ');
  }
  // Pure: true when the letter has no prose of its own (CV-only application, or never generated).
  function isEmptyLetter(cl) {
    if (!Array.isArray(cl)) return true;
    var live = cl.filter(function (s) { return s && typeof s === 'object' && s.on !== false; });
    var spine = live.filter(function (s) { return SPINE.indexOf(String(s.id || '')) >= 0; });
    var pool = spine.length ? spine : live.filter(function (s) { return String(s.id || '') !== 'greeting'; });
    return !pool.some(function (s) { return words(sectionText(s)) >= 6; });
  }

  function css(lang) {
    var t = TEXT[lang] || TEXT.en;
    return 'body[' + ATTR + '="1"] .antcv-preview-paper::after{content:"' + t + '";white-space:pre-line;' +
      'position:absolute;left:50%;top:300px;transform:translateX(-50%);width:68%;box-sizing:border-box;' +
      'padding:16px 22px;text-align:center;border:2px dashed #c2410c;border-radius:8px;' +
      'background:rgba(255,247,237,0.95);color:#9a3412;font:600 14px/1.5 Calibri,Arial,sans-serif;' +
      'letter-spacing:0.2px;z-index:60;pointer-events:none;}' +
      '@media print{body[' + ATTR + '] .antcv-preview-paper::after{content:none!important;display:none!important;}}';
  }

  var lastRaw = null, lastEmpty = false;
  function update() {
    try {
      var body = document.body;
      if (!body) return;
      var on = false;
      if (localStorage.getItem('antcv:disable-cl-empty-marker') !== '1' && (str('doc') || 'cv') === 'cl') {
        var raw = String(localStorage.getItem('sections') || '');
        if (raw !== lastRaw) {
          lastRaw = raw;
          var secs = readJSON('sections');
          lastEmpty = isEmptyLetter(secs && secs.cl);
        }
        on = lastEmpty;
      }
      if (on) {
        var lang = String(str('uiLang') || str('language') || 'en').slice(0, 2).toLowerCase();
        var want = css(lang);
        var el = document.getElementById(STYLE_ID);
        if (!el) { el = document.createElement('style'); el.id = STYLE_ID; (document.head || document.documentElement).appendChild(el); }
        if (el.textContent !== want) el.textContent = want;
        if (body.getAttribute(ATTR) !== '1') body.setAttribute(ATTR, '1');
      } else if (body.hasAttribute(ATTR)) body.removeAttribute(ATTR);
    } catch (_) { /* never break the preview */ }
  }

  function start() {
    // the CV <-> CL switch re-renders the paper: follow it in the observer callback (before paint)
    try { new MutationObserver(update).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    window.addEventListener('antcv:sections-updated', update);
    window.addEventListener('storage', update);
    update();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.AntcvClEmptyMarker = { version: VERSION, isEmptyLetter: isEmptyLetter, stripTemplate: stripTemplate, update: update };
})();
