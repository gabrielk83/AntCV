/* AntCV section-panel tweaks sidecar (v1.40.201)
 * ============================================================
 *
 * Three small fixes bundled together — they all touch the
 * Section / Settings panels and share the same MutationObserver
 * machinery, so they live in one file.
 *
 *   1. MAIN button-bar order
 *      App.js renders MAIN's panel header buttons as
 *      [Undo, Compress, Fit, Enrich, Add], but SIDEBAR renders
 *      [Undo, Fit, Compress, Enrich, Add]. Gabriel asked for
 *      consistency. We apply CSS `order` so MAIN matches the
 *      Fit-first SIDEBAR sequence:
 *        Undo:10, Fit:20, Compress:30, Enrich:40, Add:50
 *
 *   2. Compress icon
 *      The current Compress button uses U+21E5 (⇥) which is hard
 *      to read at small sizes and Gabriel asked for a different
 *      emoji. We replace the leading character in every Compress
 *      button label across both panels and any per-row compress
 *      buttons (the same character appears in "⇥ Comp." spots).
 *      New icon: U+1F90F (🤏 pinching-hand) — universally
 *      understood as "make smaller".
 *
 *   3. Tone & banned split
 *      "Tone & banned terms" details currently contains
 *      [Banned words, Banned phrases, Preferred tone]. Gabriel
 *      asked to split into two collapsibles:
 *        - "Advanced Tone"  (Writing Tone selector + my v1.40.150
 *          helper + Preferred tone chip bank)
 *        - "Banned Words"   (Banned words + Banned phrases)
 *      We create a new <details> for Advanced Tone, move the
 *      Writing Tone wrap + helper + Preferred tone vi into it,
 *      and rename the original details' summary to "Banned
 *      Words". React reconciliation may re-render and recreate
 *      the Preferred tone vi inside the renamed details — we
 *      hide any such duplicate via a class marker so the user
 *      only ever sees the moved-in-Advanced-Tone copy.
 *
 * All three operations are idempotent and driven by a shared
 * MutationObserver + interval poll.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.203';
  const PANEL_FLAG = 'antcvPanelTweaked';
  const COMPRESS_NEW_ICON = '\u21B9'; // ↹  (Gabriel's chosen icon)
  const COMPRESS_OLD_ICONS = ['\u21E5', '\uD83E\uDD0F']; // ⇥ (v1.40.151-and-earlier) and 🤏 (v1.40.152)

  if (window.__antcvSectionPanelTweaksInstalled) return;
  window.__antcvSectionPanelTweaksInstalled = SCRIPT_VERSION;

  // v1.40.202: Mobile/PWA safety gate. The lower-bar Section panel is
  // React-owned and became fragile after the late button rearrangement.
  // Do not reorder, compact, relabel, or rewrite panel buttons on mobile.
  // Leave DOM text and button order exactly as app.js rendered it.
  function isMobileViewport() {
    try {
      return window.innerWidth <= 900 || !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (_) { return window.innerWidth <= 900; }
  }

  // ─── 1. Panel button-bar order + compact mode (v1.40.156) ────
  //
  // Each panel header (MAIN / SIDEBAR / Cand.) is rendered by
  // app.js as a flex row whose first child is a div carrying
  // `data-candidate-drop-loc="main" | "sidebar" | "topbar"` and
  // whose second child is a button group. We use that anchor to
  // scope our changes to the panel header rows only, leaving
  // other buttons elsewhere on the page untouched.
  //
  // ORDER: We apply CSS `order` so all three panels follow the
  // Fit-first sequence Gabriel asked for:
  //
  //     Undo (10) → Fit (20) → Compress (30) → Enrich (40) → Add (50)
  //
  // The CAND panel's "✂ Fix" button does orphan-cleanup, not
  // Make-It-Fit, but Gabriel treats it as the visual equivalent
  // and wants it at position 20. We identify it by its title
  // ("Run orphan-cleanup...") and give it order 20.
  //
  // COMPACT: MAIN already renders icon-only on narrow viewports
  // (`Mi=Ii&&Ci<980` in app.js) — SIDEBAR and CAND don't. Gabriel
  // asked for SIDEBAR and CAND to match MAIN's icon-only look,
  // so we truncate each button's textContent to the leading icon
  // (everything before the first space). The "(1)" undo count
  // is lost, matching MAIN's compact-mode behaviour. Idempotent:
  // if the text is already a single token (no space), we leave
  // it alone.

  const PANEL_LOCS = ['topbar', 'sidebar', 'main'];
  const COMPACT_LOCS = ['topbar', 'sidebar'];  // MAIN handles its own compact mode

  // v1.40.194: new order is Undo (10) → CJLR (15) → Fit (20) →
  // Compress (30) → Enrich (40) → Add (50). All three panels (Cand /
  // Sidebar / Main) follow the same sequence. The CJLR slot belongs
  // to the panel-level default-alignment cycler injected by
  // antcv-section-align.js (marker: data-antcv-align-cycler="panel-default").
  //
  // Cand panel rename: the orphan-cleanup button was labelled "✂ Fix"
  // even though its visual slot equals the Make-It-Fit slot in the
  // other two panels. We now relabel it to "✂ Fit" (and the title
  // tooltip still says "Run orphan-cleanup…", so screen readers and
  // hover users get the precise verb). The relabel runs in the same
  // pass as the panel-order application so a single click on the
  // panel switcher leaves everything consistent.
  function computeButtonOrder(btn) {
    const t = (btn.title || '').toLowerCase();
    const txt = (btn.textContent || '').trim();
    if (t.indexOf('undo') >= 0) return '10';
    if (btn.getAttribute('data-antcv-align-cycler') === 'panel-default') return '15';
    if (t.indexOf('make it fit') >= 0 || t.indexOf('orphan-cleanup') >= 0) return '20';
    if (t.indexOf('compress') >= 0 && t.indexOf('section') >= 0) return '30';
    if (t.indexOf('enrich') >= 0 && t.indexOf('section') >= 0) return '40';
    // "Add a main section", "Add a sidebar section", "Add a candidate-level field"
    if (t.indexOf('add a ') >= 0) return '50';
    // Fallback by leading "+ Add" textContent (when title is missing/sparse)
    if (txt.indexOf('+ Add') === 0) return '50';
    return null;
  }

  // v1.40.194: rename "✂ Fix" → "✂ Fit" in the Cand panel only. The
  // title tooltip retains "Run orphan-cleanup…" so the rename is
  // visual-only. Idempotent: bails if already "Fit".
  function renameCandFixToFit() {
    const row = findPanelRow('topbar');
    if (!row) return;
    const buttons = row.querySelectorAll('button');
    for (const btn of buttons) {
      const t = (btn.title || '').toLowerCase();
      if (t.indexOf('orphan-cleanup') < 0) continue;
      const cur = (btn.textContent || '');
      // Replace a trailing "Fix" token while preserving the leading
      // icon (which is "✂ "). If the current label already ends in
      // "Fit", do nothing.
      if (/\bFix\b/.test(cur)) {
        btn.textContent = cur.replace(/\bFix\b/, 'Fit');
      }
    }
  }

  function findPanelRow(loc) {
    const header = document.querySelector('[data-candidate-drop-loc="' + loc + '"]');
    if (!header) return null;
    return header.parentElement || null;
  }

  function applyAllPanelOrder() {
    PANEL_LOCS.forEach(function (loc) {
      const row = findPanelRow(loc);
      if (!row) return;
      row.querySelectorAll('button').forEach(function (btn) {
        const ord = computeButtonOrder(btn);
        if (ord && btn.style.order !== ord) {
          btn.style.order = ord;
        }
      });
    });
  }

  // v1.40.201 mobile safety fix:
  // Earlier builds made CAND/SIDEBAR compact by mutating button.textContent
  // (for example "↶ Undo" -> "↶"). That is unsafe in the mobile
  // Section drawer because these buttons are React-owned. After the late
  // rearrangement of a few buttons in this panel, the sidecar and React could
  // fight over the same nodes and leave the drawer stuck.
  //
  // The compact mode is now CSS-only. We mark the row and let CSS clip the
  // label visually while preserving the real DOM text for React, click
  // handlers, titles, and accessibility.
  function compactifyPanelButton(btn) {
    if (!btn || !btn.setAttribute) return;
    btn.setAttribute('data-antcv-compact-visual-only', '1');
  }

  function ensureCompactCss() {
    if (document.getElementById('antcv-panel-compact-safe-css')) return;
    const css = document.createElement('style');
    css.id = 'antcv-panel-compact-safe-css';
    css.textContent = `
      @media (max-width: 980px), (pointer: coarse) {
        [data-antcv-panel-compact-row="1"] button[data-antcv-compact-visual-only="1"] {
          max-width: 2.45em !important;
          min-width: 2.15em !important;
          padding-left: .45em !important;
          padding-right: .45em !important;
          overflow: hidden !important;
          white-space: nowrap !important;
          text-overflow: clip !important;
        }
      }
    `;
    (document.head || document.documentElement).appendChild(css);
  }

  function applyCompactToPanels() {
    ensureCompactCss();
    COMPACT_LOCS.forEach(function (loc) {
      const row = findPanelRow(loc);
      if (!row) return;
      row.setAttribute('data-antcv-panel-compact-row', '1');
      row.querySelectorAll('button').forEach(compactifyPanelButton);
    });
  }

  // Back-compat alias used by tests and legacy callers. The new
  // applyAllPanelOrder is a strict superset.
  function applyMainPanelOrder() { applyAllPanelOrder(); }

  // CSS attribute selectors need quoted strings. We keep this
  // helper around for any future title-based queries we may add.
  function cssEscape(s) {
    return s.replace(/"/g, '\\"');
  }

  // ─── 2. Compress icon replacement ─────────────────────────────

  // Find every button whose text starts with a legacy compress icon
  // and replace the leading icon with the new one. We track every
  // icon we've ever used so a fresh deploy on top of a stale cache
  // still cleans up.
  function replaceCompressIcons() {
    const buttons = document.querySelectorAll('button');
    buttons.forEach(function (btn) {
      const t = btn.textContent || '';
      if (!t.length) return;
      // Match if the leading code-point is one of our legacy icons.
      // 🤏 is two UTF-16 code units (surrogate pair) so we use
      // String.prototype.codePointAt + the first code point's char
      // length to detect "leading icon".
      const first = t.codePointAt(0);
      let legacyHit = null;
      for (const legacy of COMPRESS_OLD_ICONS) {
        if (t.indexOf(legacy) === 0) { legacyHit = legacy; break; }
      }
      // Also skip if already the new icon.
      if (t.indexOf(COMPRESS_NEW_ICON) === 0) return;
      if (!legacyHit) return;
      const replaced = COMPRESS_NEW_ICON + t.slice(legacyHit.length);
      if (replaced !== t) {
        btn.textContent = replaced;
      }
    });
  }

  // ─── 3. Tone & banned split ───────────────────────────────────

  const ADV_TONE_MARK = 'antcvAdvancedTone';
  const ADV_TONE_OPEN_KEY = 'antcv:advTone:open';

  function readAdvToneOpen() {
    try {
      const v = localStorage.getItem(ADV_TONE_OPEN_KEY);
      // v1.40.177: default to CLOSED. Users requested less visual
      // weight on initial load; Advanced Tone is opt-in.
      // null = never interacted → CLOSED. '1' = user wants open.
      // '0' = user collapsed it.
      if (v === null) return false;
      return v === '1';
    } catch (_) { return false; }
  }
  function writeAdvToneOpen(open) {
    try { localStorage.setItem(ADV_TONE_OPEN_KEY, open ? '1' : '0'); } catch (_) {}
  }
  const BANNED_SUMMARY_TEXT = 'Banned Words';
  const ORIG_SUMMARY_TEXT = 'Tone & banned terms';

  function findDetailsBySummary(text) {
    const all = document.querySelectorAll('details');
    for (const d of all) {
      const s = d.querySelector(':scope > summary');
      if (!s) continue;
      const cur = (s.textContent || '').trim();
      if (cur === text) return d;
      // Match either original or renamed
      if (text === ORIG_SUMMARY_TEXT && cur === BANNED_SUMMARY_TEXT &&
          d.dataset.antcvRenamedFromTone === '1') return d;
    }
    return null;
  }

  function findPreferredToneViInside(detailsEl) {
    if (!detailsEl) return null;
    // The vi component for Preferred tone has the label text
    // "Preferred tone" inside it. We locate the OUTERMOST element
    // that's a direct child of detailsEl and contains the label.
    const children = detailsEl.children;
    for (let i = 0; i < children.length; i++) {
      const c = children[i];
      if (c.tagName === 'SUMMARY') continue;
      // Walk descendants looking for "Preferred tone" label text
      const labels = c.querySelectorAll('*');
      for (const el of labels) {
        // Only look at small leaf-ish elements (the label is a div with text).
        const t = (el.childNodes.length === 1 && el.firstChild.nodeType === 3)
          ? el.textContent.trim() : '';
        if (t === 'Preferred tone') return c;
      }
    }
    return null;
  }

  function findWritingToneWrap() {
    const sels = document.querySelectorAll('select');
    for (const s of sels) {
      if (!s.querySelector('option[value="scandinavian"]')) continue;
      let wrap = s.parentElement;
      for (let i = 0; i < 4 && wrap; i++) {
        const txt = (wrap.textContent || '').trim();
        if (txt.indexOf('WRITING TONE') === 0) return wrap;
        wrap = wrap.parentElement;
      }
      return s.parentElement || s;
    }
    return null;
  }

  function findToneHelper() {
    return document.querySelector('[data-antcv-tone-helper="1"]');
  }

  function ensureAdvancedToneAndBannedSplit() {
    // Step 1: find original Tone & banned details (or renamed).
    let original = findDetailsBySummary(ORIG_SUMMARY_TEXT);
    if (!original) {
      // Maybe already renamed to "Banned Words"
      const renamed = document.querySelector('details[data-antcv-renamed-from-tone="1"]');
      if (renamed) original = renamed;
    }
    if (!original) return false;

    const parent = original.parentElement;
    if (!parent) return false;

    // Step 2: create the Advanced Tone details if missing. Style it
    // to match the other section <details> in the Personal tab so it
    // looks like a peer, not a hand-built outlier.
    //
    // Reference style from app.js for the CV Sidebar Content details:
    //   marginTop: 8, paddingTop: 8,
    //   borderTop: 1px dashed rgba(255,255,255,0.12)
    // And the summary:
    //   color: rgba(255,255,255,0.5), fontSize: 9, letterSpacing: 0.8,
    //   marginBottom: 4, textTransform: uppercase, cursor: pointer,
    //   userSelect: none
    let advTone = document.querySelector('details[' + dataAttr(ADV_TONE_MARK) + '="1"]');
    if (!advTone) {
      advTone = document.createElement('details');
      advTone.dataset[ADV_TONE_MARK] = '1';
      // v1.40.164: honor the user's last open/closed choice instead of
      // forcing open=true on every recreation. Without this, anything
      // that briefly removes advTone (React reconciliation of the
      // parent panel, dev-tool element inspection, etc.) causes the
      // sidecar to recreate it with open=true a second or two later,
      // visibly fighting the user when they collapse it.
      advTone.open = readAdvToneOpen();
      // Persist subsequent toggles so the choice survives recreation.
      advTone.addEventListener('toggle', function () {
        writeAdvToneOpen(advTone.open);
      });
      advTone.dataset.antcvToneToggleBound = '1';
      // Inherit parent flex order so it sits between Writing Tone
      // (order 25 — outside, just above us) and Banned Words (40).
      advTone.style.order = '30';
      advTone.style.marginTop = '8px';
      advTone.style.paddingTop = '8px';
      advTone.style.borderTop = '1px dashed rgba(255,255,255,0.12)';

      const sum = document.createElement('summary');
      // v1.40.169 i18n migration: was 'Advanced Tone' literal.
      sum.textContent = (window.AntcvI18n && window.AntcvI18n.t)
        ? window.AntcvI18n.t('tone.advanced', 'Advanced Tone')
        : 'Advanced Tone';
      // Match the other section summaries exactly.
      sum.style.color = 'rgba(255,255,255,0.5)';
      sum.style.fontSize = '9px';
      sum.style.letterSpacing = '0.8px';
      sum.style.marginBottom = '4px';
      sum.style.textTransform = 'uppercase';
      sum.style.cursor = 'pointer';
      sum.style.userSelect = 'none';
      advTone.appendChild(sum);

      parent.insertBefore(advTone, original);
    } else {
      // v1.40.164: ensure the toggle persistence listener exists on
      // advTone instances created before the upgrade. The dataset flag
      // avoids attaching the listener twice.
      if (advTone.dataset.antcvToneToggleBound !== '1') {
        advTone.addEventListener('toggle', function () {
          writeAdvToneOpen(advTone.open);
        });
        advTone.dataset.antcvToneToggleBound = '1';
      }
      // Idempotent re-apply of summary styling in case a previous build
      // left a different stylesheet on the summary. Cheap on each tick.
      const sum = advTone.querySelector(':scope > summary');
      if (sum) {
        if (sum.style.fontSize !== '9px') {
          sum.style.color = 'rgba(255,255,255,0.5)';
          sum.style.fontSize = '9px';
          sum.style.letterSpacing = '0.8px';
          sum.style.marginBottom = '4px';
          sum.style.textTransform = 'uppercase';
          sum.style.fontWeight = '';  // remove any leftover bold
          sum.style.padding = '';     // remove any leftover padding
        }
      }
      // Idempotent re-apply of details container styling.
      if (advTone.style.borderTop !== '1px dashed rgba(255, 255, 255, 0.12)' &&
          advTone.style.borderTop.indexOf('dashed') < 0) {
        advTone.style.marginTop = '8px';
        advTone.style.paddingTop = '8px';
        advTone.style.borderTop = '1px dashed rgba(255,255,255,0.12)';
      }
    }

    // Step 3: move helper + Preferred tone INTO advTone. We
    // deliberately DO NOT move the Writing Tone wrap any more —
    // Gabriel asked for it to sit just ABOVE Advanced Tone, not
    // inside. tone-helper's reorderSections gives wtWrap order 25.
    const helper = findToneHelper();
    if (helper && helper.parentElement !== advTone) {
      try { advTone.appendChild(helper); } catch (_) {}
    }
    const pt = findPreferredToneViInside(original);
    if (pt) {
      try { advTone.appendChild(pt); } catch (_) {}
    }

    // Step 4: rename original summary to "Banned Words".
    const origSum = original.querySelector(':scope > summary');
    if (origSum) {
      const cur = (origSum.textContent || '').trim();
      if (cur !== BANNED_SUMMARY_TEXT) {
        origSum.textContent = BANNED_SUMMARY_TEXT;
      }
      original.dataset.antcvRenamedFromTone = '1';
    }
    if (original.style.order !== '40') original.style.order = '40';

    return true;
  }

  function dataAttr(camel) {
    // Convert camelCase to kebab-case for use in CSS attribute selector.
    return 'data-' + camel.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); });
  }

  // ─── Boot ─────────────────────────────────────────────────────

  function tick() {
    try {
      // v1.40.203: Section-panel safe mode.
      // The stuck-state is not mobile-only. It is triggered by late DOM
      // changes in the React-owned Section panel: button reordering,
      // compacting/relabeling, compress-icon replacement, and the injected
      // panel-default CJLR button. Leave those buttons exactly as React
      // rendered them on BOTH desktop and mobile. Keep only the unrelated
      // Tone/Banned split below.
      ensureAdvancedToneAndBannedSplit();
    } catch (_) {}
  }

  [0, 200, 600, 1500].forEach(function (d) {
    if (d === 0) tick();
    else setTimeout(tick, d);
  });

  try {
    const mo = new MutationObserver(function () { tick(); });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  setInterval(tick, 1500);

  // Test/debug API
  window.AntcvSectionPanelTweaks = {
    version: SCRIPT_VERSION,
    _applyMainPanelOrder: applyMainPanelOrder,       // legacy alias
    _applyAllPanelOrder: applyAllPanelOrder,
    _applyCompactToPanels: applyCompactToPanels,
    _compactifyPanelButton: compactifyPanelButton,
    _computeButtonOrder: computeButtonOrder,
    _renameCandFixToFit: renameCandFixToFit,
    _replaceCompressIcons: replaceCompressIcons,
    _ensureAdvancedToneAndBannedSplit: ensureAdvancedToneAndBannedSplit,
    _findPreferredToneViInside: findPreferredToneViInside,
    _findDetailsBySummary: findDetailsBySummary,
    _findPanelRow: findPanelRow,
    _tick: tick,
    COMPRESS_NEW_ICON: COMPRESS_NEW_ICON,
    COMPRESS_OLD_ICONS: COMPRESS_OLD_ICONS,
    PANEL_LOCS: PANEL_LOCS,
    COMPACT_LOCS: COMPACT_LOCS,
  };
})();
