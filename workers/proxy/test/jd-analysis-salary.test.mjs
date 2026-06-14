/* Unit test — ANALYSIS-SALARY-001: normalize() salary_estimate field.
 * No live LLM; exercises the normalizer's defaults, clamping, and validation.
 */
import assert from 'node:assert';
import { normalize } from '../src/jd-analysis.js';

let pass = 0;
const ok = (name, cond) => { assert.ok(cond, name); console.log('PASS ' + name); pass++; };

// 1. stated comp passes through, defaults confidence to 0.8 when omitted
{
  const r = normalize({ salary_estimate: { stated: true, stated_text: '45,000 DKK/month', currency: 'DKK', period: 'month', low: 42000, point: 45000, high: 48000, basis: 'stated in JD' } });
  const s = r.salary_estimate;
  ok('stated flag preserved', s.stated === true);
  ok('stated_text preserved', s.stated_text === '45,000 DKK/month');
  ok('currency preserved', s.currency === 'DKK');
  ok('period preserved', s.period === 'month');
  ok('numbers preserved', s.low === 42000 && s.point === 45000 && s.high === 48000);
  ok('confidence defaults 0.8 when stated & omitted', s.confidence === 0.8);
}

// 2. estimated (not stated) defaults confidence to 0.4 when omitted
{
  const r = normalize({ salary_estimate: { stated: false, currency: 'EUR', period: 'year', low: 60000, point: 72000, high: 85000, basis: 'market estimate from role+location' } });
  ok('estimate confidence defaults 0.4', r.salary_estimate.confidence === 0.4);
  ok('estimate basis preserved', /market estimate/.test(r.salary_estimate.basis));
}

// 3. missing salary_estimate entirely -> safe defaults, never throws
{
  const r = normalize({ summary: 'x' });
  const s = r.salary_estimate;
  ok('missing -> stated false', s.stated === false);
  ok('missing -> null numbers', s.low === null && s.point === null && s.high === null);
  ok('missing -> currency/period null', s.currency === null && s.period === null);
  ok('missing -> confidence 0.4 default', s.confidence === 0.4);
}

// 4. invalid period -> null; out-of-range confidence clamped; junk numbers -> null
{
  const r = normalize({ salary_estimate: { stated: true, period: 'fortnight', confidence: 5, low: 'lots', point: NaN, high: 90000 } });
  const s = r.salary_estimate;
  ok('invalid period -> null', s.period === null);
  ok('confidence clamped to 1', s.confidence === 1);
  ok('non-numeric low -> null', s.low === null);
  ok('NaN point -> null', s.point === null);
  ok('valid high kept', s.high === 90000);
}

// 5. confidence below 0 clamped to 0
{
  const r = normalize({ salary_estimate: { stated: false, confidence: -3 } });
  ok('confidence clamped to 0', r.salary_estimate.confidence === 0);
}

console.log(`\nSALARY-NORMALIZE OK (${pass} checks)`);
