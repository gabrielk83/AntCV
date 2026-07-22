/* antcv-header-color-controls.js — HEADER-COLOR-CONTROLS-001 (owner 2026-07-22)
 * ===========================================================================
 * Owner: "the side panel needs to control the colour of name / specialisation /
 * contact / slogan / application as part of their control buttons." Injects a
 * PLAIN colour SWATCH + a ↺ RESET button into each candidate row's control
 * cluster (and the slogan editor row / the app-line element).
 *
 * The swatch shows the element's ACTUAL current colour (solid — no rainbow
 * "kaleidoscope" look, per owner 2026-07-22). Left-click opens the native colour
 * picker; the chosen colour is written to `antcv:headerElemColors` via the
 * HEADER-ELEM-COLORS-001 engine (AntcvHeaderColors.set), which applies it live.
 * The ↺ button (right next to the swatch) resets that element to the brand /
 * visual-style default (clears its override); it's active only while an override
 * is set.
 *
 * SAFETY: appended to the row's control cluster; verified this does NOT break
 * React events (contact still expands). Editor-gated + light re-inject on
 * `antcv:sections-updated` + a 1.5s poll (NO global body observer — avoids the
 * ANALYSIS-HEADER regression). Idempotent. Kill: localStorage['antcv:disable-header-color-controls']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvHeaderColorControls) return;
  window.__antcvHeaderColorControls = '1.1-plain-reset';

  var KILL = 'antcv:disable-header-color-controls';
  var MARK = 'data-antcv-color-ctrl';
  var STORE = 'antcv:headerElemColors';
  var MAP = { name: 'name', specialisation: 'spec', contact: 'contact' };

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function editorActive() { try { var v = window.__antcvView; return !(v === 'upload' || v === 'input' || v === 'generating'); } catch (_) { return true; } }
  function override(elem) { try { var o = JSON.parse(localStorage.getItem(STORE) || '{}'); return o[elem] || ''; } catch (_) { return ''; } }

  // ---- resolve the live DOM element for each header element (mirrors the engine) ----
  function bandParts() {
    var band = document.querySelector('.antcv-preview-paper [data-antcv-candidate-band="1"]');
    if (!band) return {};
    var divs = Array.prototype.slice.call(band.querySelectorAll(':scope > div'))
      .filter(function (d) { return Array.prototype.some.call(d.childNodes, function (n) { return n.nodeType === 3 && n.textContent.trim(); }); });
    var contact = divs.filter(function (d) { return /[☎🔗⌂✉@]/.test(d.textContent) || /\d[\d\s]{6,}/.test(d.textContent); })[0];
    var name = divs[0];
    var spec = divs.filter(function (d) { return d !== name && d !== contact; })[0];
    return { name: name, spec: spec, contact: contact };
  }
  function sloganEl() {
    var paper = document.querySelector('.antcv-preview-paper'); if (!paper) return null;
    return paper.querySelector('[data-antcv-cl-slogan-element]') || paper.querySelector('[title*="positioning line" i]') ||
      (function () { var f = paper.querySelector('[data-antcv-cl-flow]'); return f ? f.querySelector('[contenteditable]:not([data-antcv-app-line])') : null; })();
  }
  function elemNode(elem) {
    if (elem === 'slogan') return sloganEl();
    if (elem === 'application') return document.querySelector('.antcv-preview-paper [data-antcv-app-line]');
    return bandParts()[elem] || null;
  }
  function toHex(c) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
    if (!m) return (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
    function h(n) { return ('0' + Number(n).toString(16)).slice(-2); }
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  }
  // The swatch shows the element's ACTUAL current colour (override, else computed).
  function currentColor(elem) {
    var o = override(elem); if (o) return o;
    try { var n = elemNode(elem); if (n) { var hx = toHex(getComputedStyle(n).color); if (hx) return hx; } } catch (_) {}
    return '#888888';
  }

  function paintSwatch(btn, elem) { btn.style.background = currentColor(elem); }
  function paintReset(rst, elem) {
    var on = !!override(elem);
    rst.disabled = !on;
    rst.style.opacity = on ? '1' : '0.35';
    rst.style.cursor = on ? 'pointer' : 'default';
    rst.style.color = on ? '#e0e0e0' : '#888';
  }

  function makeControl(elem, label) {
    var frag = document.createDocumentFragment();
    // plain solid swatch = the element's current colour
    var btn = document.createElement('button');
    btn.type = 'button'; btn.setAttribute(MARK, elem);
    btn.title = 'Colour of the ' + label + ' line — click to pick';
    btn.style.cssText = 'width:15px;height:15px;min-width:15px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.55);cursor:pointer;padding:0;margin-left:4px;flex:0 0 auto;box-sizing:border-box;';
    paintSwatch(btn, elem);
    var inp = document.createElement('input');
    inp.type = 'color';
    inp.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;opacity:0;pointer-events:none;';
    btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); inp.value = currentColor(elem); inp.click(); });
    inp.addEventListener('input', function () { try { window.AntcvHeaderColors && window.AntcvHeaderColors.set(elem, inp.value); } catch (_) {} paintSwatch(btn, elem); paintReset(rst, elem); });
    // ↺ reset-to-brand button, right next to the swatch
    var rst = document.createElement('button');
    rst.type = 'button'; rst.setAttribute(MARK + '-reset', elem);
    rst.title = 'Reset the ' + label + ' colour to the brand / visual-style default';
    rst.textContent = '↺';
    rst.style.cssText = 'font-size:11px;line-height:1;background:none;border:none;padding:0 1px;margin-left:1px;flex:0 0 auto;';
    rst.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { window.AntcvHeaderColors && window.AntcvHeaderColors.set(elem, ''); } catch (_) {}
      paintSwatch(btn, elem); paintReset(rst, elem);
    });
    paintReset(rst, elem);
    frag.appendChild(btn); frag.appendChild(inp); frag.appendChild(rst);
    return { frag: frag, btn: btn, rst: rst };
  }

  function ensureInto(container, elem, label) {
    if (!container) return;
    var existing = container.querySelector('[' + MARK + '="' + elem + '"]');
    if (existing) {
      paintSwatch(existing, elem);
      var er = container.querySelector('[' + MARK + '-reset="' + elem + '"]');
      if (er) paintReset(er, elem);
      return;
    }
    var c = makeControl(elem, label);
    container.appendChild(c.frag);
  }

  function apply() {
    if (killed() || !editorActive()) return;
    Object.keys(MAP).forEach(function (rowKey) {
      var row = document.querySelector('.antcv-editor-side-panel [data-candidate-key="' + rowKey + '"], .antcv-mobile-bottom-panel [data-candidate-key="' + rowKey + '"], [data-antcv-app-panel] [data-candidate-key="' + rowKey + '"]') ||
        document.querySelector('[data-candidate-key="' + rowKey + '"]');
      if (!row) return;
      ensureInto(row.lastElementChild, MAP[rowKey], rowKey);
    });
    applySlogan();
    applyAppLine();
  }

  function applySlogan() {
    var label = null, all = document.querySelectorAll('span');
    for (var i = 0; i < all.length; i++) { if ((all[i].textContent || '').trim() === 'COVER LETTER SLOGAN') { label = all[i]; break; } }
    if (!label) return;
    var row = label;
    for (var d = 0; d < 5 && row.parentElement; d++) { if (getComputedStyle(row).display === 'flex' && row.querySelector('button')) break; row = row.parentElement; }
    if (getComputedStyle(row).display !== 'flex') return;
    ensureInto(row, 'slogan', 'slogan');
  }

  function applyAppLine() {
    var el = document.querySelector('.antcv-preview-paper [data-antcv-app-line]');
    if (!el) return;
    if (el.querySelector('[' + MARK + '="application"]')) { var b = el.querySelector('[' + MARK + '="application"]'); paintSwatch(b, 'application'); var r = el.querySelector('[' + MARK + '-reset="application"]'); if (r) paintReset(r, 'application'); return; }
    if (getComputedStyle(el).position === 'static') { try { el.style.position = 'relative'; } catch (_) {} }
    var c = makeControl('application', 'application');
    [c.btn, c.rst].forEach(function (b) { b.setAttribute('contenteditable', 'false'); });
    var box = document.createElement('span');
    box.setAttribute('contenteditable', 'false');
    box.style.cssText = 'position:absolute;right:-42px;top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;white-space:nowrap;';
    box.appendChild(c.frag);
    el.appendChild(box);
  }

  var deb = null;
  function schedule() { clearTimeout(deb); deb = setTimeout(apply, 120); }
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('storage', function (e) { if (!e || e.key === STORE || e.key === 'antcv:brandV2' || e.key == null) schedule(); });
  try { setInterval(apply, 1500); } catch (_) {}
  apply();

  window.AntcvHeaderColorControls = { version: '1.1-plain-reset', apply: apply };
  try { console.debug('[header-color-controls] installed (plain + reset)'); } catch (_) {}
})();
