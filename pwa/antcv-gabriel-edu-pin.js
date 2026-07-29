/* antcv-gabriel-edu-pin.js — EDU-CANON-PIN-001 (owner 2026-07-23)
 * ===========================================================================
 * "education has some serious issue that has to be fixed and not happen again
 * — please use this education and prevent drift."
 *
 * THE DRIFT (live-diagnosed): the CV sidebar EDUCATION section's rows had lost
 * the whole B.Sc. Electrical Engineering degree (row "B.Sc. Physics" only) and
 * the M.Sc. lost "VLSI" — a compress/tighten pass damaged FACTS. The kernel
 * (personalInfo.education) was intact; the SECTION layer drifted.
 *
 * THE PIN (mirrors antcv-gabriel-results-pin.js): the owner's canonical four
 * rows are REQUIRED FACTS. On every settle, each canonical row is checked by its
 * fact-fingerprint (degree key + required tokens); a row that is missing or has
 * lost a required token is RESTORED verbatim. Owner wording tweaks that keep the
 * facts pass untouched; fact loss self-heals.
 *
 *   MBA                          -> tokens: Technion, Tsinghua
 *   M.Sc. Electrical Engineering -> tokens: Tel Aviv, VLSI
 *   B.Sc. Physics & B.Sc. EE     -> tokens: Physics, EE|Electrical, Tel Aviv
 *   FVU Dansk                    -> tokens: KVUC
 *
 * Gabriel-gated (kernel name check) so personas never inherit his facts
 * (persona-contamination family). Kill: localStorage['antcv:disable-edu-pin']='1'.
 */
(function () {
  'use strict';
  if (window.__antcvGabrielEduPin) return;
  window.__antcvGabrielEduPin = '1.0';

  var KILL = 'antcv:disable-edu-pin';
  var CANON = [
    { deg: 'MBA', sch: 'Technion - Strategy, Finance; China biz-plan competition / Tsinghua Uni. honourable mention.', bullets: [],
      match: function (it) { return /MBA/i.test(it.deg || '') && /Technion/i.test(it.sch || '') && /Tsinghua/i.test(it.sch || ''); } },
    { deg: 'M.Sc. Electrical Engineering', sch: 'Tel Aviv University - VLSI, optics, photonics and nanotechnology.', bullets: [],
      match: function (it) { return /M\.?\s?Sc/i.test(it.deg || '') && /Tel Aviv/i.test(it.sch || '') && /VLSI/i.test(it.sch || ''); } },
    { deg: 'B.Sc. Physics & B.Sc. EE', sch: 'Tel Aviv University', bullets: [],
      match: function (it) { return /B\.?\s?Sc/i.test(it.deg || '') && /Physics/i.test(it.deg || '') && /(EE|Electrical)/i.test(it.deg || ''); } },
    { deg: 'FVU Dansk', sch: 'KVUC, ongoing', bullets: [],
      match: function (it) { return /FVU/i.test(it.deg || '') && /KVUC/i.test(it.sch || ''); } }
  ];

  function killed() { try { return localStorage.getItem(KILL) === '1'; } catch (_) { return false; } }
  function isGabriel() {
    try { var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}'); return /gabriel/i.test(String(pi.name || '')) && /karp/i.test(String(pi.name || '')); }
    catch (_) { return false; }
  }

  var lastFixSig = '';
  function run() {
    try {
      if (killed() || !isGabriel()) return;
      var sec; try { sec = JSON.parse(localStorage.getItem('sections') || '{}'); } catch (_) { return; }
      var edu = (sec.cv || []).find(function (s) { return s && s.id === 'education'; });
      if (!edu) return;
      var items = Array.isArray(edu.items) ? edu.items : [];
      // every canonical row must be present by fact-fingerprint
      var ok = CANON.every(function (c) { return items.some(function (it) { return it && typeof it === 'object' && c.match(it); }); });
      if (ok) { lastFixSig = ''; return; }
      // fact loss -> restore the canonical four rows verbatim.
      var sig = JSON.stringify(items);
      if (sig === lastFixSig) return;   // converge: don't refight a stubborn writer this cycle
      lastFixSig = sig;
      edu.items = CANON.map(function (c) { return { deg: c.deg, sch: c.sch, bullets: [] }; });
      localStorage.setItem('sections', JSON.stringify(sec));
      try { console.warn('[edu-pin] EDUCATION facts drifted (degree/token lost) — canonical rows restored. EDU-CANON-PIN-001'); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'edu-pin' } })); } catch (_) {}
    } catch (_) {}
  }

  window.addEventListener('antcv:sections-updated', function (e) {
    if (e && e.detail && e.detail.reason === 'edu-pin') return;
    clearTimeout(run.__t); run.__t = setTimeout(run, 600);
  });
  try { setInterval(run, 4000); } catch (_) {}
  run();

  window.AntcvGabrielEduPin = { version: '1.0', run: run, canon: CANON.map(function (c) { return { deg: c.deg, sch: c.sch }; }) };
  try { console.debug('[edu-pin] installed'); } catch (_) {}
})();
