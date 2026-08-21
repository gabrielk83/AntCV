// LLM-COST-EFFECTIVE-FROM-001 (nightly 2026-08-21)
//
// telemetry.js prices every llm_call from the D1 llm_provider_costs table
// before it writes the row. That lookup took the newest row UNCONDITIONALLY
// (`ORDER BY effective_from DESC LIMIT 1`), so `effective_from` only ever
// meant insert order: a row dated in the future priced today's traffic from
// the moment it was inserted, which makes the column unusable for its one
// job — staging an announced price change ahead of its start date.
//
// Found while live-verifying the 2026-08-20 gemini/mistral rate correction
// against D1 (that correction was back-dated to 2026-08-20, so nothing
// mispriced; the hazard is the NEXT pre-staged change).
//
// These tests drive the real insertLlmCall() against a stub D1 that honours
// the WHERE clause, so they fail if the guard is ever dropped again.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { insertLlmCall } from '../../workers/access-relay/src/telemetry.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const TELEMETRY_SRC = path.join(ROOT, 'workers', 'access-relay', 'src', 'telemetry.js');

const DAY = 86400;
const nowSec = () => Math.floor(Date.now() / 1000);

// A stub D1 that understands exactly the two statements insertLlmCall issues:
// the llm_provider_costs SELECT (which it answers from `priceRows`, applying
// the same effective_from semantics a real SQLite would) and the llm_calls
// INSERT (which it records so the test can read back the priced cost).
function makeDb(priceRows) {
  const inserted = [];
  return {
    inserted,
    prepare(sql) {
      const stmt = { sql, params: [] };
      stmt.bind = (...params) => { stmt.params = params; return stmt; };
      stmt.first = async () => {
        if (!/FROM llm_provider_costs/.test(sql)) return null;
        const [provider, model, cutoff] = stmt.params;
        // Honour the WHERE clause the source actually wrote. If the guard is
        // missing from the SQL, `cutoff` is undefined and every row matches —
        // which is precisely the regression these tests catch.
        const guarded = /effective_from\s*<=\s*\?/.test(sql);
        const matches = priceRows
          .filter((r) => r.provider === provider && r.model === model)
          .filter((r) => !guarded || r.effective_from == null || r.effective_from <= cutoff)
          .sort((a, b) => (b.effective_from ?? 0) - (a.effective_from ?? 0));
        const row = matches[0];
        return row ? { p: row.p, c: row.c } : null;
      };
      stmt.run = async () => {
        if (/INSERT INTO llm_calls/.test(sql)) inserted.push(stmt.params);
        return { meta: { last_row_id: inserted.length } };
      };
      return stmt;
    },
  };
}

const EVENT = {
  event: 'llm_call',
  provider: 'gemini',
  model: 'gemini-2.5-flash',
  task: 'compress',
  input_tokens: 1_000_000,
  output_tokens: 1_000_000,
  cost_usd: 999, // the client's number — must never be reached while D1 answers
};

// estimated_cost_usd is the 21st bound param of the llm_calls INSERT.
const COST_PARAM_INDEX = 20;

async function priceWith(priceRows) {
  const db = makeDb(priceRows);
  await insertLlmCall({ DB: db }, null, { ...EVENT });
  assert.equal(db.inserted.length, 1, 'exactly one llm_calls row inserted');
  return db.inserted[0][COST_PARAM_INDEX];
}

test('a future-dated price row does NOT price today\'s traffic', async () => {
  const cost = await priceWith([
    { provider: 'gemini', model: 'gemini-2.5-flash', p: 0.3, c: 2.5, effective_from: nowSec() - 30 * DAY },
    { provider: 'gemini', model: 'gemini-2.5-flash', p: 99, c: 990, effective_from: nowSec() + 30 * DAY },
  ]);
  // 1M in + 1M out at the ARRIVED rate = 0.3 + 2.5.
  assert.equal(cost, 2.8, 'priced from the arrived row, not the future one');
});

test('the newest ARRIVED row wins over an older arrived row', async () => {
  const cost = await priceWith([
    { provider: 'gemini', model: 'gemini-2.5-flash', p: 0.075, c: 0.3, effective_from: nowSec() - 400 * DAY },
    { provider: 'gemini', model: 'gemini-2.5-flash', p: 0.3, c: 2.5, effective_from: nowSec() - 1 * DAY },
  ]);
  assert.equal(cost, 2.8, 'newest arrived rate applies');
});

test('a NULL effective_from row is treated as always in effect', async () => {
  const cost = await priceWith([
    { provider: 'gemini', model: 'gemini-2.5-flash', p: 0.3, c: 2.5, effective_from: null },
  ]);
  assert.equal(cost, 2.8, 'undated rows keep the pre-guard behaviour');
});

test('when every row is future-dated the relay falls back to its own table, not the client', async () => {
  const cost = await priceWith([
    { provider: 'gemini', model: 'gemini-2.5-flash', p: 99, c: 990, effective_from: nowSec() + 30 * DAY },
  ]);
  // model-rates.js RATES['gemini-2.5-flash'] = [0.30, 2.50] → same 2.8, and
  // crucially NOT the client's 999.
  assert.equal(cost, 2.8, 'fell through to rateForStrict, never to cost_usd');
});

test('the guard is present in the SQL itself', () => {
  const src = readFileSync(TELEMETRY_SRC, 'utf8');
  const sel = src.slice(src.indexOf('FROM llm_provider_costs'));
  const clause = sel.slice(0, sel.indexOf('LIMIT 1'));
  assert.match(clause, /effective_from\s+IS\s+NULL\s+OR\s+effective_from\s*<=\s*\?/,
    'the llm_provider_costs lookup must exclude not-yet-effective rows');
});
