# LinkedIn post - product perspective (2026-07-02, rev 5)

Follows the Terence method recorded in [PROBLEM_STATEMENTS.md](PROBLEM_STATEMENTS.md):
problem and persona first, then the product "why", then the build. Rev 5 (owner ask):
Pains 2+4 merged into one voice/fit pain (languages + writing styles + personality
test serve the same purpose); banned-words layer moved from Pain 1 into it (it is a
voice feature, not a trust feature); Pain 1 keeps trust + cost-quality only; no VIA
mention. Tone guard: no banned words, no em dashes, short factual sentences, no pitch.

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
Your own LLM keys, element-by-element review, and an AI-disclosure mark on
every export. Underneath, a router scores every response for adequacy, demotes
a provider on the specific task it underperforms, and slots new models into
the supporting cascade as they release - the flagship generator changes only
when a candidate proves better on real output.

Pain 2: "AI applications all sound the same - not my language, not my market,
not my voice."
Built: fit to the author, in three layers. Twelve writing styles, from Nordic
Minimal to Research Formal, generated in English, Danish, Spanish or Chinese,
with a language layer that spans more than twenty - Amharic to Greenlandic.
Language rules decide what crosses a translation and what never does: role
stories cross; company names, patent numbers, metrics and tool names stay
untouched. Danish conventions are defaults, not add-ons: one-page ansøgning,
value-to-employer framing, unsolicited (uopfordret) applications as a
first-class flow. And a short personality test works in two directions at
once: toward the recruiter it becomes a Work Style section that shows soft
skills as behaviour ("keeps decisions steady when timelines tighten"), never
as a list of adjectives; toward the engine it tunes generation to the author's
own pattern, so the wording matches how the candidate actually works and
writes. A banned-words layer guards the result against corporate filler.

Pain 3: "Generic AI output ignores who is actually reading."
Built: context awareness through the whole chain. The engine knows a targeted
application from an unsolicited one and changes the opening identity to match.
It reads the questions hidden inside a posting and answers them in the letter.
It knows "agile" the method from "agile" the buzzword, expands an abbreviation
on first use in the body text, and keeps niche technical depth only for the
roles that ask for it.

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

- Hook = the general problem statement from PROBLEM_STATEMENTS.md section 1.
- Pain 1 = trust + cost-quality only: anti-fabrication, flagged claims, own
  keys, per-element review, AI-disclosure; ee() router, output-adequacy gate,
  per-task provider demotion, runtime quality-price scorer + daily
  model-freshness check, sonnet-5 into the cascade 2026-07-02 while flagship
  gen stays Opus 4.7 until proven. Banned-words moved OUT (voice feature).
- Pain 2 = the merged voice/fit pain: 12 writing styles; generation targets
  en/da/es/zh (app.src.js language maps); wizard + spell layer cover 20+ incl.
  Amharic, Faroese, Greenlandic; cross-language invariants = kernel-v2
  crossPolicy; Danish conventions; personality quiz
  (antcv-personality-quiz-439.js: 8 forced-choice questions, six trait
  clusters -> personalInfo.personality, rendered as behaviour-evidence, never
  raw adjectives, injected into generation + Work Style section); banned-words
  layer. The quoted behaviour line is a real trait evidence string from the
  quiz. No VIA mention per owner.
- Pain 3 mechanisms: GEN-PROFILE-001 opener switch, APPLICATION-QA bridge,
  semantic constraints, abbreviation first-use rules, JD-gated niche depth.
- The "friend" line credits the Terence feedback without naming him.
- No em or en dashes anywhere; plain hyphens only.
