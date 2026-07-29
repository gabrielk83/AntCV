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
ok('sidebar LABELS invert to DARK on the pale ground (SIDEBAR-LABEL-PDF-WHITE-001)', H(out.sidebarLabelColor) === '283556');
ok('candidate band bg resolved to --header-bg (navy)', H(out.headerBg) === '283556');
ok('candidate name/spec/contact are WHITE on the navy band', H(out.headerNameColor) === 'FFFFFF' && H(out.headerSpecColor) === 'FFFFFF' && H(out.headerContactColor) === 'FFFFFF');

// custom style (no tokens) must fall through to styleConfig/navyColor
const tokens2 = {};
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => tokens2[n] || '' });
const outCustom = buildStyle({ sidebarBg: '#112233' }, '#1B627F');
ok('custom (no token) keeps styleConfig sidebarBg', H(outCustom.sidebarBg) === '112233');

// BRAND-EXPORT-PARITY-001 — an ACTIVE per-app brand (antcv:brandV2 + __antcvBrandFit)
// must WIN over the package --header-bg/--sidebar-bg tokens the body block resolves,
// because the brand var lives inline on the paper-wrapper (invisible to document.body).
// This is the fix for the owner's "export reverts to the default teal/navy palette".
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => tokens[n] || '' }); // package tokens present
globalThis.localStorage = { getItem: (k) => (k === 'antcv:brandV2' ? JSON.stringify({ version: 2, slots: { headerBg: '#0B4F8A', headerInk: '#FFFFFF', sidebarBg: '#0B4F8A', accent: '#D97706' } }) : null), setItem() {} };
globalThis.window = { __antcvBrandFit: true };
const outBrand = buildStyle({ headerBg: '#33446F', sidebarBg: '#DCE5EA', photoBorderColor: '#00746E' }, '#283556');
ok('BRAND wins over package --header-bg token', H(outBrand.headerBg) === '0B4F8A');
ok('BRAND wins over package --sidebar-bg token', H(outBrand.sidebarBg) === '0B4F8A');
ok('BRAND accent drives the photo border', H(outBrand.photoBorderColor) === 'D97706');
ok('BRAND band ink stays white (contrast)', H(outBrand.headerNameColor) === 'FFFFFF');
ok('BRAND table header matches the brand band', H(outBrand.tableHeaderBg) === '0B4F8A');

// brand OFF -> package token wins (no regression to non-branded package exports)
globalThis.window = { __antcvBrandFit: false };
const outOff = buildStyle({ headerBg: '#33446F' }, '#283556');
ok('brand OFF keeps the package --header-bg token (no regression)', H(outOff.headerBg) === '283556');

console.log(`\nBUILDSTYLE-PALETTE OK (${pass} checks)`);
