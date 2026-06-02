/* AntCV personalInfo anti-thinning guard (v1.40.353)
 * ============================================================================
 *
 * Problem
 * -------
 * The cloud copy of personalInfo is thin (only consent flags + email, ~4
 * fields). On load, a restore path in app.js (logged as
 * "[cloud-restore] personalInfo restored: 4 fields" via il()) and/or
 * antcv-version-override.js writes that THIN cloud copy over a RICH local
 * personalInfo. The user sees their full profile (name, tools, experience,
 * education) get nulled on the device that still had it.
 *
 * The PUT-side shrink-guard (289) protects the CLOUD from being overwritten
 * by a thin PUT, but nothing protects LOCAL from being overwritten by a thin
 * RESTORE. 282's fillMissing() merges correctly, but it is not the only writer
 * — app.js's own restore replaces wholesale and wins the race.
 *
 * Fix
 * ---
 * Guard localStorage.setItem('personalInfo', ...) at the source. We keep a
 * "high-water mark": the richest personalInfo seen this session (by count of
 * non-empty fields). Any setItem that would write a STRICTLY POORER
 * personalInfo (fewer non-empty fields, and not a superset) is BLOCKED — the
 * richer value is kept and, if the caller already mutated the store, restored.
 *
 * This is deliberately a localStorage.setItem wrapper rather than a fetch/JSON
 * wrapper, so it catches EVERY writer (il(), 282, version-override, future
 * code) at the one chokepoint they all pass through.
 *
 * Merge-not-block option
 * ----------------------
 * When the incoming value has SOME fields the high-water mark lacks (e.g. the
 * cloud has a fresher email but is missing everything else), we MERGE: keep
 * all rich local fields, accept any genuinely new non-empty fields from the
 * incoming thin value. So we never lose a legitimately newer field while still
 * refusing wholesale thinning.
 *
 * Safety
 * ------
 *  - Only governs the 'personalInfo' key. Nothing else is touched.
 *  - A field is "non-empty" if it is a non-empty string / non-empty array /
 *    non-empty object / any number or true. (false / '' / [] / {} / null /
 *    undefined are empty.)
 *  - Explicit user-initiated clears (Full Erase) set a sentinel so a
 *    deliberate wipe is allowed through exactly once.
 *  - Idempotent; installs once.
 *
 * Loads EARLY (before app.js restore runs) so the wrapper is in place when the
 * first restore fires.
 */
(function () {
  'use strict';

  var VERSION = '1.40.353';
  if (window.__antcvPersonalInfoAntiThinning353 === VERSION) return;
  window.__antcvPersonalInfoAntiThinning353 = VERSION;

  var KEY = 'personalInfo';
  var ERASE_SENTINEL = 'antcv:full-erase-in-progress';

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

  function nonEmptyKeys(obj) {
    var out = [];
    if (!obj || typeof obj !== 'object') return out;
    for (var k in obj) {
      if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
      if (!isEmptyVal(obj[k])) out.push(k);
    }
    return out;
  }

  function parse(raw) {
    try { var o = JSON.parse(raw); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : null; }
    catch (_) { return null; }
  }

  // Merge: start from the RICH object, then add any non-empty fields the
  // incoming object has that rich lacks (or that rich has empty). Never drops
  // a rich non-empty field.
  function mergeKeepRich(rich, incoming) {
    var out = {};
    var k;
    for (k in rich) { if (Object.prototype.hasOwnProperty.call(rich, k)) out[k] = rich[k]; }
    if (incoming && typeof incoming === 'object') {
      for (k in incoming) {
        if (!Object.prototype.hasOwnProperty.call(incoming, k)) continue;
        var iv = incoming[k];
        if (isEmptyVal(iv)) continue;            // ignore empty incoming
        if (isEmptyVal(out[k])) out[k] = iv;     // fill only where rich is empty/missing
      }
    }
    return out;
  }

  // Session high-water mark of the richest personalInfo seen.
  var hwm = null;       // parsed object
  var hwmCount = -1;    // non-empty field count

  function seedFromStore() {
    try {
      var raw = localStorage.getItem(KEY);
      var o = parse(raw);
      if (o) { hwm = o; hwmCount = nonEmptyKeys(o).length; }
    } catch (_) {}
  }
  seedFromStore();

  var origSetItem = localStorage.setItem.bind(localStorage);

  function guardedSetItem(key, value) {
    if (key !== KEY) { return origSetItem(key, value); }

    // Allow a deliberate Full Erase to pass through once.
    var erasing = false;
    try { erasing = sessionStorage.getItem(ERASE_SENTINEL) === '1'; } catch (_) {}
    if (erasing) {
      try { sessionStorage.removeItem(ERASE_SENTINEL); } catch (_) {}
      hwm = null; hwmCount = -1;
      return origSetItem(key, value);
    }

    var incoming = parse(value);
    var incomingCount = incoming ? nonEmptyKeys(incoming).length : 0;

    // No prior high-water mark, or incoming is at least as rich: accept and
    // update the mark.
    if (!hwm || incomingCount >= hwmCount) {
      if (incoming) { hwm = incoming; hwmCount = incomingCount; }
      return origSetItem(key, value);
    }

    // Incoming is POORER than the high-water mark. Refuse wholesale thinning;
    // merge so any genuinely new field still lands, but no rich field is lost.
    var merged = mergeKeepRich(hwm, incoming || {});
    var mergedCount = nonEmptyKeys(merged).length;
    hwm = merged; hwmCount = mergedCount;
    try {
      console.warn('[personal-info-anti-thinning-353] blocked thinning write: incoming '
        + incomingCount + ' non-empty field(s) vs kept ' + mergedCount
        + '. Merged to preserve richer local data.');
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:personal-info-restored', {
        detail: { source: 'anti-thinning-353', size: JSON.stringify(merged).length },
      }));
    } catch (_) {}
    return origSetItem(key, JSON.stringify(merged));
  }

  try {
    localStorage.setItem = guardedSetItem;
  } catch (_) {
    // If the environment forbids reassigning setItem, we cannot guard; bail
    // quietly rather than throwing.
    try { console.warn('[personal-info-anti-thinning-353] could not install setItem guard'); } catch (__) {}
    return;
  }

  // If Full Erase is invoked, arm the sentinel so the next personalInfo write
  // (the deliberate clear) is allowed through.
  try {
    var origErase = window.AntcvFullErase;
    if (typeof origErase === 'function') {
      window.AntcvFullErase = function () {
        try { sessionStorage.setItem(ERASE_SENTINEL, '1'); } catch (_) {}
        return origErase.apply(this, arguments);
      };
    }
  } catch (_) {}

  // Re-seed shortly after load in case a richer value lands after init from a
  // legitimate full restore (e.g. 282 on a device that DOES have rich cloud).
  [400, 1200, 3000].forEach(function (ms) {
    setTimeout(function () {
      try {
        var o = parse(localStorage.getItem(KEY));
        if (o) {
          var c = nonEmptyKeys(o).length;
          if (c > hwmCount) { hwm = o; hwmCount = c; }
        }
      } catch (_) {}
    }, ms);
  });

  window.AntcvPersonalInfoAntiThinning353 = {
    version: VERSION,
    _hwmCount: function () { return hwmCount; },
    _hwmKeys: function () { return hwm ? nonEmptyKeys(hwm) : []; },
    _isEmptyVal: isEmptyVal,
  };

  try { console.debug('[personal-info-anti-thinning-353] installed v' + VERSION + '; seed non-empty fields: ' + hwmCount); } catch (_) {}
})();
