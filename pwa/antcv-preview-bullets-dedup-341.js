/* AntCV Preview bullet-list dedup + editability fix (v1.40.341-prv-bullets)
 * ============================================================
 *
 * Symptom (Gabriel, 2026-06-03):
 *   In CL Preview, the "Specific thing you would do" bullets appear
 *   TWICE.
 *   - First rendering (real data, NOT editable):
 *       <span data-antcv-editable-text="true" data-antcv-aligned="left">
 *         [Specific thing you would do 1]
 *       </span>
 *     This is the canonical Preview rendering, bound to the generated
 *     JD content — but the user can't edit it.
 *   - Second rendering (TEMPLATE, IS editable):
 *       <li style="text-align: left;">[Specific thing you would do 1]</li>
 *     This is a separate render path showing template placeholders
 *     unconnected to the actual model.
 *
 * What this sidecar does
 * ----------------------
 *   1. Promote every visible [data-antcv-editable-text="true"] in
 *      .antcv-preview-paper to contenteditable="true" + tabindex,
 *      so the real-data spans become editable. Persist edits on blur
 *      to localStorage['sections'] under the matching item.
 *
 *   2. Detect template-only <ul>/<ol> lists in Preview — lists whose
 *      EVERY <li> textContent matches the bracketed-template pattern
 *      `^\[.*\]$` (e.g. "[Specific thing you would do 1]"). If such a
 *      list exists AND a sibling editable-text span shows the same
 *      text, hide the list. The real-data span stays.
 *
 *   3. Idempotent — markers data-antcv-prv-bullets-editable="1" and
 *      data-antcv-prv-bullets-hidden="1" prevent re-wrap / re-hide.
 *
 *   4. MutationObserver re-runs the sweep on React rerenders.
 *
 * Hazards
 * -------
 *   - No \s regex literals (uses character classes).
 *   - No \u escapes.
 *   - Scoped to .antcv-preview-paper only.
 *   - Persistence touches the canonical sections store with a careful
 *     match — if no candidate item is found, the edit stays in the
 *     DOM but is not persisted (no silent overwrite).
 *
 * Recovery
 * --------
 * To restore hidden template lists:
 *   document.querySelectorAll('[data-antcv-prv-bullets-hidden]')
 *     .forEach(n => { n.style.display = ''; n.removeAttribute('data-antcv-prv-bullets-hidden'); });
 */
