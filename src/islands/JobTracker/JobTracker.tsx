// JOB-TRACKER-001 Phase 3 — JobTracker island.
// V1 review/edit list · V2 add-JD (URL or file) · V3 Top-5 focus + prepare/open
// a traceable saved application · V4 drop → why → classify → Dream Envelope.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDoc, putDoc, fetchJdUrl, createApplication, setActive, classifyReason,
  fetchClusterTop20, askAI, fitPercent, fetchBrandColors, research, claimTabAppId, TRACKED_STATUSES, type TrackerDoc, type Row,
} from './api';
import { computeTier, orderTop5 } from './rank';
import { top5ClickAction } from './top5controls';
import { CLUSTER_REFRESH_MS, reconcileSnapshot, shouldRefetchOnFocus } from './clusterRefresh';

const NAVY = '#1F3864';
const today = () => new Date().toISOString().slice(0, 10);
function slug(s: string): string {
  return (s || 'row').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'row';
}

// Map a role to one of the relay's 12 real categories. A NON-real value (e.g.
// "targeted") is coerced to "unsolicited" server-side, which makes the app treat
// the restored application as a no-JD unsolicited draft and BLANK the JD box on
// open (the "nothing set" bug). Pick a real category so the JD survives.
function categoryFor(role: string, company: string): string {
  const s = (role + ' ' + company).toLowerCase();
  if (/\b(product manager|product owner|\bpm\b|product\b)/.test(s)) return 'product_management';
  if (/(program|project) manager|programme|delivery lead|steering/.test(s)) return 'program_management';
  if (/software|developer|full-?stack|backend|frontend|\bit\b|data engineer/.test(s)) return 'engineering_software';
  if (/data|analytics|analyst|scientist/.test(s)) return 'data_analytics';
  if (/research|phd|postdoc/.test(s)) return 'research_phd';
  if (/consultant|consulting|advisor/.test(s)) return 'consulting';
  if (/quality|auditor|qms|operations|supply/.test(s)) return 'operations';
  if (/director|head of|vp|chief|executive/.test(s)) return 'executive';
  return 'engineering_hardware'; // EO / optics / photonics / hardware default
}

// Tier meta keyed by the row's band hex: label, accent, a MORE-notable row tint,
// and a legend description.
interface Tier { key: string; label: string; accent: string; tint: string; desc: string; }
const TIERS: Record<string, Tier> = {
  DDEBF7: { key: 'T1', label: 'T1', accent: '#2E5DA8', tint: '#CFE0F7', desc: 'Strong fit — EO / photonics, open & reachable' },
  E2EFDA: { key: 'T2', label: 'T2', accent: '#3E8E3E', tint: '#D2ECC5', desc: 'Transferable / PM-side — envelope fit, a step away' },
  FCE4D6: { key: 'T3', label: 'T3', accent: '#C4711F', tint: '#FAD3B4', desc: 'Weak / off-domain — apply only if pivoting' },
  FFF2CC: { key: '★', label: 'In progress', accent: '#B58A00', tint: '#FFE7A0', desc: 'Submitted / in progress' },
  D9D9D9: { key: '—', label: 'Archive', accent: '#777777', tint: '#D0D0D0', desc: 'Closed / archived' },
};
const tierOf = (band: string): Tier => TIERS[(band || '').toUpperCase()] || { key: '', label: '', accent: '#999', tint: '#f3f3f3', desc: '' };

// JOBLIST-FILTER-001: the Legend doubles as the Job List's row filter. Every
// tier/status swatch (T1/T2/T3/In progress/Archive) plus ★ Top-5 and ✅ JD
// stored is a checkbox. Default = every tier checked EXCEPT Archive (so closed
// roles stay hidden until asked for), ★/✅ unchecked (no extra restriction).
// Stored in sessionStorage — NOT localStorage — so the choice survives while
// the app stays open (reopening the Job Tracker, re-renders) but resets back
// to the default the next time the app is started (new tab/session).
const BAND_KEYS = ['DDEBF7', 'E2EFDA', 'FCE4D6', 'FFF2CC', 'D9D9D9'];
const FILTER_STORAGE_KEY = 'antcv:jobtracker:legendFilter';
interface JLFilters { bands: string[]; top5Only: boolean; jdOnly: boolean; queuedOnly: boolean; }
function defaultJLFilters(): JLFilters { return { bands: BAND_KEYS.filter((b) => b !== 'D9D9D9'), top5Only: false, jdOnly: false, queuedOnly: false }; }
function loadJLFilters(): JLFilters {
  try {
    const raw = sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (!raw) return defaultJLFilters();
    const p = JSON.parse(raw);
    if (!p || !Array.isArray(p.bands)) return defaultJLFilters();
    return { bands: p.bands.filter((b: string) => BAND_KEYS.includes(b)), top5Only: !!p.top5Only, jdOnly: !!p.jdOnly, queuedOnly: !!p.queuedOnly };
  } catch { return defaultJLFilters(); }
}
function saveJLFilters(f: JLFilters): void { try { sessionStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(f)); } catch { /* best-effort */ } }

// JOBLIST-FILTER-001 / JD-MENU-QUEUED-TAB-001: nightly-queue (⏰) membership for
// a row — an explicit per-row toggle wins; default ON until the row has a
// generated artifact. This is the SINGLE source of truth shared by the ⏰ row
// toggle (nightlyOn) and the "⏰ Queued" legend filter, so the filter always
// matches exactly which rows show the lit ⏰.
function rowQueued(doc: TrackerDoc | null, uk: string): boolean {
  const q = doc?.queue?.[uk];
  return q === undefined ? !doc?.artifacts?.[uk]?.application_id : !!q;
}

// TOP5-REFILL-001: a dropped/closed/rejected row must LEAVE the Top-5 panel and
// the next-best live row (by rank) takes its place, so the panel always shows 5
// live candidates. "Closed" = the archive band, an archived/rejected/withdrawn
// tracked status, or a "Dropped (…)" flag written by dropFromTop5. Rank alone
// (the old `rank <= 5`) kept dropped rows pinned in the panel forever.
const isClosedRow = (r: Row): boolean =>
  String(r[12] || '').toUpperCase() === 'D9D9D9'
  || /rejected|archive|closed|withdrawn/i.test(String(r[8] || ''))
  || /^dropped\b/i.test(String(r[10] || ''));

// Extract plain text from an uploaded file. Plain-text reads directly; PDFs and
// images/scans go through the app's multi-tier extractor (window.AntcvExtractPDFText:
// PDF.js text → LLM document → vision OCR). Shared by add-JD-from-file and the
// per-row signal-material attach. Throws with a user-facing message on failure.
async function extractFileText(file: File, setStatus: (s: string) => void): Promise<string> {
  const name = (file.name || '').toLowerCase();
  if (/\.(txt|md|csv|json|text)$/.test(name) || (file.type || '').startsWith('text/')) {
    return (await file.text()).trim();
  }
  const extract = (window as unknown as { AntcvExtractPDFText?: (f: File) => Promise<{ text?: string; method?: string; warning?: string | null }> }).AntcvExtractPDFText;
  if (typeof extract !== 'function') throw new Error('The app\'s PDF/OCR extractor isn\'t loaded yet — reload the page, or use a .txt file.');
  setStatus('Extracting text (PDF.js → LLM → OCR)…');
  const r = await extract(file);
  if (r && r.warning) console.info('[JobTracker] extract:', r.method, r.warning);
  return String((r && r.text) || '').trim();
}

// SIGNAL-MATERIALS-001: the EFFECTIVE signals for a row = the typed Signals text
// + the extracted text of every attached signal material. This composed block is
// what every consumer sees: the ADDITIONAL SIGNALS block in supporting_context
// (→ the upload panel's additional info + the in-app JD analysis), the Top-5
// fit % / card / Ask-AI, and (server-side, same shape) the nightly gen-runner.
function signalsBlockOf(d: TrackerDoc | null, uk: string): string {
  const parts: string[] = [];
  const manual = ((d?.signals || {})[uk] || '').trim();
  if (manual) parts.push(manual);
  for (const f of (d?.sigfiles || {})[uk] || []) {
    if (f && f.text) parts.push('--- attached signal material: ' + (f.name || 'file') + ' ---\n' + f.text);
  }
  return parts.join('\n');
}

// SAVE-409-MERGE-001: rebase this session's edits onto a newer server doc after
// a rev conflict. Server doc is the base (rows/keys added elsewhere survive —
// e.g. discovery rows, app-written rationale/scores); local wins per row-key
// where this session has data. Deliberate last-writer-wins on shared keys: the
// pre-existing behaviour on conflict was to DROP every local edit, so any
// overlap here is strictly less lossy.
function mergeDocs(server: TrackerDoc, local: TrackerDoc): TrackerDoc {
  const out: TrackerDoc = { ...server };
  const MAPS = ['urls', 'jd', 'gen', 'queue', 'brandfit', 'brand', 'signals', 'sigfiles', 'support', 'webintel', 'scores', 'artifacts', 'discovered', 'pin', 'park'];
  for (const k of MAPS) {
    const sv = (server as Record<string, unknown>)[k] as Record<string, unknown> | undefined;
    const lv = (local as Record<string, unknown>)[k] as Record<string, unknown> | undefined;
    if (lv && typeof lv === 'object') (out as Record<string, unknown>)[k] = { ...(sv || {}), ...lv };
  }
  const lmap = new Map((local.rows || []).map((r) => [r[11], r]));
  const skeys = new Set((server.rows || []).map((r) => r[11]));
  out.rows = (server.rows || []).map((r) => lmap.get(r[11]) || r);
  for (const r of local.rows || []) if (!skeys.has(r[11])) out.rows.push(r);
  if (local.envelope) out.envelope = local.envelope;
  return out;
}

// RESEARCH-MERGE-001: JD-sourced ROLE INTEL + web-sourced COMPANY RESEARCH go
// to generation as ONE coherent research block. The JD intel leads (it is the
// authoritative source for what the role needs); the web brief follows with any
// line that merely restates a JD-intel fact removed (verbatim containment or
// ≥80% token overlap), so the generator reads one non-duplicating structure
// instead of two blocks repeating each other. The inner labels stay ("ROLE
// INTEL (from the JD)" / "COMPANY RESEARCH (from the web)") — prompts and the
// nightly runner know them. Input isolation holds: this block lives in
// supporting_context only, NEVER merged into the JD block.
function mergeResearchBlock(roleIntel: string, webBrief: string): string {
  const intel = (roleIntel || '').trim();
  let web = (webBrief || '').trim();
  if (!intel && !web) return '';
  if (intel && web) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-zà-ú0-9]+/gi, ' ').replace(/\s+/g, ' ').trim();
    const intelNorm = ' ' + norm(intel) + ' ';
    const intelWords = new Set(norm(intel).split(' ').filter((w) => w.length > 3));
    web = web.split('\n').filter((raw) => {
      const n = norm(raw.replace(/^[-•▸*]\s*/, '').replace(/^(HOLISTIC|SPECIFIC):?\s*/i, ''));
      if (!n || n.length < 24) return true;                 // keep labels + short lines
      if (intelNorm.includes(' ' + n + ' ')) return false;  // verbatim repeat of JD intel
      const ws = n.split(' ').filter((w) => w.length > 3);
      return !(ws.length >= 6 && ws.filter((w) => intelWords.has(w)).length / ws.length >= 0.8); // near-repeat
    }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!web.replace(/^\s*(HOLISTIC|SPECIFIC):?\s*$/gim, '').trim()) web = ''; // dedup left only scaffolding
  }
  let out = '\n\nROLE AND COMPANY RESEARCH (one merged, non-duplicating brief — for tailoring the cover-letter WHY and the CV emphasis; EMPLOYER context, NOT candidate facts; each fact appears once; verify before asserting anything specific):';
  if (intel) out += '\nROLE INTEL (from the JD):\n' + intel;
  if (web) out += '\nCOMPANY RESEARCH (from the web):\n' + web;
  return out;
}

