/* antcv-recs-as-list.js — RECS-AS-LIST-001 (owner 2026-06-18)
 * ============================================================================
 * Owner: "the correct format for recommendation is a text-list: if there are
 * specific recommenders, they will by NAME / Who Was It for Me / Contact details
 * (very much like the education)." Owner chose: "Structured list, like Education."
 *
 * me() now seeds RECOMMENDATIONS as `type:"education"` (items of {deg,sch}), and
 * the education editor relabels its two fields for that section (Recommender name
 * / Who it was for, contact) and hides the GPA row. But a user whose stored
 * `sections` predate this still carries the OLD `type:"text"` recommendations
 * section. This migrates it in place: text -> education, the old `content` string
 * becoming the first row's detail under a "References" name. The owner then edits
 * it into NAME / detail rows; the editor + export already render {deg,sch}.
 *
 * Sidecar-only, restore-proof (rewrites the stored blob), idempotent (only acts
 * on a text-typed recommendations section). Loop-safe: same-blob bail +
 * write-only-on-change + own tagged event ignored.
 * Disable: localStorage['antcv:disable-recs-as-list'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvRecsAsList) return;
  window.__antcvRecsAsList = '1.50.677';

  var SRC = 'recs-as-list';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-recs-as-list'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function isRecsSection(sec) {
    if (!sec) return false;
    if (sec.id === 'recommendations') return true;
    var t = String(sec.title || '').trim().toUpperCase();
    return t === 'RECOMMENDATIONS' || t === 'REFERENCES';
  }

  // Convert a text-typed recommendations section into the education list shape.
  // Returns true if it mutated `sec`.
  function migrate(sec) {
    if (!isRecsSection(sec)) return false;
    // Already a list (education) shape -> nothing to do.
    if (sec.type === 'education' && Array.isArray(sec.items)) return false;
    if (sec.type !== 'text') return false;
    var content = typeof sec.content === 'string' ? sec.content.trim() : '';
    // Strip a leading "RECOMMENDATIONS:" / "References:" label if generation added one.
    content = content.replace(/^\s*(?:references|recommendations)\s*:\s*/i, '').trim();
    var detail = content || '[available on request - or list your referees here]';
    sec.type = 'education';
    sec.items = [{ deg: 'References', sch: detail }];
    delete sec.content;
    return true;
  }

  var lastRaw = null;
  function apply() {
    if (disabled()) return;
    try { var __ae = document.activeElement; if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ""))) return; } catch (_) {}
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = b[doc];
      if (!Array.isArray(list)) return;
      list.forEach(function (sec) { if (migrate(sec)) changed = true; });
    });
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[recs-as-list] migrated RECOMMENDATIONS text section to the education list shape'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [450, 1300, 2700].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvRecsAsList = { version: '1.50.677', _apply: apply, _migrate: migrate };
})();
