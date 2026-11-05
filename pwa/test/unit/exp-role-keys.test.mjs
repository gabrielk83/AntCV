// exp-role-keys.test.mjs - EXP-ROLE-KEY-001 (owner 2026-11-05 "experience whole-moved to page 2").
// Since the roles cutover every experience row carries data-antcv-row-path "items.N" and a role on
// page 2+ renders as its own part whose rows restart at items.0. The coordinator read those as item
// keys, the per-role parts collided on "0", and the map came out {"0":2}: role 0 - and so the whole
// section - left page 1 although ~520 px were free under CORE COMPETENCIES. The measurer now costs
// experience as ROLE units keyed by the role's original index. Loads the real sidecar + the real
// roles adapter in a vm sandbox over a small fake DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const measurer = await readFile(new URL('../../antcv-auto-pagebreak-block-001.js', import.meta.url), 'utf8');
const adapter = await readFile(new URL('../../antcv-roles-richblock-adapter.js', import.meta.url), 'utf8');
const docxClient = await readFile(new URL('../../antcv-docx-client.js', import.meta.url), 'utf8');

// ---- fake DOM: elements with attrs, classes, a rect, children; a tiny selector engine ----
function el(tag, attrs, top, bottom, children) {
  const e = {
    tagName: tag, attrs: attrs || {}, children: children || [], parentElement: null, isConnected: true,
    rect: { top, bottom, height: bottom - top, left: 0, right: 500, width: 500 },
    get offsetWidth() { return 500; }, get offsetHeight() { return bottom - top; },
    get classList() { const c = String(this.attrs.class || '').split(/\s+/); return { contains: (x) => c.includes(x) }; },
    get textContent() { return this.attrs.text || this.children.map((k) => k.textContent).join(''); },
    getAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n) ? String(this.attrs[n]) : null; },
    hasAttribute(n) { return Object.prototype.hasOwnProperty.call(this.attrs, n); },
    getBoundingClientRect() { return this.rect; },
    getClientRects() { return [this.rect]; },
    querySelectorAll(sel) { return descendants(this).filter((d) => matches(d, sel)); },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    closest(sel) { let p = this; while (p) { if (matches(p, sel)) return p; p = p.parentElement; } return null; },
  };
  e.children.forEach((k) => { k.parentElement = e; });
  return e;
}
function descendants(e) { const out = []; (function walk(n) { n.children.forEach((k) => { out.push(k); walk(k); }); })(e); return out; }
function matches(e, selector) {
  return String(selector).split(',').some((raw) => {
    const s = raw.trim();
    if (/\s/.test(s)) return false;                     // descendant selectors ('table tbody tr'): no tables here
    let rest = s, tag = null;
    const tm = /^[a-zA-Z0-9]+/.exec(rest); if (tm) { tag = tm[0].toLowerCase(); rest = rest.slice(tm[0].length); }
    if (tag && e.tagName.toLowerCase() !== tag) return false;
    const re = /\.([\w-]+)|\[([\w-]+)(?:(\^?)=\"([^\"]*)\")?\]/g; let m;
    while ((m = re.exec(rest))) {
      if (m[1]) { if (!e.classList.contains(m[1])) return false; continue; }
      const v = e.getAttribute(m[2]);
      if (v === null) return false;
      if (m[4] === undefined) continue;
      if (m[3] === '^') { if (v.indexOf(m[4]) !== 0) return false; } else if (v !== m[4]) return false;
    }
    return true;
  });
}

function sandboxFor(root, store) {
  const ls = new Map(Object.entries(store || {}));
  const sandbox = {
    document: {
      body: { getAttribute: () => null }, readyState: 'complete', activeElement: null,
      addEventListener() {}, querySelectorAll: (sel) => root.querySelectorAll(sel), querySelector: (sel) => root.querySelector(sel),
    },
    localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
    console: { debug() {}, info() {}, warn() {}, log() {}, error() {} },
    setTimeout() { return 0; }, setInterval() { return 0; }, clearTimeout() {},
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    performance: { now: () => Date.now() },
  };
  sandbox.window = sandbox; sandbox.self = sandbox;
  sandbox.addEventListener = () => {}; sandbox.dispatchEvent = () => true;
  vm.createContext(sandbox);
  vm.runInContext(adapter, sandbox);
  vm.runInContext(measurer, sandbox);
  return { sandbox, ls };
}

const row = (tag, i, top, bottom, extra) => el(tag, Object.assign({ 'data-antcv-row-path': 'items.' + i, text: tag === 'DIV' ? 'Role, Company' : 'bullet' }, extra || {}), top, bottom);
const head = (i, top, bottom) => row('DIV', i, top, bottom, { 'data-antcv-role-head': '1' });

// roles: 0 = three bullets, 1 = seven bullets, 2 = ten bullets (the owner's #3525 shape)
const roles = [
  { id: 'r0', title: 'Project Manager', company: 'Trackman', years: '2026', bullets: ['a', 'b', 'c'] },
  { id: 'r1', title: 'Product Expert', company: 'Kanzen', years: '2025', bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
  { id: 'r2', title: 'Change Control Lead', company: 'Innoviz', years: '2020', bullets: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'] },
];
const sections = {
  cv: [
    { id: 'profile', title: 'PROFILE', loc: 'main', on: true, type: 'rich_block', items: [{ t: 'x' }] },
    { id: 'work_style', title: 'Work style', loc: 'main', on: true, type: 'rich_block', items: [{ t: 'x' }] },
    { id: 'outcomes', title: 'SELECTED OUTCOMES', loc: 'main', on: true, type: 'bullets', items: ['a', 'b', 'c'] },
    { id: 'experience', title: 'PROFESSIONAL EXPERIENCE', loc: 'main', on: true, type: 'experience', roles },
  ],
  cl: [],
};
// page-1 main column before experience: ~354 px of spans (profile 64, work style 47, three outcome rows)
const page1Before = () => [
  el('DIV', { 'data-sid': 'profile' }, 16, 102, [row('P', 0, 38, 102)]),
  el('DIV', { 'data-sid': 'work_style' }, 116, 149, [row('P', 0, 116, 149)]),
  el('DIV', { 'data-sid': 'outcomes' }, 160, 400, [row('P', 0, 180, 250), row('P', 1, 254, 330), row('P', 2, 334, 400)]),
];
const main = (top, kids) => el('DIV', { class: 'antcv-document-main', 'data-antcv-document-main': 'true' }, top, top + 1123, kids);

test('fresh document: one flattened part, role 0 stays on page 1, the overflowing role is keyed by ROLE index', () => {
  // all three roles in ONE part (what page 1 renders before any break): role 0 170-426, role 1 431-821, role 2 826-1276
  const part = el('DIV', { 'data-sid': 'experience' }, 150, 1276, [
    head(0, 170, 205), row('P', 1, 209, 257), row('P', 2, 261, 342), row('P', 3, 346, 426),
    head(4, 431, 519), row('P', 5, 523, 555), row('P', 6, 559, 607), row('P', 7, 611, 660), row('P', 8, 664, 712), row('P', 9, 716, 748), row('P', 10, 752, 785), row('P', 11, 789, 821),
    head(12, 826, 861), row('P', 13, 865, 897), row('P', 14, 901, 933), row('P', 15, 937, 985), row('P', 16, 989, 1022), row('P', 17, 1026, 1058), row('P', 18, 1062, 1110), row('P', 19, 1114, 1146), row('P', 20, 1150, 1183), row('P', 21, 1187, 1235), row('P', 22, 1239, 1276),
  ]);
  const root = el('DIV', {}, 0, 3000, [main(0, page1Before().concat([part]))]);
  const { sandbox } = sandboxFor(root, { sections: JSON.stringify(sections), doc: '"cv"' });
  const map = sandbox.window.AntcvAutoPagebreak._compute(1053 / 1.14, 'antcv:autoPages', false);
  // fill: 354 + role 0 (277 with its heading gap) = 631 <= 772 fits; + role 1 (395) = 1026 > 772 -> role 1 opens page 2
  assert.equal(JSON.stringify(map.experience), JSON.stringify({ 1: 2 }));
});

test('stale {"0":2}: per-role parts on page 2 (rows restart at items.0) no longer collapse to role 0', () => {
  // page 1 holds only the sections before experience; page 2 renders each role as its own wrapped part
  const partFor = (ri, rows) => el('DIV', { 'data-antcv-role-index': String(ri) }, rows[0].rect.top, rows[rows.length - 1].rect.bottom,
    [el('DIV', { 'data-sid': 'experience' }, rows[0].rect.top, rows[rows.length - 1].rect.bottom, rows)]);
  const page2 = main(1200, [
    el('DIV', { text: 'PROFESSIONAL EXPERIENCE (CONT.)' }, 1216, 1238),
    partFor(0, [head(0, 1238, 1273), row('P', 1, 1277, 1325), row('P', 2, 1329, 1410), row('P', 3, 1414, 1494)]),
    partFor(1, [head(0, 1499, 1587), row('P', 1, 1591, 1623), row('P', 2, 1627, 1675), row('P', 3, 1679, 1728), row('P', 4, 1732, 1780), row('P', 5, 1784, 1816), row('P', 6, 1820, 1853), row('P', 7, 1857, 1889)]),
    partFor(2, [head(0, 1894, 1929), row('P', 1, 1933, 1965), row('P', 2, 1969, 2001), row('P', 3, 2005, 2053), row('P', 4, 2057, 2090), row('P', 5, 2094, 2126), row('P', 6, 2130, 2178), row('P', 7, 2182, 2214), row('P', 8, 2218, 2251), row('P', 9, 2255, 2303), row('P', 10, 2307, 2339)]),
  ]);
  const root = el('DIV', {}, 0, 3000, [main(0, page1Before()), page2]);
  const store = { sections: JSON.stringify(sections), doc: '"cv"', 'antcv:autoPages': JSON.stringify({ experience: { 0: 2 } }), 'antcv:autoPagesRev': '2026-11-05-role-keys' };
  const { sandbox } = sandboxFor(root, store);
  const map = sandbox.window.AntcvAutoPagebreak._compute(1053 / 1.14, 'antcv:autoPages', false);
  // role 0 (256) fits under the 354 px already on page 1; role 1 (395) does not: the sticky "0" is superseded
  assert.equal(JSON.stringify(map.experience), JSON.stringify({ 1: 2 }));
  assert.equal(map.experience['0'], undefined, 'role 0 never leaves page 1 while it fits');
});

test('everything fits page 1: a stale experience break clears instead of sticking', () => {
  const part = el('DIV', { 'data-sid': 'experience' }, 150, 426, [head(0, 170, 205), row('P', 1, 209, 257), row('P', 2, 261, 342), row('P', 3, 346, 426)]);
  const one = Object.assign({}, sections, { cv: sections.cv.map((s) => (s.id === 'experience' ? Object.assign({}, s, { roles: roles.slice(0, 1) }) : s)) });
  const root = el('DIV', {}, 0, 3000, [main(0, page1Before().concat([part]))]);
  const { sandbox } = sandboxFor(root, { sections: JSON.stringify(one), doc: '"cv"', 'antcv:autoPages': JSON.stringify({ experience: { 0: 2 } }), 'antcv:autoPagesRev': '2026-11-05-role-keys' });
  const map = sandbox.window.AntcvAutoPagebreak._compute(1053 / 1.14, 'antcv:autoPages', false);
  assert.equal(map.experience, undefined);
});

test('one-time re-plan + the role-key stamp, and the export client skips the item->role translation on it', () => {
  assert.ok(/var BUDGET_REV = '2026-11-05-role-keys';/.test(measurer));
  assert.ok(measurer.includes("localStorage.setItem(EXP_KEYS_KEY, __expKeysRole ? 'role' : 'item');"));
  assert.ok(docxClient.includes("__expKeysRole = localStorage.getItem('antcv:autoPagesExpKeys') === 'role';"));
  assert.ok(docxClient.includes('if (autoR && !__expKeysRole && window.AntcvRolesRichBlock'));
});
