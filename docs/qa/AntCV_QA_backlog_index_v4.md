# AntCV QA backlog — requirement index (v4)

> Quick-reference index of every requirement/bug ID in the v4 UI/UX spec and QA plan.
> This file is the machine-retrievable source of truth (read it via the antcv-mcp
> `github_read_file` tool). It was generated from the product owner's Word document
> `AntCV_UI_UX_Spec_and_QA_Plan_v4.docx`, which remains the formatted master.
> For the full prose, acceptance criteria, and test steps of any single ID, ask the
> product owner for the relevant section of that Word document.

**Authority rule:** written requirements override screenshots. **Output rule:** every
change must behave identically in Preview, DOCX, and PDF, and on desktop and mobile,
unless a requirement explicitly says otherwise.

**Acceptance gate — a fix is NOT accepted if it:**
- works in Preview but not DOCX/PDF (unless export is explicitly excluded)
- has the right control but it affects the wrong item
- lands a drag-drop at the end when the indicator showed another location
- attaches the watermark to text flow instead of the page box
- hides, clips, or requires accidental horizontal scrolling to reach controls
- only works after a hard refresh

**Standard control order:** Page Break, CJLR, Enhance, Fit, Delete (drop Delete where not
supported). Section-move button sits to the LEFT of that group. Page Break icon must be a
semantic page-change glyph, never a down arrow. No user-facing text may say "Compress".

> ID collision note: the source reuses `GEN-001`/`GEN-002`. In §3 they are global rules
> (listed below); in §14.2 they are generation-content bugs (shown as GEN-001b/GEN-002b
> here). Disambiguate by section when reading the source document.

## Global requirements (GEN-001..011, §3)

- **GEN-001** — Preview, DOCX, and PDF parity
- **GEN-002** — Control locality (button affects only its owning item)
- **GEN-003** — Standard control order (Page Break, CJLR, Enhance, Fit, Delete)
- **GEN-004** — Deprecated wording cleanup (no "Compress"; must say "Fit")
- **GEN-005** — Edit persistence (Preview edits survive blur, reopen, export)
- **GEN-006** — Visible controls (not clipped/hidden/requiring h-scroll)
- **GEN-007** — Drag-and-drop parity with panel controls
- **GEN-008** — Accessible controls (deterministic tooltip + label naming action & target)
- **GEN-009** — Preview utility visibility and responsive parity
- **GEN-010** — Status and validation severity clarity (loading persists; warn=yellow, err=red)
- **GEN-011** — Application generation captures source-table content, not only paragraphs

## Visual findings (VF-001..018, §5)

- **VF-001** — [Cover Letter Preview] Duplicated action overlay (two 4-button groups) on text select; remove the duplicate.
- **VF-002** — [How I Would Contribute] Intro + multi-line Bullets + Closing; closing must stay a paragraph, controls not per-bullet.
- **VF-003** — [Foundation] 8-button group sits between textboxes instead of attached to each textbox.
- **VF-004** — [AI watermark] Appears along inner page edge near text flow, not anchored to lower corner of last page.
- **VF-005** — [Candidate/Application] Rendered "Application: Role - Company" sentence must also be editable in Preview.
- **VF-006** — [Section move controls] Move button missing from CL body rows, CV sidebar items, CV main-section rows.
- **VF-007** — [Drag and drop] Item drops at the end instead of the intended point; Contact can inherit wrong style/container.
- **VF-008** — [Core Competencies / What I Bring tables] Help text still says compress + down arrow; row Page Break/per-line CJLR missing.
- **VF-009** — [Selected Outcomes] Rows lack Page Break, CJLR, Enhance, Fit before Delete.
- **VF-010** — [Publications & Patents] Only Delete visible; other controls hidden beyond the row.
- **VF-011** — [Desktop Preview utility buttons] Three lower-right utility buttons not visible on desktop (mobile shows them).
- **VF-012** — [Privacy / Fuse CL -> CV] Both circular buttons missing on right side of desktop Preview.
- **VF-013** — [PDF / DOCX export buttons] Missing from top Preview gray area in some desktop states; refresh-route dependent.
- **VF-014** — [Application History popup] "Open in Settings" does not foreground the settings view (routes in background).
- **VF-015** — [Loading status] Clicking the loading status area hides it while work may still be running.
- **VF-016** — [Set menu validation colors] Errors and warnings both red; warnings must be yellow and distinct.
- **VF-017** — [Cover Letter table capture] CL generation drops relevant table data from JD/signal files/CV sections.
- **VF-018** — [Professional Experience Page Break] Positive reference: Preview shows EXPERIENCE (CONT.) + inline panel marker.

