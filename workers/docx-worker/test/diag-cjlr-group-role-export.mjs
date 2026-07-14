/* DIAGNOSTIC — CJLR export parity (worker 1.14.156), mirroring the PWA preview
 * fixes shipped 1.51.1184->1.51.1225. Drives /generate in node and asserts the
 * document.xml jc / structure for:
 *   Fix 1  GROUP-HEAD-JUSTIFY-001      plain rich_block group head honours __group__,
 *                                      justify -> left (single-line can't spread)
 *   Fix 2  FOCUS-TABLE-LEFTCOL-JUSTIFY covered by diag-cjlr-table-export.mjs (left col = both)
 *   Fix 3  GROUP-CJLR-ROLES-001        role line: justify/default = space-between (tab,
 *                                      no jc); L/C/R = grouped (jc set, no tab)
 *   Fix 4  HEADLINE-LOC-PREVIEW-001    section heading honours forwarded headline_align
 *                                      loc-map (main vs sidebar)
 *   +      roleLineStyle / roleLineHr  per-segment colour + under-role rule export
 *   +      grpKeep                     user-made childless group stays visible
 * Run: node test/diag-cjlr-group-role-export.mjs */
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
  throw new Error('entry not found: ' + name);
}

const mod = await import('../src/index.js');
async function gen(extra) {
  const base = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't',
    personal_info: { name: 'G K', email: 'g@b.c' }, meta: { subtitle: 'S' }, style: {}, font_sizes: {},
  };
  const payload = { ...base, ...extra };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  if (res.status !== 200) throw new Error('status ' + res.status + ' ' + buf.toString().slice(0, 200));
  return unzipEntry(buf, 'word/document.xml').toString('utf8');
}

// enclosing <w:p>..</w:p> that contains `text`
function paraSlice(xml, text) {
  const i = xml.indexOf(text);
  if (i < 0) return null;
  let ps = xml.lastIndexOf('<w:p>', i);
  const psAttr = xml.lastIndexOf('<w:p ', i);
  if (psAttr > ps) ps = psAttr;
  const pe = xml.indexOf('</w:p>', i);
  return xml.slice(ps, pe < 0 ? xml.length : pe + 6);
}
function jcOf(xml, text) {
  const i = xml.indexOf(text);
  if (i < 0) return 'NOT FOUND';
  let ps = xml.lastIndexOf('<w:p>', i);
  const psAttr = xml.lastIndexOf('<w:p ', i);
  if (psAttr > ps) ps = psAttr;
  const m = xml.slice(ps, i).match(/<w:jc w:val="(\w+)"\/>/);
  return m ? m[1] : 'none';
}
function present(xml, text) { return xml.indexOf(text) >= 0; }

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail }); log((cond ? 'PASS' : 'FAIL') + ' — ' + name + (detail ? '  [' + detail + ']' : '')); }

// ─── Fix 1: plain rich_block group head honours __group__ (justify -> left) ───
{
  const kids = (t) => [{ grp: true, t }, { b: 'lead', t: 'child body for ' + t }];
  const xml = await gen({ sections: [
    { id: 'gj', title: 'GJ', loc: 'main', on: true, type: 'rich_block', item_alignment: { '__group__': 'justify' }, items: kids('GHJUSTIFY') },
    { id: 'gc', title: 'GC', loc: 'main', on: true, type: 'rich_block', item_alignment: { '__group__': 'center' }, items: kids('GHCENTER') },
    { id: 'gr', title: 'GR', loc: 'main', on: true, type: 'rich_block', item_alignment: { '__group__': 'right' }, items: kids('GHRIGHT') },
    { id: 'gd', title: 'GD', loc: 'main', on: true, type: 'rich_block', items: kids('GHDEFAULT') },
  ] });
  check('group head __group__=justify -> LEFT', jcOf(xml, 'GHJUSTIFY') === 'left', 'jc=' + jcOf(xml, 'GHJUSTIFY'));
  check('group head __group__=center', jcOf(xml, 'GHCENTER') === 'center', 'jc=' + jcOf(xml, 'GHCENTER'));
  check('group head __group__=right', jcOf(xml, 'GHRIGHT') === 'right', 'jc=' + jcOf(xml, 'GHRIGHT'));
  check('group head default (no align) -> CENTER (byte-identical control)', jcOf(xml, 'GHDEFAULT') === 'center', 'jc=' + jcOf(xml, 'GHDEFAULT'));
}

