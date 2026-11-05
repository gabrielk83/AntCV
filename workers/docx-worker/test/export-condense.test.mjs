// EXPORT-CONDENSE-001 (owner 2026-10-01): the worker applies sec.item_condense[path] (1/20 pt) to every run of that
// paragraph - experience bullet, Results line, rich-block row - and clamps to the -0.4 pt floor (-8).
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
async function gen(sections) {
  const payload = { schema_version: '1.0', doc: 'cv', language: 'en', filename: 'c', layout: 'two_column', personal_info: { name: 'Test Person', email: 't@e.st' }, meta: { role: 'X' }, style: {}, font_sizes: {}, sections };
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 200));
  return unzipEntry(buf, 'word/document.xml').toString('utf8');
}
const para = (xml, text) => { const i = xml.indexOf(text); assert.ok(i > 0, 'text present: ' + text); return xml.slice(xml.lastIndexOf('<w:p>', i) >= 0 ? xml.lastIndexOf('<w:p', i) : i, xml.indexOf('</w:p>', i)); };

test('bullet, Results and rich-block row carry their condense; others do not', async () => {
  const xml = await gen([
    { id: 'experience', title: 'EXPERIENCE', type: 'experience', loc: 'main', item_condense: { 'roles.0.bullets.1': -6, 'roles.0.results': -4 },
      roles: [{ id: 'r1', title: 'PM', company: 'Co', years: '2020 - 2025', bullets: ['First bullet stays as is', 'Second bullet gets condensed'], results: 'Result line condensed' }] },
    { id: 'profile', title: 'PROFILE', type: 'rich_block', loc: 'main', item_condense: { 'items.0': -20 }, items: [{ b: '', t: 'Profile row with an over-floor request' }] },
  ]);
  assert.ok(!/<w:spacing w:val="-6"\/>/.test(para(xml, 'First bullet stays as is')), 'untouched bullet');
  assert.match(para(xml, 'Second bullet gets condensed'), /<w:spacing w:val="-6"\/>/);
  assert.match(para(xml, 'Result line condensed'), /<w:spacing w:val="-4"\/>/);
  assert.match(para(xml, 'Profile row with an over-floor request'), /<w:spacing w:val="-8"\/>/, 'clamped to the -0.4 pt floor');
});

// NO-ORPHAN-001 (owner 2026-11-05, "make sure not to have orphans - especially in tables"): table cells take
// item_condense["rows.R.C"] (floor -0.5 pt = -10) and item_scale["rows.R.C"] (w:w, floor 94%); education,
// list, bullets, text_bullets and labeled_list rows take item_condense at their preflight path.
const HDR = ['The role needs', 'What I bring, with proof'];
test('table cells carry their condense + character width; other cells stay untouched; clamps hold', async () => {
  const xml = await gen([
    { id: 'core', title: 'CORE COMPETENCIES', type: 'table', loc: 'main',
      item_condense: { 'rows.0.0': -4, 'rows.1.1': -20 }, item_scale: { 'rows.1.1': 96, 'rows.2.0': 80 },
      rows: [HDR, ['Regulatory affairs', 'Cell one condensed and scaled'], ['Field trials', 'Cell two untouched']] },
  ]);
  assert.match(para(xml, 'The role needs'), /<w:spacing w:val="-4"\/>/);
  const c11 = para(xml, 'Cell one condensed and scaled');
  assert.match(c11, /<w:spacing w:val="-10"\/>/, 'cells clamp at -0.5 pt');
  assert.match(c11, /<w:w w:val="96"\/>/);
  assert.match(para(xml, 'Field trials'), /<w:w w:val="94"\/>/, 'width clamps at 94%');
  const c21 = para(xml, 'Cell two untouched');
  assert.ok(!/<w:spacing w:val=/.test(c21) && !/<w:w w:val=/.test(c21), 'untouched cell');
  assert.ok(!/<w:w w:val=/.test(para(xml, 'Regulatory affairs')), 'scale is per cell');
});

