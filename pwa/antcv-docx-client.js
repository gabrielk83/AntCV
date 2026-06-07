// AntCV frontend → DOCX worker integration
// =================================================================
// Drop-in replacement for the client-side exportDocx2Col / exportDocx
// pipeline in app.jsx. Builds a clean JSON payload from the current
// PWA state and POSTs it to the docx worker, which returns a binary
// .docx blob.
//
// Why this is better than the inline approach:
//   - Word compliance: docx-js handles numbering.xml, styles.xml,
//     namespaces, and element ordering correctly. The inline
//     hand-built XML produced files Word would open with a "minor
//     errors that could be repaired" warning.
//   - Maintainability: ~600 lines of OOXML string-building moves
//     out of app.jsx and into a versioned, testable worker.
//   - Consistency: the same payload can drive PDF too (via a
//     future PDF worker if you want to externalise that, or a
//     server-side LibreOffice render if Word fidelity matters).
//
// Drop-in usage:
//   1. Set window.ANTCV_DOCX_WORKER to your deployed worker URL.
//      e.g. window.ANTCV_DOCX_WORKER = 'https://antcv-docx.example.workers.dev';
//   2. Replace the onClick handler on the DOCX export button with:
//      onClick={() => exportDocxViaWorker({ sections, meta, doc, photo, personalInfo, styleConfig, fontSizes, language, navyColor })}
//   3. (Optional) Set window.ANTCV_DOCX_SECRET for the X-AntCV-Secret
//      header if your worker has WORKER_SECRET configured.

// ──────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────

// v1.40.140 — read the section-align sidecar's per-section table-width
// percentages and derive a single dxa value to pass to the worker as
// `style.tableWidth`. The section-align sidecar stores:
//
//   personalInfo.stylePrefs.tableWidthPct = { [sectionId]: 30..115 }
//
// 100 = default (no change). Below/above = user-dragged width. We
// pick the widest non-default value across the sections in the doc
// being exported and convert to dxa relative to the worker's per-doc
// defaults:
//
//   CV (two_column): 6630 dxa default (MAIN_W - 640, ~4.6")
//   CL (linear):     9602 dxa default (PAGE_W - 2304, ~6.67")
//
// Returns null when no section has a non-default width — letting the
// worker fall back to its own default keeps the wire payload small.
//
// Multi-table caveat: the worker applies one global width to every
// table in the document. Most CVs/CLs only have one user-adjustable
// table (CORE COMPETENCIES on a CV, WHAT I BRING on a CL), so a
// single override matches the live preview. If the user drags two
// tables to different widths, the wider one wins — narrower tables
// in the export will appear wider than in the live preview.

// v1.50.8 — read the active visual package id (e.g. "copenhagen-modern")
// from localStorage personalInfo.stylePackage. Set by the React-islands
// PackagePicker (src/islands/PackagePicker/). Returns the canonical
// default when absent or invalid.
export function readPackageId() {
  const ALLOWED = new Set([
    'copenhagen-modern', 'navy-executive', 'warm-terracotta',
    'nordic-frost', 'pampas-contemporary', 'tokyo-precision', 'delhi-technical',
  ]);
  // Legacy aliases that the worker also accepts — surface the canonical
  // id from the PWA side so the wire format is uniform.
  const ALIASES = {
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
  try {
    if (typeof localStorage === 'undefined') return 'copenhagen-modern';
    const raw = localStorage.getItem('personalInfo');
    if (!raw) return 'copenhagen-modern';
    const pi = JSON.parse(raw);
    const v = pi && typeof pi.stylePackage === 'string' ? pi.stylePackage.trim().toLowerCase() : '';
    if (!v) return 'copenhagen-modern';
    if (ALLOWED.has(v)) return v;
    if (ALIASES[v]) return ALIASES[v];
    return 'copenhagen-modern';
  } catch (_) {
    return 'copenhagen-modern';
  }
}

// v1.50.8 — read the user's "legacy ATS tier" preference from
// personalInfo.exportPrefs.legacyAtsTier. Toggled in the React-islands
// ExportOptionsCard (src/islands/ExportOptions/). When true, the
// worker forces Calibri as the body font regardless of the active
// package's bodyFont, so legacy parsers (Taleo pre-2018, iCIMS
// pre-2018, older SuccessFactors) can extract the text reliably.
export function readLegacyAtsTier() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem('personalInfo');
    if (!raw) return false;
    const pi = JSON.parse(raw);
    return !!(pi && pi.exportPrefs && pi.exportPrefs.legacyAtsTier === true);
  } catch (_) {
    return false;
  }
}

// v1.50.19 — active writing style id (e.g. "research-formal"). Pulled
// from personalInfo.writingPrefs.style so the DOCX worker can apply
// style-specific layout for academic citation sections under
// research-formal (hanging indent + justified, no bullets). Returns
// '' (empty) when absent so the payload field can be omitted, keeping
// the wire format compatible with older PWA bundles. The worker's
// schema also tolerates an absent field — see docx-worker schema.js.
export function readWritingStyle() {
  try {
    if (typeof localStorage === 'undefined') return '';
    const raw = localStorage.getItem('personalInfo');
    if (!raw) return '';
    const pi = JSON.parse(raw);
    const v = pi && pi.writingPrefs && typeof pi.writingPrefs.style === 'string'
      ? pi.writingPrefs.style.trim().toLowerCase()
      : '';
    return v;
  } catch (_) {
    return '';
  }
}

export function readTableWidthPctMap() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem('personalInfo');
    if (!raw) return {};
    const pi = JSON.parse(raw);
    const map = pi && pi.stylePrefs && pi.stylePrefs.tableWidthPct;
    return (map && typeof map === 'object') ? map : {};
  } catch (_) { return {}; }
}

// v1.40.142 — read the user's chosen photo position from
// localStorage and return one of the seven valid values. The PWA's
// settings panel writes to `localStorage.photoPosition`; some app.js
// versions JSON-wrap the value, some don't. We tolerate both.
// v1.50.56 — read the user/package photo SHAPE so the DOCX/PDF worker can
// match the live preview. Priority: explicit per-user override in
// personalInfo.photoShape (written by the preview shape-row sidecar), else
// the active package default, else "circle". Valid OOXML-mappable values:
// circle | rounded | rounded-square | square | hexagon | pentagon.
export function readPhotoShape() {
  const VALID = new Set(["circle","rounded","rounded-square","square","hexagon","pentagon"]);
  const PKG_SHAPE = {
    "copenhagen-modern":"circle","navy-executive":"rounded","warm-terracotta":"rounded",
    "nordic-frost":"circle","pampas-contemporary":"rounded-square","tokyo-precision":"square",
    "delhi-technical":"hexagon",
  };
  try {
    if (typeof localStorage === "undefined") return "circle";
    const raw = localStorage.getItem("personalInfo");
    const pi = raw ? JSON.parse(raw) : {};
    let v = pi && typeof pi.photoShape === "string" ? pi.photoShape.trim().toLowerCase() : "";
    if (VALID.has(v)) return v;
    const pkg = (typeof readPackageId === "function") ? readPackageId() : "copenhagen-modern";
    return PKG_SHAPE[pkg] || "circle";
  } catch (_) { return "circle"; }
}

