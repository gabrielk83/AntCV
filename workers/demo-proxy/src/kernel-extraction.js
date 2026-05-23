// AntCV — kernel extraction
// =====================================================================
// Single LLM call: takes one or more uploaded-file text extracts and
// returns a structured profile (identity, work_history, education,
// publications, certifications, language_skills, tone_hints,
// work_style_hints) plus advisory metadata for the UI.
//
// Brief reference: /api/profile/extract-kernel (items 4 + 6).
//
// Wired into cv-proxy at POST /api/extract-kernel. The PWA does NOT call
// this directly — the relay's POST /api/profile/extract-kernel proxies
// here so auth (Cloudflare Access JWT) is enforced before any LLM call.
//
// Confidence scoring (item 6): the LLM tags each extracted item with
// support/specificity/corroboration. Items where support=1 AND
// (specificity=generic OR corroboration=weak) get listed in
// _low_confidence as an advisory hint. The main fields STILL contain
// these items — the UI uses _low_confidence to render an
// accept/reject chip-cloud preview.

import { callAnyLLMForJSON } from './multi-llm.js';

const SYSTEM_PROMPT = `You will be given one or more documents that may contain information about a job candidate. Extract a structured profile.

Your output MUST be valid JSON matching this exact schema. No prose before or after. No markdown code fences. JSON only.

{
  "identity": {
    "name":        string|null,
    "email":       string|null,
    "phone":       string|null,
    "linkedin":    string|null,
    "github":      string|null,
    "location":    string|null,
    "citizenship": string|null
  },
  "work_history": [
    { "role": string, "company": string, "years": string, "raw_bullets": string[] }
  ],
  "education": [
    { "degree": string, "institution": string, "year": string, "grade": string|null, "honors": string|null }
  ],
  "publications": [
    { "title": string, "authors": string, "venue": string, "year": string }
  ],
  "certifications": string[],
  "language_skills": [
    { "language": string, "level": string }
  ],
  "tone_hints":       "scandinavian"|"american"|"british"|"indian"|"chinese"|"hybrid"|"academic_research"|null,
  "work_style_hints": string,

  "_low_confidence": [
    { "field": string, "value": string, "reason": string, "support": number, "specificity": "generic"|"concrete", "corroboration": "agrees"|"weak" }
  ],
  "_conflicts": [
    { "field": string, "candidates": string[], "chose": string, "reason": string }
  ],
  "_identity_mismatch": boolean
}

RULES (HARD):
- Use exact wording from documents for work_history[*].raw_bullets — do NOT paraphrase or rewrite.
- If a field is not in any document, omit it (or set null for nullable scalars, [] for arrays). Do NOT invent.
- Quoted titles of publications stay verbatim.
- Years and dates as written in the source. No reformatting.
- Subject identity: extract about the FIRST person matching the user's expected name if provided, otherwise the most prominently mentioned candidate. Set _identity_mismatch=true if the documents seem to describe multiple distinct people and you cannot disambiguate.

CONFIDENCE SCORING:
For each extracted field, internally compute three signals:
  - support:        number of source documents mentioning this item (1, 2, 3+)
  - specificity:    "generic" if it's just adjectives like "collaborative" or "results-driven"; "concrete" if it cites a named system, a measurable result, or a dated event
  - corroboration:  "agrees" if multiple sources align; "weak" if a single source or sources conflict

Flag any item satisfying (support=1 AND (specificity=generic OR corroboration=weak)) by adding an entry to _low_confidence. The main extracted fields STILL include these items — _low_confidence is purely advisory for the UI to render a chip-cloud accept/reject preview.

CONFLICTS:
If the same field has different values across documents (e.g. two job titles for the same company-and-years), list the candidates in _conflicts and explain which one you chose and why.

Output ONLY the JSON object. Begin your response with { and end with }.`;

function buildUserPrompt(texts, expectedName) {
  const parts = [];
  if (expectedName && expectedName.trim()) {
    parts.push(`EXPECTED CANDIDATE NAME: ${expectedName.trim()}`);
    parts.push('Use this to anchor identity extraction. If the documents describe a different person, set _identity_mismatch=true.');
    parts.push('');
  }
  parts.push('DOCUMENTS:');
  texts.forEach((t, i) => {
    const fname = (t && t.filename) ? String(t.filename) : `file_${i + 1}`;
    const content = (t && t.content) ? String(t.content) : '';
    parts.push(`---`);
    parts.push(`FILE ${i + 1} (${fname}):`);
    parts.push(content);
  });
  parts.push(`---`);
  return parts.join('\n');
}

