// elma-preview.test.mjs - ELMA-PREVIEW-001 (owner 2026-11-08, #3536 Elma Instruments):
// "elma preview in antcv is bleeping the Elma eftersøger table. the Elma coverletter is empty -
// wich is reasonable as there is no CL to upload - but the page sould be marked in such case. in
// addition CV Preview is 5 pages, while the pdfs are actually 1.5 pages."
//   1. Blink: the placeholder-only core-competencies table was hidden by an inline style 120 ms
//      after every re-mount (app.js busy wrapper flips during a translation). Hidden sections now
//      come from a stylesheet keyed on data-sid, which a re-mounted node matches before it paints.
//   2. The CL page of a letter with no prose carries a CSS-only "No cover letter" note.
//   3. Pages: the preview hides what AntcvAcademyFormat.apply() drops in the export (sections,
//      folded roles, cut bullets, capped sidebar rows): 13 roles / 5 pages -> 2 pages on #3536.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const AF = require('../../antcv-academy-format.js');
const previewSrc = readFileSync(new URL('../../antcv-academy-preview.js', import.meta.url), 'utf8');
const markerSrc = readFileSync(new URL('../../antcv-cl-empty-marker.js', import.meta.url), 'utf8');
const index = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

// ---- a sandbox with just enough document for the sidecars to boot ----
function fakeDoc() {
  const byId = {};
  const attrs = {};
  const head = { children: [], appendChild(el) { this.children.push(el); if (el.id) byId[el.id] = el; return el; } };
  const paper = { children: [], appendChild(el) { this.children.push(el); return el; } };
  return {
    head, paper, documentElement: head, readyState: 'complete',
    body: {
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(attrs, k) ? attrs[k] : null),
      setAttribute: (k, v) => { attrs[k] = String(v); },
      hasAttribute: (k) => Object.prototype.hasOwnProperty.call(attrs, k),
      removeAttribute: (k) => { delete attrs[k]; },
    },
    attrs,
    getElementById: (id) => byId[id] || null,
    createElement: (tag) => ({ tagName: tag, id: '', textContent: '' }),
    querySelector: (sel) => (/antcv-preview-paper/.test(sel) ? paper : null),
    querySelectorAll: () => [],
    addEventListener() {},
  };
}
function boot(src, store, extra) {
  const ls = new Map(Object.entries(store || {}));
  const document = fakeDoc();
  const sandbox = Object.assign({
    document,
    localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
    console: { debug() {}, info() {}, warn() {}, log() {}, error() {} },
    setTimeout: (fn) => { fn(); return 1; }, clearTimeout() {},
    MutationObserver: function () { this.observe = () => {}; },
    JSON, Object, Array, String, Math, Date, RegExp, Number,
  }, extra || {});
  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { sandbox, ls, document };
}

const JD = 'Kommerciel Produktchef. Elma Instruments søger en produktchef med teknisk produktforståelse, '
  + 'nordisk forretningsansvar, leverandører, prissætning og salgsunderstøttelse for måleinstrumenter.';