test('a table split across pages keeps the full-array row keys (segment _rowBase)', async () => {
  const xml = await gen([
    { id: 'core', title: 'CORE COMPETENCIES', type: 'table', loc: 'main', row_pages: { 2: 2 },
      item_condense: { 'rows.2.1': -6 },
      rows: [HDR, ['First need', 'Row one stays on page one'], ['Second need', 'Row two moves to page two']] },
  ]);
  assert.match(para(xml, 'Row two moves to page two'), /<w:spacing w:val="-6"\/>/);
  assert.ok(!/<w:spacing w:val="-6"\/>/.test(para(xml, 'Row one stays on page one')), 'segment 2 row 1 is NOT rows.1');
});

test('education, list, bullets, text_bullets and labeled_list rows carry their condense', async () => {
  const xml = await gen([
    { id: 'education', title: 'EDUCATION', type: 'education', loc: 'main', item_condense: { 'items.1': -5 },
      items: [{ deg: 'BSc Biology', sch: 'Lund' }, { deg: 'MSc Agricultural Sciences', sch: 'Alnarp condensed' }] },
    { id: 'skills', title: 'SKILLS', type: 'list', loc: 'main', item_condense: { 'items.0': -3 }, items: ['List item condensed', 'List item plain'] },
    { id: 'outcomes', title: 'OUTCOMES', type: 'bullets', loc: 'main', item_condense: { 'items.0': -7 }, items: [{ b: 'Cut', t: 'bullet item condensed' }] },
    { id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', type: 'text_bullets', loc: 'main', item_condense: { intro: -2, 'items.1': -4, closing: -1 },
      intro: 'Intro paragraph condensed', items: ['Text bullet plain', 'Text bullet condensed'], closing: 'Closing paragraph condensed' },
    { id: 'languages', title: 'LANGUAGES', type: 'labeled_list', loc: 'main', item_condense: { 'items.0': -2 }, items: [{ l: 'Danish', v: 'labeled value condensed' }] },
  ]);
  assert.match(para(xml, 'Alnarp condensed'), /<w:spacing w:val="-5"\/>/);
  assert.ok(!/<w:spacing w:val=/.test(para(xml, 'BSc Biology')));
  assert.match(para(xml, 'List item condensed'), /<w:spacing w:val="-3"\/>/);
  assert.ok(!/<w:spacing w:val=/.test(para(xml, 'List item plain')));
  assert.match(para(xml, 'bullet item condensed'), /<w:spacing w:val="-7"\/>/);
  assert.match(para(xml, 'Intro paragraph condensed'), /<w:spacing w:val="-2"\/>/);
  assert.match(para(xml, 'Text bullet condensed'), /<w:spacing w:val="-4"\/>/);
  assert.ok(!/<w:spacing w:val=/.test(para(xml, 'Text bullet plain')));
  assert.match(para(xml, 'Closing paragraph condensed'), /<w:spacing w:val="-1"\/>/);
  assert.match(para(xml, 'labeled value condensed'), /<w:spacing w:val="-2"\/>/);
  assert.ok(!/<w:w w:val=/.test(xml), 'no item_scale, no character width');
});

