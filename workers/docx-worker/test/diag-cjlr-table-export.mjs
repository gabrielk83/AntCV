/* DIAGNOSTIC — CJLR-TABLE-001 export half (worker 1.14.58). A per-row
 * item_alignment override ("rows.1" = center, full-array index) renders the
 * first data row's EXPERTISE cell centered in the DOCX while the second data
 * row stays LEFT; the Focus cell never changes. */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10);
  let p = cd;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), nm = buf.toString('utf8', p + 46, p + 46 + nl);
    if (nm === name) {
      const ln = buf.readUInt16LE(lho + 26), lx = buf.readUInt16LE(lho + 28);
      const d = buf.slice(lho + 30 + ln + lx, lho + 30 + ln + lx + cs);
      return buf.readUInt16LE(p + 10) === 0 ? d : inflateRawSync(d);
    }
    p += 46 + nl + xl + cl;
  }
  return null;
}
const mod = await import('../src/index.js');
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
    { id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table',
      item_alignment: { 'rows.1': 'center' },
      rows: [['Focus Area', 'Strategic Expertise'], ['HardwareLead', 'CenterMeExpertise'], ['Requirements', 'LeftDefaultExpertise']] },
    { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'E', v: 'P' }] },
  ],
};
const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
const buf = Buffer.from(await res.arrayBuffer());
if (res.status !== 200) { log('status', res.status, buf.toString().slice(0, 200)); process.exit(1); }
const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
// the paragraph containing CenterMeExpertise must carry jc=center; the one
// with LeftDefaultExpertise must carry jc=left
function jcFor(text) {
  const i = xml.indexOf(text);
  if (i < 0) return 'NOT FOUND';
  const pStart = xml.lastIndexOf('<w:p>', i) >= 0 ? xml.lastIndexOf('<w:p>', i) : xml.lastIndexOf('<w:p ', i);
  const seg = xml.slice(pStart, i);
  const m = seg.match(/<w:jc w:val="(\w+)"\/>/);
  return m ? m[1] : 'none';
}
const c1 = jcFor('CenterMeExpertise');
const c2 = jcFor('LeftDefaultExpertise');
const c3 = jcFor('HardwareLead');
log('rows.1 expertise jc:', c1, '| rows.2 expertise jc:', c2, '| focus cell jc:', c3);
const ok = c1 === 'center' && c2 === 'left' && c3 === 'left';
log(ok ? 'CJLR-TABLE-EXPORT OK' : 'CJLR-TABLE-EXPORT FAIL');
process.exit(ok ? 0 : 1);
