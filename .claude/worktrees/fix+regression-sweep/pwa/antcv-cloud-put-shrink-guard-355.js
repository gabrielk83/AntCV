/* AntCV cloud-PUT personalInfo shrink protection (v1.40.355)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Builds on v289. Adds a FRESH-CLOUD-GET comparison so the guard can catch a
 * shrink that the local-backup heuristic misses — specifically the failure
 * that created the thin 4-field cloud copy: a PUT carrying email + consent
 * flags overwriting a rich cloud record when no rich LOCAL backup existed to
 * compare against. The old guard compared the PUT only against a local backup;
 * 355 also asks the cloud what it currently holds.
 *
 * What changed vs 289
 * ───────────────────
 *  1. When a PUT's personalInfo is "suspiciously thin" (substantive count
 *     1..SUSPECT_MAX), the guard GETs the current cloud personalInfo from the
 *     same /api/prefs endpoint and compares. If the cloud copy is much richer
 *     (cloudN >= CLOUD_RICH_MIN and newN < cloudN / SHRINK_DIVISOR), the PUT is
 *     catastrophic → rewrite from local backup if available, else strip
 *     personalInfo from the body so the cloud copy is preserved.
 *  2. The cloud GET is cached for CLOUD_TTL_MS so a burst of PUTs does not fan
 *     out into many GETs.
 *  3. Network-safety: GET failure / timeout / no-body → FALL BACK to the
 *     local-backup heuristic. Never blocks a PUT because a GET failed; never
 *     stalls (short GET timeout).
 *  4. Rich PUTs (newN > SUSPECT_MAX) pass through SYNCHRONOUSLY with no GET,
 *     exactly like 289. newN === 0 keeps 289's synchronous always-catastrophic
 *     rule. The async branch is entered ONLY for thin-but-nonzero PUTs.
 *
 * Safety rationale (learned the hard way this session)
 * ────────────────────────────────────────────────────
 * A guard wrapping window.fetch carries the whole app's traffic. This one does
 * extra work ONLY on PUTs to /api/prefs whose personalInfo is already thin —
 * never on generation calls, never on rich saves, never on GETs. The async
 * branch returns the original fetch promise so callers see normal behaviour.
 *
 * Supersedes 289. 289 stays installed; 355 wraps on top and sees the PUT
 * first, so 355 decides and 289 becomes a harmless second line of defence.
 */
