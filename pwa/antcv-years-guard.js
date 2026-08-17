/* antcv-years-guard.js — YEARS-GUARD-001 (owner 2026-08-17)
 * ============================================================================
 * CONTRADICTION-QA-001 enforcement in the BROWSER. The deterministic
 * years-claim validator shipped 1.51.4167 lives in the headless Python
 * pipeline (quality_pass.rule_kernel_contradiction) — the PWA had only PROMPT
 * instructions, so a hallucinated "33+ years" survived in generated output
 * AND, worse, old rows that already carry the sentence re-display it on every
 * open ("YOU ARE BULLSHITTING 33 YEARS AGAIN").
 *
 * Rule: any "<N> years"/"<N> år" claim in sections (cv + cl) whose N does not
 * appear as a years figure ANYWHERE in personalInfo is rewritten to the
 * kernel's canonical (maximum) figure with a '+'. A claim the kernel itself
 * states is left alone. No kernel years figure -> the guard does nothing.
 *
 * Loop-safe: runs on 'antcv:sections-updated' (ignoring its own events),
 * boot + short reseed timers; writes only when something actually changed.
 * Kill switch: localStorage['antcv:disable-years-guard'] = '1'.
 */
(function () {
  'use strict';
  var V = '1.51.4286';
  if (window.__antcvYearsGuard === V) return;
  window.__antcvYearsGuard = V;

  var SRC = 'years-guard';
  var RE = /\b(\d{1,2})(\s*\+?)\s*(years?|år)\b/gi;

  function killed() { try { return localStorage.getItem('antcv:disable-years-guard') === '1'; } catch (_) { return false; } }
  function readJSON(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (_) { return null; } }

  function kernelYears() {
    var out = {};
    try {
      var s = JSON.stringify(readJSON('personalInfo') || {});
      var m; RE.lastIndex = 0;
      while ((m = RE.exec(s))) out[parseInt(m[1], 10)] = 1;
    } catch (_) {}
    return out;
  }

  function scrub() {
    if (killed()) return;
    var allowed = kernelYears();
    var nums = Object.keys(allowed).map(Number);
    if (!nums.length) return;                    // kernel states no figure -> nothing to check against
    var canon = Math.max.apply(null, nums);
    var all = readJSON('sections');
    if (!all || typeof all !== 'object') return;
    var changed = false;
    var hits = [];
    function walk(node) {
      if (node == null) return;
      if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) { if (typeof node[i] === 'string') node[i] = fix(node[i]); else walk(node[i]); } return; }
      if (typeof node === 'object') { for (var k in node) { if (!Object.prototype.hasOwnProperty.call(node, k)) continue; if (typeof node[k] === 'string') node[k] = fix(node[k]); else walk(node[k]); } }
    }
    function fix(t) {
      RE.lastIndex = 0;
      var out = t.replace(RE, function (whole, n, plus, unit) {
        var num = parseInt(n, 10);
        if (allowed[num]) return whole;
        hits.push(num + ' ' + unit);
        return canon + '+ ' + unit;
      });
      if (out !== t) changed = true;
      return out;
    }
    walk(all.cv); walk(all.cl);
    if (!changed) return;
    try { localStorage.setItem('sections', JSON.stringify(all)); } catch (_) { return; }
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.warn('[years-guard] rewrote contradicting years claim(s): ' + hits.join(', ') + ' -> ' + canon + '+ (CONTRADICTION-QA-001)'); } catch (_) {}
  }

  window.addEventListener('antcv:sections-updated', function (e) {
    if (e && e.detail && e.detail.source === SRC) return;
    setTimeout(scrub, 60);
  });
  [400, 1200, 3000, 6000].forEach(function (ms) { setTimeout(scrub, ms); });
  window.AntcvYearsGuard = { version: V, run: scrub, _kernelYears: kernelYears };
  try { console.debug('[years-guard] installed v' + V); } catch (_) {}
})();
