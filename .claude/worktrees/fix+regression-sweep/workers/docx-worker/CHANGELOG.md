## 1.14.13

- AI-assisted disclosure rendered as a bordered "hanging textbox" matching the PWA preview chip (app.js v1.40.338). 1pt border on all four sides; sidebar context keeps the light-grey-blue palette, linear/CL context uses a muted teal on a very light fill.
- Linear (CL) builder now emits the disclosure on the last page: page 1 for a single-page CL, the jd_questions page (page 2) when present.
- Uses a styled paragraph, not `wp:anchor` floating frames — those don't survive LibreOffice/CloudConvert PDF conversion (v1.14.0 photo-floating regression).

## 1.14.12

- Sidebar Regulatory Context and Additional Information item page breaks are now honored without duplicating the first-section break.
- Body row cantSplit is disabled when sidebar item page breaks are present so Word can paginate the sidebar.
- Sidebar continued sections keep sidebar shading.

# docx-worker CHANGELOG

## v1.14.9 (2026-05-19)

**Adds:** `X-AntCV-Pdf-Pages` response header on `/generate-pdf`.

### What's in the zip

- `src/pdf-page-count.js` — new helper that scans a LibreOffice/
  CloudConvert-produced PDF buffer and returns the page count.
  Two strategies: read the `/Type /Pages` catalog's `/Count` field
  (canonical), with a fallback to counting `/Type /Page` leaf
  objects. Pure ASCII scan; no parser, no Wasm. Capped at 4 MiB
  to keep CPU bounded.
- `PATCH-FOR-INDEX-JS.md` — two small edits to `src/index.js` that
  wire the helper into the `/generate-pdf` response.
- `generate.js`, `wrangler.toml`, `package.json` — unchanged from
  v1.14.8 (version stamp on package.json only).

### Why

The PWA's preview-paper uses CSS-rendered A4 metrics; the worker
uses LibreOffice's pagination. The two have drifted ~3-5%
historically, which means a cover letter that fits 1 page on
screen can spill onto page 2 in the exported PDF. Until now the
user only noticed after the file landed in their Downloads folder.

This release surfaces the worker-side page count so the PWA can
compare it to its own pagination and raise a chip on mismatch.
Backwards-compatible: PWAs that don't read the header just ignore
it.

### Smoke test (post-deploy)

```bash
curl -i -X POST https://docx-worker.<subdomain>.workers.dev/generate-pdf \
  -H "Content-Type: application/json" \
  -H "X-AntCV-Secret: <secret-if-set>" \
  --data @minimal-cv-payload.json | head -30
```

Expected new header line: `X-AntCV-Pdf-Pages: <N>`.

### Local helper smoke test

```bash
cd antcv-docx-worker-1.14.9
node --input-type=module -e "
import { countPdfPages } from './src/pdf-page-count.js';
console.log(countPdfPages('%PDF-1.5\n2 0 obj <</Type /Pages /Count 1>> endobj\n%%EOF'));
// → 1
"
```

### Deploy

```powershell
cd antcv-docx-worker-1.14.9
# 1. Copy src/pdf-page-count.js into your repo's src/ dir.
# 2. Apply the two edits in PATCH-FOR-INDEX-JS.md to src/index.js.
# 3. npx wrangler deploy
```

### Pairs with

- PWA v1.40.196 — `antcv-docx-client.js` reads
  `X-AntCV-Pdf-Pages` and includes it as `pages` on the
  `antcv:pdf-export-success` event detail.
- PWA v1.40.196 — `antcv-pdf-page-mismatch.js` surfaces a
  dismissible chip on mismatch.

---

## v1.14.8 (prior)

- Per-item page assignments wired through to docx body.
- Continuation-header text honors `_page` annotations on
  labeled_list / list / education items.
