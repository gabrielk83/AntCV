/* antcv-orphan-measure-bind.js — ORPHAN-MEASURE-BIND-001 (owner 2026-07-02)
 * ============================================================================
 * L1 (measure) + L2 (deterministic multi-word NBSP bind) of the orphan architecture
 * (docs/qa/ORPHAN_ARCHITECTURE_2026-07-02.md). Orphan = a wrapped bullet / Results line
 * whose LAST rendered line holds only a short runt of words.
 *
 * WHY: the PDF export orphans (CloudConvert ignores the preview's text-wrap:pretty). The
 * old defense (antcv-docx-client bindOrphan) binds only the SINGLE last word, so a 2-3 word
 * runt survives — worst in the long Results line. This sidecar MEASURES the real wrapped
 * lines in the preview via Range.getClientRects() (one rect per line), and when the last
 * line is a runt, binds the MINIMAL number of trailing words with U+00A0 so the runt clears
 * — computed on an off-screen clone so we never bind so much that a NEW line appears. The
 * NBSP is written into the STORED text (bullets -> sections; Results -> antcv:resultsOverride),
 * so the docx export inherits the fix. NBSP only touches TRAILING spaces, so a tense-
 * transformed leading verb is never disturbed.
 *
 * Deterministic, no per-generation LLM cost. Idempotent (a bound trailing region is skipped).
 * Scoped to Results + experience bullets. Kill: localStorage['antcv:disable-orphan-bind']='1'.
 * Preview line-breaks approximate the DOCX (same Calibri, scaled page) — verify on a real PDF.
 */
