# LLM Telemetry — relay v2.5.0 deploy

Ships the D1 telemetry path described in `llm-telemetry-schema.sql`,
including raw event ingest, rolling-window aggregation, post-hoc
quality signals, and automated retention pruning.

## What changed

**Schema (additive)** — `schema-telemetry.sql`. Four new tables on the
existing `ant_memory` D1: `llm_calls`, `llm_quality_signals`,
`llm_provider_health`, `llm_provider_costs`. No changes to the existing
kernel/application tables. Re-runnable (every statement uses
`IF NOT EXISTS` / `INSERT OR IGNORE`).

**Code** — additions to the relay:

1. `src/telemetry.js` — new module exporting five functions:
   - `insertLlmCall(env, identity, event)` — sanitises and inserts a
     row into `llm_calls`. Recomputes cost server-side from
     `llm_provider_costs` so a stale client doesn't bias the dashboard.
     Falls back to the PWA-reported value when the model isn't in the
     reference table.
   - `aggregateHealth(env, now?)` — for each of the three windows
     (60 / 1440 / 10080 min), groups rows by (provider, task),
     computes p50/p95/p99 in JS (D1/SQLite lacks `PERCENTILE_CONT`),
     applies the health-score rule from the schema docstring, and
     upserts into `llm_provider_health`.
   - `pruneOld(env, now?)` — deletes rows past retention. Defaults:
     90 days for `llm_calls` + `llm_quality_signals`, 30 days for
     `llm_provider_health`. Override via env vars
     `TELEMETRY_RAW_RETENTION_DAYS` and `TELEMETRY_HEALTH_RETENTION_DAYS`.
     Enforces a 7-day floor on the raw retention so a typo can't wipe
     today's data.
   - `insertQualitySignal(env, identity, body)` — handles post-hoc
     leak/fabrication/banned-word flags from the PWA's scanner.
     Resolves the parent call by `call_id` (admin path), `request_id`
     (preferred client path), or fuzzy match on
     `(user_hash, provider, task)` within 5 minutes (legacy fallback).
     Inserts into `llm_quality_signals` AND back-fills the
     count/flag column on the parent `llm_calls` row so the next
     aggregation tick picks up the rate.
   - `getLatestHealth(env, opts)` — reads the latest snapshot for
     the dashboard. `windowMinutes='all'` returns all three.

2. `src/index.js` — surgical diff. Threads `ctx` through `fetch →
   handleRequest`, adds a `scheduled` export, tees `llm_call` events
   from `/analytics` into D1 via `ctx.waitUntil` (cv-proxy forward
   path untouched, response stays fire-and-forget). Four new routes:
   - `GET  /api/llm-health` (signed-in user) — read latest snapshot
   - `POST /api/llm-health/aggregate` (admin) — manual aggregate trigger
   - `POST /api/llm-health/prune` (admin) — manual prune trigger
   - `POST /api/llm-quality-signal` (signed-in user) — post-hoc flag
   `RELAY_VERSION` → `auth-19-llm-telemetry-d1`.

3. `wrangler.toml` — `[triggers] crons = ["*/5 * * * *"]` and updated
   D1-binding docs. Aggregation runs every 5 min; prune is gated to
   the 00:00–00:04 UTC tick (once per day) to avoid burning
   transaction-log budget on no-op deletes.

**Tests** — `tests/smoke.mjs`. Sixteen assertions covering:
- Insert happy path, anonymous events, bad provider rejection, task
  normalisation, failure events, server-side cost override.
- Bulk aggregation, health scoring boundaries, all three read shapes.
- Quality signal via `call_id`, via `request_id`, via fuzzy match,
  with backfill of the parent `llm_calls` row.
- Quality signal rejection paths (invalid signal type, no matching call).
- Prune happy path + 7-day floor protection against an aggressive
  retention env var.

Runs against sql.js in-process. Required tooling:

```
mkdir -p /home/claude/work/sqljs
cd /home/claude/work/sqljs && npm pack sql.js@1.10.3
tar -xzf sql.js-1.10.3.tgz
cp package/dist/sql-wasm.js sql-wasm.cjs
cp package/dist/sql-wasm.wasm .
cd /path/to/antcv-access-relay
node tests/smoke.mjs
```

## Deploy steps

