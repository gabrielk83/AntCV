# CV Skeleton — commercial layouts

The canonical section set for commercial-style CVs in AntCV. Used by every writing style except `research-formal`, which has its own academic layout in `cv-skeleton-academic.md`.

The skeleton is **style-independent at the section-set level**: the same sections exist for Nordic Minimal, Achievement-Driven, Measured Professional, and every other commercial style. What style controls:

- **Order** (which sections appear before others)
- **Placement** (sidebar vs main column)
- **Naming** (e.g. Selected Outcomes vs Key Achievements vs Recent Highlights, by style)
- **Section format** (paragraph, bullets, unicode bullets, hybrid, table-grid, structured-grid — per `style-matrix.md` `sectionFormatDefaults` and per-section overrides in `user_state.layoutPrefs.sectionFormats`)
- **Density** (line limits, char targets)

What the **package** controls (and the skill does not touch):

- Colours, fonts, photo shape, image size, glyph style. All come from `packages/registry.json` via CSS variables. The skill never emits hex codes or font names.

What the **user** controls (overrides):

- `user_state.layoutPrefs.sectionFormats.<section>` overrides the style's default
- `user_state.layoutPrefs.lineLimits.<section>` overrides density
- `user_state.layoutPrefs.targetPages` controls overall length budget

---

## Section keys and content

The JSON output uses these exact keys. Section keys are stable across styles and languages.

### Candidate header — contact line

Owner-locked rules (2026-06-12), applying to the CV header and the CL `cl_header.contacts`:

- **Location reads "2300, København S"** (postcode + district) — NOT "Copenhagen, Denmark", not "København, Danmark", and no country word. The PWA render layer normalizes Copenhagen-based locations to this form; the skill emits it directly.
- **LinkedIn renders as a clickable link**, never plain text (the export layer emits a real hyperlink).
- Order: location, citizenship (if present), email, phone, LinkedIn, website.

### `profile`

**Purpose.** Two to three sentences that answer "who is this person, what do they do, what do they care about — in the language of the role." Sets the frame for everything below.

**Source data.** `user_state.profile.summary` (free text the user wrote), plus the JD's signal about what to lead with.

**Length.** 280–380 characters for `target_pages` ≤ 1.5; up to 500 for longer formats. Honour `lineLimits.profile` when set.

**Format.** Almost always `paragraph`. `bullets` is a legitimate alternative for `cold-outreach` style or when the user explicitly sets it.

**Content rules.**
- Lead with role, not adjectives.
- One sentence on domain expertise. One sentence on operating mode (how they work). Optional third sentence on what's next.
- No banned words. No "work style" filler ("results-driven", "passionate about", "thrive in").
- Mention concrete domain nouns the JD also uses, but do not parrot the JD's phrasing.

**Opener-by-application-type (GEN-PROFILE-001, owner directive 2026-06-12).**
- **UNSOLICITED applications:** sentence 1 is the BROAD professional identity — "IT professional with 15+ years in consumer and regulated markets" (or a close variant). NEVER open with "Electro-optics and LiDAR architect" or any narrow specialist identity: an unsolicited reader has no JD anchoring the niche, and the broad opener keeps the door open across PM/product/engineering roles. The optics/EO depth moves to Selected Outcomes and the sidebar, not the headline. Sentences 2–3: hardware-software products concept→production (requirements, change control, validation, supplier coordination); recent GenAI product work (AntCV) when current and relevant.
- **JD-DRIVEN applications:** keep the JD-matched specialist opener (the forms below).

**Three-part PROFILE structure (PERSONALITY-KERNEL-001, owner 2026-06-12 — canonical
source `assets/gabriel-kernel-personality-v1.json`).** The profile renders three
sub-parts, in this order:

1. **Who I am** — 1–2 sentences. Unsolicited register: "IT professional/specialist
   with 15+ years around commercial and regulated markets and products." JD-driven
   register: the JD-matched specialist opener (per GEN-PROFILE-001 above).
