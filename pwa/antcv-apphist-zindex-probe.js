/* AntCV — APPHIST-ZIDX-001 diagnostic probe (read-only)
 * ============================================================
 *
 * Purpose
 * -------
 * Gather the evidence needed to diagnose APPHIST-ZIDX-001 without
 * changing anything. The bug: from Application History, clicking
 * "Open in Settings ->" opens the Settings panel BEHIND the preview
 * (a z-index / stacking-context problem). The existing
 * antcv-app-history-zfix-291 only raises the history DROPDOWN above the
 * preview slider; this bug is the SETTINGS panel landing behind the
 * preview shell, which is a different element pair.
 *
 * This probe is NOT a fix and is NOT loaded by index.html. It is a
 * console tool. It only reads the DOM and computed styles; it never
 * writes, patches window.fetch, or mutates state.
 *
 * How to run
 * ----------
 * 1. Open the live site. Open Application History, click
 *    "Open in Settings ->" so the (mis-stacked) Settings panel is on
 *    screen.
 * 2. Open DevTools console, paste this whole file, press Enter.
 * 3. It prints a SNAPSHOT and stashes it on window.__apphistZProbe.last
 *    (copy with `copy(window.__apphistZProbe.last)`).
 * 4. Paste the SNAPSHOT back into the chat. The key fields are
 *    `paintOrderAtPanelCentre` (what actually paints on top where the
 *    Settings panel should be) and the `stackingChain` of the Settings
 *    panel vs the preview element that covers it.
 */
