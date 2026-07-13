/* AntCV photo library — PHOTO-LIBRARY-001 (owner 2026-07-13)
 * ============================================================================
 * "Allow uploading more than one profile picture at the same time."
 *
 * A small library of saved profile photos (max 4), rendered as a thumbnail
 * strip inside the Profile Photo panel:
 *   - "＋ Add photos…" — the ONE upload control (PHOTO-BTN-FUSE-001, owner
 *     2026-07-13): multi-select; every picked image is COMPRESSED to fit the
 *     cloud entry cap, stored in the library, and the FIRST one is activated.
 *     The native single-file "Change photo" button is hidden as redundant.
 *     When the library is full, adding evicts the oldest entries.
 *   - click a thumbnail — ACTIVATE: the stored file is re-driven through the
 *     app's OWN hidden upload input (DataTransfer + change event), so the
 *     app's entire processing pipeline (square store, preview, cloud photo
 *     sync) runs exactly as for a manual upload. No app.js changes.
 *   - ✕ on a thumbnail — remove from the library (never touches the active
 *     photo).
 *   - the native "Reset" button ALSO empties the library (the app already
 *     restores the embedded default ant as the active photo).
 *
 * Storage: localStorage 'antcv:photoLibrary' = JSON [{id, ts, dataUrl}].
 * Cloud: round-trips through /api/prefs as the allowlisted 'photoLibrary'
 * string field (relay auth-32) with the same push/restore/backfill semantics
 * as the other sync sidecars. Caps: 4 entries, ~500KB per entry, so the field
 * stays lean.
 *
 * Repaint variants (bright/dark via an image model) are a follow-up — the
 * library is the storage + activation layer they would plug into.
 *
 * Kill: localStorage['antcv:disable-photo-library'] = '1'
 */
(function () {
  'use strict';

  var VERSION = '1.51.391';
  if (window.__antcvPhotoLibrary === VERSION) return;
  window.__antcvPhotoLibrary = VERSION;

  var KEY = 'antcv:photoLibrary';
  var CLOUD_FIELD = 'photoLibrary';
  var MAX_ENTRIES = 4;
  var MAX_ENTRY_BYTES = 500 * 1024;
  var STRIP_MARK = 'data-antcv-photo-library';

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
  function btn(label, title, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.style.cssText = 'padding:4px 8px;background:rgba(1,183,187,0.12);color:#01B7BB;border:1px solid #01B7BB;border-radius:5px;font-size:10px;font-weight:600;cursor:pointer;';
    b.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); onClick(); });
    return b;
  }
  // PHOTO-BTN-FUSE-001: "＋ Add photos…" covers the single-change case (first
  // added photo becomes active), so the app's single-file "Change photo" button
  // is redundant — hide it. Runs every render sweep because React re-creates
  // the button on re-render.
  function hideNativeChangePhoto(panel) {
    var btns = panel.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if ((b.textContent || '').trim() === 'Change photo' && b.style.display !== 'none') b.style.display = 'none';
    }
  }
  function render() {
    if (disabled()) return;
    var panel = findPanel();
    if (!panel || !panel.parentElement) return;
    hideNativeChangePhoto(panel);
    var existing = panel.parentElement.querySelector('[' + STRIP_MARK + ']');
    var entries = lib();
    var sig = entries.map(function (e) { return e.id; }).join(',');
    if (existing && existing.getAttribute(STRIP_MARK) === sig) return;
    if (existing) existing.remove();

    var strip = document.createElement('div');
    strip.setAttribute(STRIP_MARK, sig);
    strip.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:6px 0 2px 0;';

    var label = document.createElement('span');
    label.textContent = 'Library:';
    label.style.cssText = 'font-size:10px;font-weight:600;color:rgba(255,255,255,0.45);letter-spacing:0.3px;';
    strip.appendChild(label);

    entries.forEach(function (e) {
      var wrap = document.createElement('span');
      wrap.style.cssText = 'position:relative;display:inline-block;';
      var img = document.createElement('img');
      img.src = e.dataUrl;
      img.title = 'Activate this photo';
      img.style.cssText = 'width:34px;height:34px;border-radius:50%;object-fit:cover;border:2px solid rgba(1,183,187,0.5);cursor:pointer;display:block;';
      img.addEventListener('click', function () { activate(e); });
      var x = document.createElement('span');
      x.textContent = '✕';
      x.title = 'Remove from library';
      x.style.cssText = 'position:absolute;top:-6px;right:-6px;width:14px;height:14px;line-height:14px;text-align:center;font-size:9px;border-radius:50%;background:#333;color:#ccc;cursor:pointer;';
      x.addEventListener('click', function (ev) {
        ev.stopPropagation();
        save(lib().filter(function (o) { return o.id !== e.id; }));
      });
      wrap.appendChild(img); wrap.appendChild(x);
      strip.appendChild(wrap);
    });

    // Always offered — it is the ONE upload control now (PHOTO-BTN-FUSE-001).
    // At MAX_ENTRIES, adding evicts the oldest entries (newest-first slice).
    var multi = document.createElement('input');
    multi.type = 'file'; multi.accept = 'image/*'; multi.multiple = true;
    multi.style.display = 'none';
    multi.addEventListener('change', function () { addFiles(multi.files, true); multi.value = ''; });
    strip.appendChild(multi);
    strip.appendChild(btn('＋ Add photos…', 'Upload one or more photos (saved to the library, compressed for cloud sync; first becomes active)', function () { multi.click(); }));
    panel.appendChild(strip);
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
      } catch (_) {}
    }, true);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.AntcvPhotoLibrary = { version: VERSION, _lib: lib, _save: save, _activate: activate, _render: render, _addFiles: addFiles };
})();
