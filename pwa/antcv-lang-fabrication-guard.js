/* antcv-lang-fabrication-guard.js - GEN-LANGFAB-001 (register row 42, owner, CONTENT)
 * ============================================================================
 * The generator fabricated language proficiencies: it invented a language that is
 * NOT in the kernel ("German") and got a level wrong (Danish B1 inflated), despite
 * the prompt-level pin (LANG-PIN-001). Owner policy: a gen-ignored-rule report gets
 * a stored-sections BELT, not more prompt text. This deterministically reconciles
 * the stored CV "languages" section against the kernel personalInfo.languages
 * ([{lang,level}]):
 *   - DROP any language row whose name is NOT in the kernel languages set;
 *   - CORRECT the level of a kept row to the kernel's value when it genuinely differs.
 *
 * NAME-NEUTRAL: kernel truth is read from personalInfo.languages, which every
 * persona carries (gabriel/anita/devon kernels). No hardcoded language names.
 *
 * SAFETY:
 *   - Fires ONLY when the kernel actually declares >=1 language. Empty kernel = no-op
 *     (never strip a section we cannot verify).
 *   - CV languages section matched by id 'languages' or title /languages|sprog/i.
 *   - Item shape: labeled_list {l:name, v:level} OR rich_block {b:name, t:level}
 *     (mirrors antcv-languages-concise.js). Name in l/b, level in v/t.
 *   - Level comparison is BIDIRECTIONAL-containment tolerant, so it never fights
 *     antcv-languages-concise (which reformats "B1" -> "intermediate (B1)" etc.).
 *   - Writes only when something changed (no event loops); self-disabling on error.
 * Kill: localStorage['antcv:disable-lang-fabrication-guard']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.136-lang-fabrication-guard';
  if (window.__antcvLangFabricationGuard === VERSION) return;
  window.__antcvLangFabricationGuard = VERSION;

  function disabled() {
    try { var v = localStorage.getItem('antcv:disable-lang-fabrication-guard'); return v === '1' || v === 'true'; }
    catch (_) { return false; }
  }
  function readJson(k, d) {
    try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; }
    catch (_) { return d; }
  }
  function norm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

  // Kernel truth: personalInfo.languages ([{lang,level}]). Handles the nested
  // personalInfo.personalInfo wrap (see antcv-unsol-company-scrub.js).
  function kernelLangs() {
    var p = readJson('personalInfo', {}) || {};
    p = p.personalInfo || p;
    var arr = Array.isArray(p.languages) ? p.languages : [];
    var map = {}; var order = [];
    arr.forEach(function (e) {
      if (!e || typeof e !== 'object') return;
      var name = norm(e.lang != null ? e.lang : (e.l != null ? e.l : e.language));
      if (!name) return;
      var lvl = String((e.level != null ? e.level : (e.v != null ? e.v : '')) || '').trim();
      if (!(name in map)) { order.push(name); }
      map[name] = lvl;   // last wins
    });
    return { map: map, order: order, count: order.length };
  }

  function isLanguages(s) {
    return !!(s && (s.id === 'languages' || /\blanguages?\b|\bsprog\b/i.test(String(s.title || ''))));
  }

  // Read name/level of a row in either shape. Returns {nameField, lvlField, name, level}.
  function rowFields(row) {
    if (!row || typeof row !== 'object') return null;
    if (typeof row.l === 'string' || typeof row.v === 'string') {
      return { nameField: 'l', lvlField: 'v', name: norm(row.l), level: String(row.v == null ? '' : row.v) };
    }
    if (!row.grp && (typeof row.b === 'string' || typeof row.t === 'string')) {
      return { nameField: 'b', lvlField: 't', name: norm(row.b), level: String(row.t == null ? '' : row.t) };
    }
    return null;
  }

  // The kernel level is authoritative ONLY when the current row level genuinely
  // disagrees. Compare loosely (case/space-insensitive) AND treat containment in
  // EITHER direction as a match, so a cosmetically-formatted value ("intermediate
  // (B1)" vs "B1", or "professional" vs "full professional") is a fixpoint and is
  // never rewritten - this is what stops a ping-pong with antcv-languages-concise.
  function levelDiffers(cur, kern) {
    var a = norm(cur), b = norm(kern);
    if (!b) return false;                  // kernel has no level -> do not touch
    if (a === b) return false;             // exact match
    if (a && a.indexOf(b) !== -1) return false; // current CONTAINS kernel level
    if (a && b.indexOf(a) !== -1) return false; // kernel CONTAINS current level
    return true;
  }

  function run() {
    if (disabled()) return;
    try {
      var K = kernelLangs();
      if (!K.count) return;                // no kernel languages -> never strip
      var secs = readJson('sections', null);
      if (!secs || !Array.isArray(secs.cv)) return;
      var changed = false;
      for (var i = 0; i < secs.cv.length; i++) {
        var s = secs.cv[i];
        if (!isLanguages(s) || !Array.isArray(s.items)) continue;
        var kept = [];
        for (var j = 0; j < s.items.length; j++) {
          var row = s.items[j];
          var f = rowFields(row);
          if (!f || !f.name) { kept.push(row); continue; }   // unrecognised shape -> leave as-is
          if (!(f.name in K.map)) { changed = true; continue; }  // DROP: not in kernel (fabricated)
          if (levelDiffers(f.level, K.map[f.name])) {            // CORRECT level to kernel
            var nr = Object.assign({}, row); nr[f.lvlField] = K.map[f.name]; kept.push(nr); changed = true;
          } else {
            kept.push(row);
          }
        }
        if (changed) { s.items = kept; }
      }
      if (!changed) return;
      localStorage.setItem('sections', JSON.stringify(secs));
      try { console.log('[lang-fabrication-guard] reconciled languages section against kernel'); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'lang-fabrication-guard' } })); } catch (_) {}
    } catch (_) { /* self-disable on error */ }
  }

  window.addEventListener('antcv:sections-updated', function (ev) {
    try { if (ev && ev.detail && ev.detail.reason === 'lang-fabrication-guard') return; } catch (_) {}
    setTimeout(run, 350);
  });
  [0, 300, 900, 2000, 3500, 6000].forEach(function (ms) { setTimeout(run, ms); });

  window.AntcvLangFabricationGuard = {
    version: VERSION, run: run,
    _kernelLangs: kernelLangs, _rowFields: rowFields, _levelDiffers: levelDiffers,
  };
})();
