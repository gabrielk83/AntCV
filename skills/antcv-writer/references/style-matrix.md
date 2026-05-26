# Style Matrix

The canonical reference for all twelve AntCV writing styles. Loaded on every skill call per `SKILL.md` workflow step 3.

Style controls **voice** — sentence shape, evidence order, register, density. It does not control visual rendering (that's the `package`) and it does not control section presence (that's the skeleton). Switching style on a fixed package and skeleton must change content only, per the independence contract in `design-packages.md`.

Per-style files at `styles/{name}.md` carry the full content rules, examples, and edge cases. This document is the row index — fast lookup, no examples. Read both.

---

## Legacy name migration

Earlier iterations of AntCV named writing styles after cultural-register heritages (Scandinavian, USA / American, British, Germanic, Mediterranean, Chinese / East-Asian, Indian, Japanese, LATAM). These names are deprecated. Each legacy name maps to exactly one of the twelve canonical styles below — the canonical name describes the **writing behaviour**, not a region. Country and culture labels were removed because the writing behaviour generalises across regions.

The PWA migrates stored legacy values to the canonical key on next load (`pwa/app.js` state-init); the worker accepts legacy keys as input synonyms but always emits canonical keys in output.

| Current / Legacy name | Canonical name | Modification |
|---|---|---|
| Scandinavian | `nordic-minimal` | Concise, factual, low-noise writing. Keep current template order as default. |
| USA / American | `achievement-driven` | Impact, scope, metrics, and ownership. Country label removed. |
| British | `measured-professional` | Restrained, credible, precise professional register. |
| Germanic | `structured-professional` | Completeness, process, traceability, and reliability. |
| Mediterranean | `mediterranean-formal` | Warmer formal presentation and professional status. |
| Chinese / East-Asian | `prestige-structured` | Institutional fit, hierarchy, and alignment. |
| Indian | `credential-forward` | Qualifications, technical depth, and competitiveness. |
| Japanese | `precision-formal` | Consistency, respect, and organisational fit. |
| LATAM | `context-rich` | Narrative, contextual trust, and relational framing. |
| Unsolicited / Cold Outreach | `cold-outreach` | Use-case style for fast relevance and clear ask. |
| Academic / Research | `research-formal` | Use-case style for academic CVs, papers, grants, and research roles. |
| Hybrid | `hybrid-balanced` | Base writing system plus selected tone chips and custom overrides. |

Reference: *Writing System Engine — Complete AI + UX Implementation Specification*, §2 Canonical Writing Style Names.

---

## The twelve styles at a glance

| Style | Primary constraint | Density | Typical context |
|---|---|---|---|
| `nordic-minimal` | Restraint | low | Nordic commercial, default where restraint is valued |
| `achievement-driven` | Outcome-first ordering | medium | Senior commercial, sales, PM, leadership |
| `measured-professional` | Balance of fact and outcome | medium | Default commercial fallback |
| `structured-professional` | Process-led framing | medium | Ops, quality, compliance, change governance |
| `mediterranean-formal` | Relational warmth within formality | medium-high | Southern Europe, LATAM commercial |
| `prestige-structured` | Institutional weight | high | Senior consulting, finance, executive search |
| `credential-forward` | Credentials surfaced early | medium | Regulated industries, academic-adjacent |
| `precision-formal` | Numerical precision | medium-high | Hardware, scientific, technical PM of complex systems |
| `context-rich` | Narrative voice | high | Humanities, education, NGO, communications |
| `cold-outreach` | Possibility framing, brevity | low | Cold outreach to no-posted-role |
| `research-formal` | Academic register | medium-high | PhD, postdoc, faculty, research scientist |
| `hybrid-balanced` | Bridging two registers | medium | Industry-academic transition, hybrid roles |

Density tiers defined in § Density tiers below.

---

## Per-style rows

Every style row carries the same fields. Where a field is `inherit`, the worker reads from the default in the parent registry.

### `nordic-minimal`

