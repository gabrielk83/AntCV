# Style: Mediterranean Formal

**Primary constraint.** Relational warmth within formality. Acknowledge people and context within a formal register.

**Row in style-matrix.md.** Density `medium-high`. Words per bullet 14 – 22. Profile 300 – 440 chars. ATS-Modern native-safe.

---

## What this style sounds like

Longer sentences than Nordic registers. Acknowledges the people and the institutional context around the work. Formal vocabulary — but the formality is warm rather than distant. The reader is treated as a peer who is interested in the candidate, not as a screener counting bullet points.

Where `nordic-minimal` strips everything except the fact, `mediterranean-formal` keeps the relational scaffolding — the team, the stakeholder, the institution, the company — because in Southern European and LATAM commercial contexts, working through people is the work. A bullet that names only the outcome reads as cold; a bullet that names the team alongside the outcome reads as competent.

This style fits commercial roles in Spain, Italy, Portugal, Greece, France south of Lyon, and most of LATAM. It also fits institutional roles in Mediterranean Europe (universities, ministries, embassies) where the register is formal but the workplace culture is warm.

---

## Section-by-section

### `profile`

Two to three sentences. 300 – 440 characters. Lead with role and trajectory, acknowledge context.

- Sentence 1: role, years, domain — in plain professional language.
- Sentence 2: how the candidate operates, naming the kinds of stakeholders or institutional contexts they work in.
- Sentence 3 (optional): current focus or trajectory, with light relational framing.

**Good:**

> Programme manager with twelve years coordinating cross-border industrial change initiatives across Iberia and LATAM. Works between technical teams, regulators, and customer organisations, with particular focus on automotive supplier programmes and functional safety governance. Currently leading a multi-vendor change governance programme spanning three jurisdictions.

**Avoid:** clipped Nordic-style opening ("Programme manager, 12 years, automotive"). Self-rating ("Strong communicator with proven leadership"). Closing without grounding ("Seeking new opportunities").

### `core_competencies`

Two columns, `table-grid` format. 4 – 6 rows. Focus area 1 – 2 words; expertise 8 – 14 words with relational or institutional framing where natural.

**Good:**

| Focus area | Strategic expertise |
|---|---|
| Programme governance | Multi-vendor change boards across automotive tier-1 supplier networks |
| Stakeholder coordination | Cross-border negotiation with regulators, customer organisations, and integration partners |
| Functional safety | ISO 26262 governance across multinational engineering teams |
| Process design | Change request workflows adopted across three jurisdictional contexts |

**Avoid:** focus areas without relational angle ("Project management"). Pure outcome-bullets without institutional context.

### `selected_outcomes`

3 – 5 bullets. Each title 3 – 6 words; body 14 – 22 words. Bodies acknowledge the people and institutions involved alongside the outcome.

**Good:**

- **Change request workflow adopted across three regions.** Co-designed the workflow with stakeholders from the Iberian, Italian, and Brazilian programme offices, with active sponsorship from the customer change board.
- **Two ASPICE re-certifications, zero major findings.** Coordinated the preparation across optical, electrical, and software teams in two countries, with sustained engagement from external assessors throughout the process.

**Avoid:** outcome-only titles without context ("Improved compliance"). Bullets that read as Nordic-style fragments ("Two re-certifications, zero findings").

### `experience`

3 – 4 bullets per role. Each 14 – 22 words. Past or present tense as appropriate. Sentence-shaped.

**Good (Programme Lead, Multi-vendor Change Governance, 2020 – 2025):**

- Led the cross-border change governance programme across three automotive tier-1 customer organisations, working with engineering, supplier-side programme management, and customer change boards.
- Introduced an ASPICE-aligned pre-board screening process, co-designed with the customer change board and adopted by two downstream programmes after initial pilot.
- Reduced the average customer change request closure time by 40 per cent and supported two ASPICE re-certifications with no major findings reported.

**Avoid:** fragment bullets. Outcome-only bullets that strip the institutional context.

