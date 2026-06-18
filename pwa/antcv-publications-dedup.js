/* antcv-publications-dedup.js — PUBLICATIONS-DUP-001 (owner 2026-06-18)
 * ============================================================================
 * Owner (screenshot): the Publications & Patents list shows each entry TWICE.
 * "Fix this and you resolve most of its problems."
 *
 * HIDE, NOT DELETE (owner 2026-06-18, follow-up: "why do you keep DELETING groups
 * and items from the sidebar panel instead of HIDING them?"). The original cut
 * REMOVED the duplicate string from the arrays (data loss). This version is
 * non-destructive: a textual duplicate is HIDDEN, never deleted, so the owner can
 * always toggle it back:
 *   - sections publications section (list_italic) -> set the section's parallel
 *     `hidden[i]` flag true on the LATER duplicate (the render already skips
 *     hidden[i], app.src.js ~6071). Items array is never spliced.
 *   - personalInfo.publicationsStructured -> set `visible:false` on the later
 *     duplicate (the schema already carries `visible`).
 *   - personalInfo.publications (flat string array) -> LEFT UNTOUCHED. A bare
 *     string array has no hide flag, and the section-level hide above already
 *     removes the VISIBLE duplicate; deleting the flat entry would be the exact
 *     data loss the owner objected to.
 * Key = normalised (strip HTML tags, collapse whitespace, lowercase) so a
 * `<b>`-wrapped patent and a plain copy collapse. The FIRST occurrence stays
 * visible; only an exact-content twin is hidden. Distinct year/title keeps its
 * own key and is never touched.
 *
 * Sidecar-only. Loop-safe: same-blob bail + write-only-on-change + own tagged
 * event ignored. Disable: localStorage['antcv:disable-publications-dedup'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvPublicationsDedup) return;
  window.__antcvPublicationsDedup = '1.50.657';

  var SRC = 'publications-dedup';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-publications-dedup'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function norm(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function isPubsSection(sec) {
    return sec && (sec.id === 'publications' ||
      (sec.type === 'list_italic' && /PUBLICATION/i.test(String(sec.title || ''))));
  }

  // Hide (not remove) later textual duplicates in a list_italic section by
  // setting the parallel hidden[] flag. Returns true if anything changed.
  function hideDupsInSection(sec) {
    if (!Array.isArray(sec.items) || sec.items.length < 2) return false;
    var hidden = Array.isArray(sec.hidden) ? sec.hidden.slice() : [];
    while (hidden.length < sec.items.length) hidden.push(false);
    var seen = {}, changed = false;
    for (var i = 0; i < sec.items.length; i++) {
      var it = sec.items[i];
      if (typeof it !== 'string') continue;
      var k = norm(it);
      if (!k) continue;
      if (seen[k]) {                       // exact-content twin
        if (!hidden[i]) { hidden[i] = true; changed = true; }   // HIDE it, keep the data
      } else {
        seen[k] = true;
      }
    }
    if (changed) sec.hidden = hidden;
    return changed;
  }

  // Hide later duplicate publicationsStructured entries via visible:false.
  function hideDupsStructured(arr) {
    if (!Array.isArray(arr)) return false;
    var seen = {}, changed = false;
    arr.forEach(function (x) {
      if (!x || typeof x !== 'object') return;
      var k = norm(x.name || x.details || '');
      if (!k) return;
      if (seen[k]) { if (x.visible !== false) { x.visible = false; changed = true; } }
      else seen[k] = true;
    });
    return changed;
  }

  var lastPi = null, lastSec = null;
  function apply() {
    if (disabled()) return;

    // personalInfo.publicationsStructured -> visible:false (flat array left as-is)
    try {
      var rawPi = localStorage.getItem('personalInfo');
      if (rawPi && rawPi !== lastPi) {
        var pi = JSON.parse(rawPi);
        if (hideDupsStructured(pi.publicationsStructured)) {
          var op = JSON.stringify(pi); localStorage.setItem('personalInfo', op); lastPi = op;
        } else lastPi = rawPi;
      }
    } catch (_) {}

    // sections publications section -> hidden[i] on the later twin
    try {
      var rawS = localStorage.getItem('sections');
      if (rawS && rawS !== lastSec) {
        var b = JSON.parse(rawS), changed = false;
        ['cv', 'cl'].forEach(function (doc) {
          var list = b[doc];
          if (!Array.isArray(list)) return;
          list.forEach(function (sec) { if (isPubsSection(sec) && hideDupsInSection(sec)) changed = true; });
        });
        if (changed) {
          var os = JSON.stringify(b); localStorage.setItem('sections', os); lastSec = os;
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
          try { console.info('[publications-dedup] hid duplicate publication entry(ies) (data kept)'); } catch (_) {}
        } else lastSec = rawS;
      }
    } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [500, 1400, 2800].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'personalInfo' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvPublicationsDedup = { version: '1.50.657', _apply: apply };
})();
