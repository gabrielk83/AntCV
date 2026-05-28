# Style: Cold Outreach

**Primary constraint.** Possibility framing, brevity. Open a conversation, do not close a sale.

**Row in style-matrix.md.** Density `low`. Words per bullet 8 – 14. Profile 160 – 260 chars. ATS-Modern native-safe; informal section names normalised in legacy.

---

## What this style sounds like

Short. Conversational. Speculative rather than declarative. The reader is a person at a company without an open role for this candidate, reading a cold message and deciding whether to write back. The output is not a full CV — it is the lightest possible version that still says something specific enough to start a conversation.

This style assumes the reader will spend 30 seconds, not five minutes. Every sentence either pulls them in or wastes their time. The register is professional but not formal — the candidate is reaching out, not applying.

Crucially, this style is **for outreach to companies without a posted role**, not for replies to posted JDs. For a posted JD, even in a casual industry, the candidate should use a different style. Cold-Outreach optimises for "I see what you're doing and here's why we should talk" — not for "I am qualified for the role you advertised".

---

## Section-by-section

The section set itself is reduced for this style. Several sections from `cv-skeleton.md` are omitted by default.

**Default sections in cold-outreach:**

- `profile` (short)
- `selected_outcomes` (3 short bullets max)
- `experience` (most recent 2 roles only, condensed)
- `education` (single line, sidebar)

**Omitted by default:**

- `core_competencies` — too formal for outreach; the outcomes do the work.
- `certifications` — list only if specifically relevant to the outreach.
- `publications_patents` — surface only if directly relevant.
- `additional_information` — usually omitted unless the recipient context warrants it.

The user can override the omitted sections; the style respects overrides without complaint.

### `profile`

Two sentences. 160 – 260 characters. Speculative or possibility-led opener.

- Sentence 1: who you are in one line, framed around what kind of work you take on.
- Sentence 2: why you are reaching out to this company specifically, or what kind of conversation you are hoping to start.

**Good:**

> Hardware programme lead with a decade in automotive perception. I have been watching what your team has been doing on next-generation LiDAR and would value a conversation about where it might be going.

**Avoid:** generic "looking for new opportunities" framing. Self-rating ("strong communicator", "experienced leader"). Listing credentials in the profile (the rest of the CV does that).

### `selected_outcomes`

3 bullets, each 8 – 12 words. Title 3 – 5 words; body 5 – 8 words. These exist to signal the candidate's level concretely without the full CV experience block.

**Good:**

- **Two ASPICE re-certifications.** Owner-driven, zero major findings.
- **Cut customer review cycles 40%.** Pre-board screening across three tier-1 programmes.
- **Shipped LiDAR system architecture.** Three customer programmes, on-time integration.

**Avoid:** outcomes that need explanation to land. Save complex outcomes for the conversation, not the outreach.

### `experience`

Most recent 2 roles. 2 bullets each (not 3). Each bullet 8 – 12 words.

**Good (System Architect, Innoviz, 2020 – 2025):**

- Led change control across three automotive tier-1 customer programmes.
- Owned customer change request closure; cut review cycles 40%.

**Avoid:** more than two roles. More than two bullets per role. Bullets longer than 12 words.

### `education`

Single line, sidebar. Degree, field, institution, year only — no thesis, no advisor, no honours unless directly relevant to the outreach.

**Good:**

- M.Sc., Electrical Engineering — Tel Aviv University, 2008.

---

## Banned forms specific to cold-outreach

In addition to the global banned word/phrase lists, this style rejects:

- "Looking for new opportunities" / "Seeking my next role" / "Open to discussions" — these are filler in cold outreach; the act of reaching out implies them.
- Self-rating phrases: "strong communicator", "experienced leader", "skilled negotiator".
- Application-style register: "I am writing to apply for", "I would like to submit my candidacy".
- Closing pressure: "Looking forward to hearing from you", "Available at your earliest convenience", "Would welcome the opportunity to discuss further".
- Generic flattery about the company: "Your innovative team" / "Your industry-leading work" — be specific or do not mention it.
- More than three bullets in any section. The format is designed to be scanned in 30 seconds.

---

## Preferred forms

- **Speculative openers.** "I have been watching", "I am curious about", "I notice you have been", "I have been thinking about".
- **Specific company signals.** Name the specific thing you noticed — a product launch, a hire, a publication, a strategic move. "Watching your team's work on X" beats "your innovative work".
- **Possibility-led closes.** "Would value a conversation", "Worth a short call", "Open to a 20-minute chat about" — leaves the next step ambiguous and easy.
- **Concrete outcomes without context.** Outreach assumes the reader will ask for context if they want it. "Two ASPICE re-certifications" is enough; the rest waits for the conversation.
- **Plain professional register.** Not formal, not casual. Treat the reader as a peer.

---

## JD signals that suggest this style

This style is **not driven by JD signals** — there is no JD. The decision to use cold-outreach is made by the user when they choose to reach out to a company without a posted role.

Recommend `cold-outreach` when the user indicates any of:

- They are messaging someone at a company that has not posted the role they want.
- They are introducing themselves to a small company where a JD does not yet exist.
- They are following up on a conference conversation or a personal introduction.
- They are reaching out to a founder, hiring manager, or specific person at the company rather than through a formal application.
- The application context is LinkedIn message, cold email, or warm intro — not a careers portal.

Do **not** recommend `cold-outreach` when:

- The user is responding to a posted JD. Use the appropriate JD-matched style.
- The user is applying through a formal portal that requires a full CV.
- The user is at an executive level where the audience expects substantial detail (use `prestige-structured` even for outreach).

---

## Compression behaviour

This style is already compressed. If the output is over budget:

1. Drop sections before drop bullets. `experience` reduces to 1 role; then `education` drops to no year; then `selected_outcomes` reduces to 2.
2. Profile compresses from 2 sentences to 1.
3. The cover letter (if generated) compresses more aggressively than the CV in this style.

Compression priorities to preserve: openers, specific company signals, actionable next-step framings.

---

## Tone-chip compatibility

Style defaults to `["speculative", "brief", "conversational"]`. Additional compatible chips: `calm`, `concrete`, `factual`.

Conflicts: never accept `narrative`, `formal`, `institutional`, `polished`, `outcome-led` (the style is outcome-aware but not outcome-led — the lede is the possibility, not the outcome), `quantified` (numbers are welcome but not demanded — this is outreach, not credential proof).

---

## Cross-references

- `style-matrix.md` — the row definition this file expands on.
- `cv-skeleton.md` — section keys; this style omits several by default.
- `cl-skeleton.md` — the cover letter for cold outreach is even more compressed than the CV; both share the same speculative register.
- `design-packages.md` § Recommended pairings — Copenhagen Modern and Tokyo Precision are the primary visual matches. Avoid Warm Terracotta and Pampas Contemporary; the narrative-leaning visual fights the style's brevity.
- `change-log-application.md` — recurring `risk=overstated` in this style usually signals the candidate is over-selling; the skill softens claims toward possibility framing.
