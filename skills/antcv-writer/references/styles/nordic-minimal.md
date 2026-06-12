# Style: Nordic Minimal

**Primary constraint.** Restraint. Say less. Say it clearly.

**Row in style-matrix.md.** Density `low`. Words per bullet 8 – 14. Profile 200 – 280 chars. ATS-Modern native-safe.

---

## What this style sounds like

Short sentences. Concrete nouns. Past tense. No filler, no qualifiers, no warmth markers. The reader hears the work, not the writer's enthusiasm about the work. Fragment bullets are allowed and often preferred — they suit the register.

The candidate's expertise comes through facts, not adjectives. "Cut review cycles 40%" outperforms "Successfully drove significant improvement in review cycle efficiency". The first reads as competent; the second reads as anxious.

This is the default register for Nordic-region commercial applications (Danish, Swedish, Norwegian, Finnish), Nordic public sector, and any application where the reader values restraint over polish.

---

## Section-by-section

### `profile`

Two sentences, optionally three. 200 – 280 characters. No "I have" / "I am" warm-up.

- Sentence 1: role, domain, years (8 – 12 words).
- Sentence 2: operating mode in concrete terms — what kinds of work, what kinds of stakeholders (10 – 14 words).
- Sentence 3 (optional): current focus or what is next (8 – 12 words).

**Good:**

> Technical product manager with 15 years across automotive LiDAR and electro-optical systems. Works between hardware engineering and customer programmes — change governance, system architecture, requirements traceability. Currently focused on programme leadership in regulated industries.

**Avoid:** opening with adjectives ("Passionate", "Dynamic", "Results-driven"). Opening with "I have" / "I am". Closing with a soft aspiration ("looking to take on new challenges").

### `core_competencies`

Two columns. 4 – 6 rows. Focus area 1 – 2 words. Strategic expertise 6 – 10 words, no hedging.

**Good:**

| Focus area | Strategic expertise |
|---|---|
| Functional safety | ISO 26262 assessor, two ASPICE re-certifications |
| Change governance | Multi-vendor change boards in automotive perception |
| System architecture | Hardware-software interface, requirements traceability |
| Programme delivery | Customer change requests, on-deadline closure |

**Avoid:** combining items with commas into a list ("Project management, change control, governance, risk"). One row per focus area, not one row per category dump.

### `selected_outcomes`

3 – 4 bullets. Each 8 – 14 words. Title 3 – 5 words bolded; body 6 – 10 words plain.

**Good:**

- **Cut review cycles 40%.** Pre-screened against ASPICE checklist before formal board.
- **Closed two CCRs under deadline.** Cross-supplier negotiation, no escalation needed.
- **Two ASPICE re-certifications.** Owner-driven preparation, zero major findings.

**Avoid:** outcome titles that are tasks ("Led the review process"). Bullets without a result. Adverbs that add nothing ("Successfully closed two CCRs").

### `experience`

3 bullets per role. Each 8 – 14 words. Past tense for past roles, present for current. Lead with a verb.

**Good (System Architect, Innoviz, 2020 – 2025):**

- Led change control for customer integration programmes across three automotive tier-1s.
- Built requirements traceability between optical subsystem and ECU software teams.
- Drafted ASPICE-aligned change governance adopted by two downstream programmes.

**Avoid:** "Responsible for X" → use what was owned. "Worked on X" → use what was done. "Helped with X" → name the contribution.

### `tools_methods`

Grouped by domain. 3 – 6 items per group, 3 – 5 groups. Inside a group: comma-separated, no narrative.

**Good:**

- **Project & change:** Jira, Confluence, ServiceNow, ASPICE, Six Sigma Black Belt
- **Engineering:** Python, MATLAB, LabVIEW, COMSOL, Zemax
- **Quality & risk:** ISO 26262, FMEA, DFMEA, design reviews

### Other sections

Certifications, education, publications, additional information: see `cv-skeleton.md`. Nordic Minimal applies the same compression mindset — exact verbatim from the kernel, no paraphrasing, no narrative wrappers.

---

## Banned forms specific to nordic-minimal

In addition to the global banned word/phrase lists, this style rejects:

- Adverbs that add no information: `successfully`, `effectively`, `efficiently`, `seamlessly`, `proactively`.
- Warmup phrases at sentence start: `In my role`, `Over the years`, `Throughout my career`, `I have always`.
- "Responsible for" — replace with the verb of what was done.
- Multi-clause sentences where the second clause is decoration: "Led the team, working closely with stakeholders to deliver value" — drop the comma clause.
- Trailing decorators: `across the organisation`, `globally`, `throughout the company` — unless followed by a number that justifies the scope claim.
- Soft openers in profile: "Looking to", "Passionate about", "Excited by".

