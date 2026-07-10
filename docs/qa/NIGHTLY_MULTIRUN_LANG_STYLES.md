# NIGHTLY MULTI-RUN WORK ORDER — full-language generation + 12-style templates + personality-fit prompts

Owner brief (2026-07-02): "expand the full generation targets to all language layer
languages. Also implement templates of CV and CL for all writing styles (which are
baked into every kernel and also control section order) and include prompt
instructions that fit each inject to the user personality. Check nordic minimal is a
stable baseline even without the gabriel data, and handle research as an edge case.
The goal: a user who chooses these languages and writing style and personality in
settings/wizard gets the full support, so make sure the app servers are ready to
deliver."

This is a MULTI-RUN order. Each nightly run: (1) SYNC FIRST, (2) read the STATUS
block below, (3) do the next unchecked phase, (4) update STATUS + append a run log
line, (5) commit/push. Do not skip phases; do not start a phase you cannot verify.

## SHIFT PROTOCOL — claim before you work (parallel-session safety)

Multiple sessions push to `origin/main`. Before editing, reserve your lane so you never
collide on a version number or a shared working tree (full detail: `docs/qa/NIGHT_SHIFT.md`):

1. **SYNC** — `git fetch origin && git pull --rebase origin main`.
2. **CLAIM** — `node scripts/shift.mjs claim --task "<what you're doing>"` reserves a
   version-number range for you and records it in the ledger; it prints your range + a
   `git worktree add` line.
3. **WORKTREE** — run that `git worktree add ../AntCV-<name> -b <name>` and work THERE, not
   in the shared clone (kills the "another session's uncommitted app.js under my commits" bug).
4. Use only version numbers **inside your claimed range**; `node scripts/shift.mjs beat` to heartbeat.
5. **RELEASE** — `node scripts/shift.mjs release` when done. `status` lists active claims; `reap` clears dead ones.

## STATUS (update every run)

- [~] R1 Language register registry + client wiring (en/da/es/zh -> 23) — PARTIAL: `__langGenLock`
      directive covers zh/es/he/am/fr/de (+generic) in targeted+unsolicited prompts (1.51.237/250/252);
      translation round-trip now covers subtitle + CL slogan (1.51.248). NOT done: the full 23-language
      `__ANTCV_LANG_REGISTRY` sidecar + register/voice/name-map lookups this phase specifies.
- [~] R2 Export path: filename suffixes; RTL + CJK in docx-worker — SUBSTANTIALLY SHIPPED: CJK font
      (zh Microsoft YaHei), RTL he/ar (w:rtl + w:bidi + `visuallyRightToLeft` layout mirror), Ethiopic am
      font (worker 1.14.143/144). STILL OPEN: filename-suffix registry (still `_Dansk`-only) + owner VISUAL
      gate on ar/zh PDFs.
- [~] R3 Style structure registry: sectionOrder + CL skeleton variant for all 12 styles — FIRST SLICE:
      `antcv-style-page-budget.js` seeds per-style pageBudget + commercial-section order (1.51.235).
      NOT done: full registry.json sectionOrder[]/clSectionOrder[] for all 12 + clSkeletonDelta.
- [ ] R4 Personality-fit style adapters (12 styles x 6 trait clusters)
- [ ] R5 Nordic Minimal generic-baseline regression + Research Formal edge case
- [ ] R6 Wizard/Settings surface + full matrix smoke + server readiness sign-off

Run log:
- 2026-07-10 (desktop, parallel-gen/lang track — see SESSION_2026-07-10_PARALLEL_GEN_AND_LANG.md):
  advanced R2 (CJK+RTL+Ethiopic export, worker 1.14.143/144), R1 (per-tab `__langGenLock` zh/es/he/am/fr/de
  + translation subtitle/slogan round-trip), R3 (per-style page-budget + commercial order sidecar). he/am/ar
  now selectable in the language bar. NEXT unchecked full phases: finish R1 registry, R2 filename-suffix +
  owner ar/zh visual gate, then R3 full registry orders.

## Hard rules (same as every nightly; violating any = failed run)

1. SYNC FIRST (`git fetch origin && git pull --rebase origin main`); never force-push.
2. Verify-first; diagnostic-first per CLAUDE.md. Read the CURRENT version from
   pwa/index.html at run start (do not trust version numbers in this doc).
3. Cache-bust quintet on every pwa asset change (index.html ?v incl. version-override's
   OWN line, sw.js CACHE, TARGET_VERSION, STALE_VERSIONS +prev never current, seed).
