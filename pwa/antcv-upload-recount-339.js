/* AntCV upload count fix (v1.40.339-g)
 * ============================================================
 *
 * Bug 4
 * -----
 * After uploading a CV via the importer, the wizard's summary toast
 * reads:
 *   "\u2713 Found 0 work entries \u00B7 0 education \u00B7
 *    6 certifications \u00B7 0 publications."
 * even though the data WAS imported correctly. The counter underlines
 * say "saved" but the count line lies.
 *
 * Root cause
 * ----------
 * The wizard summary renderer in app.js counts these fields:
 *   workHistory.length, education.length,
 *   certifications.length, publications.length
 *
 * The data importer (antcv-data-importer.js) writes to these fields:
 *   experience              (NOT workHistory)
 *   education               (✓ matches)
 *   certifications          (✓ matches)
 *   publicationsStructured  (NOT publications)
 *
 * So the work + publications counts always read zero.
 *
 * History
 * -------
 * The fix used to live in antcv-wizard-fix.js (recountUploadSummary +
 * normalizePersonalInfo). v1.40.303 retired that sidecar and folded
 * its features into the merged antcv-onboarding.js v1.40.266, but
 * onboarding.js was never wired into index.html. The merged module is
 * sitting in pwa/ as dead code; the recount logic isn't running.
 *
 * Loading the full onboarding.js wholesale would re-introduce a bunch
 * of overlay/wizard logic that overlaps with the sidecars currently
 * loaded (wizard-language-slide-339, ai-consent-cloud-sync-224,
 * wizard-section-format-step10, etc). This sidecar extracts JUST the
 * two functions that fix bug 4, with no side effects on AI notice
 * flow, step transitions, or post-delete behaviour.
 *
 * What this does
 * --------------
 *   1. normalizePersonalInfo() - cross-populates the dual keys so any
 *      consumer that reads either name finds the data:
 *        workHistory <-> experience
 *        publications <-> publicationsStructured
 *      It NEVER overwrites a populated array; only fills in the
 *      missing side. Run on boot, on personalInfo storage events,
 *      and on every tick.
 *
 *   2. recountUploadSummary() - finds the wizard summary toast in the
 *      DOM and rewrites the visible counts. Uses the same regex the
 *      original v1.40.266 onboarding sidecar used, so any future
 *      tweak in app.js's emit format still matches as long as the
 *      structure is the same.
 *
 * Disable hatches
 * ---------------
 *   localStorage['antcvDisablePersonalInfoNormalize'] = '1'
 *   localStorage['antcvDisableUploadRecount']        = '1'
 */
