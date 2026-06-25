/* DIAGNOSTIC — DET-COORD-PACK-001. Multiple sidebar sections that target the SAME page must
 * PACK onto one page (one break for the group), not get a page each. tools(p1) + certs(p2) +
 * education(p2) -> 2 pages, not 3. Run: node test/diag-sidebar-pack.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cd;
  for (let e = 0; e < n; e++) { const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42); const en = buf.toString('utf8', p + 46, p + 46 + nl); if (en === name) { const lN = buf.readUInt16LE(lho + 26), lE = buf.readUInt16LE(lho + 28), ds = lho + 30 + lN + lE; const c = buf.slice(ds, ds + cs); return buf.readUInt16LE(p + 10) === 0 ? c : inflateRawSync(c); } p += 46 + nl + el + cl; }
  throw new Error('no ' + name);
}
const mod = await import('../src/index.js');
const mk = (n, pfx) => { const a = []; for (let i = 0; i < n; i++) a.push({ t: pfx + ' ' + i }); return a; };
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'G', email: 'g@b.c' }, meta: { role: 'R', subtitle: 'S' },
  style: { navy: '#283556', accent: '#01B7BB' },
  sections: [
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [{ id: 'r1', title: 'Role', company: 'C', years: '2020', bullets: ['a', 'b'] }] },
    { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'rich_block', items: mk(8, 'Tool') },
    { id: 'certs', title: 'CERTIFICATES', loc: 'sidebar', on: true, type: 'rich_block', items: mk(6, 'Cert'), row_pages: { '0': 2 } },
    { id: 'education', title: 'EDUCATION', loc: 'sidebar', on: true, type: 'rich_block', items: mk(4, 'Edu'), row_pages: { '0': 2 } },
  ],
};
const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
const ab = await res.arrayBuffer();
if (res.status !== 200) { log('status', res.status); process.exit(1); }
const xml = unzip(Buffer.from(ab), 'word/document.xml').toString('utf8');
const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
// top-level tables = pages
const toks = [...body.matchAll(/<\/?w:tbl\b/g)]; let d = 0, pages = 0;
for (const m of toks) { if (m[0] === '<w:tbl') { if (d === 0) pages++; d++; } else d--; }
const text = (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).join(' ');
const haveAll = ['Tool 0', 'Cert 0', 'Edu 0', 'Edu 3'].every(t => text.includes(t));
log('top-level page tables:', pages, '(expect 2 — page1 tools, page2 certs+education packed)');
log('all content present:', haveAll);
const ok = pages === 2 && haveAll;
log(ok ? 'SIDEBAR-PACK OK' : 'SIDEBAR-PACK FAIL');
process.exit(ok ? 0 : 1);
