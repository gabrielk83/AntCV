# CV Skeleton — Academic (Research Formal)

The canonical section set for academic CVs in AntCV. Used by the `research-formal` writing style and by any commercial style when the worker passes `target_use_case=academic` (e.g. industry-research hybrid roles at corporate labs, FFEs at applied-research institutes).

The academic skeleton differs from the commercial skeleton in section set, ordering, and length budget — not in the (writing × package) independence rule, which still holds.

**Length budget.** 2–5 pages depending on career stage. PhD applicants target 2–3 pages; postdoc applicants 3–4; faculty/PI applicants 4–5+. Honour `target_pages` strictly; the academic engine permits up to 5.

**ATS in academia.** Most academic application systems (Interfolio, AcademicJobsOnline, institutional portals) parse less aggressively than commercial ATS, but every academic CV export is still at minimum ATS-Modern compatible. Two tiers: ATS-Modern (default) and ATS-Legacy (only when the user explicitly names a legacy system). See § ATS handling for academia for the per-tier rules.

---

## Career-stage variants

The same section keys are used, but priority and inclusion shift. The worker passes `career_stage` (one of `phd_applicant`, `phd_candidate`, `postdoc`, `early_faculty`, `senior_faculty`) derived from `user_state.profile.careerStage`. The skill adjusts emphasis accordingly.

| Section | phd_applicant | phd_candidate | postdoc | early_faculty | senior_faculty |
|---|---|---|---|---|---|
| `research_summary` | required | required | required | required | required |
| `education` | top priority | top priority | high | high | medium |
| `research_experience` | MSc + undergrad projects | thesis + side projects | postdoc + PhD work | all positions | all positions |
| `publications` | optional, if any from MSc | required, may be few | required, central | required, central | required, lead with selected |
| `selected_research_outcomes` | optional | recommended | required | required | required |
| `teaching_supervision` | optional, if TA experience | TA + tutoring | TA + co-supervision | required | required, lead recent |
| `grants_fellowships` | scholarships, awards | scholarships, travel grants | postdoc fellowships | startup, externally-funded | required |
| `conferences_talks` | posters, departmental talks | conference talks, posters | invited + contributed | invited + plenary | required |
| `technical_methods` | required (lab/computational) | required | required | optional | optional |
| `industry_experience` | if any, relevant projects only | de-emphasised | omit unless relevant | omit | omit |
| `professional_service` | optional (review experience) | reviewer roles | reviewer + committee | required | required, lead editorial |
| `references` | required (3 referees) | required | required | optional | optional |

---

## Section keys and content

### `research_summary`

**Purpose.** A statement of research interests, current focus, and trajectory. Longer and more substantive than the commercial `profile` — this is the section the search committee reads first.

**Source data.** `user_state.profile.researchSummary` (free text). For PhD applicants, often called the "research interests" or "statement of purpose summary".

**Length.** Three to four sentences for PhD applicants (~400–550 chars). Two to three paragraphs for postdoc and beyond (~600–1200 chars).

**Format.** `paragraph`. Bullets are not used here.

**Content rules.**
- First sentence: domain and methodological frame.
- Second sentence: specific research questions or topics.
- Third sentence: technique or methodology that distinguishes the candidate.
- Fourth sentence (optional, postdoc+): how this connects to the target lab / institution / call.
- Cite specific subfields, not generic disciplines: "mid-infrared photonics" not "photonics", "flexible microelectronics" not "microelectronics".
- No commercial-CV filler ("passionate about", "driven by curiosity"). Academic readers find these distracting.

### `education`

**Purpose.** Degrees, institutions, advisors, thesis titles. The most-scanned academic-CV section.

**Format.** `bullets`, newest-first. Each entry is structured:

```json
{
  "degree": "Ph.D., Electrical Engineering",
  "institution": "Technical University of Denmark",
  "department": "DTU Nanolab",
  "years": "2025 — 2029 (expected)",
  "advisor": "Prof. ...",
  "thesis_title": "...",
  "co_advisors": ["Prof. ..."],
  "notes": "Awarded full DTU scholarship"
}
```

