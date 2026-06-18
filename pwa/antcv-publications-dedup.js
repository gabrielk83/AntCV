/* antcv-publications-dedup.js — PUBLICATIONS-DUP-001 (owner 2026-06-18)
 * ============================================================================
 * Owner (screenshot): the Publications & Patents list shows each entry TWICE.
 * "Fix this and you resolve most of its problems."
 *
 * Root: there are two stored representations — the flat `personalInfo.publications`
 * (string array, what the section render copies verbatim) and the structured
 * `personalInfo.publicationsStructured`. The data importer dedups only the
 * STRUCTURED form (on name); the flat array is never deduped, so a re-import /
 * merge / cloud-restore can leave the same publication in it twice, and the
 * `<b>Patent…</b>` wrap means a wrapped copy and a plain copy slip past any
 * exact-string guard.
 *
 * Fix: remove textually-identical duplicates from BOTH personalInfo arrays AND
 * the `sections` publications items, keying on a NORMALISED form (strip HTML
 * tags, collapse whitespace, lowercase) so "<b>Patent No. 1:</b> X" and
 * "Patent No. 1: X" collapse to one. Keeps the FIRST occurrence; only ever
 * removes an exact-content twin, never two genuinely distinct entries (a
 * different year/title yields a different key). Persistent + restore-proof.
 *
 * Sidecar-only — no app.js. Loop-safe: same-blob bail + write-only-on-change +
 * our own tagged event ignored. Disable:
 * localStorage['antcv:disable-publications-dedup'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvPublicationsDedup) return;
  window.__antcvPublicationsDedup = '1.50.646';

  var SRC = 'publications-dedup';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-publications-dedup'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function norm(s) { return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim().toLowerCase(); }

  function dedupStrings(arr) {
    if (!Array.isArray(arr)) return null;
    var seen = {}, out = [], changed = false;
    arr.forEach(function (x) {
      if (typeof x !== 'string') { out.push(x); return; }
      var k = norm(x);
      if (!k) { out.push(x); return; }          // keep blanks/markup-only as-is
      if (seen[k]) { changed = true; return; }    // drop exact-content twin
      seen[k] = true; out.push(x);
    });
    return changed ? out : null;
  }
  function dedupStructured(arr) {
    if (!Array.isArray(arr)) return null;
    var seen = {}, out = [], changed = false;
    arr.forEach(function (x) {
      if (!x || typeof x !== 'object') { out.push(x); return; }
      var k = norm(x.name || x.details || '');
      if (!k) { out.push(x); return; }
      if (seen[k]) { changed = true; return; }
      seen[k] = true; out.push(x);
    });
    return changed ? out : null;
  }
  function isPubsSection(sec) {
    return sec && (sec.id === 'publications' ||
      (sec.type === 'list_italic' && /PUBLICATION/i.test(String(sec.title || ''))));
  }

  var lastPi = null, lastSec = null;
  function apply() {
    if (disabled()) return;

    // 1. personalInfo.publications (flat) + publicationsStructured
    try {
      var rawPi = localStorage.getItem('personalInfo');
      if (rawPi && rawPi !== lastPi) {
        var pi = JSON.parse(rawPi), piChanged = false;
        var f = dedupStrings(pi.publications); if (f) { pi.publications = f; piChanged = true; }
        var s = dedupStructured(pi.publicationsStructured); if (s) { pi.publicationsStructured = s; piChanged = true; }
        if (piChanged) { var op = JSON.stringify(pi); localStorage.setItem('personalInfo', op); lastPi = op; }
        else lastPi = rawPi;
      }
    } catch (_) {}

    // 2. sections publications items
    try {
      var rawS = localStorage.getItem('sections');
      if (rawS && rawS !== lastSec) {
        var b = JSON.parse(rawS), secChanged = false;
        ['cv', 'cl'].forEach(function (doc) {
          var list = b[doc];
          if (!Array.isArray(list)) return;
          list.forEach(function (sec) {
            if (!isPubsSection(sec)) return;
            var d = dedupStrings(sec.items);
            if (d) { sec.items = d; secChanged = true; }
          });
        });
        if (secChanged) {
          var os = JSON.stringify(b); localStorage.setItem('sections', os); lastSec = os;
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
          try { console.info('[publications-dedup] removed duplicate publication entry(ies)'); } catch (_) {}
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

  window.AntcvPublicationsDedup = { version: '1.50.646', _apply: apply };
})();
