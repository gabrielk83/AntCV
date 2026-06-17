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
import { NATIVE_SECTION_HEADER_STYLE } from '../../lib/settings-dom';

// React port of the "Languages in the top bar" card from
// pwa/antcv-stability-core-334.js (lines 149-182). Default collapsed
// (§5 hotfix item 1). Reads / writes the same localStorage keys and
// dispatches the same events so other sidecars notice no difference.
//
// v1.50.95 — mounted into the Personal sections flex column at order 35
// (after the writing-style/tone group, before Banned Words; see mount.tsx).
// The collapsed-summary header uses the shared native section-header register
// (Georgia 11px / 600 / .4px / muted white) so Languages, Section layout, and
// the relocated Visual-package card all read identically to the real native
// sections. The expanded body keeps the standard island spacing.
const SUMMARY_STYLE: React.CSSProperties = {
  ...(NATIVE_SECTION_HEADER_STYLE as React.CSSProperties),
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: 0,
  marginBottom: 6,
  background: 'transparent',
  border: 0,
  cursor: 'pointer',
  textAlign: 'left',
};

// v1.50.537 — LANGUAGES-CARD-CONSOLIDATE-001 (owner 2026-06-17): the Experience-
// tense + Spelling controls must live INSIDE the Languages expand/collapse, not
// as separate sibling cards (the spell card "faded" intermittently; tense was
// outside). These read/write the SAME stores the standalone sidecars use
// (styleConfig.expTense; antcv:spell:enabled / :enVariant / :langs), and the
// sidecars now skip their Personal injection when this island is present.
const SUB_LABEL: React.CSSProperties = {
  fontSize: 10, fontWeight: 800, letterSpacing: '.3px', color: 'rgba(255,255,255,0.6)',
  textTransform: 'uppercase', margin: '14px 0 6px',
};
const HINT: React.CSSProperties = { fontSize: 9.5, color: 'rgba(255,255,255,0.4)', margin: '5px 0 0', lineHeight: 1.4 };

