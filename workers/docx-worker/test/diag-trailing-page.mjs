/* DIAGNOSTIC — 3-PAGE-CONVERGENCE / trailing-page probe (owner 2026-06-29).
 * Owner's CV should converge to 3 pages but the tail (INTERESTS/ACCESSIBILITY/
 * RECOMMENDATIONS) spills onto a 4th. A docx structural diff of the owner's real
 * export vs a hand-fixed 3-page version found the 4th page driven by (1) a trailing
 * pageBreakBefore paragraph before <w:sectPr> and (2) an unequal page-2 table grid.
 * This drives the LIVE worker with a CV whose sidebar spills past the main's last
 * page and asserts the STRUCTURE: top-level table count, total pageBreakBefore
 * paragraphs, whether the LAST body element after the final </w:tbl> is a stray
 * page-break, and whether every page-table uses the SAME gridCol widths.
 * Run: node test/diag-trailing-page.mjs */
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
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 200));
  return Buffer.from(ab);
}
function topTableCount(body) {
  const toks = body.match(/<\/?w:(tbl|tc)\b/g) || []; let d = 0, t = 0;
  for (const x of toks) { if (x === '<w:tbl') { if (d === 0) t++; d++; } else if (x === '</w:tbl') d--; else if (x === '<w:tc') d++; else if (x === '</w:tc') d--; }
  return t;
}
// a long sidebar list (3 pages) + a main that ends on page 2 → sidebar spills past main.
const sidebarItems = [];
for (let i = 0; i < 30; i++) sidebarItems.push({ l: 'STD-' + i, v: 'desc ' + i, ...(i === 10 ? { _page: 2 } : i === 22 ? { _page: 3 } : {}) });
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S', role: 'R' },
  style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile.' },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r1', title: 'Role One', company: 'C1', years: '2018', bullets: ['a', 'b'] },
      { id: 'r2', title: 'Role Two', company: 'C2', years: '2020', bullets: ['c', 'd'], page: 2 },
    ] },
    { id: 'interests', title: 'INTERESTS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Sport', v: 'rugby' }] },
    { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'labeled_list', items: sidebarItems },
  ],
};
const buf = await gen(payload);
const xml = unzip(buf, 'word/document.xml').toString('utf8');
const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
const tables = topTableCount(body);
const pbCount = (body.match(/<w:pageBreakBefore/g) || []).length;
// element after the LAST </w:tbl> up to <w:sectPr>: is there a stray pageBreakBefore?
const lastTblEnd = body.lastIndexOf('</w:tbl>');
const tail = body.slice(lastTblEnd + 8, body.indexOf('<w:sectPr'));
const trailingBreak = /<w:pageBreakBefore/.test(tail);
// grid widths per top-level table
const grids = [...xml.matchAll(/<w:tblGrid>(.*?)<\/w:tblGrid>/gs)].map(m => (m[1].match(/w:w="(\d+)"/g) || []).map(s => s.replace(/\D/g, '')).join('/'));
const uniformGrid = new Set(grids).size <= 1;

log('top-level tables (pages):', tables);
log('pageBreakBefore paragraphs:', pbCount, '(expect tables-1 =', tables - 1, 'for clean between-table breaks)');
log('trailing pageBreakBefore after last table:', trailingBreak);
log('tail after last </w:tbl>:', JSON.stringify(tail.slice(0, 120)));
log('grids:', JSON.stringify(grids), '| uniform:', uniformGrid);

const cleanBreaks = pbCount === Math.max(0, tables - 1);
const ok = !trailingBreak && cleanBreaks && uniformGrid;
log(ok ? 'TRAILING-PAGE OK (no stray break, breaks=tables-1, uniform grid)' : 'TRAILING-PAGE FINDINGS ABOVE');
process.exitCode = 0; // probe, not a gate