| Field | Value |
|---|---|
| `primaryConstraint` | restraint |
| `constraintAvoid` | filler, qualifiers, hedging, decorative adjectives, warmth markers |
| `constraintPrefer` | short factual sentences, concrete nouns, results without preamble |
| `defaultToneChips` | `["calm", "restrained", "factual"]` |
| `lineDensity` | low |
| `wordsPerBullet` | 8 – 14 |
| `profileChars` | 200 – 280 |
| `sectionFormatDefaults` | profile=paragraph, core_competencies=table-grid, selected_outcomes=bullets, experience=bullets |
| `atsBehavior` | native-safe; canonical section names |
| `compressionTolerance` | low — already minimal |
| `contentRule` | Say less and say it clearly. |
| `avoidRule` | Never add a qualifier where a fact will do. |
| `preserveCompressPriority` | concrete_outcomes, metrics, technical_terms |
| `recommendedPairings` | Copenhagen Modern (primary), Nordic Frost (alt) |
| `pairedSeniority` | mid, senior |
| `legacyAliases` | Scandinavian |

### `achievement-driven`

| Field | Value |
|---|---|
| `primaryConstraint` | outcome-first ordering |
| `constraintAvoid` | process-leading verbs ("Managed the team that..."), duties phrased as accomplishments, vague leadership claims without scope |
| `constraintPrefer` | outcome-first bullets, quantified results when honest, scope-anchored verbs |
| `defaultToneChips` | `["outcome-led", "quantified", "scope-anchored"]` |
| `lineDensity` | medium |
| `wordsPerBullet` | 12 – 18 |
| `profileChars` | 260 – 340 |
| `sectionFormatDefaults` | profile=paragraph, core_competencies=bullets, selected_outcomes=bullets-prominent, experience=bullets |
| `atsBehavior` | native-safe; "Key Achievements" normalised to "Achievements" in legacy |
| `compressionTolerance` | medium — narrative around outcomes can trim |
| `contentRule` | Lead with what changed because of you. |
| `avoidRule` | Never name a duty without naming the outcome. |
| `preserveCompressPriority` | outcome_titles, quantified_metrics, scope_indicators |
| `recommendedPairings` | Navy Executive (primary), Tokyo Precision (alt) |
| `pairedSeniority` | senior, lead, director, vp, c-level |
| `legacyAliases` | USA, American |

### `measured-professional`

| Field | Value |
|---|---|
| `primaryConstraint` | balance of fact and outcome |
| `constraintAvoid` | hyperbole, overclaiming, unsupported metrics, magnitude words without numbers |
| `constraintPrefer` | concrete actions in plain language, measurable examples when available, calm certainty |
| `defaultToneChips` | `["balanced", "concrete", "calm"]` |
| `lineDensity` | medium |
| `wordsPerBullet` | 11 – 17 |
| `profileChars` | 260 – 340 |
| `sectionFormatDefaults` | profile=paragraph, core_competencies=table-grid, selected_outcomes=bullets, experience=bullets |
| `atsBehavior` | native-safe |
| `compressionTolerance` | medium |
| `contentRule` | Concrete actions described in plain language. |
| `avoidRule` | Never claim more than the evidence supports. |
| `preserveCompressPriority` | specific_outcomes, concrete_actions, domain_terms |
| `recommendedPairings` | Copenhagen Modern (primary), Nordic Frost (alt) |
| `pairedSeniority` | mid, senior |
| `legacyAliases` | British |

### `structured-professional`

| Field | Value |
|---|---|
| `primaryConstraint` | process-led framing |
| `constraintAvoid` | hero-narrative framing, outcome-only bullets without method, vague verbs |
| `constraintPrefer` | method-named, framework-cited, scope-defined bullets |
| `defaultToneChips` | `["disciplined", "method-led", "scope-defined"]` |
| `lineDensity` | medium |
| `wordsPerBullet` | 12 – 18 |
| `profileChars` | 260 – 340 |
| `sectionFormatDefaults` | profile=paragraph, core_competencies=table-grid, selected_outcomes=bullets, experience=bullets |
| `atsBehavior` | native-safe |
| `compressionTolerance` | medium |
| `contentRule` | Name the method and the scope, then the result. |
| `avoidRule` | Never describe the work without naming the process. |
| `preserveCompressPriority` | methodology_names, scope_indicators, framework_references |
| `recommendedPairings` | Tokyo Precision (primary), Delhi Technical (alt) |
| `pairedSeniority` | mid, senior, lead |
| `legacyAliases` | Germanic |

### `mediterranean-formal`

