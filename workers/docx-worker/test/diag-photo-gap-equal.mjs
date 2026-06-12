/* DIAGNOSTIC — PHOTO-GAP-EQUAL-001 (owner 2026-06-13): the air below the
 * sidebar-top medallion (to the first sidebar heading, e.g. TOOLS) equals
 * the air above it.
 *   above = sidebar cell top (240 + bodyEdgePad delta) + photo before (120)
 *   below = photo after + first heading before (40 + sidebarSectionGap delta)
 * Worker-look tokens (8px): above = 240+120 = 360; heading before = 40 ->
 *   photo after must be 320.
 * Comfort tokens (bodyEdgePad 12, sidebarSectionGap 12): above = 300+120 =
 *   420; heading before = 100 -> photo after must be 320 as well (same by
 *   coincidence of the deltas: +60 above, +60 on the heading).
 * sidebar-bottom keeps after=120.
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
async function gen(pos, style) {
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'G K', email: 'g@b.c', phone: '+45', location: 'CPH', photo_b64: PHOTO_B64, photoPosition: pos, photoSizePx: 120 },
    meta: { subtitle: 'S' }, style: Object.assign({ navy: '#283556' }, style || {}), font_sizes: {},
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P. '.repeat(10) },
      { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Eng', v: 'Python' }] },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status);
  return unzipEntry(Buffer.from(ab), 'word/document.xml').toString('utf8');
}

// the photo paragraph is the one whose spacing immediately precedes the image
// drawing; grab the <w:spacing .../> closest before the first <w:drawing>.
function photoSpacing(xml) {
  const di = xml.indexOf('<w:drawing>');
  const head = xml.slice(0, di);
  const m = head.match(/<w:spacing [^>]*\/>(?![\s\S]*<w:spacing [^>]*\/>)/);
  return m ? m[0] : '(none)';
}

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

{
  const xml = await gen('sidebar-top');
  const sp = photoSpacing(xml);
  check('worker-look tokens: sidebar-top photo after=320 (360 above - 40 heading)',
    /w:before="120"/.test(sp) && /w:after="320"/.test(sp), sp);
}
{
  const xml = await gen('sidebar-top', { bodyEdgePad: 12, sidebarSectionGap: 12 });
  const sp = photoSpacing(xml);
  check('comfort tokens: sidebar-top photo after=320 (420 above - 100 heading)',
    /w:after="320"/.test(sp), sp);
}
{
  const xml = await gen('sidebar-top', { bodyEdgePad: 20 });
  const sp = photoSpacing(xml);
  // above = (240+180)+120 = 540; heading 40 -> after = 500
  check('bodyEdgePad 20: after tracks the larger top air (500)',
    /w:after="500"/.test(sp), sp);
}
{
  const xml = await gen('sidebar-bottom');
  const sp = photoSpacing(xml);
  check('sidebar-bottom unchanged (after=120)', /w:after="120"/.test(sp), sp);
}

log(checks.every(Boolean) ? 'PHOTO-GAP-EQUAL OK' : 'PHOTO-GAP-EQUAL FAIL');
process.exit(checks.every(Boolean) ? 0 : 1);
