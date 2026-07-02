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
  window.__antcvUnsolicitedIdentityGuard = '1.51.76-patch-d';

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
  function isSpecificJob() {
    try { return String(localStorage.getItem('antcv:lastJdText') || '').trim().length >= 30; }
    catch (_) { return false; }
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

  // GEN-UNSOL-STALE-JD-001 Patch D (owner 2026-07-03, "resolve the prose-ghost class"):
  // forcing meta.company back to Unsolicited (above) fixes the HEADER, but a prior
  // targeted company's name can still be baked into the CL BODY prose (the "unsolicited
  // application went all Terma" bug). When we scrub the identity we ALSO know the exact
  // contaminating company `co`, so neutralize it in the CL prose here — the one moment
  // the prior company is known. Conservative: only the specific legal name + a
  // distinctive base token (>=4 chars), possessive-aware, CL sections only (never the CV
  // work history). Self-healing + idempotent (after the scrub the company is gone and
  // meta reads Unsolicited, so it does not re-fire).
  function escapeRx(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  var _POS = '(?:[’‘\']s)';
  function companyBase(co) {
    var s = String(co || '')
      .replace(/\b(a\/s|aps|ab|as|inc|incorporated|ltd|limited|llc|l\.l\.c|gmbh|corp|corporation|co|company|ag|s\.a|sa|n\.v|nv|b\.v|bv|oyj|oy|plc|group|holdings?|technologies|technology|systems|labs?|solutions)\b\.?/gi, ' ')
      .replace(/[.,/&]/g, ' ').replace(/\s{2,}/g, ' ').trim();
    var first = (s.split(/\s+/)[0] || '').trim();
    return first.length >= 4 ? first : '';
  }
  function neutralizeCompany(text, co) {
    var t = String(text == null ? '' : text);
    var full = String(co || '').trim();
    var base = companyBase(co);
    if (full) {
      t = t.replace(new RegExp(escapeRx(full) + _POS, 'gi'), "your organisation's");
      t = t.replace(new RegExp(escapeRx(full), 'gi'), 'your organisation');
    }
    if (base) {
      t = t.replace(new RegExp('\\b' + escapeRx(base) + _POS, 'gi'), "your organisation's");
      t = t.replace(new RegExp('\\b' + escapeRx(base) + '\\b', 'gi'), 'your organisation');
    }
    return t;
  }
  function scrubCompanyFromCl(co) {
    if (!co || isUnsolicitedLabel(co)) return;
    // 1) neutralize the company in the CL prose sections
    var secs = null; try { secs = JSON.parse(localStorage.getItem('sections') || '{}'); } catch (_) { secs = null; }
    if (secs && Array.isArray(secs.cl)) {
      var changed = false;
      var f = function (v) { if (typeof v !== 'string') return v; var n = neutralizeCompany(v, co); if (n !== v) changed = true; return n; };
      secs.cl.forEach(function (sec) {
        if (!sec || typeof sec !== 'object') return;
        if (typeof sec.content === 'string') sec.content = f(sec.content);
        if (Array.isArray(sec.items)) sec.items = sec.items.map(function (it) {
          if (it && typeof it === 'object') { if (typeof it.t === 'string') it.t = f(it.t); if (typeof it.b === 'string') it.b = f(it.b); return it; }
          return typeof it === 'string' ? f(it) : it;
        });
        if (Array.isArray(sec.rows)) sec.rows = sec.rows.map(function (row) { return Array.isArray(row) ? row.map(f) : row; });
      });
      if (changed) {
        try { localStorage.setItem('sections', JSON.stringify(secs)); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: SRC + '-company-scrub' } })); } catch (_) {}
        try { console.warn('[unsolicited-identity-guard] scrubbed prior company "' + co + '" out of the unsolicited CL prose'); } catch (_) {}
      }
    }
    // 2) purge any poisoned CL-prose-guard bucket (an unsolicited / empty-company key
    // that wrongly holds this company's prose) so it can't be re-injected.
    try {
      var store = JSON.parse(localStorage.getItem('antcv:clProseGuard') || '{}') || {};
      var probe = companyBase(co) || String(co).trim();
      var rx = new RegExp(escapeRx(probe), 'i');
      var del = false;
      Object.keys(store).forEach(function (k) {
        if (/^(unsolicited\||\|)/i.test(k) && rx.test(JSON.stringify(store[k]))) { delete store[k]; del = true; }
      });
      if (del) localStorage.setItem('antcv:clProseGuard', JSON.stringify(store));
    } catch (_) {}
  }

  var lastSeen = null;
  function apply() {
    if (disabled() || isEditing()) return;
    // Only act in an unsolicited context — never touch a real targeted app.
    if (isSpecificJob()) return;
    var meta = readMeta();
    if (!meta) return;
    var co = String(meta.company || '').trim();
    // Already clean (or no company) — nothing to do.
    if (isUnsolicitedLabel(co)) {
      // Still scrub a stray targeted activeAppCompany / rationale if present.
      scrubSidecarKeys();
      return;
    }
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
    // Patch D: the identity is forced to Unsolicited above — also strip the prior
    // company `co` out of the CL body prose (it is the one moment `co` is known).
    try { scrubCompanyFromCl(co); } catch (_) {}
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

  window.AntcvUnsolicitedIdentityGuard = { version: '1.51.76-patch-d', _apply: apply, _isSpecificJob: isSpecificJob, _isUnsolicitedLabel: isUnsolicitedLabel, _neutralizeCompany: neutralizeCompany, _companyBase: companyBase, _scrubCompanyFromCl: scrubCompanyFromCl };
})();
