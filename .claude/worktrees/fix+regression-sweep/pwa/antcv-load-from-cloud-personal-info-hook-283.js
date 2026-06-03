/* AntCV Load-from-cloud hook for personalInfo (v1.40.283)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem
 * ───────
 *   Gabriel reported (2026-05-21, after v1.40.282): even pressing
 *   "Load from cloud" on the Advanced → Sync tab does NOT restore the
 *   Personal-tab fields (Full Name, Headline, Location, Citizenship,
 *   Phone, LinkedIn — Email is auto-populated from auth). The app's
 *   own Load button reports "Loaded 30 fields from cloud", but the
 *   Personal form stays empty.
 *
 *   Two candidate causes:
 *     (A) The 30 cloud fields are style / layout / routing prefs —
 *         personalInfo was never pushed (the in-app Save doesn't
 *         include it).
 *     (B) personalInfo IS in the cloud but the in-app Load doesn't
 *         apply it to the React-controlled inputs — those inputs are
 *         driven by component state, not localStorage, so a write to
 *         localStorage.personalInfo doesn't refresh them until reload.
 *
 *   This patch handles both, with a visible toast so the user sees
 *   which case applies.
 *
 * Approach
 * ────────
 *   1. Locate the "Load from cloud" button by its visible text and
 *      attach a capture-phase click handler.
 *   2. After the in-app load completes (~700 ms), re-fetch
 *      `/api/prefs` ourselves using the same auth pattern as v282 /
 *      ai-disclosure-cloud / fit-cv-cloud-sync.
 *   3. Extract personalInfo by walking the same nested paths v282
 *      walks, plus extra ones (`personal`, `profile`,
 *      `user.personal`, etc.) in case the schema differs.
 *   4. If found:
 *        • Write to localStorage.personalInfo.
 *        • Reset the v282 session flag so any subsequent reload also
 *          restores from a fresh GET.
 *        • Dispatch StorageEvent + custom event.
 *        • Locate each Personal-tab input by label/placeholder text
 *          and set its .value + dispatch input/change events so React
 *          updates its controlled state without a reload.
 *        • Toast: "Restored N personalInfo fields from cloud".
 *   5. If NOT found:
 *        • Toast: "Cloud has no personalInfo — fill in Personal and
 *          press Save to cloud to enable restore."
 *   6. If GET fails:
 *        • Toast: "Cloud fetch failed: HTTP ###".
 *
 * Also hooks "Save to cloud" — after the in-app save completes, do an
 * additional PUT that explicitly includes localStorage.personalInfo so
 * the next Load actually has it. This is the fix for case (A).
 *
 * No reload is required after either action.
 */
