# AntCV — Open vs Closed issues (2026-06-29)

**State:** PWA **1.50.968** · docx-worker **1.14.96** · access-relay **1.3.2** · unit suite 521/521.
Authoritative handoff: `docs/qa/NEXT_SESSION_2026-06-29.md` (has per-item plans + DXA/measurements).

---

## CLOSED — shipped + verified this batch (2026-06-28/29)

| Ver | Issue | Verified |
|---|---|---|
| relay **1.3.2** | GEN-CONTAMINATION-PRESERVE-DRAFTS-001 — `wipe-generated` nulled EVERY saved app on a full regen; scoped to the ACTIVE app only (data loss at source) | live (3/4 apps had been nulled) + diag 4/4 |
| **1.50.957** | DATA-LOSS-LOAD-GRACE-001 — loading an empty/damaged saved app no longer blanks the editor into the template | boot-smoke + live |
| **1.50.958** | TOOLS-PAGE1-BAND-001 — TOOLS & METHODS fits whole on page 1 (`SIDEBAR_PAGE1_BAND` 300→270) | live `autoPages.tools` no break |
| **1.50.959** | CL-SIGNATURE-CONTROL-001 — Layout upload control + CL-end image (export) | boot-smoke |
| **1.50.960 / wk 1.14.94** | SLOGAN-CL-001 (CL tagline) + NAME-FOLLOWS-SIG-001 (sign-off reorder) | diag 2/2 |
| **1.50.961** | FORCE-LAST-GRP-SETTLE-001 — Environmental → page 3 (cache start-page key) | live `{0:2,19:3}` stable |
| **1.50.962** | HWIC-LEADIN-001 — "How I would contribute" lead-in shows when headline hidden | live |
| **wk 1.14.95** | EXPORT-PARITY-RUNNING-001 — tail (recommendations/sidebar) no longer pushed a page late | diag 2/2 (5→4 pages, owner-confirmed) |
| **wk 1.14.96** | AI-WM-SIDE-LASTCONTENT-001 — AI notice → short edge (sidebar), not the long edge | structural (mso-position-horizontal:left) |
| **1.50.963/964** | BRING-RICH-BLOCK-001 — WHAT I BRING defaults to Nordic rich_block (was the F2 task) | live (bring → rich_block) |
| **1.50.965** | SIGNATURE-WHITE-CLEAR-001 — signature persists (downscale) + white→transparent | live (stored 37KB) |
| **1.50.966** | PROFILE-COMPRESS-8-001 — profile budget 400→392 chars (on regen) | boot-smoke |
| **1.50.967** | SIGNATURE-PREVIEW-RENDER-001 — signature shows in the on-screen CL preview | live (img in preview) |
| **1.50.968** | FOUNDATION-LEADIN-DEDUP-001 — Foundation "Hands-on" body no longer repeats its lead-in | boot-smoke |

---

## OPEN — ordered

**TOP (owner blockers, exact specs in the handoff):**
1. **Kernel role bullets/results + Students-Council dup** — owner rules: dup → HIDE THE BULLET not the
   result; a manual result stays SEPARATE from bullets; Council result "lost several times" = a
   read/persistence bug (data-loss class); write the owner's authoritative bullets+results for CSA/Ops/
   Council to the kernel + verify it persists. (Council `hasOutcomes:0` → laminator derives from a bullet
   → the dup.) Full content + rules in the handoff.
