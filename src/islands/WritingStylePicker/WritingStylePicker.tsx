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
  addBannedItem,
  addBannedItems,
  clearBannedBucket,
  deleteSlot,
  loadSlot,
  readEditorLanguage,
  readLayoutPrefs,
  readWritingPrefs,
  removeBannedItem,
  renameSlot,
  saveCurrentAsSlot,
  setWritingStyleWithCascade,
  writeEditorLanguage,
  writeLayoutPrefs,
  writeWritingPrefs,
  type SavedToneSlot,
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

// Collapsible sub-section header (same register as SectionHeader) with a ▸/▾
// triangle. Collapsed by default (owner 2026-06-17 — banned words / phrases /
// semantic constraints all open on demand).
function CollapsibleHeader({ open, onToggle, children }: { open: boolean; onToggle: () => void; children: React.ReactNode }): JSX.Element {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left',
        background: 'transparent', border: 0, cursor: 'pointer', color: 'inherit',
        textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, fontSize: 11,
        opacity: 0.85, margin: '12px 0 6px', padding: 0,
      }}
    >
      <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      <span>{children}</span>
    </button>
  );
}

// v1.50.17 — native <option> elements on Windows/Chrome don't inherit
// their parent <select>'s color / background. Without explicit styling
// the dropdown reads near-invisible against the OS-default light menu.
// We force the same dark + light-text combination used elsewhere in the
// React-islands UI on every option element.
const DARK_OPTION_STYLE: React.CSSProperties = {
  background: '#283556',
  color: '#e6eef3',
};

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
        // v1.50.531 — dropped the "— was Scandinavian/Latam/…" legacy-alias
        // suffix (owner: the old register names are noise, not orientation).
        const suffix = disabled ? `  (Coming ${s.comingInRelease ?? 'soon'})` : '';
        return (
          <option key={id} value={id} disabled={disabled} style={DARK_OPTION_STYLE}>
            {s.displayName}
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

  // v1.50.25 — search filter. Matches the chip name OR its `effect`
  // text (case-insensitive substring). Active chips ALWAYS stay
  // visible even when they don't match the query, so the user never
  // loses sight of what they currently have selected.
  const [query, setQuery] = useState('');
  const filteredCompatible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return compatible;
    return compatible.filter((chip) => {
      if (chips.includes(chip)) return true; // always keep active chips
      if (chip.toLowerCase().includes(q)) return true;
      const effect = TONE_CHIPS_CATALOGUE[chip]?.effect ?? '';
      return effect.toLowerCase().includes(q);
    });
  }, [compatible, chips, query]);
  const hiddenByFilter = compatible.length - filteredCompatible.length;

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
      {compatible.length > 8 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${compatible.length} chips…`}
            aria-label="Filter tone chips"
            style={{
              flex: 1,
              padding: '5px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(255,255,255,.04)',
              color: '#e6eef3',
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear chip filter"
              title="Clear filter"
              style={{
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                borderRadius: 6,
                background: 'transparent',
                border: '1px solid rgba(255,255,255,.18)',
                color: '#e6eef3',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {filteredCompatible.map((chip) => {
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
        {filteredCompatible.length === 0 && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            No chips match “{query}”. Active chips would appear here if any were set.
          </span>
        )}
      </div>
      {query && hiddenByFilter > 0 && (
        <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4 }}>
          {hiddenByFilter} more {hiddenByFilter === 1 ? 'chip' : 'chips'} hidden by filter.
        </div>
      )}
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

function AutoShiftBanner({
  fromStyleLabel,
  onUndo,
  onDismiss,
}: {
  fromStyleLabel: string;
  onUndo: () => void;
  onDismiss: () => void;
}): JSX.Element {
  return (
    <div
      data-antcv-auto-shift-banner="1"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        marginBottom: 8,
        background: 'rgba(1,183,187,.10)',
        border: '1px solid rgba(1,183,187,.55)',
        borderRadius: 8,
        fontSize: 11,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 14 }}>↺</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>
        Switched style to <strong>Hybrid Balanced</strong> to absorb a chip conflict
        (was <strong>{fromStyleLabel}</strong>). The two registers coexist under
        Hybrid Balanced. The worker treats this as an intentional override.
      </span>
      <button
        type="button"
        onClick={onUndo}
        style={{
          padding: '3px 10px',
          background: 'rgba(1,183,187,.18)',
          color: '#e6eef3',
          border: '1px solid rgba(1,183,187,.55)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 11,
          fontWeight: 700,
        }}
      >
        Undo
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss banner"
        title="Dismiss"
        style={{
          padding: '3px 8px',
          background: 'transparent',
          color: '#e6eef3',
          opacity: 0.7,
          border: '1px solid rgba(255,255,255,.18)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 12,
        }}
      >
        ×
      </button>
    </div>
  );
}

function SavedTonesEditor({
  slots,
  onSave,
  onLoad,
  onRename,
  onDelete,
}: {
  slots: SavedToneSlot[];
  onSave: () => void;
  onLoad: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button
        type="button"
        onClick={onSave}
        style={{
          padding: '6px 12px',
          background: 'rgba(1,183,187,.18)',
          color: '#e6eef3',
          border: '1px solid rgba(1,183,187,.55)',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 700,
          fontSize: 12,
          alignSelf: 'flex-start',
        }}
      >
        + Save current as new slot
      </button>
      {slots.length === 0 && (
        <span style={{ fontSize: 11, opacity: 0.6 }}>
          No saved customs yet. Saving a slot snapshots the active style, chips, and banned-list buckets so you can switch back later.
        </span>
      )}
      {slots.map((s) => (
        <SavedToneRow key={s.id} slot={s} onLoad={() => onLoad(s.id)} onRename={(n) => onRename(s.id, n)} onDelete={() => onDelete(s.id)} />
      ))}
    </div>
  );
}

function SavedToneRow({
  slot,
  onLoad,
  onRename,
  onDelete,
}: {
  slot: SavedToneSlot;
  onLoad: () => void;
  onRename: (next: string) => void;
  onDelete: () => void;
}): JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(slot.name);
  useEffect(() => { if (!editing) setDraft(slot.name); }, [slot.name, editing]);

  const commit = useCallback(() => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== slot.name) onRename(trimmed);
    else setDraft(slot.name);
  }, [draft, slot.name, onRename]);

  const styleLabel = STYLES[slot.snapshot.style]?.displayName ?? slot.snapshot.style;
  const chipCount = slot.snapshot.chips.length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 8,
        alignItems: 'center',
        padding: '6px 8px',
        background: 'rgba(255,255,255,.04)',
        border: '1px solid rgba(255,255,255,.14)',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        {editing ? (
          <input
            type="text"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.currentTarget.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); (e.currentTarget as HTMLInputElement).blur(); }
              if (e.key === 'Escape') { setDraft(slot.name); setEditing(false); }
            }}
            style={{
              padding: '3px 6px',
              background: 'rgba(0,0,0,.18)',
              color: '#e6eef3',
              border: '1px solid rgba(1,183,187,.55)',
              borderRadius: 4,
              fontFamily: 'inherit',
              fontWeight: 700,
              fontSize: 13,
            }}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setEditing(true)}
            onClick={() => setEditing(true)}
            title="Click to rename"
            style={{
              background: 'transparent',
              border: 0,
              color: '#e6eef3',
              cursor: 'text',
              padding: 0,
              textAlign: 'left',
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {slot.name}
          </button>
        )}
        <span style={{ fontSize: 10, opacity: 0.6 }}>
          {styleLabel}{chipCount > 0 ? ` · ${chipCount} chip${chipCount === 1 ? '' : 's'}` : ''}
        </span>
      </div>
      <button
        type="button"
        onClick={onLoad}
        style={{
          padding: '4px 10px',
          background: 'rgba(1,183,187,.12)',
          color: '#e6eef3',
          border: '1px solid rgba(1,183,187,.45)',
          borderRadius: 6,
          cursor: 'pointer',
          fontWeight: 650,
          fontSize: 12,
        }}
      >
        Load
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete slot ${slot.name}`}
        title="Delete slot"
        style={{
          padding: '4px 8px',
          background: 'transparent',
          color: '#e6eef3',
          opacity: 0.65,
          border: '1px solid rgba(255,255,255,.18)',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        ×
      </button>
    </div>
  );
}