export function readPhotoPosition() {
  const VALID = new Set([
    'sidebar-top', 'sidebar-bottom',
    'header-left', 'header-right',
    'main-left', 'main-right',
    'hidden',
  ]);
  try {
    if (typeof localStorage === 'undefined') return 'sidebar-top';
    const raw = localStorage.getItem('photoPosition');
    if (!raw) return 'sidebar-top';
    let v = raw;
    try { const p = JSON.parse(raw); if (typeof p === 'string') v = p; }
    catch (_) {}
    v = String(v).trim();
    return VALID.has(v) ? v : 'sidebar-top';
  } catch (_) { return 'sidebar-top'; }
}

export function computeTableWidthDxa(docSections, docType) {
  if (!Array.isArray(docSections) || !docSections.length) return null;
  const pctMap = readTableWidthPctMap();
  let maxPct = null;
  for (const section of docSections) {
    if (!section || typeof section !== 'object') continue;
    // Only table-bearing section types are affected by section-align.
    // The sidecar tracks widths for 'table' types specifically; we
    // also accept 'cell' in case a future ship reuses the persistence.
    if (section.type !== 'table' && section.type !== 'cell') continue;
    const id = section.id;
    if (!id) continue;
    const v = pctMap[id];
    if (typeof v !== 'number' || !isFinite(v)) continue;
    // Skip default (no user adjustment). Treat anything within ±1 of
    // 100 as default to avoid sending micro-adjustments triggered by
    // floating-point round-trips through localStorage.
    if (Math.abs(v - 100) < 1) continue;
    if (maxPct === null || v > maxPct) maxPct = v;
  }
  if (maxPct === null) return null;
  // Default widths must match the worker's constants in src/generate.js.
  const defaultDxa = (docType === 'cl') ? 9602 : 6630;
  return Math.round(defaultDxa * (maxPct / 100));
}

/**
 * Build payload + POST + trigger browser download.
 * Throws on any failure — caller should catch and show a useful error.
 */
export async function exportDocxViaWorker({
  sections,         // { cv: [...], cl: [...] }
  meta,             // { subtitle, role, company, ... }
  doc,              // 'cv' | 'cl'
  photo,            // dataURL string ("data:image/png;base64,...") or null
  personalInfo,     // { name, email, phone, location, website, linkedin }
  styleConfig,      // { mainHeadColor, ... } (your existing styleConfig state)
  fontSizes,        // { mainBody, nameSize, ... }
  language,         // 'en' | 'da'
  navyColor,        // '#283556' or similar
  layout,           // 'two_column' | 'linear' (optional — default by doc type)
  filename,         // optional override
  headerItemAlign,  // optional header alignment overrides
  headerItemLoc,    // optional header location overrides
  password,         // optional — when non-empty, worker encrypts the output (worker v1.11+)
  watermark,        // v1.40.89 — optional. When set (e.g. "DEMO"), worker renders a diagonal grey watermark behind body text. Requires worker v1.12+; older workers will ignore the field.
} = {}) {
  // v1.18 — accept either window.ANTCV_DOCX_WORKER (set by index.html or
  // an admin), or a JSON-encoded localStorage entry written by the
  // Settings → Routing UI. The localStorage path lets users configure
  // routing inside the PWA without re-deploying the host page.
  let workerUrl = (typeof window !== 'undefined' && window.ANTCV_DOCX_WORKER) || '';
  if (!workerUrl) {
    try {
      let v = localStorage.getItem('docxWorkerUrl') || localStorage.getItem('antcv:docxWorker') || '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      workerUrl = v.replace(/\/+$/, '');
    } catch (_) { /* ignore */ }
  }
  // Accept any https URL on a domain different from the current page
  // (and not on Pages). This allows workers.dev plus custom domains.
  function isUsableUrl(u) {
    if (!u) return false;
    try {
      const p = new URL(u);
      if (p.protocol !== 'https:') return false;
      if (typeof location !== 'undefined' && p.hostname === location.hostname) return false;
      if (/\.pages\.dev$/i.test(p.hostname)) return false;
      return true;
    } catch { return false; }
  }
  if (!isUsableUrl(workerUrl)) {
    throw new Error(
      'DOCX worker URL not configured or not usable. ' +
      `Stored value: "${workerUrl || '(empty)'}". ` +
      'Open Settings → Advanced → Routing and paste your antcv-docx-worker URL, ' +
      'or set window.ANTCV_DOCX_WORKER in index.html. ' +
      'Must be https and on a domain other than this page.'
    );
  }

  const photoDataUrl = await ensurePhotoDataUrl(photo);

  // v1.40.140 — derive tableWidth from the section-align sidecar's
  // per-section drag widths. The section-align sidecar writes
  // percentages into personalInfo.stylePrefs.tableWidthPct; this maps
  // them to a single dxa override the worker honours. If the user
  // hasn't dragged any table, this is null and the worker falls back
  // to its per-doc defaults (6630 dxa CV, 9602 dxa CL). The injected
  // value rides through buildStyle's passthrough list.
  const docSectionsForWidth = (sections && sections[doc])
    || (Array.isArray(sections) ? sections : []);
  const derivedTableWidth = computeTableWidthDxa(docSectionsForWidth, doc);
  const styleConfigWithWidth = (derivedTableWidth !== null
    && (styleConfig == null || styleConfig.tableWidth == null))
    ? { ...(styleConfig || {}), tableWidth: derivedTableWidth }
    : (styleConfig || {});

  const payload = buildPayload({
    sections, meta, doc, photo: photoDataUrl, personalInfo,
    styleConfig: styleConfigWithWidth,
    fontSizes, language, navyColor, layout, filename,
    headerItemAlign, headerItemLoc, password, watermark,
  });

  const headers = { 'Content-Type': 'application/json' };
  const secret = (typeof window !== 'undefined' && window.ANTCV_DOCX_SECRET) || '';
  if (secret) headers['X-AntCV-Secret'] = secret;

  const res = await fetch(workerUrl.replace(/\/$/, '') + '/generate', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  // v1.18 — read body once into a Blob. Previously we did `.json()` in
  // one branch and `.text()` in another, which threw "body stream already
  // read" whenever the first parser failed before the body was fully
  // consumed. Read once, then decide what to do with it.
  const blob = await res.blob();
  const ct   = (res.headers.get('content-type') || '').toLowerCase();

  if (!res.ok) {
    let detail = '';
    try {
      const text = await blob.text();
      if (ct.includes('application/json')) {
        try {
          const j = JSON.parse(text);
          detail = j.error
            ? `${j.error}${j.errors ? ': ' + j.errors.join('; ') : ''}${j.message ? ' — ' + j.message : ''}`
            : JSON.stringify(j).slice(0, 400);
        } catch { detail = text.slice(0, 400); }
      } else {
        detail = text.slice(0, 400);
      }
    } catch { /* ignore */ }
    throw new Error(`DOCX worker returned ${res.status} ${res.statusText}${detail ? '\n' + detail : ''}`);
  }

  // v1.18 — guard against the worker returning HTML (Pages 404, "Hello
  // World" placeholder, or a Cloudflare error page) instead of a real
  // DOCX. Word reads the first four bytes as ZIP magic (PK\x03\x04); if
  // it sees anything else it refuses to open the file with no useful
  // error. Validate up front so the user sees a clear message instead of
  // a broken download.
  const isOfficeDocx =
    ct.includes('officedocument') ||
    ct.includes('application/zip') ||
    ct.includes('application/octet-stream');
  if (!isOfficeDocx) {
    let head = '';
    try { head = (await blob.text()).slice(0, 200); } catch { /* ignore */ }
    throw new Error(
      `DOCX worker returned content-type "${ct || '(none)'}" instead of an Office document. ` +
      `This usually means the worker URL points at the wrong service (e.g. Cloudflare Pages instead of the workers.dev origin). ` +
      `First 200 bytes: ${head}`
    );
  }

  const headBytes = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
  const isZipMagic =
    headBytes[0] === 0x50 && headBytes[1] === 0x4B &&
    (headBytes[2] === 0x03 || headBytes[2] === 0x05 || headBytes[2] === 0x07) &&
    (headBytes[3] === 0x04 || headBytes[3] === 0x06 || headBytes[3] === 0x08);
  if (!isZipMagic) {
    const hex = Array.from(headBytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
    let head = '';
    try { head = (await blob.text()).slice(0, 200); } catch { /* ignore */ }
    throw new Error(
      `DOCX worker response is not a ZIP/DOCX (first 4 bytes: ${hex}; expected "50 4b 03 04"). ` +
      `Body begins: ${head}`
    );
  }

  // Size sanity: a real DOCX with content is at least a few KB. An
  // "empty template" stub is well under that and Word will open it but
  // show only the cover-letter shell — usually a sign the payload didn't
  // reach the renderer.
  if (blob.size < 2048) {
    console.warn(`[docx-client] response is small (${blob.size} bytes) — may be a stub template`);
  }

  const cd = res.headers.get('content-disposition') || '';
  const m = /filename="([^"]+)"/.exec(cd);
  const downloadName = (m && m[1]) || (payload.filename || 'document') + '.docx';
  triggerDownload(blob, downloadName);

  return {
    bytes: blob.size,
    generationMs: Number(res.headers.get('x-antcv-generation-ms') || 0),
    workerVersion: res.headers.get('x-antcv-worker-version') || 'unknown',
  };
}

