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
  writer:     ['gen', 'generate', 'generation', 'writer', 'generate_cv', 'generate_cl'],
  // apply_correction is the coherence role's real telemetry label (gen-coherence.js
  // role:'coherence' logs it) — include it so coherence traffic is actually seen.
  coherence:  ['coherence', 'coherence_repair', 'repair', 'apply_correction'],
  supervisor: ['supervisor', 'advisory', 'grounding'],
  // RELAY-TUNE-COVERAGE-GAP-001 (2026-07-13): the two PROXY-side cascades now
  // carry a role (multi-llm.js ROLE_KEYS) so MODEL_ROLES can pin their head.
  // These map to the real telemetry task labels the proxy cascade logs.
  analysis:   ['analyze_fit', 'parse_jd', 'jd_analysis', 'analysis'],
  kernel:     ['kernel', 'kernel_extraction', 'extract', 'ingest'],
};

// The tunable roles = the router's ROLE_KEYS (workers/proxy/src/multi-llm.js). A
// role need NOT already be a key in MODEL_ROLES to be scored — the loop proposes
// a NEW pin for an unpinned role when its telemetry warrants it (owner-gated via
// --apply + deploy). Kept in lockstep with ROLE_KEYS; a drift is caught by the test.
export const TUNABLE_ROLES = ['writer', 'supervisor', 'coherence', 'analysis', 'kernel'];
// An unpinned role leads with the cascade default (DEFAULT_ORDER[0] in multi-llm.js).
export const DEFAULT_HEAD = 'anthropic';

// RELAY-TUNE-COVERAGE-GAP-001 (2026-07-13): the highest-COST telemetry tasks are
// CLIENT-dispatched pass-through (the client's ee() router picks the provider and
// sends x-provider + a provider-specific model id; the proxy forwards it verbatim,
// so MODEL_ROLES CANNOT reorder them — rerouting would 404 on the wrong model id,
// see multi-llm.js "raw-passthrough" lock). The tune loop must NOT pretend to tune
// these; it SURFACES them so the owner can move the lever at the real site (the
// client ee() router default), a separate owner-gated change. Kept for the report.
export const CLIENT_DISPATCH_TASKS = ['compress', 'long_context', 'consensus_poll', 'consensus_reinforce', 'generate', 'gen'];

// The providers the router knows (a proposal may only name one of these).
export const KNOWN_PROVIDERS = ['anthropic', 'openai', 'gemini', 'mistral'];
// RELAY-TUNE-COVERAGE-GAP-001: telemetry logs Anthropic as `claude` but the
// router/MODEL_ROLES id is `anthropic`. Normalize so a claude health row scores
// against the anthropic head (else an anthropic-headed role always reads as
// "no data" and could wrongly flip).
export const normProvider = (p) => (String(p) === 'claude' ? 'anthropic' : String(p));

