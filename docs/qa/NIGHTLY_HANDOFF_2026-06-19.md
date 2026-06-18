# Nightly handoff — 2026-06-19 (owner-directed: open-items + full permissions)

Owner (2026-06-19): "give instructions and full permissions (bypass permissions) to the next
nightly including the permission to render gabriel.bg." This handoff is the authoritative brief for
the next autonomous nightly session. Shipped through **1.50.691** on `main` (origin = local).

## PERMISSIONS GRANTED (owner, explicit) — bypass, no pauses

The nightly runs with FULL autonomy. Do NOT pause for per-action approval. Specifically authorised:

1. **app.src.js → app.js mirror** edits + `app.js?v=` bumps + the cache-bust QUARTET
   (`app.js?v=` in index.html · `CACHE` in sw.js · `TARGET_VERSION` in antcv-version-override.js ·
   add the PREVIOUS version to `STALE_VERSIONS`). Never put the current version in STALE.
2. **Sidecar** edits + their `?v=` bump in index.html.
3. **Worker** edits (`workers/docx-worker/src/index.js` inlined bundle) + manual `wrangler deploy`
   (one deployer). proxy ↔ demo-proxy parity.
4. **Island** edits (`src/islands/**`) + `npm run build` + `antcv-react-islands.js?v=` bump.
5. Commit + push to `main` freely; deploy relay/workers freely. Report at milestones.
6. **RENDER GABRIEL_BG — generation self-verify (the key new grant).** The nightly MAY trigger a
   real generation using Gabriel's kernel (which renders `GABRIEL_BG` into the prompt) to
   SELF-VERIFY the prompt-side fixes below — it no longer has to defer those to an owner regen.
   Use Gabriel's live kernel/`personalInfo` (his real data; see [[gabriel-cv-facts]]). Treat a
   prompt fix as "verified" only after a regen shows it in the rendered Preview + export. This
   covers: tense, numeric outcomes, bring≠core, unsolicited breadth, interests-fill, accessibility
   first-person, AI-assisted-workflows-in-Methods, WHO/WHY no-inline-label.

## QUEUE (owner-ordered 2026-06-19 — do in THIS order)

