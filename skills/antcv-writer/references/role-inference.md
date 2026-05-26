# Role Inference

Convert a JD's free text into the three canonical fields the skill and worker use throughout the pipeline: **`role_slug`**, **`career_stage`** (academic only), and **`commercial_seniority`** (commercial / cold-outreach / hybrid only).

The worker calls a small classifier (regex pipeline + optional LLM fallback) and surfaces the inferred values to the user via the PWA before generation. The user can confirm or override. All overrides are logged as `role_inference.user_override` events to improve future inference.

---

## Dimension 1 — `role_slug`

The canonical, normalised identifier for the role. Used as the partition key for analytics, change-log patterns, and `role-summary` aggregates.

### Format rules

- Lowercase.
- Hyphen-separated, no spaces.
- Role-only — strip seniority, company, level adjective (II / III / IV), location.
- One or two words. Three only if the role is genuinely a multi-domain hybrid.
- Drop fluffy qualifiers ("Strategy" / "Operations" / "Excellence") unless they identify a true sub-domain that the role's analytics should partition by.

### Inference signals

1. JD title is usually in the heading or first sentence. Take it.
2. Strip seniority qualifiers: Junior / Associate / Mid / Senior / Sr / Lead / Principal / Staff / Director / Head of / VP / Vice President / Chief / C-level.
3. Strip company names and location: "— Maersk", "(Copenhagen)", "@ Innoviz".
4. Strip level numerals: II, III, IV, 1, 2, 3.
5. Normalise: lowercase, replace spaces with hyphens, drop punctuation.
6. Collapse multi-word descriptors where possible: "Programme / Program Manager" → "programme-manager"; "Quality Assurance" → "qa" or "quality-assurance" depending on conventional usage in the field.

### When multiple roles appear in one JD

Some JDs list paired roles ("Product Manager / Project Manager") or a primary plus secondary ("Senior Business Analyst with Project Coordination"). Rules:

- If the JD treats them as alternatives, take the primary (usually first-listed).
- If the JD treats them as a fused role, use a hyphenated combined slug ("product-project-manager") only if the combined form is a recognised role in the field. Otherwise pick the dominant one.

### Failure mode

If the JD has no clear role title (e.g., heading is the company name, body is generic), use `misc`. The skill emits a change_log entry with `confidence: low`, `risk: too-generic`, `reason: "role_slug_could_not_be_inferred"`.

### Examples (from real recent applications)

| JD heading | Inferred role_slug |
|---|---|
| "Product Manager — Dalux" | `product-manager` |
| "Project Manager, Transformation Office — Banking Circle" | `project-manager` |
| "Senior Business Analyst — Banking Circle" | `business-analyst` |
| "Senior System Engineer — GE HealthCare" | `system-engineer` |
| "Senior Director Portfolio Management — Danfoss" | `portfolio-management` |
| "Functional Safety Specialist — Danfoss" | `functional-safety` |
| "Senior Engineer Hardware — Trackman" | `hardware-engineer` |
| "Technical Programme Manager — LEGO" | `programme-manager` |
| "Product Manager — Maersk" | `product-manager` |
| "PhD scholarship in flexible microelectronics — DTU Nanolab" | `microelectronics-research` |
| "PhD scholarship in mid-infrared photonics — DTU Nanolab" | `photonics-research` |

---

## Dimension 2 — `career_stage`

Applies when `target_use_case === "academic"` or `writing_style === "research-formal"`. Drives the academic-skeleton section set and ordering. See `cv-skeleton-academic.md` § Section ordering by career stage.

### Canonical values

- `phd_applicant` — applying TO a PhD program. No PhD yet.
- `phd_candidate` — currently in a PhD program, applying to internships / fellowships / lab positions during candidacy.
- `postdoc` — postdoctoral researcher, applying to postdoc positions or first faculty positions.
- `early_faculty` — assistant professor / junior PI / tenure-track, < 7 years post-PhD.
- `senior_faculty` — associate / full professor, established PI, 7+ years post-PhD or with tenure.

### Inference signals from the JD

The JD describes the **target** career stage (what the position offers). Mapping:

