/* CONTRACT — PERSONAL-MERGE-7: the account-locked export (.locked.json,
 * {_antcvBackupUserBound:1}) is recognised as a backup envelope and routed to the
 * decrypting restore path. Loads the real backup-restore lib + importer and
 * asserts the routing contract (the AES round-trip itself needs /api/export-key,
 * which is offline here; export + import share that key endpoint symmetrically).
 */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib331 = await readFile(path.join(ROOT, 'antcv-data-import-331.js'), 'utf8');
const importer = await readFile(path.join(ROOT, 'antcv-data-importer.js'), 'utf8');
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><html><body></body></html>'); });
await new Promise(r => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage();
const errs = []; page.on('pageerror', e => errs.push(String(e && e.message)));
await page.goto(base, { waitUntil: 'load' });
await page.addScriptTag({ content: lib331 });
await page.addScriptTag({ content: importer });
await page.waitForTimeout(150);

const r = await page.evaluate(() => {
  const isEnv = window.AntcvIsBackupEnvelope;
  return {
    hasIsEnvelope: typeof isEnv === 'function',
    userBoundRecognised: typeof isEnv === 'function' && isEnv({ _antcvBackupUserBound: 1, owner: 'g@e.com', iv: 'x', ciphertext: 'y' }) === true,
    plainRecognised: typeof isEnv === 'function' && isEnv({ _antcvBackup: 1 }) === true,
    encryptedRecognised: typeof isEnv === 'function' && isEnv({ _antcvBackupEncrypted: 1 }) === true,
    randomRejected: typeof isEnv === 'function' && isEnv({ personalInfo: {} }) === false,
    hasDataImport: typeof window.AntcvDataImport === 'function',
    hasImporter: !!(window.AntCVImporter && typeof window.AntCVImporter.open === 'function'),
  };
});
console.log(JSON.stringify(r, null, 1));
const pass = r.hasIsEnvelope && r.userBoundRecognised && r.plainRecognised && r.encryptedRecognised &&
  r.randomRejected && r.hasDataImport && r.hasImporter;
console.log('\nRESULT:', pass ? 'PASS' : 'FAIL');
if (errs.length) console.log('pageerrors:', errs.slice(0, 3).join(' | '));
await browser.close(); await new Promise(r => server.close(r));
process.exit(pass ? 0 : 1);
