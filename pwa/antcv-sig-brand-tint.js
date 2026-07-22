/* antcv-sig-brand-tint.js — SIG-BRAND-TINT-001 (owner 2026-07-23)
 * ===========================================================================
 * "always also match brand to signature color if brand is on."
 * The signature is a raster PNG (antcv:signatureB64) drawn in one ink; nothing
 * consumed brandV2.signatureColor (--brand-signature-color had no readers). This
 * sidecar TINTS the signature to the brand's signature colour whenever a brand
 * is on, at the SOURCE key — so the preview <img>, the export payload
 * (signature_b64) and every other read-site get the brand-matched signature with
 * no extra plumbing.
 *
 * Method: canvas flat recolour (fill colour, composite 'source-in') — keeps the
 * alpha (strokes), replaces every opaque pixel's colour. Idempotent: re-tinting
 * an already-tinted image to a new brand is lossless, so brand switches just work.
 * Non-destructive: the first tint stashes the pristine original at
 * antcv:signatureB64:original; when NO brand is on, the original is restored.
 * Marker antcv:signatureTintedTo records the applied colour (skip when current).
 *
 * Kill-switch: localStorage['antcv:disable-sig-brand-tint']='1' (restores the
 * original on the next pass). Editor-gated; no global observers.
 */
(function () {
  'use strict';
  if (window.__antcvSigBrandTint) return;
  window.__antcvSigBrandTint = '1.0';

  var KILL = 'antcv:disable-sig-brand-tint';
  var KEY = 'antcv:signatureB64';
  var ORIG = 'antcv:signatureB64:original';
  var MARK = 'antcv:signatureTintedTo';
  var busy = false;

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function editorActive() { try { var v = window.__antcvView; return !(v === 'upload' || v === 'input' || v === 'generating'); } catch (_) { return true; } }
  function readJSON(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
  function hex(v) { v = String(v || '').trim(); if (!/^#?[0-9a-fA-F]{6}$/.test(v)) return ''; return '#' + v.replace('#', ''); }
  function brandSigColor() {
    var m = readJSON('meta') || {};
    var b = (m && m.brandV2) || readJSON('antcv:brandV2') || null;
    if (!b || !b.headerBg) return '';          // no brand on
    return hex(b.signatureColor) || hex(b.accent) || '';
  }
  function notify() { try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'sig-brand-tint' } })); } catch (_) {} }

  function tintTo(color) {
    var src = localStorage.getItem(KEY);
    if (!src || src.length < 100) return;      // no signature
    if (localStorage.getItem(MARK) === color) return;   // already this colour
    if (busy) return; busy = true;
    var img = new Image();
    img.onload = function () {
      try {
        var c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        var g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        g.globalCompositeOperation = 'source-in';
        g.fillStyle = color;
        g.fillRect(0, 0, c.width, c.height);
        var out = c.toDataURL('image/png');
        if (out && out.length > 100) {
          if (!localStorage.getItem(ORIG)) localStorage.setItem(ORIG, src);   // stash pristine once
          localStorage.setItem(KEY, out);
          localStorage.setItem(MARK, color);
          try { console.debug('[sig-brand-tint] signature tinted to brand ' + color); } catch (_) {}
          notify();
        }
      } catch (_) {}
      busy = false;
    };
    img.onerror = function () { busy = false; };
    img.src = src;
  }
  function restoreOriginal() {
    var orig = localStorage.getItem(ORIG);
    if (!orig || !localStorage.getItem(MARK)) return;
    localStorage.setItem(KEY, orig);
    localStorage.removeItem(MARK);
    try { console.debug('[sig-brand-tint] signature restored to original ink'); } catch (_) {}
    notify();
  }

  function run() {
    try {
      if (!editorActive()) return;
      if (killed()) { restoreOriginal(); return; }
      var color = brandSigColor();
      if (color) tintTo(color); else restoreOriginal();
    } catch (_) {}
  }

  window.addEventListener('antcv:sections-updated', function (e) {
    var r = e && e.detail && e.detail.reason;
    if (r === 'sig-brand-tint') return;        // never react to our own event
    clearTimeout(run.__t); run.__t = setTimeout(run, 400);
  });
  try { setInterval(run, 2500); } catch (_) {}
  run();

  window.AntcvSigBrandTint = { version: '1.0', run: run, restore: restoreOriginal };
  try { console.debug('[sig-brand-tint] installed'); } catch (_) {}
})();
