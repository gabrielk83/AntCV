// Writing-system registry loader + helpers. Single source of truth for the
// twelve canonical styles; bundles writingSystems/registry.json inline.

import registryRaw from '../../writingSystems/registry.json';

export type StyleId =
  | 'nordic-minimal'
  | 'achievement-driven'
  | 'measured-professional'
  | 'structured-professional'
  | 'mediterranean-formal'
  | 'prestige-structured'
  | 'credential-forward'
  | 'precision-formal'
  | 'context-rich'
  | 'cold-outreach'
  | 'research-formal'
  | 'hybrid-balanced';

export type LangCode = 'en' | 'da' | 'es' | 'zh';

export interface Range { min: number; max: number }

export interface Style {
  displayName: string;
  active: boolean;
  comingInRelease?: string;
  primaryConstraint: string;
  constraintAvoid: string;
  constraintPrefer: string;
  defaultToneChips: string[];
  lineDensity: 'low' | 'medium' | 'medium-high' | 'high';
  wordsPerBullet: Range;
  profileChars: Range;
  allowedLength: Range;
  sectionFormatDefaults: Record<string, string>;
  atsBehavior: string;
  compressionTolerance: string;
  contentRule: string;
  avoidRule: string;
  preserveCompressPriority: string[];
  recommendedPairings: { primary: string | null; alt: string | null };
  pairedSeniority: string[];
  legacyAliases: string[];
  glyphDensity?: string;
  glyphNotes?: string;
  exportInstruction?: string;
  sectionOrder?: string[];
}

export interface ToneChipMeta {
  effect: string;
  compatibleWith: 'all' | 'all-except' | string[];
  incompatibleWith?: string[];
}

export interface ConflictingChipPair {
  pair: [string, string];
  kind: 'length' | 'form' | 'ordering' | 'register';
}

export interface SharedBannedBases {
  words: Record<LangCode, string[]>;
  phrases: Record<LangCode, string[]>;
}

export interface WritingSystemRegistry {
  version: string;
  default: StyleId;
  activeAtCut: StyleId[];
  densityTiers: Record<string, { wordsPerBullet: Range; profileChars: Range; bulletsPerRole3pg: Range }>;
  styles: Record<StyleId, Style>;
  toneChipsCatalogue: Record<string, ToneChipMeta>;
  conflictingChips: ConflictingChipPair[];
  supportedLanguages: LangCode[];
  sharedBannedBases: SharedBannedBases;
  matching: {
    wordMode: string;
    phraseMode: string;
    sceOrder: string;
    retryPolicy: { maxRetries: number; thirdDraftBehaviour: string };
  };
  sectionFormatTaxonomy: string[];
}

export const REGISTRY = registryRaw as unknown as WritingSystemRegistry;
export const STYLES = REGISTRY.styles;
export const DEFAULT_STYLE: StyleId = REGISTRY.default;
export const STYLE_IDS: readonly StyleId[] = Object.keys(REGISTRY.styles) as StyleId[];
export const ACTIVE_STYLE_IDS: readonly StyleId[] = REGISTRY.activeAtCut;
export const SUPPORTED_LANGUAGES = REGISTRY.supportedLanguages;
export const TONE_CHIPS_CATALOGUE = REGISTRY.toneChipsCatalogue;
export const CONFLICTING_CHIPS = REGISTRY.conflictingChips;
export const SHARED_BANNED_BASES = REGISTRY.sharedBannedBases;

const LEGACY_STYLE_MAP: Record<string, StyleId> = (() => {
  const out: Record<string, StyleId> = {};
  for (const [id, s] of Object.entries(STYLES)) {
    out[id] = id as StyleId;
    out[s.displayName.toLowerCase()] = id as StyleId;
    for (const alias of s.legacyAliases) {
      out[alias.toLowerCase()] = id as StyleId;
    }
  }
  return out;
})();

export function normaliseStyleId(raw: unknown): StyleId {
  if (typeof raw !== 'string') return DEFAULT_STYLE;
  const lower = raw.trim().toLowerCase();
  if (lower in LEGACY_STYLE_MAP) return LEGACY_STYLE_MAP[lower];
  return DEFAULT_STYLE;
}

export function normaliseLangCode(raw: unknown): LangCode {
  if (typeof raw !== 'string') return 'en';
  const lower = raw.trim().toLowerCase();
  if (lower === 'da' || lower === 'es' || lower === 'zh') return lower;
  return 'en';
}

export function isActive(id: StyleId): boolean {
  return !!STYLES[id]?.active;
}

/**
 * Returns the chips that conflict with the given chip set. Used by the picker
 * UI to surface non-blocking flags per plan §4.6 "Tone chips that conflict
 * with the base style move the style to Hybrid Balanced (or Custom Tone)
 * automatically."
 */
export function detectChipConflicts(chips: readonly string[]): ConflictingChipPair[] {
  const set = new Set(chips);
  return CONFLICTING_CHIPS.filter((p) => set.has(p.pair[0]) && set.has(p.pair[1]));
}

/**
 * Returns true if `chip` is compatible with `styleId`. Used by the worker
 * and the picker to filter the chip catalogue down to the actionable list.
 */
export function isChipCompatible(chip: string, styleId: StyleId): boolean {
  const meta = TONE_CHIPS_CATALOGUE[chip];
  if (!meta) return false;
  if (meta.compatibleWith === 'all') return true;
  if (meta.compatibleWith === 'all-except') {
    return !(meta.incompatibleWith ?? []).includes(styleId);
  }
  return (meta.compatibleWith as string[]).includes(styleId);
}
