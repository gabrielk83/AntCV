/* AntCV experience-continuation-fix sidecar (v1.40.195)
 * ============================================================
 *
 * Purpose
 * -------
 * When a natural page break falls inside the PROFESSIONAL EXPERIENCE
 * block (e.g. between Sirin Labs and Meprolight), app.js's
 * continuation-header insertion is picking up the WRONG section's
 * title — typically "SELECTED OUTCOMES" (the section preceding
 * Experience in the layout) instead of "PROFESSIONAL EXPERIENCE
 * (CONT.)". The result: page 2 opens with a heading that has no
 * content underneath it, then Experience continues without a
 * proper continuation marker.
 *
 * Symptom (from Gabriel's session, 2026-05-19):
 *   - Preview shows "SELECTED OUTCOMES" header at top of page 2.
 *   - Below it: bullet rows continuing from a role on page 1.
 *   - No "(CONT.)" suffix anywhere.
 *
 * Strategy
 * --------
 * We can't edit app.js. So we sit on the rendered preview, find any
 * continuation-style header whose text equals an earlier section's
 * heading rather than the section that actually owns the content
 * directly below it, and rewrite it.
 *
 * Detection
 * ---------
 * 1. Find every [data-sid] block in the preview-paper.
 * 2. For each block, look at its first child heading element.
 * 3. If the heading text uppercases to a value that DOESN'T match
 *    the section's own `title` (from localStorage.sections), it's a
 *    mis-applied continuation header from an upstream section's
 *    title — patch it.
 *
 * We also detect the simpler case: any element whose textContent
 * is a known earlier-section title AND is the first visual element
 * on a new page AND is followed by content belonging to a later
 * section.
 *
 * The fix is straightforward — replace the heading text with the
 * correct section's title + " (CONT.)" and tag the node so we
 * don't re-process it.
 *
 * Print pipeline
 * --------------
 * window.print() picks up our rewritten DOM, so the browser-print
 * PDF fallback also gets the right heading. The docx-worker-side
 * (CONT.) logic lives in generate.js v1.14.8+ and is independent.
 *
 * Per-item continuation (from antcv-item-pages-render.js v1.40.194)
 * ----------------------------------------------------------------
 * That sidecar handles ONLY labeled_list / list / education sections
 * with explicit per-item _page assignments. It does not touch the
 * Experience section. The two sidecars cooperate, not conflict.
 */
