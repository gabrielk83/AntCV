/* DIAGNOSTIC — HDR-TYPE-CONTROLS-001 (owner 2026-07-29).
 * The Font sizes (pt) panel now owns SIZE and LETTER SPACING for the five identity
 * lines, and Specialisation / Application are separate controls. The worker must
 * honour every one of them. Letter spacing is a DELTA in pt; DOCX w:spacing is in
 * twentieths of a point, so 0.05pt = exactly 1 unit. Asserts:
 *   A. font_sizes.sloganSize resizes the CL slogan (was hard-pinned 11pt)
 *   B. font_sizes.applicationSize resizes the CL application line (was pinned 10.5pt)
 *   C. sloganTrack / applicationTrack shift w:spacing off their baselines (20 / 4)
 *   D. nameTrack / specTrack / contactTrack reach the header band runs
 *   E. a payload with no track keys is byte-identical to the pre-change baseline
 *      (delta semantics: 0 must change nothing)
 * Run: node test/diag-hdr-type-controls.mjs */
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
const CL = (fontSizes) => ({
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  personal_info: { name: 'Gabriel Karp', email: 'g@b.c', phone: '+45 00 00 00 00', location: 'Copenhagen' },
  meta: { subtitle: 'Processes | Products | People', slogan: 'MOVES OPTICAL HARDWARE FROM LAB TO SCALE', role: 'Project Manager', company: 'Demant' },
  style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' },
  font_sizes: Object.assign({ mainBody: 10.5 }, fontSizes),
  sections: [
    { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Manager,' },
    { id: 'opening', title: 'Opening', loc: 'main', on: true, type: 'text', content: 'Opening paragraph here.' },
  ],
});
// The slogan and the application line are the only two uppercase/greyed runs in
// the CL body; find each by its text so the assertions cannot drift onto a
// neighbouring paragraph.
function runOf(xml, text) {
  const at = xml.indexOf(text);
  if (at < 0) throw new Error('text not found: ' + text.slice(0, 30));
  const start = xml.lastIndexOf('<w:r>', at);
  return xml.slice(start, at);
}
const sz = (r) => { const m = r.match(/<w:sz w:val="(\d+)"/); return m ? Number(m[1]) : null; };
const sp = (r) => { const m = r.match(/<w:spacing w:val="(-?\d+)"/); return m ? Number(m[1]) : 0; };

let fail = 0;
const check = (name, got, want) => {
  const ok = got === want;
  if (!ok) fail++;
  log((ok ? 'PASS ' : 'FAIL ') + name + '  got=' + got + ' want=' + want);
};

// ---- A/B/C: CL slogan + application line -----------------------------------
{
  const base = (await gen(CL({}))).toString('latin1');
  const xmlB = unzip(Buffer.from(base, 'latin1'), 'word/document.xml').toString('utf8');
  const slB = runOf(xmlB, 'MOVES OPTICAL HARDWARE');
  const alB = runOf(xmlB, 'Application for Project Manager');
  check('A0 slogan baseline size = 11pt (w:sz 22)', sz(slB), 22);
  check('B0 app-line baseline size = 10.5pt (w:sz 21)', sz(alB), 21);
  check('C0 slogan baseline w:spacing = 20', sp(slB), 20);
  check('C0 app-line baseline w:spacing = 4', sp(alB), 4);

  const tuned = await gen(CL({ sloganSize: 14, applicationSize: 9, sloganTrack: 0.25, applicationTrack: -0.15 }));
  const xmlT = unzip(tuned, 'word/document.xml').toString('utf8');
  const slT = runOf(xmlT, 'MOVES OPTICAL HARDWARE');
  const alT = runOf(xmlT, 'Application for Project Manager');
  check('A  sloganSize 14pt reaches the slogan run (w:sz 28)', sz(slT), 28);
  check('B  applicationSize 9pt reaches the app line (w:sz 18)', sz(alT), 18);
  check('C  sloganTrack +0.25pt = baseline 20 + 5', sp(slT), 25);
  check('C  applicationTrack -0.15pt = baseline 4 - 3', sp(alT), 1);
}

// ---- D: header band identity lines -----------------------------------------
{
  const plain = await gen(CL({}));
  const xmlP = unzip(plain, 'word/document.xml').toString('utf8');
  const nameP = runOf(xmlP, 'Gabriel Karp');
  const specP = runOf(xmlP, 'Processes');

  const tuned = await gen(CL({ nameTrack: 0.5, specTrack: 0.3, contactTrack: -0.2 }));
  const xmlT = unzip(tuned, 'word/document.xml').toString('utf8');
  const nameT = runOf(xmlT, 'Gabriel Karp');
  const specT = runOf(xmlT, 'Processes');
  check('D  nameTrack +0.50pt shifts the name run by +10', sp(nameT) - sp(nameP), 10);
  check('D  specTrack +0.30pt shifts the spec run by +6', sp(specT) - sp(specP), 6);
  const contP = runOf(xmlP, 'Copenhagen'), contT = runOf(xmlT, 'Copenhagen');
  check('D  contactTrack -0.20pt shifts the contact run by -4', sp(contT) - sp(contP), -4);
}

// ---- E: zero-delta payload is inert ----------------------------------------
{
  const a = unzip(await gen(CL({})), 'word/document.xml').toString('utf8');
  const b = unzip(await gen(CL({ nameTrack: 0, specTrack: 0, applicationTrack: 0, contactTrack: 0, sloganTrack: 0 })), 'word/document.xml').toString('utf8');
  check('E  all-zero tracks render identically to no tracks at all', a === b, true);
}

log(fail === 0 ? '\nALL PASS' : '\n' + fail + ' FAILED');
process.exit(fail === 0 ? 0 : 1);
