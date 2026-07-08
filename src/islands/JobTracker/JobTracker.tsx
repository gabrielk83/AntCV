// JOB-TRACKER-001 Phase 3 — JobTracker island.
// V1 review/edit list · V2 add-JD (URL or file) · V3 Top-5 focus + prepare/open
// a traceable saved application · V4 drop → why → classify → Dream Envelope.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getDoc, putDoc, fetchJdUrl, createApplication, setActive, classifyReason,
  fetchClusterTop20, askAI, fitPercent, TRACKED_STATUSES, type TrackerDoc, type Row,
} from './api';

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
const isTop5 = (r: Row) => (Number(r[0]) || 99) <= 5;

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
  useEffect(() => { void fetchClusterTop20().then((c) => setCluster(c.top20 || [])).catch(() => { /* */ }); }, []);

  const rows = useMemo<Row[]>(() => {
    const r = (doc?.rows || []).slice();
    r.sort((a, b) => (Number(a[0]) || 99) - (Number(b[0]) || 99));
    return r;
  }, [doc]);
  const top5 = useMemo(() => rows.filter(isTop5).slice(0, 5), [rows]);

  function editRow(uk: string, idx: number, value: string): void {
    if (!doc) return;
    setDocState({ ...doc, rows: (doc.rows || []).map((r) => { if (r[11] !== uk) return r; const c = r.slice() as Row; c[idx] = value; return c; }) });
    setDirty(true);
  }
  // Generation tier: explicit choice wins; otherwise Top-5 default to High
  // quality (they're the priority applications), the rest to Quick.
  const genOf = (uk: string) => {
    const g = (doc?.gen || {})[uk]; if (g) return g;
    const r = (doc?.rows || []).find((x) => x[11] === uk);
    return r && (Number(r[0]) || 99) <= 5 ? 'high' : 'quick';
  };
  function setGen(uk: string, q: string): void { if (!doc) return; setDocState({ ...doc, gen: { ...(doc.gen || {}), [uk]: q } }); setDirty(true); }
  const brandOf = (uk: string) => !!(doc?.brandfit || {})[uk];
  function toggleBrand(uk: string): void { if (!doc) return; setDocState({ ...doc, brandfit: { ...(doc.brandfit || {}), [uk]: !brandOf(uk) } }); setDirty(true); }
  const signalsOf = (uk: string) => (doc?.signals || {})[uk] || '';
  function setSignals(uk: string, v: string): void { if (!doc) return; setDocState({ ...doc, signals: { ...(doc.signals || {}), [uk]: v } }); setDirty(true); }
  const hasArtifact = (uk: string) => !!doc?.artifacts?.[uk]?.application_id;
  // Nightly queue (⏰): on by default until the row has been generated; explicit toggle wins.
  const nightlyOn = (uk: string) => { const q = doc?.queue?.[uk]; return q === undefined ? !hasArtifact(uk) : q; };
  function toggleNightly(uk: string): void { if (!doc) return; setDocState({ ...doc, queue: { ...(doc.queue || {}), [uk]: !nightlyOn(uk) } }); setDirty(true); }
  const [expandRow, setExpandRow] = useState<string | null>(null);

  const persist = useCallback(async (next: TrackerDoc, quiet = false): Promise<boolean> => {
    const res = await putDoc(next, rev);
    if (res.ok) { setRev(res.rev || rev + 1); setDocState(next); setDirty(false); if (!quiet) setNote('Saved ✓'); return true; }
    if (res.conflict) { setErr('Changed elsewhere — reloaded latest, re-apply your edit.'); setDocState(res.serverDoc || next); setRev(res.serverRev || rev); setDirty(false); return false; }
    setErr(res.error || 'save failed'); return false;
  }, [rev]);

  async function save(): Promise<void> { if (!doc) return; setSaving(true); setErr(null); setNote(null); try { await persist(doc); } finally { setSaving(false); } }

  // Persist an edited support/intel blob for one role (used by the Top-5 card).
  const saveSupport = useCallback(async (uk: string, text: string): Promise<boolean> => {
    if (!doc) return false;
    return persist({ ...doc, support: { ...(doc.support || {}), [uk]: text } }, true);
  }, [doc, persist]);

  // Append a row from a JD (shared by URL + file paths).
  function appendRow(company: string, role: string, jdText: string, url?: string): void {
    if (!doc) return;
    const uk = slug(company + '-' + role) + '-' + String(Date.now()).slice(-4);
    const maxRank = Math.max(0, ...(doc.rows || []).map((r) => Number(r[0]) || 0));
    const row: Row = [maxRank + 1, company, role, '', '', '', '', 'OPEN', 'Not started', '', 'Added', uk, 'E2EFDA'];
    const next: TrackerDoc = {
      ...doc, rows: [...(doc.rows || []), row],
      urls: url ? { ...(doc.urls || {}), [uk]: url } : (doc.urls || {}),
      jd: { ...(doc.jd || {}), [uk]: jdText },
      support: { ...(doc.support || {}), [uk]: 'ROLE: ' + company + ' — ' + role },
    };
    setDocState(next); setDirty(true); setNote('Added "' + (role || company) + '". Review & Save.');
  }

  async function addFromUrl(): Promise<void> {
    const url = addUrl.trim(); if (!url || !doc) return;
    setAdding(true); setErr(null); setNote(null);
    try {
      const jd = await fetchJdUrl(url);
      if (!jd.ok) { setErr('Fetch failed: ' + (jd.error || jd.wall_hint || 'unknown')); return; }
      const title = (jd.title || '').replace(/\s*[|·—-]\s*(LinkedIn|Jobindex|Indeed).*$/i, '').trim();
      const company = window.prompt('Company?', title.split(/ at | hos | - /i).pop()?.trim() || '') || '';
      const role = window.prompt('Role / title?', title) || '';
      if (!company && !role) return;
      appendRow(company, role, jd.text || '', url);
      setAddUrl('');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setAdding(false); }
  }

  // Extract text from an uploaded JD file. Plain-text is read directly; PDFs
  // and images/scans go through the app's own multi-tier extractor
  // (window.AntcvExtractPDFText: PDF.js text → LLM document → vision OCR).
  async function addFromFile(file: File): Promise<void> {
    setAdding(true); setErr(null); setNote(null);
    try {
      const name = (file.name || '').toLowerCase();
      let text = '';
      if (/\.(txt|md|csv|json|text)$/.test(name) || (file.type || '').startsWith('text/')) {
        text = (await file.text()).trim();
      } else {
        const extract = (window as unknown as { AntcvExtractPDFText?: (f: File) => Promise<{ text?: string; method?: string; warning?: string | null }> }).AntcvExtractPDFText;
        if (typeof extract !== 'function') { setErr('The app\'s PDF/OCR extractor isn\'t loaded yet — reload the page, or upload a .txt / use the URL.'); return; }
        setNote('Extracting text (PDF.js → LLM → OCR)…');
        const r = await extract(file);
        text = String((r && r.text) || '').trim();
        if (r && r.warning) console.info('[JobTracker] extract:', r.method, r.warning);
      }
      if (text.length < 100) { setErr('Could not extract enough text from that file. Try a clearer scan, the regular uploader, or paste the text.'); return; }
      const company = window.prompt('Company?') || '';
      const role = window.prompt('Role / title?', file.name.replace(/\.[a-z0-9]+$/i, '')) || '';
      if (!company && !role) return;
      appendRow(company, role, text);
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
      const envText = (d.envelope || []).map((e) => e[0] + ': ' + e[1] + (e[2] ? ' — ' + e[2] : '')).join('\n');
      const ownerSig = (d.signals || {})[uk] || '';
      const supporting = 'TARGET-ROLE GUIDELINES (Dream Envelope):\n' + envText
        + '\n\nROLE INTEL:\n' + ((d.support || {})[uk] || '')
        + (ownerSig ? '\n\nADDITIONAL SIGNALS (owner-added):\n' + ownerSig : '')
        + ((d.brandfit || {})[uk] ? '\n\nBRAND-FIT: style the CV and cover letter to the employer\'s brand identity.' : '');
      const id = await createApplication({ jd_text: jd, jd_company: row[1], jd_role: row[2], category: categoryFor(row[2], row[1]), supporting_context: supporting });
      if (!id) { setErr('Could not create the application.'); return; }
      const next: TrackerDoc = { ...d, artifacts: { ...(d.artifacts || {}), [uk]: { application_id: id, generated_at: Date.now() } } };
      await setActive(id);
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

  async function dropFromTop5(row: Row): Promise<void> {
    if (!doc) return;
    const reason = window.prompt('Why are you dropping ' + row[1] + '?');
    if (!reason || !reason.trim()) return;
    const uk = row[11]; setBusyKey(uk); setErr(null); setNote(null);
    try {
      const dim = classifyReason(reason);
      const env = (doc.envelope || []).map((e) => { if (e[0] !== dim) return e; const c = e.slice(); c[3] = String(c[3] || '') + '  •  [' + today() + '] dropped ' + row[1] + ': ' + reason.trim(); return c; });
      const rowsNext = (doc.rows || []).map((r) => { if (r[11] !== uk) return r; const c = r.slice() as Row; c[8] = 'Archive / closed'; c[10] = 'Dropped (' + dim + '): ' + reason.trim(); c[12] = 'D9D9D9'; return c; });
      if (await persist({ ...doc, envelope: env, rows: rowsNext }, true)) setNote('Dropped ' + row[1] + '. Envelope learning added → ' + dim + '.');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusyKey(null); }
  }

  const cell: React.CSSProperties = { padding: '5px 7px', borderBottom: '1px solid #dbe2ee', fontSize: 12, verticalAlign: 'top' };
  const th: React.CSSProperties = { ...cell, background: NAVY, color: '#fff', position: 'sticky', top: 0, fontWeight: 600, textAlign: 'left' };
  const jdCount = Object.values(doc?.jd || {}).filter((t) => (t || '').length > 200).length;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,22,40,0.55)', zIndex: 99999, display: 'flex' }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div style={{ background: '#fff', margin: '2vh auto', width: 'min(1180px, 97vw)', height: '96vh', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
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
          </div>
        )}

        <Legend />

        {(err || note) && <div style={{ padding: '6px 16px', fontSize: 12, color: err ? '#b3261e' : '#2e7d32', background: err ? '#fdecea' : '#eaf5ea' }}>{err || note}</div>}

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? <div style={{ padding: 24 }}>Loading…</div> : view === 'list' ? (isMobile ? (
            <div style={{ padding: 12, display: 'grid', gap: 10 }}>
              {rows.map((r) => {
                const uk = r[11]; const t = tierOf(r[12]); const hasJd = ((doc?.jd || {})[uk] || '').length > 200; const star = isTop5(r);
                return (
                  <div key={uk} style={{ border: '1px solid #d5deec', borderLeft: '5px solid ' + t.accent, borderRadius: 8, background: t.tint, padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 800, color: t.accent, fontSize: 15 }}>{star ? '★' : ''}{r[0]}</span>
                      <strong style={{ flex: 1, fontSize: 14 }}>{r[1]}</strong>
                      <span style={{ background: t.accent, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{t.label}</span>
                      <span style={{ fontSize: 14 }} title={hasJd ? 'JD stored' : 'No JD'}>{hasJd ? '✅' : '—'}</span>
                    </div>
                    <div style={{ fontSize: 13, margin: '3px 0' }}>{r[2]}</div>
                    <div style={{ fontSize: 11, color: '#556', marginBottom: 4 }}>📍 {r[3]}{doc?.urls?.[uk] ? <> · <a href={doc.urls[uk]} target="_blank" rel="noreferrer" style={{ color: t.accent, fontWeight: 700 }}>posting ↗</a></> : null}</div>
                    <div style={mLbl}>Status</div>
                    <select value={r[8]} onChange={(e) => editRow(uk, 8, e.target.value)} style={{ width: '100%', fontSize: 13, padding: 5 }}>{TRACKED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}{!TRACKED_STATUSES.includes(r[8]) && r[8] ? <option value={r[8]}>{r[8]}</option> : null}</select>
                    <div style={mLbl}>Next action</div>
                    <textarea value={r[9]} onChange={(e) => editRow(uk, 9, e.target.value)} rows={2} style={ta} />
                    <div style={mLbl}>Flag / notes</div>
                    <textarea value={r[10]} onChange={(e) => editRow(uk, 10, e.target.value)} rows={2} style={ta} />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, margin: '9px 0 2px', fontSize: 13, fontWeight: 700, color: '#334' }}>
                      <input type="checkbox" checked={brandOf(uk)} onChange={() => toggleBrand(uk)} style={{ width: 18, height: 18 }} /> 🎨 Brand-fit to employer
                    </label>
                    <div style={mLbl}>Additional signals (for generation)</div>
                    <textarea value={signalsOf(uk)} onChange={(e) => setSignals(uk, e.target.value)} rows={2} placeholder="hiring manager, emphasis, insider context…" style={ta} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 9, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select value={genOf(uk)} onChange={(e) => setGen(uk, e.target.value)} title="Generation quality" style={{ fontSize: 13, padding: 5 }}>
                        <option value="high">★ High quality</option><option value="quick">⚡ Quick</option>
                      </select>
                      {hasArtifact(uk)
                        ? <button onClick={() => void openSaved(r)} disabled={busyKey === uk} style={btn('#2e7d32', '#fff', 13)}>{busyKey === uk ? '…' : '↗ Open'}</button>
                        : <button onClick={() => void prepareAndOpen(r)} disabled={busyKey === uk} style={btn('#2E5DA8', '#fff', 13)}>{busyKey === uk ? '…' : '✨ Open in AntCV'}</button>}
                      <button onClick={() => toggleNightly(uk)} title="Include in tonight's batch generation"
                        style={{ background: nightlyOn(uk) ? '#2E5DA8' : '#eef1f6', color: nightlyOn(uk) ? '#fff' : '#556', border: '1px solid #c3ccdb', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: '5px 9px' }}>⏰ {nightlyOn(uk) ? 'Nightly ✓' : 'Nightly'}</button>
                    </div>
                  </div>
                );
              })}
              {rows.length === 0 && <div style={{ padding: 16, fontSize: 13 }}>No rows yet — paste a job URL or upload a JD file above.</div>}
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 46 }} /><col style={{ width: 58 }} /><col style={{ width: 150 }} /><col style={{ width: 210 }} />
                <col style={{ width: 120 }} /><col style={{ width: 34 }} /><col style={{ width: 130 }} /><col style={{ width: 175 }} /><col style={{ width: 175 }} /><col style={{ width: 48 }} /><col style={{ width: 160 }} /><col style={{ width: 118 }} />
              </colgroup>
              <thead><tr>{['#', 'Tier', 'Company', 'Role', 'Location', 'JD', 'Tracked', 'Next action', 'Flag / notes', 'Brand', 'Signals', 'Generate'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => {
                  const uk = r[11]; const t = tierOf(r[12]); const hasJd = ((doc?.jd || {})[uk] || '').length > 200; const star = isTop5(r);
                  return (
                    <tr key={uk} style={{ background: t.tint }}>
                      <td style={{ ...cell, textAlign: 'center', fontWeight: 700, borderLeft: '4px solid ' + t.accent }}>{star ? '★' : ''}{r[0]}</td>
                      <td style={{ ...cell }}><span style={{ background: t.accent, color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 700 }}>{t.label}</span></td>
                      <td style={{ ...cell, fontWeight: 600 }}>{r[1]}</td>
                      <td style={cell}>{r[2]}</td>
                      <td style={cell}>{r[3]}</td>
                      <td style={{ ...cell, textAlign: 'center', fontSize: 14 }} title={hasJd ? 'JD stored' : 'No JD — add a direct posting URL / file'}>{hasJd ? '✅' : '—'}</td>
                      <td style={cell}><select value={r[8]} onChange={(e) => editRow(uk, 8, e.target.value)} style={{ fontSize: 12, width: '100%' }}>{TRACKED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}{!TRACKED_STATUSES.includes(r[8]) && r[8] ? <option value={r[8]}>{r[8]}</option> : null}</select></td>
                      <td style={cell}><textarea value={r[9]} onChange={(e) => editRow(uk, 9, e.target.value)} onFocus={() => setExpandRow(uk)} rows={expandRow === uk ? 5 : 2} style={ta} /></td>
                      <td style={cell}><textarea value={r[10]} onChange={(e) => editRow(uk, 10, e.target.value)} onFocus={() => setExpandRow(uk)} rows={expandRow === uk ? 5 : 2} style={ta} /></td>
                      <td style={{ ...cell, textAlign: 'center' }}><input type="checkbox" checked={brandOf(uk)} onChange={() => toggleBrand(uk)} title="Brand-fit the CV/CL to this employer's identity" style={{ width: 17, height: 17 }} /></td>
                      <td style={cell}><textarea value={signalsOf(uk)} onChange={(e) => setSignals(uk, e.target.value)} onFocus={() => setExpandRow(uk)} rows={expandRow === uk ? 5 : 2} placeholder="extra signals for generation…" style={ta} /></td>
                      <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                        <button onClick={() => setGen(uk, genOf(uk) === 'high' ? 'quick' : 'high')} title="Generation quality — tap to switch"
                          style={{ background: genOf(uk) === 'high' ? '#fff3cf' : '#eef1f6', color: genOf(uk) === 'high' ? '#8a6d00' : '#556', border: '1px solid #cfd8e6', borderRadius: 5, cursor: 'pointer', fontSize: 11, fontWeight: 700, padding: '2px 4px', display: 'block', width: '100%', marginBottom: 3 }}>{genOf(uk) === 'high' ? '★ High' : '⚡ Quick'}</button>
                        <button onClick={() => (hasArtifact(uk) ? void openSaved(r) : void prepareAndOpen(r))} disabled={busyKey === uk}
                          title={hasArtifact(uk) ? 'Reopen in AntCV' : 'Open in AntCV — loads the JD, then press Generate there'}
                          style={{ ...btn(hasArtifact(uk) ? '#2e7d32' : '#2E5DA8'), padding: '3px 4px', fontSize: 11, display: 'block', width: '100%', marginBottom: 3 }}>{busyKey === uk ? '…' : (hasArtifact(uk) ? '↗ Open' : '✨ Open')}</button>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
                          <button onClick={() => toggleNightly(uk)} title={nightlyOn(uk) ? "In tonight's queue — tap to remove" : 'Queue for tonight'}
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 15, opacity: nightlyOn(uk) ? 1 : 0.28, padding: 0 }}>⏰</button>
                          {doc?.urls?.[uk] ? <a href={doc.urls[uk]} target="_blank" rel="noreferrer" title="Open posting" style={{ color: t.accent, fontWeight: 700, fontSize: 14 }}>↗</a> : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td style={cell} colSpan={12}>No rows yet — paste a job URL or upload a JD file above.</td></tr>}
              </tbody>
            </table>
          )) : (
            <div style={{ padding: 14, display: 'grid', gap: 14 }}>
              {top5.map((r) => <FocusCard key={r[11]} row={r} doc={doc} cluster={cluster} mobile={isMobile} busy={busyKey === r[11]}
                onPrepare={() => void prepareAndOpen(r)} onOpen={() => void openSaved(r)} onDrop={() => void dropFromTop5(r)} onSaveSupport={saveSupport} />)}
              {top5.length === 0 && <div>No Top-5 roles yet.</div>}
            </div>
          )}
        </div>
        <div style={{ padding: '6px 16px', fontSize: 11, color: '#667', borderTop: '1px solid #e3e8f0' }}>
          {rows.length} roles · {jdCount} with JD · ★ = Top 5 · edits sync to your Excel.
        </div>
      </div>
    </div>
  );
}

