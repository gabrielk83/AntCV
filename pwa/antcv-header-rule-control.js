/* antcv-header-rule-control.js — HEADER-ITEM-RULE-001 UI + preview parity (row 5)
 * ============================================================================
 * The per-field header rule ENGINE shipped in 1.51.83 (store 'headerItemRule' →
 * payload header_rules → worker borders). This sidecar adds:
 *  (a) the render HELPERS the live preview + HTML export call (guarded splices
 *      with exact-legacy fallbacks): __antcvHdrRuleDiv / Html / Style;
 *  (b) the PER-FIELD CONTROL (owner 2026-07-03 "not in Settings — in the editor
 *      side panel!"): a compact "Rule line below" row injected into each header
 *      field DETAILED EDITOR (the ← Back panel that opens from the candidate
 *      rows), next to the CJLR control: on/off + thickness (pt) + colour + auto.
 * DEFAULTS (absent store): NO rules inside the header box — the Copenhagen
 * MOCKUP LOCK (owner 2026-07-23: "we still have separation lines inside the
 * header") has a clean navy box with no internal lines. A user who explicitly
 * turned a rule ON in the field editor keeps it (store.on wins over defOn).
 * Kill (UI only; helpers keep honoring the store):
 * localStorage['antcv:disable-header-rule-control']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.3121-header-rules-off';
  if (window.__antcvHeaderRuleControl === VERSION) return;
  window.__antcvHeaderRuleControl = VERSION;

  var ACCENT = '#01B9BD';
  var KEY = 'headerItemRule';
  // HEADER-RULE-DEFAULTS-002 (owner 2026-07-23): "specialization (def-hidden),
  // contact (def-hidden), slogan (def-hidden), application (def-visible)".
  // specialisation/contact flip from the old copenhagen default-ON to default-OFF;
  // slogan + application join as first-class rule fields (application is no longer
  // aliased to the specialisation slot — it rules the app-line below the slogan).
  var FIELDS = [
    { k: 'name', label: 'Name', defOn: false },
    { k: 'specialisation', label: 'Specialization', defOn: false },
    { k: 'contact', label: 'Contact', defOn: false },
    { k: 'slogan', label: 'Cover letter slogan', defOn: false },
    { k: 'application', label: 'Application line', defOn: true },
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

  // ---- per-field control, injected into each header field's DETAILED EDITOR ----
  // The je expanded panel = a div holding a "← Back" button + renderEditor();
  // its PREVIOUS sibling is the field row, whose text starts with the label.
  var FIELD_OF_LABEL = [
    [/^name/i, 'name'],
    [/^special/i, 'specialisation'],
    [/^application/i, 'application'],   // HEADER-RULE-DEFAULTS-002: its OWN rule (the app-line), no longer the spec slot
    [/^contact/i, 'contact'],
    [/slogan/i, 'slogan'],
  ];
  // HEADER-RULE-DETECT-002 (owner DOM capture): the ROW text starts with the
  // move buttons, not the label — detect from the PANEL content first (the
  // Name editor carries 'Full name'), then a word-search of the row text.
  function fieldOfRow(row, panel) {
    try {
      var pt = String(panel && panel.textContent || '');
      if (/full name/i.test(pt)) return 'name';
      var rt = String(row && row.textContent || '');
      if (/slogan/i.test(rt) || /slogan/i.test(pt)) return 'slogan';
      if (/application/i.test(rt) || /application/i.test(pt)) return 'application';
      if (/special/i.test(rt) || /special/i.test(pt)) return 'specialisation';
      if (/contact/i.test(rt) || /contact/i.test(pt)) return 'contact';
      if (/name/i.test(rt)) return 'name';
    } catch (_) {}
    return null;
  }
  function buildRuleRow(k) {
    var defOn = defOnOf(k);
    var cfg = fieldCfg(k, defOn);
    var row = document.createElement('div');
    row.setAttribute('data-antcv-header-rule-row', k);
    row.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:10px;margin-top:8px;padding-top:6px;border-top:1px dashed rgba(1,183,187,0.35);flex-wrap:wrap;';
    var lb = document.createElement('span');
    lb.textContent = 'Rule line below';
    lb.style.cssText = 'font-weight:700;color:' + ACCENT + ';letter-spacing:.03em;';
    var cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = cfg.on;
    cb.onchange = function () { writeField(k, { on: cb.checked }); };
    var sel = document.createElement('select');
    sel.style.cssText = 'font-size:10px;padding:1px 2px;';
    [0.5, 0.75, 1, 1.5, 2].forEach(function (p) {
      var o = document.createElement('option'); o.value = String(p); o.textContent = p + ' pt';
      if (Math.abs(p - cfg.pt) < 0.01) o.selected = true;
      sel.appendChild(o);
    });
    sel.onchange = function () { writeField(k, { pt: Number(sel.value) }); };
    var col = document.createElement('input');
    col.type = 'color'; col.value = cfg.color || ACCENT;
    col.title = 'Rule colour';
    col.style.cssText = 'width:24px;height:18px;padding:0;border:none;background:none;cursor:pointer;';
    col.oninput = function () { writeField(k, { color: col.value.replace('#', '') }); };
    var auto = document.createElement('button');
    auto.type = 'button'; auto.textContent = 'auto';
    auto.title = 'Use the theme colour';
    auto.style.cssText = 'font-size:9px;padding:1px 5px;border-radius:4px;border:1px solid rgba(1,183,187,0.45);background:none;color:' + ACCENT + ';cursor:pointer;';
    auto.onclick = function () { writeField(k, { color: '' }); col.value = ACCENT; };
    row.appendChild(lb); row.appendChild(cb); row.appendChild(sel); row.appendChild(col); row.appendChild(auto);
    return row;
  }
  function scan() {
    if (uiDisabled()) return;
    try {
      var btns = document.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        if (String(btns[i].textContent || '').trim() !== '← Back') continue;
        var backRow = btns[i].parentElement;
        var panel = backRow && backRow.parentElement;
        if (!panel || panel.querySelector('[data-antcv-header-rule-row]')) continue;
        var k = fieldOfRow(panel.previousElementSibling, panel);
        if (!k) continue;
        panel.appendChild(buildRuleRow(k));
      }
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