// ─── Fix 3: role line justify(default)=space-between vs L/C/R grouped ───
{
  const xml = await gen({ sections: [
    { id: 'exp', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience',
      item_alignment: { 'roles.1': 'center', 'roles.2': 'right' },
      roles: [
        { title: 'ROLEZERO', company: 'CompZero', years: '2020-2021', bullets: ['bz'] },
        { title: 'ROLEONE', company: 'CompOne', years: '2019', bullets: ['bo'] },
        { title: 'ROLETWO', company: 'CompTwo', years: '2018', bullets: ['bt'] },
      ] },
  ] });
  const p0 = paraSlice(xml, 'ROLEZERO') || '';
  const p1 = paraSlice(xml, 'ROLEONE') || '';
  const p2 = paraSlice(xml, 'ROLETWO') || '';
  // docx emits the years tab as a LITERAL tab char (0x09) inside <w:t xml:space="preserve">,
  // not a <w:tab/> element; the RIGHT tab-stop in pPr still drives it to the edge. L/C/R
  // roles carry NO literal tab (years joined inline with two spaces).
  const TAB = String.fromCharCode(9);
  check('role default -> no jc (space-between)', jcOf(xml, 'ROLEZERO') === 'none', 'jc=' + jcOf(xml, 'ROLEZERO'));
  check('role default -> has literal tab (years tab-right)', p0.includes(TAB), 'tab=' + p0.includes(TAB));
  check('role align=center -> jc=center', jcOf(xml, 'ROLEONE') === 'center', 'jc=' + jcOf(xml, 'ROLEONE'));
  check('role align=center -> NO literal tab (year inline)', !p1.includes(TAB), 'tab=' + p1.includes(TAB));
  check('role align=right -> jc=right', jcOf(xml, 'ROLETWO') === 'right', 'jc=' + jcOf(xml, 'ROLETWO'));
  check('role align=right -> NO literal tab (year inline)', !p2.includes(TAB), 'tab=' + p2.includes(TAB));
  // PREVIEW-BULLET-PARITY-001: a role bullet with no per-bullet override defaults to LEFT (preview parity).
  check('role bullet default -> LEFT (preview parity)', jcOf(xml, 'bz') === 'left', 'jc=' + jcOf(xml, 'bz'));
}

// ─── Fix 4: section heading honours forwarded headline_align loc-map ───
{
  const xml = await gen({ headline_align: { main: 'right', sidebar: 'left' }, sections: [
    { id: 'mh', title: 'MAINHEADX', loc: 'main', on: true, type: 'text', content: 'main body.' },
    { id: 'sh', title: 'SIDEHEADX', loc: 'sidebar', on: true, type: 'text', content: 'side body.' },
  ] });
  check('main heading headline_align.main=right', jcOf(xml, 'MAINHEADX') === 'right', 'jc=' + jcOf(xml, 'MAINHEADX'));
  check('sidebar heading headline_align.sidebar=left', jcOf(xml, 'SIDEHEADX') === 'left', 'jc=' + jcOf(xml, 'SIDEHEADX'));
  // control: no headline_align -> main heading default (no jc)
  const xml2 = await gen({ sections: [{ id: 'mh2', title: 'MAINHEADY', loc: 'main', on: true, type: 'text', content: 'x.' }] });
  check('main heading default (no headline_align) -> no jc', jcOf(xml2, 'MAINHEADY') === 'none', 'jc=' + jcOf(xml2, 'MAINHEADY'));
}

