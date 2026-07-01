/* DIAGNOSTIC — AI-NOTICE-POSITION-CONTROL-001 (worker 1.14.114). The Layout control pins the notice
 * corner via payload.ai_notice_pos ('left'|'center'|'right'), which must OVERRIDE the auto larger-gap
 * logic. Owner reported the export kept the notice on the RIGHT despite choosing LEFT — this drives
 * the real fetch handler and asserts the manual override wins for all three positions. */
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

async function build(extra) {
  // A CV whose LAST page has an empty-ish sidebar so the AUTO logic would tend toward one side;
  // the manual ai_notice_pos must override regardless.
  const payload = Object.assign({
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
    sections: [
      { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Profile text.' },
      { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
        { id: 'r0', title: 'Change Control Lead', company: 'Innoviz', years: '2020-2025', bullets: ['Owned the governance loop.'] },
        { id: 'r1', title: 'Optics Engineer', company: 'Sirin', years: '2014-2017', page: 2, bullets: ['Led the optics stack on page two.'] },
      ] },
      { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'E', v: 'P' }, { l: 'F', v: 'Q' }, { l: 'G', v: 'R' }] },
    ],
  }, extra);
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status !== 200) { log('status', res.status, buf.toString().slice(0, 200)); process.exit(1); }
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const ni = xml.indexOf('AntCVAiNotice');
  const shape = ni >= 0 ? xml.slice(ni, xml.indexOf('</v:rect>', ni) + 9) : '';
  const m = shape.match(/margin-left:(\d+)pt/);
  const ml = m ? Number(m[1]) : null;
  const horiz = ml === 0 ? 'left' : (ml != null && ml < 200) ? 'center' : (ml != null ? 'right' : null);
  return { horiz, ml, sentinelLeft: xml.indexOf('__ANTCV_AIWM_') };
}

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

// AUTO (no manual pos) now defaults to the SIDEBAR side (AI-NOTICE-AUTO-SIDEBAR-001).
const auto = await build({});
log(`auto (no ai_notice_pos, sidebar left) -> ${auto.horiz}`);
check('auto defaults to the sidebar side (left)', auto.horiz === 'left', `got ${auto.horiz}`);
const autoR = await build({ style: { sidebarPosition: 'right' } });
check('auto follows a right sidebar', autoR.horiz === 'right', `got ${autoR.horiz}`);
// auto must ignore a stale ai_wm_side hint (it was unreliable) — sidebar still wins
const autoHint = await build({ ai_wm_side: 'right' });
check('auto ignores ai_wm_side hint -> still sidebar (left)', autoHint.horiz === 'left', `got ${autoHint.horiz}`);

const left = await build({ ai_notice_pos: 'left' });
check("manual 'left' forces left", left.horiz === 'left', `got ${left.horiz}`);
check("manual 'left' consumed the sentinel", left.sentinelLeft < 0);

const center = await build({ ai_notice_pos: 'center' });
check("manual 'center' forces center", center.horiz === 'center', `got ${center.horiz}`);

const right = await build({ ai_notice_pos: 'right' });
check("manual 'right' forces right", right.horiz === 'right', `got ${right.horiz}`);

// the reported bug: even if the auto hint says right, manual left must win
const conflict = await build({ ai_notice_pos: 'left', ai_wm_side: 'right' });
check("manual 'left' overrides ai_wm_side:'right'", conflict.horiz === 'left', `got ${conflict.horiz}`);

const ok = checks.every(Boolean);
log(ok ? 'AI-NOTICE-POS OK' : 'AI-NOTICE-POS FAIL');
process.exit(ok ? 0 : 1);
