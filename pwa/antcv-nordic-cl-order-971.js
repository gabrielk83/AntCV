/* antcv-nordic-cl-order-971.js — NORDIC-CL-TEMPLATE-001 (owner 2026-06-29)
 * ============================================================================
 * Enforce the owner's Nordic cover-letter TEMPLATE order + structure on the live CL
 * sections, so the settings panel, the section list, the preview, and the export all
 * follow it. Source: CoverLetter_Template.docx. Scoped to Nordic-Minimal (toneRegister);
 * other styles untouched (owner: "for nordic minimal now, user may change in future").
 *
 * The per-section rich_block conversions already happen in their own sidecars
 * (foundation-758 -> Foundation/Hands-on(bullet)/Professionally(bullet); bring-761;
 * hwic-760 contribute; who/why lead-ins). This sidecar adds only what those don't:
 *
 *   1. ORDER — the template reorders the body:
 *        greeting -> opening -> why -> who -> foundation -> bring -> contribute -> closure
 *      (today's me() order is who -> bring -> why -> contribute -> foundation). Unknown
 *      sections (e.g. jd_questions, page 2) keep their relative order AFTER the known set.
 *   2. BRING rows = VISIBLE BULLETS — the [Need]: [action] rows under the "What I bring"
 *      lead-in get mk:true (the template shows them as bullets); the lead-in row stays a
 *      paragraph. Headline stays hidden (bring-761 already sets headlineOff).
 *
 * It layers on top of the converters: it only reorders + flips a marker, never changes a
 * section TYPE, so the other sidecars see no type change and don't churn. Idempotent
 * (writes only when the order or a bring marker actually changes) -> the sections-updated
 * re-dispatch converges. Self-disabling on any error. Disable: localStorage
 * ['antcv:disable-nordic-cl-order'] = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.50.971-nordic-cl-order';
  if (window.__antcvNordicClOrder971 === VERSION) return;
  window.__antcvNordicClOrder971 = VERSION;

  // The canonical Nordic CL body order (by section id). The positioning line is the F1
  // slogan (rendered above the body, not a section). Sign-off + AI notice are separate.
  var ORDER = ['greeting', 'opening', 'why', 'who', 'foundation', 'bring', 'contribute', 'closure'];

  function disabled() { try { var v = localStorage.getItem('antcv:disable-nordic-cl-order'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function isNordicMinimal() {
    try { var tr = localStorage.getItem('toneRegister'); if (tr) { var v = JSON.parse(tr); return v === 'nordic-minimal' || v === 'scandinavian'; } } catch (_) {}
    return false;
  }
  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : null; } catch (_) { return null; }
  }

  // Reorder cl into ORDER; unknown ids keep their original relative order, appended after.
  function reorder(list) {
    if (!Array.isArray(list) || list.length < 2) return { changed: false, list: list };
    var known = [], unknown = [];
    ORDER.forEach(function (id) {
      var s = list.filter(function (x) { return x && x.id === id; });
      known = known.concat(s);
    });
    list.forEach(function (s) { if (!s || ORDER.indexOf(s.id) < 0) unknown.push(s); });
    var out = known.concat(unknown);
    // changed only if the id sequence actually differs
    var before = list.map(function (s) { return s && s.id; }).join('|');
    var after = out.map(function (s) { return s && s.id; }).join('|');
    return { changed: before !== after, list: out };
  }

  // BRING: the rows after the "What I bring" lead-in render as visible bullets (mk:true).
  // The lead-in is the FIRST row (a markerless {b:title, t}); every later data row gets mk.
  function bringBullets(list) {
    var changed = false;
    var out = list.map(function (s) {
      if (!s || s.id !== 'bring' || s.type !== 'rich_block' || !Array.isArray(s.items) || s.items.length < 2) return s;
      var items = s.items.map(function (r, i) {
        if (i === 0) return r;                         // lead-in stays a paragraph
        if (r && typeof r === 'object' && r.mk !== true) { changed = true; return Object.assign({}, r, { mk: true }); }
        return r;
      });
      if (!changed) return s;
      return Object.assign({}, s, { items: items });
    });
    return { changed: changed, list: out };
  }

  function run() {
    try {
      if (disabled() || !isNordicMinimal()) return;
      var secs = readSections(); if (!secs || !Array.isArray(secs.cl)) return;
      var a = reorder(secs.cl);
      var b = bringBullets(a.list);
      if (!a.changed && !b.changed) return;
      secs.cl = b.list;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'nordic-cl-order-971' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  // Run after the per-section converters settle (they use 0/300/900/2000 + late timers),
  // and on later windows to catch a cloud-restore / regen that rewrites cl.
  [350, 1100, 2600, 5000, 9000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvNordicClOrder = { version: VERSION, run: run, ORDER: ORDER };
})();
