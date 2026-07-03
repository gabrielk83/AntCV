/* AntCV Generate-button cloud sync gate (v1.40.277)
 * ──────────────────────────────────────────────────────────────────────
 * Gabriel reported that the "Generate CV & Cover Letter" kernel runs
 * on empty data: the cloud sync (both directions) is not always
 * complete when the user presses Generate, so the kernel reads
 * incomplete local state and produces empty or partial output.
 *
 * This sidecar gates the Generate button the same way
 * antcv-fit-cv-cloud-sync.js gates the Run-Fit button:
 *
 *   1. Capture-phase click interceptor on any button whose text matches
 *      /generate (cv|cover letter|application|cv & cover letter)/i.
 *   2. On click, stop propagation and run a two-way sync:
 *        (a) If localStorage holds usable data, PUT it to /api/prefs so
 *            cloud has the latest user state (defensive — covers the
 *            "saving incomplete" half of the report).
 *        (b) GET /api/prefs and merge the response into localStorage
 *            so any cloud-side state from another device is folded in.
 *        (c) Dispatch antcv:sections-updated so the React tree
 *            rehydrates from localStorage before the kernel reads it.
 *   3. Re-dispatch the click with __antcvGenerateGated=true so the
 *      handler skips re-gating and the kernel runs against fully
 *      sync'd state.
 *
 * Failure mode: if sync fails (no relay, no token, network error), we
 * still re-dispatch the click so the user isn't blocked. A toast
 * surfaces the cause. The click is only intercepted ONCE per user
 * action — the second dispatch carries the gate marker and falls
 * straight through.
 *
 * This patch never moves DOM or hides anything. The only mutations are:
 *   - localStorage writes during sync
 *   - one dispatchEvent (antcv:sections-updated)
 *   - one re-dispatched click on the same button
 *   - a transient toast div appended to body for user feedback
 */