/**
 * Pure function — builds the worker payload from the PWA state.
 * Exported separately so it can be tested in isolation and so a future
 * PDF worker can reuse the same shape.
 */
export function buildPayload({
  sections, meta = {}, doc = 'cv', photo, personalInfo = {},
  styleConfig = {}, fontSizes = {}, language = 'en', navyColor,
  layout, filename,
  headerItemAlign, headerItemLoc, password, watermark,
} = {}) {
  // The worker schema only accepts language en|da; clamp so an es/zh UI never
  // 422s the export. da when Danish, otherwise en.
  language = /^da/i.test(String(language || '')) ? 'da' : 'en';
  // Normalize sections — the PWA stores these as { cv: [...], cl: [...] }
  // depending on doc type; the worker just wants the active list.
  const docSections = mergeHowContributeFromLocalStorage((sections && sections[doc]) || (Array.isArray(sections) ? sections : []), doc);

  // Strip the data: prefix from photo dataURL if present.
  const photo_b64 = stripDataUrlPrefix(photo);

  // Optional contact-extra rows the user added in Personal Info Editor.
  const contactExtra = Array.isArray(personalInfo.contactExtra)
    ? personalInfo.contactExtra
        .filter(it => it && typeof it === 'object' && it.value)
        .map(it => ({
          label: String(it.label || ''),
          icon:  String(it.icon  || '•'),
          value: String(it.value || ''),
        }))
    : [];

  // Default alignment matches the PWA preview (centered for the candidate
  // header band). Anything the user changed in HeaderInlineEditor flows
  // through here and is honoured by the worker.
  const align = {
    name:           (headerItemAlign && headerItemAlign.name)           || 'center',
    specialisation: (headerItemAlign && headerItemAlign.specialisation) || 'center',
    contact:        (headerItemAlign && headerItemAlign.contact)        || 'center',
  };

  // Cover letters use a synthesised "Application: <role> — <company>"
  // line in the candidate header band — it's the slot the CV uses for
  // its specialisation. The PWA preview generates this dynamically; the
  // worker just renders meta.subtitle as-is, so we have to synthesise
  // it here. Falls back to "Application: [role and company]" when both
  // role and company are empty so the band isn't blank.
  const subtitle = (() => {
    if (doc !== 'cl') return meta.subtitle || '';
    const role = (meta.role || '').trim();
    const company = (meta.company || '').trim();
    const isDA = (language === 'da');
    const prefix = isDA ? 'Ansøgning: ' : 'Application: ';
    if (!role && !company) {
      return prefix + (isDA ? '[rolle og virksomhed]' : '[role and company]');
    }
    const sep = (role && company) ? ' \u2014 ' : '';
    return `${prefix}${role}${sep}${company}`;
  })();

  const payload = {
    schema_version: '1.0',
    doc,
    language,
    layout: layout || (doc === 'cl' ? 'linear' : 'two_column'),
    filename: filename || buildFilename({ personalInfo, meta, doc, language }),
    personal_info: {
      name:        personalInfo.name        || '',
      email:       personalInfo.email       || '',
      phone:       personalInfo.phone       || '',
      location:    personalInfo.location    || '',
      website:     personalInfo.website     || '',
      linkedin:    personalInfo.linkedin    || '',
      citizenship: personalInfo.citizenship || '',
      contact_extra: contactExtra,
      ...(photo_b64 ? { photo_b64 } : {}),
      // v1.40.142 — pass through photoPosition so worker v1.14.0+ can
      // place the photo correctly. Read from localStorage with
      // tolerant unwrapping (some app.js versions JSON-wrap the value).
      ...(typeof readPhotoPosition === 'function'
        ? { photoPosition: readPhotoPosition() }
        : {}),
      // v1.50.56 — photo shape for worker-side picture geometry. Worker
      // v1.15+ maps this to a:prstGeom prst (ellipse/roundRect/rect/
      // hexagon/pentagon). Older workers ignore the field and keep the
      // legacy circle behaviour.
      ...(typeof readPhotoShape === 'function'
        ? { photoShape: readPhotoShape() }
        : {}),
    },
    meta: {
      subtitle,
      role:     meta.role     || '',
      company:  meta.company  || '',
    },
    header_align: align,
    // v1.50.8 — pass the active visual package + ATS legacy-tier flag
    // so the worker derives its base palette from
    // packages/registry.json. The worker falls back to its legacy
    // DEFAULTS palette when these fields are absent, so older docx-
    // client builds keep working unchanged.
    ...(typeof readPackageId === 'function' ? { package: readPackageId() } : {}),
    ...(typeof readLegacyAtsTier === 'function' && readLegacyAtsTier() ? { legacy_ats_tier: true } : {}),
    // v1.50.19 — active writing style id. Worker v1.13.1+ uses this
    // to switch academic citation sections (publications,
    // conferences_talks, grants_fellowships, selected_research_outcomes,
    // research_experience) to hanging-indent + justified layout when
    // the value is 'research-formal'. Older workers silently ignore.
    ...(typeof readWritingStyle === 'function'
      ? (() => { const s = readWritingStyle(); return s ? { writing_style: s } : {}; })()
      : {}),
    style: buildStyle(styleConfig, navyColor),
    font_sizes: buildFontSizes(fontSizes),
    sections: normalizeSections(docSections),
    meta_signature: {
      generator: 'AntCV',
      generator_version: (typeof window !== 'undefined' && window.ANTCV_VERSION) || '',
      author: String(personalInfo.name || ''),
      created_at: new Date().toISOString(),
      description: 'Generated by AntCV (cv-generator-det.pages.dev) — author retains all rights to the content.',
    },
    ...(password && String(password).trim() ? { password: String(password) } : {}),
    /* v1.40.89: optional watermark field. Worker renders a diagonal
       grey watermark across each page when set (e.g. "DEMO"). The
       PWA passes "DEMO" automatically when /config reports demo_mode.
       Workers older than v1.12 will silently ignore this field. */
    ...(watermark && String(watermark).trim() ? { watermark: String(watermark) } : {}),
    /* v1.40.194: per-item page assignments + panel-default alignment.
       Workers ≥ v1.14.8 read item_pages to insert page-break-before
       on the matching items in labeled_list / list / education
       sections, mirroring the preview-side renderer in
       antcv-item-pages-render.js. Older workers silently ignore. */
    ...(typeof readItemPages === 'function'
      ? { item_pages: readItemPages() }
      : {}),
    ...(typeof readPanelDefaultAlign === 'function'
      ? { panel_default_alignment: readPanelDefaultAlign() }
      : {}),
    /* Owner 2026-06-05: the AI watermark belongs in whichever COLUMN's
       text ends higher (empty space below it). The worker can't measure
       rendered heights, so antcv-watermark-page-anchor-341 measures the
       live preview and stores the page side ('left'|'right'). Forward it
       so the two-column CV places the disclosure in the matching cell.
       Older workers ignore it; the linear CL ignores it too. */
    ...((() => { const s = readAiWmSide(); return s ? { ai_wm_side: s } : {}; })()),
  };

  return payload;
}

