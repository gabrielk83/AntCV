// SAVE-409-MERGE-002 (2026-11-01): three-way rebase of this session's edits onto a
// newer server doc after a rev conflict. Standalone and import-free so Node's
// type-stripping test runner can load it (see top5controls.ts).
//
// SAVE-409-MERGE-001 made local win per row key. A tab left open for hours holds
// EVERY row, so any save from it re-wrote its old copy of each row over the server:
// closures made by the owner's routines and scripts were silently reopened (tracker
// rev 339 and rev 342 on 2026-11-01 reverted 10 owner closures). The fix compares
// against BASE, the doc this session last loaded or saved: a local row or map key
// wins only when this session changed it; everything else takes the server value.
// With no base (legacy caller) the old local-wins behaviour is kept.

type Row = unknown[];
type Doc = { rows?: Row[]; envelope?: unknown; [k: string]: unknown };

export const MERGE_MAPS = ['urls', 'jd', 'gen', 'queue', 'brandfit', 'brand', 'signals', 'sigfiles', 'support',
  'webintel', 'scores', 'artifacts', 'discovered', 'pin', 'park'];

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function mergeDocs<T extends Doc>(server: T, local: T, base?: T | null): T {
  const out = { ...server } as T;
  const rec = (d: Doc | null | undefined, k: string): Record<string, unknown> | undefined =>
    (d ? (d[k] as Record<string, unknown> | undefined) : undefined);
  for (const k of MERGE_MAPS) {
    const sv = rec(server, k);
    const lv = rec(local, k);
    if (!lv || typeof lv !== 'object') continue;
    const bv = rec(base, k) || {};
    const m: Record<string, unknown> = { ...(sv || {}) };
    for (const key of Object.keys(lv)) {
      if (!base || !same(lv[key], bv[key])) m[key] = lv[key];
    }
    (out as Doc)[k] = m;
  }
  const key = (r: Row): unknown => r[11];
  const lmap = new Map((local.rows || []).map((r) => [key(r), r]));
  const bmap = new Map(((base && base.rows) || []).map((r) => [key(r), r]));
  const skeys = new Set((server.rows || []).map(key));
  out.rows = (server.rows || []).map((r) => {
    const l = lmap.get(key(r));
    if (!l) return r;
    if (base && bmap.has(key(r)) && same(l, bmap.get(key(r)))) return r;
    return l;
  });
  for (const r of local.rows || []) {
    if (skeys.has(key(r))) continue;
    if (base && bmap.has(key(r))) continue; // gone from the server since this session loaded it
    out.rows.push(r);
  }
  if (local.envelope && (!base || !same(local.envelope, base.envelope))) out.envelope = local.envelope;
  return out;
}
