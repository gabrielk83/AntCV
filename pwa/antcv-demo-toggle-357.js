/* AntCV in-app Demo⇄Paid toggle (DEMO-TOGGLE-001, v1.50.357)
 * ============================================================================
 *
 * Until now the ONLY place to pick demo vs paid was the setup wizard — there
 * was no way to flip an existing account. This sidecar injects an "ACCOUNT
 * MODE" row at the top of Settings → Standard → Account with two buttons:
 *
 *   🟡 Demo   — shared demo provider, capped spend, DEMO watermark
 *   💳 Paid   — own keys / paid relay routing
 *
 * Clicking a mode:
 *   1. Calls window.AntcvSetUserMode(mode) (wizard-mode-bridge-337's write
 *      path — POSTs /api/user/mode to the relay; dedupes; skips when signed
 *      out).
 *   2. Mirrors the choice into localStorage 'antcv:user-mode-cloud' (+ meta),
 *      the canonical local key user-mode-restore-340 maintains, so the UI
 *      hint is immediate and survives reload even before the next cloud
 *      reconcile.
 *   3. Dispatches 'antcv:user-mode-reconciled' so live listeners update.
 *   4. Shows a "reload to apply everywhere" hint.
 *
 * Injection: observer-driven, anchored on the Account subtab's "SIGN IN"
 * label inside the settings modal. React re-renders wipe the foreign block;
 * the next sweep re-injects it. Idempotent per mount.
 *
 * Escape hatch: localStorage['antcv:disable-demo-toggle'] = '1'.
 */
(function () {
  'use strict';

  var VERSION = '1.50.357';
  if (window.__antcvDemoToggle357 === VERSION) return;
  window.__antcvDemoToggle357 = VERSION;

  var TAG = '[demo-toggle-357]';
  var BLOCK_ATTR = 'data-antcv-demo-toggle';
  var LS_KEY = 'antcv:user-mode-cloud';
  var LS_META_KEY = 'antcv:user-mode-cloud-meta';

  function disabled() {
    try { return localStorage.getItem('antcv:disable-demo-toggle') === '1'; }
    catch (_) { return false; }
  }

  function currentMode() {
    try {
      var v = localStorage.getItem(LS_KEY);
      if (v === 'demo') return 'demo';
      if (v === 'paid' || v === 'byok') return 'paid';
    } catch (_) {}
    return null; // unknown — no highlight
  }

  function setMode(mode) {
    var prev = currentMode();
    try {
      if (typeof window.AntcvSetUserMode === 'function') window.AntcvSetUserMode(mode);
    } catch (e) { try { console.warn(TAG, 'AntcvSetUserMode threw:', e && e.message); } catch (_) {} }
    try {
      localStorage.setItem(LS_KEY, mode);
      localStorage.setItem(LS_META_KEY, JSON.stringify({
        mode: mode, at: new Date().toISOString(), source: 'settings-toggle',
      }));
    } catch (_) {}
    try {
      window.dispatchEvent(new CustomEvent('antcv:user-mode-reconciled', {
        detail: { mode: mode, previousMode: prev, source: 'settings-toggle', at: new Date().toISOString() },
      }));
    } catch (_) {}
  }

  function mkBtn(label, mode, active) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.setAttribute('data-antcv-demo-toggle-btn', mode);
    b.style.cssText = 'flex:1;padding:8px 12px;border-radius:8px;font-size:12px;font-weight:700;'
      + 'letter-spacing:0.4px;cursor:pointer;transition:all .15s;'
      + (active
        ? 'background:rgba(1,183,187,0.18);border:1px solid #01B7BB;color:#01B7BB;'
        : 'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.7);');
    return b;
  }

  function buildBlock() {
    var wrap = document.createElement('div');
    wrap.setAttribute(BLOCK_ATTR, '1');
    wrap.style.cssText = 'margin-bottom:18px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,0.08);';

    var label = document.createElement('div');
    label.textContent = 'ACCOUNT MODE';
    label.style.cssText = 'color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px;margin-bottom:8px;';
    wrap.appendChild(label);

    var hintText = document.createElement('div');
    hintText.style.cssText = 'color:rgba(255,255,255,0.6);font-size:11px;line-height:1.55;margin-bottom:10px;';
    hintText.textContent = 'Demo uses the shared provider with a spending cap and a DEMO watermark. Paid routes through your own keys / paid relay.';
    wrap.appendChild(hintText);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;';
    var cur = currentMode();
    var demoBtn = mkBtn('🟡 Demo', 'demo', cur === 'demo');
    var paidBtn = mkBtn('💳 Paid', 'paid', cur === 'paid');
    row.appendChild(demoBtn);
    row.appendChild(paidBtn);
    wrap.appendChild(row);

    var applied = document.createElement('div');
    applied.setAttribute('data-antcv-demo-toggle-hint', '1');
    applied.style.cssText = 'display:none;color:#ffe080;font-size:11px;margin-top:8px;';
    applied.textContent = 'Mode saved. Reload the app to apply it everywhere (watermark, routing, badges).';
    wrap.appendChild(applied);

    function onPick(mode) {
      setMode(mode);
      // repaint both buttons from the new state
      var cur2 = currentMode();
      demoBtn.style.cssText = mkBtn('', 'demo', cur2 === 'demo').style.cssText + 'flex:1;';
      paidBtn.style.cssText = mkBtn('', 'paid', cur2 === 'paid').style.cssText + 'flex:1;';
      applied.style.display = 'block';
      try { console.log(TAG, 'mode set to', mode); } catch (_) {}
    }
    demoBtn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); onPick('demo'); });
    paidBtn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); onPick('paid'); });
    return wrap;
  }

  // Find the Account subtab's "SIGN IN" label inside the settings modal.
  function findAnchor() {
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.childElementCount !== 0) continue;
      if ((n.textContent || '').trim() !== 'SIGN IN') continue;
      // sanity: inside something that also mentions the settings tier strip
      var p = n.parentElement;
      if (!p) continue;
      return n;
    }
    return null;
  }

  function sweep() {
    if (disabled()) return;
    var anchor = findAnchor();
    if (!anchor || !anchor.parentElement) return;
    if (anchor.parentElement.querySelector('[' + BLOCK_ATTR + '="1"]')) return;
    try {
      anchor.parentElement.insertBefore(buildBlock(), anchor);
    } catch (_) {}
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; try { sweep(); } catch (_) {} });
  }

  function start() {
    schedule();
    [300, 1000, 2500].forEach(function (ms) { setTimeout(schedule, ms); });
    try {
      new MutationObserver(schedule).observe(document.body || document.documentElement, {
        childList: true, subtree: true,
      });
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.AntcvDemoToggle357 = { version: VERSION, sweep: sweep, setMode: setMode };
  try { console.debug(TAG, 'installed v' + VERSION); } catch (_) {}
})();