(function () {
  'use strict';
  var VERSION = '1.40.283';
  if (window.__antcvPersonalInfoLoadHook283 === VERSION) return;
  window.__antcvPersonalInfoLoadHook283 = VERSION;

  var TOKEN_KEY = 'antcv:auth:token';

  // ── auth helpers (same shape as v282) ────────────────────────────
  function readUrlKey(key) {
    var v = '';
    try { v = localStorage.getItem(key) || ''; } catch (_) {}
    try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
    return String(v || '').trim();
  }
  function getRelayBase() {
    var v = readUrlKey('proxyUrl') || readUrlKey('relayUrl');
    if (!v && typeof window.ANTCV_RELAY_URL === 'string') v = window.ANTCV_RELAY_URL;
    return String(v || '').replace(/\/+$/, '');
  }
  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (_) { return ''; }
  }

  // ── personalInfo extractor (widened from v282) ───────────────────
  function extractPersonalInfo(prefs, seen) {
    if (!prefs || typeof prefs !== 'object') return null;
    seen = seen || [];
    if (seen.indexOf(prefs) >= 0) return null;
    seen.push(prefs);

    // Direct hits in priority order.
    var directKeys = ['personalInfo', 'personal_info', 'personal', 'profile'];
    for (var i = 0; i < directKeys.length; i++) {
      var v = prefs[directKeys[i]];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        // Plausibility check: must have at least one personal-looking field.
        if (looksLikePersonalInfo(v)) return v;
      }
    }
    // Nested wrappers.
    var nests = [prefs.prefs, prefs.preferences, prefs.settings, prefs.data,
                 prefs.user, prefs.account, prefs.active_application];
    for (var j = 0; j < nests.length; j++) {
      var found = extractPersonalInfo(nests[j], seen);
      if (found) return found;
    }
    return null;
  }
  function looksLikePersonalInfo(obj) {
    if (!obj || typeof obj !== 'object') return false;
    var personalKeys = ['name', 'fullName', 'full_name', 'firstName', 'first_name',
                        'lastName', 'last_name', 'email', 'phone', 'location',
                        'headline', 'title', 'jobTitle', 'job_title',
                        'linkedin', 'linkedIn', 'linkedinUrl', 'citizenship'];
    for (var i = 0; i < personalKeys.length; i++) {
      if (obj.hasOwnProperty(personalKeys[i])) return true;
    }
    return false;
  }

  // ── form input pusher ────────────────────────────────────────────
  // Map personalInfo keys to label patterns visible next to the input.
  // The patterns are matched against the closest preceding <label>,
  // <span>, or text node sibling of the input, case-insensitive.
  var INPUT_LABEL_MAP = [
    { keys: ['name', 'fullName', 'full_name'],          labels: ['full name', 'name'] },
    { keys: ['headline', 'title', 'jobTitle', 'job_title'], labels: ['headline', 'job title'] },
    { keys: ['location'],                                labels: ['location'] },
    { keys: ['citizenship'],                             labels: ['citizenship'] },
    { keys: ['email'],                                   labels: ['email'] },
    { keys: ['phone'],                                   labels: ['phone'] },
    { keys: ['linkedin', 'linkedIn', 'linkedinUrl'],     labels: ['linkedin'] },
  ];

  function valueFor(pi, keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (pi[k] !== undefined && pi[k] !== null && String(pi[k]).length) return String(pi[k]);
    }
    // Compose name from first/last if needed.
    if (keys.indexOf('name') >= 0) {
      var first = pi.firstName || pi.first_name || '';
      var last  = pi.lastName  || pi.last_name  || '';
      var combined = (String(first) + ' ' + String(last)).replace(/\s+/g, ' ').trim();
      if (combined) return combined;
    }
    return null;
  }

  // Find the visible label text for a given input.
  function labelTextFor(input) {
    if (!input) return '';
    // explicit <label for="id">
    if (input.id) {
      var lab = document.querySelector('label[for="' + CSS.escape(input.id) + '"]');
      if (lab) return (lab.textContent || '').trim().toLowerCase();
    }
    // ancestor <label>
    var p = input.parentElement;
    for (var i = 0; i < 4 && p; i++, p = p.parentElement) {
      if (p.tagName === 'LABEL') return (p.textContent || '').trim().toLowerCase();
    }
    // preceding sibling label/span/text
    var node = input.previousSibling;
    while (node) {
      if (node.nodeType === 1) {
        var t = (node.textContent || '').trim();
        if (t.length) return t.toLowerCase();
      } else if (node.nodeType === 3) {
        var tt = (node.textContent || '').trim();
        if (tt.length) return tt.toLowerCase();
      }
      node = node.previousSibling;
    }
    // walk up one level and look at preceding sibling
    var parent = input.parentElement;
    if (parent) {
      var prev = parent.previousElementSibling;
      while (prev) {
        var ptxt = (prev.textContent || '').trim();
        if (ptxt && ptxt.length < 60) return ptxt.toLowerCase();
        prev = prev.previousElementSibling;
      }
    }
    // fallback: placeholder/name/aria-label
    var ph = (input.placeholder || input.name ||
              (input.getAttribute && input.getAttribute('aria-label')) || '').toLowerCase();
    return ph;
  }

  function setReactInput(input, value) {
    if (!input) return false;
    var proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    var setter = Object.getOwnPropertyDescriptor(proto, 'value');
    setter = setter && setter.set;
    if (setter) {
      setter.call(input, value);
    } else {
      input.value = value;
    }
    try { input.dispatchEvent(new Event('input',  { bubbles: true })); } catch (_) {}
    try { input.dispatchEvent(new Event('change', { bubbles: true })); } catch (_) {}
    return true;
  }

  // Push personalInfo into visible Personal-tab inputs. Returns the
  // count of fields actually written.
  function pushToForm(pi) {
    if (!pi || typeof pi !== 'object') return 0;
    var inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], input[type="url"], input:not([type]), textarea');
    var written = 0;
    var alreadySet = new Set();
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      // Skip if not visible OR if already-set in this pass.
      if (!inp.offsetParent && inp.type !== 'hidden') continue;
      if (alreadySet.has(inp)) continue;
      var label = labelTextFor(inp);
      if (!label) continue;
      for (var m = 0; m < INPUT_LABEL_MAP.length; m++) {
        var mapping = INPUT_LABEL_MAP[m];
        var matched = false;
        for (var l = 0; l < mapping.labels.length; l++) {
          if (label.indexOf(mapping.labels[l]) >= 0) { matched = true; break; }
        }
        if (!matched) continue;
        var v = valueFor(pi, mapping.keys);
        if (v === null) continue;
        // Don't clobber inputs that already have non-empty user content
        // matching the cloud value (idempotency).
        if (inp.value && inp.value === v) { alreadySet.add(inp); break; }
        // Don't clobber non-empty inputs that DIFFER from cloud — that
        // could be a local edit the user hasn't pushed yet.
        if (inp.value && inp.value.length) { alreadySet.add(inp); break; }
        if (setReactInput(inp, v)) {
          written++;
          alreadySet.add(inp);
        }
        break;
      }
    }
    return written;
  }

  // ── toast UI ─────────────────────────────────────────────────────
  function toast(message, kind) {
    try {
      var existing = document.getElementById('antcv-load-cloud-toast-283');
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      var el = document.createElement('div');
      el.id = 'antcv-load-cloud-toast-283';
      el.textContent = message;
      var bg = kind === 'error' ? '#b03030' : (kind === 'warn' ? '#a8770a' : '#00746E');
      el.setAttribute('style', [
        'position:fixed', 'left:50%', 'transform:translateX(-50%)',
        'top:max(20px, env(safe-area-inset-top, 0px) + 12px)',
        'background:' + bg, 'color:#fff', 'padding:10px 16px',
        'border-radius:8px', 'font-family:system-ui,sans-serif',
        'font-size:14px', 'font-weight:600',
        'box-shadow:0 4px 12px rgba(0,0,0,0.3)', 'z-index:99999',
        'max-width:90vw', 'text-align:center', 'pointer-events:auto'
      ].join(';'));
      (document.body || document.documentElement).appendChild(el);
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 5500);
    } catch (_) {}
  }

  // ── fetch wrapper ────────────────────────────────────────────────
  function fetchPrefs() {
    var base = getRelayBase();
    var token = getToken();
    if (!base || !token) {
      return Promise.resolve({ ok: false, status: 0, reason: 'no-auth' });
    }
    return window.fetch(base + '/api/prefs', {
      method: 'GET',
      credentials: 'include',
      headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + token },
    }).then(function (res) {
      if (!res || !res.ok) return { ok: false, status: res ? res.status : 0, reason: 'http' };
      return res.json().then(function (json) { return { ok: true, prefs: json }; })
        .catch(function () { return { ok: false, status: 0, reason: 'parse' }; });
    }).catch(function (err) {
      return { ok: false, status: 0, reason: 'network', err: err };
    });
  }

  function putPrefs(payload) {
    var base = getRelayBase();
    var token = getToken();
    if (!base || !token) return Promise.resolve({ ok: false, reason: 'no-auth' });
    return window.fetch(base + '/api/prefs', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify(payload),
    }).then(function (res) {
      return { ok: !!(res && res.ok), status: res ? res.status : 0 };
    }).catch(function () {
      return { ok: false };
    });
  }

  // ── core restore action triggered after Load click ───────────────
  function runLoadRestore(reason) {
    return fetchPrefs().then(function (r) {
      if (!r.ok) {
        if (r.reason === 'no-auth') toast('Not signed in — please sign in first.', 'warn');
        else toast('Cloud fetch failed: HTTP ' + (r.status || 'network'), 'error');
        return;
      }
      var prefs = r.prefs;
      var pi = extractPersonalInfo(prefs);
      if (!pi) {
        try {
          var keys = Object.keys(prefs || {}).slice(0, 10).join(', ');
          console.warn('[load-cloud-hook-283] no personalInfo. cloud top-level keys:', keys);
        } catch (_) {}
        toast('Cloud has no personalInfo — fill in the Personal tab and press Save to cloud.', 'warn');
        return;
      }
      // Reset v282 session flag so next reload re-fetches too.
      try { sessionStorage.removeItem('antcv:personalInfo:cloud-restored-282'); } catch (_) {}
      // Merge with what's already in localStorage; cloud fills missing.
      var localPi = {};
      try {
        var raw = localStorage.getItem('personalInfo');
        if (raw) localPi = JSON.parse(raw) || {};
      } catch (_) {}
      var merged = Object.assign({}, pi, localPi);   // local takes precedence
      // But if local field is missing/empty, take cloud value.
      Object.keys(pi).forEach(function (k) {
        var lv = localPi[k];
        if (lv === undefined || lv === null || lv === '' ||
            (Array.isArray(lv) && lv.length === 0)) {
          merged[k] = pi[k];
        }
      });
      try { localStorage.setItem('personalInfo', JSON.stringify(merged)); } catch (_) {}
      try {
        var serialized = JSON.stringify(merged);
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'personalInfo', newValue: serialized,
          storageArea: window.localStorage,
        }));
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('antcv:personal-info-restored', {
          detail: { source: 'load-cloud-hook-283', reason: reason },
        }));
      } catch (_) {}
      // Push directly into the form inputs in case React doesn't
      // observe localStorage / storage events for the Personal tab.
      var written = 0;
      // Try a few times — the Personal tab may not be fully rendered yet.
      var attempts = 0;
      function attemptPush() {
        var n = pushToForm(merged);
        if (n > 0) written = n;
        attempts++;
        if (written === 0 && attempts < 5) {
          setTimeout(attemptPush, 200);
        } else {
          var cloudCount = Object.keys(pi).filter(function (k) {
            return pi[k] !== undefined && pi[k] !== null && pi[k] !== '';
          }).length;
          if (written > 0) {
            toast('Restored ' + written + ' personalInfo fields into form (' + cloudCount + ' available from cloud).', 'success');
          } else {
            toast('Found ' + cloudCount + ' personalInfo fields in cloud. Switch to Personal tab to see them.', 'success');
          }
        }
      }
      attemptPush();
    });
  }

  // ── core save action triggered before/after Save click ───────────
  function runSavePush() {
    var pi = null;
    try {
      var raw = localStorage.getItem('personalInfo');
      if (raw) pi = JSON.parse(raw);
    } catch (_) {}
    if (!pi || typeof pi !== 'object' || Object.keys(pi).length === 0) {
      // Pull from form first so we save whatever's typed.
      pi = readFromForm();
      if (pi && Object.keys(pi).length) {
        try { localStorage.setItem('personalInfo', JSON.stringify(pi)); } catch (_) {}
      }
    }
    if (!pi || Object.keys(pi).length === 0) {
      toast('Personal tab is empty — nothing to save.', 'warn');
      return Promise.resolve();
    }
    // GET current cloud, merge our personalInfo, PUT back so we don't
    // overwrite other cloud fields.
    return fetchPrefs().then(function (r) {
      var existing = (r.ok && r.prefs) ? r.prefs : {};
      var payload = Object.assign({}, existing);
      payload.personalInfo = pi;
      return putPrefs(payload);
    }).then(function (resp) {
      if (resp.ok) {
        toast('Saved personalInfo (' + Object.keys(pi).length + ' fields) to cloud.', 'success');
      } else {
        toast('Cloud save failed: HTTP ' + (resp.status || 'network'), 'error');
      }
    });
  }

  function readFromForm() {
    var pi = {};
    for (var m = 0; m < INPUT_LABEL_MAP.length; m++) {
      var mapping = INPUT_LABEL_MAP[m];
      var inputs = document.querySelectorAll('input, textarea');
      for (var i = 0; i < inputs.length; i++) {
        var inp = inputs[i];
        if (!inp.offsetParent && inp.type !== 'hidden') continue;
        var label = labelTextFor(inp);
        if (!label) continue;
        var matched = false;
        for (var l = 0; l < mapping.labels.length; l++) {
          if (label.indexOf(mapping.labels[l]) >= 0) { matched = true; break; }
        }
        if (matched && inp.value && inp.value.length) {
          pi[mapping.keys[0]] = inp.value;
          break;
        }
      }
    }
    return pi;
  }

  // ── button hooks ─────────────────────────────────────────────────
  function clickedButtonText(ev) {
    var b = ev.target;
    // Walk up to find a button-like element.
    while (b && b !== document.body) {
      if (b.tagName === 'BUTTON' || (b.getAttribute && b.getAttribute('role') === 'button')) {
        return ((b.textContent || '').replace(/\s+/g, ' ').trim()).toLowerCase();
      }
      b = b.parentElement;
    }
    return '';
  }

  // Capture-phase listener so we catch the click before the app's own
  // handlers do anything async. We don't preventDefault — the app's
  // logic runs as normal; we just schedule our own work afterwards.
  document.addEventListener('click', function (ev) {
    var t = clickedButtonText(ev);
    if (!t) return;
    if (/\bload\s+from\s+cloud\b/.test(t)) {
      // Give the app's own GET 700ms to settle, then run our own.
      setTimeout(function () { runLoadRestore('button-click'); }, 700);
    } else if (/\bsave\s+to\s+cloud\b/.test(t)) {
      setTimeout(function () { runSavePush(); }, 700);
    }
  }, true);

  window.AntcvPersonalInfoLoadHook283 = {
    version: VERSION,
    forceRestore: function () { return runLoadRestore('manual'); },
    forceSave:    function () { return runSavePush(); },
    _extract: extractPersonalInfo,
    _pushToForm: pushToForm,
    _readFromForm: readFromForm,
  };

  try { console.debug('[load-cloud-hook-283] installed v' + VERSION); } catch (_) {}
})();