```
# 1. Apply the additive schema (idempotent)
npx wrangler d1 execute ant_memory --file=schema-telemetry.sql --remote

# 2. Confirm the four new tables exist
npx wrangler d1 execute ant_memory --remote --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'llm_%' ORDER BY name"

# 3. Deploy the relay
npx wrangler deploy

# 4. Smoke-test the read path (should return rows: [] until traffic flows)
curl -H "Authorization: Bearer $YOUR_RELAY_JWT" \
  https://antcv-access-relay.karp-gabriel-a.workers.dev/api/llm-health

# 5. Manually fire the aggregation once so the dashboard isn't empty
#    for 5 minutes after first deploy:
curl -X POST -H "Authorization: Bearer $YOUR_RELAY_JWT" \
  https://antcv-access-relay.karp-gabriel-a.workers.dev/api/llm-health/aggregate
```

Step 1 is safe even if the schema is already applied (re-runs are
no-ops). Step 5 is optional but avoids a 5-minute empty-state window.

## Data shape on the wire

### `POST /analytics` — what the PWA already sends

```json
{
  "event": "llm_call",
  "task": "compress",
  "provider": "claude",
  "model": "claude-sonnet-4-6",
  "input_tokens": 2000,
  "output_tokens": 500,
  "duration_ms": 4200,
  "cost_usd": 0.0135,
  "fallback_step": 0,
  "ts": 1747400000,
  "session": "...",
  "v": "1.40.124"
}
```

When the PWA starts emitting `request_id` (a UUID or
`session+counter` string), include it in this event AND in any
subsequent `/api/llm-quality-signal` POSTs for clean correlation.

### `GET /api/llm-health` — dashboard read

Query params:
- `window=60|1440|10080|all` (default 60; `all` returns all three keyed by `wN`)
- `provider=claude|openai|mistral|gemini`
- `task=<one of the 18 task names>`

```json
{
  "ok": true,
  "window_minutes": 60,
  "window_start": 1747396400,
  "rows": [
    {
      "provider": "claude", "task": "compress",
      "call_count": 62, "success_count": 52, "success_rate": 0.8387,
      "p50_latency_ms": 2475, "p95_latency_ms": 35000, "p99_latency_ms": 35000,
      "avg_tokens": 20668, "total_cost_usd": 3.35,
      "placeholder_leak_rate": 0, "fabrication_rate": 0,
      "banned_word_rate": 0, "retry_rate": 0,
      "health_score": 0.3, "status": "degraded"
    }
  ]
}
```

PWA Analytics tab consumes `rows` directly. Map `status` to badge
colour (`ok` → green, `warning` → yellow, `degraded` → orange,
`down` → red). Map `health_score < 0.30` → autorotate away from
that provider for that task.

### `POST /api/llm-quality-signal` — post-hoc flag

```json
{
  "call_id": 12345,
  "signal_type": "placeholder_leak",
  "signal_value": { "markers": ["[POSITION]", "[YOUR ROLE]"] },
  "severity": "warning"
}
```

Or with `request_id` (cleaner once PWA threads it through):

```json
{
  "request_id": "req-abc-123",
  "signal_type": "fabrication",
  "signal_value": { "company": "Demant" },
  "severity": "critical"
}
```

Or fuzzy (legacy fallback, finds most recent matching call within 5 min):

```json
{
  "provider": "claude",
  "task": "compress",
  "signal_type": "banned_word",
  "signal_value": { "word": "spearhead" },
  "severity": "warning"
}
```

`signal_type` must be one of: `placeholder_leak`, `fabrication`,
`banned_word`, `wrong_field_name`, `user_thumbs_down`.
`severity` must be one of: `critical`, `warning`, `info` (default `info`).

For `placeholder_leak` / `fabrication` / `banned_word` the handler
also increments the matching column on the parent `llm_calls` row,
so the next aggregation tick reflects the new rate.

Response shape:

```json
{ "ok": true,  "call_id": 12345, "signal_type": "placeholder_leak", "severity": "warning" }
{ "ok": false, "reason": "call_not_found", "hint": "..." }           // 404
{ "ok": false, "reason": "invalid_signal_type", "hint": "..." }      // 400
```

## Operational notes

### Retention policy

Defaults:
- `llm_calls` + `llm_quality_signals`: 90 days
- `llm_provider_health`: 30 days

Override via env vars in `wrangler.toml [vars]`:

