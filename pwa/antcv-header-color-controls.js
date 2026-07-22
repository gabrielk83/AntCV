/* antcv-header-color-controls.js — HEADER-COLOR-CONTROLS-001 (owner 2026-07-22)
 * ===========================================================================
 * Owner: "the side panel needs to also control the colour of the name,
 * specialisation, contact, slogan and application as part of their control
 * buttons." This injects a small COLOUR SWATCH into each candidate row's control
 * cluster (the ↔◀✎ group). Clicking it opens the native colour picker; the
 * chosen colour is written to the per-element override store
 * `antcv:headerElemColors` via the HEADER-ELEM-COLORS-001 engine
 * (AntcvHeaderColors.set), which applies it live to the band element. RIGHT-CLICK
 * a swatch to CLEAR the override (revert to the brand / default colour).
 *
 * Rows covered: name, specialisation (= application on the CL), contact. (Slogan
 * + the application line get their own swatches in a follow-up — they are not
 * candidate-panel rows.)
 *
 * SAFETY: the swatch is appended to the row's LAST child (the control cluster);
 * verified live that this does NOT break React's event handling (contact still
 * expands after injection). Editor-gated + light re-inject on
 * `antcv:sections-updated` + a 1.5s poll (NO global body observer — avoids the
 * ANALYSIS-HEADER React-event regression). Idempotent (one swatch per row).
 * Kill-switch: localStorage['antcv:disable-header-color-controls']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvHeaderColorControls) return;
  window.__antcvHeaderColorControls = '1.0';

  var KILL = 'antcv:disable-header-color-controls';
  var MARK = 'data-antcv-color-ctrl';
  var STORE = 'antcv:headerElemColors';
  // candidate-row key -> engine element key
  var MAP = { name: 'name', specialisation: 'spec', contact: 'contact' };

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function editorActive() { try { var v = window.__antcvView; return !(v === 'upload' || v === 'input' || v === 'generating'); } catch (_) { return true; } }
  function override(elem) { try { var o = JSON.parse(localStorage.getItem(STORE) || '{}'); return o[elem] || ''; } catch (_) { return ''; } }

  function paintSwatch(btn, elem) {
    var c = override(elem);
    // solid colour when overridden; a rainbow hint when following brand/default.
    btn.style.background = c || 'conic-gradient(from 0deg, red, orange, yellow, lime, cyan, blue, magenta, red)';
  }

  function makeSwatch(elem, label) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(MARK, elem);
    btn.title = 'Colour of the ' + label + ' line — click to pick, right-click to reset to brand';
    btn.style.cssText = 'width:15px;height:15px;min-width:15px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.55);cursor:pointer;padding:0;margin-left:3px;flex:0 0 auto;box-sizing:border-box;';
    paintSwatch(btn, elem);
    var inp = document.createElement('input');
    inp.type = 'color';
    inp.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;opacity:0;pointer-events:none;';
    btn.addEventListener('click', function (e) {
      e.preventDefault(); e.stopPropagation();
      inp.value = override(elem) || '#ffffff';
      inp.click();
    });
    btn.addEventListener('contextmenu', function (e) {
      e.preventDefault(); e.stopPropagation();
      try { window.AntcvHeaderColors && window.AntcvHeaderColors.set(elem, ''); } catch (_) {}
      paintSwatch(btn, elem);
    });
    inp.addEventListener('input', function () {
      try { window.AntcvHeaderColors && window.AntcvHeaderColors.set(elem, inp.value); } catch (_) {}
      paintSwatch(btn, elem);
    });
    var wrap = document.createDocumentFragment();
    wrap.appendChild(btn); wrap.appendChild(inp);
    return { frag: wrap, btn: btn };
  }

  function apply() {
    if (killed() || !editorActive()) return;
    Object.keys(MAP).forEach(function (rowKey) {
      var row = document.querySelector('.antcv-editor-side-panel [data-candidate-key="' + rowKey + '"], .antcv-mobile-bottom-panel [data-candidate-key="' + rowKey + '"], [data-antcv-app-panel] [data-candidate-key="' + rowKey + '"]') ||
        document.querySelector('[data-candidate-key="' + rowKey + '"]');
      if (!row) return;
      var cluster = row.lastElementChild;
      if (!cluster) return;
      var existing = cluster.querySelector('[' + MARK + ']');
      if (existing) { paintSwatch(existing, MAP[rowKey]); return; }   // keep colour in sync, don't dup
      var s = makeSwatch(MAP[rowKey], rowKey);
      cluster.appendChild(s.frag);
    });
  }

  var deb = null;
  function schedule() { clearTimeout(deb); deb = setTimeout(apply, 120); }
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('storage', function (e) { if (!e || e.key === STORE || e.key === 'antcv:brandV2' || e.key == null) schedule(); });
  try { setInterval(apply, 1500); } catch (_) {}
  apply();

  window.AntcvHeaderColorControls = { version: '1.0', apply: apply };
  try { console.debug('[header-color-controls] installed'); } catch (_) {}
})();
