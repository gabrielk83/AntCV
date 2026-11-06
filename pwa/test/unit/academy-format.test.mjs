// academy-format.test.mjs
// ============================================================
// ACADEMY-FORMAT-001 (owner 2026-11-05: "make sure the application fully match
// academy format - for sidebars, for profile bullets number etc..."). The house
// margin package (pkgs_1051.py / pkgs_1050.py) is the shape of record. An audit of
// saved application #3491 (Kaleido, margin, da) found 9 roles with 4+ bullets,
// English Results / labels / header in a Danish CV, 12 tools rows, 10 certificates,
// English-first languages, 6 interest rows, publications + regulatory + outcomes
// blocks, 5 pages. The fixture below has the same shape (synthetic text).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};
const require = createRequire(import.meta.url);
const AF = require('../../antcv-academy-format.js');
const { buildPayload, applyOutcomesMode } = await import('../../antcv-docx-client.js');
const gold = JSON.parse(readFileSync(new URL('../../gold-rules.json', import.meta.url), 'utf8'));
const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

const JD = 'Senior Optical Design Engineer at Kaleido. Zemax optical design, tolerancing, metrology, test rigs, '
  + 'interferometry, design for manufacture, ISO 10110 drawings, MATLAB and Python scripting.';
const NAME = 'Gabriel Alexander Karp Gershon';

