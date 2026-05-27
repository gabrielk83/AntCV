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

export interface WritingPrefs {
  style: StyleId;
  chips: string[];
  extraBannedWords: BannedBucket;
  extraBannedPhrases: BannedBucket;
  extraConstraints: unknown[];
  overrides: Record<string, boolean>;
  savedSlots: unknown[];
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
    savedSlots: Array.isArray(wp.savedSlots) ? wp.savedSlots : [],
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

export function defaultStyleId(): StyleId {
  return DEFAULT_STYLE;
}
