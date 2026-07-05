// /api/fetch-brand-colors — BRAND-FIT-REAL-SAMPLE-001
// =================================================================
// POST with { jdUrl?, companyName? } returns real brand colors SAMPLED
// from a fetched company website — never LLM-guessed, never scanned from
// the JD's own prose text. This is the deterministic upgrade to
// COMPANY-BRAND-FIT-001: that feature previously relied entirely on the
// model's memorized knowledge of a company's branding, with the only
// fallback being antcv-brandfit-sample.js's client-side regex-scan of the
// literal JD text for hex codes — which virtually never fires for a real
// posting (job text doesn't carry CSS).
//
// Resolution order (first candidate that yields usable colors wins):
//   1. If jdUrl is on the company's OWN domain (not a known third-party
//      job board — LinkedIn, Greenhouse, Workday, etc.), try that
//      domain's homepage (www + bare + the original subdomain itself).
//   2. If jdUrl was on a third-party board (or step 1 found nothing),
//      guess the company's domain from its name (strip legal suffixes
//      like "A/S", "GmbH", "Inc" and try "<slug>.com"). Imperfect —
//      this is a heuristic, not a search — but a real guess beats an
//      LLM's unverifiable recollection.
//
// Per-page extraction:
//   - <meta name="theme-color" content="#rrggbb"> — the strongest
//     signal a site can give us; used directly as the navy candidate.
//   - Hex colors in inline <style> blocks and up to 3 same-origin
//     linked stylesheets, frequency-ranked, near-white/near-black
//     chrome excluded.
// Returned "navy" is darkened (same luminance target as
// antcv-brandfit-sample.js) so it's always safe for white header text —
// the client's existing COMPANY-BRAND-FIT-001 apply path re-validates
// anyway, this just avoids a bright brand color getting silently
// rejected as "not dark enough".
//
// SSRF protection: identical guard to fetch-jd-url.js (validateUrl /
// isPrivateIpLiteral / BLOCKED_HOSTS) — every candidate URL this file
// constructs (including domain-guessed ones) is re-validated before
// fetching, so a malicious company name can't smuggle a private-network
// target through the guess path.
//
// Statelessness / isolation: no caching here, by design. Brand colors
// are applied per-application on the client (same write path as the
// existing LLM brand_fit — see COMPANY-BRAND-FIT-001 in app.src.js) and
// must never leak between applications; keeping this endpoint
// cache-free removes an entire class of cross-application leak risk.

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 700_000;
const MAX_CSS_BYTES = 200_000;
const MAX_STYLESHEETS = 3;

// ─── SSRF guard (mirrors fetch-jd-url.js) ────────────────────────
const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  'metadata.google.internal',
  '169.254.169.254',
  '100.100.100.200',
]);

function isPrivateIpLiteral(host) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (m) {
    const [a, b] = m.slice(1, 3).map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }
  if (/^\[?::1\]?$/.test(host)) return true;
  if (/^\[?fe80:/i.test(host)) return true;
  if (/^\[?fc00:/i.test(host)) return true;
  if (/^\[?fd00:/i.test(host)) return true;
  return false;
}

function validateUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || rawUrl.length < 8 || rawUrl.length > 2048) {
    return { ok: false, error: 'URL must be a string between 8 and 2048 characters.' };
  }
  let u;
  try { u = new URL(rawUrl); }
  catch { return { ok: false, error: 'Not a valid URL.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: `Unsupported protocol: ${u.protocol}.` };
  }
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) return { ok: false, error: `Blocked hostname: ${host}` };
  if (isPrivateIpLiteral(host)) return { ok: false, error: `Blocked private/loopback IP literal: ${host}` };
  if (!host || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, error: `Blocked host suffix: ${host}` };
  }
  return { ok: true, url: u };
}

// ─── domain resolution ───────────────────────────────────────────

const THIRD_PARTY_BOARD_HOSTS = new Set([
  'linkedin.com', 'indeed.com', 'greenhouse.io', 'lever.co', 'myworkdayjobs.com',
  'smartrecruiters.com', 'eightfold.ai', 'join.com', 'jobvite.com', 'icims.com',
  'taleo.net', 'successfactors.com', 'ashbyhq.com', 'breezy.hr', 'personio.com',
  'workable.com', 'bamboohr.com', 'recruitee.com', 'teamtailor.com', 'glassdoor.com',
  'ziprecruiter.com', 'monster.com', 'careerbuilder.com', 'simplyhired.com',
  'jobteaser.com', 'stepstone.com', 'jobindex.dk',
]);

