/* DIAGNOSTIC — ORPHANS v2 export-parity proof (owner 2026-07-03).
 * The core v2 claim: the preflight fixes runts IN THE PAYLOAD, and the emitted
 * document.xml carries EXACTLY the fixed line content the measurer accepted.
 * This drives the REAL docx-worker in node with a seeded payload whose bullet,
 * Results line, and profile paragraph all runt under the deterministic measurer:
 *   1. run the preflight (vm sandbox, deterministic greedy measurer, stubbed LLM)
 *   2. assert each target was fixed (NBSP-bound or re-tightened) and that the
 *      measurer predicts NO runt on the exact fixed strings
 *   3. POST the fixed payload to workers/docx-worker/src/index.js /generate
 *   4. unzip word/document.xml and assert the fixed strings (incl. U+00A0) landed
 *      verbatim in <w:t> — i.e. what the measurer accepted IS what ships.
 * Real-font truth stays with pwa/test/diag-orphan-preflight-real.mjs (Chromium)
 * + the owner's live PDF eyeball.
 * Run: node pwa/test/diag-orphan-preflight-parity.mjs */
import { readFile } from 'node:fs/promises';
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import vm from 'node:vm';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
const NBSP = ' ';

// ── minimal unzip (same pattern as workers/docx-worker/test/diag-twocol-ownerlike.mjs)
function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  if (i < 0) throw new Error('no EOCD');
  const cdOffset = buf.readUInt32LE(i + 16);
  const nEntries = buf.readUInt16LE(i + 10);
  let p = cdOffset;
  for (let e = 0; e < nEntries; e++) {
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const ename = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (ename === name) {
      const lNameLen = buf.readUInt16LE(lho + 26);
      const lExtraLen = buf.readUInt16LE(lho + 28);
      const dataStart = lho + 30 + lNameLen + lExtraLen;
      const comp = buf.slice(dataStart, dataStart + compSize);
      return buf.readUInt16LE(p + 10) === 0 ? comp : inflateRawSync(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('entry not found: ' + name);
}
const texts = (xml) => (xml.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || []).map((s) => s.replace(/<[^>]+>/g, ''));

// ── load the preflight sidecar in a vm sandbox ───────────────────────────────
const src = await readFile(new URL('../antcv-orphan-export-preflight.js', import.meta.url), 'utf8');
const store = new Map([['proxyUrl', 'https://relay.example']]);
const sandbox = {
  window: { addEventListener() {}, dispatchEvent() { return true; } },
  localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
  console: { info() {}, warn() {}, log() {}, error() {} },
  setTimeout() { return 0; }, clearTimeout() {}, setInterval() { return 0; },
  CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
  Promise, Date, JSON, Array, Object, Error, RegExp, Math, String, Number, Boolean, isFinite,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const api = sandbox.window.AntcvOrphanExportPreflight;

// deterministic greedy measurer (6px/char, NBSP glues) — same contract as the DOM one
const CW = 6;
function fakeMeasure(spec) {
  let t = String(spec.html).replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const words = t.split(' ').filter(Boolean);
  const lines = []; let cur = '';
  for (const w of words) {
    const cand = cur ? cur + ' ' + w : w;
    if (!cur || cand.length * CW <= spec.widthPx) cur = cand;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.map((l) => l.length * CW);
}

// ── seeded payload: bullet (L2-fixable) + Results (L2-fixable) + profile (L3) ─
// bullet/Results: uniform 4-char words -> a short runt tail that binding clears.
const runtBullet = Array(34).fill('word').join(' ') + '.';
const runtResults = Array(28).fill('gains').join(' ') + ' 95%.';
// profile: 2-char words -> binding can never clear (residue) -> stubbed LLM shortens.
const runtProfile = Array(56).fill('ab').join(' ') + ' zz 42.';
const profileShort = 'ab '.repeat(40).trim() + ' zz 42.';

const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 'orphan-parity',
  personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
  style: {}, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: runtProfile },
    { id: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r1', title: 'PdM', company: 'Acme', years: '2020', bullets: [runtBullet], results: runtResults },
    ] },
    { id: 'languages', title: 'LANGUAGES', loc: 'sidebar', on: true, type: 'text', content: 'EN, DA' },
  ],
};

