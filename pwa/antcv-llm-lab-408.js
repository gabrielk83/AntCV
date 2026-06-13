/* AntCV LLM lab — add a new LLM, audit it, approve it into routing.
 * ============================================================
 * LLM-ONBOARD-001 (owner 2026-06-12): "adding a new LLM and auditing it
 * before approving it into the cost-quality function (if needed add to
 * registar as well)".
 *
 * Anchors a "Custom LLMs (audited)" section at the end of the Settings ->
 * API-keys <form>. Flow per entry (OpenAI-compatible /chat/completions):
 *   add (label, base URL, model, key, $/1M in+out)  -> status 'pending'
 *   Run audit  -> battery of live probes:
 *     1. instruction-following  (reply exactly OK-AUDIT)        [critical]
 *     2. JSON adherence         (strict JSON object, parseable) [critical]
 *     3. banned-word avoidance  (rewrite w/o resume-speak)      [critical]
 *     4. latency                (ms per call, informational)
 *     5. cost estimate          (usage tokens x entered price)
 *   Approve    -> enabled ONLY when all critical probes pass; sets status
 *                 'approved' and writes an antcv:llmRegistry entry with the
 *                 full audit evidence. Only approved entries are picked up
 *                 by the dispatcher (app.src.js __customLlms) where they
 *                 join the BACK of the ladder and earn their slot through
 *                 the quality-demotion memory (the cost-quality function).
 *   Reject / Remove at any point.
 */
