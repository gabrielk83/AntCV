/* DIAGNOSTIC — OUTCOMES-MODE-001 export half (worker 1.14.59). A role
 * carrying a `results` string renders a "Results:" line (bold-italic label
 * run + plain text run) after its bullets; a role without one renders no
 * such line. Drives the real fetch handler. */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10);
  let p = cd;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), nm = buf.toString('utf8', p + 46, p + 46 + nl);
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
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r0', title: 'Change Control Lead', company: 'Innoviz', years: '2020-2025',
        bullets: ['Owned the governance loop.'],
        results: 'Cut change cycle from 250 to 10 days; Built an optical lab.' },
      { id: 'r1', title: 'Optics Engineer', company: 'Sirin', years: '2014-2017',
        bullets: ['Led the optics stack.'] },
    ] },
    { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'E', v: 'P' }] },
  ],
};
const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
const buf = Buffer.from(await res.arrayBuffer());
if (res.status !== 200) { log('status', res.status, buf.toString().slice(0, 200)); process.exit(1); }
const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

const li = xml.indexOf('Results: ');
check('Results label present once', li >= 0 && xml.indexOf('Results: ', li + 1) < 0, `first=${li}`);
if (li >= 0) {
  const rStart = xml.lastIndexOf('<w:r>', li);
  const labelRun = xml.slice(rStart, li);
  check('label run bold', /<w:b\/>/.test(labelRun), labelRun.slice(0, 200));
  check('label run italic', /<w:i\/>/.test(labelRun), labelRun.slice(0, 200));
}
check('results text present', xml.includes('Cut change cycle from 250 to 10 days; Built an optical lab.'));
// the Results line lands after r0's bullet and before r1's title
const bi = xml.indexOf('Owned the governance loop.');
const r1i = xml.indexOf('Optics Engineer');
check('results after r0 bullet, before r1', bi >= 0 && r1i >= 0 && li > bi && li < r1i, `bullet=${bi} results=${li} r1=${r1i}`);

const ok = checks.every(Boolean);
log(ok ? 'ROLE-RESULTS-EXPORT OK' : 'ROLE-RESULTS-EXPORT FAIL');
process.exit(ok ? 0 : 1);
