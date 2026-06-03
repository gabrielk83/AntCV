/* AntCV Personal-tab dedup (v1.40.341-pt-dedup)
 * ============================================================
 *
 * The Personal tab currently renders BOTH the older app.js styled
 * controls ("Original" — the user's preferred design) AND the
 * antcv-react-islands.js "new copy" duplicates of the same controls.
 * Per Gabriel: keep the Original interface, hide the new copy, but
 * preserve the new copy's underlying logic by bridging events.
 *
 * What this sidecar hides + bridges:
 *
 *   1. WRITING STYLE — the new-copy <select> has option text like
 *      "Nordic Minimal — was Scandinavian" and no <optgroup>. The
 *      Original uses Launch/Preview optgroups and short labels.
 *      Action: hide the new-copy section, mirror selection both ways
 *      so any listeners (islands or app.js) stay synchronised.
 *
 *   2. TONE CHIPS standalone section — header "Tone chips" with
 *      uppercase + letter-spacing, followed by 5 chip buttons
 *      (calm, restrained, factual, concrete, brief). The Original's
 *      "Preferred tone" already has its own chip surface.
 *      Action: hide the standalone section.
 *
 *   3. SAVED TONES "+ Save current as new slot" duplicate — the new
 *      copy renders an extra Save-slot button + "No saved tones yet"
 *      text. The Original tone-helper has the Custom 1/2/3 slot
 *      mechanism with data-antcv-tone-helper-* hooks.
 *      Action: hide the duplicate button and its empty-state text.
 *
 *   4. BROKEN long-chip — the Original's Preferred tone has a saved
 *      multi-sentence chip ("calm and direct. Short factual...").
 *      Action: split it on sentence boundaries into individual chips
 *      and persist the split into the preferred-tone storage.
 *
 * Strategy
 * --------
 * Pure-CSS hide isn't viable here because the new-copy elements have
 * inline styles only — no unique class names. We use content-based
 * DOM detection: find each element by the unique text pattern only
 * that element produces, mark it data-antcv-pt-dedup-handled="1" so
 * sweeps are idempotent, and set display:none.
 *
 * The MutationObserver re-runs the sweep on React rerenders so hidden
 * duplicates stay hidden.
 *
 * Hazards
 * -------
 *   - No \s in regex literals (uses [\t\n\r ]+).
 *   - No \u escapes.
 *   - Idempotent via data-antcv-pt-dedup-handled marker.
 *   - Scoped to NOT touch .antcv-preview-paper (Preview is read-only).
 *   - Each hide is recoverable via the data marker — if you ever want
 *     the new copy back, run:
 *       document.querySelectorAll('[data-antcv-pt-dedup-hidden]')
 *         .forEach(n => { n.style.display = ''; n.removeAttribute('data-antcv-pt-dedup-hidden'); });
 */
