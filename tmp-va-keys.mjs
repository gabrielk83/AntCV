import fs from 'node:fs';
const s = fs.readFileSync('pwa/app.src.js', 'utf8');
const i = s.indexOf('const va = {');
const seg = s.slice(i, i + 30000);
const keys = [...seg.matchAll(/^\s{10}([a-z_]+): \{\s*$/gm)].map((m) => m[1]);
console.log('va keys:', keys.join(', '));
const labels = [...seg.matchAll(/label: "([^"]+)"/g)].map((m) => m[1]);
console.log('labels:', labels.join(' | '));
// also the swatch map keys
const j = s.indexOf('scandinavian: ["#283556"');
console.log('swatch ctx:', s.slice(j - 200, j + 600).replace(/\s+/g, ' '));
