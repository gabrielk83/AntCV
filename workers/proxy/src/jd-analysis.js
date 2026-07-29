// JD-analysis endpoint helper.
// =================================================================
// POST /api/jd-analysis with { jd_text, candidate_summary? } returns a
// structured analysis the PWA renders in its analysis panel:
//
//   {
//     ok: true,
//     analysis: {
//       company:    { name, sector, size_signal, location },
//       role:       { title, level, type, keywords },
//       recruiter:  { name, title, email, linkedin, notes },
//       questions_in_jd: [{ question, suggested_answer, grounded }],
//       language:   'en' | 'da' | …,
//       red_flags:  [string],
//       assumptions:      [string],   // working assumptions not directly stated
//       recommendations:  [string],   // concrete, honest next actions
//       confidence_notes: [{ text, confidence: 0..1, issue: string|null }],
//       summary:    string
//     },
//     model: '<which LLM produced this>',
//     duration_ms: number
//   }
//
// On failures: { ok: false, error, hint? } with appropriate status.
//
// The endpoint cascades through configured LLM providers (Anthropic
// → OpenAI → Mistral → Gemini by default) so a 400 from one provider
// doesn't fail the whole request — the next provider's key is tried
// automatically. See ./multi-llm.js.

import { callAnyLLMForJSON } from './multi-llm.js';


