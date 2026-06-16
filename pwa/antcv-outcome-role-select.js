/* antcv-outcome-role-select.js — OUTCOME-ROLE-SELECT-001 (owner 2026-06-16)
 * ============================================================================
 * The SELECTED OUTCOMES editor lets each outcome be pinned to a SPECIFIC
 * (un-merged) position. Three jobs, all restore-proof + loop-safe:
 *
 *  1. _OID — stamp a stable `_oid` on every outcome item so the explicit
 *     outcome→role map (`antcv:outcomeRoleMap`, consumed by the export
 *     lamination since 1.50.505) has a key that survives reorder/edit.
 *
 *  2. SEED — the SYSTEM supplies the outcomes "at first": for each visible
 *     experience role, materialise its OWN role-keyed proof points
 *     (personalInfo.proofPointsByRole / proofPointsByPosition resolved via
 *     role.proofPointIds, and any role.outcomes[]) into the SELECTED OUTCOMES
 *     pool, each mapped to that role. Proof points are DISTINCT from the role's
 *     CV bullets, so this never duplicates a bullet (owner rejected bullet-copy
 *     outcomes). Idempotent (a proof point already materialised is tracked and
 *     never re-added, so a user delete is respected). Only tops up while < 11.
 *
 *  3. DROPDOWN — inject a position <select> into each SELECTED OUTCOMES editor
 *     row so a user-added outcome can be linked to a position. Persists to the
 *     same map. Re-injects on React re-render; antcv-react-dom-guard makes our
 *     node safe for React to remove.
 *
 * No app.js mirror (pure sidecar). Data writes go through localStorage with a
 * loop guard (write only on real change, tag our own event, ignore the tag).
 */
