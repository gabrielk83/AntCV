/* DIAGNOSTIC — PUB-KEEP-WHOLE-001 (owner 2026-07-02: "Publications & Patents should not have
 * been left with just one line on page 4 — should have been entirely on page 5"). Confirmed
 * against a real export: the section heading landed with only a sliver of room on the page,
 * and the first citation's own text then split mid-sentence across the page boundary. Fix:
 * (a) the SAME proven body-row cantSplit mechanism used for short SIDEBAR sections now also
 * covers a Publications-like MAIN-column section, so a short list moves WHOLE to the next
 * page instead of stranding 1-2 lines; (b) each citation paragraph gets keepLines so it can
 * never itself split mid-text. Drives the real fetch handler + inspects word/document.xml for
 * the w:cantSplit / w:keepLines OOXML markers. */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');
function unzipEntry(buf, name){let i=buf.length-22;for(;i>=0;i--)if(buf.readUInt32LE(i)===0x06054b50)break;const cd=buf.readUInt32LE(i+16),n=buf.readUInt16LE(i+10);let p=cd;for(let e=0;e<n;e++){const cs=buf.readUInt32LE(p+20),nl=buf.readUInt16LE(p+28),xl=buf.readUInt16LE(p+30),cl=buf.readUInt16LE(p+32),lho=buf.readUInt32LE(p+42),nm=buf.toString('utf8',p+46,p+46+nl);if(nm===name){const ln=buf.readUInt16LE(lho+26),lx=buf.readUInt16LE(lho+28);const d=buf.slice(lho+30+ln+lx,lho+30+ln+lx+cs);return buf.readUInt16LE(p+10)===0?d:inflateRawSync(d);}p+=46+nl+xl+cl;}return null;}
const mod = await import('../src/index.js');
async function build(payload){const req=new Request('https://x/generate',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const res=await mod.default.fetch(req,{},{waitUntil(){},passThroughOnException(){}});const buf=Buffer.from(await res.arrayBuffer());if(res.status!==200){log('status',res.status,buf.toString().slice(0,200));process.exit(1);}return unzipEntry(buf,'word/document.xml').toString('utf8');}

const CITES = [
  'Integration of Suspended Carbon Nanotubes into Micro-Fabricated Devices - Gabriel A. Karp et al., J. Micromechanics & Microengineering, 2009',
  'Carbon Nanotube Integration Procedures into NEMS Devices - Gabriel A. Karp et al., Eurosensors Conference Proceedings (poster), 2008',
  "A Nanomanipulator with Integrated Mechanical De-amplifier - Ya'akobovitz, A., Karp, G.A., Hanein, Y., Krylov, S., Microsystem Technologies, 2010",
  'Patent No. 241997 - Co-inventor - cover-window geometry reducing optical crosstalk between adjacent sensors',
];

function payload(loc) { return {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'Gabriel Karp', email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
    { id: 'publications', title: 'PUBLICATIONS & PATENTS', loc, on: true, type: 'list_italic', items: CITES },
  ],
};}

const mainXml = await build(payload('main'));
const sidebarXml = await build(payload('sidebar'));

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

// The Publications heading's TableRow is followed by the body TableRow; the body row must
// carry cantSplit for a MAIN-column publications section (the owner's real layout).
const pubIdx = mainXml.indexOf('PUBLICATIONS');
const nearPub = pubIdx >= 0 ? mainXml.slice(pubIdx, pubIdx + 4000) : '';
check('MAIN publications: body row carries w:cantSplit', /<w:cantSplit\/>/.test(nearPub), 'no cantSplit near the Publications heading');

// Each citation paragraph carries keepLines (w:keepLines in its pPr).
const citeCount = (nearPub.match(/<w:keepLines\/>/g) || []).length;
check('MAIN publications: every citation paragraph carries w:keepLines (>=' + CITES.length + ')', citeCount >= CITES.length, 'found ' + citeCount);

// Sidebar publications already had cantSplit before this fix (regression guard).
const pubIdxSb = sidebarXml.indexOf('PUBLICATIONS');
const nearPubSb = pubIdxSb >= 0 ? sidebarXml.slice(pubIdxSb, pubIdxSb + 4000) : '';
check('SIDEBAR publications: still carries w:cantSplit (no regression)', /<w:cantSplit\/>/.test(nearPubSb));

// All citation text is present (content untouched by the layout change).
check('citation text intact', mainXml.includes('Integration of Suspended Carbon Nanotubes'));

const ok = checks.every(Boolean);
log(ok ? 'PUB-KEEP-WHOLE OK' : 'PUB-KEEP-WHOLE FAIL');
process.exit(ok ? 0 : 1);
