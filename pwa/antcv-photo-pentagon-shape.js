/* AntCV pentagon-shape sidecar (v1.50.56)
 * ============================================================
 * Adds a "Pentagon" profile-photo shape to the shape row in
 * Settings (the Circle / Rounded / Square group, class
 * `antcv-fp-shape-btn`, rendered by the immutable app.js), and
 * applies the pentagon mask to the live preview photo.
 *
 * Why a sidecar
 * -------------
 * app.js is minified and externally built. Its shape row exposes
 * only circle / rounded / square and writes the chosen value to the
 * React photo state plus (historically) inline border-radius on the
 * preview <img>. There is no pentagon path. Rather than fork app.js,
 * we:
 *   1. Inject a Pentagon button into the shape row, after Square.
 *   2. Persist the choice to personalInfo.photoShape (the same key
 *      antcv-docx-client.js reads to forward `photoShape` to the
 *      DOCX/PDF worker, which maps it to <a:prstGeom prst="pentagon">
 *      so export matches preview — GEN-001 parity).
 *   3. Apply / remove an SVG clip-path on the preview photo so the
 *      live preview shows the pentagon immediately.
 *
 * Parity note (GEN-001): pentagon round-trips to DOCX and PDF via the
 * worker's shape-aware makePhotosCircular() (worker v1.15+). The
 * preview uses clip-path:polygon(...) — the same 5-point geometry —
 * so Preview, DOCX and PDF agree.
 *
 * The native circle/rounded/square buttons keep working unchanged;
 * picking any of them clears our pentagon override and mask.
 */
(function () {
  'use strict';

  if (window.__antcvPentagonShapeInstalled) return;
  window.__antcvPentagonShapeInstalled = '1.50.56';

  var SHAPE_KEY_ATTR = 'data-shape';
  var PENTAGON = 'pentagon';
  // Regular pentagon, point up, normalised to a 0..100 box. Matches the
  // worker's prst="pentagon" and the islands swatch geometry.
  var PENTAGON_POLY =
    'polygon(50% 0%, 97.55% 34.55%, 79.39% 90.45%, 20.61% 90.45%, 2.45% 34.55%)';

  // ─── personalInfo.photoShape persistence ──────────────────────────
  function readPI() {
    try { return JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; }
    catch (_) { return {}; }
  }
  function writePhotoShape(shape) {
    try {
      var pi = readPI();
      if (shape) pi.photoShape = shape; else delete pi.photoShape;
      localStorage.setItem('personalInfo', JSON.stringify(pi));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:photo-shape-changed',
        { detail: { shape: shape || '' } }));
    } catch (_) {}
  }
  function currentPhotoShape() {
    var pi = readPI();
    return (pi && typeof pi.photoShape === 'string') ? pi.photoShape : '';
  }

  // ─── Shape row discovery ───────────────────────────────────────────
  // app.js renders the shape buttons as <button class="antcv-fp-shape-btn"
  // data-shape="circle|rounded|square">. We find the Square button and
  // insert our Pentagon button right after it.
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
    // Mirror the markup of the native buttons: a swatch span + label.
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

  // When a native shape button is clicked, drop our override so the
  // built-in shape wins again. We listen in capture so we see the click
  // before app.js re-renders.
  function onNativeShapeClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var native = t.closest('button.antcv-fp-shape-btn[' + SHAPE_KEY_ATTR + ']');
    if (!native) return;
    var shape = native.getAttribute(SHAPE_KEY_ATTR);
    if (shape && shape !== PENTAGON) {
      // A built-in shape was chosen — clear our override + mask.
      if (currentPhotoShape() === PENTAGON) writePhotoShape('');
      // Remove any mask we applied; let app.js restore its own styling.
      clearPreviewShape();
    }
  }

  // ─── Inject the Pentagon button + reflect active state ─────────────
  function ensureButtons() {
    var rows = findShapeRows();
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var sq = squareButtonIn(row);
      // Only act on the photo-shape row (the one that has circle/square),
      // not the contour/shadow rows that reuse the same class.
      if (!sq) continue;
      var pent = pentagonButtonIn(row);
      if (!pent) {
        pent = buildPentagonButton();
        if (sq.nextSibling) row.insertBefore(pent, sq.nextSibling);
        else row.appendChild(pent);
      }
      // Reflect persisted active state.
      if (currentPhotoShape() === PENTAGON) {
        setActive(row, pent);
      }
    }
  }

  // ─── Preview mask ──────────────────────────────────────────────────
  // The preview photo is the <img> carrying inline border-radius (placed
  // by app.js) inside .antcv-preview-paper. When pentagon is active we
  // override with clip-path; when not, we strip our overrides.
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

  function applyPreviewShape() {
    if (currentPhotoShape() !== PENTAGON) { clearPreviewShape(); return; }
    var imgs = previewPhotos();
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      img.style.setProperty('clip-path', PENTAGON_POLY, 'important');
      img.style.setProperty('-webkit-clip-path', PENTAGON_POLY, 'important');
      // A clip-path overrides border-radius visually; keep it square-bound
      // so the pentagon isn't itself rounded at the tips.
      img.style.setProperty('border-radius', '0', 'important');
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
      img.removeAttribute('data-antcv-pentagon-clip');
    }
  }

  // ─── Observers + triggers ──────────────────────────────────────────
  var scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      try { ensureButtons(); } catch (e) { /* settings row may be absent */ }
      try { applyPreviewShape(); } catch (e) {}
    });
  }

  function boot() {
    document.addEventListener('click', onNativeShapeClick, true);
    window.addEventListener('antcv:photo-shape-changed', applyPreviewShape);
    window.addEventListener('storage', function (ev) {
      if (ev.key === 'personalInfo') schedule();
    });
    var mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    schedule();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Debug / test API
  window.AntcvPentagonShape = {
    version: '1.50.56',
    POLY: PENTAGON_POLY,
    _current: currentPhotoShape,
    _apply: applyPreviewShape,
    _clear: clearPreviewShape,
    _ensure: ensureButtons,
  };
})();
