/* CLUSTER-QUAL-001 §7.6 — weekly-research WRITER regression guard (register row 9).
 *
 * Covers the production 'source=research' writer that closes the last-open leg
 * of the pipeline: insertResearchQualifications + the POST
 * /api/cluster-demand-research endpoint. Same vm-extraction + in-memory fake-D1
 * technique as cluster-qual-extraction.test.mjs (no real SQL engine in the
 * sandbox), plus a source-level lock on the auth/route of the HTTP handler
 * (same rationale as cse-search-proxy.test.mjs — no fetch mock harness here).
 *
 * Run:  node --test workers/access-relay/tests/cluster-demand-research-writer.test.mjs
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

// The CLUSTER-QUAL block (CATEGORY_TO_CLUSTER through the fit/endpoint helpers)
// now includes insertResearchQualifications; pull it + its two callees.
const hasD1Src = extract('function hasD1(env) {', '\n}');
const retrySrc = extract('async function d1RunWithRetry(', '\n}');
const blockSrc = extractUpTo('// CATEGORY-TO-CLUSTER-001', '// ---- One-time KV');

const ctx = { console, Number, Array, Map, Set, Object, JSON, String, Date, Promise, setTimeout: (fn) => { fn(); return 0; } };
vm.createContext(ctx);
vm.runInContext(
  hasD1Src + '\n' + retrySrc + '\n' + blockSrc +
  '\nthis.insertResearchQualifications = insertResearchQualifications; ' +
  'this.recomputeClusterTop20 = recomputeClusterTop20; ' +
  'this.persistQualifications = persistQualifications; ' +
  'this.RESEARCH_WEIGHT = RESEARCH_WEIGHT; this.GLOBAL_USER_HASH = GLOBAL_USER_HASH; ' +
  'this.KNOWN_CLUSTERS = KNOWN_CLUSTERS;',
  ctx
);
const { insertResearchQualifications, recomputeClusterTop20, persistQualifications, RESEARCH_WEIGHT, GLOBAL_USER_HASH, KNOWN_CLUSTERS } = ctx;

// ---- Fake D1 (mirrors cluster-qual-extraction.test.mjs, + the research DELETE) --
function makeFakeDB() {
  let aq = []; // application_qualification rows
  let ctq = []; // cluster_top_qualifications rows
  let nextId = 1;
  function prepare(sql) {
    let bound = [];
    const api = {
      bind(...args) { bound = args; return api; },
      async first() {
        if (sql.includes('SELECT 1 FROM application_qualification')) {
          const [userHash, clusterId, applicationId] = bound;
          return aq.find((r) => r.user_hash === userHash && r.cluster_id === clusterId && r.application_id === applicationId) ? { 1: 1 } : null;
        }
        if (sql.includes('COUNT(DISTINCT application_id) AS n')) {
          const [clusterId] = bound;
          const ids = new Set(aq.filter((r) => r.cluster_id === clusterId && r.source === 'jd').map((r) => r.application_id));
          return { n: ids.size };
        }
        throw new Error('fake DB: unhandled first(): ' + sql);
      },
      async all() {
        if (sql.includes('MAX(qual_text) AS qual_text')) {
          // prior-research snapshot (union): distinct research quals for a cluster
          const [userHash, clusterId] = bound;
          const seen = new Map();
          for (const r of aq.filter((x) => x.user_hash === userHash && x.cluster_id === clusterId && x.source === 'research')) seen.set(r.qual_canonical, r.qual_text);
          return { results: [...seen.entries()].map(([qual_canonical, qual_text]) => ({ qual_canonical, qual_text })) };
        }
        if (sql.includes('GROUP BY qual_canonical')) {
          const [clusterId] = bound;
          const rows = aq.filter((r) => r.cluster_id === clusterId);
          const groups = new Map();
          for (const r of rows) {
            if (!groups.has(r.qual_canonical)) groups.set(r.qual_canonical, { qual_canonical: r.qual_canonical, appIds: new Set(), weight_sum: 0, qual_display: r.qual_text });
            const g = groups.get(r.qual_canonical);
            g.appIds.add(r.application_id);
            g.weight_sum += r.weight;
            g.qual_display = r.qual_text;
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
        throw new Error('fake DB: unhandled all(): ' + sql);
      },
      async run() {
        if (sql.startsWith("DELETE FROM application_qualification")) {
          const [userHash, clusterId] = bound;
          aq = aq.filter((r) => !(r.user_hash === userHash && r.cluster_id === clusterId && r.source === 'research'));
          return { success: true };
        }
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
        throw new Error('fake DB: unhandled run(): ' + sql);
      },
    };
    return api;
  }
  return { prepare, _aq: () => aq, _ctq: () => ctq };
}

const CID = 'pm_process';

// ---- insertResearchQualifications --------------------------------------

test('inserts source=research rows with application_id NULL and RANK-SCALED weights', async () => {
  const env = { DB: makeFakeDB() };
  const n = await insertResearchQualifications(env, CID, [
    { r: 1, q: 'Project management methodology' },
    { r: 2, q: 'Stakeholder management' },
    { r: 20, q: 'English fluency' },
  ], 1000);
  assert.equal(n, 3);
  const rows = env.DB._aq();
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => r.source === 'research'), 'all rows tagged source=research');
  assert.ok(rows.every((r) => r.application_id === null), 'research rows carry a NULL application_id (never inflate jd_count)');
  assert.ok(rows.every((r) => r.user_hash === GLOBAL_USER_HASH), 'written under the global market sentinel');
  // rank 1 -> RESEARCH_WEIGHT; rank 2 -> RESEARCH_WEIGHT*19/20; rank 20 -> RESEARCH_WEIGHT/20
  const byRank = Object.fromEntries(rows.map((r) => [r.qual_text, r.weight]));
  assert.ok(Math.abs(byRank['Project management methodology'] - RESEARCH_WEIGHT) < 1e-9);
  assert.ok(Math.abs(byRank['Stakeholder management'] - RESEARCH_WEIGHT * 19 / 20) < 1e-9);
  assert.ok(Math.abs(byRank['English fluency'] - RESEARCH_WEIGHT * 1 / 20) < 1e-9);
});

test('every research weight stays <= RESEARCH_WEIGHT (< a single real required JD qual = 1.0)', async () => {
  const env = { DB: makeFakeDB() };
  await insertResearchQualifications(env, CID, Array.from({ length: 20 }, (_, i) => ({ r: i + 1, q: 'q' + i })), 1);
  assert.ok(env.DB._aq().every((r) => r.weight <= RESEARCH_WEIGHT + 1e-9 && r.weight > 0));
});

test('after recompute, the research ORDER is preserved (rank 1 tops the rollup) — deterministic, not tied', async () => {
  const env = { DB: makeFakeDB() };
  await insertResearchQualifications(env, CID, [
    { r: 1, q: 'Alpha' }, { r: 2, q: 'Bravo' }, { r: 3, q: 'Charlie' },
  ], 1);
  await recomputeClusterTop20(env, CID);
  const top = env.DB._ctq().filter((r) => r.cluster_id === CID).sort((a, b) => a.rank - b.rank);
  assert.deepEqual(top.map((r) => r.qual_display), ['Alpha', 'Bravo', 'Charlie']);
  assert.equal(top[0].jd_count, 0, 'no real JDs yet -> jd_count 0');
});

test('UNION (nothing is lost): a qual dropped from the new top-20 is RETAINED at a floor weight, not deleted', async () => {
  const env = { DB: makeFakeDB() };
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Old top' }, { r: 2, q: 'Kept' }], 1);
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'New top' }, { r: 2, q: 'Kept' }], 2);
  const rows = env.DB._aq();
  // 'New top' + 'Kept' (fresh) + 'Old top' (retained at floor) = 3 rows, no dup of 'Kept'
  assert.equal(rows.length, 3, 'union: dropped qual retained, fresh set re-written, no duplicate');
  const old = rows.find((r) => r.qual_text === 'Old top');
  assert.ok(old, 'the dropped qual is NOT gone — it is retained');
  assert.ok(Math.abs(old.weight - RESEARCH_WEIGHT / 40) < 1e-9, 'retained at the floor weight (below rank-20)');
  // recompute: the fresh items outrank the retained one, and the top-20 still leads with the current list
  await recomputeClusterTop20(env, CID);
  const top = env.DB._ctq().filter((r) => r.cluster_id === CID).sort((a, b) => a.rank - b.rank);
  assert.deepEqual(top.map((r) => r.qual_display), ['New top', 'Kept', 'Old top'], 'fresh items rank above the retained (demoted) one');
});

test('UNION is stable: a retained qual is not re-duplicated on a THIRD push (still one row)', async () => {
  const env = { DB: makeFakeDB() };
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Dropped' }], 1);
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Fresh A' }], 2); // Dropped retained
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Fresh B' }], 3); // Dropped + Fresh A retained
  const rows = env.DB._aq().filter((r) => r.source === 'research');
  assert.equal(rows.filter((r) => r.qual_text === 'Dropped').length, 1, 'retained qual stays exactly one row across pushes');
  assert.equal(rows.length, 3, 'Fresh B (fresh) + Dropped + Fresh A (retained)');
});

test('UNION: a qual that RESURFACES in a later week gets its real rank-scaled weight back', async () => {
  const env = { DB: makeFakeDB() };
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Comeback' }, { r: 2, q: 'Other' }], 1);
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Other' }], 2); // Comeback dropped -> floor
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Comeback' }, { r: 2, q: 'Other' }], 3); // Comeback back at r1
  const comeback = env.DB._aq().filter((r) => r.qual_text === 'Comeback');
  assert.equal(comeback.length, 1);
  assert.ok(Math.abs(comeback[0].weight - RESEARCH_WEIGHT) < 1e-9, 'resurfaced at rank 1 -> full rank-scaled weight, not the floor');
});

test('a real user JD qual (weight 1.0) outranks every research row after recompute', async () => {
  const env = { DB: makeFakeDB() };
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Research leader' }], 1);
  await persistQualifications(env, { userHash: 'u1', applicationId: 1, category: 'product_management', qualifications: [{ text: 'Real JD skill', weight: 1.0 }] });
  const top = env.DB._ctq().filter((r) => r.cluster_id === CID).sort((a, b) => a.rank - b.rank);
  assert.equal(top[0].qual_display, 'Real JD skill', 'a real required JD qual (1.0) beats the top research row (0.4)');
  assert.equal(top[0].jd_count, 1);
});

test('research re-push never touches real jd rows (only source=research is rewritten/retained)', async () => {
  const env = { DB: makeFakeDB() };
  await persistQualifications(env, { userHash: 'u1', applicationId: 1, category: 'product_management', qualifications: [{ text: 'Real JD skill', weight: 1.0 }] });
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Research A' }], 1);
  await insertResearchQualifications(env, CID, [{ r: 1, q: 'Research B' }], 2); // re-push: B fresh, A retained
  const aq = env.DB._aq();
  assert.equal(aq.filter((r) => r.source === 'jd').length, 1, 'the real jd row is never deleted by a research re-push');
  assert.ok(aq.some((r) => r.source === 'jd' && r.qual_text === 'Real JD skill'));
  assert.equal(aq.filter((r) => r.source === 'research').length, 2, 'union: Research B (fresh) + Research A (retained)');
});

test('unknown cluster id / empty top20 / no D1 are safe no-ops', async () => {
  const env = { DB: makeFakeDB() };
  assert.equal(await insertResearchQualifications(env, 'not_a_cluster', [{ r: 1, q: 'x' }], 1), 0);
  assert.equal(await insertResearchQualifications(env, CID, [], 1), 0);
  assert.equal(await insertResearchQualifications(env, CID, undefined, 1), 0);
  assert.equal(env.DB._aq().length, 0);
  assert.equal(await insertResearchQualifications({}, CID, [{ r: 1, q: 'x' }], 1), 0, 'no D1 binding -> 0, never throws');
});

test('KNOWN_CLUSTERS is exactly the 9 clusters the 12 categories fold into', () => {
  assert.deepEqual(
    [...KNOWN_CLUSTERS].sort(),
    ['consulting', 'data_analytics', 'engineering_software', 'executive', 'finance', 'people_soft', 'photonics_eng', 'pm_process', 'research_phd'].sort()
  );
});

// ---- POST /api/cluster-demand-research : source-level route/auth lock -------

function handlerBody() {
  const start = src.indexOf('async function handleApiClusterDemandResearch(request, env) {');
  assert.ok(start > 0, 'handler must exist');
  const end = src.indexOf('\n// ---- One-time KV', start);
  assert.ok(end > start, 'end marker not found');
  return src.slice(start, end);
}

test('route is wired: POST /api/cluster-demand-research dispatches to the handler', () => {
  assert.match(src, /if \(path === '\/api\/cluster-demand-research' && method === 'POST'\) \{\s*return handleApiClusterDemandResearch\(request, env\);/);
});

test('handler gates on a dedicated write token, NOT the CSE search token and NOT a user JWT', () => {
  const body = handlerBody();
  assert.match(body, /request\.headers\.get\('x-antcv-cluster-research-token'\)/);
  assert.match(body, /if \(!env\.CLUSTER_RESEARCH_TOKEN \|\| tok !== env\.CLUSTER_RESEARCH_TOKEN\)/);
  assert.equal(/identityFromRequest/.test(body), false, 'machine-to-machine — not a signed-in AntCV user');
  assert.equal(/CSE_PROXY_TOKEN/.test(body), false, 'must not reuse the read-only search token for a write');
});

test('handler requires D1 and validates the clusters map before writing', () => {
  const body = handlerBody();
  assert.match(body, /if \(!hasD1\(env\)\) return jsonResponse\(\{ error: 'd1_unavailable' \}, 503/);
  assert.match(body, /missing clusters/);
  assert.match(body, /no_known_clusters/);
});

test('handler inserts ALL clusters first, THEN recomputes each (correct cross-cluster shared_clusters)', () => {
  const body = handlerBody();
  const insertIdx = body.indexOf('insertResearchQualifications(env, cid');
  const recomputeIdx = body.indexOf('recomputeClusterTop20(env, cid)');
  assert.ok(insertIdx > 0 && recomputeIdx > insertIdx, 'the insert loop must precede the recompute loop');
});
