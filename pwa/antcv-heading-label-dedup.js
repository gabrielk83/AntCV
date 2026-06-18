/* antcv-heading-label-dedup.js — WHO-I-AM-LABEL-DUP-001 (owner 2026-06-18)
 * ============================================================================
 * Owner: "WHO I AM and WHY YOUR COMPANY are not supposed to be duplicated. It
 * is NOT like working style. Keep one headline ABOVE, not one above AND one in
 * the paragraph." These are `type:"text"` sections that render their `title` as
 * a heading; generation also prefixes the paragraph with the same label
 * ("WHO I AM: I am an IT professional…") -> the label shows twice.
 *
 * Fix: for every `type:"text"` section (NOT `text_inline` — that IS the
 * working-style inline-label shape the owner exempted), strip a leading
 * "<TITLE>:" from `content` when it matches the section's OWN title. Matching
 * the section title makes it language-agnostic (DA "HVEM ER JEG:", ES
 * "QUIÉN SOY:", …) and self-scoping (no hard-coded label list). Persistent +
 * restore-proof: it rewrites the stored `sections` blob, so preview AND the
 * worker export both read the clean paragraph, and a fresh generation that
 * re-adds the prefix is re-stripped on the next tick.
 *
 * Sidecar-only — no app.js change. Loop-safe: a same-blob bail + write-only-on-
 * change + our own tagged event being ignored mean steady state is a no-op.
 * Disable: localStorage['antcv:disable-heading-label-dedup'] = '1'.
 */
(function () {
  'use strict';
  if (window.__antcvHeadingLabelDedup) return;
  window.__antcvHeadingLabelDedup = '1.50.676';

  var SRC = 'heading-label-dedup';
  function disabled() { try { var v = localStorage.getItem('antcv:disable-heading-label-dedup'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  function stripLabel(sec) {
    // ONLY heading-bearing text sections. text_inline (working style) keeps its
    // inline label by design — never strip it.
    if (!sec || sec.type !== 'text') return false;
    var title = String(sec.title || '').trim();
    if (!title) return false;
    var content = sec.content;
    if (typeof content !== 'string' || !content) return false;
    // Optional leading markdown (** ), the title (case-insensitive), optional
    // closing markdown, then a colon and any following space.
    var esc = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // HTML-BOLD-LABEL-002 (owner 2026-06-18): generation also wraps the duplicate
    // label in HTML bold, e.g. `<b style="color:rgb(0,116,110)">WHO I AM:</b> …`,
    // which the markdown-only regex missed. Try, in order:
    //  (a) markdown / plain     "LABEL:", "**LABEL:**", "**LABEL**:"
    //  (b) HTML bold, colon IN  "<b ...>LABEL:</b>" / "<strong ...>LABEL:</strong>"
    //  (c) HTML bold, colon OUT "<b ...>LABEL</b>:"
    var res = [
      new RegExp('^\\s*\\*{0,2}\\s*' + esc + '\\s*\\*{0,2}\\s*:\\s*\\*{0,2}\\s*', 'i'),
      new RegExp('^\\s*<(?:b|strong)\\b[^>]*>\\s*' + esc + '\\s*:\\s*<\\/(?:b|strong)>\\s*', 'i'),
      new RegExp('^\\s*<(?:b|strong)\\b[^>]*>\\s*' + esc + '\\s*<\\/(?:b|strong)>\\s*:\\s*', 'i')
    ];
    for (var k = 0; k < res.length; k++) {
      if (res[k].test(content)) {
        var next = content.replace(res[k], '');
        // Don't blank the paragraph — only strip when real prose follows.
        if (next.trim()) { sec.content = next; return true; }
        break;
      }
    }
    return false;
  }

  var lastRaw = null;
  function apply() {
    if (disabled()) return;
    try { var __ae = document.activeElement; if (__ae && (__ae.isContentEditable || /^(?:input|textarea|select)$/i.test(__ae.tagName || ""))) return; } catch (_) {}
    var raw; try { raw = localStorage.getItem('sections'); } catch (_) { return; }
    if (!raw || raw === lastRaw) return;          // same-blob bail
    var b; try { b = JSON.parse(raw); } catch (_) { lastRaw = raw; return; }
    var changed = false;
    ['cv', 'cl'].forEach(function (doc) {
      var list = b[doc];
      if (!Array.isArray(list)) return;
      list.forEach(function (sec) { if (stripLabel(sec)) changed = true; });
    });
    if (!changed) { lastRaw = raw; return; }
    var out;
    try { out = JSON.stringify(b); localStorage.setItem('sections', out); } catch (_) { return; }
    lastRaw = out;
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
    try { console.info('[heading-label-dedup] stripped duplicated section-label prefix from text section(s)'); } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; (window.requestAnimationFrame || setTimeout)(function () { pending = false; try { apply(); } catch (_) {} }); }

  [400, 1200, 2600].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 4000);

  window.AntcvHeadingLabelDedup = { version: '1.50.676', _apply: apply, _strip: stripLabel };
})();
