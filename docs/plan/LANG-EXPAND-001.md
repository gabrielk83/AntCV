# LANG-EXPAND-001 — Language expansion spec

Status: SPEC — approved direction, implementation not started. SECOND WAVE added 2026-06-16 (see §9).
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

---

## 9. LANG-EXPAND-002 — second wave (owner 2026-06-16)

Owner asked to add Arabic + Amharic (NOTE: both already in §1 — ar Tier 3, am Tier 2; no action,
flagged to avoid duplication), plus Swahili, Korean, Indonesian, Greenlandic, Quechua, Faroese, AND
any of the **15 most-spoken languages** (2026 Ethnologue) not already covered. This section extends
§1 with those; the §2 BCP-47 prerequisite (LANG-EXPAND-001-A) and the per-tier mechanics (§3–§6)
apply unchanged — each new language slots into the existing tier machinery.

### 9.1 Most-spoken-15 audit (2026 Ethnologue, total speakers)

Ranked set: English, Mandarin, Hindi, Spanish, Standard Arabic, French, Bengali, Portuguese,
Indonesian, Urdu, Russian, Standard German, Japanese, Nigerian Pidgin, Egyptian Arabic.

Already covered (canonical or §1): English (en-GB/en-US), Mandarin (zh), Hindi (hi), Spanish (es),
Standard Arabic (ar), Portuguese (pt-BR).

Top-15 GAPS now added below: French, Bengali, Indonesian, Urdu, Russian, German, Japanese.

