/* AntCV item-page-render sidecar (v1.40.194)
 * ============================================================
 *
 * Purpose
 * -------
 * antcv-item-page-marker.js (v1.40.178+) lets the user assign each
 * Regulatory-Context / Additional-Information / Tools-and-Methods /
 * Education / Publications item to a specific page (1..4) via a
 * `📄N` cycler in the editor. Until now the assignment was recorded
 * but had no visible effect on the preview, the printed PDF, or the
 * DOCX export — that wiring was deferred to v1.40.179.
 *
 * This sidecar provides the PREVIEW-side and PRINT-side rendering:
 *
 *   1. After each generation/edit, walk every `[data-sid]` in the
 *      preview paper that corresponds to a `labeled_list` / `list` /
 *      `education` section.
 *   2. For each such section, read
 *        localStorage['antcv:itemPages'][sid]  →  { '0': 2, '3': 2 }
 *      meaning "item 0 starts on page 2; item 3 starts on page 2".
 *   3. Insert a CSS `page-break-before: always` marker before each
 *      flagged item, plus a continuation header
 *        "<SECTION TITLE> (CONT.)"
 *      mirroring the Professional Experience pattern.
 *
 * Why a sidecar, not app.js: app.js is immutable in this deployment
 * model; per-item page assignments are a feature that grew up after
 * app.js was last touched. The page-break-before CSS works under
 * window.print() and so handles the browser-print PDF fallback for
 * free. The docx-worker pickup is wired separately on the server side
 * (generate.js v1.14.8+ reads `itemPages` from the request payload).
 *
 * Resolver semantics
 * ------------------
 * The map is keyed by SID (the section.id from localStorage.sections).
 * Each preview section block carries data-sid="<sid>". Within each
 * section the editor uses sequential item indices 0..N-1 visible in
 * the editor list. The preview renders items in the same order, but
 * the DOM markers we have to anchor to are `[data-antcv-row-path]`
 * shaped `items.<n>` — we use that. For sections that don't carry
 * per-item DOM markers (some early-version layouts), we fall back to
 * counting visible item-shaped children in document order.
 *
 * Idempotent: every injection is tagged `data-antcv-page-break="1"`
 * (the spacer) or `data-antcv-continuation-header="1"` (the heading).
 * On each tick we sweep our own tags, drop them, recompute, and
 * re-insert. Cheap.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.341-p0b';
  if (window.__antcvItemPagesRenderInstalled) return;
  window.__antcvItemPagesRenderInstalled = SCRIPT_VERSION;

  const STORAGE_KEY = 'antcv:itemPages';
  const SECTIONS_KEY = 'sections';

  function readMap() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const v = JSON.parse(raw);
      return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    } catch (_) { return {}; }
  }

  function activeDoc() {
    try {
      const v = localStorage.getItem('doc');
      if (v === 'cv' || v === 'cl') return v;
    } catch (_) {}
    return 'cv';
  }

  function readSection(sid) {
    try {
      const raw = localStorage.getItem(SECTIONS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const doc = activeDoc();
      const list = parsed && parsed[doc];
      if (!Array.isArray(list)) return null;
      for (const s of list) {
        if (s && s.id === sid) return s;
      }
    } catch (_) {}
    return null;
  }

  // Section types whose items support page assignments. Mirrors the
  // value list in antcv-item-page-marker.js / app.js.
  const SUPPORTED_TYPES = new Set(['labeled_list', 'list', 'education']);

  function isPageBreakableSection(sid) {
    const sec = readSection(sid);
    if (!sec) return false;
    if (!SUPPORTED_TYPES.has(String(sec.type || ''))) return false;
    return true;
  }

  function getSectionTitle(sid) {
    const sec = readSection(sid);
    if (!sec) return '';
    return String(sec.title || '').trim().toUpperCase();
  }

  // Find preview-side item elements for a given section element. The
  // primary anchor is `[data-antcv-row-path^="items."]`. If absent, we
  // fall back to direct children that look like item blocks (block-
  // level elements containing `[data-antcv-editable-text]`).
  function findItemElements(sectionEl) {
    let items = Array.from(sectionEl.querySelectorAll('[data-antcv-row-path^="items."]'));
    // De-dupe: when items contain nested editable spans those also
    // bubble the row-path attribute. We want the OUTERMOST per index.
    const seen = new Set();
    items = items.filter(function (el) {
      const path = el.getAttribute('data-antcv-row-path') || '';
      if (seen.has(path)) return false;
      seen.add(path);
      // The outermost match is the first ancestor in document order;
      // querySelectorAll already returns them in document order, so
      // the first-seen is the outer one. Good.
      return true;
    });
    if (items.length) return items;
    // Fallback: pick top-level block children that aren't headings.
    const fallback = [];
    for (const child of sectionEl.children) {
      // Skip our own injected markers.
      if (child.getAttribute('data-antcv-page-break') === '1') continue;
      if (child.getAttribute('data-antcv-continuation-header') === '1') continue;
      const tag = (child.tagName || '').toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'hr') continue;
      fallback.push(child);
    }
    return fallback;
  }

  function clearOurMarkers(sectionEl) {
    const ours = sectionEl.querySelectorAll(
      '[data-antcv-page-break="1"], [data-antcv-continuation-header="1"]'
    );
    for (const el of ours) {
      try { el.parentNode && el.parentNode.removeChild(el); } catch (_) {}
    }
  }

  function makeBreakSpacer() {
    const div = document.createElement('div');
    div.setAttribute('data-antcv-page-break', '1');
    div.setAttribute('aria-hidden', 'true');
    // CSS page-break-before — works under window.print() and most
    // print-to-PDF engines. The element itself collapses to 0 height
    // when not at a page boundary thanks to height:0 / margin:0.
    div.style.pageBreakBefore = 'always';
    div.style.breakBefore = 'page';   // modern equivalent
    div.style.height = '0';
    div.style.margin = '0';
    div.style.padding = '0';
    div.style.lineHeight = '0';
    return div;
  }

  // PB-003: continuation suffix is localised via antcv-i18n (key
  // 'pb.cont'). Falls back to '(CONT.)' if i18n hasn't installed yet.
  function contSuffix() {
    const i18n = window.AntcvI18n;
    if (i18n && typeof i18n.t === 'function') {
      return i18n.t('pb.cont', '(CONT.)');
    }
    return '(CONT.)';
  }
  function makeContinuationHeader(sectionTitle) {
    const div = document.createElement('div');
    div.setAttribute('data-antcv-continuation-header', '1');
    div.style.color = '#00746E';
    div.style.fontWeight = '700';
    div.style.fontSize = '12pt';
    // PB-003: continuation heading sits 18pt from page top.
    div.style.marginTop = '18pt';
    div.style.marginBottom = '8pt';
    div.style.borderBottom = '1pt solid #00746E';
    div.style.paddingBottom = '2pt';
    div.style.fontFamily = 'Trebuchet MS, Calibri, sans-serif';
    div.textContent = sectionTitle + ' ' + contSuffix();
    return div;
  }

  function applySection(sectionEl, sid) {
    clearOurMarkers(sectionEl);
    const map = readMap();
    const bucket = map[sid];
    if (!bucket || typeof bucket !== 'object') return;
    // Only items mapped to page >=2 need a break. Convert to a sorted
    // unique set of indices.
    const breakIndices = new Set();
    for (const k of Object.keys(bucket)) {
      const n = Number(bucket[k]);
      const i = parseInt(k, 10);
      if (Number.isFinite(i) && Number.isFinite(n) && n >= 2) breakIndices.add(i);
    }
    if (breakIndices.size === 0) return;

    const items = findItemElements(sectionEl);
    if (!items.length) return;
    const sectionTitle = getSectionTitle(sid) || 'SECTION';

    for (let i = 0; i < items.length; i++) {
      if (!breakIndices.has(i)) continue;
      const target = items[i];
      const parent = target.parentNode;
      if (!parent) continue;
      if (i === 0) {
        // PB-002: a page break on the first item moves the entire
        // section to the next page. The section's own heading IS
        // the heading on the new page — do not emit a (CONT.)
        // header (would duplicate it). Insert only the break spacer
        // inside the section, before its first child, so the
        // section heading itself sits immediately after the break.
        const spacer = makeBreakSpacer();
        if (sectionEl.firstChild) {
          sectionEl.insertBefore(spacer, sectionEl.firstChild);
        } else {
          sectionEl.appendChild(spacer);
        }
      } else {
        const spacer = makeBreakSpacer();
        const header = makeContinuationHeader(sectionTitle);
        parent.insertBefore(spacer, target);
        parent.insertBefore(header, target);
      }
    }
  }

  function applyAll() {
    const paper = document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
    if (!paper) return;
    const sections = paper.querySelectorAll('[data-sid]');
    for (const sec of sections) {
      const sid = sec.getAttribute('data-sid');
      if (!sid) continue;
      if (!isPageBreakableSection(sid)) continue;
      try { applySection(sec, sid); } catch (e) {
        console.warn('[item-pages-render] applySection failed:', sid, e && e.message);
      }
    }
  }

  // Schedule + observers.
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { applyAll(); } catch (_) {}
    });
  }

  // First passes.
  schedule();
  [200, 600, 1500].forEach(function (d) { setTimeout(schedule, d); });

  // Observer: re-apply whenever the preview paper subtree changes.
  try {
    const mo = new MutationObserver(function (records) {
      // Cheap filter: only schedule if some non-ours mutation happened.
      // Otherwise our own inserts would trigger a feedback loop. We
      // detect "ours" via the tag attributes we set above.
      let nonOurs = false;
      for (const r of records) {
        if (r.type !== 'childList') continue;
        const checkNode = function (n) {
          if (!n || n.nodeType !== 1) return false;
          if (n.getAttribute && (
            n.getAttribute('data-antcv-page-break') === '1' ||
            n.getAttribute('data-antcv-continuation-header') === '1'
          )) return false;
          return true;
        };
        for (const n of r.addedNodes)   if (checkNode(n)) { nonOurs = true; break; }
        if (nonOurs) break;
        for (const n of r.removedNodes) if (checkNode(n)) { nonOurs = true; break; }
        if (nonOurs) break;
      }
      if (nonOurs) schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  // React to per-item-page changes from the editor.
  window.addEventListener('antcv:item-pages-changed', schedule);

  // Cross-tab.
  window.addEventListener('storage', function (ev) {
    if (ev && ev.key === STORAGE_KEY) schedule();
  });

  // Belt-and-braces.
  setInterval(schedule, 2000);

  // Public API.
  window.AntcvItemPagesRender = {
    version: SCRIPT_VERSION,
    _applyAll: applyAll,
    _applySection: applySection,
    _findItemElements: findItemElements,
    _isPageBreakableSection: isPageBreakableSection,
    _readMap: readMap,
  };
})();
