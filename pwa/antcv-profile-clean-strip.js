/* antcv-profile-clean-strip.js — PROFILE-NO-DISABILITY-001 / PROFILE-NO-FILLER-001 strip (owner 2026-06-23)
 * ============================================================================
 * Owner QA (sharp): the PROFILE leaked an UNSOLICITED accessibility disclosure
 * and banal filler, e.g.:
 *   "Has worked with people from many backgrounds; hearing impaired, which has
 *    not limited his career."
 * A disability / hearing impairment / accessibility need NEVER belongs in the
 * profile — that lives ONLY in the Accessibility row or the cover letter. Vague
 * generic claims ("worked with people from many backgrounds", "team player",
 * "works well with others") are also banned.
 *
 * The prompt fix (PROFILE-NO-DISABILITY-001 / PROFILE-NO-FILLER-001, 1.50.830)
 * is GENERATION-ONLY: it does not strip prose already stored from earlier
 * generations, and the model can still slip. This restore-proof SIDECAR strips
 * the offending content from the stored PROFILE section, mirroring the proven
 * antcv-accessibility-comment-strip.js pattern.
 *
 * Profile prose shape in localStorage['sections'] (cv[]):
 *   text form:        { id:'profile', type:'text',       content:'<prose>' }
 *   rich_block form:  { id:'profile', type:'rich_block', items:[{b:'',t:'<prose>'}] }
 *   (antcv-text-sections-to-rich-block-759.js may have converted text→rich_block;
 *    this sidecar handles BOTH the `content` string and `items[].t` strings.)
 *
 * Behaviour (sentence-level, never blanks the field):
 *   - DISABILITY / "has not limited ... career" sentence: try to keep a clean
 *     leading clause (head before the offending clause boundary) if substantial;
 *     otherwise drop the whole sentence.
 *   - Pure generic-filler sentence: drop it. Filler phrase embedded in an
 *     otherwise-real sentence: remove just the phrase.
 *   - If nothing meaningful would remain, BAIL (keep the original) — never blank.
 *
 * CV ONLY — the accessibility comment is allowed in the cover letter, and the
 * CL profile/intro is a different register. Sidecar-only — no app.js change.
 * Loop-safe: same-blob bail + write-only-on-change + our own tagged event being
 * ignored mean steady state is a no-op.
 * Disable: localStorage['antcv:disable-profile-clean-strip'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvProfileCleanStrip) return;
  window.__antcvProfileCleanStrip = '1.50.833';

  var SRC = 'profile-clean-strip';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-profile-clean-strip'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // A disability / accessibility need named in the prose.
  var DISABILITY = /\b(?:hearing[\s-]?impair\w*|deaf\b|hard\s+of\s+hearing|disab\w+|accessibilit\w+|accommodation\w*|sign\s+language|assistive\s+\w+|impairment)\b/i;
  // The 3rd-person "has not limited his/their/her career" editorial framing.
  var NOTLIMIT = /\b(?:it|this|that|which|he|she|they|his|her|their|the)\b[^.;]*?\b(?:has|have|had|did|does|is|was|having)\b[^.;]*?\b(?:not|n'?t|never)\b[^.;]*?\blimit\w*\b[^.;]*?\bcareer\b/i;
  // Generic filler phrases (PROFILE-NO-FILLER-001).
  var FILLER_PHRASE = /\b(?:(?:has\s+|have\s+)?worked\s+with\s+(?:a\s+wide\s+range\s+of\s+|a\s+diverse\s+group\s+of\s+|many\s+|all\s+)?people\s+from\s+(?:many|diverse|all|different|various|varied)\s+(?:backgrounds|walks(?:\s+of\s+life)?)|(?:a\s+|good\s+|great\s+|strong\s+)?team\s+player|works\s+well\s+with\s+others|people'?s\s+person|works\s+well\s+in\s+(?:a\s+)?teams?)\b/i;

  // Count words in a string (rough).
  function words(s) { var m = String(s || '').trim().match(/\S+/g); return m ? m.length : 0; }

  // Split prose into sentences, KEEPING the terminator with each sentence.
  // Handles ". ", "! ", "? " and trailing fragment without a terminator.
  function splitSentences(text) {
    var parts = [];
    var re = /[^.!?]+[.!?]+(?:["')\]]+)?\s*|[^.!?]+$/g;
    var m;
    while ((m = re.exec(text)) !== null) {
      if (m[0] && m[0].trim()) parts.push(m[0]);
    }
    return parts.length ? parts : [text];
  }

  // Try to salvage the clean head of a sentence before the first offending
  // clause boundary; return the head (no trailing separator) or null.
  function salvageHead(sentence) {
    // Find first index where a banned token starts.
    var idx = -1;
    [DISABILITY, NOTLIMIT, FILLER_PHRASE].forEach(function (re) {
      var mm = re.exec(sentence);
      if (mm && (idx < 0 || mm.index < idx)) idx = mm.index;
    });
    if (idx <= 0) return null;
    // Walk back to the nearest clause boundary (; , — – -) before the banned token.
    var head = sentence.slice(0, idx);
    var cut = head.search(/[;,—–]\s*[^;,—–]*$/);
    // If there's a clause boundary, keep everything up to (not incl.) it.
    if (cut >= 0) head = head.slice(0, cut);
    head = head.replace(/[\s;,.—–\-]+$/, '').trim();
    if (!head || DISABILITY.test(head) || NOTLIMIT.test(head) || FILLER_PHRASE.test(head)) return null;
    if (words(head) < 3) return null;     // too thin to stand as a sentence
    return head + '.';
  }

  // Clean one prose string. Returns cleaned string, or null if no change / unsafe.
  function cleanProse(text) {
    if (typeof text !== 'string' || !text.trim()) return null;
    var hasDis = DISABILITY.test(text) || NOTLIMIT.test(text);
    var hasFil = FILLER_PHRASE.test(text);
    if (!hasDis && !hasFil) return null;        // fast bail

    var sentences = splitSentences(text);
    var kept = [];
    for (var i = 0; i < sentences.length; i++) {
      var raw = sentences[i];
      var s = raw.trim();
      var isDis = DISABILITY.test(s) || NOTLIMIT.test(s);
      var hasF = FILLER_PHRASE.test(s);

      if (isDis) {
        var head = salvageHead(s);
        if (head) kept.push(head);          // keep the clean lead, drop the rest
        // else: drop the whole sentence
        continue;
      }
      if (hasF) {
        // Remove the filler phrase; if a real sentence remains, keep it.
        var stripped = s.replace(FILLER_PHRASE, '').replace(/\s{2,}/g, ' ')
          .replace(/\s+([.;,])/g, '$1')
          .replace(/^[\s;,.\-—–]+/, '')
          .replace(/[\s;,\-—–]+$/, '')
          .trim();
        // Drop leftover dangling connectors at the start (e.g. "and", "who").
        stripped = stripped.replace(/^(?:and|who|that|which|he|she|they|;|,)\s+/i, '').trim();
        if (stripped && words(stripped) >= 3 && !FILLER_PHRASE.test(stripped)) {
          if (!/[.!?]$/.test(stripped)) stripped += '.';
          // Capitalise first letter.
          stripped = stripped.charAt(0).toUpperCase() + stripped.slice(1);
          kept.push(stripped);
        }
        // else: pure-filler sentence — drop it
        continue;
      }
      kept.push(s);
    }

    var out = kept.join(' ').replace(/\s{2,}/g, ' ').trim();
    if (!out) return null;                  // never blank — bail
    if (out === text.trim()) return null;   // no effective change
    return out;
  }

  function isProfileSection(sec) {
    return sec && (sec.id === 'profile' || /^\s*PROFILE\b/i.test(String(sec.title || '')));
  }

  // Returns true if it changed the section's prose.
  function cleanSection(sec) {
    if (!isProfileSection(sec)) return false;
    var changed = false;
    if (typeof sec.content === 'string') {
      var c = cleanProse(sec.content);
      if (c != null) { sec.content = c; changed = true; }
    }
    if (Array.isArray(sec.items)) {
      for (var i = 0; i < sec.items.length; i++) {
        var it = sec.items[i];
        if (it && typeof it === 'object' && typeof it.t === 'string') {
          var t = cleanProse(it.t);
          if (t != null) { it.t = t; changed = true; }
        }
      }
    }
    return changed;
  }

  var lastRaw = null;
  function apply() {
    if (disabled()) return;
    try { var __ae = document.activeElement; if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ""))) return; } catch (_) {}
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;          // same-blob bail
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    // CV ONLY — the accessibility comment / register is allowed in the CL.
    var list = b.cv;
    if (Array.isArray(list)) {
      list.forEach(function (sec) { if (cleanSection(sec)) changed = true; });
    }
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[profile-clean-strip] removed disability/filler content from CV profile'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [500, 1400, 2800].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvProfileCleanStrip = { version: '1.50.833', _apply: apply, _clean: cleanProse, _cleanSection: cleanSection };
})();
