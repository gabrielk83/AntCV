/* DIAGNOSTIC — PB-WORKER-CL-LIST-CONT-001 (owner 2026-06-10): a labeled_list in
 * the LINEAR cover letter that the preview splits across a page must also split
 * in the export — a "TITLE (CONT.)" heading + a real page break — not stay whole
 * with no continuation. The split was previously gated to the CV sidebar only.
 * Generates a CL with a labeled_list whose item idx 4 carries _page:2 and asserts
 * the document.xml shows the continuation heading + a pageBreakBefore.
 * Run: node test/diag-cl-list-cont.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdOffset = buf.readUInt32LE(i + 16); const nEntries = buf.readUInt16LE(i + 10); let p = cdOffset;
  for (let e = 0; e < nEntries; e++) { const compSize = buf.readUInt32LE(p+20), nameLen = buf.readUInt16LE(p+28), extraLen = buf.readUInt16LE(p+30), commentLen = buf.readUInt16LE(p+32), lho = buf.readUInt32LE(p+42); const en = buf.toString('utf8', p+46, p+46+nameLen); if (en === name) { const lN = buf.readUInt16LE(lho+26), lE = buf.readUInt16LE(lho+28), ds = lho+30+lN+lE, comp = buf.slice(ds, ds+compSize); return (buf.readUInt16LE(p+10)===0)?comp:inflateRawSync(comp); } p += 46+nameLen+extraLen+commentLen; }
  throw new Error('entry not found ' + name);
}

const mod = await import('../src/index.js');
async function gen(payload) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(payload) }), {}, { waitUntil(){}, passThroughOnException(){} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status);
  return Buffer.from(ab);
}

const items = [
  { l: 'A1', v: 'one' }, { l: 'A2', v: 'two' }, { l: 'A3', v: 'three' }, { l: 'A4', v: 'four' },
  { l: 'B1', v: 'five', _page: 2 }, { l: 'B2', v: 'six' }, { l: 'B3', v: 'seven' },
];
const payload = {
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  personal_info: { name: 'Anita Myre', email: 'a@b.c' }, meta: { subtitle: 'Application' },
  style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'greeting', title: '', loc: 'main', on: true, type: 'text', text: 'Dear Team,' },
    { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'main', on: true, type: 'labeled_list', items },
  ],
};

const xml = unzipEntry(await gen(payload), 'word/document.xml').toString('utf8');
const texts = (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).filter(Boolean);
const joined = texts.join(' | ');
// Count REGULATORY CONTEXT headings: should be 2 (original + CONT.).
const headingCount = (joined.match(/REGULATORY CONTEXT/gi) || []).length;
const hasCont = /REGULATORY CONTEXT \(CONT\.\)/i.test(joined);
const pageBreaks = (xml.match(/<w:pageBreakBefore\s*\/>/g) || []).length;
const allItems = ['A1','A2','A3','A4','B1','B2','B3'].every(t => joined.includes(t));
const dup = ['A1','B1'].some(t => texts.filter(x => x.includes(t)).length !== 1);

log('REGULATORY CONTEXT headings:', headingCount, '| has (CONT.):', hasCont, '| pageBreakBefore count:', pageBreaks);
log('all items present:', allItems, '| no dup:', !dup);
const A = hasCont;                 // continuation heading present in the CL export
const B = headingCount >= 2;       // original + continuation
const C = pageBreaks >= 1;         // a real Word page break was emitted
const D = allItems && !dup;        // no content lost or duplicated
log(`CHECK A (CL labeled_list shows "REGULATORY CONTEXT (CONT.)"): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (two headings — original + continuation): ${B ? 'PASS' : 'FAIL'}`);
log(`CHECK C (real pageBreakBefore emitted): ${C ? 'PASS' : 'FAIL'}`);
log(`CHECK D (all items present, none duplicated): ${D ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D;
log(ok ? 'CL-LIST-CONT OK (4/4)' : 'CL-LIST-CONT FAIL');
process.exitCode = ok ? 0 : 1;
