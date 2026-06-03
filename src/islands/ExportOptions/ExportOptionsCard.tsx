import React, { useCallback, useEffect, useState } from 'react';
import { readExportPrefs, writeExportPrefs, type ExportPrefs } from '../../lib/export-prefs';

// ATS-safe export + legacy-tier override toggles. Mounts in Settings ->
// Layout, just above the "Open Advanced -> Style" hand-off button (moved
// from Personal in v1.50.x). Collapsible, collapsed by default; the open
// state persists in localStorage so it survives React re-renders.
//
// When ATS is on, install-fetch-wrap.ts attaches ats:true to the outgoing
// _antcv_writing_style payload. The proxy worker then:
//   - adds an ATS-mode note to the system preamble (v1.50.1),
//   - converts Unicode glyphs to plain text labels in the response
//     (v1.50.2: phone/email/link/location/highlight).

const OPEN_KEY = 'antcv:exportOptionsOpen';

function readOpen(): boolean {
  try { return localStorage.getItem(OPEN_KEY) === '1'; } catch { return false; }
}
function writeOpen(open: boolean): void {
  try { localStorage.setItem(OPEN_KEY, open ? '1' : '0'); } catch { /* */ }
}

export function ExportOptionsCard(): JSX.Element {
  const [prefs, setPrefs] = useState<ExportPrefs>(() => readExportPrefs());
  const [open, setOpen] = useState<boolean>(() => readOpen());

  useEffect(() => {
    const refresh = () => setPrefs(readExportPrefs());
    window.addEventListener('antcv:export-prefs-changed', refresh);
    window.addEventListener('storage', (ev: StorageEvent) => {
      if (ev.key === 'personalInfo') refresh();
    });
    return () => {
      window.removeEventListener('antcv:export-prefs-changed', refresh);
    };
  }, []);

  const toggleAts = useCallback(() => {
    setPrefs(writeExportPrefs({ ats: !prefs.ats }));
  }, [prefs.ats]);

  const toggleLegacyTier = useCallback(() => {
    setPrefs(writeExportPrefs({ legacyAtsTier: !prefs.legacyAtsTier }));
  }, [prefs.legacyAtsTier]);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => {
      const next = !prev;
      writeOpen(next);
      return next;
    });
  }, []);

  // Count of active toggles, shown on the collapsed header so the user sees
  // at a glance whether anything is on without expanding.
  const activeCount = (prefs.ats ? 1 : 0) + (prefs.legacyAtsTier ? 1 : 0);

  return (
    <section
      data-antcv-react-island="export-options"
      style={{
        marginTop: 16,
        borderTop: '1px dashed rgba(255,255,255,.14)',
        paddingTop: 10,
        color: '#d7e6ee',
      }}
    >
      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: 0,
          background: 'transparent',
          border: 'none',
          color: '#d7e6ee',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          fontWeight: 800,
          marginBottom: open ? 8 : 0,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              transition: 'transform .15s ease',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            }}
          >
            {'\u25B6'}
          </span>
          Export options
        </span>
        {!open && activeCount > 0 ? (
          <span style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
            {activeCount} on
          </span>
        ) : null}
      </button>

      {open ? (
        <div>
          <Toggle
            label="ATS-safe generation"
            sub="The LLM is told to keep glyphs convertible to plain text. The worker converts the phone, email, link, location, and star glyphs to plain labels in the response."
            checked={prefs.ats}
            onToggle={toggleAts}
          />

          <Toggle
            label="Legacy ATS tier"
            sub="Force Calibri body for legacy parsers (Taleo pre-2018, iCIMS pre-2018, older SuccessFactors). Modern parsers handle the per-package body font without trouble; leave this off unless the target ATS is on the legacy list."
            checked={prefs.legacyAtsTier}
            onToggle={toggleLegacyTier}
          />

          <p style={{ fontSize: 11, opacity: 0.55, margin: '8px 0 0' }}>
            These toggles are stored under <code>personalInfo.exportPrefs</code>. The proxy worker reads them via the
            <code> _antcv_writing_style</code> payload that the React-islands fetch wrap injects on every LLM call.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function Toggle({
  label,
  sub,
  checked,
  onToggle,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onToggle: () => void;
}): JSX.Element {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        padding: '8px 10px',
        background: checked ? 'rgba(1,183,187,.08)' : 'rgba(255,255,255,.04)',
        border: '1px solid ' + (checked ? 'rgba(1,183,187,.45)' : 'rgba(255,255,255,.14)'),
        borderRadius: 8,
        cursor: 'pointer',
        marginBottom: 8,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ marginTop: 3, accentColor: '#01B7BB' }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <span style={{ fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 11, opacity: 0.75 }}>{sub}</span>
      </span>
    </label>
  );
}
