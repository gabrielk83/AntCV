/* UNIT — PERSONAL-MERGE-1 injectLauncher against a synthetic Settings -> Personal
 * column. Bypasses the app boot/gate: builds the exact DOM shape (a flex-column
 * holding the writing-style-picker mount), loads the real sidecar, calls its
 * injector, and asserts the launcher lands in that column with the right label.
 */
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sidecar = await readFile(path.join(ROOT, 'antcv-data-export-360.js'), 'utf8');

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));

await page.setContent(`<!doctype html><html><body>
  <div id="settings-col" style="display:flex;flex-direction:column;width:320px">
    <input id="name" placeholder="Full Name" style="order:-4"/>
    <input id="headline" placeholder="Headline" style="order:-3"/>
    <details style="order:10"><summary>Background</summary></details>
    <section style="order:25;margin-top:16px">
      <div id="antcv-react-writing-style-picker" data-antcv-react-mount="writing-style-picker">
        <select><option>Nordic Minimal</option></select>
      </div>
    </section>
  </div>
</body></html>`);

await page.addScriptTag({ content: sidecar });
await page.waitForTimeout(300);
await page.evaluate(() => window.AntcvDataExport360 && window.AntcvDataExport360._injectUi());
await page.waitForTimeout(100);

const r = await page.evaluate(() => {
  const MARK = 'data-antcv-data-export-ui';
  const col = document.getElementById('settings-col');
  const launcher = document.querySelector('[' + MARK + '="launcher"]');
  const review = document.querySelector('[' + MARK + '="review"]');
  const locked = document.querySelector('[' + MARK + '="locked"]');
  return {
    hasLauncher: !!launcher,
    launcherParentIsCol: !!(launcher && launcher.parentElement === col),
    launcherOrder: launcher ? getComputedStyle(launcher).order : null,
    isFirstChild: !!(launcher && col.firstElementChild === launcher),
    reviewLabel: review ? (review.textContent || '').trim() : null,
    hasLocked: !!locked,
    reviewCount: document.querySelectorAll('[' + MARK + '="review"]').length,
  };
});
console.log(JSON.stringify(r, null, 1));
const pass = r.hasLauncher && r.launcherParentIsCol && r.launcherOrder === '-20' &&
  r.isFirstChild && r.reviewLabel && r.reviewLabel.includes('Review & Edit') &&
  r.hasLocked && r.reviewCount === 1;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close();
process.exit(pass ? 0 : 1);
