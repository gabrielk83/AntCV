/* DIAGNOSTIC — CROSS-DEVICE-GEN-LEAK-GUARD (owner 2026-07-08, register row 65 E).
 *
 * "After generating Sigma on desktop the unsolicited application I reviewed on
 * mobile changed to Sigma." The cloud-restore paths (both the cold-restore and
 * the read-from-cloud sync) apply the shared active_application row's meta +
 * sections over the local draft. The existing drift guards only caught
 * local-REAL -> row-empty/unsolicited; the E case is the inverse — local
 * UNSOLICITED, row a FOREIGN-device REAL company — which fell through and
 * clobbered the mobile session.
 *
 * Fix (both sites in app.src.js + app.js): keep the local active app when the
 * active_application pointer was set by a FOREIGN device AND the local company
 * differs from the row. A fresh device (empty local) still restores; same-device
 * and same-company rows still apply.
 *
 * This asserts the exact boolean the guard uses, across the scenarios. Both
 * app.src.js drift sites are kept byte-identical to this logic; the app.js
 * minified mirrors were patched with the same expression (grep __fahA/__fahB). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The guard, as shipped (if(__draftDrift) coerces to boolean).
function keepsLocal({ myDevice, pointerDevice, localCo, rowCo }) {
  const norm = (s) => String(s || '').trim().toLowerCase();
  const cur = norm(localCo), row = norm(rowCo);
  const foreign = !!(pointerDevice && myDevice && String(pointerDevice) !== String(myDevice));
  const foreignHijack = foreign && !!cur && cur !== row;
  const oldDrift = (cur && 'unsolicited' !== cur && ('' === row || 'unsolicited' === row));
  return !!(false /* staleSamePtr isolated */ || foreignHijack || oldDrift);
}

const cases = [
  ['E: mobile unsolicited, desktop(foreign) generates Sigma -> KEEP local', { myDevice: 'm', pointerDevice: 'd', localCo: 'Unsolicited', rowCo: 'Sigma' }, true],
  ['Fresh mobile (no local), foreign Sigma -> restore', { myDevice: 'm', pointerDevice: 'd', localCo: '', rowCo: 'Sigma' }, false],
  ['Same-device generates Sigma while on unsolicited -> restore', { myDevice: 'd', pointerDevice: 'd', localCo: 'Unsolicited', rowCo: 'Sigma' }, false],
  ['Foreign device, same company -> restore (harmless)', { myDevice: 'm', pointerDevice: 'd', localCo: 'Acme', rowCo: 'Acme' }, false],
  ['Foreign Sigma over local real Acme -> KEEP local', { myDevice: 'm', pointerDevice: 'd', localCo: 'Acme', rowCo: 'Sigma' }, true],
  ['Old guard preserved: local real, row unsolicited -> KEEP', { myDevice: 'd', pointerDevice: 'd', localCo: 'Acme', rowCo: 'Unsolicited' }, true],
];

let ok = true;
for (const [name, inp, exp] of cases) {
  const got = keepsLocal(inp);
  const pass = got === exp;
  ok = ok && pass;
  console.log(`${pass ? 'OK  ' : 'FAIL'} keepLocal=${got} (exp ${exp}) — ${name}`);
}

// Sanity: both app.src.js drift sites carry the new guard; both app.js mirrors patched.
const src = readFileSync(path.join(ROOT, 'app.src.js'), 'utf8');
const min = readFileSync(path.join(ROOT, 'app.js'), 'utf8');
const srcSites = (src.match(/__foreignActiveHijack/g) || []).length;
const minSites = (min.match(/__fahA=\(function|__fahB=\(function/g) || []).length;
console.log(`app.src.js __foreignActiveHijack sites: ${srcSites} (expect >=2); app.js mirrors: ${minSites} (expect 2)`);
const wired = srcSites >= 2 && minSites === 2;
if (!wired) ok = false;

console.log(ok ? 'CROSS-DEVICE-GEN-LEAK-GUARD OK' : 'CROSS-DEVICE-GEN-LEAK-GUARD FAILED');
process.exit(ok ? 0 : 1);
