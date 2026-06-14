# AntCV — Fresh Session Kickoff — 2026-06-14

**Start here.** This boots a fresh-context session to work the AntCV backlog autonomously.
Current shipped version: **1.50.455** (preview + export Copenhagen palette/outcomes complete).
Owner directive: implement the backlog in the order below, verify each, ship; review later.

---

## 0. Orient (read first, ~2 min)
- `CLAUDE.md` — app.js source-of-truth + hotfix/patch protocol + STALE_VERSIONS invariant.
- Auto-memory `MEMORY.md` index, especially:
  - `antcv-open-backlog` — the prioritized open list (mirror of §3 here).
  - `gabriel-cv-facts` — ground-truth CV facts + personality kernel v1.1.0 + GPA grades.
  - `design-rules-watermark-table` — watermark placement + table-headers-centered rules.
  - `minified-mirror-shadow-hazard` — why 1.50.451 crashed; verify in-scope minified var names.
  - `domain-and-outcomes-parity` — cv-generator-det IS the owner's domain; outcomes live in 2 paths.
- `docs/qa/ACTIVE_BUGS.md` (top block = 1.50.446→455) and `docs/qa/AntCV_QA_backlog_index_v4.md`.

## 1. Ship discipline (non-negotiable)
1. Edit `pwa/app.src.js` (the SOURCE) → mirror the change into minified `pwa/app.js`.
   **Before any helper call by short name, grep the in-scope binding** (e.g. `f`=readableInk in
   one scope, the header-text local in the `<th>` scope). When unsure, INLINE the logic.
