# LinkedIn post - product perspective (2026-07-02, rev 8)

Follows the Terence method recorded in [PROBLEM_STATEMENTS.md](PROBLEM_STATEMENTS.md):
problem and persona first, then the product "why", then the build. Rev 6 (owner ask):
Pain 1 order flipped - quality-cost first, then the damage of a bad quality-cost
(invented claims); graphic concepts added in the style of the v33 post animation
(dark grid, glass panels, Supervisor pipeline, glow accents, sparkle). Tone guard:
no banned words, no em dashes, short factual sentences, no pitch.

---

## The post

You read the job description. You can do the work. You are just not sure your
application shows it.

That gap is the product problem behind AntCV, a working system I built and use
for my own job search in Copenhagen.

After my last post, a friend gave me direct feedback: the demo showed a
solution, but not the problem or the people it serves. Fair. So here is the
product view: the pains first, then what was built against each one.

Who is it for? I build and test with three people in mind:

- A career-changer who has the skills for the new field, but whose CV still
  carries the old job title - so recruiters never reach the relevant part.
- An operations specialist whose CV lists every task she carried, but not what
  changed because she was there.
- And me: recruiters kept asking how hands-on I am with AI. A fair question -
  my CV never made that side of my work easy to find.

(Two of the three are synthetic test personas - one is an ant. That keeps real
candidate data out of the code, and it forces the engine to handle profiles
very different from mine.)

Pain 1: "Every model release and price change moves the quality-cost line -
and when quality slips, AI starts inventing things I never did."
Built: a cost-quality function that is tuned, not trusted, with honesty as the
hard floor under it. A router scores every response for adequacy, demotes a
provider on the specific task it underperforms, and slots new models into the
supporting cascade as they release - the flagship generator changes only when
a candidate proves better on real output. The floor: reframe, never invent;
unsupported claims are flagged, not written. Your own LLM keys,
element-by-element review, and an AI-disclosure mark on every export.

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

## Graphic options (style-matched to the v33 animation)

Shared style cues from the video: dark slate grid background, frosted-glass
panels with a gloss highlight, bold white labels, glowing cyan arrows, blurred
document cards, the four-point sparkle accent bottom-right.

**A. Pipeline hero (ready as SVG):**
[LINKEDIN_POST_2026-07-02_graphic-a.svg](LINKEDIN_POST_2026-07-02_graphic-a.svg)
- 1200x627 (LinkedIn 1.91:1). Left glass panel = the three pain quotes; center
  Supervisor panel with the three built layers (quality-cost router / author
  fit / reader context, "MULTI-LLM CONSENSUS" caption); right = Target Job
  Description card with "CV + cover letter, hours -> minutes". Mirrors the
  video's Fit/Gap Matching frame so the post reads as a continuation.
- Export to PNG at 2x for LinkedIn (e.g. Edge/Chrome print-to-image, or
  `npx sharp` / any SVG-to-PNG step).

**B. Before/after split (image-gen prompt):**
"Split-screen product graphic, dark slate background with a faint blueprint
grid. Left: a blurred generic CV page in grey glass, labeled 'sounds like AI'.
Right: the same page sharpened, warm-lit, labeled 'sounds like you', with
small tags: 12 styles, 4 languages, personality kernel. Frosted glass panels,
glowing cyan edge light, bold white sans-serif labels, one four-point sparkle
bottom right. No people, no logos. 1200x627."

**C. The ant courier (brand tie-in, image-gen prompt):**
"A single stylized ant carrying a glowing rectangular CV card across a dark
blueprint grid toward a large glass panel titled 'Target Job Description'.
Path drawn as a dotted glowing line with three checkpoints labeled: quality
gate, voice fit, reader fit. Dark slate palette, frosted glass, cyan glow,
bold white labels, four-point sparkle accent. Minimal, technical, calm; no
cartoon face on the ant. 1200x627."

**D. Personality test, two directions (image-gen prompt):**
"Center: a glass card titled 'Personality test' with 8 small toggle rows. Two
glowing arrows leave it in opposite directions: left arrow to a recruiter-side
CV panel labeled 'Work Style - behaviour, not adjectives'; right arrow into a
gear-like engine panel labeled 'generation tuned to the author'. Dark
blueprint grid, frosted glass, cyan glow, white bold labels, sparkle accent.
1200x627."

Recommendation: A as the post image (continuity with the video); C as a
comment-thread follow-up image if engagement warrants it.

---

## Notes

- Hook = the general problem statement from PROBLEM_STATEMENTS.md section 1.
- Pain 1 order per owner: quality-cost function first, then the damage of a
  bad quality-cost (invention). Mechanisms: ee() router, output-adequacy gate,
  per-task provider demotion, runtime quality-price scorer + daily
  model-freshness check, sonnet-5 into the cascade 2026-07-02 while flagship
  gen stays Opus 4.7 until proven; anti-fabrication, flagged claims, own keys,
  per-element review, AI-disclosure.
- Pain 2 = merged voice/fit pain: 12 writing styles; generation targets
  en/da/es/zh; wizard + spell layer cover 20+ incl. Amharic, Faroese,
  Greenlandic; cross-language invariants = kernel-v2 crossPolicy; Danish
  conventions; personality quiz (antcv-personality-quiz-439.js, six trait
  clusters, behaviour-evidence rendering); banned-words layer. No VIA mention
  per owner.
- Pain 3 mechanisms: GEN-PROFILE-001 opener switch, APPLICATION-QA bridge,
  semantic constraints, abbreviation first-use rules, JD-gated niche depth.
- The "friend" line credits the Terence feedback without naming him.
- No em or en dashes anywhere; plain hyphens only.