// stubbed LLM: returns the shortened profile for whatever residue arrives
const fetchImpl = (url, opts) => {
  const inputs = JSON.parse(JSON.parse(opts.body).messages[0].content);
  const out = inputs.map((t) => (t === runtProfile ? profileShort : t));
  return Promise.resolve({ json: () => Promise.resolve({ content: [{ text: JSON.stringify(out) }] }) });
};

const met = api._metricsFromPayload(payload);
const before = {
  bullet: fakeMeasure({ html: runtBullet, widthPx: met.bulletWpx }),
  results: fakeMeasure({ html: '<b><i>Results: </i></b>' + runtResults, widthPx: met.cellWpx }),
  profile: fakeMeasure({ html: runtProfile, widthPx: met.cellWpx }),
};
log('before: bullet lines', before.bullet.length, 'runt', api._isRuntLines(before.bullet, met.bulletWpx),
  '| results lines', before.results.length, 'runt', api._isRuntLines(before.results, met.cellWpx),
  '| profile lines', before.profile.length, 'runt', api._isRuntLines(before.profile, met.cellWpx));

const sum = await api.run(payload, { measureLines: fakeMeasure, fetchImpl });
log('preflight summary:', JSON.stringify(sum));

const fixedBullet = payload.sections[1].roles[0].bullets[0];
const fixedResults = payload.sections[1].roles[0].results;
const fixedProfile = payload.sections[0].content;

// 2. measurer prediction on the EXACT fixed strings: no runt anywhere
const after = {
  bullet: api._isRuntLines(fakeMeasure({ html: api._toDisplayHtml(fixedBullet), widthPx: met.bulletWpx }), met.bulletWpx),
  results: api._isRuntLines(fakeMeasure({ html: '<b><i>Results: </i></b>' + api._toDisplayHtml(fixedResults), widthPx: met.cellWpx }), met.cellWpx),
  profile: api._isRuntLines(fakeMeasure({ html: api._toDisplayHtml(fixedProfile), widthPx: met.cellWpx }), met.cellWpx),
};
const bulletFixed = fixedBullet !== runtBullet && fixedBullet.includes(NBSP);
const resultsFixed = fixedResults !== runtResults && fixedResults.includes(NBSP);
const profileFixed = fixedProfile === profileShort;
log('payload fixed: bullet(NBSP)', bulletFixed, '| results(NBSP)', resultsFixed, '| profile(rewritten)', profileFixed);
log('measurer predicts runt after fix: bullet', after.bullet, '| results', after.results, '| profile', after.profile);

// 3+4. drive the REAL worker with the FIXED payload and read document.xml
const mod = await import(new URL('../../workers/docx-worker/src/index.js', import.meta.url));
const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
const ab = await res.arrayBuffer();
if (res.status !== 200) { log('WORKER STATUS', res.status, Buffer.from(ab).toString().slice(0, 300)); process.exit(1); }
const xml = unzipEntry(Buffer.from(ab), 'word/document.xml').toString('utf8');
const tx = texts(xml);

const xmlHasBullet = tx.some((t) => t === fixedBullet);
const xmlHasResults = tx.some((t) => t === fixedResults.trim());
const xmlHasProfile = tx.some((t) => t === fixedProfile);
const xmlHasOldTail = tx.some((t) => t === runtBullet || t === runtProfile || t === runtResults.trim());
const xmlNbspCount = (xml.match(/ /g) || []).length;
log('document.xml: fixed bullet verbatim', xmlHasBullet, '| fixed results verbatim', xmlHasResults,
  '| rewritten profile verbatim', xmlHasProfile, '| any UNFIXED original present', xmlHasOldTail,
  '| NBSP glyphs in xml', xmlNbspCount);

const ok =
  sum.runts === 3 && sum.bound === 2 && sum.rewritten === 1 &&
  bulletFixed && resultsFixed && profileFixed &&
  !after.bullet && !after.results && !after.profile &&
  xmlHasBullet && xmlHasResults && xmlHasProfile && !xmlHasOldTail && xmlNbspCount >= 2;
log(ok ? 'ORPHAN-PREFLIGHT-PARITY OK' : 'ORPHAN-PREFLIGHT-PARITY FAIL');
process.exit(ok ? 0 : 1);
