# Generic CL + CV templates with embedded prompts — 2026-06-30

Owner-supplied `CoverLetter_Template_Generic (2).docx` + `CV_Template_AntCV_Prompts_Generic (3).docx`.
Both embed a `[WRITING RULES]` block (banned vocabulary + semantic constraints). The CL adds a
recruiter-answers second page for the JD-asks-questions use-case. These are the canonical templates
for **export + generation + enhance/fix-it**.

## WRITING RULES (shared, both docs)
**Banned words:** spearhead, ensure, foster, streamline, strengthen, empower, leverage, enable,
robust, comprehensive, cutting-edge, state-of-the-art, world-class, leading, impactful, rooted,
grounded, committed, passionate, holistic, cross-functional, collaborative, journey, dynamic,
proactive, results-driven, strategic, agile, discuss.
**Banned phrases:** "drive change", "deliver value", "key role", "pivotal role", "proven track
record", "strong communicator", "strategic mindset", "mission-driven", "I am passionate about",
"I look forward to hearing from you", "responsible for", "end-to-end".
**Semantic constraints:** never invent metrics (use scope/method/outcome if no real number);
don't imply ownership not supported (contributed/supported/partnered/coordinated); team verb is
directed/supervised/ran, NEVER bare "led"; WHAT I BRING / CORE COMPETENCIES expertise cell max
~2 lines / ~90 chars; plain hyphen "-" only, never em dash; keep patent numbers verbatim; WORK
STYLE ends on a people skill; positioning/triad line ≤ 3 concepts; write in the target language,
never fall back to English on a non-English request.

## CL structure
greeting → opening → why → who → foundation (lead + Hands-on + Professionally) → WHAT I BRING
(intro line: anchor word + areas + colon, then 3-4 [Need]:[action] rows) → HOW I WOULD CONTRIBUTE
(intro + 4 actions + Goal) → closure → "At your service," → name → signature → AI notice.
**Page 2 (only if the JD asks questions):** ANSWERS TO RECRUITER QUESTIONS — count N JD questions,
output exactly N question+answer blocks in JD order; detect questions in any form (numbered /
prefixed / imperative); ground each in real experience (3-5 sentences, situation-action-result,
real number only if true) or write "[needs candidate input on <topic>]"; "Kind regards," sign-off.

## CV structure
positioning triad (≤3 anchors) → PROFILE (2-3 sentences, lead with a real proof point) → Work Style
(one line, only if the JD signals it; ends on a people skill) → CORE COMPETENCIES (6 Focus/Expertise
rows by JD priority) → PROFESSIONAL EXPERIENCE (reverse-chron; newest ~3 bullets; each role ends on
a `Results:` headline number) → PUBLICATIONS & PATENTS → Tools & Methods (groups) → CERTIFICATES →
EDUCATION → REGULATORY CONTEXT (groups) → LANGUAGES → INTERESTS → ACCESSIBILITY → ADDITIONAL.
AI notice: show on the column with FEWER text lines (owner's two-box idea).

## DONE (1.50.992-993, live)
- Semantic-constraints floor (`antcv-banned-audit` BASELINE_WORDS/PHRASES) = the full banned list;
  the audit flags them in generated content (merges with the user's own banned_words).
- Generation Nordic rule point (7) = the full WRITING RULES (banned words+phrases + semantic
  constraints); point (8) closure+language; point (9) WHAT I BRING intro-line shape.
- RECRUITER-QUESTIONS-001 generation rule (count N → N answers, detect any form, ground-or-placeholder).
- me() Nordic CL skeleton already = the generic template body (1.50.991); 971 INSTR in sync.
- enhance "Fuse CL→CV" already enforces a near-identical banned list.

## DONE (1.50.995, live)
- **me() CV admin template rebuilt** to `CV_Template_AntCV_Prompts_Generic (4)` (commit 8374f25):
  PROFILE = 2-3 factual sentences + WRITING-RULES/COHERENCE essence; WORK STYLE one line ending on a
  people skill; per-role `Results:` headline added to experience r1-r5 (role.results, worker already
  renders it); SELECTED OUTCOMES kept (owner: it represents results); LANGUAGES / INTERESTS /
  ACCESSIBILITY split into their own sidebar sections in docx order before ADDITIONAL (catch-all +
  data source). `_antcvBlankTemplateSection` re-templates role.results. me() builds 15 sections;
  unit 528/528; boot-smoke clean. Positioning triad = personalInfo.specialization (already enforced
  <=3 concepts in the gen prompt), not a me() section. Owner to verify a real CV export.

## OPEN (next session)
1. **Contact-line sidebar bridge (structured figure)** — owner request: in band-overlap bridge mode the
   contact line font-shrinks to cram one line into the narrow text cell (worker index.js ~25478-25500);
   owner wants a structured figure that ALLOWS long contact text (wrap / full-width row). Design pick
   pending; worker change, PDF-BLANK-PAGE risk, real-export-gated.
2. **Recruiter-answers PAGE rendering** — the generation rule + `questions_in_jd` + worker
   `jd_questions` exist; verify the page renders exactly N Q/A blocks (header band + "Kind regards,"
   + AI notice), only when the JD has questions, on a real export.
3. **AI-notice two-box** — owner's design: sidebar-colored box at the bottom of BOTH columns, text
   in the column with fewer lines; fills the sidebar-color gap. WORKER change; blank-page risk →
   bottom-anchored only; verify with a real export.
4. **`bring_intro` generation field** — so the WHAT I BRING intro line is actually emitted on a fresh
   generation (schema + apply + 987 bridge); today the lead is clean but empty.
5. **CV orphans** (20-40-char tails), **Strategic Expertise cell overflow**, **zoom 5% / export-preview
   75%**, **eliminate the refresh for CloudConvert** — carried from SESSION_2026-06-30_CL_HARDENING.md.

## Notes
- Audit is a FLAG (console + `antcv:banned-hits` event + `window.__antcvBannedHits`), not auto-strip
  — common words (ensure/leading/strategic/responsible for) won't be silently mangled.
- Bare "deliver"/"drive" deliberately NOT in the floor (too broad); their vague uses caught by the
  "drive change" phrase + the prompt's "vague deliver" note.
