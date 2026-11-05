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
  'webintel', 'scores', 'artifacts', 'discovered', 'pin', 'park', 'history', 'followups'];

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// OUTCOME-RECORD-001: history[uk] is a dated list and followups[uk] a record that
// followups.py writes too, so where this session changed the key, merge INSIDE it:
// a follow-up the script logged, or a status another tab dated, must survive.
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function mergeHistory(sv: unknown, lv: unknown, bv: unknown): unknown {
  const l = list(lv);
  const has = (xs: unknown[], e: unknown) => xs.some((x) => same(x, e));
  const added = list(sv).filter((e) => !has(list(bv), e) && !has(l, e));
  const date = (e: unknown) => String((e as { date?: unknown } | null)?.date ?? '');
  return [...l, ...added].map((e, i) => ({ e, i }))
    .sort((a, b) => (date(a.e) < date(b.e) ? -1 : date(a.e) > date(b.e) ? 1 : a.i - b.i)).map((x) => x.e);
}
function mergeFollowup(sv: unknown, lv: unknown, bv: unknown): unknown {
  const rec = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {});
  const s = rec(sv), l = rec(lv), b = rec(bv);
  const out: Record<string, unknown> = { ...s };
  for (const f of Object.keys(l)) {
    if (same(l[f], b[f])) continue;
    out[f] = Array.isArray(l[f]) && Array.isArray(s[f])
      ? Array.from(new Set([...(s[f] as unknown[]), ...(l[f] as unknown[])].map(String))).sort()
      : l[f];
  }
  return out;
}
const INNER: Record<string, (sv: unknown, lv: unknown, bv: unknown) => unknown> = { history: mergeHistory, followups: mergeFollowup };

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
      if (base && same(lv[key], bv[key])) continue;
      m[key] = INNER[k] && sv && key in sv ? INNER[k](sv[key], lv[key], bv[key]) : lv[key];
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
