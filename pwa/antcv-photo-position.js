/* AntCV photo-position sidecar (v1.40.137)
 * ============================================================
 * Fixes the broken `photoPosition` settings in the preview.
 *
 * Background
 * ----------
 * The settings panel offers 7 photo positions:
 *   sidebar-top, sidebar-bottom, header-left, header-right,
 *   main-left, main-right, hidden
 *
 * In the current (immutable, minified) `app.js`:
 *   ✓ sidebar-top, sidebar-bottom — photo renders in the sidebar
 *   ✓ hidden                      — photo not rendered
 *   ✗ header-left, header-right   — BROKEN (dead code path)
 *   ✗ main-left, main-right       — BROKEN (dead code path)
 *
 * The settings panel saves the chosen value to
 * `localStorage.photoPosition` and updates a React state pair
 * `[er, tr]`, but four of the seven rendering paths compute the
 * photo HTML and then discard it in a comma-expression chain that
 * never assigns the result. So clicking those four buttons updates
 * the highlight in Settings but does nothing visible.
 *
 * Fix (DOM-level — no app.js changes)
 * -----------------------------------
 * This sidecar watches `.antcv-preview-paper` via MutationObserver.
 * On each mutation it:
 *   1. Reads the current `photoPosition` from localStorage.
 *   2. Locates the originally rendered photo image (the one in the
 *      sidebar that `app.js` already places via `k(R)` → `C`).
 *   3. If the active setting is one of the four broken positions,
 *      clones the photo into a new "floating" wrap at the right
 *      location (header band or main column) and hides the
 *      sidebar copy.
 *   4. If the setting is sidebar-top, sidebar-bottom, or hidden,
 *      removes any leftover clones we'd inserted previously.
 *
 * The sidecar also listens to:
 *   - `storage` events     — settings panel changes from another tab
 *   - `click` events on the settings panel — same-tab changes (the
 *     panel writes to localStorage but `storage` only fires on
 *     OTHER tabs, so we poll on click events too)
 *   - Periodic re-apply on a slow setInterval as a belt-and-braces
 *
 * Idempotent on every pass: insertions are tagged with
 * `data-antcv-photo-clone="1"` so we never double-insert.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.194';

  // Settings key + valid values, mirroring the dropdown in Settings.
  //
  // v1.40.194: added 'band-overlap' — the medallion-straddle position
  // where the photo sits centred in the sidebar column with its
  // vertical mid-line aligned to the seam between the candidate header
  // band and the sidebar. Half the disc overlaps the navy header band;
  // the lower half overlaps the navy sidebar. Visually it reads as a
  // single coin pinning the two navy regions together.
  const STORAGE_KEY = 'photoPosition';
  const POSITIONS = [
    'sidebar-top', 'sidebar-bottom',
    'header-left', 'header-right',
    'main-left',   'main-right',
    'band-overlap',
    'hidden',
  ];
  const DEFAULT_POSITION = 'sidebar-top';

  // ─── Storage read ─────────────────────────────────────────────────
  //
  // The settings panel writes the value via `u.set("photoPosition", v)`.
  // Looking at `u.set` (the app's localStorage wrapper) the value can
  // land either as a bare string or as a JSON-encoded string. Tolerate
  // both shapes when reading.

  function readPosition() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_POSITION;
      let v = raw;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') v = parsed;
      } catch (_) {}
      v = String(v).trim();
      return POSITIONS.indexOf(v) >= 0 ? v : DEFAULT_POSITION;
    } catch (_) {
      return DEFAULT_POSITION;
    }
  }

  // ─── Preview discovery ────────────────────────────────────────────
  //
  // The live preview is rendered into:
  //   .antcv-preview-frame > .antcv-preview-wrap > .antcv-preview-paper
  // The paper is the white "A4" surface that holds the candidate-header
  // band at the top + the main 2-column table (sidebar + main) below.
  //
  // The photo (when in sidebar-top/bottom) is an `<img>` with inline
  // `border-radius:50%`. We identify it by that styling marker plus
  // by its presence inside the sidebar `<td>` (bgcolor=navy).

  function findPaper() {
    return document.querySelector('.antcv-preview-paper');
  }

  function findOriginalPhoto(paper) {
    // The sidecar's clones are tagged; never treat them as the original.
    const imgs = paper.querySelectorAll('img');
    for (const img of imgs) {
      if (img.getAttribute('data-antcv-photo-clone') === '1') continue;
      const style = img.getAttribute('style') || '';
      if (style.indexOf('border-radius:50%') >= 0
        || style.indexOf('border-radius: 50%') >= 0) {
        return img;
      }
    }
    return null;
  }

  // The header band is the navy table that sits above the main 2-col
  // table inside the preview paper. We identify it as: the FIRST table
  // child of the paper whose top-level cells carry the candidate-band
  // navy bgcolor. The original v1.40.137 probe required exactly 1
  // row × 1 cell which silently broke once the candidate band picked
  // up multi-cell layouts. The new probe is shape-agnostic: any table
  // whose first row's first TD has the same bgcolor as the paper's
  // root-level navy band counts. As a safety net we also accept the
  // FIRST <table> in document order — that's always the band on the
  // current renderer.

  function findHeaderTable(paper) {
    const tables = Array.from(paper.querySelectorAll('table'));
    if (!tables.length) return null;
    // Fast path: first table is the band.
    const first = tables[0];
    // Sanity check — does it look like the header band? It must NOT
    // contain the main two-column structure (which has at least one
    // row with two TDs). The main column table is the second table
    // in the paper; the first table is the band.
    const rows = first.querySelectorAll(':scope > tbody > tr, :scope > tr');
    let isMainTable = false;
    for (const r of rows) {
      const cells = r.querySelectorAll(':scope > td');
      if (cells.length >= 2) { isMainTable = true; break; }
    }
    if (!isMainTable) return first;
    // Fallback — return null rather than mistakenly returning the
    // main table as the header band.
    return null;
  }

  // The main two-column table (sidebar + main). We need it both for
  // findMainTd() and findSidebarTd() — the band-overlap clone needs
  // the sidebar TD as its insertion point.
  function findMainTable(paper) {
    const tables = paper.querySelectorAll('table');
    for (const t of tables) {
      const rows = t.querySelectorAll(':scope > tbody > tr, :scope > tr');
      for (const row of rows) {
        const cells = row.querySelectorAll(':scope > td');
        if (cells.length === 2) return t;
      }
    }
    return null;
  }

  function findMainTd(paper) {
    const t = findMainTable(paper);
    if (!t) return null;
    const rows = t.querySelectorAll(':scope > tbody > tr, :scope > tr');
    for (const row of rows) {
      const cells = row.querySelectorAll(':scope > td');
      if (cells.length === 2) {
        for (const td of cells) {
          const bg = (td.getAttribute('bgcolor') || '').toLowerCase();
          if (bg === '#ffffff' || bg === 'white' || bg === 'ffffff') return td;
        }
      }
    }
    return null;
  }

  function findSidebarTd(paper) {
    const t = findMainTable(paper);
    if (!t) return null;
    const rows = t.querySelectorAll(':scope > tbody > tr, :scope > tr');
    for (const row of rows) {
      const cells = row.querySelectorAll(':scope > td');
      if (cells.length === 2) {
        // The sidebar TD is the one whose bgcolor is NOT white. It
        // also typically has a non-empty bgcolor attribute set by
        // app.js's renderer.
        for (const td of cells) {
          const bg = (td.getAttribute('bgcolor') || '').toLowerCase();
          if (bg && bg !== '#ffffff' && bg !== 'white' && bg !== 'ffffff') return td;
        }
      }
    }
    return null;
  }

  // ─── Clone the photo ──────────────────────────────────────────────
  //
  // We clone the existing `<img>` (so the user's chosen border colour,
  // diameter, and image source carry over automatically) and wrap it
  // in a small `<div>` that handles the target position's float/align.
  //
  // The clone carries `data-antcv-photo-clone="1"` so the next
  // MutationObserver pass recognises it.

  function buildCloneWrap(img, position) {
    const clone = img.cloneNode(true);
    clone.setAttribute('data-antcv-photo-clone', '1');
    // Reset the wrap-margin set by the original (the sidebar version
    // applies vertical spacing relevant only there).
    clone.style.margin = '0';

    const wrap = document.createElement('div');
    wrap.setAttribute('data-antcv-photo-clone', '1');
    wrap.setAttribute('data-antcv-photo-position', position);
    // Common attributes — fine-tune below per position.
    wrap.style.display = 'inline-block';
    wrap.style.lineHeight = '0'; // collapse the line-height halo around the img
    wrap.appendChild(clone);

    switch (position) {
      case 'header-left':
        wrap.style.float = 'left';
        wrap.style.margin = '6pt 12pt 6pt 12pt';
        wrap.style.verticalAlign = 'middle';
        break;
      case 'header-right':
        wrap.style.float = 'right';
        wrap.style.margin = '6pt 12pt 6pt 12pt';
        wrap.style.verticalAlign = 'middle';
        break;
      case 'main-left':
        wrap.style.float = 'left';
        wrap.style.margin = '0 12pt 8pt 0';
        break;
      case 'main-right':
        wrap.style.float = 'right';
        wrap.style.margin = '0 0 8pt 12pt';
        break;
      case 'band-overlap':
        // The medallion straddles the seam between the candidate
        // header band and the sidebar. Implementation: a positioned
        // wrap inside the sidebar TD whose negative margin-top pulls
        // it up by half the photo's rendered height, so its vertical
        // midpoint sits exactly on the band/sidebar boundary. The
        // wrap is centred in the sidebar column via text-align:
        // center on a block wrapper.
        //
        // The original photo's `<img>` carries `width: <Npt>` (set by
        // app.js from the user's Settings → photo diameter). We read
        // it back at apply time so the negative offset matches the
        // actual rendered diameter; here we just declare the position
        // semantics, and applyLayout() computes the pull.
        wrap.style.display = 'block';
        wrap.style.textAlign = 'center';
        wrap.style.margin = '0';                 // negative top set later
        wrap.style.padding = '0';
        wrap.style.position = 'relative';
        wrap.style.zIndex = '2';                 // float above the band shading
        // The img inside should not pick up the sidebar text colour.
        clone.style.display = 'inline-block';
        clone.style.verticalAlign = 'top';
        break;
    }
    return wrap;
  }

  // For band-overlap we need the original photo's rendered height so
  // we can pull the clone up by exactly half. Inspect the original
  // <img>'s `width:` style (the photo is a square circle, so width
  // equals height) and parse the value to pixels.
  function measurePhotoPx(img) {
    if (!img) return 96;
    // 1. Inline style.width / .height
    try {
      const s = img.getAttribute('style') || '';
      const m = s.match(/(?:width|height)\s*:\s*([\d.]+)\s*(px|pt|in|cm|mm)/i);
      if (m) {
        const n = parseFloat(m[1]);
        const u = m[2].toLowerCase();
        // 1pt = 1.333px ; 1in = 96px ; 1cm = 37.795px ; 1mm = 3.7795px
        if (u === 'px') return n;
        if (u === 'pt') return n * 96 / 72;
        if (u === 'in') return n * 96;
        if (u === 'cm') return n * 37.7952755906;
        if (u === 'mm') return n * 3.77952755906;
      }
    } catch (_) {}
    // 2. width attribute
    try {
      const w = img.getAttribute('width');
      if (w) {
        const n = parseFloat(w);
        if (Number.isFinite(n) && n > 0) return n;
      }
    } catch (_) {}
    // 3. computed style (last resort — only works post-layout)
    try {
      const rect = img.getBoundingClientRect();
      if (rect && rect.width > 8) return rect.width;
    } catch (_) {}
    return 96;
  }

  // ─── Layout application ──────────────────────────────────────────
  //
  // Per-pass plan:
  //   1. Remove all existing clones we own (they may now be in the
  //      wrong place if the user changed the setting).
  //   2. If position needs a clone (header-* or main-*), build a fresh
  //      wrap and insert it into the right container.
  //   3. Toggle the original's visibility based on whether it should
  //      still be visible (sidebar-* keeps it; the rest hide it).
  //
  // The original is hidden via `visibility:hidden` so that any layout
  // dimensions the sidebar uses to size itself (the photo wrap
  // contributes height to the sidebar in the original render) stay
  // intact. If the user toggles back to sidebar-top, we restore.

  function clearExistingClones(paper) {
    const existing = paper.querySelectorAll('[data-antcv-photo-clone="1"]');
    for (const el of existing) {
      // Skip elements that are descendants of another clone wrap
      // (the inner img). We only remove the outermost wrap.
      if (el.tagName === 'IMG' && el.parentElement &&
          el.parentElement.getAttribute('data-antcv-photo-clone') === '1') {
        continue;
      }
      if (el.parentElement) el.parentElement.removeChild(el);
    }
  }

  function setOriginalVisible(img, visible) {
    if (!img) return;
    // Walk up to the wrap div the original photo lives in so we hide
    // its surrounding padding too. The original render wraps the img
    // in a `<div style="text-align:center;margin-bottom:8pt;...">`.
    const wrap = img.parentElement;
    if (wrap && wrap.tagName === 'DIV') {
      wrap.style.display = visible ? '' : 'none';
    } else {
      img.style.display = visible ? '' : 'none';
    }
  }

  function applyLayout() {
    const paper = findPaper();
    if (!paper) return;

    const position = readPosition();
    const original = findOriginalPhoto(paper);
    // Always start from a clean slate.
    clearExistingClones(paper);

    // Sidebar positions: original is correct; nothing to do (and the
    // app.js render itself hides/shows for sidebar-bottom vs top).
    if (position === 'sidebar-top' || position === 'sidebar-bottom') {
      setOriginalVisible(original, true);
      return;
    }

    if (position === 'hidden') {
      setOriginalVisible(original, false);
      return;
    }

    // For the four broken positions: hide the original, insert a clone
    // at the target. If we can't find the original (e.g., user has no
    // photo set), there's nothing to clone — just bail.
    if (!original) return;
    setOriginalVisible(original, false);

    const clone = buildCloneWrap(original, position);

    if (position === 'header-left' || position === 'header-right') {
      const header = findHeaderTable(paper);
      if (!header) return;
      const td = header.querySelector(':scope > tbody > td, :scope > tbody > tr > td, :scope > tr > td');
      const cell = td || header;
      // The header TD has `text-align:center` (the name+spec+contact are
      // centred). Floats inside a centred parent still float to the TD
      // edges, which is what we want.
      if (position === 'header-left') {
        cell.insertBefore(clone, cell.firstChild);
      } else {
        cell.appendChild(clone);
      }
    } else if (position === 'main-left' || position === 'main-right') {
      const mainTd = findMainTd(paper);
      if (!mainTd) return;
      // Drop the clone at the very top of the main column so the
      // floated photo wraps with the first paragraph that follows.
      mainTd.insertBefore(clone, mainTd.firstChild);
    } else if (position === 'band-overlap') {
      // Insert at the very top of the sidebar TD and pull up by half
      // the photo's height. The sidebar TD's bgcolor extends only
      // within its own boundary, but the clone's wrap div sits on top
      // of the band (in document order it's a child of the sidebar TD
      // with negative margin) so it visually straddles both regions.
      const sidebarTd = findSidebarTd(paper);
      if (!sidebarTd) return;
      const px = measurePhotoPx(original);
      // Pull up by half-diameter plus a tiny visual bias so the
      // medallion's geometric centre sits exactly on the seam. A 2px
      // upward nudge compensates for the 1.5pt border ring (which
      // adds ~2px to the visible vertical extent above the disc).
      const pull = Math.max(24, Math.round(px / 2) + 2);
      clone.style.marginTop = '-' + pull + 'px';
      clone.style.marginBottom = '8pt';   // breathing room before first sidebar section
      sidebarTd.insertBefore(clone, sidebarTd.firstChild);
    }
  }

  // ─── Observers + triggers ─────────────────────────────────────────
  //
  // We re-apply on:
  //   - MutationObserver hits on the paper (debounced)
  //   - `storage` events (cross-tab changes)
  //   - `click` events anywhere on the document (same-tab Settings
  //     button taps — `storage` doesn't fire same-tab, so we treat
  //     every click as a trigger to re-read and re-apply; cheap)
  //   - A slow 2s polling tick as belt-and-braces

  let applyTimer = null;
  function scheduleApply(delay) {
    if (applyTimer) clearTimeout(applyTimer);
    applyTimer = setTimeout(() => {
      applyTimer = null;
      try { applyLayout(); } catch (e) {
        console.warn('[antcv-photo-position] applyLayout threw:', e);
      }
    }, typeof delay === 'number' ? delay : 60);
  }

  let lastSeenPosition = null;
  function maybeReapplyIfChanged() {
    const now = readPosition();
    if (now !== lastSeenPosition) {
      lastSeenPosition = now;
      scheduleApply(20);
    }
  }

  function bootObservers() {
    const observer = new MutationObserver(() => scheduleApply());
    // Watch the whole body for the preview-paper to appear, then
    // observe its subtree. This is simpler than waiting for the paper
    // selectors and handles the case where React unmounts/remounts it.
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('storage', (ev) => {
      if (ev.key === STORAGE_KEY) {
        lastSeenPosition = null; // force re-apply
        scheduleApply(20);
      }
    });

    document.addEventListener('click', () => {
      // Tiny debounce — let app.js write to localStorage first.
      setTimeout(maybeReapplyIfChanged, 30);
    }, true);

    // Belt-and-braces polling.
    setInterval(maybeReapplyIfChanged, 2000);

    // First pass.
    scheduleApply(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootObservers);
  } else {
    bootObservers();
  }

  // Test/debug API
  window.AntcvPhotoPosition = {
    version: SCRIPT_VERSION,
    POSITIONS: POSITIONS.slice(),
    _readPosition: readPosition,
    _findPaper: findPaper,
    _findOriginalPhoto: findOriginalPhoto,
    _findHeaderTable: findHeaderTable,
    _findMainTable: findMainTable,
    _findMainTd: findMainTd,
    _findSidebarTd: findSidebarTd,
    _buildCloneWrap: buildCloneWrap,
    _measurePhotoPx: measurePhotoPx,
    _applyLayout: applyLayout,
  };
})();
