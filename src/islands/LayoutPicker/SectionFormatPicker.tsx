import React, { useCallback, useEffect, useState } from 'react';
import {
  LINE_LIMIT_MAX,
  LINE_LIMIT_MIN,
  SECTION_FORMAT_OPTIONS,
  clearSectionFormat,
  clearSectionLineLimit,
  defaultLineLimitFor,
  defaultLineMinFor,
  readLayoutPrefs,
  readSectionFormat,
  readSectionLineLimit,
  readSectionLineMin,
  readWritingPrefs,
  writeSectionFormat,
  writeSectionLineLimit,
  writeSectionLineMin,
  type LayoutPrefs,
} from '../../lib/writing-prefs';
import { STYLES, type StyleId } from '../../lib/writing-systems';

// v1.50.14 — reusable per-section picker. One row per section, used by
// the LayoutPicker island (Settings → Personal) and (in a future cut)
// the per-section inline controls inside the editor. Plan §7 Pass 4
// step 21.
//
// Props:
//   sectionId   — the canonical section key (profile, experience, …)
//   label       — display name
//   styleId     — active writing style (for default-resolution)
//   targetPages — active target-pages (for default-resolution)
//   compact     — when true, renders inline (no own border / padding)
//
// On any user input the helpers in writing-prefs.ts persist immediately
// to personalInfo.layoutPrefs and emit `antcv:layout-prefs-changed` so
// any other listener (worker fetch wrap on next gen, breadcrumbs) picks
// up the new state.

export interface SectionFormatPickerProps {
  sectionId: string;
  label: string;
  styleId: StyleId;
  targetPages: number;
  compact?: boolean;
}

// v1.50.17 — native <option> elements need explicit background + color
// or they render with OS-default light menu colors against our dark
// theme. Same constant used elsewhere in the React-islands UI.
const DARK_OPTION_STYLE: React.CSSProperties = {
  background: '#283556',
  color: '#e6eef3',
};

// v1.50.541 — Selected Outcomes "Results" mode. The app.js Layout toggle that
// used to control this (Bullets section / Inline results) is now hidden; its
// store (`outcomesMode`: 'section' | 'results') is driven from THIS dropdown
// instead, with a "Results (inline, per role)" option. 'results' renders each
// role's outcomes as a bold "Results:" line; the line-limit then means results
// PER ROLE (default 2, vs the section's total of 3).
function readOutcomesMode(): 'results' | 'section' {
  try { return JSON.parse(localStorage.getItem('outcomesMode') || '"section"') === 'results' ? 'results' : 'section'; } catch { return 'section'; }
}
function writeOutcomesMode(m: 'results' | 'section'): void {
  try { localStorage.setItem('outcomesMode', JSON.stringify(m)); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'outcomes-mode' } })); } catch { /* */ }
}