// NO-ORPHAN-003 (audit of a real CV, 2026-11-05): roles split across pages (role.page) and sidebar lists split by
// _page / row_pages render as page segments; the payload-indexed keys must still find their own paragraph.
test('page segments keep payload indexes: roles.N, items.N land on the right paragraph', async () => {
  const xml = await gen([
    { id: 'experience', title: 'EXPERIENCE', type: 'experience', loc: 'main',
      item_condense: { 'roles.1.bullets.1': -6, 'roles.2.results': -4 }, item_scale: { 'roles.2.bullets.0': 97 },
      item_alignment: { 'roles.2.bullets.0': 'center' },
      roles: [
        { id: 'a', title: 'First role', company: 'A', years: '2024', bullets: ['Page one bullet zero', 'Page one bullet one'] },
        { id: 'b', title: 'Second role', company: 'B', years: '2022', page: 2, bullets: ['Page two bullet zero', 'Page two bullet one'] },
        { id: 'c', title: 'Third role', company: 'C', years: '2020', page: 2, bullets: ['Third role bullet zero'], results: 'Third role results' },
      ] },
    { id: 'certs', title: 'CERTS', type: 'list', loc: 'sidebar', bullet_style: 'bullet', item_condense: { 'items.2': -6 },
      items: ['Cert zero', { text: 'Cert one', _page: 2 }, { text: 'Cert two', _page: 2 }] },
  ]);
  assert.match(para(xml, 'Page two bullet one'), /<w:spacing w:val="-6"\/>/, 'roles.1 = the second role, in the page-2 segment');
  assert.ok(!/<w:spacing w:val="-6"\/>/.test(para(xml, 'Page one bullet one')), 'not the first role of the segment');
  assert.match(para(xml, 'Third role bullet zero'), /<w:w w:val="97"\/>/);
  assert.match(para(xml, 'Third role bullet zero'), /<w:jc w:val="center"\/>/, 'alignment keys follow the same index');
  assert.match(para(xml, 'Third role results'), /<w:spacing w:val="-4"\/>/);
  assert.match(para(xml, 'Cert two'), /<w:spacing w:val="-6"\/>/, 'items.2 in the page-2 list segment');
  assert.ok(!/<w:spacing w:val="-6"\/>/.test(para(xml, 'Cert zero')));
});

// NO-ORPHAN-002 (owner fix order): character width for body paragraphs too - compress to 96%, widen to 104% -
// clamped [96, 104] for body and [94, 104] for table cells; marker / emoji rich_block rows take both controls.
test('body width 96..104%, cells 94..104%, marker and emoji rows, Results line', async () => {
  const xml = await gen([
    { id: 'experience', title: 'EXPERIENCE', type: 'experience', loc: 'main',
      item_condense: { 'roles.0.bullets.0': -4 }, item_scale: { 'roles.0.bullets.0': 90, 'roles.0.bullets.1': 110, 'roles.0.results': 103 },
      roles: [{ id: 'r1', title: 'PM', company: 'Co', years: '2020 - 2025', bullets: ['Bullet compressed to the floor', 'Bullet widened past the cap'], results: 'Results line widened' }] },
    { id: 'core', title: 'CORE COMPETENCIES', type: 'table', loc: 'main', item_scale: { 'rows.1.0': 90, 'rows.1.1': 110 },
      rows: [HDR, ['Label cell compressed', 'Proof cell widened past the cap']] },
    { id: 'bring', title: 'WHAT I BRING', type: 'rich_block', loc: 'main', item_condense: { 'items.0': -6 }, item_scale: { 'items.0': 97, 'items.1': 102 },
      items: [{ b: 'Tracking', t: 'Marker row body', mk: true }, { b: '', t: 'Emoji row body', mk: '*' }, { b: 'Plain', t: 'Plain row untouched' }] },
  ]);
  const b0 = para(xml, 'Bullet compressed to the floor');
  assert.match(b0, /<w:spacing w:val="-4"\/>/);
  assert.match(b0, /<w:w w:val="96"\/>/, 'body clamps at 96%');
  assert.match(para(xml, 'Bullet widened past the cap'), /<w:w w:val="104"\/>/, 'widening clamps at 104%');
  assert.match(para(xml, 'Results line widened'), /<w:w w:val="103"\/>/);
  assert.match(para(xml, 'Label cell compressed'), /<w:w w:val="94"\/>/, 'cells clamp at 94%');
  assert.match(para(xml, 'Proof cell widened past the cap'), /<w:w w:val="104"\/>/);
  const mk = para(xml, 'Marker row body');
  assert.match(mk, /<w:spacing w:val="-6"\/>/);
  assert.match(mk, /<w:w w:val="97"\/>/);
  assert.match(para(xml, 'Emoji row body'), /<w:w w:val="102"\/>/);
  assert.ok(!/<w:w w:val=/.test(para(xml, 'Plain row untouched')));
});
