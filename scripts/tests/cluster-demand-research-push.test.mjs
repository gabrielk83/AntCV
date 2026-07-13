/* CLUSTER-QUAL-001 §7.6 — unit tests for the research push script's pure core
 * (scripts/cluster-demand-research-push.mjs). The POST itself is not exercised
 * (network); buildPayload / parseArgs / latestResearchFile are.
 *
 * Run:  node --test scripts/tests/cluster-demand-research-push.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, buildPayload, latestResearchFile } from '../cluster-demand-research-push.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

test('parseArgs: flags and values', () => {
  assert.deepEqual(parseArgs(['--dry-run']), { file: null, url: null, token: null, dryRun: true });
  assert.deepEqual(parseArgs(['--file', 'a.json', '--url', 'https://r', '--token', 't']),
    { file: 'a.json', url: 'https://r', token: 't', dryRun: false });
});

test('buildPayload: forwards only {q, r}, drops label/note/share, keeps the generated date', () => {
  const { body, total, clusterCount } = buildPayload({
    generated: '2026-07-13',
    clusters: {
      pm_process: { label: 'PM', note: 'x', top20: [{ r: 1, q: 'A', share: 'ABC' }, { r: 2, q: 'B', share: 'none' }] },
    },
  });
  assert.equal(body.date, '2026-07-13');
  assert.equal(clusterCount, 1);
  assert.equal(total, 2);
  assert.deepEqual(body.clusters.pm_process.top20, [{ q: 'A', r: 1 }, { q: 'B', r: 2 }]);
  assert.equal('share' in body.clusters.pm_process.top20[0], false, 'share is not forwarded');
});

test('buildPayload: fills rank from array position when r is missing, drops empty q', () => {
  const { body, total } = buildPayload({
    clusters: { finance: { top20: [{ q: 'first' }, { q: '' }, { q: 'third' }] } },
  });
  // empty-q item is dropped; ranks come from ORIGINAL position (1,2,3)
  assert.deepEqual(body.clusters.finance.top20, [{ q: 'first', r: 1 }, { q: 'third', r: 3 }]);
  assert.equal(total, 2);
  assert.equal(body.date, undefined, 'no generated date -> undefined (writer defaults to now)');
});

test('buildPayload: throws on a malformed / empty research object', () => {
  assert.throws(() => buildPayload(null), /clusters/);
  assert.throws(() => buildPayload({}), /clusters/);
  assert.throws(() => buildPayload({ clusters: { x: { top20: [] } } }), /no non-empty clusters/);
});

test('latestResearchFile: picks the newest dated file (lexical = chronological)', () => {
  const picked = latestResearchFile(path.join(REPO_ROOT, 'docs', 'analysis'));
  assert.ok(picked, 'a research file exists in the repo');
  assert.match(path.basename(picked), /^cluster_top20_research_\d{4}-\d{2}-\d{2}\.json$/);
  // it must be >= every other dated research file
  const all = fs.readdirSync(path.join(REPO_ROOT, 'docs', 'analysis'))
    .filter((n) => /^cluster_top20_research_\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
  assert.equal(path.basename(picked), all[all.length - 1]);
});

test('buildPayload: the real latest research file yields a well-formed 9-cluster payload', () => {
  const file = latestResearchFile(path.join(REPO_ROOT, 'docs', 'analysis'));
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { body, clusterCount, total } = buildPayload(json);
  assert.equal(clusterCount, 9, 'all 9 clusters forwarded');
  assert.equal(total, 180, '9 clusters x 20 quals');
  for (const c of Object.values(body.clusters)) {
    assert.equal(c.top20.length, 20);
    assert.ok(c.top20.every((it) => it.q && it.r >= 1 && it.r <= 20));
  }
});
