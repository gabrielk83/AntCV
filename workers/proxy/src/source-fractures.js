// source-fractures.js — SOURCE-FRACTURES-001 (owner 2026-10-23)
// =============================================================================
//
// Several agents touch one generation: the WRITER drafts a section, the
// SUPERVISOR grounds it, the COHERENCE reviewer reads every section together,
// and the auto-repair writer fixes what was flagged. Until now every one of them
// read the SAME prose source in the SAME order. A hallucination the writer took
// from that prose (a number read off a neighbouring line, a JD figure mistaken
// for a candidate fact) looked just as plausible to the checker, because the
// checker was primed by the same text in the same place.
//
// This module splits the source into FRACTURES: the same truth, cut along
// different lines, so each agent reads a different shape of it.
//
//   facts    - atomic source lines, one claim per line, tagged by kind
//   metrics  - the LEDGER: every number in the source with the words around it
//   entities - names that may appear (employers, products, standards, degrees)
//   jd       - the job ad's own numbers and lines, kept APART (never ground a claim)
//   company  - public company facts the user supplied, kept apart as well
//
// viewFor(role) renders those fractures for one agent:
//   writer     - untouched (the client builds the writer prompt; nothing here changes it)
//   supervisor - ledger first, then the facts in a SEEDED SHUFFLE (different order
//                from the prose the writer saw), then entities; the JD is listed as
//                "not a ground"
//   coherence  - ledger + entities, facts grouped by kind (no shuffle: the reviewer
//                reconciles sections against the source numbers)
//   repair     - ledger + facts in source order (the repair writer needs the plain facts)
//
// numberGrounding(candidate, fractures) is the deterministic check that goes with
// it: every number in the generated text must exist in the source ledger (or in
// the JD / company fractures, where it is a company fact, not a candidate claim).
// A number that exists nowhere is a fabrication, flagged without any LLM call.
//
// PARITY: a byte-identical copy lives in workers/demo-proxy/src.