function role(id, title, company, years, n, extra) {
  const bullets = [];
  for (let i = 0; i < n; i++) bullets.push('Byggede testopstilling nummer ' + (i + 1) + ' til ' + company + ' og fulgte data op med teamet.');
  return Object.assign({ id, title, company, years, on: true, bullets }, extra || {});
}
function fixture() {
  return [
    { id: 'profile', type: 'rich_block', loc: 'main', on: true, title: 'PROFIL', items: [{ b: '', t: 'IT-professionel med 15+ års erfaring i kommercielle og regulerede markeder, og jeg bygger relationer på tværs af teknik.' }] },
    { id: 'work_style', type: 'rich_block', loc: 'main', on: true, title: 'Arbejdsstil', items: [{ b: 'Work style', t: 'Rolige, strukturerede beslutninger ud fra målte data og klare skriftlige resultater.' }] },
    { id: 'core_comp', type: 'table', loc: 'main', on: true, title: 'KERNEKOMPETENCER', rows: [['The role needs', 'What I bring, with proof'], ['Kravanalyse', 'Systemkrav og sporbarhed med validering']] },
    { id: 'outcomes', type: 'bullets', loc: 'main', on: true, title: 'UDVALGTE RESULTATER', items: [{ b: 'Ændringscyklus', t: 'fra ca. 250 til ca. 10 dage via struktureret CCB og konsekvensanalyse' }] },
    { id: 'experience', type: 'experience', loc: 'main', on: true, title: 'PROFESSIONEL ERFARING', roles: [
      role('trackman', 'Projektleder, hardwareudvikling og leverandører', 'Trackman A/S', '2026 - nu', 3, { isCurrent: true }),
      role('kanzen', 'Produkt- og projektekspert', 'Kanzen Konsulenter ApS', '2022 - 2026', 7),
      role('innoviz-ccr', 'Ansvarlig for ændringsanmodninger', 'Innoviz Technologies', '2020 - 2025', 10),
      role('innoviz-sa', 'Systemarkitekt', 'Innoviz Technologies', '2017 - 2020', 10),
      role('sirin', 'Senioringeniør i optik og elektrooptik', 'Sirin Labs', '2014 - 2017', 6),
      role('mepro-tl', 'Teamleder for elektrooptik', 'Meprolight, IWI Group', '2013 - 2014', 5),
      role('mepro-eng', 'Udviklingsingeniør i elektrooptik', 'Meprolight, IWI Group', '2010 - 2013', 4),
      role('tau-security', 'Vagt i studenterboliger', 'Tel Aviv University', '2010', 3, { on: false }),
      role('tau-research', 'Videnskabelig assistent', 'Tel Aviv University', '2007 - 2010', 6),
      role('tau-teaching', 'Undervisningsassistent', 'Tel Aviv University', '2006 - 2010', 1),
    ] },
    { id: 'pubs', type: 'list_italic', loc: 'main', on: true, title: 'PUBLIKATIONER OG PATENTER', items: [
      'Integration of Suspended Carbon Nanotubes into Micro-Fabricated Devices - J. Micromech. Microeng., 2009',
      'Patent nr. 241997 - medopfinder - dækglasgeometri, der mindsker optisk krydstale mellem nabosensorer'] },
    { id: 'proof_points', type: 'rich_block', loc: 'sidebar', on: true, title: 'Resultater i tal', items: [
      { b: '250 → 10 dage', t: 'ændringscyklus' }, { b: '10x', t: 'lavere enhedspris' }, { b: '20 MP', t: 'kamera leveret' },
      { b: '4 lande', t: 'leverandører kvalificeret' }, { b: '~3.400', t: 'krav verificeret' }, { b: '150', t: 'brugere af FMEA-platformen' }] },
    { id: 'tools', type: 'rich_block', loc: 'sidebar', on: true, title: 'VÆRKTØJER OG METODER', items: [
      { grp: true, t: 'Ekspertise' },
      { b: 'Optik, fotonik og sensorer', t: 'optisk design, stray light, tolerancer' },
      { b: 'Produkt og systemer', t: 'systemarkitektur, krav og sporbarhed, ændringsstyring' },
      { grp: true, t: 'Værktøjer' },
      { b: 'Software', t: 'Qualcomm ISP tools, Zemax, Microsoft Copilot, GitHub Copilot, Jira, MATLAB, Confluence, Python, Codebeamer ALM, Power BI' },
      { b: 'Instrumenter', t: 'konfokal billeddannelse, interferometri, optiske borde' },
      { grp: true, t: 'Metoder' },
      { b: 'Kvalitet og proces', t: 'Design of Experiments, Six Sigma Black Belt, FMEA, Gage R&R' },
      { b: 'Validering', t: 'processtyring, produktionsnær validering' },
      { b: 'Laboratorium', t: 'maskedesign, mikrooptik' }] },
    { id: 'certs', type: 'rich_block', loc: 'sidebar', on: true, title: 'CERTIFICERINGER OG KURSER', items: [
      { b: '', t: 'AI-praktiker (Teknologisk Institut)' }, { b: '', t: 'Business Analysis / BABOK (University of Toronto, 2020)' },
      { b: '', t: 'Six Sigma Black Belt (CSSC)' }, { b: '', t: 'FMEA & APIS (Wanders Eng., 2018)' },
      { b: '', t: 'Prøve i dansk 2 (Studieskolen)' }, { b: '', t: 'World Rugby niveau 1 (2024)' },
      { b: '', t: 'Projektledelse & digitalisering (Improve Business Academy, 2026)' }] },
    { id: 'education', type: 'education', loc: 'sidebar', on: true, title: 'UDDANNELSE', items: [{ deg: 'M.Sc. i elektroteknik', sch: 'Tel Aviv University' }] },
    { id: 'regulatory', type: 'rich_block', loc: 'sidebar', on: true, title: 'REGULATORISK KONTEKST', items: [
      { grp: true, t: 'Billeddannelse' }, { b: 'ISO 12233', t: 'Opløsning' }, { b: 'ISO 10110', t: 'Optiske tegninger' }, { b: 'IEC 60825-1', t: 'Lasersikkerhed' }] },
    { id: 'languages', type: 'labeled_list', loc: 'sidebar', on: true, title: 'SPROG', items: [
      { l: 'English', v: 'native / fluent' }, { l: 'Danish', v: 'intermediate (B2)' }, { l: 'Spanish', v: 'professional' }, { l: 'Hebrew', v: 'native' }] },
    { id: 'interests', type: 'rich_block', loc: 'sidebar', on: true, title: 'INTERESSER', items: [
      { b: 'Rugby & inkluderende sport', t: 'Holdopgaver og hjælp til træneren' }, { b: 'Tai-chi', t: 'Ro under pres' },
      { b: 'Kulturel udveksling', t: 'Sprog, mad og brætspil' }, { b: 'Vandring', t: 'Udendørs restitution' },
      { b: 'Læse', t: 'Teknologi og samfund' }, { b: 'Opsyn', t: 'Tre katte, eksperter i strategisk lur' }] },
    { id: 'accessibility', type: 'labeled_list', loc: 'sidebar', on: true, title: 'KOMMUNIKATION', items: [{ l: '', v: 'Engelsk og dansk i arbejdet; liveundertekster og skriftlig opfølgning i møder.' }] },
    { id: 'additional', type: 'labeled_list', loc: 'sidebar', on: true, title: 'YDERLIGERE OPLYSNINGER', items: [{ l: 'Forskning', v: 'Google Scholar' }] },
  ];
}
const DA = { lang: 'da', jdText: JD, company: 'Kaleido Technology', name: NAME, nowYear: 2026 };
const byId = (list, id) => list.find((s) => s && s.id === id);
const shown = (s) => (s.items || []).filter((it, i) => !(it && it.hidden) && !(s.hidden && s.hidden[i]));

