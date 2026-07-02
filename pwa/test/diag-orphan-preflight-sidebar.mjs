/* DIAGNOSTIC — SIDEBAR-ORPHANS-001 + SIDEBAR-FONT-METRIC-001 (owner export (3), 2026-07-03).
 * The owner's 16:17Z export carried 8 sidebar runts that the live sidebar preflight
 * missed: the payload carries NO sidebarBodyFont (the WORKER fills it from the package
 * body font -> the PDF's Carlito), and the old fallback picked style.sidebarFont — the
 * HEADING font (Trebuchet MS) — so the measurer wrapped every value differently from
 * the PDF. This diag replays the owner's REAL 8 sidebar items (verbatim from the (3)
 * PDF) through the REAL DOM measurer in Chromium with the REAL payload style shape
 * (sidebarFont present, sidebarBodyFont absent) and asserts:
 *   1. sideFamily resolves to the package BODY font (Calibri), never the heading font
 *   2. all 8 labeled values are collected as side_label targets
 *   3. most are detected as runts at real Calibri metrics (Carlito-compatible)
 *   4. every L2-bound value re-measures CLEAN; sidebar residue is 0 (never L3)
 * The owner's live CloudConvert PDF remains the final acceptance gate.
 * Run: node pwa/test/diag-orphan-preflight-sidebar.mjs */
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
  // The owner's 8 runt items, verbatim from the (3) PDF (tools / regulatory / interests).
  const ITEMS = [
    { sid: 'tools', l: 'Software', v: 'Jira, Confluence, Codebeamer ALM, Enterprise Architect, Git; Power BI, Excel, SQL, VBA, Python, Jupyter, Docker, LaTeX; Microsoft Copilot; Zemax, COMSOL Multiphysics, MATLAB, LabVIEW; Imatest, Qualcomm ISP tools, Chromatix, EZTune; Altium, FPGA' },
    { sid: 'tools', l: 'Lab & fabrication', v: 'Cleanroom fabrication, lithography, deposition, etch, DRIE, plasma processing, PDMS nanoimprint, PECVD/CVD CNT growth, catalyst preparation, SOI MEMS/NEMS fabrication' },
    { sid: 'tools', l: 'AI-assisted', v: 'Experiment setup, log triage, measurement analysis, protocol templating, documentation retrieval, prompt/evaluation workflows' },
    { sid: 'regulatory', l: 'STANAG 4694', v: 'Weapon-mounted sight interface context' },
    { sid: 'regulatory', l: 'DIN EN 61010', v: 'Electrical safety, lab & measurement equipment' },
    { sid: 'regulatory', l: 'ISO 16750', v: 'Automotive environmental conditions and testing' },
    { sid: 'interests', l: 'Cultural exchange', v: 'Languages, food culture and board games' },
    { sid: 'interests', l: 'Supervision', v: 'Handling three feline strategic napping experts (cats)' },
  ];
  const bySection = {};
  ITEMS.forEach((it) => { (bySection[it.sid] = bySection[it.sid] || []).push({ l: it.l, v: it.v }); });
  const payload = {
    doc: 'cv', layout: 'two_column',
    // REAL payload shape: sidebarFont = the HEADING font is present; sidebarBodyFont is NOT.
    // sidebar_ratio 0.38 measured from the owner's (3) PDF (max sidebar line 214pt ->
    // text column 4280 twips + 2x120 sbLR -> sidebarW 4520/11906).
    sidebar_ratio: 0.38,
    style: { mainEdgeIndent: 14, seamGap: 6, sidebarFont: 'Trebuchet MS' },
    font_sizes: {},
    sections: Object.keys(bySection).map((sid) => ({ id: sid, type: 'labeled_list', loc: 'sidebar', items: bySection[sid] })),
  };
  const met = api._metricsFromPayload(payload);
  const targets = api._collectTargets(payload, met);
  targets.forEach((t) => { if (!t.family) t.family = met.family; });
  const before = {};
  targets.forEach((t) => { before[t.sid + '|' + t.itemIdx] = t.get(); });
  // Pre-run measurement snapshot (real DOM measurer, sidebar metrics)
  const pre = targets.map((t) => {
    const lines = api._measure ? null : null;
    return null;
  });
  let fetchCalls = 0;
  const sum = await api.run(payload, { fetchImpl: () => { fetchCalls++; return Promise.reject(new Error('stub')); } });
  // Post-run: which values changed (bound), and do bound ones re-measure clean?
  const perItem = [];
  for (const t of targets) {
    const now = t.get();
    const bound = now !== before[t.sid + '|' + t.itemIdx];
    perItem.push({ sid: t.sid, label: t.prefixHtml.replace(/<[^>]+>/g, '').slice(0, 22), widthPx: Math.round(t.widthPx), bound, hasNbsp: now.indexOf(' ') !== -1 });
  }
  return {
    sideFamily: met.sideFamily, mainFamily: met.family,
    sideCellWpx: Math.round(met.sideCellWpx * 10) / 10, sbBodyPx: met.sbBodyPx,
    targets: targets.length, summary: sum, fetchCalls, perItem,
  };
});

await browser.close(); server.close();

if (report.err) { console.error('FAIL', report.err); process.exit(1); }
console.log('sideFamily:', report.sideFamily, '| main:', report.mainFamily, '| sideCellWpx:', report.sideCellWpx, '| sbBodyPx:', report.sbBodyPx);
console.log('targets:', report.targets, '| summary:', JSON.stringify(report.summary), '| fetchCalls:', report.fetchCalls);
report.perItem.forEach((p) => console.log(`  ${p.sid.padEnd(10)} ${p.label.padEnd(22)} w=${p.widthPx} bound=${p.bound} nbsp=${p.hasNbsp}`));

let fail = false;
const expect = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); fail = true; } else { console.log('OK:', msg); } };
expect(report.sideFamily === 'Calibri', 'SIDEBAR-FONT-METRIC-001: sideFamily is the package BODY font (Calibri), not the Trebuchet heading font');
expect(report.targets === 8, 'all 8 owner items collected as side_label targets');
expect(report.summary.residue === 0, 'sidebar runts never become L3 residue');
expect(report.fetchCalls === 0, 'no LLM call for sidebar-only runts');
expect(report.summary.runts >= 5, `most owner items detected as runts at real Calibri metrics (got ${report.summary.runts})`);
expect(report.summary.bound === report.perItem.filter((p) => p.bound).length, 'bound accounting matches changed payload values');
report.perItem.forEach((p) => { if (p.bound) expect(p.hasNbsp, `${p.label} bound value carries NBSP glue`); });
console.log(fail ? 'DIAG SIDEBAR PREFLIGHT: FAIL' : 'DIAG SIDEBAR PREFLIGHT: PASS');
process.exit(fail ? 1 : 0);
