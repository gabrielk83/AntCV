# Style: Research Formal

**Primary constraint.** Academic register. Frame contributions as research outputs, not commercial wins.

**Row in style-matrix.md.** Density `medium-high`. Words per bullet 14 – 22. Profile 360 – 1100 chars (career-stage dependent). ATS-Modern native-safe; academic-formal section names.

---

## What this style sounds like

Academic. Research questions over commercial outcomes. Methodological contributions over revenue framing. Publications, citations, grants, and named techniques carry the document's weight. The reader is a search committee, a fellowship review panel, or a faculty hiring board — they are evaluating scholarly trajectory, not commercial impact.

The voice is formal but not stiff. Sentences are longer than commercial-style bullets but not as long as the prestige register. The candidate references their thesis question, their methodological signature, the labs and PIs they have worked with, and the specific techniques they have developed or adopted.

This style uses the **academic skeleton** (see `cv-skeleton-academic.md`) rather than the commercial skeleton — section set, length budget, and ordering differ from commercial styles. The five career-stage variants (`phd_applicant`, `phd_candidate`, `postdoc`, `early_faculty`, `senior_faculty`) drive different section emphases per `cv-skeleton-academic.md` § Career-stage variants.

---

## Section-by-section

This style uses the academic skeleton's section keys. Below are style-specific notes per section; see `cv-skeleton-academic.md` for the full section reference.

### `research_summary`

The academic equivalent of `profile`. Length varies by career stage:

- `phd_applicant`: 3 – 4 sentences, ~400 – 550 chars.
- `phd_candidate`: 3 – 5 sentences, ~500 – 800 chars.
- `postdoc`: 2 – 3 paragraphs, ~600 – 1100 chars.
- `early_faculty` / `senior_faculty`: 2 – 4 paragraphs, ~700 – 1200 chars.

**Good (postdoc applicant):**

> My research focuses on mid-infrared photonic integrated circuits for environmental sensing, with particular emphasis on chalcogenide glass platforms and on-chip dispersion engineering. During my PhD with Professor Garcia at ETH Zürich, I developed a fabrication route for low-loss As-Se waveguides on silicon that has since been adopted by two collaborating groups for trace-gas sensing applications. My current work extends this platform toward integrated frequency-comb sources, where I am addressing the dispersion-engineering challenges that have limited prior demonstrations to discrete-component implementations.

**Avoid:** commercial framing ("Drove product development of"). KPI vocabulary ("Increased throughput by 40%"). Self-rating ("Outstanding researcher").

### `research_experience`

Bullets are 14 – 22 words, lead with research question or methodology. Each role 2 – 4 bullets depending on substance.

**Good (Postdoctoral Researcher, ETH Zürich, 2022 – 2024):**

- Developed a fabrication route for low-loss As-Se chalcogenide waveguides on silicon, achieving propagation losses of 0.4 dB/cm at 4.5 µm.
- Supervised two MSc students on related dispersion-engineering work; co-authored two journal publications with both students as second authors.
- Built the cryogenic measurement setup now used by three downstream projects in the group, with two external collaborators visiting to use it.

**Avoid:** outcome-only framing without method. Generic research claims ("Conducted research in photonics").

### `publications`

Verbatim from `user_state.profile.publications`. Grouped by type (journal, conference, preprint, patent, book chapter). Reverse-chronological within group. Highlight first/last authorship.

**Good entry:**

- **Karp-Gershon, G.**, Garcia, M., et al. (2023). Low-loss As-Se waveguides on silicon for mid-infrared sensing. *Optics Express*, 31(15), 24578 – 24590. (first author)

**Avoid:** paraphrasing titles. Inventing venues. Surfacing publications not in the kernel.

### `selected_research_outcomes`

3 – 5 bullets. Each title 4 – 8 words; body 14 – 22 words. Frame as research-meaningful outcomes, not commercial.

**Good:**

- **Fabrication route adopted by two collaborating groups.** The As-Se waveguide process I developed is now used at Helsinki and Zürich for trace-gas sensing programmes that I am not directly involved in.
- **First-author publication in Optics Express, cited 27 times in two years.** The paper established the propagation-loss benchmark that subsequent work in the group has built on.
- **Open-source Python package for dispersion engineering of integrated waveguides.** Released alongside the publication; adopted by three external research groups based on GitHub fork count.

**Avoid:** outcomes without scholarly meaning ("Reduced cycle time"). Commercial impact framing.

### `teaching_supervision`

Courses and student supervision. For postdoc and beyond, supervised students with thesis titles and outcomes are foreground; for `phd_applicant` and `phd_candidate`, teaching assistantships and tutoring suffice.

**Good (supervision entry):**

