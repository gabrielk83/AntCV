/* DIAGNOSTIC — CONTACT-FULLWIDTH-001 (owner 2026-07-02 "widen the cell"). In BRIDGE
 * (band-overlap photo) mode the candidate contact line was confined to the narrow right
 * split-cell (the left cell reserves the medallion), so a long contact line wrapped and the
 * phone split mid-number. Fix: lift the contact paragraph into its OWN FULL-WIDTH row below
 * name+subtitle. This drives the real worker + asserts, from word/document.xml:
 *   1. bridge: the NAME sits in a NON-gridSpan cell (the split row);
 *   2. bridge: the CONTACT (phone) sits in a gridSpan=2 FULL-WIDTH cell, in a LATER row;
 *   3. control (sidebar-top): name + contact share ONE gridSpan-2 cell (no separate row). */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
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
    personal_info: { name: 'Gabriel Karp-Gershon', email: 'karp.gabriel.a@gmail.com', phone: '+45 31 71 00 72', location: '2300 Kobenhavn S', linkedin: 'linkedin.com/in/gabriel-karp', photo_b64: PHOTO_B64, ...extraPi },
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

// Does the cell enclosing the first occurrence of `needle` carry gridSpan=2?
function cellGridSpan(xml, needle) {
  const i = xml.indexOf(needle); if (i < 0) return null;
  const tc = xml.lastIndexOf('<w:tc>', i), tcEnd = xml.indexOf('</w:tc>', i);
  if (tc < 0 || tcEnd < i) return null;
  return /w:gridSpan w:val="2"/.test(xml.slice(tc, tcEnd));
}
// Are name and phone in DIFFERENT rows? (a </w:tr> sits between them)
function differentRows(xml, a, b) {
  const ia = xml.indexOf(a), ib = xml.indexOf(b);
  if (ia < 0 || ib < 0) return false;
  return xml.slice(Math.min(ia, ib), Math.max(ia, ib)).indexOf('</w:tr>') !== -1;
}

const NAME = 'Gabriel Karp-Gershon', PHONE = '31 71';
const bridge = await gen({ photoPosition: 'band-overlap', photoSizePx: 156 });
const normal = await gen({ photoPosition: 'sidebar-top' });

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

// HEADER-BANNER rule 2 (2026-07-07): the bridge name/spec are now a FULL-WIDTH
// gridSpan=2 centered row (one stack on the contact axis), NOT the old narrow
// split cell — so the name centres on the same page axis as the contact below.
check('bridge: NAME is in a gridSpan=2 full-width centered cell (rule-2 stack)', cellGridSpan(bridge, NAME) === true, 'got ' + cellGridSpan(bridge, NAME));
check('bridge: CONTACT (phone) is in a gridSpan=2 full-width cell', cellGridSpan(bridge, PHONE) === true, 'got ' + cellGridSpan(bridge, PHONE));
check('bridge: contact sits in a LATER row than the name (stacked, both full-width)', differentRows(bridge, NAME, PHONE));
check('control sidebar-top: name + contact share ONE gridSpan-2 cell (same row)', cellGridSpan(normal, NAME) === true && !differentRows(normal, NAME, PHONE));
check('contact text intact (phone digits present)', bridge.includes('31 71'));

const ok = checks.every(Boolean);
log(ok ? 'CONTACT-FULLWIDTH OK' : 'CONTACT-FULLWIDTH FAIL');
process.exit(ok ? 0 : 1);
