// JOB-TRACKER-001 Phase 3 — API helper for the JobTracker island.
// Talks to the access-relay /api/job-tracker (per-user JSON doc, rev-based
// optimistic concurrency) and /api/fetch-jd-url (proxy JD fetch). Auth is the
// same cross-origin credentialed cookie the vanilla app uses (credentials:
// 'include'); no token fishing. Base URL mirrors app.js: localStorage
// 'proxyUrl' (JSON) with the relay as fallback.

const RELAY_FALLBACK = 'https://antcv-access-relay.karp-gabriel-a.workers.dev';

// Signed-in check — the Job Tracker must never surface before login. Prefer the
// app's own AntcvAuth.isSignedIn(); fall back to a present session token.
export function isAuthed(): boolean {
  try {
    const a = (window as unknown as { AntcvAuth?: { isSignedIn?: () => boolean } }).AntcvAuth;
    if (a && typeof a.isSignedIn === 'function') return !!a.isSignedIn();
  } catch { /* */ }
  try { return !!localStorage.getItem('antcv:auth:token'); } catch { return false; }
}

// PARALLEL-GEN-POINTER-002 client side: this device's stable id (from the
// antcv-jd-scope sidecar). The relay prefers the PER-DEVICE active pointer, so
// an Open that only writes the legacy global row loses to this device's stale
// device row on the next reload (the "still shows the previous company" bug).
// Every active-pointer write from the tracker must carry this stamp.
export function jdScopeDeviceId(): string | null {
  try {
    const s = (window as unknown as { AntcvJdScope?: { deviceId?: () => string } }).AntcvJdScope;
    const d = s && typeof s.deviceId === 'function' ? s.deviceId() : '';
    return d ? String(d).slice(0, 64) : null;
  } catch { return null; }
}

// LOAD-EDITOR-UNSOLICITED-001 (complete fix): claim an app-id for THIS tab BEFORE the
// tracker Open reloads. Without it, the reloaded tab's per-tab currentAppId stays 'kernel'
// (or the previously-edited app), so the app's cold-restore drift guard (__foreignAppId2)
// treats the opened app as "foreign" and SKIPS restoring its saved cv/cl sections — the
// editor shows the unsolicited template while the JD still loads. Claiming the id makes
// getCurrentAppId()===rowId on reload, so the sections restore. This covers the case the
// app.src kernel-adopt carve-out cannot: a tab already editing a DIFFERENT real app.
// Kill switch (shared with the app.src carve-out): antcv:disable-tracker-open-adopt.
export function claimTabAppId(id: number | string): void {
  try {
    if (localStorage.getItem('antcv:disable-tracker-open-adopt') === '1') return;
    const s = (window as unknown as { AntcvJdScope?: { setCurrentAppId?: (v: string) => void } }).AntcvJdScope;
    if (s && typeof s.setCurrentAppId === 'function') s.setCurrentAppId(String(id));
  } catch { /* */ }
}

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
  jd?: Record<string, string>;          // raw JD text per row (carried into the list)
  gen?: Record<string, string>;         // per-row generation tier: 'high' | 'quick'
  queue?: Record<string, boolean>;      // per-row nightly-generation flag (⏰); default on until generated
  brandfit?: Record<string, boolean>;   // per-row: brand-fit the CV/CL to the employer
  brand?: Record<string, { navy?: string; accent?: string; source?: string }>; // sampled employer brand colours
  signals?: Record<string, string>;     // per-row owner-added Additional Signals (on top of auto-collected)
  sigfiles?: Record<string, { name: string; text: string; added?: number }[]>; // per-row attached signal materials (extracted text, capped)
  support?: Record<string, string>;
  webintel?: Record<string, string>;    // per-row distilled web research on the employer (HOLISTIC + SPECIFIC), cached
  scores?: Record<string, { fit?: number; rank?: number; why?: string }>;
  pin?: Record<string, boolean>;         // JOBTRACKER-AUTOFILL-TOP5-001: force into Top-5 (independent of fit rank)
  park?: Record<string, boolean>;        // out of Top-5 candidacy but STAYS LIVE in the weekly list (not archived)
  discovered?: Record<string, { status?: string; reason?: string; uk?: string; company?: string; role?: string; url?: string; first_seen?: string; why?: string }>; // discovery ledger + reject reasons (mirrors discover-positions.py)
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
export interface JdFetch { ok: boolean; text?: string; title?: string; company?: string; wall_hint?: string | null; error?: string; }
export async function fetchJdUrl(url: string): Promise<JdFetch> {
  const res = await call('/api/fetch-jd-url', { method: 'POST', body: JSON.stringify({ url }) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.ok === false) return { ok: false, error: (j && j.error) || ('HTTP ' + res.status), wall_hint: j.wall_hint };
  // LINKEDIN-CARD-EXTRACT-001: the proxy now returns the employer (company) for LinkedIn postings
  // whose guest fragment has no <title>, so the tracker can pre-fill Company + Role again.
  return { ok: true, text: j.text, title: j.title, company: j.company, wall_hint: j.wall_hint };
}

// Seed a real, persisted AntCV application (D1 `application` row, deduped by
// jd_hash) — the traceability path: it appears in Saved Applications and can be
// re-opened in preview. Returns the application id (or null).
export interface SeedPayload {
  jd_text: string; jd_company: string; jd_role: string; jd_language?: string;
  category?: string; supporting_context?: string;
  // BRAND-FIT-OPEN-001: a styleConfig patch (brand palette). Nested into the
  // application's meta.styleConfig so the app applies it per-application on Open
  // (the relay stores body.meta verbatim; the app restore reads meta.styleConfig).
  style_config?: Record<string, string>;
}
export async function createApplication(p: SeedPayload): Promise<number | null> {
  const { style_config, ...rest } = p;
  const body: Record<string, unknown> = { jd_language: 'en', category: 'targeted', ...rest };
  if (style_config && Object.keys(style_config).length) body.meta = { styleConfig: style_config };
  const dev = jdScopeDeviceId(); if (dev) body.device_id = dev; // stamp THIS device's pointer too
  const res = await call('/api/applications', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j && (j.error || j.message)) || ('HTTP ' + res.status));
  return (j && j.application && j.application.id) || null;
}

