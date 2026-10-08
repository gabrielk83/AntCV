// EXEC-LINEAR step 5a: doc "cv" + layout "linear" -> single-column executive CV
// (docs/design/EXECUTIVE_LINEAR_SPEC_ADDENDUM.md). Drives /generate in node like role-location.test.mjs.
// LINEAR_CV_OUT=<path.docx> also writes the generated file for a visual check.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';

function unzipEntry(buf, name) {
  let i = buf.length - 22;
  for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const cd = buf.readUInt32LE(i + 16), n = buf.readUInt16LE(i + 10);
  let p = cd;
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const nm = buf.slice(p + 46, p + 46 + nl).toString();
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
// 1x1 PNG
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const sections = [
  { id: 'profile', title: 'PROFILE', type: 'text', loc: 'main', content: 'Hardware product and systems lead with 15+ years taking camera, optical and sensor products from a written case to shipped units.' },
  { id: 'workstyle', title: 'Work style', type: 'text_inline', loc: 'main', content: 'Work style: Calm and structured - measured data before opinion, a written argument for every decision.' },
  { id: 'core_comp', title: 'CORE COMPETENCIES', type: 'table', loc: 'main', rows: [['Focus Area', 'Strategic Expertise'],
    ['Product Case', 'Problem, user and willingness to pay argued before the spec.'], ['Unit Economics', 'Trade-off and supplier analysis behind a 10x cost cut.'],
    ['Launch & Metrics', 'KPIs with baseline, owner and cadence.'], ['[Focus area 4]', '[Strategic expertise - 1 or 2 lines]']] },
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', type: 'experience', loc: 'main', roles: [
    { title: 'Project Manager, Hardware Development & Supply', company: 'Trackman A/S', years: '2026 -', location: 'Hørsholm, Denmark',
      bullets: ['Sports-Tech Hardware Projects: Own PMA template for supplier-developed and off-the-shelf hardware.', 'Supplier selection one-pager and agreement template.'],
      results: 'PMA template, supplier one-pager and a pilot project with measured coverage.' },
    { title: 'System Architect, Automotive LiDAR', company: 'Innoviz Technologies', years: '2017 - 2020', location: 'Tel Aviv, Israel',
      bullets: ['Held ~3,400 requirements traced to verification — through DV and PV.'] },
  ] },
  { id: 'education', title: 'EDUCATION', type: 'education', loc: 'sidebar', items: [
    { deg: 'MBA', sch: 'Technion - Strategy, Finance', years: '2011–2013' }, { deg: 'M.Sc. Electrical Engineering', sch: 'Tel Aviv University - Optics, photonics', years: '2007–2010' },
    { deg: 'B.Sc. Physics', sch: 'Tel Aviv University', years: '2003–2007' }, { deg: 'B.Sc. Electrical Engineering', sch: 'Tel Aviv University', years: '2003–2007' } ] },
  { id: 'certs', title: 'CERTIFICATES & COURSES', type: 'list', loc: 'sidebar', items: ['Six Sigma Black Belt (CSSC)', 'BABOK Business Analysis'] },
  { id: 'tools', title: 'TOOLS & METHODS', type: 'labeled_list', loc: 'sidebar', items: [{ l: 'Tools', v: 'Jira, Confluence, Codebeamer ALM.' }, { l: 'Methods', v: 'FMEA, DoE, Six Sigma.' }] },
  { id: 'languages', title: 'LANGUAGES', type: 'labeled_list', loc: 'sidebar', items: [{ l: 'English', v: 'native' }, { l: 'Danish', v: 'B2' }] },
  { id: 'accessibility', title: 'ACCESSIBILITY', type: 'text', loc: 'sidebar', content: 'Hearing impaired; clear spoken communication and written follow-ups work well.' },
];
async function gen(extra = {}) {
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'linear', filename: 'lin',
    personal_info: { name: 'Gabriel Alexander Karp-Gershon', email: 'g@example.com', phone: '+45 00 00 00 00', linkedin: 'https://www.linkedin.com/in/example', location: 'Copenhagen, Denmark', photo_b64: PNG, photoPosition: 'header' },
    meta: { role: 'Staff Hardware Product Manager', subtitle: 'Camera Hardware • Case to Launch' }, style: {}, font_sizes: {}, sections, ...extra,
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  const buf = Buffer.from(await res.arrayBuffer());
  assert.equal(res.status, 200, buf.toString().slice(0, 300));
  return buf;
}
const texts = (xml) => [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');

test('linear CV: single column, addendum order, no sidebar table', async () => {
  const buf = await gen();
  if (process.env.LINEAR_CV_OUT) fs.writeFileSync(process.env.LINEAR_CV_OUT, buf);
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const t = texts(xml);
  const order = ['PROFILE', 'CORE COMPETENCIES', 'PROFESSIONAL EXPERIENCE', 'EDUCATION', 'TOOLS &amp; METHODS', 'LANGUAGES &amp; PERSONAL'].map((h) => t.indexOf(h));
  assert.ok(order.every((i) => i >= 0), 'every heading present: ' + JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'addendum order');
  assert.ok(!/\[Focus area/.test(t), 'bracketed placeholders dropped');
  assert.ok(!t.includes('LANGUAGES &amp; ACCESSIBILITY'), 'LINEAR-DETAILS-GROUPS-001: the personal table reads its theme name');
});

test('linear CV: typography rules - 9.5 pt floor, no em dash, cells without a final stop', async () => {
  const xml = unzipEntry(await gen(), 'word/document.xml').toString('utf8');
  const sizes = [...xml.matchAll(/<w:sz w:val="(\d+)"/g)].map((m) => +m[1]);
  assert.ok(sizes.length && Math.min(...sizes) >= 19, 'min size ' + Math.min(...sizes) / 2 + ' pt');
  assert.ok(!/—/.test(texts(xml)), 'no em dash anywhere in the body');
  const t = texts(xml);
  assert.ok(t.includes('Trade-off and supplier analysis behind a 10x cost cut') && !t.includes('10x cost cut.'), 'tile text without final stop');
  assert.ok(t.includes('Jira, Confluence, Codebeamer ALM') && !t.includes('Codebeamer ALM.'), 'tool tile without final stop');
  assert.ok(t.includes('owner and cadence.') === false, 'tile cell stop stripped');
});

test('linear CV: role line "Title - Company<TAB>years | location", open-ended years read "present"', async () => {
  const xml = unzipEntry(await gen(), 'word/document.xml').toString('utf8');
  const i = xml.indexOf('Project Manager, Hardware Development &amp; Supply');
  const para = xml.slice(xml.lastIndexOf('<w:p>', i) >= 0 ? xml.lastIndexOf('<w:p', i) : i, xml.indexOf('</w:p>', i));
  const runs = [...para.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]);
  assert.deepEqual(runs.slice(0, 2), ['Project Manager, Hardware Development &amp; Supply', ' - Trackman A/S']);
  // the right-tabbed segment is a literal TAB in the run text - the same convention as renderExperience
  assert.ok(para.includes('\t2026 - present | Hørsholm, Denmark'), 'right-tabbed years | location');
  assert.ok(texts(xml).includes('Results: PMA template'), 'Results line kept');
});

test('linear CV: running header + AI notice on page 2+ only, photo rounded', async () => {
  const buf = await gen();
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  assert.ok(/<w:titlePg\/>/.test(xml), 'first page has its own (empty) header/footer');
  const parts = ['word/header1.xml', 'word/header2.xml', 'word/footer1.xml', 'word/footer2.xml'].map((n) => { const e = unzipEntry(buf, n); return e ? texts(e.toString('utf8')) : ''; }).join('|');
  assert.ok(/Karp-Gershon - Staff Hardware Product Manager \(Experience &amp; Technical Arsenal\)/.test(parts), 'running header, hyphen');
  assert.ok(/AI-assisted/.test(parts), 'AI notice in the page-2+ footer');
  assert.ok(/prst="ellipse"/.test(xml), 'header photo rounded by the post-process');
});

test('two_column CV and linear CL are untouched by the linear CV path', async () => {
  const two = unzipEntry(await gen({ layout: 'two_column' }), 'word/document.xml').toString('utf8');
  assert.ok(!/Experience &amp; Technical Arsenal/.test(two));
});

// The owner's real CV shapes (2026-09-29 live data): tools is a rich_block, "recommendations" is an
// education-TYPED section, and SELECTED OUTCOMES is a bullets section.
test('linear CV adapter: rich_block tools -> tiles, education-typed recommendations -> details, outcomes -> bullets', async () => {
  const extra = [
    { id: 'outcomes', title: 'SELECTED OUTCOMES', type: 'bullets', loc: 'main', items: ['Change cycle cut from ~250 to ~10 days.', 'A 10x LiDAR unit-cost reduction.'] },
    { id: 'tools2', title: 'TOOLS & METHODS', type: 'rich_block', loc: 'sidebar', items: [{ b: 'Software', t: 'Jira, Confluence, Power BI.' }, { b: 'Methods', t: 'FMEA, DoE.' }] },
    { id: 'recommendations', title: 'RECOMMENDATIONS', type: 'education', loc: 'main', items: [{ deg: 'References', sch: 'Available on request' }] },
  ];
  const secs = sections.filter((s) => s.id !== 'tools').concat(extra);
  const xml = unzipEntry(await gen({ sections: secs }), 'word/document.xml').toString('utf8');
  const t = texts(xml);
  assert.ok(t.includes('SELECTED OUTCOMES') && t.indexOf('SELECTED OUTCOMES') < t.indexOf('PROFESSIONAL EXPERIENCE'), 'outcomes as its own bullet block before experience');
  assert.ok(t.includes('Software') && t.includes('Jira, Confluence, Power BI') && !t.includes('Power BI.'), 'rich_block tools as tiles, no final stop');
  const edu = t.slice(t.indexOf('EDUCATION'), t.indexOf('TOOLS'));
  assert.ok(!edu.includes('References'), 'recommendations are not printed as a degree');
  assert.ok(/Recommendations/.test(t) && t.includes('Available on request'), 'recommendations land in the details table');
});

// 1.51.4726 (owner 2026-09-30): LINEAR-MERGE-001 + LINEAR-DETAILS-STRUCTURE-001
test('linear CV: short last rows merge; publications and long sections are blocks; short details heading', async () => {
  const secs = [
    { id: 'core_comp', title: 'CORE COMPETENCIES', type: 'table', loc: 'main', rows: [['Focus Area', 'Strategic Expertise'],
      ['A focus', 'a text'], ['B focus', 'b text'], ['C focus', 'c text'], ['Technical Coordination', 'change control boards']] },
    { id: 'education', title: 'EDUCATION', type: 'education', loc: 'main', items: [{ deg: 'MBA', sch: 'Technion' }, { deg: 'M.Sc.', sch: 'TAU' }, { deg: 'B.Sc.', sch: 'TAU' }] },
    { id: 'tools', title: 'TOOLS & METHODS', type: 'labeled_list', loc: 'main', items: [{ l: 'Tools', v: 'Jira' }, { l: 'Methods', v: 'FMEA' }, { l: 'Lab', v: 'benches' }] },
    { id: 'pubs', title: 'PUBLICATIONS & PATENTS', type: 'list_italic', loc: 'main', items: ['Integration of Suspended Carbon Nanotubes, 2009'] },
    { id: 'regulatory', title: 'REGULATORY CONTEXT', type: 'rich_block', loc: 'main', items: Array.from({ length: 8 }, (_, i) => ({ b: 'Std ' + i, t: 'context ' + i })) },
    { id: 'recommendations', title: 'RECOMMENDATIONS', type: 'education', loc: 'main', items: [{ deg: 'References', sch: 'on request' }] },
    { id: 'languages', title: 'LANGUAGES', type: 'labeled_list', loc: 'main', items: [{ l: 'English', v: 'native' }] },
    { id: 'interests', title: 'INTERESTS', type: 'labeled_list', loc: 'main', items: [{ l: 'Rugby', v: 'team player' }] },
  ];
  const xml = unzipEntry(await gen({ sections: secs }), 'word/document.xml').toString('utf8');
  const t = texts(xml);
  const spans = [...xml.matchAll(/<w:gridSpan w:val="(\d)"\/>/g)].map((m) => +m[1]);
  assert.ok(spans.includes(3), '4th competency tile spans the 3-column row');
  assert.ok(spans.filter((n) => n === 2).length >= 2, 'odd tool tile and odd degree span 2');
  assert.ok(t.includes('PUBLICATIONS &amp; PATENTS') && t.includes('REGULATORY CONTEXT'), 'blocks keep their own headings');
  assert.ok(t.includes('Std 0: context 0'), 'block rows as "Lead: text"');
  // LINEAR-DETAILS-GROUPS-001 + ENRICHED-001: one table per theme, each under its theme name
  assert.ok(t.includes('LANGUAGES &amp; PERSONAL') && t.includes('AVAILABILITY &amp; REFERENCES'), 'theme tables with theme headings');
  assert.ok(!t.includes('RECOMMENDATIONS') || t.indexOf('AVAILABILITY &amp; REFERENCES') < t.indexOf('Recommendations'), 'a one-row table reads its theme name, the label stays a row');
  assert.ok(!/PUBLICATIONS &amp; PATENTS, /.test(t), 'no long joined heading');
  assert.ok(t.indexOf('REGULATORY CONTEXT') < t.indexOf('LANGUAGES &amp; PERSONAL'), 'details tables last');
  assert.ok(t.indexOf('LANGUAGES &amp; PERSONAL') < t.indexOf('AVAILABILITY &amp; REFERENCES'), 'references table after languages');
});

// owner 2026-09-30: the Accessibility label is left-aligned like every details label
test('linear CV: Accessibility label cell is not centered', async () => {
  const xml = unzipEntry(await gen(), 'word/document.xml').toString('utf8');
  const i = xml.indexOf('>Accessibility<');
  assert.ok(i > 0, 'accessibility row present');
  const para = xml.slice(xml.lastIndexOf('<w:p>', i) >= 0 ? xml.lastIndexOf('<w:p', i) : i, i);
  assert.ok(!/<w:jc w:val="center"\/>/.test(para), 'no centered alignment on the label paragraph');
});

// CL-CLOSE-SPACE-001 (owner 2026-09-30): the letter's closing line gets 5 pt (100 twips) above and below
test('cover letter: closing line spaced 5 pt before and after', async () => {
  const buf = await gen({ doc: 'cl', sections: [{ id: 'opening', title: 'Opening', type: 'text', loc: 'main', content: 'Opening paragraph.' },
    { id: 'closure', title: 'Closing', type: 'text', loc: 'main', content: 'I welcome a conversation about the role.' }] });
  const xml = unzipEntry(buf, 'word/document.xml').toString('utf8');
  const i = xml.indexOf('I welcome a conversation');
  assert.ok(i > 0);
  const para = xml.slice(xml.lastIndexOf('<w:p>', i) >= 0 ? xml.lastIndexOf('<w:p', i) : i, i);
  assert.match(para, /<w:spacing [^>]*w:after="100"/); assert.match(para, /<w:spacing [^>]*w:before="100"/);
});

// LINEAR-DETAILS-GROUPS-001 (owner 2026-10-05 "this can be split to more than one table")
test('linear CV: details split into credentials, personal, availability & references tables', async () => {
  const secs = [
    { id: 'references', title: 'REFERENCES', type: 'labeled_list', loc: 'main', items: [{ l: 'Christian Bigom', v: 'Chair, Pan Idraet' }] },
    { id: 'availability', title: 'AVAILABILITY', type: 'text', loc: 'main', content: 'Copenhagen; full time, on site' },
    { id: 'languages', title: 'LANGUAGES', type: 'labeled_list', loc: 'main', items: [{ l: 'Danish', v: 'upper-intermediate' }] },
    { id: 'standards', title: 'STANDARDS', type: 'text', loc: 'main', content: 'MIL-STD-810, ISO 9001' },
    { id: 'rugby', title: 'RUGBY', type: 'text', loc: 'main', content: 'Plays and runs team operations' },
    { id: 'accessibility', title: 'ACCESSIBILITY', type: 'text', loc: 'main', content: 'Hearing impaired' },
  ];
  const xml = unzipEntry(await gen({ sections: secs }), 'word/document.xml').toString('utf8');
  const t = texts(xml);
  const order = ['CREDENTIALS', 'LANGUAGES &amp; PERSONAL', 'AVAILABILITY &amp; REFERENCES'].map((h) => t.indexOf(h));
  assert.ok(order.every((i) => i >= 0), 'three headings: ' + JSON.stringify(order));
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'credentials, personal, then availability & references');
  assert.equal((xml.slice(xml.indexOf('>CREDENTIALS<')).match(/<w:tbl>/g) || []).length, 3, 'one table per heading');
  assert.ok(!t.includes('ADDITIONAL DETAILS') && !t.includes('>STANDARDS<'), 'no catch-all heading, no label heading');
  // LINEAR-DETAILS-ENRICHED-001: row order inside a table follows the enriched CV
  const rows = ['Languages', 'Rugby', 'Accessibility', 'Availability', 'References'].map((l) => xml.indexOf('>' + l + '<'));
  assert.ok(rows.every((i) => i > 0), 'rows present: ' + JSON.stringify(rows));
  assert.deepEqual([...rows].sort((a, b) => a - b), rows, 'languages, rugby, accessibility / availability, references');
});