function BannedListEditor({
  kind,
  scopeLabel,
  items,
  bank,
  onAdd,
  onAddBulk,
  onRemove,
  onClearAll,
}: {
  kind: 'words' | 'phrases';
  scopeLabel: string;
  items: string[];
  bank?: readonly string[];
  onAdd: (value: string) => void;
  onAddBulk: (raw: string) => { added: number; skipped: number };
  onRemove: (value: string) => void;
  onClearAll: () => void;
}): JSX.Element {
  const [draft, setDraft] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkDraft, setBulkDraft] = useState('');
  const [bulkStatus, setBulkStatus] = useState<string>('');
  const [bankOpen, setBankOpen] = useState(false);
  const lowerSet = useMemo(() => new Set(items.map((i) => i.toLowerCase())), [items]);
  const bankUnused = useMemo(() => (bank || []).filter((b) => !lowerSet.has(b.toLowerCase())), [bank, lowerSet]);
  const placeholder = kind === 'words' ? `Add a banned word (${scopeLabel})` : `Add a banned phrase (${scopeLabel})`;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = draft.trim();
    if (!v) return;
    // v1.50.27 — accept comma/newline-separated paste in the single-
    // entry field too. Single token → addOne; multi → addBulk.
    if (/[\n,;]/.test(v)) {
      const { added, skipped } = onAddBulk(v);
      setBulkStatus(`Added ${added}${skipped > 0 ? ` (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped)` : ''}`);
      setTimeout(() => setBulkStatus(''), 2400);
    } else {
      onAdd(v);
    }
    setDraft('');
  };
  const bulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = bulkDraft.trim();
    if (!raw) return;
    const { added, skipped } = onAddBulk(raw);
    setBulkStatus(`Added ${added}${skipped > 0 ? ` (${skipped} duplicate${skipped === 1 ? '' : 's'} skipped)` : ''}`);
    setBulkDraft('');
    setTimeout(() => setBulkStatus(''), 2400);
  };
  const onClearConfirm = () => {
    if (items.length === 0) return;
    const ok = window.confirm(`Remove all ${items.length} ${kind} from ${scopeLabel}?`);
    if (ok) onClearAll();
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, fontSize: 11, opacity: 0.7 }}>
        <span>{items.length} item{items.length === 1 ? '' : 's'}</span>
        <button
          type="button"
          onClick={() => { setBulkOpen((v) => !v); setBulkStatus(''); }}
          aria-expanded={bulkOpen ? 'true' : 'false'}
          style={{
            background: 'transparent', border: 0, color: '#e6eef3',
            cursor: 'pointer', textDecoration: 'underline', fontSize: 11, padding: 0,
          }}
        >
          {bulkOpen ? 'Hide bulk paste' : 'Bulk paste'}
        </button>
        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearConfirm}
            title={`Remove all ${items.length} ${kind} from ${scopeLabel}`}
            style={{
              background: 'transparent', border: 0, color: '#e6eef3',
              cursor: 'pointer', textDecoration: 'underline', fontSize: 11, padding: 0,
            }}
          >
            Clear all
          </button>
        )}
        {bulkStatus && (
          <span style={{ marginLeft: 'auto', color: '#9be0a5' }}>{bulkStatus}</span>
        )}
      </div>
      {bulkOpen && (
        <form onSubmit={bulkSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
          <textarea
            value={bulkDraft}
            onChange={(e) => setBulkDraft(e.currentTarget.value)}
            placeholder={`Paste a list, one per line — or comma/semicolon-separated. Already-present items are skipped.`}
            rows={4}
            style={{
              padding: '6px 8px',
              background: 'rgba(255,255,255,.05)',
              color: '#e6eef3',
              border: '1px solid rgba(255,255,255,.18)',
              borderRadius: 6,
              fontFamily: 'inherit',
              fontSize: 12,
              resize: 'vertical',
            }}
          />
          <button
            type="submit"
            disabled={!bulkDraft.trim()}
            style={{
              alignSelf: 'flex-end',
              padding: '6px 14px',
              background: 'rgba(1,183,187,.18)',
              color: '#e6eef3',
              border: '1px solid rgba(1,183,187,.55)',
              borderRadius: 6,
              cursor: bulkDraft.trim() ? 'pointer' : 'not-allowed',
              opacity: bulkDraft.trim() ? 1 : 0.5,
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            Add all
          </button>
        </form>
      )}
      {bank && bank.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <button
            type="button"
            onClick={() => setBankOpen((v) => !v)}
            aria-expanded={bankOpen ? 'true' : 'false'}
            style={{ background: 'transparent', border: 0, color: '#a9c3cf', cursor: 'pointer', textDecoration: 'underline', fontSize: 11, padding: 0 }}
          >
            {bankOpen ? 'Hide bank' : `+ Pick from the bank (${bankUnused.length})`}
          </button>
          {bankOpen && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
              {bankUnused.length === 0 && (
                <span style={{ fontSize: 11, opacity: 0.6 }}>All bank items already added.</span>
              )}
              {bankUnused.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => onAdd(b)}
                  title={`Add "${b}"`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px',
                    fontSize: 12, borderRadius: 999, background: 'rgba(1,183,187,.08)',
                    border: '1px dashed rgba(1,183,187,.45)', color: '#cfeff0', cursor: 'pointer',
                  }}
                >
                  + {b}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
        {items.length === 0 && (
          <span style={{ fontSize: 11, opacity: 0.6 }}>
            No items in {scopeLabel} yet.
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

// v1.50.549 — BANNED-FUSION-001. The banned section is now the single superset
// control (owner's plan). A SCOPE selector adds "All languages" alongside the
// per-language tabs. "All" edits stylePrefs.banned_words/banned_phrases (the
// comma-string the generation prompt reads + applies to EVERY output language —
// cross-language); a specific language edits extraBannedWords[lang] (per-language,
// injected by the fetch-wrap). Plus a curated BANK ported from the app.js control.
export type BannedScope = 'all' | LangCode;
const SCOPE_LABELS: Record<BannedScope, string> = { all: 'All languages', en: 'EN', da: 'DA', es: 'ES', zh: 'ZH' };
const SCOPES: BannedScope[] = ['all', 'en', 'da', 'es', 'zh'];

// Curated bank, ported verbatim from the app.js control (ml / hl seed lists).
const BANNED_WORD_BANK: readonly string[] = [
  'spearhead', 'ensure', 'foster', 'streamline', 'strengthen', 'empower', 'leverage', 'drive',
  'deliver', 'enable', 'robust', 'comprehensive', 'cutting-edge', 'state-of-the-art', 'world-class',
  'leading', 'impactful', 'rooted', 'grounded', 'committed', 'passionate', 'holistic', 'multi-faceted',
  'cross-functional', 'tværgående', 'tværfunktionel', 'collaborative', 'central', 'journey', 'dynamic',
  'proactive', 'agile',
];
const BANNED_PHRASE_BANK: readonly string[] = [
  'key role', 'pivotal role', 'end-to-end', 'proven track record', 'strong communicator', 'strong leader',
  'results-driven', 'strategic mindset', 'client-focused', 'customer-centric', 'mission-driven',
  'My expertise lies in', 'I am known for', 'At the heart of my work', 'My approach is',
  'I am passionate about', 'I thrive in', 'I bring a wealth of experience', 'Proven ability to',
  'I am committed to', 'Passionate about driving', 'Known for fostering',
];

// Cross-language ("All") store = personalInfo.stylePrefs.banned_words / banned_phrases
// (a comma-string read by the generation prompt). Round-trips to an array here.
function readPersonalInfo(): Record<string, unknown> {
  try { return (JSON.parse(localStorage.getItem('personalInfo') || '{}') as Record<string, unknown>) || {}; } catch { return {}; }
}
function readAllScopeBanned(kind: 'words' | 'phrases'): string[] {
  const pi = readPersonalInfo();
  const sp = (pi.stylePrefs as Record<string, unknown>) || {};
  const raw = String((kind === 'words' ? sp.banned_words : sp.banned_phrases) || '');
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}
function writeAllScopeBanned(kind: 'words' | 'phrases', arr: string[]): void {
  const pi = readPersonalInfo();
  const sp = ((pi.stylePrefs as Record<string, unknown>) || {});
  sp[kind === 'words' ? 'banned_words' : 'banned_phrases'] = arr.join(', ');
  pi.stylePrefs = sp;
  try { localStorage.setItem('personalInfo', JSON.stringify(pi)); } catch { /* */ }
  try { (window as unknown as { _antcvCloudWrite?: (p: unknown) => void })._antcvCloudWrite?.({ personalInfo: pi }); } catch { /* */ }
  try { window.dispatchEvent(new StorageEvent('storage', { key: 'personalInfo' })); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:writing-prefs-changed')); } catch { /* */ }
}

// SEMANTIC-CONSTRAINTS-001 — the editor reads/writes stylePrefs.bannedContextual,
// the array the generation prompt ALREADY consumes (app.src.js ~2810): per-rule
// avoid + use_instead ("bank"/allowlist) + an optional WHEN condition (role title
// / company contains) = the owner's "conditions mix + per-role allowlist".
interface SemRule { avoid: string; use_instead: string; note: string; whenTitle: string; whenCompany: string }
function readSemRules(): SemRule[] {
  const pi = readPersonalInfo();
  const sp = (pi.stylePrefs as Record<string, unknown>) || {};
  const arr = Array.isArray(sp.bannedContextual) ? (sp.bannedContextual as Record<string, unknown>[]) : [];
  return arr.map((r) => {
    const when = (r.when as Record<string, unknown>) || {};
    return {
      avoid: String(r.avoid || r.pattern || ''),
      use_instead: String(r.use_instead || r.replacement || ''),
      note: String(r.note || ''),
      whenTitle: String(when.role_title || when.titleContains || ''),
      whenCompany: String(when.role_company || when.companyContains || ''),
    };
  });
}
function writeSemRules(rules: SemRule[]): void {
  const pi = readPersonalInfo();
  const sp = ((pi.stylePrefs as Record<string, unknown>) || {});
  sp.bannedContextual = rules
    .filter((r) => r.avoid.trim())
    .map((r) => ({
      avoid: r.avoid.trim(),
      use_instead: r.use_instead.trim(),
      note: r.note.trim(),
      when: { role_title: r.whenTitle.trim(), role_company: r.whenCompany.trim() },
    }));
  pi.stylePrefs = sp;
  try { localStorage.setItem('personalInfo', JSON.stringify(pi)); } catch { /* */ }
  try { (window as unknown as { _antcvCloudWrite?: (p: unknown) => void })._antcvCloudWrite?.({ personalInfo: pi }); } catch { /* */ }
  try { window.dispatchEvent(new StorageEvent('storage', { key: 'personalInfo' })); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:writing-prefs-changed')); } catch { /* */ }
}

function SemanticConstraintsEditor(): JSX.Element {
  const [rules, setRules] = useState<SemRule[]>(() => readSemRules());
  const commit = useCallback((next: SemRule[]) => { setRules(next); writeSemRules(next); }, []);
  const update = useCallback((i: number, patch: Partial<SemRule>) => {
    setRules((prev) => { const next = prev.map((r, j) => (j === i ? { ...r, ...patch } : r)); writeSemRules(next); return next; });
  }, []);
  const addRule = useCallback(() => commit([...rules, { avoid: '', use_instead: '', note: '', whenTitle: '', whenCompany: '' }]), [rules, commit]);
  const removeRule = useCallback((i: number) => commit(rules.filter((_, j) => j !== i)), [rules, commit]);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '5px 7px', background: 'rgba(255,255,255,.05)', color: '#e6eef3',
    border: '1px solid rgba(255,255,255,.18)', borderRadius: 5, fontFamily: 'inherit', fontSize: 12,
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.45 }}>
        Ban by <strong>meaning</strong>, not just exact words: each rule avoids a pattern and (optionally) suggests what to use instead. Add a <em>When</em> condition to scope a rule to roles whose title/company matches — the per-role allowlist. These feed the generation prompt directly.
      </div>
      {rules.map((r, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '8px 9px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8 }}>
          <input style={inputStyle} placeholder="Avoid (word, phrase, or meaning)" value={r.avoid} onChange={(e) => update(i, { avoid: e.currentTarget.value })} />
          <input style={inputStyle} placeholder="Use instead (optional)" value={r.use_instead} onChange={(e) => update(i, { use_instead: e.currentTarget.value })} />
          <div style={{ display: 'flex', gap: 5 }}>
            <input style={inputStyle} placeholder="When role title contains… (optional)" value={r.whenTitle} onChange={(e) => update(i, { whenTitle: e.currentTarget.value })} />
            <input style={inputStyle} placeholder="…or company contains…" value={r.whenCompany} onChange={(e) => update(i, { whenCompany: e.currentTarget.value })} />
          </div>
          <input style={inputStyle} placeholder="Why / note (optional)" value={r.note} onChange={(e) => update(i, { note: e.currentTarget.value })} />
          <button type="button" onClick={() => removeRule(i)} style={{ alignSelf: 'flex-end', background: 'transparent', border: '1px solid rgba(255,255,255,.18)', color: '#e6eef3', borderRadius: 5, fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}>Remove rule</button>
        </div>
      ))}
      {rules.length === 0 && <span style={{ fontSize: 11, opacity: 0.6 }}>No semantic rules yet. Add one to ban by meaning (e.g. avoid "led a team" → use "supervised technically" when the role isn't line-management).</span>}
      <button type="button" onClick={addRule} style={{ alignSelf: 'flex-start', background: 'rgba(1,183,187,.18)', border: '1px solid rgba(1,183,187,.55)', color: '#e6eef3', borderRadius: 6, fontWeight: 700, fontSize: 12, padding: '6px 12px', cursor: 'pointer' }}>+ Add semantic constraint</button>
    </div>
  );
}

function ScopeSelector({
  value,
  onChange,
}: {
  value: BannedScope;
  onChange: (scope: BannedScope) => void;
}): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {SCOPES.map((scope) => (
        <button
          key={scope}
          type="button"
          onClick={() => onChange(scope)}
          aria-pressed={value === scope}
          title={scope === 'all' ? 'Applies to every output language (after translation)' : `Only when generating in ${SCOPE_LABELS[scope]}`}
          style={{
            padding: '3px 8px',
            fontSize: 11,
            fontWeight: 700,
            textTransform: scope === 'all' ? 'none' : 'uppercase',
            borderRadius: 4,
            background: value === scope ? 'rgba(1,183,187,.18)' : 'transparent',
            border: '1px solid ' + (value === scope ? 'rgba(1,183,187,.55)' : 'rgba(255,255,255,.14)'),
            color: '#e6eef3',
            cursor: 'pointer',
          }}
        >
          {SCOPE_LABELS[scope]}
        </button>
      ))}
    </div>
  );
}

export function WritingStylePicker(): JSX.Element {
  const [prefs, setPrefs] = useState<WritingPrefs>(() => readWritingPrefs());
  const [, setLayout] = useState<LayoutPrefs>(() => readLayoutPrefs());
  const [editorLang, setEditorLang] = useState<LangCode>(() => readEditorLanguage());
  const [advanced, setAdvanced] = useState(false);
  // BANNED-FUSION-001 — scope: 'all' (cross-language, stylePrefs.banned_*) or a
  // per-language bucket (extraBanned*). Default 'all'. allWords/allPhrases mirror
  // the stylePrefs comma-string so edits re-render.
  const [bannedScope, setBannedScope] = useState<BannedScope>('all');
  const [allWords, setAllWords] = useState<string[]>(() => readAllScopeBanned('words'));
  const [allPhrases, setAllPhrases] = useState<string[]>(() => readAllScopeBanned('phrases'));
  // Collapsed-by-default sections (owner 2026-06-17).
  const [wordsOpen, setWordsOpen] = useState(false);
  const [phrasesOpen, setPhrasesOpen] = useState(false);

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

  // v1.50.13 — auto-shift state. Set when a chip toggle introduces a new
  // conflict; carries the prior style + chips so Undo restores them.
  const [autoShifted, setAutoShifted] = useState<{ fromStyle: StyleId; fromChips: string[] } | null>(null);

  const onStyleChange = useCallback((id: StyleId) => {
    if (!ACTIVE_STYLE_IDS.includes(id)) return;
    setPrefs(setWritingStyleWithCascade(id));
    setLayout(readLayoutPrefs());
    // Manual style change clears the auto-shift banner.
    setAutoShifted(null);
  }, []);

  const onChipsChange = useCallback((chips: string[]) => {
    const overrides = { ...prefs.overrides, chips: true };

    // v1.50.13 — chip-conflict auto-shift (plan §4.6). If the new chip
    // set introduces a conflict that wasn't there before AND the active
    // style isn't already hybrid-balanced, switch to hybrid-balanced and
    // remember the prior style + chips so the banner's Undo can restore.
    const prevConflicts = detectChipConflicts(prefs.chips).length;
    const nextConflicts = detectChipConflicts(chips).length;
    const conflictsIncreased = nextConflicts > prevConflicts;

    if (conflictsIncreased && prefs.style !== 'hybrid-balanced') {
      const fromStyle = prefs.style;
      const fromChips = prefs.chips.slice();
      // Single write — style + chips together so the worker's cascade
      // doesn't re-seed chips between writes.
      setPrefs(writeWritingPrefs({ style: 'hybrid-balanced', chips, overrides }));
      // Clamp targetPages to hybrid-balanced's range (1-3) if needed.
      const lp = readLayoutPrefs();
      const hybMax = STYLES['hybrid-balanced'].allowedLength.max;
      if (lp.targetPages > hybMax) {
        setLayout(writeLayoutPrefs({ targetPages: hybMax }));
      }
      setAutoShifted({ fromStyle, fromChips });
      return;
    }

    setPrefs(writeWritingPrefs({ chips, overrides }));
  }, [prefs.style, prefs.chips, prefs.overrides]);

  const onUndoAutoShift = useCallback(() => {
    if (!autoShifted) return;
    const overrides = { ...prefs.overrides, chips: true };
    setPrefs(writeWritingPrefs({
      style: autoShifted.fromStyle,
      chips: autoShifted.fromChips,
      overrides,
    }));
    setLayout(readLayoutPrefs());
    setAutoShifted(null);
  }, [autoShifted, prefs.overrides]);

  const onDismissAutoShift = useCallback(() => {
    setAutoShifted(null);
  }, []);

  // BANNED-FUSION-001 — scope-aware read/write. 'all' → stylePrefs.banned_*
  // (cross-language); a LangCode → extraBanned* bucket (per-language). The
  // 'all' lists also re-seed editorLang for the per-language helpers below.
  const setAll = useCallback((kind: 'words' | 'phrases', next: string[]) => {
    writeAllScopeBanned(kind, next);
    if (kind === 'words') setAllWords(next); else setAllPhrases(next);
  }, []);

  const onAddBanned = useCallback((kind: 'words' | 'phrases', value: string) => {
    const v = value.trim();
    if (!v) return;
    if (bannedScope === 'all') {
      const cur = kind === 'words' ? allWords : allPhrases;
      if (cur.some((x) => x.toLowerCase() === v.toLowerCase())) return;
      setAll(kind, [...cur, v]);
    } else {
      setPrefs(addBannedItem(kind, bannedScope, v));
    }
  }, [bannedScope, allWords, allPhrases, setAll]);

  const onAddBannedBulk = useCallback((kind: 'words' | 'phrases', raw: string): { added: number; skipped: number } => {
    if (bannedScope === 'all') {
      const cur = kind === 'words' ? allWords : allPhrases;
      const seen = new Set(cur.map((x) => x.toLowerCase()));
      let added = 0, skipped = 0;
      const next = cur.slice();
      raw.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean).forEach((tok) => {
        if (seen.has(tok.toLowerCase())) { skipped++; return; }
        seen.add(tok.toLowerCase()); next.push(tok); added++;
      });
      if (added) setAll(kind, next);
      return { added, skipped };
    }
    const { prefs: nextP, added, skipped } = addBannedItems(kind, bannedScope, raw);
    setPrefs(nextP);
    return { added, skipped };
  }, [bannedScope, allWords, allPhrases, setAll]);

  const onRemoveBanned = useCallback((kind: 'words' | 'phrases', value: string) => {
    if (bannedScope === 'all') {
      const cur = kind === 'words' ? allWords : allPhrases;
      setAll(kind, cur.filter((x) => x !== value));
    } else {
      setPrefs(removeBannedItem(kind, bannedScope, value));
    }
  }, [bannedScope, allWords, allPhrases, setAll]);

  const onClearBanned = useCallback((kind: 'words' | 'phrases') => {
    if (bannedScope === 'all') setAll(kind, []);
    else setPrefs(clearBannedBucket(kind, bannedScope));
  }, [bannedScope, setAll]);

  const onScopeChange = useCallback((scope: BannedScope) => {
    setBannedScope(scope);
    if (scope !== 'all') { writeEditorLanguage(scope); setEditorLang(scope); }
  }, []);

  const onSaveSlot = useCallback(() => {
    setPrefs(saveCurrentAsSlot());
  }, []);
  const onLoadSlot = useCallback((id: string) => {
    setPrefs(loadSlot(id));
    setLayout(readLayoutPrefs());
  }, []);
  const onRenameSlot = useCallback((id: string, name: string) => {
    setPrefs(renameSlot(id, name));
  }, []);
  const onDeleteSlot = useCallback((id: string) => {
    setPrefs(deleteSlot(id));
  }, []);

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
      {/* v1.50.552 (owner): single header in the app.js "WRITING STYLE" font
          register; the redundant "Style" sub-header is removed. The dropdown's
          own description carries the style note. */}
      <div
        style={{
          color: 'rgba(255,255,255,0.55)',
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 4,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
        }}
      >
        Writing style
      </div>
      <StyleDropdown value={prefs.style} onChange={onStyleChange} />
      <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>
        {style.contentRule}
      </div>

      <SectionHeader>Tone chips</SectionHeader>
      {autoShifted && (
        <AutoShiftBanner
          fromStyleLabel={STYLES[autoShifted.fromStyle]?.displayName ?? autoShifted.fromStyle}
          onUndo={onUndoAutoShift}
          onDismiss={onDismissAutoShift}
        />
      )}
      <ToneChipsEditor styleId={prefs.style} chips={prefs.chips} onChange={onChipsChange} />

      <SectionHeader>Saved customs</SectionHeader>
      <SavedTonesEditor
        slots={prefs.savedSlots}
        onSave={onSaveSlot}
        onLoad={onLoadSlot}
        onRename={onRenameSlot}
        onDelete={onDeleteSlot}
      />

      {/* v1.50.x — "Target CV length" removed from here. It now lives only in
          Advanced Styles (added by antcv-page-budget.js). Keeping a second
          copy in the Personal-tab picker was a confusing duplicate writing the
          same layout.targetPages. */}

      <CollapsibleHeader open={wordsOpen} onToggle={() => setWordsOpen((v) => !v)}>Banned words</CollapsibleHeader>
      {wordsOpen && (
        <>
          <div style={{ margin: '0 0 6px' }}>
            <ScopeSelector value={bannedScope} onChange={onScopeChange} />
          </div>
          <div style={{ fontSize: 10.5, opacity: 0.55, margin: '0 0 6px' }}>
            {bannedScope === 'all'
              ? 'Applies to every output language (also after translation).'
              : `Only when generating in ${SCOPE_LABELS[bannedScope]}.`}
          </div>
          <BannedListEditor
            kind="words"
            scopeLabel={SCOPE_LABELS[bannedScope]}
            items={bannedScope === 'all' ? allWords : (prefs.extraBannedWords[bannedScope] ?? [])}
            bank={BANNED_WORD_BANK}
            onAdd={(v) => onAddBanned('words', v)}
            onAddBulk={(raw) => onAddBannedBulk('words', raw)}
            onRemove={(v) => onRemoveBanned('words', v)}
            onClearAll={() => onClearBanned('words')}
          />
        </>
      )}

      <CollapsibleHeader open={phrasesOpen} onToggle={() => setPhrasesOpen((v) => !v)}>Banned phrases ({SCOPE_LABELS[bannedScope]})</CollapsibleHeader>
      {phrasesOpen && (
        <BannedListEditor
          kind="phrases"
          scopeLabel={SCOPE_LABELS[bannedScope]}
          items={bannedScope === 'all' ? allPhrases : (prefs.extraBannedPhrases[bannedScope] ?? [])}
          bank={BANNED_PHRASE_BANK}
          onAdd={(v) => onAddBanned('phrases', v)}
          onAddBulk={(raw) => onAddBannedBulk('phrases', raw)}
          onRemove={(v) => onRemoveBanned('phrases', v)}
          onClearAll={() => onClearBanned('phrases')}
        />
      )}

      {/* v1.50.552 — frameless header, same register + horizontal position as the
          Banned headers (owner). No bordered box around the editor. */}
      <CollapsibleHeader open={advanced} onToggle={() => setAdvanced((v) => !v)}>Semantic constraints</CollapsibleHeader>
      {advanced && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 2 }}>
          <SemanticConstraintsEditor />
          <div style={{ opacity: 0.5, fontSize: 10.5, lineHeight: 1.4 }}>
            Active style defaults — <strong>{style.primaryConstraint}</strong>; prefer {style.constraintPrefer}; avoid {style.constraintAvoid}.
          </div>
        </div>
      )}
    </section>
  );
}
