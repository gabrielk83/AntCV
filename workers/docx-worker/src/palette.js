// workers/docx-worker/src/palette.js
// v1.50.8 — bundles the seven locked visual packages from
// packages/registry.json into the DOCX worker so generated documents
// reflect the user's PackagePicker selection.
//
// The canonical source for these values is packages/registry.json at
// the repo root. Cloudflare Workers can't cleanly import outside the
// worker directory at the existing wrangler build config, so the
// values are inlined here. When the registry changes, update this
// file by hand. Tests:
//
//   $ node -e "import('./palette.js').then(m => console.log(m.getPackageStyle('copenhagen-modern', false)))"
//
// Should print a DEFAULTS-shaped object with Copenhagen Modern values.

// ─── Locked package values — keep in sync with packages/registry.json ───

const PACKAGES = {
  'copenhagen-modern': {
    // SANDBOX item B (owner 2026-06-13): pale blue-grey sidebar/header/table
    // GROUND with dark ink. `base` stays the dark brand navy (it still drives
    // mainHeadColor on the white main column); `ground` is the new pale panel
    // colour used only for the sidebar/header/table backgrounds, and the
    // on-ground text colours invert to dark via readableInk() below.
    base: '283556', ground: 'C9D6EC', primary: '00746E', interactive: '0B74DE',
    bullet: '00746E', glyph: '0B74DE',
    headingFont: 'Segoe UI', bodyFont: 'Calibri',
  },
  'navy-executive': {
    base: '1D2B45', primary: 'D9A441', interactive: '6BC5C9',
    bullet: 'D9A441', glyph: 'D9A441',
    headingFont: 'Cambria', bodyFont: 'Calibri',
  },
  'warm-terracotta': {
    base: '8C4A32', primary: '5C2E1F', interactive: 'B85E3B',
    bullet: '5C2E1F', glyph: '5C2E1F',
    headingFont: 'Georgia', bodyFont: 'Georgia',
  },
  'nordic-frost': {
    base: '1A3A4F', primary: '4A8FA8', interactive: '3E82CC',
    bullet: '4A8FA8', glyph: '4A8FA8',
    headingFont: 'Trebuchet MS', bodyFont: 'Calibri',
  },
  'pampas-contemporary': {
    base: '1B2D5E', primary: '7A3B1E', interactive: '4B6CB7',
    bullet: '7A3B1E', glyph: '7A3B1E',
    headingFont: 'Palatino Linotype', bodyFont: 'Calibri',
  },
  'tokyo-precision': {
    base: '2C2C2C', primary: '4E5B6E', interactive: '5C7DA5',
    bullet: '4E5B6E', glyph: '4E5B6E',
    headingFont: 'Tahoma', bodyFont: 'Calibri',
  },
  'delhi-technical': {
    base: '1F3A5F', primary: '007C80', interactive: '00A6A6',
    bullet: '007C80', glyph: '007C80',
    headingFont: 'Segoe UI', bodyFont: 'Calibri',
  },
};

// Legacy package aliases — accepts old PWAs that send a non-canonical
// id and resolves to the closest current package.
const LEGACY_ALIASES = {
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

const DEFAULT_PACKAGE = 'copenhagen-modern';

// Universal palette tokens that don't vary per package. Same values as
// pwa/antcv-packages-registry.css's :root block.
const UNIVERSAL_MAIN_TEXT = '1F2937';
const UNIVERSAL_WHITE = 'FFFFFF';
const UNIVERSAL_DARK_INK = '283556';

// SANDBOX item B (owner 2026-06-13): the on-base text colours (sidebar text,
// candidate name/spec/contact, table header) used to be forced white, which
// goes invisible on a PALE package ground (Copenhagen). Pick the ink by the
// luminance of the package base so it is dark on light grounds and white on
// dark ones — same helper the PWA preview/export use. Hex is OOXML-style (no #).
function readableInk(hex) {
  try {
    const h = String(hex || '').replace('#', '');
    if (h.length < 6) return UNIVERSAL_WHITE;
    const r = parseInt(h.slice(0, 2), 16),
      g = parseInt(h.slice(2, 4), 16),
      b = parseInt(h.slice(4, 6), 16);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140 ? UNIVERSAL_DARK_INK : UNIVERSAL_WHITE;
  } catch (_) { return UNIVERSAL_WHITE; }
}

/**
 * Normalise an incoming package id to a canonical key. Accepts case-
 * insensitive input, legacy aliases, and trims whitespace. Returns the
 * default package id when input is missing or unknown.
 */
export function normalisePackageId(raw) {
  if (typeof raw !== 'string') return DEFAULT_PACKAGE;
  const lower = raw.trim().toLowerCase();
  if (PACKAGES[lower]) return lower;
  if (LEGACY_ALIASES[lower]) return LEGACY_ALIASES[lower];
  return DEFAULT_PACKAGE;
}

/**
 * Returns the DEFAULTS-shaped colour + font block that the existing
 * generate.js code path expects (see DEFAULTS at line ~64). When
 * `legacyAtsTier` is true, the body font is forced to Calibri so
 * legacy ATS parsers (Taleo pre-2018, iCIMS pre-2018, older
 * SuccessFactors) can extract the text without face-table issues.
 *
 * `mergeStyle()` in generate.js layers payload.style overrides on top
 * of this object, so any explicit PWA-supplied colour wins.
 */
export function getPackageStyle(packageId, legacyAtsTier = false) {
  const id = normalisePackageId(packageId);
  const p = PACKAGES[id];
  const bodyFont = legacyAtsTier ? 'Calibri' : p.bodyFont;
  // SANDBOX item B: the sidebar/header/table GROUND is `ground` when a package
  // defines a pale panel (Copenhagen), else the dark `base`. mainHeadColor and
  // the dark-ink targets keep using `base`. On-ground text inverts via
  // readableInk(ground) — dark on a pale ground, white on a dark one.
  const ground = p.ground || p.base;
  return {
    // Legacy aliases that pre-v1.50.8 code may still read.
    navy: p.base,
    accent: p.interactive,
    teal: p.primary,

    // Active style tokens consumed throughout generate.js.
    mainHeadColor: p.base,
    mainTextColor: UNIVERSAL_MAIN_TEXT,
    mainBulletColor: p.bullet,
    sidebarBg: ground,
    sidebarHeadColor: p.primary,
    sidebarTextColor: readableInk(ground),
    sidebarLabelColor: readableInk(ground),
    // The candidate band + table header keep the dark brand `base` (navy) with
    // white ink — only the SIDEBAR uses the pale `ground` (owner 2026-06-13).
    headerBg: p.base,
    headerNameColor: readableInk(p.base),
    headerSpecColor: readableInk(p.base),
    headerContactColor: readableInk(p.base),
    photoBorderColor: p.primary,
    tableHeaderBg: p.base,
    tableHeaderText: readableInk(p.base),

    // Fonts. The registry stores headingFont as e.g. "Segoe UI Bold";
    // OOXML treats the font name as a face name, and bold weight is
    // applied as a separate attribute on text runs. Strip the trailing
    // " Bold" so headings resolve to the family face and the bold
    // weight comes from each run's bold:true attribute (already set
    // for headings throughout generate.js).
    mainHeadFont: p.headingFont,
    mainBodyFont: bodyFont,
    sidebarFont: p.headingFont,
    sidebarBodyFont: bodyFont,
    headerFont: p.headingFont,
  };
}

/**
 * Public-id list for debugging / capabilities endpoints.
 */
export const SUPPORTED_PACKAGES = Object.keys(PACKAGES);

export const PALETTE_VERSION = '1.50.8';
