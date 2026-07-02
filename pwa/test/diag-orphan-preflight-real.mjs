/* DIAGNOSTIC — ORPHANS v2, REAL-FONT half (owner 2026-07-03).
 * Runs the sidecar's REAL DOM measurer (Range.getClientRects on an offscreen div
 * with the EXPORT font family/size and EXPORT column widths) in Chromium, on
 * realistic content including the actual Sirin acceptance line from export 16
 * ("…now in commercial devices."). Asserts:
 *   1. the measurer returns sane per-line widths at the export widths
 *   2. the preflight's accounting is consistent (runts = bound + residue when
 *      the LLM is stubbed to no-op)
 *   3. every L2-bound target re-measures CLEAN (no runt at 0.40) with REAL fonts
 * The owner's live CloudConvert PDF remains the final acceptance gate.
 * Run: node pwa/test/diag-orphan-preflight-real.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const server = http.createServer(async (req, res) => {
  try {
    let rel = decodeURIComponent((req.url || '/').split('?')[0]);
    if (rel === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body><script src="/antcv-orphan-export-preflight.js"></script></body></html>'); return; }
    const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null);
    if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' });
    res.end(await readFile(fp));
  } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(base + '/', { waitUntil: 'load' });

const report = await page.evaluate(async () => {
  const api = window.AntcvOrphanExportPreflight;
  if (!api) return { err: 'sidecar missing' };
  // Realistic owner-scale content. The Sirin Results line is the export-16
  // acceptance runt ("in commercial devices."); the bullets echo the §7 table.
  const sirinResults = 'Co-invented the stray-light optical window (Patent No. 241997), now in commercial devices.';
  const bullets = [
    'Define and validate camera modules for high-security smartphones, balancing optical performance, cost constraints, and manufacturability.',
    'Run image-quality benchmarking across DxOMark protocols, Imatest, and Qualcomm tools.',
    'Coordinate cross-functional change requests between R&D, manufacturing, and customer-facing work.',
    'Own system-level requirement flow-down for laser, optics, and detection channels across the product line, from concept to production handover.',
  ];
  const profile = 'Product and project expert bridging electro-optics research and volume manufacturing, with a record of moving prototypes into certified, revenue-carrying products across defence and consumer segments.';
  const payload = {
    doc: 'cv', layout: 'two_column',
    style: { mainEdgeIndent: 14, seamGap: 6 }, font_sizes: {},
    sections: [
      { id: 'profile', type: 'text', loc: 'main', content: profile },
      { id: 'experience', type: 'experience', loc: 'main', roles: [
        { id: 'r1', title: 'System Engineer', company: 'Sirin Labs', bullets: bullets, results: sirinResults },
      ] },
    ],
  };
  const met = api._metricsFromPayload(payload);
  const targets = api._collectTargets(payload, met);
  targets.forEach((t) => { t.family = met.family; });
  const before = targets.map((t) => {
    const lines = api._domMeasureLines({ html: t.prefixHtml + api._toDisplayHtml(t.get()), widthPx: t.widthPx, fontPx: t.fontPx, family: met.family, align: t.align });
    return { kind: t.kind, text: t.get().slice(-40), lines: lines.map((x) => Math.round(x)), runt: api._isRuntLines(lines, t.widthPx), widthPx: Math.round(t.widthPx) };
  });
  // stub LLM = no-op (returns inputs) so residue stays residue — accounting test
  const fetchImpl = (u, o) => Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.parse(o.body).messages[0].content }] }) });
  const sum = await api.run(payload, { fetchImpl, storage: { getItem: () => null, setItem: () => {} } });
  // re-collect: run() enumerates its own targets; the profile target's get()
  // closes over a paragraph array, so the PRE-run object goes stale after a fix
  const targetsAfter = api._collectTargets(payload, met);
  const after = targetsAfter.map((t) => {
    const lines = api._domMeasureLines({ html: t.prefixHtml + api._toDisplayHtml(t.get()), widthPx: t.widthPx, fontPx: t.fontPx, family: met.family, align: t.align });
    return { kind: t.kind, nbsp: t.get().includes(' '), lines: lines.length, runt: api._isRuntLines(lines, t.widthPx) };
  });
  return { met: { cellWpx: Math.round(met.cellWpx), bulletWpx: Math.round(met.bulletWpx), family: met.family }, before, sum, after };
});
await browser.close(); await new Promise((r) => server.close(r));

if (report.err) { console.log('FAIL:', report.err); process.exit(1); }
console.log('export metrics:', JSON.stringify(report.met));
report.before.forEach((b) => console.log('  before', b.kind, 'w' + b.widthPx, 'lines[' + b.lines.join(',') + ']', b.runt ? 'RUNT' : 'ok', '…' + b.text));
console.log('summary:', JSON.stringify(report.sum));
report.after.forEach((a) => console.log('  after ', a.kind, 'lines', a.lines, a.runt ? 'RUNT(residue)' : 'clean', a.nbsp ? '(NBSP-bound)' : ''));

const sane = report.before.every((b) => b.lines.length >= 1 && b.lines.every((w) => w > 0 && w <= b.widthPx + 2));
const runtsDetected = report.sum.runts;
const accounting = report.sum.runts === report.sum.bound + report.sum.residue && report.sum.rewritten === 0;
const boundClean = report.after.filter((a) => a.nbsp).every((a) => !a.runt);
const residueLeft = report.after.filter((a) => a.runt).length === report.sum.residue;
console.log('sane widths', sane, '| runts detected', runtsDetected, '| accounting', accounting, '| bound targets clean', boundClean, '| residue accounted', residueLeft);
const ok = sane && accounting && boundClean && residueLeft && runtsDetected >= 1;
console.log(ok ? 'ORPHAN-PREFLIGHT-REAL OK' : 'ORPHAN-PREFLIGHT-REAL FAIL');
process.exit(ok ? 0 : 1);
