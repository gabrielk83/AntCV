/* AntCV language UX fixes (v1.40.292)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Four things, all DOM/storage-layer (no bundle internals required):
 *
 *   1. Pre-populate "zh" in localStorage.enabledLanguages so Chinese
 *      shows up in the language bar. The bundle's language selector
 *      filters by this list. If the user has never enabled Chinese
 *      through onboarding (which predated zh support), it's missing
 *      from the list and zh is hidden from the dropdown.
 *
 *      Only touches the list when it exists and is missing "zh".
 *      Doesn't create a new list (null = all-languages-visible already).
 *      Idempotent — running twice does nothing the second time.
 *
 *   2. Override the "Translating to English..." progress bar text
 *      when the actual target is Spanish or Chinese. The bundle's
 *      label literal at byte 718810 is hardcoded:
 *          "Translating to ", "da"===je?"Danish":"English"
 *      so non-DA targets all read as "English" in the spinner. The
 *      LLM call itself goes to the correct language — only the
 *      label is wrong. A MutationObserver on body watches for any
 *      text node whose parent text starts with "Translating to "
 *      and replaces the language name based on localStorage.language.
 *
 *   3. Override "Kind regards," in the rendered Cover Letter when
 *      target is ES or ZH. The bundle now (post-patch) ships the
 *      correct strings, but if a user has an old cached bundle this
 *      sidecar still produces the right output. DA was already
 *      handled by the bundle pre-patch; we cover ES/ZH here too as
 *      defence-in-depth and as the primary path for users running
 *      sidecar-only.
 *
 *   4. Override the "EU Citizen" citizenship tag in the rendered
 *      contact line per language. The bundle's static EN→DA
 *      dictionary has "EU Citizen → EU-borger" but the dictionary is
 *      not applied to contact_line rendering. For ES we use
 *      "Ciudadano UE", for ZH "欧盟公民".
 *
 * Coexistence:
 *   - Stacks on top of all earlier sidecars (285, 289, 290, 291).
 *   - Idempotent: re-runs harmlessly because of the marker attribute
 *     and the `if value !== want` guard.
 */
