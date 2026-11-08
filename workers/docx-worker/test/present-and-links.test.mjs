// Owner 2026-11-08, #3527 export review:
// - DATE-PRESENT-SAME-YEAR-001: "Nov 2026 - present" exported as "Nov 2026 - 2026" (DATE-NO-PRESENT-001
//   turns an open end into the current year). A role that started this year keeps "present"; older open
//   roles still end on the current year.
// - LINKEDIN-LINK-001 / AI-REPO-LINK-001: "keep the document color sceme, not a hyperlink blue" - an
//   inline Markdown link keeps its paragraph colour (underline only), never the fixed #0B4F8A.
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
const Y = String(new Date().getFullYear());

async function docXml(sections) {
  const payload = { schema_version: '1.0', doc: 'cv', language: 'en', layout: 'margin', filename: 'pl', package: 'copenhagen-modern',
    personal_info: { name: 'Test Person', email: 't@example.com' }, sections };
  const res = await mod.default.fetch(new Request('https://t.local/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(res.status, 200);
  return unzipEntry(Buffer.from(await res.arrayBuffer()), 'word/document.xml').toString('utf8');
}
const text = (xml) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');

test('a role that started this year keeps "present"; an older open role ends on this year', async () => {
  const xml = await docXml([{ id: 'experience', title: 'EXPERIENCE', type: 'experience', loc: 'main', roles: [
    { title: 'Intern', company: 'New Co', years: 'Nov ' + Y + ' - present', bullets: ['Organise the review baseline.'] },
    { title: 'Expert', company: 'Old Co', years: '2022 - present', bullets: ['Score suppliers.'] }] }]);
  const t = text(xml);
  assert.ok(t.includes('Nov ' + Y + ' - present'), 'new role: ' + t.slice(0, 200));
  assert.ok(!t.includes('Nov ' + Y + ' - ' + Y));
  assert.ok(t.includes('2022 - ' + Y), 'older open role ends on the current year');
});

test('an inline Markdown link keeps the paragraph colour, underline only', async () => {
  const xml = await docXml([{ id: 'projects', title: 'PROJECTS', type: 'rich_block', loc: 'main',
    items: [{ b: 'AntCV', t: 'Built and shipped [AntCV](https://github.com/gabrielk83/AntCV), an LLM-based product.' }] }]);
  const link = xml.match(/<w:hyperlink[^>]*>([\s\S]*?)<\/w:hyperlink>/);
  assert.ok(link, 'a real hyperlink');
  assert.ok(!/0B4F8A/i.test(link[1]), 'no fixed link blue');
  assert.match(link[1], /<w:u w:val="single"\/>/);
});