**Inclusion rules.**
- Always include thesis title for completed/in-progress PhDs.
- Include thesis title for MSc when `career_stage` is `phd_applicant` or `phd_candidate`; omit for postdoc+ unless directly relevant to target role.
- Advisor names always for PhD; for MSc when known and relevant.
- Honors (cum laude, summa, distinction, university medals) listed under `notes`.

**Order rule.** Strictly reverse-chronological. Even at faculty level, do not promote the PhD above the most recent degree-equivalent (habilitation, etc.).

### `research_experience`

**Purpose.** Research positions, lab affiliations, project roles. Distinct from `industry_experience` because the framing is research output, not commercial deliverables.

**Format.** Default `bullets`. Each entry is a position:

```json
{
  "role": "Postdoctoral Researcher",
  "lab_or_pi": "Garcia Group",
  "institution": "ETH Zürich",
  "years": "2022 — 2024",
  "format": "bullets",
  "items": [
    "Led project on X, resulting in Y publication and Z patent application.",
    "Supervised two MSc students on related computational work.",
    "Built experimental setup for [specific technique], now used by three downstream projects."
  ]
}
```

**Bullet rules.**
- 2–4 bullets per position, more for substantive postdocs and faculty roles.
- Lead with the research question or technique, not the title.
- Include collaborations and supervised students inline; surface them again in `teaching_supervision` only when they were the candidate's primary teaching.
- Quantify when honest: numbers of students, datasets analysed, samples fabricated, software releases. **Never invent.**
- For PhD applicants: include MSc thesis project, undergraduate research, summer fellowships. Each as its own entry.

### `publications`

**Purpose.** The candidate's research output as the field counts it. In academia, this is the single most-scrutinised section.

**Format.** Default `structured-grid` grouped by type (journal, conference, preprint, book chapter, patent). Within each group, reverse-chronological.

Each entry:

```json
{
  "type": "journal",
  "authors": "Karp-Gershon, G., Other, A., Lastauthor, P.",
  "year": 2018,
  "title": "...",
  "venue": "Optics Letters",
  "volume_issue_pages": "43(12), 2871–2874",
  "doi": "10.1364/OL.43.002871",
  "candidate_role": "first author"
}
```

**Inclusion rules.**
- Every peer-reviewed publication when `target_pages ≥ 3`. For tighter budgets, include all if total count ≤ 8, otherwise show the top 6 + "+N more publications available".
- Preprints and under-review work clearly labelled.
- Patents listed in their own subgroup with patent number, jurisdiction, status (granted / pending / abandoned).
- Conference papers separated from journals.
- **Highlight first/last author** when displayed (the worker handles the boldface; the skill marks `candidate_role`).

**Content rules.**
- Verbatim from `user_state.profile.publications`. Do not paraphrase titles. Do not invent venues.
- If a publication is not in the kernel and the user references it in a JD Gap Closure claim, **do not add it to this section**. Treat as a JD Gap Claim and leave the publication out until the user adds it to the kernel.

### `selected_research_outcomes`

**Purpose.** Highlights of research impact framed as outcomes, parallel to commercial `selected_outcomes` but research-oriented.

**Format.** Default `bullets`. Each bullet has a bold outcome title and a 1–2 sentence body.

**Bullet count.** 3–5 for `target_pages ≤ 3`; up to 8 for longer.

**Content rules.**
- Outcomes are research-meaningful: a published method, a technique made open-source, a patent licensed, a dataset released, a hire or award resulting from the work.
- Title is an outcome, not a topic: "Developed open-source Zemax module adopted by 12 labs" not "Optical simulation work".
- Body explains scope and impact. Quantify where possible.
- Acceptable bullet types: methodology contribution, software/dataset release, citation impact, downstream usage, collaboration outcomes, awards tied to specific work.

### `teaching_supervision`

**Purpose.** Teaching record and supervision of students. For early-faculty and senior-faculty, this is essential.

