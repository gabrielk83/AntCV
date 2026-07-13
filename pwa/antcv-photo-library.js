/* AntCV photo library — PHOTO-LIBRARY-001 (owner 2026-07-13)
 * ============================================================================
 * "Allow uploading more than one profile picture at the same time."
 *
 * A small library of saved profile photos (max 4). Instead of a separate
 * thumbnail strip, the extra photos live INSIDE the main Profile Photo block
 * as a carousel (PHOTO-CAROUSEL-001, owner 2026-07-13):
 *   - the 56px photo block shows one library photo at a time, ON TOP of the
 *     app's own photo <img> (so the block still reflects the ACTIVE photo).
 *   - ‹ / › small circular arrows + a finger SWIPE over the block move
 *     between the saved photos to review them; a row of dots shows position.
 *   - ✕ (top-right of the block) removes the shown photo from the library.
 *   - landing on a photo ACTIVATES it (debounced): the stored file is
 *     re-driven through the app's OWN hidden upload input (DataTransfer +
 *     change event), so the app's whole pipeline (square store, preview,
 *     cloud photo sync) runs exactly as for a manual upload. No app.js changes.
 *
 * Controls under the block:
 *   - "＋ Add photos…" — the ONE upload control (PHOTO-BTN-FUSE-001, owner
 *     2026-07-13): multi-select; every picked image is COMPRESSED to fit the
 *     cloud entry cap, stored in the library, and the FIRST one is activated.
 *     The native single-file "Change photo" button is hidden as redundant.
 *     When the library is full, adding evicts the oldest entries.
 *   - "↺ Reset" — drives the app's own (hidden) Reset button — which restores
 *     the embedded default ant — and empties the library. The native Reset
 *     stays in the DOM (hidden) as the reset mechanism.
 *
 * No functionality lost vs. the old strip: add (+activate-first), per-photo
 * remove, activate-a-saved-photo (now = navigate to it), reset, cloud sync are
 * all preserved — the surface is just folded into the photo block.
 *
 * Storage: localStorage 'antcv:photoLibrary' = JSON [{id, ts, dataUrl}].
 * Cloud: round-trips through /api/prefs as the allowlisted 'photoLibrary'
 * string field (relay auth-32) with the same push/restore/backfill semantics
 * as the other sync sidecars. Caps: 4 entries, ~500KB per entry, so the field
 * stays lean.
 *
 * Kill: localStorage['antcv:disable-photo-library'] = '1'
 */
