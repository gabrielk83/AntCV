/* TEMPLATE-DERIVE-001 regression guard.
 *
 * The "Export CV/CL template" buttons must DERIVE their skeleton from the live
 * default builder me() via window._antcvBuildTemplateSkeleton(), blanking every
 * data-bearing value to a bracketed placeholder. This test extracts the helper
 * from BOTH pwa/app.src.js (source) and pwa/app.js (deployed minified bundle),
 * runs each against a realistic seeded skeleton, and asserts:
 *   (a) section id/type/loc/on sequence is preserved exactly,
 *   (b) table row counts + header row, experience role count + on flags +
 *       bullet counts, and richPub are preserved,
 *   (c) NO seeded real-data token leaks into the output, and
 *   (d) the source and minified helpers produce identical output.
 *
 * Run:  node pwa/test/template-derive.test.mjs   (exit 0 = pass)
 */
import fs from 'node:fs';
import vm from 'node:vm';

const srcAll = fs.readFileSync(new URL('../app.src.js', import.meta.url), 'utf8');
const appAll = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');

const srcHelper = srcAll.slice(
  srcAll.indexOf('const _antcvTemplatePlaceholder'),
  srcAll.indexOf('function ge({ onAuth: t })'));
const appHelper = appAll.slice(
  appAll.indexOf('window._antcvBuildTemplateSkeleton=function(){'),
  appAll.indexOf('function Ye({onAuth:e})'));
if (!srcHelper || !appHelper) { console.error('helper not found'); process.exit(1); }

const TOKENS = ['Innoviz', 'Technion', 'BABOK', 'Jane Roe', 'jane.roe@example.com', 'Mobileye', 'IIBA'];
const makeSkel = () => ({
  cv: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Senior PdM at Innoviz, Technion-trained, 10y.' },
    { id: 'work_style', title: 'WORK STYLE', loc: 'main', on: true, type: 'text_inline', content: 'Methodical, hands-on at Innoviz.' },
    { id: 'outcomes', title: 'SELECTED OUTCOMES', loc: 'main', on: true, type: 'bullets', items: [{ b: 'Led', t: 'Innoviz LiDAR program, cut cost 40%' }, { b: 'Shipped', t: '3 products at Mobileye' }] },
    { id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: [['Focus Area', 'Strategic Expertise'], ['Product', 'Innoviz roadmap ownership'], ['Analysis', 'Technion BA rigor']] },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
      { id: 'r1', title: 'Lead PdM', company: 'Innoviz Technologies', years: '2019-2024', on: true, bullets: ['Owned Innoviz X', 'Cut cost 40%'] },
      { id: 'r2', title: 'PM', company: 'Mobileye', years: '2016-2019', on: false, bullets: ['Shipped ADAS'] }] },
    { id: 'pubs', title: 'PUBLICATIONS & PATENTS', loc: 'main', on: true, type: 'list_italic', richPub: true, items: ['Innoviz LiDAR calibration, IEEE 2022'] },
    { id: 'recommendations', title: 'RECOMMENDATIONS', loc: 'main', on: true, type: 'education', items: [{ deg: 'Dr. Jane Roe', sch: 'former manager - jane.roe@example.com' }] },
    { id: 'tbull', title: 'WHAT I WOULD DO', loc: 'main', on: true, type: 'text_bullets', intro: 'At Innoviz I would', items: ['map Innoviz stakeholders', 'validate Technion-style'], closing: 'Help Innoviz win' },
    { id: 'foundation', title: 'FOUNDATION', loc: 'main', on: true, type: 'foundation', hands_on: 'Build at Innoviz', professionally: 'Technion rigor applies' },
    { id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'labeled_list', items: [{ group: 'Methods' }, { l: 'Tools', v: 'BABOK, Jira' }, { l: 'Expertise', v: 'Technion BA' }] },
    { id: 'certs', title: 'CERTIFICATES', loc: 'sidebar', on: true, type: 'list', items: ['BABOK v3 - IIBA 2021', 'PMP'] },
    { id: 'education', title: 'EDUCATION', loc: 'sidebar', on: true, type: 'education', items: [{ deg: 'BSc EE', sch: 'Technion 2014' }] },
  ],
  cl: [
    { id: 'greeting', title: 'GREETING', on: true, type: 'text', content: 'Dear Innoviz team' },
    { id: 'clfound', title: 'FOUNDATION', on: true, type: 'foundation', hands_on: 'Hands-on at Innoviz', professionally: 'Technion rigor' },
  ],
});

function run(helperCode, calleeName) {
  const ctx = { window: {}, console };
  ctx[calleeName] = makeSkel;
  vm.createContext(ctx);
  vm.runInContext(helperCode, ctx);
  return ctx.window._antcvBuildTemplateSkeleton();
}
const seq = (arr) => arr.map((x) => [x.id, x.type, x.loc, x.on]);

function check(name, out) {
  const inp = makeSkel();
  const errs = [];
  for (const col of ['cv', 'cl']) {
    if (JSON.stringify(seq(inp[col])) !== JSON.stringify(seq(out[col]))) errs.push(`${col} id/type/loc/on sequence drift`);
  }
  const ic = inp.cv.find((s) => s.id === 'core_comp'), oc = out.cv.find((s) => s.id === 'core_comp');
  if (oc.rows.length !== ic.rows.length) errs.push('table row count drift');
  if (JSON.stringify(oc.rows[0]) !== JSON.stringify(ic.rows[0])) errs.push('table header row not preserved');
  const ie = inp.cv.find((s) => s.id === 'experience'), oe = out.cv.find((s) => s.id === 'experience');
  if (oe.roles.length !== ie.roles.length) errs.push('role count drift');
  ie.roles.forEach((r, i) => {
    if (oe.roles[i].on !== r.on) errs.push(`role ${i} on flag drift`);
    if ((oe.roles[i].bullets || []).length !== (r.bullets || []).length) errs.push(`role ${i} bullet count drift`);
  });
  if (out.cv.find((s) => s.id === 'pubs').richPub !== true) errs.push('richPub not preserved');
  const grp = out.cv.find((s) => s.id === 'tools').items[0];
  if (!grp || !('group' in grp)) errs.push('labeled_list group row not preserved');
  const blob = JSON.stringify(out);
  for (const t of TOKENS) if (blob.includes(t)) errs.push(`LEAK: token "${t}" present`);
  if (errs.length) { console.error(`[${name}] FAIL`); errs.forEach((x) => console.error('  - ' + x)); }
  else console.log(`[${name}] PASS`);
  return errs.length === 0;
}

const outSrc = run(srcHelper, 'me');
const outApp = run(appHelper, 'Ge');
let ok = check('app.src.js helper', outSrc) && check('app.js helper', outApp);
if (JSON.stringify(outSrc) !== JSON.stringify(outApp)) { console.error('[cross] FAIL: src vs app output differ'); ok = false; }
else console.log('[cross] PASS');
console.log(ok ? 'TEMPLATE-DERIVE OK' : 'TEMPLATE-DERIVE FAILED');
process.exit(ok ? 0 : 1);