const SYSTEM_PROMPT = `You are an analyst preparing a job-description briefing for a candidate.

Your output MUST be valid JSON matching this exact schema. No prose before or after. No markdown code fences. JSON only.

{
  "company":   { "name": string|null, "sector": string|null, "size_signal": "startup"|"mid-size"|"enterprise"|null, "location": string|null },
  "role":      { "title": string|null, "level": "junior"|"mid"|"senior"|"lead"|"principal"|"manager"|"director"|"executive"|null, "type": "permanent"|"contract"|"temporary"|"internship"|null, "keywords": string[] },
  "recruiter": { "name": string|null, "title": string|null, "email": string|null, "linkedin": string|null, "notes": string|null } | null,
  "questions_in_jd": [
    { "question": string, "suggested_answer": string, "grounded": boolean }
  ],
  "language": "en"|"da"|"sv"|"de"|"fr"|"es"|"he"|"unknown",
  "jd_text": string,
  "supporting_context": string,
  "detected_language": string,
  "category": "engineering_hardware"|"engineering_software"|"product_management"|"research_phd"|"program_management"|"operations"|"data_analytics"|"consulting"|"executive"|"finance"|"people_soft"|"unsolicited",
  "qualifications": [ { "text": string, "weight": 1.0|0.5|0.25 } ],
  "red_flags": string[],
  "assumptions": string[],
  "recommendations": string[],
  "confidence_notes": [ { "text": string, "confidence": number, "issue": string|null } ],
  "salary_estimate": { "stated": boolean, "stated_text": string|null, "currency": string|null, "period": "year"|"month"|"hour"|null, "low": number|null, "point": number|null, "high": number|null, "basis": string|null, "confidence": number },
  "summary": string
}

PAGE-NOISE STRIPPING — jd_text, supporting_context, detected_language, category:
- The input may be raw JD text, OR a full webpage scrape from a job board where the user is logged in. In the second case, common surrounding noise includes:
  * greeting/login banners ("Welcome back, <Name>", "Logged in as ...")
  * "Recommended jobs for you" / "Similar positions" sidebars
  * generic application tips applicable to any role on the platform
  * newsletter signups, cookie banners, site navigation
- "jd_text": the job description body only. Strip greetings, session info, recommended-jobs sidebars. Keep everything that describes the role (responsibilities, requirements, team, company info).
- "supporting_context": role-specific tips or signals from the page that apply ONLY to THIS role — e.g., "The hiring manager Maria values X", "This team is migrating from Y to Z". These help tailoring but are NOT facts about the user. Empty string if none.
- "detected_language": ISO 639-1 code of jd_text (e.g. "en", "da", "sv", "de", "fr", "es"). Same value goes in the legacy "language" field too. If unintelligible, "unknown".
- "category": auto-tag based on JD content. One of: engineering_hardware, engineering_software, product_management, research_phd, program_management, operations, data_analytics, consulting, executive, finance, people_soft, unsolicited. If the JD is conspicuously absent (user pasted a company URL with no posting), use "unsolicited". "people_soft" covers HR, talent, L&D, comms, marketing, content, design.
- "qualifications" — every distinct skill/qualification/requirement the JD asks for (CLUSTER-QUAL-001), each as a SHORT normalized phrase (e.g. "Stakeholder management", "PMP certification", "Python", not a full sentence). weight: 1.0 for explicitly required/must-have, 0.5 for preferred/nice-to-have-but-named-as-a-plus, 0.25 for a loosely implied or tangential skill. Extract from BOTH "requirements"/"must have" sections AND responsibilities text where a concrete skill is named. Do NOT invent a qualification the JD doesn't actually ask for or imply. [] for a true unsolicited (no JD) run.

CLASSIFICATION RULES:
- Treat the input as a job description if you can identify ANY of: a role title, "Tasks and responsibilities", "About the role", "What you'll do", "We are looking for", "Apply", "Application deadline", or company-and-location framing. PDF extraction often garbles parts of the page — work with what's readable. Do NOT declare "no job description" unless the entire input is unintelligible.
- If the input is mostly intelligible but some segments are garbled (random hex, mojibake, scrambled characters), still extract everything you can from the readable parts. Mention garbled-text in red_flags but otherwise proceed.
- If the input genuinely looks like candidate profile data (CV/resume), say so in summary and set most fields to null. But err on the side of treating it AS a JD when there's mixed signal.

ANTI-FABRICATION RULES (HARD):
- Every value MUST come from the JD text or be derivable from it. If the JD doesn't mention something, the field is null (or [] for arrays).
- "recruiter" is the WHOLE object, set to null if no recruiter is named in the JD.
- "recruiter.name" is the exact name if given. Do NOT guess from a generic "Hiring Manager" reference. Do NOT invent a name.
- "recruiter.email" / "recruiter.linkedin" — copy verbatim from the JD if present, otherwise null. NEVER guess or construct.

RECRUITER LOCATION HINTS:
- Recruiter contact info is often at the BOTTOM of the JD, under headings like "Questions", "Contact", "Apply via", "Get in touch", or "Reach out to". Scan trailing paragraphs carefully — the body of the JD often doesn't name a person but the footer does.
- Patterns like "reach out to hiring manager: Name, Title, email@domain.com" or "questions to Name (email@domain.com)" yield all three fields (name, title, email).
- An email address with a corporate-looking domain (matches the company's apparent domain or industry) is a recruiter signal. Copy it verbatim — never invent or normalize.

QUESTIONS-IN-JD DETECTION:
- "questions_in_jd" must include questions the JD explicitly asks the candidate to answer. Recognize these formats:
  * Numbered: "1. Key experience #1", "Question 1:", "Q1.", "Q1)"
  * Prefixed: "Key experience #N", "Skill assessment #N", "Tell us about", "Describe your experience with"
  * Imperative: sentences starting with "Describe…", "Tell us…", "Explain…", "Share an example of…" — when the JD's context makes clear it's a question to the candidate (e.g. inside a "Questions for the candidate" / "Application questions" block)
  * Inline within an application-process section
- Each question is one item; capture the FULL question text, not just the header. Example: header "1. Key experience #1" + body "Describe your hands-on experience in developing…" → question = "Describe your hands-on experience in developing…"
- Do NOT manufacture questions. If the JD doesn't ask any, return [].

For "suggested_answer" on each question:
- If a candidate_summary is provided AND the answer can be grounded in it, write a direct, short answer (~3-5 sentences) drawing on the candidate's actual experience. Set "grounded": true.
- If the candidate_summary doesn't cover the answer, write a SHORT placeholder ("[needs candidate input on X]") and set "grounded": false.
- NEVER make up candidate experience. NEVER claim domains not in the candidate_summary.

- "red_flags" — surface anything that warrants attention: vague compensation, unrealistic skill mix, no recruiter contact path, application deadline imminent OR already passed (judge against TODAY'S DATE given in the user message — never assume a different current year), requires citizenship the JD lists, garbled text in the source, etc.
- "summary" — 2-3 sentence plain-language briefing for the candidate.

HONESTY-FIRST OUTPUTS — assumptions, recommendations, confidence_notes:
- "assumptions" — the working assumptions this briefing makes that are NOT directly stated in the JD or the candidate summary (e.g. an inferred seniority, an assumed domain transfer, an unstated tooling overlap). Each one short sentence phrased AS an assumption ("Assumes the candidate's X transfers to the role's Y"). [] when the analysis rests only on stated facts.
- "recommendations" — concrete, honest next actions the candidate can take to strengthen fit: close a gap, reframe adjacent experience, attach proof, complete a short course. Adjacent experience MUST be described as adjacent — never claimed as already held. Order by impact. [] if none.
- QUESTIONS TO THE EMPLOYER (Nordic application craft — calling about the posting gives a head start; the interview effectively starts on the phone): ALSO append 3–4 recommendations of the form "Call the employer and ask: <question>". Ground each question in THIS posting (turn an unclear/ambiguous task or competency into a concrete question; ask how the listed tasks are prioritised). Adapt these four standards to the JD's own wording and avoid yes/no phrasing: (1) of the tasks you list, which take the most time? (2) which professional qualifications are you especially looking for? (3) are any qualifications absolutely decisive — which? (4) I have done similar tasks before — could that be relevant here? Prefix each with "Call the employer and ask: " so it reads as an action. Never tell the candidate to call merely to "be remembered" — only to learn the employer's real priorities so the CV + cover letter can be targeted.
- "salary_estimate" — a compensation read for THIS role:
  * If the JD states pay, set "stated": true, copy the exact pay text verbatim into "stated_text", and parse it into currency / period / low / point / high (point = the midpoint when a range is given, or the single figure when only one is stated). confidence >= 0.8.
  * If the JD does NOT state pay, set "stated": false and ESTIMATE a realistic market range from the role title, level, sector, and location. Set currency to the locale of the location (DKK for Denmark, SEK for Sweden, EUR for the euro-zone, GBP for the UK, USD for the US, etc.), period "year" unless the role is clearly hourly/contract, fill low / point / high, and write a one-sentence "basis" naming the factors used (role + level + location + market). confidence 0.3–0.5 — this is an inferred estimate, NOT a JD fact. The "stated": false flag and the basis sentence keep it honest; NEVER present an estimate as if the JD stated it.
  * If you genuinely cannot estimate (no role or location signal), set every numeric field null, "stated": false, confidence 0.2, and a "basis" explaining why.
- "confidence_notes" — score how well the KEY claims in THIS analysis are grounded in the JD + candidate summary. Each: { "text": the claim as a short sentence, "confidence": a number 0..1, "issue": a short reason when confidence < 0.7, else null }. Use the SAME standard as the ANTI-FABRICATION block and the "grounded" flag: an unsupported or overstated claim scores LOW (< 0.4) and carries an issue; a partially-supported / adjacent claim scores MEDIUM (0.4–0.7) with a short issue; a fully-grounded claim scores HIGH (>= 0.7) with issue null. Cover the 4–10 most decision-relevant claims. NEVER invent support to raise a score.

Output ONLY the JSON object. Begin your response with { and end with }.`;

