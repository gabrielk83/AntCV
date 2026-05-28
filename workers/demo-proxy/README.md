# demo-proxy (`antcv-demo-proxy`)

Public-demo variant of `proxy/`. Same module surface; differences:

- Bundled API keys for Anthropic / OpenAI / Mistral / Gemini, gated by demo-enforcement.
- Per-IP and per-day rate limits in `src/demo-enforcement.js`.
- No BYOK qualification path.
- Conservative model defaults (cheapest tier per provider).

Use this worker for the public demo URL. Real users on the production app hit `proxy/`.

## Deploy

```bash
cd workers/demo-proxy
wrangler deploy
```

Workflow_dispatch in `.github/workflows/deploy.yml`: target `demo-proxy`, confirm `demo-proxy`, dry-run first.

## Secrets

Same as `proxy/` — see [`workers/proxy/README.md`](../proxy/README.md).

## Bindings

| Binding | Type | Purpose |
|---|---|---|
| `KV_BINDING` | KV namespace | Demo rate-limit counters per IP |

## Observability

`wrangler.toml` must contain the observability block — same as every other worker.

## Plan refs

Out of scope for the v1.50.0 writing-engine rollout. `demo-proxy` tracks `proxy/` once that pass lands — same seven-step pipeline, same request shape, different defaults.
