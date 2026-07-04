// main-column-ratio-width.test.mjs
// ============================================================
// PB-WORKER-SIDEBAR-RATIO-001 regression lock (register row 2, "line-end overflow").
// The main-column body/bullet text used to wrap ~half a line early in the export
// because the worker hardcoded SIDEBAR_W=4636 (~0.389), making the MAIN column ~6%
// narrower than the preview (owner: "words slide; the PDF is slightly narrower than
// the preview"). The fix derives the split from the forwarded sidebar_ratio (default
// 0.33, same as the preview). This test proves the main-column section-wrapper width
// is DERIVED from the ratio (differential across two ratios) and that the legacy
// narrow width is gone — so no future edit can silently reintroduce the early wrap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';

function entries(buf) {
  let i = buf.length - 22; for (; i >= 0; i--) if (buf.readUInt32LE(i) === 0x06054b50) break;
  const n = buf.readUInt16LE(i + 10); let p = buf.readUInt32LE(i + 16); const out = {};
  for (let e = 0; e < n; e++) {
    const cs = buf.readUInt32LE(p + 20), nl = buf.readUInt16LE(p + 28), el = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nl);
    const lN = buf.readUInt16LE(lho + 26), lE = buf.readUInt16LE(lho + 28), ds = lho + 30 + lN + lE;
    const comp = buf.slice(ds, ds + cs);
    out[name] = buf.readUInt16LE(p + 10) === 0 ? comp : inflateRawSync(comp); p += 46 + nl + el + cl;
  }
  return out;
}

async function gridCols(ratio) {
  const mod = await import('../src/index.js');
  const payload = {
    schema_version: '1.0', doc: 'cv', language: 'en', layout: 'two_column', filename: 't', sidebar_ratio: ratio,
    personal_info: { name: 'G', email: 'g@b.c' }, meta: { role: 'R', subtitle: 'S' }, style: { navy: '#283556', accent: '#01B7BB' },
    sections: [
      { id: 'experience', title: 'EXPERIENCE', loc: 'main', on: true, type: 'experience', roles: [{ id: 'r1', title: 'Role', company: 'C', years: '2020', bullets: ['Long bullet text that would wrap near the main column edge.'] }] },
      { id: 'skills', title: 'SKILLS', loc: 'sidebar', on: true, type: 'rich_block', items: [{ b: '', t: 'Optics' }] },
    ],
  };
  const req = new Request('https://x/generate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const res = await mod.default.fetch(req, {}, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(res.status, 200, 'worker returns 200');
  const files = entries(Buffer.from(await res.arrayBuffer()));
  const xml = files['word/document.xml'].toString('utf8');
  const cols = [...xml.matchAll(/<w:gridCol\s+w:w="(\d+)"/g)].map((m) => Number(m[1]));
  return [...new Set(cols)].sort((a, b) => a - b);
}

const PAGE_W = 11906;
const mainContent = (ratio) => (PAGE_W - Math.round(PAGE_W * ratio)) - 288; // section-wrapper content width

test('main-column section width is DERIVED from sidebar_ratio (not the legacy narrow constant)', async () => {
  const at33 = await gridCols(0.33);
  const at45 = await gridCols(0.45);
  console.log('gridCols @0.33:', at33.join(', '));
  console.log('gridCols @0.45:', at45.join(', '));

  const want33 = mainContent(0.33); // 7689
  const want45 = mainContent(0.45); // 6260
  const legacyBug = 7270 - 288;      // 6982 — the pre-fix narrow main content

  // the ratio-derived main-content width is present at each ratio
  assert.ok(at33.includes(want33), `@0.33 expected a main-content gridCol ${want33}; got ${at33.join(',')}`);
  assert.ok(at45.includes(want45), `@0.45 expected a main-content gridCol ${want45}; got ${at45.join(',')}`);

  // the main width actually MOVED with the ratio (proves it is derived, not constant)
  assert.notEqual(want33, want45);
  assert.ok(!at33.includes(want45) && !at45.includes(want33), 'main-content width tracks the ratio');

  // the legacy narrow main width (root cause of the early wrap) is gone at the default ratio
  assert.ok(!at33.includes(legacyBug), `legacy narrow main-content ${legacyBug} must not reappear`);
});
