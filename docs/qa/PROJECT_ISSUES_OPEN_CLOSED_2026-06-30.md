# AntCV — Open vs Closed issues (2026-06-30)

**State:** PWA **1.50.997** · docx-worker **1.14.102** · access-relay **1.3.2** · unit suite 529/529.
Supersedes `PROJECT_ISSUES_OPEN_CLOSED_2026-06-29.md`. Per-item detail: `SESSION_2026-06-30_CL_HARDENING.md`,
`CL_CV_GENERIC_TEMPLATES_2026-06-30.md`, `NEXT_SESSION_2026-07-01.md`. Full running history: `ACTIVE_BUGS.md`.

---

## TOTAL STATUS (rolling tally)

| Batch | Closed | Notes |
|---|---|---|
| 2026-06-28 (pagination/PDF header) | 3 | group split, PDF-header-left, export warmup |
| 2026-06-29 (data-loss + CL/export) | 14 | relay 1.3.2 data-loss-at-source + 13 PWA/worker fixes |
| 2026-06-30 (CL/CV hardening + templates) | 18 | 1.50.980→995 + worker 1.14.94→1.14.101 |
| 2026-06-30 PM (export-review feedback) | 4 | Mgmt→Management + vertical cue (1.50.996), signature-clip (wk 1.14.102), G sign-off order confirmed shipped |
| 2026-06-30 PM2 (CV export review) | 2 | CL opening orphan-tighten + RESULTS-DISTINCT generation rules (1.50.997) |
| **Closed, last 3 batches** | **41** | |
| **OPEN now** | **18** | 3 owner-blockers (+CV empty-positions), 2 CL-format, 4 generation/edit, 9 render-gated |

(Cumulative project history predates these snapshots; the authoritative running log is `ACTIVE_BUGS.md` —
per-batch snapshots are the practical tally. No single from-inception counter is maintained.)

---

## CLOSED — shipped this batch (2026-06-30)