2. **Candidate-header photo/text placement** (#6) — 3-column-grid + gridSpan so the header splits at
   2.31" while the body sidebar stays 2.75"; medallion center 1.47" from left, 0.27" from top. Exact DXA
   in the handoff. Render-gated (owner exports to verify pixels).

**CL sign-off + format (owner 2026-06-29):**
3. **G** — sign-off order **closing→name→signature** (sig AFTER name; reverse NAME-FOLLOWS-SIG), all same
   CJLR, editable defaults closing="At your service," + sign-off name="Gabriel".
4. **H** — `rich_block` not compressible (Foundation) → error + junk processing. **[SHIPPED 1.50.984 —
   RICH-BLOCK-COMPRESS-001]** Added a `rich_block` branch to the compress source-builder, the compress
   prompt chain, and the `Pe` applier (compress only the `t` bodies; keep `b` lead-ins, `grp` sub-headings,
   hidden rows untouched; builder/applier skip the SAME rows so values can't shift — FIXIT-DESYNC-001). The
   unsupported-type guard now also clears the `Wr` processing marker (no stuck spinner). Verified: unit
   `compress-rich-block.test.mjs` 7/7, `diag-rich-block-compress.mjs` (renders past the gate, 0 errors, no
   "not compressible" alert), suite 528/528, boot-smoke clean. LLM-output quality is owner-verified on a
   real compress.
5. **J** — CL Foundation "Professionally" bold body — needs owner confirmation of what reads as bold.
6. **F1** — make the CL SLOGAN an editable section + control (today derived from meta.subtitle).
7. **F3** — surface the signature control as a subsection in the CL format panel (today under Layout).
8. **K** — headline CJLR (section title alignment) not working for body/main/Candidate, and MISSING on
   the Rich_Content (rich_block) heading. Root causes: (a) headline align (`sectionHeadlineAlignment.v1`)
   is PREVIEW-ONLY (sidecars 208/211 CSS) — never forwarded to the export; (b) the cycler button is
   contended by 3 sidecars (`data-antcv-panel-action-207/208/211`) and can render empty/non-cycling;
   (c) rich_block titles get no headline cycler. (Per-row/`__group__` body CJLR via `antcvItemAlignment`
   already works — this is the HEADLINE/title CJLR.) Full plan = handoff item K.

**Generation:**
8. **I** — quick-gen must hide irrelevant roles/bullets/tools to converge a 4-page kernel to ~1.5–2 pages.

**Render-gated pagination (need owner CloudConvert export):**
9. CV **3-page convergence** — the floating text-anchored "spine" (tblpPr vertAnchor=text + continuous
   sectPr + equal page-table grids); the agent's docx diff is in the handoff.
10. Sidebar colored spine stops ~2cm short (deliberate slack — the floating spine is the real fix; do NOT
    raise body-row mins — [[sidebar-fill-gap-is-antiblank-slack]]).
11. "SW projects: AntCV" Additional-Info value → live ExternalHyperlink. Line-end overflow (main wraps ~½
    line early). AI-notice column decided post-pagination (mostly handled by AI-WM-SIDE-LASTCONTENT-001).

---

## NEXT-SESSION PROMPT (copy-paste)

> AntCV — continue from `docs/qa/NEXT_SESSION_2026-06-29.md` + `docs/qa/PROJECT_ISSUES_OPEN_CLOSED_2026-06-29.md`
> (PWA **1.50.968**, docx-worker **1.14.96**, access-relay **1.3.2**, suite 521/521). Read `CLAUDE.md` +
> MEMORY.md first ([[data-loss-on-restore]], [[pagination-two-map-and-worker-test]], [[rich-block-universal-section]],
> [[minified-mirror-shadow-hazard]], [[docx-worker-bundle-no-build]], [[sidebar-fill-gap-is-antiblank-slack]],
> [[cloud-persist-and-account-isolation]]).
>
> **SYNC FIRST:** `git fetch origin && git pull --rebase origin main`. Never force main.
>
> **Order:** (1) kernel role bullets/results + Students-Council dup (owner's exact rules — verify persistence,
> data-loss class), (2) candidate-header 3-col-grid placement (with the owner exporting to verify), (3) CL
> sign-off G + rich_block-compress H + headline-CJLR K (export + de-dupe the 207/208/211 cycler + add to
> rich_block heading) + slogan/signature panel F1/F3, (4) quick-gen convergence I. One verified
> fix at a time.
>
> **Access / tools this session needs (all already connected — load deferred ones via ToolSearch):**
> - **Chrome MCP** (`mcp__Claude_in_Chrome__*`) — the owner is signed in to the LIVE app at
>   https://antcv.pages.dev on a connected browser ("Browser 1"). Diagnose on the owner's REAL data:
>   read `localStorage` (`sections`, `personalInfo`, `antcv:autoPages`, `antcv:signature*`, `toneRegister`,
>   `meta`), the kernel, and the cloud slot; call the relay API with `credentials:'include'`
>   (`proxyUrl` = `https://antcv-access-relay.karp-gabriel-a.workers.dev`). The worker stubs `process`, so
>   in node diags write output via `fs.writeSync(1, …)`, NOT console.log.
> - **gh CLI** (Bash) — worker deploys ONLY via `gh workflow run deploy.yml -f target=<worker> -f mode=deploy
>   -f confirm=<worker>` then `gh run watch <id> --exit-status`. PWA auto-deploys on push to main (pwa/**).
>   Targets: docx-worker, access-relay, proxy, demo-proxy, c2pa-worker, antcv-mcp, pwa.
> - **Bash + node** — run worker diags (`node workers/docx-worker/test/diag-*.mjs`) + PWA unit suite
>   (`node scripts/run-tests.mjs`) + the blue-screen boot-smoke (`node pwa/test/boot-smoke.mjs`) after ANY
>   app.js/sidecar change. `pdftotext` (xpdf) is available for PDF TEXT; there is **NO rasterizer / no
>   LibreOffice** → docx pagination/header pixels need the OWNER's CloudConvert export. Verify structure
>   (table/grid/break counts in word/document.xml) locally instead.
> - **Edit/Write/Grep/Read** — `pwa/app.src.js` is the human source; `pwa/app.js` is its MINIFIED MIRROR
>   (surgical count-guarded edits; keep the token map; run boot-smoke). NEVER `npm run build:app` (blue-screens).
>   Cache-bust QUINTET on every loaded PWA file change: file `?v=` in index.html + `window.ANTCV_VERSION`
>   seed + `vo.src ?v=` + `sw.js` CACHE + version-override `TARGET_VERSION` (add the PREVIOUS to STALE_VERSIONS,
>   never the current).
> - **Patches/state:** worker `src/index.js` is a hand-maintained bundle (no build). Owner grants full
>   autonomy: run tests / deploy workers / commit + push to main freely, report after (no pauses). The 3
>   already-nulled saved drafts (Aimpoint/NVIDIA/Open Application) are unrecoverable — owner regenerates.
