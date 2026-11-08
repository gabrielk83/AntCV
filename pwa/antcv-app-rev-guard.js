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
 *
 * BOOT-STALE-LOCAL-001 (2026-11-08, #3536 Elma on 1.51.6405): a relay PUT changed the row;
 * then a tab whose local copy still held the OLDER document was reloaded. Boot kept the
 * local copy (mount-hydrate loads the row only over a template) and at once POSTed and
 * PUT it; the boot GETs had re-stamped this guard, so the PUT carried the fresh base_rev
 * and would have overwritten the newer row. Same for any edit made on another device or by
 * a session while a stale tab reloads. Now:
 *   - `antcv:docRev` = { id, rev }: the row rev the LOCAL DOCUMENT is based on. It is a
 *     per-tab document key in antcv-tab-doc-isolation.js, so it travels with `sections`.
 *     It advances only when this tab writes the whole document (cv + cl + meta) to a row,
 *     or makes a partial write based on the rev the document already had, or app.js loads
 *     the row at boot. A GET or an upsert never advances it.
 *   - boot: app.js asks bootCheck(id, getRow) before keeping a real local copy. A row rev
 *     other than the document's rev (or no stamp, or a stamp for another row) means the
 *     local copy predates the row: app.js loads the cloud row; the local copy is kept in
 *     localStorage `antcv:bootStaleLocal`. A row with no sections at all (JD-only, or a
 *     generation whose first PUT had not landed) keeps the local copy, as before.
 *   - until that decision, PUT /api/applications/:id and POST /api/applications are HELD.
 *     In sync -> released in order. Cloud row loaded -> dropped ({ok:false,
 *     skipped:'stale_doc'}), and so is any such write in the next 1.5 s (timers armed by
 *     the stale React state). No decision within 60 s of the first held write -> released.
 */
(function () {
  'use strict';
  var SCRIPT_VERSION = '1.51.6425-boot-stale-local';
  if (window.__antcvAppRevGuardInstalled) return;
  window.__antcvAppRevGuardInstalled = SCRIPT_VERSION;
  try { if (localStorage.getItem('antcv:disable-app-rev-guard') === '1') return; } catch (_) {}

  var revById = Object.create(null); // appId -> updated_at last loaded/saved BY THIS TAB
  var ownRevs = Object.create(null); // appId -> { rev: 1 } revs THIS tab produced (POST/PUT responses)
  var stats = { posts: 0, selfRetries: 0, skips: 0, bootHeld: 0, bootReleased: 0, bootDropped: 0 };
  var RE = /\/api\/applications\/(\d+)(?:[?#]|$)/;
  var RE_COLL = /\/api\/applications(?:[?#]|$)/;
  function idOf(url) { try { var m = RE.exec(String(url || '')); return m ? m[1] : null; } catch (_) { return null; } }
  function remember(id, rev, own) {
    if (id == null || rev == null) return;
    revById[id] = rev;
    if (own) { (ownRevs[id] = ownRevs[id] || Object.create(null))[String(rev)] = 1; }
  }

  // ─── BOOT-STALE-LOCAL-001: the row rev the local document is based on ─────────
  var DOC_REV = 'antcv:docRev';
  function readDocRev() {
    try {
      var d = JSON.parse(localStorage.getItem(DOC_REV) || 'null');
      return (d && d.id != null && d.rev != null && isFinite(Number(d.rev))) ? d : null;
    } catch (_) { return null; }
  }
  function writeDocRev(id, rev) {
    if (id == null || rev == null || !isFinite(Number(rev))) return;
    try { localStorage.setItem(DOC_REV, JSON.stringify({ id: String(id), rev: Number(rev), at: Date.now() })); } catch (_) {}
  }
  // A successful PUT keeps the document in sync with the row when it carried the whole
  // document, or when it was based on the rev the document already had.
  function noteDocWrite(id, rev, sent) {
    if (!sent || typeof sent !== 'object') return;
    var whole = Array.isArray(sent.cv_sections) && Array.isArray(sent.cl_sections) && !!sent.meta && typeof sent.meta === 'object';
    var d = readDocRev();
    var based = !!(d && String(d.id) === String(id) && sent.base_rev != null && Number(sent.base_rev) === Number(d.rev));
    if (whole || based) writeDocRev(id, rev);
  }
  // Pure: keep the local copy only when it is based on the row's current rev.
  function bootDecision(o) {
    var rowRev = o && o.rowRev;
    if (rowRev == null || !isFinite(Number(rowRev))) return { load: false, reason: 'row-rev-unknown' };
    if (o.rowEmpty) return { load: false, reason: 'row-empty' }; // loading it would show the template
    var d = o.docRev;
    if (!d || d.id == null || d.rev == null) return { load: true, reason: 'doc-rev-unknown' };
    if (String(d.id) !== String(o.chosenId)) return { load: true, reason: 'doc-of-other-row' };
    if (Number(d.rev) === Number(rowRev)) return { load: false, reason: 'in-sync' };
    return { load: true, reason: Number(rowRev) > Number(d.rev) ? 'row-newer' : 'row-rev-changed' };
  }
  function backupLocal(id, dec, rowRev) {
    var snap = null;
    try {
      snap = JSON.stringify({
        id: String(id), at: Date.now(), reason: dec.reason, docRev: readDocRev(), rowRev: rowRev,
        sections: localStorage.getItem('sections'), meta: localStorage.getItem('meta'), rationale: localStorage.getItem('rationale'),
      });
    } catch (_) { return ''; }
    try { localStorage.setItem('antcv:bootStaleLocal', snap); return 'localStorage'; } catch (_) {}
    try { sessionStorage.setItem('antcv:bootStaleLocal', snap); return 'sessionStorage'; } catch (_) {}
    return '';
  }

  // Boot write gate: document writes wait for the boot decision.
  var HOLD_MAX_MS = 60000, DROP_MS = 1500;
  var gate = { state: 'held', until: 0, held: [], timer: null, decision: null };
  function skipRes(why) {
    return new Response(JSON.stringify({ ok: false, skipped: why }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  function clearHoldTimer() { if (gate.timer) { try { clearTimeout(gate.timer); } catch (_) {} gate.timer = null; } }
  function openGate() {
    clearHoldTimer();
    gate.state = 'open';
    var q = gate.held; gate.held = [];
    stats.bootReleased += q.length;
    q.forEach(function (w) { w.go(); });
  }
  function dropGate() {
    clearHoldTimer();
    gate.state = 'drop';
    gate.until = Date.now() + DROP_MS;
    var q = gate.held; gate.held = [];
    stats.bootDropped += q.length;
    q.forEach(function (w) { w.drop(); });
  }
  function gateState() {
    if (gate.state === 'drop' && Date.now() >= gate.until) gate.state = 'open';
    return gate.state;
  }
  // A caller that has loaded the row since may let a 'stale' tab save again.
  function markLoaded(id, rev) { writeDocRev(id, rev); if (gate.state === 'stale') gate.state = 'open'; }
  function bootCheck(id, getRow) {
    return Promise.resolve().then(getRow).then(function (res) {
      var app = res && res.application;
      var full = function (a) { return Array.isArray(a) && a.length > 0; };
      var dec = bootDecision({ chosenId: id, docRev: readDocRev(), rowRev: app && app.updated_at,
        rowEmpty: !!app && !full(app.cv_sections) && !full(app.cl_sections) });
      gate.decision = dec;
      if (!dec.load) { if (gate.state === 'held') openGate(); return { load: false, decision: dec }; }
      var kept = backupLocal(id, dec, app.updated_at);
      try {
        console.warn('[app-rev-guard] BOOT-STALE-LOCAL-001: the local copy of application ' + id + ' predates the cloud row (' +
          dec.reason + ': document rev ' + ((readDocRev() || {}).rev) + ', row rev ' + app.updated_at + ') - loading the cloud row' +
          (kept ? '; the local copy is kept in ' + kept + ' antcv:bootStaleLocal' : ''));
      } catch (_) {}
      return { load: true, res: res, decision: dec };
    }).catch(function () {
      gate.decision = { load: false, reason: 'check-failed' };
      return { load: false, decision: gate.decision };
    });
  }
  // app.js calls this when mount-hydrate ends: with the row it loaded, or bare.
  function bootDone(id, row) {
    if (id != null && row && row.updated_at != null) { writeDocRev(id, row.updated_at); dropGate(); return; }
    if (gate.state !== 'held') return;
    if (gate.decision && gate.decision.load) {
      // The row was to be loaded and was not: the local copy is still stale. Save nothing.
      dropGate(); gate.state = 'stale';
      try { console.warn('[app-rev-guard] BOOT-STALE-LOCAL-001: the cloud row was not loaded - this tab saves no document until it is reloaded'); } catch (_) {}
      return;
    }
    openGate();
  }

  var orig = window.fetch;
  var inner = function (input, init) {
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
                    return inner(input, init2);
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
              if (method === 'PUT') { // BOOT-STALE-LOCAL-001
                var sent = null;
                try { sent = JSON.parse(init.body); } catch (_) {}
                noteDocWrite(id, app.updated_at, sent);
              }
            }
          }).catch(function () {});
        }
      } catch (_) {}
      return res;
    });
  };
  // BOOT-STALE-LOCAL-001: document writes pass the boot gate first.
  var guarded = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var id = idOf(url);
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    var docWrite = id ? method === 'PUT' : (method === 'POST' && RE_COLL.test(String(url || '')));
    if (!docWrite) return inner.apply(this, arguments);
    var st = gateState();
    if (st === 'drop' || st === 'stale') {
      stats.bootDropped++;
      try { console.info('[app-rev-guard] BOOT-STALE-LOCAL-001: dropped a ' + method + ' built from the stale local copy (' + url + ')'); } catch (_) {}
      return Promise.resolve(skipRes('stale_doc'));
    }
    if (st === 'held') {
      stats.bootHeld++;
      if (!gate.timer) {
        try {
          gate.timer = setTimeout(function () {
            gate.timer = null;
            if (gate.state !== 'held') return;
            try { console.warn('[app-rev-guard] BOOT-STALE-LOCAL-001: no boot decision within ' + (HOLD_MAX_MS / 1000) + ' s - releasing ' + gate.held.length + ' held write(s)'); } catch (_) {}
            openGate();
          }, HOLD_MAX_MS);
        } catch (_) { return inner(input, init); }
      }
      return new Promise(function (resolve, reject) {
        gate.held.push({
          go: function () { inner(input, init).then(resolve, reject); },
          drop: function () { resolve(skipRes('stale_doc')); },
        });
      });
    }
    return inner(input, init);
  };
  try { guarded.__antcvAppRevGuard = true; } catch (_) {}
  window.fetch = guarded;
  window.AntcvAppRevGuard = {
    version: SCRIPT_VERSION, stats: stats,
    revOf: function (id) { return revById[String(id)]; },
    ownsRev: function (id, rev) { return !!(ownRevs[String(id)] && ownRevs[String(id)][String(rev)]); },
    docRev: readDocRev, markLoaded: markLoaded, bootDecision: bootDecision, bootCheck: bootCheck, bootDone: bootDone,
    gateState: gateState, bootInfo: function () { return { state: gateState(), held: gate.held.length, decision: gate.decision }; },
  };
})();
