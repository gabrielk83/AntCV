// diag-gen-coherence.mjs — tests for the coherence parser + filters.
// Run: node diag-gen-coherence.mjs  (from workers/proxy/test)
// Note: runCoherenceReview itself calls multi-llm; here we test the pure parser
// (parseReview) which is where all the shape/validation logic lives, plus the
// single-section short-circuit of runCoherenceReview via a stubbed cascade.
import { parseReview } from '../src/gen-coherence.js';

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error('  FAIL:', m); } };

const ids = new Set(['profile', 'outcomes', 'experience']);

// 1) valid repetition finding across two known sections
let p = parseReview(JSON.stringify({
  findings: [{ kind: 'repetition', sections: ['profile', 'outcomes'], detail: 'same LiDAR win', fix: 'keep in outcomes' }],
  summary: '1 issue',
}), ids);
ok(p && p.findings.length === 1 && p.findings[0].kind === 'repetition', 'valid repetition parsed');
ok(p.summary === '1 issue', 'summary captured');

// 2) fenced JSON (```json ... ```) is stripped and parsed
p = parseReview('```json\n{"findings":[],"summary":"coherent"}\n```', ids);
ok(p && p.findings.length === 0 && p.summary === 'coherent', 'fenced JSON parsed');

// 3) single-section finding is dropped (cross-section only)
p = parseReview(JSON.stringify({ findings: [{ kind: 'redundancy', sections: ['profile'], detail: 'x', fix: 'y' }] }), ids);
ok(p && p.findings.length === 0, 'single-section finding dropped');

// 4) unknown section id filtered out; if that leaves <2, finding dropped
p = parseReview(JSON.stringify({ findings: [{ kind: 'repetition', sections: ['profile', 'nope'], detail: 'x', fix: 'y' }] }), ids);
ok(p && p.findings.length === 0, 'finding with only 1 valid id dropped');

// 5) unknown id filtered but 2 valid remain -> kept, cleaned
p = parseReview(JSON.stringify({ findings: [{ kind: 'contradiction', sections: ['profile', 'experience', 'ghost'], detail: 'team size 7 vs 5', fix: 'reconcile' }] }), ids);
ok(p && p.findings.length === 1 && p.findings[0].sections.length === 2 && !p.findings[0].sections.includes('ghost'), 'unknown id stripped, valid kept');

// 6) invalid kind rejected
p = parseReview(JSON.stringify({ findings: [{ kind: 'vibes', sections: ['profile', 'outcomes'], detail: 'x', fix: 'y' }] }), ids);
ok(p && p.findings.length === 0, 'invalid kind dropped');

// 7) finding with neither detail nor fix dropped
p = parseReview(JSON.stringify({ findings: [{ kind: 'repetition', sections: ['profile', 'outcomes'] }] }), ids);
ok(p && p.findings.length === 0, 'empty detail+fix dropped');

// 8) malformed JSON -> null
ok(parseReview('not json at all', ids) === null, 'malformed JSON -> null');

// 9) duplicate section ids de-duped
p = parseReview(JSON.stringify({ findings: [{ kind: 'redundancy', sections: ['profile', 'profile', 'outcomes'], detail: 'x', fix: 'y' }] }), ids);
ok(p && p.findings[0].sections.length === 2, 'duplicate ids de-duped');

// 10) overlong detail/fix truncated to 600
const long = 'z'.repeat(900);
p = parseReview(JSON.stringify({ findings: [{ kind: 'repetition', sections: ['profile', 'outcomes'], detail: long, fix: long }] }), ids);
ok(p && p.findings[0].detail.length === 600 && p.findings[0].fix.length === 600, 'detail/fix truncated to 600');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
