/* AntCV sidebar sub-section item page controls (PB-SIDEBAR-001, v1.50.130)
 * ============================================================================
 * Owner: every sidebar sub-section (Regulatory Context, Tools & Methods,
 * Education, Languages, …) must be able to page-break its items — a break
 * "opens" the continued sidebar tables on the next page. The RENDERER already
 * exists (antcv-sidebar-subsection-pagebreaks-329 draws the break + pagebar +
 * "(Cont.)" header for any sidebar section that has a page>=2 in itemPages).
 * What was missing is the CONTROL that writes itemPages for those sections:
 * only antcv-additional-info-row-controls-247 added a page button, and only for
 * Additional Information.
 *
 * This sidecar adds a 📄 page button to the item rows of the CURRENTLY-EDITED
 * sidebar sub-section, bound to THAT section's own sid (never a hardcoded id —
 * that was the 247 contamination bug, fixed in 1.50.129). Writing the page
 * pulses the same events 329 renders from.
 *
 * Scope guards (this is the contended sidebar zone — be conservative):
 *   - editor only (rejects anything inside .antcv-preview-paper),
 *   - skips Additional Information (247's domain),
 *   - skips rows that already carry a page control from another sidecar,
 *   - resolves the section from the focused editor's header → section title,
 *     so a button can only ever write its own section's sid.
 */
