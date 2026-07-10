/* antcv-tab-doc-isolation.js — TAB-DOC-ISOLATION-001 (owner 2026-07-10)
 * ============================================================================
 * Per-TAB isolation of the generated document against a PARALLEL-TAB clobber.
 *
 * Same-device tabs share localStorage. When a second tab (a parallel Claude
 * session, the nightly, a demo tab) generates a CV, it overwrites the shared
 * localStorage `sections` / `meta`. The tab the owner was working in then shows
 * the OTHER tab's content on its next read (refresh / cold-restore) — e.g. an
 * English generation clobbering a Chinese one (owner 2026-07-10: "a parallel-tab
 * session contaminating the tab I was working on").
 *
 * This sidecar gives each tab an identity and keeps a private snapshot of its OWN
 * document in sessionStorage (per-tab, survives a refresh, invisible to other
 * tabs). It runs BEFORE app.js: on boot, if the shared `sections` were last
 * written by a DIFFERENT tab than this one, it restores THIS tab's snapshot so
 * app.js reads the tab's own document — never the parallel tab's.
 *
 * SAFE / additive: it only ever RESTORES this tab's own prior snapshot; it never
 * deletes data and never touches the cloud. sessionStorage.getItem('antcv:tabId')
 * gives the per-tab id; kill via localStorage['antcv:disable-tab-doc-iso']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.0.0-tab-doc-isolation';
  if (window.__antcvTabDocIso === VERSION) return;
  window.__antcvTabDocIso = VERSION;

  function disabled() { try { return localStorage.getItem('antcv:disable-tab-doc-iso') === '1'; } catch (_) { return false; } }

  function tabId() {
    var t = null;
    try { t = sessionStorage.getItem('antcv:tabId'); } catch (_) {}
    if (!t) {
      t = 't_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e9).toString(36);
      try { sessionStorage.setItem('antcv:tabId', t); } catch (_) {}
    }
    return t;
  }
  var MY = tabId();

  function ls(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function setLs(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

  // Stamp who owns the shared document right now (this tab, when it writes).
  function stampOwner() { setLs('antcv:docWriterTab', JSON.stringify({ tab: MY, ts: Date.now() })); }

  // Snapshot this tab's CURRENT document into per-tab sessionStorage + claim ownership.
  function snapshot() {
    try {
      if (disabled()) return;
      var s = ls('sections');
      if (!s || s.length < 8) return;                 // nothing meaningful to snapshot
      var snap = { sections: s, meta: ls('meta'), slogan: ls('antcv:clSlogan'), ts: Date.now(), tab: MY };
      try { sessionStorage.setItem('antcv:tabDocSnap', JSON.stringify(snap)); } catch (_) {}
      stampOwner();
    } catch (_) {}
  }

  // ─── BOOT GUARD (runs synchronously, before app.js reads sections) ──────────
  // If this tab-session already has its own snapshot AND the shared `sections`
  // were last written by a DIFFERENT tab, a parallel tab clobbered us — restore
  // this tab's document so app.js reads the right one.
  (function bootGuard() {
    try {
      if (disabled()) return;
      var snapRaw = null;
      try { snapRaw = sessionStorage.getItem('antcv:tabDocSnap'); } catch (_) {}
      if (!snapRaw) return;                            // fresh tab — nothing to protect
      var snap = JSON.parse(snapRaw);
      if (!snap || !snap.sections) return;
      var owner = null;
      try { owner = JSON.parse(ls('antcv:docWriterTab') || 'null'); } catch (_) {}
      // Restore only when a DIFFERENT tab currently owns the shared doc.
      if (owner && owner.tab && owner.tab !== MY) {
        setLs('sections', snap.sections);
        if (snap.meta) setLs('meta', snap.meta);
        if (snap.slogan != null) setLs('antcv:clSlogan', snap.slogan);
        stampOwner();                                  // reclaim ownership for this tab
        try {
          console.info('[tab-doc-iso] restored this tab\'s document — a parallel tab (' + owner.tab + ') had overwritten the shared sections');
        } catch (_) {}
      }
    } catch (_) {}
  })();

  // ─── Track this tab's document going forward ────────────────────────────────
  var pending = false;
  function schedule() { if (pending) return; pending = true; setTimeout(function () { pending = false; snapshot(); }, 120); }
  try { window.addEventListener('antcv:sections-updated', schedule); } catch (_) {}
  // capture the current/restored document a few times after load
  [700, 2000, 5000].forEach(function (d) { setTimeout(snapshot, d); });

  window.AntcvTabDocIso = { version: VERSION, tabId: MY, _snapshot: snapshot };
})();
