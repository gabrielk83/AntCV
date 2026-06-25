// group-header-manual-break.test.mjs
// ============================================================
// GROUP-HEADER-MANUAL-BREAK-001 (owner 2026-06-25): a page-break on a rich_block GROUP must move the
// group HEADING with its rows — the break paragraph must sit immediately BEFORE the group header, not
// after it (which would orphan the header on the previous page). The PWA client (antcv-docx-client.js)
// now MOVES a manual break from a group's first content row UP to the group header index before it
// builds row_pages; this test drives the REAL worker with that post-snap shape (row_pages on the
// header index) and asserts the rendered docx breaks before the header, keeping the header with its
// group. Uses loc:'main' so no cantSplit wrapper masks the break — the break-emission logic in
// renderRichBlock is loc-agnostic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

function unzip(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const n = buf.readUInt16LE(i + 10); let p = buf.readUInt32LE(i + 16);
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const en = buf.toString('utf8', p + 46, p + 46 + nl);
    if (en === name) { const lN = buf.readUInt16LE(lho + 26), lE = buf.readUInt16LE(lho + 28), ds = lho + 30 + lN + lE; const c = buf.slice(ds, ds + cs); return buf.readUInt16LE(p + 10) === 0 ? c : inflateRawSync(c); }
    p += 46 + nl + el + cl;
  }
  throw new Error('no ' + name);
}

const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'G', email: 'g@b.c' }, meta: { role: 'R', subtitle: 'S' },
  style: { navy: '#283556', accent: '#01B7BB' },
  sections: [
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [{ id: 'r1', title: 'Role One', company: 'C', years: '2020', bullets: ['a', 'b'] }] },
    {
      id: 'regulatory', title: 'REGULATORY CONTEXT', loc: 'main', on: true, type: 'rich_block',
      items: [
        { grp: true, t: 'Imaging' },                                   // 0 header
        { b: 'EN 62471', t: 'photobiological safety' },                // 1
        { b: 'IEC 60825', t: 'laser safety' },                         // 2
        { grp: true, t: 'Environmental' },                             // 3 header (manual break MOVED here)
        { b: 'RoHS', t: 'restricted substances' },                    // 4 first content row
        { b: 'REACH', t: 'chemical compliance' },                     // 5
      ],
      row_pages: { '3': 2 },   // post-snap: the break sits on the GROUP HEADER, not its first row
    },
  ],
};

test('a group-header-indexed page break renders BEFORE the header (header not orphaned)', async () => {
  const mod = await import('../src/index.js');
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  assert.equal(res.status, 200, 'worker returned 200');
  const xml = unzip(Buffer.from(ab), 'word/document.xml').toString('utf8');

  // Parse paragraphs into { text, brk } (brk = carries <w:pageBreakBefore/>).
  const paras = [...xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((m) => {
    const seg = m[0];
    const text = (seg.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map((s) => s.replace(/<[^>]+>/g, '')).join('').replace(/&amp;/g, '&');
    return { text, brk: /<w:pageBreakBefore\b/.test(seg) };
  });
  const idx = (needle) => paras.findIndex((p) => p.text.includes(needle));

  // All group content survives.
  for (const t of ['Imaging', 'photobiological safety', 'laser safety', 'Environmental', 'restricted substances', 'chemical compliance']) {
    assert.ok(idx(t) >= 0, 'present: ' + t);
  }

  const envI = idx('Environmental');
  // The break paragraph is IMMEDIATELY before the Environmental header (the header travelled WITH it).
  assert.equal(paras[envI - 1].brk, true, 'page break sits immediately before the Environmental header');
  // The header is NOT separated from its own rows by the break (no orphan: rows follow on the same page).
  assert.ok(paras[envI + 1].text.includes('RoHS'), 'the group rows follow the header after the break');
  // The previous group (Imaging) stayed on the earlier page — before the break.
  assert.ok(idx('Imaging') < envI - 1, 'the Imaging group precedes the break');
  assert.ok(idx('laser safety') < envI - 1, 'Imaging rows precede the break');
  // The Environmental header itself does NOT carry a stray break (the break is its predecessor paragraph).
  assert.equal(paras[envI].brk, false, 'the header paragraph itself is not the break paragraph');
});
