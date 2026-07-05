/* CLUSTER-QUAL-001 stage 3 regression guard (register row 9, spec section 6
 * rollout step 6, "PWA: add a fit panel").
 *
 * fetchApplicationFit is the read-side counterpart to stage 2a's
 * computeApplicationFit: GET /api/prefs surfaces it inline on
 * active_application.fit so the PWA fit panel gets fit_score/tier/matched/
 * gaps/jd_count in the SAME round trip it already uses to restore
 * cv_sections/rationale (see PHASE-B comment above handleApiPrefs) — no new
 * endpoint. Extracted via the same vm-extraction technique as
 * cluster-qual-fit-scoring.test.mjs, driven against a purpose-built
 * in-memory fake of application_fit + cluster_top_qualifications.
 *
 * Run:  node --test workers/access-relay/tests/application-fit-read.test.mjs
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

const hasD1Src = extract('function hasD1(env) {', '\n}');
const fetchSrc = extract('async function fetchApplicationFit(', '\n}');

const ctx = { console, JSON, String, Array, Object, Promise };
vm.createContext(ctx);
vm.runInContext(hasD1Src + '\n' + fetchSrc + '\nthis.fetchApplicationFit = fetchApplicationFit;', ctx);
const { fetchApplicationFit } = ctx;

// ---- Fake D1: an in-memory implementation of exactly the two SELECTs
// fetchApplicationFit issues against application_fit and
// cluster_top_qualifications.
function makeFakeDB({ fits, topQuals }) {
  function prepare(sql) {
    let bound = [];
    const api = {
      bind(...args) { bound = args; return api; },
      async first() {
        if (sql.includes('FROM application_fit WHERE application_id')) {
          const [applicationId, userHash] = bound;
          const row = (fits || []).find((f) => f.application_id === applicationId && f.user_hash === userHash);
          return row || null;
        }
        if (sql.includes('FROM cluster_top_qualifications WHERE user_hash = ? AND cluster_id = ?')) {
          const [userHash, clusterId] = bound;
          const key = userHash + '|' + clusterId;
          return (topQuals && topQuals[key]) || null;
        }
        throw new Error('fake DB: unhandled first() query: ' + sql);
      },
    };
    return api;
  }
  return { prepare };
}

test('returns null when D1 is unavailable or applicationId is falsy', async () => {
  assert.equal(await fetchApplicationFit({}, 'u1', 1), null);
  assert.equal(await fetchApplicationFit({ DB: makeFakeDB({}) }, 'u1', null), null);
  assert.equal(await fetchApplicationFit({ DB: makeFakeDB({}) }, 'u1', 0), null);
});

test('returns null when there is no application_fit row yet (unsolicited, or pre-stage-2a save)', async () => {
  const env = { DB: makeFakeDB({ fits: [] }) };
  assert.equal(await fetchApplicationFit(env, 'u1', 101), null);
});

test('shapes a full fit object: score/tier/matched/gaps parsed, plus jd_count from cluster_top_qualifications', async () => {
  const env = {
    DB: makeFakeDB({
      fits: [{
        application_id: 101, user_hash: 'u1', cluster_id: 'pm_process',
        fit_score: 82, tier: 'T1',
        matched: JSON.stringify(['Stakeholder management', 'Six Sigma']),
        gaps: JSON.stringify(['Quantum computing research']),
        computed_at: 1751000000000,
      }],
      topQuals: { 'u1|pm_process': { jd_count: 7 } },
    }),
  };
  const fit = await fetchApplicationFit(env, 'u1', 101);
  // JSON.stringify normalizes vm-realm arrays/objects before comparison —
  // assert.deepStrictEqual treats cross-realm Array instances as unequal
  // even when structurally identical, since fetchApplicationFit executes
  // inside a separate vm context here.
  assert.equal(JSON.stringify(fit), JSON.stringify({
    cluster_id: 'pm_process',
    fit_score: 82,
    tier: 'T1',
    matched: ['Stakeholder management', 'Six Sigma'],
    gaps: ['Quantum computing research'],
    jd_count: 7,
    computed_at: 1751000000000,
  }));
});

test('a missing cluster_top_qualifications row degrades jd_count to 0, never throws', async () => {
  const env = {
    DB: makeFakeDB({
      fits: [{ application_id: 5, user_hash: 'u1', cluster_id: 'data_analytics', fit_score: 40, tier: 'T3', matched: '[]', gaps: '[]', computed_at: 1 }],
      topQuals: {},
    }),
  };
  const fit = await fetchApplicationFit(env, 'u1', 5);
  assert.equal(fit.jd_count, 0);
});

test('a malformed matched/gaps JSON string never throws — degrades to an empty array', async () => {
  const env = {
    DB: makeFakeDB({
      fits: [{ application_id: 9, user_hash: 'u1', cluster_id: 'consulting', fit_score: 10, tier: 'T4', matched: 'not-json', gaps: undefined, computed_at: 1 }],
      topQuals: {},
    }),
  };
  const fit = await fetchApplicationFit(env, 'u1', 9);
  assert.equal(fit.matched.length, 0);
  assert.equal(fit.gaps.length, 0);
});

test('scoped to the requesting user_hash — a fit row belonging to a different user is never returned', async () => {
  const env = {
    DB: makeFakeDB({
      fits: [{ application_id: 101, user_hash: 'someone-else', cluster_id: 'pm_process', fit_score: 90, tier: 'T1', matched: '[]', gaps: '[]', computed_at: 1 }],
    }),
  };
  assert.equal(await fetchApplicationFit(env, 'u1', 101), null);
});

test('never throws even when the DB object is malformed (best-effort, matching computeApplicationFit\'s discipline)', async () => {
  const env = { DB: { prepare() { throw new Error('boom'); } } };
  await assert.doesNotReject(() => fetchApplicationFit(env, 'u1', 101));
  assert.equal(await fetchApplicationFit(env, 'u1', 101), null);
});
