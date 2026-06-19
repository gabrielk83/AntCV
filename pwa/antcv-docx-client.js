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
    // TABLE-WIDTH-CLOBBER-001 (owner 2026-06-15): the table width moved to a
    // STANDALONE key so it survives the personalInfo cloud-restore rewrites that
    // were wiping it on export ("table resizes to original when I press PDF").
    // Standalone wins; fall back to the legacy nested location for pre-fix data.
    const sa = localStorage.getItem('antcv:tableWidthPct');
    if (sa) { const m = JSON.parse(sa); if (m && typeof m === 'object') return m; }
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
  // EXPORT-PHOTO-POS-CLAMP-001 (1.50.373): this VALID set lagged the app's
  // picker. 'band-overlap' was MISSING, so the bridge silently exported as
  // sidebar-top (the owner's "in pdf bridge is not visible" — the worker was
  // fine, the CLIENT clamped the position before it ever left the browser).
  // 'none' (the picker's Hidden value) was missing too, so a HIDDEN photo
  // still exported. Keep this list a superset of the picker's values.
  const VALID = new Set([
    'sidebar-top', 'sidebar-bottom',
    'header-left', 'header-right',
    'main-left', 'main-right',
    'main-left-bottom', 'main-right-bottom',
    'bridge-middle', 'bridge-bottom',
    'band-overlap',
    'none', 'hidden',
  ]);
  try {
    if (typeof localStorage === 'undefined') return 'sidebar-top';
    const raw = localStorage.getItem('photoPosition');
    // PHOTO-BRIDGE-DEFAULT-PARITY-001 (owner 2026-06-15): when the user never
    // explicitly picks a position, the PREVIEW defaults it package-aware
    // (app.src.js ~15662): copenhagen-modern → 'band-overlap' (the bridge),
    // else 'sidebar-top'. The export used a flat 'sidebar-top' default, so an
    // owner on the default package saw the bridge in preview but the DOCX/PDF
    // exported sidebar-top ("non-float bridge not working differently"). Mirror
    // the preview default here. An explicit stored choice still wins.
    if (!raw) return packageDefaultPhotoPosition();
    let v = raw;
    try { const p = JSON.parse(raw); if (typeof p === 'string') v = p; }
    catch (_) {}
    v = String(v).trim();
    if (v === 'none') v = 'hidden';
    return VALID.has(v) ? v : packageDefaultPhotoPosition();
  } catch (_) { return 'sidebar-top'; }
}

