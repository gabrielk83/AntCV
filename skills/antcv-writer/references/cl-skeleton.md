# Cover Letter Skeleton

The canonical structure for AntCV cover letters. Used by every writing style; the style controls voice and density per `style-matrix.md`, the skeleton controls section set and ordering.

The cover letter is **complementary** to the CV — it tells the story the CV cannot. The CV lists what the candidate has done; the cover letter explains why the candidate is applying to this specific role and what they would do in it. The two documents share visual treatment (same header, same package) but carry different content.

**Length budget.** 1.5 pages maximum. Tighter than the CV — readers spend less time on a cover letter than on a CV, so density must be higher and ornament must be lower. Honour `target_pages_cl` if set separately; otherwise default to `target_pages` rounded down to 1.5 max.

---

## Section set

The cover letter has a fixed five-section body, plus a header and a close. The section set is style-independent at the structural level; the style controls density, voice, and bullet shape within each section.

| Key | Purpose | Default format |
|---|---|---|
| `cl_header` | Name, application line, contact details | Block |
| `cl_opener` | "Dear [Name]," + opening sentence | Salutation + paragraph |
| `who_i_am` | One paragraph framing the candidate | Paragraph |
| `what_i_bring` | 2-column table: Focus Area + Strategic Expertise | Table-grid |
| `why_this_position` | Why this role at this company | Paragraph |
| `how_i_would_contribute` | 3 bullets — concrete contributions | Bullets |
| `foundation` | Two clauses: hands-on / professionally | Structured paragraph |
| `cl_close` | Sign-off + name | Closing |

Section ordering is fixed. Styles do not reorder cover letter sections.

---

## Per-section content rules

### `cl_header`

The visible header block at the top of the cover letter. Same colour band as the CV per the active package, but the right side carries:

- Line 1: Candidate's full name (matching CV).
- Line 2: `Application: [Position] — [Company]` — the role, em-dash separator, company name.
- Line 3: contact line — email, LinkedIn, city — same items as the CV's contact header.

**Source data.** `user_state.profile.contacts` (verbatim) + the JD's company and position.

**Content rules.**

- Position name extracted from the JD heading. If the JD title is "Senior Product Manager — Maersk", the application line is "Application: Senior Product Manager — Maersk".
- Never paraphrase the position name from the JD.
- LinkedIn never dropped from contact items — global rule.

### `cl_opener`

The salutation and the first sentence.

**Salutation rules.**

- "Dear [Hiring Manager Name]," if the JD names the hiring manager.
- "Dear [Department Lead Name]," if a department lead is named in the JD.
- "Dear Hiring Team," as the fallback. Never "Dear Sir or Madam," — outdated.

**Opening sentence rules.**

- One sentence. Directly states why the candidate is applying.
- Names the position and the company.
- 15 – 30 words for most styles; 10 – 20 for `nordic-minimal` and `cold-outreach`; 20 – 35 for `mediterranean-formal`, `context-rich`, and `prestige-structured`.

**Good (achievement-driven):**

> Dear Hiring Team,
>
> I am applying for the Senior Product Manager position at Maersk because the role's combination of customer-facing product ownership and large-scale operational complexity matches the work I have been doing for the past five years.

**Avoid:** generic openers ("I am writing to apply for the position of..."). Self-rating in the opener. Closing-pressure framing in the opener.

### `who_i_am`

One paragraph. Frames the candidate at the level the role requires.

**Length.** 80 – 140 words. Tighter for `nordic-minimal` and `cold-outreach` (60 – 100); longer for `context-rich`, `mediterranean-formal`, and `prestige-structured` (120 – 180).

**Content rules.**

- First sentence: role and years, with the framing that connects to the target role.
- Subsequent sentences: how the candidate operates and what they bring to the kind of work the role describes.
- No comprehensive career recap — the CV does that. The cover letter selects.
- Names of past employers or institutions are fine when they anchor the framing; do not list every employer.

**Good (measured-professional, applying for product manager role at Maersk):**

> I am a technical product manager with twelve years across hardware programmes and customer-facing operational work in regulated industries. My most recent five years have been at Innoviz, where I led change governance and customer change request closure across three automotive tier-1 customer programmes. The work has lived at the interface between hardware engineering, customer integration, and ASPICE-aligned process discipline.

**Avoid:** opening with "I am" (acceptable in this section but never to open the cover letter). Listing every employer. Restating the CV's profile section verbatim.

### `what_i_bring`

Two-column table. Focus area + strategic expertise. 4 – 6 rows. The same structure as the CV's `core_competencies` but tuned for what the specific role asks for.

**Content rules.**