function buildUserPrompt(jdText, candidateSummary, todayISO) {
  const parts = [];
  if (todayISO) {
    parts.push("TODAY'S DATE: " + todayISO + ' (use this as "now" when judging whether an application deadline is imminent, past, or far in the future — do NOT assume any other current date).');
    parts.push('');
  }
  parts.push('JOB DESCRIPTION:');
  parts.push('---');
  parts.push(jdText);
  parts.push('---');
  if (candidateSummary && candidateSummary.trim()) {
    parts.push('');
    parts.push('CANDIDATE SUMMARY (use only for grounding suggested answers; never invent experience):');
    parts.push('---');
    parts.push(candidateSummary);
    parts.push('---');
  } else {
    parts.push('');
    parts.push('CANDIDATE SUMMARY: (none provided — for any questions in the JD, set "grounded": false and use placeholder answers)');
  }
  return parts.join('\n');
}

// Best-effort JSON extraction. The system prompt asks for pure JSON,
// but if the model wraps it in code fences or adds preamble we handle
// it gracefully.
export function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();
  // Strip markdown fences if present.
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  // If there's still preamble, find the first { ... } that JSON-parses.
  if (s[0] !== '{') {
    const first = s.indexOf('{');
    const last = s.lastIndexOf('}');
    if (first >= 0 && last > first) s = s.substring(first, last + 1);
  }
  try { return JSON.parse(s); }
  catch { return null; }
}