## Cover Letter editor (CL-001..006)

- **CL-001** — Remove redundant Preview action buttons
- **CL-002** — Make Closure directly editable
- **CL-003** — Redesign How I Would Contribute bullets (Intro + per-bullet rows + Closing; +Add at end)
- **CL-004** — Split Foundation controls by textbox
- **CL-005** — Normalize cover letter body section controls (+ section-move button)
- **CL-006** — Capture table data during Cover Letter generation

## Page Break (PB-001..006)

- **PB-001** — Support manual Page Break from main area and sidebar
- **PB-002** — First sub-subsection rule (move whole subsection w/ original heading, no dup)
- **PB-003** — Continuation heading rule (duplicate heading + localized "Cont." 18pt from top)
- **PB-004** — Table Page Break rules (first row moves table; later row splits + repeats headers)
- **PB-005** — Replace wrong Page Break icon and help text (no down arrow, no "Compress")
- **PB-006** — Preserve the Professional Experience Page Break UX pattern (reference)

## AI watermark (WM-001..005)

- **WM-001** — Anchor watermark to last page corner (page-level, not text flow)
- **WM-002** — Avoid collision and preserve visibility
- **WM-003** _(Medium)_ — Watermark must be text only, no border or fill
- **WM-004** _(High)_ — CL watermark anchored to text flow instead of page bottom
- **WM-005** _(High)_ — PDF watermark not consistently placed at bottom of last page

## Candidate / Application / movement (CA-001..005)

- **CA-001** — Candidate Preview editing
- **CA-002** — Application sentence model (panel Role/Company synced with rendered sentence, no dup label)
- **CA-003** — Section move button availability (left of action buttons on all movable items)
- **CA-004** — Precise drag-and-drop placement (insertion-point based)
- **CA-005** — Preserve destination styling and contrast after move (+ Restore)

## Tables (TB-001..003)

- **TB-001** — Core Competencies per-line CJLR
- **TB-002** — Core Competencies Page Break support (PB-004 rules)
- **TB-003** — What I Bring and similar table help text (no "compress", no down arrow)

## Selected Outcomes (SO-001..004)

