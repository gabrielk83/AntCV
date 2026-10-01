/* antcv-references-mode.js — REFERENCES-MODE-001 (owner 2026-10-01)
 * ============================================================================
 * Owner: "for references: add a selector that can change the International and danish contact to my specific
 * references, try to get their contact to me - and choose only the two most relevant for the position. do not
 * add their direct details so it will not be possible to track them. make sure this switch is in the antcv
 * settings panel and by default use the 'references Exposed'."
 *
 * Settings panel (PAGE FLOW group, next to Role line / CV layout): "References" select
 *   exposed (DEFAULT, key absent) - the CV references row names the TWO referees most relevant to the job ad,
 *                                   with name, title, organisation and relationship ONLY. No phone, no e-mail:
 *                                   the row ends "contact details via me", so every contact goes through the
 *                                   candidate.
 *   request                       - the generic "International and Danish recommendations provided on request".
 * Store: localStorage['antcv:referencesMode'] = 'request' | absent (absent = exposed).
 *
 * Referee pool = per-user DATA, never code (the repo is public): personalInfo.referees (cloud kernel identity),
 * mirrored to localStorage['antcv:referees'] so a stale kernel save on another session cannot lose it.
 * Shape: [{ name, title, org, relation, lang: 'da'|'en', tags: [..] }] - contact details are never stored here.
 * Relevance: tag hits in the job ad text (antcv:lastJdText, the same source the export uses) + a Danish-context
 * bonus for a Danish referee; ties keep pool order; no ad = the first two.
 *
 * Writes only the CV references section (id 'recommendations' or a references-like title), only on a real change,
 * keeps the original generic items on the section (_refsGeneric) to restore them. No app.js edit.
 * Kill: localStorage['antcv:disable-references-mode']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.4766-references-mode';
  if (window.__antcvReferencesMode === VERSION) return;
  window.__antcvReferencesMode = VERSION;

  var MODE_KEY = 'antcv:referencesMode', POOL_KEY = 'antcv:referees', ATTR = 'data-antcv-references-mode';
  var REASON = 'references-mode';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-references-mode'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function mode() { try { return localStorage.getItem(MODE_KEY) === 'request' ? 'request' : 'exposed'; } catch (_) { return 'exposed'; } }
  function readJson(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }
  function lang() { try { return String(localStorage.getItem('language') || '').replace(/[^a-z]/gi, '').slice(0, 2).toLowerCase() || 'en'; } catch (_) { return 'en'; } }

  // the referee pool: kernel personalInfo.referees, mirrored locally (and read back if the kernel copy is gone)
  function pool() {
    var pi = readJson('personalInfo', {}) || {};
    pi = pi.personalInfo || pi;
    var list = Array.isArray(pi.referees) ? pi.referees : null;
    if (list && list.length) {
      try { localStorage.setItem(POOL_KEY, JSON.stringify(list)); } catch (_) {}
      return list.filter(valid);
    }
    var local = readJson(POOL_KEY, []);
    return Array.isArray(local) ? local.filter(valid) : [];
  }
  function valid(r) { return r && typeof r.name === 'string' && r.name.trim(); }

  function danishContext(jd) {
    return lang() === 'da' || /\b(dansk|danish|denmark|danmark|københavn|copenhagen|aarhus|odense)\b/i.test(jd);
  }
  function score(r, jd, dk) {
    var s = 0;
    (r.tags || []).forEach(function (t) {
      t = String(t || '').trim(); if (!t) return;
      var re = new RegExp('(^|[^a-z0-9æøå])' + t.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^a-z0-9æøå])', 'g');
      var m = jd.match(re); if (m) s += Math.min(3, m.length);
    });
    if (dk && r.lang === 'da') s += 3;
    return s;
  }
  function pickTwo(list, jdRaw) {
    var jd = String(jdRaw || '').toLowerCase();
    if (!jd.trim()) return list.slice(0, 2);
    var dk = danishContext(jd);
    return list.map(function (r, i) { return { r: r, i: i, s: score(r, jd, dk) }; })
      .sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); })
      .slice(0, 2)
      .sort(function (a, b) { return a.i - b.i; })   // chosen by relevance, listed in the owner's pool order
      .map(function (o) { return o.r; });
  }
  window.__antcvPickReferees = pickTwo;   // test hook

  var TXT = {
    en: { via: 'contact details via me', generic: { deg: 'References', sch: 'International and Danish recommendations provided on request' } },
    da: { via: 'kontaktoplysninger via mig', generic: { deg: 'Referencer', sch: 'Danske og internationale referencer på forespørgsel' } },
  };
  function txt() { return TXT[lang()] || TXT.en; }
  // one row per referee: name | title, organisation (relationship) - contact details via me. NEVER phone/e-mail.
  function rowFor(r) {
    // optional per-language fields (title_da, relation_da, ...) win on a CV in that language
    var L = lang(), f = function (k) { return r[k + '_' + L] || r[k]; };
    var who = [f('title'), f('org')].filter(function (x) { return x && String(x).trim(); }).join(', ');
    var rel = f('relation') ? ' (' + String(f('relation')).trim() + ')' : '';
    return { deg: String(r.name).trim(), sch: (who + rel + ' - ' + txt().via).replace(/^ - /, '') };
  }

  function isRefSection(s) {
    if (!s || !s.id) return false;
    if (s.id === 'recommendations' || s.id === 'references') return true;
    return /recommend|reference|anbefal/i.test(String(s.title || ''));
  }
  // map rows into the section's own item shape
  function shape(s, rows) {
    if (s.type === 'labeled_list') return rows.map(function (x) { return { l: x.deg, v: x.sch }; });
    if (s.type === 'rich_block') return rows.map(function (x) { return { b: x.deg, t: x.sch }; });
    return rows;   // education ({deg, sch}) - the default house shape
  }
  function looksNamed(s, items) {
    var names = (pool() || []).map(function (r) { return String(r.name).trim().toLowerCase(); });
    return (items || []).some(function (it) { var k = String((it && (it.deg || it.l || it.b)) || '').trim().toLowerCase(); return names.indexOf(k) >= 0; });
  }

  var busy = false;
  function apply() {
    if (busy || disabled()) return;
    busy = true;
    try {
      var secs = readJson('sections', null);
      if (!secs || !Array.isArray(secs.cv)) return;
      var list = pool();
      var changed = false;
      secs.cv = secs.cv.map(function (s) {
        if (!isRefSection(s) || s.on === false) return s;
        var items = Array.isArray(s.items) ? s.items : [];
        var c = null;
        if (mode() === 'exposed' && list.length) {
          var generic = s._refsGeneric || (looksNamed(s, items) ? null : items);
          var want = shape(s, pickTwo(list, localStorage.getItem('antcv:lastJdText')).map(rowFor));
          if (JSON.stringify(items) !== JSON.stringify(want)) { c = Object.assign({}, s, { items: want }); if (generic) c._refsGeneric = generic; }
        } else if (mode() === 'request') {
          var back = (Array.isArray(s._refsGeneric) && s._refsGeneric.length) ? s._refsGeneric : shape(s, [txt().generic]);
          if (looksNamed(s, items) || (!items.length)) { c = Object.assign({}, s, { items: back }); delete c._refsGeneric; }
        }
        if (c) { changed = true; return c; }
        return s;
      });
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: REASON } })); } catch (_) {}
    } catch (_) { /* self-disable */ } finally { busy = false; }
  }
  window.__antcvReferencesApply = apply;

  // ---- settings panel: "References" select in the PAGE FLOW group (same anchor as antcv-role-line-format.js)
  function build() {
    var row = document.createElement('label');
    row.setAttribute(ATTR, '1');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin:2px 0 4px;cursor:pointer;';
    var lb = document.createElement('span');
    lb.textContent = 'References';
    lb.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.45);flex:0 0 auto;';
    var sel = document.createElement('select');
    sel.style.cssText = 'font-size:9px;padding:1px 2px;max-width:100%;';
    [['exposed', 'Exposed - 2 most relevant'], ['request', 'On request (generic)']].forEach(function (o) {
      var op = document.createElement('option'); op.value = o[0]; op.textContent = o[1];
      if (o[0] === mode()) op.selected = true;
      sel.appendChild(op);
    });
    sel.title = 'Exposed names the two referees most relevant to this job ad - name, role and relationship only, never their phone or e-mail.';
    sel.onchange = function () {
      try { if (sel.value === 'request') localStorage.setItem(MODE_KEY, 'request'); else localStorage.removeItem(MODE_KEY); } catch (_) {}
      apply();
    };
    row.appendChild(lb); row.appendChild(sel);
    return row;
  }
  function place() {
    if (disabled()) return;
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.childElementCount !== 0 || String(n.textContent || '').trim() !== 'PAGE FLOW') continue;
      var parent = n.parentNode;
      if (!parent || parent.querySelector('[' + ATTR + ']')) continue;
      var anchor = parent.querySelector('[data-antcv-role-line-format="layout"]') || parent.querySelector('[data-antcv-role-line-format]');
      if (anchor) parent.insertBefore(build(), anchor.nextSibling);
      else parent.appendChild(build());
    }
  }

  var pending = 0, tPend = 0;
  function schedule() { if (pending) return; pending = setTimeout(function () { pending = 0; try { place(); } catch (_) {} }, 150); }
  function start() {
    try { place(); } catch (_) {}
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    window.addEventListener('antcv:sections-updated', function (e) {
      if (e && e.detail && e.detail.reason === REASON) return;
      if (!tPend) tPend = setTimeout(function () { tPend = 0; apply(); }, 400);
    });
    [500, 2000, 6000].forEach(function (ms) { setTimeout(apply, ms); });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
