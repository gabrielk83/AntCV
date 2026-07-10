/* antcv-babel-relang.js — BABEL-FISH-RELANG-001 (owner 2026-07-11)
 * =====================================================================
 * Babel-fish principle: the canonical truth is language-neutral MEANING; the
 * ribbon language is how it is DISPLAYED. When the ribbon output language is a
 * non-Latin script (zh / he / am / ar) but the document content is NOT in that
 * script — e.g. an English kernel served under a zh ribbon (the language-blind
 * kernel guard), or a generation the model returned in English despite the lock
 * — re-render the content into the ribbon language via the babel-fish translate
 * pass (window.__antcvRelang, force=true).
 *
 * Non-destructive: translation preserves meaning; INVARIANTS (numbers, proper
 * nouns, tool / standard names, patent numbers) stay Latin unchanged — only the
 * renderable prose changes. Detection runs on the DATA MODEL (localStorage
 * 'sections'), NOT the DOM, so the English app chrome never dilutes the signal.
 *
 * Scope: only the non-Latin targets where script-detection is reliable. Latin
 * targets (en/da/es/fr/de) are handled at generation time by the honest
 * `LANGUAGE:` directive (BABEL-FISH-LANG-NAME-001); this sidecar is the passive-
 * serve safety net. Kill: localStorage['antcv:disable-babel-relang']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.263-babel-relang';
  if (window.__antcvBabelRelang === VERSION) return;
  window.__antcvBabelRelang = VERSION;
  try { if (localStorage.getItem('antcv:disable-babel-relang') === '1') return; } catch (_) {}

  // Non-Latin target scripts we can reliably detect (Unicode ranges).
  var SCRIPTS = {
    zh: /[一-鿿㐀-䶿]/g, // CJK
    he: /[֐-׿]/g,             // Hebrew
    am: /[ሀ-፿]/g,             // Ethiopic
    ar: /[؀-ۿ]/g,             // Arabic
  };
  var THRESHOLD = 0.12; // target-script letters / total letters below this = stale
  var MIN_LETTERS = 200; // ignore the empty skeleton / mid-load
  var BACKOFF_MS = 20000; // one relang attempt per language per 20s

  function lang() {
    try {
      var v = localStorage.getItem('language') || '';
      if (v && v.charAt(0) === '"') v = JSON.parse(v);
      return String(v || 'en').toLowerCase().replace(/[^a-z]/g, '').slice(0, 2);
    } catch (_) { return 'en'; }
  }

  function collectStrings(node, out) {
    if (node == null) return;
    if (typeof node === 'string') { if (node.trim()) out.push(node); return; }
    if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) collectStrings(node[i], out); return; }
    if (typeof node === 'object') {
      for (var k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) collectStrings(node[k], out); }
    }
  }

  function contentText() {
    try {
      var raw = localStorage.getItem('sections'); if (!raw) return '';
      var out = []; collectStrings(JSON.parse(raw), out);
      return out.join(' ');
    } catch (_) { return ''; }
  }

  function letterCount(t) {
    try { return (t.match(/\p{L}/gu) || []).length; }
    catch (_) { return (t.match(/[A-Za-zÀ-ɏЀ-ӿ֐-׿؀-ۿሀ-፿㐀-鿿]/g) || []).length; }
  }

  var last = { lang: null, at: 0 };
  function check() {
    var L = lang(), re = SCRIPTS[L];
    if (!re) return;                                     // only non-Latin targets
    if (typeof window.__antcvRelang !== 'function') return; // app not ready yet
    var txt = contentText(), letters = letterCount(txt);
    if (letters < MIN_LETTERS) return;                   // skeleton / too little content
    var hits = (txt.match(re) || []).length;
    if (hits / letters >= THRESHOLD) return;             // already in the target script
    var now = Date.now();
    if (last.lang === L && (now - last.at) < BACKOFF_MS) return; // back off
    last = { lang: L, at: now };
    try { console.info('[babel-relang] sections not in', L, '(', hits, '/', letters, ') — re-rendering into ribbon language'); } catch (_) {}
    try { window.__antcvRelang(L, true); }
    catch (e) { try { console.warn('[babel-relang] relang failed', e); } catch (_) {} }
  }

  var pending = false;
  function schedule() {
    if (pending) return; pending = true;
    setTimeout(function () { pending = false; try { check(); } catch (_) {} }, 700);
  }
  window.addEventListener('antcv:language-changed', schedule);
  window.addEventListener('antcv:sections-updated', schedule);
  [1800, 4500, 9000].forEach(function (d) { setTimeout(schedule, d); });
  window.AntcvBabelRelang = { version: VERSION, _check: check };
})();
