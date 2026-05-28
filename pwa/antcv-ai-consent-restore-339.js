/* AntCV AI-consent top-level LS restore (v1.40.339-n)
 * ===========================================================================
 * Bridges the gap left by antcv-personal-info-cloud-restore-282.js for
 * AI-consent state. Cloud is the source of truth for consent; cookie
 * clear (or a full site-data clear) must NOT cause an unwanted re-prompt.
 *
 * Problem
 * -------
 * After cookies + LS are cleared and the user re-signs in:
 *   1. -282 (antcv-personal-info-cloud-restore-282.js) fetches /api/prefs.
 *   2. -282 extracts the nested `personalInfo` object and merges into
 *      localStorage.personalInfo. personalInfo.aiDisclosureAccepted is
 *      back ✓.
 *   3. The TOP-LEVEL localStorage.aiDisclosureAccepted is NOT touched
 *      because -282 only walks the nested object.
 *   4. The bundle's AI-notice gate reads the top-level key → empty →
 *      shows the modal even though the cloud has consent.
 *
 * -224 (antcv-ai-consent-cloud-sync-224.js) syncs LOCAL → CLOUD on
 * acceptance and writes consent at BOTH the top level AND nested in
 * personalInfo (see its prefsPayload). So the cloud reliably has both.
 * The asymmetry is only on the restore side.
 *
 * Mechanism
 * ---------
 *   1. At boot (~200 ms delay so -282 has a head start) check whether
 *      a promotion is needed.
 *   2. Listen for `antcv:personal-info-restored` (dispatched by -282
 *      after a successful cloud restore) and check again.
 *   3. Also listen for cross-tab `storage` events on personalInfo.
 *
 * On each check:
 *   - If top-level aiDisclosureAccepted is already truthy → no-op.
 *   - If personalInfo (now in LS) has any truthy consent marker
 *     (aiDisclosureAccepted / aiDisclosure / disclosureAccepted) →
 *     write the timestamp to the top-level keys (aiDisclosureAccepted,
 *     euAiDisclosureAccepted, and aiDisclosureAcceptedMeta if absent).
 *   - If no nested consent → no-op (user never accepted on this account).
 *
 * Escape hatch: localStorage['antcv:disable-consent-restore'] = '1'.
 *
 * Coexistence
 * -----------
 * -224 stays in charge of LOCAL → CLOUD propagation and user-delete
 * scrubs. This sidecar only handles the CLOUD → LOCAL "missing top-
 * level" case. They don't overlap.
 *
 * Does NOT re-fetch /api/prefs. Relies on -282 having pulled the data
 * and populated personalInfo. If -282 didn't run (no signin, no relay),
 * this sidecar also no-ops, which is the right behaviour: don't fake
 * consent the cloud hasn't actually granted.
 * ===========================================================================
 */
(function () {
  'use strict';

  var VERSION = '1.40.339-n';
  if (window.__antcvConsentRestore339 === VERSION) return;
  window.__antcvConsentRestore339 = VERSION;

  var DISABLE_KEY = 'antcv:disable-consent-restore';

  function disabled() {
    try {
      var v = localStorage.getItem(DISABLE_KEY);
      return v === '1' || v === 'true';
    } catch (_) { return false; }
  }
  function readLs(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function writeLs(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  // Mirrored from -224: same truthy semantics for consent fields.
  function truthy(v) {
    if (v === true) return true;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      return !!s && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined' && s !== 'no';
    }
    if (v && typeof v === 'object') {
      if ('accepted' in v) return truthy(v.accepted);
      if ('value' in v) return truthy(v.value);
      if ('at' in v || 'acceptedAt' in v || 'timestamp' in v) return true;
    }
    return false;
  }

  function promoteFromPersonalInfo(reason) {
    if (disabled()) {
      try { console.debug('[consent-restore-339] disabled via LS escape hatch'); } catch (_) {}
      return false;
    }

    // Already present at top level — nothing to do.
    if (truthy(readLs('aiDisclosureAccepted'))) {
      return false;
    }

    var pi;
    try {
      pi = JSON.parse(readLs('personalInfo') || '{}') || {};
    } catch (_) { return false; }

    var hasNestedConsent =
      truthy(pi.aiDisclosureAccepted) ||
      truthy(pi.aiDisclosure) ||
      truthy(pi.disclosureAccepted);

    if (!hasNestedConsent) {
      // User never accepted on this account, or personalInfo isn't yet
      // restored. Either way, no-op — don't fabricate consent.
      return false;
    }

    // Pick the best timestamp string we can find. The nested field is
    // usually a timestamp string already, written by -224.
    var at = '';
    if (typeof pi.aiDisclosureAccepted === 'string' && pi.aiDisclosureAccepted.trim()) {
      at = pi.aiDisclosureAccepted.trim();
    } else if (typeof pi.aiDisclosureAcceptedAt === 'string' && pi.aiDisclosureAcceptedAt.trim()) {
      at = pi.aiDisclosureAcceptedAt.trim();
    } else if (typeof pi.disclosureAcceptedAt === 'string' && pi.disclosureAcceptedAt.trim()) {
      at = pi.disclosureAcceptedAt.trim();
    } else {
      // Boolean-only signal — synthesise a "now" timestamp so the bundle's
      // gate sees a truthy string. Acceptable because this only fires when
      // the cloud has indicated prior acceptance.
      at = new Date().toISOString();
    }

    writeLs('aiDisclosureAccepted', at);
    writeLs('euAiDisclosureAccepted', at);

    // Restore meta if absent. Use the nested meta object if present, else
    // synthesise a minimal one.
    if (!readLs('aiDisclosureAcceptedMeta')) {
      var meta;
      if (pi.aiDisclosureAcceptedMeta && typeof pi.aiDisclosureAcceptedMeta === 'object') {
        meta = pi.aiDisclosureAcceptedMeta;
      } else {
        meta = { accepted: true, acceptedAt: at, source: 'cloud-restore-promote', email: '' };
      }
      try { writeLs('aiDisclosureAcceptedMeta', JSON.stringify(meta)); } catch (_) {}
    }

    try {
      console.info('[consent-restore-339] promoted nested personalInfo consent to top-level LS (reason=' +
        reason + ', at=' + at + ')');
    } catch (_) {}

    // Dispatch a signal in case any other listener cares.
    try {
      window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-restored', {
        detail: { version: VERSION, reason: reason, at: at }
      }));
    } catch (_) {}

    return true;
  }

  // Boot-time check (race: -282 may have fired before we loaded).
  function bootCheck() {
    promoteFromPersonalInfo('boot');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(bootCheck, 200);
    }, { once: true });
  } else {
    setTimeout(bootCheck, 200);
  }

  // Listen for -282's restore event.
  window.addEventListener('antcv:personal-info-restored', function (ev) {
    var src = (ev && ev.detail && ev.detail.source) || 'unknown';
    promoteFromPersonalInfo('personal-info-restored:' + src);
  });

  // Cross-tab signal: another tab restored personalInfo.
  window.addEventListener('storage', function (ev) {
    if (!ev || ev.key !== 'personalInfo') return;
    promoteFromPersonalInfo('storage-event');
  });

  // Also retry on focus/visibility (sign-in flows can complete async).
  ['focus', 'pageshow', 'visibilitychange'].forEach(function (e) {
    window.addEventListener(e, function () {
      setTimeout(function () { promoteFromPersonalInfo(e); }, 0);
    });
  });

  window.AntcvConsentRestore339 = {
    version: VERSION,
    _promote: promoteFromPersonalInfo
  };

  try { console.debug('[consent-restore-339] installed ' + VERSION); } catch (_) {}
})();