### Other sections

`tools_methods`, `certifications`, `education`, `publications_patents`, `additional_information`: follow `cv-skeleton.md` defaults. Mediterranean Formal does not change their format — the warmth lives in profile, core_competencies, selected_outcomes, and experience.

---

## Banned forms specific to mediterranean-formal

In addition to the global banned word/phrase lists, this style rejects:

- Clipped fragment bullets ending in nouns: "Two re-certifications. Zero findings." Use sentence-shaped bullets that acknowledge the work and context.
- Transactional verbs without people: "Delivered the programme" — name the team or the stakeholder set.
- Distance markers: "Stakeholder management at scale", "ran the function" — name the specific stakeholders or function.
- Anglo-Saxon self-rating: "strong leader", "results-driven", "proven track record".
- "Took ownership of" — replace with "led", "coordinated", "worked with the team to".

---

## Preferred forms

- **Relational verbs.** Co-designed, coordinated, worked with, led the team in, partnered with, brought together.
- **Named institutional contexts.** "The Iberian programme office", "the regional change board", "the ministry's review committee" — name the bodies rather than referring to "stakeholders" generically.
- **Geographic and jurisdictional framing.** "Across three jurisdictions" / "between the Madrid and São Paulo offices" / "in the Iberian and Italian regions" — geography is part of the role.
- **Polite institutional language.** "Sponsored by", "with the active support of", "following consultation with" — these are formal but not stiff.
- **Sentence-shaped bullets with conjunctions.** "...and adopted by two downstream programmes after initial pilot." Connecting language signals the work happened through institutional channels, not in isolation.

---

## JD signals that suggest this style

Recommend `mediterranean-formal` when the JD shows any of:

- Posted in Spanish, Portuguese, Italian, French (Mediterranean French — south of Lyon).
- Roles based in Madrid, Barcelona, Lisbon, Rome, Milan, Athens, Marseille, São Paulo, Mexico City, Buenos Aires.
- Institutional employers (universities, ministries, EU agencies, regulatory bodies in Mediterranean Europe).
- JDs written in narrative prose with formal opening ("The company is seeking a...") rather than bulleted requirements.
- LATAM commercial roles, especially in financial services, telecoms, and energy.

Do **not** recommend `mediterranean-formal` when:

- The role is in a Nordic, German, or UK context (use `nordic-minimal` or `measured-professional`).
- The reader is scanning for outcomes in a five-second window (use `achievement-driven`).
- The candidate's history is heavily process-driven without people/institutional framing (use `structured-professional`).
- Cold outreach (use `cold-outreach`).

---

## Compression behaviour

This style compresses badly. The warmth lives in the longer sentences; trimming them produces Nordic-style fragments and the bullet stops sounding like the register.

When over budget:

1. Drop the lowest-priority bullet entirely. Do not shorten kept bullets below 14 words.
2. Profile compresses sentence 3 first, then trims sentence 2's relational clause.
3. `core_competencies` reduces rows before changing format.
4. Never strip relational verbs to fit a length target. If forced, switch to `measured-professional` and regenerate.

Compression priorities to preserve: relational framing, context sentences naming people or institutions, formal vocabulary.

---

## Tone-chip compatibility

Style defaults to `["formal", "warm", "relational"]`. Additional compatible chips: `polished`, `narrative`, `concrete`, `institutional`.

Conflicts: never accept `restrained`, `brief`, `clipped` — they strip the warmth that defines the style. `outcome-led` flattens the relational framing; `method-led` is acceptable when the role is process-heavy.

---

## Cross-references

- `style-matrix.md` — the row definition this file expands on.
- `cv-skeleton.md` — section keys and placement.
- `design-packages.md` § Recommended pairings — Warm Terracotta and Pampas Contemporary are the primary visual matches.
- `language-output.md` — per-language register adjustments (Spanish, Italian, Portuguese, French) for this style.
- `change-log-application.md` — how recurring `risk=too-generic` softens the style toward more institutional naming.
