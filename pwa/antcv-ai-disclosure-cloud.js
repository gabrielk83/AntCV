/* AntCV AI disclosure cloud persistence sidecar (v1.40.210)
 * ==========================================================
 *
 * Problem fixed
 * -------------
 * The EU AI notice was accepted only in browser storage. After a cookie /
 * site-data reset, the user had to accept the same notice again even when
 * signed in. Consent is now mirrored to `/api/prefs` and restored from there
 * before / during the modal check.
 *
 * Behaviour
 * ---------
 * - Signed-in user with cloud consent: no notice; local state is restored and
 *   the existing disclosure guard dismisses the modal if it already mounted.
 * - Signed-in user accepting now: write local + cloud consent immediately.
 * - Unsigned user with no local consent: notice still appears.
 */
(function () {
  'use strict';

  if (window.__antcvAiDisclosureCloudInstalled) return;
  window.__antcvAiDisclosureCloudInstalled = '1.40.210';

  const LS_KEY = 'aiDisclosureAccepted';
  const LS_META_KEY = 'aiDisclosureAcceptedMeta';
  const TOKEN_KEY = 'antcv:auth:token';
  const EMAIL_KEY = 'antcv:auth:email';
  const FETCH_ONCE_KEY = 'antcv:ai-disclosure-cloud:last-fetch';
  const MAX_FETCH_AGE_MS = 10 * 60 * 1000;
  let cloudCheckState = 'idle'; // idle | pending | accepted | rejected

  function nowIso() { return new Date().toISOString(); }

  function readUrlKey(key) {
    let v = '';
    try { v = localStorage.getItem(key) || ''; } catch (_) {}
    try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
    return String(v || '').trim();
  }

  function getRelayBase() {
    // v1.40.210: auth writes both proxyUrl and relayUrl depending on
    // the flow. Earlier cloud persistence only checked proxyUrl, so a
    // signed-in user could still miss the cloud consent on another
    // device and see the notice a few seconds after login.
    let v = readUrlKey('proxyUrl') || readUrlKey('relayUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = window.ANTCV_RELAY_URL;
    return String(v || '').replace(/\/+$/, '');
  }

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }

  function getEmail() {
    try { return localStorage.getItem(EMAIL_KEY) || ''; } catch (_) { return ''; }
  }

  function acceptedValue(v) {
    if (v === true) return true;
    if (typeof v === 'number') return v > 0;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      return !!s && s !== 'false' && s !== '0' && s !== 'null' && s !== 'undefined' && s !== 'no';
    }
    if (v && typeof v === 'object') {
      if ('accepted' in v) return acceptedValue(v.accepted);
      if ('value' in v) return acceptedValue(v.value);
      if ('at' in v || 'acceptedAt' in v || 'timestamp' in v) return true;
    }
    return false;
  }

  function localAccepted() {
    try { if (acceptedValue(localStorage.getItem(LS_KEY))) return true; } catch (_) {}
    try {
      const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}');
      return !!(pi && (acceptedValue(pi.aiDisclosureAccepted) || acceptedValue(pi.aiDisclosure) || acceptedValue(pi.disclosureAccepted)));
    } catch (_) { return false; }
  }

  function cloudAccepted(prefs, seen) {
    if (!prefs || typeof prefs !== 'object') return false;
    seen = seen || new Set();
    if (seen.has(prefs)) return false;
    seen.add(prefs);

    if (acceptedValue(prefs.aiDisclosureAccepted)) return true;
    if (acceptedValue(prefs.euAiDisclosureAccepted)) return true;
    if (acceptedValue(prefs.ai_disclosure_accepted)) return true;
    if (acceptedValue(prefs.aiDisclosureConsent)) return true;
    if (acceptedValue(prefs.eu_ai_disclosure_consent)) return true;

    const pi = prefs.personalInfo || prefs.personal_info || {};
    if (pi && typeof pi === 'object') {
      if (acceptedValue(pi.aiDisclosureAccepted)) return true;
      if (acceptedValue(pi.aiDisclosure)) return true;
      if (acceptedValue(pi.disclosureAccepted)) return true;
    }

    // Be tolerant of relay response wrappers: {prefs:{...}},
    // {data:{...}}, {settings:{...}}, {user:{prefs:{...}}}, etc.
    const nests = [prefs.prefs, prefs.preferences, prefs.settings, prefs.data, prefs.user, prefs.account, prefs.profile, prefs.active_application];
    for (const n of nests) {
      if (n && typeof n === 'object' && cloudAccepted(n, seen)) return true;
    }
    return false;
  }

  function markLocalAccepted(source) {
    const at = nowIso();
    try { localStorage.setItem(LS_KEY, at); } catch (_) {}
    try {
      const meta = { accepted: true, acceptedAt: at, source: source || 'unknown', email: getEmail() || '' };
      localStorage.setItem(LS_META_KEY, JSON.stringify(meta));
    } catch (_) {}
    try {
      const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      pi.aiDisclosureAccepted = at;
      pi.aiDisclosure = true;
      localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch (_) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: LS_KEY, newValue: at })); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:ai-disclosure-accepted', { detail: { source: source || 'unknown', at } })); } catch (_) {}
  }

  async function writeCloudAccepted(reason) {
    const base = getRelayBase();
    const token = getToken();
    if (!base || !token) return { ok: false, reason: !base ? 'no-relay' : 'not-signed-in' };
    const at = nowIso();
    const payload = {
      aiDisclosureAccepted: at,
      euAiDisclosureAccepted: at,
      aiDisclosureAcceptedMeta: {
        accepted: true,
        acceptedAt: at,
        source: reason || 'user-click',
        email: getEmail() || ''
      },
      personalInfo: {
        aiDisclosureAccepted: at,
        aiDisclosure: true,
        disclosureAccepted: true
      }
    };
    try {
      const res = await window.fetch(base + '/api/prefs', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify(payload)
      });
      return { ok: !!(res && res.ok), status: res && res.status };
    } catch (e) {
      return { ok: false, reason: e && e.message || 'fetch-failed' };
    }
  }

  let readInFlight = null;
  async function readCloudAccepted(force) {
    const base = getRelayBase();
    const token = getToken();
    if (!base || !token) { cloudCheckState = 'idle'; return false; }
    if (!force) {
      try {
        const last = Number(sessionStorage.getItem(FETCH_ONCE_KEY) || 0);
        if (last && Date.now() - last < MAX_FETCH_AGE_MS && localAccepted()) {
          cloudCheckState = 'accepted';
          return true;
        }
      } catch (_) {}
    }
    if (readInFlight) return readInFlight;
    cloudCheckState = 'pending';
    hideVisibleDisclosureWhileChecking();
    readInFlight = (async function () {
      try {
        const res = await window.fetch(base + '/api/prefs', {
          method: 'GET',
          credentials: 'include',
          headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token }
        });
        try { sessionStorage.setItem(FETCH_ONCE_KEY, String(Date.now())); } catch (_) {}
        if (!res || !res.ok) { cloudCheckState = 'rejected'; releasePendingDisclosure('cloud-http-' + (res && res.status)); return false; }
        const prefs = await res.json().catch(function () { return null; });
        if (cloudAccepted(prefs)) {
          cloudCheckState = 'accepted';
          markLocalAccepted('cloud-restore');
          dismissVisibleDisclosure();
          try {
            if (window.AntcvEuDisclosureOrderGuard && typeof window.AntcvEuDisclosureOrderGuard._evaluate === 'function') {
              window.AntcvEuDisclosureOrderGuard._evaluate();
            }
          } catch (_) {}
          return true;
        }
        cloudCheckState = 'rejected';
        releasePendingDisclosure('not-accepted-in-cloud');
        return false;
      } catch (_) {
        cloudCheckState = 'rejected';
        releasePendingDisclosure('cloud-read-failed');
        return false;
      } finally {
        readInFlight = null;
      }
    })();
    return readInFlight;
  }

  function textOf(el, max) {
    const t = (el && el.textContent || '').trim();
    return max ? t.slice(0, max) : t;
  }

  function isDisclosureNode(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && (el.getAttribute('data-antcv-modal') === 'ai-disclosure' || el.getAttribute('data-antcv-ai-disclosure'))) return true;
    const sample = textOf(el, 900);
    return /\b(?:AI|EU\s+AI|generative\s+AI|artificial\s+intelligence)\b/i.test(sample) &&
           /\b(?:understand|accept|agree|acknowledge|notice|disclosure|continue)\b/i.test(sample);
  }

  function closestDisclosure(el) {
    let n = el;
    while (n && n !== document.body && n.nodeType === 1) {
      if (isDisclosureNode(n)) return n;
      n = n.parentElement;
    }
    const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i]');
    for (const d of dialogs) if (isDisclosureNode(d)) return d;
    return null;
  }

  function isAcceptControl(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = (el.tagName || '').toLowerCase();
    const role = (el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    if (tag !== 'button' && role !== 'button' && tag !== 'a' && tag !== 'input') return false;
    const txt = textOf(el, 80) || String(el.value || '');
    return /^(continue|accept|agree|i\s+understand|i\s+agree|ok|got\s+it|confirm|fortsæt|fortsaet|accepter|jeg\s+accepterer)$/i.test(txt.trim());
  }


  function allDisclosureNodes() {
    const out = [];
    try {
      const nodes = document.querySelectorAll('[role="dialog"], [role="alertdialog"], [class*="modal" i], [class*="overlay" i], [data-antcv-modal], [data-antcv-ai-disclosure]');
      for (const n of nodes) if (isDisclosureNode(n)) out.push(n);
    } catch (_) {}
    return out;
  }

  function findAcceptButton(modal) {
    if (!modal) return null;
    const controls = modal.querySelectorAll('button,[role="button"],a,input[type="button"],input[type="submit"]');
    for (const c of controls) if (isAcceptControl(c)) return c;
    return null;
  }

  function hideVisibleDisclosureWhileChecking() {
    // Signed-in, unknown cloud consent: keep the notice hidden while
    // the cloud read is in flight. This removes the late flash after
    // login for users who already accepted on another device.
    if (localAccepted()) return;
    if (!getToken()) return;
    for (const n of allDisclosureNodes()) {
      try {
        if (n.getAttribute('data-antcv-ai-cloud-hidden') === '1') continue;
        n.setAttribute('data-antcv-ai-cloud-hidden', '1');
        n.__antcvAiCloudDisplay = n.style.display || '';
        n.style.display = 'none';
      } catch (_) {}
    }
  }

  function releasePendingDisclosure(reason) {
    for (const n of allDisclosureNodes()) {
      try {
        if (n.getAttribute('data-antcv-ai-cloud-hidden') !== '1') continue;
        n.removeAttribute('data-antcv-ai-cloud-hidden');
        n.style.display = n.__antcvAiCloudDisplay || '';
        delete n.__antcvAiCloudDisplay;
      } catch (_) {}
    }
    try { console.debug('[ai-disclosure-cloud] released hidden disclosure:', reason); } catch (_) {}
  }

  function dismissVisibleDisclosure() {
    for (const n of allDisclosureNodes()) {
      try {
        const btn = findAcceptButton(n);
        if (btn) btn.click();
        else n.remove();
      } catch (_) {}
    }
  }

  function installCloudGateObserver() {
    try {
      const mo = new MutationObserver(function () {
        if (cloudCheckState === 'pending') hideVisibleDisclosureWhileChecking();
        else if (localAccepted()) dismissVisibleDisclosure();
      });
      mo.observe(document.body, { childList: true, subtree: true });
    } catch (_) {}
  }

  function attachAcceptCapture() {
    document.addEventListener('click', function (ev) {
      const target = ev.target && ev.target.closest ? ev.target.closest('button,[role="button"],a,input[type="button"],input[type="submit"]') : null;
      if (!target || !isAcceptControl(target)) return;
      const modal = closestDisclosure(target);
      if (!modal) return;
      markLocalAccepted('user-click');
      writeCloudAccepted('user-click').then(function (r) {
        try {
          if (!r || !r.ok) console.debug('[ai-disclosure-cloud] local consent saved; cloud write pending/failed', r);
        } catch (_) {}
      });
    }, true);
  }

  function init() {
    attachAcceptCapture();
    installCloudGateObserver();
    if (localAccepted()) {
      // Backfill older local-only consent to cloud on next signed-in session.
      writeCloudAccepted('local-backfill');
    }
    readCloudAccepted(false);
    window.addEventListener('storage', function (ev) {
      if (ev && (ev.key === TOKEN_KEY || ev.key === EMAIL_KEY || ev.key === 'relayUrl' || ev.key === 'proxyUrl')) {
        hideVisibleDisclosureWhileChecking();
        setTimeout(function () { readCloudAccepted(true); }, 0);
      }
    });
    window.addEventListener('antcv:auth-changed', function () {
      hideVisibleDisclosureWhileChecking();
      setTimeout(function () { readCloudAccepted(true); }, 0);
    });
    ['focus', 'pageshow'].forEach(function (ev) { window.addEventListener(ev, function () { readCloudAccepted(false); }); });

    // Same-window localStorage writes do not emit a storage event.
    // Poll briefly after boot so consent is fetched immediately after
    // login even if the auth sidecar does not dispatch an event.
    let lastToken = getToken();
    let polls = 0;
    const poll = setInterval(function () {
      polls += 1;
      const cur = getToken();
      if (cur && cur !== lastToken) {
        lastToken = cur;
        hideVisibleDisclosureWhileChecking();
        readCloudAccepted(true);
      } else if (cur && cloudCheckState === 'idle' && !localAccepted()) {
        readCloudAccepted(false);
      }
      if (polls > 120 || localAccepted()) clearInterval(poll);
    }, 500);

    setTimeout(function () { readCloudAccepted(false); }, 100);
    setTimeout(function () { readCloudAccepted(false); }, 500);
    setTimeout(function () { readCloudAccepted(false); }, 2000);
  }

  window.AntcvAiDisclosureCloud = {
    version: '1.40.210',
    readCloudAccepted,
    writeCloudAccepted,
    markLocalAccepted,
    localAccepted,
    _cloudAccepted: cloudAccepted
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  try { console.debug('[ai-disclosure-cloud] installed v1.40.210'); } catch (_) {}
})();
