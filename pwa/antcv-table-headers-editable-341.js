/* AntCV table header editability (v1.40.341-tb004)
 * ============================================================
 *
 * TB-004 — Table column headers in CV and CL Preview become
 * editable in place. Click on any visible <th> in the preview
 * paper → cursor lands → type → blur persists → reload → still
 * there.
 *
 * Spec (from docs/plan/UI_UX_Bugfix_Implementation_and_QA.md):
 *   "Click on any visible table column header in Preview → cursor
 *    lands → type → blur persists → reload → still there"
 *
 * Storage shape
 * -------------
 * Key: localStorage['antcv.tableHeaders.v1']
 * Value: {
 *   [doc-id]: {                      // 'cv' or 'cl'
 *     [section-key]: {               // e.g. 'what-i-bring' (derived
 *                                    //  from nearest heading text)
 *       [col-index]: 'Override text'
 *     }
 *   }
 * }
 *
 * On boot / mutation, restore overrides into the <th> text. On
 * blur, persist + dispatch antcv:sections-updated.
 *
 * Hazards
 * -------
 *   - No \s in regex literals (none used).
 *   - No \u escapes.
 *   - Scoped to .antcv-preview-paper so we never wrap editor inputs.
 *   - Idempotent attach guarded by data-antcv-th-editable="1".
 *   - We DO NOT change column count, only text in the existing <th>.
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-tb004-fix1';
  if (window.__antcvTableHeadersEditable341 === SCRIPT_VERSION) return;
  window.__antcvTableHeadersEditable341 = SCRIPT_VERSION;

  var STORAGE_KEY = 'antcv.tableHeaders.v1';

  function clean(s) {
    return String(s == null ? '' : s).replace(/[\t\n\r ]+/g, ' ').trim();
  }

  function activeDoc() {
    try {
      var v = localStorage.getItem('doc');
      if (v === 'cv' || v === 'cl') return v;
    } catch (_) {}
    return 'cv';
  }

  function readStore() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      var v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : {};
    } catch (_) { return {}; }
  }

  function writeStore(s) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s || {}));
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'table-headers-editable-341' },
      }));
    } catch (_) {}
  }

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // Derive a stable section key from the nearest preceding heading
  // text. We prefer [data-sid] when available; otherwise use the
  // sluggified heading text. Falls back to 'default' so we always
  // have a key.
  function sectionKeyForTable(table) {
    var sidEl = table.closest('[data-sid]');
    if (sidEl) return String(sidEl.getAttribute('data-sid') || 'default');
    // Walk back from the table looking for a heading.
    var probe = table.previousElementSibling;
    var depth = 0;
    while (probe && depth < 12) {
      if (/^H[1-6]$/.test(probe.tagName)) {
        var t = clean(probe.textContent).toLowerCase();
        if (t) return t.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'default';
      }
      probe = probe.previousElementSibling;
      depth++;
    }
    // Walk up and check parent siblings for a heading.
    var parent = table.parentElement;
    while (parent && depth < 18) {
      var h = parent.querySelector('h1, h2, h3, h4, h5, h6');
      if (h) {
        var th = clean(h.textContent).toLowerCase();
        if (th) return th.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'default';
      }
      parent = parent.parentElement;
      depth++;
    }
    return 'default';
  }

  function getOverride(doc, sectionKey, colIndex) {
    var s = readStore();
    var d = s[doc]; if (!d) return null;
    var sec = d[sectionKey]; if (!sec) return null;
    var v = sec[String(colIndex)];
    return (typeof v === 'string') ? v : null;
  }

  // v1.40.341-tb004-fix1: split persistence into silent (every
  // keystroke, no event) and committed (on blur, fires
  // antcv:sections-updated). Without silent-per-keystroke persistence
  // the React component owning the <th> rerenders on its own clock
  // and resets the cell's textContent to the original ("Core
  // Competencies"), wiping the user's in-progress edit.
  function setOverrideSilent(doc, sectionKey, colIndex, text) {
    var s = readStore();
    if (!s[doc] || typeof s[doc] !== 'object') s[doc] = {};
    if (!s[doc][sectionKey] || typeof s[doc][sectionKey] !== 'object') s[doc][sectionKey] = {};
    var key = String(colIndex);
    if (text == null || text === '') delete s[doc][sectionKey][key];
    else s[doc][sectionKey][key] = String(text);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s || {})); } catch (_) {}
  }
  function setOverride(doc, sectionKey, colIndex, text) {
    setOverrideSilent(doc, sectionKey, colIndex, text);
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
        detail: { source: 'table-headers-editable-341' },
      }));
    } catch (_) {}
  }

  function attachTh(th, doc, sectionKey, colIndex) {
    if (th.getAttribute('data-antcv-th-editable') === '1') return;
    th.setAttribute('data-antcv-th-editable', '1');
    th.setAttribute('contenteditable', 'true');
    th.setAttribute('spellcheck', 'true');
    if (!th.hasAttribute('tabindex')) th.setAttribute('tabindex', '0');
    th.style.cursor = 'text';
    // Don't bubble click into row-drag / focus-stealing handlers.
    th.addEventListener('click', function (ev) { ev.stopPropagation(); });
    // v1.40.341-tb004-fix1: persist EVERY keystroke silently so the
    // React component's re-render (which can fire mid-edit) reads
    // the user's current text from localStorage and restoreText()
    // keeps the cell consistent. Only the blur emits the
    // sections-updated event so we don't trigger a render loop.
    th.addEventListener('input', function () {
      try {
        var text = clean(th.textContent || '');
        setOverrideSilent(doc, sectionKey, colIndex, text);
      } catch (_) {}
    });
    th.addEventListener('blur', function () {
      try {
        var text = clean(th.textContent || '');
        setOverride(doc, sectionKey, colIndex, text);
      } catch (_) {}
    });
    th.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        th.blur();
      }
    });
  }

  function restoreText(th, doc, sectionKey, colIndex) {
    var override = getOverride(doc, sectionKey, colIndex);
    if (override == null) return;
    // Only overwrite if the current text differs, to avoid clobbering
    // an in-flight edit and to avoid pointless DOM writes.
    if (clean(th.textContent || '') !== override) {
      th.textContent = override;
    }
  }

  function sweepOnce() {
    var paper = findPreviewPaper();
    if (!paper) return;
    var doc = activeDoc();
    var tables = paper.querySelectorAll('table');
    for (var t = 0; t < tables.length; t++) {
      var table = tables[t];
      var sectionKey = sectionKeyForTable(table);
      // Header cells: prefer first <thead><tr>, fall back to first
      // <tr> containing only <th>.
      var headerRow = table.querySelector('thead > tr');
      if (!headerRow) {
        var firstTr = table.querySelector('tr');
        if (firstTr && firstTr.querySelector('th') && !firstTr.querySelector('td')) {
          headerRow = firstTr;
        }
      }
      if (!headerRow) continue;
      var ths = headerRow.querySelectorAll('th');
      for (var i = 0; i < ths.length; i++) {
        try {
          attachTh(ths[i], doc, sectionKey, i);
          restoreText(ths[i], doc, sectionKey, i);
        } catch (_) {}
      }
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { sweepOnce(); } catch (_) {}
    });
  }

  schedule();
  var delays = [200, 600, 1500, 3000];
  for (var d = 0; d < delays.length; d++) setTimeout(schedule, delays[d]);

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvTableHeadersEditable341 = {
    version: SCRIPT_VERSION,
    sweep: sweepOnce,
  };

  try { console.debug('[table-headers-editable] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
