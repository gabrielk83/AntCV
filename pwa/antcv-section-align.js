/* AntCV section-alignment + drag-handles sidecar (v1.40.178)
 * ============================================================
 * v1.40.178 change: cycle order is now Center → Justify → Left →
 * Right (was Left → Center → Right → Justify). The section-panel
 * cycler is now the sole owner of section-default CJLR — the
 * duplicate cycler that antcv-item-align.js used to append at
 * row-end has been removed (it was floating into the preview top
 * bar in v1.40.177).
 *
 * v1.40.127 functionality below remains in effect.
 * ============================================================
 * Three cooperating features in one sidecar:
 *
 *  1. CJLR alignment cycler — small Left / Center / Right / Justify
 *     button on every CV/CL section's top-right corner. One click
 *     advances the alignment. Persists per-section.
 *
 *  2. Table-edge width drag — thin draggable handles on BOTH outer
 *     edges of every table-resize-wrap. Drag either edge horizontally
 *     to enlarge/decrease the whole table; the table stays centred
 *     so dragging either edge produces a symmetric resize. The
 *     existing column splitter INSIDE the wrap still works for
 *     column-ratio changes (long-press triggered, different cursor).
 *
 *  3. Sidebar/main split drag — replaces the buggy handler in app.js
 *     (which has a Safari pointer-capture issue per the v1.40.115
 *     debt note). The existing 28-px splitter element rendered by
 *     app.js stays in the DOM for visual continuity; this sidecar
 *     attaches a capture-phase pointerdown listener that intercepts
 *     the event BEFORE React's delegated handler runs, stops
 *     propagation, then runs the same clean drag pattern used for
 *     the table edges. Writes the new ratio to localStorage
 *     `cvSidebarRatio` (same key app.js uses) and re-applies the
 *     sidebar column's width via MutationObserver so React re-
 *     renders don't snap back to a stale state.
 *
 * Shared infrastructure: a `makeDragHandle()` helper provides the
 * pointer-capture + move + up + cancel + double-click-reset state
 * machine, parameterised by a `delta → new width` function. All
 * three drag features (left edge, right edge, sidebar) use it; the
 * differences are 4-5 lines each.
 *
 * Contract with app.js
 * --------------------
 *   - `[data-sid="<section_id>"]`         — alignment cycler attaches here
 *   - `[data-table-resize-wrap="true"]`   — table-edge handles attach here
 *   - `.antcv-col-splitter`               — sidebar drag intercepts here
 *   - `localStorage.personalInfo.stylePrefs.{sectionAlignment, tableWidthPct}`
 *   - `localStorage.cvSidebarRatio`       — number 0..1 (existing key)
 *
 * Render contract
 * ---------------
 * A MutationObserver catches each React commit and re-applies the
 * three persisted state types (alignment, table width, sidebar
 * ratio). Re-apply is unconditional; cheap and idempotent.
 *
 * Excluded sections
 * -----------------
 * Header pieces (`name_block`, `spec_block`, `contact_line`) get no
 * cycler — the existing `Fe` cycler in app.js already handles
 * alignment for those.
 */
