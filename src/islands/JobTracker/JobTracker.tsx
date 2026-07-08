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
    const mq = window.matchMedia('(max-width: 680px)');
    const on = () => setIsMobile(mq.matches); on();
    try { mq.addEventListener('change', on); } catch { mq.addListener(on); }
    return () => { try { mq.removeEventListener('change', on); } catch { mq.removeListener(on); } };
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

  async function prepareAndOpen(row: Row): Promise<void> {
    if (!doc) return;
    const uk = row[11]; setBusyKey(uk); setErr(null); setNote(null);
    try {
      let d = doc; let jd = (d.jd || {})[uk] || '';
      if ((!jd || jd.length < 200) && d.urls?.[uk]) {
        setNote('Fetching JD…');
        const f = await fetchJdUrl(d.urls[uk]);
        if (f.ok && f.text && f.text.length > 200) { jd = f.text; d = { ...d, jd: { ...(d.jd || {}), [uk]: jd } }; }
      }
      if (!jd || jd.length < 200) { setErr('No JD text for this role — add the DIRECT posting URL or a JD file first.'); return; }
      const envText = (d.envelope || []).map((e) => e[0] + ': ' + e[1] + (e[2] ? ' — ' + e[2] : '')).join('\n');
      const supporting = 'TARGET-ROLE GUIDELINES (Dream Envelope):\n' + envText + '\n\nROLE INTEL:\n' + ((d.support || {})[uk] || '');
      const id = await createApplication({ jd_text: jd, jd_company: row[1], jd_role: row[2], category: categoryFor(row[2], row[1]), supporting_context: supporting });
      if (!id) { setErr('Could not create the application.'); return; }
      const next: TrackerDoc = { ...d, artifacts: { ...(d.artifacts || {}), [uk]: { application_id: id, generated_at: Date.now() } } };
      await setActive(id);
      if (!(await persist(next, true))) return;
      onClose();
      setTimeout(() => { try { location.reload(); } catch { /* */ } }, 60);
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusyKey(null); }
  }

  async function openSaved(row: Row): Promise<void> {
    const id = doc?.artifacts?.[row[11]]?.application_id;
    if (!id) return;
    setBusyKey(row[11]);
    try { await setActive(id); onClose(); setTimeout(() => { try { location.reload(); } catch { /* */ } }, 60); }
    catch (e) { setErr(String((e as Error).message || e)); setBusyKey(null); }
  }

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
                  </div>
                );
              })}
              {rows.length === 0 && <div style={{ padding: 16, fontSize: 13 }}>No rows yet — paste a job URL or upload a JD file above.</div>}
            </div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 46 }} /><col style={{ width: 58 }} /><col style={{ width: 150 }} /><col style={{ width: 210 }} />
                <col style={{ width: 120 }} /><col style={{ width: 34 }} /><col style={{ width: 130 }} /><col /><col /><col style={{ width: 54 }} />
              </colgroup>
              <thead><tr>{['#', 'Tier', 'Company', 'Role', 'Location', 'JD', 'Tracked', 'Next action', 'Flag / notes', 'Link'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
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
                      <td style={cell}><textarea value={r[9]} onChange={(e) => editRow(uk, 9, e.target.value)} rows={2} style={ta} /></td>
                      <td style={cell}><textarea value={r[10]} onChange={(e) => editRow(uk, 10, e.target.value)} rows={2} style={ta} /></td>
                      <td style={{ ...cell, textAlign: 'center' }}>{doc?.urls?.[uk] ? <a href={doc.urls[uk]} target="_blank" rel="noreferrer" style={{ color: t.accent, fontWeight: 700 }}>↗</a> : ''}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td style={cell} colSpan={10}>No rows yet — paste a job URL or upload a JD file above.</td></tr>}
              </tbody>
            </table>
          )) : (
            <div style={{ padding: 14, display: 'grid', gap: 14 }}>
              {top5.map((r) => <FocusCard key={r[11]} row={r} doc={doc} cluster={cluster} busy={busyKey === r[11]}
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

function FocusCard({ row, doc, cluster, busy, onPrepare, onOpen, onDrop, onSaveSupport }: {
  row: Row; doc: TrackerDoc | null; cluster: { qual: string }[]; busy: boolean;
  onPrepare: () => void; onOpen: () => void; onDrop: () => void; onSaveSupport: (uk: string, text: string) => Promise<boolean>;
}): JSX.Element {
  const uk = row[11]; const t = tierOf(row[12]);
  const rawSupport = (doc?.support || {})[uk] || '';
  const [p, setP] = useState(() => parseSupport(rawSupport));
  const [dirty, setDirty] = useState(false);
  const [savingSup, setSavingSup] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [aiKey, setAiKey] = useState<string | null>(null);
  // Re-sync when the underlying doc changes and we have no local edits.
  useEffect(() => { if (!dirty) setP(parseSupport(rawSupport)); }, [rawSupport, dirty]);

  const hasJd = ((doc?.jd || {})[uk] || '').length > 200;
  const saved = doc?.artifacts?.[uk]?.application_id;
  const url = doc?.urls?.[uk];
  const pct = fitPercent(row[12], rawSupport + ' ' + ((doc?.jd || {})[uk] || ''), cluster);

  function editItem(si: number, ii: number, field: 'need' | 'bring' | 'insight', v: string): void {
    setP((prev) => { const c = { ...prev, sections: prev.sections.map((s) => ({ ...s, items: s.items.slice() })) }; c.sections[si].items[ii] = { ...c.sections[si].items[ii], [field]: v }; return c; });
    setDirty(true);
  }
  async function saveIntel(): Promise<void> { setSavingSup(true); try { if (await onSaveSupport(uk, buildSupport(p))) setDirty(false); } finally { setSavingSup(false); } }
  async function refine(si: number, ii: number): Promise<void> {
    const it = p.sections[si].items[ii]; const key = si + ':' + ii; setAiKey(key);
    try {
      const jd = (doc?.jd || {})[uk] || '';
      const sys = 'You refine ONE "What I bring" bullet for a job application. Return ONLY the improved bullet — one concrete, specific sentence that answers the employer need using the candidate\'s angle. Fix spelling and grammar. No quotes, no preamble, no bullet marker.';
      const user = 'Role: ' + row[1] + ' — ' + row[2] + '\nEmployer NEED: ' + it.need + '\nCurrent "I bring": ' + (it.bring || '(empty)') + (jd ? '\nJD excerpt:\n' + jd.slice(0, 1400) : '');
      const out = await askAI(user, sys, 200);
      if (out) editItem(si, ii, 'bring', out.replace(/^["'\s]+|["'\s]+$/g, ''));
    } catch (e) { alert('Ask AI failed: ' + String((e as Error).message || e)); }
    finally { setAiKey(null); }
  }

  const pctColor = pct >= 80 ? '#2e7d32' : pct >= 60 ? '#B58A00' : '#C4711F';
  return (
    <div style={{ border: '1px solid #d5deec', borderRadius: 10, overflow: 'hidden', background: '#fff', boxShadow: '0 1px 4px rgba(20,30,60,0.06)' }}>
      <div style={{ background: t.accent, color: '#fff', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 20, fontWeight: 800 }}>★{row[0]}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, lineHeight: 1.1 }}>{row[1]}</div>
          <div style={{ fontSize: 12, opacity: 0.92 }}>{row[2]}</div>
        </div>
        {/* fit % */}
        <span title="Estimated fit (tier + cluster demand)" style={{ background: '#fff', color: pctColor, borderRadius: 14, padding: '3px 10px', fontSize: 13, fontWeight: 800 }}>{pct}%</span>
        <span style={{ background: '#ffffff2e', borderRadius: 5, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{t.label}</span>
        <span title={hasJd ? 'JD stored' : 'JD missing'} style={{ fontSize: 15 }}>{hasJd ? '✅' : '⚠️'}</span>
      </div>
      {/* fit bar */}
      <div style={{ height: 5, background: '#eef1f6' }}><div style={{ height: '100%', width: pct + '%', background: pctColor }} /></div>
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 11, color: '#556', marginBottom: 8 }}>
          📍 {row[3]}{row[4] ? ' · ' + row[4] : ''}{url ? <> · <a href={url} target="_blank" rel="noreferrer" style={{ color: t.accent, fontWeight: 700 }}>posting ↗</a></> : null}
        </div>
        {p.fit && <Line icon="🎯" label="Fit" text={p.fit} color="#2a3244" />}
        {p.flag && <Line icon="⚠️" label="Flag" text={p.flag} color="#8a4b12" />}
        {p.sections.map((s, si) => (
          <div key={si} style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: t.accent, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 5 }}>{s.title}</div>
            {s.items.map((it, ii) => { const key = si + ':' + ii; return (
              <div key={ii} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover((h) => (h === key ? null : h))}
                style={{ borderLeft: '3px solid ' + t.tint, padding: '4px 0 6px 9px', marginBottom: 8 }}>
                <div style={{ ...clamp2, fontSize: 12.5, fontWeight: 700, color: '#1e2636' }} title={it.need}>▸ {it.need}</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 3 }}>
                  <b style={{ fontSize: 12, color: '#28632a', whiteSpace: 'nowrap', paddingTop: 4 }}>🟢</b>
                  <textarea value={it.bring} onChange={(e) => editItem(si, ii, 'bring', e.target.value)} rows={2}
                    placeholder="what you bring — edit freely"
                    style={{ ...ta, fontSize: 12, background: '#f6fbf6', border: '1px solid #cfe4cf', color: '#1d3a1e' }} />
                  <button onClick={() => void refine(si, ii)} disabled={aiKey === key}
                    title="Ask AI to fine-tune this line"
                    style={{ ...btn(t.accent), padding: '4px 8px', fontSize: 11, whiteSpace: 'nowrap', opacity: hover === key || aiKey === key ? 1 : 0.3 }}>
                    {aiKey === key ? '…' : '✨ AI'}</button>
                </div>
                {it.insight && <div style={{ ...clamp2, fontSize: 12, color: '#5a4b8a', marginTop: 3 }} title={it.insight}>💡 {it.insight}</div>}
              </div>
            ); })}
          </div>
        ))}
        {!p.sections.length && !p.fit && <div style={{ fontSize: 12, color: '#889' }}>(no role intel yet — add the JD, then Prepare)</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          {saved
            ? <button onClick={onOpen} disabled={busy} style={btn('#2e7d32')}>{busy ? '…' : '↗ Open in preview'}</button>
            : <button onClick={onPrepare} disabled={busy} style={btn(t.accent)}>{busy ? 'Preparing…' : '✨ Prepare & open in AntCV'}</button>}
          <button onClick={onDrop} disabled={busy} style={btn('#f4e6e2', '#7a2618')}>✕ Drop from Top 5</button>
          {dirty && <button onClick={() => void saveIntel()} disabled={savingSup} style={btn('#2e7d32')}>{savingSup ? 'Saving…' : '💾 Save intel edits'}</button>}
        </div>
      </div>
    </div>
  );
}

function Line({ icon, label, text, color }: { icon: string; label: string; text: string; color: string }): JSX.Element {
  return <div title={text} style={{ ...clamp2, fontSize: 12.5, color, margin: '3px 0', lineHeight: 1.4 }}><span style={{ marginRight: 5 }}>{icon}</span><b>{label}:</b> {text}</div>;
}

const clamp2: React.CSSProperties = { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };

const ta: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '4px 6px', border: '1px solid #cfd8e6', borderRadius: 4, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.35, minHeight: 34 };
const mLbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: '#334', margin: '7px 0 2px' };
function btn(bg: string, color = '#fff'): React.CSSProperties {
  return { background: bg, color, border: 'none', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 };
}
