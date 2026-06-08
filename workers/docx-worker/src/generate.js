// AntCV DOCX generation using `docx` (npm).
//
// v1.1 changes (vs v1.0):
//   - Header name / subtitle / contact line honour the PWA's per-item
//     alignment (`header_align.{name,specialisation,contact}`).
//   - Citizenship / legal status added to the contact line.
//   - Contact-line icons re-mapped to the same Unicode glyphs the PWA
//     preview uses (△ ★ @ ☎ •) instead of emoji or the older ⌂ "in" set.
//   - text_inline sections render the title inline as bold-coloured first
//     run rather than as a separate heading + horizontal rule. This is
//     the "Work Style: …" pattern from the preview.
//   - Experience role-line uses tab stops: "[Role title], [Company]" left,
//     "[YYYY – YYYY]" right. No more single-line " │ " strip.
//   - Sidebar labels (TOOLS & METHODS, ADDITIONAL INFO etc.) bold but
//     white, not teal — matches preview.
//   - Education in sidebar: all white, no teal accent.
//   - Section type 'list' / 'list_italic' supports `bullet_style: 'none'`
//     and `align: 'center' | 'left'` so CERTIFICATIONS / PUBLICATIONS
//     render as a centred list with no bullet points.
//   - labeled_list supports subsection headers via items shaped
//     `{ group: 'Subhead' }` — used by REGULATORY CONTEXT.
//   - Inline `<b>...</b>` and `<i>...</i>` tags in text/bullet content
//     are parsed into proper bold/italic runs (not rendered literally).
//   - Competency table header alignment honours `s.headerAlign` from
//     the section payload.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  BorderStyle,
  WidthType,
  ShadingType,
  VerticalAlign,
  PageOrientation,
  HeightRule,
  TabStopType,
  TabStopPosition,
  BookmarkStart,
  BookmarkEnd,
} from './vendor/docx.mjs';

import { postProcessDocx } from './post-process.js';
import { getPackageStyle, normalisePackageId } from './palette.js';

const PAGE_W = 11906;
const PAGE_H = 16838;
// Default column widths in DXA (1440 DXA = 1 inch).
//   3.22" sidebar = 4636 DXA  →  matches the PWA preview's sidebar width
//   5.05" main    = 7270 DXA  →  remainder of A4 page width
// These can be overridden via payload.layout_widths.{sidebar,main} but the
// defaults match what the user wants out of the box.
const SIDEBAR_W = 4636;
const MAIN_W = PAGE_W - SIDEBAR_W;
const EMU_PER_INCH = 914400;

const DEFAULTS = {
  navy: '283556',
  accent: '01B7BB',
  teal: '00746E',
  // v1.40.135 — main head colour bumped from '00746E' (old teal) to
  // '1B627F' to match the candidate-section header band. This is the
  // colour used for both the "Application: ..." top band and the
  // WHAT I BRING / CORE COMPETENCIES table header shading, so the
  // two elements visually line up across the document. The PWA can
  // still override either via `payload.style`.
  mainHeadColor: '1B627F',
  mainTextColor: '333333',
  mainBulletColor: '1B627F',
  sidebarBg: '283556',
  sidebarHeadColor: '01B7BB',
  sidebarTextColor: 'FFFFFF',
  sidebarLabelColor: 'FFFFFF',     // labels in sidebar (TOOLS & METHODS first words) — white not teal
  // v1.40.135 — candidate header band aligned with mainHeadColor so
  // the top "Application: ..." block matches the WHAT I BRING table
  // header by default.
  headerBg: '1B627F',
  headerNameColor: 'FFFFFF',
  headerSpecColor: 'FFFFFF',
  headerContactColor: 'FFFFFF',
  photoBorderColor: '01B7BB',
  mainHeadFont: 'Trebuchet MS',
  mainBodyFont: 'Calibri',
  sidebarFont: 'Trebuchet MS',     // headings only
  sidebarBodyFont: 'Calibri',      // body content (lists, labels, paragraphs)
  headerFont: 'Trebuchet MS',
};

const FONT_DEFAULTS = {
  mainBody: 10.5,
  mainHead: 11,
  sbBody: 10,
  sbHead: 11,
  nameSize: 16,
  specialisation: 11,
  contactSize: 9,
  expSubHead: 10.5,
  bulletContent: 10.5,
  mainTblH: 10.5,
  mainTblCell: 10,
};

const pt2hp = (pt) => Math.round(Number(pt) * 2);
const hex   = (s) => (s || '').toString().replace(/^#/, '').toUpperCase();

// align: 'left' | 'center' | 'right' | 'justify' → AlignmentType.*
function alignType(a) {
  switch ((a || '').toLowerCase()) {
    case 'center':  return AlignmentType.CENTER;
    case 'right':   return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    default:        return AlignmentType.LEFT;
  }
}

// v1.14.3 — section-level CJLR helper.
//
// Returns an AlignmentType for paragraphs in section `s` when
// the PWA's antcv-item-align sidecar (and docx-client) populated
// `s.item_alignment`. Resolution order:
//   1. Per-item override at `s.item_alignment[path]` (if path given)
//   2. Section group default at `s.item_alignment.__group__`
//   3. The renderer's own fallback (passed in as `fallback`)
//
// `fallback` can be either an AlignmentType (e.g.
// AlignmentType.JUSTIFIED) or a plain string the renderer's
// existing code path produces — we coerce strings via
// `alignType` so existing patterns like
//     alignment: opts.align || AlignmentType.JUSTIFIED
// work unchanged when CJLR isn't set.
function paraAlign(s, path, fallback) {
  const m = s && s.item_alignment;
  if (m && typeof m === 'object') {
    if (path && (m[path] === 'left' || m[path] === 'center' || m[path] === 'right' || m[path] === 'justify')) {
      return alignType(m[path]);
    }
    const g = m.__group__;
    if (g === 'left' || g === 'center' || g === 'right' || g === 'justify') {
      return alignType(g);
    }
  }
  if (fallback == null) return undefined;
  if (typeof fallback === 'string') return alignType(fallback);
  return fallback;
}

// Returns true iff the section has any CJLR alignment data
// (group or per-item). Lets renderers short-circuit when
// nothing's set.
function hasItemAlign(s) {
  const m = s && s.item_alignment;
  if (!m || typeof m !== 'object') return false;
  for (const k of Object.keys(m)) {
    const v = m[k];
    if (v === 'left' || v === 'center' || v === 'right' || v === 'justify') return true;
  }
  return false;
}

// Path-only lookup — returns the AlignmentType ONLY when the
// specific edit-path has an override. Returns null when there's
// no override for that path, EVEN IF the group default is set.
// Use this when a renderer wants to try several candidate paths
// in priority order before falling back to the group default.
function paraAlignPath(s, path) {
  const m = s && s.item_alignment;
  if (!m || typeof m !== 'object' || !path) return null;
  const v = m[path];
  return (v === 'left' || v === 'center' || v === 'right' || v === 'justify')
    ? alignType(v) : null;
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
  }
  return '';
}

function normalizeBoolishText(v, trueText = 'EU Citizen') {
  if (v === true) return trueText;
  if (v === false || v === null || v === undefined) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (/^(true|yes|ja)$/i.test(s)) return trueText;
  return s;
}

function previewAlign(payload, key, fallback = 'left') {
  const candidates = [
    payload?.header_align?.[key],
    payload?.preview_align?.[key],
    payload?.previewAlign?.[key],
    payload?.align?.[key],
    payload?.alignment?.[key],
  ];
  return String(firstNonEmpty(...candidates, fallback)).toLowerCase();
}

function contactGlyph(icon) {
  const s = String(icon || '').trim();
  const map = new Map([
    ['📍', '△'], ['location', '△'], ['pin', '△'], ['address', '△'], ['△', '△'],
    ['🛂', '★'], ['citizenship', '★'], ['passport', '★'], ['eu', '★'], ['★', '★'],
    ['📧', '@'], ['email', '@'], ['mail', '@'], ['@', '@'],
    ['📞', '☎'], ['phone', '☎'], ['tel', '☎'], ['telephone', '☎'], ['☎', '☎'],
    ['🔗', '•'], ['link', '•'], ['linkedin', '•'], ['website', '•'], ['url', '•'], ['•', '•'],
  ]);
  return map.get(s.toLowerCase()) || map.get(s) || '•';
}