2. Render/unit-test the change headlessly (`pwa/test/diag-*.mjs`, `*.test.mjs`) — boot-smoke is
   NOT enough (it missed the 451 table crash because the table header didn't render).
3. Cache-bust trio: bump the changed file's `?v=` in `index.html`, `sw.js` `CACHE`, and
   `antcv-version-override.js` `TARGET_VERSION` (+ add the PREVIOUS version to `STALE_VERSIONS`,
   NEVER the new one).
4. Commit + push to `main` + both mirrors:
   `git fetch origin; git rebase origin/main; git push origin main; git push --force-with-lease origin main:claude/antcv-roadmap-bugs-L9Sqa main:plan/2026-06-06-analysis-followups`
5. Worker change → mirror proxy↔demo-proxy if a matching copy exists; deploy via
   `gh workflow run deploy.yml -f target=<proxy|demo-proxy|docx-worker> -f mode=deploy -f confirm=<same>`.
6. QA core rule: a fix must hold in **Preview + DOCX + PDF, desktop + mobile** — never
   Preview-only, wrong-item, or only-after-hard-refresh.
7. PowerShell 5.1: use `[IO.File]`/node for UTF-8 pwa files; `git commit -F` (not `-m` with quotes).

## 2. Useful harnesses already in the repo
- `pwa/test/diag-copenhagen-palette.mjs` — renders band/sidebar/table-header + probes colours.
- `pwa/test/diag-outcomes-results.mjs` — preview Results (role-specific/cap/editable).
- `pwa/test/applyOutcomesMode.test.mjs` — export Results parity.
- `pwa/test/buildStyle-palette.test.mjs` — export payload panel colours.
- `pwa/test/diag-analysis-salary.mjs`, `workers/proxy/test/jd-analysis-salary.test.mjs`.

## 2A. Tools & MCP available this session (use the right one per task)

Most backlog items are **export-parity** bugs — the fix only counts if confirmed in a real
DOCX/PDF (QA core rule, §1.6). These are the tools to read those artifacts and the live app.

**Reading / verifying exported documents (the QA core loop):**
- **`Read` (native)** — first choice for a born-digital exported PDF (pass a `pages` range)
  and for the owner's PNG bug screenshots. Reads the text layer + renders the page visually.
- **`pdf` skill (`anthropic-skills:pdf`) — the PDF OCR reader.** Use when an exported PDF is
  scanned/rasterised or its text layer is **garbled** (the known "garbled font encoding"
  path) — it OCRs the page to recover text so you can assert on sidebar-label colour,
  contact-line wording, banded rows, etc. Also merges/splits/watermarks/extracts images.
  This is the tool to trust a real PDF when `Read`'s text layer is unreliable.
- **`pdf-viewer` skill / `mcp__plugin_pdf-viewer_pdf__*`** — interactive page-by-page viewer
  to open an exported PDF and inspect/annotate visually. Best for the *visual* export bugs
  (sidebar labels white, photo sidebar-top-vs-bridge, missing zebra rows, CL edge inset).
- **`docx` skill (`anthropic-skills:docx`) + `mcp__9ae16cca…__github_read_docx`** — inspect
  the exported DOCX and the locked `docs/design/*.docx` source documents (document wins on
  conflict, per CLAUDE.md).

**Live-app inspection (data-merge item 11 + any live-tab bug):**
- **`mcp__Claude_in_Chrome__*` / `mcp__Claude_Preview__*`** — drive
  `cv-generator-det.pages.dev` to read localStorage `personalInfo`/`sections`, render the
  editor for inspection, eval JS, capture console/network. **Rules (from memory):** do NOT
  sign in as the owner; inject a render-only flag, then CLEAN UP every injected flag.

**Headless render / unit harness (verify BEFORE deploy — boot-smoke is not enough, §1.2):**
- `Bash` → `node pwa/test/diag-*.mjs` and `*.test.mjs` (the harnesses listed in §2);
  worker tests under `workers/*/test/`. See the `headless-pwa-testing` memory for auth/section
  injection to render past the sign-in gate.

**Deploy / data (workers are manual; PWA auto-deploys on push to main):**
- `Bash` → `gh workflow run deploy.yml -f target=<proxy|demo-proxy|docx-worker> -f mode=deploy
  -f confirm=<same>` (the approved worker-deploy path, §1.5).
- Cloudflare MCP `mcp__9ae16cca…__deploy_worker` / `deploy_pages` / `get_worker_code` /
  `github_read_file` / `github_write_file`; **`mcp__e9cdb384…__d1_database_query`** for LLM-call
  / history diagnostics on D1 (read-only first).

**Edit / search / shell:** `Edit` (UTF-8-safe for `pwa/*` — never Get/Set-Content rewrite a
sidecar, §1.7), `Grep`, `Glob`, `Bash`, `PowerShell` (5.1 — `[IO.File]`/node for UTF-8 files;
`git commit -F`, not `-m` with quotes).

**File deletion / cleanup** (removing a retired sidecar, a `/tmp` de-min artifact, or a
cleaned-up injected-flag file — backlog item 11): there is **no dedicated MCP file-delete
tool** in this session. Delete via, in order of preference:
- `Bash` → `git rm <path>` for a tracked file (stages the removal in one step), or
  `PowerShell` → `Remove-Item -LiteralPath <path>` (add `-Recurse -Force` only when intended)
  for an untracked/local file.
- `mcp__plugin_desktop-commander_desktop-commander__*` covers read/write/**move** but exposes
  no delete; use `move_file` to relocate, not to remove. (The only MCP `*_delete` tools here
  are Cloudflare **resource** deletes — `d1_database_delete`, `kv_namespace_delete`,
  `r2_bucket_delete` — which destroy a whole database/namespace/bucket, NOT a file; do not use
  them for cleanup.)
- Per the safety rule, never hard-delete data you didn't create or can't restore — prefer
  `git rm` (recoverable from history) and confirm the path is the retired one (grep
  `pwa/index.html` first: an edit/delete to an unloaded sidecar is a no-op, per CLAUDE.md).

## 3. Prioritized backlog (owner's recommended order)

**A. Export/PDF parity (highest user pain — re-verify each in a real PDF):**
1. `CONTACT-LINE-DENMARK-001` (Low, quick) — contact must read **"2300, København S"** (postcode +
   comma + district, NO country). Find the contact-line builder / stored personalInfo literal.
2. PDF candidate-section text white/visible — `EXPORT-PALETTE-PARITY-001` (453) + `SIDEBAR-LABEL`
   (455) should cover it; CONFIRM in a real export. If still wrong, the worker `index.js`
   `getPackageStyle` (~line 23987) is a STALE bundle (sidebarBg:`p.base` not `ground`, label/text
   white) — fix to `ground` + `readableInk` and deploy docx-worker.
3. PDF missing the **banded-row** (zebra) table colours seen in preview.
4. Photo exports as **sidebar-top** not **bridge** (band-overlap) — photoPosition mapping.
5. **What I Bring** table exports at ORIGINAL dimensions (stale tableWidth/ratio in payload).
6. CL text needs a **larger inset from page edges** — match the CV main-column edge inset.

**B. Preview/render:**
7. Table headers **center by default** — React render (app.src ~5081) is center but
   `antcv-section-align.js` default for table-header rows overrides to LEFT; fix the default +
   center in export. Make the CJLR alignment buttons repositionable.
8. **Recommendations renders before Professional Experience** in PREVIEW (correct in PDF) — order.
9. **HIWC** word/char count off by 1–2 words — tighten budget; same for the What-I-Bring table.
10. **Watermark** → lower part of the section whose LAST page has LESS text.

**C. Data merge (owner: "merge to existing JSON + harden generation prompts") — needs live tab:**
11. Additively merge the CV trove into localStorage `personalInfo`+`sections` (SHOW THE DIFF FIRST):
    rewritten outcomes, unified Change-Control/System-Architect role, Kanzen Konsulenter ApS (no
    "i nord", end **2026**), certs (Copilot/IDA, Coaching/World Rugby L1, Concussion 2024), Team
    Operations (Copenhagen Wolves RFC 2023–present), **GPA grades** (MBA 89.7, MSc EE 91.7, BSc
    Physics 80.07, BSc EE 84.02), languages (DA **B1**, ES **Professional**, **NO German**),
    personality kernel v1.1.0. Full source: `gabriel-cv-facts` memory + the kernel JSON in Downloads.
    Live tab: `cv-generator-det.pages.dev` (the owner's correct domain). Inject a UI flag to render
    the editor only for inspection; CLEAN UP injected flags; do NOT sign in as the owner.
12. Harden generation prompts: broad PdM/BA identity (not narrow EO); drop "Founder" for
    non-consulting; "worked with people from different backgrounds"; career objectives → CL "Why
    this position"; hearing-impaired-not-limiting; kernel banned-words + behaviour-over-adjectives.

**D. Settings UI (cluster C from chat):**
13. Selected Outcomes format select: de-dupe (two selects) + add **Results** option + explainer card.
14. Merge **Line Targets + Section Formats into Section Layout** (keep the "how it looks" graphics +
    CV/CL badges), remove standalones.
15. Restore Adv. Styles manual colour controls; restore grammar + tense controls in Languages area.
16. Languages as its OWN subsection. Personal order: Languages before Done/Advanced-Tone, group
    grammar+tense. Ask AI button higher on mobile. Custom LLM form: API key field FIRST.
17. `TASK-CUSTOM-LLM-OVERHAUL-001` (greenlit) — key-only add, relay persist, per-task model map,
    wizard/proxy mgmt (core landed via LLM-ONBOARD-001/002).

**E. Carried-forward OPEN (from ACTIVE_BUGS):** `GRAMMAR-MARKER-SCROLL-LAG-001` (mobile),
`DOC-WIDE-CHATBOT-001` (mobile entry), `PDF-LAYOUT-001` (stray Selected-Outcomes heading on PDF
p2), `PDF-LAYOUT-002` (lost REGULATORY CONTEXT heading), CORE-COMP/WIB row page-control QA items.

## 4. Definition of done per item
Shipped to main + mirrors, version bumped, headless test green, and (where visual) confirmed in the
render harness. Update the `## SESSION REGISTRY` block at the top of `docs/qa/ACTIVE_BUGS.md` with the
ID + `[SHIPPED x.y.z]`. Re-verify export items in a real DOCX/PDF before marking closed.
