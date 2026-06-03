#!/usr/bin/env node
// scripts/audit-hex-literals.mjs
// Pass 2 prerequisite. Two-pass grep for #RRGGBB and rgb(...) across the
// PWA and DOCX worker. Emits docs/audits/pass2-hex-literals.csv per plan §7
// Pass 2 step 7. The wholesale token replacement (deferred to v1.50.1) uses
// this CSV as input.

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['pwa', 'workers/docx-worker'];
const HEX = /#[0-9A-Fa-f]{6}\b/g;
const RGB = /rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)/g;
const OUTFILE = 'docs/audits/pass2-hex-literals.csv';

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else if (/\.(js|css|html|tsx?|json)$/.test(entry.name)) out.push(p);
  }
  return out;
}

function csvCell(s) {
  return /[,"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

const rows = [['file', 'hex_count', 'rgb_count', 'sample_hex', 'sample_rgb', 'notes']];
let totalHex = 0;
let totalRgb = 0;

for (const root of ROOTS) {
  if (!fs.existsSync(root)) continue;
  for (const f of walk(root)) {
    const rel = f.split(path.sep).join('/');
    const txt = fs.readFileSync(f, 'utf8');
    const hex = txt.match(HEX) ?? [];
    const rgb = txt.match(RGB) ?? [];
    if (hex.length === 0 && rgb.length === 0) continue;
    totalHex += hex.length;
    totalRgb += rgb.length;
    let notes = '';
    if (f.endsWith('.css')) notes = 'css-file';
    else if (f.endsWith('.html')) notes = 'html-file';
    else if (f.endsWith('.json')) notes = 'json-data';
    else if (f.endsWith('.map')) notes = 'sourcemap';
    else if (f.endsWith('app.js')) notes = 'minified-bundle';
    else if (rel.startsWith('pwa/antcv-react-islands')) notes = 'react-islands-build-output';
    else notes = 'sidecar';
    rows.push([rel, String(hex.length), String(rgb.length), hex[0] ?? '', rgb[0] ?? '', notes]);
  }
}

rows.sort((a, b) => {
  if (a[0] === 'file') return -1;
  return Number(b[1]) + Number(b[2]) - (Number(a[1]) + Number(a[2]));
});

const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';
fs.writeFileSync(OUTFILE, csv);
console.log(`Wrote ${OUTFILE}`);
console.log(`Files with colour literals: ${rows.length - 1}`);
console.log(`Total hex literals: ${totalHex}`);
console.log(`Total rgb() literals: ${totalRgb}`);
console.log('\nTop 10:');
for (const r of rows.slice(1, 11)) {
  console.log(`  ${r[0]}  hex=${r[1]} rgb=${r[2]}  ${r[5]}`);
}
