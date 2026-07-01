# AntCV — Export-review issue map (owner, 2026-07)

Source: owner review of `CoverLetter_…(10).pdf` + `CV_…(3).pdf` after 1.51.4 / wk 1.14.105.
**State:** PWA **1.51.4** · docx-worker **1.14.105** · access-relay **1.3.2** · suite 529/529.
This is the authoritative work-list for the next session — handle ALL of it autonomously, in order.

---

## RESOLUTION — session 2026-07 (PWA 1.51.13 · docx-worker 1.14.106)

All fixes diagnosed on the owner's LIVE data via Chrome MCP and verified end-to-end after
the 1.51.12/13 deploy reloaded the owner's tab. Confirmed against the real `CV_(4).pdf` +
`CoverLetter_(11).pdf` exports.

- **A1 Work style empty — FIXED (1.51.5, wk 1.14.106).** work_style is a headlineOff
  rich_block whose body leaked the me() `[WORK STYLE …]` placeholder. Render-side drop of a
  rich_block row whose body is entirely a bracketed placeholder (worker `renderRichBlock` +
  preview app.src.js+app.js); the headlineOff section then renders cleanly to nothing.
  Verified: placeholder absent from preview + worker export; real content kept. Generation
  already mandates a real work_style (regen yields one).
- **B1 Languages/Interests/Accessibility dedup — FIXED (1.51.6 + data-safe 1.51.10).** The
  415 `explodeAdditionalToSections` returned early when no NEW section was needed, so its
  dedup never ran. Now dedups regardless; a dedicated section is a valid "home" only when it
  holds GOOD data — LANGUAGES must NAME a language (the broken "native / fluent" does not),
  so ADDITIONAL keeps the good copy (no data loss). Verified: ADDITIONAL 18→6 (interests +
  accessibility deduped, the good languages preserved).
- **C1 HWIC vanishing — FIXED (1.51.7).** Root cause: CL-PROSE-LOSS-GUARD `reapply` could only
  heal a section still PRESENT as a placeholder; a restore that DELETES the section was
  invisible to its map. Now re-INSERTS a guarded section that has a real snapshot but is
  absent, at its canonical CL position. Verified: deleted contribute re-inserted at index 6.
- **B2 Core competencies replicated into Tools — FIXED (1.51.8).** New
  `antcv-tools-corecomp-dedup.js` drops a TOOLS rich_block row whose lead duplicates a
  core_comp Focus-Area concept. Verified: dropped "Optics, photonics & sensing" + "Validation",
  kept 11/13.
- **C2 HWIC intro trash / mis-cap — FIXED (1.51.12 prompt + 1.51.13 structure).** The intro
  was chopped to a 29-char fragment (generation, not an active 30-cap). Generation prompt
  clarified (intro = complete ~85-char colon lead-in, never chopped; the ≤30 orphan is a
  re-tighten trigger). Plus C2b: re-attach the intro ":" so the 760 migration keeps the intro
  + Goal closing as MARKERLESS paragraphs (without it 760 markered every row). Existing chopped
  text is regen-gated.
- **C3 WHAT I BRING bullets truncated — FIXED (1.51.9).** Truncation is in the saved data
  (generation chopped the clause; fuller text not recoverable). `antcv-cl-text-cleanup` strips
  a trailing dangling connector/comma so bullets read complete ("…validation for"→"…validation").
- **C4 "Professionally That"→that — FIXED (1.51.9).** Deterministic lowercase of a no-colon
  marker-row body's first letter when it is a known continuation word (never "I"/proper noun).
- **C6 Contribute bullets need bold lead-ins — FIXED (1.51.11).** `antcv-cl-text-cleanup` splits
  a leadless contribute bullet into bold lead + body. Verified leads: "Map current change
  governance flows", "Set up KPI reporting", "Run RFQ/RFI evaluations", "Define DV/PV test plans".
- **C5 Bold bleeding into body — NOT REPRODUCIBLE.** No markdown `**`/`<b>` in the data; the
  worker bolds only the lead run (body normal) and CL(11) renders correctly. Likely a prior-state
  artifact, already correct on current code/data. Re-check on the owner's next export.
