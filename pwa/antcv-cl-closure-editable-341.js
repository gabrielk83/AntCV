/* AntCV CL Closure editable-in-Preview (v1.40.341-p0c)
 * ============================================================
 *
 * CL-002
 * ------
 * The standalone Closure section in the Cover Letter ("Sincerely,"
 * / "Best regards," + signature line) is rendered in Preview by
 * app.js. Today the user can't edit it directly in Preview —
 * they have to go through the panel.
 *
 * Acceptance per §4.3: "Closure becomes directly editable in
 * Preview, persists across blur/reopen/export. Round-trip
 * lossless in Preview, panel, DOCX, PDF."
 *
 * Strategy
 * --------
 * 1. Find Preview elements whose closest [data-sid] is 'closure'
 *    or 'closing' (CL uses both spellings across versions).
 * 2. For each leaf text-bearing element inside that section, set
 *    contenteditable="true" and tabindex so keyboard users reach
 *    it.
 * 3. On blur, persist the new text to
 *    localStorage['sections'][activeDoc][closureSection][content
 *    OR items[0] OR firstStringField] depending on the section's
 *    shape. Mirrors the pattern existing sidecars use for in-place
 *    edits — see antcv-overlay.js's reset paths for reference.
 * 4. Fire CustomEvent('antcv:sections-updated', { source:
 *    'cl-closure-editable-341' }) so other sidecars re-render.
 *
 * Cooperation
 * -----------
 * The Preview cluster guard (antcv-cl-preview-cluster-guard-341)
 * preserves anything tagged data-antcv-cl-closure-editable="1", so
 * making a Closure node editable doesn't accidentally make it
 * look like a cluster shape (it doesn't — single text node, no
 * buttons — but the guard's filter is conservative).
 */