- **SO-001** — Add per-item controls to each outcome row (Page Break, CJLR, Enhance, Fit before Delete)
- **SO-002** — Outcome add behavior (new rows identical)
- **SO-003** _(High, data loss, open)_ — Changing CORE COMPETENCIES row count from 3 to 4 in the advanced style menu wipes ALL Selected Outcomes content. Observed mobile, antcv.pages.dev, 2026-06-12 (Trackman application active): after applying the count change, the SELECTED OUTCOMES editor shows one empty placeholder row ("[Verb]" / "Outcome text") instead of the previously populated outcomes — content destroyed, not hidden. Cross-section blast radius: the trigger section (Core Competencies) and the destroyed section (Selected Outcomes) differ, so the prime suspect is the advanced-style apply handler round-tripping the whole `sections` payload through a template merge/normalize that re-keys or defaults unmatched sections to empty — same failure class as the post-delete `filterPayload` bug (missing-case wipe), NOT a per-section resize. **Triage:** (1) reproduce on desktop; (2) trace the advanced-style apply path in `app.js`/`app.src.js` for a sections rebuild; (3) ~~cloud persistence~~ **CONFIRMED 2026-06-12: the wipe IS cloudWritten** — owner read the KV record and the emptied selected_outcomes is persisted, so cloud restore returns the empty state; recovery is MANUAL ONLY; (4) confirm whether other sections (Publications, Experience bullets) are also vulnerable to count changes in adjacent sections. **Repro:** populate Selected Outcomes -> advanced style menu -> Core Competencies rows 3->4 -> apply -> open Selected Outcomes editor. **Update 2026-06-12 (confirmed: regeneration does NOT recover the wipe):** a full CV+CL regeneration after the wipe shipped with NO Selected Outcomes section at all — the client derives its per-section generation list from the current `sections` state, so an emptied/absent selected_outcomes is skipped entirely instead of refilled (GEN-001b class; client-side, `app.src.js` rebuild). The worker SCE cannot compensate: `findMissingMetricHits` deliberately no-ops when the section is absent or empty (anti-false-positive guard), so a missing section sails through clean. Recovery path is MANUAL: paste the restore set (five rows with the six canonical metrics, produced 2026-06-12). **Fix direction:** on full `generate`, the client must include selected_outcomes in the section list even when current state holds it empty; separately consider an SCE/worker check that flags an absent selected_outcomes on full-CV operations. **Operational guard until fixed:** do not apply advanced-style-menu changes while an application holds manually rebuilt content — a second apply wipes it again and overwrites the good cloud state. **Manual recovery COMPLETED 2026-06-12:** owner re-entered the rows in the editor; rows confirmed surviving the SO-004 crashes.
- **SO-004** _(High, crash, open — RE-SCOPED 2026-06-12: NOT SO-specific)_ — React error #185 (maximum update depth exceeded) on text-field change commits across MULTIPLE editors. Three occurrences logged: 07:27:37Z on `input[Outcome text]` (app 1.50.386, bundle `?v=1.50.383-cjlr-clean`), 07:30:14Z on `input[Outcome text]` (app 1.50.387, bundle `?v=1.50.387-pkg-unify`), 07:41:38Z on `input[Subheading text]` (1.50.387) after touching `input[Value]`, `input[Company]`, `textarea[Bullets (one per line)]`. Android Chrome 149, mobile. **Conclusions from the spread:** (1) reproduces across builds .383→.387, so the earlier stale-cache-bust-param theory is ELIMINATED as the cause (the .386/.383 param mismatch remains a separate cosmetic note); (2) the crash is NOT confined to the Selected Outcomes row component — Subheading text is a different editor — so the loop lives in a SHARED editor-field commit path (a common controlled-input wrapper or a shared onChange→setState→effect chain), not in SO-specific code; (3) crash offsets in app.js (292904 in .383, 293262 in .387) sit in the same code region across builds — consistent with one culprit component; (4) pattern is always a burst of `input` events then crash on the `change` (blur/commit) event. **Data impact: NONE confirmed** — owner verified all rows entered before the 07:27 crash survived; the crash is recoverable, not data-destroying. **Triage:** reproduce in a non-minified dev build and break on the #185 throw; map offset ~293k in the .387 bundle back to app.src.js; inspect the shared field component for an effect that writes to the state feeding its own value prop on commit (classic value-prop echo loop); check whether a sidecar MutationObserver writing into editor DOM (CL-007 class) participates. Severity stays High (crash on routine editing) but urgency reduced by confirmed edit survival.

## Publications & Patents (PP-001..003)

- **PP-001** — Expose hidden controls in row layout
- **PP-002** — Publication row behavior (single input; controls act on whole entry)
- **PP-003** _(High-risk)_ — Treat Publications & Patents button changes as high-risk (shared row-control model only)

## Preview shell / routing / status (PRV-001..005, AH-001, VAL-001)

- **AH-001** — Bring Application History settings view onscreen
- **PRV-001** — Restore desktop lower-right Preview utility buttons
- **PRV-002** — Restore Privacy and Fuse CL -> CV desktop placement
- **PRV-003** — Restore PDF and DOCX buttons in desktop Preview top area
- **PRV-004** — Prevent loading status from disappearing on click
- **PRV-005** _(Medium)_ — Three circular Preview utility buttons have viewport-specific placement rules
- **VAL-001** — Render warnings in yellow and errors in red

## Onboarding & settings (LANG-001, IMPORT-001, ONBOARD-001)

- **IMPORT-001** _(High)_ — User-data import reports 0 work entries despite valid work history
- **LANG-001** _(Medium)_ — Language selection mismatch after first user entry (fallback EN+DA, wizard source of truth)
- **ONBOARD-001** _(High)_ — Step 3B writing-register selection not scrollable on mobile

## Generation content bugs + generation UI (§14.2, GEN-UI-001..003)

- **GEN-001b** _(High)_ — Kernel generation leaves major CV sections empty or underfilled (§14.2)
- **GEN-002b** _(High)_ — CL generation drops What I Bring table signals and Why This Position bullets (§14.2)
- **GEN-UI-001** _(Medium)_ — Redundant Enhance and Fit buttons appear under generation cancel action
- **GEN-UI-002** _(Medium)_ — Time estimate too optimistic; almost-done messaging appears too early
- **GEN-UI-003** _(High)_ — Repeated or endless Fit controls appear under Cancel & return to editor

## Layout / export / responsive (LAYOUT-001, EXPORT-001..002, RESPONSIVE-001, PDF-LAYOUT-001, CL-LAYOUT-002)

