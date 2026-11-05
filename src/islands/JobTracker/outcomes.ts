// OUTCOME-RECORD-001 (2026-11-05) — outcome recording for the Job Tracker, as pure
// logic. Standalone and import-free so Node's type-stripping test runner can load it
// (same constraint as rowVisibility.ts / top5controls.ts).
//
// The tracker kept one status string per row and no date, so nothing could say when a
// row was submitted, how long an interview loop ran, or which applications went quiet.
// Three top-level doc maps carry that now (the relay keeps unknown keys; so does
// normalizeDoc, which spreads ...doc):
//
//   status_history[uk] = [{status, date: YYYY-MM-DD, stage?}]   appended by the island on
//                    a status change; Interview entries carry a stage label
//   followups[uk]  = {submitted, submitted_source: 'first-seen'|'owner', sent: [dates],
//                    thanks: [dates]}                         followups.py (FOLLOWUP-001)
//                    and the island
//   financials[uk] = {summary, error?, cvr?, fetched?, ...}   company_financials.py
//
// The follow-up rule mirrors followups.py `due`: status Submitted, QUIET_DAYS since the
// submitted date or the last follow-up sent, fewer than MAX_FOLLOWUPS sent. Keep the two
// in step.
//
// OUTCOME-RECORD-002 (2026-11-05): 1.51.5342 wrote the status map to `history`. The first
// tracker design (JOB-TRACKER-001, schema.sql) kept a workbook `history[]` ARRAY under that
// key, and a doc that still holds one would lose it on the first dated change. The map is
// `status_history` now; `history` is never written. statusHistoryOf() still reads a
// map-shaped `history` so entries saved by 1.51.5342 are not dropped.

export interface HistoryEntry { status: string; date: string; stage?: string; }
export interface FollowupRec { submitted?: string; submitted_source?: string; sent?: string[]; thanks?: string[]; [k: string]: unknown; }
export interface FinancialsRec { summary?: string; error?: string; cvr?: string; fetched?: string; [k: string]: unknown; }

export const SUBMITTED = 'Submitted';
export const INTERVIEW = 'Interview';
export const INTERVIEW_STAGES = ['screening', '1st', '2nd', 'final', 'case'];
export const QUIET_DAYS = 10;
export const MAX_FOLLOWUPS = 2;

const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Today in the browser's own time zone, YYYY-MM-DD (toISOString is UTC: wrong day after midnight in DK). */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** A real calendar day as YYYY-MM-DD, or null. Reads the first 10 chars, like followups.py _day. */
export function dayOf(v: unknown): string | null {
  const s = String(v ?? '').slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? s : null;
}

const utc = (day: string): number => Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10));
export function daysBetween(from: string, to: string): number { return Math.round((utc(to) - utc(from)) / 86400000); }

const dayList = (v: unknown): string[] => (Array.isArray(v) ? v.map(dayOf).filter((d): d is string => !!d) : []);

/** history[uk] with unreadable entries dropped (another writer may have left one). */
export function historyList(v: unknown): HistoryEntry[] {
  if (!Array.isArray(v)) return [];
  const out: HistoryEntry[] = [];
  for (const e of v) {
    if (!isRec(e) || typeof e.status !== 'string' || !e.status) continue;
    const date = dayOf(e.date);
    if (!date) continue;
    out.push(typeof e.stage === 'string' && e.stage ? { status: e.status, date, stage: e.stage } : { status: e.status, date });
  }
  return out;
}

/**
 * Date a status change into history[uk]. Returns a new map. A repeat of the current
 * status (same stage) is a no-op. On the same day, a stage pick replaces the bare
 * Interview entry, and switching straight back to the previous status drops the
 * mis-pick instead of logging both moves.
 */
export function recordStatus(history: unknown, uk: string, status: string, date: string, stage = ''): Record<string, HistoryEntry[]> {
  const map = { ...(isRec(history) ? history : {}) } as Record<string, HistoryEntry[]>;
  const list = historyList(map[uk]);
  const entry: HistoryEntry = stage ? { status, date, stage } : { status, date };
  const last = list[list.length - 1];
  const prev = list[list.length - 2];
  const same = (e: HistoryEntry | undefined) => !!e && e.status === status && (e.stage || '') === stage;
  if (same(last)) return map;
  if (last && last.date === date && last.status === status) list[list.length - 1] = entry;
  else if (last && last.date === date && same(prev)) list.pop();
  else list.push(entry);
  map[uk] = list;
  return map;
}

