#!/usr/bin/env node
// CI-NIGHTLY-CAUSE-SURFACE-001 (row 136). anthropics/claude-code-action reports only
// "result is_error:true"; the real cause ("Credit balance is too low", HTTP 504, ...) sits in
// the execution-output artifact. Print it as an ::error:: annotation and in the step summary.
// Usage: node scripts/ci-surface-agent-error.mjs [path]. Always exits 0 (diagnostic only).
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function describe(raw) {
  let a;
  try { a = JSON.parse(raw); } catch (e) { return 'execution output unreadable: ' + e.message; }
  const r = (Array.isArray(a) ? a : [a]).filter((x) => x && x.type === 'result').pop();
  if (!r) return 'no result entry in execution output';
  const text = String(r.result ?? '').replace(/\s+/g, ' ').trim().slice(0, 300);
  return `agent result: ${text || '(empty)'} | is_error=${r.is_error} api_error_status=${r.api_error_status ?? '-'} turns=${r.num_turns ?? '-'}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const f = process.argv[2] || '/home/runner/work/_temp/claude-execution-output.json';
  const msg = fs.existsSync(f) ? describe(fs.readFileSync(f, 'utf8')) : 'no execution output file (agent never started)';
  console.log('::error::' + msg);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Nightly agent error\n\n${msg}\n`);
  }
}
