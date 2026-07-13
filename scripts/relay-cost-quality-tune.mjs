#!/usr/bin/env node
// relay-cost-quality-tune.mjs — RELAY-COST-QUALITY-TUNE-001 (weekly, docs/qa/SCHEDULED_ROUTINES.md)
//
// Reviews the week's LLM provider telemetry and PROPOSES a new `MODEL_ROLES` for the proxy
// (which provider LEADS each generation role) so cost-per-acceptable-output trends down while
// quality holds. It EMITS A DIFF for an agent/owner to approve; it never deploys, and only
// rewrites wrangler.toml when `--apply` is passed. The router's full cascade is unchanged, so
// every provider stays reachable as a fallback — this only moves the *head* per role.
//
// The lever: `workers/proxy/src/multi-llm.js` roleHeadOrder(env, role, order) moves the provider
// named in `env.MODEL_ROLES[role]` to the HEAD of that role's cascade.
//
// Usage:
//   # live (needs an admin/session token for the relay):
//   ANTCV_RELAY_URL=https://antcv-access-relay.<sub>.workers.dev \
//   ANTCV_ADMIN_TOKEN=<bearer> node scripts/relay-cost-quality-tune.mjs
//   # offline / test against a saved /api/llm-health snapshot:
//   node scripts/relay-cost-quality-tune.mjs --data health.json
//   # apply the proposal to both wrangler.toml files (still no deploy):
//   node scripts/relay-cost-quality-tune.mjs --data health.json --apply
//
// Flags: --floor <0..1 success-rate adequacy floor, default 0.90> · --margin <hysteresis on
//        cost-quality, default 0.10> · --min-calls <sample floor, default 20> · --window <min
//        or "all", default all→widest-with-data> · --apply · --json
//
// Plain node script; the scoring core (scoreRows / proposeRoles) is pure + exported for tests.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROXY_TOMLS = ['workers/proxy/wrangler.toml', 'workers/demo-proxy/wrangler.toml'];

// Which telemetry `task`(s) inform each MODEL_ROLES role. A role with no matching task keeps
// its current head (never guess from unrelated traffic).
export const ROLE_TASKS = {
  writer:     ['gen', 'generate', 'generation', 'writer'],
  coherence:  ['coherence', 'coherence_repair', 'repair'],
  supervisor: ['supervisor', 'advisory'],
};
// The providers the router knows (a proposal may only name one of these).
export const KNOWN_PROVIDERS = ['anthropic', 'openai', 'gemini', 'mistral'];

// ── pure scoring core ────────────────────────────────────────────────────────
// A row is a llm_provider_health record: {provider, task, call_count, success_rate,
// total_cost_usd, retry_rate, p50_latency_ms, health_score, ...}. Returns per-provider
// aggregates for one role (summed across the role's tasks), with a cost-quality score.
export function scoreRows(rows, role, { floor = 0.9, minCalls = 20 } = {}) {
  const tasks = ROLE_TASKS[role] || [role];
  const byProvider = new Map();
  for (const r of rows) {
    if (!r || !tasks.includes(String(r.task))) continue;
    const p = String(r.provider);
    const a = byProvider.get(p) || { provider: p, calls: 0, ok: 0, cost: 0, retry: 0, latency: 0, qw: 0 };
    const calls = Number(r.call_count) || 0;
    a.calls += calls;
    a.ok += Number(r.success_count != null ? r.success_count : (Number(r.success_rate) || 0) * calls);
    a.cost += Number(r.total_cost_usd) || 0;
    a.retry += (Number(r.retry_rate) || 0) * calls;
    a.latency += (Number(r.p50_latency_ms) || 0) * calls;
    a.qw += (Number(r.health_score) != null ? Number(r.health_score) : Number(r.success_rate) || 0) * calls;
    byProvider.set(p, a);
  }
  const out = [];
  for (const a of byProvider.values()) {
    if (a.calls <= 0) continue;
    const successRate = a.ok / a.calls;
    const quality = a.qw / a.calls;                 // 0..1 composite (health_score)
    const costPerCall = a.cost / a.calls;           // USD/call (0 when cost not recorded)
    const retryRate = a.retry / a.calls;
    const latency = a.latency / a.calls;
    // cost-quality = quality per dollar; when cost is unknown (0) rank by quality alone so a
    // provider is never rewarded merely for missing cost data.
    const costQuality = costPerCall > 0 ? quality / costPerCall : quality;
    const eligible = successRate >= floor && a.calls >= minCalls;
    out.push({ provider: a.provider, calls: a.calls, successRate, quality, costPerCall, retryRate, latency, costQuality, eligible });
  }
  // Best first: eligible, then cost-quality, then fewer retries, then lower latency.
  out.sort((x, y) => (y.eligible - x.eligible) || (y.costQuality - x.costQuality) || (x.retryRate - y.retryRate) || (x.latency - y.latency));
  return out;
}

