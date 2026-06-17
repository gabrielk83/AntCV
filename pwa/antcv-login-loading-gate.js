/* AntCV login loading gate + orphan data migration (v1.50.165)
 * ===========================================================================
 * Owner idea (better than the per-package button "nudge"): right after login a
 * returning user sees the setup WIZARD flash for a few hundred ms before the
 * editor (set-menu) appears, and the palette/tone settle visibly. Instead, show
 * a "Loading…" overlay immediately and run the data corrections underneath, so
 * the first thing the user sees is the finished editor.
 *
 * What this does
 * --------------
 *   1. ORPHAN DATA MIGRATION (runs first, synchronously, BEFORE app.js reads the
 *      values): app.js's legacy default for BOTH the visual package and the
 *      writing tone is "scandinavian", which is not a valid registry id. We
 *      rewrite the writing-tone orphan toneRegister "scandinavian" ->
 *      "nordic-minimal" (the writing default). The visual package orphan
 *      (stylePackage "scandinavian") is left for antcv-package-orphan-apply.js,
 *      which must SEE the orphan to press the package button and re-derive the
 *      palette — so we do not touch stylePackage here.
 *   2. LOADING OVERLAY (returning users only): a full-screen "Loading…" cover
 *      shown from boot until the editor is ready (`.antcv-preview-paper` /
 *      `.antcv-topbar`) with a short minimum, masking the wizard flash and the
 *      palette/tone settling. New users (no wizardCompleted) are NOT masked —
 *      they should see the real wizard.
 *
 * Safety
 * ------
 *   - HARD timeout removes the overlay no matter what (never gets stuck).
 *   - Only shown for returning users (personalInfo.wizardCompleted).
 *   - Escape: localStorage['antcv:disable-loading-gate'] = '1'.
 */
