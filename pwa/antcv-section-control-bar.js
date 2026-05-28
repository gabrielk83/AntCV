/* AntCV shared SectionControlBar (v1.40.341-p0a)
 * ============================================================
 *
 * Phase P0-A of the UI/UX bugfix plan. Provides ONE component
 * that downstream phases mount everywhere a row-level control
 * cluster currently exists (Core Competencies, What I Bring,
 * Selected Outcomes, Publications, How I Would Contribute,
 * Foundation textboxes, table rows, sidebar items, body rows).
 *
 * Goal: stop fixing the same defect in 7+ different overlays.
 * The bug surface collapses to one component; per-section
 * differences become a `capabilities` prop.
 *
 * GEN-001..GEN-008 contract (see docs/plan/UI_UX_Bugfix_Implementation_and_QA.md §4.1)
 * ------------------------------------------------------------
 *   GEN-002: every action event carries `itemId`. Events without
 *            one are rejected and logged. Mechanical enforcement
 *            of "control on row N cannot mutate row N±1".
 *   GEN-003: standard render order — [Move] PB CJLR Enhance Fit [Delete].
 *            Move only if movable; Delete only if deletable.
 *   GEN-004: "Fit" wording; "Compress" is never produced here.
 *   GEN-006: flex-wrap layout; controls never clip at narrow widths.
 *   GEN-008: deterministic tooltip + aria-label naming action + target.
 *            Example: "Page break for Bullet 3 in Sirin Labs role".
 *
 * Mount API
 * ------------------------------------------------------------
 *   const unmount = window.SectionControlBar.mount(hostEl, {
 *     itemId:      'experience.role-1.bullet-3',   // required, unique
 *     itemType:    'bullet',                        // for testid + i18n
 *     itemLabel:   'Bullet 3 in Sirin Labs role',   // for aria/tooltip
 *     capabilities: {
 *       move:      true,    // or { destinations: [...] } if known
 *       pageBreak: true,
 *       align:     true,    // CJLR
 *       enhance:   true,
 *       fit:       true,
 *       delete:    true,
 *     },
 *     state: {
 *       pageBreakActive: false,
 *       page:            1,            // 1..4
 *       alignment:       'left',       // left|center|justify|right
 *     },
 *     onAction: function ({ itemId, action, payload }) { ... },
 *     i18n:  { locale: 'en' },         // optional; falls back to lang LS
 *   });
 *
 *   // Later: re-render with new state
 *   unmount.update({ state: { pageBreakActive: true, page: 2 }});
 *
 *   // Or remove entirely
 *   unmount();
 *
 * Action contract
 * ------------------------------------------------------------
 *   onAction is invoked with:
 *     { itemId: <string>, action: <kind>, payload?: <any> }
 *
 *   action ∈ { 'move', 'page-break', 'align-cycle', 'enhance', 'fit', 'delete' }
 *
 *   The component never mutates state on the caller's behalf —
 *   the caller's onAction handler is responsible for applying the
 *   change to the document model and calling `update()` to refresh
 *   the bar's displayed state. This decoupling is what enforces
 *   GEN-001 (single model, no DOM-only state).
 *
 *   For 'align-cycle', payload.next is the next alignment in the
 *   left → center → justify → right → left cycle.
 *
 * Hazard compliance (CLAUDE.md §5)
 * ------------------------------------------------------------
 *   - No `\s` in regex literals (no regex used at all).
 *   - No `\u` Unicode escapes anywhere.
 *   - Comment stripper only strips standalone `//` lines.
 *   - The mount function is the sole entry point; no fetch wrapping
 *     and no MutationObserver — downstream sidecars own their
 *     lifecycles.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0a';
  if (window.__antcvSectionControlBarInstalled === SCRIPT_VERSION) return;
  window.__antcvSectionControlBarInstalled = SCRIPT_VERSION;

  // ─── Constants ───────────────────────────────────────────────────

  // Standard order per GEN-003. Lower order renders first.
  var ACTION_ORDER = {
    'move':        10,
    'page-break':  20,
    'align-cycle': 30,
    'enhance':     40,
    'fit':         50,
    'delete':      60,
  };

  var ALIGN_CYCLE = ['left', 'center', 'justify', 'right'];

  // ─── Brand colours (v1.50.18) ────────────────────────────────────
  //
  // The SectionControlBar is UI chrome — these colours stay consistent
  // regardless of which visual package the user has applied to the CV
  // they're editing. Centralised here so future tweaks (rebrand, action
  // colour shifts) are one-file edits rather than 14-site search-and-
  // replace. The hex values themselves are unchanged from the inline
  // literals they replaced; no visual change at runtime.
  //
  // Token convention:
  //   accent           — AntCV bright teal, ubiquitous brand border
  //   accentDeep       — AntCV deep teal, primary button text
  //   warning          — Enhance action border (orange)
  //   warningText      — Enhance action text (deep orange)
  //   info             — Fit action (purple, matches the per-row Fit
  //                       icon used across the row-controls sidecars)
  //   danger           — Delete action border (red)
  //   dangerText       — Delete action text (deep red)
  var BRAND = {
    accent:      '#01B7BB',
    accentDeep:  '#00746E',
    warning:     '#ff8a00',
    warningText: '#a04a00',
    info:        '#7b2ff2',
    danger:      '#dc2626',
    dangerText:  '#b91c1c',
  };

  // Glyphs — keep in sync with existing sidecars (publications-273,
  // selected-outcomes-237, what-i-bring-327). Changing these would
  // require updating the classifier patterns in those sidecars during
  // P1-B migration.
  var GLYPH = {
    'move':         '☰',
    'page-break':   '📄',  // 📄  (used elsewhere with appended page number)
    'align-left':   '⇤',         // ⇤
    'align-center': '↔',         // ↔
    'align-justify':'☰',         // ☰  (different visual context — pre-existing convention)
    'align-right':  '⇥',         // ⇥
    'enhance':      '✨',         // ✨
    'fit':          '⇥⇤',   // ⇥⇤
    'delete':       '✕',         // ✕
  };

  // ─── i18n ────────────────────────────────────────────────────────
  // Self-contained EN + DA strings. Falls back to EN if locale unknown.
  // Action verbs are written for the deterministic tooltip template
  // (GEN-008): "<verb> for <itemLabel>".

  var I18N = {
    en: {
      'move':        'Move',
      'page-break':  'Page break',
      'align-cycle': 'Align',
      'enhance':     'Enhance',
      'fit':         'Fit',
      'delete':      'Delete',
      'align-left':    'Align left',
      'align-center':  'Align center',
      'align-justify': 'Justify',
      'align-right':   'Align right',
      'untitled-item': 'item',
      'for-target':    'for',
    },
    da: {
      'move':        'Flyt',
      'page-break':  'Sideskift',
      'align-cycle': 'Justering',
      'enhance':     'Forbedr',
      'fit':         'Tilpas',
      'delete':      'Slet',
      'align-left':    'Venstrejustering',
      'align-center':  'Centrering',
      'align-justify': 'Lige margener',
      'align-right':   'Højrejustering',
      'untitled-item': 'element',
      'for-target':    'for',
    },
  };

  function readLocale() {
    try {
      var v = localStorage.getItem('lang');
      if (v === 'da' || v === 'en') return v;
    } catch (_) {}
    return 'en';
  }

  function t(locale, key) {
    var table = I18N[locale] || I18N.en;
    return table[key] || I18N.en[key] || key;
  }

  // ─── Validation ──────────────────────────────────────────────────

  // GEN-002: events without an itemId are rejected with a console
  // warning. Returns true if the dispatch is allowed.
  function validateDispatch(eventDetail) {
    if (!eventDetail || typeof eventDetail !== 'object') {
      try { console.warn('[section-control-bar] rejected dispatch: detail not an object', eventDetail); } catch (_) {}
      return false;
    }
    if (typeof eventDetail.itemId !== 'string' || !eventDetail.itemId) {
      try { console.warn('[section-control-bar] rejected dispatch: missing itemId', eventDetail); } catch (_) {}
      return false;
    }
    if (typeof eventDetail.action !== 'string' || !eventDetail.action) {
      try { console.warn('[section-control-bar] rejected dispatch: missing action', eventDetail); } catch (_) {}
      return false;
    }
    return true;
  }

  // ─── Layout primitives ───────────────────────────────────────────

  function makeHostSpan(testIdPrefix) {
    var span = document.createElement('span');
    span.setAttribute('data-antcv-control-bar', '1');
    if (testIdPrefix) span.setAttribute('data-testid', testIdPrefix + '.bar');
    // Flex with wrap so we never clip at narrow widths (GEN-006).
    // gap is small to keep clusters tight; align-items center so icons
    // line up with adjacent text fields.
    span.style.display = 'inline-flex';
    span.style.flexWrap = 'wrap';
    span.style.alignItems = 'center';
    span.style.gap = '2px';
    span.style.whiteSpace = 'normal';
    span.style.boxSizing = 'border-box';
    span.style.maxWidth = '100%';
    return span;
  }

  function makeButton(action, opts) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-antcv-control', action);
    btn.setAttribute('data-antcv-control-item', opts.itemId);
    if (opts.testIdPrefix) {
      btn.setAttribute('data-testid', opts.testIdPrefix + '.' + action);
    }
    // Style: matches the size/colour conventions used by the existing
    // row-control sidecars (23px square, 5px radius). The colours are
    // muted neutrals — visual styling can be tuned per-section by
    // setting CSS rules against `[data-antcv-control="<action>"]` in
    // a downstream sidecar; the component does not own theming.
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.width  = '23px';
    btn.style.minWidth = '23px';
    btn.style.maxWidth = '23px';
    btn.style.height = '22px';
    btn.style.minHeight = '22px';
    btn.style.padding = '0';
    btn.style.margin = '0';
    btn.style.borderRadius = '5px';
    btn.style.fontSize = '12px';
    btn.style.lineHeight = '1';
    btn.style.fontWeight = '700';
    btn.style.cursor = 'pointer';
    btn.style.boxSizing = 'border-box';
    btn.style.flex = '0 0 auto';
    btn.style.position = 'static';
    btn.style.float = 'none';
    btn.style.background = 'rgba(1,183,187,0.08)';
    btn.style.color = BRAND.accentDeep;
    btn.style.border = '1px solid ' + BRAND.accent;
    btn.style.order = String(ACTION_ORDER[action] || 99);
    return btn;
  }

  // ─── Per-action rendering ────────────────────────────────────────

  function tooltipText(locale, verbKey, itemLabel) {
    var verb = t(locale, verbKey);
    var target = itemLabel || t(locale, 'untitled-item');
    return verb + ' ' + t(locale, 'for-target') + ' ' + target;
  }

  function paintPageBreak(btn, state, locale, itemLabel) {
    var n = state && typeof state.page === 'number' ? state.page : 1;
    if (n < 1 || n > 4) n = 1;
    btn.textContent = GLYPH['page-break'] + String(n);
    btn.style.width = '30px';
    btn.style.minWidth = '30px';
    btn.style.maxWidth = '30px';
    btn.style.fontSize = '10px';
    if (state && state.pageBreakActive) {
      btn.style.background = 'rgba(255,138,0,0.18)';
      btn.style.borderColor = BRAND.warning;
      btn.style.color = BRAND.warningText;
    }
    var verb = tooltipText(locale, 'page-break', itemLabel);
    btn.title = verb + ' (page ' + n + '/4 — click to cycle)';
    btn.setAttribute('aria-label', verb);
    btn.setAttribute('aria-pressed', state && state.pageBreakActive ? 'true' : 'false');
  }

  function alignKey(alignment) {
    if (alignment === 'center')  return 'align-center';
    if (alignment === 'justify') return 'align-justify';
    if (alignment === 'right')   return 'align-right';
    return 'align-left';
  }

  function paintAlign(btn, state, locale, itemLabel) {
    var a = state && state.alignment;
    if (ALIGN_CYCLE.indexOf(a) < 0) a = 'left';
    var key = alignKey(a);
    btn.textContent = GLYPH[key];
    // Tooltip names the CURRENT alignment + cycling hint.
    var verb = t(locale, key);
    btn.title = verb + ' — ' + tooltipText(locale, 'align-cycle', itemLabel) + ' (click to cycle)';
    btn.setAttribute('aria-label', verb + ' (' + tooltipText(locale, 'align-cycle', itemLabel) + ')');
    btn.setAttribute('data-antcv-alignment', a);
  }

  function paintSimple(btn, actionKey, locale, itemLabel) {
    btn.textContent = GLYPH[actionKey];
    var verb = tooltipText(locale, actionKey, itemLabel);
    btn.title = verb;
    btn.setAttribute('aria-label', verb);
  }

  function paintDelete(btn, locale, itemLabel) {
    paintSimple(btn, 'delete', locale, itemLabel);
    btn.style.background = 'rgba(220,38,38,0.06)';
    btn.style.borderColor = BRAND.danger;
    btn.style.color = BRAND.dangerText;
  }

  // ─── Mount ───────────────────────────────────────────────────────

  function mount(hostEl, opts) {
    if (!hostEl || hostEl.nodeType !== 1) {
      try { console.warn('[section-control-bar] mount called without a valid host element', hostEl); } catch (_) {}
      return function noop() {};
    }
    if (!opts || typeof opts !== 'object') {
      try { console.warn('[section-control-bar] mount called without options'); } catch (_) {}
      return function noop() {};
    }
    if (typeof opts.itemId !== 'string' || !opts.itemId) {
      try { console.warn('[section-control-bar] mount called without itemId; refusing (GEN-002)'); } catch (_) {}
      return function noop() {};
    }

    var itemId = opts.itemId;
    var itemType = opts.itemType || 'item';
    var itemLabel = opts.itemLabel || '';
    var capabilities = opts.capabilities || {};
    var state = opts.state || {};
    var onAction = typeof opts.onAction === 'function' ? opts.onAction : null;
    var locale = (opts.i18n && opts.i18n.locale) || readLocale();
    var testIdPrefix = itemType + '.' + itemId;

    // Build the host span.
    var bar = makeHostSpan(testIdPrefix);
    bar.setAttribute('data-antcv-control-item', itemId);
    bar.setAttribute('data-antcv-control-item-type', itemType);

    // Track buttons so update() can re-paint without re-creating.
    var buttons = {};

    function dispatch(action, payload) {
      var detail = { itemId: itemId, action: action };
      if (payload !== undefined) detail.payload = payload;
      if (!validateDispatch(detail)) return;
      if (onAction) {
        try { onAction(detail); } catch (e) {
          try { console.error('[section-control-bar] onAction threw:', e && e.message || e); } catch (_) {}
        }
      }
      // Also fire as a CustomEvent so non-callback listeners can pick it up.
      try {
        window.dispatchEvent(new CustomEvent('antcv:section-control-action', { detail: detail }));
      } catch (_) {}
    }

    function appendButton(action, paintFn, clickFn) {
      var btn = makeButton(action, { itemId: itemId, testIdPrefix: testIdPrefix });
      buttons[action] = btn;
      paintFn(btn);
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        clickFn(btn);
      });
      bar.appendChild(btn);
    }

    // Render in standard order. Skip any action whose capability flag
    // is falsy. The flex `order` style guarantees visual ordering even
    // if we appended in a different sequence — but we still append in
    // order to keep DOM tab-order natural.

    if (capabilities.move) {
      appendButton('move',
        function (b) { paintSimple(b, 'move', locale, itemLabel); },
        function ()  { dispatch('move'); });
    }

    if (capabilities.pageBreak) {
      appendButton('page-break',
        function (b) { paintPageBreak(b, state, locale, itemLabel); },
        function () {
          // Caller is responsible for advancing page number; we just
          // signal intent. Pass current page so caller can decide.
          dispatch('page-break', { currentPage: state.page || 1, currentActive: !!state.pageBreakActive });
        });
    }

    if (capabilities.align) {
      appendButton('align-cycle',
        function (b) { paintAlign(b, state, locale, itemLabel); },
        function () {
          var cur = state.alignment;
          if (ALIGN_CYCLE.indexOf(cur) < 0) cur = 'left';
          var next = ALIGN_CYCLE[(ALIGN_CYCLE.indexOf(cur) + 1) % ALIGN_CYCLE.length];
          dispatch('align-cycle', { from: cur, next: next });
        });
    }

    if (capabilities.enhance) {
      appendButton('enhance',
        function (b) {
          paintSimple(b, 'enhance', locale, itemLabel);
          b.style.background = 'rgba(255,138,0,0.08)';
          b.style.borderColor = BRAND.warning;
          b.style.color = BRAND.warningText;
        },
        function () { dispatch('enhance'); });
    }

    if (capabilities.fit) {
      appendButton('fit',
        function (b) {
          paintSimple(b, 'fit', locale, itemLabel);
          b.style.background = 'rgba(123,47,242,0.06)';
          b.style.borderColor = BRAND.info;
          b.style.color = BRAND.info;
        },
        function () { dispatch('fit'); });
    }

    if (capabilities.delete) {
      appendButton('delete',
        function (b) { paintDelete(b, locale, itemLabel); },
        function () { dispatch('delete'); });
    }

    hostEl.appendChild(bar);

    function update(nextOpts) {
      if (!nextOpts || typeof nextOpts !== 'object') return;
      if (nextOpts.state) state = nextOpts.state;
      if (nextOpts.itemLabel !== undefined) itemLabel = nextOpts.itemLabel || '';
      if (nextOpts.i18n && nextOpts.i18n.locale) locale = nextOpts.i18n.locale;
      // Re-paint each button against the new state.
      if (buttons['page-break'])  paintPageBreak(buttons['page-break'], state, locale, itemLabel);
      if (buttons['align-cycle']) paintAlign(buttons['align-cycle'], state, locale, itemLabel);
      if (buttons['move'])    paintSimple(buttons['move'], 'move', locale, itemLabel);
      if (buttons['enhance']) {
        paintSimple(buttons['enhance'], 'enhance', locale, itemLabel);
        buttons['enhance'].style.background = 'rgba(255,138,0,0.08)';
        buttons['enhance'].style.borderColor = BRAND.warning;
        buttons['enhance'].style.color = BRAND.warningText;
      }
      if (buttons['fit']) {
        paintSimple(buttons['fit'], 'fit', locale, itemLabel);
        buttons['fit'].style.background = 'rgba(123,47,242,0.06)';
        buttons['fit'].style.borderColor = BRAND.info;
        buttons['fit'].style.color = BRAND.info;
      }
      if (buttons['delete']) paintDelete(buttons['delete'], locale, itemLabel);
    }

    function unmount() {
      try { if (bar.parentNode) bar.parentNode.removeChild(bar); } catch (_) {}
      buttons = {};
    }
    unmount.update = update;
    unmount.bar = bar;
    return unmount;
  }

  // ─── Public API ──────────────────────────────────────────────────

  window.SectionControlBar = {
    version: SCRIPT_VERSION,
    mount: mount,
    // Exposed for tests + downstream sidecars that want to share the
    // same constants.
    _ACTION_ORDER: ACTION_ORDER,
    _ALIGN_CYCLE: ALIGN_CYCLE,
    _GLYPH: GLYPH,
    _validateDispatch: validateDispatch,
    _tooltipText: tooltipText,
  };

  try { console.debug('[section-control-bar] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