```toml
TELEMETRY_RAW_RETENTION_DAYS    = "180"
TELEMETRY_HEALTH_RETENTION_DAYS = "90"
```

Prune runs once a day at 00:00 UTC (via the cron handler) and on
demand via `POST /api/llm-health/prune` (admin). A 7-day floor is
enforced — if `TELEMETRY_RAW_RETENTION_DAYS` is set to anything
below 7, the code falls back to the 90-day default. This guards
against a typo wiping today's data.

### Growth math

`llm_provider_health`: 4 providers × ~20 tasks × 3 windows = 240
upserts per cron run, but each `(provider, task, window_minutes,
window_start)` key is unique — so 240 NEW rows every 5 min until
prune fires.

- 30-day default retention → ~2M rows steady state
- 90-day → ~6M rows

D1 free tier: 5M rows / 5GB. Steady state at default retention
fits inside free tier. Push retention up only when you upgrade.

`llm_calls`: user-driven. Estimate ~30–60 LLM calls per
application × 100 applications/day = ~5K rows/day = ~450K rows
over 90-day retention. Plenty of headroom.

### Cost-table updates

When provider prices change, append a row to `llm_provider_costs`
with a later `effective_from`. The cost lookup uses
`ORDER BY effective_from DESC LIMIT 1`, so the latest price wins
without disrupting historical rows.

```sql
INSERT INTO llm_provider_costs VALUES
  ('claude', 'claude-sonnet-4-7', 3.50, 17.50, strftime('%s','now'));
```

### Failure paths

The `/analytics` POST handler is fire-and-forget by contract. The
D1 tee runs in `ctx.waitUntil` and can fail without affecting the
PWA. Three observable failure modes:

- **D1 not bound** — schema apply step (1) was skipped. `hasD1(env)`
  returns false; the tee is silently no-oped. Symptom:
  `/api/llm-health` returns `503 d1_unavailable`. Fix: re-apply
  schema, set `database_id` in `wrangler.toml`, redeploy.
- **JSON parse fail** — body is not the expected shape. Logged as
  `[analytics-tee] failed: …`. The cv-proxy forward still proceeds.
- **Insert fail (e.g. constraint violation)** — logged as
  `[telemetry] D1 insert failed: …`. The row is dropped but
  subsequent events keep flowing.

For `/api/llm-quality-signal` the same defensive shape applies but
the user gets a real status code (200 / 400 / 404 / 500) so the
PWA can debug. The backfill UPDATE on `llm_calls` is best-effort:
its failure is logged but doesn't fail the response.

### Aggregation timing

The cron trigger uses `*/5 * * * *` — every 5 minutes on the
0/5/10/… boundary. Each run aggregates the last 60 / 1440 / 10080
minutes of raw rows. With ~5K rows/day, the 7-day window
(`10080`) reads ~35K rows — well within D1 query limits (~25 MB
result size).

If aggregation takes > 30 seconds (worker CPU limit on the free
tier is 30s for scheduled events), the run aborts mid-way and the
NEXT cron fires fresh against the same data. The UPSERT pattern
means re-running is safe — no duplicates, no partial state.

## What is NOT in this ship

- **PWA Analytics tab UI** — the four routes are live; the dashboard
  UI that consumes them is the next ship.
- **PWA `request_id` emission** — the quality-signal route accepts
  three identification paths today, but the cleanest one
  (`request_id`) needs the PWA to start emitting a correlation id
  in both the `/analytics` and `/api/llm-quality-signal` payloads.
  Until then, the fuzzy fallback covers most cases.
- **Per-user rate limiting on `/api/llm-health` and
  `/api/llm-quality-signal`** — anyone signed in can hit them as
  often as they like. Not a concern for the small user base; add
  a counter if abuse appears.

## Rollback

The schema is additive; rollback is code-only:

```
git revert <this commit>
npx wrangler deploy
```

The new tables stay populated. The next `npx wrangler deploy` of
the old code stops writing them (no harm) and ignores the cron
trigger (harmless — the scheduled handler simply isn't defined).
The four new routes return 404.

The D1 tables can be dropped explicitly if desired:

```sql
DROP TABLE IF EXISTS llm_quality_signals;
DROP TABLE IF EXISTS llm_provider_health;
DROP TABLE IF EXISTS llm_provider_costs;
DROP TABLE IF EXISTS llm_calls;
```
