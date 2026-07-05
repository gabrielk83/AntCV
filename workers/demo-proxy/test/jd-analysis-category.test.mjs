/* Unit test — CLUSTER-QUAL-001-CATEGORY-001: normalize() category field.
 *
 * The JD-analysis prompt schema always requested "category" (one of the 12
 * real ids, or "unsolicited"), but normalize() never surfaced it in the
 * response — the client had no real classified category to persist, so
 * every save sent a placeholder "targeted"/"unsolicited" string instead
 * (app.src.js CATEGORIZE-ON-ATTACH-001), and the whole category->cluster
 * pipeline (register row 9 / CLUSTER-QUAL-001) never saw real data in D1.
 * No live LLM; exercises the normalizer's category passthrough + default.
 */
import assert from 'node:assert';
import { normalize } from '../src/jd-analysis.js';

let pass = 0;
const ok = (name, cond) => { assert.ok(cond, name); console.log('PASS ' + name); pass++; };

// 1. a real classified category passes through verbatim
{
  const r = normalize({ category: 'product_management' });
  ok('category passes through', r.category === 'product_management');
}

// 2. missing category -> safe default, never throws
{
  const r = normalize({ summary: 'x' });
  ok('missing -> unsolicited default', r.category === 'unsolicited');
}

// 3. a non-string category (LLM glitch) -> safe default, never throws
{
  const r = normalize({ category: 123 });
  ok('non-string -> unsolicited default', r.category === 'unsolicited');
  assert.doesNotThrow(() => normalize({ category: { weird: true } }));
  assert.doesNotThrow(() => normalize({ category: null }));
}

// 4. an explicit "unsolicited" round-trips as-is
{
  const r = normalize({ category: 'unsolicited' });
  ok('explicit unsolicited round-trips', r.category === 'unsolicited');
}

// 5. any of the 12 real category ids passes through — normalize() itself
// doesn't validate against the fixed set (access-relay's normalizeCategory()
// is the authoritative validator server-side); this just proves nothing
// here silently drops or mangles a real value.
{
  const ids = [
    'engineering_hardware', 'engineering_software', 'product_management',
    'research_phd', 'program_management', 'operations',
    'data_analytics', 'consulting', 'executive', 'finance', 'people_soft',
  ];
  ids.forEach((id) => {
    const r = normalize({ category: id });
    ok(`"${id}" passes through unmodified`, r.category === id);
  });
}

console.log(`\nJD-ANALYSIS-CATEGORY OK (${pass} checks)`);
