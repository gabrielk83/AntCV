# Session Log — 2026-07-22 (export pipeline: panel-open PDF, analysis→CloudConvert, preview zoom decouple)

Desktop session (Opus 4.8). Three owner-reported export defects/requests, each
diagnosed → fixed → pushed → **live-verified on the deployed build** against the
owner's own signed-in account. No unrelated files touched; the pre-existing
dirty `docs/personas/gabriel/kernel_snapshot_*` + `PANEL_BUTTON_AUDIT_*` were
stashed around each sync and left as-is.

Versions consumed this session (each a clean cache-bust quintet):
- **1.51.1556-pdf-panel-worker** (earlier in the session; PWA)
- **1.51.2072-analysis-cloudconvert** (PWA) + **docx-worker 1.14.162-analysis-html-pdf** (deployed)
- **1.51.2085-export-preview-zoom-decouple** (PWA)

Version churn was heavy (several parallel sessions); every push was a
sync→rebase→push, never a force. `2032` was taken by another session mid-flight
so the analysis feature moved to `2072`.

## CLOSED / SHIPPED this session

### 1. EXPORT-PDF-PANEL-WORKER-001 — PDF export routes to CloudConvert with a side panel open (`1.51.1556`, bea9cf6)
Owner: with a side panel open (e.g. the Analysis tab), "Save as PDF" gave the
browser printer export instead of the CloudConvert worker; DOCX was unaffected.
**Root cause (PWA-side):** the export action bar holding `button[title^="Export as PDF"]`
only mounts under the `"preview" === ei` gate (`app.src.js` ~50575), so on a
non-Preview tab it is unmounted while the preview paper + export FAB remain — the
preview modal's Save-as-PDF `querySelector` delegation returned null and its only
fallback was `window.print()`. DOCX was immune (`triggerDocxExport` already had a
direct-worker fallback). **Fix:** `antcv-pdf-preview-gate.js` now calls
`window.exportPdfViaWorker` directly when the app button is absent, honouring the
same server-PDF policy (`window.__antcvUseServerPdf`, newly exposed from
`app.js`/`app.src.js` as `he`/`me`) + DEMO watermark. Registered by the 07-19
nightly reconcile; **end-to-end click-through driven live** this session
(POSTs to `/generate-pdf`, `window.print` 0 calls). Test
`pwa/test/unit/export-pdf-panel-worker.test.mjs`.

### 2. HTML-TO-PDF-001 — JD-analysis report exports via CloudConvert (`1.51.2072` / docx-worker `1.14.162`)
Owner: "add the analysis to export with CloudConvert." The analysis report
printed via an offscreen-iframe `window.print()` (ATS-illegible, no ToUnicode
CMap). **Worker:** new `convertHtmlToPdf()` (import/base64 UTF-8 → convert
input=html engine=chrome print_background A4 → export/url), inlined in the bundled
`src/index.js` + mirrored in `src/cloudconvert.js`; new route
`POST /generate-analysis-pdf` → `handleGenerateAnalysisPdf` (same gates as
`/generate-pdf`, BYOK `X-CloudConvert-Key` precedence); CORS allow-headers gained
`X-CloudConvert-Key` (latent BYOK preflight gap). **PWA:**
`antcv-analysis-report-pdf-360.js` `exportPdf()` tries the worker first
(`exportViaWorker`, gated by `__antcvUseServerPdf`+`isPdfWorkerAvailable`+`ANTCV_DOCX_WORKER`),
keeping the browser-print path as `printViaIframe()` fallback. Test
`workers/docx-worker/test/html-to-pdf.test.mjs`; worker CI 17/17; PWA 1365/1365.
**Live:** worker `/health` = `1.14.162`, direct POST = 200 `application/pdf` 30KB,
and driven e2e on the deployed PWA (POSTs `/generate-analysis-pdf`, downloads the
PDF, `window.print` 0 calls). Registered FEATURES_REGISTRY FT-ANALYSIS-CLOUDCONVERT.

### 3. EXPORT-PREVIEW-ZOOM-DECOUPLE-001 — export preview decoupled from editor zoom + no half-page clip (`1.51.2085`, 745b88d)
Owner: the export preview cut pages by ~half AND its zoom followed the editor
preview's zoom. **One root cause:** the editor bakes its zoom onto the paper as
an inline `transform: scale(<editor-zoom>)` (`app.src.js` ~51102) and the export
modal clones the paper via `p.outerHTML`, so the clone inherited the zoom AND
double-scaled it against the modal's own fit zoom (a transform's layout box stays
full-size → `.antcv-page-row` desync → half-page clip). **Fix (CSS-only):**
`.antcv-preview-paper { transform: none !important; transform-origin: top left !important; }`
in the gate srcdoc `<style>` (beats the inline transform); the preview now fits
independently via body `zoom: var(--antcv-fit)`. Test
`pwa/test/unit/export-preview-zoom-decouple.test.mjs`; PWA 1378/1378. **Live on
deployed 2085:** with editor `scale(0.955)`, the clone's computed transform is
`none` (DECOUPLED) and it scales only by the single fit `zoom=0.512`.

## Follow-ups filed (not actioned)

- **Export-modal build stalls in a throttled/backgrounded tab** — the modal's
  double-`requestAnimationFrame` build never fires when the tab is occluded
  (`island-raf-freeze` class); a `setTimeout` fallback in
  `antcv-pdf-preview-gate.js` would make it un-hangable. No evidence of a live
  user hitting it. (Noted in ACTIVE_BUGS / OPEN_REGISTER under the panel-worker
  entry.)
