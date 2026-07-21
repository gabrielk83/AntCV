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
//   - LinkedIn jobs (rewritten to the public guest jobPosting
//     endpoint — see rewriteJobUrl below)
//
// SSRF protection: any URL whose hostname resolves to a private,
// loopback, or link-local address is rejected up front (without a
// DNS lookup we can do a string check — Workers can't do
// resolveDns(), so we err on the strict side and only allow
// hostnames that don't *look* like IP-literals or local hosts).
// External cloud-metadata endpoints (169.254.169.254, etc.) are
// blocked at the hostname-string layer.
//
// Content extraction is layered:
//   L1  extractMainContent() — locate the real JD body (<main>,
//       [role=main], the "skip to main content" anchor target, or
//       a text-density fallback) instead of dumping the whole page.
//   L2  rewriteJobUrl() — provider-specific URL rewrites (LinkedIn
//       guest jobPosting endpoint) that sidestep the consent wall
//       at the source.
//   L3  stripConsentAndPopups() — remove cookie-consent banners and
//       commercial/interstitial popups by selector + text fingerprint
//       before extraction, so they never reach the JD prompt.
// A content-quality gate (validateContentQuality) flags fetches that
// still look like consent boilerplate or are too short, so the PWA
// can prompt for manual paste instead of feeding noise to the LLM.

const FETCH_TIMEOUT_MS = 10000;
const MAX_HTML_BYTES = 2_000_000;     // 2 MB hard cap before reading body
const MAX_TEXT_CHARS = 50000;         // truncate before returning
const MIN_GOOD_TEXT_CHARS = 220;      // below this we treat as low-quality

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


// ─── L2: provider-specific URL rewrite ──────────────────────────
// Some providers gate the human-facing posting behind a consent
// wall or login, but expose the same posting via a public,
// bot-friendly endpoint. Rewriting the URL at the source is far
// more reliable than trying to strip the wall out of HTML.
//
// Returns { url: <rewritten URL string>, note: <string|null> }.
// `note` is surfaced in the response so we can see in logs/telemetry
// which rewrite fired. Pass the already-validated URL object in.