// Decide the new head per role from `current` MODEL_ROLES + the health `rows`. Bounded +
// hysteresis: keep the current head unless an ELIGIBLE challenger beats it by > margin in
// cost-quality. Never propose an unknown provider or one below the floor.
export function proposeRoles(current, rows, opts = {}) {
  const { margin = 0.10 } = opts;
  const proposed = { ...current };
  const rationale = [];
  for (const role of Object.keys(current)) {
    const ranked = scoreRows(rows, role, opts);
    const curHead = current[role];
    const curScore = ranked.find((r) => r.provider === curHead);
    const best = ranked.find((r) => r.eligible);   // top eligible
    let decision = 'keep', to = curHead, why;
    if (!ranked.length) { why = 'no telemetry for this role — keep'; }
    else if (!best) { why = 'no provider meets the adequacy floor — keep (fallback cascade still runs)'; }
    else if (!KNOWN_PROVIDERS.includes(best.provider)) { why = `best (${best.provider}) not a known provider — keep`; }
    else if (best.provider === curHead) { why = `current head is already best (cq=${best.costQuality.toFixed(3)})`; }
    else {
      const curCq = curScore && curScore.eligible ? curScore.costQuality : 0;
      if (best.costQuality > curCq * (1 + margin)) {
        decision = 'flip'; to = best.provider;
        why = `${best.provider} cq=${best.costQuality.toFixed(3)} beats ${curHead} cq=${curCq.toFixed(3)} by > ${(margin * 100).toFixed(0)}%`;
      } else {
        why = `${best.provider} (cq=${best.costQuality.toFixed(3)}) within ${(margin * 100).toFixed(0)}% of ${curHead} (cq=${curCq.toFixed(3)}) — hysteresis, keep`;
      }
    }
    proposed[role] = to;
    rationale.push({ role, from: curHead, to, decision, why, ranked });
  }
  return { proposed, rationale, changed: JSON.stringify(proposed) !== JSON.stringify(current) };
}

// ── IO helpers ───────────────────────────────────────────────────────────────
function arg(name, def = null) {
  const i = process.argv.indexOf('--' + name);
  if (i === -1) return def;
  const v = process.argv[i + 1];
  return (v === undefined || v.startsWith('--')) ? true : v;
}
function readModelRoles(tomlRel) {
  const p = join(REPO, tomlRel);
  const m = existsSync(p) && readFileSync(p, 'utf8').match(/MODEL_ROLES\s*=\s*'([^']*)'/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
