# AntCV

Build a clean CV and cover letter. Fast, structured, easy to edit. AI-assisted via your own LLM keys, a shared demo provider, or your own Cloudflare Worker.

This repository is the source of truth for the AntCV PWA, its Cloudflare Workers, and the design/plan documentation. Cloudflare Pages + Workers is the target deployment path; the repo is organised around that.

---

## Layout

```
antcv/
├── pwa/                  Cloudflare Pages target. The PWA bundle: index.html,
│                         app.js, sidecar antcv-*.js scripts, sw.js, manifest.json,
│                         icons/. Deploys via Wrangler Pages or the dashboard.
│
├── workers/
│   ├── proxy/            LLM proxy. Multi-LLM (Anthropic, OpenAI, Mistral,
│   │                     Gemini), JD analysis, kernel extraction, demo
│   │                     enforcement. Wrangler-deployed.
│   ├── docx-worker/      Server-side DOCX generation with sidebar pagination
│   │                     and page-break support.
│   ├── c2pa-worker/      C2PA provenance signing for AI-assisted documents.
│   └── access-relay/     Cloud sync (personalInfo + prefs), delete-wipe,
│                         LLM telemetry. KV-backed.
│
├── docs/
│   ├── plan/             AntCV_Plan_v2_LockedSources.md — current
│   │                     correction/implementation/testing plan.
│   ├── design/           Locked source specifications:
│   │                       - Unified Visual Package System
│   │                       - Writing System Engine
│   ├── deployment/       Cloudflare setup walk-through.
│   └── personas/anita/   Test persona (synthetic ant-themed identity used
│                         for end-to-end testing without touching real
│                         candidate data).
│
├── scripts/deploy/       deploy-pwa.sh, deploy-worker.sh — thin wrappers
│                         around wrangler commands.
│
└── .github/workflows/    CI placeholders (preview build, lint, smoke).
```

---

## Current build state

| Component | Version | Notes |
|---|---|---|
| PWA | v1.40.336-version-grow-fix | Carries the four mechanical patches from v1.40.335-hotfix-b. Adds two fixes: removes `1.40.335` from `STALE_VERSIONS` in the version-override sidecar (it was matching its own output) and adds an idempotency guard so the rewrite loop can't re-trigger. See `pwa/README.md`. |
| Proxy worker | v3.4.0 | |
| DOCX worker | v1.14.12 (sidebar pagebreak fix) | |
| C2PA worker | v1.0.1 | |
| Access relay | v2.5.4 | |

---

## Quick start (local)

```bash
# Install wrangler if you don't have it
npm install -g wrangler
wrangler login

# Deploy the PWA to Cloudflare Pages
cd pwa
wrangler pages deploy . --project-name=antcv

# Deploy a worker (example: proxy)
cd workers/proxy
wrangler deploy

# Repeat for each worker as needed
```

See `docs/deployment/cloudflare-setup.md` for the full walk-through including KV bindings, secrets, and per-worker configuration.

---

## Source-document hierarchy

When something is unclear about visual styling, writing behaviour, or wizard logic, consult these in this order:

1. **`docs/design/Unified_Visual_Package_System.docx`** — visual packages, tokens, glyphs, photo, ATS, print rules.
2. **`docs/design/Writing_System_Engine_Specification.docx`** — five execution engines (Writing, Layout, Density, Semantic, ATS) and twelve canonical writing styles.
3. **`docs/plan/AntCV_Plan_v2_LockedSources.md`** — current plan: corrections + implementation passes + testing matrix, derived from the two docs above.

If any of these conflict with code behaviour, raise an issue; the documents win.

---

## Test persona

`docs/personas/anita/` contains a fully populated, synthetic ant-themed candidate ("Anita Mayr-Kornfeldt") with:
- `personalInfo.json` in the current schema
- Avatar and a fake LinkedIn-style profile screenshot ("HiveIn")
- Two PDF certificates (MSc diploma and logistics certification)

This is the recommended test data for end-to-end runs — never real candidate data.

---

## Contributing / iterating

Pass-based implementation order is defined in the plan. The active pass at time of writing is **Pass 1** (UI stability + React refactor). The hotfix series (v1.40.335-hotfix-b is the latest safe build) buys time until Pass 1 lands. After Pass 1 closes, `antcv-stability-core-*.js` is deleted from `pwa/index.html` entirely.

---

## License

Proprietary, all rights reserved unless a different LICENSE file is added later.
