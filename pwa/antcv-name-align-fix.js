/* AntCV — Name-line alignment sync (NAME-ALIGN-001)
 * ============================================================
 *
 * Symptom (owner): the candidate Name renders left-aligned even though its
 * CJLR control reads "current: center". The preview Name line is rendered
 * by app.js with `text-align: y("name")`, which is desynced from the CJLR
 * control's displayed value — so the user's centre setting is not applied.
 *
 * This sidecar keeps the Name line's text-align in lock-step with its CJLR
 * control. It reads the control's "current: <align>" (the value the user
 * sees and sets), persists it to localStorage so it survives the panel
 * being closed and page reloads, and applies it to the Name node
 * (`[data-antcv-candidate-edit="name"]`) — re-applying after app.js
 * re-renders. Pure DOM; no app.js edit, no fetch wrap.
 *
 * Scope: the Name line only (the owner's report). Other lines (contact,
 * specialisation) share the same app.js desync but are out of scope here.
 *
 * Disable hatch: localStorage['antcvDisableNameAlignFix'] = '1'
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  if (window.__antcvNameAlignFix === VERSION) return;
  window.__antcvNameAlignFix = VERSION;

  var STORE = 'antcv:nameLineAlign';
  var VALID = { left: 1, center: 1, right: 1, justify: 1 };

  function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }
  function disabled() {
    var v = lsGet('antcvDisableNameAlignFix');
    return v === '1' || v === 'true';
  }

  function nameCjlrButton() {
    var btns;
    try { btns = document.querySelectorAll('button[title], button[aria-label]'); }
    catch (_) { return null; }
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      var t = (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '');
      if (/CJLR for Name line/i.test(t)) return b;
    }
    return null;
  }

  function currentFromButton(b) {
    if (!b) return null;
    var m = (b.getAttribute('title') || '').match(/current:\s*(left|center|right|justify)/i);
    return m ? m[1].toLowerCase() : null;
  }

  function nameNodes() {
    try { return document.querySelectorAll('[data-antcv-candidate-edit="name"]'); }
    catch (_) { return []; }
  }

  function apply() {
    if (disabled()) return;
    var align = lsGet(STORE);
    // Refresh from the live control when the panel is open — that is the
    // value the user actually set.
    var cur = currentFromButton(nameCjlrButton());
    if (cur && VALID[cur] && cur !== align) { lsSet(STORE, cur); align = cur; }
    if (!align || !VALID[align]) return;
    var els = nameNodes();
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.style.getPropertyValue('text-align') !== align
        || el.style.getPropertyPriority('text-align') !== 'important') {
        el.style.setProperty('text-align', align, 'important');
      }
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; try { apply(); } catch (_) {} });
  }

  function boot() {
    apply();
    var delays = [150, 400, 1000, 2500];
    for (var d = 0; d < delays.length; d++) setTimeout(apply, delays[d]);
    // Re-apply when app.js re-renders the candidate header.
    try {
      new MutationObserver(schedule).observe(document.body || document.documentElement, {
        childList: true, subtree: true,
      });
    } catch (_) {}
    // Capture a CJLR cycle promptly — the title updates just after the click.
    document.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest ? ev.target.closest('button') : null;
      if (!b) return;
      var t = (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '');
      if (/CJLR for Name line/i.test(t)) { setTimeout(apply, 0); setTimeout(apply, 90); }
    }, true);
    window.addEventListener('antcv:sections-updated', schedule);
    // Backstop for in-place style resets the observer doesn't see.
    setInterval(apply, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.AntcvNameAlignFix = { version: VERSION, apply: apply, _stored: function () { return lsGet(STORE); } };
  try { console.debug('[name-align-fix] installed v' + VERSION); } catch (_) {}
})();