// Lenient JSON extraction — same approach as jd-analysis.js. The
// system prompt asks for pure JSON, but if the model wraps it in code
// fences or adds a stray preface we recover gracefully.
function extractJSON(text) {
  if (!text || typeof text !== 'string') return null;
  let s = text.trim();
  // Strip markdown fences.
  const fenced = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) s = fenced[1].trim();
  // Find the first '{' and last '}'.
  const i0 = s.indexOf('{');
  const i1 = s.lastIndexOf('}');
  if (i0 < 0 || i1 < 0 || i1 < i0) return null;
  const candidate = s.slice(i0, i1 + 1);
  try { return JSON.parse(candidate); } catch (_) { return null; }
}

// Defensive shaping — make sure the response always has the expected
// shape even if the model omitted optional fields.
function normalize(parsed) {
  const out = parsed && typeof parsed === 'object' ? { ...parsed } : {};
  out.identity        = (out.identity && typeof out.identity === 'object') ? out.identity : {};
  out.work_history    = Array.isArray(out.work_history)    ? out.work_history    : [];
  out.education       = Array.isArray(out.education)       ? out.education       : [];
  out.publications    = Array.isArray(out.publications)    ? out.publications    : [];
  out.certifications  = Array.isArray(out.certifications)  ? out.certifications  : [];
  out.language_skills = Array.isArray(out.language_skills) ? out.language_skills : [];
  out.tone_hints        = out.tone_hints        ?? null;
  out.work_style_hints  = (typeof out.work_style_hints === 'string') ? out.work_style_hints : '';
  out._low_confidence   = Array.isArray(out._low_confidence)   ? out._low_confidence   : [];
  out._conflicts        = Array.isArray(out._conflicts)        ? out._conflicts        : [];
  out._identity_mismatch = out._identity_mismatch === true;
  return out;
}

export async function handleKernelExtraction(request, env, getCORS) {
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

  const texts = Array.isArray(body.texts) ? body.texts : [];
  if (texts.length === 0) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'texts is required',
      hint: 'POST {"texts":[{"filename":"cv.pdf","content":"..."},...],"expected_name":"Optional anchor"}',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  // Cap each document to avoid runaway prompts. With 4 files at 25k chars each,
  // total prompt is ~100k characters — well under any provider's limit.
  const CAP = 25000;
  const capped = texts
    .map(t => ({
      filename: (t && t.filename) ? String(t.filename).slice(0, 200) : '',
      content:  (t && t.content)  ? String(t.content).slice(0, CAP)  : '',
    }))
    .filter(t => t.content.length > 0)
    .slice(0, 8); // Sanity cap on number of files

  if (capped.length === 0) {
    return new Response(JSON.stringify({
      ok: false, error: 'All provided texts were empty',
    }), { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const expectedName = (body.expected_name || '').toString().slice(0, 200);

  const providerOrder = Array.isArray(body.providers) && body.providers.length
    ? body.providers.filter(p => typeof p === 'string')
    : undefined;
  const userPrompt = buildUserPrompt(capped, expectedName);

  const t0 = Date.now();
  // v2.2 (v1.40.47): pass a validator so a provider returning truncated
  // or unparseable JSON falls through to the next provider in the cascade
  // instead of terminating with a 502. Previously Anthropic could return
  // 200 with a hard-truncated JSON body (max_tokens cap, since bumped),
  // and the cascade would treat that as success — never trying OpenAI /
  // Mistral / Gemini. The validator runs extractJSON eagerly so we get
  // a definitive yes/no on parseability before committing the result.
  const cascade = await callAnyLLMForJSON(env, SYSTEM_PROMPT, userPrompt, {
    order: providerOrder,
    models: body.models || {},
    validate: (text) => extractJSON(text) !== null,
  });
  const duration = Date.now() - t0;

  if (!cascade.ok) {
    const lastErr = cascade.attempts.length ? cascade.attempts[cascade.attempts.length - 1] : null;
    // Surface a clearer hint when every provider returned a parseable-JSON
    // failure (vs every provider being unreachable). The validation-failed
    // status is set by callAnyLLMForJSON when the validator returns false.
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
          ? 'Every provider returned text that could not be parsed as JSON (likely truncation or prose preamble). The raw_preview field of each attempt shows the first 200 chars.'
          : 'Each configured provider returned an error. Check the attempts array for details.',
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const text = cascade.text;
  const parsed = extractJSON(text);
  if (!parsed) {
    // Defensive — should be unreachable because the validator above already
    // ran extractJSON. Kept so any future drift in the cascade contract
    // surfaces a clean 502 instead of a runtime throw on `normalize(null)`.
    return new Response(JSON.stringify({
      ok: false,
      error: 'LLM response was not parseable JSON (defensive)',
      provider: cascade.provider,
      raw_preview: text.slice(0, 500),
      attempts: cascade.attempts,
    }), { status: 502, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const normalized = normalize(parsed);
  return new Response(JSON.stringify({
    ok: true,
    kernel: normalized,
    provider: cascade.provider,
    duration_ms: duration,
    attempts: cascade.attempts,
    files: capped.map(t => ({ filename: t.filename, chars: t.content.length })),
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}
