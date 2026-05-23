/* AntCV Delete-user button fix (v1.40.250)
 * -----------------------------------------
 * The "Delete user" button in Settings → Account (rendered by app.js)
 * historically wired straight to AntcvAuth.signOut(), which only
 * clears localStorage / sessionStorage and POSTs /auth/logout. It
 * never touched the relay's KV. On next sign-in the cloudRead path
 * restored the user's personalInfo (15 fields including workHistory
 * and languages) and the onboarding wizard was skipped because
 * substantialRestoredProfile() returned true.
 *
 * This sidecar finds that button by text (and by classname patterns
 * that have appeared in different app.js versions) and rewires its
 * click handler to AntcvFullErase, the canonical destructive wipe
 * defined in index.html. We attach in the capture phase so React's
 * synthetic event for the original onClick never fires.
 *
 * The "Disagree & Delete user" button on the AI disclosure slide is
 * NOT touched here — it already routes through AntcvFullErase via
 * AntcvAiNoticeActions.deleteUser() / AntcvAiWizardSlide.deleteUser().
 */
(function(){
  'use strict';
  if (window.__antcvDeleteUserFix250Installed) return;
  window.__antcvDeleteUserFix250Installed = '1.40.251';

  var VERSION = '1.40.251';
  // Selectors and text patterns to recognise the Settings panel's
  // Delete-user button across app.js variants. We deliberately leave
  // out the AI-notice slide's button (.antcv-ai-delete) because that
  // path already runs the full erase.
  var TEXT_PATTERNS = [
    /^delete user$/i,
    /^delete account$/i,
    /^delete my (account|data|user)$/i,
    /^erase (user|account|all data|my data)$/i,
    /^delete user and (sign out|data)$/i
  ];

  function isAlreadyHandled(el){
    if (!el) return true;
    if (el.__antcvDeleteFix250) return true;
    if (el.classList && (
      el.classList.contains('antcv-ai-delete') ||      // AI disclosure slide
      el.classList.contains('antcv-ai-disagree-delete') // AI notice actions
    )) return true;
    return false;
  }

  function looksLikeButton(el){
    if (!el || el.nodeType !== 1) return false;
    var tag = (el.tagName || '').toUpperCase();
    if (tag === 'BUTTON') return true;
    var role = el.getAttribute && el.getAttribute('role');
    if (role === 'button') return true;
    if (tag === 'A' && el.getAttribute && el.getAttribute('href') === '#') return true;
    return false;
  }

  function textOf(el, max){
    var t = (el && el.textContent || '').trim();
    return max ? t.slice(0, max) : t;
  }

  function isDeleteUserButton(el){
    if (isAlreadyHandled(el)) return false;
    if (!looksLikeButton(el)) return false;
    var t = textOf(el, 60);
    if (!t) return false;
    for (var i = 0; i < TEXT_PATTERNS.length; i++) {
      if (TEXT_PATTERNS[i].test(t)) return true;
    }
    return false;
  }

  async function runFullErase(){
    // Set deletion markers so other sidecars (consent-cloud-sync) know
    // this is an erase, not a normal sign-out — they scrub their local
    // consent meta on these markers.
    try { sessionStorage.setItem('antcv:user-delete-requested', String(Date.now())); } catch(_) {}
    try { sessionStorage.setItem('antcv:ai-disclosure-declined-delete', String(Date.now())); } catch(_) {}
    // v1.40.251: explicitly scrub the local AI-notice acceptance BEFORE
    // calling AntcvFullErase. AntcvFullErase ends with localStorage.clear()
    // so this is technically redundant, but doing it first means: (a) if
    // AntcvFullErase throws halfway, the local consent is still gone;
    // and (b) the AntcvAiConsentCloudSync sidecar, which watches for the
    // delete markers above on a 1.5 s poll, sees a consistent
    // "no local consent" state immediately rather than racing with the
    // localStorage.clear inside AntcvFullErase.
    try {
      if (window.AntcvAiConsentCloudSync && typeof window.AntcvAiConsentCloudSync.scrubConsentLocal === 'function') {
        window.AntcvAiConsentCloudSync.scrubConsentLocal();
      }
    } catch(_) {}
    // Canonical destructive wipe (index.html). This handles cloud
    // DELETE + PUT-empty (with verify+retry in v1.40.250+, and AI
    // consent fields in EMPTY_STATE in v1.40.251), JWT invalidate, D1
    // cascade, local clear, cache + SW unregister, and a final reload.
    try {
      if (typeof window.AntcvFullErase === 'function') {
        await window.AntcvFullErase();
        return;
      }
    } catch(e) {
      try { console.error('[delete-user-fix] AntcvFullErase threw:', e && e.message); } catch(_) {}
    }
    // Defensive fallback — AntcvFullErase should always exist, but if
    // someone strips it from index.html in a future build, fall back to
    // signOut so the user is at least signed out. Cloud copy will not
    // be wiped in this path; the console message makes that explicit.
    try { console.warn('[delete-user-fix] window.AntcvFullErase not found — falling back to signOut. Cloud data may not be wiped.'); } catch(_) {}
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.signOut === 'function') {
        await window.AntcvAuth.signOut();
        return;
      }
    } catch(_) {}
    // Last resort: clear local + reload.
    try { localStorage.clear(); sessionStorage.clear(); location.reload(); } catch(_) {}
  }

  function patchButton(btn){
    if (!btn || btn.__antcvDeleteFix250) return;
    btn.__antcvDeleteFix250 = true;
    // Capture-phase listener so we run BEFORE React's synthetic event
    // (React listens at the root in bubble phase). stopImmediatePropagation
    // prevents any other capture-phase listener from also firing.
    btn.addEventListener('click', function(ev){
      try { ev.preventDefault(); } catch(_) {}
      try { ev.stopPropagation(); } catch(_) {}
      try { ev.stopImmediatePropagation(); } catch(_) {}
      var ok = false;
      try {
        ok = window.confirm(
          'Delete user\n\n' +
          'This permanently erases your AntCV profile, CV, cover letter, ' +
          'preferences, and API keys from BOTH this device AND the cloud. ' +
          'Signing in again will start from a clean onboarding wizard.\n\n' +
          'This cannot be undone. Continue?'
        );
      } catch(_) { ok = true; } // headless / non-window contexts shouldn't block
      if (!ok) return;
      // Give the user feedback that something is happening — the
      // verify+retry loop can take 5–20 s on a slow network.
      try {
        btn.setAttribute('data-antcv-erasing', '1');
        btn.setAttribute('disabled', 'disabled');
        btn.style.opacity = '0.6';
        btn.style.cursor = 'wait';
        // Stash original text so a future re-render or failed wipe
        // could restore it. AntcvFullErase reloads on success so this
        // is mostly a safety net.
        if (!btn.__antcvDeleteFix250OriginalText) {
          btn.__antcvDeleteFix250OriginalText = btn.textContent;
        }
        btn.textContent = 'Erasing data — please wait…';
      } catch(_) {}
      runFullErase();
    }, true);
  }

  function scan(){
    try {
      var nodes = document.querySelectorAll('button, [role="button"], a[href="#"]');
      for (var i = 0; i < nodes.length; i++) {
        if (isDeleteUserButton(nodes[i])) patchButton(nodes[i]);
      }
    } catch(_) {}
  }

  // Re-scan on DOM mutations (React re-renders) and at fixed intervals
  // covering the typical post-boot React mount delays.
  try {
    var mo = new MutationObserver(function(){ setTimeout(scan, 0); });
    mo.observe(document.documentElement || document.body, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'role']
    });
  } catch(_) {}
  [0, 100, 250, 500, 1000, 1500, 2500, 4000, 7000, 12000, 20000].forEach(function(t){
    setTimeout(scan, t);
  });
  window.addEventListener('focus', function(){ setTimeout(scan, 0); });

  window.AntcvDeleteUserFix = { version: VERSION, scan: scan };
  try { console.debug('[delete-user-fix] installed ' + VERSION); } catch(_) {}
})();
