/* antcv-cv-subtitle-pin-760.js — CV-SUBTITLE-PIN-001 (owner 2026-06-28)
 * ============================================================================
 * Gabriel's UNSOLICITED CV specialization line (meta.subtitle) must be the standing
 * line "Processes • Products • People" (the generation prompt already pins it,
 * app.src.js ~2907). But the kernel-showcase cloud restore (app.src.js ~16216) writes
 * meta back from the slot, and when the slot held the TEMPLATE placeholder
 * ("[Specialisation — 1–3 focus areas, separated by •]") it overwrites the good value on
 * reload — the owner saw the subtitle "revert to template format".
 *
 * Fix: restore-proof, idempotent, NAME-GUARDED (Gabriel only) pin. Set meta.subtitle to
 * the standing line ONLY when it is empty or the template placeholder — never clobber a
 * non-template owner edit. Touches meta.subtitle ONLY (leaves company/role/applicationLabel,
 * i.e. the CL "Application: …" line, untouched). After writing it dispatches a synthetic
 * 'storage' event for key 'meta' so the existing app listener repaints React state (no
 * app.js mirror needed). Mirrors antcv-sidebar-repopulate-758.js.
 * Kill switch: localStorage 'antcv:disable-cv-subtitle-pin' = '1'.
 */
(function () {
  'use strict';
  var V = '1.51.4146';
  if (window.__antcvCvSubtitlePin760 === V) return;
  window.__antcvCvSubtitlePin760 = V;
  try { if (localStorage.getItem('antcv:disable-cv-subtitle-pin') === '1') return; } catch (_) {}

  var GOOD = 'Processes • Products • People';
  function rd(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function isGabriel() { var p = rd('personalInfo') || {}; p = p.personalInfo || p; return /\bgabriel\b/i.test(String((p || {}).name || '')); }
  // empty OR the EN/DA "[Specialis…" placeholder = template (safe to overwrite).
  function isTemplate(s) { s = String(s || '').trim(); return !s || /^\[\s*specialis/i.test(s); }

  function run() {
    try {
      if (!isGabriel()) return;
      var m = rd('meta');
      if (!m || typeof m !== 'object') return;
      // SUBTITLE-UNSOL-PIN-GATE-001 (1.51.4146): the pillar is the UNSOLICITED
      // standing line. A TARGETED app (named, non-unsolicited company in meta)
      // must never receive it — leave the placeholder for the row's own subtitle
      // (mirrors appIsTargeted() in antcv-subtitle-sequence-368.js, which this
      // pin was defeating by loading later and filling the placeholder).
      var co = String(m.company || '').trim();
      if (co && !/^open application$/i.test(co)) {
        var re = window.__ANTCV_UNSOL_RE || /^unsolicited$/i;
        var isUnsol = (typeof window.__antcvUnsol === 'function') ? window.__antcvUnsol(co) : re.test(co);
        if (!isUnsol) return;
      }
      if (!isTemplate(m.subtitle)) return;   // owner-edited / already good -> leave
      if (m.subtitle === GOOD) return;
      m.subtitle = GOOD;
      localStorage.setItem('meta', JSON.stringify(m));
      // Repaint via the existing storage-key:'meta' listener (app.src.js ~16019).
      try { window.dispatchEvent(new StorageEvent('storage', { key: 'meta', newValue: JSON.stringify(m) })); }
      catch (_) { try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'cv-subtitle-pin-760' } })); } catch (__) {} }
    } catch (_) { /* self-disable on any error */ }
  }

  window.addEventListener('antcv:sections-updated', run);
  [0, 200, 800, 1800].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvCvSubtitlePin = { version: V, run: run };
})();
