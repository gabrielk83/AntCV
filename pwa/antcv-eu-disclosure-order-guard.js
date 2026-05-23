/* AntCV eu-disclosure-order-guard sidecar (v1.40.219)
 * ============================================================
 *
 * Purpose
 * -------
 * The EU AI disclosure modal currently pops on the loading page,
 * before the onboarding wizard and the setup page. Gabriel's
 * desired flow on 2026-05-19:
 *
 *   loading → wizard → setup → EU AI disclosure
 *
 * v1.40.219 sharpening
 * --------------------
 * v1.40.197 only deferred when a wizard or setup modal was visibly
 * mounted. For returning users where the disclosure was already
 * accepted in a prior session (cloud-restore shows
 * `aiDisclosureAccepted` populated), app.js still re-shows the
 * modal because its mount logic doesn't consult the cloud value.
 *
 * Two changes in v1.40.219:
 *
 *   1. Auto-dismiss: if `aiDisclosureAccepted` is present in
 *      localStorage with a truthy / non-empty value, OR the
 *      cloud-restore log line has fired in this session, click the
 *      modal's accept button automatically (silently). The user
 *      already consented; re-prompting is noise.
 *
 *   2. Widened wizard detection: more permissive heading patterns
 *      so common onboarding/setup titles are recognised.
 *
 * Strategy (unchanged from v1.40.197 except where noted)
 * ------------------------------------------------------
 * Watch for the EU AI disclosure modal mounting. Resolution order:
 *
 *   a. If `aiDisclosureAccepted` is set → auto-dismiss (click
 *      accept button or simulate consent).
 *   b. Else, if wizard or setup is currently visible → defer
 *      until they close.
 *   c. Else, if early-boot (< 4 s) AND no personalInfo.name →
 *      defer briefly.
 *   d. Else → let through.
 *
 * Fail-safe at 30 s un-defers any queued modal so consent is never
 * permanently blocked.
 */
