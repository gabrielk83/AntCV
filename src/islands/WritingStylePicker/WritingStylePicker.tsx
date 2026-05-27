import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ACTIVE_STYLE_IDS,
  STYLE_IDS,
  STYLES,
  TONE_CHIPS_CATALOGUE,
  detectChipConflicts,
  isChipCompatible,
  type StyleId,
  type LangCode,
} from '../../lib/writing-systems';
import {
  DEFAULT_TARGET_PAGES_OPTIONS,
  addBannedItem,
  readEditorLanguage,
  readLayoutPrefs,
  readWritingPrefs,
  removeBannedItem,
  setWritingStyleWithCascade,
  writeEditorLanguage,
  writeLayoutPrefs,
  writeWritingPrefs,
  type WritingPrefs,
  type LayoutPrefs,
} from '../../lib/writing-prefs';

// Sub-section header used inside the picker. Same visual register as the
// LanguageCard header in src/islands/LanguageCard/LanguageCard.tsx.
function SectionHeader({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div
      style={{
        textTransform: 'uppercase',
        letterSpacing: '.08em',
        fontWeight: 800,
        fontSize: 11,
        opacity: 0.85,
        margin: '12px 0 6px',
      }}
    >
      {children}
    </div>
  );
}

function StyleDropdown({
  value,
  onChange,
}: {
  value: StyleId;
  onChange: (id: StyleId) => void;
}): JSX.Element {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.currentTarget.value as StyleId)}
      style={{
        width: '100%',
        padding: '8px 10px',
        background: 'rgba(255,255,255,.05)',
        color: '#e6eef3',
        border: '1px solid rgba(255,255,255,.18)',
        borderRadius: 8,
        fontWeight: 650,
      }}
    >
      {STYLE_IDS.map((id) => {
        const s = STYLES[id];
        const disabled = !s.active;
        const legacy = s.legacyAliases.length
          ? ' — was ' + s.legacyAliases[0].replace(/\b\w/g, (c) => c.toUpperCase())
          : '';
        const suffix = disabled ? `  (Coming ${s.comingInRelease ?? 'soon'})` : '';
        return (
          <option key={id} value={id} disabled={disabled}>
            {s.displayName}
            {legacy}
            {suffix}
          </option>
        );
      })}
    </select>
  );
}

