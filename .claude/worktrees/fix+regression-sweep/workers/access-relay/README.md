# access-relay (`antcv-access-relay`)

Cloud sync for `personalInfo` + `prefs` blobs, delete-wipe path, optional LLM telemetry. KV + D1.

Package version: v2.5.4.

## Files in this folder

| File | What |
|---|---|
| `src/` | Worker source — request handlers, JWT verify, telemetry module |
| `tests/smoke.mjs` | 16 telemetry tests using sql.js to mock D1 |
| `tests/delete-wipe.mjs` | Delete-wipe path: KV blob clear + telemetry row cascade |
| `schema.sql` | D1 base schema (user table) |
| `schema-telemetry.sql` | D1 telemetry schema (llm_calls, quality_signals, health snapshots) |
| [`INSTALL.md`](./INSTALL.md) | First-time setup: KV namespace, D1 database, JWT secret, schema apply |
| [`DEPLOY_LLM_TELEMETRY.md`](./DEPLOY_LLM_TELEMETRY.md) | Telemetry-specific deploy notes (retention floors, health aggregation cadence) |
| `wrangler.toml` | Worker config (observability + KV + D1 bindings) |

## Test locally

```bash
cd workers/access-relay
node tests/smoke.mjs        # 16 tests against in-process sql.js D1
node tests/delete-wipe.mjs  # delete-wipe cascade path
```

Both tests need `node ≥ 22` (uses native `globalThis.crypto.subtle`) and the sql-wasm files at the path noted at the top of each file — adjust the require path before first run.

See [`TESTING.md`](../../TESTING.md) (repo root) for what each test covers.

## Deploy

```bash
cd workers/access-relay
wrangler deploy
```

Workflow_dispatch in `.github/workflows/deploy.yml`: target `access-relay`, confirm `access-relay`, dry-run first. First-time setup in [`INSTALL.md`](./INSTALL.md).

## Secrets

| Secret | Purpose |
|---|---|
| `JWT_SECRET` | Verify tokens issued by the auth provider |

## Bindings

| Binding | Type | Purpose |
|---|---|---|
| `ANTCV_KV` | KV namespace | `personalInfo` + `prefs` blobs |
| `DB` | D1 database | Telemetry rows, health snapshots, quality signals |

## Observability

`wrangler.toml` must contain, after `compatibility_date`:

```toml
[observability.logs]
enabled = true
invocation_logs = true
```

## Plan refs

- `docs/plan/AntCV_Plan_v2_LockedSources.md` § 8.3 — showcase-isolation tests touch this worker's cloud-restore filter path; 20 cold-start runs must show zero kernel-name leakage.
- § 8.4 — writing-style violation tests forward per-category counts to this worker's quality-signal endpoint.
- Telemetry retention floor (7-day minimum, even if `TELEMETRY_RAW_RETENTION_DAYS=1`) is locked in by `tests/smoke.mjs` Test 16.
