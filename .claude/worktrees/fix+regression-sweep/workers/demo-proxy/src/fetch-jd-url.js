// /api/fetch-jd-url
// =================================================================
// POST with { url } returns { ok, text, title, source, status,
// html_length, extracted_chars } so the PWA can drop the result
// straight into the "Additional Signals" / JD-text path without a
// PDF parse step.
//
// Use cases this exists for:
//   - HR-on / Workday / Greenhouse / Lever / SAP SuccessFactors
//     pages where the downloaded PDF has subsetted fonts without
//     ToUnicode CMaps (text extraction returns binary noise)
//   - JDs that exist only as a posting page (no PDF link at all)
//   - LinkedIn jobs (returns the public posting; sign-in-walled
//     pages return a "please log in" body and the caller sees that
//     and can fall back)
//
// SSRF protection: any URL whose hostname resolves to a private,
// loopback, or link-local address is rejected up front (without a
// DNS lookup we can do a string check — Workers can't do
// resolveDns(), so we err on the strict side and only allow
// hostnames that don't *look* like IP-literals or local hosts).
// External cloud-metadata endpoints (169.254.169.254, etc.) are
// blocked at the hostname-string layer.
//
// Output text is extracted via a deliberately simple readability
// heuristic: strip script/style/nav/header/footer/svg/iframe/noscript
// blocks, decode common HTML entities, collapse whitespace. This
// loses sidebar navigation, cookie banners, footer noise — exactly
// the stuff we don't want feeding the JD analysis prompt anyway.
// Robust enough for HR-on, Workday, Greenhouse, Lever. Pages with
// heavy SPA hydration (LinkedIn jobs detail, some Indeed pages) may
// return less useful text — those need a vision-LLM fallback in a
// later round.

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 2_000_000;     // 2 MB hard cap before reading body
const MAX_TEXT_CHARS = 50000;         // truncate before returning

// Hostname blocklist. We can't do real DNS resolution from a Worker,
// so we block on string patterns that obviously point to private /
// metadata endpoints. A determined attacker who controls a DNS
// record can still resolve a public hostname to a private IP, but
// at that point they're not exfiltrating anything novel — the
// Worker only fetches and returns text, doesn't echo headers/cookies
// back to the caller.
const BLOCKED_HOSTS = new Set([
  'localhost', '127.0.0.1', '0.0.0.0', '::1',
  'metadata.google.internal',
  '169.254.169.254',  // AWS / GCP / Azure cloud metadata
  '100.100.100.200',  // Alibaba Cloud metadata
]);

function isPrivateIpLiteral(host) {
  // IPv4 literal check
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
  // IPv6 literal check (catch loopback + link-local prefixes)
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
  catch { return { ok: false, error: 'Not a valid URL. Include the http:// or https:// prefix.' }; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    return { ok: false, error: `Unsupported protocol: ${u.protocol}. Only http and https are allowed.` };
  }
  const host = u.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host)) {
    return { ok: false, error: `Blocked hostname: ${host}` };
  }
  if (isPrivateIpLiteral(host)) {
    return { ok: false, error: `Blocked private/loopback IP literal: ${host}` };
  }
  // A bare ".local" or empty host slipped through URL parsing
  if (!host || host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, error: `Blocked host suffix: ${host}` };
  }
  return { ok: true, url: u };
}


// ─── HTML → text ─────────────────────────────────────────────────

const ENTITY_MAP = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'",
  '&apos;': "'", '&nbsp;': ' ', '&hellip;': '…', '&mdash;': '—',
  '&ndash;': '–', '&laquo;': '«', '&raquo;': '»', '&rsquo;': '\u2019',
  '&lsquo;': '\u2018', '&rdquo;': '\u201D', '&ldquo;': '\u201C',
  '&bull;': '•', '&middot;': '·', '&copy;': '©', '&reg;': '®',
  '&trade;': '™', '&euro;': '€', '&pound;': '£', '&yen;': '¥',
  '&cent;': '¢', '&sect;': '§', '&para;': '¶', '&deg;': '°',
};
function decodeEntities(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10) || 0))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16) || 0))
    .replace(/&[a-z]+;/gi, m => ENTITY_MAP[m.toLowerCase()] || m);
}

// Strip a single tag + everything between it and its closer. Used
// for content blocks we explicitly don't want as text (scripts,
// styles, navigation, footer, etc.). Case-insensitive.
function stripBlock(html, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
  return html.replace(re, ' ');
}

function extractTitle(html) {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (!m) return '';
  return decodeEntities(m[1].replace(/\s+/g, ' ').trim()).slice(0, 300);
}

