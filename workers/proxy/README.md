# proxy (`antcv-proxy`)

LLM proxy. Routes requests to Anthropic, OpenAI, Mistral, or Gemini and runs the writing-engine work that needs an LLM.

## What it does

| Module | Concern |
|---|---|
| `src/index.js` | HTTP entry, request routing, response shaping |
| `src/multi-llm.js` | Provider abstraction — one shape, four backends |
| `src/jd-analysis.js` | Job-description parsing and gap analysis |
| `src/kernel-extraction.js` | Pull a structured kernel from raw profile text |
| `src/prompt-augment.js` | Inject writing-style + package metadata into prompts |
| `src/prompt-injection-defense.js` | Detect and neutralise injection patterns in user-supplied text |
| `src/demo-enforcement.js` | Public-demo rate limits, per-IP / per-day caps |
| `src/byok-qualify.js` | Confirm a user-supplied API key is valid before storing |
| `src/jwt-verify.js` | Verify access-relay tokens |
| `src/supervisor.js` | Orchestration layer — task routing, retries, post-draft filter |
| `src/analytics-export.js` | Per-request telemetry forwarding to access-relay |
| `src/fetch-jd-url.js` | Server-side JD URL fetch with content-type and size guards |
| `src/web-search.js` | Web-search tool exposed to the LLM when enabled |

## Deploy

```bash
cd workers/proxy
wrangler deploy
```

CI deploy goes via `workflow_dispatch` in `.github/workflows/deploy.yml` — pick `proxy` as target, type `proxy` into the confirm field, run with `mode=dry-run` first, then re-run with `mode=deploy`.

## Secrets

```bash
wrangler secret put Claude_API_Key
wrangler secret put ChatGPT_API_Key
wrangler secret put Mistral_API_Key
wrangler secret put Gemini_API_Key
```

All four are optional; demo-enforcement decides which are user-facing. BYOK users supply their own at runtime and never hit these.

## Bindings

| Binding | Type | Purpose |
|---|---|---|
| `KV_BINDING` | KV namespace | Cached user prefs (read-only here; `access-relay` owns writes) |

Add via the Cloudflare dashboard: Workers & Pages → cv-proxy → Settings → Bindings → KV namespace bindings → variable name `KV_BINDING`.

## Observability

`wrangler.toml` must contain, after `compatibility_date`:

```toml
[observability.logs]
enabled = true
invocation_logs = true
```

The CI lint job rejects PRs that drop this block.

## Local development

```bash
cd workers/proxy
npm install
wrangler dev
```

The PWA reads its proxy URL from `pwa/relay-config.json` or from `localStorage.proxyUrl` at runtime; override locally to point at `http://localhost:8787`.

## Plan refs

This worker hosts the writing-engine pipeline planned in `docs/plan/AntCV_Plan_v2_LockedSources.md` § 4.7 (seven-step execution) and § 9.2 (request payload + SCE merge rule). Pass 3 work lands here:

- New request fields: `writingStyle`, `toneChips[]`, `extraBannedWords` (object keyed by lang per § 4.5.3), `extraBannedPhrases` (same shape), `extraConstraints[]`, `targetPages`, `sectionFormat`, `target_language`, `package`, `ats`.
- New SCE step (5): merge `shared_base[target_language]` ∪ `extraBannedWords[target_language]`, apply integrity rules (metric, role-boundary, research-evidence), retry up to two times, third returns `flagged: true`.
- Forward writing-style selection and per-category violation counts to access-relay analytics KV.
