/* antcv-export-settled-gate.js — EXPORT-SETTLED-001 (owner 2026-06-22)
 * ============================================================================
 * Best-ROI fix for "the gate hangs / I have to refresh twice to get a good PDF":
 * the FIRST export after a hard refresh runs against a HALF-SETTLED document.
 * Export reads localStorage `sections` (buildDocxPayloadFromStorage) + the live
 * preview DOM, but on boot those are still being rewritten by cloud-restore +
 * the migration/normalizer sidecars (measured ~15s of churn on a big doc). Export
 * mid-churn → stale/wrong output → the user refreshes again.
 *
 * This gate makes the export WAIT for "settled" instead of producing stale output:
 *   settled = cover lifted  AND  >=MIN_FLOOR since load (cloud-restore has started)
 *             AND  antcv:sections-updated quiet for >=QUIET  (migrations converged)
 *             — with a HARD_CAP backstop so it can never block forever.
 * If an export is triggered before settled, we swallow that click, show a small
 * "finishing — your export will start in a moment" toast, and AUTO-FIRE the same
 * export the instant it settles. After settled, every export passes straight
 * through (the gate is effectively only live for the first few seconds of boot).
 *
 * Covers all export entry points: the app's hidden "Export as PDF"/"Export as
 * .docx" buttons, the export-preview modal's Save-as-PDF / Save-as-DOCX, and a
 * direct window.exportDocxViaWorker() call (the modal's fallback path).
 * Kill switch: antcv:disable-export-gate. Self-disabling on error.
 */
(function () {
  'use strict';
  var VERSION = '1.50.774';
  if (window.__antcvExportSettledGate) return;
  window.__antcvExportSettledGate = VERSION;
  try { var off = localStorage.getItem('antcv:disable-export-gate'); if (off === '1' || off === 'true') return; } catch (_) {}

  var MIN_FLOOR = 2500;    // ms since load before we consider settling (cloud-restore needs to START)
  var QUIET = 1500;        // sections-updated must be quiet this long (migrations converged)
  var HARD_CAP = 14000;    // ms — never gate an export longer than this

  var loadAt = Date.now();
  var lastSU = Date.now();
  window.addEventListener('antcv:sections-updated', function () { lastSU = Date.now(); });

  function coverGone() {
    try { return !document.getElementById('antcv-login-loading-overlay'); } catch (_) { return true; }
  }
  function settled() {
    var now = Date.now();
    if (now - loadAt >= HARD_CAP) return true;            // backstop — never block forever
    if (now - loadAt < MIN_FLOOR) return false;
    if (now - lastSU < QUIET) return false;
    return coverGone();
  }
  function whenSettled(cb) {
    if (settled()) { cb(); return; }
    var iv = setInterval(function () { if (settled()) { clearInterval(iv); cb(); } }, 200);
  }

  // ── tiny non-blocking toast ──
  var TID = 'antcv-export-settling-toast';
  function toast(show) {
    var el = document.getElementById(TID);
    if (!show) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div');
    el.id = TID;
    el.textContent = 'Finishing loading your document — your export will start in a moment…';
    el.setAttribute('role', 'status');
    el.style.cssText = [
      'position:fixed', 'left:50%', 'bottom:26px', 'transform:translateX(-50%)',
      'z-index:2147483600', 'background:#283556', 'color:#fff', 'padding:11px 18px',
      'border-radius:10px', 'font:600 13px/1.4 system-ui,-apple-system,Segoe UI,sans-serif',
      'box-shadow:0 6px 22px rgba(0,0,0,.38)', 'max-width:90vw', 'text-align:center',
      'display:flex', 'align-items:center', 'gap:9px',
    ].join(';');
    var dot = document.createElement('span');
    dot.style.cssText = 'width:10px;height:10px;border-radius:50%;border:2px solid #01B7BB;border-top-color:transparent;display:inline-block;animation:antcv-egspin .7s linear infinite;flex:0 0 auto';
    if (!document.getElementById('antcv-eg-style')) {
      var st = document.createElement('style'); st.id = 'antcv-eg-style';
      st.textContent = '@keyframes antcv-egspin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    el.insertBefore(dot, el.firstChild);
    document.body.appendChild(el);
  }

  // ── identify an export trigger button ──
  function isExportTrigger(btn) {
    if (!btn || btn.getAttribute('data-antcv-settled-go') === '1') return false;
    var t = btn.getAttribute('title') || '';
    if (/^\s*Export as PDF|^\s*Export as \.docx/i.test(t)) return true;
    var id = btn.id || '';
    if (id === 'antcv-pdf-preview-modal-print' || id === 'antcv-pdf-preview-modal-docx') return true;
    return false;
  }

  // ── click-level gate (capture, so it pre-empts the app/modal handlers) ──
  document.addEventListener('click', function (e) {
    try {
      var btn = e.target && e.target.closest ? e.target.closest('button') : null;
      if (!isExportTrigger(btn)) return;
      if (settled()) return;                  // let it through
      e.preventDefault();
      e.stopImmediatePropagation();
      toast(true);
      whenSettled(function () {
        toast(false);
        try {
          btn.setAttribute('data-antcv-settled-go', '1');   // bypass the gate on the re-fire
          btn.click();
        } catch (_) {}
        setTimeout(function () { try { btn.removeAttribute('data-antcv-settled-go'); } catch (_) {} }, 3000);
      });
    } catch (_) {}
  }, true);

  // ── wrap the direct worker call (modal fallback path that isn't a button click) ──
  function wrapDocx() {
    try {
      var fn = window.exportDocxViaWorker;
      if (typeof fn === 'function' && !fn.__antcvSettledWrapped) {
        var wrapped = function () {
          var args = arguments, self = this;
          if (settled()) return fn.apply(self, args);
          toast(true);
          return new Promise(function (resolve, reject) {
            whenSettled(function () { toast(false); try { resolve(fn.apply(self, args)); } catch (e) { reject(e); } });
          });
        };
        wrapped.__antcvSettledWrapped = true;
        wrapped.__orig = fn;
        window.exportDocxViaWorker = wrapped;
      }
    } catch (_) {}
  }
  wrapDocx();
  var wt = setInterval(wrapDocx, 1000);
  setTimeout(function () { clearInterval(wt); }, HARD_CAP + 2000);

  window.AntcvExportSettledGate = { version: VERSION, settled: settled };
})();
