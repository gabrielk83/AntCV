/* antcv-cl-signature-control.js — CL-SIGNATURE-CONTROL-001 (owner 2026-06-28/29)
 *
 * Layout-tab control for the COVER LETTER signature image (export shipped 1.14.93).
 * A collapsible block injected ONCE, directly AFTER the PROFILE PHOTO control (its
 * button-row marker [data-antcv-bridge-active]). Standalone localStorage keys so a
 * cloud-restore never clobbers it (see sidecar-prefs-clobber-hazard):
 *   antcv:signatureB64     data-URL of the uploaded image
 *   antcv:signatureAlign   'left' | 'center' | 'right'   (default 'center')
 *   antcv:signatureSize    width px                       (default 160)
 *   antcv:signatureAspect  height/width ratio, computed at upload via new Image()
 *   antcv:signatureHidden  '1' | '0'                      (default '0')
 *
 * NO app.js mirror. Own data-marker (data-antcv-cl-sig-control). Mounts ONCE (hides
 * any duplicate that leaks into another panel, mirroring the photo control's fix) and
 * sets no persistent display style on shared ancestors → no sticky leak.
 *
 * On any change it bumps a localStorage tick (antcv:signatureRev) and dispatches
 * 'antcv:signature-changed' so the preview (app.js srcdoc builder) can re-render.
 */
