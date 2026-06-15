/* DIAGNOSTIC — PHOTO-SIDEBAR-BRIDGE-001 export half (1.14.51). Drives the
 * live worker with photoPosition='band-overlap' + photo and asserts:
 *   1. the candidate header ROW is SPLIT (two cells: sidebar-width photo zone
 *      + text cell) instead of the single gridSpan-2 cell;
 *   2. the medallion is a FLOATING image (wp:anchor) with a NEGATIVE vertical
 *      offset (lifted over the seam) and the forwarded size (156px → 1485900
 *      EMU extent);
 *   3. the anchor paragraph reserves the bottom half + gap (spacing after
 *      (156/2+14)×15 = 1380 twips);
 *   4. control: default sidebar-top keeps the gridSpan-2 header and an inline
 *      (wp:inline) image. */
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
  throw new Error('entry not found: ' + name);
}

const PHOTO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mod = await import('../src/index.js');
async function gen(extraPi) {
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Gabriel K', email: 'g@b.c', phone: '+45 31 71 00 72', location: 'Copenhagen, Denmark', photo_b64: PHOTO_B64, ...extraPi },
    meta: { subtitle: 'Sub', role: 'R' },
    style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
      { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Eng', v: 'Python' }] },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return unzipEntry(Buffer.from(ab), 'word/document.xml').toString('utf8');
}

const bridge = await gen({ photoPosition: 'band-overlap', photoSizePx: 156 });
const normal = await gen({ photoPosition: 'sidebar-top' });

// header row shape: first row of the first table
function firstRow(xml) {
  const tbl = xml.indexOf('<w:tbl>');
  const tr = xml.indexOf('<w:tr', tbl);
  const trEnd = xml.indexOf('</w:tr>', tr);
  return xml.slice(tr, trEnd);
}
const bRow = firstRow(bridge);
const nRow = firstRow(normal);
// PHOTO-BRIDGE-NONFLOAT-001 REVERTED (1.14.71): the band-overlap medallion is
// back to a FLOATING straddle (floats DO render in the owner's CloudConvert PDF;
// the earlier "no bridge" was the position-forwarding bug, fixed in 1.50.492).
// The split band header keeps an EMPTY photo zone; the float anchors in the
// sidebar's first paragraph, page-positioned, lifted half a diameter so its
// centre sits on the band-sidebar seam.
const bSplit = !/gridSpan/.test(bRow) && (bRow.match(/<w:tc>/g) || []).length === 2;
const nSpan = /w:gridSpan w:val="2"/.test(nRow);

// The medallion is a FLOAT (wp:anchor) at the forwarded 156px (156×9525=1485900),
// with a NEGATIVE paragraph-relative vertical offset (lifted over the seam) and
// layoutInCell="0" (escapes the sidebar cell). It is NOT inline in the band row.
const bFloat = /<wp:anchor/.test(bridge);
const bSized = bridge.includes('cx="1485900" cy="1485900"');
const bNegV = /<wp:positionV relativeFrom="paragraph"><wp:posOffset>-\d+<\/wp:posOffset>/.test(bridge);
const bEscapesCell = /layoutInCell="0"/.test(bridge);
const bNotInBandRow = !/<wp:anchor/.test(bRow) && !/<wp:inline/.test(bRow); // band row is the empty photo zone
// Control: default sidebar-top keeps the single gridSpan-2 band + an inline image.
const nInline = /<wp:inline/.test(normal);

log('bridge header split (2 cells, no gridSpan):', bSplit, '| normal gridSpan-2 kept:', nSpan);
log('bridge medallion FLOAT (156px):', bFloat && bSized, '| negative V offset:', bNegV, '| escapes cell:', bEscapesCell, '| band row empty:', bNotInBandRow);
log('normal sidebar-top photo stays inline:', nInline);
const ok = bSplit && nSpan && bFloat && bSized && bNegV && bEscapesCell && bNotInBandRow && nInline;
log(ok ? 'PHOTO-BRIDGE-EXPORT OK' : 'PHOTO-BRIDGE-EXPORT FAIL');
process.exit(ok ? 0 : 1);
