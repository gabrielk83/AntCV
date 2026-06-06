# AntCV — Test & QA harness

Two layers, both zero-to-low dependency, both runnable headless for CI / a
pre-push hook. The goal is to convert "live-verification owed" backlog items
into automated, repeatable gates.

## 1. Node unit harness — `npm test`

Runs every `*.test.mjs` / `*.test.js` in the repo through Node's built-in test
runner (`node:test` + `node:assert`), the convention already used across
`pwa/test/`, `workers/docx-worker/test/`, and `workers/proxy/test/`.

| Command | Scope |
|---------|-------|
| `npm test` | every unit test, repo-wide (one pass/fail + exit code) |
| `npm run test:pwa` | only `pwa/**` |
| `npm run test:workers` | only `workers/**` |
| `npm run test:smoke` | the docx-worker integration smoke (writes `out.docx`) |

Discovery + execution lives in `scripts/run-tests.mjs` (no deps; walks the tree,
skips `node_modules/.git/.claude/dist`, runs `node --test` on the collected
files). Standalone integration smokes (`workers/*/test/smoke*.js`,
`workers/access-relay/tests/*.mjs`) are **not** collected — they write artefacts
or assume a wrangler/sql.js environment; run them by hand.

Current state: **80 tests, all green** (data-export, import-normalize, docx
palette, proxy registry-sync + writing-style-engine).

Adding a test: drop a `something.test.mjs` next to the code, import
`node:test` + `node:assert/strict`, and it's picked up automatically.

## 2. Browser-QA harness — `npm run qa:browser`

Drives a real Chromium (Playwright) against a deployed or local PWA, seeds the
**Anita persona** + known-bad state into `localStorage`, reloads, and asserts the
behaviour the bug tracker marks "live-verification owed". Each check screenshots
to `docs/qa/screenshots/`; the run writes `docs/qa/last-browser-qa.json` and
exits non-zero on any failure.

One-time setup (per machine):

```
npm i -D playwright && npx playwright install chromium
```

Usage:

```
npm run qa:browser                              # production (antcv.pages.dev)
node scripts/browser-qa.mjs --url http://localhost:8788
node scripts/browser-qa.mjs --headed            # watch it
node scripts/browser-qa.mjs --only palette-mix  # one check
node scripts/browser-qa.mjs --jwt "<token>"     # enable auth-gated checks
```

Checks shipped:

| id | bug | gate |
|----|-----|------|
| `boot` | smoke | persona loads, no uncaught console errors |
| `palette-mix` | PACKAGE-PALETTE-MIX-001 | seed orphan `stylePackage="scandinavian"`, reload, assert `localStorage.stylePackage` resolves to a registry id **and** matches `body[data-package]`, and `toneRegister` is no longer the orphan. This is the exact 2026-06-06 Chrome verification, automated. |
| `demo-config` | DEMO-PERSIST-001 | (auth) `/config` reports `demo_mode` boolean; a demo user reading `paid`/`false` == still OPEN |
| `demo-mode-roundtrip` | DEMO-PERSIST-001 | (auth) POST `/api/user/mode {demo}` → GET reads back `demo` (proves the write path vs an allowlist pin) |

The two `demo-*` checks are auth-gated; pass a signed-in account's bearer via
`--jwt` (or `ANTCV_QA_JWT`) to run them. Without it they SKIP, not fail.

Adding a check: push `{ id, desc, auth?, run(page, ctx) }` to `CHECKS` in
`scripts/browser-qa.mjs`. `ctx` gives `seed(state)`, `screenshot(name)`, and the
parsed `persona`.

## Suggested pre-push hook

`.git/hooks/pre-push` (or wire via the owner's preferred hook manager):

```sh
#!/bin/sh
npm test || exit 1
# browser QA is opt-in on push (needs a deployed target):
# npm run qa:browser || exit 1
```
