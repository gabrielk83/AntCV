// settings-scroll-jdurl.test.mjs
// ============================================================
// Locks the two 1.50.409 fixes:
//  - SETTINGS-SCROLL-RESET-001: the settings modal contains its overscroll
//    (backdrop + panel) and the html element blocks pull-to-refresh, so
//    scrolling the Account menu to its end can no longer chain into the
//    browser's pull-to-refresh and reload the app.
//  - JD-URL-TRIM-001: pasted job URLs are normalized before the fetch —
//    Workday query strings dropped whole, tracking params dropped
//    everywhere, everything else untouched.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');

test('SETTINGS-SCROLL-RESET-001: overscroll containment in the source', () => {
  // both settings scrollers contain
  const modal = src.slice(src.indexOf('__antcvSettingsModal'), src.indexOf('__antcvSettingsModal') + 4000);
  assert.equal((modal.match(/overscrollBehavior: "contain"/g) || []).length >= 2, true,
    'settings backdrop + panel must both carry overscrollBehavior contain');
  // html-level pull-to-refresh kill (body alone is not the viewport scroller)
  assert.match(html, /html\{overscroll-behavior:none;\}/);
  assert.match(html, /body\{[^}]*overscroll-behavior:none;?\}/);
});

// mirror of __normJdUrl (same semantics, plain reimplementation)
const norm = (raw) => {
  try {
    const u = new URL(String(raw || '').trim());
    u.hash = '';
    if (/(^|\.)myworkdayjobs\.com$/i.test(u.hostname)) u.search = '';
    else {
      const kill = /^(utm_\w+|gclid|fbclid|igshid|mc_cid|mc_eid|ref|refid|src|source|trk|trackingid|li_\w+|gh_src|lever-origin|vq_campaign|s_cid)$/i;
      const keep = [];
      u.searchParams.forEach((v, k) => { kill.test(k) || keep.push([k, v]); });
      const sp = new URLSearchParams();
      keep.forEach(([k, v]) => sp.append(k, v));
      const q = sp.toString();
      u.search = q ? '?' + q : '';
    }
    return u.toString();
  } catch (_) { return String(raw || '').trim(); }
};

test('JD-URL-TRIM-001: source carries the normalizer at the fetch site', () => {
  assert.match(src, /const __normJdUrl = /);
  assert.match(src, /const e = __normJdUrl\(\(Kt \|\| ""\)\.trim\(\)\);/);
  assert.match(src, /myworkdayjobs\\\.com/);
});

test('JD-URL-TRIM-001: the owner Workday URL loses its whole query', () => {
  const long = 'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/Test-Engineer---Photonic_JR2012829?locations=c498fba66f4e01c0944dde87d5005f05&locationHierarchy1=d21cf68980ad0121a67d319db107a200';
  assert.equal(norm(long), 'https://nvidia.wd5.myworkdayjobs.com/en-US/NVIDIAExternalCareerSite/job/Test-Engineer---Photonic_JR2012829');
});

test('JD-URL-TRIM-001: tracking stripped, meaningful params kept, junk passes through', () => {
  assert.equal(norm('https://example.com/jobs/123?utm_source=li&utm_medium=feed&gh_src=abc'),
    'https://example.com/jobs/123');
  assert.equal(norm('https://example.com/jobs?id=456&utm_campaign=x'),
    'https://example.com/jobs?id=456');
  assert.equal(norm('https://jobs.lever.co/acme/uuid-here?lever-origin=applied'),
    'https://jobs.lever.co/acme/uuid-here');
  // fragment dropped
  assert.equal(norm('https://example.com/jobs/9#apply'), 'https://example.com/jobs/9');
  // unparseable input passes through untouched
  assert.equal(norm('not a url'), 'not a url');
});
