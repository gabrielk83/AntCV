// Package registry helpers — single source of truth for the seven
// visual packages. Bundles packages/registry.json inline so the React
// islands don't need an HTTP fetch (and so the bundle works offline).
//
// The CSS counterpart at pwa/antcv-packages-registry.css is generated
// from the same JSON by scripts/generate-registry-css.mjs.

import registryRaw from '../../packages/registry.json';

export type PackageId =
  | 'copenhagen-modern'
  | 'navy-executive'
  | 'warm-terracotta'
  | 'nordic-frost'
  | 'pampas-contemporary'
  | 'tokyo-precision'
  | 'delhi-technical';

export type QuickAlt = 'default' | 'alt1' | 'alt2';

export interface AltPair { head: string; sidebar: string }

export interface Package {
  displayName: string;
  base: string;
  primary: string;
  interactive: string;
  bullet: string;
  glyph: string;
  headingFont: string;
  bodyFont: string;
  shape: 'circle' | 'rounded' | 'rounded-square' | 'square' | 'hexagon';
  shapeSecondary?: 'circle' | 'rounded' | 'rounded-square' | 'square' | 'hexagon';
  imageSize: number;
  alt1: AltPair;
  alt2: AltPair;
  dark: { alt1: AltPair; alt2: AltPair };
}

interface RegistryShape {
  version: string;
  default: PackageId;
  packages: Record<PackageId, Package>;
  globalSemanticTokens: string[];
  allowedBullets: string[];
  allowedContactGlyphs: string[];
}

const registry = registryRaw as unknown as RegistryShape;

export const PACKAGES: Record<PackageId, Package> = registry.packages;
export const DEFAULT_PACKAGE: PackageId = registry.default;
export const PACKAGE_IDS: readonly PackageId[] = Object.keys(registry.packages) as PackageId[];
export const ALLOWED_BULLETS = registry.allowedBullets;
export const ALLOWED_CONTACT_GLYPHS = registry.allowedContactGlyphs;
export const GLOBAL_SEMANTIC_TOKENS = registry.globalSemanticTokens;

// Legacy package identifiers seen in existing personalInfo blobs. Map them
// onto the v1.50 canonical ids so a returning user keeps their look.
const LEGACY_PACKAGE_ALIASES: Record<string, PackageId> = {
  default: 'copenhagen-modern',
  copenhagen: 'copenhagen-modern',
  navy: 'navy-executive',
  executive: 'navy-executive',
  terracotta: 'warm-terracotta',
  warm: 'warm-terracotta',
  nordic: 'nordic-frost',
  frost: 'nordic-frost',
  pampas: 'pampas-contemporary',
  tokyo: 'tokyo-precision',
  precision: 'tokyo-precision',
  delhi: 'delhi-technical',
  technical: 'delhi-technical',
};

export function normalisePackageId(raw: unknown): PackageId {
  if (typeof raw !== 'string') return DEFAULT_PACKAGE;
  const lower = raw.trim().toLowerCase();
  if (lower in PACKAGES) return lower as PackageId;
  const alias = LEGACY_PACKAGE_ALIASES[lower];
  if (alias) return alias;
  return DEFAULT_PACKAGE;
}

export function normaliseQuickAlt(raw: unknown): QuickAlt {
  if (raw === 'alt1' || raw === 'alt2' || raw === 'default') return raw;
  return 'default';
}

export function isPackageId(id: string): id is PackageId {
  return id in PACKAGES;
}
