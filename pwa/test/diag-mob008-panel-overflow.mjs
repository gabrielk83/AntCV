/* DIAGNOSTIC — MOB-008 (deterministic CSS-invariant guard).
 *
 * "Analysis panel stops scrolling once an application is detected." Root cause:
 * antcv-mobile-controls.css pinned `overflow: hidden !important` on the mobile
 * bottom panel with high enough specificity
 * (body.antcv-editor-ready:not(.antcv-generating) .antcv-mobile-bottom-panel)
 * to beat the inline style AND the sidecars' `.arx-mob-scroll` override — so the
 * fixed 33dvh panel clipped its (sidecar-injected, non-flex:1) analysis report
 * and could not scroll. The fix makes those rules clip horizontally only and
 * scroll vertically (overflow-y:auto).
 *
 * This guard loads the REAL antcv-mobile-controls.css against a synthetic panel
 * that carries the exact class/attribute hooks and the exact ancestor body
 * classes the production panel has, at a mobile width, with tall content — and
 * asserts the panel computes overflow-y:auto/scroll and actually scrolls. No
 * React, no network, no hydration => fully deterministic. */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = await readFile(path.join(ROOT, 'antcv-mobile-controls.css'), 'utf8');

const html = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>${css}</style></head>
<body class="antcv-editor-ready">
  <!-- Both class/attribute hooks + both rule variants must scroll: -->
  <div id="p1" class="antcv-mobile-bottom-panel antcv-mobile-panel-fixed"
       data-antcv-app-panel="mobile-bottom-panel" data-antcv-mobile-panel-fixed="true">
    <div class="antcv-panel-grab-zone" style="height:28px"></div>
    <div id="report" style="flex:0 0 auto"></div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
await page.setContent(html);
await page.evaluate(() => {
  const r = document.getElementById('report');
  r.innerHTML = Array.from({ length: 40 }, (_, i) => `<div style="margin-bottom:14px;font-size:14px">Analysis report row ${i + 1} — a realistic length line that wraps in the narrow panel and adds vertical height.</div>`).join('');
});
await page.waitForTimeout(100);

const r = await page.evaluate(() => {
  const p = document.getElementById('p1');
  const cs = getComputedStyle(p);
  const before = p.scrollTop;
  p.scrollTop = 9999;
  const moved = p.scrollTop > before + 50;
  p.scrollTop = 0;
  return {
    overflowY: cs.overflowY,
    overflowX: cs.overflowX,
    clientH: p.clientHeight,
    scrollH: p.scrollHeight,
    contentOverflows: p.scrollHeight > p.clientHeight + 10,
    scrolls: (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && moved,
  };
});
await browser.close();

console.log('panel:', JSON.stringify(r));
const ok = (r.overflowY === 'auto' || r.overflowY === 'scroll')
  && r.overflowX === 'hidden'
  && r.contentOverflows
  && r.scrolls
  && r.clientH >= 150;
console.log(ok ? 'MOB008-PANEL-OVERFLOW OK' : 'MOB008-PANEL-OVERFLOW FAILED');
process.exit(ok ? 0 : 1);
