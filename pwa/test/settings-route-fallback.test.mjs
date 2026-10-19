/* Unit test — SETTINGS-ROUTE-NOOP-001 (2026-10-19).
 * The React-islands SettingsRouter replaces window._antcvOpenSettingsRoute in a
 * useEffect. Its nav.openSettings() only records the intent and calls
 * window._antcvOpenSettings, which app.js never exposes, so when the effect ran
 * after app.js's last render every caller got a silent no-op. The hook must
 * fall back to app.js's route (live global, else the one it replaced).
 * Real-browser proof: pwa/test/diag-settings-history-guard.mjs.
 */
import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8');

test('source: SettingsRouter falls back to the app.js route', () => {
  const src = read('src/islands/SettingsRouter/SettingsRouter.tsx');
  assert.match(src, /SETTINGS-ROUTE-NOOP-001/);
  assert.match(src, /const appRoute = live && live !== hook \? live : prev;/);
  assert.match(src, /openSettings: \(intent\?: SettingsRouteIntent\) => open\(intent\)/);
});

test('bundle: the built panels bundle carries the fallback', () => {
  const js = read('pwa/antcv-react-islands-panels.js');
  assert.ok(js.includes('[SettingsRouter] fallback route failed'), 'fallback missing from the panels bundle');
  assert.ok(!js.includes('window._antcvOpenSettingsRoute=r=>e.openSettings(r)'), 'old no-op hook still in the bundle');
});

test('bundle: core loads panels with its own VERSION as ?v', () => {
  const core = read('pwa/antcv-react-islands.js');
  const name = (core.match(/islands-panels\.js\?v="\+([A-Za-z_$][\w$]*)/) || [])[1];
  assert.ok(name, 'panels loader not found in the core bundle');
  const v = (core.match(new RegExp(`const ${name.replace(/\$/g, '\\$')}="([^"]+)"`)) || [])[1];
  const src = (read('src/main-core.tsx').match(/const VERSION = '([^']+)'/) || [])[1];
  assert.ok(v && v === src, `core bundle VERSION ${v} != src/main-core.tsx ${src}`);
});
