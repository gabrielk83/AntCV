/* Unit test — EXPORT-PALETTE-PARITY-001.
 * buildStyle() must override the stale styleConfig panel colours with the
 * package CSS tokens (--sidebar-bg pale → dark ink; --header-bg navy → white
 * ink), so the export payload matches the preview. No browser — document.body
 * + getComputedStyle are mocked.
 */
import assert from 'node:assert';

const tokens = { '--sidebar-bg': '#DCE5EA', '--header-bg': '#283556' };
globalThis.document = { body: {} };
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => tokens[n] || '' });
globalThis.window = {};

const { buildStyle } = await import('../antcv-docx-client.js');

// stale styleConfig: sidebar navy + dark band text (the broken state)
const styleConfig = {
  sidebarBg: '#283556', sidebarTextColor: '#283556',
  headerBg: '#1B627F', headerNameColor: '#283556',
  mainHeadColor: '#283556',
};
const out = buildStyle(styleConfig, '#1B627F');

let pass = 0; const ok = (n, c) => { assert.ok(c, n); console.log('PASS ' + n); pass++; };
const H = (v) => String(v || '').replace('#', '').toUpperCase(); // worker wants bare hex

ok('sidebar bg resolved to the PALE token (--sidebar-bg)', H(out.sidebarBg) === 'DCE5EA');
ok('sidebar text inverts to DARK on the pale ground', H(out.sidebarTextColor) === '283556');
ok('candidate band bg resolved to --header-bg (navy)', H(out.headerBg) === '283556');
ok('candidate name/spec/contact are WHITE on the navy band', H(out.headerNameColor) === 'FFFFFF' && H(out.headerSpecColor) === 'FFFFFF' && H(out.headerContactColor) === 'FFFFFF');

// custom style (no tokens) must fall through to styleConfig/navyColor
const tokens2 = {};
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => tokens2[n] || '' });
const outCustom = buildStyle({ sidebarBg: '#112233' }, '#1B627F');
ok('custom (no token) keeps styleConfig sidebarBg', H(outCustom.sidebarBg) === '112233');

console.log(`\nBUILDSTYLE-PALETTE OK (${pass} checks)`);
