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

  var VERSION = '1.50.861-collapse';
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

  // DEMO-TOGGLE-ADMIN-001 (owner 2026-06-11): the toggle is ADMIN-ONLY. The
  // app persists the server /config (incl. auth.user.is_admin) under
  // 'serverConfig:v1'; non-admin accounts never see the ACCOUNT MODE row.
  function isAdmin() {
    try {
      var raw = localStorage.getItem('serverConfig:v1');
      if (!raw) return false;
      var v = JSON.parse(raw);
      // the app's store may wrap values once more in JSON
      if (typeof v === 'string') v = JSON.parse(v);
      return !!(v && v.is_admin);
    } catch (_) { return false; }
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

    // ACCOUNT MODE is a disclosure, COLLAPSED by default (owner 2026-06-24).
    var label = document.createElement('button');
    label.type = 'button';
    label.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;padding:0;margin:0 0 8px;background:transparent;border:none;cursor:pointer;text-align:left;color:rgba(255,255,255,0.5);font-size:10px;letter-spacing:1px;';
    var caret = document.createElement('span');
    caret.style.cssText = 'font-size:9px;opacity:.7;';
    var labelTxt = document.createElement('span');
    labelTxt.textContent = 'ACCOUNT MODE';
    label.appendChild(caret); label.appendChild(labelTxt);
    wrap.appendChild(label);

    var content = document.createElement('div');

    var hintText = document.createElement('div');
    hintText.style.cssText = 'color:rgba(255,255,255,0.6);font-size:11px;line-height:1.55;margin-bottom:10px;';
    hintText.textContent = 'Demo uses the shared provider with a spending cap and a DEMO watermark. Paid routes through your own keys / paid relay.';
    content.appendChild(hintText);

    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;';
    var cur = currentMode();
    var demoBtn = mkBtn('🟡 Demo', 'demo', cur === 'demo');
    var paidBtn = mkBtn('💳 Paid', 'paid', cur === 'paid');
    row.appendChild(demoBtn);
    row.appendChild(paidBtn);
    content.appendChild(row);

    var applied = document.createElement('div');
    applied.setAttribute('data-antcv-demo-toggle-hint', '1');
    applied.style.cssText = 'display:none;color:#ffe080;font-size:11px;margin-top:8px;';
    applied.textContent = 'Mode saved. Reload the app to apply it everywhere (watermark, routing, badges).';
    content.appendChild(applied);

    wrap.appendChild(content);
    var COLLAPSE_KEY = 'antcv:demoToggleCollapsed';
    var collapsed = true;
    try { if (localStorage.getItem(COLLAPSE_KEY) === '0') collapsed = false; } catch (_) {}
    function applyCollapse() { content.style.display = collapsed ? 'none' : ''; caret.textContent = collapsed ? '▸' : '▾'; }
    applyCollapse();
    label.addEventListener('click', function () { collapsed = !collapsed; try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch (_) {} applyCollapse(); });

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
      if (!n.parentElement) continue;
      // LOGIN-MODE-SCOPE-001 (owner 2026-06-18): there are MULTIPLE "SIGN IN" labels
      // — the full-screen LOGIN GATE, the login LOADING-overlay, and the Settings →
      // Account subtab. The ACCOUNT MODE card belongs ONLY in Settings; anchoring it
      // to the login surfaces made it "sticky" during sign-in/loading. Only accept a
      // "SIGN IN" whose ancestor ALSO carries the Settings tier strip (Standard +
      // Advanced), which the login gate and loading overlay never have.
      var anc = n, hops = 0, inSettings = false;
      while (anc && hops < 12) {
        var tc = (anc.textContent || '').toLowerCase();
        if (tc.indexOf('standard') >= 0 && tc.indexOf('advanced') >= 0) { inSettings = true; break; }
        anc = anc.parentElement; hops++;
      }
      if (!inSettings) continue;
      return n;
    }
    return null;
  }

  function sweep() {
    if (disabled()) return;
    if (!isAdmin()) {
      // Defensive: tear down a block injected before the admin signal
      // resolved (or after an admin sign-out).
      try {
        var stale = document.querySelector('[' + BLOCK_ATTR + '="1"]');
        if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
      } catch (_) {}
      return;
    }
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
