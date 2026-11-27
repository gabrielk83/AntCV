/* DIAGNOSTIC — LETTER-DIAGRAM-001 worker export (owner 2026-11-25). A rich_block row with the lead
 * "Workflow: …" / "Architecture: …" / "Loop: …" and three or more arrow-separated steps must export as a
 * native Word table (fixed layout, tinted cells, accent top rule, arrow cells, cantSplit row, keepNext
 * paragraphs), in the cover letter and in a CV main column; prose with arrows, a killed diagram and a
 * broken row stay text.
 * Run: node test/diag-letter-diagram.mjs [out.docx] */
import { writeSync, writeFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  let p = buf.readUInt32LE(i + 16); const n = buf.readUInt16LE(i + 10);
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), m = buf.readUInt16LE(p + 10);
    if (buf.slice(p + 46, p + 46 + nl).toString() === name) {
      const o = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28), d = buf.slice(o, o + cs);
      return m === 8 ? inflateRawSync(d) : d;
    }
    p += 46 + nl + xl + cl;
  }
  throw new Error('entry not found ' + name);
}
const OUT = process.argv[2];   // read before the import: the bundle replaces the global process
const mod = await import('../src/index.js');
async function gen(payload) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ' ' + Buffer.from(ab).toString().slice(0, 200));
  return Buffer.from(ab);
}
const FLOW = 'Ride along (one week in the field) → Pick (one task) → Prototype (two weeks) → Measure (time and use) → Hand over (to the owners)';
const bring = (row, extra) => Object.assign({ id: 'bring', title: 'WHAT I BRING', loc: 'main', on: true, type: 'rich_block', headlineOff: true, items: [
  { b: 'What I bring', t: 'a few concrete strengths, each backed by work I have done:' },
  { b: 'Change decisions', t: 'chaired a board of nine functions and cut the cycle from about 250 to about 10 days', mk: true },
  row,
] }, extra || {});
const payload = (sec, over) => Object.assign({
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  personal_info: { name: 'Anita Myre', email: 'a@b.c' }, meta: { subtitle: 'Application: Product Manager' }, style: {}, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'greeting', title: '', loc: 'main', on: true, type: 'text', content: 'Dear Team,' },
    { id: 'opening', title: 'OPENING', loc: 'main', on: true, type: 'rich_block', headlineOff: true, items: [{ b: '', t: 'Your sales teams need tools that save time before the next visit and are right about the customer.' }] },
    sec,
    { id: 'closure', title: '', loc: 'main', on: true, type: 'text', content: 'I would welcome a conversation.' },
  ],
}, over || {});
const xmlOf = async (p) => unzipEntry(await gen(p), 'word/document.xml').toString('utf8');
const textOf = (x) => (x.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map((v) => v.replace(/<[^>]+>/g, '')).join(' | ');
// the diagram table = the innermost <w:tbl> that holds the first step
function tableWith(xml, text) {
  const at = xml.indexOf(text); if (at < 0) return '';
  const a = xml.lastIndexOf('<w:tbl>', at), b = xml.indexOf('</w:tbl>', at);
  return a < 0 || b < 0 ? '' : xml.slice(a, b + 8);
}
let bad = 0;
const ok = (name, cond, extra) => { if (!cond) bad++; log((cond ? 'PASS ' : 'FAIL ') + name + (cond || extra == null ? '' : '  ' + extra)); };

const buf = await gen(payload(bring({ b: 'Workflow: From field day to tool', t: FLOW, mk: true })));
if (OUT) writeFileSync(OUT, buf);
const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
const tbl = tableWith(xml, 'Ride along');
const cells = (tbl.match(/<w:tc>/g) || []).length;
ok('flow: a table holds the steps', !!tbl && cells === 9, 'cells ' + cells);
ok('flow: fixed layout, one row that cannot split', /<w:tblLayout w:type="fixed"\/>/.test(tbl) && (tbl.match(/<w:tr>|<w:tr /g) || []).length === 1 && /<w:cantSplit\/>|<w:cantSplit w:val="true"\/>/.test(tbl));
ok('flow: four arrows, five tinted boxes', (tbl.match(/→/g) || []).length === 4 && (tbl.match(/<w:shd [^>]*w:fill="[0-9A-F]{6}"/g) || []).length === 5, textOf(tbl));
ok('flow: accent top rule on the boxes only', (tbl.match(/<w:top w:val="single"/g) || []).length === 5);
ok('flow: step and detail are separate paragraphs, all keepNext', (tbl.match(/<w:keepNext\/>/g) || []).length === 14, (tbl.match(/<w:keepNext\/>/g) || []).length);
ok('flow: the name is the heading, the lead word and the arrow sentence are gone', /From field day to tool/.test(textOf(xml)) && !/Workflow:/.test(textOf(xml)) && !/Ride along \(one week/.test(textOf(xml)));
ok('flow: no bullet on the diagram row', (xml.match(/<w:numPr>/g) || []).length === 1);
const grid = (tbl.match(/<w:gridCol w:w="(\d+)"/g) || []).map((v) => Number(v.match(/(\d+)"/)[1]));
ok('flow: grid fits the letter body', grid.length === 9 && grid.reduce((a, b) => a + b, 0) <= 11306, grid.join(','));

const loop = await xmlOf(payload(bring({ b: 'Loop: How I would improve it', t: 'Measure (one baseline) -> Change (one thing) -> Decide | each round ends in a written decision' })));
ok('loop: return note with the sign', /↺ each round ends in a written decision/.test(textOf(loop)) && (tableWith(loop, 'Measure').match(/<w:tc>/g) || []).length === 5);
const layers = await xmlOf(payload(bring({ b: 'Architecture: How the parts connect', t: 'People (who decides) → Process (steps and gates) → Data (what is stored) → Tools (what runs it)' })));
const lt = tableWith(layers, 'People');
ok('layers: four stacked rows of two cells, no arrows', (lt.match(/<w:tr>|<w:tr /g) || []).length === 4 && (lt.match(/<w:tc>/g) || []).length === 8 && !/→/.test(lt));
const da = await xmlOf(payload(bring({ b: 'Arbejdsgang: Fra felt til værktøj', t: 'Følg med → Vælg → Byg → Mål' }), { language: 'da' }));
ok('Danish lead draws', (tableWith(da, 'Følg med').match(/<w:tc>/g) || []).length === 7);
const dg = await xmlOf(payload(bring({ b: 'From field to tool', t: 'Ride along → Pick → Build', dg: 'flow' })));
ok('explicit dg draws without a lead word', (tableWith(dg, 'Ride along').match(/<w:tc>/g) || []).length === 5);
const bound = await xmlOf(payload(bring({ b: 'Workflow: x', t: FLOW.replace('the owners)', 'the owners)') })));
ok('a bound last word (nbsp) still draws', (tableWith(bound, 'Ride along').match(/<w:tc>/g) || []).length === 9);

const prose = await xmlOf(payload(bring({ b: 'Change decisions', t: 'cut the cycle from 250 → 10 days → and kept it there → for a year', mk: true })));
ok('prose with arrows stays a bullet', /250 → 10 days/.test(textOf(prose)) && (prose.match(/<w:numPr>/g) || []).length === 2);
const two = await xmlOf(payload(bring({ b: 'Workflow: short', t: 'Pick → Build' })));
ok('two steps stay text', /Pick → Build/.test(textOf(two)));
const off = await xmlOf(payload(bring({ b: 'Workflow: From field day to tool', t: FLOW }, { noDiagram: true })));
ok('kill switch prints the text row', /Ride along \(one week in the field\) → Pick/.test(textOf(off)));
const cv = await xmlOf(payload(bring({ b: 'Workflow: x', t: FLOW }), { doc: 'cv', layout: 'two_column' }));
const cvt = tableWith(cv, 'Ride along');
ok('CV main column: the table keeps inside the column', (cvt.match(/<w:gridCol w:w="(\d+)"/g) || []).map((v) => Number(v.match(/(\d+)"/)[1])).reduce((a, b) => a + b, 0) < 9000);
log(bad ? bad + ' FAILED' : 'all pass');
process.exit(bad ? 1 : 0);