(function () {
  'use strict';

  var VERSION = '1.51.418';
  if (window.__antcvPhotoLibrary === VERSION) return;
  window.__antcvPhotoLibrary = VERSION;

  var KEY = 'antcv:photoLibrary';
  var CLOUD_FIELD = 'photoLibrary';
  var MAX_ENTRIES = 4;
  var MAX_ENTRY_BYTES = 500 * 1024;
  var CONTROLS_MARK = 'data-antcv-photo-library';   // Add + Reset column
  var OVERLAY_MARK = 'data-antcv-photo-carousel';   // carousel over the block

  var currentIndex = 0;        // which library entry the block is showing
  var activateTimer = null;    // debounce so rapid swiping activates once

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-photo-library'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  function lib() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(v) ? v : [];
    } catch (_) { return []; }
  }
  function save(entries) {
    try { localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))); } catch (_) {}
    pushCloud();
    schedule();
  }

  // ── cloud round-trip (same pattern as the sync-extra sidecars) ────────────
  var pushedOnce = '';
  function pushCloud() {
    try {
      if (typeof window._antcvCloudWrite !== 'function') return;
      var cur = localStorage.getItem(KEY) || '';
      if (!cur || cur === pushedOnce) return;
      pushedOnce = cur;
      var patch = {}; patch[CLOUD_FIELD] = cur;
      window._antcvCloudWrite(patch);
    } catch (_) {}
  }
  var restored = false;
  function restoreCloud() {
    if (restored || disabled()) return;
    restored = true;
    try {
      var base = '';
      try { base = String(JSON.parse(localStorage.getItem('proxyUrl') || '""') || '').replace(/\/+$/, ''); } catch (_) {}
      if (!base && typeof window.ANTCV_RELAY_URL === 'string') base = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
      if (!base) return;
      fetch(base + '/api/prefs', { method: 'GET', credentials: 'include' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var v = j && j.prefs && j.prefs[CLOUD_FIELD];
          if (typeof v === 'string' && v && !localStorage.getItem(KEY)) {
            try { localStorage.setItem(KEY, v); schedule(); } catch (_) {}
          } else if (!v && localStorage.getItem(KEY)) {
            pushCloud();   // backfill: local library, empty cloud
          }
        }).catch(function () { restored = false; });
    } catch (_) { restored = false; }
  }

  // ── the app's own upload input (activation drives IT, not React state) ────
  function appFileInput(panel) {
    var scope = panel || document;
    var inputs = scope.querySelectorAll('input[type="file"]');
    for (var i = 0; i < inputs.length; i++) {
      var acc = (inputs[i].getAttribute('accept') || '').toLowerCase();
      if (acc.indexOf('image') >= 0 || acc === '') return inputs[i];
    }
    return null;
  }
  function dataUrlToFile(dataUrl, name) {
    var m = /^data:([^;,]+)/.exec(dataUrl) || [];
    var mime = m[1] || 'image/png';
    var bstr = atob(dataUrl.split(',')[1] || '');
    var arr = new Uint8Array(bstr.length);
    for (var i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
    return new File([arr], name || 'photo.png', { type: mime });
  }
  function activate(entry) {
    try {
      var panel = findPanel();
      var input = appFileInput(panel && panel.parentElement || document);
      if (!input) { console.warn('[photo-library] app upload input not found'); return; }
      var dt = new DataTransfer();
      dt.items.add(dataUrlToFile(entry.dataUrl, 'library-' + entry.id + '.png'));
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      console.info('[photo-library] activated', entry.id);
    } catch (e) { console.warn('[photo-library] activate failed:', e); }
  }
  function scheduleActivate(entry) {
    if (!entry) return;
    if (activateTimer) clearTimeout(activateTimer);
    activateTimer = setTimeout(function () {
      activateTimer = null;
      if (lib().some(function (o) { return o.id === entry.id; })) activate(entry);
    }, 300);
  }
  // PHOTO-BTN-FUSE-001: adding IS saving — every picked image is shrunk under
  // the cloud entry cap (downscale + JPEG re-encode) instead of being skipped.
  function compressToCap(dataUrl, cb) {
    if (!dataUrl) { cb(null); return; }
    if (dataUrl.length <= MAX_ENTRY_BYTES) { cb(dataUrl); return; }
    var img = new Image();
    img.onload = function () {
      try {
        var w = img.width || 1, h = img.height || 1;
        var scale = Math.min(1, 600 / Math.max(w, h));
        var q = 0.85, out = '', guard = 0;
        do {
          var c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(w * scale));
          c.height = Math.max(1, Math.round(h * scale));
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#fff';                    // JPEG has no alpha channel
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          out = c.toDataURL('image/jpeg', q);
          scale *= 0.75; q = Math.max(0.5, q - 0.1);
        } while (out.length > MAX_ENTRY_BYTES && ++guard < 6);
        cb(out.length <= MAX_ENTRY_BYTES ? out : null);
      } catch (_) { cb(null); }
    };
    img.onerror = function () { cb(null); };
    img.src = dataUrl;
  }
  function addFiles(fileList, thenActivateFirst) {
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var entries = lib();
    var first = null;
    var pendingReads = files.length;
    function done() {
      if (--pendingReads === 0) {
        currentIndex = 0;               // freshest photo becomes the shown one
        save(entries);
        if (thenActivateFirst && first) activate(first);
      }
    }
    files.forEach(function (f, idx) {
      var rd = new FileReader();
      rd.onload = function () {
        compressToCap(String(rd.result || ''), function (dataUrl) {
          if (dataUrl) {
            var entry = { id: Date.now().toString(36) + idx, ts: Date.now(), dataUrl: dataUrl };
            entries = [entry].concat(entries).slice(0, MAX_ENTRIES);
            if (!first) first = entry;
          } else {
            console.warn('[photo-library] image could not be compressed under the cap; skipped');
          }
          done();
        });
      };
      rd.onerror = done;
      rd.readAsDataURL(f);
    });
  }

  // ── carousel navigation ───────────────────────────────────────────────────
  function navigate(delta) {
    var entries = lib();
    if (entries.length < 2) return;
    currentIndex = (currentIndex + delta + entries.length) % entries.length;
    render();                         // instant visual flip
    scheduleActivate(entries[currentIndex]);
  }
  function goTo(i) {
    var entries = lib();
    if (i < 0 || i >= entries.length || i === currentIndex) return;
    currentIndex = i;
    render();
    scheduleActivate(entries[i]);
  }
  // ✕ removes the shown photo. If others remain, the neighbour is activated so
  // the block keeps showing a live library photo; removing the last one leaves
  // the active photo untouched (use "↺ Reset" to return to the default ant).
  function removeCurrent() {
    var entries = lib();
    if (!entries.length) return;
    var e = entries[currentIndex] || entries[0];
    var next = entries.filter(function (o) { return o.id !== e.id; });
    if (next.length) {
      if (currentIndex >= next.length) currentIndex = next.length - 1;
      activate(next[currentIndex]);
    }
    save(next);
  }

  // ── UI ────────────────────────────────────────────────────────────────────
  function findPanel() {
    var divs = document.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      if (divs[i].childElementCount === 0 && (divs[i].textContent || '').trim() === 'Profile Photo') {
        // the row container is a few levels up (photo img + labels + buttons)
        var p = divs[i];
        for (var up = 0; up < 3 && p.parentElement; up++) p = p.parentElement;
        return p;
      }
    }
    return null;
  }
  function findPhotoImg(panel) {
    var imgs = panel.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var im = imgs[i];
      if (im.closest && im.closest('[' + OVERLAY_MARK + ']')) continue;   // skip our own preview
      var w = im.offsetWidth || im.width || parseInt(im.style.width, 10) || 0;
      if (w < 32) continue;
      var br = (im.style.borderRadius || '') + ' ' +
        ((window.getComputedStyle && getComputedStyle(im).borderRadius) || '');
      var src = im.getAttribute('src') || '';
      if (br.indexOf('50%') >= 0 || src.indexOf('ant.png') >= 0 || src.indexOf('data:image') === 0) return im;
    }
    return null;
  }
  function btn(label, title, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.style.cssText = 'padding:4px 8px;background:rgba(1,183,187,0.12);color:#01B7BB;border:1px solid #01B7BB;border-radius:5px;font-size:10px;font-weight:600;cursor:pointer;';
    b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); onClick(); });
    return b;
  }
  function arrowBtn(glyph, title, onClick) {
    var b = document.createElement('button');
    b.type = 'button'; b.title = title; b.textContent = glyph;
    b.style.cssText = 'position:absolute;top:50%;transform:translateY(-50%);width:18px;height:18px;padding:0;line-height:15px;text-align:center;font-size:13px;font-weight:700;border-radius:50%;background:rgba(0,0,0,0.55);color:#fff;border:1px solid rgba(1,183,187,0.7);cursor:pointer;z-index:6;';
    b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); onClick(); });
    return b;
  }
  // PHOTO-BTN-FUSE-001: the strip owns the visible controls, so the app's
  // single-file "Change photo" and its "Reset" are hidden (never removed —
  // Reset stays as the reset mechanism the strip button clicks). Strip-owned
  // buttons are skipped. Runs every sweep because React re-creates buttons.
  function hideNativeButtons(panel) {
    var btns = panel.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (b.closest && b.closest('[' + CONTROLS_MARK + ']')) continue;
      var t = (b.textContent || '').trim();
      if ((t === 'Change photo' || t === 'Reset') && b.style.display !== 'none') b.style.display = 'none';
    }
  }
  function findNativeReset(panel) {
    var btns = panel.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if ((b.textContent || '').trim() === 'Reset' && !(b.closest && b.closest('[' + CONTROLS_MARK + ']'))) return b;
    }
    return null;
  }

  // Add + Reset column (persists; recreated only if React drops it).
  function renderControls(panel) {
    if (panel.parentElement.querySelector('[' + CONTROLS_MARK + ']')) return;
    var col = document.createElement('div');
    col.setAttribute(CONTROLS_MARK, 'controls');
    col.style.cssText = 'display:inline-flex;flex-direction:column;gap:4px;margin:6px 0 2px 0;';
    var multi = document.createElement('input');
    multi.type = 'file'; multi.accept = 'image/*'; multi.multiple = true;
    multi.style.display = 'none';
    multi.addEventListener('change', function () { addFiles(multi.files, true); multi.value = ''; });
    col.appendChild(multi);
    col.appendChild(btn('＋ Add photos…', 'Upload one or more photos (saved to the library, compressed for cloud sync; first becomes active)', function () { multi.click(); }));
    col.appendChild(btn('↺ Reset', 'Restore the default photo and empty the library', function () {
      var native = findNativeReset(panel);
      if (native) native.click();     // app restores the embedded default ant
      if (lib().length) save([]);
      currentIndex = 0;
    }));
    panel.appendChild(col);
  }

  function attachSwipe(o) {
    var startX = null;
    function end(x) {
      if (startX === null) return;
      var dx = x - startX; startX = null;
      if (Math.abs(dx) > 24) navigate(dx < 0 ? 1 : -1);   // swipe left → next
    }
    o.addEventListener('touchstart', function (e) { if (e.touches && e.touches[0]) startX = e.touches[0].clientX; }, { passive: true });
    o.addEventListener('touchend', function (e) { var t = e.changedTouches && e.changedTouches[0]; if (t) end(t.clientX); }, { passive: true });
    // mouse/pen drag (skip pointerType 'touch' — the touch* handlers own it)
    o.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch') return; startX = e.clientX; });
    o.addEventListener('pointerup', function (e) { if (e.pointerType === 'touch') return; end(e.clientX); });
  }
  function buildOverlay() {
    var o = document.createElement('div');
    o.setAttribute(OVERLAY_MARK, '');
    o.style.cssText = 'position:absolute;z-index:5;box-sizing:border-box;touch-action:pan-y;';
    var pic = document.createElement('img');
    pic.className = 'antcv-carousel-pic';
    pic.style.cssText = 'width:100%;height:100%;border-radius:50%;object-fit:cover;border:2px solid rgba(1,183,187,0.6);display:block;';
    o.appendChild(pic);
    var prev = arrowBtn('‹', 'Previous photo', function () { navigate(-1); });
    prev.className = 'antcv-carousel-prev'; prev.style.left = '-9px';
    var next = arrowBtn('›', 'Next photo', function () { navigate(1); });
    next.className = 'antcv-carousel-next'; next.style.right = '-9px';
    o.appendChild(prev); o.appendChild(next);
    var x = document.createElement('span');
    x.className = 'antcv-carousel-x';
    x.textContent = '✕';
    x.title = 'Remove this photo from the library';
    x.style.cssText = 'position:absolute;top:-6px;right:-6px;width:15px;height:15px;line-height:15px;text-align:center;font-size:9px;border-radius:50%;background:#333;color:#ccc;cursor:pointer;z-index:6;';
    x.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); removeCurrent(); });
    o.appendChild(x);
    var dots = document.createElement('div');
    dots.className = 'antcv-carousel-dots';
    dots.style.cssText = 'position:absolute;left:0;right:0;top:100%;margin-top:3px;display:flex;justify-content:center;gap:3px;';
    o.appendChild(dots);
    attachSwipe(o);
    return o;
  }
  function fillOverlay(o, entries) {
    var pic = o.querySelector('.antcv-carousel-pic');
    if (pic) pic.src = entries[currentIndex].dataUrl;
    var many = entries.length > 1;
    var prev = o.querySelector('.antcv-carousel-prev');
    var next = o.querySelector('.antcv-carousel-next');
    if (prev) prev.style.display = many ? 'block' : 'none';
    if (next) next.style.display = many ? 'block' : 'none';
    var dots = o.querySelector('.antcv-carousel-dots');
    if (dots) {
      dots.innerHTML = '';
      if (many) {
        entries.forEach(function (e, i) {
          var d = document.createElement('span');
          d.style.cssText = 'width:5px;height:5px;border-radius:50%;cursor:pointer;background:' +
            (i === currentIndex ? '#01B7BB' : 'rgba(1,183,187,0.35)') + ';';
          d.addEventListener('click', function (ev) { ev.stopPropagation(); goTo(i); });
          dots.appendChild(d);
        });
      }
    }
  }
  function positionOverlay(o, img) {
    var l = img.offsetLeft + 'px', t = img.offsetTop + 'px';
    var w = (img.offsetWidth || 56) + 'px', h = (img.offsetHeight || 56) + 'px';
    // guard each write: MutationObserver ignores attributes, but skipping
    // no-op style writes keeps this cheap on every sweep.
    if (o.style.left !== l) o.style.left = l;
    if (o.style.top !== t) o.style.top = t;
    if (o.style.width !== w) o.style.width = w;
    if (o.style.height !== h) o.style.height = h;
  }
  function renderCarousel(panel) {
    var overlay = panel.parentElement.querySelector('[' + OVERLAY_MARK + ']');
    var img = findPhotoImg(panel);
    var entries = lib();
    if (!img || !entries.length) {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      return;
    }
    if (currentIndex >= entries.length) currentIndex = entries.length - 1;
    if (currentIndex < 0) currentIndex = 0;

    var host = img.parentElement;
    var pos = (window.getComputedStyle ? getComputedStyle(host).position : '') || 'static';
    if (pos === 'static') host.style.position = 'relative';

    if (overlay && overlay.__antcvHost !== host && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);   // photo re-homed by React
      overlay = null;
    }
    if (!overlay) {
      overlay = buildOverlay();
      host.appendChild(overlay);
      overlay.__antcvHost = host;
    }
    var sig = entries.map(function (e) { return e.id; }).join(',') + '@' + currentIndex;
    if (overlay.getAttribute(OVERLAY_MARK) !== sig) {
      fillOverlay(overlay, entries);
      overlay.setAttribute(OVERLAY_MARK, sig);
    }
    positionOverlay(overlay, img);
  }

  function render() {
    if (disabled()) return;
    var panel = findPanel();
    if (!panel || !panel.parentElement) return;
    hideNativeButtons(panel);
    renderControls(panel);
    renderCarousel(panel);
  }

  var timer = null;
  function schedule() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { timer = null; try { render(); } catch (_) {} }, 250);
  }

  function boot() {
    if (disabled()) return;
    schedule();
    setTimeout(restoreCloud, 3000);
    setInterval(pushCloud, 5000);
    new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule);
    // PHOTO-RESET-CLEAR-001 (owner 2026-07-13): the panel's native "Reset"
    // restores the embedded default ant as the active photo; it must ALSO
    // empty the library. Capture-phase so it fires even though React handles
    // the click itself.
    document.addEventListener('click', function (ev) {
      try {
        var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
        if (!b || (b.textContent || '').trim() !== 'Reset') return;
        var panel = findPanel();
        if (!panel || !(panel.contains(b) || (panel.parentElement && panel.parentElement.contains(b)))) return;
        if (lib().length) save([]);
        currentIndex = 0;
      } catch (_) {}
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.AntcvPhotoLibrary = {
    version: VERSION, _lib: lib, _save: save, _activate: activate,
    _render: render, _addFiles: addFiles, _navigate: navigate, _remove: removeCurrent
  };
})();