// Mirror the preview's package-aware photo-position default (app.src.js ~15662):
// copenhagen-modern (incl. the 'scandinavian' alias, and the default package
// when stylePackage is unset) → the band-overlap bridge; every other package →
// sidebar-top. Used by readPhotoPosition when no explicit position is stored.
function packageDefaultPhotoPosition() {
  try {
    if (typeof localStorage === 'undefined') return 'sidebar-top';
    let pkg = localStorage.getItem('stylePackage');
    if (pkg == null || pkg === '') pkg = 'copenhagen-modern';
    try { const p = JSON.parse(pkg); if (typeof p === 'string') pkg = p; } catch (_) {}
    pkg = String(pkg).trim().toLowerCase();
    if (pkg === 'scandinavian') pkg = 'copenhagen-modern';
    return pkg === 'copenhagen-modern' ? 'band-overlap' : 'sidebar-top';
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
    // Skip the REST width (no real user adjustment) so the worker applies its
    // own default. The rest pct differs by doc: CL rests at 90% of the body
    // column (worker defaultClW = (PAGE_W-400)*0.9), CV rests at 100% of the
    // main column. Anything within ±1 of the rest pct is treated as default.
    if (Math.abs(v - (docType === 'cl' ? 90 : 100)) < 1) continue;
    if (maxPct === null || v > maxPct) maxPct = v;
  }
  if (maxPct === null) return null;
  // CL-TABLE-WIDTH-PAGE-REF-001 (owner 2026-06-18): the CL base is the USABLE
  // body width (PAGE_W - 400 = 11506 dxa), the SAME reference the preview wrap
  // (`width: pct%` of the body column) and the worker defaultClW ((PAGE_W-400)*0.9)
  // measure against - so a width set/decreased in the preview exports at the SAME
  // proportion. The old 9602 (PAGE_W - 2304, ~80% of page) made every dragged
  // width export much narrower than the preview showed. CV keeps its 6630 main-col
  // reference.
  const defaultDxa = (docType === 'cl') ? 11506 : 6630;
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

  // 1.50.244 / 1.50.248 DOCX-EXPORT-CORS-CPU-001:
  //   * Wrap the fetch so a network-level failure (CORS-blocked, edge
  //     timeout, Cloudflare 1102 CPU-exceeded) does not throw the bare
  //     `TypeError: Failed to fetch` at the user.
  //   * AUTO-RETRY once on a network error after a short delay. Cold-start
  //     kills on Cloudflare Workers commonly succeed on the warm second
  //     try (a single retry — we don't loop indefinitely).
  //   * 1.50.248: also "warm up" the worker by hitting /health BEFORE the
  //     real POST. A warm worker has its bundle cached + JIT warm, which
  //     materially reduces the per-request CPU on Cloudflare's Bundled
  //     tier. Best-effort, swallow any failure.
  async function fetchGenerate() {
    return fetch(workerUrl.replace(/\/$/, '') + '/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
  }
  function describeNetworkFailure(netErr) {
    let payloadKb = 0;
    try { payloadKb = Math.round((JSON.stringify(payload) || '').length / 1024); } catch (_) {}
    const photoBytes = (payload && typeof payload.photo === 'string') ? payload.photo.length : 0;
    const photoKb = Math.round(photoBytes / 1024);
    return (
      'DOCX export failed before a response was received from the worker (' +
      String((netErr && netErr.message) || netErr) + ', after 1 retry). ' +
      'This usually means the worker exhausted its CPU budget while ' +
      'packing the document — Cloudflare killed the request and the ' +
      'browser blocked the response (no CORS headers on the error page). ' +
      'Payload was ~' + payloadKb + ' KB' +
      (photoKb > 50 ? ' (photo alone ~' + photoKb + ' KB — try removing or downsizing the photo)' : '') +
      '. Try: (1) remove the profile photo or use a smaller one, ' +
      '(2) trim long sections, or (3) wait ~30 s and export again — the ' +
      'worker is more likely to succeed when warm. If it keeps failing on ' +
      'normal-sized CVs, the docx-worker needs a Cloudflare Workers ' +
      'Unbound upgrade for longer CPU budgets.'
    );
  }
  // Pre-flight: warm the worker. Cheap GET, ignored on failure.
  try {
    await fetch(workerUrl.replace(/\/$/, '') + '/health', {
      method: 'GET',
      cache: 'no-store',
    }).catch(() => {});
  } catch (_) {}
  let res;
  try {
    res = await fetchGenerate();
  } catch (netErr1) {
    try {
      console.warn(
        '[docx-client] first /generate fetch failed (' +
          String((netErr1 && netErr1.message) || netErr1) +
          '); retrying once after 1500 ms',
      );
    } catch (_) {}
    await new Promise(r => setTimeout(r, 1500));
    try {
      res = await fetchGenerate();
    } catch (netErr2) {
      throw new Error(describeNetworkFailure(netErr2));
    }
  }

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
  // LANG-ES-ZH-001 (1.50.382 / worker 1.14.57): the worker accepts
  // en|da|es|zh now — forward all four (localized closing/continuation
  // strings live worker-side). Anything else still clamps to en so an
  // unknown UI language can never 422 the export.
  language = (function (l) {
    const s = String(l || '').toLowerCase();
    if (/^da/.test(s)) return 'da';
    if (/^es/.test(s)) return 'es';
    if (/^zh/.test(s)) return 'zh';
    return 'en';
  })(language);
  // Normalize sections — the PWA stores these as { cv: [...], cl: [...] }
  // depending on doc type; the worker just wants the active list.
  const docSections = applyOutcomesMode(
    mergeHowContributeFromLocalStorage((sections && sections[doc]) || (Array.isArray(sections) ? sections : []), doc),
    doc
  );

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

  // ROLE-FOUNDER-001 export half (owner 2026-06-14): "Founder"/"Co-Founder" must
  // not appear in the application role/subtitle band for unsolicited or
  // non-consulting roles. A genuine independent-consultancy label
  // (konsulent/consult/independent) is left intact; otherwise the word is
  // stripped and leftover separators tidied so "Founder & Product / Project
  // Expert" becomes "Product / Project Expert".
  const stripFounder = (v) => {
    let s = String(v || '');
    if (/\b(konsulent|consult|independent)\b/i.test(s)) return s.trim();
    return s
      .replace(/\bco[-\s]?founder\b/gi, '')
      .replace(/\bfounder\b/gi, '')
      .replace(/^[\s&/,|:–—-]+/, '')
      .replace(/[\s&/,|:–—-]+$/, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  };

  // Cover letters use a synthesised "Application: <role> — <company>"
  // line in the candidate header band — it's the slot the CV uses for
  // its specialisation. The PWA preview generates this dynamically; the
  // worker just renders meta.subtitle as-is, so we have to synthesise
  // it here. Falls back to "Application: [role and company]" when both
  // role and company are empty so the band isn't blank.
  const subtitle = (() => {
    if (doc !== 'cl') return stripFounder(meta.subtitle || '');
    const role = stripFounder((meta.role || '').trim());
    const company = (meta.company || '').trim();
    const isDA = (language === 'da');
    const prefix = isDA ? 'Ansøgning: ' : 'Application: ';
    if (!role && !company) {
      return prefix + (isDA ? '[rolle og virksomhed]' : '[role and company]');
    }
    const sep = (role && company) ? ' \u2014 ' : '';
    return `${prefix}${role}${sep}${company}`;
  })();

  // CONTACT-LINE-DENMARK-001 (owner 2026-06-14): mirror the PWA preview's
  // Danish local-form normalisation (app.src.js `pe`/`__localForm`) so the
  // exported DOCX/PDF header contact line reads "2300, København S"
  // (postcode + comma + district, NO country word) — not the raw stored
  // "2300 København S, Denmark". Non-Copenhagen locations pass through.
  const localForm = (v) => {
    let s = String(v || '').trim();
    if (!/copenhagen|københavn/i.test(s)) return s;
    s = s
      .replace(/copenhagen/gi, 'København')
      .replace(/\s*,?\s*(denmark|danmark)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[,\s]+$/g, '')
      .trim();
    if (/^københavn( s)?$/i.test(s)) return '2300, København S';
    const m = s.match(/^(\d{4})\s+(københavn.*)$/i);
    if (m) return `${m[1]}, ${m[2]}`;
    return s;
  };

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
      location:    localForm(personalInfo.location || ''),
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
      // 1.50.368 / worker 1.14.51 — bridge mode forwards the EFFECTIVE
      // medallion diameter (slider px × the native 1.3 bridge scale, same
      // formula as the preview) so the export straddle matches on-screen.
      // 1.50.373 / worker 1.14.53 — EVERY visible position forwards the
      // slider diameter now (the preview renders every mode at photoSize;
      // only band-overlap applies the native 1.3 scale).
      ...((() => {
        try {
          const pos = readPhotoPosition();
          if (pos === 'hidden') return {};
          let raw = localStorage.getItem('photoSize');
          let n = Number(typeof raw === 'string' ? raw.replace(/["']/g, '') : raw);
          if (!Number.isFinite(n) || n < 60 || n > 220) n = 120;
          if (pos === 'band-overlap') n = Math.min(220, Math.round(1.3 * n));
          return { photoSizePx: n };
        } catch (_) { return {}; }
      })()),
    },
    meta: {
      subtitle,
      role:     stripFounder(meta.role || ''),
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
    sections: bindOrphansInSections(normalizeSections(docSections)),
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
    /* PB-WORKER-SIDEBAR-RATIO-001 follow-up: forward the user's ADJUSTED CV
       sidebar/main split so the worker's two-column widths match a manually
       dragged splitter, not just the 0.33 default. The worker (index.js 1.14.41)
       already honours payload.sidebar_ratio (clamped [0.2, 0.55], default 0.33);
       it just never received it. We send it only when the user moved the
       splitter away from the default — an unset ratio means both sides default
       to 0.33, so omitting it keeps them in step. CV-only; the linear CL path
       ignores the field. */
    ...((() => { const r = readSidebarRatio(); return r != null ? { sidebar_ratio: r } : {}; })()),
  };

  return payload;
}

// PB-WORKER-SIDEBAR-RATIO-001 follow-up: the CV sidebar/main split lives in
// localStorage 'cvSidebarRatio' (JSON-stringified number; preview default 0.33,
// preview-clamped [0.18, 0.5]). Return it clamped to the worker's accepted band
// [0.2, 0.55] so the value is always honoured (an out-of-band value would make
// the worker fall back to 0.33). Returns null when unset/invalid so buildPayload
// omits the field and the worker keeps its 0.33 default — matching the preview's
// own default. The narrow [0.18, 0.2) preview range maps to the 0.2 floor, the
// closest the worker can render without a band-widening worker deploy.
function readSidebarRatio() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem('cvSidebarRatio');
    if (raw == null) return null;
    let v;
    try { v = JSON.parse(raw); } catch (_) { v = Number(raw); }
    v = Number(v);
    if (!Number.isFinite(v) || v <= 0) return null;
    return Math.max(0.2, Math.min(0.55, v));
  } catch (_) { return null; }
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
    const parsed = raw ? JSON.parse(raw) : {};
    const base = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : {};
    // 1.50.315 CL-MIDLIST: overlay AUTO breaks (antcv:autoPages) onto the manual
    // map for text_bullets-shaped keys ONLY — `intro` | `bullet_<i>` | `closing`.
    // The worker's renderTextBullets already splits a How-I-Would-Contribute
    // subsection per-bullet on ctx.itemPages[sid][key]; it just never received the
    // measurer's auto-overflow break (item_pages carried manual only). Numeric-keyed
    // auto breaks (list / labeled_list / education / table / experience) are
    // deliberately EXCLUDED here — those flow through pageFor()/sectionBreakIds and
    // would double-apply if merged. Effective page = max(manual, auto) per key.
    const merged = {};
    for (const sid in base) {
      if (base[sid] && typeof base[sid] === 'object') merged[sid] = Object.assign({}, base[sid]);
    }
    try {
      const rawAuto = localStorage.getItem('antcv:autoPages');
      const auto = rawAuto ? JSON.parse(rawAuto) : null;
      const TB_KEY = /^(intro|closing|bullet_\d+)$/;
      if (auto && typeof auto === 'object') {
        for (const sid in auto) {
          const a = auto[sid];
          if (!a || typeof a !== 'object') continue;
          for (const k in a) {
            if (!TB_KEY.test(k)) continue;
            const n = Number(a[k]);
            if (!(Number.isFinite(n) && n >= 2 && n <= 4)) continue;
            if (!merged[sid]) merged[sid] = {};
            const cur = Number(merged[sid][k]) || 0;
            if (n > cur) merged[sid][k] = n;
          }
        }
      }
    } catch (_) { /* autoPages optional */ }
    return merged;
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
    // Prefer NON-EMPTY bullets over items: the shape-guard sidecar stamps
    // bullets:[] onto every stored section, so an empty bullets array means
    // "no sidecar edit", not "delete the bullets" (HOWCONTRIBUTE-001).
    const bullets = (Array.isArray(src.bullets) && src.bullets.length ? src.bullets : Array.isArray(src.items) ? src.items : [])
      .map(x => String(x || '').trim()).filter(Boolean);
    return docSections.map(s => {
      if (!s || !rx.test(String(s.title || s.name || s.id || ''))) return s;
      const merged = {
        ...s,
        intro: src.intro != null ? src.intro : (src.introLine != null ? src.introLine : s.intro),
        closing: src.closing != null ? src.closing : (src.closingLine != null ? src.closingLine : s.closing),
      };
      // Never let an empty stored list wipe live bullets (data-loss guard).
      if (bullets.length) { merged.bullets = bullets; merged.items = bullets; }
      return merged;
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

export function buildStyle(styleConfig, navyColor) {
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
  // EXPORT-PALETTE-PARITY-001 (owner 2026-06-14): the PREVIEW paints the panel
  // backgrounds from the package CSS tokens (--sidebar-bg is PALE for Copenhagen,
  // --header-bg is the dark band) — NOT from styleConfig, whose sidebarBg/header
  // text colours are often the stale navy/dark. The export was sending those
  // stale values, so the exported sidebar stayed DARK and the candidate-band text
  // went INVISIBLE (dark ink on the navy band). Resolve the SAME tokens the
  // preview uses and override the panel bg + readable ink so DOCX/PDF match the
  // preview. Custom styles (no token defined) fall through to styleConfig/navy.
  try {
    if (typeof document !== 'undefined' && document.body && typeof getComputedStyle === 'function') {
      const cs = getComputedStyle(document.body);
      const tok = (n) => (cs.getPropertyValue(n) || '').trim();
      const ink = (hex) => {
        const h = String(hex || '').replace('#', '');
        if (h.length < 6) return '#FFFFFF';
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b > 140) ? '#283556' : '#FFFFFF';
      };
      const sb = tok('--sidebar-bg');
      // SIDEBAR-LABEL-PDF-WHITE-001 (owner 2026-06-14): the bold sidebar field
      // LABELS ("Project Workflow:", etc.) render via sidebarLabelColor, which the
      // worker defaults to WHITE — invisible on the pale sidebar in the PDF. Set it
      // (and sidebarTextColor) to the dark readable ink for the pale ground too.
      if (sb) { out.sidebarBg = sb; out.sidebarTextColor = ink(sb); out.sidebarLabelColor = ink(sb); }
      const hb = tok('--header-bg');
      if (hb) { out.headerBg = hb; out.headerNameColor = ink(hb); out.headerSpecColor = ink(hb); out.headerContactColor = ink(hb);
        // TABLE-HEADER-MATCH-BAND-EXPORT-001 (owner 2026-06-18): the table header
        // must use the SAME dark band colour (#33446F on Copenhagen) as the
        // candidate band - in DOCX + PDF, NOT the pale #DDE6F2 default. The band
        // was already resolved from --header-bg; the table header had NO token
        // resolution, so it kept styleConfig.tableHeaderBg (#DDE6F2) and rendered
        // pale. Resolve it from the same token + readable (white) ink.
        out.tableHeaderBg = hb; out.tableHeaderText = ink(hb); }
    }
  } catch (_) {}
  // v1.40.146 — sidebarPosition pass-through. Worker (≥ v1.14.2)
  // accepts 'left' (default) or 'right' and swaps the body table's
  // sidebar and main cells accordingly. We special-case this
  // because it's NOT a color and would otherwise miss the
  // passthrough list above (intentionally — that list is meant to
  // be color-only by convention).
  const sp = readSidebarPosition();
  if (sp === 'left' || sp === 'right') out.sidebarPosition = sp;
  // 1.50.361 — indent-controls export parity (TIER B): the Advanced sliders'
  // main-edge and bullet indents (px) now drive the worker too (>=1.14.47
  // converts px -> DXA at x15). Numbers, not colors — special-cased like
  // sidebarPosition so the color-only passthrough list stays color-only.
  const numTok = (v) => {
    const n = Number(typeof v === 'string' ? v.replace(/["']/g, '') : v);
    return Number.isFinite(n) && n >= 0 && n <= 60 ? n : undefined;
  };
  // SPACING-COMFORT-DEFAULT-001 (R36): the PWA default is now 14px; the
  // worker constant is still 150 DXA (10px), so the effective value is
  // forwarded even when the user never touched the slider.
  const me = numTok(styleConfig.mainEdgeIndent);
  out.mainEdgeIndent = me !== undefined ? me : 14;
  // bulletIndent: forward ONLY when the user moved the slider off the PWA
  // default (24). The preview and Word bullet scales are not 1:1 (preview
  // text hangs at 24px where the export's reviewed look is 14px/210 DXA), so
  // blindly forwarding the untouched default would shift the export text
  // right — owner 2026-06-11: "text can stay where it is".
  const bi = numTok(styleConfig.bulletIndent);
  if (bi !== undefined && bi !== 24) out.bulletIndent = bi;
  // ADV-SPACING-BULLETGAP-001 (owner 2026-06-14): the marker-to-text gap,
  // decoupled from bulletIndent (= text from edge). Forward when it is moved
  // off the comfort default (21) OR when bulletIndent itself is forwarded, so
  // the worker uses the SAME decoupled model the preview now renders (marker
  // sits bulletIndent - bulletMarkerGap from the edge). For untouched defaults
  // (bi 24 / gap 21) nothing is forwarded and the worker's legacy bIndent-45
  // path produces the identical 21px gap.
  const bmg = numTok(styleConfig.bulletMarkerGap);
  const __effBmg = bmg !== undefined ? bmg : 21;
  if (__effBmg !== 21 || (bi !== undefined && bi !== 24)) out.bulletMarkerGap = __effBmg;
  // ADV-SPACING-CONTROLS-001 (1.50.394 / worker 1.14.60) +
  // SPACING-COMFORT-DEFAULT-001 (R36): the PWA defaults are now the
  // COMFORT recommendation, while the worker's reviewed constants still
  // describe the old tight look. Forward the EFFECTIVE value (stored,
  // else the comfort default) whenever it differs from the worker's
  // constant — untouched users export the same comfort look they
  // preview; setting a slider back to the old value forwards nothing.
  const COMFORT = {
    bodyEdgePad: 12, sidebarEdgePad: 11, seamGap: 6,
    mainSectionGap: 14, sidebarSectionGap: 12, bodySectionGap: 16,
    candidateGap: 5,
  };
  for (const [key, workerDef] of [
    ['bodyEdgePad', 8], ['sidebarEdgePad', 8], ['seamGap', 0],
    ['mainSectionGap', 8], ['sidebarSectionGap', 8], ['bodySectionGap', 8],
    ['candidateGap', 3],
  ]) {
    const v = numTok(styleConfig[key]);
    const eff = v !== undefined ? v : COMFORT[key];
    if (eff !== workerDef) out[key] = eff;
  }
  // 1.50.378 PAGEBREAK-STYLE-OPTIONS-001: page-flow prefs. Booleans/enum, not
  // colors — forwarded only when set off their defaults so older workers and
  // untouched users see no change.
  if (styleConfig.contHeadlines === false) out.contHeadlines = false;
  if (styleConfig.repeatHeader === true) out.repeatHeader = true;
  if (styleConfig.pageNumbers === 'top-right' || styleConfig.pageNumbers === 'bottom-right') {
    out.pageNumbers = styleConfig.pageNumbers;
  }
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
// ORPHAN-NBSP-EXPORT-001 (owner 2026-06-18): the CloudConvert/LibreOffice PDF
// ignores the preview's `text-wrap: pretty` (1.50.652), so a single short word
// can still drop to a line of its own at the end of a bullet, paragraph, or
// table cell. Bind the LAST short word to the word before it with a non-breaking
// space (U+00A0) so a lone word can never orphan. Conservative + idempotent:
//   - only the final gap is bound (one NBSP per text run);
//   - skip if the run already contains an NBSP (so a re-export never double-binds);
//   - skip when the last word is long (>14 chars — it wraps as a unit anyway, not
//     an ugly one-word orphan) or when there is only one word.
// Trailing whitespace is preserved. HTML-bearing runs are safe (NBSP is opaque).
const ORPHAN_NBSP = ' ';
function bindOrphan(s) {
  if (typeof s !== 'string' || !s) return s;
  if (s.indexOf(ORPHAN_NBSP) !== -1) return s;        // already bound — idempotent
  const right = s.replace(/\s+$/, '');                // ignore any trailing whitespace
  const trail = s.slice(right.length);                // preserve it verbatim
  const i = right.lastIndexOf(' ');
  if (i <= 0) return s;                               // 0 or 1 word
  const last = right.slice(i + 1);
  if (!last || last.length > 14) return s;            // long last word won't orphan badly
  if (!right.slice(0, i).trim()) return s;            // nothing before the gap
  return right.slice(0, i) + ORPHAN_NBSP + last + trail;
}
// Apply bindOrphan to the body-text fields of an already-normalized section
// list. Mutates the FRESH payload objects normalizeSections built (never the
// live React state). Titles, labels, ids, years, companies, focus-area cells
// and structured education fields are left untouched.
function bindOrphansInSections(sections) {
  if (!Array.isArray(sections)) return sections;
  const bindArr = (a) => Array.isArray(a) ? a.map(x => (typeof x === 'string' ? bindOrphan(x) : x)) : a;
  for (const s of sections) {
    if (!s || typeof s !== 'object') continue;
    switch (s.type) {
      case 'text':
      case 'text_inline':
        if (typeof s.content === 'string') s.content = bindOrphan(s.content);
        break;
      case 'text_bullets':
        s.intro = bindOrphan(s.intro);
        s.closing = bindOrphan(s.closing);
        s.items = bindArr(s.items);
        s.bullets = bindArr(s.bullets);
        break;
      case 'foundation':
        s.hands_on = bindOrphan(s.hands_on);
        s.professionally = bindOrphan(s.professionally);
        break;
      case 'bullets':
        if (Array.isArray(s.items)) s.items = s.items.map(it => {
          if (typeof it === 'string') return bindOrphan(it);
          if (it && typeof it === 'object' && typeof it.t === 'string') return { ...it, t: bindOrphan(it.t) };
          return it;
        });
        break;
      case 'table':
        if (Array.isArray(s.rows)) s.rows = s.rows.map((r, i) => {
          if (i === 0 || !Array.isArray(r)) return r;       // keep the header row as-is
          return r.map((cell, ci) => (ci === 1 && typeof cell === 'string') ? bindOrphan(cell) : cell);
        });
        break;
      case 'experience':
        if (Array.isArray(s.roles)) s.roles.forEach(role => {
          if (role && typeof role === 'object') {
            role.bullets = bindArr(role.bullets);
            if (typeof role.results === 'string') role.results = bindOrphan(role.results);
          }
        });
        break;
      case 'list':
      case 'list_italic':
        if (Array.isArray(s.items)) s.items = s.items.map(it => {
          if (typeof it === 'string') return bindOrphan(it);
          if (it && typeof it === 'object' && typeof it.text === 'string') return { ...it, text: bindOrphan(it.text) };
          return it;
        });
        break;
      case 'labeled_list':
        if (Array.isArray(s.items)) s.items = s.items.map(it => {
          if (it && typeof it === 'object' && typeof it.v === 'string') return { ...it, v: bindOrphan(it.v) };
          return it;
        });
        break;
    }
  }
  return sections;
}

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
  // CJLR-TABLE-001 (1.50.383 / worker 1.14.58): the CORE COMPETENCIES
  // per-row CJLR (antcv-core-competencies-row-controls-234.js, storage
  // antcv.coreCompetencies.rowAlignment.v1 = { "row-<i>": align }, i over
  // the FULL rows array with the header at 0) was PREVIEW-ONLY — exports
  // always rendered the table left-aligned. Forward the explicit entries to
  // table sections as item_alignment["rows.<i>"]; the worker's
  // renderCompetencyTable applies them to the EXPERTISE cell.
  let tableRowAlign = {};
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('antcv.coreCompetencies.rowAlignment.v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const k of Object.keys(parsed)) {
            const m = /^row-(\d+)$/.exec(k);
            const v = parsed[k];
            if (m && Number(m[1]) > 0 &&
                (v === 'left' || v === 'center' || v === 'right' || v === 'justify')) {
              tableRowAlign['rows.' + m[1]] = v;
            }
          }
        }
      }
    }
  } catch (_) {}
  function alignFor(sid, sectionType) {
    const b = alignMap[sid];
    const out = {};
    if (b && typeof b === 'object') {
      // Pass only the valid alignment entries through. Filter out
      // anything that isn't one of the four canonical strings so
      // the worker's validator doesn't trip on a stray value.
      for (const k of Object.keys(b)) {
        const v = b[k];
        if (v === 'left' || v === 'center' || v === 'right' || v === 'justify') {
          out[k] = v;
        }
      }
    }
    if (sectionType === 'table') {
      for (const k of Object.keys(tableRowAlign)) out[k] = tableRowAlign[k];
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
  let autoPagesRaw = {};   // 1.50.295: auto breaks, used ONLY for whole-unit main-column paths (experience roles + table rows)
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('antcv:itemPages');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          itemPagesMap = parsed;
        }
      }
      // Auto-overflow breaks (the measurer antcv-auto-pagebreak-block-001) live
      // in a SEPARATE map (antcv:autoPages). HISTORY: 1.50.215 stood ALL auto
      // forwarding down because, under the OLD single-table 2-column worker, a
      // sidebar-only auto-break scrambled the PDF (isolated header, mid-role cut,
      // wrong continuation). That model is gone — the PER-PAGE export is now live:
      //   • worker 1.14.39 (PB-WORKER-TWOCOL-PAGED-001) renders ONE two-column
      //     table PER PAGE, splitting each column at its forwarded breaks. The
      //     page boundary IS the table boundary, so a break in one column no
      //     longer desyncs the other, and the sidebar navy fills every page.
      //   • 1.50.295 re-enabled the whole-unit MAIN paths (experience role.page +
      //     table row_pages).
      //   • 1.50.313 re-enabled the SIDEBAR list path: pageFor() below reads
      //     autoPagesRaw, so an overflowing sidebar list (labeled_list / list /
      //     education) forwards item._page → renderSection splits it into a
      //     "(Cont.)" continuation segment → the per-page model engages.
      //   • 1.50.320 (the salmon-push fix) made the MEASURER actually WRITE the
      //     sidebar break even when the first group overflows the A4 line — before
      //     that, autoPages[sidebar] was empty for such CVs, so nothing forwarded
      //     and the export fell back to numPages=1 Word natural flow.
      // So `autoPagesRaw` drives BOTH the experience/table cases AND the sidebar
      // list _page (via pageFor); the legacy `autoPagesMap` is unused. Residual:
      // the break POSITION is measured in preview px (≈ the Word line via the
      // measurer's WORD_INFLATE), so a borderline page can land one unit off —
      // bounded by the per-page model (never a mid-content cut). Verified end-to-end:
      // pwa/test/diag-sidebar-export-page.mjs (client forwards coordinated _page +
      // role.page) and workers/docx-worker/test/diag-twocol-ownerlike.mjs (worker
      // → 2 page tables, navy per page, AI notice on the last page, no scramble).
      const rawAuto = localStorage.getItem('antcv:autoPages');
      if (rawAuto) {
        const parsedAuto = JSON.parse(rawAuto);
        if (parsedAuto && typeof parsedAuto === 'object' && !Array.isArray(parsedAuto)) {
          autoPagesRaw = parsedAuto;
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
    // 1.50.313 PB-WORKER-SIDEBAR-CONT-001: forward the AUTO break too (was the
    // stood-down autoPagesMap, always empty). The worker only SPLITS sidebar list
    // sections on this _page (renderSection is isSidebar-gated), so a sidebar
    // section that auto-overflows now gets a clean "(Cont.)" continuation segment
    // in the export — matching the preview salmon. Main-column lists are unaffected
    // by the split; at most item-0 moves the section whole (benign).
    const a = autoPagesRaw[sid];
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
    // 1.50.311 CL parity: in the cover letter the page break the measurer chose
    // (antcv:autoPages, section-level) must be forwarded so the exported PDF
    // breaks at the SAME section as the preview salmon — Word's natural break
    // otherwise lands a bit earlier. Set pageBreakBefore on the CL section the
    // measurer moved. Scoped to the CL (via localStorage 'doc') so the CV's
    // item-level autoPages aren't mistaken for section breaks.
    try {
      let _doc = (typeof localStorage !== 'undefined' && localStorage.getItem('doc')) || '';
      try { const p = JSON.parse(_doc); if (typeof p === 'string') _doc = p; } catch (_) {}
      if (String(_doc).toLowerCase() === 'cl') {
        for (const s of raw) {
          if (!s || s.on === false || !s.id) continue;
          const b = autoPagesRaw && autoPagesRaw[s.id];
          if (b && typeof b === 'object' && Object.keys(b).some(k => Number(b[k]) >= 2)) {
            ids.add(s.id);
          }
        }
      }
    } catch (_) { /* best-effort */ }
    return ids;
  })();

  // PLACEHOLDER-EXPORT-GUARD-001 (owner 2026-06-14): the empty-CL/CV skeleton
  // seeds sections with bracketed guidance placeholders (e.g. "[WHY THIS
  // POSITION — 1-2 sentences …]", "[Focus area 1]"). The editor shows these so
  // the user knows what to write, but a generated draft that leaves a field
  // empty must NEVER export the bracket text into a finished document. Treat a
  // value that is ENTIRELY one bracketed placeholder as empty; a text section
  // that is empty after stripping is dropped so no orphan heading remains.
  const PLACEHOLDER_RE = /^\s*\[[^\]]*\]\s*$/;
  const clean = (v) => (typeof v === 'string' && PLACEHOLDER_RE.test(v) ? '' : v);
  return raw.filter(s => s && s.on !== false).map(s => {
    const itemAlign = alignFor(s.id, s.type);
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
        return { ...base, content: clean(s.content) || '' };

      case 'text_bullets': {
        const bulletItems = Array.isArray(s.bullets) ? s.bullets : (Array.isArray(s.items) ? s.items : []);
        const cleaned = bulletItems.map(String).map(x => clean(x.trim())).map(x => x.trim()).filter(Boolean);
        return {
          ...base,
          intro: clean(s.intro) || '',
          items: cleaned,
          bullets: cleaned,
          closing: clean(s.closing) || '',
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
          hands_on: clean(s.hands_on) || '',
          professionally: clean(s.professionally) || '',
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
        // 1.50.295 SALMON-AUTO-EXPORT-001: EFFECTIVE row pages = manual itemPages
        // ∪ auto autoPages for this table (whole-row moves, main column only —
        // CORE COMPETENCIES / "What I bring"). The worker splits the table by row
        // at each row_pages increase, repeating the header (proven manual path),
        // so a row that auto-overflows in the preview is cut to the next page in
        // the export too, with no row duplication or loss.
        const _manualRp = (s.id && itemPagesMap && typeof itemPagesMap[s.id] === 'object') ? itemPagesMap[s.id] : null;
        const _autoRp = (s.id && autoPagesRaw && typeof autoPagesRaw[s.id] === 'object') ? autoPagesRaw[s.id] : null;
        let rowPages = null;
        if (_manualRp || _autoRp) {
          rowPages = {};
          if (_manualRp) for (const k in _manualRp) { const n = parseInt(_manualRp[k], 10); if (Number.isFinite(n) && n >= 2) rowPages[k] = Math.max(rowPages[k] || 0, n); }
          if (_autoRp)   for (const k in _autoRp)   { const n = parseInt(_autoRp[k], 10);   if (Number.isFinite(n) && n >= 2) rowPages[k] = Math.max(rowPages[k] || 0, n); }
          if (!Object.keys(rowPages).length) rowPages = null;
        }
        // WIB-TABLE-DIMS-001 (owner 2026-06-14, backlog item 5): the WHAT I BRING
        // table (and CV Core Competencies) exported at the worker's DEFAULT width
        // / column split because the per-section dimensions the user dragged in
        // the preview were NEVER forwarded. The worker reads s.tableWidth (DXA)
        // and s.tableRatio per section (renderCompetencyTable) — attach them here.
        // Width comes from stylePrefs.tableWidthPct[id] (non-default only, same
        // default-DXA mapping as computeTableWidthDxa); ratio from the doc-level
        // clTableRatio ("bring"/CL) or cvTableRatio (CV). An explicit value
        // already on the section still wins.
        let _twDxa, _tRatio;
        try {
          // TABLE-WIDTH-CLOBBER-001: read the standalone width map (survives the
          // personalInfo cloud-restore rewrites); fall back to the legacy nested
          // location. Shared with computeTableWidthDxa via readTableWidthPctMap.
          const _pctMap = readTableWidthPctMap();
          const _isClTable = s.id === 'bring';
          const _pct = _pctMap[s.id];
          if (typeof _pct === 'number' && isFinite(_pct) && Math.abs(_pct - (_isClTable ? 90 : 100)) >= 1) {
            _twDxa = Math.round((_isClTable ? 11506 : 6630) * (_pct / 100)); // CL ref = usable body width (PAGE_W-400), matches preview + worker defaultClW
          }
          const _rk = _isClTable ? 'clTableRatio' : 'cvTableRatio';
          let _rRaw = (typeof localStorage !== 'undefined') ? localStorage.getItem(_rk) : null;
          if (_rRaw != null) { try { const _p = JSON.parse(_rRaw); if (typeof _p === 'number') _rRaw = _p; } catch (_) {} }
          const _rNum = Number(_rRaw);
          if (isFinite(_rNum) && _rNum > 0.05 && _rNum < 0.95) _tRatio = _rNum;
        } catch (_) {}
        if (typeof s.tableWidth === 'number' && s.tableWidth > 0) _twDxa = s.tableWidth;
        if (typeof s.tableRatio === 'number' && s.tableRatio > 0.05 && s.tableRatio < 0.95) _tRatio = s.tableRatio;
        return {
          ...base,
          rows: Array.isArray(s.rows) ? s.rows.map(r => Array.isArray(r) ? r.map(String) : []) : [],
          ...(s.hidden ? { hidden: s.hidden } : {}),
          ...(rowPages ? { row_pages: rowPages } : {}),
          ...(_twDxa !== undefined ? { tableWidth: _twDxa } : {}),
          ...(_tRatio !== undefined ? { tableRatio: _tRatio } : {}),
        };
      }

      case 'experience': {
        // 1.50.298 — RE-INSTATE the effective role-page forwarding (reverts the
        // 1.50.297 walk-back). Owner 2026-06-08: removing the forced break also
        // removed the "EXPERIENCE (CONT.)" heading on page 2 — the worker's
        // repeated section tblHeader only repeats the bare title, it cannot append
        // "(Cont.)" on the continuation. The role.page path (worker 1.50.286) is
        // the ONLY mechanism that produces the "(Cont.)" heading, so it must stay.
        // The real defect is PREVIEW LINE DRIFT: the preview measures fewer lines
        // per paragraph than Word renders, so the auto break (and thus the
        // "(Cont.)") lands one role too late. That is being fixed in the MEASURER
        // (match preview heights to Word), NOT by dropping the export break.
        // EFFECTIVE role page = max(manual role.page, auto autoPages[origIdx]) with
        // a monotonic cascade; auto key is the ORIGINAL index in the unfiltered roles.
        const allRoles = Array.isArray(s.roles) ? s.roles : [];
        const autoR = (s.id && autoPagesRaw && typeof autoPagesRaw[s.id] === 'object') ? autoPagesRaw[s.id] : null;
        let runPage = 1;
        const roles = allRoles.filter(r => r && r.on !== false).map(r => {
          const oi = allRoles.indexOf(r);
          let pg = Math.max(1, parseInt((r && r.page) || 1, 10) || 1);
          if (autoR) {
            const ap = parseInt(autoR[String(oi)], 10);
            if (Number.isFinite(ap) && ap >= 1) pg = Math.max(pg, ap);
          }
          if (pg < runPage) pg = runPage; else runPage = pg;
          return {
            id: r.id || '',
            title: r.title || '',
            company: r.company || '',
            years: r.years || '',
            bullets: Array.isArray(r.bullets) ? r.bullets.map(String).filter(Boolean) : [],
            ...(pg >= 2 ? { page: pg } : {}),
            // OUTCOMES-MODE-001: per-role results line (set by
            // applyOutcomesMode when the display mode is 'results').
            ...(typeof r.results === 'string' && r.results.trim()
              ? { results: r.results.trim() }
              : {}),
          };
        });
        return { ...base, roles };
      }

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
  }).filter(ps => {
    // PLACEHOLDER-EXPORT-GUARD-001: drop a text/text_inline section that is
    // empty after placeholder-stripping (e.g. an unfilled WHY THIS POSITION
    // whose generated content came back empty) so the exported document shows
    // neither the "[WHY THIS POSITION — …]" placeholder nor an orphan heading.
    if (ps && (ps.type === 'text' || ps.type === 'text_inline')) {
      return !!String(ps.content || '').trim();
    }
    return true;
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
  // ROLE-FOUNDER-001: keep "Founder"/"Co-Founder" out of the FILENAME too (a
  // genuine independent-consultancy label is left intact).
  const roleRaw = (() => {
    const v = String(meta.role || '');
    if (/\b(konsulent|consult|independent)\b/i.test(v)) return v;
    return v.replace(/\bco[-\s]?founder\b/gi, '').replace(/\bfounder\b/gi, '')
      .replace(/^[\s&/,|:–—-]+/, '').replace(/[\s&/,|:–—-]+$/, '').replace(/\s{2,}/g, ' ').trim();
  })();
  const role = roleRaw ? '_' + slug(roleRaw, 30) : '';
  const lang = language === 'da' ? '_Dansk' : '';
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `${doc === 'cv' ? 'CV' : 'CoverLetter'}_${name}${company}${role}${lang}_${date}`;
}

// OUTCOMES-MODE-001 export half (1.50.393 / worker 1.14.59): when the
// display mode is 'results' (localStorage outcomesMode, set by the outcomes
// editor selector), the export mirrors the preview — the SELECTED OUTCOMES
// section is dropped from the payload and each visible experience role gets
// a `results` string holding its matched outcomes (title/company token
// overlap; unmatched outcomes attach to the first visible role). The worker
// renders it as a "Results:" line after the role's bullets.
// RESULTS-METRIC-RANK-001 (owner 2026-06-18: "sort by SIZE - 250 to 10 is more
// impressive than 3400 out of 3600"). Score a result by the IMPRESSIVENESS of its
// metric, not just "has a number", so the strongest outcome leads the Results line:
//   - "A to B" reduction/range -> the ratio max/min ("250 to 10" = 25)
//   - "Nx" / "N×" / "N-fold" multiplier -> N
//   - "N%" in a reduce/cut/increase context -> a delta multiplier 100/(100-N) (90% = 10)
//   - "X of Y" / "X out of Y" / "X/Y" -> the FRACTION (completeness, <=1, low: 3400/3600 = 0.94)
//   - a bare number -> a small log baseline (beats no-number)
export const _metricScore = (text) => {
  // STD-CODE-NOT-METRIC-001 (owner 2026-06-19): a compliance/standard CODE number
  // (ISO 26262, ISO/SAE 21434, ISO 9001, IEC 61508, EN 50128, MIL-STD-810G,
  // STANAG 4694, SAE J3016, ASPICE) is NOT a result metric — strip the code + its
  // digits before scoring so a standard line never wins the numeric Results sort.
  const t = String(text == null ? '' : text)
    .replace(/\b(?:ISO|IEC|EN|DIN|MIL[-\s]?STD|STANAG|ASPICE|SAE)(?:\s*\/\s*(?:ISO|IEC|SAE|EN))*[\s\/-]*[A-Z]?\d[\d.\-:]*[A-Z]?\b/gi, ' ');
  let best = 0, m;
  // allow up to 2 short words in the gap ("250 days to about 10")
  const re1 = /([\d][\d,.]*)\s*(?:[a-z%]+\s+){0,2}(?:to|->|→|–|—)\s+(?:[a-z]+\s+){0,2}([\d][\d,.]*)/gi;
  while ((m = re1.exec(t))) { const a = parseFloat(m[1].replace(/,/g, '')), b = parseFloat(m[2].replace(/,/g, '')); if (a > 0 && b > 0) { const r = Math.max(a, b) / Math.min(a, b); if (r > best) best = r; } }
  const re2 = /([\d][\d,.]*)\s*(?:×|x\b|-fold|fold)/gi;
  while ((m = re2.exec(t))) { const n = parseFloat(m[1].replace(/,/g, '')); if (n > best) best = n; }
  const re3 = /([\d.]+)\s*%/g;
  while ((m = re3.exec(t))) { const p = parseFloat(m[1]); if (/reduc|cut|sav|less|few|down|short|increas|faster|improv|gain|grow|boost/i.test(t)) { const mult = (p > 0 && p < 100) ? 100 / (100 - p) : 1; if (mult > best) best = mult; } else if (p / 20 > best) best = p / 20; }
  const re4 = /([\d][\d,.]*)\s*(?:of|out of|\/)\s*([\d][\d,.]*)/gi;
  while ((m = re4.exec(t))) { const x = parseFloat(m[1].replace(/,/g, '')), y = parseFloat(m[2].replace(/,/g, '')); if (x > 0 && y > 0) { const f = x / y; if (f <= 1.0001 && f > best) best = f; } }
  if (best === 0) { const nums = (t.match(/[\d][\d,.]*/g) || []).map((s) => parseFloat(s.replace(/,/g, ''))).filter((n) => n > 0); if (nums.length) best = Math.min(1.5, Math.log10(Math.max.apply(null, nums) + 1)); }
  return best;
};
// TENSE-AT-LAMINATION-001 (owner 2026-06-19: "I want the tense the user chose to be
// the generated tense — the app already takes too much work time"). Generation already
// writes bullets/outcomes in the chosen tense via the prompt's __tenseRule; but a
// role's laminated RESULTS come from the KERNEL outcomes/proof-points, which keep the
// kernel's tense. Re-tensing them HERE — inside the lamination pass that already runs
// for preview + export — keeps the chosen tense without a separate runtime sidecar.
const _T_B2P = { own: 'owned', build: 'built', run: 'ran', design: 'designed', drive: 'drove', deliver: 'delivered', implement: 'implemented', establish: 'established', ship: 'shipped', reduce: 'reduced', cut: 'cut', scale: 'scaled', map: 'mapped', translate: 'translated', coordinate: 'coordinated', negotiate: 'negotiated', resolve: 'resolved', investigate: 'investigated', validate: 'validated', qualify: 'qualified', author: 'authored', chair: 'chaired', guide: 'guided', mentor: 'mentored', restructure: 'restructured', initiate: 'initiated', configure: 'configured', specify: 'specified', direct: 'directed', supervise: 'supervised', architect: 'architected', lead: 'led', manage: 'managed', develop: 'developed', create: 'created', launch: 'launched', improve: 'improved', increase: 'increased', secure: 'secured', oversee: 'oversaw', define: 'defined', support: 'supported', maintain: 'maintained', test: 'tested', present: 'presented', review: 'reviewed', plan: 'planned', set: 'set', put: 'put', hit: 'hit', optimize: 'optimized', optimise: 'optimised', streamline: 'streamlined', head: 'headed', handle: 'handled', perform: 'performed', conduct: 'conducted', execute: 'executed', introduce: 'introduced', migrate: 'migrated', automate: 'automated' };
const _T_P2B = {}; for (const k in _T_B2P) _T_P2B[_T_B2P[k]] = k;
function _tenseLead(text, mode) {
  if ((mode !== 'present' && mode !== 'past') || typeof text !== 'string' || !text) return text;
  const m = text.match(/^(\s*(?:<[^>]+>\s*|\*{1,2}\s*)*)([A-Za-z]+)/);
  if (!m) return text;
  const prefix = m[1], word = m[2], lw = word.toLowerCase();
  let repl = mode === 'past' ? _T_B2P[lw] : _T_P2B[lw];
  if (!repl || repl === lw) return text;
  if (word[0] === word[0].toUpperCase()) repl = repl.charAt(0).toUpperCase() + repl.slice(1);
  return prefix + repl + text.slice(prefix.length + word.length);
}
function _expTenseMode() {
  try { const sc = JSON.parse(localStorage.getItem('styleConfig') || '{}') || {}; return sc.expTense || (sc.expPastTense === true ? 'past' : 'auto'); }
  catch (_) { return 'auto'; }
}
export function applyOutcomesMode(docSections, doc) {
  try {
    if (doc !== 'cv' || !Array.isArray(docSections)) return docSections;
    const _tmode = _expTenseMode();
    const _tx = (s) => _tenseLead(s, _tmode);
    // OUTCOMES-MODE-PARITY-001 (owner 2026-06-14): mirror the PREVIEW default
    // EXACTLY (app.src.js __antcvOutcomesMode). An explicit user choice wins;
    // with NONE stored, Copenhagen Modern (incl. the 'scandinavian'/empty
    // aliases) defaults to 'results' and every other package to 'section'. The
    // export used to default to 'section' unconditionally, so on Copenhagen
    // Modern with no explicit setting the preview hid SELECTED OUTCOMES (per-role
    // Results) while the export still emitted the OUTCOMES block — a parity gap.
    let mode;
    const rawMode = localStorage.getItem('outcomesMode');
    if (rawMode != null) {
      let v = rawMode;
      try { const p = JSON.parse(rawMode); if (typeof p === 'string') v = p; } catch (_) {}
      mode = v === 'results' ? 'results' : 'section';
    } else {
      let pkg = '';
      try {
        const p = JSON.parse(localStorage.getItem('stylePackage') || '""');
        pkg = (typeof p === 'string' ? p : '').toLowerCase().trim();
      } catch (_) {}
      if (pkg === 'scandinavian' || pkg === '') pkg = 'copenhagen-modern';
      mode = pkg === 'copenhagen-modern' ? 'results' : 'section';
    }
    if (mode !== 'results') return docSections;
    const isOutcomes = (s) => s &&
      (/^(outcomes|selected_outcomes)$/.test(String(s.id || '')) ||
       /SELECTED OUTCOMES/i.test(String(s.title || '')));
    const so = docSections.find(isOutcomes);
    const exp = docSections.find((s) => s && s.type === 'experience');
    if (!so || !exp || !Array.isArray(so.items) || !so.items.length) return docSections;
    const tok = (str) => String(str || '').toLowerCase().match(/[a-zà-ɏ]{4,}/g) || [];
    const txtOf = (x) => typeof x === 'string' ? x : (((x && x.b) || '') + ' ' + ((x && x.t) || '')).trim();
    const lineOf = (x) => typeof x === 'string' ? x : [x && x.b, x && x.t].filter(Boolean).join(' ').trim();
    const visRoles = (exp.roles || []).filter((r) => r && r.on !== false);
    if (!visRoles.length) return docSections;
    // RESULTS-CROSSROLE-BLEED-002 (owner 2026-06-19): score a candidate outcome not
    // only against a role's title/company but against that role's OWN KERNEL outcomes
    // (personalInfo.workHistory[].outcomes), populated below. The kernel is the ground
    // truth for "true home": a generated outcome that paraphrases another role's kernel
    // outcome (e.g. the Sirin 7-person / Sigma-Connectivity ODM / Sweden work) then
    // scores highest on THAT role, so the global-best-home rule below resolves it to its
    // real home — which, being already laminated, DROPS it instead of bleeding it onto
    // an unrelated available role (the Meprolight Team Leader bleed). Keyed by role id
    // AND a title|company signature so it works whether or not generated ids match.
    const _koById = {}, _koByName = {};
    const _nameKey = (r) => r ? (tok(r.title).join(' ') + '|' + tok(r.company).join(' ')) : '';
    const tokensFor = (r) => {
      const base = new Set(tok(r.title).concat(tok(r.company)));
      const ko = (r && r.id != null && _koById[String(r.id)]) || _koByName[_nameKey(r)];
      if (ko) ko.forEach((w) => base.add(w));
      return base;
    };
    // OUTCOMES-RESULTS-EXPORT-PARITY-001 (owner 2026-06-14): the export half was
    // still the OLD bucketing (no dedup, no cap, unmatched → first role), so the
    // exported Results were long, repetitive, not role-specific, and starved the
    // page-1 roles. Mirror the preview fix (1.50.447): dedup vs the role's own
    // bullets, best-match, cap each role at 2, spill overflow + unmatched into the
    // EMPTIEST roles first (so the first roles are never starved), and a length
    // budget so each Results line stays ≤ ~2 lines.
    let pno = '';
    const _ppText = {};
    try {
      const _pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
      const _piRoot = _pi.personalInfo ? _pi.personalInfo : _pi;
      pno = String(_piRoot.patentNumber || '').trim().toLowerCase();
      // RESULTS-LAMINATION-001 (owner 2026-06-15): build a proof-point id -> text
      // map from the master profile so a role's Results line can come from its OWN
      // proofPointIds (deterministic), not the heuristic SELECTED-OUTCOMES spread.
      [].concat(_piRoot.proofPointsByRole || [], _piRoot.proofPointsByPosition || [])
        .forEach((p) => { if (p && p.id && typeof p.text === 'string') _ppText[p.id] = p.text; });
      // RESULTS-CROSSROLE-BLEED-002: per-role kernel-outcome token sets, keyed by
      // role id AND title|company signature (workHistory/experience/roles aliases;
      // an outcome may be a string or {title,result}/{b,t}).
      const _koText = (o) => typeof o === 'string' ? o : (o ? String((o.result || o.title || '') + ' ' + (o.b || '') + ' ' + (o.t || '')).trim() : '');
      [].concat(_piRoot.workHistory || [], _piRoot.experience || [], _piRoot.roles || [])
        .forEach((r) => {
          if (!r || !Array.isArray(r.outcomes) || !r.outcomes.length) return;
          const set = new Set();
          r.outcomes.forEach((o) => tok(_koText(o)).forEach((w) => set.add(w)));
          if (!set.size) return;
          if (r.id != null) { const k = String(r.id); if (!_koById[k]) _koById[k] = new Set(); set.forEach((w) => _koById[k].add(w)); }
          const nk = tok(r.title).join(' ') + '|' + tok(r.company).join(' ');
          if (nk !== '|') { if (!_koByName[nk]) _koByName[nk] = new Set(); set.forEach((w) => _koByName[nk].add(w)); }
        });
    } catch (_) {}
    // Per-role LAMINATED results: explicit role.results wins; else resolve the
    // role's proofPointIds against the master-profile proof points. Roles with
    // neither fall through to the token-match distribution below.
    // JD-aware visibility: a role.outcomes item with defaultVisible:false is shown
    // only when the current JD contains one of its visibilityRule.showWhenJDContainsAny
    // terms. The app mirrors the active JD into localStorage 'antcv:lastJdText'.
    let _jd = '';
    try { _jd = String(localStorage.getItem('antcv:lastJdText') || '').toLowerCase(); } catch (_) {}
    const _outcomeVisible = (o) => {
      if (typeof o === 'string') return true;
      if (!o) return false;
      if (o.defaultVisible !== false) return true;
      const terms = (o.visibilityRule && Array.isArray(o.visibilityRule.showWhenJDContainsAny))
        ? o.visibilityRule.showWhenJDContainsAny : [];
      return !!_jd && terms.some((t) => t && _jd.includes(String(t).toLowerCase()));
    };
    const _lam = new Map();
    const _capJoin = (texts) => {
      let t = texts.slice(0, 2).join('; ');
      if (t.length > 260) t = t.slice(0, 257).replace(/[;,\s]+\S*$/, '') + '…';
      return t;
    };
    visRoles.forEach((r) => {
      // 1) explicit role.results string wins verbatim.
      if (typeof r.results === 'string' && r.results.trim()) { _lam.set(r, r.results.trim()); return; }
      // 2) self-contained role.outcomes[] (owner's 'outcome_edits' lists): use the
      //    DEFAULT-VISIBLE items only — JD-gated hidden ones (defaultVisible:false)
      //    stay hidden in a non-JD export.
      if (Array.isArray(r.outcomes) && r.outcomes.length) {
        const texts = r.outcomes
          .filter(_outcomeVisible)
          // LAM-RESULTS-001 (2026-06-18): the v2 kernel outcome shape is
          // {title,result,numeric} — read o.result; keep the v1 {b,t} path.
          .map((o) => (typeof o === 'string' ? o.trim()
            : (o.result ? String(o.result).trim() : [o.b, o.t].filter(Boolean).join(' ').trim())))
          .filter(Boolean);
        // RESULTS-NUMERIC-LEAD-001 (owner 2026-06-18: "you keep avoiding numerical
        // results"). tier-2/3 joined outcomes in STORED order, so a numeric result
        // could sit behind prose and get cut by the cap. Lead with the quantified
        // ones (digits / % / × / "x") so the number always survives + reads first.
        texts.sort((p, q) => _metricScore(q) - _metricScore(p));
        if (texts.length) { _lam.set(r, _capJoin(texts)); return; }
      }
      // 3) role.proofPointIds resolved against the master-profile proof points,
      //    OR the v2 kernel's flat role.proofPoints[] (strings) — so an
      //    outcome-less v2 role laminates from its OWN evidence instead of a
      //    token-matched (wrong-role) SELECTED OUTCOME (LAM-RESULTS-001).
      const ids = Array.isArray(r.proofPointIds) ? r.proofPointIds : [];
      let texts = ids.map((id) => _ppText[id]).filter(Boolean);
      if (!texts.length && Array.isArray(r.proofPoints) && r.proofPoints.length)
        texts = r.proofPoints.map((p) => (typeof p === 'string' ? p.trim() : String((p && (p.text || p.result)) || '').trim())).filter(Boolean);
      texts.sort((p, q) => _metricScore(q) - _metricScore(p)); // RESULTS-NUMERIC-LEAD-001
      if (texts.length) _lam.set(r, _capJoin(texts));
    });
    // The heuristic SELECTED-OUTCOMES distribution runs ONLY for roles that are
    // not already laminated, so the spill never gets wasted on a role that will
    // show its own proof points (which would starve a genuinely unlaminated role).
    const distRoles = visRoles.filter((r) => !_lam.has(r));
    const isPatent = (x) => { const s = txtOf(x).toLowerCase(); return /\bpatent\b/.test(s) || (pno && s.indexOf(pno) >= 0); };
    const bulletSigs = [];
    visRoles.forEach((r) => (Array.isArray(r.bullets) ? r.bullets : []).forEach((bl) => {
      const bt = tok(typeof bl === 'string' ? bl : ((bl && (bl.b || bl.t)) || ''));
      if (bt.length) bulletSigs.push(new Set(bt));
    }));
    const echoes = (x) => {
      const ts = tok(txtOf(x)); if (!ts.length) return false;
      return bulletSigs.some((sig) => { let m = 0; ts.forEach((w) => { if (sig.has(w)) m++; }); return m >= Math.max(3, Math.ceil(0.7 * ts.length)); });
    };
    // OUTCOME-SEED-UNION-001 (owner 2026-06-16): the `echoes` filter exists to drop
    // a SELECTED OUTCOME that merely re-states a bullet. But the bullet FALLBACK
    // intentionally seeds an outcome FROM a role's bullet (for a role with no proof
    // points) and pins it via the map — that one must survive `echoes` and laminate
    // (the dedup-hide below then removes the duplicate source bullet). So an outcome
    // with an explicit map entry bypasses `echoes`.
    let oroMapEarly = {};
    try { oroMapEarly = JSON.parse(localStorage.getItem('antcv:outcomeRoleMap') || '{}') || {}; } catch (_) {}
    const isMappedOutcome = (x) => x && x._oid != null && oroMapEarly[x._oid] != null;
    const pool = so.items.filter(Boolean).filter((x) => !isPatent(x) && (isMappedOutcome(x) || !echoes(x)));
    if (!pool.length) return docSections.filter((s) => !isOutcomes(s));
    const assign = distRoles.map(() => []);
    const left = [];
    const distIdx = new Map(); distRoles.forEach((r, i) => distIdx.set(r, i));
    // OUTCOME-ROLE-SELECT-001 (owner 2026-06-16): the SELECTED OUTCOMES editor's
    // per-row role selector writes an EXPLICIT outcome→role map
    // (antcv:outcomeRoleMap = { [outcome _oid]: roleId }). An explicit assignment
    // WINS over the token-match heuristic below — the user pins each outcome to a
    // specific position, eliminating the "random"/best-guess distribution. Inert
    // until the selector UI stamps _oid + writes the map.
    const oroMap = oroMapEarly;
    const roleById = new Map(); visRoles.forEach((r) => { if (r && r.id != null) roleById.set(String(r.id), r); });
    // OUTCOMES-RESULTS-BESTMATCH-001 (owner 2026-06-14) + RESULTS-CROSSROLE-BLEED-001
    // (owner 2026-06-16: a "LiDAR" outcome attached to the Sirin role, which had no
    // LiDAR). For an UNMAPPED outcome, compare against ALL visible roles — not just
    // the still-unlaminated ones — and laminate it onto a role ONLY when that role
    // is its GLOBAL best home. An outcome whose true home is an already-laminated
    // role no longer bleeds onto an unrelated available role (it's dropped, not
    // forced onto the best AVAILABLE role). Tie → earliest role.
    pool.forEach((x) => {
      const oid = x && x._oid;
      const mapped = (oid != null && oroMap[oid] != null) ? roleById.get(String(oroMap[oid])) : null;
      if (mapped && distIdx.has(mapped)) { assign[distIdx.get(mapped)].push(x); return; }
      const ts = tok(txtOf(x));
      let bestRole = null, best = 0;
      for (const r of visRoles) { const tf = tokensFor(r); let m = 0; ts.forEach((w) => { if (tf.has(w)) m++; }); if (m > best) { best = m; bestRole = r; } }
      if (bestRole && best > 0 && distIdx.has(bestRole)) assign[distIdx.get(bestRole)].push(x);
      else left.push(x);
    });
    // OUTCOMES-RESULTS-COVERAGE-001 (owner 2026-06-15, mirror of preview):
    // coverage-first then double — retention cap 1 (each role keeps one before any
    // doubles), then pass 0 covers every still-empty role, pass 1 gives a 2nd to
    // strong roles. 1–2 results per role, every role first.
    // RESULTS-LAMINATION-001 (owner 2026-06-15): keep only GENUINE best-matches
    // (capped), and do NOT random-spill unmatched outcomes onto unrelated roles —
    // that was the "random distribution" the owner rejected. A role with no true
    // match derives from its OWN bullets (tier-3, below) instead. `left` (the
    // unmatched outcomes) is intentionally dropped here.
    const MAX = 2;
    // RESULTS-NUMERIC-FAVOR-001 (owner 2026-06-16: "numeric results are
    // favoured" — 250→10 days, 90% cost, 30% portfolio). Lead with + keep the
    // outcomes carrying a concrete metric (number/%/×/count) so a quantified
    // result survives the per-role cap and shows first.
    // RESULTS-METRIC-RANK-001: rank by metric IMPRESSIVENESS, not just has-a-number.
    assign.forEach((a) => { a.sort((p, q) => _metricScore(txtOf(q)) - _metricScore(txtOf(p))); while (a.length > MAX) a.pop(); });
    const resultsByRole = new Map();
    distRoles.forEach((r, i) => {
      if (!assign[i].length) return;
      let txt = assign[i].map(lineOf).join('; ');
      // RESULTS-CUT-001 (owner 2026-06-14): the 180-char cap was lopping the end
      // of concrete results with a trailing "…". Raised to 260 so a single
      // outcome or a typical 2-outcome pair survives whole; only a genuinely
      // over-long line is trimmed (on a word boundary, no mid-word cut).
      if (txt.length > 260) txt = txt.slice(0, 257).replace(/[;,\s]+\S*$/, '') + '…';
      resultsByRole.set(r, txt);
    });
    // RESULTS-LAMINATION-003 (owner 2026-06-15): a role's Results line is a REAL
    // outcome via tiers 1-4 (explicit role.results / role.outcomes[] /
    // proofPointIds / a GENUINE token-matched SELECTED OUTCOME). Owner verified
    // his master profile carries ≥1 real outcome per position, so tiers 1-4 cover
    // every active role and the derive tier below is a rare last resort. When tiers
    // 1-4 ALL find nothing, derive the result from the role's OWN strongest bullet
    // (prefer a numeric/metric one, patent filtered) — but then REMOVE that bullet
    // from the role so the same line is NOT shown twice (owner: "the bullet it came
    // from has to be hidden"). deriveResultFromRole returns the chosen bullet INDEX
    // so the source bullet can be dropped.
    const deriveResultFromRole = (r) => {
      const bl = Array.isArray(r.bullets) ? r.bullets : [];
      const textOf = (b) => String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '').trim();
      let bestIdx = -1, bestScore = -1;
      for (let i = 0; i < bl.length; i++) {
        const t = textOf(bl[i]);
        if (!t || t.length < 12) continue;
        if (/\bpatent\b/i.test(t) || (pno && t.toLowerCase().indexOf(pno) >= 0)) continue;
        // prefer a bullet carrying a concrete metric (number, %, x, count, range)
        const hasNum = /\d|%|\bx\b|×/.test(t);
        const score = (hasNum ? 1000 : 0) + Math.min(t.length, 240);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      if (bestIdx < 0) return null;
      let txt = textOf(bl[bestIdx]);
      if (txt.length > 260) txt = txt.slice(0, 257).replace(/[;,\s]+\S*$/, '') + '…';
      return { text: txt, index: bestIdx };
    };
    // OUTCOME-SEED-UNION-001 (owner 2026-06-16, refined): dedup-hide is
    // BULLET-DERIVED-ONLY and NON-DESTRUCTIVE. Rule (owner): if a role has no real
    // outcome and a bullet is seeded into its Results, HIDE that source bullet (don't
    // show it twice). But if the role has a REAL outcome (tiers 1-4 / _lam) — which
    // is preferred and is usually the better/numeric one — the real outcome is the
    // Results line and every bullet is EXPOSED (the bullet-derived candidate simply
    // is not used). So we only hide a bullet when the WINNING result is itself
    // bullet-derived (the pool/derive paths), never for a real-outcome result.
    // "Hide" omits the bullet from the EXPORT render only; the stored sections in
    // localStorage are never mutated, so nothing is deleted and it is reversible.
    const normLine = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const hideSubsumed = (role, resultsText) => {
      const nr = normLine(resultsText);
      if (!nr) return Array.isArray(role.bullets) ? role.bullets : [];
      return (Array.isArray(role.bullets) ? role.bullets : []).filter((b) => {
        const nb = normLine(typeof b === 'string' ? b : (b && (b.b || b.t)) || '');
        return !(nb.length >= 15 && nr.indexOf(nb) >= 0);
      });
    };
    const expOut = {
      ...exp,
      roles: (exp.roles || []).map((r) => {
        // tiers 1-4 — a REAL outcome wins and ALL bullets stay exposed.
        // _tx() re-tenses the leading verb to the user's chosen tense (no-op for 'auto').
        const lam = _lam.get(r);
        if (lam) return { ...r, results: _tx(lam) };
        // pool / explicit-map distribution — may be a bullet-seeded outcome, so hide
        // a bullet only when the result text subsumes it (i.e. it IS that bullet).
        if (resultsByRole.has(r)) { const rt = resultsByRole.get(r); return { ...r, results: _tx(rt), bullets: hideSubsumed(r, rt) }; }
        // tier-5 derive — the Results line IS one of the role's bullets; hide that
        // one source bullet (export render only; stored data untouched).
        const d = deriveResultFromRole(r);
        if (!d) return r;
        const keptBullets = (Array.isArray(r.bullets) ? r.bullets : []).filter((_, i) => i !== d.index);
        return { ...r, results: _tx(d.text), bullets: keptBullets };
      }),
    };
    return docSections.filter((s) => !isOutcomes(s)).map((s) => (s === exp ? expOut : s));
  } catch (_) { return docSections; }
}
// RESULTS-PREVIEW-EXPORT-SINGLE-SOURCE-001 (owner 2026-06-17): the preview Results
// must equal the export Results on EVERY role. Two copies of the distribution
// (preview token-spread vs this one) drifted — explicit role-map, drop-unmatched,
// numeric-favour and the derive-from-bullet tier landed here but not in the preview.
// Expose THIS function so the preview computes its per-role Results by running the
// exact same code (it deep-copies its sections, calls this, reads role.results) —
// single source of truth, no second algorithm to keep in sync.
try { if (typeof window !== 'undefined') window.AntcvApplyOutcomesMode = applyOutcomesMode; } catch (_) {}

function triggerDownload(blob, filename) {
  // 1.50.380 EXPORT-PREVIEW-FEATURES-001(b) — choose the download location.
  // Opt-in via localStorage 'antcv:askSaveLocation' = '1' (the export modal
  // exposes the toggle): the File System Access save picker lets the user
  // pick folder + name. Default stays the classic instant download; the
  // picker also falls back to it on any error EXCEPT a user cancel (a
  // cancelled save must not silently download anyway).
  let ask = false;
  try { ask = localStorage.getItem('antcv:askSaveLocation') === '1'; } catch (_) {}
  if (ask && typeof window.showSaveFilePicker === 'function') {
    const ext = (/\.[a-z0-9]+$/i.exec(filename) || ['.docx'])[0].toLowerCase();
    const types = ext === '.pdf'
      ? [{ description: 'PDF document', accept: { 'application/pdf': ['.pdf'] } }]
      : [{ description: 'Word document', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }];
    window.showSaveFilePicker({ suggestedName: filename, types })
      .then(async (handle) => {
        const w = await handle.createWritable();
        await w.write(blob);
        await w.close();
      })
      .catch((e) => {
        if (e && e.name === 'AbortError') return; // user cancelled — done
        try { console.warn('[docx-client] save picker failed, falling back:', e && e.message); } catch (_) {}
        legacyDownload(blob, filename);
      });
    return;
  }
  legacyDownload(blob, filename);
}

function legacyDownload(blob, filename) {
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
  // BYOK CloudConvert: forward the user's own CloudConvert key so the worker uses
  // it instead of the shared/server key (the app only calls this path for BYOK
  // when the user HAS a key; demo + own-worker use the worker's own key).
  try {
    let cc = '';
    if (typeof localStorage !== 'undefined') {
      cc = localStorage.getItem('cloudconvertKey') || '';
      if (cc.startsWith('"') && cc.endsWith('"')) cc = cc.slice(1, -1);
    }
    cc = (cc || '').trim();
    if (cc) headers['X-CloudConvert-Key'] = cc;
  } catch (_) { /* localStorage may be disabled */ }

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
      // EXPORT-PDF-RACE-001 (owner 2026-06-18): the worker URL is configured
      // asynchronously (from the /config fetch). If the FIRST export click probes
      // before it is set, caching null here stuck the whole session on browser-print
      // PDF until a manual refresh. Return null TRANSIENTLY (no cache) so a later
      // click re-probes once the URL is available.
      return null;
    }
    const res = await fetch(workerUrl.replace(/\/$/, '') + '/health');
    if (!res.ok) {
      // Transient (cold start / outdated worker) — do not cache, retry next time.
      return null;
    }
    const j = await res.json();
    // Definitive answer from a reachable worker — safe to cache (positive OR a
    // genuine "reachable but no PDF" null).
    _pdfWorkerCache = j && j.pdf_via ? j.pdf_via : null;
    return _pdfWorkerCache;
  } catch (_e) {
    // Network error — transient, do not cache so a later click can succeed.
    return null;
  }
}

// Expose via window for easy access from app.js without bundler imports.
// Mirrors how exportDocxViaWorker is wired.
if (typeof window !== 'undefined') {
  window.exportPdfViaWorker = exportPdfViaWorker;
  window.isPdfWorkerAvailable = isPdfWorkerAvailable;
}
