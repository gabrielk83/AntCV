# Language output

Per-language tone and register adjustments per writing style. Honoured strictly — the skill never falls back to English on a non-English request.

`target_language` is a two-letter ISO code. AntCV currently supports English (`en`), Danish (`da`), Spanish (`es`), and Mandarin (`zh`). Future additions follow the same per-language adjustment pattern documented here.

---

## Hard rules across languages

1. **No fallback.** If `target_language` is not in the supported list, the skill returns `{"error": "unsupported_language", "language": "<code>"}`. It does not silently produce English.
2. **No mixed-language output.** A single generation produces content in one language. If JD content is mixed-language, the user picks the target language; the skill does not auto-detect mid-generation.
3. **Banned-word lists are language-specific.** The English banned-word list does not apply to Danish output, and vice versa. Each language has its own list in `user_state.writingPrefs.bannedWords.{lang}`.
4. **Section keys remain in English.** The JSON output's `sections` keys are always English (`profile`, `core_competencies`, `selected_outcomes`, etc.). Only the rendered content is in the target language. Section labels in the rendered document are translated per § Section labels below.

---

## English (`en`)

The default language. Per-style content rules in `styles/{name}.md` are written in English; no language-specific adjustment needed.

**Section labels in rendered output:**

- profile → "Profile" (or style-specific name)
- core_competencies → "Core competencies" / "Strengths" / "What I bring"
- selected_outcomes → "Selected outcomes" / "Achievements" / "Highlights"
- experience → "Experience" / "Work experience" / "Professional experience"
- tools_methods → "Tools and methods"
- certifications → "Certifications"
- education → "Education"
- publications_patents → "Publications and patents"
- additional_information → "Additional information"

ATS-Legacy normalises to the most-standard form ("Summary", "Skills", "Achievements", "Work experience", etc. per `cv-skeleton.md` § ATS-Legacy).

---

## Danish (`da`)

Danish commercial writing is tighter than English by default — about 10 – 15 per cent shorter sentences when conveying the same content. Most AntCV styles compress further when targeting Danish.

**Adjustments per style:**

- **`nordic-minimal`**: density adjusts to even tighter — 6 – 12 words per bullet (English baseline 8 – 14). Profile 180 – 240 chars.
- **`measured-professional`**, **`achievement-driven`**, **`structured-professional`**, **`credential-forward`**, **`precision-formal`**, **`hybrid-balanced`**: density adjusts 10% tighter on the upper bound (e.g., medium tier becomes 11 – 16 words per bullet vs English 11 – 17).
- **`context-rich`**, **`mediterranean-formal`**, **`prestige-structured`**: density unchanged. The longer registers do not compress in Danish.

**Register notes:**

- Danish formal commercial register uses "De" (formal you) sparingly in cover letters today; "du" (informal you) is standard. The skill addresses the reader as "du" in cover letters by default.
- Danish job application convention often uses present tense for current work and past tense for past work — same as English. The skill applies this rule.
- Danish CVs frequently include a section called "Frivilligt arbejde" (volunteer work) when relevant. The skill renders `additional_information.volunteer` under this label.

**Section labels in rendered output:**

- profile → "Profil" / "Resumé"
- core_competencies → "Kernekompetencer" / "Styrker"
- selected_outcomes → "Udvalgte resultater" / "Højdepunkter"
- experience → "Erhvervserfaring" / "Arbejdserfaring"
- tools_methods → "Værktøjer og metoder"
- certifications → "Certificeringer"
- education → "Uddannelse"
- publications_patents → "Publikationer og patenter"
- additional_information → "Yderligere oplysninger" (or specific subsection labels: "Sprog", "Frivilligt arbejde", "Interesser")

**Cover letter salutation and sign-off:**

- Salutation: "Kære [Name]," or "Til [Hiring Team]," or "Til ansættelsesudvalget,"
- Sign-off: "Med venlig hilsen," — never "Mvh." in a cover letter (acceptable in email; not in formal application).

**Banned words and phrases specific to Danish:**

In addition to the global Danish banned list (`tværgående`, `tværfunktionel`), this language adds:

- "Stor erfaring i" (much experience in) — substitute with concrete count or duration.
- "Dyb forståelse af" (deep understanding of) — substitute with what was specifically done.
- "Resultatorienteret" (results-oriented) — substitute with the result itself.

---

## Spanish (`es`)

Spanish commercial register is warmer and slightly longer than English. The skill adjusts most styles to allow more relational language and longer bullets.

**Adjustments per style:**

- **`mediterranean-formal`**: this style is well-suited to Spanish — no further adjustment beyond the style's default. Length and warmth match the language's natural commercial register.
- **`nordic-minimal`**: density adjusts looser — 10 – 18 words per bullet (English baseline 8 – 14). Spanish does not compress to fragment bullets gracefully; the skill avoids fragments below 10 words.
- **`measured-professional`**, **`achievement-driven`**, **`structured-professional`**: density adjusts looser on the upper bound by ~20% (medium tier 12 – 20 words per bullet vs English 11 – 17).
- **`context-rich`**, **`prestige-structured`**: density unchanged.

