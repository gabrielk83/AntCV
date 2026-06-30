# AntCV — Open vs Closed issues (2026-06-30)

**State:** PWA **1.51.2** · docx-worker **1.14.104** · access-relay **1.3.2** · unit suite 529/529.

### CLOSED — 2026-07 (CL lead-in colon: editable + exportable)
| Ver | Issue | Verified |
|---|---|---|
| **1.51.2 / wk 1.14.103** | **LEAD-COLON-PERROW-001 (export + editable)** — the colon now renders PER ROW in the EXPORT too (was section-wide `s.leadColon` → parity gap), an explicit `row.colon` overrides the marker default in preview + export (so it can be REMOVED), a per-row ":" toggle in the editor sets it (persists via d()), and a lead already ending in punctuation gets no auto-colon. NOTE: inline TEXT edits of the lead still hit the #3 persistence bug | rich-block diag + boot-smoke; owner verifies on export |

### CLOSED — 2026-07 (CL export review, owner)
| Ver | Issue | Verified |
|---|---|---|
| **1.51.0** | **LEAD-COLON-PERROW-001** — colon after a lead-in is now PER ROW: non-marker section lead-ins (Foundation:, Who I am:, Why…:, What I bring:, How I would contribute:) get it; marker rows (Hands-on / Professionally / need bullets) don't. Render fix, immediate | boot-smoke |
| **1.51.0** | **LEAD-CONTINUATION-CASE-001** (gen) — a marker lead-in has no colon so its body continues the sentence and starts LOWERCASE ("Professionally that…" not "…That…"), unless first word is "I"/proper noun | gen rule; verify on regen |
| **1.51.1** | **BRING-INTRO-001** — "What I bring:" lead-in body was hardcoded empty in bring-761; now the model returns `cl_overrides.bring_intro` (anchor + areas, framing the rows), carried on the section and set as the lead-in body | gen + render; owner verifies on regen |
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
| 2026-07 (CL export review) | 8 | per-row colon + casing (1.51.0), bring_intro (1.51.1), colon editable/exportable (1.51.2/wk1.14.103), signature table-wrap (wk1.14.104), J=casing, G confirmed |
| **Closed (recent batches)** | **49** | |
| **OPEN now** | **15** | START #1 = inline-edit PERSISTENCE (browser); then council/results, empty-positions, A (rule-without-headline), + the render-gated batch |

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
| **wk 1.14.102→104** | **CL-SIGNATURE-CLIP** — signature lower part hidden in the CloudConvert PDF (preview fine). 102 (line-box reservation) made the signature EXPORT at all but the lower-left was STILL cut (owner confirmed, post-102). 104: render the signature inside a BORDERLESS single-cell TABLE — a cell sizes to its content, so an inline image's baseline/line-box clipping can't crop it. Table alignment keeps L/C/R | diag-cl-signature/closing/signoff-order/margins/full-export OK; owner confirms on export |
| **(confirmed)** | **G — CL sign-off order closing→name→signature** — already shipped; diag-cl-signoff-order verifies closing<name<sig | diag 2/2 |
|  **1.50.997→999** | **CL opening orphan-tighten** — the COMPRESSION-TIGHT rule omitted `opening_content`, so the CL opening orphaned to a 4th line. Now `opening_content` is covered AND the orphan is quantified (998) + holistic (999, owner corrections): an ORPHAN = a trailing rendered line of **≤30 characters**; when one would occur, RE-TIGHTEN THE WHOLE paragraph (fewer/shorter words throughout, drop redundancy, restructure/merge clauses) so the same meaning fits — NEVER brutally chop the tail; keep every fact/number/tool/proper-noun | gen rule; owner verifies on regen. NOTE: this is model GUIDANCE; a deterministic orphan-killer (measure rendered tail → trigger an ORCHESTRATED re-tighten or justify) is offered but not built. Per owner, fix-it/orphan-trim/enhance should be MULTI-LLM ORCHESTRATION — sample 2-3 providers, pick the best candidate for hard cases (route via ee()) — see [[fixit-orphan-enhance-orchestration]] |
| **1.50.997** | **RESULTS-DISTINCT-001** (generation) — a role's Results headline must read differently from its bullets (no verbatim copy), prefer the quantified outcome, and hide the restated bullet. Partly addresses open #1 on the generation side | gen rule; owner verifies on regen — display-hide of EXISTING dups stays open #1 |

