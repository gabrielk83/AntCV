# Babel-fish language architecture — spec (owner 2026-07-11)

Owner principle: **the canonical source of truth is language-neutral *meaning*, not
English.** The encoding is irrelevant (binary, Klingon, a struct — doesn't matter); what
is canonical is the structured *facts*. Every displayed language — English included — is
a *rendering* of that neutral core. There is no privileged pivot language and no
"generate in English then translate" step. A babel fish carries meaning across the
language barrier without changing it.

This spec replaces the current half-built language layer (weak trailing `__langGenLock`
+ manual-only translate pass + hardcoded `LANGUAGE: UK English`).

## 1. The model

- **Canonical = language-neutral fact model.** Roles, scope, numbers, dates, tools,
  proficiency *levels*, proper nouns are semantic facts. `native` is an enum, not an
  English word — it renders as `native` / `母语` / `modersmål`. A number renders as
  itself. Proper nouns and tool/standard names are invariant.
- **Every enabled language is a rendering** produced from the neutral core. English is
  produced the same way zh is.
- **Generation** for the ribbon language renders the neutral meaning directly into that
  language: `LANGUAGE:` names the real target, the source read is that language's
  rendering, invariants are held fixed.
- **Display language ≠ known languages.** Rendering the CV in Chinese never adds Chinese
  to the candidate's spoken-language facts. The languages-you-speak list is data; only
  its *display* is translated. This is the #1 confusion to guard against.

## 2. Field taxonomy (the invariant / renderable split)

Every field is exactly one of:

**INVARIANT** — byte-identical across every language rendering; the babel-fish pass
copies verbatim, never translates:
- numbers, percentages, ratios, dates, year ranges, durations, counts, money
- proper nouns: person names, company/institution names, product/system names
- tool / library / framework / standard / methodology names (Jira, ASPICE, FMEA, ISO…)
- codes, patent numbers, URLs, email, phone
- enum *keys*: proficiency level (`native|professional|B1|…`), section type, on/hidden
  flags, style id, language codes

**RENDERABLE** — babel-fished per language; the surface prose changes, the meaning does
not:
- profile / work-style / who / why / foundation / closure prose
- role scope wording and bullet descriptions (numbers + proper nouns inside stay invariant)
- section descriptions, focus-area labels, competency descriptions
- headings, lead-in labels, furniture ("Results:", "At your service", AI notice)
- the *display label* of an enum (proficiency level shown as `母语` for `native`)

Rule: a renderable value containing an invariant token (a number, a proper noun, a tool
name) keeps that token unchanged inside the translated sentence.

## 3. Storage

- **Neutral facts:** `personalInfo` structure (as today) is the fact carrier. Its string
  values are the *source rendering*, not the master — treated as one language's surface,
  not privileged.
- **Per-language renderings in the cloud:** keyed by language, for the two data bodies
  that feed generation and display:
  - kernel showcase: already keyed `style|lang` (`kernel_showcase_styled`) — today the
    non-source language slots are empty; POPULATE them.
  - personalInfo rendering: a per-language rendering blob (labels + renderable field
    values), invariants omitted (they come from the neutral facts).
- The **language control** (`enabledLanguages`) is the authoritative set of languages
  whose renderings must exist in the cloud. Adding a language to the control schedules
  its rendering; removing it may drop the rendering.

## 4. Flow

1. **Materialize a rendering** (the babel-fish pass) for language L, from the neutral
   facts: translate RENDERABLE fields to L, copy INVARIANT fields verbatim, map enum
   keys to L display labels. Store under L in the cloud. Runs on data change (refresh L)
   or on first use of L (see §6 timing).
2. **Generate** in ribbon language L: read L's rendering as the source material; set the
   prompt's `LANGUAGE:` to L's real native name; generate natively. No English pivot, no
   post-hoc translate.
3. **Fact-preservation check** after any render/generate: assert every INVARIANT in the
   output equals the neutral fact (numbers/proper-nouns/enum set unchanged). A drift =
   rejected + retried, never shipped (mirrors the existing anti-fabrication + adequacy
   gates).

## 5. Concrete code deltas (app.js mirrored to app.src.js; sidecars preferred)

Traced current state (from the 2026-07-11 diagnosis):

- **BUG-1 hardcoded prompt language.** `app.src.js:24899` — `i = a ? "Copenhagen
  Danish…" : "UK English"`. Every non-Danish language (zh/es/he/am/ar) tells the model
  `LANGUAGE: UK English`. FIX: replace with a real per-language name map (a register map
  with zh/he/am/ar names already exists at `app.src.js:17878` — reuse it) so `LANGUAGE:`
  (`25226`, `25288`) names the true target. This alone makes a fresh generation honor the
  ribbon language.
- **BUG-2 language-blind kernel guard.** `app.src.js:30654-30659` (`Cs`) skips
  regeneration on `kernelShowcaseGenerated` / `__hasContent` / `__hasMeta` without
  checking language. FIX: compare the stored kernel's language to `je`; a mismatch forces
  a rebuild (or a render of the missing-language kernel) instead of serving the English
  kernel under a zh ribbon.
- **BUG-3 translate pass is manual-only.** `Pr`/`translateAllSections` (`app.src.js:17849`)
  is the good babel-fish renderer but fires only on a manual dropdown switch
  (`e===je` guard). FIX: expose it programmatically so materialization (§4.1) and a
  post-generation localize can invoke it for a target language without a manual switch;
  it already has no JD gate.
- **Coverage:** `LANG-TRANSLATE-COVERAGE-001` (`17913-17948`) shows the extractor `n(e)`
  must enumerate every section shape (rich_block + role results were recently added).
  Any kernel-only shape not enumerated stays in the source language — the taxonomy in §2
  is the checklist.

Keep the existing 4-language / inline fallbacks so a registry/sidecar failure never
breaks generation (per the nightly hard rules).

## 6. Open knob — materialization timing

- **Lazy + cached (recommended):** render a language the first time it's used, then
  store+reuse. Cheapest; first use of a new language pays one render.
- **Eager:** render every `enabledLanguages` entry up front on data change. All present
  in cloud immediately (owner's "have the data in all languages"); cost = N renders per
  data change.
- Recommendation: lazy+cached with an optional "pre-warm all enabled languages" action —
  same end state, less wasted translation.

## 7. Phasing

- **Phase 1 (immediate, shippable):** BUG-1 (honest `LANGUAGE:` name) + BUG-2
  (language-aware kernel guard) + auto-run the babel-fish render on the fresh output when
  the ribbon language's rendering is missing/stale. Makes "pick zh → get zh" work using
  existing pieces. Verify live via the Browser-pane gate.
- **Phase 2 core (SHIPPED 1.51.321-babel-cache):** the babel-relang sidecar became the
  lazy-cached per-language materializer. Mode split on `antcv:genSpeed`: fast/balanced
  snapshot each confirmed rendering to `antcv:langRender:<L>` and RESTORE it instantly
  on re-select (`window.AntcvApplyStyleKernel`, no LLM); thorough skips the cache (a full
  native generation via the honest `LANGUAGE:` line is the source of truth). Wrong-script
  non-Latin content with no cache → cheap `__antcvRelang(L,true)`. Never auto-fires a
  multi-minute generation from a passive switch. Client-local cache; detection on the
  sections data model.
- **Phase 2b (SHIPPED 1.51.323-babel-cloud-cache + relay 1.3.10/auth-30):** cross-device
  CLOUD persistence. The cache became a single `langRenders` key ({ <lang>: { sections,
  meta, hash, at } }), hard-capped ~40KB (oldest-`at` dropped first). `settings-sync-extra`
  KEYS += `langRenders`; relay `KERNEL_PREFS_OBJ_FIELDS` allowlists it. Verified: POST
  `/api/prefs {langRenders}` → 200 → GET returns it with CJK intact → cleaned up.
- **Phase 2c Part A — fact-preservation check (SHIPPED 1.51.324-babel-invariant):** after a
  relang, the INVARIANTS (every number/metric + every ALL-CAPS acronym — tool/standard
  names) must survive unchanged. The sidecar captures the source invariant set before the
  translate and diffs it against the rendering; drift → console warn + `AntcvBabelRelang.
  lastDrift`; severe drift (≥2 missing) → the lossy rendering is NOT cached. Implements §4.3
  for the translate path.
- **Phase 2c Part B — pre-warm (DEFERRED → 2d):** proactively rendering every enabled
  language up front needs a HEADLESS translate — the current `__antcvRelang`/`Pr` mutates
  the LIVE view (switches language + translates in place), so background pre-warming would
  disrupt what the user sees. The lazy cache + 2b cloud sync already fill every enabled
  language incrementally as the user visits it. Real pre-warm awaits a background translate
  that writes to the cache without touching the live sections.

## 8. Tests / verification

- Unit: invariant-preservation (numbers/proper-nouns/enum set identical across renderings);
  `LANGUAGE:` names the true target for a sample of languages; kernel guard rebuilds on
  language mismatch.
- Live (Browser-pane gate, `docs/qa/LIVE_VERIFY_BROWSER_PANE.md`): deployed version, the
  changed sidecar's `?v`, code markers in the built bundle.
- Owner visual gate on a zh unsolicited CV+CL (the acceptance case for this whole spec).
