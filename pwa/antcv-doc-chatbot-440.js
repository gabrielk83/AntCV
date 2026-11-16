/* AntCV document-wide chatbot (v1.50.440)
 * ============================================================================
 * DOC-WIDE-CHATBOT-001 (owner 2026-06-13). The per-element chatbot
 * (antcv-preview-chatbot-405.js) needs a TEXT SELECTION to raise its pill — on
 * mobile that collides with the browser's long-press menu, and on desktop it's
 * easy to miss. This adds an ALWAYS-VISIBLE "Ask AI" launcher and a
 * DOCUMENT-WIDE chat: the user can ask about / edit the whole CV or cover letter
 * in one place, and the assistant can propose edits across MANY sections at once
 * (cross-section apply), each applied with undo.
 *
 * One buffered LLM call per turn through the same path the per-element chatbot
 * and generation use: POST {proxyBase}/  (x-provider: anthropic), with the
 * access-relay fallback so DEMO users work too. The assistant returns
 * {reply, edits:[{sid, find, replace, why}]}; `find` is an exact substring in
 * that section, so apply is schema-agnostic and safe (locate-then-replace, with
 * a per-edit snapshot for undo). No fetch wrap.
 */
/* ASKAI-EXPAND-001 (owner 2026-08-16, v1.51.4146): the assistant now also
 * (a) grounds content suggestions in the CANDIDATE PROFILE (personalInfo work
 *     style / personality / staged kernel) and the APPLICATION HISTORY
 *     (relay GET /api/applications, cached, best-effort),
 * (b) proposes VISUAL STYLE changes — header element colors
 *     (AntcvHeaderColors), header band (AntcvQuickDocColor), styleConfig
 *     colors/fonts (window._antcvPatchStyleConfig) and font sizes
 *     (window._antcvStepFontSize) — via a "style":[...] op list in the same
 *     STRICT-JSON contract, each rendered as an Apply/Undo card exactly like
 *     text edits, and
 * (c) buffers text/event-stream responses (the cv-proxy forces stream:true for
 *     BYOK/owner accounts — ASKAI-SSE-001 pattern from JobTracker/api.ts).
 */
/* ASKAI-INSIGHT-001 (owner 2026-11-16, v1.51.6585): "new inputs from contacts should
 * be verified against the full files and impact the cv and cl." The panel gets an
 * "Insight" mode: paste a message from a hiring contact (optionally their name and
 * role). One LLM call receives:
 *   - a digest of the FULL kernel (every role id, title, company, bullets, results,
 *     outcomes, proofPointsByRole, selectedOutcomes, proofPoints, tools, skills),
 *     priority-trimmed to DIGEST_CAP chars (bullets of shown roles go first, skills
 *     last), so a fact in bullet 7 of a role can be cited;
 *   - BOTH documents (cv and cl), so one insight edits both.
 * It returns {reply, insights:[{point, support:[{role, fact}]}], edits:[{doc, sid,
 * find, replace, why, cites}], questions}. The client checks every cited fact
 * against the full kernel (verbatim or 80 % token cover in one source string) and
 * flags numbers in a replacement that neither the old text nor the kernel holds.
 * "Apply all" takes only edits whose facts check out. Gaps come back as questions.
 * The insight is saved per row at AntcvJdScope.nsKey('insights', <row id>); the
 * analysis-persist sidecar round-trips it in the row's analysis_extra column, and
 * antcv-bullet-targets.js appends insightsPromptBlock() to full generations whose
 * JD names the same company, so a regeneration keeps it.
 * Reads/writes of `sections` stay on localStorage, which antcv-tab-doc-isolation.js
 * serves from this tab's own shadow (TAB-DOC-LEASE-001).
 */
