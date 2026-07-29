// cl-template-struct-default.test.mjs
// ============================================================
// TEMPLATE-STRUCT-DEFAULT-001 (owner 2026-07-03): the docx-matching CL skeleton
// (greeting -> opening -> why -> who -> foundation -> bring -> contribute ->
// closure, rich_block lead-ins, "[Need from JD/company]" bring rows, contribute
// lead-in + Goal) is the BASE for every tone register. The old me() gate fell to
// the legacy pre-Nordic shape whenever localStorage 'toneRegister' was ABSENT
// (fresh/demo/wiped sessions), and the converter sidecars had to patch over it.
// String-level assertions on BOTH app.src.js and the deployed app.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = await readFile(new URL('../../app.src.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../../app.js', import.meta.url), 'utf8');

// the old gate: toneRegister read that returns FALSE (-> legacy branch) when absent
const OLD_GATE = "const tr=localStorage.getItem('toneRegister');if(tr){const v=JSON.parse(tr);return v==='nordic-minimal'||v==='scandinavian'}}catch(_){}return!1";

test('app.src.js: the CL skeleton gate is flipped to the proper struct', () => {
  assert.equal(src.includes(OLD_GATE), false, 'old absent-key-falls-to-legacy gate removed');
  assert.equal(src.includes('TEMPLATE-STRUCT-DEFAULT-001'), true, 'flip is documented at the gate');
});

test('app.js (deployed): same flip present', () => {
  assert.equal(app.includes(OLD_GATE), false, 'old gate removed from the deployed bundle');
  assert.equal(app.includes('cl:!0?[{"id":"greeting"'), true, 'proper skeleton is the unconditional branch');
});

// CL-V5-STRUCT-001 (owner 2026-07-21): the skeleton is now the v5 sequence
// greeting -> opening -> why -> role_view -> bring -> contribute -> who -> closure.
// The markers below track v5; the parity assertion (src == app.js) is the point.
test('the proper skeleton strings exist byte-identically in BOTH files', () => {
  for (const marker of [
    '"Dear [Hiring Team / Name],"',
    '{"id":"role_view","title":"HOW I SEE THE ROLE"',
    '"b":"How I see the role"',
    '"b":"Professional summary"',
    '"b":"My goal"',
    'OPENING & APPLICATION CONTEXT - name the role and the company',
  ]) {
    assert.equal(src.includes(marker), true, 'src has: ' + marker.slice(0, 50));
    assert.equal(app.includes(marker), true, 'app.js has: ' + marker.slice(0, 50));
  }
});

test('v5 order: role_view sits between why and bring, who sits after contribute', () => {
  for (const [name, s] of [['app.src.js', src], ['app.js', app]]) {
    const a = s.indexOf('[{"id":"greeting","title":"Greeting"');
    assert.notEqual(a, -1, name + ': skeleton found');
    const body = s.slice(a, a + 12000);
    const at = (id) => body.indexOf('{"id":"' + id + '"');
    for (const id of ['greeting', 'opening', 'why', 'role_view', 'bring', 'contribute', 'who', 'closure']) {
      assert.notEqual(at(id), -1, name + ': has ' + id);
    }
    assert.ok(at('why') < at('role_view'), name + ': why before role_view');
    assert.ok(at('role_view') < at('bring'), name + ': role_view before bring');
    assert.ok(at('contribute') < at('who'), name + ': contribute before who (identity block last)');
    assert.ok(at('who') < at('closure'), name + ': who before closure');
  }
});

test('no "use strict" was introduced into the deployed bundle (APPJS-BLUESCREEN-001 guard)', () => {
  assert.equal(app.startsWith('(()=>{'), true, 'bundle head intact');
  assert.equal(/^\s*['"]use strict['"]/.test(app), false);
});
