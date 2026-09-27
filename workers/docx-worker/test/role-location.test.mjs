// ROLE-LOCATION-001 (EXEC-LINEAR step 2): worker export of role.location + style.roleLineFormat.
// Drives /generate in node (same harness as diag-cjlr-group-role-export.mjs) and reads document.xml.
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10);
  let p = cd;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), nm = buf.toString('utf8', p + 46, p + 46 + nl);
    if (nm === name) {
      const ln = buf.readUInt16LE(lho + 26), lx = buf.readUInt16LE(lho + 28);
      const d = buf.slice(lho + 30 + ln + lx, lho + 30 + ln + lx + cs);
      return buf.readUInt16LE(p + 10) === 0 ? d : inflateRawSync(d);
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error('entry not found: ' + name);
}

const mod = await import('../src/index.js');
async function gen(extra) {
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
    ...extra,
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 200));
  return unzipEntry(buf, 'word/document.xml').toString('utf8');
}
function paraSlice(xml, text) {
  const i = xml.indexOf(text);
  if (i < 0) return '';
  let ps = xml.lastIndexOf('<w:p>', i);
  const psAttr = xml.lastIndexOf('<w:p ', i);
  if (psAttr > ps) ps = psAttr;
  return xml.slice(ps, xml.indexOf('</w:p>', i) + 6);
}
const texts = (p) => [...p.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
const TAB = String.fromCharCode(9);

const roles = [
  { title: 'ROLEA', company: 'CoA', years: '2017 - 2020', bullets: ['a'] },
  { title: 'ROLEB', company: 'CoB', years: '2026 -', location: 'Hørsholm, Denmark', bullets: ['b'] },
];
const sections = [{ id: 'exp', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles }];

test('classic: no location -> unchanged "title | company<TAB>years"; location -> "years | location"', async () => {
  const xml = await gen({ sections });
  assert.deepEqual(texts(paraSlice(xml, 'ROLEA')), ['ROLEA', ' | CoA', TAB + '2017 - 2020']);
  assert.deepEqual(texts(paraSlice(xml, 'ROLEB')), ['ROLEB', ' | CoB', TAB + '2026 - | Hørsholm, Denmark']);
});

test('meta: "title — company<TAB>(years | location)", company upright, years bold', async () => {
  const xml = await gen({ sections, style: { roleLineFormat: 'meta' } });
  const pb = paraSlice(xml, 'ROLEB');
  assert.deepEqual(texts(pb), ['ROLEB', ' — CoB', TAB + '(2026 - | Hørsholm, Denmark)']);
  const runs = [...pb.matchAll(/<w:r>[\s\S]*?<\/w:r>/g)].map((m) => m[0]);
  assert.ok(!/<w:i\/>/.test(runs[1]), 'company run is upright in meta');
  assert.ok(/<w:b\/>/.test(runs[2]), 'years run is bold in meta');
  // no location -> "(years)" only
  assert.deepEqual(texts(paraSlice(xml, 'ROLEA')), ['ROLEA', ' — CoA', TAB + '(2017 - 2020)']);
});

test('mergeStyle never hex-coerces roleLineFormat; unknown values are dropped', async () => {
  const xml = await gen({ sections, style: { roleLineFormat: 'bogus' } });
  assert.deepEqual(texts(paraSlice(xml, 'ROLEA')), ['ROLEA', ' | CoA', TAB + '2017 - 2020']);
});