### 1. preview ≠ PDF Results (and preview repetitive) — FIRST FIX shipped 1.50.693, RENDER-VERIFY
The preview already runs the export's applyOutcomesMode and maps results by role `id`; the PDF
renders role.results directly. Confirmed failure mode: DUPLICATE / MISSING role ids collapse the
preview map → one result repeats under several roles + others mismatch, PDF correct.
**Shipped:** `antcv-role-id-stabilize.js` (1.50.693) gives every role a unique non-empty id.
**STILL VERIFY (permission #6, render GABRIEL_BG):** confirm Preview Results == PDF on every role.
If a mismatch REMAINS after ids are unique, the next hypotheses are (a) the `window.__antcvRR` memo
keyed on the raw sections string serving stale across a render, and (b) React-state roles vs
localStorage-sections roles out of sync (preview iterates React `e`, map built from localStorage).
See [[two-tables-mirror-and-results-numeric]], [[v2-kernel-lamination-shape]], [[domain-and-outcomes-parity]].

### 2. Page-break (autobrake) misplaced + manual break is row-scoped, not section-scoped
(a) The auto page-break landed AFTER "System Architect, Innoviz" instead of BEFORE it, splitting the
role across the page boundary. The break should fall BEFORE a role, not mid-role.
(b) OWNER 2026-06-19: the MANUAL page-break button (↧ "Move this row and all following rows to next
page", `data-antcv-pb-icon-fixed`; glyph from antcv-page-break-icon-357.js, behaviour from the
row-level `antcv:itemPages` model) only splits the CURRENT section's table — "nothing under the
table (Professional Experience) moves to page 2." The itemPages model is per-section-per-row, so a
core_comp row set to page 2 splits that table but does NOT push subsequent SECTIONS. Needed: a
section-level "everything from here down → next page" break that the salmon split + worker export
both honour. autoPages / [[salmon-splitter-permanent]] / [[pagination-two-map-and-worker-test]].
Verify the salmon split AND the worker export both break before the role / push following sections.

### 3. AI-Notice overlap
The AI watermark/notice rams into the END of the longer (main) column in the CV. Rule
([[design-rules-watermark-table]]): the watermark goes in the section whose LAST page has LESS text;
it must never overlap body content. Fix placement so it sits clear of the main column's last line.

### 4. Tense — present chosen but Results + role content render PAST  ([[tense-results-roles-past]])
`styleConfig.expTense='present'` is honoured by the prompt (`__tenseRule`, app.src ~23067) on a
REGEN, but the LAMINATED Results (`applyOutcomesMode`) + role bullets render in their STORED tense.
Either confirm a present regen fixes it (permission #6), or add a render-time leading-verb tense
pass (Owned→Own, Built→Build, Reduced→Reduce, Directed→Direct, Cut→Cut, Secured→Secure) applied to
laminated Results + role bullets when `expTense` is 'present'|'past'. Keep preview ↔ export parity.

### 5. Core-competencies CJLR export parity (shipped preview side 1.50.692)
Preview now honours the native CJLR (`section.rowAlign[]`) with header=center / body=justify
defaults (234 sidecar `getAlign` reads rowAlign; it was overriding it before). REMAINING: the
docx-worker rowAlign default must MATCH (header center, body justify) so export = preview; today the
worker likely defaults left → a preview≠PDF gap (ties into item 1). Verify by rendering GABRIEL_BG.

### 6. Pre-existing CI unit-test failures (predate this session — NOT regressions)
`node --test pwa/test/unit/*.test.mjs` has 7 failures unrelated to this session's work
(confirmed: in buildPayload / table-dims paths untouched here):
- `placeholder-export-guard` (×2): the export NBSP-binds orphans (ORPHAN-NBSP-EXPORT-001,
  656) and the placeholder-strip regex then fails to match the NBSP'd placeholder, so an
  unfilled "[WHY THIS POSITION …]" placeholder survives export. Likely a REAL ordering bug
  (strip placeholders BEFORE NBSP-binding), not just a stale test — verify with a render.
- `table-dims-forward` / table-width (×5): `[FIXED 1.50.697 — tests updated]` the CL table export
  width reference changed in 1.50.671 (CL-TABLE-WIDTH-PAGE-REF-001) from 9602 → 11506
  (= PAGE_W-400, matching the deployed worker `defaultClW`); the tests still expected the old base.
  CONFIRMED 11506/12657 intentional (not an over-shoot — verified against the worker bundle), updated
  the 5 stale assertions; the "100% default" case became the "90% rest width" invariant (CL rest pct
  moved 100→90 in 671). Suite now 2 failures (only the placeholder-export-guard pair remains).
(Test-drift my OWN changes caused was already fixed: CJLR justify default, edit-guard order,
recs string, howcontribute NBSP — committed 129908c.)

### 7. Analysis-ready but CV/CL still placeholders (owner 2026-06-19) — RENDER-TO-DIAGNOSE
Owner: the completeness panel ("6 key sections need content … PROFILE, CORE COMPETENCIES row 1,
PROFESSIONAL EXPERIENCE role 0, Opening, WHO I AM, WHY THIS POSITION") shows AFTER "analysis is
ready" — "makes no sense if the analysis is done on the FINAL CV/CL."
Diagnosis (confirmed in code): the panel checker (app.src ~24595 `o()`) flags ONLY entirely-
bracketed template values, so the placeholders are REAL — the `me()` skeleton was never filled for
those sections. In the generation-complete handler (~24784-24821) the analysis/rationale (`bo(M)`,
a SEPARATE top-level response field) commits independently of `cv_overrides`/`cl_overrides`, so the
model can return a good rationale while the CV/CL overrides are placeholder/empty (or fail to
merge) — hence "analysis ready" yet CV/CL incomplete. The panel then pops ~5s later (setTimeout),
reading as "work after analysis ready".
NEEDS (permission #6 render GABRIEL_BG): capture a real generation response and determine whether
the 6 sections are (a) placeholder/empty in the LLM's cv/cl_overrides, or (b) present in the
response but lost in the merge. THEN: gate "done"/analysis-ready (and the banner end, 1.50.696) on
the placeholder scan passing — i.e. do NOT commit the analysis / mark done while critical sections
are still templates; auto-retry or hold "generating". kernel-completeness-290 (the fetch-wrapper
retry) should already cover this — verify it actually fires for these and isn't exhausting silently.

## OWNER QA BATCH — 2026-06-19 PM (PDF review of CV_..._20260619.pdf) — ALL FOR THE NIGHTLY
Owner reviewed the unsolicited PDF and said "document all to nightly." Render GABRIEL_BG
(permission #6) to reproduce + verify each.

A. **ANTI-FABRICATION — NYX at Kanzen (CRITICAL).** Generation wrote for Kanzen: "Worked in
   product contexts represented by NYX-100 / NYX-200 and MOR PRO evidence artifacts." Owner: "at
   Kanzen I NEVER worked on NYX." NYX-100/NYX-200/MOR PRO appear as *evidence artifacts* in his data
   but are NOT work he did. The generator must never turn an evidence-artifact reference into a
   "worked on X" claim. Add to [[gabriel-cv-facts]] + a prompt guard. Also "Delivered hardware-
   software advisory and project engagements for deep-tech and automotive clients" is the Kanzen
   line (fine for Kanzen) but it BLED onto System Architect (see C).

B. `[SHIPPED 1.50.697 — STD-CODE-NOT-METRIC-001]` **ISO 26262 picked as a "numeric result."** The Results metric scorer (`_metricScore` in
   antcv-docx-client.js + the copy in antcv-outcomes-metric-order.js) counts the digits in a STANDARD
   number ("ISO 26262", "ISO/SAE 21434", "ISO 9001", "MIL-STD-810", "STANAG 4694") as a metric, so a
   compliance-standard line wins the numeric sort even though it is NOT a result. FIX: in
   `_metricScore`, strip/ignore standard-code numbers (ISO|IEC|EN|DIN|MIL-STD|STANAG|ASPICE|SAE +
   their digits, patent numbers already filtered) before scoring. Keep both copies in sync.

C. **Cross-role bleed (RESULTS-CROSSROLE-BLEED-001 regressed).** A KANZEN result ("Delivered
   hardware-software advisory…") laminated onto **System Architect** (Innoviz). A MEPROLIGHT-type
   result ("Design and characterised low-light, thermal, SWIR … defence-grade products, incl.
   NIR/SWIR/thermal multi-band image fusion") laminated onto **IDF Computer Systems Administrator**.
   The lamination/distribution (applyOutcomesMode token-match + outcomeRoleMap) is mis-attributing
   outcomes across unrelated roles. Verify the "global best home, else drop" rule still holds; an
   outcome whose true home is another role must NOT bleed.

D. **TENSE — "ALL IS IN PAST!!! apart from 2 results (2026 + 2025)."** Despite TENSE-AT-LAMINATION-001
   (1.50.695), nearly everything renders PAST; only the current-dated roles read present. Means the
   stored expTense is effectively 'auto' (current→present, past→past) OR the fold isn't applying the
   owner's chosen tense. The 695 fold tenses RESULTS only; ROLE BULLETS are LLM-generated and stay in
   the generated tense. CONFIRM: (1) where the user's beginning tense choice is stored and that it
   reaches styleConfig.expTense; (2) that a 'present' choice forces present on EVERY role+result, not
   just current ones; (3) bullets follow too (prompt __tenseRule on regen). Owner wants the chosen
   tense uniformly. [[tense-results-roles-past]]

E. **Role ORDER — reverse-chron broken.** "Meprolight 2010-2013 is AFTER Security Guard 2010, not
   before." Roles must sort by END date desc (Meprolight 2013 > Security Guard 2010 → Meprolight
   first). The TAU Security Guard (2010, sequential) must sit after Meprolight. Check the role
   ordering in generation + 415 + any lamination re-order.

F. **Fabrication in the IDF result (with C).** "free-space optical communication systems" + "NIR/SWIR
   multi-band image fusion" on the IDF Computer Systems Administrator role is both wrong-role AND
   likely fabricated detail — verify against [[gabriel-cv-facts]] (IDF = Communication Corps sys-admin,
   NOT optics).

G. **INTERESTS placeholder + Regulatory/Methods wrong for unsolicited.** INTERESTS shows
   "[Label]: [Value]" (unfilled — ties to item 7 placeholder/completeness). Regulatory + Methods are
   wrong/over-shrunk for an unsolicited showcase (UNSOLICITED-BREADTH-001 needs regen-verify, and the
   AI-assisted-into-Methods placement, 1.50.689).

H. `[SHIPPED 1.50.697 — ACCESS-NO-COMMENT-001 data-strip]` **ACCESSIBILITY comment still visible.** "It has not limited his career" still renders.
   ACCESS-NO-COMMENT-001 (1.50.691) is PROMPT-only (needs a regen). Existing data isn't stripped —
   a small sidecar could strip the trailing "it has not limited his/their career" sentence from the
   accessibility section content (owner: that 3rd-person comment belongs only in a cover letter).
   DONE: new restore-proof sidecar `antcv-accessibility-comment-strip.js` strips the trailing
   "(it/this/that/which) has not limited his/their/her career" sentence from the CV accessibility
   labeled_list `item.v` (CL preserved, never blanks, idempotent). Unit-tested + verified in a real
   headless browser (CV stripped, CL kept, no console errors).

I. **PDF export STILL needs a refresh.** EXPORT-PDF-RACE-001 (1.50.687) did not fully fix it — the
   first export still falls back to browser-print until a refresh. Re-investigate: the worker URL /
   `B` (demo_mode/is_admin) hydration may still be incomplete at first click despite the isPdfWorker
   cache fix. Possibly await config/B before the export decision.

J. **CV CORE COMPETENCIES Focus == CL WHAT I BRING Focus.** Still the same focus areas in both
   tables. BRING-DISTINCT-001 (1.50.684) is prompt-only (needs regen) — verify on a fresh render; if
   it still duplicates after regen, strengthen / add a post-gen dedup of bring-vs-core focus labels.

## OWNER-VERIFY / NEEDS-A-CLICK (don't blind-fix)
- **Core Competencies duplicate controls** (3 page-breaks + 2 CJLR per row): owner must identify
  WHICH page-break + WHICH CJLR actually drive the preview before any are hidden
  ([[dont-hide-controls-as-duplicates]]). Safe parts already shipped 1.50.691 (CJLR default centered;
  smaller inputs). CJLR-over-group EXPORT parity (docx-worker) still open.

## STANDING DISCIPLINE
- Verify PAST the sign-in gate ([[headless-pwa-testing]]) — boot-smoke is necessary, not sufficient.
- Prompt-side fixes are now nightly-verifiable via permission #6 (render GABRIEL_BG), not
  owner-only.
- Minified mirror: names DIFFER — anchor on string literals, watch the shadow hazard
  ([[minified-mirror-shadow-hazard]]). PS 5.1 mojibake: never Get-Content/Set-Content the UTF-8
  sidecars ([[powershell-git-commit-quoting]]).
