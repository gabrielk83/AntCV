/* DIAGNOSTIC — PHOTO-POSITIONS-EXPORT-001 (1.14.53). Drives the worker fetch
 * handler with every NEW photo position and asserts the export half:
 *   main-left/right       → FLOATING image (wp:anchor), wrapSquare bothSides,
 *                           column-relative align left/right, 115px extent
 *                           (crescent parity — no photo-row table).
 *   main-left/right-bottom→ INLINE image after the main sections, 115px.
 *   bridge-middle/bottom  → FLOATING image, page-relative H offset on the
 *                           seam (sidebarW − px/2 DXA → EMU), V centre /
 *                           bottom-gap, wrapSquare bothSides (dual crescents).
 *   none                  → NO image at all (the picker's Hidden value used
 *                           to clamp to sidebar-top and still export).
 *   band-overlap          → regression guard: still anchored, 156px default.
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
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text. '.repeat(10) },
      { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Eng', v: 'Python' }] },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return unzipEntry(Buffer.from(ab), 'word/document.xml').toString('utf8');
}

// geometry constants mirrored from the worker (default sidebar_ratio 0.33)
const PAGE_W = 11906, PAGE_H = 16838;
const SIDEBAR_W = Math.round(PAGE_W * 0.33);   // 3929
const PX115 = 115 * 9525;                       // 1095375
const PX120 = 120 * 9525;                       // 1143000
const SEAM_OFF = (SIDEBAR_W - 120 * 15 / 2) * 635;          // bridge px=120
const BOTTOM_OFF = (PAGE_H - 120 * 15 - 360) * 635;

const checks = [];
function check(name, ok, detail) { checks.push({ name, ok, detail }); log(`${name}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (detail || '')}`); }

{
  const xml = await gen({ photoPosition: 'main-left', photoSizePx: 120 });
  const anchored = /<wp:anchor/.test(xml);
  const wrap = /<wp:wrapSquare wrapText="bothSides"/.test(xml);
  const alignL = /<wp:positionH relativeFrom="column"><wp:align>left<\/wp:align>/.test(xml);
  const sized = xml.includes(`cx="${PX115}" cy="${PX115}"`);
  check('main-left floating crescent', anchored && wrap && alignL && sized,
    JSON.stringify({ anchored, wrap, alignL, sized }));
}
{
  const xml = await gen({ photoPosition: 'main-right', photoSizePx: 120 });
  const alignR = /<wp:positionH relativeFrom="column"><wp:align>right<\/wp:align>/.test(xml);
  check('main-right floats right', /<wp:anchor/.test(xml) && alignR, '');
}
{
  const xml = await gen({ photoPosition: 'main-left-bottom', photoSizePx: 120 });
  const inline = /<wp:inline/.test(xml) && !/<wp:anchor/.test(xml);
  const sized = xml.includes(`cx="${PX115}" cy="${PX115}"`);
  // the photo paragraph comes AFTER the profile text in the main cell
  const order = xml.indexOf('Profile text') < xml.indexOf('<wp:inline');
  check('main-left-bottom inline after sections', inline && sized && order,
    JSON.stringify({ inline, sized, order }));
}
{
  const xml = await gen({ photoPosition: 'main-right-bottom', photoSizePx: 120 });
  const inline = /<wp:inline/.test(xml) && !/<wp:anchor/.test(xml);
  const right = /<w:jc w:val="right"\/>(?:(?!<\/w:p>).)*?<wp:inline/s.test(xml);
  check('main-right-bottom pinned right', inline && right, JSON.stringify({ inline, right }));
}
{
  const xml = await gen({ photoPosition: 'bridge-middle', photoSizePx: 120 });
  const anchored = /<wp:anchor/.test(xml);
  const wrap = /<wp:wrapSquare wrapText="bothSides"/.test(xml);
  const seam = xml.includes(`<wp:positionH relativeFrom="page"><wp:posOffset>${SEAM_OFF}</wp:posOffset>`);
  const vCentre = /<wp:positionV relativeFrom="page"><wp:align>center<\/wp:align>/.test(xml);
  const sized = xml.includes(`cx="${PX120}" cy="${PX120}"`);
  check('bridge-middle seam anchor + centre', anchored && wrap && seam && vCentre && sized,
    JSON.stringify({ anchored, wrap, seam, vCentre, sized }));
}
{
  const xml = await gen({ photoPosition: 'bridge-bottom', photoSizePx: 120 });
  const seam = xml.includes(`<wp:positionH relativeFrom="page"><wp:posOffset>${SEAM_OFF}</wp:posOffset>`);
  const vBottom = xml.includes(`<wp:positionV relativeFrom="page"><wp:posOffset>${BOTTOM_OFF}</wp:posOffset>`);
  check('bridge-bottom seam anchor + bottom gap', /<wp:anchor/.test(xml) && seam && vBottom,
    JSON.stringify({ seam, vBottom }));
}
{
  const xml = await gen({ photoPosition: 'none' });
  const noImage = !/<a:blip/.test(xml) && !/<wp:inline/.test(xml) && !/<wp:anchor/.test(xml);
  check('none (Hidden) exports NO photo', noImage, '');
}
{
  // PHOTO-BRIDGE-NONFLOAT-001 REVERTED (1.14.71): band-overlap is back to a
  // FLOATING straddle medallion (floats render in the owner's CloudConvert PDF;
  // the earlier "no bridge" was the forwarding bug, fixed PWA-side in 1.50.492).
  // Float anchor, 156px, NOT inline in the (empty) band row.
  const xml = await gen({ photoPosition: 'band-overlap', photoSizePx: 156 });
  const sized = xml.includes('cx="1485900" cy="1485900"');
  const floated = /<wp:anchor/.test(xml);
  const firstRow = xml.slice(xml.indexOf('<w:tr'), xml.indexOf('</w:tr>'));
  const bandRowEmpty = !/<wp:inline/.test(firstRow) && !/<wp:anchor/.test(firstRow);
  check('band-overlap float straddle (156px, band row empty)', sized && floated && bandRowEmpty,
    JSON.stringify({ sized, floated, bandRowEmpty }));
}
{
  // slider parity: sidebar-top follows the forwarded diameter now
  const xml = await gen({ photoPosition: 'sidebar-top', photoSizePx: 160 });
  const sized = xml.includes(`cx="${160 * 9525}" cy="${160 * 9525}"`);
  check('sidebar-top follows photoSizePx', /<wp:inline/.test(xml) && sized, '');
}

const ok = checks.every((c) => c.ok);
log(ok ? 'PHOTO-POSITIONS-EXPORT OK' : 'PHOTO-POSITIONS-EXPORT FAIL');
process.exit(ok ? 0 : 1);
