/* antcv-why-context-title.js — WHY-TITLE-CONTEXT-001 (owner 2026-06-18)
 * ============================================================================
 * Owner, on the WHY section: "<b>WHY YOUR COMPANY:</b> ... this would need to
 * change to Why this Position for a specific Job."
 *
 * The `why` section (me() id:"why") is titled "WHY THIS POSITION" by default,
 * and generation often writes a duplicate inline bold label into the paragraph
 * ("<b>WHY YOUR COMPANY:</b> …"). Two corrections, both context-driven:
 *
 *   1. TITLE by context. A JD present (specific role) -> "WHY THIS POSITION".
 *      A true unsolicited application (no JD) -> "WHY YOUR COMPANY". Done for the
 *      two languages the owner ships, EN and DA, only when the current title is a
 *      recognised WHY-variant (other languages are left untouched, never guessed).
 *   2. STRIP the duplicate inline label. For the `why` section, a leading bold
 *      "WHY …:" / "HVORFOR …:" label repeats the heading - remove it. (heading-
 *      label-dedup only strips a label that MATCHES the title; a "WHY YOUR
 *      COMPANY:" label under a "WHY THIS POSITION" heading slips past it.)
 *
 * Sidecar-only, restore-proof (rewrites the stored blob), idempotent. Loop-safe:
 * same-blob bail + write-only-on-change + own tagged event ignored.
 * Disable: localStorage['antcv:disable-why-context-title'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvWhyContextTitle) return;
  window.__antcvWhyContextTitle = '1.50.678';

  var SRC = 'why-context-title';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-why-context-title'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // A specific job means a real JD is in play. The JD mirror is antcv:lastJdText
  // (cloud-aware). A short/empty value is treated as unsolicited.
  function isSpecificJob() {
    try { return String(localStorage.getItem('antcv:lastJdText') || '').trim().length >= 30; }
    catch (_) { return false; }
  }

  // EN + DA title pairs. Keyed by language; [specific, unsolicited].
  var PAIRS = {
    en: { specific: 'WHY THIS POSITION', unsolicited: 'WHY YOUR COMPANY' },
    da: { specific: 'HVORFOR DENNE STILLING', unsolicited: 'HVORFOR JERES VIRKSOMHED' }
  };
  // Recognise the current title's language from its WHY-variant.
  function langOfTitle(title) {
    var t = String(title || '').trim().toUpperCase();
    if (t === 'WHY THIS POSITION' || t === 'WHY YOUR COMPANY') return 'en';
    if (t === 'HVORFOR DENNE STILLING' || t === 'HVORFOR JERES VIRKSOMHED') return 'da';
    return null;
  }

  function isWhySection(sec) {
    if (!sec) return false;
    if (sec.id === 'why') return true;
    return langOfTitle(sec.title) != null;
  }

  // Strip a leading bold/markdown/plain "WHY …:" / "HVORFOR …:" (+ ES/DE/FR) label.
  var WHY_WORD = '(?:WHY|HVORFOR|POR QU|WARUM|POURQUOI)';
  var LABEL_RES = [
    new RegExp('^\\s*<(?:b|strong)\\b[^>]*>\\s*' + WHY_WORD + '[^<:]*:?\\s*<\\/(?:b|strong)>\\s*:?\\s*', 'i'),
    new RegExp('^\\s*\\*{0,2}\\s*' + WHY_WORD + '[^*:\\n]*:\\s*\\*{0,2}\\s*', 'i')
  ];
  function stripLabel(content) {
    if (typeof content !== 'string' || !content) return content;
    for (var k = 0; k < LABEL_RES.length; k++) {
      if (LABEL_RES[k].test(content)) {
        var next = content.replace(LABEL_RES[k], '');
        if (next.trim()) return next;   // never blank the paragraph
      }
    }
    return content;
  }

  function fix(sec, specific) {
    if (!isWhySection(sec)) return false;
    var changed = false;
    // 1. context title (EN/DA only; leave unknown languages alone)
    var lang = langOfTitle(sec.title);
    if (lang) {
      var want = specific ? PAIRS[lang].specific : PAIRS[lang].unsolicited;
      if (sec.title !== want) { sec.title = want; changed = true; }
    }
    // 2. strip the duplicate inline label from the paragraph
    if (typeof sec.content === 'string') {
      var stripped = stripLabel(sec.content);
      if (stripped !== sec.content) { sec.content = stripped; changed = true; }
    }
    return changed;
  }

  var lastRaw = null;
  function apply() {
    if (disabled()) return;
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var specific = isSpecificJob(), changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = b[doc];
      if (!Array.isArray(list)) return;
      list.forEach(function (sec) { if (fix(sec, specific)) changed = true; });
    });
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[why-context-title] set WHY heading by context (' + (specific ? 'specific job' : 'unsolicited') + ') + stripped duplicate label'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [500, 1400, 2900].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'antcv:lastJdText' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvWhyContextTitle = { version: '1.50.678', _apply: apply, _fix: fix, _strip: stripLabel };
})();