| JD phrase | Inferred career_stage of position |
|---|---|
| "PhD scholarship" / "PhD position" / "doctoral candidate position" | position is for `phd_applicant` |
| "Postdoctoral researcher" / "postdoc" / "research fellow (PhD required)" | position is for `postdoc` |
| "Assistant Professor" / "tenure-track" / "junior PI" | position is for `early_faculty` |
| "Associate Professor" / "Full Professor" / "Senior Lecturer" / "Reader" (UK) | position is for `senior_faculty` |
| "Research Engineer (PhD optional)" | position bridges — usually `postdoc` |

### Inference signals from the user (candidate's actual stage)

The skill also infers the candidate's current stage from `user_state.profile.experiences` and `education`. This matters when the candidate is applying "upward" (e.g., PhD candidate applying for a postdoc) — the skeleton needs to surface PhD work appropriately.

| Candidate has | Candidate's inferred career_stage |
|---|---|
| Bachelor's / Master's only, no PhD | `phd_applicant` |
| PhD in progress, no defended thesis | `phd_candidate` |
| Defended PhD, current postdoc | `postdoc` |
| Defended PhD, current faculty position < 7 years | `early_faculty` |
| Defended PhD, current faculty position ≥ 7 years or tenured | `senior_faculty` |

The pair (position's stage, candidate's stage) gives the worker enough to pick the right skeleton variant and surface appropriate emphasis.

### Failure mode

If ambiguous, default to `postdoc` (the most common academic application). Surface to user for confirmation. Log `confidence: medium`.

### Examples

| JD | Position career_stage |
|---|---|
| "PhD scholarship in flexible microelectronics — DTU Nanolab" | `phd_applicant` |
| "Postdoctoral Position in Mid-Infrared Photonics — DTU Nanolab" | `postdoc` |
| "Assistant Professor, Department of Photonics — Aalborg University" | `early_faculty` |
| "Senior Research Scientist (PhD required) — Innoviz Tech" | `postdoc` (industry research role; equivalent grade) |

---

## Dimension 3 — `commercial_seniority`

Applies when `target_use_case` is `commercial`, `cold-outreach`, or `hybrid`. Drives content emphasis (bullet count, scope claims, leadership signals, team size mentions) but does NOT drive writing style — style is independent of seniority and chosen separately.

### Canonical values

- `intern` — internship, traineeship, work-study.
- `junior` — entry-level (0 – 2 years), graduate programs, associate roles.
- `mid` — 2 – 7 years, no explicit seniority qualifier in the title.
- `senior` — 8 – 12 years typical, "Senior X" or "Sr. X" titles.
- `lead` — Lead / Principal / Staff levels; senior individual contributor or small team lead.
- `director` — Director / Head of; manages managers or a large function.
- `vp` — Vice President / SVP / Group Director.
- `c-level` — Chief X Officer (CEO, CTO, CFO, COO, CMO, CISO, CPO, etc.).

### Inference signals from the JD title

Primary signal — the title itself:

| JD title fragment | Inferred commercial_seniority |
|---|---|
| "Intern" / "Trainee" / "Working student" | `intern` |
| "Junior X" / "Associate X" / "X Trainee" / "Graduate X" / "Entry-level X" | `junior` |
| Plain "X" (no qualifier) / "X Specialist" | `mid` |
| "Senior X" / "Sr. X" | `senior` |
| "Lead X" / "Principal X" / "Staff X" | `lead` |
| "Director of X" / "Head of X" / "X Director" | `director` |
| "VP of X" / "Vice President X" / "SVP X" | `vp` |
| "Chief X Officer" / "C-level X" | `c-level` |

### Inference signals from the JD body

Secondary signal — years-of-experience requirement:

| YoE requirement | Inferred commercial_seniority (when title is ambiguous) |
|---|---|
| "Entry-level" / no YoE mentioned for entry roles | `intern` or `junior` |
| 0 – 2 years | `junior` |
| 2 – 4 years | `mid` (lower end) |
| 4 – 7 years | `mid` (upper end) |
| 7 – 12 years | `senior` |
| 12+ years | `lead` or `director` depending on team-management language |
| 15+ years with P&L responsibility | `director` or `vp` |
| Founder / co-founder language | `c-level` |

### Tie-breaker: team-management signals

When YoE is ambiguous, "manage / lead a team of N", "report directly to the CEO", "P&L of $XM", "manages X direct reports" all suggest `director` or higher. Lack of management language with high YoE suggests `lead` (senior IC track).

### Why seniority matters for the skill

