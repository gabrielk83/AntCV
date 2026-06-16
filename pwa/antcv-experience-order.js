/* antcv-experience-order.js — EXP-ORDER-ON-ADD-001 (owner 2026-06-16)
 * ============================================================================
 * When a role is ADDED to the Professional Experience panel (or its start year is
 * completed/changed), re-sort the roles into REVERSE-CHRONOLOGICAL order with the
 * unique volunteer role (Copenhagen Wolves / foreningsarbejde) pinned LAST. A pure
 * manual reorder (same roles + same start years, just dragged) is RESPECTED — the
 * sidecar never re-sorts then, so it does not fight the user (owner: "the user can
 * manually change and that's okay, just do not flip on purpose").
 *
 * Detection: an order-INSENSITIVE state key of {id:startYear} pairs, persisted in
 * the STANDALONE key `antcv:expOrderState`. First run records the key without
 * sorting (existing order is left alone). A later key CHANGE means a role was
 * added/removed or a year was completed → sort once. A reorder leaves the key
 * unchanged → no sort. Restore-proof + loop-safe (write only on real change).
 */
(function () {
  'use strict';
  var VERSION = '1.50.513-exp-order';
  if (window.__antcvExpOrder === VERSION) return;
  window.__antcvExpOrder = VERSION;

  var SRC = 'exp-order';
  var STATE_KEY = 'antcv:expOrderState';

  function rj(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
  function activeDoc() { try { var x = JSON.parse(localStorage.getItem('doc') || '"cv"'); return x === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }
  function expOf(list) { return (list || []).find(function (s) { return s && s.type === 'experience' && Array.isArray(s.roles); }); }
  function startYear(r) { var m = String((r && r.years) || '').match(/\b(19|20)\d{2}\b/); return m ? parseInt(m[0], 10) : null; }
  function isVolunteer(r) {
    if (!r) return false;
    if (r.id === 'copenhagen_wolves') return true;
    var s = (String(r.company || '') + ' ' + String(r.title || '')).toLowerCase();
    return /copenhagen wolves|foreningsarbejde|pan idr|wolves rfc|\bvolunteer\b/.test(s);
  }
  // order-INSENSITIVE signature: a change means add/remove or a completed-year change.
  function stateKey(roles) {
    return (roles || []).map(function (r, i) { return (String((r && r.id) != null ? r.id : ('#' + i))) + ':' + (startYear(r) || ''); }).slice().sort().join('|');
  }
  function sortRoles(roles) {
    return roles.map(function (r, i) { return { r: r, i: i }; }).sort(function (a, b) {
      var va = isVolunteer(a.r), vb = isVolunteer(b.r);
      if (va !== vb) return va ? 1 : -1;                 // volunteer LAST
      var ya = startYear(a.r), yb = startYear(b.r);
      if (ya == null && yb == null) return a.i - b.i;    // both undated → stable
      if (ya == null) return -1;                          // undated (fresh add) → top
      if (yb == null) return 1;
      if (yb !== ya) return yb - ya;                      // start year DESC
      return a.i - b.i;                                   // tie → stable
    }).map(function (x) { return x.r; });
  }
  function sameOrder(a, b) { if (a.length !== b.length) return false; for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; }

  function tick() {
    var b = rj('sections', null); if (!b) return;
    var dk = activeDoc();
    var list = b[dk]; if (!Array.isArray(list)) return;
    var exp = expOf(list); if (!exp) return;
    var roles = exp.roles;
    var key = stateKey(roles);
    var persisted = null; try { persisted = localStorage.getItem(STATE_KEY); } catch (_) {}
    if (persisted === null) { try { localStorage.setItem(STATE_KEY, key); } catch (_) {} return; } // first run: record, don't reorder
    if (persisted === key) return;                                                                  // pure reorder/no-op → respect manual order
    // key changed → role added/removed or a year completed → sort once.
    var sorted = sortRoles(roles);
    try { localStorage.setItem(STATE_KEY, key); } catch (_) {}
    if (sameOrder(sorted, roles)) return;                                                            // already in order
    var nextList = list.map(function (s) { return s === exp ? Object.assign({}, exp, { roles: sorted }) : s; });
    var nb = Object.assign({}, b); nb[dk] = nextList;
    try { localStorage.setItem('sections', JSON.stringify(nb)); } catch (_) { return; }
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
  }

  var pending = false;
  function schedule() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { tick(); } catch (_) {} }); }

  [500, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) schedule(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) schedule(); }); } catch (_) {}
  setInterval(schedule, 3000);

  window.AntcvExperienceOrder = { version: VERSION, _tick: tick, _sortRoles: sortRoles, _stateKey: stateKey };
})();
