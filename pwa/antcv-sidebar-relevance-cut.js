/* antcv-sidebar-relevance-cut.js — SIDEBAR-RELEVANCE-CUT-001 (owner 2026-07-03)
 * ============================================================================
 * Owner (Trackman review): "the last sessions did not result in a much shorter
 * sidebar … why did recommendations wander to page 3?" The Trackman export
 * kept EVERY tools category and ~21 regulatory rows (STANAG weapon-sight rows
 * for a sports-tracking JD); the spilling sidebar dragged Languages/Interests/
 * Accessibility/Recommendations onto page 3. The 1.51.113 gen-prompt rules
 * (line economy + spec rules 11/15/32) were ignored by the model — the THIRD
 * proven prompt-only failure, so per rule 38 this is now a deterministic BELT.
 *
 * WHAT IT DOES (targeted applications only — meta.company real AND a JD is
 * attached): JD-relevance cut over the three non-exempt sidebar sections, in
 * STORED sections (preview + export parity; per-application by construction;
 * everything is HIDDEN, never deleted — sections-hide-over-delete):
 *
 *  TOOLS (rule 15/32, rich_block {b,t} after RICHBLOCK-SHAPE-001 or {l,v}):
 *    per comma-token cut — a token survives when one of its words appears in
 *    the JD (rule 1 force-keep falls out of this); trimmed tokens are upserted
 *    into the per-application "Hidden - <category>" review row (the
 *    TOOLS-HIDDEN-RESIDUE family renders/restores them — one-click recovery);
 *    a row with ZERO surviving tokens is hidden whole (rich: section hidden
 *    map; labeled: it.hidden).
 *  CERTIFICATES (rule 25, list of strings): an item survives on direct JD
 *    word overlap or a DOMAIN BRIDGE hit (quality/risk/PM …); language and
 *    sport certificates never survive a targeted cut. Hidden via the
 *    section-level hidden index map (the eye-toggle's own mechanism).
 *  REGULATORY (rules 27 + 19, labeled_list or rich_block): a row survives on
 *    direct overlap, a domain-trigger hit (its detected domain's trigger words
 *    appear in the JD), or NO detected domain (conservative default-keep).
 *    When ≤6 content rows survive, group sub-headers are hidden too (rule 19:
 *    few items → ONE flat list).
 *
 * EXEMPT (rule 11): interests, languages, accessibility — never touched.
 *
 * ONE-SHOT per application+JD: a stamp (antcv:sidebarCutStamp) records the
 * app+JD hash after a pass; the belt never re-fights a user's un-hide for the
 * same application (the eyes + Hidden-group family stay authoritative). A new
 * JD or app produces a new stamp and a fresh pass.
 * Loop-safe: write-only-on-change, own event tagged, setTimeout debounce
 * (never rAF — STICKY-LEAK-005).
 * Kill: localStorage['antcv:disable-sidebar-relevance-cut']='1'.
 */
