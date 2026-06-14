/* DIAGNOSTIC — TABLE-BANDED-ROWS-001 (owner 2026-06-14). The exported PDF/DOCX
 * was "missing the banded-row colours seen in preview": the worker banded the
 * WRONG rows (odd data rows) with a near-invisible FAFAFA, while the React
 * preview (app.src.js ~5149) bands EVEN data rows with a visible pale teal
 * #eaf7f7. Worker now matches: even data rows (idx 0,2,4…) → EAF7F7, odd → none.
 * Renders a CV competency table and asserts the per-row shading.
 * Run: node test/diag-banded-rows.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

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
      return (buf.readUInt16LE(p + 10) === 0) ? comp : inflateRawSync(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('entry not found: ' + name);
}

const mod = await import('../src/index.js');
async function gen(payload) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status);
  return Buffer.from(ab);
}

const competency = {
  id: 'comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table',
  rows: [
    ['Area', 'Detail'],
    ['Optics', 'Electro-optics, LiDAR, SPAD/SiPM.'],   // data idx 0 (even) → banded
    ['Systems', 'Architecture, ASPICE, ISO 26262.'],   // data idx 1 (odd)  → none
    ['Process', 'Six Sigma, BABOK, change control.'],  // data idx 2 (even) → banded
  ],
};
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
  style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile.' },
    competency,
  ],
};

const buf = await gen(payload);
const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');

const bandHits = (xml.match(/w:fill="EAF7F7"/g) || []).length;
const fafafaHits = (xml.match(/w:fill="FAFAFA"/gi) || []).length;

// Each banded data ROW has 2 cells → 2 fills per banded row. With 4 rows
// (header + 3 data), even data rows = idx 0 and 2 → 2 banded rows → >=4 fills.
const okBand = bandHits >= 4;
const okNoFafafa = fafafaHits === 0;

log('EAF7F7 (visible band) cell fills:', bandHits, '| expected >= 4:', okBand);
log('FAFAFA (old invisible band) fills:', fafafaHits, '| expected 0:', okNoFafafa);

if (okBand && okNoFafafa) {
  log('BANDED-ROWS OK');
} else {
  log('BANDED-ROWS FAIL');
  process.exit(1);
}
