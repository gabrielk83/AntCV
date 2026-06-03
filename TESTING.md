# AntCV — Testing

Canonical index for everything testable in the repo. Test files live next to the code they exercise; this file maps them to the release-gate plan in `docs/plan/AntCV_Plan_v2_LockedSources.md` § 8.

---

## Test pyramid (per LockedSources § 8.1)

| Level | What | Where | Tooling |
|---|---|---|---|
| Unit | Banned-word detector, semantic-constraint matching, writing-style request parse, ATS glyph conversion, registry-drift guard | `workers/proxy/test/*.test.mjs` (40 tests, present) | node:test |
| Unit | Token resolution, package switch, placeholder scrubber, wizard state machine | (Pass 1 + Pass 3 will populate; not present yet) | Vitest |
| Integration | Proxy returns valid section after style swap; DOCX worker generates valid OOXML per package | (Pass 2 + Pass 3 will populate) | Vitest + xmllint |
| Visual regression | Screenshot diff of each section × package, light + dark | (Pass 2 + Pass 5 will populate) | Playwright + pixelmatch |
| DOCX regression | Generated DOCX validates against strict OOXML | `workers/docx-worker/test/*.js` (15 smoke files, present) | Existing OOXML validator (manual) |
| Telemetry / D1 | Insert llm_call, normalisation, cost recomputation, aggregation, prune retention | `workers/access-relay/tests/smoke.mjs` (16 tests, present) | sql.js mock of D1 |
| Delete-wipe | DELETE /api/prefs path clears KV and telemetry rows | `workers/access-relay/tests/delete-wipe.mjs` (present) | KV + D1 mock |
| End-to-end | Wizard → kernel → tailor JD → export, per style | (Pass 1 + Pass 3 will populate) | Playwright |
| CI lint | Repo-layout sanity + observability-block presence in every wrangler.toml | `.github/workflows/deploy.yml` (active) | GitHub Actions |
| Mobile smoke | Cold start, hard refresh, language toggle, package switch, style switch, import profile | Manual checklist, see § Hotfix smoke below | Three viewports |

---

## What runs today

### DOCX worker — `workers/docx-worker/test/`

Fifteen smoke files, each a self-contained Node script that calls `generateDocx()` and writes `out.docx` for manual inspection. Run any of them with `node test/<name>.js` from inside `workers/docx-worker/`.

| File | Covers |
|---|---|
| `smoke.js` | Baseline: full CV payload, sidebar + main column, profile + core competencies + experience + tools + certs + education. Writes `out.docx`. |
| `smoke-status.js` | Status field rendering in headers. |
| `smoke-version-stamp.js` | Worker version stamp in document properties. |
| `smoke-pagebreak.js` | Page-break handling between sections. |
| `smoke-orphan-subhead.js` | Sidebar sub-heading appearing alone at page end. |
| `smoke-dedupe.js` | De-duplication of repeated content. |
| `smoke-item-filter.js` | Empty / null item filtering. |
| `smoke-bugs-hidden-htmldedupe.js` | Hidden-HTML dedupe regression. |
| `smoke-bugs-objobj-edu-spacing.js` | `[object Object]` rendering + education spacing. |
| `smoke-jd-questions-page2.js` | JD questions overflow to page 2. |
| `smoke-nil-tech-publications.js` | Empty technical-publications section. |
| `smoke-v101-photo-spacing.js` | Photo spacing regression from v1.0.1. |
| `smoke-v110-formatting.js` | Formatting regression from v1.1.0. |
| `smoke-workstyle-spacing.js` | Work-style sidebar spacing. |
| `edges.js` | Edge-case payload variants. |

The npm script `npm test` (in `workers/docx-worker/package.json`) runs `smoke.js` by default. Other smokes are run by file name. After running, open the produced `out.docx` in Word or LibreOffice — the test passes if no "minor errors" dialog appears and the layout matches the expectation noted at the top of the test file.

