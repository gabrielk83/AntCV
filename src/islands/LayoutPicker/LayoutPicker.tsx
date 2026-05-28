import React, { useMemo, useState } from 'react';
import { ACADEMIC_SECTIONS, KNOWN_SECTIONS, type LayoutPrefs } from '../../lib/writing-prefs';
import { SectionFormatPicker, useLayoutPrefsSnapshot } from './SectionFormatPicker';

// v1.50.26 — count how many sections in `ids` carry either a line-
// limit or section-format override. Used to surface the "n tuned"
// badge in each group header so the user can see at a glance how
// many overrides they have set without expanding the section.
function countOverrides(layout: LayoutPrefs, ids: readonly string[]): number {
  const ll = layout.lineLimits || {};
  const sf = layout.sectionFormats || {};
  let n = 0;
  for (const id of ids) {
    if (typeof ll[id] === 'number' || typeof sf[id] === 'string') n++;
  }
  return n;
}

function OverrideBadge({ count, total }: { count: number; total: number }): JSX.Element | null {
  if (count <= 0) return null;
  return (
    <span
      title={`${count} of ${total} sections have overrides`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
        padding: '1px 6px',
        borderRadius: 999,
        background: 'rgba(1,183,187,.18)',
        border: '1px solid rgba(1,183,187,.55)',
        color: '#e6eef3',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0,
        textTransform: 'none',
      }}
    >
      <span aria-hidden="true">●</span>
      {count} tuned
    </span>
  );
}

// v1.50.14 — section-by-section format + line-limit picker. Mounted as a
// distinct island in Settings → Personal (between WritingStylePicker and
// ExportOptions). Each row uses the reusable SectionFormatPicker which
// can also live inside the editor's per-section toolbar in a later cut.
//
// Plan §7 Pass 4 step 21 (per-section line slider + section format
// selector promoted from the wizard step 10 into a reusable component).

export function LayoutPicker(): JSX.Element {
  const { layout, styleId, styleLabel } = useLayoutPrefsSnapshot();

  // v1.50.15 — research-formal is now active. The academic-section group
  // is collapsed by default so the panel stays scannable; expand when
  // the user wants per-section overrides for an academic CV.
  const isResearch = styleId === 'research-formal';
  const [academicOpen, setAcademicOpen] = useState<boolean>(isResearch);

  // v1.50.26 — override counts per group. Drives the "N tuned" badges
  // in each group header. Re-computed when layout state changes (the
  // hook resubscribes to antcv:layout-prefs-changed).
  const commercialOverrides = useMemo(
    () => countOverrides(layout, KNOWN_SECTIONS.map((s) => s.id)),
    [layout],
  );
  const academicOverrides = useMemo(
    () => countOverrides(layout, ACADEMIC_SECTIONS.map((s) => s.id)),
    [layout],
  );

  return (
    <section
      data-antcv-react-island="layout-picker"
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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Section layout</span>
        <span style={{ fontSize: 11, opacity: 0.6, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
          {styleLabel} · {layout.targetPages} page{layout.targetPages === 1 ? '' : 's'}
        </span>
      </div>

      <p style={{ fontSize: 11, opacity: 0.65, margin: '0 0 8px' }}>
        Per-section overrides. The format picker maps to the 9 layouts in plan §4.4. The slider hint passes through to
        the proxy worker preamble as <code>sectionLineLimits</code>; the worker interprets the number per section type
        (lines for paragraph sections, bullets per role for experience, etc.). Reset (↺) drops the override and falls
        back to the active style&apos;s default.
      </p>

      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', opacity: 0.75, margin: '6px 0 4px', display: 'flex', alignItems: 'center' }}>
        <span>Commercial sections</span>
        <OverrideBadge count={commercialOverrides} total={KNOWN_SECTIONS.length} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {KNOWN_SECTIONS.map((s) => (
          <SectionFormatPicker
            key={s.id}
            sectionId={s.id}
            label={s.label}
            styleId={styleId}
            targetPages={layout.targetPages}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={() => setAcademicOpen((v) => !v)}
        aria-expanded={academicOpen ? 'true' : 'false'}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0 4px',
          margin: '12px 0 4px',
          background: 'transparent',
          border: 0,
          color: '#d7e6ee',
          cursor: 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '.06em',
          fontWeight: 700,
          fontSize: 11,
          opacity: 0.85,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <span aria-hidden="true">{academicOpen ? '▾' : '▸'}</span>
          <span style={{ marginLeft: 6 }}>Academic sections</span>
          <OverrideBadge count={academicOverrides} total={ACADEMIC_SECTIONS.length} />
          {isResearch && (
            <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.7, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
              (active style uses these)
            </span>
          )}
        </span>
        <span style={{ fontSize: 10, opacity: 0.55, fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>
          {ACADEMIC_SECTIONS.length} sections
        </span>
      </button>
      {academicOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ACADEMIC_SECTIONS.map((s) => (
            <SectionFormatPicker
              key={s.id}
              sectionId={s.id}
              label={s.label}
              styleId={styleId}
              targetPages={layout.targetPages}
            />
          ))}
        </div>
      )}
    </section>
  );
}
