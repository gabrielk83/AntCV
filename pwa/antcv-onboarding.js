/* AntCV onboarding (v1.40.260)
 * ===================================================================
 * Merged sidecar replacing eight predecessors:
 *   - antcv-wizard-fix.js                       (v1.40.158)
 *   - antcv-wizard-formats-explainer.js         (v1.40.167)
 *   - antcv-wizard-section-format-step10.js     (v1.40.226)
 *   - antcv-ai-wizard-slide.js                  (v1.40.229)
 *   - antcv-ai-notice-rescue-229.js             (v1.40.229)
 *   - antcv-skip-wizard-confirm-suppressor-252.js (v1.40.252)
 *   - antcv-ai-notice-gate-253.js               (v1.40.253–256)
 *   - antcv-post-delete-flow-255.js             (v1.40.257)
 *
 * Goals of the merge
 * ------------------
 *   - One MutationObserver, one tick loop, one shared utility layer.
 *   - One centralised consent helper (replaces the dead
 *     antcv-ai-disclosure-cloud.js, which is in the zip but not
 *     loaded by index.html). Cloud WRITE is still done by the
 *     loaded antcv-ai-consent-cloud-sync-224.js — it listens on
 *     `antcv:ai-disclosure-accepted` events and storage changes,
 *     so we just fire those and stay out of its way. Cloud READ on
 *     login is satisfied indirectly: app.js's cloud-restore
 *     repopulates `personalInfo` (which includes the embedded
 *     aiDisclosure flag and wizardCompleted flag).
 *
 * State machine (per user spec, 2026-05-20)
 * -----------------------------------------
 *   On login, four cases:
 *     1. wizardCompleted && aiAccepted
 *          → skip wizard, no notice.
 *     2. wizardCompleted && !aiAccepted
 *          → skip wizard, show AI notice as fixed overlay,
 *            then go to main editor.
 *     3. !wizardCompleted && aiAccepted
 *          → wizard runs normally; AI notice slide appears at its
 *            natural step (after relay-path), pre-ticked. User
 *            can untick (greys out Continue) and re-tick.
 *     4. !wizardCompleted && !aiAccepted
 *          → wizard runs normally; AI notice slide appears
 *            unticked; Continue is greyed until ticked.
 *
 *   Skip button during wizard:
 *     - aiAccepted   → close wizard, no notice.
 *     - !aiAccepted  → show AI notice as fixed overlay.
 *
 *   Settings → re-run wizard:
 *     - Treated as case 3 (wizard runs, slide pre-ticked).
 *     - We detect "explicit re-open" via a click capture on any
 *       button whose label matches "re-run wizard / run wizard /
 *       open wizard / setup wizard / re-open wizard". Click sets
 *       `antcv:wizard-explicit-open` with a 5-minute TTL; while
 *       that flag is hot, the returner auto-skip is suppressed.
 *
 *   Cloud sync:
 *     - markAiAccepted writes local AND fires the standard
 *       `antcv:ai-disclosure-accepted` event. The still-loaded
 *       antcv-ai-consent-cloud-sync-224.js picks that up and
 *       mirrors to /api/prefs.
 *     - If cloud unreachable: local-only; the sync sidecar retries
 *       on storage/focus/poll.
 *     - On delete user: AntcvFullErase + relay DELETE wipe both.
 *     - On hard reset / cookie wipe: app.js cloud-restore pulls
 *       personalInfo back, which carries the embedded consent.
 *
 *   Slide UI:
 *     - Pre-ticked if `aiAccepted()` is true when the slide builds.
 *     - Untick greys Continue (existing change handler).
 *     - Continue → mark accepted (idempotent if already), fire
 *       event for cloud sync, remove slide, advance wizard if
 *       still on the relay step (covers the broken-app.js path
 *       where its own AI-notice render crashed without advancing).
 *
 * Blue-screen / wizard-stuck recovery (carried over)
 * --------------------------------------------------
 *   - window.error + unhandledrejection during the consent window
 *     dismiss any non-wizard-text large opaque overlay and force
 *     mount the slide.
 *   - When the relay-path step has been visible (`seenRelayStep`),
 *     the gate-fired marker is set proactively so subsequent
 *     crashes are recognised.
 *   - If the wizard fails to advance past the relay step within
 *     ~1.5s after the user committed the URL, we dismiss any
 *     overlay and mount the slide on the existing host (or a
 *     fixed overlay if no host remains).
 *
 * Compatibility
 * -------------
 *   We re-publish the old global namespaces (AntcvAiNoticeGate253,
 *   AntcvAiWizardSlide, AntcvPostDeleteFlow,
 *   AntcvSkipWizardConfirmSuppressor, AntcvFormatsExplainer,
 *   AntcvWizardFix) as thin shims so any debugging scripts or
 *   external references keep working.
 */