function decodeBasicEntities(s) {
  return String(s ?? '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, '\u00A0');
}

function stripInlineHtmlTags(s) {
  return decodeBasicEntities(s).replace(/<\/?\s*(?:b|strong|i|em)\b[^>]*>/gi, '');
}

function isNoBulletCenteredSection(s) {
  const t = String(s?.title || s?.id || '').toLowerCase();
  return /certifications?|publications?/.test(t);
}

// CERTIFICATIONS render centred, no bullets. PUBLICATIONS render
// justified, no bullets — matches the preview where multi-line citation
// strings ("Author A, Author B (2018) Title …, Journal …") need to wrap
// across the line nicely and shouldn't be centred.
function isPublicationsSection(s) {
  const t = String(s?.title || s?.id || '').toLowerCase();
  return /publications?/.test(t) || /\bpatent\b/.test(t);
}

// v1.50.19 — academic reference / citation sections. When the active
// writing style is `research-formal` AND the section is one of these,
// the renderer applies a hanging-indent + justified layout with no
// bullets, matching the academic CV reference convention (first line
// flush left, wrapped lines indented under the title).
//
// Identification is by stable section id first (matches src/lib/
// writing-prefs.ts ACADEMIC_SECTIONS), then by title text as a
// fallback for old payloads that pre-date the id rename.
function isAcademicReferenceSection(s) {
  const id = String(s?.id || '').toLowerCase().replace(/[\s-]+/g, '_').trim();
  const ACADEMIC_IDS = new Set([
    'publications',
    'publications_main',
    'selected_research_outcomes',
    'grants_fellowships',
    'conferences_talks',
    'research_experience',
  ]);
  if (ACADEMIC_IDS.has(id)) return true;
  // Title fallback — only used when id is empty / unrecognised. The
  // narrow set of phrases here avoids hijacking unrelated sections.
  const t = String(s?.title || '').toLowerCase();
  if (/\b(?:grants?|fellowships?)\b/.test(t)) return true;
  if (/\bconferences?\b/.test(t) && /\btalks?\b/.test(t)) return true;
  if (/\bselected\s+research\s+outcomes?\b/.test(t)) return true;
  if (/\bresearch\s+experience\b/.test(t)) return true;
  return false;
}

// Split a publication citation into <name> + <description> at the first
// em-dash, en-dash, or colon. Returns { name, rest }. Used to render
// publication entries with the name in bold italic and the rest in
// normal style (user spec).
function splitPublicationCitation(s) {
  const str = String(s || '');
  // Match the FIRST top-level separator. Em-dash (—), en-dash (–),
  // or colon, with optional surrounding spaces. We deliberately do
  // NOT split on a hyphen-minus because hyphens appear inside titles
  // (e.g., "MOS-based detectors").
  const m = str.match(/^([^\u2014\u2013:]+?)\s*[\u2014\u2013:]\s*(.+)$/);
  if (m) return { name: m[1].trim(), rest: m[2].trim() };
  return { name: str, rest: '' };
}

function isWorkStyleSection(s) {
  const id = String(s?.id || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  const t  = String(s?.title || '').toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  // Stable section id wins regardless of UI language.
  if (id === 'work style' || id === 'workstyle' || id === 'work_style') return true;
  // English + Danish title strings the PWA emits.
  return (
    t === 'work style' || t === 'workstyle' ||
    t === 'arbejdsstil' || t === 'arbejdsform' || t === 'arbejdsform stil' ||
    t === 'min arbejdsstil' || t === 'personlig stil' || t === 'arbejdsmetode'
  );
}

// ──────────────────────────────────────────────────────────────────
// Inline HTML → docx run array.
// Supports <b>...</b> and <i>...</i> (and their longer forms <strong>,
// <em>). Anything else passes through as literal text.
// ──────────────────────────────────────────────────────────────────
function inlineRuns(text, baseRun) {
  const out = [];
  if (text === null || text === undefined) return out;
  const s = decodeBasicEntities(text);
  if (!/<\/?\s*(b|strong|i|em)\b/i.test(s)) {
    out.push(new TextRun({ ...baseRun, text: s }));
    return out;
  }
  const re = /<\s*(\/?)\s*(b|strong|i|em)\b[^>]*>/ig;
  let bold = false;
  let italic = false;
  let cursor = 0;
  let m;
  while ((m = re.exec(s)) !== null) {
    const before = s.slice(cursor, m.index);
    if (before) {
      out.push(new TextRun({
        ...baseRun,
        text: before,
        bold: Boolean(bold || baseRun.bold),
        italics: Boolean(italic || baseRun.italics),
      }));
    }
    const close = m[1] === '/';
    const tag = m[2].toLowerCase();
    if (tag === 'b' || tag === 'strong') bold = !close;
    if (tag === 'i' || tag === 'em') italic = !close;
    cursor = m.index + m[0].length;
  }
  const tail = s.slice(cursor);
  if (tail) {
    out.push(new TextRun({
      ...baseRun,
      text: tail,
      bold: Boolean(bold || baseRun.bold),
      italics: Boolean(italic || baseRun.italics),
    }));
  }
  return out;
}
// ──────────────────────────────────────────────────────────────────
// Public entry
// ──────────────────────────────────────────────────────────────────
export async function generateDocx(payload) {
  // v1.50.8 — when the PWA sends `package` (locked-source plan §3) the
  // worker derives its base palette from packages/registry.json via
  // palette.js. payload.style is then layered on top so explicit user
  // overrides still win. When `package` is absent (pre-v1.50.8 PWAs),
  // mergeStyle starts from the legacy DEFAULTS — guaranteed-identical
  // behaviour for existing clients.
  const style = mergeStyle(payload.style || {}, payload.package, payload.legacy_ats_tier === true);
  const fontSizes = { ...FONT_DEFAULTS, ...(payload.font_sizes || {}) };
  const lang = payload.language || 'en';
  // PB-003: continuation suffix localised against `lang`. Mirrors the
  // PWA-side antcv-i18n key 'pb.cont'. Falls back to English.
  const CONT_SUFFIX = { en: '(CONT.)', da: '(FORTS.)', es: '(CONT.)', zh: '（续）' };
  const contSuffix = CONT_SUFFIX[lang] || CONT_SUFFIX.en;
  const layout = payload.layout || (payload.doc === 'cl' ? 'linear' : 'two_column');
  const headerAlign = {
    name: previewAlign(payload, 'name', 'center'),
    specialisation: previewAlign(payload, 'specialisation', previewAlign(payload, 'subtitle', 'center')),
    contact: previewAlign(payload, 'contact', 'center'),
  };

  const ctx = {
    style,
    fs: fontSizes,
    lang,
    contSuffix,
    pi: payload.personal_info || {},
    meta: payload.meta || {},
    doc: payload.doc,
    headerAlign,
    sections: Array.isArray(payload.sections) ? payload.sections.filter(s => s.on !== false) : [],
    // v1.14.8: per-item page assignments from the PWA's
    // antcv:itemPages map. Shape: { '<sid>': { '<itemIdx>': <page> } }.
    // renderLabeledList consumes this to insert page-break-before
    // paragraphs ahead of each item flagged for page ≥ 2, mirroring
    // the preview-side renderer in antcv-item-pages-render.js.
    itemPages: (payload.item_pages && typeof payload.item_pages === 'object')
      ? payload.item_pages : {},
    // v1.14.8: per-panel default alignment from the PWA's
    // personalInfo.stylePrefs.panelDefaultAlignment map. Shape:
    // { topbar|sidebar|main: 'left'|'center'|'right'|'justify' }.
    // Falls back to the existing per-loc defaults when absent.
    panelDefaultAlignment: (payload.panel_default_alignment && typeof payload.panel_default_alignment === 'object')
      ? payload.panel_default_alignment : null,
    // Worker version stamp — propagated into the Document's
    // `description` property so the .docx itself records which
    // version of the worker generated it. Lets us tell at a glance
    // whether a bug report refers to old or new code.
    workerVersion: payload._workerVersion || '',
    // v1.50.19 — active writing style (e.g. 'research-formal'). The
    // PWA reads localStorage personalInfo.writingPrefs.style and
    // forwards it on every export. Used by renderSimpleList /
    // renderLabeledList to apply hanging-indent + justified layout
    // for academic reference sections under research-formal. Absent
    // when an older PWA bundle posts — falls back to legacy behaviour.
    writingStyle: typeof payload.writing_style === 'string'
      ? payload.writing_style.trim().toLowerCase()
      : '',
    // Owner 2026-06-05: AI watermark goes to whichever COLUMN's text ends
    // higher (empty space below it). The PWA measures the live preview and
    // forwards the page side here ('left'|'right'); buildTwoColumnDocument
    // maps it to the sidebar/main cell. Absent → null → default to main.
    aiWmSide: (payload.ai_wm_side === 'left' || payload.ai_wm_side === 'right')
      ? payload.ai_wm_side
      : null,
    // contCounter is incremented inside `headingParagraph` to allocate
    // a unique placeholder + bookmark id per section heading. The
    // post-processor pairs each placeholder with its bookmark by this
    // numeric id.
    contCounter: 0,
  };

  const document = (layout === 'two_column')
    ? buildTwoColumnDocument(ctx)
    : buildLinearDocument(ctx);

  const raw = await Packer.toBuffer(document);

  // Post-process the .docx bytes to inject conditional `(Cont.)`
  // field codes at every section-heading placeholder. See
  // ./post-process.js for the full rationale; in short, this rewrites
  // each `__ANTCV_CONT_<N>__` run with a complex Word field that
  // evaluates to "(Cont.)" only on continuation pages and to "" on
  // the section's first page.
  //
  // The post-process is wrapped in try/catch so a failure (malformed
  // XML, zip parse issue, regex edge case, OOM) does NOT block the
  // export. The raw docx from Packer.toBuffer is always a valid
  // OOXML document — it just lacks the (Cont.) field codes on
  // continuation pages. Returning raw with a `failed` status lets
  // the worker emit headers the PWA can surface as a warning banner,
  // rather than rejecting the export entirely.
  let buffer = raw;
  let postProcessStatus = 'skipped';
  let replacements = 0;
  let postProcessError = null;
  let markersRemaining = 0;

  try {
    /* v1.12: pass watermark from payload through to post-processor. The
       PWA sets watermark="DEMO" when /config reports demo_mode=true. */
    const result = postProcessDocx(raw, { watermark: payload.watermark || '', headerBg: (style && style.headerBg) || '' });
    buffer = result.buffer;
    replacements = result.replacements || 0;

    // Inspect the produced document.xml to confirm no placeholders
    // remain. If some do, the post-process matched some but not
    // all — Word will still open the file but stray __ANTCV_CONT_…
    // markers will be visible in headings on continuation pages.
    // That's a partial success that the PWA should warn about.
    if (replacements > 0) {
      try {
        // Quick scan — convert UTF-8 bytes to string and look for
        // the marker. fflate is already imported by post-process.js
        // so the buffer is unzippable; we keep this check cheap.
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        // Sample the bytes for the literal marker string. The marker
        // is ASCII so a direct byte search avoids unzip cost.
        const marker = [95,95,65,78,84,67,86,95,67,79,78,84,95]; // "__ANTCV_CONT_"
        markersRemaining = countByteMatches(bytes, marker);
      } catch (_) { /* scanning failure is non-fatal */ }
    }

    if (replacements === 0) {
      postProcessStatus = 'skipped';   // nothing to do (no titled sections)
    } else if (markersRemaining > 0) {
      postProcessStatus = 'partial';   // some placeholders survived
    } else {
      postProcessStatus = 'ok';
    }
  } catch (e) {
    console.error('[docx-worker] post-process failed; falling back to raw docx', e, e && e.stack);
    buffer = raw;
    postProcessStatus = 'failed';
    postProcessError = String(e && e.message || e).slice(0, 200);
  }

  // Stash status on the buffer so the worker can read it without
  // changing the function signature.
  if (typeof buffer === 'object' && buffer !== null) {
    try {
      buffer.__antcv_cont_replacements = replacements;
      buffer.__antcv_post_process_status = postProcessStatus;
      buffer.__antcv_post_process_error = postProcessError;
      buffer.__antcv_markers_remaining = markersRemaining;
    } catch (_) { /* ignore frozen */ }
  }
  return buffer;
}

// Count occurrences of a byte sequence in a buffer. Used by the
// post-process status check to detect leftover placeholders.
function countByteMatches(haystack, needle) {
  let count = 0;
  if (!needle || needle.length === 0) return 0;
  const n = needle.length;
  const lim = haystack.length - n;
  outer: for (let i = 0; i <= lim; i++) {
    for (let j = 0; j < n; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    count++;
    i += n - 1;
  }
  return count;
}

function mergeStyle(input, packageId, legacyAtsTier) {
  // v1.50.8 — when `packageId` is a non-empty string, derive the base
  // palette from packages/registry.json via palette.js. Otherwise fall
  // back to the legacy DEFAULTS so pre-v1.50.8 PWAs see no behavioural
  // change. payload.style overrides win over both.
  //
  // Non-color string keys that should pass through verbatim (not be
  // uppercased by hex()). Extend this list when new layout-control
  // string keys are added.
  const PASSTHROUGH = new Set(['sidebarPosition']);

  let basePalette;
  if (typeof packageId === 'string' && packageId.trim()) {
    // getPackageStyle always returns a complete DEFAULTS-shaped object,
    // even when the input is unknown or a legacy alias.
    basePalette = getPackageStyle(packageId, legacyAtsTier === true);
    // The previous DEFAULTS had a 'mainHeadFont' that included " Bold"
    // suffix in some legacy bakes — the registry-derived palette uses
    // the bare family name plus the existing per-run bold attribute.
    // Nothing else from DEFAULTS should leak through when a package is
    // supplied.
  } else {
    basePalette = { ...DEFAULTS };
  }

  const s = { ...basePalette };
  for (const [k, v] of Object.entries(input || {})) {
    if (typeof v === 'string') {
      s[k] = PASSTHROUGH.has(k) ? v : hex(v);
    }
  }
  return s;
}

function numberingConfig(style) {
  return {
    config: [
      {
        reference: 'antcv-bullet',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u25AA',
            alignment: AlignmentType.LEFT,
            style: {
              run: { color: style.mainBulletColor },
              paragraph: { indent: { left: 360, hanging: 200 } },
            },
          },
        ],
      },
      {
        reference: 'antcv-sb-bullet',
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: '\u25AA',
            alignment: AlignmentType.LEFT,
            style: {
              run: { color: style.sidebarHeadColor },
              paragraph: { indent: { left: 280, hanging: 160 } },
            },
          },
        ],
      },
    ],
  };
}

// ──────────────────────────────────────────────────────────────────
// AI-assisted disclosure — "hanging textbox"
// ──────────────────────────────────────────────────────────────────
// v1.14.13 — shared builder for the AI-assisted notice. The PWA
// preview renders this as a small bordered chip in the lower-right
// corner of the last page (app.js v1.40.338). DOCX mirrors that look
// with a 1pt bordered paragraph; no wp:anchor floating frames — they
// don't survive LibreOffice/CloudConvert PDF conversion (see the
// v1.14.0 photo-floating regression note further down).
//
// context: 'sidebar' (dark navy bg) | 'linear' (white body of CL)
//
// The text matches what the PWA writes ("AI-assisted document") plus
// the responsibility clause, since the docx is the artifact that
// leaves the user's machine and the long form reads better there.
function buildAiDisclosureHangingTextbox(ctx, opts) {
  const context = (opts && opts.context) || 'linear';
  const isSidebar = context === 'sidebar';
  // Sidebar: light-grey-blue on dark navy (no fill, the cell bg shows
  // through). Linear: muted teal on a very light fill.
  const borderColor = isSidebar ? 'C8D0DC' : '95B0AE';
  const textColor   = isSidebar ? 'C8D0DC' : '4D7976';
  const para = {
    alignment: isSidebar ? AlignmentType.CENTER : AlignmentType.RIGHT,
    // v1.50.269: linear/CL watermark before-spacing cut 360 -> 120
    // (18pt -> 6pt). The 18pt lead was pushing the watermark — and with
    // it the signature name — onto a near-empty extra page when the
    // letter ran close to one page (owner report 2026-06-07: PDF split
    // on the last sentence, signature + watermark orphaned). The
    // sidebar (CV) keeps its larger 360 lead since it sits in a tall
    // navy cell with room below. keepLines so the single watermark line
    // never splits.
    spacing: { before: isSidebar ? 360 : 120, after: 0, line: 220, lineRule: 'auto' },
    keepLines: true,
    children: [new TextRun({
      text: 'AI-assisted — author retains responsibility for content.',
      font: 'Calibri',
      size: 13, // 6.5pt (half-points)
      italics: true,
      color: textColor,
    })],
  };
  if (isSidebar) {
    // CV sidebar: TEXT-ONLY now (owner 2026-06-05: no bounding box for CV or
    // CL). Light text colour (C8D0DC) reads on the navy cell; small symmetric
    // indent so it doesn't touch the cell margins. No border.
    para.indent = { left: 120, right: 120 };
  } else {
    // Linear/CL (owner WM request): a TEXT-ONLY marker — no bounding box,
    // no fill — in light muted teal, right-aligned. NO large left-indent:
    // Word renders a heavily-indented borderless line fine, but the
    // LibreOffice/CloudConvert PDF path rendered it EMPTY. Right-alignment
    // alone pins the text to the right margin in both Word and the PDF.
  }
  return new Paragraph(para);
}

// ──────────────────────────────────────────────────────────────────
// Two-column document (CV)
// ──────────────────────────────────────────────────────────────────
function buildTwoColumnDocument(ctx) {
  const { style, sections } = ctx;
  const headerCell = buildHeaderCell(ctx);

  const sidebarSecs = sections.filter(s => s.loc === 'sidebar');
  const mainSecs   = sections.filter(s => s.loc !== 'sidebar');

  // v1.14.0 — photo position determines where the photo paragraph
  // sits. Only one of these four returns a non-null paragraph.
  const photoTopOfSidebar    = maybeBuildPhotoFor(ctx, 'sidebar-top');
  const photoBottomOfSidebar = maybeBuildPhotoFor(ctx, 'sidebar-bottom');
  const photoInHeader        = maybeBuildPhotoFor(ctx, 'header');
  const photoInMain          = maybeBuildPhotoFor(ctx, 'main');

  // v1.14.13 — AI disclosure rendered as a "hanging textbox" rather
  // than a plain footer line. The PWA preview ships the same notice
  // as a small bordered chip in the lower-right corner of the last
  // page (app.js v1.40.338). The docx exporter mirrors that look by
  // wrapping the existing paragraph with a 1pt border on all four
  // sides and tight inner padding. We do NOT use wp:anchor floating
  // frames here — see the note at ~line 1036; LibreOffice/CloudConvert
  // drops anchored frames during PDF conversion, which was the v1.14.0
  // photo-floating regression. A bordered paragraph survives both.
  //
  // Owner 2026-06-05: the AI disclosure goes to whichever COLUMN's text
  // ends higher — the one with empty space below it, so the notice sits
  // low AND away from text. That flips per document (sometimes the sidebar
  // is shorter, sometimes the main). The worker can't measure rendered
  // heights, so the PWA measures the live preview (the same chooseCorner
  // logic the preview watermark uses) and forwards the page side here
  // (ctx.aiWmSide: 'left'|'right'). We map it to the sidebar or main cell.
  // No hint (older PWA) → main, the common case.
  const sidebarSide = (style && style.sidebarPosition === 'right') ? 'right' : 'left';
  const wmInSidebar = ctx.aiWmSide ? (ctx.aiWmSide === sidebarSide) : false;
  const aiDisclosurePara = buildAiDisclosureHangingTextbox(ctx, { context: wmInSidebar ? 'sidebar' : 'linear' });

  const sidebarChildren = [
    ...(photoTopOfSidebar ? [photoTopOfSidebar] : []),
    ...sidebarSecs.flatMap(s => renderSection(s, ctx, /*isSidebar*/ true)),
    ...(photoBottomOfSidebar ? [photoBottomOfSidebar] : []),
    ...(wmInSidebar ? [aiDisclosurePara] : []),
  ];

  // v1.14.1 — main-left/right: wrap the FIRST main section's
  // paragraphs in a nested 2-cell table sitting alongside the photo
  // cell. Remaining sections render flat below. This is the
  // "cell-split" approach the user specified — text indents
  // proportionally beside the photo and renders identically in DOCX
  // and PDF (unlike v1.14.0's floating images).
  let mainChildren;
  if (photoInMain && mainSecs.length > 0) {
    // photoInMain is the position string ('main-left' or 'main-right').
    const firstSec  = mainSecs[0];
    const restSecs  = mainSecs.slice(1);
    const firstSecParas = renderSection(firstSec, ctx, /*isSidebar*/ false);
    // Effective main column width = MAIN_W minus the left/right cell
    // margins from the parent main TableCell (left:160, right:160).
    const innerW = MAIN_W - 320;
    const photoTable = buildPhotoRowTable(ctx, photoInMain, firstSecParas, innerW);
    mainChildren = [
      photoTable,
      ...restSecs.flatMap(s => renderSection(s, ctx, /*isSidebar*/ false)),
    ];
  } else {
    mainChildren = mainSecs.flatMap(s => renderSection(s, ctx, /*isSidebar*/ false));
  }

  // When the hint puts the disclosure in the main column (the default),
  // append it at the end of the main content. When it belongs in the
  // sidebar, it was already added to sidebarChildren above.
  if (!wmInSidebar) mainChildren.push(aiDisclosurePara);

  // v1.14.1 — header-left/right: same cell-split treatment for the
  // candidate header band. Wrap name/spec/contact paragraphs in a
  // 2-cell table alongside the photo cell. Replaces the v1.14.0
  // floating-image approach which didn't survive PDF conversion.
  if (photoInHeader) {
    // photoInHeader is the position string ('header-left' or 'header-right').
    // Container width = PAGE_W minus the header cell's L/R margins (360+360).
    const headerInnerW = PAGE_W - 720;
    const wrappedHeader = buildPhotoRowTable(ctx, photoInHeader, headerCell.slice(), headerInnerW);
    // Replace headerCell's contents with the wrapping table.
    headerCell.length = 0;
    headerCell.push(wrappedHeader);
  }

  // v1.14.2 — sidebar position. Default 'left' (sidebar in first
  // cell, main in second). When the PWA passes
  // `style.sidebarPosition === 'right'`, swap both columnWidths
  // and the cell order so the sidebar appears on the right side of
  // the page. The header band still spans both columns and is not
  // affected.
  const sidebarOnRight = (style && style.sidebarPosition === 'right');
  const colWidths = sidebarOnRight
    ? [MAIN_W, SIDEBAR_W]
    : [SIDEBAR_W, MAIN_W];

  const sidebarCell = new TableCell({
    width: { size: SIDEBAR_W, type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' },
    borders: noBorders(),
    // Sidebar text pad: 0.10" L/R (144 DXA) — gives content a touch
    // more breathing room from the sidebar edges. Was 0.05" (72 DXA);
    // user requested +0.05" more distance.
    margins: { top: 240, bottom: 240, left: 144, right: 144 },
    children: sidebarChildren.length ? sidebarChildren : [emptyParagraph()],
  });
  const mainCell = new TableCell({
    width: { size: MAIN_W, type: WidthType.DXA },
    borders: noBorders(),
    // Main column pad: 0.10" L/R (144 DXA) — slightly more breathing
    // room for body prose and tables.
    // v1.10.3: top reduced 240 → 120 (12pt → 6pt) so the first
    // section heading (typically PROFILE) sits closer to the
    // candidate header band — fixes "too much space above the
    // profile". Combined with the 80-DXA header bottom this leaves
    // ~10pt total between contact line and PROFILE, was 22pt.
    margins: { top: 120, bottom: 240, left: 144, right: 144 },
    children: mainChildren.length ? mainChildren : [emptyParagraph()],
  });

  const hasSidebarItemPageBreaks = sidebarSecs.some(sec => {
    const b = ctx.itemPages && sec && sec.id ? ctx.itemPages[sec.id] : null;
    if (!b || typeof b !== 'object') return false;
    return Object.keys(b).some(k => Number(b[k]) >= 2);
  });
  // Owner 2026-06-05: a manual section page break (s.pageBreakBefore, set by
  // the PWA from section.page) only takes effect if the body row may split
  // across pages — disable cantSplit whenever any section carries a break.
  const hasSectionPageBreak = sections.some(s => s && s.pageBreakBefore === true);
  const allowRowSplit = hasSidebarItemPageBreaks || hasSectionPageBreak;

  const bodyTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: colWidths,
    borders: noBorders(),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: PAGE_W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
            borders: noBorders(),
            // Candidate header pad: 0.25" L/R (360 DXA), matches preview band.
            // v1.10.3: bottom margin reduced from 200 → 80 (10pt → 4pt) to
            // close the teal-band extension under the contact line that the
            // user flagged as "too much space above the profile".
            margins: { top: 240, bottom: 80, left: 360, right: 360 },
            children: headerCell,
          }),
        ],
      }),
      new TableRow({
        // v1.14.2 — cantSplit on the body row tells Word to keep the
        // entire sidebar+main row on one page where possible. Without
        // it, sidebar content slightly taller than the page generates
        // a near-empty page 2 (just the sidebar tail) followed by a
        // page 3 with only the CloudConvert footer. With it, Word
        // either fits everything on page 1 or pushes the whole row
        // to page 2 — no orphaned trailing pages.
        //
        // Caveat: if the body row is INHERENTLY taller than one page
        // (very large sidebar OR very large main), Word ignores
        // cantSplit and breaks as before. The user must then trim
        // their sidebar content to fit. Future ships may add a
        // density-based shrink-to-fit pass.
        cantSplit: !allowRowSplit,
        children: sidebarOnRight
          ? [mainCell, sidebarCell]
          : [sidebarCell, mainCell],
      }),
    ],
  });

  return new Document({
    creator: ctx.pi.name || 'AntCV user',
    lastModifiedBy: ctx.pi.name || 'AntCV user',
    title: ctx.meta.role ? `${ctx.pi.name || 'CV'} — ${ctx.meta.role}` : (ctx.pi.name || 'CV'),
    subject: 'Curriculum Vitae',
    keywords: 'AntCV, AI-assisted',
    description: `Generated by AntCV docx-worker ${ctx.workerVersion || ''} — AI-assisted document. Author retains all rights to the content. https://cv-generator-det.pages.dev`.trim(),
    revision: 1,
    styles: buildStyles(ctx),
    numbering: numberingConfig(style),
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.PORTRAIT },
            margin: { top: 0, right: 0, bottom: 0, left: 0, header: 0, footer: 0, gutter: 0 },
          },
        },
        children: [bodyTable],
      },
    ],
  });
}

