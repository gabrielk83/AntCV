// app-row-write-guard.test.mjs — APP-ROW-WRITE-GUARD-001 (owner 2026-11-03, D1 3524)
// At 2026-11-01 16:55:11Z the ASSA ABLOY editor state was PUT into the Ambu row (3524):
// the auto-sync aimed at a stale active-row id and its company check trusted the
// antcv:activeAppCompany stamp. oo.update() now asks a guard that knows each row's
// real employer + role, learned from every relay response.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
require('../../antcv-company-match.js');
const G = require('../../antcv-app-row-write-guard.js');

const AMBU_ROW = { id: 3524, jd_company: 'Ambu', jd_role: 'Hardware Solution Architect, EndoIntelligence, Global R&D' };
const YALE_META = { company: 'ASSA ABLOY (Yale)', role: 'Product Manager - Residential Access EMEIA', subtitle: 'Processes • Products • People', greeting: '', opening: '' };

beforeEach(() => { store.clear(); for (const k of Object.keys(G._rows)) delete G._rows[k]; });

test('the 3524 write: ASSA ABLOY auto-sync payload into the Ambu row is refused', () => {
  G.learn({ ok: true, application: AMBU_ROW });                 // the tab loaded Ambu (GET /api/applications/3524)
  const autoSync = { cv_sections: [{ id: 'profile' }], cl_sections: [], rationale: {}, jd_company: YALE_META.company, jd_role: YALE_META.role, subtitle: YALE_META.subtitle, meta: YALE_META };
  const e = G.guard(3524, autoSync);
  assert.ok(e instanceof Error);
  assert.equal(e.code, 'company_mismatch');
  assert.match(e.detail, /ASSA ABLOY \(Yale\).*into application 3524 \(Ambu/);
  const saveStep = { cv_sections: [], cl_sections: [], meta: YALE_META };   // meta without jd_company
  assert.ok(G.guard(3524, saveStep));
});

test('a sections-only write is judged by the editor meta', () => {
  G.learn({ applications: [AMBU_ROW] });                         // learned from the list
  store.set('meta', JSON.stringify(YALE_META));
  assert.ok(G.guard(3524, { cv_sections: [{ id: 'profile' }], cl_sections: [] }));
});

test('own content, renames, corrected names and unknown rows pass', () => {
  G.learn({ application: AMBU_ROW });
  assert.equal(G.guard(3524, { cv_sections: [], meta: { company: 'Ambu A/S', role: 'Hardware Solution Architect' } }), null, 'same app');
  assert.equal(G.guard(3524, { jd_company: 'ASSA ABLOY', jd_role: 'Product Manager' }), null, 'history-list rename (no content)');
  assert.equal(G.guard(9999, { cv_sections: [], meta: YALE_META }), null, 'unknown row: fail open');
  G.learn({ application: { id: 41, jd_company: 'NKT Photonics', jd_role: 'Optical Engineer for R&D Projects' } });
  assert.equal(G.guard(41, { cv_sections: [], meta: { company: 'Hamamatsu Photonics A/S', role: 'Optical Engineer for R&D Projects' } }), null,
    'employer renamed, same posting (NKT Photonics is now Hamamatsu)');
  G.learn({ application: { id: 42, jd_company: 'Career Opportunities: Experienced Systems Engineer, Søborg (1424)', jd_role: 'Experienced Systems Engineer, Søborg (1424)' } });
  assert.equal(G.guard(42, { meta: { company: 'Terma', role: 'Experienced Systems Engineer' } }), null, 'junk company corrected, role kept');
});

test('unsolicited rows and claims are left to the unsolicited guards', () => {
  G.learn({ application: { id: 7, jd_company: 'Unsolicited', jd_role: 'Open Application' } });
  assert.equal(G.guard(7, { cv_sections: [], meta: YALE_META }), null);
  G.learn({ application: AMBU_ROW });
  assert.equal(G.guard(3524, { cv_sections: [], meta: { company: 'Unsolicited', role: 'Open Application' } }), null);
});

test('kill switch', () => {
  G.learn({ application: AMBU_ROW });
  store.set('antcv:disable-app-row-write-guard', '1');
  assert.equal(G.guard(3524, { meta: YALE_META, cv_sections: [] }), null);
});

test('app.js + app.src.js: _call learns rows, update() asks the guard; the guard loads synchronously', () => {
  const app = readFileSync(new URL('../../app.js', import.meta.url), 'utf8');
  assert.equal(app.split('try{o.ok&&window.__antcvLearnRows&&window.__antcvLearnRows(a)}catch(e){}').length - 1, 1);
  assert.equal(app.split('update(e,t){try{const __g=window.__antcvRowWriteGuard&&window.__antcvRowWriteGuard(e,t);if(__g)return Promise.reject(__g)}catch(_){}return this._call("/api/applications/"+e,{method:"PUT"').length - 1, 1);
  const src = readFileSync(new URL('../../app.src.js', import.meta.url), 'utf8');
  assert.equal(src.split('APP-ROW-WRITE-GUARD-001 (1.51.5282').length - 1, 2);
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const iMatch = html.indexOf('<script src="antcv-company-match.js?v=');
  const iGuard = html.indexOf('<script src="antcv-app-row-write-guard.js?v=');
  const iApp = html.indexOf("app.src = 'app.js?v=");
  assert.ok(iMatch > 0 && iGuard > iMatch && iApp > iGuard, 'matcher, then guard, then app.js');
  assert.ok(!/antcv-app-row-write-guard\.js\?v=[^"]+" defer/.test(html), 'not deferred: it must learn from the cold-restore GET');
});
