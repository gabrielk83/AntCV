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
  mainHeadColor: '00746E',
  mainTextColor: '333333',
  mainBulletColor: '00746E',
  sidebarBg: '283556',
  sidebarHeadColor: '01B7BB',
  sidebarTextColor: 'FFFFFF',
  sidebarLabelColor: 'FFFFFF',     // labels in sidebar (TOOLS & METHODS first words) — white not teal
  headerBg: '283556',
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
  const style = mergeStyle(payload.style || {});
  const fontSizes = { ...FONT_DEFAULTS, ...(payload.font_sizes || {}) };
  const lang = payload.language || 'en';
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
    pi: payload.personal_info || {},
    meta: payload.meta || {},
    doc: payload.doc,
    headerAlign,
    sections: Array.isArray(payload.sections) ? payload.sections.filter(s => s.on !== false) : [],
    // Worker version stamp — propagated into the Document's
    // `description` property so the .docx itself records which
    // version of the worker generated it. Lets us tell at a glance
    // whether a bug report refers to old or new code.
    workerVersion: payload._workerVersion || '',
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
    const result = postProcessDocx(raw, { watermark: payload.watermark || '' });
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

function mergeStyle(input) {
  const s = { ...DEFAULTS };
  for (const [k, v] of Object.entries(input || {})) {
    if (typeof v === 'string') s[k] = hex(v);
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
// Two-column document (CV)
// ──────────────────────────────────────────────────────────────────
function buildTwoColumnDocument(ctx) {
  const { style, sections } = ctx;
  const headerCell = buildHeaderCell(ctx);

  const sidebarSecs = sections.filter(s => s.loc === 'sidebar');
  const mainSecs   = sections.filter(s => s.loc !== 'sidebar');

  const sidebarChildren = [
    ...(ctx.pi.photo_b64 ? [buildPhotoParagraph(ctx)] : []),
    ...sidebarSecs.flatMap(s => renderSection(s, ctx, /*isSidebar*/ true)),
  ];

  const mainChildren = mainSecs.flatMap(s => renderSection(s, ctx, /*isSidebar*/ false));

  const bodyTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [SIDEBAR_W, MAIN_W],
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
        children: [
          new TableCell({
            width: { size: SIDEBAR_W, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' },
            borders: noBorders(),
            // Sidebar text pad: 0.10" L/R (144 DXA) — gives content a touch
            // more breathing room from the sidebar edges. Was 0.05" (72 DXA);
            // user requested +0.05" more distance.
            margins: { top: 240, bottom: 240, left: 144, right: 144 },
            children: sidebarChildren.length ? sidebarChildren : [emptyParagraph()],
          }),
          new TableCell({
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
          }),
        ],
      }),
    ],
  });

  return new Document({
    creator: ctx.pi.name || 'AntCV user',
    lastModifiedBy: ctx.pi.name || 'AntCV user',
    title: ctx.meta.role ? `${ctx.pi.name || 'CV'} — ${ctx.meta.role}` : (ctx.pi.name || 'CV'),
    subject: 'Curriculum Vitae',
    keywords: 'AntCV, generated',
    description: `Generated by AntCV docx-worker ${ctx.workerVersion || ''} — author retains all rights to the content.`.trim(),
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
  for (const s of otherSecs) bodyChildren.push(...renderSection(s, ctx, /*isSidebar*/ false));

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
    spacing: { before: 240, after: 60, line: 276, lineRule: 'auto' },
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
    alignment: AlignmentType.LEFT,
    children: [new TextRun({
      text: pi.name || ((lang === 'da') ? 'Dit navn' : 'Your Name'),
      bold: true,
      color: style.mainTextColor,
      size: pt2hp(fs.mainBody),
      font: style.mainBodyFont,
    })],
  }));

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
  const bodyTable = new Table({
    width: { size: PAGE_W, type: WidthType.DXA },
    columnWidths: [PAGE_W],
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
    keywords: 'AntCV, generated',
    description: `Generated by AntCV docx-worker ${ctx.workerVersion || ''} — author retains all rights to the content.`.trim(),
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
                      ],
                    })],
                  }),
                ],
              }),
            ]
          : [bodyTable],
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
    // Top rule (above the contact line).
    out.push(new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
      border: { bottom: { color: style.accent, space: 1, style: BorderStyle.SINGLE, size: 6 } },
      spacing: { before: 0, after: 60, line: 40, lineRule: 'exact' },
      children: [],
    }));
    // The contact line itself, with its OWN bottom border so we get the
    // matching rule under the contact text — preview has rules above
    // AND below the contacts in the candidate header band.
    out.push(new Paragraph({
      alignment: alignType(headerAlign.contact),
      shading: { type: ShadingType.CLEAR, fill: style.headerBg, color: 'auto' },
      border: { bottom: { color: style.accent, space: 4, style: BorderStyle.SINGLE, size: 6 } },
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

function buildPhotoParagraph(ctx) {
  const { pi, style } = ctx;
  const data = base64ToUint8Array(pi.photo_b64);
  // Default photo size: 1.25" diameter. The user spec is 1.25"–1.8".
  // The image is rendered with:
  //   1. A teal 1pt outline (passed via ImageRun outline parameter
  //      → emitted as <a:ln> on <pic:spPr>).
  //   2. An elliptical shape: docx-js hard-codes <a:prstGeom prst="rect"/>
  //      but the post-processor (post-process.js) rewrites the rect
  //      to "ellipse" so the photo renders as a circle in Word.
  const sizePx = Math.round((1.25 * EMU_PER_INCH) / 9525);
  // Outline colour: use the sidebar accent if present (most users
  // have teal there), fall back to the brand teal.
  const outlineColor = ((style && style.photoBorderColor) ||
                       (style && style.sidebarHeadColor) ||
                       (style && style.accent) ||
                       '01B7BB').replace(/^#/, '');
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 120 },
    children: [
      new ImageRun({
        data,
        type: detectImageType(pi.photo_b64),
        transformation: { width: sizePx, height: sizePx },
        // 1pt outline in EMU (12700 = 1pt). solid stroke, brand teal.
        outline: {
          width: 12700,
          solidFillType: 'rgb',
          value: outlineColor,
        },
      }),
    ],
  });
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
  const pageBreakPara = s.pageBreakBefore === true
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
      borders: noBorders(),
      rows: [
        new TableRow({
          tableHeader: true,
          cantSplit: true,
          children: [headingCell],
        }),
        new TableRow({
          children: [bodyCell],
        }),
      ],
    }),
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
  return paras.map(p => bodyParagraphRich(p, ctx, isSidebar));
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
  return paras.map((p, i) => new Paragraph({
    spacing,
    alignment: AlignmentType.JUSTIFIED,
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
  if (s.intro) out.push(bodyParagraphRich(s.intro, ctx, isSidebar));
  if (Array.isArray(s.items)) {
    s.items.filter(Boolean).forEach(it => {
      out.push(bulletParagraphRich('', String(it), ctx, isSidebar));
    });
  }
  if (s.closing) out.push(bodyParagraphRich(s.closing, ctx, isSidebar));
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
  const make = (label, body) => new Paragraph({
    spacing: { before: 60, after: 60, line: 276, lineRule: 'auto' },
    alignment: AlignmentType.JUSTIFIED,
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
  if (s.hands_on)       out.push(make(handsOnLabel,       s.hands_on));
  if (s.professionally) out.push(make(professionallyLabel, s.professionally));
  return out;
}

// ──────────────────────────────────────────────────────────────────
// Bullets
// ──────────────────────────────────────────────────────────────────
function renderBullets(s, ctx, isSidebar) {
  if (!Array.isArray(s.items)) return [];
  return s.items.filter(it => it && (it.t || typeof it === 'string')).map(it => {
    if (typeof it === 'string') return bulletParagraphRich('', it, ctx, isSidebar);
    const lead = it.b ? `${it.b}: ` : '';
    return bulletParagraphRich(lead, it.t, ctx, isSidebar);
  });
}

function bulletParagraphRich(lead, body, ctx, isSidebar) {
  const { style, fs } = ctx;
  const baseRun = {
    color: isSidebar ? style.sidebarTextColor : style.mainTextColor,
    size: pt2hp(isSidebar ? fs.sbBody : fs.bulletContent),
    font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
  };
  return new Paragraph({
    numbering: { reference: isSidebar ? 'antcv-sb-bullet' : 'antcv-bullet', level: 0 },
    spacing: { before: 20, after: 20, line: 276, lineRule: 'auto' },
    alignment: AlignmentType.JUSTIFIED,
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
  const tableW = MAIN_W - 640;
  // Default cell ratio: 1.5" first column / 3.1" second column = 0.326.
  // Honour an explicit `s.tableRatio` (0–1, fraction of the first column)
  // when the PWA sends one — otherwise use the 1.5/3.1 default.
  const explicitRatio = (typeof s.tableRatio === 'number' && s.tableRatio > 0.05 && s.tableRatio < 0.95)
    ? s.tableRatio
    : null;
  const col1 = Math.round(tableW * (explicitRatio !== null ? explicitRatio : 0.326));
  const col2 = tableW - col1;
  const border = { style: BorderStyle.SINGLE, size: 4, color: style.mainHeadColor };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const headerAlignT = alignType(s.headerAlign || 'center');

  const docRows = [
    new TableRow({
      tableHeader: true,
      children: (header || ['', '']).map((cell, i) => new TableCell({
        width: { size: i === 0 ? col1 : col2, type: WidthType.DXA },
        shading: { type: ShadingType.CLEAR, fill: style.mainHeadColor, color: 'auto' },
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
    }),
    ...data.map((r, idx) => new TableRow({
      children: (r || []).slice(0, 2).map((cell, i) => new TableCell({
        width: { size: i === 0 ? col1 : col2, type: WidthType.DXA },
        shading: idx % 2 === 0
          ? undefined
          : { type: ShadingType.CLEAR, fill: 'FAFAFA', color: 'auto' },
        borders: cellBorders,
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [new Paragraph({
          // Body cells justified — user spec: "its content is justified,
          // its headers are centered" for the nested competency table.
          // First column stays bold (Focus Area).
          alignment: i === 0 ? AlignmentType.LEFT : AlignmentType.JUSTIFIED,
          children: inlineRuns(cell, {
            bold: i === 0,
            color: style.mainTextColor,
            size: pt2hp(fs.mainTblCell),
            font: style.mainBodyFont,
          }),
        })],
      })),
    })),
  ];

  return [
    new Table({
      width: { size: tableW, type: WidthType.DXA },
      columnWidths: [col1, col2],
      borders: cellBorders,
      // Center the table within its parent. In the CV (two-column
      // layout) the table fills the main cell, so centering is a
      // no-op visually. In the CL (linear layout) the table is
      // narrower than the full body cell, and centering moves it
      // from left-aligned to centered — matching the visual
      // expectation set by the CV's CC table and the user's spec.
      alignment: AlignmentType.CENTER,
      rows: docRows,
    }),
    // v1.10.4: 2pt of cushion AFTER the table. The main 4pt gap to the
    // next section heading is now provided by headingParagraph's
    // `before: 80` (see comment there). Previously we tried 8pt here,
    // which Word collapses against the table border — pushing the gap
    // onto the heading paragraph is the version Word actually honours.
    new Paragraph({
      spacing: { before: 0, after: 40, line: 20, lineRule: 'exact' },
      children: [],
    }),
  ];
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

  roles.forEach(role => {
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
      out.push(new Paragraph({
        spacing: { before: 120, after: 40 },
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
      role.bullets.filter(Boolean).forEach(b => {
        out.push(bulletParagraphRich('', String(b), ctx, /*isSidebar*/ false));
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
  // Sidebar lists are bullet-free by default — the user spec is:
  // "all sidebar content has no bullets in sidebar items by default".
  // Explicit s.bullet_style: 'bullet' opts back in. Main column keeps
  // the legacy "bullets unless explicitly off" behaviour.
  const useBullets = autoNoBullet
    ? false
    : (isSidebar
        ? (s.bullet_style === 'bullet')
        : (s.bullet_style || 'bullet') !== 'none');
  // Default alignment depends on which auto-format applies:
  //   - publications/patent → justified (multi-line citation wrapping)
  //   - certifications      → centred (short single-line entries)
  //   - sidebar bullets     → justified (multi-line skill descriptions in
  //                            narrow sidebar look cleaner with justified
  //                            edges; the user explicitly requested this)
  //   - main bullets        → left
  //   - centered no-bullet  → center
  // An explicit `s.align` overrides the auto choice.
  const autoAlign = isPublicationsSection(s)
    ? 'justify'
    : autoNoBullet
      ? 'center'
      : (useBullets ? (isSidebar ? 'justify' : 'left') : 'center');
  const a = alignType(s.align || autoAlign);

  // Normalize every item: drop hidden (s.hidden[idx] from PWA's
  // per-item eye toggle, item.hidden, {on:false}), null, and empty;
  // extract a string from object-shaped items so we never render
  // "[object Object]" in the docx. Items that survive are guaranteed
  // to be non-empty strings.
  //
  // s.hidden is the PWA's section-level hidden map: an array where
  // index i is `true` when item i is hidden in the editor. Without
  // this check the worker rendered every item in REGULATORY CONTEXT
  // even though only the first few were visible in the preview.
  const visibleIndexes = (s.items || []).map((_, i) => i)
    .filter(i => !(s.hidden && s.hidden[i]))
    .filter(i => {
      const it = s.items[i];
      return !(it && typeof it === 'object' && it.hidden);
    });
  const normalized = visibleIndexes
    .map(i => normalizeItem(s.items[i]))
    .filter(it => typeof it === 'string' && it.length > 0);
  // Dedupe near-identical entries — see dedupeStrings() above.
  // Defensive because the PWA's section content sometimes accumulates
  // duplicate certifications/publications across imports and JD reloads.
  const deduped = dedupeStrings(normalized);
  if (deduped.length === 0) return [];

  const isPubs = isPublicationsSection(s);
  return deduped.map(item => {
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
      //
      // v1.10.3: strip inline HTML tags (<b>, <i>, <strong>, <em>) from
      // name + rest before creating the TextRun. The publication path
      // bypasses `inlineRuns`, so any user-supplied tags would otherwise
      // render as literal characters (the bug the user reported as
      // 〈b〉"Suspended Carbon Nanotube..."〈/b〉 — Karp et al., 2009).
      // The publication path applies its own bold+italic styling on
      // `name`, so the tags are redundant anyway.
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
    const para = {
      spacing: { before: 30, after: 30, line: 252, lineRule: 'auto' },
      alignment: a,
      shading: isSidebar
        ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
        : undefined,
      children,
    };
    if (useBullets) {
      para.numbering = { reference: isSidebar ? 'antcv-sb-bullet' : 'antcv-bullet', level: 0 };
    }
    return new Paragraph(para);
  });
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
  noOrphans.forEach(it => {
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
        // Group/category subheads sit centered in the sidebar so
        // they're a clear visual divider above the items below.
        alignment: isSidebar ? AlignmentType.CENTER : undefined,
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
      // Sidebar labeled lists (CERTIFICATIONS, EDUCATION, REGULATORY
      // CONTEXT, ADDITIONAL INFORMATION) default to justified so
      // multi-line entries align both edges; user-requested.
      alignment: isSidebar ? AlignmentType.JUSTIFIED : undefined,
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
  deduped.forEach(it => {
    const deg = (it.deg || it.degree || '').toString();
    const sch = (it.sch || it.school || '').toString();
    if (deg) {
      out.push(new Paragraph({
        spacing: { before: 60, after: 0 },
        // Sidebar education entries justified so degree + school text
        // wrap with both edges aligned.
        alignment: isSidebar ? AlignmentType.JUSTIFIED : undefined,
        shading: isSidebar
          ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
          : undefined,
        children: [new TextRun({
          text: deg,
          bold: true,
          color: isSidebar ? style.sidebarTextColor : style.mainHeadColor,
          size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
          font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
        })],
      }));
    }
    if (sch) {
      out.push(new Paragraph({
        spacing: { before: 0, after: 60 },
        alignment: isSidebar ? AlignmentType.JUSTIFIED : undefined,
        shading: isSidebar
          ? { type: ShadingType.CLEAR, fill: style.sidebarBg, color: 'auto' }
          : undefined,
        children: [new TextRun({
          // Sidebar: school renders white NORMAL (per user spec).
          // Main column: keep the legacy gray italic for visual
          // hierarchy under the bold teal degree.
          text: sch,
          italics: !isSidebar,
          color: isSidebar ? style.sidebarTextColor : '595959',
          size: pt2hp(isSidebar ? fs.sbBody : fs.mainBody),
          font: isSidebar ? (style.sidebarBodyFont || style.sidebarFont) : style.mainBodyFont,
        })],
      }));
    }
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
