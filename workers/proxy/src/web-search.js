// Web-search backend for recruiter enrichment.
// =================================================================
// Currently supports Brave Search (https://search.brave.com/help/api).
// Brave is chosen because:
//   - Independent index (not a Google/Bing reseller)
//   - Has a free tier (~2000 queries/month) usable for personal AntCV
//   - API is simple JSON, no SDK needed
//   - Cloudflare Workers can fetch it directly
//
// If BRAVE_SEARCH_API_KEY isn't set on the Worker, recruiter
// enrichment returns { ok: false, error: 'no_key' } and the
// /api/jd-analysis response simply omits web_signals. The candidate
// still gets recruiter name + title from the JD itself — search is
// purely additive.
//
// Future backends (Bing, SerpAPI, Google CSE, DuckDuckGo HTML) can
// be added behind the same searchRecruiter() interface — the env var
// name determines which backend runs.
//
// PRIVACY: The search query goes to Brave's servers. Recruiter names
// from public job descriptions are public information so this is
// acceptable, but the user should know it's happening. The PWA can
// surface this in the analysis panel via the returned `backend`
// field, and disable it per-request with { search_recruiter: false }.

const BRAVE_ENDPOINT = 'https://api.search.brave.com/res/v1/web/search';

// Search for a recruiter and return a structured `web_signals`
// object. Returns { ok: true, web_signals, backend, queries } on
// success or { ok: false, error } on any failure.
export async function searchRecruiter(env, { name, company, title, location }) {
  if (!name || typeof name !== 'string' || name.trim().length < 3) {
    return { ok: false, error: 'no_name' };
  }
  // Reject obviously generic names that won't search well.
  const lower = name.toLowerCase().trim();
  if (lower === 'hiring manager' || lower === 'recruiter' || lower === 'hr' || lower === 'talent acquisition') {
    return { ok: false, error: 'generic_name', reason: 'JD references a role, not a person' };
  }

  const apiKey = env && (env.BRAVE_SEARCH_API_KEY || env.Brave_Search_API_Key);
  if (!apiKey) {
    return { ok: false, error: 'no_key', reason: 'BRAVE_SEARCH_API_KEY not configured on cv-proxy' };
  }

  // Build search queries — most specific first. We stop as soon as
  // we find a strong LinkedIn match, so the first query matters most.
  const queries = buildQueries({ name, company, title, location });

  let aggregated = null;
  const queriesUsed = [];

  for (const q of queries) {
    queriesUsed.push(q);
    try {
      const res = await braveSearch(apiKey, q);
      if (!res.ok) continue;
      const extracted = extractSignals(res.results, { name, company });
      if (!aggregated) aggregated = extracted;
      else aggregated = mergeSignals(aggregated, extracted);
      // Strong match found → stop here. A strong match has a LinkedIn
      // URL where the linkedin profile name overlaps the recruiter name.
      if (extracted.linkedin_url && extracted.linkedin_match_strong) break;
    } catch (e) {
      // Continue to next query — one failure shouldn't abort the whole search.
      continue;
    }
  }

  if (!aggregated) {
    return {
      ok: true,
      backend: 'brave_search',
      queries: queriesUsed,
      web_signals: {
        available: true,
        linkedin_url: null,
        snippets: [],
        sources: [],
        notes: 'No web results matched. Recruiter may not have a public profile, or the name is too common.',
      },
    };
  }

  return {
    ok: true,
    backend: 'brave_search',
    queries: queriesUsed,
    web_signals: {
      available: true,
      linkedin_url: aggregated.linkedin_url,
      linkedin_match_strong: aggregated.linkedin_match_strong || false,
      snippets: aggregated.snippets.slice(0, 5),
      sources: aggregated.sources.slice(0, 5),
      notes: aggregated.notes || null,
    },
  };
}

function buildQueries({ name, company, title, location }) {
  const queries = [];
  // Q1: most specific — name + company + "LinkedIn"
  if (company) queries.push(`${name} ${company} LinkedIn`);
  // Q2: name + company (no platform filter)
  if (company) queries.push(`${name} ${company}`);
  // Q3: name + title + location (catches when company is missing or wrong)
  if (title && location) queries.push(`${name} ${title} ${location} LinkedIn`);
  // Q4: name + LinkedIn alone (last resort — generic names will get noisy)
  queries.push(`${name} LinkedIn`);
  // De-duplicate, preserve order
  return [...new Set(queries)];
}

