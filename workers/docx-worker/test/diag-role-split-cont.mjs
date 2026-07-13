/* DIAGNOSTIC — ROLE-SPLIT-CONT-001 (docx-worker 1.14.153).
 * A SINGLE multi-bullet experience role that overflows one page strands its tail
 * bullets on the continuation page with NO "(CONT.)" section header, because the
 * export only stamps CONT on WHOLE-role page increments. Fix: the worker honours a
 * per-BULLET page map `role.bullet_pages` — expanding the role into a head role + a
 * continuation role that the existing experience chunker turns into a top-level
 * "(CONT.)" segment. This drives the LIVE worker fetch handler and asserts:
 *   1. the over-long role emits a TOP-LEVEL page break + "(CONT.)" heading,
 *   2. NO bullet is lost and NONE is duplicated,
 *   3. the tail bullets render AFTER the break,
 *   4. REGRESSION: an identical section WITHOUT bullet_pages renders with NO break
 *      and NO "(CONT.)" (safe-by-construction: inert unless the client forwards it).
 * Run: node test/diag-role-split-cont.mjs */
import { writeSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
const log = (...a) => writeSync(1, a.join(' ') + '\n');

function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  if (i < 0) throw new Error('no EOCD');
  const cdOffset = buf.readUInt32LE(i + 16);
  const nEntries = buf.readUInt16LE(i + 10);
  let p = cdOffset;
  for (let e = 0; e < nEntries; e++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad CD sig');
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const lho = buf.readUInt32LE(p + 42);
    const ename = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (ename === name) {
      const lNameLen = buf.readUInt16LE(lho + 26);
      const lExtraLen = buf.readUInt16LE(lho + 28);
      const dataStart = lho + 30 + lNameLen + lExtraLen;
      const comp = buf.slice(dataStart, dataStart + compSize);
      return method === 0 ? comp : inflateRawSync(comp);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error('entry not found: ' + name);
}
function bodyPageBreaks(xml) {
  const body = xml.slice(xml.indexOf('<w:body'), xml.indexOf('</w:body>'));
  const tokens = body.match(/<\/?w:(tbl|tc)\b|<w:br[^>]*w:type="page"|<w:pageBreakBefore\b/g) || [];
  let depth = 0, n = 0;
  for (const t of tokens) {
    if (t === '<w:tbl') depth++;
    else if (t === '</w:tbl') depth--;
    else if (t === '<w:tc') depth++;
    else if (t === '</w:tc') depth--;
    else if (depth === 0) n++;
  }
  return n;
}
function texts(xml) {
  return (xml.match(/<w:t[ >][^<]*<\/w:t>/g) || []).map(s => s.replace(/<[^>]+>/g, '')).filter(Boolean);
}

const mod = await import('../src/index.js');
async function gen(payload) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const ab = await res.arrayBuffer();
  if (res.status !== 200) throw new Error('status ' + res.status + ': ' + Buffer.from(ab).toString().slice(0, 300));
  return unzipEntry(Buffer.from(ab), 'word/document.xml').toString('utf8');
}

const BUL = (i) => `Delivered outcome number ${i} across the affected teams end to end.`;
const bullets = Array.from({ length: 10 }, (_, k) => BUL(k + 1));
function payload(withPages) {
  const role = { id: 'sirin', title: 'Change Requests Specialist', company: 'Sirin Labs', years: '2020 - 2025', bullets: bullets.slice() };
  if (withPages) role.bullet_pages = { '6': 2 };   // bullets 0-5 page 1, 6-9 page 2
  return {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'Test User', email: 'a@b.c' }, meta: { subtitle: 'S', role: 'R' },
    style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E' }, font_sizes: { mainBody: 10.5 },
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile.' },
      { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [role] },
      { id: 'skills', title: 'CORE SKILLS', loc: 'sidebar', on: true, type: 'list', items: ['A', 'B', 'C'] },
    ],
  };
}

// --- FIXED case: bullet_pages present ---
const fx = await gen(payload(true));
const fxTx = texts(fx);
const joined = fxTx.join(' | ');
const hasCont = /PROFESSIONAL EXPERIENCE \(CONT\.\)/i.test(joined);
const breaks = bodyPageBreaks(fx);
const allBullets = Array.from({ length: 10 }, (_, k) => k + 1)
  .every(n => joined.includes('outcome number ' + n + ' '));
const noDupBullet = Array.from({ length: 10 }, (_, k) => k + 1)
  .every(n => fxTx.filter(t => t.includes('outcome number ' + n + ' ')).length === 1);
const titleOnce = fxTx.filter(t => t.includes('Change Requests Specialist')).length === 1;
const bodyXml = fx.slice(fx.indexOf('<w:body'), fx.indexOf('</w:body>'));
const brkPos = bodyXml.search(/<w:br[^>]*w:type="page"|<w:pageBreakBefore\b/);
const tailPos = bodyXml.indexOf('outcome number 7');   // first tail bullet
const tailAfterBreak = brkPos >= 0 && tailPos > brkPos;
log('FIXED: CONT header:', hasCont, '| body breaks:', breaks, '| all 10 bullets:', allBullets,
    '| no dup:', noDupBullet, '| title once:', titleOnce, '| tail after break:', tailAfterBreak);

// --- REGRESSION case: no bullet_pages -> must be inert ---
const rg = await gen(payload(false));
const rgTx = texts(rg).join(' | ');
const rgCont = /\(CONT\.\)/i.test(rgTx);
const rgBreaks = bodyPageBreaks(rg);
const rgAll = Array.from({ length: 10 }, (_, k) => k + 1).every(n => rgTx.includes('outcome number ' + n + ' '));
log('REGRESSION (no bullet_pages): CONT header:', rgCont, '| body breaks:', rgBreaks, '| all 10 bullets:', rgAll);

const ok =
  hasCont && breaks >= 1 && allBullets && noDupBullet && titleOnce && tailAfterBreak &&
  !rgCont && rgBreaks === 0 && rgAll;
log(ok ? 'ROLE-SPLIT-CONT OK' : 'ROLE-SPLIT-CONT FAIL');
if (!ok) process.exitCode = 1;
