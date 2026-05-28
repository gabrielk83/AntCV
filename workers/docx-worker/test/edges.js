// Edge case tests for the docx worker.
// Verifies:
//   1. Minimal payload works
//   2. Schema validator catches malformed payloads
//   3. Cover letter (linear) layout works
//   4. Empty sections don't crash

import { writeFileSync } from 'node:fs';
import { generateDocx } from '../src/generate.js';
import { validatePayload } from '../src/schema.js';

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log(`✓ ${name}`); pass++; }
  catch (e) { console.error(`✗ ${name}\n   ${e.message}`); fail++; }
};

// 1. Minimal valid payload
await t('minimal CV payload generates docx', async () => {
  const p = {
    doc: 'cv',
    personal_info: { name: 'Test User' },
    sections: [{ id: 's1', title: 'PROFILE', loc: 'main', on: true, type: 'text', content: 'Hello.' }],
  };
  const errs = validatePayload(p);
  if (errs.length) throw new Error('unexpected errors: ' + errs.join('; '));
  const buf = await generateDocx(p);
  if (!buf || buf.byteLength < 1000) throw new Error('output too small');
  writeFileSync('out_minimal.docx', buf);
});

// 2. Cover letter layout
await t('cover letter linear layout', async () => {
  const p = {
    doc: 'cl',
    layout: 'linear',
    personal_info: { name: 'Test User', email: 'a@b.com' },
    meta: { subtitle: 'Application: Senior Engineer — ExampleCo' },
    sections: [
      { id: 'greeting', title: 'Greeting', loc: 'main', on: true, type: 'text', content: 'Dear Hiring Manager,' },
      { id: 'who', title: 'WHO I AM', loc: 'main', on: true, type: 'text', content: 'I am a test.' },
      { id: 'foundation', title: 'FOUNDATION', loc: 'main', on: true, type: 'foundation', hands_on: 'Built things.', professionally: 'Translated to value.' },
    ],
  };
  const buf = await generateDocx(p);
  writeFileSync('out_cl.docx', buf);
});

// 3. Schema validator rejects bad doc
await t('schema rejects invalid doc value', () => {
  const errs = validatePayload({ doc: 'invalid', personal_info: {}, sections: [] });
  if (errs.length === 0) throw new Error('should have rejected');
  if (!errs.some(e => e.includes('doc'))) throw new Error('error not about doc field');
});

// 4. Schema rejects missing sections
await t('schema rejects missing sections', () => {
  const errs = validatePayload({ doc: 'cv', personal_info: {} });
  if (!errs.some(e => e.includes('sections'))) throw new Error('should mention sections');
});

// 5. Schema rejects malformed section type
await t('schema rejects invalid section type', () => {
  const errs = validatePayload({
    doc: 'cv', personal_info: {},
    sections: [{ id: 's1', title: 't', type: 'nonexistent_type' }],
  });
  if (!errs.some(e => e.includes('type'))) throw new Error('should mention type');
});

// 6. Empty content fields don't crash
await t('empty content survives', async () => {
  const p = {
    doc: 'cv',
    personal_info: { name: 'X' },
    sections: [
      { id: 's1', title: 'EMPTY', loc: 'main', on: true, type: 'text', content: '' },
      { id: 's2', title: 'EMPTY LIST', loc: 'sidebar', on: true, type: 'list', items: [] },
      { id: 's3', title: 'EMPTY EXP', loc: 'main', on: true, type: 'experience', roles: [] },
    ],
  };
  await generateDocx(p);
});

// 7. All section types in one document
await t('all section types render', async () => {
  const p = {
    doc: 'cv',
    personal_info: { name: 'Comprehensive Test' },
    sections: [
      { id: 'a', title: 'TEXT', loc: 'main', type: 'text', content: 'p1\n\np2', on: true },
      { id: 'b', title: 'TEXT INLINE', loc: 'main', type: 'text_inline', content: 'inline', on: true },
      { id: 'c', title: 'TEXT BULLETS', loc: 'main', type: 'text_bullets', intro: 'Intro.', items: ['x', 'y'], closing: 'Close.', on: true },
      { id: 'd', title: 'FOUNDATION', loc: 'main', type: 'foundation', hands_on: 'h', professionally: 'p', on: true },
      { id: 'e', title: 'BULLETS', loc: 'main', type: 'bullets', items: [{ b: 'Verb', t: 'thing' }, { t: 'plain' }, 'string'], on: true },
      { id: 'f', title: 'TABLE', loc: 'main', type: 'table', rows: [['H1', 'H2'], ['a', 'b']], on: true },
      { id: 'g', title: 'EXPERIENCE', loc: 'main', type: 'experience', roles: [{ id: 'r1', title: 'T', company: 'C', years: 'Y', bullets: ['one'] }], on: true },
      { id: 'h', title: 'LIST', loc: 'sidebar', type: 'list', items: ['l1', 'l2'], on: true },
      { id: 'i', title: 'LIST ITALIC', loc: 'sidebar', type: 'list_italic', items: ['it1'], on: true },
      { id: 'j', title: 'LABELED', loc: 'sidebar', type: 'labeled_list', items: [{ l: 'L', v: 'V' }], on: true },
      { id: 'k', title: 'EDUCATION', loc: 'sidebar', type: 'education', items: [{ deg: 'PhD', sch: 'Uni' }], on: true },
    ],
  };
  const buf = await generateDocx(p);
  writeFileSync('out_alltypes.docx', buf);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
