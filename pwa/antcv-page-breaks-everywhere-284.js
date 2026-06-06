/* AntCV page breaks everywhere (v1.40.284)
 * ──────────────────────────────────────────────────────────────────────
 *
 * Problem
 * ───────
 *   Only Professional Experience's per-row page button actually
 *   produces a visible page break + continuation header in the
 *   preview. All other sections' page buttons cycle 📄1 → 📄2 → 📄3 →
 *   📄4 visually and persist to localStorage['antcv:itemPages'], but
 *   nothing appears in the preview.
 *
 *   Two reasons:
 *     (a) The existing centralised renderer
 *         antcv-item-pages-render.js (v1.40.194) only processes
 *         sections whose `type` is in `{labeled_list, list,
 *         education}`. If a user's sections have other types (e.g.
 *         `experience`, `bullets`, `table`), they are skipped.
 *     (b) Even when v194 runs, its inserted `page-break-before`
 *         spacer is a 0-height invisible element — it only affects
 *         print media. The continuation header is the only visible
 *         indicator. On a continuous-scroll preview, that's easy to
 *         miss; users expect the same visible "▼ PAGE N ▼" bar that
 *         Professional Experience shows.
 *
 * Approach (this patch, v1.40.284)
 * ────────────────────────────────
 *   1. Walk EVERY [data-sid] section in the preview paper.
 *   2. Skip Professional Experience — app.js handles it natively.
 *   3. Skip any section where v194 already inserted breaks (we leave
 *      v194's markers in place — no double-rendering).
 *   4. For every remaining section, read
 *      localStorage['antcv:itemPages'][sid] and find items mapped to
 *      page >= 2.
 *   5. Find item elements: primary anchor
 *      `[data-antcv-row-path^="items."]`; fallback to direct block
 *      children that aren't headings or markers.
 *   6. Insert TWO visible markers before each break-flagged item:
 *        • A "▼ PAGE N ▼" divider bar in soft amber, full-width.
 *        • A "<SECTION TITLE> (CONT.)" header in section teal, styled
 *          to match v194's continuation header.
 *   7. Idempotent: every injection is tagged with our own data attr.
 *      On each tick we remove our own tags, recompute, re-insert.
 *
 * Triggers (in addition to v194's own observers)
 * ──────────────────────────────────────────────
 *   - storage event on `antcv:itemPages` (cross-tab)
 *   - custom `antcv:item-pages-changed` and `antcv:sections-updated`
 *   - click on any button that looks like a page cycler (📄 glyph or
 *     pure digit textContent) — fires for same-tab page-button taps
 *     where setItem doesn't dispatch storage events.
 *   - MutationObserver on body for non-our DOM changes
 *   - Periodic safety net every 2 seconds
 */
