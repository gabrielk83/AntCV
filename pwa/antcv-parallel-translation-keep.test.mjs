// PARALLEL-TRANSLATION-KEEP-001 — a translated VIEW must never overwrite an app's
// canonical cv_sections in the cloud. Translations already persist in parallel via the
// langRenders bundle; this guard only stops the canonical from being clobbered by the
// PUT auto-sync. Only NON-LATIN script flips are guarded (what langRenders parallelises);
// unknown primary fails OPEN (never blocks a save / never loses data).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'antcv-parallel-translation-keep.js'), 'utf8');

// Load the sidecar in a shim; grab its exported pure helpers. window.fetch must be a
// function or the sidecar early-returns before exposing anything.
function load({ contentScript } = {}) {
  const store = new Map([['proxyUrl', '"https://relay.example.workers.dev"']]);
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const win = {
    fetch: () => Promise.resolve({ ok: false, json: () => Promise.resolve(null) }),
    addEventListener() {}, removeEventListener() {},
  };
  if (contentScript) win.__antcvContentScript = contentScript;
  const noop = () => 0;
  const quiet = { log: noop, info: noop, warn: noop, error: noop, debug: noop };
  // eslint-disable-next-line no-new-func
  new Function('window', 'localStorage', 'console', 'setTimeout', 'setInterval', 'clearInterval', SRC)(
    win, localStorage, quiet, noop, noop, noop);
  return win.AntcvParallelTranslationKeep;
}

const api = load();
const decide = api._decide;

// ---- the decision table -------------------------------------------------------
test('Latin canonical + Chinese view → strip (the reported bug: keep the English canonical)', () => {
  assert.equal(decide({ cv_sections: [] }, 'la', 'zh').strip, true);
});

test('Chinese canonical + Latin (English) view → strip (parallel keeps the zh canonical)', () => {
  assert.equal(decide({ cv_sections: [] }, 'zh', 'la').strip, true);
});

test('Chinese canonical + Chinese edit → save (same language, not a flip)', () => {
  assert.equal(decide({ cv_sections: [] }, 'zh', 'zh').strip, false);
});

test('Latin canonical + Latin edit → save (Latin<->Latin is out of scope, always saves)', () => {
  assert.equal(decide({ cv_sections: [] }, 'la', 'la').strip, false);
});

test('a cross wide-script flip (he canonical, zh view) → strip', () => {
  assert.equal(decide({ cv_sections: [] }, 'he', 'zh').strip, true);
});

test('unknown primary → fail OPEN (never strip; never block a save)', () => {
  assert.equal(decide({ cv_sections: [] }, null, 'zh').strip, false);
  assert.equal(decide({ cv_sections: [] }, '?', 'zh').strip, false);
});

test('unknown current script (detector not ready) → fail OPEN', () => {
  assert.equal(decide({ cv_sections: [] }, 'la', null).strip, false);
});

test('a body with no sections → never strip (metadata-only PUT untouched)', () => {
  assert.equal(decide({ jd_company: 'ACME' }, 'la', 'zh').strip, false);
  assert.equal(decide({}, 'zh', 'la').strip, false);
});

// ---- langToScript / scriptOf helpers -----------------------------------------
test('langToScript maps only the wide scripts, else Latin', () => {
  assert.equal(api._langToScript('zh'), 'zh');
  assert.equal(api._langToScript('he'), 'he');
  assert.equal(api._langToScript('en'), 'la');
  assert.equal(api._langToScript('da'), 'la');
  assert.equal(api._langToScript(''), 'la');
});

test('scriptOf returns null when the vetted detector is absent (fail open)', () => {
  assert.equal(api._scriptOf([{ t: '你好' }], []), null);   // no __antcvContentScript in this shim
});

test('scriptOf classifies via the injected detector: wide → its code, else Latin', () => {
  const withDetector = load({ contentScript: (cv) => (JSON.stringify(cv).match(/[一-鿿]/) ? 'zh' : '') });
  assert.equal(withDetector._scriptOf([{ t: '产品专家' }], []), 'zh');
  assert.equal(withDetector._scriptOf([{ t: 'Product expert' }], []), 'la');
});
