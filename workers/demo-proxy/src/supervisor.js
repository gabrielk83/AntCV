// Supervisor Agent — POST /api/supervisor/check
// =================================================================
// Validates an LLM-generated CV/CL section against the source CV and
// flags deviations: fabricated claims, banned phrases, placeholder
// content, language mismatch, format issues.
//
// Two-stage validation:
//   1. STATIC CHECKS (no LLM, fast) — empty/placeholder detection,
//      banned-phrase regex scan, language sniff, length sanity.
//   2. GROUNDING CHECK (one LLM call) — sends candidate_output and
//      source_cv to Anthropic, asks for a structured deviation list
//      with severities.
//
// If `auto_repair: true` is sent and the supervisor flags deviations,
// a second LLM call generates a repaired version using the deviations
// as guidance. Auto-repair is opt-in because it doubles latency.
//
// All checks log a deviation event to ANALYTICS KV for the analytics
// download endpoint and edit-tracking reports.
//
// Endpoint contract:
//
// POST /api/supervisor/check
// {
//   "task":              "cl_who_i_am" | "cv_profile" | ...,
//   "candidate_output":  "<LLM-generated text to validate>",
//   "source_cv":         "<the candidate's full CV text — ground truth>",
//   "jd_text":           "<optional job description for context>",
//   "auto_repair":       false   // optional
// }
//
// Response:
// {
//   "ok": true,
//   "passed": false,
//   "score": 62,
//   "scores": { grounding, format, tone, completeness },   // each 0-100
//   "deviations": [
//     { "type":"fabrication", "severity":"high",
//       "evidence":"...", "fix":"..." }
//   ],
//   "summary": "1-2 sentence overall assessment",
//   "repair_prompt": "...",        // null if score is high enough
//   "repaired_output": "..." | null, // populated if auto_repair: true
//   "analytics_event_id": "...",
//   "duration_ms": 1234
// }

import { extractJSON } from './jd-analysis.js';
import { callAnyLLMForText } from './multi-llm.js';  // v3.3.0: round-robin coverage

// ------------------------------------------------------------------
// Banned-words and banned-phrases for static scan. Kept in sync with
// prompt-augment.js — same constitution.
// ------------------------------------------------------------------
const BANNED_WORDS = [
  'spearhead', 'ensure', 'foster', 'streamline', 'strengthen',
  'empower', 'leverage', 'drive', 'deliver', 'enable',
  'robust', 'comprehensive', 'cutting-edge', 'state-of-the-art',
  'world-class', 'leading', 'impactful', 'rooted', 'grounded',
  'committed', 'passionate', 'holistic', 'multi-faceted',
  'cross-functional', 'collaborative', 'central', 'dynamic',
  'proactive', 'agile', 'journey', 'tværgående', 'tværfunktionel',
];
const BANNED_PHRASES = [
  'key role', 'pivotal role', 'end-to-end',
  'proven track record', 'strong communicator', 'strong leader',
  'results-driven', 'strategic mindset', 'client-focused',
  'customer-centric', 'mission-driven',
  'my expertise lies in', 'i am known for', 'at the heart of my work',
  'my approach is', 'i am passionate about', 'i thrive in',
  'i bring a wealth of experience', 'proven ability to',
  'i am committed to', 'passionate about driving',
  'known for fostering', 'i look forward to hearing from you',
];

// Placeholder patterns indicating empty/abandoned generation.
const PLACEHOLDER_PATTERNS = [
  /^\s*do\s+have\s*$/i,                  // the actual "do have" bug
  /^\s*(tbd|todo|\.\.\.)\s*$/i,
  /^\s*\[[^\]]+\]\s*$/,                  // bare [placeholder]
  /^\s*placeholder\s*$/i,
  /^\s*coming\s+soon\s*$/i,
  /lorem\s+ipsum/i,
  /^\s*\.\s*$/,                          // single dot
];

