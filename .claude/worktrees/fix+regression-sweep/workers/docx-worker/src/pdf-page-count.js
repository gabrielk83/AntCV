// AntCV docx-worker — PDF page-count helper (v1.14.9)
// ============================================================
//
// Extracts the page count from a PDF buffer produced by
// LibreOffice/CloudConvert without pulling a full PDF parser into
// the Worker bundle. We try in order:
//
//   1. Read the Pages catalog: `/Type /Pages ... /Count N`. This
//      is the canonical source — every PDF has exactly one Pages
//      catalog at the root of the object tree and `/Count` is the
//      total leaf-page count. LibreOffice always writes this
//      uncompressed, so a plain text scan works.
//
//   2. Fall back to counting `/Type /Page` occurrences with a
//      word boundary so `/Type /Pages` doesn't match. This is
//      slower (full-buffer scan) but resilient if /Count is
//      missing or zero (rare).
//
//   3. Fall back to 0 — the caller decides whether to omit the
//      header or send 0.
//
// Robustness notes
// ----------------
// PDFs may have compressed object streams (xref streams, /ObjStm),
// in which case /Count and /Type /Page tokens are hidden inside
// FlateDecode streams. LibreOffice on CloudConvert defaults to
// uncompressed cross-reference tables in our pipeline, so we don't
// need a deflate path. If we ever switch the conversion config,
// add fflate decoding here.
//
// We treat the buffer as Latin-1 bytes (1 byte = 1 char) so the
// regex offsets line up with the binary positions. PDF object
// syntax is ASCII — non-ASCII bytes only occur inside streams,
// which we don't look at.

const MAX_SCAN_BYTES = 4 * 1024 * 1024; // hard cap on scan size

function bufToLatin1(buf) {
  // Accept Uint8Array, ArrayBuffer, or Buffer-like.
  if (!buf) return '';
  if (typeof buf === 'string') return buf;
  let u8;
  if (buf instanceof Uint8Array) u8 = buf;
  else if (buf instanceof ArrayBuffer) u8 = new Uint8Array(buf);
  else if (buf.buffer instanceof ArrayBuffer) u8 = new Uint8Array(buf.buffer, buf.byteOffset || 0, buf.byteLength || buf.length || 0);
  else return '';
  // Cap the scan size to keep CPU bounded on huge PDFs.
  const limit = Math.min(u8.length, MAX_SCAN_BYTES);
  // Build the string in chunks to avoid large argument lists.
  let out = '';
  const CHUNK = 65536;
  for (let i = 0; i < limit; i += CHUNK) {
    const end = Math.min(i + CHUNK, limit);
    out += String.fromCharCode.apply(null, u8.subarray(i, end));
  }
  return out;
}

// Strategy 1: /Type /Pages ... /Count N
// PDF dictionaries can have keys in any order, so we don't require
// /Count to follow /Type. We find each `/Type /Pages` site and then
// look for the nearest `/Count N` within the same dictionary.
function readPagesCatalogCount(latin1) {
  // Find every `/Type/Pages` or `/Type /Pages` occurrence. The
  // word boundary after Pages prevents matching `/Type /Page`.
  const re = /\/Type\s*\/Pages(?![A-Za-z])/g;
  let bestCount = 0;
  let m;
  while ((m = re.exec(latin1)) !== null) {
    // Scan a window around the match for /Count N. PDF
    // dictionaries are typically <50 bytes wide for a Pages
    // catalog, but `/Kids [...]` can push it out. We scan up to
    // 4 KiB after the /Type marker.
    const start = m.index;
    const end = Math.min(latin1.length, start + 4096);
    const window = latin1.substring(start, end);
    const countMatch = /\/Count\s+(\d+)/.exec(window);
    if (countMatch) {
      const n = parseInt(countMatch[1], 10);
      if (Number.isFinite(n) && n > bestCount) bestCount = n;
    }
  }
  return bestCount;
}

// Strategy 2: count `/Type /Page` occurrences.
// We want page leaves, not the Pages catalog. So we exclude any
// `/Type /Pages` matches. We also exclude `/Type /Pagestate` and
// other hypothetical extensions via a strict word boundary check
// on the character following "Page".
function countPageLeaves(latin1) {
  let count = 0;
  // Match `/Type /Page` followed by any non-letter / non-digit
  // character (so /Pages doesn't match — 's' is a letter — and
  // /PageRef etc. don't either).
  const re = /\/Type\s*\/Page(?![A-Za-z])/g;
  while (re.exec(latin1) !== null) count++;
  return count;
}

/**
 * Count pages in a PDF buffer.
 * @param {Uint8Array|ArrayBuffer|Buffer|string} buf
 * @returns {number} page count, or 0 if undeterminable
 */
export function countPdfPages(buf) {
  const latin1 = bufToLatin1(buf);
  if (!latin1.length) return 0;
  // Cheap fingerprint check — should start with "%PDF".
  if (latin1.substring(0, 4) !== '%PDF') {
    // Not a PDF or wrapped — try the catalog scan anyway, since
    // some wrappers prepend metadata. But cap the work.
  }
  const fromCatalog = readPagesCatalogCount(latin1);
  if (fromCatalog > 0) return fromCatalog;
  const fromLeaves = countPageLeaves(latin1);
  if (fromLeaves > 0) return fromLeaves;
  return 0;
}

// Diagnostic helper for the smoke test / wrangler tail.
export function describePdfPageCount(buf) {
  const latin1 = bufToLatin1(buf);
  const fromCatalog = readPagesCatalogCount(latin1);
  const fromLeaves = countPageLeaves(latin1);
  return {
    bytesScanned: Math.min(latin1.length, MAX_SCAN_BYTES),
    pagesCatalogCount: fromCatalog,
    pageLeafCount: fromLeaves,
    pages: fromCatalog || fromLeaves || 0,
  };
}

export default { countPdfPages, describePdfPageCount };
