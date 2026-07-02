/* antcv-cl-format-panel.js — CL-FORMAT-PANEL-001 / F3 (register row 7)
 * ============================================================================
 * F1/F2 gave the cover-letter sign-off its own cloud-safe controls (signature +
 * slogan/closing/name), but they mount as loose blocks chained after the PROFILE
 * PHOTO control with no visual boundary — CV and CL formatting read as one soup.
 * F3 = a DISTINCT "COVER LETTER FORMAT" panel: this sidecar builds a labelled
 * wrapper in Settings → Layout and RE-PARENTS the two existing controls into it.
 *
 * Zero data-shape changes — the controls keep their own markers, stores and
 * self-heal logic (they check `mounted.isConnected`, so re-parenting is safe;
 * the slogan control mounts after the signature WHEREVER it lives, so it lands
 * inside the panel by itself). Idempotent, observer-driven, kill-switchable:
 * localStorage['antcv:disable-cl-format-panel']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.82-cl-format-panel';
  if (window.__antcvClFormatPanel === VERSION) return;
  window.__antcvClFormatPanel = VERSION;

  var ACCENT = '#01B7BB';
  var MARK = 'data-antcv-cl-format-panel';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-cl-format-panel'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function buildPanel() {
    var panel = document.createElement('div');
    panel.setAttribute(MARK, '1');
    panel.style.cssText = 'margin:14px 0 6px 0;padding:10px 10px 8px 10px;' +
      'border:1px solid rgba(1,183,187,0.45);border-radius:10px;background:rgba(1,183,187,0.05);';
    var head = document.createElement('div');
    head.style.cssText = 'font-size:12px;font-weight:700;letter-spacing:.06em;color:' + ACCENT + ';' +
      'display:flex;align-items:center;gap:8px;user-select:none;padding-bottom:6px;' +
      'border-bottom:1px solid rgba(1,183,187,0.3);margin-bottom:2px;';
    var icon = document.createElement('span');
    icon.textContent = '✉';
    icon.style.cssText = 'font-size:13px;';
    var txt = document.createElement('span');
    txt.textContent = 'COVER LETTER FORMAT';
    var sub = document.createElement('span');
    sub.textContent = 'signature · slogan · sign-off';
    sub.style.cssText = 'font-weight:400;font-size:10px;opacity:.65;letter-spacing:0;margin-left:auto;';
    head.appendChild(icon); head.appendChild(txt); head.appendChild(sub);
    panel.appendChild(head);
    return panel;
  }

  function scan() {
    if (disabled()) return;
    try {
      // duplicate panels (a panel that leaked into a re-rendered container): keep the first connected one
      var panels = document.querySelectorAll('[' + MARK + ']');
      for (var j = 1; j < panels.length; j++) { if (panels[j].parentNode) panels[j].parentNode.removeChild(panels[j]); }
      var sig = document.querySelector('[data-antcv-cl-sig-control]');
      if (!sig || !sig.parentNode) return;               // signature control not mounted yet
      var panel = panels.length ? panels[0] : null;
      if (!panel || !panel.isConnected) {
        panel = buildPanel();
        sig.parentNode.insertBefore(panel, sig);
      }
      // re-parent the signature control into the panel (safe: control checks isConnected only)
      if (sig.parentNode !== panel) panel.appendChild(sig);
      // the slogan control mounts itself AFTER the signature control (inside the panel once
      // sig lives here) — but adopt one that mounted before us:
      var slogan = document.querySelector('[data-antcv-cl-slogan-control]');
      if (slogan && slogan.parentNode !== panel) panel.appendChild(slogan);
      // keep visual order: signature first, slogan second
      if (slogan && slogan.parentNode === panel && slogan.previousElementSibling !== sig) {
        panel.appendChild(slogan);
      }
    } catch (_) { /* never break Settings */ }
  }

  var t = null;
  function schedule() { if (t) return; t = setTimeout(function () { t = null; scan(); }, 200); }
  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) { if (muts[i].addedNodes && muts[i].addedNodes.length) { schedule(); return; } }
  });
  function start() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    schedule();
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
  window.AntcvClFormatPanel = { version: VERSION, scan: scan };
})();
