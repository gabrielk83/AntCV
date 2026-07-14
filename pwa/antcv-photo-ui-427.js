/* AntCV photo UI — consolidated sidecar (v1.50.427)
 * ============================================================================
 * SIDECAR-CONSOLIDATE G10 (2026-06-13): merges the three photo sidecars
 *   - antcv-photo-position.js     (v1.50.153) — stale-clone sweeper
 *   - antcv-photo-pentagon-shape.js (v1.50.57) — Pentagon shape button + mask
 *   - antcv-photo-bridge-button.js  (v1.50.422) — "Sidebar bridge" position button
 * into ONE file behind a SINGLE shared rAF scheduler + ONE MutationObserver
 * (was 3 observers + a 2000ms + a 400ms interval + multiple click listeners).
 *
 * Each module's logic, idempotency guards, and debug API are preserved
 * VERBATIM — only the per-module MutationObserver + boot wiring is replaced by
 * the shared scheduler at the bottom. The three globals (AntcvPhotoPosition,
 * AntcvPentagonShape, plus the bridge install flag) stay exposed so any manual
 * debugging or future reference keeps working. The old three files remain on
 * disk, unreferenced.
 *
 * Why these three: all DOM-only (no fetch wrap), all about the profile photo —
 * shape, position, and the bridge medallion. Per the consolidation review G10
 * is the small confidence-building merge after G2 (section-panel) and G5
 * (mobile-ui).
 */
