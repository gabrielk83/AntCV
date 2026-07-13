/* LANG-EXPAND-001 (kernel v2 §3, register row 8c) — the lazy per-language
 * KERNEL projection tier.
 *
 * Two layers, matching the repo precedent (cluster-demand-research-writer.test.mjs):
 *   1. FUNCTIONAL tests on the pure, extractable helpers (language normalize,
 *      role keying, the LANG-CROSS-001 projection prompt builder, identity
 *      projection, model-response parse) via node:vm — no network, no D1.
 *   2. SOURCE-LEVEL locks on the HTTP handler + route (auth gate, D1 gate,
 *      language validation, cache-before-model, INSERT-on-miss, en short-
 *      circuit) — same technique as cse-search-proxy.test.mjs, since the
 *      handler forwards to the proxy and there is no fetch-mock harness here.
 *
 * Run:  node --test workers/access-relay/tests/kernel-language-view.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');

function extractUpTo(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}

// Pull the pure-helper block (through parseKernelLangModelResponse, before
// the crypto-dependent sha256Hex and the async handler).
const block = extractUpTo("const KERNEL_LANG_VIEW_LANGS = ['en'", '// SHA-256 hex of a string');
const ctx = { console, Number, Array, Map, Set, Object, JSON, String, Date, RegExp };
vm.createContext(ctx);
vm.runInContext(
  block +
  '\nthis.KERNEL_LANG_VIEW_LANGS = KERNEL_LANG_VIEW_LANGS;' +
  '\nthis.normalizeKernelLangCode = normalizeKernelLangCode;' +
  '\nthis.kernelRoleKey = kernelRoleKey;' +
  '\nthis.buildKernelLanguageProjectionPrompt = buildKernelLanguageProjectionPrompt;' +
  '\nthis.identityKernelProjection = identityKernelProjection;' +
  '\nthis.parseKernelLangModelResponse = parseKernelLangModelResponse;',
  ctx
);
const {
  normalizeKernelLangCode, kernelRoleKey, buildKernelLanguageProjectionPrompt,
  identityKernelProjection, parseKernelLangModelResponse,
} = ctx;

// A small kernel_v2-shaped fixture (mirrors the real experience[] shape).
const KERNEL = {
  schemaVersion: '2.0-kernel',
  experience: [
    {
      role: 'Product / Project Expert', company: 'Kanzen Konsulenter ApS', isCurrent: true,
      scope: ['Owned the ASPICE process rollout', 'Directed a 5-person team'],
      outcomes: [{ title: 'Cycle time', result: 'Cut release cycle by 30%' }],
      langInvariantTokens: ['ASPICE', 'Kanzen Konsulenter ApS'],
    },
    {
      role: 'Change Control Lead', company: 'Meprolight',
      scope: ['Ran ISO 26262 audits'],
      outcomes: [{ title: 'Defects', result: 'Reduced defects 10x' }],
      langInvariantTokens: ['ISO 26262'],
    },
  ],
};

// ---- 1. language normalize ------------------------------------------------
test('normalizeKernelLangCode accepts supported codes + region tags', () => {
  assert.equal(normalizeKernelLangCode('es'), 'es');
  assert.equal(normalizeKernelLangCode('ES'), 'es');
  assert.equal(normalizeKernelLangCode('es-ES'), 'es');
  assert.equal(normalizeKernelLangCode('zh-Hans'), 'zh');
  assert.equal(normalizeKernelLangCode('da'), 'da');
  assert.equal(normalizeKernelLangCode('en'), 'en');
});
test('normalizeKernelLangCode rejects junk / unsupported', () => {
  assert.equal(normalizeKernelLangCode('xx'), null);
  assert.equal(normalizeKernelLangCode(''), null);
  assert.equal(normalizeKernelLangCode(null), null);
  assert.equal(normalizeKernelLangCode(42), null);
});

// ---- 2. role keying (must match KERNEL-V2-READER-001 keying) --------------
test('kernelRoleKey is company|title lowercased, empty when both blank', () => {
  assert.equal(kernelRoleKey(KERNEL.experience[0]), 'kanzen konsulenter aps|product / project expert');
  assert.equal(kernelRoleKey({}), '');
  assert.equal(kernelRoleKey(null), '');
  // title alias `title` honored like the reader
  assert.equal(kernelRoleKey({ company: 'Acme', title: 'Engineer' }), 'acme|engineer');
});

// ---- 3. the LANG-CROSS-001 projection prompt -----------------------------
test('projection prompt encodes the invariant-class + DO-NOT-TRANSLATE policy', () => {
  const { system, user } = buildKernelLanguageProjectionPrompt(KERNEL, 'es');
  assert.match(system, /LANG-CROSS-001/);
  assert.match(system, /TARGET LANGUAGE: es/);
  assert.match(system, /KEEP INVARIANT/);
  assert.match(system, /company names/);
  assert.match(system, /metrics and numerals/);
  assert.match(system, /STRICT JSON/);
  assert.match(system, /doNotTranslate/);
  // the source roles + their invariant tokens ride in the user turn
  assert.match(user, /ASPICE/);
  assert.match(user, /ISO 26262/);
  assert.match(user, /"key":/);
});
test('DANISH target adds the keep-idiomatic-English title note; others do not', () => {
  assert.match(buildKernelLanguageProjectionPrompt(KERNEL, 'da').system, /idiomatic professional usage/);
  assert.doesNotMatch(buildKernelLanguageProjectionPrompt(KERNEL, 'zh').system, /idiomatic professional usage/);
});
test('projection prompt carries every keyed role + preserves count', () => {
  const { user } = buildKernelLanguageProjectionPrompt(KERNEL, 'zh');
  const parsed = JSON.parse(user.slice(user.indexOf('{"experience"')));
  assert.equal(parsed.experience.length, 2);
  assert.equal(parsed.experience[0].key, 'kanzen konsulenter aps|product / project expert');
  assert.deepEqual(parsed.experience[0].doNotTranslate, ['ASPICE', 'Kanzen Konsulenter ApS']);
});

// ---- 4. identity projection (english / no model) -------------------------
test('identityKernelProjection mirrors the kernel roles unchanged', () => {
  const proj = identityKernelProjection(KERNEL, 'en');
  assert.equal(proj.language, 'en');
  assert.equal(proj.experience.length, 2);
  assert.equal(proj.experience[0].roleTitle, 'Product / Project Expert');
  assert.deepEqual(proj.experience[0].scope, ['Owned the ASPICE process rollout', 'Directed a 5-person team']);
  assert.equal(proj.experience[1].outcomes[0].result, 'Reduced defects 10x');
});

// ---- 5. model-response parse ---------------------------------------------
test('parseKernelLangModelResponse reads OpenAI + Anthropic shapes + fences', () => {
  const proj = { language: 'es', experience: [{ key: 'a|b', roleTitle: 'Ingeniero', scope: [], outcomes: [] }] };
  const openai = { choices: [{ message: { content: '```json\n' + JSON.stringify(proj) + '\n```' } }] };
  assert.deepEqual(parseKernelLangModelResponse(openai), proj);
  const anthropic = { content: [{ text: 'Here you go: ' + JSON.stringify(proj) }] };
  assert.deepEqual(parseKernelLangModelResponse(anthropic), proj);
});
test('parseKernelLangModelResponse rejects non-projection / garbage', () => {
  assert.equal(parseKernelLangModelResponse({ choices: [{ message: { content: 'sorry no' } }] }), null);
  assert.equal(parseKernelLangModelResponse({ choices: [{ message: { content: '{"foo":1}' } }] }), null);
  assert.equal(parseKernelLangModelResponse(null), null);
  assert.equal(parseKernelLangModelResponse({}), null);
});

// ---- 6. SOURCE-LEVEL locks on the handler + route ------------------------
test('route is registered', () => {
  assert.ok(src.includes("path === '/api/profile/kernel-language-view'"), 'route wired');
  assert.ok(src.includes('return handleApiKernelLanguageView(request, env);'), 'route → handler');
});
test('handler enforces auth + D1 gates before doing work', () => {
  const h = extractUpTo('async function handleApiKernelLanguageView', '// v2.5: GET/PUT /api/prefs');
  assert.match(h, /if \(!id\) \{\s*return jsonResponse\(\{ error: 'unauthenticated'/);
  assert.match(h, /if \(!hasD1\(env\)\) \{\s*return jsonResponse\(\{ error: 'no-d1' \}, 503/);
  assert.match(h, /error: 'bad-language',[\s\S]*?\}, 422/);
  assert.match(h, /error: 'no-kernel',[\s\S]*?\}, 404/);
});
test('handler checks the cache (by source_sig) BEFORE any model call', () => {
  const h = extractUpTo('async function handleApiKernelLanguageView', '// v2.5: GET/PUT /api/prefs');
  const cacheIdx = h.indexOf('FROM kernel_language_view WHERE user_hash = ? AND language = ?');
  const modelIdx = h.indexOf('buildKernelLanguageProjectionPrompt');
  assert.ok(cacheIdx > 0 && modelIdx > cacheIdx, 'cache SELECT precedes prompt build');
  assert.match(h, /cached\.source_sig === sig && !force/);
});
test('GET never generates; POST en short-circuits to identity (no model)', () => {
  const h = extractUpTo('async function handleApiKernelLanguageView', '// v2.5: GET/PUT /api/prefs');
  assert.match(h, /request\.method === 'GET'[\s\S]*?projection: null, stale/);
  assert.match(h, /if \(lang === 'en'\) \{\s*projection = identityKernelProjection/);
});
test('handler upserts the projection with the source signature', () => {
  const h = extractUpTo('async function handleApiKernelLanguageView', '// v2.5: GET/PUT /api/prefs');
  assert.match(h, /INSERT INTO kernel_language_view/);
  assert.match(h, /ON CONFLICT\(user_hash, language\) DO UPDATE SET projection/);
  assert.match(h, /ensureKernelLangViewTable\(env\)/);
});
test('the new table is declared in schema.sql', () => {
  const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  assert.match(schema, /CREATE TABLE IF NOT EXISTS kernel_language_view/);
  assert.match(schema, /PRIMARY KEY \(user_hash, language\)/);
});
