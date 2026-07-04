// float-spine-multi-anchor.test.mjs
// ============================================================
// FLOAT-SPINE-SPACER-001 (register row 3, "attempt without reference" — owner
// explicitly accepted the risk of no visual verification against their
// hand-edited reference docx, which is not available in this environment).
// FLOAT-SPINE-001 (flag-gated, default OFF) turns continuation page-tables
// into floating text-anchored tables. With a document long enough to need
// TWO continuation tables (3 total pages), both floats got the byte-IDENTICAL
// <w:tblpPr vertAnchor="text" tblpY="1"> anchor, each preceded by the same
// near-zero-height (line:1, exact, empty) break paragraph — exactly the
// "LibreOffice may collapse the emptied anchor paragraphs so both floats
// anchor at the same Y" failure the register's own diagnosis named as the
// likely cause of the owner's reported table-overlap. This test locks in the
// fix: each continuation table's own immediate anchor paragraph now gets a
// distinct, non-zero height and non-empty run content, so no two anchors can
// be byte-identical or collapse into the same paragraph.
//
// IMPORTANT: this is a source-level/structural regression lock, not a visual
// proof. It cannot confirm the CloudConvert/LibreOffice PDF no longer
// overlaps — only the owner's own re-export can confirm that (per the
// register's original diagnosis, this is a genuinely renderer-specific
// question this environment cannot verify).

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

function topTables(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const re = /<w:tbl>|<\/w:tbl>|<w:tc>|<\/w:tc>/g;
  let depth = 0, m, start = -1;
  const tables = [];
  while ((m = re.exec(body))) {
    const t = m[0];
    if (t === '<w:tbl>') { if (depth === 0) start = m.index; depth++; }
    else if (t === '</w:tbl>') { depth--; if (depth === 0) tables.push({ start, end: m.index + t.length }); }
    else if (t === '<w:tc>') depth++;
    else if (t === '</w:tc>') depth--;
  }
  return { body, tables };
}

async function genMultiPage() {
  const mod = await import('../src/index.js');
  const coreRows = [['Focus', 'Detail']];
  for (let i = 1; i <= 40; i++) coreRows.push(['Comp ' + i, 'Expertise detail number ' + i + ' with extra text to force wrapping']);
  const regItems = [];
  for (let i = 1; i <= 40; i++) regItems.push('ISO ' + (1000 + i) + ' standard item with long descriptive text ' + i);
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Test User', email: 'a@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
    style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text here. '.repeat(20) },
      { id: 'core', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: coreRows, row_pages: { '15': 2, '30': 3 } },
      { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'list', items: regItems, item_pages: { '15': 2, '30': 3 } },
    ],
    item_pages: { regctx: { '15': 2, '30': 3 } },
    float_spine: true,
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  assert.equal(res.status, 200, 'worker must generate successfully');
  return unzip(Buffer.from(ab), 'word/document.xml').toString('utf8');
}

const xml = await genMultiPage();
const { body, tables } = topTables(xml);

test('a document long enough to need 2 continuation tables actually produces 3 top-level tables', () => {
  assert.equal(tables.length, 3, 'test fixture must reproduce the multi-continuation-float scenario');
});

test('both continuation tables are floated (the FLOAT-SPINE-001 baseline behavior is unaffected)', () => {
  for (let i = 1; i < tables.length; i++) {
    const t = body.slice(tables[i].start, tables[i].end);
    assert.match(t, /<w:tblpPr[^>]*w:vertAnchor="text"[^>]*>/, `table ${i} must still be text-anchored`);
    assert.match(t, /<w:tblOverlap w:val="never"\/>/, `table ${i} must still declare tblOverlap never`);
  }
});

test('FLOAT-SPINE-SPACER-001: the anchor paragraph immediately before each continuation table is NOT byte-identical', () => {
  const anchors = [];
  for (let i = 1; i < tables.length; i++) {
    const before = body.slice(0, tables[i].start);
    const pStart = Math.max(before.lastIndexOf('<w:p>'), before.lastIndexOf('<w:p '));
    anchors.push(before.slice(pStart));
  }
  assert.ok(anchors.length >= 2, 'fixture must produce at least 2 continuation anchors to compare');
  const unique = new Set(anchors);
  assert.equal(unique.size, anchors.length, 'no two continuation-table anchor paragraphs may be byte-identical');
});

test('each continuation-table anchor paragraph has real, non-zero, non-empty content (not the near-invisible 1-twip empty break)', () => {
  for (let i = 1; i < tables.length; i++) {
    const before = body.slice(0, tables[i].start);
    const pStart = Math.max(before.lastIndexOf('<w:p>'), before.lastIndexOf('<w:p '));
    const anchor = before.slice(pStart);
    assert.match(anchor, /<w:pageBreakBefore\/>/, `anchor ${i} must still force a real page break`);
    const lineMatch = anchor.match(/w:line="(\d+)"/);
    assert.ok(lineMatch, `anchor ${i} must declare an explicit line height`);
    assert.ok(Number(lineMatch[1]) > 1, `anchor ${i} line height must be greater than the old collapsible 1-twip value`);
    assert.match(anchor, /<w:r>/, `anchor ${i} must carry a real run (not an empty paragraph)`);
  }
});

test('grid equalization (register row 3, part A): every top-level table shares the identical column-width grid', () => {
  const grids = tables.map(({ start, end }) => {
    const t = body.slice(start, end);
    const gridMatch = t.match(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/);
    return gridMatch ? gridMatch[0] : null;
  });
  assert.ok(grids.every(Boolean), 'every top-level table must declare a tblGrid');
  const unique = new Set(grids);
  assert.equal(unique.size, 1, 'all page tables (page 1 and every continuation) must share one identical grid');
});

test('the flag-OFF control path is completely unaffected (existing diag-float-spine.mjs behavior)', async () => {
  const mod = await import('../src/index.js');
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Test User', email: 'a@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
    style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'core', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: [['Focus', 'Detail'], ['Comp 1', 'Detail 1']] },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  const off = unzip(Buffer.from(ab), 'word/document.xml').toString('utf8');
  assert.ok(!/<w:tblpPr/.test(off), 'no floating tables when float_spine is not set');
  assert.ok(!/<w:type w:val="continuous"\/>/.test(off), 'no continuous sectPr when float_spine is not set');
});
