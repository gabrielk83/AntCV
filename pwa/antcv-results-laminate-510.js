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
  window.__antcvResultsLaminate510 = '1.50.498';

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

  // Returns { text, hideIdx }: text = the laminated Results line; hideIdx = the
  // index of a bullet to HIDE (>=0 only for the tier-4 derive path, where the
  // Results line IS one of the role's own bullets and must not also show as a
  // bullet). Tiers 1-3 (real outcomes) never hide a bullet (hideIdx = -1).
  function bulletText(b) { return String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '').trim(); }
  function lamFor(role, pp, jd) {
    if (!role) return { text: '', hideIdx: -1 };
    if (typeof role.results === 'string' && role.results.trim()) return { text: cap(role.results), hideIdx: -1 };
    if (Array.isArray(role.outcomes) && role.outcomes.length) {
      const texts = role.outcomes.filter((o) => outcomeVisible(o, jd))
        // LAM-RESULTS-001 (2026-06-18): v2 kernel outcomes are {title,result} —
        // read o.result; keep the v1 {b,t} path. Without this, v2 roles skipped
        // tiers 2-3 and DERIVED the Results from the role's own bullet (tier 4),
        // so the preview showed the bullet while the export showed the outcome.
        .map((o) => (typeof o === 'string' ? o.trim()
          : (o.result ? String(o.result).trim() : [o.b, o.t].filter(Boolean).join(' ').trim())))
        .filter(Boolean);
      if (texts.length) return { text: cap(texts.slice(0, 2).join('; ')), hideIdx: -1 };
    }
    const ids = Array.isArray(role.proofPointIds) ? role.proofPointIds : [];
    let fromPp = ids.map((id) => pp[id]).filter(Boolean);
    // v2 kernel roles carry a flat role.proofPoints[] (strings) instead of ids.
    if (!fromPp.length && Array.isArray(role.proofPoints) && role.proofPoints.length)
      fromPp = role.proofPoints.map((p) => (typeof p === 'string' ? p.trim() : String((p && (p.text || p.result)) || '').trim())).filter(Boolean);
    if (fromPp.length) return { text: cap(fromPp.slice(0, 2).join('; ')), hideIdx: -1 };
    // RESULTS-LAMINATION-003 (owner 2026-06-15): derive from the role's OWN
    // strongest bullet (prefer numeric/metric, patent filtered) ONLY when tiers 1-3
    // found nothing real — and then HIDE that bullet (apply() drops the matching
    // [data-edit-path] element) so the same line is not shown twice. Owner verified
    // his master profile has ≥1 real outcome per position, so this is a rare path.
    const bl = Array.isArray(role.bullets) ? role.bullets : [];
    let bi = -1, bs = -1;
    for (let i = 0; i < bl.length; i++) {
      const t = bulletText(bl[i]);
      if (!t || t.length < 12 || /\bpatent\b/i.test(t)) continue;
      const sc = (/\d|%|\bx\b|×/.test(t) ? 1000 : 0) + Math.min(t.length, 240);
      if (sc > bs) { bs = sc; bi = i; }
    }
    if (bi >= 0) return { text: cap(bulletText(bl[bi])), hideIdx: bi };
    return { text: '', hideIdx: -1 };
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
      // RESULTS-PREVIEW-REPEAT-001 (owner 2026-06-19): the app.js render emits
      // data-antcv-role-results as 0 for nearly every role (only the 2nd was "1"),
      // so the old `exp.roles[t]` resolved to roles[0] (Kanzen) for ~all roles and
      // its result was painted onto every role — the "repetitive preview Results"
      // the owner saw (role-id-stabilize did NOT help: the bug is this index, not
      // the ids). The Results divs render in DOCUMENT ORDER = the VISIBLE-role order,
      // so map the i-th div to the i-th VISIBLE role. Fall back to the (broken) index
      // only if the order-count disagrees with the visible-role count.
      const visRoles = exp.roles.filter((r) => r && r.on !== false);
      const orderOk = visRoles.length === divs.length;
      for (let i = 0; i < divs.length; i++) {
        const div = divs[i];
        const t = parseInt(div.getAttribute('data-antcv-role-results'), 10);
        const role = orderOk ? visRoles[i] : (t >= 0 ? exp.roles[t] : null);
        const span = div.querySelector('[data-antcv-results-edit]');
        if (!role || !span) continue;
        const ti = exp.roles.indexOf(role);   // real index for the bullet-hide selector
        const rKey = span.getAttribute('data-antcv-results-edit') || '';
        if (overrides && typeof overrides[rKey] === 'string' && overrides[rKey].trim()) continue; // user edit wins
        if (document.activeElement === span) continue; // do not fight an active edit
        const lam = lamFor(role, pp, jd);
        if (!lam || !lam.text) continue;
        // RESULTS-LAMINATION-003: when the result was DERIVED from a bullet, hide
        // that bullet (by its data-edit-path) so it isn't shown twice. Idempotent +
        // fully guarded; if the element can't be found the result still renders.
        if (lam.hideIdx >= 0) {
          try {
            const sel = '[data-edit-path="roles.' + ti + '.bullets.' + lam.hideIdx + '"]';
            const be = document.querySelector(sel);
            const li = be && (be.closest('li') || be.closest('[data-antcv-bullet], p, div'));
            if (li && li.getAttribute('data-antcv-results-hid') !== '1') {
              li.style.display = 'none';
              li.setAttribute('data-antcv-results-hid', '1');
            }
          } catch (_) {}
        }
        if (span.getAttribute('data-antcv-laminated') === lam.text && span.textContent === lam.text) continue;
        span.textContent = lam.text;
        span.setAttribute('data-antcv-laminated', lam.text);
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

  window.AntcvResultsLaminate = { version: '1.50.498', apply: apply };
})();
