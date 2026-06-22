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

3. **Cross-section de-duplication.** Never state the same fact twice across sections:
   - `Six Sigma Black Belt` is in Methods→Quality → drop it from Certificates.
   - `hearing impaired…` lives in ACCESSIBILITY → remove it from PROFILE.
   - Sirin Results dropped the "7-person team / ODM site" detail → that's already the
     bullet above; Results keeps only the patent. Results must not echo a bullet.
   - Trim redundant clauses (`and failure analysis` dropped where implied).

4. **JD-echo renaming + relevance ordering.**
   - Rename to mirror the JD: `Validation` → `Test and validation` (JD title = "Test
     Engineer"); `Regulatory Context` → `Regulatory Certificates`.
   - Reorder within a group so the most JD-relevant item leads: `Test and validation`
     first in Methods; AI-assisted leads with `Measurement analysis` (JD: "data analysis").

5. **Section reordering by JD relevance.** Most relevant sidebar sections rise:
   Certificates moved up under Tools; **Education demoted to page 2**.

6. **Flatten list sub-headers when short.** Regulatory dropped its
   "Optical and Photonic Standards" / "Imaging & Electro-Optical" sub-headers → one
   flat list, each line terse (`ISO 12233: Resolution & spatial frequency`).

7. **Results = the single most JD-relevant fact**, complete, never truncated, never a
   restated bullet. (Builds on RESULTS-CUT-003.)

8. **Certificates: drop codes + non-relevant + duplicates.**
   `AI-Practitioner / CNX-CAIP` → `AI-Practitioner`; drop BABOK, Prøve i dansk 2, and
   the duplicate Six Sigma.

9. **Accessibility: one tight line.** Full sentence → `Hearing impaired: Cochlear
   implant user. Captions & written follow-up work well.`

## Contrast with the first (naive) trim
The first pass only removed clearly-irrelevant lines and de-truncated Results. The
gold standard additionally: abbreviates everything, de-duplicates across sections,
renames+reorders by JD relevance, flattens sub-headers, and demotes low-relevance
sections. The difference is editorial compression + relevance modelling, not just
deletion.

## Implementation notes (for the build step)
- Gate on JD presence (reuse `antcv:lastJdText` ≥ 30, as `antcv-why-context-title.js` does).
- Force-keep set = tokens extracted from the JD (tools/langs/standards) intersected
  with the user's real data — never invent. See [[ordering-jd-cluster-top-skills]] and
  [[cluster-demand-model]] for JD-token extraction already in the codebase.
- De-dup + abbreviate is content-destructive → owner-gated by [[dont-hide-controls-as-duplicates]];
  this spec IS that owner approval, scoped to JD-targeted CVs only. Keep the fuller
  version recoverable (no-JD path unchanged).
- Likely a generation-prompt change (worker) + a client trim/order sidecar; needs an
  owner regen to verify. Parity: preview + export ([[export-sanitize-and-preview-parity]]).
