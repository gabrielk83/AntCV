/* AntCV LLM orchestration audit (v1.40.172)
 * ============================================================
 *
 * Purpose
 * -------
 * The app does many distinct LLM-driven tasks. Each task has its
 * own definition of "good output". This sidecar:
 *
 *   1. Defines a TASK CATALOG — every distinct LLM task the app
 *      performs and the quality signals worth measuring for it.
 *   2. Maintains a per-task per-provider LEDGER in localStorage —
 *      running counts of {good, bad, banned_word_hits, latency_ms,
 *      tokens_in, tokens_out} for every (task, provider) pair the
 *      app has ever called.
 *   3. Auto-records the banned-word signal from the existing
 *      antcv-banned-audit sidecar's `antcv:banned-hits` event.
 *      Manual record() lets other code feed in more signals.
 *   4. Exposes a scoresFor(taskId) summary computed from the
 *      ledger, used by future orchestration code to pick the best
 *      provider for a task.
 *   5. Defines a TEST BATTERY (canned prompts + scoring) for
 *      qualifying a user-supplied LLM endpoint when BYOK is added
 *      in a later release. The actual test-call dispatch lives
 *      in cv-proxy; this sidecar only defines what to run and
 *      how to score the result.
 *
 * Why a sidecar
 * -------------
 * App.js is a single minified blob; the audit is cross-cutting
 * and accumulates state across many call sites. A sidecar keeps
 * that state out of the React tree, exposes a clean window-level
 * API, and can be reasoned about / replaced independently.
 *
 * Storage
 * -------
 * The ledger is stored under one key:
 *
 *   localStorage["antcv:llm-audit:ledger"] = JSON.stringify({
 *     v: 1,
 *     updatedAt: 1747929600000,
 *     entries: {
 *       "generate_full:anthropic": { good: 8, bad: 2, banned: 1, ms_total: 18400, n: 10 },
 *       "generate_full:openai":    { good: 6, bad: 4, banned: 3, ms_total: 22100, n: 10 },
 *       ...
 *     }
 *   })
 *
 * Public API
 * ----------
 *   window.AntcvLLMAudit.TASKS                 — task catalog
 *   window.AntcvLLMAudit.PROVIDERS             — known provider ids
 *   window.AntcvLLMAudit.record(taskId, providerId, signals)
 *   window.AntcvLLMAudit.scoresFor(taskId)     — per-provider score 0..1
 *   window.AntcvLLMAudit.bestProviderFor(taskId)
 *   window.AntcvLLMAudit.report(taskId?)       — readable summary
 *   window.AntcvLLMAudit.TEST_BATTERY          — BYOK qualification specs
 *   window.AntcvLLMAudit.qualifyEndpoint(opts) — stub; full impl needs cv-proxy
 *   window.AntcvLLMAudit.reset()               — clear ledger
 *   window.AntcvLLMAudit.export()              — full JSON
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.172';
  const LEDGER_KEY = 'antcv:llm-audit:ledger';
  const LEDGER_SCHEMA_VERSION = 1;

  if (window.__antcvLLMAuditInstalled) return;
  window.__antcvLLMAuditInstalled = SCRIPT_VERSION;

  // ─── Storage helpers ─────────────────────────────────────────────
  function readLedger() {
    try {
      const raw = localStorage.getItem(LEDGER_KEY);
      if (!raw) return blankLedger();
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== LEDGER_SCHEMA_VERSION) return blankLedger();
      if (!parsed.entries || typeof parsed.entries !== 'object') parsed.entries = {};
      return parsed;
    } catch (_) { return blankLedger(); }
  }
  function writeLedger(ledger) {
    try {
      ledger.updatedAt = Date.now();
      localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
    } catch (e) { console.warn('[llm-audit] write failed', e); }
  }
  function blankLedger() {
    return { v: LEDGER_SCHEMA_VERSION, updatedAt: 0, entries: {} };
  }
  function ensureEntry(ledger, taskId, providerId) {
    const key = taskId + ':' + providerId;
    if (!ledger.entries[key]) {
      ledger.entries[key] = {
        n: 0,           // total calls
        good: 0,        // calls with no negative signals
        bad: 0,         // calls with at least one negative signal
        banned: 0,      // total banned-term hits
        placeholder: 0, // total placeholder-rate signals
        json_invalid: 0,// JSON.parse failures
        ms_total: 0,    // cumulative latency
        tokens_in: 0,
        tokens_out: 0,
        lastAt: 0,
      };
    }
    return ledger.entries[key];
  }

  // ─── Task catalog ────────────────────────────────────────────────
  // Each task records (a) what it does in user terms and (b) which
  // signals are RELEVANT for it. A signal not in `signals` is still
  // recorded if reported, but doesn't enter the per-task score.
  const TASKS = Object.freeze({
    generate_full: {
      label: 'Generate full CV + cover letter from JD',
      description: 'The big initial call. Reads JD + user background, produces every section in one shot.',
      signals: ['json_valid', 'placeholder_rate', 'banned_words', 'length_ok'],
      criticality: 'high',
    },
    kernel_showcase: {
      label: 'Kernel-based showcase regeneration',
      description: 'Re-runs the showcase using the user-curated kernel (post-extraction).',
      signals: ['json_valid', 'placeholder_rate', 'banned_words'],
      criticality: 'high',
    },
    extract_kernel: {
      label: 'Extract structured kernel from JD',
      description: 'Pulls a structured representation of the role from the raw JD text.',
      signals: ['json_valid', 'fields_complete'],
      criticality: 'high',
    },
    jd_analysis: {
      label: 'Job description analysis',
      description: 'Pre-generation scan: role flavour, banned-by-employer terms, must-haves.',
      signals: ['json_valid', 'fields_complete'],
      criticality: 'medium',
    },
    enrich_section: {
      label: 'Enrich a single section',
      description: 'Run only when the user clicks ✨ on a section. Refines text + emojis if applicable.',
      signals: ['json_valid', 'banned_words', 'length_ok'],
      criticality: 'high',
    },
    translate_chunk: {
      label: 'Translate a section chunk (EN ↔ DA)',
      description: 'Per-chunk EN/DA translation. Must preserve numbers, proper nouns, emojis.',
      signals: ['json_valid', 'preserve_numbers', 'preserve_emojis'],
      criticality: 'high',
    },
    compress_section: {
      label: 'Compress a section to fit budget',
      description: 'Tightens prose without losing key signals. Output must still be in spec.',
      signals: ['length_ok', 'banned_words', 'placeholder_rate'],
      criticality: 'medium',
    },
    repair_json: {
      label: 'Repair truncated / invalid JSON',
      description: 'Recovery path. Only fires when the primary call returned unparseable text.',
      signals: ['json_valid'],
      criticality: 'low',
    },
    pdf_extract: {
      label: 'Extract text from PDF (LLM tier)',
      description: 'Second-tier extraction when PDF.js produces gibberish — used for garbled fonts.',
      signals: ['extraction_ok', 'cid_artifacts'],
      criticality: 'medium',
    },
    ocr_image: {
      label: 'OCR a JD image',
      description: 'When the user pastes/uploads an image of a JD.',
      signals: ['extraction_ok'],
      criticality: 'medium',
    },
    supervisor_check: {
      label: 'Supervisor: post-generation policy check',
      description: 'Reviews generated output for banned terms, gaps, placeholders, length.',
      signals: ['fields_complete', 'banned_words'],
      criticality: 'medium',
    },
  });

  const PROVIDERS = Object.freeze({
    anthropic:  { label: 'Claude (Anthropic)',     keyPrefix: 'sk-ant-' },
    openai:     { label: 'GPT-4o (OpenAI)',        keyPrefix: 'sk-'     },
    mistral:    { label: 'Mistral',                keyPrefix: null      },
    gemini:     { label: 'Gemini (Google)',        keyPrefix: null      },
    custom:     { label: 'Custom endpoint (BYOK)', keyPrefix: null      },
  });

  // Per-signal severity (1 negative signal of severity 1.0 fully marks
  // the call "bad"; lower-severity signals merely reduce the score).
  const SIGNAL_WEIGHT = Object.freeze({
    json_valid:        1.0,  // primary — if false, the call effectively failed
    placeholder_rate:  0.6,  // "13 sections with placeholders" class of bug
    banned_words:      0.4,  // each banned-word hit drops score
    length_ok:         0.3,
    fields_complete:   0.5,
    preserve_numbers:  0.5,
    preserve_emojis:   0.2,
    extraction_ok:     1.0,
    cid_artifacts:     0.4,  // negative — fewer artifacts is better
  });

  // ─── Recording API ───────────────────────────────────────────────
  // `signals` is an object whose keys are signal ids. Values:
  //   - true  ⇒ signal PASSED (no penalty)
  //   - false ⇒ signal FAILED (full penalty per SIGNAL_WEIGHT)
  //   - number ⇒ count of failed sub-signals (e.g., banned_words: 3 means 3 hits)
  //   - null/undefined ⇒ not measured (skipped)
  //
  // Extra fields recognised:
  //   ms          — call latency in ms
  //   tokens_in   — input tokens
  //   tokens_out  — output tokens
  //   error       — string; if present, the call failed altogether
  function record(taskId, providerId, signals) {
    if (!taskId || !providerId) return false;
    if (!PROVIDERS[providerId]) {
      // Unknown providers are still recorded — useful for BYOK 'custom'
      // calls that haven't been registered as a named provider yet.
    }
    const ledger = readLedger();
    const entry = ensureEntry(ledger, taskId, providerId);
    const sig = signals || {};

    entry.n += 1;
    entry.lastAt = Date.now();
    if (typeof sig.ms === 'number') entry.ms_total += sig.ms;
    if (typeof sig.tokens_in === 'number') entry.tokens_in += sig.tokens_in;
    if (typeof sig.tokens_out === 'number') entry.tokens_out += sig.tokens_out;

    let badForCall = false;
    if (sig.error) badForCall = true;
    if (sig.json_valid === false) { entry.json_invalid += 1; badForCall = true; }
    if (typeof sig.banned_words === 'number' && sig.banned_words > 0) {
      entry.banned += sig.banned_words;
      badForCall = true;
    }
    if (typeof sig.placeholder_rate === 'number' && sig.placeholder_rate > 0) {
      entry.placeholder += sig.placeholder_rate;
      badForCall = true;
    }
    if (sig.length_ok === false) badForCall = true;
    if (sig.fields_complete === false) badForCall = true;
    if (sig.preserve_numbers === false) badForCall = true;
    if (sig.preserve_emojis === false) badForCall = true;
    if (sig.extraction_ok === false) badForCall = true;

    if (badForCall) entry.bad += 1;
    else entry.good += 1;

    writeLedger(ledger);
    try {
      window.dispatchEvent(new CustomEvent('antcv:llm-audit:recorded', {
        detail: { taskId, providerId, signals: sig, entry: Object.assign({}, entry) },
      }));
    } catch (_) {}
    return true;
  }

  // ─── Scoring ─────────────────────────────────────────────────────
  function scoresFor(taskId) {
    const ledger = readLedger();
    const out = {};
    Object.keys(ledger.entries).forEach(function (key) {
      const dot = key.indexOf(':');
      const t = key.slice(0, dot);
      const p = key.slice(dot + 1);
      if (t !== taskId) return;
      const e = ledger.entries[key];
      if (!e.n) return;
      // Composite score in [0, 1].
      //   good/n  is the headline pass rate.
      //   Penalties subtract for per-call signal hits, normalised by n.
      const passRate = e.good / e.n;
      const penalty = (
        (e.banned * SIGNAL_WEIGHT.banned_words / e.n) +
        (e.placeholder * SIGNAL_WEIGHT.placeholder_rate / e.n) +
        (e.json_invalid * SIGNAL_WEIGHT.json_valid / e.n)
      ) * 0.5;  // overall penalty cap
      const score = Math.max(0, Math.min(1, passRate - penalty));
      out[p] = {
        score: Math.round(score * 100) / 100,
        passRate: Math.round(passRate * 100) / 100,
        n: e.n,
        bannedHits: e.banned,
        placeholderHits: e.placeholder,
        jsonInvalidHits: e.json_invalid,
        avgMs: e.n ? Math.round(e.ms_total / e.n) : 0,
        tokensInTotal: e.tokens_in,
        tokensOutTotal: e.tokens_out,
      };
    });
    return out;
  }

  function bestProviderFor(taskId, opts) {
    const minN = (opts && opts.minSamples) || 3;
    const scores = scoresFor(taskId);
    let best = null;
    Object.keys(scores).forEach(function (p) {
      const s = scores[p];
      if (s.n < minN) return;          // not enough data
      if (!best || s.score > best.score) best = Object.assign({ provider: p }, s);
    });
    return best;
  }

  function report(taskId) {
    if (taskId) {
      return { task: TASKS[taskId] || { label: taskId }, providers: scoresFor(taskId) };
    }
    const out = {};
    Object.keys(TASKS).forEach(function (t) { out[t] = scoresFor(t); });
    return out;
  }

  // ─── Auto-subscribe to existing audit events ─────────────────────
  // The banned-audit sidecar fires antcv:banned-hits after every LLM
  // update. We translate those into per-call records for the audit
  // ledger. The source string maps to a task id.
  const SOURCE_TO_TASK = {
    generate:        'generate_full',
    kernel:          'kernel_showcase',
    showcase:        'kernel_showcase',
    enrich:          'enrich_section',
    translate:       'translate_chunk',
    merge:           'generate_full',  // post-LLM merge runs after generate
  };

  function taskIdFromSource(src) {
    if (!src) return null;
    const k = String(src).toLowerCase();
    for (const key in SOURCE_TO_TASK) {
      if (k.indexOf(key) !== -1) return SOURCE_TO_TASK[key];
    }
    return null;
  }

  function inferProvider() {
    // Best-effort: read the user's chosen primary provider from the
    // existing routing prefs. Falls back to 'anthropic' (cascade default).
    try {
      const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}');
      const routing = (pi && pi.routing) || {};
      if (routing.primary && PROVIDERS[routing.primary]) return routing.primary;
    } catch (_) {}
    try {
      const sel = localStorage.getItem('antcv:selectedProvider');
      if (sel && PROVIDERS[sel]) return sel;
    } catch (_) {}
    return 'anthropic';
  }

  window.addEventListener('antcv:banned-hits', function (ev) {
    const d = ev && ev.detail;
    if (!d) return;
    const taskId = taskIdFromSource(d.source);
    if (!taskId) return;
    const providerId = inferProvider();
    record(taskId, providerId, {
      banned_words: (d.hits && d.hits.length) || 0,
      // We don't know the latency from this event — the recorder is
      // willing to receive partial signals; latency just doesn't get
      // updated this round.
    });
  });

  // ─── BYOK test battery ───────────────────────────────────────────
  // Six canned probes the BYOK qualification step will run against a
  // user-supplied endpoint to qualify it for app tasks. Each probe
  // returns a pass/fail per signal; the qualification verdict is
  // computed from those.
  const TEST_BATTERY = Object.freeze({
    json_compact: {
      task: 'extract_kernel',
      prompt:
        'Reply ONLY with valid JSON, no preamble. Schema: {"role":"string","seniority":"string","top_skills":["string"]}. ' +
        'Test JD: "Senior backend engineer, Go, Postgres, distributed systems, Copenhagen-based."',
      checks: ['json_valid', 'fields_complete'],
      timeout_ms: 30000,
    },
    placeholder_resilience: {
      task: 'generate_full',
      prompt:
        'You are filling a CV section. Reply ONLY with valid JSON: {"content":"string"}. ' +
        'Do not use placeholders like [name], [your role], or square-bracketed tokens. ' +
        'Subject: "Two-sentence professional profile for a structural engineer with 12 years experience."',
      checks: ['json_valid', 'placeholder_rate'],
      timeout_ms: 30000,
    },
    banned_word_compliance: {
      task: 'enrich_section',
      prompt:
        'Rewrite this bullet without using ANY of these words: leverage, robust, comprehensive, holistic, cross-functional. ' +
        'Reply ONLY with JSON: {"bullet":"string"}. ' +
        'Original: "Leveraged cross-functional teams to build a robust, comprehensive solution."',
      checks: ['json_valid', 'banned_words'],
      timeout_ms: 30000,
    },
    length_conformance: {
      task: 'compress_section',
      prompt:
        'Compress to UNDER 140 characters. Reply ONLY with JSON: {"compressed":"string"}. ' +
        'Original: "I have spent the last fifteen years working on optical and electro-optical systems across automotive, defence, and consumer applications, including LiDAR development at Innoviz, electro-optics design at Sirin Labs, and team management across multiple companies in Israel and Denmark."',
      checks: ['json_valid', 'length_ok'],
      timeout_ms: 30000,
    },
    number_preservation: {
      task: 'translate_chunk',
      prompt:
        'Translate to Danish, preserving ALL numbers exactly. Reply ONLY with JSON: {"da":"string"}. ' +
        'English: "Reduced cycle time from 250 to 10 days. Built 7-person team across 3 sites."',
      checks: ['json_valid', 'preserve_numbers'],
      timeout_ms: 30000,
    },
    emoji_preservation: {
      task: 'translate_chunk',
      prompt:
        'Translate to Danish, preserving ALL emojis exactly in the same positions. Reply ONLY with JSON: {"da":"string"}. ' +
        'English: "🚀 Launched product. 📉 Cut costs. 👥 Led the team."',
      checks: ['json_valid', 'preserve_emojis'],
      timeout_ms: 30000,
    },
  });

  // ─── Stub for BYOK qualification ─────────────────────────────────
  // Full implementation needs cv-proxy support for dispatching test
  // calls to a user-supplied endpoint. For now this returns a stub
  // verdict + the test battery so the future UI can preview what
  // qualification will exercise.
  async function qualifyEndpoint(opts) {
    if (!opts || !opts.url || !opts.apiKey) {
      return { ok: false, error: 'url and apiKey are required' };
    }
    // Future: POST to cv-proxy /api/llm-audit/test-endpoint with opts.
    return {
      ok: false,
      stub: true,
      battery: TEST_BATTERY,
      verdict: 'pending',
      message: 'BYOK qualification needs cv-proxy v3.2.0+ to dispatch the test battery. ' +
               'The test prompts above define what will be sent. Each probe will be scored against ' +
               'its `checks` array; an endpoint must pass all critical-tier probes (json_compact, ' +
               'placeholder_resilience, banned_word_compliance) to be approved for high-criticality tasks.',
    };
  }

  // ─── Public API ──────────────────────────────────────────────────

  window.AntcvLLMAudit = {
    version:           SCRIPT_VERSION,
    TASKS:             TASKS,
    PROVIDERS:         PROVIDERS,
    SIGNAL_WEIGHT:     SIGNAL_WEIGHT,
    TEST_BATTERY:      TEST_BATTERY,
    record:            record,
    scoresFor:         scoresFor,
    bestProviderFor:   bestProviderFor,
    report:            report,
    qualifyEndpoint:   qualifyEndpoint,
    reset:             function () { writeLedger(blankLedger()); return true; },
    export:            function () { return readLedger(); },
    // Diagnostics
    _readLedger:       readLedger,
    _writeLedger:      writeLedger,
    _taskIdFromSource: taskIdFromSource,
    _inferProvider:    inferProvider,
  };
})();