// ── pure scoring core ────────────────────────────────────────────────────────
// A row is a llm_provider_health record: {provider, task, call_count, success_rate,
// total_cost_usd, retry_rate, p50_latency_ms, health_score, ...}. Returns per-provider
// aggregates for one role (summed across the role's tasks), with a cost-quality score.
export function scoreRows(rows, role, { floor = 0.9, minCalls = 20 } = {}) {
  const tasks = ROLE_TASKS[role] || [role];
  const byProvider = new Map();
  for (const r of rows) {
    if (!r || !tasks.includes(String(r.task))) continue;
    const p = normProvider(r.provider);   // fold telemetry 'claude' onto the router id 'anthropic'
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

// The weighted-blend cost-quality baseline for a role = what its CURRENT provider mix
// already delivers (quality per $ across every provider, weighted by call volume). For an
// UNPINNED role this is the honest thing to beat: pinning it to the cheapest-eligible
// provider is only an improvement if that provider beats the blend the role runs at today
// — never a same-as-status-quo pin (e.g. pinning `analysis` to its dominant-but-expensive
// provider, which just re-states the blend and saves nothing).
export function blendedBaseline(ranked) {
  let calls = 0, cost = 0, qCalls = 0;
  for (const r of ranked) { calls += r.calls; cost += r.costPerCall * r.calls; qCalls += r.quality * r.calls; }
  if (calls <= 0) return { costQuality: 0, quality: 0, costPerCall: 0, calls: 0 };
  const costPerCall = cost / calls, quality = qCalls / calls;
  return { costQuality: costPerCall > 0 ? quality / costPerCall : quality, quality, costPerCall, calls };
}

// Decide the new head per role from `current` MODEL_ROLES + the health `rows`. Bounded +
// hysteresis: keep the current head unless an ELIGIBLE challenger beats it by > margin in
// cost-quality. Never propose an unknown provider or one below the floor.
//
// PINNED roles (already in MODEL_ROLES) are judged against the CURRENT HEAD's score.
// UNPINNED tunable roles (analysis/kernel) are judged against the role's BLENDED baseline
// AND gated behind `activationMinCalls` — a low traffic floor: the loop leaves an unpinned
// role at its cascade default (bypass) until the winning provider has accumulated that many
// calls in the window (owner: "pin analysis/kernel but bypass until traffic grows — set a
// low traffic number"). This stops a premature pin to a thin-data or no-gain provider, and
// auto-activates the pin once a genuinely cheaper provider has proven out at low volume.
export function proposeRoles(current, rows, opts = {}) {
  const { margin = 0.10, activationMinCalls = 30 } = opts;
  const proposed = { ...current };
  const rationale = [];
  // Score every tunable role, not only the ones already pinned in MODEL_ROLES —
  // an unpinned proxy-cascade role (analysis / kernel) is proposable too. Order:
  // pinned roles first (stable diffs), then any tunable role not yet pinned.
  const roles = [...Object.keys(current), ...TUNABLE_ROLES.filter((r) => !(r in current))];
  for (const role of roles) {
    const pinned = role in current;
    const ranked = scoreRows(rows, role, opts);
    const curHead = pinned ? current[role] : DEFAULT_HEAD;  // an unpinned role leads with the cascade default
    const curScore = ranked.find((r) => r.provider === curHead);
    const best = ranked.find((r) => r.eligible);   // top eligible
    let decision = 'keep', to = curHead, why;
    if (!ranked.length) { why = 'no telemetry for this role — keep'; }
    else if (!best) { why = 'no provider meets the adequacy floor — keep (fallback cascade still runs)'; }
    else if (!KNOWN_PROVIDERS.includes(best.provider)) { why = `best (${best.provider}) not a known provider — keep`; }
    else if (best.provider === curHead) { why = `current head is already best (cq=${best.costQuality.toFixed(3)})`; }
    else if (!pinned) {
      // UNPINNED: blended baseline + low-traffic activation floor.
      const blend = blendedBaseline(ranked);
      if (best.calls < activationMinCalls) {
        why = `${best.provider} best but only n=${best.calls} < activation floor ${activationMinCalls} — bypass (leave ${role} at the cascade default until traffic grows)`;
      } else if (best.costQuality > blend.costQuality * (1 + margin)) {
        decision = 'flip'; to = best.provider;
        why = `PIN ${role}→${best.provider} cq=${best.costQuality.toFixed(3)} beats the role's blended baseline cq=${blend.costQuality.toFixed(3)} by > ${(margin * 100).toFixed(0)}% (n=${best.calls} ≥ activation ${activationMinCalls})`;
      } else {
        why = `${best.provider} (cq=${best.costQuality.toFixed(3)}) does not beat the blended baseline cq=${blend.costQuality.toFixed(3)} by margin — no gain, stay unpinned`;
      }
    } else {
      // PINNED: judge against the current head's score.
      const curCq = curScore && curScore.eligible ? curScore.costQuality : 0;
      if (best.costQuality > curCq * (1 + margin)) {
        decision = 'flip'; to = best.provider;
        why = `${best.provider} cq=${best.costQuality.toFixed(3)} beats ${curHead} cq=${curCq.toFixed(3)} by > ${(margin * 100).toFixed(0)}%`;
      } else {
        why = `${best.provider} (cq=${best.costQuality.toFixed(3)}) within ${(margin * 100).toFixed(0)}% of ${curHead} (cq=${curCq.toFixed(3)}) — hysteresis, keep`;
      }
    }
    // Only write a role into the proposal when it is already pinned, or when we are
    // proposing a NEW pin (a flip). A "keep" on an unpinned role stays absent — the
    // router keeps leading it with the cascade default; we don't add MODEL_ROLES noise.
    if (pinned || decision === 'flip') proposed[role] = to;
    rationale.push({ role, from: curHead, to, decision, why, pinned, ranked });
  }
  return { proposed, rationale, changed: JSON.stringify(proposed) !== JSON.stringify(current) };
}

// RELAY-TUNE-COVERAGE-GAP-001: summarize the CLIENT-dispatched pass-through tasks
// (compress / long_context / consensus_*) that MODEL_ROLES cannot reorder, so the
// weekly report can surface the cost lever at its real (client ee()-router) site.
// Returns per-task the current spend split by provider + the cheapest ADEQUATE
// provider (success ≥ floor, ≥ minCalls) — the owner-gated recommendation.
export function summarizeClientDispatch(rows, { floor = 0.9, minCalls = 20 } = {}) {
  const out = [];
  for (const task of CLIENT_DISPATCH_TASKS) {
    const byProv = new Map();
    for (const r of rows) {
      if (!r || String(r.task) !== task) continue;
      const p = normProvider(r.provider);
      const a = byProv.get(p) || { provider: p, calls: 0, ok: 0, cost: 0 };
      const calls = Number(r.call_count) || 0;
      a.calls += calls;
      a.ok += Number(r.success_count != null ? r.success_count : (Number(r.success_rate) || 0) * calls);
      a.cost += Number(r.total_cost_usd) || 0;
      byProv.set(p, a);
    }
    const provs = [...byProv.values()].map((a) => ({
      provider: a.provider, calls: a.calls, cost: a.cost,
      costPerCall: a.calls ? a.cost / a.calls : 0,
      successRate: a.calls ? a.ok / a.calls : 0,
    }));
    if (!provs.length) continue;
    const totalCost = provs.reduce((s, p) => s + p.cost, 0);
    const totalCalls = provs.reduce((s, p) => s + p.calls, 0);
    const lead = [...provs].sort((x, y) => y.cost - x.cost)[0];  // where the money goes now
    const cheapest = [...provs]
      .filter((p) => p.successRate >= floor && p.calls >= minCalls && KNOWN_PROVIDERS.includes(p.provider))
      .sort((x, y) => x.costPerCall - y.costPerCall)[0] || null;
    const potentialSave = cheapest ? Math.max(0, totalCost - cheapest.costPerCall * totalCalls) : 0;
    out.push({ task, totalCost, totalCalls, lead, cheapest, potentialSave, provs });
  }
  return out.sort((a, b) => b.potentialSave - a.potentialSave);
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
    // Low traffic floor before an UNPINNED role (analysis/kernel) is auto-pinned
    // (owner: "bypass until traffic grows — set a low traffic number").
    activationMinCalls: parseInt(arg('activation-min-calls', '30'), 10),
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
  const clientLevers = summarizeClientDispatch(rows, opts);

  if (arg('json', false)) { console.log(JSON.stringify({ current, proposed, changed, rationale, clientLevers }, null, 2)); }
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

    if (clientLevers.length) {
      console.log(`\nCLIENT-DISPATCH LEVERS (NOT MODEL_ROLES-tunable — the proxy forwards the client's`);
      console.log(`x-provider + model verbatim; moving these is a client ee()-router change, owner-gated):`);
      for (const l of clientLevers) {
        const now = `${l.lead.provider} $${l.lead.cost.toFixed(2)} (${l.lead.costPerCall.toFixed(5)}/call)`;
        const to = l.cheapest ? `${l.cheapest.provider} @ $${l.cheapest.costPerCall.toFixed(5)}/call (ok=${(l.cheapest.successRate * 100).toFixed(0)}%)` : 'none adequate';
        console.log(`  ${l.task.padEnd(16)} spend $${l.totalCost.toFixed(2)}/wk · leads ${now}`);
        if (l.cheapest && l.cheapest.provider !== l.lead.provider && l.potentialSave > 0.01)
          console.log(`      ↳ cheapest adequate: ${to} → ~$${l.potentialSave.toFixed(2)}/wk potential (QUALITY-GATE: telemetry flags are blind to format-broken output — verify before moving)`);
      }
    }
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
