# LinkedIn Introductory Post — Revised

**Status:** Draft for review. Signature included pending approval.

---

AntCV sits where engineering meets people work. A CV is too entangled with the specific candidate to be a generic AI prompt — so AntCV is not one. Disagreement and pushback welcome, skeptics included.

From the beginning, I was skeptical that a single-model approach was enough for something as sensitive as job applications.

In practice, no model was "best." One was cleaner at extracting requirements. Another kept structure better. A third handled Danish more naturally. Some were fast and cheap, but needed stricter validation.

That pushed the app toward routing and supervision, not model loyalty.

AntCV runs as supervisor-driven orchestration — task routing, output validation, retries on banned terms, invented metrics, or overclaimed role scope, watermarking, change logging:

* requirement extraction
* fit and gap analysis
* multilingual adaptation with per-language banned-term lists
* validation checks
* deterministic document export
* provenance tracking with confidence and risk
* replayable orchestration flows
* 12 styles × 7 packages, orthogonal — per seniority, target company, taste; JD signals suggest switches

The development workflow mirrored the architecture. I used Claude Code as the agentic operator for refactors, regression matrices, test corpora, and documentation alignment — with my own review and rollback at every commit. Coursework at DTU on AI systems and agentic development, combined with independent study, sharpened how I think about when to delegate, when to validate, and where the human stays in the loop.

The same rules ship as a Claude skill, portable across models. Content and style are entangled with the user, improve with each manual edit, are watermarked, and require human review.

One principle became important: if my own AI cannot reliably read and parse the documents it generated, how can I expect recruiter systems to do it correctly?

That shaped structure, accessibility, machine readability, and tiered ATS export for modern (Greenhouse, Lever, Ashby) and legacy (Taleo, iCIMS) parsers.

The visual side is useful, but not the core. The harder part is making the material structured, readable, traceable and safe enough for human review.

The demo environment mattered too. I used a fictional candidate profile, not my own data, to test whether the system could run end-to-end without leaking personal information, mixing profiles, or inventing unsupported claims.

That made it easier to test the uncomfortable parts: data isolation, hallucination control, semantic constraints, provenance, and whether the documents could still be parsed correctly by the system itself.

Recent work:

* provider benchmarking and per-language provider scoring
* JD Gap Closure — system-flagged gaps become user-supplied evidence
* multilingual, ATS and hallucination test corpus
* GDPR + EU AI Act — EU storage, retention, wipe, transparency, candidate-side
* WCAG for UI and documents
* early C2PA on the change-log spine

Still improving:

* larger real-world benchmark coverage
* richer provenance / confidence UX
* replay analysis beyond timelines
* orchestration complexity control

Big thank you to Nischa Don Maak, Inbar Meiroviz, Rinah Yaya, and Anders Larsen for ideas and discussions that pushed my thinking further.

Gabriel Alexander Karp-Gershon

#AIAct #EUAIAct #ResponsibleAI #AIOrchestration #LLMOps #HumanInTheLoop #ContentProvenance #C2PA #WCAG #GDPR #PrivacyByDesign #ATSCompatibility #HRtech #ITDanmark

---

## Above-the-fold check

The opening (first 200 chars) is the hook visible before "see more":

> AntCV sits where engineering meets people work. A CV is too entangled with the specific candidate to be a generic AI prompt — so AntCV is not one. Disagreement and pushback welcome, skeptics included.

Three things in 200 chars:

1. **Duality** — engineering + people work
2. **Personalization stake** — too entangled to be a generic AI prompt
3. **Dialog invitation** — pushback welcome, skeptics included

## What changed from the previous revision

| Change | Reason |
|---|---|
| Hook opening with duality + dialog invitation | Your direction |
| Dropped "I built it to reduce..." paragraph | Personalization stake now in the hook |
| Supervisor capabilities sentence (single sentence with em dash) | Your direction: surface supervisor's actual work — routing, validating, retrying on banned terms / invented metrics, watermarking, logging |
| "deterministic PDF/DOCX export" → "deterministic document export" | Your direction |
| 12 × 7 bullet expanded with seniority / company / taste / JD signal switches | Your direction on per-user-per-application style adaptation |
| Claude skill sentence — tied to supervisor | "The same rules ship as a Claude skill, portable across models. |
| Personalization triple added | Content and style entangled with user, improve with manual edits, watermarked, require human review |
| Recent work bullets pruned per your edited list | Verbatim from your version; dropped orchestration replay (covered by engine bullet), per-modification confidence (covered by provenance engine bullet), layered sidecar (engineering detail not critical to readers) |
| Dropped "That is where it becomes interesting" pivot | Space tradeoff — personalization paragraph already carries the trust framing |
| Hashtags expanded: +#C2PA, +#PrivacyByDesign, +#ATSCompatibility | Your direction |
| Signature added: name only | Your direction |
| Role-scope added to retry list ("overclaimed role scope") | Aligned with locked plan §4.5 role-boundary integrity (added 2026-05-27) |
| Multilingual bullet refined to "per-language banned-term lists" | Aligned with locked plan §4.5.3 language-partitioned schema (added 2026-05-27) |
| Agentic-development paragraph added (Claude Code as operator + DTU coursework + independent study) | Your direction: surface the learning and the dev workflow that mirrored the product's supervisor architecture (added 2026-05-27) |

## Voice and constraint check

- Banned words/phrases/patterns from your style preferences: clear.
- Em dashes only. No exclamation marks. No filler transitions.
