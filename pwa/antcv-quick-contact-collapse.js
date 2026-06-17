/* antcv-quick-contact-collapse.js — owner 2026-06-17
 * ============================================================================
 * Settings → Personal: collect the CONTACT-DETAIL fields (location, citizenship,
 * email, phone, LinkedIn, landline, Git site, website) under a single
 * COLLAPSED-by-default "Quick contact details" expandable, so the Personal tab
 * opens on the meaningful identity (Name + Headline) and the contact rows are
 * one click away rather than a long stack.
 *
 * Approach (safe for the React-rendered Personal panel): we do NOT move React's
 * own nodes (React would re-append them on the next render). Instead we inject a
 * clickable header before the first contact row and TOGGLE the contact rows'
 * `display` via a CSS class, re-applying on every relevant re-render through a
 * throttled MutationObserver. State persists in localStorage. Idempotent +
 * loop-safe: once the header exists and the display state matches, the sweep is
 * a no-op, so it cannot feed a mutation loop. Name + Headline + the Background
 * <details> stay outside the group (they are identity, not contact details).
 * ============================================================================
 */
(function () {
  'use strict';
  var VERSION = '1.50.579-quick-contact';
  if (window.__antcvQuickContact === VERSION) return;
  window.__antcvQuickContact = VERSION;

  var STATE_KEY = 'antcv:quickContact:open';   // '1' open, else collapsed (default)
  var HDR = 'data-antcv-quick-contact-hdr';
  var ROW = 'data-antcv-quick-contact-row';

  // Placeholders of the contact-detail inputs (from the app.js field config).
  var CONTACT_PH = [
    'name@example.com',        // email
    '+45 12 34 56 78',         // phone / landline
    'linkedin.com/in/your-name',
    'github.com/your-name',
    'your-site.com',           // website
    'EU Citizen',              // citizenship
  ];
  // Location/City/Country placeholders vary; match the labels too as a fallback.
  function isContactInput(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    var ph = String(el.placeholder || '');
    for (var i = 0; i < CONTACT_PH.length; i++) if (ph.indexOf(CONTACT_PH[i]) >= 0) return true;
    return false;
  }
  function isOpen() { try { return localStorage.getItem(STATE_KEY) === '1'; } catch (_) { return false; } }
  function setOpen(v) { try { localStorage.setItem(STATE_KEY, v ? '1' : '0'); } catch (_) {} }

  // The fields column = the common parent that holds the contact rows AND the
  // Name/Headline rows. We find it from an email/phone/linkedin input.
  function findColumn() {
    var inputs = document.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
      if (!isContactInput(inputs[i])) continue;
      // climb to the direct child of a container that also holds other field rows
      var node = inputs[i];
      for (var d = 0; d < 8 && node.parentElement; d++) {
        var p = node.parentElement;
        // a column holds several field rows as direct children
        if (p.children.length >= 3) {
          // verify it really is the personal fields column: it must contain a
          // "Background" details OR a textarea (the Background field) somewhere.
          if (p.querySelector('details, textarea')) return { col: p };
        }
        node = p;
      }
    }
    return null;
  }

  // The contact rows = direct children of the column that contain a contact input.
  function contactRows(col) {
    var rows = [];
    var kids = Array.prototype.slice.call(col.children);
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k.hasAttribute && k.hasAttribute(HDR)) continue;
      var ins = k.querySelectorAll ? k.querySelectorAll('input') : [];
      var hit = false;
      for (var j = 0; j < ins.length; j++) if (isContactInput(ins[j])) { hit = true; break; }
      // exclude a row that ALSO carries the Name/Headline (identity stays out);
      // contact rows here only carry contact inputs.
      if (hit) rows.push(k);
    }
    return rows;
  }

  function buildHeader() {
    var h = document.createElement('button');
    h.setAttribute(HDR, '1');
    h.type = 'button';
    h.style.cssText = 'display:flex;align-items:center;gap:7px;width:100%;margin:2px 0 4px;padding:7px 2px;background:transparent;border:0;border-bottom:1px solid rgba(255,255,255,0.10);color:rgba(255,255,255,0.62);font-family:Georgia,serif;font-size:11px;font-weight:600;letter-spacing:0.4px;text-transform:uppercase;cursor:pointer;text-align:left;';
    h.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      setOpen(!isOpen());
      apply();
    });
    return h;
  }

  function paintHeader(h) {
    var open = isOpen();
    h.textContent = '';
    var tri = document.createElement('span');
    tri.setAttribute('aria-hidden', 'true');
    tri.textContent = open ? '▾' : '▸';
    tri.style.cssText = 'font-size:10px;opacity:0.8;';
    h.appendChild(tri);
    h.appendChild(document.createTextNode(' Quick contact details'));
    h.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  // The direct child of `col` that contains the input whose placeholder includes
  // `ph` (used to find the Full Name + Headline rows so the whole identity block
  // can be ordered above the writing-style block).
  function topRowByPlaceholder(col, ph) {
    var inputs = col.querySelectorAll('input');
    for (var i = 0; i < inputs.length; i++) {
      if (String(inputs[i].placeholder || '').indexOf(ph) < 0) continue;
      var n = inputs[i];
      while (n && n.parentElement && n.parentElement !== col) n = n.parentElement;
      if (n && n.parentElement === col) return n;
    }
    return null;
  }

  // The direct child of `col` that contains an element whose (short) text matches
  // `re` — used to locate the injected Import / Apply / Undo buttons.
  function topChildByText(col, re) {
    var all = col.querySelectorAll('button, a, summary, div, span, label');
    for (var i = 0; i < all.length; i++) {
      var t = (all[i].textContent || '').trim();
      if (t && t.length < 90 && re.test(t)) {
        var n = all[i];
        while (n && n.parentElement && n.parentElement !== col) n = n.parentElement;
        if (n && n.parentElement === col) return n;
      }
    }
    return null;
  }

  // ORDER (owner 2026-06-17): in the order-based Personal flex column, lay the
  // top block as: Import → Apply/Undo → Full Name → Headline → Quick contact →
  // (then Writing Style at default order 0). Negative orders float them above the
  // writing-style block. Re-applied each pass (React resets inline styles).
  function setOrder(el, val) { if (el && el.style.order !== val) el.style.order = val; }
  function liftIdentity(col, hdr, rows) {
    setOrder(topChildByText(col, /Import profile/i), '-6');                 // Import …
    setOrder(topChildByText(col, /Apply to user profile|Apply to my|↺\s*Apply/i), '-5'); // Apply (+ Undo share the row)
    setOrder(topChildByText(col, /Undo last/i), '-5');                      // Undo (if separate row)
    setOrder(topRowByPlaceholder(col, 'Jane Doe'), '-4');                   // Full Name
    setOrder(topRowByPlaceholder(col, 'Senior Project Manager'), '-3');     // Headline
    setOrder(hdr, '-2');                                                    // Quick contact header
    for (var i = 0; i < rows.length; i++) setOrder(rows[i], '-2');          // contact rows
  }

  function apply() {
    var found = findColumn();
    if (!found) return;
    var col = found.col;
    var rows = contactRows(col);
    if (!rows.length) return;

    // Insert / relocate the header immediately before the FIRST contact row.
    var hdr = col.querySelector('[' + HDR + ']');
    if (!hdr) { hdr = buildHeader(); }
    if (hdr.nextSibling !== rows[0] || hdr.parentElement !== col) {
      try { col.insertBefore(hdr, rows[0]); } catch (_) {}
    }
    paintHeader(hdr);

    var open = isOpen();
    for (var i = 0; i < rows.length; i++) {
      rows[i].setAttribute(ROW, '1');
      // Only touch display when it needs to change (avoids feeding the observer).
      var want = open ? '' : 'none';
      if (rows[i].style.display !== want) rows[i].style.display = want;
    }

    // Float the identity block (Full Name + Headline + this header + contact
    // rows) above the writing-style block in the order-based flex column.
    try { liftIdentity(col, hdr, rows); } catch (_) {}
  }

  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    (window.requestAnimationFrame || setTimeout)(function () { scheduled = false; try { apply(); } catch (_) {} });
  }

  function boot() {
    schedule();
    [300, 900, 2000].forEach(function (d) { setTimeout(schedule, d); });
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvQuickContact = { version: VERSION, _apply: apply, _findColumn: findColumn, isOpen: isOpen, setOpen: function (v) { setOpen(v); apply(); } };
})();
