/* DIAGNOSTIC — EXPORT-PARITY-RUNNING-001 (owner 2026-06-29).
 * A multi-page main-column EXPERIENCE emits internal page breaks; a tail section
 * (RECOMMENDATIONS) that the coordinator placed on the experience's LAST page must
 * PACK onto that page, not be pushed a page later. The old assembleColumn advanced
 * `running` only by a section's FIRST page, so the tail kept an extra leading break
 * and landed a page late (recommendations on page 4 instead of 3). This drives the
 * live worker with experience roles on pages 1/2/3 + recommendations forwarded to
 * page 3 and asserts RECOMMENDATIONS is in the 3rd top-level page-table (packed),
 * and the doc has exactly 3 page-tables (no phantom 4th).
 * Run: node test/diag-export-parity-running.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdo = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cdo;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const en = buf.toString('utf8', p + 46, p + 46 + nl);
    if (en === name) { const lnl = buf.readUInt16LE(lho + 26), lel = buf.readUInt16LE(lho + 28), ds = lho + 30 + lnl + lel; const c = buf.slice(ds, ds + cs); return buf.readUInt16LE(p + 10) === 0 ? c : inflateRawSync(c); }
    p += 46 + nl + el + cl;
  }
  throw new Error('no ' + name);
}
const mod = await import('../src/index.js');
async function gen(payload) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 200));
  return Buffer.from(ab);
}
// page-tables = top-level [sidebar,main] tables; map each to the text it contains
function pageTexts(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const toks = [...body.matchAll(/<\/?w:(tbl|tc)\b/g)];
  let d = 0, s = -1; const spans = [];
  for (const m of toks) { const t = m[0]; if (t === '<w:tbl') { if (d === 0) s = m.index; d++; } else if (t === '</w:tbl') { d--; if (d === 0) spans.push([s, m.index]); } else if (t === '<w:tc') d++; else if (t === '</w:tc') d--; }
  return spans.map(([a, b]) => (body.slice(a, b).match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(x => x.replace(/<[^>]+>/g, '')).join(' '));
}
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S', role: 'R' },
  style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile.' },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r1', title: 'Role One', company: 'C1', years: '2018', bullets: ['a', 'b'] },
      { id: 'r2', title: 'Role Two', company: 'C2', years: '2020', bullets: ['c', 'd'], page: 2 },
      { id: 'r3', title: 'Role Three', company: 'C3', years: '2022', bullets: ['e', 'f'], page: 3 },
    ] },
    // RECOMMENDATIONS forwarded to page 3 (the experience's last page) — must PACK there, not page 4.
    { id: 'recommendations', title: 'RECOMMENDATIONS', loc: 'main', on: true, type: 'education', page: 3,
      items: [{ degree: 'Ref', school: 'Available on request', year: '' }] },
    { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Sport', v: 'rugby' }] },
  ],
};
const xml = unzip(await gen(payload), 'word/document.xml').toString('utf8');
const pages = pageTexts(xml);
const recPage = pages.findIndex(t => t.includes('RECOMMENDATIONS')) + 1;
const r3Page = pages.findIndex(t => t.includes('Role Three')) + 1;
log('top-level page-tables:', pages.length);
log('Role Three on page:', r3Page, '| RECOMMENDATIONS on page:', recPage);
const A = pages.length === 3;
const B = recPage === 3 && recPage === r3Page; // packed onto the experience's last page, not page 4
log(`CHECK A (exactly 3 page-tables, no phantom 4th): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (RECOMMENDATIONS packs onto page 3 with Role Three, not pushed late): ${B ? 'PASS' : 'FAIL'}`);
const ok = A && B;
log(ok ? 'EXPORT-PARITY-RUNNING OK (2/2)' : 'EXPORT-PARITY-RUNNING FAIL');
process.exitCode = ok ? 0 : 1;