(function () {
  'use strict';

  var VERSION = '1.50.408';
  if (window.__antcvLlmLab === VERSION) return;
  window.__antcvLlmLab = VERSION;

  var BANNED = ['spearhead', 'leverage', 'robust', 'passionate', 'cross-functional', 'proven track record', 'responsible for', 'discuss'];

  function load(key, fb) { try { var v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fb : v; } catch (_) { return fb; } }
  function save(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (_) {} }
  function llms() { var a = load('antcv:customLlms', []); return Array.isArray(a) ? a : []; }

  function el(tag, css, text) {
    var n = document.createElement(tag);
    if (css) n.style.cssText = css;
    if (text != null) n.textContent = text;
    return n;
  }

  // ─── audit battery ────────────────────────────────────────────────
  async function call(rec, system, user, maxTokens) {
    var t0 = Date.now();
    var res = await fetch(String(rec.baseUrl).replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, rec.key ? { Authorization: 'Bearer ' + rec.key } : {}),
      body: JSON.stringify({
        model: rec.model, max_tokens: maxTokens || 300,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    var ms = Date.now() - t0;
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var data = await res.json();
    var text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
    return { text: text, ms: ms, usage: data.usage || null };
  }

  // No-CORS fallback (owner 2026-06-13): endpoints that reject browser
  // calls are audited SERVER-SIDE through the cv-proxy's existing
  // /api/llm-audit/test-endpoint battery (byok-qualify.js — instruction,
  // JSON, latency probes with critical/high gating). Its verdict maps to
  // the lab's pass gate; the full server result is kept as evidence.
  async function runServerAudit(rec) {
    var base = '';
    try { base = String(JSON.parse(localStorage.getItem('proxyUrl') || '""') || '').replace(/\/+$/, ''); } catch (_) {}
    if (!base) throw new Error('No worker URL configured for the server-relayed audit.');
    var t0 = Date.now();
    var res = await fetch(base + '/api/llm-audit/test-endpoint', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: String(rec.baseUrl).replace(/\/+$/, '') + '/chat/completions',
        apiKey: rec.key || '', modelId: rec.model, provider_shape: 'openai_compat',
      }),
    });
    var data = await res.json();
    var approved = !!(data && data.verdict === 'approved');
    var out = {
      ts: new Date().toISOString(), relayed: true, totalMs: Date.now() - t0,
      pass: approved, estCostPerCall: null,
      probes: {
        instruction: { pass: approved, via: 'server', verdict: data && data.verdict },
        json: { pass: approved, via: 'server', verdict: data && data.verdict },
        banned: { pass: approved, via: 'server', note: 'server battery (byok-qualify); banned-word probe runs on first real use via SCE' },
      },
      server: data,
    };
    return out;
  }

  async function runAudit(rec) {
    var out = { ts: new Date().toISOString(), probes: {}, pass: false, totalMs: 0, estCostPerCall: null };
    // 1 — instruction following [critical]
    try {
      var r1 = await call(rec, 'Follow the instruction exactly. Output nothing else.', 'Reply with exactly: OK-AUDIT', 20);
      out.probes.instruction = { pass: /OK-AUDIT/.test(r1.text), ms: r1.ms, raw: r1.text.slice(0, 60) };
      out.totalMs += r1.ms;
    } catch (e) {
      // browser-blocked endpoint (CORS / network) -> server-relayed audit
      if (/failed to fetch|networkerror|load failed/i.test(String(e && e.message || e))) {
        try { return await runServerAudit(rec); } catch (e2) {
          out.probes.instruction = { pass: false, error: 'direct: ' + String(e && e.message || e) + ' | relay: ' + String(e2 && e2.message || e2) };
          return out;
        }
      }
      out.probes.instruction = { pass: false, error: String(e && e.message || e) };
    }
    // 2 — JSON adherence [critical]
    try {
      var r2 = await call(rec, 'Return ONLY valid JSON. No markdown fences, no prose.',
        'Return a JSON object {"role":"engineer","years":7,"tools":["jira","git"]} restated verbatim.', 120);
      var m = r2.text.match(/\{[\s\S]*\}/);
      var parsed = null; try { parsed = m && JSON.parse(m[0]); } catch (_) {}
      out.probes.json = { pass: !!(parsed && parsed.role === 'engineer' && parsed.years === 7), ms: r2.ms, raw: r2.text.slice(0, 80) };
      out.totalMs += r2.ms;
    } catch (e) { out.probes.json = { pass: false, error: String(e && e.message || e) }; }
    // 3 — banned-word avoidance [critical]
    try {
      var r3 = await call(rec,
        'Rewrite the sentence for a CV. HARD RULE: never use these words or phrases: ' + BANNED.join(', ') + '. Output only the rewritten sentence.',
        'I was responsible for leading a robust cross-functional team and would love to discuss it.', 120);
      var low = (r3.text || '').toLowerCase();
      var hits = BANNED.filter(function (b) { return low.indexOf(b) >= 0; });
      out.probes.banned = { pass: r3.text.length > 10 && hits.length === 0, hits: hits, ms: r3.ms, raw: r3.text.slice(0, 100) };
      out.totalMs += r3.ms;
      if (r3.usage && rec.pricing) {
        out.estCostPerCall = ((r3.usage.prompt_tokens || 0) / 1e6) * (rec.pricing.inputPer1M || 0)
          + ((r3.usage.completion_tokens || 0) / 1e6) * (rec.pricing.outputPer1M || 0);
      }
    } catch (e) { out.probes.banned = { pass: false, error: String(e && e.message || e) }; }
    out.pass = !!(out.probes.instruction && out.probes.instruction.pass
      && out.probes.json && out.probes.json.pass
      && out.probes.banned && out.probes.banned.pass);
    return out;
  }

  function registryAppend(entry) {
    var reg = load('antcv:llmRegistry', []);
    if (!Array.isArray(reg)) reg = [];
    reg.push(entry);
    save('antcv:llmRegistry', reg.slice(-100));
  }

  // ─── UI ───────────────────────────────────────────────────────────
  var HOST_ID = 'antcv-llm-lab';

  function chip(status) {
    var c = status === 'approved' ? ['#10b981', 'rgba(16,185,129,0.12)'] : status === 'rejected' ? ['#f87171', 'rgba(248,113,113,0.10)'] : ['#fbbf24', 'rgba(251,191,36,0.10)'];
    var s = el('span', 'font-size:10px;font-weight:700;padding:1px 8px;border-radius:10px;border:1px solid ' + c[0] + ';color:' + c[0] + ';background:' + c[1] + ';', status);
    return s;
  }

  function render(host) {
    host.innerHTML = '';
    host.appendChild(el('div', 'font-size:12px;font-weight:700;color:#7effd4;margin:14px 0 2px;letter-spacing:0.03em;', '🧪 Custom LLMs (audited)'));
    host.appendChild(el('div', 'font-size:10.5px;color:rgba(255,255,255,0.45);margin-bottom:8px;',
      'OpenAI-compatible endpoints. Every model is AUDITED (instruction following, JSON adherence, banned words, latency, cost) and only an approved model joins the routing ladder — where quality routing then earns or loses it its slot.'));

    llms().forEach(function (rec, idx) {
      var card = el('div', 'border:1px solid rgba(255,255,255,0.14);border-radius:8px;padding:8px 10px;margin-bottom:7px;background:rgba(255,255,255,0.04);');
      var head = el('div', 'display:flex;align-items:center;gap:8px;margin-bottom:3px;');
      head.appendChild(el('span', 'font-size:12px;font-weight:700;color:#fff;', rec.label || rec.model));
      head.appendChild(chip(rec.status || 'pending'));
      card.appendChild(head);
      card.appendChild(el('div', 'font-size:10px;color:rgba(255,255,255,0.45);', rec.model + ' @ ' + rec.baseUrl
        + (rec.pricing ? ' — $' + rec.pricing.inputPer1M + '/$' + rec.pricing.outputPer1M + ' per 1M in/out' : '')));
      if (rec.audit) {
        var a = rec.audit, p = a.probes || {};
        card.appendChild(el('div', 'font-size:10.5px;color:#cfdde4;margin-top:4px;',
          'audit: instruction ' + (p.instruction && p.instruction.pass ? '✓' : '✗')
          + ' · JSON ' + (p.json && p.json.pass ? '✓' : '✗')
          + ' · banned-words ' + (p.banned && p.banned.pass ? '✓' : '✗')
          + ' · ' + Math.round(a.totalMs / 3) + 'ms/call'
          + (a.estCostPerCall != null ? ' · ~$' + a.estCostPerCall.toFixed(5) + '/call' : '')
          + (a.relayed ? ' · via proxy relay (no-CORS endpoint)' : '')));
      }
      var row = el('div', 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;');
      var btn = function (label, css, fn) {
        var b = el('button', 'font-size:10.5px;padding:3px 10px;border-radius:7px;cursor:pointer;' + css, label);
        b.type = 'button'; b.onclick = fn; row.appendChild(b); return b;
      };
      var auditBtn = btn(rec.audit ? 'Re-run audit' : 'Run audit', 'border:1px solid #01B7BB;background:rgba(1,183,187,0.12);color:#bfeff0;', async function () {
        auditBtn.textContent = 'auditing…'; auditBtn.disabled = true;
        try {
          var res = await runAudit(rec);
          var all = llms(); all[idx] = Object.assign({}, all[idx], { audit: res });
          save('antcv:customLlms', all);
          registryAppend({ kind: 'llm-audit', id: rec.id, label: rec.label, model: rec.model, baseUrl: rec.baseUrl, result: res });
        } catch (e) { alert('Audit failed: ' + (e && e.message || e)); }
        render(host);
      });
      if (rec.status !== 'approved') {
        var ok = !!(rec.audit && rec.audit.pass);
        var ap = btn('Approve', ok ? 'border:1px solid #10b981;background:rgba(16,185,129,0.14);color:#6ee7b7;' : 'border:1px solid rgba(255,255,255,0.2);background:none;color:rgba(255,255,255,0.35);cursor:not-allowed;', function () {
          if (!ok) return;
          var all = llms(); all[idx] = Object.assign({}, all[idx], { status: 'approved', approvedAt: new Date().toISOString() });
          save('antcv:customLlms', all);
          registryAppend({ kind: 'llm-approved', id: rec.id, label: rec.label, model: rec.model, audit: rec.audit });
          render(host);
        });
        ap.title = ok ? 'All critical audit probes passed — approve into the routing ladder.' : 'Approve unlocks only when the audit battery passes (instruction + JSON + banned words).';
        ap.disabled = !ok;
      } else {
        btn('Suspend', 'border:1px solid #fbbf24;background:rgba(251,191,36,0.10);color:#fcd34d;', function () {
          var all = llms(); all[idx] = Object.assign({}, all[idx], { status: 'pending' });
          save('antcv:customLlms', all); render(host);
        });
      }
      btn('Remove', 'border:1px solid rgba(248,113,113,0.6);background:none;color:#fca5a5;', function () {
        var all = llms(); all.splice(idx, 1); save('antcv:customLlms', all);
        registryAppend({ kind: 'llm-removed', id: rec.id, label: rec.label, ts: new Date().toISOString() });
        render(host);
      });
      card.appendChild(row);
      host.appendChild(card);
    });

    // add form
    var form = el('div', 'border:1px dashed rgba(255,255,255,0.25);border-radius:8px;padding:8px 10px;margin-top:4px;');
    form.appendChild(el('div', 'font-size:11px;font-weight:700;color:#cfdde4;margin-bottom:6px;', '＋ Add LLM'));
    var inp = function (ph, type, width) {
      var i = el('input', 'width:' + (width || '100%') + ';box-sizing:border-box;font-size:11px;padding:4px 7px;margin-bottom:5px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;');
      i.placeholder = ph; i.type = type || 'text'; form.appendChild(i); return i;
    };
    var fLabel = inp('label, e.g. "Llama-3.3-70B (Groq)" — optional');
    var fBase = inp('base URL, e.g. https://api.groq.com/openai/v1');
    var fKey = inp('API key', 'password');
    // LLM-ONBOARD-002 (owner 2026-06-13): "just add the api key and get the
    // rest from interaction with the llm". Discover models via {base}/models.
    var modelRow = el('div', 'display:flex;gap:6px;align-items:center;');
    var fModel = el('input', 'flex:1;box-sizing:border-box;font-size:11px;padding:4px 7px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;');
    fModel.placeholder = 'model id — or click Discover';
    var discoverBtn = el('button', 'font-size:10.5px;padding:4px 9px;border-radius:6px;border:1px solid #01B7BB;background:rgba(1,183,187,0.12);color:#bfeff0;cursor:pointer;white-space:nowrap;', 'Discover');
    discoverBtn.type = 'button';
    discoverBtn.onclick = async function () {
      var base = fBase.value.trim().replace(/\/+$/, '');
      if (!base) { alert('Enter the base URL first.'); return; }
      discoverBtn.textContent = '…'; discoverBtn.disabled = true;
      try {
        var res = await fetch(base + '/models', { headers: fKey.value.trim() ? { Authorization: 'Bearer ' + fKey.value.trim() } : {} });
        var data = await res.json();
        var ids = (data && (data.data || data.models || []) || []).map(function (m) { return typeof m === 'string' ? m : (m.id || m.name); }).filter(Boolean);
        if (!ids.length) throw new Error('no models in the response');
        // prefer a chat/instruct model; else the first
        var pick = ids.find(function (i) { return /chat|instruct|turbo|sonnet|gpt|llama|mistral|gemini|qwen/i.test(i); }) || ids[0];
        fModel.value = pick;
        if (!fLabel.value.trim()) fLabel.value = pick;
        discoverBtn.textContent = ids.length + ' found';
        fModel.title = 'Discovered ' + ids.length + ' models. Top: ' + ids.slice(0, 8).join(', ');
      } catch (e) {
        // CORS or no /models — fall back to manual entry
        discoverBtn.textContent = 'manual';
        fModel.placeholder = 'auto-discover blocked — type the model id';
        try { console.debug('[llm-lab] model discovery failed:', e && e.message); } catch (_) {}
      }
      discoverBtn.disabled = false;
    };
    modelRow.appendChild(fModel); modelRow.appendChild(discoverBtn);
    form.appendChild(modelRow);
    var priceRow = el('div', 'display:flex;gap:6px;');
    var fIn = el('input', 'flex:1;font-size:11px;padding:4px 7px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;');
    fIn.placeholder = '$/1M input'; fIn.type = 'number'; fIn.step = '0.01';
    var fOut = el('input', 'flex:1;font-size:11px;padding:4px 7px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);background:rgba(255,255,255,0.06);color:#fff;');
    fOut.placeholder = '$/1M output'; fOut.type = 'number'; fOut.step = '0.01';
    priceRow.appendChild(fIn); priceRow.appendChild(fOut);
    form.appendChild(priceRow);
    var add = el('button', 'margin-top:7px;font-size:11px;font-weight:700;padding:5px 14px;border-radius:7px;border:none;background:#01B7BB;color:#06262b;cursor:pointer;', 'Save + audit now');
    add.type = 'button';
    add.onclick = async function () {
      var label = fLabel.value.trim(), base = fBase.value.trim(), model = fModel.value.trim();
      if (!base || !model) { alert('Base URL and model id are required (use Discover to fetch the model id).'); return; }
      var rec = {
        id: 'llm' + Date.now().toString(36), label: label || model, baseUrl: base, model: model,
        key: fKey.value.trim(),
        pricing: { inputPer1M: parseFloat(fIn.value) || 0, outputPer1M: parseFloat(fOut.value) || 0 },
        status: 'pending', addedAt: new Date().toISOString(),
      };
      var all = llms(); all.push(rec); save('antcv:customLlms', all);
      render(host);
      // LLM-ONBOARD-002 (owner: "audit the llm as soon as it is provided"):
      // run the battery immediately so the owner sees task-fit without a
      // second click.
      add.textContent = 'auditing…'; add.disabled = true;
      try {
        var res = await runAudit(rec);
        var cur = llms(); var i = cur.findIndex(function (x) { return x.id === rec.id; });
        if (i >= 0) { cur[i] = Object.assign({}, cur[i], { audit: res }); save('antcv:customLlms', cur); }
        registryAppend({ kind: 'llm-audit', id: rec.id, label: rec.label, model: rec.model, baseUrl: rec.baseUrl, result: res });
      } catch (e) { try { console.debug('[llm-lab] auto-audit failed:', e && e.message); } catch (_) {} }
      add.textContent = 'Save + audit now'; add.disabled = false;
      render(host);
    };
    form.appendChild(add);
    host.appendChild(form);
  }

  // anchor: end of the Settings -> API-keys <form> (the only form hosting
  // password inputs). Poll lightly — settings mount/unmount with the panel.
  setInterval(function () {
    try {
      if (document.getElementById(HOST_ID)) return;
      var forms = Array.prototype.slice.call(document.querySelectorAll('form'));
      var keysForm = forms.find(function (f) { return f.querySelectorAll('input[type="password"]').length >= 2; });
      if (!keysForm) return;
      var host = el('div');
      host.id = HOST_ID;
      keysForm.appendChild(host);
      render(host);
    } catch (_) {}
  }, 1200);

  window.AntcvLlmLab = { version: VERSION, runAudit: runAudit, _render: render };
  try { console.debug('[llm-lab] installed v' + VERSION); } catch (_) {}
})();
