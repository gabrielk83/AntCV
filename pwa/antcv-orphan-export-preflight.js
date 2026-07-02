/* antcv-orphan-export-preflight.js — ORPHANS v2 (owner 2026-07-03)
 * ============================================================================
 * EXPORT-METRIC-MEASURE-001 + EXPORT-PREFLIGHT-ORPHANS-001
 * (docs/qa/ORPHAN_ARCHITECTURE_2026-07-02.md §7–9).
 *
 * WHY v1 fell short: the shipped orphan sidecar (antcv-orphan-measure-bind.js)
 * measures line breaks in the PREVIEW; CloudConvert typesets the DOCX column with
 * different width + font metrics, so 13 multi-word runts survived export 16 even
 * though the preview looked clean. v2 measures the EXACT strings the worker will
 * typeset (the built payload, after applyOutcomesMode/sanitize/normalize/NBSP) in
 * an offscreen block styled with the EXPORT font family/size and the EXPORT
 * main-column width derived from the SAME payload fields the worker reads
 * (sidebar_ratio, style.mainEdgeIndent/seamGap/bulletIndent, font_sizes, package
 * bodyFont). Detection therefore tracks the PDF ~1:1 instead of the preview.
 *
 * WHEN: awaited INSIDE exportDocxViaWorker/exportPdfViaWorker, after buildPayload
 * and before the POST — so the fix always lands in the payload (no async-tick
 * race; export 16 only ever got 4 lines into the old L3 because the export left
 * before the tick fired). The caller wraps the call in a hard 12s Promise.race +
 * try/catch: the export can NEVER hang or fail because of the preflight.
 *
 * PIPELINE per export: collect targets (experience bullets + per-role Results +
 * PROFILE prose, main column only) → measure (RUNT_FRAC 0.40 of the column) →
 * L2: minimal trailing-NBSP bind that clears the runt without adding a line
 * (content-preserving; works on multi-word runts by making the last line LONGER)
 * → residue: ONE batched LLM re-tighten (same proxy route as the shipped L3,
 * claude-sonnet-5) gated by safeShorten (numbers/acronyms verbatim, no em/en
 * dashes) AND a RE-MEASURE (reject any rewrite that still runts or gains a line;
 * a rewrite that runts but binds clean is accepted bound). All payload writes are
 * whole-string replacements against the enumerated payload arrays; STORED-section
 * mirrors (rewrites only — NBSP binds are invisible in the preview) go through
 * the shipped ORPHAN-WRITE-VERIFY-001 verifier (window.AntcvOrphanBind), which
 * text-verifies every target and aborts on ambiguity — never index-trusted.
 *
 * Kill: localStorage['antcv:disable-orphan-preflight']='1'.
 * Test hooks: run(payload, { measureLines, fetchImpl, storage }) — the unit tests
 * inject a deterministic measurer + fetch; the DOM measurer is only built lazily.
 */