- Ling Chen (MSc) — "Dispersion engineering for mid-infrared frequency combs." 2022 – 2024, primary advisor. Thesis submitted; first-author publication in Optics Express.

### `grants_fellowships`

Critical at postdoc and beyond. Each entry: name, funder, amount, period, role, status.

**Good:**

- Marie Skłodowska-Curie Postdoctoral Fellowship — European Commission, €200,000, 2023 – 2025. Principal Investigator. Awarded.

### Other sections

`conferences_talks`, `technical_methods`, `professional_service`, `references`, `education`: follow `cv-skeleton-academic.md` defaults. Research Formal uses these without modification.

---

## Banned forms specific to research-formal

In addition to the global banned word/phrase lists, this style rejects:

- Commercial KPI framing: "Increased X by 40 per cent", "Delivered Y outcomes", "Met all targets". Translate to research-meaningful framing or omit.
- Revenue or growth language: "Drove growth", "Generated revenue", "Scaled the function". Inapplicable to academic register.
- Hero-narrative framing: "Led the breakthrough", "Pioneered the technique". Use measured academic language: "Developed", "Established", "Authored", "Co-authored".
- Self-rating: "Outstanding researcher", "Top-quartile productivity". Reviewers read these as defensive.
- Hedging on authorship: "Contributed to a publication on" — name the publication, your author position, and the venue.
- Casual register: "Got the paper accepted", "Hit the deadline" — replace with formal equivalents.

---

## Preferred forms

- **Research-question framing.** "My work addresses the question of how X..." beats "I work on X". Frame contributions as answers to questions.
- **PI and lab naming.** Name the PIs and the labs you have worked with. The academic graph is part of the record.
- **Methodological signature.** Name the techniques you have developed or specialised in — "low-loss As-Se chalcogenide waveguides", "cryogenic Pockels-cell modulation". These signal your contribution to the field.
- **Quantified scholarly metrics.** Publication counts, citation counts (when honest and meaningful), grant amounts, supervised students, downstream adoption of techniques or software.
- **Adoption signals.** "Used by two collaborating groups", "Cited 27 times in two years", "Adopted as the platform for three downstream projects" — these are the academic equivalents of commercial scope markers.
- **Author position transparency.** First-author, last-author, corresponding author, second-author — explicit in publication lists.

---

## JD signals that suggest this style

Recommend `research-formal` when the JD shows any of:

- PhD, postdoc, faculty, senior research scientist, or principal investigator role titles.
- Application targets are universities, research institutes, national laboratories, or industry research divisions (Bell Labs-equivalents).
- JDs that name publications, grants, or named fellowships as evaluation criteria.
- Posting from a research group with named PIs or thematic research lines.
- Industry roles where the deliverable is research output rather than product (corporate research labs in pharma, semiconductor, AI/ML).

Do **not** recommend `research-formal` when:

- The role is commercial product/engineering at an industry employer, even if the company is research-adjacent (use `precision-formal` or `achievement-driven`).
- The candidate's history is industry-only without research output (the style will read as performative).
- The candidate is transitioning from academia to industry and wants industry framing (use `hybrid-balanced`).

---

## Compression behaviour

Academic CVs are longer by design — 2 – 5 pages depending on career stage. Compression is the exception, not the rule.

When over budget:

1. Publications: show top-N by relevance and cite "+N more publications available" rather than dropping entries from the canonical list.
2. Conferences and talks: drop posters before contributed talks; drop contributed talks before invited talks; keep all plenaries and named lectures.
3. `research_summary` paragraphs: tighten by removing the bridge to the target institution (sentence 4) before tightening the methodology sentence (sentence 3).
4. Never strip the publication metadata — first-author marking, venue, year, DOI are sacrosanct.

Compression priorities to preserve: publication data, research questions, methodological terms, PI and lab names, grant amounts, supervised-student outcomes.

---

## Tone-chip compatibility

Style defaults to `["academic", "methodological", "publication-anchored"]`. Additional compatible chips: `formal`, `precise`, `credentialed`, `factual`, `concrete`.

Conflicts: never accept `outcome-led` (re-orders against research-question framing), `speculative`, `brief`, `conversational`, `scope-heavy` (commercial scope vocabulary).

---

## Cross-references

- `style-matrix.md` — the row definition this file expands on.
- `cv-skeleton-academic.md` — the section set this style uses (different from commercial).
- `design-packages.md` § Recommended pairings — Copenhagen Modern (primary) and Delhi Technical (alternative).
- `hybrid-balanced.md` — adjacent style for industry-academic transitions.
- `change-log-application.md` — recurring `risk=overstated` in this style usually signals citation inflation or author-position misrepresentation; the skill demands traceability to the kernel's publication list.
