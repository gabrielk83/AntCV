/* TEST — SLOGAN-CASE-001 worker export (owner 2026-11-03, CL-ACADEMY-001). The cover-letter
 * headline (meta.slogan / meta.cl_slogan / meta.subtitle fallback) was always uppercased. The
 * academy letter wants a SENTENCE-CASE headline ("Smart locks that households trust and buy"),
 * so the client now forwards meta.slogan_case: "sentence" (default) or "caps" (the opt-back).
 * An older client sends no field and keeps the legacy capitals byte-for-byte.
 * Run: node --test test/slogan-case.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdOffset = buf.readUInt32LE(i + 16); const nEntries = buf.readUInt16LE(i + 10); let p = cdOffset;
  for (let e = 0; e < nEntries; e++) {
    const compSize = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28),
      extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const en = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (en === name) {
      const lN = buf.readUInt16LE(lho + 26), lE = buf.readUInt16LE(lho + 28), ds = lho + 30 + lN + lE;
      const comp = buf.slice(ds, ds + compSize);
      return (buf.readUInt16LE(p + 10) === 0) ? comp : inflateRawSync(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('entry not found ' + name);
}

const mod = await import('../src/index.js');

async function gen(payload) {
  const res = await mod.default.fetch(
    new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
    {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(res.status, 200);
  return Buffer.from(await res.arrayBuffer());
}

// The slogan paragraph is the last text before the greeting (no role/company -> no app line).
async function sloganText(meta) {
  const buf = await gen({
    schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
    personal_info: { name: 'Anita Myre', email: 'a@b.c' },
    meta: { subtitle: 'Processes | Products | People', ...meta },
    style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
    sections: [{ id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Manager,' }],
  });
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const body = xml.slice(xml.indexOf('<w:body'));
  const runs = [...body.slice(0, body.indexOf('Dear Hiring')).matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
  assert.ok(runs.length, 'text before the greeting');
  return runs[runs.length - 1];
}

const ACADEMY = 'Smart locks that households trust and buy';

test('slogan_case "sentence" prints the academy headline as written', async () => {
  assert.equal(await sloganText({ slogan: ACADEMY, slogan_case: 'sentence' }), ACADEMY);
});

test('no slogan_case (older client) keeps the legacy capitals', async () => {
  assert.equal(await sloganText({ slogan: ACADEMY }), ACADEMY.toUpperCase());
});

test('slogan_case "caps" is the opt-back to capitals', async () => {
  assert.equal(await sloganText({ slogan: ACADEMY, slogan_case: 'caps' }), ACADEMY.toUpperCase());
  assert.equal(await sloganText({ slogan: ACADEMY, slogan_case: 'CAPS' }), ACADEMY.toUpperCase());
  assert.equal(await sloganText({ slogan: ACADEMY, slogan_case: 'bogus' }), ACADEMY.toUpperCase(), 'unknown value -> capitals');
});

test('sentence case keeps acronyms and names, capitalises only the first letter', async () => {
  assert.equal(await sloganText({ slogan: 'IR detectors built for Hamamatsu Photonics', slogan_case: 'sentence' }),
    'IR detectors built for Hamamatsu Photonics');
  assert.equal(await sloganText({ slogan: 'make the case before the spec', slogan_case: 'sentence' }),
    'Make the case before the spec');
});

test('a legacy ALL-CAPS slogan turns into sentence case', async () => {
  assert.equal(await sloganText({ slogan: 'PHOTONICS THAT SHIPS ON TIME', slogan_case: 'sentence' }),
    'Photonics that ships on time');
});

test('the generated meta.cl_slogan and the subtitle fallback follow the same switch', async () => {
  assert.equal(await sloganText({ cl_slogan: ACADEMY, slogan_case: 'sentence' }), ACADEMY);
  assert.equal(await sloganText({ slogan_case: 'sentence' }), 'Processes • Products • People');
  assert.equal(await sloganText({ slogan_case: 'sentence', subtitle: 'PROCESSES | PRODUCTS | PEOPLE' }),
    'Processes • Products • People', 'each " • " segment starts with a capital');
  assert.equal(await sloganText({}), 'PROCESSES • PRODUCTS • PEOPLE');
});
