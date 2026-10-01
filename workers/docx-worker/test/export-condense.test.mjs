// EXPORT-CONDENSE-001 (owner 2026-10-01): the worker applies sec.item_condense[path] (1/20 pt) to every run of that
// paragraph - experience bullet, Results line, rich-block row - and clamps to the -0.4 pt floor (-8).
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cd;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    if (buf.slice(p + 46, p + 46 + nl).toString() === name) { const ln = buf.readUInt16LE(lho + 26), lx = buf.readUInt16LE(lho + 28); const d = buf.slice(lho + 30 + ln + lx, lho + 30 + ln + lx + cs); return buf.readUInt16LE(p + 10) === 0 ? d : inflateRawSync(d); }
    p += 46 + nl + xl + cl;
  }
  return null;
}
const mod = await import('../src/index.js');
async function gen(sections) {
  const payload = { schema_version: '1.0', doc: 'cv', language: 'en', filename: 'c', layout: 'two_column', personal_info: { name: 'Test Person', email: 't@e.st' }, meta: { role: 'X' }, style: {}, font_sizes: {}, sections };
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 200));
  return unzipEntry(buf, 'word/document.xml').toString('utf8');
}
const para = (xml, text) => { const i = xml.indexOf(text); assert.ok(i > 0, 'text present: ' + text); return xml.slice(xml.lastIndexOf('<w:p>', i) >= 0 ? xml.lastIndexOf('<w:p', i) : i, xml.indexOf('</w:p>', i)); };

test('bullet, Results and rich-block row carry their condense; others do not', async () => {
  const xml = await gen([
    { id: 'experience', title: 'EXPERIENCE', type: 'experience', loc: 'main', item_condense: { 'roles.0.bullets.1': -6, 'roles.0.results': -4 },
      roles: [{ id: 'r1', title: 'PM', company: 'Co', years: '2020 - 2025', bullets: ['First bullet stays as is', 'Second bullet gets condensed'], results: 'Result line condensed' }] },
    { id: 'profile', title: 'PROFILE', type: 'rich_block', loc: 'main', item_condense: { 'items.0': -20 }, items: [{ b: '', t: 'Profile row with an over-floor request' }] },
  ]);
  assert.ok(!/<w:spacing w:val="-6"\/>/.test(para(xml, 'First bullet stays as is')), 'untouched bullet');
  assert.match(para(xml, 'Second bullet gets condensed'), /<w:spacing w:val="-6"\/>/);
  assert.match(para(xml, 'Result line condensed'), /<w:spacing w:val="-4"\/>/);
  assert.match(para(xml, 'Profile row with an over-floor request'), /<w:spacing w:val="-8"\/>/, 'clamped to the -0.4 pt floor');
});