4. app.js is minified-sacred: surgical in-place edits mirrored to app.src.js (CRLF);
   no rebuild. Keep edits SMALL - prefer sidecar-defined registries that app.js only
   LOOKS UP (one-line lookup change beats a 100-line inline table edit).
5. Suite green via `node scripts/run-tests.mjs pwa` + `node pwa/test/boot-smoke.mjs`
   before every push. Workers deploy via `gh workflow run deploy.yml` only.
6. Flagship gen model stays claude-opus-4-7 unless the owner flips it.
7. **POST-DEPLOY LIVE VERIFY (desktop runs, owner 2026-07-10):** after push + the
   Pages auto-deploy, open the in-app Browser pane on `https://antcv.pages.dev/` and
   run the checklist in `docs/qa/LIVE_VERIFY_BROWSER_PANE.md` — confirm the deployed
   version is live (freshness-guard), each changed sidecar loaded at its NEW `?v=`, and
   each edit's code marker is present in the built bundle. This catches the stale-`?v`
   phantom-ship regression that tests + static tracing miss. NEVER navigate `?hardReset=1`
   (signs the owner out + wipes languages to EN-DA). Cloud runs can't do this — they
   flag it "owed to a desktop run"; the next desktop run clears the owed verify.

## Ground truth (verified 2026-07-02 by code audit)

Language pipeline:
- Generation language lives in localStorage["language"] (handler It() app.src.js
  ~14630; state je ~14491; cloud-synced via Qn). Generation register map hardcodes
  da/es/zh(+en fallback) at app.src.js ~17168-17171; voice rule da/en at ~23938-23945;
  UI name maps at ~17473/17511/17527; language bar `Me` array (4 entries) ~11320-11325.
- The wizard slide (antcv-wizard-language-slide-339.js:53-77) already lists 23
  languages: en da sv no fi es zh fr de it ar fa he ru tr ku sw zu am fo kl vi th -
  but ONLY feeds spellcheck/UI today (spell-annotator-384.js:259 LANG_NAME).
- Filename suffix: antcv-docx-client.js:2077 (`_Dansk` for da only).
- Servers (proxy + demo-proxy gen-job.js, index.js) are language-agnostic prompt
  relays - NO server change needed for language expansion. Coherence pass is
  language-agnostic.
- docx-worker has NO RTL (ar/fa/he) or CJK-specific handling (fonts, w:bidi, RTL
  paragraph props). This is the ONLY export-side risk.

Style system:
- 12 styles defined in writingSystems/registry.json (+ src/lib/writing-systems.ts),
  each with displayName, constraints, defaultToneChips, lineDensity, allowedLength,
  sectionFormatDefaults, preserveCompressPriority, glyphDensity, exportInstruction.
  ONLY research-formal has sectionOrder[].
- Style -> prompt: personalInfo.writingPrefs.style -> GABRIEL_BG composite block
  (app.src.js ~2754-3172; 12 hardcoded style fragments ~2762-2796) -> fetch-wrap ->
  gen. Layout prefs are client-only.
- CL skeleton: universal 8-section Nordic-default (greeting/opening/why/who/
  foundation/bring/contribute/closure), unconditional since TEMPLATE-STRUCT-DEFAULT-001
  (commit 9e12b9c, gate `cl: !0` at app.src.js ~3539). Test:
  pwa/test/unit/cl-template-struct-default.test.mjs.
- Personality: personalInfo.personality (quiz antcv-personality-quiz-439.js, 6 trait
  clusters) injected in GABRIEL_BG ~3033-3069; precedence stored -> Gabriel-name-guard
  -> GENERIC derived default. KERNEL-STYLE-GUARD-001 (~3055): style varies WITHIN the
  kernel register. UI conflict hint: WritingStylePicker.tsx ~820-842
  styleConflictsKernel().
- Kernels (v2, OneDrive modernized 2026-07-02) carry stylePrefs/writingPrefs; "baked
  into every kernel" = kernel ingestion must map style + template prefs through
  (antcv-kernel-ingest.js / kernel-import.js).

## R1 — Language register registry + client wiring

Goal: any of the 23 wizard languages selected as generation language produces a real
generation in that language.

1. Create `pwa/antcv-language-registry.js` (new sidecar, loaded EARLY, before app.js):
   `window.__ANTCV_LANG_REGISTRY = { <code>: { name, nativeName, register, voice,
   fileSuffix, rtl, cjk, formality } }` for ALL 23. Register strings follow the
   existing pattern (da: Copenhagen hverdagssprog du-form; es: LATAM business; zh:
   formal concise, Latin proper nouns unchanged). Write proper registers per language
   (de: Sie-form, sober; fr: formal vous; ar/fa/he: formal + RTL note + keep Latin
   tokens LTR; kl/fo: plain factual; etc). Cross-language invariants (company names,
   patents, metrics, tool names stay untouched) go in EVERY register line - mirrors
   kernel-v2 crossPolicy.