2. **Body–mind** — 1 sentence on what gives energy / makes him happy. The word
   "passionate" stays BANNED even here; use "makes me happy" / "gives me energy".
   Canonical content: rugby at Copenhagen Wolves RFC — operations manager and
   assistant coach, with the Danish term **foreningsarbejde** kept in the English
   text; and building AntCV (a GenAI product designed, built, and shipped solo).
3. **Special capabilities** — carried by the Work style line. Underlying message,
   always: technical expert WITH human-reading skills and understanding of people —
   the combination is rare. Behaviour over adjectives; ONE personality-bearing
   sentence maximum (render_constraints).

**Personality render constraints** (apply wherever traits surface): traits feed
PHRASING and EVIDENCE selection — never a raw adjective list. NEVER render raw:
"people's person", "team player", "empathy", "moral", "reads the room". The
canonical Work style line (en/da) and the cover-letter Who-I-Am fragment live in
the personality JSON.

**Examples of opener forms that work** (style-agnostic, JD-driven):

- "Technical product manager with 15+ years across automotive LiDAR, electro-optical systems, and consulting."
- "Functional safety specialist focused on ISO 26262 and ASPICE assessments in automotive perception stacks."
- "Programme manager with hardware engineering roots, leading multi-vendor change governance in automotive supplier programmes."

### `core_competencies`

**Purpose.** A scannable map of where the candidate's expertise sits, mapped to the role's domains.

**Format.** Default `table-grid`: two columns, "Focus Area" → "Strategic Expertise". Style-specific defaults:

- `nordic-minimal`, `measured-professional`, `structured-professional`: `table-grid`
- `achievement-driven`, `cold-outreach`: `bullets` (each line "Focus area — expertise")
- `prestige-structured`, `precision-formal`: `structured-grid` (denser, three columns possible)
- `context-rich`: `bullets` with one-line narrative per item

**Row count.** 4–8 rows. Target the JD: pick focus areas that match the JD's stated requirements first, then user's strongest areas.

**Content rules.**
- Focus area: 1–3 words, role-domain language (e.g. "Functional safety", "Change governance", "System architecture").
- Strategic expertise: a phrase of **6–14 words**, **hard cap two lines per cell** (CV typography rule: table cells render at max 2 lines). The 4.94" table at the body font fits roughly **90 characters across two lines** in the expertise column — treat ~90 chars as the ceiling and cut to one tight clause, not two sentences. One angle per row, not a paragraph. Example (good, fits 2 lines): "ISO 26262 assessor; ran two ASPICE re-certifications." Example (TOO LONG, wraps to 4 lines — never do this): "Defined system-level requirements for automotive LiDAR, including optics, electronics, and embedded interfaces, and aligned architecture with ASPICE and ISO 26262 for traceability and reuse." If a row needs more than two lines to make its point, split it into two focus areas or drop the weaker half.
- No banned words. No "demonstrated ability to" / "proven track record".

### `selected_outcomes`

**Purpose.** Concrete results the candidate produced, framed as outcomes (not duties).

**Format.** Default `bullets`. Each bullet has a bold outcome title and a plain-text result body.

**Bullet count.** 3–5 for `target_pages` ≤ 1.5; up to 8 for longer.

**Content rules.**
- Title: an outcome, not a task. "Cut review cycles 40%" not "Led review process". "Closed two customer change requests under deadline" not "Managed change requests".
- **Lead with the number when one exists.** The candidate has confirmed, canonical metrics — use them in the title or first clause rather than writing a metric-free outcome. The confirmed set (never exceed or invent beyond these): change cycle **~250 → ~10 days** via the Change Control Board at Innoviz; LiDAR **cost reduction ~90% (≈10×)** via trade-off analysis + supplier coordination; **directed a 7-engineer EO team** at Sirin (verb: directed/supervised, never "led"); **15+ years** sensor/EO/systems experience; cross-functional coordination across **5+ domains/OEMs**; **Patent No. 241997**. A Selected Outcomes section that has access to these and ships without any of them is a defect (the metric is the whole point of the section).
- Body: 1–2 sentences explaining context, action, and the quantified result.
- **Never invent metrics.** If no concrete metric is in `user_state.profile.experiences[*]` or the canonical set above for this outcome, write the body without a number rather than fabricating one — but do not omit a number that IS on record.
- If `change_log_patterns` shows recurring `risk=invented` for this section under this role × style, prefer narrative outcomes over numeric ones until the pattern clears.