function Legend(): JSX.Element {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '7px 16px', borderBottom: '1px solid #e3e8f0', background: '#fbfcfe', fontSize: 11, color: '#445', alignItems: 'center' }}>
      <strong style={{ color: NAVY }}>Legend:</strong>
      {['DDEBF7', 'E2EFDA', 'FCE4D6', 'FFF2CC', 'D9D9D9'].map((b) => { const t = TIERS[b]; return (
        <span key={b} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 13, height: 13, borderRadius: 3, background: t.tint, border: '1px solid ' + t.accent, display: 'inline-block' }} />
          <b style={{ color: t.accent }}>{t.label}</b> {t.desc}
        </span>
      ); })}
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><b>★</b> Top 5</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><b>✅</b> JD stored</span>
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

function FocusCard({ row, doc, cluster, mobile, busy, onPrepare, onOpen, onDrop, onSaveSupport }: {
  row: Row; doc: TrackerDoc | null; cluster: { qual: string }[]; mobile: boolean; busy: boolean;
  onPrepare: () => void; onOpen: () => void; onDrop: () => void; onSaveSupport: (uk: string, text: string) => Promise<boolean>;
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

  const hasJd = ((doc?.jd || {})[uk] || '').length > 200;
  const saved = doc?.artifacts?.[uk]?.application_id;
  const url = doc?.urls?.[uk];
  const pct = fitPercent(row[12], rawSupport + ' ' + ((doc?.jd || {})[uk] || ''), cluster);
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
      const user = 'Role: ' + row[1] + ' — ' + row[2] + (jd ? '\nJD excerpt:\n' + jd.slice(0, 1200) : '') + '\n\nImprove each "I bring":\n' + list;
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
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {saved
            ? <button onClick={onOpen} disabled={busy} style={btn('#2e7d32', '#fff', fs(12, 14))}>{busy ? '…' : '↗ Open in preview'}</button>
            : <button onClick={onPrepare} disabled={busy} style={btn(t.accent, '#fff', fs(12, 14))}>{busy ? 'Preparing…' : '✨ Prepare & open in AntCV'}</button>}
          <button onClick={onDrop} disabled={busy} style={btn('#f4e6e2', '#7a2618', fs(12, 14))}>✕ Drop</button>
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
