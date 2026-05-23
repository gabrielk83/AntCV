# AntCV — Correction, Implementation and Testing Plan (v2 — locked sources)
**Supersedes:** AntCV_Plan_v1_40_332_to_v1_50.md + AntCV_Plan_Addendum_1_v1_40_334.md
**Build basis:** v1.40.334-fixed (PWA) + v1.14.12-sidebar-pagebreak-fix (DOCX worker)
**Targets:** v1.40.335-hotfix (this week) → v1.50.0 (Pass 1+2+3) → v1.51 (Pass 4) → v1.52 (Pass 5)

---

## 0. Executive Summary

Two locked source documents now define the product:

1. **"Unified Visual Package System — Final AI + Implementation Specification"** — seven visual packages, semantic token system, Unicode glyph rules, photo controls, ATS rules, print/PDF rules, custom-mode logic.
2. **"Writing System Engine — Complete AI + UX Implementation Specification"** — five execution engines, twelve canonical writing styles, layout/density/semantic/ATS rules per style, custom tone slots.

Visual and writing are explicitly independent layers. A writing style does not change tokens; a package does not change section order.

The work splits into one hotfix release and five implementation passes. Pass 1 closes the four open P0s by replacing imperative DOM patches with React. Passes 2–3 ship the foundation. Passes 4–5 ship the breadth (styles 2–11 and Research Formal academic layout).

---

## 1. Locked Sources

| Domain | Authoritative document | Status |
|---|---|---|
| Visual packages, tokens, glyphs, photo, ATS, print | Unified Visual Package System | Locked |
| Writing engines, styles, layout, density, constraints | Writing System Engine | Locked |
| ~~Color framework / locked palette appendix~~ | ~~Updated Visual Design Packages~~ | **Removed** |

If any implementation question arises that isn't covered by these two docs, the answer is "raise it as an open question" — do not patch from memory.

---

## 2. Visual Token Model

Direct from the Unified Visual doc, no renaming. The doc defines two layers:

### 2.1 Per-package locked colour tokens
`base`, `primary`, `interactive`, `bullet`, `glyph`, plus the two-pair quick alternatives (`alt1.head`, `alt1.sidebar`, `alt2.head`, `alt2.sidebar`) and their dark-mode equivalents.

### 2.2 Global semantic tokens
`main head color`, `main text color`, `main bullet color`, `sidebar bullet color`, `main line color`, `main sub-head color`, `main company color`, `main year color`, `header bg`, `header name color`, `header contact color`, `sidebar bg`, `sidebar head color`, `sidebar text color`, `table header bg`, `table odd bg`, `table even bg`, plus `achievement marker color`, `warning marker color`, `bullet text color`.

### 2.3 Implementation form
Every token is a CSS custom property on `:root`, swapped by `data-package="..."` on `<body>`. DOCX worker reads the same JSON registry.

### 2.4 Hex-literal removal rule
After Pass 2, grep for `#[0-9A-Fa-f]{6}` in component code returns zero hits. All colour values live in `packages/registry.json` or in CSS variable assignments.

---

## 3. Visual Package Registry (verbatim from locked source)

Seven packages, colours and shapes as defined in the Unified Visual doc. Stored as `packages/registry.json`, consumed by both PWA and DOCX worker.

| Package | Base | Primary | Interactive | Bullet | Glyph | Heading font | Body font | Shape | Image size |
|---|---|---|---|---|---|---|---|---|---|
| Copenhagen Modern | `#283556` | `#00746E` | `#0B74DE` | `#00746E` | `#0B74DE` | Segoe UI Bold | Calibri | Circle | 120 px |
| Navy Executive | `#1D2B45` | `#D9A441` | `#6BC5C9` | `#D9A441` | `#D9A441` | Cambria Bold | Calibri | Rounded | 110 px |
| Warm Terracotta | `#8C4A32` | `#5C2E1F` | `#B85E3B` | `#5C2E1F` | `#5C2E1F` | Georgia Bold | Georgia | Rounded | 130 px |
| Nordic Frost | `#1A3A4F` | `#4A8FA8` | `#3E82CC` | `#4A8FA8` | `#4A8FA8` | Trebuchet MS Bold | Calibri | Circle | 125 px |
| Pampas Contemporary | `#1B2D5E` | `#7A3B1E` | `#4B6CB7` | `#7A3B1E` | `#7A3B1E` | Palatino Linotype Bold | Calibri | Rounded-square | 120 px |
| Tokyo Precision | `#2C2C2C` | `#4E5B6E` | `#5C7DA5` | `#4E5B6E` | `#4E5B6E` | Tahoma Bold | Calibri | Square | 90 px |
| Delhi Technical | `#1F3A5F` | `#007C80` | `#00A6A6` | `#007C80` | `#007C80` | Segoe UI Bold | Calibri | Hexagon / Square | 85 px |