async function braveSearch(apiKey, query) {
  const url = new URL(BRAVE_ENDPOINT);
  url.searchParams.set('q', query);
  url.searchParams.set('count', '10');
  url.searchParams.set('safesearch', 'moderate');
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Subscription-Token': apiKey,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  const results = data?.web?.results || [];
  return { ok: true, results };
}

// Score each result and pull the strongest signals.
function extractSignals(results, { name, company }) {
  const out = {
    linkedin_url: null,
    linkedin_match_strong: false,
    snippets: [],
    sources: [],
    notes: null,
  };
  if (!Array.isArray(results) || results.length === 0) {
    out.notes = 'No web results matched. Recruiter may not have a public profile, or the name is too common.';
    return out;
  }

  const nameTokens = tokenize(name);
  const companyTokens = company ? tokenize(company) : [];

  for (const r of results) {
    const url = r.url || '';
    const title = r.title || '';
    const desc = r.description || '';
    const lowerUrl = url.toLowerCase();
    const lowerText = (title + ' ' + desc).toLowerCase();

    // Score this result against the recruiter signals
    const isLinkedIn = lowerUrl.includes('linkedin.com/in/');
    const nameMatch = nameTokens.every(t => lowerText.includes(t));
    const companyMatch = companyTokens.length === 0
      ? null
      : companyTokens.some(t => lowerText.includes(t));

    // Capture any LinkedIn URL where the name matches. If a company
    // was provided, mark "strong" only when the company also appears
    // in the result text. We surface partial matches (different
    // company) and warn the user via `notes` rather than hide them
    // — sometimes the recruiter has changed jobs since the JD was
    // posted, or the JD has the wrong employer, or the search
    // results aren't fresh. Showing the user the candidate URL plus
    // a partial-match warning is more useful than silently dropping it.
    if (isLinkedIn && nameMatch) {
      if (!out.linkedin_url) {
        out.linkedin_url = url;
        out.linkedin_match_strong = (companyMatch === true) || (companyMatch === null);
      } else if (!out.linkedin_match_strong && companyMatch === true) {
        // Upgrade: a later result is a stronger match → replace
        out.linkedin_url = url;
        out.linkedin_match_strong = true;
      }
    }

    // Collect informative snippets that mention the recruiter name AND
    // either the company or a job-relevant signal.
    if (nameMatch) {
      // Strip HTML entities Brave sometimes returns.
      const cleanDesc = desc
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 280);
      if (cleanDesc && out.snippets.length < 8) {
        out.snippets.push(cleanDesc);
        out.sources.push({
          title: title.slice(0, 120),
          url: url,
          is_linkedin: isLinkedIn,
        });
      }
    }
  }

  if (out.linkedin_url && !out.linkedin_match_strong) {
    out.notes = 'LinkedIn match is partial (different company in result) — verify the profile belongs to the recruiter before using.';
  } else if (!out.linkedin_url && out.snippets.length === 0) {
    out.notes = 'No public profile found in search results. Recruiter may not have a discoverable web presence.';
  } else if (!out.linkedin_url && out.snippets.length > 0) {
    out.notes = 'No LinkedIn profile found; snippets below are context only.';
  }

  return out;
}

function mergeSignals(a, b) {
  if (!a) return b;
  if (!b) return a;
  return {
    linkedin_url: a.linkedin_url || b.linkedin_url,
    linkedin_match_strong: a.linkedin_match_strong || b.linkedin_match_strong,
    snippets: [...new Set([...a.snippets, ...b.snippets])].slice(0, 8),
    sources: [...a.sources, ...b.sources.filter(s2 =>
      !a.sources.some(s1 => s1.url === s2.url)
    )].slice(0, 8),
    notes: a.notes || b.notes,
  };
}

function tokenize(s) {
  return (s || '').toLowerCase().split(/\s+/).filter(t => t.length >= 2);
}