| Field | Value |
|---|---|
| `primaryConstraint` | relational warmth within formality |
| `constraintAvoid` | clipped Nordic-style brevity, transactional tone, distance markers, fragment bullets |
| `constraintPrefer` | longer sentences acknowledging context and people, formal vocabulary, relational framing |
| `defaultToneChips` | `["formal", "warm", "relational"]` |
| `lineDensity` | medium-high |
| `wordsPerBullet` | 14 – 22 |
| `profileChars` | 300 – 440 |
| `sectionFormatDefaults` | profile=paragraph-longer, core_competencies=table-grid, selected_outcomes=bullets, experience=bullets |
| `atsBehavior` | native-safe |
| `compressionTolerance` | low — warmth lives in the longer sentences |
| `contentRule` | Acknowledge people and context within a formal register. |
| `avoidRule` | Never strip warmth to fit a length target. |
| `preserveCompressPriority` | relational_framing, context_sentences, formal_vocabulary |
| `recommendedPairings` | Warm Terracotta (primary), Pampas Contemporary (alt) |
| `pairedSeniority` | mid, senior, director |
| `legacyAliases` | Mediterranean |

### `prestige-structured`

| Field | Value |
|---|---|
| `primaryConstraint` | institutional weight |
| `constraintAvoid` | casual register, startup vocabulary, hedging, low-scope verbs |
| `constraintPrefer` | scope-heavy verbs (revenue, headcount, geographic remit), polished formal vocabulary, institutional framing |
| `defaultToneChips` | `["institutional", "polished", "scope-heavy"]` |
| `lineDensity` | high |
| `wordsPerBullet` | 17 – 26 |
| `profileChars` | 360 – 500 |
| `sectionFormatDefaults` | profile=paragraph-substantive, core_competencies=structured-grid, selected_outcomes=bullets, experience=bullets |
| `atsBehavior` | native-safe; "Career Highlights" normalised to "Achievements" in legacy |
| `compressionTolerance` | low — weight comes from longer bullets |
| `contentRule` | Frame every bullet at the scope appropriate to the level. |
| `avoidRule` | Never use language that lowers the register. |
| `preserveCompressPriority` | scope_indicators, institutional_vocabulary, p&l_metrics |
| `recommendedPairings` | Navy Executive (primary), Copenhagen Modern (alt) |
| `pairedSeniority` | senior, director, vp, c-level |
| `legacyAliases` | Chinese, East-Asian |

### `credential-forward`

| Field | Value |
|---|---|
| `primaryConstraint` | credentials surfaced early |
| `constraintAvoid` | hiding accreditations in sidebar tail, generic skill claims without certification, implied qualifications |
| `constraintPrefer` | named certifications inline, accreditation levels stated, regulatory bodies named |
| `defaultToneChips` | `["credentialed", "accredited", "named-methodology"]` |
| `lineDensity` | medium |
| `wordsPerBullet` | 12 – 18 |
| `profileChars` | 260 – 340 |
| `sectionFormatDefaults` | profile=paragraph-with-creds, core_competencies=table-grid-creds-first, selected_outcomes=bullets, experience=bullets-with-creds, certifications=prominent (top-sidebar or main) |
| `atsBehavior` | native-safe |
| `compressionTolerance` | low — credentials cannot be dropped |
| `contentRule` | Name the credential, then the work it enabled. |
| `avoidRule` | Never imply a qualification you don't formally hold. |
| `preserveCompressPriority` | certification_names, regulatory_references, accreditation_levels |
| `recommendedPairings` | Delhi Technical (primary), Copenhagen Modern (alt) |
| `pairedSeniority` | mid, senior, lead |
| `legacyAliases` | Indian |

### `precision-formal`

| Field | Value |
|---|---|
| `primaryConstraint` | numerical precision |
| `constraintAvoid` | vague magnitude words ("significantly", "substantially", "many", "several"), hedged metrics, range-padding |
| `constraintPrefer` | exact percentages, ranges, units, technical vocabulary used precisely |
| `defaultToneChips` | `["precise", "quantified", "technical"]` |
| `lineDensity` | medium-high |
| `wordsPerBullet` | 14 – 22 |
| `profileChars` | 280 – 400 |
| `sectionFormatDefaults` | profile=paragraph-precise, core_competencies=structured-grid, selected_outcomes=bullets-quantified, experience=bullets-with-numbers |
| `atsBehavior` | native-safe |
| `compressionTolerance` | medium — numbers stay; surrounding text trims |
| `contentRule` | Quantify wherever a real number is available. |
| `avoidRule` | Never use a magnitude word when a number is available. |
| `preserveCompressPriority` | exact_metrics, technical_specs, units_and_ranges |
| `recommendedPairings` | Tokyo Precision (primary), Copenhagen Modern (alt) |
| `pairedSeniority` | mid, senior, lead |
| `legacyAliases` | Japanese |

