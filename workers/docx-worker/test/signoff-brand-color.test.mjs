/* TEST — SIGNOFF-BRAND-COLOR-001 worker export. The CL sign-off ("At your service,")
 * used a HARDCODED Copenhagen teal 00746E + cyan 01B9BD underline, so a brand-fitted
 * letter (Terma blue + yellow) still printed an off-brand sign-off. Optional style
 * tokens `signoffColor` / `signoffUnderlineColor` now win; absent or malformed tokens
 * keep the Copenhagen constants byte-for-byte (backward compatibility).
 * Run: node --test test/signoff-brand-color.test.mjs */
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

// Return the <w:r> run carrying the sign-off word, so colour + underline can be read together.
async function signoffRun(style, pkg = 'copenhagen-modern') {
  const buf = await gen({
    schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
    personal_info: { name: 'Anita Myre', email: 'a@b.c' },
    meta: { subtitle: 'Application', cl_closing: 'At your service,', cl_sign_name: 'Anita' },
    ...(pkg ? { package: pkg } : {}),
    style, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'greeting', title: '', loc: 'main', on: true, type: 'text', content: 'Dear Team,' },
      { id: 'closure', title: 'Closure', loc: 'main', on: true, type: 'text', content: 'Looking forward to it.' },
    ],
  });
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const m = xml.match(/<w:r>(?:(?!<w:r>).)*?At your service,/s);
  assert.ok(m, 'sign-off run not found in document.xml');
  return m[0];
}

test('Copenhagen with no brand tokens keeps the teal/cyan constants', async () => {
  const run = await signoffRun({ navy: '#283556' });
  assert.match(run, /<w:color w:val="00746E"\s*\/>/);
  assert.match(run, /<w:u [^>]*w:color="01B9BD"/);
});

test('explicit brand tokens override both the colour and the underline', async () => {
  const run = await signoffRun({ navy: '#283556', signoffColor: '#0D64AA', signoffUnderlineColor: '#FFC92B' });
  assert.match(run, /<w:color w:val="0D64AA"\s*\/>/);
  assert.match(run, /<w:u [^>]*w:color="FFC92B"/);
  assert.doesNotMatch(run, /00746E|01B9BD/);
});

test('each token is independent', async () => {
  const onlyColor = await signoffRun({ navy: '#283556', signoffColor: '#0D64AA' });
  assert.match(onlyColor, /<w:color w:val="0D64AA"\s*\/>/);
  assert.match(onlyColor, /<w:u [^>]*w:color="01B9BD"/, 'underline keeps its constant');

  const onlyUnderline = await signoffRun({ navy: '#283556', signoffUnderlineColor: '#FFC92B' });
  assert.match(onlyUnderline, /<w:color w:val="00746E"\s*\/>/, 'colour keeps its constant');
  assert.match(onlyUnderline, /<w:u [^>]*w:color="FFC92B"/);
});

test('malformed tokens are ignored, not emitted as invalid hex', async () => {
  const run = await signoffRun({ navy: '#283556', signoffColor: 'rebeccapurple', signoffUnderlineColor: '#12' });
  assert.match(run, /<w:color w:val="00746E"\s*\/>/);
  assert.match(run, /<w:u [^>]*w:color="01B9BD"/);
});

test('a non-Copenhagen letter gains an underline only when the token asks for one', async () => {
  const bare = await signoffRun({ navy: '#283556', mainTextColor: '#333333' }, null);
  assert.doesNotMatch(bare, /<w:u /, 'legacy sign-off stays underline-free');

  const branded = await signoffRun({ navy: '#283556', signoffUnderlineColor: '#FFC92B' }, null);
  assert.match(branded, /<w:u [^>]*w:color="FFC92B"/);
});
