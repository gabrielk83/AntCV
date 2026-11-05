// package-palette-heal-regions.test.mjs
// ============================================================
// PACKAGE-PALETTE-HEAL-REGIONS-001 (owner 2026-11-05): on antcv.pages.dev the
// Copenhagen Modern sidebar painted its headings and body text WHITE on the pale
// #DCE5EA sidebar. styleConfig still carried an earlier brand record (headerBg /
// sidebarBg #1a1a1a, white sidebar inks) and the named-package self-heal
// (PACKAGE-PALETTE-MIX-001) compared only mainHeadColor, which matched. The heal
// now also compares the region tokens, unless a brand is active. Mirror lock:
// both app.src.js and the minified app.js carry the same rule.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');
const KEYS = '["mainHeadColor","headerBg","sidebarBg","sidebarHeadColor","sidebarTextColor","tableHeaderBg"]';

test('app.src.js: the named-package heal compares the region tokens and skips an active brand', () => {
  assert.ok(src.includes('PACKAGE-PALETTE-HEAL-REGIONS-001'), 'ticket marker');
  assert.ok(src.includes(KEYS + '.some((k) => ps[k] && ya[k] !== ps[k])'), 'region drift check');
  assert.ok(/window\.__antcvBrandFit === true \|\| !!localStorage\.getItem\("antcv:brandV2"\)/.test(src), 'brand gate');
  assert.ok(src.includes('if (ps && (ya.mainHeadColor !== ps.mainHeadColor || __drift))'), 'heal fires on drift');
});

test('app.js: the minified mirror carries the same rule', () => {
  assert.ok(app.includes(KEYS + '.some(k=>e[k]&&Ga[k]!==e[k])'), 'region drift check (minified)');
  assert.ok(app.includes('window.__antcvBrandFit===!0'), 'brand gate (minified)');
  assert.ok(app.includes('e&&(Ga.mainHeadColor!==e.mainHeadColor||'), 'heal fires on drift (minified)');
});

test('Copenhagen Modern keeps a pale sidebar with dark text in its package tokens', () => {
  const i = src.indexOf('"copenhagen-modern": {');
  const block = src.slice(i, i + 1200);
  assert.match(block, /sidebarBg: "#DCE5EA"/);
  assert.match(block, /sidebarTextColor: "#283556"/);
  assert.match(block, /sidebarHeadColor: "#00746E"/);
});
