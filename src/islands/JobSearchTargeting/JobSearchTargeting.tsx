// CLUSTER-QUAL-001 (owner 2026-06-19): "Job search targeting" preference card —
// WHERE (region/country), WHICH model (employed / independent consultant) and WHICH
// format (onsite / hybrid / remote). Feeds the demand model (antcv-cluster-demand.js)
// + the nightly recruitment-site research so the per-cluster top-20s get more targeted.
//
// Multi-select throughout (a user can target several regions / both models / multiple
// formats). Persists immediately via writeJobSearchPrefs (cloud-synced).

import React, { useCallback, useEffect, useState } from 'react';
import {
  EMPLOYMENT_OPTIONS,
  FORMAT_OPTIONS,
  REGION_OPTIONS,
  readJobSearchPrefs,
  writeJobSearchPrefs,
  type JobSearchPrefs,
} from '../../lib/job-search-prefs';

const HEADER_STYLE: React.CSSProperties = {
  fontFamily: 'Georgia, serif',
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.4px',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.55)',
  margin: '0 0 8px',
};

const SUBLABEL_STYLE: React.CSSProperties = {
  fontSize: 10.5,
  letterSpacing: '0.3px',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,.40)',
  margin: '10px 0 6px',
};

function chipStyle(on: boolean): React.CSSProperties {
  return {
    display: 'inline-block',
    padding: '5px 11px',
    margin: '0 6px 6px 0',
    borderRadius: 999,
    fontSize: 12,
    lineHeight: 1.2,
    cursor: 'pointer',
    userSelect: 'none',
    border: on ? '1px solid rgba(0,183,187,.85)' : '1px solid rgba(255,255,255,.16)',
    background: on ? 'rgba(0,183,187,.18)' : 'rgba(255,255,255,.05)',
    color: on ? '#bdf3f4' : 'rgba(255,255,255,.72)',
    transition: 'background .12s,border-color .12s,color .12s',
  };
}

function Chip(props: { label: string; on: boolean; onClick: () => void }): React.ReactElement {
  return (
    <span
      role="checkbox"
      aria-checked={props.on}
      tabIndex={0}
      style={chipStyle(props.on)}
      onClick={props.onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); props.onClick(); } }}
    >
      {props.label}
    </span>
  );
}

function toggleVal<T extends string>(list: T[], id: T): T[] {
  return list.includes(id) ? list.filter((x) => x !== id) : list.concat(id);
}

const EXPANDED_KEY = 'antcv:jobSearchTargeting:expanded';

export function JobSearchTargeting(): React.ReactElement {
  const [prefs, setPrefs] = useState<JobSearchPrefs>(() => readJobSearchPrefs());
  // Collapsible, DEFAULT COLLAPSED (owner 2026-06-19). Remembers the user's choice.
  const [open, setOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(EXPANDED_KEY) === '1'; } catch { return false; }
  });
  const toggle = useCallback(() => {
    setOpen((v) => { const n = !v; try { localStorage.setItem(EXPANDED_KEY, n ? '1' : '0'); } catch { /* */ } return n; });
  }, []);

  // Re-read if another surface (wizard / kernel settings) or a cloud restore writes.
  useEffect(() => {
    const sync = () => setPrefs(readJobSearchPrefs());
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail as JobSearchPrefs | undefined;
      setPrefs(d ?? readJobSearchPrefs());
    };
    window.addEventListener('antcv:job-search-prefs-changed', onChange);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('antcv:job-search-prefs-changed', onChange);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const patch = useCallback((p: Partial<JobSearchPrefs>) => {
    setPrefs((prev) => ({ ...prev, ...p }));   // optimistic
    writeJobSearchPrefs(p);
  }, []);

  const nSel = prefs.regions.length + prefs.employment.length + prefs.formats.length;
  const summary = nSel ? `${nSel} selected` : 'none set';

  return (
    <div data-antcv-react-mount="job-search-targeting" style={{ padding: '2px 0 4px' }}>
      <button type="button" onClick={toggle} aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: 0, margin: 0,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ ...HEADER_STYLE, margin: 0 }}>Job search targeting</span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,.4)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .12s' }}>▶</span>
        {!open && <span style={{ fontSize: 10.5, color: 'rgba(0,183,187,.7)', marginLeft: 'auto' }}>{summary}</span>}
      </button>
      {!open ? null : (<>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,.45)', margin: '6px 0 4px', lineHeight: 1.45 }}>
        Sharpens the most-demanded-skills ranking for your target market. Pick any that apply.
      </div>

      <div style={SUBLABEL_STYLE}>Where (region / country)</div>
      <div>
        {REGION_OPTIONS.map((r) => (
          <Chip key={r.id} label={r.label} on={prefs.regions.includes(r.id)}
            onClick={() => patch({ regions: toggleVal(prefs.regions, r.id) })} />
        ))}
      </div>

      <div style={SUBLABEL_STYLE}>Employment model</div>
      <div>
        {EMPLOYMENT_OPTIONS.map((o) => (
          <Chip key={o.id} label={o.label} on={prefs.employment.includes(o.id)}
            onClick={() => patch({ employment: toggleVal(prefs.employment, o.id) })} />
        ))}
      </div>

      <div style={SUBLABEL_STYLE}>Work format</div>
      <div>
        {FORMAT_OPTIONS.map((o) => (
          <Chip key={o.id} label={o.label} on={prefs.formats.includes(o.id)}
            onClick={() => patch({ formats: toggleVal(prefs.formats, o.id) })} />
        ))}
      </div>
      </>)}
    </div>
  );
}