export async function setActive(applicationId: number): Promise<void> {
  const dev = jdScopeDeviceId();
  await call('/api/active', { method: 'POST', body: JSON.stringify({ application_id: applicationId, ...(dev ? { device_id: dev } : {}) }) });
}

// Ask-AI (low tier): reuse the app's own LLM path — POST an Anthropic-style
// body to the ROOT of the configured proxy, exactly like the vanilla app does.
// ASKAI-404-001: the relay's LLM endpoint is POST / (path === '/'); it 404s
// /v1/messages, which silently killed every island AI call (webCompanyBrief →
// "No web research found", analyzeJd → empty intel, refineAll, Ask-AI chat)
// whenever proxyBase() resolved to the relay. The cv-proxy accepts the root
// POST too, so root works for both bases. Returns the model's text.
export async function askAI(userText: string, system: string, maxTokens = 320): Promise<string> {
  const res = await fetch(proxyBase() + '/', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, system, messages: [{ role: 'user', content: userText }] }),
  });
  const raw = await res.text();
  const parse = (s: string) => { try { return JSON.parse(s); } catch { return null; } };
  if (!res.ok) {
    const j = parse(raw);
    throw new Error((j && (j.error?.message || j.error || j.message)) || ('HTTP ' + res.status));
  }
  // ASKAI-SSE-001: the cv-proxy FORCES stream:true on non-demo Anthropic root
  // calls (index.js "body.stream = (demo || writingStyleRequest) ? false : true"),
  // so a BYOK/owner call answers as text/event-stream, not JSON. Buffer the
  // whole stream (small max_tokens) and join the content_block_delta text.
  if (/^event:|^data:/m.test(raw.slice(0, 400)) || (res.headers.get('content-type') || '').includes('event-stream')) {
    let out = '';
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const d = parse(line.slice(5).trim());
      if (d && d.type === 'content_block_delta' && d.delta && typeof d.delta.text === 'string') out += d.delta.text;
      if (d && d.type === 'error') throw new Error(String(d.error?.message || 'stream error'));
    }
    return out.trim();
  }
  const j = parse(raw) || {};
  if (Array.isArray(j.content)) return j.content.map((c: { text?: string }) => c?.text || '').join('').trim();
  return String(j.completion || j.text || '').trim();
}