export function JobTracker({ onClose }: { onClose: () => void }): JSX.Element {
  const [doc, setDocState] = useState<TrackerDoc | null>(null);
  const [rev, setRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'top5'>('list');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [cluster, setCluster] = useState<{ qual: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  // JOBLIST-FILTER-001: legend-driven filter state. Read sessionStorage exactly
  // once (on first render) via a ref, then keep it in React state; every
  // change re-writes sessionStorage so it survives this session but resets on
  // the next app start (see loadJLFilters/saveJLFilters above).
  const initJLFilters = useRef<JLFilters | null>(null);
  if (initJLFilters.current === null) initJLFilters.current = loadJLFilters();
  const [filterBands, setFilterBands] = useState<Set<string>>(() => new Set(initJLFilters.current!.bands));
  const [filterTop5, setFilterTop5] = useState<boolean>(() => initJLFilters.current!.top5Only);
  const [filterJd, setFilterJd] = useState<boolean>(() => initJLFilters.current!.jdOnly);
  const [filterQueued, setFilterQueued] = useState<boolean>(() => initJLFilters.current!.queuedOnly);
  useEffect(() => { saveJLFilters({ bands: Array.from(filterBands), top5Only: filterTop5, jdOnly: filterJd, queuedOnly: filterQueued }); }, [filterBands, filterTop5, filterJd, filterQueued]);
  function toggleBandFilter(b: string): void { setFilterBands((s) => { const n = new Set(s); if (n.has(b)) n.delete(b); else n.add(b); return n; }); }

  // Narrow viewports get a stacked card list — a wide fixed table pushes the
  // Next-action / Flag columns off-screen in portrait (only reachable in
  // landscape). MOB rules: single-column cards.
  useEffect(() => {
    // Use innerWidth (layout viewport) directly + a resize listener — more
    // reliable across mobile browsers than matchMedia alone. ≤820 → cards.
    const on = () => setIsMobile((window.innerWidth || 9999) <= 820);
    on();
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    return () => { window.removeEventListener('resize', on); window.removeEventListener('orientationchange', on); };
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const s = await getDoc();
      setDocState(s.doc || { version: 2, rows: [], urls: {}, jd: {}, support: {}, artifacts: {} });
      setRev(s.rev); setDirty(false);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  // TOP5-PERIODIC-RESCORE-001 (JOBTRACKER-TOP5-PERIODIC-RESCORE-001, OPEN_REGISTER
  // row 77): the cluster demand snapshot is a ranking INPUT (rank.ts fitScore /
  // orderTop5), but it used to be fetched ONCE here and never refreshed — so the
  // Top-5 could not drift with the weekly cluster-demand refresh while the panel
  // stayed open. Re-fetch on a LOW-frequency schedule (hourly background check +
  // on window focus once >24h stale) and re-rank ONLY when the snapshot content
  // hash actually changes, so identical states never reshuffle the Top-5
  // (ranking-stability, OPEN_REGISTER row 76). No busy timers / per-minute polls.
  const clusterHashRef = useRef('');
  const clusterFetchedAtRef = useRef(0);
  useEffect(() => {
    let alive = true;
    const refresh = () => fetchClusterTop20().then((c) => {
      if (!alive) return;
      clusterFetchedAtRef.current = Date.now();
      const next = c.top20 || [];
      const { hash, changed } = reconcileSnapshot(clusterHashRef.current, next);
      if (!changed) return;            // demand unchanged -> no re-rank (stable Top-5)
      clusterHashRef.current = hash;
      setCluster(next);
    }).catch(() => { /* keep the last snapshot on any failure */ });
    void refresh();                                                    // on mount
    const iv = setInterval(() => { void refresh(); }, CLUSTER_REFRESH_MS);  // hourly
    const onFocus = () => { if (shouldRefetchOnFocus(clusterFetchedAtRef.current, Date.now())) void refresh(); };
    window.addEventListener('focus', onFocus);
    return () => { alive = false; clearInterval(iv); window.removeEventListener('focus', onFocus); };
  }, []);

  const rows = useMemo<Row[]>(() => {
    const r = (doc?.rows || []).slice();
    r.sort((a, b) => (Number(a[0]) || 99) - (Number(b[0]) || 99));
    return r;
  }, [doc]);
  // TOP5-FIT-RANK-001 (JOBTRACKER-AUTOFILL-TOP5-001): the 5 best LIVE rows by
  // DETERMINISTIC fit score — pins first, then highest fit; closed + parked rows
  // excluded. Re-evaluated on every doc change, so any add re-ranks against the
  // current Top-5 (a new lead that outscores #5 enters on the spot).
  const top5 = useMemo(() => (doc ? orderTop5(rows, doc, cluster, isClosedRow) : []), [rows, doc, cluster]);
  const top5Keys = useMemo(() => new Set(top5.map((r) => r[11])), [top5]);
  // JOBLIST-FILTER-001: rows shown in the List table, after the legend filter.
  // A row whose tier band isn't one of the 5 known swatches always shows —
  // there's no legend item to hide it by.
  const filteredRows = useMemo(() => rows.filter((r) => {
    const band = String(r[12] || '').toUpperCase();
    if (BAND_KEYS.includes(band) && !filterBands.has(band)) return false;
    const uk = r[11];
    if (filterTop5 && !top5Keys.has(uk)) return false;
    if (filterJd && !(((doc?.jd || {})[uk] || '').length > 200)) return false;
    if (filterQueued && !rowQueued(doc, uk)) return false;
    return true;
  }), [rows, filterBands, filterTop5, filterJd, filterQueued, top5Keys, doc]);

  function editRow(uk: string, idx: number, value: string): void {
    if (!doc) return;
    setDocState({ ...doc, rows: (doc.rows || []).map((r) => { if (r[11] !== uk) return r; const c = r.slice() as Row; c[idx] = value; return c; }) });
    setDirty(true);
  }
  // Generation tier: explicit choice wins; otherwise Top-5 default to High
  // quality (they're the priority applications), the rest to Quick.
  const genOf = (uk: string) => {
    const g = (doc?.gen || {})[uk]; if (g) return g;
    return top5Keys.has(uk) ? 'high' : 'quick'; // live Top-5 (TOP5-REFILL-001), not raw rank
  };
  function setGen(uk: string, q: string): void { if (!doc) return; setDocState({ ...doc, gen: { ...(doc.gen || {}), [uk]: q } }); setDirty(true); }
  const brandOf = (uk: string) => !!(doc?.brandfit || {})[uk];
  const brandColorsOf = (uk: string) => (doc?.brand || {})[uk];
  const [brandBusy, setBrandBusy] = useState<Set<string>>(new Set());
  // Toggling Brand on samples the employer's real brand colours from their site.
  async function toggleBrand(uk: string, row: Row): Promise<void> {
    if (!doc) return;
    const on = !brandOf(uk);
    setDocState({ ...doc, brandfit: { ...(doc.brandfit || {}), [uk]: on } }); setDirty(true);
    if (!on || brandColorsOf(uk)) return; // off, or colours already fetched
    setBrandBusy((s) => new Set(s).add(uk)); setErr(null); setNote('Fetching ' + row[1] + ' brand colours…');
    try {
      const c = await fetchBrandColors((doc.urls || {})[uk] || '', row[1]);
      if (c && (c.navy || c.accent)) {
        setDocState((d) => (d ? { ...d, brand: { ...(d.brand || {}), [uk]: c } } : d)); setDirty(true);
        setNote('Brand colours sampled for ' + row[1] + ' ✓');
      } else setNote('No brand colours found for ' + row[1] + ' — the CV keeps its palette; the brand-fit note still applies.');
    } catch (e) { setErr('Brand fetch failed: ' + String((e as Error).message || e)); }
    finally { setBrandBusy((s) => { const n = new Set(s); n.delete(uk); return n; }); }
  }
  function Swatches({ uk }: { uk: string }): JSX.Element | null {
    const c = brandColorsOf(uk); if (!c) return brandBusy.has(uk) ? <span style={{ fontSize: 10, color: '#889' }}>…</span> : null;
    return <span style={{ display: 'inline-flex', gap: 2, verticalAlign: 'middle', marginLeft: 3 }} title={c.source || 'sampled brand colours'}>
      {c.navy ? <span style={{ width: 11, height: 11, borderRadius: 2, background: c.navy, border: '1px solid #ccc', display: 'inline-block' }} /> : null}
      {c.accent ? <span style={{ width: 11, height: 11, borderRadius: 2, background: c.accent, border: '1px solid #ccc', display: 'inline-block' }} /> : null}
    </span>;
  }
  const signalsOf = (uk: string) => (doc?.signals || {})[uk] || '';
  function setSignals(uk: string, v: string): void { if (!doc) return; setDocState({ ...doc, signals: { ...(doc.signals || {}), [uk]: v } }); setDirty(true); }
  // SIGNAL-MATERIALS-001: per-row attached signal materials (📎 in the Signals
  // column). Only the EXTRACTED TEXT is stored (capped), never the file bytes —
  // the tracker doc is one shared JSON and every PUT re-writes it whole.
  const sigFilesOf = (uk: string) => (doc?.sigfiles || {})[uk] || [];
  const sigRef = useRef<HTMLInputElement>(null);
  const sigUkRef = useRef<string>('');
  const [sigBusy, setSigBusy] = useState<string | null>(null);
  async function attachSignalFile(uk: string, file: File): Promise<void> {
    setSigBusy(uk); setErr(null);
    try {
      let text = await extractFileText(file, setNote);
      // Keep the downstream ADDITIONAL SIGNALS block parseable: the app slices
      // it at a blank line + ALL-CAPS header, so collapse blank lines; cap size.
      text = text.replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim().slice(0, 6000);
      if (text.length < 40) { setErr('Could not extract enough text from ' + file.name + ' — try a clearer scan or a .txt.'); return; }
      const entry = { name: file.name || 'file', text, added: Date.now() };
      setDocState((d) => (d ? { ...d, sigfiles: { ...(d.sigfiles || {}), [uk]: [...((d.sigfiles || {})[uk] || []), entry] } } : d));
      setDirty(true);
      setNote('Attached "' + entry.name + '" (' + text.length + ' chars) as signal material — feeds Top-5, JD analysis and generation. Save to keep it.');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setSigBusy(null); if (sigRef.current) sigRef.current.value = ''; }
  }
  function removeSignalFile(uk: string, i: number): void {
    setDocState((d) => {
      if (!d) return d;
      const list = ((d.sigfiles || {})[uk] || []).filter((_, j) => j !== i);
      return { ...d, sigfiles: { ...(d.sigfiles || {}), [uk]: list } };
    });
    setDirty(true);
  }
  const hasArtifact = (uk: string) => !!doc?.artifacts?.[uk]?.application_id;
  // Nightly queue (⏰): on by default until the row has been generated; explicit
  // toggle wins. Delegates to module-level rowQueued so the ⏰ toggle and the
  // "⏰ Queued" legend filter share one definition (JD-MENU-QUEUED-TAB-001).
  const nightlyOn = (uk: string) => rowQueued(doc, uk);
  function toggleNightly(uk: string): void { if (!doc) return; setDocState({ ...doc, queue: { ...(doc.queue || {}), [uk]: !nightlyOn(uk) } }); setDirty(true); }
  // TOP5-FIT-RANK-001: Pin forces a row into the fit-ranked Top-5; Park removes it
  // from Top-5 candidacy but keeps it LIVE in the weekly list (not archived).
  const pinnedOf = (uk: string) => !!(doc?.pin || {})[uk];
  const parkedOf = (uk: string) => !!(doc?.park || {})[uk];
  function togglePin(uk: string): void {
    if (!doc) return;
    const on = !pinnedOf(uk);
    setDocState({ ...doc, pin: { ...(doc.pin || {}), [uk]: on }, ...(on ? { park: { ...(doc.park || {}), [uk]: false } } : {}) });
    setDirty(true);
  }
  function togglePark(uk: string): void {
    if (!doc) return;
    const on = !parkedOf(uk);
    setDocState({ ...doc, park: { ...(doc.park || {}), [uk]: on }, ...(on ? { pin: { ...(doc.pin || {}), [uk]: false } } : {}) });
    setDirty(true);
  }
  // JOBTRACKER-TOP5-CONTROLS-001: the rank-number cell is the primary pin/park
  // control. Clicking it toggles Top-5 membership — OUT → togglePin (the old ★
  // button's behaviour), IN → togglePark (the old ⏸ button's behaviour). Routes
  // through the EXISTING mutations by current membership; invents no new state.
  function toggleTop5Membership(uk: string): void {
    if (top5ClickAction(top5Keys.has(uk)) === 'pin') togglePin(uk); else togglePark(uk);
  }
  const [expandRow, setExpandRow] = useState<string | null>(null);
  // JOBTRACKER-TOP5-CONTROLS-001: right-click (desktop) or long-press (~500ms,
  // touch) on a row opens a small context menu at the pointer whose "Reject…"
  // entry runs the SAME reject-with-reason flow the removed ✕ button did. Pin/
  // Park are included for discoverability; the rank-number click stays primary.
  const [ctxMenu, setCtxMenu] = useState<{ uk: string; row: Row; x: number; y: number } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelLongPress = useCallback(() => {
    if (longPressRef.current != null) { clearTimeout(longPressRef.current); longPressRef.current = null; }
  }, []);
  function openCtxMenuAt(x: number, y: number, row: Row): void { setCtxMenu({ uk: row[11], row, x, y }); }
  function onRowContextMenu(e: React.MouseEvent, row: Row): void { e.preventDefault(); openCtxMenuAt(e.clientX, e.clientY, row); }
  function onRowTouchStart(e: React.TouchEvent, row: Row): void {
    const t = e.touches[0]; if (!t) return;
    const x = t.clientX, y = t.clientY;
    cancelLongPress();
    longPressRef.current = setTimeout(() => openCtxMenuAt(x, y, row), 500);
  }
  // Dismiss the context menu on any outside click, scroll, or Escape.
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setCtxMenu(null); } };
    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('click', close); window.removeEventListener('scroll', close, true); window.removeEventListener('keydown', onKey, true); };
  }, [ctxMenu]);
  // Single floating "Ask AI" assistant for the whole job list.
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQ, setChatQ] = useState('');
  const [chatA, setChatA] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  function trackerContext(): string {
    const rs = (doc?.rows || []).slice().sort((a, b) => (Number(a[0]) || 99) - (Number(b[0]) || 99));
    const lines = rs.map((r) => {
      const uk = r[11]; const fit = ((doc?.support || {})[uk] || '').split('\n').find((l) => l.startsWith('FIT:')) || '';
      const sig = signalsBlockOf(doc, uk).replace(/\n+/g, ' ');
      return `#${r[0]} ${r[1]} — ${r[2]} | ${r[3]} | ${tierOf(r[12]).label} | ${r[8]} | ${((doc?.jd || {})[uk] || '').length > 200 ? 'JD✓' : 'no JD'}${fit ? ' | ' + fit.slice(0, 90) : ''}${sig ? ' | SIGNALS: ' + sig.slice(0, 90) : ''}`;
    });
    const env = (doc?.envelope || []).map((e) => e[0] + ': ' + e[1]).join('; ');
    return 'DREAM ENVELOPE: ' + env + '\n\nJOB LIST (' + rs.length + ' roles):\n' + lines.join('\n');
  }
  async function askTracker(): Promise<void> {
    const q = chatQ.trim(); if (!q) return;
    setChatBusy(true); setChatA('');
    try {
      // Best-effort web research (Google CSE via the relay). Returns [] and is
      // skipped silently if the Custom Search API isn't enabled yet.
      let researchBlock = '';
      try {
        setChatA('Researching…');
        const items = await research(q, 4);
        if (items.length) researchBlock = '\n\nWEB RESEARCH (Google — may be dated; cite the links when you use them):\n'
          + items.map((it) => '- ' + it.title + ': ' + (it.snippet || '') + ' (' + it.link + ')').join('\n');
      } catch { /* */ }
      const sys = "You are the candidate's job-search assistant. Answer questions about their job tracker using the job list + Dream Envelope provided, plus any WEB RESEARCH given. Be concise, specific and actionable; when asked to rank/compare/prioritise, reason from the fit notes + envelope. You may draft short outreach/notes on request. Cite research links when you use them. Never invent roles or facts. Candidate = electro-optics / optical-systems engineer + hardware project manager, Copenhagen.";
      const out = await askAI('MY JOB TRACKER:\n' + trackerContext() + researchBlock + '\n\nQUESTION: ' + q, sys, 900);
      setChatA(out || '(no answer)');
    } catch (e) { setChatA('Ask AI failed: ' + String((e as Error).message || e)); }
    finally { setChatBusy(false); }
  }

  const persist = useCallback(async (next: TrackerDoc, quiet = false): Promise<boolean> => {
    const res = await putDoc(next, rev);
    if (res.ok) { setRev(res.rev || rev + 1); setDocState(next); setDirty(false); if (!quiet) setNote('Saved ✓'); return true; }
    if (res.conflict) {
      // SAVE-409-MERGE-001 (register row 79): the app bumps the doc rev behind
      // the island (auto JD-analysis persists rationale onto the row after
      // Open), so a plain 409 used to REPLACE local state with the server doc —
      // silently dropping typed-but-unsaved edits (e.g. signals entered right
      // before pressing Open). Rebase ONCE onto the server doc (server-added
      // rows/keys survive, this session's edits win) and re-PUT.
      if (res.serverDoc) {
        const rebased = mergeDocs(res.serverDoc, next);
        const res2 = await putDoc(rebased, res.serverRev ?? null);
        if (res2.ok) {
          setRev(res2.rev || (res.serverRev || rev) + 1); setDocState(rebased); setDirty(false);
          if (!quiet) setNote('Saved ✓ (merged a concurrent update)');
          return true;
        }
      }
      setErr('Changed elsewhere — reloaded latest, re-apply your edit.'); setDocState(res.serverDoc || next); setRev(res.serverRev || rev); setDirty(false); return false;
    }
    setErr(res.error || 'save failed'); return false;
  }, [rev]);

  async function save(): Promise<void> { if (!doc) return; setSaving(true); setErr(null); setNote(null); try { await persist(doc); } finally { setSaving(false); } }

  // Persist an edited support/intel blob for one role (used by the Top-5 card).
  const saveSupport = useCallback(async (uk: string, text: string): Promise<boolean> => {
    if (!doc) return false;
    return persist({ ...doc, support: { ...(doc.support || {}), [uk]: text } }, true);
  }, [doc, persist]);

  // Save an edited employer web-research brief (Top-5 card).
  const saveWeb = useCallback(async (uk: string, text: string): Promise<boolean> => {
    if (!doc) return false;
    return persist({ ...doc, webintel: { ...(doc.webintel || {}), [uk]: text } }, true);
  }, [doc, persist]);

  // Append a row from a JD (shared by URL + file paths). Returns the new row's uk
  // so the caller can run the async enrich pass (AUTOFILL-REFINE-001).
  function appendRow(company: string, role: string, jdText: string, url?: string, support?: string, web?: string): string {
    if (!doc) return '';
    const uk = slug(company + '-' + role) + '-' + String(Date.now()).slice(-4);
    const maxRank = Math.max(0, ...(doc.rows || []).map((r) => Number(r[0]) || 0));
    // AUTO-TIER-001: deterministic fit-tier on add (instant baseline; the async
    // refine may upgrade it). LEARN-FROM-PRIOR-001: inherit the generation tier of
    // the most similar prior row (same category) so a new add follows the list's
    // established conventions instead of a blank default.
    const band = computeTier(jdText, company, role, '', cluster);
    const cat = categoryFor(role, company);
    const prior = (doc.rows || []).find((r) => categoryFor(r[2], r[1]) === cat && (doc.gen || {})[r[11]]);
    const priorGen = prior ? (doc.gen || {})[prior[11]] : '';
    const row: Row = [maxRank + 1, company, role, '', '', '', '', 'OPEN', 'Identified (posting saved)', 'Review & tailor', 'Added', uk, band];
    const next: TrackerDoc = {
      ...doc, rows: [...(doc.rows || []), row],
      urls: url ? { ...(doc.urls || {}), [uk]: url } : (doc.urls || {}),
      jd: { ...(doc.jd || {}), [uk]: jdText },
      support: { ...(doc.support || {}), [uk]: support || ('ROLE: ' + company + ' — ' + role) },
      webintel: web ? { ...(doc.webintel || {}), [uk]: web } : (doc.webintel || {}),
      gen: priorGen ? { ...(doc.gen || {}), [uk]: priorGen } : (doc.gen || {}),
    };
    setDocState(next); setDirty(true);
    setNote('Added "' + (role || company) + '" — tier ' + (tierOf(band).label || '?') + '. Auto-filling…');
    return uk;
  }

  // AUTOFILL-REFINE-001: async enrichment after an add. Upgrades the tier with
  // semantic judgment, extracts location / salary / deadline / hiring-manager, sets
  // a tailored next-step, flags envelope conflicts, and samples brand colours.
  // Never blocks (the row already appeared); the deterministic baseline stands on
  // any failure; never fabricates (omits unknowns). Leaves the doc dirty to Save.
  async function enrichAdded(uk: string, company: string, role: string, jd: string, url?: string): Promise<void> {
    try {
      const c = await fetchBrandColors(url || '', company);
      if (c && (c.navy || c.accent)) setDocState((d) => (d ? { ...d, brand: { ...(d.brand || {}), [uk]: c }, brandfit: { ...(d.brandfit || {}), [uk]: true } } : d));
    } catch { /* brand is best-effort */ }
    try {
      const sys = 'You calibrate a job for a candidate (Gabriel: electro-optics / optical-systems engineer + hardware project manager, Copenhagen, EU/Polish citizen; targeting AI-workflow / technical-product / specialist roles; wants Greater Copenhagen, hybrid DK / Øresund-Skåne, or remote-EU, ~55-75k DKK/month). From the JD output EXACTLY these labelled lines and nothing else; use ONLY what the JD supports and write "?" when unknown — never guess:\n'
        + 'TIER: <T1|T2|T3> (T1 strong direct EO/photonics/optical-systems & reachable; T2 transferable product/PM/requirements/QC; T3 weak/off-domain or on-site abroad)\n'
        + 'LOCATION: <city, country + on-site/hybrid/remote, or ?>\n'
        // SALARY-ENVELOPE-CHECK-001 (owner 2026-07-19): pay is usually NOT stated, so
        // "else ?" left the salary-vs-Dream-Envelope check unable to run on most rows.
        // Fall back to a market ESTIMATE (the same read jd-analysis's salary_estimate
        // makes) so the conflict check always has a number to test — ALWAYS suffixed
        // " (est)" so an estimate is never presented as if the posting stated it.
        + 'SALARY: <the stated range if the JD states pay; if it does NOT state pay, your best realistic market ESTIMATE for this role + location + seniority, suffixed " (est)">\nDEADLINE: <if stated, else ?>\nMANAGER: <named hiring contact if stated, else ?>\n'
        + 'NEXTSTEP: <one short concrete next action for the candidate>\n'
        + 'CONFLICTS: <envelope conflicts — compare the SALARY line above (stated OR estimated) against the ~55-75k DKK/month envelope and flag when it falls below 55k; also on-site abroad, draining factors; or "none">';
      const out = await askAI('Company: ' + company + '\nRole: ' + role + '\n\nJOB DESCRIPTION:\n' + jd.slice(0, 4500), sys, 320);
      const get = (k: string) => (out.match(new RegExp('^' + k + ':\\s*(.+)$', 'im'))?.[1] || '').trim();
      const clean = (v: string) => (v && v !== '?' && !/^n\/?a$/i.test(v)) ? v : '';
      const tierTok = get('TIER').toUpperCase().match(/T[123]/)?.[0];
      const newBand = tierTok === 'T1' ? 'DDEBF7' : tierTok === 'T2' ? 'E2EFDA' : tierTok === 'T3' ? 'FCE4D6' : '';
      const loc = clean(get('LOCATION')); const nextStep = clean(get('NEXTSTEP'));
      const extra: string[] = [];
      const manager = clean(get('MANAGER')); if (manager) extra.push('Hiring contact: ' + manager);
      const deadline = clean(get('DEADLINE')); if (deadline) extra.push('Deadline: ' + deadline);
      // SALARY-ENVELOPE-CHECK-001: label an estimate honestly — never as "stated".
      const salary = clean(get('SALARY'));
      if (salary) {
        const isEst = /\(est\)/i.test(salary);
        extra.push((isEst ? 'Salary (est): ' : 'Salary (stated): ') + salary.replace(/\s*\(est\)\s*$/i, '').trim());
      }
      const conflicts = clean(get('CONFLICTS')); if (conflicts && !/^none$/i.test(conflicts)) extra.push('⚠ Envelope conflict: ' + conflicts);
      setDocState((d) => {
        if (!d) return d;
        const rows2 = (d.rows || []).map((r) => {
          if (r[11] !== uk) return r;
          const cc = r.slice() as Row;
          if (newBand) cc[12] = newBand;
          if (loc && !cc[3]) cc[3] = loc.slice(0, 60);
          if (nextStep) cc[9] = nextStep.slice(0, 120);
          return cc;
        });
        if (!extra.length) return { ...d, rows: rows2 };
        const prev = (d.signals || {})[uk] || '';
        return { ...d, rows: rows2, signals: { ...(d.signals || {}), [uk]: (prev ? prev + '\n' : '') + extra.join('\n') } };
      });
      setDirty(true);
    } catch { /* deterministic baseline stands */ }
  }

  // Unwrap redirect wrappers (LinkedIn safety/go, generic ?url=) to the real posting.
  function unwrapUrl(u: string): string {
    try {
      const m = u.match(/[?&](?:url|u|target|q)=([^&]+)/i);
      if (m && (/linkedin\.com\/safety\/go/i.test(u) || /\/(redirect|go|out|away)\b/i.test(u) || /google\.[a-z.]+\/url/i.test(u))) {
        let dec = decodeURIComponent(m[1]);
        if (/%[0-9A-Fa-f]{2}/.test(dec)) { try { dec = decodeURIComponent(dec); } catch { /* */ } }
        if (/^https?:\/\//i.test(dec)) return dec;
      }
    } catch { /* */ }
    return u;
  }

  // Auto-analyse a fetched JD into the compact intel block (needs / I bring / insight),
  // so a manually-added row arrives populated instead of empty.
  async function analyzeJd(jd: string, company: string, role: string): Promise<string> {
    const sys = 'You analyse a job description for a candidate and output a COMPACT intel block in EXACTLY this format, nothing else:\n'
      + 'ROLE: <company> — <role>\nFIT: <one line: how the candidate fits>\nFLAG/RISK: <one line: a gap, clearance, location or domain risk; or "none">\n'
      + '• SIGNALS & INSIGHTS\nNEED: <employer need>  |  I BRING: <candidate angle>  |  INSIGHT/Q: <an abnormal JD signal or a question>\n'
      + '(3 to 5 NEED lines, each < 160 chars). CANDIDATE = Gabriel: electro-optics / optical-systems engineer + hardware project manager (Sirin stray-light patent, Innoviz LiDAR beam-path, Meprolight sights), Copenhagen, EU (Polish) citizen, ~15 yrs.';
    try {
      const out = await askAI('Company: ' + company + '\nRole: ' + role + '\n\nJOB DESCRIPTION:\n' + jd.slice(0, 4500), sys, 700);
      return (out && out.includes('NEED:')) ? out.trim() : ('ROLE: ' + company + ' — ' + role);
    } catch { return 'ROLE: ' + company + ' — ' + role; }
  }

  // WEB-COMPANY-INTEL-001: distil a HOLISTIC + SPECIFIC employer brief from live
  // web research (Brave via the relay) so the NET-sourced company context reaches
  // generation, not just the JD-sourced ROLE INTEL. Best-effort: returns '' on any
  // failure and never blocks Open. Employer context only — never candidate facts.
  async function webCompanyBrief(company: string, role: string): Promise<string> {
    let items: { title: string; link: string; snippet: string }[] = [];
    try { items = await research(company + ' ' + role + ' company mission products strategy recent', 5); } catch { /* research() already degrades to [] */ }
    if (!items.length) return '';
    const src = items.map((it) => '- ' + it.title + ': ' + (it.snippet || '') + ' (' + it.link + ')').join('\n');
    // ASKAI-404-001 lesson: never let a failed DISTIL step throw away found
    // research — if the LLM hop fails, deliver the raw findings instead of ''.
    try {
      const sys = 'You research a target EMPLOYER from web excerpts for a job application. Output a COMPACT brief in EXACTLY this format, nothing else:\n'
        + 'HOLISTIC: <2-3 lines — what the company is/does, its market, direction/strategy, culture signals; only what the excerpts support>\n'
        + 'SPECIFIC:\n- <2-4 bullets of concrete, current needs/signals relevant to THIS role — products, tech, hiring drivers, recent moves>\n'
        + 'Use ONLY facts present in the excerpts; if they are thin, say so plainly. No candidate content. Never invent facts.';
      const out = await askAI('Company: ' + company + '\nRole: ' + role + '\n\nWEB EXCERPTS:\n' + src, sys, 500);
      if (out && /HOLISTIC|SPECIFIC/i.test(out)) return out.trim();
    } catch { /* fall through to raw findings */ }
    return 'HOLISTIC: (raw web findings — the AI distil step was unavailable; treat as leads and verify before use)\nSPECIFIC:\n' + src;
  }

  // Re-run employer web research for one row and cache it (Top-5 card ↻ button).
  async function researchRow(uk: string, company: string, role: string): Promise<string> {
    const web = await webCompanyBrief(company, role);
    if (web && doc) await persist({ ...doc, webintel: { ...(doc.webintel || {}), [uk]: web } }, true);
    return web;
  }

  async function addFromUrl(): Promise<void> {
    const raw = addUrl.trim(); if (!raw || !doc) return;
    const url = unwrapUrl(raw);
    setAdding(true); setErr(null); setNote('Fetching the JD…');
    try {
      const jd = await fetchJdUrl(url);
      if (!jd.ok || !(jd.text && jd.text.length > 200)) {
        setErr('Could not extract a JD from that link' + (jd.wall_hint ? ' (' + jd.wall_hint + ')' : '') + '. Use the DIRECT posting URL, or 📎 upload the JD.');
        return;
      }
      const title = (jd.title || '').replace(/\s*[|·—-]\s*(LinkedIn|Jobindex|Indeed|The Happy Recruiter).*$/i, '').trim();
      // LINKEDIN-CARD-EXTRACT-001: the proxy now returns the real employer (jd.company) for
      // LinkedIn postings (whose guest fragment has no <title>), and jd.title is the clean role —
      // so the Company/Role prompts pre-fill again. Fall back to the old title-split guess otherwise.
      const company = window.prompt('Company?', (jd.company || title.split(/ at | hos | - | \| /i).pop()?.trim() || '')) || '';
      const role = window.prompt('Role / title?', title) || '';
      if (!company && !role) return;
      setNote('Analysing the JD & extracting signals…');
      const support = await analyzeJd(jd.text, company, role);
      setNote('Researching the employer on the web…');
      const web = await webCompanyBrief(company, role);
      const uk = appendRow(company, role, jd.text, url, support, web);
      setAddUrl('');
      if (uk) { setNote('Auto-filling tier, brand & details…'); await enrichAdded(uk, company, role, jd.text, url); setNote('Added "' + (role || company) + '" with tier, brand & details. Review & Save.'); }
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setAdding(false); }
  }

  // Extract text from an uploaded JD file. Plain-text is read directly; PDFs
  // and images/scans go through the app's own multi-tier extractor
  // (window.AntcvExtractPDFText: PDF.js text → LLM document → vision OCR).
  async function addFromFile(file: File): Promise<void> {
    setAdding(true); setErr(null); setNote(null);
    try {
      const text = await extractFileText(file, setNote);
      if (text.length < 100) { setErr('Could not extract enough text from that file. Try a clearer scan, the regular uploader, or paste the text.'); return; }
      const company = window.prompt('Company?') || '';
      const role = window.prompt('Role / title?', file.name.replace(/\.[a-z0-9]+$/i, '')) || '';
      if (!company && !role) return;
      setNote('Analysing the JD & researching the employer…');
      const support = await analyzeJd(text, company, role);
      const web = await webCompanyBrief(company, role);
      const uk = appendRow(company, role, text, undefined, support, web);
      if (uk) { setNote('Auto-filling tier, brand & details…'); await enrichAdded(uk, company, role, text, undefined); }
      setNote('Extracted ' + text.length + ' chars from ' + file.name + '. Review & Save.');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setAdding(false); if (fileRef.current) fileRef.current.value = ''; }
  }

  // Seed the JD into a saved AntCV application and open it in the editor. NOTE:
  // this does NOT auto-generate — it hands off to the app with the JD loaded, and
  // you press Generate there. (One-tap / batch generation is the nightly runner.)
  async function prepareAndOpen(row: Row): Promise<void> {
    if (!doc) return;
    const uk = row[11]; const label = row[2] || row[1]; const already = hasArtifact(uk);
    if (!window.confirm((already ? 'Reopen' : 'Open') + ' "' + label + '" in AntCV?\n\nThe app reloads with this job loaded' + (already ? ' — including any CV/CL you already generated.' : ', ready for you to press Generate. (It does not generate here.)'))) return;
    setBusyKey(uk); setErr(null); setNote(null);
    try {
      let d = doc; let jd = (d.jd || {})[uk] || '';
      if ((!jd || jd.length < 200) && d.urls?.[uk]) {
        setNote('Fetching JD…');
        const f = await fetchJdUrl(d.urls[uk]);
        if (f.ok && f.text && f.text.length > 200) { jd = f.text; d = { ...d, jd: { ...(d.jd || {}), [uk]: jd } }; }
      }
      if (!jd || jd.length < 200) { setErr('No JD text for this role — add the DIRECT posting URL or a JD file first.'); return; }
      // WEB-COMPANY-INTEL-001: pull (and cache) net-sourced employer research so
      // generation gets holistic + specific company context, not only the JD.
      let webBrief = (d.webintel || {})[uk] || '';
      if (!webBrief && String(row[1] || '').trim()) {
        setNote('Researching the employer on the web…');
        webBrief = await webCompanyBrief(String(row[1]), String(row[2] || ''));
        if (webBrief) d = { ...d, webintel: { ...(d.webintel || {}), [uk]: webBrief } };
      }
      const envText = (d.envelope || []).map((e) => e[0] + ': ' + e[1] + (e[2] ? ' — ' + e[2] : '')).join('\n');
      // SIGNAL-MATERIALS-001: typed signals + attached-material text, composed.
      const ownerSig = signalsBlockOf(d, uk);
      // TARGET-FACTS-001: a this-ROLE calibration snapshot — the per-row facts the
      // (general) Dream Envelope doesn't carry: priority tier, fit angle, this
      // role's location/mobility, and its risk flag, plus the comp/seniority
      // altitude. Framed as calibration-ONLY so the generator sets tone/altitude
      // without copying any of it verbatim (no salary or tier leaks into the CV/CL).
      // Lives in supporting_context (the PRIOR-RUN block) — never in the JD.
      const envDim = (name: string) => { const e = (d.envelope || []).find((x) => String(x[0] || '').toLowerCase().startsWith(name)); return e ? String(e[1] || '').trim() : ''; };
      const tierName = (d.gen || {})[uk] === 'high' ? 'HIGH-priority (flagship quality)' : (d.gen || {})[uk] === 'quick' ? 'quick draft' : (String(row[5] || '').trim() ? 'tier ' + String(row[5]).trim() : '');
      const tf: string[] = [];
      const salaryT = envDim('salary'); if (salaryT) tf.push('Compensation altitude: ' + salaryT + ' — pitch the seniority this implies; do not undersell.');
      const titleT = envDim('title'); if (titleT) tf.push('Target title band: ' + titleT + '.');
      if (tierName) tf.push('Priority for this application: ' + tierName + '.');
      const locBits = [String(row[3] || '').trim(), String(row[4] || '').trim() ? 'commute ' + String(row[4]).trim() : ''].filter(Boolean).join(', ');
      if (locBits) tf.push('Location / mobility: ' + locBits + '. If this needs relocation or weekly fly-in, the candidate is open to it per the envelope — acknowledge fit naturally, never over-explain.');
      if (String(row[6] || '').trim()) tf.push('Fit angle for this role: ' + String(row[6]).trim());
      if (String(row[10] || '').trim()) tf.push('Watch / risk to handle: ' + String(row[10]).trim());
      const targetFacts = tf.length ? '\n\nTARGET FACTS (calibration only — use to set altitude, emphasis and tone; NEVER copy verbatim into the CV or cover letter, and never state the salary figure or the tier):\n• ' + tf.join('\n• ') : '';
      const supporting = 'TARGET-ROLE GUIDELINES (Dream Envelope):\n' + envText
        + targetFacts
        // RESEARCH-MERGE-001: one merged, deduped research block (JD role intel
        // + web company research) instead of two blocks restating each other.
        + mergeResearchBlock((d.support || {})[uk] || '', webBrief)
        + (ownerSig ? '\n\nADDITIONAL SIGNALS (owner-added):\n' + ownerSig : '')
        + ((d.brandfit || {})[uk] ? '\n\nBRAND-FIT: style the CV and cover letter to the employer\'s brand identity'
            + ((d.brand || {})[uk] && ((d.brand || {})[uk].navy || (d.brand || {})[uk].accent)
                ? ' — primary ' + ((d.brand || {})[uk].navy || '(none)') + ', accent ' + ((d.brand || {})[uk].accent || '(none)') + ' (sampled from the company site).'
                : '.') : '');
      // BRAND-FIT-OPEN-001: when the row is brand-fitted, turn the sampled
      // employer colours into a styleConfig patch (identical mapping to the
      // app's post-generation COMPANY-BRAND-FIT-SCOPE-001) so Open APPLIES the
      // palette (header/sidebar band + accents), not just describes it in text.
      const brandSc: Record<string, string> | undefined = (() => {
        if (!(d.brandfit || {})[uk]) return undefined;
        const bc = (d.brand || {})[uk]; if (!bc) return undefined;
        const hex = (v?: string) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v.trim()) ? v.trim() : null);
        const dark = (h: string) => { const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), bl = parseInt(h.slice(5, 7), 16); return (0.299 * r + 0.587 * g + 0.114 * bl) / 255 < 0.62; };
        const navy = hex(bc.navy), accent = hex(bc.accent); const sc: Record<string, string> = {};
        if (navy && dark(navy)) { sc.headerBg = navy; sc.sidebarBg = navy; }
        if (accent) { sc.photoBorderColor = accent; sc.sidebarLineColor = accent; sc.sidebarHeadColor = accent; }
        return Object.keys(sc).length ? sc : undefined;
      })();
      const id = await createApplication({ jd_text: jd, jd_company: row[1], jd_role: row[2], category: categoryFor(row[2], row[1]), supporting_context: supporting, style_config: brandSc });
      if (!id) { setErr('Could not create the application.'); return; }
      const next: TrackerDoc = { ...d, artifacts: { ...(d.artifacts || {}), [uk]: { application_id: id, generated_at: Date.now() } } };
      await setActive(id);
      // LOAD-EDITOR-UNSOLICITED-001 (complete fix): claim this app-id for THIS tab BEFORE the
      // reload AND before the namespaced lastJdText write, so (a) the cold-restore per-tab drift
      // guard restores the saved cv/cl sections instead of the unsolicited template, and (b) the
      // JD is staged under this app's own namespace. Kill: antcv:disable-tracker-open-adopt.
      claimTabAppId(id);
      try { localStorage.setItem('antcv:lastJdText', jd); } catch { /* */ }
      if (!(await persist(next, true))) return;
      onClose();
      setTimeout(() => { try { location.reload(); } catch { /* */ } }, 80);
    } catch (e) { setErr('Could not open in AntCV: ' + String((e as Error).message || e)); }
    finally { setBusyKey(null); }
  }

  // Reopen = re-seed (upsert): corrects a stale category on older seeds and
  // PRESERVES any generated cv/cl sections (the relay upsert never overwrites
  // them), then reloads so the app restores the JD + sections. Fixes the
  // "opens to the upload menu with nothing" bug.
  async function openSaved(row: Row): Promise<void> { return prepareAndOpen(row); }

  // REJECT (was dropFromTop5): archive the row WITH a reason → classify to a Dream-
  // Envelope dimension (envelope learning) AND record it in the discovery ledger so
  // the bi-weekly discovery task never re-proposes it. Distinct from Park, which
  // keeps the row live. (Ledger key mirrors discover-positions.py: normalized URL
  // when present, else normalized company|role — so the reject actually blocks.)
  async function rejectRow(row: Row): Promise<void> {
    if (!doc) return;
    const reason = window.prompt('Reject ' + row[1] + ' — why?\n(Recorded, teaches your envelope, and stops the discovery task re-proposing it. To just take it out of Top-5, use Park instead.)');
    if (!reason || !reason.trim()) return;
    const uk = row[11]; setBusyKey(uk); setErr(null); setNote(null);
    try {
      const dim = classifyReason(reason);
      const env = (doc.envelope || []).map((e) => { if (e[0] !== dim) return e; const c = e.slice(); c[3] = String(c[3] || '') + '  •  [' + today() + '] rejected ' + row[1] + ': ' + reason.trim(); return c; });
      const rowsNext = (doc.rows || []).map((r) => { if (r[11] !== uk) return r; const c = r.slice() as Row; c[8] = 'Archive / closed'; c[10] = 'Rejected (' + dim + '): ' + reason.trim(); c[12] = 'D9D9D9'; return c; });
      const url = (doc.urls || {})[uk] || '';
      const key = url
        ? url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split(/[?#]/)[0].replace(/\/+$/, '')
        : (String(row[1]) + '|' + String(row[2])).toLowerCase().replace(/[^a-z0-9|]+/g, '');
      const discovered = { ...(doc.discovered || {}), [key]: { ...((doc.discovered || {})[key] || {}), status: 'rejected', reason: reason.trim(), uk, company: row[1], role: row[2], url } };
      const next = { ...doc, envelope: env, rows: rowsNext, discovered, pin: { ...(doc.pin || {}), [uk]: false }, park: { ...(doc.park || {}), [uk]: false } };
      if (await persist(next, true)) setNote('Rejected ' + row[1] + ' → envelope learning (' + dim + '); discovery won\'t re-propose it.');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusyKey(null); }
  }

  const cell: React.CSSProperties = { padding: '5px 7px', borderBottom: '1px solid #dbe2ee', fontSize: 12, verticalAlign: 'top' };
  const th: React.CSSProperties = { ...cell, background: NAVY, color: '#fff', position: 'sticky', top: 0, fontWeight: 600, textAlign: 'left' };
  const jdCount = Object.values(doc?.jd || {}).filter((t) => (t || '').length > 200).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,22,40,0.55)', zIndex: 99999, display: 'flex' }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !ctxMenu) onClose(); }}>
      <div style={{ position: 'relative', background: '#fff', margin: '2vh auto', width: 'min(1180px, 97vw)', height: '96vh', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        <style>{'.jt-ranktoggle{transition:background .12s}.jt-ranktoggle:hover{background:rgba(46,93,168,0.14)!important;box-shadow:inset 0 0 0 1px rgba(46,93,168,0.28)}.jt-ctxitem{display:block;width:100%;text-align:left;background:transparent;border:none;cursor:pointer;padding:7px 12px;border-radius:5px;font-size:13px;white-space:nowrap}.jt-ctxitem:hover{background:#eef1f6}'}</style>
        <div style={{ background: NAVY, color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 15 }}>📋 Job Tracker</strong>
          <span style={{ opacity: 0.8, fontSize: 12 }}>rev {rev}{dirty ? ' · unsaved' : ''}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => setView('list')} style={btn(view === 'list' ? '#ffffff33' : 'transparent')}>List</button>
          <button onClick={() => setView('top5')} style={btn(view === 'top5' ? '#ffffff33' : 'transparent')}>★ Top 5</button>
          <span style={{ width: 8 }} />
          <button onClick={() => void load()} disabled={saving} style={btn('#ffffff22')}>Reload</button>
          <button onClick={() => void save()} disabled={!dirty || saving} style={btn(dirty ? '#2e7d32' : '#ffffff22')}>{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} style={btn('#ffffff22')}>Close ✕</button>
        </div>

        {view === 'list' && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #e3e8f0', display: 'flex', gap: 8, alignItems: 'center', background: '#f6f8fc' }}>
            <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="Paste a job URL to add it (fetches the JD into the list)"
              style={{ flex: 1, padding: '7px 10px', border: '1px solid #c3ccdb', borderRadius: 6, fontSize: 13 }} onKeyDown={(e) => { if (e.key === 'Enter') void addFromUrl(); }} />
            <button onClick={() => void addFromUrl()} disabled={adding || !addUrl.trim()} style={btn(NAVY)}>{adding ? 'Fetching…' : 'Add JD'}</button>
            <input ref={fileRef} type="file" accept=".txt,.md,.json,.text,.csv,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void addFromFile(f); }} />
            <button onClick={() => fileRef.current?.click()} disabled={adding} title="Upload a JD file — PDF, text, or image/scan (OCR)"
              style={{ ...btn('#eef1f6', NAVY), border: '1px solid #c3ccdb', fontSize: 15, padding: '5px 10px' }}>📎</button>
            {/* SIGNAL-MATERIALS-001: shared picker for the per-row Signals 📎 (sigUkRef holds the target row) */}
            <input ref={sigRef} type="file" accept=".txt,.md,.json,.text,.csv,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f && sigUkRef.current) void attachSignalFile(sigUkRef.current, f); }} />
          </div>
        )}

        <Legend bands={filterBands} onToggleBand={toggleBandFilter} top5Only={filterTop5} onToggleTop5={() => setFilterTop5((v) => !v)} jdOnly={filterJd} onToggleJd={() => setFilterJd((v) => !v)} queuedOnly={filterQueued} onToggleQueued={() => setFilterQueued((v) => !v)} />

        {(err || note) && <div style={{ padding: '6px 16px', fontSize: 12, color: err ? '#b3261e' : '#2e7d32', background: err ? '#fdecea' : '#eaf5ea' }}>{err || note}</div>}

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? <div style={{ padding: 24 }}>Loading…</div> : view === 'list' ? (
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 46 }} /><col style={{ width: 58 }} /><col style={{ width: 150 }} /><col style={{ width: 210 }} />
                <col style={{ width: 120 }} /><col style={{ width: 34 }} /><col style={{ width: 130 }} /><col style={{ width: 175 }} /><col style={{ width: 175 }} /><col style={{ width: 160 }} /><col style={{ width: 140 }} />
              </colgroup>
              <thead><tr>{['#', 'Tier', 'Company', 'Role', 'Location', 'JD', 'Tracked', 'Next action', 'Flag / notes', 'Signals', 'Generate'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {filteredRows.map((r) => {
                  const uk = r[11]; const t = tierOf(r[12]); const hasJd = ((doc?.jd || {})[uk] || '').length > 200; const star = top5Keys.has(uk);
                  return (
                    <tr key={uk} style={{ background: t.tint }}
                      onContextMenu={(e) => onRowContextMenu(e, r)}
                      onTouchStart={(e) => onRowTouchStart(e, r)} onTouchEnd={cancelLongPress} onTouchMove={cancelLongPress} onTouchCancel={cancelLongPress}>
                      <td className="jt-ranktoggle" onClick={() => toggleTop5Membership(uk)}
                        title={star ? 'In Top-5 — click to park out (stays in the list). Right-click / long-press to reject.' : 'Click to pin into Top-5. Right-click / long-press to reject.'}
                        style={{ ...cell, textAlign: 'center', fontWeight: 700, borderLeft: '4px solid ' + t.accent, cursor: 'pointer', userSelect: 'none' }}>{star ? '★' : ''}{r[0]}</td>
                      <td style={{ ...cell }}><span style={{ background: t.accent, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{t.label}</span></td>
                      <td style={{ ...cell, fontWeight: 600 }}>{r[1]}</td>
                      <td style={cell}>{r[2]}</td>
                      <td style={cell}>{r[3]}</td>
                      <td style={{ ...cell, textAlign: 'center', fontSize: 14 }} title={hasJd ? 'JD stored' : 'No JD — add a direct posting URL / file'}>{hasJd ? '✅' : '—'}</td>
                      <td style={cell}><select value={r[8]} onChange={(e) => editRow(uk, 8, e.target.value)} style={{ fontSize: 12, width: '100%' }}>{TRACKED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}{!TRACKED_STATUSES.includes(r[8]) && r[8] ? <option value={r[8]}>{r[8]}</option> : null}</select></td>
                      <td style={cell}><textarea value={r[9]} onChange={(e) => editRow(uk, 9, e.target.value)} onFocus={() => setExpandRow(uk)} rows={expandRow === uk ? 5 : 2} style={ta} /></td>
                      <td style={cell}><textarea value={r[10]} onChange={(e) => editRow(uk, 10, e.target.value)} onFocus={() => setExpandRow(uk)} rows={expandRow === uk ? 5 : 2} style={ta} /></td>
                      <td style={cell}>
                        <textarea value={signalsOf(uk)} onChange={(e) => setSignals(uk, e.target.value)} onFocus={() => setExpandRow(uk)} rows={expandRow === uk ? 5 : 2} placeholder="extra signals for generation…" style={ta} />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', marginTop: 2 }}>
                          {sigFilesOf(uk).map((f, i) => (
                            <span key={i} title={(f.text || '').slice(0, 500)} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: '#eef1f6', border: '1px solid #cfd8e6', borderRadius: 4, padding: '1px 5px', fontSize: 10.5, color: '#334', maxWidth: '100%' }}>
                              📄 <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 86 }}>{f.name}</span>
                              <button onClick={() => removeSignalFile(uk, i)} aria-label={'Remove ' + f.name} title="Remove this signal material"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 10.5, color: '#96a', lineHeight: 1 }}>✕</button>
                            </span>
                          ))}
                          <button onClick={() => { sigUkRef.current = uk; sigRef.current?.click(); }} disabled={sigBusy === uk}
                            title="Attach signal material — PDF, text or image/scan; the extracted text feeds Top-5, JD analysis and generation"
                            style={{ background: 'transparent', border: '1px dashed #b7c2d4', borderRadius: 4, cursor: 'pointer', fontSize: 12, padding: '0 5px', lineHeight: '17px', color: '#556' }}>{sigBusy === uk ? '…' : '📎'}</button>
                        </div>
                      </td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <button onClick={() => setGen(uk, genOf(uk) === 'high' ? 'quick' : 'high')} title="Generation quality — tap to switch"
                          style={{ background: genOf(uk) === 'high' ? '#fff3cf' : '#eef1f6', color: genOf(uk) === 'high' ? '#8a6d00' : '#556', border: '1px solid #cfd8e6', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '2px 4px', display: 'block', width: '100%', marginBottom: 3 }}>{genOf(uk) === 'high' ? '★ High' : '⚡ Quick'}</button>
                        <button onClick={() => (hasArtifact(uk) ? void openSaved(r) : void prepareAndOpen(r))} disabled={busyKey === uk}
                          title={hasArtifact(uk) ? 'Reopen in AntCV' : 'Open in AntCV — loads the JD, then press Generate there'}
                          style={{ ...btn(hasArtifact(uk) ? '#2e7d32' : '#2E5DA8'), padding: '3px 4px', fontSize: 11, display: 'block', width: '100%', marginBottom: 3 }}>{busyKey === uk ? '…' : (hasArtifact(uk) ? '↗ Open' : '✨ Open')}</button>
                        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', alignItems: 'center' }}>
                          <button onClick={() => toggleNightly(uk)} title={nightlyOn(uk) ? "In tonight's queue — tap to remove" : 'Queue for tonight'}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, opacity: nightlyOn(uk) ? 1 : 0.28, padding: 0 }}>⏰</button>
                          <label title="Brand-fit: sample the employer's colours & style the CV/CL to them" style={{ display: 'inline-flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}>
                            <input type="checkbox" checked={brandOf(uk)} onChange={() => void toggleBrand(uk, r)} style={{ width: 14, height: 14 }} /><span style={{ fontSize: 13 }}>🎨</span><Swatches uk={uk} />
                          </label>
                          {doc?.urls?.[uk] ? <a href={doc.urls[uk]} target="_blank" rel="noreferrer" title="Open posting" style={{ color: t.accent, fontWeight: 700, fontSize: 14 }}>↗</a> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredRows.length === 0 && (
                  <tr><td style={cell} colSpan={11}>{rows.length === 0 ? 'No rows yet — paste a job URL or upload a JD file above.' : 'No rows match the current legend filter — check more boxes above.'}</td></tr>
                )}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 14, display: 'grid', gap: 14 }}>
              {top5.map((r) => <FocusCard key={r[11]} row={r} doc={doc} cluster={cluster} mobile={isMobile} busy={busyKey === r[11]}
                onPrepare={() => void prepareAndOpen(r)} onOpen={() => void openSaved(r)}
                pinned={pinnedOf(r[11])} onTogglePin={() => togglePin(r[11])} onPark={() => togglePark(r[11])} onReject={() => void rejectRow(r)}
                onSaveSupport={saveSupport} onSaveWeb={saveWeb} onResearch={researchRow} />)}
              {top5.length === 0 && <div>No Top-5 roles yet.</div>}
            </div>
          )}
        </div>
        <div style={{ padding: '6px 16px', fontSize: 11, color: '#667', borderTop: '1px solid #e3e8f0' }}>
          {filteredRows.length}{filteredRows.length !== rows.length ? ' of ' + rows.length : ''} roles shown · {jdCount} with JD · ★ = Top 5 · edits sync to your Excel.
        </div>

        {/* JOBTRACKER-TOP5-CONTROLS-001: row context menu (right-click / long-press) */}
        {ctxMenu && (() => {
          const left = Math.max(6, Math.min(ctxMenu.x, (window.innerWidth || 1200) - 210));
          const top = Math.max(6, Math.min(ctxMenu.y, (window.innerHeight || 800) - 150));
          return (
            <div role="menu" onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}
              style={{ position: 'fixed', left, top, zIndex: 100000, background: '#fff', border: '1px solid #c3ccdb', borderRadius: 8, boxShadow: '0 8px 28px rgba(0,0,0,0.28)', padding: 4, minWidth: 190 }}>
              <div style={{ padding: '5px 12px 6px', fontSize: 11, fontWeight: 700, color: '#889', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210 }}>{ctxMenu.row[1] || 'Row'}</div>
              <button className="jt-ctxitem" style={{ color: '#7a2618' }} onClick={() => { const r = ctxMenu.row; setCtxMenu(null); void rejectRow(r); }}>
                ✕ Reject…
              </button>
            </div>
          );
        })()}

        {/* single floating Ask-AI assistant for the whole list */}
        {chatOpen && (
          <div style={{ position: 'absolute', right: 16, bottom: 66, width: 'min(430px, 90%)', maxHeight: '62%', background: '#fff', border: '1px solid #01b7bb', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', overflow: 'hidden', zIndex: 6 }}>
            <div style={{ background: '#01b7bb', color: '#06243a', padding: '8px 12px', fontWeight: 800, fontSize: 13, display: 'flex', alignItems: 'center' }}>🤖 Ask AI about your job list<span style={{ flex: 1 }} /><button onClick={() => setChatOpen(false)} aria-label="Close" style={{ background: 'none', border: 0, cursor: 'pointer', fontWeight: 800, color: '#06243a', fontSize: 15 }}>✕</button></div>
            {chatA && <div style={{ padding: '10px 12px', overflow: 'auto', fontSize: 13, whiteSpace: 'pre-wrap', lineHeight: 1.45, color: '#1a2233' }}>{chatA}</div>}
            <div style={{ padding: 10, borderTop: '1px solid #e3e8f0', display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              <textarea value={chatQ} onChange={(e) => setChatQ(e.target.value)} rows={2} placeholder="e.g. which 3 roles best fit my envelope? · draft an outreach note for KK Group · what am I missing?"
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void askTracker(); }}
                style={{ ...ta, fontSize: 13 }} />
              <button onClick={() => void askTracker()} disabled={chatBusy || !chatQ.trim()} style={btn('#01b7bb', '#06243a', 13)}>{chatBusy ? '…' : 'Ask'}</button>
            </div>
          </div>
        )}
        <button onClick={() => setChatOpen((o) => !o)} title="Ask AI about your job list"
          style={{ position: 'absolute', right: 16, bottom: 14, zIndex: 7, background: '#01b7bb', color: '#06243a', fontWeight: 800, fontSize: 13, border: 0, borderRadius: 24, padding: '10px 15px', cursor: 'pointer', boxShadow: '0 6px 20px rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', gap: 6 }}>🤖 Ask AI</button>
      </div>
    </div>
  );
}

