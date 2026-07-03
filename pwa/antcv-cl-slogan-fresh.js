/* antcv-cl-slogan-fresh.js — SLOGAN-FRESH-GEN-001 (owner 2026-07-03, Trackman review)
 * ============================================================================
 * Owner: "why did the Trackman slogan not regenerate to a new more fit one?"
 * Evidence: the exported Trackman CL still carried the NIL slogan "MAKING THE
 * INVISIBLE MANUFACTURABLE". Root cause: `antcv:clSlogan` is an OVERRIDE key
 * (empty -> render sites fall back to meta.subtitle, the freshly generated
 * slogan) that is GLOBAL and sticky — once a session writes it for one
 * application, every later targeted generation is shadowed, violating spec
 * rules 23/33 ("slogan is per-application content; a standing slogan must not
 * survive a targeted gen").
 *
 * FIX (observer, zero writer patches): this sidecar watches the override key
 * and stamps OWNERSHIP (antcv:clSloganCtx = { v: <value>, app: "Company|Role" })
 * whenever the value changes — any write (panel control, inline preview edit,
 * cloud restore) is attributed to the application active at write time. When
 * the ACTIVE app is targeted (meta.company real) with a REAL fresh
 * meta.subtitle and the override belongs to a DIFFERENT app, the override is
 * DELETED so the render fallback shows the fresh generated slogan.
 *
 * Rules per tick (S = override value, M = meta, cur = company|role key):
 *  - unsolicited meta (company empty/"Unsolicited"): never touch (the standing
 *    motto is the unsolicited design).
 *  - S empty: clear ctx; nothing to own.
 *  - S changed since last stamp: stamp ctx = {v:S, app:cur} (owner-edit-wins —
 *    an edit made while THIS app is active survives its regens).
 *  - S unchanged, ctx.app !== cur, meta targeted, subtitle real and != S:
 *    DELETE override (+ctx) -> fresh slogan renders.
 *  - LEGACY (no ctx, pre-stamp): meta targeted + subtitle real + S != subtitle
 *    -> the override predates stamping and mismatches the fresh gen — stale
 *    carryover by definition (rule 23) -> delete. S == subtitle -> adopt+stamp.
 * The hidden/align keys are never touched (hiding the slogan is orthogonal).
 * Restore-safety: the standalone keys stay the durable backing
 * (sidecar-prefs-clobber-hazard) — this sidecar only ever deletes a STALE
 * override; it never writes slogan text. Ctx rides cl-cloud-sync-extra so two
 * devices agree on ownership.
 * Loop-safe: write-only-on-change; setTimeout debounce (STICKY-LEAK-005: never
 * rAF). Kill: localStorage['antcv:disable-slogan-fresh']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.120-slogan-fresh';
  if (window.__antcvClSloganFresh) return;
  window.__antcvClSloganFresh = VERSION;

  var K_TEXT = 'antcv:clSlogan';
  var K_CTX = 'antcv:clSloganCtx';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-slogan-fresh'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // The prose-loss guard stashes the standalone CL keys (antcv:clKeysGuard) and
  // RE-APPLIES any that empty — a deliberate yield must clear the stash entry
  // too, or the stale slogan resurrects on the guard's next tick.
  function dropOverride() {
    try { localStorage.removeItem(K_TEXT); } catch (_) {}
    try {
      var stash = JSON.parse(localStorage.getItem('antcv:clKeysGuard') || 'null');
      if (stash && typeof stash === 'object' && stash[K_TEXT] != null) {
        delete stash[K_TEXT];
        localStorage.setItem('antcv:clKeysGuard', JSON.stringify(stash));
      }
    } catch (_) {}
  }
  function readMeta() { try { return JSON.parse(localStorage.getItem('meta') || '{}') || {}; } catch (_) { return {}; } }
  function readCtx() { try { return JSON.parse(localStorage.getItem(K_CTX) || 'null'); } catch (_) { return null; } }
  function writeCtx(c) { try { localStorage.setItem(K_CTX, JSON.stringify(c)); } catch (_) {} }
  function dropCtx() { try { localStorage.removeItem(K_CTX); } catch (_) {} }

  function isTargeted(m) {
    var c = String(m.company || '').trim();
    return !!c && !/^unsolicited$/i.test(c) && !/^open application$/i.test(c);
  }
  function appKeyOf(m) { return String(m.company || '').trim() + '|' + String(m.role || m.position || '').trim(); }
  // A REAL fresh slogan: non-empty, not a bracketed template placeholder.
  function realSubtitle(m) {
    var s = String(m.subtitle || '').trim();
    if (!s || s.length < 3) return '';
    if (/\[[^\]]*\]/.test(s)) return '';
    return s;
  }

  function tick() {
    if (disabled()) return;
    try {
      var S = '';
      try { S = String(localStorage.getItem(K_TEXT) || '').trim(); } catch (_) {}
      var ctx = readCtx();
      if (!S) { if (ctx) dropCtx(); return; }
      var m = readMeta();
      if (!isTargeted(m)) return;                      // unsolicited: standing motto path, never touch
      var cur = appKeyOf(m);
      var sub = realSubtitle(m);
      if (ctx && typeof ctx === 'object' && typeof ctx.v === 'string') {
        if (ctx.v !== S) { writeCtx({ v: S, app: cur }); return; }   // fresh write -> current app owns it
        if (ctx.app === cur) return;                                  // owner's slogan for THIS app — keep across regens
        if (sub && sub !== S) {
          dropOverride();
          dropCtx();
          try { console.log('[slogan-fresh] stale override (owned by "' + ctx.app + '") yields to the fresh generated slogan of "' + cur + '"'); } catch (_) {}
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'slogan-fresh' } })); } catch (_) {}
        }
        return;
      }
      // LEGACY: override predates ownership stamping.
      if (sub) {
        if (S === sub) { writeCtx({ v: S, app: cur }); return; }      // agrees with the fresh gen — adopt
        dropOverride();
        dropCtx();
        try { console.log('[slogan-fresh] legacy sticky slogan dropped — the fresh generated slogan of "' + cur + '" renders (rule 23/33)'); } catch (_) {}
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'slogan-fresh' } })); } catch (_) {}
      } else {
        writeCtx({ v: S, app: cur });                                 // no fresh slogan to compare — assume current app's
      }
    } catch (_) {}
  }

  var pending = false;
  function debounced() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { tick(); } catch (_) {} }, 250); }

  [900, 2500, 5000].forEach(function (d) { setTimeout(debounced, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === 'slogan-fresh')) debounced(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'meta' || e.key === K_TEXT || e.key === null) debounced(); }); } catch (_) {}
  setInterval(debounced, 5000);

  window.AntcvClSloganFresh = { version: VERSION, _tick: tick, _isTargeted: isTargeted, _realSubtitle: realSubtitle, _appKeyOf: appKeyOf };
})();