// Which page side the AI watermark should sit on, as measured by the
// preview sidecar (antcv-watermark-page-anchor-341). Returns 'left',
// 'right', or '' when unset.
function readAiWmSide() {
  try {
    if (typeof window !== 'undefined' && (window.__antcvAiWmSide === 'left' || window.__antcvAiWmSide === 'right')) {
      return window.__antcvAiWmSide;
    }
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem('antcv:aiWmSide');
      if (v === 'left' || v === 'right') return v;
    }
  } catch (_) { /* localStorage may be disabled */ }
  return '';
}

// Read antcv:itemPages from localStorage. Returns a plain object
// keyed by sid, each holding { '<itemIdx>': <pageNum> }. Empty when
// the user hasn't assigned any item to page ≥2.
function readItemPages() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem('antcv:itemPages');
    if (!raw) return {};
    const v = JSON.parse(raw);
    return (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
  } catch (_) { return {}; }
}

// Read personalInfo.stylePrefs.panelDefaultAlignment — the per-panel
// default written by antcv-section-align.js v1.40.194's panel-default
// cycler. Returns null when nothing is configured so the worker keeps
// its existing per-loc defaults (sidebar=center, main=left).
function readPanelDefaultAlign() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('personalInfo');
    if (!raw) return null;
    const pi = JSON.parse(raw);
    const v = pi && pi.stylePrefs && pi.stylePrefs.panelDefaultAlignment;
    if (!v || typeof v !== 'object') return null;
    const out = {};
    for (const loc of ['topbar', 'sidebar', 'main']) {
      const a = v[loc];
      if (a === 'left' || a === 'center' || a === 'right' || a === 'justify') {
        out[loc] = a;
      }
    }
    return Object.keys(out).length ? out : null;
  } catch (_) { return null; }
}


