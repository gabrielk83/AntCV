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
//   - <meta name="theme-color" content="#rrggbb"> and hex colours in inline
//     <style> blocks + up to 3 same-origin stylesheets, frequency-ranked,
//     near-white/near-black chrome excluded.
// BRAND-WORTHY-PICK-001 / BRAND-INK-MATCH-001 (2026-07-22): the picker returns
// the first REAL brand colour (chromatic or a deliberate near-black) — a generic
// greyscale theme-color is skipped so a real stylesheet colour wins over dull grey
// — and returns it UN-darkened plus the `ink` (black/white) that is legible on it,
// so the client matches the ink to the band (NVIDIA green -> black) instead of
// hardcoding white. `brandLike:true` marks a genuine brand; when nothing is
// brand-worthy the endpoint returns not-found and the client keeps the package default.
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
//
// BRAND-DECIDES-RESEARCH-001 (owner 2026-07-14): the brand is colours AND
// company SPIRIT + VALUES. When the caller passes { research: true } the SAME
// crawl that samples colours ALSO harvests the company's own brand TEXT (title,
// meta description, og:description/site_name, h1/h2 headings, plus one or two
// About/values/careers pages on the winning host) and summarises it into
// { spirit, values[], tone } with the shared multi-provider LLM cascade. Those
// signals pick the cover-letter slogan PLACEMENT (tagline vs opening lead-in)
// and fuse into the slogan TEXT at gen time (see scripts/job-tracker/brand_fit.py
// decide_slogan_placement + brand_record, and gen-runner's slogan section).
// The research step is OPT-IN so the existing colour-only client path is byte-
// identical (no LLM cost, no extra fetches). On any failure the research object
// is returned with empty spirit/values and a `flag` — it NEVER fabricates values.

import { callAnyLLMForJSON } from './multi-llm.js';
import { extractJSON } from './jd-analysis.js';

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 700_000;
// BRAND-CANONICAL-SITE-CCTLD-001 (2026-08-20): stylesheets used to be read
// through readCapped(MAX_CSS_BYTES = 200 KB), and that cap silently decided the
// brand for large theme bundles.
// KOMBIT's theme.min.css is 3.9 MB; its first 200 KB is reset/normalize
// greyscale, so kombit.dk scored "no usable colors", lost the candidate loop,
// and the sampler fell through to a parked squatter page at kombit.com. We now
// SCAN far more bytes than we ever hold: the stream is read in chunks, each
// chunk is tallied for hex colours and then discarded, so memory stays flat
// regardless of stylesheet size.
const MAX_CSS_SCAN_BYTES = 6_000_000;
const MAX_STYLESHEETS = 3;
// About/values/careers pages a company most often exposes its brand voice on.
// Tried in order on the winning host, capped by MAX_RESEARCH_PAGES / attempts.
const ABOUT_PATHS = [
  '/about', '/about-us', '/company', '/who-we-are',
  '/values', '/our-values', '/culture', '/careers', '/mission',
];
const MAX_RESEARCH_PAGES = 2;   // extra pages fetched beyond the colour-winner homepage
const MAX_RESEARCH_ATTEMPTS = 4; // upper bound on About-page fetch attempts (404s are cheap but bounded)

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

// PARKED-DOMAIN-GUARD-001 (2026-08-20) - pages that are NOT the employer.
// A squatter's holding page and a bot-challenge interstitial are both real HTML
// with a saturated template colour, so both PASS isBrandWorthy and win the
// candidate loop ahead of the employer's own site. `www.kombit.com` is the case
// that found this, and it turned out to be BOTH: a "Coming Soon" parking page
// from a normal browser, and from Cloudflare's own network a challenge page
// ("Unable to verify your browser") whose Tailwind-slate #0f172a was being
// returned as KOMBIT's brand while the real employer sits at kombit.dk.
const BLOCK_PHRASES = [
  // domain parking / holding
  'coming soon', 'under construction', 'domain is for sale', 'buy this domain',
  'this domain is parked', 'parked domain', 'domain parking', 'website coming soon',
  'is for sale', 'inquire about this domain', 'godaddy.com/domainsearch',
  'sedoparking', 'hugedomains', 'afternic', 'namecheap parking',
  // bot-challenge / WAF interstitials
  'unable to verify your browser', 'please refresh the page', 'checking your browser',
  'verifying you are human', 'verify you are human', 'enable javascript and cookies',
  'just a moment', 'attention required', 'ddos protection', 'cloudflare ray id',
  'access denied', 'request blocked',
];
const BLOCK_MAX_TEXT = 1500;   // chars of visible text a real homepage clears easily

