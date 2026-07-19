/* HYGIENE-CATEGORY-DOWNGRADE-001 regression guard (owner 2026-07-18).
 *
 * A real, targeted job (named employer + substantive JD) must never be downgraded to
 * 'unsolicited' just because a save arrived with a blank/invalid category (a JD-less-
 * framed regen). That downgrade left the owner's live Ibsen "Project Manager for SBC"
 * application stored as category='unsolicited' — flipping generation into unsolicited
 * breadth mode and making the reopen clear the JD instead of seeding it.
 *
 * Loads the REAL relay source, extracts CATEGORIES + normalizeCategory +
 * resolveTargetedCategory into a vm, and asserts the guard only prevents a DOWNGRADE.
 *
 * Run: node --test workers/access-relay/tests/category-downgrade-guard.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function extract(startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > 0, `marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start) + endMarker.length;
  assert.ok(end > start, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}

const categoriesSrc = extract('const CATEGORIES = new Set([', ']);');
const normSrc = extract('function normalizeCategory(cat) {', '\n}');
const resolveSrc = extract('function resolveTargetedCategory(', '\n}');

const ctx = { console, JSON, String, Array, Object };
vm.createContext(ctx);
vm.runInContext(
  categoriesSrc + '\n' + normSrc + '\n' + resolveSrc +
  '\nthis.resolveTargetedCategory = resolveTargetedCategory;\nthis.normalizeCategory = normalizeCategory;',
  ctx,
);
const { resolveTargetedCategory, normalizeCategory } = ctx;

const JD = 'Project Manager for SBC. '.repeat(20); // >200 chars, substantive

test('downgrade prevented: unsolicited-coerced save keeps the existing targeted category', () => {
  assert.equal(resolveTargetedCategory('unsolicited', 'program_management', 'Ibsen Photonics', JD), 'program_management');
  assert.equal(resolveTargetedCategory('unsolicited', 'engineering_hardware', 'NVIDIA', JD), 'engineering_hardware');
});

test('genuine unsolicited (no real employer) is left unsolicited', () => {
  assert.equal(resolveTargetedCategory('unsolicited', 'program_management', '', JD), 'unsolicited');
  assert.equal(resolveTargetedCategory('unsolicited', 'program_management', 'Unsolicited', JD), 'unsolicited');
});

test('new row with no existing category is not invented (still unsolicited)', () => {
  assert.equal(resolveTargetedCategory('unsolicited', null, 'Ibsen Photonics', JD), 'unsolicited');
  assert.equal(resolveTargetedCategory('unsolicited', undefined, 'Ibsen Photonics', JD), 'unsolicited');
});

test('a legitimate upgrade (client sends a real category) always wins', () => {
  assert.equal(resolveTargetedCategory('program_management', 'unsolicited', 'Ibsen Photonics', JD), 'program_management');
  assert.equal(resolveTargetedCategory('research_phd', 'program_management', 'Ibsen Photonics', JD), 'research_phd');
});

test('a tiny/empty JD is not treated as a real targeted job', () => {
  assert.equal(resolveTargetedCategory('unsolicited', 'program_management', 'Ibsen Photonics', 'short'), 'unsolicited');
});

test('an existing INVALID category is not preserved (must be one of the 12)', () => {
  assert.equal(resolveTargetedCategory('unsolicited', 'garbage_cat', 'Ibsen Photonics', JD), 'unsolicited');
});

test('sanity: the guard never fabricates a category outside the incoming/existing pair', () => {
  const out = resolveTargetedCategory('unsolicited', 'program_management', 'Ibsen Photonics', JD);
  assert.ok(out === 'program_management' || out === 'unsolicited');
});