(function () {
  'use strict';
  var VERSION = '1.51.57-orphan-export-preflight';
  if (window.__antcvOrphanExportPreflight === VERSION) return;
  window.__antcvOrphanExportPreflight = VERSION;

  var NBSP = String.fromCharCode(160);
  var RUNT_FRAC = 0.40;      // §9: catches 3-word runts the preview pass (0.32) misses
  var MAX_BIND = 6;          // multi-word runts need more trailing glue than the preview pass
  var MIN_LINE_PX = 8;
  var PAGE_W = 11906;        // A4 twips — worker src/generate.js
  var TWIPS_PER_PX = 15;     // 96dpi
  var L3_TIMEOUT_MS = 8500;  // inside the caller's hard 12s envelope
  var L3_KEY = 'antcv:orphanPreflightAttempted';
  var L3_MAX_PER_LINE = 2;

  function disabled(storage) {
    try { var v = (storage || localStorage).getItem('antcv:disable-orphan-preflight'); return v === '1' || v === 'true'; } catch (_) { return false; }
  }

  // ── export metrics from the payload (the SAME fields the worker reads) ──────
  // Package bodyFont map mirrors workers/docx-worker src/palette.js PACKAGES.
  var PKG_BODY_FONT = { 'warm-terracotta': 'Georgia' };
  function pxTok(v) { var n = Number(v); return (isFinite(n) && n >= 0 && n <= 60) ? n : undefined; }
  function metricsFromPayload(payload) {
    var style = (payload && payload.style) || {};
    var fs = (payload && payload.font_sizes) || {};
    var ratio = Number(payload && payload.sidebar_ratio);
    if (!isFinite(ratio)) ratio = 0.33;
    ratio = Math.max(0.2, Math.min(0.55, ratio));                    // worker clamp
    var sidebarW = Math.round(PAGE_W * ratio);
    var mainW = PAGE_W - sidebarW;
    var mePx = pxTok(style.mainEdgeIndent);
    var mainEdge = mePx !== undefined ? Math.round(mePx * 15) : 150; // worker default
    var seamPx = pxTok(style.seamGap);
    var seam = seamPx !== undefined ? Math.round(seamPx * 15) : 0;
    var biPx = pxTok(style.bulletIndent);
    var bIndent = biPx !== undefined ? Math.round(biPx * 15) : 210;  // worker default
    var cellW = mainW - 2 * mainEdge - seam;                         // makeMainCell margins
    var family = (typeof style.mainBodyFont === 'string' && /^[a-z ]{3,}$/i.test(style.mainBodyFont))
      ? style.mainBodyFont
      : (payload && payload.legacy_ats_tier === true) ? 'Calibri'
        : (PKG_BODY_FONT[String(payload && payload.package || '').toLowerCase()] || 'Calibri');
    var bulletPt = Number(fs.bulletContent); if (!isFinite(bulletPt) || bulletPt <= 0) bulletPt = 10.5;
    var bodyPt = Number(fs.mainBody); if (!isFinite(bodyPt) || bodyPt <= 0) bodyPt = 10.5;
    return {
      family: family,
      cellWpx: cellW / TWIPS_PER_PX,
      bulletWpx: (cellW - bIndent) / TWIPS_PER_PX,   // numbering indent: text column for bullet body
      bulletPx: bulletPt * 96 / 72,
      bodyPx: bodyPt * 96 / 72,
    };
  }

  // ── raw payload string → display HTML (mirrors worker inlineRuns/styledRuns) ─
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function toDisplayHtml(raw) {
    var s = String(raw == null ? '' : raw);
    s = s.replace(/\[([^\]]+)\]\(\s*(?:https?:\/\/|mailto:)[^)\s]+\s*\)/g, '$1');   // links render as their text
    s = s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, NBSP); // decodeBasicEntities
    var re = /<\s*(\/?)\s*(b|strong|i|em)\b[^>]*>/gi, out = '', cur = 0, m;
    while ((m = re.exec(s)) !== null) {
      out += esc(s.slice(cur, m.index));
      var tag = (m[2].toLowerCase() === 'b' || m[2].toLowerCase() === 'strong') ? 'b' : 'i';
      out += '<' + (m[1] ? '/' : '') + tag + '>';
      cur = m.index + m[0].length;
    }
    out += esc(s.slice(cur));
    return out;
  }

  // ── NBSP binding on the RAW string (tag-aware: never bind inside <...>) ─────
  function bindableSpaces(s) {
    var idx = [], inTag = false;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '<') inTag = true;
      else if (c === '>') inTag = false;
      else if (c === ' ' && !inTag) idx.push(i);
    }
    return idx;
  }
  function bindLastN(s, n) {
    var right = String(s).replace(/\s+$/, ''); var trail = String(s).slice(right.length);
    var arr = right.split('');
    var idx = bindableSpaces(right).slice(-n);
    for (var i = 0; i < idx.length; i++) arr[idx[i]] = NBSP;
    return arr.join('') + trail;
  }

  // ── DOM measurer (export metrics). Built lazily so vm tests never touch it. ──
  // measureLines(spec) -> [lineWidthPx, ...]; spec = { html, widthPx, fontPx,
  // family, align }. One rect per rendered line via Range.getClientRects()
  // (grouped by top — inline fragments like <b> runs emit several rects/line).
  var __domBox = null;
  function domMeasureLines(spec) {
    try {
      if (!__domBox || !__domBox.isConnected) {
        __domBox = document.createElement('div');
        __domBox.setAttribute('data-antcv-orphan-preflight-measure', '1');
        __domBox.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden;pointer-events:none;contain:layout style;';
        document.body.appendChild(__domBox);
      }
      var el = document.createElement('div');
      el.style.cssText = 'display:block;white-space:normal;letter-spacing:normal;word-spacing:normal;hyphens:none;text-wrap:initial;line-height:1.3;';
      el.style.width = spec.widthPx + 'px';
      el.style.fontFamily = spec.family + ', Carlito, sans-serif';
      el.style.fontSize = spec.fontPx + 'px';
      el.style.textAlign = spec.align || 'justify';
      el.innerHTML = spec.html;
      __domBox.appendChild(el);
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
      __domBox.removeChild(el);
      return lines.map(function (l) { return l.right - l.left; });
    } catch (_) { return []; }
  }

  function isRuntLines(widths, colWpx) {
    if (!widths || widths.length < 2) return false;
    var last = widths[widths.length - 1];
    return last > 0 && colWpx > 0 && (last / colWpx) < RUNT_FRAC;
  }

  // ── L3 gates ────────────────────────────────────────────────────────────────
  // safeShorten mirrors the shipped gate (numbers + acronyms verbatim) and adds
  // the owner's banned-separator rule (no em/en dashes ever enter stored text).
  function safeShorten(orig, short) {
    orig = String(orig || ''); short = String(short || '').trim();
    if (!short || short.length >= orig.length || short.length < orig.length * 0.45) return false;
    if (/[—–]/.test(short) && !/[—–]/.test(orig)) return false;
    var nums = orig.match(/\d[\d.,%/-]*/g) || [];
    for (var i = 0; i < nums.length; i++) { if (short.indexOf(nums[i]) === -1) return false; }
    var acr = orig.match(/\b[A-Z][A-Z0-9]{1,}\b/g) || [];
    for (var j = 0; j < acr.length; j++) { if (short.indexOf(acr[j]) === -1) return false; }
    return true;
  }
  function readAttempted(storage) { try { return JSON.parse((storage || localStorage).getItem(L3_KEY) || '{}') || {}; } catch (_) { return {}; } }
  function writeAttempted(storage, m) { try { (storage || localStorage).setItem(L3_KEY, JSON.stringify(m)); } catch (_) {} }
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; } return h; }
  function proxyBase(storage) {
    function read(k) { var v = ''; try { v = (storage || localStorage).getItem(k) || ''; } catch (_) {} try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {} return String(v || '').replace(/\/+$/, ''); }
    var b = read('proxyUrl') || read('relayUrl');
    if (!b && typeof window.ANTCV_RELAY_URL === 'string') b = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
    return b;
  }
  var L3_SYSTEM = 'You are a precise CV line editor. Each input string is one CV line (an experience bullet, a Results line, or a profile sentence group) that currently wraps in the EXPORTED PDF with a SHORT dangling last line (an orphan of 1-4 words). Rewrite EACH to be a few words SHORTER — shorter synonyms, drop filler ("the", "a", "that", "in order to", "various", redundant qualifiers) — so it fills complete typeset lines with NO short dangling last line, keeping the SAME meaning and the SAME leading verb form. PRESERVE VERBATIM every number, %, year, patent/standard code, tool name, proper noun, acronym, and any <b>/<i> tags. NEVER use an em dash or en dash. Do NOT add facts, do NOT lengthen, do NOT merge lines. Return ONLY a JSON array of strings, the SAME length and order as the input.';

  // ── target collection from the BUILT payload ────────────────────────────────
  // Each target reads/writes payload.sections in place. Profile is processed per
  // paragraph (the worker splits content on blank lines — renderText).
  function collectTargets(payload, met) {
    var out = [];
    var secs = (payload && payload.sections) || [];
    for (var si = 0; si < secs.length; si++) {
      (function (s) {
        if (!s || s.loc === 'sidebar') return;
        if (s.type === 'experience' && Array.isArray(s.roles)) {
          for (var ri = 0; ri < s.roles.length; ri++) {
            (function (role, ri2) {
              if (!role) return;
              if (Array.isArray(role.bullets)) {
                for (var bi = 0; bi < role.bullets.length; bi++) {
                  (function (bi2) {
                    var t = role.bullets[bi2];
                    if (typeof t !== 'string' || /^\s*\[/.test(t)) return;
                    out.push({
                      kind: 'bullet', sid: s.id || 'experience', roleIdx: ri2, bulletIdx: bi2, role: role,
                      widthPx: met.bulletWpx, fontPx: met.bulletPx, align: 'justify', prefixHtml: '',
                      get: function () { return role.bullets[bi2]; },
                      set: function (v) { role.bullets[bi2] = v; },
                    });
                  })(bi);
                }
              }
              if (typeof role.results === 'string' && role.results.trim() && !/^\s*\[/.test(role.results)) {
                out.push({
                  kind: 'results', sid: s.id || 'experience', roleIdx: ri2, role: role,
                  widthPx: met.cellWpx, fontPx: met.bodyPx, align: 'left',
                  prefixHtml: '<b><i>Results: </i></b>',   // same paragraph as the lead run (worker renderExperience)
                  get: function () { return role.results; },
                  set: function (v) { role.results = v; },
                });
              }
            })(s.roles[ri], ri);
          }
        } else if ((s.type === 'text' || s.type === 'text_inline') && String(s.id || '') === 'profile') {
          if (typeof s.content !== 'string' || /^\s*\[[\s\S]*\]\s*$/.test(s.content)) return; // worker drops placeholders
          var parts = s.content.split(/(\n{2,})/);
          for (var pi = 0; pi < parts.length; pi++) {
            (function (pi2) {
              if (/^\n{2,}$/.test(parts[pi2]) || !parts[pi2].trim()) return;
              out.push({
                kind: 'profile', sid: s.id, parIdx: pi2, section: s,
                widthPx: met.cellWpx, fontPx: met.bodyPx, align: 'justify', prefixHtml: '',
                get: function () { return parts[pi2]; },
                set: function (v) { parts[pi2] = v; s.content = parts.join(''); },
              });
            })(pi);
          }
        }
      })(secs[si]);
    }
    return out;
  }

  // ── per-target measure + L2 ─────────────────────────────────────────────────
  function measureTarget(measure, tg, raw) {
    return measure({ html: tg.prefixHtml + toDisplayHtml(raw), widthPx: tg.widthPx, fontPx: tg.fontPx, family: tg.family, align: tg.align });
  }
  // Returns {fixed:true, n} when a bind cleared the runt, {runt:true} when it is
  // a genuine runt L2 cannot clear, or {} when the text does not runt at all.
  function tryL2(measure, tg) {
    var raw = tg.get();
    if (typeof raw !== 'string' || bindableSpaces(raw).length < 2 || raw.length < 40) return {};
    var base = measureTarget(measure, tg, raw);
    if (!isRuntLines(base, tg.widthPx)) return {};
    var maxN = Math.min(MAX_BIND, bindableSpaces(raw).length - 1);
    for (var n = 1; n <= maxN; n++) {
      var cand = bindLastN(raw, n);
      var l = measureTarget(measure, tg, cand);
      if (l.length > base.length) break;                 // binding overflowed a new line — stop
      if (!isRuntLines(l, tg.widthPx)) { tg.set(cand); return { fixed: true, n: n, baseLines: base.length }; }
    }
    return { runt: true, baseLines: base.length };
  }

  // ── stored-section mirror (rewrites only) via the SHIPPED verifier ──────────
  function mirrorRewrite(tg, shortText, origText, storage) {
    try {
      var OB = window.AntcvOrphanBind;
      var st = storage || localStorage;
      if (tg.kind === 'bullet') {
        if (!OB || typeof OB._l3WriteBullet !== 'function') return false;
        var secsRaw = st.getItem('sections'); if (!secsRaw) return false;
        var secs = JSON.parse(secsRaw);
        // Path is a HINT only — _l3WriteBullet routes through locateBullet
        // (ORPHAN-WRITE-VERIFY-001): text-verified, unique-match fallback, abort
        // otherwise. Payload roles are the visible subset, so the index hint may
        // be off — that is exactly what the verifier tolerates.
        var ok = OB._l3WriteBullet(secs, tg.sid, ['roles', String(tg.roleIdx), 'bullets', String(tg.bulletIdx)], shortText, origText);
        if (ok) { st.setItem('sections', JSON.stringify(secs)); return true; }
        return false;
      }
      if (tg.kind === 'results') {
        // Preview override key: 'r|<title>|<company>|<visible role index>' (app.src.js ~6429).
        // Payload roles are exactly the visible roles in render order, so roleIdx matches the
        // preview t; a mismatch just leaves a dead entry (title+company keep it role-safe).
        var rKey = 'r|' + String(tg.role.title || '') + '|' + String(tg.role.company || '') + '|' + tg.roleIdx;
        var map; try { map = JSON.parse(st.getItem('antcv:resultsOverride') || '{}') || {}; } catch (_) { map = {}; }
        map[rKey] = shortText;
        st.setItem('antcv:resultsOverride', JSON.stringify(map));
        return true;
      }
      if (tg.kind === 'profile') {
        if (!OB || typeof OB._sameText !== 'function') return false;
        var raw2 = st.getItem('sections'); if (!raw2) return false;
        var secs2 = JSON.parse(raw2);
        var list = (secs2 && secs2.cv) || [];
        for (var i = 0; i < list.length; i++) {
          var s = list[i];
          if (!s || String(s.id || '') !== 'profile' || typeof s.content !== 'string') continue;
          var parts = s.content.split(/(\n{2,})/);
          var hits = [];
          for (var p = 0; p < parts.length; p++) { if (!/^\n{2,}$/.test(parts[p]) && OB._sameText(parts[p], origText)) hits.push(p); }
          if (hits.length !== 1) return false;           // text-verified or nothing
          parts[hits[0]] = shortText;
          s.content = parts.join('');
          st.setItem('sections', JSON.stringify(secs2));
          return true;
        }
        return false;
      }
    } catch (_) {}
    return false;
  }

  // ── the preflight ───────────────────────────────────────────────────────────
  // Mutates payload.sections in place; resolves with a summary. Never throws.
  function run(payload, opts) {
    opts = opts || {};
    var storage = opts.storage || null;
    var summary = { version: VERSION, scanned: 0, runts: 0, bound: 0, rewritten: 0, residue: 0, ms: 0 };
    try {
      if (disabled(storage)) { summary.disabled = true; return Promise.resolve(summary); }
      if (!payload || payload.doc !== 'cv' || payload.layout === 'linear') { summary.skipped = 'doc'; return Promise.resolve(summary); }
      var t0 = Date.now();
      var met = metricsFromPayload(payload);
      var measure = opts.measureLines || domMeasureLines;
      var targets = collectTargets(payload, met);
      targets.forEach(function (tg) { tg.family = met.family; });
      summary.scanned = targets.length;

      var residue = [];
      targets.forEach(function (tg) {
        var r;
        try { r = tryL2(measure, tg); } catch (_) { r = {}; }
        if (r.fixed) { summary.runts++; summary.bound++; }
        else if (r.runt) { summary.runts++; residue.push({ tg: tg, text: tg.get(), baseLines: r.baseLines }); }
      });
      summary.residue = residue.length;
      try { console.log('[orphan-preflight] scanned ' + summary.scanned + ', runts ' + summary.runts + ', L2-bound ' + summary.bound + ', residue ' + residue.length); } catch (_) {}
      if (!residue.length) { summary.ms = Date.now() - t0; return Promise.resolve(summary); }

      // budget: never start the LLM leg if measurement already ate the envelope
      if (Date.now() - t0 > 9000) { summary.ms = Date.now() - t0; summary.l3 = 'skipped-budget'; return Promise.resolve(summary); }

      // attempted-map cap (per text signature) so a line the LLM cannot fix does
      // not cost a call on every export
      var attempted = readAttempted(storage);
      var fresh = residue.filter(function (r) {
        var a = attempted[String(hash(r.text))];
        return !a || (a.n || 0) < L3_MAX_PER_LINE;
      });
      if (!fresh.length) { summary.ms = Date.now() - t0; summary.l3 = 'all-attempted'; return Promise.resolve(summary); }
      var base = proxyBase(storage);
      var fetchImpl = opts.fetchImpl || (typeof window !== 'undefined' && window.fetch ? window.fetch.bind(window) : null);
      if (!base || !fetchImpl) { summary.ms = Date.now() - t0; summary.l3 = 'no-route'; return Promise.resolve(summary); }
      fresh.forEach(function (r) {
        var k = String(hash(r.text)); var a = attempted[k] || { n: 0 };
        attempted[k] = { n: (a.n || 0) + 1 };
      });
      writeAttempted(storage, attempted);

      var ac = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = setTimeout(function () { try { if (ac) ac.abort(); } catch (_) {} }, L3_TIMEOUT_MS);
      var inputs = fresh.map(function (r) { return r.text; });
      return fetchImpl(base + '/', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-provider': 'anthropic' },
        body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 2000, stream: false, system: L3_SYSTEM, messages: [{ role: 'user', content: JSON.stringify(inputs) }] }),
        ...(ac ? { signal: ac.signal } : {}),
      }).then(function (res) { return res.json().catch(function () { return null; }); }).then(function (j) {
        clearTimeout(timer);
        var raw = (j && j.content && j.content[0] && j.content[0].text) || '';
        var arr; try { arr = JSON.parse(String(raw).replace(/```json|```/g, '').trim()); } catch (_) { arr = null; }
        if (!Array.isArray(arr) || arr.length !== fresh.length) {
          try { console.warn('[orphan-preflight] unusable LLM response'); } catch (_) {}
          summary.l3 = 'bad-response'; summary.ms = Date.now() - t0; return summary;
        }
        for (var i = 0; i < fresh.length; i++) {
          var r = fresh[i], tg = r.tg;
          var short = String(arr[i] == null ? '' : arr[i]).trim();
          if (!safeShorten(r.text, short)) continue;
          if (tg.get() !== r.text) continue;              // payload changed underneath — never write blind
          // RE-MEASURE gate (§9): the rewrite must not runt and must not gain a
          // line; a rewrite that runts but NBSP-binds clean is accepted bound.
          var lines;
          try { lines = measureTarget(measure, tg, short); } catch (_) { lines = []; }
          if (lines.length > r.baseLines) continue;
          var accepted = null;
          if (!isRuntLines(lines, tg.widthPx)) accepted = short;
          else {
            var maxN = Math.min(MAX_BIND, Math.max(0, bindableSpaces(short).length - 1));
            for (var n = 1; n <= maxN; n++) {
              var cand = bindLastN(short, n);
              var l2; try { l2 = measureTarget(measure, tg, cand); } catch (_) { l2 = []; }
              if (l2.length > lines.length) break;
              if (!isRuntLines(l2, tg.widthPx)) { accepted = cand; break; }
            }
          }
          if (accepted == null) continue;
          tg.set(accepted);
          summary.rewritten++;
          // Preview-parity mirror: text-verified via the shipped verifier; the
          // UNBOUND rewrite goes to storage (NBSPs re-derive per export).
          if (mirrorRewrite(tg, short, r.text, storage)) summary.mirrored = (summary.mirrored || 0) + 1;
        }
        if (summary.rewritten) {
          try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { reason: 'orphan-preflight-retighten' } })); } catch (_) {}
        }
        try { console.log('[orphan-preflight] L3 re-tightened ' + summary.rewritten + '/' + fresh.length); } catch (_) {}
        summary.ms = Date.now() - t0;
        return summary;
      }).catch(function (e) {
        clearTimeout(timer);
        try { console.warn('[orphan-preflight] L3 failed', e && e.message); } catch (_) {}
        summary.l3 = 'error'; summary.ms = Date.now() - t0;
        return summary;                                   // L2 fixes already landed — never fail the export
      });
    } catch (e) {
      try { console.warn('[orphan-preflight] failed', e && e.message); } catch (_) {}
      summary.error = String(e && e.message || e);
      return Promise.resolve(summary);
    }
  }

  window.AntcvOrphanExportPreflight = {
    version: VERSION,
    run: run,
    RUNT_FRAC: RUNT_FRAC,
    _metricsFromPayload: metricsFromPayload,
    _collectTargets: collectTargets,
    _toDisplayHtml: toDisplayHtml,
    _bindLastN: bindLastN,
    _bindableSpaces: bindableSpaces,
    _isRuntLines: isRuntLines,
    _safeShorten: safeShorten,
    _tryL2: tryL2,
    _mirrorRewrite: mirrorRewrite,
    _domMeasureLines: domMeasureLines,
    _hash: hash,
  };
})();