Each entry also stores `alt1` and `alt2` head/sidebar pairs and dark-mode variants per the doc table.

### 3.1 Copenhagen Modern vs current AntCV — single migration discrepancy
The current AntCV build uses **Trebuchet MS / Sans Serif Collection** for headings. The locked Copenhagen Modern spec uses **Segoe UI Bold**. Two options at v1.50 cut:

- **Option A (recommended):** Adopt Segoe UI Bold for Copenhagen Modern as the locked spec requires. Offer Trebuchet MS Bold as a saved Custom variant for any user who wants to preserve the previous look. Document in release notes.
- **Option B:** Treat the current Trebuchet look as Copenhagen Modern locked, and treat Segoe UI Bold as `alt1.head` quick alternative. Diverges from source doc.

This is the **one open question** under §11 below.

### 3.2 Default for existing users
Copenhagen Modern is the default. Base / Primary / Heading-main hex values are unchanged from the current hardcoded palette (`#283556` band, `#00746E` heading, `#0B74DE` interactive replaces sidebar teal `#01B7BB`), so almost-byte-identical visual continuity. The heading font is the only delta — see §3.1.

### 3.3 Custom mode triggers (from locked source)
- Quick alternative within package → not Custom
- Off-palette colour → Custom, no warning
- Restricted font → Custom, **warning shown**
- Package-incompatible image setting → Custom, no warning
- Custom styles persist only after explicit save

---

## 4. Writing System Architecture (verbatim from locked source)

### 4.1 Five-engine execution model

| Engine | Controls | Execution order |
|---|---|---|
| Writing System Engine | Tone, register, section naming, content priority, evidence depth, default chips | Runs first |
| Layout + Section Engine | Section order, main/sidebar placement, visibility, section format type | Second |
| Density + Compression Engine | Length target, line limits, compression tolerance, evidence preservation | Third |
| Semantic Constraint Engine | Banned words, banned phrases, role-boundary rules, triggered constraints | Fourth — after drafting, before polishing |
| ATS/Export Engine | ATS-safe flattening, glyph conversion, table simplification | Runs only on ATS export |

Per the source doc §AI Pipeline Step 7: changing writing style must not modify visual design tokens, fonts, image settings, or colour packages.

### 4.2 Canonical writing styles and legacy aliases

| Canonical name | Legacy alias (UI shows during migration) | One-line description |
|---|---|---|
| Nordic Minimal | Scandinavian | Concise, factual, low-noise. Preserves current template order. |
| Achievement-Driven | USA / American | Impact, scope, metrics, ownership. |
| Measured Professional | British | Restrained, credible, precise professional register. |
| Structured Professional | Germanic | Completeness, process, traceability, reliability. |
| Mediterranean Formal | Mediterranean | Warmer formal presentation, professional status. |
| Prestige Structured | Chinese / East-Asian | Institutional fit, hierarchy, alignment. |
| Credential Forward | Indian | Qualifications, technical depth, competitiveness. |
| Precision Formal | Japanese | Consistency, respect, organisational fit. |
| Context Rich | LATAM | Narrative, contextual trust, relational framing. |
| Cold Outreach | Unsolicited / Cold Outreach | Fast relevance, clear ask, often 1 page. |
| Research Formal | Academic / Research | Academic CV, papers, grants, research roles. |
| Hybrid Balanced | Hybrid | Base style + selected chips + custom overrides. |