// Fit % for a role — analysis-lite: a tier baseline nudged by how many of the
// user's cluster top-20 qualifications the role's JD/intel hits.
export function fitPercent(band: string, text: string, top20: { qual: string }[]): number {
  const base: Record<string, number> = { DDEBF7: 82, E2EFDA: 64, FCE4D6: 46, FFF2CC: 78, D9D9D9: 35 };
  let pct = base[(band || '').toUpperCase()] ?? 55;
  const low = (text || '').toLowerCase();
  let hits = 0;
  for (const q of top20 || []) {
    const words = (q.qual || '').toLowerCase().match(/[a-zà-ú][a-zà-ú+#.-]{2,}/g) || [];
    if (words.length && words.filter((w) => low.includes(w)).length >= Math.ceil(words.length * 0.6)) hits++;
  }
  pct += Math.min(hits * 2.5, 16);
  return Math.max(35, Math.min(98, Math.round(pct)));
}

// Authenticated web research (Google CSE) via the relay /api/research (RESEARCH-001).
// Returns [] on any failure (incl. the Custom Search API not being enabled) so
// callers degrade gracefully.
export async function research(q: string, num = 4): Promise<{ title: string; link: string; snippet: string }[]> {
  try {
    // BYOK-BRAVE-001: send the user's own Brave key (Settings → API Keys → BYOK,
    // stored in localStorage["braveKey"]) so the relay searches on their quota;
    // blank → the relay falls back to its shared BRAVE_API_KEY secret.
    let braveKey = '';
    try { braveKey = JSON.parse(localStorage.getItem('braveKey') || '""') || ''; } catch { /* */ }
    const post = (withKey: boolean) => call('/api/research', { method: 'POST', body: JSON.stringify({ q, num, ...(withKey && braveKey ? { braveKey } : {}) }) });
    let res = await post(true);
    let j = await res.json().catch(() => ({}));
    // BYOK-BRAVE-FALLBACK-001: a stale/invalid user key (relay answers 502
    // "Brave 401/422") must not blank research — retry once on the relay's
    // shared key before giving up.
    if (braveKey && !(j && j.ok && Array.isArray(j.items))) {
      res = await post(false);
      j = await res.json().catch(() => ({}));
    }
    return (j && j.ok && Array.isArray(j.items)) ? j.items : [];
  } catch { return []; }
}

// Sample the employer's real brand colours from their site (BRAND-FIT-REAL-SAMPLE-001).
export interface BrandColors { navy?: string; accent?: string; source?: string; }
export async function fetchBrandColors(jdUrl: string, companyName: string): Promise<BrandColors | null> {
  try {
    const res = await call('/api/fetch-brand-colors', { method: 'POST', body: JSON.stringify({ jdUrl, companyName }) });
    const j = await res.json().catch(() => ({}));
    if (!j || j.ok !== true || (!j.navy && !j.accent)) return null;
    return { navy: j.navy, accent: j.accent, source: j.source };
  } catch { return null; }
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

// Drop-reason → Dream Envelope dimension. Keyword classifier (deterministic,
// zero-cost, offline). The envelope dimension labels must match the doc's
// envelope[i][0] cells. (Proxy low-tier LLM classification is a drop-in upgrade
// behind the same signature — reason in, dimension out.)
export const ENVELOPE_DIMS = [
  'Salary', 'Title', 'Work tasks', 'Commuting', 'Work hours', 'Location / atmosphere', 'Values — what drains me',
];
export function classifyReason(reason: string): string {
  const r = reason.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => r.includes(w));
  if (has('commut', 'travel', 'distance', 'far', 'relocat', 'jutland', 'fly', 'drive', 'km', 'hour away')) return 'Commuting';
  if (has('salary', 'pay', 'comp', 'money', 'wage', 'dkk', 'below', 'low pay', 'underpaid')) return 'Salary';
  if (has('title', 'senior', 'junior', 'level', 'overqualif', 'ic ', 'individual contributor', 'manager role')) return 'Title';
  if (has('weekend', 'overtime', 'hours', 'on-call', 'shift', 'evening', 'night')) return 'Work hours';
  if (has('remote', 'office', 'on-site', 'onsite', 'hybrid', 'noise', 'open-plan', 'location', 'atmosphere', 'acoustic')) return 'Location / atmosphere';
  if (has('task', 'domain', 'tech', 'role type', 'not product', 'not pm', 'bench', 'boring', 'irrelevant', 'skill')) return 'Work tasks';
  return 'Values — what drains me';
}

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
