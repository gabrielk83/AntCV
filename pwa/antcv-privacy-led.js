/**
 * antcv-privacy-led.js — privacy LED FAB below the fusion button
 *
 * Background
 * ──────────
 * `app.js` already maintains a privacy LED state in localStorage
 * under `antcv:privacy:led`:
 *
 *   {
 *     worst: 0..3,         // max level seen this session
 *     calls: number,       // total LLM calls observed
 *     byProvider: {        // per-provider breakdown
 *       claude: { count, maxLevel, lastTask },
 *       openai: { ... },
 *       ...
 *     },
 *     lastTs: ISO string,
 *   }
 *
 * It exposes two global APIs:
 *
 *   window.__antcvUpdatePrivacyLED({ level, provider, task })
 *   window.__antcvResetPrivacyLED()
 *
 * But there is no UI rendering this state, and the update API has no
 * callers yet. This sidecar adds:
 *
 *   1. A FAB rendered into the overlay stack (below the 🔀 fusion
 *      button) whose icon and border-colour reflect the current
 *      worst level.
 *   2. A click-to-open popover showing the totals, the per-provider
 *      breakdown, the last-activity timestamp, and a reset button.
 *   3. A lightweight `fetch` instrumentation that classifies outgoing
 *      requests and calls __antcvUpdatePrivacyLED so the LED reflects
 *      real activity. Classification:
 *        - Direct LLM API (api.anthropic.com, api.openai.com, etc.)
 *          → level 3
 *        - Configured user proxyUrl (own infrastructure) → level 1
 *        - Other workers.dev hosts (likely demo proxy) → level 2
 *        - Everything else (analytics, relay, drive, etc.) → ignored
 *
 * Level semantics (top to bottom = more concerning):
 *   0  Local only — no LLM calls observed.
 *   1  Private — LLM calls went through your own proxy.
 *   2  Demo proxy — LLM calls went through a shared/demo proxy.
 *   3  Direct third-party — LLM calls went directly to a third-party
 *      provider with no proxy in between.
 *
 * `worst` is the max across all observed calls, so once a session
 * sees a level-3 call it stays at 3 until reset.
 *
 * Contrast note (v1.40.296)
 * ─────────────────────────
 * After the FAB was relocated into the dark (#283556) top bar by
 * antcv-topbar-tools-347, the level-0 "Local only" appearance — a 6%
 * teal tint on a teal border — was effectively invisible against the
 * navy background. The glyph and dot were the only visible parts and
 * they read as faint. Each level now carries an explicit `fg`
 * (foreground/glyph colour) plus a higher-opacity, SOLID tint chosen
 * to sit legibly on the navy top bar. Level 0 in particular uses a
 * filled teal chip with a white shield glyph and a white dot ring so
 * "Local only" is clearly visible at a glance.
 */