| Ver | Issue | Verified |
|---|---|---|
| **1.50.981** | IDF/CSA Results = duplicated bullet; real "100 users/150 machines" kept getting lost — seeded CSA/Ops/Council into kernel `role_results_exact` | live |
| **1.50.982** | CL slogan showed app label (→ `meta.slogan` standing subtitle); HWIC dropped on placeholder fallback (`__realC`); "What I bring" lead showed the `[Select 3-4…]` instruction (BRING-LEADIN-CLEAN); HWIC first line capped ~70ch | live |
| **1.50.984** | **H** — `rich_block` (Foundation) not compressible → error + stuck spinner. RICH-BLOCK-COMPRESS-001 (compress `t` bodies only; builder/applier skip same rows; clears `Wr` marker) | unit 7/7 + diag, owner-verifies LLM quality |
| **1.50.985** | slogan + closure now inline-editable in preview; wider preview bottom clearance | live |
| **1.50.986/987** | opening/who stayed placeholder in LIVE preview — CL-PROSE-LOSS-GUARD + CL-PROSE-RICHBLOCK-FILL (bridge prose `.content`→`items[0].t`; Nordic sections are rich_block) | owner-confirmed (opening/who/why real + relevant) |
| **1.50.988/989** | signature wiped by refresh / missing in export — 985 snapshots the standalone CL keys; both export paths fall back to the guard stash | live |
| **1.50.990 + wk deploy** | signature missing in CloudConvert PDF — worker strips the `data:…;base64,` prefix before atob (SIGNATURE-DATAURL-DECODE-001); "(click to add)" hint suppressed for label-only leads | owner-verifies PDF |
| **1.50.991→994** | owner's **generic CL template** adopted into me() Nordic CL + full WRITING-RULES (banned words/phrases + semantic constraints) enforced in 3 layers (me() / gen prompt pts 7-10 / `antcv-banned-audit` BASELINE) + RECRUITER-QUESTIONS-001 gen rule + COHERENCE/cluster-fit/ghost-hunting | unit 528/528, boot-smoke; owner verifies a real generate |
| **1.50.995** | **CV admin/export template rebuilt** to `CV_Template_AntCV_Prompts_Generic (4)` — me().cv: PROFILE 2-3 sentences + WRITING-RULES/COHERENCE; WORK STYLE ends on a people skill; per-role `Results:` (r1-r5); SELECTED OUTCOMES kept (preview's results); LANGUAGES/INTERESTS/ACCESSIBILITY split into own sidebar sections in docx order before ADDITIONAL; blank-fn re-templates `role.results` | me() builds 15 sections, unit 528/528, boot-smoke; owner verifies a real CV export |
| **wk 1.14.101** | **CV contact-line sidebar bridge** — band-overlap mode no longer font-shrinks the contact line (full size, wraps if long); empty photo-zone cell sized to the figure's right edge so the text cell extends left (CONTACT-BRIDGE-NOSHRINK/WIDECELL-001) | worker unit 75/75, diags 31/34 (1 pre-existing FAIL); owner verifies export w/ band-overlap photo + long contact line |

### CLOSED — 2026-06-30 PM (owner export-review feedback)

| Ver | Issue | Verified |
|---|---|---|
| **1.50.996** | **Management spelled in full** (owner "use the full word management, not Mgmt") — dropped Management→Mgmt abbreviation + added Mgmt→Management EXPAND in antcv-core-comp-compress.js | unit 529/529 (test updated) |
| **1.50.996** | **CL-HEADLINE-VRULE-001** — a section with the headline TEXT hidden had no visual cue; new `headlineVRule` draws a vertical accent line down the section's left edge; editor "│ Cue" toggle (enabled when headline off) | boot-smoke; owner confirms cue on a headline-off section |
| **wk 1.14.102** | **CL-SIGNATURE-CLIP-001** — signature lower part hidden by white in the CloudConvert PDF (preview fine); the inline image was clipped to its 276-twip line box. Reserve the image's full height (px×15, lineRule "atLeast") | diag-cl-signature/closing/signoff-order OK; owner confirms on export |
| **(confirmed)** | **G — CL sign-off order closing→name→signature** — already shipped; diag-cl-signoff-order verifies closing<name<sig | diag 2/2 |
| **1.50.997** | **CL opening orphan-tighten** — the COMPRESSION-TIGHT rule omitted `opening_content`, so the CL opening orphaned to a 4th line; now capped to 3 rendered lines (cut ~30 chars / one clause if it would reach line 4) | gen rule; owner verifies on regen |
| **1.50.997** | **RESULTS-DISTINCT-001** (generation) — a role's Results headline must read differently from its bullets (no verbatim copy), prefer the quantified outcome, and hide the restated bullet. Partly addresses open #1 on the generation side | gen rule; owner verifies on regen — display-hide of EXISTING dups stays open #1 |

---

## OPEN — ordered

**TOP (owner blockers):**
1. **Role Results restate a bullet + the dup bullet is not hidden** (data-loss class; owner rules: dup →
   HIDE THE BULLET not the result; manual result stays SEPARATE from bullets). NEW evidence 2026-06-30 CV
   export: "Senior Optics, Sirin Labs" Results restated bullet 1; "Computer Systems Administrator, IDF"
   Results = bullet 2 VERBATIM while bullet 1 ("Cut recovery time from hours to minutes") is the real
   measurable result that should have been the headline. Generation side PARTLY addressed by
   RESULTS-DISTINCT-001 (1.50.997 — results must read differently from bullets, prefer the quantified one,
   hide the restated bullet) — verify on a fresh regen. STILL OPEN: a DISPLAY-LAYER dedup so an EXISTING
   doc hides a visible bullet whose text is substantially contained in that role's `results` (preview
   ~5915-6059 + worker render); Council `hasOutcomes:0` → laminator derives from a bullet → the dup. Needs
   owner's live data + a real export to verify.
