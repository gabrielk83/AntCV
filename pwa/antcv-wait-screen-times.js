/* AntCV wait-screen-times sidecar (v1.40.196)
 * ============================================================
 *
 * Purpose
 * -------
 * The wait-screen overlay shown during generation displays labels
 * like "about 60 seconds" or "about 90 seconds". Both are wrong:
 * the real job (CV + CL + analysis with multi-LLM consensus) takes
 * 4-6 minutes on average. The 60s/90s labels were calibrated for
 * an earlier single-call pipeline and never updated.
 *
 * We can't edit app.js to change the source strings, so this
 * sidecar does a DOM text-replacement pass: whenever a wait-screen
 * overlay appears, swap the misleading numbers for an accurate
 * range.
 *
 * Detection
 * ---------
 * Wait-screen overlays are characterised by:
 *   - Position: fixed/absolute, covering a large portion of the
 *     viewport
 *   - Contain a "Generating" / "Translating" / "Analysing" /
 *     "Working" header
 *   - Contain a duration hint like "about N seconds" / "~N s" /
 *     "(N seconds)" or a countdown timer
 *
 * Our matcher is intentionally loose: we look for text nodes
 * inside the page that contain a recognised duration token AND
 * sit near a recognised "in-progress" phrase. Replacement is
 * idempotent and tagged so we don't re-process.
 *
 * Patterns rewritten
 * ------------------
 *   "60 seconds"     → "4-6 minutes"
 *   "60s"            → "4-6 min"
 *   "~60s"           → "~4-6 min"
 *   "about 60 seconds" → "about 4-6 minutes"
 *   "approximately 60 seconds" → "approximately 4-6 minutes"
 *   "90 seconds"     → "4-6 minutes"
 *   "90s"            → "4-6 min"
 *   "~90s"           → "~4-6 min"
 *   "(60s)" / "(90s)" → "(4-6 min)"
 *   "1-2 minutes"    → "4-6 minutes"  (older label, just in case)
 *
 * We DO NOT touch:
 *   - Countdown timers showing dynamic numbers (e.g. a live "47s
 *     remaining" — these have always-changing values, swapping
 *     them would look broken)
 *   - Sentences not associated with a generation/wait context
 *     (we gate on a nearby "Generating"/"Working" anchor word)
 *
 * Public API
 * ----------
 *   window.AntcvWaitScreenTimes.version
 *   window.AntcvWaitScreenTimes._applyAll(): force a pass
 *   window.AntcvWaitScreenTimes.targetRangeLabel: 'string'
 */
