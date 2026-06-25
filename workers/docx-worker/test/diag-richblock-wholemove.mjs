/* DIAGNOSTIC — RICH-BLOCK-WHOLE-MOVE-001. A rich_block SIDEBAR section whose first item is on
 * page 2 (row_pages {0:2}) must move WHOLE to page 2 — one header, NO "(CONT.)", header not
 * orphaned on page 1. Run: node test/diag-richblock-wholemove.mjs */
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
const items = []; for (let i = 0; i < 9; i++) items.push({ t: 'Certificate line ' + i });
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'G', email: 'g@b.c' }, meta: { role: 'R', subtitle: 'S' },
  style: { navy: '#283556', accent: '#01B7BB' },
  sections: [
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [{ id: 'r1', title: 'Role One', company: 'C', years: '2020', bullets: ['a', 'b'] }] },
    { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'rich_block', items: [{ t: 'Tool a' }, { t: 'Tool b' }] },
    { id: 'certs', title: 'CERTIFICATES & COURSES', loc: 'sidebar', on: true, type: 'rich_block', items, row_pages: { '0': 2 } },
  ],
};
const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
const ab = await res.arrayBuffer();
if (res.status !== 200) { log('status', res.status, Buffer.from(ab).toString().slice(0, 200)); process.exit(1); }
const xml = unzip(Buffer.from(ab), 'word/document.xml').toString('utf8');
const text = (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).join(' ')
  .replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const plainHdr = (text.match(/CERTIFICATES & COURSES(?! \(CONT)/gi) || []).length;
const contHdr = (text.match(/CERTIFICATES & COURSES \(CONT/gi) || []).length;
const allCerts = items.every((it) => text.includes(it.t));
log('plain "CERTIFICATES & COURSES" headers:', plainHdr, '(expect 1)');
log('"(CONT.)" headers:', contHdr, '(expect 0 — whole section moved)');
log('all 9 cert lines present:', allCerts);
const ok = plainHdr === 1 && contHdr === 0 && allCerts;
log(ok ? 'RICHBLOCK-WHOLEMOVE OK' : 'RICHBLOCK-WHOLEMOVE FAIL');
process.exit(ok ? 0 : 1);
