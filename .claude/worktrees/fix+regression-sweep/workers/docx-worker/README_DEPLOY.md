# AntCV DOCX Worker — deploy

Deploys to **`docx-worker.<your-account>.workers.dev`** (matches the URL the
AntCV PWA points to).

## Deploy

From this folder:

```bash
npm install                  # first time only
npx wrangler login           # first time only — opens a browser window
npx wrangler deploy
```

Wrangler prints the deployed URL on success. It should match what the PWA
calls (check the Settings → Advanced → Routing field).

## Verify

After deploy, hit `/health`:

```text
https://docx-worker.<your-account>.workers.dev/health
```

Expected JSON:

```json
{"ok":true,"version":"1.10.0-formatting-fixes"}
```

If you do not see `1.10.0-formatting-fixes`, something blocked the deploy
(check `wrangler deploy` output) — fix that before testing in the PWA.

PowerShell users: `Invoke-RestMethod` or `curl.exe -s`. Plain `curl` in
PowerShell is aliased to `Invoke-WebRequest` and does not understand `-s`.

## Troubleshooting

**Wrangler says it deployed but `/health` still reports the old version.**
You probably deployed to a different worker name than the one your PWA
calls. Check the worker URL printed by `wrangler deploy` against the URL
configured in the PWA's Settings → Advanced → Routing → DOCX worker URL.
Both must match.

Do not add `[limits] cpu_ms = ...` on the Cloudflare Free plan.

## Logout hard reset

`/logout` redirects to:

```text
https://cv-generator-det.pages.dev?hardReset=1&logout=1
```

## Analytics export

This build no longer fails with `{"error":"ANALYTICS KV not bound"}`.
If the `ANALYTICS` KV binding is missing, export returns an empty payload
instead of failing.

Optional KV binding, only after you create a KV namespace:

```toml
# [[kv_namespaces]]
# binding = "ANALYTICS"
# id = "YOUR_KV_NAMESPACE_ID"
```
