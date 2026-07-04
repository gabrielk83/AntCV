/* antcv-role-merge-stored.js — ROLE-MERGE-STORED-001 (register row 34, owner-escalated)
 * ============================================================================
 * Owner: "the preview is not updated with regards to role merging." The
 * deterministic same-company role merge ran EXPORT-ONLY (antcv-docx-client
 * mergeSameCompanyRoles), so the PDF consolidated a candidate's multiple roles at
 * one company into a single entry while the PREVIEW still showed them separately.
 *
 * This sidecar moves the merge to STORED sections, one-shot per app+JD (STAMP-IN-
 * BLOB, mirroring antcv-sidebar-relevance-cut): it INSERTS the merged role and
 * sets the constituent roles on:false (HIDDEN, eye-reversible — never deleted), so
 * the preview shows exactly what the export shows. It reuses the EXACT export merge
 * via window.AntcvMergeSameCompanyRoles (exposed by antcv-docx-client), so preview
 * == export byte-for-byte. The docx-client export merge then becomes an idempotent
 * no-op (it sees <2 visible roles per company).
 *
 * TARGETED apps only (meta.company real + a JD present); unsolicited keeps the full
 * separate breadth. Idempotent (skips if a merged role is already present).
 * Restore-proof (the stamp travels in the sections blob; a pre-merge snapshot re-
 * arms). Eye-reversible: un-hiding a constituent lets antcv-role-merge-dedup hide
 * the merged role. Kill: localStorage['antcv:disable-role-merge-stored']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.154-role-merge-stored';
  if (window.__antcvRoleMergeStored === VERSION) return;
  window.__antcvRoleMergeStored = VERSION;

  var SRC = 'role-merge-stored';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-role-merge-stored'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function erasing() { try { return !!(localStorage.getItem('antcv:full-erase-in-progress') || localStorage.getItem('antcv:just-erased')); } catch (_) { return false; } }
  function readJson(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }
  function jdText() { try { return String(localStorage.getItem('antcv:lastJdText') || ''); } catch (_) { return ''; } }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
  function isTargeted(m) {
    var c = String((m && m.company) || '').trim();
    return !!c && !/^unsolicited$/i.test(c) && !/^open application$/i.test(c);
  }
  function clone(o) { var n = {}; for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) n[k] = o[k]; return n; }
  function coKey(r) { return String((r && r.company) || '').trim().toLowerCase(); }

  function apply() {
    if (disabled() || erasing()) return;
    try {
      if (typeof window.AntcvMergeSameCompanyRoles !== 'function') return; // docx-client not loaded yet
      var m = readJson('meta', {});
      if (!isTargeted(m)) return;                          // unsolicited keeps full breadth
      var jd = jdText();
      if (jd.trim().length < 30) return;
      var b = readJson('sections', null);
      if (!b || !Array.isArray(b.cv)) return;
      var exp = b.cv.find(function (s) { return s && s.type === 'experience' && Array.isArray(s.roles); });
      if (!exp) return;
      var stamp = String(hash('rm-v1|' + String(m.company) + '|' + String(m.role || '') + '|' + jd.slice(0, 2000)));
      if (b._roleMergeStamp === stamp) return;             // decided for this app+JD already

      // Idempotency / anti-doubling: if a stored merged role is already present,
      // do not re-merge (a merged role + an un-hidden constituent would otherwise
      // re-merge into a double). Just stamp and stop.
      if (exp.roles.some(function (r) { return r && r.__antcvStoredMergeRole; })) {
        b._roleMergeStamp = stamp; try { localStorage.setItem('sections', JSON.stringify(b)); } catch (_) {}
        return;
      }

      var out = window.AntcvMergeSameCompanyRoles(exp.roles);   // EXACT export merge
      // which companies actually merged (>=2 visible roles) + their merged entry
      var visCount = {};
      exp.roles.forEach(function (r) { if (r && r.on !== false) { var k = coKey(r); if (k) visCount[k] = (visCount[k] || 0) + 1; } });
      var mergedByCo = {};
      if (Array.isArray(out)) out.forEach(function (r) { var k = coKey(r); if (k && visCount[k] >= 2 && !mergedByCo[k]) mergedByCo[k] = r; });

      if (!Object.keys(mergedByCo).length) {                // nothing to merge
        b._roleMergeStamp = stamp; try { localStorage.setItem('sections', JSON.stringify(b)); } catch (_) {}
        return;
      }

      var newRoles = [], insertedFor = {};
      exp.roles.forEach(function (r) {
        var vis = r && r.on !== false;
        var k = vis ? coKey(r) : '';
        if (k && visCount[k] >= 2 && mergedByCo[k]) {
          if (!insertedFor[k]) {
            insertedFor[k] = true;
            var mr = clone(mergedByCo[k]);
            mr.on = true;
            mr.__antcvStoredMergeRole = true;
            mr.id = String((r.id || 'role')) + '__merged';
            newRoles.push(mr);
          }
          var hid = clone(r);
          hid.on = false;
          hid.__antcvStoredMergeHidden = true;
          newRoles.push(hid);
        } else {
          newRoles.push(r);
        }
      });

      exp.roles = newRoles;
      b._roleMergeStamp = stamp;
      try { localStorage.setItem('sections', JSON.stringify(b)); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      try { console.log('[role-merge-stored] merged same-company roles into stored sections (' + Object.keys(mergedByCo).join(', ') + ') for "' + m.company + '" — preview now matches export'); } catch (_) {}
    } catch (_) { /* self-disable */ }
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { apply(); } catch (_) {} }, 350); }
  [1400, 3200, 6500].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'meta' || e.key === 'antcv:lastJdText' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 7000);

  window.AntcvRoleMergeStored = { version: VERSION, _apply: apply, _isTargeted: isTargeted };
})();