(function () {
  'use strict';

  var VERSION = '1.40.341-prv-bullets3';
  if (window.__antcvPreviewBulletsDedup341 === VERSION) return;
  window.__antcvPreviewBulletsDedup341 = VERSION;

  var SECTIONS_KEY = 'sections';

  // v1.40.341-prv-bullets2 — the per-node "hid template-only list" debug
  // line flooded the console: a re-render loop elsewhere keeps re-mounting
  // the template list as FRESH nodes (without our marker), so this sidecar
  // re-hides each one and logged it every time, drowning out everything
  // else. Collapse those into one debounced summary. The reported count is
  // itself a useful signal for how fast the list is being re-rendered.
  var hidLogPending = false;
  var hidCountSinceLog = 0;
  function noteHidden() {
    hidCountSinceLog += 1;
    if (hidLogPending) return;
    hidLogPending = true;
    setTimeout(function () {
      hidLogPending = false;
      var n = hidCountSinceLog;
      hidCountSinceLog = 0;
      try { console.debug('[preview-bullets-dedup] hid ' + n + ' template-only list(s) since last report'); } catch (_) {}
    }, 2000);
  }

  function clean(s) {
    return String(s == null ? '' : s).replace(/[\t\n\r ]+/g, ' ').trim();
  }

  function activeDoc() {
    try {
      var v = localStorage.getItem('doc');
      return v === 'cl' ? 'cl' : 'cv';
    } catch (_) { return 'cv'; }
  }

  function previewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // ─── 1. Promote real-data spans to editable ────────────────────

  function persistEdit(el, newText) {
    // Best-effort: find the item in the sections store whose current
    // text matches the original textContent we wrapped, then update.
    // If no match found, leave the canonical store alone — the DOM
    // change still persists visually until the next React rerender.
    try {
      var original = el.getAttribute('data-antcv-prv-bullets-original') || '';
      if (!original) return;
      if (clean(original) === clean(newText)) return;
      var raw = localStorage.getItem(SECTIONS_KEY);
      if (!raw) return;
      var bundle = JSON.parse(raw);
      if (!bundle || typeof bundle !== 'object') return;
      var doc = activeDoc();
      var list = bundle[doc];
      if (!Array.isArray(list)) return;
      var origClean = clean(original);
      var newClean = clean(newText);
      var changed = false;
      // Walk every section's text-bearing arrays/strings and rewrite.
      for (var i = 0; i < list.length; i++) {
        var sec = list[i];
        if (!sec || typeof sec !== 'object') continue;
        // Common text-bearing fields.
        var stringFields = ['intro', 'closing', 'introLine', 'closingLine', 'paragraph', 'text', 'body', 'value', 'detail', 'description', 'content'];
        for (var f = 0; f < stringFields.length; f++) {
          var k = stringFields[f];
          if (typeof sec[k] === 'string' && clean(sec[k]) === origClean) {
            sec[k] = newText;
            changed = true;
          }
        }
        // Arrays of strings — bullets/items.
        var arrFields = ['bullets', 'items', 'lines', 'tags'];
        for (var af = 0; af < arrFields.length; af++) {
          var ak = arrFields[af];
          var arr = sec[ak];
          if (Array.isArray(arr)) {
            for (var ai = 0; ai < arr.length; ai++) {
              if (typeof arr[ai] === 'string' && clean(arr[ai]) === origClean) {
                arr[ai] = newText;
                changed = true;
              }
            }
          }
        }
        // 2D rows arrays — table cells.
        if (Array.isArray(sec.rows)) {
          for (var ri = 0; ri < sec.rows.length; ri++) {
            var row = sec.rows[ri];
            if (!Array.isArray(row)) continue;
            for (var ci = 0; ci < row.length; ci++) {
              if (typeof row[ci] === 'string' && clean(row[ci]) === origClean) {
                row[ci] = newText;
                changed = true;
              }
            }
          }
        }
      }
      if (changed) {
        localStorage.setItem(SECTIONS_KEY, JSON.stringify(bundle));
        try {
          window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
            detail: { source: 'preview-bullets-dedup-341' },
          }));
        } catch (_) {}
        el.setAttribute('data-antcv-prv-bullets-original', newText);
      }
    } catch (_) {}
  }

  function makeEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.getAttribute('data-antcv-prv-bullets-editable') === '1') return false;
    el.setAttribute('data-antcv-prv-bullets-editable', '1');
    el.setAttribute('contenteditable', 'true');
    el.setAttribute('spellcheck', 'true');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
    el.style.cursor = 'text';
    el.style.userSelect = 'text';
    el.style.webkitUserSelect = 'text';
    // Snapshot the original so persistEdit can find it in the store.
    el.setAttribute('data-antcv-prv-bullets-original', clean(el.textContent || ''));
    el.addEventListener('click', function (ev) { ev.stopPropagation(); });
    el.addEventListener('blur', function () {
      try { persistEdit(el, clean(el.textContent || '')); } catch (_) {}
    });
    el.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        el.blur();
      }
    });
    return true;
  }

  function promoteEditableSpans() {
    var paper = previewPaper();
    if (!paper) return;
    var spans = paper.querySelectorAll('[data-antcv-editable-text="true"]:not([data-antcv-prv-bullets-editable="1"])');
    for (var i = 0; i < spans.length; i++) {
      try { makeEditable(spans[i]); } catch (_) {}
    }
  }

  // ─── 2. Hide template-only <ul>/<ol> lists ─────────────────────

  var BRACKETED = /^\[[^\]]{2,500}\]$/;

  function isTemplateOnlyList(list) {
    if (!list) return false;
    var lis = list.querySelectorAll(':scope > li');
    if (lis.length === 0) return false;
    for (var i = 0; i < lis.length; i++) {
      var t = clean(lis[i].textContent || '');
      if (!t) return false;
      if (!BRACKETED.test(t)) return false;
    }
    return true;
  }

  // v1.40.341-prv-bullets3 — only hide a template-only list when a real
  // (non-placeholder) rendering exists to fall back to. The original code
  // hid EVERY template-only list unconditionally, so an empty section (only
  // the template, no real data yet) went blank. The module header always
  // intended the sibling check ("a sibling editable-text span shows the
  // same text"); this restores it. When the section is empty the template
  // stays visible so the user can see and fill the placeholders.
  function hasRealDataSibling(list) {
    var node = list;
    for (var depth = 0; depth < 4 && node; depth++) {
      node = node.parentElement;
      if (!node) break;
      var spans = node.querySelectorAll('[data-antcv-editable-text="true"]');
      for (var i = 0; i < spans.length; i++) {
        var sp = spans[i];
        if (list.contains(sp)) continue;
        var t = clean(sp.textContent || '');
        // Real content = non-empty AND not itself a [bracketed] placeholder.
        if (t && !BRACKETED.test(t)) return true;
      }
    }
    return false;
  }

  function hideTemplateLists() {
    var paper = previewPaper();
    if (!paper) return;
    var lists = paper.querySelectorAll('ul, ol');
    for (var i = 0; i < lists.length; i++) {
      var list = lists[i];
      if (list.getAttribute('data-antcv-prv-bullets-hidden') === '1') continue;
      if (!isTemplateOnlyList(list)) continue;
      // Keep the template visible when there is nothing real to show in its
      // place — otherwise an empty section renders blank.
      if (!hasRealDataSibling(list)) continue;
      list.style.setProperty('display', 'none', 'important');
      list.setAttribute('data-antcv-prv-bullets-hidden', '1');
      noteHidden();
    }
  }

  // ─── Sweep + observer ──────────────────────────────────────────

  function sweep() {
    try {
      promoteEditableSpans();
      hideTemplateLists();
    } catch (e) {
      try { console.warn('[preview-bullets-dedup]', e && e.message); } catch (_) {}
    }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      sweep();
    });
  }

  function start() {
    sweep();
    var delays = [100, 300, 800, 1600, 3000];
    for (var d = 0; d < delays.length; d++) setTimeout(sweep, delays[d]);
    try {
      new MutationObserver(schedule).observe(document.body || document.documentElement, {
        childList: true, subtree: true,
      });
    } catch (_) {}
    window.addEventListener('antcv:sections-updated', schedule);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }

  window.AntcvPreviewBulletsDedup341 = { version: VERSION, run: sweep };
  try { console.debug('[preview-bullets-dedup] installed v' + VERSION); } catch (_) {}
})();