// JOBLIST-FILTER-001: the legend IS the Job List filter — every swatch/icon is
// a checkbox. Unchecking a tier hides those rows from the table below;
// unchecking ★/✅ has no effect until CHECKED (they narrow, they don't widen).
function Legend({ bands, onToggleBand, top5Only, onToggleTop5, jdOnly, onToggleJd, queuedOnly, onToggleQueued }: {
  bands: Set<string>; onToggleBand: (b: string) => void;
  top5Only: boolean; onToggleTop5: () => void; jdOnly: boolean; onToggleJd: () => void;
  queuedOnly: boolean; onToggleQueued: () => void;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '7px 16px', borderBottom: '1px solid #e3e8f0', background: '#fbfcfe', fontSize: 11, color: '#445', alignItems: 'center' }}>
      <strong style={{ color: NAVY }}>Legend / filter:</strong>
      {['DDEBF7', 'E2EFDA', 'FCE4D6', 'FFF2CC', 'D9D9D9'].map((b) => {
        const t = TIERS[b]; const on = bands.has(b);
        return (
          <label key={b} title={on ? 'Shown — click to hide ' + t.label + ' rows' : 'Hidden — click to show ' + t.label + ' rows'}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, cursor: 'pointer', opacity: on ? 1 : 0.45 }}>
            <input type="checkbox" checked={on} onChange={() => onToggleBand(b)} style={{ width: 13, height: 13, margin: 0 }} />
            <span style={{ width: 13, height: 13, borderRadius: 3, background: t.tint, border: '1px solid ' + t.accent, display: 'inline-block' }} />
            <b style={{ color: t.accent }}>{t.label}</b> {t.desc}
          </label>
        );
      })}
      <label title={top5Only ? 'Showing only Top-5 rows — click to show all tiers again' : 'Click to show ONLY Top-5 rows'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: top5Only ? 1 : 0.75 }}>
        <input type="checkbox" checked={top5Only} onChange={onToggleTop5} style={{ width: 13, height: 13, margin: 0 }} /><b>★</b> Top 5
      </label>
      <label title={jdOnly ? 'Showing only rows with a stored JD — click to show all' : 'Click to show ONLY rows with a stored JD'}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: jdOnly ? 1 : 0.75 }}>
        <input type="checkbox" checked={jdOnly} onChange={onToggleJd} style={{ width: 13, height: 13, margin: 0 }} /><b>✅</b> JD stored
      </label>
      <label title={queuedOnly ? "Showing only rows queued for tonight's generation — click to show all" : "Click to show ONLY rows queued for tonight's generation (⏰)"}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', opacity: queuedOnly ? 1 : 0.75 }}>
        <input type="checkbox" checked={queuedOnly} onChange={onToggleQueued} style={{ width: 13, height: 13, margin: 0 }} /><b>⏰</b> Queued
      </label>
    </div>
  );
}