(function () {
  'use strict';
  var VERSION = '1.50.506-outcome-role-select';
  if (window.__antcvOutcomeRoleSelect === VERSION) return;
  window.__antcvOutcomeRoleSelect = VERSION;

  var SRC = 'outcome-role-select';
  var MAP_KEY = 'antcv:outcomeRoleMap';
  var SEED_KEY = 'antcv:outcomesSeededPP';   // { [proofPointId]: true } — materialised once
  var MIN_OUTCOMES = 11;                       // owner: at least 11 supplied at first
  var MAX_PER_ROLE = 2;

  function rj(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
  function wj(k, o) { try { localStorage.setItem(k, JSON.stringify(o)); return true; } catch (_) { return false; } }
  function activeDoc() { try { var x = JSON.parse(localStorage.getItem('doc') || '"cv"'); return x === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }
  function newOid() { return 'oc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function docList(b) { return Array.isArray(b[activeDoc()]) ? b[activeDoc()] : (Array.isArray(b.cv) ? b.cv : null); }
  function expRoles(list) { var s = (list || []).find(function (x) { return x && x.type === 'experience' && Array.isArray(x.roles); }); return s ? s.roles.filter(function (r) { return r && r.on !== false; }) : []; }
  function outcomesSec(list) { return (list || []).find(function (x) { return x && (x.id === 'outcomes' || x.id === 'selected_outcomes') && Array.isArray(x.items); }); }
  function ppById() { var p = rj('personalInfo', {}) || {}; var m = {}; [].concat(p.proofPointsByRole || [], p.proofPointsByPosition || []).forEach(function (x) { if (x && x.id && typeof x.text === 'string') m[x.id] = x; }); return m; }

  function itemText(it) { return (it && typeof it === 'object') ? String((it.t != null ? it.t : it.b) || '').trim() : String(it || '').trim(); }
  function isPlaceholder(it) { return /^\s*\[/.test(itemText(it)); }
  // Lead with the TITLE (the distinguishing part) so two roles at the same company
  // — e.g. Meprolight Electro-Optics Team Leader vs R&D Electro-Optics Engineer —
  // are tellable apart in the narrow dropdown (company truncates after the title).
  function roleLabel(r, i) { var s = ((r.title || '') + (r.company ? ' — ' + r.company : '')).replace(/^\s*—\s*|\s*—\s*$/g, '').trim(); return s || ('Position ' + (i + 1)); }

  // ── Data: stamp _oid + seed from role-keyed proof points ──────────────────
  function ensureData() {
    var b = rj('sections', null); if (!b) return;
    var list = docList(b); if (!list) return;
    var os = outcomesSec(list); if (!os) return;
    var roles = expRoles(list); if (!roles.length) return;

    var map = rj(MAP_KEY, {}) || {};
    var seeded = rj(SEED_KEY, {}) || {};
    var pp = ppById();
    var items = os.items.slice();
    var changed = false, mapChanged = false, seedChanged = false;

    // 1. stamp _oid on every object item
    items = items.map(function (it) {
      if (it && typeof it === 'object') { if (!it._oid) { changed = true; return Object.assign({}, it, { _oid: newOid() }); } return it; }
      // normalise a bare string into {b,t,_oid}
      changed = true; return { b: '', t: String(it || ''), _oid: newOid() };
    });

    // 2. seed from role-keyed proof points while under the floor
    var realCount = items.filter(function (it) { return !isPlaceholder(it) && itemText(it); }).length;
    if (realCount < MIN_OUTCOMES) {
      var byText = {}; items.forEach(function (it) { byText[itemText(it).toLowerCase()] = it; });
      roles.forEach(function (r) {
        if (!r || r.id == null) return;
        // OUTCOME-SEED-UNION-001 (owner 2026-06-16, refined): the kernel SHOULD carry
        // enough REAL outcomes (proof points + role.outcomes[]) for every role —
        // those are preferred. The role's own bullets are a GAP-FILLER used ONLY for
        // a role that has ZERO real outcomes (e.g. IDF Computer Administrator), so a
        // role that already has a real outcome is NOT padded with a lower-quality
        // bullet-outcome. A bullet seeded into an outcome-less role is dup-hidden at
        // lamination (the source bullet is HIDDEN, never deleted); if that role later
        // gains a better/numeric real outcome, the real outcome wins and the bullet
        // is EXPOSED (lamination tier precedence + bullet-derived-only dedup-hide).
        var realSrc = [];
        var seenSrc = {};
        function pushTo(arr, s) { var k = String(s.text || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); if (!k || seenSrc[k]) return; seenSrc[k] = true; arr.push(s); }
        (Array.isArray(r.proofPointIds) ? r.proofPointIds : []).forEach(function (id) { if (pp[id]) pushTo(realSrc, { id: id, text: pp[id].text }); });
        (Array.isArray(r.outcomes) ? r.outcomes : []).forEach(function (o, k) { var t = String((o && (o.t || o.text || o.b)) || '').trim(); if (t) pushTo(realSrc, { id: 'ro:' + r.id + ':' + k, text: t }); });
        var sources = realSrc;
        if (!realSrc.length) {
          // gap-filler — only a role with NO real outcome falls back to bullets.
          var bsrc = [];
          (Array.isArray(r.bullets) ? r.bullets : []).forEach(function (bl, k) { var t = String((typeof bl === 'string' ? bl : (bl && (bl.b || bl.t))) || '').trim(); if (t && t.length >= 12 && !/\bpatent\b/i.test(t)) pushTo(bsrc, { id: 'rb:' + r.id + ':' + k, text: t, fromBullet: true }); });
          bsrc.sort(function (a, b) { return (/\d|%|×|\bx\b/i.test(b.text) ? 1 : 0) - (/\d|%|×|\bx\b/i.test(a.text) ? 1 : 0); });
          sources = bsrc;
        }
        var added = 0;
        for (var i = 0; i < sources.length && added < MAX_PER_ROLE; i++) {
          var s = sources[i]; var key = String(s.text || '').trim(); if (!key) continue;
          if (seeded[s.id]) continue;                       // user removed it once → respect
          var existing = byText[key.toLowerCase()];
          var theOid;
          if (existing) { if (!existing._oid) existing._oid = newOid(); theOid = existing._oid; }
          else { theOid = newOid(); var it = { b: '', t: key, _oid: theOid, _pp: s.id }; if (s.fromBullet) it._fromBullet = true; items.push(it); byText[key.toLowerCase()] = it; changed = true; }
          if (map[theOid] !== String(r.id)) { map[theOid] = String(r.id); mapChanged = true; }
          seeded[s.id] = true; seedChanged = true; added++;
          realCount++;
        }
      });
    }

    if (changed) {
      var nextList = list.map(function (s) { return s === os ? Object.assign({}, os, { items: items }) : s; });
      var nb = Object.assign({}, b); nb[activeDoc()] = nextList;
      if (wj('sections', nb)) { try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {} }
    }
    if (mapChanged) wj(MAP_KEY, map);
    if (seedChanged) wj(SEED_KEY, seeded);
  }

  // ── UI: inject a position <select> per SELECTED OUTCOMES editor row ───────
  function injectSelects() {
    var verbs = document.querySelectorAll('input[placeholder="[Verb]"]');
    if (!verbs.length) return;
    var b = rj('sections', null); if (!b) return;
    var list = docList(b); if (!list) return;
    var os = outcomesSec(list); if (!os) return;
    var roles = expRoles(list); if (!roles.length) return;
    var map = rj(MAP_KEY, {}) || {};
    var opts = roles.map(function (r, i) { return { id: String(r.id != null ? r.id : 'role_' + i), label: roleLabel(r, i) }; });
    var idx = 0;
    verbs.forEach(function (verb) {
      var row = verb.parentElement; if (!row) return;
      if (!row.querySelector('input[placeholder="Outcome text"]')) return; // not an outcome row
      var item = os.items[idx]; idx++;
      if (row.querySelector('select[data-antcv-outcome-role]')) return;     // already injected
      var theOid = item && item._oid;
      var sel = document.createElement('select');
      sel.setAttribute('data-antcv-outcome-role', '1');
      sel.title = 'Which position this outcome covers';
      sel.style.cssText = 'font-size:10px;padding:3px;border:1px solid #ddd;border-radius:3px;flex-shrink:0;max-width:160px;font-family:Georgia,serif;cursor:pointer;';
      var def = document.createElement('option'); def.value = ''; def.textContent = '— position —'; sel.appendChild(def);
      opts.forEach(function (o) { var op = document.createElement('option'); op.value = o.id; op.textContent = o.label; op.title = o.label; sel.appendChild(op); });
      if (theOid && map[theOid] != null) { sel.value = String(map[theOid]); var cur = opts.filter(function (o) { return o.id === String(map[theOid]); })[0]; if (cur) sel.title = cur.label; }
      sel.addEventListener('change', function () {
        var m = rj(MAP_KEY, {}) || {};
        if (!theOid) return;
        if (sel.value) m[theOid] = sel.value; else delete m[theOid];
        wj(MAP_KEY, m);
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
      });
      row.insertBefore(sel, verb);
    });
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { ensureData(); } catch (_) {} try { injectSelects(); } catch (_) {} }); }

  // boot sweep + observe re-renders + cross-tab storage + post-generation poll
  [300, 1000, 2500].forEach(function (d) { setTimeout(tick, d); });
  try { new MutationObserver(tick).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 2500);

  window.AntcvOutcomeRoleSelect = { version: VERSION, _ensureData: ensureData, _inject: injectSelects, _tick: tick };
})();
