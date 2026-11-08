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
 *
 * OPEN-STALE-TAB-001 (2026-11-08): the same overwrite from a tab that stays OPEN. Two
 * routes, both reproduced on 1.51.6425: (a) any GET of the row after the foreign edit
 * re-stamps revById, so the next auto-sync PUT carries the fresh rev; (b) the tab's own
 * upsert POST lands after the foreign edit, and its rev counts as "this tab's own", so the
 * PUT is accepted directly or after the self-retry. Now:
 *   - `antcv:docRev` also keeps `fp`, a fingerprint of the row's cv_sections + cl_sections
 *     as the relay returned them at that rev. Every GET/POST/PUT response for the
 *     document's row whose sections still match `fp` moves docRev.rev forward (an upsert
 *     or a partial write moved the rev, not the document). A response whose sections
 *     differ moves nothing.
 *   - a PUT that carries sections to the document's row gets base_rev = docRev.rev, not
 *     the last rev any request saw. Other PUTs keep revById.
 *   - a 409 on such a PUT: the guard GETs the row; same sections -> re-sent once on the
 *     row's rev; different sections -> {ok:false, skipped:'stale_rev'} and the tab stays
 *     stale until it loads the row (reload, or reopen from the menu).
 *   - every app.js path that puts a row into the editor (mount-hydrate, the topbar and
 *     Settings switches, the unsolicited fallback, both /api/prefs restores) calls
 *     markLoaded(id, row), so docRev follows the document.
 *
 * OPEN-STALE-NOTICE-001 (2026-11-09): a stale tab stopped saving with only a console line. The
 * guard now fires `antcv:doc-stale` {id, reason, rowRev, docRev, company} when a sections PUT is
 * skipped because the row's sections changed elsewhere (or the boot load did not happen), and
 * `antcv:doc-fresh` once the document is based on the row again (a load, a saved write, or the row
 * coming back to the document's sections). antcv-doc-stale-notice.js puts it on screen.
 */
(function () {
  'use strict';
  var SCRIPT_VERSION = '1.51.6465-stale-notice';
  if (window.__antcvAppRevGuardInstalled) return;
  window.__antcvAppRevGuardInstalled = SCRIPT_VERSION;
  try { if (localStorage.getItem('antcv:disable-app-rev-guard') === '1') return; } catch (_) {}

  var revById = Object.create(null); // appId -> updated_at last loaded/saved BY THIS TAB
  var ownRevs = Object.create(null); // appId -> { rev: 1 } revs THIS tab produced (POST/PUT responses)
  var stats = { posts: 0, selfRetries: 0, skips: 0, bootHeld: 0, bootReleased: 0, bootDropped: 0, docRetries: 0, docSkips: 0 };
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
  function writeDocRev(id, rev, fp) {
    if (id == null || rev == null || !isFinite(Number(rev))) return;
    var d = { id: String(id), rev: Number(rev), at: Date.now() };
    if (fp) d.fp = fp;
    try { localStorage.setItem(DOC_REV, JSON.stringify(d)); } catch (_) {}
  }
  // OPEN-STALE-TAB-001: fingerprint of a row's document (cv_sections + cl_sections) as the
  // relay returns it; null when the response carries neither.
  function fpOf(app) {
    if (!app || typeof app !== 'object' || !('cv_sections' in app || 'cl_sections' in app)) return null;
    var s;
    try { s = JSON.stringify([app.cv_sections == null ? null : app.cv_sections, app.cl_sections == null ? null : app.cl_sections]); } catch (_) { return null; }
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return s.length + ':' + (h >>> 0).toString(36);
  }
  // OPEN-STALE-NOTICE-001: tell the page when this tab stops saving its document and when it
  // saves again (antcv-doc-stale-notice.js shows it). Events fire on a change only.
  var stale = null; // null = saving; else { id, reason, rowRev, docRev, company }
  function setStale(info) {
    var was = !!stale;
    stale = info || null;
    if (was === !!stale) return;
    try { window.dispatchEvent(new CustomEvent(stale ? 'antcv:doc-stale' : 'antcv:doc-fresh', { detail: stale || {} })); } catch (_) {}
  }
  var seenFp = Object.create(null); // appId -> { rev, fp } of the last row response this guard read
  // A row response for the document's row: the same rev fills in the relay's fingerprint;
  // a newer rev with the same sections moves docRev forward. Different sections move nothing.
  function observeRow(id, app) {
    var fp = fpOf(app);
    if (!fp || app.updated_at == null || !isFinite(Number(app.updated_at))) return;
    var rev = Number(app.updated_at);
    seenFp[String(id)] = { rev: rev, fp: fp };
    var d = readDocRev();
    if (!d || String(d.id) !== String(id)) return;
    if (Number(d.rev) === rev) { if (d.fp !== fp) writeDocRev(id, rev, fp); return; }
    if (d.fp === fp && rev > Number(d.rev)) { writeDocRev(id, rev, fp); setStale(null); }
  }
  // A successful PUT keeps the document in sync with the row when it carried the whole
  // document, or when it was based on the rev the document had (pinned = that rev).
  function noteDocWrite(id, app, sent, pinned) {
    if (!sent || typeof sent !== 'object') return;
    var whole = Array.isArray(sent.cv_sections) && Array.isArray(sent.cl_sections) && !!sent.meta && typeof sent.meta === 'object';
    var d = readDocRev();
    var based = pinned != null || !!(d && String(d.id) === String(id) && sent.base_rev != null && Number(sent.base_rev) === Number(d.rev));
    if (whole || based) { writeDocRev(id, app.updated_at, fpOf(app)); setStale(null); }
    else observeRow(id, app);
  }
  // The rev a sections PUT must be based on: the document's, when the PUT targets its row.
  function docBase(id, body) {
    if (!body || !(Array.isArray(body.cv_sections) || Array.isArray(body.cl_sections))) return null;
    var d = readDocRev();
    return d && String(d.id) === String(id) ? Number(d.rev) : null;
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
  // app.js calls this wherever it puts a row into the editor (the row object, or a bare rev).
  // The document is then based on that rev; a 'stale' tab may save again.
  function markLoaded(id, row) {
    var rev = row && typeof row === 'object' ? row.updated_at : row;
    if (id == null || rev == null || !isFinite(Number(rev))) return;
    var fp = row && typeof row === 'object' ? fpOf(row) : null;
    var s = seenFp[String(id)];
    if (s && s.rev === Number(rev)) fp = s.fp; // the relay's own bytes for that rev
    writeDocRev(id, rev, fp);
    if (gate.state === 'stale') gate.state = 'open';
    setStale(null);
  }
  function bootCheck(id, getRow) {
    return Promise.resolve().then(getRow).then(function (res) {
      var app = res && res.application;
      var full = function (a) { return Array.isArray(a) && a.length > 0; };
      var dec = bootDecision({ chosenId: id, docRev: readDocRev(), rowRev: app && app.updated_at,
        rowEmpty: !!app && !full(app.cv_sections) && !full(app.cl_sections) });
      gate.decision = dec;
      if (!dec.load) {
        // OPEN-STALE-TAB-001: the kept local copy is based on this row now - in sync (fill in the
        // fingerprint a 1.51.6425 stamp lacks), or an empty row the local copy will fill.
        if ((dec.reason === 'in-sync' || dec.reason === 'row-empty') && app) markLoaded(id, app);
        if (gate.state === 'held') openGate();
        return { load: false, decision: dec };
      }
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
    if (id != null && row && row.updated_at != null) { markLoaded(id, row); dropGate(); return; }
    if (gate.state !== 'held') return;
    if (gate.decision && gate.decision.load) {
      // The row was to be loaded and was not: the local copy is still stale. Save nothing.
      dropGate(); gate.state = 'stale';
      try { console.warn('[app-rev-guard] BOOT-STALE-LOCAL-001: the cloud row was not loaded - this tab saves no document until it is reloaded'); } catch (_) {}
      setStale({ id: id != null ? String(id) : (readDocRev() || {}).id || '', reason: 'boot-not-loaded' });
      return;
    }
    openGate();
  }

  // OPEN-STALE-TAB-001: a sections PUT based on the document's rev met a newer row. The row's
  // sections still the document's base (an upsert or a partial write moved the rev) -> re-sent
  // once on the row's rev. Different sections -> the document changed elsewhere: skipped.
  function docConflict(input, init, id, conflictRev) {
    var d = readDocRev();
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var check, why = '', company = '';
    if (init && init.__antcvDocRetry != null) check = Promise.resolve(null);
    else if (d && d.fp && String(d.id) === String(id)) {
      check = orig.call(window, url, { method: 'GET', credentials: (init && init.credentials) || 'include', headers: init && init.headers })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (j) {
          var app = j && j.application;
          if (!app || app.updated_at == null || (app.id != null && String(app.id) !== String(id))) return null;
          remember(id, app.updated_at, false);
          observeRow(id, app);
          if (fpOf(app) === d.fp) return Number(app.updated_at);
          why = 'sections-changed'; company = String(app.jd_company || '');
          return null;
        });
    } else {
      // A stamp without a fingerprint: only a rev this tab produced (the AUTOSYNC-STALE-REV-001 rule).
      var own = conflictRev != null && ownRevs[id] && ownRevs[id][String(conflictRev)];
      if (!own) why = 'foreign-rev';
      check = Promise.resolve(own ? Number(conflictRev) : null);
    }
    return check.catch(function () { return null; }).then(function (rev) {
      if (rev != null && init && typeof init.body === 'string') {
        try {
          var b = JSON.parse(init.body);
          if (b && typeof b === 'object') {
            b.base_rev = rev;
            var init2 = Object.assign({}, init, { body: JSON.stringify(b) });
            try { Object.defineProperty(init2, '__antcvDocRetry', { value: rev, enumerable: false }); } catch (_) { init2.__antcvDocRetry = rev; }
            stats.docRetries++;
            try { console.info('[app-rev-guard] OPEN-STALE-TAB-001: application ' + id + ' moved to rev ' + rev + ' with the same sections - re-sent the PUT on that rev'); } catch (_) {}
            return inner(input, init2);
          }
        } catch (_) {}
      }
      stats.skips++; stats.docSkips++;
      try {
        console.info('[app-rev-guard] OPEN-STALE-TAB-001: SKIPPED a PUT for application ' + id + ' - its sections changed since this tab loaded them (row rev ' +
          conflictRev + ', document rev ' + (d && d.rev) + '). Reopen the application from the menu, or reload, to pick up the newer row.');
      } catch (_) {}
      // A failed check (offline) or a row that moved again mid-retry proves nothing: no notice.
      if (why) setStale({ id: String(id), reason: why, rowRev: conflictRev, docRev: d && d.rev, company: company });
      return new Response(JSON.stringify({ ok: false, skipped: 'stale_rev', updated_at: conflictRev }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    });
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
              if (app && app.id != null && app.updated_at != null) { stats.posts++; remember(String(app.id), app.updated_at, true); observeRow(String(app.id), app); }
            }).catch(function () {});
          }
        } catch (_) {}
        return res;
      });
    }

    // Inject base_rev into a PUT body: the document's rev for a sections PUT to its row
    // (OPEN-STALE-TAB-001), else this tab's last stamp for the row.
    var pinned = init && init.__antcvDocRetry != null ? init.__antcvDocRetry : null;
    if (method === 'PUT' && init && typeof init.body === 'string' && pinned == null) {
      try {
        var body = JSON.parse(init.body);
        if (body && typeof body === 'object' && body.base_rev === undefined) {
          pinned = docBase(id, body);
          var base = pinned != null ? pinned : revById[id];
          if (base != null) {
            body.base_rev = base;
            init = Object.assign({}, init, { body: JSON.stringify(body) });
          }
        }
      } catch (_) {}
    }

    return orig.call(window, input, init).then(function (res) {
      try {
        if (method === 'PUT' && res && res.status === 409) {
          return res.clone().json().catch(function () { return null; }).then(function (j) {
            if (j && j.error === 'conflict' && pinned != null) return docConflict(input, init, id, j.updated_at);
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
                noteDocWrite(id, app, sent, pinned);
              } else observeRow(id, app); // OPEN-STALE-TAB-001
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
    docRev: readDocRev, fingerprint: fpOf, markLoaded: markLoaded, bootDecision: bootDecision, bootCheck: bootCheck, bootDone: bootDone,
    gateState: gateState, docStale: function () { return stale ? Object.assign({}, stale) : null; }, bootInfo: function () { return { state: gateState(), held: gate.held.length, decision: gate.decision }; },
  };
})();
