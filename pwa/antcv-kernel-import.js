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
  var VERSION = '1.50.517-kernel-import';
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
    ov.innerHTML =
      '<div role="dialog" aria-label="Import CV to kernel" style="background:#fff;max-width:680px;width:100%;max-height:86vh;overflow:auto;border-radius:10px;padding:18px 20px;box-shadow:0 10px 40px rgba(0,0,0,.3)">'
      + '<div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="margin:0;font-size:17px;color:#283556">Import CV → kernel (preview)</h2><button id="antcv-kimport-x" style="border:none;background:none;font-size:20px;cursor:pointer;color:#888">×</button></div>'
      + '<p style="margin:4px 0 10px;font-size:12px;color:#555">' + esc(fileName || '') + ' · <b>' + esc(result.mode) + '</b> · ' + roles.length + ' roles · ' + conflicts.length + ' conflicts · ' + gaps.length + ' gaps · source lang: ' + esc(result.sourceLang || '?') + '</p>'
      + '<h3 style="margin:10px 0 4px;font-size:13px;color:#283556">Roles</h3><ul style="margin:0 0 8px;padding-left:18px;font-size:13px">' + rolesHtml + '</ul>'
      + '<h3 style="margin:10px 0 4px;font-size:13px;color:#8a6d00">Conflicts — choose per field (existing is kept by default; metrics never auto-overwritten)</h3><ul style="margin:0;padding:0;font-size:13px">' + conflictsHtml + '</ul>'
      + '<h3 style="margin:10px 0 4px;font-size:13px;color:#b5651d">Gaps — fill later (never invented)</h3><ul style="margin:0 0 12px;padding-left:18px;font-size:13px">' + gapsHtml + '</ul>'
      + '<div style="display:flex;gap:10px;justify-content:flex-end"><button id="antcv-kimport-cancel" style="padding:7px 14px;border:1px solid #ccc;background:#f4f4f4;border-radius:6px;cursor:pointer">Cancel</button><button id="antcv-kimport-apply" style="padding:7px 16px;border:none;background:#00746E;color:#fff;border-radius:6px;cursor:pointer;font-weight:700">Stage kernel</button></div>'
      + '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#antcv-kimport-x').addEventListener('click', closeModal);
    ov.querySelector('#antcv-kimport-cancel').addEventListener('click', closeModal);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeModal(); });
    ov.querySelector('#antcv-kimport-apply').addEventListener('click', function () { applyResolutions(result, ov); });
  }

  // apply the per-field radio choices (default = keep existing) onto the kernel,
  // then STAGE it (non-destructive) into the standalone key.
  function applyResolutions(result, ov) {
    var k = JSON.parse(JSON.stringify(result.kernel || {}));
    var byId = {}; (k.experience || []).forEach(function (r, i) { byId[r.id || i] = r; });
    (result.conflicts || []).forEach(function (c) {
      (c.fields || []).forEach(function (f, fi) {
        var ci = (result.conflicts || []).indexOf(c);
        var sel = ov.querySelector('input[name="kc_' + ci + '_' + fi + '"]:checked');
        if (!sel || sel.value !== 'incoming') return; // keep existing (default)
        var r = byId[c.id]; if (!r) return;
        if (f.field === 'title') r.title = f.incoming;
        // dates/metrics chosen "incoming" are recorded as a pending change the user
        // confirmed; full structured apply for dates/metrics is the persistence slice.
        r._resolved = (r._resolved || []).concat([{ field: f.field, value: f.incoming }]);
      });
    });
    try { localStorage.setItem(STAGE_KEY, JSON.stringify(k)); } catch (_) {}
    closeModal();
    toast('Kernel staged (' + ((k.experience || []).length) + ' roles). Persisting to your account is the next step.');
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

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureControl, { once: true });
  else ensureControl();

  window.AntcvKernelImport = { version: VERSION, runImport: runImport, openPicker: openPicker, _stageKey: STAGE_KEY };
})();
