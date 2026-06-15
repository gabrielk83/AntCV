/* antcv-results-laminate-510.js — RESULTS-LAMINATION-001 preview half (owner 2026-06-15)
 * ===========================================================================
 * The EXPORT laminates each role's "Results:" line from its OWN data
 * (antcv-docx-client.js applyOutcomesMode). This sidecar makes the PREVIEW match,
 * WITHOUT touching the minified app.js experience render (whose results IIFE uses
 * heavily-overloaded short locals — hand-mirroring it is the minified-mirror-
 * shadow-hazard that has crashed the editor before). Instead it overrides the
 * already-rendered per-role Results value with the laminated text.
 *
 * Per-role precedence (identical to the export):
 *   1. role.results (verbatim)
 *   2. role.outcomes[] — default-visible items, OR JD-gated items whose
 *      visibilityRule.showWhenJDContainsAny matches localStorage 'antcv:lastJdText'
 *   3. role.proofPointIds resolved against personalInfo.proofPointsByRole
 *   4. derive from the role's OWN bullets (prefer numeric), patent filtered
 *
 * Safety:
 *   - Self-disabling: every step is try/caught; worst case it does nothing and the
 *     preview keeps the legacy heuristic text.
 *   - Respects user edits: skips a role whose antcv:resultsOverride is set, and
 *     never overwrites the span while it is focused (mid-edit).
 *   - Idempotent: tags the span with data-antcv-laminated and only writes on change,
 *     so the MutationObserver cannot loop.
 *   - LIMITATION: it can only override a Results value the app already rendered; a
 *     role the heuristic skipped (no [data-antcv-role-results] div) is not added.
 */
(function () {
  'use strict';
  if (window.__antcvResultsLaminate510) return;
  window.__antcvResultsLaminate510 = '1.50.492';

  function readJSON(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (_) { return d; } }
  function activeDoc() { try { const x = JSON.parse(localStorage.getItem('doc') || '"cv"'); return x === 'cl' ? 'cl' : 'cv'; } catch (_) { return 'cv'; } }
  function jdText() { try { return String(localStorage.getItem('antcv:lastJdText') || '').toLowerCase(); } catch (_) { return ''; } }
  function cap(t) { t = String(t || '').trim(); return t.length > 260 ? t.slice(0, 257).replace(/[;,\s]+\S*$/, '') + '…' : t; }

  function ppMap() {
    const pi = readJSON('personalInfo', {}) || {};
    const root = pi.personalInfo ? pi.personalInfo : pi;
    const m = {};
    [].concat(root.proofPointsByRole || [], root.proofPointsByPosition || [])
      .forEach((p) => { if (p && p.id && typeof p.text === 'string') m[p.id] = p.text; });
    return m;
  }

  function outcomeVisible(o, jd) {
    if (typeof o === 'string') return true;
    if (!o) return false;
    if (o.defaultVisible !== false) return true;
    const tr = (o.visibilityRule && Array.isArray(o.visibilityRule.showWhenJDContainsAny)) ? o.visibilityRule.showWhenJDContainsAny : [];
    return !!jd && tr.some((t) => t && jd.includes(String(t).toLowerCase()));
  }

  function lamFor(role, pp, jd) {
    if (!role) return '';
    if (typeof role.results === 'string' && role.results.trim()) return cap(role.results);
    if (Array.isArray(role.outcomes) && role.outcomes.length) {
      const texts = role.outcomes.filter((o) => outcomeVisible(o, jd))
        .map((o) => (typeof o === 'string' ? o.trim() : [o.b, o.t].filter(Boolean).join(' ').trim()))
        .filter(Boolean);
      if (texts.length) return cap(texts.slice(0, 2).join('; '));
    }
    const ids = Array.isArray(role.proofPointIds) ? role.proofPointIds : [];
    const fromPp = ids.map((id) => pp[id]).filter(Boolean);
    if (fromPp.length) return cap(fromPp.slice(0, 2).join('; '));
    // derive from own bullets, prefer numeric/metric, never invent
    const bl = (Array.isArray(role.bullets) ? role.bullets : [])
      .map((b) => (typeof b === 'string' ? b : ((b && (b.b || b.t)) || '')))
      .map((s) => String(s || '').trim()).filter(Boolean);
    const strong = /\b\d[\d.,]*\s*(%|x\b|×|fold|days?|hours?|weeks?|months?|years?)/i;
    let best = '', bs = -1;
    for (const s of bl) { if (/\bpatent\b/i.test(s)) continue; const sc = (strong.test(s) ? 4 : 0) + (/\d/.test(s) ? 2 : 0) + Math.min(1, s.length / 140); if (sc > bs) { bs = sc; best = s; } }
    return best ? cap(best) : '';
  }

  function apply() {
    try {
      const sections = readJSON('sections', {}) || {};
      const list = sections[activeDoc()] || sections.cv || [];
      if (!Array.isArray(list)) return;
      const exp = list.find((s) => s && s.type === 'experience');
      if (!exp || !Array.isArray(exp.roles)) return;
      const pp = ppMap();
      const jd = jdText();
      const overrides = readJSON('antcv:resultsOverride', {}) || {};
      const divs = document.querySelectorAll('[data-antcv-role-results]');
      for (let i = 0; i < divs.length; i++) {
        const div = divs[i];
        const t = parseInt(div.getAttribute('data-antcv-role-results'), 10);
        if (!(t >= 0)) continue;
        const role = exp.roles[t];
        const span = div.querySelector('[data-antcv-results-edit]');
        if (!role || !span) continue;
        const rKey = span.getAttribute('data-antcv-results-edit') || '';
        if (overrides && typeof overrides[rKey] === 'string' && overrides[rKey].trim()) continue; // user edit wins
        if (document.activeElement === span) continue; // do not fight an active edit
        const lam = lamFor(role, pp, jd);
        if (!lam) continue;
        if (span.getAttribute('data-antcv-laminated') === lam && span.textContent === lam) continue;
        span.textContent = lam;
        span.setAttribute('data-antcv-laminated', lam);
      }
    } catch (_) { /* self-disable on any error */ }
  }

  let pending = null;
  function schedule() { if (pending != null) return; pending = requestAnimationFrame(() => { pending = null; try { apply(); } catch (_) {} }); }
  function boot() {
    schedule();
    try {
      const obs = new MutationObserver(schedule);
      obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    } catch (_) {}
    try { window.addEventListener('storage', schedule); } catch (_) {}
    try { window.addEventListener('antcv:package-changed', schedule); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvResultsLaminate = { version: '1.50.492', apply: apply };
})();
