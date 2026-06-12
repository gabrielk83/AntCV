# LANG-EXPAND-001 — Language expansion spec

Status: SPEC — approved direction, implementation not started
Owner: Gabriel
Created: 2026-06-12
Plan ref: docs/plan/AntCV_Plan_v2_LockedSources.md §4 (writing systems), roadmap item "Add Spanish + Mandarin to language bar"

## 1. Scope

Add generation-language support for:

| Code | Language | Script | Direction | Tier |
|------|----------|--------|-----------|------|
| it | Italian | Latin | LTR | 1 |
| pt-BR | Portuguese (Brazil) | Latin | LTR | 1 |
| en-US | English (US) | Latin | LTR | 1 |
| hi | Hindi | Devanagari | LTR | 2 |
| am | Amharic | Ethiopic (Ge'ez) | LTR | 2 |
| he | Hebrew | Hebrew | RTL | 3 |
| ar | Arabic | Arabic | RTL | 3 |
| ps | Pashto | Arabic (extended) | RTL | 3 |

Current canonical set: en, da, es, zh (writingSystems/registry.json → supportedLanguages). The UI string layer separately covers more languages; this spec concerns the generation pipeline only.

Decisions locked at spec time:
- Portuguese default is **pt-BR**. pt-PT deferred; if added later it is a separate BCP-47 entry, not a variant flag.
- en-US is a **variant of English**, sharing the en banned lists and per-style rules, differing in: spelling (organise→organize), vocabulary (CV→resume where register allows), date format (MM/DD/YYYY in body text where dates are written long-form: "June 12, 2026").
- Current `en` is retagged **en-GB** with `en` kept as an accepted alias resolving to en-GB.
- Digits policy for ar/he/ps: **Western numerals** in all CV/CL output. Regional CV convention and ATS-safe.
- ATS-Legacy export for RTL languages: ships **LTR-structured with a user-facing warning** until RTL-through-ATS parsing is validated. Visual exports (Preview, DOCX, PDF) are fully RTL.

## 2. Prerequisite — LANG-EXPAND-001-A: BCP-47 migration

Must land before any new language. One-time, breaking-internal change.

- `LangCode` union in src/lib/writing-systems.ts → BCP-47 strings: 'en-GB' | 'en-US' | 'da' | 'es' | 'zh' | ... (keep 2-letter codes where no variant exists).
- `normaliseLangCode`: accept BCP-47, case-insensitive, map legacy aliases (en→en-GB, pt→pt-BR, zh-CN/cn→zh). Unknown → en-GB.
- writingSystems/registry.json: supportedLanguages + sharedBannedBases keys migrate. registry.schema.json key pattern updated from ^[a-z]{2}$ to BCP-47-tolerant.
- writing-style-engine.js: SUPPORTED_LANGUAGES + any lang-keyed lookups. **Dual-sync rule applies** — workers/proxy/src and workers/demo-proxy/src, separate CI deploys, proxy first.
- skills/antcv-writer/references/language-output.md: code references updated; unsupported_language error payload returns BCP-47 codes.
- pwa/antcv-lang-bar-filter.js: labelToCode regex ^[a-z]{2}$ extended to accept xx-XX.
- Stored user state: personalInfo.stylePrefs language values and localStorage 'language'/'uiLang' may hold legacy codes — normaliser is the single read-side compatibility layer; no data migration.

Acceptance: registry-sync.test.mjs green in both workers; existing en/da/es/zh generations byte-identical in behaviour (en resolves to en-GB).

## 3. Tier 1 — it, pt-BR, en-US (registry-only)

Per language:
1. registry.json: supportedLanguages entry + sharedBannedBases.words/phrases arrays (start populated, not empty — see below).
2. language-output.md: full section per the established pattern — register notes, per-style density adjustments, section labels, CL salutation/sign-off, language-specific banned items.
3. No rendering, font, or layout work.

Register starting points:
- **it**: commercial register close to es warmth; mediterranean-formal is the natural pairing. Salutation "Gentile [Name]," / "Spett.le [Company],"; sign-off "Cordiali saluti,". Ban "appassionato/a di", "orientato ai risultati", "comprovata esperienza".
- **pt-BR**: "você" register, warm-direct. Salutation "Prezado/a [Name],"; sign-off "Atenciosamente,". Ban "apaixonado/a por", "orientado a resultados", "vasta experiência", "comprovada capacidade".
- **en-US**: inherits en-GB lists wholesale. Adds spelling transform table (-ise→-ize, -our→-or, -re→-er where applicable, licence→license as noun). achievement-driven is the natural default pairing (legacyAliases already carry "usa", "american").

## 4. Tier 2 — hi, am (fonts + complex script, LTR)

Everything in Tier 1, plus:

- **Preview fonts**: fallback chains — Devanagari: "Noto Sans Devanagari", Ethiopic: "Noto Sans Ethiopic" — appended to the body font stack, loaded on demand (subset via Google Fonts or self-hosted woff2) only when the active language requires the script. Do not load for Latin sessions.
- **docx-worker**: runs in these languages need complex-script properties — w:rFonts with cs= set to the script font, plus w:szCs mirroring w:sz. Headings (Sans Serif Collection) have no Devanagari/Ethiopic coverage; heading font maps to the Noto face for these languages.
- **CloudConvert PDF**: follows DOCX; verify font embedding on first conversion, expect to ship the Noto faces alongside if substitution occurs.
- **Density**: word-count tiers apply unchanged for hi and am (space-separated scripts). Revisit after first real generations.
- Section labels, salutations per language section in language-output.md (hi: "प्रोफ़ाइल", "कार्य अनुभव", "शिक्षा"...; am: "መግለጫ", "የሥራ ልምድ", "ትምህርት"... — finalise with native review before activation).

Acceptance: Preview/DOCX/PDF/desktop+mobile parity per QA core rule; no tofu glyphs in any export.

## 5. Tier 3 — he, ar, ps (RTL)

Implementation order: **he → ar → ps** (he has no cursive shaping; ar adds joining; ps adds extended glyphs ټ ډ ړ ږ ښ ګ ڼ ۀ requiring Noto Naskh Arabic / Noto Sans Arabic — verify ps coverage explicitly, many Arabic fonts lack these).

Layout mirroring, all targets:

```
        LTR                          RTL
┌─────────┬──────────┐      ┌──────────┬─────────┐
│ sidebar │   main   │  →   │   main   │ sidebar │
│ #283556 │  column  │      │  column  │ #283556 │
└─────────┴──────────┘      └──────────┴─────────┘
```

- **Preview**: dir="rtl" on document root for the rendered CV; grid column order flips; text-align logical (start/end, not left/right) — audit existing CSS for physical left/right values; bullet markers and rules mirror.
- **DOCX (docx-worker)**: w:bidi on section + paragraph properties; w:rtl run property; table column order reversed (grid built right-to-left); sidebar/main table-cell swap; pentagon/circle photo placement mirrors.
- **PDF**: iframe-print path follows Preview; CloudConvert path follows DOCX.
- **Numerals**: Western digits enforced at generation (skill-level rule in language-output.md, per-language section).
- **Mixed-direction runs**: Latin tokens inside RTL text (company names, ISO 26262, ASPICE, email, URLs) rely on the Unicode bidi algorithm; acronyms-stay-original rule already covers content. QA must include bullets mixing Hebrew/Arabic text with Latin acronyms and numbers.
- **ATS-Legacy**: LTR structure + warning (locked decision §1). Revisit after parser testing.
- **Fonts**: he — Noto Sans Hebrew (Calibri has Hebrew coverage but verify weight pairing in DOCX); ar/ps — Noto Naskh Arabic (body) or Noto Sans Arabic; headings map per Tier 2 pattern.

Register notes to draft per language in language-output.md (he: direct, compact, "שלום [Name]," informal common in tech, "בברכה," sign-off; ar: formal register, "السيد/السيدة المحترم/ة" salutation forms, MSA not dialect; ps: formal MSA-adjacent conventions, native review required before activation).

## 6. Lang bar UI

pwa/antcv-lang-bar-filter.js clusters cap at 6 buttons; with 15+ languages the bar pattern itself fails. Ties to existing roadmap item: user selects default languages in onboarding wizard AND Settings → Personal; bar shows only the selected subset. Sidecar work: extend LABEL_TO_CODE (italiano, português, עברית, العربية, हिन्दी, پښتو, አማርኛ, english (us)); raise or remove the 6-button cluster cap once the subset model guarantees small visible counts.

## 7. File touch list

| File | A | T1 | T2 | T3 |
|------|---|----|----|----|
| writingSystems/registry.json | x | x | x | x |
| writingSystems/registry.schema.json | x | | | |
| src/lib/writing-systems.ts | x | x | x | x |
| workers/proxy/src/writing-style-engine.js | x | x | x | x |
| workers/demo-proxy/src/writing-style-engine.js | x | x | x | x |
| skills/antcv-writer/references/language-output.md | x | x | x | x |
| pwa/antcv-lang-bar-filter.js | x | | | x |
| workers/docx-worker (run props, bidi, tables) | | | x | x |
| Preview CSS (logical properties, dir, fonts) | | | x | x |
| Onboarding wizard + Settings → Personal | | x | x | x |

## 8. Open items

1. Native review of section labels and salutations before activating hi, am, ar, ps (he covered in-house).
2. ps font coverage verification (extended glyphs) before Tier 3 close.
3. RTL-through-ATS parser test to revisit the ATS-Legacy LTR decision.
4. Density recalibration for hi/am/ar/he after first real generations (zh char-count precedent available if needed).
