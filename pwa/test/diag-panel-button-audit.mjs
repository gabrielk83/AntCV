/* DIAGNOSTIC — NIGHTLY-PREVIEW-BUTTON-AUDIT-001 (register row 23, owner
 * standing order): enumerate ALL buttons on the PREVIEW region and the side
 * panel, click each, and assert a state/store/DOM delta — every button must
 * visibly do something. Then flag store keys the controls write that the
 * export payload builder never reads (preview-only suspects — the dead-control
 * class that already produced three findings: name CJLR wrote name_input, the
 * two Application CJLRs wrote input-only keys).
 *
 * Method: real browser boot (owner-shaped editor state), network to relay/
 * proxy/worker BLOCKED (audit must never generate/export/sync), dialogs
 * auto-dismissed. Per button: snapshot localStorage -> click -> 650ms settle ->
 * diff store writes + preview DOM mutation count + page errors -> Escape to
 * close any overlay. Buttons matching the DANGEROUS list (generate/export/
 * delete/sign-out/…) are skipped and reported as skipped.
 *
 * Output: docs/qa/PANEL_BUTTON_AUDIT_<date>.md + .json next to it.
 * Run: node pwa/test/diag-panel-button-audit.mjs
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(ROOT, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png' };
const server = http.createServer(async (req, res) => {
  try { let rel = decodeURIComponent((req.url || '/').split('?')[0]); if (rel === '/') rel = '/index.html'; const fp = path.join(ROOT, rel); const s = await stat(fp).catch(() => null); if (!s || !s.isFile()) { res.writeHead(404); res.end('nf'); return; } res.writeHead(200, { 'content-type': MIME[path.extname(fp)] || 'application/octet-stream' }); res.end(await readFile(fp)); } catch (e) { res.writeHead(500); res.end(String(e && e.message)); }
});
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

// Owner-shaped editor state: main prose + experience + table + rich_block
// tools + labeled regulatory + certs list + interests/languages + CL body.
const SECTIONS = {
  cv: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Product engineer with 15 years across regulated hardware programmes and measured delivery.' },
    { id: 'work_style', title: 'WORK STYLE', loc: 'main', on: true, type: 'text', content: 'Work style: calm, structured decisions from measured data with clear written outcomes.' },
    { id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: [ ['Focus Area', 'Strategic Expertise'], ['Platform reuse', 'Modular hardware, feature reuse'], ['Validation', 'DV/PV, FAT/SAT, calibration'] ] },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r1', title: 'Product Expert', company: 'Kanzen', years: '2022 - 2026', on: true, bullets: ['Delivered consulting projects bridging hardware development and traceability tooling.', 'Ran RFQ evaluation programmes with supplier scoring on quality and lead time.'], results: 'Delivered a Smart FMEA framework over an ALM system.' },
      { id: 'r2', title: 'Change Request Lead', company: 'Innoviz', years: '2017 - 2025', on: true, bullets: ['Chaired the Change Control Board and introduced structured change processes.'], results: 'Cut the change cycle from 250 to 10 days.' },
    ] },
    { id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'rich_block', items: [
      { grp: true, t: 'Tools', bullets: [] },
      { b: 'Software', t: 'Jira, Confluence, Git, Python', bullets: [] },
      { b: 'Instruments', t: 'Optical benches, interferometry, probe stations', bullets: [] },
    ] },
    { id: 'certs', title: 'CERTIFICATES & COURSES', loc: 'sidebar', on: true, type: 'list', items: ['Six Sigma Black Belt (CSSC)', 'ASPICE VDA (2018)'] },
    { id: 'regulatory', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'labeled_list', items: [
      { group: 'Systems' }, { l: 'ASPICE', v: 'Requirements, traceability' }, { l: 'ISO 26262', v: 'Functional safety' },
    ] },
    { id: 'languages', title: 'LANGUAGES', loc: 'sidebar', on: true, type: 'labeled_list', items: [ { l: 'English', v: 'native / fluent' }, { l: 'Danish', v: 'B1' } ] },
    { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items: [ { l: 'Tai-chi', v: 'Stability and calm' } ] },
  ],
  cl: [
    { id: 'greeting', title: '', loc: 'body', on: true, type: 'text', content: 'Dear Hiring Team,' },
    { id: 'opening', title: '', loc: 'body', on: true, type: 'rich_block', headlineOff: true, items: [{ b: '', t: 'Your hardware platform is exactly the engineering problem I want to work on.', bullets: [] }] },
    { id: 'why', title: 'WHY THIS COMPANY', loc: 'body', on: true, type: 'rich_block', headlineOff: true, items: [{ b: 'Why this company', t: 'The platform matches my validation background directly.', bullets: [] }] },
  ],
};
const PI = {
  name: 'Diag User', email: 'diag@example.com', phone: '+45 00 00 00 00', location: '2300 København S',
  wizardCompleted: true,
  tools: [ { l: 'Software', v: 'Jira, Confluence, Git, Python' }, { l: 'Instruments', v: 'Optical benches, interferometry, probe stations' } ],
  experience: [ { title: 'Product Expert', company: 'Kanzen', years: '2022 - 2026', bullets: ['Delivered consulting projects.'], results: 'Smart FMEA framework.' } ],
};

const DANGEROUS = /generate|regenerat|export|download|sign\s?out|log\s?out|delete|erase|remove all|reset|clear all|upload|import|print|clean.?delete|fresh start|enrich|fix orphans|analy[sz]e|save to cloud|read from cloud|restore/i;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1560, height: 1120 } });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e && e.message)));
page.on('dialog', (d) => d.dismiss().catch(() => {}));
// The audit must never generate/export/sync: block API-class traffic, but let
// static CDN assets through (React itself loads from a CDN).
await page.route('**/*', (route) => {
  const u = route.request().url();
  if (u.startsWith(base)) return route.continue();
  if (/workers\.dev|\/api\/|relay|proxy|cloudconvert|anthropic|openai|googleapis\.com\/v1|mistral/i.test(u)) return route.abort();
  return route.continue();
});
await page.addInitScript(({ sections, pi }) => {
  try { if (navigator.serviceWorker) navigator.serviceWorker.register = () => Promise.reject(new Error('sw-off')); } catch (_) {}
  localStorage.setItem('antcv:disable-loading-gate', '1');
  localStorage.setItem('antcv:auth:token', 't'); localStorage.setItem('antcv:auth:email', 'demo@e.com'); localStorage.setItem('antcv:auth:expires_at', '4102444800');
  localStorage.setItem('session', JSON.stringify({ email: 'demo@e.com', ts: 1717000000000 }));
  localStorage.setItem('step', JSON.stringify('editor')); localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify(sections));
  localStorage.setItem('personalInfo', JSON.stringify(pi));
  localStorage.setItem('meta', JSON.stringify({ company: 'Diag Co', role: 'Diag Role' }));
  localStorage.setItem('language', JSON.stringify('en')); localStorage.setItem('wizardCompleted', JSON.stringify(true));
  localStorage.setItem('stylePackage', JSON.stringify('copenhagen-modern'));
}, { sections: SECTIONS, pi: PI });
await page.goto(base + '/index.html', { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(5200);
if (pageErrors.length) console.log('BOOT ERRORS:', pageErrors.slice(0, 4));

// Attach the write recorder + a MutationObserver AFTER boot (installing the
// setItem wrapper pre-boot broke the app's own storage bootstrapping).
await page.evaluate(() => {
  window.__auditWrites = [];
  const _set = localStorage.setItem.bind(localStorage);
  localStorage.setItem = (k, v) => { try { window.__auditWrites.push(k); } catch (_) {} return _set(k, v); };
  window.__auditMutations = 0;
  const mo = new MutationObserver((muts) => { window.__auditMutations += muts.length; });
  mo.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
});

// Open the main panels first so their buttons exist in the DOM.
for (const opener of ['⚙', '¶ Section', '🎯 Analysis', '👁 Preview']) {
  try { await page.getByText(opener, { exact: false }).first().click({ timeout: 1200 }); await page.waitForTimeout(700); } catch (_) {}
}

// ROUND-BASED enumeration: React re-renders REPLACE nodes (index tags die), and
// clicks reveal new buttons (panels, editors) — so re-enumerate every round,
// identify buttons by a stable signature (label + occurrence among same label),
// and click the first never-processed one until nothing new remains.
function enumerateExpr() {
  return `(() => {
    const els = Array.from(document.querySelectorAll('button, [role="button"], input[type="checkbox"], select'));
    const seen = {};
    return els.map((el) => {
      const r = el.getBoundingClientRect();
      const label = (el.getAttribute('aria-label') || el.getAttribute('title') || (el.textContent || '').trim() || el.getAttribute('data-antcv') || el.type || '(unlabelled)').slice(0, 80);
      const n = (seen[label] = (seen[label] || 0) + 1);
      el.setAttribute('data-audit-sig', label.replace(/"/g, "'") + '#' + n);
      return {
        sig: label.replace(/"/g, "'") + '#' + n,
        tag: el.tagName.toLowerCase(),
        label,
        visible: r.width > 4 && r.height > 4 && r.bottom > -innerHeight && r.top < innerHeight * 5,
        inPreview: !!el.closest('.antcv-preview-paper, [data-antcv-preview]'),
        disabled: !!el.disabled,
      };
    });
  })()`;
}

// PASS-2 (register row 23 remainder): two classes of false negatives in the
// first pass, both fixed with a bounded, single retry rather than a whole new
// enumeration strategy:
//
//   "unclickable" (23 in the 2026-07-03 run) — every one of these failed with
//   "Timeout … waiting for locator([data-audit-sig=…])", i.e. the locator
//   never resolved at all. force:true bypasses actionability checks (covered/
//   disabled/stable) but NOT locator resolution — so this isn't an overlay
//   covering a real, present button, it's the stamped data-audit-sig attribute
//   having been wiped by a React re-render that happened between the
//   enumerate-and-stamp step and the click step (many of these labels — ▲ ▼ +
//   − ON ↶ — are per-row steppers whose row list is exactly what re-renders
//   when a PRIOR click in the same round changes something). Fix: retry once
//   via a label-based locator that doesn't depend on the (possibly stale)
//   stamped attribute surviving a re-render.
//
//   "not-visible-or-disabled" (65 in that run) — mostly per-row/per-section
//   controls: CJLR aligners (10), "Fit this section tighter" (8), "Enrich
//   this section" (7), per-item ✕ (7). Checked the CJLR cycler's own source
//   (antcv-item-align.js:324-360, makeCycler()) — it is NOT a CSS :hover
//   reveal; the button is injected with a fixed, always-visible 20-24px
//   inline size. The likelier gate, per this project's own history
//   (HEADER-ROW-DBLCLICK-001 / SECTION-ROW-DBLCLICK-001, docs/qa/
//   OPEN_REGISTER.md old row 5): a dblclick on the row opens a detailed
//   editor that these per-item controls live inside. A hover-then-recheck
//   is attempted anyway (harmless — it only ever ADDS a chance to recover,
//   falling through to the original verdict on no change) in case some
//   OTHER not-visible family (a floating-FAB-style control, say) genuinely
//   is hover-gated, but re-running this harness with the hover leg found
//   ZERO recoveries (see the "PASS-2:" console line at the end of a run) —
//   confirming CJLR-class controls need the dblclick path, not hover. Left
//   as pass-3 follow-up rather than guessed here: it needs verifying
//   whether a row dblclick reveals the SAME stamped element or opens a
//   editor holding a NEW one (which would need re-enumeration, not just a
//   recheck).
function findRowAncestorExpr(sig) {
  return `(() => {
    const el = document.querySelector('[data-audit-sig="${sig}"]');
    if (!el) return null;
    const row = el.closest('[data-sid], tr, li, [data-antcv-row-path]');
    return row ? true : false;
  })()`;
}

const processed = new Set();
const results = [];
const MAX_CLICKS = 160;
let clicks = 0;
let unclickableRetried = 0;
let notVisibleRecovered = 0;
while (clicks < MAX_CLICKS) {
  const list = await page.evaluate(enumerateExpr());
  let next = list.find((b) => !processed.has(b.sig));
  if (!next) break;
  processed.add(next.sig);
  if (!next.visible || next.disabled) {
    // PASS-2 leg 1: hover the nearest row/section ancestor — many controls
    // only gain non-trivial size on :hover of their row.
    const hasRowAncestor = await page.evaluate(findRowAncestorExpr(next.sig)).catch(() => false);
    if (hasRowAncestor) {
      try {
        await page.locator(`[data-audit-sig="${next.sig}"]`).first()
          .locator('xpath=ancestor-or-self::*[@data-sid or self::tr or self::li or @data-antcv-row-path][1]')
          .hover({ timeout: 800 });
        await page.waitForTimeout(150);
        const recheck = await page.evaluate((sig) => {
          const el = document.querySelector(`[data-audit-sig="${sig.replace(/"/g, '\\"')}"]`);
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return r.width > 4 && r.height > 4 && r.bottom > -innerHeight && r.top < innerHeight * 5;
        }, next.sig).catch(() => null);
        if (recheck) { next = { ...next, visible: true }; notVisibleRecovered++; }
      } catch (_) { /* hover failed — fall through to the not-visible verdict below */ }
    }
    if (!next.visible) { results.push({ ...next, verdict: 'not-visible-or-disabled' }); continue; }
  }
  if (DANGEROUS.test(next.label)) { results.push({ ...next, verdict: 'skipped-dangerous' }); continue; }
  clicks++;
  const before = await page.evaluate(() => ({ w: window.__auditWrites.length, m: window.__auditMutations }));
  const errBefore = pageErrors.length;
  try {
    await page.locator(`[data-audit-sig="${next.sig}"]`).first().click({ timeout: 1500, force: true });
  } catch (e) {
    // PASS-2 leg 2: one retry via a label-based locator, in case the stamped
    // attribute was wiped by a re-render between enumeration and this click.
    let recovered = false;
    try {
      await page.getByText(next.label, { exact: false }).first().click({ timeout: 1200, force: true });
      recovered = true;
      unclickableRetried++;
    } catch (_) { /* genuinely unclickable — fall through */ }
    if (!recovered) {
      results.push({ ...next, verdict: 'unclickable', note: String(e && e.message).slice(0, 100) });
      continue;
    }
  }
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => ({ w: window.__auditWrites.length, m: window.__auditMutations }));
  const wrote = await page.evaluate((n) => window.__auditWrites.slice(n), before.w);
  const threw = pageErrors.length > errBefore ? pageErrors.slice(errBefore) : [];
  const domDelta = after.m - before.m;
  let verdict = 'active';
  if (threw.length) verdict = 'THROWS';
  else if (!wrote.length && domDelta === 0) verdict = 'DEAD';
  else if (!wrote.length && domDelta > 0) verdict = 'ui-only';
  results.push({ ...next, verdict, writes: [...new Set(wrote)].slice(0, 8), domDelta, errors: threw.slice(0, 2) });
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(120);
}
console.log(`PASS-2: ${notVisibleRecovered} not-visible button(s) recovered via row-hover; ${unclickableRetried} unclickable button(s) recovered via label-locator retry.`);

// ── phase 2: preview-only suspects — keys written by controls that the export
// payload builder never mentions (static cross-check against docx-client + the
// known payload key map). Coarse but exactly how the three real dead-control
// findings were made.
const docxSrc = await readFile(path.join(ROOT, 'antcv-docx-client.js'), 'utf8');
const appSrc = await readFile(path.join(ROOT, 'app.js'), 'utf8');
const allWrites = [...new Set(results.flatMap((r) => r.writes || []))];
const IGNORE = /^(sections|personalInfo|meta|step|doc|session|language|antcv:auth|antcv:visibilityAnalytics|antcv:clProseGuard|antcv:metaStamp|__)/;
const suspects = allWrites.filter((k) => !IGNORE.test(k)).map((k) => {
  const short = k.replace(/^antcv:/, '');
  const inDocx = docxSrc.includes(k) || docxSrc.includes(short);
  return { key: k, exportReads: inDocx };
}).filter((s) => !s.exportReads);

const date = new Date().toISOString().slice(0, 10);
const counts = results.reduce((a, r) => { a[r.verdict] = (a[r.verdict] || 0) + 1; return a; }, {});
const md = [
  `# Panel/preview button audit — ${date} (NIGHTLY-PREVIEW-BUTTON-AUDIT-001, register row 23)`,
  '',
  `Harness: pwa/test/diag-panel-button-audit.mjs (real browser boot, network blocked, dialogs dismissed).`,
  `Bundle: ${(appSrc.match(/1\.51\.\d+/) || ['?'])[0]}-era app.js; buttons enumerated: ${results.length}.`,
  '',
  `## Verdict counts`,
  ...Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`),
  '',
  `## THROWS (page errors on click) — fix first`,
  ...results.filter((r) => r.verdict === 'THROWS').map((r) => `- [${r.idx}] "${r.label}" (${r.tag}${r.inPreview ? ', preview' : ', panel'}): ${(r.errors || []).join(' | ')}`),
  '',
  `## DEAD candidates (no store write, no DOM delta) — verify each before filing`,
  ...results.filter((r) => r.verdict === 'DEAD').map((r) => `- [${r.idx}] "${r.label}" (${r.tag}${r.inPreview ? ', preview' : ', panel'})`),
  '',
  `## Preview-only suspects (keys written by controls, never read by the export builder)`,
  ...(suspects.length ? suspects.map((s) => `- ${s.key}`) : ['- none']),
  '',
  `## Skipped (dangerous labels — audited manually only)`,
  ...results.filter((r) => r.verdict === 'skipped-dangerous').map((r) => `- "${r.label}"`),
  '',
  `Raw JSON: PANEL_BUTTON_AUDIT_${date}.json`,
].join('\n');

await writeFile(path.join(REPO, 'docs', 'qa', `PANEL_BUTTON_AUDIT_${date}.md`), md);
await writeFile(path.join(REPO, 'docs', 'qa', `PANEL_BUTTON_AUDIT_${date}.json`), JSON.stringify({ date, counts, results, suspects }, null, 1));
console.log(md.split('\n').slice(0, 60).join('\n'));
console.log(`\nTOTAL ${results.length} buttons | ${JSON.stringify(counts)} | page errors during audit: ${pageErrors.length}`);
await browser.close();
server.close();
