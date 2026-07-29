/* DIAGNOSTIC — HEADER-BANNER rule 2 (KOMBIT gold, Track C): the contact line's
 * icon glyphs (⌂ ★ ✉ ☎ 🔗) ARE the separators — drop the " • " bullets, and the
 * email icon is ✉ (U+2709), never @. Drives the real worker in-process, extracts
 * word/document.xml, and asserts:
 *   1. the email run carries ✉ and NOT "@ " ;
 *   2. NO " • " bullet separator appears anywhere in the header contact runs.
 * Runs for BOTH the bridge (band-overlap photo) and non-bridge (sidebar-top) paths. */
import { inflateRawSync } from 'node:zlib';
import { writeSync } from 'node:fs';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzipEntry(buf, name) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cd;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), nm = buf.toString('utf8', p + 46, p + 46 + nl);
    if (nm === name) { const ln = buf.readUInt16LE(lho + 26), lx = buf.readUInt16LE(lho + 28); const d = buf.slice(lho + 30 + ln + lx, lho + 30 + ln + lx + cs); return buf.readUInt16LE(p + 10) === 0 ? d : inflateRawSync(d); }
    p += 46 + nl + xl + cl;
  }
  throw new Error('entry not found: ' + name);
}
const PHOTO_B64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const mod = await import('../src/index.js');
async function gen(extraPi) {
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Gabriel Karp-Gershon', email: 'karp.gabriel.a@gmail.com', phone: '+45 31 71 00 72', location: '2300 Kobenhavn S', citizenship: 'EU Citizen', linkedin: 'linkedin.com/in/gabriel-karp', ...extraPi },
    meta: { subtitle: 'Processes Products People', role: 'R' }, style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
      { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Eng', v: 'Python' }] },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return unzipEntry(Buffer.from(ab), 'word/document.xml').toString('utf8');
}
// collect the <w:t> text runs, concatenated, to inspect the contact line
function texts(xml) {
  const out = [];
  const re = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g; let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out.join('␟'); // join with a sentinel so we can see run boundaries
}
let ok = true;
for (const [label, extra] of [['NON-BRIDGE', {}], ['BRIDGE', { photo_b64: PHOTO_B64, photoPosition: 'band-overlap' }]]) {
  const xml = await gen(extra);
  const t = texts(xml);
  const hasEnvelope = t.indexOf('✉') >= 0;                 // ✉
  const emailAt = /@␟?\s*[␟]?\s*karp\.gabriel|@ karp\.gabriel/.test(t) || t.indexOf('@ karp.gabriel.a') >= 0;
  const hasBullet = t.indexOf(' • ') >= 0;                  // " • "
  const pass = hasEnvelope && !emailAt && !hasBullet;
  ok = ok && pass;
  log(`${label}: ✉=${hasEnvelope} emailUsesAt=${emailAt} hasBulletSep=${hasBullet} -> ${pass ? 'OK' : 'FAIL'}`);
}
log(ok ? 'CONTACT-ICONS OK' : 'CONTACT-ICONS FAILED');
process.exit(ok ? 0 : 1);