**No automated diff yet.** Each smoke is a one-shot generator; visual comparison is manual. LockedSources § 8.2 plans a 140-file DOCX regression matrix (7 packages × 5 active styles × 2 CVs × EN + DA) with a strict OOXML validator gate at v1.50.0 cut; that work is in Pass 2 + Pass 3.

### Access relay — `workers/access-relay/tests/`

Two test files. Run with `node tests/<name>.mjs` from inside `workers/access-relay/`. Both use sql.js to mock D1 in-process, so they need no Cloudflare credentials.

| File | Test count | Covers |
|---|---|---|
| `smoke.mjs` | 16 | Telemetry insertion (`insertLlmCall`), provider whitelisting, task normalisation, success / failure flags, cost recomputation override (server beats client), bulk aggregation (`aggregateHealth`), latest-health snapshots over multiple windows (60 min, 1 day, 1 week), quality-signal back-fill (call_id / request_id / fuzzy match paths), invalid-signal rejection, retention floor on prune (7-day minimum even if env var requests less). |
| `delete-wipe.mjs` | (see file) | DELETE /api/prefs flow clears KV blob and the telemetry rows tied to the user-hash. |

Both expect `node ≥ 22` (uses native `globalThis.crypto.subtle`) and the sql-wasm files at the path noted at the top of each file — adjust before first run.

### Proxy worker — `workers/proxy/test/`

Two `node:test` suites covering the §4.7 writing-engine pipeline. Pure logic — no
Cloudflare bindings, no network: every LLM call is dependency-injected. Run with
`npm test` (which is `node --test`) from inside `workers/proxy/`, or `node --test`
directly.

| File | Test count | Covers |
|---|---|---|
| `writing-style-engine.test.mjs` | 32 | Request parse + normalisation (legacy-style aliases, language fallback, targetPages clamp per style, extra-banned buckets, ATS flag, per-section line-limit clamp); system-prompt preamble (style row, integrity rules, ATS announce, **language-partitioned banned lists**, user-extra union, tone-chip fallback); SCE banned-word + banned-phrase detection (word-boundary guard, hyphen-tolerant phrase match, **language partition — English bans never applied to Danish text**); ATS glyph conversion; the SCE retry loop (clean first pass, dirty-then-clean re-request with fix instruction, flagged-after-budget, ATS applied to final text); provider-agnostic extract/replace for both `openai_compat` and `anthropic_messages`; `executeSceWithRetry` re-call + SCE response headers. |
| `registry-sync.test.mjs` | 8 | Drift guard between the worker's inline style/banned-list subset and the canonical `writingSystems/registry.json`: style-id set, default style, supported-language partition, shared banned words + phrases (exact), per-style active flag / allowed length / tone chips / glyph density, every registry legacy alias resolves through the parser, active-at-cut roster matches the worker's active flags. |

These seed the §8.4 writing-style-violation matrix and the §4.5/§4.7 banned-list
and semantic-constraint contracts. They run in CI on every pull request (see
below). When `writingSystems/registry.json` and the worker's inline copy drift,
`registry-sync.test.mjs` fails before merge.

### CI lint + unit tests — `.github/workflows/deploy.yml`

The `lint` job runs on every push, every pull request, and every
workflow_dispatch. It checks:

1. `pwa/index.html` and `pwa/sw.js` exist.
2. Every worker has a `wrangler.toml` at `workers/<name>/wrangler.toml`.
3. Every `wrangler.toml` contains both `enabled = true` and `invocation_logs = true` (the observability gate from `CONTRIBUTING.md`).

It's a sanity guard, not a functional test. PRs cannot land if `lint` is red.

Alongside it, the `unit-tests` job runs `node --test` in `workers/proxy/` on every
push and pull request (Node 22, no install step — the suites have no dependencies).
This is the first functional check wired into CI. A registry-drift or
banned-list-contract regression fails the PR.

---

## What's planned (LockedSources § 8.2 — § 8.9)

Pass 2 + Pass 3 add the matrices below. Currently empty pending implementation.

