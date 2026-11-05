// MARGIN-LAYOUT-001 (1.51.5865, docs/design/MARGIN_LAYOUT_SPEC.md): doc "cv" + layout "margin" -> the two-column
// document with the candidate header as a CARD at the top of the page-1 sidebar cell and NO band rows, no
// AntCVHeadBox roundrect, no seam. Drives /generate in node like linear-cv.test.mjs.
// MARGIN_CV_OUT=<path.docx> also writes the generated file for a visual check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
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
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const sections = [
  { id: 'profile', title: 'PROFILE', type: 'text', loc: 'main', content: 'Hardware product and systems lead with 15+ years taking camera, optical and sensor products from a written case to shipped units.' },
  { id: 'core_comp', title: 'CORE COMPETENCIES', type: 'table', loc: 'main', rows: [['The role needs', 'What I bring, with proof'],
    ['Product Case', 'Problem, user and willingness to pay argued before the spec.'], ['Unit Economics', 'Trade-off and supplier analysis behind a 10x cost cut.']] },
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', type: 'experience', loc: 'main', roles: [
    { title: 'Project Manager, Hardware Development & Supply', company: 'Trackman A/S', years: '2026 -', location: 'Hørsholm, Denmark',
      bullets: ['Own PMA template for supplier-developed and off-the-shelf hardware.'], results: 'PMA template and a pilot project with measured coverage.' },
  ] },
  { id: 'tools', title: 'TOOLS & METHODS', type: 'labeled_list', loc: 'sidebar', items: [{ l: 'Tools', v: 'Jira, Confluence, Codebeamer ALM.' }, { l: 'Methods', v: 'FMEA, DoE, Six Sigma.' }] },
  { id: 'education', title: 'EDUCATION', type: 'education', loc: 'sidebar', items: [{ deg: 'MBA', sch: 'Technion - Strategy, Finance', years: '2011–2013' }] },
  { id: 'languages', title: 'LANGUAGES', type: 'labeled_list', loc: 'sidebar', items: [{ l: 'English', v: 'native' }, { l: 'Danish', v: 'B2' }] },
];
async function gen(extra = {}) {
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'margin', filename: 'margin', package: 'copenhagen-modern',
    personal_info: { name: 'Gabriel Alexander Karp-Gershon', email: 'g@example.com', phone: '+45 00 00 00 00', linkedin: 'https://www.linkedin.com/in/example', location: 'Copenhagen, Denmark', citizenship: 'EU citizen', photo_b64: PNG, photoPosition: 'header-left' },
    meta: { role: 'Senior Technical Project Manager', subtitle: 'Hardware Programmes • Supplier Delivery' }, style: {}, font_sizes: {}, sections, ...extra,
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 300));
  return buf;
}
const texts = (xml) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
// first table -> first TOP-LEVEL row -> its top-level cells (depth-aware: sidebar cells hold nested section tables)
function firstRow(xml) {
  const start = xml.indexOf('<w:tr', xml.indexOf('<w:tbl>'));
  const re = /<w:tr[ >]|<\/w:tr>|<w:tc>|<\/w:tc>/g;
  re.lastIndex = start;
  let depth = 0, cellDepth = 0, cellStart = -1, m;
  const cells = [];
  while ((m = re.exec(xml))) {
    const tag = m[0];
    if (tag.startsWith('<w:tr')) depth++;
    else if (tag === '</w:tr>') { depth--; if (depth === 0) return { row: xml.slice(start, m.index + 7), cells }; }
    else if (tag === '<w:tc>') { cellDepth++; if (depth === 1 && cellDepth === 1) cellStart = m.index; }
    else if (tag === '</w:tc>') { if (depth === 1 && cellDepth === 1) cells.push(xml.slice(cellStart, m.index)); cellDepth--; }
  }
  return { row: xml.slice(start), cells };
}
function firstCell(xml) { const r = firstRow(xml); return { row: r.row, cell: r.cells[0] || '', cells: r.cells }; }

