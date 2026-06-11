/* AntCV — SHARE-TARGET-JD-URL-001 (v1.50.375)
 * ============================================================
 *
 * Android share sheet → AntCV → JD URL field.
 *
 * manifest.json now declares a GET share_target, so sharing a job link to
 * the installed PWA opens "./?shared_url=…&shared_text=…&shared_title=…".
 * This sidecar consumes those params on boot:
 *
 *   1. Extract the first http(s) URL from shared_url, else shared_text
 *      (Android mostly shares links inside `text`).
 *   2. Strip the share params from the address bar immediately
 *      (history.replaceState — same pattern as the reset/logout params),
 *      stashing the URL in sessionStorage with a 10-minute TTL so it
 *      survives the login redirect for signed-out users.
 *   3. Poll for the JD-URL input (the "🔗 Paste JD URL …" field). It only
 *      exists once the editor is on screen — i.e. after login — so the
 *      poll IS the "wait for auth" path; no auth API coupling needed.
 *   4. Fill it through the NATIVE value setter + an `input` event so the
 *      controlled React input actually commits the value to state, then
 *      focus + scroll it into view. The user is one tap ("Fetch JD") away.
 *
 * Read-only with respect to app state otherwise: never auto-fetches, never
 * touches window.fetch, never writes app keys. Test hook:
 * window.__antcvShareTargetJd.applied / .url.
 */
(function () {
  'use strict';

  if (window.__antcvShareTargetJdInstalled) return;
  window.__antcvShareTargetJdInstalled = '1.50.375';

  var STASH_KEY = 'antcv:sharedJdUrl:v1';
  var TTL_MS = 10 * 60 * 1000;
  var state = { url: null, applied: false };
  window.__antcvShareTargetJd = state;

  function firstHttpUrl(s) {
    if (!s || typeof s !== 'string') return null;
    var m = s.match(/https?:\/\/[^\s"'<>\])]+/i);
    if (!m) return null;
    try {
      var u = new URL(m[0]);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      // Never re-ingest our own share URL.
      if (u.origin === location.origin) return null;
      return u.href;
    } catch (_) { return null; }
  }

  function readShareParams() {
    var sp;
    try { sp = new URLSearchParams(location.search); } catch (_) { return null; }
    if (!sp.has('shared_url') && !sp.has('shared_text') && !sp.has('shared_title')) return null;
    var url = firstHttpUrl(sp.get('shared_url')) || firstHttpUrl(sp.get('shared_text'));
    // Strip the params from the address bar whether or not a URL was found,
    // so a reload doesn't re-trigger and the params don't linger in history.
    try {
      sp.delete('shared_url'); sp.delete('shared_text'); sp.delete('shared_title');
      var qs = sp.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash);
    } catch (_) {}
    return url;
  }

  function stash(url) {
    try { sessionStorage.setItem(STASH_KEY, JSON.stringify({ url: url, ts: Date.now() })); } catch (_) {}
  }
  function unstash() {
    try {
      var raw = sessionStorage.getItem(STASH_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || !o.url || (Date.now() - (o.ts || 0)) > TTL_MS) {
        sessionStorage.removeItem(STASH_KEY);
        return null;
      }
      return o.url;
    } catch (_) { return null; }
  }
  function clearStash() {
    try { sessionStorage.removeItem(STASH_KEY); } catch (_) {}
  }

  function findJdUrlInput() {
    try {
      var els = document.querySelectorAll('input[type="url"]');
      for (var i = 0; i < els.length; i++) {
        if (/paste jd url/i.test(els[i].placeholder || '')) return els[i];
      }
    } catch (_) {}
    return null;
  }

  function fillReactInput(input, value) {
    try {
      var desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
      if (desc && desc.set) desc.set.call(input, value);
      else input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (_) { return false; }
  }

  function tryApply(url) {
    var input = findJdUrlInput();
    if (!input) return false;
    if (!fillReactInput(input, url)) return false;
    try {
      input.scrollIntoView({ behavior: 'smooth', block: 'center' });
      input.focus({ preventScroll: true });
    } catch (_) {}
    state.applied = true;
    clearStash();
    try { console.log('[share-target-jd] shared job URL placed in the JD URL field:', url); } catch (_) {}
    return true;
  }

  function routeToIntake() {
    // The JD-URL field renders on the "upload" (JD intake) step only. A
    // share lands the user there with the link pre-filled — that IS the
    // feature. Written synchronously (before app.js mounts and reads
    // localStorage.step), JSON-encoded like the app's own store wrapper.
    // Sections/personalInfo persist, so no editor state is lost.
    try {
      var cur = localStorage.getItem('step');
      try { var p = JSON.parse(cur); if (typeof p === 'string') cur = p; } catch (_) {}
      if (cur !== 'upload') localStorage.setItem('step', JSON.stringify('upload'));
    } catch (_) {}
  }

  function boot() {
    var url = readShareParams() || unstash();
    if (!url) return;
    state.url = url;
    stash(url);
    // Poll until the editor (and so the JD-URL input) is on screen. Signed-out
    // users go through login first; the stash + TTL covers a full reload on
    // the way back. 800ms × 375 ≈ 5 minutes, then give up quietly (the stash
    // TTL still lets the next reload pick it up within 10 minutes).
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (state.applied || tryApply(url) || tries > 375) {
        clearInterval(timer);
        return;
      }
    }, 800);
    // First chance immediately (editor may already be up).
    tryApply(url);
  }

  // Consume the share params SYNCHRONOUSLY at script evaluation: the step
  // rewrite must land before app.js mounts and reads localStorage.step.
  var pending = readShareParams() || unstash();
  if (pending) {
    state.url = pending;
    stash(pending);
    routeToIntake();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
