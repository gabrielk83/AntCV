import React, { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_LANGS,
  LANGS,
  type LangCode,
  readEnabledLangs,
  readLangExpanded,
  writeEnabledLangs,
  writeLangExpanded,
} from '../../lib/lang-prefs';

// React port of the "Languages in the top bar" card from
// pwa/antcv-stability-core-334.js (lines 149-182). Default collapsed
// (§5 hotfix item 1). Reads / writes the same localStorage keys and
// dispatches the same events so other sidecars notice no difference.
//
// v1.50.58 — relocated to sit immediately AFTER the Banned Words panel
// (see mount.tsx anchoring) and the collapsed-summary header restyled to
// match the Banned Words sub-header register: 9px, uppercase, .8px
// letter-spacing, muted white. The expanded body keeps the standard
// island spacing.

// Matches the Banned Words <summary> register so the two read as siblings.
const SUMMARY_STYLE: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: 0,
  marginBottom: 6,
  background: 'transparent',
  border: 0,
  color: 'rgba(255,255,255,.5)',
  cursor: 'pointer',
  textAlign: 'left',
  textTransform: 'uppercase',
  letterSpacing: '.8px',
  fontSize: 9,
  fontWeight: 600,
};

export function LanguageCard(): JSX.Element {
  const [expanded, setExpanded] = useState<boolean>(() => readLangExpanded());
  const [enabled, setEnabled] = useState<LangCode[]>(() => readEnabledLangs());

  // Cross-tab sync — if another tab toggles a language, mirror the change.
  useEffect(() => {
    const onLangs = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { enabledLanguages?: LangCode[] } | undefined;
      if (Array.isArray(detail?.enabledLanguages)) {
        setEnabled(detail!.enabledLanguages as LangCode[]);
      } else {
        setEnabled(readEnabledLangs());
      }
    };
    window.addEventListener('antcv:enabled-languages-changed', onLangs as EventListener);
    window.addEventListener('antcv:language-prefs-changed', onLangs as EventListener);
    const onStorage = (ev: StorageEvent) => {
      if (ev.key === 'enabledLanguages' || ev.key === 'antcv:enabledLanguages') {
        setEnabled(readEnabledLangs());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('antcv:enabled-languages-changed', onLangs as EventListener);
      window.removeEventListener('antcv:language-prefs-changed', onLangs as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const toggleExpanded = useCallback(() => {
    setExpanded((prev) => {
      const next = !prev;
      writeLangExpanded(next);
      return next;
    });
  }, []);

  const onToggleLang = useCallback((code: LangCode, checked: boolean) => {
    setEnabled((prev) => {
      const has = prev.indexOf(code) >= 0;
      let next: LangCode[];
      if (checked && !has) next = [...prev, code];
      else if (!checked && has) next = prev.filter((c) => c !== code);
      else next = prev;

      // Refuse to leave the user with zero languages — mirror writeLangs's
      // empty-array fallback (DEFAULT_LANGS).
      if (next.length === 0) next = DEFAULT_LANGS.slice();

      return writeEnabledLangs(next);
    });
  }, []);

  return (
    <section
      data-antcv-language-card="standard-personal-only"
      data-antcv-react-island="language-card"
      style={{
        marginTop: 12,
        paddingTop: 6,
        color: '#d7e6ee',
      }}
    >
      <button
        type="button"
        onClick={toggleExpanded}
        aria-expanded={expanded ? 'true' : 'false'}
        style={SUMMARY_STYLE}
      >
        <span>
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> Languages in the top bar
        </span>
      </button>
      {expanded && (
        <div>
          <div style={{ fontSize: 12, opacity: 0.78, margin: '6px 0 10px' }}>
            Choose which language buttons are available in the top bar. This does not start translation.
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2,minmax(120px,1fr))',
              gap: 8,
            }}
          >
            {LANGS.map((l) => (
              <label
                key={l.code}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 9px',
                  border: '1px solid rgba(1,183,187,.35)',
                  borderRadius: 8,
                  background: 'rgba(1,183,187,.06)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  data-lang={l.code}
                  checked={enabled.indexOf(l.code) >= 0}
                  onChange={(e) => onToggleLang(l.code, e.currentTarget.checked)}
                  style={{ accentColor: '#01B7BB' }}
                />
                <span style={{ fontWeight: 650 }}>{l.label}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
