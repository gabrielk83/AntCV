# Pass 3 — Writing engine foundation — status report

**Plan citation:** AntCV_Plan_v2_LockedSources.md §4 (writing system architecture, all subsections) + §7 Pass 3 + §9 (worker-side changes).
**Source documents:** `docs/design/Writing_System_Engine_Specification.docx`, `skills/antcv-writer/references/style-matrix.md`, `skills/antcv-writer/references/language-output.md`, `skills/antcv-writer/references/cascade-rules.md`.
**Branch:** `feat/v1.50.0-pass3-writing-engine` (stacked on Pass 2; depends on Pass 1 + Pass 2).
**Build version:** `1.50.0-pass3`.

## Scope shipped

| # | Plan item | Where it landed |
|---|---|---|
| 3a | `writingSystems/registry.json` — 12 canonical styles, 5 marked `active` for v1.50.0 cut | [`writingSystems/registry.json`](../../writingSystems/registry.json) + schema. Includes density tiers, tone-chip catalogue with `compatibleWith` rules, conflicting-chip pairs, per-language shared banned bases (en/da/es/zh), integrity rules, retry policy. |
| 3c | `<WritingStylePicker />` in Settings → Personal → Writing style | [`src/islands/WritingStylePicker/WritingStylePicker.tsx`](../../src/islands/WritingStylePicker/WritingStylePicker.tsx) + [mount](../../src/islands/WritingStylePicker/mount.tsx). Tone dropdown (5 active, 7 disabled with "Coming v1.51/v1.52" badge + legacy alias shown), tone-chip multi-select with compatibility filter + conflict flagging, banned-words/phrases lang-partitioned editor with EN/DA/ES/ZH switcher, target-CV-length dropdown, Advanced disclosure surfacing primary constraint / prefer / avoid. |
| 3d | Target CV length dropdown values 1, 1.5, 2, 2.5, 3, 4, 5 | Inside `WritingStylePicker`. Clamped to the active style's `allowedLength` band per plan §4.6 — Research Formal and Context Rich can exceed 3 pages; others can't. |
| 3f | Style cascade (subset) | `src/lib/writing-prefs.ts` → `setWritingStyleWithCascade()` re-seeds `chips`, `sectionFormats`, and `targetPages` from the new style row, unless `overrides[field] === true`. Worker-side `style.cascade` event emission is part of the proxy-worker wiring (deferred). |
| 3g | Glyph rules + ATS labels | [`src/lib/glyph-rules.ts`](../../src/lib/glyph-rules.ts) — shared between PWA and the proxy worker. Allowed bullets `• ◦ ▪ ✓ → ▲`, contact glyphs `☎ ✉ 🔗 ★ ⌂`, ATS map (`☎→Phone:`, `✉→Email:`, `🔗→Link:`, `⌂→Location:`, `★→Highlight:`), per-style density rules `STYLE_GLYPH_DENSITY`, `applyAtsGlyphConversion()`, native-emoji detector. Worker has its own copy in `writing-style-engine.js`. |
| 3h | Gabriel migration | [`src/lib/gabriel-migration.ts`](../../src/lib/gabriel-migration.ts). Runs on bundle boot; idempotent. Sets `writingPrefs.style = "nordic-minimal"` if unset, partitions Gabriel's existing items into the `en` and `da` buckets per plan §4.5.2, stamps `migrationVersion = "v1.50"`. De-duplicates case-insensitively on re-run. |
| 3b | Proxy worker request schema + SCE retry loop | [`workers/proxy/src/writing-style-engine.js`](../../workers/proxy/src/writing-style-engine.js). Self-contained module exporting `parseWritingStyleRequest`, `buildStyleSystemPreamble`, `evaluateSce`, `runWithSceRetry` (≤2 retries, third draft returns `flagged:true`), `applyAtsGlyphConversion`, `logWritingEngineEvent`. Smoke-tested via `node -e` import — Danish lang-partitioned bans hit correctly, target-page clamping works, legacy style alias resolution works. **Not wired into `index.js` yet** — wiring instructions live in `workers/proxy/src/writing-style-engine.test.notes.md`. |

## Storage shape introduced