(function () {
  'use strict';
  var VERSION = '1.51.6585';
  if (window.__antcvDocChatbot440 === VERSION) return;
  window.__antcvDocChatbot440 = VERSION;

  var LAUNCH_ID = 'antcv-doc-chatbot-launch';
  var PANEL_ID = 'antcv-doc-chatbot-panel';
  var MODEL = 'claude-sonnet-5';   // SONNET-5-DROP-IN-001 (2026-07): cheaper ($3/$15 vs Opus $5/$25) AND faster for interactive Q&A; proxy normalizer sends thinking:disabled so the 1100 budget stays on the response

  function readJSON(k) { try { var r = localStorage.getItem(k); return r ? JSON.parse(r) : null; } catch (_) { return null; } }
  function activeDoc() { var d = readJSON('doc'); return d === 'cl' ? 'cl' : 'cv'; }
  function proxyBase() {
    // DEMO / relay: proxyUrl, then localStorage.relayUrl (antcv-auth), then the
    // window global (relay-config.json) — same resolver the app + the per-element
    // chatbot use, so demo/relay users reach the LLM.
    function read(k) {
      var v = '';
      try { v = localStorage.getItem(k) || ''; } catch (_) {}
      try { if (v && v.charAt(0) === '"') v = JSON.parse(v); } catch (_) {}
      return String(v || '').replace(/\/+$/, '');
    }
    var b = read('proxyUrl') || read('relayUrl');
    if (!b && typeof window.ANTCV_RELAY_URL === 'string') b = String(window.ANTCV_RELAY_URL).replace(/\/+$/, '');
    return b;
  }
  function inEditor() {
    try { return readJSON('step') === 'editor' && !!document.querySelector('.antcv-preview-paper, [data-antcv-document-main]'); }
    catch (_) { return false; }
  }

  // ─── document context + rules ──────────────────────────────────────────────
  function flattext(node, out, cap) {
    if (out.s.length > cap || node == null) return;
    if (typeof node === 'string') { var t = node.trim(); if (t) out.s.push(t); return; }
    if (Array.isArray(node)) { for (var i = 0; i < node.length; i++) flattext(node[i], out, cap); return; }
    if (typeof node === 'object') { for (var k in node) { if (Object.prototype.hasOwnProperty.call(node, k) && k !== 'id' && k !== 'title' && k !== 'loc' && k !== 'type') flattext(node[k], out, cap); } }
  }
  // doc: 'cv' | 'cl' (default: the active one). opts.sec / opts.total: char caps
  // (insight mode raises them so the experience section's bullets are quotable).
  function docContext(doc, opts) {
    var all = readJSON('sections') || {};
    var arr = all[doc === 'cl' || doc === 'cv' ? doc : activeDoc()] || [];
    var secCap = (opts && opts.sec) || 1000, total = (opts && opts.total) || 6000;
    var lines = [];
    for (var i = 0; i < arr.length; i++) {
      var sec = arr[i]; if (!sec || sec.on === false) continue;
      var out = { s: [] }; flattext(sec, out, secCap + 200);
      var body = out.s.join(' · ').slice(0, secCap);
      if (body) lines.push('[' + (sec.id || ('sec' + i)) + '] ' + (sec.title || '') + ': ' + body);
    }
    return lines.join('\n').slice(0, total);
  }
  function rules() {
    var pi = readJSON('personalInfo') || {}; var sp = pi.stylePrefs || {};
    var sc = readJSON('styleConfig') || {};
    var lang = String(readJSON('language') || 'en').toLowerCase();
    var langName = { en: 'English', da: 'Danish', es: 'Spanish', zh: 'Chinese' }[lang.slice(0, 2)] || 'English';
    var r = ['Write in ' + langName + '.'];
    var banned = String(sp.banned_words || sc.bannedWords || '').trim();
    if (banned) r.push('Never use these banned words: ' + banned + '.');
    var bp = String(sp.banned_phrases || '').trim();
    if (bp) r.push('Never use these banned phrases: ' + bp + '.');
    if (!banned && !bp) r.push('Avoid corporate cliches (spearhead, synergy, leverage, passionate, results-driven).');
    r.push('Plain text only (ATS-friendly) — no markdown, no emoji unless the original had them.');
    r.push('Do not invent facts, employers, dates, numbers, titles, or credentials.');
    return r;
  }
  // ── ASKAI-EXPAND-001: candidate profile + application history + visual state ─
  function kernelContext() {
    try {
      var pi = readJSON('personalInfo') || {};
      var bits = [];
      if (pi.name) bits.push('Name: ' + pi.name);
      if (pi.specialization) bits.push('Specialization: ' + pi.specialization);
      var ws = pi.workStyle || {};
      if (ws.summary) bits.push('Work style: ' + String(ws.summary).slice(0, 300));
      else if (Array.isArray(ws.keywords) && ws.keywords.length) bits.push('Work style: ' + ws.keywords.slice(0, 8).join(', '));
      var p = pi.personality;
      if (p && typeof p === 'object') {
        var ps = p.summary || p.kernel || '';
        if (ps) bits.push('Personality: ' + String(ps).slice(0, 300));
      }
      var mk = readJSON('antcv:ingestedKernel');
      if (mk && mk.identity && mk.identity.headline) bits.push('Headline: ' + String(mk.identity.headline).slice(0, 200));
      return bits.join('\n').slice(0, 1200);
    } catch (_) { return ''; }
  }
  var histCache = '', histAt = 0;
  function refreshHistory() {
    var base = proxyBase(); if (!base) return;
    var now = Date.now();
    if (now - histAt < 120000) return;   // 2 min cache
    histAt = now;
    var hdrs = {};
    try { var tok = String(localStorage.getItem('antcv:auth:token') || '').replace(/"/g, ''); if (tok) hdrs.Authorization = 'Bearer ' + tok; } catch (_) {}
    window.fetch(base + '/api/applications', { credentials: 'include', headers: hdrs })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        var rows = (j && Array.isArray(j.applications)) ? j.applications : [];
        histCache = rows.slice(0, 15).map(function (a) {
          return '- #' + a.id + ' ' + (a.jd_company || 'Unsolicited') + ' — ' + (a.jd_role || '') + (a.category ? ' [' + a.category + ']' : '');
        }).join('\n').slice(0, 1500);
      }).catch(function () { /* best-effort — the prompt just omits history */ });
  }
  function historyContext() { return histCache; }

  // ── ASKAI-INSIGHT-001: full kernel digest + fact check ─────────────────────
  // ~7K tokens. Kernel v13s (13 roles) digests to 31K chars untrimmed; at 28K only
  // part of the 120-item skills list and the hidden roles drop out.
  var DIGEST_CAP = 28000;
  function kernelSource() {
    var pi = readJSON('personalInfo');
    if (pi && pi.personalInfo && typeof pi.personalInfo === 'object') pi = pi.personalInfo;
    if (pi && Array.isArray(pi.experience) && pi.experience.length) return pi;
    var mk = readJSON('antcv:ingestedKernel');
    if (mk && mk.personalInfo && Array.isArray(mk.personalInfo.experience)) return mk.personalInfo;
    return pi || {};
  }
  function clip(s, n) { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
  // A kernel item as one line: strings as-is; objects by their text-bearing fields.
  function itemText(x) {
    if (x == null) return '';
    if (typeof x === 'string') return x.trim();
    if (typeof x === 'number') return String(x);
    if (typeof x !== 'object' || Array.isArray(x)) return '';
    if (typeof x.text === 'string') return x.text.trim();
    if (x.t != null || x.b != null) return [x.t, x.b].filter(function (v) { return v != null && String(v).trim(); }).join(' ').trim();
    if (x.title != null || x.result != null) return [x.title, x.result].filter(function (v) { return v != null && String(v).trim(); }).join(' — ').trim();
    if (x.l != null && x.v != null) return String(x.l).trim() + ': ' + String(x.v).trim();
    if (typeof x.name === 'string') return x.name.trim();
    return '';
  }
  function list(v) { return v == null ? [] : Array.isArray(v) ? v : [v]; }
  function roleIdOf(r, i) { return String((r && (r.id || r.roleId)) || ('role' + (i + 1))); }
  function norm(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/[‐-―−]/g, '-')
      .replace(/[^\p{L}\p{N}%~]+/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  // Role-keyed proof points: {roleId:[...]} (kernel v13) or [{id, text, role|roleId}].
  function ppForRole(pi, rid, r) {
    var out = [], src = pi.proofPointsByRole;
    if (src && !Array.isArray(src) && typeof src === 'object') out = out.concat(list(src[rid]));
    var arr = [].concat(Array.isArray(src) ? src : [], Array.isArray(pi.proofPointsByPosition) ? pi.proofPointsByPosition : []);
    var ids = {}; list(r && r.proofPointIds).forEach(function (id) { ids[id] = 1; });
    arr.forEach(function (p) { if (p && typeof p === 'object' && ((p.role || p.roleId) === rid || (p.id && ids[p.id]))) out.push(p); });
    return out;
  }
  // Every role with its facts, in kernel order. Shared by the digest and the index.
  function kernelRoles(pi) {
    var so = Array.isArray(pi.selectedOutcomes) ? pi.selectedOutcomes : [];
    return list(pi.experience).map(function (r, i) {
      if (!r || typeof r !== 'object') return null;
      var rid = roleIdOf(r, i);
      return {
        id: rid, on: r.on !== false,
        head: [r.title, r.company, r.years].filter(function (v) { return v != null && String(v).trim(); }).join(' | '),
        bullets: list(r.bullets).map(itemText).filter(Boolean),
        results: list(r.results).map(itemText).filter(Boolean),
        outcomes: list(r.outcomes).map(itemText)
          .concat(so.filter(function (o) { return o && o.role === rid; }).map(itemText)).filter(Boolean),
        pp: ppForRole(pi, rid, r).map(itemText).filter(Boolean),
        raw: r,
      };
    }).filter(Boolean);
  }
  var GLOBAL_KEYS = ['proofPoints', 'toolsItems', 'tools', 'skillsInventory', 'skills', 'education', 'certifications',
    'workEvidenceArtifacts', 'researchMethodology', 'projects', 'proofPointsByProject', 'publications',
    'publicationsStructured', 'patentDescription', 'background', 'headline', 'specialization', 'regulatory', 'additional'];
  // Digest: chunks ranked by priority, taken greedily until `cap`, printed in kernel order.
  // 0 role head · 1 bullets + results of shown roles · 2 outcomes + role proof points ·
  // 3 global proof points · 4 tools + education · 5 hidden roles · 6 skills.
  function kernelDigest(pi, cap) {
    pi = pi || {}; cap = cap || DIGEST_CAP;
    var chunks = [], seq = 0;
    function add(group, prio, text, order) { var lead = /^\s*/.exec(text)[0]; text = clip(text, 240); if (text) chunks.push({ group: group, prio: prio, text: lead + text, order: order == null ? seq++ : order }); }
    kernelRoles(pi).forEach(function (r, ri) {
      var g = 'r' + ri, seen = {};
      function fresh(t) { var k = norm(t); if (!k || seen[k]) return false; seen[k] = 1; return true; }
      add(g, r.on ? 0 : 5, 'ROLE [' + r.id + '] ' + (r.head || r.id) + (r.on ? '' : ' (hidden in the CV)'), ri * 1000);
      r.bullets.forEach(function (b, bi) { if (fresh(b)) add(g, r.on ? 1 : 5, ' - ' + b, ri * 1000 + 1 + bi); });
      r.results.forEach(function (b, bi) { if (fresh(b)) add(g, r.on ? 1 : 5, ' Result: ' + b, ri * 1000 + 100 + bi); });
      r.outcomes.forEach(function (b, bi) { if (fresh(b)) add(g, r.on ? 2 : 5, ' Outcome: ' + b, ri * 1000 + 200 + bi); });
      r.pp.forEach(function (b, bi) { if (fresh(b)) add(g, r.on ? 2 : 5, ' Proof point: ' + b, ri * 1000 + 400 + bi); });
    });
    list(pi.proofPoints).map(itemText).filter(Boolean).forEach(function (t) { add('pp', 3, ' - ' + t); });
    var tools = Array.isArray(pi.toolsItems) && pi.toolsItems.length ? pi.toolsItems : list(pi.tools);
    tools.map(itemText).filter(Boolean).forEach(function (t) { add('tools', 4, ' - ' + t); });
    list(pi.education).map(function (e) {
      return e && typeof e === 'object' ? [e.degree, e.field, e.school || e.institution, e.years, e.detail || e.thesis].filter(Boolean).join(' | ') : itemText(e);
    }).filter(Boolean).forEach(function (t) { add('edu', 4, ' - ' + t); });
    var skills = list(pi.skillsInventory && pi.skillsInventory.length ? pi.skillsInventory : pi.skills).map(itemText).filter(Boolean);
    skills.forEach(function (t) { add('skills', 6, t); });
    var ranked = chunks.slice().sort(function (a, b) { return a.prio - b.prio || a.order - b.order; });
    var used = 0, keep = [];
    ranked.forEach(function (c) { var n = c.text.length + 2; if (used + n <= cap) { used += n; keep.push(c); } });
    var heads = { pp: 'PROOF POINTS', tools: 'TOOLS & METHODS', edu: 'EDUCATION', skills: 'SKILLS' };
    var groups = [], byGroup = {};
    chunks.forEach(function (c) { if (!byGroup[c.group]) { byGroup[c.group] = []; groups.push(c.group); } });
    keep.forEach(function (c) { byGroup[c.group].push(c); });
    var out = [];
    groups.forEach(function (g) {
      var cs = byGroup[g].sort(function (a, b) { return a.order - b.order; });
      if (!cs.length) return;
      if (heads[g]) out.push(heads[g] + ':');
      out.push(g === 'skills' ? ' ' + cs.map(function (c) { return c.text; }).join(', ') : cs.map(function (c) { return c.text; }).join('\n'));
    });
    return { text: out.join('\n'), dropped: chunks.length - keep.length, total: chunks.length };
  }
  // Index of EVERY kernel string (not the trimmed digest), for the fact check.
  function factIndex(pi) {
    pi = pi || {};
    var idx = { roles: {}, global: [] };
    function strings(n, out, depth) {
      if (n == null || depth > 6) return;
      if (typeof n === 'string' || typeof n === 'number') { var s = norm(n); if (s) out.push(s); return; }
      if (Array.isArray(n)) { n.forEach(function (x) { strings(x, out, depth + 1); }); return; }
      if (typeof n === 'object') Object.keys(n).forEach(function (k) { if (k.charAt(0) !== '_') strings(n[k], out, depth + 1); });
    }
    kernelRoles(pi).forEach(function (r) {
      var out = []; strings(r.raw, out, 0); r.outcomes.concat(r.pp).forEach(function (t) { strings(t, out, 0); });
      idx.roles[r.id] = out;
    });
    GLOBAL_KEYS.forEach(function (k) { strings(pi[k], idx.global, 0); });
    return idx;
  }
  function tokens(s) { return norm(s).split(' ').filter(function (w) { return w.length >= 4; }); }
  function matchOne(n, toks, s) {
    if (s.indexOf(n) >= 0) return true;
    if (toks.length < 3) return false;
    var set = {}; s.split(' ').forEach(function (w) { set[w] = 1; });
    var hit = 0; toks.forEach(function (w) { if (set[w]) hit++; });
    return hit / toks.length >= 0.8;
  }
  // -> {verified, foundIn}. The cited role is tried first, then every role and the global pool.
  function verifyFact(idx, roleId, fact) {
    var n = norm(fact); if (!idx || n.length < 8) return { verified: false, foundIn: null };
    var toks = tokens(fact);
    function inPool(pool) { for (var i = 0; i < pool.length; i++) if (matchOne(n, toks, pool[i])) return true; return false; }
    if (roleId && idx.roles[roleId] && inPool(idx.roles[roleId])) return { verified: true, foundIn: roleId };
    var ids = Object.keys(idx.roles);
    for (var j = 0; j < ids.length; j++) if (ids[j] !== roleId && inPool(idx.roles[ids[j]])) return { verified: true, foundIn: ids[j] };
    if (inPool(idx.global)) return { verified: true, foundIn: 'profile' };
    return { verified: false, foundIn: null };
  }
  // Numbers in `replace` that neither the replaced text nor a cited fact holds. Strict on
  // purpose: a number elsewhere in the kernel ("40 engineers") must not pass as a yield figure.
  function newNumbers(edit) {
    var nums = String(edit.replace || '').match(/\d+(?:[.,]\d+)?/g) || [];
    var pool = norm(edit.find) + ' ' + (edit.cites || []).map(function (c) { return norm(c.fact); }).join(' ');
    var out = [];
    nums.forEach(function (x) { var k = norm(x); if (k && !new RegExp('(^|[^0-9])' + k.replace(/[.]/g, '\\.') + '([^0-9]|$)').test(pool) && out.indexOf(x) < 0) out.push(x); });
    return out;
  }

  // ── ASKAI-INSIGHT-001: per-row insight store ───────────────────────────────
  var INSIGHT_CAP = 8;
  function rowId() {
    try { if (window.AntcvJdScope && window.AntcvJdScope.getCurrentAppId) return String(window.AntcvJdScope.getCurrentAppId() || 'kernel'); } catch (_) {}
    return 'kernel';
  }
  function insightKey(id) {
    id = id || rowId();
    try { if (window.AntcvJdScope && window.AntcvJdScope.nsKey) return window.AntcvJdScope.nsKey('insights', id); } catch (_) {}
    return 'antcv:app:' + id + ':insights';
  }
  function storedInsights(id) { var v = readJSON(insightKey(id)); return Array.isArray(v) ? v : []; }
  // rec: {from, fromRole, text, insights, questions}. Newest first, INSIGHT_CAP kept.
  function saveInsight(rec, id) {
    id = id || rowId();
    var meta = readJSON('meta') || {};
    var row = {
      id: 'ins_' + Date.now().toString(36),
      at: new Date().toISOString().slice(0, 10),
      from: clip(rec.from, 80), fromRole: clip(rec.fromRole, 80),
      company: clip(rec.company != null ? rec.company : meta.company, 80),
      role: clip(rec.role != null ? rec.role : meta.role, 120),
      text: clip(rec.text, 2000),
      points: (rec.insights || []).slice(0, 6).map(function (p) {
        return { point: clip(p.point, 300), support: (p.support || []).slice(0, 3).map(function (s) { return { role: clip(s.role, 60), fact: clip(s.fact, 300), verified: !!s.verified }; }) };
      }),
      questions: (rec.questions || []).slice(0, 5).map(function (q) { return clip(q, 300); }),
    };
    var all = [row].concat(storedInsights(id)).slice(0, INSIGHT_CAP);
    try { localStorage.setItem(insightKey(id), JSON.stringify(all)); } catch (_) { return null; }
    try { if (window.AntcvAnalysisPersist && window.AntcvAnalysisPersist.push) window.AntcvAnalysisPersist.push(); } catch (_) {}
    return row;
  }
  // Points whose support checked out, as prompt lines (never the contact's name or raw text).
  function insightLines(recs) {
    var lines = [];
    recs.forEach(function (r) {
      (r.points || []).forEach(function (p) {
        var sup = (p.support || []).filter(function (s) { return s.verified; });
        lines.push('- ' + p.point + (sup.length ? ' (backed by ' + sup.map(function (s) { return '[' + s.role + '] ' + s.fact; }).join('; ') + ')' : ' (no backing fact yet: do not claim it)'));
      });
    });
    return lines.join('\n').slice(0, 3000);
  }
  function savedInsightsContext() { return insightLines(storedInsights()); }
  // For antcv-bullet-targets.js: a block for a full generation whose JD names the
  // company the insight was saved for. '' otherwise (a new JD keeps none of it).
  var STOP = { the: 1, and: 1, a: 1, an: 1, of: 1 };
  function companyToken(co) {
    var ws = String(co || '').split(/[^\p{L}\p{N}&]+/u).filter(function (w) { return w && !STOP[w.toLowerCase()]; });
    return ws.length && ws[0].length >= 2 ? ws[0].toLowerCase() : '';
  }
  function insightsPromptBlock(bodyText) {
    var body = String(bodyText || '').toLowerCase();
    var recs = storedInsights().filter(function (r) {
      var tok = companyToken(r.company);
      return tok && new RegExp('(^|[^\\p{L}\\p{N}])' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^\\p{L}\\p{N}]|$)', 'u').test(body);
    });
    var lines = insightLines(recs);
    if (!lines) return '';
    return '\n\nCONTACT INSIGHTS (ASKAI-INSIGHT-001: what people at ' + (recs[0].company || 'the employer') + ' told the candidate about this role; each point was checked against the candidate\'s own facts):\n' + lines +
      '\nUse these points to choose which REAL evidence leads in the profile, the role bullets and the cover letter. Never quote or name the contact, and never add a fact the candidate source does not state.';
  }
  function styleContext() {
    try {
      var sc = readJSON('styleConfig') || {};
      var fs = readJSON('fontSizes') || {};
      var hb = '';
      try { hb = (window.AntcvQuickDocColor && window.AntcvQuickDocColor.get()) || ''; } catch (_) {}
      var ov = {};
      try { ov = (window.AntcvHeaderColors && window.AntcvHeaderColors.get()) || {}; } catch (_) {}
      return ('headerBg=' + (hb || sc.headerBg || 'default') +
        '; fonts: head=' + (sc.mainHeadFont || 'default') + ', body=' + (sc.mainBodyFont || 'default') +
        '; mainHeadColor=' + (sc.mainHeadColor || 'default') + '; sidebarBg=' + (sc.sidebarBg || 'default') +
        '; header element overrides=' + JSON.stringify(ov) +
        '; fontSizes=' + JSON.stringify(fs).slice(0, 300)).slice(0, 700);
    } catch (_) { return '(unknown)'; }
  }
  function buildSystem() {
    return [
      'You are an editing assistant for a job-application document (CV / cover letter) inside AntCV. You can answer questions about the document, propose concrete TEXT EDITS to specific sections, AND propose VISUAL STYLE changes (colors, fonts, font sizes).',
      '',
      'RULES (must follow):',
      rules().map(function (x) { return '- ' + x; }).join('\n'),
      '',
      'THE DOCUMENT (one line per section, prefixed with its [sid]):',
      docContext(),
      '',
      'CANDIDATE PROFILE (ground truth about the candidate — use it to ground content suggestions; never invent beyond it):',
      kernelContext() || '(none stored)',
      '',
      'APPLICATION HISTORY (the candidate\'s other applications — use for consistency and cross-application advice):',
      historyContext() || '(not loaded)',
      '',
    ].concat(savedInsightsContext() ? [
      'CONTACT INSIGHTS SAVED FOR THIS APPLICATION (what people at the employer said; keep the documents consistent with them, never name the contact):',
      savedInsightsContext(),
      '',
    ] : []).concat([
      'CURRENT VISUAL STATE:',
      styleContext(),
      '',
      'Return STRICT JSON only (no markdown fences):',
      '{"reply":"<a short conversational answer to the user>","edits":[{"sid":"<the section id>","find":"<an EXACT substring copied verbatim from that section to replace>","replace":"<the new text>","why":"<one short reason, citing the rule or the user\'s intent>"}],"style":[<zero or more style operations>]}',
      'Style operations (ONLY when the user asks for a visual change):',
      '- {"op":"headerElemColor","elem":"name|spec|contact|slogan|application","value":"#RRGGBB","why":"…"} — recolor one header element (spec = the specialization line under the name).',
      '- {"op":"headerBg","value":"#RRGGBB","why":"…"} — the header band + table-header background.',
      '- {"op":"styleConfig","patch":{"<key>":"<value>"},"why":"…"} — document style keys (colors as #RRGGBB, fonts as CSS family names): mainHeadColor, mainSubHeadColor, mainTextColor, mainLineColor, mainBulletColor, sidebarBg, sidebarHeadColor, sidebarTextColor, headerNameColor, headerSpecColor, headerContactColor, mainHeadFont, mainBodyFont, headerFont, sidebarFont.',
      '- {"op":"fontSize","key":"mainBody|mainHead|sbBody|sbHead|nameSize|contactSize|mainExp|bulletContent","delta":<pt, ±0.5 steps>,"why":"…"} — nudge a font size.',
      'Colors must keep readable contrast against their background. Only include an edit or a style op when the user asked you to change something or you are confident it improves the document within the rules. `find` MUST be copied verbatim from the section so it can be located. If you have none, return "edits":[] and "style":[]. Keep replacements within the same length range unless asked to shorten/expand.',
    ]).join('\n');
  }

  // ── ASKAI-INSIGHT-001: the insight prompt (both documents + full kernel) ────
  function buildInsightSystem(input) {
    input = input || {};
    var who = [input.from, input.fromRole].filter(function (v) { return v && String(v).trim(); }).join(', ');
    var meta = readJSON('meta') || {};
    var target = [meta.role, meta.company].filter(Boolean).join(' at ');
    return [
      'You check a message from a contact at an employer against the candidate\'s FULL profile, then adjust BOTH the CV and the cover letter for this application. You work inside AntCV; the candidate approves every edit.',
      '',
      'RULES (must follow):',
      rules().concat([
        'Use ONLY facts from CANDIDATE FACTS. For every supporting fact, copy its wording VERBATIM from that block and cite the role id in brackets after ROLE (use "profile" for facts outside a role).',
        'Never infer collaboration, ownership, scope or numbers the facts do not state. A fact that only resembles the point is not support.',
        'An insight with no supporting fact goes into "questions" (ask the candidate whether and how it applies); it never goes into the documents.',
        'Never quote or name the contact in the documents.',
        'Edits: sharpen the CV profile toward the insights; swap a weaker role bullet for a kernel bullet of THE SAME ROLE that carries an insight (keep the kernel wording, trim only for length); adjust the cover-letter paragraph that matches. At most 8 edits, strongest first.',
        '"doc" is "cv" or "cl". "find" is copied VERBATIM from that section of that document so it can be located. Keep each replacement near the length of the text it replaces.',
      ]).map(function (x) { return '- ' + x; }).join('\n'),
      '',
      'TARGET: ' + (target || '(not set)'),
      'CONTACT: ' + (who || '(not given)'),
      '',
      'THE CV (one line per section, prefixed with its [sid]):',
      docContext('cv', { sec: 2600, total: 9000 }) || '(empty)',
      '',
      'THE COVER LETTER (one line per section, prefixed with its [sid]):',
      docContext('cl', { sec: 1600, total: 6000 }) || '(empty)',
      '',
      'CANDIDATE FACTS (the full profile; role ids in brackets):',
      kernelDigest(kernelSource(), DIGEST_CAP).text || '(none stored)',
      '',
    ].concat(savedInsightsContext() ? [
      'INSIGHTS SAVED EARLIER FOR THIS APPLICATION:',
      savedInsightsContext(),
      '',
    ] : []).concat([
      'Return STRICT JSON only (no markdown fences):',
      '{"reply":"<two or three sentences: what the contact is telling the candidate and what you changed>","insights":[{"point":"<one insight in plain words>","support":[{"role":"<role id>","fact":"<verbatim fact>"}]}],"edits":[{"doc":"cv|cl","sid":"<section id>","find":"<verbatim substring>","replace":"<new text>","why":"Insight <n>: <point> - fact [<role id>]","cites":[{"role":"<role id>","fact":"<verbatim fact>"}]}],"questions":["<a question to the candidate about a gap>"]}',
    ]).join('\n');
  }

  // Pull the model text out of a proxy answer (JSON or buffered text/event-stream).
  function extractLLMText(raw, ct) {
    raw = String(raw || ''); var txt = '';
    // ASKAI-SSE-001: the cv-proxy FORCES stream:true for BYOK/owner accounts,
    // so the answer can arrive as text/event-stream — buffer and join the
    // content_block_delta text (same pattern as JobTracker/api.ts askAI).
    if (/^event:|^data:/m.test(raw.slice(0, 400)) || String(ct || '').indexOf('event-stream') >= 0) {
      raw.split('\n').forEach(function (line) {
        if (line.indexOf('data:') !== 0) return;
        var d; try { d = JSON.parse(line.slice(5).trim()); } catch (_) { d = null; }
        if (d && d.type === 'content_block_delta' && d.delta && typeof d.delta.text === 'string') txt += d.delta.text;
      });
    } else {
      var j; try { j = JSON.parse(raw); } catch (_) { j = null; }
      txt = (j && j.content && j.content[0] && j.content[0].text) || '';
    }
    return txt;
  }
  function extractJSON(txt) {
    var s = String(txt || '').replace(/```json|```/g, '').trim();
    try { return JSON.parse(s); } catch (_) {}
    var a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a >= 0 && b > a) { try { return JSON.parse(s.slice(a, b + 1)); } catch (_) {} }
    return null;
  }
  function findSection(all, doc, sid) {
    var arr = (all && all[doc]) || [];
    for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].id === sid) return arr[i];
    return null;
  }
  function sectionHas(sec, find) {
    var hit = false;
    (function walk(node) {
      if (hit || node == null) return;
      if (typeof node === 'string') { if (node.indexOf(find) >= 0) hit = true; return; }
      if (Array.isArray(node)) { for (var i = 0; i < node.length && !hit; i++) walk(node[i]); return; }
      if (typeof node === 'object') for (var k in node) { if (Object.prototype.hasOwnProperty.call(node, k)) walk(node[k]); if (hit) return; }
    })(sec);
    return hit;
  }
  // A support/cite entry: {role, fact} or "role-id: fact" or a bare fact string.
  function citeOf(x, idx) {
    if (!x) return null;
    if (typeof x === 'string') {
      var m = /^\s*\[?([A-Za-z0-9_.-]{2,40})\]?\s*[:—-]\s+(.+)$/.exec(x);
      if (m && idx && (idx.roles[m[1]] || m[1] === 'profile')) return { role: m[1], fact: m[2].trim() };
      return { role: '', fact: x.trim() };
    }
    if (typeof x !== 'object') return null;
    var fact = String(x.fact || x.text || x.quote || '').trim();
    return fact ? { role: String(x.role || x.roleId || x.id || '').replace(/^\[|\]$/g, '').trim(), fact: fact } : null;
  }
  function checkCite(c, idx) {
    var v = verifyFact(idx, c.role, c.fact);
    c.verified = v.verified; c.foundIn = v.foundIn;
    return c;
  }
  // ctx: {index, sections, active}. Pure: parses, normalises and fact-checks one answer.
  function parseInsightReply(txt, ctx) {
    ctx = ctx || {};
    var idx = ctx.index || null, all = ctx.sections || {}, active = ctx.active === 'cl' ? 'cl' : 'cv';
    var j = extractJSON(txt);
    if (!j || typeof j !== 'object') return { reply: String(txt || '').trim(), insights: [], edits: [], questions: [], parsed: false };
    var insights = (Array.isArray(j.insights) ? j.insights : []).map(function (p) {
      if (typeof p === 'string') p = { point: p };
      if (!p || typeof p !== 'object') return null;
      var point = String(p.point || p.insight || p.text || '').trim(); if (!point) return null;
      var sup = [].concat(p.support || p.facts || p.evidence || []).map(function (x) { return citeOf(x, idx); }).filter(Boolean).map(function (c) { return checkCite(c, idx); });
      return { point: point, support: sup };
    }).filter(Boolean);
    var edits = (Array.isArray(j.edits) ? j.edits : []).map(function (e) {
      if (!e || typeof e !== 'object' || !e.sid || typeof e.find !== 'string' || !e.find || typeof e.replace !== 'string') return null;
      var sid = String(e.sid), doc = e.doc === 'cl' || e.doc === 'cv' ? e.doc : '';
      if (!doc) { var inCv = !!findSection(all, 'cv', sid), inCl = !!findSection(all, 'cl', sid); doc = inCv && !inCl ? 'cv' : inCl && !inCv ? 'cl' : active; }
      var cites = [].concat(e.cites || e.facts || e.support || []).map(function (x) { return citeOf(x, idx); }).filter(Boolean).map(function (c) { return checkCite(c, idx); });
      var out = { doc: doc, sid: sid, find: e.find, replace: e.replace, why: String(e.why || '').trim(), cites: cites };
      var sec = findSection(all, doc, sid);
      out.found = !!(sec && sectionHas(sec, e.find));
      out.verified = cites.length > 0 && cites.every(function (c) { return c.verified; });
      out.newNumbers = newNumbers(out);
      return out;
    }).filter(Boolean);
    var questions = [].concat(j.questions || j.gaps || []).map(function (q) { return typeof q === 'string' ? q.trim() : String((q && (q.question || q.q)) || '').trim(); }).filter(Boolean);
    return { reply: String(j.reply || '').trim(), insights: insights, edits: edits, questions: questions, parsed: true };
  }
  // An edit "Apply all" may take: its facts check out, its text is there, no new number.
  function safeEdit(e) { return !!(e && e.found && e.verified && !(e.newNumbers && e.newNumbers.length)); }

  // ─── apply (schema-agnostic find/replace in the sections store) ─────────────
  function locateAndReplace(sec, find, replace) {
    var hit = null;
    (function walk(node) {
      if (hit || node == null) return;
      if (Array.isArray(node)) { for (var i = 0; i < node.length && !hit; i++) { if (typeof node[i] === 'string') consider(node, i, node[i]); else walk(node[i]); } return; }
      if (typeof node === 'object') { for (var k in node) { if (!Object.prototype.hasOwnProperty.call(node, k)) continue; var v = node[k]; if (typeof v === 'string') consider(node, k, v); else walk(v); if (hit) return; } }
    })(sec);
    function consider(parent, key, val) { if (!hit && val.indexOf(find) >= 0) hit = { parent: parent, key: key, val: val }; }
    if (!hit) return null;
    var old = hit.val;
    hit.parent[hit.key] = old.replace(find, replace);
    return old;
  }
  // ASKAI-INSIGHT-001: edit.doc ('cv'|'cl') picks the document, so an edit to the
  // document that is not on screen lands in its own array. app.js's sections-updated
  // handler reloads both arrays from the store. Without edit.doc: the active one.
  function applyEdit(edit) {
    var all = readJSON('sections'); if (!all) return null;
    var doc = edit && (edit.doc === 'cl' || edit.doc === 'cv') ? edit.doc : activeDoc();
    var sec = findSection(all, doc, edit.sid);
    if (!sec) return null;
    var old = locateAndReplace(sec, edit.find, edit.replace);
    if (old == null) return null;
    try { localStorage.setItem('sections', JSON.stringify(all)); } catch (_) { return null; }
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'doc-chatbot', doc: doc } })); } catch (_) {}
    return function undo() {
      var a2 = readJSON('sections'); if (!a2) return false;
      var s2 = findSection(a2, doc, edit.sid);
      if (!s2) return false;
      if (locateAndReplace(s2, edit.replace, edit.find) == null) return false;
      try { localStorage.setItem('sections', JSON.stringify(a2)); } catch (_) { return false; }
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'doc-chatbot-undo', doc: doc } })); } catch (_) {}
      return true;
    };
  }

  // ─── ASKAI-EXPAND-001: visual style ops (Apply/Undo, same contract as edits) ─
  var HEX_RE = /^#?[0-9a-fA-F]{6}$/;
  function normHex(v) { v = String(v || '').trim(); if (!HEX_RE.test(v)) return ''; return v.charAt(0) === '#' ? v : '#' + v; }
  function applyStyleOp(op) {
    try {
      if (!op || typeof op !== 'object') return null;
      if (op.op === 'headerElemColor') {
        var elems = { name: 1, spec: 1, contact: 1, slogan: 1, application: 1 };
        var c = normHex(op.value);
        if (!elems[op.elem] || !c || !window.AntcvHeaderColors) return null;
        var prev = String((window.AntcvHeaderColors.get() || {})[op.elem] || '');
        window.AntcvHeaderColors.set(op.elem, c);
        return function () { try { window.AntcvHeaderColors.set(op.elem, prev); return true; } catch (_) { return false; } };
      }
      if (op.op === 'headerBg') {
        var c2 = normHex(op.value);
        if (!c2 || !window.AntcvQuickDocColor) return null;
        var prev2 = '';
        try { prev2 = window.AntcvQuickDocColor.get() || (readJSON('styleConfig') || {}).headerBg || ''; } catch (_) {}
        window.AntcvQuickDocColor.set(c2);
        return function () { try { if (prev2) { window.AntcvQuickDocColor.set(prev2); return true; } return false; } catch (_) { return false; } };
      }
      if (op.op === 'styleConfig') {
        if (!op.patch || typeof op.patch !== 'object' || typeof window._antcvPatchStyleConfig !== 'function') return null;
        var patch = {}, prevSc = readJSON('styleConfig') || {}, prev3 = {}, n = 0;
        for (var k in op.patch) {
          if (!Object.prototype.hasOwnProperty.call(op.patch, k)) continue;
          if (!/^(main|sidebar|header|table|photo)[A-Za-z0-9]*$/.test(k)) continue; // key whitelist by region prefix
          var v = op.patch[k];
          if (typeof v !== 'string' && typeof v !== 'number') continue;
          if (/(Color|Bg)$/.test(k)) { v = normHex(v); if (!v) continue; }
          patch[k] = v; prev3[k] = prevSc[k]; n++;
        }
        if (!n) return null;
        window._antcvPatchStyleConfig(patch);
        return function () { try { window._antcvPatchStyleConfig(prev3); return true; } catch (_) { return false; } };
      }
      if (op.op === 'fontSize') {
        var d = Number(op.delta);
        if (!op.key || !isFinite(d) || d === 0 || typeof window._antcvStepFontSize !== 'function') return null;
        d = Math.max(-3, Math.min(3, d));
        window._antcvStepFontSize(String(op.key), d);
        return function () { try { window._antcvStepFontSize(String(op.key), -d); return true; } catch (_) { return false; } };
      }
      return null;
    } catch (_) { return null; }
  }
  function styleLabel(op) {
    if (op.op === 'headerElemColor') return 'Color · ' + op.elem + ' → ' + op.value;
    if (op.op === 'headerBg') return 'Header band → ' + op.value;
    if (op.op === 'styleConfig') return 'Style · ' + JSON.stringify(op.patch || {}).slice(0, 140);
    if (op.op === 'fontSize') return 'Font size · ' + op.key + ' ' + (Number(op.delta) > 0 ? '+' : '') + op.delta + 'pt';
    return String(op.op || '');
  }

  // ─── LLM ────────────────────────────────────────────────────────────────────
  var turns = []; // {role, content}
  function ask(userText) {
    var base = proxyBase();
    if (!base) return Promise.resolve({ error: 'No LLM endpoint — sign in or set a Worker URL.' });
    var msgs = turns.slice(-8).concat([{ role: 'user', content: userText }]);
    return window.fetch(base + '/', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-provider': 'anthropic' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1600, stream: false, system: buildSystem(), messages: msgs }),
    }).then(function (res) {
      return res.text().then(function (raw) { return { res: res, raw: raw }; });
    }).then(function (rr) {
      var ct = '';
      try { ct = rr.res.headers.get('content-type') || ''; } catch (_) {}
      var txt = extractLLMText(rr.raw, ct);
      var parsed; try { parsed = JSON.parse(String(txt).replace(/```json|```/g, '').trim()); } catch (_) { parsed = { reply: String(txt || '').trim(), edits: [] }; }
      if (!parsed || typeof parsed !== 'object') parsed = { reply: '', edits: [] };
      if (!Array.isArray(parsed.edits)) parsed.edits = [];
      if (!Array.isArray(parsed.style)) parsed.style = [];
      turns.push({ role: 'user', content: userText });
      turns.push({ role: 'assistant', content: JSON.stringify({ reply: parsed.reply || '', edits: parsed.edits, style: parsed.style }) });
      return parsed;
    }).catch(function (e) { return { error: String((e && e.message) || e) }; });
  }

  // ASKAI-INSIGHT-001: one call per insight. input: {text, from, fromRole}.
  // Saves the insight to this tab's row when the answer parses.
  function askInsight(input) {
    input = input || {};
    var text = String(input.text || '').trim();
    if (!text) return Promise.resolve({ error: 'Paste the contact\'s message first.' });
    var base = proxyBase();
    if (!base) return Promise.resolve({ error: 'No LLM endpoint — sign in or set a Worker URL.' });
    var row = rowId();
    var user = 'CONTACT MESSAGE' + (input.from ? ' from ' + clip(input.from, 80) : '') + (input.fromRole ? ' (' + clip(input.fromRole, 80) + ')' : '') + ':\n"""\n' + text.slice(0, 4000) + '\n"""';
    return window.fetch(base + '/', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-provider': 'anthropic' },
      body: JSON.stringify({ model: MODEL, max_tokens: 4000, stream: false, system: buildInsightSystem(input), messages: [{ role: 'user', content: user }] }),
    }).then(function (res) {
      return res.text().then(function (raw) { return { res: res, raw: raw }; });
    }).then(function (rr) {
      var ct = '';
      try { ct = rr.res.headers.get('content-type') || ''; } catch (_) {}
      var out = parseInsightReply(extractLLMText(rr.raw, ct), { index: factIndex(kernelSource()), sections: readJSON('sections') || {}, active: activeDoc() });
      if (!out.parsed) return out;
      out.saved = saveInsight({ from: input.from, fromRole: input.fromRole, text: text, insights: out.insights, questions: out.questions }, row);
      out.row = row;
      turns.push({ role: 'user', content: 'Incoming insight' + (input.from ? ' from ' + clip(input.from, 80) : '') + ': ' + text.slice(0, 1200) });
      turns.push({ role: 'assistant', content: JSON.stringify({ reply: out.reply, edits: [], style: [] }) });
      return out;
    }).catch(function (e) { return { error: String((e && e.message) || e) }; });
  }

  // ─── UI ─────────────────────────────────────────────────────────────────────
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  function closePanel() { var p = document.getElementById(PANEL_ID); if (p) p.remove(); }

  // startMode 'insight' opens straight into the insight form (ASKAI-INSIGHT-001).
  function openPanel(startMode) {
    if (document.getElementById(PANEL_ID)) return;
    try { refreshHistory(); } catch (_) {}   // warm the history block before the first ask
    var panel = el('div', [
      'position:fixed', 'z-index:2147483601', 'right:14px', 'bottom:70px',
      'width:min(380px,calc(100vw - 28px))', 'max-height:min(560px,calc(100vh - 110px))',
      'display:flex', 'flex-direction:column',
      'background:#1b2945', 'color:#fff', 'border:1px solid rgba(1,183,187,0.5)',
      'border-radius:14px', 'box-shadow:0 16px 48px rgba(0,0,0,0.5)', 'font-family:Calibri,Arial,sans-serif',
    ].join(';'));
    panel.id = PANEL_ID;
    panel.setAttribute('data-antcv-doc-chatbot', '1');

    var head = el('div', 'display:flex;align-items:center;justify-content:space-between;padding:11px 13px;border-bottom:1px solid rgba(255,255,255,0.1);');
    var title = el('div', 'font-weight:800;color:#01B7BB;font-size:13px;flex:1;', '🤖 Ask AI · whole ' + (activeDoc() === 'cl' ? 'cover letter' : 'CV'));
    head.appendChild(title);
    // ASKAI-INSIGHT-001: mode chip — paste a contact's message, edit CV + letter.
    var chip = el('button', 'margin-right:8px;padding:4px 10px;border-radius:12px;border:1px solid rgba(1,183,187,0.6);background:transparent;color:#01B7BB;font-weight:800;font-size:11px;cursor:pointer;', '📨 Insight');
    chip.type = 'button'; chip.setAttribute('data-antcv-doc-insight-chip', '1');
    chip.title = 'Paste what a contact at the employer told you; AntCV checks it against your full profile and proposes CV and cover-letter edits';
    head.appendChild(chip);
    var x = el('button', 'background:transparent;border:0;color:rgba(255,255,255,0.6);font-size:18px;cursor:pointer;line-height:1;', '×');
    x.type = 'button'; x.onclick = closePanel; head.appendChild(x);
    panel.appendChild(head);

    var log = el('div', 'flex:1;overflow:auto;padding:11px 13px;font-size:12.5px;');
    log.setAttribute('data-antcv-doc-chat-log', '1');
    log.appendChild(el('div', 'color:rgba(255,255,255,0.6);line-height:1.5;', 'Ask me to review or change anything across your whole document — e.g. “tighten every bullet”, “make the profile more concrete”, “is this aligned with the JD?” — or ask for visual changes like “make the specialization line darker” or “use a serif heading font”. I know your profile and application history, and you approve each change. Got input from someone at the employer? Tap 📨 Insight and paste it.'));
    panel.appendChild(log);

    var foot = el('div', 'padding:10px 12px;border-top:1px solid rgba(255,255,255,0.1);');
    var fieldCss = 'flex:1;min-width:0;box-sizing:border-box;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:8px;color:#fff;font-family:inherit;font-size:12px;padding:6px 8px;';
    var insBox = el('div', 'display:none;margin-bottom:7px;');
    insBox.setAttribute('data-antcv-doc-insight-form', '1');
    var insRow = el('div', 'display:flex;gap:6px;');
    var fromIn = el('input', fieldCss); fromIn.placeholder = 'From (optional)'; fromIn.setAttribute('data-antcv-doc-insight-from', '1');
    var roleIn = el('input', fieldCss); roleIn.placeholder = 'Their role (optional)'; roleIn.setAttribute('data-antcv-doc-insight-role', '1');
    insRow.appendChild(fromIn); insRow.appendChild(roleIn);
    insBox.appendChild(insRow);
    var insHint = el('div', 'font-size:10.5px;color:rgba(255,255,255,0.5);margin-top:5px;line-height:1.4;');
    insBox.appendChild(insHint);
    foot.appendChild(insBox);
    var ta = el('textarea','width:100%;box-sizing:border-box;min-height:40px;max-height:120px;resize:vertical;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:8px;color:#fff;font-family:inherit;font-size:12.5px;padding:8px;');
    ta.placeholder = 'Ask about or change the whole document…';
    var sendRow = el('div', 'display:flex;gap:6px;justify-content:flex-end;align-items:center;margin-top:7px;');
    var status = el('div', 'flex:1;font-size:10.5px;color:rgba(255,255,255,0.5);');
    var send = el('button', 'padding:8px 14px;border-radius:8px;border:0;background:#01B7BB;color:#06243a;font-weight:800;font-size:12.5px;cursor:pointer;', 'Send');
    send.type = 'button'; send.setAttribute('data-antcv-doc-chat-send', '1');
    sendRow.appendChild(status); sendRow.appendChild(send);
    foot.appendChild(ta); foot.appendChild(sendRow);
    panel.appendChild(foot);

    function addBubble(who, text) {
      var b = el('div', 'margin:8px 0;line-height:1.5;');
      b.appendChild(el('div', 'font-size:9.5px;font-weight:800;letter-spacing:.4px;color:' + (who === 'you' ? 'rgba(255,255,255,0.45)' : '#01B7BB') + ';margin-bottom:2px;', who === 'you' ? 'YOU' : 'AI'));
      b.appendChild(el('div', 'color:rgba(255,255,255,0.9);', text));
      log.appendChild(b); log.scrollTop = log.scrollHeight; return b;
    }
    var DOC_LABEL = { cv: 'CV', cl: 'Cover letter' };
    // One Apply/Undo card. opts.insight: show the doc label, cited facts and the
    // fact-check warnings (ASKAI-INSIGHT-001). Returns the card.
    function editCard(edit, opts) {
      opts = opts || {};
      var card = el('div', 'margin:7px 0;background:rgba(1,183,187,0.08);border:1px solid rgba(1,183,187,0.3);border-radius:8px;padding:8px 9px;');
      card.setAttribute('data-antcv-doc-edit', edit.sid);
      if (edit.doc) card.setAttribute('data-antcv-doc-edit-doc', edit.doc);
      card.appendChild(el('div', 'font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:3px;', (opts.insight ? (DOC_LABEL[edit.doc] || 'CV') + ' · ' : '') + edit.sid));
      card.appendChild(el('div', 'font-size:11.5px;color:rgba(255,255,255,0.55);text-decoration:line-through;line-height:1.4;', edit.find.slice(0, 160)));
      card.appendChild(el('div', 'font-size:12px;color:#fff;line-height:1.45;margin-top:2px;', edit.replace.slice(0, opts.insight ? 400 : 220)));
      if (edit.why) card.appendChild(el('div', 'font-size:10.5px;color:rgba(255,255,255,0.55);margin-top:4px;', 'Why: ' + edit.why));
      if (opts.insight) {
        (edit.cites || []).forEach(function (c) {
          card.appendChild(el('div', 'font-size:10.5px;margin-top:3px;line-height:1.4;color:' + (c.verified ? 'rgba(1,183,187,0.9)' : '#FFC107') + ';',
            (c.verified ? '✓ ' : '⚠ ') + '[' + (c.foundIn || c.role || '?') + '] ' + clip(c.fact, 180) + (c.verified ? '' : ' (not found in your profile)')));
        });
        var warn = [];
        if (!(edit.cites || []).length) warn.push('no profile fact cited');
        if (edit.newNumbers && edit.newNumbers.length) warn.push('number not in your profile: ' + edit.newNumbers.join(', '));
        if (edit.found === false) warn.push('text not found in the ' + (DOC_LABEL[edit.doc] || 'document').toLowerCase());
        if (warn.length) {
          var w = el('div', 'font-size:10.5px;color:#FFC107;margin-top:4px;', '⚠ ' + warn.join(' · ') + '. Check before applying.');
          w.setAttribute('data-antcv-doc-edit-warn', '1');
          card.appendChild(w);
        }
        if (safeEdit(edit)) card.setAttribute('data-antcv-doc-edit-safe', '1');
      }
      var row = el('div', 'display:flex;gap:6px;justify-content:flex-end;margin-top:6px;');
      var apply = el('button', 'padding:5px 11px;border-radius:6px;border:0;background:#01B7BB;color:#06243a;font-weight:800;font-size:11px;cursor:pointer;', 'Apply');
      apply.type = 'button'; apply.setAttribute('data-antcv-doc-edit-apply', '1');
      if (edit.found === false) { apply.textContent = 'Not found'; apply.disabled = true; apply.style.opacity = '0.5'; }
      apply.onclick = function () {
        var undo = applyEdit(edit);
        if (!undo) { apply.textContent = 'Not found'; apply.disabled = true; apply.style.opacity = '0.5'; return; }
        row.innerHTML = '';
        row.appendChild(el('div', 'flex:1;font-size:11px;color:#01B7BB;font-weight:700;', '✓ Applied'));
        var u = el('button', 'padding:5px 11px;border-radius:6px;border:1px solid rgba(1,183,187,0.6);background:transparent;color:#01B7BB;font-weight:800;font-size:11px;cursor:pointer;', 'Undo');
        u.type = 'button'; u.setAttribute('data-antcv-doc-edit-undo', '1');
        u.onclick = function () { if (undo()) { u.textContent = 'Undone'; u.disabled = true; } };
        row.appendChild(u);
      };
      row.appendChild(apply);
      card.appendChild(row);
      return card;
    }
    function addEdits(bubble, edits) {
      var doc = activeDoc();   // pin the doc the proposal was made for
      edits.forEach(function (edit) {
        if (!edit || !edit.sid || !edit.find) return;
        if (edit.doc !== 'cv' && edit.doc !== 'cl') edit.doc = doc;
        bubble.appendChild(editCard(edit));
      });
      if (edits.length > 1) {
        var allBtn = el('button', 'margin-top:4px;padding:6px 12px;border-radius:7px;border:1px solid rgba(1,183,187,0.6);background:transparent;color:#01B7BB;font-weight:800;font-size:11.5px;cursor:pointer;', 'Apply all ' + edits.length);
        allBtn.type = 'button'; allBtn.setAttribute('data-antcv-doc-apply-all', '1');
        allBtn.onclick = function () { bubble.querySelectorAll('[data-antcv-doc-edit-apply]').forEach(function (b) { if (!b.disabled) b.click(); }); allBtn.textContent = 'Applied all'; allBtn.disabled = true; };
        bubble.appendChild(allBtn);
      }
      log.scrollTop = log.scrollHeight;
    }
    // ASKAI-EXPAND-001: visual style op cards — same Apply/Undo contract as
    // text edits, amber accent so they read as a different kind of change.
    function addStyleOps(bubble, ops) {
      ops.forEach(function (op) {
        if (!op || !op.op) return;
        var card = el('div', 'margin:7px 0;background:rgba(255,193,7,0.08);border:1px solid rgba(255,193,7,0.35);border-radius:8px;padding:8px 9px;');
        card.setAttribute('data-antcv-doc-style-op', String(op.op));
        card.appendChild(el('div', 'font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:3px;', 'STYLE'));
        card.appendChild(el('div', 'font-size:12px;color:#fff;line-height:1.45;', styleLabel(op)));
        if (op.why) card.appendChild(el('div', 'font-size:10.5px;color:rgba(255,255,255,0.55);margin-top:4px;', 'Why: ' + op.why));
        var row = el('div', 'display:flex;gap:6px;justify-content:flex-end;margin-top:6px;');
        var apply = el('button', 'padding:5px 11px;border-radius:6px;border:0;background:#FFC107;color:#3a2a06;font-weight:800;font-size:11px;cursor:pointer;', 'Apply');
        apply.type = 'button'; apply.setAttribute('data-antcv-doc-style-apply', '1');
        apply.onclick = function () {
          var undo = applyStyleOp(op);
          if (!undo) { apply.textContent = 'Not available'; apply.disabled = true; apply.style.opacity = '0.5'; return; }
          row.innerHTML = '';
          row.appendChild(el('div', 'flex:1;font-size:11px;color:#FFC107;font-weight:700;', '✓ Applied'));
          var u = el('button', 'padding:5px 11px;border-radius:6px;border:1px solid rgba(255,193,7,0.6);background:transparent;color:#FFC107;font-weight:800;font-size:11px;cursor:pointer;', 'Undo');
          u.type = 'button'; u.setAttribute('data-antcv-doc-style-undo', '1');
          u.onclick = function () { if (undo()) { u.textContent = 'Undone'; u.disabled = true; } };
          row.appendChild(u);
        };
        row.appendChild(apply);
        card.appendChild(row);
        bubble.appendChild(card);
      });
      log.scrollTop = log.scrollHeight;
    }

    // ASKAI-INSIGHT-001: insights with their facts, edits grouped per document
    // (each group has its own "Apply all"), then the questions about gaps.
    function sub(text) { return el('div', 'font-size:9.5px;font-weight:800;letter-spacing:.4px;color:rgba(255,255,255,0.45);margin:10px 0 3px;', text); }
    function addInsightResult(bubble, res) {
      var box = el('div', ''); box.setAttribute('data-antcv-doc-insight-result', '1');
      if (res.insights.length) {
        box.appendChild(sub('WHAT THEY SAID, CHECKED AGAINST YOUR PROFILE'));
        res.insights.forEach(function (p, i) {
          var item = el('div', 'margin:4px 0 6px;'); item.setAttribute('data-antcv-doc-insight-point', String(i + 1));
          item.appendChild(el('div', 'font-size:12px;color:#fff;line-height:1.45;', (i + 1) + '. ' + p.point));
          if (!p.support.length) item.appendChild(el('div', 'font-size:10.5px;color:#FFC107;margin-top:2px;', '⚠ No fact in your profile backs this yet; see the questions below.'));
          p.support.forEach(function (s) {
            item.appendChild(el('div', 'font-size:10.5px;margin-top:2px;line-height:1.4;color:' + (s.verified ? 'rgba(1,183,187,0.9)' : '#FFC107') + ';',
              (s.verified ? '✓ ' : '⚠ ') + '[' + (s.foundIn || s.role || '?') + '] ' + clip(s.fact, 200) + (s.verified ? '' : ' (not found in your profile)')));
          });
          box.appendChild(item);
        });
      }
      ['cv', 'cl'].forEach(function (doc) {
        var group = res.edits.filter(function (e) { return e.doc === doc; });
        if (!group.length) return;
        var g = el('div', ''); g.setAttribute('data-antcv-doc-insight-group', doc);
        g.appendChild(sub((DOC_LABEL[doc] || doc).toUpperCase() + ' · ' + group.length + ' EDIT' + (group.length > 1 ? 'S' : '')));
        group.forEach(function (e) { g.appendChild(editCard(e, { insight: true })); });
        var safe = group.filter(safeEdit).length;
        if (safe) {
          var all = el('button', 'margin-top:2px;padding:6px 12px;border-radius:7px;border:1px solid rgba(1,183,187,0.6);background:transparent;color:#01B7BB;font-weight:800;font-size:11.5px;cursor:pointer;',
            'Apply all checked ' + (doc === 'cl' ? 'letter' : 'CV') + ' edits (' + safe + ')');
          all.type = 'button'; all.setAttribute('data-antcv-doc-apply-all', doc);
          all.onclick = function () {
            g.querySelectorAll('[data-antcv-doc-edit-safe] [data-antcv-doc-edit-apply]').forEach(function (b) { if (!b.disabled) b.click(); });
            all.textContent = 'Applied'; all.disabled = true;
          };
          g.appendChild(all);
        }
        box.appendChild(g);
      });
      if (res.questions.length) {
        box.appendChild(sub('QUESTIONS FOR YOU (nothing was written for these)'));
        res.questions.forEach(function (q) { var d = el('div', 'font-size:12px;color:#fff;line-height:1.45;margin:2px 0;', '• ' + q); d.setAttribute('data-antcv-doc-insight-question', '1'); box.appendChild(d); });
      }
      if (res.saved) {
        var sv = el('div', 'font-size:10.5px;color:rgba(255,255,255,0.5);margin-top:8px;',
          /^\d+$/.test(String(res.row)) ? 'Saved with application #' + res.row + '; later Ask AI turns and regenerations for this job use it.' : 'Saved on this device; it joins the application once the application is saved.');
        sv.setAttribute('data-antcv-doc-insight-saved', String(res.row));
        box.appendChild(sv);
      }
      bubble.appendChild(box);
      log.scrollTop = log.scrollHeight;
    }
    var mode = 'chat';
    function setMode(m) {
      mode = m;
      var on = m === 'insight';
      insBox.style.display = on ? 'block' : 'none';
      chip.style.background = on ? '#01B7BB' : 'transparent';
      chip.style.color = on ? '#06243a' : '#01B7BB';
      title.textContent = on ? '📨 Incoming insight · CV + cover letter' : '🤖 Ask AI · whole ' + (activeDoc() === 'cl' ? 'cover letter' : 'CV');
      ta.placeholder = on ? 'Paste the contact\'s message…' : 'Ask about or change the whole document…';
      send.textContent = on ? 'Check & propose' : 'Send';
      var n = storedInsights().length;
      insHint.textContent = 'Each point is checked against your full profile; edits for the CV and the cover letter come back for you to approve.' + (n ? ' ' + n + ' insight' + (n > 1 ? 's' : '') + ' saved for this application.' : '');
      try { ta.focus(); } catch (_) {}
    }
    chip.onclick = function () { setMode(mode === 'insight' ? 'chat' : 'insight'); };
    function runInsight() {
      var text = (ta.value || '').trim();
      if (!text) return;
      var input = { text: text, from: (fromIn.value || '').trim(), fromRole: (roleIn.value || '').trim() };
      addBubble('you', (input.from ? input.from + (input.fromRole ? ' (' + input.fromRole + ')' : '') + ': ' : '') + text);
      ta.value = '';
      send.disabled = true; send.style.opacity = '0.6'; status.textContent = 'Checking against your profile…';
      askInsight(input).then(function (res) {
        send.disabled = false; send.style.opacity = '1'; status.textContent = '';
        if (!res || res.error) { addBubble('ai', 'Sorry — ' + ((res && res.error) || 'no response') + '.'); return; }
        var bub = addBubble('ai', res.reply || (res.parsed ? 'Here is what I found:' : '(no reply)'));
        if (res.parsed) addInsightResult(bub, res);
        setMode('insight');
      });
    }

    function run() {
      if (mode === 'insight') return runInsight();
      var text = (ta.value || '').trim();
      if (!text) return;
      addBubble('you', text); ta.value = '';
      send.disabled = true; send.style.opacity = '0.6'; status.textContent = 'Thinking…';
      ask(text).then(function (res) {
        send.disabled = false; send.style.opacity = '1'; status.textContent = '';
        if (!res || res.error) { addBubble('ai', 'Sorry — ' + ((res && res.error) || 'no response') + '.'); return; }
        var bub = addBubble('ai', res.reply || ((res.edits.length || (res.style && res.style.length)) ? 'Here are the changes:' : '(no reply)'));
        if (res.edits && res.edits.length) addEdits(bub, res.edits);
        if (res.style && res.style.length) addStyleOps(bub, res.style);
      });
    }
    send.onclick = run;
    ta.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && (ev.metaKey || ev.ctrlKey)) { ev.preventDefault(); run(); } });

    (document.body || document.documentElement).appendChild(panel);
    setTimeout(function () { try { ta.focus(); } catch (_) {} }, 40);
    if (startMode === 'insight') setMode('insight');
  }

  function ensureLauncher() {
    var existing = document.getElementById(LAUNCH_ID);
    if (!inEditor()) { if (existing) existing.remove(); return; }
    if (existing) return;
    var b = el('button', [
      'position:fixed', 'z-index:2147483600',
      'padding:10px 15px', 'border-radius:24px', 'border:0',
      'background:#01B7BB', 'color:#06243a', 'font-weight:800', 'font-size:13px',
      'font-family:Calibri,Arial,sans-serif', 'cursor:grab', 'touch-action:none',
      'box-shadow:0 6px 20px rgba(0,0,0,0.35)', 'display:flex', 'align-items:center', 'gap:6px',
    ].join(';'), '🤖 Ask AI');
    b.id = LAUNCH_ID;
    b.type = 'button';
    b.title = 'Chat about your document — drag to move';
    b.setAttribute('data-antcv-doc-chatbot-launch', '1');
    // DOC-CHATBOT-DRAG-001 (owner 2026-06-13): the launcher hid the Fuse/CV/CL
    // bottom toolbar. Default it ABOVE the toolbar and make it DRAGGABLE with a
    // persisted position so the user can move it anywhere.
    // MOBILE-ASKAI-EXPORT-OVERLAP-001 (owner 2026-06-17): at bottom:96px the
    // launcher still covered the DOCX export button sitting just above the Fuse
    // toolbar on mobile. Raise the default to 150px so it clears the export row;
    // a dragged/saved position still wins.
    var saved = null;
    try { saved = JSON.parse(localStorage.getItem('antcv:docChatbotPos') || 'null'); } catch (_) {}
    if (saved && typeof saved.left === 'number') {
      b.style.left = Math.max(4, Math.min(saved.left, (window.innerWidth || 800) - 60)) + 'px';
      b.style.top = Math.max(4, Math.min(saved.top, (window.innerHeight || 600) - 50)) + 'px';
    } else {
      b.style.right = '14px';
      b.style.bottom = '150px';
    }
    var dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
    b.addEventListener('pointerdown', function (ev) {
      dragging = true; moved = false; sx = ev.clientX; sy = ev.clientY;
      var r = b.getBoundingClientRect(); ox = r.left; oy = r.top;
      b.style.cursor = 'grabbing';
      try { b.setPointerCapture(ev.pointerId); } catch (_) {}
    });
    b.addEventListener('pointermove', function (ev) {
      if (!dragging) return;
      var dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      if (moved) {
        b.style.left = Math.max(4, Math.min(ox + dx, (window.innerWidth || 800) - 60)) + 'px';
        b.style.top = Math.max(4, Math.min(oy + dy, (window.innerHeight || 600) - 50)) + 'px';
        b.style.right = ''; b.style.bottom = '';
      }
    });
    b.addEventListener('pointerup', function (ev) {
      dragging = false; b.style.cursor = 'grab';
      try { b.releasePointerCapture(ev.pointerId); } catch (_) {}
      if (moved) {
        var r = b.getBoundingClientRect();
        try { localStorage.setItem('antcv:docChatbotPos', JSON.stringify({ left: r.left, top: r.top })); } catch (_) {}
      } else {
        if (document.getElementById(PANEL_ID)) closePanel(); else openPanel();
      }
    });
    (document.body || document.documentElement).appendChild(b);
  }

  var pending = false;
  function schedule() { if (pending) return; pending = true; requestAnimationFrame(function () { pending = false; try { ensureLauncher(); } catch (_) {} }); }
  function boot() {
    schedule();
    [300, 900, 2000].forEach(function (ms) { setTimeout(schedule, ms); });
    try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (_) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.AntcvDocChatbot = { version: VERSION, open: openPanel, close: closePanel, _ask: ask, _applyEdit: applyEdit, _docContext: docContext, _buildSystem: buildSystem, _applyStyleOp: applyStyleOp, _kernelContext: kernelContext, _historyContext: historyContext, _refreshHistory: refreshHistory, _styleContext: styleContext,
    // ASKAI-INSIGHT-001
    insightsPromptBlock: insightsPromptBlock, storedInsights: storedInsights, _askInsight: askInsight, _buildInsightSystem: buildInsightSystem,
    _kernelDigest: kernelDigest, _factIndex: factIndex, _verifyFact: verifyFact, _parseInsightReply: parseInsightReply, _saveInsight: saveInsight,
    _extractLLMText: extractLLMText, _safeEdit: safeEdit, _insightKey: insightKey };
  try { console.debug('[doc-chatbot-440] installed v' + VERSION); } catch (_) {}
})();
