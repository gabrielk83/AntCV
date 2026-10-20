// brand-ink-fit.test.mjs — BRAND-INK-FIT-001 (2026-10-20)
// Terma app 3511: band painted #ffc92b while styleConfig kept headerInk /
// sidebarInk = #ffffff from an earlier brand -> white text on a near-white band.
// Locks: (1) the sidecar's fit rule on the exact stored state, (2) both bundles
// route saves + restores through it, (3) index.html loads it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadSidecar() {
  const store = new Map();
  const win = {};
  const ctx = {
    window: win,
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) },
    setInterval: () => 0, clearInterval: () => {},
  };
  win.__antcvResolvePaperVars = () => ({
    '--header-bg': '#ffc92b', '--header-name-color': '#ffffff', '--header-spec-color': '#ffffff',
    '--header-contact-color': '#ffffff', '--sidebar-bg': '#ffc92b', '--sidebar-text-color': '#ffffff', '--sidebar-head-color': '#ffffff',
  });
  vm.createContext(ctx);
  vm.runInContext(await readFile(new URL('../../antcv-brand-ink-fit.js', import.meta.url), 'utf8'), ctx);
  return { win, store };
}

const wlin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
const L = (h) => 0.2126 * wlin(parseInt(h.slice(1, 3), 16)) + 0.7152 * wlin(parseInt(h.slice(3, 5), 16)) + 0.0722 * wlin(parseInt(h.slice(5, 7), 16));
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

test('Terma stored state: stale white inks on a yellow band are re-derived', async () => {
  const { win } = await loadSidecar();
  const cfg = { headerBg: '#ffc92b', sidebarBg: '#ffc92b', headerInk: '#ffffff', sidebarInk: '#ffffff',
    headerNameColor: '#111111', headerSpecColor: '#111111', headerContactColor: '#111111', sidebarTextColor: '#111111', sidebarHeadColor: '#111111' };
  win.__antcvInkFit(cfg, { headerBg: '#ffc92b', sidebarBg: '#ffc92b', headerNameColor: '#111111' });
  for (const k of ['headerInk', 'headerNameColor', 'headerSpecColor', 'headerContactColor']) assert.ok(ratio(cfg[k], cfg.headerBg) >= 4.5, k);
  for (const k of ['sidebarInk', 'sidebarTextColor', 'sidebarHeadColor']) assert.ok(ratio(cfg[k], cfg.sidebarBg) >= 4.5, k);
});

test('new dark band re-derives an ink the patch did not set (no carry-over)', async () => {
  const { win } = await loadSidecar();
  const cfg = { headerBg: '#0d64aa', sidebarBg: '#0d64aa', headerNameColor: '#111111', sidebarTextColor: '#111111', headerInk: '#111111', sidebarInk: '#111111' };
  win.__antcvInkFit(cfg, { headerBg: '#0d64aa', sidebarBg: '#0d64aa' });
  assert.equal(cfg.headerNameColor, '#FFFFFF');
  assert.equal(cfg.sidebarTextColor, '#FFFFFF');
  assert.equal(cfg.headerInk, '#FFFFFF');
});

test('a legible ink the caller sets is kept', async () => {
  const { win } = await loadSidecar();
  const cfg = { headerBg: '#0d64aa', headerNameColor: '#ffc92b' };
  win.__antcvInkFit(cfg, { headerNameColor: '#ffffff' });
  assert.equal(cfg.headerNameColor, '#ffffff');
});

test('preview resolver is guarded against its own bg', async () => {
  const { win } = await loadSidecar();
  const v = win.__antcvResolvePaperVars({});
  assert.ok(ratio(v['--header-name-color'], '#ffc92b') >= 4.5);
  assert.ok(ratio(v['--sidebar-text-color'], '#ffc92b') >= 4.5);
});

test('kill switch leaves the config untouched', async () => {
  const { win, store } = await loadSidecar();
  store.set('antcv:disable-brand-ink-fit', '1');
  const cfg = { headerBg: '#ffc92b', headerNameColor: '#ffffff' };
  win.__antcvInkFit(cfg, { headerBg: '#ffc92b' });
  assert.equal(cfg.headerNameColor, '#ffffff');
});

test('mirror lock: both bundles route saves + restores through the fit, index loads it', async () => {
  const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
  const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
  const idx = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
  for (const [n, s] of [['app.js', app], ['app.src.js', src]]) {
    assert.ok(/__antcvInkFit\(t,\s*e\)/.test(s), n + ': save path fits inks');
    assert.ok((s.match(/__antcvInkFor\(__sc2\.headerBg/g) || []).length === 2, n + ': both restore sites derive ink');
    assert.ok(!/headerInk:\s*__sc2\.headerInk\s*\|\|\s*"#ffffff",\s*sidebarBg/.test(s), n + ': no hardcoded white restore ink');
  }
  assert.ok(/l\.headerInk=bk,l\.sidebarInk=bk/.test(app), 'app.js: fresh apply writes both ink families');
  assert.ok(/src="antcv-brand-ink-fit\.js\?v=/.test(idx), 'index.html loads the sidecar');
});
