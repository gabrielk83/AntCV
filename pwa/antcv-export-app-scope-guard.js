/*
 * antcv-export-app-scope-guard.js
 * EXPORT-SCOPE GUARD — register row 53, CROSS-APP-EXPORT-CONTAMINATION-001 leg (a).
 *
 * PROBLEM (see docs/qa/CROSS_APP_EXPORT_DIAGNOSIS_2026-07-13.md):
 *   The DOCX/PDF export payload is assembled from four independently-drifting sources with
 *   NO single-application identity binding —
 *     - meta.company / meta.role  -> filename (buildFilename) + header "Application:" band
 *     - sections.cv               -> CV body
 *     - sections.cl               -> CL body
 *     - styleConfig / navyColor    -> brand (GLOBAL localStorage keys, not per-app)
 *   A generation / cloud-restore race can leave these belonging to DIFFERENT applications,
 *   shipping a pair whose CV + filename + header are app A while the CL body is app B.
 *
 * WHAT THIS GUARD DOES (payload-build boundary — it wraps window.exportDocxViaWorker):
 *   Derives the authoritative application identity from the active app
 *   (AntcvJdScope.getCompany() / getCurrentAppId()) and compares it to meta.company, which
 *   is what the filename + header will carry. Then, conservatively:
 *     - match                              -> PASS THROUGH untouched (inert).
 *     - meta company reverted to Unsolicited while the active app is a real company
 *                                          -> RECONCILE meta.company forward + drop the
 *                                             filename override so it recomputes.
 *     - meta is a real company while the active pointer is still Unsolicited
 *       (targeted draft, AUTO-COMMIT not yet run) -> PASS THROUGH (meta is the real target).
 *     - two DIFFERENT real companies       -> BLOCK (cannot safely know which app the
 *                                             sections belong to) — confirm-to-abort, never
 *                                             silently ship a cross-app document.
 *
 * It is INERT when everything already agrees, when there is no authoritative identity
 * (kernel / unauthenticated / no active company), for template exports, and whenever the
 * kill-switch localStorage['antcv:disable-export-scope-guard'] is set. Any internal error
 * passes the export through unchanged — the guard can never break a legitimate export.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api; // node / tests
  if (typeof window !== 'undefined') {
    window.__antcvExportScopeGuard = api;
    api._install(window);
  }
})(this, function () {
  'use strict';

  var KILL = 'antcv:disable-export-scope-guard';

  // Companies that mean "no specific target" across the app's supported languages.
  var UNSOL_RE = /^(unsolicited|open application|no solicitado|solicitud espontanea|uopfordret|aaben ansoegning|åben ansøgning|initiativ|spontan|主动申请|自主申请)$/i;

  function isUnsol(raw) {
    var s = String(raw == null ? '' : raw).trim();
    if (!s) return true;
    return UNSOL_RE.test(s);
  }

  // Normalize a company name for comparison: lowercase, strip legal suffixes + punctuation.
  function normCompany(s) {
    if (!s) return '';
    var t = String(s).toLowerCase();
    // fold common Nordic/German accents so "Ansøgning"/"ansoegning" etc. compare equal
    t = t.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
         .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ß/g, 'ss');
    t = t.replace(/\b(a\/s|aps|amba|a\.m\.b\.a\.|as|ab|oy|oyj|gmbh|ag|ltd|limited|inc|llc|plc|co|corp|corporation|company|group|holding|services|solutions)\b/g, ' ');
    t = t.replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
    return t;
  }

  var TEMPLATE_FN_RE = /\bTemplate$/; // "CV Template" / "Cover Letter Template"

  /*
   * Pure decision core (unit-tested). Given the export args and a resolved identity context,
   * returns one of:
   *   { action:'pass',      reason }
   *   { action:'reconcile', reason, patch:{ company } }
   *   { action:'block',     reason, metaCompany, authCompany }
   */
  function decideExportScope(args, ctx) {
    args = args || {};
    ctx = ctx || {};
    var meta = args.meta || {};
    var metaCoRaw = String(meta.company == null ? '' : meta.company).trim();
    var authCoRaw = String(ctx.authCompany == null ? '' : ctx.authCompany).trim();
    var appId = String(ctx.appId == null ? '' : ctx.appId).trim();

    if (ctx.disabled) return { action: 'pass', reason: 'kill-switch' };
    if (ctx.isTemplate) return { action: 'pass', reason: 'template-export' };
    // No authoritative identity: kernel / unauthenticated / never-stamped active company.
    if (!authCoRaw || !appId || appId === 'kernel') return { action: 'pass', reason: 'no-authoritative-identity' };
    // Nothing on the filename/header axis to reconcile.
    if (!metaCoRaw) return { action: 'pass', reason: 'no-meta-company' };

    if (normCompany(metaCoRaw) === normCompany(authCoRaw)) return { action: 'pass', reason: 'match' };

    var metaUnsol = isUnsol(metaCoRaw);
    var authUnsol = isUnsol(authCoRaw);

    // meta drifted back to Unsolicited but the active app is a real company -> reconcile forward.
    if (metaUnsol && !authUnsol) {
      return { action: 'reconcile', reason: 'meta-company-reverted-to-unsolicited', patch: { company: authCoRaw } };
    }
    // meta is the real targeted draft while the active pointer is still Unsolicited
    // (AUTO-COMMIT has not stamped the app row yet) -> meta wins, pass through.
    if (!metaUnsol && authUnsol) {
      return { action: 'pass', reason: 'meta-is-real-targeted-draft' };
    }
    // Two DIFFERENT real companies -> genuine cross-app contamination. We cannot know whether
    // the sections belong to meta's app or the active app, so we refuse to ship a mixed pair.
    return { action: 'block', reason: 'cross-app-company-mismatch', metaCompany: metaCoRaw, authCompany: authCoRaw };
  }

  // Apply a reconcile decision to a COPY of args (never mutate the caller's object graph
  // beyond what is needed). Returns the args to forward to the real export fn.
  function applyReconcile(args, decision) {
    var out = args;
    out.meta = Object.assign({}, args.meta || {}, { company: decision.patch.company });
    // Force the filename to recompute from the reconciled meta (buildFilename reads it),
    // unless the caller passed a template filename (already excluded upstream).
    if (out.filename && !TEMPLATE_FN_RE.test(String(out.filename))) delete out.filename;
    return out;
  }

  // --- Browser install: intercept window.exportDocxViaWorker regardless of load order. ---
  function _install(win) {
    if (!win || win.__antcvExportScopeGuardInstalled) return;
    win.__antcvExportScopeGuardInstalled = true;

    var realFn = (typeof win.exportDocxViaWorker === 'function') ? win.exportDocxViaWorker : null;

    function isDisabled() {
      try { return !!(win.localStorage && win.localStorage.getItem(KILL)); } catch (_) { return false; }
    }

    function gatherCtx(args) {
      var authCompany = '', appId = '';
      try {
        var S = win.AntcvJdScope;
        if (S) {
          if (typeof S.getCurrentAppId === 'function') appId = S.getCurrentAppId() || '';
          if (typeof S.getCompany === 'function') authCompany = S.getCompany() || '';
        }
      } catch (_) { /* leave empty -> inert */ }
      var fn = (args && args.filename) || '';
      return { authCompany: authCompany, appId: appId, disabled: isDisabled(), isTemplate: TEMPLATE_FN_RE.test(String(fn)) };
    }

    function wrapped(args) {
      try {
        if (!isDisabled()) {
          var ctx = gatherCtx(args || {});
          var d = decideExportScope(args || {}, ctx);
          if (d.action === 'reconcile') {
            try { console.warn('[export-scope-guard] ' + d.reason + ' — reconciled filename/header company to "' + d.patch.company + '"'); } catch (_) {}
            args = applyReconcile(args || {}, d);
          } else if (d.action === 'block') {
            var msg = 'Export blocked: this file’s name/header company ("' + d.metaCompany +
              '") does not match the active application ("' + d.authCompany + '"). ' +
              'Exporting now would ship a cross-application document. ' +
              'Click Cancel to abort (recommended), or OK to export anyway.';
            var proceed = false;
            try { proceed = (typeof win.confirm === 'function') ? win.confirm(msg) : false; } catch (_) { proceed = false; }
            try { console.error('[export-scope-guard] BLOCK ' + d.reason + ' meta="' + d.metaCompany + '" active="' + d.authCompany + '" proceed=' + proceed); } catch (_) {}
            if (!proceed) return Promise.resolve({ blockedByScopeGuard: true, metaCompany: d.metaCompany, authCompany: d.authCompany });
          }
        }
      } catch (err) {
        try { console.warn('[export-scope-guard] non-fatal guard error, passing export through:', err && err.message); } catch (_) {}
      }
      return realFn.apply(this, [args].concat(Array.prototype.slice.call(arguments, 1)));
    }

    // A property interceptor captures the module assignment (index.html sets
    // window.exportDocxViaWorker after the ES-module import) no matter when this loads.
    try {
      Object.defineProperty(win, 'exportDocxViaWorker', {
        configurable: true,
        get: function () { return realFn ? wrapped : undefined; },
        set: function (v) { realFn = v; }
      });
    } catch (e) {
      // defineProperty unavailable -> best-effort direct wrap if the fn is already present.
      if (typeof realFn === 'function') { try { win.exportDocxViaWorker = wrapped; } catch (_) {} }
    }
  }

  return {
    decideExportScope: decideExportScope,
    applyReconcile: applyReconcile,
    normCompany: normCompany,
    isUnsol: isUnsol,
    _install: _install
  };
});
