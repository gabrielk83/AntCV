# Cover-letter Application Q&A page — spec (owner 2026-06-22)

## What the owner asked
Some job postings include **specific questions to answer as part of the application package**. When
the JD analysis detects this, a **new page should open in the cover letter** containing:
1. a **candidate** header section (who is answering), and
2. a **rich_block** of the **questions and answers**, where each answer is grounded in the
   candidate's real experience / methodology / proof points.

Today: **none of this exists** in code (no `qna` / `application-question` / `questions-to-employer`
section, generator field, or analysis output). This is net-new. Related but separate: the Analysis
panel's "questions TO employer" recommendations (see memory `analysis-questions-to-employer`) — that
is the candidate asking the employer; THIS feature is the employer asking the candidate.

## Data model
- New CL section, appended after `closure`:
  `{ id:'application_qa', title:'APPLICATION QUESTIONS', loc:'main', on:<only when questions exist>,
     type:'rich_block', leadBold:true, headlineOff:false,
     items:[ {grp:true, t:'<candidate header line>'},        // candidate intro row (group sub-head)
             {b:'<question 1>', t:'<answer 1>'},              // one row per Q&A
             {b:'<question 2>', t:'<answer 2>'}, … ] }`
- Reuses `rich_block` end-to-end (preview render, docx-client, worker, editor) — no new section type.
- Page break: set `pageBreakBefore` so it starts on its own sheet ("a new page opens up").
- `on:false` (hidden) when the JD carries no application questions, so it never shows on a normal CL.

## Pipeline (3 phases — build + verify each before the next)

### P1 — Section scaffold (verifiable headless NOW, no regen)
- Define the `application_qa` rich_block section; ensure preview + export render the candidate row +
  Q&A rows and honor `pageBreakBefore`. Editor already handles rich_block.
- A migration sidecar `antcv-application-qa-section.js`: if `antcv:applicationQuestions` (see P2) is
  non-empty and the section is absent, insert it (hidden→shown); idempotent; remove/hide when empty.
- Diag: inject questions → section appears, rich_block renders Q + A, starts a new page.

### P2 — Detection (JD analysis)
- The `jd-analysis` worker (see memory `analysis-report-pdf`) returns an `application_questions: []`
  array when the JD text contains an application questionnaire (heuristic + LLM extraction: look for
  "answer the following", numbered question lists, "in your application please address…").
- Client stores them at `localStorage['antcv:applicationQuestions']` (mirrors `antcv:lastJdText`),
  which P1's sidecar watches.

### P3 — Answer generation
- Generation prompt: when `application_questions` is present, emit `cl_overrides.application_qa` —
  one grounded answer per question, drawn from `personalInfo.experience` / proofPoints / methodology,
  honoring banned words + the writing style. Answers concrete, first-person, no overclaim.
- Hydrate into the `application_qa` section items (P1 shape). Regen-gated; verify on a real JD with a
  question block.

## Open design questions for the owner
- Candidate header content: name + role + a one-line framing, or just a heading?
- One CL document with the extra page, or a separate exportable "Application responses" doc?
- Answer length cap per question (1–2 sentences? a short paragraph?).

## Why spec-first
P2/P3 cannot be verified without a real JD-with-questions + a regen, and the feature spans analysis
worker + generation prompt + CL render. Building it blind risks shipping unverified multi-layer code.
P1 is buildable + headless-verifiable immediately on owner confirmation of the design above.
