// workers/proxy/src/writing-style-engine.js
// Pass 3b — proxy-side implementation of the locked-source plan §4.7
// seven-step pipeline. Wraps the existing multi-LLM proxy with:
//
//   1. Request-payload validation + normalisation for the new fields
//      (writingStyle, toneChips, extraBannedWords/Phrases as lang-keyed
//      objects per §4.5.3, extraConstraints, targetPages, sectionFormat,
//      target_language, package, ats).
//   2. System-prompt enrichment with the active style row + cascade.
//   3. Post-draft Semantic Constraint Engine (SCE) filter with the
//      per-language banned base union'd with the user's extras.
//   4. Retry loop — up to 2 retries with an injected fix instruction,
//      third draft returns the section with flagged:true.
//   5. ATS glyph conversion when ats:true.
//   6. Analytics KV logging (writing-style selection + per-category
//      violation counts).
//
// This module is intentionally self-contained. The canonical source for the
// twelve-style registry + per-language shared bases is
// `writingSystems/registry.json` at the repo root. When that file changes,
// update the corresponding constants here. The duplication is deliberate —
// the worker deploys independently and cannot import outside its directory
// without breaking the wrangler bundle in Cloudflare's edge runtime.

// ─── Per-language shared banned base (plan §4.5 + language-output.md) ────

const SHARED_BANNED_WORDS = {
  en: [
    'spearhead','ensure','foster','streamline','strengthen','empower','leverage',
    'enable','robust','comprehensive','cutting-edge','state-of-the-art','world-class',
    'leading','impactful','rooted','grounded','committed','passionate','holistic',
    'cross-functional','collaborative','journey','dynamic','proactive','results-driven',
    'strategic','agile',
    // Owner 2026-06-12: 'discuss' is forbidden (catchy-specialization batch).
    // Word matching is exact-boundary, so inflections are listed explicitly.
    'discuss','discusses','discussed','discussing',
  ],
  da: ['resultatorienteret','diskutere','diskuterer','diskuteret'],
  es: ['apasionado','apasionada'],
  zh: [],
};

const SHARED_BANNED_PHRASES = {
  en: [
    'drive change','deliver value','key role','pivotal role','proven track record',
    'strong communicator','strategic mindset','mission-driven','I am passionate about',
    'I look forward to hearing from you','responsible for',
    // GEN-SCE-FLAG-001 follow-up 2026-06-12: 'end-to-end' is on the owner banned
    // list (allowed only as a literal course title, which generated prose never
    // is) but was missing from the worker base entirely — it leaked into a live
    // CORE COMPETENCIES cell. Phrase matching is punctuation-tolerant, so this
    // also catches 'end to end'.
    'end-to-end',
  ],
  da: ['Stor erfaring i','Dyb forståelse af'],
  es: ['Apasionado/a por','Orientado/a a resultados','Liderazgo demostrado'],
  zh: [],
};

const SUPPORTED_LANGUAGES = ['en','da','es','zh'];

// ─── Writing-style metadata (subset of the registry needed at runtime) ───
// Keep these in sync with writingSystems/registry.json. The worker only
// uses fields below; the full registry is loaded by the PWA.

const STYLES = {
  'nordic-minimal':        { active: true,  default: true,  density: 'low',          allowedLength:{min:1,max:3}, primaryConstraint:'restraint', contentRule:'Say less and say it clearly.', avoidRule:'Never add a qualifier where a fact will do.', defaultToneChips:['calm','restrained','factual'], glyphDensity:'sparse', guidance:[
    'Cover letter is a forward-looking statement of intent, NOT a CV recap. Open with motivation for THIS employer in their own words (why them specifically, not generic interest); then the concrete tasks you can solve, how you approach them, the methods and tools you bring, and the effect for the employer; close with the personal qualities that make you a good colleague in this team. Frame value to the EMPLOYER (how you help them reach their goals), never what you gain. Keep it to one page.',
    'CV opens with a 5 to 7 line elevator pitch focused on what you offer the employer, targeted to this job; then core competencies as bullets, each tied to the job; then experience in reverse-chronological order with both responsibilities and results. Short, scannable, sub-headed.',
    'Use section headings that carry the job\'s professional keywords so the reader can skim it in seconds.',
    'ONE-LINE RULE (hard cap, tightened 2026-06-13): every SELECTED OUTCOMES and EXPERIENCE bullet fits ONE rendered line (max ~88 characters); every table row fits ONE line (Strategic Expertise cell max ~48 characters), leaving a few characters of headroom so the line never wraps by one word. Compress or split rather than wrap — restraint includes line count.'
  ] },
  'achievement-driven':    { active: true,  density: 'medium',         allowedLength:{min:1,max:3}, primaryConstraint:'outcome-first ordering', contentRule:'Lead with what changed because of you.', avoidRule:'Never name a duty without naming the outcome.', defaultToneChips:['outcome-led','quantified','scope-anchored'], glyphDensity:'medium' },
  'measured-professional': { active: true,  density: 'medium',         allowedLength:{min:1,max:3}, primaryConstraint:'balance of fact and outcome', contentRule:'Concrete actions described in plain language.', avoidRule:'Never claim more than the evidence supports.', defaultToneChips:['balanced','concrete','calm'], glyphDensity:'medium' },
  'structured-professional':{active: true,  density: 'medium',         allowedLength:{min:1,max:3}, primaryConstraint:'process-led framing', contentRule:'Name the method and the scope, then the result.', avoidRule:'Never describe the work without naming the process.', defaultToneChips:['disciplined','method-led','scope-defined'], glyphDensity:'secondary-to-structure' },
  'mediterranean-formal':  { active: true,  density: 'medium-high',    allowedLength:{min:1,max:3}, primaryConstraint:'relational warmth within formality', contentRule:'Acknowledge people and context within a formal register.', avoidRule:'Never strip warmth to fit a length target.', defaultToneChips:['formal','warm','relational'], glyphDensity:'medium' },
  'prestige-structured':   { active: true,  density: 'high',           allowedLength:{min:1,max:3}, primaryConstraint:'institutional weight', contentRule:'Frame every bullet at the scope appropriate to the level.', avoidRule:'Never use language that lowers the register.', defaultToneChips:['institutional','polished','scope-heavy'], glyphDensity:'medium' },
  'credential-forward':    { active: true,  density: 'medium',         allowedLength:{min:1,max:4}, primaryConstraint:'credentials surfaced early', contentRule:'Name the credential, then the work it enabled.', avoidRule:"Never imply a qualification you don't formally hold.", defaultToneChips:['credentialed','accredited','named-methodology'], glyphDensity:'secondary-to-structure' },
  'precision-formal':      { active: true,  density: 'medium-high',    allowedLength:{min:1,max:3}, primaryConstraint:'numerical precision', contentRule:'Quantify wherever a real number is available.', avoidRule:'Never use a magnitude word when a number is available.', defaultToneChips:['precise','quantified','technical'], glyphDensity:'sparse' },
  'context-rich':          { active: true,  density: 'high',           allowedLength:{min:1,max:5}, primaryConstraint:'narrative voice', contentRule:'Say why this work mattered, not just what was done.', avoidRule:'Never fragment a sentence to fit a bullet.', defaultToneChips:['narrative','reasoned','why-led'], glyphDensity:'medium' },
  'cold-outreach':         { active: true,  density: 'low',            allowedLength:{min:1,max:2}, primaryConstraint:'possibility framing, brevity', contentRule:"Open a conversation, don't close a sale.", avoidRule:'Never write more than the recipient will read in 30 seconds.', defaultToneChips:['speculative','brief','conversational'], glyphDensity:'sparse', guidance:[
    'Unsolicited / uopfordret (a specific company with NO posted role): this is the opening of a DIALOGUE, not a real application. Do NOT write as if applying to a current opening.',
    'Shorter and sharper than a normal cover letter, under one page. Structure: which challenges you can help this company solve; why you are motivated to work there (specific to them, not generic); your most relevant competencies for the implied work; close by saying you will follow up in a couple of days.',
    'Forward-looking and possibility-framed: open future possibilities rather than asking for a specific job now. The CV is targeted to the work you are offering to do.'
  ] },
  'research-formal':       { active: true,  density: 'medium-high',    allowedLength:{min:2,max:5}, primaryConstraint:'academic register', contentRule:'Frame contributions as research outputs, not commercial wins.', avoidRule:'Never use commercial metrics where a research metric exists.', defaultToneChips:['academic','methodological','publication-anchored'], glyphDensity:'header-only' },
  'hybrid-balanced':       { active: true,  density: 'medium',         allowedLength:{min:1,max:3}, primaryConstraint:'bridging two registers', contentRule:'Carry both registers without picking one.', avoidRule:'Never write a bullet that only one of the two registers would accept.', defaultToneChips:['bridging','dual-register','jd-tuned'], glyphDensity:'inherit' },
};