(function () {
  'use strict';

  var VERSION = '1.40.341-pt-dedup';
  if (window.__antcvPersonalTabDedup341 === VERSION) return;
  window.__antcvPersonalTabDedup341 = VERSION;

  function clean(s) {
    return String(s == null ? '' : s).replace(/[\t\n\r ]+/g, ' ').trim();
  }

  function shown(el) {
    if (!el || el.nodeType !== 1) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      var r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2;
    } catch (_) {
      return true;
    }
  }

  function isInPreviewPaper(el) {
    if (!el) return false;
    var paper = document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
    return !!(paper && paper.contains(el));
  }

  function hide(el, source) {
    if (!el) return false;
    if (el.getAttribute('data-antcv-pt-dedup-hidden') === '1') return false;
    el.style.setProperty('display', 'none', 'important');
    el.setAttribute('data-antcv-pt-dedup-hidden', '1');
    if (source) el.setAttribute('data-antcv-pt-dedup-source', source);
    return true;
  }

  // ─── 1. Writing Style — hide new copy, bridge events ────────────

  function findWritingStyleSelects() {
    var all = Array.from(document.querySelectorAll('select')).filter(function (s) {
      return shown(s) && !isInPreviewPaper(s);
    });
    var newCopy = null;
    var original = null;
    for (var i = 0; i < all.length; i++) {
      var sel = all[i];
      var opts = sel.querySelectorAll('option');
      var hasNordic = false;
      var hasAnnotation = false;
      var hasOptgroup = sel.querySelectorAll('optgroup').length > 0;
      for (var j = 0; j < opts.length; j++) {
        var t = opts[j].textContent || '';
        if (opts[j].value === 'nordic-minimal') hasNordic = true;
        if (/—\s+was\s+/i.test(t)) hasAnnotation = true;
      }
      if (!hasNordic) continue;
      if (hasAnnotation && !hasOptgroup) newCopy = sel;
      else if (hasOptgroup) original = sel;
    }
    return { newCopy: newCopy, original: original };
  }

  function bridgeWritingStyle(newCopy, original) {
    if (!newCopy || !original) return;
    if (newCopy.getAttribute('data-antcv-pt-dedup-bridged') === '1') return;
    newCopy.setAttribute('data-antcv-pt-dedup-bridged', '1');
    // Initial alignment: copy whichever value is set.
    if (original.value && original.value !== newCopy.value) {
      try { newCopy.value = original.value; } catch (_) {}
    } else if (newCopy.value && newCopy.value !== original.value) {
      try { original.value = newCopy.value; } catch (_) {}
    }
    // Forward original → new copy so any islands listeners still see
    // the right value when the user picks a style on the visible
    // Original control.
    original.addEventListener('change', function () {
      if (newCopy.value !== original.value) {
        try {
          newCopy.value = original.value;
          newCopy.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
      }
    });
    // And new copy → original (defensive — programmatic changes
    // from islands code should still be observable by app.js).
    newCopy.addEventListener('change', function () {
      if (original.value !== newCopy.value) {
        try {
          original.value = newCopy.value;
          original.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (_) {}
      }
    });
  }

  function hideWritingStyleNewCopy(newCopy) {
    if (!newCopy) return;
    // Walk up to the section container — the parent that holds both
    // the "Writing style" uppercase label, the select, AND the
    // "Say less and say it clearly" subtitle. Stop at the first
    // ancestor whose text matches both anchors.
    var p = newCopy.parentElement;
    for (var d = 0; p && d < 6; d++, p = p.parentElement) {
      var t = clean(p.textContent || '');
      if (/Writing style/i.test(t) && /Say less/i.test(t)) {
        hide(p, 'writing-style-new-copy');
        return;
      }
    }
    // Fallback — hide just the select if section container not found.
    hide(newCopy, 'writing-style-new-copy-fallback');
  }

  // ─── 2. Tone chips standalone section ───────────────────────────

  function hideToneChipsSection() {
    // Find a leaf <div> whose text is EXACTLY "Tone chips" — the
    // standalone section header. The Original's "Preferred tone" /
    // "Tone qualities to apply..." surfaces NEVER match this exact text.
    var divs = document.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      if (!shown(d)) continue;
      if (d.getAttribute('data-antcv-pt-dedup-handled') === '1') continue;
      if (isInPreviewPaper(d)) continue;
      if (d.children.length > 0) continue;
      var t = clean(d.textContent || '');
      if (t !== 'Tone chips') continue;
      d.setAttribute('data-antcv-pt-dedup-handled', '1');
      hide(d, 'tone-chips-header');
      // Hide the chip buttons that follow until we hit a non-chip
      // sibling. The chips are 5 buttons with title attributes like
      // "dampen exclamation".
      var sib = d.nextElementSibling;
      var hidden = 0;
      while (sib && hidden < 12) {
        if (sib.tagName === 'BUTTON' || (sib.children.length && sib.querySelector('button'))) {
          hide(sib, 'tone-chips-chip');
          hidden++;
          sib = sib.nextElementSibling;
        } else {
          break;
        }
      }
      return true;
    }
    return false;
  }

  // ─── 3. "Save current as new slot" duplicate ────────────────────

  function hideSaveSlotDuplicate() {
    var btns = document.querySelectorAll('button');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (!shown(b)) continue;
      if (isInPreviewPaper(b)) continue;
      if (b.getAttribute('data-antcv-pt-dedup-handled') === '1') continue;
      // The Original tone-helper save uses a different button text
      // ("Save" inside the data-antcv-tone-helper-save handler) — the
      // duplicate is the long-form "+ Save current as new slot".
      if (b.hasAttribute('data-antcv-tone-helper-save')) continue;
      var t = clean(b.textContent || '');
      if (t !== '+ Save current as new slot') continue;
      b.setAttribute('data-antcv-pt-dedup-handled', '1');
      // Try to hide the container that wraps both the button AND the
      // "No saved tones yet" empty-state sibling. Walk up looking for
      // a parent that contains both.
      var p = b.parentElement;
      var hidden = false;
      for (var d = 0; p && d < 4; d++, p = p.parentElement) {
        var pt = clean(p.textContent || '');
        if (/Save current as new slot/i.test(pt) && /No saved tones yet/i.test(pt)) {
          hide(p, 'save-slot-duplicate-container');
          hidden = true;
          break;
        }
      }
      if (!hidden) {
        hide(b, 'save-slot-duplicate-button');
        // Also try the adjacent empty-state text span.
        var sib = b.nextElementSibling;
        while (sib && /no saved tones yet/i.test(clean(sib.textContent || ''))) {
          hide(sib, 'save-slot-duplicate-empty-text');
          sib = sib.nextElementSibling;
        }
      }
    }
  }

  // ─── 4. Split the multi-sentence "calm and direct..." chip ──────
  //
  // The user accidentally saved an entire paragraph as a single chip.
  // We split on sentence boundaries (. ! ?) into individual chips
  // and persist the split into localStorage so reload keeps them split.

  var TONE_KEYS = ['antcv.preferredTones.v1', 'antcv.toneChips.v1', 'antcv.tone.active.v1'];

  function readToneList() {
    for (var i = 0; i < TONE_KEYS.length; i++) {
      try {
        var raw = localStorage.getItem(TONE_KEYS[i]);
        if (!raw) continue;
        var v = JSON.parse(raw);
        if (Array.isArray(v)) return { key: TONE_KEYS[i], list: v };
        if (v && Array.isArray(v.active)) return { key: TONE_KEYS[i], list: v.active, wrap: 'active' };
      } catch (_) {}
    }
    return null;
  }

  function writeToneList(found, newList) {
    try {
      if (found.wrap === 'active') {
        var raw = localStorage.getItem(found.key);
        var v = raw ? JSON.parse(raw) : {};
        v.active = newList;
        localStorage.setItem(found.key, JSON.stringify(v));
      } else {
        localStorage.setItem(found.key, JSON.stringify(newList));
      }
    } catch (_) {}
  }

  function splitLongChip(s) {
    // Split on sentence boundaries — period/exclamation/question
    // followed by whitespace. Preserves the trailing terminator on
    // each part. Drops empty parts.
    var parts = String(s || '').split(/(?<=[.!?])[\t\n\r ]+/);
    return parts
      .map(function (p) { return clean(p).replace(/[.!?]+$/, ''); })
      .filter(function (p) { return p && p.length > 0 && p.length < 80; });
  }

  function maybeSplitLongChip() {
    // Only act on chips that have the multi-sentence pattern. Look for
    // a chip whose span text matches "calm and direct..." or similar
    // long-phrase shape (length > 60, contains at least one ". ").
    var spans = document.querySelectorAll('span');
    for (var i = 0; i < spans.length; i++) {
      var sp = spans[i];
      if (!shown(sp)) continue;
      if (isInPreviewPaper(sp)) continue;
      if (sp.getAttribute('data-antcv-pt-dedup-handled') === '1') continue;
      var t = clean(sp.textContent || '');
      if (t.length < 60) continue;
      if (!/\.\s/.test(t)) continue;
      // Must be inside a chip — heuristic: a sibling × remove button
      // exists with title containing "Remove".
      var parent = sp.parentElement;
      if (!parent) continue;
      var removeBtn = parent.querySelector('button[title^="Remove "]');
      if (!removeBtn) continue;
      sp.setAttribute('data-antcv-pt-dedup-handled', '1');
      // Split and persist.
      var pieces = splitLongChip(t);
      if (pieces.length < 2) continue;
      var found = readToneList();
      if (!found) continue;
      // Replace the old long chip with the split pieces.
      var newList = [];
      var replaced = false;
      for (var k = 0; k < found.list.length; k++) {
        if (!replaced && clean(found.list[k]) === t) {
          for (var p = 0; p < pieces.length; p++) newList.push(pieces[p]);
          replaced = true;
        } else {
          newList.push(found.list[k]);
        }
      }
      if (replaced) {
        writeToneList(found, newList);
        // Trigger a rerender by dispatching the standard event.
        try {
          window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
            detail: { source: 'personal-tab-dedup-341' },
          }));
        } catch (_) {}
        try { console.debug('[personal-tab-dedup] split long chip into', pieces.length, 'pieces'); } catch (_) {}
      }
      return true;
    }
    return false;
  }

  // ─── Sweep + observer ───────────────────────────────────────────

  function sweep() {
    try {
      var pair = findWritingStyleSelects();
      if (pair.newCopy && pair.original) {
        bridgeWritingStyle(pair.newCopy, pair.original);
        hideWritingStyleNewCopy(pair.newCopy);
      }
      hideToneChipsSection();
      hideSaveSlotDuplicate();
      maybeSplitLongChip();
    } catch (e) {
      try { console.warn('[personal-tab-dedup]', e && e.message); } catch (_) {}
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

  window.AntcvPersonalTabDedup341 = { version: VERSION, run: sweep };
  try { console.debug('[personal-tab-dedup] installed v' + VERSION); } catch (_) {}
})();
