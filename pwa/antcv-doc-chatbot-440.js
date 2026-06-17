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
(function () {
  'use strict';
  var VERSION = '1.50.440';
  if (window.__antcvDocChatbot440 === VERSION) return;
  window.__antcvDocChatbot440 = VERSION;

  var LAUNCH_ID = 'antcv-doc-chatbot-launch';
  var PANEL_ID = 'antcv-doc-chatbot-panel';
  var MODEL = 'claude-opus-4-7';

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
  function buildSystem() {
    return [
      'You are an editing assistant for a job-application document (CV / cover letter) inside AntCV. You can answer questions about the document AND propose concrete edits to specific sections.',
      '',
      'RULES (must follow):',
      rules().map(function (x) { return '- ' + x; }).join('\n'),
      '',
      'THE DOCUMENT (one line per section, prefixed with its [sid]):',
      docContext(),
      '',
      'Return STRICT JSON only (no markdown fences):',
      '{"reply":"<a short conversational answer to the user>","edits":[{"sid":"<the section id>","find":"<an EXACT substring copied verbatim from that section to replace>","replace":"<the new text>","why":"<one short reason, citing the rule or the user\'s intent>"}]}',
      'Only include an edit when the user asked you to change something or you are confident it improves the document within the rules. `find` MUST be copied verbatim from the section so it can be located. If you have no edits, return "edits":[]. Keep replacements within the same length range unless asked to shorten/expand.',
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

  // ─── LLM ────────────────────────────────────────────────────────────────────
  var turns = []; // {role, content}
  function ask(userText) {
    var base = proxyBase();
    if (!base) return Promise.resolve({ error: 'No LLM endpoint — sign in or set a Worker URL.' });
    var msgs = turns.slice(-8).concat([{ role: 'user', content: userText }]);
    return window.fetch(base + '/', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'x-provider': 'anthropic' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1100, stream: false, system: buildSystem(), messages: msgs }),
    }).then(function (res) { return res.json().catch(function () { return null; }); }).then(function (j) {
      var raw = (j && j.content && j.content[0] && j.content[0].text) || '';
      var parsed; try { parsed = JSON.parse(String(raw).replace(/```json|```/g, '').trim()); } catch (_) { parsed = { reply: String(raw || '').trim(), edits: [] }; }
      if (!parsed || typeof parsed !== 'object') parsed = { reply: '', edits: [] };
      if (!Array.isArray(parsed.edits)) parsed.edits = [];
      turns.push({ role: 'user', content: userText });
      turns.push({ role: 'assistant', content: JSON.stringify({ reply: parsed.reply || '', edits: parsed.edits }) });
      return parsed;
    }).catch(function (e) { return { error: String((e && e.message) || e) }; });
  }

  // ─── UI ─────────────────────────────────────────────────────────────────────
  function el(tag, css, text) { var n = document.createElement(tag); if (css) n.style.cssText = css; if (text != null) n.textContent = text; return n; }
  function closePanel() { var p = document.getElementById(PANEL_ID); if (p) p.remove(); }

  function openPanel() {
    if (document.getElementById(PANEL_ID)) return;
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
    log.appendChild(el('div', 'color:rgba(255,255,255,0.6);line-height:1.5;', 'Ask me to review or change anything across your whole document — e.g. “tighten every bullet”, “make the profile more concrete”, “is this aligned with the JD?”. I’ll respect your banned words, length and language, and you approve each edit.'));
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

    function run() {
      var text = (ta.value || '').trim();
      if (!text) return;
      addBubble('you', text); ta.value = '';
      send.disabled = true; send.style.opacity = '0.6'; status.textContent = 'Thinking…';
      ask(text).then(function (res) {
        send.disabled = false; send.style.opacity = '1'; status.textContent = '';
        if (!res || res.error) { addBubble('ai', 'Sorry — ' + ((res && res.error) || 'no response') + '.'); return; }
        var bub = addBubble('ai', res.reply || (res.edits.length ? 'Here are the changes:' : '(no reply)'));
        if (res.edits && res.edits.length) addEdits(bub, res.edits);
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

  window.AntcvDocChatbot = { version: VERSION, open: openPanel, close: closePanel, _ask: ask, _applyEdit: applyEdit, _docContext: docContext, _buildSystem: buildSystem };
  try { console.debug('[doc-chatbot-440] installed v' + VERSION); } catch (_) {}
})();
