// role-line-one.test.mjs - ROLE-LINE-ONE-001 (owner 2026-11-08, #3536 Elma preview: "the experiance lines are
// too compressed leftwards, should be one line not two or 3 lines"). The right-hand "years | location" never wraps,
// so "2022 - 2026 | Copenhagen, Denmark (alongside Innoviz until 2025)" squeezed "Produkt- og projektekspert,
// Kanzen Konsulenter ApS" into five lines. The margin (academy) CV now shows the PLACE, as the house CV does
// ("København", "Tel Aviv"): the export through AntcvAcademyFormat.apply(), the preview through the roles adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pwa = path.resolve(here, '..', '..');
const require = createRequire(import.meta.url);
const AF = require('../../antcv-academy-format.js');
const index = fs.readFileSync(path.join(pwa, 'index.html'), 'utf8');

const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat().filter((c) => c !== null && c !== '' && c !== undefined) }) };
const B = 'B';
const ctx = { B, T: 'Calibri', k: {}, s: '#00746E', exp: 14, C: '#00746E', align: 'justify' };
const text = (n) => (n == null ? '' : typeof n === 'string' ? n : n.type === B ? '<' + n.props.value + '>' : n.children.map(text).join(''));

function loadAdapter(ls, margin) {
  const store = { ...ls };
  const win = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    document: { body: { getAttribute: (k) => (k === 'data-antcv-cv-margin' && margin ? '1' : null) } },
    AntcvAcademyFormat: AF,
  };
  win.window = win;
  vm.runInNewContext(fs.readFileSync(path.join(pwa, 'antcv-roles-richblock-adapter.js'), 'utf8'), win);
  return win.AntcvRolesRichBlock;
}
const sec = { id: 'experience', type: 'experience', roles: [
  { id: 'kanzen', title: 'Produkt- og projektekspert', company: 'Kanzen Konsulenter ApS', years: '2022 - 2026',
    location: 'Copenhagen, Denmark (alongside Innoviz until 2025)', bullets: ['a'] },
] };
const yearsSide = (A) => text(A.renderRoleHead(React, ctx, A.adapt(sec).items[0], 0).children[0].children[1]);

test('place(): the text before the first comma, without a bracketed note', () => {
  assert.equal(AF.place('Copenhagen, Denmark (alongside Innoviz until 2025)'), 'Copenhagen');
  assert.equal(AF.place('Hørsholm, Denmark'), 'Hørsholm');
  assert.equal(AF.place('København (hybrid)'), 'København');
  assert.equal(AF.place('Israel / Copenhagen'), 'Israel / Copenhagen');
  assert.equal(AF.place('Tel Aviv'), 'Tel Aviv');
  assert.equal(AF.place(''), '');
});

test('export: the academy projection shortens each detailed role location and says so', () => {
  const src = [{ id: 'profile', type: 'rich_block', loc: 'main', on: true, items: [{ t: 'IT-professionel med 15+ års erfaring.' }] }, JSON.parse(JSON.stringify(sec))];
  const res = AF.apply(src, { lang: 'da', nowYear: 2026 });
  const r = res.sections.find((s) => s.id === 'experience').roles[0];
  assert.equal(r.location, 'Copenhagen');
  assert.ok(res.changes.includes('role kanzen: location shortened to the place'));
  assert.equal(src[1].roles[0].location, 'Copenhagen, Denmark (alongside Innoviz until 2025)', 'stored data untouched');
});

test('preview: the margin CV shows the place beside the years; other layouts and the kill switch keep the stored text', () => {
  assert.equal(yearsSide(loadAdapter({}, true)), '<2022 - 2026> | <Copenhagen>');
  assert.equal(yearsSide(loadAdapter({}, false)), '<2022 - 2026> | <Copenhagen, Denmark (alongside Innoviz until 2025)>');
  assert.equal(yearsSide(loadAdapter({ 'antcv:disable-academy-format': '1' }, true)), '<2022 - 2026> | <Copenhagen, Denmark (alongside Innoviz until 2025)>');
});

test('index.html: the adapter moves in lockstep with app.js; the rules load after it', () => {
  const v = (name) => (index.match(new RegExp(name.replace(/\./g, '\\.') + '\\?v=([^"\']+)')) || [])[1];
  assert.equal(v('antcv-roles-richblock-adapter.js'), '1.51.6386-role-wrap');
  assert.equal(v('antcv-roles-richblock-adapter.js'), v('app.js'));
  assert.equal(v('antcv-academy-format.js'), '1.51.6385-role-line');
  assert.ok(index.indexOf('antcv-roles-richblock-adapter.js?v=') < index.indexOf('antcv-academy-format.js?v='), 'adapter reads the rules at render time');
});

test('preview: the default (justify) line wraps like the export tab - years move down, still right; grouped lines stay one row', () => {
  const A = loadAdapter({}, true);
  const ad = A.adapt(sec);
  const line = A.renderRoleHead(React, ctx, ad.items[0], 0).children[0];
  assert.equal(line.props.style.flexWrap, 'wrap');
  assert.equal(line.props.style.justifyContent, 'space-between');
  assert.equal(line.children[1].props.style.marginLeft, 'auto', 'a wrapped years line stays on the right');
  assert.equal(line.children[1].props.style.whiteSpace, 'nowrap');
  const grouped = A.renderRoleHead(React, Object.assign({}, ctx, { align: 'left' }), ad.items[0], 0).children[0];
  assert.equal(grouped.props.style.flexWrap, 'nowrap');
  assert.equal(grouped.children[1].props.style.marginLeft, undefined);
});