(function () {
  'use strict';
  var VERSION = '1.50.202-native-render-retired';
  if (window.__antcvPageBreaksEverywhere284 === VERSION) return;
  window.__antcvPageBreaksEverywhere284 = VERSION;

  var STORAGE_KEY  = 'antcv:itemPages';
  var SECTIONS_KEY = 'sections';
  var MARK_ATTR    = 'data-antcv-page-break-284';
  var HEADER_ATTR  = 'data-antcv-cont-header-284';
  var BAR_ATTR     = 'data-antcv-page-bar-284';

  function readMap() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var v = JSON.parse(raw);
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    } catch (_) { return {}; }
  }
  function activeDoc() {
    try { var v = localStorage.getItem('doc'); if (v === 'cv' || v === 'cl') return v; } catch (_) {}
    return 'cv';
  }
  function readSection(sid) {
    try {
      var raw = localStorage.getItem(SECTIONS_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      var list = parsed && parsed[activeDoc()];
      if (!Array.isArray(list)) return null;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === sid) return list[i];
      }
    } catch (_) {}
    return null;
  }
  function getSectionTitle(sid) {
    var sec = readSection(sid);
    if (!sec) return '';
    return String(sec.title || sec.name || '').trim().toUpperCase();
  }

  function findPaper() {
    return document.querySelector(
      '.antcv-preview-paper, [data-antcv-preview-paper], ' +
      '.preview-paper, .cv-preview-paper, [data-preview-paper]'
    );
  }

  // Find items within a section using multiple fallback strategies.
  function findItems(sectionEl) {
    // Primary: data-antcv-row-path.
    var items = [];
    var seen = {};
    var nodes = sectionEl.querySelectorAll('[data-antcv-row-path^="items."]');
    for (var i = 0; i < nodes.length; i++) {
      var path = nodes[i].getAttribute('data-antcv-row-path') || '';
      if (seen[path]) continue;
      seen[path] = true;
      items.push(nodes[i]);
    }
    if (items.length) return items;
    // Fallback 1: direct children that aren't headings or our markers.
    items = [];
    for (var c = 0; c < sectionEl.children.length; c++) {
      var ch = sectionEl.children[c];
      var tag = ch.tagName ? ch.tagName.toLowerCase() : '';
      if (/^(h[1-6]|hr|style|script)$/.test(tag)) continue;
      if (ch.getAttribute('data-antcv-page-break') === '1') continue;
      if (ch.getAttribute('data-antcv-continuation-header') === '1') continue;
      if (ch.getAttribute(MARK_ATTR)   === '1') continue;
      if (ch.getAttribute(HEADER_ATTR) === '1') continue;
      if (ch.getAttribute(BAR_ATTR)    === '1') continue;
      items.push(ch);
    }
    return items;
  }

  function clearOurMarkers(sectionEl) {
    var sel = '[' + MARK_ATTR + '="1"], [' + HEADER_ATTR + '="1"], [' + BAR_ATTR + '="1"]';
    var ours = sectionEl.querySelectorAll(sel);
    for (var i = 0; i < ours.length; i++) {
      try { ours[i].parentNode && ours[i].parentNode.removeChild(ours[i]); } catch (_) {}
    }
  }

  function makeBar(pageN) {
    var d = document.createElement('div');
    d.setAttribute(BAR_ATTR, '1');
    d.setAttribute('aria-hidden', 'true');
    // 1.50.190: the owner prefers the LIGHT Professional-Experience splitter —
    // a thin salmon top border over a faint salmon wash with a small centered
    // "▼ PAGE N ▼" badge — not the old heavy full-width pink bar. Matches the
    // CV experience splitter app.js draws (borderTop 3px / bg 0.06 / small badge).
    d.style.cssText = [
      'border-top:3px solid rgba(200,40,40,0.6)', 'margin:12px 0 4px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'background:rgba(200,40,40,0.06)', 'padding:3px 0',
      'width:100%', 'box-sizing:border-box'
    ].join(';');
    var badge = document.createElement('span');
    badge.style.cssText = [
      'background:rgba(200,40,40,0.7)', 'color:#fff', 'font-size:8px',
      'padding:2px 10px', 'border-radius:2px', 'font-family:Arial,sans-serif',
      'letter-spacing:0.5px', 'white-space:nowrap'
    ].join(';');
    badge.textContent = '▼ PAGE ' + pageN + ' ▼';
    d.appendChild(badge);
    return d;
  }
  function makeBreak() {
    var d = document.createElement('div');
    d.setAttribute(MARK_ATTR, '1');
    d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'break-before:page;page-break-before:always;height:0;margin:0;padding:0;line-height:0';
    return d;
  }
  // PB-003: continuation suffix is localised via antcv-i18n (key
  // 'pb.cont'). Falls back to the English '(CONT.)' if i18n hasn't
  // installed yet (very early boot — rare and self-corrects on the
  // next applyAll tick).
  function contSuffix() {
    var i18n = window.AntcvI18n;
    if (i18n && typeof i18n.t === 'function') {
      return i18n.t('pb.cont', '(CONT.)');
    }
    return '(CONT.)';
  }
  function makeContHeader(title) {
    var d = document.createElement('div');
    d.setAttribute(HEADER_ATTR, '1');
    // PB-003: margin-top set to 18pt so the continuation heading
    // sits 18pt below whatever @page top margin the print engine
    // uses. In Preview's continuous-scroll layout the same value
    // gives clear visual separation between the boundary marker
    // and the heading.
    d.style.cssText = [
      'color:#00746E', 'font-weight:700', 'font-size:14pt',
      'margin-top:18pt', 'margin-bottom:4pt',
      'border-bottom:1pt solid #00746E', 'padding-bottom:2pt',
      'font-family:Trebuchet MS, Calibri, sans-serif'
    ].join(';');
    d.textContent = title + ' ' + contSuffix();
    return d;
  }

  // Don't process Professional Experience — app.js handles it natively.
  function isProfessionalExperience(title) {
    return /PROFESSIONAL\s+EXPERIENCE|^EXPERIENCE$/.test(title);
  }

  function hasV194Markers(sectionEl) {
    return !!sectionEl.querySelector(
      '[data-antcv-page-break="1"], [data-antcv-continuation-header="1"]'
    );
  }

  function applySection(sectionEl, sid) {
    // 1.50.202: page breaks are now rendered natively in app.js (React) from the
    // same itemPages model — see docs/plan/page-break-architecture.md. Sidecar DOM
    // injection is retired (React reconciled it away, which is why preview salmon
    // never stuck). We only sweep up any markers a prior version left behind so
    // there is no double render, then bail. Panel chips live in the row-control
    // sidecars and are untouched.
    clearOurMarkers(sectionEl);
    return;
    var title = getSectionTitle(sid);
    if (isProfessionalExperience(title)) return;
    // If v194 already inserted markers, just remove ours and leave its.
    if (hasV194Markers(sectionEl)) {
      clearOurMarkers(sectionEl);
      return;
    }
    clearOurMarkers(sectionEl);

    var map = readMap();
    var bucket = map[sid];
    if (!bucket || typeof bucket !== 'object') return;

    var pageByIndex = {};
    var keys = Object.keys(bucket);
    for (var k = 0; k < keys.length; k++) {
      var n = Number(bucket[keys[k]]);
      var i = parseInt(keys[k], 10);
      if (Number.isFinite(i) && Number.isFinite(n) && n >= 2) pageByIndex[i] = n;
    }
    var anyBreak = false;
    for (var key in pageByIndex) { if (pageByIndex.hasOwnProperty(key)) { anyBreak = true; break; } }
    if (!anyBreak) return;

    var items = findItems(sectionEl);
    if (!items.length) return;
    title = title || 'SECTION';

    for (var ii = 0; ii < items.length; ii++) {
      if (!pageByIndex.hasOwnProperty(ii)) continue;
      var target = items[ii];
      var parent = target.parentNode;
      if (!parent) continue;
      try {
        if (ii === 0) {
          // PB-002: a page break on the FIRST item moves the whole
          // section to the next page. The section's own native
          // heading is the first element on the new page — do NOT
          // inject a (CONT.) header (would duplicate the heading).
          // Insert the boundary marker INSIDE the section but before
          // its first child so the section heading itself sits after
          // the break.
          var firstChild = sectionEl.firstChild;
          if (firstChild) {
            sectionEl.insertBefore(makeBar(pageByIndex[ii]), firstChild);
            sectionEl.insertBefore(makeBreak(), firstChild);
          } else {
            sectionEl.appendChild(makeBar(pageByIndex[ii]));
            sectionEl.appendChild(makeBreak());
          }
        } else {
          parent.insertBefore(makeBar(pageByIndex[ii]), target);
          parent.insertBefore(makeBreak(), target);
          parent.insertBefore(makeContHeader(title), target);
        }
      } catch (_) {}
    }
  }

  function applyAll() {
    var paper = findPaper();
    if (!paper) return;
    var sections = paper.querySelectorAll('[data-sid]');
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var sid = sec.getAttribute('data-sid');
      if (!sid) continue;
      try { applySection(sec, sid); } catch (e) {
        try { console.warn('[page-breaks-everywhere-284] applySection failed', sid, e && e.message); } catch (_) {}
      }
    }
  }

  // ── scheduling ───────────────────────────────────────────────────
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { applyAll(); } catch (_) {}
    });
  }

  // First passes.
  schedule();
  [120, 300, 800, 1800, 3500].forEach(function (d) { setTimeout(schedule, d); });

  // Mutation observer for preview changes.
  try {
    new MutationObserver(function (records) {
      var nonOurs = false;
      for (var i = 0; i < records.length && !nonOurs; i++) {
        var r = records[i];
        if (r.type !== 'childList') continue;
        for (var j = 0; j < r.addedNodes.length; j++) {
          var n = r.addedNodes[j];
          if (!n || n.nodeType !== 1) continue;
          if (n.getAttribute && (
            n.getAttribute(MARK_ATTR) === '1' ||
            n.getAttribute(HEADER_ATTR) === '1' ||
            n.getAttribute(BAR_ATTR) === '1' ||
            n.getAttribute('data-antcv-page-break') === '1' ||
            n.getAttribute('data-antcv-continuation-header') === '1'
          )) continue;
          nonOurs = true;
          break;
        }
      }
      if (nonOurs) schedule();
    }).observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  // Custom events from row-control sidecars.
  window.addEventListener('antcv:item-pages-changed', schedule);
  window.addEventListener('antcv:sections-updated',  schedule);

  // Cross-tab storage events.
  window.addEventListener('storage', function (ev) {
    if (ev && (ev.key === STORAGE_KEY || ev.key === SECTIONS_KEY)) schedule();
  });

  // Same-tab page-button clicks. setItem doesn't fire storage events
  // in the same tab, so the storage listener above doesn't catch
  // those. Hook clicks on anything that looks like a page cycler.
  document.addEventListener('click', function (ev) {
    var b = ev.target;
    for (var hops = 0; b && b !== document.body && hops < 4; hops++, b = b.parentElement) {
      if (b.tagName !== 'BUTTON') continue;
      var t = (b.textContent || '').trim();
      var ti = (b.title || '') + ' ' + (b.getAttribute('aria-label') || '');
      if (/📄/.test(t) || /^\d+$/.test(t) || /\bpage\b/i.test(ti)) {
        setTimeout(schedule, 60);
        setTimeout(schedule, 240);
        break;
      }
    }
  }, true);

  // Belt-and-braces.
  setInterval(schedule, 2000);

  window.AntcvPageBreaksEverywhere284 = {
    version: VERSION,
    run: schedule,
    _applyAll: applyAll,
    _findItems: findItems,
    _readMap: readMap,
    _getSectionTitle: getSectionTitle,
  };

  try { console.debug('[page-breaks-everywhere-284] installed v' + VERSION); } catch (_) {}
})();
