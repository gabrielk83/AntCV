// CC-HEADERS-PLAIN-001 (REVIEW-VEO-001, 2026-10-18): the docx worker renders the
// competency table header as "The role needs" | "What I bring, with proof". A
// payload that still carries the pre-rename pair ("Focus Area" | "Strategic
// Expertise", or the Danish "Fokusområde" | "Strategisk ekspertise") exports with
// the plain-words header; data rows are untouched. Drives /generate in node like
// linear-cv.test.mjs.
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
const texts = (xml) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('|');

async function gen(header) {
  const sections = [
    { id: 'profile', title: 'PROFILE', type: 'text', loc: 'main', content: 'Hardware product lead with 15+ years from a written case to shipped units.' },
    { id: 'core_comp', title: 'CORE COMPETENCIES', type: 'table', loc: 'main', rows: [header,
      ['Change governance', 'Changes decided fast and kept on budget; cycle cut from ~250 to ~10 days'],
      ['Supplier qualification', 'Three ODM partners qualified to production acceptance criteria']] },
  ];
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', filename: 'cc',
    personal_info: { name: 'Test Candidate', email: 't@example.com', phone: '+45 00 00 00 00', location: 'Copenhagen, Denmark' },
    meta: { role: 'Product Manager', subtitle: 'Hardware' }, style: {}, font_sizes: {}, sections,
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 300));
  return texts(unzipEntry(buf, 'word/document.xml').toString('utf8'));
}

test('new header pair exports verbatim', async () => {
  const t = await gen(['The role needs', 'What I bring, with proof']);
  assert.ok(t.includes('The role needs') && t.includes('What I bring, with proof'), t.slice(0, 400));
  assert.ok(t.includes('Change governance') && t.includes('Supplier qualification'), 'data rows present');
});

test('legacy EN header pair exports as the plain-words pair', async () => {
  const t = await gen(['Focus Area', 'Strategic Expertise']);
  assert.ok(t.includes('The role needs') && t.includes('What I bring, with proof'), t.slice(0, 400));
  assert.ok(!t.includes('Focus Area') && !t.includes('Strategic Expertise'), 'legacy words gone');
  assert.ok(t.includes('cycle cut from ~250 to ~10 days'), 'data rows untouched');
});

test('legacy DA header pair exports as the plain-words Danish pair', async () => {
  const t = await gen(['Fokusområde', 'Strategisk ekspertise']);
  assert.ok(t.includes('Rollen kræver') && t.includes('Det bringer jeg, med belæg'), t.slice(0, 400));
});

test('a user-authored header is never rewritten', async () => {
  const t = await gen(['Area', 'What I did']);
  assert.ok(t.includes('Area') && t.includes('What I did'), t.slice(0, 400));
  assert.ok(!t.includes('The role needs'));
});
