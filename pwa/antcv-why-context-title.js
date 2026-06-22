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
  window.__antcvWhyContextTitle = '1.50.809';

  var SRC = 'why-context-title';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-why-context-title'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  // EDIT-GUARD-001 (owner 2026-06-19: "the sidebar dances … editing stops"): never
  // rewrite the sections blob while the user is actively editing (focus in a
  // contentEditable/input) — that re-render steals the caret. The interval below
  // catches up once focus leaves.
  function isEditing() { try { var a = document.activeElement; if (!a) return false; if (a.isContentEditable) return true; var t = (a.tagName || '').toLowerCase(); return t === 'input' || t === 'textarea' || t === 'select'; } catch (_) { return false; } }

  // A specific job means a real JD is in play. The JD mirror is antcv:lastJdText
  // (cloud-aware). A short/empty value is treated as unsolicited.
  function isSpecificJob() {
    try { return String(localStorage.getItem('antcv:lastJdText') || '').trim().length >= 30; }
    catch (_) { return false; }
  }

  // Specific (JD) heading + the GENERIC unsolicited fallback, per language.
  var SPECIFIC = { en: 'WHY THIS POSITION', da: 'HVORFOR DENNE STILLING' };
  var UNSOL_DEFAULT = { en: 'WHY YOUR COMPANY', da: 'HVORFOR JERES VIRKSOMHED' };
  // Unsolicited entity variants we RECOGNISE as already-correct (per case the
  // target may be a company / institute / organisation — owner: "do not forget
  // why your institute / organization, if unsolicited, per case"). When the title
  // is already one of these, leave it — the generation chose the right entity.
  // WHY-THIS-COMPANY-VARIANT-001 (owner 2026-06-22: a specific NVIDIA role still
  // headed "Why this company"): generation also emits the "WHY THIS COMPANY" /
  // "HVORFOR DENNE VIRKSOMHED" phrasing (not just "WHY YOUR …"). Without it in the
  // recognised set, classify() returned {lang:null} and the JD-present flip to
  // "WHY THIS POSITION" never fired. Treat it as an unsolicited-kind variant so a
  // present JD flips it to the specific heading, and no-JD leaves it as-is.
  var UNSOL_VARIANTS = {
    en: ['WHY YOUR COMPANY', 'WHY THIS COMPANY', 'WHY THE COMPANY', 'WHY YOUR INSTITUTE', 'WHY YOUR INSTITUTION', 'WHY YOUR ORGANIZATION', 'WHY YOUR ORGANISATION', 'WHY YOUR TEAM'],
    da: ['HVORFOR JERES VIRKSOMHED', 'HVORFOR DENNE VIRKSOMHED', 'HVORFOR VIRKSOMHEDEN', 'HVORFOR JERES ORGANISATION', 'HVORFOR JERES INSTITUTION', 'HVORFOR JERES INSTITUT', 'HVORFOR JERES TEAM']
  };
  // Classify the current title -> {lang, kind} where kind is 'specific' |
  // 'unsolicited' | null (unrecognised language -> leave the title alone).
  function classify(title) {
    var t = String(title || '').trim().toUpperCase();
    for (var lang in SPECIFIC) {
      if (t === SPECIFIC[lang].toUpperCase()) return { lang: lang, kind: 'specific' };
      if (UNSOL_VARIANTS[lang].indexOf(t) !== -1) return { lang: lang, kind: 'unsolicited' };
    }
    return { lang: null, kind: null };
  }

  function isWhySection(sec) {
    if (!sec) return false;
    if (sec.id === 'why') return true;
    return classify(sec.title).kind != null;
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

  // WHO-LABEL-DEDUP-001 (owner 2026-06-19: "who I am dup still not [fixed]"): the
  // WHO I AM section duplicates its heading as a leading inline label
  // ("<b>WHO I AM:</b> I am …"). heading-label-dedup only strips type:"text"
  // sections; the CL who section is text_inline, so it slips past. Strip it here
  // regardless of type — same machinery as the WHY label above.
  var WHO_WORD = '(?:WHO\\s+I\\s+AM|HVEM\\s+ER\\s+JEG|QUI[ÉE]N\\s+SOY|WER\\s+ICH\\s+BIN|QUI\\s+JE\\s+SUIS)';
  var WHO_RES = [
    new RegExp('^\\s*<(?:b|strong)\\b[^>]*>\\s*' + WHO_WORD + '[^<:]*:?\\s*<\\/(?:b|strong)>\\s*:?\\s*', 'i'),
    new RegExp('^\\s*\\*{0,2}\\s*' + WHO_WORD + '[^*:\\n]*:\\s*\\*{0,2}\\s*', 'i')
  ];
  function isWhoSection(sec) {
    if (!sec) return false;
    if (sec.id === 'who') return true;
    return /^\s*(who i am|hvem er jeg)\s*$/i.test(String(sec.title || ''));
  }
  function stripWhoLabel(sec) {
    if (!isWhoSection(sec) || typeof sec.content !== 'string' || !sec.content) return false;
    for (var k = 0; k < WHO_RES.length; k++) {
      if (WHO_RES[k].test(sec.content)) {
        var next = sec.content.replace(WHO_RES[k], '');
        if (next.trim() && next !== sec.content) { sec.content = next; return true; }
      }
    }
    return false;
  }

  function fix(sec, specific) {
    if (!isWhySection(sec)) return false;
    var changed = false;
    // 1. context title (EN/DA only; leave unknown languages alone). Only CORRECT a
    // title that contradicts the context: a JD present but an unsolicited heading
    // -> "WHY THIS POSITION"; no JD but a specific heading -> the generic
    // "WHY YOUR COMPANY". An already-unsolicited entity title (institute /
    // organisation / team) under no-JD is left as-is — the generation picked it.
    var c = classify(sec.title);
    if (c.lang) {
      if (specific && c.kind === 'unsolicited') {
        if (sec.title !== SPECIFIC[c.lang]) { sec.title = SPECIFIC[c.lang]; changed = true; }
      } else if (!specific && c.kind === 'specific') {
        if (sec.title !== UNSOL_DEFAULT[c.lang]) { sec.title = UNSOL_DEFAULT[c.lang]; changed = true; }
      }
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
    if (disabled() || isEditing()) return;
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var specific = isSpecificJob(), changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = b[doc];
      if (!Array.isArray(list)) return;
      list.forEach(function (sec) { if (fix(sec, specific)) changed = true; if (stripWhoLabel(sec)) changed = true; });
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

  window.AntcvWhyContextTitle = { version: '1.50.809', _apply: apply, _fix: fix, _strip: stripLabel };
})();
