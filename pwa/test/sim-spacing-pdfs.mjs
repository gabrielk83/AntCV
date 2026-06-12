/* SIMULATION — spacing recommendations for Copenhagen Modern + nordic-minimal
 * (owner ask 2026-06-12 evening). Generates REAL PDFs through the LIVE
 * docx-worker /generate-pdf (CloudConvert) for a dense owner-like CV and CL
 * at three spacing configurations:
 *   baseline  — today's defaults (all spacing keys at default = forwarded none)
 *   comfort   — moderate air (the recommendation candidate)
 *   airy      — maximum air within the slider ranges
 * Output: C:/Users/karpg/Downloads/antcv-spacing-sim/{cv,cl}-{config}.pdf
 * One-shot tool, not a test. Run: node pwa/test/sim-spacing-pdfs.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';

const WORKER = 'https://docx-worker.karp-gabriel-a.workers.dev';
const OUT = 'C:/Users/karpg/Downloads/antcv-spacing-sim';
mkdirSync(OUT, { recursive: true });

const cvSections = [
  { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text',
    content: 'Technical product manager with 15 years across automotive LiDAR and electro-optical systems. Works between hardware engineering and customer programmes - change governance, system architecture, requirements traceability. Currently leading programme work in regulated industries.' },
  { id: 'work_style', title: 'Work style', loc: 'main', on: true, type: 'text_inline',
    content: 'Structured, analytical and practical. Clear criteria, early validation, short paths - and written follow-ups so nobody is left guessing.' },
  { id: 'outcomes', title: 'SELECTED OUTCOMES', loc: 'main', on: true, type: 'bullets', items: [
    { b: 'Cut', t: 'change-cycle time from 250 to 10 days via the Change Control Board.' },
    { b: 'Ran', t: 'two ASPICE re-certifications with zero major findings.' },
    { b: 'Reduced', t: 'review cycle time 40% with a pre-board checklist.' },
    { b: 'Built', t: 'the optical characterisation lab and test methodology.' },
    { b: 'Closed', t: '28 customer change requests, none escalated.' },
  ] },
  { id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table', rows: [
    ['Focus Area', 'Strategic Expertise'],
    ['System architecture', 'Hardware-software interface, traceability'],
    ['Change governance', 'Multi-vendor change boards, tier-1 programmes'],
    ['Functional safety', 'ISO 26262 assessor; two ASPICE re-certs'],
    ['Programme delivery', 'Change requests closed under deadline'],
    ['Stakeholder coordination', 'Cross-supplier negotiation, on-time closure'],
  ] },
  { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [
    { id: 'r1', title: 'System Architect & Change Control Lead', company: 'Innoviz Technologies', years: '2020 - 2025', bullets: [
      'Led change control across three automotive tier-1 customer programmes; owned closure and architecture handover.',
      'Introduced ASPICE-aligned pre-board screening; coordinated optical, electrical and software inputs.',
      'Cut average review cycle 40%; supported two ASPICE re-certifications with zero major findings.',
    ] },
    { id: 'r2', title: 'Customer Change Requests Specialist', company: 'Innoviz Technologies', years: '2017 - 2020', bullets: [
      'Owned the change-request workflow for two tier-1 programmes; first contact for engineering and change boards.',
      'Built the requirements-traceability framework later extended by the architect role.',
    ] },
    { id: 'r3', title: 'Senior Electro-Optical Engineer', company: 'Sirin Labs', years: '2014 - 2017', bullets: [
      'Directed a seven-person electro-optical team; owned the optical subsystem specification.',
      'Recruited and onboarded three engineers; established the optical characterisation lab.',
    ] },
    { id: 'r4', title: 'Programme Management Specialist', company: 'Kanzen konsulenter i nord ApS', years: '2022 - 2026', bullets: [
      'Ran the consultancy alongside the Innoviz role; advised three companies on programme governance.',
    ] },
  ] },
  { id: 'recommendations', title: 'RECOMMENDATIONS', loc: 'main', on: true, type: 'text',
    content: 'Danish and international recommenders on request.' },
  { id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'labeled_list', items: [
    { group: 'Project and change' },
    { l: 'Workflow', v: 'Jira, Confluence, ServiceNow' },
    { l: 'Methods', v: 'ASPICE, Six Sigma Black Belt' },
    { group: 'Engineering' },
    { l: 'Software', v: 'Python, MATLAB, LabVIEW' },
    { l: 'Optics', v: 'COMSOL, Zemax' },
  ] },
  { id: 'certs', title: 'CERTIFICATES & COURSES', loc: 'sidebar', on: true, type: 'list', items: [
    'BABOK - IIBA (2022)', 'CNX-CAIP (2024)', 'Six Sigma Black Belt - ASQ (2018)', 'Automotive SPICE - intacs (2021)', 'Prøve i Dansk 2 (2023)',
  ] },
  { id: 'education', title: 'EDUCATION', loc: 'sidebar', on: true, type: 'education', items: [
    { deg: 'MBA', sch: 'Technion (2015)' },
    { deg: 'M.Sc. Electrical Engineering', sch: 'Tel Aviv University (2010)' },
    { deg: 'B.Sc. Physics & EE (dual)', sch: 'Tel Aviv University (2008)' },
  ] },
  { id: 'publications', title: 'PUBLICATIONS & PATENT', loc: 'sidebar', on: true, type: 'list', items: [
    'Optical materials characterisation (2018), Optics Letters.', 'Patent US 9,876,543: Optical sensor arrangement (2017).',
  ] },
  { id: 'additional', title: 'ADDITIONAL INFORMATION', loc: 'sidebar', on: true, type: 'labeled_list', items: [
    { l: 'Languages', v: 'English, Hebrew (native), Spanish, Danish (B1)' },
    { l: 'Volunteer', v: 'Operations Manager, Copenhagen Wolves RFC' },
    { l: 'Accessibility', v: 'Hearing-impaired; appreciates clear visual contact' },
  ] },
];

const clSections = [
  { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text_inline', content: 'Dear Hiring Team,' },
  { id: 'opening', title: 'Opening', loc: 'main', on: true, type: 'text', content: 'I am applying for the Senior Product Manager position because the role\'s combination of customer-facing ownership and operational complexity matches the work I have been doing for the past five years.' },
  { id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'I am a technical product manager with twelve years across hardware programmes and customer-facing operational work in regulated industries. My most recent five years have been at Innoviz, where I led change governance and customer change request closure across three automotive tier-1 customer programmes. The work has lived at the interface between hardware engineering, customer integration, and ASPICE-aligned process discipline.' },
  { id: 'bring', title: 'WHAT I BRING', loc: 'main', on: true, type: 'table', rows: [
    ['Focus Area', 'Strategic Expertise'],
    ['Customer-facing ownership', 'Change-request closure, three tier-1 programmes'],
    ['Operational complexity', 'Multi-vendor governance, ASPICE workflows'],
    ['Stakeholder coordination', 'Cross-supplier negotiation, change boards'],
    ['Process discipline', 'Six Sigma Black Belt, ISO 26262 assessor'],
  ] },
  { id: 'why', title: 'WHY THIS POSITION', loc: 'main', on: true, type: 'text', content: 'This role sits at the intersection of customer-facing product work and operational complexity - the same intersection my last five years have lived in. The industry changes; the underlying work is recognisably the same.' },
  { id: 'contribute', title: 'HOW I WOULD CONTRIBUTE', loc: 'main', on: true, type: 'text_bullets',
    intro: 'My immediate priority would be to map the change-request workflow as it exists today. From there, I would focus on:',
    items: [
      'A structured pre-board screening process for high-impact change requests within the first quarter.',
      'A requirements-traceability baseline the team can audit against.',
      'Applying ASPICE-aligned discipline to the highest-priority governance gap.',
    ],
    closing: 'My aim would be to help the team build a process that is clear, reviewable, and practical.' },
  { id: 'foundation', title: 'FOUNDATION', loc: 'main', on: true, type: 'foundation',
    hands_on: 'I start by framing the decision - the question, the criteria, and what counts as good enough. Then the smallest prototype that exposes the real risk.',
    professionally: 'I keep decisions and their rationale in the open, and surface trade-offs early rather than smuggling them in.' },
  { id: 'closure', title: 'Closure', loc: 'main', on: true, type: 'text', content: 'I would welcome the opportunity to talk through how I could support the team. Kind regards, Gabriel.' },
];

const CONFIGS = {
  baseline: {},
  comfort: { bodyEdgePad: 12, sidebarEdgePad: 11, seamGap: 6, mainEdgeIndent: 14, mainSectionGap: 14, sidebarSectionGap: 12, bodySectionGap: 13, candidateGap: 5 },
  airy: { bodyEdgePad: 18, sidebarEdgePad: 14, seamGap: 12, mainEdgeIndent: 18, mainSectionGap: 22, sidebarSectionGap: 18, bodySectionGap: 20, candidateGap: 8 },
};

const base = (doc, style) => ({
  schema_version: '1.0', doc, language: 'en', layout: doc === 'cl' ? 'linear' : 'two_column',
  filename: 'spacing-sim',
  personal_info: { name: 'Gabriel Alexander Karp-Gershon', email: 'email@example.com', phone: '+45 00 00 00 00', linkedin: 'linkedin.com/in/gabriel-karp', location: '2300, København S' },
  meta: { subtitle: 'Processes • Products • People', role: 'Senior Product Manager', company: 'Maersk' },
  style: { navy: '#283556', accent: '#01B7BB', teal: '#00746E', ...style },
  font_sizes: {},
  sections: doc === 'cl' ? clSections : cvSections,
});

for (const [name, style] of Object.entries(CONFIGS)) {
  for (const doc of ['cv', 'cl']) {
    const t0 = Date.now();
    const res = await fetch(WORKER + '/generate-pdf', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(base(doc, style)),
    });
    if (!res.ok) { console.log(`${doc}-${name}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`); continue; }
    const buf = Buffer.from(await res.arrayBuffer());
    const fp = `${OUT}/${doc}-${name}.pdf`;
    writeFileSync(fp, buf);
    console.log(`${doc}-${name}: ${buf.length} bytes in ${Math.round((Date.now() - t0) / 1000)}s -> ${fp}`);
  }
}
