/* DIAGNOSTIC — ANALYSIS-PANEL-MISSING-FIT-001 (owner 2026-06-09). The "Analyse JD"
 * merge (antcv-analysis-merge-344) must carry the CORE analysis fields into the
 * rationale object so the in-app "📊 Application Analysis" panel shows OVERALL FIT /
 * STRONGEST FIT POINTS / GAPS / RECOMMENDATIONS — not just ASSUMPTIONS/CONFIDENCE.
 * Stubs /api/active + /api/applications + /api/jd-analysis (in addInitScript so the
 * sidecar's own auto-run uses the stub) and asserts the fit fields land in rationale. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIDE = await readFile(path.join(ROOT, 'antcv-analysis-merge-344.js'), 'utf8');
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div>📊 Application Analysis</div>
<script>${SIDE}</script>
</body></html>`;
const server = http.createServer((req, res) => {
  if ((req.url || '/').split('?')[0] === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); }
  else { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end('/* stub */'); } // 344 bootstraps 356 — serve empty JS
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  localStorage.setItem('proxyUrl', 'https://proxy.example.com');
  localStorage.setItem('rationale', JSON.stringify({ detected_language: 'en' })); // bug state: no fit fields, no recruiter
  localStorage.setItem('sections', JSON.stringify({ cv: [{ id: 'profile', content: 'x' }], cl: [] }));
  // Stub fetch BEFORE the sidecar loads so its auto-run uses it.
  const J = (o) => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
  window.fetch = async (url) => {
    const u = String(url);
    if (u.includes('/api/active')) return J({ ok: true, application_id: 'a1' });
    if (u.includes('/api/applications/')) return J({ ok: true, application: { jd_text: 'Senior Systems Engineer — Electro-Optical Systems at NKT Photonics. '.repeat(4) } });
    if (u.includes('/api/jd-analysis')) return J({ ok: true, analysis: {
      fit_summary: 'Strong fit for the role, with deep electro-optics experience.',
      top_fit_points: ['15 years in electro-optics and photonics', 'Cross-disciplinary team leadership'],
      gaps: ['No direct supercontinuum laser experience'],
      recommendations: ['Highlight optical systems experience'],
      tailoring_decisions: 'Framed automotive/defence as complementary.',
      cover_letter_strategy: 'Lead with optics + structured governance.',
      assumptions: ['LiDAR experience is transferable'],
      confidence_notes: [{ text: 'supercontinuum gap', confidence: 0, issue: 'not stated' }],
      recruiter: {}, red_flags: [],
    } });
    return J({ ok: false });
  };
});
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
// drive runMerge explicitly too (belt+braces) then wait for the write
await page.evaluate(async () => { try { await window.AntcvAnalysisMerge344.runMerge(); } catch (_) {} });
await page.waitForTimeout(800);
const rat = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('rationale') || '{}'); } catch (_) { return {}; } });
await browser.close(); await new Promise(r => server.close(r));
console.log('rationale keys after merge:', JSON.stringify(Object.keys(rat)));
console.log('fit_summary:', JSON.stringify((rat.fit_summary || '').slice(0, 45)));
console.log('top_fit_points:', (rat.top_fit_points || []).length, '| gaps:', (rat.gaps || []).length, '| recommendations:', (rat.recommendations || []).length, '| tailoring:', !!rat.tailoring_decisions, '| cl_strategy:', !!rat.cover_letter_strategy);
console.log('assumptions:', (rat.assumptions || []).length, '| confidence_notes:', (rat.confidence_notes || []).length);
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const fit = !!rat.fit_summary && (rat.top_fit_points || []).length === 2 && (rat.gaps || []).length === 1 && (rat.recommendations || []).length === 1 && !!rat.tailoring_decisions && !!rat.cover_letter_strategy;
const honesty = (rat.assumptions || []).length === 1 && (rat.confidence_notes || []).length === 1;
const ok = fit && honesty && errs.length === 0;
console.log(`CHECK A (CORE fit fields now in rationale → panel shows them): ${fit ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (assumptions/confidence still carried, no regression): ${honesty ? 'PASS' : 'FAIL'}`);
console.log(ok ? 'ANALYSIS-PANEL-FIT OK' : 'ANALYSIS-PANEL-FIT FAIL');
process.exitCode = ok ? 0 : 1;