- **CL-LAYOUT-002** _(High)_ — Application line can exceed usable page width
- **EXPORT-001** _(Medium)_ — Missing download-start indicator for PDF and DOCX export
- **EXPORT-002** _(Critical)_ — PDF export fails and needs visible recovery behavior
- **LAYOUT-001** _(High)_ — Sidebar background does not extend to bottom of page
- **PDF-LAYOUT-001** _(High)_ — PDF output shows stray Selected Outcomes heading on page 2
- **RESPONSIVE-001** _(High)_ — Mobile Preview loads desktop layout instead of mobile layout

## Profile photo shape (PHOTO-001..005)

> Scope owner for parity here is **GEN-001** (Preview / DOCX / PDF must agree). Profile-photo
> shape is selected in Settings -> Layout (PROFILE PHOTO -> Shape row) and via package defaults.
> Shipped across v1.50.56 (shape-aware DOCX worker + pentagon) and v1.50.57 (preview contour).

- **PHOTO-001** _(High)_ — Pentagon photo shape, full parity. Add a Pentagon option to the photo Shape row. The five-point regular pentagon (apex up) must render identically in Preview (clip-path polygon), DOCX (native ECMA-376 `prst="pentagon"`), and PDF. Tetrahedron was rejected: a 3D solid degrades to a flat triangle and cannot meet GEN-001. _Shipped v1.50.56._
- **PHOTO-002** _(High)_ — Shape round-trip fix (regression repair, incidental to PHOTO-001). Root cause: the deployed docx-worker `makePhotosCircular()` rewrote EVERY photo geometry to `ellipse` unconditionally, so Square / Rounded / Rounded-square / Hexagon were preview-only and silently round-tripped to a circle in DOCX/PDF — a long-standing GEN-001 violation. Fix: `makePhotosCircular(documentXml, shape)` + `shapeToPrst()` mapping (circle->ellipse, rounded/rounded-square->roundRect, square->rect, hexagon->hexagon, pentagon->pentagon) driven by `resolvePhotoShape(payload)` (personalInfo.photoShape override -> package default -> circle). _Shipped v1.50.56._ **Acceptance:** export each shape from a rendered preview; the DOCX photo geometry must match the selected shape, not a circle.
- **PHOTO-003** _(Medium)_ — Pentagon contour follows all five edges. A CSS `border` traces the element's rectangular box; once the photo is clipped to a pentagon the border survives only near the box corners (reported: "contour only at the corners" in Preview and PDF-preview, which share the client-side preview CSS). Fix: when pentagon is active, drop the CSS border + box-shadow and synthesize the outline with stacked `drop-shadow()` filters that follow the clipped alpha shape, in the package primary colour. _Shipped v1.50.57 (preview/PDF-preview)._ **Open:** confirm the contour traces all five edges in the actual downloaded Word DOCX — the worker strokes `a:ln` over the pentagon `prstGeom`, expected correct but not yet user-verified.
- **PHOTO-004** _(Medium)_ — Photo shape persists and restores. `personalInfo.photoShape` is written on selection, included in the worker payload (`antcv-docx-client.js readPhotoShape()`), and restored from cloud (`photoShape`, `stylePackage` confirmed present in cloud-restore key set). **Acceptance:** select a non-default shape, reload, and confirm both Preview and a fresh DOCX export keep that shape.
- **PHOTO-005** _(Low)_ — Pentagon swatch glyph in the package picker. The Layout-tab Visual-package swatches render a small shape glyph per package; a five-point pentagon polygon was added to the glyph renderer after hexagon so pentagon-defaulting packages preview correctly. _Shipped v1.50.57 (islands)._

## Cover Letter HOW I WOULD CONTRIBUTE flicker (CL-007)

- **CL-007** _(High)_ — HOW I WOULD CONTRIBUTE bullets flicker on the cover letter; the section oscillates between rendered bullets and the kernel placeholders ("Specific thing you would do 2]/3]"), and every section below shifts by ~2 lines as the bullet count swings 2<->0. Root cause (pre-existing, surfaced when a deploy reset the CL section to a fresh kernel template with unfilled bullets): `antcv-how-contribute-controls-245.js` repainted the preview `<li>`s from localStorage `sections` on a blind `setInterval(run,2000)` plus a broad MutationObserver, racing React's repaint. Fix: make `applyPreview`/`syncPreviewBulletNodes` idempotent (no-op when rendered bullets already match, reconcile the `<li>` count both up AND down so it cannot oscillate), add an `__applying` re-entrancy guard so the observer ignores the sidecar's own writes, and replace the 2s clock with an 8s no-op-on-match safety re-sync. Placeholders are intentionally shown (user deletes unwanted bullets in the editor). _Shipped v1.50.57._ **Open:** if flicker persists after deploy, a second writer (showcase regeneration) is also repainting the section — escalate to that layer.

