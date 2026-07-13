// =====================================================================
// AntCV — LLM telemetry (D1)
// =====================================================================
//
// Tees llm_call events from /analytics into D1's llm_calls table, runs
// the rolling-window aggregation into llm_provider_health on the cron
// trigger, and exposes a read path for the Analytics tab.
//
// Architecture:
//   PWA → relay /analytics → (a) cv-proxy KV + Analytics Engine
//                            (b) D1 llm_calls           ← THIS MODULE
//
//   relay cron every 5 min → D1 raw rows → aggregate → llm_provider_health
//
//   PWA Analytics tab → relay /api/llm-health → D1 llm_provider_health
//
// The two write paths (a) and (b) are independent — either can fail
// without breaking the other. The relay's /analytics handler responds
// 200 as long as one of them succeeds, and stays fire-and-forget for
// the PWA (response is never blocked on D1).
//
// What is NOT in this module:
//   - Quality signals (llm_quality_signals) post-hoc inserts. The PWA's
//     leak scanner runs asynchronously after a call and will need a
//     separate /api/llm-quality-signal endpoint when that work ships.
//     The schema is here; the ingest route is not.
//
// Schema: see schema-telemetry.sql.

// ---------------------------------------------------------------------
// Sanitisation: only the 18 task strings and 4 providers from the spec
// are accepted; everything else maps to "unknown" / drops the row.
// Keeps a hostile or buggy client from polluting the table with garbage
// task names that would break the aggregation grouping.
// ---------------------------------------------------------------------

const ALLOWED_TASKS = new Set([
  'generate_cv', 'generate_cl',
  'compress', 'fix_orphans', 'enrich',
  'parse_jd', 'extract_keywords', 'match_skills',
  'extract_pdf', 'translate', 'translate_da', 'refine_da', 'refine_en',
  'long_context', 'analyze_fit', 'apply_correction',
  'consensus_poll', 'consensus_reinforce', 'fuse',
  // Tasks the PWA also emits today but not in the original 18 — accept
  // them so we don't lose data. Update the spec doc when stable.
  'extract', 'parse_cv', 'parse_cl',
]);

const ALLOWED_PROVIDERS = new Set(['claude', 'openai', 'mistral', 'gemini']);

const ALLOWED_ERROR_CLASSES = new Set([
  'timeout', 'rate_limit', 'auth', 'network',
  'parse', 'validation', 'other',
]);

function normaliseTask(raw) {
  if (typeof raw !== 'string') return 'unknown';
  const t = raw.trim().toLowerCase();
  if (ALLOWED_TASKS.has(t)) return t;
  // Tolerate "parse_<doctype>" variants the PWA emits ad-hoc.
  if (t.startsWith('parse_') && t.length <= 32) return t;
  return 'unknown';
}

function normaliseProvider(raw) {
  if (typeof raw !== 'string') return null;
  const p = raw.trim().toLowerCase();
  return ALLOWED_PROVIDERS.has(p) ? p : null;
}

function normaliseErrorClass(raw) {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return ALLOWED_ERROR_CLASSES.has(e) ? e : 'other';
}

function clipString(s, max) {
  if (typeof s !== 'string') return null;
  return s.length > max ? s.slice(0, max) : s;
}

function asInt(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function asFloat(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------
// Identity → user_hash: SHA-256(lowercased email) → first 16 hex chars.
// The schema's user_hash column is TEXT; the spec docstring says
// "SHA-256(email)[:16]" without specifying the encoding, so we use hex
// (deterministic, 16 chars = 64 bits, plenty for the bucket-count we
// expect). NULL for anonymous events.
// ---------------------------------------------------------------------

async function userHashFromEmail(email) {
  if (!email) return null;
  const norm = String(email).trim().toLowerCase();
  if (!norm) return null;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm));
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex.slice(0, 16);
}