function rewriteJobUrl(u) {
  const host = u.hostname.toLowerCase().replace(/^www\./, '');

  // LinkedIn: /jobs/view/{id} (and variants carrying currentJobId)
  // are SPA + consent-walled server-side. The guest jobPosting API
  // returns the description fragment as plain HTML without auth.
  if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) {
    // Try path form first. Two shapes exist in the wild:
    //   numeric:  /jobs/view/4414211731/
    //   slug:     /jobs/view/senior-engineer-at-acme-4414211731
    // (the slug form is what the LinkedIn app's share sheet produces).
    // Take the LAST >=5-digit run in the /jobs/view/ path segment — the
    // job id always trails the slug; earlier digit runs ("engineer-2024")
    // are shorter or not last. Without this, slug URLs missed the guest
    // rewrite, fetched the consent-walled SPA page, and the extracted
    // description was the visually-clamped one ending in "…see more"
    // (owner report 2026-06-09).
    let jobId = null;
    const segM = /\/jobs\/view\/([^/?#]+)/.exec(u.pathname);
    if (segM) {
      const idM = /(\d{5,})(?=\D*$)/.exec(segM[1]);
      if (idM) jobId = idM[1];
    }
    // Fallback: ?currentJobId=4414211731 on a collections/search URL
    if (!jobId) {
      const q = u.searchParams.get('currentJobId');
      if (q && /^\d{5,}$/.test(q)) jobId = q;
    }
    if (jobId) {
      return {
        url: `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${jobId}`,
        note: `linkedin-guest-rewrite:${jobId}`,
      };
    }
  }

  // Eightfold.ai (NVIDIA careers, and many enterprise career sites):
  // jobs.<company>.com/careers/job/<id> and <tenant>.eightfold.ai/careers/job/<id>
  // are JS SPAs whose SERVER HTML carries only the theme/config bootstrap blob
  // ({"themeOptions":{"customTheme":{"varTheme":{"primary-color-100":…}}}}), not
  // the JD — so a normal fetch returns garbage (owner report 2026-06-20, NVIDIA
  // "Test Engineer - Photonic", JD-FETCH-EIGHTFOLD-GARBLED-001). The public
  // position API on the SAME origin returns the posting as JSON without auth:
  //   <origin>/api/apply/v2/jobs/<id>?domain=<brand-domain>
  // Signature = a /careers/job/<digits> path AND an eightfold marker (the
  // ?domain= query param that eightfold links always carry, or a *.eightfold.ai
  // host). High-precision; the handler also falls back to the HTML pipeline if
  // the API doesn't yield a usable description, so a false positive is harmless.
  {
    const m = /\/careers\/job\/(\d{4,})/.exec(u.pathname);
    const domainParam = u.searchParams.get('domain');
    const isEightfold = !!m && (!!domainParam || host.endsWith('eightfold.ai'));
    if (isEightfold) {
      const id = m[1];
      let domain = domainParam;
      if (!domain) {
        const parts = host.split('.');
        domain = parts.length >= 2 ? parts.slice(-2).join('.') : host;
      }
      return {
        url: `${u.origin}/api/apply/v2/jobs/${id}?domain=${encodeURIComponent(domain)}`,
        note: `eightfold-json:${id}`,
        json: 'eightfold',
      };
    }
  }

  // No rewrite — fetch the original.
  return { url: u.toString(), note: null };
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

// LINKEDIN-CARD-EXTRACT-001 (owner 2026-07-21 "manual add lost company/position for LinkedIn"):
// the LinkedIn guest jobPosting FRAGMENT (what the guest rewrite fetches) has NO <title> tag, so
// extractTitle() returned '' and the tracker's Company/Role auto-fill had nothing to derive from.
// The fragment DOES carry the role in <h2 class="…top-card-layout__title / topcard__title…"> and
// the company in <a class="…topcard__org-name-link…">. Mirror of workers/proxy (cv-proxy).
function extractLinkedInCard(html, bodyText) {
  const clean = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
  let role = '', company = '';
  const tm = /<h2\b[^>]*class="[^"]*(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h2>/i.exec(html);
  if (tm) role = clean(tm[1]).slice(0, 200);
  // org-name-link is the POSTING company — but for a recruiter posting that is the AGENCY
  // ("PMs for Hire"), not the hiring employer (owner 2026-07-21: "the company is DTU Wind").
  let orgName = '';
  const cm = /<a\b[^>]*class="[^"]*topcard__org-name-link[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(html);
  if (cm) orgName = clean(cm[1]).slice(0, 120);
  if (!orgName) { const fm = /<span\b[^>]*class="[^"]*topcard__flavor(?![-\w])[^"]*"[^>]*>([\s\S]*?)<\/span>/i.exec(html); if (fm) orgName = clean(fm[1]).slice(0, 120); }
  // Real employer: recruiters append the actual employer as the title's trailing "- <Employer>".
  // Prefer it over the agency org-name when it is SHORT and appears VERBATIM in the JD body (a
  // strong signal it is the hiring company, not part of the role), and strip it from the role.
  // Direct postings have no such suffix -> orgName (the real employer) is kept.
  const body = String(bodyText || '');
  const parts = role.split(/\s+[–—-]\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    const esc = last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (last && last.split(/\s+/).length <= 5 && esc && new RegExp('\\b' + esc + '\\b', 'i').test(body)) {
      company = last;
      role = parts.slice(0, -1).join(' - ').trim();
    }
  }
  if (!company) company = orgName;
  return { role, company };
}


// ─── L3: consent banner + commercial popup removal ──────────────
// Cookie-consent blocks and commercial interstitials are usually
// plain <div>s (not <form>s), so the old form-strip missed them.
// We remove any element whose opening tag carries a consent/popup
// attribute signature, plus any reasonably-sized block whose text
// matches a consent fingerprint. This runs BEFORE main-content
// extraction so a banner can't win the density contest.

// Attribute-signature regexes. Each removes the matching element and
// its contents. We match by id/class/role/aria/data-* hints that
// consent + modal libraries overwhelmingly use.
const POPUP_ATTR_PATTERNS = [
  // cookie / consent
  /\bid="[^"]*(cookie|consent|gdpr|onetrust|cmp|privacy-?banner)[^"]*"/i,
  /\bclass="[^"]*(cookie|consent|gdpr|onetrust|cmp|privacy-?banner)[^"]*"/i,
  /\bid="[^"]*(cookie|consent|gdpr|onetrust)[^"]*"/i,
  // generic modals / interstitials / overlays
  /\bclass="[^"]*(modal|popup|overlay|interstitial|lightbox|dialog-?backdrop|backdrop)[^"]*"/i,
  /\brole="dialog"/i,
  /\baria-modal="true"/i,
  /\bdata-(testid|qa|tracking-control-name)="[^"]*(cookie|consent|modal|popup|dismiss|sign-?in-?modal)[^"]*"/i,
];

// Text fingerprints. If a stripped element's TEXT (after a quick
// inner-text pass) matches enough of these, it's consent boilerplate.
const CONSENT_TEXT_FINGERPRINTS = [
  'respects your privacy',
  'use essential and non-essential cookies',
  'cookie policy',
  'accept', 'reject',
  'we use cookies',
  'manage your choices',
  'consent to',
  'update your choices',
];

// Remove an element (open tag → matching close) given a regex that
// matches its OPENING tag. Handles one level; consent blocks are
// rarely nested in a way that breaks this. We scan for the opening
// tag, then walk forward counting same-name open/close tags to find
// the true closer (depth-aware), so nested children don't truncate
// the removal early.
function removeElementByOpenTag(html, openTagRegex) {
  let out = html;
  let guard = 0;
  while (guard++ < 50) {
    const m = openTagRegex.exec(out);
    if (!m) break;
    const start = m.index;
    // Identify the tag name from the matched opening tag.
    const nameM = /^<\s*([a-z0-9]+)/i.exec(out.slice(start, start + 40));
    if (!nameM) { openTagRegex.lastIndex = start + 1; break; }
    const tag = nameM[1].toLowerCase();
    // Self-closing? then just drop the single tag.
    const openEnd = out.indexOf('>', start);
    if (openEnd === -1) break;
    if (out[openEnd - 1] === '/' || tag === 'br' || tag === 'img' || tag === 'input') {
      out = out.slice(0, start) + ' ' + out.slice(openEnd + 1);
      continue;
    }
    // Depth-walk to the matching close tag.
    const openRe = new RegExp(`<\\s*${tag}\\b`, 'gi');
    const closeRe = new RegExp(`<\\s*/\\s*${tag}\\s*>`, 'gi');
    let depth = 1;
    let cursor = openEnd + 1;
    let endIdx = -1;
    while (cursor < out.length) {
      openRe.lastIndex = cursor;
      closeRe.lastIndex = cursor;
      const nextOpen = openRe.exec(out);
      const nextClose = closeRe.exec(out);
      if (!nextClose) break;
      if (nextOpen && nextOpen.index < nextClose.index) {
        depth++;
        cursor = nextOpen.index + 1;
      } else {
        depth--;
        cursor = nextClose.index + nextClose[0].length;
        if (depth === 0) { endIdx = cursor; break; }
      }
    }
    if (endIdx === -1) {
      // Unbalanced — drop just the opening tag to make progress.
      out = out.slice(0, start) + ' ' + out.slice(openEnd + 1);
      continue;
    }
    out = out.slice(0, start) + ' ' + out.slice(endIdx);
    // reset regex state for next pass
    openTagRegex.lastIndex = 0;
  }
  openTagRegex.lastIndex = 0;
  return out;
}

function quickInnerText(htmlFragment) {
  return decodeEntities(htmlFragment.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripConsentAndPopups(html) {
  let s = html;

  // 1. Remove by attribute signature (depth-aware).
  for (const re of POPUP_ATTR_PATTERNS) {
    s = removeElementByOpenTag(s, new RegExp(re.source, 'i'));
  }

  // 2. Remove residual blocks whose text reads as consent boilerplate.
  //    Scan top-level div/section/aside blocks; if the block is small
  //    (< 1200 chars of inner text) and matches >= 2 fingerprints,
  //    drop it. Size cap avoids nuking the real JD if a JD happens to
  //    mention "cookie policy" in passing.
  const blockRe = /<(div|section|aside)\b[^>]*>[\s\S]*?<\/\1>/gi;
  s = s.replace(blockRe, (block) => {
    const txt = quickInnerText(block);
    if (txt.length > 1200) return block; // too big to be a banner
    let hits = 0;
    for (const fp of CONSENT_TEXT_FINGERPRINTS) {
      if (txt.includes(fp)) hits++;
      if (hits >= 2) return ' ';
    }
    return block;
  });

  return s;
}


// ─── L1: main-content extraction ────────────────────────────────
// Instead of dumping the entire page, locate the element most likely
// to hold the JD body, in priority order:
//   1. <main> ... </main>            (semantic, most reliable)
//   2. [role="main"] container
//   3. the target of a "Skip to main content" anchor
//      (<a href="#xyz">Skip to main content</a> → <... id="xyz">)
//   4. <article> ... </article>
//   5. density fallback: largest text-bearing block
// Returns the inner HTML of the chosen region, or the original html
// if nothing better is found.

function sliceBalancedElement(html, tag, fromIndex = 0) {
  const openRe = new RegExp(`<\\s*${tag}\\b[^>]*>`, 'gi');
  openRe.lastIndex = fromIndex;
  const open = openRe.exec(html);
  if (!open) return null;
  const start = open.index;
  const contentStart = open.index + open[0].length;
  const oRe = new RegExp(`<\\s*${tag}\\b`, 'gi');
  const cRe = new RegExp(`<\\s*/\\s*${tag}\\s*>`, 'gi');
  let depth = 1, cursor = contentStart;
  while (cursor < html.length) {
    oRe.lastIndex = cursor; cRe.lastIndex = cursor;
    const no = oRe.exec(html), nc = cRe.exec(html);
    if (!nc) break;
    if (no && no.index < nc.index) { depth++; cursor = no.index + 1; }
    else { depth--; cursor = nc.index + nc[0].length; if (depth === 0) {
      return { html: html.slice(start, cursor), inner: html.slice(contentStart, nc.index) };
    } }
  }
  return null;
}

function findByIdContainer(html, id) {
  // Find the element carrying id="..." and slice it balanced.
  const safeId = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const idRe = new RegExp(`<\\s*([a-z0-9]+)\\b[^>]*\\bid="${safeId}"`, 'i');
  const m = idRe.exec(html);
  if (!m) return null;
  const tag = m[1].toLowerCase();
  return sliceBalancedElement(html, tag, m.index);
}

function extractMainContent(html) {
  // 1. <main>
  let region = sliceBalancedElement(html, 'main');
  if (region && quickInnerText(region.inner).length >= MIN_GOOD_TEXT_CHARS) {
    return { html: region.inner, via: 'main-tag' };
  }

  // 2. [role="main"] — find the element with that attr, slice balanced.
  const roleM = /<\s*([a-z0-9]+)\b[^>]*\brole="main"/i.exec(html);
  if (roleM) {
    const r = sliceBalancedElement(html, roleM[1].toLowerCase(), roleM.index);
    if (r && quickInnerText(r.inner).length >= MIN_GOOD_TEXT_CHARS) {
      return { html: r.inner, via: 'role-main' };
    }
  }

  // 3. "Skip to main content" anchor → resolve its #target id.
  const skipM = /<a\b[^>]*href="#([^"]+)"[^>]*>\s*skip to (main )?content\s*<\/a>/i.exec(html)
            || /<a\b[^>]*href="#([^"]+)"[^>]*>[^<]*skip to (main )?content[^<]*<\/a>/i.exec(html);
  if (skipM && skipM[1]) {
    const target = findByIdContainer(html, skipM[1]);
    if (target && quickInnerText(target.inner).length >= MIN_GOOD_TEXT_CHARS) {
      return { html: target.inner, via: `skip-anchor:#${skipM[1]}` };
    }
  }

  // 4. <article> — take the largest one if several.
  {
    let best = null, bestLen = 0, idx = 0;
    while (idx < html.length) {
      const a = sliceBalancedElement(html, 'article', idx);
      if (!a) break;
      const len = quickInnerText(a.inner).length;
      if (len > bestLen) { bestLen = len; best = a; }
      idx = html.indexOf(a.html, idx) + a.html.length;
      if (idx <= 0) break;
    }
    if (best && bestLen >= MIN_GOOD_TEXT_CHARS) {
      return { html: best.inner, via: 'article-tag' };
    }
  }

  // 5. Density fallback: among top-level sections/divs, pick the one
  //    with the most text. Cheap heuristic — good enough once the
  //    chrome and consent blocks are already gone.
  {
    let best = '', bestLen = 0;
    const re = /<(section|div)\b[^>]*>[\s\S]*?<\/\1>/gi;
    let m;
    while ((m = re.exec(html))) {
      const len = quickInnerText(m[0]).length;
      if (len > bestLen) { bestLen = len; best = m[0]; }
    }
    if (best && bestLen >= MIN_GOOD_TEXT_CHARS) {
      return { html: best, via: 'density-fallback' };
    }
  }

  // Nothing better — return whole document.
  return { html, via: 'whole-document' };
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

  // Drop expand/collapse button artifacts. The LinkedIn guest fragment
  // (and most "read more" widgets) carries the FULL text in the HTML —
  // the clamp is CSS — but the button label survives tag-stripping as a
  // stray "Show more" / "…see more" line. Only whole lines are removed,
  // so JD sentences that merely contain these words are untouched.
  s = s.replace(/^[\s…·.]*(show|see|read)\s+(more|less)[\s…·.]*$/gim, '');
  s = s.replace(/\n{3,}/g, '\n\n').trim();

  return s;
}


