/* antcv-appline-rule.js — APPLINE-RULE-001 (owner 2026-07-22, ask #6)
 * ===========================================================================
 * A horizontal RULE under the V5 application line ([data-antcv-app-line], the
 * role·company line below the slogan on the CL) with a control matching the other
 * rule controls: visible/invisible toggle · colour · thickness · reset-to-brand.
 *
 * Store `antcv:applineRule` = { on:bool, color:hex|'', pt:number }. Render (this
 * sidecar, preview): a border-bottom under the app-line when `on` — colour = the
 * override, else the app-line's own text colour, else the brand accent. Control:
 * a compact group attached to the app-line (contenteditable=false, positioned so
 * it never edits the text):  —/🚫 toggle · thickness cycle (0.75→1.5→2.25pt) ·
 * a plain rule-colour swatch · ↺ reset. Export (DOCX) parity is a follow-up.
 *
 * Kill-switch: localStorage['antcv:disable-appline-rule']='1'. Editor-gated,
 * light re-apply (sections-updated + 1.5s poll, NO global observer).
 */
(function () {
  'use strict';
  if (window.__antcvApplineRule) return;
  window.__antcvApplineRule = '1.0';

  var KILL = 'antcv:disable-appline-rule';
  var STORE = 'antcv:applineRule';
  var MARK = 'data-antcv-appline-rule-ctrl';
  var PTS = [0.75, 1.5, 2.25];

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function editorActive() { try { var v = window.__antcvView; return !(v === 'upload' || v === 'input' || v === 'generating'); } catch (_) { return true; } }
  function read() { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (_) { return {}; } }
  function write(patch) {
    var s = read();
    Object.keys(patch).forEach(function (k) { if (patch[k] === undefined || patch[k] === null) delete s[k]; else s[k] = patch[k]; });
    try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (_) {}
    apply();
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'appline-rule' } })); } catch (_) {}
  }
  function toHex(c) {
    var m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '');
    if (!m) return (/^#[0-9a-f]{6}$/i.test(c || '') ? c : '');
    function h(n) { return ('0' + Number(n).toString(16)).slice(-2); }
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  }
  function appLine() { return document.querySelector('.antcv-preview-paper [data-antcv-app-line]'); }
  function ruleColor(el) {
    var s = read(); if (s.color) return s.color;
    try { var hx = toHex(getComputedStyle(el).color); if (hx) return hx; } catch (_) {}
    try { var acc = getComputedStyle(document.querySelector('.antcv-preview-paper')).getPropertyValue('--brand-accent').trim(); if (acc) return acc; } catch (_) {}
    return '#595959';
  }

  function renderRule(el) {
    var s = read();
    if (s.on) {
      var pt = PTS.indexOf(Number(s.pt)) >= 0 ? Number(s.pt) : 0.75;
      var px = Math.max(0.5, Math.round((pt * 4 / 3) * 2) / 2);
      el.style.setProperty('border-bottom', px + 'px solid ' + ruleColor(el), 'important');
      el.style.setProperty('padding-bottom', '2px', 'important');
    } else if (el.getAttribute('data-antcv-appline-ruled')) {
      el.style.removeProperty('border-bottom'); el.style.removeProperty('padding-bottom');
    }
    if (s.on) el.setAttribute('data-antcv-appline-ruled', '1'); else el.removeAttribute('data-antcv-appline-ruled');
  }

  function mkBtn(txt, title) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = txt; b.title = title; b.setAttribute('contenteditable', 'false');
    b.style.cssText = 'font-size:10px;line-height:1;background:rgba(0,0,0,0.35);color:#eee;border:1px solid rgba(255,255,255,0.4);border-radius:3px;padding:1px 4px;margin-left:2px;cursor:pointer;flex:0 0 auto;';
    return b;
  }

  function buildControl(el) {
    var box = document.createElement('span');
    box.setAttribute(MARK, '1'); box.setAttribute('contenteditable', 'false');
    box.style.cssText = 'position:absolute;left:calc(100% + 8px);top:50%;transform:translateY(-50%);display:inline-flex;align-items:center;white-space:nowrap;z-index:5;';
    var s = read();
    // toggle
    var tg = mkBtn(s.on ? '—' : '🚫', s.on ? 'Rule under the application line: shown — click to hide' : 'Rule under the application line: hidden — click to show');
    tg.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); write({ on: !read().on }); });
    // thickness
    var pt = PTS.indexOf(Number(s.pt)) >= 0 ? Number(s.pt) : 0.75;
    var th = mkBtn(pt + 'pt', 'Rule thickness — click to cycle');
    th.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); var cur = Number(read().pt) || 0.75; var next = PTS[(PTS.indexOf(cur) + 1) % PTS.length]; write({ pt: next, on: true }); });
    // colour swatch = the native colour input directly (opens the OS picker on click;
    // a hidden input + programmatic .click() is blocked by Chrome).
    var sw = document.createElement('input');
    sw.type = 'color'; sw.setAttribute('contenteditable', 'false');
    sw.title = 'Rule colour — click to pick'; sw.value = ruleColor(el);
    sw.style.cssText = 'width:15px;height:15px;border-radius:50%;border:1.5px solid rgba(255,255,255,0.55);cursor:pointer;padding:0;margin-left:3px;flex:0 0 auto;background:none;';
    sw.addEventListener('click', function (e) { e.stopPropagation(); });
    sw.addEventListener('input', function () { write({ color: sw.value, on: true }); });
    // reset
    var rst = mkBtn('↺', 'Reset the rule colour to the brand / visual-style default');
    rst.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); write({ color: null }); });
    box.appendChild(tg); box.appendChild(th); box.appendChild(sw); box.appendChild(rst);
    return box;
  }

  var lastSig = null;
  function apply() {
    if (killed() || !editorActive()) return;
    var el = appLine(); if (!el) return;
    renderRule(el);
    if (getComputedStyle(el).position === 'static') { try { el.style.position = 'relative'; } catch (_) {} }
    var sig = JSON.stringify(read());
    var existing = el.querySelector('[' + MARK + ']');
    if (existing && sig === lastSig) return;   // control present + no state change -> don't rebuild (no flicker)
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    el.appendChild(buildControl(el));
    lastSig = sig;
  }

  var deb = null;
  function schedule() { clearTimeout(deb); deb = setTimeout(apply, 150); }
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('storage', function (e) { if (!e || e.key === STORE || e.key == null) schedule(); });
  try { setInterval(apply, 1500); } catch (_) {}
  apply();

  window.AntcvApplineRule = { version: '1.0', apply: apply, _read: read };
  try { console.debug('[appline-rule] installed'); } catch (_) {}
})();