(function () {
  'use strict';
  var VERSION = '1.40.355';
  if (window.__antcvCloudPutShrinkGuard355 === VERSION) return;
  window.__antcvCloudPutShrinkGuard355 = VERSION;

  var KEY = 'personalInfo';
  var BACKUP_PREFIX = 'antcv:personalInfo:backup:';
  var MAX_BACKUPS = 5;

  var SUSPECT_MAX = 4;       // consult cloud only when PUT is this thin or thinner
  var CLOUD_RICH_MIN = 6;    // cloud must have >= this many substantive fields to matter
  var SHRINK_DIVISOR = 3;    // block when newN < cloudN / SHRINK_DIVISOR
  var CLOUD_TTL_MS = 4000;   // cache the cloud GET this long
  var GET_TIMEOUT_MS = 1500; // never stall the PUT path

  var AUTH_FIELDS = {
    aiDisclosureAccepted: true,
    aiDisclosure: true,
    disclosureAccepted: true,
    email: true,
    _comments: true,
  };

  function safeParse(s) {
    if (s === null || s === undefined) return null;
    try { return typeof s === 'string' ? JSON.parse(s) : s; }
    catch (_) { return null; }
  }

  function countSubstantive(pi) {
    if (!pi || typeof pi !== 'object' || Array.isArray(pi)) return 0;
    var n = 0;
    for (var k in pi) {
      if (!Object.prototype.hasOwnProperty.call(pi, k)) continue;
      if (AUTH_FIELDS[k]) continue;
      var v = pi[k];
      if (v === null || v === undefined || v === '') continue;
      if (Array.isArray(v) && v.length === 0) continue;
      if (typeof v === 'object') {
        var any = false;
        for (var kk in v) { if (Object.prototype.hasOwnProperty.call(v, kk)) { any = true; break; } }
        if (!any) continue;
      }
      n++;
    }
    return n;
  }

  function newestBackup() {
    var best = null;
    for (var i = 0; i < MAX_BACKUPS; i++) {
      try {
        var raw = window.localStorage.getItem(BACKUP_PREFIX + i);
        if (!raw) continue;
        var obj = safeParse(raw);
        if (!obj || !obj.data) continue;
        var n = obj.n || countSubstantive(obj.data);
        if (n < 3) continue;
        if (!best || (obj.ts || 0) > (best.ts || 0)) {
          best = { ts: obj.ts || 0, n: n, data: obj.data };
        }
      } catch (_) {}
    }
    return best;
  }

  function isPrefsPut(url, init) {
    if (!init || init.method !== 'PUT') return false;
    var u = '';
    try { u = (typeof url === 'string') ? url : (url && url.url) || ''; }
    catch (_) {}
    return /\/api\/prefs(\?|$|\/)/.test(String(u));
  }

  function prefsUrlFrom(url) {
    try { return (typeof url === 'string') ? url : (url && url.url) || ''; }
    catch (_) { return ''; }
  }

  function rewriteInit(init, newBody) {
    var copy = {};
    for (var k in init) {
      if (Object.prototype.hasOwnProperty.call(init, k)) copy[k] = init[k];
    }
    copy.body = JSON.stringify(newBody);
    return copy;
  }

  function syntheticOk() {
    var body = JSON.stringify({ ok: true, skipped: true, reason: 'cloud-put-shrink-guard-355 skipped empty PUT' });
    try {
      return Promise.resolve(new Response(body, {
        status: 200, headers: { 'Content-Type': 'application/json' },
      }));
    } catch (_) {
      return Promise.resolve({
        ok: true, status: 200,
        json: function () { return Promise.resolve({ ok: true, skipped: true }); },
        text: function () { return Promise.resolve(body); },
      });
    }
  }

  var origFetch = window.fetch;
  if (typeof origFetch !== 'function') return;

  var cloudCache = { ts: 0, count: -1, ok: false };

  function withTimeout(promise, ms) {
    return new Promise(function (resolve) {
      var done = false;
      var t = setTimeout(function () { if (!done) { done = true; resolve({ _timeout: true }); } }, ms);
      promise.then(
        function (v) { if (!done) { done = true; clearTimeout(t); resolve(v); } },
        function () { if (!done) { done = true; clearTimeout(t); resolve({ _error: true }); } }
      );
    });
  }

  // Promise<number|null>: cloud personalInfo substantive count, or null if unknown.
  function cloudSubstantiveCount(prefsUrl) {
    var now = Date.now();
    if (cloudCache.ok && (now - cloudCache.ts) < CLOUD_TTL_MS) {
      return Promise.resolve(cloudCache.count);
    }
    if (!prefsUrl) return Promise.resolve(null);
    var getReq;
    try {
      getReq = origFetch.call(window, prefsUrl, { method: 'GET', credentials: 'include' });
    } catch (_) { return Promise.resolve(null); }
    return withTimeout(getReq, GET_TIMEOUT_MS).then(function (res) {
      if (!res || res._timeout || res._error || !res.ok || typeof res.json !== 'function') return null;
      return res.json().then(function (j) {
        var pi = j && j[KEY];
        if (pi === undefined && j && j.data) pi = j.data[KEY];
        if (pi === undefined) return null;
        var c = countSubstantive(pi);
        cloudCache = { ts: Date.now(), count: c, ok: true };
        return c;
      }, function () { return null; });
    }, function () { return null; });
  }

  function localDecision(parsedBody, newN) {
    var backup = newestBackup();
    if (backup && backup.data) {
      var rewritten = {};
      for (var k in backup.data) {
        if (Object.prototype.hasOwnProperty.call(backup.data, k)) rewritten[k] = backup.data[k];
      }
      var newPi = parsedBody[KEY];
      if (newPi && typeof newPi === 'object') {
        for (var ak in AUTH_FIELDS) {
          if (newPi[ak] !== undefined && newPi[ak] !== null && newPi[ak] !== '') {
            rewritten[ak] = newPi[ak];
          }
        }
      }
      var nb = {};
      for (var bk in parsedBody) {
        if (Object.prototype.hasOwnProperty.call(parsedBody, bk)) nb[bk] = parsedBody[bk];
      }
      nb[KEY] = rewritten;
      return { action: 'rewrite', newBody: nb, backupN: backup.n, newN: newN };
    }
    var stripped = {};
    var otherKeys = 0;
    for (var sk in parsedBody) {
      if (!Object.prototype.hasOwnProperty.call(parsedBody, sk)) continue;
      if (sk === KEY) continue;
      stripped[sk] = parsedBody[sk];
      otherKeys++;
    }
    if (otherKeys === 0) return { action: 'skip', newN: newN };
    return { action: 'strip', newBody: stripped, newN: newN };
  }

  function applyDecision(d, url, init) {
    if (d.action === 'rewrite') {
      try {
        console.warn('[cloud-put-shrink-guard-355] REWROTE shrink: PUT would set personalInfo to '
          + d.newN + ' field(s); replaced with backup (' + d.backupN + ').'
          + (d.cloudN != null ? ' Cloud had ' + d.cloudN + '.' : ''));
      } catch (_) {}
      return origFetch.call(window, url, rewriteInit(init, d.newBody));
    }
    if (d.action === 'strip') {
      try {
        console.warn('[cloud-put-shrink-guard-355] STRIPPED personalInfo from PUT ('
          + d.newN + ' field(s)); cloud copy preserved.'
          + (d.cloudN != null ? ' Cloud had ' + d.cloudN + '.' : ''));
      } catch (_) {}
      return origFetch.call(window, url, rewriteInit(init, d.newBody));
    }
    if (d.action === 'skip') {
      try {
        console.warn('[cloud-put-shrink-guard-355] SKIPPED empty PUT ('
          + d.newN + ' field(s), no backup); synthetic 200 OK.');
      } catch (_) {}
      return syntheticOk();
    }
    return origFetch.call(window, url, init);
  }

  var guardedFetch = function (url, init) {
    try {
      if (init && isPrefsPut(url, init) && init.body) {
        var bodyStr = (typeof init.body === 'string') ? init.body : null;
        if (bodyStr) {
          var parsed = safeParse(bodyStr);
          if (parsed && typeof parsed === 'object' && parsed[KEY] !== undefined) {
            var newN = countSubstantive(parsed[KEY]);

            // newN === 0: always catastrophic, synchronous (289 rule).
            if (newN === 0) {
              return applyDecision(localDecision(parsed, newN), url, init);
            }
            // Rich PUT: pass straight through, zero overhead, no GET.
            if (newN > SUSPECT_MAX) {
              return origFetch.call(window, url, init);
            }
            // Thin-but-nonzero: consult the cloud.
            var prefsUrl = prefsUrlFrom(url);
            return cloudSubstantiveCount(prefsUrl).then(function (cloudN) {
              if (cloudN == null) {
                // Cloud unknown — fall back to local-backup heuristic.
                var backup = newestBackup();
                var backupN = backup ? backup.n : 0;
                if (backupN >= CLOUD_RICH_MIN && newN < Math.max(2, backupN / SHRINK_DIVISOR)) {
                  return applyDecision(localDecision(parsed, newN), url, init);
                }
                return origFetch.call(window, url, init);
              }
              if (cloudN >= CLOUD_RICH_MIN && newN < Math.max(2, cloudN / SHRINK_DIVISOR)) {
                var d = localDecision(parsed, newN);
                d.cloudN = cloudN;
                return applyDecision(d, url, init);
              }
              return origFetch.call(window, url, init);
            }).catch(function () {
              return origFetch.call(window, url, init);
            });
          }
        }
      }
    } catch (e) {
      try { console.warn('[cloud-put-shrink-guard-355] guard error (passing through):', e && e.message); } catch (_) {}
    }
    return origFetch.call(window, url, init);
  };

  try { window.fetch = guardedFetch; }
  catch (_) {}

  window.AntcvCloudPutShrinkGuard355 = {
    version: VERSION,
    _countSubstantive: countSubstantive,
    _newestBackup: newestBackup,
    _cloudCount: cloudSubstantiveCount,
    _cacheState: function () { return cloudCache; },
  };

  try { console.debug('[cloud-put-shrink-guard-355] installed v' + VERSION); } catch (_) {}
})();