// Merge the How I Would Contribute bullet edits written by the sidecar into
// the payload used for DOCX/PDF. This protects exports when React still holds
// an older in-memory sections array while localStorage already contains the
// edited bullet rows.
function mergeHowContributeFromLocalStorage(docSections, doc) {
  try {
    if (typeof localStorage === 'undefined' || !Array.isArray(docSections)) return docSections;
    const rx = /how\s+i\s+would\s+contribute/i;
    const raw = localStorage.getItem('sections');
    const all = raw ? JSON.parse(raw) : null;
    const stored = all && Array.isArray(all[doc]) ? all[doc] : null;
    if (!stored) return docSections;
    const src = stored.find(s => s && rx.test(String(s.title || s.name || s.id || '')));
    if (!src) return docSections;
    const bullets = (Array.isArray(src.bullets) ? src.bullets : Array.isArray(src.items) ? src.items : [])
      .map(x => String(x || '').trim()).filter(Boolean);
    return docSections.map(s => {
      if (!s || !rx.test(String(s.title || s.name || s.id || ''))) return s;
      return {
        ...s,
        intro: src.intro != null ? src.intro : (src.introLine != null ? src.introLine : s.intro),
        closing: src.closing != null ? src.closing : (src.closingLine != null ? src.closingLine : s.closing),
        bullets,
        items: bullets,
      };
    });
  } catch (_) {
    return docSections;
  }
}

// ──────────────────────────────────────────────────────────────────
// Internals
// ──────────────────────────────────────────────────────────────────

function stripDataUrlPrefix(s) {
  if (!s) return null;
  if (typeof s !== 'string') return null;
  const i = s.indexOf(',');
  if (s.startsWith('data:') && i > 0) return s.slice(i + 1);
  return s;
}

