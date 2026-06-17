// personalInfo.writingPrefs — read/write helpers with the language-
// partitioned banned-list shape from plan §4.5.3.
//
// Shape stored under localStorage personalInfo.writingPrefs:
//   {
//     style: "nordic-minimal",
//     chips: ["calm", "factual"],
//     extraBannedWords:   { "en": [...], "da": [...], "es": [...], "zh": [...] },
//     extraBannedPhrases: { "en": [...], "da": [...], "es": [...], "zh": [...] },
//     extraConstraints:   [],
//     overrides:          { "chips": true|false, ... },
//     savedSlots:         []
//   }
//
// Plus personalInfo.layoutPrefs:
//   {
//     targetPages: 2,
//     lineLimits:    { <section>: number },
//     sectionFormats:{ <section>: string }
//   }
//
// Plus personalInfo.migrationVersion: "v1.50" (set by gabriel-migration.ts).

import {
  DEFAULT_STYLE,
  type LangCode,
  type StyleId,
  STYLES,
  SUPPORTED_LANGUAGES,
  normaliseLangCode,
  normaliseStyleId,
} from './writing-systems';

export type BannedBucket = Record<LangCode, string[]>;

/**
 * v1.50.12 — a saved snapshot of the user's writing-style configuration
 * (Pass 4 step 22). A slot captures the tone-relevant state only; layout
 * (targetPages, lineLimits, sectionFormats) and visual package live on
 * separate stores and are NOT included.
 */
export interface SavedToneSlot {
  id: string;
  name: string;
  savedAt: number;
  snapshot: {
    style: StyleId;
    chips: string[];
    extraBannedWords: BannedBucket;
    extraBannedPhrases: BannedBucket;
    extraConstraints: unknown[];
  };
}

export interface WritingPrefs {
  style: StyleId;
  chips: string[];
  extraBannedWords: BannedBucket;
  extraBannedPhrases: BannedBucket;
  extraConstraints: unknown[];
  overrides: Record<string, boolean>;
  savedSlots: SavedToneSlot[];
}

export interface LayoutPrefs {
  targetPages: number;
  lineLimits: Record<string, number>;
  sectionFormats: Record<string, string>;
}

interface PersonalInfoBlob {
  writingPrefs?: Partial<WritingPrefs>;
  layoutPrefs?: Partial<LayoutPrefs>;
  migrationVersion?: string;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* */ }
}

function emptyBannedBucket(): BannedBucket {
  return { en: [], da: [], es: [], zh: [] };
}

function normaliseBannedBucket(raw: unknown): BannedBucket {
  if (Array.isArray(raw)) {
    // Legacy shape — flat array. Migrate into the en bucket.
    return { en: raw.filter((x): x is string => typeof x === 'string'), da: [], es: [], zh: [] };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    const out = emptyBannedBucket();
    for (const lang of SUPPORTED_LANGUAGES) {
      const v = obj[lang];
      if (Array.isArray(v)) {
        out[lang] = v.filter((x): x is string => typeof x === 'string');
      }
    }
    return out;
  }
  return emptyBannedBucket();
}

function normaliseSavedSlot(raw: unknown): SavedToneSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.id !== 'string' || !s.id) return null;
  if (typeof s.name !== 'string') return null;
  const snap = s.snapshot && typeof s.snapshot === 'object' ? (s.snapshot as Record<string, unknown>) : {};
  return {
    id: s.id,
    name: s.name,
    savedAt: typeof s.savedAt === 'number' ? s.savedAt : Date.now(),
    snapshot: {
      style: normaliseStyleId(snap.style),
      chips: Array.isArray(snap.chips)
        ? (snap.chips as unknown[]).filter((x): x is string => typeof x === 'string')
        : [],
      extraBannedWords: normaliseBannedBucket(snap.extraBannedWords),
      extraBannedPhrases: normaliseBannedBucket(snap.extraBannedPhrases),
      extraConstraints: Array.isArray(snap.extraConstraints) ? snap.extraConstraints : [],
    },
  };
}

