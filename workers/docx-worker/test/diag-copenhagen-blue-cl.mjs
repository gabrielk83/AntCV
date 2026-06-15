/* DIAGNOSTIC — COPENHAGEN-BLUE-BRIGHTER-001 + CL-CONTACT-ONELINE-001 (owner 2026-06-15).
 * Drives a Copenhagen-Modern cover-letter export through the real worker and asserts:
 *  - candidate band fill = 33446F (brighter blue, not the old 283556)
 *  - WHAT-I-BRING table header fill = 33446F
 *  - candidate contact line separator = single-space " • " (not "   •   ")
 *  - PARITY GUARD: main-column section headings keep the dark navy 283556
 * Run from workers/docx-worker/:  node test/diag-copenhagen-blue-cl.mjs */
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

const payload = {
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  package: 'copenhagen-modern',
  personal_info: { name: 'Anita Myre', location: '2300, København S', email: 'anita@ex.dk', phone: '+45 12 34 56 78', linkedin: 'linkedin.com/in/anita' },
  meta: { subtitle: 'Application — Product Manager' },
  font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'greeting', title: '', loc: 'main', on: true, type: 'text', text: 'Dear Hiring Team,' },
    { id: 'why', title: 'WHY THIS ROLE', loc: 'main', on: true, type: 'text', text: 'I bring product leadership across regulated domains.' },
    { id: 'bring', title: 'WHAT I BRING', loc: 'main', on: true, type: 'table',
      rows: [ ['Focus Area', 'Strategic Expertise'], ['Product', 'Roadmap & discovery'], ['Delivery', 'Cross-functional execution'] ] },
  ],
};

const xml = unzipEntry(await gen(payload), 'word/document.xml').toString('utf8');
const fills = (xml.match(/w:fill="[0-9A-Fa-f]{6}"/g) || []).map(s => s.slice(8, 14).toUpperCase());
const texts = (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, ''));
const joined = texts.join('');

const bandBright = fills.includes('33446F');
const noOldBand = !fills.includes('283556'); // band/table fills should no longer be the old navy
const sepTight = joined.includes(' • ') && !joined.includes('   •   ');
const allContact = ['København', 'anita@ex.dk', '12 34 56 78', 'linkedin.com/in/anita'].every(t => joined.includes(t));
// parity: main-column heading text/rule keeps the dark navy 283556 (it is a colour attr, not a fill)
const headingNavy = /w:color="283556"/i.test(xml);

log('distinct fills:', [...new Set(fills)].join(','));
log('33446F band/table fill present:', bandBright, '| no 283556 fill:', noOldBand);
log('contact joined:', joined.match(/Anita[^]*?(linkedin\.com\/in\/anita)/i)?.[0]?.slice(0, 160) || '(n/a)');
log('tight sep:', sepTight, '| all contact items present:', allContact, '| heading navy (parity):', headingNavy);

const A = bandBright && noOldBand;
const B = sepTight;
const C = allContact;
const D = headingNavy;
log(`CHECK A (candidate band + table header = 33446F, no 283556 fill): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (contact separator tightened to single-space): ${B ? 'PASS' : 'FAIL'}`);
log(`CHECK C (all contact items retained): ${C ? 'PASS' : 'FAIL'}`);
log(`CHECK D (parity: main headings stay navy 283556): ${D ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D;
log(ok ? 'COPENHAGEN-BLUE-CL OK (4/4)' : 'COPENHAGEN-BLUE-CL FAIL');
process.exitCode = ok ? 0 : 1;