test('RULES mirror gold-rules academy_format (one control site)', () => {
  for (const [k, v] of Object.entries(AF.RULES)) assert.deepEqual(gold.academy_format[k], v, k);
  assert.ok(gold.prompt_block.some((l) => /ACADEMY-FORMAT-001/.test(l)), 'prompt line present');
});

test('langOf judges sentences, never short captions', () => {
  assert.equal(AF.langOf('Directed the Change Control Board, cutting the change cycle from roughly 250 days to about 10 days'), 'en');
  assert.equal(AF.langOf('fra ca. 250 til ca. 10 dage via struktureret CCB og konsekvensanalyse'), 'da');
  assert.equal(AF.langOf('Reduje el ciclo de cambios de 250 a 10 días con un comité para los clientes'), 'es');
  assert.equal(AF.langOf('simplifying reporting'), '');
  assert.equal(AF.langOf('10x'), '');
  assert.equal(AF.wrongLang('Supplier qualification for the camera and display stack cut rejected parts by 50%.', 'da'), true);
  assert.equal(AF.wrongLang('Leverandørkvalificering af kamera og skærm halverede de afviste dele.', 'da'), false);
});

test('experience: 6 detailed roles + Earlier career, 3 bullets each, stored facts untouched', () => {
  const src = fixture();
  const { sections } = AF.apply(src, DA);
  const ex = byId(sections, 'experience');
  const vis = ex.roles.filter((r) => r.on !== false);
  const detailed = vis.filter((r) => r.id !== 'earlier-career');
  assert.deepEqual(detailed.map((r) => r.id), ['trackman', 'kanzen', 'innoviz-ccr', 'innoviz-sa', 'sirin', 'mepro-tl']);
  for (const r of detailed) assert.ok(r.bullets.length <= 3, r.id);
  const ec = vis.find((r) => r.id === 'earlier-career');
  assert.equal(ec.title, 'Tidligere karriere');
  assert.deepEqual(ec.bullets, [
    'Udviklingsingeniør i elektrooptik, Meprolight, IWI Group (2010 - 2013)',
    'Videnskabelig assistent / Undervisningsassistent, Tel Aviv University (2006 - 2010)']);
  assert.deepEqual(ec.__covers.sort(), ['mepro-eng', 'tau-research', 'tau-teaching']);
  // index-keyed payload maps stay valid: original roles keep their slots, EC is appended
  assert.equal(ex.roles.length, src[4].roles.length + 1);
  src[4].roles.forEach((r, i) => { assert.equal(ex.roles[i].id, r.id); assert.equal(ex.roles[i].title, r.title); assert.equal(ex.roles[i].years, r.years); });
  // the input is never mutated
  assert.equal(src[4].roles[1].bullets.length, 7);
});

test('a research JD keeps the university roles and the publications', () => {
  const { sections } = AF.apply(fixture(), Object.assign({}, DA, { jdText: 'PhD research position, peer-reviewed publications in photonics' }));
  const ex = byId(sections, 'experience');
  assert.notEqual(ex.roles.find((r) => r.id === 'tau-research').on, false);
  assert.notEqual(ex.roles.find((r) => r.id === 'tau-teaching').on, false);
  assert.notEqual(byId(sections, 'pubs').on, false);
});

test('a degree named in a commercial JD ("MSc or PhD in optics") is not a research job', () => {
  const { sections } = AF.apply(fixture(), Object.assign({}, DA, { jdText: JD + ' You hold an MSc or PhD in optics or physics.' }));
  assert.equal(byId(sections, 'pubs').on, false);
  assert.equal(byId(sections, 'experience').roles.find((r) => r.id === 'tau-research').on, false);
  const titled = AF.apply(fixture(), Object.assign({}, DA, { role: 'Research Scientist, Photonics' })).sections;
  assert.notEqual(byId(titled, 'pubs').on, false, 'a research title is enough');
});