Legacy labels remain as **aliases in the UI** for one release after rollout, then drop.

### 4.3 Per-style configuration matrix

Each style has a row in `writingSystems/registry.json` with fields: `defaultToneChips`, `sectionOrder`, `mainSidebarPlacement`, `sectionFormatDefaults`, `compressionTolerance`, `allowedLength`, `lineDensity`, `preserveCompressPriority`, `toneRegisterRule`, `contentRule`, `avoidRule`, `primaryConstraint`, `constraintAvoid`, `constraintPrefer`, `atsBehavior`, `exportInstruction`, `implementationNotes`.

The full matrix is copied verbatim from the source doc §3, §4, §5, §6, §7, §8, §9, §10. The registry file is the only place these values live.

### 4.4 Section format types (per source doc §13)

Nine format selectors apply to each section independently: **Default, Paragraph, Bullets, Unicode bullets, Hybrid 1, Hybrid 2, Hybrid 3, Table/Grid, Structured Grid**. The current build already wires this through the wizard Step-10 overlay (`antcv-wizard-section-format-step10.js`); v1.50 promotes this from wizard-only to a per-section control accessible from the editor.

Per-style default mapping (source doc §5) is stored in the writing-system registry as `sectionFormatDefaults`.

### 4.5 Banned words, banned phrases, semantic constraints

The source doc §15 specifies:

**Banned words (shared base):**
```
spearhead, ensure, foster, streamline, strengthen, empower, leverage,
drive change, deliver value, enable, robust, comprehensive, cutting-edge,
state-of-the-art, world-class, leading, impactful, rooted, grounded,
committed, passionate, holistic, cross-functional, collaborative, journey,
dynamic, proactive, results-driven, strategic, agile
```

**Banned phrases (shared base):**
```
key role, pivotal role, proven track record, strong communicator,
strategic mindset, mission-driven, I am passionate about,
I look forward to hearing from you, responsible for
```

**Differentiation across styles is via the Semantic Constraint Engine (§9 of source), not via diverging banned-word lists.** Each style has its own `primaryConstraint`, `constraintAvoid`, `constraintPrefer` triple, plus optional trigger-based rules (Trigger + Avoid + Prefer + Reason; dormant until trigger matches).

#### 4.5.1 User-extended bans
UI exposes "Banned words" and "Banned phrases" lists where the user can add to the shared base. Stored under `personalInfo.writingPrefs.extraBannedWords` and `extraBannedPhrases`.

#### 4.5.2 Migration for Gabriel's current list
Gabriel's project-memory list contains several items not in the source doc base (multi-faceted, tværgående, tværfunktionel, central, end-to-end, strong leader, client-focused, customer-centric, all the "My expertise lies in" / "At the heart of my work" / etc.). On v1.50 first launch, these items are silently added to Gabriel's `extraBannedWords` and `extraBannedPhrases` so existing behaviour is preserved without contaminating the shared base.

### 4.6 UI surfaces per source doc §13

| UI element | Location | Backing data |
|---|---|---|
| Tone dropdown | Settings → Personal → Writing style | `personalInfo.writingPrefs.style` (canonical name) |
| Tone chips | Settings → Personal → Writing style | `personalInfo.writingPrefs.chips` |
| Banned words | Settings → Personal → Writing style | `personalInfo.writingPrefs.extraBannedWords` |
| Banned phrases | Settings → Personal → Writing style | `personalInfo.writingPrefs.extraBannedPhrases` |
| Semantic constraints | Settings → Personal → Writing style → Advanced | `personalInfo.writingPrefs.extraConstraints` |
| Target CV length | Settings → Personal → Layout | `personalInfo.layoutPrefs.targetPages` (1, 1.5, 2, 2.5, 3, 4, 5) |
| Line sliders | Editor → per section | `personalInfo.layoutPrefs.lineLimits.<section>` |
| Section format selector | Editor → per section | `personalInfo.layoutPrefs.sectionFormats.<section>` |
| Custom tone slots | Settings → Personal → Writing style → Slots | `personalInfo.writingPrefs.savedSlots[]` |

