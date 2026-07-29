/* antcv-app-rev-guard.js — AUTOSAVE-STALE-CLOBBER-001 (owner 2026-07-22).
 *
 * Problem [HIGH, data-loss]: an OPEN app tab's 3-second APPLICATION AUTO-SYNC
 * (app.src.js ~18671: oo.update(activeId, {cv_sections, ...})) replays that tab's
 * in-memory/localStorage state over the server row — clobbering any FRESHER write
 * made elsewhere (the nightly density-regen PUT, another device, another tab).
 * The relay PUT was last-write-wins; the memory note: "open app tab reverts a
 * cloud density PUT (save-on-open); don't write while open; fix=server-rev guard."
 *
 * Fix (request-only fetch-guard, NO app.js edits — same pattern as
 * antcv-cloud-put-shrink-guard-355): per-TAB (in-memory, deliberately NOT
 * localStorage so a stale sibling tab cannot borrow a fresh stamp) remember the
 * `updated_at` this tab last LOADED or SAVED for each application id, stamped
 * from every GET/PUT /api/applications/:id response. Then:
 *   - every PUT /api/applications/:id gets `base_rev` = the tab's stamp injected
 *     into its JSON body. The relay (auth-35-autosave-rev-guard) rejects a
 *     mismatch 409 instead of writing — optimistic concurrency, jobTracker-style.
 *   - a 409 conflict response is converted into a synthetic 200
 *     {ok:false, skipped:'stale_rev'} so the app's save path stays calm; the skip
 *     is console.info'd. The stamp is NOT advanced on conflict — the tab stays
 *     "stale" until it genuinely re-LOADS the row (a GET re-stamps with fresh
 *     content), so a later tick can never sneak the old state through.
 *   - no stamp for that id (sidecar loaded after the app fetched, first save of
 *     a new row, old relay) -> body untouched -> exact legacy behaviour. Fail-open
 *     everywhere; kill switch localStorage antcv:disable-app-rev-guard = '1'.
 */
(function () {
  'use strict';
  var SCRIPT_VERSION = '1.51.3040-app-rev-guard';
  if (window.__antcvAppRevGuardInstalled) return;
  window.__antcvAppRevGuardInstalled = SCRIPT_VERSION;
  try { if (localStorage.getItem('antcv:disable-app-rev-guard') === '1') return; } catch (_) {}

  var revById = Object.create(null); // appId -> updated_at last loaded/saved BY THIS TAB
  var RE = /\/api\/applications\/(\d+)(?:[?#]|$)/;
  function idOf(url) { try { var m = RE.exec(String(url || '')); return m ? m[1] : null; } catch (_) { return null; } }

  var orig = window.fetch;
  var guarded = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var id = idOf(url);
    if (!id) return orig.apply(window, arguments);
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();

    // Inject base_rev into a PUT body when this tab has a stamp for the row.
    if (method === 'PUT' && init && typeof init.body === 'string' && revById[id] != null) {
      try {
        var body = JSON.parse(init.body);
        if (body && typeof body === 'object' && body.base_rev === undefined) {
          body.base_rev = revById[id];
          init = Object.assign({}, init, { body: JSON.stringify(body) });
        }
      } catch (_) {}
    }

    return orig.call(window, input, init).then(function (res) {
      try {
        if (method === 'PUT' && res && res.status === 409) {
          return res.clone().json().catch(function () { return null; }).then(function (j) {
            if (j && j.error === 'conflict') {
              try {
                console.info('[app-rev-guard] SKIPPED a stale auto-save PUT for application ' + id +
                  ' — the server row is newer (rev ' + j.updated_at + ' > this tab\'s ' + revById[id] +
                  '). Reload/reopen the application to pick up the fresh content. (AUTOSAVE-STALE-CLOBBER-001)');
              } catch (_) {}
              // Deliberately do NOT advance revById[id]: the tab's content is stale.
              return new Response(JSON.stringify({ ok: false, skipped: 'stale_rev', updated_at: j.updated_at }), {
                status: 200, headers: { 'content-type': 'application/json' },
              });
            }
            return res;
          });
        }
        if (res && res.ok && (method === 'GET' || method === 'PUT' || method === 'POST')) {
          res.clone().json().then(function (j) {
            var app = j && j.application;
            if (app && app.updated_at != null && (app.id == null || String(app.id) === String(id))) {
              revById[id] = app.updated_at;
            }
          }).catch(function () {});
        }
      } catch (_) {}
      return res;
    });
  };
  try { guarded.__antcvAppRevGuard = true; } catch (_) {}
  window.fetch = guarded;
})();
