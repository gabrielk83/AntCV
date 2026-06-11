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
 *   âœ“ sidebar-top, sidebar-bottom â€” photo renders in the sidebar
 *   âœ“ hidden                      â€” photo not rendered
 *   âœ— header-left, header-right   â€” BROKEN (dead code path)
 *   âœ— main-left, main-right       â€” BROKEN (dead code path)
 *
 * The settings panel saves the chosen value to
 * `localStorage.photoPosition` and updates a React state pair
 * `[er, tr]`, but four of the seven rendering paths compute the
 * photo HTML and then discard it in a comma-expression chain that
 * never assigns the result. So clicking those four buttons updates
 * the highlight in Settings but does nothing visible.
 *
 * Fix (DOM-level â€” no app.js changes)
 * -----------------------------------
 * This sidecar watches `.antcv-preview-paper` via MutationObserver.
 * On each mutation it:
 *   1. Reads the current `photoPosition` from localStorage.
 *   2. Locates the originally rendered photo image (the one in the
 *      sidebar that `app.js` already places via `k(R)` â†’ `C`).
 *   3. If the active setting is one of the four broken positions,
 *      clones the photo into a new "floating" wrap at the right
 *      location (header band or main column) and hides the
 *      sidebar copy.
 *   4. If the setting is sidebar-top, sidebar-bottom, or hidden,
 *      removes any leftover clones we'd inserted previously.
 *
 * The sidecar also listens to:
 *   - `storage` events     â€” settings panel changes from another tab
 *   - `click` events on the settings panel â€” same-tab changes (the
 *     panel writes to localStorage but `storage` only fires on
 *     OTHER tabs, so we poll on click events too)
 *   - Periodic re-apply on a slow setInterval as a belt-and-braces
 *
 * Idempotent on every pass: insertions are tagged with
 * `data-antcv-photo-clone="1"` so we never double-insert.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.50.153';

  // Settings key + valid values, mirroring the dropdown in Settings.
  //
  // v1.40.194: added 'band-overlap' â€” the medallion-straddle position
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

  // â”€â”€â”€ Storage read â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // â”€â”€â”€ Preview discovery â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // The live preview is rendered into:
  //   .antcv-preview-frame > .antcv-preview-wrap > .antcv-preview-paper
  // The paper is the white "A4" surface that holds the candidate-header
  // band at the top + the main 2-column table (sidebar + main) below.
  //
  // The photo (when in sidebar-top/bottom) is an `<img>` with inline
  // `border-radius:50%`. We identify it by that styling marker plus
  // by its presence inside the sidebar `<td>` (bgcolor=navy).

  // v1.50.29 â€” return ALL preview-paper elements. The PWA can mount
  // BOTH the CV paper and the CL paper at the same time (dual-view
  // mode, print preview, or simply because both renderers are wired
  // in parallel). Earlier versions returned only the FIRST one via
  // querySelector, which meant `applyLayout` could find the original
  // photo in the CV paper but then clone it into the CL paper's main
  // TD when CL happened to appear first in DOM order â€” the photo
  // would visually move from the CV sidebar to the COVER LETTER's
  // body. The new `pickActivePaper` function disambiguates by picking
  // the paper that actually contains the original photo, so the
  // clone always lands in the same paper as the source.
  function findAllPapers() {
    return Array.from(document.querySelectorAll('.antcv-preview-paper'));
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

  // v1.50.29 â€” pick the paper to operate on. Strategy:
  //   1. Iterate every .antcv-preview-paper in the document.
  //   2. Return the first one whose findOriginalPhoto returns a
  //      non-null img â€” that's the paper where the photo physically
  //      lives, and where the clone MUST also land so the user's
  //      "move photo to main column" intent stays inside the CV.
  //   3. If no paper has a photo (user has no photo set), fall back
  //      to the first paper so cleanup paths (clearExistingClones,
  //      setOriginalVisible no-op) still run somewhere.
  // Returns { paper, original } so callers don't have to call
  // findOriginalPhoto a second time.
  function pickActivePaper() {
    const papers = findAllPapers();
    if (!papers.length) return { paper: null, original: null };
    for (const p of papers) {
      const img = findOriginalPhoto(p);
      if (img) return { paper: p, original: img };
    }
    return { paper: papers[0], original: null };
  }

  // Backward-compatible alias. The MutationObserver bootstrap below
  // and the click/storage handlers all call findPaper(); keeping the
  // function name avoids invasive churn through the rest of the file.
  function findPaper() {
    return pickActivePaper().paper;
  }

  // The header band is the navy table that sits above the main 2-col
  // table inside the preview paper. We identify it as: the FIRST table
  // child of the paper whose top-level cells carry the candidate-band
  // navy bgcolor. The original v1.40.137 probe required exactly 1
  // row Ã— 1 cell which silently broke once the candidate band picked
  // up multi-cell layouts. The new probe is shape-agnostic: any table
  // whose first row's first TD has the same bgcolor as the paper's
  // root-level navy band counts. As a safety net we also accept the
  // FIRST <table> in document order â€” that's always the band on the
  // current renderer.

  function findHeaderTable(paper) {
    const tables = Array.from(paper.querySelectorAll('table'));
    if (!tables.length) return null;
    // Fast path: first table is the band.
    const first = tables[0];
    // Sanity check â€” does it look like the header band? It must NOT
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
    // Fallback â€” return null rather than mistakenly returning the
    // main table as the header band.
    return null;
  }

  // The main two-column table (sidebar + main). We need it both for
  // findMainTd() and findSidebarTd() â€” the band-overlap clone needs
  // the sidebar TD as its insertion point.
  // v1.50.153 â€” PHOTO-ANCHORED finders.
  // The previous finders keyed the sidebar/main split off the cells' `bgcolor`
  // attribute (navy vs white). The current renderer dropped `bgcolor` (the
  // navy/white now comes from CSS) and merged the band + 2-col layout into a
  // SINGLE table whose rows carry [sidebar, main] cells â€” so the bgcolor probes
  // matched nothing and all four non-sidebar positions silently did nothing
  // (probe: headerTable/mainTd/sidebarTd all false, clones 0).
  //
  // app.js always renders the profile photo inside the SIDEBAR column, so we
  // anchor off the ORIGINAL photo: its own <td> IS the sidebar cell, and the
  // main cell is that row's sibling. This is independent of bgcolor/CSS. The
  // legacy bgcolor probes are kept as a fallback for older renderers.

  // Legacy 2-col table (a table with at least one 2+ cell row).
  function findTwoColTable(paper) {
    const tables = paper.querySelectorAll('table');
    for (const t of tables) {
      const rows = t.querySelectorAll(':scope > tbody > tr, :scope > tr');
      for (const row of rows) {
        if (row.querySelectorAll(':scope > td').length >= 2) return t;
      }
    }
    return null;
  }

  function findSidebarTd(paper) {
    // Primary: the cell that holds the original photo.
    const img = findOriginalPhoto(paper);
    if (img && typeof img.closest === 'function') {
      const td = img.closest('td');
      if (td) return td;
    }
    // Fallback: the non-white cell of a 2-col row (legacy bgcolor renderer).
    const t = findTwoColTable(paper);
    if (t) {
      const rows = t.querySelectorAll(':scope > tbody > tr, :scope > tr');
      for (const row of rows) {
        const cells = row.querySelectorAll(':scope > td');
        if (cells.length >= 2) {
          for (const td of cells) {
            const bg = (td.getAttribute('bgcolor') || '').toLowerCase();
            if (bg && bg !== '#ffffff' && bg !== 'white' && bg !== 'ffffff') return td;
          }
        }
      }
    }
    return null;
  }

  function findMainTable(paper) {
    const sb = findSidebarTd(paper);
    if (sb && typeof sb.closest === 'function') {
      const t = sb.closest('table');
      if (t) return t;
    }
    return findTwoColTable(paper);
  }

  function findMainTd(paper) {
    // Primary: the sidebar cell's row sibling (the other column).
    const sb = findSidebarTd(paper);
    if (sb && typeof sb.closest === 'function') {
      const row = sb.closest('tr');
      if (row) {
        const sibs = Array.from(row.children).filter(function (c) { return c.tagName === 'TD'; });
        const other = sibs.find(function (td) { return td !== sb; });
        if (other) return other;
      }
    }
    // Fallback: the white cell of a 2-col row (legacy bgcolor renderer).
    const t = findMainTable(paper);
    if (t) {
      const rows = t.querySelectorAll(':scope > tbody > tr, :scope > tr');
      for (const row of rows) {
        const cells = row.querySelectorAll(':scope > td');
        if (cells.length >= 2) {
          for (const td of cells) {
            const bg = (td.getAttribute('bgcolor') || '').toLowerCase();
            if (bg === '#ffffff' || bg === 'white' || bg === 'ffffff') return td;
          }
        }
      }
    }
    return null;
  }

  // â”€â”€â”€ Clone the photo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // Common attributes â€” fine-tune below per position.
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
        // app.js from the user's Settings â†’ photo diameter). We read
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
    // 3. computed style (last resort â€” only works post-layout)
    try {
      const rect = img.getBoundingClientRect();
      if (rect && rect.width > 8) return rect.width;
    } catch (_) {}
    return 96;
  }

  // â”€â”€â”€ Layout application â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
    // v1.50.29 â€” pick the paper that owns the photo. Earlier code
    // called findPaper() then findOriginalPhoto(paper) separately,
    // which meant the chosen paper could be one without a photo
    // (e.g. the cover letter), and findOriginalPhoto would then
    // return null while findMainTd / findHeaderTable / findSidebarTd
    // still succeeded against the WRONG paper. Net effect: nothing
    // happened â€” except the user's previous photo placement stayed
    // wherever the last successful clone went, which on a fresh
    // dual-view session was the CL paper. pickActivePaper now
    // returns paper + photo as a matched pair.
    const { paper, original } = pickActivePaper();
    if (!paper) return;

    const position = readPosition();
    // Always start from a clean slate. Sweep clones from BOTH papers
    // so a previously-mounted photo in the wrong paper (the bug this
    // fix addresses) is cleared even after the user switches setting.
    for (const p of findAllPapers()) {
      clearExistingClones(p);
    }

    // Sidebar positions: original is correct; nothing to do (and the
    // app.js render itself hides/shows for sidebar-bottom vs top).
    if (position === 'sidebar-top' || position === 'sidebar-bottom') {
      setOriginalVisible(original, true);
      return;
    }

    // PHOTO-SIDEBAR-BRIDGE-001 (1.50.367): band-overlap is rendered NATIVELY
    // by app.js since 1.50.366 (split header band + the medallion hoisted so
    // its midline sits on the seam). This sidecar's clone path targeted the
    // old TABLE-based preview (findSidebarTd) and never stuck on the current
    // div layout (PHOTO-POSITION-196). Leave the original photo visible and
    // let the native render own the straddle.
    if (position === 'band-overlap') {
      setOriginalVisible(original, true);
      return;
    }

    if (position === 'hidden') {
      setOriginalVisible(original, false);
      return;
    }

    // For the four broken positions: hide the original, insert a clone
    // at the target. If we can't find the original (e.g., user has no
    // photo set), there's nothing to clone â€” just bail.
    if (!original) return;
    setOriginalVisible(original, false);

    const clone = buildCloneWrap(original, position);

    if (position === 'header-left' || position === 'header-right') {
      // Prefer a dedicated header band table; the current single-table
      // renderer has none, so fall back to the TOP of the main column (the
      // photo then reads as a header-area photo above the first content).
      const header = findHeaderTable(paper);
      let cell = null;
      if (header) {
        const td = header.querySelector(':scope > tbody > td, :scope > tbody > tr > td, :scope > tr > td');
        cell = td || header;
      } else {
        cell = findMainTd(paper);
      }
      // Never leave the photo hidden with no clone â€” restore the original.
      if (!cell) { setOriginalVisible(original, true); return; }
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
      if (!mainTd) { setOriginalVisible(original, true); return; }
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
      if (!sidebarTd) { setOriginalVisible(original, true); return; }
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

  // â”€â”€â”€ Observers + triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  //
  // We re-apply on:
  //   - MutationObserver hits on the paper (debounced)
  //   - `storage` events (cross-tab changes)
  //   - `click` events anywhere on the document (same-tab Settings
  //     button taps â€” `storage` doesn't fire same-tab, so we treat
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
      // Tiny debounce â€” let app.js write to localStorage first.
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