### 4.7 Execution pipeline (source doc §16)

The proxy worker runs every section through this sequence:

1. Identify target use case (commercial / academic / cold outreach / ATS / hybrid)
2. Apply writing style + default chips
3. Apply Layout + Section Engine (reorder, place, hide, expand)
4. Apply Density + Compression Engine (target length + line limits)
5. Apply Semantic Constraint Engine (banned words/phrases, triggers, metric integrity, role-boundary integrity)
6. Apply ATS/Export Engine (only on ATS-safe export)
7. Validate visual tokens unchanged

Step 5 is where the post-draft retry loop sits — if the output contains banned words or violates metric integrity, retry up to two times with an injected fix instruction; third draft returns with `flagged: true`.

---

## 5. v1.40.335 Hotfix Bundle (carried from previous Addendum 1)

Ship before any pass starts. Six tight changes, all on existing files, no new modules.

| # | Change | File | Risk |
|---|---|---|---|
| 1 | Language card defaults to collapsed (`v===null?false:...`) | `antcv-stability-core-334.js` line 111 | None |
| 2 | Skip `raiseSettings` when non-settings modal is open | `antcv-stability-core-334.js` lines 211, 277 | Low |
| 3 | `forceRoute` TTL: 10 s → 2 s | `antcv-stability-core-334.js` line 229 | Low |
| 4 | Importer modal: explicit `z-index: 2147483300; position: fixed` | `antcv-data-importer.js` modal CSS | None |
| 5 | Block `wizardCompleted` writes during post-delete TTL | `antcv-onboarding.js` near line 1497 | Medium — targeted test required |
| 6 | AI notice z-index `2147483300` on mobile; lower overlay-detect threshold to 0.5 on viewport ≤ 760 | `antcv-ai-notice-stability.js` line 231 + new explicit z | Low after repro |

### 5.1 Smoke test (≈15 min)
1. Sign out → delete user → sign in. Wizard does not flash and close. Pass: wizard stays open or Set screen loads cleanly.
2. Settings → Personal → Languages card is collapsed by default. Toggle holds across reload.
3. Wizard steps 1 → 2 → 3 → step-3-to-4 AI notice appears on mobile portrait and landscape.
4. Settings → Import profile: JSON, PDF, DOCX, PNG all import on iOS Safari and Android Chrome.
5. Re-verify already-shipped fixes: top-bar languages, JD Analysis FAB on desktop, Open in Settings from Application history, no duplicate preview toolbar.

If steps 1–4 fail: do not ship, iterate on that fix only.

---

## 6. Open P0 Corrections — root-cause map (carried, condensed)

All four trace to imperative DOM patching in `antcv-stability-core-334.js` and adjacent sidecars. Pass 1 replaces them with React. Hotfix above buys time.

| P0 | Fix |
|---|---|
| Language selector reinjection | Pure React: `{subTab==='personal' && <LanguageCard />}`. Remove MutationObserver. |
| Preview toolbar architecture | Dedicated `<PreviewToolbar />` mounted once. No post-render injection. |
| Application history routing | `useModalNav()` hook owns `{openModal, activeTab, targetSubTab}`. Replaces `routeSettings`/`forceRoute` pair. |
| Showcase contamination | Hard isolation on entry: `clearHistoricalContext(); disableReuse(); disableMerge();`. Mode flag on every merge call. |

Additional cleanups bundled: `wizardState` triple-state (`new`/`skipped`/`completed`) persisted to cloud; split kernel validator into `validateKernel()` and `validateShowcase()` with different thresholds; centralised `scrubPlaceholders()`.

---

## 7. Implementation Passes

### Pass 1 — UI stability + React refactor (closes all four P0s, removes `antcv-stability-core-334.js`)
1. `<LanguageCard />` inside Personal tab, default collapsed.
2. `<PreviewToolbar />` mounted once at top of `<PreviewPane />`.
3. `useModalNav()` hook + `<SettingsRouter />` component. Migrates `routeSettings`/`forceRoute` logic from stability-core.
4. `wizardState` triple-state, persisted to cloud, server-side reset on delete-user.
5. Fix `topbarOrder` ReferenceError (parked, ~line 2001).
6. Delete `antcv-stability-core-334.js` from `index.html` once 1–3 verified.

