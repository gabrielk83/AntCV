/* tmp probe — reproduce the blank middle page + lost sidebar lines in the
 * live /generate-pdf with an owner-like 2-page coordinated payload. */
import { writeFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const roles = [
  { title: 'Founder & Product / Project Expert', company: 'Kanzen', period: '2022–2025', page: 1,
    bullets: ['Founded a consultancy bridging hardware product development and technical-commercial evaluation; clients in deep-tech.',
      'Led RFQ and RFI evaluation programmes: structured supplier scoring on quality, lead time, traceability, and total landed cost.',
      'Translated measured system behaviour into product decisions, delivering executable engineering scope for stakeholders.'] },
  { title: 'System Architect & Change Control Lead', company: 'Innoviz', period: '2020–2025', page: 1,
    bullets: ['Owned change governance for the LiDAR product line under ASPICE and ISO 26262 traceability requirements.',
      'Coordinated cross-team change requests from OEM customers across optics, electronics, firmware, and validation.',
      'Authored architectural decision records and validation criteria that fed directly into V-model verification plans.'] },
  { title: 'Customer Change Requests Specialist', company: 'Innoviz', period: '2020–2025', page: 2,
    bullets: ['Single point of contact for OEM-driven change requests; converted commercial expectations into testable engineering scope.',
      'Ran weekly cross-functional reviews; tracked KPIs on cycle time, rework, and customer-found defects.',
      'Reduced rework on late-stage changes by formalising the gate criteria for system-level acceptance.'] },
  { title: 'System Architect', company: 'Innoviz', period: '2017–2020', page: 2,
    bullets: ['Defined the system architecture for automotive LiDAR: optics, electronics, FPGA/SoC, and software interfaces.',
      'Specified component-level requirements and validation methods; aligned them with ASPICE and ISO 26262 expectations.',
      'Led design reviews and architectural trade studies for next-generation product variants.'] },
];
const reg = [
  { group: 'Systems, safety and cybersecurity' },
  { l: 'ASPICE', v: 'Requirements, traceability' },
  { group: 'Electrical and EMC', _page: 2 },
  { l: 'DIN EN 61010', v: 'Electrical safety, lab & measurement', _page: 2 },
  { l: 'CISPR 25', v: 'EMC emissions', _page: 2 },
  { l: 'ISO 11452', v: 'EMC immunity', _page: 2 },
  { group: 'Environmental, durability and materials compliance', _page: 2 },
  { l: 'MIL-STD-810G', v: 'Environmental test methods', _page: 2 },
  { l: 'IEC 60529', v: 'Ingress protection (IP)', _page: 2 },
];
const filler = (n, txt) => Array.from({ length: n }, (_, i) => ({ l: 'Item ' + i, v: txt }));
const payload = {
  schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 'blank-repro',
  personal_info: { name: 'Gabriel Alexander Karp-Gershon', email: 'karp.gabriel.a@gmail.com', phone: '+45 31 71 00 72',
    location: 'Copenhagen, Denmark', citizenship: 'EU Citizen', linkedin: 'linkedin.com/in/gabrielkarp' },
  meta: { subtitle: 'Product & Project Expert • Electro-Optics • System Architecture', role: 'R', company: 'C' },
  style: { navy: '#283556' }, font_sizes: { mainBody: 10.5 },
  sections: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text',
      content: 'Hardware project lead with 15 years in automotive LiDAR, consumer cameras, and defence electro-optics. Built modular hardware programmes from requirements to production ramp, including supplier qualification, verification, and certification. Experience spans optics, illumination, detection, FPGA/SoC, and software interfaces under Automotive SPICE and ISO 26262.' },
    { id: 'outcomes', title: 'SELECTED OUTCOMES', loc: 'main', on: true, type: 'list',
      items: [{ v: 'Requirements into engineering scope: translated complex requirements into executable hardware development scope with validation and traceability.' },
        { v: 'Technical-commercial hardware evaluation: founded a consultancy bridging hardware development and technical-commercial evaluation.' }] },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles },
    { id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'labeled_list',
      items: [{ l: 'Project workflow', v: 'Jira, Confluence, Codebeamer ALM' }, { l: 'Architecture', v: 'System architecture, requirements & traceability, MBSE' },
        { l: 'Methods', v: 'Lean, Six Sigma Black Belt, FMEA, DOE, RFQ/RFI evaluation' }, { l: 'Reporting & data', v: 'Power BI, Excel, SQL, Python' },
        { l: 'Engineering', v: 'Python, MATLAB, LabVIEW, Docker' }, { l: 'Domain', v: 'Electro-optics, machine vision, LiDAR, photonics, SPAD, SiPM, TCSPC, optical metrology, semiconductor physics, single-photon detection' }] },
    { id: 'certs', title: 'CERTIFICATIONS', loc: 'sidebar', on: true, type: 'list',
      items: [{ v: 'AI-Practitioner (Teknologisk Institut)' }, { v: 'Six Sigma Black Belt (CSSC)' }, { v: 'Automotive SPICE (Intecs)' }, { v: 'FMEA & APIS (Wanders Eng.)' }, { v: 'Business Analysis (Uni. of Toronto)' }, { v: 'Prøve i dansk 2 (Studiskolen)' }] },
    { id: 'education', title: 'EDUCATION', loc: 'sidebar', on: true, type: 'education',
      items: [{ v: 'MBA: Technion. Strategy, Finance; China Biz Plan, Honourable Mention' }, { v: 'M.Sc. Electrical Engineering: Tel Aviv University — Optics, nanotech.' }, { v: 'B.Sc., Physics & B.Sc., Electrical Engineering: Tel Aviv University' }, { v: 'Dansk FVU: KVUC' }] },
    { id: 'pubs', title: 'PUBLICATIONS & PATENT', loc: 'sidebar', on: true, type: 'list_italic',
      items: [{ v: '"Suspended Carbon Nanotube Integration in Microfabricated Devices" — Karp et al., J. Micromechanics & Microengineering, 2009' }, { v: '"Carbon Nanotube Integration Procedures into NEMS Devices" — Karp et al., Eurosensors Conference Proceedings, 2008' }, { v: 'Patent No. 241997 — Co-inventor of cover window reducing crosstalk between optical components' }] },
    { id: 'regctx', title: 'REGULATORY CONTEXT', loc: 'sidebar', on: true, type: 'labeled_list', items: reg },
    { id: 'additional', title: 'ADDITIONAL INFORMATION', loc: 'sidebar', on: true, type: 'labeled_list',
      items: [{ l: 'Languages', v: 'English (full professional), Hebrew (native), Spanish (professional), Danish (B1)', _page: 2 },
        { l: 'Volunteer', v: 'Operations Manager & Assistant Coach, Copenhagen Wolves RFC (Pan Idræt Rugby)', _page: 2 },
        { l: 'Hobbies', v: 'Rugby, Hiking, tai-chi, reading, supervision of three feline napping experts', _page: 2 }] },
  ],
};

const res = await fetch('https://docx-worker.karp-gabriel-a.workers.dev/generate-pdf', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
});
console.log('status', res.status, res.headers.get('content-type'));
const buf = Buffer.from(await res.arrayBuffer());
if (res.status !== 200) { console.log(buf.toString().slice(0, 400)); process.exit(1); }
writeFileSync('tmp-blank-repro.pdf', buf);
const doc = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;
console.log('pages:', doc.numPages);
for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const text = tc.items.map(i => i.str).join(' ');
  console.log(`page ${p}: ${tc.items.length} items | REGCTX-head:${text.includes('REGULATORY CONTEXT') && !text.includes('(Cont.)') ? 'Y' : 'n'} | Systems-label:${text.includes('Systems, safety') ? 'Y' : 'n'} | ASPICE:${text.includes('ASPICE') ? 'Y' : 'n'} | CustChange:${text.includes('Customer Change Requests') ? 'Y' : 'n'}`);
}