---

## Hard rules (owner-locked, 2026-06-12)

These are binding for every nordic-minimal output. They are not style suggestions.

1. **Specialization line.** Simple and catchy, three concepts at most — the pattern is `Processes*Products*People`. Unsolicited applications ALWAYS carry the candidate's stored specialization line; never drop it for an uopfordret ansøgning.
2. **Banned word: `discuss`** (and inflections: discusses, discussed, discussing). Use "talk through", "walk through", or name the concrete topic instead.
3. **Accessibility.** When the candidate has an accessibility item, the text must state explicitly that the request concerns a hearing-impaired person. Never an unspecified "accommodations requested" — the reader must know the nature of the accommodation.
4. **Patents keep their numbers.** Every patent entry in publications/patents carries its patent number verbatim. Dropping the number to save space is not a valid compression.
5. **Work style ends with a people skill.** The final item or sentence of the work-style section is always a people skill (e.g. clear written follow-ups, calm under disagreement, direct one-to-one communication) — never a process or tooling point.
6. **Punctuation: `-`, never `—`.** Applies to year ranges, compression dashes, and table separators (`parser_safe_separator: "hyphen"`).
7. **Contact line, Danish local form.** Postcode + district, no country: `2300, København S` (owner correction 2026-06-12) — not "Copenhagen, Denmark", not bare "København". LinkedIn renders as a clickable link, never plain text.
8. **No justified text where it gapes.** Sentences and bullets are set left-aligned when justification would produce visible rivers of white space between words (narrow columns justify worst). Restraint includes typography.
9. **One line per bullet, one line per table row** (owner, 2026-06-12). Every SELECTED OUTCOMES and EXPERIENCE bullet fits ONE rendered line (max ~95 characters in the main column); every table row fits ONE line (Strategic Expertise cell max ~55 characters). Compress or split rather than wrap — the SCE enforces both caps for this style.

---

## Preferred forms

- **Fragment bullets ending with a noun phrase.** "Two ASPICE re-certifications. Owner-driven, no audit findings."
- **Numbers without padding.** "Cut review cycles 40%" not "by approximately 40%".
- **Hyphen compression** for two-part bullets. "Multi-vendor change boards - automotive perception, three tier-1 suppliers." Always `-`, never `—` (owner rule, 2026-06-12).
- **Verb-first openers.** Led, Built, Closed, Owned, Cut, Set up, Negotiated, Drafted, Shipped.
- **Domain nouns over generic ones.** "ASPICE assessment" not "quality process". "Customer change requests" not "stakeholder requirements management".

---

## JD signals that suggest this style

Recommend `nordic-minimal` when the JD shows any of:

- Posted in Danish, Swedish, Norwegian, or Finnish.
- Plain headers ("About the role", "What you bring", "About us"), no marketing fluff.
- Phrases like "direct communication", "get-things-done attitude", "hands-on", "small team", "no-nonsense".
- Public sector hiring portals in Nordic countries.
- Companies known for restrained communication culture (Maersk, Novo Nordisk, Vestas, A.P. Møller, LEGO at the engineering level).

Do **not** recommend `nordic-minimal` when:

- The role is at director+ commercial level with P&L scope (use `prestige-structured` or `achievement-driven`).
- The JD itself uses warm/relational language extensively (use `mediterranean-formal` or `context-rich`).
- The candidate is junior / early-career with thin experience (use `cold-outreach` for outreach, `measured-professional` for applications).

---

## Compression behaviour

Bullets are already short. If a section is over budget:

1. Drop the lowest-priority bullet first, do not shorten the kept bullets further.
2. Profile compresses from three sentences to two before compressing to one.
3. `core_competencies` drops from 6 rows to 4 rows before dropping the table format entirely.
4. Trailing decorators ("across the organisation") are first to go, even before bullet drops.

Compression priorities to preserve in this style: concrete outcomes, metrics, technical terms (e.g., ASPICE, ISO 26262, named methodologies), domain nouns specific to the role.

---

## Tone-chip compatibility

Style defaults to `["calm", "restrained", "factual"]`. Additional compatible chips: `concrete`, `brief`, `precise`, `scope-anchored` (if seniority >= senior).

Conflicts: never accept `narrative`, `relational`, `warm`, `polished` — they fight the primary constraint. Worker drops them and flags to user per `style-matrix.md` § Conflicting chips.

---

## Cross-references

- `style-matrix.md` — the row definition this file expands on.
- `cv-skeleton.md` — section keys and placement.
- `change-log-application.md` — how recurring `risk=too-generic` softens this style toward more concrete examples.
- `language-output.md` — Danish tightening rules for this style.
