/* DIAGNOSTIC — ANALYSIS-PRINT-COMPLETE-001 (owner 2026-06-10): now that the
 * Analysis panel is unified, the exported/printed report must include EVERY
 * section. The report builder held `tailoring` + `clStrategy` in its model but
 * never rendered them. Loads antcv-analysis-report-pdf-360, seeds a rationale
 * with all fields, and asserts the generated report HTML contains every
 * section (fit, strengths, gaps, recommendations, assumptions, confidence,
 * recruiter, red flags, questions, tailoring, cover-letter strategy).
 * Run: node test/diag-analysis-print-complete.mjs */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = await readFile(path.join(ROOT, 'antcv-analysis-report-pdf-360.js'), 'utf8');

const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<div class="antcv-editor-side-panel"><div>📊 Application Analysis</div><div id="ovf"><div>Overall Fit</div></div></div>
<script>${SRC}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  localStorage.setItem('rationale', JSON.stringify({
    fit_summary: 'Strong fit for the systems role.',
    fit_score: 0.78,
    top_fit_points: ['Electro-optics depth', 'ASPICE / ISO 26262 governance'],
    gaps: [{ missing: 'People-management scale', jd_mention: 'leads a team of 10' }],
    recommendations: ['Lead with the LiDAR change-control win'],
    assumptions: ['LiDAR experience transfers to their sensor stack'],
    confidence_notes: [{ text: 'supercontinuum specifics', confidence: 0.1, issue: 'not stated' }],
    recruiter: { name: 'Jane Roe', email: 'jane@nkt.example' },
    red_flags: ['Vague on-call expectations'],
    questions_in_jd: [{ question: 'Which tasks take most time?', suggested_answer: 'Ask in the call.' }],
    tailoring_decisions: 'Emphasised optics + governance; de-emphasised pure people-management.',
    cover_letter_strategy: 'Open on the change-control win; mirror their "robust systems" theme; close forward-looking.',
  }));
  localStorage.setItem('meta', JSON.stringify({ role: 'Systems Architect', company: 'NKT' }));
  localStorage.setItem('personalInfo', JSON.stringify({ name: 'Gabriel K', location: 'Copenhagen', citizenship: 'EU Citizen' }));
});
const errs = [];
page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(800);
const html = await page.evaluate(() => {
  const api = window.AntcvAnalysisReportPdf360;
  return api && api._reportHtml ? api._reportHtml() : '';
});
await browser.close(); await new Promise(r => server.close(r));

const want = [
  ['Overall fit', /overall fit/i, 'Strong fit for the systems role'],
  ['Strongest fit points', /strongest fit points/i, 'Electro-optics depth'],
  ['Gaps', /gaps/i, 'People-management scale'],
  ['Recommendations', /recommendations/i, 'LiDAR change-control win'],
  ['Assumptions', /assumptions/i, 'LiDAR experience transfers'],
  ['Confidence review', /confidence review/i, 'supercontinuum specifics'],
  ['Recruiter', /recruiter/i, 'Jane Roe'],
  ['Red flags', /red flags/i, 'on-call expectations'],
  ['Questions', /questions in the job/i, 'Which tasks take most time'],
  ['Tailoring decisions', /tailoring decisions/i, 'de-emphasised pure people-management'],
  ['Cover letter strategy', /cover letter strategy/i, 'mirror their'],
];
console.log('report length:', html.length, '| app errors:', errs.length);
let ok = errs.length === 0 && html.length > 0;
for (const [label, headRe, snippet] of want) {
  const hasHead = headRe.test(html);
  const hasBody = html.includes(snippet);
  const pass = hasHead && hasBody;
  if (!pass) ok = false;
  console.log(`CHECK ${label}: ${pass ? 'PASS' : 'FAIL'}${hasHead ? '' : ' (heading missing)'}${hasBody ? '' : ' (content missing)'}`);
}
console.log(ok ? 'ANALYSIS-PRINT-COMPLETE OK (all sections printed)' : 'ANALYSIS-PRINT-COMPLETE FAIL');
process.exitCode = ok ? 0 : 1;