function buildLinearDocument(ctx) {
  const { style, fs, pi, lang, sections } = ctx;
  const headerCell = buildHeaderCell(ctx);

  // Body sections, with closure pulled out so we can render it after a
  // teal horizontal rule that matches the preview's separator above the
  // closing paragraph. jd_questions is also pulled out so it can land on
  // its own page 2 with a duplicate candidate header band, matching the
  // PWA preview's v1.08 layout.
  const closureSec = sections.find(s => s && s.id === 'closure');
  const jdqSec     = sections.find(s => s && s.id === 'jd_questions' && s.on !== false);
  const otherSecs  = sections.filter(s => !s || (s.id !== 'closure' && s.id !== 'jd_questions'));

  const bodyChildren = [];
  // v1.14.1 — CL photo support: cell-split for header-* and main-*.
  // CL has no sidebar, so sidebar-* is a no-op. `hidden` skips entirely.
  const photoInHeaderCL = maybeBuildPhotoFor(ctx, 'header');
  const photoInMainCL   = maybeBuildPhotoFor(ctx, 'main');
  if (photoInHeaderCL) {
    // Wrap CL header content (greeting/name band) in a nested 2-cell
    // table alongside the photo cell.
    const headerInnerW = PAGE_W - 720;
    const wrappedHeader = buildPhotoRowTable(ctx, photoInHeaderCL, headerCell.slice(), headerInnerW);
    headerCell.length = 0;
    headerCell.push(wrappedHeader);
  }
  if (photoInMainCL && otherSecs.length > 0) {
    // Wrap first CL body section's paragraphs in a nested 2-cell
    // table alongside the photo. CL body cell uses the full page
    // width minus side margins (matches existing CL geometry).
    const firstSec = otherSecs[0];
    const restSecs = otherSecs.slice(1);
    const firstSecParas = renderSection(firstSec, ctx, /*isSidebar*/ false);
    // CL body inner width: full page minus body cell L/R margins.
    // We use the same 720 dxa total to be consistent with header.
    const bodyInnerW = PAGE_W - 720;
    const photoTable = buildPhotoRowTable(ctx, photoInMainCL, firstSecParas, bodyInnerW);
    bodyChildren.push(photoTable);
    for (const s of restSecs) bodyChildren.push(...renderSection(s, ctx, /*isSidebar*/ false));
  } else {
    for (const s of otherSecs) bodyChildren.push(...renderSection(s, ctx, /*isSidebar*/ false));
  }

  if (closureSec && closureSec.content) {
    // Teal rule above the closure — matches preview hr(mainHeadColor, 6, 4).
    bodyChildren.push(new Paragraph({
      border: { top: { color: style.mainHeadColor, space: 4, style: BorderStyle.SINGLE, size: 6 } },
      spacing: { before: 120, after: 0, line: 40, lineRule: 'exact' },
      children: [],
    }));
    bodyChildren.push(...renderSection(closureSec, ctx, false));
  }

  // Signature block: "Kind regards," (or "Med venlig hilsen,") followed
  // by the candidate's name in bold. Matches the preview's signHtml.
  const closeWord = (lang === 'da') ? 'Med venlig hilsen,' : 'Kind regards,';
  bodyChildren.push(new Paragraph({
    // v1.50.269: before 240 -> 150 (12pt -> 7.5pt). keepNext binds
    // "Kind regards," to the name, and the name (keepNext) to the
    // watermark, so the closing block can never orphan a single line
    // onto a new page — it moves as a unit, and the trimmed spacing
    // keeps it on page 1 for a one-page letter. keepNext only bites at
    // a page boundary (no effect mid-page), matching the owner's
    // "keep together only if signature is at end of page".
    spacing: { before: 150, after: 60, line: 276, lineRule: 'auto' },
    keepNext: true,
    keepLines: true,
    alignment: AlignmentType.LEFT,
    children: [new TextRun({
      text: closeWord,
      color: style.mainTextColor,
      size: pt2hp(fs.mainBody),
      font: style.mainBodyFont,
    })],
  }));
  bodyChildren.push(new Paragraph({
    spacing: { before: 60, after: 0, line: 276, lineRule: 'auto' },
    keepNext: true,
    keepLines: true,
    alignment: AlignmentType.LEFT,
    children: [new TextRun({
      text: pi.name || ((lang === 'da') ? 'Dit navn' : 'Your Name'),
      bold: true,
      color: style.mainTextColor,
      size: pt2hp(fs.mainBody),
      font: style.mainBodyFont,
    })],
  }));

  // v1.14.13 — AI-assisted disclosure hanging textbox in the lower
  // corner of the last page. For a single-page CL this is page 1;
  // when jd_questions is on (page 2) the same chip is also appended
  // to that page below — see the jdqSec branch in the section
  // children construction further down. We add it here too so that
  // single-page CLs still get the chip on their only page.
  if (!jdqSec) {
    bodyChildren.push(buildAiDisclosureHangingTextbox(ctx, { context: 'linear' }));
  }

  // Wrap header + body in a single full-width table with zero page
  // margins. The preview uses @page margin:0 plus a 5pt indent on the
  // body's left/right via inner cell margins; we mirror that here so
  // the docx body lines up with the same edge as the navy header band
  // (which is what the user expects when comparing preview to export).
  //
  // Body cell margins (in DXA, 20 DXA = 1pt):
  //   top:    120  (~6pt)   — matches preview td padding 6pt
  //   left:   100  (~5pt)   — matches preview IND=5
  //   right:  100  (~5pt)   — matches preview IND=5
  //   bottom: 280  (~14pt)  — matches preview td padding 14pt
  // 1.14.32 CL-PAGINATE-001: full-bleed header band table + FLOWING body (direct
  // section children). A single tall table row with the nested WHAT-I-BRING table
  // does not split across pages in LibreOffice/CloudConvert, so a long CL was
  // clipped to one page. See index.js mirror for the full rationale.
  const CL_SIDE_MARGIN = 100;
  const fullBleedIndent = { type: WidthType.DXA, size: -CL_SIDE_MARGIN };
  const clHeaderBand = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [PAGE_W],
    indent: fullBleedIndent,
    borders: noBorders(),
    rows: [
      new TableRow({
        children: [new TableCell({
          width: { size: PAGE_W, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
          borders: noBorders(),
          margins: { top: 240, bottom: 200, left: 360, right: 360 },
          children: headerCell,
        })],
      }),
    ],
  });
  const clBodyTopGap = new Paragraph({ spacing: { before: 0, after: 0, line: 120, lineRule: 'exact' }, children: [] });
  // Retained ONLY for the jd_questions 2-page path below; full-bleed indent so it
  // still spans the page under the new section L/R margins.
  const bodyTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [PAGE_W],
    indent: fullBleedIndent,
    borders: noBorders(),
    rows: [
      new TableRow({
        children: [new TableCell({
          width: { size: PAGE_W, type: WidthType.DXA },
          shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
          borders: noBorders(),
          // Candidate header pad: 0.25" L/R (360 DXA), matches CV header.
          margins: { top: 240, bottom: 200, left: 360, right: 360 },
          children: headerCell,
        })],
      }),
      new TableRow({
        children: [new TableCell({
          width: { size: PAGE_W, type: WidthType.DXA },
          borders: noBorders(),
          margins: { top: 120, bottom: 280, left: 100, right: 100 },
          children: bodyChildren.length ? bodyChildren : [emptyParagraph()],
        })],
      }),
    ],
  });

  return new Document({
    creator: pi.name || 'AntCV user',
    lastModifiedBy: pi.name || 'AntCV user',
    title: ctx.meta.role ? `${pi.name || 'Cover Letter'} — ${ctx.meta.role}` : (pi.name || 'Cover Letter'),
    subject: 'Cover Letter',
    keywords: 'AntCV, AI-assisted',
    description: `Generated by AntCV docx-worker ${ctx.workerVersion || ''} — AI-assisted document. Author retains all rights to the content. https://cv-generator-det.pages.dev`.trim(),
    revision: 1,
    styles: buildStyles(ctx),
    numbering: numberingConfig(style),
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.PORTRAIT },
            // 1.14.32 CL-PAGINATE-001: L/R margins inset the flowing body; the
            // full-bleed band cancels the left margin with a -100 table indent.
            margin: { top: 0, right: CL_SIDE_MARGIN, bottom: 220, left: CL_SIDE_MARGIN, header: 0, footer: 0, gutter: 0 },
          },
        },
        children: jdqSec
          ? [
              bodyTable,
              // Hard page break paragraph between pages 1 and 2.
              // Word collapses zero-height paragraphs that have only a
              // pageBreakBefore; using a small exact line-rule keeps
              // the break visible to the layout engine without adding
              // a visible blank line. The paragraph lives outside the
              // tables, between them, so the page-2 table starts
              // cleanly at the top of the new physical page.
              new Paragraph({
                pageBreakBefore: true,
                spacing: { before: 0, after: 0, line: 14, lineRule: 'exact' },
                children: [],
              }),
              new Table({
                width: { size: PAGE_W, type: WidthType.DXA },
                columnWidths: [PAGE_W],
                indent: fullBleedIndent,
                borders: noBorders(),
                rows: [
                  // Page-2 navy header band — duplicate of page 1
                  new TableRow({
                    children: [new TableCell({
                      width: { size: PAGE_W, type: WidthType.DXA },
                      shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
                      borders: noBorders(),
                      margins: { top: 240, bottom: 200, left: 360, right: 360 },
                      children: buildHeaderCell(ctx),
                    })],
                  }),
                  // Page-2 body: jd_questions section + fresh signature
                  new TableRow({
                    children: [new TableCell({
                      width: { size: PAGE_W, type: WidthType.DXA },
                      borders: noBorders(),
                      margins: { top: 120, bottom: 280, left: 100, right: 100 },
                      children: [
                        ...renderSection(jdqSec, ctx, /*isSidebar*/ false),
                        new Paragraph({
                          spacing: { before: 240, after: 60, line: 276, lineRule: 'auto' },
                          alignment: AlignmentType.LEFT,
                          children: [new TextRun({
                            text: closeWord,
                            color: style.mainTextColor,
                            size: pt2hp(fs.mainBody),
                            font: style.mainBodyFont,
                          })],
                        }),
                        new Paragraph({
                          spacing: { before: 60, after: 0, line: 276, lineRule: 'auto' },
                          alignment: AlignmentType.LEFT,
                          children: [new TextRun({
                            text: pi.name || ((lang === 'da') ? 'Dit navn' : 'Your Name'),
                            bold: true,
                            color: style.mainTextColor,
                            size: pt2hp(fs.mainBody),
                            font: style.mainBodyFont,
                          })],
                        }),
                        // v1.14.13 — AI-assisted disclosure on the
                        // last page of a 2-page CL (jd_questions).
                        buildAiDisclosureHangingTextbox(ctx, { context: 'linear' }),
                      ],
                    })],
                  }),
                ],
              }),
            ]
          : [clHeaderBand, clBodyTopGap, ...(bodyChildren.length ? bodyChildren : [emptyParagraph()])],
      },
    ],
  });
}

