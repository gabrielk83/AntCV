// Custom-mode trigger evaluation per locked-source plan §3.3.
//
// The Unified Visual doc specifies five triggers:
//   a) Quick alternative within package → not Custom (no flag, no warning)
//   b) Off-palette colour          → Custom, no warning
//   c) Restricted font             → Custom, warning shown
//   d) Package-incompatible image  → Custom, no warning
//   e) Refresh without save        → discard Custom changes
//
// Triggers (b)/(c)/(d) need to know what "the package allows". Since the
// per-package allowed-font and allowed-image-shape lists are not formalised
// inside the locked source (only "headingFont", "bodyFont", "shape", and
// "imageSize" are named), the allow-list here is a conservative extension
// of those four: a font is allowed iff it equals the package's heading or
// body font (or appears in the global "always-allowed" list); a shape is
// allowed iff it equals the package's shape or shapeSecondary.
//
// Colour-allow-list is wider — any colour appearing in the five base tokens
// or in the four alt-pair hexes is on-palette. Everything else is off.

import { PACKAGES, type PackageId } from './packages';
import { readPackageState, writePackageState, applyPackageToBody } from './body-package';

export type TriggerSource = 'colour' | 'font' | 'image';

export interface TriggerEvaluation {
  /** Should we move to Custom mode? */
  shouldFlagCustom: boolean;
  /** Should we show a warning modal to the user? */
  shouldWarn: boolean;
  /** Suggested copy for the warning modal (English; localised by caller). */
  warningMessage?: string;
}

// Global fonts that any package accepts (system / parser-safe fallbacks).
const UNIVERSAL_FONTS = new Set<string>([
  'calibri',
  'arial',
  'helvetica',
  'system-ui',
  'sans-serif',
  'serif',
]);

function normaliseFont(name: string): string {
  return name
    .replace(/\s+bold$|\s+italic$|\s+regular$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function normaliseHex(c: string): string {
  return c.replace('#', '').toLowerCase();
}

function packageColourAllowList(pkg: PackageId): Set<string> {
  const p = PACKAGES[pkg];
  return new Set<string>([
    normaliseHex(p.base),
    normaliseHex(p.primary),
    normaliseHex(p.interactive),
    normaliseHex(p.bullet),
    normaliseHex(p.glyph),
    normaliseHex(p.alt1.head),
    normaliseHex(p.alt1.sidebar),
    normaliseHex(p.alt2.head),
    normaliseHex(p.alt2.sidebar),
    normaliseHex(p.dark.alt1.head),
    normaliseHex(p.dark.alt1.sidebar),
    normaliseHex(p.dark.alt2.head),
    normaliseHex(p.dark.alt2.sidebar),
  ]);
}

function packageFontAllowList(pkg: PackageId): Set<string> {
  const p = PACKAGES[pkg];
  return new Set<string>([
    normaliseFont(p.headingFont),
    normaliseFont(p.bodyFont),
    ...UNIVERSAL_FONTS,
  ]);
}

function packageImageShapeAllowList(pkg: PackageId): Set<string> {
  const p = PACKAGES[pkg];
  const out = new Set<string>([p.shape]);
  if (p.shapeSecondary) out.add(p.shapeSecondary);
  return out;
}

export interface ColourTriggerInput {
  source: 'colour';
  /** New colour value, hex string. Accepts # prefix or not. */
  value: string;
  /** Active package at the moment of the change. */
  packageId: PackageId;
}

export interface FontTriggerInput {
  source: 'font';
  /** New font family name. */
  value: string;
  /** Active package at the moment of the change. */
  packageId: PackageId;
  /** Override the "restricted = unknown" assumption — if the caller knows the font is restricted. */
  isRestricted?: boolean;
}

export interface ImageTriggerInput {
  source: 'image';
  /** Shape value the user selected. */
  shape: string;
  /** Active package at the moment of the change. */
  packageId: PackageId;
}

export type TriggerInput = ColourTriggerInput | FontTriggerInput | ImageTriggerInput;

export function evaluateCustomTrigger(input: TriggerInput): TriggerEvaluation {
  if (input.source === 'colour') {
    const allow = packageColourAllowList(input.packageId);
    const onPalette = allow.has(normaliseHex(input.value));
    if (onPalette) return { shouldFlagCustom: false, shouldWarn: false };
    return { shouldFlagCustom: true, shouldWarn: false };
  }

  if (input.source === 'font') {
    const allow = packageFontAllowList(input.packageId);
    const isAllowed = allow.has(normaliseFont(input.value));
    const restricted = input.isRestricted === true || !isAllowed;
    if (!restricted) return { shouldFlagCustom: false, shouldWarn: false };
    return {
      shouldFlagCustom: true,
      shouldWarn: true,
      warningMessage: `“${input.value}” is outside the ${PACKAGES[input.packageId].displayName} package. Saving will mark your style Custom.`,
    };
  }

  // image
  const allow = packageImageShapeAllowList(input.packageId);
  const onPalette = allow.has(input.shape);
  if (onPalette) return { shouldFlagCustom: false, shouldWarn: false };
  return { shouldFlagCustom: true, shouldWarn: false };
}

export function commitCustomTrigger(decision: TriggerEvaluation): void {
  if (!decision.shouldFlagCustom) return;
  const next = writePackageState({ isCustom: true });
  applyPackageToBody(next);
}

// Window-side helper for the vanilla app.js to call when its existing
// colour / font / image controls fire. Keeps the trigger ownership in one
// place and lets v1.50.1 wire each editor to this API without re-deriving
// the matching rules.
declare global {
  interface Window {
    AntcvCustomMode?: {
      evaluate: (input: TriggerInput) => TriggerEvaluation;
      commit: (decision: TriggerEvaluation) => void;
      readPackageId: () => PackageId;
    };
  }
}

export function installCustomModeApi(): void {
  window.AntcvCustomMode = {
    evaluate: evaluateCustomTrigger,
    commit: commitCustomTrigger,
    readPackageId: () => readPackageState().packageId,
  };
}
