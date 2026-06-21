/* antcv-publications-main-757.js — PUBLICATIONS-MAIN-001 (owner 2026-06-22)
 * ============================================================================
 * Retire the OLD buggy sidebar `publications` (list_italic) section and replace
 * it with a NEW MAIN `pubs` section (richPub) placed BETWEEN Professional
 * Experience and Recommendations, movable to sidebar. The old items migrate
 * across (nothing lost). Phase-1 foundation for the rich Publications & Patents
 * editor (the per-row 5-field editor + controls ship in later sidecars).
 *
 * Display: the new section reuses the `list_italic` render (title bold-italic +
 * plain details) and is flagged `richPub`, so app.js skips the legacy
 * non-academic year-only stripping (PUB-CHAIN-001) and shows the full citation.
 *
 * Safety:
 *  - Idempotent + loop-safe: only writes/dispatches when it actually changes the
 *    sections; once migrated (old gone, new present) it does NOTHING, so it never
 *    fights a user's manual move to the sidebar or a reorder.
 *  - Migration only — it does NOT auto-create the section for users who never had
 *    publications (the me() skeleton covers fresh docs); that avoids re-adding a
 *    section a user deliberately deleted.
 *  - CV only (this is a CV section). Self-disabling on any error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.757b';
  if (window.__antcvPublicationsMain757 === VERSION) return;
  window.__antcvPublicationsMain757 = VERSION;

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  // OLD = the retired section: id "publications", OR a non-rich sidebar list_italic
  // titled publications/patent. NEVER matches the new section (id "pubs" / richPub).
  function isOldPub(s) {
    return !!(s && s.id !== 'pubs' && !s.richPub &&
      (s.id === 'publications' ||
        (s.type === 'list_italic' && /publication|patent/i.test(String(s.title || '')))));
  }
  function isNewPub(s) { return !!(s && (s.id === 'pubs' || s.richPub)); }

  function migrate(cv) {
    if (!Array.isArray(cv)) return null;
    var oldIdx = -1, newIdx = -1;
    for (var i = 0; i < cv.length; i++) {
      if (oldIdx < 0 && isOldPub(cv[i])) oldIdx = i;
      if (newIdx < 0 && isNewPub(cv[i])) newIdx = i;
    }
    // Already migrated (new exists, no old) → respect the user's placement/loc; do nothing.
    if (oldIdx < 0) return null;

    var oldSec = cv[oldIdx];
    var newSec = newIdx >= 0 ? cv[newIdx] : null;
    if (!newSec) {
      newSec = {
        id: 'pubs', title: 'PUBLICATIONS & PATENTS', loc: 'main',
        on: oldSec.on !== false, type: 'list_italic', richPub: true,
        items: (Array.isArray(oldSec.items) && oldSec.items.length) ? oldSec.items.slice()
          : ['[Publication, patent, or conference paper]']
      };
      if (oldSec.hidden) newSec.hidden = oldSec.hidden;
    } else {
      // canonicalise + merge the old items in (append those not already present)
      newSec.id = 'pubs'; newSec.richPub = true; newSec.type = 'list_italic';
      if (!Array.isArray(newSec.items)) newSec.items = [];
      var have = {}; newSec.items.forEach(function (it) { have[String(it)] = 1; });
      (Array.isArray(oldSec.items) ? oldSec.items : []).forEach(function (it) {
        if (!have[String(it)]) { newSec.items.push(it); have[String(it)] = 1; }
      });
    }

    // Rebuild the array: drop the old section AND any existing new (re-inserted at the right spot).
    var out = [];
    for (var j = 0; j < cv.length; j++) {
      if (j === oldIdx) continue;
      if (isNewPub(cv[j])) continue;
      out.push(cv[j]);
    }
    // Placement: right BEFORE recommendations; else right AFTER experience; else append.
    var recIdx = -1, expIdx = -1;
    for (var k = 0; k < out.length; k++) {
      if (recIdx < 0 && (out[k].id === 'recommendations' || /RECOMMENDATION/i.test(String(out[k].title || '')))) recIdx = k;
      if (out[k].type === 'experience' || /PROFESSIONAL.*EXPERIENCE/i.test(String(out[k].title || ''))) expIdx = k;
    }
    var at = recIdx >= 0 ? recIdx : (expIdx >= 0 ? expIdx + 1 : out.length);
    out.splice(at, 0, newSec);
    return out;
  }

  // PUB-CLEAN-001 (owner 2026-06-22): migrated citations carried HTML bold/italic tags + smart
  // quotes around the title (<b>"Integration…"</b> — …), which leaked into the Name field and the
  // preview. Strip the markup + the quotes around the title (keep the details). Idempotent.
  var CITE_SEP = [' — ', ' – ', ' - ', ': '];
  function cleanItem(it) {
    var v = String(it == null ? '' : it).replace(/<\/?[a-z][^>]*>/gi, '');
    for (var i = 0; i < CITE_SEP.length; i++) {
      var k = v.indexOf(CITE_SEP[i]);
      if (k > 0) {
        var title = v.slice(0, k).replace(/^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g, '').trim();
        return title + CITE_SEP[i] + v.slice(k + CITE_SEP[i].length);
      }
    }
    return v.replace(/^[\s"'“”‘’«»]+|[\s"'“”‘’«»]+$/g, '').trim();
  }
  function run() {
    try {
      var secs = readSections();
      if (!Array.isArray(secs.cv)) return;
      var changed = false;
      var next = migrate(secs.cv);
      if (next) { secs.cv = next; changed = true; }
      // strip HTML/quote markup from the pubs section's item strings (every pass, idempotent).
      for (var i = 0; i < secs.cv.length; i++) {
        var s = secs.cv[i];
        if (s && (s.id === 'pubs' || s.richPub) && Array.isArray(s.items)) {
          var cleaned = s.items.map(cleanItem);
          for (var j = 0; j < cleaned.length; j++) { if (cleaned[j] !== s.items[j]) { s.items = cleaned; changed = true; break; } }
        }
      }
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'publications-main-757' } })); } catch (_) {}
    } catch (_) { /* self-disable on any error */ }
  }

  // Re-check after external writes (cloud-restore re-dispatches sections-updated, which can
  // bring the old section back; the idempotent guard makes re-migration converge in one pass).
  window.addEventListener('antcv:sections-updated', run);
  [0, 300, 900, 2000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvPublicationsMain = { version: VERSION, run: run, isOldPub: isOldPub, isNewPub: isNewPub };
})();
