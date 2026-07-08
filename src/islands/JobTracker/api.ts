// JOB-TRACKER-001 Phase 3 — API helper for the JobTracker island.
// Talks to the access-relay /api/job-tracker (per-user JSON doc, rev-based
// optimistic concurrency) and /api/fetch-jd-url (proxy JD fetch). Auth is the
// same cross-origin credentialed cookie the vanilla app uses (credentials:
// 'include'); no token fishing. Base URL mirrors app.js: localStorage
// 'proxyUrl' (JSON) with the relay as fallback.

const RELAY_FALLBACK = 'https://antcv-access-relay.karp-gabriel-a.workers.dev';

export function proxyBase(): string {
  try {
    const raw = localStorage.getItem('proxyUrl');
    if (raw) {
      const v = JSON.parse(raw);
      if (typeof v === 'string' && v.trim()) return v.trim().replace(/\/+$/, '');
    }
  } catch { /* */ }
  return RELAY_FALLBACK;
}

// One weekly-tracker row (index-stable tuple, mirrors the Excel/doc schema).
// [rank, company, role, location, commute, group, fit, posting, tracked, next, flag, urlkey, band]
export type Row = [
  number, string, string, string, string, string, string, string, string, string, string, string, string
];

export interface TrackerDoc {
  version?: number;
  envelope?: string[][];
  rows: Row[];
  urls?: Record<string, string>;
  support?: Record<string, string>;
  scores?: Record<string, { fit?: number; rank?: number; why?: string }>;
  artifacts?: Record<string, {
    application_id?: number; jd_hash?: string; generated_at?: number;
    cv_export_url?: string; cl_export_url?: string; analysis_url?: string;
  }>;
  [k: string]: unknown;
}

export interface DocState { doc: TrackerDoc | null; rev: number; }

async function call(path: string, opts: RequestInit = {}): Promise<Response> {
  return fetch(proxyBase() + path, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
}

export async function getDoc(): Promise<DocState> {
  const res = await call('/api/job-tracker', { method: 'GET' });
  if (!res.ok) throw new Error('load failed: HTTP ' + res.status);
  const j = await res.json();
  return { doc: (j && j.doc) || null, rev: (j && j.rev) || 0 };
}

// PUT with optimistic concurrency. On 409 the caller receives the current
// { doc, rev } so it can merge/refresh instead of clobbering.
export interface PutResult {
  ok: boolean; rev?: number; conflict?: boolean; serverDoc?: TrackerDoc | null; serverRev?: number; error?: string;
}
export async function putDoc(doc: TrackerDoc, baseRev: number | null): Promise<PutResult> {
  const res = await call('/api/job-tracker', {
    method: 'PUT',
    body: JSON.stringify({ doc, base_rev: baseRev }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 409) return { ok: false, conflict: true, serverDoc: j.doc ?? null, serverRev: j.rev };
  if (!res.ok) return { ok: false, error: (j && j.error) || ('HTTP ' + res.status) };
  return { ok: true, rev: j.rev };
}

// Proxy JD fetch (same pipeline that unlocked the LinkedIn set).
export interface JdFetch { ok: boolean; text?: string; title?: string; wall_hint?: string | null; error?: string; }
export async function fetchJdUrl(url: string): Promise<JdFetch> {
  const res = await call('/api/fetch-jd-url', { method: 'POST', body: JSON.stringify({ url }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) return { ok: false, error: (j && j.error) || ('HTTP ' + res.status), wall_hint: j.wall_hint };
  return { ok: true, text: j.text, title: j.title, wall_hint: j.wall_hint };
}

// Cluster top-20 most-demanded qualifications for the user's cluster.
export interface ClusterTop { cluster_id: string | null; top20: { rank: number; qual: string; weight_sum: number }[]; }
export async function fetchClusterTop20(): Promise<ClusterTop> {
  try {
    const res = await call('/api/cluster-top20', { method: 'GET' });
    const j = await res.json().catch(() => ({}));
    return { cluster_id: j.cluster_id ?? null, top20: Array.isArray(j.top20) ? j.top20 : [] };
  } catch { return { cluster_id: null, top20: [] }; }
}

export const TRACKED_STATUSES = [
  'Not started', 'Identified (posting saved)', 'CV/CL drafting',
  'CV/CL drafted', 'Submitted', 'Interview', 'Offer', 'Rejected', 'Archive / closed',
];

// Band colour → tier label (for the list UI).
export function tierOf(band: string): string {
  switch ((band || '').toUpperCase()) {
    case 'DDEBF7': return 'T1';
    case 'E2EFDA': return 'T2';
    case 'FCE4D6': return 'T3';
    case 'FFF2CC': return 'Active';
    case 'D9D9D9': return 'Archive';
    default: return '';
  }
}