const NAME = 'Gabriel Alexander Karp-Gershon';
function role(id, title, company, years, n, extra) {
  const bullets = [];
  for (let i = 0; i < n; i++) bullets.push('Byggede testopstilling nummer ' + (i + 1) + ' til ' + company + ' og fulgte data op med teamet.');
  return Object.assign({ id, title, company, years, on: true, bullets }, extra || {});
}
// #3536's stored shape (synthetic text): the untailored kernel, placeholder core competencies
function cv() {
  return [
    { id: 'profile', type: 'rich_block', loc: 'main', on: true, title: 'PROFIL', items: [{ b: '', t: 'IT-professionel med 15+ år i kommercielle og regulerede markeder, produktudvikling og leverandørkoordinering.' }] },
    { id: 'work_style', type: 'rich_block', loc: 'main', on: true, title: 'Arbejdsstil', items: [{ b: 'Arbejdsstil', t: 'Rolige, strukturerede valg ud fra målte data og klare skriftlige resultater.' }] },
    { id: 'outcomes', type: 'bullets', loc: 'main', on: true, title: 'UDVALGTE RESULTATER', items: [{ b: 'Ændringscyklus', t: 'fra ca. 250 til ca. 10 dage via struktureret CCB' }] },
    { id: 'core_comp', type: 'table', loc: 'main', on: true, title: 'KERNEKOMPETENCER', rows: [['Elma eftersøger', 'Det bringer jeg, med belæg'], ['[Fokusområde 1]', '[Strategisk ekspertise - 1 eller 2 linjer]'], ['[Fokusområde 2]', '[Strategisk ekspertise - 1 eller 2 linjer]']] },
    { id: 'experience', type: 'experience', loc: 'main', on: true, title: 'ERHVERVSERFARING', roles: [
      role('trackman', 'Projektleder, hardwareudvikling og levering', 'Trackman A/S', '2026 - nu', 3, { isCurrent: true }),
      role('kanzen', 'Produkt- og projektekspert', 'Kanzen Konsulenter ApS', '2022 - 2026', 7),
      role('tau-council', 'Studenterrepræsentant', 'Tel Aviv University', '2008', 3, { on: false }),
      role('innoviz-ccr', 'Ansvarlig for ændringsanmodninger', 'Innoviz Technologies', '2020 - 2025', 10),
      role('innoviz-sa', 'Systemarkitekt', 'Innoviz Technologies', '2017 - 2020', 10),
      role('sirin', 'Senioringeniør i optik og elektrooptik', 'Sirin Labs', '2014 - 2017', 6),
      role('mepro-tl', 'Teamleder for elektrooptik', 'Meprolight, IWI Group', '2013 - 2014', 5),
      role('mepro-eng', 'Udviklingsingeniør i elektrooptik', 'Meprolight, IWI Group', '2010 - 2013', 4),
      role('tau-research', 'Videnskabelig assistent', 'Tel Aviv University', '2007 - 2010', 6),
      role('tau-teaching', 'Undervisningsassistent', 'Tel Aviv University', '2006 - 2010', 1),
    ] },
    { id: 'pubs', type: 'list_italic', loc: 'main', on: true, title: 'PUBLIKATIONER OG PATENTER', items: [
      'Integration of Suspended Carbon Nanotubes into Micro-Fabricated Devices - J. Micromech. Microeng., 2009',
      'Patent nr. 241997 - medopfinder - dækglasgeometri, der mindsker optisk krydstale mellem nabosensorer'] },
    { id: 'certs', type: 'rich_block', loc: 'sidebar', on: true, title: 'CERTIFICERINGER OG KURSER', items: [
      { b: '', t: 'AI-praktiker (Teknologisk Institut)' }, { b: '', t: 'Business Analysis / BABOK (University of Toronto, 2020)' },
      { b: '', t: 'Six Sigma Black Belt (CSSC)' }, { b: '', t: 'FMEA & APIS (Wanders Eng., 2018)' },
      { b: '', t: 'Prøve i dansk 2 (Studieskolen)' }, { b: '', t: 'World Rugby niveau 1 (2024)' },
      { b: '', t: 'Projektledelse & digitalisering (Improve Business Academy, 2026)' }] },
    { id: 'education', type: 'education', loc: 'sidebar', on: true, title: 'UDDANNELSE', items: [{ deg: 'M.Sc. i elektroteknik', sch: 'Tel Aviv University' }] },
    { id: 'languages', type: 'labeled_list', loc: 'sidebar', on: true, title: 'SPROG', items: [{ l: 'Engelsk', v: 'flydende' }, { l: 'Dansk', v: 'mellemniveau (B2)' }] },
  ];
}
const OPTS = { lang: 'da', jdText: JD, company: 'Elma Instruments (via Compass HR)', role: 'Kommerciel Produktchef', name: NAME, nowYear: 2026 };
// the sandbox is another realm: hand back plain arrays / objects for deepEqual
const plain = (x) => JSON.parse(JSON.stringify(x));
const preview = () => {
  const P = boot(previewSrc, {}, { AntcvAcademyFormat: AF }).sandbox.AntcvAcademyPreview;
  return { projection: (c, o) => plain(P.projection(c, o)), cssFor: (pp) => P.cssFor(pp) };
};

test('blink source: the placeholder-only core competencies table is hidden by stylesheet, not by a late inline style', () => {
  const P = preview();
  const pp = P.projection(cv(), OPTS);
  assert.ok(pp.sections.includes('core_comp'), 'the export drops the placeholder table');
  const css = P.cssFor(pp);
  assert.ok(css.includes('.antcv-preview-paper [data-sid="core_comp"]'), 'keyed on data-sid: a re-mounted node matches before it paints');
  assert.ok(/\{ display: none !important; \}$/.test(css));
  // the busy wrapper app.js puts round a translating section carries the same data-sid
  assert.ok(!/data-antcv-af-hide/.test(css), 'the rule does not depend on a mark the re-mounted node lacks');
});