- **Bullet count and scope** — junior CVs have shorter experience bullets; director+ CVs use longer, scope-heavy bullets.
- **Team-size mentions** — only relevant at lead+ and especially director+.
- **Ownership claims** — junior content avoids "led" / "owned"; senior+ uses these regularly; director+ uses scope-heavy verbs ("set strategy for", "scaled team from X to Y", "established the function").
- **Selected Outcomes density** — junior may have 2 – 3 outcomes; director+ may need 6 – 8 to substantiate the level.
- **Profile length** — junior 280–380 chars; senior+ can run 400–500 chars; director+ 500–650.
- **JD-driven style switches** — director+ JDs often benefit from Achievement-Driven or Measured Professional; intern/junior JDs from Cold Outreach or Nordic Minimal. The skill surfaces this as a soft nudge per `design-packages.md` § Recommended pairings, never as an override.

### Failure mode

If the JD provides no clear seniority signal and YoE is unspecified, default to `mid`. Log `confidence: low`. The PWA shows the inference and asks the user to confirm.

### Examples

| JD heading + body | Inferred commercial_seniority |
|---|---|
| "Product Manager — Dalux" (no qualifier, 3 – 5 years experience) | `mid` |
| "Senior Director Portfolio Management — Danfoss" (15+ years) | `director` (Senior Director collapses) |
| "Senior Business Analyst — Banking Circle" (5+ years) | `senior` |
| "Functional Safety Specialist — Danfoss" (3 – 5 years) | `mid` |
| "Senior Engineer Hardware — Trackman" (7+ years) | `senior` |
| "Technical Programme Manager — LEGO" (8+ years) | `mid` (upper end) or `senior` — disambiguate via YoE in body |
| "Project Manager, Transformation Office — Banking Circle" (5+ years) | `senior` (Transformation Office context implies higher) |
| "VP of Engineering" (15+ years) | `vp` |

---

## How the three dimensions interact

The dimensions partition cleanly:

- `target_use_case === "academic"` → use `role_slug` + `career_stage`. Ignore `commercial_seniority`.
- `target_use_case === "commercial" / "cold-outreach" / "hybrid"` → use `role_slug` + `commercial_seniority`. Ignore `career_stage`.
- `target_use_case === "hybrid"` (industry-academic hybrid roles, e.g., applied research at a corporate lab) → may need both. The skill defaults to commercial unless the candidate's own kernel signals an academic emphasis.

---

## Worker implementation notes

The three inference steps can run as one combined LLM call to a small fast model (claude-haiku-4-5 or similar), with the JD text as input and a JSON output of the three values plus per-dimension confidence:

```json
{
  "role_slug": "product-manager",
  "role_slug_confidence": "high",
  "career_stage": null,
  "career_stage_confidence": "n/a",
  "commercial_seniority": "senior",
  "commercial_seniority_confidence": "medium",
  "target_use_case": "commercial",
  "target_use_case_confidence": "high"
}
```

Total call: < 500 ms. Cost: negligible. Run on every new JD; cache by `jd_hash` so subsequent generations against the same JD skip the call.

For a pure regex pipeline (no LLM), `role_slug` and `commercial_seniority` are reliably inferred from the title alone; `career_stage` and `target_use_case` benefit from semantic understanding and warrant the LLM step.

---

## User override flow

PWA surfaces the inferred values before generation:

```
We see this JD as:
  Role: Product Manager (product-manager)
  Seniority: Senior        [confirm / change]
  Use case: Commercial     [confirm / change]
```

User confirms by hitting Generate; overrides by clicking change and picking from a dropdown of canonical values. Override emits a `role_inference.user_override` event with both inferred and chosen values, feeding future inference improvement.

If the user repeatedly overrides the same inferred value for similar JDs, the worker should consider the pattern as a calibration signal (per-user `inference_calibration` KV entry that biases future inferences toward the user's preferred classification).

---

## Cross-references

- `cv-skeleton.md` — uses `role_slug` for content adaptation, `commercial_seniority` for emphasis tuning.
- `cv-skeleton-academic.md` — uses `role_slug` and `career_stage` for the academic skeleton variant.
- `style-matrix.md` — uses `commercial_seniority` as a soft nudge for style pairing recommendations.
- `personalization.md` — uses `role_slug` as the partition key for `role-summary` aggregates.
- `design-packages.md` § Recommended pairings — seniority signal informs which package and style pairing is surfaced.
