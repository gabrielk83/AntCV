# LinkedIn post - product perspective (2026-07-02, rev 4)

Follows the Terence method recorded in [PROBLEM_STATEMENTS.md](PROBLEM_STATEMENTS.md):
problem and persona first, then the product "why", then the build. Rev 4 (owner ask):
added Pain 4 = personality test, two directions (recruiter sees soft skills as
behaviour; generation tuned to the author's own pattern). Pain 1 = trust +
cost-quality function; Pain 2 = languages (EN/DA/ES/ZH generation, 20+ layer);
Pain 3 = reader context. Tone guard: no banned words, no em dashes, short factual
sentences, no pitch.

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

Pain 1: "AI tools invent things I never did, and their quality drifts with
every model release and price change."
Built: honesty as a constraint, and a cost-quality function that is tuned, not
trusted. Reframe, never invent; unsupported claims are flagged, not written.
Your own LLM keys, element-by-element review, a banned-words layer against
corporate filler, and an AI-disclosure mark on every export. Underneath, a
router scores every response for adequacy, demotes a provider on the specific
task it underperforms, and slots new models into the supporting cascade as they
release - the flagship generator changes only when a candidate proves better on
real output.

Pain 2: "My story reads differently in every language and market."
Built: twelve writing styles, from Nordic Minimal to Research Formal, generated
in English, Danish, Spanish or Chinese, with a language layer that spans more
than twenty - Amharic to Greenlandic. Language rules decide what crosses a
translation and what never does: role stories cross; company names, patent
numbers, metrics and tool names stay untouched. Danish conventions are
defaults, not add-ons: one-page ansøgning, value-to-employer framing,
unsolicited (uopfordret) applications as a first-class flow.

Pain 3: "Generic AI output ignores who is actually reading."
Built: context awareness through the whole chain. The engine knows a targeted
application from an unsolicited one and changes the opening identity to match.
It reads the questions hidden inside a posting and answers them in the letter.
It knows "agile" the method from "agile" the buzzword, expands an abbreviation
on first use in the body text, and keeps niche technical depth only for the
roles that ask for it.

Pain 4: "AI-written applications all sound the same - and none of them sound
like me."
Built: a short personality test, working in two directions at once. Toward the
recruiter, it becomes a Work Style section that shows soft skills as behaviour
("keeps decisions steady when timelines tighten"), never as a list of
adjectives. Toward the engine, the same profile tunes generation to the
author's own pattern, so the wording matches how the candidate actually works
and writes. A VIA character-strengths report can feed it too.

Result: application preparation went from hours to minutes, in the candidate's
own voice, under the candidate's own control.

Why build it this way: I wanted one artifact that shows product thinking and
applied AI at the same time - problem selection, trade-offs, and a shipped
system (a PWA on Cloudflare, multi-LLM routing with supervisor and consensus
checks).

If you hire, recruit, or are searching yourself: which of the four pains
sounds most like yours? That answer decides what I build next.

#productmanagement #appliedAI #jobsearch #buildinpublic

---

## Notes

- Hook = the general problem statement from PROBLEM_STATEMENTS.md section 1.
- Pain 1 merges the honesty stack (shipped pre-babel-fish) with the live
  cost-quality work: ee() router, output-adequacy gate, per-task provider
  demotion, runtime quality-price scorer + daily model-freshness check,
  sonnet-5 slotted into the cascade 2026-07-02 while flagship gen stays
  Opus 4.7 until proven.
- Pain 2 language facts verified in code: generation targets en/da/es/zh
  (app.src.js language maps); wizard + spell layer cover 20+ incl. Amharic,
  Faroese, Greenlandic; cross-language invariants = kernel-v2 crossPolicy.
- Pain 3 mechanisms: GEN-PROFILE-001 opener switch, APPLICATION-QA bridge,
  semantic constraints, abbreviation first-use rules, JD-gated niche depth.
- Pain 4 mechanisms: antcv-personality-quiz-439.js (8 forced-choice questions,
  deterministic, six trait clusters -> personalInfo.personality; traits render
  as behaviour-evidence, never raw adjectives; injected into generation as
  behaviour evidence + canonical work-style line + render constraints);
  antcv-personality.js Work Style sidecar (VIA Character Strengths PDF import,
  apply-to-CV work_style section). The quoted behaviour line is a real trait
  evidence string from the quiz.
- The "friend" line credits the Terence feedback without naming him.
- No em or en dashes anywhere; plain hyphens only.
