/* AntCV Publications & Patent — section-panel row button reorder (v1.40.278)
 * ──────────────────────────────────────────────────────────────────────
 * In the bottom-sheet section/preview panel, every section row has a
 * canonical right-side button order:
 *
 *     [◀] [📄1] [✨ Enhance] [→ Compress] [ON Visibility] [✕ Delete]
 *
 * Education and Regulatory Context render this correctly. Publications
 * & Patent renders incorrectly:
 *
 *     [◀] [📄1] [ON] [✕] [✨]
 *
 * — the native ✨ is at the end and there's no compress button.
 *
 * An earlier patch (antcv-section-panel-211.js) tries to inject a
 * cloned compress button via React-prop stripping, but its placement
 * logic doesn't move the native ✨ into position, so the row still
 * ends up with the wrong order.
 *
 * Approach
 * ────────
 *   1. Find every visible row whose uppercase text contains
 *      "PUBLICATIONS & PATENT" and which has ≥ 4 buttons (the section-
 *      header card, not just a heading element).
 *   2. Within that row, locate the right-side cluster of action
 *      buttons via the common parent of the classified buttons.
 *   3. Classify each button by visible text/title:
 *        back ◀ → order 10
 *        page 📄 → order 20
 *        enr ✨  → order 30
 *        comp → → order 40
 *        on    → order 50
 *        del ✕ → order 60
 *      Apply inline `style.order` to each. Up/down/move-row buttons
 *      and unclassified buttons get order 5 so they stay where they
 *      were (left of the cluster).
 *   4. If no compress button exists, clone one from a donor row
 *      (Education / Regulatory Context / Tools & Methods). The clone
 *      is stripped of React props, given order 40, inserted into the
 *      same parent, and wired with a click handler that compresses
 *      publication item detail fields in localStorage (defensive — if
 *      the data shape doesn't match expectations the action is a
 *      no-op, but the visual layout is corrected regardless).
 *
 * The patch never moves, removes, or hides React-rendered elements
 * other than the very buttons we're reordering inside the
 * Publications row's button cluster. Other sections are untouched.
 * Marker attributes make every change idempotent on re-runs.
 */
