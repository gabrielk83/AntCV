/* AntCV in-preview AI edit bot — STAGE 1 (v1.50.406)
 * ============================================================
 * PREVIEW-CHATBOT-001 stage 1 (design: docs/plan/PREVIEW-CHATBOT-001_stage1.md).
 * Select preview text -> "✨ AI edit" pill -> panel with quick actions +
 * free instruction -> ONE buffered LLM call through the cv-proxy root
 * pipeline (gets the writing-style envelope + server-side SCE retries for
 * free) -> proposed rewrite + Why line -> Apply (text-match into the
 * sections store) / Discard / Undo.
 *
 * Step-2 ready: data-antcv-aibot-rules (rule chips), data-antcv-aibot-log
 * (conversation column) exist in the DOM now.
 */
(function () {
  'use strict';

  var VERSION = '1.50.406';
  if (window.__antcvPreviewChatbot === VERSION) return;
  window.__antcvPreviewChatbot = VERSION;

  var PILL_ID = 'antcv-aibot-pill';
  var PANEL_ID = 'antcv-aibot-panel';
  var MODEL = 'claude-opus-4-7';
  var state = { sel: '', rect: null, busy: false, undo: null, lastRewrite: null };

  function clean(s) { return String(s == null ? '' : s).replace(/[\t\n\r ]+/g, ' ').trim(); }
  function paper() { return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]'); }
  function proxyBase() {
    try {
      var v = JSON.parse(localStorage.getItem('proxyUrl') || '""');
      return String(v || '').replace(/\/+$/, '');
    } catch (_) { return ''; }
  }

  // ─── selection pill ───────────────────────────────────────────────
  function removePill() { var p = document.getElementById(PILL_ID); p && p.remove(); }
  function showPill(rect) {
    removePill();
    var pill = document.createElement('button');
    pill.id = PILL_ID;
    pill.type = 'button';
    pill.textContent = '✨ AI edit';
    pill.style.cssText = 'position:fixed;z-index:99996;left:' + Math.round(rect.left + rect.width / 2 - 38) + 'px;top:' + Math.max(6, Math.round(rect.top - 34)) + 'px;'
      + 'font:600 12px Calibri,Arial,sans-serif;padding:4px 10px;border-radius:14px;border:1px solid #01B7BB;'
      + 'background:#0b3340;color:#7effd4;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,0.35);';
    pill.onmousedown = function (ev) { ev.preventDefault(); ev.stopPropagation(); };
    pill.onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); openPanel(); };
    document.body.appendChild(pill);
  }

  document.addEventListener('mouseup', function () {
    setTimeout(function () {
      try {
        if (document.getElementById(PANEL_ID)) return;
        var sel = window.getSelection();
        var txt = sel ? clean(sel.toString()) : '';
        var pp = paper();
        if (!txt || txt.length < 4 || txt.length > 600 || !pp || !sel.rangeCount) { removePill(); return; }
        var node = sel.anchorNode && (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement);
        if (!node || !pp.contains(node)) { removePill(); return; }
        state.sel = txt;
        state.rect = sel.getRangeAt(0).getBoundingClientRect();
        showPill(state.rect);
      } catch (_) {}
    }, 10);
  }, true);

  // ─── panel ────────────────────────────────────────────────────────
  function closePanel() { var p = document.getElementById(PANEL_ID); p && p.remove(); }

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  function openPanel() {
    removePill();
    closePanel();
    var r = state.rect || { left: 80, top: 80, bottom: 120 };
    var panel = el('div');
    panel.id = PANEL_ID;
    panel.setAttribute('data-antcv-aibot', '1');
    var top = Math.min(window.innerHeight - 320, Math.max(8, Math.round(r.bottom + 8)));
    var left = Math.min(window.innerWidth - 380, Math.max(8, Math.round(r.left)));
    panel.style.cssText = 'position:fixed;z-index:99997;left:' + left + 'px;top:' + top + 'px;width:364px;'
      + 'background:#13202e;color:#e8f1f5;border:1px solid #01B7BB;border-radius:12px;'
      + 'box-shadow:0 10px 34px rgba(0,0,0,0.5);font:13px/1.45 Calibri,Arial,sans-serif;padding:12px 14px;';

    var head = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;');
    head.appendChild(el('div', 'font-weight:700;letter-spacing:0.04em;color:#7effd4;', '✨ AI edit'));
    var x = el('button', 'background:none;border:none;color:#9fb3bf;font-size:14px;cursor:pointer;', '✕');
    x.onclick = closePanel;
    head.appendChild(x);
    panel.appendChild(head);

    var quote = el('div', 'font-size:12px;color:#b9cdd8;background:rgba(255,255,255,0.05);border-left:3px solid #01B7BB;'
      + 'border-radius:4px;padding:6px 8px;margin-bottom:8px;max-height:64px;overflow:hidden;');
    quote.textContent = state.sel.length > 200 ? state.sel.slice(0, 200) + '…' : state.sel;
    panel.appendChild(quote);

    var quick = el('div', 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;');
    [['Shorten', 'Shorten this without losing the numbers or proper nouns.'],
     ['More concrete', 'Make this more concrete: name the system, the scope, or the number already on record. Never invent facts.'],
     ['Calmer tone', 'Rewrite in a calmer, Scandinavian-professional register. No self-praise.'],
     ['Fix wording', 'Fix grammar and awkward wording. Keep the meaning and length.']].forEach(function (q) {
      var b = el('button', 'font-size:11px;padding:3px 9px;border-radius:12px;border:1px solid rgba(1,183,187,0.5);'
        + 'background:rgba(1,183,187,0.10);color:#bfeff0;cursor:pointer;', q[0]);
      b.onclick = function () { ask(q[1]); };
      quick.appendChild(b);
    });
    panel.appendChild(quick);

    var row = el('div', 'display:flex;gap:6px;margin-bottom:8px;');
    var input = el('input', 'flex:1;background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.18);'
      + 'border-radius:8px;color:#fff;font-size:12px;padding:7px 9px;');
    input.placeholder = 'say what should change…';
    input.id = 'antcv-aibot-input';
    input.onkeydown = function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); ask(input.value); } };
    var go = el('button', 'font-size:12px;font-weight:700;padding:7px 12px;border-radius:8px;border:none;'
      + 'background:#01B7BB;color:#06262b;cursor:pointer;', 'Ask');
    go.onclick = function () { ask(input.value); };
    row.appendChild(input); row.appendChild(go);
    panel.appendChild(row);

    panel.appendChild(el('div', 'min-height:14px;font-size:11px;color:#9fb3bf;', ''))
      .id = 'antcv-aibot-status';
    // step-2-ready containers
    var log = el('div', ''); log.setAttribute('data-antcv-aibot-log', '1'); panel.appendChild(log);
    var rules = el('div', 'display:flex;gap:4px;flex-wrap:wrap;'); rules.setAttribute('data-antcv-aibot-rules', '1'); panel.appendChild(rules);

    document.body.appendChild(panel);
    setTimeout(function () { try { input.focus(); } catch (_) {} }, 50);
  }

  function setStatus(t, isErr) {
    var s = document.getElementById('antcv-aibot-status');
    if (s) { s.textContent = t || ''; s.style.color = isErr ? '#fda4af' : '#9fb3bf'; }
  }

  // ─── LLM call (through the cv-proxy root pipeline) ────────────────
  async function ask(instruction) {
    instruction = clean(instruction);
    if (!instruction || state.busy) return;
    var base = proxyBase();
    if (!base) { setStatus('No worker URL configured (Settings → Account).', true); return; }
    state.busy = true;
    setStatus('thinking…');
    try {
      var sys = 'You are AntCV\'s in-preview text editor. Rewrite ONLY the snippet the user selected, applying their instruction. '
        + 'HARD RULES: never invent facts, numbers, tools or names; keep every number and proper noun that is in the snippet unless the instruction says otherwise; '
        + 'use "-" never an em dash; no banned resume-speak (spearhead, leverage, robust, passionate, cross-functional, proven track record, responsible for, discuss); '
        + 'calm Scandinavian-professional register; roughly the same length unless asked to shorten. '
        + 'Return ONLY valid JSON: {"rewrite":"<the new text>","reason":"<ONE short line: what you changed and which rule guided it>"} — no markdown, no prose.';
      var res = await window.fetch(base + '/', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-provider': 'anthropic' },
        body: JSON.stringify({
          model: MODEL, max_tokens: 400, stream: false,
          system: sys,
          messages: [{ role: 'user', content: 'INSTRUCTION: ' + instruction + '\n\nSELECTED TEXT:\n' + state.sel }],
        }),
      });
      var raw = await res.text();
      if (!res.ok) throw new Error('LLM call failed (' + res.status + ')');
      var data = JSON.parse(raw);
      var txt = (data && data.content && data.content[0] && data.content[0].text) || '';
      var m = txt.match(/\{[\s\S]*\}/);
      var out = m ? JSON.parse(m[0]) : null;
      if (!out || !clean(out.rewrite)) throw new Error('No rewrite in the response');
      showResult(clean(out.rewrite), clean(out.reason || ''));
      setStatus('');
    } catch (e) {
      setStatus(String((e && e.message) || e), true);
    } finally { state.busy = false; }
  }

  // ─── result + apply / undo ────────────────────────────────────────
  function showResult(rewrite, reason) {
    var log = document.querySelector('[data-antcv-aibot-log]');
    if (!log) return;
    log.innerHTML = '';
    state.lastRewrite = rewrite;
    var box = el('div', 'background:rgba(126,255,212,0.07);border:1px solid rgba(1,183,187,0.45);border-radius:8px;'
      + 'padding:7px 9px;margin:6px 0 4px;font-size:12.5px;color:#eafff7;');
    box.textContent = rewrite;
    log.appendChild(box);
    if (reason) log.appendChild(el('div', 'font-size:11px;color:#8fd4c8;margin-bottom:6px;', 'Why: ' + reason));
    var row = el('div', 'display:flex;gap:6px;');
    var apply = el('button', 'font-size:12px;font-weight:700;padding:5px 12px;border-radius:8px;border:none;background:#01B7BB;color:#06262b;cursor:pointer;', 'Apply');
    apply.onclick = function () { applyRewrite(rewrite, row); };
    var discard = el('button', 'font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid rgba(255,255,255,0.25);background:none;color:#cfdde4;cursor:pointer;', 'Discard');
    discard.onclick = function () { log.innerHTML = ''; };
    row.appendChild(apply); row.appendChild(discard);
    log.appendChild(row);
  }

  function applyRewrite(rewrite, row) {
    try {
      var raw = localStorage.getItem('sections');
      if (!raw) { setStatus('No sections store found.', true); return; }
      var snapshot = raw;
      var bundle = JSON.parse(raw);
      var target = clean(state.sel);
      var replaced = { done: false };
      var visit = function (obj, key) {
        if (replaced.done) return;
        var v = obj[key];
        if (typeof v === 'string') {
          var idx = clean(v).indexOf(target);
          if (idx >= 0) {
            // replace on the RAW string: find the raw occurrence by a
            // whitespace-tolerant regex built from the cleaned target.
            var pat = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '[\\s\\u00a0]+');
            var re = new RegExp(pat);
            if (re.test(v)) { obj[key] = v.replace(re, rewrite); replaced.done = true; }
          }
        } else if (Array.isArray(v)) {
          for (var i = 0; i < v.length; i++) visit(v, i);
        } else if (v && typeof v === 'object') {
          for (var k in v) visit(v, k);
        }
      };
      for (var doc of ['cv', 'cl']) {
        if (Array.isArray(bundle[doc])) visit(bundle, doc);
        if (replaced.done) break;
      }
      if (!replaced.done) { setStatus('Could not locate the selected text in the stored document — edit it in the editor panel instead.', true); return; }
      localStorage.setItem('sections', JSON.stringify(bundle));
      state.undo = snapshot;
      try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'preview-chatbot-405' } })); } catch (_) {}
      setStatus('Applied.');
      if (row) {
        row.innerHTML = '';
        var undo = el('button', 'font-size:12px;padding:5px 12px;border-radius:8px;border:1px solid #f59e0b;background:rgba(245,158,11,0.12);color:#fcd34d;cursor:pointer;', '↩ Undo');
        undo.onclick = function () {
          try {
            if (state.undo) {
              localStorage.setItem('sections', state.undo);
              state.undo = null;
              window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'preview-chatbot-405-undo' } }));
              setStatus('Undone.');
              closePanel();
            }
          } catch (_) {}
        };
        row.appendChild(undo);
      }
    } catch (e) {
      setStatus('Apply failed: ' + String((e && e.message) || e), true);
    }
  }

  // close pill/panel on outside click + Escape
  document.addEventListener('mousedown', function (ev) {
    var p = document.getElementById(PANEL_ID);
    if (p && !p.contains(ev.target)) closePanel();
  }, true);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') { removePill(); closePanel(); }
  });

  window.AntcvPreviewChatbot = { version: VERSION, open: openPanel, ask: ask, _state: state };
  try { console.debug('[preview-chatbot] stage 1 installed v' + VERSION); } catch (_) {}
})();