test('a bullet over two lines keeps its first sentence or clause; never extended', () => {
  const s = fixture();
  s[4].roles[4].bullets = [
    'Satte det optiske karakteriseringslaboratorium op for kamera og skærm hos ODM-partneren i Sverige. Jeg definerede accepttests for indgående og udgående optiske enheder og fulgte resultaterne op.',
    'Kort punkt med data.'];
  const r = byId(AF.apply(s, DA).sections, 'experience').roles.find((x) => x.id === 'sirin');
  assert.equal(r.bullets[0], 'Satte det optiske karakteriseringslaboratorium op for kamera og skærm hos ODM-partneren i Sverige.');
  assert.equal(r.bullets[1], 'Kort punkt med data.');
});

test('internship note: an English prefix next to a Danish "Praktik:" bullet is dropped', () => {
  const s = fixture();
  s[4].roles[0].bullets = ['Internship: 2-4 faser med hardware-review som porte.', 'Praktik: Ejer skabelonen for leverandørprojekter.'];
  const r = byId(AF.apply(s, DA).sections, 'experience').roles[0];
  assert.deepEqual(r.bullets, ['2-4 faser med hardware-review som porte.', 'Praktik: Ejer skabelonen for leverandørprojekter.']);
  s[4].roles[0].bullets = ['Internship: 2-4 faser med hardware-review som porte.'];
  assert.equal(byId(AF.apply(s, DA).sections, 'experience').roles[0].bullets[0], 'Praktik: 2-4 faser med hardware-review som porte.');
});

test('sidebar counts match 1051: 5 proof points, 4 tools rows, 4 certificates', () => {
  const { sections } = AF.apply(fixture(), DA);
  assert.equal(shown(byId(sections, 'proof_points')).length, 5);
  const tools = shown(byId(sections, 'tools'));
  assert.equal(tools.length, 4);
  assert.ok(tools.every((it) => !it.grp), 'no group header rows');
  assert.ok(tools.every((it) => it.t.split(/\s*,\s*/).length <= 6));
  assert.ok(tools.some((it) => /Zemax/.test(it.t) && /MATLAB/.test(it.t) && /Python/.test(it.t)), 'JD tools survive the item cap');
  const certs = shown(byId(sections, 'certs')).map((it) => it.t);
  assert.equal(certs.length, 4);
  assert.ok(certs.includes('Projektledelse & digitalisering (Improve Business Academy)'), 'current course kept, year stripped');
  assert.ok(!certs.some((t) => /Prøve i dansk|Rugby/.test(t)), 'language test + rugby course out for a non-sports JD');
});

test('languages: Danish first, names and levels in the CV language', () => {
  const lang = shown(byId(AF.apply(fixture(), DA).sections, 'languages'));
  assert.deepEqual(lang.map((it) => it.l + ': ' + it.v), ['Dansk: mellemniveau (B2)', 'Engelsk: modersmål / flydende', 'Spansk: professionelt', 'Hebraisk: modersmål']);
  const en = shown(byId(AF.apply(fixture(), Object.assign({}, DA, { lang: 'en' })).sections, 'languages'));
  assert.deepEqual(en.map((it) => it.l), ['Danish', 'English', 'Spanish', 'Hebrew']);
});

test('interests: the Foreningsarbejde rugby row + one strip (RUGBY-ROW-001)', () => {
  const rows = shown(byId(AF.apply(fixture(), DA).sections, 'interests'));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].b, 'Foreningsarbejde');
  assert.match(rows[0].t, /^Rugby team Operations Manager & trænerassistent, Copenhagen Wolves RFC/);
  assert.match(rows[1].t, /^Tai-chi \(stabilitet og ro under pres\) · vandreture/);
  // another candidate: their own rows, compacted the same way
  const other = shown(byId(AF.apply(fixture(), Object.assign({}, DA, { name: 'Anita Example' })).sections, 'interests'));
  assert.equal(other.length, 2);
  assert.equal(other[0].b, 'Rugby & inkluderende sport');
  assert.equal(other[1].t, 'Tai-chi (ro under pres) · Kulturel udveksling (sprog, mad og brætspil) · Vandring (udendørs restitution) · Læse (teknologi og samfund)');
});

test('labels in the CV language: Work style lead and the table header', () => {
  const { sections } = AF.apply(fixture(), DA);
  assert.equal(byId(sections, 'work_style').items[0].b, 'Arbejdsstil');
  assert.deepEqual(byId(sections, 'core_comp').rows[0], ['Rollen kræver', 'Det bringer jeg, med belæg']);
  const en = AF.apply(fixture(), Object.assign({}, DA, { lang: 'en' })).sections;
  assert.equal(byId(en, 'work_style').items[0].b, 'Work style');
  assert.deepEqual(byId(en, 'core_comp').rows[0], ['The role needs', 'What I bring, with proof']);
});

