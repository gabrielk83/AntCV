// ROLE-LOCATION-001 (EXEC-LINEAR step 2): role.location + role-line format.
// Runs the roles adapter sidecar in a fake window and checks:
//   - classic + no location renders byte-identically to the pre-change segments;
//   - a 4th segment carries the location through adapt -> itemsToRoles -> writeBack;
//   - the meta format renders "title - company" left and "(years | location)" right;
//   - the docx-client payload carries location only when set, and forwards the format.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pwa = path.resolve(here, '..', '..');

function loadAdapter(ls) {
  const store = { ...ls };
  const win = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
  };
  win.window = win;
  vm.runInNewContext(fs.readFileSync(path.join(pwa, 'antcv-roles-richblock-adapter.js'), 'utf8'), win);
  return win.AntcvRolesRichBlock;
}

// Minimal React stand-in: h(type, props, ...children) -> plain tree; B is the inline editor.
const React = { createElement: (type, props, ...children) => ({ type, props: props || {}, children: children.flat().filter((c) => c !== null && c !== '' && c !== undefined) }) };
const B = 'B';
const ctx = { B, T: 'Calibri', k: {}, s: '#00746E', exp: 14, C: '#00746E', align: 'justify' };
const text = (n) => (n == null ? '' : typeof n === 'string' ? n : n.type === B ? '<' + n.props.path.join('.') + '=' + n.props.value + '>' : n.children.map(text).join(''));

const sec = { id: 'experience', type: 'experience', roles: [
  { id: 'r1', title: 'System Architect', company: 'Innoviz', years: '2017 – 2020', bullets: ['a'] },
  { id: 'r2', title: 'PM', company: 'Trackman', years: '2026 –', location: 'Hørsholm, Denmark', bullets: ['b'] },
] };

test('adapt emits a 4th (location) segment and itemsToRoles carries it back', () => {
  const A = loadAdapter({});
  const ad = A.adapt(sec);
  assert.equal(ad.items[0].seg.length, 4);
  assert.equal(ad.items[0].seg[3].t, '');
  assert.equal(ad.items[2].seg[3].t, 'Hørsholm, Denmark');
  const back = A.itemsToRoles(ad.items, sec.roles);
  assert.equal(back[0].location, undefined, 'empty location is not written');
  assert.equal(back[1].location, 'Hørsholm, Denmark');
  // arrays cross the vm realm boundary -> compare by value, not prototype
  assert.equal(JSON.stringify(A.rolesPathFor(ad, 2, 'location')), JSON.stringify(['roles', 1, 'location']));
  assert.equal(A.writeBack(ad, 0, 'location', 'Tel Aviv').roles[0].location, 'Tel Aviv');
});

test('classic format: no location -> pre-change role line; location -> appended after years', () => {
  const A = loadAdapter({});
  const ad = A.adapt(sec);
  const line0 = A.renderRoleHead(React, ctx, ad.items[0], 0).children[0];
  assert.equal(text(line0.children[0]), '<items.0.role=System Architect>, <items.0.company=Innoviz>');
  assert.equal(text(line0.children[1]), '<items.0.years=2017 – 2020>');
  const line2 = A.renderRoleHead(React, ctx, ad.items[2], 2).children[0];
  assert.equal(text(line2.children[1]), '<items.2.years=2026 –> | <items.2.location=Hørsholm, Denmark>');
});

test('meta format: "title - company" left, "(years | location)" right, company upright, years bold', () => {
  const A = loadAdapter({ 'antcv:roleLineFormat': 'meta' });
  const ad = A.adapt(sec);
  const line = A.renderRoleHead(React, ctx, ad.items[2], 2).children[0];
  assert.equal(text(line.children[0]), '<items.2.role=PM> - <items.2.company=Trackman>');
  assert.equal(text(line.children[1]), '(<items.2.years=2026 –> | <items.2.location=Hørsholm, Denmark>)');
  assert.equal(line.children[0].children[2].props.style.fontStyle, 'normal');
  assert.equal(line.children[1].props.style.fontWeight, 700);
  // meta with an EMPTY location still shows the editable slot so the user can fill it
  const line0 = A.renderRoleHead(React, ctx, ad.items[0], 0).children[0];
  assert.equal(text(line0.children[1]), '(<items.0.years=2017 – 2020> | <items.0.location=>)');
});

test('rich-block editor patches segments over the full list (seg 3 survives a seg 0 restyle)', () => {
  const src = fs.readFileSync(path.join(pwa, 'antcv-rich-block-editor.js'), 'utf8');
  assert.ok(!/\[0, 1, 2\]\.map/.test(src), 'the [0,1,2] segment patch loop is gone');
  assert.ok(src.includes('segInput(3, "Location"'), 'editor exposes the Location input');
});

test('docx-client: role.location forwarded only when set; roleLineFormat forwarded only when meta', () => {
  const src = fs.readFileSync(path.join(pwa, 'antcv-docx-client.js'), 'utf8');
  assert.ok(src.includes("r.location.trim() ? { location: r.location.trim() } : {}"), 'location on the role payload');
  assert.ok(src.includes("localStorage.getItem('antcv:roleLineFormat') === 'meta') out.roleLineFormat = 'meta'"), 'format in style');
});

test('cache-bust: the step-2 assets share the lane version', () => {
  const index = fs.readFileSync(path.join(pwa, 'index.html'), 'utf8');
  const v = index.match(/app\.src = 'app\.js\?v=([^']+)'/)[1];
  for (const f of ['antcv-roles-richblock-adapter.js', 'antcv-rich-block-editor.js', 'antcv-role-line-format.js', 'antcv-docx-client.js']) {
    assert.ok(index.includes(f + '?v=' + v), f + ' busted to ' + v);
  }
});
