/* antcv-unsolicited-identity-guard.js — UNSOLICITED-SHOWS-NVIDIA-001 (owner 2026-06-23)
 * ============================================================================
 * Owner report: an UNSOLICITED application still shows "NVIDIA" — the company
 * from a prior JD-targeted batch.
 *
 * ROOT CAUSE (confirmed via signed-in live repro): the kernel showcase cloud
 * slot (/api/kernel-showcase) is BY DEFINITION the unsolicited general CV, but a
 * prior contaminated save stored a real targeted company in its `meta`
 * (company:"NVIDIA", role:"Test Engineer - Photonic"). The kernel-restore on
 * boot (app.js, "KERNEL-CLOUD-PERSIST-001") re-injects that meta on every
 * genuinely-unsolicited load (it only bails when the LOCAL meta is already a real
 * company), so the unsolicited header reads "… @ NVIDIA". The local `meta`,
 * `antcv:activeAppCompany`, and `rationale` all carried NVIDIA while
 * `antcv:lastJdText` was empty (the JD-gated readers correctly saw "unsolicited").
 *
 * FIX: when the context is unsolicited (no real JD in antcv:lastJdText) but the
 * `meta` identity wears a real targeted company, force the identity back to the
 * canonical unsolicited values — company:"Unsolicited", role:"Open Application" —
 * and drop the stale targeted `rationale` + `antcv:activeAppCompany`. We KEEP the
 * subtitle (the candidate's own specialisation, not company-specific) and the
 * greeting/opening (already the unsolicited texts). Writing `meta` + dispatching
 * the same StorageEvent the candidate editor uses pulls the cleaned identity into
 * React state, so the app's existing kernel autosave (gated to
 * meta.company==="Unsolicited") RE-PERSISTS the cleaned slot to the cloud — the
 * contaminated slot self-heals after one load and stops re-injecting NVIDIA.
 *
 * Sidecar-only, restore-proof (re-runs after the async kernel restore settles),
 * idempotent, loop-safe (same-meta bail + own write produces a no-op next tick).
 * Disable: localStorage['antcv:disable-unsolicited-identity-guard'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvUnsolicitedIdentityGuard) return;
  window.__antcvUnsolicitedIdentityGuard = '1.51.144';

  var SRC = 'unsolicited-identity-guard';
  var META_KEY = 'meta';

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-unsolicited-identity-guard'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  // Never rewrite while the user is actively editing (steals the caret); the
  // interval catches up once focus leaves.
  function isEditing() {
    try {
      var a = document.activeElement; if (!a) return false;
      if (a.isContentEditable) return true;
      var t = (a.tagName || '').toLowerCase();
      return t === 'input' || t === 'textarea' || t === 'select';
    } catch (_) { return false; }
  }

  // A specific job means a real JD is in play (cloud-aware mirror). Short/empty
  // => unsolicited context. Same threshold the WHY-title sidecar uses.
  // AntcvJdScope transparently redirects antcv:lastJdText to the tab-namespaced
  // key, so this already reads THIS tab's JD.
  function isSpecificJob() {
    try { return String(localStorage.getItem('antcv:lastJdText') || '').trim().length >= 30; }
    catch (_) { return false; }
  }

  // TARGETING-STICK-001 (owner 2026-07-05: a Trackman gen came out Unsolicited AND
  // manually typing "Trackman" in the CL reverted to Unsolicited on Enter). Root
  // cause: this gen ran in the UNSOLICITED namespace with the JD cleared under the
  // __isUnsolicited paths, so isSpecificJob() is false even though the app is really
  // targeting Trackman — and the old "no JD => force Unsolicited" fired on the gen
  // AND on every manual company edit. Fix: the force only ever cleans a BOOT-WINDOW
  // stale kernel-restore leak (the original NVIDIA bug); an intentional real company
  // that appears interactively (a user edit or a fresh gen, i.e. AFTER boot) is
  // REMEMBERED as a durable override and never reverted again — it survives reloads.
  var OVERRIDE_KEY = 'antcv:identityOverrideCompany';
  var BOOT_MS = 5000;
  var bootAt = (function () { try { return Date.now(); } catch (_) { return 0; } })();
  function nowMs() { try { return Date.now(); } catch (_) { return bootAt; } }
  function readOverride() {
    try { return String(localStorage.getItem(OVERRIDE_KEY) || '').replace(/"/g, '').trim(); }
    catch (_) { return ''; }
  }
  function writeOverride(v) {
    try { if (v) localStorage.setItem(OVERRIDE_KEY, v); else localStorage.removeItem(OVERRIDE_KEY); }
    catch (_) {}
  }

  // A value that is NOT a real targeted company: the canonical unsolicited
  // labels (or empty). Anything else is a real employer name.
  function isUnsolicitedLabel(s) {
    return /^(unsolicited|open\s+application|n\/?a)?$/i.test(String(s || '').trim());
  }

  function readMeta() {
    try { var raw = localStorage.getItem(META_KEY); if (!raw) return null; var v = JSON.parse(raw); return v && typeof v === 'object' ? v : null; }
    catch (_) { return null; }
  }

  var lastSeen = null;
  function apply() {
    if (disabled() || isEditing()) return;
    var meta = readMeta();
    if (!meta) return;
    var co = String(meta.company || '').trim();
    // Already clean (or no company) — nothing to do. The company is unsolicited now,
    // so any remembered targeted override is stale; drop it and scrub sidecar keys.
    if (isUnsolicitedLabel(co)) {
      if (readOverride()) writeOverride('');
      scrubSidecarKeys();
      return;
    }
    // A REAL company is present. Decide: intentional targeting (respect + remember)
    // vs a boot-time stale kernel-restore leak (force clean, the original bug).
    // 1) A real JD in scope -> definitely targeted. Remember + respect.
    if (isSpecificJob()) { writeOverride(co); return; }
    // 2) It matches a remembered intentional override -> respect (survives reloads).
    var override = readOverride();
    if (override && override.toLowerCase() === co.toLowerCase()) return;
    // 3) After the boot window, a real company that appeared is an INTENTIONAL
    //    interactive change (a user edit or a fresh gen) -> remember + respect,
    //    never revert. This is what makes a manual "Trackman" edit stick.
    if ((nowMs() - bootAt) >= BOOT_MS) { writeOverride(co); return; }
    // 4) Within the boot window with no JD and no override -> a stale kernel-restore
    //    leak (UNSOLICITED-SHOWS-NVIDIA-001). Force back to the canonical unsolicited
    //    identity and self-heal the slot.
    var key = co + '|' + String(meta.role || '');
    if (key === lastSeen) return; // own write / unchanged — avoid loops

    var next = {};
    for (var k in meta) if (Object.prototype.hasOwnProperty.call(meta, k)) next[k] = meta[k];
    next.company = 'Unsolicited';
    next.role = 'Open Application';
    // subtitle (candidate specialisation) + greeting/opening (unsolicited texts) kept as-is.

    var out;
    try { out = JSON.stringify(next); localStorage.setItem(META_KEY, out); } catch (_) { return; }
    lastSeen = next.company + '|' + next.role;
    scrubSidecarKeys();
    // NOTE: scrubbing the prior company out of the CL/CV BODY prose (Patch D) lives in
    // the dedicated, employer-protected sidecar antcv-unsol-company-scrub.js (1.51.77).
    // Pull the cleaned identity into React state exactly like the candidate
    // editor does, so the top-bar chip updates AND the app's kernel autosave
    // re-persists the cleaned slot to the cloud (self-heal).
    try { window.dispatchEvent(new StorageEvent('storage', { key: META_KEY, newValue: out })); } catch (_) {}
    try { console.warn('[unsolicited-identity-guard] unsolicited context carried targeted company "' + co + '" — forced Unsolicited / Open Application (kernel slot will self-heal on autosave)'); } catch (_) {}
  }

  function scrubSidecarKeys() {
    try {
      var ac = String(localStorage.getItem('antcv:activeAppCompany') || '').replace(/"/g, '').trim();
      if (ac && !isUnsolicitedLabel(ac)) localStorage.setItem('antcv:activeAppCompany', 'Unsolicited');
    } catch (_) {}
    try { if (localStorage.getItem('rationale')) localStorage.removeItem('rationale'); } catch (_) {}
  }

  var pending = false;
  function tick() {
    if (pending) return; pending = true;
    (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} });
  }

  // After the async kernel restore settles (it awaits the cloud fetch), and on
  // any later meta/JD change.
  [600, 1600, 3200].forEach(function (d) { setTimeout(tick, d); });
  // JD-SCOPE-ISOLATION-001: react to META and to THIS tab's namespaced JD key only
  // (fallback to the base key when the scope sidecar is absent — unit tests).
  try { window.addEventListener('storage', function (e) {
    if (!e || e.key === null || e.key === META_KEY) { tick(); return; }
    var jk = (window.AntcvJdScope && window.AntcvJdScope.nsKey) ? window.AntcvJdScope.nsKey('jdText') : 'antcv:lastJdText';
    if (e.key === jk) tick();
  }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvUnsolicitedIdentityGuard = {
    version: '1.51.144', _apply: apply, _isSpecificJob: isSpecificJob,
    _isUnsolicitedLabel: isUnsolicitedLabel, _readOverride: readOverride, _writeOverride: writeOverride,
    _setBootAt: function (t) { bootAt = t; }, _bootMs: BOOT_MS,
  };
})();