(function () {
  'use strict';

  if (window.__antcvExpContFixInstalled) return;
  window.__antcvExpContFixInstalled = '1.40.195';

  const SECTIONS_KEY = 'sections';

  function activeDoc() {
    try {
      const v = localStorage.getItem('doc');
      if (v === 'cv' || v === 'cl') return v;
    } catch (_) {}
    return 'cv';
  }

  function readSections() {
    try {
      const raw = localStorage.getItem(SECTIONS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      const doc = activeDoc();
      const list = parsed && parsed[doc];
      return Array.isArray(list) ? list : [];
    } catch (_) { return []; }
  }

  function getSectionTitle(sid) {
    const list = readSections();
    for (const s of list) {
      if (s && s.id === sid) return String(s.title || '').trim();
    }
    return '';
  }

  // Find the preview-paper container.
  function getPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // Walk the section's own descendants and find a continuation-style
  // heading at the top — i.e. the first heading-like element that
  // appears as a direct or near-direct child of the section, and
  // which carries either a (CONT.)-style suffix or whose text doesn't
  // match the section's expected title.
  //
  // Returns an element if we found a mis-labeled candidate, else null.
  function findMisLabeledContinuationHeader(sectionEl, expectedTitle) {
    if (!sectionEl || !expectedTitle) return null;
    const expectedUpper = expectedTitle.toUpperCase().trim();
    const continuationSuffix = '(CONT.)';
    // Strategy: walk the first few block-level descendants in document
    // order. We're looking for the FIRST heading-like element. If it
    // carries (CONT.) and its base text matches expectedTitle, the
    // existing code did the right thing — bail. If it doesn't match,
    // we have a mis-label.
    const candidates = sectionEl.querySelectorAll(
      'h1, h2, h3, h4, [data-antcv-section-heading], [data-antcv-continuation-header], div[role="heading"]'
    );
    for (const el of candidates) {
      // Skip our own injected markers (from antcv-item-pages-render.js
      // v1.40.194 — those carry the right title by construction).
      if (el.getAttribute && el.getAttribute('data-antcv-continuation-header') === '1') {
        // These come from item-pages-render and have already been
        // built with the correct sectionTitle. Leave alone.
        continue;
      }
      const txt = (el.textContent || '').toUpperCase().trim();
      if (!txt) continue;
      const hasCont = txt.includes(continuationSuffix);
      // Strip (CONT.) for matching.
      const base = txt.replace(/\s*\(CONT\.\)\s*$/i, '').trim();
      if (base === expectedUpper) {
        // Already correctly labeled — done with this section.
        return null;
      }
      // It's a heading inside this section whose text claims to be a
      // different section. Patch it.
      el.__antcvOriginalText = el.textContent;
      el.setAttribute('data-antcv-cont-fix', '1');
      el.textContent = expectedTitle.toUpperCase() + ' (CONT.)';
      return el;
    }
    return null;
  }

  // The trickier case: the wrong heading sits OUTSIDE the section
  // element, between two sections, as a free-standing block at the
  // top of page 2. We detect this by looking for elements that
  //   (a) carry a known earlier-section's title text, AND
  //   (b) are immediately followed by content belonging to a later
  //       section (we detect via CSS top position — same "page" as
  //       the continuation of an earlier section).
  //
  // This is harder to detect reliably in CSS-paginated preview. We
  // do a conservative pass: for each [data-sid] section, look at the
  // element immediately preceding it in document order. If that
  // preceding element is a heading whose text matches a DIFFERENT
  // section's title (one that doesn't follow it), it's a mis-labeled
  // continuation marker and we rewrite it.
  function fixDanglingContinuationHeaders(paper) {
    const sections = paper.querySelectorAll('[data-sid]');
    if (!sections.length) return 0;

    // Build a quick lookup: title-upper → expected section id (the
    // section that legitimately carries that title).
    const allSections = readSections();
    const titleToSid = new Map();
    for (const s of allSections) {
      if (s && s.id && s.title) {
        titleToSid.set(String(s.title).toUpperCase().trim(), s.id);
      }
    }

    let fixed = 0;
    for (const sec of sections) {
      const sid = sec.getAttribute('data-sid');
      if (!sid) continue;
      // Skip the experience section itself for this pass (we handle
      // its internal continuation header below); we're looking for
      // stray heading elements that sit BEFORE a section in DOM but
      // carry a different section's title.
      const prev = sec.previousElementSibling;
      if (!prev) continue;
      // Is `prev` a heading-shaped element?
      const tag = (prev.tagName || '').toLowerCase();
      const isHeadingLike =
        tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4' ||
        prev.getAttribute('role') === 'heading' ||
        prev.hasAttribute('data-antcv-section-heading');
      if (!isHeadingLike) continue;
      // Skip our own injected markers.
      if (prev.getAttribute('data-antcv-continuation-header') === '1') continue;
      if (prev.getAttribute('data-antcv-cont-fix') === '1') continue;

      const prevText = (prev.textContent || '').toUpperCase().trim();
      if (!prevText) continue;
      const prevBase = prevText.replace(/\s*\(CONT\.\)\s*$/i, '').trim();
      // Does prev's text match a section that is NOT the next sibling?
      const ownerSid = titleToSid.get(prevBase);
      if (!ownerSid) continue;
      if (ownerSid === sid) continue; // prev legitimately heads `sec`

      // It's a continuation-style heading belonging to a DIFFERENT
      // section than the one immediately below it. The natural page
      // break has split content of `sec` (or an earlier section that
      // continues here) and the wrong title was used. Rewrite to the
      // current (next) section's title.
      const correctTitle = getSectionTitle(sid);
      if (!correctTitle) continue;
      prev.__antcvOriginalText = prev.textContent;
      prev.setAttribute('data-antcv-cont-fix', '1');
      prev.textContent = correctTitle.toUpperCase() + ' (CONT.)';
      fixed++;
    }
    return fixed;
  }

  // Within the experience section: app.js may inject a continuation
  // header that reads "SELECTED OUTCOMES" (the prior section). We
  // sweep the experience section for any heading-shaped element
  // whose text is a known earlier-section title (not the experience
  // section's own title), and patch it.
  function fixExperienceInternalHeader(paper) {
    const expSection = paper.querySelector('[data-sid="experience"]');
    if (!expSection) return 0;
    const expTitle = getSectionTitle('experience') || 'PROFESSIONAL EXPERIENCE';
    const patched = findMisLabeledContinuationHeader(expSection, expTitle);
    return patched ? 1 : 0;
  }

  // Public entry point: scan + fix.
  function applyAll() {
    const paper = getPaper();
    if (!paper) return;
    let n = 0;
    try { n += fixExperienceInternalHeader(paper); } catch (_) {}
    try { n += fixDanglingContinuationHeaders(paper); } catch (_) {}
    if (n > 0) {
      try { console.debug('[exp-cont-fix] patched', n, 'mis-labeled continuation header(s)'); } catch (_) {}
    }
  }

  // Scheduler.
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { applyAll(); } catch (_) {}
    });
  }

  schedule();
  [150, 500, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });

  // Re-apply whenever the preview paper subtree changes meaningfully.
  try {
    const mo = new MutationObserver(function (records) {
      // Filter out our own rewrites (data-antcv-cont-fix).
      let nonOurs = false;
      for (const r of records) {
        if (r.type !== 'childList' && r.type !== 'characterData') continue;
        const t = r.target;
        if (t && t.nodeType === 1 &&
            t.getAttribute && t.getAttribute('data-antcv-cont-fix') === '1') {
          continue;
        }
        nonOurs = true;
        break;
      }
      if (nonOurs) schedule();
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);
  // The print pipeline rebuilds the layout before printing — make
  // sure our fix is applied right before the browser snapshots the
  // page. We also patch `window.print` in antcv-print-iframe-preview
  // to call us first.
  window.addEventListener('beforeprint', function () {
    try { applyAll(); } catch (_) {}
  });

  // Public API.
  window.AntcvExpContFix = {
    version: '1.40.195',
    _applyAll: applyAll,
    _fixExperienceInternalHeader: fixExperienceInternalHeader,
    _fixDanglingContinuationHeaders: fixDanglingContinuationHeaders,
  };

  try { console.debug('[exp-cont-fix] installed v1.40.195'); } catch (_) {}
})();