test('blocks outside the house CV are hidden; the patent moves to a sidebar row after education', () => {
  const { sections } = AF.apply(fixture(), DA);
  for (const id of ['outcomes', 'pubs', 'additional']) assert.equal(byId(sections, id).on, false, id);
  const reg = byId(sections, 'regulatory');
  assert.deepEqual(shown(reg).filter((it) => !it.grp).map((it) => it.b), ['ISO 10110'], 'only the standard the JD names');
  const ids = sections.map((s) => s.id);
  assert.equal(ids[ids.indexOf('education') + 1], 'patent');
  assert.match(byId(sections, 'patent').items[0].t, /^Patent nr\. 241997/);
});

test('audit: the fixture fails every house count; after apply only content issues remain', () => {
  const before = new Set(AF.audit(fixture(), DA).issues.map((i) => i.code));
  for (const c of ['ROLES', 'BULLETS', 'PROOF_POINTS', 'TOOLS', 'CERTS', 'INTERESTS', 'LANG_ORDER', 'LANG', 'SECTION', 'PROFILE_GENERIC']) assert.ok(before.has(c), c);
  const after = AF.audit(AF.apply(fixture(), DA).sections, DA).issues.map((i) => i.code);
  assert.deepEqual([...new Set(after)], ['PROFILE_GENERIC'], 'a profile that never names Kaleido is stale or generic');
});

test('audit flags an English Results line in a Danish CV', () => {
  const s = fixture();
  s[4].roles[4].results = 'Supplier qualification for the camera and display stack cut rejected parts by 50%.';
  assert.ok(AF.audit(s, DA).issues.some((i) => i.code === 'LANG' && /sirin\.results/.test(i.where)));
});

// ── ACADEMY-EMPTY-001: no heading without real content, no template rows, no other person's rows
const ANITA = { name: 'Anita Myre-Kornfeldt', education: [{ deg: 'BSc-equivalent in Seasonal Resource Management', sch: 'Institute of Logistics' }] };
const GABRIEL_PI = { name: NAME, accessibility: 'English and Danish at work; live captions and written follow-ups in meetings.' };
function skeletonish() {
  // the owner's margin preview of 2026-11-06, as stored sections
  return [
    { id: 'profile', type: 'rich_block', loc: 'main', on: true, title: 'PROFILE', items: [{ b: '', t: 'I run logistics for colonies through hard winters, with written contingency plans.' }] },
    { id: 'experience', type: 'experience', loc: 'main', on: true, title: 'EXPERIENCE', roles: [{ id: 'r1', title: 'Logistics Lead', company: 'HiveIn', years: '2024 - present', bullets: ['Plan the winter stores.'] }] },
    { id: 'core_comp', type: 'table', loc: 'main', on: true, title: 'CORE COMPETENCIES', rows: [['The role needs', 'What I bring, with proof'], ['Planning', 'Winter stores planned two seasons ahead']] },
    { id: 'tools', type: 'rich_block', loc: 'sidebar', on: true, title: 'TOOLS & METHODS', items: [] },
    { id: 'certs', type: 'rich_block', loc: 'sidebar', on: true, title: 'CERTIFICATES & COURSES', items: [{ grp: true, t: 'Courses' }] },
    { id: 'education', type: 'education', loc: 'sidebar', on: true, title: 'EDUCATION', items: [
      { deg: 'MBA', sch: 'Technion - Strategy, Finance; China biz-plan competition / Tsinghua Uni. honourable mention.' },
      { deg: 'M.Sc. Electrical Engineering', sch: 'Tel Aviv University - VLSI, optics, photonics and nanotechnology.' },
      { deg: 'B.Sc. Physics & B.Sc. EE', sch: 'Tel Aviv University' },
      { deg: 'FVU Dansk', sch: 'KVUC, ongoing' }] },
    { id: 'regulatory', type: 'rich_block', loc: 'sidebar', on: true, title: 'REGULATORY CONTEXT', items: [] },
    { id: 'languages', type: 'labeled_list', loc: 'sidebar', on: true, title: 'LANGUAGES', items: [{ l: '[Language]', v: 'native / fluent' }, { l: '[Language]', v: '[level]' }] },
    { id: 'accessibility', type: 'labeled_list', loc: 'sidebar', on: true, title: 'COMMUNICATION', items: [{ l: '', v: 'I work in English and Danish and follow meetings best with live captions and written follow-ups.' }] },
    { id: 'additional', type: 'labeled_list', loc: 'sidebar', on: true, title: 'ADDITIONAL INFORMATION', items: [{ l: '', v: 'Add only items that support the JD - portfolio or links, availability, work permit, relocation, or disclosures. Drop if not needed.' }] },
  ];
}
const EN_ANITA = { lang: 'en', jdText: JD, company: 'Kaleido Technology', name: ANITA.name, personalInfo: ANITA, nowYear: 2026 };