// ──────────────────────────────────────────────────────────────────
// Header cell
// ──────────────────────────────────────────────────────────────────
function buildHeaderCell(ctx) {
  const { style, fs, pi, meta, headerAlign } = ctx;
  const out = [];

  if (pi.name) {
    out.push(new Paragraph({
      alignment: alignType(headerAlign.name),
      // 1.14.27: the running-header strip is now a thin 2pt line, so give the
      // name back 3pt (before:60) of top space inside the band so it isn't
      // clipped at the top edge of the candidate section.
      spacing: { before: 60, after: 40, line: 240, lineRule: 'exact' },
      shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
      children: [
        new TextRun({
          text: pi.name,
          bold: true,
          color: style.headerNameColor,
          size: pt2hp(fs.nameSize),
          font: style.headerFont,
        }),
      ],
    }));
  }

  const subtitle = (meta.subtitle || '').replace(/\s*\|\s*/g, '  •  ');
  if (subtitle) {
    out.push(new Paragraph({
      alignment: alignType(headerAlign.specialisation),
      spacing: { before: 0, after: 60 },
      shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
      children: [
        new TextRun({
          text: subtitle,
          color: style.headerSpecColor,
          size: pt2hp(fs.specialisation),
          font: style.headerFont,
        }),
      ],
    }));
  }

  // Contact line. Glyph mapping matches the PWA preview header:
  //   ⌂ U+2302   location
  //   ★ U+2605   citizenship / legal status
  //   @           email
  //   ☎ U+260E   phone
  //   🔗 U+1F517 linkedin / link / website (variation selector U+FE0E
  //              forces text-style monochrome rendering instead of an
  //              emoji glyph in fonts that have both)
  const LINK_GLYPH = '\uD83D\uDD17\uFE0E';
  const contactBits = [];
  if (pi.location)    contactBits.push(`\u2302\u00A0${pi.location}`);
  if (pi.citizenship) contactBits.push(`\u2605\u00A0${pi.citizenship}`);
  if (pi.email)       contactBits.push(`@\u00A0${pi.email}`);
  if (pi.phone)       contactBits.push(`\u260E\u00A0${pi.phone}`);
  if (pi.linkedin)    contactBits.push(`${LINK_GLYPH}\u00A0${pi.linkedin}`);
  if (pi.website)     contactBits.push(`${LINK_GLYPH}\u00A0${pi.website}`);
  if (Array.isArray(pi.contact_extra)) {
    for (const it of pi.contact_extra) {
      if (it && it.value) {
        const icon = (it.icon || '\u2022');
        contactBits.push(`${icon}\u00A0${it.value}`);
      }
    }
  }

  if (contactBits.length) {
    // 1.14.31 header-rule colour + PDF visibility: the two rules in the candidate
    // band must match the SIDEBAR heading rule colour (style.sidebarHeadColor,
    // #01B7BB) — style.accent maps to the palette's interactive blue (#0B74DE),
    // which the owner flagged as "a colour different from all other rules". AND
    // both rules now sit on the NON-empty contact paragraph (top + bottom
    // borders): the previous empty-spacer paragraph's bottom border was dropped
    // by the CloudConvert docx->PDF path (owner: "the line under the
    // specialisation is not visible in the PDF"), whereas a border on a
    // text-bearing paragraph survives both Word and the PDF.
    const headerRule = { color: style.sidebarHeadColor, space: 4, style: BorderStyle.SINGLE, size: 6 };
    // Spacer keeps the band rhythm between specialisation and contact; no border.
    out.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
      spacing: { before: 0, after: 60, line: 40, lineRule: 'exact' },
      children: [],
    }));
    // The contact line carries BOTH rules (above + below) as top/bottom borders.
    out.push(new Paragraph({
      alignment: alignType(headerAlign.contact),
      shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
      border: { top: { ...headerRule }, bottom: { ...headerRule } },
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: contactBits.join('   \u2022   '),
          color: style.headerContactColor,
          size: pt2hp(fs.contactSize),
          font: style.headerFont,
        }),
      ],
    }));
  }

  if (out.length === 0) {
    out.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
      spacing: { before: 0, after: 0, line: 200, lineRule: 'exact' },
      children: [],
    }));
  }
  return out;
}

// v1.14.1 — photo position support (cell-split approach).
//
// Reads `pi.photoPosition` (one of seven values mirroring the PWA's
// Settings → Layout → Profile Photo radio buttons):
//
//   sidebar-top      → photo paragraph at the top of the sidebar (default)
//   sidebar-bottom   → photo paragraph at the bottom of the sidebar
//   header-left      → photo cell on left of header band; name/spec/contact
//                       cell on right (nested 2-col table inside header cell)
//   header-right     → mirror — content left, photo right
//   main-left        → photo cell on left of FIRST main section; section
//                       content on right (nested 2-col table at top of main)
//   main-right       → mirror — content left, photo right
//   hidden           → photo not rendered at all
//
// Anything else falls back to sidebar-top.
//
// v1.14.0's `floating: { wp:anchor }` approach was abandoned because:
//   1. PDF conversion (CloudConvert / LibreOffice) dropped header/main
//      floating images entirely.
//   2. Word's text wrap around the floating image was visually
//      inconsistent — text touched the photo edge instead of indenting
//      proportionally.
//   3. The user specified the cell-split approach as the desired
//      behaviour: "splitting the first 2 or 3 cells in the main
//      section and merging the left (or right ones, pending where
//      the profile image sits)".
//
// Cell-split renders identically in DOCX and PDF, and the text
// indentation is proportional to the photo's cell width — exactly
// the requested behaviour.

const PHOTO_POSITIONS = new Set([
  'sidebar-top', 'sidebar-bottom',
  'header-left', 'header-right',
  'main-left', 'main-right',
  'band-overlap',
  'hidden',
]);

// Widths for the nested cells (in dxa, twentieths of a point).
// Photo cell is sized to comfortably hold the photo + a small visual
// margin; content cell fills the remainder.
const PHOTO_CELL_W_MAIN   = 1800; // ~1.25" wide for main-left/right
const PHOTO_CELL_W_HEADER = 1280; // ~0.89" wide for header-left/right

function normalisePhotoPosition(v) {
  if (typeof v !== 'string') return 'sidebar-top';
  const s = v.trim().toLowerCase();
  return PHOTO_POSITIONS.has(s) ? s : 'sidebar-top';
}

// v1.14.1 — always returns an INLINE photo paragraph. The image is
// inserted into the appropriate cell by the caller. Size is chosen
// per position so the photo fits the surrounding layout.
function buildPhotoParagraph(ctx, position) {
  const { pi, style } = ctx;
  const data = base64ToUint8Array(pi.photo_b64);
  const pos = normalisePhotoPosition(position);

  let inches = 1.25;
  if (pos === 'header-left' || pos === 'header-right') inches = 0.85;
  if (pos === 'main-left'   || pos === 'main-right')   inches = 1.20;
  const sizePx = Math.round((inches * EMU_PER_INCH) / 9525);

  const outlineColor = ((style && style.photoBorderColor) ||
                       (style && style.sidebarHeadColor) ||
                       (style && style.accent) ||
                       '01B7BB').replace(/^#/, '');

  // For sidebar variants: classic centred inline image, used directly
  // as a top-or-bottom paragraph in the sidebar cell.
  if (pos === 'sidebar-top' || pos === 'sidebar-bottom' || pos === 'band-overlap') {
    // band-overlap ("sidebar bridge"): the preview straddles the photo across
    // the header-band/sidebar seam. A literal straddle needs a floating frame,
    // which LibreOffice/CloudConvert drop during PDF conversion (the v1.14.0
    // photo-floating regression). The faithful PDF-safe mapping is the TOP of
    // the sidebar with zero top spacing so the disc hugs the band seam.
    return new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: pos === 'band-overlap' ? 0 : 120, after: 120 },
      children: [
        new ImageRun({
          data,
          type: detectImageType(pi.photo_b64),
          transformation: { width: sizePx, height: sizePx },
          outline: { width: 12700, solidFillType: 'rgb', value: outlineColor },
          altText: {
            title: 'Profile photo',
            description: pi.name ? ('Profile photo of ' + pi.name) : 'Profile photo',
            name: 'profile-photo',
          },
        }),
      ],
    });
  }

  // For header/main variants: inline image inside a paragraph that
  // will be placed into a TableCell. Centred horizontally within
  // its cell. No floating — the caller handles positioning by cell
  // layout.
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 60, after: 60 },
    children: [
      new ImageRun({
        data,
        type: detectImageType(pi.photo_b64),
        transformation: { width: sizePx, height: sizePx },
        outline: { width: 12700, solidFillType: 'rgb', value: outlineColor },
        altText: {
          title: 'Profile photo',
          description: pi.name ? ('Profile photo of ' + pi.name) : 'Profile photo',
          name: 'profile-photo',
        },
      }),
    ],
  });
}

// v1.14.1 — build a nested 2-cell table that places the photo
// alongside the given content paragraphs. `position` tells us which
// side the photo sits on. `containerWidth` is the dxa width of the
// outer container (MAIN_W for main-*, PAGE_W minus header margins
// for header-*). Both cells have no visible borders.
function buildPhotoRowTable(ctx, position, contentParagraphs, containerWidth) {
  const photoPara = buildPhotoParagraph(ctx, position);
  const isHeader = (position === 'header-left' || position === 'header-right');
  const isLeft   = (position === 'main-left'   || position === 'header-left');

  const photoCellW = isHeader ? PHOTO_CELL_W_HEADER : PHOTO_CELL_W_MAIN;
  const contentCellW = Math.max(2880, containerWidth - photoCellW);

  const photoCell = new TableCell({
    width: { size: photoCellW, type: WidthType.DXA },
    children: [photoPara],
    borders: noBorders(),
    margins: { top: 80, bottom: 80, left: 80, right: 80 },
    verticalAlign: VerticalAlign.TOP,
  });

  const contentCell = new TableCell({
    width: { size: contentCellW, type: WidthType.DXA },
    children: (contentParagraphs && contentParagraphs.length)
      ? contentParagraphs
      : [new Paragraph({ children: [] })],
    borders: noBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.TOP,
  });

  return new Table({
    width: { size: containerWidth, type: WidthType.DXA },
    columnWidths: isLeft ? [photoCellW, contentCellW] : [contentCellW, photoCellW],
    borders: noBorders(),
    rows: [
      new TableRow({
        children: isLeft ? [photoCell, contentCell] : [contentCell, photoCell],
      }),
    ],
  });
}

// v1.14.0 — convenience used by buildTwoColumnDocument + buildLinearDocument
// to decide where to drop the photo paragraph based on the active
// position. Returns null when the photo is hidden or absent.
function maybeBuildPhotoFor(ctx, target) {
  if (!ctx.pi || !ctx.pi.photo_b64) return null;
  const pos = normalisePhotoPosition(ctx.pi.photoPosition);
  if (pos === 'hidden') return null;
  // target is one of: 'sidebar-top', 'sidebar-bottom', 'header', 'main'
  switch (target) {
    case 'sidebar-top':    return (pos === 'sidebar-top' || pos === 'band-overlap') ? buildPhotoParagraph(ctx, pos) : null;
    case 'sidebar-bottom': return pos === 'sidebar-bottom' ? buildPhotoParagraph(ctx, pos) : null;
    case 'header':         return (pos === 'header-left' || pos === 'header-right')
                                  ? pos : null;
    case 'main':           return (pos === 'main-left' || pos === 'main-right')
                                  ? pos : null;
    default: return null;
  }
}

function detectImageType(b64) {
  if (!b64) return 'png';
  const head = b64.slice(0, 12);
  if (head.startsWith('/9j/'))  return 'jpg';
  if (head.startsWith('iVBORw')) return 'png';
  if (head.startsWith('R0lGOD')) return 'gif';
  return 'png';
}

