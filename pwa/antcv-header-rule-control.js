/* antcv-header-rule-control.js — HEADER-ITEM-RULE-001 UI + preview parity (row 5)
 * ============================================================================
 * The per-field header rule ENGINE shipped in 1.51.83 (store 'headerItemRule' →
 * payload header_rules → worker borders). This sidecar adds:
 *  (a) the render HELPERS the live preview + HTML export call (guarded splices
 *      with exact-legacy fallbacks): __antcvHdrRuleDiv / Html / Style;
 *  (b) the SETTINGS CONTROL — "CV HEADER RULE LINES" box in Settings → Layout
 *      (after the PROFILE PHOTO control): per field (Name / Specialization /
 *      Contact) an on/off checkbox + thickness (pt) + color + auto(theme).
 * DEFAULTS (absent store) = copenhagen-modern = today's look: rule below
 * Spec/Application + below Contact, none below Name, 0.75pt, theme teal.
 * Kill (UI only; helpers keep honoring the store):
 * localStorage['antcv:disable-header-rule-control']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.85-header-rule-control';
  if (window.__antcvHeaderRuleControl === VERSION) return;
  window.__antcvHeaderRuleControl = VERSION;

  var ACCENT = '#01B7BB';
  var KEY = 'headerItemRule';
  var FIELDS = [
    { k: 'name', label: 'Name', defOn: false },
    { k: 'specialisation', label: 'Specialization / Application', defOn: true },
    { k: 'contact', label: 'Contact', defOn: true },
  ];

  function readStore() { try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } }
  function fieldCfg(k, defOn) {
    var v = readStore()[k] || {};
    var on = typeof v.on === 'boolean' ? v.on : defOn;
    var pt = Number(v.pt); pt = isFinite(pt) && pt >= 0.25 && pt <= 4 ? pt : 0.75;
    var color = typeof v.color === 'string' && /^#?[0-9a-fA-F]{6}$/.test(v.color) ? ('#' + v.color.replace('#', '')) : '';
    return { on: on, pt: pt, color: color };
  }
  function defOnOf(k) { for (var i = 0; i < FIELDS.length; i++) if (FIELDS[i].k === k) return FIELDS[i].defOn; return false; }

  // ---- render helpers (consumed by app.js/app.src.js guarded splices) ----
  window.__antcvHdrRuleDiv = function (R, field, theme, margin) {
    try {
      var c = fieldCfg(field, defOnOf(field));
      if (!c.on) return null;
      var px = Math.max(0.5, Math.round((c.pt * 4 / 3) * 2) / 2);
      return R.createElement('div', { style: { borderBottom: px + 'px solid ' + (c.color || theme), margin: margin } });
    } catch (_) { return null; }
  };
  window.__antcvHdrRuleStyle = function (field, theme) {
    try {
      var c = fieldCfg(field, defOnOf(field));
      if (!c.on) return {};
      var px = Math.max(0.5, Math.round((c.pt * 4 / 3) * 2) / 2);
      return { borderBottom: px + 'px solid ' + (c.color || theme), paddingBottom: '2px' };
    } catch (_) { return {}; }
  };
  window.__antcvHdrRuleHtml = function (field, theme, mt, mb) {
    try {
      var c = fieldCfg(field, defOnOf(field));
      if (!c.on) return '';
      var color = c.color || theme;
      return '<table width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin:' + mt + 'pt 0 ' + mb + 'pt 0"><tr><td style="border-bottom:' + c.pt + 'pt solid ' + color + ';font-size:0;line-height:0;height:1px">&nbsp;</td></tr></table>';
    } catch (_) { return ''; }
  };

  // ---- settings control ----
  function uiDisabled() { try { var v = localStorage.getItem('antcv:disable-header-rule-control'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function writeField(k, patch) {
    try {
      var s = readStore();
      var cur = s[k] && typeof s[k] === 'object' ? s[k] : {};
      s[k] = Object.assign({}, cur, patch);
      localStorage.setItem(KEY, JSON.stringify(s));
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'header-rule-control' } })); } catch (_) {}
    } catch (_) {}
  }

  function photoControl() {
    var rows = document.querySelectorAll('[data-antcv-bridge-active]');
    for (var i = 0; i < rows.length; i++) {
      var ctrl = rows[i].parentElement;
      var c = ctrl && ctrl.firstElementChild;
      if (c && /PROFILE PHOTO/i.test(c.textContent || '') && (c.textContent || '').length < 40) return ctrl;
    }
    return null;
  }

  function buildRow(f) {
    var cfg = fieldCfg(f.k, f.defOn);
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:11px;flex-wrap:wrap;';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = cfg.on;
    cb.onchange = function () { writeField(f.k, { on: cb.checked }); };
    var lb = document.createElement('span');
    lb.textContent = f.label;
    lb.style.cssText = 'flex:1 1 120px;min-width:110px;';
    var sel = document.createElement('select');
    sel.style.cssText = 'font-size:10px;padding:2px;';
    [0.5, 0.75, 1, 1.5, 2].forEach(function (p) {
      var o = document.createElement('option'); o.value = String(p); o.textContent = p + ' pt';
      if (Math.abs(p - cfg.pt) < 0.01) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () { writeField(f.k, { pt: Number(sel.value) }); };
    var col = document.createElement('input');
    col.type = 'color'; col.value = cfg.color || ACCENT;
    col.title = 'Rule colour';
    col.style.cssText = 'width:26px;height:20px;padding:0;border:none;background:none;cursor:pointer;';
    col.oninput = function () { writeField(f.k, { color: col.value.replace('#', '') }); };
    var auto = document.createElement('button');
    auto.type = 'button'; auto.textContent = 'auto';
    auto.title = 'Use the theme colour';
    auto.style.cssText = 'font-size:9px;padding:2px 6px;border-radius:4px;border:1px solid rgba(1,183,187,0.45);background:none;color:' + ACCENT + ';cursor:pointer;';
    auto.onclick = function () { writeField(f.k, { color: '' }); col.value = ACCENT; };
    row.appendChild(cb); row.appendChild(lb); row.appendChild(sel); row.appendChild(col); row.appendChild(auto);
    return row;
  }

  function build() {
    var box = document.createElement('div');
    box.setAttribute('data-antcv-header-rule-control', '1');
    box.style.cssText = 'margin:8px 0 0 0;padding:8px 10px;border:1px solid rgba(1,183,187,0.25);border-radius:8px;background:rgba(255,255,255,0.02);';
    var head = document.createElement('div');
    head.style.cssText = 'font-size:11px;font-weight:700;letter-spacing:.04em;color:' + ACCENT + ';margin-bottom:6px;';
    head.textContent = 'CV HEADER RULE LINES';
    box.appendChild(head);
    var note = document.createElement('div');
    note.textContent = 'Horizontal lines under each header field (preview + PDF).';
    note.style.cssText = 'font-size:9px;opacity:.6;margin-bottom:6px;';
    box.appendChild(note);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:5px;';
    FIELDS.forEach(function (f) { wrap.appendChild(buildRow(f)); });
    box.appendChild(wrap);
    return box;
  }

  var mounted = null;
  function scan() {
    if (uiDisabled()) return;
    try {
      var existing = document.querySelectorAll('[data-antcv-header-rule-control]');
      for (var j = 1; j < existing.length; j++) { if (existing[j].parentNode) existing[j].parentNode.removeChild(existing[j]); }
      if (mounted && mounted.isConnected) return;
      if (existing.length && existing[0].isConnected) { mounted = existing[0]; return; }
      var photo = photoControl();
      if (!photo || !photo.parentNode) return;
      mounted = build();
      photo.parentNode.insertBefore(mounted, photo.nextSibling);
    } catch (_) {}
  }
  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; scan(); }, 180); }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; } }
  });
  function start() { try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {} schedule(); }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.AntcvHeaderRuleControl = { version: VERSION, scan: scan, _fieldCfg: fieldCfg };
})();
