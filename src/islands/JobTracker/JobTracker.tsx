// JOB-TRACKER-001 Phase 3 — JobTracker island.
// V1 review/edit list · V2 add-JD · V3 Top-5 focus + prepare/open a traceable
// saved application · V4 drop → why → classify → Dream Envelope learning.
// Full-screen overlay over the vanilla app; reads/writes the per-user tracker
// doc via the relay with rev-based optimistic concurrency.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getDoc, putDoc, fetchJdUrl, createApplication, setActive, classifyReason,
  tierOf, TRACKED_STATUSES, type TrackerDoc, type Row,
} from './api';

const NAVY = '#1F3864';
const bandHex = (b: string) => (/^[0-9A-Fa-f]{6}$/.test(b || '') ? '#' + b : '#ffffff');
const today = () => new Date().toISOString().slice(0, 10);
function slug(s: string): string {
  return (s || 'row').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'row';
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

  const rows = useMemo<Row[]>(() => {
    const r = (doc?.rows || []).slice();
    r.sort((a, b) => (Number(a[0]) || 99) - (Number(b[0]) || 99));
    return r;
  }, [doc]);
  const top5 = useMemo(() => rows.filter((r) => (Number(r[0]) || 99) <= 5).slice(0, 5), [rows]);

  function editRow(uk: string, idx: number, value: string): void {
    if (!doc) return;
    setDocState({ ...doc, rows: (doc.rows || []).map((r) => { if (r[11] !== uk) return r; const c = r.slice() as Row; c[idx] = value; return c; }) });
    setDirty(true);
  }

  // Persist the whole doc with optimistic concurrency; returns success.
  const persist = useCallback(async (next: TrackerDoc, quiet = false): Promise<boolean> => {
    const res = await putDoc(next, rev);
    if (res.ok) { setRev(res.rev || rev + 1); setDocState(next); setDirty(false); if (!quiet) setNote('Saved ✓'); return true; }
    if (res.conflict) { setErr('Changed elsewhere — reloaded latest, re-apply your edit.'); setDocState(res.serverDoc || next); setRev(res.serverRev || rev); setDirty(false); return false; }
    setErr(res.error || 'save failed'); return false;
  }, [rev]);

  async function save(): Promise<void> { if (!doc) return; setSaving(true); setErr(null); setNote(null); try { await persist(doc); } finally { setSaving(false); } }

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
      const uk = slug(company + '-' + role) + '-' + String(Date.now()).slice(-4);
      const maxRank = Math.max(0, ...(doc.rows || []).map((r) => Number(r[0]) || 0));
      const row: Row = [maxRank + 1, company, role, '', '', '', '', 'OPEN', 'Not started', '', 'Added from URL', uk, 'E2EFDA'];
      const next: TrackerDoc = {
        ...doc, rows: [...(doc.rows || []), row],
        urls: { ...(doc.urls || {}), [uk]: url },
        jd: { ...(doc.jd || {}), [uk]: jd.text || '' },
        support: { ...(doc.support || {}), [uk]: 'ROLE: ' + company + ' — ' + role },
      };
      setDocState(next); setDirty(true); setAddUrl(''); setNote('Added "' + (role || company) + '". Review & Save.');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setAdding(false); }
  }

  // V3 — seed a real saved application from the row's JD + support/envelope, set
  // it active, record application_id on the row, then open it in preview.
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
      if (!jd || jd.length < 200) { setErr('No JD text available for this role — add the DIRECT posting URL first (careers-index pages don\'t yield a JD).'); return; }
      const envText = (d.envelope || []).map((e) => e[0] + ': ' + e[1] + (e[2] ? ' — ' + e[2] : '')).join('\n');
      const supporting = 'TARGET-ROLE GUIDELINES (Dream Envelope):\n' + envText + '\n\nROLE INTEL:\n' + ((d.support || {})[uk] || '');
      const id = await createApplication({ jd_text: jd, jd_company: row[1], jd_role: row[2], supporting_context: supporting });
      if (!id) { setErr('Could not create the application.'); return; }
      const next: TrackerDoc = { ...d, artifacts: { ...(d.artifacts || {}), [uk]: { application_id: id, generated_at: Date.now() } } };
      await setActive(id);
      const ok = await persist(next, true);
      if (!ok) return;
      // Open it: the app loads the active application into preview on boot.
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

  // V4 — drop → why → classify → append a dated learning to the envelope dimension.
  async function dropFromTop5(row: Row): Promise<void> {
    if (!doc) return;
    const reason = window.prompt('Why are you dropping ' + row[1] + '?');
    if (!reason || !reason.trim()) return;
    const uk = row[11]; setBusyKey(uk); setErr(null); setNote(null);
    try {
      const dim = classifyReason(reason);
      const env = (doc.envelope || []).map((e) => {
        if (e[0] !== dim) return e;
        const c = e.slice(); c[3] = String(c[3] || '') + '  •  [' + today() + '] dropped ' + row[1] + ': ' + reason.trim(); return c;
      });
      const rowsNext = (doc.rows || []).map((r) => {
        if (r[11] !== uk) return r;
        const c = r.slice() as Row; c[8] = 'Archive / closed'; c[10] = 'Dropped (' + dim + '): ' + reason.trim(); c[12] = 'D9D9D9'; return c;
      });
      const next: TrackerDoc = { ...doc, envelope: env, rows: rowsNext };
      const ok = await persist(next, true);
      if (ok) setNote('Dropped ' + row[1] + '. Envelope learning added → ' + dim + '.');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusyKey(null); }
  }

  const cell: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid #e3e8f0', fontSize: 12, verticalAlign: 'top' };
  const th: React.CSSProperties = { ...cell, background: NAVY, color: '#fff', position: 'sticky', top: 0, fontWeight: 600, textAlign: 'left' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,22,40,0.55)', zIndex: 99999, display: 'flex' }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div style={{ background: '#fff', margin: '2vh auto', width: 'min(1120px, 96vw)', height: '96vh', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        <div style={{ background: NAVY, color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <strong style={{ fontSize: 15 }}>Job Tracker</strong>
          <span style={{ opacity: 0.8, fontSize: 12 }}>rev {rev}{dirty ? ' · unsaved' : ''}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => setView('list')} style={btn(view === 'list' ? '#ffffff33' : 'transparent')}>List</button>
          <button onClick={() => setView('top5')} style={btn(view === 'top5' ? '#ffffff33' : 'transparent')}>Top 5</button>
          <span style={{ width: 8 }} />
          <button onClick={() => void load()} disabled={saving} style={btn('#ffffff22')}>Reload</button>
          <button onClick={() => void save()} disabled={!dirty || saving} style={btn(dirty ? '#2e7d32' : '#ffffff22')}>{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} style={btn('#ffffff22')}>Close ✕</button>
        </div>

        {view === 'list' && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #e3e8f0', display: 'flex', gap: 8, alignItems: 'center', background: '#f6f8fc' }}>
            <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="Paste a job URL to add it (fetches the JD into the list)"
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #c3ccdb', borderRadius: 6, fontSize: 13 }} onKeyDown={(e) => { if (e.key === 'Enter') void addFromUrl(); }} />
            <button onClick={() => void addFromUrl()} disabled={adding || !addUrl.trim()} style={btn(NAVY)}>{adding ? 'Fetching…' : 'Add JD'}</button>
          </div>
        )}

        {(err || note) && <div style={{ padding: '6px 16px', fontSize: 12, color: err ? '#b3261e' : '#2e7d32', background: err ? '#fdecea' : '#eaf5ea' }}>{err || note}</div>}

        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? <div style={{ padding: 24 }}>Loading…</div> : view === 'list' ? (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>{['#', 'Tier', 'Company', 'Role', 'Location', 'JD', 'Tracked status', 'Next action', 'Flag / notes', 'Link'].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r) => {
                  const uk = r[11]; const hasJd = ((doc?.jd || {})[uk] || '').length > 200;
                  return (
                    <tr key={uk} style={{ background: bandHex(r[12]) }}>
                      <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{r[0]}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>{tierOf(r[12])}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>{r[1]}</td>
                      <td style={cell}>{r[2]}</td>
                      <td style={cell}>{r[3]}</td>
                      <td style={{ ...cell, textAlign: 'center' }} title={hasJd ? 'JD stored' : 'No JD — add a direct posting URL'}>{hasJd ? '✓' : '—'}</td>
                      <td style={cell}><select value={r[8]} onChange={(e) => editRow(uk, 8, e.target.value)} style={{ fontSize: 12, maxWidth: 150 }}>{TRACKED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}{!TRACKED_STATUSES.includes(r[8]) && r[8] ? <option value={r[8]}>{r[8]}</option> : null}</select></td>
                      <td style={cell}><input value={r[9]} onChange={(e) => editRow(uk, 9, e.target.value)} style={inp} /></td>
                      <td style={cell}><input value={r[10]} onChange={(e) => editRow(uk, 10, e.target.value)} style={inp} /></td>
                      <td style={{ ...cell, textAlign: 'center' }}>{doc?.urls?.[uk] ? <a href={doc.urls[uk]} target="_blank" rel="noreferrer" style={{ color: NAVY }}>Open ↗</a> : ''}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td style={cell} colSpan={10}>No rows yet — paste a job URL above.</td></tr>}
              </tbody>
            </table>
          ) : (
            <div style={{ padding: 14, display: 'grid', gap: 14 }}>
              {top5.map((r) => <FocusCard key={r[11]} row={r} doc={doc} busy={busyKey === r[11]}
                onPrepare={() => void prepareAndOpen(r)} onOpen={() => void openSaved(r)} onDrop={() => void dropFromTop5(r)} />)}
              {top5.length === 0 && <div>No Top-5 roles yet.</div>}
            </div>
          )}
        </div>
        <div style={{ padding: '6px 16px', fontSize: 11, color: '#667', borderTop: '1px solid #e3e8f0' }}>
          {rows.length} roles · {Object.values(doc?.jd || {}).filter((t) => (t || '').length > 200).length} with JD · edits sync to your Excel.
        </div>
      </div>
    </div>
  );
}

