// WORD-KEEPNEXT-ROW-001 (owner 2026-10-01 "reasonable both in libre and word"): in a two-column CV each page
// is one body row and each section a nested table. A nested heading's keepNext made Word move the whole page-1
// row to page 2 (empty page 1, 4 pages instead of 3, measured on #3501). Inside two-column page cells no
// nested-table paragraph may carry keepNext; the page row itself stays splittable.
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

test('two-column CV: no keepNext inside nested section tables of the page cells', async () => {
  const sections = [
    { id: 'profile', title: 'PROFILE', type: 'rich_block', loc: 'main', items: [{ b: '', t: 'Profile text.' }] },
    { id: 'experience', title: 'EXPERIENCE', type: 'experience', loc: 'main',
      roles: [{ id: 'r1', title: 'PM', company: 'Co', years: '2020 - 2025', bullets: ['One', 'Two'], results: 'Done' }] },
    { id: 'tools', title: 'TOOLS', type: 'rich_block', loc: 'sidebar', items: [{ grp: true, t: 'Group' }, { b: 'Lead', t: 'Body' }] },
    { id: 'regulatory', title: 'REGULATORY CONTEXT', type: 'rich_block', loc: 'sidebar', items: [{ b: 'ISO', t: 'Std' }] },
  ];
  const payload = { schema_version: '1.0', doc: 'cv', language: 'en', filename: 'k', layout: 'two_column', personal_info: { name: 'Test Person', email: 't@e.st' }, meta: { role: 'X' }, style: {}, font_sizes: {}, sections };
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 200));
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  // the page body row (atLeast body height) holds the section tables
  const body = xml.slice(xml.indexOf('w:hRule="atLeast"', xml.indexOf('<w:cantSplit w:val="false"/>')));
  for (const head of ['REGULATORY CONTEXT', 'TOOLS', 'PROFILE']) {
    const i = body.indexOf('>' + head + '<');
    assert.ok(i > 0, head + ' rendered');
    const p = body.slice(body.lastIndexOf('<w:p>', i) >= body.lastIndexOf('<w:p ', i) ? body.lastIndexOf('<w:p>', i) : body.lastIndexOf('<w:p ', i), i);
    assert.ok(!/<w:keepNext/.test(p), head + ' heading must not keepNext inside a page cell');
  }
  assert.ok(xml.includes('<w:cantSplit w:val="false"/>'), 'page body row still splittable');
});
