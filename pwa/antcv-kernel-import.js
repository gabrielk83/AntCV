/* antcv-kernel-import.js — IMPORT UI (kernel v2 §4f, slice 3 — first piece)
 * ============================================================================
 * A self-contained import control + preview modal on top of the tested ingestion
 * engine (window.AntcvKernelIngest, antcv-kernel-ingest.js). Drop a CV
 * (.docx/.pdf/.txt or a kernel .json) → the engine extracts + structurally infers
 * + create/merges → this modal PREVIEWS the result: roles, conflicts (existing vs
 * incoming, per field, with a keep-existing / use-incoming choice — keep-both-and-
 * flag, IMPORT-CONFLICT-001), and gaps (IMPORT-GAP-001). NON-DESTRUCTIVE: "Stage"
 * writes the resolved kernel to the STANDALONE key `antcv:ingestedKernel` only — it
 * never touches the live data. Persisting to D1 user_kernel is the next slice.
 */
(function () {
  'use strict';
  var VERSION = '1.50.543-kernel-import';
  if (window.__antcvKernelImport === VERSION) return;
  window.__antcvKernelImport = VERSION;

  var STAGE_KEY = 'antcv:ingestedKernel';
  function eng() { return window.AntcvKernelIngest || null; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  function existingKernel() { try { var v = localStorage.getItem(STAGE_KEY); return v ? JSON.parse(v) : null; } catch (_) { return null; } }

  function closeModal() { var m = document.getElementById('antcv-kimport-modal'); if (m) m.remove(); }

  function renderModal(result, fileName) {
    closeModal();
    var k = result.kernel || {};
    var roles = Array.isArray(k.experience) ? k.experience : [];
    var conflicts = result.conflicts || [];
    var gaps = result.gaps || [];
    var ov = document.createElement('div');
    ov.id = 'antcv-kimport-modal';
    ov.setAttribute('data-antcv-kimport', '1');
    ov.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(20,28,45,.55);display:flex;align-items:center;justify-content:center;padding:18px;font-family:Georgia,serif;';
    var rolesHtml = roles.map(function (r) {
      return '<li style="margin:2px 0;' + (r.on === false ? 'opacity:.55;' : '') + '">' + esc(r.title || '(untitled)') + (r.company ? ' — <span style="color:#555">' + esc(r.company) + '</span>' : '') + ' <span style="color:#888;font-size:11px">' + esc((r.start || '') + (r.end ? '–' + r.end : '')) + (r.isCurrent ? ' · current' : '') + (r.on === false ? ' · hidden' : '') + '</span></li>';
    }).join('');
    var conflictsHtml = conflicts.length ? conflicts.map(function (c, ci) {
      var fields = (c.fields || []).map(function (f, fi) {
        var nm = 'kc_' + ci + '_' + fi;
        return '<div style="margin:4px 0 8px;padding:6px;border:1px solid #eed7a8;background:#fffbe9;border-radius:5px">'
          + '<div style="font-size:11px;color:#8a6d00;text-transform:uppercase;letter-spacing:.4px">' + esc(f.field) + '</div>'
          + '<label style="display:block;font-size:12px;margin-top:3px"><input type="radio" name="' + nm + '" value="existing" data-c="' + ci + '" data-f="' + esc(f.field) + '" checked> keep existing: <b>' + esc(f.existing) + '</b></label>'
          + '<label style="display:block;font-size:12px"><input type="radio" name="' + nm + '" value="incoming" data-c="' + ci + '" data-f="' + esc(f.field) + '"> use incoming: ' + esc(f.incoming) + '</label>'
          + '</div>';
      }).join('');
      return '<li style="margin:6px 0;list-style:none"><b>' + esc(c.role) + '</b>' + (c.company ? ' <span style="color:#777">(' + esc(c.company) + ')</span>' : '') + fields + '</li>';
    }).join('') : '<li style="color:#2a7">No conflicts.</li>';
    var gapsHtml = gaps.length ? gaps.map(function (g) {
      return '<li style="margin:2px 0">' + esc(g.role) + ' <span style="color:#b5651d">— missing: ' + esc((g.missing || []).join(', ')) + '</span></li>';
    }).join('') : '<li style="color:#2a7">No gaps.</li>';
    var LANGS = [['en', 'English'], ['da', 'Dansk'], ['es', 'Español'], ['zh', '中文'], ['de', 'Deutsch'], ['fr', 'Français'], ['he', 'עברית'], ['it', 'Italiano'], ['pt-BR', 'Português']];
    var active = (k.language && Array.isArray(k.language.activeDefaults) && k.language.activeDefaults.length) ? k.language.activeDefaults : [result.sourceLang || 'en'];
    var langsHtml = LANGS.map(function (l) { var on = active.indexOf(l[0]) >= 0; return '<label style="display:inline-flex;align-items:center;gap:3px;cursor:pointer"><input type="checkbox" data-antcv-lang="' + l[0] + '"' + (on ? ' checked' : '') + '> ' + esc(l[1]) + '</label>'; }).join('');
    ov.innerHTML =
      '<div role="dialog" aria-label="Import CV to kernel" style="background:#fff;max-width:680px;width:100%;max-height:86vh;overflow:auto;border-radius:10px;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,.3)">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="margin:0;font-size:17px;color:#283556">Import CV → kernel (preview)</h2><button id="antcv-kimport-x" style="border:none;background:none;font-size:20px;cursor:pointer;color:#888">×</button></div>'
      + '<p style="margin:4px 0 10px;font-size:12px;color:#555">' + esc(fileName || '') + ' · <b>' + esc(result.mode) + '</b> · ' + roles.length + ' roles · ' + conflicts.length + ' conflicts · ' + gaps.length + ' gaps · source lang: ' + esc(result.sourceLang || '?') + '</p>'
      + '<h3 style="margin:10px 0 4px;font-size:13px;color:#283556">Roles</h3><ul style="margin:0 0 8px;padding-left:18px;font-size:13px">' + rolesHtml + '</ul>'
      + '<h3 style="margin:10px 0 4px;font-size:13px;color:#8a6d00">Conflicts — choose per field (existing is kept by default; metrics never auto-overwritten)</h3><ul style="margin:0;padding:0;font-size:13px">' + conflictsHtml + '</ul>'
      + '<h3 style="margin:10px 0 4px;font-size:13px;color:#b5651d">Gaps — fill later (never invented)</h3><ul style="margin:0 0 12px;padding-left:18px;font-size:13px">' + gapsHtml + '</ul>'
      + '<h3 style="margin:10px 0 4px;font-size:13px;color:#283556">Languages to generate in (ONBOARD-LANG-001)</h3><div id="antcv-kimport-langs" style="display:flex;flex-wrap:wrap;gap:10px;font-size:12px;margin-bottom:12px;color:#333">' + langsHtml + '</div>'
      + '<div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button id="antcv-kimport-cancel" style="padding:7px 14px;border:1px solid #ccc;background:#f4f4f4;border-radius:6px;cursor:pointer">Cancel</button><button id="antcv-kimport-save" title="Apply to your CV and save it to your account (syncs to all your devices)." style="padding:7px 18px;border:none;background:#00746E;color:#fff;border-radius:6px;cursor:pointer;font-weight:700">Apply</button></div>'
      + '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#antcv-kimport-x').addEventListener('click', closeModal);
    ov.querySelector('#antcv-kimport-cancel').addEventListener('click', closeModal);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    // Apply (single action — the owner does not want a device-vs-account choice):
    // stage locally + project into personalInfo.workHistory AND persist to the
    // account (D1 user_kernel.kernel_v2) every time, so it always syncs.
    ov.querySelector('#antcv-kimport-save').addEventListener('click', function () { var k = resolveKernel(result, ov); stageLocal(k); applyToCV(k); saveToAccount(k); });
  }

  // apply the per-field radio choices (default = keep existing) onto the kernel.
  function resolveKernel(result, ov) {
    var k = JSON.parse(JSON.stringify(result.kernel || {}));
    var byId = {}; (k.experience || []).forEach(function (r, i) { byId[r.id || i] = r; });
    (result.conflicts || []).forEach(function (c, ci) {
      var inc = c._incoming || {};
      (c.fields || []).forEach(function (f, fi) {
        var sel = ov.querySelector('input[name="kc_' + ci + '_' + fi + '"]:checked');
        if (!sel || sel.value !== 'incoming') return; // keep existing (default)
        var r = byId[c.id]; if (!r) return;
        // STRUCTURED apply of the chosen incoming value per field class.
        if (f.field === 'title') { r.title = (inc.title != null ? inc.title : f.incoming); }
        else if (f.field === 'dates') { if (inc.start != null) r.start = inc.start; if (inc.end != null) r.end = inc.end; if (inc.years != null) r.years = inc.years; r.isCurrent = inc.isCurrent === true; }
        else if (f.field === 'metrics') { if (Array.isArray(inc.outcomes)) r.outcomes = inc.outcomes; if (Array.isArray(inc.proofPoints)) r.proofPoints = inc.proofPoints; }
        r._resolved = (r._resolved || []).concat([{ field: f.field, value: f.incoming }]);
      });
    });
    // ONBOARD-LANG-001: the user's chosen languages become language.activeDefaults.
    var langs = [];
    Array.prototype.slice.call(ov.querySelectorAll('input[data-antcv-lang]:checked')).forEach(function (c) { langs.push(c.getAttribute('data-antcv-lang')); });
    if (langs.length) { k.language = k.language || {}; k.language.activeDefaults = langs; if (!k.language.sourceLang) k.language.sourceLang = langs[0]; }
    return k;
  }
  function stageLocal(k) { try { localStorage.setItem(STAGE_KEY, JSON.stringify(k)); } catch (_) {} }

  // project the v2 kernel into personalInfo.workHistory — the source the generation
  // prompt (GABRIEL_BG / STORED WORK HISTORY) reads — so a REGENERATE rebuilds the CV
  // from the imported kernel. Backs up the prior workHistory first (reversible).
  function applyToCV(k) {
    var e = eng(); if (!e || !e.projectV2ToWorkHistory) return false;
    var wh = e.projectV2ToWorkHistory(k);
    if (!wh.length) { toast('Nothing to apply — the kernel has no experience roles.'); return false; }
    var pi = {}; try { pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; } catch (_) {}
    try { localStorage.setItem('antcv:workHistoryBackup', JSON.stringify({ at: Date.now(), workHistory: pi.workHistory || null })); } catch (_) {}
    pi.workHistory = wh;
    if (k && k.tenseMode) pi.tenseMode = k.tenseMode;
    if (k && k.language) pi.language = k.language;
    try { localStorage.setItem('personalInfo', JSON.stringify(pi)); } catch (_) { return false; }
    try { if (typeof window._antcvCloudWrite === 'function') window._antcvCloudWrite({ personalInfo: pi }); } catch (_) {}
    try { window.dispatchEvent(new StorageEvent('storage', { key: 'personalInfo' })); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'kernel-import' } })); } catch (_) {}
    return true;
  }

  // relay base URL (same resolution the cloud-sync sidecars use).
  function relayBase() {
    var u = (typeof window.ANTCV_RELAY_URL === 'string' ? window.ANTCV_RELAY_URL : '') ||
      (function () { try { return localStorage.getItem('proxyUrl') || localStorage.getItem('relayUrl') || ''; } catch (_) { return ''; } })();
    return String(u || '').trim().replace(/\/+$/, '');
  }
  // persist the resolved kernel to D1 user_kernel.kernel_v2 (non-destructive staging).
  async function saveToAccount(k) {
    var base = relayBase();
    if (!base) { toast('No account relay configured (Settings → API). Staged locally instead.'); return; }
    try {
      var res = await fetch(base + '/api/profile/kernel-v2', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kernel: k }),
      });
      var j = null; try { j = await res.json(); } catch (_) {}
      if (res.ok && j && j.ok) { closeModal(); toast('Saved to your account (' + (j.roles || (k.experience || []).length) + ' roles).'); }
      else if (res.status === 401) { toast('Sign in first to save to your account — staged locally.'); }
      else { toast('Save failed (' + res.status + ((j && j.error) ? ': ' + j.error : '') + ') — staged locally.'); }
    } catch (err) { toast('Save failed (' + (err && err.message || err) + ') — staged locally.'); }
  }

  function toast(msg) {
    var t = document.createElement('div');
    t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483001;background:#283556;color:#fff;padding:10px 16px;border-radius:7px;font-family:Georgia,serif;font-size:13px;box-shadow:0 6px 24px rgba(0,0,0,.3)';
    t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { try { t.remove(); } catch (_) {} }, 4200);
  }

  // public: run the pipeline on a File and preview it.
  async function runImport(file) {
    var e = eng();
    if (!e || !e.ingestFile) { toast('Import engine not ready — reload and retry.'); return null; }
    var result;
    try { result = await e.ingestFile(file, existingKernel(), {}); }
    catch (err) { toast('Import failed: ' + (err && err.message || err)); return null; }
    renderModal(result, file && file.name);
    return result;
  }

  // a small file input + a button injected once (Settings import / onboarding wire
  // onto the same runImport in the next piece).
  function ensureControl() {
    if (document.getElementById('antcv-kimport-input')) return;
    var inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'antcv-kimport-input';
    inp.accept = '.docx,.pdf,.txt,.json';
    inp.style.display = 'none';
    inp.addEventListener('change', function () { if (inp.files && inp.files[0]) runImport(inp.files[0]); inp.value = ''; });
    document.body.appendChild(inp);
  }
  function openPicker() { ensureControl(); var i = document.getElementById('antcv-kimport-input'); if (i) i.click(); }

  // Export the current/staged kernel as a SIGNED envelope (owner 2026-06-17):
  // re-uploading a signed kernel triggers a wipe + overwrite-from-scratch; an
  // unsigned JSON only merges. The marker `_antcvKernel:1` is what the upload
  // detector (antcv-data-importer.js handleJSON) gates the overwrite on.
  function exportKernel() {
    var k = existingKernel();
    if (!k || !Array.isArray(k.experience) || !k.experience.length) { toast('No kernel to export yet — build or import one first.'); return; }
    var env = { _antcvKernel: 1, version: VERSION, kernel: k };
    try {
      var blob = new Blob([JSON.stringify(env, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'antcv-kernel.json';
      document.body.appendChild(a); a.click();
      setTimeout(function () { try { URL.revokeObjectURL(a.href); a.remove(); } catch (_) {} }, 1000);
      toast('Exported a signed AntCV kernel (' + k.experience.length + ' roles). Re-uploading it overwrites from scratch.');
    } catch (e) { toast('Export failed: ' + (e && e.message || e)); }
  }

  // ── auto-sync kernel_v2 from D1 → personalInfo on login ────────────────────
  // GET the stored v2 kernel; if its signature differs from the last one applied,
  // project it into personalInfo.workHistory ONCE (backed up). A matching signature
  // means it's already applied → we leave local state alone (no fighting edits).
  var APPLIED_SIG_KEY = 'antcv:kernelV2AppliedSig';
  function kSig(k) { try { var s = JSON.stringify(k); var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return s.length + ':' + h; } catch (_) { return ''; } }
  async function autoSync() {
    var base = relayBase(); if (!base) return;
    var authed = false; try { authed = !!localStorage.getItem('antcv:auth:token'); } catch (_) {}
    if (!authed) return;
    try {
      var res = await fetch(base + '/api/profile/kernel-v2', { method: 'GET', credentials: 'include' });
      if (!res.ok) return;
      var j = null; try { j = await res.json(); } catch (_) {}
      var k = j && j.kernel; if (!k || !Array.isArray(k.experience) || !k.experience.length) return;
      var sig = kSig(k);
      var applied = ''; try { applied = localStorage.getItem(APPLIED_SIG_KEY) || ''; } catch (_) {}
      if (sig === applied) return;                       // already applied this version
      try { localStorage.setItem(STAGE_KEY, JSON.stringify(k)); } catch (_) {}
      if (applyToCV(k)) { try { localStorage.setItem(APPLIED_SIG_KEY, sig); } catch (_) {} toast('Synced your kernel from your account (' + k.experience.length + ' roles). Regenerate to rebuild.'); }
    } catch (_) {}
  }

  // ── merge the kernel-import trigger into the EXISTING import controls ───────
  // (Settings → Personal import + the onboarding wizard upload step), rather than
  // a separate floating button. Idempotent + re-applied on React re-render.
  function makeBtn() {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-kimport-btn', '1');
    b.textContent = '🧬 Build / update kernel from CV';
    b.title = 'Extract a structured kernel from a CV (.docx/.pdf/.txt) — review roles, conflicts and gaps before saving.';
    b.style.cssText = 'display:block;width:100%;padding:8px 12px;margin:6px 0;background:rgba(0,116,110,.12);border:1px solid rgba(0,116,110,.5);border-radius:6px;color:#00746E;font-size:11px;font-weight:700;cursor:pointer;text-align:center;font-family:inherit;';
    b.addEventListener('mouseenter', function () { b.style.background = 'rgba(0,116,110,.2)'; });
    b.addEventListener('mouseleave', function () { b.style.background = 'rgba(0,116,110,.12)'; });
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openPicker(); });
    return b;
  }
  function injectEntry() {
    // v1.50.540 (owner 2026-06-17): REMOVE the standalone "🧬 Build / update
    // kernel from CV" pill from the Settings menu (and everywhere) — it is the
    // "extra CV upload button". The kernel build folds into the existing upload
    // control via the #9-12 unified loader; until then we keep the engine
    // (runImport / review modal / autoSync) but inject NO separate button.
    // Also sweep up any pill a prior build already injected.
    try {
      var stale = document.querySelectorAll('[data-antcv-kimport-btn="1"]');
      for (var i = 0; i < stale.length; i++) { try { stale[i].remove(); } catch (_) {} }
    } catch (_) {}
    return;
    // eslint-disable-next-line no-unreachable
    // ---- legacy injection (disabled) ----------------------------------------
    // v1.50.531 — KERNEL-PILL-STICKY/DEDUP fix (WIZARD_SETTINGS_UX #1/#3):
    // The old anchor source #2 (broad import/upload TEXT regex) matched upload
    // affordances on multiple wizard steps (STEP 2 / 6C / language slide), so the
    // pill stuck to every stage; and two different anchors in the same Personal
    // panel each got their own button (double pill). Fix: drop the text anchor
    // entirely and de-dup at the PANEL (parent) level — at most one pill per host.
    var anchors = [];
    // 1. the data-importer's Settings replacement button (the canonical ingest btn).
    var rep = document.querySelector('[data-antcv-import-replacement]');
    if (rep) anchors.push(rep);
    // 2. profile/CV file inputs (accept pdf+doc(x) but NOT txt → not a JD input) —
    //    BUT skip the raw input when the data-importer replacement already owns the
    //    same container (else Personal gets two pills for one logical control).
    Array.prototype.slice.call(document.querySelectorAll('input[type="file"]')).forEach(function (inp) {
      var a = String(inp.getAttribute('accept') || '').toLowerCase();
      if (!(/pdf/.test(a) && /docx?/.test(a) && a.indexOf('txt') < 0)) return;
      var host = inp.closest('div');
      if (host && host.querySelector('[data-antcv-import-replacement]')) return;
      anchors.push(inp.closest('label,div') || inp.parentElement || inp);
    });
    var seenParents = (typeof Set === 'function') ? new Set() : null;
    anchors.forEach(function (anchor) {
      if (!anchor || (anchor.getAttribute && anchor.getAttribute('data-antcv-kimport-host') === '1')) return;
      var parent = anchor.parentNode; if (!parent || !parent.insertBefore) return;
      // panel-level dedup: never inject a second pill into a parent that already
      // has one (covers two anchors resolving to the same container).
      if (parent.querySelector && parent.querySelector('[data-antcv-kimport-btn="1"]')) { try { anchor.setAttribute('data-antcv-kimport-host', '1'); } catch (_) {} return; }
      if (seenParents) { if (seenParents.has(parent)) return; seenParents.add(parent); }
      try { anchor.setAttribute('data-antcv-kimport-host', '1'); } catch (_) {}
      parent.insertBefore(makeBtn(), anchor.nextSibling);
    });
  }

  var injPending = false;
  function scheduleInject() { if (injPending) return; injPending = true; (window.requestAnimationFrame || setTimeout)(function () { injPending = false; try { injectEntry(); } catch (_) {} }); }
  function boot() { ensureControl(); scheduleInject(); setTimeout(function () { try { autoSync(); } catch (_) {} }, 2500); try { new MutationObserver(scheduleInject).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {} }
  [400, 1200, 2600].forEach(function (d) { setTimeout(scheduleInject, d); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvKernelImport = { version: VERSION, runImport: runImport, openPicker: openPicker, saveToAccount: saveToAccount, applyToCV: applyToCV, autoSync: autoSync, exportKernel: exportKernel, relayBase: relayBase, _inject: injectEntry, _stageKey: STAGE_KEY };
})();
