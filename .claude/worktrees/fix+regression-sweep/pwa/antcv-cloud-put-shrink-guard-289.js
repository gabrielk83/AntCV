/* AntCV cloud-PUT personalInfo shrink protection (v1.40.289)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Replaces v288. Same goal, three semantic changes:
 *
 *   1. Tighter "catastrophic" thresholds.
 *      v288 caught:   backup>=5 && new===0  OR  backup>=8 && new<backup/2
 *      v289 catches:  new===0  (always)  OR  backup>=6 && new<max(2,backup/3)
 *      Reason: real-world failure mode is "PUT carries auth-only
 *      body" — new===0. v288 required backup>=5 to flag that case;
 *      v289 always flags new===0 because the cloud might have
 *      substantive data even when the local backup doesn't (e.g.
 *      first boot after a profile shift). The fallback path then
 *      decides what to do (rewrite if backup exists, strip if not,
 *      skip if body is empty after strip). The half-shrink rule
 *      is loosened to one-third so a 6→1 drop is now caught
 *      (was 6→2 was, 6→1 wasn't).
 *
 *   2. Hard-block fallback when NO usable local backup exists.
 *      v288 had a gap: if the PUT shrinks to zero and no local
 *      backup is available, v288 passed the PUT through unchanged
 *      — the empty body hit the cloud and overwrote it. v289 in
 *      that case STRIPS personalInfo from the body so the relay
 *      still receives a PUT (for any other keys) but personalInfo
 *      is left untouched on the server side. If stripping leaves
 *      the body empty, v289 returns a synthetic 200 OK Response
 *      and never hits the network. Either way the cloud's
 *      personalInfo stays intact.
 *
 *   3. Version-coexistence guard.
 *      If v288 is already installed (window.__antcvCloudPutShrinkGuard288)
 *      we leave its wrapper in place but install v289 on top so
 *      both checks fire in sequence. v289 wrapping the chain means
 *      v289 sees the original PUT first; if v289 rewrites/blocks,
 *      v288 never sees it. If v289 lets through, v288's older
 *      check is a second line of defence — harmless.
 *
 * Naming reason
 * ─────────────
 * The v288 file as it stood already had rewrite-from-backup logic,
 * but the deployed bundle's v288 was an earlier allow-mode log-only
 * variant (the transcript shows "catastrophic shrink observed
 * (allowed)" — that string doesn't exist in the v288 source). To
 * keep the version number aligned with what's actually deployed in
 * the bundle, v289 marks the semantic change cleanly: any browser
 * loading antcv-cloud-put-shrink-guard-289.js gets the
 * block-when-no-backup behaviour, regardless of which v288 it has.
 */
