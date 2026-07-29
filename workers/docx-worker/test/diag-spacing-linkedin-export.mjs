/* DIAGNOSTIC — owner batch 2026-06-12 evening (worker 1.14.60):
 *  A. ADV-SPACING-CONTROLS-001 — forwarded spacing tokens move the cell
 *     margins / heading spacing; absent tokens keep the reviewed defaults.
 *  B. LINKEDIN-CLICK-001 — the LinkedIn contact renders as a real
 *     w:hyperlink with an external relationship; other bits stay plain.
 *  C. NO-JUSTIFY-GAPS-001 — sidebar labeled_list rows no longer carry
 *     jc="both" (justified) by default.
 * Drives the real fetch handler. */
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
const basePayload = (style) => ({
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
  personal_info: { name: 'G K', email: 'g@b.c', linkedin: 'linkedin.com/in/gabriel-karp', location: '2300, København S' },
  meta: { subtitle: 'Processes • Products • People' }, style: style || {}, font_sizes: {},
  sections: [
    // PROFILE is the FIRST main heading (before=0 per PROFILE-TOPGAP-001, 5e89d67); the
    // gap-driven before spacing (80 default / 200 at mainSectionGap 16) only applies to a
    // SUBSEQUENT main heading, so EXPERIENCE is here to exercise the formula.
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'P.' },
    { id: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, type: 'text', content: 'E.' },
    { id: 'tools', title: 'TOOLS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ l: 'Engineering', v: 'Python, MATLAB, LabVIEW and a long enough value to wrap lines' }] },
  ],
});
async function gen(style) {
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(basePayload(style)) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status !== 200) { log('status', res.status, buf.toString().slice(0, 300)); process.exit(1); }
  return {
    xml: unzipEntry(buf, 'word/document.xml').toString('utf8'),
    rels: unzipEntry(buf, 'word/_rels/document.xml.rels').toString('utf8'),
  };
}

const checks = [];
const check = (n, ok, d) => { checks.push(ok); log(`${n}: ${ok ? 'OK' : 'FAIL'}${ok ? '' : ' ' + (d || '')}`); };

// ── default run ──
const def = await gen({});
check('B. hyperlink element present', /<w:hyperlink [^>]*r:id="/.test(def.xml));
check('B. external rel targets linkedin URL', /Target="https:\/\/linkedin\.com\/in\/gabriel-karp"[^>]*TargetMode="External"|TargetMode="External"[^>]*Target="https:\/\/linkedin\.com\/in\/gabriel-karp"/.test(def.rels), def.rels.slice(0, 400));
{
  const li = def.xml.indexOf('linkedin.com/in/gabriel-karp');
  const rStart = def.xml.lastIndexOf('<w:r>', li);
  check('B. linkedin run underlined', /<w:u /.test(def.xml.slice(rStart, li)), def.xml.slice(rStart, li).slice(0, 200));
}
{
  // C: the sidebar labeled_list value paragraph carries NO jc="both"
  const vi = def.xml.indexOf('long enough value to wrap');
  const pStart = Math.max(def.xml.lastIndexOf('<w:p>', vi), def.xml.lastIndexOf('<w:p ', vi));
  const seg = def.xml.slice(pStart, vi);
  check('C. sidebar row not justified', !/<w:jc w:val="both"\/>/.test(seg), seg.slice(0, 240));
}
check('A. default sidebar cell margins 120', def.xml.includes('<w:left w:type="dxa" w:w="120"/>'), 'no 120 left tcMar');

// ── spacing-forwarded run ──
const sp = await gen({ sidebarEdgePad: 12, seamGap: 10, bodyEdgePad: 12, mainSectionGap: 16, candidateGap: 7 });
check('A. sidebarEdgePad 12 -> tcMar left 180', sp.xml.includes('<w:left w:type="dxa" w:w="180"/>'), 'missing 180');
check('A. seamGap 10 -> main seam-side margin 300 (150+150)', sp.xml.includes('<w:left w:type="dxa" w:w="300"/>'), 'missing 300');
check('A. bodyEdgePad 12 -> sidebar top 300 (240+60)', sp.xml.includes('<w:top w:type="dxa" w:w="300"/>'), 'missing top 300');
// mainSectionGap 16 -> heading before = 80 + (16-8)*15 = 200
check('A. mainSectionGap 16 -> heading before 200', /<w:spacing [^>]*w:before="200"/.test(sp.xml), 'missing before=200');
// candidateGap 7 -> subtitle after = 60 + (7-3)*15 = 120
check('A. candidateGap 7 -> subtitle after 120', /<w:spacing [^>]*w:after="120"/.test(sp.xml), 'missing after=120');
// defaults intact on the default run: heading before=80
check('A. default heading before stays 80', /<w:spacing [^>]*w:before="80"/.test(def.xml));

const ok = checks.every(Boolean);
log(ok ? 'SPACING-LINKEDIN-EXPORT OK' : 'SPACING-LINKEDIN-EXPORT FAIL');
process.exit(ok ? 0 : 1);