// Validate and sanitize the parsed analysis. Returns a normalized
// object with safe defaults for missing fields. This keeps the API
// contract stable for the PWA even if the LLM omits some fields.
function normalize(analysis) {
  const a = analysis || {};
  const n = (v, def = null) => (v == null ? def : v);
  const arr = (v) => Array.isArray(v) ? v : [];
  const str = (v) => typeof v === 'string' ? v : null;

  return {
    company: {
      name: str(a.company?.name),
      sector: str(a.company?.sector),
      size_signal: str(a.company?.size_signal),
      location: str(a.company?.location),
    },
    role: {
      title: str(a.role?.title),
      level: str(a.role?.level),
      type: str(a.role?.type),
      keywords: arr(a.role?.keywords).filter(x => typeof x === 'string').slice(0, 30),
    },
    recruiter: a.recruiter == null ? null : {
      name: str(a.recruiter.name),
      title: str(a.recruiter.title),
      email: str(a.recruiter.email),
      linkedin: str(a.recruiter.linkedin),
      notes: str(a.recruiter.notes),
    },
    questions_in_jd: arr(a.questions_in_jd)
      .filter(q => q && typeof q.question === 'string')
      .slice(0, 20)
      .map(q => ({
        question: q.question,
        suggested_answer: str(q.suggested_answer) || '',
        grounded: q.grounded === true,
      })),
    language: str(a.language) || 'unknown',
    // CLUSTER-QUAL-001-CATEGORY-001 (owner 2026-07-05): category was requested
    // in the prompt schema but never surfaced in the normalized response, so
    // the client had no real classified category to persist — every save sent
    // a placeholder "targeted"/"unsolicited" string instead of one of the 12
    // real category ids, and the whole category->cluster pipeline (row 9)
    // never saw real data. access-relay's own normalizeCategory() is the
    // authoritative validator (coerces anything unrecognized to 'unsolicited'),
    // so this just passes the LLM's raw value through with a safe default.
    category: str(a.category) || 'unsolicited',
    qualifications: arr(a.qualifications)
      .filter(q => q && typeof q.text === 'string' && q.text.trim())
      .slice(0, 40)
      .map(q => {
        const w = Number(q.weight);
        const weight = (w === 1.0 || w === 0.5 || w === 0.25) ? w
          : (w >= 0.75 ? 1.0 : w >= 0.375 ? 0.5 : 0.25);
        return { text: q.text.trim().slice(0, 200), weight };
      }),
    red_flags: arr(a.red_flags).filter(x => typeof x === 'string').slice(0, 20),
    assumptions: arr(a.assumptions).filter(x => typeof x === 'string' && x.trim()).slice(0, 20),
    recommendations: arr(a.recommendations).filter(x => typeof x === 'string' && x.trim()).slice(0, 20),
    confidence_notes: arr(a.confidence_notes)
      .filter(c => c && typeof c.text === 'string' && c.text.trim())
      .slice(0, 24)
      .map(c => {
        let conf = Number(c.confidence);
        if (!Number.isFinite(conf)) conf = 0.5;
        conf = Math.max(0, Math.min(1, conf));
        const issue = (typeof c.issue === 'string' && c.issue.trim()) ? c.issue.trim() : null;
        return { text: c.text.trim(), confidence: conf, issue };
      }),
    salary_estimate: (() => {
      const s = a.salary_estimate || {};
      const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
      const period = (s.period === 'year' || s.period === 'month' || s.period === 'hour') ? s.period : null;
      let conf = Number(s.confidence);
      if (!Number.isFinite(conf)) conf = s.stated === true ? 0.8 : 0.4;
      conf = Math.max(0, Math.min(1, conf));
      return {
        stated: s.stated === true,
        stated_text: str(s.stated_text),
        currency: str(s.currency),
        period,
        low: num(s.low),
        point: num(s.point),
        high: num(s.high),
        basis: str(s.basis),
        confidence: conf,
      };
    })(),
    summary: str(a.summary) || '',
  };
}