test('isPlaceholder: brackets and skeleton instructions, never Markdown links', () => {
  assert.equal(AF.isPlaceholder('[Language]: [level]'), true);
  assert.equal(AF.isPlaceholder('Add only items that support the JD - portfolio or links. Drop if not needed.'), true);
  assert.equal(AF.isPlaceholder('Details via [Google Scholar](https://scholar.google.com/citations?user=x)'), false);
  assert.equal(AF.isPlaceholder('Dansk: mellemniveau (B2)'), false);
});

test('export: a section without real content leaves the CV, headings included', () => {
  const { sections } = AF.apply(skeletonish(), EN_ANITA);
  for (const id of ['tools', 'certs', 'regulatory', 'languages', 'additional']) assert.equal(byId(sections, id).on, false, id);
  for (const id of ['profile', 'experience', 'core_comp']) assert.notEqual(byId(sections, id).on, false, id);
});

test('another person never gets the owner\'s education or Communication line', () => {
  const { sections, changes } = AF.apply(skeletonish(), EN_ANITA);
  assert.equal(byId(sections, 'education').on, false, 'all four rows are the owner\'s, so the heading goes too');
  assert.equal(byId(sections, 'accessibility').on, false, 'Anita stores no communication line');
  assert.ok(changes.some((c) => /another person's row hidden/.test(c)));
  const audit = AF.audit(skeletonish(), EN_ANITA).issues.map((i) => i.code);
  for (const c of ['LEAK', 'PLACEHOLDER', 'EMPTY_SECTION']) assert.ok(audit.includes(c), c);
  // a mixed list keeps the person's own row
  const mixed = skeletonish();
  mixed[5].items.unshift({ deg: 'BSc-equivalent in Seasonal Resource Management', sch: 'Institute of Logistics' });
  const edu = byId(AF.apply(mixed, EN_ANITA).sections, 'education');
  assert.notEqual(edu.on, false);
  assert.deepEqual(Object.keys(edu.hidden).map(Number).sort(), [1, 2, 3, 4]);
});

test('the owner\'s own CV keeps his rows; a stale COMMS-LINE-001 sentence is re-worded to COMMS-LINE-002', () => {
  const { sections } = AF.apply(skeletonish(), Object.assign({}, EN_ANITA, { name: NAME, personalInfo: GABRIEL_PI }));
  const edu = byId(sections, 'education');
  assert.notEqual(edu.on, false);
  assert.equal(Object.keys(edu.hidden || {}).length, 0);
  const acc = byId(sections, 'accessibility');
  assert.notEqual(acc.on, false);
  assert.equal(acc.items[0].v, 'English and Danish at work; live captions and written follow-ups in meetings.');
});

test('plan() names what the preview hides, by section id and row text', () => {
  const p = AF.plan(skeletonish(), EN_ANITA);
  assert.deepEqual(p.sections.sort(), ['accessibility', 'additional', 'certs', 'education', 'languages', 'regulatory', 'tools']);
  const mixed = skeletonish();
  mixed[5].items.unshift({ deg: 'BSc-equivalent in Seasonal Resource Management', sch: 'Institute of Logistics' });
  const q = AF.plan(mixed, EN_ANITA);
  assert.equal(q.rows.education.length, 4);
  assert.match(q.rows.education[0], /^MBA Technion/);
});

test('index.html loads the preview half with a ?v, after the rules', () => {
  const a = index.indexOf('antcv-academy-format.js?v='), b = index.indexOf('antcv-academy-preview.js?v=');
  assert.ok(a > 0 && b > a);
  const src = readFileSync(new URL('../../antcv-academy-preview.js', import.meta.url), 'utf8');
  assert.ok(!/localStorage\.setItem|dispatchEvent/.test(src), 'the preview half never writes storage or dispatches events');
});

// ── export integration (antcv-docx-client buildPayload) ─────────────────────
function seed() {
  store.clear();
  store.set('outcomesMode', JSON.stringify('results'));
  store.set('personalInfo', JSON.stringify({ name: NAME }));
  store.set('meta', JSON.stringify({ company: 'Kaleido Technology', role: 'Senior Optical Design Engineer' }));
  store.set('antcv:lastJdText', JD);
}
const payloadOf = (opts) => buildPayload(Object.assign({ sections: { cv: fixture(), cl: [] }, meta: { company: 'Kaleido Technology' }, doc: 'cv', language: 'da', personalInfo: { name: NAME } }, opts));

test('buildPayload: a margin CV exports in the academy shape', () => {
  seed();
  const p = payloadOf({});
  assert.equal(p.layout, 'margin');
  const ex = p.sections.find((s) => s.type === 'experience');
  const vis = ex.roles.filter((r) => r.on !== false);
  assert.equal(vis.filter((r) => r.id !== 'earlier-career').length, 6);
  assert.ok(vis.some((r) => r.id === 'earlier-career'));
  assert.equal(shown(p.sections.find((s) => s.id === 'certs')).length, 4);
  assert.ok(!p.sections.some((s) => s.id === 'outcomes'), 'results mode folds the outcomes block into the roles');
});

test('buildPayload: band / linear layouts and the kill switch keep the stored shape', () => {
  seed();
  for (const layout of ['two_column', 'linear']) {
    const ex = payloadOf({ layout }).sections.find((s) => s.type === 'experience');
    assert.ok(!ex.roles.some((r) => r.id === 'earlier-career'), layout);
  }
  store.set('antcv:disable-academy-format', '1');
  const ex = payloadOf({}).sections.find((s) => s.type === 'experience');
  assert.ok(!ex.roles.some((r) => r.id === 'earlier-career'), 'kill switch');
});

test('applyOutcomesMode: English kernel outcomes never become Results in a Danish CV', () => {
  seed();
  const secs = fixture();
  secs[4].roles[4].outcomes = ['Supplier qualification for the camera and display stack cut rejected parts by 50%.'];
  const da = applyOutcomesMode(JSON.parse(JSON.stringify(secs)), 'cv', { language: 'da' });
  const sirinDa = da.find((s) => s.type === 'experience').roles.find((r) => r.id === 'sirin');
  assert.ok(!AF.wrongLang(sirinDa.results || '', 'da'), 'no English Results: ' + sirinDa.results);
  const en = applyOutcomesMode(JSON.parse(JSON.stringify(secs)), 'cv', { language: 'en' });
  assert.match(en.find((s) => s.type === 'experience').roles.find((r) => r.id === 'sirin').results, /^Supplier qualification/);
});

test('role-body-notes: a Danish role that already says Praktik gets no English prefix', () => {
  const src = readFileSync(new URL('../../antcv-role-body-notes.js', import.meta.url), 'utf8');
  const run = (lang, bullets) => {
    const st = new Map([['language', JSON.stringify(lang)], ['sections', JSON.stringify({ cv: [{ type: 'experience', roles: [{ company: 'Trackman A/S', title: 'Projektleder', bullets }] }] })]]);
    const sb = { window: { addEventListener() {}, dispatchEvent() { return true; } }, localStorage: { getItem: (k) => (st.has(k) ? st.get(k) : null), setItem: (k, v) => st.set(k, String(v)) }, setTimeout() {}, CustomEvent: function () {}, JSON, String, Array, RegExp };
    vm.createContext(sb); vm.runInContext(src, sb); sb.window.AntcvRoleBodyNotes.run();
    return JSON.parse(st.get('sections')).cv[0].roles[0].bullets;
  };
  assert.deepEqual(run('da', ['Faser og porte.', 'Praktik: Ejer skabelonen.']), ['Faser og porte.', 'Praktik: Ejer skabelonen.']);
  assert.equal(run('da', ['Faser og porte.'])[0], 'Praktik: Faser og porte.');
  assert.equal(run('en', ['Phases and gates.'])[0], 'Internship: Phases and gates.');
});

test('index.html loads the sidecar with a ?v', () => {
  assert.match(index, /<script src="antcv-academy-format\.js\?v=[^"]+" defer><\/script>/);
});
