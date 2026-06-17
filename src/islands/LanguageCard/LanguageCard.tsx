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
// SPELL-EN-VARIANT-002 — English markets with distinct spelling. UK default.
const EN_VARIANTS: [string, string][] = [
  ['gb', 'UK (British)'], ['us', 'US (American)'], ['in', 'India'],
  ['ca', 'Canada'], ['au', 'Australia'], ['za', 'South Africa'],
];
function readEnVariant(): string { try { return localStorage.getItem('antcv:spell:enVariant') || 'gb'; } catch { return 'gb'; } }
function writeEnVariant(code: string): void {
  try { localStorage.setItem('antcv:spell:enVariant', code); } catch { /* */ }
  try { (window as unknown as { AntcvSpell?: { _invalidate?: () => void } }).AntcvSpell?._invalidate?.(); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:spell-variant-changed', { detail: { variant: code } })); } catch { /* */ }
}
function readEsVariant(): string { try { return localStorage.getItem('antcv:spell:esVariant') || 'uy'; } catch { return 'uy'; } }
function writeEsVariant(code: string): void {
  try { localStorage.setItem('antcv:spell:esVariant', code); } catch { /* */ }
  try { (window as unknown as { AntcvSpell?: { _invalidate?: () => void } }).AntcvSpell?._invalidate?.(); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:spell-variant-changed', { detail: { variant: code, lang: 'es' } })); } catch { /* */ }
}
// SPELL-ES-VARIANT-001 — regional Spanish, Uruguay default. Grows over time, so
// the control is a scrollable <select> (native dropdowns overflow-scroll).
const ES_VARIANTS: [string, string][] = [
  ['uy', 'Uruguay'], ['es', 'España'], ['mx', 'México'], ['ar', 'Argentina'],
  ['co', 'Colombia'], ['cl', 'Chile'], ['gq', 'Guinea Ecuatorial'],
];
function readSpellLangs(): Record<string, boolean> { try { return JSON.parse(localStorage.getItem('antcv:spell:langs') || '{}') || {}; } catch { return {}; } }
function writeSpellLang(code: string, on: boolean): void {
  try { const m = readSpellLangs(); m[code] = on; localStorage.setItem('antcv:spell:langs', JSON.stringify(m)); } catch { /* */ }
}

// U3 — native names for the two-table picker (parity with the wizard slide).
const NATIVE: Record<string, string> = { en: 'English', da: 'Dansk', es: 'Español', zh: '中文' };
// First language = the DEFAULT; it drives generation + the interface. Mirror the
// wizard's writePrimaryLanguage (JSON-encoded 'language', like the app's u.set).
function writePrimaryLanguage(code: string): void {
  try { localStorage.setItem('language', JSON.stringify(code)); } catch { /* */ }
  try { localStorage.setItem('uiLang', code); } catch { /* */ }
  try { window.dispatchEvent(new StorageEvent('storage', { key: 'language', newValue: code })); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:language-changed', { detail: { language: code } })); } catch { /* */ }
}

export function LanguageCard(): JSX.Element {
  const [expanded, setExpanded] = useState<boolean>(() => readLangExpanded());
  const [enabled, setEnabled] = useState<LangCode[]>(() => readEnabledLangs());
  const [tense, setTense] = useState<Tense>(() => readTense());
  const [spellOn, setSpellOn] = useState<boolean>(() => readSpellEnabled());
  const [enVariant, setEnVariant] = useState<string>(() => readEnVariant());
  const [esVariant, setEsVariant] = useState<string>(() => readEsVariant());
  const [spellLangs, setSpellLangs] = useState<Record<string, boolean>>(() => readSpellLangs());

  const onTense = useCallback((v: Tense) => { writeTense(v); setTense(v); }, []);
  const onSpellOn = useCallback((on: boolean) => { writeSpellEnabled(on); setSpellOn(on); }, []);
  const onEnVariant = useCallback((c: string) => { writeEnVariant(c); setEnVariant(c); }, []);
  const onEsVariant = useCallback((c: string) => { writeEsVariant(c); setEsVariant(c); }, []);
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

  // U3 — ordered two-table picker. `enabled` is ordered; enabled[0] = DEFAULT.
  const commit = useCallback((next: LangCode[]) => {
    const w = writeEnabledLangs(next.length ? next : DEFAULT_LANGS.slice());
    setEnabled(w);
    try { writePrimaryLanguage(w[0]); } catch { /* */ }
  }, []);
  const addLang = useCallback((c: LangCode) => { setEnabled((prev) => { if (prev.indexOf(c) >= 0) return prev; const next = [...prev, c]; const w = writeEnabledLangs(next); try { writePrimaryLanguage(w[0]); } catch { /* */ } return w; }); }, []);
  const removeLang = useCallback((c: LangCode) => { setEnabled((prev) => { if (prev.length <= 1) return prev; const w = writeEnabledLangs(prev.filter((x) => x !== c)); try { writePrimaryLanguage(w[0]); } catch { /* */ } return w; }); }, []);
  const moveLang = useCallback((idx: number, delta: number) => { setEnabled((prev) => { const j = idx + delta; if (j < 0 || j >= prev.length) return prev; const next = prev.slice(); const t = next[idx]; next[idx] = next[j]; next[j] = t; const w = writeEnabledLangs(next); try { writePrimaryLanguage(w[0]); } catch { /* */ } return w; }); }, []);
  void commit;

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
            Move a language right to include it in the top bar; reorder with ↑ ↓ — the FIRST (★ DEFAULT) drives generation and the interface.
          </div>
          {/* U3 — wizard-style two-table picker (available / selected, default-first,
              reorder) replacing the old checkbox grid. Each column scrolls so it
              never gets crowded. */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: 8, background: 'rgba(255,255,255,.03)', maxHeight: 168, overflow: 'auto' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.35px', color: 'rgba(255,255,255,.6)', margin: '0 0 7px' }}>AVAILABLE</div>
              {LANGS.filter((l) => enabled.indexOf(l.code) < 0).map((l) => (
                <div key={l.code} title="Add to your selected languages" onClick={() => addLang(l.code)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', marginBottom: 7, borderRadius: 9, border: '2px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.04)', cursor: 'pointer' }}>
                  <div style={{ flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,.85)' }}>
                    <strong>{l.label}</strong> <span style={{ color: 'rgba(255,255,255,.45)', fontSize: 11 }}>{NATIVE[l.code]}</span>
                  </div>
                  <button type="button" title="Add" onClick={(e) => { e.stopPropagation(); addLang(l.code); }}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: 'pointer', fontSize: 12 }}>→</button>
                </div>
              ))}
              {enabled.length >= LANGS.length && (
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', padding: '6px 2px' }}>All languages selected.</div>
              )}
            </div>
            <div style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 10, padding: 8, background: 'rgba(255,255,255,.03)', maxHeight: 168, overflow: 'auto' }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '.35px', color: 'rgba(255,255,255,.6)', margin: '0 0 7px' }}>SELECTED — first is DEFAULT</div>
              {enabled.map((code, idx) => (
                <div key={code} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 11px', marginBottom: 7, borderRadius: 9, border: '2px solid rgba(1,183,187,.55)', background: 'rgba(1,183,187,.12)' }}>
                  <div style={{ flex: 1, fontSize: 12.5, color: '#fff', minWidth: 0 }}>
                    <strong>{LANGS.find((l) => l.code === code)?.label ?? code}</strong>
                    {idx === 0 && (
                      <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.4px', color: '#06243a', background: '#01B7BB', padding: '2px 6px', borderRadius: 5, whiteSpace: 'nowrap', verticalAlign: 'middle', marginLeft: 6 }}>★ DEFAULT</span>
                    )}
                  </div>
                  <button type="button" title="Move up (first = default)" disabled={idx === 0} onClick={() => moveLang(idx, -1)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: idx === 0 ? 'default' : 'pointer', fontSize: 12, opacity: idx === 0 ? 0.3 : 1 }}>↑</button>
                  <button type="button" title="Move down" disabled={idx === enabled.length - 1} onClick={() => moveLang(idx, 1)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: idx === enabled.length - 1 ? 'default' : 'pointer', fontSize: 12, opacity: idx === enabled.length - 1 ? 0.3 : 1 }}>↓</button>
                  <button type="button" title="Remove (back to available)" disabled={enabled.length <= 1} onClick={() => removeLang(code)}
                    style={{ background: 'transparent', border: '1px solid rgba(255,255,255,.25)', color: '#fff', borderRadius: 6, width: 26, height: 26, cursor: enabled.length <= 1 ? 'default' : 'pointer', fontSize: 12, opacity: enabled.length <= 1 ? 0.3 : 1 }}>←</button>
                </div>
              ))}
            </div>
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
              onChange={(e) => onEnVariant(e.currentTarget.value)}
              style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', maxWidth: '100%' }}
            >
              {EN_VARIANTS.map(([code, label]) => (
                <option key={code} value={code} style={{ background: '#283556', color: '#e6eef3' }}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '7px 0 0', flexWrap: 'wrap', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
            <span>Spanish:</span>
            <select
              value={esVariant}
              onChange={(e) => onEsVariant(e.currentTarget.value)}
              style={{ padding: '4px 8px', fontSize: 11, borderRadius: 6, border: '1px solid rgba(255,255,255,.18)', background: 'rgba(255,255,255,.06)', color: '#fff', cursor: 'pointer', maxWidth: '100%' }}
            >
              {ES_VARIANTS.map(([code, label]) => (
                <option key={code} value={code} style={{ background: '#283556', color: '#e6eef3' }}>{label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '7px 0 0', fontSize: 11, color: 'rgba(255,255,255,.7)' }}>
            {([['da', 'Dansk'], ['zh', '中文 (context)']] as [string, string][]).map(([code, label]) => (
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
