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

// PHOTO-FLIP-001 (owner 2026-07-14): mirror the exported photo horizontally
// when the Flip control (off / on / auto) calls for it, so the DOCX/PDF matches
// the live preview's scaleX(-1). The effective decision is OWNED by the preview
// sidecar (antcv-photo-ui-427 MODULE D) and exposed as window.__antcvResolvePhotoFlipH;
// we use it when present and replicate the same pure rule as a fallback so the
// export is correct even if that sidecar hasn't booted yet.
export function resolveExportFlipH() {
  try {
    if (typeof window !== 'undefined' && typeof window.__antcvResolvePhotoFlipH === 'function') {
      return !!window.__antcvResolvePhotoFlipH();
    }
  } catch (_) { /* fall through to the local rule */ }
  try {
    if (typeof localStorage === 'undefined') return false;
    const readLS = (key, dflt) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null || raw === '') return dflt;
        let v = raw; try { const p = JSON.parse(raw); if (typeof p === 'string') v = p; } catch (_) {}
        return String(v).trim().toLowerCase();
      } catch (_) { return dflt; }
    };
    // PHOTO-FLIP-001 stores mode + detected facing in STANDALONE keys (they
    // survive Reset-all / cloud-restore), not personalInfo.stylePrefs.
    const mode = readLS('antcv:photoFlip', 'off');
    if (mode === 'on') return true;
    if (mode !== 'auto') return false;
    const facing = readLS('antcv:photoFacing', 'unknown');
    if (facing !== 'left' && facing !== 'right') return false;
    const pos = readLS('photoPosition', '');
    let desired;
    if (pos.indexOf('right') >= 0) desired = 'left';
    else if (pos.indexOf('left') >= 0) desired = 'right';
    else desired = readLS('sidebarPosition', 'left') === 'right' ? 'left' : 'right';
    return facing !== desired;
  } catch (_) { return false; }
}

// Mirror a photo data URL horizontally via canvas. Resolves to a NEW data URL,
// or the ORIGINAL on any failure — an export must never break over a flip.
export function flipPhotoDataUrlH(dataUrl) {
  return new Promise((resolve) => {
    try {
      if (!dataUrl || typeof document === 'undefined' || typeof Image === 'undefined') return resolve(dataUrl);
      const img = new Image();
      img.onload = function () {
        try {
          const w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          if (!w || !h) return resolve(dataUrl);
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) return resolve(dataUrl);
          ctx.translate(w, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        } catch (_) { resolve(dataUrl); }
      };
      img.onerror = function () { resolve(dataUrl); };
      img.src = dataUrl;
    } catch (_) { resolve(dataUrl); }
  });
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

// EXPORT-PREFLIGHT-ORPHANS-001 (owner 2026-07-03): one awaited call-out to the
// orphan-export-preflight sidecar with a hard 12s timeout and a no-op fallback.
// The sidecar mutates payload.sections in place (whole-string replacements), so a
// late resolution after the race simply misses this export — never corrupts it.
async function runOrphanPreflight(payload) {
  try {
    const pf = (typeof window !== 'undefined') && window.AntcvOrphanExportPreflight;
    if (!pf || typeof pf.run !== 'function') return;
    await Promise.race([
      Promise.resolve(pf.run(payload)).catch(() => null),
      new Promise((r) => setTimeout(r, 12000)),
    ]);
  } catch (_) { /* the export must never fail because of the preflight */ }
}

// PLACEHOLDER-EXPORT-GATE-001 (spec rule 38, owner 2026-07-04): a payload whose
// CORE COMPETENCIES / bring table rows are BRACKET PLACEHOLDERS ("[Focus area 1]",
// "[Strategic expertise - 1 or 2 lines]") is a FAILED generation snapshot — the
// owner exported one without noticing. Detect it and ask before exporting; a
// declined confirm throws so the caller shows the message. Detection is table
// rows only (the loudest failure class); >=2 placeholder rows = placeholder
// table. Kill: localStorage['antcv:disable-placeholder-gate']='1'.
//
// CL-SKELETON-EXPORT-GATE-001 (owner 2026-07-05, live report — a real Open
// Application Cover Letter PDF shipped with the raw TEMPLATE-STRUCT-DEFAULT-001
// skeleton verbatim, "Dear [Hiring Team / Name]," and all). Root cause traced:
// CL-HYDRATE-EXPORT-GATE-001 above already rescues a placeholder CL section
// from the prose-loss guard bucket or meta.opening/greeting — but that guard
// bucket is DELIBERATELY never populated for Unsolicited apps
// (CL-PROSE-UNSOL-POISON-001 in antcv-cl-prose-loss-guard-985.js, to stop a
// prior company's prose leaking into a later unsolicited one), so an
// unsolicited CL whose generation failed/raced has NO rescue path for why/who/
// foundation/bring/contribute/closure and ships the raw skeleton silently.
// Rather than touch that guard's gating (real risk of reintroducing the
// cross-contamination bug it was built to stop) or invent generation-recovery
// logic, this extends the SAME already-shipped, owner-approved pattern above:
// detect the failure loudly and let the user decide, instead of silently
// mailing a broken cover letter to a real employer. Reuses hydrateClProse's
// own placeholder/prose-extraction helpers (defined below; function
// declarations are hoisted) so detection can never drift from what the
// hydration gate already tried and failed to fix. Kill:
// localStorage['antcv:disable-placeholder-gate']='1' (shared switch — this is
// the same feature family).
function placeholderGate(payload) {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('antcv:disable-placeholder-gate') === '1') return;
    const secs = (payload && payload.sections) || [];
    const isPh = (v) => /^\s*\[[^\]]{2,80}\]\s*$/.test(String(v == null ? '' : v));
    let phTables = 0;
    for (const s of secs) {
      if (!s || !Array.isArray(s.rows) || s.rows.length < 2) continue;
      const body = s.rows.slice(1);
      const phRows = body.filter((r) => Array.isArray(r) && r.length && r.every(isPh)).length;
      if (phRows >= 2) phTables++;
    }
    let phClSections = 0;
    if (payload && payload.doc === 'cl') {
      for (const s of secs) {
        if (!s || CL_HYDRATE_IDS.indexOf(String(s.id || '')) === -1) continue;
        if (_clPlaceholder(_clProseOf(s))) phClSections++;
      }
    }
    if (!phTables && !phClSections) return;
    const msg = phClSections
      ? 'This cover letter still contains PLACEHOLDER text (e.g. "Dear [Hiring Team / Name]") in ' + phClSections
        + ' section(s) — the generation did not complete. Export anyway?'
      : 'This document contains a PLACEHOLDER table ("[Focus area 1]" rows) — a failed/stale generation snapshot. Export anyway?';
    const ok = (typeof confirm === 'function') ? confirm(msg) : true;
    if (!ok) { const e = new Error('Export cancelled: placeholder content detected — regenerate first.'); e.placeholderGate = true; throw e; }
  } catch (e) { if (e && e.placeholderGate) throw e; /* detector errors never block */ }
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

  let photoDataUrl = await ensurePhotoDataUrl(photo);

  // PHOTO-FLIP-001 (owner 2026-07-14): mirror the exported photo when the Flip
  // control (or its AUTO orientation) calls for it, matching the preview's
  // scaleX(-1). Failure-safe: flipPhotoDataUrlH returns the original on any error.
  try {
    if (photoDataUrl && resolveExportFlipH()) {
      photoDataUrl = await flipPhotoDataUrlH(photoDataUrl);
    }
  } catch (_) { /* keep the original photo on any failure */ }

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

  // EXPORT-PREFLIGHT-ORPHANS-001 (owner 2026-07-03, orphans v2): measure runts in the
  // BUILT payload with EXPORT metrics and fix them in place (NBSP bind + one batched
  // LLM re-tighten) before the POST. Hard-bounded: the export proceeds with whatever
  // landed after 12s, and ANY preflight failure is swallowed — the export can never
  // hang or fail because of orphan control. Kill: antcv:disable-orphan-preflight.
  placeholderGate(payload);
  await runOrphanPreflight(payload);

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