function visibleTextLength(html) {
  return String(html || '')
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim().length;
}

function isNonEmployerPage(html) {
  const lower = String(html || '').toLowerCase();
  const t = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(lower);
  if (t && BLOCK_PHRASES.some((p) => t[1].includes(p))) return true;

  const textLen = visibleTextLength(html);
  // A phrase alone is not enough: a real employer site may legitimately say
  // "coming soon" about a product. Require a near-contentless page with it.
  if (textLen <= BLOCK_MAX_TEXT && BLOCK_PHRASES.some((p) => lower.includes(p))) return true;

  // NOT doing a structural "thin page with no external stylesheet" fallback: it
  // reads a deliberately minimal but REAL homepage the same as an interstitial,
  // and refusing a real employer costs brand we could have had. The phrase list
  // above is specific enough - a real company homepage does not say "unable to
  // verify your browser" on a contentless page. An interstitial that words
  // itself in some way not listed here still slips through; that residual is
  // tracked with BRAND-CANONICAL-SITE-CCTLD-001.
  return false;
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

// Tally hex colours over a STREAM without retaining it. A chunk boundary can
// split a "#rrggbb" token, so each chunk's tail is carried into the next.
async function tallyHexFromStream(response, counts, maxBytes) {
  const reader = response.body && response.body.getReader();
  if (!reader) { tallyHexInto(counts, await response.text()); return; }
  const dec = new TextDecoder('utf-8', { fatal: false });
  let total = 0, carry = '';
  while (total < maxBytes) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.length;
    const text = carry + dec.decode(value, { stream: true });
    tallyHexInto(counts, text);
    carry = text.slice(-8);          // a hex token is at most 7 chars
  }
  try { await reader.cancel(); } catch (_) { /* already drained */ }
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

// BRAND-WORTHY-PICK-001 + BRAND-INK-MATCH-001 (owner 2026-07-22): the old picker took
// the <meta name="theme-color"> first, but that is frequently a generic mobile chrome
// bar colour (e.g. #919191) shared across unrelated sites — a dull grey masquerading as
// a brand. And it DARKENED whatever it picked so the client could hardcode white ink,
// which destroyed a light brand (NVIDIA green). Now: pick the first colour that is a REAL
// brand (chromatic, or a deliberate near-black), keep it un-darkened, and return the ink
// (black/white) that is actually legible on it so the client matches instead of guessing.
function _wlin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
function relLum(hex) { return 0.2126 * _wlin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * _wlin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * _wlin(parseInt(hex.slice(5, 7), 16)); }
function contrast(a, b) { const x = relLum(a), y = relLum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
function brandInk(hex) { return contrast(hex, '#111111') >= contrast(hex, '#FFFFFF') ? '#111111' : '#FFFFFF'; }
function hslSat(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  return d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
}
// A real brand bg is CHROMATIC (saturated) or a deliberate near-BLACK (e.g. #232323).
// A greyscale mid-tone (generic theme-color) or a near-white is NOT a brand.
function isBrandWorthy(hex) { return hslSat(hex) >= 0.15 || relLum(hex) <= 0.06; }

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

function tallyHexInto(counts, text) {
  const matches = text.match(/#[0-9a-fA-F]{6}\b/g) || [];
  for (const raw of matches) {
    const h = raw.toLowerCase();
    if (KNOWN_WIDGET_COLORS.has(h)) continue; // third-party widget, not this company's brand
    const l = lum(h);
    if (l > 0.9 || l < 0.03) continue; // near-white / near-black chrome, never a brand accent
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  return counts;
}

function rankHexCounts(counts) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([h]) => h);
}

function extractHexColors(text) {
  return rankHexCounts(tallyHexInto(new Map(), text));
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

async function sampleColorsFromPage(pageUrl, collectSignals = false) {
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

  // PARKED-DOMAIN-GUARD-001 (2026-08-20, with BRAND-CANONICAL-SITE-CCTLD-001):
  // a domain squatter's holding page is real HTML with a saturated template
  // colour, so it PASSES isBrandWorthy and wins the candidate loop ahead of the
  // employer's actual site. Returning a stranger's palette as `brandLike: true`
  // is worse than returning nothing, so refuse to sample one.
  if (isNonEmployerPage(html)) return null;

  const styleBlocks = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
  const counts = tallyHexInto(new Map(), styleBlocks + ' ' + html);

  const sheetUrls = extractStylesheetLinks(html, pageUrl);
  for (const su of sheetUrls) {
    try {
      const sresp = await timedFetch(su, { method: 'GET' });
      if (sresp && sresp.ok) {
        const ct = (sresp.headers.get('content-type') || '').toLowerCase();
        // Scanned, not retained — a 3.9 MB theme bundle is tallied in full
        // without ever being held in memory (see MAX_CSS_SCAN_BYTES).
        if (ct.includes('css') || ct === '') await tallyHexFromStream(sresp, counts, MAX_CSS_SCAN_BYTES);
      }
    } catch (_) { /* best-effort — one bad stylesheet must not sink the sample */ }
  }

  const ranked = rankHexCounts(counts);
  if (!themeColor && !ranked.length) return null;

  // BRAND-WORTHY-PICK-001: choose the first REAL brand colour among
  // [theme-color, ...frequency-ranked stylesheet colours]. A greyscale theme-color
  // is skipped so a genuine stylesheet colour wins instead of a dull grey; if nothing
  // is brand-worthy we return null and the caller falls back to the package default.
  const candidates = [themeColor, ...ranked].filter(Boolean);
  const navy = candidates.find(isBrandWorthy) || null;
  if (!navy) return null;
  const navySource = (themeColor && navy === themeColor) ? 'meta theme-color' : 'stylesheet colors';
  const ink = brandInk(navy);   // legible header text for THIS bg (NVIDIA green -> black)
  // A genuine second color, if the page has one — never duplicate navy as
  // a fake accent, the client's apply path treats accent as optional.
  const accent = ranked.find((h) => h !== navy && h !== themeColor) || null;

  return {
    navy, accent, ink, hostname: new URL(pageUrl).hostname, navySource,
    // BRAND-DECIDES-RESEARCH-001: harvest the brand TEXT from the SAME html we
    // already fetched for colours — no extra request for the homepage signals.
    signals: collectSignals ? extractTextSignals(html) : null,
  };
}

// ─── brand-text (spirit/values/tone) harvest ──────────────────────
// Deterministic regex extraction of the visible brand voice from a page's
// html — never LLM-guessed. Feeds summarizeResearch().

function stripTags(s) {
  return String(s || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMetaContent(html, name, attr = 'name') {
  const a = attr.replace(/[^a-z]/gi, '');
  const n = name.replace(/[^a-z0-9:_-]/gi, '');
  const re1 = new RegExp('<meta[^>]+' + a + '=["\']' + n + '["\'][^>]*content=["\']([^"\']+)["\']', 'i');
  const re2 = new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]*' + a + '=["\']' + n + '["\']', 'i');
  const m = re1.exec(html) || re2.exec(html);
  return m ? stripTags(m[1]).slice(0, 400) : '';
}

function extractTextSignals(html) {
  const titleM = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  // Strip <script>/<style> blocks before scanning headings so a heading-shaped
  // string literal inside inline JS/CSS can't masquerade as a real <h1>/<h2>.
  const body = String(html || '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  const headings = [];
  const hre = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
  let m;
  while ((m = hre.exec(body)) && headings.length < 12) {
    const t = stripTags(m[1]);
    if (t && t.length >= 3 && t.length <= 160 && !headings.includes(t)) headings.push(t);
  }
  return {
    title: titleM ? stripTags(titleM[1]).slice(0, 200) : '',
    description: extractMetaContent(html, 'description'),
    ogDescription: extractMetaContent(html, 'og:description', 'property') || extractMetaContent(html, 'og:description'),
    ogSiteName: extractMetaContent(html, 'og:site_name', 'property') || extractMetaContent(html, 'og:site_name'),
    headings,
  };
}

function signalsHaveContent(s) {
  return !!(s && (s.description || s.ogDescription || s.title || (s.headings && s.headings.length)));
}

function signalsToText(sigList) {
  const parts = [];
  for (const s of sigList) {
    if (!s) continue;
    if (s.ogSiteName) parts.push('Site: ' + s.ogSiteName);
    if (s.title) parts.push('Title: ' + s.title);
    if (s.description) parts.push('Description: ' + s.description);
    if (s.ogDescription && s.ogDescription !== s.description) parts.push('Summary: ' + s.ogDescription);
    if (s.headings && s.headings.length) parts.push('Headings: ' + s.headings.slice(0, 12).join(' | '));
  }
  return parts.join('\n').slice(0, 6000);
}

async function fetchTextSignals(pageUrl) {
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
  const ct = (resp.headers.get('content-type') || '').toLowerCase();
  if (!ct.includes('html')) return null;
  const html = await readCapped(resp, MAX_HTML_BYTES);
  return extractTextSignals(html);
}

const RESEARCH_SYSTEM = `You extract a company's brand SPIRIT, VALUES, and TONE from text sampled from the company's OWN website (title, meta description, headings, About / values / careers pages).

Output MUST be valid JSON in exactly this shape. No prose, no markdown fences. JSON only:
{
  "spirit": string,        // ONE line: how the brand speaks and what it stands for, in its own register. "" if the text gives no signal.
  "values": string[],      // 3-8 SHORT value words/phrases the site actually states or clearly implies (e.g. "sustainability", "craftsmanship", "bold thinking"). [] if none are stated or implied.
  "tone": "minimal"|"bold"|"formal"|"warm"|"technical"|"playful"|""  // the dominant voice; "" if unclear
}

HARD RULES:
- Use ONLY what the supplied text supports. If the text is empty, generic boilerplate, or carries no brand signal, return spirit:"", values:[], tone:"".
- NEVER invent values the text does not state or clearly imply. A guessed value is worse than none.
- "tone": choose the single closest of the allowed words. minimal = restrained/quiet/precise; bold = expressive/energetic/ambitious; formal = conservative/serious; warm = human/caring; technical = engineering/rigorous; playful = fun/creative.
Begin your response with { and end with }.`;

async function summarizeResearch(env, site, signalsText) {
  const empty = { site: site || null, spirit: '', values: [], tone: '', signals_used: false };
  if (!env || !signalsText || signalsText.length < 40) {
    return { ...empty, signals_used: !!signalsText, flag: 'no_signals' };
  }
  let cascade;
  try {
    cascade = await callAnyLLMForJSON(
      env, RESEARCH_SYSTEM,
      'COMPANY WEBSITE TEXT (sampled from its own pages):\n---\n' + signalsText + '\n---\nReturn ONLY the JSON object.',
      { role: 'analysis', validate: (t) => extractJSON(t) !== null },
    );
  } catch (e) {
    return { ...empty, signals_used: true, flag: 'summary_error' };
  }
  if (!cascade || !cascade.ok) return { ...empty, signals_used: true, flag: 'summary_unavailable' };
  const parsed = extractJSON(cascade.text);
  if (!parsed) return { ...empty, signals_used: true, flag: 'summary_unparseable' };

  const ALLOWED_TONE = new Set(['minimal', 'bold', 'formal', 'warm', 'technical', 'playful']);
  const spirit = typeof parsed.spirit === 'string' ? parsed.spirit.trim().slice(0, 240) : '';
  const values = Array.isArray(parsed.values)
    ? [...new Set(parsed.values.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim().slice(0, 60)))].slice(0, 8)
    : [];
  const toneRaw = typeof parsed.tone === 'string' ? parsed.tone.trim().toLowerCase() : '';
  const tone = ALLOWED_TONE.has(toneRaw) ? toneRaw : '';

  const out = { site: site || null, spirit, values, tone, signals_used: true, provider: cascade.provider, model: cascade.model };
  if (!spirit && !values.length && !tone) out.flag = 'no_brand_signal';
  return out;
}

// Gather brand research from the colour-winning page + up to MAX_RESEARCH_PAGES
// About/values pages on the same host, then summarise. Honest on failure:
// returns empty spirit/values with a `flag`, never fabricated values.
async function buildResearch(env, winner, winnerUrl) {
  if (!winner || !winnerUrl) {
    return { site: null, spirit: '', values: [], tone: '', signals_used: false, flag: 'no_site' };
  }
  const sigList = [];
  if (winner.signals) sigList.push(winner.signals);

  let origin;
  try { origin = new URL(winnerUrl).origin; }
  catch (_) { origin = null; }

  if (origin) {
    let fetched = 0, attempts = 0;
    for (const path of ABOUT_PATHS) {
      if (fetched >= MAX_RESEARCH_PAGES || attempts >= MAX_RESEARCH_ATTEMPTS) break;
      const v = validateUrl(origin + path);
      if (!v.ok) continue;
      attempts++;
      const s = await fetchTextSignals(v.url.toString());
      if (signalsHaveContent(s)) { sigList.push(s); fetched++; }
    }
  }

  const signalsText = signalsToText(sigList);
  return summarizeResearch(env, origin ? origin + '/' : winnerUrl, signalsText);
}

// Exported for unit testing the deterministic (no-LLM) text harvest.
export { extractTextSignals, signalsToText };

// ─── candidate URL list ───────────────────────────────────────────

// BRAND-CANONICAL-SITE-CCTLD-001 (2026-08-20): the name guess used to emit
// `<slug>.com` and nothing else, so every non-.com employer — i.e. the whole
// Nordic pipeline — had exactly one shot, at a TLD they do not own. KOMBIT
// (kombit.dk) resolved to a parked squatter at kombit.com. The caller may now
// pass `tldHints` (the JD's language/country, or the ccTLD of a posting host the
// recruiter guard dropped); hints are tried right after .com and the total
// candidate count is capped so the loop stays bounded.
const MAX_CANDIDATES = 9;
const TLD_HINT_RE = /^[a-z]{2,12}(\.[a-z]{2,3})?$/;

function normalizeTldHints(hints) {
  const out = [];
  for (const raw of Array.isArray(hints) ? hints : []) {
    const t = String(raw || '').trim().toLowerCase().replace(/^\./, '');
    if (t && t !== 'com' && TLD_HINT_RE.test(t) && !out.includes(t)) out.push(t);
    if (out.length >= 4) break;
  }
  return out;
}

function buildCandidates(jdUrl, companyName, tldHints) {
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
      for (const tld of ['com', ...normalizeTldHints(tldHints)]) {
        candidates.push(`https://www.${slug}.${tld}/`);
        candidates.push(`https://${slug}.${tld}/`);
      }
    }
  }

  const seen = new Set();
  return candidates
    .filter((c) => (seen.has(c) ? false : (seen.add(c), true)))
    .slice(0, MAX_CANDIDATES);
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
  // BRAND-DECIDES-RESEARCH-001: opt-in. Only the brand-capture pipeline sets
  // this; the PWA colour-only path never does, so it stays byte-for-byte the
  // same (no About-page fetches, no LLM call, no `research` key in the reply).
  const wantResearch = body.research === true || body.research === 'true';

  const tldHints = Array.isArray(body.tldHints) ? body.tldHints : [];
  const candidates = buildCandidates(jdUrl, companyName, tldHints);
  if (!candidates.length) {
    const noSite = wantResearch
      ? { research: { site: null, spirit: '', values: [], tone: '', signals_used: false, flag: 'no_site' } }
      : {};
    return new Response(JSON.stringify({ ok: false, error: 'No fetchable company-site candidate could be resolved.', ...noSite }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const tried = [];
  let winner = null, winnerUrl = null;
  for (const candidate of candidates) {
    const v = validateUrl(candidate);
    if (!v.ok) { tried.push({ candidate, error: v.error }); continue; }
    let sampled = null;
    try { sampled = await sampleColorsFromPage(v.url.toString(), wantResearch); }
    catch (err) { tried.push({ candidate, error: String(err && err.message || err) }); continue; }
    if (sampled && (sampled.navy || sampled.accent)) { winner = sampled; winnerUrl = v.url.toString(); break; }
    tried.push({ candidate, error: 'no usable colors' });
  }

  // Research rides on the winning page (same host we sampled colours from), so
  // spirit/values are collected AT THE SAME TIME as the colour exploration.
  const research = wantResearch ? await buildResearch(env, winner, winnerUrl) : null;

  if (winner) {
    return new Response(JSON.stringify({
      ok: true,
      navy: winner.navy,
      accent: winner.accent,
      ink: winner.ink,          // BRAND-INK-MATCH-001: legible header ink for winner.navy
      brandLike: true,          // winner passed isBrandWorthy — a real brand, not grey chrome
      source: `Sampled from ${winner.hostname} (${winner.navySource})`,
      sampledHost: winner.hostname,
      ...(research ? { research } : {}),
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  return new Response(JSON.stringify({
    ok: false,
    error: 'Could not sample usable colors from any candidate site.',
    tried,
    ...(research ? { research } : {}),
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}
