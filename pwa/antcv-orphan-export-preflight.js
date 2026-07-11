/* antcv-orphan-export-preflight.js — ORPHANS v3 (owner 2026-07-04, register row 27)
 * ============================================================================
 * EXPORT-METRIC-MEASURE-001 + EXPORT-PREFLIGHT-ORPHANS-001 + (v3)
 * MAIN-RUNT-ORPHAN-SWEEP-001: RUNT_FRAC 0.60, LENGTHEN-from-kernel L3,
 * NO-FORCE-JUSTIFY belt (spec rule 30), SIDEBAR-PACKING belt (spec rule 40)
 * (docs/qa/ORPHAN_ARCHITECTURE_2026-07-02.md §7–9 + RUNT_INVENTORY_UNSOL_20260703).
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
 * v3 recalibration (owner baseline RUNT_INVENTORY_UNSOL_20260703 — 19 last-lines
 * under 60%, 5 force-justified stretched lines):
 *  - RUNT_FRAC 0.40 -> 0.60: the owner threshold IS the detector threshold.
 *  - Measurement runs at NATURAL (left) alignment — CSS text-align never moves
 *    wrap points, but justified rects report STRETCHED widths, which hid the
 *    under-filled mid-lines the no-force-justify belt needs.
 *  - NO-FORCE-JUSTIFY (rule 30): a justified bullet/profile paragraph with a
 *    NON-last line naturally under JUSTIFY_MIN of the column would render with
 *    stretched word gaps ("rivers") in the PDF. The belt writes a per-path LEFT
 *    override into the payload's item_alignment (the worker already honours
 *    paraAlignPath "roles.N.bullets.M" / "content") — never when the user set an
 *    explicit CJLR value on that path or a __group__ override on the section.
 *  - L3 can now LENGTHEN as well as shorten: each residue line ships with FACTS
 *    from the stored kernel (personalInfo.experience bullets/results matched by
 *    company/title; background+workStyle for profile). safeRewrite gates the
 *    result: numbers/acronyms of the original verbatim; a LONGER rewrite must be
 *    backed by facts and any NEW number must appear in those facts (never
 *    fabricate); the re-measure accepts only fill>=60% with NO line-count gain
 *    (lengthening fills the runt line — it must never add lines or pages).
 *    No cross-section dedup anywhere (owner rule 3).
 *  - SIDEBAR-PACKING (rule 40, deterministic half): comma-token sidebar values
 *    (TOOLS & METHODS category rows — rich_block {b,t} after RICHBLOCK-SHAPE-001
 *    — and labeled_list {l,v}) are reordered long+short-adjacent by greedy
 *    best-insertion, accepted ONLY when the measured rendered line count drops
 *    (or an equal-line order clears a runt). Token text never changes; prose
 *    values (few commas, "and …" tokens, sentences) are shape-gated out.
 *    Payload-scoped, like the NBSP binds. Kill: antcv:disable-sidebar-packing.
 *  - rich_block sidebar rows are now L2-bind targets too (tools rows were
 *    invisible to v2 — it only collected labeled_list).
 *
 * WHEN: awaited INSIDE exportDocxViaWorker/exportPdfViaWorker, after buildPayload
 * and before the POST — so the fix always lands in the payload (no async-tick
 * race). The caller wraps the call in a hard 12s Promise.race + try/catch: the
 * export can NEVER hang or fail because of the preflight.
 *
 * PIPELINE per export: pack sidebar rows → collect targets (experience bullets +
 * per-role Results + PROFILE prose + sidebar values) → measure (natural widths,
 * RUNT_FRAC 0.60) → rule-30 left-align overrides → L2: minimal trailing-NBSP
 * bind that clears the runt without adding a line → residue: ONE batched LLM
 * call (line + kernel FACTS) gated by safeRewrite AND a RE-MEASURE. All payload
 * writes are whole-string replacements against the enumerated payload arrays;
 * STORED-section mirrors (rewrites only — NBSP binds are invisible in the
 * preview) go through the shipped ORPHAN-WRITE-VERIFY-001 verifier
 * (window.AntcvOrphanBind), which text-verifies every target and aborts on
 * ambiguity — never index-trusted.
 *
 * Kill: localStorage['antcv:disable-orphan-preflight']='1'.
 * Test hooks: run(payload, { measureLines, fetchImpl, storage }) — the unit tests
 * inject a deterministic measurer + fetch; the DOM measurer is only built lazily.
 */