---

## OPEN — ordered (AUTONOMOUS handling; START WITH #1 PERSISTENCE in the LIVE BROWSER)

**TOP — data-loss / blockers:**
1. **rich_block inline-edit PERSISTENCE (#3, data-loss class) — START HERE, LIVE BROWSER (Chrome MCP).**
   Editing a CL rich_block in the PREVIEW (contentEditable via `B`, paths `items.i.t`/`items.i.b`) reverts on
   Ask AI / export / tab switch. The edit DOES commit to `sections`, but a sidecar re-runs on
   `antcv:sections-updated` (which those events fire) and re-hydrates the row. Candidates:
   `antcv-nordic-cl-order-971.js` (lead-in/INSTR seeding), `antcv-cl-prose-richblock-fill-987.js`
   (re-bridges generated prose), `antcv-cl-prose-loss-guard-985.js` (restores a prose snapshot it reads as
   "loss"). DIAGNOSE in the live browser: reproduce the edit, watch `localStorage.sections` and the
   sections-updated listeners, pin which sidecar overwrites. FIX = mark a user-edited row (`_userEdited`/`_dirty`,
   or compare to the snapshot) so the re-hydrator SKIPS it. UNBLOCKS inline lead-in/colon/text editing. Do NOT
   blind-fix — regression risk in generation/prose.
2. **Role Results restate a bullet + dup not hidden; council laminator (#1).** dup → HIDE THE BULLET, not the
   result; the laminator must use the kernel's seeded exact result (`role_results_exact`) for council BEFORE
   deriving from a bullet (Council `hasOutcomes:0` → non-numerical derived result). Owner: **hide in NEW docs,
   no need to fix existing**. RESULTS-DISTINCT-001 (1.50.997) partly covers generation — verify on regen + add
   the laminator precedence fix (preview ~5915-6059 + worker).
3. **CV empty "[Role title]" positions (#1b).** Drop on:true roles whose title is still `[Role title]` in a
   GENERATED/laminated CV (not the fresh-template editor). Hide in NEW docs.

**A — rule-without-headline + export the vertical cue (owner 2026-07, the big feature):**
4. Decouple the horizontal RULE from the headline so a section can show a rule with the headline TEXT hidden
   ("Why this company" with a rule before it, no title). 3 layers: EDITOR `antcv-rich-block-editor.js` (the
   "Rule" button is disabled when headOff — enable it via a `headlineRule` opt-in), PREVIEW `app.src.js` ~6946
   (headlineOff returns the whole heading incl. rule as null — render the rule independently), WORKER
   `index.js` renderSection (headlineOff skips heading — emit a title-less bordered paragraph). PLUS **export
   the vertical `│ Cue`** (`headlineVRule`) to PDF/docx (worker: add a left border on the section, matching the
   preview `M.borderLeft`). Opt-in so headline-off sections don't all sprout rules.

**Other:**
5. **Candidate-header photo/text placement (#6)** — 3-col-grid + gridSpan; medallion center 1.47" / 0.27" top.
   Render-gated (owner exports to verify pixels).
6. **K — headline/title CJLR** not forwarded to EXPORT (preview-only sidecars 208/211), cycler contended by
   207/208/211 (can render empty), MISSING on rich_block headings. (Per-row body CJLR already works.)
7. **F3** — surface the signature control as a subsection in the CL FORMAT panel (today under Layout).
8. **I — quick-gen** must hide irrelevant roles/bullets/tools to converge a 4-page kernel to ~1.5–2 pages.
9. **Recruiter-answers PAGE** — verify N question+answer blocks render ONLY when the JD asks questions (gen
   rule + `questions_in_jd` + worker `jd_questions` exist; end-to-end verify + render fix).

**Render-gated (need owner CloudConvert export):**
10. **CV 3-page convergence** — floating text-anchored spine; the sidebar spine 2cm-short slack is deliberate
    ([[sidebar-fill-gap-is-antiblank-slack]]).
11. **AI-notice two-box** — sidebar-colored box at the BOTTOM of BOTH columns, text in the column with fewer
    lines; WORKER, BOTTOM-ANCHORED only (blank-page risk).
12. **Strategic Expertise cell text past the border** (CV CORE COMPETENCIES + CL WHAT I BRING) — worker cell width.
13. **CV orphans → the deterministic ORPHAN-KILLER inside generation/fix-it/enhance** (NOT a user control):
    measure the rendered ≤30-char tail → trigger an ORCHESTRATED whole-paragraph re-tighten (sample 2-3 LLMs,
    pick best) or justify the paragraph ([[fixit-orphan-enhance-orchestration]]). Also "SW projects: AntCV" →
    live ExternalHyperlink; line-end overflow (main wraps ~½ line early).
14. **zoom 5% step + export-preview default 75%**.
15. **eliminate the CloudConvert refresh** — `__antcvUseServerPdf` (app.src.js ~1441): make server-PDF available
    on the FIRST export so the data-loss-triggering refresh isn't needed.

_(Shipped this batch, removed from OPEN: lead-in colons + casing (1.51.0), bring_intro (1.51.1), colon
editable/exportable (1.51.2 / wk 1.14.103), signature clip (wk 1.14.102→104), J "Professionally That→that"
= the casing rule, G sign-off order.)_

---

## NEXT-SESSION PROMPT (copy-paste) — AUTONOMOUS, browser-enabled

> AntCV — continue from `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-30.md` (PWA **1.51.2**, docx-worker
> **1.14.104**, access-relay **1.3.2**, suite 529/529). Read `CLAUDE.md` + MEMORY.md first
> ([[cv-admin-template-and-contact-bridge]], [[fixit-orphan-enhance-orchestration]], [[data-loss-on-restore]],
> [[nordic-cl-template]], [[pagination-two-map-and-worker-test]], [[rich-block-universal-section]],
> [[minified-mirror-shadow-hazard]], [[docx-worker-bundle-no-build]], [[sidebar-fill-gap-is-antiblank-slack]],
> [[cloud-persist-and-account-isolation]]).
>
> **SYNC FIRST:** `git fetch origin && git pull --rebase origin main`. Never force main.
>
> **Mandate: work ALL remaining OPEN issues AUTONOMOUSLY, in order, one verified fix at a time.** Full
> autonomy: diagnose in the live browser, edit, run tests, deploy workers, commit + push to main, report
> after. Don't pause for approval between items. Use the live BROWSER actively (owner is signed in).
>
> **START WITH #1 — rich_block inline-edit PERSISTENCE (data-loss), in the LIVE BROWSER.** Reproduce a CL
> rich_block lead-in/body edit in the preview, watch `localStorage.sections` + the `antcv:sections-updated`
> listeners, and pin which sidecar re-hydrates the row (971 / 987 / 985). Fix = mark user-edited rows so the
> re-hydrator skips them. This UNBLOCKS inline lead-in/colon/text editing. Then proceed down the OPEN list:
> (2) council laminator / results-dup (hide in NEW docs), (3) empty `[Role title]` positions, (4) **A:
> rule-without-headline + export the vertical `│ Cue`** (3-layer: editor + preview + worker), (5) candidate-
> header placement, K headline-CJLR, F3, quick-gen, recruiter-answers page, then the render-gated batch
> (incl. the deterministic ORPHAN-KILLER inside generation/fix-it/enhance as multi-LLM orchestration —
> [[fixit-orphan-enhance-orchestration]]).
>
> **Verify-on-regen/export (owner will confirm; shipped 1.50.995→1.51.2 / wk 1.14.101→104):** CV admin
> template, contact-line bridge, generic CL template, per-row lead colon (editable + exportable), "Professionally
> that" casing, bring_intro, CL-opening orphan re-tighten, signature table-wrap (no clip). If any still wrong on
> a real export, fix forward.
>
> **Access / tools (all connected — load deferred via ToolSearch):**
> - **Chrome MCP** (`mcp__Claude_in_Chrome__*`) — owner signed in to the LIVE app at https://antcv.pages.dev.
>   USE IT to diagnose #3 and any render/state bug on REAL data: read `localStorage` (`sections`, `personalInfo`,
>   `antcv:autoPages`, `antcv:signature*`, `toneRegister`, `meta`), the kernel, the cloud slot; add temporary
>   console probes; relay API with `credentials:'include'`
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
