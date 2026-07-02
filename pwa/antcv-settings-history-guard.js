/* AntCV settings history guard — SETTINGS-ROLLER-RESET-001 (owner 2026-07-03)
 * ============================================================
 *
 * Symptom: inside Settings, pressing the mouse ROLLER or the buttons beside
 * it (tilt/side buttons) to scroll caused a MINI-RESET — the "Loading……"
 * gate, a full app re-boot, landing back on the restored Settings panel.
 *
 * Mechanism (confirmed live 2026-07-03 by calling history.back() with the
 * panel open — the page NAVIGATED and the runtime restarted): those buttons
 * map to browser Back/Forward. The SPA had no history guard, so a Back was a
 * REAL navigation away; returning re-boots the app (the Loading gate), and
 * the persisted settingsTab/settingsSubTab restore the panel — the "mini
 * reset". Likely the same mechanism behind ACCOUNT-SCROLL-RESET-001
 * (2026-06-13), which also never reproduced synthetically.
 *
 * Fix — the standard modal history pattern: while the Settings panel is open
 * a SENTINEL history state sits on top. A Back consumes the sentinel instead
 * of leaving the page; the popstate handler re-pushes it and closes the
 * panel like a normal ✕. Outside Settings, history behaves as before (one
 * absorbed Back right after a normal panel close is the accepted cost).
 *
 * Kill-switch: localStorage antcv:no-settings-history-guard = '1'.
 * Debounce is setTimeout, never rAF (STICKY-LEAK-005: rAF freezes in
 * background tabs).
 */
(function () {
  'use strict';
  if (window.__antcvSettingsHistoryGuard) return;
  window.__antcvSettingsHistoryGuard = '1.51.90';
  try { if (localStorage.getItem('antcv:no-settings-history-guard') === '1') return; } catch (_) {}

  function norm(s) { return String(s || '').replace(/[ \t\n\r]+/g, ' ').trim(); }

  // The settings panel = a visible position:fixed div carrying the header
  // signature (⚙ Settings + the Standard/Advanced top tabs). Cheap scan,
  // capped text read; memoised for 400ms.
  var memo = { t: -1e9, el: null };
  function findPanel() {
    var now = Date.now();
    if (now - memo.t < 400 && (memo.el === null || memo.el.isConnected)) return memo.el;
    var el = null;
    var cands = document.querySelectorAll('div');
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i], cs;
      try { cs = getComputedStyle(c); } catch (_) { continue; }
      if (cs.position !== 'fixed' || cs.display === 'none') continue;
      var t = norm(c.textContent).slice(0, 400);
      if (t.indexOf('Settings') >= 0 && /Standard/i.test(t) && /Advanced/i.test(t)) { el = c; break; }
    }
    memo = { t: now, el: el };
    return el;
  }
  function panelOpen() { return !!findPanel(); }
  function hasSentinel() { try { return !!(history.state && history.state.antcvSettingsGuard === 1); } catch (_) { return false; } }
  function pushSentinel() { try { history.pushState({ antcvSettingsGuard: 1 }, ''); } catch (_) {} }

  var wasOpen = false;
  function tick() {
    var open = panelOpen();
    if (open && !wasOpen && !hasSentinel()) pushSentinel();
    wasOpen = open;
  }
  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; try { tick(); } catch (_) {} }, 120);
  }
  function boot() {
    try { new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    setInterval(function () { try { tick(); } catch (_) {} }, 1200);
    try { tick(); } catch (_) {}
  }

  window.addEventListener('popstate', function () {
    try {
      if (hasSentinel()) return;              // arrived AT the sentinel (forward) — nothing to fix
      memo.t = -1e9;                          // fresh read at decision time
      if (!panelOpen()) return;               // normal history use outside settings
      // Back landed while Settings is open — the roller-side button. Restore
      // the sentinel so the page does NOT leave, and close like a normal ✕.
      pushSentinel();
      var panel = findPanel();
      if (!panel) return;
      var btns = panel.querySelectorAll('button,[role="button"]');
      var close = null, done = null;
      for (var i = 0; i < btns.length; i++) {
        var t = norm(btns[i].textContent);
        if (/^✕( Close)?$|^Close$/i.test(t)) { close = btns[i]; break; }
        if (!done && /^Done$/i.test(t)) done = btns[i];
      }
      var target = close || done;
      if (target) { try { target.click(); } catch (_) {} }
      wasOpen = false;
    } catch (_) {}
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