// The PWA stores the user's photo as either:
//   1. A `data:image/...;base64,...` URL (after `loadPhotoFile` processed
//      a user upload into a circular PNG), or
//   2. A relative path like `icons/defaults/ant.png` for bundled default
//      avatars (the generic ant fallback, plus per-email overrides).
//
// The worker only accepts inline base64. This helper converts case (2)
// into case (1) by fetching the file and FileReader-ing it into a data
// URL. Returns null for empty/invalid input. Returns the original string
// unchanged if it's already a data URL.
async function ensurePhotoDataUrl(photo) {
  if (!photo || typeof photo !== 'string') return null;
  if (photo.startsWith('data:')) return photo;
  // Treat anything else as a relative URL/path. fetch() handles both.
  try {
    const res = await fetch(photo);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
      r.onerror = () => reject(new Error('Failed to read default photo as data URL'));
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function buildStyle(styleConfig, navyColor) {
  // Worker accepts these tokens. Pass through whatever the PWA has;
  // the worker fills in defaults for anything missing.
  const out = {};
  const passthrough = [
    'mainHeadColor', 'mainTextColor', 'mainBulletColor',
    'sidebarBg', 'sidebarHeadColor', 'sidebarTextColor',
    'headerBg', 'headerNameColor', 'headerSpecColor', 'headerContactColor',
    'photoBorderColor',
    'mainHeadFont', 'mainBodyFont', 'sidebarFont', 'headerFont',
    // v1.40.140 — table-width passthrough. Worker (≥ v1.13.1) clamps to
    // [2880, PAGE_W - 720] and applies one global width to every table
    // in the document. computeTableWidthDxa derives this from the
    // section-align sidecar's per-section percentages in localStorage.
    'tableWidth',
    // v1.40.140 — same story for column-ratio override (worker supports
    // `s.tableRatio` 0.05–0.95). The PWA section-align doesn't yet
    // surface a UI for this but we pass it through if present so a
    // future ship can land that feature without re-touching this code.
    'tableRatio',
    // v1.40.146 — table header background. Pre-v1.14.2 the worker
    // used `mainHeadColor` for both the table header fill AND its
    // border. The PWA preview uses a SEPARATE style key
    // `tableHeaderBg` for the table header (matching the navy
    // candidate band), while `mainHeadColor` is teal. Worker
    // v1.14.2 reads `style.tableHeaderBg` when present.
    'tableHeaderBg',
  ];
  for (const k of passthrough) {
    if (styleConfig[k] != null) out[k] = styleConfig[k];
  }
  if (navyColor) {
    // navyColor in the PWA drives the header/sidebar background.
    if (!out.headerBg)  out.headerBg  = navyColor;
    if (!out.sidebarBg) out.sidebarBg = navyColor;
    // v1.40.146 — table header bg falls back to navy too, so that
    // the worker matches the preview without the PWA having to set
    // tableHeaderBg explicitly.
    if (!out.tableHeaderBg) out.tableHeaderBg = navyColor;
  }
  // v1.40.146 — sidebarPosition pass-through. Worker (≥ v1.14.2)
  // accepts 'left' (default) or 'right' and swaps the body table's
  // sidebar and main cells accordingly. We special-case this
  // because it's NOT a color and would otherwise miss the
  // passthrough list above (intentionally — that list is meant to
  // be color-only by convention).
  const sp = readSidebarPosition();
  if (sp === 'left' || sp === 'right') out.sidebarPosition = sp;
  // v1.50.139 — normalize every hex colour to a bare 6-digit value. The DOCX
  // worker's docx library rejects anything but 6 hex digits and returned a 500
  // ("Invalid hex value '"#283556"'"). The value arrives quoted AND #-prefixed
  // (navyColor is a JSON-encoded string '"#283556"'), so strip surrounding
  // quotes + a leading '#'. Fonts / sidebarPosition don't match and are left.
  for (const k of Object.keys(out)) {
    if (typeof out[k] !== 'string') continue;
    const m = out[k].match(/^\s*["']?\s*#?([0-9a-fA-F]{6})\s*["']?\s*$/);
    if (m) out[k] = m[1].toUpperCase();
  }
  return out;
}

// v1.40.146 — read sidebarPosition from localStorage. Mirrors the
// pattern used by readPhotoPosition / readTableWidthPctMap:
// tolerant of both bare-string and JSON-encoded shapes.
function readSidebarPosition() {
  try {
    const raw = (typeof localStorage !== 'undefined')
      ? localStorage.getItem('sidebarPosition')
      : null;
    if (!raw) return 'left';
    let v = raw;
    try { const parsed = JSON.parse(raw); if (typeof parsed === 'string') v = parsed; } catch (_) {}
    v = String(v).trim().toLowerCase();
    return (v === 'left' || v === 'right') ? v : 'left';
  } catch (_) {
    return 'left';
  }
}

function buildFontSizes(fs) {
  // Pass through keys the worker recognizes.
  const out = {};
  const keys = [
    'mainBody', 'mainHead', 'sbBody', 'sbHead',
    'nameSize', 'specialisation', 'contactSize',
    'expSubHead', 'bulletContent', 'mainTblH', 'mainTblCell',
  ];
  for (const k of keys) {
    if (typeof fs[k] === 'number') out[k] = fs[k];
  }
  return out;
}

/**
 * Convert the PWA's section format to the worker's section format.
 * Most types pass through unchanged; a few have small shape differences.
 */
function normalizeSections(raw) {
  if (!Array.isArray(raw)) return [];
  // v1.40.160 — read per-section alignment from the
  // antcv-item-align sidecar's localStorage record and merge
  // it into each section's payload as `item_alignment`.
  //
  //   localStorage["antcvItemAlignment"][sid] = {
  //     "__group__":    "left"|"center"|"right"|"justify",
  //     "<edit-path>":  "left"|"center"|"right"|"justify",
  //     …
  //   }
  //
  // The worker (v1.14.3+) reads `s.item_alignment.__group__` and
  // honours it as the default alignment for every paragraph in
  // the section, plus per-`edit-path` overrides for individual
  // paragraphs/items. Older workers silently ignore the field.
  let alignMap = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('antcvItemAlignment');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          alignMap = parsed;
        }
      }
    }
  } catch (_) {}
  function alignFor(sid) {
    const b = alignMap[sid];
    if (!b || typeof b !== 'object') return null;
    // Pass only the valid alignment entries through. Filter out
    // anything that isn't one of the four canonical strings so
    // the worker's validator doesn't trip on a stray value.
    const out = {};
    for (const k of Object.keys(b)) {
      const v = b[k];
      if (v === 'left' || v === 'center' || v === 'right' || v === 'justify') {
        out[k] = v;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  // v1.40.194 — per-item page assignments. We annotate each surviving
  // item with `_page: <N>` when the editor flagged it for page ≥ 2.
  // Doing it here, BEFORE the type-specific filter/map, lets us key
  // the assignment by the ORIGINAL item index (the same index the
  // editor cycler used to write the map). Without this, the filter
  // step below shifts indices and the worker can't recover the
  // mapping.
  let itemPagesMap = {};
  let autoPagesMap = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('antcv:itemPages');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          itemPagesMap = parsed;
        }
      }
      // Auto-overflow breaks (antcv-auto-overflow-362) live in a separate map.
      // The export must honour them too, or the PDF/DOCX breaks mid-group while
      // the preview breaks at the group boundary. Effective = max(manual, auto).
      const rawAuto = localStorage.getItem('antcv:autoPages');
      if (rawAuto) {
        const pa = JSON.parse(rawAuto);
        if (pa && typeof pa === 'object' && !Array.isArray(pa)) {
          autoPagesMap = pa;
        }
      }
    }
  } catch (_) {}
  function pageFor(sid, origIdx) {
    let best = 0;
    const b = itemPagesMap[sid];
    if (b && typeof b === 'object') {
      const n = Number(b[String(origIdx)]);
      if (Number.isFinite(n) && n >= 2 && n <= 4) best = Math.max(best, n | 0);
    }
    const a = autoPagesMap[sid];
    if (a && typeof a === 'object') {
      const n = Number(a[String(origIdx)]);
      if (Number.isFinite(n) && n >= 2 && n <= 4) best = Math.max(best, n | 0);
    }
    return best;
  }
  // Walks items with original-index tracking, applies a per-item
  // mapper, and post-attaches the _page annotation to each kept item.
  // The mapper may return null to drop the item; null items get their
  // page assignment discarded too (the editor target no longer exists).
  function mapItemsWithPage(sid, items, mapper) {
    if (!Array.isArray(items)) return [];
    const out = [];
    for (let i = 0; i < items.length; i++) {
      const mapped = mapper(items[i], i);
      if (mapped == null) continue;
      const p = pageFor(sid, i);
      if (p >= 2) {
        if (typeof mapped === 'object') {
          mapped._page = p;
        } else {
          // String item — wrap it so we can carry the page metadata
          // alongside. The worker's `list` renderer accepts either
          // shape (string OR { text: '…', _page: N }).
          out.push({ text: String(mapped), _page: p });
          continue;
        }
      }
      out.push(mapped);
    }
    return out;
  }

  // Owner 2026-06-05: MANUAL page breaks were ignored in the export. The
  // page-control sidecars persist `section.page` (a page number) on each
  // section, and app.js paginates the preview from it — but this payload
  // never carried it, so DOCX/PDF stayed single-page. Translate it to the
  // worker's `pageBreakBefore` flag, which the worker already honours (the
  // same path the working role "slider" uses). A break is emitted on the
  // FIRST section (in document order, per column) whose page jumps above
  // the running max — so a cascade of page-2 sections breaks once, not on
  // every one. Sidebar and main are paginated independently (separate
  // table cells), so we track the running max per column.
  const sectionBreakIds = (function () {
    const ids = new Set();
    const maxByLoc = { sidebar: 1, main: 1 };
    for (const s of raw) {
      if (!s || s.on === false) continue;
      const loc = s.loc === 'sidebar' ? 'sidebar' : 'main';
      const pg = Math.max(1, parseInt((s && s.page) || 1, 10) || 1);
      if (pg > maxByLoc[loc]) {
        if (s.id) ids.add(s.id);
        maxByLoc[loc] = pg;
      }
    }
    return ids;
  })();

  return raw.filter(s => s && s.on !== false).map(s => {
    const itemAlign = alignFor(s.id);
    const base = {
      id: s.id || '',
      title: s.title || '',
      loc: s.loc === 'sidebar' ? 'sidebar' : 'main',
      on: s.on !== false,
      type: s.type,
      ...(itemAlign ? { item_alignment: itemAlign } : {}),
      ...(sectionBreakIds.has(s.id) ? { pageBreakBefore: true } : {}),
    };
    switch (s.type) {
      case 'text':
      case 'text_inline':
        return { ...base, content: s.content || '' };

      case 'text_bullets': {
        const bulletItems = Array.isArray(s.bullets) ? s.bullets : (Array.isArray(s.items) ? s.items : []);
        return {
          ...base,
          intro: s.intro || '',
          items: bulletItems.map(String).map(x => x.trim()).filter(Boolean),
          bullets: bulletItems.map(String).map(x => x.trim()).filter(Boolean),
          closing: s.closing || '',
        };
      }

      case 'foundation': {
        let foundationControls = {};
        try {
          if (typeof localStorage !== 'undefined') {
            const raw = localStorage.getItem('antcv.foundationControls.v1');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) foundationControls = parsed;
            }
          }
        } catch (_) {}
        return {
          ...base,
          hands_on: s.hands_on || '',
          professionally: s.professionally || '',
          ...(foundationControls && Object.keys(foundationControls).length ? { foundation_controls: foundationControls } : {}),
        };
      }

      case 'bullets':
        return {
          ...base,
          items: (s.items || []).map(it => {
            if (it == null) return null;
            if (typeof it === 'string') return it;
            return { b: it.b || '', t: it.t || '' };
          }).filter(Boolean),
        };

      case 'table': {
        // PWA stores rows as arrays already (first row = header).
        // Section-level s.hidden map controls which data rows are
        // hidden (row 0 is the header and is always shown).
        // v1.40.327: pass table row page assignments to worker.
        const rowPages = itemPagesMap && itemPagesMap[s.id] && typeof itemPagesMap[s.id] === 'object'
          ? itemPagesMap[s.id]
          : null;
        return {
          ...base,
          rows: Array.isArray(s.rows) ? s.rows.map(r => Array.isArray(r) ? r.map(String) : []) : [],
          ...(s.hidden ? { hidden: s.hidden } : {}),
          ...(rowPages ? { row_pages: rowPages } : {}),
        };
      }

      case 'experience':
        return {
          ...base,
          roles: (s.roles || []).filter(r => r && r.on !== false).map(r => ({
            id: r.id || '',
            title: r.title || '',
            company: r.company || '',
            years: r.years || '',
            bullets: Array.isArray(r.bullets) ? r.bullets.map(String).filter(Boolean) : [],
          })),
        };

      case 'list':
      case 'list_italic':
        // The PWA stores list items as plain strings, but enrichment
        // passes (LLM-driven "Enrich" button) sometimes return objects
        // like {l, v}, {name, issuer}, or {title}. A naive map(String)
        // would emit "[object Object]" for every such item. Extract a
        // sensible string from common shapes instead, dropping items
        // that have no usable content.
        //
        // v1.40.194: each surviving item also carries an optional
        // `_page: N` (≥2) when the editor flagged it for that page.
        // The mapper returns a string OR an object; mapItemsWithPage
        // wraps strings into `{ text, _page }` when an assignment
        // exists. The worker accepts either shape.
        return {
          ...base,
          items: mapItemsWithPage(s.id, s.items, function (it) {
            if (it == null) return null;
            if (typeof it === 'string') return it.trim() || null;
            if (typeof it !== 'object') return String(it).trim() || null;
            // Object — try {l, v} (labeled-list shape sneaking in)
            const l = (it.l || it.label || '').toString().trim();
            const v = (it.v || it.value || '').toString().trim();
            if (l && v) return `${l}: ${v}`;
            if (l) return l;
            if (v) return v;
            // Try common single-string fields
            for (const k of ['text', 'title', 'name', 'body', 'content', 'citation']) {
              const val = it[k];
              if (typeof val === 'string' && val.trim()) return val.trim();
            }
            return null;
          }),
          ...(s.hidden ? { hidden: s.hidden } : {}),
        };

      case 'labeled_list':
        return {
          ...base,
          items: mapItemsWithPage(s.id, s.items, function (it /* origIdx */) {
            if (!it || typeof it !== 'object') return null;
            // Pass through group-header markers in addition to the
            // standard {l, v} shape. The PWA stores REGULATORY CONTEXT
            // subsection headers as `{group: 'EU & UK'}` items with no
            // value — previously these were silently stripped to
            // `{l: '', v: ''}` and lost. Now the worker can render them
            // as section breaks inside the labeled list.
            const out = { l: it.l || '', v: it.v || '' };
            if (it.group)    out.group    = String(it.group);
            if (it.subhead)  out.subhead  = String(it.subhead);
            if (it.header)   out.header   = String(it.header);
            if (it.category) out.category = String(it.category);
            // Preserve per-item hidden flag. The PWA's eye-toggle
            // button sets it.hidden = true on individual items in
            // labeled_list sections (REGULATORY CONTEXT, ADDITIONAL
            // INFORMATION). Without this passthrough the worker
            // can't know which items to skip — every regulatory
            // entry would render into the docx even when the user
            // had hidden most of them in the preview.
            if (it.hidden === true) out.hidden = true;
            return out;
          }),
          // Also forward the section-level s.hidden map. Most labeled
          // lists use per-item it.hidden (set by the eye-toggle), but
          // some legacy state shapes use the indexed map; both are
          // honoured downstream.
          ...(s.hidden ? { hidden: s.hidden } : {}),
        };

      case 'education':
        return {
          ...base,
          items: mapItemsWithPage(s.id, s.items, function (it) {
            if (!it || typeof it !== 'object') return null;
            return { deg: it.deg || '', sch: it.sch || '' };
          }),
          // Per-item visibility lives in s.hidden (indexed map) for
          // education, same as list/list_italic.
          ...(s.hidden ? { hidden: s.hidden } : {}),
        };

      default:
        return base; // worker will skip unknown types silently
    }
  });
}

