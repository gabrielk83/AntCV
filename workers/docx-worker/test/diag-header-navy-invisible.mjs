/* DIAGNOSTIC — HEADER-NAVY-STRIP-001 (owner 2026-07-07).
 * Header must be INVISIBLE: no shd navy strip, 1pt para font, watermark preserved,
 * line spacing a multiple of 0.5pt. Run: node test/diag-header-navy-invisible.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdOffset = buf.readUInt32LE(i + 16), nEntries = buf.readUInt16LE(i + 10); let p = cdOffset;
  for (let e = 0; e < nEntries; e++) {
    const compSize = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const en = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (en === name) { const lN = buf.readUInt16LE(lho + 26), lE = buf.readUInt16LE(lho + 28), ds = lho + 30 + lN + lE, comp = buf.slice(ds, ds + compSize); return (buf.readUInt16LE(p + 10) === 0) ? comp : inflateRawSync(comp); }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
const mod = await import('../src/index.js');
async function gen(payload) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  if (res.status !== 200) throw new Error('status ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}
const base = {
  schema_version: '1.0', doc: 'cv', language: 'da', layout: 'linear', filename: 't',
  package: 'copenhagen-modern', watermark: 'DEMO - AntCV',
  personal_info: { name: 'Anita Myre', location: '2300, K', email: 'anita@ex.dk', phone: '+45 12 34 56 78', linkedin: 'linkedin.com/in/anita' },
  meta: { subtitle: 'Processes & Products' },
  font_sizes: { mainBody: 10.5 },
  sections: [{ id: 'profile', title: 'PROFIL', loc: 'main', on: true, type: 'text', text: 'Erfaren profil.' }],
};
let pass = 0, fail = 0;
function chk(cond, msg) { if (cond) { pass++; log('  PASS ' + msg); } else { fail++; log('  FAIL ' + msg); } }
for (const wm of [true, false]) {
  const p = { ...base }; if (!wm) delete p.watermark;
  const buf = await gen(p);
  const h = unzipEntry(buf, 'word/header1.xml');
  log('\n=== watermark=' + wm + ' header1.xml ' + (h ? 'present' : 'MISSING'));
  if (!h) { if (wm) { fail++; log('  FAIL header missing with watermark'); } else { log('  (no header without band/wm)'); } continue; }
  const s = h.toString('utf8');
  chk(!/<w:shd\b/i.test(s), 'no shd navy strip');
  chk(/<w:sz w:val="2"\/>/.test(s), '1pt para font (sz=2)');
  chk(/w:line="40" w:lineRule="exact"/.test(s), 'line=40 exact (2pt = multiple of 0.5pt)');
  if (wm) chk(/AntCVWatermark/.test(s) && /DEMO - AntCV/.test(s), 'demo watermark VML preserved');
}
log('\n' + (fail ? ('FAILED ' + fail) : 'ALL PASS') + ' (' + pass + ' checks)');
process.exit(fail ? 1 : 0);
