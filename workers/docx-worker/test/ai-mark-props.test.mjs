// AI-ACT-MARK-001: every DOCX (two-column CV, linear CV, cover letter) carries machine-readable
// AI marking in docProps/custom.xml (EU AI Act Art. 50(2)) and "AI-assisted" in docProps/core.xml.
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

async function gen(doc, layout) {
  const payload = {
    schema_version: '1.0', doc, language: 'en', layout, filename: 't',
    personal_info: { name: 'Ada Example', email: 'a@example.com' },
    meta: { role: 'Project Manager', subtitle: 'X', company: 'X' }, style: {}, font_sizes: {},
    sections: doc === 'cl'
      ? [{ id: 'greeting', title: 'Greeting', on: true, type: 'text', content: 'Dear X,' }, { id: 'opening', title: 'Opening', on: true, type: 'text', content: 'Body.' }]
      : [{ id: 'profile', title: 'PROFILE', type: 'text', loc: 'main', content: 'Project manager.' }],
  };
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
    {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 300));
  return buf;
}

for (const [doc, layout] of [['cv', 'two_column'], ['cv', 'linear'], ['cl', 'linear']]) {
  test(`AI-ACT-MARK-001: ${doc} ${layout} carries machine-readable AI marking`, async () => {
    const buf = await gen(doc, layout);
    const custom = unzipEntry(buf, 'docProps/custom.xml');
    assert.ok(custom, 'docProps/custom.xml present');
    const x = custom.toString('utf8');
    assert.match(x, /name="AIGenerated"[^>]*>\s*<vt:lpwstr>true<\/vt:lpwstr>/);
    assert.match(x, /name="AIDisclosure"[^>]*>\s*<vt:lpwstr>[^<]*Art\. 50\(2\)/);
    assert.match(unzipEntry(buf, 'docProps/core.xml').toString('utf8'), /AI-assisted/);
  });
}