function buildFilename({ personalInfo, meta, doc, language }) {
  const slug = (s, max = 40) => (s || '')
    .toString()
    .replace(/[^a-zA-Z0-9æøåÆØÅ]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, max);
  const name = slug(personalInfo.name, 40);
  const company = meta.company ? '_' + slug(meta.company, 25) : '';
  const role = meta.role ? '_' + slug(meta.role, 30) : '';
  const lang = language === 'da' ? '_Dansk' : '';
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `${doc === 'cv' ? 'CV' : 'CoverLetter'}_${name}${company}${role}${lang}_${date}`;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 0);
}

// ──────────────────────────────────────────────────────────────────
// v1.13: server-side PDF generation via the docx-worker.
// ──────────────────────────────────────────────────────────────────
// Calls /generate-pdf on the docx-worker, which generates a DOCX via
// the existing pipeline then converts it to PDF via CloudConvert's
// LibreOffice cluster. Output PDF has proper Unicode embedding —
// ATS-readable AND visually faithful to the Carlito-fonted preview.
//
// Fallback behaviour: if the worker returns 503 (PDF not configured)
// or any other error, this function THROWS rather than fakes success.
// The caller should catch and fall back to client-side window.print().
// That way users on workers without CLOUDCONVERT_API_KEY continue to
// get the v1.40.95 Arial-print PDF path unchanged.
//
// Capability check: call `isPdfWorkerAvailable()` first if you want
// to avoid the round-trip when the worker doesn't support PDF. It
// does a single GET /health and caches the result for the session.
export async function exportPdfViaWorker(opts) {
  const {
    sections, meta, doc, photo, personalInfo, styleConfig,
    fontSizes, language, navyColor, layout, filename,
    headerItemAlign, headerItemLoc,
    password, // forwarded to worker; PDF doesn't encrypt the same way,
              // but worker may apply it via output filename or future support
    watermark,
  } = opts || {};

  let workerUrl = (typeof window !== 'undefined' && window.ANTCV_DOCX_WORKER) || '';
  if (!workerUrl) {
    try {
      workerUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('antcv:docxWorker')) || '';
    } catch (_e) { /* localStorage may be disabled */ }
  }
  if (!workerUrl) {
    throw new Error(
      'Server PDF requires the docx-worker URL. ' +
      'Set Settings → Advanced → Routing → DOCX worker URL.',
    );
  }

  const photoDataUrl = await ensurePhotoDataUrl(photo);

  // v1.40.140 — same tableWidth derivation as exportDocxViaWorker so
  // PDF exports also match the live drag widths.
  const docSectionsForWidth = (sections && sections[doc])
    || (Array.isArray(sections) ? sections : []);
  const derivedTableWidth = computeTableWidthDxa(docSectionsForWidth, doc);
  const styleConfigWithWidth = (derivedTableWidth !== null
    && (styleConfig == null || styleConfig.tableWidth == null))
    ? { ...(styleConfig || {}), tableWidth: derivedTableWidth }
    : (styleConfig || {});

  const payload = buildPayload({
    sections, meta, doc, photo: photoDataUrl, personalInfo,
    styleConfig: styleConfigWithWidth, fontSizes,
    language, navyColor, layout, filename,
    headerItemAlign, headerItemLoc, password, watermark,
  });

  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/pdf' };
  const secret = (typeof window !== 'undefined' && window.ANTCV_DOCX_SECRET) || '';
  if (secret) headers['X-AntCV-Secret'] = secret;

  const res = await fetch(workerUrl.replace(/\/$/, '') + '/generate-pdf', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const blob = await res.blob();
  const ct = (res.headers.get('content-type') || '').toLowerCase();

  if (!res.ok) {
    // Distinguish "PDF not configured" from a real conversion failure
    // so the caller can fall back cleanly without alarming the user.
    let detail = '';
    let isConfigError = res.status === 503;
    let parsedJson = null;
    try {
      const text = await blob.text();
      if (ct.includes('application/json')) {
        try {
          const j = JSON.parse(text);
          parsedJson = j;
          if (j.error === 'pdf_not_configured') isConfigError = true;
          detail = j.error
            ? `${j.error}${j.message ? ' — ' + j.message : ''}`
            : JSON.stringify(j).slice(0, 400);
        } catch { detail = text.slice(0, 400); }
      } else {
        detail = text.slice(0, 400);
      }
    } catch { /* ignore */ }
    const err = new Error(`PDF worker returned ${res.status} ${res.statusText}${detail ? '\n' + detail : ''}`);
    err.workerStatus = res.status;
    err.isConfigError = isConfigError;
    // v1.40.194: surface PDF failures to the UI via a custom event.
    // antcv-pdf-error-toast.js subscribes to this and renders a small
    // dismissible chip near the export button. We carry the parsed
    // upstream error so the toast can show the underlying CloudConvert
    // / LibreOffice reason ("Invalid scope(s)", "convert failed", …)
    // instead of just "PDF export failed".
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('antcv:pdf-export-error', {
          detail: {
            status: res.status,
            statusText: res.statusText,
            isConfigError,
            detail,
            upstream: parsedJson,
            ts: Date.now(),
          },
        }));
      }
    } catch (_) {}
    throw err;
  }

  if (!ct.includes('application/pdf')) {
    let head = '';
    try { head = (await blob.text()).slice(0, 200); } catch { /* ignore */ }
    throw new Error(
      `PDF worker returned content-type "${ct || '(none)'}" instead of a PDF. ` +
      `First 200 bytes: ${head}`,
    );
  }

  const pdfBlob = new Blob([await blob.arrayBuffer()], { type: 'application/pdf' });
  const outFilename = (filename || buildFilename({ doc, personalInfo, meta, language })) + '.pdf';
  triggerDownload(pdfBlob, outFilename);

  const result = {
    bytes: pdfBlob.size,
    provider: res.headers.get('X-AntCV-Pdf-Provider') || 'unknown',
    jobId: res.headers.get('X-AntCV-Pdf-JobId') || '',
    docxMs: parseInt(res.headers.get('X-AntCV-Docx-Ms') || '0', 10),
    pdfMs: parseInt(res.headers.get('X-AntCV-Pdf-Ms') || '0', 10),
    // v1.40.196: page count of the produced PDF, as reported by
    // docx-worker v1.14.9+. Older workers omit this header — we
    // surface 0 so the mismatch sidecar can skip the comparison.
    pages: parseInt(res.headers.get('X-AntCV-Pdf-Pages') || '0', 10),
  };
  // v1.40.194: dispatch success so the error-toast (and any other
  // listeners) can clear themselves once the next export goes through.
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(new CustomEvent('antcv:pdf-export-success', { detail: result }));
    }
  } catch (_) {}
  return result;
}