// ─── L1 gate: content-quality validation ────────────────────────
// After extraction + text conversion, decide whether what we got
// looks like a real JD or like leftover consent boilerplate / an
// empty SPA shell. Returns a wall_hint string (problem) or null (ok).

function validateContentQuality(text) {
  if (text.length < MIN_GOOD_TEXT_CHARS) {
    return 'Very little text was extracted. The page may render content via JavaScript that didn\'t execute, or sits behind a wall. Try pasting the visible JD text directly.';
  }
  const low = text.toLowerCase();

  // SPA config/theme blob check: a JS-rendered career site (eightfold, some
  // Workday tenants) can leak its bootstrap config/theme JSON instead of the
  // JD — e.g. {"themeOptions":{"customTheme":{"varTheme":{"primary-color-100":
  // "#000000", … "button-primary-background-color":"#76b900"}}}} (owner report
  // 2026-06-20, NVIDIA). It is dominated by CSS-variable keys and hex colours,
  // not prose. Flag it so the PWA prompts for a manual paste rather than feeding
  // colour soup to the LLM. (For eightfold specifically the L2 rewrite already
  // sidesteps this via the position API; this is the catch-all backstop.)
  {
    const hexColors = (text.match(/"#[0-9a-fA-F]{3,8}"/g) || []).length;
    const cssVarKeys = (text.match(/"[a-z][a-z-]*-color[a-z0-9-]*"\s*:/gi) || []).length;
    if (low.includes('"themeoptions"') || low.includes('"customtheme"') ||
        cssVarKeys >= 8 || hexColors >= 20) {
      return 'The fetched content looks like the page\'s theme/config data, not the job description — this site renders the JD with JavaScript. Open the URL in a tab, copy the visible JD, and paste it into Additional Signals.';
    }
  }

  // Consent-fingerprint density check: if the extracted text is
  // SHORT and dominated by consent phrases, we grabbed the banner.
  let consentHits = 0;
  for (const fp of CONSENT_TEXT_FINGERPRINTS) {
    if (low.includes(fp)) consentHits++;
  }
  if (consentHits >= 3 && text.length < 1500) {
    return 'The fetched content looks like a cookie-consent notice rather than the job description. The provider may require accepting cookies in a browser first. Open the URL in a tab, copy the visible JD, and paste it into Additional Signals.';
  }

  // Sign-in walls.
  const wallSignals = [
    'sign in to continue', 'log in to view', 'please sign in', 'please log in',
    'access denied', 'unauthorized', 'this page isn\'t available',
    'you must be signed in', 'create a free account to view',
  ];
  for (const w of wallSignals) {
    if (low.includes(w)) {
      return `Sign-in wall detected ("${w}"). Open the URL in a browser tab where you're logged in, copy the visible JD, and paste it into Additional Signals.`;
    }
  }
  return null;
}


