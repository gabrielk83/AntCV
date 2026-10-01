// MAIN-LIST-PAGE-SEGMENTS-001 (owner 2026-10-01 "reasonable both in libre and word"): a two-column CV MAIN list whose
// items span pages 2 and 3 (PUBLICATIONS) is split into page segments - the "(CONT.)" part lands in the page-3
// table, never behind an in-cell pageBreakBefore inside the page-2 table (that pushed the page-3 table a page later
// in Word and LibreOffice: 4 pages instead of 3 on #3501). The list footer line closes the last part only.
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
// top-level <w:tbl> blocks of the body, in order
function topTables(xml) {
  const body = xml.slice(xml.indexOf('<w:body>') + 8);
  const out = []; const re = /<(\/?)w:tbl[ >]/g; let m, depth = 0, start = 0;
  while ((m = re.exec(body))) { if (!m[1]) { if (depth === 0) start = m.index; depth++; } else { depth--; if (depth === 0) out.push(body.slice(start, body.indexOf('>', m.index) + 1)); } }
  return out;
}

test('two-column CV: a main list spanning pages 2-3 splits into page tables; footer line once', async () => {
  const sections = [
    { id: 'profile', title: 'PROFILE', type: 'rich_block', loc: 'main', items: [{ b: '', t: 'Profile text.' }] },
    { id: 'experience', title: 'EXPERIENCE', type: 'experience', loc: 'main',
      roles: [{ id: 'r1', title: 'PM', company: 'Co', years: '2020 - 2025', bullets: ['One'] },
        { id: 'r2', title: 'Eng', company: 'Co2', years: '2015 - 2020', bullets: ['Two'], page: 2 }] },
    { id: 'pubs', title: 'PUBLICATIONS & PATENTS', type: 'list_italic', loc: 'main',
      items: [{ text: 'Paper Alpha 2009', _page: 2 }, { text: 'Paper Beta 2010', _page: 3 }, 'Paper Gamma 2011'],
      masterSite: { on: true, label: 'Full record', url: 'https://example.org/scholar' } },
    { id: 'tools', title: 'TOOLS', type: 'rich_block', loc: 'sidebar', items: [{ b: 'Lead', t: 'Body' }] },
  ];
  const payload = { schema_version: '1.0', doc: 'cv', language: 'en', filename: 'm', layout: 'two_column', personal_info: { name: 'Test Person', email: 't@e.st' }, meta: { role: 'X' }, style: {}, font_sizes: {}, sections };
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 200));
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const tbls = topTables(xml);
  const at = (txt) => tbls.findIndex((t) => t.includes(txt));
  assert.ok(at('Paper Alpha 2009') >= 0 && at('Paper Beta 2010') > at('Paper Alpha 2009'), 'page-3 part in a LATER page table');
  assert.equal(at('Paper Beta 2010'), at('Paper Gamma 2011'));
  assert.ok(!/pageBreakBefore/.test(tbls[at('Paper Alpha 2009')]), 'no in-cell page break inside the page-2 table');
  assert.equal(xml.split('(CONT.)').length - 1, 2, 'one CONT heading for experience page 2 and one for the publications part');
  assert.equal(xml.split('Full record').length - 1, 1, 'footer line on the last part only');
  assert.ok(at('Full record') === at('Paper Gamma 2011'));
});
