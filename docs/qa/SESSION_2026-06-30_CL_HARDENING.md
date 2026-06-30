# CL/CV export hardening — 2026-06-30 (1.50.980 → 1.50.990 + docx-worker)

Issue log from the owner's iterative CL/CV export review. PWA auto-deploys from `main`; the
docx-worker is a manual deploy (`gh workflow run deploy.yml -f target=docx-worker -f mode=deploy
-f confirm=docx-worker`).

## CLOSED this session

| # | Issue | Fix | Ver |
|---|-------|-----|-----|
| 1 | CV included empty/placeholder roles | preview drops placeholder roles | 1.50.980 |
| 2 | IDF/CSA Results = duplicated bullet; real "100 users/150 machines" kept getting lost | seeded CSA/Ops/Council into kernel `role_results_exact` | 1.50.981 |
| 3 | CV + CL compression insufficient (orphan tails) | COMPRESSION-TIGHT-001 prompt rule | 1.50.981 |
| 4 | CL slogan showed the app label not the standing line | docx-client forwards standing subtitle as `meta.slogan` | 1.50.982 |
| 5 | HWIC dropped in export on placeholder fallback | HWIC-CONTRIB-REAL-FALLBACK-001 (`__realC`) | 1.50.982 |
| 6 | "What I bring" lead showed the `[Select 3-4…]` instruction once rows real | BRING-LEADIN-CLEAN-001 (971) | 1.50.982 |
| 7 | HWIC first line too long | contribute_intro hard-capped ~70ch | 1.50.982 |
| 8 | slogan + closure not editable in preview | inline contentEditable | 1.50.985 |
| 9 | last preview line hidden behind controls at zoom=100 | bottom clearance →120px | 1.50.985 |
| 10 | CL export lost prose after refresh-for-CloudConvert | CL-PROSE-LOSS-GUARD-001 (local snapshot) | 1.50.986 |
| 11 | opening/who stayed placeholder/empty in the LIVE preview | CL-PROSE-RICHBLOCK-FILL-001 — bridge prose `.content`→`items[0].t` (Nordic sections are rich_block) | 1.50.987 |
| 12 | foundation lead never filled (no generated field) | 987 fills a clean connector when bullets are real | 1.50.988 |
| 13 | signature wiped by refresh (standalone key) | 985 also snapshots/re-applies the standalone CL keys | 1.50.988 |
| 14 | signature missing in export (read wiped key before guard restored) | both export paths fall back to the guard stash | 1.50.989 |
| 15 | **signature missing in the CloudConvert PDF** — `base64ToUint8Array` ran `atob()` on the raw DATA-URL; the `data:…;base64,` prefix made atob reject → ImageRun skipped | **worker** strips the data-URL prefix + reads the data-URL mime (SIGNATURE-DATAURL-DECODE-001) | 1.50.990 + worker deploy |
| 16 | "What I bring (click to add)" hint on the label-only lead | suppress the hint for rich_block rows that have a bold lead label | 1.50.990 |

Owner-confirmed via preview/export (4)(5): opening, who, why real **and relevant**; foundation lead
real; "rest of CL preview reasonable".

## VERIFY NEXT (just shipped)
- **Signature in CloudConvert PDF** — needs the docx-worker deploy (run 28442005335) to be live,
  then a real generate→export. This was the true root (data-URL atob), distinct from the earlier
  forwarding/guard fixes.
- **"What I bring" line** — should now show the label with no "(click to add)".

## OPEN (carry forward)
1. **AI-notice placement (owner's design)** — render a **sidebar-colored box at the bottom of BOTH
   columns** (sidebar width); show the notice TEXT only in the column with fewer text lines; the box
   also closes the sidebar-color gap to the page end. WORKER change. CAUTION: growing the sidebar
   fill re-triggered PDF-BLANK-PAGE before (`sidebar-fill-gap-is-antiblank-slack`) — implement as a
   BOTTOM-ANCHORED element, not by extending the column; verify with a real export.
2. **CV orphans** — main bullets + sidebar comma-lists + table cells leave 20–40-char trailing
   lines. Harder per-line cap in the prompt (ORPHAN RULE not holding); sidebar lists/table cells
   aren't covered by bullet compression. Needs a regen to verify.
3. **Strategic Expertise cell text past the border** (CV CORE COMPETENCIES + CL WHAT I BRING) —
   worker table-cell width/padding.
4. **Zoom step 5%** (currently 10%) + **export-preview default 75%** (so pages are fully captured).
5. **"needs refresh for CloudConvert"** — `__antcvUseServerPdf` (app.src.js ~1441) only flips once
   the config `B` loads, so the FIRST export is browser-print and a refresh is needed; that refresh
   is the data-loss trigger. Deeper fix: make CloudConvert available on the first export.
6. **Admin template export** strips bracketed instructions via `clean()`, so it doesn't reproduce
   the owner's full source template. Consider a "raw template" export mode that keeps the
   instructions. (Confirmed: the template IS the prompting guideline — me() skeleton + prompt rules.)
7. **why_content quality** — was an irrelevant electro-optical bullet list in export (3); good in
   (4)(5). Watch; if it recurs, harden the why prompt (relevant prose, broad PM framing, no bullets).

## Architecture notes (READ FIRST)
- **app.src.js ⇄ app.js DIVERGED** in the CL apply/hydration (memory `appjs-appsrc-contribute-divergence`).
  Grep **app.js directly**; app.src.js-only edits there are phantom.
- **CL apply writes prose to `.content`** but the me() Nordic opening/who/why/foundation are
  **rich_block** (render+export `items[0].t`). Bridged by sidecar 987. A proper fix = make the apply
  write `items[0].t` directly + add a `foundation_lead` field.
- **Refresh-triggered cloud-restore wipes fresh content**; guarded by 985 (sections) + 988 (standalone
  keys) + 989 (export stash fallback). Root fix = eliminate the refresh (open #5).
- **Images are DATA-URLs**; the worker must strip the `data:…,` prefix before `atob` (fixed 990).
- Verification limit: a real LLM generation + the full gate+worker+CloudConvert+sync timing can't be
  reproduced headlessly — generation/hydration/export fixes need the OWNER to verify on a real cycle.
  Sidecar + decode logic IS verifiable by node simulation (do this).
