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

// ---- SUBMITTED-VERSION-001 / INTERVIEW-PREP-001 (2026-11-05) -------------------------
// Owner: "allow to save and mark the submitted version" and "support for positions that
// are advancing towards an interview". More doc maps:
//   submitted[uk]      = {snapshot_id, date, application_id, versions: [{...}, ...]}
//                        the top level mirrors the NEWEST version, which is what
//                        interview_prep.py gather() reads (sub.get("application_id"));
//                        `versions` keeps every save, oldest first. The island appends
//                        after the relay stores an insert-only snapshot
//                        (/api/application-snapshots).
//   interview[uk]      = {stage, generated_at, md, json}       the prep-pack script
//   interview_next[uk] = {date, stage}                         the owner's next-stage date;
//                        its own key so a pack rewrite never clobbers it
//   eligibility[uk]    = {verdict: PASS|FLAG|FAIL|UNVERIFIED, quote, kind}  the clearance
//                        gate (discover-positions.py; FLAG = a clearance to obtain)

export const PREP_SCRIPT = 'scripts/job-tracker/interview_prep.py';
/** The exact commands for one row: build + store the pack, and the terminal mock interview. */
export function prepCommands(uk: string, stage: string): { pack: string; mock: string } {
  const st = INTERVIEW_STAGES.includes(stage) ? stage : '1st';
  return {
    pack: 'python ' + PREP_SCRIPT + ' pack --uk ' + uk + ' --stage ' + st + ' --write',
    mock: 'python ' + PREP_SCRIPT + ' mock --uk ' + uk + ' --stage ' + st,
  };
}

export interface SubmittedRec { snapshot_id: number; date: string; application_id: number | null; }
export interface SubmittedEntry extends SubmittedRec { versions: SubmittedRec[]; [k: string]: unknown; }

function submittedRec(e: unknown): SubmittedRec | null {
  if (!isRec(e)) return null;
  const id = Number(e.snapshot_id);
  const date = dayOf(e.date);
  if (!Number.isInteger(id) || id <= 0 || !date) return null;
  const app = Number(e.application_id);
  return { snapshot_id: id, date, application_id: Number.isInteger(app) && app > 0 ? app : null };
}

/** Every saved version of a row, oldest first. Reads the object shape and a bare list. */
export function submittedList(v: unknown): SubmittedRec[] {
  const raw = Array.isArray(v) ? v : isRec(v) ? (Array.isArray(v.versions) && v.versions.length ? v.versions : [v]) : [];
  return raw.map(submittedRec).filter((r): r is SubmittedRec => !!r);
}

/** Append a saved snapshot; earlier ones stay (a re-submission adds a version). */
export function addSubmitted(submitted: unknown, uk: string, rec: SubmittedRec): Record<string, SubmittedEntry> {
  const map = { ...(isRec(submitted) ? submitted : {}) } as Record<string, SubmittedEntry>;
  const old = isRec(map[uk]) ? map[uk] : {};
  map[uk] = { ...old, ...rec, versions: [...submittedList(map[uk]), rec] };
  return map;
}

export interface PrepPack { md: string; stage: string; generated_at: string; hasJson: boolean; }
export function interviewPack(v: unknown): PrepPack | null {
  if (!isRec(v)) return null;
  const md = typeof v.md === 'string' ? v.md.trim() : '';
  const hasJson = v.json !== undefined && v.json !== null;
  if (!md && !hasJson) return null;
  return { md, stage: typeof v.stage === 'string' ? v.stage : '', generated_at: v.generated_at == null ? '' : String(v.generated_at), hasJson };
}

export function nextStageOf(v: unknown): { date: string; stage: string } {
  const r = isRec(v) ? v : {};
  return { date: dayOf(r.date) || '', stage: typeof r.stage === 'string' ? r.stage : '' };
}
/** An empty date clears it ({date: ''}), since a deleted key cannot survive the 3-way merge. */
export function setNextStage(map: unknown, uk: string, date: string, stage: string): Record<string, { date: string; stage: string }> {
  return { ...(isRec(map) ? map : {}) as Record<string, { date: string; stage: string }>, [uk]: { date: dayOf(date) || '', stage } };
}

export type Verdict = 'PASS' | 'FLAG' | 'FAIL' | 'UNVERIFIED';
export function eligibilityView(v: unknown): { verdict: Verdict; quote: string; kind: string } | null {
  if (!isRec(v)) return null;
  const verdict = String(v.verdict || '').trim().toUpperCase();
  if (verdict !== 'PASS' && verdict !== 'FLAG' && verdict !== 'FAIL' && verdict !== 'UNVERIFIED') return null;
  return { verdict, quote: typeof v.quote === 'string' ? v.quote.trim() : '', kind: typeof v.kind === 'string' ? v.kind.trim() : '' };
}

// Minimal markdown for the prep pack: headings, bullets, rules, paragraphs; **bold**,
// `code` and http(s) links inline. Rendered as React elements, never as HTML, so a pack
// cannot inject markup.
export type MdBlock = { t: 'h'; level: number; text: string } | { t: 'li'; depth: number; text: string } | { t: 'p'; text: string } | { t: 'hr' };
export function mdBlocks(md: string): MdBlock[] {
  const out: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => { if (para.length) { out.push({ t: 'p', text: para.join(' ') }); para = []; } };
  for (const raw of String(md || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    let m: RegExpExecArray | null;
    if (!line.trim()) flush();
    else if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) { flush(); out.push({ t: 'h', level: m[1].length, text: m[2] }); }
    else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flush(); out.push({ t: 'hr' }); }
    else if ((m = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line))) { flush(); out.push({ t: 'li', depth: Math.min(3, Math.floor(m[1].length / 2)), text: m[2] }); }
    else para.push(line.trim());
  }
  flush();
  return out;
}
export type MdSpan = { t: 'text' | 'b' | 'code'; s: string } | { t: 'a'; s: string; href: string };
export function mdInline(text: string): MdSpan[] {
  const out: MdSpan[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ t: 'text', s: text.slice(last, m.index) });
    if (m[1]) out.push({ t: 'b', s: m[1] });
    else if (m[2]) out.push({ t: 'code', s: m[2] });
    else out.push({ t: 'a', s: m[3], href: m[4] });
    last = re.lastIndex;
  }
  if (last < text.length) out.push({ t: 'text', s: text.slice(last) });
  return out;
}