// =================================================================
// Regex-based safety nets — last resort for things the LLM missed.
//
// The LLM is usually the better extractor (it has context). These
// only fire when the LLM returned null for a field but the raw JD
// text contains a clear match. Surfaces a confidence note so the
// PWA can render them with a subtle "auto-detected" badge.
// =================================================================

// RFC-5322-lite email regex. Conservative — we want to ONLY match
// things that look like real corporate emails, not random strings
// with @ in them (e.g. GitHub mentions).
const EMAIL_RX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+\b/g;

// LinkedIn profile URL — public profile path /in/<slug>. Robust to
// http/https, with-or-without www.
const LINKEDIN_RX = /https?:\/\/(?:www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?/gi;

// "reach out to <person>: <title>, <email>" / "questions to <person>"
// — captures common European HR-platform footer patterns. The name
// is the bit between the verb and the comma or email.
const RECRUITER_FOOTER_RX = /(?:reach out to|questions to|contact)\s+(?:[a-z\s]*?(?:hiring\s+manager|recruiter|HR\s+contact|talent\s+partner)\s*:\s*)?([A-ZÆØÅÄÖÜ][A-Za-zÆØÅÄÖÜæøåäöüß'-]+(?:\s+[A-ZÆØÅÄÖÜ][A-Za-zÆØÅÄÖÜæøåäöüß'-]+){0,3})/i;

// Detect known PDF-extraction garbage signal — repeating control
// chars, hex-like glyph fragments, or extreme low-vowel ratio.
function looksGarbled(text) {
  if (!text || text.length < 200) return false;
  const sample = text.slice(0, 4000);
  // Count printable Latin letters vs total non-whitespace
  let letters = 0, total = 0;
  for (const c of sample) {
    if (c === ' ' || c === '\n' || c === '\r' || c === '\t') continue;
    total++;
    if (/[A-Za-zÆØÅäöüéèà]/.test(c)) letters++;
  }
  if (total < 100) return false;
  // Real prose has ≥65% letters; garbled extraction often <40%.
  return (letters / total) < 0.45;
}

function findEmails(text) {
  if (!text) return [];
  const matches = text.match(EMAIL_RX) || [];
  // Dedupe + drop obvious noise (no@-only-tld, GitHub @-mentions
  // already excluded by the regex anchoring on a word boundary).
  return [...new Set(matches)];
}

function findLinkedIn(text) {
  if (!text) return null;
  const matches = text.match(LINKEDIN_RX) || [];
  return matches[0] || null;
}

function findFooterRecruiter(text) {
  // Only look at the bottom third — most JD footer recruiter blocks
  // sit there. Avoids matching body-text mentions of generic
  // "hiring managers" earlier in the JD.
  const tail = text.slice(Math.floor(text.length * 2 / 3));
  const m = tail.match(RECRUITER_FOOTER_RX);
  return m ? m[1].trim() : null;
}

// Export helpers for unit testing — production callers go through
// handleJDAnalysis.
export { findEmails, findLinkedIn, findFooterRecruiter, looksGarbled, recruiterPostProcess, normalize };

/**
 * Post-process the LLM's normalized output: fill in missing recruiter
 * fields from the raw JD text via the regex extractors above. Marks
 * each auto-detected value so the PWA can show provenance.
 */
function recruiterPostProcess(normalized, jdText) {
  const autoDetected = [];
  const emails = findEmails(jdText);
  const linkedin = findLinkedIn(jdText);
  const footerName = findFooterRecruiter(jdText);

  // Only resurrect the recruiter object if we have at least one
  // concrete signal (name OR email OR LinkedIn). Pure "hiring
  // manager: contact us" with no specifics still maps to null.
  const haveAnySignal = !!(footerName || emails.length || linkedin);
  if (!haveAnySignal) return normalized;

  // Initialize recruiter if LLM returned null.
  if (!normalized.recruiter) {
    normalized.recruiter = { name: null, title: null, email: null, linkedin: null, notes: null };
  }
  if (!normalized.recruiter.email && emails.length) {
    normalized.recruiter.email = emails[0];
    autoDetected.push('email');
  }
  if (!normalized.recruiter.linkedin && linkedin) {
    normalized.recruiter.linkedin = linkedin;
    autoDetected.push('linkedin');
  }
  if (!normalized.recruiter.name && footerName) {
    normalized.recruiter.name = footerName;
    autoDetected.push('name');
  }
  if (autoDetected.length) {
    normalized.recruiter.auto_detected_fields = autoDetected;
  }
  return normalized;
}

