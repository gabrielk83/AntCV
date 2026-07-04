/* antcv-sidebar-group-merge-stored.js — SIDEBAR-GROUP-MERGE-STORED-001
 * ============================================================================
 * Owner: "if you have so few items in groups that can be merged (they have
 * commonality) please merge them" (SIDEBAR-GROUP-MERGE-001) — near-duplicate
 * sidebar categories ("Imaging" -> "Optics, photonics & sensing"; "Project
 * management" -> "Project & delivery management") should fold into one line.
 * That merge ran EXPORT-ONLY (antcv-docx-client _mergeSidebarGroups), so the
 * DOCX/PDF showed the folded line while the PREVIEW still showed both
 * categories separately — the same preview/export gap ROLE-MERGE-STORED-001
 * closed for same-company roles. This sidecar closes it for sidebar groups.
 *
 * Applies the EXACT export merge (window.AntcvMergeSidebarGroups, exposed by
 * antcv-docx-client.js) to EVERY sidebar section's stored `items` array, so the
 * preview renders byte-identical category folding to the export. Unconditional
 * (not gated by targeted/JD — the export merge itself is unconditional; it is
 * a pure formatting/de-duplication rule, not a targeting belt).
 *
 * The merge is naturally idempotent (folding removes the source category, so a
 * re-run finds nothing left to fold) — no stamp needed; each tick just re-runs
 * the pure fold and writes back only on an actual change. Kill switch:
 * localStorage['antcv:disable-sidebar-group-merge-stored']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.159-sidebar-group-merge-stored';
  if (window.__antcvSidebarGroupMergeStored === VERSION) return;
  window.__antcvSidebarGroupMergeStored = VERSION;

  var SRC = 'sidebar-group-merge-stored';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-sidebar-group-merge-stored'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function erasing() { try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); } catch (_) { return false; } }
  function readJson(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }

  function apply() {
    if (disabled() || erasing()) return;
    try {
      if (typeof window.AntcvMergeSidebarGroups !== 'function') return; // docx-client not loaded yet
      var b = readJson('sections', null);
      if (!b || !Array.isArray(b.cv)) return;
      var changed = false;
      var cv = b.cv.map(function (s) {
        if (!s || s.loc !== 'sidebar' || !Array.isArray(s.items)) return s;
        var merged = window.AntcvMergeSidebarGroups(s.items);
        if (merged === s.items) return s;
        changed = true;
        var ns = {}; for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) ns[k] = s[k];
        ns.items = merged;
        return ns;
      });
      if (!changed) return;
      b.cv = cv;
      try { localStorage.setItem('sections', JSON.stringify(b)); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      try { console.log('[sidebar-group-merge-stored] folded near-duplicate sidebar categories into stored sections — preview now matches export'); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { apply(); } catch (_) {} }, 350); }
  [1400, 3200, 6500].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 7000);

  window.AntcvSidebarGroupMergeStored = { version: VERSION, _apply: apply };
})();