// ---------------------------------------------------------------------
// Cost computation. The PWA already calculates cost_usd per call from
// its in-memory rate table, but we recompute server-side from
// llm_provider_costs so a stale client doesn't bias the dashboard.
// Falls back to the PWA-reported value when the model isn't in our
// reference table (new model launches before we update prices).
// ---------------------------------------------------------------------

async function estimateCostUsd(env, provider, model, promptTokens, completionTokens, fallbackUsd) {
  if (provider == null || (promptTokens == null && completionTokens == null)) {
    return asFloat(fallbackUsd);
  }
  try {
    const row = await env.DB
      .prepare(
        `SELECT prompt_cost_per_1m_tokens AS p, completion_cost_per_1m_tokens AS c
         FROM llm_provider_costs
         WHERE provider = ? AND model = ?
         ORDER BY effective_from DESC LIMIT 1`
      )
      .bind(provider, model || '')
      .first();
    if (row) {
      const pt = Number(promptTokens) || 0;
      const ct = Number(completionTokens) || 0;
      const cost = (pt / 1e6) * Number(row.p) + (ct / 1e6) * Number(row.c);
      return Number.isFinite(cost) ? Number(cost.toFixed(6)) : asFloat(fallbackUsd);
    }
  } catch (e) {
    // Fall through to PWA-reported value.
  }
  return asFloat(fallbackUsd);
}

// ---------------------------------------------------------------------
// Insert one llm_call event. Returns the inserted rowid, or null on
// any failure (logged but not thrown — analytics is fire-and-forget).
// ---------------------------------------------------------------------

