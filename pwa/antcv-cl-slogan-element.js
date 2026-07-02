/* antcv-cl-slogan-element.js — CL-SLOGAN-ELEMENT-001 (owner 2026-07-03, register row 22 phase 1)
 *
 * Owner: "place this as a cover letter settings element — the slogan is supposed to be a
 * rich_content object". The slogan is the teal tagline at the TOP of the CL body; until now
 * its only control lived in Settings → Layout → COVER LETTER FORMAT (antcv-cl-slogan-control).
 *
 * This sidecar surfaces the slogan AS AN ELEMENT of the cover-letter sections panel: a row
 * injected ABOVE the first CL section row (Greeting), with rich_block-grade affordances —
 * show/hide, inline text edit, CJLR alignment. It is PURE UI over the SAME restore-safe
 * standalone keys (antcv:clSlogan / -Hidden / -Align — see sidecar-prefs-clobber-hazard:
 * these keys exist because cloud-restore clobbered section-based prose; the slogan's data
 * deliberately does NOT move into sections.cl here). Phase 2 (row 22) = the real sections.cl
 * rich_block object, which needs coordinated dedupe at the 3 render sites + the worker.
 *
 * Anchor: the deepest node whose text equals the first CL section title, whose ancestor row
 * carries the ▲ move button (panel rows only — the on-paper preview has no move buttons),
 * inside a container that also shows the last CL title. Foreign-DOM safety: the app loads
 * antcv-react-dom-guard.js; commit-on-change (not per-keystroke) keeps the sections-updated
 * re-render from stealing the caret.
 * Kill switch: localStorage['antcv:disable-cl-slogan-element']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.90-cl-slogan-element';
  if (window.__antcvClSloganElement) return;
  window.__antcvClSloganElement = VERSION;

  var ACCENT = '#01B7BB';
  var K = { text: 'antcv:clSlogan', hidden: 'antcv:clSloganHidden', align: 'antcv:clSloganAlign' };

  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function disabled() { var v = get('antcv:disable-cl-slogan-element', '0'); return v === '1' || v === 'true'; }
  function bump() { try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-slogan-element' } })); } catch (_) {} }

  // Effective slogan the CL renders: override key, else the specialisation subtitle,
  // uppercased with " | " shown as " • " (same derivation as the render sites).
  function subtitleFallback() {
    function fromObj(o) {
      try { return String((o && (o.subtitle || o.specialization || (o.meta && o.meta.subtitle))) || ''); } catch (_) { return ''; }
    }
    var s = '';
    try { s = fromObj(JSON.parse(localStorage.getItem('kernelShowcase') || '{}')); } catch (_) {}
    if (!s) { try { s = fromObj(JSON.parse(localStorage.getItem('personalInfo') || '{}')); } catch (_) {} }
    s = String(s || '').replace(/\s*\|\s*/g, ' • ').trim();
    if (!s || /^\[/.test(s)) return '';
    return s.toUpperCase();
  }
  function cfg() {
    var align = String(get(K.align, 'center')).replace(/["']/g, '').toLowerCase();
    if (align !== 'left' && align !== 'right' && align !== 'center') align = 'center';
    return { text: get(K.text, ''), hidden: get(K.hidden, '0') === '1', align: align };
  }
  function effectiveText() {
    var c = cfg();
    return (c.text ? c.text.toUpperCase() : subtitleFallback());
  }

  // ---- CL panel anchor discovery ----
  function clTitles() {
    try {
      var secs = JSON.parse(localStorage.getItem('sections') || '{}');
      var cl = secs && Array.isArray(secs.cl) ? secs.cl : [];
      var t = [];
      for (var i = 0; i < cl.length; i++) { if (cl[i] && cl[i].title) t.push(String(cl[i].title)); }
      return t;
    } catch (_) { return []; }
  }
  function rowOf(el) {
    // walk up to the panel ROW: the nearest ancestor that carries a ▲ move button
    var a = el;
    for (var i = 0; i < 7 && a && a !== document.body; i++) {
      try {
        var btns = a.querySelectorAll ? a.querySelectorAll('button') : [];
        for (var j = 0; j < btns.length; j++) {
          if (String(btns[j].textContent || '').trim() === '▲') return a;
        }
      } catch (_) {}
      a = a.parentElement;
    }
    return null;
  }
  function findFirstClRow() {
    var titles = clTitles();
    if (titles.length < 2) return null;
    var first = titles[0], last = titles[titles.length - 1];
    var nodes = document.querySelectorAll('div,span');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (String(el.textContent || '').trim() !== first) continue;
      if (el.querySelector && el.querySelector('div,span')) continue; // want the deepest match
      var row = rowOf(el);
      if (!row || !row.parentElement) continue;
      // CL-panel confirmation: the list container also shows the LAST cl title
      if (String(row.parentElement.textContent || '').indexOf(last) === -1) continue;
      return row;
    }
    return null;
  }

  // ---- the element row ----
  var openState = false;
  function alignBtn(txt, val, refresh) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = txt;
    b.style.cssText = 'padding:3px 8px;border-radius:5px;border:1px solid rgba(1,183,187,0.45);font-size:10px;font-weight:600;cursor:pointer;';
    b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); set(K.align, val); refresh(); bump(); });
    return b;
  }
  function buildRow() {
    var c = cfg();
    var box = document.createElement('div');
    box.setAttribute('data-antcv-cl-slogan-element', '1');
    box.style.cssText = 'margin:2px 0 4px 0;padding:6px 8px;border:1px dashed rgba(1,183,187,0.4);border-radius:6px;background:rgba(1,183,187,0.05);';

    var head = document.createElement('div');
    head.setAttribute('role', 'button');
    head.title = 'The teal tagline at the top of the cover letter — click to edit';
    head.style.cssText = 'cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.04em;color:' + ACCENT + ';display:flex;align-items:center;gap:6px;user-select:none;';
    var caret = document.createElement('span');
    caret.style.cssText = 'font-size:9px;opacity:.7;';
    var lbl = document.createElement('span');
    lbl.textContent = 'COVER LETTER SLOGAN';
    var preview = document.createElement('span');
    preview.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:400;font-size:9px;opacity:.65;color:#cdd;';
    var eye = document.createElement('button');
    eye.type = 'button';
    eye.title = 'Show / hide the slogan';
    eye.style.cssText = 'background:none;border:none;cursor:pointer;font-size:12px;padding:0 2px;line-height:1;';
    head.appendChild(caret); head.appendChild(lbl); head.appendChild(preview); head.appendChild(eye);

    var body = document.createElement('div');
    body.style.cssText = 'margin-top:6px;display:none;flex-direction:column;gap:6px;';
    var input = document.createElement('input');
    input.type = 'text';
    input.style.cssText = 'padding:5px 8px;font-size:11px;background:rgba(255,255,255,0.06);color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:4px;font-family:inherit;';
    // commit on change/Enter (NOT per keystroke): the sections-updated re-render would
    // rebuild this foreign row and steal the caret mid-word.
    function commit() {
      var v = String(input.value || '').trim();
      if (v) set(K.text, v); else del(K.text);
      refresh(); bump();
    }
    input.addEventListener('change', commit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    input.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
    var alignRow = document.createElement('div');
    alignRow.style.cssText = 'display:flex;align-items:center;gap:5px;font-size:10px;color:#cdd;';
    alignRow.appendChild(document.createTextNode('Align:'));
    var btns = {};
    [['Left', 'left'], ['Center', 'center'], ['Right', 'right']].forEach(function (p) {
      var b = alignBtn(p[0], p[1], refresh); btns[p[1]] = b; alignRow.appendChild(b);
    });
    var note = document.createElement('div');
    note.style.cssText = 'font-size:9px;opacity:.55;line-height:1.4;color:#cdd;';
    note.textContent = 'Leave empty to use the specialisation line. Same store as Settings → COVER LETTER FORMAT.';
    body.appendChild(input); body.appendChild(alignRow); body.appendChild(note);
    box.appendChild(head); box.appendChild(body);

    function refresh() {
      var c2 = cfg();
      caret.textContent = openState ? '▾' : '▸';
      body.style.display = openState ? 'flex' : 'none';
      var eff = effectiveText();
      preview.textContent = c2.hidden ? '(hidden)' : (eff || '(empty)');
      preview.style.textDecoration = c2.hidden ? 'line-through' : 'none';
      eye.textContent = c2.hidden ? '🚫' : '👁';
      if (document.activeElement !== input) input.value = c2.text;
      input.placeholder = subtitleFallback() || 'e.g. PROCESSES • PRODUCTS • PEOPLE';
      for (var k in btns) {
        var on = (k === c2.align);
        btns[k].style.background = on ? ACCENT : 'rgba(1,183,187,0.10)';
        btns[k].style.color = on ? '#04231f' : ACCENT;
      }
    }
    head.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      openState = !openState; refresh();
    });
    eye.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      set(K.hidden, cfg().hidden ? '0' : '1'); refresh(); bump();
    });
    refresh();
    box.__refresh = refresh;
    return box;
  }

  var mounted = null;
  function scan() {
    if (disabled()) {
      if (mounted && mounted.parentNode) mounted.parentNode.removeChild(mounted);
      mounted = null;
      return;
    }
    // drop duplicates (a re-render can orphan a stale copy before we re-anchor)
    var all = document.querySelectorAll('[data-antcv-cl-slogan-element]');
    for (var i = 1; i < all.length; i++) { if (all[i].parentNode) all[i].parentNode.removeChild(all[i]); }
    if (mounted && mounted.isConnected) { if (mounted.__refresh) mounted.__refresh(); return; }
    var row = findFirstClRow();
    if (!row) { mounted = null; return; }
    mounted = (all[0] && all[0].isConnected) ? all[0] : buildRow();
    if (!mounted.isConnected) row.parentElement.insertBefore(mounted, row);
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; scan(); }, 200); }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      if ((muts[i].addedNodes && muts[i].addedNodes.length) || (muts[i].removedNodes && muts[i].removedNodes.length)) { schedule(); return; }
    }
  });
  function start() { try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {} schedule(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);

  window.AntcvClSloganElement = { version: VERSION, scan: scan, _cfg: cfg, _effectiveText: effectiveText, _clTitles: clTitles };
})();