(function () {
  'use strict';

  var SUITE_VERSION = '1.51.761-photo-flip';
  if (window.__antcvPhotoUI427 === SUITE_VERSION) return;
  window.__antcvPhotoUI427 = SUITE_VERSION;

  // Shared one-shot rAF scheduler. Each module registers a tick fn; a single
  // MutationObserver (installed in boot()) calls scheduleAll() on DOM churn.
  var ticks = [];
  var pending = false;
  function scheduleAll() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      for (var i = 0; i < ticks.length; i++) {
        try { ticks[i](); } catch (_) {}
      }
    });
  }

  /* ========================================================================
   * MODULE A — photo-position (clone sweeper)
   * Source: antcv-photo-position.js v1.50.153. applyLayout() is now a
   * cleanup-only shim: every photo position is rendered NATIVELY by app.js
   * (PHOTO-POSITIONS-NATIVE-001), so applyLayout sweeps stale clones from old
   * sessions and returns before the (dead) clone-build path. Preserved verbatim
   * incl. the early return so the AntcvPhotoPosition debug API is unchanged.
   * ===================================================================== */
  var PhotoPosition = (function () {
    var SCRIPT_VERSION = '1.50.153';
    var STORAGE_KEY = 'photoPosition';
    var POSITIONS = [
      'sidebar-top', 'sidebar-bottom',
      'header-left', 'header-right',
      'main-left', 'main-right',
      'band-overlap',
      'hidden',
    ];
    var DEFAULT_POSITION = 'sidebar-top';

    function readPosition() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return DEFAULT_POSITION;
        var v = raw;
        try {
          var parsed = JSON.parse(raw);
          if (typeof parsed === 'string') v = parsed;
        } catch (_) {}
        v = String(v).trim();
        return POSITIONS.indexOf(v) >= 0 ? v : DEFAULT_POSITION;
      } catch (_) {
        return DEFAULT_POSITION;
      }
    }

    function findAllPapers() {
      return Array.from(document.querySelectorAll('.antcv-preview-paper'));
    }

    function findOriginalPhoto(paper) {
      var imgs = paper.querySelectorAll('img');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (img.getAttribute('data-antcv-photo-clone') === '1') continue;
        var style = img.getAttribute('style') || '';
        if (style.indexOf('border-radius:50%') >= 0
          || style.indexOf('border-radius: 50%') >= 0) {
          return img;
        }
      }
      return null;
    }

    function pickActivePaper() {
      var papers = findAllPapers();
      if (!papers.length) return { paper: null, original: null };
      for (var i = 0; i < papers.length; i++) {
        var img = findOriginalPhoto(papers[i]);
        if (img) return { paper: papers[i], original: img };
      }
      return { paper: papers[0], original: null };
    }

    function findPaper() {
      return pickActivePaper().paper;
    }

    function findHeaderTable(paper) {
      var tables = Array.from(paper.querySelectorAll('table'));
      if (!tables.length) return null;
      var first = tables[0];
      var rows = first.querySelectorAll(':scope > tbody > tr, :scope > tr');
      var isMainTable = false;
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].querySelectorAll(':scope > td');
        if (cells.length >= 2) { isMainTable = true; break; }
      }
      if (!isMainTable) return first;
      return null;
    }

    function findTwoColTable(paper) {
      var tables = paper.querySelectorAll('table');
      for (var i = 0; i < tables.length; i++) {
        var rows = tables[i].querySelectorAll(':scope > tbody > tr, :scope > tr');
        for (var j = 0; j < rows.length; j++) {
          if (rows[j].querySelectorAll(':scope > td').length >= 2) return tables[i];
        }
      }
      return null;
    }

    function findSidebarTd(paper) {
      var img = findOriginalPhoto(paper);
      if (img && typeof img.closest === 'function') {
        var td = img.closest('td');
        if (td) return td;
      }
      var t = findTwoColTable(paper);
      if (t) {
        var rows = t.querySelectorAll(':scope > tbody > tr, :scope > tr');
        for (var i = 0; i < rows.length; i++) {
          var cells = rows[i].querySelectorAll(':scope > td');
          if (cells.length >= 2) {
            for (var k = 0; k < cells.length; k++) {
              var bg = (cells[k].getAttribute('bgcolor') || '').toLowerCase();
              if (bg && bg !== '#ffffff' && bg !== 'white' && bg !== 'ffffff') return cells[k];
            }
          }
        }
      }
      return null;
    }

    function findMainTable(paper) {
      var sb = findSidebarTd(paper);
      if (sb && typeof sb.closest === 'function') {
        var t = sb.closest('table');
        if (t) return t;
      }
      return findTwoColTable(paper);
    }

    function findMainTd(paper) {
      var sb = findSidebarTd(paper);
      if (sb && typeof sb.closest === 'function') {
        var row = sb.closest('tr');
        if (row) {
          var sibs = Array.from(row.children).filter(function (c) { return c.tagName === 'TD'; });
          var other = sibs.find(function (td) { return td !== sb; });
          if (other) return other;
        }
      }
      var t2 = findMainTable(paper);
      if (t2) {
        var rows = t2.querySelectorAll(':scope > tbody > tr, :scope > tr');
        for (var i = 0; i < rows.length; i++) {
          var cells = rows[i].querySelectorAll(':scope > td');
          if (cells.length >= 2) {
            for (var k = 0; k < cells.length; k++) {
              var bg = (cells[k].getAttribute('bgcolor') || '').toLowerCase();
              if (bg === '#ffffff' || bg === 'white' || bg === 'ffffff') return cells[k];
            }
          }
        }
      }
      return null;
    }

    function buildCloneWrap(img, position) {
      var clone = img.cloneNode(true);
      clone.setAttribute('data-antcv-photo-clone', '1');
      clone.style.margin = '0';
      var wrap = document.createElement('div');
      wrap.setAttribute('data-antcv-photo-clone', '1');
      wrap.setAttribute('data-antcv-photo-position', position);
      wrap.style.display = 'inline-block';
      wrap.style.lineHeight = '0';
      wrap.appendChild(clone);
      switch (position) {
        case 'header-left':
          wrap.style.float = 'left';
          wrap.style.margin = '6pt 12pt 6pt 12pt';
          wrap.style.verticalAlign = 'middle';
          break;
        case 'header-right':
          wrap.style.float = 'right';
          wrap.style.margin = '6pt 12pt 6pt 12pt';
          wrap.style.verticalAlign = 'middle';
          break;
        case 'main-left':
          wrap.style.float = 'left';
          wrap.style.margin = '0 12pt 8pt 0';
          break;
        case 'main-right':
          wrap.style.float = 'right';
          wrap.style.margin = '0 0 8pt 12pt';
          break;
        case 'band-overlap':
          wrap.style.display = 'block';
          wrap.style.textAlign = 'center';
          wrap.style.margin = '0';
          wrap.style.padding = '0';
          wrap.style.position = 'relative';
          wrap.style.zIndex = '2';
          clone.style.display = 'inline-block';
          clone.style.verticalAlign = 'top';
          break;
      }
      return wrap;
    }

    function measurePhotoPx(img) {
      if (!img) return 96;
      try {
        var s = img.getAttribute('style') || '';
        var m = s.match(/(?:width|height)\s*:\s*([\d.]+)\s*(px|pt|in|cm|mm)/i);
        if (m) {
          var n = parseFloat(m[1]);
          var u = m[2].toLowerCase();
          if (u === 'px') return n;
          if (u === 'pt') return n * 96 / 72;
          if (u === 'in') return n * 96;
          if (u === 'cm') return n * 37.7952755906;
          if (u === 'mm') return n * 3.77952755906;
        }
      } catch (_) {}
      try {
        var w = img.getAttribute('width');
        if (w) {
          var nn = parseFloat(w);
          if (Number.isFinite(nn) && nn > 0) return nn;
        }
      } catch (_) {}
      try {
        var rect = img.getBoundingClientRect();
        if (rect && rect.width > 8) return rect.width;
      } catch (_) {}
      return 96;
    }

    function clearExistingClones(paper) {
      var existing = paper.querySelectorAll('[data-antcv-photo-clone="1"]');
      for (var i = 0; i < existing.length; i++) {
        var el = existing[i];
        if (el.tagName === 'IMG' && el.parentElement &&
            el.parentElement.getAttribute('data-antcv-photo-clone') === '1') {
          continue;
        }
        if (el.parentElement) el.parentElement.removeChild(el);
      }
    }

    function setOriginalVisible(img, visible) {
      if (!img) return;
      var wrap = img.parentElement;
      if (wrap && wrap.tagName === 'DIV') {
        wrap.style.display = visible ? '' : 'none';
      } else {
        img.style.display = visible ? '' : 'none';
      }
    }

    function applyLayout() {
      var res = pickActivePaper();
      var paper = res.paper, original = res.original;
      if (!paper) return;
      // Always start from a clean slate. Sweep clones from BOTH papers.
      var papers = findAllPapers();
      for (var i = 0; i < papers.length; i++) clearExistingClones(papers[i]);
      // PHOTO-POSITIONS-NATIVE-001 (1.50.370/372): EVERY photo position is
      // rendered NATIVELY by app.js. This is a cleanup-only shim; do NOT touch
      // the photo's display (the vertical-seam bridges put the medallion in the
      // flex .antcv-page-row, and clearing its display:flex stacked columns).
      return;
      /* eslint-disable no-unreachable */
      var position = readPosition();
      if (position === 'hidden') { setOriginalVisible(original, false); return; }
      if (!original) return;
      setOriginalVisible(original, false);
      var clone = buildCloneWrap(original, position);
      if (position === 'header-left' || position === 'header-right') {
        var header = findHeaderTable(paper);
        var cell = null;
        if (header) {
          var td = header.querySelector(':scope > tbody > td, :scope > tbody > tr > td, :scope > tr > td');
          cell = td || header;
        } else {
          cell = findMainTd(paper);
        }
        if (!cell) { setOriginalVisible(original, true); return; }
        if (position === 'header-left') cell.insertBefore(clone, cell.firstChild);
        else cell.appendChild(clone);
      } else if (position === 'main-left' || position === 'main-right') {
        var mainTd = findMainTd(paper);
        if (!mainTd) { setOriginalVisible(original, true); return; }
        mainTd.insertBefore(clone, mainTd.firstChild);
      } else if (position === 'band-overlap') {
        var sidebarTd = findSidebarTd(paper);
        if (!sidebarTd) { setOriginalVisible(original, true); return; }
        var px = measurePhotoPx(original);
        var pull = Math.max(24, Math.round(px / 2) + 2);
        clone.style.marginTop = '-' + pull + 'px';
        clone.style.marginBottom = '8pt';
        sidebarTd.insertBefore(clone, sidebarTd.firstChild);
      }
      /* eslint-enable no-unreachable */
    }

    var applyTimer = null;
    function scheduleApply(delay) {
      if (applyTimer) clearTimeout(applyTimer);
      applyTimer = setTimeout(function () {
        applyTimer = null;
        try { applyLayout(); } catch (e) {
          console.warn('[antcv-photo-position] applyLayout threw:', e);
        }
      }, typeof delay === 'number' ? delay : 60);
    }

    var lastSeenPosition = null;
    function maybeReapplyIfChanged() {
      var now = readPosition();
      if (now !== lastSeenPosition) {
        lastSeenPosition = now;
        scheduleApply(20);
      }
    }

    function boot() {
      window.addEventListener('storage', function (ev) {
        if (ev.key === STORAGE_KEY) {
          lastSeenPosition = null;
          scheduleApply(20);
        }
      });
      document.addEventListener('click', function () {
        setTimeout(maybeReapplyIfChanged, 30);
      }, true);
      setInterval(maybeReapplyIfChanged, 2000);
      scheduleApply(0);
    }

    window.AntcvPhotoPosition = {
      version: SCRIPT_VERSION,
      POSITIONS: POSITIONS.slice(),
      _readPosition: readPosition,
      _findPaper: findPaper,
      _findOriginalPhoto: findOriginalPhoto,
      _findHeaderTable: findHeaderTable,
      _findMainTable: findMainTable,
      _findMainTd: findMainTd,
      _findSidebarTd: findSidebarTd,
      _buildCloneWrap: buildCloneWrap,
      _measurePhotoPx: measurePhotoPx,
      _applyLayout: applyLayout,
    };

    // tick: the per-mutation work (sweep stale clones).
    return { boot: boot, tick: function () { scheduleApply(); } };
  })();

  /* ========================================================================
   * MODULE B — pentagon shape. Source: antcv-photo-pentagon-shape.js v1.50.57.
   * ===================================================================== */
  var Pentagon = (function () {
    var SHAPE_KEY_ATTR = 'data-shape';
    var PENTAGON = 'pentagon';
    var PENTAGON_POLY =
      'polygon(50% 0%, 97.55% 34.55%, 79.39% 90.45%, 20.61% 90.45%, 2.45% 34.55%)';

    function readPI() {
      try { return JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; }
      catch (_) { return {}; }
    }
    function writePhotoShape(shape) {
      try {
        var pi = readPI();
        // PHOTO-SHAPE-SQUARE-001 (owner 2026-06-18): the React preview render
        // reads `personalInfo.stylePrefs.photoShape` (square -> radius 0,
        // rounded -> 12px, else 50%), but this selector only wrote the TOP-LEVEL
        // `pi.photoShape` (which Pentagon's own direct-DOM clip reads) — so a
        // square/rounded pick never reached the preview and the photo stayed a
        // circle. Write BOTH: top-level for Pentagon, stylePrefs for the render.
        if (shape) {
          pi.photoShape = shape;
          if (!pi.stylePrefs || typeof pi.stylePrefs !== 'object') pi.stylePrefs = {};
          pi.stylePrefs.photoShape = shape;
        } else {
          delete pi.photoShape;
          if (pi.stylePrefs && typeof pi.stylePrefs === 'object') delete pi.stylePrefs.photoShape;
        }
        localStorage.setItem('personalInfo', JSON.stringify(pi));
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('antcv:photo-shape-changed',
          { detail: { shape: shape || '' } }));
      } catch (_) {}
      // PHOTO-SHAPE-SQUARE-001: the native shape button does NOT trigger a React
      // re-render, so the React photo render (which owns the square/rounded/
      // circle border-radius via stylePrefs.photoShape) would not repaint until
      // some other state change. Nudge the app's sections-updated handler, which
      // reloads sections + setState -> the preview re-renders and the photo
      // re-reads the new shape immediately. (Content sidecars fast-bail on this.)
      try {
        window.dispatchEvent(new CustomEvent('antcv:sections-updated',
          { detail: { source: 'photo-shape' } }));
      } catch (_) {}
    }
    function currentPhotoShape() {
      var pi = readPI();
      // Prefer the canonical stylePrefs location the render reads; fall back to
      // the legacy top-level value.
      var sp = (pi && pi.stylePrefs && typeof pi.stylePrefs === 'object') ? pi.stylePrefs : null;
      if (sp && typeof sp.photoShape === 'string' && sp.photoShape) return sp.photoShape;
      return (pi && typeof pi.photoShape === 'string') ? pi.photoShape : '';
    }

    function findShapeRows() {
      return Array.from(document.querySelectorAll('.antcv-fp-shape-row'));
    }
    function squareButtonIn(row) {
      return row.querySelector('button[' + SHAPE_KEY_ATTR + '="square"]');
    }
    function pentagonButtonIn(row) {
      return row.querySelector('button[' + SHAPE_KEY_ATTR + '="' + PENTAGON + '"]');
    }

    function buildPentagonButton() {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'antcv-fp-shape-btn';
      b.setAttribute(SHAPE_KEY_ATTR, PENTAGON);
      b.setAttribute('data-antcv-pentagon-shape-btn', '1');
      var sw = document.createElement('span');
      sw.className = 'sw';
      sw.style.clipPath = PENTAGON_POLY;
      sw.style.webkitClipPath = PENTAGON_POLY;
      var label = document.createElement('span');
      label.textContent = 'Pentagon';
      b.appendChild(sw);
      b.appendChild(label);
      b.addEventListener('click', function (ev) {
        ev.preventDefault();
        selectPentagon(b);
      });
      return b;
    }

    function setActive(row, btn) {
      Array.from(row.querySelectorAll('button.antcv-fp-shape-btn'))
        .forEach(function (x) { x.classList.remove('active'); });
      if (btn) btn.classList.add('active');
    }

    function selectPentagon(btn) {
      var row = btn.closest('.antcv-fp-shape-row');
      if (row) setActive(row, btn);
      writePhotoShape(PENTAGON);
      applyPreviewShape();
    }

    function onNativeShapeClick(ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var native = t.closest('button.antcv-fp-shape-btn[' + SHAPE_KEY_ATTR + ']');
      if (!native) return;
      var shape = native.getAttribute(SHAPE_KEY_ATTR);
      if (shape && shape !== PENTAGON) {
        if (currentPhotoShape() === PENTAGON) writePhotoShape('');
        clearPreviewShape();
      }
    }

    function ensureButtons() {
      var rows = findShapeRows();
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        var sq = squareButtonIn(row);
        if (!sq) continue;
        var pent = pentagonButtonIn(row);
        if (!pent) {
          pent = buildPentagonButton();
          if (sq.nextSibling) row.insertBefore(pent, sq.nextSibling);
          else row.appendChild(pent);
        }
        if (currentPhotoShape() === PENTAGON) {
          setActive(row, pent);
        }
      }
    }

    function previewPhotos() {
      var out = [];
      var papers = document.querySelectorAll('.antcv-preview-paper');
      for (var i = 0; i < papers.length; i++) {
        var imgs = papers[i].querySelectorAll('img');
        for (var j = 0; j < imgs.length; j++) {
          var img = imgs[j];
          var st = img.getAttribute('style') || '';
          if (st.indexOf('border-radius') >= 0 ||
              img.getAttribute('data-antcv-photo-clone') === '1') {
            out.push(img);
          }
        }
      }
      return out;
    }

    var CONTOUR_COLOR = '#01B7BB';
    function readContourColor() {
      try {
        var imgs = previewPhotos();
        for (var i = 0; i < imgs.length; i++) {
          var bc = getComputedStyle(imgs[i]).borderTopColor;
          if (bc && bc !== 'rgba(0, 0, 0, 0)' && bc !== 'transparent') return bc;
        }
      } catch (_) {}
      return CONTOUR_COLOR;
    }
    function pentagonOutlineFilter(color, w) {
      var d = [
        [w, 0], [-w, 0], [0, w], [0, -w],
        [w, w], [w, -w], [-w, w], [-w, -w]
      ];
      var parts = [];
      for (var i = 0; i < d.length; i++) {
        parts.push('drop-shadow(' + d[i][0] + 'px ' + d[i][1] + 'px 0 ' + color + ')');
      }
      return parts.join(' ');
    }

    function applyPreviewShape() {
      if (currentPhotoShape() !== PENTAGON) { clearPreviewShape(); return; }
      var color = readContourColor();
      var outline = pentagonOutlineFilter(color, 1.2);
      var imgs = previewPhotos();
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        img.style.setProperty('clip-path', PENTAGON_POLY, 'important');
        img.style.setProperty('-webkit-clip-path', PENTAGON_POLY, 'important');
        img.style.setProperty('border-radius', '0', 'important');
        img.style.setProperty('border', '0', 'important');
        img.style.setProperty('box-shadow', 'none', 'important');
        img.style.setProperty('filter', outline, 'important');
        img.style.setProperty('-webkit-filter', outline, 'important');
        img.setAttribute('data-antcv-pentagon-clip', '1');
      }
    }

    function clearPreviewShape() {
      var imgs = document.querySelectorAll('img[data-antcv-pentagon-clip="1"]');
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        img.style.removeProperty('clip-path');
        img.style.removeProperty('-webkit-clip-path');
        img.style.removeProperty('border-radius');
        img.style.removeProperty('border');
        img.style.removeProperty('box-shadow');
        img.style.removeProperty('filter');
        img.style.removeProperty('-webkit-filter');
        img.removeAttribute('data-antcv-pentagon-clip');
      }
    }

    function boot() {
      document.addEventListener('click', onNativeShapeClick, true);
      window.addEventListener('antcv:photo-shape-changed', applyPreviewShape);
      window.addEventListener('storage', function (ev) {
        if (ev.key === 'personalInfo') scheduleAll();
      });
    }

    window.AntcvPentagonShape = {
      version: '1.50.57',
      POLY: PENTAGON_POLY,
      _current: currentPhotoShape,
      _apply: applyPreviewShape,
      _clear: clearPreviewShape,
      _ensure: ensureButtons,
    };

    return {
      boot: boot,
      tick: function () {
        try { ensureButtons(); } catch (e) { /* settings row may be absent */ }
        try { applyPreviewShape(); } catch (e) {}
      },
    };
  })();

  /* ========================================================================
   * MODULE C — "Sidebar bridge" button. Source: antcv-photo-bridge-button.js
   * v1.50.422. Keeps __antcvPhotoBridgeButtonInstalled for back-compat.
   * ===================================================================== */
  var Bridge = (function () {
    window.__antcvPhotoBridgeButtonInstalled = '1.50.422';

    var STORAGE_KEY = 'photoPosition';
    var BRIDGE_VALUE = 'band-overlap';
    var TAG_ATTR = 'data-antcv-bridge-button';

    function defaultPosition() {
      try {
        var raw = localStorage.getItem('stylePackage');
        var pkg = 'copenhagen-modern';
        if (raw) { try { var p = JSON.parse(raw); pkg = (typeof p === 'string' ? p : raw); } catch (_) { pkg = raw; } }
        pkg = String(pkg || '').trim();
        if (pkg === 'scandinavian' || pkg === '') pkg = 'copenhagen-modern';
        return pkg === 'copenhagen-modern' ? BRIDGE_VALUE : 'sidebar-top';
      } catch (_) { return 'sidebar-top'; }
    }
    function readPosition() {
      try {
        var raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultPosition();
        var v = raw;
        try {
          var parsed = JSON.parse(raw);
          if (typeof parsed === 'string') v = parsed;
        } catch (_) {}
        return String(v).trim();
      } catch (_) {
        return defaultPosition();
      }
    }

    function writePosition(value) {
      var wroteViaHook = false;
      try {
        if (typeof window._antcvSetPhotoPosition === 'function') {
          window._antcvSetPhotoPosition(value);
          wroteViaHook = true;
        }
      } catch (_) {}
      if (!wroteViaHook) {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
        } catch (_) {}
      }
      try {
        window.dispatchEvent(new StorageEvent('storage', {
          key: STORAGE_KEY,
          newValue: JSON.stringify(value),
          storageArea: localStorage,
        }));
      } catch (_) {
        try {
          window.dispatchEvent(new CustomEvent('antcv:photo-position-changed', {
            detail: { value: value },
          }));
        } catch (_) {}
      }
    }

    function findSectionByHeading(anchorRegex, maxWalkUp) {
      var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: function (node) {
          var t = (node.textContent || '').trim();
          return (t && anchorRegex.test(t)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
      });
      var tNode = walker.nextNode();
      if (!tNode) return null;
      var n = tNode.parentElement;
      for (var i = 0; i < maxWalkUp && n && n.parentElement; i++) n = n.parentElement;
      return n;
    }

    var POSITION_LABEL_FRAGMENTS = [
      'sidebar top', 'sidebar btm', 'sidebar bottom',
      'header left', 'header right',
      'main left', 'main right',
      'hidden',
    ];
    function labelMatchesPosition(text) {
      var t = String(text || '').toLowerCase();
      for (var i = 0; i < POSITION_LABEL_FRAGMENTS.length; i++) {
        if (t.indexOf(POSITION_LABEL_FRAGMENTS[i]) >= 0) return true;
      }
      return false;
    }
    function findButtonRow(section) {
      if (!section) return null;
      var buttons = section.querySelectorAll('button');
      var counts = new Map();
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (!labelMatchesPosition(b.textContent)) continue;
        var parent = b.parentElement;
        if (!parent) continue;
        counts.set(parent, (counts.get(parent) || 0) + 1);
      }
      var bestParent = null;
      var bestCount = 0;
      counts.forEach(function (n, p) {
        if (n > bestCount) { bestCount = n; bestParent = p; }
      });
      return bestCount >= 2 ? bestParent : null;
    }

    function buildBridgeButton() {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute(TAG_ATTR, '1');
      btn.textContent = '◐ Sidebar bridge';
      btn.title = 'Photo straddles the seam between the header band and the sidebar (medallion overlap).';
      btn.style.cssText = [
        'padding: 4px 10px',
        'background: rgba(255,255,255,.04)',
        'color: #d7e6ee',
        'border: 1px solid rgba(255,255,255,.18)',
        'border-radius: 6px',
        'cursor: pointer',
        'font-family: inherit',
        'font-size: 11px',
        'font-weight: 600',
        'display: inline-flex',
        'align-items: center',
        'gap: 4px',
        'white-space: nowrap',
      ].join(';');
      btn.addEventListener('click', function () {
        writePosition(BRIDGE_VALUE);
        refreshActiveState();
      });
      return btn;
    }

    function installSuppressionStyle() {
      if (document.getElementById('antcv-bridge-suppress-style')) return;
      var s = document.createElement('style');
      s.id = 'antcv-bridge-suppress-style';
      s.textContent =
        '[data-antcv-bridge-active="1"] button:not([data-antcv-bridge-button="1"]):not([data-antcv-photo-shape-btn]) {' +
          'background: rgba(255,255,255,.04) !important;' +
          'border: 1px solid rgba(255,255,255,.18) !important;' +
          'color: rgba(215,230,238,.62) !important;' +
          'box-shadow: none !important;' +
        '}';
      document.head.appendChild(s);
    }

    function refreshActiveState() {
      var isActive = readPosition() === BRIDGE_VALUE;
      document.querySelectorAll('[' + TAG_ATTR + '="1"]').forEach(function (b) {
        if (isActive) {
          b.style.background = 'rgba(1,183,187,.1)';
          b.style.border = '1px solid #01B7BB';
          b.style.color = '#01B7BB';
          b.style.fontWeight = '600';
        } else {
          b.style.background = 'rgba(255,255,255,.04)';
          b.style.border = '1px solid rgba(255,255,255,.18)';
          b.style.color = '#d7e6ee';
          b.style.fontWeight = '600';
        }
        var row = b.parentElement;
        if (row) {
          // SETTINGS-SWEEP-STABILIZE (row 17, 1.51.156): toggle on change only —
          // this re-stamped data-antcv-bridge-active every tick (attribute-mutation
          // churn on the Layout panel), retriggering observers for no reason.
          if (isActive) { if (row.getAttribute('data-antcv-bridge-active') !== '1') row.setAttribute('data-antcv-bridge-active', '1'); }
          else if (row.hasAttribute('data-antcv-bridge-active')) row.removeAttribute('data-antcv-bridge-active');
        }
      });
    }

    function wireSiblingClickRefresh(row) {
      if (!row || row._antcvBridgeWired) return;
      row._antcvBridgeWired = true;
      row.addEventListener('click', function () {
        setTimeout(refreshActiveState, 50);
        setTimeout(refreshActiveState, 200);
      }, true);
    }

    function stripStrayCjlrButtons(section) {
      if (!section) return;
      var selectors = [
        '[data-antcv-align-cycler]',
        '[data-antcv-headline-cjlr="1"]',
        '[data-antcv-add-cjlr-swap-241="cjlr"]',
        '[data-antcv-panel-action-211="cjlr"]',
        '[data-antcv-panel-action-208="cjlr"]',
        '[data-antcv-panel-action-207="cjlr"]',
        '[data-antcv-add-cjlr-swap-241]',
      ];
      section.querySelectorAll(selectors.join(', ')).forEach(function (b) {
        try { b.parentElement && b.parentElement.removeChild(b); } catch (_) {}
      });
      section.querySelectorAll('.antcv-fp-shape-row').forEach(function (row) {
        Array.prototype.slice.call(row.children).forEach(function (child) {
          if (child && child.classList && !child.classList.contains('antcv-fp-shape-btn')) {
            try { row.removeChild(child); } catch (_) {}
          }
        });
      });
    }

    function inject() {
      var section = findSectionByHeading(/^PROFILE PHOTO$/, 1);
      if (!section) return false;
      stripStrayCjlrButtons(section);
      if (section.querySelector('[' + TAG_ATTR + '="1"]')) {
        refreshActiveState();
        return true;
      }
      document.querySelectorAll('[' + TAG_ATTR + '="1"]').forEach(function (b) {
        if (!section.contains(b)) {
          try { b.parentElement && b.parentElement.removeChild(b); } catch (_) {}
        }
      });
      var row = findButtonRow(section);
      var target = row || section;
      var bridgeBtn = buildBridgeButton();
      var hiddenBtn = null;
      if (row) {
        var rowButtons = row.querySelectorAll('button');
        for (var i = 0; i < rowButtons.length; i++) {
          var t = String(rowButtons[i].textContent || '').toLowerCase();
          if (t.indexOf('hidden') >= 0) { hiddenBtn = rowButtons[i]; break; }
        }
      }
      if (hiddenBtn && hiddenBtn.parentElement === target) {
        target.insertBefore(bridgeBtn, hiddenBtn);
      } else {
        target.appendChild(bridgeBtn);
      }
      if (row) wireSiblingClickRefresh(row);
      installSuppressionStyle();
      refreshActiveState();
      return true;
    }

    function boot() {
      inject();
      window.addEventListener('storage', function (ev) {
        if (ev.key === STORAGE_KEY) refreshActiveState();
      });
      setInterval(refreshActiveState, 400);
    }

    return { boot: boot, tick: function () { try { inject(); } catch (_) {} } };
  })();

  /* ========================================================================
   * MODULE D — photo horizontal flip (off / on / auto).  PHOTO-FLIP-001
   * (owner 2026-07-14). Adds a 3-state Flip control INSIDE the collapsible
   * PROFILE PHOTO panel, mirrors the preview photo via CSS scaleX(-1), and
   * for AUTO faces the subject INTO the content using an orientation detected
   * ONCE at photo upload and stored in personalInfo.stylePrefs (travels with
   * the photo via the normal personalInfo cloud sync; self-heals by re-
   * detecting when the stored signature no longer matches the current photo).
   *   - off  : no flip
   *   - on   : mirror the photo horizontally
   *   - auto : flip only when the detected facing points AWAY from the content
   *            (toward the near page edge). The content side is derived from
   *            photoPosition + sidebarPosition, so it self-corrects when the
   *            sidebar swaps sides or the position button is left at default.
   * Export parity lives in antcv-docx-client.js, which mirrors the exported
   * PNG when the SAME resolveFlipH() rule is true (exposed on window below).
   * Follows the MODULE B (Pentagon) pattern: settings-row injection +
   * preview-<img> restyle + personalInfo.stylePrefs persistence + a
   * sections-updated nudge, all write-on-change to respect
   * SETTINGS-SWEEP-STABILIZE.
   * ===================================================================== */
  var Flip = (function () {
    var MODES = ['off', 'on', 'auto'];
    var DEFAULT_MODE = 'off';
    var UI_ATTR = 'data-antcv-photo-flip-ctrl';
    var FLIP_TX = 'scaleX(-1)';

    function readPI() {
      try { return JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; }
      catch (_) { return {}; }
    }
    function readSP() {
      var pi = readPI();
      return (pi && pi.stylePrefs && typeof pi.stylePrefs === 'object') ? pi.stylePrefs : {};
    }
    function readMode() {
      var v = String(readSP().photoFlip || '').trim().toLowerCase();
      return MODES.indexOf(v) >= 0 ? v : DEFAULT_MODE;
    }
    function writeMode(mode) {
      try {
        var pi = readPI();
        if (!pi.stylePrefs || typeof pi.stylePrefs !== 'object') pi.stylePrefs = {};
        pi.stylePrefs.photoFlip = mode;
        localStorage.setItem('personalInfo', JSON.stringify(pi));
      } catch (_) {}
      // Nudge the app to re-read sections so the preview repaints (the native
      // photo render doesn't observe this key). Content sidecars fast-bail.
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'photo-flip' } })); } catch (_) {}
    }
    function readFacing() {
      var v = String(readSP().photoFacing || '').trim().toLowerCase();
      return (v === 'left' || v === 'right' || v === 'center') ? v : 'unknown';
    }
    function writeFacing(facing, sig) {
      try {
        var pi = readPI();
        if (!pi.stylePrefs || typeof pi.stylePrefs !== 'object') pi.stylePrefs = {};
        pi.stylePrefs.photoFacing = facing;
        pi.stylePrefs.photoFacingSig = sig;
        localStorage.setItem('personalInfo', JSON.stringify(pi));
      } catch (_) {}
    }

    // ── content-side (which way the subject should look) ───────────────────
    function readLS(key, dflt) {
      try {
        var raw = localStorage.getItem(key);
        if (raw == null || raw === '') return dflt;
        var v = raw; try { var p = JSON.parse(raw); if (typeof p === 'string') v = p; } catch (_) {}
        return String(v).trim().toLowerCase();
      } catch (_) { return dflt; }
    }
    function desiredFacing() {
      var pos = readLS('photoPosition', '');
      if (pos.indexOf('right') >= 0) return 'left';   // header/main-right → content is left
      if (pos.indexOf('left') >= 0) return 'right';   // header/main-left  → content is right
      // sidebar-top/bottom, band-overlap, bridge-*, hidden, unset → photo in sidebar.
      return readLS('sidebarPosition', 'left') === 'right' ? 'left' : 'right';
    }
    function resolveFlipH() {
      var mode = readMode();
      if (mode === 'on') return true;
      if (mode !== 'auto') return false;
      var f = readFacing();
      if (f !== 'left' && f !== 'right') return false; // center / unknown → leave as-is
      return f !== desiredFacing();
    }
    // Single source of truth shared with the export sidecar (docx-client).
    try { window.__antcvResolvePhotoFlipH = resolveFlipH; } catch (_) {}

    // ── facing detection (runs once per photo, at/after upload) ─────────────
    function photoSig(dataUrl) {
      if (!dataUrl) return '';
      return dataUrl.length + ':' + dataUrl.slice(-24);
    }
    function classify(bbox, pt) {
      // When the head turns toward image-left the nose/eye-midpoint sits well
      // LEFT of the face-box centre (the far cheek widens the box rightward).
      var cx = bbox.x + bbox.width / 2;
      var d = (pt.x - cx) / (bbox.width || 1);
      if (d < -0.12) return 'left';
      if (d > 0.12) return 'right';
      return 'center';
    }
    function heuristicFacing(img) {
      // Fallback when the Shape Detection API is absent: a turned head packs the
      // high-contrast features (eyes/nose/mouth) toward the side it faces while
      // the far cheek is smooth. Compare horizontal-gradient energy of the left
      // vs right half of the upper-centre band and face toward the busier half.
      try {
        var W = 64, H = 64;
        var c = document.createElement('canvas'); c.width = W; c.height = H;
        var ctx = c.getContext('2d'); if (!ctx) return 'unknown';
        ctx.drawImage(img, 0, 0, W, H);
        var d = ctx.getImageData(0, 0, W, H).data;
        function lum(i) { return 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; }
        var leftE = 0, rightE = 0, mid = W / 2;
        var y0 = Math.round(H * 0.15), y1 = Math.round(H * 0.70);
        for (var y = y0; y < y1; y++) {
          for (var x = 1; x < W - 1; x++) {
            var i = (y * W + x) * 4;
            var g = Math.abs(lum(i + 4) - lum(i - 4));
            if (x < mid) leftE += g; else rightE += g;
          }
        }
        var tot = leftE + rightE;
        if (tot <= 0) return 'unknown';
        var bias = (rightE - leftE) / tot;
        if (bias > 0.10) return 'right';
        if (bias < -0.10) return 'left';
        return 'center';
      } catch (_) { return 'unknown'; }
    }
    function detectFacing(dataUrl) {
      return new Promise(function (resolve) {
        var done = false;
        function finish(v) { if (!done) { done = true; resolve(v); } }
        setTimeout(function () { finish('unknown'); }, 4000); // never block the UI
        try {
          var img = new Image();
          img.onload = function () {
            if (typeof window.FaceDetector === 'function') {
              try {
                var fd = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
                fd.detect(img).then(function (faces) {
                  if (faces && faces.length) {
                    var f = faces[0], bb = f.boundingBox, nose = null, eyes = [];
                    (f.landmarks || []).forEach(function (lm) {
                      var loc = lm && lm.locations && lm.locations[0];
                      if (!loc) return;
                      if (lm.type === 'nose') nose = loc;
                      else if (lm.type === 'eye') eyes.push(loc);
                    });
                    if (bb && nose) { finish(classify(bb, nose)); return; }
                    if (bb && eyes.length === 2) { finish(classify(bb, { x: (eyes[0].x + eyes[1].x) / 2 })); return; }
                  }
                  finish(heuristicFacing(img));
                }).catch(function () { finish(heuristicFacing(img)); });
                return;
              } catch (_) { /* fall through to heuristic */ }
            }
            finish(heuristicFacing(img));
          };
          img.onerror = function () { finish('unknown'); };
          img.src = dataUrl;
        } catch (_) { finish('unknown'); }
      });
    }
    var detecting = false;
    function maybeDetect() {
      var pi = readPI();
      var photo = (pi && typeof pi.photo === 'string') ? pi.photo : '';
      if (!photo || detecting) return;
      var sp = (pi.stylePrefs && typeof pi.stylePrefs === 'object') ? pi.stylePrefs : {};
      var sig = photoSig(photo);
      if (sp.photoFacingSig === sig) return; // already detected for this exact photo
      detecting = true;
      detectFacing(photo).then(function (facing) {
        detecting = false;
        writeFacing(facing, sig);
        if (readMode() === 'auto') {
          applyPreview();
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'photo-facing' } })); } catch (_) {}
        }
        var ui = document.querySelector('[' + UI_ATTR + '="1"]');
        if (ui) refreshUI(ui);
      });
    }

    // ── preview apply (mirror the rendered <img>) ──────────────────────────
    function previewPhotos() {
      var out = [];
      var papers = document.querySelectorAll('.antcv-preview-paper');
      for (var i = 0; i < papers.length; i++) {
        var imgs = papers[i].querySelectorAll('img');
        for (var j = 0; j < imgs.length; j++) {
          var img = imgs[j], st = img.getAttribute('style') || '';
          if (st.indexOf('border-radius') >= 0
            || img.getAttribute('data-antcv-photo-clone') === '1'
            || img.getAttribute('data-antcv-repeat-photo') === '1') out.push(img);
        }
      }
      return out;
    }
    function applyPreview() {
      var want = resolveFlipH();
      var imgs = previewPhotos();
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i], on = img.getAttribute('data-antcv-photo-flip') === '1';
        if (want && !on) {
          // Pentagon uses filter/clip-path (not transform), so this composes.
          img.style.setProperty('transform', FLIP_TX, 'important');
          img.style.setProperty('transform-origin', 'center', 'important');
          img.setAttribute('data-antcv-photo-flip', '1');
        } else if (!want && on) {
          img.style.removeProperty('transform');
          img.style.removeProperty('transform-origin');
          img.removeAttribute('data-antcv-photo-flip');
        }
      }
    }

    // ── settings UI (segmented Off / On / Auto) ────────────────────────────
    function styleSeg(btn, active) {
      btn.style.cssText = [
        'padding:4px 12px',
        'background:' + (active ? 'rgba(1,183,187,.1)' : 'rgba(255,255,255,.04)'),
        'color:' + (active ? '#01B7BB' : '#d7e6ee'),
        'border:1px solid ' + (active ? '#01B7BB' : 'rgba(255,255,255,.18)'),
        'border-radius:6px', 'cursor:pointer', 'font-family:inherit',
        'font-size:11px', 'font-weight:600', 'white-space:nowrap',
      ].join(';');
    }
    function refreshUI(wrap) {
      var mode = readMode();
      var btns = wrap.querySelectorAll('button[data-mode]');
      for (var i = 0; i < btns.length; i++) {
        var active = btns[i].getAttribute('data-mode') === mode;
        // write-on-change (SETTINGS-SWEEP-STABILIZE): only restyle on transition.
        if ((btns[i].getAttribute('data-active') === '1') !== active || !btns[i].getAttribute('data-styled')) {
          styleSeg(btns[i], active);
          btns[i].setAttribute('data-active', active ? '1' : '0');
          btns[i].setAttribute('data-styled', '1');
        }
      }
      var hint = wrap.querySelector('[data-antcv-flip-hint]');
      if (hint) {
        var text = '', disp = 'none';
        if (mode === 'auto') {
          var f = readFacing();
          text = (f === 'unknown' || f === 'center')
            ? 'Auto: no clear orientation detected — not flipped.'
            : 'Auto: subject faces ' + f + ' — ' + (resolveFlipH() ? 'flipped to face the content.' : 'already faces the content.');
          disp = '';
        }
        if (hint.textContent !== text) hint.textContent = text;
        if (hint.style.display !== disp) hint.style.display = disp;
      }
    }
    function buildControl() {
      var wrap = document.createElement('div');
      wrap.setAttribute(UI_ATTR, '1');
      wrap.style.marginTop = '10px';
      var lbl = document.createElement('div');
      lbl.textContent = 'Flip photo';
      lbl.style.cssText = 'font-size:10px;letter-spacing:.4px;text-transform:uppercase;opacity:.7;color:#d7e6ee;margin-bottom:5px;';
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
      var LABELS = { off: 'Off', on: 'On', auto: 'Auto' };
      var TITLES = {
        off: 'No flip — the photo is used as uploaded.',
        on: 'Mirror the photo horizontally.',
        auto: 'Face the subject into the content, using the orientation detected at upload. Adapts when the sidebar swaps sides or the photo position changes.',
      };
      MODES.forEach(function (m) {
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('data-mode', m);
        b.textContent = LABELS[m];
        b.title = TITLES[m];
        b.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          writeMode(m);
          applyPreview();
          refreshUI(wrap);
        });
        row.appendChild(b);
      });
      var hint = document.createElement('div');
      hint.setAttribute('data-antcv-flip-hint', '1');
      hint.style.cssText = 'font-size:10px;line-height:1.35;opacity:.6;color:#d7e6ee;margin-top:5px;display:none;';
      wrap.appendChild(lbl); wrap.appendChild(row); wrap.appendChild(hint);
      return wrap;
    }
    function findPhotoSection() {
      // Same anchor as MODULE C: the PROFILE PHOTO control container (the label's
      // parent). Appending our control there makes it a child of the collapse
      // sidecar's `ctrl`, so it hides/shows with the rest of the panel.
      try {
        var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
          acceptNode: function (node) {
            var t = (node.textContent || '').trim();
            return (t && /^PROFILE PHOTO$/i.test(t)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
          },
        });
        var tNode = walker.nextNode();
        if (!tNode) return null;
        var n = tNode.parentElement;
        if (n && n.parentElement) n = n.parentElement;
        return n;
      } catch (_) { return null; }
    }
    function ensureUI() {
      // Fast path: already injected + connected → just refresh (skip the walk).
      var existing = document.querySelector('[' + UI_ATTR + '="1"]');
      if (existing && existing.isConnected) { refreshUI(existing); return; }
      var section = findPhotoSection();
      if (!section) return;
      if (section.querySelector('[' + UI_ATTR + '="1"]')) return;
      var ctrl = buildControl();
      section.appendChild(ctrl);
      refreshUI(ctrl);
    }

    function boot() {
      window.addEventListener('storage', function (ev) {
        if (!ev || ev.key === 'personalInfo' || ev.key === 'photoPosition' || ev.key === 'sidebarPosition' || ev.key === null) applyPreview();
      });
      // photoPosition / sidebar swaps change the AUTO target; re-apply post-click.
      document.addEventListener('click', function () { setTimeout(applyPreview, 60); }, true);
    }

    window.AntcvPhotoFlip = {
      version: '1.51.761',
      MODES: MODES.slice(),
      _readMode: readMode,
      _readFacing: readFacing,
      _desiredFacing: desiredFacing,
      _resolveFlipH: resolveFlipH,
      _detectFacing: detectFacing,
      _applyPreview: applyPreview,
    };

    return {
      boot: boot,
      tick: function () {
        try { ensureUI(); } catch (_) {}
        try { maybeDetect(); } catch (_) {}
        try { applyPreview(); } catch (_) {}
      },
    };
  })();

  /* ========================================================================
   * Shared boot: register ticks, install the ONE MutationObserver, run each
   * module's non-observer wiring + initial pass.
   * ===================================================================== */
  ticks.push(PhotoPosition.tick, Pentagon.tick, Bridge.tick, Flip.tick);

  function boot() {
    try { PhotoPosition.boot(); } catch (_) {}
    try { Pentagon.boot(); } catch (_) {}
    try { Bridge.boot(); } catch (_) {}
    try { Flip.boot(); } catch (_) {}
    try {
      new MutationObserver(scheduleAll).observe(document.body || document.documentElement,
        { childList: true, subtree: true });
    } catch (_) {}
    scheduleAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  try { console.debug('[photo-ui-427] installed v' + SUITE_VERSION + ' (position+pentagon+bridge+flip)'); } catch (_) {}
})();