`personalInfo.writingPrefs` (plan §4.5.3):
```json
{
  "style": "nordic-minimal",
  "chips": ["calm", "factual"],
  "extraBannedWords":   { "en": [...], "da": [...], "es": [], "zh": [] },
  "extraBannedPhrases": { "en": [...], "da": [...], "es": [], "zh": [] },
  "extraConstraints": [],
  "overrides": { "chips": true|false, "sectionFormats": true|false, "targetPages": true|false },
  "savedSlots": []
}
```

`personalInfo.layoutPrefs`:
```json
{ "targetPages": 2, "lineLimits": {}, "sectionFormats": { ... } }
```

`personalInfo.migrationVersion`: `"v1.50"` after the migration has run.

`antcv:editor-language`: `"en" | "da" | "es" | "zh"` — sessionStorage-style hint for the banned-list editor.

## Files added / changed

| Path | Status | Note |
|---|---|---|
| `writingSystems/registry.json` | new | 12 styles, density tiers, chip catalogue, conflicting chips, per-language shared banned bases, integrity rules, matching modes |
| `writingSystems/registry.schema.json` | new | JSONSchema |
| `src/lib/writing-systems.ts` | new | Registry loader + helpers + legacy-alias map + chip compatibility / conflict detection |
| `src/lib/writing-prefs.ts` | new | Read/write `personalInfo.writingPrefs` and `.layoutPrefs`; lang-partitioned bucket helpers; `setWritingStyleWithCascade()` |
| `src/lib/gabriel-migration.ts` | new | Idempotent §4.5.2 migration + `window.AntcvGabrielMigration` debug API |
| `src/lib/glyph-rules.ts` | new | Allowed bullets/glyphs + ATS labels + per-style density + native-emoji detection |
| `src/islands/WritingStylePicker/WritingStylePicker.tsx` | new | Settings → Personal → Writing style UI |
| `src/islands/WritingStylePicker/mount.tsx` | new | Mount above PackagePicker |
| `src/main.tsx` | modified | Runs migration on boot; mounts WritingStylePicker; exposes `window.AntcvGabrielMigration` |
| `workers/proxy/src/writing-style-engine.js` | new | Proxy-side pipeline: schema parser, preamble builder, SCE evaluator, retry-loop runner, ATS conversion, analytics logger |
| `workers/proxy/src/writing-style-engine.test.notes.md` | new | Wiring instructions for `index.js` + test cases |
| `pwa/sw.js` | modified | CACHE → `antcv-1.50.0-pass3` |
| `pwa/antcv-version-override.js` | modified | TARGET_VERSION → `1.50.0-pass3`; `1.50.0-pass2` added to STALE_VERSIONS |
| `pwa/index.html` | modified | `?v=` bumps |
| `docs/qa/pass3-status-report.md` | new | This file |

## How to verify in a browser

After deploy:

1. **Migration ran once.** First load: open DevTools console. `window.AntcvGabrielMigration.currentVersion()` returns `"v1.50"`. `window.AntcvGabrielMigration.run()` runs the migration again — `result.bannedWordsAdded === 0`, `result.bannedPhrasesAdded === 0` (idempotent).
2. **Default style.** Settings → Personal → Writing style — dropdown shows `Nordic Minimal — was Scandinavian` as the active option. The 7 deferred styles render disabled with their "Coming v1.51/v1.52" badge.
3. **Cascade.** Switch to `Achievement-Driven`. The chip selection re-seeds to `outcome-led / quantified / scope-anchored`. Layout's `targetPages` clamps to the style's `allowedLength` band.
4. **Lang-partitioned bans.** In the Banned words editor, switch to `DA`. Add `tværgående`. Switch to `EN` — list is empty (en bucket unchanged). Confirm in DevTools: `JSON.parse(localStorage.personalInfo).writingPrefs.extraBannedWords` is the object shape.
5. **Tone-chip conflict flagging.** Activate both `restrained` and `narrative` chips (need an active style that's compatible with both — e.g. neither default-compatible without manual selection). The conflict pair surfaces a `⚠` icon + the warning banner.
6. **Worker engine smoke test.** From the repo root: `node -e "import('./workers/proxy/src/writing-style-engine.js').then(m => { const r = m.parseWritingStyleRequest({writingStyle:'Scandinavian',targetPages:9,extraBannedWords:{da:['tværgående']},target_language:'da'}); console.log(r); })"` — confirms style id normalises, targetPages clamps to 3, Danish bucket survives the round-trip.

## Pass 3 exit criteria — current status

| Plan §7 Pass 3 Exit | Status |
|---|---|
| Switching writing style regenerates a section with the new style (visible content change) | **Not met** — requires the proxy worker engine wired into the section-generation endpoint. Code is shipped + smoke-tested; wiring is documented in `writing-style-engine.test.notes.md`. v1.50.1 follow-up. |
| Switching package does **not** change content (§8.8 independence test) | **Holds by construction** — Pass 2's PackagePicker writes only to `personalInfo.stylePackage`; Pass 3's WritingStylePicker writes only to `personalInfo.writingPrefs`. No cross-storage. Browser test pending. |
| Banned-word post-filter holds ≤5 violations per 100 outputs per category per style (§8.4) | **Not measurable yet** — depends on the worker engine being wired in. Test harness referenced in `workers/proxy/src/writing-style-engine.test.notes.md`. |
| Showcase: 20/20 clean cold-start runs (§8.3) | **Not done** — Pass 3i (showcase hard isolation) deferred. |
| DOCX regression: 140 files validate clean | **Pending** — depends on DOCX worker palette + writing-style wiring; deferred to v1.50.1. |

## Deferred — items needed for full §7 Pass 3 closure

- **3b wiring.** The `writing-style-engine.js` module is built and smoke-tested. Three integration points in `workers/proxy/src/index.js` are documented in `workers/proxy/src/writing-style-engine.test.notes.md`. Requires worker redeploy via `wrangler deploy` once integrated.
- **3e — per-section line sliders + section format selector promoted from wizard.** Requires touching `pwa/antcv-wizard-section-format-step10.js` and the editor inside `pwa/app.js`. Deferred to Pass 4 per plan §7 step 21.
- **3i — Showcase hard isolation** + split `validateKernel()` / `validateShowcase()`. Requires deep `app.js` edits.
- **3j — Centralised `scrubPlaceholders()`** + delete hardcoded prompt at `app.js` ~line 4612 (since the file is minified, location is by-content). Requires worker pipeline being live first so the centralised path has a destination.
- **Custom tone slots save/load/clear/rename** (Pass 4 per plan §7 step 22).
- **Hybrid Balanced + chip-conflict resolution UI** (currently flags but does not auto-swap). Pass 4 step 23.
- **Research Formal academic layout + new sections** (Pass 5 / v1.52 per plan §7).
- **`writingSystems/registry.json` duplication in the worker.** The worker has its own const tables for the style metadata + per-language banned bases. Keep-in-sync rule documented in the test-notes file. A future ticket can centralise via wrangler bundler.

## Follow-up tickets

- [ ] Wire `writing-style-engine.js` into `workers/proxy/src/index.js` per the three integration points; redeploy.
- [ ] Run the §8.4 violation test (50 generations per active-style × section-type cell × per-category) once the worker is live.
- [ ] Pass 4 (v1.51) — activate remaining 5 commercial styles; promote per-section line sliders + format selector to the editor; ship Custom tone slots; Hybrid Balanced chip-conflict resolution.
- [ ] Pass 5 (v1.52) — Research Formal layout, new sections, photo positions, dark-mode preview.

## Recap — three PRs stacked for v1.50.0

| Branch | Pass | Adds |
|---|---|---|
| `feat/v1.50.0-writing-engine-and-packages` | Pass 1 | Vite + React-islands; LanguageCard / PreviewToolbar / SettingsRouter / wizardState |
| `feat/v1.50.0-pass2-visual-tokens` | Pass 2 | `packages/registry.json` + `registry.css` + `<PackagePicker />` + custom-mode trigger API |
| `feat/v1.50.0-pass3-writing-engine` | **Pass 3 (this PR)** | `writingSystems/registry.json` + `<WritingStylePicker />` + Gabriel migration + glyph rules + proxy-worker SCE retry-loop module |
