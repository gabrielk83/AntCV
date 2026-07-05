/* CLUSTER-QUAL-001 stage 1 regression guard (register row 9).
 *
 * Extracts the real clusterForCategory / qualCanonical / recomputeClusterTop20 /
 * persistQualifications helpers from workers/access-relay/src/index.js (same
 * vm-extraction technique as d1-write-retry.test.mjs) and drives them against a
 * small purpose-built in-memory fake of the two D1 tables they touch
 * (application_qualification, cluster_top_qualifications) — no real SQL engine
 * is available in this sandbox, so the fake pattern-matches on the fixed,
 * known set of SQL statements the helpers actually issue.
 *
 * Run:  node --test workers/access-relay/tests/cluster-qual-extraction.test.mjs
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

// Slice from startMarker up to (EXCLUSIVE of) the next occurrence of endMarker.
function extractUpTo(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}

// Pull the whole CLUSTER-QUAL-001 stage-1 block in one slice (CATEGORY_TO_CLUSTER
// through the end of persistQualifications), plus d1RunWithRetry and hasD1, which
// the block calls.
const hasD1Src = extract('function hasD1(env) {', '\n}');
const retrySrc = extract('async function d1RunWithRetry(', '\n}');
const blockSrc = extractUpTo('// CATEGORY-TO-CLUSTER-001', '// ---- One-time KV');

const ctx = { console, Number, Array, Map, JSON, String, Date, Promise, setTimeout: (fn) => { fn(); return 0; } };
vm.createContext(ctx);
vm.runInContext(
  hasD1Src + '\n' + retrySrc + '\n' + blockSrc +
  '\nthis.clusterForCategory = clusterForCategory; this.qualCanonical = qualCanonical; ' +
  'this.recomputeClusterTop20 = recomputeClusterTop20; this.persistQualifications = persistQualifications;',
  ctx
);
const { clusterForCategory, qualCanonical, recomputeClusterTop20, persistQualifications } = ctx;

// ---- Fake D1: an in-memory implementation of exactly the statements the
// extracted helpers issue against application_qualification / cluster_top_qualifications.
function makeFakeDB() {
  const aq = []; // application_qualification rows
  let ctq = [];  // cluster_top_qualifications rows
  let nextId = 1;

  function prepare(sql) {
    let bound = [];
    const api = {
      bind(...args) { bound = args; return api; },
      async first() {
        if (sql.includes('SELECT 1 FROM application_qualification')) {
          const [userHash, clusterId, applicationId] = bound;
          const hit = aq.find((r) => r.user_hash === userHash && r.cluster_id === clusterId && r.application_id === applicationId);
          return hit ? { 1: 1 } : null;
        }
        if (sql.includes("COUNT(DISTINCT application_id) AS n")) {
          const [userHash, clusterId] = bound;
          const ids = new Set(aq.filter((r) => r.user_hash === userHash && r.cluster_id === clusterId && r.source !== 'seed').map((r) => r.application_id));
          return { n: ids.size };
        }
        throw new Error('fake DB: unhandled first() query: ' + sql);
      },
      async all() {
        if (sql.includes('GROUP BY qual_canonical')) {
          const [userHash, clusterId] = bound;
          const rows = aq.filter((r) => r.user_hash === userHash && r.cluster_id === clusterId);
          const groups = new Map();
          for (const r of rows) {
            if (!groups.has(r.qual_canonical)) groups.set(r.qual_canonical, { qual_canonical: r.qual_canonical, appIds: new Set(), weight_sum: 0, qual_display: r.qual_text });
            const g = groups.get(r.qual_canonical);
            g.appIds.add(r.application_id);
            g.weight_sum += r.weight;
            g.qual_display = r.qual_text; // MAX() — last write wins here, fine for the fake
          }
          const results = [...groups.values()]
            .map((g) => ({ qual_canonical: g.qual_canonical, frequency: g.appIds.size, weight_sum: g.weight_sum, qual_display: g.qual_display }))
            .sort((a, b) => (b.weight_sum - a.weight_sum) || (b.frequency - a.frequency))
            .slice(0, 20);
          return { results };
        }
        if (sql.includes('FROM cluster_top_qualifications WHERE user_hash = ? AND cluster_id != ?')) {
          const [userHash, clusterId] = bound;
          return { results: ctq.filter((r) => r.user_hash === userHash && r.cluster_id !== clusterId).map((r) => ({ cluster_id: r.cluster_id, qual_canonical: r.qual_canonical })) };
        }
        throw new Error('fake DB: unhandled all() query: ' + sql);
      },
      async run() {
        if (sql.startsWith('INSERT INTO application_qualification')) {
          const [applicationId, userHash, clusterId, qualText, qualCanon, weight, source, createdAt] = bound;
          aq.push({ id: nextId++, application_id: applicationId, user_hash: userHash, cluster_id: clusterId, qual_text: qualText, qual_canonical: qualCanon, weight, source, created_at: createdAt });
          return { success: true };
        }
        if (sql.startsWith('DELETE FROM cluster_top_qualifications')) {
          const [userHash, clusterId] = bound;
          ctq = ctq.filter((r) => !(r.user_hash === userHash && r.cluster_id === clusterId));
          return { success: true };
        }
        if (sql.startsWith('INSERT INTO cluster_top_qualifications')) {
          const [userHash, clusterId, rank, qualCanon, qualDisplay, frequency, weightSum, sharedClusters, jdCount, updatedAt] = bound;
          ctq.push({ user_hash: userHash, cluster_id: clusterId, rank, qual_canonical: qualCanon, qual_display: qualDisplay, frequency, weight_sum: weightSum, shared_clusters: sharedClusters, jd_count: jdCount, updated_at: updatedAt });
          return { success: true };
        }
        throw new Error('fake DB: unhandled run() query: ' + sql);
      },
    };
    return api;
  }

  return { prepare, _aq: () => aq, _ctq: () => ctq };
}

// ---- clusterForCategory ----------------------------------------------

test('clusterForCategory: known fold-ins map to the spec\'s example clusters', () => {
  assert.equal(clusterForCategory('engineering_hardware'), 'photonics_eng');
  assert.equal(clusterForCategory('product_management'), 'pm_process');
  assert.equal(clusterForCategory('program_management'), 'pm_process');
  assert.equal(clusterForCategory('operations'), 'pm_process');
  assert.equal(clusterForCategory('research_phd'), 'research_phd');
});

test('clusterForCategory: unsolicited and unknown categories have no cluster', () => {
  assert.equal(clusterForCategory('unsolicited'), null);
  assert.equal(clusterForCategory('not_a_real_category'), null);
});

// ---- qualCanonical ------------------------------------------------------

test('qualCanonical: lowercases, strips punctuation, drops stopwords', () => {
  assert.equal(qualCanonical('Stakeholder Management & Cross-Functional Coordination'), 'stakeholder management cross functional coordination');
  assert.equal(qualCanonical('Project management methodology (PMP / Agile / lifecycle)'), 'project management methodology pmp agile lifecycle');
});

test('qualCanonical: two near-identical phrasings collapse to the same key', () => {
  assert.equal(qualCanonical('The Change Control Board'), qualCanonical('Change Control Board'));
});

// ---- persistQualifications + recomputeClusterTop20 (end-to-end) --------

test('persistQualifications: inserts rows and recomputes top-20 ordered by weight_sum desc', async () => {
  const env = { DB: makeFakeDB() };
  await persistQualifications(env, {
    userHash: 'u1', applicationId: 101, category: 'product_management',
    qualifications: [
      { text: 'Stakeholder management', weight: 1.0 },
      { text: 'Six Sigma', weight: 0.25 },
    ],
  });
  const top = env.DB._ctq().filter((r) => r.user_hash === 'u1' && r.cluster_id === 'pm_process');
  assert.equal(top.length, 2);
  assert.equal(top[0].rank, 1);
  assert.equal(top[0].qual_canonical, 'stakeholder management');
  assert.equal(top[0].weight_sum, 1.0);
  assert.equal(top[1].qual_canonical, 'six sigma');
});

test('persistQualifications: a second application with an overlapping qual bumps its frequency/weight_sum', async () => {
  const env = { DB: makeFakeDB() };
  await persistQualifications(env, { userHash: 'u1', applicationId: 1, category: 'product_management', qualifications: [{ text: 'Stakeholder management', weight: 1.0 }] });
  await persistQualifications(env, { userHash: 'u1', applicationId: 2, category: 'product_management', qualifications: [{ text: 'Stakeholder management', weight: 0.5 }] });
  const top = env.DB._ctq().filter((r) => r.cluster_id === 'pm_process');
  assert.equal(top.length, 1);
  assert.equal(top[0].frequency, 2);
  assert.equal(top[0].weight_sum, 1.5);
});

test('persistQualifications: the SAME application_id is never re-extracted (idempotent re-save)', async () => {
  const env = { DB: makeFakeDB() };
  await persistQualifications(env, { userHash: 'u1', applicationId: 1, category: 'product_management', qualifications: [{ text: 'Stakeholder management', weight: 1.0 }] });
  await persistQualifications(env, { userHash: 'u1', applicationId: 1, category: 'product_management', qualifications: [{ text: 'Stakeholder management', weight: 1.0 }] });
  assert.equal(env.DB._aq().length, 1, 'no duplicate row on a second save of the same application');
});

test('persistQualifications: unsolicited category is a no-op (no cluster, nothing inserted)', async () => {
  const env = { DB: makeFakeDB() };
  await persistQualifications(env, { userHash: 'u1', applicationId: 1, category: 'unsolicited', qualifications: [{ text: 'Anything', weight: 1.0 }] });
  assert.equal(env.DB._aq().length, 0);
});

test('persistQualifications: empty/missing qualifications is a no-op', async () => {
  const env = { DB: makeFakeDB() };
  await persistQualifications(env, { userHash: 'u1', applicationId: 1, category: 'product_management', qualifications: [] });
  await persistQualifications(env, { userHash: 'u1', applicationId: 2, category: 'product_management', qualifications: undefined });
  assert.equal(env.DB._aq().length, 0);
});

test('recomputeClusterTop20: shared_clusters flags a qual that also tops another cluster for the same user', async () => {
  const env = { DB: makeFakeDB() };
  // Seed pm_process's top-20 with "stakeholder management" first.
  await persistQualifications(env, { userHash: 'u1', applicationId: 1, category: 'product_management', qualifications: [{ text: 'Stakeholder management', weight: 1.0 }] });
  // Now feed the SAME qual into a different cluster (photonics_eng) and recompute it.
  await persistQualifications(env, { userHash: 'u1', applicationId: 2, category: 'engineering_hardware', qualifications: [{ text: 'Stakeholder management', weight: 1.0 }] });
  const photonics = env.DB._ctq().filter((r) => r.cluster_id === 'photonics_eng');
  assert.equal(photonics.length, 1);
  assert.deepEqual(JSON.parse(photonics[0].shared_clusters), ['pm_process']);
});

test('persistQualifications: never throws even if D1 is absent (best-effort)', async () => {
  await assert.doesNotReject(() => persistQualifications({}, { userHash: 'u1', applicationId: 1, category: 'product_management', qualifications: [{ text: 'X', weight: 1.0 }] }));
});