(function () {
  'use strict';
  var VERSION = '1.51.46-orphan-bind-l3';
  if (window.__antcvOrphanBind === VERSION) return;
  window.__antcvOrphanBind = VERSION;

  var NBSP = String.fromCharCode(160);
  var RUNT_FRAC = 0.32;   // last line narrower than 32% of the widest line = runt
  var MAX_BIND = 4;       // never bind more than the last 4 word-gaps
  var MIN_LINE_PX = 8;    // ignore sub-pixel/empty rects

  function disabled() { try { var v = localStorage.getItem('antcv:disable-orphan-bind'); return v === '1' || v === 'true'; } catch (_) { return false; } }

  // ── measurement ───────────────────────────────────────────────────────────
  // Group getClientRects() (which can emit several rects per line for inline
  // fragments) into one width per VISUAL line, keyed by top position.
  function lineWidths(el) {
    try {
      var r = document.createRange();
      r.selectNodeContents(el);
      var rects = r.getClientRects();
      var lines = [], cur = null;
      for (var i = 0; i < rects.length; i++) {
        var rc = rects[i];
        if (!rc || (rc.width < MIN_LINE_PX && rc.height < 1)) continue;
        if (cur && Math.abs(rc.top - cur.top) < 3) { cur.left = Math.min(cur.left, rc.left); cur.right = Math.max(cur.right, rc.right); }
        else { cur = { top: rc.top, left: rc.left, right: rc.right }; lines.push(cur); }
      }
      return lines.map(function (l) { return l.right - l.left; });
    } catch (_) { return []; }
  }
  function isRunt(widths) {
    if (!widths || widths.length < 2) return false;
    var max = 0; for (var i = 0; i < widths.length; i++) if (widths[i] > max) max = widths[i];
    var last = widths[widths.length - 1];
    return max > 0 && last > 0 && (last / max) < RUNT_FRAC;
  }

  // ── binding (pure) ──────────────────────────────────────────────────────────
  function spaceCount(text) { return (String(text == null ? '' : text).match(/ /g) || []).length; }
  // Replace the last n single-space gaps (skipping trailing whitespace) with NBSP.
  function bindLast(text, n) {
    var s = String(text == null ? '' : text);
    var right = s.replace(/\s+$/, ''); var trail = s.slice(right.length);
    var arr = right.split(''); var c = 0;
    for (var i = arr.length - 1; i >= 0 && c < n; i--) { if (arr[i] === ' ') { arr[i] = NBSP; c++; } }
    return arr.join('') + trail;
  }
  // Already bound in its trailing region? (idempotency — the last gap is NBSP)
  function alreadyBound(text) { return String(text == null ? '' : text).indexOf(NBSP) !== -1; }

  // ── clone measurement: pick the minimal bind that clears the runt ───────────
  // Returns the number of trailing gaps to bind (1..MAX_BIND), or 0 if none clears
  // the runt without adding a line. When outFlags is passed, outFlags.wasRunt reports
  // whether the ORIGINAL text was a genuine runt (regardless of whether L2 could fix
  // it) — the caller uses this to route unfixable residue to L3 without re-measuring.
  function chooseBindCount(el, displayText, prefix, outFlags) {
    var clone = null;
    try {
      var w = el.getBoundingClientRect().width;
      if (!(w > 0)) return 0;
      clone = el.cloneNode(false);                     // same tag + inline style, no children
      clone.style.position = 'absolute'; clone.style.visibility = 'hidden';
      clone.style.left = '-99999px'; clone.style.top = '0';
      clone.style.width = w + 'px'; clone.style.display = 'block'; clone.style.whiteSpace = 'normal';
      el.parentNode.appendChild(clone);
      clone.textContent = prefix + displayText;
      var base = lineWidths(clone);
      var runt = isRunt(base);
      if (outFlags) outFlags.wasRunt = runt;
      if (!runt) return 0;
      var maxN = Math.min(MAX_BIND, spaceCount(displayText));
      for (var n = 1; n <= maxN; n++) {
        clone.textContent = prefix + bindLast(displayText, n);
        var l = lineWidths(clone);
        if (l.length > base.length) break;             // binding started overflowing — stop
        if (!isRunt(l)) return n;                       // runt cleared
      }
      return 0;
    } catch (_) { return 0; }
    finally { if (clone) { try { clone.parentNode.removeChild(clone); } catch (_) {} } }
  }

  // ── L3: escalate UNFIXABLE residue to the existing "Fix Orphans" LLM pass ──────
  // L1/L2 above are deterministic and free. When a genuine runt survives L2 (binding
  // would overflow to a new line — a real multi-word orphan the NBSP trick can't
  // solve), route it to the app's OWN "Fix Orphans" feature automatically, no button
  // press. That feature already does LLM routing/credit/provider-demotion (the ee()
  // dispatcher) inside a React-component-local closure that a plain sidecar cannot
  // call directly — so instead of touching the fragile minified app.js/app.src.js
  // (an earlier attempt to wire a CustomEvent bridge there corrupted the file's giant
  // comma-expression and was reverted), this CLICKS THE REAL BUTTON already wired to
  // it (title "Run orphan-cleanup across both sidebar and main columns..."). Zero
  // app.js edits, zero risk to that file. Dedup by a text-hash signature (persisted,
  // so a reload doesn't re-fire on the same unresolved text) + a cooldown between
  // fires. Kill: localStorage['antcv:disable-orphan-l3']='1'.
  var L3_KEY = 'antcv:orphanL3Attempted';
  var L3_COOLDOWN_MS = 15000;
  var L3_BTN_TITLE = 'Run orphan-cleanup across both sidebar and main columns';
  function l3Disabled() { try { var v = localStorage.getItem('antcv:disable-orphan-l3'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return h; }
  function readAttempted() { try { return JSON.parse(localStorage.getItem(L3_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function writeAttempted(m) { try { localStorage.setItem(L3_KEY, JSON.stringify(m)); } catch (_) {} }
  // Swallow ONLY the button's own "no orphans found" alert (a benign disagreement
  // between its detector and ours) for a bounded window; every other alert() passes
  // through untouched. Always self-restores.
  function suppressNoOrphansAlert(ms) {
    try {
      if (window.__antcvOrigAlert) return;
      window.__antcvOrigAlert = window.alert;
      window.alert = function (msg) {
        if (typeof msg === 'string' && /no orphan lines detected/i.test(msg)) return;
        return window.__antcvOrigAlert.apply(window, arguments);
      };
      setTimeout(function () {
        try { if (window.__antcvOrigAlert) { window.alert = window.__antcvOrigAlert; delete window.__antcvOrigAlert; } } catch (_) {}
      }, ms || 90000);
    } catch (_) {}
  }
  function maybeEscalateToL3(residue) {
    if (l3Disabled() || !residue.length) return;
    try {
      var now = Date.now ? Date.now() : new Date().getTime();
      var last = Number(window.__antcvOrphanL3LastFire || 0);
      if (now - last < L3_COOLDOWN_MS) return;
      var attempted = readAttempted();
      var fresh = residue.filter(function (r) { return attempted[r.key] !== r.sig; });
      if (!fresh.length) return;
      var btn = document.querySelector('button[title^="' + L3_BTN_TITLE + '"]');
      if (!btn || btn.disabled) return;
      fresh.forEach(function (r) { attempted[r.key] = r.sig; });
      writeAttempted(attempted);
      window.__antcvOrphanL3LastFire = now;
      suppressNoOrphansAlert(90000);
      btn.click();
    } catch (_) { /* self-disable */ }
  }

  // ── storage write-back ──────────────────────────────────────────────────────
  function readSections() { try { var v = JSON.parse(localStorage.getItem('sections') || '{}'); return (v && typeof v === 'object') ? v : null; } catch (_) { return null; } }
  // Navigate a "roles.2.bullets.1" path inside a section object and bind the leaf's
  // trailing n gaps in the STORED text (leading verb / tense untouched).
  function bindBulletInSections(sid, pathParts, n) {
    var secs = readSections(); if (!secs || !Array.isArray(secs.cv)) return false;
    var sec = null; for (var i = 0; i < secs.cv.length; i++) { if (secs.cv[i] && secs.cv[i].id === sid) { sec = secs.cv[i]; break; } }
    if (!sec) return false;
    var node = sec;
    for (var j = 0; j < pathParts.length - 1; j++) { var k = pathParts[j]; var idx = /^\d+$/.test(k) ? parseInt(k, 10) : k; node = node && node[idx]; if (node == null) return false; }
    var lk = pathParts[pathParts.length - 1]; var li = /^\d+$/.test(lk) ? parseInt(lk, 10) : lk;
    if (!node || typeof node[li] !== 'string') return false;
    if (alreadyBound(node[li])) return false;
    var bound = bindLast(node[li], n); if (bound === node[li]) return false;
    node[li] = bound; localStorage.setItem('sections', JSON.stringify(secs)); return true;
  }
  function bindResultsOverride(rKey, displayText, n) {
    var map; try { map = JSON.parse(localStorage.getItem('antcv:resultsOverride') || '{}') || {}; } catch (_) { map = {}; }
    if (typeof map[rKey] === 'string' && alreadyBound(map[rKey])) return false;
    var bound = bindLast(displayText, n); if (map[rKey] === bound) return false;
    map[rKey] = bound; localStorage.setItem('antcv:resultsOverride', JSON.stringify(map)); return true;
  }

  // ── sweep ───────────────────────────────────────────────────────────────────
  function textOf(el) { return String(el.textContent == null ? '' : el.textContent); }

  function run() {
    if (disabled()) return;
    try {
      var changed = false;
      var residue = [];   // genuine runts L2 could NOT clear -> candidates for L3

      // Experience bullets: the wrapping [data-antcv-row-path] div carries the justify +
      // width; its inner editable holds the text. Measure the div (visual truth incl. the
      // bullet marker), bind the STORED bullet text.
      var bullets = document.querySelectorAll('[data-antcv-row-path]');
      for (var b = 0; b < bullets.length; b++) {
        var bd = bullets[b];
        var rp = bd.getAttribute('data-antcv-row-path') || '';
        if (!/^roles\.\d+\.bullets\.\d+$/.test(rp)) continue;
        var ed = bd.querySelector('[data-antcv-editable-text]') || bd.querySelector('[data-edit-path]');
        var txt = ed ? textOf(ed) : textOf(bd);
        if (!txt || alreadyBound(txt) || spaceCount(txt) < 1) continue;
        var prefix = ed ? textOf(bd).slice(0, Math.max(0, textOf(bd).length - txt.length)) : '';
        var flags = {};
        var n = chooseBindCount(bd, txt, prefix, flags);
        if (n > 0) {
          var sid = (bd.closest && bd.closest('[data-sid]') && bd.closest('[data-sid]').getAttribute('data-sid')) || 'experience';
          if (bindBulletInSections(sid, rp.split('.'), n)) changed = true;
        } else if (flags.wasRunt) {
          residue.push({ key: 'bullet|' + rp, sig: hash(txt) });
        }
      }

      // Results: an editable span with data-antcv-results-edit=<rKey>. Bind the displayed
      // text and store as the per-role override (which the preview + export already prefer).
      var results = document.querySelectorAll('[data-antcv-results-edit]');
      for (var r2 = 0; r2 < results.length; r2++) {
        var rs = results[r2];
        var rKey = rs.getAttribute('data-antcv-results-edit') || '';
        var rtxt = textOf(rs).replace(/^\s*Results:\s*/i, '');   // the label is a sibling span, but guard
        if (!rKey || !rtxt || alreadyBound(rtxt) || spaceCount(rtxt) < 1) continue;
        var rflags = {};
        var rn = chooseBindCount(rs, rtxt, '', rflags);
        if (rn > 0 && bindResultsOverride(rKey, rtxt, rn)) changed = true;
        else if (rflags.wasRunt) residue.push({ key: 'results|' + rKey, sig: hash(rtxt) });
      }

      if (changed) { try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'orphan-measure-bind' } })); } catch (_) {} }
      if (residue.length) maybeEscalateToL3(residue);
    } catch (_) { /* self-disable */ }
  }

  var __t = null;
  function schedule() { if (__t) return; __t = setTimeout(function () { __t = null; run(); }, 400); }
  window.addEventListener('antcv:sections-updated', schedule);
  [1200, 3000, 6000].forEach(function (ms) { setTimeout(run, ms); });
  window.AntcvOrphanBind = { version: VERSION, run: run, _bindLast: bindLast, _isRunt: isRunt, _spaceCount: spaceCount, _alreadyBound: alreadyBound, _bindBulletInSections: bindBulletInSections, _bindResultsOverride: bindResultsOverride, _hash: hash, _maybeEscalateToL3: maybeEscalateToL3, _readAttempted: readAttempted, _l3Disabled: l3Disabled, _suppressNoOrphansAlert: suppressNoOrphansAlert };
})();