| § | Test | Files when populated |
|---|---|---|
| § 8.2 | Visual regression: 7 packages × 1 CV × 3 breakpoints = 21 baselines | `pwa/test/visual/` |
| § 8.2 | DOCX regression: 7 packages × 5 active styles × 2 CVs × EN + DA = 140 files | `workers/docx-worker/test/regression/` |
| § 8.3 | Showcase isolation: 20 cold-start runs, zero leakage of kernel names (Innoviz, Sirin, Meprolight, TAU, Therma, DTU, Kanzen, Maersk, LEGO, Danfoss) | `pwa/test/e2e/showcase-isolation.spec.ts` |
| § 8.4 | Writing-style violations: 50 generations per (style × section), ≤5 violations / 100 per category (banned word, banned phrase, semantic constraint, metric integrity, role-boundary integrity). **Detector + filter contract now unit-covered** by `workers/proxy/test/writing-style-engine.test.mjs`; the full live-generation matrix is still pending. | `workers/proxy/test/violations.js` |
| § 8.5 | Custom mode: 5 scenarios on the package picker (quick alt, off-palette hex, restricted font, incompatible image setting, refresh without save) | `pwa/test/e2e/custom-mode.spec.ts` |
| § 8.6 | ATS mode: each package + each active style, parser round-trip via Workday CV import + LinkedIn Easy Apply | `workers/docx-worker/test/ats/` |
| § 8.7 | Modal stacking: 6 modals × mobile + desktop | `pwa/test/e2e/modal-stacking.spec.ts` |
| § 8.8 | Independence: style swap with package fixed (content only, no colour / font changes); package swap with style fixed (colour / font only, no content reorder) | `pwa/test/visual/independence.spec.ts` |
| § 8.9 | Release gate: aggregates the above | `scripts/release-gate.sh` |

---

## Hotfix smoke (manual, ≈15 minutes)

After any hotfix release, run the six-step list in `docs/plan/AntCV_Plan_v2_LockedSources.md` § 5.1:

1. Sign out → delete user → sign in. Wizard does not flash and close. Pass: wizard stays open or Set screen loads cleanly.
2. Settings → Personal → Languages card collapsed by default. Toggle persists across reload.
3. Wizard steps 1 → 2 → 3 → step-3-to-4 AI notice appears on mobile portrait and landscape.
4. Settings → Import profile: JSON, PDF, DOCX, PNG all import on iOS Safari and Android Chrome.
5. Re-verify shipped fixes: top-bar languages, JD Analysis FAB on desktop, Open in Settings from Application history, no duplicate preview toolbar.
6. Worker URL step: Next reaches AI notice; AI notice clears any stale `.antcv-ai-notice-host` and re-fires (the v1.40.337 fix).

Fail any step → do not ship, iterate on that fix only.

---

## End-to-end with the test persona

`docs/personas/anita/` holds a synthetic candidate ("Anita Mayr-Kornfeldt") used for any end-to-end run that needs a full personalInfo object, photo, certificate PDFs, and a LinkedIn-style profile screenshot. See `docs/personas/anita/README.md` for the schema and what each file contains.

Use Anita for any test that exercises:

- Wizard import flow (PDF + DOCX + JSON + image-OCR paths)
- Kernel extraction from a real-ish profile
- Showcase mode isolation
- Cross-language generation (EN, DA at v1.50.0; ES, ZH later)
- ATS export round-trip

Do not use real candidate data in tests. The kernel-validator and showcase-isolation tests in LockedSources § 8.3 specifically grep for personal-identifier leakage; a real name in a test fixture will trip them.

---

## Adding a new test

1. Identify which level it sits at (table at top of this file).
2. Place the file under the worker / area it exercises (`workers/<name>/test/`, `pwa/test/<level>/`).
3. If it covers a § 8.x release-gate item, cite the § ref in the file's header comment.
4. Update the relevant table in this file.
5. If it has a runner command, add it to the per-worker README's "Develop and test locally" section.
6. If it should run in CI, add a job under `.github/workflows/deploy.yml`. Default for new tests: not in CI until they're stable.

New test files must follow the voice rules in `CONTRIBUTING.md` — that applies to comment prose and assertion messages, not just product output.