(function () {
  'use strict';
  var VERSION = '1.40.278';
  if (window.__antcvPublicationsSectionRow278 === VERSION) return;
  window.__antcvPublicationsSectionRow278 = VERSION;

  var ATTR_ROW       = 'data-antcv-pubrow-278';
  var ATTR_ORDER     = 'data-antcv-pubrow-order-278';
  var ATTR_KIND      = 'data-antcv-pubrow-kind-278';
  var ATTR_COMP_INJ  = 'data-antcv-pubrow-comp-injected-278';

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function low(s)   { return clean(s).toLowerCase(); }
  function visible(el) {
    return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight ||
      (el.getClientRects && el.getClientRects().length)));
  }
  function btext(b) {
    if (!b) return '';
    var t = clean(b.textContent || '');
    var ti = b.getAttribute && clean(b.getAttribute('title') || '');
    var al = b.getAttribute && clean(b.getAttribute('aria-label') || '');
    return low((t || '') + ' ' + (ti || '') + ' ' + (al || ''));
  }

  // Classify a button by what it visually represents.
  // Returns one of: 'back', 'page', 'enr', 'comp', 'on', 'del', or ''.
  // We check textContent on its own first (for tight matches like "ON"
  // that would otherwise be diluted by repeated title/aria-label noise)
  // and fall back to the combined string for looser keyword matches.
  function classify(b) {
    if (!b) return '';
    var tc = low(clean(b.textContent || ''));
    var combined = btext(b);
    if (/✕|×/.test(tc) || /\bdelete\b|\bremove\b/.test(combined)) return 'del';
    // Visibility: text content alone says "on"/"off"/eye glyph, OR
    // combined text mentions toggle/visibility/hide/show.
    if (/^(on|off)$/.test(tc) || /[\u{1F441}\u{1F648}]/u.test(tc) ||
        /\btoggle\b|\bvisibility\b|\bvisible\b|\bhide\b|\bshow\b/.test(combined)) return 'on';
    if (/✨/.test(tc) || /\benhance\b|\benrich\b/.test(combined)) return 'enr';
    if (/⇥⇤|↹|→/.test(tc) || /\bcompress\b|\bcomp\./.test(combined)) return 'comp';
    if (/📄/.test(tc) || /^\d+$/.test(tc) || /\bpage\b/.test(combined)) return 'page';
    if (/◀|◁|⮜|‹/.test(tc) || /^\s*back\s*$/.test(combined)) return 'back';
    return '';
  }

  // Walk up from a button until we find an ancestor whose uppercase
  // textContent contains "PUBLICATIONS & PATENT" — the row.
  function findPublicationsRow(startBtn) {
    var p = startBtn ? startBtn.parentElement : null;
    for (var i = 0; p && p !== document.body && i < 8; i++, p = p.parentElement) {
      var t = clean(p.textContent || '').toUpperCase();
      if (t.length > 500) return null;  // walked too high
      if (/PUBLICATIONS\s*(?:&|AND)\s*PATENT/.test(t)) {
        // Only count it as a row if it holds several buttons.
        if (p.querySelectorAll('button').length >= 4) return p;
      }
    }
    return null;
  }

  function findAllPublicationsRows() {
    var seen = [];
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      if (!visible(btns[i])) continue;
      var row = findPublicationsRow(btns[i]);
      if (row && seen.indexOf(row) < 0) seen.push(row);
    }
    return seen;
  }

  // Find a row from another section that has a real compress button we
  // can clone as a stylistic template. Prefer Education > Regulatory >
  // Tools&Methods > anything else.
  var DONOR_SECTIONS = [
    'EDUCATION', 'REGULATORY CONTEXT', 'TOOLS & METHODS', 'CERTIFICATIONS', 'ADDITIONAL INFORMATION'
  ];
  function findDonorCompress() {
    var btns = document.querySelectorAll('button');
    var candidatesBySection = {};
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!visible(b)) continue;
      if (classify(b) !== 'comp') continue;
      // Find what section this belongs to.
      var p = b.parentElement;
      for (var j = 0; p && j < 6; j++, p = p.parentElement) {
        var t = clean(p.textContent || '').toUpperCase();
        if (t.length > 500) break;
        for (var k = 0; k < DONOR_SECTIONS.length; k++) {
          if (t.indexOf(DONOR_SECTIONS[k]) >= 0 && !/PUBLICATIONS/.test(t)) {
            if (!candidatesBySection[DONOR_SECTIONS[k]]) candidatesBySection[DONOR_SECTIONS[k]] = b;
            break;
          }
        }
      }
    }
    for (var s = 0; s < DONOR_SECTIONS.length; s++) {
      if (candidatesBySection[DONOR_SECTIONS[s]]) return candidatesBySection[DONOR_SECTIONS[s]];
    }
    return null;
  }

  function cloneDonor(donor) {
    var b = donor.cloneNode(true);
    b.removeAttribute('id');
    b.setAttribute(ATTR_COMP_INJ, '1');
    b.setAttribute(ATTR_KIND, 'comp');
    b.title = 'Compress publication details';
    b.setAttribute('aria-label', 'Compress publication details');
    // Strip React internal handlers so our click listener is the only one.
    for (var i = 0, keys = Object.keys(b); i < keys.length; i++) {
      var k = keys[i];
      if (/^__react/.test(k) || k === 'onclick') {
        try { delete b[k]; } catch (_) {}
      }
    }
    return b;
  }

  // Defensive localStorage-side compress: try to shorten string fields
  // of publication items if we can find them. Returns whether anything
  // changed.
  function compressViaStorage() {
    try {
      var raw = window.localStorage && window.localStorage.getItem('sections');
      if (!raw) return false;
      var bundle = JSON.parse(raw);
      if (!bundle || typeof bundle !== 'object') return false;
      var doc = (window.localStorage.getItem('doc') === 'cl') ? 'cl' : 'cv';
      var list = Array.isArray(bundle) ? bundle : bundle[doc];
      if (!Array.isArray(list)) return false;

      var anyChange = false;
      function compress(s) {
        return clean(s)
          .replace(/\bpublished in\b/ig, 'in')
          .replace(/\bpublication in\b/ig, 'in')
          .replace(/\bpatent number\b/ig, 'patent')
          .replace(/\bapproximately\b/ig, 'approx.')
          .replace(/\s+([,.;:])/g, '$1');
      }
      for (var i = 0; i < list.length; i++) {
        var s = list[i];
        if (!s || typeof s !== 'object') continue;
        var tag = String(s.id || s.title || s.name || s.type || '').toLowerCase();
        if (!/publication|patent/.test(tag)) continue;
        if (Array.isArray(s.items)) {
          for (var ii = 0; ii < s.items.length; ii++) {
            var item = s.items[ii];
            if (!item || typeof item !== 'object') continue;
            var keys = ['detail', 'body', 'description', 'value', 'content', 'journal', 'year'];
            for (var kk = 0; kk < keys.length; kk++) {
              var key = keys[kk];
              if (typeof item[key] === 'string') {
                var c = compress(item[key]);
                if (c !== item[key]) { item[key] = c; anyChange = true; }
              }
            }
          }
        }
        if (Array.isArray(s.bullets)) {
          for (var bi = 0; bi < s.bullets.length; bi++) {
            if (typeof s.bullets[bi] === 'string') {
              var cb = compress(s.bullets[bi]);
              if (cb !== s.bullets[bi]) { s.bullets[bi] = cb; anyChange = true; }
            }
          }
        }
      }
      if (anyChange) {
        try { window.localStorage.setItem('sections', JSON.stringify(bundle)); } catch (_) {}
        try {
          window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
            detail: { source: 'publications-section-row-fix-278' },
          }));
        } catch (_) {}
      }
      return anyChange;
    } catch (e) {
      try { console.warn('[publications-section-row-fix-278] compress error:', e && e.message); } catch (_) {}
      return false;
    }
  }

  function wireCompress(btn) {
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      compressViaStorage();
    }, true);
  }

  function setOrder(el, n) {
    if (!el) return;
    el.style.order = String(n);
    el.setAttribute(ATTR_ORDER, String(n));
  }

  function fixRow(row) {
    if (!row) return;
    if (row.getAttribute(ATTR_ROW) === '1') {
      // Re-classification still valid; refresh ordering only.
    } else {
      row.setAttribute(ATTR_ROW, '1');
    }

    var rowButtons = Array.prototype.filter.call(
      row.querySelectorAll('button'),
      function (b) { return visible(b); }
    );

    // Classify each button.
    var byKind = { back: null, page: null, enr: null, comp: null, on: null, del: null };
    var unclassified = [];
    for (var i = 0; i < rowButtons.length; i++) {
      var b = rowButtons[i];
      // v1.40.278-excl273: EXCLUSION-ONLY. 278 is for the section-HEADER
      // card row only. The strict-row-layout sidecar (273) owns the
      // per-item editor rows (name + journal inputs + their eye/delete/move/
      // page/cjlr/compress/enhance controls). Re-classifying a 273-owned
      // per-item button stamped it kind=on/del at order 50/60, fighting
      // 273's order 40/50 and breaking the per-item row layout (blank gap,
      // mis-placed eye/delete). Skip anything 273 manages — never broadens
      // 278's scope, only narrows it.
      if (b.hasAttribute('data-antcv-pub273-eye') ||
          b.hasAttribute('data-antcv-pub273-delete') ||
          b.hasAttribute('data-antcv-pub273-move') ||
          b.hasAttribute('data-antcv-pub273-control') ||
          (b.closest && b.closest('[data-antcv-pub273-row="1"]'))) {
        continue;
      }
      var k = classify(b);
      if (k && !byKind[k]) {
        byKind[k] = b;
        b.setAttribute(ATTR_KIND, k);
      } else {
        unclassified.push(b);
      }
    }

    // Find the right-side cluster: the common parent of the classified
    // buttons (page/enr/on/del — these always sit together on the right).
    var ofInterest = [byKind.page, byKind.enr, byKind.on, byKind.del].filter(Boolean);
    if (!ofInterest.length) return;
    var cluster = ofInterest[0].parentElement;
    while (cluster && cluster !== row) {
      var allIn = true;
      for (var oi = 0; oi < ofInterest.length; oi++) {
        if (!cluster.contains(ofInterest[oi])) { allIn = false; break; }
      }
      if (allIn) break;
      cluster = cluster.parentElement;
    }
    if (!cluster || cluster === row) cluster = ofInterest[0].parentElement;

    // Ensure the cluster lays out as flex so `order` takes effect.
    try {
      var cs = window.getComputedStyle ? window.getComputedStyle(cluster) : null;
      if (cs && cs.display.indexOf('flex') < 0) cluster.style.display = 'flex';
    } catch (_) {}

    // Apply order to the classified buttons.
    setOrder(byKind.back, 10);
    setOrder(byKind.page, 20);
    setOrder(byKind.enr, 30);
    setOrder(byKind.comp, 40);
    setOrder(byKind.on,   50);
    setOrder(byKind.del,  60);

    // Keep any unclassified buttons that happen to live in the cluster
    // anchored to the left (default order 0) but explicitly set to 5 so
    // they're predictable. Unclassified buttons outside the cluster are
    // left alone (e.g., the ▲/▼ move-row buttons in their own column).
    for (var u = 0; u < unclassified.length; u++) {
      if (cluster.contains(unclassified[u])) setOrder(unclassified[u], 5);
    }

    // Inject compress if missing.
    if (!byKind.comp) {
      var donor = findDonorCompress();
      if (donor) {
        var compClone = cloneDonor(donor);
        // Match local sizing of the row's enhance button if we have one
        // — same height looks tidier than donor's section-header sizing.
        if (byKind.enr) {
          try {
            var enrCs = window.getComputedStyle ? window.getComputedStyle(byKind.enr) : null;
            if (enrCs) {
              if (enrCs.width)  compClone.style.width  = enrCs.width;
              if (enrCs.height) compClone.style.height = enrCs.height;
              if (enrCs.minWidth)  compClone.style.minWidth  = enrCs.minWidth;
              if (enrCs.minHeight) compClone.style.minHeight = enrCs.minHeight;
            }
          } catch (_) {}
        }
        setOrder(compClone, 40);
        // Insert into the same cluster, before ON if present, else before
        // DEL, else append.
        if (byKind.on  && byKind.on.parentElement === cluster)  cluster.insertBefore(compClone, byKind.on);
        else if (byKind.del && byKind.del.parentElement === cluster) cluster.insertBefore(compClone, byKind.del);
        else cluster.appendChild(compClone);
        wireCompress(compClone);
      }
    }
  }

  function injectCss() {
    if (document.getElementById('antcv-publications-section-panel-row-278-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-publications-section-panel-row-278-css';
    s.textContent = [
      // Visual reset on the injected compress button so it doesn't carry
      // over awkward attributes from its donor section header.
      '[' + ATTR_COMP_INJ + '="1"]{order:40!important;}',
      '[' + ATTR_KIND + '="back"]{order:10!important;}',
      '[' + ATTR_KIND + '="page"]{order:20!important;}',
      '[' + ATTR_KIND + '="enr"] {order:30!important;}',
      '[' + ATTR_KIND + '="comp"]{order:40!important;}',
      '[' + ATTR_KIND + '="on"]  {order:50!important;}',
      '[' + ATTR_KIND + '="del"] {order:60!important;}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      injectCss();
      try {
        var rows = findAllPublicationsRows();
        for (var i = 0; i < rows.length; i++) {
          try { fixRow(rows[i]); } catch (e) {
            try { console.warn('[publications-section-row-fix-278]', e && e.message); } catch (_) {}
          }
        }
      } catch (_) {}
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
  var delays = [80, 200, 500, 1000, 2000, 4000];
  for (var di = 0; di < delays.length; di++) setTimeout(schedule, delays[di]);

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
      attributes: true, attributeFilter: ['class', 'style', 'title', 'aria-label']
    });
  } catch (_) {}

  window.addEventListener('click', function () { setTimeout(schedule, 0); }, true);
  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvPublicationsSectionRow278 = {
    version: VERSION,
    run: schedule,
    _compressViaStorage: compressViaStorage,
    _classify: classify,
  };
})();