- **C7 "Who I am" orphan — covered by the existing generation rule.** COMPRESSION-TIGHT already
  lists who_content for the ≤30-char orphan re-tighten; it applies on regen. No deterministic
  chopper added (it would lose facts — the rule's whole point is re-tighten, not chop).
- **C8 Signature cut — NEEDS OWNER INPUT.** CL(11) shows the signature INTACT. If a later export
  still clips it, the owner must supply the signature PNG (cannot rasterize CloudConvert PDFs
  locally) so the floating-image / exact-dimension approach can be tested.

---

## RE-REVIEW — owner 2026-07-01 (PWA 1.51.27 · docx-worker 1.14.110)

Owner re-export feedback (7 items). Deterministic fixes shipped; convergence items handed to the
nightly (`docs/qa/CLOUD_ROUTINE_PROMPT.md` → CURRENT BACKLOG).

- **#1 Role-result duplicate — FIXED (1.51.26).** A role BULLET that was a LONGER variant of the
  Result stayed (bullet→result token overlap fell below threshold). `antcv-docx-client.js`
  `hideSubsumed` is now bidirectional (RESULT-SUBSUMES-BULLET-003): hide when overlap is high in
  EITHER direction (bullet⊆result OR result⊆bullet, ≥72%) plus the reverse verbatim-substring check.
- **#5 "Why this company" rule — FIXED (1.51.26).** Owner wanted a permanent HORIZONTAL rule, not
  the vertical cue an earlier build added. `antcv-cl-text-cleanup` `ensureWhyVRule` now sets
  `headlineRule` and clears `headlineVRule`.
- **#3 Lost 2 positions (Student rep, Computer admin) — FIXED (1.51.27).** Generation silently
  dropped two roles; `repairExperienceFromPI` only rebuilds a fully-degraded section. New
  EXPERIENCE-COMPLETENESS-001 (415) merges any `personalInfo` role absent from the section back in
  as HIDDEN (`on:false`) — present + recoverable, visible CV unchanged.
- **#6 Signature "G" cut — CANDIDATE FIX SHIPPED (CLIP-005, wk 1.14.112), owner-verify-pending.**
  Owner supplied the signature PNG (blue cursive "Gabriel Karp-Gershon"; aspect ~0.4 = the default,
  so NOT a distortion issue; the vulnerable feature is the G's lower-left descender loop). This time
  diagnosed from the ACTUAL emitted DOCX — `test/diag-cl-signature.mjs`/a local dump showed the
  signature is a `<wp:inline>` image (cx=1524000 cy=609600 = 160×64px, correct) sitting on the text
  baseline in a paragraph whose `<w:spacing>` carried NO line rule. **An inline image is clipped to
  its LINE BOX, not the table row** — LibreOffice/CloudConvert sizes the line from FONT metrics and
  crops the taller image's lower-left. That is exactly why CLIP-004 (row height) failed: it grew the
  row, but the LINE inside stayed short. CLIP-005: set `w:line` + `w:lineRule="atLeast"` on the
  signature paragraph = image height + slack (`px·15` twips), so the line box reserves the full image
  height. VERIFIED in the emitted XML (`w:line="1080" w:lineRule="atLeast"`) and guarded in
  `diag-cl-signature.mjs`. RULED OUT (all failed): CLIP-001 line-box (earlier, incomplete), CLIP-002
  borderless cell, CLIP-003 spacer-after, CLIP-004 `w:trHeight atLeast` row height (kept, harmless).
  Owner: confirm a real export now shows the full "G"; if still cut, next is a FLOATING ImageRun
  (absolute anchor, no line/cell clip) — see [[photo-bridge-non-float]].
- **#2 core_comp blank / #4 CL mostly blank / #7 accessibility dropped on 2nd gen — FIXED 1.51.29
  (two independent nightly runs converged on complementary fixes for each item), regen-cycle
  verification owed.** Convergence/restore reliability (owner: "the way you push from memory is
  nok"). Neither run could reproduce a real LLM generation headlessly, so both diagnosed statically
  and each landed a different, non-overlapping layer of the fix for every item — kept together:
  - **CV-CORECOMP-BLANK-001 (#2)** — two layers: (1) **root cause** — `app.src.js`'s
    `core_comp_rows` apply (~line 25076) had no "keep the existing real rows" fallback rung, unlike
    its sibling fields (`profile`/`work_style` fall back to `a(e.content)` before defaulting to
    `""`); an empty LLM `core_comp_rows` with no kernel-fallback wiped the table to header-only on
    a regen. Added the missing `e.rows`-fallback rung (mirrored to `app.js`). (2) **backstop** —
    new sidecar `antcv-corecomp-loss-guard.js` (parallel to `antcv-cl-prose-loss-guard-985.js`):
    snapshots real CORE COMPETENCIES rows to a local-only key per application, restores them when a
    later state shows placeholder-only/header-only rows; never overwrites real data, never crosses
    applications, kill-switch `antcv:disable-corecomp-guard`. 6 unit tests.
  - **CL-BLANK-001 (#4)** — two layers: (1) `antcv-cl-prose-loss-guard-985.js`'s `proseOf` now
    tests the BODY (`it.t`) only, ignoring the lead label `it.b` — an empty-body-but-labelled
    rich_block (`{b:"Who I am",t:""}`) previously read as "real" via `it.t||it.b` and defeated the
    guard's restore; now it correctly reads as not-real. 3 unit tests. (2) The CL apply path's
    `foundation.hands_on` / `foundation.professionally` / `closure.content` / `opening.content`
    used the narrower `a()` placeholder-stripper instead of the broader `__clReal()` (any leading
    `[`) that `who`/`why`/`contribute` already use (CL-EMPTY-BODY-FIELDS-001). The Nordic CLOSURE
    placeholder has nested brackets (`[Company]`, `[position/department]`) and only single hyphens,
    defeating both of `a()`'s branches — it leaked verbatim into the saved section, and the export
    then blanks a `[`-leading value, reading as "the cover letter is blank". Switched all four
    fields to `__clReal()`. 5 unit tests.
  - **CV-ACCESS-DROP-001 (#7)** — two layers: (1) `repairAccessibilityFromPI` (415) no longer
    dead-ends on `idx<0`; when the standalone ACCESSIBILITY section is ABSENT (gen-2 routes
    accessibility into ADDITIONAL) but `personalInfo.accessibility` holds a real line, it CREATES
    the section at the canonical sidebar position, before `explodeAdditionalToSections` drops the
    duplicate ADDITIONAL row. 5 unit tests. (2) `antcv-generate-cloud-sync-277.js`'s GET-after-PUT
    step (fired by the Generate button) did a wholesale `personalInfo` REPLACE from the cloud
    response; if the PUT half silently failed (swallowed to a console.debug so the user is never
    blocked), the GET clobbered locally-edited fields — including `accessibility` itself — with a
    stale cloud copy. Changed to a local-preferring merge, matching
    `antcv-personal-info-cloud-restore-282.js` / `antcv-load-from-cloud-personal-info-hook-283.js`.
    3 unit tests.
  Verified: 22 new/updated unit tests across both runs (vm-sandboxed real sidecar/apply-path
  sources), full suite 543/543 (pending final re-run after merge). **NOT verified live**: a real
  owner generate→gate→worker→sync cycle — neither cloud run had a signed-in browser or LLM keys.
  Owner should run one regen cycle (ideally a 2nd generation on the same application) and confirm
  CORE COMPETENCIES / the CL prose / Accessibility all survive.

---

---

## A. REGRESSIONS introduced by my recent fixes (FIX FIRST)

1. **Work style LOST / empty (CV).** wk 1.14.105 `CV-PLACEHOLDER-DROP-001` drops a fully-bracketed
   `[WORK STYLE …]` placeholder — but the owner wants work style POPULATED with a real one-line work-style
   sentence (for the unsolicited doc), not dropped/empty. Heading "Work style:" still shows with no content.
   FIX: generation must emit a real `work_style_content` for the unsolicited case (or the section is omitted
   cleanly — heading too). Don't leave an empty "Work style:" heading. (gen + the inline-heading drop.)
2. **LANGUAGES / INTERESTS / ACCESSIBILITY sections empty / LOST (CV).** The CV-template rebuild (1.50.995)
   added these as UNBOUND placeholder sections; the placeholder-drop then drops them, and the real data sits
   in ADDITIONAL INFORMATION. See B-1 for the required routing.

## B. CV issues

1. **Route Languages/Interests/Accessibility to their OWN sections + REMOVE from ADDITIONAL** (owner: "additional
   information shall NOT hide the other subsections; on the contrary — if we have Languages, hide it FROM
   Additional; if we have Interests, remove Interests from Additional"). Today ADDITIONAL INFORMATION carries
   Languages (EN/HE native, ES professional, DA B1), Accessibility (Hearing-impaired…), Interests, Volunteer,
   Hobbies, Cultural exchange — while the dedicated LANGUAGES/INTERESTS/ACCESSIBILITY sections are EMPTY.
   FIX: populate each dedicated section from the additional/kernel data; and DROP the matching rows from
   ADDITIONAL when a dedicated section holds them (no duplication). All three must display in the right place.
2. **Core expertise replicated into TOOLS & METHODS** (owner: "redundant, not allowed, crowding tools — no!").
   Tools shows a group "Materials & devices: Nanomaterials, carbon nanotubes (CNT), MEMS/NEMS" that duplicates
   CORE COMPETENCIES. FIX: do not copy core-competency content into Tools & Methods; de-duplicate (a concept in
   CORE COMPETENCIES must not reappear as a Tools group/row).
3. **Work style empty** — see A-1.

## C. CL issues

1. **HWIC ("How I would contribute") MISSING after an edit** (owner: "not showing HWIC if I edited it").
   The CL (10) export jumps from WHAT I BRING straight to the closing — the whole HOW I WOULD CONTRIBUTE
   section is gone. This is the **#1 inline-edit PERSISTENCE bug**: editing the section dropped it. Highest
   priority; diagnose via the live browser (see the persistence item — the `B` `data-antcv-editable-text`
   double-click editor + the sidecars re-hydrating on `sections-updated`).
2. **HWIC intro "If a role fits, I would focus on" is low quality / trash** (owner: "never approve such a
   trashy statement"). Owner suspects a wrong cap: "a restriction of 30 chars instead of x-30 chars" — the
   contribute_intro got over-constrained (the orphan/tighten rule mis-capping it). FIX: review contribute_intro
   generation (prompt ~2998-2999: "fit ONE rendered line, ~90 chars") + ensure the ≤30-char ORPHAN rule does
   not truncate the intro to ~30 chars; the cap is line-width MINUS ~30, not 30.
3. **WHAT I BRING last bullet TRUNCATED mid-sentence** — "KPI reporting Built Power BI structures linking
   engineering progress, delivery commitments, and" then nothing. FIX: the bring row is being cut (worker cell
   width / a 260-char cap / a hard truncation). Find and fix so the row completes.
4. **Casing "Professionally That" → "that"** still present. The LEAD-CONTINUATION-CASE-001 (1.51.0) is a
   GENERATION rule (next regen). If the owner won't regen, add a deterministic render-side lowercase for a
   marker-row body's first letter when there is no colon (guard "I"/proper nouns).
5. **Bold bleeding into the BODY** (owner yellow marks: "Owned", "Built", "DV/PV…"). The bold lead-in style is
   extending into the body text on marker rows. FIX: the lead-in `b` is bold; the body `t` must be normal —
   check the rich_block run styling (worker + preview) so only the lead label is bold.
6. **Contribute action bullets MISSING bold lead-ins** (owner green marks: "Map current change-request flows",
   "Set up KPI dashboards", "Clarify supplier evaluation criteria", "Document validation gate criteria"). These
   HOW-I-WOULD-CONTRIBUTE bullets have empty `b` (no bold lead-in); the lead phrase (first few words) should be
   the bold lead-in. FIX: generation should emit a `b` lead for each contribute bullet (or split the first
   clause into the lead), so each renders "**Lead** rest".
7. **"Who I am" has a ~22-char ORPHAN** — the paragraph ends on a short line ("…engineering workflows."). The
   orphan re-tighten (COMPRESSION-TIGHT, ≤30-char tail) should catch who_content; verify it applies + works on
   a regen, or add the deterministic orphan-killer.
8. **CL signature lower part STILL cut** — the table-wrap (wk 1.14.104) did NOT fix it (owner confirmed,
   post-deploy). Needs a different approach: get the owner's signature PNG to test exact dimensions, or render
   the signature as a FLOATING image (anchored, wrap top-and-bottom) so nothing clips it, or shrink/anchor it
   so it cannot fall under the page-bottom margin. Cannot rasterize locally — verify with the owner's export.

---

## NEXT-SESSION PROMPT (copy-paste) — AUTONOMOUS, browser-enabled

> AntCV — continue from `docs/qa/EXPORT_REVIEW_2026-07_ISSUE_MAP.md` + `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-30.md`
> (PWA **1.51.4**, docx-worker **1.14.105**, suite 529/529). Read `CLAUDE.md` + MEMORY.md first
> ([[cv-admin-template-and-contact-bridge]], [[fixit-orphan-enhance-orchestration]], [[rich-block-universal-section]],
> [[minified-mirror-shadow-hazard]], [[docx-worker-bundle-no-build]], [[data-loss-on-restore]]).
>
> **SYNC FIRST:** `git fetch origin && git pull --rebase origin main`. Never force main.
>
> **Mandate: work the EXPORT_REVIEW_2026-07 issue map AUTONOMOUSLY, in order, one verified fix at a time.**
> Full autonomy — diagnose in the live browser, edit, run tests, deploy workers, commit + push, report after.
> Don't pause between items. The owner is signed in to the LIVE app (Chrome MCP `mcp__Claude_in_Chrome__*`).
>
> **Order:** (A) REGRESSIONS — restore real Work Style + route Languages/Interests/Accessibility to their own
> CV sections and REMOVE them from ADDITIONAL (no duplication); (C1) **HWIC vanishing after an edit = the #1
> inline-edit PERSISTENCE bug — fix it in the browser** (the `B` `data-antcv-editable-text` double-click editor;
> reproduce via the REAL double-click→edit→commit path, spy `setItem('sections')`, find which sidecar
> re-hydrates on `sections-updated`, mark user-edited rows so it skips them); (B2) stop replicating CORE
> COMPETENCIES into TOOLS & METHODS; (C2) HWIC intro quality + the orphan mis-cap (line-width−30, not 30);
> (C3) WHAT I BRING truncated bullet; (C5) bold bleeding into the body; (C6) contribute bullets need bold
> lead-ins; (C4) "Professionally That→that"; (C7) Who-I-am orphan; (C8) signature still cut (ask for the
> signature PNG or use a floating image).
>
> **Tools:** Chrome MCP (diagnose on real data — `localStorage.sections`/`personalInfo`/kernel; console probes;
> the live app is on the CV view by default, toggle CV↔CL is bottom-right). gh CLI for worker deploys
> (`gh workflow run deploy.yml -f target=docx-worker -f mode=deploy -f confirm=docx-worker`). boot-smoke
> (`node pwa/test/boot-smoke.mjs`) after any app.js change. NO local rasterizer → docx PIXELS need the owner's
> CloudConvert export; verify STRUCTURE locally. Mirror app.src.js↔app.js (count-guarded node script); the
> docx laminator + render is `pwa/antcv-docx-client.js` (loaded directly) + `workers/docx-worker/src/index.js`
> (hand-bundled, no build). Cache-bust QUINTET on every loaded PWA file change.