**Exit:** Zero `MutationObserver` on `document.documentElement`. Zero `appendChild` outside allowed mount points. Zero `z-index: !important` over `--z-overlay-max`. All P0 acceptance tests pass.

### Pass 2 — Visual tokens + package registry (v1.50.0)
7. Audit every hex literal in PWA. Replace with `var(--token-name)`. Tracked CSV.
8. Audit every hex literal in DOCX worker. Replace with token reads from `packages/registry.json`.
9. Build `packages/registry.json` per §3.
10. `<PackagePicker />` in Settings → Personal → Appearance (Package / Quick Alternative / Custom).
11. Custom mode logic per §3.3.
12. Decide §3.1 (Copenhagen Modern heading font). Implement chosen path.

**Exit:** Grep for `#[0-9A-Fa-f]{6}` returns 0 hits in component files. Switching package updates every visible colour in one render. DOCX export per package validates clean.

### Pass 3 — Writing engine foundation (v1.50.0)
13. Build `writingSystems/registry.json` from source doc §3 + §4 + §5 + §6 + §7 + §8 + §9 + §10. All 12 styles loaded; only 5 active initially.
14. Proxy worker accepts `writingStyle`, `toneChips`, `extraBannedWords`, `extraBannedPhrases`, `extraConstraints` per request.
15. Proxy implements 7-step pipeline §4.7. Banned-word post-filter with two retries; third draft returns `flagged: true`.
16. PWA writing-system picker in Settings → Personal → Writing style.
17. Gabriel migration: pre-populate `extraBannedWords`/`extraBannedPhrases` with his existing items not in the source-doc base.
18. Showcase hard isolation. Soften kernel validator in showcase.
19. Centralised `scrubPlaceholders()`.

**Active styles at v1.50.0 cut:** Nordic Minimal, Achievement-Driven, Measured Professional, Context Rich, Cold Outreach. Other styles defined in registry but UI flagged "Coming in v1.51".

**Exit:** Switching writing style regenerates a section with the new style. Banned-word post-filter holds ≤5 violations per 100 outputs per category per style. Showcase: 20/20 clean cold-start runs.

### Pass 4 — Remaining commercial styles (v1.51)
20. Activate Structured Professional, Credential Forward, Precision Formal, Prestige Structured, Mediterranean Formal.
21. Per-section line slider + section format selector promoted from wizard-only to editor.
22. Custom tone slots (save / load / clear / rename) persisted under `personalInfo.writingPrefs.savedSlots[]`.
23. Hybrid Balanced — base + chips + custom semantic constraints. Chip conflict detection with warning.

**Exit:** All 11 commercial styles produce coherent CVs that pass §8.4 banned-word + semantic-constraint thresholds. Saved slots survive cloud sync round-trip.

### Pass 5 — Research Formal + academic layout + advanced photo controls (v1.52)
24. Research Formal academic layout (Research Summary > Education > Research Experience > Publications > Selected Research Outcomes > Teaching/Supervision > Grants/Fellowships > Conferences/Talks > Technical Methods > Industry Experience > Service > Work Style).
25. 2–5 page academic length tolerance.
26. New first-class sections: Research Experience, Publications (main), Grants/Fellowships, Teaching/Supervision, Conferences/Talks, Professional Service.
27. Photo positioning beyond Sidebar top (Sidebar bottom, Header L/R, Main L/R, Header-Sidebar Bridge, Hidden).
28. Photo shape variants beyond Circle (Rounded, Square, Hexagon) with package-defined defaults.
29. Dark-mode tokens enabled in preview only (no DOCX dark export in v1.52).

**Exit:** Research Formal renders correctly in all seven packages. PhD/postdoc test CV (2.5–4 pages) exports cleanly. Photo position swap updates layout without breaking pagination.

---

## 8. Testing Plan

### 8.1 Test pyramid