## Performance — export/preview path (PERF-001)

- **PERF-001** _(Medium, not investigated)_ — Long main-thread handlers on the export/preview path. Console shows `'click' handler took 4369..11184ms` (origin `antcv-pdf-preview-gate.js`), `'setTimeout' handler took ~3270ms` (`antcv-generate-cloud-sync-277.js`), and repeated forced-reflow / `requestAnimationFrame` violations during cloud-restore + showcase generation. Not shape-related; not yet root-caused. Likely contributors to examine: the preview-gate building a full-document iframe `srcdoc` from cloned papers synchronously on click; the per-section preview sidecars (HIWC, lang-bar-filter, preview-shell-sticky) all observing `document.body` subtree mutations and reacting on every cloud-restore write; and synchronous layout reads (`getBoundingClientRect`) inside those observers. **Next step (proposed, not started):** profile a single export click in DevTools Performance, attribute the 11s to specific handlers, then debounce/defer the heaviest (iframe build off the click thread; coalesce observer reactions). No fix attempted in this session.

## Session 2026-06-11 additions (VERB-LED-001, GEN-BACKGROUND-001-CLIENT, JD-ANALYSIS-PRINT-001, CA-006, GEN-ROLEFORM-001, GEN-IDF-001, WM-006, PDF-LAYOUT-002)

> Triaged from a live Trackman unsolicited-application generation + export. Authority/output
> rules above apply unchanged (Preview = DOCX = PDF; desktop = mobile).
>
> **One-session triage (2026-06-11):** SHIPPABLE without an app.js rebuild (sidecar or worker + CI deploy): JD-ANALYSIS-PRINT-001 (sidecar `antcv-analysis-report-pdf-360.js`), WM-006 (notice-placement sidecar), PDF-LAYOUT-002 (docx-worker, same path as VERB-LED-001). NOT one-session (need `app.src.js` -> `app.js` Vite rebuild): CA-006 (sections-build data sanitation — render path confirmed clean), GEN-BACKGROUND-001-CLIENT (job-client cutover).

