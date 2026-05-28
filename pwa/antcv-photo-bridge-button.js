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
  window.__antcvPhotoBridgeButtonInstalled = '1.50.30';

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
  function findButtonRow(section) {
    if (!section) return null;
    const buttons = section.querySelectorAll('button');
    for (const b of buttons) {
      const t = (b.textContent || '').trim().toLowerCase();
      if (t === 'sidebar top' || t === 'sidebar btm' || t === 'main left' || t === 'main right' || t === 'hidden') {
        const parent = b.parentElement;
        if (parent && parent.children.length >= 2) return parent;
      }
    }
    return null;
  }

  function buildBridgeButton() {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(TAG_ATTR, '1');
    btn.textContent = '◐ Sidebar bridge';
    btn.title = 'Photo straddles the seam between the header band and the sidebar (medallion overlap).';
    // Use inline styles matched as closely as possible to the existing
    // photo-position buttons in the layout panel. The panel uses a
    // dark navy theme with teal accents on the active button.
    btn.style.cssText = [
      'padding: 6px 12px',
      'background: rgba(255,255,255,.04)',
      'color: #d7e6ee',
      'border: 1px solid rgba(255,255,255,.18)',
      'border-radius: 6px',
      'cursor: pointer',
      'font-family: inherit',
      'font-size: 12px',
      'font-weight: 600',
      'margin: 2px',
      'display: inline-flex',
      'align-items: center',
      'gap: 4px',
      'white-space: nowrap',
    ].join(';');
    btn.addEventListener('click', () => {
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

  function inject() {
    const section = findSectionByHeading(/^PROFILE PHOTO$/, 2);
    if (!section) return false;
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
    target.appendChild(buildBridgeButton());
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
