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

// FIGURE-CONTACT-REF-001 (1.14.120, owner reference DOCX): the medallion is a
// FLOAT (wp:anchor) FIXED at 1.50" (1371600 EMU), page-anchored at posH 396240
// (0.433") with posV paragraph-relative -365760 (-0.40"), layoutInCell="0",
// and it now RIDES THE CONTACT PARAGRAPH (first run of the ind-2592 paragraph)
// instead of the sidebar's first paragraph — which stays as a pure SPACER
// (w:after="990", no drawing). Contact line: 8pt (w:sz 16) + ind 2592/-216.
const bFloat = /<wp:anchor/.test(bridge);
const bSized = bridge.includes('cx="1371600" cy="1371600"');
const bPosH = bridge.includes('<wp:positionH relativeFrom="page"><wp:posOffset>396240</wp:posOffset>');
const bPosV = bridge.includes('<wp:positionV relativeFrom="paragraph"><wp:posOffset>-365760</wp:posOffset>');
const bEscapesCell = /layoutInCell="0"/.test(bridge);
const bNotInBandRow = !/<wp:anchor/.test(bRow) && !/<wp:inline/.test(bRow); // band row is the empty photo zone
// anchor rides the CONTACT paragraph: the paragraph containing the phone digits
function paraAround(xml, needle) {
  const i = xml.indexOf(needle);
  if (i < 0) return '';
  const start = xml.lastIndexOf('<w:p ', i) >= 0 ? Math.max(xml.lastIndexOf('<w:p ', i), xml.lastIndexOf('<w:p>', i)) : xml.lastIndexOf('<w:p>', i);
  const end = xml.indexOf('</w:p>', i);
  return start >= 0 && end >= 0 ? xml.slice(start, end) : '';
}
const contactPara = paraAround(bridge, '31 71');
const bAnchorInContact = /<wp:anchor/.test(contactPara);
const bContactInd = /w:left="2592"/.test(contactPara) && /w:right="-216"/.test(contactPara);
const bContact8pt = /<w:sz w:val="16"\/>/.test(contactPara);
// sidebar first paragraph = spacer: after=990, no drawing anywhere in it
const bSpacer = bridge.includes('w:after="990"');
// Control: default sidebar-top keeps the single gridSpan-2 band + an inline image.
const nInline = /<wp:inline/.test(normal);
const nContactPara = paraAround(normal, '31 71');
const nNoInd = !/w:left="2592"/.test(nContactPara);

log('bridge header split (2 cells, no gridSpan):', bSplit, '| normal gridSpan-2 kept:', nSpan);
log('bridge medallion FLOAT 1.50":', bFloat && bSized, '| posH page 396240:', bPosH, '| posV -365760:', bPosV, '| escapes cell:', bEscapesCell, '| band row empty:', bNotInBandRow);
log('anchor rides contact para:', bAnchorInContact, '| contact ind 2592/-216:', bContactInd, '| contact 8pt:', bContact8pt, '| sidebar spacer 990:', bSpacer);
log('normal sidebar-top photo stays inline:', nInline, '| normal contact no ind:', nNoInd);
const ok = bSplit && nSpan && bFloat && bSized && bPosH && bPosV && bEscapesCell && bNotInBandRow && bAnchorInContact && bContactInd && bContact8pt && bSpacer && nInline && nNoInd;
log(ok ? 'PHOTO-BRIDGE-EXPORT OK' : 'PHOTO-BRIDGE-EXPORT FAIL');
process.exit(ok ? 0 : 1);