// LINEAR-DETAILS-ENRICHED-001 (owner 2026-10-05, CV_Veo_Director_enriched.pdf): CREDENTIALS = Standards, Courses, Patent
test('linear CV: courses and a stand-alone patent are CREDENTIALS rows, not an education row or a block', async () => {
  const secs = [
    { id: 'education', title: 'EDUCATION', type: 'education', loc: 'main', items: [{ deg: 'MBA', sch: 'Technion' }, { deg: 'M.Sc.', sch: 'TAU' }] },
    { id: 'patent', title: 'PATENT', type: 'text', loc: 'main', content: 'Patent No. 241997: cover-window geometry reducing optical crosstalk.' },
    { id: 'certs', title: 'CERTIFICATES & COURSES', type: 'list', loc: 'main', items: ['Six Sigma Black Belt (CSSC)', 'BABOK Business Analysis'] },
    { id: 'standards', title: 'STANDARDS', type: 'text', loc: 'main', content: 'EMVA 1288, ISO 12233, ISO 9001' },
    { id: 'pubs', title: 'PUBLICATIONS', type: 'list_italic', loc: 'main', items: ['Integration of Suspended Carbon Nanotubes, 2009'] },
  ];
  const xml = unzipEntry(await gen({ sections: secs }), 'word/document.xml').toString('utf8');
  const t = texts(xml);
  const cred = xml.indexOf('>CREDENTIALS<');
  assert.ok(cred > 0, 'credentials heading');
  const eduTbl = xml.slice(xml.indexOf('>EDUCATION<'), cred);
  assert.ok(!eduTbl.includes('Six Sigma'), 'no courses row under education');
  const tbl = xml.slice(cred, xml.indexOf('</w:tbl>', cred));
  for (const l of ['Standards', 'Certificates &amp; Courses', 'Patent']) assert.ok(tbl.includes('>' + l + '<'), l + ' row in the credentials table');
  const o = ['>Standards<', '>Certificates &amp; Courses<', '>Patent<'].map((l) => tbl.indexOf(l));
  assert.deepEqual([...o].sort((a, b) => a - b), o, 'standards, courses, patent');
  assert.ok(tbl.includes('Six Sigma Black Belt (CSSC) • BABOK Business Analysis'), 'courses joined by a bullet');
  assert.ok(!t.includes('>PATENT<') && t.includes('PUBLICATIONS'), 'patent is a row; publications stay a block');
});

