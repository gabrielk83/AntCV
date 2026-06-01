import React, { useCallback, useEffect, useState } from 'react';

// Phase B of the wizard step 10 React port (plan
// docs/plan/v1.50.37-wizard-step-10-scoping.md). Replaces the inline
// radio + checkbox builders in antcv-wizard-language-slide-339.js
// (lines ~229-288 pre-v1.50.39) with a React island.
//
// State strategy
// --------------
// The vanilla wizard sidecar's Continue handler reads the picked
// primary + additional values out of the DOM at click-time. We don't
// own the Continue button (yet — that's Phase C). So this component
// exposes its current picks on window.AntcvWizardLanguagePicker so
// the legacy Continue handler can call getState() and get the same
// answer it used to get by walking the DOM.
//
// The picks are ALSO written to a data attribute on the anchor so
// any future capture of the wizard state can introspect the DOM
// directly without hitting window globals.
//
// We deliberately do NOT write to the 6 storage keys on every
// change — that's still the Continue handler's job (via
// writeLangsViaStabilityCore + writePrimaryLanguage). React owns the
// VIEW; the sidecar owns the COMMIT.

const LANG_OPTIONS = [
  { code: 'en', label: 'English',  native: 'English' },
  { code: 'da', label: 'Danish',   native: 'Dansk' },
  { code: 'es', label: 'Spanish',  native: 'Espanol' },
  { code: 'zh', label: 'Chinese',  native: '中文' },
] as const;

type LangCode = (typeof LANG_OPTIONS)[number]['code'];

const DEFAULT_PRIMARY: LangCode = 'en';
const DEFAULT_ADDITIONAL: LangCode[] = ['da'];

export interface WizardLanguagePickerState {
  primary: LangCode;
  additional: LangCode[];
}

declare global {
  interface Window {
    AntcvWizardLanguagePicker?: {
      getState: () => WizardLanguagePickerState;
      version: string;
    };
  }
}

// Shared state, accessible to the legacy Continue handler.
const liveState: WizardLanguagePickerState = {
  primary: DEFAULT_PRIMARY,
  additional: DEFAULT_ADDITIONAL.slice(),
};

function publishState(next: WizardLanguagePickerState, anchor: HTMLElement | null): void {
  liveState.primary = next.primary;
  liveState.additional = next.additional.slice();
  if (!window.AntcvWizardLanguagePicker) {
    window.AntcvWizardLanguagePicker = {
      version: '1.50.39',
      getState: () => ({ primary: liveState.primary, additional: liveState.additional.slice() }),
    };
  }
  if (anchor) {
    try {
      anchor.setAttribute('data-antcv-wizard-primary-language', next.primary);
      anchor.setAttribute('data-antcv-wizard-additional-languages', next.additional.join(','));
    } catch { /* */ }
  }
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 800,
  letterSpacing: '0.3px',
  color: 'rgba(255,255,255,0.6)',
  margin: '4px 0 8px',
};

const GRID_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: 6,
  marginBottom: 18,
};

const PILL_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '8px 10px',
  border: '1px solid rgba(255,255,255,0.18)',
  borderRadius: 8,
  background: 'rgba(255,255,255,0.04)',
  cursor: 'pointer',
  fontSize: 13,
};

export function WizardLanguagePicker(): JSX.Element {
  const [primary, setPrimary] = useState<LangCode>(DEFAULT_PRIMARY);
  const [additional, setAdditional] = useState<LangCode[]>(DEFAULT_ADDITIONAL.slice());

  // Capture the anchor element on first mount so we can stamp it with
  // data attributes whenever the state changes.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const captureAnchor = useCallback((el: HTMLDivElement | null) => {
    if (el) setAnchor(el);
  }, []);

  useEffect(() => {
    publishState({ primary, additional }, anchor);
  }, [primary, additional, anchor]);

  const onPrimaryChange = useCallback((code: LangCode) => {
    setPrimary(code);
    // When the user picks a primary, the same code can't also be an
    // additional — mirror the legacy behaviour.
    setAdditional((prev) => prev.filter((c) => c !== code));
  }, []);

  const onAdditionalToggle = useCallback((code: LangCode, checked: boolean) => {
    setAdditional((prev) => {
      if (checked) {
        if (prev.includes(code)) return prev;
        return [...prev, code];
      }
      return prev.filter((c) => c !== code);
    });
  }, []);

  return (
    <div ref={captureAnchor} data-antcv-react-island="wizard-language-picker">
      <div style={LABEL_STYLE}>PRIMARY LANGUAGE</div>
      <div style={GRID_STYLE}>
        {LANG_OPTIONS.map((o) => (
          <label key={o.code} style={PILL_STYLE}>
            <input
              type="radio"
              name="antcv-wls-primary"
              value={o.code}
              checked={primary === o.code}
              onChange={() => onPrimaryChange(o.code)}
              style={{ accentColor: '#01B7BB' }}
            />
            <span>
              <strong>{o.label}</strong>{' '}
              <span style={{ opacity: 0.65, fontSize: 11 }}>{o.native}</span>
            </span>
          </label>
        ))}
      </div>

      <div style={LABEL_STYLE}>ADDITIONAL LANGUAGES IN TOP BAR</div>
      <div style={GRID_STYLE}>
        {LANG_OPTIONS.map((o) => {
          // Hide the row whose code matches the active primary —
          // matches the legacy primaryRow.addEventListener('change') hack
          // that toggled display:none on the matching addRow label.
          if (o.code === primary) return null;
          const checked = additional.includes(o.code);
          return (
            <label key={o.code} style={PILL_STYLE} data-lang-code={o.code}>
              <input
                type="checkbox"
                value={o.code}
                checked={checked}
                onChange={(e) => onAdditionalToggle(o.code, e.currentTarget.checked)}
                style={{ accentColor: '#01B7BB' }}
              />
              <span>
                <strong>{o.label}</strong>{' '}
                <span style={{ opacity: 0.65, fontSize: 11 }}>{o.native}</span>
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