function base64ToUint8Array(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ──────────────────────────────────────────────────────────────────
// Section dispatch
// ──────────────────────────────────────────────────────────────────
function renderSection(s, ctx, isSidebar) {
  // 1.14.35 PB-WORKER-SIDEBAR-CONT-001 (mirror of index.js): split a sidebar list
  // section that continues onto page 2 into page-segments, the continuation
  // getting "TITLE (Cont.)" + a pageBreakBefore, instead of repeating the bare
  // title. Guarded by _antcvSegment against recursion.
  if (
    isSidebar && !s._antcvSegment && Array.isArray(s.items) && s.items.length > 1 &&
    (s.type === 'labeled_list' || s.type === 'list' || s.type === 'list_italic' || s.type === 'education')
  ) {
    let run = 1; const chunks = []; const byPage = {};
    for (let i = 0; i < s.items.length; i++) {
      const it = s.items[i];
      let p = Number(it && it._page);
      p = (Number.isFinite(p) && p >= 2 && p <= 4) ? p : run;
      if (p > run) run = p; else p = run;
      if (byPage[p] === undefined) { byPage[p] = chunks.length; chunks.push({ page: p, items: [] }); }
      chunks[byPage[p]].items.push(it);
    }
    if (chunks.length > 1) {
      const out2 = [];
      chunks.forEach((ch, ci) => {
        const seg = Object.assign({}, s, {
          items: ch.items,
          _antcvSegment: true,
          title: ci > 0 ? ((s.title || '') + ' (Cont.)') : s.title,
          pageBreakBefore: ci > 0 ? true : s.pageBreakBefore,
        });
        out2.push(...renderSection(seg, ctx, isSidebar));
      });
      return out2;
    }
  }
  const isCLBoilerplate = ['greeting', 'opening', 'closure'].includes(s.id);
  const inlineTitleType = !isCLBoilerplate && ((s.type === 'text_inline') || isWorkStyleSection(s));
  // CL boilerplate sections (greeting, opening, closure) never show
  // their title at all — neither as a heading nor inline-bold prefix.
  // Their `title` field exists for editor labelling only ("GREETING",
  // "OPENING", etc.) and must not surface in the rendered docx.
  const skipHeading = inlineTitleType || isCLBoilerplate;

  // ── Page-break-before support ─────────────────────────────────
  // Sections may carry `pageBreakBefore: true` to force their
  // rendering onto a fresh page. Used (e.g.) for an appended
  // "QUESTIONS FROM THE JD" section in the cover letter, which the
  // user wants on its own last page. The break is emitted as a
  // single empty paragraph with `pageBreakBefore: true` in its
  // paragraph properties — that's the Word-native way and renders
  // identically across Word, LibreOffice, and Google Docs. We use
  // an empty paragraph rather than a Break run because a Break run
  // would inherit font-size styling and visibly nudge spacing on
  // the new page; an empty pageBreakBefore paragraph collapses to
  // zero height.
  // PB-002 (v2): a page break on the FIRST item in a section moves
  // the WHOLE section (including its heading) to the next page. This
  // generalises v1.14.12's sidebar-only detection — the same rule
  // applies to every section type. The renderer for each section
  // shape then skips the redundant in-loop break+contHeader for that
  // first item via the s._antcvFirstItemPageMoved flag.
  const _firstItemPageBreak = !!(
    Array.isArray(s.items) && s.items.length &&
    s.items[0] && typeof s.items[0] === 'object' &&
    Number(s.items[0]._page) >= 2
  );
  if (_firstItemPageBreak) s._antcvFirstItemPageMoved = true;
  // Owner 2026-06-05: paging the FIRST part (intro / bullet_0) of a text_bullets
  // section moves the WHOLE subsection — heading included. Break before the
  // heading and stamp the page so renderTextBullets starts its run there.
  let _firstPartPage = 0;
  if (s.type === 'text_bullets' && ctx.itemPages && s.id && typeof ctx.itemPages[s.id] === 'object') {
    const ipx = ctx.itemPages[s.id];
    const introN = Number(ipx.intro);
    const b0N = Number(ipx.bullet_0);
    const fp = Math.max(Number.isFinite(introN) ? introN : 1, Number.isFinite(b0N) ? b0N : 1);
    if (fp >= 2 && fp <= 4) { _firstPartPage = fp; s._antcvFirstPartPage = fp; }
  }
  const pageBreakPara = (s.pageBreakBefore === true || _firstItemPageBreak || _firstPartPage >= 2)
    ? [new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 } })]
    : [];

  // Collect body paragraphs / tables (no heading yet) so we can decide
  // how to wrap them together.
  const body = [];
  switch (s.type) {
    case 'text':
      if (isWorkStyleSection(s) && !isCLBoilerplate) body.push(...renderTextInline(s, ctx, isSidebar));
      else body.push(...renderText(s, ctx, isSidebar));
      break;
    case 'text_inline':
      if (isCLBoilerplate) body.push(...renderText(s, ctx, isSidebar));
      else                 body.push(...renderTextInline(s, ctx, isSidebar));
      break;
    case 'text_bullets':
      body.push(...renderTextBullets(s, ctx, isSidebar));
      break;
    case 'foundation':
      body.push(...renderFoundation(s, ctx, isSidebar));
      break;
    case 'bullets':
      body.push(...renderBullets(s, ctx, isSidebar));
      break;
    case 'table':
      body.push(...renderCompetencyTable(s, ctx));
      break;
    case 'experience':
      body.push(...renderExperience(s, ctx));
      break;
    case 'list':
    case 'list_italic':
      body.push(...renderSimpleList(s, ctx, isSidebar, s.type === 'list_italic'));
      break;
    case 'labeled_list':
      body.push(...renderLabeledList(s, ctx, isSidebar));
      break;
    case 'education':
      body.push(...renderEducation(s, ctx, isSidebar));
      break;
    default:
      break;
  }

  // Untitled sections (CL boilerplate, inline-title types) just emit
  // their body paragraphs directly — no wrapper, no heading repetition
  // needed because there is no heading.
  if (skipHeading || !s.title) return [...pageBreakPara, ...body];

  // If the body came back empty after the renderer's own filtering
  // (every item was hidden via {on:false}, or every item was empty,
  // or the items array itself was empty), suppress the section
  // entirely — heading included. Without this, sections like
  // PUBLICATIONS & PATENT would still emit their teal heading and
  // an empty body cell, which is exactly the failure the user
  // reported (heading appears in Word even when nothing's there).
  if (body.length === 0) return [];

  // 1.14.25: the cover letter is a single full-width linear doc. Wrapping each
  // titled section in the heading-repetition table (below) nests it THREE deep
  // (competency/foundation table → wrapper → body table); Word AND Google Docs
  // mis-compute widths for triple-nested tables and shrink the inner content to
  // ~80% even though the emitted gridCol is full-width. The CV needs the wrapper
  // (sidebar/main columns), but the CL does not — emit the heading + body
  // directly into the full-width body cell, exactly like the untitled CL
  // paragraphs (greeting/opening/closure), so titled sections match them. CL
  // continuation headings are handled by renderCompetencyTable's own chunking
  // and the jd_questions page-2 re-emit, so no repetition is lost in practice.
  if (ctx && ctx.doc === 'cl') {
    return [...pageBreakPara, headingParagraph(s.title, ctx, false), ...body];
  }

  // ──────────────────────────────────────────────────────────────────
  // Heading repetition across page breaks:
  //
  // Each titled section is wrapped in its own 1-column nested table.
  // The first row holds the heading paragraph and is marked
  // `tableHeader: true`, which tells Word to repeat that row at the
  // top of every page the table spans. The heading row also has
  // `cantSplit: true` so the heading itself is never broken by a page
  // break. The 12-pt `spacing.before` on the heading paragraph
  // (defined in headingParagraph) gives the requested 12-pt visual gap
  // above each section heading — including when a section continues on
  // a new page, because the repeated header row preserves all of its
  // paragraph properties.
  //
  // Note: a "(Cont.)" suffix on continuation appearances would require
  // Word field codes (`{ IF { PAGE } > N "(Cont.)" "" }`) that don't
  // render reliably inside a doubly-nested table. The heading
  // reappearing IS the primary visual signal for "this section
  // continues here" — recruiters reading the printed CV will see the
  // section heading at the top of every page it spans.
  // ──────────────────────────────────────────────────────────────────
  const headingCell = new TableCell({
    borders: noBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: [headingParagraph(s.title, ctx, isSidebar)],
  });
  const bodyCell = new TableCell({
    borders: noBorders(),
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    children: body.length ? body : [emptyParagraph()],
  });

  return [
    ...pageBreakPara,
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      // 1.14.22: give the single section column a REAL width. With only
      // width:100% the docx lib emits <w:gridCol w:w="100"/> (100 twips); Word
      // tolerates it but Google Docs honours the 100-twip grid absolutely and
      // collapses the column to one character per line. The section sits in the
      // sidebar or main cell (minus its ~288-twip L+R cell margins).
      // 1.14.24: the CL is a single full-width linear doc (no sidebar) — its
      // body cell content is PAGE_W minus the 100+100 cell margins (=11706),
      // NOT the MAIN_W column. Sizing CL section wrappers to MAIN_W-288 (=6982)
      // collapsed every titled CL section (WHO I AM / WHY THIS POSITION / HOW I
      // WOULD CONTRIBUTE / WHAT I BRING / Foundation) to ~60% of the page.
      columnWidths: [(ctx && ctx.doc === 'cl') ? (PAGE_W - 200) : ((isSidebar ? SIDEBAR_W : MAIN_W) - 288)],
      borders: noBorders(),
      rows: [
        new TableRow({
          // 1.14.33: suppress the bare-title tblHeader repeat for EXPERIENCE (it
          // supplies its own "(Cont.)" heading via role.page) to kill the page-2
          // double heading; all other sections keep the repeat.
          tableHeader: s.type !== "experience",
          cantSplit: true,
          children: [headingCell],
        }),
        new TableRow({
          children: [bodyCell],
        }),
      ],
    }),
    // 1.50.293 PB-WORKER-CONT-HEADER-001: separator paragraph so Word does not
    // MERGE adjacent same-grid section-wrapper tables (which made the FIRST
    // table's tblHeader, e.g. "CORE COMPETENCIES", repeat on page 2 above the
    // EXPERIENCE continuation). Keeps each section's own heading repeating.
    new Paragraph({ spacing: { before: 0, after: 0, line: 1, lineRule: "exact" }, children: [] }),
  ];
}

function headingParagraph(title, ctx, isSidebar) {
  const { style, fs } = ctx;

  // Allocate a unique continuation marker id for this heading. The
  // placeholder TextRun emitted below carries the heading's full run
  // properties (bold, color, font, size, char-spacing) — the
  // post-processor (see post-process.js) finds these placeholder runs
  // by their `__ANTCV_CONT_<N>__` text content and replaces each one
  // with a complex Word field:
  //     { IF { PAGE } <> { PAGEREF antcv_sec_<N> } "(Cont.)" "" }
  // The bookmark `antcv_sec_<N>` wraps the heading title text below so
  // PAGEREF returns the page where the section first appears. On the
  // original page, PAGE = PAGEREF → field renders empty; on every page
  // the tableHeader row repeats, PAGE > PAGEREF → "(Cont.)" shows in
  // the same heading style. The replacement happens before the docx is
  // sent to the client, so users never see the placeholder text.
  if (typeof ctx.contCounter !== 'number') ctx.contCounter = 0;
  const contId = ctx.contCounter++;
  const bookmarkName = `antcv_sec_${contId}`;
  // Bookmark numeric IDs must not clash with internal docx-js IDs;
  // offset by a large constant.
  const bookmarkNumericId = 90000 + contId;

  const headingRunOpts = {
    bold: true,
    color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor,
    size: pt2hp(isSidebar ? fs.sbHead : fs.mainHead),
    font: isSidebar ? style.sidebarFont : style.mainHeadFont,
    characterSpacing: 10,
  };

  // v1.10.4: Heading spacing — 4pt before, 2pt after.
  //
  // Previously we put the 4pt-after-table breathing room on the table's
  // trailing paragraph (renderCompetencyTable), but Word collapses
  // paragraph-after-table spacing aggressively, so the user kept seeing
  // headings crammed against the bottom border of preceding tables. Per
  // user instruction ("you can add space of 4pts above/before to the
  // text after the table") we instead put the gap on the heading
  // itself. Word's default behaviour suppresses paragraph spacing-
  // before at the very top of a page, so the FIRST heading on a page
  // does NOT pick up an unwanted 4pt indent — the only place this
  // creates a visible gap is between consecutive elements, which is
  // exactly where we want it.
  return new Paragraph({
    spacing: { before: 80, after: 40 },
    // keepNext: heading must stay glued to whatever follows it, so a
    // heading never appears alone at the bottom of a page with its
    // content pushed to the next page. keepLines: never split the
    // heading text across pages (it's typically one line anyway, but
    // this is defensive against very long titles).
    keepNext: true,
    keepLines: true,
    // Sidebar headings are centred over the narrow sidebar column. Main
    // column headings stay left-aligned so they line up with body prose.
    alignment: isSidebar ? AlignmentType.CENTER : undefined,
    shading: isSidebar
      ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
      : undefined,
    border: { bottom: { color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor, space: 4, style: BorderStyle.SINGLE, size: 8 } },
    children: [
      new BookmarkStart(bookmarkName, bookmarkNumericId),
      new TextRun({ text: title, ...headingRunOpts }),
      new BookmarkEnd(bookmarkNumericId),
      // Placeholder run — same styling as the heading text. The
      // post-processor replaces this entire <w:r>...</w:r> element
      // (recognised by its `__ANTCV_CONT_<N>__` text content) with the
      // complex IF/PAGE/PAGEREF field XML. The leading non-breaking
      // space gives a visual separator if for any reason the marker
      // is left untouched (defensive).
      new TextRun({ text: `\u00A0__ANTCV_CONT_${contId}__`, ...headingRunOpts }),
    ],
  });
}

// ──────────────────────────────────────────────────────────────────
// Text variants
// ──────────────────────────────────────────────────────────────────
function renderText(s, ctx, isSidebar) {
  if (!s.content) return [];
  const paras = String(s.content).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  // CJLR v1.14.3 — `content` is the canonical edit-path the PWA
  // uses for plain text sections. Per-item path override beats the
  // group default; both fall back to JUSTIFIED.
  const align = paraAlignPath(s, 'content')
             ?? paraAlign(s, null, undefined)
             ?? AlignmentType.JUSTIFIED;
  return paras.map(p => bodyParagraphRich(p, ctx, isSidebar, { align }));
}

function renderTextInline(s, ctx, isSidebar) {
  if (!s.content) return [];
  const { style, fs } = ctx;
  const title = (s.title || '').trim();
  const paras = String(s.content).split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  // Work-style sections sit BETWEEN the PROFILE paragraph and the
  // SELECTED OUTCOMES heading. The user wants a tight join with
  // PROFILE (Work style reads as a continuation of profile) but a
  // visible gap before the next heading (Selected Outcomes feels
  // like a new section). Asymmetric spacing achieves that:
  //   before: 20  — tight against the preceding PROFILE paragraph
  //   after:  140 — visible gap before SELECTED OUTCOMES heading
  // For non-work-style text_inline (CL openers, closures, etc.) we
  // keep symmetric 60/60 spacing.
  const isWorkStyle = isWorkStyleSection(s);
  const spacing = isWorkStyle
    ? { before: 20, after: 140, line: 276, lineRule: 'auto' }
    : { before: 60, after: 60,  line: 276, lineRule: 'auto' };
  // CJLR v1.14.3 — same rule as renderText: content path override
  // beats group; both fall back to JUSTIFIED.
  const align = paraAlignPath(s, 'content')
             ?? paraAlign(s, null, undefined)
             ?? AlignmentType.JUSTIFIED;
  return paras.map((p, i) => new Paragraph({
    spacing,
    alignment: align,
    shading: isSidebar
      ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
      : undefined,
    children: [
      ...(i === 0 && title ? [new TextRun({
        text: title + ': ',
        bold: true,
        color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor,
        size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
        font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
      })] : []),
      ...inlineRuns(p, {
        color: isSidebar ? style.sidebarTextColor : style.mainTextColor,
        size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
        font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
      }),
    ],
  }));
}

function bodyParagraphRich(text, ctx, isSidebar, opts = {}) {
  const { style, fs } = ctx;
  return new Paragraph({
    spacing: { before: 60, after: 60, line: 276, lineRule: 'auto' },
    alignment: opts.align || AlignmentType.JUSTIFIED,
    shading: isSidebar
      ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
      : undefined,
    children: inlineRuns(text, {
      color: isSidebar ? style.sidebarTextColor : style.mainTextColor,
      size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
      font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
      italics: opts.italic || false,
      bold: opts.bold || false,
    }),
  });
}

function renderTextBullets(s, ctx, isSidebar) {
  const out = [];
  // CJLR v1.14.3 — edit-paths the PWA uses:
  //   intro          → "intro"
  //   items[i]       → "items.<i>"
  //   closing        → "closing"
  // For each, prefer the specific path override; otherwise fall
  // back to the group default. paraAlignPath gives us path-only
  // lookup so the group default doesn't mask a missing override.
  const groupCjlr = paraAlign(s, null, undefined);
  // Owner 2026-06-05: per-bullet page breaks (How I Would Contribute). The PWA
  // stores page numbers under ctx.itemPages[sid] keyed "intro"|"bullet_<i>"|
  // "closing". Cascades set a run to the same page; insert ONE pageBreakBefore
  // at each increase so the bullet and everything after it start on the next page.
  const ip = (ctx.itemPages && s.id && typeof ctx.itemPages[s.id] === 'object') ? ctx.itemPages[s.id] : {};
  // First-part page (intro/bullet_0) moves the heading too — start runMax there
  // so we don't double-break and orphan the heading (set in renderSection).
  let runMax = (Number(s._antcvFirstPartPage) >= 2 && Number(s._antcvFirstPartPage) <= 4) ? Number(s._antcvFirstPartPage) : 1;
  const brk = (key) => {
    const n = Number(ip[key]);
    const pg = (Number.isFinite(n) && n >= 2 && n <= 4) ? n : 1;
    if (pg > runMax) { runMax = pg; out.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 } })); }
  };
  if (s.intro) {
    brk('intro');
    const a = paraAlignPath(s, 'intro') ?? groupCjlr;
    out.push(bodyParagraphRich(s.intro, ctx, isSidebar, a ? { align: a } : {}));
  }
  if (Array.isArray(s.items)) {
    s.items.filter(Boolean).forEach((it, i) => {
      brk('bullet_' + i);
      const a = paraAlignPath(s, 'items.' + i) ?? groupCjlr;
      out.push(bulletParagraphRich('', String(it), ctx, isSidebar, a));
    });
  }
  if (s.closing) {
    brk('closing');
    const a = paraAlignPath(s, 'closing') ?? groupCjlr;
    out.push(bodyParagraphRich(s.closing, ctx, isSidebar, a ? { align: a } : {}));
  }
  return out;
}

