// cluster-demand-seed.test.mjs
// ============================================================
// CLUSTER-QUAL-001 stage 4 (spec section 7.6, owner 2026-07-05): the client
// cold-start demand seed (antcv-cluster-demand.js) grew from 3 -> 9 clusters.
// The 3 original clusters (pm_process / photonics_eng / research_phd) are the
// analyst-reviewed 16-JD sample; the 6 new ones (engineering_software,
// data_analytics, consulting, executive, finance, people_soft) are
// research-derived from 2025-2026 market postings (docs/analysis/
// cluster_top20_research_2026-07.json). This extends classifyJD() + demand
// weighting to all 9 clusters so a targeted JD in those categories gets real
// cold-start demand weighting before the live D1 path has data.
//
// Loads the REAL sidecar in a vm sandbox with a fake window/localStorage and
// asserts the shape + classification behaviour, and that untargeted
// (unsolicited) scoring spans ALL 9 clusters (owner 2026-07-05: an open CV is
// weighted by whole-market demand; scoreNorm keeps the score on a [0,1] scale
// regardless of active-cluster count).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-cluster-demand.js', import.meta.url), 'utf8');

const NINE = ['pm_process', 'photonics_eng', 'research_phd',
  'engineering_software', 'data_analytics', 'consulting', 'executive', 'finance', 'people_soft'];
const NEW_SIX = ['engineering_software', 'data_analytics', 'consulting', 'executive', 'finance', 'people_soft'];
const VALID_SHARE = new Set(['ABC', 'AB', 'AC', 'BC', 'none']);

function load(jdText) {
  const sandbox = {
    window: { addEventListener() {} },
    localStorage: { getItem: (k) => (k === 'antcv:lastJdText' ? (jdText || '') : null) },
    console: { debug() {} },
    Set, Object, Array, String, Math, JSON,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return sandbox.window.AntcvClusterDemand;
}

test('exposes all 9 clusters, each with exactly 20 ranked items and a valid share flag', () => {
  const CD = load('');
  assert.equal(Object.keys(CD.clusters).length, 9);
  for (const cid of NINE) {
    const cl = CD.clusters[cid];
    assert.ok(cl, `missing cluster ${cid}`);
    assert.ok(typeof cl.label === 'string' && cl.label.length, `cluster ${cid} needs a label`);
    assert.equal(cl.top20.length, 20, `cluster ${cid} must have exactly 20 items`);
    cl.top20.forEach((row, i) => {
      assert.equal(row[0], i + 1, `${cid} item ${i} rank must be ${i + 1}`);
      assert.ok(typeof row[1] === 'string' && row[1].length, `${cid} item ${i} needs text`);
      assert.ok(VALID_SHARE.has(row[2]), `${cid} item ${i} share "${row[2]}" must be a known SHARE_MULT key`);
    });
  }
});

test('untargeted (unsolicited) scoring spans ALL 9 clusters (owner 2026-07-05 — whole-market demand weighting)', () => {
  const CD = load(''); // no JD -> unsolicited
  // JSON-compare: activeClusters() returns a vm-realm Array, which
  // assert.deepStrictEqual treats as unequal to a host Array even when
  // structurally identical.
  assert.equal(JSON.stringify(CD.activeClusters().slice().sort()), JSON.stringify(NINE.slice().sort()));
});

const CLASSIFY_CASES = {
  engineering_software: 'Senior software engineer: design scalable systems and architecture, build microservices and REST APIs, deploy to AWS cloud with Docker and Kubernetes, automated tests and CI/CD pipelines, code in Python and TypeScript, strong data structures and algorithms.',
  data_analytics: 'Data analyst: write SQL queries, build Power BI and Tableau dashboards, analyse large datasets in Python, statistics and hypothesis testing, data pipelines with dbt and Snowflake, communicate insights to stakeholders, machine learning a plus.',
  consulting: 'Management consultant: structured hypothesis-driven problem solving, financial modelling and quantitative analysis in Excel, build executive PowerPoint slides, client relationship and stakeholder management, market research, workstream project management, strategic thinking.',
  executive: 'Chief Operating Officer: own P&L and financial stewardship, set strategic vision and execution, lead high-performing teams, board and investor communication, drive organisational change and transformation, commercial growth, operational excellence, EBITDA and ROI.',
  finance: 'FP&A analyst: build financial models and forecasts, advanced Excel, month-end close and reporting under IFRS, budgeting and variance analysis, work in SAP ERP, scenario modelling, internal controls and audit compliance, CFA or ACCA preferred.',
  people_soft: 'HR Business Partner: full-cycle recruiting and talent acquisition, employee relations and labour law compliance, Workday HRIS and people analytics, performance management, learning and development, change management, compensation and benefits, DEI initiatives.',
};

for (const [expected, jd] of Object.entries(CLASSIFY_CASES)) {
  test(`classifyJD routes a ${expected} JD into the ${expected} cluster`, () => {
    const CD = load(jd);
    assert.equal(CD.classifyJD(), expected);
  });
}

test('the original 3 clusters still classify correctly despite the expanded cluster space (no regression)', () => {
  const pm = load('Project manager: PMP Agile project management methodology, stakeholder management and cross-functional coordination, requirements management, risk register and mitigation, process improvement Lean Six Sigma, milestone tracking, product lifecycle management, supplier collaboration.');
  assert.equal(pm.classifyJD(), 'pm_process');
  const ph = load('Photonics engineer: optical systems engineering free-space and fiber, photonic integrated circuit design and tape-out, laser systems, optical measurement and calibration, semiconductor silicon-photonics test programs, data acquisition automation in Python, COMSOL simulation.');
  assert.equal(ph.classifyJD(), 'photonics_eng');
  const phd = load('PhD position in experimental optics and spectroscopy: independent research project management, lab work, scientific computing in Python and MATLAB, machine learning and chemometrics, hyperspectral measurement, peer-reviewed publication, conference presentation.');
  assert.equal(phd.classifyJD(), 'research_phd');
});

test('a targeted JD scores its own new cluster higher than an unrelated line does (demand weighting works for the new clusters)', () => {
  const CD = load('FP&A analyst: financial modelling and forecasting, advanced Excel, IFRS reporting, budgeting and variance analysis, SAP ERP, month-end close.');
  // classifyJD picks 'finance' -> score() is against the finance cluster.
  const financeLine = CD.score('Built financial models and forecasts, month-end close under IFRS in SAP');
  const unrelatedLine = CD.score('Wrote unit tests for the frontend animation');
  assert.ok(financeLine > unrelatedLine, 'a finance-relevant line must out-score an unrelated one under a finance JD');
});

test('score()/scoreNorm() never throw and return numbers (read-only contract preserved)', () => {
  const CD = load('');
  assert.equal(typeof CD.score('anything'), 'number');
  assert.equal(typeof CD.scoreNorm('anything'), 'number');
  assert.doesNotThrow(() => CD.score(null));
  assert.doesNotThrow(() => CD.scoreNorm(undefined));
});

test('the new clusters exactly match the CATEGORY_TO_CLUSTER cluster ids the server pipeline uses', () => {
  const CD = load('');
  for (const cid of NEW_SIX) assert.ok(CD.clusters[cid], `server cluster id ${cid} must exist in the client seed`);
});