// LINEAR-CONT-001 (owner 2026-10-05 rule sheet "Page 2 start"): the client's role.page starts page 2 with ONE
// explicit page break + "PROFESSIONAL EXPERIENCE (CONT.)"; roles stay whole (keepNext on all bullets but the last)
test('linear CV: forwarded role page -> one page break + "(Cont.)" heading; no page -> none; Danish suffix', async () => {
  const exp = sections.find((s) => s.id === 'experience');
  const paged = { ...exp, roles: [exp.roles[0], { ...exp.roles[1], page: 2, bullets: ['First bullet of the role.', 'Second bullet.', 'Last bullet.'] }] };
  const secs = sections.map((s) => (s.id === 'experience' ? paged : s));
  const xml = unzipEntry(await gen({ sections: secs }), 'word/document.xml').toString('utf8');
  const t = texts(xml);
  assert.ok(t.includes('PROFESSIONAL EXPERIENCE (CONT.)'), 'cont heading');
  assert.equal((xml.match(/<w:pageBreakBefore\/>/g) || []).length, 1, 'exactly one explicit page break');
  assert.ok(xml.indexOf('<w:pageBreakBefore/>') < xml.indexOf('(CONT.)') && xml.indexOf('(CONT.)') < xml.indexOf('System Architect'), 'break, heading, then the page-2 role');
  assert.ok(xml.indexOf('Trackman') < xml.indexOf('<w:pageBreakBefore/>'), 'page-1 role before the break');
  // the page-2 role's bullets: keepNext on all but the last
  const b1 = xml.lastIndexOf('<w:p', xml.indexOf('First bullet')), b3 = xml.lastIndexOf('<w:p', xml.indexOf('Last bullet'));
  assert.ok(xml.slice(b1, xml.indexOf('First bullet')).includes('<w:keepNext/>'), 'first bullet keeps with next');
  assert.ok(!xml.slice(b3, xml.indexOf('Last bullet')).includes('<w:keepNext/>'), 'last bullet does not');
  // no forwarded page: no break, no cont heading
  const plain = unzipEntry(await gen(), 'word/document.xml').toString('utf8');
  assert.ok(!plain.includes('<w:pageBreakBefore/>') && !texts(plain).includes('(CONT.)'), 'no break without a client page');
  // Danish: localized suffix and table headings
  const da = texts(unzipEntry(await gen({ sections: secs, language: 'da' }), 'word/document.xml').toString('utf8'));
  assert.ok(da.includes('PROFESSIONAL EXPERIENCE (FORTSAT)'), 'Danish cont suffix');
  assert.ok(da.includes('KVALIFIKATIONER') && da.includes('SPROG &amp; PERSONLIGT'), 'Danish theme headings');
});
