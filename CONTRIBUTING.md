# Contributing to AntCV

For humans contributing patches. AI assistants should read `CLAUDE.md` first — it covers the same protocol with extra detail on fetch-wrapper ordering and version-string hygiene.

---

## Quick reference

| Topic | Rule |
|---|---|
| Branch | `feat/<scope>` for features; `fix/<scope>` for fixes; `hotfix/<version>-<scope>` for production hotfixes |
| Commit messages | One-line subject, factual, present tense (`docs(plan): formalise §4.5.3` not `Formalising 4.5.3 schema`) |
| PR title | Same convention as commit message; PR description cites the LockedSources § ref it implements |
| Voice in prose (READMEs, comments, commit messages, PR descriptions) | Banned-list applies; see below |
| Em dashes | `—` only; never `–` (en dash) |
| Wrangler | Every `wrangler.toml` carries `[observability.logs]` with `enabled = true` and `invocation_logs = true`, placed after `compatibility_date` |
| PWA zip releases | Files at zip root; never nested in a subfolder |
| Worker deploys | `workflow_dispatch` only, dry-run first, confirm input must match target |

---

## Patch protocol

Before changing any file under `pwa/`, `workers/`, or `skills/`:

1. **Confirm the file is loaded.** Several `pwa/antcv-*.js` files are present on disk but not referenced in `pwa/index.html` — they were retired in v1.40.303. Grep `pwa/index.html` for `<script src="..."` before editing any sidecar. An edit to a dead file is a no-op that burns a hotfix slot.
2. **View the surrounding 20 — 40 lines** including the immediate ancestor function. Don't replace strings blindly.
3. **Unique-string replacement.** The string you replace must appear exactly once in the file. Count first; if it appears more than once, narrow it with context until it's unique.
4. **Re-grep after editing.** Confirm the change landed exactly once.
5. **Bump cache and version.** After any `pwa/antcv-*.js` change:
   - Bump the `?v=` query string on the changed file in `pwa/index.html`.
   - Bump `pwa/sw.js` `CACHE` constant.
   - Update `pwa/antcv-version-override.js` `TARGET_VERSION`.
   - Add the *previous* `TARGET_VERSION` value to `STALE_VERSIONS`. Never add the current `TARGET_VERSION` to that list — it triggers a self-rewriting loop that grows the version string by a suffix on every `MutationObserver` cycle.

---

## Voice rules for prose

Applies to anything you write into the repo: READMEs, comments, commit messages, PR descriptions, design notes, plan additions, test assertion messages.

**Banned words:** spearhead, ensure, foster, streamline, strengthen, empower, leverage, drive change, deliver value, robust, comprehensive, cutting-edge, state-of-the-art, world-class, leading, impactful, rooted, grounded, committed, passionate, holistic, cross-functional, collaborative, journey, dynamic, proactive, results-driven, strategic, agile (unless software methodology).

**Banned phrases:** key role, pivotal role, proven track record, strong communicator, strategic mindset, mission-driven, "I am passionate about", "I look forward to hearing from you", responsible for.

**Banned openers and patterns:** "In my role…", "Whether in X or Y…", "Across functions and geographies…", "My career has been built on…", "I have demonstrated the ability to…", "Ensured alignment of…".

**Banned typography:** en dashes (`–`), exclamation marks, filler transitions (moreover, therefore, furthermore).

**Preferred style:** short factual sentences, concrete actions, specific outcomes, measurable examples when available, human professional tone without corporate language.

The writing-engine layer enforces the same list on user-facing output via plan § 4.5. Same standard applies to repo prose so the codebase and the product output read coherently.

---

## Pass-based implementation order

The implementation plan in `docs/plan/AntCV_Plan_v2_LockedSources.md` § 7 defines a strict pass order. Open PRs cite the pass and the § ref. Do not skip ahead; later passes assume earlier ones have landed.

| Pass | Target | Scope |
|---|---|---|
| Hotfix | v1.40.x | Six tight changes in plan § 5; ship before any pass starts |
| Pass 1 | v1.40.x | React refactor, four P0 closures, delete `antcv-stability-core-*.js` |
| Pass 2 | v1.50.0 | Visual tokens + package registry + PackagePicker + Custom mode |
| Pass 3 | v1.50.0 | Writing engine registry + proxy 7-step pipeline + WritingStylePicker + Gabriel migration |
| Pass 4 | v1.51 | Remaining commercial styles + per-section line / format controls in editor + Hybrid Balanced |
| Pass 5 | v1.52 | Research Formal academic layout + new academic sections + photo positioning + dark-mode preview |

---

## Test before merge

See `TESTING.md` for the canonical test catalogue. For any PR:

1. Run the relevant test suite — `workers/docx-worker/test/`, `workers/access-relay/tests/`, or the hotfix smoke checklist (15 minutes, in `TESTING.md` § Hotfix smoke).
2. For UI changes: walk the wizard end-to-end with the Anita persona files in `docs/personas/anita/`. Never use real candidate data.
3. For visual changes: confirm § 8.8 independence holds — style swap should not change colours, package swap should not change content.
4. For writing-engine changes: spot-check that banned-word and integrity-rule violations stay under threshold (plan § 8.4: ≤5 violations per 100 outputs per category per cell).

CI runs the `lint` job on every push: repo-layout check + observability-block check across every `wrangler.toml`. PRs cannot land if `lint` is red.

---

## Deployment

PWA auto-deploys to Cloudflare Pages on push to `main` if the change touches `pwa/**`. Workers deploy only via `workflow_dispatch` with explicit `target` + `confirm` input (typo guard) + `mode=dry-run` default. Worker `wrangler.toml` files own KV / D1 / R2 / Durable Object binding IDs — a stale toml dropped on deploy can orphan data, so worker deploys are always manual and dry-run-first.

Full deployment walk-through in `docs/deployment/cloudflare-setup.md`.

---

## Source-document hierarchy

When something is unclear about visual styling, writing behaviour, or wizard logic, consult in this order:

1. `docs/design/Unified_Visual_Package_System.docx` (visual)
2. `docs/design/Writing_System_Engine_Specification.docx` (writing)
3. `docs/plan/AntCV_Plan_v2_LockedSources.md` (current plan + tests)

If code disagrees with a document, the document wins. Raise an issue.