// Word-boundary regex with case-insensitive match for banned words.
// For BANNED_WORDS (single tokens) a combined alternation regex is
// efficient and correct. For BANNED_PHRASES we scan each phrase
// independently because phrases can OVERLAP — e.g. "I am passionate
// about driving X" contains BOTH "i am passionate about" AND
// "passionate about driving", and a single combined regex with
// global flag consumes the leftmost match and skips the overlapping
// one. Per-phrase scan reports both.
function makeBannedWordsScanner(list) {
  const sorted = [...list].sort((a, b) => b.length - a.length);
  const escaped = sorted.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const BANNED_WORDS_RE = makeBannedWordsScanner(BANNED_WORDS);

function scanBannedPhrases(text) {
  const hits = new Set();
  for (const phrase of BANNED_PHRASES) {
    // Per-phrase regex, NO `g` flag — we only need to know if the
    // phrase appears at all. Case-insensitive, word-boundary.
    const re = new RegExp(`\\b${escapeRe(phrase)}\\b`, 'i');
    if (re.test(text)) hits.add(phrase.toLowerCase());
  }
  return hits;
}

// ------------------------------------------------------------------
// Static checks — run first, cheap, can short-circuit on obvious fail.
// Returns { deviations: [], scores: { ... }, summary } partial result.
// ------------------------------------------------------------------
function runStaticChecks(candidateOutput, task) {
  const text = (candidateOutput || '').trim();
  const deviations = [];
  let completenessScore = 100;
  let toneScore = 100;
  let formatScore = 100;

  // Empty / placeholder check
  if (text.length < 20) {
    deviations.push({
      type: 'placeholder',
      severity: 'high',
      evidence: `Output is only ${text.length} characters: "${text}"`,
      fix: 'Generate substantive content. Empty or near-empty output is unacceptable.',
    });
    completenessScore = 0;
  } else {
    for (const re of PLACEHOLDER_PATTERNS) {
      if (re.test(text)) {
        deviations.push({
          type: 'placeholder',
          severity: 'high',
          evidence: `Output matches placeholder pattern: "${text.slice(0, 60)}"`,
          fix: 'Replace placeholder with real content grounded in source.',
        });
        completenessScore = Math.min(completenessScore, 10);
        break;
      }
    }
  }

  // Banned phrases scan — phrases first (longer, more specific).
  // Per-phrase scan so overlapping phrases all fire (e.g. both
  // "i am passionate about" and "passionate about driving" are
  // surfaced from "I am passionate about driving X").
  const phraseHits = scanBannedPhrases(text);
  for (const hit of phraseHits) {
    deviations.push({
      type: 'banned_phrase',
      severity: 'medium',
      evidence: `Banned phrase used: "${hit}"`,
      fix: `Remove "${hit}" or rewrite without it. Prefer concrete, specific language.`,
    });
    toneScore -= 12;
  }

  // Banned words scan
  const wordHits = new Set();
  let m;
  BANNED_WORDS_RE.lastIndex = 0;
  while ((m = BANNED_WORDS_RE.exec(text)) !== null) {
    // Skip if this word is part of a phrase we already flagged.
    // E.g. "drive" inside "results-driven" → already flagged as phrase.
    const lo = m[1].toLowerCase();
    let inPhrase = false;
    for (const ph of phraseHits) {
      if (ph.includes(lo)) { inPhrase = true; break; }
    }
    if (!inPhrase) wordHits.add(lo);
  }
  for (const hit of wordHits) {
    deviations.push({
      type: 'banned_phrase',
      severity: 'low',
      evidence: `Banned word used: "${hit}"`,
      fix: `Replace "${hit}" with a more concrete verb or noun.`,
    });
    toneScore -= 5;
  }
  toneScore = Math.max(0, toneScore);

  // Format heuristics per task
  if (task === 'cv_outcomes' || task === 'cl_how_i_would_contribute') {
    // Should be a list, count bullet markers or line breaks
    const items = (text.match(/(?:^|\n)\s*[-•▪*]\s+/g) || []).length;
    const lineItems = text.split(/\r?\n/).filter(l => l.trim().length > 0).length;
    const itemCount = Math.max(items, lineItems);
    if (itemCount < 3) {
      deviations.push({
        type: 'format',
        severity: 'high',
        evidence: `Only ${itemCount} item(s) detected in a list-format section`,
        fix: `Produce at least 3 items. Target 5-6 for ${task}.`,
      });
      formatScore -= 40;
    }
  }
  if (task === 'cv_profile' || task === 'cl_who_i_am') {
    const sentences = text.split(/[.!?](?:\s|$)/).filter(s => s.trim().length > 5).length;
    if (sentences < 2) {
      deviations.push({
        type: 'format',
        severity: 'medium',
        evidence: `Only ${sentences} sentence(s) detected`,
        fix: 'Produce 2-3 substantive sentences.',
      });
      formatScore -= 30;
    }
    if (sentences > 6) {
      deviations.push({
        type: 'format',
        severity: 'low',
        evidence: `${sentences} sentences — too long for a profile/who-i-am block`,
        fix: 'Tighten to 2-3 sentences plus optional work-style closer.',
      });
      formatScore -= 10;
    }
  }
  formatScore = Math.max(0, formatScore);

  return {
    deviations,
    scores: {
      completeness: completenessScore,
      tone: toneScore,
      format: formatScore,
    },
  };
}

// ------------------------------------------------------------------
// Grounding check via LLM. Sends candidate_output + source_cv to
// Anthropic and asks for a structured deviation list focusing on
// fabricated claims.
// ------------------------------------------------------------------
const GROUNDING_SYSTEM = `You are a fact-checking supervisor for CV/cover-letter generation. Your sole job is to identify claims in the candidate_output that are NOT present in the source_cv.

You will receive:
- task: the section type
- candidate_output: the LLM-generated text to fact-check
- source_cv: the candidate's actual CV (ground truth)
- jd_text: optional job description for context

Return ONLY valid JSON matching this schema. No prose. No markdown fences.

{
  "grounding_score": 0-100,
  "fabrications": [
    {
      "claim": "exact phrase from candidate_output",
      "evidence_in_source": "what the source actually says (or null if nothing related)",
      "severity": "low" | "medium" | "high",
      "fix": "what to do — either remove, rephrase using source vocabulary, or omit topic"
    }
  ],
  "summary": "1-2 sentence overall fact-check assessment"
}

CRITICAL — what counts as fabrication:

1. DOMAIN LEAKAGE — candidate_output uses a domain/technology word that doesn't appear in source_cv (even if a related domain does).
   Example: candidate_output says "radar/sonar experience" / source_cv has only "LiDAR/electro-optics" → severity HIGH
   Example: candidate_output says "marine systems" / source_cv has only "automotive systems" → severity HIGH

2. ELIGIBILITY / CLEARANCE / CITIZENSHIP CLAIMS — candidate_output asserts a legal status (clearance eligibility, security clearance, citizenship, work permit, residency) that source_cv does NOT explicitly state.
   Example: candidate_output says "eligible for FE clearance" / source_cv has no FE/clearance information → severity HIGH
   Example: candidate_output says "NATO secret cleared" / source_cv has no clearance info → severity HIGH
   Example: candidate_output says "EU citizen" / source_cv confirms EU citizenship → NOT a fabrication

3. CERTIFICATION / DEGREE CLAIMS — candidate_output names a certification or degree not in source_cv.

4. EMPLOYER / ROLE CLAIMS — candidate_output names an employer, project, or role not in source_cv.

5. METRIC FABRICATION — candidate_output gives a specific number (years, count, percentage) not in source_cv.

What is NOT fabrication:
- Rephrasing facts in source using different words
- Inferring scope from facts ("worked across 3 companies" when source lists 3 companies)
- General competency descriptions that follow from listed experience
- Tone/phrasing differences

Grounding score guide:
- 95-100: every claim traceable to source
- 80-94: 1-2 minor rephrasings, no factual fabrications
- 60-79: 1 medium fabrication or several minor stretches
- 30-59: high-severity fabrication (clearance/domain/employer)
- 0-29: multiple high-severity fabrications

If candidate_output is empty or near-empty, grounding_score = 100, fabrications = [], summary = "Output too short to evaluate factual content."

Output ONLY the JSON object.`;

async function runGroundingCheck(env, { task, candidate_output, source_cv, jd_text }) {
  // v3.3.0: removed the Anthropic-key early-return — the cascade
  // discovers available keys per provider. If none are configured,
  // callAnyLLMForText returns { ok: false, attempts: [no-key, ...] }
  // and we forward that.

  // Trim oversized inputs to keep token use reasonable.
  const cv = (source_cv || '').slice(0, 20000);
  const out = (candidate_output || '').slice(0, 10000);
  const jd = (jd_text || '').slice(0, 10000);

  const userPrompt = [
    `task: ${task || 'unknown'}`,
    '',
    'candidate_output:',
    '---',
    out,
    '---',
    '',
    'source_cv:',
    '---',
    cv,
    '---',
    jd ? '\njd_text (context only — does NOT ground claims):\n---\n' + jd + '\n---' : '',
  ].filter(Boolean).join('\n');

  // v3.3.0 round-robin coverage: was a direct fetch to Anthropic. If
  // Anthropic was throttled or down, the supervisor failed hard with
  // no fallback. Now uses the full provider cascade.
  const cascade = await callAnyLLMForText(env, GROUNDING_SYSTEM, userPrompt, {
    models: { anthropic: 'claude-sonnet-5' },   // SONNET-5-DROP-IN-001 (2026-07)
    // GEN-MODELROLE-001: grounding is a mechanical CHECK — when
    // env.MODEL_ROLES names a supervisor provider, it leads the cascade.
    role: 'supervisor',
  });
  if (!cascade.ok) {
    return {
      ok: false,
      error: 'Grounding LLM cascade failed (all providers)',
      attempts: cascade.attempts,
    };
  }
  const text = cascade.text || '';
  const parsed = extractJSON(text);
  if (!parsed) {
    return {
      ok: false,
      error: 'Grounding response was not parseable JSON',
      raw_preview: text.slice(0, 400),
      provider: cascade.provider,
    };
  }
  return {
    ok: true,
    grounding_score: clamp(parsed.grounding_score, 0, 100, 100),
    fabrications: Array.isArray(parsed.fabrications) ? parsed.fabrications : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    usage: cascade.usage || null,
    provider: cascade.provider,
  };
}

function clamp(v, lo, hi, def) {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.max(lo, Math.min(hi, n));
}

// ------------------------------------------------------------------
// Aggregate static + grounding into final scores and deviation list.
// ------------------------------------------------------------------
function aggregate(staticResult, groundingResult) {
  const deviations = [...staticResult.deviations];

  // Add grounding fabrications as deviations
  const fabs = (groundingResult && groundingResult.ok) ? (groundingResult.fabrications || []) : [];
  for (const f of fabs) {
    deviations.push({
      type: 'fabrication',
      severity: f.severity || 'medium',
      evidence: f.evidence_in_source
        ? `Claim: "${f.claim}" / source has: "${f.evidence_in_source}"`
        : `Claim: "${f.claim}" / not in source`,
      fix: f.fix || 'Remove or rephrase using source vocabulary.',
    });
  }

  const grounding = (groundingResult && groundingResult.ok)
    ? groundingResult.grounding_score
    : 100; // if grounding check failed/skipped, neutral pass-through

  const scores = {
    grounding,
    format: staticResult.scores.format,
    tone: staticResult.scores.tone,
    completeness: staticResult.scores.completeness,
  };

  // Overall score — weighted average. Grounding weighted highest
  // because fabrication is the worst failure mode.
  const overall = Math.round(
    scores.grounding * 0.45 +
    scores.completeness * 0.25 +
    scores.format * 0.20 +
    scores.tone * 0.10
  );

  // High-severity deviation forces fail regardless of weighted score.
  const hasHighSeverity = deviations.some(d => d.severity === 'high');
  const passed = overall >= 80 && !hasHighSeverity;

  return { score: overall, scores, deviations, passed };
}

// ------------------------------------------------------------------
// Repair prompt — used by the PWA to ask the LLM for a corrected
// version. If auto_repair: true, supervisor.js runs this itself.
// ------------------------------------------------------------------
function buildRepairPrompt(task, candidateOutput, deviations, summary) {
  const issues = deviations
    .map((d, i) => `${i + 1}. [${d.severity}] ${d.type}: ${d.evidence}\n   → Fix: ${d.fix}`)
    .join('\n');

  return [
    `You produced this text for task "${task}":`,
    '',
    '---',
    candidateOutput,
    '---',
    '',
    'A supervisor review identified these issues:',
    '',
    issues,
    '',
    summary ? `Supervisor summary: ${summary}` : '',
    '',
    'Produce a CORRECTED version that fixes every issue above. Keep what is correct; revise only what is flagged. Do NOT introduce new fabrications. Do NOT use any banned words or phrases. Return only the corrected text — no preamble.',
  ].filter(Boolean).join('\n');
}

async function runAutoRepair(env, { task, candidate_output, source_cv, repairPrompt }) {
  // v3.3.0: removed the Anthropic-key early-return — cascade handles it.

  // Repair system prompt mirrors prompt-augment.js's no-fabrication
  // block so the repair doesn't introduce new hallucinations.
  const system = `You are revising a CV/CL section to fix supervisor-flagged issues. Make ONLY the changes needed to address the issues. Do not rewrite sections that weren't flagged. Critically: never introduce new claims that aren't in the source_cv. If an issue is a fabrication, REMOVE the fabricated claim — do not replace it with a different fabrication.

Source CV (ground truth for all claims):
---
${(source_cv || '').slice(0, 20000)}
---

Output ONLY the corrected text. No preamble, no explanation.`;

  // v3.3.0 round-robin coverage: was a direct fetch. Now cascades.
  // GEN-MODELROLE-001: repair RE-WRITES prose, so it stays on the WRITER
  // role (owner-design recommendation: rewrites never drop to the cheaper
  // supervisor model — different blind spots are for checks, not prose).
  const cascade = await callAnyLLMForText(env, system, repairPrompt, {
    models: { anthropic: 'claude-sonnet-5' },   // SONNET-5-DROP-IN-001 (2026-07)
    role: 'writer',
  });
  if (!cascade.ok) {
    return { ok: false, error: 'Repair LLM cascade failed (all providers)', attempts: cascade.attempts };
  }
  return {
    ok: true,
    repaired_output: (cascade.text || '').trim(),
    usage: cascade.usage || null,
    provider: cascade.provider,
  };
}

async function getAnthropicKey(env) {
  // Match the helper used in index.js
  const candidates = ['Claude_API_Key', 'ANTHROPIC_API_KEY', 'CLAUDE_API_KEY', 'Anthropic_API_Key'];
  for (const name of candidates) {
    const v = env[name];
    if (typeof v === 'string' && v.startsWith('sk-ant-')) return v;
  }
  return null;
}

// ------------------------------------------------------------------
// Analytics logging — persists the deviation event for later
// querying via /api/analytics/* endpoints.
// ------------------------------------------------------------------
async function logEvent(env, event) {
  if (!env || !env.ANALYTICS) return null;   // analytics binding optional
  const id = 'sup_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  const key = `supervisor:${id}`;
  try {
    await env.ANALYTICS.put(key, JSON.stringify({
      kind: 'supervisor_check',
      id,
      ts: new Date().toISOString(),
      ...event,
    }), { expirationTtl: 60 * 60 * 24 * 90 }); // 90 days
    return id;
  } catch (e) {
    console.warn('[supervisor] analytics put failed:', e && e.message);
    return null;
  }
}

// ------------------------------------------------------------------
// Main handler.
// ------------------------------------------------------------------
export async function handleSupervisorCheck(request, env, getCORS) {
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

  const task = (body.task || '').toString();
  const candidate = (body.candidate_output || '').toString();
  const source = (body.source_cv || '').toString();
  const jd = (body.jd_text || '').toString();
  const autoRepair = body.auto_repair === true;

  if (!candidate) {
    return new Response(JSON.stringify({ ok: false, error: 'candidate_output is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json', ...CORS } });
  }

  const t0 = Date.now();

  // Stage 1 — static checks (fast)
  const staticResult = runStaticChecks(candidate, task);

  // Stage 2 — grounding check (LLM), only if static checks didn't
  // already give a "high-severity placeholder" verdict (no point
  // grounding-checking a near-empty output).
  let groundingResult = null;
  const placeholderHigh = staticResult.deviations.some(d => d.type === 'placeholder' && d.severity === 'high');
  if (!placeholderHigh && source) {
    groundingResult = await runGroundingCheck(env, {
      task, candidate_output: candidate, source_cv: source, jd_text: jd,
    });
  }

  // Aggregate
  const agg = aggregate(staticResult, groundingResult);

  const summary = (groundingResult && groundingResult.ok && groundingResult.summary)
    ? groundingResult.summary
    : (agg.passed
      ? 'Output passes supervisor review.'
      : `Output flagged with ${agg.deviations.length} deviation(s). Highest severity: ${agg.deviations.map(d => d.severity).includes('high') ? 'high' : agg.deviations.map(d => d.severity).includes('medium') ? 'medium' : 'low'}.`);

  // Repair prompt (always returned; PWA decides whether to use it)
  const repairPrompt = (agg.deviations.length > 0)
    ? buildRepairPrompt(task, candidate, agg.deviations, summary)
    : null;

  // Optional auto-repair
  let repairedOutput = null;
  if (autoRepair && repairPrompt) {
    const rep = await runAutoRepair(env, {
      task, candidate_output: candidate, source_cv: source, repairPrompt,
    });
    if (rep.ok) repairedOutput = rep.repaired_output;
  }

  // Log event
  const eventId = await logEvent(env, {
    task, score: agg.score, scores: agg.scores,
    deviation_count: agg.deviations.length,
    passed: agg.passed,
    auto_repair_attempted: autoRepair,
    auto_repair_succeeded: !!repairedOutput,
    candidate_length: candidate.length,
    source_length: source.length,
  });

  const duration = Date.now() - t0;
  return new Response(JSON.stringify({
    ok: true,
    passed: agg.passed,
    score: agg.score,
    scores: agg.scores,
    deviations: agg.deviations,
    summary,
    repair_prompt: repairPrompt,
    repaired_output: repairedOutput,
    analytics_event_id: eventId,
    duration_ms: duration,
    grounding_skipped_reason: placeholderHigh ? 'placeholder_output' : (!source ? 'no_source_cv' : null),
  }), { status: 200, headers: { 'Content-Type': 'application/json', ...CORS } });
}

// Re-export the static checks for direct use in tests.
export { runStaticChecks, buildRepairPrompt };
