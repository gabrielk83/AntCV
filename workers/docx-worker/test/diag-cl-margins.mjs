/* DIAGNOSTIC — CL-EXPORT-EDGE-MARGINS-001 (owner 2026-06-15): the cover-letter
 * L/R page-edge margin doubled 100->200 DXA (0.07"->0.14"). Asserts the linear
 * (CL) section pgMar L/R = 200 & top = 0, the header band stays full-bleed
 * (negative tblInd cancels the new margin), and the WHAT-I-BRING table still
 * fits the narrower body (tblW <= pageWidth - 2*200). Run from workers/docx-worker/. */
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
  const ab = await res.arrayBuffer(); if (res.status !== 200) throw new Error('status ' + res.status); return Buffer.from(ab);
}
const payload = {
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  package: 'copenhagen-modern',
  personal_info: { name: 'Anita Myre', location: '2300, København S', email: 'a@b.dk', phone: '+45 12', linkedin: 'linkedin.com/in/anita' },
  meta: { subtitle: 'Application' },
  sections: [
    { id: 'greeting', title: '', loc: 'main', on: true, type: 'text', text: 'Dear Team,' },
    { id: 'bring', title: 'WHAT I BRING', loc: 'main', on: true, type: 'table', rows: [['Focus Area','Strategic Expertise'],['Product','Roadmap & discovery'],['Delivery','Execution']] },
    { id: 'sig', title: '', loc: 'main', on: true, type: 'text', text: 'Kind regards, Anita Myre' },
  ],
};
const xml = unzipEntry(await gen(payload), 'word/document.xml').toString('utf8');
const pgMar = xml.match(/<w:pgMar[^>]*\/>/);
const pgSz = xml.match(/<w:pgSz[^>]*w:w="(\d+)"/);
const left = pgMar ? (pgMar[0].match(/w:left="(\d+)"/)||[])[1] : null;
const right = pgMar ? (pgMar[0].match(/w:right="(\d+)"/)||[])[1] : null;
const top = pgMar ? (pgMar[0].match(/w:top="(\d+)"/)||[])[1] : null;
const pageW = pgSz ? Number(pgSz[1]) : null;
// band full-bleed: a negative tblInd (-200) cancelling the new margin
const hasNegIndent = /<w:tblInd [^>]*w:w="-200"/.test(xml);
// table widths (w:type before w:w in the docx lib output). The full-bleed band
// table equals the page width (cancelled by the -200 indent); the content
// WHAT-I-BRING table must fit the new body width pageW-400.
const tblWs = [...xml.matchAll(/<w:tblW w:type="dxa" w:w="(\d+)"/g)].map(m => Number(m[1]));
const usable = pageW != null ? pageW - 400 : null;
const contentTblWs = tblWs.filter(w => w !== pageW);   // exclude the full-bleed band
const maxContent = contentTblWs.length ? Math.max(...contentTblWs) : 0;
log('pgMar:', pgMar ? pgMar[0] : '(none)');
log('pgSz width:', pageW, '| usable (pageW-400):', usable, '| tblWs:', tblWs.join(','), '| neg-indent -200:', hasNegIndent);

const A = left === '200' && right === '200';
const B = top === '0';
const C = hasNegIndent;                 // header band still full-bleed
const D = usable != null && maxContent > 0 && maxContent <= usable;   // content table fits the narrower body
// CL-WIDTH-CAP-001 (owner 2026-06-15): the default WHAT-I-BRING table now fills
// ~0.9 of the body width (was 0.8) — assert it uses MOST of the usable width.
const E = usable != null && maxContent >= Math.round(0.88 * usable) && maxContent <= Math.round(0.92 * usable);
log(`CHECK A (CL pgMar L/R = 200 = 0.14"): ${A?'PASS':'FAIL'} (left=${left} right=${right})`);
log(`CHECK B (top stays 0 — band full-bleed to top edge): ${B?'PASS':'FAIL'}`);
log(`CHECK C (header band negative indent -200 cancels new margin): ${C?'PASS':'FAIL'}`);
log(`CHECK D (WHAT-I-BRING table fits body width pageW-400): ${D?'PASS':'FAIL'} (${maxContent} <= ${usable})`);
log(`CHECK E (CL-WIDTH-CAP: table fills ~0.9 of body width): ${E?'PASS':'FAIL'} (${maxContent} vs ~${Math.round(0.9*usable)})`);
const ok = A && B && C && D && E;
log(ok ? 'CL-MARGINS OK (5/5)' : 'CL-MARGINS FAIL');
process.exitCode = ok ? 0 : 1;