test('pages: the preview hides the sections, roles and bullets the export drops', () => {
  const P = preview();
  const src = cv();
  const pp = P.projection(src, OPTS);
  const exp = AF.apply(JSON.parse(JSON.stringify(src)), Object.assign({ source: src }, OPTS)).sections;
  // sections the export turns off
  for (const id of ['outcomes', 'core_comp', 'pubs']) assert.ok(pp.sections.includes(id), id);
  assert.ok(!pp.sections.includes('profile') && !pp.sections.includes('experience'));
  // folded roles: ri = stored index, ord = position among the roles with on !== false
  const ex = exp.find((s) => s.id === 'experience');
  const folded = ex.roles.map((r, i) => [r, i]).filter(([r, i]) => r.on === false && src[4].roles[i] && src[4].roles[i].on !== false).map(([, i]) => i);
  assert.deepEqual(pp.roles.map((r) => r.ri), folded);
  pp.roles.forEach((r) => assert.equal(r.ord, src[4].roles.slice(0, r.ri).filter((x) => x.on !== false).length));
  // bullets: every detailed role shows exactly the export's count
  src[4].roles.forEach((r, i) => {
    if (r.on === false || folded.includes(i)) return;
    const cut = pp.bullets.filter((b) => b.ri === i).length;
    assert.equal(r.bullets.length - cut, ex.roles[i].bullets.length, r.id);
  });
  // capped sidebar rows by text (stored text, even where the export strips the year)
  const certsShown = (exp.find((s) => s.id === 'certs').items || []).filter((_, i) => !(exp.find((s) => s.id === 'certs').hidden || {})[i]).length;
  assert.equal(src.find((s) => s.id === 'certs').items.length - (pp.rows.certs || []).length, certsShown);
  assert.ok((pp.rows.certs || []).every((t) => src.find((s) => s.id === 'certs').items.some((it) => it.t === t)));
});

test('stylesheet: page-1 rows by role ordinal, page-2+ wrappers by stored role index', () => {
  const P = preview();
  const css = P.cssFor({ sections: [], rows: {}, exp: 'experience', roles: [{ ri: 8, ord: 7 }], bullets: [{ ri: 3, ord: 2, bi: 5 }] });
  assert.ok(css.includes('.antcv-preview-paper [data-antcv-role-index="8"]'));
  assert.ok(css.includes('.antcv-preview-paper .antcv-document-main > [data-sid="experience"] [data-antcv-rowkey="roles.7"]'));
  assert.ok(css.includes('.antcv-preview-paper .antcv-document-main > [data-sid="experience"] [data-antcv-rowkey^="roles.7."]'));
  assert.ok(css.includes('.antcv-preview-paper [data-antcv-role-index="3"] [data-antcv-rowkey$=".bullets.5"]'));
  assert.ok(css.includes('.antcv-preview-paper .antcv-document-main > [data-sid="experience"] [data-antcv-rowkey="roles.2.bullets.5"]'));
  assert.equal(P.cssFor({ sections: [], rows: {}, roles: [], bullets: [], exp: null }), '');
});

test('export-hidden roles (sanitizeForExport) and editor-hidden bullets are not counted twice', () => {
  const P = preview();
  const src = cv();
  src[4].roles[1].bulletMeta = [null, { hidden: true }];   // Kanzen bullet 1 hidden in the editor
  const gone = (r) => r.id === 'tau-research';               // AntcvExportHiddenRole (targeted application)
  const pp = P.projection(src, Object.assign({ exportHidden: gone }, OPTS));
  assert.ok(!pp.roles.some((r) => r.ri === 8), 'an export-hidden role renders null already');
  assert.ok(!pp.bullets.some((b) => b.ri === 1 && b.bi === 1), 'the editor-hidden bullet is never shown');
  assert.ok(pp.bullets.filter((b) => b.ri === 1).length >= 3);
});

test('a CV that already matches the export hides nothing', () => {
  const P = preview();
  const lean = cv().filter((s) => !['outcomes', 'core_comp', 'pubs'].includes(s.id)).map((s) => (s.id === 'experience'
    ? Object.assign({}, s, { roles: s.roles.slice(0, 2).map((r) => Object.assign({}, r, { bullets: r.bullets.slice(0, 3) })) })
    : s.id === 'certs' ? Object.assign({}, s, { items: s.items.slice(0, 4) }) : s));
  const pp = P.projection(lean, OPTS);
  assert.deepEqual(pp.sections, []);
  assert.deepEqual(pp.roles, []);
  assert.deepEqual(pp.bullets, []);
  assert.equal(P.cssFor(pp), '');
});

