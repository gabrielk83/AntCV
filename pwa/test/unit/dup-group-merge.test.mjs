/* Unit — DUP-GROUP-MERGE-001. Loads the real sidecar in a shimmed window and
 * verifies mergeGroups collapses case/&-variant duplicate {grp} groups (the
 * owner's REGULATORY CONTEXT: 7 headers -> 4 canonical), preserves all rows,
 * dedups exact-duplicate rows, and is idempotent + a no-op on distinct groups. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

const src = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'antcv-dup-group-merge.js'), 'utf8');
const sandbox = { window: {}, localStorage: { _d: {}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);} }, setTimeout(){}, };
sandbox.window.addEventListener = () => {};
sandbox.window.dispatchEvent = () => {};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const merge = sandbox.window.AntcvDupGroupMerge._merge;

test('owner regulatory: 7 group headers -> 4 canonical, rows preserved', () => {
  const sec = { id: 'regulatory', type: 'rich_block', items: [
    { grp: true, t: 'Systems, safety and cybersecurity' },
    { b: 'ISO 26262', t: 'Functional safety' }, { b: 'ISO/PAS 21448 SOTIF', t: 'Safety of intended fn' },
    { grp: true, t: 'Electrical and EMC' },
    { b: 'CISPR 25', t: 'Radio disturbance' },
    { grp: true, t: 'Environmental, durability and materials compliance' },
    { b: 'IEC 60068', t: 'Environmental testing' }, { b: 'RoHS', t: 'Hazardous substances' }, { b: 'REACH', t: 'Registration' },
    { grp: true, t: 'Systems, Safety & Cybersecurity' },
    { b: 'ASPICE', t: 'Process' }, { b: 'ISO/SAE 21434', t: 'Cybersecurity' },
    { grp: true, t: 'Imaging & Electro-Optical' },
    { b: 'ISO 12233', t: 'Resolution' }, { b: 'EMVA 1288', t: 'Sensor' },
    { grp: true, t: 'Electrical & EMC' },
    { b: 'ISO 11452', t: 'EMC immunity' }, { b: 'IEC 60529', t: 'Ingress protection' },
    { grp: true, t: 'Environmental, Durability & Materials Compliance' },
    { b: 'MIL-STD-810G', t: 'Environmental qual' }, { b: 'ISO 16750', t: 'Automotive conditions' },
  ] };
  const before = sec.items.length;
  const changed = merge(sec);
  assert.equal(changed, true, 'should merge');
  const groupHeaders = sec.items.filter(it => it.grp).length;
  assert.equal(groupHeaders, 4, '7 headers -> 4 canonical groups');
  // all distinct standards preserved
  const bodies = sec.items.filter(it => !it.grp).map(it => it.b);
  ['ISO 26262','CISPR 25','ASPICE','ISO/SAE 21434','ISO 12233','ISO 11452','MIL-STD-810G','RoHS'].forEach(s =>
    assert.ok(bodies.includes(s), 'kept ' + s));
  // merged group "Systems..." now holds both its variants' items, under ONE header
  const idxSys = sec.items.findIndex(it => it.grp && /systems/i.test(it.t));
  assert.ok(idxSys >= 0);
  assert.ok(sec.items.filter(it => it.grp && /systems/i.test(it.t)).length === 1, 'one Systems header');
  assert.ok(before > sec.items.length, 'fewer items (dup headers removed): ' + before + ' -> ' + sec.items.length);
});

test('idempotent: second pass is a no-op', () => {
  const sec = { id: 'r', items: [ { grp:true,t:'A' },{ b:'x',t:'1' },{ grp:true,t:'a' },{ b:'y',t:'2' } ] };
  assert.equal(merge(sec), true);
  assert.equal(sec.items.filter(it=>it.grp).length, 1);
  assert.equal(merge(sec), false, 'no further change');
});

test('exact-duplicate rows deduped on merge', () => {
  const sec = { id: 'r', items: [ { grp:true,t:'G' },{ b:'SOTIF',t:'safety' },{ grp:true,t:'g' },{ b:'SOTIF',t:'safety' },{ b:'new',t:'z' } ] };
  merge(sec);
  const sotif = sec.items.filter(it=>!it.grp && it.b==='SOTIF').length;
  assert.equal(sotif, 1, 'exact-dup SOTIF deduped');
  assert.ok(sec.items.some(it=>it.b==='new'), 'distinct row kept');
});

test('distinct groups untouched (no false merge)', () => {
  const sec = { id: 'tools', items: [ { grp:true,t:'Expertise' },{ b:'a',t:'1' },{ grp:true,t:'Tools' },{ b:'b',t:'2' },{ grp:true,t:'Methods' },{ b:'c',t:'3' } ] };
  assert.equal(merge(sec), false, 'distinct canons -> no merge');
  assert.equal(sec.items.filter(it=>it.grp).length, 3);
});