(function () {
  'use strict';
  var VERSION = '1.40.292';
  if (window.__antcvLanguageUiFixes292 === VERSION) return;
  window.__antcvLanguageUiFixes292 = VERSION;

  // ────────────────────────────────────────────────────────────────────
  // Translation tables (only what we need — names that the bundle
  // doesn't dynamically translate)
  // ────────────────────────────────────────────────────────────────────

  var LANG_NAMES = {
    en: 'English',
    da: 'Danish',
    es: 'Spanish',
    zh: '\u4e2d\u6587'
  };

  var EU_CITIZEN = {
    en: 'EU Citizen',
    da: 'EU-borger',
    es: 'Ciudadano UE',
    zh: '\u6b27\u76df\u516c\u6c11'
  };

  var KIND_REGARDS = {
    en: 'Kind regards,',
    da: 'Med venlig hilsen,',
    es: 'Saludos cordiales,',
    zh: '\u6b64\u81f4\u656c\u793c,'
  };

  // The reverse-mapping lets us recognise any of the language variants
  // of "Kind regards," / "EU Citizen" / progress-bar language name so
  // we can rewrite when the active language has changed.
  function buildReverse(table) {
    var rev = {};
    for (var k in table) {
      if (Object.prototype.hasOwnProperty.call(table, k)) {
        rev[table[k]] = true;
      }
    }
    return rev;
  }
  var LANG_NAMES_REV = buildReverse(LANG_NAMES);
  var EU_CITIZEN_REV = buildReverse(EU_CITIZEN);
  var KIND_REGARDS_REV = buildReverse(KIND_REGARDS);

  function getCurrentLanguage() {
    try {
      var raw = localStorage.getItem('language');
      if (!raw) return 'en';
      var v = JSON.parse(raw);
      return (typeof v === 'string' && LANG_NAMES[v]) ? v : 'en';
    } catch (_) { return 'en'; }
  }

  // ────────────────────────────────────────────────────────────────────
  // Fix 1 — Enable Chinese in the language bar
  // ────────────────────────────────────────────────────────────────────

  function enableChineseLanguage() {
    try {
      var raw = localStorage.getItem('enabledLanguages');
      if (!raw) {
        // null/missing means the selector shows all languages — nothing to fix.
        return;
      }
      var arr = JSON.parse(raw);
      if (!Array.isArray(arr) || arr.length === 0) {
        // Empty array also means "no restriction" per the bundle's logic.
        return;
      }
      if (arr.indexOf('zh') !== -1) {
        // Already enabled.
        return;
      }
      arr.push('zh');
      localStorage.setItem('enabledLanguages', JSON.stringify(arr));
      try {
        console.info('[language-ui-fixes-292] added "zh" to enabledLanguages. New list:', arr.slice());
      } catch (_) {}
    } catch (e) {
      try { console.warn('[language-ui-fixes-292] enable-Chinese failed:', e && e.message); } catch (_) {}
    }
  }

  // ────────────────────────────────────────────────────────────────────
  // Fix 2/3/4 — DOM text overrides via MutationObserver
  // ────────────────────────────────────────────────────────────────────

  // Walk an element's direct text-node children and replace any that
  // match a value in `reverseMap` with `wantValue`. Returns true if
  // any change was made.
  function rewriteTextChild(parent, reverseMap, wantValue) {
    if (!parent || !parent.childNodes || !wantValue) return false;
    var changed = false;
    for (var i = 0; i < parent.childNodes.length; i++) {
      var node = parent.childNodes[i];
      if (node.nodeType !== 3) continue;
      var v = node.nodeValue;
      if (v == null) continue;
      // Only mutate exact matches; allow whitespace tolerance via trim
      // BUT only if the original was already trimmed. We don't trim the
      // node value itself — we'd lose surrounding whitespace.
      if (reverseMap[v] && v !== wantValue) {
        node.nodeValue = wantValue;
        changed = true;
      }
    }
    return changed;
  }

  // Same as above but matches text that EQUALS the target after trimming
  // (used for nodes that may have stray whitespace like "EU Citizen ").
  function rewriteTextChildLoose(parent, reverseMap, wantValue) {
    if (!parent || !parent.childNodes || !wantValue) return false;
    var changed = false;
    for (var i = 0; i < parent.childNodes.length; i++) {
      var node = parent.childNodes[i];
      if (node.nodeType !== 3) continue;
      var v = node.nodeValue;
      if (v == null) continue;
      var trimmed = v.trim();
      if (reverseMap[trimmed] && trimmed !== wantValue) {
        // Preserve original whitespace surround
        var leadIdx = v.indexOf(trimmed);
        var lead = (leadIdx > 0) ? v.substring(0, leadIdx) : '';
        var tail = v.substring(leadIdx + trimmed.length);
        node.nodeValue = lead + wantValue + tail;
        changed = true;
      }
    }
    return changed;
  }

  function correctProgressBar(parent) {
    // The progress bar's text content begins with "Translating to ".
    // The second text-node child is the language name. Replace it.
    var lang = getCurrentLanguage();
    var want = LANG_NAMES[lang] || LANG_NAMES.en;
    return rewriteTextChild(parent, LANG_NAMES_REV, want);
  }

  function correctKindRegards(parent) {
    var lang = getCurrentLanguage();
    var want = KIND_REGARDS[lang] || KIND_REGARDS.en;
    return rewriteTextChild(parent, KIND_REGARDS_REV, want);
  }

  function correctEUCitizen(parent) {
    var lang = getCurrentLanguage();
    var want = EU_CITIZEN[lang] || EU_CITIZEN.en;
    return rewriteTextChildLoose(parent, EU_CITIZEN_REV, want);
  }

  // ────────────────────────────────────────────────────────────────────
  // Classifiers — decide which override(s) apply to a given element
  // ────────────────────────────────────────────────────────────────────

  function isProgressBarParent(el) {
    if (!el || el.nodeType !== 1 || !el.childNodes || el.childNodes.length < 2) return false;
    // Check first text-node child for "Translating to " prefix.
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && typeof n.nodeValue === 'string') {
        if (n.nodeValue.indexOf('Translating to ') === 0) return true;
        // Stop at first text node — if it isn't "Translating to..." this
        // isn't the bar.
        return false;
      }
    }
    return false;
  }

  function isKindRegardsParent(el) {
    if (!el || el.nodeType !== 1 || !el.childNodes) return false;
    // The closing div in the bundle is `React.createElement("div", null, "Kind regards,")`
    // i.e. a single text-node child whose value is one of the known closings.
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType !== 3) continue;
      var v = n.nodeValue;
      if (typeof v === 'string' && KIND_REGARDS_REV[v]) return true;
    }
    return false;
  }

  function isEUCitizenContainer(el) {
    if (!el || el.nodeType !== 1 || !el.childNodes) return false;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType !== 3) continue;
      var v = n.nodeValue;
      if (typeof v !== 'string') continue;
      if (EU_CITIZEN_REV[v.trim()]) return true;
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────────────
  // MutationObserver — runs on every relevant DOM change
  // ────────────────────────────────────────────────────────────────────

  function processElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (isProgressBarParent(el)) {
      correctProgressBar(el);
    }
    if (isKindRegardsParent(el)) {
      correctKindRegards(el);
    }
    if (isEUCitizenContainer(el)) {
      correctEUCitizen(el);
    }
  }

  function processSubtree(node) {
    if (!node || node.nodeType !== 1) return;
    processElement(node);
    if (typeof node.querySelectorAll === 'function') {
      // Cheap pre-filter: we only care about elements that could contain
      // any of our target text-nodes. Querying for all elements with text
      // children is not selectable directly; we use a coarse net then the
      // classifiers filter.
      var candidates = node.querySelectorAll('div, span, p, td, th, li');
      for (var i = 0; i < candidates.length; i++) {
        processElement(candidates[i]);
      }
    }
  }

  function startObserver() {
    if (!document.body) {
      setTimeout(startObserver, 50);
      return;
    }

    // Initial sweep
    try { processSubtree(document.body); } catch (_) {}

    var mo;
    try {
      mo = new MutationObserver(function (records) {
        for (var i = 0; i < records.length; i++) {
          var rec = records[i];
          if (rec.type === 'childList') {
            // New nodes added → check them and their subtrees.
            var added = rec.addedNodes;
            if (added) {
              for (var j = 0; j < added.length; j++) {
                processSubtree(added[j]);
              }
            }
            // Also process the parent in case a text node child was
            // added/removed within an existing element.
            if (rec.target) processElement(rec.target);
          } else if (rec.type === 'characterData') {
            // A text node's value changed (React's typical update path
            // for variable text). Process the parent.
            var p = rec.target && rec.target.parentNode;
            if (p) processElement(p);
          }
        }
      });
      mo.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      window.__antcvLanguageUiFixes292Observer = mo;
      try {
        console.debug('[language-ui-fixes-292] installed v' + VERSION + '; observing for translatable UI text.');
      } catch (_) {}
    } catch (e) {
      try { console.warn('[language-ui-fixes-292] MutationObserver setup failed:', e && e.message); } catch (_) {}
    }

    // Listen for language change so the EU Citizen / Kind regards text
    // updates when the user toggles language without re-rendering those
    // exact nodes. We re-sweep the visible DOM on storage events.
    try {
      window.addEventListener('storage', function (ev) {
        if (ev && ev.key === 'language') {
          try { processSubtree(document.body); } catch (_) {}
        }
      });
    } catch (_) {}
  }

  // ────────────────────────────────────────────────────────────────────
  // Init
  // ────────────────────────────────────────────────────────────────────

  enableChineseLanguage();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  // Public diagnostics
  window.AntcvLanguageUiFixes292 = {
    version: VERSION,
    _getCurrentLanguage: getCurrentLanguage,
    _LANG_NAMES: LANG_NAMES,
    _EU_CITIZEN: EU_CITIZEN,
    _KIND_REGARDS: KIND_REGARDS,
    _enableChinese: enableChineseLanguage,
    _processSubtree: function () { try { processSubtree(document.body); } catch (_) {} },
  };
})();