(function () {
  'use strict';
  var VERSION = '1.51.126-cut-v2-pm-bridge';
  if (window.__antcvSidebarRelevanceCut) return;
  window.__antcvSidebarRelevanceCut = VERSION;

  var SRC = 'sidebar-relevance-cut';
  var STAMP_KEY = 'antcv:sidebarCutStamp';
  var PREFIX = 'Hidden - ';
  var RESIDUE_RE = /^\s*hidden\s*[-–—:]\s*/i;
  var FLAT_MAX = 6; // rule 19: this many or fewer surviving rows -> flatten sub-headers

  // EN + DA words that carry no relevance signal.
  var STOP = {};
  ('the and for with our your you will are this that from into have has being such als can our who what when where why how all any per not may out its within across'
    + ' og for med vores din dig vil er det den fra har kan alle hvor').split(' ').forEach(function (w) { STOP[w] = 1; });

  function disabled() { try { var v = localStorage.getItem('antcv:disable-sidebar-relevance-cut'); return v === '1' || v === 'true'; } catch (_) { return false; } }
  function readJson(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (_) { return d; } }

  function norm(s) {
    return String(s == null ? '' : s).replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function words(s) {
    return norm(s).split(' ').filter(function (w) { return w.length >= 3 && !STOP[w]; });
  }
  function tokensOf(v) {
    var raw = Array.isArray(v) ? v.join(', ') : String(v == null ? '' : v);
    return raw.split(/[,;]/).map(function (t) { return t.trim(); }).filter(function (t) { return t.length >= 2 && t.indexOf('[') === -1; });
  }
  // Shape helpers (RICHBLOCK-SHAPE-001) — prefer the residue sidecar's own.
  function H() { return window.AntcvToolsHiddenResidue || {}; }
  function labelOf(it) { var h = H(); if (h._labelOf) return h._labelOf(it); return it && typeof it === 'object' ? (it.l != null ? it.l : (it.b != null ? it.b : '')) : ''; }
  function valOf(it) { var h = H(); if (h._valOf) return h._valOf(it); return it && typeof it === 'object' ? (it.v != null ? it.v : (it.t != null ? it.t : '')) : (it == null ? '' : it); }
  function isGroupRow(it) { return !!(it && typeof it === 'object' && (it.group !== undefined || it.grp || it.subhead !== undefined || it.header !== undefined || it.category !== undefined)); }
  function isRichItem(it) { return !!(it && typeof it === 'object' && it.l == null && it.v == null && (it.b !== undefined || it.t !== undefined)); }
  function setVal(it, v) { return (it.v != null || it.l != null) ? Object.assign({}, it, { v: v }) : Object.assign({}, it, { t: v }); }
  function isResidue(it) { return !!(it && typeof it === 'object' && !isGroupRow(it) && RESIDUE_RE.test(String(labelOf(it)))); }

  // ── JD word set ─────────────────────────────────────────────────────────────
  function jdText() { try { return String(localStorage.getItem('antcv:lastJdText') || ''); } catch (_) { return ''; } }
  function jdSetOf(jd) {
    var set = {};
    norm(jd).split(' ').forEach(function (w) { if (w.length >= 3 && !STOP[w]) set[w] = 1; });
    return set;
  }
  function wordHits(text, jdSet) {
    var ws = words(text);
    for (var i = 0; i < ws.length; i++) {
      var w = ws[i];
      if (jdSet[w]) return true;
      if (jdSet[w + 's']) return true;
      if (w.charAt(w.length - 1) === 's' && jdSet[w.slice(0, -1)]) return true;
    }
    return false;
  }

  // ── domain lexicons ─────────────────────────────────────────────────────────
  // A row/item DETECTS a domain via its own text; the domain SURVIVES when any
  // of its JD trigger words appear in the JD. Rows with no detected domain and
  // no direct overlap are default-KEPT for regulatory (conservative) and
  // default-CUT for certificates (rule 25 is the aggressive one).
  var DOMAINS = [
    { id: 'automotive', row: /aspice|automotive|26262|21448|21434|sotif|cispr\s*25|iso\s*16750|11452|\bvda\b/i, jd: /automotive|vehicle|\badas\b|\bcars?\b/i },
    { id: 'weapons', row: /stanag|weapon|ballistic|fire.control/i, jd: /weapon|defen[cs]e|military|sight|ballistic/i },
    { id: 'military-env', row: /mil.std/i, jd: /military|defen[cs]e|rugged/i },
    { id: 'imaging', row: /12233|15739|emva|14524|imag(e|ing)|resolution|machine.vision|camera/i, jd: /camera|vision|imag(e|ing)|optic/i },
    { id: 'laser', row: /60825|laser/i, jd: /laser/i },
    { id: 'environmental', row: /60068|environmental|60529|ingress|810g|durability/i, jd: /environmental|durab|rugged|outdoor|field|weather/i },
    { id: 'electrical-lab', row: /61010|electrical safety|lab.*equipment|measurement equipment/i, jd: /\blabs?\b|electrical|measurement|test equipment/i },
    { id: 'emc', row: /\bemc\b|cispr|emissions|immunity/i, jd: /\bemc\b|electromagnetic|\bce\b|\bfcc\b|\bul\b|certification/i },
    { id: 'chemical', row: /rohs|reach|substances/i, jd: /rohs|reach|chemical|certification|compliance/i },
    { id: 'safety', row: /functional safety|61508/i, jd: /functional safety|safety.critical/i },
    // certificate bridges
    { id: 'quality', row: /six sigma|fmea|apis|8d|quality|gage|msa|spc/i, jd: /quality|process|manufactur|production|risk/i },
    { id: 'pm', row: /pmp|prince2?|project management|agile|scrum/i, jd: /project manag|agile|scrum|pmp/i },
    // PM-TOOLS-BRIDGE (owner 2026-07-04 Trackman review 3: "many tools relevant
    // for project management are hidden" — Jira/Codebeamer/MS Project never
    // appear LITERALLY in a JD that says "project management methodologies").
    { id: 'pm-tools', row: /\bjira\b|confluence|codebeamer|\balm\b|(?:ms|microsoft)\s+project|gantt|power\s?bi|\bexcel\b|risk register|stakeholder|prioriti[sz]ation|planning|roadmap/i, jd: /project manag|program manag|agile|scrum|planning|stakeholder|prioriti|risk|roadmap|timeline/i },
    { id: 'requirements-tools', row: /requirements|traceability|change (?:governance|management|control)|\bccb\b|enterprise architect|doors\b/i, jd: /requirement|traceab|change|specification|architecture/i },
    { id: 'ai', row: /\bai\b|copilot|machine learning|llm/i, jd: /\bai\b|machine learning|\bml\b|artificial intelligence|data.driven/i },
    { id: 'business-analysis', row: /babok|business analysis/i, jd: /business analys/i },
  ];
  // rule 25: language + sport certificates NEVER survive a targeted cut.
  var CERT_ALWAYS_CUT = /pr(ø|o)ve i dansk|sprogskole|language course|world rugby|coaching|concussion|first.aid|sport/i;

  function domainSurvives(text, jd) {
    var hitAny = false;
    for (var i = 0; i < DOMAINS.length; i++) {
      var d = DOMAINS[i];
      if (!d.row.test(text)) continue;
      hitAny = true;
      if (d.jd.test(jd)) return { detected: true, survives: true };
    }
    return { detected: hitAny, survives: false };
  }

  // ── residue upsert (tools trims stay one-click recoverable) ────────────────
  function upsertResidue(items, richSection, category, toks) {
    if (!toks.length) return items;
    var idx = -1;
    for (var i = 0; i < items.length; i++) {
      if (isResidue(items[i]) && norm(String(labelOf(items[i])).replace(RESIDUE_RE, '')) === norm(category)) { idx = i; break; }
    }
    if (idx >= 0) {
      var cur = tokensOf(valOf(items[idx]));
      var seen = {};
      cur.forEach(function (t) { seen[norm(t)] = 1; });
      toks.forEach(function (t) { if (!seen[norm(t)]) { seen[norm(t)] = 1; cur.push(t); } });
      items[idx] = setVal(items[idx], cur.join(', '));
    } else {
      items.push(richSection ? { b: PREFIX + category, t: toks.join(', '), bullets: [] } : { l: PREFIX + category, v: toks.join(', '), hidden: true });
    }
    return items;
  }

  // ── section passes (pure; return true when changed) ────────────────────────
  // rule 32 keep test — per VALUE token: a direct JD word hit OR a domain
  // bridge (PM-TOOLS-BRIDGE: "Jira" survives a "project management" JD even
  // though the word Jira never appears in the ad).
  function tokenKeeps(t, jdSet, jd) {
    if (wordHits(t, jdSet)) return true;
    var d = domainSurvives(t, jd);
    return d.detected && d.survives;
  }
  function cutTools(sec, jdSet, jd) {
    if (!Array.isArray(sec.items)) return false;
    var richSection = sec.items.some(function (it) { return isRichItem(it) && !isGroupRow(it); });
    var changed = false;
    var items = sec.items.slice();
    var hiddenMap = (sec.hidden && typeof sec.hidden === 'object') ? Object.assign({}, sec.hidden) : {};
    // HEAL pass (owner Trackman review 3): a re-armed cut first RESTORES residue
    // tokens that pass the current keep test back into their category rows —
    // an earlier over-aggressive pass parked PM tools in "Hidden -" rows; the
    // improved bridge brings them home (insertBest keeps line economy).
    var IB = H()._insertBest;
    for (var r = items.length - 1; r >= 0; r--) {
      var res = items[r];
      if (!isResidue(res)) continue;
      var category = String(labelOf(res)).replace(RESIDUE_RE, '').trim();
      var resToks = tokensOf(valOf(res));
      var back = resToks.filter(function (t) { return tokenKeeps(t, jdSet, jd); });
      if (!back.length) continue;
      var target = -1;
      for (var j = 0; j < items.length; j++) {
        if (j === r || !items[j] || typeof items[j] !== 'object' || isGroupRow(items[j]) || isResidue(items[j])) continue;
        if (norm(labelOf(items[j])) === norm(category)) { target = j; break; }
      }
      if (target >= 0) {
        var rowToks = tokensOf(valOf(items[target]));
        back.forEach(function (t) { if (rowToks.map(norm).indexOf(norm(t)) === -1) rowToks = IB ? IB(category, rowToks, t) : rowToks.concat([t]); });
        items[target] = setVal(items[target], rowToks.join(', '));
        if (hiddenMap[target]) delete hiddenMap[target];              // healing un-hides the row
        if (items[target].hidden === true) items[target] = Object.assign({}, items[target], { hidden: false });
      } else {
        items.splice(r, 0, richSection ? { b: category, t: back.join(', '), bullets: [] } : { l: category, v: back.join(', ') });
        r++; // res shifted right
      }
      var remain = resToks.filter(function (t) { return !tokenKeeps(t, jdSet, jd); });
      var resIdx = items.indexOf(res);
      if (remain.length) items[resIdx] = setVal(res, remain.join(', '));
      else items.splice(resIdx, 1);
      changed = true;
    }
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it !== 'object' || isGroupRow(it) || isResidue(it)) continue;
      if (it.hidden === true || hiddenMap[i]) continue;
      var label = String(labelOf(it));
      var toks = tokensOf(valOf(it));
      if (!toks.length) continue;
      var keep = [], drop = [];
      toks.forEach(function (t) { (tokenKeeps(t, jdSet, jd) ? keep : drop).push(t); });
      if (!drop.length) continue;
      if (keep.length) {
        items[i] = setVal(it, keep.join(', '));
      } else {
        // zero survivors: hide the whole row, keep its value intact for restore
        if (isRichItem(it)) hiddenMap[i] = true;
        else items[i] = Object.assign({}, it, { hidden: true });
        drop = [];   // the row itself is the recoverable unit — no residue needed
      }
      if (drop.length) items = upsertResidue(items, richSection, label, drop);
      changed = true;
    }
    // EMPTY-GROUP-HIDE (owner: "if the entire tools group is gone something is
    // wrong" — a group header must never stand over nothing, in preview OR
    // export). A grp row whose every following content row (until the next grp)
    // is hidden gets hidden too; a group with visible rows stays.
    var isHiddenAt = function (idx) {
      var x = items[idx];
      return !!(hiddenMap[idx] || (x && x.hidden === true) || isResidue(x));
    };
    for (var g = 0; g < items.length; g++) {
      if (!isGroupRow(items[g])) continue;
      var any = false;
      for (var k = g + 1; k < items.length && !isGroupRow(items[k]); k++) {
        if (items[k] && typeof items[k] === 'object' && !isHiddenAt(k)) { any = true; break; }
      }
      var gHidden = !!(hiddenMap[g] || (items[g] && items[g].hidden === true));
      if (!any && !gHidden) {
        if (items[g] && items[g].grp) hiddenMap[g] = true;
        else items[g] = Object.assign({}, items[g], { hidden: true });
        changed = true;
      } else if (any && gHidden) {
        if (hiddenMap[g]) delete hiddenMap[g];
        if (items[g] && items[g].hidden === true) items[g] = Object.assign({}, items[g], { hidden: false });
        changed = true;
      }
    }
    if (!changed) return false;
    sec.items = items;
    if (Object.keys(hiddenMap).length) sec.hidden = hiddenMap;
    return true;
  }

  function cutCerts(sec, jdSet, jd) {
    if (!Array.isArray(sec.items)) return false;
    var hiddenMap = (sec.hidden && typeof sec.hidden === 'object') ? Object.assign({}, sec.hidden) : {};
    var changed = false;
    sec.items.forEach(function (it, i) {
      if (hiddenMap[i]) return;
      var text = typeof it === 'string' ? it : String((it && (it.text || it.title || it.name)) || '');
      if (!text.trim() || text.indexOf('[') !== -1) return;
      if (CERT_ALWAYS_CUT.test(text)) { hiddenMap[i] = true; changed = true; return; }
      if (wordHits(text, jdSet)) return;
      var d = domainSurvives(text, jd);
      if (d.survives) return;
      hiddenMap[i] = true; changed = true;   // rule 25: no JD mapping -> cut
    });
    if (changed) sec.hidden = hiddenMap;
    return changed;
  }

  function cutRegulatory(sec, jdSet, jd) {
    if (!Array.isArray(sec.items)) return false;
    var changed = false;
    var items = sec.items.slice();
    var hiddenMap = (sec.hidden && typeof sec.hidden === 'object') ? Object.assign({}, sec.hidden) : {};
    var visibleContent = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || typeof it !== 'object' || isGroupRow(it) || isResidue(it)) continue;
      if (it.hidden === true || hiddenMap[i]) continue;
      var text = String(labelOf(it)) + ' ' + String(valOf(it));
      if (!text.trim() || text.indexOf('[') !== -1) { visibleContent++; continue; }
      if (wordHits(text, jdSet)) { visibleContent++; continue; }
      var d = domainSurvives(text, jd);
      if (!d.detected || d.survives) { visibleContent++; continue; }   // unknown domain: conservative keep
      if (isRichItem(it)) hiddenMap[i] = true;
      else items[i] = Object.assign({}, it, { hidden: true });
      changed = true;
    }
    // rule 19: few surviving rows -> ONE flat list (hide the group sub-headers)
    if (visibleContent > 0 && visibleContent <= FLAT_MAX) {
      for (var g = 0; g < items.length; g++) {
        var gr = items[g];
        if (!isGroupRow(gr) || hiddenMap[g] || (gr && gr.hidden === true)) continue;
        if (gr && typeof gr === 'object' && gr.grp) hiddenMap[g] = true;
        else items[g] = Object.assign({}, gr, { hidden: true });
        changed = true;
      }
    }
    if (!changed) return false;
    sec.items = items;
    if (Object.keys(hiddenMap).length) sec.hidden = hiddenMap;
    return true;
  }

  // ── the pass ────────────────────────────────────────────────────────────────
  function hash(s) { var h = 0; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0; return h; }
  function isTargeted(m) {
    var c = String((m && m.company) || '').trim();
    return !!c && !(window.__ANTCV_UNSOL_RE || /^unsolicited$/i).test(c) && !/^open application$/i.test(c); // UNSOL-PILLAR-LANG-001: any language variant
  }

  function apply() {
    if (disabled()) return;
    try {
      var m = readJson('meta', {});
      if (!isTargeted(m)) return;
      var jd = jdText();
      if (jd.trim().length < 30) return;
      // CUT_VERSION salts the stamp: shipping an improved cut re-arms every
      // app ONCE (v2 = PM-tools bridge + empty-group hide + residue heal — the
      // owner's over-cut Trackman state repairs itself on next boot).
      var stamp = String(hash('v2|' + String(m.company) + '|' + String(m.role || '') + '|' + jd.slice(0, 2000)));
      var b = readJson('sections', null);
      if (!b || !Array.isArray(b.cv)) return;
      // STAMP-IN-BLOB (owner 2026-07-04 "the fuck?" — a stale row/cloud restore
      // reverted the Trackman sections to the pre-cut snapshot while the SIDE-KEY
      // stamp survived, so the cut never re-ran and the full 24-row regulatory
      // came back). The stamp now travels INSIDE the sections blob: a restored
      // pre-cut snapshot lacks it -> the cut re-arms automatically; a post-cut
      // blob (incl. later user un-hides) carries it -> never re-fought. The side
      // key stays as a secondary gate for blob writers that rebuild the root.
      // A missing blob stamp ALWAYS re-runs (the owner's live state: side key
      // stamped v2, blob = restored stale content — the side key alone must
      // never veto). The pass is idempotent on already-cut content, and the
      // heal pass restores bridge-passing tokens, so a re-run is safe.
      try { if (b._sidebarCutStamp === stamp) return; } catch (_) {}
      var jdSet = jdSetOf(jd);
      var changed = false, counts = {};
      b.cv.forEach(function (sec) {
        if (!sec || sec.on === false || sec.loc !== 'sidebar') return;
        var id = String(sec.id || '');
        if (id === 'tools' && cutTools(sec, jdSet, jd)) { changed = true; counts.tools = 1; }
        else if (id === 'certs' && cutCerts(sec, jdSet, jd)) { changed = true; counts.certs = 1; }
        else if (id === 'regulatory' && cutRegulatory(sec, jdSet, jd)) { changed = true; counts.regulatory = 1; }
      });
      // The stamp is written even when nothing changed — the decision for this
      // app+JD is made; user un-hides are never re-fought. STAMP-IN-BLOB: the
      // blob field is the authoritative gate (travels through row saves and
      // restores); the sections blob is therefore written once even when the
      // content itself needed no change.
      b._sidebarCutStamp = stamp;
      try { localStorage.setItem(STAMP_KEY, stamp); } catch (_) {}
      try { localStorage.setItem('sections', JSON.stringify(b)); } catch (_) {}
      if (changed) {
        try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: SRC } })); } catch (_) {}
        try { console.log('[sidebar-relevance-cut] JD-relevance cut applied (' + Object.keys(counts).join(', ') + ') for "' + m.company + '"'); } catch (_) {}
      }
    } catch (_) {}
  }

  var pending = false;
  function tick() { if (pending) return; pending = true; setTimeout(function () { pending = false; try { apply(); } catch (_) {} }, 300); }

  [1200, 3000, 6000].forEach(function (d) { setTimeout(tick, d); });
  try { window.addEventListener('antcv:sections-updated', function (e) { if (!(e && e.detail && e.detail.source === SRC)) tick(); }); } catch (_) {}
  try { window.addEventListener('storage', function (e) { if (!e || e.key === 'sections' || e.key === 'meta' || e.key === 'antcv:lastJdText' || e.key === null) tick(); }); } catch (_) {}
  setInterval(tick, 6000);

  window.AntcvSidebarRelevanceCut = {
    version: VERSION,
    _apply: apply,
    _cutTools: cutTools,
    _cutCerts: cutCerts,
    _cutRegulatory: cutRegulatory,
    _jdSetOf: jdSetOf,
    _wordHits: wordHits,
    _domainSurvives: domainSurvives,
    _tokensOf: tokensOf,
  };
})();