// Parse the support blob into structured sections for the Top-5 card.
interface Item { need: string; bring: string; insight: string; }
function parseSupport(text: string): { header: string; fit: string; flag: string; sections: { title: string; items: Item[] }[] } {
  const out = { header: '', fit: '', flag: '', sections: [] as { title: string; items: Item[] }[] };
  let cur: { title: string; items: Item[] } | null = null;
  for (const raw of (text || '').split('\n')) {
    const line = raw.trim(); if (!line) continue;
    if (line.startsWith('ROLE:')) out.header = line.slice(5).trim();
    else if (line.startsWith('FIT:')) out.fit = line.slice(4).trim();
    else if (/^FLAG(\/RISK)?:/.test(line)) out.flag = line.replace(/^FLAG(\/RISK)?:/, '').trim();
    else if (line.startsWith('•')) { cur = { title: line.replace(/^•\s*/, ''), items: [] }; out.sections.push(cur); }
    else if (line.startsWith('NEED:')) {
      const body = line.slice(5);
      const need = (body.split('|')[0] || '').trim();
      const bring = (body.match(/I BRING:\s*([^|]*)/i)?.[1] || '').trim();
      const insight = (body.match(/INSIGHT\/Q:\s*(.*)$/i)?.[1] || '').trim();
      if (cur) cur.items.push({ need, bring, insight });
    }
  }
  return out;
}

