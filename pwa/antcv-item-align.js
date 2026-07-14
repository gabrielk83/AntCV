/* AntCV CJLR item-alignment sidecar (v1.40.172)
 * ============================================================
 *
 * What changed in v1.40.172
 * -------------------------
 * Per-item CJLR cyclers in the editor for labeled_list, education,
 * and list section types — TOOLS & METHODS, REGULATORY CONTEXT,
 * ADDITIONAL INFORMATION, EDUCATION, PUBLICATIONS, and any other
 * sections built from these primitives.
 *
 * Three additions:
 *
 * 1. injectIntoEditorItems() walks `[data-antcv-item-row]` editor
 *    rows (added to app.js v1.40.172 alongside the existing
 *    `data-section-row-index` markers) and attaches a small cycler
 *    bound to a per-item edit-path:
 *
 *      labeled_list  →  items.{i}.v
 *      education     →  items.{i}.deg
 *      list          →  items.{i}
 *
 *    The parent sid is resolved by walking up to the enclosing
 *    `[data-section-row-index]` and reusing findSidForEditorRow().
 *
 * 2. applyAllAlignments() now applies per-item alignment to the
 *    row's block-level `<div>` wrapper (marked with
 *    `data-antcv-row-path` in the preview), not the inline
 *    `[data-edit-path]` spans inside it. Inline spans inherit
 *    text-align from their block parent, so writing text-align
 *    on the row block actually visually aligns the row.
 *
 * 3. Per-item storage keys remain `items.{i}.<field>` so the
 *    docx-worker (when it threads per-item alignment through
 *    labeled_list / education dedupe — flagged as follow-up in
 *    the v1.40.160 deploy doc) will already be wire-compatible.
 *
 * What changed in v1.40.160 (still in effect)
 * -------------------------------------------
 * Real-sid resolution by reading the persisted sections array:
 *
 *   u.set("sections", { cv: [...], cl: [...] })
 *
 * For an editor row at (loc, idx) in the active doc, the real
 * sid is `sections[doc].filter(s => s.loc === loc)[idx].id`.
 * Synthetic "<loc>_row_<idx>" fallback is preserved for mid-wizard
 * users; storage migrates automatically once a real sid resolves.
 *
 * Storage shape unchanged:
 *   localStorage["antcvItemAlignment"][sid] = {
 *     "__group__":    "left"|"center"|"right"|"justify",
 *     "<edit-path>":  "left"|"center"|"right"|"justify",
 *     …
 *   }
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.51.1424-edu-row-cjlr';
  const STORAGE_KEY = 'antcvItemAlignment';
  const SECTIONS_KEY = 'sections';
  const DOC_KEY = 'doc';
  const ALIGN_SEQUENCE = ['left', 'center', 'right', 'justify'];
  const ALIGN_SYMBOLS = {
    left:    '\u21E4',   // ⇤
    center:  '\u2194',   // ↔
    right:   '\u21E5',   // ⇥
    justify: '\u2630',   // ☰
  };
  const NO_OVERRIDE_GLYPH = '\u2225';   // ‖
  const GROUP_KEY = '__group__';
  const INJECTED_FLAG = 'antcvAlignCyclerInjected';
  const ITEM_INJECTED_FLAG = 'antcvAlignItemCyclerInjected';

  // Per-section-type canonical edit-path for the row.
  // Used both as the storage key and to find the matching
  // preview row block via [data-antcv-row-path].
  function itemPathFor(rowType, idx) {
    const i = String(idx);
    switch (rowType) {
      case 'labeled_list': return 'items.' + i + '.v';
      // CJLR-GROUP-001 (owner 2026-06-18): the group subheading row in a
      // labeled_list (REGULATORY etc.) gets its own cycler. rowMarkerFor() strips
      // the trailing .group, so the preview group block (data-antcv-row-path
      // "items.N") still matches.
      case 'labeled_list_group': return 'items.' + i + '.group';
      case 'education':    return 'items.' + i + '.deg';
      case 'list':         return 'items.' + i;
      // CJLR-EXPERIENCE-001 (1.50.381): per-ROLE cycler on the experience
      // editor's role cards — aligns that role's bullet block. The worker
      // already honours paraAlignPath(s, "roles."+i); the preview bullet
      // rows carry data-antcv-role-path for the fallback in
      // applyAllAlignments.
      case 'experience':   return 'roles.' + i;
      // NOTE (CJLR-TABLE-001): the CORE COMPETENCIES table is deliberately
      // NOT handled here — antcv-core-competencies-row-controls-234.js owns
      // its per-row CJLR (storage antcv.coreCompetencies.rowAlignment.v1,
      // applied by a sweep that would stomp anything this sidecar wrote).
      // The docx-client forwards that storage to the worker as
      // item_alignment["rows.N"] for export parity.
      default:             return 'items.' + i;
    }
  }

  // Per-item alignment writes to a path like items.3.v but the
  // preview row block is marked with `data-antcv-row-path="items.3"`
  // (without the trailing field). This helper strips the trailing
  // .v / .deg / .l etc so the row-marker lookup matches.
  function rowMarkerFor(itemPath) {
    if (typeof itemPath !== 'string') return null;
    const m = itemPath.match(/^(items\.\d+)(?:\..+)?$/);
    return m ? m[1] : null;
  }

  if (window.__antcvItemAlignInstalled) return;
  window.__antcvItemAlignInstalled = SCRIPT_VERSION;

  // ─── Storage ───────────────────────────────────────────────

  function lsGet(key, def) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return def;
      try { return JSON.parse(raw); } catch (_) { return raw; }
    } catch (_) { return def; }
  }

  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); }
    catch (_) {}
  }

  function readStorage() {
    const v = lsGet(STORAGE_KEY, {});
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  }
  function writeStorage(d) { lsSet(STORAGE_KEY, d); }

  function isValidAlign(v) {
    return v === 'left' || v === 'center' || v === 'right' || v === 'justify';
  }

  function resolveAlignment(sid, path) {
    if (!sid) return null;
    const data = readStorage();
    const bucket = data[sid];
    if (!bucket) return null;
    if (path && isValidAlign(bucket[path])) return bucket[path];
    if (isValidAlign(bucket[GROUP_KEY])) return bucket[GROUP_KEY];
    return null;
  }

  function readSetting(sid, key) {
    if (!sid) return null;
    const data = readStorage();
    const bucket = data[sid];
    if (!bucket) return null;
    const v = bucket[key || GROUP_KEY];
    return isValidAlign(v) ? v : null;
  }

  function writeSetting(sid, key, value) {
    if (!sid) return;
    const data = readStorage();
    if (!data[sid]) data[sid] = {};
    const k = key || GROUP_KEY;
    if (value === null || value === undefined) {
      delete data[sid][k];
      if (Object.keys(data[sid]).length === 0) delete data[sid];
    } else if (isValidAlign(value)) {
      data[sid][k] = value;
    }
    writeStorage(data);
  }

  function nextAlignment(current) {
    if (!isValidAlign(current)) return 'left';
    const idx = ALIGN_SEQUENCE.indexOf(current);
    if (idx === ALIGN_SEQUENCE.length - 1) return null;
    return ALIGN_SEQUENCE[idx + 1];
  }

  function iconFor(align) {
    return isValidAlign(align) ? ALIGN_SYMBOLS[align] : NO_OVERRIDE_GLYPH;
  }

  // ─── Real-sid resolver ─────────────────────────────────────

  // Returns the active doc identifier (cv|cl). We trust the
  // persisted `doc` localStorage key, falling back to "cv" if
  // missing.
  function activeDoc() {
    const v = lsGet(DOC_KEY, 'cv');
    return (v === 'cl' ? 'cl' : 'cv');
  }

  // Returns the section ID for an editor row at (loc, idx) by
  // looking up the persisted sections array, filtering by loc,
  // and indexing. Returns null if sections aren't available
  // (e.g., user is mid-wizard) so the caller can fall back to
  // a synthetic key.
  function lookupRealSid(loc, idx) {
    if (idx == null || idx === '' || idx === '?') return null;
    if (!loc || loc === 'unknown') return null;
    const sections = lsGet(SECTIONS_KEY, null);
    if (!sections || typeof sections !== 'object') return null;
    const docSections = sections[activeDoc()];
    if (!Array.isArray(docSections)) return null;
    // The editor's section list per loc is the in-order subset
    // of docSections with the matching loc field. v1.40.156 also
    // covers "topbar" via the candidate panel: app.js does NOT
    // emit `loc: "topbar"` on sections (topbar items live in a
    // separate header structure). For now we only resolve sids
    // for loc === "main" | "sidebar".
    if (loc !== 'main' && loc !== 'sidebar') return null;
    const filtered = docSections.filter(function (s) {
      return s && typeof s === 'object' && s.loc === loc;
    });
    const n = parseInt(idx, 10);
    if (!Number.isInteger(n) || n < 0 || n >= filtered.length) return null;
    const found = filtered[n];
    return (found && typeof found.id === 'string') ? found.id : null;
  }

  // Migrate a synthetic-sid storage record to a real-sid record
  // once we can resolve the real sid. Best-effort, lossless:
  // if the real-sid bucket already exists, we MERGE (real takes
  // priority on conflicts so we don't clobber existing settings).
  function migrateSynthetic(syntheticSid, realSid) {
    if (!syntheticSid || !realSid || syntheticSid === realSid) return;
    const data = readStorage();
    const synthBucket = data[syntheticSid];
    if (!synthBucket) return;
    const realBucket = data[realSid] || {};
    for (const k of Object.keys(synthBucket)) {
      if (realBucket[k] == null) realBucket[k] = synthBucket[k];
    }
    data[realSid] = realBucket;
    delete data[syntheticSid];
    writeStorage(data);
  }

  // ─── Apply text-align to preview ───────────────────────────

  function applyAllAlignments() {
    document.querySelectorAll('[data-antcv-preview-paper]').forEach(function (preview) {
      // 1. Existing path: walk [data-edit-path] spans, apply
      //    section-group default (so legacy text/text_inline/bullets/
      //    table-cell paragraphs still get the section's CJLR.) The
      //    per-item branch below also handles spans, but only when
      //    they sit inside a row block — section-level text paths
      //    like "content" need this loop.
      preview.querySelectorAll('[data-edit-path]').forEach(function (el) {
        const sidHost = el.closest('[data-sid]');
        if (!sidHost) return;
        const sid  = sidHost.getAttribute('data-sid');
        const path = el.getAttribute('data-edit-path');
        // If this span sits inside a row block, skip it here — the
        // per-item loop below applies alignment to the row block,
        // which the span will inherit (and applying text-align to
        // an inline span has no visible effect anyway).
        if (el.closest('[data-antcv-row-path]')) return;
        applyOne(el, resolveAlignment(sid, path));
      });

      // 2. Per-item branch: for every [data-antcv-row-path] row
      //    block, look up storage[sid][<row-path>.<field>] OR
      //    storage[sid][<row-path>]. If a per-item override is set,
      //    apply text-align to the block (inline spans inherit).
      //    Otherwise fall back to the section group default.
      preview.querySelectorAll('[data-sid]').forEach(function (sidHost) {
        const sid = sidHost.getAttribute('data-sid');
        if (!sid) return;
        const data = readStorage();
        const bucket = data[sid] || {};
        const groupAlign = isValidAlign(bucket[GROUP_KEY]) ? bucket[GROUP_KEY] : null;
        // Index per-item alignments by row marker (items.N).
        const perRow = {};
        Object.keys(bucket).forEach(function (k) {
          const marker = rowMarkerFor(k);
          if (marker && isValidAlign(bucket[k])) {
            // If multiple paths under the same row are set
            // (items.3.l AND items.3.v), the later one wins.
            // In practice the cycler only writes one canonical
            // field per row.
            perRow[marker] = bucket[k];
          }
        });
        sidHost.querySelectorAll('[data-antcv-row-path]').forEach(function (rowEl) {
          const marker = rowEl.getAttribute('data-antcv-row-path');
          // CJLR-EXPERIENCE-001: lookup order — exact per-bullet key
          // (roles.N.bullets.M / items.N.field via perRow), then the exact
          // marker itself, then the row's ROLE path (roles.N — written by
          // the experience role cycler), then the section default.
          const rolePath = rowEl.getAttribute('data-antcv-role-path');
          // PER-ROW-CJLR-ROWKEY-001 (owner 2026-07-14, verified live): the row stamps
          // its canonical per-row key as data-antcv-rowkey (e.g. "roles.0.bullets.0"
          // for a role bullet). Match THAT first — the editor writes the per-row CJLR
          // under exactly this key, but the DOM row-path is "items.N", so without this
          // a role bullet's per-row CJLR never matched and this sidecar reset it to the
          // render default.
          const rowKey = rowEl.getAttribute('data-antcv-rowkey');
          const perItem = (rowKey && isValidAlign(bucket[rowKey])) ? bucket[rowKey]
            : isValidAlign(perRow[marker]) ? perRow[marker]
            : isValidAlign(bucket[marker]) ? bucket[marker]
            : (rolePath && isValidAlign(bucket[rolePath])) ? bucket[rolePath]
            : null;
          // GROUP-CJLR-SCOPE-001 (owner 2026-07-14): __group__ (the "Groups" control)
          // aligns GROUP HEADINGS only — NOT content rows. This sidecar previously
          // applied groupAlign to EVERY [data-antcv-row-path] row, which is why the
          // group/section control still dragged all the body rows even after the
          // render + section-align were scoped. Content rows follow their own per-item
          // CJLR (perItem) or the render default (applyOne(null) restores it).
          const isGroupHead = rowEl.hasAttribute('data-antcv-group-head') || rowEl.hasAttribute('data-antcv-role-head');
          let align = perItem || (isGroupHead ? groupAlign : null);
          // GROUP-HEAD-JUSTIFY-001 (owner 2026-07-14): a PLAIN group heading (not a role
          // line) can't meaningfully justify — a single heading line justified renders as
          // left anyway, and leaving it 'justify' makes the sidebar de-justify pass flip it
          // (the tools "left<->justify fight"). Map justify→left so this applier agrees with
          // the render (GROUP-HEAD-CJLR-001). Role heads keep justify (= space-between).
          if (align === 'justify' && isGroupHead && !rowEl.hasAttribute('data-antcv-role-head')) align = 'left';
          applyOne(rowEl, align);
        });
      });
    });
  }

  // GROUP-CJLR-ROLES-001 (owner 2026-07-14): a role head renders an inner flex row
  // (data-antcv-role-line) — textAlign is INERT on a flex row, which is why the Groups
  // control "did nothing" on roles. Map the align to the row's justifyContent instead,
  // so it moves live (no React re-render needed). Restores space-between on clear.
  var ROLE_JC = { left: 'flex-start', center: 'center', right: 'flex-end', justify: 'space-between' };
  function applyOne(el, align) {
    var roleLine = (el.getAttribute('data-antcv-role-head') != null) ? el.querySelector('[data-antcv-role-line]') : null;
    if (roleLine) {
      var jc = align ? ROLE_JC[align] : null;
      if (jc) {
        if (!roleLine.dataset.antcvJcSet) {
          roleLine.dataset.antcvJcOrig = roleLine.style.justifyContent || '';
          roleLine.dataset.antcvJcSet = '1';
        }
        if (roleLine.style.justifyContent !== jc) roleLine.style.justifyContent = jc;
      } else if (roleLine.dataset.antcvJcSet === '1') {
        roleLine.style.justifyContent = roleLine.dataset.antcvJcOrig || '';
        delete roleLine.dataset.antcvJcSet;
        delete roleLine.dataset.antcvJcOrig;
      }
      return;
    }
    if (align) {
      if (!el.dataset.antcvAlignSet) {
        el.dataset.antcvAlignOrig = el.style.textAlign || '';
        el.dataset.antcvAlignSet = '1';
      }
      if (el.style.textAlign !== align) {
        el.style.textAlign = align;
      }
    } else if (el.dataset.antcvAlignSet === '1') {
      el.style.textAlign = el.dataset.antcvAlignOrig || '';
      delete el.dataset.antcvAlignSet;
      delete el.dataset.antcvAlignOrig;
    }
  }

  // ─── Cycler button (single-button) ─────────────────────────

  function makeCycler(initialSid, opts) {
    const isItem = !!(opts && opts.path);
    const path = (opts && opts.path) || GROUP_KEY;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'antcv-align-cycler';
    btn.dataset.antcvAlignCycler = isItem ? 'item' : 'group';
    btn.dataset.antcvAlignSid = initialSid;
    if (isItem) btn.dataset.antcvAlignPath = path;
    btn.setAttribute(
      'aria-label',
      (isItem ? 'CJLR (per-item): ' : 'CJLR: ') + 'cycle left / center / right / justify'
    );
    btn.style.cssText = [
      'width:' + (isItem ? 20 : 24) + 'px',
      'min-width:' + (isItem ? 20 : 24) + 'px',
      'height:' + (isItem ? 20 : 24) + 'px',
      'border-radius:' + (isItem ? 4 : 6) + 'px',
      'border:1px solid #01B7BB',
      'background:' + (isItem ? 'rgba(1,183,187,0.06)' : 'rgba(1,183,187,0.10)'),
      'color:#00746E',
      'font-size:' + (isItem ? 10 : 13) + 'px',
      'font-weight:700',
      'cursor:pointer',
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'flex-shrink:0',
      'line-height:1',
      'padding:0',
      'margin-left:4px',
    ].join(';');

    function refresh() {
      const sid = btn.dataset.antcvAlignSid;
      const p   = btn.dataset.antcvAlignPath || GROUP_KEY;
      const current = readSetting(sid, p);
      btn.textContent = iconFor(current);
      btn.title = (isItem ? 'CJLR (row override) — current: ' : 'CJLR (section default) — current: ')
        + (current || (isItem ? 'inherits section default' : 'paragraph default'));
    }
    refresh();

    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      const sid = btn.dataset.antcvAlignSid;
      const p   = btn.dataset.antcvAlignPath || GROUP_KEY;
      const current = readSetting(sid, p);
      const next = nextAlignment(current);
      writeSetting(sid, p, next);
      refresh();
      applyAllAlignments();
    });
    btn.addEventListener('mousedown', function (ev) { ev.stopPropagation(); });
    btn.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });

    btn._antcvRefresh = refresh;
    return btn;
  }

  // ─── Editor injection (NOT preview) ───────────────────────

  // Resolves the section ID for a row, preferring the real sid
  // from sections-in-storage and falling back to a synthetic
  // "<loc>_row_<idx>" key when sections aren't available yet.
  function findSidForEditorRow(row) {
    const loc = row.getAttribute('data-section-row-loc') || 'unknown';
    const idx = row.getAttribute('data-section-row-index');
    const real = lookupRealSid(loc, idx);
    if (real) return real;
    return loc + '_row_' + (idx == null ? '?' : idx);
  }

  function injectIntoEditorRows() {
    const rows = document.querySelectorAll('[data-section-row-index]');
    rows.forEach(function (row) {
      const sid = findSidForEditorRow(row);
      const wasInjected = row.dataset[INJECTED_FLAG] === '1';
      if (wasInjected) {
        // If the cycler is already there, just keep its sid in sync —
        // sections may have shuffled (locToggle, reorder) since first
        // injection. Best-effort migration if synthetic → real.
        const existing = row.querySelector('button.antcv-align-cycler');
        if (existing) {
          const oldSid = existing.dataset.antcvAlignSid;
          if (oldSid !== sid) {
            // If we just resolved a real sid for what was previously
            // synthetic, migrate the stored bucket so the user's
            // earlier clicks don't get orphaned.
            if (oldSid && /^[a-z]+_row_\d+$/.test(oldSid) && sid && !/^[a-z]+_row_\d+$/.test(sid)) {
              migrateSynthetic(oldSid, sid);
            }
            existing.dataset.antcvAlignSid = sid;
            row.dataset.antcvAlignSid = sid;
            if (typeof existing._antcvRefresh === 'function') existing._antcvRefresh();
          }
          return;
        }
        // Self-heal: cycler was injected but is no longer in the DOM
        // (React removed it during reconciliation, or the user
        // collapsed/re-expanded the row). Fall through to re-inject.
        delete row.dataset[INJECTED_FLAG];
      }
      row.dataset.antcvAlignSid = sid;
      const btn = makeCycler(sid);
      try { row.appendChild(btn); }
      catch (_) { return; }
      row.dataset[INJECTED_FLAG] = '1';
    });
  }

  // ─── Per-item cycler injection ─────────────────────────────
  //
  // For each editor row marked with data-antcv-item-row, attach a
  // small cycler that writes to a per-item path. Each item row sits
  // inside an expanded section editor, which sits inside a
  // [data-section-row-index] container — we walk up to find the
  // parent section's sid.

  function injectIntoEditorItems() {
    const items = document.querySelectorAll('[data-antcv-item-row]');
    items.forEach(function (itemRow) {
      const parentSectionRow = itemRow.closest('[data-section-row-index]');
      if (!parentSectionRow) return;
      const sid = findSidForEditorRow(parentSectionRow);
      const rowType = itemRow.getAttribute('data-antcv-item-row') || 'list';
      // EDU-ROW-CJLR-001 (owner 2026-07-15): EDUCATION / RECOMMENDATIONS rows now carry
      // their OWN inline CJLR cycler (rendered inside app.js's education editor, writing
      // antcvItemAlignment[sid]["items.N.deg"]). Skip them here so the row does not get a
      // second, duplicate cycler if these editor rows ever sit under a section-row wrapper.
      if (rowType === 'education') return;
      const idx = itemRow.getAttribute('data-antcv-item-idx');
      const path = itemPathFor(rowType, idx);
      const wasInjected = itemRow.dataset[ITEM_INJECTED_FLAG] === '1';
      if (wasInjected) {
        const existing = itemRow.querySelector('button.antcv-align-cycler[data-antcv-align-cycler="item"]');
        if (existing) {
          const oldSid = existing.dataset.antcvAlignSid;
          const oldPath = existing.dataset.antcvAlignPath;
          let touched = false;
          if (oldSid !== sid) {
            if (oldSid && /^[a-z]+_row_\d+$/.test(oldSid) && sid && !/^[a-z]+_row_\d+$/.test(sid)) {
              migrateSynthetic(oldSid, sid);
            }
            existing.dataset.antcvAlignSid = sid;
            touched = true;
          }
          if (oldPath !== path) {
            existing.dataset.antcvAlignPath = path;
            touched = true;
          }
          if (touched && typeof existing._antcvRefresh === 'function') existing._antcvRefresh();
          return;
        }
        // Self-heal: cycler was injected but React removed it (or the
        // editor was collapsed and re-expanded into a fresh tree).
        // Fall through to re-inject.
        delete itemRow.dataset[ITEM_INJECTED_FLAG];
      }
      // Find a target container inside the item row for the cycler —
      // prefer the action-buttons row (the flex justify-end div that
      // holds ▲ ▼ ⇥ ✨ ✕). Fall back to appending at the end of the
      // item row if not found.
      const actionRow = (function () {
        const candidates = itemRow.querySelectorAll('div');
        for (let i = candidates.length - 1; i >= 0; i--) {
          const d = candidates[i];
          const style = (d.getAttribute('style') || '');
          // Look for the action-buttons flex row near the bottom.
          if (/justify-content:\s*flex-end|justifyContent:\s*flex-end|justify-content:flex-end|justifyContent:flex-end/.test(style)) {
            return d;
          }
        }
        return null;
      })();
      const btn = makeCycler(sid, { path: path });
      btn.style.marginLeft = '2px';
      btn.style.marginRight = '0';
      try { (actionRow || itemRow).appendChild(btn); }
      catch (_) { return; }
      itemRow.dataset[ITEM_INJECTED_FLAG] = '1';
      itemRow.dataset.antcvAlignSid = sid;
      itemRow.dataset.antcvAlignPath = path;
    });
  }

  function refreshAllCyclers() {
    document.querySelectorAll('button.antcv-align-cycler').forEach(function (btn) {
      if (typeof btn._antcvRefresh === 'function') btn._antcvRefresh();
    });
  }

  // ─── v1.40.157 leftovers cleanup ───────────────────────────

  function purgeV157Leftovers() {
    document.querySelectorAll('.antcv-align-cycler-group, .antcv-align-cycler-item').forEach(function (el) {
      if (el.tagName === 'SPAN') {
        try { el.remove(); } catch (_) {}
      }
    });
    const oldStyle = document.getElementById('antcv-align-cycler-style');
    if (oldStyle) try { oldStyle.remove(); } catch (_) {}
  }

  // ─── Tick / observers ─────────────────────────────────────

  function tick() {
    try {
      // EDIT-GUARD-001 (owner 2026-06-19): while the user is editing preview text
      // (contentEditable) or an editor field, skip the inject/apply pass — it
      // mutates the DOM near the caret and makes the sidebar "dance". The 1.5s
      // interval re-runs once focus leaves.
      var __ae = document.activeElement;
      if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ''))) return;
      purgeV157Leftovers();
      injectIntoEditorRows();
      injectIntoEditorItems();
      applyAllAlignments();
    } catch (_) {}
  }

  [0, 200, 600, 1500, 3000].forEach(function (d) {
    if (d === 0) tick();
    else setTimeout(tick, d);
  });

  try {
    const mo = new MutationObserver(function () { tick(); });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  setInterval(tick, 1500);

  // ─── Public/test API ──────────────────────────────────────

  window.AntcvItemAlign = {
    version: SCRIPT_VERSION,
    _readStorage: readStorage,
    _writeStorage: writeStorage,
    _resolveAlignment: resolveAlignment,
    _readSetting: readSetting,
    _writeSetting: writeSetting,
    _applyAllAlignments: applyAllAlignments,
    _injectIntoEditorRows: injectIntoEditorRows,
    _injectIntoEditorItems: injectIntoEditorItems,
    _refreshAllCyclers: refreshAllCyclers,
    _purgeV157Leftovers: purgeV157Leftovers,
    _makeCycler: makeCycler,
    _nextAlignment: nextAlignment,
    _iconFor: iconFor,
    _findSidForEditorRow: findSidForEditorRow,
    _lookupRealSid: lookupRealSid,
    _activeDoc: activeDoc,
    _migrateSynthetic: migrateSynthetic,
    _itemPathFor: itemPathFor,
    _rowMarkerFor: rowMarkerFor,
    _tick: tick,
    STORAGE_KEY: STORAGE_KEY,
    GROUP_KEY: GROUP_KEY,
    ALIGN_SEQUENCE: ALIGN_SEQUENCE,
    ALIGN_SYMBOLS: ALIGN_SYMBOLS,
    NO_OVERRIDE_GLYPH: NO_OVERRIDE_GLYPH,
  };
})();
