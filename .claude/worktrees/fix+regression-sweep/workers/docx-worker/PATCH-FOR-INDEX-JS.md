# docx-worker v1.14.9 — patch for `src/index.js`

This release adds `X-AntCV-Pdf-Pages` to the `/generate-pdf`
response so the PWA can compare the worker's PDF pagination to its
own preview pagination and warn on mismatch (CL preview shows 1
page → PDF spills onto 2, etc.).

`src/index.js` is not shipped in the public worker zip — it lives
in your private repo. Apply the following patch by hand. Two
small edits, ~10 lines total.

---

## 1. Import the new helper

Near the top of `src/index.js`, alongside the existing imports:

```js
import { generateDocx } from './generate.js';
import { convertDocxToPdf } from './cloudconvert.js';
// v1.14.9: lightweight PDF page-counter for the X-AntCV-Pdf-Pages
// response header. Pure ASCII scan over the PDF buffer — no parser.
import { countPdfPages } from './pdf-page-count.js';
```

## 2. Set `X-AntCV-Pdf-Pages` in the `/generate-pdf` response

Find the response builder at the end of `handleGeneratePdf` —
it should look roughly like:

```js
  const headers = {
    ...corsHeaders(origin, env),
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(pdfResult.buffer.length),
    'X-AntCV-Pdf-Provider': provider,
    'X-AntCV-Pdf-JobId': pdfResult.jobId,
    'X-AntCV-Docx-Ms': String(docxMs),
    'X-AntCV-Pdf-Ms': String(pdfResult.durationMs),
    'Access-Control-Expose-Headers': [
      'X-AntCV-Pdf-Provider',
      'X-AntCV-Pdf-JobId',
      'X-AntCV-Docx-Ms',
      'X-AntCV-Pdf-Ms',
      'Content-Disposition',
    ].join(', '),
  };

  return new Response(pdfResult.buffer, { status: 200, headers });
}
```

Change it to:

```js
  // v1.14.9: report the PDF page count so the PWA can compare to
  // its CSS-based preview pagination and warn on mismatch. Cheap
  // pure-JS scan of the PDF buffer (no parser, no Wasm).
  let pdfPages = 0;
  try {
    pdfPages = countPdfPages(pdfResult.buffer);
  } catch (e) {
    console.warn('[docx-worker] countPdfPages failed:', e && e.message);
  }

  const headers = {
    ...corsHeaders(origin, env),
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(pdfResult.buffer.length),
    'X-AntCV-Pdf-Provider': provider,
    'X-AntCV-Pdf-JobId': pdfResult.jobId,
    'X-AntCV-Docx-Ms': String(docxMs),
    'X-AntCV-Pdf-Ms': String(pdfResult.durationMs),
    'X-AntCV-Pdf-Pages': String(pdfPages),
    'Access-Control-Expose-Headers': [
      'X-AntCV-Pdf-Provider',
      'X-AntCV-Pdf-JobId',
      'X-AntCV-Docx-Ms',
      'X-AntCV-Pdf-Ms',
      'X-AntCV-Pdf-Pages',
      'Content-Disposition',
    ].join(', '),
  };

  console.log(
    `[docx-worker] /generate-pdf ok: pages=${pdfPages}, docx ${docxMs}ms, ` +
      `pdf ${pdfResult.durationMs}ms, jobId=${pdfResult.jobId}`,
  );

  return new Response(pdfResult.buffer, { status: 200, headers });
}
```

That's it. Two adds:
- `import { countPdfPages } from './pdf-page-count.js';` near the top.
- One `pdfPages = countPdfPages(pdfResult.buffer);` call before the
  response builder, plus `'X-AntCV-Pdf-Pages': String(pdfPages)` in
  the headers and its name added to `Access-Control-Expose-Headers`.

## 3. Deploy

```powershell
cd <your local clone>
# Place src/pdf-page-count.js (shipped in this zip) into src/.
# Apply the two edits above to src/index.js.
npx wrangler deploy
```

## 4. Verify

```bash
# After deploy, a successful PDF export should include the new header.
curl -i -X POST https://docx-worker.<your-subdomain>.workers.dev/generate-pdf \
  -H "Content-Type: application/json" \
  -H "X-AntCV-Secret: <your-secret-if-set>" \
  -d '{"doc":"cv", ... minimal payload ...}' \
  | head -30
```

Look for `X-AntCV-Pdf-Pages: 2` (or whatever page count the PDF has).

The PWA v1.40.196 reads this header in `antcv-docx-client.js`
and surfaces a chip via `antcv-pdf-page-mismatch.js` when the
worker's count doesn't match the preview's count.

## 5. Backward compatibility

The new header is purely additive. A PWA on v1.40.195 or earlier
sees the header and ignores it. The PWA on v1.40.196 with an old
worker (1.14.8) sees no header, the chip stays silent, no
mismatch warning fires. So you can deploy either side first.

## 6. Smoke test

`src/pdf-page-count.js` has its own embedded smoke test you can
run locally:

```bash
node --input-type=module -e "
import { countPdfPages } from './src/pdf-page-count.js';
console.log('1-page PDF →', countPdfPages('%PDF-1.5\n1 0 obj <</Type /Pages /Count 1>> endobj\n%%EOF'));
console.log('3-page PDF (no /Count) →', countPdfPages('%PDF-1.5\n/Type /Page\n/Type /Page\n/Type /Page\n%%EOF'));
"
```

Expected output:
```
1-page PDF → 1
3-page PDF (no /Count) → 3
```
