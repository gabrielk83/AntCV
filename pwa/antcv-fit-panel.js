/* antcv-fit-panel.js — CLUSTER-QUAL-001 stage 3 (owner 2026-07-05)
 * ===========================================================================
 * Spec section 6 rollout step 6: "PWA: add a fit panel (score + matched/gaps)
 * on each application; show 'based on N jobs' confidence."
 *
 * This is the REAL, D1-backed fit score (stage 2a's computeApplicationFit,
 * access-relay) — the active application scored against its cluster's
 * current top-20 market-demand qualifications, with each qualification
 * marked matched (evidenced in the candidate's own kernel history) or a gap.
 * It is DELIBERATELY separate from the existing "Overall fit" section in
 * #antcv-analysis-report (antcv-analysis-report-pdf-360.js) — that one is an
 * LLM narrative judgement from the JD-analysis pass; this one is a
 * deterministic score against the user's own accumulated real-JD demand
 * data, so it is labelled distinctly ("Market fit") to avoid the two being
 * read as duplicates or contradicting each other.
 *
 * Data source: GET /api/prefs already returns active_application inline
 * (access-relay Phase B round trip) — stage 3 server-side work added a
 * `.fit` field to that SAME object (fetchApplicationFit), so this sidecar
 * makes no new endpoint call shape, it just reads one more field off a
 * fetch the app already needs for cloud restore.
 *
 * Rendering: additive DOM card inserted as a sibling right after
 * #antcv-analysis-report (the same anchor antcv-analysis-panel-jd-block-356.js
 * already targets for its own block) — never edits app.js, never touches the
 * printable/exportable report surface (in-app only, hidden from print/PDF).
 *
 * Kill switch: localStorage['antcv:disable-fit-panel'] = '1'.
 */