function renderFoundation(s, ctx, isSidebar) {
  const out = [];
  const { style, fs, lang } = ctx;
  // v1.10.2: localize the FOUNDATION labels. The Danish forms match the
  // ones in the PWA's Dr translation dict ("Hands-on:" → "Praktisk:",
  // "Professionally:" → "Professionelt:"). Before this fix the labels
  // were hardcoded English even in Danish exports, producing the bug
  // the user reported: "FOUNDATION section the words 'hands-on' and
  // 'Professionally' are still in english when exporting a docx".
  const handsOnLabel       = lang === 'da' ? 'Praktisk: '       : 'Hands-on: ';
  const professionallyLabel = lang === 'da' ? 'Professionelt: ' : 'Professionally: ';
  const make = (label, body, align) => new Paragraph({
    spacing: { before: 60, after: 60, line: 276, lineRule: 'auto' },
    alignment: align,
    children: [
      new TextRun({
        text: label,
        bold: true,
        color: style.mainHeadColor,
        size: pt2hp(fs.mainBody),
        font: style.mainBodyFont,
      }),
      ...inlineRuns(body, {
        color: style.mainTextColor,
        size: pt2hp(fs.mainBody),
        font: style.mainBodyFont,
      }),
    ],
  });
  // CJLR v1.14.3 — edit-paths: "hands_on" and "professionally".
  // Use paraAlignPath so the group default doesn't mask a missing
  // path-specific override. Falls back to JUSTIFIED.
  const groupCjlr = paraAlign(s, null, undefined);
  const controls = (s.foundation_controls && typeof s.foundation_controls === 'object') ? s.foundation_controls : {};
  const ctlAlign = (part) => {
    const v = controls && controls[part] && controls[part].align;
    return (v === 'left' || v === 'center' || v === 'right' || v === 'justify') ? alignType(v) : null;
  };
  const ctlPage = (part) => {
    const n = Number(controls && controls[part] && controls[part].page);
    return Number.isFinite(n) && n >= 2 ? Math.round(n) : 1;
  };
  const handsOnAlign       = ctlAlign('hands_on')       ?? paraAlignPath(s, 'hands_on')       ?? groupCjlr ?? AlignmentType.JUSTIFIED;
  const professionallyAlign = ctlAlign('professionally') ?? paraAlignPath(s, 'professionally') ?? groupCjlr ?? AlignmentType.JUSTIFIED;
  if (s.hands_on) {
    if (ctlPage('hands_on') >= 2) out.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 } }));
    out.push(make(handsOnLabel, s.hands_on, handsOnAlign));
  }
  if (s.professionally) {
    if (ctlPage('professionally') >= 2) {
      out.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 } }));
      out.push(headingParagraph(String(s.title || 'FOUNDATION').toUpperCase() + ' (Cont.)', ctx, false));
    }
    out.push(make(professionallyLabel, s.professionally, professionallyAlign));
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────
// Bullets
// ──────────────────────────────────────────────────────────────────
function renderBullets(s, ctx, isSidebar) {
  if (!Array.isArray(s.items)) return [];
  return s.items.filter(it => it && (it.t || typeof it === 'string')).map((it, i) => {
    // CJLR v1.14.3 — try the {b,t}-pair path first ("items.<i>.t"),
    // then the plain item path ("items.<i>"), and only THEN fall
    // back to the group default. paraAlignPath gives us path-only
    // lookup so the group default doesn't mask a more specific
    // override on the alternative path.
    const itemAlign =
         paraAlignPath(s, 'items.' + i + '.t')
      ?? paraAlignPath(s, 'items.' + i)
      ?? paraAlign(s, null, undefined);  // group default OR undefined
    if (typeof it === 'string') return bulletParagraphRich('', it, ctx, isSidebar, itemAlign);
    const lead = it.b ? `${it.b}: ` : '';
    return bulletParagraphRich(lead, it.t, ctx, isSidebar, itemAlign);
  });
}

function bulletParagraphRich(lead, body, ctx, isSidebar, align, keepWithNext) {
  const { style, fs } = ctx;
  const baseRun = {
    color: isSidebar ? style.sidebarTextColor : style.mainTextColor,
    size: pt2hp(isSidebar ? fs.sbBody : fs.bulletContent),
    font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
  };
  return new Paragraph({
    numbering: { reference: isSidebar ? 'antcv-sb-bullet' : 'antcv-bullet', level: 0 },
    spacing: { before: 20, after: 20, line: 276, lineRule: 'auto' },
    alignment: align || AlignmentType.JUSTIFIED,
    // 1.50.270: keepLines so a single bullet never splits across pages;
    // keepWithNext (set by the experience renderer for every bullet but
    // the LAST in a role) chains the role's bullets so Word moves a whole
    // role that doesn't fit to the next page instead of splitting it
    // mid-role (owner 2026-06-07: SysA & Change Control role was cut in
    // half across the page break, its last two bullets orphaned on p2).
    keepLines: true,
    keepNext: !!keepWithNext,
    children: [
      ...(lead ? [new TextRun({
        text: lead,
        bold: true,
        // Selected Outcomes lead (the verb / action title) renders in
        // BOLD BLACK in the main column to match the preview — previously
        // it was teal which made the action read as a sub-heading rather
        // than as a continuous bold run with the result text. In the
        // sidebar we keep the head colour for visibility against navy.
        color: isSidebar ? style.sidebarHeadColor : style.mainTextColor,
        size: baseRun.size,
        font: baseRun.font,
      })] : []),
      ...inlineRuns(body || '', baseRun),
    ],
  });
}

// ──────────────────────────────────────────────────────────────────
// Competency table (Focus Area | Strategic Expertise)
// ──────────────────────────────────────────────────────────────────
function renderCompetencyTable(s, ctx) {
  const { style, fs } = ctx;
  const rows = Array.isArray(s.rows) ? s.rows : [];
  if (rows.length === 0) return [];
  const [header, ...data] = rows;

  const isCl = ctx.doc === 'cl';
  const defaultCvW = MAIN_W - 640;
  // 1.14.26: the CL is full-width linear (no sidebar). The body + text sections
  // now span the full CL body cell (PAGE_W - 200 = 11706), but the owner wants
  // the WHAT-I-BRING table LARGE yet clearly INSET from the page edges and
  // CENTERED — 1.14.25's PAGE_W-560 (~97%) read as edge-to-edge / left-justified.
  // Use ~80% of the body width; the table's CENTER alignment then leaves a
  // balanced ~0.8" margin on each side.
  const defaultClW = Math.round((PAGE_W - 200) * 0.8);
  const baseW = isCl ? defaultClW : defaultCvW;
  const tableW = (typeof s.tableWidth === 'number' && s.tableWidth > 0)
    ? Math.max(2880, Math.min(PAGE_W - 720, Math.round(s.tableWidth)))
    : baseW;
  const explicitRatio = (typeof s.tableRatio === 'number' && s.tableRatio > 0.05 && s.tableRatio < 0.95)
    ? s.tableRatio
    : null;
  const col1 = Math.round(tableW * (explicitRatio !== null ? explicitRatio : 0.326));
  const col2 = tableW - col1;
  const tableHeaderBg = (style && style.tableHeaderBg) || style.mainHeadColor;
  const border = { style: BorderStyle.SINGLE, size: 4, color: tableHeaderBg };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const headerAlignT = alignType(s.headerAlign || 'center');

  function makeHeaderRow() {
    return new TableRow({
      tableHeader: true,
      children: (header || ['', '']).map((cell, i) => new TableCell({
        width: { size: i === 0 ? col1 : col2, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: tableHeaderBg, color: 'auto' },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: headerAlignT,
          children: inlineRuns(cell, {
            bold: true,
            color: 'FFFFFF',
            size: pt2hp(fs.mainTblH),
            font: style.mainHeadFont,
          }),
        })],
      })),
    });
  }

  function makeDataRow(r, idx) {
    return new TableRow({
      children: (r || []).slice(0, 2).map((cell, i) => new TableCell({
        width: { size: i === 0 ? col1 : col2, type: WidthType.DXA },
        shading: idx % 2 === 0
          ? undefined
          : { type: ShadingType.CLEAR, fill: 'FAFAFA', color: 'auto' },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
          children: inlineRuns(cell, {
            bold: i === 0,
            color: style.mainTextColor,
            size: pt2hp(fs.mainTblCell),
            font: style.mainBodyFont,
          }),
        })],
      })),
    });
  }

  function makeTable(dataRows, offset) {
    return new Table({
      width: { size: tableW, type: WidthType.DXA },
      columnWidths: [col1, col2],
      borders: cellBorders,
      alignment: AlignmentType.CENTER,
      rows: [makeHeaderRow(), ...dataRows.map((r, i) => makeDataRow(r, offset + i))],
    });
  }

  const rowPages = (s.row_pages && typeof s.row_pages === 'object') ? s.row_pages : {};
  function pageForDataIndex(dataIdx) {
    const withHeader = Number(rowPages[String(dataIdx + 1)]);
    const withoutHeader = Number(rowPages[String(dataIdx)]);
    const n = Number.isFinite(withHeader) ? withHeader : withoutHeader;
    return (Number.isFinite(n) && n >= 2) ? Math.round(n) : 1;
  }

  const chunks = [];
  let current = [];
  let currentStart = 0;
  for (let i = 0; i < data.length; i++) {
    const p = pageForDataIndex(i);
    if (p >= 2 && current.length) {
      chunks.push({ rows: current, start: currentStart, page: 1 });
      current = [];
      currentStart = i;
    }
    current.push(data[i]);
  }
  if (current.length) chunks.push({ rows: current, start: currentStart, page: chunks.length ? 2 : 1 });

  const out = [];
  chunks.forEach((chunk, chunkIdx) => {
    if (chunkIdx > 0) {
      out.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 } }));
      if (s.title) out.push(headingParagraph(String(s.title || '').toUpperCase() + ' (Cont.)', ctx, false));
    }
    out.push(makeTable(chunk.rows, chunk.start));
    out.push(new Paragraph({ spacing: { before: 0, after: 40, line: 20, lineRule: 'exact' }, children: [] }));
  });

  return out;
}

// ──────────────────────────────────────────────────────────────────
// Experience — left:[Role title], [Company]   right:[YYYY – YYYY]
// ──────────────────────────────────────────────────────────────────
function renderExperience(s, ctx) {
  const { style, fs } = ctx;
  const out = [];
  const roles = Array.isArray(s.roles) ? s.roles.filter(r => r && r.on !== false) : [];

  // Right edge of the main column, in DXA, accounting for the cell margins.
  const rightTab = MAIN_W - 640 - 40;

  // 1.50.286 SALMON-EXPORT-EXPERIENCE-001: honour MANUAL role page breaks
  // (role.page, set by the per-role 📄 page button). renderExperience
  // previously ignored role.page, so a manual salmon on a role produced NO
  // page break in the exported PDF/Word. Insert ONE pageBreakBefore (+ a
  // "(Cont.)" heading) at each point the role page increases, monotonically.
  let __runMaxRolePage = 1;
  roles.forEach((role, ri) => {
    const __rp = Number(role && role.page);
    const __pg = (Number.isFinite(__rp) && __rp >= 2 && __rp <= 4) ? Math.round(__rp) : 1;
    if (__pg > __runMaxRolePage) {
      __runMaxRolePage = __pg;
      out.push(new Paragraph({ pageBreakBefore: true, spacing: { before: 0, after: 0 } }));
      if (s.title) out.push(headingParagraph(String(s.title || "").toUpperCase() + " (Cont.)", ctx, false));
    }
    const left = [];
    if (role.title) {
      left.push(new TextRun({
        text: role.title,
        bold: true,
        italics: true,
        color: style.mainHeadColor,
        size: pt2hp(fs.expSubHead),
        font: style.mainBodyFont,
      }));
    }
    if (role.company) {
      left.push(new TextRun({
        text: (left.length ? ' | ' : '') + role.company,
        italics: true,
        // Spec: role title in main head colour, COMPANY in BLACK, year in gray.
        color: style.mainTextColor,
        size: pt2hp(fs.expSubHead),
        font: style.mainBodyFont,
      }));
    }
    const yearsRun = role.years ? new TextRun({
      text: '\t' + role.years,
      color: '595959',
      size: pt2hp(fs.expSubHead),
      font: style.mainBodyFont,
    }) : null;

    if (left.length || yearsRun) {
      // CJLR v1.14.3 — role-line override: try "roles.<i>.title"
      // first (most specific), then "roles.<i>", then fall back
      // to the group default (or undefined when neither set, so
      // the tab-stop layout — left text + right-aligned year —
      // keeps working as before).
      const roleAlign =
           paraAlignPath(s, 'roles.' + ri + '.title')
        ?? paraAlignPath(s, 'roles.' + ri)
        ?? paraAlign(s, null, undefined);
      out.push(new Paragraph({
        spacing: { before: 120, after: 40 },
        alignment: roleAlign,
        // keepNext: the role title (e.g. "Customer Change Requests Specialist
        // | Innoviz Technologies | 2020 — 2025") must stay glued to its
        // first bullet. Otherwise Word can leave the title alone at the
        // bottom of a page with bullets stranded on the next page.
        keepNext: true,
        keepLines: true,
        tabStops: [{ type: TabStopType.RIGHT, position: rightTab }],
        children: [...left, ...(yearsRun ? [yearsRun] : [])],
      }));
    }

    if (Array.isArray(role.bullets)) {
      const _bl = role.bullets.filter(Boolean);
      _bl.forEach((b, bi) => {
        // CJLR v1.14.3 — per-bullet override path is
        // "roles.<i>.bullets.<j>" (matches the PWA's translation
        // enumerator). Falls back to group default otherwise.
        const bAlign = paraAlignPath(s, 'roles.' + ri + '.bullets.' + bi)
                    ?? paraAlign(s, null, undefined);
        // 1.50.270: every bullet but the LAST keeps with the next, so the
        // title→b1→…→b(n) chain stays together and a role moves wholesale
        // to the next page rather than splitting mid-role. The last bullet
        // has no keepNext, so the page break can fall cleanly AFTER the role.
        const _keepWithNext = bi < _bl.length - 1;
        out.push(bulletParagraphRich('', String(b), ctx, /*isSidebar*/ false, bAlign, _keepWithNext));
      });
    }
  });

  return out;
}

