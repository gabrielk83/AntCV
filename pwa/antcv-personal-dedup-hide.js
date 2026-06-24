/* AntCV — Settings → Personal de-duplication hide (PERSONAL-MERGE-6)
 * ===========================================================================
 * The "Review & Edit my data" modal (antcv-data-export-360.js) is now the single
 * surface for identity / contact / background / CV-sidebar / banned-terms editing.
 * The native Personal-tab controls that DUPLICATE it are hidden here, by CSS only,
 * so the change is fully reversible and never touches app.js logic or the store.
 *
 * COVERAGE (each hidden control writes the SAME store the modal edits — proven by
 * pwa/test/diag-personal-merge6-e2e.mjs before shipping; cf. the 1.50.545
 * banned-words regression — never hide a control whose function isn't covered):
 *   - Full Name / Headline inputs   -> modal Identity card (personalInfo.name/.headline)
 *   - Quick contact details          -> modal Identity grid (email/phone/location/…)
 *   - Background (work history)       -> modal Summary + Work history
 *   - CV Sidebar Content              -> modal Tools/Education/Certs/Regulatory/Additional
 *   - Banned words / phrases / Semantic (writing-style island sub-sections)
 *                                     -> modal "Tone & banned terms" (same canonical store)
 *
 * SAFETY
 *   - Scoped to Settings → Personal (only acts when the writing-style island is up).
 *   - CSS display:none only; nothing is removed. Reversible per element.
 *   - Kill switch: localStorage['antcv:show-personal-dupes'] = '1' unhides everything.
 *   - Idempotent; re-applied on mutation (app.js re-renders the column).
 */
(function () {
  'use strict';
  var VERSION = '1.50.861-personal-dedup-hide';
  if (window.__antcvPersonalDedupHide === VERSION) return;
  window.__antcvPersonalDedupHide = VERSION;

  var MARK = 'data-antcv-dedup-hidden';
  var KILL = 'antcv:show-personal-dupes';
  function killed() { try { var v = localStorage.getItem(KILL); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function hide(el) {
    if (!el || el.getAttribute(MARK) === '1') return;
    el.setAttribute(MARK, '1');
    try { el.style.setProperty('display', 'none', 'important'); } catch (_) {}
  }
  function unhideAll() {
    var ns = document.querySelectorAll('[' + MARK + '="1"]');
    Array.prototype.forEach.call(ns, function (el) { try { el.removeAttribute(MARK); el.style.removeProperty('display'); } catch (_) {} });
  }

  // The writing-style island only mounts in Settings → Personal — a reliable
  // signal that we are on the Personal subtab, and the anchor for its column.
  function personalColumn(wsp) {
    var n = wsp;
    for (var i = 0; i < 8 && n && n.parentElement; i++) {
      try { var cs = getComputedStyle(n.parentElement); if (cs.display === 'flex' && /column/.test(cs.flexDirection)) return n.parentElement; } catch (_) {}
      n = n.parentElement;
    }
    return wsp.parentElement || null;
  }

  function apply() {
    if (killed()) { unhideAll(); return; }
    var wsp = document.getElementById('antcv-react-writing-style-picker')
      || document.querySelector('[data-antcv-react-mount="writing-style-picker"]');
    if (!wsp) return;                       // not on Personal
    var col = personalColumn(wsp);
    if (!col) return;

    // Native Full Name / Headline — wrapper div whose first child is the small
    // label and which contains an <input>.
    Array.prototype.forEach.call(col.querySelectorAll('div'), function (d) {
      if (d.getAttribute(MARK) === '1') return;
      var lab = d.firstElementChild;
      if (!lab || lab.tagName !== 'DIV') return;
      var t = (lab.textContent || '').trim();
      if ((/^Full Name$/i.test(t) || /^Headline \/ Job Title/i.test(t)) && d.querySelector('input')) hide(d);
    });

    // Quick contact details (collapsed by default → its fields aren't in the DOM).
    var qc = col.querySelector('[data-antcv-quick-contact-hdr]');
    if (qc) hide(qc);

    // Name/contact caption helper line (owner 2026-06-24) — redundant.
    var cap = col.querySelector('[data-antcv-name-caption]') || document.querySelector('[data-antcv-name-caption]');
    if (cap) hide(cap);

    // Personality kernel card — moved INTO the Review & Edit modal (owner
    // 2026-06-24), so hide the standalone Personal-tab card.
    var pcard = document.getElementById('antcv-personality-kernel-card');
    if (pcard) hide(pcard);

    // Background + CV Sidebar Content disclosures, by summary text.
    Array.prototype.forEach.call(col.querySelectorAll('details'), function (dt) {
      var s = dt.querySelector('summary');
      var t = s ? (s.textContent || '').trim() : '';
      if (/^Background \(work history\)/i.test(t) || /^CV Sidebar Content/i.test(t)) hide(dt);
    });

    // Writing-style island Banned words / Banned phrases / Semantic constraints
    // sub-section headers (collapsed by default → only the header button exists).
    // Scoped to the island so the modal's own tone editors are never touched.
    Array.prototype.forEach.call(wsp.querySelectorAll('button'), function (b) {
      var t = (b.textContent || '').replace(/[▸▾▶▼]/g, '').replace(/\s+/g, ' ').trim();
      if (t === 'Banned words' || /^Banned phrases/i.test(t) || t === 'Semantic constraints') hide(b);
    });
  }

  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { apply(); } catch (_) {} }); }
  function boot() {
    schedule();
    [200, 700, 1800, 3500].forEach(function (ms) { setTimeout(schedule, ms); });
    try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvPersonalDedupHide = { version: VERSION, _apply: apply, _unhideAll: unhideAll };
})();