(function () {
  'use strict';
  var VERSION = '1.51.130-orphan-v3-bulletcap';
  if (window.__antcvOrphanExportPreflight === VERSION) return;
  window.__antcvOrphanExportPreflight = VERSION;

  var NBSP = String.fromCharCode(160);
  var RUNT_FRAC = 0.60;      // v3: the owner's fill floor IS the detector threshold (rule: last line >= 60%)
  var MAX_BIND = 8;          // 0.60 needs more trailing glue than the old 0.40 pass
  var JUSTIFY_MIN = 0.85;    // rule 30: a natural mid-line under 85% renders stretched when justified
  var MIN_LINE_PX = 8;
  var PAGE_W = 11906;        // A4 twips — worker src/generate.js
  var TWIPS_PER_PX = 15;     // 96dpi
  var L3_TIMEOUT_MS = 8500;  // inside the caller's hard 12s envelope
  var L3_KEY = 'antcv:orphanPreflightAttempted';
  var L3_MAX_PER_LINE = 2;
  var PACK_MIN_TOKS = 3;     // packing: fewer comma tokens than this is not a list
  var PACK_MAX_TOKS = 14;
  var PACK_TOK_MAX = 48;     // a longer "token" is prose, not a list entry

  function disabled(storage) {
    try { var v = (storage || localStorage).getItem('antcv:disable-orphan-preflight'); return v === '1' || v === 'true'; } catch (_) { return false; }
  }
  // BULLET-LINES-CAP (spec rule 46, owner Trackman round 2: "for tailored
  // applications do NOT generate 3-line bullets in nordic minimal!"): in a
  // TARGETED export a role bullet must fit TWO typeset lines.
  var MAX_BULLET_LINES = 2;
  function isTargetedMeta(storage) {
    try {
      var m = JSON.parse((storage || localStorage).getItem('meta') || '{}') || {};
      var c = String(m.company || '').trim();
      return !!c && !(window.__ANTCV_UNSOL_RE || /^unsolicited$/i).test(c) && !/^open application$/i.test(c); // UNSOL-PILLAR-LANG-001: any language variant
    } catch (_) { return false; }
  }
  function packingDisabled(storage) {
    try { var v = (storage || localStorage).getItem('antcv:disable-sidebar-packing'); return v === '1' || v === 'true'; } catch (_) { return false; }
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
    // SIDEBAR-ORPHANS-001 (owner PDF review 2026-07-03): the owner's export
    // carried 7 runts, ALL sidebar labeled values (tools / regulatory /
    // interests) — this preflight was main-column-only by design. Sidebar
    // geometry mirrors worker makeSidebarCell (sbLR default 120 DXA) and
    // renderLabeledList (fs.sbBody, sidebarBodyFont || sidebarFont).
    var sbPadPx = pxTok(style.sidebarEdgePad);
    var sbLR = sbPadPx !== undefined ? Math.round(sbPadPx * 15) : 120;
    var sbPt = Number(fs.sbBody); if (!isFinite(sbPt) || sbPt <= 0) sbPt = 10;
    // SIDEBAR-FONT-METRIC-001 (owner export (3), 2026-07-03): the payload does NOT
    // carry sidebarBodyFont — the WORKER fills it server-side from the package BODY
    // font (default Calibri -> the PDF's Carlito). style.sidebarFont is the HEADING
    // font (Trebuchet MS); measuring the values with it scrambled every wrap point,
    // so all 8 sidebar runts in the owner's export went undetected. Fall back to
    // the SAME package body family as the main column.
    var sideFamily = (typeof style.sidebarBodyFont === 'string' && /^[a-z ]{3,}$/i.test(style.sidebarBodyFont))
      ? style.sidebarBodyFont
      : family;
    return {
      family: family,
      cellWpx: cellW / TWIPS_PER_PX,
      bulletWpx: (cellW - bIndent) / TWIPS_PER_PX,   // numbering indent: text column for bullet body
      bulletPx: bulletPt * 96 / 72,
      bodyPx: bodyPt * 96 / 72,
      sideCellWpx: (sidebarW - 2 * sbLR) / TWIPS_PER_PX,
      sbBodyPx: sbPt * 96 / 72,
      sideFamily: sideFamily,
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
  // v3: callers always pass align 'left' — text-align never moves CSS wrap
  // points, but justified rects report STRETCHED widths, which would blind the
  // rule-30 mid-line detector AND misread nothing for the last line (justify
  // never stretches the final line). Natural widths serve both detectors.
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
      el.style.textAlign = spec.align || 'left';
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
  // rule 30: any NON-last line naturally under JUSTIFY_MIN of the column will
  // render with stretched word gaps once the renderer justifies it.
  function hasUnderfilledMidline(widths, colWpx) {
    if (!widths || widths.length < 2 || !(colWpx > 0)) return false;
    for (var i = 0; i < widths.length - 1; i++) {
      if (widths[i] > 0 && (widths[i] / colWpx) < JUSTIFY_MIN) return true;
    }
    return false;
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
  // v3 LENGTHEN gate (owner rule: the fixer must be able to ADD a concrete
  // stored detail, never fabricate). A rewrite longer than the original is only
  // accepted when kernel FACTS were supplied, the growth is bounded, and every
  // NEW number it introduces appears verbatim in those facts. Shorter rewrites
  // keep the shipped safeShorten gate unchanged.
  function safeRewrite(orig, out, facts) {
    orig = String(orig || ''); out = String(out || '').trim();
    if (!out || out === orig) return false;
    if (out.length < orig.length) return safeShorten(orig, out);
    if (/[—–]/.test(out) && !/[—–]/.test(orig)) return false;
    facts = String(facts || '');
    if (!facts.trim()) return false;                       // nothing stored to lengthen from
    if (out.length > orig.length * 1.9 + 20) return false; // bounded growth — fill the line, not the page
    var nums = orig.match(/\d[\d.,%/-]*/g) || [];
    for (var i = 0; i < nums.length; i++) { if (out.indexOf(nums[i]) === -1) return false; }
    var acr = orig.match(/\b[A-Z][A-Z0-9]{1,}\b/g) || [];
    for (var j = 0; j < acr.length; j++) { if (out.indexOf(acr[j]) === -1) return false; }
    var newNums = out.match(/\d[\d.,%/-]*/g) || [];
    for (var k = 0; k < newNums.length; k++) {
      if (orig.indexOf(newNums[k]) === -1 && facts.indexOf(newNums[k]) === -1) return false;
    }
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
  var L3_SYSTEM = 'You are a precise CV line editor. Each input item is {"line","facts"}: "line" is one CV line (an experience bullet, a Results line, or a profile sentence group) whose LAST typeset line in the EXPORTED PDF fills under 60% of the column (a dangling runt); "facts" is stored source material about the SAME role from the candidate\'s own data (may be empty). Rewrite EACH line so it fills complete typeset lines with NO short dangling last line. You may SHORTEN (shorter synonyms, drop filler like "the", "a", "that", "in order to", "various", redundant qualifiers) OR LENGTHEN by folding in ONE concrete detail taken ONLY from "facts" — never invent a fact, number, tool, or claim that is not in "line" or "facts". An item may carry "maxLines": that line is TOO LONG for the layout — shorten it decisively so it fits within that many typeset lines (keep only the strongest content; a two-line bullet beats a three-line one). Keep the SAME meaning and the SAME leading verb form. PRESERVE VERBATIM every number, %, year, patent/standard code, tool name, proper noun, acronym, and any <b>/<i> tags from the original. NEVER use an em dash or en dash. Do NOT merge lines. Return ONLY a JSON array of strings, the SAME length and order as the input.';

  // ── kernel FACTS for the LENGTHEN leg ────────────────────────────────────────
  function normKey(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function kernelPI(storage) {
    try {
      var p = JSON.parse((storage || localStorage).getItem('personalInfo') || '{}') || {};
      return p.personalInfo || p;
    } catch (_) { return {}; }
  }
  function kernelFactsFor(tg, storage) {
    try {
      var p = kernelPI(storage);
      if (tg.kind === 'profile') {
        var bits = [];
        if (typeof p.background === 'string' && p.background.trim()) bits.push(p.background.trim());
        if (typeof p.workStyle === 'string' && p.workStyle.trim()) bits.push(p.workStyle.trim());
        return bits.join(' ').slice(0, 900);
      }
      if (tg.kind !== 'bullet' && tg.kind !== 'results') return '';
      var ex = Array.isArray(p.experience) ? p.experience : [];
      var co = normKey(tg.role && tg.role.company);
      var ti = normKey(tg.role && tg.role.title);
      var parts = [];
      for (var i = 0; i < ex.length; i++) {
        var e = ex[i]; if (!e || typeof e !== 'object') continue;
        var eco = normKey(e.company), eti = normKey(e.title);
        // Company is the stable key (titles are JD-adapted; merged roles join
        // several kernel entries of the SAME company — include them all).
        var hit = (co && eco && (eco === co || eco.indexOf(co) !== -1 || co.indexOf(eco) !== -1)) ||
                  (!co && ti && eti && (eti === ti || eti.indexOf(ti) !== -1 || ti.indexOf(eti) !== -1));
        if (!hit) continue;
        if (Array.isArray(e.bullets)) parts.push(e.bullets.filter(function (b) { return typeof b === 'string'; }).join(' '));
        if (typeof e.results === 'string' && e.results.trim()) parts.push(e.results.trim());
      }
      return parts.join(' ').slice(0, 1200);
    } catch (_) { return ''; }
  }

  // ── target collection from the BUILT payload ────────────────────────────────
  // Each target reads/writes payload.sections in place. Profile is processed per
  // paragraph (the worker splits content on blank lines — renderText).
  function collectTargets(payload, met) {
    var out = [];
    var secs = (payload && payload.sections) || [];
    for (var si = 0; si < secs.length; si++) {
      (function (s) {
        if (!s) return;
        if (s.loc === 'sidebar') {
          // SIDEBAR-ORPHANS-001: labeled_list VALUES wrap in the narrow column
          // and orphan exactly like main bullets. L2 NBSP binds ONLY —
          // payload-scoped, content-preserving; sidebar lines never go to L3 and
          // never touch stored sections. v3: rich_block rows ({b,t} — TOOLS &
          // METHODS after RICHBLOCK-SHAPE-001) are collected too; v2 only saw
          // labeled_list, so every tools runt went undetected.
          if (!Array.isArray(s.items)) return;
          if (s.type === 'labeled_list') {
            for (var li = 0; li < s.items.length; li++) {
              (function (it, li2) {
                if (!it || typeof it !== 'object') return;
                if (it.hidden === true || it.on === false) return;
                if (s.hidden && s.hidden[li2]) return;
                if (it.group !== undefined || it.subhead !== undefined || it.header !== undefined || it.category !== undefined) return;
                var vk = (typeof it.v === 'string' && it.v.trim()) ? 'v' : (typeof it.value === 'string' && it.value.trim()) ? 'value' : null;
                if (!vk || /^\s*\[/.test(it[vk])) return;
                var label = String(it.l || it.label || '');
                out.push({
                  kind: 'side_label', sid: s.id || '', itemIdx: li2,
                  widthPx: met.sideCellWpx, fontPx: met.sbBodyPx, align: 'left',
                  family: met.sideFamily,
                  prefixHtml: (label && it.labelHidden !== true) ? '<b>' + esc(label) + ': </b>' : '',
                  get: function () { return it[vk]; },
                  set: function (v) { it[vk] = v; },
                });
              })(s.items[li], li);
            }
          } else if (s.type === 'rich_block') {
            for (var ri0 = 0; ri0 < s.items.length; ri0++) {
              (function (it, i2) {
                if (!it || typeof it !== 'object') return;
                if (it.grp || it.group !== undefined) return;            // group sub-heading
                if (it.mk) return;                                       // marker/bullet rows keep their own geometry
                if (typeof it.t !== 'string' || !it.t.trim() || /^\s*\[/.test(it.t)) return;
                var lead = String(it.b || '');
                if (/^\s*hidden\s*[-–—:]\s*/i.test(lead)) return;        // residue rows never ship (belt) — never measure
                // Worker LEAD-COLON-PERROW-001: non-marker lead gets ': ' unless
                // it already ends in punctuation or row.colon === false.
                var colon = (it.colon != null) ? !!it.colon : (s.leadColon !== false && !/[:.;,!?…–—-]$/.test(lead.trim()));
                out.push({
                  kind: 'side_label', sid: s.id || '', itemIdx: i2,
                  widthPx: met.sideCellWpx, fontPx: met.sbBodyPx, align: 'left',
                  family: met.sideFamily,
                  prefixHtml: lead ? '<b>' + esc(lead + (colon ? ': ' : ' ')) + '</b>' : '',
                  get: function () { return it.t; },
                  set: function (v) { it.t = v; },
                });
              })(s.items[ri0], ri0);
            }
          }
          return;
        }
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
                      kind: 'bullet', sid: s.id || 'experience', roleIdx: ri2, bulletIdx: bi2, role: role, sec: s,
                      alignPath: 'roles.' + ri2 + '.bullets.' + bi2,     // worker paraAlignPath key (renderExperience)
                      widthPx: met.bulletWpx, fontPx: met.bulletPx, align: 'left', prefixHtml: '',
                      get: function () { return role.bullets[bi2]; },
                      set: function (v) { role.bullets[bi2] = v; },
                    });
                  })(bi);
                }
              }
              if (typeof role.results === 'string' && role.results.trim() && !/^\s*\[/.test(role.results)) {
                out.push({
                  kind: 'results', sid: s.id || 'experience', roleIdx: ri2, role: role, sec: s,
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
                kind: 'profile', sid: s.id, parIdx: pi2, section: s, sec: s,
                alignPath: 'content',                                   // worker renderText paraAlignPath key
                widthPx: met.cellWpx, fontPx: met.bodyPx, align: 'left', prefixHtml: '',
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

  // ── rule 30: LEFT override into the payload's item_alignment ─────────────────
  // Only bullets + profile render justified by default (worker renderExperience /
  // renderText). Never touch a path the user (CJLR) or a __group__ override
  // already governs — explicit choices win over the belt.
  function applyLeftOverride(tg) {
    var s = tg.sec;
    if (!s || !tg.alignPath) return false;
    var m = s.item_alignment;
    if (m && typeof m === 'object') {
      var v = m[tg.alignPath];
      if (v === 'left' || v === 'center' || v === 'right' || v === 'justify') return false;
      var g = m.__group__;
      if (g === 'left' || g === 'center' || g === 'right' || g === 'justify') return false;
    } else {
      m = s.item_alignment = {};
    }
    m[tg.alignPath] = 'left';
    return true;
  }

  // ── SIDEBAR-PACKING belt (spec rule 40, deterministic half) ─────────────────
  // A comma-token value is a reorderable LIST when it has PACK_MIN_TOKS..
  // PACK_MAX_TOKS tokens, every token is short and clause-free, and no token
  // starts with a conjunction (reordering "X, Y, and Z" would break grammar).
  function packTokens(v) {
    var s = String(v == null ? '' : v).trim();
    if (!s || s.indexOf('[') !== -1 || /<[a-z/]/i.test(s)) return null;  // placeholders / markup: never
    var trailingDot = /\.$/.test(s);
    var body = trailingDot ? s.slice(0, -1) : s;
    if (/;/.test(body)) return null;                                     // grouped list — semantics in the grouping
    var toks = body.split(',').map(function (t) { return t.trim(); });
    if (toks.length < PACK_MIN_TOKS || toks.length > PACK_MAX_TOKS) return null;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.length < 2 || t.length > PACK_TOK_MAX) return null;
      if (/^(and|or|og|eller|und|y|e)\s/i.test(t)) return null;          // conjunction-led token = prose list
      if (/[.:!?]/.test(t.replace(/\.$/, ''))) return null;              // inner sentence punctuation = prose
    }
    return { toks: toks, trailingDot: trailingDot };
  }
  function joinTokens(p, toks) { return toks.join(', ') + (p.trailingDot ? '.' : ''); }
  function packSidebar(payload, met, measure, storage, summary) {
    if (packingDisabled(storage)) return;
    var secs = (payload && payload.sections) || [];
    secs.forEach(function (s) {
      if (!s || s.loc !== 'sidebar' || !Array.isArray(s.items)) return;
      if (s.type !== 'labeled_list' && s.type !== 'rich_block') return;
      s.items.forEach(function (it) {
        if (!it || typeof it !== 'object') return;
        if (it.grp || it.group !== undefined || it.subhead !== undefined || it.header !== undefined || it.category !== undefined) return;
        if (it.hidden === true || it.on === false || it.mk) return;
        var vk = (typeof it.v === 'string' && it.v.trim()) ? 'v'
          : (typeof it.value === 'string' && it.value.trim()) ? 'value'
            : (typeof it.t === 'string' && it.t.trim()) ? 't' : null;
        if (!vk) return;
        var lead = String(vk === 't' ? (it.b || '') : (it.l || it.label || ''));
        if (/^\s*hidden\s*[-–—:]\s*/i.test(lead)) return;                // residue rows never ship
        var parsed = packTokens(it[vk]);
        if (!parsed) return;
        var prefix = lead && it.labelHidden !== true ? '<b>' + esc(lead + ': ') + '</b>' : '';
        var lines = function (toks) {
          return measure({
            html: prefix + toDisplayHtml(joinTokens(parsed, toks)),
            widthPx: met.sideCellWpx, fontPx: met.sbBodyPx, family: met.sideFamily, align: 'left',
          });
        };
        var baseL = lines(parsed.toks);
        if (!baseL.length) return;
        // Greedy best-insertion, longest token first: long+short adjacency falls
        // out of minimising measured lines at each step (ties -> earliest index,
        // which keeps the generation's relevance order where it costs nothing).
        var order = parsed.toks.slice().sort(function (a, b) { return b.length - a.length; });
        var packed = [];
        for (var i = 0; i < order.length; i++) {
          var bestIdx = 0, bestCost = Infinity;
          for (var j = 0; j <= packed.length; j++) {
            var trial = packed.slice(0, j).concat([order[i]], packed.slice(j));
            var lw = lines(trial);
            var cost = lw.length * 100000 - (lw.length ? lw[lw.length - 1] : 0); // fewer lines, then fuller last line
            if (cost < bestCost) { bestCost = cost; bestIdx = j; }
          }
          packed.splice(bestIdx, 0, order[i]);
        }
        var packedL = lines(packed);
        var better = packedL.length < baseL.length ||
          (packedL.length === baseL.length && isRuntLines(baseL, met.sideCellWpx) && !isRuntLines(packedL, met.sideCellWpx));
        if (better) {
          it[vk] = joinTokens(parsed, packed);
          summary.packed = (summary.packed || 0) + 1;
          summary.packedLinesSaved = (summary.packedLinesSaved || 0) + (baseL.length - packedL.length);
        }
      });
    });
  }

  // ── per-target measure + L2 ─────────────────────────────────────────────────
  function measureTarget(measure, tg, raw) {
    // Always measure NATURAL (left) widths — see domMeasureLines note.
    return measure({ html: tg.prefixHtml + toDisplayHtml(raw), widthPx: tg.widthPx, fontPx: tg.fontPx, family: tg.family, align: 'left' });
  }
  // Returns {fixed:true, n} when a bind cleared the runt, {runt:true} when it is
  // a genuine runt L2 cannot clear, or {} when the text does not runt at all.
  // baseOpt: a pre-computed measurement of the current text (avoids re-measuring).
  function tryL2(measure, tg, baseOpt) {
    var raw = tg.get();
    // Sidebar values wrap in a ~2.5x narrower column — a 25-char value can already
    // span two lines there, so the main-column 40-char floor skipped real sidebar
    // runts (e.g. "Weapon-mounted sight interface context", 38 chars).
    var minLen = tg.kind === 'side_label' ? 24 : 40;
    if (typeof raw !== 'string' || bindableSpaces(raw).length < 2 || raw.length < minLen) return {};
    var base = baseOpt || measureTarget(measure, tg, raw);
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
    var summary = { version: VERSION, scanned: 0, runts: 0, bound: 0, rewritten: 0, residue: 0, leftAligned: 0, ms: 0 };
    try {
      if (disabled(storage)) { summary.disabled = true; return Promise.resolve(summary); }
      if (!payload || payload.doc !== 'cv' || payload.layout === 'linear') { summary.skipped = 'doc'; return Promise.resolve(summary); }
      var t0 = Date.now();
      var met = metricsFromPayload(payload);
      var measure = opts.measureLines || domMeasureLines;

      // rule 40 first: bind/measure below must see the PACKED values.
      try { packSidebar(payload, met, measure, storage, summary); } catch (_) {}

      var targets = collectTargets(payload, met);
      targets.forEach(function (tg) { if (!tg.family) tg.family = met.family; });
      summary.scanned = targets.length;

      var targeted = isTargetedMeta(storage);
      var residue = [];
      targets.forEach(function (tg) {
        var base = null;
        // rule 30 (NO-FORCE-JUSTIFY): bullets + profile render justified by
        // default; a naturally under-filled MID line would stretch into rivers.
        if (tg.alignPath) {
          try {
            base = measureTarget(measure, tg, tg.get());
            if (hasUnderfilledMidline(base, tg.widthPx) && applyLeftOverride(tg)) summary.leftAligned++;
          } catch (_) { base = null; }
        }
        var r;
        try { r = tryL2(measure, tg, base); } catch (_) { r = {}; }
        // rule 46: a targeted bullet spanning >= 3 typeset lines is TOO LONG —
        // it goes to L3 with a hard 2-line cap even when its last line is full.
        var overLines = 0;
        if (targeted && tg.kind === 'bullet') {
          try { var lw = measureTarget(measure, tg, tg.get()); if (lw.length > MAX_BULLET_LINES) overLines = lw.length; } catch (_) {}
        }
        if (r.fixed) { summary.runts++; summary.bound++; }
        // SIDEBAR-ORPHANS-001: sidebar values stop at L2 — no LLM rewrite, no
        // stored-section mirror (the narrow column is not worth a reword risk).
        else if (r.runt) { summary.runts++; if (tg.kind !== 'side_label') residue.push({ tg: tg, text: tg.get(), baseLines: r.baseLines, maxLines: overLines ? MAX_BULLET_LINES : undefined }); return; }
        if (overLines) {
          summary.longBullets = (summary.longBullets || 0) + 1;
          residue.push({ tg: tg, text: tg.get(), baseLines: overLines, maxLines: MAX_BULLET_LINES });
        }
      });
      summary.residue = residue.length;
      try { console.log('[orphan-preflight] scanned ' + summary.scanned + ', runts ' + summary.runts + ', L2-bound ' + summary.bound + ', left-aligned ' + summary.leftAligned + ', packed ' + (summary.packed || 0) + ', residue ' + residue.length); } catch (_) {}
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
        r.facts = kernelFactsFor(r.tg, storage);
      });
      writeAttempted(storage, attempted);

      var ac = (typeof AbortController === 'function') ? new AbortController() : null;
      var timer = setTimeout(function () { try { if (ac) ac.abort(); } catch (_) {} }, L3_TIMEOUT_MS);
      var inputs = fresh.map(function (r) {
        var it = { line: r.text, facts: r.facts || '' };
        if (r.maxLines) it.maxLines = r.maxLines;   // rule 46: hard line cap for over-long targeted bullets
        return it;
      });
      return fetchImpl(base + '/', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-provider': 'anthropic' },
        body: JSON.stringify({ model: 'claude-sonnet-5', max_tokens: 3000, stream: false, system: L3_SYSTEM, messages: [{ role: 'user', content: JSON.stringify(inputs) }] }),
        ...(ac ? { signal: ac.signal } : {}),
      }).then(function (res) { return res.json().catch(function () { return null; }); }).then(function (j) {
        clearTimeout(timer);
        // BILLING-CASCADE-001 follow-through: the proxy now falls back to a
        // FUNDED provider when the shared anthropic key is out of credit, so
        // the answer can arrive in OpenAI/Mistral (choices[]) or Gemini
        // (candidates[]) shape — read all three, not just Anthropic's.
        var raw = (j && j.content && j.content[0] && j.content[0].text) ||
          (j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) ||
          (j && j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0] && j.candidates[0].content.parts[0].text) || '';
        var arr; try { arr = JSON.parse(String(raw).replace(/```json|```/g, '').trim()); } catch (_) { arr = null; }
        if (!Array.isArray(arr) || arr.length !== fresh.length) {
          try { console.warn('[orphan-preflight] unusable LLM response'); } catch (_) {}
          summary.l3 = 'bad-response'; summary.ms = Date.now() - t0; return summary;
        }
        for (var i = 0; i < fresh.length; i++) {
          var r = fresh[i], tg = r.tg;
          var short = String(arr[i] == null ? '' : arr[i]).trim();
          if (!safeRewrite(r.text, short, r.facts)) continue;
          if (tg.get() !== r.text) continue;              // payload changed underneath — never write blind
          // RE-MEASURE gate (§9 + v3): the rewrite must not runt and must not
          // gain a line (a LENGTHENED rewrite fills the runt line — it must
          // never grow the paragraph); a rewrite that runts but NBSP-binds
          // clean is accepted bound.
          var lines;
          try { lines = measureTarget(measure, tg, short); } catch (_) { lines = []; }
          // rule 46: an over-long bullet's rewrite must fit the HARD cap, not
          // merely avoid growing; runt rewrites keep the no-gain rule.
          var lineCap = r.maxLines || r.baseLines;
          if (lines.length > lineCap) continue;
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
    JUSTIFY_MIN: JUSTIFY_MIN,
    _metricsFromPayload: metricsFromPayload,
    _collectTargets: collectTargets,
    _toDisplayHtml: toDisplayHtml,
    _bindLastN: bindLastN,
    _bindableSpaces: bindableSpaces,
    _isRuntLines: isRuntLines,
    _hasUnderfilledMidline: hasUnderfilledMidline,
    _safeShorten: safeShorten,
    _safeRewrite: safeRewrite,
    _kernelFactsFor: kernelFactsFor,
    _packTokens: packTokens,
    _packSidebar: packSidebar,
    _applyLeftOverride: applyLeftOverride,
    _tryL2: tryL2,
    _mirrorRewrite: mirrorRewrite,
    _domMeasureLines: domMeasureLines,
    _hash: hash,
  };
})();
