// export-links.test.mjs
// ============================================================
// docx-client export legs of the Scholar/AntCV hyperlink work (1.51.122):
//  - PUB-MASTERSITE-EXPORT-001: buildPayload forwards the publications
//    masterSite (the worker renders it as a real ExternalHyperlink; the
//    preview already rendered it — the payload silently dropped it before).
//  - LINKIFY-EXPORT-001: bare KERNEL-KNOWN URLs (Scholar, kernel projects with
//    renderAsHyperlink) in payload strings become markdown [display](url) so
//    inlineRuns emits clickable w:hyperlinks; already-markdown occurrences and
//    non-kernel URLs are untouched; publications sections are skipped (their
//    citation renderer is markdown-blind).

import { test } from 'node:test';
import assert from 'node:assert/strict';

const SCHOLAR_URL = 'https://scholar.google.com/citations?user=E6q1Y34AAAAJ&hl=en';
const ANTCV_URL = 'https://github.com/gabrielk83/AntCV';

const store = new Map();
store.set('outcomesMode', JSON.stringify('results'));
store.set('personalInfo', JSON.stringify({ personalInfo: {
  googleScholar: SCHOLAR_URL,
  publicationsScholar: { url: SCHOLAR_URL, renderAsHyperlink: true },
  projects: [{ id: 'project-antcv', title: 'AntCV', url: ANTCV_URL, renderAsHyperlink: true }],
} }));
store.set('meta', JSON.stringify({ company: 'Unsolicited', role: 'Open Application' }));
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = globalThis.window || {};

const { buildPayload } = await import('../../antcv-docx-client.js');

function build(cv) {
  return buildPayload({
    sections: { cv, cl: [] },
    doc: 'cv',
    personalInfo: { name: 'Gabriel' },
    meta: { company: 'Unsolicited', role: 'Open Application' },
  });
}

test('PUB-MASTERSITE-EXPORT-001: masterSite forwarded on a publications list section, sanitized', () => {
  const p = build([
    { id: 'pubs', title: 'PUBLICATIONS & PATENT', loc: 'main', on: true, type: 'list',
      items: ['<b>“CNT Integration”</b> - Karp et al., 2009'],
      masterSite: { on: true, label: 'Full publication record via Google Scholar', url: SCHOLAR_URL, _src: 'kernel-gate', _gate: 'on' } },
  ]);
  const sec = p.sections.find((s) => s.id === 'pubs');
  assert.deepEqual(sec.masterSite, { on: true, label: 'Full publication record via Google Scholar', url: SCHOLAR_URL }, 'forwarded WITHOUT the sidecar bookkeeping fields');
});

test('masterSite off / bad url: not forwarded', () => {
  const off = build([{ id: 'pubs', title: 'PUBLICATIONS', loc: 'main', on: true, type: 'list', items: ['x citation 2009'], masterSite: { on: false, url: SCHOLAR_URL } }]);
  assert.equal(off.sections.find((s) => s.id === 'pubs').masterSite, undefined);
  const bad = build([{ id: 'pubs', title: 'PUBLICATIONS', loc: 'main', on: true, type: 'list', items: ['x citation 2009'], masterSite: { on: true, url: 'javascript:alert(1)' } }]);
  assert.equal(bad.sections.find((s) => s.id === 'pubs').masterSite, undefined, 'non-http url never ships');
});

test('LINKIFY-EXPORT-001: a bare kernel project URL in a bullet becomes a markdown link', () => {
  const p = build([
    { id: 'experience', type: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, roles: [
      { id: 'r1', title: 'Product Expert', company: 'Kanzen', on: true,
        bullets: ['Built and shipped AntCV (' + ANTCV_URL + ') on a Cloudflare backend.'] },
    ] },
  ]);
  const b = p.sections.find((s) => s.type === 'experience').roles[0].bullets[0];
  assert.match(b, /\[github\.com\/gabrielk83\/AntCV\]\(https:\/\/github\.com\/gabrielk83\/AntCV\)/, 'bare URL wrapped as [display](url)');
});

test('LINKIFY-EXPORT-001: already-markdown and non-kernel URLs untouched; publications skipped', () => {
  const md = 'See [AntCV](' + ANTCV_URL + ') for the code.';
  const foreign = 'Docs at https://example.com/tool remain plain.';
  const p = build([
    { id: 'profile', type: 'text', loc: 'main', on: true, content: md + ' ' + foreign },
    { id: 'pubs', title: 'PUBLICATIONS', loc: 'main', on: true, type: 'list', items: ['Record: ' + SCHOLAR_URL + ' citation 2009'] },
  ]);
  // the prose orphan-glue may NBSP the tail — normalize before comparing
  const prof = p.sections.find((s) => s.id === 'profile').content.split(String.fromCharCode(160)).join(' ');
  assert.ok(prof.includes(md), 'existing markdown link byte-identical');
  assert.ok(prof.includes(foreign), 'non-kernel URL never linkified');
  const pub = p.sections.find((s) => s.id === 'pubs').items[0];
  assert.ok(pub.indexOf('](') === -1, 'publications strings never linkified (citation renderer is markdown-blind)');
});