2. Surgical app.js+app.src.js edits (each a small lookup, mirrored, unique-match):
   a. ~17168-17171 register map -> `(window.__ANTCV_LANG_REGISTRY[e]||{}).register ||`
      existing 4-entry fallback (keep inline 4 as fallback - registry sidecar failure
      must not break gen).
   b. ~23938-23945 voice rule -> registry voice lookup, same fallback shape.
   c. ~17473/17511/17527 name maps -> registry name lookup with existing fallback.
   d. ~11320-11325 `Me` array: language bar derives from enabledLanguages
      (antcv:enabledLanguages) resolved against the registry, capped for space
      (existing bar UX), default en/da. If the React edit is too invasive, sidecar
      the bar extension instead (pattern: language-ui-429).
3. Banned-words per language: writingPrefs.extraBannedWords has {en,da,es,zh} keys -
   make the shape open (any code); no migration needed (absent key = empty).
4. Tests: unit - registry completeness (23 codes x required fields, no em/en dashes
   in register strings); gen-prompt assembly picks the right register for 3 sampled
   new languages (de, ar, sv). Headless gen smoke (anita persona) in ONE new latin
   language (de or sv) end-to-end.
5. Wizard: language-slide picking a primary WRITES localStorage["language"] (verify;
   wire if missing) so wizard choice = generation choice.

## R2 — Export path: suffixes, RTL, CJK

1. Filename suffix: docx-client 2077 -> registry fileSuffix (da `_Dansk`, de
   `_Deutsch`, es `_Espanol`, zh `_ZH`, ar `_AR`, default ISO upper). Mirror rule: no
   diacritics in filenames.
2. CJK: generate a zh CV via the REAL docx-worker (diag harness exists: drive worker
   fetch in node - see pagination-two-map memory); inspect document.xml for font
   fallback; add east-asian font declaration (w:rFonts eastAsia) if LibreOffice/
   CloudConvert renders tofu. Extend to vi/th (both non-CJK scripts but non-latin
   diacritics/Thai - verify rendering only).
3. RTL (ar/fa/he): needs w:bidi + w:rtl paragraph properties + right-aligned layout.
   This is REAL docx-worker work (hand-maintained bundle - edit the inlined block,
   docs/qa memory docx-worker-bundle-no-build). Scope decision for the run: if the
   full two-column RTL layout is too big for one night, ship RTL as beta - generation
   allowed, export shows a "RTL export is beta" notice, main-column-only RTL first.
   NEVER ship silently-broken RTL export.
4. Tests: diag-lang-export-<code>.mjs per script family (latin/cjk/rtl) driving the
   real worker; visual eyeball gate for the owner on ar + zh PDFs.

## R3 — Style structure registry (templates for all 12 styles)

1. registry.json: add per-style `sectionOrder[]` (CV) and `clSectionOrder[]` for all
   12 (research-formal already has CV order). Derive sensible orders per style
   philosophy (credential-forward: education/certs first; achievement-driven:
   outcomes first; cold-outreach CL: shorter, hook-first opening; prestige-structured:
   classic strict; hybrid-balanced = default). Document each order choice in the
   registry (`orderRationale` string).
2. me() gate: CV/CL section order derives from the ACTIVE style's order when present,
   default skeleton otherwise. Implementation preference: a sidecar
   (`antcv-style-section-order.js`) that reorders sections AFTER me()/normalize
   (pattern: the Nordic CL order sidecars) rather than an app.js structural edit;
   respect user's manual reorder if a manual flag exists (the CL manual-order flag
   from 1.51.45; verify its current key name in code - memory says
   antcv:cl-order-manual but the styles agent did not find it, RESOLVE this first).
3. CL skeleton variants: keep the universal skeleton as base; per-style DELTAS only
   (cold-outreach: collapse foundation+bring, 1-page hard cap; research-formal: add
   research-interest paragraph; mediterranean/prestige: formal greeting/closure
   lines). Store deltas in registry (`clSkeletonDelta`), applied by the same sidecar.
4. Kernel baking: kernel-v2 ingestion (antcv-kernel-ingest/import) must carry
   writingPrefs.style + accept an optional `styleTemplates` override block; verify the
   modernized OneDrive kernels (Gabriel v9, Anita fused, Devon) survive round-trip
   with style prefs intact.
5. Tests: unit per style - me()+sidecar produces the registry order; export smoke for
   2 structural styles (research-formal, credential-forward) through the real worker
   (section ids must all be renderable - alias unknown research section ids to
   existing renderer types, DO NOT invent new worker section types without need).