/** A row's dated status list: status_history[uk], else a map-shaped legacy `history[uk]`. */
export function statusHistoryOf(doc: { status_history?: unknown; history?: unknown } | null | undefined, uk: string): HistoryEntry[] {
  const sh = doc && isRec(doc.status_history) ? historyList(doc.status_history[uk]) : [];
  if (sh.length) return sh;
  return doc && isRec(doc.history) ? historyList(doc.history[uk]) : [];
}

/** recordStatus on the doc: returns the new status_history map, seeded from statusHistoryOf. */
export function recordStatusIn(doc: { status_history?: unknown; history?: unknown } | null | undefined, uk: string,
  status: string, date: string, stage = ''): Record<string, HistoryEntry[]> {
  const map = { ...(doc && isRec(doc.status_history) ? doc.status_history : {}) } as Record<string, HistoryEntry[]>;
  const base = statusHistoryOf(doc, uk);
  if (base.length) map[uk] = base;
  return recordStatus(map, uk, status, date, stage);
}

/** The current Interview stage: the newest stage in the trailing run of Interview entries. */
export function interviewStage(v: unknown): string {
  const h = historyList(v);
  for (let i = h.length - 1; i >= 0 && h[i].status === INTERVIEW; i--) if (h[i].stage) return h[i].stage as string;
  return '';
}

/** Date of the newest history entry when it matches the row's current status, else ''. */
export function statusSince(v: unknown, status: string): string {
  const h = historyList(v);
  const last = h[h.length - 1];
  return last && last.status === status ? last.date : '';
}

export interface FollowUp {
  submitted: string | null; source: string; sent: number; since: string | null;
  quiet: number | null; due: boolean; last: boolean;
}

/** Follow-up clock for one row; null unless the status is Submitted. */
export function followUpState(rec: unknown, status: string, today: string): FollowUp | null {
  if (String(status || '').trim() !== SUBMITTED) return null;
  const r = isRec(rec) ? rec : {};
  const sent = dayList(r.sent);
  const submitted = dayOf(r.submitted);
  const since = sent.length ? sent.reduce((a, b) => (b > a ? b : a)) : submitted;
  const quiet = since ? daysBetween(since, today) : null;
  const due = sent.length < MAX_FOLLOWUPS && quiet !== null && quiet >= QUIET_DAYS;
  return {
    submitted, source: typeof r.submitted_source === 'string' ? r.submitted_source : '',
    sent: sent.length, since, quiet, due, last: due && sent.length + 1 === MAX_FOLLOWUPS,
  };
}

const withRec = (followups: unknown, uk: string, patch: (r: FollowupRec) => FollowupRec | null): Record<string, FollowupRec> => {
  const map = { ...(isRec(followups) ? followups : {}) } as Record<string, FollowupRec>;
  const next = patch(isRec(map[uk]) ? { ...map[uk] } : {});
  if (next) map[uk] = next;
  return map;
};

/** The island saw the row turn Submitted: date it like followups.py `stamp`, unless a date exists. */
export function stampSubmitted(followups: unknown, uk: string, date: string): Record<string, FollowupRec> {
  return withRec(followups, uk, (r) => (dayOf(r.submitted) ? null : { ...r, submitted: date, submitted_source: 'first-seen' }));
}

/** The owner set the real submitted date (followups.py `set-submitted`). */
export function setSubmitted(followups: unknown, uk: string, date: string): Record<string, FollowupRec> {
  return withRec(followups, uk, (r) => (dayOf(date) ? { ...r, submitted: date, submitted_source: 'owner' } : null));
}

/** The owner sent a follow-up (followups.py `log`); a third is never logged. */
export function logSent(followups: unknown, uk: string, date: string): Record<string, FollowupRec> {
  return withRec(followups, uk, (r) => {
    const sent = dayList(r.sent);
    return sent.length >= MAX_FOLLOWUPS || !dayOf(date) ? null : { ...r, sent: [...sent, date] };
  });
}

/**
 * financials[uk] as display parts. The CHECK note (company_financials.py appends it when
 * the filing's company name does not match) is split out so the one-line summary can
 * truncate without hiding it.
 */
export function financialsView(v: unknown): { text: string; check: string; error: string } | null {
  if (!isRec(v)) return null;
  const s = typeof v.summary === 'string' ? v.summary.trim() : '';
  if (s) {
    const i = s.search(/\bCHECK:/);
    return i < 0 ? { text: s, check: '', error: '' } : { text: s.slice(0, i).trim(), check: s.slice(i).trim(), error: '' };
  }
  const e = typeof v.error === 'string' ? v.error.trim() : '';
  return e ? { text: '', check: '', error: e } : null;
}