// ──────────────────────────────────────────────────────────────────
// Simple list
// Supports `bullet_style: 'none'` and `align: 'center' | 'left'`
// for centred/no-bullet rendering (CERTIFICATIONS, PUBLICATIONS).
// ──────────────────────────────────────────────────────────────────
// Normalize a list item into a non-empty string, or null if the
// item should be skipped entirely. Items arrive in three shapes:
//
//   1. plain strings              → trimmed
//   2. objects with text content  → extracted using common field
//                                   names (text, value, title, label,
//                                   citation, body, name)
//   3. {label, value} pairs       → joined as "label: value"
//   4. {on: false}                → skipped (hidden by user)
//   5. empty / undefined / null   → skipped
//
// Without this helper the worker stringifies object items into the
// literal text "[object Object]" via String(item) inside
// decodeBasicEntities, which is what produced the bug seen in
// PUBLICATIONS & PATENT exports where each item showed as
// "[object Object]" in Word.
// Normalised key for de-duplicating list items.
//
// Pipeline (each step kills a class of formatting variation users
// produce when re-typing the same fact in different styles):
//
//   1. Strip HTML tags — `<b>"Title"</b>` and plain "Title" must
//      collapse. Without this, the `<b>` becomes a leading "b"
//      after the non-alnum sweep and the keys diverge.
//   2. Split on the FIRST separator (em-dash / en-dash / colon /
//      hyphen with surrounding spaces). Most entries follow the
//      shape "<canonical name> — <descriptor>" or "<canonical>:
//      <details>". Discarding everything after the separator means
//      "Patent 241997 — A Cover Window" and "Patent No. 241997:
//      Co-inventor of cover window..." both reduce to their pre-
//      separator portion ("Patent 241997" / "Patent No. 241997")
//      and then collide once "No." is stripped.
//   3. Strip number-prefix words ("No.", "Nr.", "Num.", "Number")
//      — purely decorative before the actual ID digits.
//   4. Strip parentheticals  ("(Uni. of Toronto)" → "")
//   5. Strip conjunctions ("and", "og", "och", "et", "y") — kills
//      the "Systems, safety AND cybersecurity" vs "Systems, safety
//      & cybersecurity" mismatch where one uses the word and the
//      other an ampersand (which gets stripped by step 6 anyway).
//   6. Strip non-alphanumeric, lowercase. (Smart quotes, &, em-dash
//      remnants, periods, all become nothing.)
//
// No length cap here — dedupeStrings uses prefix-containment plus
// a longest-common-prefix fallback, so callers don't need a
// truncated fixed-length key.
function dedupeKey(s) {
  return String(s || '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .split(/\s+[—–]\s+|\s+-\s+|:\s+/)[0]
    .replace(/\b(?:no\.?|nr\.?|num\.?|number)\b/gi, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\b(?:and|og|och|et|y)\b/gi, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

// De-duplicate items in a normalized-string array using TWO levels
// of matching, both of which require a meaningful key length so
// short identifiers ("AI", "ISO") never collapse legit-different
// items.
//
// Level 1 — strict prefix containment (min 8-char overlap):
//   "AI Practitioner CNX-CAIP" vs "AI-Practitioner" — both
//   normalise starting with "aipractitioner"; the longer key
//   simply extends. Caught.
//
// Level 2 — longest common prefix ≥ 25 chars:
//   Publication titles where two formats share a long literal
//   prefix then diverge in journal-name wording. Neither is a
//   strict prefix of the other (both have content after the LCP)
//   but the LCP is much longer than would happen by chance.
//   "Carbon nanotube integration procedures into NEMS devices,
//   Karp et al., Eurosensors, 2008" and "Carbon Nanotube
//   Integration Procedures into NEMS Devices, Karp et al.,
//   Eurosensors Conference Proceedings, 2008" share 60+ chars
//   of prefix. Caught.
//
// Counter-examples that should NOT collapse:
//   - "Six Sigma Black Belt" vs "Six Sigma Yellow Belt" — LCP
//     is "sixsigma" (8 chars), well below the 25-char Level-2
//     threshold. Both kept.
//   - "ISO 9001" vs "ISO 27001" — LCP "iso" (3 chars). Both kept.
//
// Preserves first occurrence (typically the longer, more specific
// form which the user is most likely to want to see in the docx).
function dedupeStrings(items) {
  const kept = [];
  const out = [];
  for (const item of items) {
    const k = dedupeKey(item);
    if (!k) { out.push(item); continue; }
    let isDup = false;
    for (const k2 of kept) {
      if (k === k2) { isDup = true; break; }
      const minLen = Math.min(k.length, k2.length);
      // Level 1: strict prefix containment
      if (minLen >= 8 && (k.startsWith(k2) || k2.startsWith(k))) {
        isDup = true; break;
      }
      // Level 2: long common prefix (catches the publication
      // multi-format case)
      if (k.length >= 30 && k2.length >= 30) {
        let lcp = 0;
        const max = Math.min(k.length, k2.length);
        while (lcp < max && k[lcp] === k2[lcp]) lcp++;
        if (lcp >= 25) { isDup = true; break; }
      }
    }
    if (!isDup) { kept.push(k); out.push(item); }
  }
  return out;
}

function normalizeItem(item) {
  if (item == null) return null;
  if (typeof item === 'string') {
    const t = item.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof item !== 'object') {
    const s = String(item).trim();
    return s.length > 0 ? s : null;
  }
  // Object — respect explicit hide flag from the PWA's per-item
  // visibility toggle (eye icon).
  if (item.on === false) return null;
  // Try common single-string fields first.
  const tryKeys = ['text', 'value', 'title', 'body', 'name', 'citation'];
  for (const k of tryKeys) {
    const v = item[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      // Optional secondary field (e.g. publication title + citation)
      const more =
        (k !== 'citation' && typeof item.citation === 'string' && item.citation.trim()) ? item.citation.trim() :
        (k !== 'value' && typeof item.value === 'string' && item.value.trim()) ? item.value.trim() :
        null;
      return more ? `${v.trim()} — ${more}` : v.trim();
    }
  }
  // {label, value} pair — common in labeled lists when the renderer
  // dispatched to renderSimpleList by mistake.
  if (typeof item.label === 'string' && typeof item.value === 'string'
      && (item.label.trim() || item.value.trim())) {
    const l = item.label.trim();
    const v = item.value.trim();
    if (l && v) return `${l}: ${v}`;
    return l || v;
  }
  // No usable string content — skip rather than render "[object Object]".
  return null;
}

function renderSimpleList(s, ctx, isSidebar, italic) {
  const { style, fs } = ctx;
  if (!Array.isArray(s.items)) return [];
  const autoNoBullet = isNoBulletCenteredSection(s);
  // v1.50.19 — academic-reference auto-format. Activates when the
  // active writing style is research-formal AND the section is one of
  // the academic citation sections (publications, conferences_talks,
  // grants_fellowships, selected_research_outcomes, research_experience).
  // Layout: no bullets, justified, hanging indent so wrapped lines
  // align under the first character of the entry — standard academic
  // CV reference convention. The hanging indent is applied per-
  // paragraph below; this flag controls the bullet + alignment choice.
  const isAcademic = ctx.writingStyle === 'research-formal' &&
                     isAcademicReferenceSection(s);
  // Sidebar lists are bullet-free by default — the user spec is:
  // "all sidebar content has no bullets in sidebar items by default".
  // Explicit s.bullet_style: 'bullet' opts back in. Main column keeps
  // the legacy "bullets unless explicitly off" behaviour.
  const useBullets = isAcademic
    ? false
    : autoNoBullet
      ? false
      : (isSidebar
          ? (s.bullet_style === 'bullet')
          : (s.bullet_style || 'bullet') !== 'none');
  // Default alignment depends on which auto-format applies:
  //   - academic-reference  → justified + hanging indent (research-formal)
  //   - publications/patent → justified (multi-line citation wrapping)
  //   - certifications      → centred (short single-line entries)
  //   - sidebar bullets     → justified (multi-line skill descriptions in
  //                            narrow sidebar look cleaner with justified
  //                            edges; the user explicitly requested this)
  //   - main bullets        → left
  //   - centered no-bullet  → center
  // An explicit `s.align` overrides the auto choice.
  const autoAlign = isAcademic
    ? 'justify'
    : isPublicationsSection(s)
      ? 'justify'
      : autoNoBullet
        ? 'center'
        : (useBullets ? (isSidebar ? 'justify' : 'left') : 'center');
  // CJLR v1.14.3 — `item_alignment.__group__` is the highest-
  // priority section-wide source (set by the per-section cycler
  // in the editor). Per-item overrides at "items.<i>" are checked
  // inside the per-item loop below.
  const groupCjlr = paraAlign(s, null, null);
  const a = groupCjlr != null ? groupCjlr : alignType(s.align || autoAlign);

  // Build pairs of (original-index, normalized-string) so we
  // can keep the per-item CJLR override mapped to the right
  // edit-path. Dedup is applied while preserving the FIRST
  // occurrence's index (matches dedupeStrings' first-wins
  // semantics).
  //
  // Visibility filter — drop items hidden by any of the three
  // ways the PWA can mark them (s.hidden[i], it.hidden, it.on=false).
  const visibleIndexes = (s.items || []).map((_, i) => i)
    .filter(i => !(s.hidden && s.hidden[i]))
    .filter(i => {
      const it = s.items[i];
      return !(it && typeof it === 'object' && it.hidden);
    });
  const normalizedPairs = visibleIndexes
    .map(i => ({ idx: i, text: normalizeItem(s.items[i]) }))
    .filter(p => typeof p.text === 'string' && p.text.length > 0);
  // dedupeStrings collapses near-identical entries (strict prefix
  // containment + long common prefix); reproduce the same logic
  // here while keeping the first occurrence's original index so
  // CJLR per-item overrides stay mapped to the right edit-path.
  const keptKeys = [];
  const dedupedPairs = [];
  for (const p of normalizedPairs) {
    const k = dedupeKey(p.text);
    if (!k) { dedupedPairs.push(p); continue; }
    let isDup = false;
    for (const k2 of keptKeys) {
      if (k === k2) { isDup = true; break; }
      const minLen = Math.min(k.length, k2.length);
      if (minLen >= 8 && (k.startsWith(k2) || k2.startsWith(k))) {
        isDup = true; break;
      }
      if (k.length >= 30 && k2.length >= 30) {
        let lcp = 0;
        const max = Math.min(k.length, k2.length);
        while (lcp < max && k[lcp] === k2[lcp]) lcp++;
        if (lcp >= 25) { isDup = true; break; }
      }
    }
    if (!isDup) { keptKeys.push(k); dedupedPairs.push(p); }
  }
  if (dedupedPairs.length === 0) return [];

  // v1.14.8: per-item page-break support in simple lists. Each item
  // whose source object carries `_page >= 2` (set by the PWA's
  // normalizeSections from antcv:itemPages) gets a pageBreakBefore
  // paragraph plus a "<TITLE> (CONT.)" continuation heading inserted
  // ahead of it. Plain-string items have no page metadata; only the
  // wrapper-shape `{ text, _page }` items can be flagged. The renderer
  // collects results into a flat Paragraph array so we can interleave
  // breaks and content paragraphs in order.
  const sectionTitleUpper = String(s.title || '').toUpperCase();
  const makeContHeader = () => new Paragraph({
    spacing: { before: 0, after: 120 },
    alignment: a,
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor },
    },
    shading: isSidebar
      ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
      : undefined,
    children: [new TextRun({
      text: sectionTitleUpper + ' ' + (ctx.contSuffix || '(CONT.)'),
      bold: true,
      color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor,
      size: pt2hp(isSidebar ? fs.sbHead : fs.mainHead),
      font: isSidebar ? style.sidebarFont : style.mainHeadFont,
    })],
  });
  const makeBreakPara = () => new Paragraph({
    pageBreakBefore: true,
    spacing: { before: 0, after: 0 },
  });

  const isPubs = isPublicationsSection(s);
  const outParas = [];
  let _simpleSkippedFirstSectionBreak = false;
  for (const { idx, text: item } of dedupedPairs) {
    // Check the ORIGINAL item for a _page assignment. The source
    // could be a plain string, in which case there's no page metadata.
    const src = s.items && s.items[idx];
    const page = (src && typeof src === 'object' && Number(src._page) >= 2) ? Number(src._page) : 0;
    if (page >= 2) {
      // PB-002: when the section's first item already moved the whole
      // section to the next page (s._antcvFirstItemPageMoved set in
      // renderSection), skip the in-loop break+contHeader for that
      // first flagged item to avoid duplicating the section heading.
      if (idx === 0 && s._antcvFirstItemPageMoved && !_simpleSkippedFirstSectionBreak) {
        _simpleSkippedFirstSectionBreak = true;
      } else {
        outParas.push(makeBreakPara());
        outParas.push(makeContHeader());
      }
    }
    const baseRun = {
      color: isSidebar ? style.sidebarTextColor : style.mainTextColor,
      size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
      font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
    };
    let children;
    if (isPubs) {
      // Publication entries: NAME (everything before the first em-dash,
      // en-dash, or colon) renders bold + italic; DESCRIPTION (the rest)
      // renders normal. Matches the on-screen preview.
      const stripHtml = t => String(t || '').replace(
        /<\/?(?:b|i|strong|em)\b[^>]*>/gi, ''
      );
      const { name, rest } = splitPublicationCitation(item);
      children = [
        new TextRun({ ...baseRun, text: stripHtml(name), bold: true, italics: true }),
      ];
      if (rest) {
        children.push(new TextRun({ ...baseRun, text: ' \u2014 ' + stripHtml(rest) }));
      }
    } else {
      children = inlineRuns(item, { ...baseRun, italics: italic });
    }
    // CJLR v1.14.3 — per-item override path is "items.<original_idx>"
    const itemAlign = paraAlignPath(s, 'items.' + idx) ?? a;
    const para = {
      spacing: isAcademic
        ? { before: 80, after: 80, line: 264, lineRule: 'auto' }
        : { before: 30, after: 30, line: 252, lineRule: 'auto' },
      alignment: itemAlign,
      shading: isSidebar
        ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
        : undefined,
      children,
    };
    // v1.50.19 — hanging indent on academic-reference entries.
    // left = 360 dxa (~0.25") shifts the whole paragraph right;
    // hanging = 360 pulls the first line back to the margin, leaving
    // wrapped lines aligned under the first character of the entry.
    if (isAcademic) {
      para.indent = { left: 360, hanging: 360 };
    }
    if (useBullets) {
      para.numbering = { reference: isSidebar ? 'antcv-sb-bullet' : 'antcv-bullet', level: 0 };
    }
    outParas.push(new Paragraph(para));
  }
  return outParas;
}

// ──────────────────────────────────────────────────────────────────
// Labeled list — supports `{group: 'Subhead'}` items as section breaks.
// Sidebar labels white (override via style.sidebarLabelColor).
// ──────────────────────────────────────────────────────────────────
function renderLabeledList(s, ctx, isSidebar) {
  const { style, fs } = ctx;
  if (!Array.isArray(s.items)) return [];
  const out = [];
  // Pre-filter: respect every hidden signal the PWA uses.
  //
  // The PWA has THREE separate ways an item can be marked hidden:
  //   1. section.hidden[i] = true   — per-item map at section level
  //                                   (the eye-toggle button)
  //   2. item.hidden = true         — flag on the item itself
  //   3. item.on === false          — legacy visibility flag
  //
  // Plus a 4th cascade rule: when a {group: …} divider has hidden:
  // true, every subsequent item (until the next group divider) is
  // hidden as well. Without these checks the worker emitted every
  // item in REGULATORY CONTEXT even though only the first few were
  // visible in the preview — exactly the bug the user reported.
  // Cascade DISABLED per user spec: "If a group is invisible do not
  // make the items below it invisible (let me decide). If a group has
  // no visible items below it - than hide it as well." So a hidden
  // group still suppresses its OWN heading (line above) but its items
  // are evaluated by their individual hidden flags only. The
  // orphan-suppression pass further down drops a group whose items
  // were ALL individually hidden — keeping the rendered output clean.
  let groupHidden = false;
  const visible = [];
  s.items.forEach((it, i) => {
    if (!it) return;
    // Group dividers update the flag based on their own hidden state.
    const isSubhead = it.group !== undefined || it.subhead !== undefined ||
                      it.header !== undefined || it.category !== undefined;
    if (isSubhead) {
      groupHidden = !!it.hidden || (s.hidden && !!s.hidden[i]);
      if (groupHidden) return;  // suppress only the group HEADING
      visible.push(it);
      return;
    }
    // NB: no `if (groupHidden) return;` here — items below a hidden
    // group are evaluated independently.
    if (s.hidden && s.hidden[i]) return;
    if (it.hidden === true) return;
    if (it.on === false) return;
    // Value items also need a non-empty value or they render as
    // "Label: " with a dangling colon.
    const hasValue = (typeof it.v === 'string' && it.v.trim()) ||
                     (typeof it.value === 'string' && it.value.trim());
    if (!hasValue) return;
    visible.push(it);
  });
  // Dedupe both labels AND subheads using normalised keys.
  //
  // Labels (content items): catches near-duplicates like "Volunteer"
  // vs "Volunteering" (one is prefix of the other). Uses 7-char
  // overlap for prefix containment so 8-char labels like "Languages"
  // also work.
  //
  // Subheads: catches the "Systems, safety AND cybersecurity" vs
  // "Systems, safety & cybersecurity" mismatch that appeared in
  // REGULATORY CONTEXT — the ampersand-version was added later by
  // a JD analysis pass and never deduped against the spelled-out
  // version. dedupeKey strips conjunctions so both reduce to the
  // same key.
  //
  // Two separate kept-key lists so a label can never collapse
  // against a subhead (different visual roles in the docx).
  const keptLabelKeys = [];
  const keptSubheadKeys = [];
  const dedupeFromList = (k, list) => {
    if (!k) return false;
    for (const k2 of list) {
      if (k === k2) return true;
      const minLen = Math.min(k.length, k2.length);
      if (minLen >= 7 && (k.startsWith(k2) || k2.startsWith(k))) return true;
      // Long-LCP fallback for cases where both keys have content
      // after the shared prefix but the prefix is decisive.
      if (k.length >= 25 && k2.length >= 25) {
        let lcp = 0;
        const max = Math.min(k.length, k2.length);
        while (lcp < max && k[lcp] === k2[lcp]) lcp++;
        if (lcp >= 20) return true;
      }
    }
    return false;
  };
  const deduped = visible.filter(it => {
    const isSubhead = it.group !== undefined || it.subhead !== undefined ||
                      it.header !== undefined || it.category !== undefined;
    if (isSubhead) {
      const sub = it.group || it.subhead || it.header || it.category || '';
      const k = dedupeKey(String(sub));
      if (!k) return true;
      if (dedupeFromList(k, keptSubheadKeys)) return false;
      keptSubheadKeys.push(k);
      return true;
    }
    const label = (it.l || it.label || '').toString().trim();
    const value = (it.v || it.value || '').toString().trim();
    const k = dedupeKey(label || value);
    if (!k) return true;
    if (dedupeFromList(k, keptLabelKeys)) return false;
    keptLabelKeys.push(k);
    return true;
  });
  if (deduped.length === 0) return [];
  // Suppress orphan subheads — a {group: '…'} divider with no
  // visible items between it and the next divider (or end of list)
  // would render as a dangling header in the docx. This happens
  // when the user has hidden every item under a particular
  // subsection via the eye-toggle. The fix: after dedupe, do one
  // more pass that drops any subhead with nothing below it.
  //
  // We check for "subheadness" the same way the rendering loop
  // below does (line 1563): explicit {group|subhead|header|category}
  // markers, plus the REGULATORY-CONTEXT fallback where an item
  // with a label but no value is treated as a subhead.
  const isMaybeSubhead = (it) => !!(it && (
    it.group || it.subhead || it.header || it.category ||
    (String(s.id || '').toLowerCase().includes('regulatory') &&
     (it.l || it.label) && !(it.v || it.value))
  ));
  const noOrphans = [];
  for (let i = 0; i < deduped.length; i++) {
    const it = deduped[i];
    if (isMaybeSubhead(it)) {
      // Look ahead — is there a non-subhead item before the next
      // subhead (or end of list)?
      let hasContent = false;
      for (let j = i + 1; j < deduped.length; j++) {
        if (isMaybeSubhead(deduped[j])) break;
        hasContent = true;
        break;
      }
      if (!hasContent) continue;  // orphan — drop
    }
    noOrphans.push(it);
  }
  if (noOrphans.length === 0) return [];
  // Extract a usable string from any value that could be the subhead.
  // The PWA occasionally sends object-shaped values here (e.g. when a
  // user fields gets serialised via a typed control). Without this
  // guard, `String({...})` renders as "[object Object]" — the exact
  // bug the user reported. We try common string-bearing fields, and
  // if none yield a non-empty string we skip the subhead rather than
  // emit "[object Object]".
  const subheadString = (value) => {
    if (value == null) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value !== 'object') return String(value).trim();
    for (const k of ['text', 'title', 'name', 'value', 'label', 'group', 'subhead', 'header', 'category']) {
      const v = value[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return '';
  };
  // CJLR v1.14.3 — section-level group default. For labeled_list
  // we honour only the group alignment; per-item overrides for
  // labeled rows are deferred (they'd need original-index threading
  // through the dedupe + orphan-suppression passes — a structural
  // change rather than a one-liner).
  const groupCjlr = paraAlign(s, null, null);
  // v1.14.8: per-item page-break support inside labeled_list. The
  // PWA's normalizeSections annotates each item with `_page: N` when
  // the user assigned the item to page ≥ 2 via the antcv:itemPages
  // editor cycler. We insert a `pageBreakBefore: true` empty para
  // ahead of the matching paragraph plus a continuation heading
  // styled to match the section's main heading. This mirrors the
  // pattern Professional Experience already uses for role-level
  // breaks.
  //
  // The continuation heading text is "<SECTION TITLE> (CONT.)".
  // Using a real Paragraph rather than a Break run avoids the
  // spacing nudge from inherited font sizes.
  const sectionTitleUpper = String(s.title || '').toUpperCase();
  const emitPageBreakAndContHeader = () => {
    out.push(new Paragraph({
      pageBreakBefore: true,
      spacing: { before: 0, after: 0 },
    }));
    out.push(new Paragraph({
      spacing: { before: 0, after: 120 },
      alignment: groupCjlr != null
        ? groupCjlr
        : (isSidebar ? AlignmentType.CENTER : AlignmentType.LEFT),
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor },
      },
      shading: isSidebar
        ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
        : undefined,
      children: [new TextRun({
        text: sectionTitleUpper + ' ' + (ctx.contSuffix || '(CONT.)'),
        bold: true,
        color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor,
        size: pt2hp(isSidebar ? fs.sbHead : fs.mainHead),
        font: isSidebar ? style.sidebarFont : style.mainHeadFont,
      })],
    }));
  };

  let _skippedFirstSectionBreak = false;
  noOrphans.forEach(it => {
    // v1.14.8: emit a break BEFORE rendering this item if it carries
    // the _page marker. Skip the break for items whose page is 1 (the
    // default) or unset. v1.14.12: when sidebar item 0 is assigned to
    // a later page, renderSection has already moved the whole
    // subsection heading, so do not add a second in-section break.
    if (it && typeof it === 'object' && Number(it._page) >= 2) {
      if (s._antcvFirstItemPageMoved && !_skippedFirstSectionBreak) {
        _skippedFirstSectionBreak = true;
      } else {
        try { emitPageBreakAndContHeader(); } catch (_) {}
      }
    }
    const maybeSubhead = it.group || it.subhead || it.header || it.category || (String(s.id || '').toLowerCase().includes('regulatory') && (it.l || it.label) && !(it.v || it.value));
    if (maybeSubhead) {
      const subheadText = subheadString(maybeSubhead);
      // Skip the subhead entirely if we couldn't pull a string —
      // better to have no subhead than a literal "[object Object]"
      // staring back at the reader.
      if (!subheadText) return;
      out.push(new Paragraph({
        spacing: { before: 120, after: 40 },
        // keepNext: the group subhead must stay with at least the
        // first item under it (no orphaned subhead at bottom of page).
        keepNext: true,
        keepLines: true,
        // CJLR group default overrides the sidebar-CENTER default
        // when set; otherwise the existing per-loc rule applies.
        alignment: groupCjlr != null
          ? groupCjlr
          : (isSidebar ? AlignmentType.CENTER : undefined),
        shading: isSidebar
          ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
          : undefined,
        children: [
          new TextRun({
            text: subheadText,
            bold: true,
            // Sidebar group subheads render in the same teal as the
            // sidebar section headings (sidebarHeadColor). User spec:
            // group labels should match the heading colour, not be
            // white. Main column keeps the same teal heading colour.
            color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor,
            size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
            font: isSidebar ? style.sidebarFont : style.mainHeadFont,
          }),
        ],
      }));
      return;
    }
    const label = stripInlineHtmlTags(it.l || it.label || '').toString();
    const value = (it.v || it.value || '').toString();
    const labelColor = isSidebar
      ? (style.sidebarLabelColor || style.sidebarTextColor)
      : style.mainHeadColor;
    out.push(new Paragraph({
      spacing: { before: 40, after: 40, line: 252, lineRule: 'auto' },
      // CJLR group default overrides the sidebar-JUSTIFIED default
      // when set; otherwise the existing per-loc rule applies.
      alignment: groupCjlr != null
        ? groupCjlr
        : (isSidebar ? AlignmentType.JUSTIFIED : undefined),
      shading: isSidebar
        ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
        : undefined,
      children: [
        ...(label ? [new TextRun({
          text: `${label}: `,
          bold: true,
          color: labelColor,
          size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
          font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
        })] : []),
        ...inlineRuns(value, {
          color: isSidebar ? style.sidebarTextColor : style.mainTextColor,
          size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
          font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
        }),
      ],
    }));
  });
  return out;
}