(function () {
  'use strict';

  if (window.__antcvOnboardingInstalled) return;
  window.__antcvOnboardingInstalled = '1.40.266';
  var VERSION = '1.40.266';

  // ────────────────────────────────────────────────────────────────
  // 1. Constants
  // ────────────────────────────────────────────────────────────────
  var SLIDE_CLASS = 'antcv-ai-wizard-slide';
  var FIXED_HOST_CLASS = 'antcv-ai-fixed-host';
  var POLL_MS = 400;
  var CRASH_WINDOW_MS = 8000;

  // Persistence keys (consent)
  var LS_AI_ACCEPTED = 'aiDisclosureAccepted';
  var LS_AI_META = 'aiDisclosureAcceptedMeta';

  // Persistence keys (wizard)
  var WIZARD_COMPLETED_KEYS = ['wizardCompleted', 'antcv:wizardCompleted'];

  // Markers
  var GATE_FIRED_KEY = 'antcv:onboarding:slide-shown-at';
  var WIZARD_SKIPPED_KEY = 'antcv:wizardSkipped';
  var WIZARD_EXPLICIT_OPEN_KEY = 'antcv:wizard-explicit-open';
  var WIZARD_EXPLICIT_OPEN_TTL_MS = 5 * 60 * 1000;
  var POST_DELETE_MARKER = 'antcv:just-erased';
  var POST_DELETE_TTL_MS = 5 * 60 * 1000;
  var DISABLE_WIZARD_SKIP_KEY = 'antcv:disable-wizard-skip';
  var DISABLE_PLACEHOLDER_STRIP_KEY = 'antcvDisablePlaceholderStrip';
  var DISABLE_UPLOAD_RECOUNT_KEY = 'antcvDisableUploadRecount';
  var FORMATS_EXPLAINER_SEEN_KEY = 'antcv:wizard:formats-explainer-opened';

  var RELAY_KEYS = ['proxyUrl', 'relayUrl'];
  var TOKEN_KEY = 'antcv:auth:token';
  var EMAIL_KEY = 'antcv:auth:email';

  var WIZARD_BUTTON_TEXTS = [
    'setup needed', 'setup', 'run wizard', 're-run wizard',
    'configure', 'open wizard', 'start setup'
  ];

  var WARNING_NEEDLE_LOWER = 'cloud returned no saved profile';
  var CONSOLE_NEEDLES = [
    'cloud has prefs but no personalinfo',
    'cloud returned no saved profile',
    'personalinfo not restored'
  ];

  var NAME_IN_PLACEHOLDER = 'Gabriel Alexander Karp-Gershon';
  var GENERIC_PLACEHOLDER = 'Full name';

  // ────────────────────────────────────────────────────────────────
  // 2. Small utilities
  // ────────────────────────────────────────────────────────────────
  function nowIso() { return new Date().toISOString(); }

  function lsGet(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function lsRemove(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (_) {} }
  function lsJSON(k) {
    try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; }
    catch (_) { return null; }
  }
  function strip(v) {
    if (!v) return '';
    if (typeof v === 'string' && v.charAt(0) === '"') {
      try { v = JSON.parse(v); } catch (_) {}
    }
    return String(v || '').trim();
  }

  function log(tag, msg) {
    try { console.debug('[antcv-onboarding]', tag, msg); } catch (_) {}
    try {
      if (window.AntcvDiag && window.AntcvDiag.push) {
        window.AntcvDiag.push('onboarding.' + tag, String(msg || ''));
      }
    } catch (_) {}
  }

  function isVisible(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity || '1') < 0.1) return false;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
      if (r.right < 0 || r.bottom < 0) return false;
      if (r.left > (window.innerWidth || 9999) || r.top > (window.innerHeight || 9999)) return false;
      return true;
    } catch (_) { return false; }
  }

  function txtOf(el, max) {
    var t = (el && el.textContent || '').replace(/\s+/g, ' ').trim();
    return max ? t.slice(0, max) : t;
  }

  function acceptedValue(v) {
    if (v === true) return true;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      var s = v.trim().toLowerCase();
      return !!s && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined' && s !== 'no';
    }
    if (v && typeof v === 'object') {
      if ('accepted' in v) return acceptedValue(v.accepted);
      if ('value' in v) return acceptedValue(v.value);
      if ('at' in v || 'acceptedAt' in v || 'timestamp' in v) return true;
    }
    return false;
  }

  // ────────────────────────────────────────────────────────────────
  // 3. Consent state
  // ────────────────────────────────────────────────────────────────
  function relayPath() {
    for (var i = 0; i < RELAY_KEYS.length; i++) {
      var v = strip(lsGet(RELAY_KEYS[i]));
      if (v) return v.replace(/\/+$/, '');
    }
    if (typeof window.ANTCV_RELAY_URL === 'string') {
      return String(window.ANTCV_RELAY_URL || '').replace(/\/+$/, '');
    }
    return '';
  }
  function token() { return lsGet(TOKEN_KEY); }
  function email() { return lsGet(EMAIL_KEY); }

  function aiAccepted() {
    // Top-level keys (any acceptedValue counts)
    if (acceptedValue(lsGet(LS_AI_ACCEPTED))) return true;
    if (acceptedValue(lsGet('antcv:aiDisclosureAccepted'))) return true;
    if (acceptedValue(lsGet('euAiDisclosureAccepted'))) return true;
    // Meta
    try {
      var meta = JSON.parse(lsGet(LS_AI_META) || 'null');
      if (acceptedValue(meta)) return true;
    } catch (_) {}
    // Inside personalInfo (this is what cloud-restore repopulates)
    try {
      var pi = JSON.parse(lsGet('personalInfo') || '{}') || {};
      if (acceptedValue(pi.aiDisclosureAccepted)) return true;
      if (acceptedValue(pi.aiDisclosure)) return true;
      if (acceptedValue(pi.disclosureAccepted)) return true;
    } catch (_) {}
    return false;
  }

  function markAiAccepted(source) {
    var at = nowIso();
    lsSet(LS_AI_ACCEPTED, at);
    lsSet('antcv:aiDisclosureAccepted', at);
    try {
      lsSet(LS_AI_META, JSON.stringify({
        accepted: true, acceptedAt: at,
        source: source || 'onboarding', email: email() || ''
      }));
    } catch (_) {}
    try {
      var pi = JSON.parse(lsGet('personalInfo') || '{}') || {};
      pi.aiDisclosureAccepted = at;
      pi.aiDisclosure = true;
      pi.disclosureAccepted = true;
      lsSet('personalInfo', JSON.stringify(pi));
    } catch (_) {}
    // Notify the still-loaded antcv-ai-consent-cloud-sync-224.js,
    // which writes to /api/prefs when relay+token are available.
    try {
      window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-accepted', {
        detail: { source: source || 'onboarding', at: at }
      }));
    } catch (_) {}
    try {
      window.dispatchEvent(new StorageEvent('storage', { key: LS_AI_ACCEPTED, newValue: at }));
    } catch (_) {}
  }

  // ────────────────────────────────────────────────────────────────
  // 4. Wizard state
  // ────────────────────────────────────────────────────────────────
  function wizardCompleted() {
    for (var i = 0; i < WIZARD_COMPLETED_KEYS.length; i++) {
      if (acceptedValue(lsGet(WIZARD_COMPLETED_KEYS[i]))) return true;
    }
    try {
      var pi = JSON.parse(lsGet('personalInfo') || '{}') || {};
      if (acceptedValue(pi.wizardCompleted) || acceptedValue(pi.onboardingCompleted)) return true;
      if (pi.meta && acceptedValue(pi.meta.wizardCompleted)) return true;
    } catch (_) {}
    return false;
  }

  function wizardWasExplicitlySkipped() {
    var keys = [WIZARD_SKIPPED_KEY, 'wizardSkipped',
                'antcv:onboarding:skipped', 'antcv:wizard:skipped'];
    for (var i = 0; i < keys.length; i++) {
      if (acceptedValue(lsGet(keys[i])) || acceptedValue(ssGet(keys[i]))) return true;
    }
    return false;
  }

  function explicitOpenActive() {
    var raw = ssGet(WIZARD_EXPLICIT_OPEN_KEY);
    if (!raw) return false;
    var ts = parseInt(raw, 10);
    if (!ts) return false;
    return (Date.now() - ts) < WIZARD_EXPLICIT_OPEN_TTL_MS;
  }
  function setExplicitOpen() {
    ssSet(WIZARD_EXPLICIT_OPEN_KEY, String(Date.now()));
    log('explicit-open.set', '');
  }
  function clearExplicitOpen() {
    try { sessionStorage.removeItem(WIZARD_EXPLICIT_OPEN_KEY); } catch (_) {}
  }

  function isWizardSurface(n) {
    if (!n || n.nodeType !== 1) return false;
    if (n.getAttribute) {
      if (n.getAttribute('data-antcv-modal') === 'wizard') return true;
      if (n.getAttribute('data-antcv-wizard') !== null) return true;
    }
    var s = txtOf(n, 2400);
    return /(wizard|setup|getting\s+started|welcome|tell\s+antcv|worker|relay|cloud|provider|next|skip|continue)/i.test(s);
  }

  // v264: locate the visible "STEP N" leaf element. The AntCV wizard
  // doesn't decorate its container with role="dialog", "wizard",
  // "setup", or anything else our selector list looks for — so we
  // can't recognise it that way. The STEP indicator is the most
  // reliable visible anchor.
  function findVisibleStepNumberElement() {
    try {
      var nodes = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, div, b, strong, em');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.children && n.children.length > 0) continue;
        var t = String(n.textContent || '').trim();
        if (!t || t.length > 30) continue;
        var m = /^(?:STEP|Step|step)\s+(\d+)(?:\s+of\s+\d+)?$/.exec(t);
        if (m && isVisible(n)) return n;
      }
    } catch (_) {}
    return null;
  }

  function wizardActive() {
    // v264: most direct, most reliable signal — if "STEP N" is
    // visible anywhere on the page, the wizard is open. Step
    // transitions log fine, which means this signal is solid even
    // when the wizard container itself doesn't match any wizard-shaped
    // selector. Fall back to the selector-based detection for the
    // completion screen ("You're ready!") which has no STEP indicator.
    if (findVisibleStepNumberElement()) return true;
    try {
      var nodes = document.querySelectorAll(
        '[role="dialog"],[role="alertdialog"],[data-antcv-wizard],[data-antcv-modal="wizard"],[class*="wizard" i],[class*="setup" i]'
      );
      for (var i = 0; i < nodes.length; i++) {
        if (!isVisible(nodes[i])) continue;
        if (nodes[i].classList && nodes[i].classList.contains(SLIDE_CLASS)) continue;
        if (isWizardSurface(nodes[i])) return true;
      }
    } catch (_) {}
    return false;
  }

  function findWizardHost() {
    var best = null;
    try {
      var nodes = document.querySelectorAll(
        '[role="dialog"],[role="alertdialog"],[data-antcv-wizard],[data-antcv-modal="wizard"],[class*="wizard" i],[class*="setup" i]'
      );
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!isVisible(n)) continue;
        if (n.classList && n.classList.contains(SLIDE_CLASS)) continue;
        var r = n.getBoundingClientRect();
        if (r.width < 220 || r.height < 220) continue;
        if (!isWizardSurface(n)) continue;
        if (!best || (r.width * r.height) < best._area) {
          best = n;
          best._area = r.width * r.height;
        }
      }
    } catch (_) {}
    if (best) return best;

    // v264: no element matched the wizard-shaped selectors. Walk up
    // from the visible "STEP N" indicator to find a reasonably
    // sized container. Prefer the smallest ancestor that contains a
    // Next / Continue / Skip / Test / Back button (those are the
    // wizard's own footer buttons). If none has one, fall back to
    // the largest ancestor that's at least 320 × 280.
    try {
      var stepNode = findVisibleStepNumberElement();
      if (!stepNode) return null;
      var p = stepNode.parentElement;
      var fallback = null;
      var FOOTER_RE = /^(next|continue|done|skip|test|back|use\s+this|save|configure)/i;
      while (p && p !== document.body && p !== document.documentElement) {
        if (isVisible(p)) {
          var rect = p.getBoundingClientRect();
          if (rect.width >= 320 && rect.height >= 280) {
            if (!fallback || (rect.width * rect.height) < (fallback._area || Infinity)) {
              fallback = p;
              fallback._area = rect.width * rect.height;
            }
            // Prefer the smallest container that includes a footer
            // button. Once we find one, return it immediately.
            var btns = p.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
            for (var j = 0; j < btns.length; j++) {
              var b = btns[j];
              if (!isVisible(b)) continue;
              var bt = String(b.textContent || b.value || '').trim();
              if (FOOTER_RE.test(bt)) {
                return p;
              }
            }
          }
        }
        p = p.parentElement;
      }
      return fallback;
    } catch (_) {}
    return null;
  }

  function isRelayStepHost(host) {
    if (!host || host.nodeType !== 1) return false;
    try {
      var inputs = host.querySelectorAll('input[type="url"], input[type="text"], input');
      var hasVisibleUrlInput = false;
      for (var i = 0; i < inputs.length; i++) {
        var n = inputs[i];
        if (!isVisible(n)) continue;
        var ph = String(n.placeholder || '');
        var nm = String(n.name || '');
        var aria = String((n.getAttribute && n.getAttribute('aria-label')) || '');
        var blob = (ph + ' ' + nm + ' ' + aria + ' ' + (n.value || '')).toLowerCase();
        if (/(worker|relay|proxy|cloudflare|https?:|\.workers\.dev|endpoint)/.test(blob) ||
            (/url/.test(blob) && /https?:/.test(blob + ' ' + (n.value || '')))) {
          hasVisibleUrlInput = true; break;
        }
      }
      if (!hasVisibleUrlInput) return false;
      var btns = host.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
      for (var j = 0; j < btns.length; j++) {
        var b = btns[j];
        if (!isVisible(b)) continue;
        var bt = ((b.textContent || b.value || '') + '').toLowerCase();
        if (/(save|next|continue|done|configure|use this)/.test(bt)) return true;
      }
    } catch (_) {}
    return false;
  }

  function isProviderStepHost(host) {
    if (!host || host.nodeType !== 1) return false;
    var s = txtOf(host, 3200);
    if (/Section\s+formats\s*[—-]|Found\s+\d+\s+work\s+entries|work\s+history|education|certifications|publications/i.test(s)) return false;
    var hasProviderName = /(Anthropic|OpenAI|Mistral|Google|Gemini|Claude|GPT)/.test(s);
    var hasChoiceWords = /(select|choose|pick|provider|model|LLM|large\s+language\s+model)/i.test(s);
    if (!hasProviderName || !hasChoiceWords) return false;
    try {
      var controls = host.querySelectorAll('button,[role="button"],select,option,label,input');
      for (var i = 0; i < controls.length; i++) {
        var c = controls[i];
        var t = txtOf(c, 180) + ' ' + String(c.value || '');
        if (/(Anthropic|OpenAI|Mistral|Google|Gemini|Claude|GPT)/i.test(t)) return true;
      }
    } catch (_) {}
    return false;
  }

  function findNextLikeButton(host) {
    if (!host) return null;
    try {
      var btns = host.querySelectorAll('button, [role="button"], input[type="submit"], input[type="button"]');
      for (var j = 0; j < btns.length; j++) {
        var b = btns[j];
        if (!isVisible(b)) continue;
        if (b.disabled) continue;
        var bt = ((b.textContent || b.value || '') + '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (/^\s*(next|continue|done|save|use this)\b/.test(bt) || bt === 'next' || bt === 'continue') {
          return b;
        }
      }
    } catch (_) {}
    return null;
  }

  function findSkipButton(host) {
    if (!host) return null;
    try {
      var btns = host.querySelectorAll('button, [role="button"], a');
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!isVisible(b)) continue;
        var t = (b.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (/^skip(\s|$)/.test(t) || /skip\s+(setup|wizard|onboarding)/.test(t)) return b;
      }
    } catch (_) {}
    return null;
  }

  function markWizardSkipped(source) {
    lsSet(WIZARD_SKIPPED_KEY, String(Date.now()));
    log('wizard.skipped', source || '');
  }

  // ────────────────────────────────────────────────────────────────
  // 5. AI notice slide (UI)
  // ────────────────────────────────────────────────────────────────
  function injectSlideStyles() {
    if (document.getElementById('antcv-ai-wizard-slide-style')) return;
    var st = document.createElement('style');
    st.id = 'antcv-ai-wizard-slide-style';
    st.textContent =
      '.' + SLIDE_CLASS + '{position:absolute;inset:0;z-index:2147483000;box-sizing:border-box;padding:28px;background:#263758;color:#f4f7ff;border-radius:14px;overflow:auto;pointer-events:auto;touch-action:auto;font-family:inherit;}\n' +
      '.' + SLIDE_CLASS + ' *{box-sizing:border-box;pointer-events:auto;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#03d7e8;font-weight:700;margin-bottom:14px;}\n' +
      '.' + SLIDE_CLASS + ' h2{margin:0 0 18px 0;font-size:24px;line-height:1.2;color:#fff;}\n' +
      '.' + SLIDE_CLASS + ' p{margin:0 0 14px 0;line-height:1.55;font-size:14px;color:#eef3ff;}\n' +
      '.' + SLIDE_CLASS + ' label{display:flex;gap:12px;align-items:center;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);border-radius:10px;padding:14px 16px;margin:20px 0 16px 0;font-weight:700;color:#fff;}\n' +
      '.' + SLIDE_CLASS + ' input[type="checkbox"]{width:18px;height:18px;flex:0 0 auto;accent-color:#04c8d8;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-actions{display:grid;grid-template-columns:1fr;gap:10px;margin-top:8px;}\n' +
      '.' + SLIDE_CLASS + ' button{min-height:46px;border-radius:10px;border:1px solid rgba(255,255,255,.22);padding:10px 14px;font-weight:700;cursor:pointer;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-continue{background:#0b7d88;color:#fff;border-color:#0b7d88;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-continue:disabled{opacity:.45;cursor:not-allowed;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-disagree{background:transparent;color:#fff;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-delete{background:transparent;color:#fff;border-color:#ff6b78;}\n' +
      '.' + SLIDE_CLASS + ' .antcv-ai-foot{margin-top:18px;text-align:center;font-size:12px;color:rgba(255,255,255,.55);}\n' +
      '.' + FIXED_HOST_CLASS + '{position:fixed;inset:0;z-index:2147482999;background:rgba(3,10,24,.72);padding:16px;display:flex;align-items:center;justify-content:center;pointer-events:auto;}\n' +
      '.' + FIXED_HOST_CLASS + ' .' + SLIDE_CLASS + '{position:relative;inset:auto;width:min(680px,100%);max-height:min(760px,92vh);box-shadow:0 18px 60px rgba(0,0,0,.35);}\n' +
      '@media (min-width:640px){.' + SLIDE_CLASS + ' .antcv-ai-actions{grid-template-columns:1fr auto auto;align-items:center}.' + SLIDE_CLASS + ' .antcv-ai-continue{min-width:180px}}\n';
    document.head.appendChild(st);
  }

  function signOutOnly() {
    try { sessionStorage.setItem('antcv:ai-disclosure-declined', String(Date.now())); } catch (_) {}
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.signOut === 'function') {
        window.AntcvAuth.signOut();
        return;
      }
    } catch (_) {}
    try {
      lsRemove(LS_AI_ACCEPTED);
      lsRemove('antcv:aiDisclosureAccepted');
      lsRemove(LS_AI_META);
    } catch (_) {}
    try { location.reload(); } catch (_) {}
  }

  function deleteUserFully() {
    try { sessionStorage.setItem('antcv:ai-disclosure-declined-delete', String(Date.now())); } catch (_) {}
    try {
      if (typeof window.AntcvFullErase === 'function') { window.AntcvFullErase(); return; }
    } catch (_) {}
    try {
      if (window.AntcvAuth && typeof window.AntcvAuth.signOut === 'function') {
        window.AntcvAuth.signOut();
        return;
      }
    } catch (_) {}
    try { localStorage.clear(); sessionStorage.clear(); location.reload(); } catch (_) {}
  }

  function buildSlide() {
    var slide = document.createElement('section');
    slide.className = SLIDE_CLASS;
    slide.setAttribute('role', 'group');
    slide.setAttribute('aria-label', 'AntCV generative AI notice');
    slide.setAttribute('data-antcv-onboarding-slide', '1');
    slide.innerHTML =
      '<div class="antcv-ai-kicker">Before provider selection</div>' +
      '<h2>AntCV uses generative AI</h2>' +
      '<p>AntCV calls third-party large language models (Anthropic, OpenAI, Mistral, Google) to draft and adapt your CV and cover letter content. The text you submit is sent to the provider you select.</p>' +
      '<p>AI-generated output can be wrong or biased. You remain the author of every document AntCV produces. Review everything before sending it to an employer.</p>' +
      '<p>AntCV is intended for individual job seekers drafting their own application materials. It is not a recruitment, screening, or candidate-evaluation tool.</p>' +
      '<label><input type="checkbox" class="antcv-ai-check"> <span>I understand and accept these terms.</span></label>' +
      '<div class="antcv-ai-actions">' +
        '<button type="button" class="antcv-ai-continue" disabled>Continue</button>' +
        '<button type="button" class="antcv-ai-disagree">Disagree</button>' +
        '<button type="button" class="antcv-ai-delete">Disagree &amp; Delete user</button>' +
      '</div>' +
      '<div class="antcv-ai-foot">EU AI Act Article 50(1) disclosure. Acknowledgement recorded locally with a timestamp.</div>';

    var check = slide.querySelector('.antcv-ai-check');
    var cont  = slide.querySelector('.antcv-ai-continue');

    // v264: centralised state sync. Setting `.disabled = false` on a
    // detached element doesn't always cause the browser to drop the
    // HTML `disabled` attribute, which leaves the :disabled
    // pseudo-class matching and the button looking greyed even after
    // the IDL property is false. Toggling both the property AND the
    // attribute keeps them in lockstep regardless of how the slide
    // was constructed or where in its lifecycle this runs.
    function syncContinueState() {
      var on = !!check.checked;
      try {
        cont.disabled = !on;
        if (on) cont.removeAttribute('disabled');
        else cont.setAttribute('disabled', 'disabled');
      } catch (_) {}
    }

    // Pre-tick when consent was already given (returner, settings re-run,
    // or cloud-restore happened). User can untick → greys Continue → must
    // re-tick to proceed. Continue records (re-records) consent on click,
    // which is idempotent.
    if (aiAccepted()) {
      try { check.checked = true; } catch (_) {}
    }
    syncContinueState();

    check.addEventListener('change', syncContinueState, true);

    cont.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      if (!check.checked) return;
      markAiAccepted('slide-continue');
      try {
        var fixed = slide.closest('.' + FIXED_HOST_CLASS);
        if (fixed) fixed.remove();
        else slide.remove();
      } catch (_) {
        try { slide.style.display = 'none'; } catch (__) {}
      }
      // Advance the wizard if it stayed on the relay step (i.e. app.js's
      // own AI-notice render crashed before advancing — we mounted over
      // the broken step rather than the next one).
      setTimeout(function () {
        try {
          var host = findWizardHost();
          if (host && isRelayStepHost(host)) {
            var btn = findNextLikeButton(host);
            if (btn) {
              log('post-consent.advance', 'wizard stuck on relay step — clicking Next');
              try { btn.click(); } catch (_) {}
            }
          }
        } catch (_) {}
      }, 80);
    }, true);

    slide.querySelector('.antcv-ai-disagree').addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation(); signOutOnly();
    }, true);
    slide.querySelector('.antcv-ai-delete').addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation(); deleteUserFully();
    }, true);

    return slide;
  }

  function slideAlreadyMounted() {
    try { return !!document.querySelector('.' + SLIDE_CLASS); } catch (_) { return false; }
  }

  function mountInWizard(host) {
    if (!host) return false;
    if (host.querySelector('.' + SLIDE_CLASS)) return true;
    if (slideAlreadyMounted()) return true;
    injectSlideStyles();
    try {
      var cs = getComputedStyle(host);
      if (cs.position === 'static') host.style.position = 'relative';
    } catch (_) {}
    var slide = buildSlide();
    try { host.insertBefore(slide, host.firstChild); }
    catch (_) {
      try { host.appendChild(slide); }
      catch (__) { return false; }
    }
    // v264: re-sync the pre-tick state AFTER the slide is in the live
    // document tree. Some browsers don't fully apply disabled-attribute
    // changes on detached nodes until reflow.
    try {
      if (aiAccepted()) {
        var ck = slide.querySelector('.antcv-ai-check');
        var bt = slide.querySelector('.antcv-ai-continue');
        if (ck && bt) {
          ck.checked = true;
          bt.disabled = false;
          bt.removeAttribute('disabled');
        }
      }
    } catch (_) {}
    try { slide.querySelector('.antcv-ai-check').focus({ preventScroll: true }); } catch (_) {}
    ssSet(GATE_FIRED_KEY, String(Date.now()));
    log('slide.mount.wizard', '');
    return true;
  }

  function mountFixedOverlay() {
    if (slideAlreadyMounted()) return true;
    if (document.querySelector('.' + FIXED_HOST_CLASS + '[data-antcv-onboarding-overlay="1"]')) return true;
    injectSlideStyles();
    var host = document.createElement('div');
    host.className = FIXED_HOST_CLASS;
    host.setAttribute('data-antcv-onboarding-overlay', '1');
    var slide = buildSlide();
    host.appendChild(slide);
    try { document.body.appendChild(host); } catch (_) { return false; }
    // v264: same post-mount state sync as mountInWizard.
    try {
      if (aiAccepted()) {
        var ck = slide.querySelector('.antcv-ai-check');
        var bt = slide.querySelector('.antcv-ai-continue');
        if (ck && bt) {
          ck.checked = true;
          bt.disabled = false;
          bt.removeAttribute('disabled');
        }
      }
    } catch (_) {}
    try { slide.querySelector('.antcv-ai-check').focus({ preventScroll: true }); } catch (_) {}
    ssSet(GATE_FIRED_KEY, String(Date.now()));
    log('slide.mount.fixed', '');
    return true;
  }

  function dismissSlideIfMounted() {
    try {
      var ns = document.querySelectorAll('.' + SLIDE_CLASS);
      for (var i = 0; i < ns.length; i++) {
        var s = ns[i];
        var fixed = s.closest('.' + FIXED_HOST_CLASS);
        if (fixed) { try { fixed.remove(); } catch (_) {} }
        else { try { s.remove(); } catch (_) {} }
      }
    } catch (_) {}
  }

  // ────────────────────────────────────────────────────────────────
  // 6. Crash overlay detection / dismissal
  // ────────────────────────────────────────────────────────────────
  function inCrashWindow() {
    try {
      var fired = Number(ssGet(GATE_FIRED_KEY) || 0);
      if (fired && (Date.now() - fired) < CRASH_WINDOW_MS) return true;
    } catch (_) {}
    return !aiAccepted() && !!relayPath() && wizardActive();
  }

  function blueishBg(el) {
    try {
      var cs = getComputedStyle(el);
      var bg = (cs.backgroundColor || '').toLowerCase();
      var m = bg.match(/rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (!m) return false;
      var R = +m[1], G = +m[2], B = +m[3];
      return B >= 60 && B > (R + G) / 2 + 18 && R < 110;
    } catch (_) { return false; }
  }

  function looksLikeCrashOverlay(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.classList && el.classList.contains(SLIDE_CLASS)) return false;
    if (el.closest && el.closest('.' + SLIDE_CLASS)) return false;
    if (el.getAttribute && el.getAttribute('data-antcv-onboarding-overlay') === '1') return false;
    try {
      var r = el.getBoundingClientRect();
      if (r.width < window.innerWidth * 0.55) return false;
      if (r.height < window.innerHeight * 0.35) return false;
    } catch (_) { return false; }
    var t = (el.textContent || '').toLowerCase();
    if (/(next|back|skip|continue|step\s+\d|wizard|setup|onboarding|tell\s+antcv|provider|worker|cloud|relay|sign\s+in|sign\s+out)/.test(t)) return false;
    if (/error|something went wrong|crashed|stack trace|cannot read|undefined is not|oops|try\s+again/.test(t)) return true;
    if (blueishBg(el)) return true;
    return false;
  }

  function dismissCrashOverlays() {
    var hits = 0;
    try {
      var cands = document.querySelectorAll(
        'div, section, main, aside, [class*="error" i], [class*="overlay" i], [class*="screen" i], [role="alert"]'
      );
      for (var i = 0; i < cands.length; i++) {
        var el = cands[i];
        if (!isVisible(el)) continue;
        if (!looksLikeCrashOverlay(el)) continue;
        try {
          el.setAttribute('data-antcv-crash-dismissed', '1');
          el.style.setProperty('display', 'none', 'important');
          el.style.setProperty('pointer-events', 'none', 'important');
        } catch (_) {}
        try { el.remove(); } catch (_) {}
        hits += 1;
      }
    } catch (_) {}
    if (hits) log('crash.dismiss', hits + ' overlay(s)');
    return hits;
  }

  function recoverFromCrash(reason) {
    if (aiAccepted()) return;
    if (!inCrashWindow()) return;
    dismissCrashOverlays();
    if (slideAlreadyMounted()) return;
    var host = findWizardHost();
    if (host) { mountInWizard(host); return; }
    mountFixedOverlay();
    log('crash.recover', reason || '');
  }

  function installCrashHandlers() {
    window.addEventListener('error', function (ev) {
      if (!inCrashWindow()) return;
      var msg = '';
      try { msg = (ev && ev.message) || (ev && ev.error && ev.error.message) || ''; } catch (_) {}
      log('crash.error', String(msg).slice(0, 120));
      setTimeout(function () { recoverFromCrash('window.error'); }, 30);
      setTimeout(function () { recoverFromCrash('window.error:retry'); }, 300);
    }, true);
    window.addEventListener('unhandledrejection', function () {
      if (!inCrashWindow()) return;
      setTimeout(function () { recoverFromCrash('unhandledrejection'); }, 30);
      setTimeout(function () { recoverFromCrash('unhandledrejection:retry'); }, 300);
    });
  }

  // ────────────────────────────────────────────────────────────────
  // 7. Skip-confirm suppressor (window.confirm patch)
  // ────────────────────────────────────────────────────────────────
  (function installSkipConfirmSuppressor() {
    var origConfirm = (typeof window.confirm === 'function') ? window.confirm.bind(window) : null;
    if (!origConfirm) return;
    window.confirm = function (msg) {
      try {
        if (typeof msg === 'string' && msg) {
          var lower = msg.toLowerCase();
          var hasSkip = lower.indexOf('skip') >= 0;
          var hasWizardWord =
            lower.indexOf('wizard') >= 0 ||
            lower.indexOf('setup') >= 0 ||
            lower.indexOf('onboarding') >= 0;
          var hasReopenWord =
            lower.indexOf('re-open') >= 0 ||
            lower.indexOf('reopen') >= 0 ||
            lower.indexOf('re open') >= 0 ||
            lower.indexOf('settings') >= 0;
          if (hasSkip && hasWizardWord && hasReopenWord) {
            log('skip-confirm.suppress', msg.slice(0, 100));
            return false;
          }
        }
      } catch (_) {}
      return origConfirm.apply(this, arguments);
    };
  })();

  // ────────────────────────────────────────────────────────────────
  // 8. Skip-button click capture + explicit-open detector
  // ────────────────────────────────────────────────────────────────
  document.addEventListener('click', function (ev) {
    var t = ev && ev.target;
    if (!t || t.nodeType !== 1) return;
    var b = t.closest ? t.closest('button, [role="button"], a, input[type="button"], input[type="submit"]') : null;
    if (!b) return;
    var txt = ((b.textContent || b.value || '') + '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (!txt) return;
    // Skip button → mark wizardSkipped so the post-skip notice overlay
    // can fire when needed (state machine case 5/6).
    if (/^skip(\s|$)/.test(txt) || /skip\s+(setup|wizard|onboarding)/.test(txt)) {
      markWizardSkipped('user-click');
    }
    // Settings re-run → suppress returner auto-skip for the next 5 min.
    for (var i = 0; i < WIZARD_BUTTON_TEXTS.length; i++) {
      var needle = WIZARD_BUTTON_TEXTS[i];
      if (txt.indexOf(needle) !== -1) {
        setExplicitOpen();
        // Also clear the skip flag so the overlay doesn't fire from a
        // previous skip session.
        try { lsRemove(WIZARD_SKIPPED_KEY); } catch (_) {}
        break;
      }
    }
  }, true);

  // ────────────────────────────────────────────────────────────────
  // 9. Auto-skip decision (state machine entry)
  // ────────────────────────────────────────────────────────────────
  // Cases 1/2 of the state machine: wizardCompleted === true AND
  // the wizard is currently showing AND the user did not explicitly
  // re-open it from Settings → skip it. If !aiAccepted, the post-skip
  // overlay (case 2) will then mount via scanForOverlay() below.
  function maybeSkipForReturner() {
    if (explicitOpenActive()) return; // user just opened from Settings
    if (acceptedValue(lsGet(DISABLE_WIZARD_SKIP_KEY))) return;
    if (acceptedValue(lsGet('antcvDisableWizardSkip'))) return; // legacy key
    if (!wizardCompleted()) return;
    // Look for the Welcome heading (specific to the wizard root).
    var headings = document.querySelectorAll('h1, h2, h3');
    var found = null;
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      if (!isVisible(h)) continue;
      var t = (h.textContent || '');
      if (t.indexOf('Welcome to AntCV') >= 0 || /tell\s+antcv\s+about/i.test(t)) {
        found = h; break;
      }
    }
    if (!found) return;
    // Walk up to wizard root.
    var cur = found, root = found, levels = 0;
    while (cur && cur.parentElement && cur.parentElement !== document.body && levels < 10) {
      cur = cur.parentElement;
      try {
        var cs = getComputedStyle(cur);
        if (cs.position === 'fixed') { root = cur; break; }
      } catch (_) {}
      root = cur;
      levels++;
    }
    if (!root) return;
    if (root.dataset.antcvWizardAutoSkipped === '1') return;
    root.style.setProperty('display', 'none', 'important');
    root.dataset.antcvWizardAutoSkipped = '1';
    markWizardSkipped('auto-returner');
    setTimeout(function () {
      var btn = findSkipButton(root);
      if (btn) { try { btn.click(); } catch (_) {} }
    }, 30);
    log('auto-skip.returner', 'aiAccepted=' + aiAccepted());
  }

  // Cases 2/5/6: wizard skipped (auto or manual) AND !aiAccepted →
  // mount fixed overlay so the user can complete the disclosure on the
  // way to the main editor.
  function maybeShowSkipOverlay() {
    if (aiAccepted()) return;
    if (!wizardWasExplicitlySkipped()) return;
    if (wizardActive()) return;
    if (slideAlreadyMounted()) return;
    mountFixedOverlay();
    log('skip-overlay.mount', '');
  }

  // ────────────────────────────────────────────────────────────────
  // 10. AI-notice gate (in-wizard slide)
  // ────────────────────────────────────────────────────────────────
  // The slide must appear on the wizard step that comes AFTER the
  // relay-path step (in this wizard's layout: Step 4 "Add LLM API
  // keys", which comes after the Cloudflare Worker URL step). v260
  // gated on `seenRelayStep` which only flipped via a polled DOM
  // check on the URL step — if the user pasted and clicked Next
  // faster than the 400 ms poll, that flip was missed and the
  // slide only fired later from secondary triggers.
  //
  // v261 widens the trigger:
  //   1. `seenRelayStep` still flips when isRelayStepHost matches,
  //      but ALSO on input events that match worker/relay/https URLs
  //      (captured before localStorage commits), and ALSO whenever
  //      relayPath() becomes non-empty during an active wizard.
  //   2. Mount fires when (a) the wizard is active, (b) relayPath
  //      is set, (c) the current host is not the relay step, and
  //      (d) seenRelayStep is true OR the current host looks like
  //      a post-relay step (LLM keys / provider / API key).
  //   3. `slideShownInThisRun` flag prevents re-mounting on every
  //      subsequent step transition; flag clears when the wizard
  //      closes so a settings re-run gets a fresh chance.
  var seenRelayStep = false;
  var lastRelay = relayPath();
  var relayStuckTicks = 0;
  var STUCK_THRESHOLD = 6;
  var slideShownInThisRun = false;
  var wizardWasActive = false;

  function isPostRelayStepHost(host) {
    if (!host || host.nodeType !== 1) return false;
    if (isRelayStepHost(host)) return false;
    // Provider-selection step (matches the original wizard-slide logic).
    if (isProviderStepHost(host)) return true;
    // LLM API keys step: visible inputs whose placeholders / aria-labels
    // / current values look like API keys, or whose surrounding text
    // mentions LLM/API keys + a provider name.
    try {
      var inputs = host.querySelectorAll('input');
      for (var i = 0; i < inputs.length; i++) {
        var n = inputs[i];
        if (!isVisible(n)) continue;
        var ph = String(n.placeholder || '').toLowerCase();
        var aria = String((n.getAttribute && n.getAttribute('aria-label')) || '').toLowerCase();
        var blob = ph + ' ' + aria + ' ' + String(n.value || '').toLowerCase();
        if (/sk-ant|aiza|api[\s-]?key|bearer\s/.test(blob)) return true;
      }
    } catch (_) {}
    var t = txtOf(host, 1800).toLowerCase();
    if (/(add\s+llm\s+api|llm\s+api\s+keys?\b|api\s+keys?\b)/.test(t) &&
        /(anthropic|openai|mistral|google|gemini|claude|gpt)/.test(t)) return true;
    return false;
  }

  function markRelayStepSeen(source) {
    if (seenRelayStep) return;
    seenRelayStep = true;
    ssSet(GATE_FIRED_KEY, String(Date.now()));
    log('gate.seen-relay-step', source || '');
  }

  // v263: surface the visible wizard step number. The wizard prints
  // "STEP N" prominently on every step. v264 reuses
  // findVisibleStepNumberElement() (defined earlier and used by
  // wizardActive / findWizardHost too) so there's a single search.
  function getVisibleWizardStepNumber() {
    try {
      var el = findVisibleStepNumberElement();
      if (!el) return null;
      var t = String(el.textContent || '').trim();
      var m = /^(?:STEP|Step|step)\s+(\d+)/.exec(t);
      return m ? parseInt(m[1], 10) : null;
    } catch (_) {}
    return null;
  }

  // Track step transitions so we can log them once each (not every
  // tick) and so the Next-click retry logic has a quick way to verify
  // the wizard actually moved.
  var lastSeenStepNumber = null;

  function maybeLogStepTransition() {
    var n = getVisibleWizardStepNumber();
    if (n === lastSeenStepNumber) return;
    var prev = lastSeenStepNumber;
    lastSeenStepNumber = n;
    try {
      console.info('[antcv-onboarding ' + VERSION + '] step transition: ' +
                   (prev === null ? '(none)' : 'STEP ' + prev) + ' \u2192 ' +
                   (n === null ? '(none)' : 'STEP ' + n));
    } catch (_) {}
  }

  // v265: input/paste/click handlers that auto-flipped seenRelayStep
  // have been removed. The polled tickAiGate now triggers purely on
  // the visible STEP number — the most reliable signal — so the
  // belt-and-braces events are no longer needed (and were the source
  // of the v264 "AI notice on STEP 1" regression for returning users
  // whose proxyUrl was already in localStorage from cloud-restore).
  //
  // The only thing still useful in event-driven code is the Next-click
  // retry schedule, which speeds up the mount on the STEP 3 → STEP 4
  // transition (faster than waiting for the next 400 ms tick). It now
  // also uses stepNum >= 4 as its trigger condition.
  function scheduleMountRetries(reason) {
    var delays = [120, 350, 700, 1400];
    delays.forEach(function (d) {
      setTimeout(function () {
        if (slideShownInThisRun || slideAlreadyMounted()) return;
        if (!wizardActive()) return;
        var sn = getVisibleWizardStepNumber();
        if (!sn || sn < 4) return;
        var h = findWizardHost();
        if (!h || isRelayStepHost(h)) return;
        dismissCrashOverlays();
        ssSet(GATE_FIRED_KEY, String(Date.now()));
        if (mountInWizard(h)) {
          slideShownInThisRun = true;
          try { console.info('[antcv-onboarding ' + VERSION + '] AI notice mounted (retry-' + d + 'ms ' + (reason || '') + ')'); } catch (_) {}
        }
      }, d);
    });
  }

  document.addEventListener('click', function (ev) {
    var t = ev && ev.target;
    if (!t || t.nodeType !== 1) return;
    var btn = null;
    try { btn = t.closest('button, [role="button"], input[type="button"], input[type="submit"]'); } catch (_) { return; }
    if (!btn) return;
    var txt = String((btn.textContent || btn.value || '')).trim().toLowerCase();
    if (!/^(next|continue|done|save)\b/.test(txt)) return;
    var sn = getVisibleWizardStepNumber();
    // Only retry on the STEP 3 → STEP 4 transition. Clicking Next on
    // STEP 4 itself means the user just consented and is advancing
    // further; the slide should already be dismissed by then.
    if (sn === 3) {
      scheduleMountRetries('next-from-step-3');
    }
  }, true);

  // v262: debounce wizardActive() flicker. React step transitions
  // sometimes blip the host detection to false for a single poll,
  // which previously reset slideShownInThisRun + seenRelayStep and
  // caused the slide to either re-mount on every step or never
  // mount at all. We now require N consecutive inactive ticks
  // before resetting any state.
  var inactiveTicks = 0;
  var INACTIVE_RESET_THRESHOLD = 4; // ~1.6s with POLL_MS=400

  // v265: trigger logic rewritten down to one signal — the visible
  // STEP number. The text/content/input heuristics in
  // isPostRelayStepHost were fragile (they fell back to scanning the
  // entire wizard container's textContent, which on STEP 1 already
  // included LLM-keys placeholder text from later steps pre-rendered
  // in the DOM, causing the slide to fire on the welcome screen for
  // returning users). v262's "markRelayStepSeen('relay-path-set')"
  // auto-flip was the matching bug: a returning user has proxyUrl
  // set from cloud-restore before they even reach STEP 3 in this
  // wizard run, so seenRelayStep flipped instantly and the mount
  // fired on STEP 1.
  //
  // The state machine is now:
  //   - STEP 1, 2, 3        → don't mount
  //   - STEP >= 4           → mount (seenRelayStep implicitly true,
  //                            since the user advanced through STEP 3
  //                            to get here)
  //   - no STEP visible     → don't mount (welcome screen, between
  //                            steps, completion screen, etc.)
  //   - already mounted     → don't re-mount
  //   - shown this run      → don't re-mount until wizard closes
  //                            for INACTIVE_RESET_THRESHOLD ticks
  function tickAiGate() {
    try {
      maybeLogStepTransition();
      var wActive = wizardActive();

      if (!wActive) {
        inactiveTicks += 1;
        if (inactiveTicks >= INACTIVE_RESET_THRESHOLD && wizardWasActive) {
          slideShownInThisRun = false;
          seenRelayStep = false;
          relayStuckTicks = 0;
          wizardWasActive = false;
          lastSeenStepNumber = null;
          log('gate.reset', 'wizard inactive ' + inactiveTicks + ' ticks');
        }
        return;
      }
      inactiveTicks = 0;
      wizardWasActive = true;

      if (slideAlreadyMounted()) return;
      if (slideShownInThisRun) return;

      var stepNum = getVisibleWizardStepNumber();
      if (!stepNum) return;

      // STEP 4+ is the post-relay zone. Mount once.
      if (stepNum >= 4) {
        seenRelayStep = true;
        var host = findWizardHost();
        if (!host) return;
        // Defensive: if for some reason findWizardHost picked a relay
        // step (shouldn't happen since we only enter this branch on
        // stepNum >= 4, but be safe), bail.
        if (isRelayStepHost(host)) return;
        dismissCrashOverlays();
        ssSet(GATE_FIRED_KEY, String(Date.now()));
        if (mountInWizard(host)) {
          slideShownInThisRun = true;
          try { console.info('[antcv-onboarding ' + VERSION + '] AI notice mounted (step-' + stepNum + ')'); } catch (_) {}
        }
      }
    } catch (_) {}
  }

  // ────────────────────────────────────────────────────────────────
  // 11. Section-formats card visibility guard (step 10 only)
  // ────────────────────────────────────────────────────────────────
  var CARD_RE = /Section\s+formats\s*[—-]\s*pick\s+how\s+each\s+section\s+looks/i;
  var STEP10_RE = /(?:step|stage)\s*10\b|\b10\s*\/\s*(?:10|11|12|13|14|15)\b|\b10\s+of\s+(?:10|11|12|13|14|15)\b/i;

  function stripSectionFormatsCardOutsideStep10() {
    var wizard = findWizardHost() || document.body;
    var sCur = txtOf(wizard, 6000);
    if (!sCur) return;
    if (STEP10_RE.test(sCur)) return; // we are on step 10; keep the card
    if (!CARD_RE.test(sCur)) return;  // card not visible anywhere
    // Find the card root and hide it (don't remove — React may reuse it).
    try {
      var nodes = wizard.querySelectorAll('div, section, aside');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!isVisible(n)) continue;
        var t = txtOf(n, 1500);
        if (CARD_RE.test(t)) {
          // Climb up until we hit the smallest card-shaped ancestor.
          var best = n, levels = 0, cur = n;
          while (cur && cur.parentElement && cur.parentElement !== document.body && levels < 4) {
            cur = cur.parentElement;
            var st = txtOf(cur, 2200);
            if (CARD_RE.test(st) && cur.children && cur.children.length >= 2) best = cur;
            levels++;
          }
          try {
            best.style.setProperty('display', 'none', 'important');
            best.setAttribute('data-antcv-step10-hidden', '1');
          } catch (_) {}
          return;
        }
      }
    } catch (_) {}
  }

  // ────────────────────────────────────────────────────────────────
  // 12. Wizard upload-summary recount + personalInfo normalisation
  // ────────────────────────────────────────────────────────────────
  // v266: Gabriel's enhanced personalInfo JSON contains `experience`
  // (8 items) but no `workHistory` field, and `publicationsStructured`
  // (3 items) plus `publications` (3 strings). App.js's wizard summary
  // renderer reads `workHistory` and `publications`, so on upload it
  // reports "0 work entries · 0 publications" because the data lives
  // under the other key names. Downstream renderers (the kernel) hit
  // the same problem.
  //
  // We cross-populate the dual keys after every personalInfo write
  // so anything that reads either name finds the data. We do NOT
  // overwrite existing arrays — we only fill in the missing key.
  var NORMALIZE_DISABLE_KEY = 'antcvDisablePersonalInfoNormalize';
  var DUAL_KEYS = [
    ['workHistory', 'experience'],
    ['publications', 'publicationsStructured']
  ];

  function arrLen(v) { return Array.isArray(v) ? v.length : 0; }

  function normalizePersonalInfo() {
    if (acceptedValue(lsGet(NORMALIZE_DISABLE_KEY))) return false;
    var pi = lsJSON('personalInfo');
    if (!pi || typeof pi !== 'object') return false;
    var changed = false;
    for (var i = 0; i < DUAL_KEYS.length; i++) {
      var a = DUAL_KEYS[i][0];
      var b = DUAL_KEYS[i][1];
      var la = arrLen(pi[a]);
      var lb = arrLen(pi[b]);
      if (la === 0 && lb > 0) {
        // Copy b → a. Use a shallow copy of the array so subsequent
        // mutations to one don't silently affect the other.
        pi[a] = pi[b].slice();
        changed = true;
      } else if (lb === 0 && la > 0) {
        pi[b] = pi[a].slice();
        changed = true;
      }
    }
    if (changed) {
      try {
        lsSet('personalInfo', JSON.stringify(pi));
        try {
          console.info('[antcv-onboarding ' + VERSION + '] personalInfo normalised:' +
            ' workHistory=' + arrLen(pi.workHistory) +
            ', experience=' + arrLen(pi.experience) +
            ', publications=' + arrLen(pi.publications) +
            ', publicationsStructured=' + arrLen(pi.publicationsStructured));
        } catch (_) {}
      } catch (_) {}
    }
    return changed;
  }

  var SUMMARY_RE = /\u2713 Found \d+ work entr(?:y|ies) [\u00B7\u2022] \d+ education [\u00B7\u2022] \d+ certifications [\u00B7\u2022] \d+ publications\./;

  function recountUploadSummary() {
    if (acceptedValue(lsGet(DISABLE_UPLOAD_RECOUNT_KEY))) return;
    // v266: normalise first so workHistory/publications are populated
    // before we count, then app.js's summary renderer (if it re-renders)
    // also sees the right counts on subsequent passes.
    normalizePersonalInfo();
    var pi = lsJSON('personalInfo');
    if (!pi) return;
    var workCount = (Array.isArray(pi.workHistory) ? pi.workHistory.length :
                     Array.isArray(pi.experience) ? pi.experience.length : 0);
    var eduCount = Array.isArray(pi.education) ? pi.education.length : 0;
    var certCount = Array.isArray(pi.certifications) ? pi.certifications.length : 0;
    var pubCount = (Array.isArray(pi.publicationsStructured) ? pi.publicationsStructured.length :
                    Array.isArray(pi.publications) ? pi.publications.length : 0);
    var expected =
      '\u2713 Found ' + workCount + ' work entr' + (workCount === 1 ? 'y' : 'ies') +
      ' \u00B7 ' + eduCount + ' education \u00B7 ' + certCount + ' certifications \u00B7 ' + pubCount + ' publications.';
    var cands = document.querySelectorAll('div');
    for (var i = 0; i < cands.length; i++) {
      var el = cands[i];
      var t = el.textContent || '';
      if (!SUMMARY_RE.test(t)) continue;
      if (t.indexOf(expected) >= 0) continue;
      if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) {
        var newText = el.textContent.replace(SUMMARY_RE, expected);
        if (newText !== el.textContent) el.textContent = newText;
      } else {
        try {
          var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
          var node;
          while ((node = walker.nextNode())) {
            if (SUMMARY_RE.test(node.nodeValue || '')) {
              node.nodeValue = node.nodeValue.replace(SUMMARY_RE, expected);
              break;
            }
          }
        } catch (_) {}
      }
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 13. Strip Gabriel's name from the wizard placeholder
  // ────────────────────────────────────────────────────────────────
  function stripPlaceholderName() {
    if (acceptedValue(lsGet(DISABLE_PLACEHOLDER_STRIP_KEY))) return;
    var inputs = document.querySelectorAll('input[placeholder]');
    for (var i = 0; i < inputs.length; i++) {
      var input = inputs[i];
      var ph = input.placeholder || '';
      if (ph.indexOf(NAME_IN_PLACEHOLDER) < 0) continue;
      if (input.placeholder !== GENERIC_PLACEHOLDER) input.placeholder = GENERIC_PLACEHOLDER;
    }
  }

  // ────────────────────────────────────────────────────────────────
  // 14. Formats explainer card (Step 4)
  // ────────────────────────────────────────────────────────────────
  // Adds a collapsed instructional card explaining the seven section
  // formats. Shown only at the "Test the connection" step.
  var EXPLAINER_MARK = 'data-antcv-formats-explainer';

  function findStepPanel() {
    try {
      // v264: case-insensitive. The wizard prints "STEP N" all-caps;
      // the previous regex /^Step\s+\d+/ never matched.
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var t = (node.textContent || '').trim();
          return /^(?:STEP|Step|step)\s+\d+(?:\s+of\s+\d+)?$/.test(t)
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_SKIP;
        }
      });
      var tNode = walker.nextNode();
      if (!tNode) return null;
      var n = tNode.parentElement;
      for (var i = 0; i < 6 && n && n.parentElement; i++) {
        if (n.children && n.children.length >= 3) break;
        n = n.parentElement;
      }
      return { panel: n, stepText: (tNode.textContent || '').trim() };
    } catch (_) { return null; }
  }

  // v264: shouldInjectExplainer / maybeInjectFormatsExplainer no
  // longer rely on findStepPanel (which used a case-sensitive
  // /^Step\s+\d+/ regex — the wizard prints "STEP N" all-caps, so
  // that helper was failing silently on this build of app.js).
  // Instead we walk visible headings directly.
  //
  // Targets (in order of preference):
  //   1. "Section formats" — the eventual Step 10 once added to app.js
  //   2. "You're ready" / "All set" / "Ready to generate" — the
  //      completion screen the wizard currently jumps to from
  //      step 5 or step 9. Putting the explainer here means the user
  //      sees the format reference before generation kicks in.
  function findExplainerTargetHeading() {
    var headings;
    try { headings = document.querySelectorAll('h1, h2, h3, h4'); } catch (_) { return null; }
    for (var i = 0; i < headings.length; i++) {
      var h = headings[i];
      if (!isVisible(h)) continue;
      try { if (h.closest && h.closest('[' + EXPLAINER_MARK + ']')) continue; } catch (_) {}
      var t = String(h.textContent || '').toLowerCase().trim();
      if (!t) continue;
      // Step 10 heading (future) — "Section formats — pick how each section looks"
      if (/section\s+formats/.test(t)) return h;
      // Completion screen — "You're ready!" / "You are ready" / "All set" / "Ready to generate"
      if (/you[\u2019']?re\s+ready|you\s+are\s+ready|all\s+set\b|ready\s+to\s+(?:generate|go)/.test(t)) return h;
    }
    return null;
  }

  function panelFromHeading(h) {
    if (!h) return null;
    var n = h.parentElement;
    for (var i = 0; i < 6 && n && n.parentElement; i++) {
      // Walk up until we reach a container that has several children
      // (i.e. a real panel, not just the heading wrapper).
      if (n.children && n.children.length >= 3) break;
      n = n.parentElement;
    }
    return n || null;
  }

  function shouldInjectExplainer() {
    return !!findExplainerTargetHeading();
  }

  function removeStrayExplainers() {
    try {
      var existing = document.querySelectorAll('[' + EXPLAINER_MARK + ']');
      for (var i = 0; i < existing.length; i++) {
        try { existing[i].remove(); } catch (_) {}
      }
    } catch (_) {}
  }

  function maybeInjectFormatsExplainer() {
    var heading = findExplainerTargetHeading();
    if (!heading) {
      // If the criterion no longer holds (step changed, wizard closed,
      // user landed on the main editor), remove any stray cards left
      // by an earlier injection.
      removeStrayExplainers();
      return;
    }
    var panel = panelFromHeading(heading);
    if (!panel) return;
    if (panel.querySelector('[' + EXPLAINER_MARK + ']')) return;
    injectExplainerStyles();
    try { panel.appendChild(buildExplainerCard()); } catch (_) {}
  }

  function injectExplainerStyles() {
    if (document.getElementById('antcv-formats-explainer-style')) return;
    var st = document.createElement('style');
    st.id = 'antcv-formats-explainer-style';
    st.textContent =
      '.antcv-fe-card{margin-top:24px;border:1px solid #cad4e0;border-radius:10px;background:#f7f9fc;color:#1a2438;font-size:13px;line-height:1.45;overflow:hidden;}' +
      '.antcv-fe-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none;background:#eef3fa;}' +
      '.antcv-fe-head:hover{background:#e6edf6;}' +
      '.antcv-fe-head[aria-expanded="true"]{background:#e0e9f4;}' +
      '.antcv-fe-arrow{display:inline-block;transition:transform .15s ease;font-size:11px;color:#6075a1;}' +
      '.antcv-fe-head[aria-expanded="true"] .antcv-fe-arrow{transform:rotate(90deg);}' +
      '.antcv-fe-title{font-weight:700;}' +
      '.antcv-fe-badge{display:inline-block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:2px 6px;border-radius:6px;background:#01b7bb;color:#fff;font-weight:700;}' +
      '.antcv-fe-body{display:none;padding:14px;}' +
      '.antcv-fe-head[aria-expanded="true"]+.antcv-fe-body{display:block;}' +
      '.antcv-fe-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;}' +
      '.antcv-fe-tile{border:1px solid #d6dee9;border-radius:8px;padding:10px;background:#fff;}' +
      '.antcv-fe-tile h4{margin:0 0 6px 0;font-size:12px;color:#283556;}' +
      '.antcv-fe-mock{height:64px;background:linear-gradient(180deg,#fafcff,#eef3fa);border-radius:6px;border:1px dashed #c8d3e0;display:flex;align-items:center;justify-content:center;color:#7187b0;font-size:11px;font-style:italic;}' +
      '';
    document.head.appendChild(st);
  }

  function buildExplainerCard() {
    var card = document.createElement('div');
    card.className = 'antcv-fe-card';
    card.setAttribute(EXPLAINER_MARK, '1');
    var seen = acceptedValue(lsGet(FORMATS_EXPLAINER_SEEN_KEY));
    var badge = seen ? '' : '<span class="antcv-fe-badge">New</span>';
    card.innerHTML =
      '<div class="antcv-fe-head" role="button" tabindex="0" aria-expanded="false">' +
        '<span class="antcv-fe-arrow">\u25B6</span>' +
        '<span class="antcv-fe-title">Section formats explained</span>' +
        badge +
      '</div>' +
      '<div class="antcv-fe-body">' +
        '<p>Each section can be displayed in one of seven formats. Pick the format that fits each section best — examples below.</p>' +
        '<div class="antcv-fe-grid">' +
          '<div class="antcv-fe-tile"><h4>Paragraph</h4><div class="antcv-fe-mock">Lines of prose</div></div>' +
          '<div class="antcv-fe-tile"><h4>Bullets</h4><div class="antcv-fe-mock">\u2022 \u2022 \u2022 \u2022</div></div>' +
          '<div class="antcv-fe-tile"><h4>Emoji bullets</h4><div class="antcv-fe-mock">\u2192 \u2728 \u2705 \uD83D\uDCCC</div></div>' +
          '<div class="antcv-fe-tile"><h4>Hybrid 1</h4><div class="antcv-fe-mock">Title + bullets</div></div>' +
          '<div class="antcv-fe-tile"><h4>Hybrid 2</h4><div class="antcv-fe-mock">Para + bullets</div></div>' +
          '<div class="antcv-fe-tile"><h4>Hybrid 3</h4><div class="antcv-fe-mock">Para + items</div></div>' +
          '<div class="antcv-fe-tile"><h4>Table</h4><div class="antcv-fe-mock">|cell|cell|</div></div>' +
        '</div>' +
      '</div>';
    var head = card.querySelector('.antcv-fe-head');
    function toggle() {
      var open = head.getAttribute('aria-expanded') === 'true';
      head.setAttribute('aria-expanded', open ? 'false' : 'true');
      if (!open) lsSet(FORMATS_EXPLAINER_SEEN_KEY, '1');
    }
    head.addEventListener('click', toggle);
    head.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); }
    });
    return card;
  }

  // ────────────────────────────────────────────────────────────────
  // 15. Post-delete UX flow
  // ────────────────────────────────────────────────────────────────
  // Activates ONLY when sessionStorage[POST_DELETE_MARKER] is set and
  // recent (within POST_DELETE_TTL_MS = 5 min). The marker is set by
  // AntcvFullErase right before reload. While active:
  //   - localStorage.personalInfo is filtered so app.js sees no
  //     "user has a profile" signal from JWT-injected fields
  //   - wizardCompleted writes are blocked
  //   - the "cloud returned no saved profile" banner is hidden
  //   - matching console.warn lines are suppressed
  //   - the wizard is forced open by clicking "Setup needed" etc.

  var NON_MEANINGFUL_KEYS = {
    email: 1, fullName: 1, sub: 1, picture: 1, provider: 1, token: 1, auth: 1,
    aiDisclosureAccepted: 1, aiDisclosure: 1, disclosureAccepted: 1,
    aiDisclosureAcceptedMeta: 1,
    wizardCompleted: 1, wizard_completed: 1, wizardComplete: 1,
    stylePrefs: 1
  };
  var MEANINGFUL_KEYS = ['name', 'firstName', 'lastName', 'headline',
    'phone', 'location', 'linkedin', 'website', 'summary', 'github',
    'citizenship', 'workHistory', 'education', 'publications',
    'certifications', 'languages', 'tools', 'regulatory', 'additional',
    'skills', 'experience'];
  var WIZARD_COMPLETED_KEYS_MAP = { wizardCompleted: 1, wizard_completed: 1, wizardComplete: 1 };

  function postDeleteMarkerAge() {
    var raw = ssGet(POST_DELETE_MARKER);
    if (!raw) return null;
    var ts = parseInt(raw, 10);
    if (!ts) return null;
    return Date.now() - ts;
  }
  function postDeleteActive() {
    var age = postDeleteMarkerAge();
    return (age !== null && age >= 0 && age < POST_DELETE_TTL_MS);
  }
  function clearPostDeleteMarker(reason) {
    try { sessionStorage.removeItem(POST_DELETE_MARKER); } catch (_) {}
    try { localStorage.removeItem(DISABLE_WIZARD_SKIP_KEY); } catch (_) {}
    try { localStorage.removeItem('antcvDisableWizardSkip'); } catch (_) {}
    log('post-delete.clear', reason || '');
  }

  function hasAnyMeaningful(pi) {
    if (!pi || typeof pi !== 'object') return false;
    for (var i = 0; i < MEANINGFUL_KEYS.length; i++) {
      var v = pi[MEANINGFUL_KEYS[i]];
      if (v === null || v === undefined) continue;
      if (typeof v === 'string' && v.trim() !== '') return true;
      if (Array.isArray(v) && v.length > 0) return true;
      if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0) return true;
    }
    return false;
  }

  function stripToMeaningful(pi) {
    if (!pi || typeof pi !== 'object') return {};
    var out = {};
    var ks = Object.keys(pi);
    for (var i = 0; i < ks.length; i++) {
      var k = ks[i];
      if (NON_MEANINGFUL_KEYS[k]) continue;
      out[k] = pi[k];
    }
    return out;
  }

  function clearFreshUserState() {
    try {
      var raw = lsGet('personalInfo');
      if (raw) {
        var parsed = null;
        try { parsed = JSON.parse(raw); } catch (_) {}
        if (parsed && typeof parsed === 'object') {
          if (!hasAnyMeaningful(parsed)) {
            lsSet('personalInfo', '{}');
            log('post-delete.pi', 'replaced with {}');
          } else {
            lsSet('personalInfo', JSON.stringify(stripToMeaningful(parsed)));
            log('post-delete.pi', 'stripped non-meaningful keys');
          }
        }
      }
      ['wizardCompleted', 'wizard_completed', 'wizardComplete'].forEach(function (k) {
        if (lsGet(k) !== null && lsGet(k) !== '') lsSet(k, 'false');
      });
      lsSet(DISABLE_WIZARD_SKIP_KEY, '1');
      lsSet('antcvDisableWizardSkip', '1');
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'personalInfo', newValue: '{}', storageArea: localStorage
        }));
      } catch (_) {}
    } catch (e) {
      log('post-delete.pi.err', String(e && e.message));
    }
  }

  function isTruthyWizardCompletedValue(v) {
    if (v === null || v === undefined) return false;
    if (v === true || v === 1) return true;
    if (typeof v === 'string') {
      var t = v.trim().toLowerCase();
      if (t === 'true' || t === '1') return true;
      try { var p = JSON.parse(v); if (p === true || p === 1) return true; } catch (_) {}
    }
    return false;
  }

  function installLocalStorageWrap() {
    try {
      var proto = Object.getPrototypeOf(localStorage);
      if (!proto || proto.__antcvOnboardingWrapped) return;
      var origGet = proto.getItem;
      var origSet = proto.setItem;
      proto.getItem = function (key) {
        var v = origGet.call(this, key);
        try {
          if (postDeleteActive()) {
            if (key === 'personalInfo' && typeof v === 'string' && v) {
              var parsed = JSON.parse(v);
              if (parsed && typeof parsed === 'object' && !hasAnyMeaningful(parsed)) {
                return '{}';
              }
            }
            if (WIZARD_COMPLETED_KEYS_MAP[key] && isTruthyWizardCompletedValue(v)) {
              return 'false';
            }
          }
        } catch (_) {}
        return v;
      };
      proto.setItem = function (key, value) {
        try {
          if (postDeleteActive()) {
            if (WIZARD_COMPLETED_KEYS_MAP[key] && isTruthyWizardCompletedValue(value)) {
              return origSet.call(this, key, 'false');
            }
            if (key === 'personalInfo' && typeof value === 'string' && value) {
              try {
                var parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object' && !hasAnyMeaningful(parsed)) {
                  return origSet.call(this, key, '{}');
                }
              } catch (_) {}
            }
          }
        } catch (_) {}
        return origSet.call(this, key, value);
      };
      proto.__antcvOnboardingWrapped = true;
      log('post-delete.ls.wrap', 'installed');
    } catch (e) {
      log('post-delete.ls.wrap.err', String(e && e.message));
    }
  }

  // Banner suppressor
  function findBannerContainer(root) {
    if (!root) return null;
    try {
      var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = tw.nextNode())) {
        var t = (n.nodeValue || '').toLowerCase();
        if (t.indexOf(WARNING_NEEDLE_LOWER) !== -1) {
          var el = n.parentElement;
          var hops = 0, best = el;
          while (el && hops < 5) {
            if (el === document.body || el === document.documentElement) break;
            var cs;
            try { cs = getComputedStyle(el); } catch (_) {}
            if (cs) {
              var styled =
                (cs.borderRadius && cs.borderRadius !== '0px') ||
                (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent') ||
                (cs.border && cs.border.indexOf('none') === -1 && cs.border.indexOf('0px') !== 0);
              if (styled) {
                try {
                  var r = el.getBoundingClientRect();
                  var vw = (window.innerWidth || 1024), vh = (window.innerHeight || 768);
                  if (r.width <= vw * 0.95 && r.height <= vh * 0.6) return el;
                } catch (_) { return el; }
              }
            }
            el = el.parentElement; hops++;
          }
          if (best && best !== document.body && best !== document.documentElement) return best;
          return null;
        }
      }
    } catch (_) {}
    return null;
  }

  function hideBannerOnce() {
    try {
      var el = findBannerContainer(document.body);
      if (!el) return false;
      if (el.dataset && el.dataset.antcvPostDeleteHidden === '1') return false;
      el.style.setProperty('display', 'none', 'important');
      if (el.dataset) el.dataset.antcvPostDeleteHidden = '1';
      log('post-delete.banner.hide', '');
      return true;
    } catch (_) { return false; }
  }

  function installConsoleSuppressor() {
    var origWarn = console.warn && console.warn.bind(console);
    var origLog = console.log && console.log.bind(console);
    function isSuppressibleArgs(args) {
      try {
        var joined = '';
        for (var i = 0; i < args.length; i++) {
          var a = args[i];
          if (typeof a === 'string') joined += ' ' + a;
          else if (a && typeof a === 'object') {
            try { joined += ' ' + JSON.stringify(a); } catch (_) {}
          }
        }
        joined = joined.toLowerCase();
        for (var j = 0; j < CONSOLE_NEEDLES.length; j++) {
          if (joined.indexOf(CONSOLE_NEEDLES[j]) !== -1) return true;
        }
      } catch (_) {}
      return false;
    }
    if (origWarn) {
      console.warn = function () {
        if (postDeleteActive() && isSuppressibleArgs(arguments)) return;
        try { origWarn.apply(console, arguments); } catch (_) {}
      };
    }
    if (origLog) {
      console.log = function () {
        if (postDeleteActive() && isSuppressibleArgs(arguments)) return;
        try { origLog.apply(console, arguments); } catch (_) {}
      };
    }
  }

  function findWizardOpenButton() {
    var sels = 'button, [role="button"], a, input[type="button"], input[type="submit"]';
    var nodes;
    try { nodes = document.querySelectorAll(sels); } catch (_) { return null; }
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!isVisible(n)) continue;
      var txt = ((n.textContent || n.value || '') + '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (!txt) continue;
      for (var j = 0; j < WIZARD_BUTTON_TEXTS.length; j++) {
        if (txt.indexOf(WIZARD_BUTTON_TEXTS[j]) !== -1) return n;
      }
    }
    return null;
  }

  function isPostDeleteWizardOpen() {
    try {
      var sels = '[role="dialog"],[data-antcv-wizard],[data-antcv-modal="wizard"],[class*="wizard" i],[class*="setup" i]';
      var nodes = document.querySelectorAll(sels);
      var rx = /step\s+\d+\s+of\s+\d+|setup wizard|run wizard|tell antcv|getting started|provider selection|worker url|cloudflare/i;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (!isVisible(n)) continue;
        if (n.classList && n.classList.contains(SLIDE_CLASS)) continue;
        var r = n.getBoundingClientRect();
        if (r.width < 200 || r.height < 200) continue;
        var t = (n.textContent || '');
        if (t && rx.test(t)) return true;
      }
    } catch (_) {}
    return false;
  }

  var postDeleteAttempts = 0;
  var postDeleteMaxAttempts = 3;
  var postDeleteLastClickAt = 0;
  var POST_DELETE_CLICK_WAIT_MS = 2000;

  function postDeleteTryOpenWizard() {
    if (!postDeleteActive()) return false;
    if (isPostDeleteWizardOpen()) {
      clearPostDeleteMarker('wizard opened');
      return true;
    }
    if (postDeleteAttempts >= postDeleteMaxAttempts) return false;
    if (postDeleteLastClickAt && (Date.now() - postDeleteLastClickAt) < POST_DELETE_CLICK_WAIT_MS) return false;
    var btn = findWizardOpenButton();
    if (!btn) return false;
    postDeleteAttempts += 1;
    postDeleteLastClickAt = Date.now();
    log('post-delete.wizard.click', 'attempt#' + postDeleteAttempts);
    try { btn.click(); } catch (_) {}
    return false;
  }

  function initPostDeleteFlow() {
    if (!postDeleteActive()) return;
    log('post-delete.boot', 'active');
    try {
      console.info('[antcv-onboarding ' + VERSION + '] post-delete mode active');
    } catch (_) {}
    clearFreshUserState();
    installLocalStorageWrap();
    installConsoleSuppressor();
    // Banner suppression + wizard reopen tick.
    var startedAt = Date.now();
    (function tick() {
      if (!postDeleteActive()) return;
      if (Date.now() - startedAt > POST_DELETE_TTL_MS) return;
      try { hideBannerOnce(); } catch (_) {}
      try { postDeleteTryOpenWizard(); } catch (_) {}
      setTimeout(tick, 500);
    })();
    setTimeout(function () {
      if (postDeleteActive()) clearPostDeleteMarker('TTL hard timeout');
    }, POST_DELETE_TTL_MS + 1000);
  }

  // ────────────────────────────────────────────────────────────────
  // 16. Shared observer + tick loop
  // ────────────────────────────────────────────────────────────────
  // ────────────────────────────────────────────────────────────────
  // 16b. Step 10 overlay (writing style + visual design + formats)
  // ────────────────────────────────────────────────────────────────
  // v265: the app.js wizard goes STEP 9 → "You're ready!" — there is
  // no STEP 10 in app.js's build. This module injects a synthetic
  // STEP 10 panel as a fixed overlay after the wizard finishes (the
  // first time only, tracked in localStorage). The user reads the
  // writing-style + visual-design + section-format explanations,
  // clicks Continue, then lands on the editor.
  var STEP10_SEEN_KEY = 'antcv:onboarding:step10-seen';
  var STEP10_HOST_CLASS = 'antcv-onboarding-step10-host';
  var STEP10_MARK = 'data-antcv-onboarding-step10';

  function step10AlreadyShown() {
    try { return acceptedValue(lsGet(STEP10_SEEN_KEY)); } catch (_) { return false; }
  }

  function step10Mounted() {
    return !!document.querySelector('[' + STEP10_MARK + ']');
  }

  function injectStep10Styles() {
    if (document.getElementById('antcv-step10-style')) return;
    var st = document.createElement('style');
    st.id = 'antcv-step10-style';
    st.textContent =
      '.' + STEP10_HOST_CLASS + '{position:fixed;inset:0;z-index:2147482998;background:rgba(3,10,24,.78);padding:16px;display:flex;align-items:center;justify-content:center;pointer-events:auto;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-panel{position:relative;width:min(720px,100%);max-height:min(86vh,860px);overflow:auto;background:#263758;color:#f4f7ff;border-radius:14px;padding:28px;box-shadow:0 18px 60px rgba(0,0,0,.35);font-family:inherit;box-sizing:border-box;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-kicker{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#03d7e8;font-weight:700;margin-bottom:10px;}\n' +
      '.' + STEP10_HOST_CLASS + ' h2{margin:0 0 18px 0;font-size:24px;line-height:1.2;color:#fff;}\n' +
      '.' + STEP10_HOST_CLASS + ' h3{margin:18px 0 6px 0;font-size:15px;color:#03d7e8;font-weight:700;}\n' +
      '.' + STEP10_HOST_CLASS + ' p{margin:0 0 10px 0;line-height:1.55;font-size:14px;color:#eef3ff;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-color-row{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 12px 0;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-swatch{display:flex;align-items:center;gap:8px;font-size:12px;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-chip{width:18px;height:18px;border-radius:4px;border:1px solid rgba(255,255,255,.25);flex:0 0 auto;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;margin:8px 0 16px 0;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-tile{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.18);border-radius:8px;padding:10px;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-tile h4{margin:0 0 4px 0;font-size:13px;color:#fff;font-weight:700;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-mock{font-size:11px;color:#bcd4e0;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-actions{display:flex;justify-content:flex-end;gap:12px;margin-top:18px;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-continue{background:#0b7d88;color:#fff;border:1px solid #0b7d88;font-weight:700;padding:10px 22px;border-radius:8px;cursor:pointer;font-size:14px;min-width:140px;}\n' +
      '.' + STEP10_HOST_CLASS + ' .antcv-step10-continue:hover{background:#0e9aaa;border-color:#0e9aaa;}\n';
    document.head.appendChild(st);
  }

  function buildStep10Panel() {
    var panel = document.createElement('section');
    panel.className = 'antcv-step10-panel';
    panel.setAttribute('role', 'group');
    panel.setAttribute('aria-label', 'AntCV writing style and visual design overview');
    panel.innerHTML =
      '<div class="antcv-step10-kicker">STEP 10 \u00B7 Final overview</div>' +
      '<h2>Writing style &amp; visual design</h2>' +

      '<h3>Writing style</h3>' +
      '<p>Clear, calm, direct. Short factual sentences, concrete actions, measurable outcomes. AntCV avoids corporate filler \u2014 no "leverage", "spearhead", "ensure", "passionate about", "proven track record", "strong communicator". No "in my role\u2026" openers, no "whether in X or Y\u2026", no "key role" or "pivotal role". Bullets describe results, not duties.</p>' +

      '<h3>Visual design</h3>' +
      '<p>Two-column layout. Navy header and sidebar with teal accents. Main column on white with green section headings. Calibri body, Sans Serif Collection headings. Circular profile photo with a teal border. Max 1.5 pages.</p>' +
      '<div class="antcv-step10-color-row">' +
        '<span class="antcv-step10-swatch"><span class="antcv-step10-chip" style="background:#283556"></span> Sidebar #283556</span>' +
        '<span class="antcv-step10-swatch"><span class="antcv-step10-chip" style="background:#01B7BB"></span> Accent #01B7BB</span>' +
        '<span class="antcv-step10-swatch"><span class="antcv-step10-chip" style="background:#00746E"></span> Headings #00746E</span>' +
      '</div>' +

      '<h3>Section formats</h3>' +
      '<p>Each section can be displayed in one of seven formats. Pick the format per section in the editor.</p>' +
      '<div class="antcv-step10-grid">' +
        '<div class="antcv-step10-tile"><h4>Paragraph</h4><div class="antcv-step10-mock">Lines of prose</div></div>' +
        '<div class="antcv-step10-tile"><h4>Bullets</h4><div class="antcv-step10-mock">\u2022 \u2022 \u2022 \u2022</div></div>' +
        '<div class="antcv-step10-tile"><h4>Emoji bullets</h4><div class="antcv-step10-mock">\u2192 \u2728 \u2705 \uD83D\uDCCC</div></div>' +
        '<div class="antcv-step10-tile"><h4>Hybrid 1</h4><div class="antcv-step10-mock">Title + bullets</div></div>' +
        '<div class="antcv-step10-tile"><h4>Hybrid 2</h4><div class="antcv-step10-mock">Para + bullets</div></div>' +
        '<div class="antcv-step10-tile"><h4>Hybrid 3</h4><div class="antcv-step10-mock">Para + items</div></div>' +
        '<div class="antcv-step10-tile"><h4>Table</h4><div class="antcv-step10-mock">|cell|cell|</div></div>' +
      '</div>' +

      '<div class="antcv-step10-actions">' +
        '<button type="button" class="antcv-step10-continue">Continue</button>' +
      '</div>';

    var cont = panel.querySelector('.antcv-step10-continue');
    cont.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      try { lsSet(STEP10_SEEN_KEY, String(Date.now())); } catch (_) {}
      var host = panel.closest('.' + STEP10_HOST_CLASS);
      try { if (host) host.remove(); else panel.remove(); } catch (_) {}
      log('step10.dismissed', '');
    }, true);

    return panel;
  }

  function mountStep10() {
    if (step10Mounted()) return false;
    injectStep10Styles();
    var host = document.createElement('div');
    host.className = STEP10_HOST_CLASS;
    host.setAttribute(STEP10_MARK, '1');
    host.appendChild(buildStep10Panel());
    try { document.body.appendChild(host); } catch (_) { return false; }
    log('step10.mounted', '');
    return true;
  }

  // Decide whether to show Step 10. Conditions:
  //   - has NOT been seen before (per localStorage marker)
  //   - is NOT already mounted
  //   - the AI-notice slide is NOT currently mounted (we don't want
  //     two overlays stacked on top of each other)
  //   - the wizard has been completed (so step 10 fires AFTER the
  //     wizard finishes regardless of which path the user took:
  //     manual fill ending on "You're ready!" or JSON upload ending
  //     when app.js writes wizardCompleted=true)
  //   - the wizard is NOT currently active (we want step 10 to fire
  //     between the wizard and the main editor, not on top of an
  //     active wizard step)
  function maybeShowStep10() {
    if (step10AlreadyShown()) return;
    if (step10Mounted()) return;
    if (slideAlreadyMounted()) return;
    if (!wizardCompleted()) return;
    if (wizardActive()) return;
    mountStep10();
  }

  function tickAll() {
    try {
      // 1. State machine: returner auto-skip (cases 1/2).
      maybeSkipForReturner();
      // 2. State machine: post-skip overlay (cases 2/5/6).
      maybeShowSkipOverlay();
      // 3. AI notice gate inside an active wizard (cases 3/4 + settings re-run).
      tickAiGate();
      // 4. Section-formats card visibility guard (step10 only).
      stripSectionFormatsCardOutsideStep10();
      // 5. Formats explainer card injection — fallback for cases where
      //    the Step 10 overlay hasn't been shown yet AND the wizard's
      //    real section-formats step exists (which it currently doesn't
      //    in this app.js build).
      maybeInjectFormatsExplainer();
      // 6. Wizard upload summary recount.
      recountUploadSummary();
      // 7. Strip Gabriel's name from placeholder.
      stripPlaceholderName();
      // 8. Step 10 overlay (writing style + visual design + formats).
      maybeShowStep10();
    } catch (e) {
      log('tick.err', String(e && e.message));
    }
  }

  function init() {
    // 1. Crash handlers (install ASAP so they catch app.js startup errors).
    installCrashHandlers();
    // 2. Post-delete flow (only activates if marker present).
    initPostDeleteFlow();
    // 3. Initial run and scheduled retries.
    [0, 100, 300, 600, 1000, 1750, 3000, 6000, 12000, 25000].forEach(function (d) {
      setTimeout(tickAll, d);
    });
    setInterval(tickAll, POLL_MS);
    // 4. Single MutationObserver for everything.
    try {
      var mo = new MutationObserver(function () { setTimeout(tickAll, 0); });
      mo.observe(document.documentElement || document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'role', 'placeholder',
                          'data-antcv-wizard', 'data-antcv-modal']
      });
    } catch (_) {}
    // 5. Storage / focus / pageshow → re-tick.
    window.addEventListener('storage', function (ev) {
      if (!ev || !ev.key) return;
      if (RELAY_KEYS.indexOf(ev.key) >= 0 || ev.key === TOKEN_KEY || ev.key === EMAIL_KEY ||
          ev.key === LS_AI_ACCEPTED || ev.key === 'personalInfo' ||
          WIZARD_COMPLETED_KEYS.indexOf(ev.key) >= 0) {
        setTimeout(tickAll, 0);
      }
    });
    ['focus', 'pageshow', 'visibilitychange'].forEach(function (ev) {
      window.addEventListener(ev, function () { setTimeout(tickAll, 0); });
    });
    log('boot', VERSION);
  }

  // ────────────────────────────────────────────────────────────────
  // 17. Public API + compatibility shims
  // ────────────────────────────────────────────────────────────────
  window.AntcvOnboarding = {
    version: VERSION,
    // Consent
    aiAccepted: aiAccepted,
    markAiAccepted: markAiAccepted,
    // Wizard
    wizardCompleted: wizardCompleted,
    wizardActive: wizardActive,
    findWizardHost: findWizardHost,
    isRelayStepHost: isRelayStepHost,
    isProviderStepHost: isProviderStepHost,
    // Slide
    mountInWizard: mountInWizard,
    mountFixedOverlay: mountFixedOverlay,
    dismissSlide: dismissSlideIfMounted,
    // Crash recovery
    dismissCrashOverlays: dismissCrashOverlays,
    recoverFromCrash: recoverFromCrash,
    // Post-delete
    postDeleteActive: postDeleteActive,
    clearPostDeleteMarker: clearPostDeleteMarker,
    // Explicit-open
    setExplicitOpen: setExplicitOpen,
    clearExplicitOpen: clearExplicitOpen,
    explicitOpenActive: explicitOpenActive,
    // Diagnostics
    state: function () {
      return {
        version: VERSION,
        aiAccepted: aiAccepted(),
        wizardCompleted: wizardCompleted(),
        wizardActive: wizardActive(),
        wizardWasExplicitlySkipped: wizardWasExplicitlySkipped(),
        explicitOpenActive: explicitOpenActive(),
        postDeleteActive: postDeleteActive(),
        slideMounted: slideAlreadyMounted(),
        slideShownInThisRun: slideShownInThisRun,
        seenRelayStep: seenRelayStep,
        relayPath: relayPath(),
        hasToken: !!token(),
        relayStuckTicks: relayStuckTicks,
        inactiveTicks: inactiveTicks
      };
    },
    // v262: deeper gate diagnostic. Returns a snapshot of what the
    // AI-notice trigger logic is seeing RIGHT NOW. Run from console
    // on each wizard step to identify where the chain breaks.
    gateState: function () {
      var host = findWizardHost();
      var stepPanel = (function () {
        try { return findStepPanel(); } catch (_) { return null; }
      })();
      var heading = null;
      try {
        if (host) {
          var hs = host.querySelectorAll('h1, h2, h3');
          for (var i = 0; i < hs.length; i++) {
            if (isVisible(hs[i])) { heading = (hs[i].textContent || '').trim(); break; }
          }
        }
      } catch (_) {}
      return {
        version: VERSION,
        wizardActive: !!host,
        slideMounted: slideAlreadyMounted(),
        slideShownInThisRun: slideShownInThisRun,
        seenRelayStep: seenRelayStep,
        relayPath: relayPath(),
        aiAccepted: aiAccepted(),
        inactiveTicks: inactiveTicks,
        relayStuckTicks: relayStuckTicks,
        hostHeading: heading,
        hostIsRelay: host ? isRelayStepHost(host) : null,
        hostIsPostRelay: host ? isPostRelayStepHost(host) : null,
        stepText: stepPanel ? stepPanel.stepText : null,
        stepNumber: getVisibleWizardStepNumber()
      };
    },
    // v265: manually show or reset the Step 10 overlay. Useful for
    // letting a returning user re-read the writing-style / visual-design
    // overview from settings. mountStep10() returns true if it mounted.
    showStep10: function () { return mountStep10(); },
    resetStep10Seen: function () {
      try { lsSet(STEP10_SEEN_KEY, ''); } catch (_) {}
      return 'reset';
    },
    step10AlreadyShown: function () { return step10AlreadyShown(); },
    // v263: manually force-mount the AI notice slide. Useful from the
    // console to verify mounting works in isolation when automatic
    // triggering doesn't fire. Returns 'wizard' if mounted into the
    // wizard host, 'fixed' if fell back to the fixed overlay, or
    // 'already' if a slide was already present.
    forceMountNow: function () {
      if (slideAlreadyMounted()) return 'already';
      var host = findWizardHost();
      if (host && mountInWizard(host)) { slideShownInThisRun = true; return 'wizard'; }
      if (mountFixedOverlay()) { slideShownInThisRun = true; return 'fixed'; }
      return 'failed';
    },
    // Force a re-tick from the console.
    tick: tickAll
  };

  // Compatibility shims so existing debug scripts and any external
  // code that referenced the old globals keep working. Each shim
  // exposes only the methods/fields the predecessor actually had.
  window.AntcvAiNoticeGate253 = {
    version: VERSION,
    tick: tickAiGate,
    mountInWizard: mountInWizard,
    mountFixedOverlay: mountFixedOverlay,
    acceptConsent: function () { markAiAccepted('shim-AntcvAiNoticeGate253'); },
    dismissCrashOverlays: dismissCrashOverlays,
    recoverFromCrash: recoverFromCrash,
    localAccepted: aiAccepted,
    relayPath: relayPath
  };
  window.AntcvAiWizardSlide = {
    version: VERSION,
    scan: tickAll,
    markAccepted: function () { markAiAccepted('shim-AntcvAiWizardSlide'); },
    signOutOnly: signOutOnly,
    deleteUser: deleteUserFully
  };
  window.AntcvSkipWizardConfirmSuppressor = {
    version: VERSION,
    isSkipWizardConfirm: function (msg) {
      if (typeof msg !== 'string' || !msg) return false;
      var lower = msg.toLowerCase();
      return lower.indexOf('skip') >= 0 &&
             (lower.indexOf('wizard') >= 0 || lower.indexOf('setup') >= 0 || lower.indexOf('onboarding') >= 0) &&
             (lower.indexOf('re-open') >= 0 || lower.indexOf('reopen') >= 0 ||
              lower.indexOf('re open') >= 0 || lower.indexOf('settings') >= 0);
    }
  };
  window.AntcvPostDeleteFlow = {
    version: VERSION,
    markerAge: postDeleteMarkerAge,
    markerActive: postDeleteActive,
    clearMarker: clearPostDeleteMarker,
    forceOpenWizard: postDeleteTryOpenWizard,
    forceHideBanner: hideBannerOnce,
    forceClearFreshUserState: clearFreshUserState,
    hasAnyMeaningful: hasAnyMeaningful,
    stripToMeaningful: stripToMeaningful,
    state: function () {
      var pi = null;
      try { pi = JSON.parse(lsGet('personalInfo') || '{}'); } catch (_) {}
      return {
        attempts: postDeleteAttempts,
        clicked: postDeleteLastClickAt > 0,
        markerAgeMs: postDeleteMarkerAge(),
        markerActive: postDeleteActive(),
        wizardOpen: isPostDeleteWizardOpen(),
        personalInfoKeys: pi ? Object.keys(pi) : null,
        personalInfoHasMeaningful: hasAnyMeaningful(pi),
        wizardCompleted: lsGet('wizardCompleted')
      };
    }
  };
  window.AntcvFormatsExplainer = {
    version: VERSION,
    _injectIfApplicable: maybeInjectFormatsExplainer
  };
  window.AntcvWizardFix = {
    version: VERSION,
    _maybeSkipWizard: maybeSkipForReturner,
    _stripPlaceholderName: stripPlaceholderName,
    _recountUploadSummary: recountUploadSummary,
    _normalizePersonalInfo: normalizePersonalInfo,
    _tick: tickAll,
    _lsBool: function (k) { return acceptedValue(lsGet(k)); },
    NAME_IN_PLACEHOLDER: NAME_IN_PLACEHOLDER,
    GENERIC_PLACEHOLDER: GENERIC_PLACEHOLDER
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  try { console.debug('[antcv-onboarding] installed ' + VERSION); } catch (_) {}
})();
