#!/usr/bin/env node
/**
 * gen_kernel_snapshot.mjs — regenerate a kernel snapshot from D1 (the source of truth).
 *
 * D1 (ant_memory.user_kernel) is authoritative. This script READS it and emits a
 * deterministic Markdown snapshot. It never writes to D1. The output file is a
 * generated artifact: do not hand-edit it — re-run this instead.
 *
 * Usage:
 *   node scripts/gen_kernel_snapshot.mjs --user <user_hash> [--out <path>]
 *
 * Auth: needs Cloudflare D1 HTTP API creds in env:
 *   CF_ACCOUNT_ID, CF_API_TOKEN, D1_DATABASE_ID (default ant_memory uuid below)
 *
 * In the proxy/Worker context, prefer the D1 binding (env.DB.prepare(...)) over HTTP;
 * the SQL and field extraction below are identical.
 */

const USER = argOf('--user') || 'GVdLYawOzO5SmG8ehBfy0Z6m43pb_5QC';
const OUT  = argOf('--out')  || `docs/personas/gabriel/kernel_snapshot_${ymd()}.md`;
const DBID = process.env.D1_DATABASE_ID || '499c3de9-8371-428a-9b9f-5d695d58e32b';
const ACCT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_API_TOKEN;

function argOf(flag){ const i=process.argv.indexOf(flag); return i>=0?process.argv[i+1]:null; }
function ymd(d=new Date()){ return d.toISOString().slice(0,10); }

async function d1(sql, params=[]) {
  // HTTP path. In a Worker, replace with: return env.DB.prepare(sql).bind(...params).all();
  if (!ACCT || !TOKEN) throw new Error('Set CF_ACCOUNT_ID and CF_API_TOKEN (or run inside a Worker with a DB binding).');
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCT}/d1/database/${DBID}/query`, {
    method:'POST',
    headers:{ 'Authorization':`Bearer ${TOKEN}`, 'Content-Type':'application/json' },
    body: JSON.stringify({ sql, params })
  });
  const j = await r.json();
  if (!j.success) throw new Error('D1 query failed: '+JSON.stringify(j.errors));
  return j.result[0].results;
}

function md(history) {
  const tools = (history.tools||[]).map(t=>`- **${t.l}:** ${t.v}`).join('\n');
  const certs = (history.certifications||[]).map(c=>`- ${c}`).join('\n');
  const langs = (history.languages||[]).map(l=>`${l.name} (${l.level})`).join(', ');
  const clearance = (history.additional||[]).find(a=>/clearance/i.test(a.l||''));
  const eligibility = clearance ? `\n## Eligibility\n- **${clearance.l}:** ${clearance.v}\n` : '';
  const work = (history.workHistory||[]).map(w =>
    `### ${w.role} — ${w.company} (${w.years})\n` + (w.bullets||[]).map(b=>`- ${b}`).join('\n')
  ).join('\n\n');
  return `# Gabriel Kernel Snapshot — ${ymd()}

> **GENERATED ARTIFACT — DO NOT HAND-EDIT.**
> Source of truth: \`ant_memory\` D1 \`user_kernel\` (user_hash \`${USER}\`).
> Regenerate with \`node scripts/gen_kernel_snapshot.mjs\`. Any manual change here will be overwritten.

## Tools
${tools}

## Certifications
${certs}

## Languages
${langs}
${eligibility}
## Work history
${work}
`;
}

const rows = await d1('SELECT history FROM user_kernel WHERE user_hash = ?', [USER]);
if (!rows.length) { console.error('No kernel for user', USER); process.exit(1); }
const history = JSON.parse(rows[0].history);
const out = md(history);
const fs = await import('node:fs/promises');
await fs.mkdir(OUT.split('/').slice(0,-1).join('/'), {recursive:true}).catch(()=>{});
await fs.writeFile(OUT, out);
console.log('Wrote', OUT, `(${out.length} bytes)`);