test('the preview half never writes storage or dispatches events; asks the measurer to re-plan', () => {
  assert.ok(!/localStorage\.setItem|dispatchEvent\(/.test(previewSrc));
  assert.ok(previewSrc.includes('window.AntcvAutoPagebreak.run()'));
});

// ---- 2. empty cover letter marker ----
const SKELETON = [
  { id: 'greeting', type: 'text', on: true, content: 'Dear [Hiring Team / Name],' },
  { id: 'opening', type: 'rich_block', on: true, content: '', items: [{ b: '', t: '' }] },
  { id: 'why', type: 'rich_block', on: true, content: '', items: [{ b: 'Why this company and position', t: '[NO-JD RULE (whole letter): with no JD (unsolicited), never leave a part empty and never invent facts - use [Company] and [scope].]' }] },
  { id: 'who', type: 'rich_block', on: true, content: '', items: [{ b: 'Hands-on', t: 'Hands-on across the full hardware product path: requirements and ALM tooling, FMEA and validation setups.' }] },
  { id: 'closure', type: 'text', on: true, content: '[CLOSING - connect the strongest match, invite a conversation: "I would welcome a talk on how [strongest match] can support [Company] in [scope]." No generic closings.]' },
];
const SKELETON_DA = [
  { id: 'greeting', type: 'text', on: true, content: 'Kære [ansættelsesteam / navn],' },
  { id: 'opening', type: 'rich_block', on: true, content: '', items: [{ b: '', t: '(klik for at tilføje)' }] },
  { id: 'why', type: 'rich_block', on: true, items: [{ b: 'Hvorfor denne virksomhed', t: '[NO-JD-REGEL (hele brevet): brug [Virksomhed] og [scope].]' }] },
  { id: 'closure', type: 'text', on: true, content: '[AFSLUTNING - bind den stærkeste match sammen, inviter til en snak: "Jeg tager gerne en snak om, hvordan [stærkeste match] kan støtte [Virksomhed] i [scope]." ingen generiske afslutninger.]' },
];
const LETTER = SKELETON.map((s) => (s.id === 'opening'
  ? Object.assign({}, s, { items: [{ b: '', t: "PEAK Wind's Product & Project Delivery Consultant role turns client needs into delivered scope, which is the work I have done for ten years." }] })
  : s));
const marker = (store) => {
  const b = boot(markerSrc, store);
  return Object.assign(b, { M: b.sandbox.AntcvClEmptyMarker });
};

test('isEmptyLetter: skeletons (EN, translated DA) and an empty list have no letter; one written part is a letter', () => {
  const { M } = marker({});
  assert.equal(M.isEmptyLetter(SKELETON), true);
  assert.equal(M.isEmptyLetter(SKELETON_DA), true);
  assert.equal(M.isEmptyLetter([]), true);
  assert.equal(M.isEmptyLetter(undefined), true);
  assert.equal(M.isEmptyLetter(LETTER), false);
  // nested brackets leave nothing behind ("[A [b] c]")
  assert.equal(M.stripTemplate('[CLOSING "about [x] for [y]." end]').trim(), '');
});

test('CL page of an empty letter carries the note on the body only; the paper gets nothing', () => {
  const { document } = marker({ doc: '"cl"', sections: JSON.stringify({ cv: [], cl: SKELETON }), uiLang: 'en' });
  assert.equal(document.attrs['data-antcv-cl-empty'], '1');
  const style = document.getElementById('antcv-cl-empty-css');
  assert.ok(style && /NO COVER LETTER/.test(style.textContent));
  assert.ok(/body\[data-antcv-cl-empty="1"\] \.antcv-preview-paper::after/.test(style.textContent));
  assert.ok(/@media print\{body\[data-antcv-cl-empty\] \.antcv-preview-paper::after\{content:none!important;display:none!important;\}\}/.test(style.textContent));
  assert.equal(document.paper.children.length, 0, 'nothing in the paper, so outerHTML exports never carry it');
});

test('no note on the CV page, on a written letter, or with the kill switch; Danish UI gets Danish text', () => {
  assert.equal(marker({ doc: '"cv"', sections: JSON.stringify({ cv: [], cl: SKELETON }) }).document.attrs['data-antcv-cl-empty'], undefined);
  assert.equal(marker({ doc: '"cl"', sections: JSON.stringify({ cv: [], cl: LETTER }) }).document.attrs['data-antcv-cl-empty'], undefined);
  assert.equal(marker({ doc: '"cl"', sections: JSON.stringify({ cv: [], cl: SKELETON }), 'antcv:disable-cl-empty-marker': '1' }).document.attrs['data-antcv-cl-empty'], undefined);
  const da = marker({ doc: '"cl"', sections: JSON.stringify({ cv: [], cl: SKELETON_DA }), uiLang: 'da' });
  assert.ok(/INTET FØLGEBREV\\A Denne/.test(da.document.getElementById('antcv-cl-empty-css').textContent), 'the space ends the \\A escape');
});

test('index.html loads the marker and the preview half with a ?v', () => {
  assert.ok(/<script src="antcv-cl-empty-marker\.js\?v=[^"]+" defer><\/script>/.test(index));
  assert.ok(/<script src="antcv-academy-preview\.js\?v=1\.51\.6345-elma-preview" defer><\/script>/.test(index));
  assert.ok(/<script src="antcv-auto-pagebreak-block-001\.js\?v=1\.51\.6345-elma-preview" defer><\/script>/.test(index));
});