const DEFAULT_STYLE = 'nordic-minimal';

const LEGACY_STYLE_ALIAS = {
  scandinavian: 'nordic-minimal',
  usa: 'achievement-driven', american: 'achievement-driven',
  british: 'measured-professional',
  germanic: 'structured-professional',
  mediterranean: 'mediterranean-formal',
  chinese: 'prestige-structured', 'east-asian': 'prestige-structured',
  indian: 'credential-forward',
  japanese: 'precision-formal',
  latam: 'context-rich',
  unsolicited: 'cold-outreach',
  academic: 'research-formal', research: 'research-formal',
  hybrid: 'hybrid-balanced',
};

// ─── Glyph rules — plan §4.10 ──────────────────────────────────────────

const ATS_GLYPH_LABELS = {
  '☎': 'Phone:',
  '✉': 'Email:',
  '🔗': 'Link:',
  '⌂': 'Location:',
  '★': 'Highlight:',
};

const INTEGRITY_RULES = [
  'metric-integrity: Never invent metrics. If a metric is missing, use scope, method, or outcome without numbers.',
  'role-boundary-integrity: Do not imply account, people, or product ownership unless supported. Use "contributed", "supported", "partnered", or "coordinated" only when the underlying scope supports the verb.',
  'team-management-verb: When describing managing or running a team, use "directed", "supervised", or "ran" — NEVER the bare verb "led" (e.g. write "directed a 7-person team", never "led a 7-person team" or "led a team"). This applies in PROFILE, CORE COMPETENCIES, and every experience bullet.',
  'research-evidence-integrity: Do not compress away publications, thesis, methods, or grants in Research Formal. Academic evidence outranks commercial brevity.',
  'cell-two-line-cap: In CORE COMPETENCIES and the cover letter WHAT I BRING table, each Strategic Expertise cell renders at MAX TWO LINES. Keep each expertise value to one tight clause of 6 to 14 words, roughly 90 characters maximum. Never write a cell that wraps to three or four lines; split it into two focus areas or cut the weaker half instead.',
  'selected-outcomes-metric: In SELECTED OUTCOMES, EVERY item must carry a real on-record number (cycle-time cut, cost reduction, team size, year count, patent number, domain count). If an outcome has no honest number, replace it with one that does or merge it away. Never invent a number that is not supported.',
  'punctuation-dash: Use the plain hyphen "-" for year ranges, compound pauses, and table separators. NEVER output an em dash ("—") anywhere - it is treated as a banned token and triggers a rewrite.',
  'patent-number-integrity: Every patent entry in publications/patents keeps its patent number verbatim. Never drop the number for brevity.',
  'work-style-people-close: The WORK STYLE section always ENDS with a people skill (e.g. clear written follow-ups, calm under disagreement, direct one-to-one communication) - never a process or tooling point.',
  'accessibility-explicit: If the candidate data carries an accessibility item, state explicitly that the request concerns a hearing-impaired person. Never an unspecified accommodation line.',
  'specialization-catchy: A specialization/subtitle line is simple and catchy, at most three concepts (pattern: "Processes • Products • People"). Unsolicited applications always carry the candidate\'s stored specialization line.',
];

const MAX_RETRIES = 2;

// ─── Normalisers ─────────────────────────────────────────────────────────

function normaliseStyleId(raw) {
  if (typeof raw !== 'string') return DEFAULT_STYLE;
  const lower = raw.trim().toLowerCase();
  if (STYLES[lower]) return lower;
  if (LEGACY_STYLE_ALIAS[lower]) return LEGACY_STYLE_ALIAS[lower];
  return DEFAULT_STYLE;
}

