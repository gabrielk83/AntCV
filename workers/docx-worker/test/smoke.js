// Smoke test for the docx worker.
// Calls generateDocx() directly with a representative payload and
// writes the output to ./out.docx. Open it in Word to verify
// no "minor errors" warning shows up.
//
// Run:  node test/smoke.js
//
// This bypasses wrangler so you can iterate on the renderer fast.
// For a full integration test, use `npm run dev` and curl the worker.

import { writeFileSync } from 'node:fs';
import { generateDocx } from '../src/generate.js';
import { validatePayload } from '../src/schema.js';

const payload = {
  schema_version: '1.0',
  doc: 'cv',
  language: 'en',
  layout: 'two_column',
  filename: 'CV_smoke_test',
  personal_info: {
    name: 'Gabriel Alexander Karp-Gershon',
    email: 'example@example.com',
    phone: '+45 00 00 00 00',
    location: 'Copenhagen, Denmark',
    linkedin: 'linkedin.com/in/example',
  },
  meta: {
    subtitle: 'Technical Product Manager  •  Systems Engineering  •  Deep-tech Hardware',
    role: 'Senior Product Manager',
    company: 'ExampleCo',
  },
  style: {
    navy: '#283556',
    accent: '#01B7BB',
    teal: '#00746E',
  },
  font_sizes: {
    mainBody: 10.5,
    nameSize: 16,
  },
  sections: [
    {
      id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'text',
      content: 'Technical product manager and engineer with 15+ years across automotive LiDAR, electro-optical systems, and deep-tech hardware. I work where physics, software, and process meet.',
    },
    {
      id: 'core_comp', title: 'CORE COMPETENCIES', loc: 'main', on: true, type: 'table',
      rows: [
        ['Focus Area', 'Strategic Expertise'],
        ['Technical product leadership', 'Roadmaps that survive contact with hardware reality.'],
        ['Functional safety', 'ISO 26262 HARA authorship, ASIL/SIL assignments, FMEDA support.'],
        ['Change & risk governance', 'Codebeamer, Arena, internal/external safety audits.'],
      ],
    },
    {
      id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience',
      roles: [
        {
          id: 'innoviz', title: 'System Architect & Change Control Lead', company: 'Innoviz Technologies', years: '2017–2025',
          bullets: [
            'Owned automotive LiDAR system architecture across two product generations.',
            'Authored HARA documentation and ASIL assignments for safety-critical subsystems.',
            'Led customer change request triage with seven OEM and Tier-1 partners.',
          ],
        },
        {
          id: 'sirin', title: 'Sr Electro-Optical Engineer', company: 'Sirin Labs', years: '2014–2017',
          bullets: [
            'Led a seven-person EO team delivering custom imaging hardware.',
            'Owned characterisation methodology, lab setup, and supplier qualification.',
          ],
        },
      ],
    },
    {
      id: 'tools', title: 'TOOLS & METHODS', loc: 'sidebar', on: true, type: 'labeled_list',
      items: [
        { l: 'PM', v: 'Codebeamer, Jira, Arena, Confluence' },
        { l: 'Methods', v: 'Lean / Six Sigma, ASPICE, ISO 26262' },
        { l: 'Code', v: 'Python, MATLAB, LabVIEW' },
      ],
    },
    {
      id: 'certs', title: 'CERTIFICATIONS', loc: 'sidebar', on: true, type: 'list',
      items: [
        'BABOK Certified',
        'Six Sigma Black Belt',
        'CNX-CAIP',
        'Automotive SPICE',
        'Prøve i dansk 2',
      ],
    },
    {
      id: 'education', title: 'EDUCATION', loc: 'sidebar', on: true, type: 'education',
      items: [
        { deg: 'MBA', sch: 'Technion — Israel Institute of Technology' },
        { deg: 'M.Sc. Electrical Engineering', sch: 'Tel Aviv University' },
        { deg: 'B.Sc. Physics + B.Sc. Electrical Engineering', sch: 'Tel Aviv University' },
      ],
    },
  ],
};

const errors = validatePayload(payload);
if (errors.length) {
  console.error('Schema validation errors:', errors);
  process.exit(1);
}

const buf = await generateDocx(payload);
writeFileSync('out.docx', buf);
console.log(`Wrote out.docx (${buf.byteLength} bytes). Open it in Word to verify.`);
