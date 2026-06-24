/* DIAGNOSTIC — WITHIN-PACKAGE-STYLE-ALT-RECOLOR-001. Selecting a Quick Alternative
 * (Alt 1 / Alt 2) sets body[data-package-quick-alt="altN"]; the candidate band +
 * table headers read var(--header-bg) and the sidebar reads var(--sidebar-bg), so
 * the per-alt CSS overrides in antcv-packages-registry.css must recolour them. The
 * 2-attribute selector outranks the 1-attribute base block (which carries hand-edits
 * like copenhagen's #33446F band), so the alt wins WITHOUT clobbering the base.
 *
 * PASS = default keeps the (hand-edited) base band; alt1/alt2 recolour band+sidebar
 * to the registry's alt head/sidebar pairs. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(path.join(HERE, '..', 'antcv-packages-registry.css'), 'utf8');
const HTML = `<!doctype html><html><head><style>${CSS}</style></head>
<body data-package="copenhagen-modern">
<div id="band" style="background:var(--header-bg)"></div>
<div id="side" style="background:var(--sidebar-bg)"></div></body></html>`;
const server = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const rgb = h => { const n = parseInt(h.slice(1), 16); return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`; };
const b = await chromium.launch();
const p = await b.newPage();
await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
const read = () => p.evaluate(() => ({
  band: getComputedStyle(document.getElementById('band')).backgroundColor,
  side: getComputedStyle(document.getElementById('side')).backgroundColor,
}));
const def = await read();
await p.evaluate(() => document.body.setAttribute('data-package-quick-alt', 'alt1'));
const a1 = await read();
await p.evaluate(() => document.body.setAttribute('data-package-quick-alt', 'alt2'));
const a2 = await read();
await b.close(); await new Promise(r => server.close(r));

console.log('default band:', def.band, '(base, hand-edited copenhagen #33446F)');
console.log('alt1 band:', a1.band, 'expect', rgb('#0B74DE'), '| sidebar', a1.side, 'expect', rgb('#E8F4F5'));
console.log('alt2 band:', a2.band, 'expect', rgb('#283556'), '| sidebar', a2.side, 'expect', rgb('#DCE5EA'));
const ok = def.band === rgb('#33446F')
  && a1.band === rgb('#0B74DE') && a1.side === rgb('#E8F4F5')
  && a2.band === rgb('#283556') && a2.side === rgb('#DCE5EA')
  && def.band !== a1.band;
console.log(ok ? 'PACKAGE-ALT-RECOLOR OK — base preserved, alts recolor band+sidebar' : 'PACKAGE-ALT-RECOLOR FAILED');
process.exit(ok ? 0 : 1);
