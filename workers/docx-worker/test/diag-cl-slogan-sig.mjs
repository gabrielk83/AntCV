/* DIAGNOSTIC — CL slogan + signature-before-name order (owner 2026-06-29).
 * SLOGAN-CL-001: a tagline heading (candidate subtitle, uppercased) at the TOP of the CL body.
 * NAME-FOLLOWS-SIG-001: the sign-off order is "Kind regards," → signature image → typed name,
 * and the typed name adopts the signature's alignment. Drives the live worker with a CL that
 * has a subtitle + a (right-aligned) signature and asserts STRUCTURE in document.xml:
 *   A. the slogan text (uppercased subtitle) is present and appears BEFORE the name
 *   B. the signature image (<w:drawing>) appears BEFORE the typed name
 * Run: node test/diag-cl-slogan-sig.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cdo = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cdo;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const en = buf.toString('utf8', p + 46, p + 46 + nl);
    if (en === name) { const lnl = buf.readUInt16LE(lho + 26), lel = buf.readUInt16LE(lho + 28), ds = lho + 30 + lnl + lel; const c = buf.slice(ds, ds + cs); return buf.readUInt16LE(p + 10) === 0 ? c : inflateRawSync(c); }
    p += 46 + nl + el + cl;
  }
  throw new Error('no ' + name);
}
const mod = await import('../src/index.js');
async function gen(payload) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 200));
  return Buffer.from(ab);
}
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const payload = {
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  personal_info: { name: 'Gabriel K', email: 'g@b.c', signature_b64: png, signature_align: 'right', signature_size_px: 160, signature_aspect: 0.4 },
  meta: { subtitle: 'Processes | Products | People', role: 'PM', company: 'X' },
  style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Manager,' },
    { id: 'opening', title: 'Opening', loc: 'main', on: true, type: 'text', content: 'Opening paragraph here.' },
  ],
};
const full = unzip(await gen(payload), 'word/document.xml').toString('utf8');
// scope to the body; the candidate HEADER band also carries the name + subtitle, so
// compare against body landmarks (greeting, Kind regards, sign-off name = LAST name).
const xml = full.slice(full.indexOf('<w:body'));
const sloganPos = xml.indexOf('PROCESSES');
const greetPos = xml.indexOf('Dear Hiring');
const kindPos = xml.indexOf('Kind regards');
const sigPos = xml.indexOf('<w:drawing', kindPos);
const signoffName = xml.lastIndexOf('Gabriel K');
const hasSlogan = xml.includes('PROCESSES') && xml.includes('PRODUCTS') && xml.includes('PEOPLE');
const A = hasSlogan && sloganPos >= 0 && greetPos > 0 && sloganPos < greetPos;
const B = sigPos > kindPos && signoffName > sigPos;
log('slogan@' + sloganPos, 'greet@' + greetPos, 'kind@' + kindPos, 'sig@' + sigPos, 'signoffName@' + signoffName);
log(`CHECK A (slogan present + before greeting/opening): ${A ? 'PASS' : 'FAIL'}`);
log(`CHECK B (signature after sign-off, before the name): ${B ? 'PASS' : 'FAIL'}`);
const ok = A && B;
log(ok ? 'CL-SLOGAN-SIG OK (2/2)' : 'CL-SLOGAN-SIG FAIL');
process.exitCode = ok ? 0 : 1;