const NUMBER_RE = /(?<![A-Za-z#])(?:~|≈|about |approx\.? |roughly |around )?[€$£]?\d[\d,.]*(?:\s?(?:%|x|×|k|K|M|bn|mn|MP|nm|mm|µm|um|pt|kg|g|h|hrs|hours|days?|weeks?|months?|years?|units?|people|person|countries|engineers))?\+?/g;

const SECTION_HINTS = [
  ['education', /\b(b\.?sc|m\.?sc|mba|ph\.?d|bachelor|master|degree|university|thesis)\b/i],
  ['result', /\b(results?|outcome|achiev|cut|reduced|increased|improved|from\s+~?\d|to\s+~?\d|\d+\s?%|\d+x\b)/i],
  ['role', /^(?:[A-Z][\w&/.' -]{2,60})\s+(?:at|·|-|–|,)\s+|\b(20\d\d|19\d\d)\s*[-–]\s*(20\d\d|present|now)\b/i],
  ['skill', /\b(tools?|methods?|skills?|software|standards?|certificat|course)\b/i],
  ['language', /\b(danish|english|spanish|hebrew|german|french|native|fluent|professional working)\b/i],
  ['referee', /\b(referee|reference|recommendation)\b/i],
];

function clean(s) {
  return String(s || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
}

// Split prose into atomic lines: newline, bullet markers, and sentence ends.
export function atomize(text) {
  const out = [];
  const lines = clean(text).split(/\n+/);
  for (const raw of lines) {
    const l = raw.replace(/^\s*[-•▪*·]\s+/, '').trim();
    if (!l) continue;
    // a long line with several sentences becomes several facts
    const parts = l.length > 160 ? l.split(/(?<=[.;])\s+(?=[A-Z0-9"'])/) : [l];
    for (const p of parts) {
      const t = p.trim();
      if (t.length >= 3) out.push(t);
    }
  }
  return out;
}

function kindOf(line) {
  for (const [kind, re] of SECTION_HINTS) if (re.test(line)) return kind;
  return 'other';
}

// Normalise a number token so "3,400", "~3,400" and "about 3400" compare equal.
export function normNumber(tok) {
  let t = String(tok || '').toLowerCase().replace(/^(~|≈|about |approx\.? |roughly |around )/, '').trim();
  t = t.replace(/[€$£]/g, '').replace(/,/g, '').replace(/\s+/g, '');
  t = t.replace(/×/g, 'x').replace(/\+$/, '');
  // "250days" -> "250" + unit kept separately for the ledger, but matching is on the bare value
  const m = t.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (!m) return null;
  const value = m[1].replace(/\.0+$/, '');
  const unit = m[2] || '';
  return { value, unit, key: value };
}

export function extractNumbers(text) {
  const out = [];
  const src = String(text || '');
  let m;
  NUMBER_RE.lastIndex = 0;
  while ((m = NUMBER_RE.exec(src)) !== null) {
    const n = normNumber(m[0]);
    if (!n) continue;
    const at = m.index;
    out.push({
      raw: m[0].trim(),
      value: n.value,
      unit: n.unit,
      context: src.slice(Math.max(0, at - 60), Math.min(src.length, at + m[0].length + 60)).replace(/\s+/g, ' ').trim(),
      at,
    });
  }
  return out;
}

const ENTITY_RE = /\b(?:[A-Z][\w&'.-]*(?:\s+(?:of|and|&|for|de|di|van|von)?\s*[A-Z][\w&'.-]*){1,4}|[A-Z]{2,}(?:-[A-Z0-9]+)+|ISO\s?\d{4,5}|IEC\s?\d{4,5}|MIL-STD-\d+[A-Z]?|ASPICE|CE\/RED)\b/g;
const ENTITY_STOP = /^(The|This|These|Those|When|Where|What|How|Why|As|At|In|On|For|From|With|Results|Result|Who|I|My|Our|Your|Their|Profile|Work|Style|Key|Core|Selected|Professional|Education|Languages|Tools|Methods|Interests)\b/;

export function extractEntities(text) {
  const seen = new Set();
  const out = [];
  const src = String(text || '');
  let m;
  ENTITY_RE.lastIndex = 0;
  while ((m = ENTITY_RE.exec(src)) !== null) {
    const e = m[0].trim();
    if (e.length < 3 || ENTITY_STOP.test(e)) continue;
    const k = e.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
    if (out.length >= 120) break;
  }
  return out;
}

// Small deterministic PRNG (mulberry32) so a shuffle is reproducible per seed.
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s) {
  let h = 2166136261;
  const str = String(s || '');
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function seededShuffle(arr, seed) {
  const a = arr.slice();
  const r = rng(hashSeed(seed));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// buildFractures({ source_cv, jd_text, company_text }) -> fractures
// ---------------------------------------------------------------------------
export function buildFractures({ source_cv, jd_text, company_text } = {}) {
  const src = clean(source_cv).slice(0, 40000);
  const jd = clean(jd_text).slice(0, 20000);
  const co = clean(company_text).slice(0, 10000);

  const facts = atomize(src).map((t, i) => ({ id: 'F' + (i + 1), kind: kindOf(t), text: t }));
  const metrics = extractNumbers(src);
  const entities = extractEntities(src);
  const jdNumbers = extractNumbers(jd);
  const coNumbers = extractNumbers(co);

  const ledger = new Map();   // value -> [{unit, context}]
  for (const m of metrics) {
    if (!ledger.has(m.value)) ledger.set(m.value, []);
    ledger.get(m.value).push({ unit: m.unit, context: m.context });
  }
  const external = new Set([...jdNumbers, ...coNumbers].map(n => n.value));

  return {
    facts,
    metrics,
    ledger,
    entities,
    external,                 // numbers that are company/JD facts, not candidate claims
    jd_lines: atomize(jd).slice(0, 200),
    company_lines: atomize(co).slice(0, 100),
    counts: { facts: facts.length, metrics: metrics.length, entities: entities.length },
  };
}

function ledgerBlock(fr, limit = 160) {
  const seen = new Set();
  const rows = [];
  for (const m of fr.metrics) {
    const k = m.value + '|' + m.context;
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push(`${m.raw} :: ${m.context}`);
    if (rows.length >= limit) break;
  }
  return rows.length ? rows.join('\n') : '(no numbers in the source)';
}

// ---------------------------------------------------------------------------
// viewFor(role, fractures, seed) -> text block for that agent's prompt
// ---------------------------------------------------------------------------
export function viewFor(role, fr, seed) {
  if (!fr) return '';
  const r = String(role || '').toLowerCase();
  if (r === 'writer') return '';   // the client owns the writer prompt

  const head = `SOURCE FRACTURES (SOURCE-FRACTURES-001 - the candidate's facts, cut differently from the prose the writer read; every claim must trace to a line below):`;
  const ledger = `METRIC LEDGER (every number the candidate may state; a number absent here is a fabrication unless it is a company or job-ad fact):\n${ledgerBlock(fr)}`;
  const ents = `NAMES IN THE SOURCE (employers, products, standards, degrees; a name absent here may not be attributed to the candidate):\n${fr.entities.join(' · ') || '(none)'}`;
  const jdNote = fr.external.size
    ? `JOB-AD / COMPANY NUMBERS (context only, NEVER a candidate claim): ${Array.from(fr.external).slice(0, 60).join(', ')}`
    : '';

  if (r === 'supervisor') {
    const facts = seededShuffle(fr.facts, 'supervisor:' + (seed || fr.counts.facts))
      .map(f => `[${f.id}/${f.kind}] ${f.text}`).join('\n');
    return [head, '', ledger, '', `ATOMIC FACTS (shuffled; the writer saw them in another order - judge each claim against the fact, never against its neighbours):\n${facts}`, '', ents, jdNote].filter(Boolean).join('\n');
  }
  if (r === 'coherence') {
    const byKind = {};
    for (const f of fr.facts) (byKind[f.kind] = byKind[f.kind] || []).push(f);
    const grouped = Object.keys(byKind).sort()
      .map(k => `## ${k}\n` + byKind[k].map(f => `[${f.id}] ${f.text}`).join('\n')).join('\n\n');
    return [head, '', ledger, '', `FACTS BY KIND (when two sections disagree, the source decides which is right):\n${grouped}`, '', ents, jdNote].filter(Boolean).join('\n');
  }
  // repair and anything else: plain order, ledger first
  const facts = fr.facts.map(f => `[${f.id}] ${f.text}`).join('\n');
  return [head, '', ledger, '', `ATOMIC FACTS:\n${facts}`, '', ents, jdNote].filter(Boolean).join('\n');
}

// ---------------------------------------------------------------------------
// numberGrounding(candidate, fractures) -> deviations[] (deterministic)
// ---------------------------------------------------------------------------
// Years like 2006-2026 and small counts (1-3) are skipped: dates come from the
// role lines the client renders, and "three evidence paragraphs" is prose, not
// a metric. "90+ countries" from the job ad is allowed as a company fact.
export function numberGrounding(candidate, fr, opts = {}) {
  const out = [];
  if (!fr || !fr.ledger) return out;
  const minValue = Number.isFinite(opts.minValue) ? opts.minValue : 4;
  const seen = new Set();
  for (const n of extractNumbers(candidate)) {
    const v = Number(n.value);
    if (!Number.isFinite(v)) continue;
    if (v >= 1900 && v <= 2100 && !n.unit) continue;          // a year
    if (v < minValue && !n.unit) continue;                     // a small count in prose
    if (seen.has(n.value)) continue;
    seen.add(n.value);
    if (fr.ledger.has(n.value)) continue;
    if (fr.external.has(n.value)) {
      out.push({
        type: 'metric_external',
        severity: 'low',
        evidence: `"${n.raw}" is a job-ad or company figure, not in the candidate source: "${n.context}"`,
        fix: 'Keep it only as a statement about the company or the role, never as the candidate\'s own result.',
      });
      continue;
    }
    out.push({
      type: 'metric_unbacked',
      severity: 'high',
      evidence: `Number "${n.raw}" appears in the output but in no source line: "${n.context}"`,
      fix: 'Remove the number or replace it with the source\'s own figure from the metric ledger; never derive a new figure.',
    });
  }
  return out;
}

export const SOURCE_FRACTURES_VERSION = '1.0.0';
