/* gen_test_kernels.mjs — emit v2-schema kernel JSON files for UPLOAD testing of the
 * §4 ingestion pipeline. Each is validated THROUGH the real engine (projectV2ToWorkHistory
 * + detectGaps + mergeKernels) before writing, so what ships actually ingests.
 * Personas: gabriel (compact real-shaped fixture), anita + devon (synthetic test personas —
 * generated content is fine, they are not real people). Run: node scripts/gen_test_kernels.mjs */
import { writeFileSync, mkdirSync } from 'node:fs';
import * as eng from '../pwa/antcv-kernel-ingest.js';

const lang = (defaults) => ({ sourceLang: defaults[0], activeDefaults: defaults,
  crossPolicy: { roleScope: 'crosses', outcomeResult: 'crosses', connectiveProse: 'crosses', companyName: 'invariant', patentNumber: 'invariant', metricsNumerals: 'invariant', toolStandardNames: 'invariant', publicationTitle: 'invariant' },
  roleTitlePolicy: { default: 'crosses', perLangOverride: { da: 'keepSourceWhereIdiomatic' } } });
const rules = (hidden) => ({ 'GEN-IDF-001': { rule: 'Hidden by default; surface on JD relevance.', hiddenByDefault: hidden }, 'VERB-RULE': 'Team context: directed/supervised/ran; never bare "led a team".', outcomePolicy: 'Each surfaced role shows >=1 outcome; numeric results favored.' });