function normaliseLanguage(raw) {
  if (typeof raw !== 'string') return 'en';
  const lower = raw.trim().toLowerCase();
  return SUPPORTED_LANGUAGES.includes(lower) ? lower : 'en';
}

function normaliseBannedBucket(raw) {
  const out = { en: [], da: [], es: [], zh: [] };
  if (Array.isArray(raw)) {
    out.en = raw.filter((x) => typeof x === 'string');
    return out;
  }
  if (raw && typeof raw === 'object') {
    for (const lang of SUPPORTED_LANGUAGES) {
      const v = raw[lang];
      if (Array.isArray(v)) out[lang] = v.filter((x) => typeof x === 'string');
    }
  }
  return out;
}

function clampTargetPages(targetPages, styleId) {
  const allowed = STYLES[styleId].allowedLength;
  const v = Number(targetPages);
  if (!Number.isFinite(v)) return 2;
  return Math.max(allowed.min, Math.min(allowed.max, v));
}

// ─── Request schema parser ───────────────────────────────────────────────

function normaliseStringMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k === 'string' && typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

function normaliseNumberMap(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k === 'string' && typeof v === 'number' && Number.isFinite(v)) {
      // Clamp to the PWA's documented LINE_LIMIT_MIN / MAX (1..15).
      out[k] = Math.max(1, Math.min(15, Math.round(v)));
    }
  }
  return out;
}

export function parseWritingStyleRequest(body) {
  const b = body && typeof body === 'object' ? body : {};
  const writingStyle = normaliseStyleId(b.writingStyle);
  const targetLang = normaliseLanguage(b.target_language ?? b.targetLanguage);
  const extraBannedWords = normaliseBannedBucket(b.extraBannedWords);
  const extraBannedPhrases = normaliseBannedBucket(b.extraBannedPhrases);
  const toneChips = Array.isArray(b.toneChips)
    ? b.toneChips.filter((x) => typeof x === 'string')
    : [];
  const extraConstraints = Array.isArray(b.extraConstraints) ? b.extraConstraints : [];
  const targetPages = clampTargetPages(b.targetPages, writingStyle);
  const sectionFormat = typeof b.sectionFormat === 'string' ? b.sectionFormat : 'default';
  // v1.50.14 — per-section overrides. Empty objects when the PWA is
  // older than v1.50.14; the preamble simply skips the override block.
  const sectionFormats = normaliseStringMap(b.sectionFormats);
  const sectionLineLimits = normaliseNumberMap(b.sectionLineLimits);
  const pkg = typeof b.package === 'string' ? b.package : 'copenhagen-modern';
  const ats = b.ats === true;
  // Unsolicited (uopfordret) context: a specific company with NO posted role.
  // When set, the unsolicited/cold-outreach craft guidance is composed ON TOP
  // of the chosen style (so nordic-minimal + unsolicited gets both). Off by
  // default; the PWA sets it on the kernel/unsolicited generation path.
  const unsolicited = b.unsolicited === true;

  return {
    writingStyle,
    target_language: targetLang,
    extraBannedWords,
    extraBannedPhrases,
    toneChips,
    extraConstraints,
    targetPages,
    sectionFormat,
    sectionFormats,
    sectionLineLimits,
    package: pkg,
    ats,
    unsolicited,
  };
}

// ─── Step 2 — system-prompt enrichment ───────────────────────────────────

function buildPerSectionOverrideBlock(req) {
  const fmts = req.sectionFormats ?? {};
  const lines = req.sectionLineLimits ?? {};
  const sectionIds = Array.from(new Set([...Object.keys(fmts), ...Object.keys(lines)]));
  if (sectionIds.length === 0) return '';
  const out = ['Per-section overrides (apply when generating the named section):'];
  for (const id of sectionIds) {
    const parts = [];
    if (typeof fmts[id] === 'string' && fmts[id] && fmts[id] !== 'default') {
      parts.push(`format=${fmts[id]}`);
    }
    if (typeof lines[id] === 'number') {
      parts.push(`lineLimit=${lines[id]}`);
    }
    if (parts.length) out.push(`  - ${id}: ${parts.join(', ')}`);
  }
  return out.length > 1 ? out.join('\n') : '';
}