(function () {
  'use strict';
  var VERSION = '1.51.105-meta-downgrade-guard';
  if (window.__antcvGenerateCloudSync277 === VERSION) return;
  window.__antcvGenerateCloudSync277 = VERSION;

  var TOKEN_KEY = 'antcv:auth:token';

  // ─── Storage helpers ────────────────────────────────────────────────
  function readRaw(k) { try { return localStorage.getItem(k) || ''; } catch (_) { return ''; } }
  function readJson(k, fallback) {
    try {
      var raw = localStorage.getItem(k);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) { return fallback; }
  }
  function writeRaw(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function readUrlKey(k) {
    var v = readRaw(k);
    try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
    return String(v || '').trim().replace(/\/+$/, '');
  }
  function getRelayBase() {
    var v = readUrlKey('proxyUrl') || readUrlKey('relayUrl');
    if (!v && typeof window !== 'undefined' && window.ANTCV_RELAY_URL) {
      v = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
    }
    return v;
  }
  function getAuthToken() { return readRaw(TOKEN_KEY); }

  // ─── "Usable local data" probe (same shape as fit-cv-cloud-sync) ────
  function isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function sectionUsable(s) {
    if (!isPlainObject(s)) return false;
    var itemsN = Array.isArray(s.items) ? s.items.length : 0;
    var bulletsN = Array.isArray(s.bullets) ? s.bullets.length : 0;
    var titleN = (typeof s.title === 'string') ? s.title.trim().length : 0;
    var bodyN = (typeof s.body === 'string') ? s.body.trim().length : 0;
    return itemsN > 0 || bulletsN > 0 || (titleN > 0 && bodyN > 0);
  }
  function hasUsableLocalData() {
    var bundle = readJson('sections', null);
    if (!bundle) return false;
    var list = Array.isArray(bundle) ? bundle : bundle.cv;
    if (!Array.isArray(list) || !list.length) return false;
    return list.some(sectionUsable);
  }

  // ─── Build the PUT payload from local state ─────────────────────────
  // We mirror the shape that fit-cv-cloud-sync expects to find on GET:
  // active_application.{cv_sections,cl_sections,jd_company,jd_role},
  // plus personalInfo at the top level (same shape ai-consent-cloud-sync
  // uses for its PUT). Keeping the schema identical means the existing
  // GET path can read back what we PUT without translation.
  function buildPushPayload() {
    var sections = readJson('sections', null);
    var personalInfo = readJson('personalInfo', null);
    var meta = readJson('meta', null);
    var payload = {};

    if (sections) {
      var cv = Array.isArray(sections) ? sections : sections.cv;
      var cl = (sections && !Array.isArray(sections)) ? sections.cl : null;
      var aa = {};
      var any = false;
      if (Array.isArray(cv) && cv.length) { aa.cv_sections = cv; any = true; }
      if (Array.isArray(cl) && cl.length) { aa.cl_sections = cl; any = true; }
      if (meta) {
        if (meta.company) { aa.jd_company = meta.company; any = true; }
        if (meta.role)    { aa.jd_role    = meta.role;    any = true; }
      }
      if (any) payload.active_application = aa;
    }
    if (personalInfo && isPlainObject(personalInfo)) payload.personalInfo = personalInfo;
    return payload;
  }

  // ─── Push then pull ─────────────────────────────────────────────────
  var syncInflight = null;
  function syncBothWays() {
    if (syncInflight) return syncInflight;
    syncInflight = (function () {
      return new Promise(function (resolve) {
        var base = getRelayBase();
        var tok = getAuthToken();
        if (!base) return resolve({ ok: false, pushed: false, pulled: false, reason: 'no-relay-url' });
        if (!tok)  return resolve({ ok: false, pushed: false, pulled: false, reason: 'no-auth-token' });

        var pushed = false;
        var pulled = false;
        var pullSections = 0;

        // Stage 1: PUT local → cloud (only if local has usable data, so
        // we never overwrite good cloud data with an empty local state).
        var pushPromise = Promise.resolve();
        if (hasUsableLocalData()) {
          var payload = buildPushPayload();
          if (Object.keys(payload).length) {
            pushPromise = window.fetch(base + '/api/prefs', {
              method: 'PUT',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': 'Bearer ' + tok,
              },
              body: JSON.stringify(payload),
            }).then(function (res) {
              if (res && res.ok) pushed = true;
              else try { console.debug('[generate-cloud-sync-277] PUT failed', res && res.status); } catch (_) {}
            }).catch(function (e) {
              try { console.debug('[generate-cloud-sync-277] PUT error', e && e.message); } catch (_) {}
            });
          }
        }

        // Stage 2: GET cloud → local (always, even if push skipped).
        pushPromise.then(function () {
          return window.fetch(base + '/api/prefs', {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Accept': 'application/json',
              'Authorization': 'Bearer ' + tok,
            },
          });
        }).then(function (res) {
          if (!res || !res.ok) return null;
          return res.json().catch(function () { return null; });
        }).then(function (body) {
          if (!body) return;
          // Mirror cv_sections / cl_sections back into local 'sections'.
          var aa = body.active_application;
          if (aa) {
            var cur = readJson('sections', null);
            if (!cur || (!Array.isArray(cur) && !isPlainObject(cur))) cur = { cv: [], cl: [] };
            if (Array.isArray(cur)) cur = { cv: cur, cl: [] };
            var changed = false;
            if (Array.isArray(aa.cv_sections) && aa.cv_sections.length) {
              cur.cv = aa.cv_sections;
              changed = true;
              pullSections += aa.cv_sections.length;
            }
            if (Array.isArray(aa.cl_sections) && aa.cl_sections.length) {
              cur.cl = aa.cl_sections;
              changed = true;
              pullSections += aa.cl_sections.length;
            }
            if (changed) {
              try { localStorage.setItem('sections', JSON.stringify(cur)); pulled = true; } catch (_) {}
            }
            // Mirror jd_company/jd_role into meta.
            // META-DOWNGRADE-GUARD-001 (owner 2026-07-04, the NIL revert — register
            // row 29): a stale cloud active_application must NEVER downgrade a
            // TARGETED local meta to unsolicited/empty. A live writer-probe caught
            // THIS write flipping "NIL Technology" back to "Unsolicited" mid-session
            // (the cloud row lagged the local gen); the auto-save then persisted the
            // flipped meta into the saved application row, poisoning it for every
            // later selection. Downgrade = incoming company empty/"Unsolicited"
            // while local meta carries a real company. Upgrades (unsolicited →
            // targeted) and real-company → real-company changes still mirror.
            // Kill: localStorage['antcv:disable-meta-downgrade-guard']='1'.
            if (aa.jd_company || aa.jd_role) {
              var m = readJson('meta', {}) || {};
              var __curCo = String(m.company || '').trim();
              var __inCo = String(aa.jd_company || '').trim();
              var __downgrade = __curCo && !/^unsolicited$/i.test(__curCo) &&
                                (!__inCo || /^unsolicited$/i.test(__inCo));
              var __killDg = false;
              try { __killDg = localStorage.getItem('antcv:disable-meta-downgrade-guard') === '1'; } catch (_) {}
              if (__downgrade && !__killDg) {
                try { console.log('[cloud-sync-277] META-DOWNGRADE-GUARD-001: kept local targeted meta "' + __curCo + '" (cloud offered "' + (__inCo || 'empty') + '")'); } catch (_) {}
              } else {
                if (aa.jd_company) m.company = aa.jd_company;
                if (aa.jd_role)    m.role    = aa.jd_role;
                try { localStorage.setItem('meta', JSON.stringify(m)); pulled = true; } catch (_) {}
              }
            }
          }
          // Mirror personalInfo too — relevant for kernel prompts that
          // reference the candidate's name/contact.
          // PI-MERGE-NO-CLOBBER-001 (owner 2026-07: CV-ACCESS-DROP-001 — "accessibility was seen
          // in first generation, dropped in second"). This GET runs AFTER our own PUT above, so
          // cloud SHOULD already echo back the fresh local copy — but PUT failures are swallowed
          // to a console.debug so the user is never blocked, and the GET still runs regardless. A
          // wholesale REPLACE here then clobbers every local-only field (accessibility, a just-
          // typed edit, anything not yet round-tripped) with a STALE cloud snapshot. Merge instead:
          // a real, non-empty LOCAL value always wins; cloud only FILLS a field the local copy is
          // missing — the same local-preferring merge antcv-personal-info-cloud-restore-282.js and
          // antcv-load-from-cloud-personal-info-hook-283.js already use, for this exact reason.
          if (body.personalInfo && isPlainObject(body.personalInfo)) {
            var curPi = readJson('personalInfo', {}) || {};
            var mergedPi = Object.assign({}, curPi);
            var piEmpty = function (v) { return v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length); };
            Object.keys(body.personalInfo).forEach(function (k) {
              if (piEmpty(mergedPi[k]) && !piEmpty(body.personalInfo[k])) mergedPi[k] = body.personalInfo[k];
            });
            try { localStorage.setItem('personalInfo', JSON.stringify(mergedPi)); pulled = true; } catch (_) {}
          }
        }).then(function () {
          // Notify React to rehydrate from localStorage. The same event
          // name fit-cv-cloud-sync uses, so any listener already wired
          // up by app.js picks it up.
          try {
            window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
              detail: { source: 'generate-cloud-sync-277' },
            }));
          } catch (_) {}
          resolve({
            ok: true,
            pushed: pushed,
            pulled: pulled,
            pullSections: pullSections,
            reason: 'ok',
          });
        }).catch(function (e) {
          try { console.warn('[generate-cloud-sync-277] sync error', e && e.message); } catch (_) {}
          resolve({ ok: false, pushed: pushed, pulled: pulled, reason: 'exception' });
        });
      }).then(function (r) {
        // Clear inflight one tick later so a follow-up click can retry.
        setTimeout(function () { syncInflight = null; }, 0);
        return r;
      });
    })();
    return syncInflight;
  }

  // ─── Generate-button detection ──────────────────────────────────────
  // We match the visible label rather than relying on any specific class
  // or aria attribute, since those aren't stable across the React build.
  // Pattern covers the current label "Generate CV & Cover Letter →"
  // plus likely variants. Length-gated to avoid matching long copy
  // that contains the word "Generate".
  var GENERATE_RE = /^\s*generate\b.*\b(cv|cover letter|application|cv & cover letter)/i;

  function isGenerateButton(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute && el.getAttribute('data-antcv-action') === 'generate') return true;
    var tag = (el.tagName || '').toLowerCase();
    var role = (el.getAttribute && el.getAttribute('role') || '').toLowerCase();
    if (tag !== 'button' && role !== 'button') return false;
    if (el.disabled) return false;
    var t = (el.textContent || '').trim();
    if (!t || t.length > 80) return false;
    return GENERATE_RE.test(t);
  }

  // ─── Click interception ─────────────────────────────────────────────
  function onCaptureClick(ev) {
    var btn = null;
    var path = ev.composedPath ? ev.composedPath() : [];
    for (var i = 0; i < path.length; i++) {
      if (isGenerateButton(path[i])) { btn = path[i]; break; }
    }
    if (!btn) {
      var cur = ev.target;
      while (cur && cur !== document) {
        if (isGenerateButton(cur)) { btn = cur; break; }
        cur = cur.parentNode;
      }
    }
    if (!btn) return;
    if (ev.__antcvGenerateGated) return;   // post-sync re-dispatch, let through

    ev.preventDefault();
    ev.stopImmediatePropagation();
    showToast('Syncing your data with cloud before generation…');

    syncBothWays().then(function (r) {
      if (r && r.ok) {
        var msg = 'Cloud sync complete';
        if (r.pulled) msg += ' (cloud → local: ' + r.pullSections + ' sections)';
        if (r.pushed) msg += r.pulled ? ', local → cloud' : ' (local → cloud)';
        msg += '. Running…';
        showToast(msg, 1500);
      } else {
        var reason = (r && r.reason) || 'unknown';
        if (reason === 'no-auth-token') {
          showToast('Not signed in — generating with local data only.', 2500);
        } else if (reason === 'no-relay-url') {
          showToast('Relay not configured — generating with local data only.', 2500);
        } else {
          showToast('Cloud sync failed (' + reason + ') — generating anyway.', 2500);
        }
      }
      // Give React one tick to rehydrate from the updated localStorage
      // before the kernel reads its state.
      setTimeout(function () {
        try {
          var evt = new MouseEvent('click', {
            bubbles: true, cancelable: true, view: window,
          });
          evt.__antcvGenerateGated = true;
          btn.dispatchEvent(evt);
        } catch (_) {}
      }, 0);
    });
  }

  // ─── Toast ──────────────────────────────────────────────────────────
  var toastEl = null;
  var toastTimer = null;
  function showToast(message, durationMs) {
    durationMs = durationMs || 3000;
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.setAttribute('data-antcv-generate-sync-toast', '1');
      var style = toastEl.style;
      style.position = 'fixed';
      style.bottom = '20px';
      style.left = '50%';
      style.transform = 'translateX(-50%)';
      style.zIndex = '9991';
      style.background = '#283556';
      style.color = '#fff';
      style.padding = '10px 16px';
      style.borderRadius = '6px';
      style.fontFamily = 'Trebuchet MS, Calibri, sans-serif';
      style.fontSize = '13px';
      style.fontWeight = '500';
      style.boxShadow = '0 4px 14px rgba(0,0,0,0.25)';
      style.maxWidth = '90vw';
      style.textAlign = 'center';
      style.transition = 'opacity 0.2s ease';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      if (toastEl) toastEl.style.opacity = '0';
    }, durationMs);
  }

  // ─── Install ────────────────────────────────────────────────────────
  document.addEventListener('click', onCaptureClick, true /* capture */);

  window.AntcvGenerateCloudSync277 = {
    version: VERSION,
    syncBothWays: syncBothWays,
    hasUsableLocalData: hasUsableLocalData,
    _onCaptureClick: onCaptureClick,
    _showToast: showToast,
  };

  try { console.debug('[generate-cloud-sync-277] installed ' + VERSION); } catch (_) {}
})();