**Format.** Default `structured-grid`, two subgroups: courses taught, students supervised.

Course entries:

```json
{
  "course_code": "EE-2031",
  "course_title": "Semiconductor Physics",
  "institution": "...",
  "years": "2020, 2021, 2022",
  "role": "Lead instructor",
  "level": "undergraduate"
}
```

Supervision entries:

```json
{
  "student_name": "...",
  "level": "MSc",
  "thesis_title": "...",
  "years": "2022 — 2024",
  "role": "primary advisor",
  "outcome": "thesis submitted; first-author publication in Optics Express"
}
```

**Content rules.**
- For PhD applicants and candidates: include TA assignments, tutoring, course development if any.
- For postdoc and beyond: foreground primary-advisor supervisions; include co-supervisions; list courses with role clarity (lead instructor vs co-instructor vs TA).
- Names of students may be omitted at the user's discretion (`user_state.privacy.includeStudentNames === false`).

### `grants_fellowships`

**Purpose.** Awarded funding and named fellowships. Critical for faculty applications.

**Format.** Default `bullets`. Each entry:

```json
{
  "name": "Marie Skłodowska-Curie Postdoctoral Fellowship",
  "funder": "European Commission",
  "amount_eur": 200000,
  "years": "2023 — 2025",
  "role": "Principal Investigator",
  "status": "awarded"
}
```

**Inclusion rules.**
- Every awarded grant or fellowship.
- Declined offers from competitive sources may be included with `status: "declined"` if notable.
- Pending applications excluded by default; user can opt to include with `status: "under review"`.
- Amounts in EUR by default; secondary currency in `notes` if relevant.

### `conferences_talks`

**Purpose.** Conference participation as a research-community signal.

**Format.** Default `bullets` grouped by type: invited talks, contributed talks, posters.

Each entry:

```json
{
  "type": "invited talk",
  "title": "...",
  "venue": "European Optical Society Annual Meeting",
  "city": "...",
  "year": 2024
}
```

**Inclusion rules.**
- Invited talks always.
- Contributed talks and posters: all when `target_pages ≥ 4`; selected (most prestigious or recent) for tighter budgets.
- Plenary, keynote, named lectures explicitly labelled in `type`.

### `technical_methods`

**Purpose.** Laboratory, computational, and analytical methods the candidate has hands-on experience with.

**Format.** Default `structured-grid` grouped by domain.

**Example groupings.**
- Fabrication: cleanroom (Class 100), photolithography, e-beam lithography, plasma etching
- Characterisation: SEM, AFM, ellipsometry, FTIR, Raman, X-ray diffraction
- Computational: FDTD, FEM (COMSOL), ray-tracing (Zemax), Python (NumPy, SciPy), MATLAB
- Analytical: statistical inference, time-series analysis, image processing

**Content rules.**
- Verbatim from `user_state.profile.technicalMethods`. Do not invent capability claims.
- Group by domain, 4–8 items per group, 3–5 groups.
- Mark methods specifically called out in the JD with first-position placement in their group.

### `industry_experience`

**Purpose.** Non-research professional positions. Often included for hybrid academic-industry roles or when the candidate has substantive industry background relevant to the target position.

**Format.** Same shape as commercial `experience`, but reduced bullet count (2 bullets per role) and framed for academic readers.

**Inclusion rules.**
- `phd_applicant` and `phd_candidate`: include if directly research-relevant; omit otherwise.
- `postdoc`, `early_faculty`, `senior_faculty`: omit unless industry experience is directly tied to research programme.
- When included, frame outcomes in research-translatable language: "Built optical metrology system later cited in three peer-reviewed publications" not "Drove revenue growth".

### `professional_service`

**Purpose.** Peer review, editorial roles, committee work, mentoring outside of formal supervision.

**Format.** Default `bullets` grouped by type: review, editorial, committees, mentoring.

