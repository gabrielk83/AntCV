// Writing-engine glyph rules (plan §4.10). Shared between the PWA and the
// proxy worker so allowed bullets / contact glyphs / ATS replacements stay
// in lock-step.

export const ALLOWED_UNICODE_BULLETS = ['•', '◦', '▪', '✓', '→', '▲'] as const;
export type AllowedBullet = (typeof ALLOWED_UNICODE_BULLETS)[number];

export const ALLOWED_CONTACT_GLYPHS = ['☎', '✉', '🔗', '★', '⌂'] as const;
export type AllowedContactGlyph = (typeof ALLOWED_CONTACT_GLYPHS)[number];

export const ATS_GLYPH_LABELS: Readonly<Record<string, string>> = Object.freeze({
  '☎': 'Phone:',
  '✉': 'Email:',
  '🔗': 'Link:',
  '⌂': 'Location:',
  '★': 'Highlight:',
});

// Per-style contextual rules from plan §4.10 + style-matrix glyphDensity/glyphNotes.
export type GlyphDensity = 'sparse' | 'medium' | 'high' | 'header-only' | 'secondary-to-structure' | 'inherit';

export const STYLE_GLYPH_DENSITY: Readonly<Record<string, GlyphDensity>> = Object.freeze({
  'nordic-minimal': 'sparse',
  'cold-outreach': 'sparse',
  'precision-formal': 'sparse',
  'achievement-driven': 'medium',
  'measured-professional': 'medium',
  'context-rich': 'medium',
  'mediterranean-formal': 'medium',
  'prestige-structured': 'medium',
  'structured-professional': 'secondary-to-structure',
  'credential-forward': 'secondary-to-structure',
  'research-formal': 'header-only',
  'hybrid-balanced': 'inherit',
});

/**
 * Apply the §4.10 ATS-mode glyph→label conversion to a string. Used by the
 * proxy worker when ats:true on the request and by the DOCX worker when
 * rendering an ATS-safe export.
 */
export function applyAtsGlyphConversion(input: string): string {
  let out = input;
  for (const [glyph, label] of Object.entries(ATS_GLYPH_LABELS)) {
    // Use plain replaceAll — glyphs are single (or surrogate-pair) characters,
    // no regex needed.
    out = out.split(glyph).join(label);
  }
  return out;
}

/**
 * Returns true if `c` is a permitted Unicode bullet (used by the SCE step's
 * glyph filter). Allows the worker to strip rogue bullets before output.
 */
export function isAllowedBullet(c: string): boolean {
  return (ALLOWED_UNICODE_BULLETS as readonly string[]).includes(c);
}

export function isAllowedContactGlyph(c: string): boolean {
  return (ALLOWED_CONTACT_GLYPHS as readonly string[]).includes(c);
}

// Coarse colour-emoji detector — strips native emoji that aren't on the
// allow-list. Plan §4.10: "Native colour emoji — Not allowed."
export function isNativeColourEmoji(c: string): boolean {
  // Most native colour emoji sit in supplementary planes or have the VS16
  // emoji presentation selector. The allow-list above includes ✉ ★ ☎ ⌂
  // (text-presentation glyphs) and 🔗 (which is in the emoji block but is
  // explicitly allowed). Everything else with codepoint >= 0x1F000 and not
  // in the contact-glyph allow-list is rejected.
  if (isAllowedBullet(c) || isAllowedContactGlyph(c)) return false;
  const cp = c.codePointAt(0) ?? 0;
  return cp >= 0x1F000 && cp <= 0x1FFFF;
}