// Rebuild the support/intel blob from the structured form (round-trips parseSupport).
function buildSupport(p: ReturnType<typeof parseSupport>): string {
  const out: string[] = [];
  if (p.header) out.push('ROLE: ' + p.header);
  if (p.fit) out.push('FIT: ' + p.fit);
  if (p.flag) out.push('FLAG/RISK: ' + p.flag);
  for (const s of p.sections) {
    out.push('• ' + s.title);
    for (const it of s.items) {
      let seg = 'NEED: ' + it.need;
      if (it.bring) seg += '  |  I BRING: ' + it.bring;
      if (it.insight) seg += '  |  INSIGHT/Q: ' + it.insight;
      out.push(seg);
    }
  }
  return out.join('\n');
}

function FocusCard({ row, doc, cluster, mobile, busy, onPrepare, onOpen, pinned, onTogglePin, onPark, onReject, onSaveSupport, onSaveWeb, onResearch }: {
  row: Row; doc: TrackerDoc | null; cluster: { qual: string }[]; mobile: boolean; busy: boolean;
  onPrepare: () => void; onOpen: () => void; pinned: boolean; onTogglePin: () => void; onPark: () => void; onReject: () => void;
  onSaveSupport: (uk: string, text: string) => Promise<boolean>;
  onSaveWeb: (uk: string, text: string) => Promise<boolean>; onResearch: (uk: string, company: string, role: string) => Promise<string>;
}): JSX.Element {
  const uk = row[11]; const t = tierOf(row[12]);
  const rawSupport = (doc?.support || {})[uk] || '';
  const [p, setP] = useState(() => parseSupport(rawSupport));
  const [dirty, setDirty] = useState(false);
  const [savingSup, setSavingSup] = useState(false);
  const [cardHover, setCardHover] = useState(false);
  const [ai, setAi] = useState(false);
  const [jdHelp, setJdHelp] = useState(false);
  useEffect(() => { if (!dirty) setP(parseSupport(rawSupport)); }, [rawSupport, dirty]);
  // Employer web-research brief (viewable + editable in the card; fed to generation).
  const rawWeb = (doc?.webintel || {})[uk] || '';
  const [web, setWeb] = useState(rawWeb);
  const [webDirty, setWebDirty] = useState(false);
  const [savingWeb, setSavingWeb] = useState(false);
  const [researching, setResearching] = useState(false);
  useEffect(() => { if (!webDirty) setWeb(rawWeb); }, [rawWeb, webDirty]);
  async function saveWebEdit(): Promise<void> { setSavingWeb(true); try { if (await onSaveWeb(uk, web)) setWebDirty(false); } finally { setSavingWeb(false); } }
  async function doResearch(): Promise<void> { setResearching(true); try { const w = await onResearch(uk, row[1], row[2]); if (w) { setWeb(w); setWebDirty(false); } else alert('Web search returned no results for "' + row[1] + '" — try again in a moment; if it persists, check the proxy URL and any BYOK Brave key in Settings → API Keys.'); } catch (e) { alert('Research failed: ' + String((e as Error).message || e)); } finally { setResearching(false); } }

  const hasJd = ((doc?.jd || {})[uk] || '').length > 200;
  const saved = doc?.artifacts?.[uk]?.application_id;
  const url = doc?.urls?.[uk];
  // SIGNAL-MATERIALS-001: owner signals (typed + attached materials) count
  // toward the fit estimate and surface on the card.
  const sigBlock = signalsBlockOf(doc, uk);
  const pct = fitPercent(row[12], rawSupport + ' ' + ((doc?.jd || {})[uk] || '') + ' ' + sigBlock, cluster);
  const fs = (d: number, m: number) => (mobile ? m : d); // font-size: bigger on mobile

  function editItem(si: number, ii: number, field: 'need' | 'bring' | 'insight', v: string): void {
    setP((prev) => { const c = { ...prev, sections: prev.sections.map((s) => ({ ...s, items: s.items.slice() })) }; c.sections[si].items[ii] = { ...c.sections[si].items[ii], [field]: v }; return c; });
    setDirty(true);
  }
  async function saveIntel(): Promise<void> { setSavingSup(true); try { if (await onSaveSupport(uk, buildSupport(p))) setDirty(false); } finally { setSavingSup(false); } }
  // ONE Ask-AI: refine EVERY "I bring" line in a single call.
  async function refineAll(): Promise<void> {
    const flat: { si: number; ii: number; need: string; bring: string }[] = [];
    p.sections.forEach((s, si) => s.items.forEach((it, ii) => { if (it.need) flat.push({ si, ii, need: it.need, bring: it.bring }); }));
    if (!flat.length) return;
    setAi(true);
    try {
      const jd = (doc?.jd || {})[uk] || '';
      const sys = 'You refine a candidate\'s "What I bring" bullets for a job application. For EACH numbered need, return an improved one-sentence bullet that answers the need using the candidate\'s angle — concrete, specific, correct spelling and grammar, no fluff. Return ONLY a numbered list using the SAME numbers, one bullet per line, nothing else.';
      const list = flat.map((f, i) => (i + 1) + '. NEED: ' + f.need + '  CURRENT: ' + (f.bring || '(none)')).join('\n');
      const user = 'Role: ' + row[1] + ' — ' + row[2] + (jd ? '\nJD excerpt:\n' + jd.slice(0, 1200) : '')
        + (sigBlock ? '\nOWNER SIGNALS (extra context the candidate supplied for this role):\n' + sigBlock.slice(0, 900) : '')
        + '\n\nImprove each "I bring":\n' + list;
      const out = await askAI(user, sys, 700);
      const map: Record<number, string> = {};
      out.split('\n').forEach((line) => { const m = line.match(/^\s*(\d+)[.)]\s*(.+)/); if (m) map[parseInt(m[1], 10)] = m[2].trim().replace(/^["']|["']$/g, ''); });
      setP((prev) => { const c = { ...prev, sections: prev.sections.map((s) => ({ ...s, items: s.items.slice() })) };
        flat.forEach((f, i) => { const txt = map[i + 1]; if (txt) c.sections[f.si].items[f.ii] = { ...c.sections[f.si].items[f.ii], bring: txt }; });
        return c; });
      setDirty(true);
    } catch (e) { alert('Ask AI failed: ' + String((e as Error).message || e)); }
    finally { setAi(false); }
  }

  const pctColor = pct >= 80 ? '#2e7d32' : pct >= 60 ? '#B58A00' : '#C4711F';
  const showAi = (cardHover || mobile) && p.sections.some((s) => s.items.some((it) => it.need));
  return (
    <div onMouseEnter={() => setCardHover(true)} onMouseLeave={() => setCardHover(false)}
      style={{ border: '1px solid #d5deec', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(20,30,60,0.06)' }}>
      <div style={{ background: t.accent, color: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: fs(20, 24), fontWeight: 800 }}>★{row[0]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: fs(15, 18), lineHeight: 1.15 }}>{row[1]}</div>
          <div style={{ fontSize: fs(12, 14), opacity: 0.92 }}>{row[2]}</div>
        </div>
        <span title="Estimated fit (tier + cluster demand)" style={{ background: '#fff', color: pctColor, borderRadius: 14, padding: '3px 10px', fontSize: fs(13, 16), fontWeight: 800 }}>{pct}%</span>
        <span style={{ background: '#ffffff2e', borderRadius: 5, padding: '2px 8px', fontSize: fs(11, 13), fontWeight: 700 }}>{t.label}</span>
        <button onClick={(e) => { e.stopPropagation(); setJdHelp((v) => !v); }}
          title={hasJd ? 'JD stored — tap for info' : 'JD missing — tap for info'} aria-label="JD status info"
          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: fs(16, 21), padding: 0, lineHeight: 1 }}>{hasJd ? '✅' : '⚠️'}</button>
      </div>
      <div style={{ height: 5, background: '#eef1f6' }}><div style={{ height: '100%', width: pct + '%', background: pctColor }} /></div>
      <div style={{ padding: '11px 14px' }}>
        {jdHelp && (
          <div style={{ background: hasJd ? '#eaf5ea' : '#fff6e5', border: '1px solid ' + (hasJd ? '#bcdcbc' : '#f0cf8a'), borderRadius: 8, padding: '9px 11px', marginBottom: 9, fontSize: fs(12, 14), color: '#3a3320', display: 'flex', gap: 8, alignItems: 'flex-start', lineHeight: 1.4 }}>
            <span style={{ fontSize: fs(15, 18) }}>{hasJd ? '✅' : '⚠️'}</span>
            <span style={{ flex: 1 }}>{hasJd
              ? 'The full job description is stored for this role — fit scoring, "Prepare & open", and generation all use it.'
              : 'No job description is stored yet. "Prepare & open" and the analysis need it. Add it from the List view: paste the DIRECT posting URL (a careers-index page won\'t yield a JD), or upload the JD with the 📎 button.'}</span>
            <button onClick={() => setJdHelp(false)} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 15, color: '#998', padding: 0 }}>✕</button>
          </div>
        )}
        <div style={{ fontSize: fs(11, 13), color: '#556', marginBottom: 8 }}>
          📍 {row[3]}{row[4] ? ' · ' + row[4] : ''}{url ? <> · <a href={url} target="_blank" rel="noreferrer" style={{ color: t.accent, fontWeight: 700 }}>posting ↗</a></> : null}
        </div>
        {p.fit && <Line icon="🎯" label="Fit" text={p.fit} color="#2a3244" size={fs(12.5, 14.5)} />}
        {p.flag && <Line icon="⚠️" label="Flag" text={p.flag} color="#8a4b12" size={fs(12.5, 14.5)} />}
        {sigBlock && <Line icon="📌" label="Signals" text={sigBlock.replace(/\n+/g, ' · ').slice(0, 240)} color="#3a4d6b" size={fs(12, 13.5)} />}
        {p.sections.map((s, si) => (
          <div key={si} style={{ marginTop: 11 }}>
            <div style={{ fontSize: fs(11, 13), fontWeight: 800, color: t.accent, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 5 }}>{s.title}</div>
            {s.items.map((it, ii) => (
              <div key={ii} style={{ borderLeft: '3px solid ' + t.tint, padding: '4px 0 7px 10px', marginBottom: 9 }}>
                <div style={{ ...clamp2, fontSize: fs(12.5, 14.5), fontWeight: 700, color: '#1e2636', lineHeight: 1.35 }} title={it.need}>▸ {it.need}</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                  <b style={{ fontSize: fs(12, 15), color: '#28632a', paddingTop: 3 }}>🟢</b>
                  <textarea value={it.bring} onChange={(e) => editItem(si, ii, 'bring', e.target.value)} rows={mobile ? 3 : 2}
                    placeholder="what you bring — edit freely"
                    style={{ ...ta, fontSize: fs(12.5, 14.5), lineHeight: 1.4, background: '#f6fbf6', border: '1px solid #cfe4cf', color: '#1d3a1e' }} />
                </div>
                {it.insight && <div style={{ ...clamp2, fontSize: fs(12, 13.5), color: '#5a4b8a', marginTop: 4, lineHeight: 1.35 }} title={it.insight}>💡 {it.insight}</div>}
              </div>
            ))}
          </div>
        ))}
        {!p.sections.length && !p.fit && <div style={{ fontSize: fs(12, 14), color: '#889' }}>(no role intel yet — add the JD, then Prepare)</div>}
        <div style={{ marginTop: 12, borderTop: '1px dashed #d5deec', paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
            <span style={{ fontSize: fs(11, 13), fontWeight: 800, color: t.accent, letterSpacing: 0.3, textTransform: 'uppercase' }}>🌐 Company research (web)</span>
            <button onClick={() => void doResearch()} disabled={researching} title="Fetch or refresh employer research from the web (holistic + specific — fed into generation)"
              style={{ ...btn('#eef3fb', '#1d3a6e', fs(11, 13)), padding: '2px 8px', marginLeft: 'auto' }}>{researching ? 'Researching…' : (web ? '↻ Refresh' : '🔎 Research')}</button>
          </div>
          <textarea value={web} onChange={(e) => { setWeb(e.target.value); setWebDirty(true); }} rows={web ? (mobile ? 6 : 5) : 2}
            placeholder="Holistic + specific employer context from the web — feeds the WHY-this-company, cover letter and employer Q&As. Tap Research to fetch."
            style={{ ...ta, fontSize: fs(12, 14), lineHeight: 1.4, background: '#f6f9fe', border: '1px solid #cfddf0', color: '#1d2a44' }} />
          {webDirty && <button onClick={() => void saveWebEdit()} disabled={savingWeb} style={{ ...btn('#1d3a6e', '#fff', fs(11, 13)), marginTop: 6 }}>{savingWeb ? 'Saving…' : '💾 Save research'}</button>}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {saved
            ? <button onClick={onOpen} disabled={busy} style={btn('#2e7d32', '#fff', fs(12, 14))}>{busy ? '…' : '↗ Open in preview'}</button>
            : <button onClick={onPrepare} disabled={busy} style={btn(t.accent, '#fff', fs(12, 14))}>{busy ? 'Preparing…' : '✨ Prepare & open in AntCV'}</button>}
          <button onClick={onTogglePin} disabled={busy} title={pinned ? 'Unpin from Top-5' : 'Pin into Top-5 (independent of fit rank)'}
            style={btn(pinned ? '#B58A00' : '#eef1f6', pinned ? '#fff' : '#556', fs(12, 14))}>{pinned ? '★ Pinned' : '☆ Pin'}</button>
          <button onClick={onPark} disabled={busy} title="Park — out of Top-5 but stays live in the list" style={btn('#eef1f6', '#556', fs(12, 14))}>⏸ Park</button>
          <button onClick={onReject} disabled={busy} title="Reject with a reason (archives + stops discovery re-proposing)" style={btn('#f4e6e2', '#7a2618', fs(12, 14))}>✕ Reject</button>
          {showAi && <button onClick={() => void refineAll()} disabled={ai} title="Ask AI to polish all 'I bring' lines"
            style={btn(t.accent, '#fff', fs(12, 14))}>{ai ? 'Polishing…' : '✨ Ask AI'}</button>}
          {dirty && <button onClick={() => void saveIntel()} disabled={savingSup} style={btn('#2e7d32', '#fff', fs(12, 14))}>{savingSup ? 'Saving…' : '💾 Save edits'}</button>}
        </div>
      </div>
    </div>
  );
}

function Line({ icon, label, text, color, size }: { icon: string; label: string; text: string; color: string; size: number }): JSX.Element {
  return <div title={text} style={{ ...clamp2, fontSize: size, color, margin: '3px 0', lineHeight: 1.4 }}><span style={{ marginRight: 5 }}>{icon}</span><b>{label}:</b> {text}</div>;
}

const clamp2: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };

const ta: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '4px 6px', border: '1px solid #cfd8e6', borderRadius: 4, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.35, minHeight: 34 };
const mLbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#334', margin: '7px 0 2px' };
function btn(bg: string, color = '#fff', size = 12): React.CSSProperties {
  return { background: bg, color, border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: size, cursor: 'pointer', fontWeight: 600 };
}