(function () {
  'use strict';
  if (window.__antcvClSignatureControl) return;
  window.__antcvClSignatureControl = true;

  var K = {
    b64: 'antcv:signatureB64',
    align: 'antcv:signatureAlign',
    size: 'antcv:signatureSize',
    aspect: 'antcv:signatureAspect',
    hidden: 'antcv:signatureHidden',
    open: 'antcv:sigCtrlOpen',
    rev: 'antcv:signatureRev'
  };
  var ACCENT = 'rgb(1,183,187)';
  function get(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (_) { return d; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function del(k) { try { localStorage.removeItem(k); } catch (_) {} }
  function bump() {
    set(K.rev, String((parseInt(get(K.rev, '0'), 10) || 0) + 1));
    try { window.dispatchEvent(new CustomEvent('antcv:signature-changed')); } catch (_) {}
    // SIGNATURE-PREVIEW-RERENDER-001 (owner 2026-06-29 "uploaded but nothing in the CL preview"):
    // the on-screen CL preview is a React render that reads the signature from localStorage on each
    // render, but a localStorage write alone doesn't re-render React. Fire the app's existing
    // 'antcv:sections-updated' refresh so the preview rebuilds and picks up the signature / align /
    // size immediately. (The migration sidecars listening to it are idempotent — cheap no-ops.)
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cl-signature-control' } })); } catch (_) {}
  }

  function isOpen() { return get(K.open, '0') === '1'; }
  function setOpen(v) { set(K.open, v ? '1' : '0'); }

  // ---- on-screen CL preview hooks (app.js sign-off render calls these) ----
  // The live preview is a React render; expose the signature as a React element + its
  // align so app.js can drop it between "Kind regards," and the typed name with a tiny
  // mirror edit. React is a UMD global (window.React). Returns null when hidden/absent.
  window.__antcvClSigAlign = function () {
    try {
      if (get(K.hidden, '0') === '1' || !get(K.b64, '')) return 'left';
      var al = String(get(K.align, 'center')).replace(/["']/g, '').toLowerCase();
      return (al === 'left' || al === 'right') ? al : 'center';
    } catch (_) { return 'left'; }
  };
  window.__antcvClSigEl = function () {
    try {
      var R = window.React; if (!R) return null;
      if (get(K.hidden, '0') === '1') return null;
      var sb = get(K.b64, ''); if (!sb) return null;
      var align = window.__antcvClSigAlign();
      var sz = Number(String(get(K.size, '160')).replace(/["']/g, '')), wd = (sz >= 40 && sz <= 400) ? Math.round(sz) : 160;
      return R.createElement('div', { style: { textAlign: align, marginTop: 6 } },
        R.createElement('img', { src: sb, style: { width: wd + 'px', height: 'auto', display: 'inline-block' } }));
    } catch (_) { return null; }
  };

  // ---- find the PROFILE PHOTO control (same marker the collapse sidecar uses) ----
  function photoControl() {
    var rows = document.querySelectorAll('[data-antcv-bridge-active]');
    for (var i = 0; i < rows.length; i++) {
      var ctrl = rows[i].parentElement;
      var c = ctrl && ctrl.firstElementChild;
      if (c && /PROFILE PHOTO/i.test(c.textContent || '') && (c.textContent || '').length < 40) return ctrl;
    }
    return null;
  }

  function btn(txt, on) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = txt;
    b.style.cssText = 'padding:4px 9px;margin:0;border-radius:5px;border:1px solid rgba(1,183,187,0.45);' +
      'background:rgba(1,183,187,0.10);color:' + ACCENT + ';font-size:10px;font-weight:600;cursor:pointer;';
    if (on) b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); on(b); });
    return b;
  }
  function setAlignActive(buttons) {
    var a = get(K.align, 'center');
    for (var k in buttons) {
      var active = (k === a);
      buttons[k].style.background = active ? ACCENT : 'rgba(1,183,187,0.10)';
      buttons[k].style.color = active ? '#04231f' : ACCENT;
    }
  }

  function build() {
    var box = document.createElement('div');
    box.setAttribute('data-antcv-cl-sig-control', '1');
    box.style.cssText = 'margin:8px 0 0 0;padding:8px 10px;border:1px solid rgba(1,183,187,0.25);' +
      'border-radius:8px;background:rgba(255,255,255,0.02);';

    // header (collapsible)
    var head = document.createElement('div');
    head.style.cssText = 'cursor:pointer;font-size:11px;font-weight:700;letter-spacing:.04em;color:' + ACCENT + ';' +
      'display:flex;align-items:center;gap:6px;user-select:none;';
    head.setAttribute('role', 'button');
    head.title = 'Show / hide the cover-letter signature controls';
    var caret = document.createElement('span');
    caret.style.cssText = 'font-size:9px;opacity:.7;';
    var htxt = document.createElement('span');
    htxt.textContent = 'COVER LETTER SIGNATURE';
    head.appendChild(caret);
    head.appendChild(htxt);

    var body = document.createElement('div');
    body.style.cssText = 'margin-top:8px;display:flex;flex-direction:column;gap:8px;';

    // current thumbnail + upload
    var thumbWrap = document.createElement('div');
    thumbWrap.style.cssText = 'display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
    var thumb = document.createElement('img');
    thumb.style.cssText = 'max-width:120px;max-height:48px;background:#fff;border-radius:4px;padding:2px;display:none;';
    var fileIn = document.createElement('input');
    fileIn.type = 'file';
    fileIn.accept = 'image/png,image/jpeg,image/jpg,image/gif,image/webp';
    fileIn.style.cssText = 'display:none;';
    var uploadBtn = btn('⬆ Upload signature', function () { fileIn.click(); });
    var removeBtn = btn('✕ Remove', function () {
      del(K.b64); del(K.aspect); bump(); refresh();
    });
    var note = document.createElement('div');
    note.style.cssText = 'font-size:9px;opacity:.6;flex-basis:100%;';
    note.textContent = 'PNG or JPG, transparent background recommended. HEIC is not supported by browsers — export one as PNG/JPG first.';

    fileIn.addEventListener('change', function () {
      var f = fileIn.files && fileIn.files[0];
      if (!f) return;
      if (/heic|heif/i.test(f.type) || /\.heic$|\.heif$/i.test(f.name || '')) {
        note.textContent = 'HEIC/HEIF can\'t be read in the browser — please convert to PNG or JPG and upload that.';
        note.style.color = '#ff9090';
        fileIn.value = '';
        return;
      }
      var rd = new FileReader();
      rd.onload = function () {
        var url = String(rd.result || '');
        var img = new Image();
        img.onload = function () {
          // SIGNATURE-WHITE-CLEAR-001 (owner 2026-06-29): process the upload through a canvas —
          // (a) make near-white pixels TRANSPARENT so the ink reads bold (no white box),
          // (b) fade partial-white (anti-aliased) edges, (c) bounding-box crop to the ink,
          // (d) downscale to <=600px wide. The result is a small transparent PNG that stores
          // reliably (a full-size raw PNG dataURL overflowed the localStorage quota and the
          // setItem failed silently -> "uploaded but not visible"). Raw fallback on any error.
          var stored = false;
          try {
            var nW = img.naturalWidth || img.width, nH = img.naturalHeight || img.height;
            if (nW && nH) {
              var MAXW = 600, sc = nW > MAXW ? MAXW / nW : 1;
              var w = Math.max(1, Math.round(nW * sc)), h = Math.max(1, Math.round(nH * sc));
              var cv = document.createElement('canvas'); cv.width = w; cv.height = h;
              var cx = cv.getContext('2d'); cx.drawImage(img, 0, 0, w, h);
              var minX = w, minY = h, maxX = 0, maxY = 0, hasInk = false;
              try {
                var idata = cx.getImageData(0, 0, w, h), d = idata.data;
                for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
                  var i = (y * w + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], a = d[i + 3];
                  if (a < 8) continue;
                  if (r > 232 && g > 232 && b > 232) { d[i + 3] = 0; continue; }     // near-white -> clear
                  var lum = (r + g + b) / 3;
                  if (lum > 180) { d[i + 3] = Math.round(a * (255 - lum) / 75); if (d[i + 3] < 8) continue; }
                  hasInk = true;
                  if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
                cx.putImageData(idata, 0, 0);
              } catch (_) { hasInk = false; }
              var outCv = cv;
              if (hasInk && maxX > minX && maxY > minY) {
                // SIGNATURE-PAD-002 (owner 2026-07-01: "signature cut in PDF" — NOT a circular clip).
                // The old 4px bounding-box crop (pad=4, sub-rectangle of the source) left the ink flush
                // to the edge, and when the source ink sat at the image edge there were no source pixels
                // to pad WITH — so the export's inline-image edge-clip cropped the "G" descender (and
                // the owner's sacrificial end-pattern). Rebuild the ink on a LARGER canvas with a
                // guaranteed transparent margin (wider at the BOTTOM for descenders), independent of the
                // source bounds, so the clip always eats whitespace, never ink.
                var inkW = maxX - minX + 1, inkH = maxY - minY + 1;
                var padX = Math.max(10, Math.round(inkW * 0.06));
                var padTop = Math.max(10, Math.round(inkH * 0.15));
                var padBot = Math.max(18, Math.round(inkH * 0.35));
                var cw = inkW + padX * 2, ch = inkH + padTop + padBot;
                var c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
                c2.getContext('2d').drawImage(cv, minX, minY, inkW, inkH, padX, padTop, inkW, inkH);
                outCv = c2;
              }
              var out = outCv.toDataURL('image/png');
              set(K.b64, out);
              set(K.aspect, String(Math.max(0.05, Math.min(3, outCv.height / outCv.width)).toFixed(4)));
              stored = !!localStorage.getItem(K.b64);
            }
          } catch (_) { stored = false; }
          if (!stored) {
            try { set(K.b64, url); set(K.aspect, String(Math.max(0.05, Math.min(3, (img.naturalHeight / img.naturalWidth) || 0.4)).toFixed(4))); stored = !!localStorage.getItem(K.b64); } catch (_) {}
          }
          if (stored) {
            if (get(K.hidden, '0') === '1') set(K.hidden, '0');
            note.style.color = '';
            note.textContent = 'Signature uploaded (white background cleared). It appears at the end of the cover letter.';
            bump(); refresh();
          } else {
            note.style.color = '#ff9090';
            note.textContent = 'Could not store the signature (image too large) — please try a smaller PNG.';
          }
        };
        img.onerror = function () {
          note.style.color = '#ff9090';
          note.textContent = 'Could not read that image — please use a PNG or JPG.';
        };
        img.src = url;
      };
      rd.readAsDataURL(f);
      fileIn.value = '';
    });

    thumbWrap.appendChild(thumb);
    thumbWrap.appendChild(uploadBtn);
    thumbWrap.appendChild(removeBtn);
    thumbWrap.appendChild(fileIn);
    thumbWrap.appendChild(note);

    // hidden toggle
    var hiddenRow = document.createElement('label');
    hiddenRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:#cdd;cursor:pointer;';
    var hiddenCb = document.createElement('input');
    hiddenCb.type = 'checkbox';
    hiddenCb.addEventListener('change', function () { set(K.hidden, hiddenCb.checked ? '1' : '0'); bump(); });
    hiddenRow.appendChild(hiddenCb);
    hiddenRow.appendChild(document.createTextNode('Hide signature (keep the typed name)'));

    // alignment
    var alignRow = document.createElement('div');
    alignRow.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;color:#cdd;';
    alignRow.appendChild(document.createTextNode('Align:'));
    var alignBtns = {};
    [['left', 'Left'], ['center', 'Center'], ['right', 'Right']].forEach(function (p) {
      var b = btn(p[1], function () { set(K.align, p[0]); setAlignActive(alignBtns); bump(); });
      alignBtns[p[0]] = b;
      alignRow.appendChild(b);
    });

    // size slider
    var sizeRow = document.createElement('div');
    sizeRow.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:10px;color:#cdd;';
    var sizeLbl = document.createElement('span');
    var sizeIn = document.createElement('input');
    sizeIn.type = 'range';
    sizeIn.min = '80'; sizeIn.max = '320'; sizeIn.step = '5';
    sizeIn.style.cssText = 'flex:1;';
    sizeIn.addEventListener('input', function () { set(K.size, sizeIn.value); sizeLbl.textContent = sizeIn.value + 'px'; bump(); });
    sizeRow.appendChild(document.createTextNode('Width:'));
    sizeRow.appendChild(sizeIn);
    sizeRow.appendChild(sizeLbl);

    body.appendChild(thumbWrap);
    body.appendChild(hiddenRow);
    body.appendChild(alignRow);
    body.appendChild(sizeRow);

    box.appendChild(head);
    box.appendChild(body);

    head.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      setOpen(!isOpen()); applyOpen();
    });

    function applyOpen() {
      var o = isOpen();
      caret.textContent = o ? '▾' : '▸';
      body.style.display = o ? 'flex' : 'none';
    }
    box.__refresh = function () {
      var b64 = get(K.b64, '');
      if (b64) { thumb.src = b64; thumb.style.display = ''; removeBtn.style.display = ''; }
      else { thumb.style.display = 'none'; removeBtn.style.display = 'none'; }
      hiddenCb.checked = get(K.hidden, '0') === '1';
      setAlignActive(alignBtns);
      var sz = parseInt(get(K.size, '160'), 10) || 160;
      sizeIn.value = String(sz); sizeLbl.textContent = sz + 'px';
      applyOpen();
    };
    box.__refresh();
    return box;
  }

  var mounted = null;
  function refresh() { if (mounted && mounted.__refresh) mounted.__refresh(); }

  function scan() {
    // hide any duplicate we previously mounted that is now detached / leaked
    var existing = document.querySelectorAll('[data-antcv-cl-sig-control]');
    if (existing.length > 1) {
      for (var j = 1; j < existing.length; j++) { if (existing[j].parentNode) existing[j].parentNode.removeChild(existing[j]); }
    }
    if (mounted && mounted.isConnected) { return; }
    var photo = photoControl();
    if (!photo || !photo.parentNode) return;
    // already a control right after the photo? adopt it.
    if (photo.nextElementSibling && photo.nextElementSibling.getAttribute &&
      photo.nextElementSibling.getAttribute('data-antcv-cl-sig-control') === '1') {
      mounted = photo.nextElementSibling; refresh(); return;
    }
    mounted = build();
    photo.parentNode.insertBefore(mounted, photo.nextSibling);
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; scan(); }, 140); }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; } }
  });
  function start() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    schedule();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
