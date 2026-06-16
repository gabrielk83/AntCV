/* DIAGNOSTIC — GROUP-NAME-VISIBILITY-001 export (owner 2026-06-16). A labeled_list
 * row flagged `labelHidden` must drop its bold group name in the DOCX (value-only),
 * while a normal row keeps "label: value". Renders a labeled_list and asserts the XML.
 * Run: node test/diag-group-name-export.mjs */
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

const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
  style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile.' },
    { id: 'tools', title: 'TOOLS & METHODS', loc: 'main', on: true, type: 'labeled_list', items: [
      { l: 'VisibleCat', v: 'ALPHAVAL' },
      { l: 'HiddenCat', v: 'BETAVAL', labelHidden: true },
    ] },
  ],
};

const buf = await gen(payload);
const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');

const visLabel = xml.includes('VisibleCat:');
const hidLabel = xml.includes('HiddenCat');         // label text must be ABSENT
const alphaVal = xml.includes('ALPHAVAL');
const betaVal  = xml.includes('BETAVAL');

log('VisibleCat: (normal label present):', visLabel);
log('HiddenCat (hidden label present — want false):', hidLabel);
log('ALPHAVAL (normal value present):', alphaVal);
log('BETAVAL (hidden-row value still present):', betaVal);

const ok = visLabel && !hidLabel && alphaVal && betaVal;
log(ok ? 'GROUP-NAME-EXPORT OK' : 'GROUP-NAME-EXPORT FAIL');
process.exit(ok ? 0 : 1);
