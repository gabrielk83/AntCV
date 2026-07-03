# JD-specific CV compression spec (owner gold-standard, 2026-06-22)

Source of truth: the owner hand-edited the generated NVIDIA "Test Engineer - Photonic"
CV into the shape he wants for **JD-targeted** CVs, then asked us to reproduce it and
build the app rule from it. The reference artifact (his version + the one VBA fix) is
`CV_..._NVIDIA_Test_Engineer_Photonic_TRIMMED_REF.docx`.

This spec governs generation/trim ONLY when a specific JD is present
(`antcv:lastJdText` ≥ 30 chars). Unsolicited/no-JD CVs keep the fuller breadth.

## The rules (derived from his edits, source → his trim)

1. **Force-keep JD-named tools/skills.** Any tool, language, method, or standard named
   in the JD is always kept and surfaced early — even under aggressive compression.
   (He dropped VBA by mistake; the JD said "Python and VBA", so VBA must stay. JMP,
   if present in his data, would also be surfaced.) This rule overrides compression.

2. **Ruthless abbreviation.** Compress every phrase to its essence:
   - `silicon-photonics integration` → `SiPh integration`; `COMSOL Multiphysics` → `COMSOL`;
     `nanotechnology` → `nanotech.`; `business-plan` → `biz-plan`; `Optical benches` → `Benches`;
     `Electro-optic conversion function` → `EO conversion function`.
   - Flatten `;`-grouped lists into plain comma runs.

3. **(NOT A RULE — owner correction 2026-06-22.)** Cross-section de-duplication is
   NOT a generation rule. Keeping a fact in its primary/most-relevant section is fine;
   do NOT systematically strip it from a second section. The Six Sigma (certs) and
   "hearing impaired" (profile) removals in his edit were incidental, not a principle.
   The ONE de-dup that DOES hold is the existing RESULTS rule: a Results line must not
   merely restate one of the role's own bullets (RESULTS-CUT-003 / derive-numeric-only).