// ─── roleLineStyle (per-seg colour) + roleLineHr (under-role rule) export ───
{
  const xml = await gen({ sections: [
    { id: 'exp', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { title: 'STYLEDROLE', company: 'CoStyled', years: '2022', bullets: ['bs'],
        roleLineStyle: { role: { color: '#FF0000', bold: true } }, roleLineHr: true },
    ] },
  ] });
  const p = paraSlice(xml, 'STYLEDROLE') || '';
  check('roleLineStyle title colour exports (FF0000)', /<w:color w:val="FF0000"\/>/.test(p), 'para=' + /FF0000/.test(p));
  check('roleLineHr draws under-role bottom border', /<w:pBdr>[\s\S]*<w:bottom/.test(p), 'border=' + /<w:pBdr>/.test(p));
  // control: plain role (no roleLineStyle) -> NO bottom border, title in mainHeadColor
  const xml2 = await gen({ sections: [
    { id: 'exp', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { title: 'PLAINROLE', company: 'CoPlain', years: '2021', bullets: ['bp'] } ] } ] });
  const p2 = paraSlice(xml2, 'PLAINROLE') || '';
  // UNDER-ROLE-RULE-ALL-001 (owner 2026-07-15): the under-role rule now draws under
  // EVERY role, so a plain role (no roleLineStyle) carries the border too.
  check('plain role (no roleLineStyle) -> HAS under-role rule (UNDER-ROLE-RULE-ALL-001)', /<w:pBdr>[\s\S]*<w:bottom/.test(p2), 'border=' + /<w:pBdr>/.test(p2));
  // a role may opt OUT of the under-role rule with roleLineHr:false
  const xml3 = await gen({ sections: [
    { id: 'exp', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { title: 'NOHRROLE', company: 'CoNoHr', years: '2020', bullets: ['bn'], roleLineHr: false } ] } ] });
  const p3 = paraSlice(xml3, 'NOHRROLE') || '';
  check('role roleLineHr:false -> NO under-role border', !/<w:pBdr>/.test(p3), 'border=' + /<w:pBdr>/.test(p3));
}

// ─── grpKeep: user-made childless group stays visible; without it, hidden ───
{
  const xml = await gen({ sections: [
    { id: 'gk', title: 'GK', loc: 'main', on: true, type: 'rich_block', items: [{ grp: true, t: 'GRPKEEPHEAD', grpKeep: true }] },
    { id: 'gk2', title: 'GK2', loc: 'main', on: true, type: 'rich_block', items: [{ grp: true, t: 'GRPHIDDENHEAD' }, { b: 'x', t: 'realchild' }] },
  ] });
  check('grpKeep childless group head stays visible', present(xml, 'GRPKEEPHEAD'), 'present=' + present(xml, 'GRPKEEPHEAD'));
  check('non-grpKeep group WITH child still renders head (control)', present(xml, 'GRPHIDDENHEAD'), 'present=' + present(xml, 'GRPHIDDENHEAD'));
}

// ─── GROUP-CJLR-SCOPE-001: __group__ moves GROUP HEADS only, NOT content rows ───
{
  const xml = await gen({ sections: [
    { id: 'gs', title: 'GS', loc: 'main', on: true, type: 'rich_block', item_alignment: { '__group__': 'right' },
      items: [{ grp: true, t: 'SCOPEHEAD' }, { b: 'L', t: 'scoped content row body' }] },
    { id: 'es', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', item_alignment: { '__group__': 'right' },
      roles: [{ title: 'SCOPEROLE', company: 'CoS', years: '2020', bullets: ['scoped role bullet body'] }] },
  ] });
  check('__group__=right moves the rich_block GROUP HEAD', jcOf(xml, 'SCOPEHEAD') === 'right', 'jc=' + jcOf(xml, 'SCOPEHEAD'));
  check('__group__ does NOT move rich_block content row (grouped default left)', jcOf(xml, 'scoped content row body') === 'left', 'jc=' + jcOf(xml, 'scoped content row body'));
  check('__group__=right moves the experience ROLE LINE (head)', jcOf(xml, 'SCOPEROLE') === 'right', 'jc=' + jcOf(xml, 'SCOPEROLE'));
  // PREVIEW-BULLET-PARITY-001: role bullet default is LEFT (preview parity); __group__ still does not move it.
  check('__group__ does NOT move role bullet (stays LEFT default)', jcOf(xml, 'scoped role bullet body') === 'left', 'jc=' + jcOf(xml, 'scoped role bullet body'));
}

const fails = results.filter((r) => !r.ok);
log('');
log(fails.length === 0 ? ('ALL ' + results.length + ' CHECKS PASS — CJLR-GROUP-ROLE-EXPORT OK') : (fails.length + '/' + results.length + ' CHECKS FAIL'));
process.exit(fails.length === 0 ? 0 : 1);