### `context-rich`

| Field | Value |
|---|---|
| `primaryConstraint` | narrative voice |
| `constraintAvoid` | fragment-shaped bullets, telegraphic brevity, missing the why behind a move |
| `constraintPrefer` | sentence-shaped bullets, longer profile paragraphs, reasoning clauses |
| `defaultToneChips` | `["narrative", "reasoned", "why-led"]` |
| `lineDensity` | high |
| `wordsPerBullet` | 17 – 26 |
| `profileChars` | 360 – 500 |
| `sectionFormatDefaults` | profile=paragraph-long, core_competencies=bullets-narrative, selected_outcomes=bullets-with-context, experience=bullets-sentence-shaped |
| `atsBehavior` | native-safe — narrative parses fine |
| `compressionTolerance` | medium — sentences shorten but stay sentences |
| `contentRule` | Say why this work mattered, not just what was done. |
| `avoidRule` | Never fragment a sentence to fit a bullet. |
| `preserveCompressPriority` | narrative_threads, reasoning_clauses, context_sentences |
| `recommendedPairings` | Warm Terracotta (primary), Pampas Contemporary (alt) |
| `pairedSeniority` | mid, senior |
| `legacyAliases` | LATAM |

### `cold-outreach`

| Field | Value |
|---|---|
| `primaryConstraint` | possibility framing, brevity |
| `constraintAvoid` | full CV-style density, formal applicant register, credential-dumping, closing pressure |
| `constraintPrefer` | speculative framing, shorter bullets, possibility-led openers, conversational tone |
| `defaultToneChips` | `["speculative", "brief", "conversational"]` |
| `lineDensity` | low |
| `wordsPerBullet` | 8 – 14 |
| `profileChars` | 160 – 260 |
| `sectionFormatDefaults` | profile=paragraph-short, core_competencies=omit, selected_outcomes=bullets-short, experience=bullets-condensed, certifications=omit, education=sidebar-minimal |
| `atsBehavior` | native-safe; informal section names like "Quick Background" normalised in legacy |
| `compressionTolerance` | high — designed for compression |
| `contentRule` | Open a conversation, don't close a sale. |
| `avoidRule` | Never write more than the recipient will read in 30 seconds. |
| `preserveCompressPriority` | openers, specific_company_signals, actionable_offers |
| `recommendedPairings` | Copenhagen Modern (primary), Tokyo Precision (alt) |
| `pairedSeniority` | mid, senior, lead, director |
| `legacyAliases` | Unsolicited, Cold Outreach |

### `research-formal`

| Field | Value |
|---|---|
| `primaryConstraint` | academic register |
| `constraintAvoid` | commercial outcome framing, revenue or growth metrics, KPI vocabulary, hero-narrative |
| `constraintPrefer` | research questions, methodological contributions, publications, citations, grants, named techniques |
| `defaultToneChips` | `["academic", "methodological", "publication-anchored"]` |
| `lineDensity` | medium-high |
| `wordsPerBullet` | 14 – 22 |
| `profileChars` | 360 – 1100 (career-stage dependent, see `cv-skeleton-academic.md`) |
| `sectionFormatDefaults` | research_summary=paragraph-substantive, publications=structured-grid-by-type, research_experience=bullets-method-led, education=prominent |
| `atsBehavior` | native-safe; academic-formal section names |
| `compressionTolerance` | low — academic CVs are longer by design |
| `contentRule` | Frame contributions as research outputs, not commercial wins. |
| `avoidRule` | Never use commercial metrics where a research metric exists. |
| `preserveCompressPriority` | publication_data, research_questions, methodological_terms |
| `recommendedPairings` | Copenhagen Modern (primary), Delhi Technical (alt) |
| `pairedSeniority` | n/a (uses `career_stage` instead) |
| `legacyAliases` | Academic, Research |

