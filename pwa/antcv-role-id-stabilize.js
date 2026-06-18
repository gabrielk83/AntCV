/* antcv-role-id-stabilize.js — ROLE-ID-STABILIZE-001 (owner 2026-06-19)
 * ============================================================================
 * Owner: "the preview's Results are different (and repetitive) from the PDF
 * Results."
 *
 * Diagnosis: the preview computes per-role Results by running the EXPORT's
 * applyOutcomesMode (antcv-docx-client) and building a map keyed STRICTLY by role
 * `id` (`m["id:"+role.id] = role.results`), then each rendered role looks itself up
 * by `e.id`. The DOCX/PDF export instead renders `role.results` directly (no id
 * needed). So when two visible roles share the SAME id — or a role has no id — the
 * preview map collapses: one role's Results text gets shown under several roles
 * ("repetitive") and some roles show the wrong / no result ("different from PDF"),
 * while the PDF stays correct. The two-table page-2 continuation render also keys by
 * id, so a collision mis-attributes there too.
 *
 * Fix: ensure EVERY experience role has a UNIQUE, non-empty id in the stored
 * sections. The FIRST occurrence of each id is kept (so an outcome→role map and
 * page settings that already reference it stay valid); only a DUPLICATE or a
 * MISSING id is reassigned to a fresh unique value. Clean data (all ids unique) is
 * left untouched.
 *
 * Sidecar-only, restore-proof, idempotent. Loop-safe: same-blob bail +
 * write-only-on-change + own tagged event ignored + edit-guard (never rewrites
 * while the user is editing). Disable: localStorage['antcv:disable-role-id-stabilize']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvRoleIdStabilize) return;
  window.__antcvRoleIdStabilize = '1.50.693';

  var SRC = 'role-id-stabilize';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-role-id-stabilize'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function isEditing() { try { var a = document.activeElement; if (!a) return false; if (a.isContentEditable) return true; var t = (a.tagName || '').toLowerCase(); return t === 'input' || t === 'textarea' || t === 'select'; } catch (_) { return false; } }

  // Make every role id unique + non-empty. Returns true if it mutated `roles`.
  function stabilize(roles, seen) {
    if (!Array.isArray(roles)) return false;
    var changed = false;
    roles.forEach(function (r, i) {
      if (!r || typeof r !== 'object') return;
      var id = (r.id == null ? '' : String(r.id)).trim();
      if (id && !seen[id]) { seen[id] = true; return; }   // first unique id: keep
      // duplicate or missing -> assign a fresh unique id
      var base = id || ('r' + (i + 1));
      var n = 2, cand = base + '-' + n;
      while (seen[cand]) { n++; cand = base + '-' + n; }
      seen[cand] = true;
      r.id = cand;
      changed = true;
    });
    return changed;
  }

  var lastRaw = null;
  function apply() {
    if (disabled() || isEditing()) return;
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = b[doc];
      if (!Array.isArray(list)) return;
      // ids only need to be unique WITHIN a section's role list (the preview/export
      // map is per experience section), but a doc-wide set is safe and stricter.
      var seen = {};
      list.forEach(function (sec) {
        if (sec && sec.type === 'experience' && Array.isArray(sec.roles) && stabilize(sec.roles, seen)) changed = true;
      });
    });
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[role-id-stabilize] gave experience roles unique ids (preview/export Results parity)'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [400, 1200, 2600].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvRoleIdStabilize = { version: '1.50.693', _apply: apply, _stabilize: stabilize };
})();