**Inclusion rules.**
- Reviewer for journals: list journal names, optionally with frequency.
- Editorial boards: title and term.
- Conference committees: name and role.
- University service: department, university, professional society committees.
- Outreach and mentoring outside formal supervision lists.

### `references`

**Purpose.** Names of referees the search committee may contact. Required for most academic applications below faculty rank.

**Format.** `bullets`. Each entry:

```json
{
  "name": "Prof. ...",
  "title": "Full Professor",
  "institution": "...",
  "department": "...",
  "email": "...",
  "relationship": "PhD advisor"
}
```

**Inclusion rules.**
- Three referees is standard. The user controls who appears via `user_state.profile.referees`.
- Email addresses only when the referee has consented (`user_state.profile.referees[*].consented_to_share === true`).
- For `senior_faculty` applications, references may be requested separately by the institution; if `user_state.profile.referencesOnRequest === true`, render the section with the single line "References furnished on request."

### `work_style` (optional)

**Purpose.** A short section on research approach — collaboration style, mentoring philosophy, lab culture. Some fields include this, others find it self-promotional.

**Inclusion rules.**
- Default: omit. Include only when `user_state.profile.includeWorkStyle === true`.
- Two to three sentences maximum.
- Concrete framings only: "I prefer weekly one-on-ones with students" not "I am a supportive mentor".

---

## Section ordering by career stage

The `research-formal` style sets default ordering; the worker reads from `writingSystems/registry.json` `sectionOrder`. This table is a quick reference.

| Stage | Default main-column order |
|---|---|
| `phd_applicant` | research_summary → education → research_experience → technical_methods → publications → selected_research_outcomes → teaching_supervision → grants_fellowships → conferences_talks → professional_service → references |
| `phd_candidate` | research_summary → education → research_experience → publications → selected_research_outcomes → teaching_supervision → conferences_talks → technical_methods → grants_fellowships → professional_service → references |
| `postdoc` | research_summary → education → research_experience → publications → selected_research_outcomes → grants_fellowships → conferences_talks → teaching_supervision → technical_methods → professional_service → references |
| `early_faculty` | research_summary → research_experience → publications → grants_fellowships → selected_research_outcomes → teaching_supervision → conferences_talks → professional_service → education → technical_methods → industry_experience |
| `senior_faculty` | research_summary → selected_research_outcomes → publications → grants_fellowships → research_experience → teaching_supervision → conferences_talks → professional_service → education |

`industry_experience` appears in the order only when present; otherwise omitted. `work_style` always last when present.

---

## Sidebar usage in academic mode

Academic CVs are typically single-column or have a narrower sidebar than commercial CVs. The worker's Layout + Section Engine handles placement; the skill produces content as if for a single column. When the active package supports a sidebar (Copenhagen Modern, Delhi Technical, Nordic Frost), the Layout Engine moves a small set of sections to the sidebar:

- `references` (when included)
- `technical_methods` (when short — under 4 groups)

All other sections stay in the main column regardless of package.

---

## (Writing × Package) interactions in academic mode

Independence rule still holds (per locked-source plan §4.1). The active package changes only visual rendering — colours, fonts, photo shape. It does not change the section set, ordering, naming, or content.

Practical pairings (soft, not enforced):

- **Copenhagen Modern + research-formal**: the most-common pairing for European academic applications. Calibri body works well at the density academic CVs require.
- **Delhi Technical + research-formal**: appropriate for engineering and applied-science applications. Hexagon photo shape unconventional for academia; consider Square in Settings.
- **Tokyo Precision + research-formal**: dense layout pairs with publication-heavy CVs. 90 px image leaves more main-column space.
- **Warm Terracotta + research-formal**: Georgia body font is unusual for science applications but common in humanities. Note this in user-facing guidance if implementing UI nudges.

These are recommendations, not constraints. Any of the 7 packages × `research-formal` is a valid combination.

---

## ATS handling for academia (tiered)

Academic ATS adoption is less uniform than commercial. The same two-tier model applies: **ATS-Modern** (default) and **ATS-Legacy**. There is no separate "Native" tier — every academic CV export is at minimum ATS-Modern compatible, so that a search committee reading the PDF and a downstream parser both get usable content.

