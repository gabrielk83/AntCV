// app-rev-guard-stale-rev.test.mjs
// ============================================================
// AUTOSYNC-STALE-REV-001 (owner 2026-11-06, top session's fetch log on 1.51.6085): the sections
// effect POSTs /api/applications (upsert, no id in the URL) on every sections change and the relay
// bumps updated_at; antcv-app-rev-guard.js only stamped URLs with an id, so the tab's own upsert
// made every following auto-sync PUT stale (409 -> {ok:false, skipped:'stale_rev'}) while the app
// logged "auto-sync ok". Loads the REAL guard in a vm sandbox over a scripted fetch.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const src = await readFile(new URL('../../antcv-app-rev-guard.js', import.meta.url), 'utf8');
const appSrc = (await readFile(new URL('../../app.src.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const appMin = (await readFile(new URL('../../app.js', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');

function jsonRes(status, body) {
  return { ok: status >= 200 && status < 300, status, clone() { return this; }, json: async () => body, headers: { get: () => 'application/json' } };
}

// A tiny relay: one row, updated_at bumps on every write; PUT with a stale base_rev -> 409 conflict.
function relay() {
  const row = { id: 77, updated_at: 1000 };
  const calls = [];
  return {
    row, calls,
    fetch(input, init) {
      const url = typeof input === 'string' ? input : input.url;
      const method = ((init && init.method) || 'GET').toUpperCase();
      let body = null; try { body = init && init.body ? JSON.parse(init.body) : null; } catch (_) {}
      calls.push({ url, method, base_rev: body && body.base_rev });
      if (method === 'POST' && /\/api\/applications$/.test(url)) { row.updated_at += 1; return Promise.resolve(jsonRes(200, { ok: true, application: { id: 77, updated_at: row.updated_at } })); }
      if (method === 'GET') return Promise.resolve(jsonRes(200, { ok: true, application: { id: 77, updated_at: row.updated_at } }));
      if (method === 'PUT') {
        if (body && body.base_rev != null && Number(body.base_rev) !== row.updated_at) return Promise.resolve(jsonRes(409, { error: 'conflict', updated_at: row.updated_at }));
        row.updated_at += 1; return Promise.resolve(jsonRes(200, { ok: true, application: { id: 77, updated_at: row.updated_at } }));
      }
      return Promise.resolve(jsonRes(404, {}));
    },
  };
}

function load(r) {
  const sb = { console: { info() {}, log() {}, warn() {} }, JSON, Object, String, Number, Promise, RegExp, localStorage: { getItem: () => null }, Response: class { constructor(b, o) { this.status = (o && o.status) || 200; this.ok = this.status < 300; this._b = b; } async json() { return JSON.parse(this._b); } clone() { return this; } } };
  sb.window = sb; sb.window.fetch = r.fetch;
  vm.createContext(sb); vm.runInContext(src, sb);
  return sb;
}
const tick = () => new Promise((res) => setTimeout(res, 5));

test('a GET stamps the row and the next PUT carries that base_rev (unchanged behaviour)', async () => {
  const r = relay(); const sb = load(r);
  await sb.window.fetch('/api/applications/77'); await tick();
  const res = await sb.window.fetch('/api/applications/77', { method: 'PUT', body: JSON.stringify({ cl_sections: [] }) });
  assert.equal(res.status, 200);
  assert.equal(r.calls[1].base_rev, 1000);
});

test("the tab's own POST /api/applications (upsert) re-stamps the row, so the following PUT is not stale", async () => {
  const r = relay(); const sb = load(r);
  await sb.window.fetch('/api/applications/77'); await tick();                       // stamp 1000
  await sb.window.fetch('/api/applications', { method: 'POST', body: JSON.stringify({ jd_text: 'x' }) }); await tick(); // row -> 1001
  assert.equal(sb.window.AntcvAppRevGuard.revOf(77), 1001, 'stamp follows the upsert response');
  const res = await sb.window.fetch('/api/applications/77', { method: 'PUT', body: JSON.stringify({ cl_sections: [] }) });
  const j = await res.json();
  assert.equal(res.status, 200); assert.equal(j.ok, true, 'the PUT lands');
  assert.equal(r.calls[2].base_rev, 1001);
  assert.equal(sb.window.AntcvAppRevGuard.stats.skips, 0);
});

test('a PUT that raced the upsert (409 naming a rev this tab produced) is re-sent once with the fresh base_rev', async () => {
  const r = relay(); const sb = load(r);
  await sb.window.fetch('/api/applications/77'); await tick();                       // stamp 1000
  // the upsert response is known to the guard (own rev 1001) but a PUT built from the old stamp is in flight
  await sb.window.fetch('/api/applications', { method: 'POST', body: JSON.stringify({ jd_text: 'x' }) }); await tick();
  // simulate the race: force the stamp back to the stale value the in-flight PUT was built with
  const stale = JSON.stringify({ cl_sections: [], base_rev: 1000 });
  const res = await sb.window.fetch('/api/applications/77', { method: 'PUT', body: stale });
  const j = await res.json();
  assert.equal(j.ok, true, 'retried and landed');
  const puts = r.calls.filter((c) => c.method === 'PUT');
  assert.deepEqual(puts.map((c) => c.base_rev), [1000, 1001], 'first PUT stale, retry with the fresh rev');
  assert.equal(sb.window.AntcvAppRevGuard.stats.selfRetries, 1);
  assert.equal(sb.window.AntcvAppRevGuard.stats.skips, 0);
});

test('a 409 naming a rev this tab never produced (newer row elsewhere) is still skipped, not retried', async () => {
  const r = relay(); const sb = load(r);
  await sb.window.fetch('/api/applications/77'); await tick();                       // stamp 1000
  r.row.updated_at = 5000;                                                           // another writer
  const res = await sb.window.fetch('/api/applications/77', { method: 'PUT', body: JSON.stringify({ cl_sections: [] }) });
  const j = await res.json();
  assert.equal(res.status, 200); assert.equal(j.ok, false); assert.equal(j.skipped, 'stale_rev');
  assert.equal(r.calls.filter((c) => c.method === 'PUT').length, 1, 'no retry');
  assert.equal(sb.window.AntcvAppRevGuard.stats.skips, 1);
  assert.equal(sb.window.AntcvAppRevGuard.revOf(77), 1000, 'the stamp does not advance on a foreign conflict');
});

test('the auto-sync logs a skipped PUT as SKIPPED, never "ok" (source + mirror)', () => {
  assert.equal(appSrc.split('"SKIPPED (" + r.skipped + "): the server row is newer than this tab\'s stamp').length - 1, 1);
  assert.equal(appMin.split('"SKIPPED ("+r.skipped+"): the server row is newer than this tab\'s stamp').length - 1, 1);
  assert.equal(appMin.split('.then(()=>{try{console.log("[apps] auto-sync to active app",e,"ok")}').length - 1, 0, 'the unconditional ok log is gone');
});