(function () {
  'use strict';

  const SCRIPT_VERSION = '1.50.364-doc-worker-exempt';
  const STORAGE_KEY = 'antcv:privacy:led';
  const FAB_MARKER = 'data-antcv-privacy-led-fab';
  const STYLE_ID = 'antcv-privacy-led-styles';
  const POPOVER_ID = 'antcv-privacy-led-popover';

  // ─── State + storage ──────────────────────────────────────────────

  const DEFAULT_STATE = Object.freeze({
    worst: 0,
    calls: 0,
    byProvider: {},
    lastTs: null,
  });

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_STATE, byProvider: {} };
      const parsed = JSON.parse(raw);
      return {
        worst: Number(parsed.worst) || 0,
        calls: Number(parsed.calls) || 0,
        byProvider: parsed.byProvider && typeof parsed.byProvider === 'object'
          ? parsed.byProvider : {},
        lastTs: parsed.lastTs || null,
      };
    } catch (_) {
      return { ...DEFAULT_STATE, byProvider: {} };
    }
  }

  // ─── Level palette ────────────────────────────────────────────────
  //
  // v1.40.296 — each level now carries:
  //   border : ring / accent colour
  //   tint   : SOLID fill behind the glyph (chosen to read on the dark
  //            #283556 top bar — no more 6% wash that vanished)
  //   fg     : glyph + dot colour, picked for contrast against `tint`
  //   dotRing: colour of the 1.5px ring around the status dot
  //
  // Level 0 ("Local only") is the common case and was the one that
  // disappeared into the navy bar, so it gets the strongest treatment:
  // a filled teal chip with a white shield and white dot ring.
  function levelInfo(level) {
    const n = Number(level) || 0;
    if (n <= 0) return {
      glyph: '🛡',
      label: 'Local only',
      detail: 'No LLM calls observed this session.',
      border: '#01B7BB',
      tint: '#01B7BB',          // solid teal chip — visible on navy
      fg: '#ffffff',            // white shield glyph
      dotRing: '#ffffff',
    };
    if (n === 1) return {
      glyph: '🛡',
      label: 'Private',
      detail: 'LLM calls went through your own proxy.',
      border: '#10b981',
      tint: '#10b981',          // solid emerald chip
      fg: '#ffffff',
      dotRing: '#ffffff',
    };
    if (n === 2) return {
      glyph: '⚠',
      label: 'Demo proxy',
      detail: 'LLM calls went through a shared / demo proxy.',
      border: '#f59e0b',
      tint: '#f59e0b',          // solid amber chip
      fg: '#1a2433',            // dark glyph reads better on amber
      dotRing: '#ffffff',
    };
    return {
      glyph: '⚠',
      label: 'Direct third-party',
      detail: 'LLM calls went directly to a third-party provider.',
      border: '#dc2626',
      tint: '#dc2626',          // solid red chip
      fg: '#ffffff',
      dotRing: '#ffffff',
    };
  }

  // ─── Styles ───────────────────────────────────────────────────────

  function injectStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      /* The FAB inherits .antcv-fab sizing from antcv-overlay.js; we
         only override colour and add a small level badge. v1.40.296:
         a subtle outline keeps the filled chip legible even when it
         lands on a light surface (e.g. before relocation into the
         navy top bar). */
      .antcv-fab[${FAB_MARKER}="1"] {
        position: relative;
        font-size: 18px;
        line-height: 1;
        font-weight: 700;
        /* v1.50.74 — background-color is deliberately NOT transitioned. A
           transitioned fill cross-fades whenever the colour is re-asserted
           (the 2s refresh, or a relocation sidecar re-styling), which read as
           a pulsing "bleep" on the top-bar pill. Border/glyph still fade. */
        transition: border-color 0.15s ease, color 0.15s ease;
      }
      .antcv-fab[${FAB_MARKER}="1"] .antcv-privacy-dot {
        position: absolute;
        right: 2px;
        bottom: 2px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1.5px solid #fff;
        box-sizing: border-box;
      }

      #${POPOVER_ID} {
        position: fixed;
        z-index: 2600;
        max-width: 320px;
        min-width: 240px;
        background: #fff;
        color: #283556;
        border: 1px solid #283556;
        border-radius: 8px;
        padding: 14px 16px;
        font-family: Calibri, Arial, sans-serif;
        font-size: 12px;
        line-height: 1.45;
        box-shadow: 0 8px 24px rgba(40,53,86,0.25);
      }
      #${POPOVER_ID} .antcv-pl-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 6px;
      }
      #${POPOVER_ID} h3 {
        margin: 0 0 6px 0;
        font-size: 14px;
        color: #283556;
      }
      #${POPOVER_ID} .antcv-pl-status {
        font-weight: 700;
        margin-bottom: 4px;
      }
      #${POPOVER_ID} .antcv-pl-detail {
        color: #555;
        margin-bottom: 12px;
      }
      #${POPOVER_ID} .antcv-pl-provider {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        padding: 3px 0;
        border-top: 1px solid #eee;
      }
      #${POPOVER_ID} .antcv-pl-provider:first-child {
        border-top: none;
      }
      #${POPOVER_ID} .antcv-pl-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 12px;
      }
      #${POPOVER_ID} button.antcv-pl-btn {
        background: #fff;
        color: #283556;
        border: 1px solid #283556;
        border-radius: 4px;
        padding: 5px 10px;
        font-family: Calibri, Arial, sans-serif;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }
      #${POPOVER_ID} button.antcv-pl-btn:hover {
        background: #f0f4f8;
      }
      #${POPOVER_ID} button.antcv-pl-btn-danger {
        color: #b8001f;
        border-color: #b8001f;
      }
      #${POPOVER_ID} button.antcv-pl-btn-danger:hover {
        background: #fff0f1;
      }

      @media print {
        .antcv-fab[${FAB_MARKER}="1"], #${POPOVER_ID} { display: none !important; }
      }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── FAB rendering ────────────────────────────────────────────────

  let fabEl = null;
  // v1.40.295: timestamp at which the popover was last opened. Used as
  // a grace window in onPopoverOutside so a spurious mousedown firing
  // within the same event-loop tick as the opening click (common on
  // touch devices and when synthesised events arrive after a tap) does
  // not immediately close the just-opened popover.
  let _popoverOpenedAt = 0;
  // How long to ignore outside-clicks after open (milliseconds).
  const OPEN_GRACE_MS = 250;

  function buildFab() {
    const btn = document.createElement('button');
    btn.className = 'antcv-fab';
    btn.type = 'button';
    btn.setAttribute(FAB_MARKER, '1');
    btn.setAttribute('aria-label', 'Privacy status');
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      togglePopover(btn);
    });
    const dot = document.createElement('span');
    dot.className = 'antcv-privacy-dot';
    btn.appendChild(dot);
    refreshFabAppearance(btn);
    return btn;
  }

  function refreshFabAppearance(btn) {
    const target = btn || fabEl;
    if (!target) return;
    const state = readState();
    const info = levelInfo(state.worst);
    // v1.50.74 — idempotency guard. The 2s interval (and MutationObserver-
    // driven re-checks) call this constantly; without a guard each call
    // rewrote textContent, detached/re-appended the dot, and re-asserted the
    // fill every tick — a needless repaint that read as a flicker/"bleep".
    // Skip all DOM writes when the visible appearance is unchanged. A fresh
    // element (no signature) always paints; real level/calls changes repaint.
    // PRIVACY-FAB-COLOR-001 (owner 2026-06-12): on MOBILE the platform's
    // COLOUR emoji shield (white/red segments) screamed against the chip.
    // Render the glyph as a single-colour silhouette there: transparent
    // text + a text-shadow in the chip's fg colour (the portable
    // monochrome-emoji technique). Desktop keeps the native glyph.
    const mono = (function () {
      try { return window.matchMedia && window.matchMedia('(max-width: 900px)').matches; } catch (_) { return false; }
    })();
    const sig = state.worst + '|' + info.glyph + '|' + (state.calls || 0) + '|' + (mono ? 'm' : 'd');
    if (target.getAttribute('data-antcv-pl-sig') === sig) return;
    target.setAttribute('data-antcv-pl-sig', sig);
    // Clear textContent but preserve the dot child.
    const dot = target.querySelector('.antcv-privacy-dot');
    target.textContent = '';
    const glyphEl = document.createElement('span');
    glyphEl.className = 'antcv-privacy-glyph';
    glyphEl.textContent = info.glyph;
    if (mono) {
      glyphEl.style.color = 'transparent';
      glyphEl.style.textShadow = '0 0 0 ' + (info.fg || '#ffffff');
    }
    target.appendChild(glyphEl);
    if (dot) target.appendChild(dot); // textContent wiped it; re-append
    else {
      const newDot = document.createElement('span');
      newDot.className = 'antcv-privacy-dot';
      target.appendChild(newDot);
    }
    // v1.40.296: drive border, SOLID fill, and glyph colour from the
    // palette so the chip is legible on the dark top bar. setProperty
    // with priority keeps these ahead of any inline styling that the
    // top-bar relocation sidecar applies.
    target.style.setProperty('border-color', info.border, 'important');
    target.style.setProperty('background', info.tint, 'important');
    target.style.setProperty('color', info.fg || '#ffffff', 'important');
    const dotEl = target.querySelector('.antcv-privacy-dot');
    if (dotEl) {
      dotEl.style.background = info.fg || info.border;
      dotEl.style.borderColor = info.dotRing || '#ffffff';
    }
    target.title = info.label + ' — ' + info.detail
      + (state.calls ? ' (' + state.calls + ' calls)' : '');
  }

  // The overlay container `.antcv-overlay-bottom-right` is flex-column,
  // so appending makes the new FAB stack at the bottom — i.e. below
  // the existing 🔀 fusion FAB which was the previous last child.
  function ensureFab() {
    const existing = document.querySelector('.antcv-fab[' + FAB_MARKER + '="1"]');
    if (existing) {
      // Don't call refreshFabAppearance here — it mutates DOM which
      // would re-trigger the MutationObserver and create a feedback
      // loop. The periodic interval in init() handles refresh.
      fabEl = existing;
      return;
    }
    // PRIVACY-DEMO-001 / PRIVACY-FAB-FLICKER-MOBILE-001 (1.50.356): the
    // overlay stack is not always mounted (demo mode, mobile states,
    // Settings open). The pill's real home is the top bar anyway —
    // topbar-tools-347 re-parents it there — and a top-bar React re-render
    // destroys the foreign button. With only the overlay as a mount host
    // the pill could then never come back until the overlay remounted
    // ("disappears until toggling the editor"). Fall back to mounting
    // straight into .antcv-top-tools so recreation works wherever the top
    // bar exists; 347's sweep re-styles it for the top bar either way.
    const container = document.querySelector('.antcv-overlay-bottom-right')
      || document.querySelector('.antcv-top-tools');
    if (!container) return; // neither host mounted yet; observer will retry
    fabEl = buildFab();
    container.appendChild(fabEl);
  }

  // ─── Popover ──────────────────────────────────────────────────────

  function closePopover() {
    const existing = document.getElementById(POPOVER_ID);
    if (existing && existing.parentNode) {
      existing.parentNode.removeChild(existing);
    }
    document.removeEventListener('keydown', onPopoverKey, true);
    document.removeEventListener('mousedown', onPopoverOutside, true);
  }

  function onPopoverKey(ev) {
    if (ev.key === 'Escape') closePopover();
  }

  function onPopoverOutside(ev) {
    // v1.40.295: ignore stray events that fire within the open-grace
    // window. Without this, the click that opens the popover can
    // trigger a synthesised mousedown right after the popover mounts,
    // and the popover closes within milliseconds of opening (visible
    // as a flicker). 250ms is comfortably longer than the longest
    // observed gap between the opening click and any follow-on
    // synthetic event from touch/click coalescing.
    if (Date.now() - _popoverOpenedAt < OPEN_GRACE_MS) return;
    const popover = document.getElementById(POPOVER_ID);
    if (!popover) return;
    if (popover.contains(ev.target)) return;
    // v1.40.295: look up the FAB freshly from the DOM rather than
    // relying on the cached fabEl reference. The overlay container can
    // re-render (e.g. during the translation forceRebuild storm),
    // which detaches the old fabEl from the document and mounts a
    // new button. A cached reference then points to a detached node,
    // and a click on the NEW button is treated as "outside" because
    // the stale fabEl.contains(ev.target) returns false. Querying
    // afresh per click avoids that race entirely.
    const currentFab = document.querySelector('.antcv-fab[' + FAB_MARKER + '="1"]');
    if (currentFab && currentFab.contains(ev.target)) {
      // Keep our cache in sync so other code paths see the current node.
      fabEl = currentFab;
      return;
    }
    // Also tolerate the legacy cached reference (in case the FAB has
    // been temporarily detached but the user is clicking what they
    // last saw — rare but harmless to skip the close).
    if (fabEl && fabEl.contains(ev.target)) return;
    closePopover();
  }

  function togglePopover(anchor) {
    const existing = document.getElementById(POPOVER_ID);
    if (existing) { closePopover(); return; }
    openPopover(anchor);
  }

  function openPopover(anchor) {
    injectStylesOnce();
    const state = readState();
    const info = levelInfo(state.worst);

    const popover = document.createElement('div');
    popover.id = POPOVER_ID;
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-label', 'Privacy status details');

    const h3 = document.createElement('h3');
    h3.textContent = 'Privacy status';
    popover.appendChild(h3);

    const status = document.createElement('div');
    status.className = 'antcv-pl-status';
    status.style.color = info.border;
    status.textContent = info.glyph + ' ' + info.label;
    popover.appendChild(status);

    const detail = document.createElement('div');
    detail.className = 'antcv-pl-detail';
    detail.textContent = info.detail;
    popover.appendChild(detail);

    const total = document.createElement('div');
    total.className = 'antcv-pl-row';
    const totalLabel = document.createElement('span');
    totalLabel.textContent = 'Total LLM calls';
    const totalVal = document.createElement('span');
    totalVal.style.fontWeight = '700';
    totalVal.textContent = String(state.calls || 0);
    total.appendChild(totalLabel);
    total.appendChild(totalVal);
    popover.appendChild(total);

    const last = document.createElement('div');
    last.className = 'antcv-pl-row';
    const lastLabel = document.createElement('span');
    lastLabel.textContent = 'Last activity';
    const lastVal = document.createElement('span');
    lastVal.style.color = '#666';
    lastVal.textContent = formatTs(state.lastTs);
    last.appendChild(lastLabel);
    last.appendChild(lastVal);
    popover.appendChild(last);

    // Provider breakdown
    const providers = Object.keys(state.byProvider || {}).sort();
    if (providers.length) {
      const heading = document.createElement('div');
      heading.style.cssText = 'margin-top: 10px; font-size: 11px; color: #888; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;';
      heading.textContent = 'By provider';
      popover.appendChild(heading);
      for (const p of providers) {
        const row = state.byProvider[p] || {};
        const div = document.createElement('div');
        div.className = 'antcv-pl-provider';
        const left = document.createElement('span');
        left.textContent = p;
        const right = document.createElement('span');
        right.style.color = '#666';
        const calls = Number(row.count) || 0;
        const lvl = Number(row.maxLevel) || 0;
        right.textContent = calls + ' call' + (calls === 1 ? '' : 's')
          + ' · max L' + lvl;
        div.appendChild(left);
        div.appendChild(right);
        popover.appendChild(div);
      }
    }

    const actions = document.createElement('div');
    actions.className = 'antcv-pl-actions';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'antcv-pl-btn antcv-pl-btn-danger';
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset';
    resetBtn.title = 'Clear the privacy LED state for this session';
    resetBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      try {
        if (typeof window.__antcvResetPrivacyLED === 'function') {
          window.__antcvResetPrivacyLED();
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEFAULT_STATE, byProvider: {} }));
        }
      } catch (_) {}
      refreshFabAppearance();
      closePopover();
    });
    const closeBtn = document.createElement('button');
    closeBtn.className = 'antcv-pl-btn';
    closeBtn.type = 'button';
    closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      closePopover();
    });
    actions.appendChild(resetBtn);
    actions.appendChild(closeBtn);
    popover.appendChild(actions);

    document.body.appendChild(popover);
    positionPopover(popover, anchor);
    document.addEventListener('keydown', onPopoverKey, true);
    document.addEventListener('mousedown', onPopoverOutside, true);
    // v1.40.295: stamp the open time so onPopoverOutside can ignore
    // any stray events that fire within the grace window. Must be set
    // AFTER addEventListener so the very next mousedown (if it's the
    // same tap that opened the popover) sees this fresh value.
    _popoverOpenedAt = Date.now();
  }

  function positionPopover(popover, anchor) {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popRect = popover.getBoundingClientRect();
    // Default: place to the left of the anchor, vertically centred.
    let top = rect.top + (rect.height / 2) - (popRect.height / 2);
    let left = rect.left - popRect.width - 12;
    // Keep within viewport.
    const margin = 12;
    if (left < margin) {
      left = rect.right + 12;
    }
    if (left + popRect.width > window.innerWidth - margin) {
      left = window.innerWidth - popRect.width - margin;
    }
    if (top < margin) top = margin;
    if (top + popRect.height > window.innerHeight - margin) {
      top = window.innerHeight - popRect.height - margin;
    }
    popover.style.top = top + 'px';
    popover.style.left = left + 'px';
  }

  function formatTs(ts) {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (Number.isNaN(d.getTime())) return '—';
      const diff = Date.now() - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.round(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.round(diff / 3600000) + 'h ago';
      return d.toLocaleDateString();
    } catch (_) {
      return '—';
    }
  }

  // ─── Fetch instrumentation ────────────────────────────────────────
  //
  // Wraps window.fetch to classify outgoing requests and update the
  // LED. Original fetch behaviour is preserved; we only observe.

  const THIRD_PARTY_HOSTS = [
    'api.anthropic.com',
    'api.openai.com',
    'api.mistral.ai',
    'generativelanguage.googleapis.com', // Gemini
  ];

  // Provider name lookup from host.
  function providerFromHost(host) {
    if (!host) return 'unknown';
    if (host === 'api.anthropic.com') return 'anthropic';
    if (host === 'api.openai.com') return 'openai';
    if (host === 'api.mistral.ai') return 'mistral';
    if (host === 'generativelanguage.googleapis.com') return 'gemini';
    return host;
  }

  // v1.40.194: previously only read localStorage.proxyUrl, which is
  // rarely populated for signed-in users (antcv-auth.js's getProxyUrl
  // falls back to window.ANTCV_RELAY_URL from relay-config.json — the
  // LED had no such fallback, so the admin's own relay was mis-labelled
  // "demo-proxy"). We now read every source the rest of the app uses,
  // and return the SET of own-proxy hosts so multi-Worker deployments
  // (PWA → relay → cv-proxy) are all classified Level 1.
  function readOwnProxyHosts() {
    const hosts = new Set();
    const push = (raw) => {
      if (!raw) return;
      try {
        let u = raw;
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed === 'string') u = parsed;
        } catch (_) {}
        u = String(u).trim();
        if (!u) return;
        const h = new URL(u).host.toLowerCase();
        if (h) hosts.add(h);
      } catch (_) {}
    };
    try { push(localStorage.getItem('proxyUrl')); } catch (_) {}
    try { push(localStorage.getItem('relayUrl')); } catch (_) {}
    try {
      if (typeof window.ANTCV_RELAY_URL === 'string') push(window.ANTCV_RELAY_URL);
    } catch (_) {}
    try {
      // Forward-compat: an admin may want to declare cv-proxy explicitly.
      if (typeof window.ANTCV_UPSTREAM_URL === 'string') push(window.ANTCV_UPSTREAM_URL);
    } catch (_) {}
    return hosts;
  }

  // Back-compat alias (returns first own host or null) — tests and other
  // sidecars may import this; the new internal classifier uses the Set.
  function readProxyHost() {
    const hosts = readOwnProxyHosts();
    return hosts.size ? hosts.values().next().value : null;
  }

  // Document-rendering workers (DOCX/PDF export, C2PA signing) are NOT LLM
  // traffic, but they live on *.workers.dev and their /generate path matches
  // the LLM path allowlist — every export flipped the LED to amber
  // "Demo proxy" (owner 2026-06-11: pill read "Demo proxy (3 calls)" after
  // three PDF exports). Resolve the configured export/signing hosts and
  // exclude them from classification entirely.
  function readDocumentWorkerHosts() {
    const hosts = new Set();
    const push = (raw) => {
      if (!raw || typeof raw !== 'string') return;
      try { const h = new URL(raw).host.toLowerCase(); if (h) hosts.add(h); } catch (_) {}
    };
    try { push(window.ANTCV_DOCX_WORKER); } catch (_) {}
    try { push(window.ANTCV_C2PA_WORKER); } catch (_) {}
    return hosts;
  }

  // Classify a URL into {level, provider} or null if not LLM-related.
  function classifyUrl(urlStr) {
    if (!urlStr) return null;
    let host;
    try { host = new URL(urlStr, window.location.href).host.toLowerCase(); }
    catch (_) { return null; }

    // Direct LLM API call?
    if (THIRD_PARTY_HOSTS.indexOf(host) >= 0) {
      return { level: 3, provider: providerFromHost(host) };
    }

    // Document workers: rendering/signing, never an LLM call. Belt and
    // braces: also match by the conventional worker-name prefix in case the
    // globals aren't set yet at call time.
    if (readDocumentWorkerHosts().has(host)
        || /^(docx-worker|c2pa-worker)[.-]/.test(host)) {
      return null;
    }

    // Match against every known own-proxy host. This covers the relay,
    // the cv-proxy, and any future Worker the admin wires up via
    // ANTCV_UPSTREAM_URL or localStorage.relayUrl.
    const ownHosts = readOwnProxyHosts();
    if (ownHosts.has(host)) {
      return { level: 1, provider: 'own-proxy' };
    }
    if (host.endsWith('.workers.dev')) {
      return { level: 2, provider: 'demo-proxy' };
    }
    // Anything else is not LLM-related (analytics, drive, etc.)
    return null;
  }

  function urlFromArgs(args) {
    const first = args && args[0];
    if (!first) return '';
    if (typeof first === 'string') return first;
    if (typeof first.url === 'string') return first.url; // Request object
    try { return String(first); } catch (_) { return ''; }
  }

  // Endpoints inside the proxy/relay that genuinely call an LLM. The
  // proxy is also called for /api/prefs, /api/applications,
  // /analytics, etc. — those shouldn't trip the LED. We use a path
  // allowlist so the LED reflects LLM activity, not all backend
  // traffic.
  const LLM_PATH_RE = /\/(api\/messages|api\/chat|api\/generate|api\/stream|api\/recheck-fit|messages|chat|generate)\b/i;

  function pathOfUrl(urlStr) {
    try { return new URL(urlStr, window.location.href).pathname; }
    catch (_) { return ''; }
  }

  function instrumentFetch() {
    if (typeof window.fetch !== 'function') return;
    if (window.fetch.__antcvPrivacyWrapped === true) return;
    const orig = window.fetch;
    const wrapped = function (...args) {
      try {
        const url = urlFromArgs(args);
        const c = classifyUrl(url);
        if (c) {
          if (c.level === 3) {
            // Direct API calls are always LLM traffic.
            safeUpdateLed(c);
          } else if (LLM_PATH_RE.test(pathOfUrl(url))) {
            // Proxy traffic only counts on LLM paths.
            safeUpdateLed(c);
          }
        }
      } catch (_) {}
      return orig.apply(this, args);
    };
    wrapped.__antcvPrivacyWrapped = true;
    window.fetch = wrapped;
  }

  function safeUpdateLed(c) {
    try {
      if (typeof window.__antcvUpdatePrivacyLED === 'function') {
        window.__antcvUpdatePrivacyLED({ level: c.level, provider: c.provider, task: '' });
      } else {
        // Fallback: write directly to localStorage if the global
        // API hasn't been wired up yet (e.g. before app.js fully
        // mounts). The structure matches what app.js writes.
        const cur = readState();
        cur.worst = Math.max(cur.worst, c.level);
        cur.calls = (cur.calls || 0) + 1;
        cur.lastTs = new Date().toISOString();
        if (!cur.byProvider[c.provider]) {
          cur.byProvider[c.provider] = { count: 0, maxLevel: 0, lastTask: '' };
        }
        cur.byProvider[c.provider].count += 1;
        cur.byProvider[c.provider].maxLevel = Math.max(
          cur.byProvider[c.provider].maxLevel, c.level
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(cur));
      }
      refreshFabAppearance();
    } catch (_) {}
  }

  // ─── Live refresh ─────────────────────────────────────────────────

  function onStorageChange(ev) {
    if (!ev || ev.key !== STORAGE_KEY) return;
    refreshFabAppearance();
    // If the popover is open, redraw it.
    const existing = document.getElementById(POPOVER_ID);
    if (existing) {
      closePopover();
      openPopover(fabEl);
    }
  }

  // ─── Boot ─────────────────────────────────────────────────────────

  function init() {
    injectStylesOnce();
    instrumentFetch();
    ensureFab();
    // Watch for the overlay to mount its FAB stack (we need to
    // re-attach if it remounts).
    const observer = new MutationObserver(() => ensureFab());
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('storage', onStorageChange);
    // Periodic refresh in case __antcvUpdatePrivacyLED updates state
    // without firing a storage event (same-tab writes don't trigger
    // storage events). Also re-asserts the contrast styling after the
    // top-bar relocation sidecar re-styles the FAB inline.
    setInterval(() => {
      if (document.querySelector('.antcv-fab[' + FAB_MARKER + '="1"]')) {
        refreshFabAppearance();
      }
    }, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }

  // Expose a tiny test/debug API.
  window.AntcvPrivacyLed = {
    version: SCRIPT_VERSION,
    refresh: refreshFabAppearance,
    open: () => fabEl && openPopover(fabEl),
    close: closePopover,
    _classifyUrl: classifyUrl,
    _levelInfo: levelInfo,
    _readState: readState,
  };
})();
