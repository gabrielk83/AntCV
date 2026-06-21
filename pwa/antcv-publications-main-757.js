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
  var VERSION = '1.50.757e';
  if (window.__antcvPublicationsMain757 === VERSION) return;
  window.__antcvPublicationsMain757 = VERSION;

  function readSections() {
    try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : {}; }
    catch (_) { return {}; }
  }
  function readPI() {
    try { var v = JSON.parse(localStorage.getItem('personalInfo') || '{}'); return (v && typeof v === 'object') ? v : {}; }
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

  // PUB-REPOPULATE-001 (owner data 2026-06-22): a pubs section can hold ONLY the placeholder
  // ("[Publication, patent, or conference paper]") while personalInfo.publicationsStructured holds
  // the REAL publications — the migration carries an OLD section across but never seeds from the
  // source of truth, so a user whose pubs was reset to the skeleton shows a blank Publications.
  // Per [[dont-exclude-fix-the-data-push]]: when the section is empty/placeholder, re-derive its
  // citation items from personalInfo (NEVER overwrite real items). Composed "Name — details" so the
  // list_italic render + the 5-field editor (which re-seeds pubFields from items) round-trip cleanly.
  function isPlaceholderItem(it) {
    var s = String(it == null ? '' : it).trim();
    return !s || /^\[.*\]$/.test(s);
  }
  function sectionIsEmpty(items) {
    if (!Array.isArray(items) || !items.length) return true;
    return items.every(isPlaceholderItem);
  }
  function stripMarkup(s) { return String(s == null ? '' : s).replace(/<\/?[a-z][^>]*>/gi, '').trim(); }
  function citationsFromPI(pi) {
    var out = [], seen = {};
    function push(v) { v = cleanItem(v); if (v && !seen[v]) { seen[v] = 1; out.push(v); } }
    var ps = Array.isArray(pi.publicationsStructured) ? pi.publicationsStructured : [];
    ps.forEach(function (p) {
      if (!p || p.visible === false) return;
      var nm = stripMarkup(p.name || ''); var det = stripMarkup(p.details || '');
      if (nm) push(det ? (nm + ' — ' + det) : nm);
    });
    // fallback to the flat (markup-bearing) publications array only if structured gave nothing
    if (!out.length && Array.isArray(pi.publications)) pi.publications.forEach(push);
    // append the patent (separate top-level fields) ONLY if its number is not already represented
    // in a structured citation (publicationsStructured can ALSO carry the patent → would duplicate).
    if (pi.patentNumber) {
      var pnum = String(pi.patentNumber).trim();
      if (pnum && !out.some(function (it) { return it.indexOf(pnum) > -1; })) {
        var pd = stripMarkup(pi.patentDescription || '');
        push((pd || 'Patent') + ' — Patent no. ' + pnum);
      }
    }
    return out;
  }
  // PUB-PATENT-DEDUP-001: a bare appended patent item ("… — Patent no. <num>", lowercase "no.") is
  // dropped when ANOTHER item already cites <num> — heals data where the structured citation and the
  // top-level patent both rendered. Only the appended form matches the regex, so this never touches a
  // normal citation. Idempotent; runs on every pass, including already-populated sections.
  function dedupPatentItems(items) {
    if (!Array.isArray(items) || items.length < 2) return items;
    return items.filter(function (it, idx) {
      var m = /Patent no\. (\d+)/.exec(String(it));
      if (!m) return true;
      var num = m[1];
      for (var k = 0; k < items.length; k++) { if (k !== idx && String(items[k]).indexOf(num) > -1) return false; }
      return true;
    });
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
      // PUB-REPOPULATE-001: fill an empty/placeholder pubs section from personalInfo (source of truth).
      var pi = readPI();
      for (var p = 0; p < secs.cv.length; p++) {
        var ps = secs.cv[p];
        if (ps && (ps.id === 'pubs' || ps.richPub) && sectionIsEmpty(ps.items)) {
          var cites = citationsFromPI(pi);
          if (cites.length) { ps.items = cites; if ('pubFields' in ps) delete ps.pubFields; changed = true; }
        }
        // heal a duplicated patent on EVERY pubs section (even already-populated ones).
        if (ps && (ps.id === 'pubs' || ps.richPub) && Array.isArray(ps.items)) {
          var dd = dedupPatentItems(ps.items);
          if (dd.length !== ps.items.length) { ps.items = dd; if ('pubFields' in ps) delete ps.pubFields; changed = true; }
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
  // Later passes (3500/6000) catch a cloud-restore that lands AFTER the early window and re-introduces
  // a stale duplicate/placeholder — the on-event handler can lose a race with the React re-render, so
  // a couple of settle-time re-runs make the heal self-converge without a manual nudge. Idempotent.
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvPublicationsMain = { version: VERSION, run: run, isOldPub: isOldPub, isNewPub: isNewPub };
})();
