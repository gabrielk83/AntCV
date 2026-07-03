// scholar-links.test.mjs
// ============================================================
// SCHOLAR-LINK-GATE-001 (spec rules 35 + 39, register row 28) + the docx-client
// export legs (PUB-MASTERSITE-EXPORT-001 + LINKIFY-EXPORT-001, 1.51.122):
// kernel v10 publicationsScholar drives the publications masterSite hyperlink
// through the research-JD gate; bare kernel URLs in payload strings become
// markdown links the worker renders as real w:hyperlinks.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-scholar-links.js', import.meta.url), 'utf8');

function load(store0) {
  const store = new Map(Object.entries(store0 || {}));
  const sandbox = {
    window: { addEventListener() {}, dispatchEvent() { return true; } },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
    setTimeout() { return 0; }, setInterval() { return 0; }, clearTimeout() {},
    console: { log() {}, warn() {} },
    CustomEvent: function (t, o) { this.type = t; Object.assign(this, o); },
    JSON, Array, Object, String, RegExp, Error, Math, Number, Boolean, Date,
  };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  return { api: sandbox.window.AntcvScholarLinks, store };
}

const SCHOLAR_URL = 'https://scholar.google.com/citations?user=E6q1Y34AAAAJ&hl=en';
const KERNEL = JSON.stringify({ personalInfo: {
  googleScholar: SCHOLAR_URL,
  publicationsScholar: {
    label: 'Full publication record via Google Scholar',
    url: SCHOLAR_URL,
    renderAsHyperlink: true,
    visible: false,
    showWhenJDContainsAny: ['research', 'scientist', 'publications', 'academic'],
  },
} });

const pubs = (extra) => ({ id: 'pubs', title: 'PUBLICATIONS & PATENT', loc: 'main', on: true, type: 'list', items: ['<b>“CNT Integration”</b> - Karp et al., 2009'], ...(extra || {}) });
const baseStore = (jd, pubsSec) => ({
  personalInfo: KERNEL,
  'antcv:lastJdText': jd,
  sections: JSON.stringify({ cv: [pubsSec || pubs()], cl: [] }),
});

const RESEARCH_JD = 'Senior research scientist role: publications and academic collaboration expected in nanophotonics.';
const FAB_JD = 'Cleanroom fabrication process engineer for high-volume nanoimprint production lines and tooling.';

test('research JD: masterSite created on the publications section (kernel label + url)', () => {
  const { api, store } = load(baseStore(RESEARCH_JD));
  api._apply();
  const sec = JSON.parse(store.get('sections')).cv[0];
  assert.deepEqual(sec.masterSite, { on: true, label: 'Full publication record via Google Scholar', url: SCHOLAR_URL, _src: 'kernel-gate', _gate: 'on' });
});

test('non-research JD: nothing created; a previously gate-enabled row turns off; re-arms on a research JD', () => {
  const { api, store } = load(baseStore(FAB_JD));
  api._apply();
  assert.equal(JSON.parse(store.get('sections')).cv[0].masterSite, undefined, 'not prominent for cleanroom work (rule 39)');
  // previously enabled by us -> gate fail flips it off
  const s2 = baseStore(FAB_JD, pubs({ masterSite: { on: true, label: 'L', url: SCHOLAR_URL, _src: 'kernel-gate', _gate: 'on' } }));
  const t2 = load(s2);
  t2.api._apply();
  const ms2 = JSON.parse(t2.store.get('sections')).cv[0].masterSite;
  assert.equal(ms2.on, false);
  assert.equal(ms2._gate, 'off');
  // and a research JD re-enables OUR gate-disabled row
  t2.store.set('antcv:lastJdText', RESEARCH_JD);
  t2.api._apply();
  assert.equal(JSON.parse(t2.store.get('sections')).cv[0].masterSite.on, true);
});

test('user-owned masterSite is never touched; a user turning OUR row off is respected forever', () => {
  const userOwned = load(baseStore(FAB_JD, pubs({ masterSite: { on: true, label: 'My ORCID', url: 'https://orcid.org/x' } })));
  userOwned.api._apply();
  const ms = JSON.parse(userOwned.store.get('sections')).cv[0].masterSite;
  assert.deepEqual(ms, { on: true, label: 'My ORCID', url: 'https://orcid.org/x' }, 'no _src -> not ours -> untouched');

  const userOff = load(baseStore(RESEARCH_JD, pubs({ masterSite: { on: false, label: 'L', url: SCHOLAR_URL, _src: 'kernel-gate', _gate: 'on' } })));
  userOff.api._apply();
  assert.equal(JSON.parse(userOff.store.get('sections')).cv[0].masterSite.on, false, 'user turned OUR row off (_gate still on) -> respected');
});

test('rule 35 repair: a bare "via Google Scholar" pointer item is hidden and the link switches on — gate or no gate', () => {
  const sec = pubs({ items: ['<b>“CNT Integration”</b> - Karp et al., 2009', 'Details available via Google Scholar'] });
  const { api, store } = load(baseStore(FAB_JD, sec));
  api._apply();
  const out = JSON.parse(store.get('sections')).cv[0];
  assert.equal(out.hidden['1'] || out.hidden[1], true, 'plain pointer hidden');
  assert.equal(out.masterSite.on, true, 'the shown pointer became a real link (rule 35)');
  assert.equal(out.masterSite.url, SCHOLAR_URL);
});

test('citations are never mistaken for pointers; kill switch honored', () => {
  const { api } = load(baseStore(RESEARCH_JD));
  assert.equal(api._isPlainScholarPointer('Details available via Google Scholar'), true);
  assert.equal(api._isPlainScholarPointer('See [Google Scholar](https://x) for more'), false, 'already a link');
  assert.equal(api._isPlainScholarPointer('A very long citation that happens to mention Google Scholar somewhere in a full journal reference chain with volume and pages, 2009'), false);
  const s = baseStore(RESEARCH_JD);
  s['antcv:disable-scholar-links'] = '1';
  const killed = load(s);
  const before = killed.store.get('sections');
  killed.api._apply();
  assert.equal(killed.store.get('sections'), before);
});