(function () {
  'use strict';

  var VERSION = '1.51.188';
  if (window.__antcvFitPanelInstalled === VERSION) return;
  window.__antcvFitPanelInstalled = VERSION;

  var KILL_SWITCH = 'antcv:disable-fit-panel';
  var CARD_ID = 'antcv-fit-panel';
  var STYLE_ID = 'antcv-fit-panel-css';
  var TTL_MS = 60 * 1000; // refetch at most once a minute while the panel is visible

  function killed() {
    try { return localStorage.getItem(KILL_SWITCH) === '1'; } catch (_) { return false; }
  }
  function readString(key, def) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return def || '';
      try { var p = JSON.parse(raw); return typeof p === 'string' ? p : String(raw); }
      catch (_) { return String(raw); }
    } catch (_) { return def || ''; }
  }
  function isDanish() { return /^da/i.test(readString('language', 'en')); }

  function T() {
    return isDanish() ? {
      title: 'Markedstilpasning', basedOn: function (n) { return 'Baseret på ' + n + ' job' + (n === 1 ? '' : 's') + ' i denne kategori'; },
      matched: 'Matchede kvalifikationer', gaps: 'Mangler (ikke dokumenteret endnu)',
      none: 'Ingen markedstilpasningsdata endnu — gemmes automatisk, når en JD er tilknyttet.',
      tiers: { T1: 'Stærk', T2: 'God', T3: 'Udviklende', T4: 'Begrænset' },
    } : {
      title: 'Market fit', basedOn: function (n) { return 'Based on ' + n + ' job' + (n === 1 ? '' : 's') + ' in this category'; },
      matched: 'Matched qualifications', gaps: 'Gaps (not yet evidenced)',
      none: 'No market-fit data yet — this fills in automatically once a JD is attached and saved.',
      tiers: { T1: 'Strong', T2: 'Good', T3: 'Developing', T4: 'Limited' },
    };
  }

  var TIER_COLOR = { T1: '#00746E', T2: '#2a8f6b', T3: '#b45309', T4: '#c0392b' };

  // ─── relay fetch (same pattern as antcv-fit-cv-cloud-sync.js) ────────
  function getRelayBase() {
    var v = '';
    try { v = String(localStorage.getItem('relayUrl') || ''); } catch (_) {}
    if (!v && typeof window !== 'undefined' && window.ANTCV_RELAY_URL) {
      v = String(window.ANTCV_RELAY_URL);
    }
    return v.replace(/\/+$/, '');
  }
  function getAuthToken() {
    try { return localStorage.getItem('antcv:auth:token') || ''; } catch (_) { return ''; }
  }

  var cache = { at: 0, fit: null };
  var inflight = null;
  function fetchFit() {
    if (killed()) return Promise.resolve(null);
    if (inflight) return inflight;
    inflight = (async function () {
      try {
        var base = getRelayBase();
        var token = getAuthToken();
        if (!base || !token) return null;
        var res = await window.fetch(base + '/api/prefs', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
        });
        if (!res.ok) return null;
        var body;
        try { body = await res.json(); } catch (_) { return null; }
        var aa = body && body.active_application;
        return (aa && aa.fit) || null;
      } catch (_) { return null; }
    })();
    inflight.then(function (fit) {
      cache = { at: +new Date(), fit: fit };
      inflight = null;
      render();
    }).catch(function () { inflight = null; });
    return inflight;
  }
  function maybeRefresh() {
    if (killed()) return;
    if (+new Date() - cache.at > TTL_MS) fetchFit();
  }

  // ─── rendering ────────────────────────────────────────────────────
  function injectStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;
    var css =
      '#' + CARD_ID + '{margin:14px 0;padding:14px 16px;border:1px solid #e2e2e2;border-radius:8px;' +
      'background:#fafafa;font-family:Trebuchet MS,Calibri,sans-serif;font-size:13px;color:#283556;}' +
      '#' + CARD_ID + ' h3{margin:0 0 6px;font-size:14px;font-weight:700;color:#283556;}' +
      '#' + CARD_ID + ' .afp-score{display:flex;align-items:center;gap:10px;margin-bottom:6px;}' +
      '#' + CARD_ID + ' .afp-pct{font-size:20px;font-weight:700;}' +
      '#' + CARD_ID + ' .afp-tier{padding:2px 10px;border-radius:10px;color:#fff;font-size:12px;font-weight:700;}' +
      '#' + CARD_ID + ' .afp-based{font-size:12px;color:#666;margin-bottom:10px;}' +
      '#' + CARD_ID + ' .afp-cols{display:flex;gap:18px;flex-wrap:wrap;}' +
      '#' + CARD_ID + ' .afp-col{flex:1 1 200px;min-width:180px;}' +
      '#' + CARD_ID + ' .afp-col h4{margin:0 0 4px;font-size:12px;font-weight:700;}' +
      '#' + CARD_ID + ' .afp-col ul{margin:0;padding-left:18px;}' +
      '#' + CARD_ID + ' .afp-col li{margin:2px 0;}' +
      '#' + CARD_ID + ' .afp-empty{color:#666;font-style:italic;}' +
      '@media print{#' + CARD_ID + '{display:none!important;}}';
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cardHtml(fit) {
    var t = T();
    if (!fit) {
      return '<h3>' + esc(t.title) + '</h3><div class="afp-empty">' + esc(t.none) + '</div>';
    }
    var tierLabel = t.tiers[fit.tier] || fit.tier || '';
    var tierColor = TIER_COLOR[fit.tier] || '#666';
    var matched = Array.isArray(fit.matched) ? fit.matched : [];
    var gaps = Array.isArray(fit.gaps) ? fit.gaps : [];
    var html = '<h3>' + esc(t.title) + '</h3>' +
      '<div class="afp-score"><span class="afp-pct">' + Math.round(fit.fit_score || 0) + '%</span>' +
      (tierLabel ? '<span class="afp-tier" style="background:' + tierColor + '">' + esc(tierLabel) + '</span>' : '') +
      '</div>' +
      '<div class="afp-based">' + esc(t.basedOn(fit.jd_count || 0)) + '</div>' +
      '<div class="afp-cols">';
    if (matched.length) {
      html += '<div class="afp-col"><h4 style="color:#00746E">' + esc(t.matched) + '</h4><ul>' +
        matched.map(function (m) { return '<li>' + esc(m) + '</li>'; }).join('') + '</ul></div>';
    }
    if (gaps.length) {
      html += '<div class="afp-col"><h4 style="color:#c0392b">' + esc(t.gaps) + '</h4><ul>' +
        gaps.map(function (g) { return '<li>' + esc(g) + '</li>'; }).join('') + '</ul></div>';
    }
    html += '</div>';
    return html;
  }

  // MARKET-FIT-UPPER-001 (owner 2026-07-05: "the market analysis you do
  // should also be in the upper analysis, not in the lower one"). This card
  // used to anchor after #antcv-analysis-report — the BOTTOM sidecar block,
  // landing it after Tailoring Decisions / Cover Letter Strategy, effectively
  // the last thing in the whole panel. #antcv-analysis-report-top is the
  // established "upper zone" anchor from ANALYSIS-PANEL-ORDER-001 (rendered
  // by antcv-analysis-report-pdf-360.js right after the native "Overall Fit"
  // section) — anchoring there instead puts Market Fit in the upper zone,
  // right where the owner wants it. Falls back to the bottom anchor so the
  // card still renders (rather than silently vanishing) on any older/partial
  // DOM state where the top block hasn't mounted yet.
  function findAnchor() {
    return document.getElementById('antcv-analysis-report-top') ||
      document.getElementById('antcv-analysis-report');
  }

  function render() {
    if (killed()) {
      var existing = document.getElementById(CARD_ID);
      if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    var anchor = findAnchor();
    if (!anchor || !anchor.parentNode) return;
    injectStylesOnce();
    var card = document.getElementById(CARD_ID);
    if (!card) {
      card = document.createElement('div');
      card.id = CARD_ID;
    }
    card.innerHTML = cardHtml(cache.fit);
    if (card.parentNode !== anchor.parentNode || card.previousElementSibling !== anchor) {
      anchor.parentNode.insertBefore(card, anchor.nextSibling);
    }
  }

  // ─── wiring ───────────────────────────────────────────────────────
  var debounce = null;
  var mo = new MutationObserver(function () {
    clearTimeout(debounce);
    debounce = setTimeout(function () {
      if (findAnchor()) { maybeRefresh(); render(); }
    }, 500);
  });
  function boot() {
    try { mo.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
    if (findAnchor()) { fetchFit(); render(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  // A fresh JD analysis merge means the server-side auto-save (debounced)
  // will likely recompute fit shortly after — poll a few times so the panel
  // catches the new score without a manual refresh.
  try {
    window.addEventListener('antcv:rationale-merge', function () {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        fetchFit();
        if (tries >= 6) clearInterval(iv); // ~24s of polling, then give up
      }, 4000);
    });
  } catch (_) {}

  window.AntcvFitPanel = {
    version: VERSION,
    refresh: fetchFit,
    render: render,
    _cardHtml: cardHtml,
    _findAnchor: findAnchor,
  };
  try { console.debug('[fit-panel] installed v' + VERSION); } catch (_) {}
})();
