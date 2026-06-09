/* DIAGNOSTIC — DATA-IMPORT-001: backup export → restore round-trip.
 * Loads ONLY the export + import sidecars (no app), seeds a realistic localStorage,
 * captures the backup envelope the export writes, clears storage, restores via
 * window.AntcvDataImport, and asserts every NON-secret key comes back byte-for-byte.
 * Covers (1) plain backup (lossless via dataRaw), (2) encrypted round-trip
 * (PBKDF2/AES-GCM), (3) secret keys excluded from a plain backup. */
import { chromium } from 'playwright';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const EXPORT = await readFile(path.join(ROOT, 'antcv-data-export-360.js'), 'utf8');
const IMPORT = await readFile(path.join(ROOT, 'antcv-data-import-331.js'), 'utf8');
const HTML = `<!doctype html><html><head><meta charset=utf8></head><body>
<script>
  // capture the backup text the export hands to URL.createObjectURL (instead of downloading)
  window.__captured = null;
  const _orig = URL.createObjectURL;
  URL.createObjectURL = function (blob) { window.__captured = blob; try { return _orig.call(URL, blob); } catch (_) { return 'blob:diag'; } };
  HTMLAnchorElement.prototype.click = function () {}; // no-op the download
</script>
<script>${EXPORT}</script>
<script>${IMPORT}</script>
</body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(HTML); });
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => {
  // realistic app keys (all JSON-encoded, as the app's localStorage wrapper stores them)
  localStorage.setItem('doc', JSON.stringify('cv'));
  localStorage.setItem('sections', JSON.stringify({ cv: [{ id: 'profile', type: 'text', content: 'Hi' }], cl: [] }));
  localStorage.setItem('personalInfo', JSON.stringify({ name: 'G K', headline: 'Engineer' }));
  localStorage.setItem('meta', JSON.stringify({ company: 'Unsolicited', subtitle: 'A • B' }));
  localStorage.setItem('antcv:itemPages', JSON.stringify({ foundation: { '1': 2 } }));
  localStorage.setItem('cvSidebarRatio', JSON.stringify(0.42));
  localStorage.setItem('antcv.foundationControls.v1', JSON.stringify({ hands_on: { align: 'left' } }));
  localStorage.setItem('antcv:auth:token', 'SECRET-should-not-be-backed-up');
});
const errs = [];
page.on('pageerror', e => errs.push('pageerror: ' + (e && e.message)));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await page.waitForTimeout(400);

const r = await page.evaluate(async () => {
  const snapshot = () => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; };
  const NONSECRET = ['doc', 'sections', 'personalInfo', 'meta', 'antcv:itemPages', 'cvSidebarRatio', 'antcv.foundationControls.v1'];
  const before = snapshot();

  // ---- (1) PLAIN round-trip ----
  window.__captured = null;
  await window.AntcvDataExport({});                       // no passphrase → plain
  const plainText = await window.__captured.text();
  const plainEnv = JSON.parse(plainText);
  const secretInBackup = !!(plainEnv.dataRaw && plainEnv.dataRaw['antcv:auth:token']);
  // wipe + restore
  localStorage.clear();
  const ipPlain = await window.AntcvDataImport(plainText, { confirm: false, reload: false });
  const afterPlain = snapshot();
  const plainMatch = NONSECRET.every(k => afterPlain[k] === before[k]);

  // ---- (2) ENCRYPTED round-trip ----
  localStorage.clear();
  NONSECRET.forEach(k => localStorage.setItem(k, before[k]));   // reseed non-secret keys
  window.__captured = null;
  await window.AntcvDataExport({ passphrase: 'hunter2' });
  const encText = await window.__captured.text();
  const encEnv = JSON.parse(encText);
  const isEncrypted = encEnv._antcvBackupEncrypted === 1;
  localStorage.clear();
  const ipEnc = await window.AntcvDataImport(encText, { passphrase: 'hunter2', confirm: false, reload: false });
  const afterEnc = snapshot();
  const encMatch = NONSECRET.every(k => afterEnc[k] === before[k]);
  // wrong passphrase must fail cleanly
  localStorage.clear();
  const ipBad = await window.AntcvDataImport(encText, { passphrase: 'wrong', confirm: false, reload: false });

  return {
    secretInBackup, plainMatch, plainRestored: ipPlain.restored, plainOk: ipPlain.ok,
    isEncrypted, encMatch, encOk: ipEnc.ok, badOk: ipBad.ok, badErr: ipBad.error,
    sampleDoc: afterPlain['doc'], sampleSections: afterPlain['sections'],
  };
});
await browser.close(); await new Promise(r => server.close(r));
console.log('plain backup excluded the secret key:', !r.secretInBackup);
console.log('plain restore ok:', r.plainOk, '| items:', r.plainRestored, '| all non-secret keys match:', r.plainMatch);
console.log("  doc restored as:", JSON.stringify(r.sampleDoc), '(expect "\\"cv\\"")');
console.log('encrypted envelope produced:', r.isEncrypted, '| encrypted restore ok + match:', r.encOk, r.encMatch);
console.log('wrong passphrase rejected:', r.badOk === false, '|', r.badErr);
console.log('app errors:', errs.length, errs.slice(0, 2).join(' | '));
const A = !r.secretInBackup;
const B = r.plainOk && r.plainMatch && r.sampleDoc === '"cv"';
const C = r.isEncrypted && r.encOk && r.encMatch;
const D = r.badOk === false;
console.log(`CHECK A (secrets excluded from plain backup): ${A ? 'PASS' : 'FAIL'}`);
console.log(`CHECK B (plain round-trip lossless incl. doc="cv"): ${B ? 'PASS' : 'FAIL'}`);
console.log(`CHECK C (encrypted round-trip lossless): ${C ? 'PASS' : 'FAIL'}`);
console.log(`CHECK D (wrong passphrase rejected): ${D ? 'PASS' : 'FAIL'}`);
const ok = A && B && C && D && errs.length === 0;
console.log(ok ? 'DATA-IMPORT OK' : 'DATA-IMPORT FAIL');
process.exit(ok ? 0 : 1);