(function () {
  'use strict';

  // v1.40.203: Do not inject or rearrange any buttons inside the React-owned
  // Section panel. The panel became stuck on both desktop and mobile after
  // late sidecar button additions/reordering. Preview alignment and table
  // handles remain active; only panel button injection is disabled.
  const DISABLE_SECTION_PANEL_BUTTON_INJECTION = true;

  // ─── Constants ────────────────────────────────────────────────────

  const STORAGE_KEY = 'personalInfo';
  const PREFS_KEY = 'stylePrefs';
  const FIELD = 'sectionAlignment';

  // Cycle order (v1.40.178): Center → Justify → Left → Right → Center.
  // 'left' is the default render and shown when no entry exists, but
  // the cycle starts at center per the v1.40.178 product brief.
  const ALIGNMENTS = ['center', 'justify', 'left', 'right'];

  // Cycler is suppressed on these section ids — they have their own
  // alignment control surfaced elsewhere in Settings or are decorative.
  const SKIP_SECTION_IDS = new Set([
    'name_block',
    'spec_block',
    'contact_line',
  ]);

  // Unicode glyphs for the cycler face. Each face shows the CURRENT
  // alignment; clicking advances to the NEXT one. Using monospace box
  // characters keeps the button width stable across the four states.
  const ICONS = {
    left:    '\u2630\uFE0E',   // ≡ trigram-like — three left-justified bars
    center:  '\u2261\uFE0E',   // ≡ centered bars
    right:   '\u2634\uFE0E',   // right-justified bars
    justify: '\u2630\uFE0E',   // full-width — visually similar but we relabel
  };
  // Labels override icons for clarity (icons are imperfect for L/J).
  const LABELS = { left: 'L', center: 'C', right: 'R', justify: 'J' };
  const TITLES = {
    left:    'Aligned left — click to center',
    center:  'Aligned center — click to align right',
    right:   'Aligned right — click to justify',
    justify: 'Justified — click to align left',
  };

  // Selector that finds every text-bearing element we want to align
  // inside a section. Editable spans are the primary target; nested
  // divs (e.g. table cells) are also picked up so non-editable read
  // mode reflects the same alignment.
  const TEXT_TARGET_SELECTOR =
    '[data-antcv-editable-text="true"], [data-edit-path]';

  // ─── Storage helpers ──────────────────────────────────────────────

  function readPi() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (_) { return {}; }
  }

  function writePi(pi) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pi)); }
    catch (e) { console.error('[section-align] localStorage write failed:', e); }
  }

  function readAlignment(sectionId) {
    const pi = readPi();
    const map = (pi[PREFS_KEY] && pi[PREFS_KEY][FIELD]) || {};
    const v = map[sectionId];
    return ALIGNMENTS.indexOf(v) >= 0 ? v : 'left';
  }

  function writeAlignment(sectionId, value) {
    const pi = readPi();
    if (!pi[PREFS_KEY]) pi[PREFS_KEY] = {};
    if (!pi[PREFS_KEY][FIELD]) pi[PREFS_KEY][FIELD] = {};
    pi[PREFS_KEY][FIELD][sectionId] = value;
    writePi(pi);
    // Tell the React app something changed. Format-prefs uses the same
    // event name, which is what triggers a re-render in app.js.
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'section-align', sectionId, alignment: value },
      }));
    } catch (_) {}
  }

  function nextAlignment(current) {
    const i = ALIGNMENTS.indexOf(current);
    return ALIGNMENTS[(i + 1) % ALIGNMENTS.length];
  }

  // ─── DOM application ──────────────────────────────────────────────

  // Apply alignment to every text target inside the given section.
  // Marker attribute (`data-antcv-aligned`) lets a future React
  // render's MutationObserver detect when our patch was overwritten
  // and re-apply. We do not remove the marker on revert because
  // text-align: left is the natural default and React's empty style
  // matches it.
  function applyAlignmentToSection(sectionEl, alignment) {
    if (!sectionEl) return;
    // v1.50.80 — idempotency: only write when the value differs. These ran
    // unconditionally every reapply pass; combined with the woken-by-everything
    // observer that was ~33 attribute mutations/sec (data-antcv-aligned), a
    // contributor to the re-render storm. Stable state now produces no writes.
    if (sectionEl.getAttribute('data-antcv-align') !== alignment) sectionEl.setAttribute('data-antcv-align', alignment);
    const targets = sectionEl.querySelectorAll(TEXT_TARGET_SELECTOR);
    for (const t of targets) {
      // Skip targets that live inside a child section (nested data-sid).
      // Each section owns its own alignment; the inner one wins.
      const owner = t.closest('[data-sid]');
      if (owner !== sectionEl) continue;
      // TABLE-HEADER-CENTER-001 (owner 2026-06-14): table HEADER cells (<th>)
      // are CENTER by default (React renders textAlign:center) and are owned by
      // their own per-header control — NOT the section-level body cycler. The
      // default 'left' here was overriding the React center on every reapply
      // pass, so every table header looked left-aligned. Leave <th> editables
      // alone; the body cells + text still follow the section alignment. The
      // export already defaults the header to center (worker s.headerAlign).
      if (t.closest('th')) continue;
      if (t.style.textAlign !== alignment) t.style.textAlign = alignment;
      if (t.getAttribute('data-antcv-aligned') !== alignment) t.setAttribute('data-antcv-aligned', alignment);
    }
    // Also align the section block itself so block-level elements
    // (like single-line headers) line up.
    if (sectionEl.style.textAlign !== alignment) sectionEl.style.textAlign = alignment;
  }

  // ─── Cycler button ────────────────────────────────────────────────

  function makeCyclerButton(sectionId, sectionEl) {
    const initial = readAlignment(sectionId);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'antcv-align-cycler';
    btn.setAttribute('data-antcv-align-cycler', '1');
    btn.setAttribute('data-section-id', sectionId);
    btn.setAttribute('aria-label', TITLES[initial]);
    btn.title = TITLES[initial];
    btn.textContent = LABELS[initial];
    btn.dataset.alignment = initial;

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const cur = btn.dataset.alignment || 'left';
      const nxt = nextAlignment(cur);
      btn.dataset.alignment = nxt;
      btn.textContent = LABELS[nxt];
      btn.title = TITLES[nxt];
      btn.setAttribute('aria-label', TITLES[nxt]);
      writeAlignment(sectionId, nxt);
      applyAlignmentToSection(sectionEl, nxt);
    });

    return btn;
  }

  // ─── Section-panel CJLR cyclers ────────────────────────────────
  //
  // Per the v1.40.129 refresh: the alignment cyclers belong in the
  // section panel rows (matching how app.js renders the built-in `Fe`
  // cycler for name_block / spec_block / contact_line), NOT as floating
  // buttons in the preview area. Same visual style as `Fe`:
  //   28×28 button, 1px solid #01B7BB border, rgba(1,183,187,0.10) bg,
  //   #00746E text, glyphs ⇤ ↔ ⇥ ☰ for L/C/R/J.
  //
  // Mapping each panel row to a section ID
  // ---------------------------------------
  // Rows expose `data-section-row-index` (numeric) and
  // `data-section-row-loc` ('sidebar' | 'main'). app.js builds the panel
  // from `Pi.filter(e => "sidebar" === e.loc)` where `Pi = ro[Lt]` is
  // the current doc's sections array. Mirror that: read CV/CL sections
  // from localStorage, detect which doc is active by matching the first
  // sidebar row's title text against each doc's first sidebar section,
  // then filter+index per row.

  const PANEL_GLYPHS = { left: '⇤', center: '↔', right: '⇥', justify: '☰' };

  function readSectionsFromLs(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : null;
    } catch (_) { return null; }
  }

  // Best-effort: figure out whether the panel currently shows CV or CL
  // sections, by matching the first sidebar row's title text against
  // each doc's first sidebar section title (case-insensitive prefix).
  // Falls back to whichever has data if matching fails.
  function detectActiveSections() {
    const cv = readSectionsFromLs('cv_pwa_sections');
    const cl = readSectionsFromLs('cl_pwa_sections');
    const firstRow = document.querySelector(
      '[data-section-row-loc="sidebar"][data-section-row-index="0"]'
    );
    if (firstRow) {
      const titleEl = firstRow.children && firstRow.children[1];
      const titleText = (titleEl && titleEl.textContent || '').trim().toLowerCase();
      const tryMatch = (sections) => {
        if (!Array.isArray(sections) || !sections.length) return false;
        const first = sections.filter(s => s.loc === 'sidebar')[0];
        if (!first || !first.title) return false;
        const prefix = String(first.title).toLowerCase().slice(0, 4);
        return prefix && titleText.startsWith(prefix);
      };
      if (tryMatch(cv)) return cv;
      if (tryMatch(cl)) return cl;
    }
    return (cv && cv.length) ? cv : (cl || []);
  }

  function makePanelCycler(sectionId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'antcv-panel-cjlr';
    btn.setAttribute('data-antcv-sid', sectionId);
    btn.setAttribute('data-antcv-align-cycler', 'panel');

    // Match the `Fe` component's inline style exactly so the panel row
    // feels uniform — built-in cyclers and ours are visually identical.
    Object.assign(btn.style, {
      width: '28px',
      minWidth: '28px',
      height: '28px',
      borderRadius: '8px',
      border: '1px solid #01B7BB',
      background: 'rgba(1, 183, 187, 0.10)',
      color: '#00746E',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      lineHeight: '1',
      padding: '0',
    });

    function refreshGlyph() {
      const cur = readAlignment(sectionId);
      btn.textContent = PANEL_GLYPHS[cur] || PANEL_GLYPHS.left;
      btn.title = 'CJLR alignment — current: ' + cur + ' (click to cycle)';
      btn.setAttribute('aria-label', 'CJLR alignment cycler — current: ' + cur);
    }
    refreshGlyph();

    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      const cur = readAlignment(sectionId);
      const next = nextAlignment(cur);
      writeAlignment(sectionId, next);
      refreshGlyph();
      // Apply visually immediately — wait for the next frame so any
      // localStorage-watching React effects can re-render first.
      requestAnimationFrame(() => reapplyAlignmentEverywhere(document));
    });

    return btn;
  }

  function injectPanelCyclersInto(root) {
    const rows = (root || document).querySelectorAll(
      '[data-section-row-index][data-section-row-loc]'
    );
    if (!rows.length) return;

    const sections = detectActiveSections();
    if (!sections.length) return;

    // Pre-filter by loc once for O(1) row→section lookup.
    const byLoc = { sidebar: [], main: [] };
    for (const s of sections) {
      if (s && (s.loc === 'sidebar' || s.loc === 'main')) {
        byLoc[s.loc].push(s);
      }
    }

    for (const row of rows) {
      const loc = row.getAttribute('data-section-row-loc');
      const idxRaw = row.getAttribute('data-section-row-index');
      const idx = parseInt(idxRaw, 10);
      if (!loc || !Number.isFinite(idx)) continue;

      const list = byLoc[loc];
      const sec = list && list[idx];
      if (!sec || !sec.id) continue;

      // Skip sections that already have the built-in `Fe` cycler in
      // app.js (name_block, spec_block, contact_line). Inserting a
      // duplicate would look wrong.
      if (SKIP_SECTION_IDS.has(sec.id)) continue;

      // Skip if our cycler was already injected on this row.
      if (row.querySelector(':scope [data-antcv-align-cycler="panel"]')) continue;

      // The row's third child is the action-buttons div (its children
      // are: [up/down column, title text, action buttons]). Insert our
      // cycler at the start of that div so it sits to the LEFT of the
      // blue triangle (matching the built-in placement on Name/Spec/Contact).
      const actionDiv = row.children && row.children[2];
      if (!actionDiv) continue;

      const cycler = makePanelCycler(sec.id);
      actionDiv.insertBefore(cycler, actionDiv.firstChild);
    }
  }

  // Refresh all existing panel-cycler glyphs to reflect the current
  // alignment state (in case localStorage was mutated externally —
  // e.g., reset-all in Settings).
  function refreshPanelCyclerGlyphs() {
    const cyclers = document.querySelectorAll('[data-antcv-align-cycler="panel"]');
    for (const btn of cyclers) {
      const sid = btn.getAttribute('data-antcv-sid');
      if (!sid) continue;
      const cur = readAlignment(sid);
      const glyph = PANEL_GLYPHS[cur] || PANEL_GLYPHS.left;
      if (btn.textContent !== glyph) btn.textContent = glyph;
    }
  }


  // Re-apply persisted alignment for every section that has an entry.
  // Always re-applies (no have-vs-want shortcut) because React's commit
  // overwrites the inline `style.textAlign` on child editables without
  // touching our section-level marker — so a section can look aligned
  // at the wrapper level while its children have drifted back to the
  // default. Re-applying is cheap (one querySelectorAll + style write
  // per section) and idempotent, so doing it on every observer pass
  // is the right tradeoff.
  function reapplyAlignmentEverywhere(root) {
    const sections = (root || document).querySelectorAll('[data-sid]');
    for (const s of sections) {
      const sid = s.getAttribute('data-sid');
      if (!sid || SKIP_SECTION_IDS.has(sid)) continue;
      applyAlignmentToSection(s, readAlignment(sid));
    }
  }

  // ─── Table-edge width drag ────────────────────────────────────────
  //
  // The existing column splitter inside [data-table-resize-wrap] is a
  // 24-px-wide handle at the column boundary that adjusts the LEFT/
  // RIGHT column ratio (long-press + drag, cursor:col-resize, zIndex 3).
  // It does NOT change the table's overall width — the wrap is fixed
  // at `width: 72%; maxWidth: 540px` in inline style.
  //
  // To support overall-width resizing the user reasonably expects,
  // this section adds a thin handle on the right outer edge of the
  // wrap. Drag it left/right to make the whole table narrower or wider.
  // Stored as a percentage of the section content area (clamped to
  // a sane range so the table can't disappear or escape the page).
  //
  // The wrap has `margin: 8px auto 0`, so it stays horizontally
  // centred — resizing only the right edge looks symmetric to the
  // user. No left handle is needed.
  //
  // Coexistence with the existing column splitter:
  //   - This handle sits OUTSIDE the wrap (right: -4px), the splitter
  //     sits INSIDE (left: col%-12px). They never overlap.
  //   - This handle uses cursor `ew-resize`, splitter uses `col-resize`.
  //   - This handle triggers on plain pointerdown, splitter requires a
  //     360-ms long-press. Brief mouse downs go to this handle; long
  //     presses still wake the splitter.

  const TABLE_WIDTH_FIELD = 'tableWidthPct';
  const TABLE_WIDTH_MIN = 30;
  // v1.40.134 → v1.40.135 — raised from 100 to 115 so the table can
  // extend further past each column edge. 7.5% of a ~6.27" A4 main
  // column ≈ 0.47" per side, which gives genuine breathing room for
  // CL "WHAT I BRING" content (the previous 107%/0.22" was visibly
  // too tight — there was lots of unused space between the table and
  // the column edge by default). The 1.40.134 negative-margin bleed
  // still applies above TABLE_BLEED_THRESHOLD.
  const TABLE_WIDTH_MAX = 115;
  // The width threshold above which we switch on the bleed-out
  // negative-margin treatment. Any value <= 100 stays inside its
  // parent section, centred via margin:auto.
  const TABLE_BLEED_THRESHOLD = 100;
  const TABLE_DEFAULT_PCT = 72;
  const HANDLE_HIT_WIDTH = 8;   // px — wide enough to click without zoom
  const HANDLE_OFFSET_RIGHT = -4; // px outside the wrap

  // TABLE-WIDTH-CLOBBER-001 (owner 2026-06-15): "as soon as I press PDF the
  // table resizes to its original size — which is what's exported." Root cause:
  // the table width lived in personalInfo.stylePrefs.tableWidthPct, and the
  // cloud-restore / personalInfo-sync machinery rewrites personalInfo from a
  // copy that predates the drag, DROPPING tableWidthPct on export. The column
  // RATIO never had this bug because it lives in a STANDALONE key
  // (cl/cvTableRatio). Fix: move the width to its own standalone key too, so it
  // is immune to every personalInfo rewrite. A pre-existing value still nested
  // in personalInfo is read as a fallback and migrated on first read/write.
  const TABLE_WIDTH_LS_KEY = 'antcv:tableWidthPct';

  function readTableWidthMap() {
    // Standalone key is the source of truth.
    try {
      const raw = localStorage.getItem(TABLE_WIDTH_LS_KEY);
      if (raw) { const m = JSON.parse(raw); if (m && typeof m === 'object') return m; }
    } catch (_) {}
    // Back-compat: pre-fix value nested in personalInfo.stylePrefs.
    try {
      const pi = readPi();
      const m = pi[PREFS_KEY] && pi[PREFS_KEY][TABLE_WIDTH_FIELD];
      if (m && typeof m === 'object') return m;
    } catch (_) {}
    return {};
  }

  function writeTableWidthMap(map) {
    try { localStorage.setItem(TABLE_WIDTH_LS_KEY, JSON.stringify(map || {})); }
    catch (e) { console.error('[section-align] tableWidth write failed:', e); }
  }

  // One-time migration at init: lift any pre-fix nested value into the
  // standalone key BEFORE the first export can clobber personalInfo.
  function migrateTableWidthToStandalone() {
    try {
      if (localStorage.getItem(TABLE_WIDTH_LS_KEY)) return; // already standalone
      const pi = readPi();
      const m = pi[PREFS_KEY] && pi[PREFS_KEY][TABLE_WIDTH_FIELD];
      if (m && typeof m === 'object' && Object.keys(m).length) writeTableWidthMap(m);
    } catch (_) {}
  }
  migrateTableWidthToStandalone();

  function readTableWidth(sectionId) {
    const map = readTableWidthMap();
    const v = Number(map[sectionId]);
    if (!Number.isFinite(v)) return null;
    return Math.max(TABLE_WIDTH_MIN, Math.min(TABLE_WIDTH_MAX, v));
  }

  function writeTableWidth(sectionId, pct) {
    const clamped = Math.max(TABLE_WIDTH_MIN, Math.min(TABLE_WIDTH_MAX, Number(pct) || TABLE_DEFAULT_PCT));
    const map = readTableWidthMap();
    map[sectionId] = clamped;
    writeTableWidthMap(map);
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'section-align', sectionId, tableWidthPct: clamped },
      }));
    } catch (_) {}
  }

  // Return the [data-sid] section id that owns the given table-wrap.
  // Returns null if the wrap is unparented or not under a known section.
  function sectionIdFor(wrapEl) {
    const owner = wrapEl.closest && wrapEl.closest('[data-sid]');
    if (!owner) return null;
    const sid = owner.getAttribute('data-sid');
    return SKIP_SECTION_IDS.has(sid) ? null : sid;
  }

  // Apply the persisted width to the wrap. The wrap also has an inline
  // maxWidth:540 set by React; once the user drags wider than that we
  // override it. The override is conservative: only when persisted
  // pct × section-width > 540.
  //
  // v1.40.134 — When pct > 100 ("bleed mode"), the wrap also needs
  // to extend beyond its parent section. CSS percentage margins are
  // computed against the parent's *content* width, so setting
  // `margin-left: -X%` shifts the wrap left by X% of the parent. By
  // pairing a wider `width: ${pct}%` with a centred negative margin
  // of `(pct - 100) / 2` per side, the wrap renders centred on the
  // column with the overflow split evenly into the left and right
  // margins. The parent (the section row) has overflow:visible so
  // the bleed is visually rendered, not clipped.
  function applyTableWidth(wrapEl, sectionId) {
    const pct = readTableWidth(sectionId);
    if (pct == null) return;  // no persisted override
    wrapEl.style.width = pct + '%';
    // Allow the wrap to grow beyond the React-inlined 540px cap when
    // the persisted percentage demands it. Computed against the parent
    // (section) width so it stays bounded.
    const parent = wrapEl.parentElement;
    if (parent) {
      const parentW = parent.getBoundingClientRect().width;
      if (parentW > 0 && parentW * pct / 100 > 540) {
        wrapEl.style.maxWidth = 'none';
      }
    }
    // v1.40.135 — Force-centre the wrap regardless of inherited styles.
    // For pct ≤ 100, use `margin: auto` so the table sits in the
    // middle of its parent column (the default React-inlined wrap
    // appears to leave it left-aligned, leaving visible whitespace on
    // the right side). For pct > 100, the negative-margin bleed
    // already centres the overflow symmetrically.
    if (pct > TABLE_BLEED_THRESHOLD) {
      const overflowPct = (pct - 100) / 2;
      wrapEl.style.marginLeft = '-' + overflowPct.toFixed(3) + '%';
      wrapEl.style.marginRight = '-' + overflowPct.toFixed(3) + '%';
    } else {
      // Centred via margin:auto when the wrap is narrower than its
      // parent column. This replaces the previous "clear to inherited"
      // behaviour which left the table left-aligned on default widths.
      wrapEl.style.marginLeft = 'auto';
      wrapEl.style.marginRight = 'auto';
    }
    wrapEl.setAttribute('data-antcv-table-pct', String(pct));
  }

  // ─── Generic drag handle (used by table edges and sidebar split) ─
  //
  // makeDragHandle returns a DOM element with proper pointer-capture
  // handling. Caller provides:
  //   - className     — CSS class for styling the handle
  //   - role/title    — accessibility metadata
  //   - onStart(ev)   — capture initial state, return any context
  //   - onMove(ev, ctx, dx) — called on every pointermove with delta-x
  //   - onEnd(ctx)    — called on pointerup / pointercancel
  //   - onReset()     — called on double-click, optional
  //
  // The state machine handles: button-filter, preventDefault on the
  // initial down, setPointerCapture (with try/catch — Safari sometimes
  // throws but the rest of the drag still works), classList.dragging,
  // documentElement.cursor, and clean release on cancel.
  function makeDragHandle({ className, role, title, ariaLabel, ariaOrientation,
                            onStart, onMove, onEnd, onReset, stopPropagation = true }) {
    const el = document.createElement('div');
    if (className) el.className = className;
    el.setAttribute('role', role || 'separator');
    el.setAttribute('aria-orientation', ariaOrientation || 'vertical');
    if (ariaLabel) el.setAttribute('aria-label', ariaLabel);
    if (title) el.title = title;
    el.tabIndex = 0;

    const state = { active: false, ctx: null, startX: 0, pointerId: null };

    function down(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault();
      if (stopPropagation) ev.stopPropagation();
      state.startX = ev.clientX || 0;
      state.pointerId = ev.pointerId;
      try { state.ctx = onStart(ev) || {}; }
      catch (e) { console.warn('[drag] onStart threw:', e); return; }
      state.active = true;
      try { el.setPointerCapture(ev.pointerId); } catch (_) {}
      el.classList.add('dragging');
      document.documentElement.style.cursor = 'ew-resize';
      document.documentElement.classList.add('antcv-dragging');
    }
    function move(ev) {
      if (!state.active) return;
      ev.preventDefault();
      const dx = (ev.clientX || 0) - state.startX;
      try { onMove(ev, state.ctx, dx); }
      catch (e) { console.warn('[drag] onMove threw:', e); }
    }
    function up(ev) {
      if (!state.active) return;
      state.active = false;
      try { el.releasePointerCapture(ev.pointerId); } catch (_) {}
      el.classList.remove('dragging');
      document.documentElement.style.cursor = '';
      document.documentElement.classList.remove('antcv-dragging');
      try { onEnd(state.ctx); }
      catch (e) { console.warn('[drag] onEnd threw:', e); }
      state.ctx = null;
    }

    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    // Window-level fallback: if pointer capture is released mid-drag
    // (Safari does this when the cursor leaves the viewport), catch the
    // pointerup at the window level so we don't get stuck in "dragging"
    // forever. This is the v1.40.115 debt note's bug.
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    if (onReset) {
      el.addEventListener('dblclick', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        try { onReset(); } catch (e) { console.warn('[drag] onReset threw:', e); }
      });
    }

    return el;
  }

  // ─── Table-edge handles (left + right) ────────────────────────────
  //
  // Both edges run the same drag arithmetic: each pixel the mouse moves
  // OUTWARD from the wrap centre makes the table wider by ~2 px (the
  // wrap has `margin: auto` so it stays centred — growing from one side
  // visually grows from both). The handles thus drag in OPPOSITE
  // directions to enlarge the table:
  //   - right handle: dx_mouse positive → wider
  //   - left handle:  dx_mouse negative → wider
  //
  // We use ONE shared persistence record (`tableWidthPct[sectionId]`)
  // so either handle reflects the current state.

  function makeTableEdgeHandle(wrapEl, sectionId, side /* 'left' | 'right' */) {
    return makeDragHandle({
      className: 'antcv-table-edge-handle antcv-table-edge-' + side,
      role: 'separator',
      ariaOrientation: 'vertical',
      ariaLabel: 'Resize table width — drag horizontally',
      title: 'Drag to resize the whole table (double-click to reset)',
      onStart() {
        const wrapRect = wrapEl.getBoundingClientRect();
        const parent = wrapEl.parentElement;
        const parentRect = parent ? parent.getBoundingClientRect() : null;
        if (!parentRect || parentRect.width <= 0) throw new Error('no parent width');
        return {
          startWidthPx: wrapRect.width,
          sectionW: parentRect.width,
        };
      },
      onMove(ev, ctx, dx) {
        // Mirror the right edge for the left handle.
        const widthDeltaPx = side === 'right' ? dx : -dx;
        const newWidthPx = ctx.startWidthPx + widthDeltaPx;
        const pct = (newWidthPx / ctx.sectionW) * 100;
        const clamped = Math.max(TABLE_WIDTH_MIN, Math.min(TABLE_WIDTH_MAX, pct));
        wrapEl.style.width = clamped + '%';
        if (ctx.sectionW * clamped / 100 > 540) {
          wrapEl.style.maxWidth = 'none';
        }
        // v1.40.134 — live bleed-out treatment during drag, so the
        // user sees the table extending past the column edge as they
        // pull, not just on release.
        // v1.40.135 — centre via margin:auto below the bleed threshold
        // so the live preview during drag mirrors the rest-state.
        if (clamped > TABLE_BLEED_THRESHOLD) {
          const overflowPct = (clamped - 100) / 2;
          wrapEl.style.marginLeft = '-' + overflowPct.toFixed(3) + '%';
          wrapEl.style.marginRight = '-' + overflowPct.toFixed(3) + '%';
        } else {
          wrapEl.style.marginLeft = 'auto';
          wrapEl.style.marginRight = 'auto';
        }
        wrapEl.setAttribute('data-antcv-table-pct', String(Math.round(clamped * 10) / 10));
      },
      onEnd() {
        const measured = parseFloat(wrapEl.getAttribute('data-antcv-table-pct') || '');
        if (Number.isFinite(measured)) writeTableWidth(sectionId, measured);
      },
      onReset() {
        wrapEl.style.width = TABLE_DEFAULT_PCT + '%';
        wrapEl.style.maxWidth = '';
        // v1.40.135 — default reset position is also centred via margin:auto.
        wrapEl.style.marginLeft = 'auto';
        wrapEl.style.marginRight = 'auto';
        wrapEl.setAttribute('data-antcv-table-pct', String(TABLE_DEFAULT_PCT));
        writeTableWidth(sectionId, TABLE_DEFAULT_PCT);
      },
    });
  }

  function ensureTableEdgeHandlesOn(wrapEl) {
    if (!wrapEl) return;
    const sid = sectionIdFor(wrapEl);
    if (!sid) return;
    const existingRight = wrapEl.querySelector(':scope > [data-antcv-table-edge="right"]');
    const existingLeft = wrapEl.querySelector(':scope > [data-antcv-table-edge="left"]');
    if (!existingRight) {
      const r = makeTableEdgeHandle(wrapEl, sid, 'right');
      r.setAttribute('data-antcv-table-edge', 'right');
      wrapEl.appendChild(r);
    }
    if (!existingLeft) {
      const l = makeTableEdgeHandle(wrapEl, sid, 'left');
      l.setAttribute('data-antcv-table-edge', 'left');
      wrapEl.appendChild(l);
    }
    applyTableWidth(wrapEl, sid);
  }

  function ensureAllTableEdgeHandles(root) {
    const wraps = (root || document).querySelectorAll('[data-table-resize-wrap="true"]');
    for (const w of wraps) ensureTableEdgeHandlesOn(w);
  }

  // ─── Sidebar/main split — replace the buggy handler in app.js ─────
  //
  // app.js renders a 28-px-wide splitter at the sidebar/main boundary,
  // with onPointerDown bound to a function `sa` that has known Safari
  // pointer-capture issues (v1.40.115 debt note). The user-visible
  // symptom is the drag "getting stuck" — the splitter stops responding
  // to pointermove after the cursor leaves the splitter element.
  //
  // We don't have access to the unminified app.js source to fix `sa`
  // directly. Instead we intercept the pointerdown event using a
  // capture-phase listener attached to the splitter DOM node BEFORE
  // it bubbles up to React's delegated handler at the root. Calling
  // ev.stopPropagation() in the capture phase prevents `sa` from
  // running at all; we then run our clean drag and write to the same
  // localStorage key (`cvSidebarRatio`) that `sa` uses, so the next
  // page reload picks up the new value through app.js's normal init.
  //
  // Why the existing visual splitter element is reused (not hidden):
  //   - It stays visually identical to what users already know.
  //   - It already has the correct position (calc(% - 14px)) tied to
  //     the React state. When app.js re-renders for any reason, the
  //     element stays placed correctly without us re-computing.
  //   - We just override its behaviour, not its appearance.

  const SIDEBAR_RATIO_MIN = 0.15;
  const SIDEBAR_RATIO_MAX = 0.55;
  const SIDEBAR_DEFAULT_RATIO = 0.32;
  const SIDEBAR_LOCAL_KEY = 'cvSidebarRatio';

  function readSidebarRatio() {
    try {
      const raw = localStorage.getItem(SIDEBAR_LOCAL_KEY);
      if (raw == null) return null;
      // Accept both raw number and JSON-wrapped number (different app.js
      // versions have written one or the other over time).
      let v = Number(raw);
      if (!Number.isFinite(v)) {
        try { v = Number(JSON.parse(raw)); } catch (_) {}
      }
      if (!Number.isFinite(v)) return null;
      return Math.max(SIDEBAR_RATIO_MIN, Math.min(SIDEBAR_RATIO_MAX, v));
    } catch (_) { return null; }
  }

  function writeSidebarRatio(ratio) {
    const clamped = Math.max(SIDEBAR_RATIO_MIN, Math.min(SIDEBAR_RATIO_MAX, Number(ratio) || SIDEBAR_DEFAULT_RATIO));
    try {
      // app.js writes this key as the bare number string via its
      // `u.set('cvSidebarRatio', n)` helper. Mirror that exactly so
      // either side can read what the other wrote.
      localStorage.setItem(SIDEBAR_LOCAL_KEY, String(clamped));
    } catch (e) {
      console.warn('[section-align] writeSidebarRatio failed:', e);
    }
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'section-align', kind: 'sidebar-ratio', value: clamped },
      }));
    } catch (_) {}
    return clamped;
  }

  // Find the sidebar and main column elements that go with a given
  // splitter. They live as siblings of the splitter inside an
  // `.antcv-page-row` container.
  function siblingsOfSplitter(splitterEl) {
    const row = splitterEl.closest && splitterEl.closest('.antcv-page-row');
    if (!row) return null;
    const sidebar = row.querySelector('.antcv-document-sidebar, [data-antcv-document-sidebar="true"]');
    const main    = row.querySelector('.antcv-document-main, [data-antcv-document-main="true"]');
    if (!sidebar || !main) return null;
    return { row, sidebar, main };
  }

  // Width of our embedded-border splitter — kept in one place so the
  // centring math and the CSS rule below stay in sync. The splitter is
  // a thin hit target along the FULL sidebar/main boundary, not the
  // 28×80 block app.js renders by default. See SPLITTER_WIDTH usage in
  // the CSS injection block at the bottom of this file.
  const SPLITTER_WIDTH = 14;

  function applySidebarRatio(splitterEl, ratio) {
    const sib = siblingsOfSplitter(splitterEl);
    if (!sib) return;
    const pct = (ratio * 100).toFixed(2);
    sib.sidebar.style.width = pct + '%';
    sib.sidebar.style.flexShrink = '0';
    // Centre the splitter on the column boundary. Half-width offset so
    // the visible vertical strip lands exactly on the edge.
    splitterEl.style.left = `calc(${pct}% - ${SPLITTER_WIDTH / 2}px)`;
    splitterEl.setAttribute('data-antcv-sidebar-ratio', String(ratio));
  }

  // Attach our clean drag to a splitter element. Idempotent — guards
  // against double-attaching when the observer fires multiple times.
  function ensureSidebarOverrideOn(splitterEl) {
    if (!splitterEl) return;
    if (splitterEl.getAttribute('data-antcv-sidebar-override') === '1') {
      // Re-apply width in case React clobbered it.
      const ratio = readSidebarRatio();
      if (ratio != null) applySidebarRatio(splitterEl, ratio);
      return;
    }
    splitterEl.setAttribute('data-antcv-sidebar-override', '1');

    function intercept(ev) {
      if (ev.button !== undefined && ev.button !== 0) return;
      // Capture phase: prevent React's delegated `sa` handler at the
      // root from running. Critical — both stopPropagation AND the
      // {capture: true} on addEventListener are needed.
      ev.stopPropagation();
      ev.preventDefault();
      startSidebarDrag(splitterEl, ev);
    }
    splitterEl.addEventListener('pointerdown', intercept, { capture: true });

    // Apply persisted ratio on first attach.
    const ratio = readSidebarRatio();
    if (ratio != null) applySidebarRatio(splitterEl, ratio);
  }

  // The sidebar drag state machine. Lives outside makeDragHandle
  // because we attach via capture-phase on an EXISTING element rather
  // than creating a new element with bubbling listeners.
  function startSidebarDrag(splitterEl, downEv) {
    const sib = siblingsOfSplitter(splitterEl);
    if (!sib) return;
    const rowRect = sib.row.getBoundingClientRect();
    if (rowRect.width <= 0) return;
    const startX = downEv.clientX || 0;
    const startRatio = sib.sidebar.getBoundingClientRect().width / rowRect.width;
    const pointerId = downEv.pointerId;
    try { splitterEl.setPointerCapture(pointerId); } catch (_) {}
    splitterEl.classList.add('dragging');
    document.documentElement.style.cursor = 'ew-resize';
    document.documentElement.classList.add('antcv-dragging');

    let active = true;
    let lastRatio = startRatio;

    function move(ev) {
      if (!active) return;
      ev.preventDefault();
      const dx = (ev.clientX || 0) - startX;
      const newRatio = startRatio + (dx / rowRect.width);
      lastRatio = Math.max(SIDEBAR_RATIO_MIN, Math.min(SIDEBAR_RATIO_MAX, newRatio));
      applySidebarRatio(splitterEl, lastRatio);
    }
    function up(ev) {
      if (!active) return;
      active = false;
      try { splitterEl.releasePointerCapture(pointerId); } catch (_) {}
      splitterEl.classList.remove('dragging');
      document.documentElement.style.cursor = '';
      document.documentElement.classList.remove('antcv-dragging');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      writeSidebarRatio(lastRatio);
    }

    // Attach to WINDOW (not the splitter) so the drag continues even
    // if the cursor leaves the splitter element — which is exactly
    // the Safari bug the existing handler trips over.
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }

  function ensureAllSidebarOverrides(root) {
    const splitters = (root || document).querySelectorAll('.antcv-col-splitter');
    for (const s of splitters) ensureSidebarOverrideOn(s);
  }


  //
  // Light styling: small pill button, no background until hover.
  // Visible enough to find, restrained enough not to clutter the
  // preview. The teal accent matches the rest of the AntCV palette
  // (#00746E for the main column, #01B7BB for sidebar headings).

  function injectStylesOnce() {
    if (document.getElementById('antcv-align-cycler-styles')) return;
    const css = `
      button.antcv-align-cycler {
        position: absolute;
        top: 2px;
        right: 4px;
        z-index: 5;
        min-width: 22px;
        height: 22px;
        padding: 0 6px;
        font-family: Calibri, sans-serif;
        font-size: 11px;
        font-weight: 700;
        line-height: 1;
        color: #00746E;
        background: rgba(255, 255, 255, 0.0);
        border: 1px solid rgba(0, 116, 110, 0.25);
        border-radius: 11px;
        cursor: pointer;
        opacity: 0.35;
        transition: opacity 0.15s, background 0.15s, border-color 0.15s;
      }
      button.antcv-align-cycler:hover,
      button.antcv-align-cycler:focus-visible {
        opacity: 1;
        background: rgba(1, 183, 187, 0.10);
        border-color: #01B7BB;
        outline: none;
      }
      /* Sections inside the navy sidebar use a paler tone so the
         button stays legible against the dark background. */
      [data-antcv-document-sidebar] button.antcv-align-cycler {
        color: #01B7BB;
        border-color: rgba(1, 183, 187, 0.35);
      }
      [data-antcv-document-sidebar] button.antcv-align-cycler:hover {
        background: rgba(1, 183, 187, 0.15);
      }
      /* Table-edge width drag handles. Two handles per wrap — left
         and right — both flush with the wrap's outer edge. Hit area
         is 8px each; visible strip inside is 2px so they stay
         discreet unless hovered. Strip picks up the same teal accent
         as the column splitter so the affordances feel related. */
      .antcv-table-edge-handle {
        position: absolute;
        top: 0;
        bottom: 0;
        width: ${HANDLE_HIT_WIDTH}px;
        z-index: 4;
        cursor: ew-resize;
        touch-action: none;
        pointer-events: auto;
        background: transparent;
      }
      .antcv-table-edge-right { right: ${HANDLE_OFFSET_RIGHT}px; }
      .antcv-table-edge-left  { left:  ${HANDLE_OFFSET_RIGHT}px; }
      .antcv-table-edge-handle::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: rgba(0, 116, 110, 0.12);
        border-radius: 1px;
        transition: background 0.15s;
      }
      .antcv-table-edge-right::before { left: 3px; }
      .antcv-table-edge-left::before  { right: 3px; }
      .antcv-table-edge-handle:hover::before,
      .antcv-table-edge-handle.dragging::before,
      .antcv-table-edge-handle:focus-visible::before {
        background: #00746E;
      }
      .antcv-table-edge-handle.dragging {
        background: rgba(0, 116, 110, 0.04);
      }
      /* Sidebar/main splitter — embedded into the full column border.
         app.js renders this element with inline {top:12, height:80,
         width:28}; we override with !important so React re-renders
         can't claw back the slim-full-height geometry. Result: the
         entire vertical boundary between sidebar and main column is
         a draggable hit target, with a thin teal strip visible in
         the middle. The JS-side applySidebarRatio() keeps left in
         sync with the persisted ratio. */
      .antcv-col-splitter {
        top: 0 !important;
        bottom: 0 !important;
        height: auto !important;
        width: ${SPLITTER_WIDTH}px !important;
        background: transparent !important;
        z-index: 100;
      }
      .antcv-col-splitter::before {
        content: '';
        position: absolute;
        top: 0;
        bottom: 0;
        left: ${(SPLITTER_WIDTH / 2) - 1}px;
        width: 2px;
        background: rgba(1, 183, 187, 0.25);
        border-radius: 1px;
        pointer-events: none;
        transition: background 0.15s, width 0.15s;
      }
      .antcv-col-splitter:hover::before,
      .antcv-col-splitter.dragging::before {
        background: #01B7BB;
        width: 3px;
        left: ${(SPLITTER_WIDTH / 2) - 1.5}px;
      }
      .antcv-col-splitter.dragging {
        background: rgba(1, 183, 187, 0.06) !important;
      }
      /* Panel CJLR cyclers — match the inline style of app.js's Fe
         component so built-in (Name/Spec/Contact) and our injected
         (Profile/etc.) cyclers look identical in the panel row. */
      button.antcv-panel-cjlr:hover {
        background: rgba(1, 183, 187, 0.20) !important;
      }
      /* Hide all the chrome in print — the alignment itself prints,
         the splitter / cycler do not. */
      @media print {
        button.antcv-align-cycler,
        button.antcv-panel-cjlr,
        .antcv-table-edge-handle { display: none !important; }
        .antcv-col-splitter::before { display: none !important; }
      }
    `;
    const el = document.createElement('style');
    el.id = 'antcv-align-cycler-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ─── MutationObserver bootstrap ───────────────────────────────────

  // Debounce re-apply so a burst of mutations doesn't run the loop
  // 30 times. 16ms = ~1 frame; visible delay is imperceptible.
  let pending = false;
  let lastRunAt = 0;
  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }
  function schedule(root) {
    if (pending) return;
    pending = true;
    // v1.50.79 — throttle to >=300ms between passes. The observer is woken by
    // the React-islands re-render churn; an unthrottled rAF ran the full
    // reapply (querySelectorAll + style writes = forced reflow) ~12x/sec,
    // amplifying the re-render storm. Alignment is not real-time-critical.
    var wait = Math.max(0, 300 - (nowMs() - lastRunAt));
    var runPass = function () {
      pending = false;
      lastRunAt = nowMs();
      try {
        // v1.40.203: do not touch Section-panel rows/buttons.
        if (!DISABLE_SECTION_PANEL_BUTTON_INJECTION) {
          injectPanelCyclersInto(root);
          refreshPanelCyclerGlyphs();
        }
        reapplyAlignmentEverywhere(root);
        ensureAllTableEdgeHandles(root);
        ensureAllSidebarOverrides(root);
      } catch (e) {
        console.warn('[section-align] render pass failed:', e);
      }
    };
    if (wait > 0) setTimeout(runPass, wait); else requestAnimationFrame(runPass);
  }

  let observer = null;
  function startObserver() {
    if (observer) return;
    injectStylesOnce();
    schedule(document); // initial pass
    observer = new MutationObserver(function (muts) {
      // Cheap pre-filter: only schedule when something with [data-sid]
      // could plausibly have been added or changed. We can't always
      // tell at this level (React mutates children of existing
      // sections), so we schedule on any subtree mutation and let the
      // RAF debounce coalesce.
      for (const m of muts) {
        if (m.type === 'childList' || m.type === 'attributes') {
          schedule(document);
          return;
        }
      }
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-sid'],
    });
  }

  // Re-run on external "sections changed" signal so format-prefs and
  // similar sidecars stay coherent.
  window.addEventListener('antcv:sections-updated', function (ev) {
    // Suppress feedback loop: our own writes already applied DOM
    // changes synchronously, so when the event is from us we skip the
    // reapply pass (the observer would do redundant work).
    const detail = ev && ev.detail;
    if (detail && detail.source === 'section-align') return;
    schedule(document);
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // ─── Per-role hook (v0.2 preview, inert today) ────────────────────
  //
  // When app.js starts emitting `data-role-id="..."` on each role
  // block inside PROFESSIONAL EXPERIENCE, this block activates
  // automatically and gives each role its own cycler keyed by
  // role-id. Today the selector matches nothing; nothing happens.
  // Storage key for per-role alignment lives inside the same
  // stylePrefs map: { [`experience:${roleId}`]: alignment }.
  //
  // To activate per-role mode without changing this sidecar, ship
  // an app.js patch that adds `data-role-id` to the role-block div
  // wrapper inside the experience-section renderer.

  function maybeEnsureRoleCyclers(sectionEl) {
    if (!sectionEl || sectionEl.getAttribute('data-sid') !== 'experience') return;
    const roleBlocks = sectionEl.querySelectorAll('[data-role-id]');
    for (const rb of roleBlocks) {
      if (rb.querySelector(':scope > button[data-antcv-align-cycler="1"]')) continue;
      const roleId = rb.getAttribute('data-role-id');
      if (!roleId) continue;
      const compound = 'experience:' + roleId;
      const cs = window.getComputedStyle(rb);
      if (cs.position === 'static') rb.style.position = 'relative';
      const btn = makeCyclerButton(compound, rb);
      // Top-right of the role-block, slightly inset from the section
      // cycler so they don't visually collide.
      btn.style.top = '4px';
      btn.style.right = '32px';
      rb.appendChild(btn);
    }
  }

  // Wire the role hook into the main scheduler.
  const origSchedule = schedule;
  let rolePending = false;
  schedule = function (root) {
    origSchedule(root);
    // v1.50.79 — role cyclers stay inert until app.js emits [data-role-id].
    // The previous unguarded rAF here fired on EVERY schedule() call (~24/sec
    // per the rAF-attribution probe) running a querySelectorAll reflow for a
    // feature that matches nothing today. Skip when none exist + guard the
    // burst so it coalesces.
    if (rolePending) return;
    if (!document.querySelector('[data-role-id]')) return;
    rolePending = true;
    requestAnimationFrame(function () {
      rolePending = false;
      const sections = (root || document).querySelectorAll('[data-sid="experience"]');
      for (const s of sections) maybeEnsureRoleCyclers(s);
    });
  };

  // ────────────────────────────────────────────────────────────────
  // v1.40.194: Panel-default CJLR cycler
  // ────────────────────────────────────────────────────────────────
  //
  // One cycler per panel header (Cand / Sidebar / Main). The value is
  // the DEFAULT alignment for sections inside that panel — sections
  // with their own per-section override (PREFS_KEY.sectionAlignment[id])
  // continue to win. Sections without an override pick up the panel
  // default at render time.
  //
  // Storage:
  //   localStorage.personalInfo
  //     .stylePrefs.panelDefaultAlignment
  //       .topbar  | .sidebar | .main   = 'center'|'justify'|'left'|'right'
  //
  // Marker on the button: data-antcv-align-cycler="panel-default" so
  // antcv-section-panel-tweaks.js gives it CSS order 15 (between Undo
  // and Fit). Marker on the loc: data-antcv-panel-default-loc so other
  // sidecars can find it.

  const PANEL_DEFAULT_FIELD = 'panelDefaultAlignment';
  const PANEL_LOCS_FOR_DEFAULT = ['topbar', 'sidebar', 'main'];

  function readPanelDefault(loc) {
    const pi = readPi();
    const map = (pi[PREFS_KEY] && pi[PREFS_KEY][PANEL_DEFAULT_FIELD]) || {};
    const v = map[loc];
    return ALIGNMENTS.indexOf(v) >= 0 ? v : 'left';
  }

  function writePanelDefault(loc, value) {
    const pi = readPi();
    if (!pi[PREFS_KEY]) pi[PREFS_KEY] = {};
    if (!pi[PREFS_KEY][PANEL_DEFAULT_FIELD]) pi[PREFS_KEY][PANEL_DEFAULT_FIELD] = {};
    pi[PREFS_KEY][PANEL_DEFAULT_FIELD][loc] = value;
    writePi(pi);
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'section-align/panel-default', loc, alignment: value },
      }));
    } catch (_) {}
    // Apply visually right away so users see the cycle take effect
    // even when no per-section override exists.
    try {
      requestAnimationFrame(function () {
        // For sections without an explicit override, reflect the panel
        // default in the preview. Done lazily via the existing
        // applyAlignmentToSection helper, walking each preview section
        // whose data-section-loc matches.
        document.querySelectorAll('[data-sid]').forEach(function (sec) {
          const sid = sec.getAttribute('data-sid');
          if (!sid) return;
          // If user has an explicit override, leave it alone.
          const override = readAlignment(sid);
          if (override && override !== 'left') {
            // 'left' is also the function's default-return — but if the
            // map literally stores 'left' that IS an explicit choice.
            // We don't have a clean way to distinguish here; the section
            // will still get the override applied below either way.
          }
          // The preview section element doesn't carry the panel loc.
          // Apply the panel default only when there's no per-section
          // entry in the map. Check the raw map to disambiguate.
          const pi = readPi();
          const explicit = pi[PREFS_KEY] && pi[PREFS_KEY][FIELD] && pi[PREFS_KEY][FIELD][sid];
          if (explicit) return;
          // Without a per-section row mapping for this preview node,
          // we conservatively apply the default to ALL sections, then
          // let any subsequent applyAlignmentToSection() call override
          // the ones with explicit values. This is what the existing
          // scheduler already does on the next observer tick.
          applyAlignmentToSection(sec, value);
        });
      });
    } catch (_) {}
  }

  function nextAlignmentDefault(current) {
    return nextAlignment(current);
  }

  function makePanelDefaultCycler(loc) {
    const initial = readPanelDefault(loc);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-antcv-align-cycler', 'panel-default');
    btn.setAttribute('data-antcv-panel-default-loc', loc);
    // Match the inline style of the per-section panel cycler so all
    // three (Undo, panel-default CJLR, Fit, …) feel uniform.
    Object.assign(btn.style, {
      width: '28px',
      minWidth: '28px',
      height: '28px',
      borderRadius: '8px',
      border: '1px solid #01B7BB',
      background: 'rgba(1, 183, 187, 0.10)',
      color: '#00746E',
      fontSize: '13px',
      fontWeight: '700',
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: '0',
      lineHeight: '1',
      padding: '0',
    });

    function refresh() {
      const cur = readPanelDefault(loc);
      btn.textContent = (typeof PANEL_GLYPHS !== 'undefined' && PANEL_GLYPHS[cur])
        ? PANEL_GLYPHS[cur]
        : ({ left: '⇤', center: '↔', right: '⇥', justify: '☰' }[cur] || '⇤');
      const locLabel = loc === 'topbar' ? 'Candidate' : (loc === 'sidebar' ? 'Sidebar' : 'Main');
      btn.title = locLabel + ' panel default alignment — current: ' + cur + ' (click to cycle)';
      btn.setAttribute('aria-label', locLabel + ' panel default alignment: ' + cur);
    }
    refresh();
    btn._antcvRefresh = refresh;

    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      ev.preventDefault();
      const cur = readPanelDefault(loc);
      const nxt = nextAlignmentDefault(cur);
      writePanelDefault(loc, nxt);
      refresh();
    });

    return btn;
  }

  function findPanelHeaderRowByLoc(loc) {
    const header = document.querySelector('[data-candidate-drop-loc="' + loc + '"]');
    if (!header) return null;
    return header.parentElement || null;
  }

  function injectPanelDefaultCyclers() {
    for (const loc of PANEL_LOCS_FOR_DEFAULT) {
      const row = findPanelHeaderRowByLoc(loc);
      if (!row) continue;
      // Already injected?
      const existing = row.querySelector(':scope [data-antcv-align-cycler="panel-default"][data-antcv-panel-default-loc="' + loc + '"]');
      if (existing) {
        if (typeof existing._antcvRefresh === 'function') existing._antcvRefresh();
        continue;
      }
      const cycler = makePanelDefaultCycler(loc);
      // Insert right after the [data-candidate-drop-loc] anchor so
      // it lives in the button cluster. The CSS `order: 15` set by
      // antcv-section-panel-tweaks.js places it visually between
      // Undo (10) and Fit (20) regardless of insertion index.
      const anchor = row.querySelector(':scope [data-candidate-drop-loc="' + loc + '"]');
      if (anchor && anchor.nextSibling) {
        row.insertBefore(cycler, anchor.nextSibling);
      } else {
        row.appendChild(cycler);
      }
    }
  }

  // Refresh on storage changes (cross-tab) so all panels stay in sync.
  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === STORAGE_KEY) {
      document.querySelectorAll('[data-antcv-align-cycler="panel-default"]').forEach(function (btn) {
        if (typeof btn._antcvRefresh === 'function') btn._antcvRefresh();
      });
    }
  });

  // Initial injection + observer-driven re-tries (panels re-render on
  // tab switch). The panel-tweaks tick also pokes us via the public
  // API below.
  if (!DISABLE_SECTION_PANEL_BUTTON_INJECTION) {
    requestAnimationFrame(injectPanelDefaultCyclers);
    setInterval(injectPanelDefaultCyclers, 1500);
  }

  // ─── Public API ─────────────────────────────────────────────────
  // Exposed so antcv-section-panel-tweaks.js can call into the panel-
  // default injector on its own tick, keeping the panel-header layout
  // settled within a single frame.
  window.AntcvSectionAlign = (function () {
    const prev = window.AntcvSectionAlign || {};
    return Object.assign({}, prev, {
      version: '1.40.203',
      _injectPanelDefaultCyclers: function () { return false; },
      _readPanelDefault: readPanelDefault,
      _writePanelDefault: writePanelDefault,
      PANEL_DEFAULT_FIELD: PANEL_DEFAULT_FIELD,
    });
  })();

})();