| Level | Coverage | Tooling |
|---|---|---|
| Unit | Token resolution, package switch, banned-word detector, placeholder scrubber, wizard state machine, semantic-constraint trigger matching | Vitest |
| Integration | Proxy returns valid section after style swap; DOCX worker generates valid OOXML per package | Vitest + xmllint |
| Visual regression | Screenshot diff of each section × each package, light + dark | Playwright + pixelmatch |
| DOCX regression | Generated DOCX validated by strict-OOXML-validator (zero errors, zero warnings) | Existing OOXML validator |
| End-to-end | Wizard → kernel → tailor JD → export, per style | Playwright |
| Mobile smoke | Cold start, hard refresh, language toggle, package switch, style switch, import profile | Manual checklist, three viewports |

### 8.2 Regression matrices

**Visual:** 7 packages × 1 sample CV × 3 breakpoints (375, 768, 1440) = **21 baseline screenshots** for v1.50.0. Adding dark mode in Pass 5 doubles to 42.

**DOCX:** 7 packages × 5 active styles at v1.50 × 2 sample CVs (technical + transformation) × EN + DA = **140 DOCX files** per release. Each validates against:
1. OOXML strict validator (zero errors, zero warnings)
2. LibreOffice headless re-open (success)
3. Page count check (per style's `allowedLength`)
4. Sidebar continuation when content overflows

At v1.51 cut, matrix grows to 7 × 10 × 2 × 2 = 280 files. At v1.52, 7 × 12 × 3 × 2 = 504 files (third CV is academic).

### 8.3 Showcase isolation test (20 cold-start runs)
1. Clear all local data → boot PWA → sign in → restore from cloud (kernel populated with Innoviz, Sirin Labs, Meprolight, TAU, IDF, Kanzen)
2. Enter Showcase → generate showcase CV
3. Grep generated output for: Innoviz, Sirin, Meprolight, Tel Aviv University, Therma, DTU, Kanzen, Maersk, LEGO, Danfoss

**Pass:** Zero hits across all 20 runs.

### 8.4 Writing-style violation test

For each active style × each section type (Profile, Selected Outcomes, Experience bullet, Cover Letter Who I Am):
- 50 generations per cell
- Count banned-word violations (shared base)
- Count banned-phrase violations
- Count semantic-constraint violations (per-style)
- Count metric-integrity violations (invented numbers)
- Count role-boundary violations (ownership inflation)

**Pass:** ≤5 violations per 100 outputs per category per cell. Above threshold → prompt iteration before release.

### 8.5 Custom mode test (visual side)

| Scenario | Expected |
|---|---|
| Quick alternative within package | No Custom flag, no warning |
| Off-palette hex | Custom flag, no warning |
| Restricted font | Custom flag, **warning shown** |
| Incompatible image setting | Custom flag, no warning |
| Refresh without save | All Custom changes discarded |

### 8.6 ATS-mode test

For each package + each active style, export ATS-safe and verify:
- Photo absent
- Single column layout
- Calibri only
- Unicode glyphs replaced with text equivalents (☎ → "Phone:", ✉ → "Email:", 🔗 → "Link:", ⌂ → "Location:")
- Tables flattened where parser requires
- Section names match style's `atsBehavior` rule (some styles preserve original headings, some require standard headings)

Run output through Workday CV import + LinkedIn Easy Apply parser.

### 8.7 Modal stacking test (new, post-Pass 1)

For each modal (Settings, Application History, Importer, AI Notice, Wizard slide, Package Picker):
- Opens above whatever triggered it
- Receives all clicks within its bounds
- File input opens native picker on mobile and completes
- Closing returns focus to trigger element
- No `z-index !important` larger than `--z-overlay-max` (canonical value: `1000`)

### 8.8 Independence test (visual ⨯ writing)

Switch writing style across all 12 with package fixed → screenshot diff should show **content reordering only**, no colour/font changes. Switch package across all 7 with style fixed → screenshot diff should show **colour/font changes only**, no content reordering. Any cross-contamination is a fail.

### 8.9 Release gate checklist (v1.50.0)

- [ ] All 4 P0 acceptance tests pass
- [ ] `antcv-stability-core-*.js` removed from `index.html`
- [ ] Grep for `MutationObserver` on `document.documentElement` returns 0
- [ ] Grep for `z-index: 21474` returns 0
- [ ] Grep for `#[0-9A-Fa-f]{6}` outside registry returns 0
- [ ] Visual regression: 21/21 baselines reviewed
- [ ] DOCX regression: 140/140 files validate clean
- [ ] Showcase: 20/20 clean cold-start runs
- [ ] §8.4 writing-style violations under threshold
- [ ] §8.8 visual ⨯ writing independence holds
- [ ] Modal stacking test (§8.7) passes for all 6 modals on mobile + desktop
- [ ] Custom mode behaves per §8.5
- [ ] PWA zip structure correct (files at zip root)
- [ ] All `wrangler.toml` include `[observability.logs]` with `enabled = true` and `invocation_logs = true` after `compatibility_date`
- [ ] Service worker bumped, Hard Refresh button clears cache

---

## 9. Worker-Side Changes

### 9.1 DOCX worker (`antcv-docx-worker`)
- Bundle `packages/registry.json` and `writingSystems/registry.json` (read-only).
- Request schema additions: `package` (default `copenhagen-modern`), `writingStyle` (default `nordic-minimal`), `ats` (boolean, default false), `targetPages`, `sectionFormats`.
- ATS mode: suppress photo, flatten tables per style's `atsBehavior`, replace glyphs with text labels, force Calibri.
- Sidebar pagination is colour-agnostic if it reads tokens correctly. Regression-test under every package.

### 9.2 Proxy worker (`antcv-proxy`)
- Request payload adds `writingStyle`, `toneChips[]`, `extraBannedWords[]`, `extraBannedPhrases[]`, `extraConstraints[]`, `targetPages`, `sectionFormat`.
- Server-side execution: 7-step pipeline §4.7.
- Banned-word post-filter with two retries; third returns `flagged: true`.
- Log writing-style selection and per-category violation counts to analytics KV.

### 9.3 C2PA worker (`antcv-c2pa-worker`)
- Watermark colour tracks the active package's `base` token via the request payload.
- No structural change.

### 9.4 Access relay (`antcv-access-relay`)
- No functional change. Confirm BYOK demo override still works.

---

## 10. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pass 1 refactor breaks page-break system (marked stable in status doc) | Medium | High | Full DOCX regression at end of Pass 1 before Pass 2 starts. |
| Hex-literal audit misses cases inside template strings, SVG `<defs>`, computed styles | Medium | Medium | Two-pass grep: `#[0-9A-Fa-f]{6}` and `rgb\(`. Visual regression catches what grep misses. |
| `stability-core-334` z-index ramp (`2147483200`) collides with modal portals during transition | High | Medium | Bundled into Pass 1; delete entirely once `useModalNav()` ships. |
| Adopting Segoe UI Bold for Copenhagen Modern (§3.1 Option A) regresses existing visual identity | Medium | Medium | Ship Trebuchet MS Bold as a saved Custom variant with one-click apply. Document. |
| 12 writing styles is wide — semantic constraint quality varies by style | High | Medium | Phase rollout: 5 styles at v1.50, 5 more at v1.51, Research Formal at v1.52. Per-style §8.4 gate before activation. |
| Research Formal academic layout needs new sections current data model doesn't have | High | High | Pass 5 scope. Data model extension lives in Pass 5 SOW; do not block v1.50/v1.51 on it. |
| Custom tone slots could store inconsistent state if user edits parts independently | Medium | Low | Slot saves the **full** writingPrefs object atomically; no partial-update path. |
| Banned-word migration silently changes Gabriel's behaviour | Low | Low | Migration only adds his memory list as `extraBannedWords/Phrases`; nothing is removed. Pre-migration list and post-migration list both viewable in Settings → Personal → Writing style. |
| Hardcoded hallucination-prone prompt ~line 4612 not addressed | Medium | Medium | Replaced by proxy-side pipeline in Pass 3. |

---

## 11. Open Question

Only one decision is still needed before Pass 2 starts:

**Copenhagen Modern heading font.** Source doc locks Segoe UI Bold. Current AntCV uses Trebuchet MS / Sans Serif Collection.
- **Option A (recommended):** Adopt Segoe UI Bold per source doc; ship Trebuchet MS Bold as a saved Custom variant for one-click reversion.
- **Option B:** Treat current Trebuchet look as Copenhagen Modern locked; promote Segoe UI Bold to `alt1.head` quick alternative. Diverges from source doc.

The previous open questions (Nordic Executive accent, Pampas split, existing-user migration) are resolved by removing the conflicting color framework doc — Navy Executive uses gold `#D9A441`, Pampas Contemporary is single, existing users migrate to Copenhagen Modern silently.

---

## Appendix A — File-level change inventory

| File / area | Change | Pass |
|---|---|---|
| `antcv-stability-core-334.js` lines 111, 211, 229, 277 | Hotfix changes 1–3 (§5) | Hotfix |
| `antcv-data-importer.js` modal CSS | Hotfix change 4 (§5) | Hotfix |
| `antcv-onboarding.js` ~line 1497 | Hotfix change 5 (§5) | Hotfix |
| `antcv-ai-notice-stability.js` line 231 + z | Hotfix change 6 (§5) | Hotfix |
| `app.js` language-selector mount | Replace with React `<LanguageCard />` | 1 |
| `app.js` preview-toolbar | Extract `<PreviewToolbar />` | 1 |
| `app.js` modal nav | `useModalNav()` hook | 1 |
| `app.js` wizard | `wizardState` triple-state | 1 |
| `app.js` ~line 2001 | Fix `topbarOrder` ReferenceError | 1 |
| `app.js` ~line 4612 | Replace hallucination-prone prompt; moves to proxy in Pass 3 | 3 |
| `app.js` colour usage (all) | Replace hex literals with CSS variables | 2 |
| `packages/registry.json` | New file | 2 |
| `writingSystems/registry.json` | New file | 3 |
| `<PackagePicker />` component | New | 2 |
| `<WritingStylePicker />` component | New | 3 |
| `<SectionFormatPicker />` component | Promoted from wizard-only to editor | 4 |
| `<CustomToneSlots />` component | New | 4 |
| Showcase entry path | Hard isolation calls | 3 |
| Proxy worker | `writingStyle` field + 7-step pipeline + post-filter | 3 |
| DOCX worker | Token-driven palette + `package`/`writingStyle`/`ats` request fields | 2/3 |
| C2PA worker | Watermark tracks `base` token | 2 |
| Academic layout + new sections | Research Formal data model + render | 5 |
| Photo positioning | 7 positions beyond Sidebar top | 5 |
| `antcv-stability-core-334.js` (whole file) | Delete from `index.html` after Pass 1 | 1 |

---

## Appendix B — Out of scope for v1.50

- DOCX dark-mode export (preview-only in Pass 5).
- Manual photo cropping (auto-centre only).
- Multi-user real-time collaboration.
- LLM provider additions beyond the four already wired (Claude, OpenAI, Mistral, Gemini).
- Spanish + Mandarin in the top language bar (parallel roadmap track, post v1.40.190).
- Trigger-based extra-constraint UI editor (constraints are author-curated at v1.50; user-editable triggers in v1.51 if Hybrid Balanced uptake justifies it).

---

## Appendix C — Legacy ↔ canonical name map (for migration UI and release notes)

| Legacy label shown today | New canonical | UI alias retained until |
|---|---|---|
| Scandinavian | Nordic Minimal | v1.51 |
| USA / American | Achievement-Driven | v1.51 |
| British | Measured Professional | v1.51 |
| Germanic | Structured Professional | v1.51 |
| Mediterranean | Mediterranean Formal | v1.51 |
| Chinese / East-Asian | Prestige Structured | v1.51 |
| Indian | Credential Forward | v1.51 |
| Japanese | Precision Formal | v1.51 |
| LATAM | Context Rich | v1.51 |
| Unsolicited / Cold Outreach | Cold Outreach | v1.51 |
| Academic / Research | Research Formal | v1.52 |
| Hybrid | Hybrid Balanced | v1.51 |

---

*End of plan v2. Single open question in §11 to unblock Pass 2.*
