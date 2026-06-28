# AntCV — Next session handoff (2026-06-28)

**Current state:** PWA **1.50.956**, docx-worker **1.14.93**, unit suite **521/521** green.
SYNC FIRST (`git fetch origin && git pull --rebase origin main`). `app.js` is the minified mirror of
`app.src.js` (surgical, count-guarded edits, must start `(()=>{`). Cache-bust quintet on every loaded
PWA file (file `?v=` + `window.ANTCV_VERSION` seed + `vo.src` + `sw.js` CACHE + version-override
TARGET, add previous to STALE). Worker = `gh workflow run deploy.yml -f target=docx-worker -f
mode=deploy -f confirm=docx-worker`, then `gh run watch <id> --exit-status`.

---

## OPEN ISSUES — priority order

### 1. [CRITICAL] DATA-LOSS-ON-RESTORE — loading a saved application doesn't restore full data
Owner 2026-06-28: loading a previous application shows the TEMPLATE/placeholder for several sections
instead of the saved content — **CV: Core Competencies + Professional Experience**; **CL: What I Bring
+ HOW I WOULD CONTRIBUTE + the closing**. The owner is forced to **regenerate from scratch** each time.
This is the top priority. Likely the kernel/cloud restore (KERNEL-CLOUD-PERSIST / the showcase slot)
or the per-email KV(sections)+D1(kernel) sync writing/restoring a skeleton over the real data, OR a
migration blanking sections on load (cf. the SIDEBAR EMPTIES / PUB-REPOPULATE / CONTRIBUTE-CHAROBJ
class — [[rich-block-universal-section]], [[cloud-persist-and-account-isolation]], [[kernel-recovery-
and-floor]]). Diagnose with the owner's REAL live data via Chrome MCP (read localStorage `sections`,
`meta`, the kernel showcase, the cloud slot) — find WHERE the real Core-Comp/Experience/WhatIBring/HWIC/
closing content is (kernel? a stale cloud slot? lost?) and why restore loads a skeleton instead. Fix =
make restore prefer real content + the minimum-sections floor never overwrite populated sections.
**Verify on the owner's real account, not synthetic.**

### 2. PAGINATION IS EXPORT-ONLY now — preview is CORRECT, the PRINT/PDF differs
Owner clarified: Recommendations → page 4, and Interests/Accessibility → page 4, are **NOT preview
issues — only in the exported PDF**. The preview (coordinator `__uniPaginate` + the salmon) places them
correctly; the WORKER's render lands them on a later page. So this is a **worker ↔ coordinator
pagination PARITY bug**: the worker is not faithfully honoring the forwarded `autoPages` page map for
the main (Recommendations) + sidebar (Interests/Accessibility) tail sections, OR the worker re-flows
them taller than the coordinator measured. Investigate in `workers/docx-worker/src/index.js`: does the
main-column section page assignment + the sidebar list/rich_block segment-split consume the forwarded
`role.page`/`row_pages`/`item_pages` for these tail sections, or does it re-derive? The coordinator
map is authoritative ([[pagination-two-map-and-worker-test]]); the worker must follow it. NOTE: a
coordinator tune (MAIN_PAGE_N_BAND etc.) will NOT fix an export-only divergence — do not chase it there.
Verify by driving the worker with the owner's forwarded autoPages + asserting page placement in
document.xml.

### 3. CL nordic — HWIC "How would I contribute" lead-in missing
Same class as the FOUNDATION opening (GABRIEL-FOUNDATION-OPENING-001, fixed 1.50.951): the nordic HWIC
headline is now hidden (NORDIC-HWIC-HEADLINE-OFF-001, 1.50.948) but the intro row's lead-in is empty,
so there's no "How would I contribute" label at all. Fix: in `antcv-hwic-to-rich-block-760.js`, when
nordic + headlineOff + the intro row has no lead-in, set the intro row `b = "How would I contribute"`
(name-guard / nordic-guard as appropriate, idempotent), mirroring the Foundation-opening pin.

### 4. Environmental, Durability & Compliance slightly regressed to page 2
After SIDEBAR-SIG-CACHE-001 default-on + block-count signature (1.50.953), the FORCE_LAST_GRP / Env
last-group placement shifted slightly (owner: "slightly regressed to page 2"). The dance IS stabilising
(owner: "jumping is stabilising at some stage" — the cache is working). Re-check the FORCE_LAST_GRP
interaction with the new whole-`__sPaged` cache (both are block-count-keyed now; confirm they don't
fight). Likely a small adjustment to keep Env's last group on page 3 while the cache holds.

