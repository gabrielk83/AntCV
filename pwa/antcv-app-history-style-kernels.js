/* antcv-app-history-style-kernels.js — Settings › Application History
 * =====================================================================
 * APP-HISTORY-STYLE-KERNELS-001 (owner 2026-07-10): the Settings history tab
 * shows "YOUR APPLICATIONS" (the saved-app rows). The owner also wants the
 * per-(writing-style × language) UNSOLICITED kernels — saved via
 * /api/kernel-showcase?style=… (kernel_showcase_styled table) — visible in a
 * SEPARATE table BELOW the regular one, with BOTH tables collapsible and
 * COLLAPSED BY DEFAULT. These styled kernels are the reusable base the nightly
 * top-10 generator draws on for faster generation.
 *
 * Why a sidecar (not an app.js edit): app.js is minified-sacred; this panel is
 * pure additive DOM the sidecar OWNS end-to-end (no React node is moved — React
 * would crash if we reparented its nodes), so it never fights reconciliation.
 * The collapse of the EXISTING "YOUR APPLICATIONS" section is done by toggling
 * inline display on its own children (no move), re-asserted on re-render.
 *
 * Kill switch: localStorage['antcv:disable-style-kernels-table']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.236-style-kernels-table';
  if (window.__antcvStyleKernelsTable === VERSION) return;
  window.__antcvStyleKernelsTable = VERSION;
  try { if (localStorage.getItem('antcv:disable-style-kernels-table') === '1') return; } catch (_) {}

  var PANEL_ID = 'antcv-style-kernels-panel';
  var APPS_LABEL = 'YOUR APPLICATIONS';

  // ── relay base + auth (same resolution the other sidecars use) ─────────
  function ls(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function relayBase() {
    function read(x) { var v = ls(x) || ''; try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {} return String(v || '').replace(/\/+$/, ''); }
    var b = read('proxyUrl') || read('relayUrl');
    if (!b && typeof window.ANTCV_RELAY_URL === 'string') b = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
    return b;
  }
  function token() { return String(ls('antcv:auth:token') || ''); }
  function api(path, opts) {
    var base = relayBase();
    if (!base) return Promise.reject(new Error('no relay'));
    var h = { 'Accept': 'application/json' };
    var t = token(); if (t) h.Authorization = 'Bearer ' + t;
    if (opts && opts.body) h['Content-Type'] = 'application/json';
    return fetch(base + path, {
      method: (opts && opts.method) || 'GET', credentials: 'include', headers: h,
      body: opts && opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (r) { return r.json().catch(function () { return null; }).then(function (j) { return { ok: r.ok, status: r.status, body: j }; }); });
  }

  // Human labels.
  var LANG = { en: 'English', da: 'Dansk', es: 'Español', zh: '中文', sv: 'Svenska', de: 'Deutsch', fr: 'Français' };
  function styleParts(styleKey) {
    // style_key convention (LANG-KEYED): "<style>|<lang>" or just "<style>".
    var s = String(styleKey || ''); var i = s.lastIndexOf('|');
    if (i > 0) return { style: s.slice(0, i), lang: s.slice(i + 1) };
    return { style: s, lang: '' };
  }
  function prettyStyle(s) { return String(s || '').replace(/[-_]/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  // ── one-time stylesheet ────────────────────────────────────────────────
  function injectCss() {
    if (document.getElementById('antcv-skt-css')) return;
    var st = document.createElement('style'); st.id = 'antcv-skt-css';
    st.textContent =
      '.antcv-skt-head{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;color:rgba(255,255,255,0.55);font-size:11px;font-weight:600;letter-spacing:0.4px;margin:14px 0 6px;}' +
      '.antcv-skt-head .antcv-skt-chev{transition:transform .15s;font-size:9px;opacity:.7;}' +
      '.antcv-skt-collapsed .antcv-skt-chev{transform:rotate(-90deg);}' +
      '.antcv-skt-body{display:block;}' +
      '.antcv-skt-collapsed .antcv-skt-body{display:none;}' +
      '.antcv-skt-row{display:flex;align-items:center;gap:8px;padding:6px 8px;border:1px solid rgba(255,255,255,0.08);border-radius:6px;margin-bottom:5px;background:rgba(255,255,255,0.03);}' +
      '.antcv-skt-row .nm{flex:1;min-width:0;color:#e8e8ec;font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '.antcv-skt-row .lg{flex-shrink:0;color:rgba(255,255,255,0.5);font-size:10px;}' +
      '.antcv-skt-row .dt{flex-shrink:0;color:rgba(255,255,255,0.3);font-size:9px;}' +
      '.antcv-skt-row button{flex-shrink:0;border:none;border-radius:5px;font-size:10px;font-weight:600;padding:4px 8px;cursor:pointer;}' +
      '.antcv-skt-row .ld{background:rgba(120,150,255,0.15);color:#a9c0ff;}' +
      '.antcv-skt-row .dl{background:rgba(220,80,80,0.10);color:#ff9090;}' +
      '.antcv-skt-empty{padding:10px 12px;border:1px dashed rgba(255,255,255,0.15);border-radius:6px;text-align:center;color:rgba(255,255,255,0.4);font-size:10px;}';
    document.head.appendChild(st);
  }

  // ── locate the "YOUR APPLICATIONS" section container ───────────────────
  function findAppsSection() {
    var labels = document.querySelectorAll('div');
    for (var i = 0; i < labels.length; i++) {
      var el = labels[i];
      if (el.childNodes.length === 1 && el.textContent.trim() === APPS_LABEL) {
        return el; // the label div; its parent is the section wrapper
      }
    }
    return null;
  }

  // Make the existing apps section collapsible (collapsed by default), by
  // toggling inline display on the label's FOLLOWING siblings. No node move.
  function wireAppsCollapse(label) {
    if (label.getAttribute('data-antcv-skt-wired') === '1') return;
    label.setAttribute('data-antcv-skt-wired', '1');
    var chev = document.createElement('span');
    chev.textContent = '▾'; chev.style.cssText = 'font-size:9px;opacity:.7;margin-right:5px;display:inline-block;transition:transform .15s;';
    label.style.cursor = 'pointer'; label.style.userSelect = 'none';
    label.insertBefore(chev, label.firstChild);
    var collapsed = true; // default collapsed
    function apply() {
      var sib = label.nextElementSibling;
      while (sib) {
        if (sib.id !== PANEL_ID && !sib.classList.contains('antcv-skt-head') && sib.id !== 'antcv-skt-headwrap') {
          sib.style.display = collapsed ? 'none' : '';
        }
        sib = sib.nextElementSibling;
      }
      chev.style.transform = collapsed ? 'rotate(-90deg)' : '';
    }
    label.addEventListener('click', function () { collapsed = !collapsed; apply(); });
    apply();
    // Re-assert after React re-renders (which reset inline display).
    var mo = new MutationObserver(function () { apply(); });
    try { mo.observe(label.parentElement || document.body, { childList: true, subtree: false }); } catch (_) {}
  }

  // ── build/refresh the styled-kernels panel ─────────────────────────────
  function rowEl(styleKey, jdLang, updatedAt) {
    var p = styleParts(styleKey);
    var lang = jdLang || p.lang || '';
    var row = document.createElement('div'); row.className = 'antcv-skt-row';
    var nm = document.createElement('div'); nm.className = 'nm'; nm.textContent = prettyStyle(p.style || styleKey); row.appendChild(nm);
    var lg = document.createElement('div'); lg.className = 'lg'; lg.textContent = LANG[lang] || (lang ? lang.toUpperCase() : '—'); row.appendChild(lg);
    var dt = document.createElement('div'); dt.className = 'dt';
    try { dt.textContent = updatedAt ? new Date(updatedAt).toISOString().slice(0, 10) : ''; } catch (_) {}
    row.appendChild(dt);
    var ld = document.createElement('button'); ld.className = 'ld'; ld.textContent = 'Load';
    ld.title = 'Load this saved style kernel into the editor';
    ld.addEventListener('click', function () { loadKernel(styleKey, ld); });
    row.appendChild(ld);
    var dl = document.createElement('button'); dl.className = 'dl'; dl.textContent = '🗑';
    dl.addEventListener('click', function () { deleteKernel(styleKey, row, dl); });
    row.appendChild(dl);
    return row;
  }

  function loadKernel(styleKey, btn) {
    var old = btn.textContent; btn.textContent = '⏳'; btn.disabled = true;
    // Prefer the app's own loader if present; else fetch + dispatch an event
    // the editor can adopt (best-effort — the sections are returned raw).
    api('/api/kernel-showcase?style=' + encodeURIComponent(styleKey)).then(function (res) {
      btn.textContent = old; btn.disabled = false;
      var sc = res && res.body && res.body.showcase;
      if (!res.ok || !sc) { alert('Could not load this style kernel.'); return; }
      try {
        window.dispatchEvent(new CustomEvent('antcv:load-style-kernel', { detail: { style_key: styleKey, showcase: sc } }));
      } catch (_) {}
      if (window.AntcvApplyStyleKernel) { try { window.AntcvApplyStyleKernel(sc, styleKey); } catch (_) {} }
      else alert('Loaded "' + prettyStyle(styleParts(styleKey).style) + '" — the editor will adopt it. (If nothing changes, this needs the app-side apply hook.)');
    }).catch(function () { btn.textContent = old; btn.disabled = false; alert('Load failed — check your connection / sign-in.'); });
  }

  function deleteKernel(styleKey, row, btn) {
    if (!confirm('Delete the saved "' + prettyStyle(styleParts(styleKey).style) + '" style kernel?')) return;
    btn.textContent = '⏳';
    api('/api/kernel-showcase?style=' + encodeURIComponent(styleKey), { method: 'DELETE' }).then(function (res) {
      if (res.ok) { row.parentElement && row.parentElement.removeChild(row); }
      else { btn.textContent = '🗑'; alert('Delete failed (HTTP ' + res.status + ').'); }
    }).catch(function () { btn.textContent = '🗑'; alert('Delete failed.'); });
  }

  function refreshList(body) {
    body.innerHTML = '<div class="antcv-skt-empty">Loading…</div>';
    api('/api/kernel-showcase?list=1').then(function (res) {
      body.innerHTML = '';
      var items = (res && res.body && res.body.kernels) || [];
      if (!Array.isArray(items) || !items.length) {
        var e = document.createElement('div'); e.className = 'antcv-skt-empty';
        e.textContent = 'No saved style kernels yet. Generate an unsolicited CV in a writing style + language and it will be saved here for faster reuse.';
        body.appendChild(e); return;
      }
      items.sort(function (a, b) { return (b.updated_at || 0) - (a.updated_at || 0); });
      items.forEach(function (it) { body.appendChild(rowEl(it.style_key || it.style || '', it.jd_language || it.language || '', it.updated_at || it.updatedAt)); });
    }).catch(function () {
      body.innerHTML = '<div class="antcv-skt-empty">Could not load saved styles (check sign-in).</div>';
    });
  }

  function ensurePanel(label) {
    var section = label.parentElement || label;
    if (document.getElementById(PANEL_ID)) return;
    var wrap = document.createElement('div'); wrap.id = PANEL_ID; wrap.className = 'antcv-skt-collapsed'; // collapsed default

    var head = document.createElement('div'); head.className = 'antcv-skt-head';
    var chev = document.createElement('span'); chev.className = 'antcv-skt-chev'; chev.textContent = '▾';
    head.appendChild(chev);
    var ttl = document.createElement('span'); ttl.textContent = 'SAVED STYLE KERNELS (per style × language)'; head.appendChild(ttl);
    wrap.appendChild(head);

    var body = document.createElement('div'); body.className = 'antcv-skt-body';
    wrap.appendChild(body);

    var loaded = false;
    head.addEventListener('click', function () {
      var nowCollapsed = wrap.classList.toggle('antcv-skt-collapsed');
      if (!nowCollapsed && !loaded) { loaded = true; refreshList(body); }
    });

    // insert AFTER the whole apps section (as the last child of the section's parent,
    // right after the section wrapper) so it sits BELOW the regular table.
    var anchor = section;
    if (anchor.parentElement) anchor.parentElement.insertBefore(wrap, anchor.nextSibling);
    else section.appendChild(wrap);
  }

  // ── scan loop: attach when the history tab renders ─────────────────────
  var pending = false;
  function scan() {
    if (pending) return; pending = true;
    requestAnimationFrame(function () {
      pending = false;
      var label = findAppsSection();
      if (!label) return;
      injectCss();
      ensurePanel(label);
      wireAppsCollapse(label);
    });
  }

  try {
    var mo = new MutationObserver(function () { scan(); });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}
  scan();
  [300, 900, 2000].forEach(function (d) { setTimeout(scan, d); });

  window.AntcvStyleKernelsTable = { version: VERSION, _refresh: function () { var b = document.querySelector('#' + PANEL_ID + ' .antcv-skt-body'); if (b) refreshList(b); } };
})();