### `experience`

**Purpose.** Professional history, newest-first.

**Format.** Default `bullets`, three bullets per role. Each role is an object:

```json
{
  "company": "...",
  "role": "...",
  "years": "2020 — 2025",
  "location": "...",
  "format": "bullets",
  "items": ["...", "...", "..."]
}
```

**Role count.** Show every role from `user_state.profile.experiences` unless `target_pages = 1`. For `target_pages = 1`, show the most recent 3–4 roles and add `truncated: true` to the section metadata so the worker can flag the omission to the user.

**Overlapping-role resolution (GEN-ROLEFORM-001).** The kernel may deliberately hold the same employment in TWO forms: a single MERGED role and a SPLIT pair of distinct roles that cover the same employer and overlapping dates (e.g. Innoviz: a merged "System Architect & Change Control Lead, 2020–2025" vs. the split pair "System Architect & Change Control Lead, 2020–2025" + "Customer Change Requests Specialist, 2020–2025"). Both are valid source data. **Emit exactly ONE form per CV; never both.** For any set of kernel roles sharing the same `company` and an overlapping `years` span, choose before drafting bullets:
- Use the SPLIT pair (detail two positions, hide the merged) when the distinction adds signal the JD rewards — e.g. a change-governance or requirements role where calling out the Customer Change Requests specialism separately strengthens the match.
- Use the MERGED single role (hide the split pair) when brevity or seniority framing serves better — e.g. a senior PM/architecture role where one consolidated leadership entry reads stronger.
- NEVER emit the merged role AND its split components at once (the symptom: three overlapping blocks, two sharing the same dates).
Record the choice in the role's change_log entry (`reason: "roleform_merged"` or `"roleform_split"`).

**Military / dated-service inclusion (GEN-IDF-001).** A military-service entry (e.g. "Computer Administrator | IDF 2001–2003") is ~20+ years old. Default to OMIT it. Include it ONLY when (a) the JD explicitly values the content (IT/infrastructure, security clearance context), or (b) chronology would otherwise show an unexplained early-career gap. When included, keep it to the single most relevant bullet and never lead the section with it. Record `reason: "military_included_relevant"` or omit silently.

**Sub-role merging.** If `user_state.profile.experiences` shows two consecutive roles at the same company (e.g. an internal promotion), the skill may merge them into one entry with a date range and dual role line — but only if `style.sectionFormatDefaults.experience.mergePromotions === true`. By default styles keep them separate. (This is distinct from GEN-ROLEFORM-001 above: merging is for *consecutive promotions*; role-form resolution is for *pre-authored alternative representations of the same span*.)

**Bullet rules.**
- 3 bullets each, newest-first within the role.
- Lead each bullet with a verb in past tense (or present for current role).
- One bullet for scope (what was owned), one for action (what was done), one for outcome (what changed).
- **Team-management verb (VERB-LED-001).** When a bullet describes managing or running a team, use **directed**, **supervised**, or **ran** — NEVER the bare verb "led" (write "directed a 7-person EO team", never "led a 7-person team" or "led a team"). "led" remains fine for non-team objects ("led design reviews", "led prototype-to-production transfer"). The worker SCE also enforces this and will retry, but produce it correctly on the first pass.
- No banned words. No "responsible for".
- Length target: 12–22 words per bullet for `target_pages ≤ 1.5`; up to 30 for longer formats.

### `recommendations`

**Purpose.** A one-line references statement in the main column (owner addition, 2026-06-12). Not a list of named referees — a availability line.

**Format.** `paragraph`, single sentence.

**Content rules.**
- Default content: "Danish and international recommenders on request." (localized: da "Danske og internationale anbefalere oplyses på forespørgsel.", es "Recomendantes daneses e internacionales disponibles a petición.", zh "丹麦及国际推荐人可应要求提供。").
- Never name referees or their contact details in the CV itself.
- Placement (owner correction 2026-06-13): main column, immediately after the LAST of `experience` and any PROFESSIONAL EXPERTISE section — when an expertise block follows the work history, recommendations comes AFTER it, never between them.

