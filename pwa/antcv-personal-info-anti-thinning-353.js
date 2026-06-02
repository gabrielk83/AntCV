/* AntCV personalInfo anti-thinning guard (v1.40.354)
 * ============================================================================
 *
 * Problem
 * -------
 * The cloud copy of personalInfo is thin (only consent flags + email, ~4
 * fields). On load, a restore path in app.js (logged as
 * "[cloud-restore] personalInfo restored: 4 fields") writes that THIN cloud
 * copy over a RICH local personalInfo, nulling the full profile.
 *
 * v1.40.354 — NARROW THE GUARD (fixes Generate stall)
 * ---------------------------------------------------
 * v353 wrapped EVERY personalInfo write and merge-rewrote any it judged
 * thinner. That broke the generation flow: generation writes personalInfo
 * mid-flow, the guard substituted a merged object, and the flow stalled at the
 * cloud-sync step ("inputting local data to cloud" with no generation).
 *
 * This version is deliberately minimal so it CANNOT interfere with generation
 * or interactive editing:
 *
 *   1. ACTIVE WINDOW ONLY. The guard does anything at all only during the
 *      first ACTIVE_MS after load — the window in which load-time restores
 *      fire. After that it permanently disengages and every write passes
 *      straight through to the original setItem. Generation, edits, and saves
 *      happen after this window, untouched.
 *
 *   2. BLOCKS ONLY A NEAR-TOTAL WIPE. Even inside the window it intervenes
 *      only when the incoming value is essentially empty (<= WIPE_MAX
 *      non-empty fields) while local was substantial (>= RICH_MIN). That is
 *      the exact 4-fields-over-25 restore. Any other write — including a
 *      legitimate smaller update — passes through.
 *
 *   3. REVERTS, DOES NOT MERGE. When it does block, it simply KEEPS the
 *      existing rich value (re-writes the prior local string) instead of
 *      substituting a merged object. No surprise shape for any caller to
 *      choke on.
 *
 *   4. Full Erase still works (sentinel) and is allowed through.
 *
 * Loads as a blocking script before app.js so the wrapper is in place when the
 * first restore fires, but self-disarms quickly.
 */
(function () {
  'use strict';

  var VERSION = '1.40.354';
  if (window.__antcvPersonalInfoAntiThinning353 === VERSION) return;
  window.__antcvPersonalInfoAntiThinning353 = VERSION;

  var KEY = 'personalInfo';
  var ERASE_SENTINEL = 'antcv:full-erase-in-progress';

  // Only intervene during the load-time restore window, then disengage.
  var ACTIVE_MS = 8000;
  var installedAt = Date.now();
  function withinWindow() { return (Date.now() - installedAt) < ACTIVE_MS; }

  // Intervene ONLY on a near-total wipe: incoming essentially empty while
  // local was substantial. These thresholds target the 4-over-25 restore and
  // nothing else.
  var WIPE_MAX = 2;   // incoming non-empty field count at or below this ...
  var RICH_MIN = 6;   // ... while prior local had at least this many.

  function isEmptyVal(v) {
    if (v === undefined || v === null) return true;
    if (v === false) return true;
    if (typeof v === 'string') return v.trim().length === 0;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') {
      for (var k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) return false; }
      return true;
    }
    return false; // numbers, true
  }

  function nonEmptyCount(obj) {
    var n = 0;
    if (!obj || typeof obj !== 'object') return 0;
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (!isEmptyVal(obj[k])) n++;
    }
    return n;
  }

  function parse(raw) {
    try { var o = JSON.parse(raw); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; }
    catch (_) { return null; }
  }

  var origSetItem = localStorage.setItem.bind(localStorage);
  var disengaged = false;

  function guardedSetItem(key, value) {
    // Fast path: not our key, already disengaged, or past the window.
    if (disengaged || key !== KEY) return origSetItem(key, value);
    if (!withinWindow()) { disengaged = true; return origSetItem(key, value); }

    // Allow a deliberate Full Erase through.
    var erasing = false;
    try { erasing = sessionStorage.getItem(ERASE_SENTINEL) === '1'; } catch (_) {}
    if (erasing) {
      try { sessionStorage.removeItem(ERASE_SENTINEL); } catch (_) {}
      return origSetItem(key, value);
    }

    var incoming = parse(value);
    var incomingCount = incoming ? nonEmptyCount(incoming) : 0;

    // Only a near-total wipe over substantial local data is blocked.
    if (incomingCount <= WIPE_MAX) {
      var prior = parse(localStorage.getItem(KEY));
      var priorCount = prior ? nonEmptyCount(prior) : 0;
      if (priorCount >= RICH_MIN) {
        try {
          console.warn('[personal-info-anti-thinning-354] blocked near-total wipe at load: '
            + 'incoming ' + incomingCount + ' field(s) would replace ' + priorCount
            + '. Keeping existing rich personalInfo.');
        } catch (_) {}
        // Revert: keep the existing rich value verbatim. Do not merge.
        return; // no write — local rich value stays as-is
      }
    }

    // Everything else passes straight through.
    return origSetItem(key, value);
  }

  try {
    localStorage.setItem = guardedSetItem;
  } catch (_) {
    try { console.warn('[personal-info-anti-thinning-354] could not install setItem guard'); } catch (__) {}
    return;
  }

  // Arm the erase sentinel if Full Erase runs, so the deliberate wipe is allowed.
  try {
    var origErase = window.AntcvFullErase;
    if (typeof origErase === 'function') {
      window.AntcvFullErase = function () {
        try { sessionStorage.setItem(ERASE_SENTINEL, '1'); } catch (_) {}
        return origErase.apply(this, arguments);
      };
    }
  } catch (_) {}

  // Hard self-disarm after the window, regardless of further calls.
  setTimeout(function () { disengaged = true; }, ACTIVE_MS + 250);

  window.AntcvPersonalInfoAntiThinning353 = {
    version: VERSION,
    _disengaged: function () { return disengaged || !withinWindow(); },
    _isEmptyVal: isEmptyVal,
  };

  try { console.debug('[personal-info-anti-thinning-354] installed v' + VERSION + '; active for ' + ACTIVE_MS + 'ms'); } catch (_) {}
})();
