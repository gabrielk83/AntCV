/* CLUSTER-QUAL-001 stage 2 regression guard (register row 9, spec section 3.3).
 *
 * Extracts the real kernelCorpusTokens / isQualMatched / fitTier /
 * computeApplicationFit helpers from workers/access-relay/src/index.js (same
 * vm-extraction technique as d1-write-retry.test.mjs and
 * cluster-qual-extraction.test.mjs) and drives them against a small
 * purpose-built in-memory fake of cluster_top_qualifications, user_kernel,
 * and application_fit — no real SQL engine is available in this sandbox.
 *
 * Run:  node --test workers/access-relay/tests/cluster-qual-fit-scoring.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

function extract(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start) + endMarker.length;
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}
function extractUpTo(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}

const hasD1Src = extract('function hasD1(env) {', '\n}');
const retrySrc = extract('async function d1RunWithRetry(', '\n}');
// The whole CATEGORY-TO-CLUSTER-001 -> stage-2 block (qualCanonical,
// clusterForCategory, recomputeClusterTop20, persistQualifications,
// kernelCorpusTokens, isQualMatched, fitTier, computeApplicationFit all live
// in this one contiguous span).
const blockSrc = extractUpTo('// CATEGORY-TO-CLUSTER-001', '// ---- One-time KV');

const ctx = { console, Number, Array, Map, Set, JSON, String, Date, Promise, setTimeout: (fn) => { fn(); return 0; } };
vm.createContext(ctx);
vm.runInContext(
  hasD1Src + '\n' + retrySrc + '\n' + blockSrc +
  '\nthis.kernelCorpusTokens = kernelCorpusTokens; this.isQualMatched = isQualMatched; ' +
  'this.fitTier = fitTier; this.computeApplicationFit = computeApplicationFit;',
  ctx
);
const { kernelCorpusTokens, isQualMatched, fitTier, computeApplicationFit } = ctx;

// ---- Fake D1: an in-memory implementation of exactly the statements
// computeApplicationFit issues against cluster_top_qualifications,
// user_kernel, and application_fit.
function makeFakeDB({ topQuals, kernelHistory }) {
  const fits = [];

  function prepare(sql) {
    let bound = [];
    const api = {
      bind(...args) { bound = args; return api; },
      async first() {
        if (sql.includes('FROM user_kernel WHERE user_hash')) {
          const [userHash] = bound;
          return kernelHistory && kernelHistory[userHash] !== undefined
            ? { history: JSON.stringify(kernelHistory[userHash]) }
            : null;
        }
        throw new Error('fake DB: unhandled first() query: ' + sql);
      },
      async all() {
        if (sql.includes('FROM cluster_top_qualifications WHERE user_hash = ? AND cluster_id = ?')) {
          const [userHash, clusterId] = bound;
          const key = userHash + '|' + clusterId;
          return { results: (topQuals && topQuals[key]) || [] };
        }
        throw new Error('fake DB: unhandled all() query: ' + sql);
      },
      async run() {
        if (sql.startsWith('INSERT INTO application_fit')) {
          const [applicationId, userHash, clusterId, fitScore, matched, gaps, tier, computedAt] = bound;
          const i = fits.findIndex((f) => f.application_id === applicationId);
          const row = { application_id: applicationId, user_hash: userHash, cluster_id: clusterId, fit_score: fitScore, matched, gaps, tier, computed_at: computedAt };
          if (i === -1) fits.push(row); else fits[i] = row;
          return { success: true };
        }
        throw new Error('fake DB: unhandled run() query: ' + sql);
      },
    };
    return api;
  }

  return { prepare, _fits: () => fits };
}

// ---- kernelCorpusTokens / isQualMatched -------------------------------

test('kernelCorpusTokens: flattens tools/certifications/education/regulatory/workHistory into tokens', () => {
  const history = {
    tools: [{ l: 'Software', v: 'Python, Docker' }],
    certifications: ['Six Sigma Black Belt'],
    education: [{ deg: 'M.Sc. Electrical Engineering', sch: 'Tel Aviv University' }],
    regulatory: [{ l: 'ASPICE', v: 'Requirements traceability' }],
    workHistory: [{ bullets: ['Chaired the Change Control Board'], outcomes: ['Cut cycle time from 250 to 10 days'], results: ['Reduced LiDAR cost by 90%'] }],
  };
  const tokens = kernelCorpusTokens(history);
  assert.ok(tokens.has('python'));
  assert.ok(tokens.has('docker'));
  assert.ok(tokens.has('sigma'));
  assert.ok(tokens.has('aspice'));
  assert.ok(tokens.has('traceability'));
  assert.ok(tokens.has('chaired'));
  assert.ok(tokens.has('lidar'));
});

test('kernelCorpusTokens: never throws on a missing/malformed history', () => {
  assert.doesNotThrow(() => kernelCorpusTokens(null));
  assert.doesNotThrow(() => kernelCorpusTokens({}));
  assert.doesNotThrow(() => kernelCorpusTokens({ tools: 'not-an-array', workHistory: [null, {}] }));
});

test('isQualMatched: matched when a clear majority of tokens appear in the corpus', () => {
  const corpus = new Set(['stakeholder', 'management', 'cross', 'functional', 'coordination', 'python']);
  assert.equal(isQualMatched('stakeholder management cross functional coordination', corpus), true);
});

test('isQualMatched: NOT matched when most tokens are absent (no fabricated fit)', () => {
  const corpus = new Set(['python', 'docker']);
  assert.equal(isQualMatched('stakeholder management cross functional coordination', corpus), false);
});

test('isQualMatched: empty qualification is never matched', () => {
  assert.equal(isQualMatched('', new Set(['x'])), false);
});

// ---- fitTier ------------------------------------------------------------

test('fitTier: threshold boundaries T1 >= 75, T2 >= 55, T3 >= 35, else T4', () => {
  assert.equal(fitTier(100), 'T1');
  assert.equal(fitTier(75), 'T1');
  assert.equal(fitTier(74), 'T2');
  assert.equal(fitTier(55), 'T2');
  assert.equal(fitTier(54), 'T3');
  assert.equal(fitTier(35), 'T3');
  assert.equal(fitTier(34), 'T4');
  assert.equal(fitTier(0), 'T4');
});

// ---- computeApplicationFit (end-to-end) ---------------------------------

test('computeApplicationFit: a well-evidenced candidate scores high and lists matched quals', async () => {
  const env = {
    DB: makeFakeDB({
      topQuals: {
        'u1|pm_process': [
          { qual_canonical: 'stakeholder management', qual_display: 'Stakeholder management', weight_sum: 2.0 },
          { qual_canonical: 'six sigma', qual_display: 'Six Sigma', weight_sum: 1.0 },
        ],
      },
      kernelHistory: {
        u1: {
          certifications: ['Six Sigma Black Belt'],
          workHistory: [{ bullets: ['Chaired the Change Control Board and drove stakeholder management across teams'] }],
        },
      },
    }),
  };
  await computeApplicationFit(env, 'u1', 101, 'product_management');
  const fit = env.DB._fits()[0];
  assert.ok(fit, 'a fit row must be written');
  assert.equal(fit.tier, 'T1');
  assert.equal(fit.fit_score, 100);
  assert.deepEqual(JSON.parse(fit.matched).sort(), ['Six Sigma', 'Stakeholder management'].sort());
  assert.deepEqual(JSON.parse(fit.gaps), []);
});

test('computeApplicationFit: an unevidenced qualification is a gap, not a fabricated match', async () => {
  const env = {
    DB: makeFakeDB({
      topQuals: {
        'u1|pm_process': [
          { qual_canonical: 'stakeholder management', qual_display: 'Stakeholder management', weight_sum: 1.0 },
          { qual_canonical: 'quantum computing research', qual_display: 'Quantum computing research', weight_sum: 1.0 },
        ],
      },
      kernelHistory: { u1: { workHistory: [{ bullets: ['Owned stakeholder management across engineering'] }] } },
    }),
  };
  await computeApplicationFit(env, 'u1', 102, 'product_management');
  const fit = env.DB._fits()[0];
  assert.equal(fit.fit_score, 50);
  assert.equal(fit.tier, 'T3');
  assert.deepEqual(JSON.parse(fit.matched), ['Stakeholder management']);
  assert.deepEqual(JSON.parse(fit.gaps), ['Quantum computing research']);
});

test('computeApplicationFit: re-scoring the SAME application upserts (does not duplicate rows)', async () => {
  const env = {
    DB: makeFakeDB({
      topQuals: { 'u1|pm_process': [{ qual_canonical: 'python', qual_display: 'Python', weight_sum: 1.0 }] },
      kernelHistory: { u1: { tools: [{ l: 'Software', v: 'Python' }] } },
    }),
  };
  await computeApplicationFit(env, 'u1', 1, 'product_management');
  await computeApplicationFit(env, 'u1', 1, 'product_management');
  assert.equal(env.DB._fits().length, 1);
});

test('computeApplicationFit: unsolicited category is a no-op (no cluster to score against)', async () => {
  const env = { DB: makeFakeDB({ topQuals: {}, kernelHistory: {} }) };
  await computeApplicationFit(env, 'u1', 1, 'unsolicited');
  assert.equal(env.DB._fits().length, 0);
});

test('computeApplicationFit: no top-20 yet is a no-op (nothing to score against)', async () => {
  const env = { DB: makeFakeDB({ topQuals: {}, kernelHistory: { u1: {} } }) };
  await computeApplicationFit(env, 'u1', 1, 'product_management');
  assert.equal(env.DB._fits().length, 0);
});

test('computeApplicationFit: never throws even if D1 is absent (best-effort)', async () => {
  await assert.doesNotReject(() => computeApplicationFit({}, 'u1', 1, 'product_management'));
});

test('computeApplicationFit: a missing/unparseable kernel history never throws, scores as all-gaps', async () => {
  const env = {
    DB: makeFakeDB({
      topQuals: { 'u1|pm_process': [{ qual_canonical: 'python', qual_display: 'Python', weight_sum: 1.0 }] },
      kernelHistory: {}, // no user_kernel row at all
    }),
  };
  await assert.doesNotReject(() => computeApplicationFit(env, 'u1', 1, 'product_management'));
  const fit = env.DB._fits()[0];
  assert.equal(fit.fit_score, 0);
  assert.equal(fit.tier, 'T4');
  assert.deepEqual(JSON.parse(fit.gaps), ['Python']);
});