(function () {
  'use strict';

  if (window.__antcvWaitScreenTimesInstalled) return;
  window.__antcvWaitScreenTimesInstalled = '1.40.196';

  // Anchor words: presence of one of these in the same overlay
  // confirms we're looking at a wait-screen, not arbitrary copy.
  const ANCHOR_WORDS = [
    'generating', 'generation', 'translating', 'translation',
    'analysing', 'analyzing', 'analysis', 'working',
    'preparing', 'building', 'compiling', 'processing',
    'please wait', 'this may take', 'estimated',
    // Danish
    'genererer', 'oversætter', 'analyserer', 'arbejder',
    'vent venligst', 'forventet',
  ];

  const ANCHOR_REGEX = new RegExp('\\b(' + ANCHOR_WORDS.map(function (w) {
    return w.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  }).join('|') + ')\\b', 'i');

  // Replacement table — order matters (longest first so we don't
  // partially-match a more specific phrase).
  const REPLACEMENTS = [
    // "about 60-90 seconds" → "about 4-6 minutes"
    [/\babout\s+60[\u2013\u2014-]90\s+seconds?\b/gi, 'about 4-6 minutes'],
    [/\bapproximately\s+60[\u2013\u2014-]90\s+seconds?\b/gi, 'approximately 4-6 minutes'],
    // "about N seconds"
    [/\babout\s+(?:60|90)\s+seconds?\b/gi, 'about 4-6 minutes'],
    [/\bapproximately\s+(?:60|90)\s+seconds?\b/gi, 'approximately 4-6 minutes'],
    [/\bestimated\s+(?:60|90)\s+seconds?\b/gi, 'estimated 4-6 minutes'],
    // "1-2 minutes" (older label, just in case)
    [/\b1[\u2013\u2014-]2\s+minutes?\b/g, '4-6 minutes'],
    // "(60s)" / "(90s)"
    [/\((?:60|90)\s*s\)/g, '(4-6 min)'],
    [/\(~\s*(?:60|90)\s*s\)/g, '(~4-6 min)'],
    // Plain "60 seconds" / "90 seconds"
    [/\b(?:60|90)\s+seconds?\b/g, '4-6 minutes'],
    // "60s" / "90s" / "~60s" — needs word boundary on left to avoid
    // mangling unrelated tokens like "ID 60sX".
    [/(^|[^A-Za-z0-9])~\s*(?:60|90)s\b/g, '$1~4-6 min'],
    [/(^|[^A-Za-z0-9])(?:60|90)s\b/g, '$1' + '4-6 min'],
    // Danish: "60 sekunder" / "90 sekunder"
    [/\b(?:60|90)\s+sekunder?\b/g, '4-6 minutter'],
    [/\bcirka\s+(?:60|90)\s+sekunder?\b/gi, 'cirka 4-6 minutter'],
  ];

  function findWaitScreenContainers() {
    const out = [];
    // Common overlay/modal patterns. We look for elements that:
    //  - have fixed/absolute positioning with high z-index, OR
    //  - carry "overlay" / "modal" / "wait" / "loading" in their
    //    class or aria-label
    //  - are large (cover >= 25% of viewport)
    const all = document.querySelectorAll(
      '[class*="overlay" i], [class*="modal" i], [class*="wait" i], ' +
      '[class*="loading" i], [class*="progress" i], [class*="spinner" i], ' +
      '[role="dialog"], [role="alertdialog"], [data-antcv-wait], ' +
      '[data-antcv-overlay]'
    );
    for (const el of all) {
      if (el.getAttribute('data-antcv-wait-rewritten') === '1') continue;
      // Cheap visibility check.
      if (!el.offsetParent && el.tagName !== 'BODY') {
        // Hidden — skip.
        const cs = el.ownerDocument && el.ownerDocument.defaultView
                   ? el.ownerDocument.defaultView.getComputedStyle(el)
                   : null;
        if (!cs || cs.display === 'none' || cs.visibility === 'hidden') continue;
      }
      const t = (el.textContent || '');
      if (!t.length) continue;
      if (!ANCHOR_REGEX.test(t)) continue;
      out.push(el);
    }
    return out;
  }

  function patchTextNodes(root) {
    if (!root) return 0;
    let n = 0;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const dirty = [];
    let node;
    while ((node = walker.nextNode())) {
      const orig = node.nodeValue;
      if (!orig || orig.length < 2) continue;
      // Skip text inside editable areas.
      let p = node.parentNode, isEditable = false;
      while (p && p !== root.ownerDocument.body) {
        if (p.nodeType === 1) {
          const tag = (p.tagName || '').toLowerCase();
          if (tag === 'input' || tag === 'textarea' || tag === 'script' || tag === 'style') {
            isEditable = true; break;
          }
          if (p.isContentEditable) { isEditable = true; break; }
        }
        p = p.parentNode;
      }
      if (isEditable) continue;
      let next = orig;
      for (const [re, repl] of REPLACEMENTS) {
        next = next.replace(re, repl);
      }
      if (next !== orig) dirty.push([node, next]);
    }
    for (const [node, next] of dirty) {
      try { node.nodeValue = next; n++; } catch (_) {}
    }
    return n;
  }

  // Cheap precondition (BOOT-WAITSCREEN-GATE-001): every REPLACEMENTS entry
  // requires a "60"/"90" with a word boundary in front (\b60, "(60s)", "~60s",
  // non-alnum/start before the digits) or a "1-2 minutes" token. If the
  // whole-document text contains none of those, the 9-selector case-insensitive
  // full-document querySelectorAll + per-element textContent scan in
  // findWaitScreenContainers cannot rewrite anything, so skip it. During boot no
  // wait overlay exists, so this short-circuits every wasted pass. Reads one
  // already-materialised string + regex — never calls querySelector, so it can't
  // add to the dominant native query cost.
  //   - The \b is what the REPLACEMENTS need AND what keeps this exact: it
  //     excludes incidental substrings like the always-present spinner keyframe
  //     "rotate(360deg)" (no boundary between 3 and 6) and years like 1990/2090,
  //     none of which any replacement would rewrite. A plain indexOf('60') would
  //     match "360deg" on every page and never let the gate fire.
  // Strict superset of "a replacement could match", so it never suppresses a
  // real rewrite (a 60/90 that is in content but not in a wait overlay just
  // falls through to the unchanged scan path, which then rewrites nothing).
  function canMatchAnyReplacement() {
    const t = (document.body && document.body.textContent) || '';
    if (/\b(?:60|90)/.test(t)) return true;
    if (/\b1[–—-]2\s+minutes?\b/.test(t)) return true;
    return false;
  }

  function applyAll() {
    if (!canMatchAnyReplacement()) return 0;
    const containers = findWaitScreenContainers();
    let total = 0;
    for (const c of containers) {
      const n = patchTextNodes(c);
      if (n > 0) {
        c.setAttribute('data-antcv-wait-rewritten', '1');
        total += n;
      }
    }
    if (total > 0) {
      try { console.debug('[wait-screen-times] rewrote', total, 'time-label node(s)'); } catch (_) {}
    }
    return total;
  }

  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { applyAll(); } catch (_) {}
    });
  }

  // First passes — wait-screens may render slightly after first paint.
  schedule();
  [200, 600, 1500, 3500].forEach(function (d) { setTimeout(schedule, d); });

  // Watch for new overlays mounting.
  try {
    const mo = new MutationObserver(function (records) {
      for (const r of records) {
        if (r.addedNodes && r.addedNodes.length) { schedule(); return; }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true });
  } catch (_) {}

  // Re-arm on generation-start signals if app.js fires any.
  window.addEventListener('antcv:generation-start', schedule);
  window.addEventListener('antcv:translation-start', schedule);

  window.AntcvWaitScreenTimes = {
    version: '1.40.196',
    targetRangeLabel: '4-6 minutes',
    _applyAll: applyAll,
  };

  try { console.debug('[wait-screen-times] installed v1.40.196'); } catch (_) {}
})();
