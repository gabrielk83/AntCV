/* AntCV photo "Sidebar bridge" button (v1.50.30)
 * =================================================
 *
 * Background
 * ----------
 * antcv-photo-position.js v1.40.194 added a 7th photo-position value —
 * 'band-overlap' — where the photo straddles the seam between the
 * header band and the sidebar (a medallion pinning the two navy
 * regions together). The rendering side works: when localStorage
 * `photoPosition` is 'band-overlap', the photo sidecar pulls the
 * clone up by half the photo's diameter so its vertical midpoint
 * sits exactly on the band/sidebar boundary.
 *
 * What was missing: the picker UI in the Layout tab (rendered by the
 * minified app.js bundle) only offers seven buttons —
 *   Sidebar top, Sidebar btm, Header left, Header right,
 *   Main left, Main right, Hidden
 * — so there was no way for a user to select 'band-overlap' without
 * opening DevTools.
 *
 * Strategy (DOM-level — no app.js changes)
 * ----------------------------------------
 * Mirror the antcv-format-prefs.js injection pattern. Walk the live
 * DOM for the "PROFILE PHOTO" heading, walk up one level to the
 * section wrapper, append a single "Sidebar bridge" button. Click
 * writes the same localStorage key the existing buttons use, then
 * dispatches a `storage` event so the photo-position sidecar's
 * change-detection kicks in immediately.
 *
 * Idempotency
 * -----------
 * The injected button is tagged with `data-antcv-bridge-button="1"`.
 * The MutationObserver pass skips re-insertion if a tagged button is
 * already in the section. When React unmounts the Layout tab the
 * tagged button leaves with it; the next mount triggers a fresh
 * injection.
 *
 * Cross-button highlight
 * ----------------------
 * When the user clicks one of app.js's seven buttons, our bridge
 * button must de-highlight (else two positions look "active"). We
 * use a `storage`-style poll plus a tick interval to re-read
 * localStorage.photoPosition and update the button's visual state.
 * Polling is cheap (one read per second) and avoids any reliance on
 * app.js internals.
 */