// CHINA-LAYOUT-ZH-001 (owner 2026-07-09): a Chinese (zh) CV follows the 简历
// convention — the PROFILE pitch becomes 自我评价 at the END (not the top), and
// References/Recommendations are dropped. Guarded to zh + cv so every other
// language/doc is byte-unchanged. Sections keep their loc; the worker groups by
// loc, so moving PROFILE to the end of the array lands it at the bottom of the
// main column. Header subtitle already carries the 求职意向 line.
function applyChinaLayoutZh(sections, doc, language) {
  if (language !== 'zh' || doc !== 'cv' || !Array.isArray(sections) || !sections.length) return sections;
  const label = (s) => String((s && (s.title || s.id)) || '');
  const isProfile = (s) => s && (s.id === 'profile' || /^PROFILE$|^PROFIL$|个人简介|自我评价/i.test(label(s)));
  const isRefs = (s) => s && (s.id === 'references' || s.id === 'recommendations' || /REFERENCE|RECOMMENDATION|推荐人|REFERENCER|ANBEFALINGER/i.test(label(s).toUpperCase()));
  const kept = sections.filter((s) => !isRefs(s));
  const profiles = kept.filter(isProfile).map((s) => ({ ...s, title: '自我评价' }));
  const rest = kept.filter((s) => !isProfile(s));
  return [...rest, ...profiles];
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
  const docSections = sanitizeForExport(applyOutcomesMode(
    mergeHowContributeFromLocalStorage(
      hydrateClProse((sections && sections[doc]) || (Array.isArray(sections) ? sections : []), doc, meta),
      doc
    ),
    doc
  ), doc);

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
  // NAME-ALIGN-EXPORT-PARITY (row 33): the Name-line alignment set in the preview
  // lives in localStorage 'antcv:nameLineAlign' (written by antcv-name-align-fix.js),
  // which the HeaderInlineEditor prop does NOT carry. Read it as a fallback so a
  // centred/right Name exports aligned instead of defaulting center.
  const nameLineAlign = (() => {
    try {
      const v = String(localStorage.getItem('antcv:nameLineAlign') || '').toLowerCase();
      return (v === 'left' || v === 'center' || v === 'right' || v === 'justify') ? v : '';
    } catch (_) { return ''; }
  })();
  const align = {
    name:           (headerItemAlign && headerItemAlign.name)           || nameLineAlign || 'center',
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

  // CL-APP-SUBTITLE-NO-DOUBLE-COMPANY-001 (owner 2026-07-22): strip a trailing
  // "- <company>" from the role so the "Application: <role> — <company>" band never
  // doubles the employer (the scraped jd_role often bakes it into the position name).
  // Mirrors app.src.js __antcvSubtitleRoleCo so preview == export.
  const __stripRoleCo = (role, company) => {
    const c = String(company == null ? '' : company).trim();
    let r = String(role == null ? '' : role).trim();
    if (c) { const esc = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); r = r.replace(new RegExp('\\s*[-–—]\\s*' + esc + '\\s*$', 'i'), '').trim(); }
    return r;
  };

  // Cover letters use a synthesised "Application: <role> — <company>"
  // line in the candidate header band — it's the slot the CV uses for
  // its specialisation. The PWA preview generates this dynamically; the
  // worker just renders meta.subtitle as-is, so we have to synthesise
  // it here. Falls back to "Application: [role and company]" when both
  // role and company are empty so the band isn't blank.
  const subtitle = (() => {
    if (doc !== 'cl') {
      // CV-APPLICATION-LINE-001 (owner 2026-07-03, Anita demo): the CV header band
      // must carry the "Application: <role> — <company|Unsolicited>" line whenever a
      // role is known — the CL already synthesizes it, but the CV used the raw stored
      // subtitle (the positioning triad in fresh/demo sessions), so Anita's CV had no
      // Application line while her CL did. Gabriel's flow already stores the Application
      // line as the subtitle, so this synthesis is a no-op for him. A subtitle that
      // already reads "Application:/Ansøgning:" is kept verbatim.
      const stored = stripFounder(meta.subtitle || '');
      const cvRole = stripFounder((meta.role || '').trim());
      // CV-SPEC-OVER-APPLICATION-001 (owner 2026-07-13: "the specialization is
      // supposed to show in CVs, not the Application line"): a PRESENT stored
      // subtitle (the positioning/specialization triad) is kept verbatim; the
      // "Application: <role> — <company>" synthesis fires ONLY when the band
      // would otherwise be blank (CV-APPLICATION-LINE-001's real case — Anita's
      // fresh session had no stored subtitle). The CL band is unchanged.
      if (stored || !cvRole) return stored;
      const cvCo = (meta.company || '').trim();
      const isDA2 = (language === 'da');
      // SUBTITLE-ZH-001 (owner 2026-07-12): zh header furniture: 申请: prefix +
      // 主动申请 as the unsolicited label (UNSOL-PILLAR-LANG-001's zh variant),
      // so a Chinese CV band carries no English furniture.
      const isZH2 = (language === 'zh');
      const coLabel = cvCo && !/^(unsolicited|open application|n\/a)$/i.test(cvCo) ? cvCo : (isDA2 ? 'Uopfordret' : (isZH2 ? '主动申请' : 'Unsolicited'));
      return (isDA2 ? 'Ansøgning: ' : (isZH2 ? '申请: ' : 'Application: ')) + __stripRoleCo(cvRole, cvCo) + ' \u2014 ' + coLabel;
    }
    // CL-APP-SUBTITLE-HEADING-SWAP-001 (owner 2026-07-22): the CL header band now shows the
    // SPECIALISATION (like the CV), NOT the "Application: <role>" label. The per-app application
    // line moved UNDER THE SLOGAN — forwarded as meta.role/company and rendered by the worker
    // below the slogan. Mirrors the app preview (io.subtitle = personalInfo.specialization) so
    // preview == export. A stored subtitle that is itself an Application:/Ansøgning:/申请 label
    // is ignored in favour of the real specialisation.
    let spec = stripFounder(meta.subtitle || '');
    if (/^(application:|ans[øo]gning:|申请\s*[:：])/i.test(spec)) spec = '';
    if (!spec) { try { const pi = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; spec = String((pi.personalInfo || pi).specialization || '').trim(); } catch (_) {} }
    return spec.replace(/\s*\|\s*/g, ' • ');
  })();

  // CONTACT-LINE-DENMARK-001 (owner 2026-06-14): mirror the PWA preview's
  // Danish local-form normalisation (app.src.js `pe`/`__localForm`) so the
  // exported DOCX/PDF header contact line reads "2300, København S"
  // (postcode + comma + district, NO country word) — not the raw stored
  // "2300 København S, Denmark". Non-Copenhagen locations pass through.
  const localForm = (v) => {
    let s = String(v || '').trim();
    // LOCALFORM-DA-ONLY-001 (owner 2026-07-10): the Danish local form is only right
    // for a Danish-language application. For en/zh/etc. leave the city as written
    // (Copenhagen) so the language layer localizes it (zh -> 哥本哈根).
    // LOCALFORM-DA-CONDITIONAL-EXPORT-001 (owner 2026-07-13: "you removed
    // København from the contact for an application in Denmark"): 1.51.367's
    // conditional — Danish forms stay when the app is Danish OR the JD is
    // DENMARK-BASED — never reached this export path. meta.jd_dk carries the
    // Denmark-based signal (the headless harness derives it from the JD text;
    // in-app callers may set it the same way).
    const __dkJd = !!(meta && meta.jd_dk) && language !== 'zh';
    if (language !== 'da' && !__dkJd) return s.replace(/københavn/gi, 'Copenhagen');
    if (!/copenhagen|københavn/i.test(s)) return s;
    s = s
      .replace(/copenhagen/gi, 'København')
      .replace(/\s*,?\s*(denmark|danmark)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .replace(/[,\s]+$/g, '')
      .trim();
    // LOCALFORM-NO-FABRICATION-001 (owner 2026-07-03, Anita demo): a bare
    // "Copenhagen, Denmark" used to come out as "2300, København S" — GABRIEL's
    // postcode+district invented for ANY Copenhagen candidate (Anita's exported
    // contact line carried a false address). Only REFORMAT a postcode the stored
    // value already has; a location without one stays "København". Gabriel's own
    // stored location carries the real postcode, so his line is unchanged.
    const m = s.match(/^(\d{4})\s+(københavn.*)$/i);
    if (m) return `${m[1]}, ${m[2]}`;
    return s;
  };

  // NAME-ZH-LOCALIZE-001 (owner 2026-07-09): in a Chinese (zh) export the
  // candidate name must render in Chinese, not Latin. Name-GUARDED to Gabriel's
  // exact stored name (and close variants) so it can NEVER rewrite another
  // candidate's name (same no-fabrication discipline as LOCALFORM-* above —
  // Anita's export must be untouched). Owner-picked form (2026-07-12), given
  // names first: 加布里埃尔 (Gabriel) · 亚历山大 (Alexander) · 卡普 (Karp) · 格申 (Gershon).
  const localizeName = (n, lang) => {
    if (lang !== 'zh') return n;
    const key = String(n || '').trim().replace(/\s+/g, ' ');
    const ZH = {
      'Gabriel Alexander Karp-Gershon': '加布里埃尔·亚历山大·卡普·格申',
      'Gabriel Alexander Karp Gershon': '加布里埃尔·亚历山大·卡普·格申',
      'Gabriel Karp-Gershon':           '加布里埃尔·亚历山大·卡普·格申',
      'Gabriel Karp Gershon':           '加布里埃尔·亚历山大·卡普·格申',
    };
    return ZH[key] || n;
  };

  const payload = {
    schema_version: '1.0',
    doc,
    language,
    layout: layout || (doc === 'cl' ? 'linear' : 'two_column'),
    filename: filename || buildFilename({ personalInfo, meta, doc, language }),
    personal_info: {
      name:        localizeName(personalInfo.name || '', language),
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
      // PHOTO-ZH-ID-STYLE-001 (owner 2026-07-12): China-market (zh) exports
      // default to a SMALL ID-style photo at the TOP-RIGHT (Chinese CV
      // convention), not the Nordic sidebar/bridge medallion. 'main-right' is
      // the top-right placement the worker renders >=105px (a 115px float,
      // square text-wrap, tight 4px/7.5px air) — 'header-right' is a fixed
      // 82px, below the owner's 105px floor. DEFAULT only — an explicitly
      // stored localStorage photoPosition still wins.
      ...(typeof readPhotoPosition === 'function'
        ? { photoPosition: (function () {
            var v = readPhotoPosition();
            if (language === 'zh') {
              try { if (!localStorage.getItem('photoPosition')) v = 'main-right'; } catch (_) {}
            }
            return v;
          })() }
        : {}),
      // v1.50.56 — photo shape for worker-side picture geometry. Worker
      // v1.15+ maps this to a:prstGeom prst (ellipse/roundRect/rect/
      // hexagon/pentagon). Older workers ignore the field and keep the
      // legacy circle behaviour.
      // PHOTO-ZH-ID-STYLE-001 (owner 2026-07-12): zh exports default the
      // geometry to SQUARE (rect prstGeom — the pipeline's photo box is
      // square, so a true 一寸 portrait ratio is not renderable worker-side).
      // An explicit personalInfo.photoShape still wins; the package default
      // (usually circle) no longer decides a zh export.
      ...(typeof readPhotoShape === 'function'
        ? { photoShape: (function () {
            var v = readPhotoShape();
            if (language === 'zh') {
              try {
                var piRaw = localStorage.getItem('personalInfo');
                var piObj = piRaw ? JSON.parse(piRaw) : {};
                var ex = piObj && typeof piObj.photoShape === 'string' ? piObj.photoShape.trim().toLowerCase() : '';
                var OK = ['circle', 'rounded', 'rounded-square', 'square', 'hexagon', 'pentagon'];
                if (OK.indexOf(ex) === -1) v = 'square';
              } catch (_) { v = 'square'; }
            }
            return v;
          })() }
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
          // PHOTO-ZH-ID-STYLE-001: zh default diameter 105px (owner floor —
          // "105 is the smallest reasonable"). Default only: an explicitly
          // stored photoSize still wins. (The worker currently renders the
          // main-left/right float at a fixed 115px and header-left/right at
          // 82px regardless; this forward matters for sidebar/bridge and any
          // future worker that honours photoSizePx everywhere.)
          if (language === 'zh' && !raw) n = 105;
          if (pos === 'band-overlap') n = Math.min(220, Math.round(1.3 * n));
          return { photoSizePx: n };
        } catch (_) { return {}; }
      })()),
      // CL-SIGNATURE-001 (owner 2026-06-28): forward the optional cover-letter signature image
      // (standalone localStorage keys — survive cloud-restore). CL-only; only when present + not
      // hidden. The worker (1.14.93) renders it after the sign-off, sized by width × aspect (the
      // aspect is computed at upload so the export preserves the real ratio).
      ...((() => {
        try {
          if (doc !== 'cl') return {};
          if (localStorage.getItem('antcv:signatureHidden') === '1') return {};
          // SIGNATURE-EXPORT-STASH-FALLBACK-001 (owner 2026-06-30): the refresh-triggered restore
          // can transiently WIPE antcv:signatureB64 (the loss-guard re-applies it, but an export in
          // that ~few-second window would miss it -> "signature missing in export"). Read the live
          // key, else fall back to the loss-guard's LOCAL stash so the export always carries it.
          const _stash = (() => { try { return JSON.parse(localStorage.getItem('antcv:clKeysGuard') || '{}') || {}; } catch (_) { return {}; } })();
          let sig = localStorage.getItem('antcv:signatureB64');
          if (!sig || !String(sig).trim()) sig = _stash['antcv:signatureB64'] || '';
          if (!sig || !String(sig).trim()) return {};
          const clean = (k) => { var v = localStorage.getItem(k); if (v == null || String(v).trim() === '') v = _stash[k]; return String(v || '').replace(/["']/g, ''); };
          const out = { signature_b64: sig };
          const al = clean('antcv:signatureAlign').toLowerCase();
          out.signature_align = (al === 'left' || al === 'right') ? al : 'center';
          const sz = Number(clean('antcv:signatureSize'));
          out.signature_size_px = (Number.isFinite(sz) && sz >= 40 && sz <= 400) ? Math.round(sz) : 160;
          const asp = Number(clean('antcv:signatureAspect'));
          out.signature_aspect = (Number.isFinite(asp) && asp > 0.05 && asp <= 3) ? asp : 0.4;
          return out;
        } catch (_) { return {}; }
      })()),
    },
    meta: {
      subtitle,
      role:     stripFounder(meta.role || ''),
      company:  meta.company  || '',
      // SLOGAN-CL-EDIT-001 (owner 2026-06-29): forward the editable CL slogan so the worker
      // renders the same tagline the preview shows. Standalone keys (cloud-restore-safe). An
      // empty override -> the worker falls back to subtitle (the old default). CL-only.
      ...((() => {
        try {
          if (doc !== 'cl') return {};
          const out = {};
          // SLOGAN-PLACEMENT-001: in 'leadin' mode the standalone tagline is hidden
          // (it becomes the opening's lead-in instead — injected into the sections below).
          if (localStorage.getItem('antcv:clSloganHidden') === '1' || (typeof window !== 'undefined' && window.__antcvSloganMode && window.__antcvSloganMode() === 'leadin')) { out.slogan_hidden = true; return out; }
          // SLOGAN-SUBTITLE-SOURCE-001 (owner 2026-06-30): for a CL the local `subtitle` var (and
          // hence meta.subtitle sent below) is OVERRIDDEN to the "Application: <role>" header label,
          // so the worker's slogan fallback (meta.subtitle) showed the APP LABEL instead of the
          // standing line. Forward the slogan = the override OR the INCOMING meta.subtitle (the real
          // standing / role-smart line, e.g. "Processes • Products • People"), so it never falls back
          // to the app label.
          let ov = String(localStorage.getItem('antcv:clSlogan') || '').trim();
          // CL-SLOGAN-ZH-001 (owner 2026-07-12): on a zh export a stored
          // Latin-only slogan (e.g. the Danish standing line) must not beat
          // the app's own Chinese meta.cl_slogan. CJK-carrying overrides win.
          if (language === 'zh' && ov && !/[一-鿿]/.test(ov)) ov = '';
          // SLOGAN-LANG-GATE-001 (owner 2026-07-14): the general wrong-language
          // gate — a sticky override in a language other than the current ribbon
          // (the classic Latin-vs-Latin Danish standing line on a Swedish/English
          // app, and every non-Latin script mismatch) is dropped so the chain
          // falls to the app's own current-language generated / specialization
          // slogan. Same helper the two previews use -> preview == export, and it
          // reads no brand state -> BRANDED and NON-BRANDED exports stay identical.
          try { if (ov && typeof window !== 'undefined' && typeof window.__antcvSloganLangGate === 'function' && !window.__antcvSloganLangGate(ov)) ov = ''; } catch (_) {}
          // CL-SLOGAN-STALE-OWNER-001 (owner 2026-07-13: the Danish standing
          // line "JEG FORBINDER TEKNIK..." shipped on an ENGLISH NVIDIA CL).
          // antcv-cl-slogan-fresh.js stamps OWNERSHIP (antcv:clSloganCtx =
          // {v, app: "Company|Role"}); an override whose stamp belongs to a
          // DIFFERENT app — or whose stamp doesn't match the value (unowned
          // residue) — is STALE for a TARGETED app that carries its own
          // generated meta.cl_slogan, and must not beat it. Unsolicited apps
          // keep the standing motto (the sidecar's own rule).
          try {
            const smart0 = String((meta && meta.cl_slogan) || '').trim();
            const co0 = String((meta && meta.company) || '').trim();
            const targeted0 = !!co0 && !(window.__ANTCV_UNSOL_RE || /^unsolicited$/i).test(co0);
            if (ov && smart0 && targeted0) {
              const ctx = JSON.parse(localStorage.getItem('antcv:clSloganCtx') || 'null');
              const cur = co0 + '|' + String((meta && meta.role) || '').trim();
              const owned = ctx && ctx.v === ov && (!ctx.app || ctx.app === cur);
              if (!owned) ov = '';
            }
          } catch (_) {}
          // SLOGAN-SMART-STATEMENT-001 (owner 2026-07-04): on a TARGETED app the
          // chain is override -> the gen's meta.cl_slogan (the smart statement) ->
          // NOTHING (slogan_hidden, so the WORKER's own subtitle fallback never
          // duplicates the specialization). Unsolicited keeps the standing default.
          let smart = String((meta && meta.cl_slogan) || '').trim();
          // SLOGAN-QUALITY-GATE-001: the export consults the SAME gate the
          // preview uses — a low-quality generated slogan ships NOWHERE.
          try { if (smart && typeof window !== 'undefined' && typeof window.__antcvSloganQualityOk === 'function' && !window.__antcvSloganQualityOk(smart, meta)) smart = ''; } catch (_) {}
          // SLOGAN-OV-QUALITY-GATE-001 (owner 2026-07-13): the export gated `smart`
          // but NOT the stored override `ov`, so a STALE / over-long standing motto
          // pinned in antcv:clSlogan (e.g. an 11-word Danish standing line that fails
          // the same quality gate the preview applies) shipped in the PDF even though
          // the preview showed the app's real generated slogan. Gate `ov` identically;
          // a failing override is dropped so the chain falls to the generated slogan
          // (or hides). A genuine short user-edit passes the gate and is kept.
          // Kill-switch antcv:disable-slogan-ov-gate.
          try {
            if (ov && !/^\[/.test(ov) && localStorage.getItem('antcv:disable-slogan-ov-gate') !== '1'
                && typeof window !== 'undefined' && typeof window.__antcvSloganQualityOk === 'function'
                && !window.__antcvSloganQualityOk(ov, meta)) ov = '';
          } catch (_) {}
          const co = String((meta && meta.company) || '').trim();
          const targeted = !!co && !(window.__ANTCV_UNSOL_RE || /^unsolicited$/i).test(co) && !/^open application$/i.test(co); // UNSOL-PILLAR-LANG-001: any language variant
          // SLOGAN-UNSOL-GENERIC-001 (owner 2026-07-15): an UNSOLICITED application
          // uses the GENERIC standing default (meta.subtitle), never a role-tailored
          // slogan. Drop the tailored meta.cl_slogan and an override that merely
          // equals the auto-copied gen slogan; a genuinely USER-EDITED override is
          // kept. Preview == export across every load path. Kill:
          // antcv:disable-slogan-unsol-generic.
          try {
            if (!targeted && localStorage.getItem('antcv:disable-slogan-unsol-generic') !== '1') {
              smart = '';
              if (ov && typeof window !== 'undefined' && typeof window.__antcvSloganOverrideIsGen === 'function'
                  && window.__antcvSloganOverrideIsGen(ov, meta)) ov = '';
            }
          } catch (_) {}
          const standing = String((meta && meta.subtitle) || '').trim();
          let sl = (ov && !/^\[/.test(ov)) ? ov
            : (smart && !/^\[/.test(smart)) ? smart
              : (targeted ? '' : standing);
          // SLOGAN-EMDASH-001 (owner 2026-07-13): banned em/en dash in the exported
          // slogan -> plain hyphen (matches the repo-wide em-dash policy).
          if (sl) sl = sl.replace(/\s*[—–]\s*/g, ' - ');
          // SLOGAN-WORDCAP-001 (owner 2026-07-14): cap the EXPORTED slogan to 4-8
          // words, same as the two preview renders, so a legacy long slogan does
          // not ship overlong to the PDF/DOCX. Preview == export.
          try { if (sl && typeof window !== 'undefined' && typeof window.__antcvSloganCap === 'function') sl = window.__antcvSloganCap(sl); } catch (_) {}
          if (sl && !/^\[/.test(sl)) out.slogan = sl;
          else if (targeted) { out.slogan_hidden = true; return out; }
          const al = String(localStorage.getItem('antcv:clSloganAlign') || 'center').replace(/["']/g, '').toLowerCase();
          out.slogan_align = (al === 'left' || al === 'right' || al === 'center') ? al : 'center';
          // SLOGAN-BRAND-COLOR-001 (owner 2026-07-14): the EXPORTED slogan follows the
          // SAME brand slogan colour the PREVIEW paints — antcv:brandV2 slots.sloganColor,
          // gated by the same window.__antcvBrandFit flag the paper-wrapper IIFE reads
          // (app.src.js ~50673). When no brand is active the field is OMITTED and the worker
          // keeps its hardcoded teal (style.mainHeadColor). CONTRAST-GUARD (STANDING
          // accessibility rule [[brand-colors-contrast-accessibility]]): the slogan is
          // coloured text on the WHITE cover-letter page, so a too-light brand colour is
          // DARKENED (hue kept) until it clears ~3:1 luminance contrast against white — a
          // colour token never ships without a contrast guard (TABLE-HEADER-INK-001 pattern).
          try {
            if (typeof window !== 'undefined' && window.__antcvBrandFit === true) {
              let sc = '';
              const raw = localStorage.getItem('antcv:brandV2');
              if (raw) {
                const o = JSON.parse(raw);
                const sl2 = (o && o.slots) ? o.slots : (o && o.headerBg ? o : null);
                if (sl2 && sl2.sloganColor) sc = String(sl2.sloganColor);
              }
              sc = sc.replace(/[^0-9a-fA-F]/g, '');
              if (sc.length === 3) sc = sc.split('').map(function (c) { return c + c; }).join('');
              if (sc.length === 6) {
                const __lum6 = function (hex) {
                  const c = function (i) { let v = parseInt(hex.slice(i, i + 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
                  return 0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4);
                };
                const __cvw = function (hex) { return 1.05 / (__lum6(hex) + 0.05); }; // contrast vs white page
                let guard = 0;
                while (__cvw(sc) < 3 && guard++ < 24) {
                  const dark = [0, 2, 4].map(function (i) { return Math.round(parseInt(sc.slice(i, i + 2), 16) * 0.82).toString(16).padStart(2, '0'); }).join('');
                  if (dark === sc) break;
                  sc = dark;
                }
                out.slogan_color = sc.toUpperCase();
              }
            }
          } catch (_) {}
          return out;
        } catch (_) { return {}; }
      })()),
      // CL-CLOSING-EDIT-001 (owner 2026-06-29): forward the editable sign-off closing (default
      // "At your service,") so the worker renders it instead of the hardcoded "Kind regards,". CL-only.
      ...((() => {
        try {
          if (doc !== 'cl') return {};
          const out = {};
          let ov = String(localStorage.getItem('antcv:clClosing') || '').trim();
          // CL-CLOSING-ZH-001 (owner 2026-07-12): a zh CL must end 此致敬礼
          // style. A stored Latin-only closing (the EN/Nordic default "At your
          // service,") would override the worker's zh default; on a zh export
          // only a CJK-carrying closing is forwarded.
          if (language === 'zh' && ov && !/[一-鿿]/.test(ov)) ov = '';
          if (ov) out.cl_closing = ov;
          const al = String(localStorage.getItem('antcv:clClosingAlign') || 'center').replace(/["']/g, '').toLowerCase();
          out.cl_closing_align = (al === 'left' || al === 'right' || al === 'center') ? al : 'center';
          return out;
        } catch (_) { return {}; }
      })()),
      // CL-SIGNNAME-001 (owner 2026-06-29): editable sign-off name (override; empty -> the worker
      // uses the first word of the full name) + its own CJLR align (default center). CL-only.
      ...((() => {
        try {
          if (doc !== 'cl') return {};
          const out = {};
          let ov = String(localStorage.getItem('antcv:clSignName') || '').trim();
          // CL-SIGNNAME-ZH-001 (owner 2026-07-12): the babel layer maintains a
          // per-language sign name (antcv:clSignName_zh = 加布里埃尔). On a zh
          // export it beats the Latin default so the sign-off is Chinese.
          if (language === 'zh') {
            try { const zv = String(localStorage.getItem('antcv:clSignName_zh') || '').trim(); if (zv) ov = zv; } catch (_) {}
          }
          if (ov) out.cl_sign_name = ov;
          const al = String(localStorage.getItem('antcv:clSignNameAlign') || 'center').replace(/["']/g, '').toLowerCase();
          out.cl_sign_name_align = (al === 'left' || al === 'right' || al === 'center') ? al : 'center';
          return out;
        } catch (_) { return {}; }
      })()),
    },
    header_align: align,
    // HEADLINE-ALIGN-EXPORT-PARITY (row 33): section-headline alignment persists in
    // localStorage 'antcv.sectionHeadlineAlignment.v1' as a loc-keyed map
    // { topbar, sidebar, main } (written by antcv-section-panel-211.js), preview-only.
    // Forward it so the worker's headingParagraph aligns PDF/DOCX headlines to match
    // the preview. Older workers ignore the extra field (inert until deployed).
    headline_align: (() => {
      try {
        const raw = JSON.parse(localStorage.getItem('antcv.sectionHeadlineAlignment.v1') || 'null');
        if (!raw || typeof raw !== 'object') return {};
        const ok = (v) => v === 'left' || v === 'center' || v === 'right' || v === 'justify';
        const out = {};
        ['topbar', 'sidebar', 'main'].forEach((k) => { if (ok(raw[k])) out[k] = raw[k]; });
        return out;
      } catch (_) { return {}; }
    })(),
    // HEADER-ITEM-RULE-001 (owner 2026-07-03): per-field header rule lines with
    // hide/show + thickness (pt) + color. DEFAULT (absent key) = the current
    // copenhagen-modern look: rule below Specialization/Application + rule below
    // Contact, none below Name. Store: localStorage 'headerItemRule' =
    // { name|specialisation|contact: { on, pt, color } }.
    header_rules: (() => {
      // HEADER-RULE-DEFAULTS-002 (owner 2026-07-23): specialisation + contact rules
      // are now DEFAULT-HIDDEN (were the copenhagen default-ON). Explicit store
      // values still win; the worker receives explicit on/off either way (1:1).
      const D = { name: { on: false, pt: 0.75, color: '' }, specialisation: { on: false, pt: 0.75, color: '' }, contact: { on: false, pt: 0.75, color: '' } };
      try {
        const raw = JSON.parse(localStorage.getItem('headerItemRule') || 'null');
        if (!raw || typeof raw !== 'object') return D;
        const norm = (k) => {
          const v = raw[k];
          if (!v || typeof v !== 'object') return D[k];
          const pt = Number(v.pt);
          return {
            on: typeof v.on === 'boolean' ? v.on : D[k].on,
            pt: Number.isFinite(pt) && pt >= 0.25 && pt <= 4 ? pt : D[k].pt,
            color: typeof v.color === 'string' && /^#?[0-9a-fA-F]{6}$/.test(v.color) ? v.color.replace(/^#/, '') : '',
          };
        };
        return { name: norm('name'), specialisation: norm('specialisation'), contact: norm('contact') };
      } catch (_) { return D; }
    })(),
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
    sections: bindOrphansInSections(normalizeSections(applyChinaLayoutZh(docSections, doc, language))),
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
    /* BALANCE-OVERFLOW-001 (owner 2026-06-24, FLAG-GATED, default OFF): when the CV
       sidebar paginates DEEPER than the main, the worker normally renders the overflow
       as [sidebar | EMPTY main] pages (the owner's 9-page CV). With this flag the worker
       re-flows that overflow FULL-WIDTH (~2x density -> fewer pages). Default off — a
       real-export PDF render can't be verified headlessly. Enable to test:
         localStorage.setItem('antcv:balance-overflow','1')   (then export)
       Workers < 1.14.82 ignore it. */
    ...((() => { try { return localStorage.getItem('antcv:balance-overflow') === '1' ? { balance_overflow: true } : {}; } catch (_) { return {}; } })()),
    /* FLOAT-SPINE-001 (register row 3, FLAG-GATED, default OFF): continuation
       page-tables become floating text-anchored tables under a continuous section
       (the owner's hand-edited "_3page proper" reference), so pages pack instead of
       each claiming a guaranteed inline page — the path to sidebar-navy-to-page-bottom
       without re-triggering PDF-BLANK-PAGE. Default off — the LibreOffice/CloudConvert
       render can't be verified headlessly. Enable to test:
         localStorage.setItem('antcv:float-spine','1')   (then export)
       Workers < 1.14.124 ignore it. */
    ...((() => { try { return localStorage.getItem('antcv:float-spine') === '1' ? { float_spine: true } : {}; } catch (_) { return {}; } })()),
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
    /* AI-NOTICE-POSITION-CONTROL-001 (owner 2026-07-01): the Layout control pins the notice corner
       (bottom left/center/right); forward it so the worker overrides the auto larger-gap logic.
       'auto'/absent -> not forwarded -> worker keeps the measured behaviour. */
    ...((() => { try { const p = localStorage.getItem('antcv:aiNoticePos'); return (p === 'left' || p === 'center' || p === 'right') ? { ai_notice_pos: p } : {}; } catch (_) { return {}; } })()),
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

  // LINKIFY-EXPORT-001 (spec rules 35/39, register row 28): bare kernel-known
  // URLs (Google Scholar / kernel projects like AntCV) inside payload strings
  // become markdown [display](url) so the worker's inlineRuns renders REAL
  // clickable w:hyperlinks in the DOCX/PDF. Kernel-known URLs ONLY — never
  // generic linkification. Publications sections are skipped (their citation
  // renderer is markdown-blind; the masterSite hyperlink is their vehicle).
  try { linkifyKernelUrls(payload); } catch (_) {}

  return payload;
}

// ── CL-HYDRATE-EXPORT-GATE-001 (register row 29 leg B, owner round-4) ─────────
// The CL HYDRATION RACE caught live: at gen-complete the opening/why/who
// sections still held skeleton/template text while the real prose sat in
// meta / the prose-loss guard's bucket; the sections self-heal within minutes
// (the guard's async reapply tick) but a fast export raced it and shipped the
// literal "Dear [Hiring Team / Name]," placeholders. This gate runs INSIDE
// buildPayload (exports build from REACT state — a localStorage heal can't fix
// the payload in hand): a guarded CL section whose prose is STILL a template
// placeholder is replaced from the best real source — the prose-loss guard's
// bucket snapshot for the CURRENT application (full section, right shape),
// else the meta string for opening/greeting. Placeholder←real only; never
// fabricates; classifier mirrors the guard (ANY bracketed template segment).
// Kill: localStorage['antcv:disable-cl-hydrate-gate']='1'.
const CL_HYDRATE_IDS = ['greeting', 'opening', 'why', 'who', 'foundation', 'contribute', 'closure', 'bring'];
function _clPlaceholder(t) {
  const s = String(t == null ? '' : t).trim();
  if (!s || s.charAt(0) === '[') return true;
  return (s.match(/\[[^\]]{2,80}\]/g) || []).length >= 1;
}
function _clProseOf(sec) {
  if (!sec || typeof sec !== 'object') return '';
  if (Array.isArray(sec.items)) {
    for (const it of sec.items) {
      const t = it && typeof it === 'object' ? it.t : it;   // body only — the lead label survives an empty gen
      if (typeof t === 'string' && t.trim()) return t;
    }
    return '';
  }
  return typeof sec.content === 'string' ? sec.content : '';
}
function hydrateClProse(list, doc, meta) {
  try {
    if (doc !== 'cl' || !Array.isArray(list)) return list;
    if (localStorage.getItem('antcv:disable-cl-hydrate-gate') === '1') return list;
    const m = meta || {};
    let bucket = null;
    try {
      const g = JSON.parse(localStorage.getItem('antcv:clProseGuard') || 'null');
      const key = String(m.company || '').trim() + '|' + String(m.role || '').trim();
      if (g && typeof g === 'object' && g[key] && typeof g[key] === 'object') bucket = g[key];
    } catch (_) {}
    const metaText = { opening: m.opening, greeting: m.greeting };
    let hydrated = 0;
    const out = list.map((sec) => {
      if (!sec || CL_HYDRATE_IDS.indexOf(String(sec.id || '')) === -1) return sec;
      if (!_clPlaceholder(_clProseOf(sec))) return sec;
      // best source: the guard's full-section snapshot (right shape) …
      const snap = bucket && bucket[sec.id];
      if (snap && typeof snap === 'object' && !_clPlaceholder(_clProseOf(snap))) {
        hydrated++;
        return JSON.parse(JSON.stringify(snap));
      }
      // … else the meta string for the header prose ids.
      const mt = metaText[sec.id];
      if (typeof mt === 'string' && mt.trim() && !_clPlaceholder(mt)) {
        hydrated++;
        if (Array.isArray(sec.items)) {
          const items = sec.items.slice();
          const i0 = items.findIndex((it) => it && typeof it === 'object');
          if (i0 >= 0) items[i0] = { ...items[i0], t: mt };
          else items.unshift({ b: '', t: mt });
          return { ...sec, items };
        }
        return { ...sec, content: mt };
      }
      return sec;
    });
    if (hydrated) { try { console.log('[docx-client] CL-HYDRATE-EXPORT-GATE-001: hydrated ' + hydrated + ' placeholder CL section(s) from meta/guard before export'); } catch (_) {} }
    return hydrated ? out : list;
  } catch (_) { return list; }
}

// ── LINKIFY-EXPORT-001 helpers ───────────────────────────────────────────────
function kernelLinkUrls() {
  const out = [];
  try {
    let p = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {};
    p = p.personalInfo || p;
    const push = (u) => {
      u = String(u || '').trim();
      if (/^https?:\/\//i.test(u) && !out.includes(u)) out.push(u);
    };
    push(p.googleScholar);
    if (p.publicationsScholar && typeof p.publicationsScholar === 'object') push(p.publicationsScholar.url);
    (Array.isArray(p.projects) ? p.projects : []).forEach((pr) => {
      if (pr && pr.renderAsHyperlink && pr.url) push(pr.url);
    });
  } catch (_) {}
  return out;
}
const LINKIFY_SKIP_KEYS = { url: 1, link: 1, href: 1, photo: 1, image: 1, id: 1, type: 1, loc: 1 };
function linkifyKernelUrls(payload) {
  const urls = kernelLinkUrls();
  if (!urls.length || !Array.isArray(payload.sections)) return;
  const escRe = (s) => String(s).replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const subs = urls.map((u) => ({
    re: new RegExp('(\\]\\()?' + escRe(u), 'g'),
    md: '[' + u.replace(/^https?:\/\//i, '').replace(/\/$/, '') + '](' + u + ')',
  }));
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const k of Object.keys(node)) {
      if (LINKIFY_SKIP_KEYS[k]) continue;
      const v = node[k];
      if (typeof v === 'string') {
        if (v.indexOf('http') === -1) continue;
        let next = v;
        for (const s of subs) next = next.replace(s.re, (m, pre) => (pre ? m : s.md)); // already-markdown occurrences untouched
        if (next !== v) node[k] = next;
      } else if (v && typeof v === 'object') walk(v);
    }
  };
  payload.sections.forEach((sec) => {
    if (!sec) return;
    const sid = String(sec.id || '').toLowerCase();
    if (sid === 'pubs' || sid === 'publications' || /publication/i.test(String(sec.title || ''))) return; // citation renderer is markdown-blind
    walk(sec);
  });
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
  // SIDEBAR-DEFAULT-32-001 (spec rule 36, owner 2026-07-04): the DEFAULT
  // sidebar proportion is 32% — the user's preview-splitter choice
  // (cvSidebarRatio) still wins when set.
  try {
    if (typeof localStorage === 'undefined') return 0.32;
    const raw = localStorage.getItem('cvSidebarRatio');
    if (raw == null) return 0.32;
    let v;
    try { v = JSON.parse(raw); } catch (_) { v = Number(raw); }
    v = Number(v);
    if (!Number.isFinite(v) || v <= 0) return 0.32;
    return Math.max(0.2, Math.min(0.55, v));
  } catch (_) { return 0.32; }
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
    const rawList = (Array.isArray(src.bullets) && src.bullets.length ? src.bullets : Array.isArray(src.items) ? src.items : []);
    // CONTRIBUTE-RICHBLOCK-EXPORT-001 (owner 2026-07-01: "How I would contribute not visible in
    // PDF"). This merge is for the LEGACY string-bullet contribute. The current contribute is a
    // rich_block whose items are OBJECTS ({b,t,mk}); String(obj) -> "[object Object]", which then
    // overwrote the real items (merged.items = bullets below) and BLANKED HWIC in the export. If the
    // stored items are objects, the rich_block section is already complete — leave it untouched.
    if (rawList.some(x => x && typeof x === 'object')) return docSections;
    const bullets = rawList.map(x => String(x || '').trim()).filter(Boolean);
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

// EXPORT-SANITIZE-001 (owner 2026-06-20): the export builds from React's in-memory
// sections, NOT the localStorage copy the 415 normaliser cleans — so fabricated tools
// (Snowflake/DBT) and clearly-irrelevant student roles survived into the PDF even after
// the normaliser stripped/hid them in localStorage (the known React-vs-localStorage drift).
// Sanitise the EXPORT payload itself so the generated document is always clean regardless
// of normalise timing. Mirror these in antcv-sections-normalize-415.js so the preview
// converges too.
const FAB_TOOLS = /\b(?:snowflake|dbt)\b/i;
// SIDEBAR-TIGHTEN-001 (owner 2026-07-03): deterministic sidebar abbreviations so long
// certificate/tool lines stop wrapping into runt tails — "critical for keeping a 3
// pages unsolicited". Export-only (stored sections + preview untouched, the house
// sanitizeForExport pattern). Owner-named pairs; extend as he names more.
const SIDEBAR_ABBR = [
  [/\bUniversity of\b/g, 'Uni. of'],
  [/\bIntroduction to\b/g, 'Intro to'],
  // Owner 2026-07-03 (Trackman review round 2): explicit approval.
  [/\bAutomotive environmental conditions and testing\b/gi, 'Environmental testing'],
  // Owner 2026-07-05 (Trackman review): trim standards descriptions.
  [/\bMachine-vision sensor characterization\b/gi, 'Machine-vision characterization'],
  [/\bOpto-electronic conversion function\b/gi, 'EO conversion function'],
];
// SIDEBAR-PAREN-BALANCE-001 (owner 2026-07-05: "cut in middle of parenthesis" —
// e.g. "…technical-commercial evaluation (RFQ/RFI" with no closing ")"). A
// compression/cut truncated the value mid-parenthesis. Deterministically balance
// it: if a value has more "(" than ")", append the missing ")" so the parenthetical
// closes cleanly. Trailing whitespace/comma before the close is tidied.
function _balanceParens(t) {
  if (typeof t !== 'string' || t.indexOf('(') === -1) return t;
  const opens = (t.match(/\(/g) || []).length;
  const closes = (t.match(/\)/g) || []).length;
  if (opens <= closes) return t;
  return t.replace(/[\s,;]+$/, '') + ')'.repeat(opens - closes);
}
// SIDEBAR-GROUP-MERGE-001 (owner 2026-07-05: "if you have so few items in groups
// that can be merged (they have commonality) please merge them" — e.g.
// "Optics, photonics & sensing: Electro-optics, LiDAR" + "Imaging: Camera
// architecture, image sensors" -> one line). Each entry folds a SOURCE category's
// values into a TARGET category's values (same section), then drops the source.
// Owner-specified pairs only (like SIDEBAR_ABBR) — never a generic auto-merge.
const SIDEBAR_GROUP_MERGE = [
  { from: /^\s*imaging\s*$/i, into: /optics.*photonic.*sens/i },
  // Owner 2026-07-05: "Project management" and "Project & delivery management" are
  // near-duplicates and should not be separated. Fold the shorter generic group
  // into the fuller one. Anchored ^...$ so "Project management" never matches the
  // "& delivery" target.
  { from: /^\s*project management\s*$/i, into: /project\s*&\s*delivery\s*management/i },
];
// Read the label / value fields of a sidebar item in either shape
// (labeled_list {l,v} | rich_block {b,t}). Returns null for a group header / string.
function _grpFields(it) {
  if (!it || typeof it !== 'object' || it.grp) return null;
  if (typeof it.l === 'string' || typeof it.v === 'string') return { lf: 'l', vf: 'v' };
  if (typeof it.b === 'string' || typeof it.t === 'string') return { lf: 'b', vf: 't' };
  return null;
}
// Merge owner-specified category pairs within a sidebar item array. Returns a new
// items array (or the same reference when nothing merged). Shape-tolerant no-op.
function _mergeSidebarGroups(items) {
  if (!Array.isArray(items) || items.length < 2) return items;
  let changed = false;
  let out = items.slice();
  for (const rule of SIDEBAR_GROUP_MERGE) {
    const srcIdx = out.findIndex((it) => { const f = _grpFields(it); return f && rule.from.test(String(it[f.lf] || '').trim()); });
    const dstIdx = out.findIndex((it) => { const f = _grpFields(it); return f && rule.into.test(String(it[f.lf] || '').trim()); });
    if (srcIdx < 0 || dstIdx < 0 || srcIdx === dstIdx) continue;
    const sf = _grpFields(out[srcIdx]); const df = _grpFields(out[dstIdx]);
    const srcVal = String(out[srcIdx][sf.vf] || '').trim().replace(/[.,;\s]+$/, '');
    const dstVal = String(out[dstIdx][df.vf] || '').trim().replace(/[.,;\s]+$/, '');
    if (!srcVal) { out = out.filter((_, i) => i !== srcIdx); changed = true; continue; }
    const merged = dstVal ? dstVal + ', ' + srcVal : srcVal;
    out = out.map((it, i) => (i === dstIdx ? { ...it, [df.vf]: merged } : it)).filter((_, i) => i !== srcIdx);
    changed = true;
  }
  return changed ? out : items;
}
// SIDEBAR-GROUP-MERGE-STORED-001: expose the EXACT export merge so a stored-sections
// preview-parity sidecar can produce a byte-identical merge. Preview == export by
// construction (mirrors ROLE-MERGE-STORED-001's window.AntcvMergeSameCompanyRoles).
try { if (typeof window !== 'undefined') window.AntcvMergeSidebarGroups = _mergeSidebarGroups; } catch (_) {}
// OLD-ROLE-BULLET-CAP-001 (spec rule 47): the END year of a role's date range
// ("2006 - 2010", "2022 - 2026 (present)"), or null if none / still current.
function _roleEndYear(years) {
  const s = String(years == null ? '' : years);
  if (/present|current|now|nu\b|nuv/i.test(s)) return null;   // still ongoing -> not "old"
  const ys = (s.match(/\b(19|20)\d\d\b/g) || []).map(Number);
  return ys.length ? Math.max(...ys) : null;
}
// The tighter bullet cap for an OLD PLAIN role (rule 47). Thresholds calibrated
// to the owner's own timeline + the delivered-and-verified NIL pair: RA/TA
// (ended ~16y ago) is the hard-cut case he named -> 2; a plain role 11-15y old
// -> 3; anything more recent keeps the normal cap (Sirin, ended ~9y ago,
// shipped at 4 in the verified pair, so <11y must not tighten). null = no cap.
function _oldRoleBulletCap(years, nowYear) {
  const end = _roleEndYear(years);
  if (end == null) return null;
  const age = (nowYear || _payloadNowYear()) - end;
  if (age >= 16) return 2;
  if (age >= 11) return 3;
  return null;
}
// Live current year (browser export). Isolated so a test can stub it.
function _payloadNowYear() {
  try { return new Date().getFullYear(); } catch (_) { return 2026; }
}

// Always low-signal for a senior professional targeted application (any cluster):
// student council, dormitory security guard, volunteer-sport foreningsarbejde.
const IRRELEVANT_ROLE = /students?\s+council|security\s+guard|foreningsarbejde/i;
// CLUSTER-dependent: hide ONLY when the JD does NOT call for them (owner 2026-06-20, analyst
// app: hide the old IDF sysadmin role + the Publications & Patents section).
const CLUSTER_ROLE = /computer\s+systems?\s+administrator/i;
function _jdText() { try { return String(localStorage.getItem('antcv:lastJdText') || '').toLowerCase(); } catch (_) { return ''; } }
// JD relevance for the OLD-ROLE bullet cap (rule 47 refinement, owner
// 2026-07-04: "the age cap applies also for relevant roles — a merged role's
// bullets must be very relevant to stay"). Significant JD tokens = >=4-char
// words minus a small stopword set; a bullet is relevant when it shares one.
const _JD_STOP = new Set('with that this from will your team work role able across into over under after within their have been they also more than what when which using used based include including such other each both once about our its the and for'.split(' '));
function _jdSignificantTokens() {
  const jd = _jdText();
  if (!jd || jd.length < 30) return null;                       // no usable JD -> no relevance gating
  const set = new Set();
  (jd.match(/[a-z][a-z0-9+/&.-]{3,}/g) || []).forEach((w) => { if (!_JD_STOP.has(w)) set.add(w); });
  return set.size ? set : null;
}
function _bulletRelevantToJd(bullet, jdSet) {
  if (!jdSet) return true;                                       // can't judge -> keep (never over-drop)
  const words = String(bullet || '').toLowerCase().match(/[a-z][a-z0-9+/&.-]{3,}/g) || [];
  for (const w of words) {
    if (_JD_STOP.has(w)) continue;
    if (jdSet.has(w)) return true;
    if (w.length > 4 && (jdSet.has(w.slice(0, -1)) || jdSet.has(w + 's'))) return true;   // light plural tolerance
  }
  return false;
}
function _jdIsTechOps() { return /\b(?:it support|sysadmin|system[s]? admin|infrastructure|devops|networking|on-?prem|server administration|helpdesk|service desk)\b/.test(_jdText()); }
function _jdIsResearch() { return /\b(?:research|patent|publication|r&d|phd|ph\.d|scientist|academ|postdoc|peer[- ]review)\b/.test(_jdText()); }
function _isTargetedExport() {
  try {
    const m = JSON.parse(localStorage.getItem('meta') || '{}');
    const co = String((m && m.company) || '').trim().toLowerCase();
    // UNSOLICITED-NOT-TARGETED-001 (owner 2026-06-23): an EXPLICIT 'unsolicited' marker is
    // AUTHORITATIVE and must win over the sticky fallbacks below. Otherwise a __antcvMerged
    // flag (or a stale activeAppCompany) left on the sections by a PRIOR targeted session makes
    // an UNSOLICITED export wrongly merge same-company roles + hide Publications/breadth (the
    // owner's bug: an unsolicited CV came out with Innoviz/Meprolight/TAU merged, security
    // guard / Copenhagen Wolves / student council + Publications dropped). Owner rule:
    // "Unsolicited keeps the full breadth." So 'unsolicited' ⇒ FALSE; any OTHER explicit
    // company ⇒ targeted; only when meta.company is EMPTY do we consult the drift fallbacks.
    if (co === 'unsolicited' || !!(window.__antcvUnsol && window.__antcvUnsol(co))) return false; // UNSOL-PILLAR-LANG-001: any language variant
    if (co) return true;
    // STABLE fallback (PUBLICATIONS-HIDE-STABLE-001): the volatile meta.company /
    // activeAppCompany can drift to EMPTY mid-session, which would silently switch the
    // display-time hides back off. An app whose experience was already MERGED is a targeted
    // application — treat it as such regardless of the drifted meta. An explicit 'unsolicited'
    // active company still wins (return false) even when meta.company drifted empty.
    try {
      const ac = String(localStorage.getItem('antcv:activeAppCompany') || '').replace(/"/g, '').trim().toLowerCase();
      if (ac === 'unsolicited' || !!(window.__antcvUnsol && window.__antcvUnsol(ac))) return false; // UNSOL-PILLAR-LANG-001: any language variant
      if (ac) return true;
    } catch (_) {}
    const s = JSON.parse(localStorage.getItem('sections') || '{}');
    const exp = (s && Array.isArray(s.cv) ? s.cv : []).find((x) => x && x.type === 'experience');
    if (exp && exp.__antcvMerged) return true;
    return false;
  } catch (_) { return false; }
}
// EXPORT-MERGE-001 (owner 2026-06-20): for a JD-TARGETED application, CONSOLIDATE the
// multiple roles a candidate held at the SAME company into ONE entry (Innoviz Change
// Control + System Architect; Meprolight EO Team Leader + R&D EO Engineer; TAU Research +
// Teaching Assistant). Runs AFTER the irrelevant-role hide, so only VISIBLE roles merge
// (the TAU security-guard / students-council rows are already on:false and pass through
// untouched). The merged entry keeps the company, unions + de-dups the bullets, orders
// them by analyst/JD relevance (so Innoviz leads with change-request bullets and TAU leads
// with analyst-relevant ones), caps at 6, widens the year range, and joins the distinct
// titles. Export-only + ephemeral: switching back to the unsolicited kernel restores the
// full separate roles (no persistence).
const _ANALYST_RX = /\b(?:data|analys|model|sql|python|pipeline|stakeholder|requirement|trace|document|metric|report|dashboard|change|request|process|insight|forecast|statist|research|experiment|quality|validation|impact|scope)\w*/gi;
function _bulletText(b) { return String(typeof b === 'string' ? b : (b && (b.b || b.t)) || ''); }
function _relevanceScore(b) { const m = _bulletText(b).match(_ANALYST_RX); return m ? m.length : 0; }
function mergeSameCompanyRoles(roles) {
  try {
    if (!Array.isArray(roles)) return null;
    const groups = {}; const order = [];
    roles.forEach((r) => {
      if (!r || r.on === false) return;
      const key = String(r.company || '').trim().toLowerCase();
      if (!key) return;
      if (!groups[key]) { groups[key] = []; order.push(key); }
      groups[key].push(r);
    });
    if (!order.some((k) => groups[k].length >= 2)) return null;
    const emitted = {};
    const out = [];
    roles.forEach((r) => {
      if (!r || r.on === false) { out.push(r); return; }
      const key = String(r.company || '').trim().toLowerCase();
      const grp = key && groups[key];
      if (!grp || grp.length < 2) { out.push(r); return; }
      if (emitted[key]) return;            // merged entry already emitted at first position
      emitted[key] = true;
      const titles = [];
      grp.forEach((g) => { if (g.title && titles.indexOf(g.title) < 0) titles.push(g.title); });
      const seen = {}; let bullets = [];
      grp.forEach((g) => (g.bullets || []).forEach((b) => {
        const t = _bulletText(b).trim();
        const k = t.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 64);
        if (t && !seen[k]) { seen[k] = 1; bullets.push(b); }
      }));
      bullets = bullets
        .map((b, i) => ({ b, i, s: _relevanceScore(b) }))
        .sort((a, c) => c.s - a.s || a.i - c.i)
        .map((x) => x.b);
      // Rule 17/16a: a merged role carries at most 5 bullets (belt re-caps too).
      if (bullets.length > 5) bullets = bullets.slice(0, 5);
      const ys = [];
      grp.forEach((g) => (String(g.years || '').match(/\d{4}/g) || []).forEach((y) => ys.push(parseInt(y, 10))));
      const years = ys.length ? (Math.min(...ys) + ' - ' + Math.max(...ys)) : (grp[0].years || '');
      // MERGED-TITLE-JOIN-001 (owner 2026-07-04, spec rule 17a): merged roles
      // join with " & ", never "/" — "Change Request Lead & System Architect".
      // MERGED-RESULTS-UNION (spec rule 17 ">1 Result", SECTIONS-STORM-2026-07-23):
      // a merged role carries BOTH constituents' Results. {...grp[0]} alone kept
      // only the first role's line (the "Results on one role only" report); union
      // the distinct non-empty results in constituent order.
      const rs = [];
      grp.forEach((g) => { const t = String(g.results == null ? '' : g.results).trim(); if (t && rs.indexOf(t) < 0) rs.push(t); });
      const mergedRole = { ...grp[0], title: titles.join(' & '), bullets, years };
      if (rs.length) mergedRole.results = rs.join(' ');
      out.push(mergedRole);
    });
    return out;
  } catch (_) { return null; }
}
// ROLE-MERGE-STORED-001 (register row 34): expose the EXACT export merge so the
// stored-sections preview-parity sidecar (antcv-role-merge-stored.js) produces a
// byte-identical merged role. Preview == export by construction.
try { if (typeof window !== 'undefined') window.AntcvMergeSameCompanyRoles = mergeSameCompanyRoles; } catch (_) {}
// URUGUAYAN-VARIANT-STRIP-001 (2026-06-22): strip ", Uruguayan variant" qualifier from
// Spanish language items at export. Owner: keep EN/HE native; only drop the regional
// qualifier for Spanish. Applied to labeled_list items where the label is Spanish-like.
// Matches: ", Uruguayan variant", " (Uruguayan...)", " - Uruguayan variant" etc.
const _URUGUAYAN_RE = /[,\s(–\-]+uruguayan\s+variant[)\s]*/i;
function _stripUruguayan(items) {
  if (!Array.isArray(items)) return items;
  let hit = false;
  const out = items.map((it) => {
    if (!it || typeof it !== 'object') return it;
    const lbl = String(it.l || '').toLowerCase();
    if (!lbl.startsWith('spanish') && !lbl.startsWith('español')) return it;
    if (!it.v || !_URUGUAYAN_RE.test(it.v)) return it;
    hit = true;
    return { ...it, v: it.v.replace(_URUGUAYAN_RE, '').trim().replace(/[,]\s*$/, '').trim() };
  });
  return hit ? out : items;
}

function sanitizeForExport(docSections, doc) {
  try {
    if (!Array.isArray(docSections)) return docSections;
    const targeted = _isTargetedExport();
    return docSections.map((s) => {
      if (!s || typeof s !== 'object') return s;
      // PAN-IDRAET-BULLET-NEARDUP-001: collapse within-role near-duplicate bullets
      // BEFORE any mode/targeted handling, so both the results-mode (post-
      // applyOutcomesMode) and section-mode payloads carry one clean line. Runs on
      // every experience section; KEEP_MIN=2 respected; stored sections untouched.
      if (s.type === 'experience' && Array.isArray(s.roles)) {
        // ROLES-AS-RICHBLOCK-001: drop bullets the rich_block editor hid
        // (role.bulletMeta[bi].hidden) BEFORE collapse so indices line up.
        // Payload-only — stored roles keep them so the editor can unhide.
        let roles = s.roles.map((r) => {
          if (r && Array.isArray(r.bullets) && Array.isArray(r.bulletMeta)) {
            const meta = r.bulletMeta;
            const kept = r.bullets.filter((b, bi) => !(meta[bi] && meta[bi].hidden));
            if (kept.length !== r.bullets.length) return { ...r, bullets: kept, bulletMeta: undefined };
          }
          return r;
        }).map(_collapseRoleBullets);
        if (targeted) {
          // ROLE-CLASS-HIDE-001 (spec rule 18, owner 2026-07-04 "fix in code"):
          // in a TARGETED export the hide-for-this-role-class set never ships,
          // regardless of what a stale row snapshot restored. Payload-only —
          // stored sections keep the roles for the editor toggle.
          const HIDE_CLASS = /security guard|students council|team operations manager/i;
          roles = roles.filter((r) => !(r && HIDE_CLASS.test(String(r.title || ''))));
          // BULLET-CAP-BELT-001 (spec rules 16/16a/17): plain roles carry at most
          // 4 bullets in a targeted export; a MERGED role (function & leadership
          // title) at most 5. Bullets are ordered strongest-first by the
          // generation (SECTION-ORDER-001), so keeping the FIRST N is the
          // deterministic version of "most relevant only". Payload-only.
          const MERGED_TAIL = /&\s*(?:[A-Za-z.]+\s+)?(?:leader|lead|manager|coach|architect|specialist)\b/i;
          // OLD-ROLE-BULLET-CAP-001 (spec rule 47, owner Trackman round 2: "for
          // old roles pass 2-3 bullets only if highly relevant — a project
          // manager should not get lots of research & teaching assistant
          // bullets"). Early-career roles get a TIGHTER cap by age: a role that
          // ended >=14y ago -> 2 bullets, >=8y ago -> 3. Combined with
          // strongest-first ordering (SECTION-ORDER-001) this keeps the most
          // relevant N. Payload-only. Age from the role's END year vs now.
          const nowYear = _payloadNowYear();
          const jdSet = _jdSignificantTokens();
          roles = roles.map((r) => {
            if (!r || !Array.isArray(r.bullets)) return r;
            const isMerged = MERGED_TAIL.test(String(r.title || ''));
            const typeCap = isMerged ? 5 : 4;
            const ageCap = _oldRoleBulletCap(r.years, nowYear);   // 2 / 3 / null
            // OLD-ROLE-BULLET-CAP-001 (owner 2026-07-04 refinement): the age cap
            // applies to ALL old roles, MERGED included — a merged role no longer
            // gets a free pass to 5. A PLAIN old role is hard-capped at the age
            // count (strongest-first). A MERGED old role keeps the age count as a
            // FLOOR and may earn bullets ABOVE it (up to 5) ONLY when they are
            // very relevant to the JD ("must be very relevant to stay"). Non-old
            // roles keep their normal type cap. Bullets are strongest-first.
            let bullets = r.bullets;
            if (ageCap == null) {
              if (bullets.length > typeCap) bullets = bullets.slice(0, typeCap);
            } else if (!isMerged) {
              if (bullets.length > ageCap) bullets = bullets.slice(0, ageCap);
            } else {
              const kept = bullets.slice(0, ageCap);              // age floor, strongest first
              for (let i = ageCap; i < bullets.length && kept.length < typeCap; i++) {
                if (_bulletRelevantToJd(bullets[i], jdSet)) kept.push(bullets[i]);
              }
              bullets = kept;
            }
            return bullets === r.bullets ? r : { ...r, bullets };
          });
        }
        if (roles.length !== s.roles.length || roles.some((r, i) => r !== s.roles[i])) s = { ...s, roles };
      }
      // TOOLS-HIDDEN-RESIDUE-001 export belt: 'Hidden - <category>' residue rows
      // (antcv-tools-hidden-residue.js) are per-application panel artifacts for
      // review — they never ship, even if a stale hidden flag left one visible.
      // Checks BOTH label shapes: {l,v} labeled_list and {b,t} rich_block
      // (tools is MIGRATED to rich_block at runtime — RICHBLOCK-SHAPE-001).
      if (s.loc === 'sidebar' && Array.isArray(s.items)) {
        const items = s.items.filter((it) => !(it && typeof it === 'object' && it.group === undefined && !it.grp && /^\s*hidden\s*[-–—:]\s*/i.test(String(it.l != null ? it.l : (it.b || '')))));
        if (items.length !== s.items.length) s = { ...s, items };
      }
      // SIDEBAR-TIGHTEN-001: apply the owner's sidebar abbreviations to list strings
      // and labeled l/v values BEFORE the per-id passes below (several of them return
      // early). Reassigns s and falls through.
      if (s.loc === 'sidebar' && Array.isArray(s.items)) {
        // SIDEBAR-GROUP-MERGE-001: fold owner-specified related category-groups
        // (e.g. Imaging -> Optics, photonics & sensing) before the abbr pass.
        const _mg = _mergeSidebarGroups(s.items);
        if (_mg !== s.items) s = { ...s, items: _mg };
        const _abbr = (t) => {
          if (typeof t !== 'string') return t;
          let out = t;
          for (const [re, to] of SIDEBAR_ABBR) out = out.replace(re, to);
          out = _balanceParens(out);
          return out;
        };
        let hitAbbr = false;
        const items = s.items.map((it) => {
          if (typeof it === 'string') { const v = _abbr(it); if (v !== it) { hitAbbr = true; return v; } return it; }
          if (it && typeof it === 'object') {
            const patch = {};
            for (const k of ['l', 'v', 'label', 'value']) {
              const v = _abbr(it[k]);
              if (v !== it[k]) patch[k] = v;
            }
            if (Object.keys(patch).length) { hitAbbr = true; return { ...it, ...patch }; }
          }
          return it;
        });
        if (hitAbbr) s = { ...s, items };
      }
      // (0) URUGUAYAN-VARIANT-STRIP-001: strip regional qualifier from Spanish language line.
      if ((s.id === 'languages' || /^languages?$/i.test(String(s.title || s.id || ''))) && Array.isArray(s.items)) {
        const items = _stripUruguayan(s.items);
        if (items !== s.items) return { ...s, items };
      }
      // SLOGAN-PLACEMENT-001 export parity: in 'leadin' mode inject the slogan as
      // the opening's first-item lead-in so the DOCX/PDF matches the preview (the
      // standalone tagline is hidden via slogan_hidden above).
      if (s.id === 'opening' && typeof window !== 'undefined' && window.__antcvSloganOpeningLeadIn && window.__antcvSloganMode && window.__antcvSloganMode() === 'leadin') {
        let __sl = '';
        try {
          __sl = String((typeof meta !== 'undefined' && meta && meta.cl_slogan) || '').trim();
          if (!__sl || /^\[/.test(__sl)) {
            let __ov = String(localStorage.getItem('antcv:clSlogan') || '').trim();
            // SLOGAN-LANG-GATE-001: a wrong-language override never becomes the lead-in either.
            try { if (__ov && typeof window.__antcvSloganLangGate === 'function' && !window.__antcvSloganLangGate(__ov)) __ov = ''; } catch (_) {}
            __sl = __ov;
          }
          if (window.__antcvSloganCap) __sl = window.__antcvSloganCap(__sl);
        } catch (_) {}
        const __os = window.__antcvSloganOpeningLeadIn(s, __sl);
        if (__os !== s) return __os;
      }
      // (1) strip fabricated tools from any tools comma-list (Nordea analytics -> Snowflake/
      // DBT, which the candidate does not use). Always, regardless of targeted/unsolicited.
      if (s.id === 'tools' && Array.isArray(s.items)) {
        let hit = false;
        const items = s.items.map((it) => {
          if (!it || typeof it.v !== 'string' || !FAB_TOOLS.test(it.v)) return it;
          const v = it.v.split(/\s*,\s*/).filter((p) => p && !FAB_TOOLS.test(p)).join(', ');
          if (v !== it.v) { hit = true; return { ...it, v }; }
          return it;
        });
        return hit ? { ...s, items } : s;
      }
      // (1b) strip fabricated tools from TABLE cells too (e.g. CORE COMPETENCIES expertise
      // "SQL, Snowflake, data transformation jobs" — the same fabrication, second location).
      if ((s.type === 'table' || Array.isArray(s.rows)) && Array.isArray(s.rows)) {
        let hit = false;
        const rows = s.rows.map((row) => {
          if (!Array.isArray(row)) return row;
          return row.map((cell) => {
            if (typeof cell !== 'string' || !FAB_TOOLS.test(cell)) return cell;
            const v = cell.split(/\s*,\s*/).filter((p) => p && !FAB_TOOLS.test(p)).join(', ');
            if (v !== cell) { hit = true; return v; }
            return cell;
          });
        });
        return hit ? { ...s, rows } : s;
      }
      // (2) for a JD-TARGETED application, hide the clearly-irrelevant student roles
      // (student council, dormitory security guard) — no signal for a senior professional
      // application. Set on:false (the worker's existing hide flag), don't drop the row.
      // Unsolicited keeps the full breadth.
      // (2b) hide the Publications & Patents section for a targeted application UNLESS the JD
      // is research/technical (owner: irrelevant for an analyst role). Set on:false; the
      // unsolicited kernel and research JDs keep it.
      if (targeted && !_jdIsResearch() && /publication|patent/i.test(String(s.title || s.id || ''))) {
        return { ...s, on: false };
      }
      if (targeted && s.type === 'experience' && Array.isArray(s.roles)) {
        // hide the irrelevant roles FIRST: always-low-signal ones, plus the cluster-dependent
        // sysadmin role when the JD is not an IT/ops role.
        const hideTech = !_jdIsTechOps();
        let roles = s.roles.map((r) => {
          if (!r || r.on === false) return r;
          const hay = String(r.title || '') + ' ' + String(r.company || '');
          if (IRRELEVANT_ROLE.test(hay) || (hideTech && CLUSTER_ROLE.test(hay))) return { ...r, on: false };
          return r;
        });
        // ...then consolidate same-company roles among what remains visible.
        const merged = mergeSameCompanyRoles(roles);
        if (merged) roles = merged;
        return { ...s, roles };
      }
      return s;
    }).filter((s) => !(targeted && s && !_jdIsResearch() && /publication|patent/i.test(String(s.title || s.id || ''))));
  } catch (_) { return docSections; }
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
    // TABLE-HEADER-INK-001 (owner 2026-07-13, "table header is hardly
    // visible on the background"): tableHeaderBg passed through WITHOUT its
    // ink token, so a pale stored bg (#DDE6F2) met the worker's package
    // default ink (white on the brand band) — near-invisible and a
    // color-blind accessibility failure. Pass the stored ink through, and
    // (below) compute a contrast-correct ink whenever the bg travels alone.
    'tableHeaderText',
    // COPENHAGEN-TABLE-FRAME-001 (mockup lock 2026-07-22): banded rows follow
    // the package token (worker falls back to #DCE5EA, the Copenhagen band),
    // and the cyan outer frame renders only when the package defines it.
    'tableEvenBg',
    'tableFrameColor',
  ];
  for (const k of passthrough) {
    if (styleConfig[k] != null) out[k] = styleConfig[k];
  }
  // CONTRAST-GUARD-001 (owner 2026-07-13, STANDING accessibility rule: "even
  // when you get company brand colors always fit visibility for vision
  // impaired users"). Every text ink is validated against its fill; a pair
  // below ~3:1 contrast is replaced by the luminance-correct ink. This caught
  // live: white table-header ink on pale #DDE6F2, gray #666666 sidebar
  // headings on brand green #76B900.
  const __lum = (hex) => {
    const h = String(hex || '').replace('#', '');
    if (h.length < 6) return null;
    const c = (i) => {
      let v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * c(0) + 0.7152 * c(2) + 0.0722 * c(4);
  };
  const __contrast = (a, b) => {
    const la = __lum(a), lb = __lum(b);
    if (la == null || lb == null) return 21;
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const __ensureInk = (bgKey, inkKeys) => {
    const bg = out[bgKey];
    if (!bg) return;
    // pick whichever candidate actually contrasts more (a mid-luminance
    // saturated brand green fails WHITE at ~2.4:1 while near-black passes ~9:1)
    const good = __contrast(bg, '333333') >= __contrast(bg, 'FFFFFF') ? '333333' : 'FFFFFF';
    for (const k of inkKeys) {
      if (!out[k] || __contrast(bg, out[k]) < 3) out[k] = good;
    }
  };
  __ensureInk('tableHeaderBg', ['tableHeaderText']);
  __ensureInk('sidebarBg', ['sidebarTextColor', 'sidebarLabelColor', 'sidebarHeadColor']);
  __ensureInk('headerBg', ['headerNameColor', 'headerSpecColor', 'headerContactColor']);
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
  // BRAND-EXPORT-PARITY-001 (owner 2026-07-17): the EXPORT-PALETTE-PARITY-001 block
  // above resolves --header-bg/--sidebar-bg from getComputedStyle(document.body) — the
  // PACKAGE token. But a per-app BRAND applies its colours as an INLINE var on the
  // paper-WRAPPER (a descendant, app.js BRANDFIT-CANDIDATE-SIDEBAR-OVERRIDE-001), which
  // document.body never sees, and :root defines a default --header-bg (#33446F), so the
  // block above silently reverted the export to the package band even for a brand-fitted
  // (custom-package) app — the raw teal/navy export the owner reported. When a brand is
  // ACTIVE (upload-panel Brand-fit flag), re-assert the brand from the SAME source the
  // apply wrote — brandV2 slots if published (restore/re-collection), else the live
  // styleConfig the brand-fit apply sets on a fresh generate (headerBg/sidebarBg/
  // photoBorderColor). Gated on __antcvBrandFit so non-branded package exports are
  // untouched. Contrast (readable ink) recomputed here so a light brand can't go
  // white-on-white in the band.
  try {
    if (typeof window !== 'undefined' && window.__antcvBrandFit === true) {
      const inkB = (hex) => {
        const h = String(hex || '').replace('#', '');
        if (h.length < 6) return '#FFFFFF';
        const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
        return (0.2126 * r + 0.7152 * g + 0.0722 * b > 140) ? '#283556' : '#FFFFFF';
      };
      let bH = null, bS = null, bA = null;
      try {
        const raw = (typeof localStorage !== 'undefined') ? localStorage.getItem('antcv:brandV2') : null;
        if (raw) { const bv = JSON.parse(raw); const sl = (bv && bv.slots) ? bv.slots : ((bv && bv.headerBg) ? bv : null);
          if (sl) { bH = sl.headerBg || null; bS = sl.sidebarBg || null; bA = sl.accent || null; } }
      } catch (_) {}
      if (!bH && styleConfig && typeof styleConfig === 'object') { bH = styleConfig.headerBg || null; bS = styleConfig.sidebarBg || null; bA = styleConfig.photoBorderColor || null; }
      const isHex = (v) => typeof v === 'string' && /^#?[0-9a-fA-F]{6}$/.test(v.trim());
      if (isHex(bH)) { out.headerBg = bH; out.headerNameColor = inkB(bH); out.headerSpecColor = inkB(bH); out.headerContactColor = inkB(bH); out.tableHeaderBg = bH; out.tableHeaderText = inkB(bH); }
      if (isHex(bS)) { out.sidebarBg = bS; out.sidebarTextColor = inkB(bS); out.sidebarLabelColor = inkB(bS); }
      if (isHex(bA)) { out.photoBorderColor = bA; out.sidebarHeadColor = bA; }
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
    // HDR-TYPE-CONTROLS-001 (owner 2026-07-29): the application line and the CL
    // slogan are panel-sized now, and all five identity lines carry a letter-
    // spacing delta (pt, 0.05 steps). This whitelist is the DOCX leg's only gate
    // — a key missing here is a control the user cannot reach in the export.
    'applicationSize', 'sloganSize',
    'nameTrack', 'specTrack', 'applicationTrack', 'contactTrack', 'sloganTrack',
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
      // QA-STANDALONE-PAGE-001: a section's OWN pageBreakBefore (set by the
      // application-qa scaffold) was dropped here — only measurer/manual breaks
      // survived, so the Q&A page never hard-broke in the PDF. Honor it.
      ...(sectionBreakIds.has(s.id) || s.pageBreakBefore === true ? { pageBreakBefore: true } : {}),
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

      case 'rich_block': {
        // RICH-BLOCK-001: universal composite section — N rows of {b: bold lead-in,
        // t: body}, plus headline/rule visibility toggles. Per-row + section CJLR ride
        // base.item_alignment (alignFor: "items.<i>" + "__group__"). Per-row page from
        // itemPagesMap (>=2). bOff/tOff drop the lead-in / body; a fully-empty or hidden
        // row is dropped so no orphan paragraph exports.
        // PROFILE-ORPHAN-001 (owner 2026-07: "handle the profile orphan"). A prose paragraph that
        // wraps to a single short word on the last line reads as an orphan. Glue the last two words
        // with a non-breaking space so the final line always carries >=2 words (typographic orphan
        // fix) — only for the prose sections, only when the last word is short, never on a bullet.
        const __proseGlue = { profile: 1, work_style: 1, opening: 1, who: 1, why: 1, foundation: 1 };
        const _glueOrphan = (txt) => {
          if (!__proseGlue[s.id]) return txt;
          const m = String(txt).match(/^([\s\S]*\S)[ \t]+(\S{1,16})$/);
          return m ? m[1] + String.fromCharCode(160) + m[2] : txt;
        };
        const items = (s.items || []).map((it, i) => {
          if (s.hidden && s.hidden[i]) return null;
          const row = it && typeof it === 'object' ? it : { t: String(it || '') };
          // grp row = bold sub-heading (no lead/body); drop if empty.
          if (row.grp) { const gt = clean(row.t) || ''; return gt ? { grp: true, t: gt } : null; }
          const b = row.bOff ? '' : (clean(row.b) || '');
          const t = row.tOff ? '' : (row.mk ? (clean(row.t) || '') : _glueOrphan(clean(row.t) || ''));
          if (!b && !t) return null;
          // mk: true (default bullet) or a custom emoji string — pass through as-is.
          return row.mk ? { b, t, mk: (typeof row.mk === 'string' ? row.mk : true) } : { b, t };
        }).filter(Boolean);
        // RICH-BLOCK-AUTO-PAGE-001 (owner 2026-06-25 "certificates is still a tail to page 1"):
        // merge the MANUAL itemPages with the coordinator's AUTO autoPages — the table case
        // already does this, but the rich_block case used itemPagesMap ALONE, so a rich_block
        // SIDEBAR section (CERTIFICATES, REGULATORY, INTERESTS, TOOLS) never received its auto
        // page break and the worker tailed it onto page 1 instead of the coordinator's page.
        // The worker's rich_block render breaks on row_pages (>=2), so this makes the EXPORT
        // honour the same per-section pagination the preview shows.
        const _rpM = (s.id && itemPagesMap && typeof itemPagesMap[s.id] === 'object') ? itemPagesMap[s.id] : null;
        const _rpA = (s.id && autoPagesRaw && typeof autoPagesRaw[s.id] === 'object') ? autoPagesRaw[s.id] : null;
        // GROUP-HEADER-MANUAL-BREAK-001 (owner 2026-06-25): mirror the preview's group-aware snap on
        // EXPORT. A MANUAL break on a group's FIRST content row must carry the group HEADING with it,
        // else the worker breaks AFTER the header and orphans it on the previous page. The worker emits
        // one page-break before whichever row carries row_pages>=2 (it has NO running-page floor), so
        // MOVE the break from the first content row UP to its group header: set the header's page and
        // CLEAR the content row's entry (adding both would double-break). Result: a single break before
        // the header, header + rows flow to the next page together. Auto breaks already snap to a group
        // start in the coordinator, so only the MANUAL map is adjusted. (Same logic as the preview's
        // __antcvSnapManualToGroup in app.src.js, with MOVE semantics for the floor-less worker.)
        let _rpMUse = _rpM;
        if (_rpM && Array.isArray(s.items)) {
          let _need = false; for (const k in _rpM) { if (parseInt(_rpM[k], 10) >= 2) { _need = true; break; } }
          if (_need) {
            _rpMUse = Object.assign({}, _rpM);
            for (const k in _rpM) {
              const p = parseInt(_rpM[k], 10), i = parseInt(k, 10);
              if (!(p >= 2) || !(i >= 1)) continue;
              const cur = s.items[i];
              if (!cur || (typeof cur === 'object' && cur.grp)) continue;          // only a CONTENT row can be a first-content-row
              let j = i - 1; while (j >= 0 && s.hidden && s.hidden[j]) j--;          // nearest VISIBLE predecessor
              const prev = j >= 0 ? s.items[j] : null;
              if (prev && typeof prev === 'object' && prev.grp) {                    // predecessor is the group HEADER
                _rpMUse[String(j)] = Math.max(parseInt(_rpMUse[String(j)], 10) || 1, p);
                delete _rpMUse[String(i)];                                          // MOVE (not add) — the floor-less worker would double-break
              }
            }
          }
        }
        let rowPages = null;
        if (_rpMUse || _rpA) {
          rowPages = {};
          [_rpMUse, _rpA].forEach((src) => { if (src) for (const k in src) { const n = parseInt(src[k], 10); if (Number.isFinite(n) && n >= 2) rowPages[k] = Math.max(rowPages[k] || 0, n); } });
          if (!Object.keys(rowPages).length) rowPages = null;
        }
        return {
          ...base,
          items,
          ...(s.headlineOff ? { headlineOff: true } : {}),
          // WHY-RULE-EXPORT-PARITY-001 (owner 2026-07-03): antcv-cl-text-cleanup sets
          // headlineRule on the WHY section (the standalone accent line the preview
          // draws); the worker supports it (RULE-INDEPENDENT-001) but this payload
          // case never forwarded it — the line showed in preview, not in the export.
          ...(s.headlineRule ? { headlineRule: true } : {}),
          ...(s.ruleOff ? { ruleOff: true } : {}),
          ...(rowPages ? { row_pages: rowPages } : {}),
          ...(s.leadBold === false ? { leadBold: false } : {}),
          ...(s.leadItalic ? { leadItalic: true } : {}),
          ...(s.leadColor ? { leadColor: s.leadColor } : {}),
          ...(s.leadColon ? { leadColon: true } : {}),
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
        let autoR = (s.id && autoPagesRaw && typeof autoPagesRaw[s.id] === 'object') ? autoPagesRaw[s.id] : null;
        // AUTOPAGES-ITEM-TO-ROLE-001 (owner 2026-07-14, cutover regression): when the
        // roles-as-rich_block cutover is on, the experience PREVIEW is a FLATTENED items[]
        // (role heads + bullets), so the autoPages measurer keys page-breaks by ITEM index
        // (e.g. 13/36/66) — but the loop below reads autoR by ROLE index (0..N). Translate
        // item→role via the adapter's item._key ('roles.R') mapping, else no role.page is
        // set and the export loses every role split + "(Cont.)" heading and collapses the
        // two columns into a sequential multi-page PDF. No-op (returns autoR) when off.
        if (autoR && window.AntcvRolesRichBlock && typeof window.AntcvRolesRichBlock.isOn === 'function'
            && window.AntcvRolesRichBlock.isOn()
            && typeof window.AntcvRolesRichBlock.itemAutoPagesToRoleAutoPages === 'function') {
          autoR = window.AntcvRolesRichBlock.itemAutoPagesToRoleAutoPages(s, autoR);
        }
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
            // CERTS-PLACEHOLDER-LEAK-001 (owner bug #7, 2026-06-23): bracketed
            // template placeholders ("[Certification name - issuer, year]") leaked
            // into exported list sections (CERTIFICATES & COURSES) because the list
            // mapper never ran clean() — unlike text/text_bullets. Strip a value that
            // is ENTIRELY one bracketed placeholder to '' so it drops, never exports.
            if (it == null) return null;
            if (typeof it === 'string') return clean(it.trim()) || null;
            if (typeof it !== 'object') return clean(String(it).trim()) || null;
            // Object — try {l, v} (labeled-list shape sneaking in)
            const l = clean((it.l || it.label || '').toString().trim());
            const v = clean((it.v || it.value || '').toString().trim());
            if (l && v) return `${l}: ${v}`;
            if (l) return l;
            if (v) return v;
            // Try common single-string fields
            for (const k of ['text', 'title', 'name', 'body', 'content', 'citation']) {
              const val = it[k];
              if (typeof val === 'string' && val.trim()) { const t = clean(val.trim()); if (t) return t; }
            }
            return null;
          }),
          ...(s.hidden ? { hidden: s.hidden } : {}),
          // PUB-MASTERSITE-EXPORT-001 (spec rule 35, register row 28): the
          // publications masterSite link (PUB-MASTERSITE-001) rendered in the
          // PREVIEW (app.src.js anchor) and the WORKER supports it as a real
          // ExternalHyperlink — but this payload case never forwarded it, so
          // the exported PDF silently dropped the Google Scholar link. Forward
          // it sanitized (http(s) only).
          ...((s.masterSite && s.masterSite.on && typeof s.masterSite.url === 'string' && /^https?:\/\//i.test(s.masterSite.url))
            ? { masterSite: { on: true, label: String(s.masterSite.label || ''), url: s.masterSite.url } }
            : {}),
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
            // CERTS-PLACEHOLDER-LEAK-001: strip bracketed placeholders from l/v
            // (same leak as the 'list' case); a row that ends up fully empty with
            // no group/subhead/header/category marker is dropped (orphan placeholder).
            const out = { l: clean(String(it.l || '').trim()), v: clean(String(it.v || '').trim()) };
            if (it.group)    out.group    = String(it.group);
            if (it.subhead)  out.subhead  = String(it.subhead);
            if (it.header)   out.header   = String(it.header);
            if (it.category) out.category = String(it.category);
            if (!out.l && !out.v && !out.group && !out.subhead && !out.header && !out.category) return null;
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
// CLUSTER-QUAL-001 (owner 2026-06-19): rank outcomes/results by a BLENDED score —
// "numeric + skill-relevant = higher score" — not numeric alone. numNorm =
// min(1, _metricScore/10) (a 90% cut / 10× / 250→10 saturates to 1); demNorm =
// min(1, demand/25) from the 20-most-demanded model (window.AntcvClusterDemand,
// antcv-cluster-demand.js, loaded as a sidecar). score = numNorm + demNorm (0..2).
// Read-only + guarded: demNorm is 0 when the model is absent, so this degrades to the
// prior pure-numeric ordering (RESULTS-NUMERIC-LEAD-001). Used wherever outcomes sort.
const _demandNorm = (text) => {
  try {
    const d = (typeof window !== 'undefined') && window.AntcvClusterDemand;
    return (d && typeof d.scoreNorm === 'function') ? d.scoreNorm(String(text || '')) : 0;
  } catch (_) { return 0; }
};
const _rankScore = (text) => Math.min(1, _metricScore(text) / 10) + _demandNorm(text);
// RESULTS-NEAR-DUP-001 (owner 2026-06-19): the lamination joins a role's top-2
// outcomes, but those two are often the SAME fact phrased twice (Sirin: "Direct a
// 7-person task force…" + "Directed a 7-person EO and optics team…"). Collapse
// near-duplicate texts BEFORE the join, keeping the stronger/numeric one (higher
// _metricScore; tie → longer). Light stem (strip ied/ed/ing/s) so "Direct"/
// "Directed", "optic"/"optics" match. Two texts are near-dupes when they share ≥3
// stemmed tokens AND EITHER (a) ≥0.6 of the smaller token set overlaps (short
// paraphrases), OR (b) they open on the SAME verb+object headline — identical first
// two meaningful stems (e.g. both "Direct(ed) a 7-person …" / "direct,person"). The
// real Sirin pair shares only 0.44 of tokens (each has distinct tail detail) but the
// same achievement headline, so the anchor clause is what catches it. Mirrored in
// antcv-results-laminate-510.js lamFor (preview parity).
const _ndStem = (s) => (String(s == null ? '' : s).toLowerCase().match(/[a-zà-ɏ]{3,}/g) || []).map((w) => w.replace(/(?:ied|ed|ing|s)$/, ''));
function _dedupNear(texts) {
  const kept = [];
  (texts || []).forEach((t) => {
    if (typeof t !== 'string' || !t.trim()) return;
    const arr = _ndStem(t), toks = new Set(arr), lead = arr.slice(0, 2);
    const sc = _metricScore(t);
    if (!toks.size) { kept.push({ text: t, toks, lead, sc }); return; }
    let dup = -1;
    for (let i = 0; i < kept.length; i++) {
      const k = kept[i]; if (!k.toks.size) continue;
      let shared = 0; toks.forEach((w) => { if (k.toks.has(w)) shared++; });
      if (shared < 3) continue;
      const overlap = shared / Math.min(toks.size, k.toks.size) >= 0.6;
      const sameHead = lead.length === 2 && k.lead.length === 2 && lead[0] === k.lead[0] && lead[1] === k.lead[1];
      if (overlap || sameHead) { dup = i; break; }
    }
    if (dup < 0) { kept.push({ text: t, toks, lead, sc }); return; }
    const cur = kept[dup];
    if (sc > cur.sc || (sc === cur.sc && t.length > cur.text.length)) kept[dup] = { text: t, toks, lead, sc };
  });
  return kept.map((k) => k.text);
}
// PAN-IDRAET-BULLET-NEARDUP-001 (owner export-16 2026-07-02): a role can carry two
// bullets that are the SAME fact phrased twice — Pan Idræt's "Manage logistics for
// about 25 players and coaches…" (b1) vs "Manage logistics for 25 players…" (b3).
// _dedupNear collapses this for Results joins; apply the SAME anchor-clause/overlap
// predicate to a role's own bullets so the export never prints the near-dup twice.
// Bullets may be strings or {b,t} objects. Winner tiebreak follows the owner's
// preference for the CLEANER line ("25 players" over "about 25 players"): higher
// _metricScore first; tie → fewer approximation words (about/roughly/…); tie →
// shorter. The winner keeps its ORIGINAL bullet object (string or {b,t}) and the
// earlier slot, so order and any per-bullet fields survive. Non-text bullets pass
// through untouched. Export-side only (like hideSubsumed) — stored sections and the
// index-based preview edit path are never mutated. KEEP_MIN is enforced by the caller.
// (_bulletText — string|{b,t} → text — is already defined above at module scope.)
const _approxCount = (s) => (String(s == null ? '' : s).match(/\b(?:about|roughly|approximately|around|approx|circa)\b|~/gi) || []).length;
function _dedupNearBullets(bullets) {
  const kept = [];
  (bullets || []).forEach((b) => {
    const text = _bulletText(b);
    if (!text || !text.trim()) { kept.push({ b }); return; }   // preserve non-text bullets as-is
    const arr = _ndStem(text), toks = new Set(arr), lead = arr.slice(0, 2);
    const sc = _metricScore(text), ap = _approxCount(text), len = text.length;
    if (!toks.size) { kept.push({ b, toks, lead, sc, ap, len }); return; }
    let dup = -1;
    for (let i = 0; i < kept.length; i++) {
      const k = kept[i]; if (!k.toks || !k.toks.size) continue;
      let shared = 0; toks.forEach((w) => { if (k.toks.has(w)) shared++; });
      if (shared < 3) continue;
      const overlap = shared / Math.min(toks.size, k.toks.size) >= 0.6;
      const sameHead = lead.length === 2 && k.lead.length === 2 && lead[0] === k.lead[0] && lead[1] === k.lead[1];
      if (overlap || sameHead) { dup = i; break; }
    }
    if (dup < 0) { kept.push({ b, toks, lead, sc, ap, len }); return; }
    const cur = kept[dup];
    const better = sc > cur.sc
      || (sc === cur.sc && ap < cur.ap)
      || (sc === cur.sc && ap === cur.ap && len < cur.len);
    if (better) kept[dup] = { b, toks, lead, sc, ap, len };
  });
  return kept.map((k) => k.b);
}
// KEEP-MIN floor (mirrors applyOutcomesMode's keepMin, owner KEEP-MIN-BULLETS-001):
// a within-role collapse must NOT drop a role below min(2, original count) bullets.
function _keepMinBullets(original, collapsed) {
  const o = Array.isArray(original) ? original : [];
  const c = Array.isArray(collapsed) ? collapsed : o;
  return (c.length >= Math.min(2, o.length)) ? c : o;
}
// PAN-IDRAET-BACKFILL-001 (owner 2026-07-02: "if there is less than 2 bullets left
// after collapse - add more info from the user database. for a reasonable user there
// should be more data"). Same near-dup predicate as _dedupNearBullets, kept SEPARATE
// so the shipped, live-verified _dedupNearBullets stays untouched: two texts are
// near-dupes when they share >=3 stemmed tokens AND EITHER >=0.6 of the smaller token
// set overlaps OR they open on the same verb+object headline. Used by the BUILD-TIME
// backfill sidecar (antcv-neardup-backfill.js) — which appends a distinct bullet to
// the STORED role so preview AND export both show it (parity by construction; an
// export-only backfill would desync the hide-only preview mirror).
function _nearDupText(a, b) {
  const sa = _ndStem(a), sb = _ndStem(b);
  const ta = new Set(sa), tb = new Set(sb);
  if (!ta.size || !tb.size) return false;
  let shared = 0; ta.forEach((w) => { if (tb.has(w)) shared++; });
  if (shared < 3) return false;
  const overlap = shared / Math.min(ta.size, tb.size) >= 0.6;
  const sameHead = sa.length >= 2 && sb.length >= 2 && sa[0] === sb[0] && sa[1] === sb[1];
  return overlap || sameHead;
}
// normalized title|company signature for matching a doc-section role back to its
// kernel role in personalInfo (kernel roles carry no stable id).
function _sigOf(title, company) {
  const n = (x) => String(x == null ? '' : x).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const s = n(title) + '|' + n(company);
  return s === '|' ? '' : s;
}
function _roleKernelMatch(role, kroles) {
  if (!role || !Array.isArray(kroles) || !kroles.length) return null;
  const rid = role.id != null ? String(role.id) : '';
  if (rid) { const byId = kroles.find((k) => k && k.id != null && String(k.id) === rid); if (byId) return byId; }
  const sig = _sigOf(role.title, role.company);
  return sig ? (kroles.find((k) => k && _sigOf(k.title, k.company) === sig) || null) : null;
}
// Gather up to `need` DISTINCT extra bullets from the user's own data for this role:
// kernel bullets (workHistory/experience/roles, matched by id or title|company), then
// on-role outcomes / proofPoints, then resolved proofPointIds. Each candidate is
// filtered (exact + near-dup) against the surviving bullets, the already-picked
// backfills and the role's Results line, so a duplicate is never re-introduced.
// Returned as plain-string bullets re-tensed to the chosen export tense (no-op for
// 'auto'). Pure w.r.t. the role object — the sidecar appends the result to STORED
// bullets.
function _backfillRoleBullets(role, surviving, need) {
  if (!role || !(need > 0)) return [];
  let pi = {}, tmode = 'auto';
  try { const raw = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; pi = raw.personalInfo ? raw.personalInfo : raw; } catch (_) {}
  try { tmode = _expTenseMode(); } catch (_) {}
  const kroles = [].concat(pi.workHistory || [], pi.experience || [], pi.roles || []).filter(Boolean);
  const km = _roleKernelMatch(role, kroles);
  const ppText = {};
  try { [].concat(pi.proofPointsByRole || [], pi.proofPointsByPosition || []).forEach((p) => { if (p && p.id && typeof p.text === 'string') ppText[p.id] = p.text; }); } catch (_) {}
  const _oText = (o) => typeof o === 'string' ? o : (o ? String(o.result || o.text || [o.b, o.t].filter(Boolean).join(' ') || o.title || '').trim() : '');
  const cand = [];
  if (km && Array.isArray(km.bullets)) km.bullets.forEach((b) => { const t = _bulletText(b); if (t) cand.push(t); });
  if (Array.isArray(role.outcomes)) role.outcomes.forEach((o) => { const t = _oText(o); if (t) cand.push(t); });
  if (Array.isArray(role.proofPoints)) role.proofPoints.forEach((p) => { const t = _oText(p); if (t) cand.push(t); });
  if (Array.isArray(role.proofPointIds)) role.proofPointIds.forEach((id) => { const t = ppText[id]; if (t) cand.push(t); });
  const block = (Array.isArray(surviving) ? surviving.map(_bulletText) : []).filter(Boolean);
  if (typeof role.results === 'string' && role.results.trim()) block.push(role.results.trim());
  const out = [];
  for (const raw of cand) {
    const t = String(raw == null ? '' : raw).trim();
    if (!t) continue;
    const lc = t.toLowerCase();
    if (block.some((x) => x.toLowerCase() === lc) || out.some((x) => x.toLowerCase() === lc)) continue;   // exact
    if (block.some((x) => _nearDupText(x, t)) || out.some((x) => _nearDupText(x, t))) continue;           // near-dup
    out.push(t);
    if (out.length >= need) break;
  }
  return out.map((t) => { try { return _tenseLead(t, tmode); } catch (_) { return t; } });
}
// Collapse one role's near-dup bullets, KEEP_MIN-guarded; returns the SAME role
// object reference when nothing changed (so callers can cheaply detect a no-op).
function _collapseRoleBullets(r) {
  if (!r || typeof r !== 'object' || !Array.isArray(r.bullets) || r.bullets.length < 2) return r;
  const collapsed = _dedupNearBullets(r.bullets);
  if (collapsed.length >= r.bullets.length) return r;      // nothing collapsed
  const kept = _keepMinBullets(r.bullets, collapsed);
  return kept === r.bullets ? r : { ...r, bullets: kept };
}
export { _dedupNearBullets, _collapseRoleBullets, _keepMinBullets, _backfillRoleBullets, sanitizeForExport, placeholderGate };
// PAN-IDRAET-PREVIEW-HIDE-001: expose the SAME collapse predicate the export uses so
// the preview-hide sidecar (antcv-neardup-preview-hide.js) can never drift from it.
// PAN-IDRAET-BACKFILL-001: also expose the raw near-dup collapse + the distinct-data
// backfill so the build-time backfill sidecar reuses THIS module's logic (no drift).
try {
  if (typeof window !== 'undefined') {
    window.AntcvCollapseRoleBullets = _collapseRoleBullets;
    window.AntcvDedupNearBullets = _dedupNearBullets;
    window.AntcvBackfillRoleBullets = _backfillRoleBullets;
  }
} catch (_) {}
// TENSE-AT-LAMINATION-001 (owner 2026-06-19: "I want the tense the user chose to be
// the generated tense — the app already takes too much work time"). Generation already
// writes bullets/outcomes in the chosen tense via the prompt's __tenseRule; but a
// role's laminated RESULTS come from the KERNEL outcomes/proof-points, which keep the
// kernel's tense. Re-tensing them HERE — inside the lamination pass that already runs
// for preview + export — keeps the chosen tense without a separate runtime sidecar.
const _T_B2P = { own: 'owned', build: 'built', run: 'ran', design: 'designed', drive: 'drove', deliver: 'delivered', implement: 'implemented', establish: 'established', ship: 'shipped', reduce: 'reduced', cut: 'cut', scale: 'scaled', map: 'mapped', translate: 'translated', coordinate: 'coordinated', negotiate: 'negotiated', resolve: 'resolved', investigate: 'investigated', validate: 'validated', qualify: 'qualified', author: 'authored', chair: 'chaired', guide: 'guided', mentor: 'mentored', restructure: 'restructured', initiate: 'initiated', configure: 'configured', specify: 'specified', direct: 'directed', supervise: 'supervised', architect: 'architected', lead: 'led', manage: 'managed', develop: 'developed', create: 'created', launch: 'launched', improve: 'improved', increase: 'increased', secure: 'secured', oversee: 'oversaw', define: 'defined', support: 'supported', maintain: 'maintained', test: 'tested', present: 'presented', review: 'reviewed', plan: 'planned', set: 'set', put: 'put', hit: 'hit', optimize: 'optimized', optimise: 'optimised', streamline: 'streamlined', head: 'headed', handle: 'handled', perform: 'performed', conduct: 'conducted', execute: 'executed', introduce: 'introduced', migrate: 'migrated', automate: 'automated',
  // TENSE-VERBMAP-EXPAND-001 (owner 2026-06-19, item D): the fold left many real
  // result/outcome leading verbs PAST because they were absent from the map
  // (Administered, Represented, Taught, Worked…). Add the common CV action verbs.
  administer: 'administered', represent: 'represented', teach: 'taught', work: 'worked', respond: 'responded', monitor: 'monitored', provision: 'provisioned', convert: 'converted', customize: 'customized', customise: 'customised', characterize: 'characterized', characterise: 'characterised', deploy: 'deployed', enable: 'enabled', track: 'tracked', ensure: 'ensured', facilitate: 'facilitated', organize: 'organized', organise: 'organised', standardize: 'standardized', standardise: 'standardised', assess: 'assessed', analyze: 'analyzed', analyse: 'analysed', evaluate: 'evaluated', prepare: 'prepared', generate: 'generated', integrate: 'integrated', produce: 'produced', achieve: 'achieved', complete: 'completed', contribute: 'contributed', demonstrate: 'demonstrated', identify: 'identified', measure: 'measured', operate: 'operated', process: 'processed', provide: 'provided', report: 'reported', research: 'researched', select: 'selected', simplify: 'simplified', solve: 'solved', train: 'trained', upgrade: 'upgraded', verify: 'verified', win: 'won', grow: 'grew', save: 'saved', spearhead: 'spearheaded', champion: 'championed', overhaul: 'overhauled', consolidate: 'consolidated', modernize: 'modernized', modernise: 'modernised', refactor: 'refactored', benchmark: 'benchmarked', forecast: 'forecast', write: 'wrote',
  // TENSE-VERBMAP-EXPAND-002 (owner 2026-06-20): "align"/"co-organised" stayed PAST in the
  // Results — "align" was absent and the hyphen broke the match (now fixed in _tenseLead).
  // Add more common CV action verbs with unambiguous past forms.
  align: 'aligned', liaise: 'liaised', leverage: 'leveraged', prioritize: 'prioritized', prioritise: 'prioritised', synthesize: 'synthesized', synthesise: 'synthesised', visualize: 'visualized', visualise: 'visualised', advise: 'advised', devise: 'devised', revise: 'revised', partner: 'partnered', position: 'positioned', pioneer: 'pioneered', accelerate: 'accelerated', double: 'doubled', triple: 'tripled', undertake: 'undertook', enhance: 'enhanced', expand: 'expanded', unify: 'unified', bridge: 'bridged', foster: 'fostered', cultivate: 'cultivated', orchestrate: 'orchestrated', transform: 'transformed', calibrate: 'calibrated', fabricate: 'fabricated', prototype: 'prototyped', simulate: 'simulated', audit: 'audited', mitigate: 'mitigated', remediate: 'remediated', document: 'documented', draft: 'drafted', compile: 'compiled', curate: 'curated', aggregate: 'aggregated', normalize: 'normalized', normalise: 'normalised', classify: 'classified', predict: 'predicted', recommend: 'recommended', coach: 'coached', recruit: 'recruited', onboard: 'onboarded', redesign: 'redesigned', rebuild: 'rebuilt', reorganize: 'reorganized', reorganise: 'reorganised' };
const _T_P2B = {}; for (const k in _T_B2P) _T_P2B[_T_B2P[k]] = k;
function _tenseLead(text, mode) {
  if ((mode !== 'present' && mode !== 'past') || typeof text !== 'string' || !text) return text;
  // TENSE-HYPHEN-001 (owner 2026-06-20): capture HYPHENATED leading verbs too
  // (co-organised, re-architected). The old [A-Za-z]+ stopped at the hyphen, read
  // "co", missed the map, and left "co-organised" in past tense.
  const m = text.match(/^(\s*(?:<[^>]+>\s*|\*{1,2}\s*)*)([A-Za-z][A-Za-z-]*)/);
  if (!m) return text;
  const prefix = m[1], word = m[2], lw = word.toLowerCase();
  const map = mode === 'past' ? _T_B2P : _T_P2B;
  let repl = map[lw];
  // Hyphenated verb not in the map: tense the LAST segment (co-organised -> co-organise).
  if (!repl && lw.indexOf('-') > 0) {
    const segs = lw.split('-');
    const last = segs[segs.length - 1];
    const r2 = map[last];
    if (r2 && r2 !== last) { segs[segs.length - 1] = r2; repl = segs.join('-'); }
  }
  if (!repl || repl === lw) return text;
  if (word[0] === word[0].toUpperCase()) repl = repl.charAt(0).toUpperCase() + repl.slice(1);
  return prefix + repl + text.slice(prefix.length + word.length);
}
function _expTenseMode() {
  try {
    // COPENHAGEN-TENSE-DEFAULT-001 (2026-06-22): Copenhagen Modern / Scandinavian
    // is ALWAYS present tense — it is a property of the package, not a user setting.
    // To use Auto or Past tense the owner must switch to a different package.
    // Other packages honour the explicit expTense control; legacy expPastTense:true
    // migrates to 'past'.
    try {
      const pkg = JSON.parse(localStorage.getItem('stylePackage') || '""') || '';
      const p = (typeof pkg === 'string' ? pkg : '').toLowerCase().trim();
      if (!p || p === 'copenhagen-modern' || p === 'scandinavian' || p === 'default') return 'present';
    } catch (_) {}
    const sc = JSON.parse(localStorage.getItem('styleConfig') || '{}') || {};
    return sc.expTense || (sc.expPastTense === true ? 'past' : 'auto');
  }
  catch (_) { return 'auto'; }
}
export function applyOutcomesMode(docSections, doc) {
  try {
    if (doc !== 'cv' || !Array.isArray(docSections)) return docSections;
    const _tmode = _expTenseMode();
    // TENSE-FULL-CLAUSE-001 (owner 2026-06-19: "make sure role and role-result are in the
    // same tense" + fixes E1 broken mixed tense). The Result laminates two outcomes joined
    // by "; " — _tenseLead only re-tensed the FIRST clause's leading verb, leaving
    // "Manage …; owned …" mixed. Re-tense EACH clause's leading verb (split on ';' /
    // ' and ', keeping the delimiters) so the whole Result is in the chosen tense — which
    // is the tense generation already wrote the bullets in, so role + result now match.
    // No-op for 'auto'; _tenseLead leaves a non-verb clause opener unchanged.
    const _tx = (s) => (typeof s === 'string' && /;| and /.test(s))
      ? s.split(/(;|\s+and\s+)/).map((p) => /^(?:;|\s+and\s+)$/.test(p) ? p : _tenseLead(p, _tmode)).join('')
      : _tenseLead(s, _tmode);
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
    // GABRIEL-EXACT-RESULTS-001 (owner 2026-06-26: the seeded Research-Assistant + Security-Guard
    // Results came back CUT — the model honoured the verbatim kernel guidance only partially). For
    // Gabriel, pin those two roles' Results to the EXACT owner text as the HIGHEST lamination tier
    // (checked first in the loop below) so the line survives verbatim, uncapped, in BOTH preview +
    // export. Name-guarded (Gabriel only); non-mutating (sets _lam, never the input role).
    let _gabrielN = '';
    try { const _g = JSON.parse(localStorage.getItem('personalInfo') || '{}') || {}; _gabrielN = String((_g.personalInfo ? _g.personalInfo.name : _g.name) || ''); } catch (_) {}
    // GABRIEL-EXACT-RESULTS-002 (owner 2026-07-02): the CSA / IDF and Students-Council roles came
    // back with the Results line COPYCATTING the bullets (no distinct result was generated, so the
    // derive-from-bullets fallback rehashed them, e.g. "Administer classified IT infrastructure;
    // ...procedure.; Cut recovery time..."). Owner: "no need to copycat the result from the bullet —
    // there is an additional NUMERIC result." Pin all 5 kernel role_results_exact lines (not just RA +
    // security guard) so each role shows its distinct NUMERIC outcome verbatim instead of the bullets.
    const _GAB_EXACT = /\bgabriel\b/i.test(_gabrielN) ? [
      { reT: /research\s+assist|teaching\s*\/?\s*research|\bRA\b/i, reC: /tel[\s-]?aviv|\bTAU\b/i, text: 'Benchmarked imprinted vs taut, non-imprinted devices; non-imprinted won on structure, manufacturability, responsivity, and 10× faster gating.' },
      { reT: /security\s+guard|\bvagt\b/i, reC: null, text: 'Manage access and incidents for 750-resident student housing.' },
      { reT: /computer\s*systems?\s*admin/i, reC: /\bidf\b|communication\s*corps/i, text: 'Support 100 users across 150 machines in a classified construction centre, with documented access, support, and recovery workflows.' },
      { reT: /team\s*operations?\s*manager|assistant\s*coach/i, reC: /pan\s*idr|copenhagen\s*wolves/i, text: 'Coordinate a 25-player squad, 300-guest club events, and club representation with Rugby Danmark and IGR Europe.' },
      { reT: /students?\s*council/i, reC: /tel[\s-]?aviv/i, text: 'Modernised 15 outdated EE exam-preparation booklets with updated examples, cleaner coverage, and improved print quality.' },
      // ROLE-RESULTS-MISSING-TA-SG-001 (owner PDF review 2026-07-03): a gen that SPLITS the TAU
      // role leaves a bare "Teaching Assistant" slot no pin matches (the RA matcher wants
      // research). Distinct teaching-side fact from the kernel snapshot (SEM/Raman/confocal
      // training), NOT a restatement of the 7-semesters bullet. The merged "R&D and Teaching
      // Assistant" title is EXCLUDED (negative lookahead) so it keeps the RA benchmark result.
      { reT: /^(?!.*(?:research|r\s*&\s*d)).*teaching\s+assist/i, reC: /tel[\s-]?aviv|\bTAU\b/i, text: 'Set 20 exams for ~150 students; train graduates on SEM, Raman, and confocal microscopy.', old: ['Train graduate students on SEM, Raman, and confocal microscopy measurement protocols.'] },
      // SIRIN-RESULT-TRIM-001 (owner 2026-07-02): the Sirin Result laminated outcomes[0], whose leading
      // clause repeats bullet[0] verbatim ("the content bullet is regenerated inside the result"). Pin the
      // DISTINCT co-invented-patent achievement. Company-gated to Sirin so it never hits the Meprolight EO
      // roles. Byte-identical to antcv-gabriel-results-pin.js PINS (preview parity).
      // RESULTS-PIN-NO-NUMBER-001 (owner 2026-07-03): the patent NUMBER lives once in
      // PUBLICATIONS & PATENTS — the Result describes the work without it (same as the
      // gen rule "a role line may describe the underlying work but must not carry the
      // patent number"). `old` lists superseded pin texts so upgrades apply once and
      // owner edits still stick.
      { reT: /optics|electro-?optics/i, reC: /sirin/i, text: 'Co-invent a patented stray-light optical window, now in commercial devices.', old: ['Co-invented the patented stray-light optical window, now in commercial devices.', 'Co-invented a patented stray-light optical window, now in commercial devices.', 'Co-invented the stray-light optical window, now in commercial devices.', 'Co-invented the stray-light optical window (Patent No. 241997), now in commercial devices.', 'Co-invented the stray-light optical window (241997), now in commercial devices.'] },
    ] : [];
    // RESULTS-PIN-OWNER-EDIT-001 (owner 2026-07-03): this tier sat ABOVE role.results,
    // so an owner-edited Results line was overridden right back to the pin in the
    // export ("deleting the patent number ... makes it jump back"). The pin now wins
    // ONLY over: empty results, a known pin text (current or superseded `old`), or a
    // COPYCAT of the role's own bullets. Any other non-empty text falls through to
    // tier 1 (role.results verbatim). Mirrors antcv-gabriel-results-pin.js pinWins.
    const _gabNormT = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const _gabCopycat = (cur, bullets) => {
      const nc = _gabNormT(cur); if (nc.length < 15 || !Array.isArray(bullets)) return false;
      for (const b of bullets) {
        const nb = _gabNormT(typeof b === 'string' ? b : (b && (b.t || b.b)) || '');
        if (nb.length < 15) continue;
        if (nb.slice(0, 30) === nc.slice(0, 30)) return true;
        if (nb.indexOf(nc) !== -1 || nc.indexOf(nb) !== -1) return true;
      }
      return false;
    };
    const _gabrielExactResult = (r) => {
      if (!_GAB_EXACT.length || !r) return null;
      const t = String(r.title || ''), c = String(r.company || '');
      for (const e of _GAB_EXACT) {
        if (e.reT.test(t) && (!e.reC || e.reC.test(c))) {
          const cur = typeof r.results === 'string' ? r.results.trim() : '';
          if (cur && cur !== e.text && (!e.old || e.old.indexOf(cur) === -1) && !_gabCopycat(cur, r.bullets)) return null;
          return e.text;
        }
      }
      return null;
    };
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
    // RESULTS-KERNEL-ROLE-MATCH-001 (owner 2026-06-23): the ACTUAL outcome TEXTS keyed by
    // role id + title|company, so a generated doc role (which carries no outcomes) can adopt
    // its KERNEL role's real numeric outcomes as the Results line.
    const _koTextById = {}, _koTextByName = {};
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
          const set = new Set(); const _texts = [];
          r.outcomes.forEach((o) => {
            const t = _koText(o); if (!t) return;
            tok(t).forEach((w) => set.add(w));
            // collect default-visible outcome texts (strings are always visible)
            if (typeof o === 'string' || !o || o.defaultVisible !== false) _texts.push(t);
          });
          if (!set.size) return;
          if (r.id != null) {
            const k = String(r.id);
            if (!_koById[k]) _koById[k] = new Set(); set.forEach((w) => _koById[k].add(w));
            if (_texts.length) { if (!_koTextById[k]) _koTextById[k] = []; _texts.forEach((t) => _koTextById[k].push(t)); }
          }
          const nk = tok(r.title).join(' ') + '|' + tok(r.company).join(' ');
          if (nk !== '|') {
            if (!_koByName[nk]) _koByName[nk] = new Set(); set.forEach((w) => _koByName[nk].add(w));
            if (_texts.length) { if (!_koTextByName[nk]) _koTextByName[nk] = []; _texts.forEach((t) => _koTextByName[nk].push(t)); }
          }
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
      let t = _dedupNear(texts).slice(0, 2).join('; ');
      // RESULTS-CUT-003 (owner 2026-06-22): NO jarring trailing "…". RESULTS-CUT-002
      // fixed the heuristic-distribution path but this tier-1/2/3 join still mid-word
      // cut + ellipsised (the "(Supervisor…" the owner saw). Same clean rule: drop the
      // WHOLE second clause if the first is complete, else trim to a sentence/clause
      // boundary — a complete line always beats a truncated one.
      if (t.length > 260) {
        const parts = t.split('; ');
        if (parts.length > 1 && parts[0].length <= 260) {
          t = parts[0];
        } else {
          const cut = t.slice(0, 260);
          const b = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(', '));
          t = (b > 60 ? cut.slice(0, b) : cut.replace(/\s+\S*$/, '')).replace(/[;,.\s]+$/, '');
        }
      }
      return t;
    };
    visRoles.forEach((r) => {
      // BABEL-PINS-LANG-GATE-001 (owner 2026-07-11 "generation in the target language"):
      // a role whose title is in a wide script (zh/he/ar/am) is a NATIVE-language
      // rendering — the ENGLISH pin/kernel-outcome tiers must never laminate onto it
      // (that is how the CSA result leaked under 学生会代表 and English Results appeared
      // on zh pages). Its own role.results (tier 1, native) still wins; an empty
      // Results stays empty rather than becoming English.
      const _wideT = /[一-鿿㐀-䶿֐-׿؀-ۿሀ-፿]/.test(String(r.title || ''));
      // GABRIEL-EXACT-RESULTS-001: owner-pinned verbatim Results win above ALL tiers (no cap, no cut).
      const _gx = _wideT ? null : _gabrielExactResult(r); if (_gx) { _lam.set(r, _gx); return; }
      // 1) explicit role.results string wins verbatim.
      if (typeof r.results === 'string' && r.results.trim()) { _lam.set(r, r.results.trim()); return; }
      if (_wideT) return;
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
        // RESULTS-NUMERIC-LEAD-001 + CLUSTER-QUAL-001: order by the blended numeric +
        // skill-demand score so a quantified AND demanded outcome leads (and survives
        // the cap), not stored order.
        texts.sort((p, q) => _rankScore(q) - _rankScore(p));
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
      texts.sort((p, q) => _rankScore(q) - _rankScore(p)); // RESULTS-NUMERIC-LEAD-001 + CLUSTER-QUAL-001
      if (texts.length) { _lam.set(r, _capJoin(texts)); return; }
      // 3b) RESULTS-KERNEL-ROLE-MATCH-001 (owner 2026-06-23): the generated doc role carries
      //     NO outcomes/proofPointIds, so match it to the KERNEL role by id / title|company
      //     and adopt ITS real (numeric) outcomes. Without this a role rich in numeric
      //     outcomes laminated from a token-matched wrong outcome or a derived bullet.
      let _kt = (r.id != null && _koTextById[String(r.id)]) || _koTextByName[_nameKey(r)] || null;
      if (_kt && _kt.length) {
        const _tx2 = _kt.slice().sort((p, q) => _rankScore(q) - _rankScore(p));
        _lam.set(r, _capJoin(_tx2));
      }
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
    assign.forEach((a) => { a.sort((p, q) => _rankScore(txtOf(q)) - _rankScore(txtOf(p))); while (a.length > MAX) a.pop(); });
    const resultsByRole = new Map();
    distRoles.forEach((r, i) => {
      if (!assign[i].length) return;
      // RESULTS-NEAR-DUP-001: drop near-duplicate lines before joining the
      // distributed outcomes too (same fact phrased twice → keep the stronger one).
      let txt = _dedupNear(assign[i].map(lineOf)).slice(0, 2).join('; ');
      // RESULTS-CUT-002 (owner 2026-06-23): NO jarring trailing "…". If the joined
      // outcomes are over-long, drop the WHOLE second clause (keep the first complete
      // outcome) rather than mid-sentence-cutting with an ellipsis. If a single first
      // clause is itself over the cap, trim to its last sentence/clause boundary — still
      // no "…". A complete line always beats a truncated one.
      if (txt.length > 260) {
        const parts = txt.split('; ');
        if (parts.length > 1 && parts[0].length <= 260) {
          txt = parts[0];
        } else {
          const cut = txt.slice(0, 260);
          const b = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(', '));
          txt = (b > 60 ? cut.slice(0, b) : cut.replace(/\s+\S*$/, '')).replace(/[;,.\s]+$/, '');
        }
      }
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
    const deriveResultFromRole = (r, allowNonNumeric) => {
      const bl = Array.isArray(r.bullets) ? r.bullets : [];
      const textOf = (b) => String(typeof b === 'string' ? b : (b && (b.b || b.t)) || '').trim();
      let bestIdx = -1, bestScore = -1;
      for (let i = 0; i < bl.length; i++) {
        const t = textOf(bl[i]);
        if (!t || t.length < 12) continue;
        if (/\bpatent\b/i.test(t) || (pno && t.toLowerCase().indexOf(pno) >= 0)) continue;
        // RESULTS-DERIVE-MEASURABLE-001 (owner 2026-07, browser-traced: CSA Result was the
        // non-numeric "Administered…" bullet, not "Cut recovery time from hours to minutes").
        // A "measurable" result is not only a DIGIT — a qualitative improvement ("from X to Y",
        // "hours to minutes", cut/reduced/saved/increased/eliminated…) is a real RESULT. Score
        // those as metric-bearing so they win over a longer plain-duty bullet, and a hard number
        // gets a small extra tiebreak. Length is only the final tiebreak.
        const hasNum = /\d|%|\bx\b|×/.test(t);
        const hasMeasurable = /\bfrom\s+[\w-]+\s+to\s+[\w-]+\b|\b(?:hours?|days?|weeks?|months?)\s+to\s+(?:seconds?|minutes?|hours?|days?)\b|\b(?:cut|reduc\w*|sav\w*|increas\w*|accelerat\w*|eliminat\w*|halv\w*|doubl\w*|tripl\w*|shorten\w*)\b/i.test(t);
        const metric = hasNum || hasMeasurable;
        const score = (metric ? 1000 : 0) + (hasNum ? 200 : 0) + Math.min(t.length, 240);
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      }
      if (bestIdx < 0) return null;
      // RESULTS-DERIVE-NUMERIC-ONLY-001 (owner 2026-06-23: "why such shitty results?"):
      // tier-5 must NOT restate a plain duty bullet as a "Results:" line. score >= 1000
      // ONLY when the chosen bullet carries a concrete metric (number/%/x). If the best
      // bullet has NO metric, derive NOTHING — the role shows its bullets and no Results
      // line, which is far better than a non-numeric bullet echoed as a fake result.
      // RESULTS-UNSOLICITED-COVERAGE-001 (owner 2026-06-26: Student-Council + Computer-
      // Administrator roles were MISSING Results in the unsolicited app). EXCEPTION: in the
      // no-JD unsolicited document every role should carry a Result for breadth, so a role
      // with no numeric bullet derives from its strongest bullet anyway (allowNonNumeric).
      // JD-targeted docs keep numeric-only. The source bullet is still hidden (caller), so
      // the line is not duplicated; keepMin / the zero-bullet guard still protect the role.
      if (!allowNonNumeric && bestScore < 1000) return null;
      let txt = textOf(bl[bestIdx]);
      if (txt.length > 260) {
        var cut = txt.slice(0, 260);
        var b = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(', '));
        txt = (b > 60 ? cut.slice(0, b) : cut.replace(/\s+\S*$/, '')).replace(/[;,.\s]+$/, '');
      }
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
    // RESULT-SUBSUMES-BULLET-002 (owner 2026-07 CV(6): the Result is a NEAR-duplicate of a
    // bullet — "Built automated backup…" vs "Build automated backup…" (tense), "Directed
    // technical work for…" vs "Direct technical work across…" (reworded). Exact-substring
    // subsumption missed these, so the bullet stayed visible alongside its Result. Also hide a
    // bullet whose SIGNIFICANT tokens are ≥72% contained in the Result (a paraphrase/tense
    // variant), not only a verbatim substring.
    const _sigTokens = (s) => normLine(s).split(' ').filter((w) => w.length >= 3);
    const hideSubsumed = (role, resultsText) => {
      const nr = normLine(resultsText);
      if (!nr) return Array.isArray(role.bullets) ? role.bullets : [];
      const rTok = new Set(_sigTokens(resultsText));
      return (Array.isArray(role.bullets) ? role.bullets : []).filter((b) => {
        const bt = typeof b === 'string' ? b : (b && (b.b || b.t)) || '';
        const nb = normLine(bt);
        if (nb.length < 15) return true;                         // too short to judge
        if (nr.indexOf(nb) >= 0) return false;                   // verbatim substring
        if (nb.indexOf(nr) >= 0) return false;                   // bullet contains the Result verbatim (longer bullet)
        const bTok = _sigTokens(bt);
        const rArr = _sigTokens(resultsText);
        // RESULT-SUBSUMES-BULLET-003 (owner 2026-07 Sirin: the BULLET was a LONGER version of the
        // Result — "Direct technical work across a 7-person EO… for a high-security smartphone
        // product; own camera, display…" vs the Result's shorter "Direct technical work across a
        // 7-person EO… and co-invented…". The bullet's extra tail dropped the bullet→result overlap
        // below the threshold, so it stayed. Hide when the overlap is high in EITHER direction:
        // the bullet's tokens are ≥72% in the Result, OR the Result's tokens are ≥72% in the bullet.
        if (bTok.length >= 4) {
          const bInR = bTok.filter((w) => rTok.has(w)).length / bTok.length;
          const bSet = new Set(bTok);
          const rInB = rArr.length ? rArr.filter((w) => bSet.has(w)).length / rArr.length : 0;
          if (bInR >= 0.72 || rInB >= 0.72) return false;        // near-duplicate either direction
        }
        return true;
      });
    };
    // RESULT-NUMBER-NO-REUSE-001 (owner 2026-06-19: "if the number is used for the
    // result, do not use it for the role content"). Extract the SALIENT metric tokens
    // from the Results line (a % / ×-fold / a count ≥ 100 that is not a year), and drop
    // any bullet that reuses the SAME metric — the number shows once, in Results, not
    // doubled in a bullet. A standard CODE (ISO 26262, ASPICE…) is NOT a metric. Applies
    // on every result path (real outcome, distributed, derived).
    const _STD_RX2 = /\b(?:ISO|IEC|EN|DIN|MIL[-\s]?STD|STANAG|ASPICE|SAE)(?:\s*\/\s*(?:ISO|IEC|SAE|EN))*[\s\/-]*[A-Z]?\d[\d.\-:]*[A-Z]?\b/gi;
    const salientMetrics = (txt) => {
      const s = String(txt == null ? '' : txt).replace(_STD_RX2, ' ');
      const out = new Set();
      (s.match(/\d[\d,.]*\s*%/g) || []).forEach((m) => out.add(m.replace(/[\s,]/g, '')));
      (s.match(/\d[\d,.]*\s*(?:×|x\b|-?fold)/gi) || []).forEach((m) => out.add(m.toLowerCase().replace(/[\s,]/g, '').replace(/-?fold/, 'x').replace('×', 'x')));
      (s.match(/\b\d[\d,.]*\b/g) || []).forEach((m) => { const n = parseFloat(m.replace(/,/g, '')); if (n >= 100 && !(n >= 1900 && n <= 2100)) out.add(String(n)); });
      return out;
    };
    const hideMetricReused = (bullets, resultsText) => {
      const metrics = salientMetrics(resultsText);
      if (!metrics.size || !Array.isArray(bullets)) return bullets;
      return bullets.filter((b) => {
        const bm = salientMetrics(typeof b === 'string' ? b : (b && (b.b || b.t)) || '');
        for (const m of bm) { if (metrics.has(m)) return false; }
        return true;
      });
    };
    // KEEP-MIN-BULLETS-001 (owner 2026-06-19: "keep 2-3 visible role content lines; if
    // you hide one line for the result, propagate the next role line into view"). A hide
    // pass (subsumed / metric-reuse / derive) must NOT leave a role with too few bullets.
    // If hiding would drop below 2 visible (and the role HAD ≥2), keep them all instead —
    // a short 2-bullet role shows both rather than collapsing to one.
    const KEEP_MIN = 2;
    const keepMin = (original, kept) => {
      const o = Array.isArray(original) ? original : [];
      const k = Array.isArray(kept) ? kept : o;
      return (k.length >= Math.min(KEEP_MIN, o.length)) ? k : o;
    };
    // BULLET-TENSE-001 (owner 2026-06-19: "only Kanzen bullets are present tense, all
    // others past, including the current Pan Idræt role"). The chosen tense is GENERATED
    // into bullets, but generation drifts to past, so re-tense each BULLET's leading verb
    // to the chosen tense (full-clause, like the Result) so role content matches the
    // Result tense. No-op for 'auto'; only flips recognised verbs (a noun opener like
    // "Operations and assistant-coaching" is left alone).
    const _txBullet = (b) => {
      if (_tmode !== 'present' && _tmode !== 'past') return b;
      if (typeof b === 'string') return _tx(b);
      if (b && typeof b === 'object') {
        if (b.b != null && String(b.b).trim()) return { ...b, b: _tx(b.b) };
        if (b.t != null && String(b.t).trim()) return { ...b, t: _tx(b.t) };
      }
      return b;
    };
    const _txBl = (arr) => (Array.isArray(arr) ? arr.map(_txBullet) : arr);
    // RESULTS-RUGBY-CROSSROLE-SCRUB-001 (owner 2026-06-23, bug #1b): a Copenhagen
    // Wolves / Pan Idraet rugby-ops clause ("logistics for N players and coaches",
    // "players and coaches") bled into a NON-rugby role's Results (e.g. Sirin Labs
    // optics). Whatever produced it (gen/D1 merge or pool best-AVAILABLE-home bleed),
    // drop the offending ';'-joined clause(s) from any role that is not the rugby role.
    // Same class as the INTERESTS junior-rugby scrub (antcv-sections-normalize-415).
    const _RUGBY_CLAUSE = /(?:players?\s+and\s+coaches|logistics\s+for\s+\d+\s+players|coaching\s+junior|junior\s+rugby|assistant\s+coach)/i;
    const _isRugbyRole = (r) => /copenhagen wolves|foreningsarbejde|pan idr|wolves rfc|rugby/i.test(String((r && r.title) || '') + ' ' + String((r && r.company) || ''));
    const _scrubRoleRugby = (r) => {
      if (!r || !r.results || _isRugbyRole(r) || !_RUGBY_CLAUSE.test(String(r.results))) return r;
      const kept = String(r.results).split(/\s*;\s*/).filter((c) => c && !_RUGBY_CLAUSE.test(c));
      const out = kept.join('; ').replace(/[;,.\s]+$/, '');
      if (out) return { ...r, results: out };
      const c = { ...r }; delete c.results; return c;
    };
    // RESULTS-COMPRESS-001 (owner 2026-07 "lecture"): a Results line must fit ONE line — compress
    // it deterministically without dropping the fact. Abbreviate known phrases (Change Control
    // Board -> CCB), turn approximation words into "~" (roughly/about/approximately/around N -> ~N),
    // drop a repeated unit ("250 days to 10 days" -> "250 to 10 days"), and tighten "cutting"->"cut".
    // e.g. "Direct the Change Control Board, cutting the change cycle from roughly 250 days to about
    // 10 days" -> "Direct the CCB, cut the change cycle from ~250 to ~10 days".
    const _compressResult = (s) => {
      let t = String(s == null ? '' : s);
      t = t.replace(/\bChange Control Board\b/g, 'CCB')
           .replace(/\bDesign Verification\s*\/\s*Production Validation\b/gi, 'DV/PV')
           .replace(/\b(?:roughly|approximately|about|around)\s+(?=~?\d)/gi, '~')
           .replace(/(~?\d[\d.,]*)\s+([A-Za-z%]+)\s+to\s+(~?\d[\d.,]*\s+\2\b)/g, '$1 to $3')
           .replace(/\bcutting\b/g, 'cut');
      return t.replace(/\s{2,}/g, ' ').replace(/\s+([.,;])/g, '$1').trim();
    };
    // RESULTS-UNSOLICITED-COVERAGE-001: no JD => unsolicited breadth => every role carries a line.
    const __unsolicited = !(_jd && _jd.trim());
    const expOut = {
      ...exp,
      roles: (exp.roles || []).map((r) => {
        // tiers 1-4 — a REAL outcome wins; bullets stay exposed EXCEPT one that reuses
        // the Result's number (RESULT-NUMBER-NO-REUSE-001). _tx re-tenses to the chosen
        // tense (no-op for 'auto'); _txBl re-tenses the kept bullets to match.
        // keepMin protects ONLY against the metric-reuse over-hide — the intentional
        // hides (subsumed bullet / derived source bullet that IS the Result) stay hidden,
        // so keepMin's "original" is the post-intentional-hide set, never r.bullets.
        const lam = _lam.get(r);
        // RESULT-SUBSUMES-BULLET-001 (owner 2026-07: IDF "Results:" was a VERBATIM copy of
        // bullet 1 and the bullet was STILL shown; Sirin similar). Even for a REAL outcome,
        // if the Result subsumes a bullet (the bullet's text is contained in the Result), HIDE
        // that bullet — never show the same sentence twice. keepMin still protects a ≥2-bullet
        // role from collapsing. (Was: real outcomes skipped subsumption — that assumption broke
        // when generation set role.results to a verbatim bullet.)
        if (lam) { const sub = hideSubsumed(r, lam); return { ...r, results: _compressResult(_tx(lam)), bullets: _txBl(keepMin(sub, hideMetricReused(sub, lam))) }; }
        // pool / explicit-map distribution — may be a bullet-seeded outcome, so hide
        // a bullet when the result text subsumes it OR reuses its number.
        if (resultsByRole.has(r)) { const rt = resultsByRole.get(r); const sub = hideSubsumed(r, rt); return { ...r, results: _compressResult(_tx(rt)), bullets: _txBl(keepMin(sub, hideMetricReused(sub, rt))) }; }
        // tier-5 derive — the Results line IS one of the role's bullets; hide that
        // one source bullet. TA-TORN-OFF-001 (owner 2026-06-19: "Teaching Assistant was
        // torn off, only the result stayed"): NEVER consume a role's only content into a
        // Result — if deriving would leave ZERO bullets, skip the derive and keep the
        // bullet as content (no Results line) instead.
        const d = deriveResultFromRole(r, __unsolicited);
        if (!d) return { ...r, bullets: _txBl(r.bullets) };
        const keptBullets = (Array.isArray(r.bullets) ? r.bullets : []).filter((_, i) => i !== d.index);
        if (!keptBullets.length) return { ...r, bullets: _txBl(r.bullets) };
        return { ...r, results: _compressResult(_tx(d.text)), bullets: _txBl(keepMin(keptBullets, hideMetricReused(keptBullets, d.text))) };
      }).map(_scrubRoleRugby),
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

// TENSE-PREVIEW-PARITY-001 (owner 2026-06-20: "the tense is preview shows x, export y").
// In RESULTS mode the export re-tenses each bullet's leading verb to the chosen tense (the
// _tx full-clause pass inside applyOutcomesMode), but the editable preview rendered the raw
// stored bullet, so preview showed past while the export showed the chosen tense. Expose the
// SAME clause-tense pass so the preview can display the matching tense — bullet TEXT only,
// no role-list change, so the index-based edit paths stay intact. No-op for 'auto'.
function tenseClause(s) {
  try {
    const m = _expTenseMode();
    if (!m || m === 'auto' || typeof s !== 'string' || !s) return s;
    return /;| and /.test(s)
      ? s.split(/(;|\s+and\s+)/).map((p) => /^(?:;|\s+and\s+)$/.test(p) ? p : _tenseLead(p, m)).join('')
      : _tenseLead(s, m);
  } catch (_) { return s; }
}
try { if (typeof window !== 'undefined') window.AntcvTenseClause = tenseClause; } catch (_) {}

// PREVIEW-PARITY-001 (owner 2026-06-20: "fit the preview entirely to export"). Expose the
// export's HIDE + STRIP decisions so the editable preview can drop the SAME roles/sections and
// strip the SAME fabricated tools — making the preview match the PDF (which also makes the
// salmon page-breaks line up). These are pure predicates / text transforms: the preview hides
// a role by rendering null IN-PLACE (indices preserved, edits intact) and strips text at
// display time, so no edit path is touched. Merges are NOT here — they need the data-level
// merge (a merged role has no single edit path). All gated on a TARGETED application.
try {
  if (typeof window !== 'undefined') {
    window.AntcvExportHiddenRole = function (role) {
      try {
        if (!_isTargetedExport() || !role || role.on === false) return false;
        var hay = String(role.title || '') + ' ' + String(role.company || '');
        return IRRELEVANT_ROLE.test(hay) || (!_jdIsTechOps() && CLUSTER_ROLE.test(hay));
      } catch (_) { return false; }
    };
    window.AntcvExportHiddenSection = function (sec) {
      try {
        if (!_isTargetedExport() || !sec) return false;
        return !_jdIsResearch() && /publication|patent/i.test(String(sec.title || sec.id || ''));
      } catch (_) { return false; }
    };
    window.AntcvStripFab = function (text) {
      try {
        if (typeof text !== 'string' || !FAB_TOOLS.test(text)) return text;
        return text.split(/\s*,\s*/).filter(function (p) { return p && !FAB_TOOLS.test(p); }).join(', ');
      } catch (_) { return text; }
    };
    // PREVIEW-MERGE-001 (owner 2026-06-20, Option A): the DATA-level hide+merge for a targeted
    // application's experience roles — the SAME order as sanitizeForExport (set on:false on the
    // export-hidden roles FIRST, then consolidate same-company VISIBLE roles). Returns the new
    // roles array, or null if not targeted / not an array. app.js applies this ONCE to the
    // targeted app's React state so the merged roles are genuine single roles (editable, and
    // preview == export). The unsolicited kernel is a separate row and is never touched.
    window.AntcvMergeExperienceRoles = function (roles) {
      try {
        if (!_isTargetedExport() || !Array.isArray(roles)) return null;
        var hideTech = !_jdIsTechOps();
        var out = roles.map(function (r) {
          if (!r || r.on === false) return r;
          var hay = String(r.title || '') + ' ' + String(r.company || '');
          if (IRRELEVANT_ROLE.test(hay) || (hideTech && CLUSTER_ROLE.test(hay))) return Object.assign({}, r, { on: false });
          return r;
        });
        var merged = mergeSameCompanyRoles(out);
        if (merged) out = merged;
        return out;
      } catch (_) { return null; }
    };
  }
} catch (_) {}

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

  // EXPORT-PREFLIGHT-ORPHANS-001: the owner's orphans live in THIS path (the
  // CloudConvert PDF). Same bounded, swallow-all preflight as exportDocxViaWorker.
  placeholderGate(payload);
  await runOrphanPreflight(payload);

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