const MULTI_PART_TLDS = new Set([
  'co.uk', 'com.au', 'co.nz', 'co.jp', 'com.br', 'co.in', 'co.za', 'com.mx', 'co.kr',
]);

function registrableRoot(hostname) {
  const parts = hostname.split('.');
  if (parts.length <= 2) return hostname;
  const lastTwo = parts.slice(-2).join('.');
  if (MULTI_PART_TLDS.has(lastTwo) && parts.length >= 3) return parts.slice(-3).join('.');
  return lastTwo;
}

function isThirdPartyBoard(hostname) {
  return THIRD_PARTY_BOARD_HOSTS.has(registrableRoot(hostname.replace(/^www\./, '')));
}

// Legal-suffix strip + slugify. A heuristic, not a lookup service —
// "Trackman A/S" -> "trackman", "Acme Group Holdings, Inc." -> "acme".
function guessDomainFromCompanyName(name) {
  let s = String(name || '').toLowerCase();
  s = s.replace(
    /\b(a\/s|a\.s\.?|aps|gmbh|ag|inc\.?|incorporated|ltd\.?|limited|llc|llp|plc|s\.a\.?|sa|nv|bv|oy|ab|kk|corp\.?|corporation|company|co\.?|group|holding[s]?|pty|srl|spa)\b/g,
    ' ',
  );
  s = s.replace(/[^a-z0-9]+/g, '');
  return s.length >= 2 ? s : null;
}

// ─── fetch + parse helpers ────────────────────────────────────────

