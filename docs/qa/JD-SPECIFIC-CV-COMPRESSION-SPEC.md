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