(function () {
  'use strict';
  var VERSION = '1.50.130-sidebar-items';
  if (window.__antcvSidebarItemPageControls === VERSION) return;
  window.__antcvSidebarItemPageControls = VERSION;

  var PAGE_KEY = 'antcv:itemPages';
  var SECTIONS_KEY = 'sections';
  var ADDL_RX = /additional information/i; // owned by 247

  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function low(s) { return clean(s).toLowerCase(); }
  function isInPreviewPaper(el) {
    if (!el) return false;
    var p = document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
    return !!(p && p.contains(el));
  }
  function readJson(k, f) { try { var v = JSON.parse(localStorage.getItem(k) || ''); return v && typeof v === 'object' ? v : f; } catch (_) { return f; } }
  function writeJson(k, v) { try { localStorage.setItem(k, JSON.stringify(v || {})); } catch (_) {} }
  function activeDoc() { try { var d = localStorage.getItem('doc'); return d === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }
  function sections() { var all = readJson(SECTIONS_KEY, {}); var l = all && all[activeDoc()]; return Array.isArray(l) ? l : []; }
  function sidebarSections() {
    return sections().filter(function (s) {
      return s && String(s.loc || '').toLowerCase() === 'sidebar' && !ADDL_RX.test(String(s.title || s.name || ''));
    });
  }

  function getPage(sid, idx) { var m = readJson(PAGE_KEY, {}); var b = m[sid] || {}; var n = Number(b[String(idx)]); return Number.isFinite(n) && n >= 1 && n <= 4 ? (n | 0) : 1; }
  function setPage(sid, idx, val) {
    var m = readJson(PAGE_KEY, {});
    if (!m[sid] || typeof m[sid] !== 'object') m[sid] = {};
    if (val <= 1) delete m[sid][String(idx)]; else m[sid][String(idx)] = val;
    writeJson(PAGE_KEY, m);
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'sidebar-item-page', sid: sid, index: idx, page: val } })); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('antcv:item-pages-changed', { detail: { source: 'sidebar-item-page', sid: sid } })); } catch (_) {}
  }

  function isDelete(b) { var t = low(b.textContent || b.title || b.getAttribute('aria-label')); return t === '×' || t === 'x' || t.indexOf('delete') >= 0 || t.indexOf('remove') >= 0; }
  function hasForeignPageControl(row) {
    return !!row.querySelector(
      '[data-antcv-addinfo-control="page"], [data-antcv-rowfix-control="page"], [data-antcv-core-page], button.antcv-core-page'
    );
  }

  function makeBtn() {
    var b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('data-antcv-sidebar-item-page', '1');
    Object.assign(b.style, {
      width: '30px', minWidth: '30px', height: '22px', minHeight: '22px',
      padding: '0', margin: '0 1px', border: '1px solid #01B7BB', borderRadius: '5px',
      background: 'rgba(1,183,187,.08)', color: '#00746E', display: 'inline-flex',
      alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700',
      lineHeight: '1', cursor: 'pointer', boxSizing: 'border-box', flex: '0 0 auto'
    });
    return b;
  }
  function paint(btn, sid, idx) {
    var p = getPage(sid, idx);
    btn.textContent = '📄 ' + p;
    btn.title = 'Start this sidebar item on page ' + p + '. Click to cycle page 1 to 4.';
    btn.setAttribute('aria-label', btn.title);
    btn.setAttribute('data-antcv-sidebar-item-page-sid', sid);
    btn.setAttribute('data-antcv-sidebar-item-page-idx', String(idx));
  }

  // The focused sidebar sub-section editor: a short header matching a sidebar
  // section title (not Additional Information), enclosed by a container that
  // also has the section's "+ item" / "+ group heading" control. Returns
  // { sec, root } so rows are scoped to exactly that section.
  function focusedSection() {
    var secs = sidebarSections();
    if (!secs.length) return null;
    var heads = Array.from(document.querySelectorAll('h1,h2,h3,div,span')).filter(function (el) {
      if (isInPreviewPaper(el)) return false;
      var t = low(el.textContent || '');
      if (!t || t.length > 60) return false;
      return secs.some(function (s) { var ti = low(s.title || s.name || ''); return ti && t.indexOf(ti) >= 0; });
    });
    for (var i = 0; i < heads.length; i++) {
      var h = heads[i];
      var sec = secs.find(function (s) { var ti = low(s.title || s.name || ''); return ti && low(h.textContent).indexOf(ti) >= 0; });
      if (!sec || !sec.id) continue;
      var p = h;
      for (var d = 0; d < 6 && p; d++, p = p.parentElement) {
        if (!p || p === document.body) break;
        if (isInPreviewPaper(p)) break;
        var txt = low(p.textContent);
        if (txt.indexOf('+ item') >= 0 || txt.indexOf('+ group heading') >= 0) return { sec: sec, root: p };
      }
    }
    return null;
  }

  function itemRows(root) {
    var out = [];
    Array.from(root.querySelectorAll('div,li,tr')).forEach(function (el) {
      if (isInPreviewPaper(el)) return;
      var inputs = el.querySelectorAll('input,textarea,[contenteditable="true"]');
      if (!inputs.length) return;
      var txt = low(el.textContent);
      if (txt.indexOf('+ item') >= 0 || txt.indexOf('+ group heading') >= 0) return;
      var btns = Array.from(el.querySelectorAll('button'));
      var hasCtl = btns.some(function (b) { return isDelete(b) || /👁|eye|hide|show/.test(low(b.textContent || b.title || b.getAttribute('aria-label'))); });
      if (hasCtl && btns.length > 0) out.push(el);
    });
    // Keep only the smallest container of any nested pair.
    return out.filter(function (el) { return !out.some(function (o) { return o !== el && o.contains(el); }); });
  }

  function rowHost(row) {
    var h = row.querySelector(':scope [data-antcv-sidebar-item-host="1"]');
    if (h) return h;
    h = document.createElement('span');
    h.setAttribute('data-antcv-sidebar-item-host', '1');
    Object.assign(h.style, { display: 'inline-flex', alignItems: 'center', gap: '2px', marginLeft: '3px', whiteSpace: 'nowrap', verticalAlign: 'middle', flex: '0 0 auto' });
    var del = Array.from(row.querySelectorAll(':scope button')).find(isDelete);
    if (del && del.parentElement) del.parentElement.insertBefore(h, del); else row.appendChild(h);
    return h;
  }

  function wire(row, sid, idx) {
    var h = rowHost(row);
    var btn = h.querySelector(':scope [data-antcv-sidebar-item-page="1"]');
    if (!btn) { btn = makeBtn(); h.appendChild(btn); }
    paint(btn, sid, idx);
    btn.onclick = function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var n = (getPage(sid, idx) % 4) + 1;
      setPage(sid, idx, n);
      paint(btn, sid, idx);
    };
  }

  function run() {
    var f = focusedSection();
    if (!f || !f.sec || !f.sec.id) return;
    if (ADDL_RX.test(String(f.sec.title || f.sec.name || ''))) return; // 247's domain
    var rows = itemRows(f.root);
    var wi = 0;
    rows.forEach(function (r) {
      if (hasForeignPageControl(r)) return; // another sidecar already owns this row's page button
      wire(r, f.sec.id, wi);
      wi++;
    });
  }

  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { run(); } catch (_) {} }); }
  function start() {
    schedule();
    [200, 600, 1500].forEach(function (d) { setTimeout(schedule, d); });
    try {
      new MutationObserver(function (recs) {
        for (var i = 0; i < recs.length; i++) {
          var t = recs[i].target;
          if (t && t.nodeType === 1 && t.hasAttribute &&
              (t.hasAttribute('data-antcv-sidebar-item-page') || t.hasAttribute('data-antcv-sidebar-item-host'))) continue;
          schedule(); return;
        }
      }).observe(document.body || document.documentElement, { childList: true, subtree: true });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', schedule);
    window.addEventListener('antcv:item-pages-changed', schedule);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();

  window.AntcvSidebarItemPageControls = { version: VERSION, _run: run, _focused: focusedSection };
  try { console.debug('[sidebar-item-page-controls-359] installed ' + VERSION); } catch (_) {}
})();