async function timedFetch(url, opts) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(response, maxBytes) {
  const reader = response.body && response.body.getReader();
  if (!reader) {
    const t = await response.text();
    return t.length > maxBytes ? t.slice(0, maxBytes) : t;
  }
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > maxBytes) { try { await reader.cancel(); } catch (_) {} break; }
    chunks.push(value);
  }
  const cap = Math.min(total, maxBytes);
  const merged = new Uint8Array(cap);
  let off = 0;
  for (const c of chunks) {
    if (off >= cap) break;
    const room = cap - off;
    merged.set(c.length > room ? c.subarray(0, room) : c, off);
    off += Math.min(c.length, room);
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

function lum(hex) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Same target/strategy as antcv-brandfit-sample.js's darken() — guarantees
// the returned navy is safe for white header text without the client
// having to silently drop a too-bright brand color.
function darken(hex, target) {
  const l = lum(hex);
  if (l < target) return hex;
  const f = l > 0 ? (target * 0.92) / l : 0;
  const c = (i) => {
    const v = Math.max(0, Math.min(255, Math.round(parseInt(hex.slice(i, i + 2), 16) * f)));
    return (v < 16 ? '0' : '') + v.toString(16);
  };
  return '#' + c(1) + c(3) + c(5);
}

// Third-party "Apply with X" / social-share widget colors that ride along on
// almost EVERY ATS-hosted careers page (Teamtailor, Greenhouse, Workday...),
// not the employer's own brand. Discovered on Trackman's own careers page:
// "Apply With LinkedIn" (#2164f3-family) and "Apply with Indeed" buttons
// scored as if they were Trackman's brand colors — they are LinkedIn's and
// Indeed's, not the company being sampled. Also excludes common cookie-
// consent-banner accent colors (e.g. OneTrust/Cookiebot green "Accept all"),
// which are equally universal noise, not brand signal.
const KNOWN_WIDGET_COLORS = new Set([
  '#0a66c2', '#0077b5', '#2164f3', '#0073b1', // LinkedIn (site + "Apply with" button families)
  '#2557a7', '#003a9b', '#1e63c9', // Indeed
  '#1877f2', '#3b5998', '#4267b2', // Facebook
  '#1da1f2', '#000000', '#1d9bf0', // Twitter/X (the last near-black is excluded elsewhere too)
  '#4285f4', '#db4437', '#0f9d58', '#f4b400', // Google (search/G-sign-in palette)
  '#25d366', // WhatsApp
  '#ea4c89', // Dribbble-style share widgets sometimes bundled
  '#2c622c', '#2e7d32', '#4caf50', // generic consent-banner "accept" greens
]);

function extractHexColors(text) {
  const matches = text.match(/#[0-9a-fA-F]{6}\b/g) || [];
  const counts = new Map();
  for (const raw of matches) {
    const h = raw.toLowerCase();
    if (KNOWN_WIDGET_COLORS.has(h)) continue; // third-party widget, not this company's brand
    const l = lum(h);
    if (l > 0.9 || l < 0.03) continue; // near-white / near-black chrome, never a brand accent
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

function extractThemeColor(html) {
  const m =
    /<meta[^>]+name=["']theme-color["'][^>]+content=["'](#[0-9a-fA-F]{6})["']/i.exec(html) ||
    /<meta[^>]+content=["'](#[0-9a-fA-F]{6})["'][^>]+name=["']theme-color["']/i.exec(html);
  return m ? m[1].toLowerCase() : null;
}

function extractStylesheetLinks(html, baseUrl) {
  const out = [];
  const re = /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) && out.length < MAX_STYLESHEETS) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.protocol === 'http:' || u.protocol === 'https:') out.push(u.toString());
    } catch (_) { /* ignore malformed href */ }
  }
  return out;
}

async function sampleColorsFromPage(pageUrl) {
  let resp;
  try {
    resp = await timedFetch(pageUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
  } catch (_) { return null; }
  if (!resp.ok) return null;
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('html')) return null;

  const html = await readCapped(resp, MAX_HTML_BYTES);
  const themeColor = extractThemeColor(html);

  const styleBlocks = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  let cssText = styleBlocks;

  const sheetUrls = extractStylesheetLinks(html, pageUrl);
  for (const su of sheetUrls) {
    try {
      const sresp = await timedFetch(su, { method: 'GET' });
      if (sresp && sresp.ok) {
        const ct = (sresp.headers.get('content-type') || '').toLowerCase();
        if (ct.includes('css') || ct === '') cssText += '\n' + (await readCapped(sresp, MAX_CSS_BYTES));
      }
    } catch (_) { /* best-effort — one bad stylesheet must not sink the sample */ }
  }

  const ranked = extractHexColors(cssText + ' ' + html);
  if (!themeColor && !ranked.length) return null;

  const navySource = themeColor ? 'meta theme-color' : 'stylesheet colors';
  const rawNavy = themeColor || ranked[0];
  const navy = darken(rawNavy, 0.62);
  // A genuine second color, if the page has one — never duplicate navy as
  // a fake accent, the client's apply path treats accent as optional.
  const accent = ranked.find((h) => h !== rawNavy && h !== themeColor) || null;

  return { navy, accent, hostname: new URL(pageUrl).hostname, navySource };
}

// ─── candidate URL list ───────────────────────────────────────────

function buildCandidates(jdUrl, companyName) {
  const candidates = [];

  if (jdUrl) {
    const v = validateUrl(jdUrl);
    if (v.ok && !isThirdPartyBoard(v.url.hostname)) {
      const root = registrableRoot(v.url.hostname.replace(/^www\./, ''));
      candidates.push(`https://www.${root}/`);
      candidates.push(`https://${root}/`);
      candidates.push(`${v.url.origin}/`);
    }
  }

  if (companyName) {
    const slug = guessDomainFromCompanyName(companyName);
    if (slug) {
      candidates.push(`https://www.${slug}.com/`);
      candidates.push(`https://${slug}.com/`);
    }
  }

  const seen = new Set();
  return candidates.filter((c) => (seen.has(c) ? false : (seen.add(c), true)));
}

// ─── main handler ─────────────────────────────────────────────────

export async function handleFetchBrandColors(request, env, getCORS) {
  const CORS = getCORS(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  let body;
  try { body = await request.json(); }
  catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const jdUrl = typeof body.jdUrl === 'string' ? body.jdUrl.trim() : '';
  const companyName = typeof body.companyName === 'string' ? body.companyName.trim() : '';

  const candidates = buildCandidates(jdUrl, companyName);
  if (!candidates.length) {
    return new Response(JSON.stringify({ ok: false, error: 'No fetchable company-site candidate could be resolved.' }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const tried = [];
  for (const candidate of candidates) {
    const v = validateUrl(candidate);
    if (!v.ok) { tried.push({ candidate, error: v.error }); continue; }
    let sampled = null;
    try { sampled = await sampleColorsFromPage(v.url.toString()); }
    catch (err) { tried.push({ candidate, error: String(err && err.message || err) }); continue; }
    if (sampled && (sampled.navy || sampled.accent)) {
      return new Response(JSON.stringify({
        ok: true,
        navy: sampled.navy,
        accent: sampled.accent,
        source: `Sampled from ${sampled.hostname} (${sampled.navySource})`,
        sampledHost: sampled.hostname,
      }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
    }
    tried.push({ candidate, error: 'no usable colors' });
  }

  return new Response(JSON.stringify({
    ok: false,
    error: 'Could not sample usable colors from any candidate site.',
    tried,
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}
