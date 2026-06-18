/* antcv-outcomes-metric-order.js — OUTCOMES-METRIC-ORDER-001 (owner 2026-06-18)
 * ============================================================================
 * Owner: "you cannot expect the user to sort his numerics - do it in import."
 * The Results lamination already ranks at RENDER (RESULTS-METRIC-RANK-001,
 * 1.50.668), but that does NOT touch the STORED data, so the EDITOR still shows
 * a role's outcomes in their raw order. This bakes the same impressiveness order
 * into the data: each experience role's `outcomes[]` is sorted STRONGEST-FIRST
 * (the exact `_metricScore` used by the export/preview lamination), in both the
 * `sections` blob (what the editor + lamination read) and `personalInfo`.
 *
 * Covers EVERY path - import, cloud-restore, generation - because it runs on the
 * sections/personalInfo change those fire (an import dispatches it too), so the
 * owner's current data is sorted on the next tick without needing a re-import.
 * Roles themselves are NEVER reordered (they stay reverse-chronological); only a
 * role's OWN outcomes are ranked. Stable: ties keep their original order, so it
 * is idempotent and never thrashes.
 *
 * Sidecar-only. Loop-safe: same-blob bail + write-only-on-change + own tagged
 * event ignored. Disable: localStorage['antcv:disable-outcomes-metric-order']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvOutcomesMetricOrder) return;
  window.__antcvOutcomesMetricOrder = '1.50.673';

  var SRC = 'outcomes-metric-order';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-outcomes-metric-order'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // EXACT copy of the lamination scorer (antcv-docx-client.js _metricScore) so the
  // stored order matches the rendered Results.
  var _metricScore = function (text) {
    var t = String(text == null ? '' : text); var best = 0, m;
    var re1 = /([\d][\d,.]*)\s*(?:[a-z%]+\s+){0,2}(?:to|->|→|–|—)\s+(?:[a-z]+\s+){0,2}([\d][\d,.]*)/gi;
    while ((m = re1.exec(t))) { var a = parseFloat(m[1].replace(/,/g, '')), b = parseFloat(m[2].replace(/,/g, '')); if (a > 0 && b > 0) { var r = Math.max(a, b) / Math.min(a, b); if (r > best) best = r; } }
    var re2 = /([\d][\d,.]*)\s*(?:×|x\b|-fold|fold)/gi;
    while ((m = re2.exec(t))) { var n = parseFloat(m[1].replace(/,/g, '')); if (n > best) best = n; }
    var re3 = /([\d.]+)\s*%/g;
    while ((m = re3.exec(t))) { var p = parseFloat(m[1]); if (/reduc|cut|sav|less|few|down|short|increas|faster|improv|gain|grow|boost/i.test(t)) { var mult = (p > 0 && p < 100) ? 100 / (100 - p) : 1; if (mult > best) best = mult; } else if (p / 20 > best) best = p / 20; }
    var re4 = /([\d][\d,.]*)\s*(?:of|out of|\/)\s*([\d][\d,.]*)/gi;
    while ((m = re4.exec(t))) { var x = parseFloat(m[1].replace(/,/g, '')), y = parseFloat(m[2].replace(/,/g, '')); if (x > 0 && y > 0) { var f = x / y; if (f <= 1.0001 && f > best) best = f; } }
    if (best === 0) { var nums = (t.match(/[\d][\d,.]*/g) || []).map(function (s) { return parseFloat(s.replace(/,/g, '')); }).filter(function (k) { return k > 0; }); if (nums.length) best = Math.min(1.5, Math.log10(Math.max.apply(null, nums) + 1)); }
    return best;
  };

  function outcomeText(o) { return typeof o === 'string' ? o : ((o && (o.result || o.title || [o.b, o.t].filter(Boolean).join(' '))) || ''); }

  // STABLE sort by metricScore desc. Returns a new array, or null if unchanged.
  function sortOutcomes(arr) {
    if (!Array.isArray(arr) || arr.length < 2) return null;
    var idx = arr.map(function (o, i) { return { o: o, i: i, s: _metricScore(outcomeText(o)) }; });
    idx.sort(function (a, b) { return (b.s - a.s) || (a.i - b.i); });
    var sorted = idx.map(function (x) { return x.o; });
    var changed = sorted.some(function (o, i) { return o !== arr[i]; });
    return changed ? sorted : null;
  }

  // Sort each role's OWN outcomes; never reorder the roles themselves.
  function sortRolesOutcomes(roles) {
    if (!Array.isArray(roles)) return false;
    var changed = false;
    roles.forEach(function (r) {
      if (!r || !Array.isArray(r.outcomes)) return;
      var s = sortOutcomes(r.outcomes);
      if (s) { r.outcomes = s; changed = true; }
    });
    return changed;
  }

  var lastSec = null, lastPi = null;
  function apply() {
    if (disabled()) return;
    try { var __ae = document.activeElement; if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ""))) return; } catch (_) {}

    // sections: every experience section's roles
    try {
      var rawS = localStorage.getItem('sections');
      if (rawS && rawS !== lastSec) {
        var b = JSON.parse(rawS), changed = false;
        ['cv', 'cl'].forEach(function (doc) {
          var list = b[doc];
          if (!Array.isArray(list)) return;
          list.forEach(function (sec) {
            if (sec && sec.type === 'experience' && Array.isArray(sec.roles) && sortRolesOutcomes(sec.roles)) changed = true;
          });
        });
        if (changed) {
          var os = JSON.stringify(b); localStorage.setItem('sections', os); lastSec = os;
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
          try { console.info('[outcomes-metric-order] sorted role outcomes strongest-first'); } catch (_) {}
        } else lastSec = rawS;
      }
    } catch (_) {}

    // personalInfo.experience (the kernel store)
    try {
      var rawPi = localStorage.getItem('personalInfo');
      if (rawPi && rawPi !== lastPi) {
        var pi = JSON.parse(rawPi);
        if (sortRolesOutcomes(pi.experience)) { var op = JSON.stringify(pi); localStorage.setItem('personalInfo', op); lastPi = op; }
        else lastPi = rawPi;
      }
    } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [500, 1400, 2800].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'personalInfo' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvOutcomesMetricOrder = { version: '1.50.673', _apply: apply, _score: _metricScore };
})();
