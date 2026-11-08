/* antcv-doc-stale-notice.js — OPEN-STALE-NOTICE-001 (owner 2026-11-09).
 *
 * Since 1.51.6445 (OPEN-STALE-TAB-001) a tab whose copy of an application is older than the
 * saved row stops saving it, so it can never overwrite the newer row. The only trace was a
 * console line: the owner could keep editing in that tab and nothing reached the cloud.
 *
 * antcv-app-rev-guard.js fires `antcv:doc-stale` when it skips a save for that reason (or the
 * boot load of the newer row did not happen) and `antcv:doc-fresh` once the tab saves again.
 * This sidecar shows a chip at the bottom of the screen while the tab is stale:
 *   - what happened, in the UI language (en/da, English otherwise), naming the application;
 *   - Reload: a cold boot loads the newer row (BOOT-STALE-LOCAL-001) and keeps this tab's
 *     copy in localStorage `antcv:bootStaleLocal`;
 *   - × hides it until the tab is fresh again (the skips repeat every few seconds).
 * Pure DOM, no fetch wrapping. Kill switch: localStorage antcv:disable-doc-stale-notice = '1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.6465-stale-notice';
  if (window.__antcvDocStaleNotice) return;
  window.__antcvDocStaleNotice = VERSION;

  var ID = 'antcv-doc-stale-notice';
  var TEXT = {
    en: {
      head: 'This tab is not saving',
      changed: '{co} was saved from another tab, device or session. Reload to load that version. Your edits in this tab go to a local backup.',
      notLoaded: '{co}: the saved version did not load. Reload to load it. Your edits in this tab go to a local backup.',
      app: 'This application', reload: 'Reload', close: 'Dismiss',
    },
    da: {
      head: 'Denne fane gemmer ikke',
      changed: '{co} er gemt fra en anden fane, enhed eller session. Genindlæs for at hente den version. Dine ændringer i denne fane gemmes i en lokal sikkerhedskopi.',
      notLoaded: '{co}: den gemte version blev ikke hentet. Genindlæs for at hente den. Dine ændringer i denne fane gemmes i en lokal sikkerhedskopi.',
      app: 'Denne ansøgning', reload: 'Genindlæs', close: 'Luk',
    },
  };
  var dismissed = false;

  function str(k) {
    try { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (typeof v === 'string') return v; } catch (_) {}
    try { return String(localStorage.getItem(k) || ''); } catch (_) { return ''; }
  }
  function lang() { var l = (str('uiLang') || str('language') || 'en').slice(0, 2).toLowerCase(); return TEXT[l] ? l : 'en'; }
  function company(detail) {
    var c = String((detail && detail.company) || '').trim();
    if (!c) { try { var m = JSON.parse(localStorage.getItem('meta') || 'null'); c = String((m && m.company) || '').trim(); } catch (_) {} }
    return c;
  }
  // The words for a stale event, in the UI language. Pure, for tests.
  function text(detail, l) {
    var T = TEXT[l] || TEXT.en;
    var co = company(detail) || T.app;
    var body = (detail && detail.reason === 'boot-not-loaded' ? T.notLoaded : T.changed).replace('{co}', co);
    return { head: T.head, body: body, reload: T.reload, close: T.close };
  }

  function button(label, primary) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    Object.assign(b.style, primary ? {
      background: '#b45309', color: '#fff', border: '1px solid #b45309', borderRadius: '6px',
      padding: '5px 14px', fontSize: '13px', fontWeight: '600', cursor: 'pointer',
    } : {
      background: 'transparent', border: 'none', color: '#92400e', fontSize: '20px', fontWeight: '600',
      lineHeight: '1', cursor: 'pointer', padding: '0 0 0 6px', marginTop: '-2px',
    });
    return b;
  }

  function show(detail) {
    try { if (localStorage.getItem('antcv:disable-doc-stale-notice') === '1') return; } catch (_) {}
    if (dismissed || !document.body) return;
    var t = text(detail, lang());
    var el = document.getElementById(ID);
    if (!el) {
      el = document.createElement('div');
      el.id = ID;
      el.setAttribute('role', 'alert');
      Object.assign(el.style, {
        position: 'fixed', left: '50%', bottom: '24px', transform: 'translateX(-50%)', zIndex: '9991',
        width: 'max-content', maxWidth: 'min(460px, calc(100vw - 32px))', boxSizing: 'border-box',
        padding: '10px 12px 10px 14px', borderRadius: '8px', border: '1px solid #d97706',
        background: '#fef3c7', color: '#92400e', boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
        fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        fontSize: '13px', lineHeight: '1.4', display: 'flex', flexDirection: 'column', gap: '6px',
      });
      document.body.appendChild(el);
    }
    el.innerHTML = '';
    var head = document.createElement('div');
    Object.assign(head.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' });
    var h = document.createElement('div');
    h.style.fontWeight = '700';
    h.textContent = '⚠️ ' + t.head;
    var x = button('×', false);
    x.setAttribute('aria-label', t.close);
    x.addEventListener('click', function () { dismissed = true; hide(); });
    head.appendChild(h); head.appendChild(x);
    var body = document.createElement('div');
    body.style.color = '#7c2d12';
    body.textContent = t.body;
    var row = document.createElement('div');
    var r = button(t.reload, true);
    r.addEventListener('click', function () { try { location.reload(); } catch (_) {} });
    row.appendChild(r);
    el.appendChild(head); el.appendChild(body); el.appendChild(row);
    el.style.display = 'flex';
  }
  function hide() { var el = document.getElementById(ID); if (el) el.style.display = 'none'; }

  window.addEventListener('antcv:doc-stale', function (e) { try { show(e && e.detail); } catch (_) {} });
  window.addEventListener('antcv:doc-fresh', function () { dismissed = false; hide(); });
  // The guard may have gone stale before this script ran.
  try { var g = window.AntcvAppRevGuard, s = g && g.docStale && g.docStale(); if (s) show(s); } catch (_) {}

  window.AntcvDocStaleNotice = { version: VERSION, text: text, show: show, hide: hide };
})();
