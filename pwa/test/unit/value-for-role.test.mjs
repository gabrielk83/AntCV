// VALUE-FOR-ROLE-001 (owner 2026-10-01): "Make sure my profile and core competencies make it clear how I create value
// for the specific position. Make sure it is always in the AntCV platform and in copenhagen minimal."
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const gold = JSON.parse(fs.readFileSync(path.join(dir, 'gold-rules.json'), 'utf8'));
const block = gold.prompt_block.join('\n');

test('the control site carries the rule for PROFILE and CORE COMPETENCIES, for every style and layout', () => {
  assert.match(block, /VALUE FOR THIS POSITION \(VALUE-FOR-ROLE-001/);
  assert.match(block, /Copenhagen and Nordic Minimal included/);
  assert.match(block, /PROFILE \(VALUE-FOR-ROLE-001\): .*VALUE sentence/);
  assert.match(block, /CORE COMPETENCIES \(VALUE-FOR-ROLE-001\): .*JD's top needs.*never a bare keyword or standards list/);
  assert.match(block, /Without a JD \(unsolicited\)/);
});

test('the rule sits after the older table rules so it wins', () => {
  const i = gold.prompt_block.findIndex((l) => /VALUE-FOR-ROLE-001/.test(l));
  const j = gold.prompt_block.findIndex((l) => /Core-competency tables: 3-4 TABLE ROWS/.test(l));
  assert.ok(i > j && j >= 0);
});

test('the generation prompt no longer asks for generic keyword cells (app.js + mirror)', () => {
  for (const f of ['app.js', 'app.src.js']) {
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!s.includes("BROADER standing competency areas that are NOT named in WHAT I BRING"), f + ': generic areas instruction gone');
    assert.ok(!s.includes('HALF a line, max ~28 characters, a compact comma-separated phrase, NOT a sentence'), f + ': keyword-only cell gone');
    assert.ok(s.includes('each framed as the value the candidate delivers on that need (VALUE-FOR-ROLE-001)'), f + ': value framing present');
  }
});
