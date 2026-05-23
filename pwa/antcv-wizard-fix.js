/* AntCV wizard-fix sidecar (v1.40.297)
 * ============================================================
 *
 * v1.40.297 patch over v1.40.296: adds G5, a "recent click" guard
 * that suppresses the auto-skip when the user clicked something
 * on the page within the last 2 seconds.
 *
 * Why this exists
 * ───────────────
 * v1.40.296 added G2-G4 to address the "deleted user re-login" and
 * "explicit open from Settings" scenarios. Those guards work but
 * miss one case Gabriel hit: clicking a Settings button labelled
 * something OTHER than the 7 strings in
 * antcv-onboarding.js:WIZARD_BUTTON_TEXTS (e.g. "Restart wizard"
 * which doesn't contain any of 'setup needed'/'setup'/'run wizard'/
 * 're-run wizard'/'configure'/'open wizard'/'start setup').
 *
 * When that mismatch happens, sessionStorage['antcv:wizard-explicit
 * -open'] is never set, so G3 doesn't trigger. wizard-fix then
 * fires its 30 ms Skip-click timer. Gabriel observed: "appears for
 * a short time and then skip appears. If I press quickly on next,
 * I will get the next step and skip will not appear" — exactly
 * matching a 30 ms race.
 *
 * G5 catches this case without needing to enumerate every possible
 * button label. If ANY click landed on document.body within the
 * last 2 seconds, treat the wizard's appearance as user-initiated
 * and don't auto-skip. The 2-second window is long enough to cover
 * the React render + cloud-restore delays between click and
 * wizard mount; the legitimate auto-skip case (returner flash at
 * page load) happens with no preceding click, so G5 stays inert
 * for that path.
 *
 * v1.40.296 base — original cumulative changes
 * ─────────────────────────────────────────────
 * Three additional guards on the auto-skip path so the sidecar
 * only suppresses the legitimate "wizard flashed for a fraction
 * of a second on a returning user with full data" case, not the
 * cases it was wrongly catching:
 *
 *   - Deleted user signs back in → cloud restore brings back
 *     `wizardCompleted = true` along with identity fields (name,
 *     email) but no actual content. The wizard should run from
 *     scratch. Old behaviour: auto-skipped → user got nothing.
 *
 *   - User explicitly clicks "open / re-run wizard" from Settings
 *     or the Setup-needed banner. `antcv-onboarding.js` writes
 *     `antcv:wizard-explicit-open` (sessionStorage timestamp, 5-min
 *     TTL) before triggering the wizard. Old behaviour: auto-skipped
 *     → clicked Skip → triggered "do you want to leave" confirm →
 *     OK gave a blue screen, Cancel re-ran the loop.
 *
 *   - User just deleted their data within this session.
 *     `antcv-onboarding.js` writes `antcv:just-erased` (sessionStorage
 *     timestamp, 5-min TTL) and clears `wizardCompleted`. If cloud
 *     sync races back in with stale `wizardCompleted = true`, the
 *     marker keeps the auto-skip off.
 *
 * Guards in maybeSkipWizard (in order, all early-return):
 *   G0. Legacy disable key `antcvDisableWizardSkip` (v158, unchanged).
 *   G1. New alias `antcv:disable-wizard-skip` (v296).
 *   G2. `personalInfoHasContent()` — narrow content check (v296).
 *   G3. `antcv:wizard-explicit-open` sessionStorage timestamp (v296).
 *   G4. `antcv:just-erased` sessionStorage timestamp (v296).
 *   G5. Recent document-body click within 2 seconds (v297).
 *
 * Fixes 2 (NAME-IN-PLACEHOLDER LEAK) and 3 (ZERO-COUNT WIZARD
 * UPLOAD SUMMARY) are unchanged from v1.40.158. They are unrelated
 * to the auto-skip logic and continue to be useful.
 *
 * Escape hatches (set in localStorage and reload):
 *   - antcvDisableWizardSkip       = "1" → don't auto-skip wizard
 *   - antcv:disable-wizard-skip    = "1" → same (new alias)
 *   - antcvDisablePlaceholderStrip = "1" → leave the name placeholder
 *   - antcvDisableUploadRecount    = "1" → leave the count summary
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.297';
  const NAME_IN_PLACEHOLDER = 'Gabriel Alexander Karp-Gershon';
  const GENERIC_PLACEHOLDER = 'Full name';

  // v1.40.296 — keys that mirror antcv-onboarding.js so we can read
  // the same signals it sets. Source of truth for the names is
  // antcv-onboarding.js lines 119-122.
  const WIZARD_EXPLICIT_OPEN_KEY = 'antcv:wizard-explicit-open';
  const POST_DELETE_MARKER       = 'antcv:just-erased';
  const TTL_MS = 5 * 60 * 1000;

  if (window.__antcvWizardFixInstalled) return;
  window.__antcvWizardFixInstalled = SCRIPT_VERSION;

  // ─── localStorage / sessionStorage helpers ─────────────────

  function lsBool(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return false;
      let v = raw;
      try { const p = JSON.parse(raw); v = p; }
      catch (_) {}
      return v === true || v === 'true' || v === '1' || v === 1;
    } catch (_) { return false; }
  }

  function lsObj(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const p = JSON.parse(raw);
      return (p && typeof p === 'object') ? p : null;
    } catch (_) { return null; }
  }

  // v1.40.296 — sessionStorage timestamp helper. Returns true if the
  // marker is present AND parses to a non-zero number AND is younger
  // than TTL_MS.
  function ssRecent(key) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return false;
      const ts = parseInt(raw, 10);
      if (!ts) return false;
      const age = Date.now() - ts;
      return age >= 0 && age < TTL_MS;
    } catch (_) { return false; }
  }

  // v1.40.296 — narrow content check. We deliberately do NOT include
  // identity fields (name, email, phone, location, linkedin, etc.)
  // because those routinely survive a deletion via the cloud
  // identity-restore path, and their presence does not mean the
  // user has actual CV content to keep.
  function personalInfoHasContent() {
    const pi = lsObj('personalInfo');
    if (!pi) return false;
    const CONTENT_KEYS = ['workHistory', 'experience', 'education',
      'publications', 'publicationsStructured', 'certifications', 'skills'];
    for (let i = 0; i < CONTENT_KEYS.length; i++) {
      const v = pi[CONTENT_KEYS[i]];
      if (Array.isArray(v) && v.length > 0) return true;
    }
    return false;
  }

  // v1.40.297 — G5 helper. Track the timestamp of the most recent
  // click anywhere on the document. The handler is registered in
  // capture phase so a child's click.stopPropagation() doesn't hide
  // it from us. We only need millisecond-precision recency, not
  // event details.
  let _lastClickAt = 0;
  try {
    document.addEventListener('click', function () {
      _lastClickAt = Date.now();
    }, true);
    // pointerdown too, since some touch flows fire pointer events
    // before click and we want to be permissive about what counts
    // as "user just did something".
    document.addEventListener('pointerdown', function () {
      _lastClickAt = Date.now();
    }, true);
  } catch (_) {}
  function recentClick() {
    return (Date.now() - _lastClickAt) < 2000;
  }

  // ─── Fix 1: skip wizard for returning users (with v296/v297 guards) ──

  function maybeSkipWizard() {
    // G0: legacy disable key (unchanged from v1.40.158)
    if (lsBool('antcvDisableWizardSkip')) return;
    // G1 (v1.40.296): new alias written by antcv-onboarding.js
    if (lsBool('antcv:disable-wizard-skip')) return;
    // wizardCompleted must be truthy for this whole sidecar to be
    // relevant — short-circuit if not.
    if (!lsBool('wizardCompleted')) return;

    // G2 (v1.40.296): if there's no actual CV content in personalInfo,
    // treat this as a fresh-start case regardless of what the
    // wizardCompleted flag claims. This covers the "deleted user
    // signs back in" path: cloud restored identity + completion flag
    // but nothing else, so the user genuinely needs the wizard.
    if (!personalInfoHasContent()) return;

    // G3 (v1.40.296): user explicitly asked for the wizard. Don't
    // override their choice. Marker is written by antcv-onboarding.js
    // before the wizard is opened from any "open wizard" entry point.
    if (ssRecent(WIZARD_EXPLICIT_OPEN_KEY)) return;

    // G4 (v1.40.296): user just deleted within this session.
    // The wizardCompleted flag may briefly come back from a stale
    // cloud write; the marker is the authoritative signal that the
    // user is in a fresh-start state.
    if (ssRecent(POST_DELETE_MARKER)) return;

    // G5 (v1.40.297): user just clicked something on the page in
    // the last 2 seconds. This catches the case where the user
    // opened the wizard from a Settings button whose label didn't
    // happen to match any string in antcv-onboarding.js's
    // WIZARD_BUTTON_TEXTS (so G3's explicit-open marker was never
    // set). The legitimate auto-skip case is "wizard flashes
    // during page load with no preceding user interaction", and
    // that case has _lastClickAt = 0, so recentClick() returns
    // false and skip proceeds as before.
    if (recentClick()) return;

    // ── Original Fix 1 logic from v1.40.158 below, unchanged ──

    // Find the wizard's Welcome heading by text
    const headings = document.querySelectorAll('h1');
    for (const h of headings) {
      const text = (h.textContent || '');
      if (text.indexOf('Welcome to AntCV') < 0) continue;
      // Walk up to find the modal root (first ancestor with
      // position: fixed, or the highest ancestor that's still
      // not the body)
      let cur = h;
      let root = h;
      let levels = 0;
      while (cur && cur.parentElement && cur.parentElement !== document.body && levels < 10) {
        cur = cur.parentElement;
        try {
          const cs = window.getComputedStyle(cur);
          if (cs.position === 'fixed') { root = cur; break; }
        } catch (_) {}
        root = cur;
        levels++;
      }
      if (!root) continue;
      if (root.dataset.antcvWizardAutoSkipped === '1') continue;
      // Hide the root immediately so the user never sees the flash
      root.style.setProperty('display', 'none', 'important');
      root.dataset.antcvWizardAutoSkipped = '1';
      // Click "Skip wizard" so React unmounts the wizard cleanly
      setTimeout(function () {
        const buttons = root.querySelectorAll('button');
        for (const b of buttons) {
          if ((b.textContent || '').indexOf('Skip wizard') >= 0) {
            try { b.click(); } catch (_) {}
            break;
          }
        }
      }, 30);
      return;
    }
  }

  // ─── Fix 2: strip name from placeholder (unchanged from v158) ──

  function stripPlaceholderName() {
    if (lsBool('antcvDisablePlaceholderStrip')) return;
    const inputs = document.querySelectorAll('input[placeholder]');
    inputs.forEach(function (input) {
      const ph = input.placeholder || '';
      if (ph.indexOf(NAME_IN_PLACEHOLDER) < 0) return;
      if (input.placeholder !== GENERIC_PLACEHOLDER) {
        input.placeholder = GENERIC_PLACEHOLDER;
      }
    });
  }

  // ─── Fix 3: recount wizard upload summary (unchanged from v158) ──

  const COUNT_RE = /\u2713 Found \d+ work entr(?:y|ies) [\u00B7\u2022] \d+ education [\u00B7\u2022] \d+ certifications [\u00B7\u2022] \d+ publications\./;

  function recountUploadSummary() {
    if (lsBool('antcvDisableUploadRecount')) return;
    const pi = lsObj('personalInfo');
    if (!pi) return;
    const workCount = (
      Array.isArray(pi.workHistory) ? pi.workHistory.length :
      Array.isArray(pi.experience) ? pi.experience.length : 0
    );
    const eduCount = Array.isArray(pi.education) ? pi.education.length : 0;
    const certCount = Array.isArray(pi.certifications) ? pi.certifications.length : 0;
    const pubCount = (
      Array.isArray(pi.publicationsStructured) ? pi.publicationsStructured.length :
      Array.isArray(pi.publications) ? pi.publications.length : 0
    );

    const candidates = document.querySelectorAll('div');
    candidates.forEach(function (el) {
      const t = el.textContent || '';
      if (!COUNT_RE.test(t)) return;
      const expected = '\u2713 Found ' + workCount + ' work entr' + (workCount === 1 ? 'y' : 'ies') +
        ' \u00B7 ' + eduCount + ' education \u00B7 ' + certCount + ' certifications \u00B7 ' + pubCount + ' publications.';
      if (t.indexOf(expected) >= 0) return;
      if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) {
        const newText = el.textContent.replace(COUNT_RE, expected);
        if (newText !== el.textContent) {
          el.textContent = newText;
        }
      } else {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
          if (COUNT_RE.test(node.nodeValue || '')) {
            node.nodeValue = node.nodeValue.replace(COUNT_RE, expected);
            break;
          }
        }
      }
    });
  }

  // ─── Tick + observers (unchanged) ──────────────────────────

  function tick() {
    try {
      maybeSkipWizard();
      stripPlaceholderName();
      recountUploadSummary();
    } catch (_) {}
  }

  [0, 100, 300, 800, 1500, 3000].forEach(function (d) {
    if (d === 0) tick();
    else setTimeout(tick, d);
  });

  try {
    const mo = new MutationObserver(function () { tick(); });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder'],
    });
  } catch (_) {}

  setInterval(tick, 2000);

  // Test/debug API
  window.AntcvWizardFix = {
    version: SCRIPT_VERSION,
    _maybeSkipWizard: maybeSkipWizard,
    _stripPlaceholderName: stripPlaceholderName,
    _recountUploadSummary: recountUploadSummary,
    _tick: tick,
    _lsBool: lsBool,
    // v1.40.296: expose the new guards for debugging
    _ssRecent: ssRecent,
    _personalInfoHasContent: personalInfoHasContent,
    _explicitOpenActive: function () { return ssRecent(WIZARD_EXPLICIT_OPEN_KEY); },
    _postDeleteActive: function () { return ssRecent(POST_DELETE_MARKER); },
    // v1.40.297: recent-click guard
    _recentClick: recentClick,
    _resetLastClickAt: function () { _lastClickAt = 0; },
    NAME_IN_PLACEHOLDER: NAME_IN_PLACEHOLDER,
    GENERIC_PLACEHOLDER: GENERIC_PLACEHOLDER,
  };
})();
