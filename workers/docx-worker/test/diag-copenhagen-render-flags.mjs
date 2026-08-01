// diag-copenhagen-render-flags.mjs — CPH-RENDER-FLAGS-001 export mirrors
// (spec docs/design/COPENHAGEN_MODERN_NORDIC_PALETTE_SPEC.md, "OPEN — render-
// structure flags"). The preview batch changed the rule weight, the section-head
// rule colour, the Results lead-in, the body-link ink and the AI-notice
// size/colour; the export has to say the same thing or preview != export.
// Every change is gated on style._cph, so a legacy (package-less) payload must
// keep the old numbers exactly.
//   Copenhagen: section-head rule 1.5pt (size 12) grey 777777 under a MAIN head,
//               sidebar head keeps its own colour, "Results:" upright with a
//               777777 underline, AI notice 7.5pt (sz 15) grey 777777.
//   Legacy:     rule 1pt (size 8) in mainHeadColor, Results italic, notice
//               6.5pt (sz 13) 9A9A9A.
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzip(buf, name) { let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break; const cdo = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10); let p = cdo; for (let e = 0; e < n; e++) { const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42); const en = buf.toString('utf8', p + 46, p + 46 + nl); if (en === name) { const lnl = buf.readUInt16LE(lho + 26), lel = buf.readUInt16LE(lho + 28), ds = lho + 30 + lnl + lel; const c = buf.slice(ds, ds + cs); return buf.readUInt16LE(p + 10) === 0 ? c : inflateRawSync(c); } p += 46 + nl + el + cl; } return null; }
const mod = await import('../src/index.js');

const sections = [
  { id: 'summary', title: 'PROFESSIONAL SUMMARY', loc: 'main', on: true, type: 'text', content: 'Project manager bridging optics and delivery.' },
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience',
    roles: [{ company: 'Innoviz', title: 'System Architect', years: '2017 - 2025',
              bullets: ['Ran the change control board.'],
              results: 'Cut the change cycle from 250 to 10 days.' }] },
  { id: 'skills', title: 'CORE SKILLS', loc: 'sidebar', on: true, type: 'list', items: ['Optics', 'Delivery'] },
];
const pi = { name: 'Anita Test Person', email: 'anita@example.com', phone: '+45 12 34 56 78', location: 'Copenhagen' };

async function gen(body) {
  const res = await mod.default.fetch(new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) { log('STATUS', res.status, Buffer.from(ab).toString().slice(0, 300)); process.exit(1); }
  return Buffer.from(ab);
}

let fails = 0;
const check = (label, ok) => { log((ok ? 'PASS' : 'FAIL'), label); if (!ok) fails++; };

const base = { schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
               personal_info: pi, meta: { subtitle: 'Optics' }, font_sizes: {}, sections };

// ── copenhagen ──
const cphBuf = await gen({ ...base, package: 'copenhagen-modern',
                           style: { headerBg: '33446F', sidebarBg: 'DCE5EA', mainHeadColor: '00746E', sidebarHeadColor: '00746E' } });
const cphXml = unzip(cphBuf, 'word/document.xml').toString('utf8');

// flags 1 + 2 — a MAIN section-head rule is 1.5pt grey; the head text stays teal
check('CPH: a main section-head rule is grey 777777 at 1.5pt (sz 12)',
      /w:bottom w:val="single" w:color="777777"[^/]*w:sz="12"/.test(cphXml) ||
      /w:bottom[^>]*w:color="777777"[^>]*w:sz="12"/.test(cphXml));
check('CPH: no main head rule is drawn at the old 1pt weight in teal',
      !/w:bottom[^>]*w:color="00746E"[^>]*w:sz="8"/.test(cphXml));
check('CPH: the head TEXT is still teal (only the rule went grey)',
      /w:color w:val="00746E"/.test(cphXml));

// flag 5 — "Results:" upright with a grey underline
{
  const i = cphXml.indexOf('Results');
  const run = i > 0 ? cphXml.slice(Math.max(0, i - 400), i) : '';
  check('CPH: Results lead-in carries a 777777 underline', /w:u [^>]*w:color="777777"/.test(run));
  check('CPH: Results lead-in is NOT italic', !/<w:i\/>/.test(run.slice(-260)));
}

// flag 11 — AI notice 7.5pt grey. NOTE the INK is not asserted as a literal:
// AI-NOTICE-INK-001 is a standing CONTRAST rule and outranks the mockup - when
// the notice corner lands on the coloured sidebar spine the guard replaces the
// grey with the strongest readable ink, which is correct and must keep working.
// What the flag owns is that the base grey is no longer the old 9A9A9A, and the
// size.
{
  const n = cphXml.indexOf('AntCVAiNotice');
  const run = n > 0 ? cphXml.slice(n, n + 900) : '';
  check('CPH: AI notice size 7.5pt (sz 15)', !run || /w:sz w:val="15"/.test(run));
  check('CPH: AI notice never falls back to the legacy 9A9A9A',
        !run || !/w:color w:val="9A9A9A"/.test(run));
  check('CPH: AI notice ink is the mockup grey or a contrast override',
        !run || /w:color w:val="(777777|262626|F5F5F5)"/.test(run));
}

// ── legacy (no package) must be untouched ──
const legBuf = await gen({ ...base, style: { headerBg: '1F3A5F', sidebarBg: 'EEF2F6', mainHeadColor: '1F3A5F', sidebarHeadColor: '1F3A5F' } });
const legXml = unzip(legBuf, 'word/document.xml').toString('utf8');
check('LEGACY: section-head rule keeps 1pt (sz 8) in mainHeadColor',
      /w:bottom[^>]*w:color="1F3A5F"[^>]*w:sz="8"/.test(legXml));
check('LEGACY: no grey 777777 rule appears', !/w:bottom[^>]*w:color="777777"/.test(legXml));
{
  const i = legXml.indexOf('Results');
  const run = i > 0 ? legXml.slice(Math.max(0, i - 400), i) : '';
  check('LEGACY: Results lead-in is still italic', /<w:i\/>/.test(run));
  check('LEGACY: Results lead-in has no underline', !/w:u [^>]*w:color="777777"/.test(run));
}
{
  const n = legXml.indexOf('AntCVAiNotice');
  const run = n > 0 ? legXml.slice(n, n + 900) : '';
  check('LEGACY: AI notice keeps 6.5pt (sz 13)', !run || /w:sz w:val="13"/.test(run));
  check('LEGACY: AI notice never takes the copenhagen grey',
        !run || !/w:color w:val="777777"/.test(run));
}

log('\nRESULT: ' + (fails ? fails + ' FAILURE(S)' : 'ALL PASS'));
process.exit(fails ? 1 : 0);
