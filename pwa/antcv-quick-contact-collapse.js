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
  var VERSION = '1.51.438-dedup-lift';
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
    'EU citizen',              // citizenship (canonical casing; placeholder match is indexOf on the new placeholder)
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
  // Name/Headline rows. We find it from an email/phone/linkedin input, or —
  // SETTINGS-PERSONAL-DEDUP-001 — from the Full Name input, since the 5
  // contact fields now live only in the "Review & Edit my data" dialog and
  // the Personal tab usually has no contact input at all.
  function columnFrom(input) {
    // climb to the direct child of a container that also holds other field rows
    var node = input;
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
    return null;
  }
  function findColumn() {
    var inputs = document.querySelectorAll('input');
    var i, found;
    for (i = 0; i < inputs.length; i++) {
      if (!isContactInput(inputs[i])) continue;
      found = columnFrom(inputs[i]);
      if (found) return found;
    }
    for (i = 0; i < inputs.length; i++) {
      if (String(inputs[i].placeholder || '').indexOf('Jane Doe') < 0) continue;
      found = columnFrom(inputs[i]);
      if (found) return found;
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
    var want = open ? 'true' : 'false';
    // SETTINGS-PERSONAL-STABILIZE-001 (owner 2026-07-04 "stabilise all the
    // jumps"): this rebuild ran UNCONDITIONALLY on every apply() pass — 939
    // childList + 313 aria-expanded mutations in 8s measured in the Personal
    // panel, feeding every settings observer. Repaint ONLY on a real state
    // change (the 211 flicker-fix pattern).
    if (h.getAttribute('aria-expanded') === want && h.firstChild) return;
    h.textContent = '';
    var tri = document.createElement('span');
    tri.setAttribute('aria-hidden', 'true');
    tri.textContent = open ? '▾' : '▸';
    tri.style.cssText = 'font-size:10px;opacity:0.8;';
    h.appendChild(tri);
    h.appendChild(document.createTextNode(' Quick contact details'));
    h.setAttribute('aria-expanded', want);
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

  // ORDER (owner 2026-06-17): the Personal panel is an order-based flex column
  // (app.js `yl`, style display:flex;flex-direction:column). Lay the top block as
  //   Import → Apply/Undo → "Name, contact…" caption → Full Name → Headline →
  //   Quick contact → (Writing Style at default order 0).
  // All moves are CSS `order` only (NO DOM mutation) so the import button can NOT
  // duplicate — that was the 1.50.584/586 trap (physically moving it made the
  // data-importer re-hook a second copy). The one exception is the caption, which
  // React renders in the column's PARENT (above the whole column); CSS order can't
  // pull it between siblings of a different container, so we hide React's original
  // and inject a sidecar-owned copy into the column just above Name.
  function setOrder(el, val) { if (el && el.style.order !== val) el.style.order = val; }

  // Walk `node` up to the element that is a DIRECT child of `col` (the orderable
  // flex item), or null if `node` is not inside `col`.
  function flexItem(col, node) {
    while (node && node.parentElement && node.parentElement !== col) node = node.parentElement;
    return (node && node.parentElement === col) ? node : null;
  }
  // Fallback when `col` (from findColumn) isn't `node`'s container — e.g. the
  // WritingStyle island re-parents the field rows, so the import box ends up a
  // sibling in the OUTER flex column while findColumn lands on an inner one.
  // Climb to the first ancestor whose parent is a flex COLUMN, and return that
  // ancestor (the orderable flex child of that column).
  function flexColumnItem(node) {
    for (var i = 0; node && node.parentElement && i < 12; i++, node = node.parentElement) {
      try {
        var cs = getComputedStyle(node.parentElement);
        if (cs.display === 'flex' && /column/.test(cs.flexDirection)) return node;
      } catch (_) {}
    }
    return null;
  }
  // First element anywhere whose trimmed text matches `re` (short text only).
  function elByText(re, max) {
    var all = document.querySelectorAll('button, a, div, span, label, p');
    for (var i = 0; i < all.length; i++) {
      var t = (all[i].textContent || '').trim();
      if (t && t.length < (max || 120) && re.test(t)) return all[i];
    }
    return null;
  }

  var CAP_RE = /Name, contact, work history/i;
  var CAP = 'data-antcv-name-caption';
  // Hide React's original caption (it sits in the column's parent, above everything)
  // and return a sidecar-owned copy placed as a direct child of `col` right before
  // the Name row, so `order` can seat it between Undo and Name.
  function placeCaption(col, nameItem) {
    if (!nameItem) return null;
    var orig = elByText(CAP_RE, 160);
    // don't treat our own copy as the original
    if (orig && orig.hasAttribute && orig.hasAttribute(CAP)) orig = null;
    if (orig && (!flexItem(col, orig))) {            // original lives outside the column → hide it
      if (orig.style.display !== 'none') orig.style.display = 'none';
    }
    var copy = col.querySelector('[' + CAP + ']');
    if (!copy) {
      copy = document.createElement('div');
      copy.setAttribute(CAP, '1');
      copy.textContent = 'Name, contact, work history, education, skills. Used in CV header, CL sign-off, AI prompts.';
      copy.style.cssText = 'color:rgba(255,255,255,0.3);font-size:10px;line-height:1.5;margin-bottom:10px;';
    }
    if (copy.parentElement !== col) { try { col.insertBefore(copy, nameItem); } catch (_) {} }
    return copy;
  }

  function liftIdentity(col, hdr, rows) {
    // Import box — CSS order only (never moved): seat it FIRST (-8, ahead of
    // Apply/Undo at -6). flexItem(col, …) failed because the import box isn't a
    // child of the col findColumn lands on after the WritingStyle island re-parents
    // the fields; flexColumnItem finds the box in its OWN flex column instead.
    var imp = document.querySelector('[data-antcv-import-replacement]') || elByText(/Import profile/i, 90);
    setOrder(flexItem(col, imp) || flexColumnItem(imp), '-8');
    // Apply + Undo share one flex row → ordering the row covers both.
    setOrder(flexItem(col, elByText(/Apply to user profile|↻\s*Apply|↺\s*Apply/i, 60)), '-6');
    setOrder(flexItem(col, elByText(/Undo last/i, 40)), '-6');
    var nameItem = topRowByPlaceholder(col, 'Jane Doe');
    setOrder(placeCaption(col, nameItem), '-5');                            // "Name, contact…" caption
    setOrder(nameItem, '-4');                                              // Full Name
    setOrder(topRowByPlaceholder(col, 'Senior Project Manager'), '-3');    // Headline
    setOrder(hdr, '-2');                                                   // Quick contact header
    for (var i = 0; i < rows.length; i++) setOrder(rows[i], '-2');         // contact rows
  }

  function apply() {
    var found = findColumn();
    if (!found) return;
    var col = found.col;
    var rows = contactRows(col);
    var hdr = null;

    // SETTINGS-PERSONAL-DEDUP-001: with the 5 contact fields removed from the
    // Personal tab the column normally has NO contact rows — the collapse
    // group only builds when rows exist; the identity lift below runs either way.
    if (rows.length) {
      // Insert / relocate the header immediately before the FIRST contact row.
      hdr = col.querySelector('[' + HDR + ']');
      if (!hdr) { hdr = buildHeader(); }
      if (hdr.nextSibling !== rows[0] || hdr.parentElement !== col) {
        try { col.insertBefore(hdr, rows[0]); } catch (_) {}
      }
      paintHeader(hdr);

      var open = isOpen();
      for (var i = 0; i < rows.length; i++) {
        // SETTINGS-PERSONAL-STABILIZE-001: stamp only when missing (was an
        // unconditional attribute write per row per pass — 939 mutations/8s).
        if (rows[i].getAttribute(ROW) !== '1') rows[i].setAttribute(ROW, '1');
        // Only touch display when it needs to change (avoids feeding the observer).
        var want = open ? '' : 'none';
        if (rows[i].style.display !== want) rows[i].style.display = want;
      }
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
