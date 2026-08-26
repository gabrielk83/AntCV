/* DIAGNOSTIC — PHOTO-ABSENT-GATING-001 (2026-08-26 desktop nightly, register row 18).
 *
 * Register row 18 carries two owner complaints against the Anita demo export:
 * "docx missing photo" and "PDF contact placement/size". The 2026-07-03 triage
 * called them SESSION-STATE-gated and moved on; nothing ever pinned WHICH state.
 *
 * This diag pins it: they are ONE state — no photo — and the worker is innocent.
 * Every band-overlap BRIDGE element is gated on `pi.photo_b64`, so with no photo
 * the contact line falls back to its normal placement and size. The complaint is
 * therefore upstream (the client sent no photo), not a worker regression.
 *
 * diag-photo-bridge-export.mjs already pins the POSITIVE half (photo present ->
 * float + ind 2592/-216 + 8.5pt + tracking -10 + sidebar spacer 990). This is the
 * missing NEGATIVE control:
 *   1. band-overlap + photo      -> media entry present, drawing present, bridge contact ON  (control)
 *   2. band-overlap + NO photo   -> NO media, NO drawing, and NOT ONE bridge contact attribute
 *   3. no photoPosition + NO photo -> same clean baseline (position alone changes nothing)
 *   4. sidebar-top + photo       -> media present, but bridge contact stays OFF (bridge is
 *                                   band-overlap-only, so a photo alone never moves the contact line)
 */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

function centralDir(buf) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  if (i < 0) throw new Error('no EOCD');
  return { off: buf.readUInt32LE(i + 16), n: buf.readUInt16LE(i + 10) };
}
function listEntries(buf) {
  const { off, n } = centralDir(buf);
  let p = off; const out = [];
  for (let e = 0; e < n; e++) {
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    out.push(buf.toString('utf8', p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}
function unzipEntry(buf, name) {
  const { off, n } = centralDir(buf);
  let p = off;
  for (let e = 0; e < n; e++) {
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
    personal_info: {
      name: 'Anita Myre-Kornfeldt', email: 'a@b.c', phone: '+45 31 71 00 72',
      location: 'Copenhagen, Denmark', ...extraPi,
    },
    meta: { subtitle: 'Sub', role: 'R' },
    style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
      { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Eng', v: 'Python' }] },
    ],
  };
  const req = new Request('https://x/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  const buf = Buffer.from(ab);
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + buf.toString().slice(0, 300));
  return { xml: unzipEntry(buf, 'word/document.xml').toString('utf8'), entries: listEntries(buf) };
}

function paraAround(xml, needle) {
  const i = xml.indexOf(needle);
  if (i < 0) return '';
  const start = Math.max(xml.lastIndexOf('<w:p ', i), xml.lastIndexOf('<w:p>', i));
  const end = xml.indexOf('</w:p>', i);
  return start >= 0 && end >= 0 ? xml.slice(start, end) : '';
}

// Every marker the bridge contact line carries when a photo IS present
// (kept in sync with diag-photo-bridge-export.mjs).
function bridgeContactMarkers(xml) {
  const cp = paraAround(xml, '31 71');
  return {
    indent: /w:left="2592"/.test(cp) && /w:right="-216"/.test(cp),
    size85: /<w:sz w:val="17"\/>/.test(cp),
    tracking: /<w:spacing w:val="-10"\/>/.test(cp),
    justified: /w:jc w:val="both"/.test(cp),
    spacer990: xml.includes('w:after="990"'),
  };
}
const anyMarker = (m) => Object.values(m).some(Boolean);
const allMarkers = (m) => Object.values(m).every(Boolean);
const hasMedia = (entries) => entries.some((e) => /^word\/media\/.+\.(png|jpe?g)$/i.test(e));

// 1. control — photo present: the full bridge fires.
const withPhoto = await gen({ photoPosition: 'band-overlap', photo_b64: PHOTO_B64, photoSizePx: 156 });
const c1Media = hasMedia(withPhoto.entries);
const c1Draw = /<wp:anchor|<wp:inline/.test(withPhoto.xml);
const c1Markers = bridgeContactMarkers(withPhoto.xml);
const case1 = c1Media && c1Draw && allMarkers(c1Markers);

// 2. THE ROW-18 STATE — band-overlap requested but no photo supplied.
const noPhoto = await gen({ photoPosition: 'band-overlap', photoSizePx: 156 });
const c2Media = hasMedia(noPhoto.entries);
const c2Draw = /<wp:anchor|<wp:inline/.test(noPhoto.xml);
const c2Markers = bridgeContactMarkers(noPhoto.xml);
const case2 = !c2Media && !c2Draw && !anyMarker(c2Markers);

// 3. baseline — no position, no photo. Must match case 2 exactly.
const bare = await gen({});
const c3Media = hasMedia(bare.entries);
const c3Draw = /<wp:anchor|<wp:inline/.test(bare.xml);
const c3Markers = bridgeContactMarkers(bare.xml);
const case3 = !c3Media && !c3Draw && !anyMarker(c3Markers);

// 4. a photo alone never moves the contact line — the bridge is band-overlap-only.
const sidebarTop = await gen({ photoPosition: 'sidebar-top', photo_b64: PHOTO_B64 });
const c4Media = hasMedia(sidebarTop.entries);
const c4Markers = bridgeContactMarkers(sidebarTop.xml);
const case4 = c4Media && !anyMarker(c4Markers);

log('1 band-overlap + photo    : media', c1Media, '| drawing', c1Draw, '| bridge contact ALL', allMarkers(c1Markers), JSON.stringify(c1Markers));
log('2 band-overlap + NO photo : media', c2Media, '| drawing', c2Draw, '| bridge contact ANY', anyMarker(c2Markers), JSON.stringify(c2Markers));
log('3 no position + NO photo  : media', c3Media, '| drawing', c3Draw, '| bridge contact ANY', anyMarker(c3Markers));
log('4 sidebar-top + photo     : media', c4Media, '| bridge contact ANY', anyMarker(c4Markers));

const ok = case1 && case2 && case3 && case4;
log(ok ? 'PHOTO-ABSENT-GATING OK' : 'PHOTO-ABSENT-GATING FAIL');
process.exit(ok ? 0 : 1);
