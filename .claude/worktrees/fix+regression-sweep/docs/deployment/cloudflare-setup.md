# Cloudflare deployment

End-to-end guide for the AntCV PWA (Cloudflare Pages) and the four Workers (Wrangler).

## Prerequisites

```bash
npm install -g wrangler
wrangler login                     # opens browser, OAuths your CF account
wrangler whoami                    # confirm
```

Cloudflare account needs: Pages enabled, Workers paid plan (free works for small traffic, paid removes daily-request cap), KV namespace access, Workers AI (only if used by any worker), R2 if any worker stores artefacts.

---

## PWA — Cloudflare Pages

The PWA is a static site (no build step needed). Two ways to deploy:

### Option A — Wrangler CLI (preferred for hotfixes)

```bash
cd pwa
wrangler pages deploy . \
  --project-name=antcv \
  --branch=main \
  --commit-message="v1.40.335-hotfix-b"
```

First-time only: Wrangler will prompt to create the `antcv` Pages project; accept.

### Option B — Git integration (preferred for steady-state)

In the Cloudflare dashboard:

1. Workers & Pages → Create application → Pages → Connect to Git.
2. Select this repo and the `main` branch.
3. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `pwa`
   - **Root directory (advanced):** *(leave empty)*
4. Save and deploy.

After the first deploy: every `git push origin main` triggers a Pages build; PR branches get preview URLs automatically.

### Production domain

Once the project is live at `antcv.pages.dev`:

1. Pages project → Custom domains → Add → enter your domain (e.g. `app.antcv.com`).
2. Add the CNAME shown to your DNS.
3. Cloudflare provisions the cert (free) within a few minutes.

---

## Workers (four)

Each worker has its own `wrangler.toml`. Deployment is per-worker:

```bash
cd workers/proxy && wrangler deploy
cd workers/docx-worker && wrangler deploy
cd workers/c2pa-worker && wrangler deploy
cd workers/access-relay && wrangler deploy
```

### Pre-deploy checks per worker

For every `wrangler.toml`, confirm before the first deploy:

```toml
name = "antcv-<worker-name>"          # must be unique in your CF account
main = "src/index.js"                 # or src/index.ts for typescript workers
compatibility_date = "2025-XX-XX"     # recent date

[observability.logs]                  # required so you can debug from the dashboard
enabled = true
invocation_logs = true
```

### Secrets and bindings per worker

| Worker | Secrets needed | KV/D1/R2 bindings |
|---|---|---|
| `proxy` | `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `GEMINI_API_KEY` (any subset; demo enforcement gates which are user-facing) | None required by default |
| `docx-worker` | None | None |
| `c2pa-worker` | C2PA signing key (see `workers/c2pa-worker/README.md`) | None |
| `access-relay` | `JWT_SECRET` for verification of tokens issued by your auth provider | KV namespace for `personalInfo` + `prefs` blobs; D1 if telemetry table is enabled (`schema.sql`, `schema-telemetry.sql`) |

Set a secret:

```bash
cd workers/<worker>
wrangler secret put ANTHROPIC_API_KEY    # prompts for value, encrypts, stores
```

Set a KV namespace (example, access-relay):

```bash
cd workers/access-relay
wrangler kv namespace create "ANTCV_KV"
# wrangler prints the ID; copy into wrangler.toml under [[kv_namespaces]]
wrangler deploy
```

### Wiring the PWA to the workers

The PWA reads the relay URL from `pwa/relay-config.json`. Edit that file before deploying the PWA, or override at runtime via `localStorage.proxyUrl` / `localStorage.relayUrl`.

```json
{
  "relay": "https://antcv-access-relay.your-subdomain.workers.dev"
}
```

Per-user worker URLs (BYOK path) are stored in `personalInfo.proxyUrl` once entered in the wizard.

---

## Smoke test after deploy

1. Visit the deployed Pages URL in an incognito tab.
2. DevTools → Application → Service Workers → Update. Confirm new SW version.
3. Reload. Confirm version banner shows the expected `1.40.x` string.
4. Sign in. Confirm `/api/prefs` GET fires once (Network tab) and the response is filtered correctly.
5. Walk the wizard end-to-end with the Anita persona files (`docs/personas/anita/`).
6. Export a CV as DOCX. Confirm the docx-worker round-trip succeeds and the file opens cleanly in Word/LibreOffice.

---

## Rolling back

PWA: Cloudflare Pages keeps every deploy. Project → Deployments → pick the previous good one → Rollback.

Worker: keep the previous build's zip in your local archive; `cd workers/<worker> && wrangler deploy` redeploys whatever is in the working tree. Use git tags (e.g. `proxy-v3.4.0`) to mark known-good points.

---

## CI/CD (placeholder, not active yet)

`.github/workflows/` has a stub for build + lint + deploy on push to `main`. When you're ready to enable, add the following GitHub secrets:

- `CLOUDFLARE_API_TOKEN` — scoped to Pages Write + Workers Write on this account.
- `CLOUDFLARE_ACCOUNT_ID` — visible in the CF dashboard URL.

Then uncomment the deploy job in `.github/workflows/deploy.yml`.