### `tools_methods`

**Purpose.** Concrete tools, languages, frameworks, methodologies. Sidebar-placed in most styles.

**Format.** Default `structured-grid`: domain label (bold) → comma-separated list. Multiple groups.

**Example groupings.**
- Project & change: Jira, Confluence, ServiceNow, ASPICE, Six Sigma
- Engineering: Python, MATLAB, LabVIEW, COMSOL, Zemax
- Quality & risk: ISO 26262, FMEA, DFSS

**Content rules.**
- Tools listed are the user's actual tools from `user_state.profile.toolsMethods`. Do not invent.
- Group by domain, 3–6 items per group, 3–5 groups total.
- Tools the JD asks for and the user has → list first within their group.
- Tools the JD asks for and the user does not have → omit. Surface as a JD gap to the worker, which the PWA handles via the JD Gap Closure flow.

### `certifications`

**Purpose.** Formal credentials. Sidebar-placed.

**Format.** Default `bullets`. Each item is a single line: `Credential — Issuer (Year)`.

**Content rules.**
- Exact verbatim from `user_state.profile.certifications`. No paraphrasing.
- Order: most-relevant-to-JD first, then by recency.
- No "in progress" unless the user marks it so.

### `education`

**Purpose.** Degrees. Sidebar-placed unless `target_pages ≥ 3` (then main).

**Format.** Default `bullets`. Each item: `Degree, Field — Institution (Years)`.

**Content rules.**
- Newest-first. Include thesis title only if `target_pages ≥ 2` or `writing-style === research-formal` (academic skeleton handles that separately).
- Use the institution's most internationally-recognisable name (e.g. "Technion" not "Israel Institute of Technology").

### `publications_patents`

**Purpose.** Peer-reviewed publications, patents, conference talks. Sidebar by default; main column when long.

**Format.** Default `bullets`. Cited in a compact form: `Author(s) (Year). Title. Venue.`

**Inclusion rules.**
- Show all entries for `target_pages ≥ 2`.
- Show top 3 most-relevant + a "+N more" tail for `target_pages ≤ 1.5`.
- Omit entirely (section not rendered) when the user has none.
- **Patent numbers are never dropped** (owner rule, 2026-06-12). Every patent entry carries its number verbatim (e.g. `Patent US 9,876,543: …`); compressing a patent line keeps the number and trims elsewhere.

### `additional_information`

**Purpose.** Languages, volunteer roles, accessibility considerations, hobbies that signal cultural fit. Sidebar.

**Format.** Default `structured-grid` or `bullets`, depending on style.

**Content rules.**
- Languages: list with proficiency markers (e.g. "Native, Bilingual, Professional, Conversational"). Match the user's actual proficiency.
- Volunteer roles: title and organisation, no narrative.
- Hobbies: include only when they signal a relevant trait (e.g. "Rugby — Operations Manager, Copenhagen Wolves RFC" signals operations experience). Omit purely-personal hobbies for senior commercial roles.
- **Accessibility items state the impairment** (owner rule, 2026-06-12): when the user has an accessibility entry, the text says explicitly that the request concerns a hearing-impaired person — never an unspecified accommodation line.

---

## Style-level placement table

This is the default placement of each section by style. Worker reads this from `writingSystems/registry.json` `sectionOrder` and `mainSidebarPlacement` fields; this table is a quick reference.

| Section | nordic-minimal | achievement-driven | measured-professional | structured-professional | mediterranean-formal | prestige-structured | credential-forward | precision-formal | context-rich | cold-outreach | hybrid-balanced |
|---|---|---|---|---|---|---|---|---|---|---|---|
| profile | main 1 | main 1 | main 1 | main 1 | main 1 | main 1 | main 1 | main 1 | main 1 | main 1 | main 1 |
| core_competencies | main 2 | main 3 | main 2 | main 2 | main 2 | main 2 | main 2 | main 2 | main 3 | omit | user |
| selected_outcomes | main 3 | main 2 | main 3 | main 3 | main 3 | main 3 | main 3 | main 3 | main 2 | main 2 | user |
| experience | main 4 | main 4 | main 4 | main 4 | main 4 | main 4 | main 4 | main 4 | main 4 | main 3 | user |
| recommendations | main 5 | main 5 | main 5 | main 5 | main 5 | main 5 | main 5 | main 5 | main 5 | main 4 | user |
| tools_methods | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | omit | user |
| certifications | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | omit | user |
| education | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | user |
| publications_patents | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | omit | user |
| additional_information | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | sidebar | omit | user |

