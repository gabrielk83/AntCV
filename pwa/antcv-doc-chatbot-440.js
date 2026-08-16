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
(function () {
  'use strict';
  var VERSION = '1.51.4146';
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
  function docContext() {
    var all = readJSON('sections') || {};
    var arr = all[activeDoc()] || [];
    var lines = [];
    for (var i = 0; i < arr.length; i++) {
      var sec = arr[i]; if (!sec || sec.on === false) continue;
      var out = { s: [] }; flattext(sec, out, 1200);
      var body = out.s.join(' · ').slice(0, 1000);
      if (body) lines.push('[' + (sec.id || ('sec' + i)) + '] ' + (sec.title || '') + ': ' + body);
    }
    return lines.join('\n').slice(0, 6000);
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
    ].join('\n');
  }

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
  function applyEdit(edit) {
    var all = readJSON('sections'); if (!all) return null;
    var doc = activeDoc(); var arr = all[doc] || [];
    var sec = null; for (var i = 0; i < arr.length; i++) if (arr[i] && arr[i].id === edit.sid) { sec = arr[i]; break; }
    if (!sec) return null;
    var old = locateAndReplace(sec, edit.find, edit.replace);
    if (old == null) return null;
    try { localStorage.setItem('sections', JSON.stringify(all)); } catch (_) { return null; }
    try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'doc-chatbot' } })); } catch (_) {}
    return function undo() {
      var a2 = readJSON('sections'); if (!a2) return false;
      var arr2 = a2[doc] || []; var s2 = null;
      for (var j = 0; j < arr2.length; j++) if (arr2[j] && arr2[j].id === edit.sid) { s2 = arr2[j]; break; }
      if (!s2) return false;
      if (locateAndReplace(s2, edit.replace, edit.find) == null) return false;
      try { localStorage.setItem('sections', JSON.stringify(a2)); } catch (_) { return false; }
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'doc-chatbot-undo' } })); } catch (_) {}
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
      var raw = String(rr.raw || ''), txt = '', ct = '';
      try { ct = rr.res.headers.get('content-type') || ''; } catch (_) {}
      // ASKAI-SSE-001: the cv-proxy FORCES stream:true for BYOK/owner accounts,
      // so the answer can arrive as text/event-stream — buffer and join the
      // content_block_delta text (same pattern as JobTracker/api.ts askAI).
      if (/^event:|^data:/m.test(raw.slice(0, 400)) || ct.indexOf('event-stream') >= 0) {
        raw.split('\n').forEach(function (line) {
          if (line.indexOf('data:') !== 0) return;
          var d; try { d = JSON.parse(line.slice(5).trim()); } catch (_) { d = null; }
          if (d && d.type === 'content_block_delta' && d.delta && typeof d.delta.text === 'string') txt += d.delta.text;
        });
      } else {
        var j; try { j = JSON.parse(raw); } catch (_) { j = null; }
        txt = (j && j.content && j.content[0] && j.content[0].text) || '';
      }
      var parsed; try { parsed = JSON.parse(String(txt).replace(/```json|```/g, '').trim()); } catch (_) { parsed = { reply: String(txt || '').trim(), edits: [] }; }
      if (!parsed || typeof parsed !== 'object') parsed = { reply: '', edits: [] };
      if (!Array.isArray(parsed.edits)) parsed.edits = [];
      if (!Array.isArray(parsed.style)) parsed.style = [];
      turns.push({ role: 'user', content: userText });
      turns.push({ role: 'assistant', content: JSON.stringify({ reply: parsed.reply || '', edits: parsed.edits, style: parsed.style }) });
      return parsed;
    }).catch(function (e) { return { error: String((e && e.message) || e) }; });
  }

  // ─── UI ─────────────────────────────────────────────────────────────────────
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  function closePanel() { var p = document.getElementById(PANEL_ID); if (p) p.remove(); }

  function openPanel() {
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
    head.appendChild(el('div', 'font-weight:800;color:#01B7BB;font-size:13px;', '🤖 Ask AI · whole ' + (activeDoc() === 'cl' ? 'cover letter' : 'CV')));
    var x = el('button', 'background:transparent;border:0;color:rgba(255,255,255,0.6);font-size:18px;cursor:pointer;line-height:1;', '×');
    x.type = 'button'; x.onclick = closePanel; head.appendChild(x);
    panel.appendChild(head);

    var log = el('div', 'flex:1;overflow:auto;padding:11px 13px;font-size:12.5px;');
    log.setAttribute('data-antcv-doc-chat-log', '1');
    log.appendChild(el('div', 'color:rgba(255,255,255,0.6);line-height:1.5;', 'Ask me to review or change anything across your whole document — e.g. “tighten every bullet”, “make the profile more concrete”, “is this aligned with the JD?” — or ask for visual changes like “make the specialization line darker” or “use a serif heading font”. I know your profile and application history, and you approve each change.'));
    panel.appendChild(log);

    var foot = el('div', 'padding:10px 12px;border-top:1px solid rgba(255,255,255,0.1);');
    var ta = el('textarea', 'width:100%;box-sizing:border-box;min-height:40px;max-height:120px;resize:vertical;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.16);border-radius:8px;color:#fff;font-family:inherit;font-size:12.5px;padding:8px;');
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
    function addEdits(bubble, edits) {
      edits.forEach(function (edit) {
        if (!edit || !edit.sid || !edit.find) return;
        var card = el('div', 'margin:7px 0;background:rgba(1,183,187,0.08);border:1px solid rgba(1,183,187,0.3);border-radius:8px;padding:8px 9px;');
        card.setAttribute('data-antcv-doc-edit', edit.sid);
        card.appendChild(el('div', 'font-size:10px;color:rgba(255,255,255,0.5);margin-bottom:3px;', edit.sid));
        card.appendChild(el('div', 'font-size:11.5px;color:rgba(255,255,255,0.55);text-decoration:line-through;line-height:1.4;', edit.find.slice(0, 160)));
        card.appendChild(el('div', 'font-size:12px;color:#fff;line-height:1.45;margin-top:2px;', edit.replace.slice(0, 220)));
        if (edit.why) card.appendChild(el('div', 'font-size:10.5px;color:rgba(255,255,255,0.55);margin-top:4px;', 'Why: ' + edit.why));
        var row = el('div', 'display:flex;gap:6px;justify-content:flex-end;margin-top:6px;');
        var apply = el('button', 'padding:5px 11px;border-radius:6px;border:0;background:#01B7BB;color:#06243a;font-weight:800;font-size:11px;cursor:pointer;', 'Apply');
        apply.type = 'button'; apply.setAttribute('data-antcv-doc-edit-apply', '1');
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
        bubble.appendChild(card);
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

    function run() {
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

  window.AntcvDocChatbot = { version: VERSION, open: openPanel, close: closePanel, _ask: ask, _applyEdit: applyEdit, _docContext: docContext, _buildSystem: buildSystem, _applyStyleOp: applyStyleOp, _kernelContext: kernelContext, _historyContext: historyContext, _refreshHistory: refreshHistory, _styleContext: styleContext };
  try { console.debug('[doc-chatbot-440] installed v' + VERSION); } catch (_) {}
})();
