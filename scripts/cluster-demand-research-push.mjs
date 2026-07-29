#!/usr/bin/env node
/* CLUSTER-QUAL-001 §7.6 — push the weekly research top-20 into D1 via the
 * access-relay writer (POST /api/cluster-demand-research). The weekly
 * demand-seed tuning routine runs THIS instead of hand-writing D1 rows (the
 * 2026-07-10 manual step OPEN_REGISTER row 9 tracked). It reads a
 * docs/analysis/cluster_top20_research_<date>.json file and forwards its
 * `clusters` map to the relay, which writes source='research' rows (rank-scaled
 * weight, application_id NULL) and recomputes each cluster's global top-20.
 *
 * Usage:
 *   ANTCV_RELAY_URL=https://<relay> CLUSTER_RESEARCH_TOKEN=<tok> \
 *     node scripts/cluster-demand-research-push.mjs [--file <path>] [--dry-run]
 *
 *   --file <path>   research JSON (default: newest docs/analysis/cluster_top20_research_*.json)
 *   --url <url>     relay base URL (default: env ANTCV_RELAY_URL)
 *   --token <tok>   write token (default: env CLUSTER_RESEARCH_TOKEN)
 *   --dry-run       print the request body + target, do NOT POST
 *
 * Exit non-zero on any error so the routine can detect a failed push.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ANALYSIS_DIR = path.join(REPO_ROOT, 'docs', 'analysis');

export function parseArgs(argv) {
  const out = { file: null, url: null, token: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') out.dryRun = true;
    else if (a === '--file') out.file = argv[++i];
    else if (a === '--url') out.url = argv[++i];
    else if (a === '--token') out.token = argv[++i];
  }
  return out;
}

// Newest cluster_top20_research_<date>.json by lexical date in the filename
// (YYYY-MM-DD sorts lexically = chronologically).
export function latestResearchFile(dir = ANALYSIS_DIR) {
  const names = fs.readdirSync(dir)
    .filter((n) => /^cluster_top20_research_\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort();
  if (!names.length) return null;
  return path.join(dir, names[names.length - 1]);
}

// Map the research JSON into the writer's request body. Forwards ONLY {q, r}
// per cluster (the endpoint ignores label/note/share), and carries the file's
// `generated` date so the D1 rows are stamped with the research date, not the
// push time. Throws on a malformed file so the routine fails loudly.
export function buildPayload(json) {
  if (!json || typeof json !== 'object' || !json.clusters || typeof json.clusters !== 'object') {
    throw new Error('research JSON has no `clusters` object');
  }
  const clusters = {};
  let total = 0;
  for (const [cid, c] of Object.entries(json.clusters)) {
    const top20 = Array.isArray(c && c.top20) ? c.top20 : [];
    const items = top20
      .map((it, i) => ({ q: String((it && it.q) || '').trim(), r: Number.isFinite(+(it && it.r)) ? +it.r : i + 1 }))
      .filter((it) => it.q);
    if (!items.length) continue;
    clusters[cid] = { top20: items };
    total += items.length;
  }
  if (!Object.keys(clusters).length) throw new Error('research JSON produced no non-empty clusters');
  return { body: { date: json.generated || undefined, clusters }, total, clusterCount: Object.keys(clusters).length };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = args.file || latestResearchFile();
  if (!filePath || !fs.existsSync(filePath)) {
    console.error('ERROR: no research JSON found (looked for docs/analysis/cluster_top20_research_*.json). Pass --file.');
    process.exit(2);
  }
  let json;
  try { json = JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch (e) { console.error('ERROR: cannot parse', filePath, '-', e.message); process.exit(2); }

  let payload;
  try { payload = buildPayload(json); }
  catch (e) { console.error('ERROR:', e.message); process.exit(2); }

  console.log(`[cluster-demand-research-push] file=${path.relative(REPO_ROOT, filePath)} date=${payload.body.date || '(now)'} clusters=${payload.clusterCount} quals=${payload.total}`);

  if (args.dryRun) {
    console.log(JSON.stringify(payload.body, null, 2));
    console.log('[dry-run] not POSTed.');
    return;
  }

  const base = (args.url || process.env.ANTCV_RELAY_URL || '').replace(/\/+$/, '');
  const token = args.token || process.env.CLUSTER_RESEARCH_TOKEN || '';
  if (!base) { console.error('ERROR: no relay URL (set ANTCV_RELAY_URL or pass --url).'); process.exit(2); }
  if (!token) { console.error('ERROR: no write token (set CLUSTER_RESEARCH_TOKEN or pass --token).'); process.exit(2); }

  const res = await fetch(base + '/api/cluster-demand-research', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-antcv-cluster-research-token': token },
    body: JSON.stringify(payload.body),
  });
  const text = await res.text();
  if (!res.ok) { console.error(`ERROR: relay ${res.status}: ${text.slice(0, 500)}`); process.exit(1); }
  console.log('OK:', text.slice(0, 1000));
}

// Only run main() when invoked directly (not when imported by the test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error('ERROR:', e && e.message || e); process.exit(1); });
}