(function () {
  'use strict';
  var VERSION = '1.40.289';
  if (window.__antcvCloudPutShrinkGuard289 === VERSION) return;
  window.__antcvCloudPutShrinkGuard289 = VERSION;

  var KEY = 'personalInfo';
  var BACKUP_PREFIX = 'antcv:personalInfo:backup:';
  var MAX_BACKUPS = 5;

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
        if (n < 3) continue; // v289: lowered from 5 to 3
        if (!best || (obj.ts || 0) > (best.ts || 0)) {
          best = { ts: obj.ts || 0, n: n, data: obj.data };
        }
      } catch (_) {}
    }
    return best;
  }

  // Three possible decisions:
  //   { action: 'pass' }                              — PUT goes through unchanged.
  //   { action: 'rewrite', newBody, backupN, newN }   — PUT rewritten to carry the backup's content.
  //   { action: 'strip', newBody, newN }              — personalInfo removed from PUT body.
  //   { action: 'skip', newN }                        — PUT cancelled; synthetic 200 OK returned.
  function decide(parsedBody) {
    if (!parsedBody || typeof parsedBody !== 'object') return { action: 'pass' };
    if (!Object.prototype.hasOwnProperty.call(parsedBody, KEY)) return { action: 'pass' };
    var newPi = parsedBody[KEY];
    var newN = countSubstantive(newPi);

    // Non-catastrophic? Pass.
    var backup = newestBackup();
    var backupN = backup ? backup.n : 0;
    var catastrophic = false;
    // ANY empty-personalInfo PUT is catastrophic, regardless of whether
    // we have a local backup. Reasoning: the only legitimate empty PUT
    // is the very first syncConsent before the user has any data, and
    // dropping that PUT is recoverable (the next real save will carry
    // the disclosure too). Letting it through is NOT recoverable if
    // the cloud already has substantive data — that data gets wiped.
    if (newN === 0) catastrophic = true;
    else if (backupN >= 6 && newN < Math.max(2, backupN / 3)) catastrophic = true;
    if (!catastrophic) return { action: 'pass' };

    // Catastrophic. Prefer rewrite (we have a backup); else strip; else skip.
    if (backup && backup.data) {
      var rewritten = {};
      for (var k in backup.data) {
        if (Object.prototype.hasOwnProperty.call(backup.data, k)) rewritten[k] = backup.data[k];
      }
      if (newPi && typeof newPi === 'object') {
        for (var ak in AUTH_FIELDS) {
          if (newPi[ak] !== undefined && newPi[ak] !== null && newPi[ak] !== '') {
            rewritten[ak] = newPi[ak];
          }
        }
      }
      var newBody = {};
      for (var bk in parsedBody) {
        if (Object.prototype.hasOwnProperty.call(parsedBody, bk)) newBody[bk] = parsedBody[bk];
      }
      newBody[KEY] = rewritten;
      return { action: 'rewrite', newBody: newBody, backupN: backupN, newN: newN };
    }

    // No backup. Strip personalInfo from the body.
    var stripped = {};
    var otherKeys = 0;
    for (var sk in parsedBody) {
      if (!Object.prototype.hasOwnProperty.call(parsedBody, sk)) continue;
      if (sk === KEY) continue;
      stripped[sk] = parsedBody[sk];
      otherKeys++;
    }
    if (otherKeys === 0) {
      return { action: 'skip', newN: newN };
    }
    return { action: 'strip', newBody: stripped, newN: newN };
  }

  function isPrefsPut(url, init) {
    if (!init || init.method !== 'PUT') return false;
    var u = '';
    try { u = (typeof url === 'string') ? url : (url && url.url) || ''; }
    catch (_) {}
    return /\/api\/prefs(\?|$|\/)/.test(String(u));
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
    // Mimic relay's success response shape; minimal, JSON-parseable.
    var body = JSON.stringify({ ok: true, skipped: true, reason: 'cloud-put-shrink-guard-289 skipped empty PUT' });
    try {
      return Promise.resolve(new Response(body, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }));
    } catch (_) {
      // Older browsers without Response constructor — fall back to a thenable.
      return Promise.resolve({
        ok: true,
        status: 200,
        json: function () { return Promise.resolve({ ok: true, skipped: true }); },
        text: function () { return Promise.resolve(body); },
      });
    }
  }

  var origFetch = window.fetch;
  if (typeof origFetch !== 'function') return;

  var guardedFetch = function (url, init) {
    try {
      if (init && isPrefsPut(url, init) && init.body) {
        var bodyStr = (typeof init.body === 'string') ? init.body : null;
        if (bodyStr) {
          var parsed = safeParse(bodyStr);
          if (parsed && typeof parsed === 'object' && parsed[KEY] !== undefined) {
            var d = decide(parsed);
            if (d.action === 'rewrite') {
              try {
                console.warn('[cloud-put-shrink-guard-289] REWROTE catastrophic shrink: '
                  + 'PUT would have set personalInfo to ' + d.newN + ' substantive field(s); '
                  + 'replaced with backup (' + d.backupN + ' fields).');
              } catch (_) {}
              return origFetch.call(window, url, rewriteInit(init, d.newBody));
            }
            if (d.action === 'strip') {
              try {
                console.warn('[cloud-put-shrink-guard-289] STRIPPED personalInfo from PUT: '
                  + 'no local backup available, PUT had ' + d.newN + ' substantive field(s) — '
                  + 'PUT forwarded without personalInfo so the cloud copy is preserved.');
              } catch (_) {}
              return origFetch.call(window, url, rewriteInit(init, d.newBody));
            }
            if (d.action === 'skip') {
              try {
                console.warn('[cloud-put-shrink-guard-289] SKIPPED empty PUT: '
                  + 'body contained only personalInfo (' + d.newN + ' fields) and no backup; '
                  + 'no network request issued, synthetic 200 OK returned.');
              } catch (_) {}
              return syntheticOk();
            }
          }
        }
      }
    } catch (e) {
      try { console.warn('[cloud-put-shrink-guard-289] guard error (passing through):', e && e.message); } catch (_) {}
    }
    return origFetch.call(window, url, init);
  };

  try { window.fetch = guardedFetch; }
  catch (_) {}

  window.AntcvCloudPutShrinkGuard289 = {
    version: VERSION,
    _newestBackup: newestBackup,
    _countSubstantive: countSubstantive,
    _decide: decide,
  };

  try { console.debug('[cloud-put-shrink-guard-289] installed v' + VERSION); } catch (_) {}
})();