(function () {
  'use strict';

  var VERSION = '1.50.143-multinode';
  if (window.__antcvUploadRecount339 === VERSION) return;
  window.__antcvUploadRecount339 = VERSION;

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function lsJSON(k) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch (_) { return null; }
  }
  function arrLen(v) { return Array.isArray(v) ? v.length : 0; }
  function acceptedValue(v) {
    if (v === true) return true;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      return !!s && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined';
    }
    return !!v;
  }

  var DUAL_KEYS = [
    ['workHistory',  'experience'],
    ['publications', 'publicationsStructured']
  ];

  function normalizePersonalInfo() {
    if (acceptedValue(lsGet('antcvDisablePersonalInfoNormalize'))) return false;
    var pi = lsJSON('personalInfo');
    if (!pi || typeof pi !== 'object') return false;
    var changed = false;
    for (var i = 0; i < DUAL_KEYS.length; i++) {
      var a = DUAL_KEYS[i][0], b = DUAL_KEYS[i][1];
      var la = arrLen(pi[a]), lb = arrLen(pi[b]);
      if (la === 0 && lb > 0) {
        // Use a shallow copy so subsequent mutations to one don't
        // silently affect the other.
        pi[a] = pi[b].slice();
        changed = true;
      } else if (lb === 0 && la > 0) {
        pi[b] = pi[a].slice();
        changed = true;
      }
    }
    if (changed) {
      try {
        lsSet('personalInfo', JSON.stringify(pi));
        try {
          console.info('[antcv-upload-recount-339] personalInfo normalised:' +
            ' workHistory=' + arrLen(pi.workHistory) +
            ', experience=' + arrLen(pi.experience) +
            ', publications=' + arrLen(pi.publications) +
            ', publicationsStructured=' + arrLen(pi.publicationsStructured));
        } catch (_) {}
        // Fire a storage event so any React reducer that reacts to
        // personalInfo re-hydrates.
        try {
          window.dispatchEvent(new StorageEvent('storage', {
            key: 'personalInfo',
            newValue: localStorage.getItem('personalInfo')
          }));
        } catch (_) {}
      } catch (_) {}
    }
    return changed;
  }

  // \u2713 = check mark; \u00B7 = middle dot; \u2022 = bullet (some
  // builds emit \u2022 instead). We match either separator.
  var SUMMARY_RE = /\u2713 Found \d+ work entr(?:y|ies) [\u00B7\u2022] \d+ education [\u00B7\u2022] \d+ certifications [\u00B7\u2022] \d+ publications\./;

  function recountUploadSummary() {
    if (acceptedValue(lsGet('antcvDisableUploadRecount'))) return;
    normalizePersonalInfo();
    var pi = lsJSON('personalInfo');
    if (!pi) return;
    var workCount =
      (Array.isArray(pi.workHistory) ? pi.workHistory.length :
       Array.isArray(pi.experience)  ? pi.experience.length  : 0);
    var eduCount  = Array.isArray(pi.education) ? pi.education.length : 0;
    var certCount = Array.isArray(pi.certifications) ? pi.certifications.length : 0;
    var pubCount  =
      (Array.isArray(pi.publicationsStructured) ? pi.publicationsStructured.length :
       Array.isArray(pi.publications)            ? pi.publications.length         : 0);
    var expected =
      '\u2713 Found ' + workCount + ' work entr' + (workCount === 1 ? 'y' : 'ies') +
      ' \u00B7 ' + eduCount + ' education \u00B7 ' + certCount +
      ' certifications \u00B7 ' + pubCount + ' publications.';
    var cands;
    try { cands = document.querySelectorAll('div, span, p'); } catch (_) { return; }
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      var t = el.textContent || '';
      if (!SUMMARY_RE.test(t)) continue;
      if (t.indexOf(expected) >= 0) continue;
      // Single-text-node case: just rewrite textContent on the leaf.
      if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) {
        var newText = t.replace(SUMMARY_RE, expected);
        if (newText !== t) el.textContent = newText;
        continue;
      }
      // React split-text case (the real production structure): app.js emits the
      // line as many sibling text nodes —
      //   "✓ Found ", count, " work entr", "ies", " · ", count2, " education · ", ...
      // so textContent on the container MATCHES but no SINGLE child text node
      // does, and the TreeWalker below finds nothing to rewrite (this is why the
      // count stayed wrong even with the sidecar loaded). If every child of the
      // matching element is a text node, it is the leaf holding the split line —
      // collapse it to the corrected string. The styled wrapper above it has an
      // element child, so it is correctly skipped here and by the walker.
      var allText = el.childNodes.length > 1;
      for (var ci = 0; ci < el.childNodes.length && allText; ci++) {
        if (el.childNodes[ci].nodeType !== 3) allText = false;
      }
      if (allText) {
        var rebuilt = t.replace(SUMMARY_RE, expected);
        if (rebuilt !== t) el.textContent = rebuilt;
        continue;
      }
      // Mixed-node case: walk for the specific text node.
      try {
        var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        var node;
        while ((node = walker.nextNode())) {
          if (SUMMARY_RE.test(node.nodeValue || '')) {
            node.nodeValue = node.nodeValue.replace(SUMMARY_RE, expected);
            break;
          }
        }
      } catch (_) {}
    }
  }

  function tick() {
    try { recountUploadSummary(); }
    catch (e) {
      try { console.debug('[antcv-upload-recount-339] tick error:', e && e.message); } catch (_) {}
    }
  }

  function boot() {
    // Run once immediately and again on a small schedule to catch the
    // toast no matter when app.js mounts it.
    tick();
    [100, 300, 600, 1200, 2500, 5000, 10000].forEach(function (d) {
      setTimeout(tick, d);
    });
    // MutationObserver catches the toast at the exact moment it renders.
    try {
      var mo = new MutationObserver(function () { setTimeout(tick, 0); });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
    // personalInfo storage updates: re-normalise + re-render the toast.
    window.addEventListener('storage', function (ev) {
      if (ev && ev.key === 'personalInfo') setTimeout(tick, 0);
    });
    // The data importer fires antcv:sections-updated; the generate flow
    // fires the same. Either one is a good trigger.
    window.addEventListener('antcv:sections-updated', function () { setTimeout(tick, 0); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  // Debug API
  window.AntcvUploadRecount339 = {
    version: VERSION,
    _tick: tick,
    _normalize: normalizePersonalInfo,
    _recount: recountUploadSummary
  };

  try { console.info('[antcv-upload-recount-339] installed (v=' + VERSION + ')'); } catch (_) {}
})();