- **VERB-LED-001** _(High)_ — Team-management verb rule not enforced at generation. The bare verb "led" leaked into the Sirin bullet ("Led a 7-person EO and optics team") and elsewhere, violating the standing rule (manage/run a team -> directed / supervised / ran; never bare "led a team" / "led a N-person team"). Root cause: the worker `writing-style-engine.js` `INTEGRITY_RULES` role-boundary rule **explicitly permitted** "led", and the SCE banned-list had no "led"-team detector, so nothing caught it for any provider. **Fix shipped (this session):** removed "led" from the permissive role-boundary rule; added a `team-management-verb` integrity rule to the preamble; added `findTeamLedHits()` to `evaluateSce()` matching "led [a] [N-person] <team noun>" (team/group/squad/crew/unit/department/division) which feeds the existing 3-attempt SCE retry loop. Does NOT ban "led" generally — "led design reviews", "led prototype-to-production transfer" stay valid. Mirrored to demo-proxy (commits caf38e8 proxy / 479ff6b demo). **Shipped + DEPLOYED 2026-06-11:** verified live in the deployed cv-proxy bundle (`findTeamLedHits` + `team-management-verb` present; old permissive form gone). Also encoded in the antcv-writer skill (`cv-skeleton.md`) so the writer produces directed/supervised first-pass. **Acceptance:** regenerate a CV with a team-management bullet and confirm "directed/supervised", not "led a team".
- **GEN-BACKGROUND-001-CLIENT** _(High)_ — "Tab was backgrounded" banner still fires during generation; the resumable KV-backed job is never used. Backend (gen-job.js, gen-coherence.js, /job/* routes) is committed AND live in the deployed cv-proxy, but the PWA still runs the legacy per-section streaming loop (`/v1/messages`, stream:true) which mobile throttles when the tab hides. `/job/create` and `/job/step` appear nowhere in `app.js` / `app.src.js`. The wiring-handoff doc confirms client cutover was the deferred next task. **Fix (not started):** add a job client to `app.src.js` (create -> poll /job/step until terminal, resume polling on `visibilitychange`, colour sections from `ui_state`), repoint the Generate handler from the stream path to the job path, then remove the now-unnecessary backgrounded banner. Rebuild `app.js` from `app.src.js`. Source-level edit; not a sidecar.
- **JD-ANALYSIS-PRINT-001** _(High)_ — Printing / exporting the JD analysis produces the CV instead of the JD analysis report. The analysis-report export path (suspect `antcv-analysis-report-pdf-360.js`) captures the wrong print target / DOM node, same failure class as earlier print-target bugs. **Fix (not started):** confirm the export handler targets the analysis report node, not the active CV preview iframe; gate on the Analysis view being active.
- **CA-006** _(Medium)_ — Application label bleeds into the first experience role title in Preview. With an application label set ("Trackman"), the first role rendered as "Application: Founder & Product / Project Expert - Trackman, Kanzen konsulenter i nord ApS". The clean DOCX/PDF is correct ("Founder & Product / Project Expert | Kanzen konsulenter i nord ApS"). **Root cause RE-SCOPED 2026-06-11 (traced the render path):** the preview experience renderer (the `experience` case in the `Je` section component in `app.js`) is CLEAN — it composes exactly `roles[n].title + ", " + roles[n].company` from the section data, with NO applicationLabel concatenation anywhere in the render layer. Therefore the label is already baked into `sections.cv` experience `roles[0].title` by the time it renders — written there by the generation / kernel→sections mapping (or a restore path), NOT by the preview composer. The DOCX/PDF is clean because the export path composes the role line from a different source field, so it never sees the contaminated preview `title`. This is **NOT preview-only-cosmetic and NOT a sidecar fix** — it is a data-sanitation bug in the sections-build path. **Fix (not started, needs `app.src.js` edit + Vite rebuild of `app.js`):** at the point where the experience section is built from the kernel/showcase/JD generation, never prepend the applicationLabel (or the "Application: <label>" sentence) into `roles[0].title`; keep the label confined to `meta`/the header sentence. Add a defensive strip on restore: if `roles[0].title` starts with the application sentence, remove that prefix. Same rebuild class as GEN-BACKGROUND-001-CLIENT — not a one-session sidecar.
- **GEN-ROLEFORM-001** _(High, generation rule)_ — Writer must pick ONE representation of overlapping roles per CV and suppress the alternative; never emit both. The kernel deliberately holds Innoviz in two forms: (a) a MERGED 2020-2025 "System Architect & Change Control Lead" that folds in the Customer Change Requests scope, and (b) the SPLIT pair ("System Architect & Change Control Lead 2020-2025" + "Customer Change Requests Specialist 2020-2025" as distinct entries). Both are valid source data, kept on purpose. The bug is the generator emitting the merged-lead role AND the two split roles simultaneously (three overlapping Innoviz blocks, two sharing 2020-2025). **Generation rule (writer skill, not owner data):** per CV decide which serves the target role — detail two positions and hide the merged when the distinction adds signal (e.g. a change-governance role wanting the CRM specialism called out separately); use the single merged role and hide the split when brevity/seniority framing serves better (e.g. a senior PM role). NEVER all at once. This is the antcv-writer skill's job to choose, gated by the JD; previously the §3 GEN-011 / kernel path emitted every matching kernel entry without de-overlapping. **Fix (not started):** add an overlap-resolution step to the generation/kernel path that, for roles sharing an employer+date span, selects merged-OR-split and drops the other before sections are built. _(Encoded as a writer rule in `cv-skeleton.md` 2026-06-11; generation/kernel-path de-overlap step still to build.)_ **2026-06-12: observed working** — a live regeneration emitted the SPLIT pair + the distinct 2017-2020 System Architect with no merged duplicate.
- **GEN-IDF-001** _(Medium, generation rule)_ — Conditional inclusion of the IDF (military service) entry. "Computer Administrator | IDF 2001-2003" is ~20+ years old and IDF; it should appear ONLY when it earns its place: technical-IT relevance to the target role, or filling an early-career gap that strengthens the narrative. Default to OMIT for senior hardware/PM roles where it adds no signal and dates the candidate. **Generation rule (writer skill):** include IDF only when (a) the JD values the IT/infrastructure content, or (b) chronology would otherwise show an unexplained gap; otherwise drop it. When included, keep it to the most relevant bullet(s), do not lead with it. Owner clarification 2026-06-11. _(Encoded as a writer rule in `cv-skeleton.md` 2026-06-11.)_
- **WM-006** _(Medium)_ — AI-assisted notice placed on the fuller column instead of the emptier one. On the last page the "AI-assisted — author retains responsibility for content." notice lands in whichever column is denser (observed: the busy main column on the continuation page), crowding text. **Requirement:** place the notice in the column with MORE whitespace on the last page (compare residual height of sidebar vs main column on the final page, drop the notice into the one with more free space). Falls back to main column only when they are equal. This is a placement rule, not a wording change. Owner clarification 2026-06-11.
- **PDF-LAYOUT-002** _(High)_ `[FIXED docx-worker 1.14.54 — live-verified 2026-06-11]` — Regulatory-context sidebar subsection group header lost at the PDF page-2 continuation. **Root cause was NOT a missing continuation repeat** — the label was DESTROYED by a LibreOffice row overflow (= PDF-BLANK-PAGE-001 in ACTIVE_BUGS): the per-page body-row minimums filled each sheet EXACTLY (header budget + 13860 = 16838 DXA; PAGE_H−200), Word tolerated it but LO renders the candidate band + row a sliver taller, so every stretched row overflowed its sheet — the row split, its empty tail rendered as a BLANK PAGE after every content page, and the split swallowed the last sidebar lines on page 1 ("REGULATORY CONTEXT" heading + the first group label). Reproduced live via /generate-pdf (2-page CV → 5 PDF pages, pages 2/4 empty, label gone); FIXED by real slack (PAGE1_BODY_MIN 13860→13260, CONT_BODY_MIN PAGE_H−200→PAGE_H−600); re-probed live: 3 content pages, no blanks, heading + group label + first item all on page 1. Trade-off: the navy bar stops ~0.5–1cm above the page edge instead of exactly on it.

## Session 2026-06-12 additions (GEN-SCE-FLAG-001, GEN-LANGFAB-001, SO-004, GEN-PROFILE-001)

> Triaged from a live Trackman regeneration on mobile (~09:08 CET) and the subsequent manual
> SO-003 recovery session. Same run also confirmed the SO-003 updates (regeneration does not
> refill the wiped Selected Outcomes; the wipe IS cloud-persisted) and a correct
> GEN-ROLEFORM-001 outcome (split pair, no merged duplicate). SO-004 (React #185 crash on
> editor change commits, re-scoped to a shared editor-field path) is filed in the Selected
> Outcomes family above.
> Dual-sync rule applies to any SCE/worker change below (proxy AND demo-proxy).

- **GEN-SCE-FLAG-001** _(High)_ — Banned word "cross-functional" shipped in final rendered output ("Ran weekly cross-functional reviews", Customer Change Requests Specialist bullets). The word IS present in `SHARED_BANNED_WORDS.en` and `findBannedWordHits`' word-boundary regex matches the hyphenated form, so this is NOT a list gap. Two candidate mechanisms, undetermined (ANALYTICS KV telemetry check deferred — no session approval for Cloudflare KV tools): **(a) flagged-draft silent render** — by design `executeSceWithRetry` returns the third dirty draft with `X-AntCV-Flagged: 1`, and the PWA renders it with NO user-facing indicator (the v1.50.3 follow-up "surface X-AntCV-Sce-Attempts / X-AntCV-Flagged in dispatcher breadcrumbs" was never built); **(b) SCE bypass on this call path** — `executeSceWithRetry` early-returns when the request carries no writing-style envelope, or a cascade-fallback provider path skipped post-processing. **Triage:** read recent `writing-engine:*` sce-eval events in ANALYTICS KV around 2026-06-12 ~09:08 CET — events with `flagged:true`/`attempts:3` prove (a); absence of any sce-eval event for the generation proves (b). **Fix direction:** for (a), surface flagged state in the generation UI (badge + section highlight) and consider routing the 3rd attempt to a DIFFERENT cascade provider (pre-work for GEN-MODELROLE-001); for (b), close the bypass so every generation call passes through the SCE. **TRIAGE VERDICT (2026-06-12, KV read via local wrangler): mechanism (b) — SCE bypass on the live call path.** Evidence: the ANALYTICS KV namespace (1cfec90c…, confirmed bound as `env.ANALYTICS` on the DEPLOYED cv-proxy version a2a1b6bc of 2026-06-12 18:06) contains **zero keys of any prefix** — no `writing-engine:*` sce-eval event has ever been written (90-day TTL window), and no `supervisor:*` events either. If mechanism (a) were live, the flagged-draft generation would have left an sce-eval event with `flagged:true`. The same evidence means the whole writing-engine/supervisor KV telemetry channel has never fired in production — the live per-section generation path does not pass through `runWithSceRetry`/`postProcessLlmResponse` (or the supervisor logger). Fix: route the live generation call path through the SCE wrapper (and its telemetry), then re-verify with a regeneration + `X-AntCV-Sce-Attempts` header check.
- **GEN-LANGFAB-001** _(High, invention)_ — Fabricated language proficiencies in additional_information. Rendered: "Languages: English (native), Hebrew (native), Danish (professional), German (basic)". On record: Danish is B1 (Prøve i dansk 2), NOT professional; German is not on record AT ALL; Spanish (full professional) was dropped. This is invented owner data — a never-invent violation more severe than a banned word. Neither the SCE (word/phrase/structure checks only — no grounding against `user_state.profile`) nor the supervisor caught it. **Fix direction:** (1) ground additional_information.languages as a CLOSED vocabulary — only languages present in `user_state.profile`, proficiency copied verbatim, never drafted by the LLM; cleanest implementation is to pin the languages line as non-generated kernel data injected after generation; (2) add a supervisor/grounding check that diffs generated language names + proficiency levels against the kernel and rejects any addition or upgrade. **Acceptance:** regenerate; languages line must read exactly the kernel values (English native, Hebrew native, Spanish full professional, Danish B1) with no additions.
- **GEN-PROFILE-001** _(Medium, generation rule)_ — Profile opener must match application type. UNSOLICITED applications must NOT open with the optics/EO-architect identity ("Electro-optics and LiDAR architect…"); they open with the broad professional identity: "IT professional with 15+ years in consumer and regulated markets" (or close variant), with the optics depth carried by Selected Outcomes and the sidebar instead of the headline. JD-driven applications keep the JD-matched specialist opener. Rationale: an unsolicited reader has no JD anchoring the niche identity; the broad opener keeps the door open across PM/product/engineering roles. Owner directive 2026-06-12 (Trackman unsolicited). **Implementation:** writer-skill rule keyed on application type (unsolicited vs JD-driven) — encode in antcv-writer `cv-skeleton.md` profile rules; longer-term a kernel-level per-application-type profile variant selectable at generation. **Acceptance:** generate an unsolicited application; profile opens with the IT-professional framing, no "electro-optics architect" in sentence 1; generate a JD-driven application; specialist opener returns. _Status 2026-06-12 (this session): IMPLEMENTED in both halves — `cv-skeleton.md` profile rules AND the live PWA prompt's unsolicited clause (`__neutralCo`); acceptance pending an owner generation._

## Feature backlog — model-role specialization (GEN-MODELROLE-001)

- **GEN-MODELROLE-001** _(Feature, Medium)_ — Split generation across role-specialized models instead of one model doing everything via failover. Today the multi-LLM cascade (Anthropic -> OpenAI -> Mistral -> Gemini) is FAILOVER only (try next provider on 5xx) and write+check use the same model. Proposal: a per-role model map so each pipeline stage runs on the model best suited to it, named like a crew for readability:
    - **"Heiko" = WRITER** — drafts sections. Strongest prose model, higher temperature. Cost concentrated here where it matters.
    - **"Feivel" = SUPERVISOR** — runs grounding / banned-word / VERB-LED / integrity checks (`supervisor.js` + the SCE). Cheaper, fast, temperature 0, structured-JSON output. A DIFFERENT model from the writer so it has no shared blind spots (self-review misses less).
    - **COHERENCE** — cross-section pass (`gen-coherence.js`). Large-context model; can be the writer model or a dedicated one.
  **Why:** (1) cost/latency — supervisor + SCE checks don't need the top-tier model; (2) quality — a different model checking the writer catches more than self-review; (3) the hooks already exist — `supervisor.js` is a separate endpoint, `coherenceFn` is injected into the job layer, the cascade already routes by provider. **Scope:** add a role->model config map (e.g. `{ writer, supervisor, coherence }`) read by the proxy; route each stage's call to its mapped provider/model; keep the existing cascade as per-role failover. Cost/quality decision needed on which model fills each role. **Design task, not a quick fix** — touches provider routing, the supervisor call, and job/coherence injection. Logged 2026-06-11 (owner-requested).