1b. **CV shows 2 empty "[Role title], [Company]  [Years]" positions in the preview** (owner 2026-06-30) —
   bracketed placeholder roles leak into the GENERATED/exported CV. The ghost-placeholder filter
   (CV-GHOST-PLACEHOLDER-001) deliberately KEEPS bracketed `[Role title]` roles (so a fresh template stays
   fillable), so a generated doc with leftover unfilled slots shows them. Fix: in a generated/laminated CV
   (not the fresh-template editor), drop on:true roles whose title is still the `[Role title]` placeholder.
   Distinguish generated-doc vs fresh-template carefully (don't hide slots the user is mid-filling).
2. **Candidate-header photo/text placement** (#6) — 3-column-grid + gridSpan: header splits at 2.31" while
   body sidebar stays 2.75"; medallion center 1.47" from left, 0.27" from top. Render-gated (owner exports).
3. **rich_block inline-edit PERSISTENCE (data-loss class)** — editing a CL rich_block in the PREVIEW
   (contentEditable via `B`, paths `items.i.t`/`items.i.b`) reverts on Ask AI / export / tab switch. The
   edit DOES commit to `sections`, but a sidecar re-runs on `antcv:sections-updated` (which those events
   fire) and re-hydrates the row: candidates are `antcv-nordic-cl-order-971.js` (lead-in/INSTR seeding),
   `antcv-cl-prose-richblock-fill-987.js` (re-bridges generated prose), `antcv-cl-prose-loss-guard-985.js`
   (restores a prose snapshot it reads as "loss"). Needs the owner's LIVE browser to pin which sidecar
   clobbers (the 971 guards claim to skip real edits; 985/987 are the likely culprits). Fix = make the
   re-hydrator skip user-edited rows (mark edited rows / compare against the snapshot). Do NOT blind-fix —
   regression risk in generation/prose-fill.

**CL format:**
4. **J** — CL Foundation "Professionally" bold body — needs owner confirmation of what should read as bold.
5. **F3** — surface the signature control as a subsection in the CL FORMAT panel (today under Layout). (F1
   editable slogan + F2 Nordic-scope already shipped.)
6. **K** — headline/title CJLR (section-title alignment) not forwarded to EXPORT (preview-only sidecars
   208/211), cycler contended by 3 sidecars (207/208/211 can render empty), and MISSING on rich_block
   headings. (Per-row/`__group__` body CJLR already works.)

**Generation / edit:**
7. **I** — quick-gen must hide irrelevant roles/bullets/tools to converge a 4-page kernel to ~1.5–2 pages.
8. **bring_intro generation field** — emit the WHAT I BRING intro line on a fresh generation, ending with a
   colon (e.g. "Structure - across scope, suppliers, validation, and business decisions:"). Schema + apply +
   the 987 prose bridge. Today the lead (item[0].t) is clean but EMPTY (owner: "What I bring line is still
   empty… and has no ':'"). Owner-gated to verify on a real generate.
9. **Lead-in colons on CL sections** (owner 2026-06-30: "Foundation also missing ':' and so does How I would
   contribute") — the colon after a lead label is the per-section `leadColon` ("L:" toggle, `__leadSep` at
   app.src.js ~5430). "Why" shows it (owner toggled it); foundation/contribute/bring don't. Fix options:
   default `leadColon:true` for the CL Nordic lead sections in me() (fresh skeletons + new generations) and/or
   a sidecar/render-default for existing docs. Note: tangled with #3 persistence — if leadColon toggles also
   revert, fix #3 first.
10. **Recruiter-answers PAGE** — verify the CL renders exactly N question+answer blocks (header band + "Kind
    regards," + AI notice) ONLY when the JD asks questions, on a real export. Gen rule + `questions_in_jd` +
    worker `jd_questions` exist; this is end-to-end verification + any render fix.

**Render-gated (need owner CloudConvert export):**
11. **CV 3-page convergence** — floating text-anchored "spine" (tblpPr vertAnchor=text + continuous sectPr +
    equal page-table grids). Sidebar colored spine stops ~2cm short = deliberate anti-blank-page slack; the
    floating spine is the real fix — do NOT raise body-row mins ([[sidebar-fill-gap-is-antiblank-slack]]).
12. **AI-notice two-box** (owner's design) — sidebar-colored box at the BOTTOM of BOTH columns; notice TEXT
    only in the column with fewer lines; the box closes the sidebar-color gap. WORKER change, BOTTOM-ANCHORED
    only (growing the sidebar fill re-triggered PDF-BLANK-PAGE before).
13. **Strategic Expertise cell text past the border** (CV CORE COMPETENCIES + CL WHAT I BRING) — worker table
    cell width.
14. **CV orphans** (20-40-char tails in bullets + sidebar lists + table cells); **"SW projects: AntCV"**
    Additional-Info value → live ExternalHyperlink; **line-end overflow** (main wraps ~½ line early).
15. **zoom 5% step + export-preview default 75%**.
16. **eliminate the CloudConvert refresh** — `__antcvUseServerPdf` (app.src.js ~1441) flips only after config
    `B` loads, so the FIRST export is browser-print and a refresh is needed; make server-PDF available on the
    first export so the data-loss-triggering refresh isn't needed.

---

## NEXT-SESSION PROMPT (copy-paste)

> AntCV — continue from `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-30.md` (PWA **1.50.995**, docx-worker
> **1.14.101**, access-relay **1.3.2**, suite 528/528). Read `CLAUDE.md` + MEMORY.md first
> ([[cv-admin-template-and-contact-bridge]], [[data-loss-on-restore]], [[nordic-cl-template]],
> [[pagination-two-map-and-worker-test]], [[rich-block-universal-section]], [[minified-mirror-shadow-hazard]],
> [[docx-worker-bundle-no-build]], [[sidebar-fill-gap-is-antiblank-slack]], [[cloud-persist-and-account-isolation]]).
>
> **SYNC FIRST:** `git fetch origin && git pull --rebase origin main`. Never force main.
>
> **Verify-first (just shipped, owner-gated on a real generate/export):** CV admin template (1.50.995) — a
> real CV export renders the new sections (LANGUAGES/INTERESTS/ACCESSIBILITY, per-role `Results:`) and the
> CV_Template.json mirrors them. Contact-line bridge (worker 1.14.101) — a CV export with a band-overlap
> photo + a LONG contact line shows the contact line full-size (wrapping, not shrunk) sitting right of the
> medallion. CL generic template (991→994) — a real CL generates clean (banned vocab + semantic
> constraints + recruiter-answers page when the JD asks questions).
>
> **Order (one verified fix at a time):** (1) kernel role bullets/results + Students-Council dup (owner's
> exact rules — data-loss class, verify persistence); (2) candidate-header 3-col-grid placement (owner
> exports to verify); (3) CL format — G sign-off order, J bold, F3 signature panel, K headline-CJLR (export
> + de-dupe the 207/208/211 cycler + rich_block heading); (4) generation — bring_intro field, recruiter-
> answers PAGE end-to-end, quick-gen convergence I; (5) render-gated — AI-notice two-box (bottom-anchored),
> Strategic-Expertise cell overflow, CV orphans, zoom 5%/export-preview 75%, eliminate the CloudConvert
> refresh.
>
> **Access / tools (all connected — load deferred via ToolSearch):**
> - **Chrome MCP** (`mcp__Claude_in_Chrome__*`) — owner signed in to the LIVE app at https://antcv.pages.dev.
>   Diagnose on real data: `localStorage` (`sections`, `personalInfo`, `antcv:autoPages`, `antcv:signature*`,
>   `toneRegister`, `meta`), kernel, cloud slot; relay API with `credentials:'include'`
>   (`proxyUrl`=`https://antcv-access-relay.karp-gabriel-a.workers.dev`).
> - **gh CLI** (Bash) — worker deploys ONLY via `gh workflow run deploy.yml -f target=<worker> -f mode=deploy
>   -f confirm=<worker>` then `gh run watch <id> --exit-status`. PWA auto-deploys on push to main (pwa/**).
>   Targets: docx-worker, access-relay, proxy, demo-proxy, c2pa-worker, antcv-mcp, pwa.
> - **Bash + node** — worker diags (`node workers/docx-worker/test/diag-*.mjs` / `scripts/run-docx-diags.mjs`)
>   + unit suite (`node scripts/run-tests.mjs`) + the blue-screen boot-smoke (`node pwa/test/boot-smoke.mjs`)
>   after ANY app.js/sidecar change. NO LibreOffice/rasterizer → docx pagination/header PIXELS need the
>   OWNER's CloudConvert export; verify STRUCTURE (table/grid/break counts in word/document.xml) locally.
> - **Edit/Write/Grep/Read** — `pwa/app.src.js` is the human source; `pwa/app.js` is its MINIFIED MIRROR
>   (skeleton strings are byte-identical between the two — plain old→new replacements work in both; mirror
>   via a count-guarded node script). NEVER `npm run build:app` (blue-screens). Cache-bust QUINTET on every
>   loaded PWA file change: file `?v=` in index.html + `window.ANTCV_VERSION` seed + `vo.src ?v=` + `sw.js`
>   CACHE + version-override `TARGET_VERSION` (add the PREVIOUS to STALE_VERSIONS, never the current).
> - Owner grants full autonomy: run tests / deploy workers / commit + push to main freely, report after.
