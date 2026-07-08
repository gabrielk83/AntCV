// JOB-TRACKER-001 Phase 3 — JobTracker island (V1 review/edit + V2 add-JD).
// Full-screen overlay panel over the vanilla app. Reads/writes the per-user
// job-tracker doc via the access-relay with rev-based optimistic concurrency.
// V3 (top-5 focus + generate/traceability) and V4 (drop→classify→envelope)
// land in a follow-up increment.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getDoc, putDoc, fetchJdUrl, tierOf, TRACKED_STATUSES, type TrackerDoc, type Row } from './api';

const NAVY = '#1F3864';
const bandHex = (b: string) => (/^[0-9A-Fa-f]{6}$/.test(b || '') ? '#' + b : '#ffffff');

function slug(s: string): string {
  return (s || 'row').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'row';
}

export function JobTracker({ onClose }: { onClose: () => void }): JSX.Element {
  const [doc, setDoc] = useState<TrackerDoc | null>(null);
  const [rev, setRev] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // add-JD state
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setErr(null);
    try {
      const s = await getDoc();
      setDoc(s.doc || { version: 2, rows: [], urls: {}, support: {}, artifacts: {} });
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

  function editRow(urlkey: string, idx: number, value: string): void {
    if (!doc) return;
    const next: TrackerDoc = { ...doc, rows: (doc.rows || []).map((r) => {
      if (r[11] !== urlkey) return r;
      const c = r.slice() as Row; c[idx] = value; return c;
    }) };
    setDoc(next); setDirty(true);
  }

  async function save(): Promise<void> {
    if (!doc) return;
    setSaving(true); setErr(null); setNote(null);
    try {
      const res = await putDoc(doc, rev);
      if (res.ok) { setRev(res.rev || rev + 1); setDirty(false); setNote('Saved ✓'); }
      else if (res.conflict) {
        // Someone/another device advanced the doc — reload the server copy so we
        // never clobber. (Row-level auto-merge is a later refinement.)
        setErr('Changed elsewhere since you opened it — reloaded the latest. Re-apply your edits.');
        setDoc(res.serverDoc || doc); setRev(res.serverRev || rev); setDirty(false);
      } else setErr(res.error || 'save failed');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setSaving(false); }
  }

  async function addFromUrl(): Promise<void> {
    const url = addUrl.trim();
    if (!url || !doc) return;
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
        ...doc,
        rows: [...(doc.rows || []), row],
        urls: { ...(doc.urls || {}), [uk]: url },
        support: { ...(doc.support || {}), [uk]: 'ROLE: ' + company + ' — ' + role + '\n\nJD:\n' + (jd.text || '').slice(0, 6000) },
      };
      setDoc(next); setDirty(true); setAddUrl('');
      setNote('Added "' + (role || company) + '". Review & Save.');
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setAdding(false); }
  }

  const cell: React.CSSProperties = { padding: '4px 6px', borderBottom: '1px solid #e3e8f0', fontSize: 12, verticalAlign: 'top' };
  const th: React.CSSProperties = { ...cell, background: NAVY, color: '#fff', position: 'sticky', top: 0, fontWeight: 600, textAlign: 'left' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,22,40,0.55)', zIndex: 99999, display: 'flex', flexDirection: 'column' }}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}>
      <div style={{ background: '#fff', margin: '2vh auto', width: 'min(1120px, 96vw)', height: '96vh', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.4)' }}>
        {/* header */}
        <div style={{ background: NAVY, color: '#fff', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong style={{ fontSize: 15 }}>Job Tracker</strong>
          <span style={{ opacity: 0.8, fontSize: 12 }}>rev {rev}{dirty ? ' · unsaved' : ''}</span>
          <span style={{ flex: 1 }} />
          <button onClick={() => void load()} disabled={saving} style={btn('#ffffff22')}>Reload</button>
          <button onClick={() => void save()} disabled={!dirty || saving} style={btn(dirty ? '#2e7d32' : '#ffffff22')}>{saving ? 'Saving…' : 'Save'}</button>
          <button onClick={onClose} style={btn('#ffffff22')}>Close ✕</button>
        </div>

        {/* add-JD bar (V2) */}
        <div style={{ padding: '8px 16px', borderBottom: '1px solid #e3e8f0', display: 'flex', gap: 8, alignItems: 'center', background: '#f6f8fc' }}>
          <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="Paste a job URL (LinkedIn, Jobindex, careers page…) to add it"
            style={{ flex: 1, padding: '6px 10px', border: '1px solid #c3ccdb', borderRadius: 6, fontSize: 13 }}
            onKeyDown={(e) => { if (e.key === 'Enter') void addFromUrl(); }} />
          <button onClick={() => void addFromUrl()} disabled={adding || !addUrl.trim()} style={btn(NAVY, '#fff')}>{adding ? 'Fetching…' : 'Add JD'}</button>
        </div>

        {(err || note) && (
          <div style={{ padding: '6px 16px', fontSize: 12, color: err ? '#b3261e' : '#2e7d32', background: err ? '#fdecea' : '#eaf5ea' }}>{err || note}</div>
        )}

        {/* list (V1) */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {loading ? <div style={{ padding: 24 }}>Loading…</div> : (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <thead><tr>
                {['#', 'Tier', 'Company', 'Role', 'Location', 'Tracked status', 'Next action', 'Flag / notes', 'Link'].map((h) => <th key={h} style={th}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r) => {
                  const uk = r[11];
                  return (
                    <tr key={uk} style={{ background: bandHex(r[12]) }}>
                      <td style={{ ...cell, textAlign: 'center', fontWeight: 700 }}>{r[0]}</td>
                      <td style={{ ...cell, textAlign: 'center' }}>{tierOf(r[12])}</td>
                      <td style={{ ...cell, fontWeight: 600 }}>{r[1]}</td>
                      <td style={cell}>{r[2]}</td>
                      <td style={cell}>{r[3]}</td>
                      <td style={cell}>
                        <select value={r[8]} onChange={(e) => editRow(uk, 8, e.target.value)} style={{ fontSize: 12, maxWidth: 150 }}>
                          {TRACKED_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                          {!TRACKED_STATUSES.includes(r[8]) && r[8] ? <option value={r[8]}>{r[8]}</option> : null}
                        </select>
                      </td>
                      <td style={cell}><input value={r[9]} onChange={(e) => editRow(uk, 9, e.target.value)} style={inp} /></td>
                      <td style={cell}><input value={r[10]} onChange={(e) => editRow(uk, 10, e.target.value)} style={inp} /></td>
                      <td style={{ ...cell, textAlign: 'center' }}>{doc?.urls?.[uk] ? <a href={doc.urls[uk]} target="_blank" rel="noreferrer" style={{ color: NAVY }}>Open ↗</a> : ''}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td style={cell} colSpan={9}>No rows yet — paste a job URL above to add one.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '6px 16px', fontSize: 11, color: '#667', borderTop: '1px solid #e3e8f0' }}>
          {rows.length} roles · edits save to the cloud tracker and sync to your Excel. Top-5 focus + generate coming next.
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', border: '1px solid #d3dae6', borderRadius: 4 };
function btn(bg: string, color = '#fff'): React.CSSProperties {
  return { background: bg, color, border: 'none', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 600 };
}