export function buildStyleSystemPreamble(req) {
  const s = STYLES[req.writingStyle];
  const chips = req.toneChips.length ? req.toneChips : s.defaultToneChips;
  const enWords = SHARED_BANNED_WORDS.en.concat(req.extraBannedWords.en);
  const langWords = req.target_language === 'en'
    ? enWords
    : (SHARED_BANNED_WORDS[req.target_language] ?? []).concat(req.extraBannedWords[req.target_language] ?? []);
  const langPhrases = req.target_language === 'en'
    ? SHARED_BANNED_PHRASES.en.concat(req.extraBannedPhrases.en)
    : (SHARED_BANNED_PHRASES[req.target_language] ?? []).concat(req.extraBannedPhrases[req.target_language] ?? []);
  const perSectionBlock = buildPerSectionOverrideBlock(req);

  return [
    `Writing style: ${req.writingStyle}`,
    `Primary constraint: ${s.primaryConstraint}`,
    `Content rule: ${s.contentRule}`,
    `Avoid rule: ${s.avoidRule}`,
    // Style-specific craft guidance (e.g. Nordic application structure,
    // unsolicited/uopfordret dialogue framing). Owner-provided 2026-06-10.
    Array.isArray(s.guidance) && s.guidance.length
      ? 'Style guidance (MUST follow):\n' + s.guidance.map((g) => '  - ' + g).join('\n')
      : '',
    // Compose the unsolicited/uopfordret craft on top of the chosen style when
    // the request is for a company with no posted role (skip if the style IS
    // already cold-outreach — it carries this guidance natively).
    req.unsolicited && req.writingStyle !== 'cold-outreach' && Array.isArray(STYLES['cold-outreach'].guidance)
      ? 'Unsolicited application (uopfordret) — ALSO apply, overriding where they conflict:\n' + STYLES['cold-outreach'].guidance.map((g) => '  - ' + g).join('\n')
      : '',
    `Active tone chips: ${chips.join(', ')}`,
    `Target language: ${req.target_language}`,
    `Target pages: ${req.targetPages}`,
    `Section format (default): ${req.sectionFormat}`,
    perSectionBlock,
    req.ats ? 'ATS-safe mode: ON — convert glyphs to plain-text labels, force Calibri, single column, no photo.' : '',
    `Allowed Unicode bullets: ${Object.keys(ATS_GLYPH_LABELS).length ? '• ◦ ▪ ✓ → ▲' : ''}`,
    'Native colour emoji: NOT ALLOWED.',
    'Integrity rules (MUST be observed):',
    ...INTEGRITY_RULES.map((r) => '  - ' + r),
    langWords.length ? `Banned words (${req.target_language}): ${langWords.slice(0, 64).join(', ')}` : '',
    langPhrases.length ? `Banned phrases (${req.target_language}): ${langPhrases.slice(0, 32).join('; ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ─── Step 5 — Semantic Constraint Engine — banned-list filter ────────────

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findBannedWordHits(text, words) {
  if (!words.length) return [];
  const re = new RegExp('\\b(' + words.map(escapeRegExp).join('|') + ')\\b', 'gi');
  const hits = [];
  let m;
  while ((m = re.exec(text)) !== null) hits.push(m[0]);
  return hits;
}

function findBannedPhraseHits(text, phrases) {
  if (!phrases.length) return [];
  // case-insensitive, punctuation-tolerant — collapse runs of punctuation +
  // whitespace to a single space before matching, then map indices back.
  const collapsed = text.replace(/[\s ]+/g, ' ').replace(/[.,;:!?'’"“”\-—]+/g, ' ').toLowerCase();
  const hits = [];
  for (const p of phrases) {
    const target = p.replace(/[\s ]+/g, ' ').replace(/[.,;:!?'’"“”\-—]+/g, ' ').toLowerCase().trim();
    if (target && collapsed.includes(target)) hits.push(p);
  }
  return hits;
}

// Punctuation-dash rule (owner 2026-06-12: use "-" instead of "—"). Any em
// dash in a draft is a violation; the hit string feeds the retry
// fix-instruction. Capped at 3 reported sites so a dash-heavy draft does not
// flood the instruction. Applies in every language (zh double dash included).
function findEmDashHits(text) {
  if (typeof text !== 'string' || text.indexOf('—') === -1) return [];
  const hits = [];
  const re = /[^\n]{0,25}—+[^\n]{0,25}/g;
  let m;
  while ((m = re.exec(text)) !== null && hits.length < 3) {
    hits.push(`em dash used ("${m[0].trim()}") - replace "—" with "-"`);
  }
  return hits;
}

// Team-management verb rule (owner standing rule): the bare verb "led" must
// not be used for managing/running a team — use directed/supervised/ran. We do
// NOT ban "led" outright ("led design reviews", "led prototype-to-production
// transfer" are fine). We match only the team-management shape: "led" +
// optional article + optional "N-person" + a team noun. English-only.
function findTeamLedHits(text, lang) {
  if (lang !== 'en') return [];
  const re = /\bled\s+(?:a\s+|the\s+|an\s+)?\d+[-\s]?(?:person|engineer|member|man|people)\b[^.;,\n]{0,40}?\b(?:team|group|squad|crew|unit|department|division)\b|\bled\s+(?:a\s+|the\s+|an\s+)?(?:team|group|squad|crew|unit|department|division)\b/gi;
  const hits = [];
  let m;
  while ((m = re.exec(text)) !== null) hits.push(m[0].trim());
  return hits;
}

// ─── Structure-aware checks (operate on the writer's JSON output) ─────────
// The writer emits a JSON object per references/output-schema.md. When the
// LLM text parses as that object we can inspect specific sections by key:
//   - core_competencies / what_i_bring expertise cells (2-line cap)
//   - selected_outcomes (numeric-metric presence)
// When the text is NOT JSON (e.g. a single-section plain-text regen) these
// checks no-op — they only fire when there is structure to inspect, so they
// never false-positive on prose. A heading-scoped PLAIN-TEXT fallback for the
// selected-outcomes metric check was added 2026-06-12 (GEN-SCE-FLAG-001
// family): the live per-section path returns plain text, so the JSON-only
// check provably never fired there and metric-free outcomes shipped clean.

const CELL_CHAR_CAP = 90; // ~2 rendered lines in the 4.94" expertise column.
// NORDIC-ONELINE-001 (owner 2026-06-12: "for nordic minimal allow up to one
// line per bullet and one line per table"). nordic-minimal tightens the caps
// to ONE rendered line: ~55 chars in the expertise column, ~95 chars for a
// main-column bullet. Other styles keep the two-line cell cap and no bullet
// cap.
// Tightened 2026-06-13 (owner: bullets/cells "miss by one word" in preview —
// the caps were a hair too loose for the rendered column width). A few chars
// of headroom now guarantee the line never wraps by one word.
const NORDIC_CELL_CHAR_CAP = 48;
const NORDIC_BULLET_CHAR_CAP = 88;

function tryParseSectionsJson(text) {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (!t || (t[0] !== '{' && t[0] !== '[')) return null;
  try {
    const o = JSON.parse(t);
    return o && typeof o === 'object' ? o : null;
  } catch (_) {
    return null;
  }
}

// Collect expertise-cell strings from either a top-level object that has a
// `sections` wrapper or a bare section object. Handles core_competencies
// (CV) and cover_letter.what_i_bring (CL), in both `rows[{expertise}]` and
// `items["focus — expertise"]` shapes.
function collectExpertiseCells(root) {
  const cells = [];
  const pushFromRows = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.rows)) {
      for (const r of node.rows) {
        if (r && typeof r.expertise === 'string') cells.push(r.expertise);
      }
    }
    if (Array.isArray(node.items)) {
      for (const it of node.items) {
        if (typeof it === 'string') {
          // "Focus area — expertise" flattened form: measure the part after
          // the em/en dash, which is the expertise clause.
          const parts = it.split(/\s[—–-]\s/);
          cells.push(parts.length > 1 ? parts.slice(1).join(' - ') : it);
        }
      }
    }
  };
  const sections = (root.sections && typeof root.sections === 'object') ? root.sections : root;
  if (sections && typeof sections === 'object') {
    pushFromRows(sections.core_competencies);
    const cl = sections.cover_letter || root.cover_letter;
    if (cl && typeof cl === 'object') pushFromRows(cl.what_i_bring);
    // also support a bare what_i_bring / core_competencies regen
    pushFromRows(root.what_i_bring);
  }
  return cells.filter((c) => typeof c === 'string' && c.trim());
}

// Over-long expertise cells (> ~2 lines; ONE line in nordic-minimal).
// Returns short violation labels for the retry fix-instruction.
// Language-agnostic (char length only).
function findOverlongCellHits(text, cap = CELL_CHAR_CAP) {
  const root = tryParseSectionsJson(text);
  if (!root) return [];
  const cells = collectExpertiseCells(root);
  const hits = [];
  for (const c of cells) {
    const clean = c.replace(/\s+/g, ' ').trim();
    if (clean.length > cap) {
      const preview = clean.length > 40 ? clean.slice(0, 40) + '…' : clean;
      hits.push(`expertise cell too long (${clean.length} chars, max ${cap}): "${preview}"`);
    }
  }
  return hits;
}

// NORDIC-ONELINE-001: nordic-minimal bullets fit ONE rendered line. JSON
// path covers selected_outcomes items + experience bullets; the plain-text
// fallback is HEADING-SCOPED to SELECTED OUTCOMES / EXPERIENCE blocks so a
// cover-letter prose bullet (HOW I WOULD CONTRIBUTE) is never flagged.
function findNordicOverlongBullets(text) {
  const hits = [];
  const push = (s) => {
    const clean = String(s).replace(/\s+/g, ' ').trim();
    if (clean.length > NORDIC_BULLET_CHAR_CAP) {
      const preview = clean.slice(0, 40) + '…';
      hits.push(`nordic-minimal bullet exceeds one line (${clean.length} chars, max ${NORDIC_BULLET_CHAR_CAP}): "${preview}" — compress or split the bullet`);
    }
  };
  const root = tryParseSectionsJson(text);
  if (root) {
    const sections = (root.sections && typeof root.sections === 'object') ? root.sections : root;
    const so = sections && sections.selected_outcomes;
    const soItems = so && Array.isArray(so.items) ? so.items : [];
    for (const it of soItems) {
      if (typeof it === 'string') push(it);
      else if (it && typeof it === 'object') push([it.title, it.body].filter(Boolean).join(' '));
    }
    const exp = sections && sections.experience;
    if (Array.isArray(exp)) {
      for (const role of exp) {
        const items = role && (Array.isArray(role.items) ? role.items : Array.isArray(role.bullets) ? role.bullets : []);
        for (const b of items || []) if (typeof b === 'string') push(b);
      }
    }
    return hits;
  }
  // plain-text fallback — bullets under an outcomes/experience heading only
  const headRe = /(^|\n)[#*\s]{0,8}(selected outcomes|udvalgte resultater|professional experience|work experience|erhvervserfaring|erfaring)[^\n]*\n/gi;
  let m;
  while ((m = headRe.exec(text)) !== null) {
    const rest = text.slice(m.index + m[0].length);
    const nextHead = rest.search(/\n[#*\s]{0,8}[A-ZÆØÅ][A-ZÆØÅ &\/\-]{5,}[^\na-zæøå]*\n/);
    const block = nextHead >= 0 ? rest.slice(0, nextHead) : rest;
    for (const line of block.split('\n')) {
      const lm = line.match(/^\s*[-–•◦▪*]\s+(.*)$/);
      if (lm) push(lm[1]);
    }
  }
  return hits;
}

function blobHasMetric(blob) {
  return /\d/.test(blob) || /\b(\d+x|tenfold|two-?fold|three-?fold)\b/i.test(blob);
}

function missingMetricHit(blob) {
  const clean = String(blob).replace(/\s+/g, ' ').trim();
  const preview = clean.length > 48 ? clean.slice(0, 48) + '…' : clean;
  return `selected_outcomes item has no number ("${preview}") — every outcome must carry an on-record metric from the candidate's OWN stored data (metric shapes: a cycle-time change, a % improvement, a team or task-force size, years of experience, a count of domains / patents / products); merge or replace the item, never invent a number`;
}

// Selected Outcomes metric rule — PER ITEM (owner directive 2026-06-12: a
// single numbered bullet is not enough; every outcome must carry a number or
// be merged away). The retry message names metric SHAPES, not any one
// candidate's numbers (GEN-DEHARDCODE-002: the previous wording listed
// Gabriel's metrics as the examples for every persona). We flag each
// metric-free item with a preview so the retry instruction names exactly what
// to fix; we never force a SPECIFIC number into a SPECIFIC bullet (the model
// chooses from the candidate's own on-record set — fabrication stays banned).
function findMissingMetricHits(text) {
  const root = tryParseSectionsJson(text);
  if (!root) return [];
  const sections = (root.sections && typeof root.sections === 'object') ? root.sections : root;
  const so = sections && sections.selected_outcomes;
  if (!so || typeof so !== 'object') return [];
  const items = Array.isArray(so.items) ? so.items : (Array.isArray(so) ? so : null);
  if (!items || items.length === 0) return [];
  const hits = [];
  for (const it of items) {
    let blob = '';
    if (typeof it === 'string') blob = it;
    else if (it && typeof it === 'object') {
      if (typeof it.title === 'string') blob += ' ' + it.title;
      if (typeof it.body === 'string') blob += ' ' + it.body;
    }
    blob = blob.replace(/\s+/g, ' ').trim();
    if (!blob) continue;
    if (!blobHasMetric(blob)) hits.push(missingMetricHit(blob));
  }
  return hits;
}

// PLAIN-TEXT fallback (GEN-SCE-FLAG-001 follow-up, 2026-06-12; per-item
// enforcement added the same day on owner directive). The live
// per-section generation path returns prose, not JSON, so findMissingMetricHits
// above never fires there. When the prose contains a SELECTED OUTCOMES heading
// (any casing, optional markdown/heading decoration), inspect that block —
// from the heading to the next ALL-CAPS-style heading line or end of text —
// for any digit / written multiplier. Conservative by design: when the text
// carries no recognisable heading we cannot know the section identity and we
// no-op (full per-section enforcement needs the client to send the section id;
// tracked in the QA index under GEN-SCE-FLAG-001 fix direction).
function findMissingMetricHitsPlainText(text) {
  if (typeof text !== 'string' || !text) return [];
  if (tryParseSectionsJson(text)) return []; // JSON path owns this case
  const headRe = /(^|\n)[#*\s]{0,8}selected outcomes[^\n]*\n/i;
  const m = headRe.exec(text);
  if (!m) return [];
  const start = m.index + m[0].length;
  const rest = text.slice(start);
  // Next heading: a line that is predominantly uppercase letters / separators
  // (e.g. "CORE COMPETENCIES", "PROFESSIONAL EXPERIENCE", "## EDUCATION").
  const nextHead = rest.search(/\n[#*\s]{0,8}[A-ZÆØÅ][A-ZÆØÅ &\/\-]{5,}[^\na-zæøå]*\n/);
  const block = (nextHead >= 0 ? rest.slice(0, nextHead) : rest).trim();
  if (block.length < 40) return []; // empty/near-empty block: SO-003 territory, not a wording retry
  // PER ITEM: each bullet line of meaningful length must carry a number.
  const lines = block
    .split('\n')
    .map((l) => l.replace(/^[\s\-–—•◦▪*]+/, '').replace(/\s+/g, ' ').trim())
    .filter((l) => l.length >= 25);
  if (lines.length === 0) {
    return blobHasMetric(block) ? [] : [missingMetricHit(block)];
  }
  const hits = [];
  for (const l of lines) {
    if (!blobHasMetric(l)) hits.push(missingMetricHit(l));
  }
  return hits;
}

export function evaluateSce(text, req) {
  const lang = req.target_language;
  const words = (SHARED_BANNED_WORDS[lang] ?? []).concat(req.extraBannedWords[lang] ?? []);
  const phrases = (SHARED_BANNED_PHRASES[lang] ?? []).concat(req.extraBannedPhrases[lang] ?? []);
  const wordHits = findBannedWordHits(text, words);
  const phraseHits = findBannedPhraseHits(text, phrases);
  // Team-management "led" pattern → surfaced as phrase hits so the existing
  // retry fix-instruction names them and asks for directed/supervised/ran.
  const teamLedHits = findTeamLedHits(text, lang);
  if (teamLedHits.length) phraseHits.push(...teamLedHits);
  // Em dashes are violations in every language — the retry instruction asks
  // for "-" instead (owner 2026-06-12).
  const emDashHits = findEmDashHits(text);
  if (emDashHits.length) phraseHits.push(...emDashHits);
  // Structure-aware checks (no-op on non-JSON text):
  //   - over-long Strategic Expertise cells (CORE COMPETENCIES / WHAT I BRING)
  //   - metric-free SELECTED OUTCOMES items
  // Both surfaced as phrase hits so they feed the existing 3-attempt retry.
  // NORDIC-ONELINE-001: nordic-minimal tightens the cell cap to ONE line and
  // adds a one-line bullet check (outcomes + experience only).
  const nordic = (req.writingStyle || DEFAULT_STYLE) === 'nordic-minimal';
  const overlongHits = findOverlongCellHits(text, nordic ? NORDIC_CELL_CHAR_CAP : CELL_CHAR_CAP);
  if (overlongHits.length) phraseHits.push(...overlongHits);
  if (nordic) {
    const oneLineHits = findNordicOverlongBullets(text);
    if (oneLineHits.length) phraseHits.push(...oneLineHits);
  }
  const missingMetricHits = findMissingMetricHits(text);
  if (missingMetricHits.length) phraseHits.push(...missingMetricHits);
  // Plain-text fallback for the same rule (heading-scoped; no-ops on JSON).
  const missingMetricPlainHits = findMissingMetricHitsPlainText(text);
  if (missingMetricPlainHits.length) phraseHits.push(...missingMetricPlainHits);

  return {
    clean: wordHits.length === 0 && phraseHits.length === 0,
    bannedWordHits: wordHits,
    bannedPhraseHits: phraseHits,
  };
}

// ─── Step 5 — retry loop ─────────────────────────────────────────────────

/**
 * Wraps an LLM-call function with the SCE retry loop. callLlm should return
 * a string (the generated text). Up to MAX_RETRIES retries; the third draft
 * returns with flagged:true.
 *
 *   const result = await runWithSceRetry({
 *     req,
 *     callLlm: async (extraSystemPrefix) => '… LLM output …',
 *   });
 *   // result.text, result.flagged, result.violations, result.attempts
 */
export async function runWithSceRetry({ req, callLlm }) {
  const violations = [];
  let attempt = 0;
  let text = await callLlm('');
  let evalResult = evaluateSce(text, req);
  violations.push(evalResult);

  while (!evalResult.clean && attempt < MAX_RETRIES) {
    attempt += 1;
    const fixInstruction = [
      'The previous draft contained banned words or phrases. Re-write the section without using:',
      evalResult.bannedWordHits.length ? `  banned words: ${[...new Set(evalResult.bannedWordHits)].join(', ')}` : '',
      evalResult.bannedPhraseHits.length ? `  banned phrases: ${[...new Set(evalResult.bannedPhraseHits)].join('; ')}` : '',
      'Preserve the meaning and the active style. Do not invent metrics. Do not overclaim ownership.',
    ].filter(Boolean).join('\n');
    text = await callLlm(fixInstruction);
    evalResult = evaluateSce(text, req);
    violations.push(evalResult);
  }

  const flagged = !evalResult.clean;
  return {
    text: req.ats ? applyAtsGlyphConversion(text) : text,
    flagged,
    attempts: attempt + 1,
    finalViolations: evalResult,
    history: violations,
  };
}

// ─── Step 6 — ATS glyph conversion ───────────────────────────────────────

export function applyAtsGlyphConversion(input) {
  let out = String(input ?? '');
  for (const [glyph, label] of Object.entries(ATS_GLYPH_LABELS)) {
    out = out.split(glyph).join(label);
  }
  return out;
}

// ─── Provider-agnostic LLM text extract / replace (v1.50.2) ─────────────
// `shape` is 'openai_compat' (OpenAI / Mistral / Gemini-normalised) or
// 'anthropic_messages' (Anthropic /v1/messages non-streaming response).

/**
 * Extract the LLM-generated text from a parsed provider response.
 * @returns {string | null}
 */
export function extractLlmText(shape, json) {
  if (!json || typeof json !== 'object') return null;
  if (shape === 'openai_compat') {
    const c = json.choices?.[0]?.message?.content;
    return typeof c === 'string' ? c : null;
  }
  if (shape === 'anthropic_messages') {
    const blocks = json.content;
    if (!Array.isArray(blocks)) return null;
    return blocks
      .filter((b) => b && b.type === 'text' && typeof b.text === 'string')
      .map((b) => b.text)
      .join('');
  }
  return null;
}

/**
 * Replace the LLM-generated text in a parsed provider response. Mutates
 * `json` in place and returns true on success.
 */
export function replaceLlmText(shape, json, newText) {
  if (!json || typeof json !== 'object') return false;
  if (shape === 'openai_compat') {
    if (json.choices?.[0]?.message) {
      json.choices[0].message.content = newText;
      return true;
    }
    return false;
  }
  if (shape === 'anthropic_messages') {
    if (!Array.isArray(json.content)) return false;
    const idx = json.content.findIndex((b) => b && b.type === 'text');
    if (idx < 0) return false;
    // Replace the first text block; drop later text blocks so combined
    // output isn't double-counted on the consumer side.
    json.content[idx].text = newText;
    json.content = json.content.filter((b, i) => !(b && b.type === 'text') || i === idx);
    return true;
  }
  return false;
}

/**
 * Build the fix-instruction string used by the SCE retry loop. Sourced
 * from the same patterns the writing-engine's own retry uses, so the
 * instruction shape is consistent across the proxy and (eventually) any
 * out-of-band retry callers.
 */
function buildSceFixInstruction(sceResult) {
  const lines = [
    'The previous draft contained banned words or phrases. Re-write the section without using:',
  ];
  if (sceResult.bannedWordHits.length) {
    lines.push('  banned words: ' + [...new Set(sceResult.bannedWordHits)].join(', '));
  }
  if (sceResult.bannedPhraseHits.length) {
    lines.push('  banned phrases: ' + [...new Set(sceResult.bannedPhraseHits)].join('; '));
  }
  lines.push('Preserve the meaning and the active style. Do not invent metrics. Do not overclaim ownership.');
  return lines.join('\n');
}

/**
 * v1.50.3 — buffered provider response → SCE eval → optional retry loop →
 * ATS conversion → analytics + headers.
 *
 * If `reCallProvider` is supplied and the first draft is dirty, the
 * helper calls it up to 2 more times (3 attempts total) with a fix
 * instruction injected each time. The third dirty draft returns with
 * `flagged:true` per plan §4.7 step 5.
 *
 * `reCallProvider(fixInstruction)` must:
 *   - mutate its provider-specific body to append `fixInstruction` to
 *     the system content,
 *   - call the upstream provider again,
 *   - return `{ ok: true, text: <body-as-string> }` on success or
 *     `{ ok: false }` on any failure (upstream rate-limit, parse error,
 *     etc.). A failed retry breaks the loop and we keep the previous
 *     dirty draft with `flagged:true`.
 *
 * If `reCallProvider` is not supplied this behaves identically to v1.50.2's
 * postProcessLlmResponse — a single-pass evaluation.
 *
 * @returns {{ data: string, headers: Record<string,string>, sce: object | null, attempts: number, flagged: boolean }}
 */
export async function executeSceWithRetry({
  data,
  shape,
  writingStyleRequest,
  env,
  userId,
  augTask,
  reCallProvider, // optional async (fixInstruction) => { ok: true, text } | { ok: false }
}) {
  if (!writingStyleRequest) return { data, headers: {}, sce: null, attempts: 1, flagged: false };

  let lastData = data;
  let lastParsed = null;
  let lastLlmText = null;
  let lastSce = null;
  let attempts = 1;
  let atsApplied = false;

  // GEN-SCE-FLAG-001 (2026-06-12): the early-return paths used to skip
  // SILENTLY (no telemetry), so a shape mismatch on the live path was
  // indistinguishable from the SCE never running. Each skip now logs a
  // reason-coded sce-skip event AND surfaces an X-AntCV-Sce-Skip header.
  const skip = async (reason) => {
    try {
      await logWritingEngineEvent(env, {
        kind: 'sce-skip', reason, shape: shape ?? null,
        userId: userId ?? null, augTask: augTask ?? null,
        writingStyle: writingStyleRequest.writingStyle,
      });
    } catch (e) { /* never block the response */ }
    return { data, headers: { 'X-AntCV-Sce-Skip': reason }, sce: null, attempts: 1, flagged: false };
  };
  try {
    lastParsed = JSON.parse(lastData);
    lastLlmText = extractLlmText(shape, lastParsed);
  } catch (e) {
    return skip('parse-fail');
  }
  if (lastLlmText == null) return skip('no-llm-text');

  lastSce = evaluateSce(lastLlmText, writingStyleRequest);

  // Retry loop — max 3 total attempts (initial + 2 retries) per plan §4.7.
  while (!lastSce.clean && attempts < 3 && typeof reCallProvider === 'function') {
    const fixInstruction = buildSceFixInstruction(lastSce);
    let retryResp;
    try {
      retryResp = await reCallProvider(fixInstruction);
    } catch (e) {
      console.warn('[writing-style-engine] reCallProvider threw', e && e.message);
      break;
    }
    if (!retryResp || retryResp.ok !== true || typeof retryResp.text !== 'string') break;

    let retryParsed;
    try { retryParsed = JSON.parse(retryResp.text); }
    catch (e) { break; }

    const retryLlmText = extractLlmText(shape, retryParsed);
    if (retryLlmText == null) break;

    lastData = retryResp.text;
    lastParsed = retryParsed;
    lastLlmText = retryLlmText;
    lastSce = evaluateSce(retryLlmText, writingStyleRequest);
    attempts++;
  }

  // ATS glyph conversion happens AFTER the retry loop on the final text.
  if (writingStyleRequest.ats) {
    const converted = applyAtsGlyphConversion(lastLlmText);
    if (converted !== lastLlmText) {
      if (replaceLlmText(shape, lastParsed, converted)) {
        lastData = JSON.stringify(lastParsed);
        lastLlmText = converted;
        atsApplied = true;
      }
    }
  }

  const flagged = !lastSce.clean;

  // Telemetry — one sce-eval per request, with attempts + flagged so
  // analytics can compute (attempts > 1) and (flagged) rates.
  // GEN-SCE-FLAG-001 (2026-06-12): this was fire-and-forget (`void …`).
  // On Cloudflare Workers an un-awaited promise dies with the isolate when
  // the response returns — which is why ANALYTICS KV held ZERO sce-eval
  // events over the full 90-day TTL window even though the path ran. The
  // put is one small KV write; AWAIT it so it actually lands.
  try {
    await logWritingEngineEvent(env, {
      kind: 'sce-eval',
      userId: userId ?? null,
      writingStyle: writingStyleRequest.writingStyle,
      target_language: writingStyleRequest.target_language,
      bannedWordHits: lastSce.bannedWordHits.length,
      bannedPhraseHits: lastSce.bannedPhraseHits.length,
      sceClean: lastSce.clean,
      ats: !!writingStyleRequest.ats,
      atsApplied,
      augTask: augTask ?? null,
      attempts,
      flagged,
    });
  } catch (e) {
    console.warn('[writing-style-engine] sce-eval log failed', e && e.message);
  }

  const headers = {
    'X-AntCV-Sce-Banned-Words': String(lastSce.bannedWordHits.length),
    'X-AntCV-Sce-Banned-Phrases': String(lastSce.bannedPhraseHits.length),
    'X-AntCV-Sce-Clean': lastSce.clean ? '1' : '0',
    'X-AntCV-Sce-Attempts': String(attempts),
  };
  if (atsApplied) headers['X-AntCV-Ats-Applied'] = '1';
  if (flagged) headers['X-AntCV-Flagged'] = '1';

  return { data: lastData, headers, sce: lastSce, attempts, flagged };
}

/**
 * v1.50.2 single-pass entry point. Retained for backwards-compatible
 * call sites that don't want retry behaviour. Internally delegates to
 * executeSceWithRetry with no reCallProvider (so no retry runs).
 *
 * @returns {{ data: string, headers: Record<string,string>, sce: object | null }}
 */
export function postProcessLlmResponse({ data, shape, writingStyleRequest, env, userId, augTask }) {
  if (!writingStyleRequest) return { data, headers: {}, sce: null };
  try {
    const json = JSON.parse(data);
    const text = extractLlmText(shape, json);
    if (text == null) return { data, headers: {}, sce: null };

    const sce = evaluateSce(text, writingStyleRequest);
    let modified = text;
    let atsApplied = false;

    if (writingStyleRequest.ats) {
      const converted = applyAtsGlyphConversion(modified);
      if (converted !== modified) {
        modified = converted;
        atsApplied = true;
      }
    }

    let finalData = data;
    if (modified !== text) {
      if (replaceLlmText(shape, json, modified)) {
        finalData = JSON.stringify(json);
      }
    }

    try {
      void logWritingEngineEvent(env, {
        kind: 'sce-eval',
        userId: userId ?? null,
        writingStyle: writingStyleRequest.writingStyle,
        target_language: writingStyleRequest.target_language,
        bannedWordHits: sce.bannedWordHits.length,
        bannedPhraseHits: sce.bannedPhraseHits.length,
        sceClean: sce.clean,
        ats: !!writingStyleRequest.ats,
        atsApplied,
        augTask: augTask ?? null,
      });
    } catch (e) {
      console.warn('[writing-style-engine] sce-eval log failed', e && e.message);
    }

    const headers = {
      'X-AntCV-Sce-Banned-Words': String(sce.bannedWordHits.length),
      'X-AntCV-Sce-Banned-Phrases': String(sce.bannedPhraseHits.length),
      'X-AntCV-Sce-Clean': sce.clean ? '1' : '0',
    };
    if (atsApplied) headers['X-AntCV-Ats-Applied'] = '1';

    return { data: finalData, headers, sce };
  } catch (e) {
    console.warn('[writing-style-engine] postProcessLlmResponse failed', e && e.message);
    return { data, headers: {}, sce: null };
  }
}

// ─── Analytics KV logging ────────────────────────────────────────────────
// ANALYTICS_SECRET + analytics KV namespace are pre-existing on the worker —
// see workers/proxy/wrangler.toml. The log shape mirrors the existing
// JD-analysis / supervisor events so the analytics-export endpoint
// (analytics-export.js) can include writing-engine telemetry without code
// changes.

/**
 * @param {{ANALYTICS?: KVNamespace}} env
 * @param {object} payload
 */
export async function logWritingEngineEvent(env, payload) {
  if (!env || !env.ANALYTICS || typeof env.ANALYTICS.put !== 'function') {
    // KV not bound — fail silently (per AntCV standing rule). The event
    // can be replayed from `wrangler tail` in invocation logs if needed.
    return;
  }
  const key = `writing-engine:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
  try {
    await env.ANALYTICS.put(key, JSON.stringify({ ts: Date.now(), kind: 'writing-engine', ...payload }), {
      expirationTtl: 60 * 60 * 24 * 90, // 90-day retention
    });
  } catch (e) {
    console.warn('[writing-engine] analytics KV put failed', e && e.message);
  }
}

// ─── Public API ──────────────────────────────────────────────────────────

export const WritingStyleEngine = {
  parseWritingStyleRequest,
  buildStyleSystemPreamble,
  evaluateSce,
  runWithSceRetry,
  applyAtsGlyphConversion,
  extractLlmText,
  replaceLlmText,
  postProcessLlmResponse,
  executeSceWithRetry,
  logWritingEngineEvent,
  STYLES,
  SHARED_BANNED_WORDS,
  SHARED_BANNED_PHRASES,
  DEFAULT_STYLE,
  SUPPORTED_LANGUAGES,
};

export default WritingStyleEngine;
