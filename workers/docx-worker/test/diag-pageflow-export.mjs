/* DIAGNOSTIC — PAGEBREAK-STYLE-OPTIONS-001 export halves (1.14.55).
 *   1. default: a 2-page CV keeps its "(Cont.)" continuation heading, no
 *      header/footer refs, single header band.
 *   2. contHeadlines:false → NO "(Cont.)" anywhere in document.xml.
 *   3. repeatHeader:true → page-2 table opens with the slim strip (candidate
 *      name appears once per page table) and the cont body row min drops to
 *      15538-900=14638 (post PDF-BLANK-PAGE-002, CONT_BODY_MIN = PAGE_H-1300).
 *   4. pageNumbers:'bottom-right' → footer part exists with a PAGE field,
 *      referenced from sectPr; 'top-right' → header part instead.
 */
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
      return buf.readUInt16LE(p + 10) === 0 ? comp : inflateRawSync(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return null;
}
function listEntries(buf) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdOffset = buf.readUInt32LE(i + 16);
  const nEntries = buf.readUInt16LE(i + 10);
  let p = cdOffset; const names = [];
  for (let e = 0; e < nEntries; e++) {
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    names.push(buf.toString('utf8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return names;
}

const mod = await import('../src/index.js');
async function gen(styleExtra) {
  const reg = [{ group: 'G0' }];
  for (let e = 0; e < 4; e++) reg.push({ l: 'R0.' + e, v: 'Line ' + e });
  reg.push({ group: 'G1', _page: 2 });
  for (let e = 0; e < 4; e++) reg.push({ l: 'R1.' + e, v: 'Cont line ' + e, _page: 2 });
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c' },
    meta: { subtitle: 'Product Expert' },
    style: { navy: '#283556', ...styleExtra }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
      { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'labeled_list', items: reg },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  const buf = Buffer.from(ab);
  return { xml: unzipEntry(buf, 'word/document.xml').toString('utf8'), entries: listEntries(buf), buf };
}

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

{
  const { xml, entries } = await gen({});
  check('default keeps (Cont.)', xml.includes('(Cont.)') || xml.includes('(CONT.)'), '');
  // the library always emits an (empty) header1.xml; what matters is that no
  // FOOTER part and no sectPr references exist by default
  check('default: no footer part / refs', !entries.some(e => /word\/footer\d*\.xml/.test(e)) && !/w:footerReference/.test(xml), entries.join(','));
  const bands = (xml.match(/Gabriel K/g) || []).length;
  check('default: name once (single band)', bands === 1, 'count ' + bands);
}
{
  const { xml } = await gen({ contHeadlines: false });
  check('contHeadlines:false drops (Cont.)', !xml.includes('(Cont.)') && !xml.includes('(CONT.)'), '');
}
{
  const { xml } = await gen({ repeatHeader: true });
  const bands = (xml.match(/Gabriel K/g) || []).length;
  check('repeatHeader: name on both pages', bands === 2, 'count ' + bands);
  // PDF-BLANK-PAGE-002 (38ec068, 1.14.83): CONT_BODY_MIN PAGE_H-600 -> PAGE_H-1300 (16238->15538),
  // so the repeatHeader cont row min = 15538-900 = 14638 (was 16238-900 = 15338).
  check('repeatHeader: cont row min shrunk', xml.includes('w:val="14638"'), '');
}
{
  const { xml, entries, buf } = await gen({ pageNumbers: 'bottom-right' });
  const fEntry = entries.find(e => /word\/footer\d*\.xml/.test(e));
  const fXml = fEntry ? unzipEntry(buf, fEntry).toString('utf8') : '';
  check('bottom-right: footer part + PAGE field', !!fEntry && /PAGE/.test(fXml), entries.join(','));
  check('bottom-right: sectPr references footer', /w:footerReference/.test(xml), '');
}
{
  // export limitation: top-right ALSO renders via the footer (Word header
  // parts serialize empty through this tree-shaken bundle, and a top number
  // would sit on the navy band of the margin-0 pages). Preview keeps the
  // true corner.
  const { entries, xml, buf } = await gen({ pageNumbers: 'top-right' });
  const fEntry = entries.find(e => /word\/footer\d*\.xml/.test(e));
  const fXml = fEntry ? unzipEntry(buf, fEntry).toString('utf8') : '';
  check('top-right: falls back to footer + PAGE field', !!fEntry && /PAGE/.test(fXml), entries.join(','));
  check('top-right: sectPr references footer', /w:footerReference/.test(xml), '');
}

{
  // 1.14.56: the CL (linear) gets the same footer page number
  const payload = {
    schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c' },
    meta: { subtitle: 'S' },
    style: { navy: '#283556', pageNumbers: 'bottom-right' }, font_sizes: { mainBody: 10.5 },
    sections: [{ id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'Text.' }],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const fEntry = listEntries(buf).find(e => /word\/footer\d*\.xml/.test(e));
  const fXml = fEntry ? unzipEntry(buf, fEntry).toString('utf8') : '';
  check('CL: footer page number', res.status === 200 && !!fEntry && /PAGE/.test(fXml) && /w:footerReference/.test(xml), 'status ' + res.status);
}

const ok = checks.every(Boolean);
log(ok ? 'PAGEFLOW-EXPORT OK' : 'PAGEFLOW-EXPORT FAIL');
process.exit(ok ? 0 : 1);
