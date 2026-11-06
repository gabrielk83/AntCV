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
 *
 * AUTOSYNC-STALE-REV-001 (owner 2026-11-06, top session's fetch log on 1.51.6085): the
 * sections effect POSTs /api/applications (upsert, no id in the URL) on every sections
 * change; the relay's dedupe UPDATE bumps updated_at without writing cv/cl. This guard only
 * stamped URLs WITH an id, so the tab's OWN upsert made its stamp stale and every following
 * auto-sync PUT was answered 409 -> {ok:false, skipped:'stale_rev'} while the app logged
 * "auto-sync ok": 22 POSTs / 11 PUTs in 135 s, no local edit reached the cloud. Now:
 *   - a successful POST /api/applications response stamps application.id from its body, and
 *     every rev this tab produced itself (POST or PUT response) is remembered;
 *   - a 409 whose updated_at is one of THIS tab's own revs is self-inflicted (the PUT raced
 *     the upsert): the stamp advances and the PUT is re-sent once with the fresh base_rev.
 *     A 409 naming a rev this tab never produced is a genuinely newer row elsewhere and
 *     keeps the skip (the tab stays stale until it re-loads the row).
 */
(function () {
  'use strict';
  var SCRIPT_VERSION = '1.51.6165-autosync-stale-rev';
  if (window.__antcvAppRevGuardInstalled) return;
  window.__antcvAppRevGuardInstalled = SCRIPT_VERSION;
  try { if (localStorage.getItem('antcv:disable-app-rev-guard') === '1') return; } catch (_) {}

  var revById = Object.create(null); // appId -> updated_at last loaded/saved BY THIS TAB
  var ownRevs = Object.create(null); // appId -> { rev: 1 } revs THIS tab produced (POST/PUT responses)
  var stats = { posts: 0, selfRetries: 0, skips: 0 };
  var RE = /\/api\/applications\/(\d+)(?:[?#]|$)/;
  var RE_COLL = /\/api\/applications(?:[?#]|$)/;
  function idOf(url) { try { var m = RE.exec(String(url || '')); return m ? m[1] : null; } catch (_) { return null; } }
  function remember(id, rev, own) {
    if (id == null || rev == null) return;
    revById[id] = rev;
    if (own) { (ownRevs[id] = ownRevs[id] || Object.create(null))[String(rev)] = 1; }
  }

  var orig = window.fetch;
  var guarded = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var id = idOf(url);
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    // AUTOSYNC-STALE-REV-001: the collection POST (upsert) answers with the row it touched -
    // stamp it, or the tab's own write makes every following PUT stale.
    if (!id) {
      if (method !== 'POST' || !RE_COLL.test(String(url || ''))) return orig.apply(window, arguments);
      return orig.call(window, input, init).then(function (res) {
        try {
          if (res && res.ok) {
            res.clone().json().then(function (j) {
              var app = j && j.application;
              if (app && app.id != null && app.updated_at != null) { stats.posts++; remember(String(app.id), app.updated_at, true); }
            }).catch(function () {});
          }
        } catch (_) {}
        return res;
      });
    }

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
              // AUTOSYNC-STALE-REV-001: a conflict against a rev THIS tab produced (its own
              // upsert raced this PUT) is not a foreign writer - advance and re-send once.
              var selfRev = j.updated_at != null && ownRevs[id] && ownRevs[id][String(j.updated_at)];
              if (selfRev && init && typeof init.body === 'string' && !(init.__antcvRevRetry)) {
                try {
                  var b2 = JSON.parse(init.body);
                  if (b2 && typeof b2 === 'object') {
                    revById[id] = j.updated_at;
                    b2.base_rev = j.updated_at;
                    var init2 = Object.assign({}, init, { body: JSON.stringify(b2) });
                    try { Object.defineProperty(init2, '__antcvRevRetry', { value: true, enumerable: false }); } catch (_) { init2.__antcvRevRetry = true; }
                    stats.selfRetries++;
                    try { console.info('[app-rev-guard] AUTOSYNC-STALE-REV-001: PUT for application ' + id + ' raced this tab\'s own upsert (rev ' + j.updated_at + ') - re-sent with the fresh base_rev'); } catch (_) {}
                    return guarded(input, init2);
                  }
                } catch (_) {}
              }
              stats.skips++;
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
              remember(id, app.updated_at, method !== 'GET'); // AUTOSYNC-STALE-REV-001: a PUT/POST rev is this tab's own
            }
          }).catch(function () {});
        }
      } catch (_) {}
      return res;
    });
  };
  try { guarded.__antcvAppRevGuard = true; } catch (_) {}
  window.fetch = guarded;
  window.AntcvAppRevGuard = { version: SCRIPT_VERSION, stats: stats, revOf: function (id) { return revById[String(id)]; }, ownsRev: function (id, rev) { return !!(ownRevs[String(id)] && ownRevs[String(id)][String(rev)]); } };
})();
