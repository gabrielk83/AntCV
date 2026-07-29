/* DIAGNOSTIC — EXPORT-HEADER-COLORS-001 1:1 parity (owner 2026-07-22).
 * Feeds the worker the SAME per-element payload the client fetch-guard emits and
 * asserts the DOCX renders them: header spec=orange, contact/name from style,
 * slogan=blue (slogan_color), the V5 application line in its OWN colour (gray,
 * app_line_color — NOT the slogan colour), and a rule under the app line
 * (app_line_rule -> <w:pBdr><w:bottom w:color=... w:sz=...>).
 * Run: node test/diag-header-elem-colors-parity.mjs */
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
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return Buffer.from(ab);
}

// The payload the client fetch-guard produces for an Ibsen-branded CL.
const payload = {
  schema_version: '1.0', doc: 'cl', language: 'en', layout: 'linear', filename: 't',
  personal_info: { name: 'Gabriel Karp', email: 'g@b.c', phone: '+45 31 71 00 72' },
  meta: {
    subtitle: 'Processes | Products | People', role: 'Systems Engineer', company: 'Ibsen Photonics',
    slogan_color: '1F3A5F',           // deep blue
    app_line_color: '595959',         // muted gray (application line)
    app_line_rule: { on: true, color: 'D97706', pt: 1.5 },   // #6 rule under the app line
    slogan: 'PRODUCT AND PROCESS CLARITY FOR PREDICTABLE DELIVERY',
  },
  style: {
    navy: '#283556', accent: '#D97706', teal: '#00746E',
    headerBg: '283556', headerNameColor: 'FFFFFF', headerSpecColor: 'D97706', headerContactColor: 'FFFFFF',
    mainHeadColor: '00746E',
  },
  font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Team,' },
    { id: 'opening', title: 'Opening', loc: 'main', on: true, type: 'text', content: 'Opening paragraph here.' },
  ],
};

const xml = unzip(await gen(payload), 'word/document.xml').toString('utf8');

// colour of the run whose text contains `needle` (search the last w:color before it)
function colorNear(needle) {
  const pos = xml.indexOf(needle);
  if (pos < 0) return '(text not found: ' + needle + ')';
  const cIdx = xml.lastIndexOf('<w:color w:val="', pos);
  return cIdx < 0 ? '(no colour)' : xml.slice(cIdx + 16, cIdx + 22).toUpperCase();
}
// the app-line paragraph's bottom border (pBdr) near the "Application for" run
function appLineBorder() {
  const pos = xml.indexOf('Application for');
  if (pos < 0) return '(app line not found)';
  // the pPr/pBdr sits BEFORE the run text within the same <w:p>
  const pStart = xml.lastIndexOf('<w:p>', pos) >= 0 ? xml.lastIndexOf('<w:p ', pos) : pos;
  const seg = xml.slice(Math.max(0, pos - 600), pos);
  const bm = /<w:bottom\b[^>]*>/.exec(seg);           // attribute order is not guaranteed
  if (!bm) return '(no bottom border found)';
  const cz = /w:color="([0-9A-Fa-f]{6})"/.exec(bm[0]);
  const sz = /w:sz="(\d+)"/.exec(bm[0]);
  return { sz_eighths: sz ? sz[1] : '', color: cz ? cz[1].toUpperCase() : '' };
}

const name = colorNear('Gabriel Karp');
const spec = colorNear('Processes');            // specialisation subtitle in the band
const appline = colorNear('Application for');    // the V5 application line
const slogan = colorNear('PRODUCT AND PROCESS'); // slogan
const border = appLineBorder();

log('--- EXPORT-HEADER-COLORS-001 parity (DOCX XML) ---');
log('name colour            =', name, name === 'FFFFFF' ? 'PASS (white)' : 'CHECK');
log('specialisation colour  =', spec, spec === 'D97706' ? 'PASS (orange accent)' : 'CHECK');
log('slogan colour          =', slogan, slogan === '1F3A5F' ? 'PASS (deep blue)' : 'CHECK');
log('application colour      =', appline, appline === '595959' ? 'PASS (gray, own colour ≠ slogan)' : 'CHECK');
log('application rule border  =', JSON.stringify(border), (border && border.color === 'D97706' && border.sz_eighths === '12') ? 'PASS (orange, 1.5pt=12/8)' : 'CHECK');