// ──────────────────────────────────────────────────────────────────
// Education — sidebar all white, main has teal degree + grey school.
// ──────────────────────────────────────────────────────────────────
function renderEducation(s, ctx, isSidebar) {
  const { style, fs } = ctx;
  if (!Array.isArray(s.items)) return [];
  const out = [];
  // Filter every way an item can be hidden: section.hidden[i] (PWA
  // eye toggle), item.hidden, and the legacy on:false. Also drop
  // items with no degree+school content. Items with only one of
  // the two are allowed through — a degree without an institution
  // still has render value.
  const visible = s.items.filter((it, i) => {
    if (!it) return false;
    if (s.hidden && s.hidden[i]) return false;
    if (it.hidden === true) return false;
    if (it.on === false) return false;
    const deg = (it.deg || it.degree || '').toString().trim();
    const sch = (it.sch || it.school || '').toString().trim();
    return Boolean(deg || sch);
  });
  // Dedupe degree entries. Earlier versions used dedupeKey(degree)
  // which took the first 25 alphanumeric chars — but that missed
  // "B.Sc., Physics & B.Sc., Electrical Engineering" vs "B.Sc.,
  // Physics & B.Sc.,EE" because the abbreviation diverged inside
  // the first 25 chars. The new key takes the FIRST 3 WORDS of the
  // degree text (already covers the discriminating part of any
  // realistic degree) AND the first 10 normalised chars of the
  // school. Both BSc-Physics from Tel Aviv now collapse to the
  // same key regardless of whether the second degree is spelled out
  // ("Electrical Engineering") or abbreviated ("EE").
  //
  // Two-PhD-from-same-school case: PhD from MIT in CompSci vs PhD
  // from MIT in Math gives "phdcomputersciencemit" vs
  // "phdmathematicsmit" — different first-3 words, stays distinct.
  const eduKey = (deg, sch) => {
    const words = String(deg || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
      .join('');
    const schoolPart = String(sch || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(0, 10);
    return words + schoolPart;
  };
  const seenKeys = new Set();
  const deduped = visible.filter(it => {
    const deg = (it.deg || it.degree || '').toString().trim();
    const sch = (it.sch || it.school || '').toString().trim();
    const key = eduKey(deg, sch);
    if (!key) return true;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  if (deduped.length === 0) return [];
  // CJLR v1.14.3 — group default overrides the sidebar-JUSTIFIED
  // default when set. We don't thread per-item indices through
  // the eduKey/dedupe pipeline in v1.14.3, so per-item alignment
  // overrides are not yet honoured for education entries.
  const groupCjlr = paraAlign(s, null, null);
  // v1.14.6: inline education layout — render `deg` and `sch` as
  // a single paragraph "DEG: SCH" instead of two stacked paragraphs.
  // The two-paragraph layout wasted 3–4 lines of sidebar real estate
  // per entry (5 entries = ~15 lines = half a column). Matches the
  // React preview which now also uses colon-inline.
  //
  // v1.14.6 also adds defensive parsing for the case where source
  // data has the entry packed into `deg` (e.g. "MBA\nTechnion. ..."
  // from an upload). We split on the first newline so the output is
  // always one clean inline line per entry, regardless of how the
  // upstream data is shaped.
  // v1.14.8: per-item page-break support for education.
  const eduSectionTitleUpper = String(s.title || '').toUpperCase();
  const emitEduBreakAndCont = () => {
    out.push(new Paragraph({
      pageBreakBefore: true,
      spacing: { before: 0, after: 0 },
    }));
    out.push(new Paragraph({
      spacing: { before: 0, after: 120 },
      alignment: groupCjlr != null
        ? groupCjlr
        : (isSidebar ? AlignmentType.CENTER : AlignmentType.LEFT),
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 8, color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor },
      },
      shading: isSidebar
        ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
        : undefined,
      children: [new TextRun({
        text: eduSectionTitleUpper + ' ' + (ctx.contSuffix || '(CONT.)'),
        bold: true,
        color: isSidebar ? style.sidebarHeadColor : style.mainHeadColor,
        size: pt2hp(isSidebar ? fs.sbHead : fs.mainHead),
        font: isSidebar ? style.sidebarFont : style.mainHeadFont,
      })],
    }));
  };

  let _eduSkippedFirstSectionBreak = false;
  deduped.forEach(it => {
    if (it && typeof it === 'object' && Number(it._page) >= 2) {
      // PB-002: when the first item in this section already moved the
      // whole section to the next page (s._antcvFirstItemPageMoved
      // set above), skip the in-loop break+contHeader for that first
      // flagged item — otherwise the heading duplicates.
      if (s._antcvFirstItemPageMoved && !_eduSkippedFirstSectionBreak) {
        _eduSkippedFirstSectionBreak = true;
      } else {
        try { emitEduBreakAndCont(); } catch (_) {}
      }
    }
    let deg = (it.deg || it.degree || '').toString();
    let sch = (it.sch || it.school || '').toString();
    // Defensive split: if sch is empty AND deg contains a newline,
    // treat the first line as the degree and the rest as the school.
    if (!sch.trim() && /\n/.test(deg)) {
      const nl = deg.indexOf('\n');
      sch = deg.substring(nl + 1).trim();
      deg = deg.substring(0, nl).trim();
    }
    // Collapse any remaining internal newlines to spaces so the
    // single-paragraph layout doesn't get a forced break.
    deg = deg.replace(/\s*\n\s*/g, ' ').trim();
    sch = sch.replace(/\s*\n\s*/g, ' ').trim();
    if (!deg && !sch) return;
    const runs = [];
    if (deg) {
      runs.push(new TextRun({
        text: deg,
        bold: true,
        color: isSidebar ? style.sidebarTextColor : style.mainHeadColor,
        size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
        font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
      }));
    }
    if (deg && sch) {
      runs.push(new TextRun({
        text: ': ',
        bold: true,
        color: isSidebar ? style.sidebarTextColor : style.mainHeadColor,
        size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
        font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
      }));
    }
    if (sch) {
      runs.push(new TextRun({
        text: sch,
        italics: !isSidebar,
        color: isSidebar ? style.sidebarTextColor : '595959',
        size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
        font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
      }));
    }
    out.push(new Paragraph({
      spacing: { before: 40, after: 40 },
      alignment: groupCjlr != null
        ? groupCjlr
        : (isSidebar ? AlignmentType.JUSTIFIED : undefined),
      shading: isSidebar
        ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
        : undefined,
      children: runs,
    }));
  });
  return out;
}

function buildStyles(ctx) {
  return {
    default: {
      document: {
        run: { font: ctx.style.mainBodyFont, size: pt2hp(ctx.fs.mainBody) },
      },
    },
    paragraphStyles: [],
  };
}

function emptyParagraph() {
  return new Paragraph({
    spacing: { before: 0, after: 0, line: 20, lineRule: 'exact' },
    children: [],
  });
}

function noBorders() {
  const n = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  return { top: n, bottom: n, left: n, right: n, insideHorizontal: n, insideVertical: n };
}