// Session-cached capability check. Calls GET /health once per session
// and remembers whether pdf_via is set. Returns 'cloudconvert' | null.
let _pdfWorkerCache = undefined;
export async function isPdfWorkerAvailable() {
  if (_pdfWorkerCache !== undefined) return _pdfWorkerCache;
  try {
    let workerUrl = (typeof window !== 'undefined' && window.ANTCV_DOCX_WORKER) || '';
    if (!workerUrl) {
      try {
        workerUrl = (typeof localStorage !== 'undefined' && localStorage.getItem('antcv:docxWorker')) || '';
      } catch (_e) { /* ignore */ }
    }
    if (!workerUrl) {
      _pdfWorkerCache = null;
      return null;
    }
    const res = await fetch(workerUrl.replace(/\/$/, '') + '/health');
    if (!res.ok) {
      _pdfWorkerCache = null;
      return null;
    }
    const j = await res.json();
    _pdfWorkerCache = j && j.pdf_via ? j.pdf_via : null;
    return _pdfWorkerCache;
  } catch (_e) {
    _pdfWorkerCache = null;
    return null;
  }
}

// Expose via window for easy access from app.js without bundler imports.
// Mirrors how exportDocxViaWorker is wired.
if (typeof window !== 'undefined') {
  window.exportPdfViaWorker = exportPdfViaWorker;
  window.isPdfWorkerAvailable = isPdfWorkerAvailable;
}
