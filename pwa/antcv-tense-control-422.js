/* AntCV experience-tense control — relocated to Personal (v1.50.422)
 * ============================================================================
 * TENSE-RELOCATE-001 (owner 2026-06-13: "where the heck is the tense control?
 * need to be part of the languages control and grammar checker"). The 3-way
 * EXPERIENCE TENSE control existed only in Advanced → Style, which the owner
 * couldn't find. This sidecar injects the SAME control into Settings →
 * Personal, ordered right after the "Languages in the top bar" card (order 27)
 * so it sits with the languages + grammar (spelling) controls.
 *
 * Source of truth: styleConfig.expTense (localStorage "styleConfig"). On click
 * it calls window._antcvSetExpTense(v) — the app's live setter that updates
 * React state + persists + cloud-syncs WITHOUT flipping the package to
 * "custom" — with a direct localStorage merge as fallback. The generation
 * prompt already reads styleConfig.expTense, so the choice is honoured.
 *
 * Order-based Personal column: the control gets style.order = 28 (languages 27,
 * advanced tone 30), so it lands between them regardless of DOM insertion.
 */
(function () {
  'use strict';
  var VERSION = '1.50.537';
  if (window.__antcvTenseControl422 === VERSION) return;
  window.__antcvTenseControl422 = VERSION;

  var HOST_ID = 'antcv-tense-control-422';
  var OPTS = [
    ['auto', 'Auto', 'Present for the current role, past for earlier roles'],
    ['present', 'Present', 'Force present tense on every role'],
    ['past', 'Past', 'Force past tense on every role'],
  ];

  function readTense() {
    try {
      var raw = localStorage.getItem('styleConfig');
      if (!raw) return 'auto';
      var sc = JSON.parse(raw);
      if (sc && typeof sc === 'object') {
        if (sc.expTense === 'present' || sc.expTense === 'past' || sc.expTense === 'auto') return sc.expTense;
        if (sc.expPastTense === true) return 'past';
      }
    } catch (_) {}
    return 'auto';
  }
  function writeTense(v) {
    var done = false;
    try { if (typeof window._antcvSetExpTense === 'function') { window._antcvSetExpTense(v); done = true; } } catch (_) {}
    if (!done) {
      // fallback: merge directly into styleConfig (JSON-encoded, like u.set)
      try {
        var raw = localStorage.getItem('styleConfig');
        var sc = {};
        try { sc = raw ? JSON.parse(raw) : {}; } catch (_) { sc = {}; }
        if (!sc || typeof sc !== 'object') sc = {};
        sc.expTense = v;
        localStorage.setItem('styleConfig', JSON.stringify(sc));
      } catch (_) {}
    }
    try { window.dispatchEvent(new CustomEvent('antcv:exp-tense-changed', { detail: { value: v } })); } catch (_) {}
  }

  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }

  function paintActive(host) {
    var cur = readTense();
    host.querySelectorAll('button[data-antcv-tense]').forEach(function (b) {
      var on = b.getAttribute('data-antcv-tense') === cur;
      b.style.background = on ? 'rgba(1,183,187,0.1)' : 'rgba(255,255,255,0.04)';
      b.style.border = '1px solid ' + (on ? '#01B7BB' : 'rgba(255,255,255,0.15)');
      b.style.color = on ? '#01B7BB' : 'rgba(255,255,255,0.5)';
      b.style.fontWeight = '600';
    });
  }

  function build() {
    // order 22: Languages(20) -> Experience Tense(22) -> Advanced Tone(30).
    // PERSONAL-CARDS-VERTICAL-001 (owner 2026-06-13): width:100% so the card
    // takes a full row and the Personal controls stack VERTICALLY, never side by
    // side, regardless of the column's flex direction/wrap.
    var wrap = el('div', 'order:22;margin-top:8px;width:100%;flex:0 0 100%;box-sizing:border-box;');
    wrap.id = HOST_ID;
    var label = el('div',
      'color:rgba(255,255,255,0.5);font-size:9px;letter-spacing:0.8px;margin-bottom:5px;text-transform:uppercase;font-weight:600;',
      'Experience tense');
    wrap.appendChild(label);
    var row = el('div', 'display:flex;gap:5px;flex-wrap:wrap;');
    OPTS.forEach(function (o) {
      var b = el('button', 'padding:4px 9px;font-size:10px;border-radius:5px;cursor:pointer;', o[1]);
      b.type = 'button';
      b.setAttribute('data-antcv-tense', o[0]);
      b.title = o[2];
      b.onclick = function () { writeTense(o[0]); paintActive(wrap); };
      row.appendChild(b);
    });
    wrap.appendChild(row);
    wrap.appendChild(el('div',
      'color:rgba(255,255,255,0.35);font-size:9px;margin-top:4px;line-height:1.4;',
      'Auto = present for the current role, past for earlier roles.'));
    paintActive(wrap);
    return wrap;
  }

  function inject() {
    try {
      // LANGUAGES-CARD-CONSOLIDATE-001 (1.50.537): the LanguageCard island now
      // hosts the Experience-tense control INSIDE its expand/collapse. When the
      // island is present, remove our standalone card + skip (no duplicate).
      if (document.querySelector('[data-antcv-react-island="language-card"]')) {
        var exTC = document.getElementById(HOST_ID); if (exTC) exTC.remove();
        return;
      }
      var langCard = document.getElementById('antcv-react-personal-languages');
      var existing = document.getElementById(HOST_ID);
      // TENSE-STICKY-FIX-001 (owner 2026-06-13): the control belongs ONLY to
      // the Personal subtab (it anchors on the languages card). If the
      // languages card is gone (any other subtab — Layout, etc.), REMOVE the
      // control so it is not sticky across tabs.
      if (!langCard || !langCard.parentElement) {
        if (existing) existing.remove();
        return;
      }
      var col = langCard.parentElement; // the order-based Personal flex column
      if (existing) {
        if (existing.parentElement !== col) { existing.remove(); }
        else { paintActive(existing); return; }
      }
      // PERSONAL-TAB-JANK-001 (owner 2026-06-18): EXPERIENCE TENSE now lives INSIDE
      // the LanguageCard island. When the islands bundle is loaded the island WILL
      // mount and host the control — so do NOT eagerly build a standalone card on
      // the early ticks (before the island paints) that then flashes and gets
      // removed (line ~108) when the island appears. That flash was part of the
      // Personal-subtab progressive-render cascade. Only build as a FALLBACK after
      // a grace period, if the island genuinely never mounted (islands disabled).
      if (!graceElapsed && document.querySelector('script[src*="antcv-react-islands"]')) return;
      col.appendChild(build());
    } catch (_) {}
  }

  var pending = false;
  var graceElapsed = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { inject(); } catch (_) {} }); }

  function boot() {
    schedule();
    // Single grace-period fallback (was a 120/300/700/1500/3000ms flood that each
    // tried to inject the standalone card before the island mounted).
    setTimeout(function () { graceElapsed = true; schedule(); }, 2800);
    try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
    window.addEventListener('antcv:exp-tense-changed', function () { var h = document.getElementById(HOST_ID); if (h) paintActive(h); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvTenseControl422 = { version: VERSION, _read: readTense, _write: writeTense, _inject: inject };
  try { console.debug('[tense-control-422] installed v' + VERSION); } catch (_) {}
})();
