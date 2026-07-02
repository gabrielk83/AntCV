# LinkedIn post - product perspective (2026-07-02)

Follows the Terence method recorded in [PROBLEM_STATEMENTS.md](PROBLEM_STATEMENTS.md):
problem and persona first, then the product "why", then the build. Tone guard applies:
no banned words, no em dashes, short factual sentences, no sales pitch.

---

## The post

You read the job description. You can do the work. You are just not sure your
application shows it.

That gap is the product problem behind AntCV, a working system I built and use
for my own job search in Copenhagen.

After my last post, a friend gave me direct feedback: the demo showed a
solution, but not the problem or the people it serves. He was right. So here is
the product view.

Who it is for. I design and test against three problem shapes:

- The career-changer. The skills are real, but the last job title says
  something else, and recruiters stop reading at the title.
- The operations specialist. The CV lists duties survived, not outcomes.
- Me. Recruiters see 15+ years of product work and still ask how hands-on I am
  with AI.

(Two of these are synthetic test personas. One is an ant. Synthetic fixtures
keep real candidate data out of the code, and they force the engine to handle
profiles very different from mine.)

The problem in the candidate's words: the fit is real, but it is scattered
across years of roles, and the cover letter never quite connects experience to
what this employer needs. A recruiter who would have called skims past.

The decisions that shaped AntCV were product decisions, not model choices:

- Honesty is a feature. The engine may reframe, never invent. Unsupported
  claims are flagged, not written.
- Control stays with the candidate. Your own LLM keys, element-by-element
  review, and an AI-disclosure mark on every export.
- Language quality is enforced, not hoped for. A banned-words layer keeps
  corporate filler out of the text - the same standard this post follows.
- Danish conventions are the default, not an add-on: one-page ansoegning,
  value-to-employer framing, and unsolicited (uopfordret) applications as a
  first-class flow.

What it does: it maps a posting against your real history, shows which
requirements you already cover and which need reframing or an honest gap plan,
then drafts the CV and cover letter for your review. Preparation went from
hours to minutes. The constraints above are what make those minutes usable.

Why I built it this way: I wanted one artifact that shows product thinking and
applied AI at the same time - problem selection, trade-offs, and a shipped
system (a PWA on Cloudflare, multi-LLM routing with supervisor and consensus
checks).

If you hire, recruit, or are searching yourself: which of the three problems
above sounds most like yours? That answer decides what I build next.

#productmanagement #appliedAI #jobsearch #buildinpublic

---

## Notes

- Hook = the general problem statement from PROBLEM_STATEMENTS.md section 1,
  compressed to three sentences.
- The "friend" line credits the Terence feedback without naming him; swap in
  the name only with his consent.
- The ant line is deliberate: it demonstrates test-fixture discipline (a
  product-quality signal) and earns the one light moment in the post.
- Word "ansoegning" is written without the Danish oe-ligature for font-safe
  rendering on LinkedIn; use "ansøgning" if posting from a device that renders
  it correctly (it does on LinkedIn web).
- No em or en dashes anywhere; plain hyphens only.