function normaliseSavedSlots(raw: unknown): SavedToneSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: SavedToneSlot[] = [];
  for (const item of raw) {
    const s = normaliseSavedSlot(item);
    if (s) out.push(s);
  }
  return out;
}

export function readWritingPrefs(): WritingPrefs {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const wp = pi.writingPrefs ?? {};
  return {
    style: normaliseStyleId(wp.style),
    chips: Array.isArray(wp.chips)
      ? (wp.chips as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
    extraBannedWords: normaliseBannedBucket(wp.extraBannedWords),
    extraBannedPhrases: normaliseBannedBucket(wp.extraBannedPhrases),
    extraConstraints: Array.isArray(wp.extraConstraints) ? wp.extraConstraints : [],
    overrides: (wp.overrides && typeof wp.overrides === 'object') ? wp.overrides as Record<string, boolean> : {},
    savedSlots: normaliseSavedSlots(wp.savedSlots),
  };
}

export function writeWritingPrefs(patch: Partial<WritingPrefs>): WritingPrefs {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const prev = readWritingPrefs();
  const merged: WritingPrefs = { ...prev, ...patch };
  pi.writingPrefs = merged;
  writeJSON('personalInfo', pi);
  try {
    window.dispatchEvent(new CustomEvent('antcv:writing-prefs-changed', { detail: merged }));
  } catch { /* */ }
  return merged;
}

export function readLayoutPrefs(): LayoutPrefs {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const lp = pi.layoutPrefs ?? {};
  const allowed = STYLES[normaliseStyleId(pi.writingPrefs?.style)]?.allowedLength;
  let target = typeof lp.targetPages === 'number' ? lp.targetPages : 2;
  if (allowed) {
    target = Math.max(allowed.min, Math.min(allowed.max, target));
  }
  return {
    targetPages: target,
    lineLimits: (lp.lineLimits && typeof lp.lineLimits === 'object')
      ? (lp.lineLimits as Record<string, number>)
      : {},
    sectionFormats: (lp.sectionFormats && typeof lp.sectionFormats === 'object')
      ? (lp.sectionFormats as Record<string, string>)
      : {},
  };
}

export function writeLayoutPrefs(patch: Partial<LayoutPrefs>): LayoutPrefs {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const prev = readLayoutPrefs();
  const merged: LayoutPrefs = { ...prev, ...patch };
  pi.layoutPrefs = merged;
  writeJSON('personalInfo', pi);
  try {
    window.dispatchEvent(new CustomEvent('antcv:layout-prefs-changed', { detail: merged }));
  } catch { /* */ }
  return merged;
}

/**
 * Add an item to the lang-partitioned bucket. Idempotent — duplicates skipped.
 */
export function addBannedItem(
  kind: 'words' | 'phrases',
  lang: LangCode,
  value: string,
): WritingPrefs {
  const prev = readWritingPrefs();
  const bucket = kind === 'words' ? { ...prev.extraBannedWords } : { ...prev.extraBannedPhrases };
  const lower = value.trim();
  if (!lower) return prev;
  const list = bucket[lang] ?? [];
  if (list.some((x) => x.toLowerCase() === lower.toLowerCase())) return prev;
  bucket[lang] = [...list, lower];
  return writeWritingPrefs(
    kind === 'words'
      ? { extraBannedWords: bucket }
      : { extraBannedPhrases: bucket },
  );
}

export function removeBannedItem(
  kind: 'words' | 'phrases',
  lang: LangCode,
  value: string,
): WritingPrefs {
  const prev = readWritingPrefs();
  const bucket = kind === 'words' ? { ...prev.extraBannedWords } : { ...prev.extraBannedPhrases };
  bucket[lang] = (bucket[lang] ?? []).filter((x) => x.toLowerCase() !== value.toLowerCase());
  return writeWritingPrefs(
    kind === 'words'
      ? { extraBannedWords: bucket }
      : { extraBannedPhrases: bucket },
  );
}

/**
 * v1.50.27 — bulk add. Accepts a raw string the user pasted (comma-,
 * newline-, or semicolon-separated) and appends every distinct,
 * non-empty item to the target bucket. Items already present in the
 * bucket (case-insensitive) are silently skipped — matches
 * addBannedItem semantics. Returns the number of items actually
 * appended via the second slot of the tuple so the UI can show a
 * "added N (M duplicates skipped)" status line.
 */
export function addBannedItems(
  kind: 'words' | 'phrases',
  lang: LangCode,
  raw: string,
): { prefs: WritingPrefs; added: number; skipped: number } {
  const prev = readWritingPrefs();
  const bucket = kind === 'words' ? { ...prev.extraBannedWords } : { ...prev.extraBannedPhrases };
  const list = bucket[lang] ? bucket[lang].slice() : [];
  const seen = new Set(list.map((x) => x.toLowerCase()));
  const candidates = raw
    .split(/[\n,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);
  let added = 0;
  let skipped = 0;
  for (const c of candidates) {
    const key = c.toLowerCase();
    if (seen.has(key)) { skipped++; continue; }
    seen.add(key);
    list.push(c);
    added++;
  }
  if (added === 0) return { prefs: prev, added: 0, skipped };
  bucket[lang] = list;
  const next = writeWritingPrefs(
    kind === 'words'
      ? { extraBannedWords: bucket }
      : { extraBannedPhrases: bucket },
  );
  return { prefs: next, added, skipped };
}

/**
 * v1.50.27 — wipe every entry in the given (kind, lang) bucket.
 * Useful as a "reset language" button. Other-language buckets are
 * left untouched.
 */
export function clearBannedBucket(
  kind: 'words' | 'phrases',
  lang: LangCode,
): WritingPrefs {
  const prev = readWritingPrefs();
  const bucket = kind === 'words' ? { ...prev.extraBannedWords } : { ...prev.extraBannedPhrases };
  if (!bucket[lang] || bucket[lang].length === 0) return prev;
  bucket[lang] = [];
  return writeWritingPrefs(
    kind === 'words'
      ? { extraBannedWords: bucket }
      : { extraBannedPhrases: bucket },
  );
}

/**
 * Detect the editor language for the banned-words / banned-phrases panel.
 * Falls back to enabled-languages first item, then 'en'.
 */
export function readEditorLanguage(): LangCode {
  try {
    const raw = localStorage.getItem('antcv:editor-language');
    if (raw) return normaliseLangCode(JSON.parse(raw));
  } catch { /* */ }
  try {
    const enabled = JSON.parse(localStorage.getItem('enabledLanguages') ?? '[]') as unknown[];
    if (Array.isArray(enabled) && enabled.length) {
      return normaliseLangCode(enabled[0]);
    }
  } catch { /* */ }
  return 'en';
}

export function writeEditorLanguage(lang: LangCode): void {
  try { localStorage.setItem('antcv:editor-language', JSON.stringify(lang)); } catch { /* */ }
  try { window.dispatchEvent(new CustomEvent('antcv:editor-language-changed', { detail: { lang } })); } catch { /* */ }
}

/**
 * Set the writing style and re-seed cascade-eligible fields per
 * cascade-rules.md, unless overrides[field] === true.
 */
export function setWritingStyleWithCascade(next: StyleId): WritingPrefs {
  const prev = readWritingPrefs();
  const style = STYLES[next];
  if (!style) return prev;

  const overrides = prev.overrides;
  const chips = overrides.chips ? prev.chips : style.defaultToneChips.slice();

  // lineLimits + sectionFormats live on layoutPrefs but cascade from the style.
  if (!overrides.sectionFormats) {
    const lp = readLayoutPrefs();
    writeLayoutPrefs({
      sectionFormats: { ...style.sectionFormatDefaults },
      targetPages: Math.min(style.allowedLength.max, Math.max(style.allowedLength.min, lp.targetPages)),
    });
  }

  return writeWritingPrefs({ style: next, chips });
}

export const DEFAULT_TARGET_PAGES_OPTIONS = [1, 1.5, 2, 2.5, 3, 4, 5] as const;

export type TargetPagesOption = (typeof DEFAULT_TARGET_PAGES_OPTIONS)[number];

// ─── Per-section layout (v1.50.14 — plan §7 Pass 4 step 21) ─────────────
//
// Section list mirrors skills/antcv-writer/references/cv-skeleton.md. Each
// section gets its own line-limit + format choice; the proxy worker reads
// the maps via the v1.50.1 fetch-wrap and emits a "Per-section overrides"
// block in the §4.7 system preamble.

export interface KnownSection { id: string; label: string }

export const KNOWN_SECTIONS: readonly KnownSection[] = [
  { id: 'profile',                label: 'Profile' },
  { id: 'core_competencies',      label: 'Core Competencies' },
  { id: 'selected_outcomes',      label: 'Selected Outcomes' },
  { id: 'experience',             label: 'Experience' },
  { id: 'tools_methods',          label: 'Tools & Methods' },
  { id: 'certifications',         label: 'Certifications' },
  { id: 'education',              label: 'Education' },
  { id: 'publications_patents',   label: 'Publications & Patents' },
  { id: 'additional_information', label: 'Additional Information' },
];

// v1.50.15 — academic sections from cv-skeleton-academic.md + research-
// formal's sectionOrder in writingSystems/registry.json. The LayoutPicker
// renders these as a separate group; per-section overrides flow through
// the worker preamble regardless of which style is currently active.
export const ACADEMIC_SECTIONS: readonly KnownSection[] = [
  { id: 'research_summary',           label: 'Research Summary' },
  { id: 'research_experience',        label: 'Research Experience' },
  { id: 'publications',               label: 'Publications (main)' },
  { id: 'selected_research_outcomes', label: 'Selected Research Outcomes' },
  { id: 'grants_fellowships',         label: 'Grants & Fellowships' },
  { id: 'conferences_talks',          label: 'Conferences & Talks' },
  { id: 'teaching_supervision',       label: 'Teaching & Supervision' },
  { id: 'technical_methods',          label: 'Technical Methods' },
  { id: 'industry_experience',        label: 'Industry Experience' },
  { id: 'professional_service',       label: 'Professional Service' },
  { id: 'work_style',                 label: 'Work Style' },
];

// v1.50.539 — cover-letter sections (owner 2026-06-17: the Layout picker was
// missing CL section control). Canonical keys from skills/antcv-writer/
// references/cl-skeleton.md. Only the format/length-variable body sections are
// exposed (cl_header / cl_opener / cl_close are fixed chrome). The per-section
// overrides flow to the worker via the same fetch-wrap maps as the CV sections.
export const CL_SECTIONS: readonly KnownSection[] = [
  { id: 'who_i_am',                label: 'Who I Am' },
  { id: 'what_i_bring',            label: 'What I Bring' },
  { id: 'why_this_position',       label: 'Why This Position' },
  { id: 'how_i_would_contribute',  label: 'How I Would Contribute' },
  { id: 'foundation',              label: 'Foundation' },
];

// 9-format taxonomy per plan §4.4 + writingSystems/registry.json
// `sectionFormatTaxonomy`. The picker offers these in order.
export interface SectionFormatOption { value: string; label: string }
export const SECTION_FORMAT_OPTIONS: readonly SectionFormatOption[] = [
  { value: 'default',         label: 'Default (style choice)' },
  { value: 'paragraph',       label: 'Paragraph' },
  { value: 'bullets',         label: 'Bullets' },
  { value: 'unicode-bullets', label: 'Unicode bullets' },
  { value: 'hybrid-1',        label: 'Hybrid 1' },
  { value: 'hybrid-2',        label: 'Hybrid 2' },
  { value: 'hybrid-3',        label: 'Hybrid 3' },
  { value: 'table-grid',      label: 'Table / Grid' },
  { value: 'structured-grid', label: 'Structured Grid' },
];

export const LINE_LIMIT_MIN = 1;
export const LINE_LIMIT_MAX = 15;

const LINE_LIMIT_BASE: Record<string, number> = {
  low: 3,
  medium: 4,
  'medium-high': 5,
  high: 6,
};

/**
 * Derive the default line-limit for `sectionId` from the active style's
 * lineDensity band, scaled by targetPages. The slider snaps to this when
 * the user hasn't explicitly set a value.
 *
 * The mapping is intentionally coarse — the LLM interprets the number
 * relative to the section (e.g. for `profile` it's lines of paragraph;
 * for `experience` it's bullets per role).
 */
export function defaultLineLimitFor(styleId: StyleId, targetPages: number): number {
  const tier = STYLES[styleId]?.lineDensity ?? 'medium';
  const base = LINE_LIMIT_BASE[tier] ?? 4;
  const scale = Math.max(0.5, Math.min(2.5, targetPages / 2));
  return Math.max(LINE_LIMIT_MIN, Math.min(LINE_LIMIT_MAX, Math.round(base * scale)));
}

/**
 * Resolve the line-limit currently in effect for a section. Returns the
 * user override when set, else the style+targetPages default.
 */
export function readSectionLineLimit(sectionId: string): number {
  const lp = readLayoutPrefs();
  const v = lp.lineLimits?.[sectionId];
  if (typeof v === 'number' && Number.isFinite(v)) {
    return Math.max(LINE_LIMIT_MIN, Math.min(LINE_LIMIT_MAX, Math.round(v)));
  }
  const wp = readWritingPrefs();
  return defaultLineLimitFor(wp.style, lp.targetPages);
}

export function writeSectionLineLimit(sectionId: string, value: number): LayoutPrefs {
  const lp = readLayoutPrefs();
  const next = { ...lp.lineLimits, [sectionId]: Math.max(LINE_LIMIT_MIN, Math.min(LINE_LIMIT_MAX, Math.round(value))) };
  return writeLayoutPrefs({ lineLimits: next });
}

export function clearSectionLineLimit(sectionId: string): LayoutPrefs {
  const lp = readLayoutPrefs();
  if (!(sectionId in (lp.lineLimits ?? {}))) return lp;
  const next = { ...lp.lineLimits };
  delete next[sectionId];
  return writeLayoutPrefs({ lineLimits: next });
}

/**
 * Resolve the section format currently in effect. Returns the user
 * override when set, else the style's sectionFormatDefaults entry, else
 * 'default'.
 */
export function readSectionFormat(sectionId: string): string {
  const lp = readLayoutPrefs();
  const v = lp.sectionFormats?.[sectionId];
  if (typeof v === 'string' && v) return v;
  const wp = readWritingPrefs();
  const styleDefault = STYLES[wp.style]?.sectionFormatDefaults?.[sectionId];
  if (typeof styleDefault === 'string' && styleDefault) return styleDefault;
  return 'default';
}

export function writeSectionFormat(sectionId: string, value: string): LayoutPrefs {
  const lp = readLayoutPrefs();
  const next = { ...lp.sectionFormats, [sectionId]: value };
  return writeLayoutPrefs({ sectionFormats: next });
}

export function clearSectionFormat(sectionId: string): LayoutPrefs {
  const lp = readLayoutPrefs();
  if (!(sectionId in (lp.sectionFormats ?? {}))) return lp;
  const next = { ...lp.sectionFormats };
  delete next[sectionId];
  return writeLayoutPrefs({ sectionFormats: next });
}

/**
 * Combined reset — drops both line-limit and format overrides for one
 * section so it falls back to the style defaults.
 */
export function resetSectionLayout(sectionId: string): LayoutPrefs {
  const lp = readLayoutPrefs();
  const nextLines = { ...lp.lineLimits };
  const nextFormats = { ...lp.sectionFormats };
  let changed = false;
  if (sectionId in nextLines) { delete nextLines[sectionId]; changed = true; }
  if (sectionId in nextFormats) { delete nextFormats[sectionId]; changed = true; }
  if (!changed) return lp;
  return writeLayoutPrefs({ lineLimits: nextLines, sectionFormats: nextFormats });
}

export function defaultStyleId(): StyleId {
  return DEFAULT_STYLE;
}

// ─── Custom tone slots (v1.50.12 — plan §7 Pass 4 step 22) ─────────────

function newSlotId(): string {
  try {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
  } catch { /* */ }
  return 'slot_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

function buildDefaultSlotName(existing: readonly SavedToneSlot[]): string {
  // "Slot 1", "Slot 2", … — first unused index.
  const used = new Set(existing.map((s) => s.name));
  for (let i = 1; i <= 999; i++) {
    const candidate = `Slot ${i}`;
    if (!used.has(candidate)) return candidate;
  }
  return `Slot ${existing.length + 1}`;
}

/**
 * Snapshot the current writing-prefs tone state into a new saved slot.
 * `name` defaults to "Slot N" using the lowest unused index. The slot is
 * appended; ordering is insertion-order.
 */
export function saveCurrentAsSlot(name?: string): WritingPrefs {
  const prev = readWritingPrefs();
  const slotName = (name && name.trim()) || buildDefaultSlotName(prev.savedSlots);
  const slot: SavedToneSlot = {
    id: newSlotId(),
    name: slotName,
    savedAt: Date.now(),
    snapshot: {
      style: prev.style,
      chips: prev.chips.slice(),
      extraBannedWords: { ...prev.extraBannedWords },
      extraBannedPhrases: { ...prev.extraBannedPhrases },
      extraConstraints: prev.extraConstraints.slice(),
    },
  };
  return writeWritingPrefs({ savedSlots: [...prev.savedSlots, slot] });
}

/**
 * Replace the current tone state with the slot's snapshot. Returns the
 * new WritingPrefs (or the previous one if the slot id is unknown). The
 * snapshot does NOT include layout prefs, so targetPages / lineLimits /
 * sectionFormats are left untouched.
 *
 * Setting `treatAsExplicit: true` (default) also flips the matching
 * `overrides` keys so the worker's style cascade leaves the user's
 * values alone on subsequent style changes.
 */
export function loadSlot(id: string, treatAsExplicit = true): WritingPrefs {
  const prev = readWritingPrefs();
  const slot = prev.savedSlots.find((s) => s.id === id);
  if (!slot) return prev;
  const overrides = treatAsExplicit
    ? { ...prev.overrides, chips: true }
    : prev.overrides;
  return writeWritingPrefs({
    style: slot.snapshot.style,
    chips: slot.snapshot.chips.slice(),
    extraBannedWords: { ...slot.snapshot.extraBannedWords },
    extraBannedPhrases: { ...slot.snapshot.extraBannedPhrases },
    extraConstraints: slot.snapshot.extraConstraints.slice(),
    overrides,
  });
}

/**
 * Rename a saved slot. No-op if the id is unknown or the name is empty.
 */
export function renameSlot(id: string, nextName: string): WritingPrefs {
  const trimmed = (nextName || '').trim();
  const prev = readWritingPrefs();
  if (!trimmed) return prev;
  const idx = prev.savedSlots.findIndex((s) => s.id === id);
  if (idx < 0) return prev;
  const next = prev.savedSlots.slice();
  next[idx] = { ...next[idx], name: trimmed };
  return writeWritingPrefs({ savedSlots: next });
}

/**
 * Delete a saved slot. No-op if the id is unknown.
 */
export function deleteSlot(id: string): WritingPrefs {
  const prev = readWritingPrefs();
  const next = prev.savedSlots.filter((s) => s.id !== id);
  if (next.length === prev.savedSlots.length) return prev;
  return writeWritingPrefs({ savedSlots: next });
}