export async function insertLlmCall(env, identity, event) {
  if (!env || !env.DB) return null;
  if (!event || event.event !== 'llm_call') return null;

  const provider = normaliseProvider(event.provider);
  if (!provider) {
    console.warn('[telemetry] dropping llm_call with bad provider:', event.provider);
    return null;
  }
  const task = normaliseTask(event.task);

  // Tokens: PWA uses input/output naming; schema uses prompt/completion.
  // Accept either, prefer the PWA's input/output (more current).
  const promptTokens = asInt(event.input_tokens ?? event.prompt_tokens);
  const completionTokens = asInt(event.output_tokens ?? event.completion_tokens);
  const totalTokens = asInt(
    event.total_tokens ??
    (promptTokens != null && completionTokens != null ? promptTokens + completionTokens : null)
  );

  const success = event.success === false || event.error_class ? 0 : 1;
  const userHash = identity && identity.email ? await userHashFromEmail(identity.email) : null;
  const cost = await estimateCostUsd(env, provider, event.model || null, promptTokens, completionTokens, event.cost_usd);

  // The PWA wraps every event with { ts, session, v } in the outer
  // emitter. Prefer event.ts when present (seconds-since-epoch), fall
  // back to now. Coerce milliseconds → seconds if it looks like ms.
  let ts = asInt(event.ts);
  if (ts == null) ts = Math.floor(Date.now() / 1000);
  if (ts > 4e12) ts = Math.floor(ts / 1000); // ms → s
  else if (ts > 4e9) ts = Math.floor(ts / 1000); // ms → s (2096+ in s)

  try {
    const res = await env.DB
      .prepare(
        `INSERT INTO llm_calls (
           ts, user_hash, provider, model, task,
           success, http_status, error_class, error_message,
           latency_ms, ttft_ms,
           prompt_tokens, completion_tokens, total_tokens,
           placeholder_leak_count, fabrication_flag, banned_word_count,
           was_retry, retry_attempt,
           estimated_cost_usd,
           request_id, augmentation_task, client_version, jd_fingerprint
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        ts,
        userHash,
        provider,
        clipString(event.model, 100),
        task,
        success,
        asInt(event.http_status ?? event.status_code ?? event.status),
        normaliseErrorClass(event.error_class),
        clipString(event.error_message, 200),
        asInt(event.duration_ms ?? event.latency_ms),
        asInt(event.ttft_ms),
        promptTokens,
        completionTokens,
        totalTokens,
        asInt(event.placeholder_leak_count) ?? 0,
        event.fabrication_flag ? 1 : 0,
        asInt(event.banned_word_count) ?? 0,
        // was_retry is 1 when the PWA had to fall back to another provider
        // (fallback_step > 0) OR when the caller explicitly flagged it.
        (event.was_retry || (asInt(event.fallback_step) || 0) > 0) ? 1 : 0,
        asInt(event.retry_attempt) ?? (asInt(event.fallback_step) != null ? asInt(event.fallback_step) + 1 : 1),
        cost,
        clipString(event.request_id, 64),
        clipString(event.augmentation_task, 64),
        clipString(event.v ?? event.client_version ?? event.app_version ?? event.version, 32),
        clipString(event.jd_fingerprint, 64)
      )
      .run();
    return res && res.meta && res.meta.last_row_id != null ? res.meta.last_row_id : null;
  } catch (e) {
    console.warn('[telemetry] D1 insert failed:', e && e.message ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------------
// Retention prune. Runs after each aggregation cycle. Defaults:
//   - llm_calls + llm_quality_signals: keep 90 days
//   - llm_provider_health: keep 30 days (dashboard reads latest only)
//
// Both numbers are overridable via env so Gabriel can tune without
// editing code. Set TELEMETRY_RAW_RETENTION_DAYS or
// TELEMETRY_HEALTH_RETENTION_DAYS in wrangler.toml [vars]. The
// retention floor is 7 days — any value below that is clamped, since
// the longest aggregation window itself is 7 days and we'd otherwise
// delete rows mid-aggregation.
//
// llm_quality_signals is pruned by the same time bound as llm_calls,
// not by FK cascade (the schema doesn't have ON DELETE CASCADE, which
// would have required a backwards-incompatible table rebuild in
// SQLite). Quality signals carry their own ts column for this reason.
// ---------------------------------------------------------------------

const RETENTION_FLOOR_DAYS = 7;

function retentionSeconds(env, key, defaultDays) {
  const raw = env && env[key];
  const days = Number(raw);
  const eff = Number.isFinite(days) && days >= RETENTION_FLOOR_DAYS ? days : defaultDays;
  return eff * 86400;
}

export async function pruneOld(env, now = Math.floor(Date.now() / 1000)) {
  if (!env || !env.DB) return { ok: false, reason: 'no_db' };

  const rawCutoff    = now - retentionSeconds(env, 'TELEMETRY_RAW_RETENTION_DAYS',    90);
  const healthCutoff = now - retentionSeconds(env, 'TELEMETRY_HEALTH_RETENTION_DAYS', 30);

  const out = { ok: true, raw_cutoff: rawCutoff, health_cutoff: healthCutoff };
  try {
    // Order matters: delete child rows (quality signals) before parents
    // (calls) since there's no FK cascade. Both run unconditionally —
    // if quality signals is empty, the delete is a no-op.
    const sigRes = await env.DB
      .prepare(`DELETE FROM llm_quality_signals WHERE ts < ?`)
      .bind(rawCutoff)
      .run();
    const callRes = await env.DB
      .prepare(`DELETE FROM llm_calls WHERE ts < ?`)
      .bind(rawCutoff)
      .run();
    const healthRes = await env.DB
      .prepare(`DELETE FROM llm_provider_health WHERE window_start < ?`)
      .bind(healthCutoff)
      .run();
    out.deleted = {
      llm_quality_signals: (sigRes.meta && sigRes.meta.changes) || 0,
      llm_calls:           (callRes.meta && callRes.meta.changes) || 0,
      llm_provider_health: (healthRes.meta && healthRes.meta.changes) || 0,
    };
  } catch (e) {
    out.ok = false;
    out.error = e && e.message ? e.message : String(e);
  }
  return out;
}

// ---------------------------------------------------------------------
// Quality signal ingest. The PWA's leak scanner runs in a useEffect
// after a call completes, so quality signals arrive separately from
// the originating llm_call event. Three ways to resolve "which call
// did this signal belong to":
//
//   1. call_id (the D1 rowid) — only useful for admin tools that
//      already know it.
//   2. request_id — a client-generated correlation id. The PWA must
//      include this in BOTH the llm_call event AND the subsequent
//      quality signal POST. Cleanest path; recommended for new code.
//   3. Approximate match — when the PWA hasn't started emitting
//      request_id yet, fall back to "most recent llm_calls row for
//      this user_hash + provider + task within the last 5 minutes".
//      Fragile but unblocks rate collection before the PWA changes.
//
// In addition to inserting the signal row, the handler updates the
// matching llm_calls row's count/flag columns so the aggregation
// (which reads from llm_calls only) reflects the new data on the
// next cron run.
// ---------------------------------------------------------------------

const MATCH_WINDOW_SECONDS = 300; // 5 min lookback for approximate match

const QUALITY_SIGNAL_TYPES = new Set([
  'placeholder_leak',
  'fabrication',
  'banned_word',
  'wrong_field_name',
  'user_thumbs_down',
]);

const QUALITY_SEVERITIES = new Set(['critical', 'warning', 'info']);

function normaliseSignalType(raw) {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().toLowerCase();
  return QUALITY_SIGNAL_TYPES.has(t) ? t : null;
}

function normaliseSeverity(raw) {
  if (typeof raw !== 'string') return 'info';
  const s = raw.trim().toLowerCase();
  return QUALITY_SEVERITIES.has(s) ? s : 'info';
}

async function findCallId(env, body, userHash, now) {
  // 1. Explicit call_id
  const explicit = asInt(body.call_id);
  if (explicit != null) {
    const row = await env.DB
      .prepare(`SELECT id FROM llm_calls WHERE id = ?`)
      .bind(explicit)
      .first();
    return row ? row.id : null;
  }
  // 2. request_id
  if (typeof body.request_id === 'string' && body.request_id) {
    const row = await env.DB
      .prepare(`SELECT id FROM llm_calls WHERE request_id = ? ORDER BY ts DESC LIMIT 1`)
      .bind(body.request_id)
      .first();
    if (row) return row.id;
  }
  // 3. Approximate match: provider + task + user_hash + recent ts
  const provider = normaliseProvider(body.provider);
  const task = body.task ? normaliseTask(body.task) : null;
  if (provider && task && userHash) {
    const row = await env.DB
      .prepare(
        `SELECT id FROM llm_calls
         WHERE provider = ? AND task = ? AND user_hash = ?
           AND ts >= ?
         ORDER BY ts DESC LIMIT 1`
      )
      .bind(provider, task, userHash, now - MATCH_WINDOW_SECONDS)
      .first();
    if (row) return row.id;
  }
  return null;
}

export async function insertQualitySignal(env, identity, body) {
  if (!env || !env.DB) return { ok: false, reason: 'no_db' };

  const signalType = normaliseSignalType(body && body.signal_type);
  if (!signalType) {
    return { ok: false, reason: 'invalid_signal_type', hint: 'one of: ' + Array.from(QUALITY_SIGNAL_TYPES).join(', ') };
  }
  const severity = normaliseSeverity(body.severity);
  const now = Math.floor(Date.now() / 1000);
  const userHash = identity && identity.email ? await userHashFromEmail(identity.email) : null;

  const callId = await findCallId(env, body, userHash, now);
  if (callId == null) {
    return { ok: false, reason: 'call_not_found', hint: 'pass call_id or request_id, or include provider+task within 5 minutes of the original call' };
  }

  // Stringify signal_value when it's an object; pass through strings as-is.
  let signalValue = body.signal_value;
  if (signalValue != null && typeof signalValue !== 'string') {
    try { signalValue = JSON.stringify(signalValue); }
    catch (e) { signalValue = String(signalValue); }
  }
  if (typeof signalValue === 'string' && signalValue.length > 4000) {
    signalValue = signalValue.slice(0, 4000);
  }

  try {
    await env.DB
      .prepare(
        `INSERT INTO llm_quality_signals (call_id, ts, signal_type, signal_value, severity)
         VALUES (?, ?, ?, ?, ?)`
      )
      .bind(callId, now, signalType, signalValue || null, severity)
      .run();
  } catch (e) {
    return { ok: false, reason: 'insert_failed', error: e && e.message ? e.message : String(e) };
  }

  // Backfill the count/flag on llm_calls so the aggregation picks it up.
  // Each signal increments the corresponding column rather than
  // overwriting it — a single call can leak multiple placeholders.
  try {
    if (signalType === 'placeholder_leak') {
      await env.DB.prepare(
        `UPDATE llm_calls SET placeholder_leak_count = COALESCE(placeholder_leak_count, 0) + 1 WHERE id = ?`
      ).bind(callId).run();
    } else if (signalType === 'fabrication') {
      await env.DB.prepare(
        `UPDATE llm_calls SET fabrication_flag = 1 WHERE id = ?`
      ).bind(callId).run();
    } else if (signalType === 'banned_word') {
      await env.DB.prepare(
        `UPDATE llm_calls SET banned_word_count = COALESCE(banned_word_count, 0) + 1 WHERE id = ?`
      ).bind(callId).run();
    }
    // wrong_field_name and user_thumbs_down don't have a llm_calls
    // counter column — they live only in llm_quality_signals.
  } catch (e) {
    // Backfill failure isn't fatal; the signal row is already in place
    // and the aggregator will simply miss this one update.
    console.warn('[telemetry] backfill update failed:', e && e.message ? e.message : e);
  }

  return { ok: true, call_id: callId, signal_type: signalType, severity };
}

// ---------------------------------------------------------------------
// Percentile helper. SQLite has no PERCENTILE_CONT; small-N rows in
// memory is fine for our windows (≤ a few thousand calls/hour).
// ---------------------------------------------------------------------

function percentile(sorted, p) {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return Math.round(sorted[lo] * (1 - frac) + sorted[hi] * frac);
}

// ---------------------------------------------------------------------
// Health score: implements the rule of thumb from the schema docstring.
// Documented there so the dashboard can show "why" a provider is
// degraded — these constants must stay aligned with the comment block
// in llm-telemetry-schema.sql.
// ---------------------------------------------------------------------

// RELAY-COST-TIEBREAK-001 (2026-07-13, owner "make scoreHealth cost-aware so
// equal-quality providers tie-break by cost"): mechanical / high-volume passes
// where two ADEQUATE providers are ~interchangeable on quality, so cost should
// break the tie. Quality-critical tasks (generate_cv/cl, parse_jd, analyze_fit)
// are deliberately ABSENT — their provider choice must stay quality-led (the
// client's per-task qW weights already encode that; we must never demote a
// better-but-pricier writer on a quality-critical task).
export const COST_SENSITIVE_TASKS = new Set([
  'compress', 'long_context', 'consensus_poll', 'consensus_reinforce',
  'fix_orphans', 'enrich', 'apply_correction',
]);

// Bounded cost penalty for the tie-break. Log-scaled on the cost RATIO vs the
// task's cheapest ADEQUATE provider, so only a big spread (compress: openai is
// ~1700x gemini) earns the full penalty; a 1.5-3x spread stays a near-tie. Cap
// 0.15 = the headroom on a perfect 1.0 quality score down to the 'ok' floor
// (0.85), so the tie-break can NEVER by itself push an adequate provider into a
// false 'warning'/'degraded'.
export const COST_TIEBREAK_MAX = 0.15;
export const COST_RATIO_CAP = 100;   // >=100x pricier than the cheapest = full penalty
export function costPenalty(costPerCall, minCostPerCall) {
  if (!(costPerCall > 0) || !(minCostPerCall > 0) || costPerCall <= minCostPerCall) return 0;
  const frac = Math.min(1, Math.log10(costPerCall / minCostPerCall) / Math.log10(COST_RATIO_CAP));
  return COST_TIEBREAK_MAX * frac;
}

// scoreHealth(metrics[, costCtx]) — QUALITY score + status as before. When
// costCtx = { costPerCall, minCostPerCall } is supplied (a cost-sensitive task
// with a known cheapest-adequate cost) AND the provider is adequate ('ok'), a
// bounded cost penalty is folded into health_score so the pricier-among-equals
// reads lower. STATUS stays QUALITY-only (a pricey-but-adequate provider is
// still 'ok' — healthy, just not the cheap pick); the client seed turns the
// resulting health GAP vs the task's cheapest into the actual routing demotion.
export function scoreHealth(metrics, costCtx = null) {
  let s = 1.0;
  if (metrics.success_rate < 0.90)          s -= 0.4;
  if (metrics.p95_latency_ms > 30000)       s -= 0.3;
  if (metrics.placeholder_leak_rate > 0.10) s -= 0.2;
  if (metrics.fabrication_rate > 0.05)      s -= 0.2;
  if (metrics.retry_rate > 0.30)            s -= 0.1;
  if (metrics.banned_word_rate > 0.05)      s -= 0.1;
  s = Math.max(0, Math.min(1, s));
  const status = s >= 0.85 ? 'ok'
              : s >= 0.60 ? 'warning'
              : s >= 0.30 ? 'degraded'
              : 'down';
  let health = s, cost_penalty = 0;
  // Adequacy for the tie-break is judged on SUCCESS, not status: the cost-sensitive
  // tasks (compress/long_context/consensus_*) are inherently high-latency, so they
  // sit at 'warning' on quality alone — gating on status==='ok' made the tie-break
  // NEVER fire on exactly the tasks it targets (RELAY-COST-TIEBREAK-001 v1 was inert
  // in production, 2026-07-13). Two providers that both succeed are equal-quality
  // enough for cost to decide. STATUS stays quality-only (unchanged for the
  // dashboard); health_score is the cost-aware ROUTING signal the client seed reads.
  // Clamp health >= 0.30 so a pricey provider is at worst 'degraded', never 'down'
  // (which must mean broken). The cheapest-adequate provider gets penalty 0, so it
  // keeps its quality score and always ranks above its pricier equals.
  if (costCtx && metrics.success_rate >= 0.85) {
    cost_penalty = costPenalty(costCtx.costPerCall, costCtx.minCostPerCall);
    health = Math.max(0.30, s - cost_penalty);
  }
  return { health_score: Number(health.toFixed(3)), status, cost_penalty: Number(cost_penalty.toFixed(3)) };
}

// ---------------------------------------------------------------------
// Aggregation. For each window size (60 / 1440 / 10080 minutes), pull
// raw rows in that window, group by (provider, task), compute the
// metrics, then UPSERT into llm_provider_health.
//
// The window_start convention is "start of the bucket whose end is
// now": e.g. for the 60-min window, window_start = now-3600. Storing
// the same window_start across all rows of one cron run means the
// dashboard can read "the latest 60-min snapshot" via:
//   SELECT * FROM llm_provider_health
//   WHERE window_minutes = 60
//     AND window_start = (SELECT MAX(window_start) FROM llm_provider_health WHERE window_minutes = 60)
//
// We keep historical snapshots — they're tiny (4 providers × ~20
// tasks × 3 windows ≈ 240 rows per cron) — so the dashboard can also
// plot trends over time.
// ---------------------------------------------------------------------

const WINDOWS = [
  { minutes: 60,    seconds: 3600 },
  { minutes: 1440,  seconds: 86400 },
  { minutes: 10080, seconds: 604800 },
];

export async function aggregateHealth(env, now = Math.floor(Date.now() / 1000)) {
  if (!env || !env.DB) return { ok: false, reason: 'no_db' };
  const summary = { now, windows: {} };

  for (const w of WINDOWS) {
    const windowStart = now - w.seconds;
    const rows = await env.DB
      .prepare(
        `SELECT provider, task, success, latency_ms, total_tokens,
                estimated_cost_usd, placeholder_leak_count, fabrication_flag,
                banned_word_count, retry_attempt
         FROM llm_calls
         WHERE ts >= ?`
      )
      .bind(windowStart)
      .all();

    const buckets = new Map(); // "provider|task" → { latencies: [], ... }
    for (const r of (rows.results || [])) {
      const key = r.provider + '|' + r.task;
      let b = buckets.get(key);
      if (!b) {
        b = {
          provider: r.provider, task: r.task,
          calls: 0, successes: 0,
          latencies: [], tokens_sum: 0, tokens_n: 0,
          cost_sum: 0,
          leak_calls: 0, fab_calls: 0, banned_calls: 0,
          retry_sum: 0,
        };
        buckets.set(key, b);
      }
      b.calls += 1;
      if (r.success === 1) b.successes += 1;
      if (r.latency_ms != null) b.latencies.push(r.latency_ms);
      if (r.total_tokens != null) { b.tokens_sum += r.total_tokens; b.tokens_n += 1; }
      if (r.estimated_cost_usd != null) b.cost_sum += r.estimated_cost_usd;
      if ((r.placeholder_leak_count || 0) > 0) b.leak_calls += 1;
      if (r.fabrication_flag === 1) b.fab_calls += 1;
      if ((r.banned_word_count || 0) > 0) b.banned_calls += 1;
      // retry_rate per the spec is "(sum of retry_attempt - 1) / call_count"
      b.retry_sum += Math.max(0, (r.retry_attempt || 1) - 1);
    }

    // RELAY-COST-TIEBREAK-001: cheapest ADEQUATE cost-per-call per cost-sensitive
    // task — the floor the cost tie-break scores every other provider against.
    // Adequacy is judged on SUCCESS RATE (>= 0.85), NOT quality status: these tasks
    // are inherently high-latency ('warning' on quality alone), so a status gate
    // would leave the floor empty and the whole tie-break inert. A hard-failing
    // provider still can't set an artificially low floor.
    const minCostByTask = new Map();
    for (const b of buckets.values()) {
      if (!COST_SENSITIVE_TASKS.has(b.task) || !(b.calls > 0)) continue;
      const cpc = b.cost_sum / b.calls;
      if (!(cpc > 0)) continue;
      if ((b.successes / b.calls) < 0.85) continue;   // only adequate providers set the floor
      const cur = minCostByTask.get(b.task);
      if (cur == null || cpc < cur) minCostByTask.set(b.task, cpc);
    }

    let upserts = 0;
    for (const b of buckets.values()) {
      const sorted = b.latencies.slice().sort((x, y) => x - y);
      const metrics = {
        success_rate: b.successes / b.calls,
        p50_latency_ms: percentile(sorted, 0.50),
        p95_latency_ms: percentile(sorted, 0.95),
        p99_latency_ms: percentile(sorted, 0.99),
        placeholder_leak_rate: b.leak_calls / b.calls,
        fabrication_rate: b.fab_calls / b.calls,
        banned_word_rate: b.banned_calls / b.calls,
        retry_rate: b.retry_sum / b.calls,
      };
      // RELAY-COST-TIEBREAK-001: fold a bounded cost penalty into health_score for
      // an adequate provider on a cost-sensitive task (status stays quality-only).
      const costPerCall = b.calls > 0 ? b.cost_sum / b.calls : 0;
      const minCost = COST_SENSITIVE_TASKS.has(b.task) ? minCostByTask.get(b.task) : null;
      const costCtx = (minCost != null && costPerCall > 0) ? { costPerCall, minCostPerCall: minCost } : null;
      const { health_score, status } = scoreHealth(metrics, costCtx);

      await env.DB
        .prepare(
          `INSERT INTO llm_provider_health (
             provider, task, window_start, window_minutes,
             call_count, success_count, success_rate,
             p50_latency_ms, p95_latency_ms, p99_latency_ms,
             avg_tokens, total_cost_usd,
             placeholder_leak_rate, fabrication_rate, banned_word_rate, retry_rate,
             health_score, status
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(provider, task, window_start, window_minutes) DO UPDATE SET
             call_count = excluded.call_count,
             success_count = excluded.success_count,
             success_rate = excluded.success_rate,
             p50_latency_ms = excluded.p50_latency_ms,
             p95_latency_ms = excluded.p95_latency_ms,
             p99_latency_ms = excluded.p99_latency_ms,
             avg_tokens = excluded.avg_tokens,
             total_cost_usd = excluded.total_cost_usd,
             placeholder_leak_rate = excluded.placeholder_leak_rate,
             fabrication_rate = excluded.fabrication_rate,
             banned_word_rate = excluded.banned_word_rate,
             retry_rate = excluded.retry_rate,
             health_score = excluded.health_score,
             status = excluded.status`
        )
        .bind(
          b.provider, b.task, windowStart, w.minutes,
          b.calls, b.successes, Number(metrics.success_rate.toFixed(4)),
          metrics.p50_latency_ms, metrics.p95_latency_ms, metrics.p99_latency_ms,
          b.tokens_n > 0 ? Math.round(b.tokens_sum / b.tokens_n) : null,
          Number(b.cost_sum.toFixed(6)),
          Number(metrics.placeholder_leak_rate.toFixed(4)),
          Number(metrics.fabrication_rate.toFixed(4)),
          Number(metrics.banned_word_rate.toFixed(4)),
          Number(metrics.retry_rate.toFixed(4)),
          health_score, status
        )
        .run();
      upserts += 1;
    }
    summary.windows['w' + w.minutes] = { row_count: rows.results ? rows.results.length : 0, upserts };
  }

  return { ok: true, ...summary };
}

// ---------------------------------------------------------------------
// Read path: the PWA's Analytics tab pulls latest snapshots.
// Returns { window_minutes: number, window_start: number, rows: [...] }
// for ONE window size at a time (default 60 min). The PWA can call
// three times for the three windows, or pass ?window=all and we'll
// return all three keyed by minutes.
// ---------------------------------------------------------------------

export async function getLatestHealth(env, { windowMinutes = 60, provider = null, task = null } = {}) {
  if (!env || !env.DB) return { ok: false, reason: 'no_db' };

  if (windowMinutes === 'all') {
    const out = {};
    for (const w of WINDOWS) {
      out['w' + w.minutes] = await getLatestHealth(env, { windowMinutes: w.minutes, provider, task });
    }
    return { ok: true, all: out };
  }

  // Find the latest window_start for this window size, then read all rows
  // matching it. Two-step keeps the WHERE clause simple and uses the
  // (window_minutes, window_start DESC) index.
  const latest = await env.DB
    .prepare(`SELECT MAX(window_start) AS ws FROM llm_provider_health WHERE window_minutes = ?`)
    .bind(windowMinutes)
    .first();
  if (!latest || latest.ws == null) {
    return { ok: true, window_minutes: windowMinutes, window_start: null, rows: [] };
  }

  let sql = `SELECT * FROM llm_provider_health
             WHERE window_minutes = ? AND window_start = ?`;
  const args = [windowMinutes, latest.ws];
  if (provider) { sql += ` AND provider = ?`; args.push(provider); }
  if (task)     { sql += ` AND task = ?`;     args.push(task); }
  sql += ` ORDER BY provider, task`;

  const rows = await env.DB.prepare(sql).bind(...args).all();
  return {
    ok: true,
    window_minutes: windowMinutes,
    window_start: latest.ws,
    rows: rows.results || [],
  };
}
