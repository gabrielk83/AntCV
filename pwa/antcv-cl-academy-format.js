/* antcv-cl-academy-format.js — CL-ACADEMY-001 (owner 2026-11-01)
 * ============================================================================
 * The academy letter is the default cover-letter format (owner: "every application
 * defaults to … the academy format"; house packages 1048 Ambu / 1052 ASSA ABLOY).
 * Generation gets the shape from gold-rules.json prompt_block (CL-ACADEMY-001). This
 * sidecar holds the two parts the renderer owns:
 *   1. Sign-off "Kind regards," (da "Med venlig hilsen,", es "Saludos cordiales,")
 *      instead of the Nordic "At your service," — written to antcv:clClosing, the
 *      key the preview and the docx export both read. A closing the user typed is kept;
 *      only empty / "At your service," / a previous automatic value is replaced, and an
 *      automatic value follows the output language.
 *   2. No hearing, captions or communication-needs sentence in the letter
 *      (COMMS-LINE-001: that line belongs to the CV only). Stored CL sections are swept
 *      and the sentence removed; the CV is never touched.
 * Kill switch: localStorage['antcv:disable-cl-academy-format'] = '1'.
 */
(function (root) {
  'use strict';
  var VERSION = '1.51.5242';
  var SIGN_OFF = { en: 'Kind regards,', da: 'Med venlig hilsen,', es: 'Saludos cordiales,' };
  var REPLACEABLE = ['', 'at your service,', 'til tjeneste,', 'kind regards,', 'med venlig hilsen,', 'saludos cordiales,'];
  var AUTO_KEY = 'antcv:clClosingAuto';

  // Pure: the closing to store, or null to leave the key alone.
  function closingFor(current, lang, wasAuto) {
    var l = String(lang || 'en').toLowerCase().slice(0, 2);
    var want = SIGN_OFF[l];
    if (!want) return null;                      // zh / he / … keep the app's own localized default
    var cur = String(current == null ? '' : current).trim();
    if (cur === want) return null;
    var lc = cur.toLowerCase();
    if (lc && REPLACEABLE.indexOf(lc) < 0 && !wasAuto) return null;   // a closing the user typed
    return want;
  }

  var COMMS = /\b(hearing[- ]?impair\w*|hard of hearing|hearing loss|deaf\w*|cochlear|live[- ]?caption\w*|captions?|transcription glasses|lip[- ]?read\w*|sign language)\b/i;
  // Pure: text with every sentence that names a hearing / captions need removed.
  function stripComms(text) {
    var s = String(text == null ? '' : text);
    if (!COMMS.test(s)) return s;
    var parts = s.match(/[^.!?]+[.!?]+["')\]]*\s*|[^.!?]+$/g) || [s];
    return parts.filter(function (p) { return !COMMS.test(p); }).join('').replace(/\s+$/, '').replace(/^\s+/, '');
  }
  // Pure: CL section list with the comms sentences removed (same objects when unchanged).
  function stripCommsCl(cl) {
    var changed = false;
    var out = (cl || []).map(function (sec) {
      if (!sec || typeof sec !== 'object') return sec;
      var n = sec;
      if (typeof sec.content === 'string' && COMMS.test(sec.content)) { n = Object.assign({}, n, { content: stripComms(sec.content) }); changed = true; }
      if (Array.isArray(sec.items)) {
        var hit = false;
        var items = sec.items.map(function (it) {
          if (!it || typeof it !== 'object' || typeof it.t !== 'string' || !COMMS.test(it.t)) return it;
          hit = true;
          return Object.assign({}, it, { t: stripComms(it.t) });
        });
        if (hit) {
          var hidden = Object.assign({}, n.hidden || {});
          items.forEach(function (it, i) { if (it && typeof it === 'object' && it.b && !String(it.t || '').trim() && sec.items[i] !== it) hidden[i] = true; });
          n = Object.assign({}, n, { items: items, hidden: hidden });
          changed = true;
        }
      }
      return n;
    });
    return changed ? out : cl;
  }

  function ls() { try { return root.localStorage; } catch (_) { return null; } }
  function disabled() { try { return ls().getItem('antcv:disable-cl-academy-format') === '1'; } catch (_) { return true; } }
  function lang() { try { return String(ls().getItem('language') || 'en').replace(/["']/g, ''); } catch (_) { return 'en'; } }
  var busy = false;
  function tick() {
    if (busy || disabled()) return;
    busy = true;
    try {
      var s = ls();
      var next = closingFor(s.getItem('antcv:clClosing'), lang(), s.getItem(AUTO_KEY) === '1');
      if (next) { s.setItem('antcv:clClosing', next); s.setItem(AUTO_KEY, '1'); }
      var secs = JSON.parse(s.getItem('sections') || 'null');
      if (secs && Array.isArray(secs.cl)) {
        var cl = stripCommsCl(secs.cl);
        if (cl !== secs.cl) {
          secs.cl = cl;
          s.setItem('sections', JSON.stringify(secs));
          try { root.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'cl-academy-format' } })); } catch (_) {}
          try { console.log('[cl-academy] COMMS-LINE-001: removed a hearing / captions sentence from the cover letter'); } catch (_) {}
        }
      }
      if (next) { try { root.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'cl-academy-format' } })); } catch (_) {} }
    } catch (_) { /* self-disable on any error */ }
    busy = false;
  }

  var API = { version: VERSION, closingFor: closingFor, stripComms: stripComms, stripCommsCl: stripCommsCl, tick: tick };
  if (root) root.AntcvClAcademyFormat = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  else if (root && root.addEventListener && root.__antcvClAcademy !== VERSION) {
    root.__antcvClAcademy = VERSION;
    var t = null;
    root.addEventListener('antcv:sections-updated', function (e) {
      if (e && e.detail && e.detail.source === 'cl-academy-format') return;
      if (t) clearTimeout(t); t = setTimeout(tick, 600);
    });
    [1200, 5000].forEach(function (ms) { setTimeout(tick, ms); });
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