function htmlToText(html) {
  let s = html;
  // Drop blocks that never carry JD body text. Order matters —
  // strip scripts/styles before stripping tags so we don't leak
  // their text content.
  s = stripBlock(s, 'script');
  s = stripBlock(s, 'style');
  s = stripBlock(s, 'noscript');
  s = stripBlock(s, 'svg');
  s = stripBlock(s, 'iframe');
  s = stripBlock(s, 'nav');
  s = stripBlock(s, 'header');
  s = stripBlock(s, 'footer');
  s = stripBlock(s, 'aside');
  s = stripBlock(s, 'form');     // cookie consent, search forms

  // Convert structural tags to newlines so block boundaries survive.
  s = s.replace(/<\/(p|div|section|article|li|h[1-6]|tr|td|th|br)>/gi, '\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');

  // Strip all remaining tags.
  s = s.replace(/<[^>]+>/g, ' ');

  // Decode entities AFTER tag-strip so we don't accidentally create
  // new tags from entity-encoded angle brackets.
  s = decodeEntities(s);

  // Collapse whitespace. Keep newlines but compress repeats.
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/\n[ \t]+/g, '\n');
  s = s.replace(/[ \t]+\n/g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.trim();

  return s;
}


// ─── Main handler ────────────────────────────────────────────────

export async function handleFetchJdUrl(request, env, getCORS) {
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

  const v = validateUrl(body && body.url);
  if (!v.ok) {
    return new Response(JSON.stringify({ ok: false, error: v.error }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  const url = v.url;

  // Race the fetch against a manual timeout. Workers' native fetch
  // has its own runtime cap but it's >10s and we want to fail fast
  // so the user can paste manually if a site is slow or hanging.
  let response;
  const t0 = Date.now();
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'follow',
      headers: {
        // Some HR sites (Workday especially) gate on UA and serve a
        // skeleton SPA shell to anything that doesn't look like a
        // real browser. The desktop Chrome UA wins us the most pages.
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,da;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: ctl.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    const msg = String(err && err.message || err);
    const isTimeout = /abort/i.test(msg);
    return new Response(JSON.stringify({
      ok: false,
      error: isTimeout
        ? `Fetch timed out after ${FETCH_TIMEOUT_MS}ms. Try opening the URL in a tab and pasting the text manually.`
        : `Fetch failed: ${msg}`,
      url: url.toString(),
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const status = response.status;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // Reject non-HTML responses. PDFs go through the existing PDF
  // upload path. Plain text we'd accept but rarely see for JDs.
  if (!contentType.includes('html') && !contentType.includes('text/plain')) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Server returned ${contentType || 'unknown content-type'}. The /api/fetch-jd-url endpoint only handles HTML pages. PDFs should go through the file upload.`,
      status,
      url: url.toString(),
    }), { status: 415, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // Read body with size guard.
  let html;
  try {
    const reader = response.body && response.body.getReader();
    if (reader) {
      const chunks = [];
      let total = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > MAX_HTML_BYTES) {
          try { await reader.cancel(); } catch (_) {}
          return new Response(JSON.stringify({
            ok: false,
            error: `Page body exceeded ${MAX_HTML_BYTES} bytes — likely an SPA hydrating dynamic content. Try copy-pasting the visible JD text into Additional Signals.`,
            status, url: url.toString(),
          }), { status: 413, headers: { 'Content-Type': 'application/json', ...CORS } });
        }
        chunks.push(value);
      }
      const merged = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) { merged.set(c, off); off += c.length; }
      html = new TextDecoder('utf-8', { fatal: false }).decode(merged);
    } else {
      html = await response.text();
      if (html.length > MAX_HTML_BYTES) html = html.slice(0, MAX_HTML_BYTES);
    }
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Body read failed: ${err && err.message || err}`,
      status, url: url.toString(),
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const htmlLen = html.length;
  const title = extractTitle(html);
  let text = htmlToText(html);
  let truncated = false;
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    truncated = true;
  }

  // Surface obvious sign-in walls and empty bodies so the PWA can
  // show a useful message instead of feeding noise to the LLM.
  const lowText = text.toLowerCase();
  const wallHint = (() => {
    if (text.length < 200) {
      return 'Very little text was extracted. The page may render content via JavaScript that didn\'t execute. Try pasting the visible JD text directly.';
    }
    const wallSignals = [
      'sign in to continue', 'log in to view', 'please sign in', 'please log in',
      'access denied', 'unauthorized', 'this page isn\'t available',
      'you must be signed in', 'create a free account to view',
    ];
    for (const w of wallSignals) {
      if (lowText.includes(w)) return `Sign-in wall detected ("${w}"). Open the URL in a browser tab where you're logged in, copy the visible JD, and paste it into Additional Signals.`;
    }
    return null;
  })();

  return new Response(JSON.stringify({
    ok: true,
    text,
    title,
    source: url.toString(),
    status,
    duration_ms: Date.now() - t0,
    html_length: htmlLen,
    extracted_chars: text.length,
    truncated,
    wall_hint: wallHint,
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