4. **JD-echo renaming + within-group relevance ordering.**
   - Rename to mirror the JD: `Validation` → `Test and validation` (JD title = "Test
     Engineer"); `Regulatory Context` → `Regulatory Certificates`.
   - Order WITHIN a group so the most JD-relevant item leads: `Test and validation`
     first in Methods; AI-assisted leads with `Measurement analysis` (JD: "data analysis").

5. **Section placement is SPACE-driven and serves a DESIRED-VISUAL target (owner
   corrections).** Where a section sits (which column, which page) is a function of
   available space: pack sections to use the space efficiently, and **pull content into
   the MAIN column when it fits there** rather than leaving the main column short.
   Education landing on page 2 was a FIT decision, not "low relevance". This is a
   layout/pagination concern (overlaps the app's existing autoPages + sidebar-fill), NOT
   a relevance ranking of sections.
   - **The packing target is the owner's desired visual density: crowded vs. a clean
     N-page (e.g. 2-page) spread.** Compression aggressiveness AND placement both serve
     that target — compress harder + pack denser to hit "crowded"/fewer pages; ease off
     + spread to land a clean 2-page layout. So the same content can legitimately trim to
     different depths depending on the density goal; the goal is an input, not fixed.
     (Ties to the existing Fit / page-target controls — reuse, don't reinvent.)

6. **Flatten list sub-headers ONLY when the list is VERY short (owner correction).**
   A short Regulatory list dropped its "Optical and Photonic Standards" /
   "Imaging & Electro-Optical" sub-headers → one flat terse list. Keep sub-headers when
   the list is long enough to benefit from grouping.

7. **Results = the single most JD-relevant fact**, complete, never truncated, never a
   restated bullet. (Builds on RESULTS-CUT-003.)

8. **Certificates: drop codes + non-relevant + duplicates.**
   `AI-Practitioner / CNX-CAIP` → `AI-Practitioner`; drop BABOK, Prøve i dansk 2, and
   the duplicate Six Sigma.

9. **Accessibility: one tight line.** Full sentence → `Hearing impaired: Cochlear
   implant user. Captions & written follow-up work well.`

## Contrast with the first (naive) trim
The first pass only removed clearly-irrelevant lines and de-truncated Results. The
gold standard additionally: force-keeps JD-named tools, abbreviates everything,
renames + orders within groups to mirror the JD, flattens sub-headers on very short
lists, and packs content by available space (main-column first). The difference is
editorial compression + JD-echo + space-aware layout — NOT cross-section de-dup and
NOT relevance-ranked section reordering (both explicitly rejected by the owner).

## Implementation notes (for the build step)
- Gate on JD presence (reuse `antcv:lastJdText` ≥ 30, as `antcv-why-context-title.js` does).
- Force-keep set = tokens extracted from the JD (tools/langs/standards) intersected
  with the user's real data — never invent. See [[ordering-jd-cluster-top-skills]] and
  [[cluster-demand-model]] for JD-token extraction already in the codebase.
- Abbreviation/compression is content-altering → owner-gated by
  [[dont-hide-controls-as-duplicates]]; this spec IS that owner approval, scoped to
  JD-targeted CVs only. Keep the fuller version recoverable (no-JD path unchanged).
- Do NOT build cross-section de-dup or relevance-ranked section reordering (rule 3 + the
  old rule 5 — both rejected). Section PLACEMENT is space/fit-driven and belongs with the
  existing autoPages + sidebar-fill pagination, not a content rule.
- Likely a generation-prompt change (worker) + a client trim sidecar; needs an
  owner regen to verify. Parity: preview + export ([[export-sanitize-and-preview-parity]]).

## Additions (owner 2026-07-03, NIL application — "do not forget")

10. **Adapt the SPECIALIZATION and the CL SLOGAN to the JD.** The header positioning
    triad (`personalInfo.specialization`, the "Application:" band line) and the CL
    slogan (standalone keys `antcv:clSlogan` etc.) must be regenerated/adapted per
    targeted application, not carried over from the previous one.

11. **Sidebar relevance cut with an explicit EXEMPT LIST.** Cut everything irrelevant
    to the JD from the sidebar — EXCEPT Interests, Languages, and Accessibility, which
    always stay. (Extends rules 2/8 from item-level trims to whole irrelevant
    entries/groups; rule 3's "no cross-section dedup" still holds.)

12. **Merge positions; remove or rephrase bullets.** Roles with low JD relevance may be
    MERGED (e.g. two adjacent same-employer roles become one entry) and their bullets
    removed or rephrased toward the JD. Variant-tolerant `_samePosition` machinery
    exists (role-doubling fix 1.51.41) — merging must never duplicate or ghost a role.

13. **When the JD contains applicant questions → the CL gets its second (Q&A) page.**
    Machinery SHIPPED (APPLICATION-QA-001: P1 renders from
    `antcv:applicationQuestions`; P2+P3 bridge antcv-application-qa-detect.js fills it
    from rationale.questions_in_jd or POST /api/jd-analysis). For the NIL application
    the bridge never fired because parse_jd crashed (LADDER-CONST-CRASH-001, fixed
    1.51.97) — VERIFY after the owner's NIL regen that the second CL page appears.

## Round-4 review additions (owner 2026-07-04, first NIL-targeted export)

14. **CV header keeps the SPECIALIZATION line.** The targeted export replaced the
    positioning triad with "Application: <role> — <company>". The Application line
    must not displace the specialization (adapted per rule 10); decide placement so
    both roles are served (CL may carry the Application line; CV leads with the
    adapted specialization).

15. **TOOLS & METHODS: hide ALL JD-irrelevant entries.** The NIL export kept the
    full bloated list. Rule 11's exempt list (Interests/Languages/Accessibility)
    does NOT cover tools — tools get the aggressive cut: hidden:true for every
    category/item the JD does not need.

16. **Role bullets: 3-4 max, most JD-relevant only.** Per visible role.

17. **MERGED role: up to 5 bullets (highest fit) and MORE THAN ONE Result.**
    A merge combines two roles' evidence — one Result line under-sells it.

18. **Hide-for-this-role-class set:** Security Guard, Students Council
    Representative, Team Operations Manager (Pan Idræt) are irrelevant for
    hands-on engineering roles (on:false, never deleted — rule from
    sections-hide-over-delete).

19. **Regulatory: few items → ONE flat list** (extends rule 6: no group subheads
    when the visible set is small). For NIL specifically: STANAG 4694
    (weapon-mounted sight) and STANAG 4355 (ballistics/fire-control) are
    irrelevant — environmental detail was also too deep for the role.

20. **Accessibility: SHORT.** One tight line (rule 9 stands) — and the phrase
    "It has not limited his career" (any variant) is BANNED EVERYWHERE.
    ACCESS-NO-COMMENT-001 already bans it in the prompt and the model violated
    it → needs an ENFORCEMENT BELT (post-gen scrub), not more prompt text.

21. **Patent bullet wording:** the stray-light window bullet must carry the word
    "patented"/"patent" ("Co-invented the patented stray-light optical window…");
    the patent NUMBER stays only in Publications (existing rule).

22. **Profile: no filler, no disability.** "Has worked with people from many
    backgrounds; hearing impaired, which has not limited his career." violated
    BOTH PROFILE-NO-FILLER-001 and PROFILE-NO-DISABILITY-001 (already in the
    prompt) → enforcement belt required: post-gen profile scrub (strip
    disability/accessibility mentions + the banned career-comment phrase +
    generic people-filler from profile_content).

23. **CL SLOGAN adapts per role — surprising, innovative connection.** The
    standing "PROCESSES • PRODUCTS • PEOPLE" must not survive a targeted gen
    (strengthens rule 10): generate a role-fitted slogan that connects the
    candidate to THIS role in an unexpected way.

24. **CL Q&A = a real SEPARATE PAGE.** Hard page break before it; its own
    candidate header/section, its own closure, sign-off, name, signature, and
    AI notice — a standalone answer sheet, not a continuation block.

### Rule 16/17 clarifications (owner 2026-07-04, delivery-run review)

- **16a. A NON-merged role never gets merged-role bullet counts.** Kanzen
  (single role) exported 6 bullets — wrong: a plain role keeps 3 bullets, the
  most JD-relevant tasks only. Only a MERGED role may go up to 5 (rule 17).
- **17a. Merged-role TITLE ORDER: function first, lead after.** Not
  "Electro-Optics Team Leader / R&D Electro-Optics Engineer" but
  "Electro-Optics Engineer & Team Leader" — the craft identity leads, the
  leadership qualifier follows, joined with "&", no slash-title chains.
