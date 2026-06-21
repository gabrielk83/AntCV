/* antcv-sidebar-repopulate-758.js — SIDEBAR-REPOPULATE-001 (owner 2026-06-22).
 * ============================================================================
 * Owner reported Tools & Methods / Regulatory Context / Interests coming up EMPTY after the
 * rich_block migrations. The empties are not reproducible from clean data — they come from an
 * earlier buggy migration version that BLANKED the section items (then cloud-synced the empty).
 *
 * Fix per owner ("find how to push the data PROPERLY"): personalInfo is the source of truth. If a
 * known sidebar section's items are MISSING / empty / all-placeholder, RE-DERIVE them from
 * personalInfo — in whatever SHAPE the section currently is (labeled_list/list keep the raw shape;
 * a rich_block section gets {grp}/{b,t}/{t} rows). The downstream pipeline (763 conversion, the 415
 * additional→Interests/Languages/Accessibility split) then proceeds normally, so nothing stays empty.
 *
 * Only ever WRITES when the section is empty — never clobbers a populated section or a user edit.
 * Idempotent + self-disabling on error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.767';
  if (window.__antcvSidebarRepopulate758 === VERSION) return;
  window.__antcvSidebarRepopulate758 = VERSION;

  // section id -> personalInfo field holding the source data.
  var FIELD = { tools: 'tools', regulatory: 'regulatory', certs: 'certifications', additional: 'additional' };

  function readJSON(k) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v; } catch (_) { return null; } }
  function pinfo() { var p = readJSON('personalInfo') || {}; return (p && p.personalInfo) ? p.personalInfo : p; }
  function isPlaceholder(s) { return /^\s*\[[^\]]*\]\s*$/.test(String(s || '')); }
  function rowContent(it) {
    if (it == null) return '';
    if (typeof it === 'string') return it;
    if (typeof it === 'object') return String(it.group || it.subhead || it.header || it.category || '') + String(it.l || it.label || '') + String(it.v || it.value || '') + String(it.b || '') + String(it.t || '');
    return String(it);
  }
  function isEmptySection(items) {
    if (!Array.isArray(items) || !items.length) return true;
    return items.every(function (it) { var c = rowContent(it).trim(); return !c || isPlaceholder(c); });
  }
  // Map a personalInfo source item into the TARGET section's shape.
  function toShape(it, type) {
    if (type === 'rich_block') {
      if (it && typeof it === 'object') {
        var g = it.group != null ? it.group : (it.subhead != null ? it.subhead : (it.header != null ? it.header : it.category));
        if (g != null) return { grp: true, t: String(g) };
        var lab = String(it.l || it.label || '');
        if (lab && !(it.v || it.value)) return { grp: false, b: lab, t: '' };
        return { b: lab, t: String(it.v || it.value || '') };
      }
      return { b: '', t: String(it || '') };
    }
    return it; // labeled_list / list keep the raw {l,v}/{group}/string shape
  }

  function run() {
    try {
      var p = pinfo();
      if (!p || typeof p !== 'object') return;
      var secs = readJSON('sections'); if (!secs || !Array.isArray(secs.cv)) return;
      var changed = false;
      secs.cv = secs.cv.map(function (s) {
        if (!s || !FIELD[s.id]) return s;
        if (!isEmptySection(s.items)) return s;          // already populated — leave it
        var src = p[FIELD[s.id]];
        if (!Array.isArray(src) || !src.length) return s; // no source data to restore from
        changed = true;
        var items = src.map(function (it) { return toShape(it, s.type); });
        return Object.assign({}, s, { items: items });
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'sidebar-repopulate-758' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }
  window.addEventListener('antcv:sections-updated', run);
  // Run EARLY (before 763/415) and re-check after external writes.
  [0, 200, 800, 1800].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvSidebarRepopulate = { version: VERSION, run: run, isEmptySection: isEmptySection };
})();
