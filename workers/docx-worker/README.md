# docx-worker (`antcv-docx-worker`)

Cloudflare Worker that renders strict-Word-compliant `.docx` files from AntCV JSON payloads. Sidebar pagination, page-break support, photo placement, table layout, package palette resolution, ATS flatten path.

Package version: v1.14.13. Renderer last shipped at v1.14.12 (sidebar pagebreak fix).

## Files in this folder

| File | What |
|---|---|
| `src/index.js` | HTTP entry, payload validation, response shaping |
| `src/generate.js` | The renderer — OOXML emission, sidebar pagination, page-break logic (~116 KB) |
| `src/schema.js` | Payload validator |
| `test/` | 15 smoke files, one per regression we've debugged. See `TESTING.md` (repo root) for the file-by-file map. |
| [`CHANGELOG.md`](./CHANGELOG.md) | Version-by-version notes |
| [`DEPLOY_DOCX_WORKER.md`](./DEPLOY_DOCX_WORKER.md) | Full deploy walk-through with secrets and bindings |
| [`README_DEPLOY.md`](./README_DEPLOY.md) | Quick deploy reference |
| [`PATCH-FOR-INDEX-JS.md`](./PATCH-FOR-INDEX-JS.md) | Patches that the PWA's `antcv-docx-client.js` needs to keep in sync with worker changes |
| `wrangler.toml` | Worker config (observability block required) |
| `package.json` | npm scripts: `dev`, `deploy`, `tail`, `test` |

## Develop and test locally

```bash
cd workers/docx-worker
npm install
npm test           # runs test/smoke.js → writes out.docx
```

Open `out.docx` in Word or LibreOffice. The test passes if no "minor errors" dialog appears and the layout matches the expectation noted at the top of the test file.

Run an individual smoke:

```bash
node test/smoke-pagebreak.js
node test/smoke-orphan-subhead.js
# etc.
```

See [`TESTING.md`](../../TESTING.md) (repo root) for the full mapping of test files to what each one covers.

## Deploy

```bash
cd workers/docx-worker
wrangler deploy
```

Workflow_dispatch in `.github/workflows/deploy.yml`: target `docx-worker`, confirm `docx-worker`, dry-run first. Full walk-through in [`DEPLOY_DOCX_WORKER.md`](./DEPLOY_DOCX_WORKER.md).

## Bindings and secrets

None required. The worker is stateless — payload in, DOCX out.

## Observability

`wrangler.toml` must contain, after `compatibility_date`:

```toml
[observability.logs]
enabled = true
invocation_logs = true
```

## Plan refs

- `docs/plan/AntCV_Plan_v2_LockedSources.md` § 9.1 — token-driven palette + `package` / `writingStyle` / `ats` request fields land in Pass 2/3.
- § 8.2 DOCX regression matrix: 140 files (7 packages × 5 active styles × 2 sample CVs × EN + DA) lands in Pass 3.
- § 4.10 — ATS mode converts Unicode glyphs (`☎ ✉ 🔗 ⌂`) to plain text labels (`Phone:`, `Email:`, `Link:`, `Location:`); the worker performs the conversion when `ats: true`.
