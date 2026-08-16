/* antcv-style-page-budget.js — STYLE-PAGE-BUDGET-001 (owner 2026-07-10)
 * ============================================================================
 * Each WRITING STYLE now drives the CV's "Target CV length" (localStorage
 * ["pageBudget"], read by the generator at app.src.js ~25120) AND a per-style
 * order for the commercial main sections — the two things the owner said a
 * style is "supposed to have impact on": the Target-CV-length card and the
 * Commercial-sections panel.
 *
 * Before this, "Target CV length" was a purely manual dropdown (antcv-page-
 * budget.js) with no link to the style — so a "Credential Forward" targeted CV
 * had no reason to land on 1 page, and the ZF Group draft ran 4 pages. The CL
 * length card (antcv-cl-length-560.js) already reads the style (toneRegister);
 * this brings the CV to parity.
 *
 * DESIGN — act ONLY when the style CHANGES:
 *   - On first sight of a style we SEED it silently (no write) so an existing
 *     manual pageBudget / manual section order is never clobbered on load.
 *   - When the style changes to a NEW value we apply that style's default
 *     pageBudget + commercial-section order. After that the user can still
 *     hand-tune the dropdown or drag sections — we won't touch them again until
 *     the style changes once more. So "changing the style resets to that style's
 *     defaults; you then adjust freely."
 *
 * Idempotent, loop-safe (own-event ignore, act-on-change only), disable via
 *   localStorage['antcv:disable-style-page-budget'] = '1'
 * and independently for the reorder half:
 *   localStorage['antcv:disable-style-section-order'] = '1'
 */
