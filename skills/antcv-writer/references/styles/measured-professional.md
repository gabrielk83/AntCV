# Style: Measured Professional

**Primary constraint.** Balance of fact and outcome. Concrete actions described in plain language.

**Row in style-matrix.md.** Density `medium`. Words per bullet 11 – 17. Profile 260 – 340 chars. ATS-Modern native-safe.

---

## What this style sounds like

Calm, certain, neither outcome-forward nor process-forward. Each bullet leads with whatever is most relevant to the specific role — sometimes the outcome, sometimes the method, sometimes the scope. The voice does not optimise for any one signal; it optimises for being correct and useful to the reader.

This is the safest default for most commercial applications. If no style jumps out as the right pick for a given JD, `measured-professional` usually fits. It is also the right fallback when the candidate's history mixes outcome-heavy and process-heavy work and one style would distort one half of the record.

The register is professional without being formal. Sentences are factual without being clipped. Numbers appear where they are real and helpful, but the bullet does not bend around them.

---

## Section-by-section

### `profile`

Two sentences, occasionally three. 260 – 340 characters. Lead with role and domain in plain language; follow with operating mode.

- Sentence 1: role, years, domain — short and concrete.
- Sentence 2: how the candidate operates and what kinds of problems they take on.
- Sentence 3 (optional): current focus or what is next.

**Good:**

> Technical product manager with 15 years across automotive LiDAR and electro-optical systems. Works between hardware engineering and customer programmes, focused on change governance, system architecture, and customer requirements traceability. Currently leading programme work in regulated industries.

**Avoid:** opening with adjectives or work-style labels. Opening with "I have" / "I am". Closing with soft aspiration ("looking to take on new challenges").

### `core_competencies`

Two columns, `table-grid` format. 5 – 7 rows. Focus area 1 – 2 words; strategic expertise 6 – 10 words describing the candidate's specific angle.

**Good:**

| Focus area | Strategic expertise |
|---|---|
| System architecture | Hardware-software interface, requirements traceability |
| Change governance | Multi-vendor change boards across automotive tier-1 programmes |
| Functional safety | ISO 26262 assessor; two ASPICE re-certifications |
| Programme delivery | Customer change requests closed under deadline |
| Stakeholder coordination | Cross-supplier negotiation, on-deadline closure |

**Avoid:** focus areas without specific angle ("Project management — strong skills in planning"). Concatenated lists in a single row.

### `selected_outcomes`

3 – 5 bullets. Each title 3 – 6 words; body 10 – 14 words. The body usually leads with context or method, then arrives at the result — but the order can flex per bullet.

**Good:**

- **Customer change requests closed under deadline.** Cross-supplier negotiation across two tier-1 programmes; no escalation needed; closure within agreed window.
- **Two ASPICE re-certifications, zero major findings.** Coordinated optical, electrical, and software teams; pre-board screening before assessor reviews.
- **40% reduction in review cycle time.** Introduced pre-board ASPICE checklist; average closure dropped from 25 days to 15.

**Avoid:** outcome titles that are tasks ("Worked on review cycles"). Bullets that bury the action ("As part of the system architecture team, I was involved in supporting...").

### `experience`

3 bullets per role. Each 11 – 17 words. Past tense for past roles, present for current. Lead with the verb of action.

**Bullet rhythm for this style:**

- Bullet 1: scope or ownership of the role (what was held).
- Bullet 2: a representative action or method (what was done).
- Bullet 3: an outcome that resulted (what changed).

**Good (System Architect, Innoviz, 2020 – 2025):**

- Led change control across three automotive tier-1 customer programmes; owned customer change request closure and system architecture handover.
- Introduced ASPICE-aligned pre-board screening for customer change requests; coordinated optical, electrical, and software team inputs.
- Cut average review cycle time 40%; supported two ASPICE re-certifications with zero major findings.

**Avoid:** "Was responsible for X" → use the verb of what was done. "Worked on X" → use what was specifically done. Generic action verbs ("Handled", "Managed", "Dealt with") without specific object.

### `tools_methods`