(function () {
  'use strict';

  var VERSION = '1.50.589-login-settle';
  if (window.__antcvLoginLoadingGate === VERSION) return;
  window.__antcvLoginLoadingGate = VERSION;

  var DISABLE = 'antcv:disable-loading-gate';
  // owner 2026-06-17: after sign-in the cover lifted too early, so the user saw
  // the post-login SETTLE flicker — set-menu with the ant placeholder, then a
  // demo button, then the real photo + no demo button. The photo + user-mode
  // settle in the first ~2s, so hold the cover longer (bounded) to mask it.
  // A generic "DOM quiet" check is unsafe here (constant sidecar churn never
  // quiets), so this is a simple time floor + a settle signal in editorReady().
  var MIN_MS = 2200;   // hold the cover this long so the photo/mode settle is masked
  var MAX_MS = 6500;   // hard cap — always lift by here

  function lsRaw(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function disabled() { var v = lsRaw(DISABLE); return v === '1' || v === 'true'; }

  function unquote(v) {
    if (v == null) return null;
    v = String(v).trim();
    if (v.charAt(0) === '"') { try { v = JSON.parse(v); } catch (_) {} }
    return String(v).trim();
  }

  // ── 0. ACCOUNT ISOLATION (owner 2026-06-15) — runs BEFORE app.js so a second
  //      user on the same machine never loads the previous user's data into state.
  //      If the signed-in account (antcv:auth:email) differs from the last-active
  //      session, wipe everything except auth + deployment proxy URLs, then point
  //      the session at the new account. app.js then boots clean and restores the
  //      new user's own data from their cloud slot. (The app.js auth-subscribe
  //      reloads on an in-session switch, which re-enters this gate.)
  function isolateAccounts() {
    try {
      var authEmail = unquote(lsRaw('antcv:auth:email'));
      var sess = null; try { sess = JSON.parse(lsRaw('session') || 'null'); } catch (_) {}
      var sessEmail = (sess && sess.email) ? String(sess.email).trim() : '';
      if (!authEmail || !sessEmail) return;                         // nothing to compare (first login)
      if (authEmail.toLowerCase() === sessEmail.toLowerCase()) return; // same user
      var keep = {
        'antcv:auth:token': 1, 'antcv:auth:email': 1, 'antcv:auth:expires_at': 1,
        'proxyUrl': 1, 'openaiProxyUrl': 1, 'geminiProxyUrl': 1, 'antcv:disable-loading-gate': 1,
      };
      var ks = [];
      for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k) ks.push(k); }
      ks.forEach(function (k) { if (!keep[k]) { try { localStorage.removeItem(k); } catch (_) {} } });
      try { localStorage.setItem('session', JSON.stringify({ email: authEmail, ts: Date.now() })); } catch (_) {}
      try { console.info('[login-loading-gate] ACCOUNT-ISOLATION: ' + sessEmail + ' -> ' + authEmail + ' — wiped prior local data'); } catch (_) {}
    } catch (_) {}
  }
  isolateAccounts();

  // ── 1. orphan data migration (writing tone) — run immediately ──
  function migrateToneOrphan() {
    try {
      var v = unquote(lsRaw('toneRegister'));
      if (v && v.toLowerCase() === 'scandinavian') {
        localStorage.setItem('toneRegister', JSON.stringify('nordic-minimal'));
        try { console.info('[login-loading-gate] migrated orphan toneRegister "scandinavian" -> "nordic-minimal"'); } catch (_) {}
      }
    } catch (_) {}
  }
  migrateToneOrphan();

  // ── 2. loading overlay (returning users) ──
  function returningUser() {
    try {
      // owner 2026-06-17: a SIGNED-IN user is returning by definition — their data
      // restores from the cloud right after app.js boots, which is the settle we
      // want to mask. At this <head> time personalInfo may not be restored yet, so
      // requiring wizardCompleted made the gate skip the cover after a fresh
      // sign-in (the "failed conceal" — blue/flicker shown). Show for any
      // signed-in user; only a truly anonymous first-timer (no token) sees the
      // wizard uncovered.
      if (lsRaw('antcv:auth:token')) return true;
      var pi = JSON.parse(lsRaw('personalInfo') || '{}');
      return !!(pi && pi.wizardCompleted);
    } catch (_) { return false; }
  }

  function editorReady() {
    return !!(document.querySelector('.antcv-preview-paper') ||
              document.querySelector('.antcv-topbar') ||
              document.querySelector('.antcv-top-tools'));
  }

  var overlay = null;
  function showOverlay() {
    if (overlay || document.getElementById('antcv-login-loading-overlay')) return;
    var host = document.body || document.documentElement;
    if (!host) return;
    overlay = document.createElement('div');
    overlay.id = 'antcv-login-loading-overlay';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:#283556;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;' +
      'font-family:Georgia,serif;color:#cdd6e0;';
    var style = document.createElement('style');
    style.textContent = '@keyframes antcv-lg-spin{to{transform:rotate(360deg)}}';
    var spin = document.createElement('div');
    spin.style.cssText = 'width:34px;height:34px;border:3px solid rgba(1,183,187,0.25);' +
      'border-top-color:#01B7BB;border-radius:50%;animation:antcv-lg-spin .8s linear infinite;';
    var label = document.createElement('div');
    label.textContent = 'Loading…';
    label.style.cssText = 'font-size:14px;letter-spacing:.4px;opacity:.85;';
    overlay.appendChild(style); overlay.appendChild(spin); overlay.appendChild(label);
    host.appendChild(overlay);
  }
  function hideOverlay() {
    var el = overlay || document.getElementById('antcv-login-loading-overlay');
    overlay = null;
    if (!el) return;
    try {
      el.style.transition = 'opacity .25s ease';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
    } catch (_) {}
    setTimeout(function () { try { el.remove(); } catch (_) {} }, 320);
  }

  var startedAt = Date.now();
  var ticking = false;
  function poll() {
    var el = overlay || document.getElementById('antcv-login-loading-overlay');
    if (!el) { ticking = false; return; }
    var elapsed = Date.now() - startedAt;
    if ((editorReady() && elapsed >= MIN_MS) || elapsed >= MAX_MS) { hideOverlay(); ticking = false; return; }
    setTimeout(poll, 120);
  }

  function boot() {
    if (disabled()) return;
    if (!returningUser()) return;   // new user -> show the real wizard, don't mask
    showOverlay();
    if (!ticking) { ticking = true; poll(); }
  }

  // owner 2026-06-17: show the cover IMMEDIATELY. Previously boot() waited for
  // DOMContentLoaded, so between this <head> script running and the body being
  // parsed the user saw a BARE BLUE page (the body background, no spinner) — a
  // "failed conceal". showOverlay() falls back to documentElement when body is
  // missing, so the Loading screen (spinner + label) can paint right away.
  boot();
  // Re-assert once the body exists, in case the very-early append was skipped.
  if (!document.body && document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  }

  window.AntcvLoginLoadingGate = {
    version: VERSION,
    _returningUser: returningUser,
    _editorReady: editorReady,
    _show: showOverlay,
    _hide: hideOverlay,
    _migrateToneOrphan: migrateToneOrphan,
  };
})();
