// ACADEMY-BALANCE-001 (2026-11-08): the PWA academy export spreads free page-1 height over the
// section and role gaps. renderExperience reads style.roleGap (px -> DXA x15), but mergeStyle dropped
// the key, so a payload could never set it. Drives /generate in node like margin-layout.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10);
  let p = cd;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const nm = buf.slice(p + 46, p + 46 + nl).toString();
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

const sections = [
  { id: 'profile', title: 'PROFILE', type: 'text', loc: 'main', content: 'Hardware product lead with 15+ years taking camera and sensor products to shipped units.' },
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', type: 'experience', loc: 'main', roles: [
    { title: 'Project Manager', company: 'Example A/S', years: '2026 -', bullets: ['Own the supplier template.'], results: 'A pilot project with measured coverage.' },
    { title: 'Systems Engineer', company: 'Example Two', years: '2020 - 2025', bullets: ['Chair the change board.'] },
  ] },
  { id: 'languages', title: 'LANGUAGES', type: 'labeled_list', loc: 'sidebar', items: [{ l: 'English', v: 'native' }] },
];
async function docXml(style) {
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'margin', filename: 'gap', package: 'copenhagen-modern',
    personal_info: { name: 'Test Person', email: 't@example.com' }, style, sections,
  };
  const res = await mod.default.fetch(new Request('https://t.local/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(res.status, 200);
  return unzipEntry(Buffer.from(await res.arrayBuffer()), 'word/document.xml').toString('utf8');
}
// the role line paragraph carries the right tab + bottom rule; its spacing before is the role gap
const roleBefore = (xml) => [...xml.matchAll(/<w:spacing w:after="40" w:before="(\d+)"\/><\/w:pPr>(?:(?!<\/w:p>).)*?\| Example/g)].map((m) => Number(m[1]));

test('style.roleGap from the payload reaches the role line spacing (px x15 DXA)', async () => {
  const def = roleBefore(await docXml({}));
  assert.ok(def.length >= 2 && def.every((v) => v === 120), 'default 120 DXA: ' + def);
  const wide = roleBefore(await docXml({ roleGap: 19.2 }));
  assert.ok(wide.length >= 2 && wide.every((v) => v === 288), 'roleGap 19.2 px -> 288 DXA: ' + wide);
});

test('roleGap is clamped like the other px tokens (0..60) and never hex-coerced', async () => {
  const bad = roleBefore(await docXml({ roleGap: 500 }));
  assert.ok(bad.every((v) => v === 120), 'out of range falls back to the default: ' + bad);
});