Grouped by domain. 3 – 6 items per group; 3 – 5 groups total.

**Good:**

- **Project and change:** Jira, Confluence, ServiceNow, ASPICE, Six Sigma Black Belt.
- **Engineering:** Python, MATLAB, LabVIEW, COMSOL, Zemax.
- **Quality and risk:** ISO 26262, FMEA, DFMEA, design reviews.

### Other sections

Certifications, education, publications, additional information: see `cv-skeleton.md`. Measured Professional applies these sections without modification — exact verbatim from the kernel.

---

## Banned forms specific to measured-professional

In addition to the global banned word/phrase lists, this style rejects:

- Hyperbole as substitute for fact: "transformed the function", "revolutionised the process", "redefined the approach".
- Unsupported metrics: any number not traceable to `user_state.profile.experiences[*]`.
- Magnitude words as substitute for numbers when numbers are available: `significantly`, `substantially`, `considerably`.
- Sentence-padding to fit a length target: if the bullet is 11 words and tells the truth, do not pad it to 15.
- Soft openers: "I have always", "Throughout my career", "Over the years".
- Generic action verbs without object: "Handled stakeholders", "Managed projects". Name the specific stakeholder type or project.

---

## Preferred forms

- **Plain verbs.** Led, Built, Owned, Closed, Coordinated, Introduced, Drafted, Negotiated.
- **Specific objects.** "Customer change requests" not "stakeholder inputs". "ASPICE re-certification" not "quality process".
- **Numbers when honest, words when not.** "40% reduction" or "Cut average review cycle time". Either works; do not fake a number to fit the style.
- **Domain nouns.** ASPICE, ISO 26262, tier-1, ECU, perception stack, requirements traceability. Domain-specific vocabulary signals expertise more reliably than adjectives do.
- **Sentence-shaped or fragment, by section.** Profile and experience bullets are sentence-shaped. Tools, certifications, education are fragment-shaped.

---

## JD signals that suggest this style

Recommend `measured-professional` when the JD shows any of:

- Professional but unmarked tone — no marketing fluff, no aggressive achievement framing.
- A mix of outcome and process responsibilities in the role description.
- Generalist commercial roles where impact framing might overshoot and process framing might undershoot.
- European commercial roles outside the Nordics where neither `nordic-minimal` nor `mediterranean-formal` fits cleanly.
- The candidate's history mixes outcome-heavy and process-heavy work — one style would distort half the record.

This style is the **default fallback** when role inference does not produce a confident style recommendation.

Do **not** recommend `measured-professional` when:

- The JD is heavy on outcome framing and the candidate has the outcomes to match — use `achievement-driven`.
- The role is process-led (ops, quality, compliance) — use `structured-professional`.
- The candidate is academic — use `research-formal`.
- The application is cold outreach — use `cold-outreach`.

---

## Compression behaviour

When over budget:

1. Bullets compress before they drop. Most bullets in this style carry context that can shorten.
2. Profile compresses sentence 3 first, then sentence 2.
3. `core_competencies` rows drop the specific-angle clause before dropping the row.
4. `experience` bullet 2 (the action) compresses before bullets 1 (scope) or 3 (outcome).

Compression priorities to preserve: specific outcomes, concrete actions, domain terms.

---

## Tone-chip compatibility

Style defaults to `["balanced", "concrete", "calm"]`. Additional compatible chips: `factual`, `outcome-led` (shifts the style toward `achievement-driven` without switching), `restrained` (shifts toward `nordic-minimal`), `precise`.

Conflicts: never accept `narrative` or `why-led` — they pull the style toward `context-rich`, at which point the user should switch styles instead of chipping.

---

## Cross-references

- `style-matrix.md` — the row definition this file expands on.
- `cv-skeleton.md` — section keys and placement.
- `design-packages.md` § Recommended pairings — Copenhagen Modern and Nordic Frost are the primary visual matches.
- `change-log-application.md` — how recurring `risk` patterns nudge this style toward either `nordic-minimal` (if `too-generic` recurs) or `achievement-driven` (if outcome quality is consistently strong).