export function SectionFormatPicker({
  sectionId,
  label,
  styleId,
  targetPages,
  compact = false,
}: SectionFormatPickerProps): JSX.Element {
  // v1.50.544 — both the commercial Selected Outcomes AND the academic Selected
  // Research Outcomes support the inline "Results (per role/experience)" mode.
  const isOutcomes = sectionId === 'selected_outcomes' || sectionId === 'selected_research_outcomes';
  const [lineLimit, setLineLimit] = useState<number>(() => readSectionLineLimit(sectionId));
  const [lineMin, setLineMin] = useState<number>(() => readSectionLineMin(sectionId));
  const [format, setFormat] = useState<string>(() => readSectionFormat(sectionId));
  const [outcomesMode, setOutcomesModeState] = useState<'results' | 'section'>(() => readOutcomesMode());

  // Refresh on external mutation (other tabs, programmatic resets).
  useEffect(() => {
    const refresh = () => {
      setLineLimit(readSectionLineLimit(sectionId));
      setLineMin(readSectionLineMin(sectionId));
      setFormat(readSectionFormat(sectionId));
      if (isOutcomes) setOutcomesModeState(readOutcomesMode());
    };
    window.addEventListener('antcv:layout-prefs-changed', refresh);
    window.addEventListener('antcv:writing-prefs-changed', refresh); // style change → default recompute
    if (isOutcomes) window.addEventListener('antcv:sections-updated', refresh);
    return () => {
      window.removeEventListener('antcv:layout-prefs-changed', refresh);
      window.removeEventListener('antcv:writing-prefs-changed', refresh);
      if (isOutcomes) window.removeEventListener('antcv:sections-updated', refresh);
    };
  }, [sectionId, isOutcomes]);

  // D — dual range. The MAX (upper thumb) never drops below the MIN, and the
  // MIN (lower thumb) never rises above the MAX; each push the other if needed.
  const onLineChange = useCallback((v: number) => {
    setLineLimit(v);
    writeSectionLineLimit(sectionId, v);
    if (v < lineMin) { setLineMin(v); writeSectionLineMin(sectionId, v); }
  }, [sectionId, lineMin]);
  const onMinChange = useCallback((v: number) => {
    const clamped = Math.min(v, lineLimit);
    setLineMin(clamped);
    writeSectionLineMin(sectionId, clamped);
  }, [sectionId, lineLimit]);

  const onFormatChange = useCallback((v: string) => {
    // Selected Outcomes: the special "results" value drives the outcomesMode
    // store (inline per-role "Results:" line) rather than a section format.
    if (isOutcomes) {
      if (v === 'results') {
        writeOutcomesMode('results');
        setOutcomesModeState('results');
        // default the per-role count to 2 (vs the section's 3) if not overridden.
        if (typeof readLayoutPrefs().lineLimits?.[sectionId] !== 'number') {
          writeSectionLineLimit(sectionId, 2);
          setLineLimit(2);
        }
        return;
      }
      if (outcomesMode === 'results') { writeOutcomesMode('section'); setOutcomesModeState('section'); }
    }
    setFormat(v);
    writeSectionFormat(sectionId, v);
  }, [sectionId, isOutcomes, outcomesMode]);

  // What the dropdown shows: 'results' wins for Selected Outcomes in results mode.
  const selectValue = isOutcomes && outcomesMode === 'results' ? 'results' : format;

  const onReset = useCallback(() => {
    clearSectionLineLimit(sectionId);   // clears both min + max overrides
    clearSectionFormat(sectionId);
    setLineLimit(defaultLineLimitFor(styleId, targetPages));
    setLineMin(defaultLineMinFor(styleId, targetPages));
    setFormat(readSectionFormat(sectionId));
  }, [sectionId, styleId, targetPages]);

  // The reset button is only visible when an override exists for either
  // axis — the rest of the time the section is already at its style-
  // default.
  const overrideActive = (() => {
    const lp = readLayoutPrefs();
    return (
      typeof lp.lineLimits?.[sectionId] === 'number' ||
      typeof lp.sectionFormats?.[sectionId] === 'string'
    );
  })();

  return (
    <div
      data-antcv-section-format-picker={sectionId}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 8,
        padding: compact ? '4px 0' : '8px 10px',
        background: compact ? 'transparent' : 'rgba(255,255,255,.04)',
        border: compact ? 0 : '1px solid rgba(255,255,255,.10)',
        borderRadius: compact ? 0 : 8,
        marginBottom: compact ? 0 : 6,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {/* v1.50.26 — override-active dot. Visible only when this
              section has a line-limit or format override set, so the
              user can see at a glance which rows are tuned vs at
              style defaults. Mirrors the existing reset-button enable
              state on the right edge of the row. */}
          {overrideActive && (
            <span
              aria-hidden="true"
              title="Override active"
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: '#01B7BB',
                boxShadow: '0 0 0 1px rgba(1,183,187,.45)',
                flex: '0 0 auto',
              }}
            />
          )}
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={selectValue}
            onChange={(e) => onFormatChange(e.currentTarget.value)}
            aria-label={`${label} format`}
            style={{
              flex: '0 0 auto',
              minWidth: 140,
              padding: '4px 6px',
              background: 'rgba(0,0,0,.18)',
              color: '#e6eef3',
              border: '1px solid rgba(255,255,255,.18)',
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: 11,
            }}
          >
            {isOutcomes && (
              <option value="results" style={DARK_OPTION_STYLE}>Results (inline, per role)</option>
            )}
            {SECTION_FORMAT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} style={DARK_OPTION_STYLE}>{o.label}</option>
            ))}
          </select>
          {/* D — dual min/max range. The lower (min) thumb sets the floor, the
              upper (max) the cap; defaults fit the active writing style. */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9.5, opacity: 0.55, width: 24, flex: '0 0 auto' }}>min</span>
              <input
                type="range"
                min={LINE_LIMIT_MIN}
                max={LINE_LIMIT_MAX}
                step={1}
                value={lineMin}
                onChange={(e) => onMinChange(Number(e.currentTarget.value))}
                aria-label={`${label} minimum lines`}
                style={{ flex: 1, minWidth: 70, accentColor: '#8aa0c8' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9.5, opacity: 0.55, width: 24, flex: '0 0 auto' }}>max</span>
              <input
                type="range"
                min={LINE_LIMIT_MIN}
                max={LINE_LIMIT_MAX}
                step={1}
                value={lineLimit}
                onChange={(e) => onLineChange(Number(e.currentTarget.value))}
                aria-label={`${label} maximum lines`}
                style={{ flex: 1, minWidth: 70, accentColor: '#01B7BB' }}
              />
            </div>
            <span style={{ fontSize: 11, opacity: 0.75, textAlign: 'right' }}>
              {lineMin}–{lineLimit}{isOutcomes && outcomesMode === 'results' ? '/role' : ''}
            </span>
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onReset}
        disabled={!overrideActive}
        aria-label={`Reset ${label} to style defaults`}
        title={overrideActive ? 'Reset to style defaults' : 'No overrides active'}
        style={{
          alignSelf: 'center',
          padding: '4px 8px',
          background: overrideActive ? 'rgba(1,183,187,.12)' : 'transparent',
          color: '#e6eef3',
          opacity: overrideActive ? 1 : 0.35,
          border: '1px solid ' + (overrideActive ? 'rgba(1,183,187,.45)' : 'rgba(255,255,255,.14)'),
          borderRadius: 6,
          cursor: overrideActive ? 'pointer' : 'not-allowed',
          fontSize: 11,
          fontWeight: 650,
        }}
      >
        ↺
      </button>
    </div>
  );
}

/**
 * Pass-through hook so the LayoutPicker container can show live targetPages
 * + style in its header without re-reading from storage repeatedly.
 */
export function useLayoutPrefsSnapshot(): { layout: LayoutPrefs; styleId: StyleId; styleLabel: string } {
  const [layout, setLayout] = useState<LayoutPrefs>(() => readLayoutPrefs());
  const [styleId, setStyleId] = useState<StyleId>(() => readWritingPrefs().style);

  useEffect(() => {
    const onLayout = () => setLayout(readLayoutPrefs());
    const onWriting = () => setStyleId(readWritingPrefs().style);
    window.addEventListener('antcv:layout-prefs-changed', onLayout);
    window.addEventListener('antcv:writing-prefs-changed', onWriting);
    return () => {
      window.removeEventListener('antcv:layout-prefs-changed', onLayout);
      window.removeEventListener('antcv:writing-prefs-changed', onWriting);
    };
  }, []);

  return {
    layout,
    styleId,
    styleLabel: STYLES[styleId]?.displayName ?? styleId,
  };
}
