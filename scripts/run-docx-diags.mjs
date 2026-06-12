// Runs every workers/docx-worker/test/diag-*.mjs sequentially and reports
// one pass/fail. These diags drive the LIVE bundled worker fetch handler
// (workers/docx-worker/src/index.js) in node — they are the current docx
// V&V set. The legacy smoke*.js files import the retired src/generate.js
// (now a placeholder) and are NOT runnable; kept only as history.
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DIR = join(fileURLToPath(import.meta.url), '..', '..', 'workers', 'docx-worker', 'test');
const diags = readdirSync(DIR).filter((f) => /^diag-.*\.mjs$/.test(f)).sort();
let failed = 0;
for (const f of diags) {
  const res = spawnSync(process.execPath, [join(DIR, f)], { encoding: 'utf8' });
  const ok = res.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${f}`);
  if (!ok) {
    console.log((res.stdout || '').split('\n').slice(-12).join('\n'));
    console.log((res.stderr || '').split('\n').slice(-12).join('\n'));
  }
}
console.log(`\n${diags.length - failed}/${diags.length} docx diags passed`);
process.exit(failed ? 1 : 0);
