/* AntCV live setup-state chips (v1.50.340)
 * ============================================================================
 * REGULAR-MODE-STALE-SETUP-001 (owner 2026-06-09): in regular (BYOK) mode the
 * landing header keeps showing the "⚠ Setup needed" warning and the "🟡 Use
 * demo" coin until a manual refresh.
 *
 * Why
 * ---
 * Both chips are rendered by app.js gated on M() (needs-setup) and
 * __antcvHasOwnKey() — plain localStorage reads evaluated AT RENDER TIME.
 * When the keys arrive AFTER the header mounted (cloud restore on sign-in,
 * pasting a key in Settings, another tab), nothing re-renders the header, so
 * the stale chips sit there until a refresh. Same-tab localStorage writes
 * fire NO 'storage' event, so the app can't even listen its way out.
 *
 * Fix (sidecar — app.js untouched)
 * --------------------------------
 * Poll the key fields cheaply (4 localStorage reads / 1.5s) + listen to
 * cross-tab 'storage' + focus/pageshow. When the user HAS a key, hide both
 * chips by exact leaf text ("⚠ Setup needed", "🟡 Use demo"); when keys
 * disappear, restore them (remove our inline override — if React chose not
 * to render them they're simply absent). A MutationObserver re-applies after
 * React re-renders recreate the nodes. Additive, idempotent, removable in
 * one <script> line.
 */
(function () {
  'use strict';
  var VERSION = '1.50.340-setup-chips-live';
  if (window.__antcvSetupChipsLive === VERSION) return;
  window.__antcvSetupChipsLive = VERSION;

  var TAG = '[setup-chips-live-372]';
  var ATTR = 'data-antcv-chip-hidden';
  var CHIP_TEXTS = ['⚠ Setup needed', '🟡 Use demo'];

  function unwrap(raw) {
    if (!raw) return '';
    try {
      var u = raw;
      try { var p = JSON.parse(raw); if (typeof p === 'string') u = p; } catch (_) {}
      return String(u).trim();
    } catch (_) { return ''; }
  }

  function hasOwnKey() {
    try {
      return !!(
        unwrap(localStorage.getItem('apiKey')) ||
        unwrap(localStorage.getItem('openaiKey')) ||
        unwrap(localStorage.getItem('mistralKey')) ||
        unwrap(localStorage.getItem('geminiKey'))
      );
    } catch (_) { return false; }
  }

  function findChips() {
    var found = [];
    // The chips are leaf div/button elements whose entire text is the label.
    var nodes = document.querySelectorAll('div, button');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.children && n.children.length) continue;
      var t = (n.textContent || '').trim();
      for (var c = 0; c < CHIP_TEXTS.length; c++) {
        if (t === CHIP_TEXTS[c]) { found.push(n); break; }
      }
    }
    return found;
  }

  function applyState() {
    var keyed = hasOwnKey();
    var chips = findChips();
    for (var i = 0; i < chips.length; i++) {
      var el = chips[i];
      if (keyed) {
        if (el.getAttribute(ATTR) !== '1') {
          el.setAttribute(ATTR, '1');
          el.style.display = 'none';
        }
      } else if (el.getAttribute(ATTR) === '1') {
        el.removeAttribute(ATTR);
        el.style.display = '';
      }
    }
    return keyed;
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(function () { pending = false; try { applyState(); } catch (_) {} }, 60);
  }

  // Boot + cheap poll (same-tab key writes fire no event) + cross-tab +
  // tab-return. The poll is 4 localStorage reads and a few DOM queries only
  // when key-presence CHANGED since last pass — track it to keep idle cost ~0.
  var lastKeyed = null;
  function tick() {
    var keyed = hasOwnKey();
    if (keyed !== lastKeyed) {
      lastKeyed = keyed;
      try { applyState(); } catch (_) {}
      try { console.debug(TAG, 'key-presence changed →', keyed ? 'BYOK (chips hidden)' : 'no keys (chips restored)'); } catch (_) {}
    }
  }
  tick();
  schedule();
  [300, 900, 2000, 4000].forEach(function (d) { setTimeout(schedule, d); });
  setInterval(tick, 1500);
  window.addEventListener('storage', function (ev) {
    if (!ev || ['apiKey', 'openaiKey', 'mistralKey', 'geminiKey', 'proxyUrl'].indexOf(ev.key) >= 0) { lastKeyed = null; tick(); }
  });
  ['focus', 'pageshow'].forEach(function (e) { window.addEventListener(e, function () { lastKeyed = null; tick(); }); });
  // Re-apply after React re-renders recreate the chips.
  try {
    new MutationObserver(function (recs) {
      for (var i = 0; i < recs.length; i++) {
        var t = recs[i].target;
        if (t && t.nodeType === 1 && t.hasAttribute && t.hasAttribute(ATTR)) continue;
        schedule(); return;
      }
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}

  window.AntcvSetupChipsLive = { version: VERSION, _apply: applyState, _hasOwnKey: hasOwnKey };
  try { console.debug(TAG, 'installed v' + VERSION); } catch (_) {}
})();