`hybrid-balanced` reads placement from `user_state.writingPrefs.hybridLayout` — user-defined.

---

## ATS export tiers

AntCV output is **always ATS-safe**. The question is which generation of ATS the target uses. The proxy worker selects one of two tiers when calling the skill:

| Tier | Targets | What changes |
|---|---|---|
| **ATS-Modern** (default) | Greenhouse, Lever, Ashby, Workday, SmartRecruiters, BambooHR, Teamtailor | Native two-column allowed (real Word columns, not tables-for-layout); photo retained; system fonts only; standard section headers; parser-safe table separators (hyphen: `" - "`) |
| **ATS-Legacy** | Taleo, iCIMS, SuccessFactors, symplr, Jobvite, Bullhorn, older Workday configurations | Single column; no photo; Calibri only; canonical section names; tables → bullets; glyphs → text |

There is no "Native, non-ATS" tier. Every AntCV export is at minimum ATS-Modern compatible — the design assumption is that even an email submission to a human reviewer should not fall apart if forwarded into an ATS downstream.

### Tier inference

The worker selects a tier based on, in order of priority:

1. **User explicit choice** — Settings → Export → ATS tier dropdown. Overrides everything below. The skill never silently downgrades a user's explicit choice.
2. **Named ATS or submission path in JD** — "apply via Workday" → Modern; "submit through iCIMS portal" → Legacy. This is a hard signal because it identifies the actual receiving system.
3. **Fallback** — Modern. The safest default given that modern parsers cover the majority of active hiring portals in May 2026.

**Industry and company signals are advisory only.** They do **not** auto-select a tier. The worker may surface a notice to the user — "this employer's industry typically uses legacy ATS; consider switching to ATS-Legacy" — but never overrides the user's choice or the default. See `AI_IMPLEMENTATION_GUIDE.md` § 3.2 for the advisory pattern.

### Per-tier content rules

#### ATS-Modern

- **Native two-column layout permitted** when implemented as proper Word `<w:cols>` section properties — never as tables-for-layout or text boxes. This is enforced by the visual worker downstream.
- **Tables remain parseable**: each row is a real Word table row (`<w:tr>`), with the first row marked as a header (`<w:tblHeader/>`). The parser-safe separator inside flattenable cells is the hyphen: `Focus Area - Strategic Expertise` (owner 2026-06-12: use `-`, never `—`). Never glyph-only separators.
- **Photo retained**: modern ATS parses around photos without breaking.
- **System fonts only**: Body font is per-package (Segoe UI for Copenhagen Modern and Delhi Technical, Cambria for Navy Executive, Palatino Linotype for Warm Terracotta and Pampas Contemporary, Verdana for Nordic Frost, Tahoma for Tokyo Precision — all Windows/Mac system fonts with 98 – 99% ATS-Modern parser safety, see `design-packages.md` § Font choices). Heading font is the package's defined heading font. Calibri is the override fallback if a user explicitly chooses it.
- **Standard section headers**: the style's per-section naming applies, but creative variants are normalised (e.g., "My Journey" → "Work Experience"). The style's `atsBehavior` field controls the mapping.
- **No icons next to headings**: glyph fields in `tools_methods` and `additional_information` render with text labels rather than ☎ / ✉ / 🔗 / ⌂.
- **Date formats consistent**: every section uses the same date format (e.g., "2020 - 2025"), avoiding mixed formats that lower the parser's timeline-confidence score.

#### ATS-Legacy

