import React, { useCallback, useEffect, useState } from 'react';
import { readExportPrefs, writeExportPrefs, type ExportPrefs } from '../../lib/export-prefs';

// ATS-safe export + legacy-tier override toggles. Mounts in Settings →
// Personal alongside the WritingStylePicker / PackagePicker / LanguageCard.
// When ATS is on, install-fetch-wrap.ts attaches ats:true to the outgoing
// _antcv_writing_style payload. The proxy worker then:
//   - adds an ATS-mode note to the system preamble (v1.50.1),
//   - converts Unicode glyphs to plain text labels in the response
//     (v1.50.2: ☎→Phone:, ✉→Email:, 🔗→Link:, ⌂→Location:, ★→Highlight:).

export function ExportOptionsCard(): JSX.Element {
  const [prefs, setPrefs] = useState<ExportPrefs>(() => readExportPrefs());

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
      <div
        style={{
          textTransform: 'uppercase',
          letterSpacing: '.08em',
          fontWeight: 800,
          marginBottom: 8,
        }}
      >
        Export options
      </div>

      <Toggle
        label="ATS-safe generation"
        sub="The LLM is told to keep glyphs convertible to plain text. The worker converts ☎ ✉ 🔗 ⌂ ★ to “Phone:”, “Email:”, “Link:”, “Location:”, “Highlight:” in the response."
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
