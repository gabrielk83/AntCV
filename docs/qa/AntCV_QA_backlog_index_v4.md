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

## Selected Outcomes (SO-001..002)

- **SO-001** — Add per-item controls to each outcome row (Page Break, CJLR, Enhance, Fit before Delete)
- **SO-002** — Outcome add behavior (new rows identical)

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
- **GEN-ROLEFORM-001** _(High, generation rule)_ — Writer must pick ONE representation of overlapping roles per CV and suppress the alternative; never emit both. The kernel deliberately holds Innoviz in two forms: (a) a MERGED 2020-2025 "System Architect & Change Control Lead" that folds in the Customer Change Requests scope, and (b) the SPLIT pair ("System Architect & Change Control Lead 2020-2025" + "Customer Change Requests Specialist 2020-2025" as distinct entries). Both are valid source data, kept on purpose. The bug is the generator emitting the merged-lead role AND the two split roles simultaneously (three overlapping Innoviz blocks, two sharing 2020-2025). **Generation rule (writer skill, not owner data):** per CV decide which serves the target role — detail two positions and hide the merged when the distinction adds signal (e.g. a change-governance role wanting the CRM specialism called out separately); use the single merged role and hide the split when brevity/seniority framing serves better (e.g. a senior PM role). NEVER all at once. This is the antcv-writer skill's job to choose, gated by the JD; previously the §3 GEN-011 / kernel path emitted every matching kernel entry without de-overlapping. **Fix (not started):** add an overlap-resolution step to the generation/kernel path that, for roles sharing an employer+date span, selects merged-OR-split and drops the other before sections are built. _(Encoded as a writer rule in `cv-skeleton.md` 2026-06-11; generation/kernel-path de-overlap step still to build.)_
- **GEN-IDF-001** _(Medium, generation rule)_ — Conditional inclusion of the IDF (military service) entry. "Computer Administrator | IDF 2001-2003" is ~20+ years old and IDF; it should appear ONLY when it earns its place: technical-IT relevance to the target role, or filling an early-career gap that strengthens the narrative. Default to OMIT for senior hardware/PM roles where it adds no signal and dates the candidate. **Generation rule (writer skill):** include IDF only when (a) the JD values the IT/infrastructure content, or (b) chronology would otherwise show an unexplained gap; otherwise drop it. When included, keep it to the most relevant bullet(s), do not lead with it. Owner clarification 2026-06-11. _(Encoded as a writer rule in `cv-skeleton.md` 2026-06-11.)_
- **WM-006** _(Medium)_ — AI-assisted notice placed on the fuller column instead of the emptier one. On the last page the "AI-assisted — author retains responsibility for content." notice lands in whichever column is denser (observed: the busy main column on the continuation page), crowding text. **Requirement:** place the notice in the column with MORE whitespace on the last page (compare residual height of sidebar vs main column on the final page, drop the notice into the one with more free space). Falls back to main column only when they are equal. This is a placement rule, not a wording change. Owner clarification 2026-06-11.
- **PDF-LAYOUT-002** _(High)_ — Regulatory-context sidebar subsection group header lost at the PDF page-2 continuation. In Preview the sidebar "REGULATORY CONTEXT" subsection group names render; in the exported PDF the top group label is cut at the page-2 sidebar continuation (the "(CONT.)" carries but the first inner group name drops). Same family as the sidebar page-split work (PB-002/PB-003 continuation rules applied to sidebar subsections). GEN-001 parity violation (Preview != PDF). **Fix (not started):** docx-worker / PDF sidebar-continuation must repeat the inner group header after a sidebar page split, mirroring the main-column continuation-heading rule.


## Feature backlog — model-role specialization (GEN-MODELROLE-001)

- **GEN-MODELROLE-001** _(Feature, Medium)_ — Split generation across role-specialized models instead of one model doing everything via failover. Today the multi-LLM cascade (Anthropic -> OpenAI -> Mistral -> Gemini) is FAILOVER only (try next provider on 5xx) and write+check use the same model. Proposal: a per-role model map so each pipeline stage runs on the model best suited to it, named like a crew for readability:
    - **"Heiko" = WRITER** — drafts sections. Strongest prose model, higher temperature. Cost concentrated here where it matters.
    - **"Feivel" = SUPERVISOR** — runs grounding / banned-word / VERB-LED / integrity checks (`supervisor.js` + the SCE). Cheaper, fast, temperature 0, structured-JSON output. A DIFFERENT model from the writer so it has no shared blind spots (self-review misses less).
    - **COHERENCE** — cross-section pass (`gen-coherence.js`). Large-context model; can be the writer model or a dedicated one.
  **Why:** (1) cost/latency — supervisor + SCE checks don't need the top-tier model; (2) quality — a different model checking the writer catches more than self-review; (3) the hooks already exist — `supervisor.js` is a separate endpoint, `coherenceFn` is injected into the job layer, the cascade already routes by provider. **Scope:** add a role->model config map (e.g. `{ writer, supervisor, coherence }`) read by the proxy; route each stage's call to its mapped provider/model; keep the existing cascade as per-role failover. Cost/quality decision needed on which model fills each role. **Design task, not a quick fix** — touches provider routing, the supervisor call, and job/coherence injection. Logged 2026-06-11 (owner-requested).