const KERNELS = {
  // compact, real-SHAPED Gabriel fixture (NOT his full canonical kernel — a test file).
  gabriel: {
    schemaVersion: '2.0-kernel', _fixture: 'TEST fixture for upload testing — compact, not the full canonical kernel', tenseMode: 'auto', language: lang(['en', 'da', 'es']),
    personalInfo: { name: 'Gabriel Alexander Karp-Gershon', headline: 'Product & project — processes, products, people', email: 'karp.gabriel.a@gmail.com', location: '2300, København S', languages: [{ lang: 'English', level: 'native' }, { lang: 'Hebrew', level: 'native' }, { lang: 'Spanish', level: 'full professional' }, { lang: 'Danish', level: 'B1' }] },
    generationRules: rules(['idf', 'tau-security']),
    experience: [
      { id: 'kanzen', title: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', start: '2022', end: 'present', isCurrent: true, on: true, scope: ['Systems-engineering, change-governance and GenAI product work for OEMs.', 'RFQ/RFI evaluation and technical-commercial advisory.'], outcomes: [{ title: 'AntCV', result: 'Built and shipped AntCV, an LLM-orchestrated job-application product, solo.', numeric: false }], proofPoints: ['AntCV live PWA + multi-worker Cloudflare backend.'], langInvariantTokens: ['Kanzen Konsulenter ApS', 'AntCV', 'RFQ', 'RFI', 'Cloudflare'] },
      { id: 'innoviz-ccl', title: 'Change Control Lead', company: 'Innoviz Technologies', start: '2020', end: '2025', isCurrent: false, on: true, scope: ['Owned change governance across the automotive LiDAR programme.', 'Chaired a cross-functional Change Control Board.'], outcomes: [{ title: 'cycle', result: 'Cut the change cycle from ~250 to ~10 days; the process generated 30% of FY2025 earnings ($8M NRE).', numeric: true }], proofPoints: ['~250 → ~10 day change cycle.', '$8M NRE, ~30% of FY2025 earnings.'], langInvariantTokens: ['Innoviz Technologies', 'LiDAR', 'ASPICE', '250', '10', '30%', '$8M'] },
      { id: 'sirin', title: 'Senior EO Engineer', company: 'Sirin Labs', start: '2014', end: '2017', isCurrent: false, on: true, scope: ['Senior electro-optics for advanced consumer devices; camera + display stack.'], outcomes: [{ title: 'team + patent', result: 'Directed a 7-engineer EO team and co-invented Patent No. 241997.', numeric: true }], proofPoints: ['Patent No. 241997.', '7-engineer EO team.'], langInvariantTokens: ['Sirin Labs', 'Patent No. 241997', 'EO', '7'] },
      { id: 'idf', title: 'Computer Systems Administrator', company: 'Israel Defense Forces (Communication Corps)', start: '2001', end: '2003', isCurrent: false, on: false, scope: ['Administered classified IT for a technical unit; 100 users, 150 machines.'], outcomes: [{ title: 'helpdesk', result: 'Kept 100 users and 150 machines operational; built the first automated backup-restore.', numeric: true }], proofPoints: ['100 users, 150 machines.'], langInvariantTokens: ['IDF', 'LAN', '100', '150'] },
    ],
    selectedOutcomes: [{ title: 'Change cycle ~250 → ~10 days', result: 'Via a Change Control Board on the OEM LiDAR programme.' }],
  },
  // synthetic ant-themed operations persona (enriched from docs/personas/anita).
  anita: {
    schemaVersion: '2.0-kernel', _fixture: 'TEST persona (synthetic) — Anita Myre-Kornfeldt', tenseMode: 'auto', language: lang(['en', 'da']),
    personalInfo: { name: 'Anita Myre-Kornfeldt', headline: 'Operations & Winter Preparedness Specialist — colony logistics, granary planning & seasonal risk', email: 'anita.kornfeldt@winterready.eu', location: 'Copenhagen, Denmark', languages: [{ lang: 'English', level: 'full professional' }, { lang: 'Danish', level: 'native' }] },
    generationRules: rules(['forager-intern']),
    experience: [
      { id: 'northfield', title: 'Senior Grain Storage Coordinator', company: 'Northfield Cooperative', start: '2026', end: 'present', isCurrent: true, on: true, scope: ['Seasonal food-storage planning for large colonies in Copenhagen.', 'Inventory tracking and contingency planning.'], outcomes: [{ title: 'shortage reduction', result: 'Cut winter shortages by 35% across 12 granaries through tracking and contingency plans.', numeric: true }], proofPoints: ['35% fewer winter shortages; 12 granaries.'], langInvariantTokens: ['Northfield Cooperative', '35%', '12'] },
      { id: 'hillcolony', title: 'Operations Planner', company: 'Hill & Colony Logistics', start: '2026', end: '2026', isCurrent: false, on: true, scope: ['Coordinated grain-transport routes and weather-response plans across the Aarhus region.', 'Owned documentation handover between seasonal teams.'], outcomes: [{ title: 'routes', result: 'Maintained colour-coded tracking across 8 transport routes through repeated rainy-season cycles.', numeric: true }], proofPoints: ['8 transport routes; colour-coded tracking.'], langInvariantTokens: ['Hill & Colony Logistics', 'Aarhus', '8'] },
      { id: 'stockpile', title: 'Junior Harvest Analyst', company: 'Summer Stockpile Group', start: '2026', end: '2026', isCurrent: false, on: true, scope: ['Tracked harvest efficiency and optimised carrying routes between field sectors in Odense.'], outcomes: [{ title: 'reporting', result: 'Produced weekly reports informing the next seasonal cycle.', numeric: false }], proofPoints: ['Weekly harvest-efficiency reports.'], langInvariantTokens: ['Summer Stockpile Group', 'Odense'] },
      { id: 'forager-intern', title: 'Junior Forager (Intern)', company: 'Ant Hill Collective', start: '2025', end: '2026', isCurrent: false, on: false, scope: ['Walked assigned sectors twice daily; logged seed-yield by grid square.'], outcomes: [{ title: 'protocol', result: 'Wrote the first draft of the colony foul-weather protocol; earned the Reliable Returner badge (6 weeks, zero misplaced carries).', numeric: true }], proofPoints: ['Reliable Returner badge; 6 weeks, 0 misplaced carries.'], langInvariantTokens: ['Ant Hill Collective', '6'] },
    ],
    selectedOutcomes: [{ title: '35% fewer winter shortages', result: 'Across 12 granaries via inventory tracking + contingency planning.' }],
  },
  // synthetic career-changer-into-software persona (from docs/personas/devon).
  devon: {
    schemaVersion: '2.0-kernel', _fixture: 'TEST persona (synthetic) — Devon Hale, career-changer into software', tenseMode: 'auto', language: lang(['en']),
    personalInfo: { name: 'Devon Hale', headline: 'Full-stack developer (career-changer) — ex-data analyst shipping production web apps', email: 'devon.hale@example.com', location: 'Manchester, UK', languages: [{ lang: 'English', level: 'native' }] },
    generationRules: rules([]),
    experience: [
      { id: 'freelance', title: 'Freelance Web Developer', company: 'Self-employed', start: '2025', end: 'present', isCurrent: true, on: true, scope: ['Build and ship production web apps for small businesses (React, Node, Postgres).', 'Own scope, delivery and client communication end-to-end.'], outcomes: [{ title: 'apps shipped', result: 'Shipped 6 production web apps; cut one client booking-flow load time by 40%.', numeric: true }], proofPoints: ['6 production apps; 40% faster booking flow.', 'React, Node, Postgres, CI/CD.'], langInvariantTokens: ['React', 'Node', 'Postgres', 'CI/CD', '6', '40%'] },
      { id: 'meridian', title: 'Data Analyst', company: 'Meridian Retail Group', start: '2022', end: '2025', isCurrent: false, on: true, scope: ['Built SQL + Python reporting pipelines and dashboards for retail operations.', 'Automated weekly reporting that had been manual.'], outcomes: [{ title: 'automation', result: 'Automated reporting that saved ~10 analyst-hours per week across 4 teams.', numeric: true }], proofPoints: ['~10 hours/week saved; 4 teams.', 'SQL, Python, Power BI, dbt.'], langInvariantTokens: ['Meridian Retail Group', 'SQL', 'Python', 'Power BI', 'dbt', '10', '4'] },
      { id: 'nordbarrow', title: 'Junior Financial Analyst', company: 'Nordbarrow Consulting', start: '2021', end: '2022', isCurrent: false, on: true, scope: ['Financial modelling and Excel analysis for client engagements.'], outcomes: [{ title: 'models', result: 'Built models supporting 5 client engagements.', numeric: true }], proofPoints: ['5 client engagements.'], langInvariantTokens: ['Nordbarrow Consulting', 'Excel', '5'] },
    ],
    selectedOutcomes: [{ title: 'Shipped 6 production web apps', result: 'React/Node/Postgres, solo, scope-to-delivery.' }],
  },
};

const OUT = 'pwa/test/fixtures/kernel-v2';
mkdirSync(OUT, { recursive: true });
let allOk = true;
for (const [name, kernel] of Object.entries(KERNELS)) {
  // validate THROUGH the real engine
  const wh = eng.projectV2ToWorkHistory(kernel);
  const gaps = eng.detectGaps(kernel);
  const created = eng.mergeKernels(null, kernel);
  const current = kernel.experience.filter((r) => r.isCurrent).map((r) => r.id);
  const ok = wh.length === kernel.experience.length && created.mode === 'create' && current.length >= 1;
  allOk = allOk && ok;
  const file = `${OUT}/${name}-kernel-v2.json`;
  writeFileSync(file, JSON.stringify(kernel, null, 2) + '\n', 'utf8');
  console.log(`${ok ? 'OK ' : 'FAIL'} ${file} — ${kernel.experience.length} roles, current=[${current}], gaps=${gaps.length}, projects=${wh.length}`);
}
console.log(allOk ? 'ALL KERNELS VALID' : 'SOME KERNELS INVALID');
process.exit(allOk ? 0 : 1);