### 5. SIGNATURE feature — finish the remaining layers (export DONE)
CL signature export shipped (worker 1.14.93 / 1.50.956): renders at the CL end, aligned/sized,
aspect-preserved, hideable, CL-only. **Remaining (spec: `docs/plan/CL_SIGNATURE_FEATURE.md`):**
(a) the **Layout upload control** — collapsible block under the photo controls, upload + Hidden + L/C/R
align (default center) + size slider, computes+stores the aspect on upload, standalone keys, single
mount + own marker = no sticky-leak (sidecar, no app.js mirror); (b) the **CL-end preview `<img>`**
(app.src.js ~26679-26696 srcdoc builder + app.js mirror). Then it's usable end-to-end.

### 6. Candidate-header text too far right (finer-grid)
The bridge header's two cells get SNAPPED to the body's column grid, so the photo (upper-left) cell
can't render narrower than the body sidebar cell — the centered text never moves left. Fix = a finer
table grid (3 columns + gridSpan) OR a separate header table so the header photo cell is genuinely
smaller and the text cell moves left with room for the one-line contact. `workers/docx-worker/src/
index.js` bridge headerRow (~24827) + buildTwoColumnDocument grid. The owner: "left-align is NOT the
fix; it's the cell ratio / the cells aren't actually separate." Verify on a real PDF.

### 7. Lower-priority queue
- **AI-notice → sidebar, computed as the LAST step** (after final pagination) — currently decided too
  early; owner wants the shorter-column (sidebar) decision made post-pagination.
- **Sidebar colored spine** — the colored sidebar fill stops ~2cm short of the page bottom (deliberate
  anti-blank-page slack — DO NOT raise the body-row mins, see [[sidebar-fill-gap-is-antiblank-slack]]).
  Real fix = a page-anchored floating colored rectangle (no pagination participation, zero blank-page
  risk). Real-PDF verify.
- **"SW projects" hyperlink dead** — the Additional-Info "Software projects: AntCV" value isn't a live
  link; wire markdown/URL → ExternalHyperlink in the export.
- **Line-end overflow** (owner: BOTH preview + export) — main column text wraps ~½ line more than
  expected, in tables + content + bullets; a column-width/indent investigation.

---

## SHIPPED THIS SESSION (2026-06-28) — all verified, suite green at each
- 1.50.945 BOOT-WAITSCREEN-GATE-001 (boot perf)
- worker 1.14.90 RICH-BLOCK-MIDSECTION-SPLIT-001 (sidebar group split)
- worker 1.14.91 PDF-HEADER-LEFT-001 (header geometry — superseded by #6 finer-grid)
- 1.50.946 EXPORT-WARMUP-001 (first PDF uses CloudConvert, no refresh — owner confirmed working)
- 1.50.947 ROLE-ORPHAN-PAGE1-001 (MAIN_PDF_LINE_BONUS 150→20) + MISCLASSIFY-LANG-001 (LANGUAGES heal)
- 1.50.948 NORDIC-HWIC-HEADLINE-OFF-001
- 1.50.949 NORDIC-FOUNDATION-DEFAULT-001
- 1.50.950 RA-PAGE2-001 (MAIN_PAGE_N_BAND 105→60, owner-confirmed RA on page 2)
- 1.50.951 GABRIEL-FOUNDATION-OPENING-001 (Foundation opening sentence pinned)
- 1.50.952 CERTS-PAGE2-001 (SIDEBAR_PAGE1_BAND→300) + SIDEBAR-SIG-CACHE-001 (flag-gated)
- 1.50.953 SIDEBAR-SIG-CACHE-001 default-on + block-count signature (page-1/2 + 2-3 dance)
- 1.50.954 CV-SUBTITLE-PIN-001 ("Processes • Products • People" pinned, Gabriel-guarded)
- 1.50.955 INTERESTS-ALIGN-STABLE-001 (stop left↔justify flip)
- worker 1.14.93 / 1.50.956 CL-SIGNATURE-001 export layer
- (worker 1.14.92 sidebar-fill REVERTED — would have re-bricked blank pages; the gap is intentional)

## DISCIPLINE
- The candidate-header + the page-4 pagination + the colored spine all need REAL CloudConvert PDF
  verification (no headless PDF renderer here). Do those with the owner exporting.
- DATA-LOSS (#1) and the dance (#4) need the owner's REAL live data via Chrome MCP, not synthetic.
- Don't chase export-only pagination via coordinator tunes (the coordinator/preview is correct).
- Sig-cache kill switch: `localStorage['antcv:sidebar-sig-cache']='0'`.
