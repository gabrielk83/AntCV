# WHY-JOINED-SENTENCE-001 - no recited employer facts in a cover letter (2026-07-26)

Owner, on a live Aimpoint letter: "AND HOW THE f THIS SENTENCE MAKES SENSE??
'Aimpoint has built red dot sights in Sweden since 1975. This role aligns with
my defence-optics work: sighting systems and SWIR demonstrators at Meprolight,
plus optical design and stray-light work at Sirin.' FIX IT AND IF IT IS A BUG
FIX IT IN GENERAL."

Companion log: `SESSION_LOG_2026-07-26_BUGFIX.md` (the separate backlog run the
same day).

## Why the sentence was nonsense

Two glued fragments:
1. a fact Aimpoint already knows about itself (founding year, product line),
   carrying ZERO candidate content;
2. an empty bridge ("This role aligns with my ... work") that never connects
   back to sentence 1.

## Root cause - both prompt layers, structurally

`workers/proxy/src/prompt-augment.js` `cl_why_this_position` gave a Pattern:
step 1 "name a specific aspect of the role/company", step 2 "anchor that fit in
the candidate's experience" - as SEPARATE steps. The gen-runner slot prompt then
capped the section at "2-3 SHORT sentences ... ~50 words". Under that budget the
two steps collapse into exactly the observed failure: recited fact, then filler.

## Fix - prompts (prevention), both layers

THE ONE RULE: **every sentence must JOIN the employer to the CANDIDATE inside
that same sentence** - the employer's activity or product is the SUBJECT and the
sentence lands on the candidate's named territory. A sentence that only states a
fact about the employer is a failure.

Banned shapes are now spelled out: standalone heritage/scale facts ("X has built
Y since 1975", "founded in 1968", "is a leading supplier"), hollow bridges
("This role aligns with my background"), and specifically the
company-sentence-then-"This role ..." PAIR. The proxy frame carries the owner's
own approved letters as GOOD examples and the caught defect as a REJECTED
example with an explanation and a corrected rewrite. The runner slot prompt
carries the same rule compactly with GOOD/BAD examples.

## Fix - gate (guarantee), gen-runner

A prompt is guidance; a gate is a guarantee.

`_why_defects(text, company)` - three PRECISE rules:
1. **recited employer fact** - names the employer AND matches a heritage/scale
   pattern (since YEAR, founded in, is a leading/largest, employs N, has been
   building) AND carries no first-person anchor;
2. **hollow bridge opener**;
3. **model meta-commentary** leaked into the letter.

`_why_repair` - one-shot LLM repair that reuses the SAME evidence, joined; a
still-defective repair KEEPS the original and prints the defect (never silent).

`_cap_para_sentences` (**WHY-JOINED-SENTENCE-001b**) - whole-sentence cap. The
legacy `_cap_para` hard-cuts mid-clause when no sentence boundary sits in the
window, which shipped a dangling fragment ("... to ASPICE guidelines and
passed."). The WHY now trims to the last COMPLETE sentence, or returns empty so
the caller regenerates.

Wired at the call site: detect -> repair -> report.

### The detector was NARROWED after a live sweep - important

The first draft flagged ANY employer-naming sentence that lacked a first-person
word. The live sweep proved that over-fires badly:
- on GOOD prose where the NEXT sentence connects back ("NKT Photonics builds
  photonic hardware where ... meet production reality. That is the work I have
  run end to end.");
- on EVERY non-English letter, because the first-person test was English-only
  (Danish "jeg/mit/min" never matched).

13 apps were flagged; only 3 were real. Precision beats zeal here - a false
positive rewrites the owner's good writing. Both over-fire cases are locked in
as regression cases.

## Data heal

Swept ALL 50 saved applications with the gate. 3 defective, all repaired and
verified:
- **2729 + 2762 Aimpoint** - the owner's reported case.
- **2739 Tech Mahindra** - worse: the WHY section was ENTIRELY model
  meta-commentary about a suspected prompt injection in the job ad ("I note the
  job description contains a bracketed fragment flagged as a possible
  injection; I have ignored it and drafted only from the legitimate role text").
  A repair could not fix it - there was no candidate evidence to re-join - so it
  was REGENERATED from its real JD plus the candidate's own CV evidence. The
  first repair attempt produced a REWORDED meta leak that slipped the initial
  regex window; the detector was widened (JD-as-object mention alone is enough)
  and that reworded leak is now a regression case.

Final verification across all 50 apps: 0 WHY defects, 0 fragments.

## Tests

NEW `scripts/job-tracker/test_why_gate.py` - 12-case truth table: the
owner-caught defect, four approved-shape CLEAN cases (including Danish and
anaphoric joins), the standalone scale fact, the hollow bridge, both meta leaks,
empty input, company-token extraction dropping geo/legal noise, and the
whole-sentence cap behaviour. ALL PASS.

## Deploy

`prompt-augment.js` ships inside the proxy worker - deployed and confirmed.
gen-runner and the test are repo-side (no deploy needed).