// Main handler. Wired up in index.js routing.
export async function handleJDAnalysis(request, env, getCORS, getServerKey) {
  const CORS = getCORS(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }),
      { status: 405, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
    { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } }); }

  const jdText = (body.jd_text || '').toString();
  const candidateSummary = (body.candidate_summary || '').toString();
  if (!jdText.trim() || jdText.length < 50) {
    return new Response(JSON.stringify({
      ok: false, error: 'jd_text is required and must be at least 50 characters',
      hint: 'Paste the full job description text.',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }
  // Cap inputs to avoid runaway prompts.
  const jd = jdText.slice(0, 30000);
  const cv = candidateSummary.slice(0, 15000);

  // Multi-provider cascade. Tries Anthropic first (strongest JSON
  // adherence), falls through to OpenAI, Mistral, Gemini in order
  // until one returns a parseable JSON body. Each provider gets the
  // SAME system + user prompt; the call layer adapts request format
  // per provider (Anthropic native, OpenAI/Mistral chat-completions
  // with system as messages[0], Gemini systemInstruction + parts).
  //
  // Without this cascade, an upstream 400 from Anthropic (model
  // overload, rare schema rejection, key throttling) would bubble
  // up as a hard failure — even when the Worker had keys for the
  // other three providers sitting right there.
  //
  // Caller can override the order via body.providers (array of
  // 'anthropic'|'openai'|'mistral'|'gemini') and per-provider model
  // via body.models = { anthropic: 'claude-...', ... }.
  const providerOrder = Array.isArray(body.providers) && body.providers.length
    ? body.providers.filter(p => typeof p === 'string')
    : undefined;  // undefined → module default
  const userPrompt = buildUserPrompt(jd, cv, new Date().toISOString().slice(0, 10));

  const t0 = Date.now();
  // v2.2 (cv-proxy): validator-aware cascade — see kernel-extraction.js for
  // the longer rationale. If a provider returns parseable-looking text that
  // isn't valid JSON (truncation, prose preamble that extractJSON can't
  // recover), fall through to the next provider rather than 502'ing.
  const cascade = await callAnyLLMForJSON(env, SYSTEM_PROMPT, userPrompt, {
    order: providerOrder,
    models: body.models || {},
    // RELAY-TUNE-COVERAGE-GAP-001: env.MODEL_ROLES.analysis, when set, leads the
    // cascade head (over the client's order) so the weekly cost-quality tune can
    // steer JD analysis; the full cascade stays as the fallback tail.
    role: 'analysis',
    validate: (text) => extractJSON(text) !== null,
  });
  const duration = Date.now() - t0;

  if (!cascade.ok) {
    // All providers failed. Surface the per-attempt log so the user
    // can see which providers were tried and why each failed.
    const lastErr = cascade.attempts.length
      ? cascade.attempts[cascade.attempts.length - 1]
      : null;
    const allValidationFailed = cascade.attempts.length > 0 &&
      cascade.attempts.every(a => a.status === 'validation-failed');
    return new Response(JSON.stringify({
      ok: false,
      error: allValidationFailed
        ? 'No provider returned parseable JSON'
        : 'All configured LLM providers failed',
      attempts: cascade.attempts,
      hint: lastErr && lastErr.status === 'no-key'
        ? 'No provider keys configured on cv-proxy. Set at least one of: Claude_API_Key, ChatGPT_API_Key, Mistral_API_Key, Gemini_API_Key as a Worker secret.'
        : allValidationFailed
          ? 'Every provider returned text that could not be parsed as JSON (likely truncation or prose preamble).'
          : 'Each configured provider returned an error. Check the attempts array for details.',
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const text = cascade.text;
  const parsed = extractJSON(text);
  if (!parsed) {
    // Defensive — unreachable when the validator already ran extractJSON.
    return new Response(JSON.stringify({
      ok: false,
      error: 'LLM response was not parseable JSON (defensive)',
      provider: cascade.provider,
      raw_preview: text.slice(0, 500),
      attempts: cascade.attempts,
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const normalized = normalize(parsed);

  // Regex post-processing safety net — fill recruiter fields from
  // the raw JD text if the LLM missed them (e.g. when the recruiter
  // info lives in a footer block that gets cut off in PDF extraction
  // or buried in garbled output). Only fires when there's a
  // concrete signal (real email, LinkedIn URL, or name pattern).
  recruiterPostProcess(normalized, jd);

  // Garbled-text detection — flag the diagnostic so the PWA can
  // tell the user their PDF extraction failed before trusting the
  // rest of the analysis. Added to red_flags so it surfaces in the
  // existing UI.
  const garbled = looksGarbled(jd);
  if (garbled && !normalized.red_flags.some(f => /garbl/i.test(f))) {
    normalized.red_flags.unshift(
      'JD text appears partially garbled — PDF extraction may have failed on some pages. Try pasting the JD text directly.'
    );
  }

  // Optional recruiter web-search enrichment.
  // Runs only when (a) the analysis surfaced a recruiter name and
  // (b) the user has not opted out via { search_recruiter: false }.
  // The actual search backend is in ./web-search.js — Brave Search
  // is the current default. If no search key is configured the
  // enrichment returns { available: false, reason: ... } and the
  // response is unaffected.
  let recruiterSearchInfo = null;
  if (
    normalized.recruiter &&
    normalized.recruiter.name &&
    body.search_recruiter !== false
  ) {
    try {
      const { searchRecruiter } = await import('./web-search.js');
      recruiterSearchInfo = await searchRecruiter(env, {
        name: normalized.recruiter.name,
        company: normalized.company?.name || null,
        title: normalized.recruiter.title || null,
        location: normalized.company?.location || null,
      });
      if (recruiterSearchInfo && recruiterSearchInfo.ok) {
        // Merge web_signals into the recruiter object.
        normalized.recruiter.web_signals = recruiterSearchInfo.web_signals;
        // If we found a LinkedIn URL via search and the JD didn't
        // provide one, fill it in.
        if (!normalized.recruiter.linkedin && recruiterSearchInfo.web_signals?.linkedin_url) {
          normalized.recruiter.linkedin = recruiterSearchInfo.web_signals.linkedin_url;
        }
      } else if (recruiterSearchInfo && !recruiterSearchInfo.ok) {
        normalized.recruiter.web_signals = {
          available: false,
          reason: recruiterSearchInfo.error || 'search failed',
        };
      }
    } catch (e) {
      // Never let recruiter search break the analysis response.
      normalized.recruiter.web_signals = {
        available: false,
        reason: 'search module error: ' + String(e && e.message || e),
      };
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    analysis: normalized,
    // Which provider actually answered. The PWA can show this in
    // the panel so the user knows whether Anthropic, OpenAI, or
    // another fallback handled the request.
    provider: cascade.provider,
    model: cascade.model,
    duration_ms: duration,
    usage: cascade.usage,
    // Per-attempt log so the user can see which providers were
    // tried and skipped (no key) or failed (with status + error).
    // Useful when the cascade had to fall through to e.g. Gemini.
    attempts: cascade.attempts,
    recruiter_search: recruiterSearchInfo ? {
      ok: recruiterSearchInfo.ok,
      backend: recruiterSearchInfo.backend || null,
      queries: recruiterSearchInfo.queries || [],
    } : null,
    // Diagnostic: echo back the first 400 and last 400 chars of the
    // JD text the analyzer actually saw. Lets the user immediately
    // diagnose PDF-extraction failures — if this looks like hex
    // soup, the extraction failed and re-uploading or pasting will
    // help more than tweaking the prompt.
    jd_text_diagnostic: {
      length: jd.length,
      garbled_detected: garbled,
      head: jd.slice(0, 400),
      tail: jd.length > 800 ? jd.slice(-400) : '',
    },
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}
