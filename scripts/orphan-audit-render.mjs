// NO-ORPHAN-002 audit helper: renders an export payload (the JSON the PWA POSTs to the docx-worker) into a
// DOCX with the LOCAL worker module, so scripts/orphan-audit.py checks the code that will be deployed.
//
//   node scripts/orphan-audit-render.mjs <payload.json> <out.docx>
//
// The payload is used as-is: run the PWA export preflight first (it writes item_condense / item_scale and
// the NBSP binds) when the audit should see what an export ships.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const [src, out] = process.argv.slice(2);
if (!src || !out) {
  console.error('usage: node scripts/orphan-audit-render.mjs <payload.json> <out.docx>');
  process.exit(2);
}
const worker = join(dirname(fileURLToPath(import.meta.url)), '..', 'workers', 'docx-worker', 'src', 'index.js');
const mod = await import(pathToFileURL(worker).href);
const body = readFileSync(src, 'utf8');
const res = await mod.default.fetch(
  new Request('https://audit.local/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body }),
  {}, { waitUntil() {}, passThroughOnException() {} });
const buf = Buffer.from(await res.arrayBuffer());
if (res.status !== 200) {
  process.stderr.write('worker ' + res.status + ': ' + buf.toString('utf8').slice(0, 300) + '\n');
  process.exit(1);
}
writeFileSync(out, buf);
process.exit(0);   // the worker module keeps handles open
