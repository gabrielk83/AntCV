// PARALLEL-GEN-POINTER-002 — verify the relay's per-device active-pointer logic:
//   • writeActivePointer writes BOTH the legacy global row and the per-device row when a
//     device_id is present, and ONLY the legacy row when it is absent.
//   • readActivePointer returns the device's OWN pointer when it has one, and falls back
//     to the legacy global pointer otherwise (fresh device → latest app anywhere).
// Run: node --test scripts/tests/relay-per-device-pointer.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { __test } from '../../workers/access-relay/src/index.js';

const { writeActivePointer, readActivePointer, deviceIdFromRequest } = __test;

// A minimal env.DB mock backed by two in-memory maps, mimicking the two tables and the
// exact SQL the helpers issue (matched by substring, since that is all the helper needs).
function mockEnv() {
  const legacy = new Map();       // user_hash -> {application_id, device_id, updated_at}
  const perDev = new Map();       // user_hash|device_id -> {application_id, updated_at}
  const calls = [];
  const DB = {
    prepare(sql) {
      return {
        _sql: sql,
        _args: null,
        bind(...a) { this._args = a; return this; },
        async run() {
          calls.push(sql.split(' ').slice(0, 4).join(' '));
          if (sql.includes('INSERT INTO active_application_device')) {
            const [uh, dev, appId, ts] = this._args;
            perDev.set(uh + '|' + dev, { application_id: appId, updated_at: ts });
          } else if (sql.includes('INSERT INTO active_application')) {
            const [uh, appId, dev, ts] = this._args;
            legacy.set(uh, { application_id: appId, device_id: dev, updated_at: ts });
          }
          return { meta: { changes: 1 } };
        },
        async first() {
          if (sql.includes('FROM active_application_device')) {
            const [uh, dev] = this._args;
            return perDev.get(uh + '|' + dev) || null;
          }
          if (sql.includes('FROM active_application')) {
            const [uh] = this._args;
            return legacy.get(uh) || null;
          }
          return null;
        },
      };
    },
  };
  return { env: { DB }, legacy, perDev, calls };
}

test('write with device_id populates BOTH the global and the per-device row', async () => {
  const { env, legacy, perDev } = mockEnv();
  await writeActivePointer(env, 'userA', 42, 'devX', 1000);
  assert.deepEqual(legacy.get('userA'), { application_id: 42, device_id: 'devX', updated_at: 1000 });
  assert.deepEqual(perDev.get('userA|devX'), { application_id: 42, updated_at: 1000 });
});

test('write WITHOUT device_id only touches the legacy global row (today\'s behavior)', async () => {
  const { env, legacy, perDev } = mockEnv();
  await writeActivePointer(env, 'userA', 7, null, 1000);
  assert.deepEqual(legacy.get('userA'), { application_id: 7, device_id: null, updated_at: 1000 });
  assert.equal(perDev.size, 0);
});

test('two devices keep independent pointers; neither yanks the other', async () => {
  const { env } = mockEnv();
  await writeActivePointer(env, 'userA', 100, 'desktop', 1000);
  await writeActivePointer(env, 'userA', 200, 'mobile', 2000);   // parallel gen on phone
  const onDesktop = await readActivePointer(env, 'userA', 'desktop');
  const onMobile = await readActivePointer(env, 'userA', 'mobile');
  assert.equal(onDesktop.application_id, 100, 'desktop still sees its own app, not the phone gen');
  assert.equal(onDesktop._source, 'device');
  assert.equal(onMobile.application_id, 200);
  assert.equal(onMobile._source, 'device');
});

test('a fresh device with no per-device row falls back to the global latest', async () => {
  const { env } = mockEnv();
  await writeActivePointer(env, 'userA', 100, 'desktop', 1000);
  await writeActivePointer(env, 'userA', 200, 'mobile', 2000);
  const onTablet = await readActivePointer(env, 'userA', 'tablet-never-seen');
  assert.equal(onTablet.application_id, 200, 'fresh device restores the most-recent global pointer');
  assert.equal(onTablet._source, 'global');
});

test('read with no device_id returns the legacy global pointer (old client)', async () => {
  const { env } = mockEnv();
  await writeActivePointer(env, 'userA', 55, 'desktop', 1000);
  const ptr = await readActivePointer(env, 'userA', null);
  assert.equal(ptr.application_id, 55);
  assert.equal(ptr._source, 'global');
});

test('read for a user with no pointer at all returns null', async () => {
  const { env } = mockEnv();
  const ptr = await readActivePointer(env, 'ghost', 'devX');
  assert.equal(ptr, null);
});

test('deviceIdFromRequest parses ?device_id= off the URL', () => {
  assert.equal(deviceIdFromRequest({ url: 'https://r/api/prefs?device_id=abc123' }), 'abc123');
  assert.equal(deviceIdFromRequest({ url: 'https://r/api/prefs' }), null);
  assert.equal(deviceIdFromRequest({ url: 'not a url' }), null);
});