| Tier | Academic targets | When selected |
|---|---|---|
| **ATS-Modern** (default) | Interfolio, AcademicJobsOnline, ETH/MPI/equivalent modern academic portals, direct PDF to a search committee | Default; covers most academic submission paths |
| **ATS-Legacy** | Older Taleo / iCIMS deployments common in US state schools and large healthcare-affiliated universities | When the user explicitly names a legacy system or selects it manually |

The worker only switches to Legacy when there is a hard signal (named system, user choice). Industry-level signals about US state schools or specific institutional reputations are advisory — surfaced to the user via the PWA, never auto-applied.

### Why Modern is the academic default

Academic submissions today fall into three patterns, and ATS-Modern serves all three:

- **Interfolio / AcademicJobsOnline portals**: modern parsers, structured data extraction, handle two-column layouts and photos.
- **Direct PDF to a search committee**: ATS-Modern's choices (Calibri body, parser-safe tables, system fonts) read perfectly well to a human reader. The visual richness lost relative to a fully-unconstrained design is marginal compared to the safety gain if the PDF is later forwarded into an ATS.
- **Institutional career portals**: most are modern enough to handle ATS-Modern content; the few that are legacy enough to warrant Legacy are typically identifiable by URL or naming.

### Academic-specific flattening rules

The base ATS-Modern rules from the commercial skeleton apply. In addition, when generating an academic CV in either tier:

- **`publications`** retains type grouping in Modern (Journal, Conference, Preprint, Patent as separate sub-blocks). In Legacy, flattens to a single flat list with type prefixes — `[Journal]`, `[Conference]`, `[Preprint]`, `[Patent]`. Highlighting of first/last authorship moves from boldface (Modern) to a parenthetical `(first author)` (Legacy).
- **`references`** renders as plain text with line breaks between referees in both tiers. Contact info on its own line per referee. In Legacy, the section may become "Available on request" unless explicitly named.
- **`grants_fellowships`** keeps structured per-grant blocks in Modern. Flattens to `Name — Funder — Year — Amount` per line in Legacy.
- **`teaching_supervision`** keeps internal courses/students subgrouping in Modern. Flattens to `Role — Course or Student — Year` lines in Legacy.
- **`education`** keeps thesis title as a sub-element in Modern. Inlines as `Ph.D., Electrical Engineering — Technical University of Denmark (2025—2029). Thesis: "…". Advisor: Prof. …` in Legacy.
- **`conferences_talks`** keeps invited/contributed/posters subgrouping in Modern. Flattens to a single flat list with type prefixes in Legacy.

### When `target_ats_tier === 'legacy'` for academia

Additional restrictions on top of the base Legacy rules:

- Photo suppressed even though academic CVs in Europe often include one.
- All section names use the most-standard form: "Research Summary" → "Summary"; "Research Experience" stays; "Selected Research Outcomes" → "Selected Achievements"; "Teaching and Supervision" → "Teaching".
- `references` becomes "Available on request" unless explicitly named by the user.
- Plenary, keynote, and named-lecture distinctions in `conferences_talks` survive only as text prefixes, not as visual emphasis.

### Tradeoff flag

If Legacy is selected on a Research Formal CV with substantial publication output, the skill emits a change_log entry with `confidence: medium`, `risk: too-generic`, `reason: "ats_legacy_flattened_publication_grouping"`. The user sees both the flattened output and a note that the receiving system may not preserve the structure that academic readers expect.

---

## Cross-references

- `cv-skeleton.md` — commercial CV section set.
- `cl-skeleton.md` — cover letter structure (mostly used for industry roles; academic cover letters follow institution-specific templates).
- `style-matrix.md` — `research-formal` style row.
- `styles/research-formal.md` — style-specific content rules.
- `design-packages.md` — the 7 packages and the independence contract.
- `output-schema.md` — JSON output shape with academic section keys.