(function () {
  'use strict';
  var VERSION = '1.1.0-targeted-page-budget';
  if (window.__antcvStylePageBudget === VERSION) return;
  window.__antcvStylePageBudget = VERSION;

  var SRC = 'style-page-budget';
  var LAST_KEY = 'antcv:stylePBLastStyle';

  function disabled() { try { var v = localStorage.getItem('antcv:disable-style-page-budget'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function orderDisabled() { try { var v = localStorage.getItem('antcv:disable-style-section-order'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // ─── Active writing style (mirrors antcv-cl-length-560.js) ───────────
  function currentStyle() {
    try { var tr = localStorage.getItem('toneRegister'); if (tr) { var v = JSON.parse(tr); if (typeof v === 'string' && v) return v; } } catch (_) {}
    try { var pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; return (pi.writingPrefs && pi.writingPrefs.style) || ''; } catch (_) { return ''; }
  }
  function normStyle(s) {
    s = String(s || '').trim().toLowerCase();
    // legacy aliases → canonical id
    if (s === 'indian') return 'credential-forward';
    if (s === 'direct') return 'measured-professional';
    if (s === 'formal') return 'structured-professional';
    if (s === 'scandinavian') return 'nordic-minimal';
    return s;
  }

  // ─── Per-style page cap (pages). Matches the dropdown steps 1 / 1.5 / 2 / 3.
  // Owner-confirmed 2026-07-10; research-formal (academic) is deliberately the
  // longest — an academic CV carries full publications/history, never squeezed.
  var STYLE_PAGE_BUDGET = {
    'credential-forward':     1,
    'cold-outreach':          1,
    'nordic-minimal':         1.5,
    'achievement-driven':     1.5,
    'measured-professional':  1.5,
    'precision-formal':       1.5,
    'hybrid-balanced':        1.5,
    'structured-professional': 2,
    'prestige-structured':    2,
    'mediterranean-formal':   2,
    'context-rich':           2,
    'research-formal':        3   // academic — full breadth
  };

  // ─── Per-style order for the COMMERCIAL MAIN sections only. Everything else
  // (experience roles, sidebar sections) keeps its position; we only permute
  // these five relative to each other, in whatever slots they already occupy.
  // Proposed defaults (adjust freely — this is the whole contract):
  var DEFAULT_ORDER = ['profile', 'work_style', 'core_comp', 'outcomes', 'foundation'];
  var STYLE_SECTION_ORDER = {
    'achievement-driven':     ['profile', 'outcomes', 'core_comp', 'work_style', 'foundation'], // lead with results
    'precision-formal':       ['profile', 'outcomes', 'core_comp', 'foundation', 'work_style'], // numbers forward
    'credential-forward':     ['profile', 'core_comp', 'foundation', 'outcomes', 'work_style'], // competencies/credentials early
    'prestige-structured':    ['profile', 'core_comp', 'outcomes', 'work_style', 'foundation'], // scope/weight early
    'structured-professional':['profile', 'core_comp', 'work_style', 'outcomes', 'foundation'], // method-led
    'research-formal':        ['profile', 'foundation', 'outcomes', 'core_comp', 'work_style'], // research base + outputs
    'context-rich':           ['profile', 'work_style', 'foundation', 'outcomes', 'core_comp'], // narrative arc
    'mediterranean-formal':   ['profile', 'work_style', 'core_comp', 'outcomes', 'foundation'],
    'nordic-minimal':         DEFAULT_ORDER,
    'measured-professional':  DEFAULT_ORDER,
    'hybrid-balanced':        DEFAULT_ORDER,
    'cold-outreach':          ['profile', 'core_comp', 'outcomes', 'work_style', 'foundation']  // tightest, value-first
  };
  var COMMERCIAL = DEFAULT_ORDER.slice();

  function setPageBudget(v) {
    try {
      localStorage.setItem('pageBudget', String(v));
      window.dispatchEvent(new CustomEvent('antcv:page-budget-changed', { detail: { value: v, source: SRC } }));
      return true;
    } catch (_) { return false; }
  }

  // Permute the commercial main sections in sections.cv into `order`, leaving all
  // other sections (and the non-listed commercial ones) exactly where they are.
  function applyOrder(order) {
    try {
      if (orderDisabled()) return;
      var raw = localStorage.getItem('sections');
      if (!raw) return;
      var secs = JSON.parse(raw);
      if (!secs || !Array.isArray(secs.cv)) return;
      var cv = secs.cv;
      // positions (indices) the commercial sections occupy, in document order
      var slots = [], byId = {};
      for (var i = 0; i < cv.length; i++) {
        var s = cv[i];
        if (s && COMMERCIAL.indexOf(s.id) >= 0) { slots.push(i); byId[s.id] = s; }
      }
      if (slots.length < 2) return;
      // desired sequence = requested order filtered to the ids actually present,
      // then any present commercial ids the order omitted (defensive), in default order
      var want = order.filter(function (id) { return byId[id]; });
      COMMERCIAL.forEach(function (id) { if (byId[id] && want.indexOf(id) < 0) want.push(id); });
      // already in this order? bail (no write, no loop)
      var cur = slots.map(function (idx) { return cv[idx].id; });
      if (cur.join('|') === want.join('|')) return;
      // write the wanted sequence back into the same slots
      for (var k = 0; k < slots.length; k++) cv[slots[k]] = byId[want[k]];
      localStorage.setItem('sections', JSON.stringify(secs));
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } }));
    } catch (_) { /* self-disable */ }
  }

  // TARGETED-PAGE-BUDGET-001 (1.51.4166, owner Nvidia critique item 9 /
  // generator rule 7): a TARGETED application (named, non-unsolicited company)
  // resolves to ~2 pages (gold-rules page_budgets.default) even when the
  // style's own default is shorter - the 4-page Nvidia CV class. Unsolicited
  // keeps the per-style value.
  var LAST_TGT_KEY = 'antcv:stylePBLastTargeted';
  function isTargeted() {
    try {
      var m = JSON.parse(localStorage.getItem('meta') || '{}') || {};
      var co = String(m.company || '').trim();
      if (!co || /^open application$/i.test(co)) return false;
      var re = window.__ANTCV_UNSOL_RE || /^unsolicited$/i;
      return !((typeof window.__antcvUnsol === 'function') ? window.__antcvUnsol(co) : re.test(co));
    } catch (_) { return false; }
  }
  function budgetFor(style, targeted) {
    var pb = STYLE_PAGE_BUDGET[style];
    if (targeted) pb = Math.max(typeof pb === 'number' ? pb : 0, 2);
    return pb;
  }
  function apply() {
    if (disabled()) return;
    var style = normStyle(currentStyle());
    if (!style) return;
    var tgt = isTargeted();
    var last = '', lastTgt = '';
    try { last = localStorage.getItem(LAST_KEY) || ''; } catch (_) {}
    try { lastTgt = localStorage.getItem(LAST_TGT_KEY) || ''; } catch (_) {}
    var tgtChanged = lastTgt !== '' && lastTgt !== String(tgt);
    if (style === last && !tgtChanged) {
      if (lastTgt === '') { try { localStorage.setItem(LAST_TGT_KEY, String(tgt)); } catch (_) {} }
      return;                              // unchanged → respect any manual tuning
    }
    var firstSight = !last;
    try { localStorage.setItem(LAST_KEY, style); } catch (_) {}
    try { localStorage.setItem(LAST_TGT_KEY, String(tgt)); } catch (_) {}
    if (firstSight) return;                // seed only — never clobber existing manual settings on load
    // style (or targeted-ness) genuinely CHANGED → apply the resolved default
    var pb = budgetFor(style, tgt);
    if (typeof pb === 'number') setPageBudget(pb);
    var ord = STYLE_SECTION_ORDER[style] || DEFAULT_ORDER;
    applyOrder(ord);
    try { console.info('[style-page-budget] style "' + style + '" (targeted=' + tgt + ') → ' + (pb || '?') + 'pp, commercial order applied'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }
  [400, 1200, 3000].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'toneRegister' || e.key === 'personalInfo' || e.key === null) tick(); }); } catch (_) {}
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  // also poll: the style select doesn't emit a storage event in the same tab
  setInterval(tick, 4000);

  window.AntcvStylePageBudget = {
    version: VERSION,
    _apply: apply,
    _budgetFor: function (s) { return STYLE_PAGE_BUDGET[normStyle(s)]; },
    _resolvedBudgetFor: function (s) { return budgetFor(normStyle(s), isTargeted()); },
    _isTargeted: isTargeted,
    _orderFor: function (s) { return STYLE_SECTION_ORDER[normStyle(s)] || DEFAULT_ORDER; },
    _budgets: STYLE_PAGE_BUDGET,
    _orders: STYLE_SECTION_ORDER
  };
})();