(function () {
  'use strict';

  var SCRIPT_VERSION = '1.40.341-p0c-fix3';
  if (window.__antcvClClosureEditable341 === SCRIPT_VERSION) return;
  window.__antcvClClosureEditable341 = SCRIPT_VERSION;

  var SECTIONS_KEY = 'sections';
  var TARGET_SIDS = { 'closure': 1, 'closing': 1 };

  function activeDoc() {
    try {
      var v = localStorage.getItem('doc');
      if (v === 'cv' || v === 'cl') return v;
    } catch (_) {}
    return 'cl';
  }

  function readSections() {
    try {
      var raw = localStorage.getItem(SECTIONS_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_) { return null; }
  }

  function writeSections(bundle) {
    try {
      localStorage.setItem(SECTIONS_KEY, JSON.stringify(bundle));
      // v1.40.341-p0c-fix3: DO NOT dispatch antcv:sections-updated.
      // antcv-personality.js listens for that event and runs a
      // forceRebuild from personalInfo.notes/summary that
      // OVERWRITES the just-written closure text — making it
      // look like the edit didn't persist + repeated clicks
      // appeared to make Closure disappear entirely.
      //
      // The localStorage write still happens, so the edit is
      // persisted; the user's typed text stays in the DOM
      // because nothing triggers an app.js re-render of the
      // leaf. On next page load app.js reads the new value
      // from storage and renders it directly. Live preview-
      // update for closure isn't critical — Closure is a
      // single short signature line; users don't expect it to
      // refresh other Preview surfaces.
      //
      // Name persistence (handled by antcv-candidate-preview-
      // editor-341) is UNAFFECTED — that sidecar writes to
      // personalInfo.name which app.js reads directly, and the
      // personality rebuild from notes/summary doesn't touch
      // personalInfo.name.
    } catch (_) {}
  }

  function findPreviewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function findClosureSections(paper) {
    if (!paper) return [];
    var out = [];
    var all = paper.querySelectorAll('[data-sid]');
    for (var i = 0; i < all.length; i++) {
      var sid = all[i].getAttribute('data-sid') || '';
      if (TARGET_SIDS.hasOwnProperty(sid)) out.push(all[i]);
    }
    return out;
  }

  // v1.40.341-p0c-fix2: this build of app.js does NOT expose
  // [data-sid="closure"] / "closing" — the Closure greeting
  // ("Kind regards," / "Sincerely," / "Venlig hilsen," / ...)
  // is rendered as a nested div inside the preview paper with
  // no section marker. Locate it by text match against a list
  // of canonical closing phrases.
  var CLOSING_PATTERNS = [
    /^kind regards/i,
    /^sincerely/i,
    /^best regards/i,
    /^yours truly/i,
    /^yours sincerely/i,
    /^venlig hilsen/i,            // Danish
    /^med venlig hilsen/i,
    /^atentamente/i,              // Spanish
    /^cordialmente/i,
    /^saludos/i,
    /^此致/,                       // Chinese
    /^敬礼/,
  ];

  function findClosureLeavesByText(paper) {
    var out = [];
    if (!paper) return out;
    // Walk LEAF candidates inside the preview paper.
    var probes = paper.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
    for (var i = 0; i < probes.length; i++) {
      var el = probes[i];
      if (!el.isConnected) continue;
      if (el.children && el.children.length > 0) continue;
      // Skip structural markers (PB-006 boundary primitives, our own).
      if (el.getAttribute && (
        el.getAttribute('data-antcv-continuation-header') === '1' ||
        el.getAttribute('data-antcv-page-break') === '1' ||
        el.getAttribute('data-antcv-control-bar') === '1' ||
        el.getAttribute('data-antcv-pb284-bar') === '1' ||
        el.getAttribute('data-antcv-pb284-mark') === '1' ||
        el.getAttribute('aria-hidden') === 'true' ||
        el.getAttribute('data-antcv-cl-closure-editable') === '1'  // already wrapped
      )) continue;
      var t = (el.textContent || '').replace(/[\t\n\r ]+/g, ' ').trim();
      if (!t) continue;
      // Match against any canonical closing phrase.
      for (var p = 0; p < CLOSING_PATTERNS.length; p++) {
        if (CLOSING_PATTERNS[p].test(t)) {
          out.push(el);
          break;
        }
      }
    }
    return out;
  }

  // Pick the text-bearing leaf(s) inside a closure section that
  // make sense to edit. Prefer block-level elements containing
  // text but no buttons / no nested data-sid.
  function textLeavesIn(sectionEl) {
    var leaves = [];
    var cand = sectionEl.querySelectorAll('p, div, span, h1, h2, h3, h4, h5, h6');
    for (var i = 0; i < cand.length; i++) {
      var el = cand[i];
      if (!el.isConnected) continue;
      if (el.children && el.children.length > 0) continue;          // leaf only
      if (el.querySelector && el.querySelector('button')) continue; // no buttons
      // v1.40.341-p1c-fix-1: do NOT skip empty text leaves.
      // Closure is editable per CL-002 acceptance — even when the
      // section has no signature line yet, the user must be able to
      // CLICK INTO it and type. Skipping empty leaves meant an empty
      // Closure section had no contenteditable target.
      // Only skip elements that look STRUCTURAL (PB-006 boundary
      // markers, page-break spacers, control-bar hosts).
      var t = (el.textContent || '').replace(/[\t\n\r ]+/g, ' ').trim();
      // Skip our own markers and any cooperator markers.
      if (el.getAttribute && (
        el.getAttribute('data-antcv-continuation-header') === '1' ||
        el.getAttribute('data-antcv-page-break') === '1' ||
        el.getAttribute('data-antcv-control-bar') === '1' ||
        el.getAttribute('data-antcv-pb284-bar') === '1' ||
        el.getAttribute('data-antcv-pb284-mark') === '1' ||
        el.getAttribute('aria-hidden') === 'true'
      )) continue;
      // Skip spacer / divider / decorative leaves: zero-height,
      // role="separator", or visually-empty padded boxes. We use
      // a conservative shape check — a leaf with no text AND no
      // padding/border is almost certainly a decorative artefact.
      if (!t) {
        var tagName = (el.tagName || '').toLowerCase();
        // Empty SPAN is almost always a decorative artefact (gap,
        // spacer, icon-holder). Allow empty P / DIV / heading
        // through as a typeable slot.
        if (tagName === 'span') continue;
      }
      leaves.push(el);
    }
    return leaves;
  }

  // Persist the new text. Section shape is unpredictable across
  // versions — try 'content', then items[0] (string or {text}),
  // then bullets[0]. If nothing matches we fire the update event
  // so listeners can react, but don't mutate storage.
  function persistClosureText(sid, leafEl, newText) {
    var bundle = readSections();
    if (!bundle) return false;
    var doc = activeDoc();
    var arr = bundle && bundle[doc];
    if (!Array.isArray(arr)) return false;
    var section = null;
    for (var i = 0; i < arr.length; i++) {
      var s = arr[i];
      if (s && s.id === sid) { section = s; break; }
    }
    if (!section) return false;
    var changed = false;
    if (typeof section.content === 'string') {
      if (section.content !== newText) { section.content = newText; changed = true; }
    } else if (Array.isArray(section.items) && section.items.length) {
      var item = section.items[0];
      if (typeof item === 'string') {
        if (item !== newText) { section.items[0] = newText; changed = true; }
      } else if (item && typeof item === 'object') {
        if (typeof item.text === 'string' && item.text !== newText) {
          item.text = newText; changed = true;
        } else if (typeof item.value === 'string' && item.value !== newText) {
          item.value = newText; changed = true;
        }
      }
    } else if (Array.isArray(section.bullets) && section.bullets.length) {
      if (section.bullets[0] !== newText) { section.bullets[0] = newText; changed = true; }
    }
    if (changed) writeSections(bundle);
    return changed;
  }

  function attachEditableHandlers(leafEl, sid) {
    if (leafEl.getAttribute('data-antcv-cl-closure-editable') === '1') return;
    leafEl.setAttribute('data-antcv-cl-closure-editable', '1');
    leafEl.setAttribute('contenteditable', 'true');
    leafEl.setAttribute('spellcheck', 'true');
    if (!leafEl.hasAttribute('tabindex')) leafEl.setAttribute('tabindex', '0');
    // Keep cursor caret visible.
    leafEl.style.cursor = 'text';
    // v1.40.341-p1c-fix-1: empty Closure leaves collapse to zero
    // height in browser default block layout — the user has nowhere
    // to click. Give the leaf a minimum hit-area so it's typeable
    // even when empty.
    var currentText = (leafEl.textContent || '').replace(/[\t\n\r ]+/g, ' ').trim();
    if (!currentText) {
      if (!leafEl.style.minHeight) leafEl.style.minHeight = '1.4em';
      if (!leafEl.style.minWidth)  leafEl.style.minWidth  = '8em';
      // Visual hint via attribute so external CSS can render a
      // placeholder via [data-antcv-cl-closure-editable="1"]:empty::before.
      // We don't inject text content because that would persist.
      leafEl.setAttribute('data-antcv-cl-closure-empty', '1');
    }
    // Don't trigger any parent click handlers when editing.
    leafEl.addEventListener('click', function (ev) { ev.stopPropagation(); });
    leafEl.addEventListener('input', function () {
      // Once the user types anything, strip the empty marker so the
      // placeholder CSS rule stops showing and the min-height can
      // collapse on the next render if desired.
      var t = (leafEl.textContent || '').replace(/[\t\n\r ]+/g, ' ').trim();
      if (t && leafEl.getAttribute('data-antcv-cl-closure-empty') === '1') {
        leafEl.removeAttribute('data-antcv-cl-closure-empty');
      }
    });
    leafEl.addEventListener('blur', function () {
      try {
        var text = (leafEl.textContent || '').replace(/[\t\n\r ]+/g, ' ').trim();
        persistClosureText(sid, leafEl, text);
      } catch (_) {}
    });
    leafEl.addEventListener('keydown', function (ev) {
      // Enter commits + blurs (preserve the canonical signature line shape).
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        leafEl.blur();
      }
    });
  }

  // CSS placeholder + min-hit-area for empty closure slots.
  // Injected once per session, idempotent.
  function injectCss() {
    if (document.getElementById('antcv-cl-closure-editable-341-css')) return;
    var s = document.createElement('style');
    s.id = 'antcv-cl-closure-editable-341-css';
    s.textContent = [
      '[data-antcv-cl-closure-editable="1"][data-antcv-cl-closure-empty="1"]:empty::before {',
      '  content: "Click to add closing line (e.g. \\"Sincerely, Anita\\")";',
      '  color: #999;',
      '  font-style: italic;',
      '  pointer-events: none;',
      '}',
      // When focused, hide the placeholder so the caret is alone.
      '[data-antcv-cl-closure-editable="1"][data-antcv-cl-closure-empty="1"]:empty:focus::before {',
      '  content: "";',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }

  function sweepOnce() {
    var paper = findPreviewPaper();
    if (!paper) return;
    // Path A: anchor-based — works when the build exposes
    // [data-sid="closure"] / [data-sid="closing"] sections.
    var sections = findClosureSections(paper);
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var sid = sec.getAttribute('data-sid') || '';
      var leaves = textLeavesIn(sec);
      for (var j = 0; j < leaves.length; j++) {
        try { attachEditableHandlers(leaves[j], sid); } catch (_) {}
      }
    }
    // Path B: content-based fallback for builds where the
    // Closure greeting renders as a nested div with no section
    // marker. We pass sid='closure' as the conventional id so
    // persistClosureText still resolves against
    // localStorage.sections.cl[id=closure] if it exists.
    var fallback = findClosureLeavesByText(paper);
    for (var k = 0; k < fallback.length; k++) {
      try { attachEditableHandlers(fallback[k], 'closure'); } catch (_) {}
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

  injectCss();
  schedule();
  var delays = [200, 600, 1500, 3000];
  for (var d = 0; d < delays.length; d++) setTimeout(schedule, delays[d]);

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvClClosureEditable341 = {
    version: SCRIPT_VERSION,
    sweep: sweepOnce,
  };

  try { console.debug('[cl-closure-editable] installed v' + SCRIPT_VERSION); } catch (_) {}
})();
