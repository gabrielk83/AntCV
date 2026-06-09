// gen-coherence.js — cross-section coherence pass (GEN-BACKGROUND-001, Option A)
// =============================================================================
//
// The job's coherence phase (see gen-job.js) needs a `coherenceFn(env, payload)` that
// looks at EVERY generated section together — something the legacy per-section supervisor
// could never do — and reports cross-section problems:
//
//   - repetition   : the same achievement/phrasing appears in more than one section
//                    (e.g. the same LiDAR change-control win in PROFILE *and* OUTCOMES
//                    *and* EXPERIENCE, in near-identical words).
//   - contradiction: two sections disagree (a CV claim vs a CL claim; a number/scope/title
//                    stated one way in one section and differently in another).
//   - redundancy   : a section restates something already fully covered elsewhere, adding
//                    no new signal.
//
// It returns structured findings keyed to section IDs. gen-job.js then repairs the flagged
// sections by RE-RUNNING them through the normal augmented per-section path (so banned
// words/phrases, length budgets, language, and no-fabrication rules are all still enforced
// on the repair). We deliberately return findings (not rewrites) so the actual rewrite goes
// back through that enforced path rather than trusting the coherence model's raw text.
//
// SAFETY: this NEVER throws to the caller in a way that loses the run. On any failure it
// returns { ok:false, error }, and gen-job.js treats that as "skip coherence, finish the
// job". Coherence is a refinement, never a gate.
//
// REUSE: calls the existing multi-llm cascade (callAnyLLMForJSON), which already handles
// provider fallback, keys, and a `validate` callback. PARITY: a byte-identical copy lives
// in workers/demo-proxy/src.

import { callAnyLLMForJSON } from './multi-llm.js';

const COHERENCE_SYSTEM = `You are a coherence reviewer for a CV + cover letter that was generated section by section. Each section was written independently, so your ONLY job is to find problems that span MORE THAN ONE section. You do NOT rewrite anything. You do NOT judge a single section in isolation (a separate per-section check already did that). You report cross-section issues as structured JSON.

You will receive a list of sections, each with: id, title, text. (A CV and a cover letter are both represented as sections.)

Find three kinds of cross-section problem:

1. "repetition" — the SAME concrete achievement, project, metric, or distinctive phrasing appears in two or more sections in a way that reads as copy-paste. Reusing a fact is fine; restating it in near-identical words is the problem. Identify which section should KEEP it (usually the most specific one — e.g. SELECTED OUTCOMES or EXPERIENCE) and which should drop or generalise it.

2. "contradiction" — two sections state facts that cannot both be true: different numbers (years, team size, percentages), different titles/employers/dates, or a claim in one section that the other contradicts. Cover letter vs CV contradictions count.

3. "redundancy" — a section adds nothing new because everything in it is already fully said elsewhere (weaker than repetition; whole-block overlap).

Rules:
- Only report issues that involve TWO OR MORE named sections. If something is wrong within a single section, ignore it.
- Be specific: quote or closely paraphrase the overlapping/contradicting text.
- For each finding, name EVERY section id involved, and give a concrete fix that says which section changes and how (keep X in section A; generalise/remove it from section B).
- Do NOT invent facts. Do NOT suggest adding new claims. Fixes only remove, generalise, or reconcile existing text.
- If the sections are already coherent, return an empty findings array. Do not manufacture issues.

Return ONLY valid JSON, no prose, no markdown fences:
{
  "findings": [
    {
      "kind": "repetition" | "contradiction" | "redundancy",
      "sections": ["sectionId", "sectionId", ...],
      "detail": "what overlaps/contradicts, specifically",
      "fix": "which section changes and how (remove/generalise/reconcile — never add new claims)"
    }
  ],
  "summary": "one sentence: coherent, or N issues found"
}`;

const VALID_KINDS = new Set(['repetition', 'contradiction', 'redundancy']);

function stripFences(text) {
  let t = String(text || '').trim();
  // remove ```json ... ``` or ``` ... ``` fences if a model added them
  if (t.startsWith('```')) {
    t = t.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
  }
  return t;
}

// Parse + shape-check the model's JSON. Returns { findings, summary } or null if unusable.
function parseReview(rawText, validSectionIds) {
  let obj;
  try { obj = JSON.parse(stripFences(rawText)); } catch (_) { return null; }
  if (!obj || typeof obj !== 'object') return null;
  const out = { findings: [], summary: typeof obj.summary === 'string' ? obj.summary : null };
  const arr = Array.isArray(obj.findings) ? obj.findings : [];
  for (const f of arr) {
    if (!f || typeof f !== 'object') continue;
    if (!VALID_KINDS.has(f.kind)) continue;
    const ids = Array.isArray(f.sections)
      ? f.sections.filter(id => validSectionIds.has(id))
      : [];
    // cross-section only: must reference at least two KNOWN sections
    if (ids.length < 2) continue;
    const detail = typeof f.detail === 'string' ? f.detail.slice(0, 600) : '';
    const fix = typeof f.fix === 'string' ? f.fix.slice(0, 600) : '';
    if (!detail && !fix) continue;
    out.findings.push({ kind: f.kind, sections: Array.from(new Set(ids)), detail, fix });
  }
  return out;
}

// coherenceFn(env, payload) — the function gen-job.js calls.
// payload = { sections:[{id,title,text}], source_cv, jd_text, meta }
// returns { ok, findings, summary, usage } | { ok:false, error }
export async function runCoherenceReview(env, payload) {
  const sections = Array.isArray(payload && payload.sections) ? payload.sections : [];
  if (sections.length < 2) {
    // Nothing to compare across — trivially coherent.
    return { ok: true, findings: [], summary: 'single section — no cross-section review needed', usage: null };
  }

  const validIds = new Set(sections.map(s => s.id));

  // Build a compact, ID-labelled view of every section for the model.
  const sectionBlock = sections.map(s =>
    `### section id: ${s.id}  (title: ${s.title || s.id})\n${(s.text || '').slice(0, 4000)}`
  ).join('\n\n');

  const userPrompt =
    'Review these sections for CROSS-SECTION problems only (repetition, contradiction, redundancy). ' +
    'Return the JSON described in the system prompt.\n\n' + sectionBlock;

  let cascade;
  try {
    cascade = await callAnyLLMForJSON(env, COHERENCE_SYSTEM, userPrompt, {
      models: { anthropic: 'claude-sonnet-4-20250514' },
      validate: (text) => {
        const parsed = parseReview(text, validIds);
        return !!parsed; // reject providers that didn't return shape-valid JSON
      },
    });
  } catch (e) {
    return { ok: false, error: 'coherence_cascade_threw: ' + (e && e.message ? e.message : String(e)) };
  }

  if (!cascade || !cascade.ok) {
    return { ok: false, error: (cascade && cascade.error) || 'coherence cascade failed (all providers)' };
  }

  const parsed = parseReview(cascade.text, validIds);
  if (!parsed) {
    // validate() should have caught this, but double-guard.
    return { ok: false, error: 'coherence response not parseable' };
  }

  return {
    ok: true,
    findings: parsed.findings,
    summary: parsed.summary || (parsed.findings.length ? `${parsed.findings.length} cross-section issue(s) found` : 'sections coherent'),
    usage: cascade.usage || null,
    provider: cascade.provider || null,
    // NOTE: intentionally no `rewrites` — gen-job.js re-runs flagged sections through the
    // augmented per-section path so banned-words/length/language/no-fabrication are enforced.
  };
}

// Export the parser for tests.
export { parseReview };
