# AntCV

Build a clean CV and cover letter. Fast, structured, easy to edit. AI-assisted via your own LLM keys, a shared demo provider, or your own Cloudflare Worker.

Cloudflare Pages (PWA) + Workers (proxy, DOCX renderer, C2PA signer, access relay, demo proxy) + optional MCP server.

---

## Documentation map

| Topic | File |
|---|---|
| Repo layout, build state, quick start | this file |
| Runtime topology, five-engine model, language-partitioned constraints | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| What runs, what's planned, how to invoke tests | [`TESTING.md`](./TESTING.md) |
| Patch protocol, voice rules, pass-based delivery | [`CONTRIBUTING.md`](./CONTRIBUTING.md) |
| AI-assistant orientation (Claude Code, etc.) | [`CLAUDE.md`](./CLAUDE.md) |
| Cloudflare deployment walk-through | [`docs/deployment/cloudflare-setup.md`](./docs/deployment/cloudflare-setup.md) |
| Current correction + implementation + testing plan | [`docs/plan/AntCV_Plan_v2_LockedSources.md`](./docs/plan/AntCV_Plan_v2_LockedSources.md) |
| Locked source: visual packages | `docs/design/Unified_Visual_Package_System.docx` |
| Locked source: writing engines | `docs/design/Writing_System_Engine_Specification.docx` |
| Test persona (Anita Mayr-Kornfeldt) | [`docs/personas/anita/README.md`](./docs/personas/anita/README.md) |
| Per-component READMEs | [`pwa/README.md`](./pwa/README.md), [`workers/README.md`](./workers/README.md), per-worker READMEs under `workers/<name>/` |
| Portable writing skill | [`skills/antcv-writer/SKILL.md`](./skills/antcv-writer/SKILL.md) |

---

## Layout

```
antcv/
├── .github/
│   └── workflows/deploy.yml       Lint + path-filtered PWA auto-deploy +
│                                  workflow_dispatch worker deploy with
│                                  confirm-input typo guard.
│
├── pwa/                           Cloudflare Pages target. index.html,
│                                  app.js, sidecar antcv-*.js scripts,
│                                  sw.js, manifest.json, icons/.
│
├── workers/
│   ├── proxy/                     LLM routing (Anthropic, OpenAI, Mistral,
│   │                              Gemini). JD analysis, kernel extraction,
│   │                              demo enforcement, BYOK qualification,
│   │                              prompt-injection defence, supervisor.
│   ├── demo-proxy/                Public-demo variant of proxy. Bundled
│   │                              keys + rate limits.
│   ├── docx-worker/               Server-side DOCX generation with sidebar
│   │                              pagination, page-break support, photo
│   │                              placement, package palette resolution.
│   ├── c2pa-worker/               C2PA provenance signing. TypeScript +
│   │                              WASM.
│   ├── access-relay/              Cloud sync (personalInfo + prefs),
│   │                              delete-wipe, LLM telemetry. KV + D1.
│   └── antcv-mcp/                 MCP server (Github OAuth) exposing
│                                  repo-edit + deploy tools to AI
│                                  assistants. Not on the user data path.
│
├── docs/
│   ├── plan/                      AntCV_Plan_v2_LockedSources.md plus
│   │                              UI/UX bugfix plan and session prompts.
│   ├── design/                    Locked source specifications.
│   ├── deployment/                Cloudflare setup walk-through.
│   └── personas/anita/            Test persona for end-to-end runs.
│
├── skills/antcv-writer/           Portable Claude skill — the writing
│                                  rules as readable spec. SKILL.md is
│                                  the entry point.
│
├── scripts/deploy/                deploy-pwa.sh, deploy-worker.sh,
│                                  deploy-all-workers.sh.
│
├── ARCHITECTURE.md                Runtime topology + engine model.
├── TESTING.md                     Test catalogue.
├── CONTRIBUTING.md                Patch protocol + voice rules.
├── CLAUDE.md                      AI-assistant orientation.
└── README.md                      This file.
```

---

## Current build state

| Component | Version | Notes |
|---|---|---|
| PWA | v1.40.337-ai-notice-fix | Wizard "Next" on the worker-URL step now clears any stale `.antcv-ai-notice-host` before injecting a fresh notice. Carries the version-grow-fix from v1.40.336 and the four mechanical patches from v1.40.335-hotfix-b. See `pwa/README-v1.40.337-ai-notice-fix.txt`. |
| proxy worker | v3.4.0 | |
| docx-worker | v1.14.13 (renderer at v1.14.12 sidebar pagebreak fix) | |
| c2pa-worker | v1.0.1 | |
| access-relay | v2.5.4 | |
| demo-proxy | tracks proxy | |
| antcv-mcp | (not user-facing) | |

---

## Quick start

```bash
# One-time
npm install -g wrangler
wrangler login

# PWA (Cloudflare Pages)
cd pwa
wrangler pages deploy . --project-name=antcv --branch=main

# A worker (example: proxy)
cd workers/proxy
wrangler deploy
```

Full walk-through: [`docs/deployment/cloudflare-setup.md`](./docs/deployment/cloudflare-setup.md). Smoke test after deploy: [`TESTING.md`](./TESTING.md) § Hotfix smoke.

---

## Architecture in one paragraph

Visual and writing are independent layers — a writing style does not change tokens; a package does not change section order. The visual layer is seven packages in `packages/registry.json` (planned, Pass 2) consumed by both PWA and DOCX worker. The writing layer is twelve canonical styles routed through a five-engine pipeline (Writing System → Layout + Section → Density + Compression → Semantic Constraint → ATS / Export) in the proxy worker. Banned-word and integrity-rule violations trigger a two-retry loop; the third draft returns flagged. Banned lists are language-partitioned (object keyed by ISO 2-letter code), so a Danish output is never filtered against English bans. Full picture in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Tests

Active test suites:

- [`workers/docx-worker/test/`](./workers/docx-worker/test/) — 15 smoke files covering OOXML output, sidebar pagination, page breaks, dedupe, photo spacing. Run with `npm test` or `node test/<name>.js` from inside the worker dir.
- [`workers/access-relay/tests/`](./workers/access-relay/tests/) — telemetry insertion, normalisation, cost recomputation, aggregation, prune retention (`smoke.mjs`, 16 tests); delete-wipe path (`delete-wipe.mjs`). Both use sql.js to mock D1 in-process.
- [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml) `lint` job — repo-layout sanity + observability-block presence in every `wrangler.toml`. Runs on every push.

Planned (LockedSources § 8): visual regression (21 baselines), DOCX regression (140 files), showcase isolation (20 cold-start runs), writing-style violation matrix (50 generations per style × section), ATS-mode parser round-trip, modal stacking, independence test (style swap = content only, package swap = tokens only).

Full catalogue with file-level mapping: [`TESTING.md`](./TESTING.md).

---

## Contributing

Patch protocol, branch naming, voice rules, observability requirement, zip layout: [`CONTRIBUTING.md`](./CONTRIBUTING.md). AI assistants read [`CLAUDE.md`](./CLAUDE.md) first.

---

## License

Proprietary, all rights reserved unless a different LICENSE file is added later.
