# Workers

Four Cloudflare Workers, each in its own folder, each independently deployable via `wrangler deploy`.

| Folder | Purpose | Latest version |
|---|---|---|
| `proxy/` | LLM proxy. Routes requests to Anthropic, OpenAI, Mistral, or Gemini. Handles JD analysis, kernel extraction, demo enforcement, BYOK qualification, prompt-injection defence, and per-user web search. | v3.4.0 |
| `docx-worker/` | Server-side DOCX generation with sidebar pagination, page-break support, and PDF page-count check. | v1.14.12 (sidebar pagebreak fix) |
| `c2pa-worker/` | C2PA provenance signing for AI-assisted documents. TypeScript + WASM. | v1.0.1 |
| `access-relay/` | Cloud sync of `personalInfo` + `prefs` blobs, delete-wipe with `DELETE /api/prefs`, optional LLM telemetry. KV-backed. | v2.5.4 |

## Deploy one

```bash
cd workers/<name>
wrangler deploy
```

The Wrangler CLI uses `wrangler.toml` in each folder for name, main entry, compatibility date, KV bindings, and route patterns.

## Deploy all

`scripts/deploy/deploy-all-workers.sh` is a thin loop that does the four. Run it after any change that touches more than one worker.

## Per-worker setup notes

See the README inside each folder for secrets, KV namespaces, and route patterns specific to that worker. The cross-cutting deployment walk-through is in `docs/deployment/cloudflare-setup.md`.

## Editing rules

1. Every `wrangler.toml` must contain a `[observability.logs]` block with `enabled = true` and `invocation_logs = true` placed **after** the `compatibility_date` line. Without it, debugging from the Cloudflare dashboard is impossible.
2. Workers don't share code yet. If a utility is duplicated across two workers, prefer copying for now rather than introducing a shared package — keeps deploys independent.
3. Don't commit `.dev.vars`. Secrets live in `wrangler secret put`, not in source files.
