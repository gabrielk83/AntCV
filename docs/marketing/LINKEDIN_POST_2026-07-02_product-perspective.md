# LinkedIn post - product perspective (2026-07-02, rev 2)

Follows the Terence method recorded in [PROBLEM_STATEMENTS.md](PROBLEM_STATEMENTS.md):
problem and persona first, then the product "why", then the build. Rev 2 (owner ask):
the middle section is now pain -> built feature, covering multilingual writing styles,
context awareness, and the honesty guardrails. Tone guard applies: no banned words,
no em dashes, short factual sentences, no sales pitch.

---

## The post

You read the job description. You can do the work. You are just not sure your
application shows it.

That gap is the product problem behind AntCV, a working system I built and use
for my own job search in Copenhagen.

After my last post, a friend gave me direct feedback: the demo showed a
solution, but not the problem or the people it serves. Fair. So here is the
product view: the pains first, then what was built against each one.

Who it is for. I design and test against three problem shapes:

- The career-changer: real skills, wrong job title, recruiters stop at the
  title.
- The operations specialist: a CV that lists duties survived, not outcomes.
- Me: 15+ years of product work, and still the question "but how hands-on are
  you with AI?"

(Two are synthetic test personas. One is an ant. Test fixtures keep real
candidate data out of the code and force the engine to handle profiles unlike
mine.)

Pain 1: "My story reads differently in every language and market."
Built: twelve writing styles, from Nordic Minimal to Research Formal, generated
in English or Danish. Language rules decide what crosses a translation and what
never does: role stories cross; company names, patent numbers, metrics and tool
names stay untouched. Danish conventions are defaults, not add-ons: one-page
ansøgning, value-to-employer framing, unsolicited (uopfordret) applications as
a first-class flow.

Pain 2: "Generic AI output ignores who is actually reading."
Built: context awareness through the whole chain. The engine knows a targeted
application from an unsolicited one and changes the opening identity to match.
It reads the questions hidden inside a posting and answers them in the letter.
It knows "agile" the method from "agile" the buzzword, expands an abbreviation
on first use in the body text, and keeps niche technical depth only for the
roles that ask for it.

Pain 3: "AI tools invent things I never did."
Built: honesty as a constraint, not a promise. Reframe, never invent;
unsupported claims are flagged, not written. Your own LLM keys,
element-by-element review, a banned-words layer against corporate filler, and
an AI-disclosure mark on every export.

Result: application preparation went from hours to minutes, in the candidate's
own voice, under the candidate's own control.

Why build it this way: I wanted one artifact that shows product thinking and
applied AI at the same time - problem selection, trade-offs, and a shipped
system (a PWA on Cloudflare, multi-LLM routing with supervisor and consensus
checks).

If you hire, recruit, or are searching yourself: which of the three pains
sounds most like yours? That answer decides what I build next.

#productmanagement #appliedAI #jobsearch #buildinpublic

---

## Notes

- Hook = the general problem statement from PROBLEM_STATEMENTS.md section 1,
  compressed to three sentences.
- The pain -> built pairs are the smart-feature layer, each tied to a real
  shipped mechanism: 12 writing styles + EN/DA generation + cross-language
  invariant rules (kernel-v2 crossPolicy); targeted-vs-unsolicited opener
  (GEN-PROFILE-001), questions-in-JD answered in the CL (APPLICATION-QA),
  semantic constraints ("agile" methodology-only), abbreviation first-use
  rules, JD-gated niche depth; anti-fabrication + banned-words engine +
  own-keys + per-element review + AI-disclosure mark.
- The "friend" line credits the Terence feedback without naming him; swap in
  the name only with his consent.
- The ant line is deliberate: it demonstrates test-fixture discipline (a
  product-quality signal) and earns the one light moment in the post.
- No em or en dashes anywhere; plain hyphens only.