- **Single column**: every section renders in the main column. Sidebar content (`tools_methods`, `certifications`, `education`, `publications_patents`, `additional_information`) is appended to the main column in the same logical order, after `experience`.
- **No photo**: the `profile_photo` section is omitted entirely.
- **No tables for layout**: `core_competencies` becomes a bulleted list of `Focus area - Expertise` lines. `what_i_bring` in cover letters becomes bullets. The skill emits `format: "bullets"` for what would otherwise be `table-grid`, `structured-grid`, or any `hybrid-*` variant.
- **Canonical section headers only**: per-style naming is overridden. The canonical set is `Summary` (from Profile), `Skills` (from Core Competencies), `Achievements` (from Selected Outcomes), `Work Experience` (from Experience), `Education`, `Certifications`, `Publications`, `Additional Information`.
- **Calibri throughout**: no per-package heading font.
- **Glyph-free**: unicode bullets, decorative dividers, icon labels become text equivalents (☎ → "Phone:", ✉ → "Email:", 🔗 → "LinkedIn:", ⌂ → "Location:").
- **DOCX preferred export format**: the worker recommends DOCX over PDF when Legacy is selected, since legacy parsers historically handle DOCX more reliably.

### Format mapping at the JSON level

The `sections` object always contains the same section keys regardless of tier. What changes is the `format` field and the visual hints. Example: `core_competencies` in Modern vs Legacy:

Modern:
```json
{ "core_competencies": {
    "format": "table-grid",
    "parser_safe_separator": "hyphen",
    "rows": [
      { "focus_area": "Functional safety", "expertise": "ISO 26262 assessor, two re-certifications" },
      { "focus_area": "Change governance", "expertise": "Multi-vendor change boards, ASPICE" }
    ]
}}
```

Legacy:
```json
{ "core_competencies": {
    "format": "bullets",
    "items": [
      "Functional safety — ISO 26262 assessor, two re-certifications",
      "Change governance — Multi-vendor change boards, ASPICE"
    ]
}}
```

### Per-tier format matrix

| Section | ATS-Modern | ATS-Legacy |
|---|---|---|
| `profile` | `paragraph` | `paragraph` (header → "Summary") |
| `core_competencies` | `table-grid` w/ em-dash separators | `bullets` |
| `selected_outcomes` | `bullets` | `bullets` (header → "Achievements") |
| `experience` | `bullets` | `bullets` (header → "Work Experience") |
| `tools_methods` | `structured-grid` | `bullets` grouped by domain in text |
| `certifications` | `bullets` | `bullets` |
| `education` | `bullets` | `bullets` |
| `publications_patents` | `bullets` | `bullets` |
| `additional_information` | `structured-grid` or `bullets` | `bullets` |
| Photo | included | omitted |
| Sidebar placement | per style | all main column |
| Decorative dividers | minimal | none |
| Glyphs | text equivalents | text equivalents |

### When the worker requests a tier the skill considers suboptimal

The skill does not refuse. It produces compliant output and emits a `change_log_proposals` entry with `confidence: medium`, `risk: too-generic` or `overstated` depending on what was lost, and a `reason` explaining the tradeoff (e.g., `"ats_legacy_flattening_lost_core_competencies_table_structure"`). The user sees both the output and the flag.

### Adoption reality (May 2026 market)

Per the ATS adoption survey informing this design:

- 98% of Fortune 500 companies use some ATS; 92% rank rather than auto-reject (modern systems).
- Tech, SaaS, modern finance, growth-stage companies → modern parsers dominate; ATS-Modern fits.
- Healthcare, government, US state and federal defense contractors → iCIMS, Taleo, symplr still widely deployed. Industry signal warrants surfacing a Legacy recommendation to the user.
- Large finance varies; Workday is common with both modern and conservatively-configured deployments. Without portal-level evidence, Modern is the safer assumption.
- Small and mid-size traditional businesses with no clear ATS reference → still default Modern. The output is ATS-Modern compatible and also reads cleanly to a human reviewer.

---

## Cross-references

- `cv-skeleton-academic.md` — Research Formal layout (different sections).
- `cl-skeleton.md` — cover letter structure.
- `style-matrix.md` — per-style configuration values.
- `styles/{name}.md` — per-style content rules.
- `output-schema.md` — JSON output shape.
