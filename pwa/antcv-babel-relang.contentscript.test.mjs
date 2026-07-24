// APP-SWITCH-CONTENT-LANG-DETECT-001 — the app-switch / boot language selector must
// follow the CONTENT's real script, not a single residue character.
//
// Owner 2026-07-22: "every CV starts in Chinese and switches to English — zh is the
// only Chinese CV we should have." The app.src.js sites returned 'zh' when
// JSON.stringify(sections) held ONE CJK codepoint, so any babel residue (a stray
// Chinese char) flipped the whole app to Chinese, which then drove babel-relang to
// translate + persist the doc as zh (the contamination loop). The detector now reuses
// babel-relang's own vetted test (textOf extracts VALUES not keys; isInLanguage =
// prose-ratio with acronyms / proper nouns excluded), so the selector agrees with what
// the healer would do.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'antcv-babel-relang.js'), 'utf8');

// Load the sidecar in a shim and grab window.__antcvContentScript. The sidecar's timers
// never fire (stubbed), and genSpeed/lang read localStorage — the detector itself reads
// neither, so an empty store is fine.
function loadDetector() {
  const store = new Map();
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
  const noop = () => 0;
  const quiet = { log: noop, info: noop, warn: noop, error: noop, debug: noop };
  const fetchStub = () => ({ then: () => ({ then: () => ({ catch: () => {} }) }) });
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'document', 'console', 'CustomEvent', 'fetch',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', SRC)(
    win, localStorage, { hidden: false }, quiet, class {}, fetchStub, noop, noop, noop, noop);
  return win.__antcvContentScript;
}

const detect = loadDetector();

// A genuinely Chinese CV — Chinese prose with the usual Latin invariants (tool /
// company names, standards, numbers). ~0.4+ CJK once invariants are discounted.
const ZH_CV = [
  { id: 'experience', type: 'experience', roles: [
    { title: '系统架构师', company: 'Innoviz Technologies', years: '2017-2020',
      bullets: ['负责激光雷达系统的整体架构设计与变更控制流程，使用 Codebeamer 管理需求。',
                '带领跨职能团队完成 ISO 26262 功能安全评估，并推动 ASPICE 流程改进。'] },
    { title: '高级光学与电光工程师', company: 'Sirin Labs', years: '2015-2017',
      bullets: ['设计并验证单光子探测模块，涵盖 SPAD 与 SiPM 传感器的标定与测试，并撰写详细的验证报告。',
                '与硬件和固件团队紧密协作，优化光学计量流程，缩短产品从原型到量产的周期。'] },
  ] },
  { id: 'education', type: 'education', items: [
    { deg: '应用物理学硕士', school: '特拉维夫大学', years: '2010-2013',
      note: '主修光电子学与半导体物理，毕业论文聚焦机器视觉与激光雷达的联合标定方法。' } ] },
];

// The reported failure shape: an English CV carrying a little Chinese RESIDUE (a leftover
// lead-in from a partial babel pass). This must NOT be called Chinese.
const EN_CV_WITH_RESIDUE = [
  { id: 'experience', type: 'experience', roles: [
    { title: 'System Architect', company: 'Innoviz Technologies', years: '2017-2020',
      bullets: ['Owned the lidar system architecture and the end-to-end change-control board.',
                'Led the ISO 26262 functional-safety assessment and drove ASPICE process gains.'] },
    { title: 'Senior Optics & Electro-Optics Engineer', company: 'Sirin Labs', years: '2015-2017',
      bullets: ['Designed and validated single-photon detection modules across SPAD and SiPM sensors.'] },
  ] },
  { id: 'why', type: 'rich_block', items: [ { b: '基础', t: '' } ] },   // <- the residue
];

const EN_CV_CLEAN = [
  { id: 'experience', type: 'experience', roles: [
    { title: 'System Architect', company: 'Innoviz Technologies', years: '2017-2020',
      bullets: ['Owned the lidar system architecture and the change-control board across releases.'] } ] },
];

test('a genuinely Chinese CV is detected as zh', () => {
  assert.equal(detect(ZH_CV, []), 'zh');
});

test('an English CV with a stray Chinese residue char is NOT zh (the reported bug)', () => {
  assert.equal(detect(EN_CV_WITH_RESIDUE, []), '');
});

test('a clean English CV is not any wide script', () => {
  assert.equal(detect(EN_CV_CLEAN, []), '');
});

test('empty / too-short content is ambiguous, not zh', () => {
  assert.equal(detect([], []), '');
  assert.equal(detect([{ id: 'x', type: 'rich_block', items: [{ b: '你好', t: '' }] }], []), '');
});

test('residue in the cover letter half is ignored too', () => {
  assert.equal(detect(EN_CV_CLEAN, [{ id: 'why', type: 'rich_block', items: [{ b: 'Foundation', t: 'I connect 基础 what I do best.' }] }]), '');
});

// ── APP-LOAD-NO-RETRANSLATE-001 + TRANSLATE-TAB-ISOLATION-001 (owner 2026-07-24:
// "when loading an application, it starts translating it from one language to
// other and starts translating applications in all open windows") ─────────────
// Source-level guarantees: the healer snaps the ribbon instead of translating
// without a local gesture, gates the LLM path on OS focus, exposes the FULL
// content-language detector, and the app bundles stamp the load + use it.

test('healer: app-load / no-gesture mismatch snaps the ribbon, never translates', () => {
  assert.match(SRC, /appLoadFresh\(\) \|\| !gestureFresh\(\)/);
  assert.match(SRC, /snapRibbon\(K\)/);
  // the snap block returns BEFORE the lease/translate machinery
  const snapIdx = SRC.indexOf('appLoadFresh() || !gestureFresh()');
  const leaseIdx = SRC.indexOf('if (leaseHeld()) return;');
  assert.ok(snapIdx > 0 && leaseIdx > snapIdx, 'snap gate must precede the translate path');
});

test('healer: LLM path requires OS focus (one window per desktop)', () => {
  assert.match(SRC, /document\.hasFocus === 'function' && !document\.hasFocus\(\)/);
});

test('healer: automated dispatches (app-load / lang-bar-filter) are not gestures', () => {
  assert.match(SRC, /src === 'app-load' \|\| src === 'lang-bar-filter'/);
});

test('full content-language detector exported (Latin included)', () => {
  assert.match(SRC, /window\.__antcvContentLang = contentLang/);
  assert.match(SRC, /function contentLangFull/);
});

test('app bundles: both load sites stamp antcv:app-load-lang + tag the dispatch', () => {
  const appSrc = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'app.src.js'), 'utf8');
  const appMin = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'app.js'), 'utf8');
  for (const [name, s, stamp, tag] of [
    ['app.src.js', appSrc, /antcv:app-load-lang/g, /source: "app-load"/g],
    ['app.js', appMin, /antcv:app-load-lang/g, /source:"app-load"/g],
  ]) {
    assert.equal((s.match(stamp) || []).length, 2, name + ': both sites stamp the load');
    assert.equal((s.match(tag) || []).length, 2, name + ': both dispatches are tagged');
    assert.equal((s.match(/__antcvContentLang/g) || []).length >= 2, true, name + ': both sites use the full detector');
  }
});

test('lang-bar filter: never flips the ribbon off the loaded app language', () => {
  const ui = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'antcv-language-ui-429.js'), 'utf8');
  assert.match(ui, /appLang !== active/);
  assert.match(ui, /source: 'lang-bar-filter'/);
});