**Regional variants:**

- Iberian Spanish: uses "vosotros" forms in less-formal contexts; "ustedes" in formal commercial. The skill defaults to "ustedes" for commercial registers, "vosotros" only when explicitly indicated.
- LATAM Spanish: uses "ustedes" universally. Defaults to LATAM Spanish when the JD targets LATAM or the company is LATAM-based.

**Section labels in rendered output:**

- profile → "Perfil" / "Resumen profesional"
- core_competencies → "Competencias clave" / "Áreas de fortaleza"
- selected_outcomes → "Logros destacados" / "Resultados clave"
- experience → "Experiencia profesional" / "Trayectoria profesional"
- tools_methods → "Herramientas y metodologías"
- certifications → "Certificaciones"
- education → "Formación académica" / "Educación"
- publications_patents → "Publicaciones y patentes"
- additional_information → "Información adicional" (or "Idiomas", "Voluntariado", "Intereses")

**Cover letter salutation and sign-off:**

- Salutation: "Estimado/a [Name]," (formal) or "Estimado equipo de selección," (when no name available)
- Sign-off: "Saludos cordiales," (commercial) or "Atentamente," (formal)

**Banned words and phrases specific to Spanish:**

- "Apasionado/a por" — Spanish equivalent of "passionate about". Banned globally.
- "Orientado/a a resultados" — equivalent of "results-driven". Banned.
- "Liderazgo demostrado" — equivalent of "proven leadership". Banned.
- "Trabajo en equipo" as a standalone competency without specifics. Specify the team work.

---

## Mandarin (`zh`)

Mandarin commercial CV register is significantly different from European-language registers. The skill applies several structural adjustments in addition to per-style tuning.

**Structural adjustments:**

- **Character count instead of word count.** Mandarin densities use character counts (汉字数) rather than word counts. A 14-word English bullet is roughly 30 – 50 characters in Mandarin depending on subject matter.
- **Profile is shorter.** Mandarin CV profile sections tend to be 120 – 180 characters even at high-density tiers.
- **Bullets are denser per character.** A Mandarin bullet at 25 characters carries roughly the same information as a 12-word English bullet.

**Per-style character ranges (replaces words-per-bullet for `zh`):**

- low density: 18 – 28 characters per bullet
- medium density: 25 – 38 characters
- medium-high density: 32 – 48 characters
- high density: 38 – 58 characters

**Section labels in rendered output:**

- profile → "个人简介" or "个人概述"
- core_competencies → "核心能力" or "专业技能"
- selected_outcomes → "主要成就" or "工作亮点"
- experience → "工作经历" or "职业经历"
- tools_methods → "工具与方法"
- certifications → "专业认证"
- education → "教育背景"
- publications_patents → "发表论文与专利"
- additional_information → "其他信息" (or 语言, 志愿工作, 兴趣爱好)

**Cover letter salutation and sign-off:**

- Salutation: "尊敬的招聘团队," (formal team) or "尊敬的[姓名]先生/女士," (named individual)
- Sign-off: "此致敬礼," followed by the candidate's name on a new line.

**Date format:**

- Mandarin CVs prefer "YYYY年MM月" format. The skill renders dates accordingly.

---

## Generation rules across all languages

1. **Translate at generation, not at display.** The skill produces content in the target language directly — it does not produce English content and then translate. This avoids translation artefacts and ensures the register fits the target language.
2. **Names stay in their native script.** Candidate names, company names, institution names stay in their original form unless the user has explicitly provided a localised version in `user_state.profile.localizedNames`.
3. **Numbers and dates localise.** Decimal separators, date formats, and unit conventions follow the target language's convention.
4. **Acronyms stay original.** ASPICE, ISO 26262, IEC 62304, MBA, M.Sc. — these are international and stay in their original form regardless of target language.

---

## What to do when the target language is unsupported

Return:

```json
{
  "error": "unsupported_language",
  "language": "fr",
  "supported_languages": ["en", "da", "es", "zh"]
}
```

The PWA surfaces the error to the user and offers either to change the target language or to use English with a translation note.

---

## Cross-references

- `style-matrix.md` § Per-style rows — density tiers that this document adjusts per language.
- `cv-skeleton.md` § Section keys — the canonical English keys this document translates labels for.
- `cl-skeleton.md` § Cover letter sections — language-specific salutation and sign-off conventions.
- `styles/{name}.md` — per-style content rules; this document adjusts density and register but does not change the style's primary constraint.
- `output-schema.md` — section keys remain English in the JSON output regardless of `target_language`.