// ─── Eightfold position-API path ─────────────────────────────────
// Fetch the rewritten /api/apply/v2/jobs/<id> endpoint and build the JD
// response from its JSON. Returns a finished Response on success, or null to
// signal "fall back to the normal HTML pipeline against the original URL"
// (non-200, not JSON, or no usable description — so an over-broad rewrite can
// never make a fetchable page worse).
async function tryEightfoldJson(apiUrl, originalUrl, getCORS, request, env, t0, rewriteNote) {
  const CORS = getCORS(request, env);
  let resp;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    resp = await fetch(apiUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'application/json,text/plain,*/*',
        'Accept-Language': 'en-US,en;q=0.9,da;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: ctl.signal,
    });
    clearTimeout(timer);
  } catch { return null; }
  if (!resp.ok) return null;
  let data;
  try { data = await resp.json(); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const jd = data.job_description || data.jobDescription || data.description || '';
  let text = htmlToText(String(jd));
  if (text.length < MIN_GOOD_TEXT_CHARS) return null;
  const name = String(data.name || data.posting_name || '').trim();
  const dept = String(data.department || data.business_unit || '').trim();
  const loc = String(data.location || (Array.isArray(data.locations) && data.locations[0]) || '').trim();
  // Prepend a compact header so the role/dept/location survive into the JD text
  // (the model uses them for targeting); skip any field that's already echoed.
  const header = [name, dept, loc].filter(Boolean).join(' — ');
  if (header && !text.slice(0, 200).includes(name)) text = header + '\n\n' + text;
  let truncated = false;
  if (text.length > MAX_TEXT_CHARS) { text = text.slice(0, MAX_TEXT_CHARS); truncated = true; }
  return new Response(JSON.stringify({
    ok: true,
    text,
    title: name || extractTitle(''),
    source: originalUrl.toString(),
    fetched_url: apiUrl,
    rewrite: rewriteNote,
    extracted_via: 'eightfold-json',
    status: resp.status,
    duration_ms: Date.now() - t0,
    html_length: 0,
    extracted_chars: text.length,
    truncated,
    wall_hint: validateContentQuality(text),
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
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

  // L2: provider URL rewrite (LinkedIn guest endpoint, eightfold position API).
  let { url: fetchUrl, note: rewriteNote, json: jsonProvider } = rewriteJobUrl(url);
  const t0 = Date.now();

  // Eightfold career sites (NVIDIA etc.): try the JSON position API first; on
  // any miss (non-200 / not JSON / no usable description) fall back to fetching
  // the original page through the HTML pipeline below.
  if (jsonProvider === 'eightfold') {
    const jres = await tryEightfoldJson(fetchUrl, url, getCORS, request, env, t0, rewriteNote);
    if (jres) return jres;
    fetchUrl = url.toString();
    rewriteNote = (rewriteNote || '') + '→html-fallback';
  }

  // Race the fetch against a manual timeout. Workers' native fetch
  // has its own runtime cap but it's >10s and we want to fail fast
  // so the user can paste manually if a site is slow or hanging.
  let response;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), FETCH_TIMEOUT_MS);
    response = await fetch(fetchUrl, {
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
      url: fetchUrl,
      rewrite: rewriteNote,
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const status = response.status;
  const contentType = (response.headers.get('content-type') || '').toLowerCase();

  // JD-FETCH-BOT-CHALLENGE-001: guard on the HTTP status BEFORE extracting.
  // A bot-protected career site (Thales / phenom-feeds, DataDome, Akamai,
  // PerimeterX) answers a server-side fetch with 403 (or 401/429/503) and an
  // error/challenge HTML body. Without this guard the body was treated as a
  // successful fetch and the wall page was returned as the "JD". Surface a
  // clear paste-manually message instead — never feed an error page to the LLM.
  if (status >= 400) {
    let error;
    if (status === 403 || status === 401 || status === 451) {
      error = `The site blocked the automated fetch (HTTP ${status} — bot protection or a login wall). Open the URL in a browser tab, copy the visible job description, and paste it into Additional Signals.`;
    } else if (status === 429) {
      error = `The site rate-limited the fetch (HTTP 429). Wait a moment, or open the URL in a tab and paste the job description into Additional Signals.`;
    } else if (status === 404 || status === 410) {
      error = `The posting was not found (HTTP ${status}) — the link may have expired. Check the URL, or paste the job description text directly.`;
    } else {
      error = `The site returned HTTP ${status}. Open the URL in a tab and paste the visible job description into Additional Signals.`;
    }
    return new Response(JSON.stringify({
      ok: false,
      error,
      wall: true,
      status,
      url: fetchUrl,
      rewrite: rewriteNote,
    }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // Reject non-HTML responses. PDFs go through the existing PDF
  // upload path. Plain text we'd accept but rarely see for JDs.
  // (The LinkedIn guest endpoint returns an HTML fragment, so it
  //  passes this check.)
  if (!contentType.includes('html') && !contentType.includes('text/plain')) {
    return new Response(JSON.stringify({
      ok: false,
      error: `Server returned ${contentType || 'unknown content-type'}. The /api/fetch-jd-url endpoint only handles HTML pages. PDFs should go through the file upload.`,
      status,
      url: fetchUrl,
      rewrite: rewriteNote,
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
            status, url: fetchUrl, rewrite: rewriteNote,
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
      status, url: fetchUrl, rewrite: rewriteNote,
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const htmlLen = html.length;
  let title = extractTitle(html);
  let liCompany = '';
  const __isLinkedIn = String(rewriteNote || '').startsWith('linkedin-guest-rewrite');

  // L3: strip consent banners + commercial popups before extraction.
  const cleaned = stripConsentAndPopups(html);

  // L1: locate the main JD content region.
  const { html: mainHtml, via: extractedVia } = extractMainContent(cleaned);

  // Convert to text.
  let text = htmlToText(mainHtml);

  // Safety net: if main-content extraction produced almost nothing
  // (over-aggressive removal), fall back to the cleaned full document.
  if (text.length < MIN_GOOD_TEXT_CHARS && extractedVia !== 'whole-document') {
    text = htmlToText(cleaned);
  }

  let truncated = false;
  if (text.length > MAX_TEXT_CHARS) {
    text = text.slice(0, MAX_TEXT_CHARS);
    truncated = true;
  }

  // LINKEDIN-CARD-EXTRACT-001: the guest fragment has no <title>; pull role + REAL employer from
  // the top-card (body-confirming a recruiter-appended employer) so the tracker pre-fills again.
  if (__isLinkedIn) {
    const card = extractLinkedInCard(html, text);
    if (card.role) title = card.role;
    if (card.company) liCompany = card.company;
  }

  // L1 gate: flag low-quality / consent / wall content.
  const wallHint = validateContentQuality(text);

  return new Response(JSON.stringify({
    ok: true,
    text,
    title,
    company: liCompany || undefined,   // LINKEDIN-CARD-EXTRACT-001: employer for the tracker pre-fill
    source: url.toString(),
    fetched_url: fetchUrl,
    rewrite: rewriteNote,
    extracted_via: extractedVia,
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