- Focus areas are selected per the JD — match the JD's stated requirements first, then add the candidate's strongest adjacent areas.
- Strategic expertise rows are 8 – 14 words (medium); 6 – 10 for low-density styles; up to 16 for high-density styles.
- Tuned to the role, not generic. A `what_i_bring` row that would fit on any application is too generic.

**Good (applying for PM role at Maersk):**

| Focus area | Strategic expertise |
|---|---|
| Customer-facing product ownership | Customer change request closure across three automotive tier-1 programmes |
| Operational complexity at scale | Multi-vendor change governance, ASPICE-aligned workflows |
| Stakeholder coordination | Cross-supplier negotiation, customer change board engagement |
| Process discipline | Six Sigma Black Belt, ISO 26262 assessor, ASPICE governance |

**Avoid:** rows duplicated from the CV's core_competencies without JD-specific tuning.

### `why_this_position`

One paragraph. The substantive answer to "why this role at this company".

**Length.** 80 – 140 words across styles; same per-style adjustments as `who_i_am`.

**Content rules.**

- Names two or three specific things about the role or company that are relevant — not generic flattery.
- Connects those specific things to the candidate's experience.
- Does not parrot the JD back; selects from the JD's emphasis.
- Avoids "your innovative team" / "your industry-leading work" — name what specifically you find interesting and why.

**Good:**

> This role sits at the intersection of customer-facing product work and operational complexity — the same intersection my last five years at Innoviz have lived in. The shift from automotive tier-1 customer programmes to Maersk's logistics-tech customer base brings a change in industry, but the underlying work — owning the product and the customer relationship through change cycles, with operational discipline behind it — is recognisably the same. The mention of ASPICE-equivalent process maturity in the JD's "ways of working" section is part of what drew me to apply.

**Avoid:** generic interest claims. Parroting the JD verbatim. Self-rating in this section.

### `how_i_would_contribute`

Three bullets. Concrete contributions the candidate would make in the first 6 – 12 months of the role.

**Bullet rules.**

- 3 bullets exactly. Not 2, not 4.
- Each bullet 14 – 22 words (medium); 11 – 17 for low-density styles; 17 – 26 for high-density.
- Each bullet names a specific contribution, not a general claim.
- Speculative framing is fine: "I would expect to" / "Early work would likely focus on" / "In the first six months I would" — these are appropriate because the candidate is not in the role yet.

**Good:**

- I would expect to spend the first three months mapping the customer change request workflow as it exists today, identifying friction points the way I did when joining Innoviz.
- A near-term contribution would be a structured pre-board screening process for high-impact change requests, modelled on what I built and standardised at Innoviz across three programmes.
- Longer-term, I would aim to apply the ASPICE-aligned discipline I have developed to whichever process the Maersk product organisation flags as the highest-priority point for governance improvement.

**Avoid:** generic contribution claims ("I would add value"). Concrete contribution claims that the candidate cannot actually deliver. Speculative framing without grounding.

### `foundation`

Two short clauses. Closes the body before the sign-off. Names the practical and professional foundations of the candidate's fit.

**Structure.**

- `Hands-on:` — one sentence naming the concrete, hands-on work the candidate is ready to do in the role.
- `Professionally:` — one sentence naming the professional positioning or trajectory.

**Length.** Each clause 12 – 24 words.

**Good:**

> **Hands-on:** I am ready to spend the first weeks reading the existing change workflow documentation, sitting with the operational team, and writing up what I see before proposing changes.
>
> **Professionally:** This role would be a natural continuation of the work I have been doing — moving from automotive hardware programmes to logistics-tech product work, but keeping the operational and customer-facing core that defines how I work.

**Avoid:** abstract foundations claims. Foundations that contradict the rest of the letter.

### `cl_close`

Sign-off and signature.

**Sign-off rules.**

- "Kind regards," — default for most styles and contexts.
- "Sincerely," — acceptable for formal contexts (legal, finance, prestige-structured).
- "Best regards," — acceptable for warmer contexts (mediterranean-formal, context-rich).
- **Never** "I look forward to hearing from you," — banned phrase per `user_state.writingPrefs.bannedPhrases`. The sign-off does not need a forward-looking sentence; the application itself is the forward-looking signal.

**Signature.**

- Full name on its own line, matching the CV header.
- No title after the name.
- No "P.S." or "P.P.S."

**Good:**

> Kind regards,
>
> Gabriel Alexander Karp-Gershon

---

## Style-level adjustments

Each writing style applies its voice within the fixed section structure. A few style-specific notes:

- **`nordic-minimal`**: shorter paragraphs throughout. `who_i_am` and `why_this_position` compress to 60 – 100 words. `foundation` clauses to 12 – 18 words. The cover letter still uses the full five-section body — Nordic Minimal does not omit sections.
- **`achievement-driven`**: `how_i_would_contribute` bullets lead with outcomes ("Within six months I would expect to close two more programmes..."). `what_i_bring` table foregrounds outcome-anchored expertise rows.
- **`measured-professional`**: the default. No section-level adjustments.
- **`structured-professional`**: `how_i_would_contribute` bullets name the method ("Applying ASPICE-aligned pre-board screening, I would expect to..."). `what_i_bring` foregrounds methodology-named rows.
- **`mediterranean-formal`**: longer paragraphs throughout. `cl_opener` opens with relational acknowledgement of the institution.
- **`prestige-structured`**: substantive paragraphs at the high end of length ranges. `what_i_bring` rows include scope anchors (revenue, headcount, jurisdictional remit).
- **`credential-forward`**: `who_i_am` opens with primary credentials. `what_i_bring` foregrounds credentialed expertise rows.
- **`precision-formal`**: `how_i_would_contribute` bullets include precise scope numbers where honest.
- **`context-rich`**: paragraphs at the top of length ranges. `why_this_position` carries narrative explaining the candidate's interest.
- **`cold-outreach`**: this style typically **does not produce a cover letter** in the traditional sense. The "cover letter" for cold outreach is the body of the outreach message itself — shorter than this skeleton supports. When `cold-outreach` is selected and a cover letter is requested, the skill produces a single-paragraph version that combines `cl_opener`, `who_i_am`, and a one-bullet `how_i_would_contribute`.
- **`research-formal`**: uses a different structure entirely — see `cv-skeleton-academic.md` for the academic equivalent. Most academic applications use a separate research statement plus a teaching statement, not a commercial-style cover letter. The skill produces a cover letter only when explicitly requested.
- **`hybrid-balanced`**: applies the same dual-register logic as the CV — bridges visible at the document level, not within each bullet.

---

## ATS tier adjustments

The cover letter follows the same two-tier ATS model as the CV (see `cv-skeleton.md` § ATS export tiers):

- **ATS-Modern** (default): `what_i_bring` is a real Word table with header row; paragraph sections retain their structure; package-matched body font.
- **ATS-Legacy**: `what_i_bring` flattens to a bulleted list ("Focus area — Strategic expertise"); single column; Calibri body throughout; canonical section names (the cover-letter section keys above already use canonical names, so no further normalisation needed).

The two-tier inference and advisory mechanics from the CV apply to the cover letter as well — there is no separate cover-letter-only tier selection.

---

## Output JSON shape

The skill returns the cover letter as a single object under the `cover_letter` key in the main output. See `output-schema.md` for the full schema. A condensed example:

```json
{
  "cover_letter": {
    "cl_header": {
      "name": "Gabriel Alexander Karp-Gershon",
      "application_line": "Application: Senior Product Manager — Maersk",
      "contacts": ["email", "linkedin", "city"]
    },
    "cl_opener": {
      "salutation": "Dear Hiring Team,",
      "opening": "I am applying for the Senior Product Manager position at Maersk because..."
    },
    "who_i_am": "I am a technical product manager with twelve years across...",
    "what_i_bring": {
      "format": "table-grid",
      "rows": [
        { "focus_area": "Customer-facing product ownership", "expertise": "..." }
      ]
    },
    "why_this_position": "This role sits at the intersection of...",
    "how_i_would_contribute": [
      "I would expect to spend the first three months...",
      "A near-term contribution would be...",
      "Longer-term, I would aim to..."
    ],
    "foundation": {
      "hands_on": "I am ready to spend the first weeks...",
      "professionally": "This role would be a natural continuation..."
    },
    "cl_close": {
      "sign_off": "Kind regards,",
      "signature": "Gabriel Alexander Karp-Gershon"
    },
    "char_count": 1240
  }
}
```

---

## Cross-references

- `cv-skeleton.md` — the CV the cover letter accompanies; visual treatment is shared via the package.
- `cv-skeleton-academic.md` — for academic applications, the cover letter is replaced by a research statement; see that document's § Statements section.
- `style-matrix.md` — voice and density per style.
- `styles/{name}.md` — per-style content rules apply to cover-letter sections as well as CV sections.
- `output-schema.md` — full JSON shape for the cover letter output.
- `jd-gap-closure.md` — confirmed JD claims surface in `why_this_position` and `how_i_would_contribute` as factual evidence.
- `language-output.md` — per-language adjustments for cover-letter salutations and sign-offs.