function writeModelRoles(tomlRel, roles) {
  const p = join(REPO, tomlRel);
  const s = readFileSync(p, 'utf8');
  const next = s.replace(/MODEL_ROLES\s*=\s*'[^']*'/, `MODEL_ROLES = '${JSON.stringify(roles)}'`);
  writeFileSync(p, next);
}
// Flatten a /api/llm-health response (rows[], or {all:{wN:{rows}}}) to one rows[]. When the
// response carries several windows, pick the widest one that actually has rows (≈ the week).
function rowsFromHealth(health) {
  if (!health) return [];
  if (Array.isArray(health.rows)) return health.rows;
  if (health.all && typeof health.all === 'object') {
    const windows = Object.entries(health.all)
      .map(([k, v]) => ({ min: parseInt(String(k).replace(/^w/, ''), 10) || 0, rows: (v && v.rows) || [] }))
      .filter((w) => w.rows.length)
      .sort((a, b) => b.min - a.min);
    return windows.length ? windows[0].rows : [];
  }
  return [];
}
async function fetchHealth() {
  const base = String(process.env.ANTCV_RELAY_URL || '').replace(/\/+$/, '');
  if (!base) return null;
  const window = arg('window', 'all');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.ANTCV_ADMIN_TOKEN) headers.Authorization = `Bearer ${process.env.ANTCV_ADMIN_TOKEN}`;
  const res = await fetch(`${base}/api/llm-health?window=${encodeURIComponent(window)}`, { headers });
  if (!res.ok) throw new Error(`GET /api/llm-health → ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
  return res.json();
}

async function main() {
  const opts = {
    floor: parseFloat(arg('floor', '0.90')),
    margin: parseFloat(arg('margin', '0.10')),
    minCalls: parseInt(arg('min-calls', '20'), 10),
  };
  const current = readModelRoles(PROXY_TOMLS[0]);
  if (!current) { console.error('could not read MODEL_ROLES from ' + PROXY_TOMLS[0]); process.exit(2); }

  let health;
  const dataFile = arg('data', null);
  if (dataFile) {
    health = JSON.parse(readFileSync(dataFile, 'utf8'));
  } else {
    try { health = await fetchHealth(); }
    catch (e) { console.error('[tune] ' + e.message); process.exit(3); }
    if (!health) { console.error('No telemetry: set ANTCV_RELAY_URL (+ ANTCV_ADMIN_TOKEN) or pass --data <file>.'); process.exit(2); }
  }
  const rows = rowsFromHealth(health);
  const { proposed, rationale, changed } = proposeRoles(current, rows, opts);

  if (arg('json', false)) { console.log(JSON.stringify({ current, proposed, changed, rationale }, null, 2)); }
  else {
    console.log(`\nRELAY-COST-QUALITY-TUNE — ${rows.length} health rows · floor=${opts.floor} margin=${opts.margin} min-calls=${opts.minCalls}\n`);
    for (const r of rationale) {
      const mark = r.decision === 'flip' ? 'FLIP' : 'keep';
      console.log(`  ${r.role.padEnd(11)} ${mark}  ${r.from}${r.to !== r.from ? ' → ' + r.to : ''}`);
      console.log(`    ${r.why}`);
      for (const p of r.ranked.slice(0, 4)) {
        console.log(`      ${p.eligible ? '✓' : '·'} ${p.provider.padEnd(10)} cq=${p.costQuality.toFixed(3)} q=${p.quality.toFixed(2)} $${p.costPerCall.toFixed(5)}/call ok=${(p.successRate * 100).toFixed(0)}% n=${p.calls}`);
      }
    }
    console.log(`\ncurrent  MODEL_ROLES = '${JSON.stringify(current)}'`);
    console.log(`proposed MODEL_ROLES = '${JSON.stringify(proposed)}'`);
    console.log(changed ? '\n→ change proposed.' : '\n→ no change (current heads are optimal / within hysteresis).');
  }

  if (arg('apply', false)) {
    if (!changed) { console.log('\n--apply: nothing to change.'); return; }
    console.log(`\n--apply: ROLLBACK value (keep this) → MODEL_ROLES = '${JSON.stringify(current)}'`);
    for (const t of PROXY_TOMLS) writeModelRoles(t, proposed);
    console.log(`Wrote proposed MODEL_ROLES to: ${PROXY_TOMLS.join(', ')}`);
    console.log('Review the diff, then deploy MANUALLY (this script never deploys):');
    console.log('  gh workflow run deploy.yml -f target=proxy -f mode=deploy -f confirm=proxy');
    console.log('  gh workflow run deploy.yml -f target=demo-proxy -f mode=deploy -f confirm=demo-proxy');
    console.log('Then verify each /health, and log before→after + this rollback value in the weekly report.');
  } else if (changed) {
    console.log('\n(dry run — pass --apply to write wrangler.toml, then deploy manually.)');
  }
}

// Only run main() when invoked directly (not when imported by the test).
if (process.argv[1] && process.argv[1].endsWith('relay-cost-quality-tune.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