function FocusCard({ row, doc, busy, onPrepare, onOpen, onDrop }: {
  row: Row; doc: TrackerDoc | null; busy: boolean; onPrepare: () => void; onOpen: () => void; onDrop: () => void;
}): JSX.Element {
  const uk = row[11];
  const support = (doc?.support || {})[uk] || '';
  const hasJd = ((doc?.jd || {})[uk] || '').length > 200;
  const saved = doc?.artifacts?.[uk]?.application_id;
  const url = doc?.urls?.[uk];
  return (
    <div style={{ border: '1px solid #d5deec', borderLeft: '4px solid ' + NAVY, borderRadius: 8, padding: '12px 14px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <strong style={{ fontSize: 14, color: NAVY }}>#{row[0]} {row[1]}</strong>
        <span style={{ fontSize: 13 }}>{row[2]}</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: hasJd ? '#2e7d32' : '#b3261e' }}>{hasJd ? 'JD ✓' : 'JD missing'}</span>
      </div>
      <div style={{ fontSize: 11, color: '#556', margin: '2px 0 8px' }}>{row[3]}{row[4] ? ' · ' + row[4] : ''}{url ? <> · <a href={url} target="_blank" rel="noreferrer" style={{ color: NAVY }}>posting ↗</a></> : null}</div>
      <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12, lineHeight: 1.4, color: '#2a3244', margin: 0, maxHeight: 220, overflow: 'auto', background: '#f7f9fc', padding: 8, borderRadius: 6 }}>{support || '(no intel yet)'}</pre>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        {saved
          ? <button onClick={onOpen} disabled={busy} style={btn('#2e7d32')}>{busy ? '…' : 'Open in preview'}</button>
          : <button onClick={onPrepare} disabled={busy} style={btn(NAVY)}>{busy ? 'Preparing…' : 'Prepare & open in AntCV'}</button>}
        <button onClick={onDrop} disabled={busy} style={btn('#eef1f6', '#7a2618')}>Drop from Top 5</button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', border: '1px solid #d3dae6', borderRadius: 4 };
function btn(bg: string, color = '#fff'): React.CSSProperties {
  return { background: bg, color, border: 'none', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 };
}