function ToneChipsEditor({
  styleId,
  chips,
  onChange,
}: {
  styleId: StyleId;
  chips: string[];
  onChange: (next: string[]) => void;
}): JSX.Element {
  const compatible = useMemo(
    () => Object.keys(TONE_CHIPS_CATALOGUE).filter((chip) => isChipCompatible(chip, styleId)),
    [styleId],
  );
  const conflicts = useMemo(() => detectChipConflicts(chips), [chips]);

  const toggle = useCallback(
    (chip: string) => {
      const has = chips.includes(chip);
      const next = has ? chips.filter((c) => c !== chip) : [...chips, chip];
      onChange(next);
    },
    [chips, onChange],
  );

  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {compatible.map((chip) => {
          const active = chips.includes(chip);
          const inConflict = conflicts.some((c) => c.pair.includes(chip));
          const meta = TONE_CHIPS_CATALOGUE[chip];
          const tooltip = meta?.effect ?? '';
          return (
            <button
              key={chip}
              type="button"
              onClick={() => toggle(chip)}
              aria-pressed={active}
              title={inConflict ? `Conflicts with another active chip — see ⚠` : tooltip}
              style={{
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 650,
                borderRadius: 999,
                background: active ? 'rgba(1,183,187,.18)' : 'rgba(255,255,255,.04)',
                border: '1px solid ' + (active ? 'rgba(1,183,187,.55)' : 'rgba(255,255,255,.14)'),
                color: '#e6eef3',
                cursor: 'pointer',
              }}
            >
              {chip}
              {inConflict ? ' ⚠' : ''}
            </button>
          );
        })}
      </div>
      {conflicts.length > 0 && (
        <div
          style={{
            fontSize: 11,
            opacity: 0.78,
            background: 'rgba(217,164,65,.12)',
            border: '1px solid rgba(217,164,65,.45)',
            borderRadius: 8,
            padding: '6px 10px',
            marginTop: 8,
          }}
        >
          {conflicts.map((c) => (
            <div key={c.pair.join('|')}>
              <strong>{c.pair[0]}</strong> ↔ <strong>{c.pair[1]}</strong> conflict ({c.kind}).
              The skill honours the more recently added; expect to drop one of these soon.
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function BannedListEditor({
  kind,
  language,
  items,
  onAdd,
  onRemove,
}: {
  kind: 'words' | 'phrases';
  language: LangCode;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}): JSX.Element {
  const [draft, setDraft] = useState('');
  const langLabels: Record<LangCode, string> = {
    en: 'English',
    da: 'Danish',
    es: 'Spanish',
    zh: 'Mandarin',
  };
  const placeholder = kind === 'words' ? `Add a banned word in ${langLabels[language]}` : `Add a banned phrase in ${langLabels[language]}`;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    onAdd(v);
    setDraft('');
  };
  return (
    <>
      <form onSubmit={submit} style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.currentTarget.value)}
          placeholder={placeholder}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: 'rgba(255,255,255,.05)',
            color: '#e6eef3',
            border: '1px solid rgba(255,255,255,.18)',
            borderRadius: 6,
            fontFamily: 'inherit',
          }}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          style={{
            padding: '6px 12px',
            background: 'rgba(1,183,187,.18)',
            color: '#e6eef3',
            border: '1px solid rgba(1,183,187,.55)',
            borderRadius: 6,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Add
        </button>
      </form>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
        {items.length === 0 && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            No items in {langLabels[language]} yet.
          </span>
        )}
        {items.map((item) => (
          <span
            key={item}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              fontSize: 12,
              borderRadius: 999,
              background: 'rgba(255,255,255,.05)',
              border: '1px solid rgba(255,255,255,.18)',
            }}
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`Remove ${item}`}
              style={{
                background: 'transparent',
                border: 0,
                color: '#e6eef3',
                opacity: 0.6,
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 2px',
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </>
  );
}

function LanguageSwitcher({
  value,
  onChange,
}: {
  value: LangCode;
  onChange: (lang: LangCode) => void;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {(['en', 'da', 'es', 'zh'] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          onClick={() => onChange(lang)}
          aria-pressed={value === lang}
          style={{
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            borderRadius: 4,
            background: value === lang ? 'rgba(1,183,187,.18)' : 'transparent',
            border: '1px solid ' + (value === lang ? 'rgba(1,183,187,.55)' : 'rgba(255,255,255,.14)'),
            color: '#e6eef3',
            cursor: 'pointer',
          }}
        >
          {lang}
        </button>
      ))}
    </div>
  );
}

export function WritingStylePicker(): JSX.Element {
  const [prefs, setPrefs] = useState<WritingPrefs>(() => readWritingPrefs());
  const [layout, setLayout] = useState<LayoutPrefs>(() => readLayoutPrefs());
  const [editorLang, setEditorLang] = useState<LangCode>(() => readEditorLanguage());
  const [advanced, setAdvanced] = useState(false);

  useEffect(() => {
    const refreshPrefs = () => setPrefs(readWritingPrefs());
    const refreshLayout = () => setLayout(readLayoutPrefs());
    const refreshLang = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as { lang?: LangCode } | undefined;
      setEditorLang(detail?.lang ?? readEditorLanguage());
    };
    window.addEventListener('antcv:writing-prefs-changed', refreshPrefs);
    window.addEventListener('antcv:layout-prefs-changed', refreshLayout);
    window.addEventListener('antcv:editor-language-changed', refreshLang as EventListener);
    return () => {
      window.removeEventListener('antcv:writing-prefs-changed', refreshPrefs);
      window.removeEventListener('antcv:layout-prefs-changed', refreshLayout);
      window.removeEventListener('antcv:editor-language-changed', refreshLang as EventListener);
    };
  }, []);

  const style = STYLES[prefs.style];
  const allowed = style.allowedLength;
  const allowedPageValues = DEFAULT_TARGET_PAGES_OPTIONS.filter(
    (v) => v >= allowed.min && v <= allowed.max,
  );

  const onStyleChange = useCallback((id: StyleId) => {
    if (!ACTIVE_STYLE_IDS.includes(id)) return;
    setPrefs(setWritingStyleWithCascade(id));
    setLayout(readLayoutPrefs());
  }, []);

  const onChipsChange = useCallback((chips: string[]) => {
    const overrides = { ...prefs.overrides, chips: true };
    setPrefs(writeWritingPrefs({ chips, overrides }));
  }, [prefs.overrides]);

  const onAddBanned = useCallback((kind: 'words' | 'phrases', value: string) => {
    setPrefs(addBannedItem(kind, editorLang, value));
  }, [editorLang]);

  const onRemoveBanned = useCallback((kind: 'words' | 'phrases', value: string) => {
    setPrefs(removeBannedItem(kind, editorLang, value));
  }, [editorLang]);

  const onLangChange = useCallback((lang: LangCode) => {
    writeEditorLanguage(lang);
    setEditorLang(lang);
  }, []);

  const onTargetPages = useCallback((v: number) => {
    const overrides = { ...prefs.overrides, targetPages: true };
    setLayout(writeLayoutPrefs({ targetPages: v }));
    setPrefs(writeWritingPrefs({ overrides }));
  }, [prefs.overrides]);

  return (
    <section
      data-antcv-react-island="writing-style-picker"
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
        Writing style
      </div>

      <SectionHeader>Style</SectionHeader>
      <StyleDropdown value={prefs.style} onChange={onStyleChange} />
      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
        {style.contentRule}
      </div>

      <SectionHeader>Tone chips</SectionHeader>
      <ToneChipsEditor styleId={prefs.style} chips={prefs.chips} onChange={onChipsChange} />

      <SectionHeader>Target CV length</SectionHeader>
      <select
        value={layout.targetPages}
        onChange={(e) => onTargetPages(Number(e.currentTarget.value))}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: 'rgba(255,255,255,.05)',
          color: '#e6eef3',
          border: '1px solid rgba(255,255,255,.18)',
          borderRadius: 8,
        }}
      >
        {allowedPageValues.map((v) => (
          <option key={v} value={v}>{v} page{v === 1 ? '' : 's'}</option>
        ))}
      </select>
      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
        {style.displayName}: allowed {allowed.min}–{allowed.max} pages
      </div>

      <SectionHeader>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Banned words ({editorLang === 'en' ? 'English' : editorLang === 'da' ? 'Danish' : editorLang === 'es' ? 'Spanish' : 'Mandarin'})
          <LanguageSwitcher value={editorLang} onChange={onLangChange} />
        </span>
      </SectionHeader>
      <BannedListEditor
        kind="words"
        language={editorLang}
        items={prefs.extraBannedWords[editorLang] ?? []}
        onAdd={(v) => onAddBanned('words', v)}
        onRemove={(v) => onRemoveBanned('words', v)}
      />

      <SectionHeader>
        Banned phrases ({editorLang === 'en' ? 'English' : editorLang === 'da' ? 'Danish' : editorLang === 'es' ? 'Spanish' : 'Mandarin'})
      </SectionHeader>
      <BannedListEditor
        kind="phrases"
        language={editorLang}
        items={prefs.extraBannedPhrases[editorLang] ?? []}
        onAdd={(v) => onAddBanned('phrases', v)}
        onRemove={(v) => onRemoveBanned('phrases', v)}
      />

      <button
        type="button"
        onClick={() => setAdvanced((v) => !v)}
        style={{
          marginTop: 14,
          padding: '6px 10px',
          background: 'transparent',
          color: '#a9c3cf',
          border: '1px solid rgba(255,255,255,.18)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 650,
        }}
        aria-expanded={advanced}
      >
        {advanced ? '▾' : '▸'} Advanced
      </button>
      {advanced && (
        <div
          style={{
            fontSize: 12,
            background: 'rgba(255,255,255,.03)',
            border: '1px solid rgba(255,255,255,.10)',
            borderRadius: 8,
            padding: '8px 10px',
            marginTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          <div>
            <strong>Primary constraint:</strong> {style.primaryConstraint}
          </div>
          <div>
            <strong>Prefer:</strong> {style.constraintPrefer}
          </div>
          <div>
            <strong>Avoid:</strong> {style.constraintAvoid}
          </div>
          <div style={{ opacity: 0.6 }}>
            Editing semantic constraints, custom tone slots, and per-section line sliders ships in v1.51 (Pass 4). The
            settings above already feed the proxy worker's semantic-constraint engine.
          </div>
        </div>
      )}
    </section>
  );
}