## R4 — Personality-fit style adapters

Goal: the style prompt inject FITS the user's personality kernel, not just sits next
to it.

1. Define STYLE_TRAIT_ADAPTERS: for each of 12 styles x 6 trait clusters (calm /
   analytical / clear-communicator / professional-pride / moral-empathic /
   people-oriented) ONE line: how this style expresses that trait (e.g.
   achievement-driven x calm: "state wins as measured facts, no exclamation, no heat";
   nordic-minimal x people-oriented: "one plain sentence of collaboration evidence, no
   warmth adjectives"). 72 lines, data not code.
2. Ship as part of the GABRIEL_BG composition: after the kernel block, append the
   adapter lines for the ACTIVE style x the kernel's PRESENT traits only. Sidecar-
   define the table (window.__ANTCV_STYLE_TRAIT_ADAPTERS), one surgical app.js lookup
   append inside GABRIEL_BG (or, if GABRIEL_BG assembly is reachable from a sidecar
   wrap, prefer that - investigate first).
3. KERNEL-STYLE-GUARD-001 stays the ceiling: adapters express, never contradict.
4. Tests: unit - adapter table completeness (12x6, no banned words, no em dashes in
   adapter strings); prompt assembly includes exactly the active-style/present-trait
   lines; conflict styles (achievement-driven + calm kernel) produce the softened
   adapter, and the WritingStylePicker warning still shows.

## R5 — Nordic Minimal generic baseline + Research Formal edge case

1. Nordic baseline WITHOUT Gabriel data: headless run with Devon kernel AND Anita
   fused kernel (OneDrive modernized 2026-07-02 copies are in docs/personas
   equivalents - use repo fixtures): assert (a) me() skeleton + Nordic order stable,
   (b) GENERIC personality kernel path taken (no __ANTCV_GABRIEL_KERNEL leak - grep
   the assembled prompt), (c) no Gabriel canon in output sections
   (interests-leak-isolation must hold), (d) one-line bullet rule (~88 chars)
   enforced. Freeze as pwa/test/unit/nordic-generic-baseline.test.mjs + a diag
   that runs a REAL generation when models are available.
2. Research Formal edge case: it assumes publications[]/education[]/grants data.
   Define + implement the degrade rule: EVERY research section id with no data is
   DROPPED (never fabricated); if publications[] is empty, warn in the UI ("Research
   Formal expects publications") and fall back to structured-professional ORDER while
   keeping research TONE. Verify its 12-section order renders through preview AND
   worker (alias map from R3). Anita kernel now HAS publications (fused 2026-07-02) -
   she is the research-formal test persona; Devon (no publications) is the degrade
   test persona.
3. Both gates are REGRESSION tests wired into the suite, not one-off checks.

## R6 — Wizard/Settings surface + matrix + server sign-off

1. Wizard: language slide primary pick drives generation language (R1.5), style slide
   (WritingStylePicker) + personality quiz launchable from the wizard path - verify
   the full flow settings/wizard -> localStorage -> first generation uses all three.
2. Matrix smoke: 12 styles x sampled languages (en, da, de, zh, ar when RTL ships) -
   prompt-assembly-level (fast, no LLM): assert each combination produces a coherent
   prompt (style fragment + register + adapters + kernel), no duplicate/contradicting
   register lines, prompt size within limits (measure; the composite block is ~8KB
   today - cap growth, trim redundancy if the giant instruction block at ~24301
   overflows).
3. Server readiness sign-off: gen-job/multi-llm need NO language/style changes
   (verified) - confirm by running one full gen per new language tier through
   demo-proxy in the live browser or headless with real keys; check demo-enforcement
   rate/size limits still pass with the larger prompt; document in the run report.
4. Update FEATURES_REGISTRY.md rows for languages/styles; close the loop in
   ACTIVE_BUGS.md with a summary block.

## Risks / do-not

- app.js mirror discipline everywhere; prefer sidecar registries + one-line lookups.
- Do NOT let a registry sidecar failure break generation: every lookup keeps the
  existing 4-language / 12-fragment inline fallback.
- RTL export: never silently broken; beta-gate if partial.
- Section-order sidecar must not fight 415/normalize (sections-updated storm class -
  idempotency guard + settle check; see boot-storm-gate-freeze memory).
- LLM output quality in low-resource languages (am, kl, fo, ku): add the adequacy
  gate to reject wrong-language output (script-range check: generated text must be
  predominantly in the target script) - retry once, then fall back to English with a
  visible notice. NEVER export silently-wrong-language content.
