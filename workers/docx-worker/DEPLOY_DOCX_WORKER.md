# Deploy AntCV DOCX Worker (paste-into-dashboard method)

Your worker URL `docx-worker.karp-gabriel-a.workers.dev` is currently running the
default Cloudflare "Hello World" template. The PWA's DOCX button is silently
falling back to its inline path because of this.

This guide replaces the deployed code with the real DOCX generator. No npm,
no wrangler, no terminal — just the Cloudflare dashboard.

---

## What you need

- Cloudflare dashboard access for the account that owns the worker.
- The bundled worker file: **`docx-worker.js`** (518 KB) or `docx-worker.min.js` (378 KB) — both work, the minified one just loads faster in the dashboard editor.

---

## Steps

### 1. Open the worker

1. Go to https://dash.cloudflare.com → **Workers & Pages**.
2. Click on **`docx-worker`** in the list.
3. Click **Edit code** (top-right).

You should see the current "Hello World" code in the editor.

### 2. Replace the code

1. Open `docx-worker.js` in any text editor (VS Code, Notepad, TextEdit).
2. Select all (Ctrl/Cmd-A) and copy.
3. In the Cloudflare editor, select all and **paste**. The whole file replaces.
4. Click **Save and deploy** (top-right).
5. Confirm the deploy when prompted.

### 3. Set the environment variable

The worker's CORS allowlist is controlled by an env var. Set it once:

1. Back on the worker's main page, click **Settings** → **Variables and Secrets**.
2. Under **Environment Variables**, click **Add variable**:
   - **Name:** `ALLOWED_ORIGINS`
   - **Value:** `https://cv-generator-det.pages.dev`
   - **Type:** plain text (not secret)
3. Click **Save and deploy**.

> If you skip this step, the worker accepts any origin (`*`) — fine for testing,
> but stricter security to set it.

### 4. Verify

Open these two URLs in a fresh browser tab:

- `https://docx-worker.karp-gabriel-a.workers.dev/health`
  → should return `{"ok":true,"version":"1.0.0"}`
- `https://docx-worker.karp-gabriel-a.workers.dev/schema`
  → should return a JSON schema document

If both work, the worker is live.

### 5. Reload the PWA

Hard-refresh the PWA tab (Ctrl-Shift-R / Cmd-Shift-R). The DOCX button now
uses the worker; the console should no longer show CORS errors. Files
generated this way pass Word's strict validation cleanly.

---

## If something goes wrong

**Editor refuses to save / says "Script too large":**
You're on the free Workers plan and the unminified bundle is too big.
Use `docx-worker.min.js` instead (378 KB → 111 KB gzipped, fits the 1 MB free limit).

**`/health` returns "Hello World" again:**
The deploy didn't take. In the dashboard, click **Triggers** → check that
the worker is enabled at `docx-worker.karp-gabriel-a.workers.dev`. Then redeploy.

**`/health` returns 1042 / 522 / Cloudflare error page:**
The worker isn't reachable at this URL anymore. Either workers.dev was
disabled in the account, or the route was removed. In the dashboard, go to
the worker → **Triggers** → make sure **Enabled** is on for the workers.dev
subdomain.

**CORS still fails after deploy:**
In the browser DevTools console, run:
```js
fetch('https://docx-worker.karp-gabriel-a.workers.dev/generate', {method:'OPTIONS'})
  .then(r => console.log('Status:', r.status, 'CORS:', r.headers.get('access-control-allow-origin')))
```
- Status 204 + CORS `*` or your origin → CORS works, the issue is elsewhere.
- Status 405 / 404 / no CORS header → the deployed code still doesn't have the OPTIONS handler. Re-do step 2.