Two top-15 entries are colloquial varieties, resolved per owner decision 2026-06-16:
- **Egyptian Arabic (#15)** — added as a **variant of `ar`** (code **ar-EG**), the en-GB→en-US
  pattern: `ar` (Modern Standard Arabic) is the default; ar-EG is a spelling/register PACKAGE
  layered on it, NOT a separate language. Same script/RTL/font as ar (§5) — no new tier work; only
  a vocabulary/register delta. See §9.2a.
- **Nigerian Pidgin (#14)** — **dropped** (owner decision): English-lexified creole, no formal-CV
  register. Not added.

### 9.2 New languages — scope table

| Code | Language | Script | Direction | Tier | Notes |
|------|----------|--------|-----------|------|-------|
| fr | French | Latin | LTR | 1 | top-15 #6. Salutation "Madame, Monsieur,"; sign-off "Cordialement,"/"Veuillez agréer…". Ban "passionné(e) par", "force de proposition" (filler), "dynamique" as filler. |
| de | German | Latin | LTR | 1 | top-15 #12. Formal "Sehr geehrte Damen und Herren,"; sign-off "Mit freundlichen Grüßen,". Ban "engagiert"/"motiviert" as filler, "Teamplayer". ß + umlauts — Latin font covers. |
| id | Indonesian | Latin | LTR | 1 | top-15 #9 + owner-named. Warm-formal; salutation "Yang terhormat [Name],"; sign-off "Hormat saya,". |
| sw | Swahili | Latin | LTR | 1 | owner-named (#22). Salutation "Mpendwa [Name],"; sign-off "Wako mtiifu,"/"Kwa heshima,". Native review before activation. |
| kl | Greenlandic (Kalaallisut) | Latin | LTR | 1 | owner-named; DK-market relevant. Latin + diacritics (Calibri covers). Polysynthetic → very long compounds; **density: recalibrate (long single words blow word-count tiers)** — treat like a char-count check, see §9.4. Native review required. |
| fo | Faroese | Latin | LTR | 1 | owner-named; Nordic/DK relevant. Latin + ð/ø/á. Salutation/sign-off close to Danish conventions; confirm with native review. |
| qu | Quechua | Latin | LTR | 1 | owner-named. MACROLANGUAGE — default to Southern Quechua; **decision: tag `qu` generic or `qu-PE`?** (parallels the pt-BR variant decision). Native review required; CV register conventions sparse — flag. |
| ru | Russian | Cyrillic | LTR | 1.5 | top-15 #11. Cyrillic — Calibri + Noto Sans cover it, so effectively registry-only, BUT verify glyph coverage in the DOCX heading font (Sans Serif Collection may lack Cyrillic → map to Noto Sans like the Tier-2 pattern). Salutation "Уважаемый/ая [Name],"; sign-off "С уважением,". |
| ko | Korean | Hangul | LTR | 2 | owner-named. Font: Noto Sans KR (body + heading map, headings lack Hangul). LTR, space-segmented → word-count tiers roughly hold but **revisit density**. Salutation "[Name]님께,"; sign-off "감사합니다,". Native review. |
| bn | Bengali | Bengali | LTR | 2 | top-15 #7. Font: Noto Sans Bengali (body + heading map). Complex script → same w:rFonts cs= / w:szCs DOCX handling as hi/am (§4). Native review. |
| ur | Urdu | Arabic (Nastaliq) | RTL | 3 | top-15 #10. **Hardest font case in the whole plan**: Urdu is written in NASTALIQ, not Naskh — needs **Noto Nastaliq Urdu**; most Arabic fonts (incl. the ar/ps Naskh faces) render Urdu wrong. RTL layout per §5; verify Nastaliq vertical metrics don't break line height in DOCX/PDF. Native review required. |

### 9.2a ar-EG — Egyptian Arabic as a variant of ar (not a separate language)

Mirrors the en-GB→en-US relationship exactly:
- **ar** is the default and parent (Modern Standard Arabic). **ar-EG** inherits ar wholesale —
  same Arabic script, RTL layout, Western-numerals policy, fonts (Noto Naskh Arabic), and §5
  machinery. NO new tier, font, or layout work.
- ar-EG differs from ar only as a **spelling/register package**: Egyptian-Arabic vocabulary and
  phrasing where register allows, retaining a professional CV tone (Egyptian colloquial leans
  informal — keep it CV-appropriate, not street register). Salutation/sign-off may use the Egyptian
  conventional forms; banned-list inherits ar's and adds Egyptian-specific filler to avoid.
- `normaliseLangCode` (§2): `ar` resolves to MSA; `ar-EG` (and aliases "egyptian", "masri") resolve
  to the variant. Unknown ar-* → ar.
- registry/engine: ar-EG is an ar variant entry sharing ar's sharedBannedBases, with a small
  variant delta — not a duplicated language definition. language-output.md gets an ar-EG sub-section
  under ar, not a standalone Tier section.

### 9.3 Tier assignment summary (which §3–§6 machinery each uses)

- **Tier 1 (registry + language-output.md only):** fr, de, id, sw, kl, fo, qu  — and ru as "Tier 1.5"
  (registry-only PLUS a Cyrillic heading-font glyph-coverage check; no layout work).
- **Tier 2 (fonts + complex/non-Latin script, LTR):** ko (Noto Sans KR), bn (Noto Sans Bengali),
  ja (Noto Sans JP). Each adds the on-demand font load (Preview) + w:rFonts cs= / w:szCs (DOCX) +
  heading-font remap, exactly as hi/am in §4.
- **Tier 3 (RTL):** ur (Nastaliq — the one new RTL entry). Full §5 RTL mirroring + the Nastaliq
  font caveat above.
- **Variant of an existing language (no new tier):** ar-EG (variant of ar, §9.2a) — like en-US.

(ja was implicit in "top-15 not covered" — added here at Tier 2: CJK, **char-count density like zh,
NOT word-count**; Noto Sans JP; salutation "[Name]様,"; sign-off "敬具,".)

### 9.4 Deltas to the existing plan mechanics

- **§1 digits policy** extends to ur and ar-EG (Western numerals, same as ar/he/ps).
- **§4 font list** gains: Noto Sans KR, Noto Sans Bengali, Noto Sans JP. **§5 font list** gains:
  Noto Nastaliq Urdu (distinct from the Naskh faces — do NOT reuse the ar/ps font for ur). ar-EG
  reuses ar's fonts — no addition.
- **§4 density**: ja and zh are char-count, not word-count. **kl (Greenlandic) polysynthesis** and
  **ko** need a density recalibration pass after first real generations (add to §8 open items).
- **§6 lang bar**: LABEL_TO_CODE gains français, deutsch, indonesia/bahasa, kiswahili, kalaallisut,
  føroyskt, runa simi/quechua, русский, 한국어, বাংলা, اردو, 日本語, and العربية (مصري)/egyptian → ar-EG.
  The 6-button cluster cap is now definitively unworkable (~25 entries) → the selected-subset model
  (§6) is a hard prerequisite, not optional.
- **Variant decisions** (parallel to pt-BR / en-US): qu → Southern Quechua default; ar-EG → variant
  of ar (§9.2a); ru/de/fr/ja/ko/bn no variant split needed now.

### 9.5 Updated open items (append to §8)

5. Native review before activation: sw, kl, fo, qu, ko, bn, ur (in addition to hi, am, ar, ps from
   the first wave). he covered in-house; fr/de/id/ru are in-house-reviewable or low-risk. ar-EG
   register/vocabulary delta needs Egyptian-Arabic native review (lighter than a full language —
   inherits ar).
6. ur Nastaliq font (Noto Nastaliq Urdu) coverage + DOCX/PDF line-metric verification before Tier 3
   close — separate from the ps Naskh check.
7. qu variant tag decision (generic `qu` vs `qu-PE`); CV-register conventions for qu/kl sparse —
   may ship with a lighter register section + a note.
8. Density recalibration after first real generations now also covers ja (char-count), ko, and kl
   (polysynthetic long compounds).

### 9.6 Total post-002 language set

Canonical+§1+§9 = en-GB, en-US, da, es, zh, it, pt-BR, hi, am, he, ar, ps  (first wave)
 + fr, de, id, sw, kl, fo, qu, ru, ko, bn, ur, ja  (second wave)
 + ar-EG  (variant of ar, §9.2a)
= **24 base generation languages + 1 variant (ar-EG)**. Nigerian Pidgin dropped per owner. This
makes the §6 selected-subset language-bar model mandatory, and the BCP-47 prerequisite (§2) gates
the whole set as before.
