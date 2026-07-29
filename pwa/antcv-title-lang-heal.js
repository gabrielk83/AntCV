/* antcv-title-lang-heal.js — TITLE-LANG-HEAL-001 (owner 2026-07-22)
 * ============================================================================
 * Reset a section TITLE that is in the wrong SCRIPT for the document's target
 * language back to its English canonical heading.
 *
 * WHY (live-diagnosed on the 3Shape CV): the babel language detector
 * (antcv-babel-relang.js isInLanguage/latinScores) judges the document by an
 * AGGREGATE character ratio over all concatenated values, and deliberately
 * tolerates a little non-target "residue" so invariant CJK/accent fragments do
 * not fire a costly LLM re-translate (see [[content-lang-detect-shared-with-healer]]).
 * A handful of SHORT section titles (个人简介, 工具与方法, …) on an otherwise fully
 * English document do not move that ratio, so the detector reports "en is fine"
 * and no relang ever runs — the titles stay Chinese permanently while the body
 * is English. Section titles are never checked on their own.
 *
 * THE FIX is deterministic and cannot misfire: a Latin-target document
 * (en/da/es/fr/de/…) must NEVER carry a CJK / Hebrew / Arabic / Amharic title, so
 * such a title is UNAMBIGUOUSLY wrong-language. Reset it to the English canonical
 * heading for its section id (the me() skeleton value). English is the safe floor
 * — exactly right for an English document, and readable (renamable) for any other
 * Latin target until a real translate produces the localised heading. No LLM, no
 * ratio, no dependency on the fuzzy detector.
 *
 * SCOPE GUARDS (never touch a legitimate title):
 *  • Only fires when the TARGET language is Latin-script (a zh/he/ar/am document
 *    SHOULD have non-Latin titles — untouched).
 *  • Only rewrites a title whose text is DOMINATED by a non-Latin script.
 *  • Only for KNOWN section ids (a user-renamed / custom section is left alone).
 *  • A Latin custom rename (any script-matching title) is never touched.
 * Idempotent; self-disabling on any error. Kill: localStorage
 * ['antcv:disable-title-lang-heal'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.2331-title-lang-heal';
  if (window.__antcvTitleLangHeal === VERSION) return;
  window.__antcvTitleLangHeal = VERSION;

  // English canonical section headings by id (must match the me() skeleton).
  var CANON = {
    // CV
    profile: 'PROFILE', work_style: 'Work style', outcomes: 'SELECTED OUTCOMES',
    core_comp: 'CORE COMPETENCIES', experience: 'PROFESSIONAL EXPERIENCE',
    pubs: 'PUBLICATIONS & PATENTS', recommendations: 'RECOMMENDATIONS',
    tools: 'TOOLS & METHODS', certs: 'CERTIFICATES & COURSES', education: 'EDUCATION',
    regulatory: 'REGULATORY CONTEXT', languages: 'LANGUAGES', interests: 'INTERESTS',
    accessibility: 'ACCESSIBILITY', additional: 'ADDITIONAL INFORMATION',
    // CL
    greeting: 'Greeting', opening: 'Opening', why: 'WHY THIS POSITION',
    role_view: 'HOW I SEE THE ROLE', bring: 'WHAT I BRING',
    contribute: 'HOW I WILL CONTRIBUTE', who: 'WHO I AM', foundation: 'FOUNDATION',
    closure: 'Closure'
  };

  // Non-Latin scripts that a Latin-target document must not use for a heading.
  var NONLATIN = /[㐀-鿿぀-ヿ가-힯֐-׿؀-ۿሀ-፿]/;
  // Latin letters (to measure dominance).
  var LATIN = /[A-Za-zÀ-ɏ]/;

  function disabled() { try { var v = localStorage.getItem('antcv:disable-title-lang-heal'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // The document's TARGET language ribbon. Absent => the app default (en-family Latin).
  function targetLang() {
    try { var v = JSON.parse(localStorage.getItem('language') || '""'); return String(v || '').toLowerCase(); } catch (_) { return ''; }
  }
  // Latin-script target languages (headings should be Latin). Non-Latin targets
  // (zh/he/ar/am/…) legitimately carry non-Latin headings, so the healer stays off.
  var LATIN_TARGET = { '': 1, en: 1, da: 1, es: 1, fr: 1, de: 1, nb: 1, no: 1, sv: 1, nl: 1, it: 1, pt: 1, pl: 1 };

  // Is this title dominated by a non-Latin script (so, definitively wrong on a Latin doc)?
  function wrongScript(t) {
    var s = String(t == null ? '' : t);
    if (!NONLATIN.test(s)) return false;                 // no non-Latin at all -> fine
    var nonLatin = (s.match(new RegExp(NONLATIN.source, 'g')) || []).length;
    var latin = (s.match(new RegExp(LATIN.source, 'g')) || []).length;
    return nonLatin > latin;                             // majority non-Latin -> wrong
  }

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : null; } catch (_) { return null; }
  }

  function run() {
    try {
      if (disabled()) return;
      if (!LATIN_TARGET[targetLang()]) return;           // non-Latin doc -> leave headings
      var secs = readSections(); if (!secs) return;
      var changed = false;
      ['cv', 'cl'].forEach(function (doc) {
        if (!Array.isArray(secs[doc])) return;
        secs[doc] = secs[doc].map(function (s) {
          if (!s || !CANON[s.id]) return s;              // unknown/custom id -> leave
          if (!wrongScript(s.title)) return s;           // already Latin/right -> leave
          changed = true;
          return Object.assign({}, s, { title: CANON[s.id] });
        });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'title-lang-heal' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  // Run after cloud-restore / generation / translate settle (their sidecars use
  // 0/300/900/2000+ timers), and on later windows to catch a late rewrite.
  [400, 1200, 2800, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvTitleLangHeal = { version: VERSION, run: run, CANON: CANON, wrongScript: wrongScript };
})();
