// TITLE-LANG-HEAL-001 — a wrong-SCRIPT section title on a Latin-target document
// resets to its English canonical; a matching-script / non-Latin-target / custom
// title is never touched. Root cause: the babel ratio detector ignores short
// wrong-language titles, so Chinese headings stranded on an English CV (3Shape).
import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const sidecar = fs.readFileSync(path.join(dir, '../../antcv-title-lang-heal.js'), 'utf8');

function load(store) {
  const listeners = {};
  const sandbox = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    setTimeout: () => 0,
    CustomEvent: class { constructor(t, d) { this.type = t; Object.assign(this, d); } },
    JSON, RegExp, String, Array, Object,
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = (t, fn) => { (listeners[t] ||= []).push(fn); };
  sandbox.window.dispatchEvent = () => true;
  vm.createContext(sandbox);
  vm.runInContext(sidecar, sandbox);
  return sandbox.window.AntcvTitleLangHeal;
}

test('an English document heals Chinese section titles to the English canonical', () => {
  const store = {
    language: JSON.stringify('en'),
    sections: JSON.stringify({
      cv: [{ id: 'profile', title: '个人简介' }, { id: 'tools', title: '工具与方法' }, { id: 'core_comp', title: 'CORE COMPETENCIES' }],
      cl: [{ id: 'role_view', title: '如何看待这个职位' }, { id: 'closure', title: 'Closure' }],
    }),
  };
  load(store).run();
  const s = JSON.parse(store.sections);
  assert.equal(s.cv.map((x) => x.title).join('|'), 'PROFILE|TOOLS & METHODS|CORE COMPETENCIES');
  assert.equal(s.cl.map((x) => x.title).join('|'), 'HOW I SEE THE ROLE|Closure');
});

test('an absent language ribbon is the Latin default and still heals', () => {
  const store = { sections: JSON.stringify({ cv: [{ id: 'education', title: '教育背景' }] }) };
  load(store).run();
  assert.equal(JSON.parse(store.sections).cv[0].title, 'EDUCATION');
});

test('a non-Latin target (zh) keeps its Chinese titles', () => {
  const store = { language: JSON.stringify('zh'), sections: JSON.stringify({ cv: [{ id: 'profile', title: '个人简介' }] }) };
  load(store).run();
  assert.equal(JSON.parse(store.sections).cv[0].title, '个人简介', 'a zh document SHOULD keep Chinese headings');
});

test('a custom English rename and an unknown section id are never touched', () => {
  const store = {
    language: JSON.stringify('en'),
    sections: JSON.stringify({ cv: [{ id: 'profile', title: 'My Story' }, { id: 'customx', title: '自定义' }] }),
  };
  load(store).run();
  const s = JSON.parse(store.sections);
  assert.equal(s.cv[0].title, 'My Story', 'a Latin custom title is preserved');
  assert.equal(s.cv[1].title, '自定义', 'an unknown id is left alone (no canonical to use)');
});

test('idempotent — a healed document produces no further change', () => {
  const store = { language: JSON.stringify('en'), sections: JSON.stringify({ cv: [{ id: 'profile', title: '个人简介' }] }) };
  const api = load(store);
  api.run();
  const once = store.sections;
  api.run();
  assert.equal(store.sections, once, 'second pass is a no-op');
});

test('wrongScript() only fires on a non-Latin-dominant string', () => {
  const api = load({});
  assert.equal(api.wrongScript('工具与方法'), true);
  assert.equal(api.wrongScript('TOOLS & METHODS'), false);
  assert.equal(api.wrongScript('Work style'), false);
  assert.equal(api.wrongScript('CAD/CAM (计算机)'), false, 'a mostly-Latin title with a parenthetical is kept');
});

test('the kill-switch disables the healer', () => {
  const store = { 'antcv:disable-title-lang-heal': '1', language: JSON.stringify('en'), sections: JSON.stringify({ cv: [{ id: 'profile', title: '个人简介' }] }) };
  load(store).run();
  assert.equal(JSON.parse(store.sections).cv[0].title, '个人简介', 'disabled -> untouched');
});
