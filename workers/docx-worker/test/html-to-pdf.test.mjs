// html-to-pdf.test.mjs
// ============================================================
// HTML-TO-PDF-001 (2026-07-22): the JD-analysis report exports as a PDF through
// CloudConvert's Chrome engine (route /generate-analysis-pdf) instead of the
// browser print pipeline. This test exercises convertHtmlToPdf's CloudConvert
// job shape with a mocked fetch (no network), and locks the route + handler +
// mirror into the bundled worker.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { convertHtmlToPdf } from '../src/cloudconvert.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..', 'src');

// ---- behavioural: convertHtmlToPdf builds a chrome html->pdf job ----
test('convertHtmlToPdf submits an html->pdf CloudConvert job via the chrome engine', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    // 1) job create
    if (String(url).endsWith('/jobs') && opts && opts.method === 'POST') {
      return new Response(JSON.stringify({ data: { id: 'job_test_1' } }), { status: 200 });
    }
    // 2) status poll -> finished with an export url
    if (String(url).includes('/jobs/job_test_1')) {
      return new Response(JSON.stringify({
        data: { status: 'finished', tasks: [
          { name: 'export-pdf', status: 'finished', result: { files: [{ url: 'https://cc.example/out.pdf' }] } },
        ] },
      }), { status: 200 });
    }
    // 3) download the pdf bytes
    if (String(url) === 'https://cc.example/out.pdf') {
      return new Response(new Uint8Array([0x25, 0x50, 0x44, 0x46]).buffer, { status: 200 }); // %PDF
    }
    throw new Error('unexpected fetch: ' + url);
  };
  try {
    const res = await convertHtmlToPdf('<html><body>Analysis — æøå 分析 😀</body></html>', 'test-key', { filename: 'analysis' });
    assert.equal(res.jobId, 'job_test_1');
    assert.ok(res.buffer instanceof Uint8Array && res.buffer.length === 4, 'returns the downloaded PDF bytes');

    const createBody = JSON.parse(calls[0].opts.body);
    const conv = createBody.tasks['convert-to-pdf'];
    assert.equal(conv.operation, 'convert');
    assert.equal(conv.input_format, 'html', 'input format must be html');
    assert.equal(conv.output_format, 'pdf');
    assert.equal(conv.engine, 'chrome', 'html->pdf must use the chrome engine');
    assert.equal(conv.print_background, true, 'backgrounds (branded bands) must render');
    assert.equal(createBody.tasks['import-html'].operation, 'import/base64');
    assert.ok(createBody.tasks['import-html'].file.length > 0, 'html is base64-encoded (UTF-8 safe)');
  } finally {
    globalThis.fetch = realFetch;
  }
});

test('convertHtmlToPdf throws without an api key (falls back to browser print upstream)', async () => {
  await assert.rejects(() => convertHtmlToPdf('<html></html>', '', {}), /not configured/i);
});

// ---- source-lock: route + handler + version live in the deployed bundle ----
test('the bundled worker wires /generate-analysis-pdf to its handler', () => {
  const idx = readFileSync(join(SRC, 'index.js'), 'utf8');
  assert.ok(idx.includes('"/generate-analysis-pdf"'), 'route path present');
  assert.ok(idx.includes('handleGenerateAnalysisPdf'), 'handler referenced + defined');
  assert.ok(/async function convertHtmlToPdf\(/.test(idx), 'convertHtmlToPdf inlined in the bundle');
  assert.ok(idx.includes('X-CloudConvert-Key'), 'CORS allow-headers include the BYOK key');
  // Floor guard: the /generate-analysis-pdf route shipped at 1.14.162 and must stay in the
  // bundle. Compare the patch number numerically so a normal minor bump (1.14.170+) does not
  // trip this — the earlier /1\.14\.16[2-9]/ literal broke the moment VERSION crossed 1.14.170.
  const vm = idx.match(/var VERSION = "1\.14\.(\d+)/);
  assert.ok(vm && Number(vm[1]) >= 162, 'worker VERSION at or past 1.14.162 (route shipped)');
});