(function () {
  'use strict';

  var SETTINGS_SELECTORS = [
    '[role="dialog"]',
    '[data-antcv-modal]',
    '[data-antcv-portal-modal]',
    '.antcv-modal',
    '.antcv-settings',
    '[data-antcv-settings-front]',
  ];
  var PREVIEW_SELECTORS = [
    '.antcv-overlay',
    '.antcv-preview-overlay',
    '[data-antcv-preview-overlay]',
    '#antcv-fab-host',
    '.antcv-preview-paper',
    '.antcv-preview-v-slider',
    '.antcv-preview-shell',
  ];

  function clean(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }

  function describe(el) {
    if (!el || el.nodeType !== 1) return el === document.documentElement ? 'html' : String(el);
    var seg = el.tagName.toLowerCase();
    if (el.id) seg += '#' + el.id;
    if (el.className && typeof el.className === 'string') {
      var cls = el.className.trim().split(/\s+/).slice(0, 3).join('.');
      if (cls) seg += '.' + cls;
    }
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name.indexOf('data-antcv') === 0 || a.name === 'role') seg += '[' + a.name + ']';
    }
    return seg;
  }

  function pathOf(el, maxDepth) {
    var out = [];
    var n = el, d = 0;
    while (n && n.nodeType === 1 && d < (maxDepth || 6)) {
      out.unshift(describe(n));
      n = n.parentElement; d++;
    }
    return out.join(' > ');
  }

  // Which stacking-context-creating properties does this element carry?
  function stackingContextReasons(el) {
    if (!el || el.nodeType !== 1) return [];
    var cs;
    try { cs = window.getComputedStyle(el); } catch (e) { return []; }
    var reasons = [];
    var pos = cs.position;
    var z = cs.zIndex;
    if (el === document.documentElement) reasons.push('root');
    if ((pos === 'absolute' || pos === 'relative') && z !== 'auto') reasons.push('position:' + pos + ' + z-index:' + z);
    if (pos === 'fixed') reasons.push('position:fixed' + (z !== 'auto' ? ' (z:' + z + ')' : ''));
    if (pos === 'sticky') reasons.push('position:sticky' + (z !== 'auto' ? ' (z:' + z + ')' : ''));
    if (cs.opacity !== '' && parseFloat(cs.opacity) < 1) reasons.push('opacity:' + cs.opacity);
    if (cs.transform && cs.transform !== 'none') reasons.push('transform');
    if (cs.filter && cs.filter !== 'none') reasons.push('filter');
    if (cs.backdropFilter && cs.backdropFilter !== 'none') reasons.push('backdrop-filter');
    if (cs.perspective && cs.perspective !== 'none') reasons.push('perspective');
    if (cs.clipPath && cs.clipPath !== 'none') reasons.push('clip-path');
    if (cs.mask && cs.mask !== 'none' && cs.mask !== '') reasons.push('mask');
    if (cs.isolation === 'isolate') reasons.push('isolation:isolate');
    if (cs.mixBlendMode && cs.mixBlendMode !== 'normal') reasons.push('mix-blend-mode');
    if (cs.willChange && /transform|opacity|filter|perspective/.test(cs.willChange)) reasons.push('will-change:' + cs.willChange);
    if (cs.contain && /paint|layout|strict|content/.test(cs.contain)) reasons.push('contain:' + cs.contain);
    // flex/grid item with z-index
    if (z !== 'auto' && el.parentElement) {
      try {
        var pd = window.getComputedStyle(el.parentElement).display;
        if (/flex|grid/.test(pd) && pos === 'static') reasons.push('flex/grid item + z-index:' + z);
      } catch (e) {}
    }
    return reasons;
  }

  // Walk ancestors, list only those that establish a stacking context,
  // with their z-index. This is the chain that decides paint order.
  function stackingChain(el) {
    var chain = [];
    var n = el;
    while (n && n.nodeType === 1) {
      var reasons = stackingContextReasons(n);
      if (reasons.length) {
        var z = 'auto';
        try { z = window.getComputedStyle(n).zIndex; } catch (e) {}
        chain.unshift({ el: describe(n), zIndex: z, creates: reasons });
      }
      n = n.parentElement;
    }
    return chain;
  }

  function rectOf(el) {
    try {
      var r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    } catch (e) { return null; }
  }

  function visible(el) {
    var r = rectOf(el);
    if (!r || (r.w === 0 && r.h === 0)) return false;
    try {
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    } catch (e) {}
    return true;
  }

  function collect(selectors) {
    var seen = [];
    var out = [];
    for (var i = 0; i < selectors.length; i++) {
      var nodes;
      try { nodes = document.querySelectorAll(selectors[i]); } catch (e) { continue; }
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        if (seen.indexOf(el) >= 0) continue;
        seen.push(el);
        if (!visible(el)) continue;
        var z = 'auto';
        try { z = window.getComputedStyle(el).zIndex; } catch (e) {}
        out.push({
          matchedBy: selectors[i],
          selector: describe(el),
          path: pathOf(el, 8),
          zIndex: z,
          rect: rectOf(el),
          text: clean(el.textContent).slice(0, 60),
          stackingChain: stackingChain(el),
          _el: el,
        });
      }
    }
    return out;
  }

  // Best guess at the on-screen Settings panel: the largest visible
  // settings candidate whose text reads like Settings content.
  function pickSettingsPanel(cands) {
    var best = null, bestArea = 0;
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i];
      var area = c.rect ? c.rect.w * c.rect.h : 0;
      var looksSettings = /setting|application|preference|export|package|writing|language|account|privacy/i.test(c.text);
      if (looksSettings && area > bestArea) { best = c; bestArea = area; }
    }
    return best || (cands.length ? cands[0] : null);
  }

  function topmostAt(x, y) {
    var el;
    try { el = document.elementFromPoint(x, y); } catch (e) { return null; }
    if (!el) return null;
    return { selector: describe(el), path: pathOf(el, 8), zIndex: (function () { try { return window.getComputedStyle(el).zIndex; } catch (e) { return '?'; } })(), _el: el };
  }

  function within(el, ancestorCands) {
    for (var i = 0; i < ancestorCands.length; i++) {
      var a = ancestorCands[i]._el;
      if (a && (a === el || a.contains(el))) return ancestorCands[i].selector;
    }
    return null;
  }

  function snapshot() {
    var settingsCands = collect(SETTINGS_SELECTORS);
    var previewCands = collect(PREVIEW_SELECTORS);
    var panel = pickSettingsPanel(settingsCands);

    // Paint-order ground truth: sample the centre of the chosen panel
    // (or the viewport centre if no panel found) and a 3x3 grid over it.
    var samples = [];
    var cx = Math.round(window.innerWidth / 2), cy = Math.round(window.innerHeight / 2);
    if (panel && panel.rect) {
      cx = Math.round(panel.rect.x + panel.rect.w / 2);
      cy = Math.round(panel.rect.y + panel.rect.h / 2);
    }
    var offs = [[0, 0], [-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]];
    for (var i = 0; i < offs.length; i++) {
      var px = cx, py = cy;
      if (panel && panel.rect) {
        px = Math.round(panel.rect.x + panel.rect.w * (0.5 + offs[i][0]));
        py = Math.round(panel.rect.y + panel.rect.h * (0.5 + offs[i][1]));
      }
      var top = topmostAt(px, py);
      if (top) {
        samples.push({
          at: { x: px, y: py },
          topmost: { selector: top.selector, zIndex: top.zIndex },
          insidePreview: within(top._el, previewCands),
          insideSettingsPanel: panel ? (panel._el === top._el || panel._el.contains(top._el)) : null,
        });
      }
    }

    function strip(list) {
      return list.map(function (c) {
        return { matchedBy: c.matchedBy, selector: c.selector, path: c.path, zIndex: c.zIndex, rect: c.rect, text: c.text, stackingChain: c.stackingChain };
      });
    }

    var report = {
      when: new Date().toISOString(),
      url: location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight, isDesktop: !!(window.matchMedia && window.matchMedia('(min-width:901px)').matches) },
      chosenSettingsPanel: panel ? { selector: panel.selector, path: panel.path, zIndex: panel.zIndex, rect: panel.rect, text: panel.text, stackingChain: panel.stackingChain } : null,
      paintOrderAtPanelCentre: samples,
      settingsCandidates: strip(settingsCands),
      previewCandidates: strip(previewCands),
      sidecars: {
        appHistoryZFix291: (window.__antcvAppHistoryZFix291 || null),
        previewShellSticky341: (window.AntcvPreviewShellSticky341 ? window.AntcvPreviewShellSticky341.version : null),
        openSettingsRoute: (typeof window._antcvOpenSettingsRoute === 'function'),
      },
    };

    window.__apphistZProbe.last = report;
    try {
      console.groupCollapsed('%c[APPHIST-ZIDX-001 probe] snapshot', 'color:#0a7;font-weight:bold');
      console.log('chosen Settings panel:', report.chosenSettingsPanel);
      console.log('paint order at panel centre (topmost element actually painted):', report.paintOrderAtPanelCentre);
      console.log('settings candidates:', report.settingsCandidates);
      console.log('preview candidates:', report.previewCandidates);
      console.log('sidecars:', report.sidecars);
      console.log('Full object on window.__apphistZProbe.last  (run `copy(__apphistZProbe.last)`)');
      console.groupEnd();
    } catch (e) { console.log(report); }
    return report;
  }

  window.__apphistZProbe = { version: '1.0.0', snapshot: snapshot, last: null };
  snapshot();
})();
