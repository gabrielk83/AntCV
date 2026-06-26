// hyperlink-export.test.mjs
// ============================================================
// RICH-BLOCK-HYPERLINK-001 (owner 2026-06-26): markdown links [text](url) in any inline text must
// export as REAL docx ExternalHyperlinks — clickable in the downloaded CV/CL. Restricted to
// http(s)/mailto so bracketed placeholders ("[Role title]") are never turned into links. Drives the
// real worker and asserts the docx carries a <w:hyperlink> + a relationship to the URL, the anchor
// text is present, and a non-URL "[x](y)" stays literal text.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

function entries(buf) {
  // minimal central-directory walk → { name: Buffer } for every file
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const n = buf.readUInt16LE(i + 10); let p = buf.readUInt32LE(i + 16);
  const out = {};
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    const lN = buf.readUInt16LE(lho + 26), lE = buf.readUInt16LE(lho + 28), ds = lho + 30 + lN + lE;
    const comp = buf.slice(ds, ds + cs);
    out[name] = buf.readUInt16LE(p + 10) === 0 ? comp : inflateRawSync(comp);
    p += 46 + nl + el + cl;
  }
  return out;
}

test('markdown [text](url) exports as a real docx hyperlink; non-URL brackets stay literal', async () => {
  const mod = await import('../src/index.js');
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'G', email: 'g@b.c' }, meta: { role: 'R', subtitle: 'S' },
    style: { navy: '#283556', accent: '#01B7BB' },
    sections: [
      { id: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [{ id: 'r1', title: 'Role', company: 'C', years: '2020', bullets: ['x'] }] },
      {
        id: 'links', title: 'LINKS', loc: 'main', on: true, type: 'rich_block',
        items: [
          { b: '', t: 'Portfolio at [AntCV](https://antcv.pages.dev) and email [me](mailto:g@b.c).' },
          { b: '', t: 'Placeholder [Role title] and a non-link [see](above) stay literal.' },
        ],
      },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  assert.equal(res.status, 200, 'worker 200');
  const files = entries(Buffer.from(ab));
  const docXml = files['word/document.xml'].toString('utf8');
  const rels = (files['word/_rels/document.xml.rels'] || Buffer.from('')).toString('utf8');

  // a real hyperlink element + relationships to BOTH urls
  assert.ok(/<w:hyperlink\b/.test(docXml), 'document.xml carries a <w:hyperlink>');
  assert.ok(rels.includes('https://antcv.pages.dev'), 'rels target the https url');
  assert.ok(rels.includes('mailto:g@b.c'), 'rels target the mailto url');

  // anchor text present; the raw markdown is NOT left in the text
  const text = (docXml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map((s) => s.replace(/<[^>]+>/g, '')).join(' ').replace(/&amp;/g, '&');
  assert.ok(text.includes('AntCV'), 'anchor text "AntCV" present');
  assert.ok(!text.includes('](https://antcv'), 'raw link markdown is not left in the text');

  // bracketed placeholder + non-URL parens stay literal (no false hyperlink)
  assert.ok(text.includes('[Role title]'), 'a bracketed placeholder stays literal');
  assert.ok(text.includes('[see](above)') || text.includes('see](above'), 'a non-URL [x](y) stays literal');
});