(function () {
  'use strict';

  if (window.__antcvPhotoBridgeButtonInstalled) return;
  window.__antcvPhotoBridgeButtonInstalled = '1.50.35';

  const STORAGE_KEY = 'photoPosition';
  const BRIDGE_VALUE = 'band-overlap';
  const TAG_ATTR = 'data-antcv-bridge-button';

  function readPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return 'sidebar-top';
      let v = raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') v = parsed;
      } catch (_) {}
      return String(v).trim();
    } catch (_) {
      return 'sidebar-top';
    }
  }

  function writePosition(value) {
    // Match the storage shape app.js's `u.set` writes — JSON-encoded
    // string. antcv-photo-position.js tolerates BOTH JSON-encoded
    // and bare strings on read, so this is safe.
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (_) {}
    // Fire a synthetic storage event so other tabs / sidecars notice
    // the change instantly without waiting for their polling tick.
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORAGE_KEY,
        newValue: JSON.stringify(value),
        storageArea: localStorage,
      }));
    } catch (_) {
      // Older browsers may not support the StorageEvent constructor;
      // fall back to a CustomEvent the photo-position sidecar also
      // honours via its click-tick path.
      try {
        window.dispatchEvent(new CustomEvent('antcv:photo-position-changed', {
          detail: { value },
        }));
      } catch (_) {}
    }
  }

  // Same DOM walk as antcv-format-prefs.js. Finds the FIRST text node
  // whose trimmed content matches the regex; walks up `maxWalkUp`
  // levels to reach the section wrapper.
  function findSectionByHeading(anchorRegex, maxWalkUp) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const t = (node.textContent || '').trim();
        return (t && anchorRegex.test(t)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    const tNode = walker.nextNode();
    if (!tNode) return null;
    let n = tNode.parentElement;
    for (let i = 0; i < maxWalkUp && n && n.parentElement; i++) n = n.parentElement;
    return n;
  }

  // Find the existing photo-position button row by searching the
  // section for a button whose label matches one of the known
  // position labels. We piggyback on the row's own parent so the
  // bridge button inherits the same flex / wrap rules and visually
  // joins the row instead of sitting on its own line.
  //
  // v1.50.34 — the actual buttons in app.js render with icon prefixes
  // ("📍Sidebar top", "♦ header left", "× Hidden", …). v1.50.30's
  // strict-equality match (`text === 'sidebar top'`) never matched,
  // so findButtonRow returned null and the bridge button fell
  // through to `section.appendChild` at the BOTTOM of the card.
  // Switch to substring matching and require at least TWO known
  // labels in the same parent — that confirms the parent is the
  // photo-position row, not some unrelated button container.
  var POSITION_LABEL_FRAGMENTS = [
    'sidebar top', 'sidebar btm', 'sidebar bottom',
    'header left', 'header right',
    'main left', 'main right',
    'hidden',
  ];
  function labelMatchesPosition(text) {
    var t = String(text || '').toLowerCase();
    for (var i = 0; i < POSITION_LABEL_FRAGMENTS.length; i++) {
      if (t.indexOf(POSITION_LABEL_FRAGMENTS[i]) >= 0) return true;
    }
    return false;
  }
  function findButtonRow(section) {
    if (!section) return null;
    var buttons = section.querySelectorAll('button');
    var counts = new Map();
    for (var i = 0; i < buttons.length; i++) {
      var b = buttons[i];
      if (!labelMatchesPosition(b.textContent)) continue;
      var parent = b.parentElement;
      if (!parent) continue;
      counts.set(parent, (counts.get(parent) || 0) + 1);
    }
    // Pick the parent that holds the most position-labelled buttons
    // (the row itself). Require ≥ 2 matches so a stray standalone
    // button can't masquerade as the row.
    var bestParent = null;
    var bestCount = 0;
    counts.forEach(function (n, p) {
      if (n > bestCount) { bestCount = n; bestParent = p; }
    });
    return bestCount >= 2 ? bestParent : null;
  }

  function buildBridgeButton() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(TAG_ATTR, '1');
    btn.textContent = '◐ Sidebar bridge';
    btn.title = 'Photo straddles the seam between the header band and the sidebar (medallion overlap).';
    // v1.50.34 — minimal inline styles. Setting `all: revert` would
    // wipe parent flex/gap rules, so instead we set just the few
    // properties that need to match the existing position-button row.
    // Padding and font-size are matched to the legacy buttons; the
    // active/idle background+border swap is driven by
    // refreshActiveState() and stays in sync via the storage poll.
    btn.style.cssText = [
      'padding: 4px 10px',
      'background: rgba(255,255,255,.04)',
      'color: #d7e6ee',
      'border: 1px solid rgba(255,255,255,.18)',
      'border-radius: 6px',
      'cursor: pointer',
      'font-family: inherit',
      'font-size: 11px',
      'font-weight: 600',
      'display: inline-flex',
      'align-items: center',
      'gap: 4px',
      'white-space: nowrap',
    ].join(';');
    btn.addEventListener('click', function () {
      writePosition(BRIDGE_VALUE);
      refreshActiveState();
    });
    return btn;
  }

  function refreshActiveState() {
    const isActive = readPosition() === BRIDGE_VALUE;
    document.querySelectorAll('[' + TAG_ATTR + '="1"]').forEach(function (b) {
      if (isActive) {
        b.style.background = 'rgba(1,183,187,.18)';
        b.style.border = '1px solid rgba(1,183,187,.55)';
        b.style.color = '#e6eef3';
      } else {
        b.style.background = 'rgba(255,255,255,.04)';
        b.style.border = '1px solid rgba(255,255,255,.18)';
        b.style.color = '#d7e6ee';
      }
    });
  }

  // v1.50.32 / v1.50.33 — sweep stray CJLR cycler buttons from the
  // PROFILE PHOTO settings card.
  //
  // The format-prefs Shape / Contour / Shadow rows each carry the
  // class `.antcv-fp-shape-row` and contain ONLY `.antcv-fp-shape-btn`
  // buttons. Any other element that ends up as a direct child of one
  // of these rows is a stray injected by a section-panel sidecar
  // (section-align, item-align, the *-row-controls files, etc.) and
  // doesn't belong there — clicking it shifts the PROFILE PHOTO
  // heading alignment, which is meaningless for a settings card.
  //
  // v1.50.33 fix: in addition to the selector-based pass (which v32
  // already had), do a structure-based pass — remove any direct
  // child of `.antcv-fp-shape-row` that isn't an `.antcv-fp-shape-btn`.
  // This catches buttons we don't yet know the attribute names of.
  // Document-preview cyclers are untouched because they live in a
  // completely different DOM subtree.
  function stripStrayCjlrButtons(section) {
    if (!section) return;
    // Pass 1: known-attribute sweep. Fast, runs first.
    var selectors = [
      '[data-antcv-align-cycler]',
      '[data-antcv-headline-cjlr="1"]',
      '[data-antcv-add-cjlr-swap-241="cjlr"]',
      '[data-antcv-panel-action-211="cjlr"]',
      '[data-antcv-panel-action-208="cjlr"]',
      '[data-antcv-panel-action-207="cjlr"]',
      '[data-antcv-add-cjlr-swap-241]',
    ];
    section.querySelectorAll(selectors.join(', ')).forEach(function (b) {
      try { b.parentElement && b.parentElement.removeChild(b); } catch (_) {}
    });
    // Pass 2: structure sweep. Remove any direct child of a
    // .antcv-fp-shape-row that isn't an .antcv-fp-shape-btn. Skips
    // our own bridge button (sits in a different row) and any text
    // nodes (they're not Element children of a flexbox row).
    section.querySelectorAll('.antcv-fp-shape-row').forEach(function (row) {
      Array.prototype.slice.call(row.children).forEach(function (child) {
        if (child && child.classList && !child.classList.contains('antcv-fp-shape-btn')) {
          try { row.removeChild(child); } catch (_) {}
        }
      });
    });
  }

  function inject() {
    // v1.50.33 — walk up only ONE level. v1.50.32 used 2 which could
    // grab a parent containing both the photo card AND other Settings
    // content; the structure-based CJLR sweep would then accidentally
    // touch .antcv-fp-shape-row rows from neighbouring cards. The
    // format-prefs injectShape uses depth=1 — match that.
    const section = findSectionByHeading(/^PROFILE PHOTO$/, 1);
    if (!section) return false;
    // v1.50.32 — always run the cleanup pass; the section-align
    // sidecar may re-inject cyclers on any React commit, so we strip
    // on every observer tick. Cheap (O(few)) and idempotent.
    stripStrayCjlrButtons(section);
    if (section.querySelector('[' + TAG_ATTR + '="1"]')) {
      refreshActiveState();
      return true;
    }
    // Sweep any disconnected stragglers from a prior render pass.
    document.querySelectorAll('[' + TAG_ATTR + '="1"]').forEach(function (b) {
      if (!section.contains(b)) {
        try { b.parentElement && b.parentElement.removeChild(b); } catch (_) {}
      }
    });
    const row = findButtonRow(section);
    const target = row || section;
    const bridgeBtn = buildBridgeButton();
    // v1.50.35 — insert BEFORE the "Hidden" button so the row reads
    // …, Main left, Main right, Sidebar bridge, Hidden — which puts
    // every visible position together at the top and keeps Hidden as
    // the last (terminal) option. v1.50.34 used appendChild which
    // dropped the bridge button after Hidden. If a Hidden button
    // can't be found (renamed in a future build, or the row was
    // restructured), fall back to appendChild so the button is
    // still reachable.
    let hiddenBtn = null;
    if (row) {
      const rowButtons = row.querySelectorAll('button');
      for (let i = 0; i < rowButtons.length; i++) {
        const t = String(rowButtons[i].textContent || '').toLowerCase();
        if (t.indexOf('hidden') >= 0) { hiddenBtn = rowButtons[i]; break; }
      }
    }
    if (hiddenBtn && hiddenBtn.parentElement === target) {
      target.insertBefore(bridgeBtn, hiddenBtn);
    } else {
      target.appendChild(bridgeBtn);
    }
    refreshActiveState();
    return true;
  }

  let pendingFrame = null;
  function scheduleInject() {
    if (pendingFrame != null) return;
    pendingFrame = requestAnimationFrame(function () {
      pendingFrame = null;
      try { inject(); } catch (e) {
        try { console.warn('[antcv-photo-bridge-button] inject failed', e); } catch (_) {}
      }
    });
  }

  function boot() {
    inject();
    const observer = new MutationObserver(scheduleInject);
    observer.observe(document.body, { childList: true, subtree: true });

    // Cross-tab: keep highlight in sync with the actual stored value.
    window.addEventListener('storage', function (ev) {
      if (ev.key === STORAGE_KEY) refreshActiveState();
    });

    // Same-tab: poll every 800ms so when the user clicks one of the
    // legacy app.js buttons (which writes localStorage but does NOT
    // fire 'storage' in the same tab), our highlight de-asserts.
    setInterval(refreshActiveState, 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