### `hybrid-balanced`

| Field | Value |
|---|---|
| `primaryConstraint` | bridging two registers |
| `constraintAvoid` | fully committing to one register at the cost of the other |
| `constraintPrefer` | structure of commercial with weight of context-rich or research-formal, depending on JD |
| `defaultToneChips` | `["bridging", "dual-register", "jd-tuned"]` |
| `lineDensity` | medium |
| `wordsPerBullet` | 12 – 18 |
| `profileChars` | 300 – 420 |
| `sectionFormatDefaults` | user-defined per `user_state.writingPrefs.hybridLayout` |
| `atsBehavior` | native-safe; section names follow user choice |
| `compressionTolerance` | medium |
| `contentRule` | Carry both registers without picking one. |
| `avoidRule` | Never write a bullet that only one of the two registers would accept. |
| `preserveCompressPriority` | bridging_terms, dual_register_signals |
| `recommendedPairings` | user-defined |
| `pairedSeniority` | n/a (depends on bridge target) |
| `legacyAliases` | Hybrid |

---

## Density tiers

`lineDensity` tier definitions, used by the Density + Compression Engine to budget bullets against page count.

| Tier | Words per bullet | Profile chars | Bullets per role (3-page) |
|---|---|---|---|
| low | 8 – 14 | 160 – 280 | 2 – 3 |
| medium | 11 – 18 | 260 – 340 | 3 – 4 |
| medium-high | 14 – 22 | 280 – 440 | 3 – 5 |
| high | 17 – 26 | 360 – 500 | 4 – 6 |

Tight by design — bullets should land on a single line at the default 4.94" main-column width. The Density Engine widens only when content over-budgets the visual layer.

The Density Engine reads `wordsPerBullet` and `profileChars` from the style row, then scales by `target_pages` and the active package's image size (which affects sidebar space). The skill produces content within these ranges; if a section overflows, the Density Engine asks for a `compress` operation.

---

## Tone chips

Tone chips are additive modifiers on top of a style. They shift register within the style's constraints — they do not override the style. A user can add a chip from the editor, and the skill honours it on the next generation.

`defaultToneChips` ship with the style. The user can add more from the catalogue or remove defaults.

### Chip catalogue

| Chip | Effect | Compatible with |
|---|---|---|
| `calm` | dampen exclamation, reduce magnitude words | all |
| `restrained` | shorten sentences, drop qualifiers | nordic-minimal, measured-professional, cold-outreach |
| `factual` | strip evaluative adjectives, prefer numbers | all except context-rich |
| `outcome-led` | enforce outcome-first ordering | achievement-driven, measured-professional, prestige-structured |
| `quantified` | demand metric in every bullet that has one available | achievement-driven, precision-formal, prestige-structured |
| `scope-anchored` | name team size, revenue, geography | achievement-driven, prestige-structured |
| `balanced` | no register lean | measured-professional, hybrid-balanced |
| `concrete` | prefer specific nouns over generic | all |
| `disciplined` | name the method/framework | structured-professional, credential-forward |
| `method-led` | lead bullets with the method, not the outcome | structured-professional |
| `scope-defined` | state scope explicitly per bullet | structured-professional, prestige-structured |
| `formal` | raise register | mediterranean-formal, prestige-structured, research-formal |
| `warm` | acknowledge people and context | mediterranean-formal, context-rich |
| `relational` | frame work as collaboration | mediterranean-formal, context-rich |
| `institutional` | use organisation-level framing | prestige-structured |
| `polished` | smooth out short clauses | prestige-structured, mediterranean-formal |
| `scope-heavy` | foreground revenue, headcount, P&L | prestige-structured |
| `credentialed` | surface qualifications inline | credential-forward, research-formal |
| `accredited` | name accreditation levels explicitly | credential-forward |
| `named-methodology` | cite ISO numbers, Six Sigma levels, etc. | credential-forward, structured-professional |
| `precise` | exact numbers, no magnitude words | precision-formal, achievement-driven |
| `technical` | accept technical vocabulary as register | precision-formal, structured-professional |
| `narrative` | sentence-shaped bullets, paragraph profile | context-rich, hybrid-balanced |
| `reasoned` | name the why behind each move | context-rich, hybrid-balanced |
| `why-led` | lead with reasoning, then evidence | context-rich |
| `speculative` | possibility-led framing | cold-outreach |
| `brief` | aggressive compression | cold-outreach, nordic-minimal |
| `conversational` | drop applicant register | cold-outreach |
| `academic` | research register, no commercial framing | research-formal, hybrid-balanced |
| `methodological` | foreground methods over outcomes | research-formal, structured-professional |
| `publication-anchored` | reference publications in body text | research-formal |
| `bridging` | dual-register signals | hybrid-balanced |
| `dual-register` | accept both registers in same bullet | hybrid-balanced |
| `jd-tuned` | weight register toward JD's dominant signal | hybrid-balanced |