type Tense = 'auto' | 'present' | 'past';
function readTense(): Tense {
  try {
    const sc = JSON.parse(localStorage.getItem('styleConfig') || '{}');
    const t = sc && sc.expTense;
    if (t === 'present' || t === 'past' || t === 'auto') return t;
    if (sc && sc.expPastTense === true) return 'past';
  } catch { /* */ }
  return 'auto';
}
function writeTense(v: Tense): void {
  try {
    const w = window as unknown as { _antcvSetExpTense?: (x: string) => void };
    if (typeof w._antcvSetExpTense === 'function') w._antcvSetExpTense(v);
    else {
      const sc = JSON.parse(localStorage.getItem('styleConfig') || '{}') || {};
      sc.expTense = v;
      localStorage.setItem('styleConfig', JSON.stringify(sc));
    }
  } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:exp-tense-changed', { detail: { value: v } })); } catch { /* */ }
}
function readSpellEnabled(): boolean { try { return localStorage.getItem('antcv:spell:enabled') !== '0'; } catch { return true; } }
function writeSpellEnabled(on: boolean): void { try { localStorage.setItem('antcv:spell:enabled', on ? '1' : '0'); } catch { /* */ } }
function readEnVariant(): 'gb' | 'us' { try { return localStorage.getItem('antcv:spell:enVariant') === 'us' ? 'us' : 'gb'; } catch { return 'gb'; } }
function writeEnVariant(code: 'gb' | 'us'): void {
  try { localStorage.setItem('antcv:spell:enVariant', code); } catch { /* */ }
  try { (window as unknown as { AntcvSpell?: { _invalidate?: () => void } }).AntcvSpell?._invalidate?.(); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:spell-variant-changed', { detail: { variant: code } })); } catch { /* */ }
}
function readSpellLangs(): Record<string, boolean> { try { return JSON.parse(localStorage.getItem('antcv:spell:langs') || '{}') || {}; } catch { return {}; } }
function writeSpellLang(code: string, on: boolean): void {
  try { const m = readSpellLangs(); m[code] = on; localStorage.setItem('antcv:spell:langs', JSON.stringify(m)); } catch { /* */ }
}

export function LanguageCard(): JSX.Element {
  const [expanded, setExpanded] = useState<boolean>(() => readLangExpanded());
  const [enabled, setEnabled] = useState<LangCode[]>(() => readEnabledLangs());
  const [tense, setTense] = useState<Tense>(() => readTense());
  const [spellOn, setSpellOn] = useState<boolean>(() => readSpellEnabled());
  const [enVariant, setEnVariant] = useState<'gb' | 'us'>(() => readEnVariant());
  const [spellLangs, setSpellLangs] = useState<Record<string, boolean>>(() => readSpellLangs());

  const onTense = useCallback((v: Tense) => { writeTense(v); setTense(v); }, []);
  const onSpellOn = useCallback((on: boolean) => { writeSpellEnabled(on); setSpellOn(on); }, []);
  const onEnVariant = useCallback((c: 'gb' | 'us') => { writeEnVariant(c); setEnVariant(c); }, []);
  const onSpellLang = useCallback((code: string, on: boolean) => { writeSpellLang(code, on); setSpellLangs((p) => ({ ...p, [code]: on })); }, []);

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
          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> Languages
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

          {/* Experience tense — moved here so it lives inside the Languages
              expand/collapse (owner: "part of the languages control"). */}
          <div style={SUB_LABEL}>Experience tense</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {([['auto', 'Auto', 'Present for the current role, past for earlier roles'],
               ['present', 'Present', 'Force present tense on every role'],
               ['past', 'Past', 'Force past tense on every role']] as [Tense, string, string][]).map(([val, label, tip]) => {
              const on = tense === val;
              return (
                <button
                  key={val}
                  type="button"
                  title={tip}
                  onClick={() => onTense(val)}
                  aria-pressed={on}
                  style={{
                    padding: '5px 11px', fontSize: 11, fontWeight: 700, borderRadius: 5, cursor: 'pointer',
                    background: on ? 'rgba(1,183,187,.18)' : 'rgba(255,255,255,.04)',
                    border: '1px solid ' + (on ? '#01B7BB' : 'rgba(255,255,255,.18)'),
                    color: on ? '#01B7BB' : 'rgba(255,255,255,.6)',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div style={HINT}>Auto = present for the current role, past for earlier roles.</div>

          {/* Spelling — moved here too; a stable React render (no more "fade").
              Chinese is selectable (context-based check) and English has UK/US. */}
          <div style={SUB_LABEL}>Spelling</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, color: 'rgba(255,255,255,.85)' }}>
            <input type="checkbox" checked={spellOn} onChange={(e) => onSpellOn(e.currentTarget.checked)} style={{ accentColor: '#01B7BB', cursor: 'pointer' }} />
            Spelling underlines (editor + preview)
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '7px 0 0', flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
            <span>English:</span>
            <select
              value={enVariant}
              onChange={(e) => onEnVariant(e.currentTarget.value as 'gb' | 'us')}
              style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer' }}
            >
              <option value="gb" style={{ background: '#283556', color: '#e6eef3' }}>UK (British)</option>
              <option value="us" style={{ background: '#283556', color: '#e6eef3' }}>US (American)</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '7px 0 0', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
            {([['da', 'Dansk'], ['es', 'Español'], ['zh', '中文 (context)']] as [string, string][]).map(([code, label]) => (
              <label key={code} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={spellLangs[code] !== false}
                  onChange={(e) => onSpellLang(code, e.currentTarget.checked)}
                  style={{ accentColor: '#01B7BB', cursor: 'pointer' }}
                />
                {label}
              </label>
            ))}
          </div>
          <div style={HINT}>Dictionaries follow the document language. Chinese uses a context-based check (no Hunspell). Change English UK/US above.</div>
        </div>
      )}
    </section>
  );
}
