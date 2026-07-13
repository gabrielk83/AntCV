/* TABLE-GEOMETRY-PARITY-001 verification helper (row 25).
 * Renders a CV competency table via the DEPLOYED worker module (src/index.js)
 * at a given first-column RATIO with a single data row (label + filler), writes
 * the .docx so soffice can convert it to a real PDF for wrap measurement.
 * Usage: node _tgp-render.mjs <ratio> <label> <outfile.docx> */
import { writeFileSync } from 'node:fs';

const [ratioArg, label, outfile] = process.argv.slice(2);
const ratio = Number(ratioArg);

const mod = await import('../src/index.js');
async function gen(payload) {
  const req = new Request('https://x/generate', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ' ' + Buffer.from(ab).toString('utf8').slice(0, 200));
  return Buffer.from(ab);
}

const competency = {
  id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table',
  tableRatio: ratio,
  rows: [
    ['Focus Area', 'Strategic Expertise'],
    [label, 'Filler expertise text that is long enough to occupy the second column across a couple of lines so the row renders naturally.'],
  ],
};
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 'tgp',
  personal_info: { name: 'Gabriel K', email: 'g@b.c' }, meta: { subtitle: 'Sub', role: 'R' },
  style: { navy: '#283556' }, font_sizes: { mainBody: 10.5, mainTblCell: 10 },
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile.' },
    competency,
  ],
};

const buf = await gen(payload);
writeFileSync(outfile, buf);
process.stdout.write('wrote ' + outfile + ' (' + buf.length + ' bytes) ratio=' + ratio + ' label="' + label + '"\n');