test('margin: no band rows - the first row is the two-column body and its sidebar cell opens with the card', async () => {
  const buf = await gen();
  if (process.env.MARGIN_CV_OUT) fs.writeFileSync(process.env.MARGIN_CV_OUT, buf);
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const { row, cell, cells } = firstCell(xml);
  assert.ok(!/<w:gridSpan w:val="2"\/>/.test(row), 'first row is NOT a full-width band row');
  const t = texts(cell);
  assert.ok(t.startsWith('Gabriel Alexander Karp-Gershon'), 'sidebar cell opens with the name: ' + t.slice(0, 60));
  assert.ok(t.includes('Hardware Programmes'), 'title line in the card');
  assert.ok(t.indexOf('CONTACT') > t.indexOf('Hardware Programmes'), 'CONTACT heading after the title');
  for (const bit of ['Copenhagen, Denmark', 'EU citizen', 'g@example.com', '+45 00 00 00 00', 'linkedin.com/in/example']) assert.ok(t.includes(bit), 'contact item ' + bit);
  assert.ok(t.indexOf('linkedin.com/in/example') < t.indexOf('TOOLS'), 'contact items precede the first sidebar section');
  // one contact item per paragraph
  const paras = cell.split('</w:p>').filter((p) => /g@example\.com|\+45 00 00 00 00|EU citizen/.test(texts(p)));
  assert.equal(paras.length, 3, 'email, phone and citizenship are separate paragraphs');
  assert.ok(/<wp:inline/.test(cell), 'card photo is an INLINE picture in the sidebar cell');
  assert.ok(!/<wp:anchor/.test(row), 'no floating band medallion');
  // page-1 main cell starts with PROFILE
  assert.equal(cells.length, 2, 'two top-level cells: sidebar | main');
  assert.ok(texts(cells[1]).startsWith('PROFILE'), 'main column starts with PROFILE at the page top: ' + texts(cells[1]).slice(0, 40));
  assert.equal(unzipEntry(buf, 'word/headerCph.xml'), null, 'no AntCVHeadBox first-page header part');
  assert.ok(/AntCVSpine/.test(unzipEntry(buf, 'word/header1.xml').toString('utf8')), 'sidebar spine still paints the panel');
});

test('two_column keeps the band: full-width header row first, head box part present', async () => {
  const buf = await gen({ layout: 'two_column' });
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const { row, cell } = firstCell(xml);
  assert.ok(/<w:gridSpan w:val="2"\/>/.test(row), 'band row spans both columns');
  assert.ok(texts(cell).includes('Gabriel Alexander Karp-Gershon'), 'name in the band');
  assert.ok(unzipEntry(buf, 'word/headerCph.xml'), 'AntCVHeadBox part present on copenhagen');
});

test('margin: photo positions - main-left keeps its placement (no card photo); hidden draws none; DA label', async () => {
  const main = unzipEntry(await gen({ personal_info: { name: 'N', email: 'e@x.dk', photo_b64: PNG, photoPosition: 'main-left' } }), 'word/document.xml').toString('utf8');
  const fc = firstCell(main);
  assert.ok(!/<wp:inline/.test(fc.cell), 'no inline card photo for main-left');
  assert.ok(/<wp:anchor|<wp:inline/.test(main), 'the main-left photo is still placed');
  const hid = unzipEntry(await gen({ personal_info: { name: 'N', email: 'e@x.dk', photo_b64: PNG, photoPosition: 'hidden' } }), 'word/document.xml').toString('utf8');
  assert.ok(!/<wp:inline|<wp:anchor/.test(hid), 'hidden: no photo anywhere');
  const da = unzipEntry(await gen({ language: 'da' }), 'word/document.xml').toString('utf8');
  assert.ok(texts(firstCell(da).cell).includes('KONTAKT'), 'Danish contact heading');
});

test('validation: margin is accepted, an unknown layout is still refused', async () => {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ schema_version: '1.0', doc: 'cv', layout: 'sideways', personal_info: { name: 'N' }, sections: [] }) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(res.status, 422);
  assert.ok((await res.text()).includes('two_column, linear, margin'));
});