(function () {
  'use strict';

  if (window.__antcvEuDisclosureOrderGuardInstalled) return;
  window.__antcvEuDisclosureOrderGuardInstalled = '1.40.219';

  const BOOT_AT = Date.now();
  const FAIL_SAFE_MS = 5 * 60_000;
  const WORKER_KEYS = ['proxyUrl', 'relayUrl', 'antcv:relayUrl', 'antcv:proxyUrl'];

  // ─── Heuristic detectors ─────────────────────────────────────────
  function textOf(el, max) {
    if (!el) return '';
    const t = (el.textContent || '').trim();
    return max ? t.slice(0, max) : t;
  }

  function isEuDisclosureModal(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && el.getAttribute('data-antcv-modal') === 'ai-disclosure') return true;
    if (el.getAttribute && el.getAttribute('data-antcv-ai-disclosure')) return true;
    // Heuristic match on inner text. We require AI vocabulary AND
    // consent/disclosure vocabulary, so we don't catch the JD modal
    // or other "AI"-mentioning panels.
    const sample = textOf(el, 800);
    if (!sample) return false;
    const hasAi = /\b(?:AI|EU\s+AI|generative\s+AI|AI\s+act|artificial\s+intelligence)\b/i.test(sample);
    const hasDisclosure = /\b(?:disclosure|consent|acknowledge|agree|accept|notice|understand|aware)\b/i.test(sample);
    return hasAi && hasDisclosure;
  }

  function isWizardModal(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && (
      el.getAttribute('data-antcv-modal') === 'wizard' ||
      el.getAttribute('data-antcv-wizard') !== null
    )) return true;
    const head = el.querySelector('h1, h2, h3, [role="heading"]');
    const t = textOf(head, 100) || textOf(el, 240);
    // Widened in v1.40.219.
    return /(welcome\b|onboarding|setup\s+wizard|getting\s+started|let's\s+get\s+started|new\s+to\s+ant\s*cv|first\s+steps|tell\s+us\s+about|introduction\b|step\s+\d+\s+of)/i.test(t);
  }

  function isSetupPage(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && (
      el.getAttribute('data-antcv-page') === 'setup' ||
      el.getAttribute('data-antcv-setup') !== null
    )) return true;
    const head = el.querySelector('h1, h2, h3, [role="heading"]');
    const t = textOf(head, 100);
    // Widened in v1.40.219.
    return /^(setup\b|configuration\b|configure\b|first[\s-]?run|initial\s+setup|personal\s+info|profile\s+setup|your\s+profile|tell\s+us|enter\s+your)/i.test(t);
  }

  function isVisible(el) {
    if (!el) return false;
    try {
      const cs = el.ownerDocument && el.ownerDocument.defaultView
        ? el.ownerDocument.defaultView.getComputedStyle(el) : null;
      if (!cs) return true;
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (parseFloat(cs.opacity || '1') === 0) return false;
      return (el.offsetWidth > 0 || el.offsetHeight > 0);
    } catch (_) { return true; }
  }

  function anyVisible(predicate) {
    const cands = document.querySelectorAll(
      '[role="dialog"], [role="alertdialog"], [class*="modal" i], ' +
      '[class*="overlay" i], [data-antcv-wizard], [data-antcv-setup], ' +
      '[data-antcv-page]'
    );
    for (const c of cands) {
      if (!isVisible(c)) continue;
      if (predicate(c)) return c;
    }
    return null;
  }

  // ─── Personal-info maturity check ────────────────────────────────
  function personalInfoHasName() {
    try {
      const raw = localStorage.getItem('personalInfo');
      if (!raw) return false;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return false;
      const fn = String(obj.name || obj.firstName || '').trim();
      return fn.length >= 2;
    } catch (_) { return false; }
  }

  // ─── v1.40.219: Previously-accepted detection ────────────────────
  // We treat the disclosure as previously accepted if ANY of:
  //   - localStorage.aiDisclosureAccepted is non-empty and not "false"
  //   - localStorage.aiDisclosureAccepted contains a date or "accepted"
  //   - personalInfo.aiDisclosure / personalInfo.disclosureAccepted truthy
  function disclosurePreviouslyAccepted() {
    try {
      const raw = localStorage.getItem('aiDisclosureAccepted');
      if (raw && raw !== 'false' && raw !== 'null' && raw !== '0') return true;
    } catch (_) {}
    try {
      const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}');
      if (pi && (pi.aiDisclosure || pi.disclosureAccepted || pi.aiDisclosureAccepted)) return true;
    } catch (_) {}
    return false;
  }

  // Find the accept button inside a disclosure modal. We look for
  // common labels in EN and DA. Returns the first visible match.
  function findAcceptButton(modal) {
    if (!modal) return null;
    const buttons = modal.querySelectorAll('button, [role="button"], a[role="button"]');
    const ACCEPT_RE = /^(accept|agree|i\s+understand|i\s+agree|continue|ok|got\s+it|confirm|jeg\s+accepterer|accepter|fortsæt|fortsaet)$/i;
    let primary = null, secondary = null;
    for (const b of buttons) {
      if (!isVisible(b)) continue;
      const txt = (b.textContent || '').trim();
      if (!txt) continue;
      if (ACCEPT_RE.test(txt)) {
        // Primary CTA styling? Look for "primary"/"cta" class, or
        // it's the first matching button.
        const cls = (typeof b.className === 'string' ? b.className : '').toLowerCase();
        if (/primary|cta|accept|confirm|main/i.test(cls)) {
          primary = b; break;
        }
        if (!secondary) secondary = b;
      }
    }
    return primary || secondary;
  }

  function autoAcceptDisclosure(modal) {
    const btn = findAcceptButton(modal);
    if (!btn) {
      try { console.debug('[eu-disclosure-order-guard] disclosure shown but no accept button found — leaving visible'); } catch (_) {}
      return false;
    }
    try {
      btn.click();
      try { console.debug('[eu-disclosure-order-guard] auto-accepted disclosure (was previously consented)'); } catch (_) {}
      return true;
    } catch (e) {
      try { console.warn('[eu-disclosure-order-guard] auto-accept click failed:', e && e.message); } catch (_) {}
      return false;
    }
  }



  // v1.40.219: The disclosure must not interrupt first-run setup before
  // the user has chosen / entered the Worker URL. If the user erased data
  // and starts from scratch, app.js can mount the AI disclosure timer while
  // the wizard is still asking for cloud/worker setup. Keep the disclosure
  // queued until worker setup is present, then release only after the
  // setup/wizard layer is gone so the modal does not sit on top of the
  // worker-selection step.
  function cleanStoredUrl(v) {
    try { if (v && v.charAt && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
    return String(v || '').trim();
  }

  function hasWorkerSelection() {
    try {
      if (typeof window.ANTCV_RELAY_URL === 'string' && cleanStoredUrl(window.ANTCV_RELAY_URL)) return true;
      if (typeof window.ANTCV_DOCX_WORKER === 'string' && cleanStoredUrl(window.ANTCV_DOCX_WORKER)) return true;
    } catch (_) {}
    try {
      for (const k of WORKER_KEYS) {
        if (cleanStoredUrl(localStorage.getItem(k))) return true;
      }
      // Some builds write the selected worker into personalInfo/settings.
      const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      if (cleanStoredUrl(pi.proxyUrl || pi.relayUrl || pi.workerUrl || pi.docxWorkerUrl)) return true;
    } catch (_) {}
    return false;
  }

  function wizardStillNeedsWorker() {
    if (hasWorkerSelection()) return false;
    const wiz = anyVisible(isWizardModal) || anyVisible(isSetupPage);
    if (!wiz) return false;
    const t = textOf(wiz, 1600);
    // Keep broad: first-run setup copy varies between builds, but these
    // words consistently identify the worker/cloud step.
    return /worker|cloud|sync|sign\s*in|account|relay|proxy|setup|configure/i.test(t) || !personalInfoHasName();
  }

  // ─── Modal hiding ────────────────────────────────────────────────
  function hideDisclosure(el) {
    if (!el) return;
    if (el.getAttribute('data-antcv-disclosure-deferred') === '1') return;
    el.setAttribute('data-antcv-disclosure-deferred', '1');
    el.__antcvOriginalDisplay = el.style.display || '';
    el.style.display = 'none';
    try { console.debug('[eu-disclosure-order-guard] deferred AI disclosure modal — waiting for wizard/setup'); } catch (_) {}
  }

  function unhideDisclosure(el, reason) {
    if (!el) return;
    if (el.getAttribute('data-antcv-disclosure-deferred') !== '1') return;
    el.removeAttribute('data-antcv-disclosure-deferred');
    try {
      el.style.display = el.__antcvOriginalDisplay || '';
      delete el.__antcvOriginalDisplay;
    } catch (_) {}
    try { console.debug('[eu-disclosure-order-guard] releasing AI disclosure modal —', reason); } catch (_) {}
  }

  // ─── Main loop ───────────────────────────────────────────────────
  let queued = [];

  function evaluate() {
    const disc = anyVisible(isEuDisclosureModal);
    if (!disc) {
      // No visible disclosure. Release any queued ones if conditions clear.
      const wiz = anyVisible(isWizardModal);
      const setup = anyVisible(isSetupPage);
      const allClear = !wiz && !setup;
      const workerReady = hasWorkerSelection();
      const failSafe = (Date.now() - BOOT_AT) > FAIL_SAFE_MS;
      // Do not release a queued first-run disclosure before the worker/cloud
      // stage has been handled. The long fail-safe is only for non-wizard
      // dead states, not for an active setup wizard.
      if (allClear && (workerReady || personalInfoHasName() || failSafe)) {
        for (let i = queued.length - 1; i >= 0; i--) {
          const el = queued[i];
          if (!el || !el.isConnected) { queued.splice(i, 1); continue; }
          unhideDisclosure(el, failSafe && !workerReady ? 'fail-safe' : 'worker-stage-done');
          queued.splice(i, 1);
        }
      }
      return;
    }

    // 1. Auto-accept if previously consented.
    if (disclosurePreviouslyAccepted()) {
      // Wait one frame so the modal's own mount-side logic settles,
      // then click.
      requestAnimationFrame(function () {
        if (!isVisible(disc)) return; // app.js may dismiss it itself
        autoAcceptDisclosure(disc);
      });
      return;
    }

    // 2. Defer through the worker/cloud selection stage on first run.
    const wiz = anyVisible(isWizardModal);
    const setup = anyVisible(isSetupPage);
    if (wizardStillNeedsWorker()) {
      hideDisclosure(disc);
      if (queued.indexOf(disc) < 0) queued.push(disc);
      return;
    }

    // 3. Defer while wizard/setup is open. This keeps the disclosure from
    // blocking fields/buttons in the middle of onboarding, including the
    // worker-selection and cloud-data steps.
    if (wiz || setup) {
      hideDisclosure(disc);
      if (queued.indexOf(disc) < 0) queued.push(disc);
      return;
    }

    // 4. Defer during early boot if no name yet (wizard may still mount).
    const earlyBoot = (Date.now() - BOOT_AT) < 4000;
    if (earlyBoot && !personalInfoHasName()) {
      hideDisclosure(disc);
      if (queued.indexOf(disc) < 0) queued.push(disc);
      return;
    }

    // 5. Otherwise let through.
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { evaluate(); } catch (_) {}
    });
  }

  schedule();
  [100, 250, 500, 1000, 1500, 3000, 6000, 12000, FAIL_SAFE_MS + 500]
    .forEach(function (d) { setTimeout(schedule, d); });

  try {
    const mo = new MutationObserver(function (records) {
      for (const r of records) {
        if (r.addedNodes && r.addedNodes.length) { schedule(); return; }
        if (r.removedNodes && r.removedNodes.length) { schedule(); return; }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === 'aiDisclosureAccepted') schedule();
  });

  // Public API.
  window.AntcvEuDisclosureOrderGuard = {
    version: '1.40.220',
    _evaluate: evaluate,
    _isEuDisclosureModal: isEuDisclosureModal,
    _isWizardModal: isWizardModal,
    _isSetupPage: isSetupPage,
    _personalInfoHasName: personalInfoHasName,
    _disclosurePreviouslyAccepted: disclosurePreviouslyAccepted,
    _hasWorkerSelection: hasWorkerSelection,
    _wizardStillNeedsWorker: wizardStillNeedsWorker,
    _findAcceptButton: findAcceptButton,
    _autoAcceptDisclosure: autoAcceptDisclosure,
    _queued: queued,
  };

  try { console.debug('[eu-disclosure-order-guard] installed v1.40.220'); } catch (_) {}
})();