Chips marked "all" are universally compatible. Chips marked with specific style names are accepted on those styles only; the worker silently drops incompatible chips and emits a `tone_chip.incompatible` event for analytics.

### Conflicting chips

A few chips conflict if both are active. The skill honours the more recently added; the worker emits `tone_chip.conflict` for analytics AND the PWA surfaces a non-blocking flag to the user on the affected chips so they can adjust.

- `restrained` ↔ `narrative` (length conflict)
- `factual` ↔ `narrative` (form conflict)
- `quantified` ↔ `narrative` (form conflict for some bullets)
- `outcome-led` ↔ `method-led` (ordering conflict)
- `polished` ↔ `restrained` (register conflict)

The flag shows alongside the chip — small icon with hover tooltip explaining which pair conflicts and which one is winning. The user can drop the losing chip or swap which wins. Both the conflict and the user's resolution are logged for future style-row tuning.

---

## Cascade interactions

When the user changes `writing_style`, the worker's cascade handler (`AI_IMPLEMENTATION_GUIDE.md` § 4.1) re-seeds these fields from the new style row, unless the user has set `writingPrefs.overrides[field] === true`:

- `chips` ← new style's `defaultToneChips`
- `lineDensity` ← new style's `lineDensity`
- `sectionFormatDefaults` ← new style's `sectionFormatDefaults`
- `compressionTolerance` ← new style's `compressionTolerance`
- `wordsPerBullet` ← new style's `wordsPerBullet`
- `profileChars` ← new style's `profileChars`
- `preserveCompressPriority` ← new style's `preserveCompressPriority`

`primaryConstraint`, `constraintAvoid`, `constraintPrefer`, `contentRule`, `avoidRule`, `atsBehavior` are read from the registry at generation time and not cached on `writingPrefs` — they are pure functions of `writing_style`. The user cannot override them at the style level; they would change style instead.

---

## How the runtime LLM uses this file

The skill loads this matrix on every call. The relevant style's row is extracted into the prompt context. The matrix-wide sections (density tiers, tone chips, cascade interactions) are loaded once per worker process and re-used.

The runtime LLM does not need to memorise all twelve rows. The worker passes only the active style's row plus the user's tone chips. The matrix exists primarily for orientation, cascade implementation, and pairing recommendations — runtime calls receive a focused slice.

For style-specific examples, banned forms, and edge cases, the LLM reads `styles/{name}.md` for the active style.

---

## Versioning

Style row schema is at `v0.1.0`. Adding fields to a row is a minor version bump. Renaming a field, removing a field, or changing the canonical values of an enum is a major version bump and requires migration of `user_state.writingPrefs`.

The active style set is `v1.50` — 5 styles enabled at launch (nordic-minimal, achievement-driven, measured-professional, context-rich, cold-outreach). The remaining 7 ship in subsequent releases per the locked-source plan rollout schedule.

---

## Cross-references

- `cv-skeleton.md` — commercial section set; style controls ordering/naming.
- `cv-skeleton-academic.md` — `research-formal` section set, career-stage variants.
- `cl-skeleton.md` — cover letter; styles apply identically.
- `styles/{name}.md` — per-style content rules, examples, banned forms, edge cases.
- `personalization.md` — how `role_summary` modulates style application.
- `change-log-application.md` — how recurring `risk` patterns soften style output.
- `language-output.md` — per-language tone adjustments per style.
- `design-packages.md` § Recommended pairings — style → package nudges.
- `role-inference.md` § Why seniority matters for the skill — how `commercial_seniority` feeds style emphasis.
