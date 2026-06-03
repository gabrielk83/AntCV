// Prompt augmentation middleware for cv-proxy.
// =================================================================
// Inspects outgoing LLM requests (Anthropic Messages format — the
// shape the PWA sends; per-provider conversion happens downstream)
// and detects four CV/CL generation tasks by signature:
//
//   cv_outcomes            — "Selected Outcomes" generation
//   cv_core_competencies   — CV "Core Competencies" table
//   cl_what_i_bring        — Cover letter "What I Bring" table
//   cv_profile             — CV "Profile" section
//
// For each detected task, a stronger task-specific system prompt is
// prepended to whatever system prompt the PWA already provided. The
// PWA's prompt still drives the specific instance (the user's actual
// content, language, tone preference, banned words list, etc.); the
// augmentation just establishes the frame and the rules the model
// must satisfy.
//
// Why this lives in cv-proxy rather than the PWA:
//   - The PWA bundle is minified and hard to modify safely.
//   - These guidance rules are infrastructure-level, not per-user;
//     they should govern every CV generated through this service.
//   - Future supervisor-agent post-checks will run here too, on the
//     LLM response, so the augmentation and the validation share a
//     single integration point.
//
// What this does NOT do (yet):
//   - Auto-repair on bad responses (planned for the supervisor
//     endpoint).
//   - Per-user banned-word lists (currently uses the project-wide
//     defaults from the constitution; per-user overrides will arrive
//     when the PWA pushes them via /preferences).

// ------------------------------------------------------------------
// Banned words and phrases.
// Mirrors the AntCV constitution. When the PWA later syncs per-user
// banned lists into KV, this becomes the fallback default.
// ------------------------------------------------------------------
const BANNED_WORDS = [
  // Verbs
  'spearhead', 'ensure', 'foster', 'streamline', 'strengthen',
  'empower', 'leverage', 'drive', 'deliver', 'enable',
  // Adjectives
  'robust', 'comprehensive', 'cutting-edge', 'state-of-the-art',
  'world-class', 'leading', 'impactful', 'rooted', 'grounded',
  'committed', 'passionate', 'holistic', 'multi-faceted',
  'cross-functional', 'collaborative', 'central', 'dynamic',
  'proactive', 'agile',
  // Nouns
  'journey',
  // Danish
  'tværgående', 'tværfunktionel',
];

const BANNED_PHRASES = [
  'key role', 'pivotal role', 'end-to-end',
  'proven track record', 'strong communicator', 'strong leader',
  'results-driven', 'strategic mindset', 'client-focused',
  'customer-centric', 'mission-driven',
  'My expertise lies in', 'I am known for', 'At the heart of my work',
  'My approach is', 'I am passionate about', 'I thrive in',
  'I bring a wealth of experience', 'Proven ability to',
  'I am committed to', 'Passionate about driving',
  'Known for fostering',
];

function bannedListBlock() {
  // The full banned lists are short enough (~30 words, ~25 phrases)
  // that the token cost of including them in every augmentation is
  // worth the editorial precision. Earlier versions included only
  // the first 18 entries; that excluded common offenders like
  // "passionate" and "committed", letting them slip through.
  return [
    'EDITORIAL REGISTER (apply to all output):',
    `  Forbidden words: ${BANNED_WORDS.join(', ')}.`,
    `  Forbidden phrases: "${BANNED_PHRASES.join('", "')}".`,
    '  Preferred: short factual sentences, concrete actions, specific outcomes, calm Danish-toned professional voice. No hype words. No filler. No vague claims.',
  ].join('\n');
}

// Universal anti-fabrication block. Goes into EVERY CV/CL task
// augmentation. The most dangerous failure mode is not stylistic —
// it's the LLM seeing a domain in the job description that the
// candidate has NEVER worked in, and reflecting it backward into the
// candidate's claimed experience. ("JD mentions marine sensors → CL
// claims marine experience" — even though the source has only optics.)
// This block makes that failure mode explicit and forbidden, with
// concrete worked examples drawn from real failures.
function noFabricationBlock() {
  return [
    'NO FABRICATION (HARD RULE — overrides any other instruction):',
    '  Every domain, technology, industry, employer, project, role, methodology, certification, eligibility, clearance status, citizenship, language proficiency, or competency you attribute to the candidate MUST be present in the source material provided. Not implied. Not "close enough". Present.',
    '',
    '  When a job description mentions things the candidate has NOT got, has NOT done, or whose status is UNSPECIFIED in the source:',
    '    - DO NOT claim those items as candidate experience or status.',
    '    - DO NOT invent "adjacent" or "related" claims that are not actually grounded in the source.',
    '    - DO ground the candidate in their genuine related experience, named correctly, without morphing it into the JD\'s vocabulary.',
    '    - DO acknowledge the gap where it exists. A clear gap is more credible than a fabricated fit.',
    '',
    '  Worked examples of FORBIDDEN hallucinations (each is a real failure mode that has occurred):',
    '',
    '    1. Domain leakage — JD vocabulary substituted for candidate vocabulary',
    '       JD mentions "marine sensors" / source has "automotive LiDAR + camera optics"',
    '         → ✗ "experience with marine sensors"',
    '         → ✓ "experience with automotive sensing systems including LiDAR and camera optics"',
    '',
    '       JD mentions "radar, sonar, ultrasonic" / source has "LiDAR + electro-optics"',
    '         → ✗ "hands-on with radar, sonar, ultrasonic systems"',
    '         → ✓ "hands-on with electro-optical sensing including 905 nm and 1550 nm LiDAR"',
    '',
    '       JD mentions "naval defence programs" / source has "defence electro-optics at Meprolight"',
    '         → ✗ "naval programmes background"',
    '         → ✓ "defence electro-optics background, including IDF service in security-sensitive environments"',
    '',
    '    2. Eligibility / clearance / citizenship leakage — JD requirement asserted as candidate fact',
    '       JD says "must be eligible for clearance with FE / Danish Defence Intelligence Service" / source does NOT state the candidate IS eligible',
    '         → ✗ "eligible for clearance with the Danish Defence Intelligence Service"',
    '         → ✗ "FE-cleared"',
    '         → ✓ "former IDF service; experience in security-sensitive environments and handling classified information"  (only if the source says so)',
    '         → ✓ omit the topic entirely',
    '       Eligibility is a legal status, not a transferable skill. Claiming it without source grounding is a fabrication that misleads the recruiter.',
    '',
    '       JD says "must hold EU citizenship or work permit" / source does state EU citizenship',
    '         → ✓ "EU citizen" (because source confirms)',
    '       JD says "must have NATO clearance" / source has no clearance information',
    '         → ✗ "NATO-cleared" or "eligible for NATO clearance"',
    '         → ✓ omit',
    '',
    '    3. Industry / technology leakage — JD industry asserted as candidate background',
    '       JD mentions "5G networks" / source has "embedded systems"',
    '         → ✗ "5G experience"',
    '         → ✓ "embedded systems experience" (mention 5G ONLY as a learning area, not as held experience)',
    '',
    '       JD mentions "automotive ECUs" / source has "automotive LiDAR"',
    '         → ✗ "ECU development experience"',
    '         → ✓ "automotive LiDAR experience"',
    '',
    '  Pattern: when JD signal lands outside the candidate\'s real domain, status, or qualification, REFRAME with the candidate\'s actual nearest-equivalent experience. NEVER substitute the JD\'s vocabulary for the candidate\'s. NEVER assert a status (clearance, citizenship, eligibility, certification) that the source does not explicitly confirm.',
    '',
    '  Hiring managers verify claims. A fabricated clearance, citizenship, or domain on a CV/CL eliminates the candidate the moment it is checked. An honest gap, framed as a learning area or omitted entirely, does not.',
  ].join('\n');
}

// ------------------------------------------------------------------
// Per-task augmentation prompts.
// These get PREPENDED to whatever system prompt the PWA provides. The
// PWA's prompt is more specific (carries the user's actual data and
// per-section instructions); the augmentation establishes the frame.
//
// Each augmentation includes a few-shot exemplar drawn from real
// approved output so the model has a concrete pattern to match
// rather than inferring it from rules alone.
// ------------------------------------------------------------------
const TASK_AUGMENTATIONS = {
  cv_outcomes: `[ANTCV TASK: cv_outcomes — Selected Outcomes section of a CV]

ABSOLUTE: an empty Selected Outcomes section is a FAILURE. Aim for 5-6 outcomes; never fewer than 3. Placeholder text ("TBD", "[Outcome]", "Coming soon") is unacceptable.

Each outcome is a verb-led, concrete sentence carrying one specific result. Two halves work as { lead, body }:
- lead  = action verb + 2-5 words (will render bold)        — "Supervised a 7-engineer smartphone optics team"
- body  = scope, method, measurement, or context, 8-20 words  — "from concept to production"

Mix metric and non-metric outcomes. Metrics are great when natural in the source; do NOT fabricate them. Use approximations ("~", "5+", "over") rather than fake precision when the source itself is approximate. Qualitative scope ("across two product lines", "co-led with the safety team") is a fully valid alternative when no metric is honest.

Examples of strong outcomes (each grounded in real candidate experience):
  - "Supervised a 7-engineer smartphone optics team / from concept to production"
  - "Cut change cycle time / from ~250 to 10 days via structured change control"
  - "Achieved a 10x cost reduction / through architecture and design studies"
  - "Co-invented a patented optical window / used in commercial devices"
  - "Built electro-optical labs / for qualification, calibration, and production handoff"
  - "Optimised image quality / using MATLAB, Imatest, and Qualcomm ISP tools"

If the source genuinely lacks material for 5 grounded outcomes, output the 3+ that you CAN ground and explicitly identify the gap. Do NOT pad with vague claims or invent results to hit a count.

${noFabricationBlock()}

${bannedListBlock()}`,

  cv_core_competencies: `[ANTCV TASK: cv_core_competencies — Core Competencies section of a CV]

This is DIFFERENT from a cover-letter "What I Bring" section. Do not conflate them.
- Core Competencies (CV)   = the candidate's PROVEN CAPABILITIES — technical/methodological domains and tools they've demonstrated across their career.
- What I Bring (CL)        = how those strengths MAP TO A SPECIFIC ROLE'S NEEDS, drawn from the job description.

Core Competencies is BACKWARD-looking and ROLE-INDEPENDENT. It inventories what the candidate brings to ANY position, not this one.

OUTPUT: a 6-row table. Each row: { Focus Area: 1-3 words, Strategic Expertise: 1-2 sentences }.
- Focus Area = a technical or methodological domain the candidate has demonstrated ("Camera architecture", "Image quality optimization", "Hardware/software co-design", "Supplier coordination", "Optoelectronic validation", "Production readiness").
- Strategic Expertise = concrete description of that capability, naming specific tools / standards / scopes where natural ("SNR, dynamic range, and MTF analysis using MATLAB, Imatest, and Qualcomm ISP tools").

Examples (all from approved real output):
  - "Camera architecture | system design from concept to production validation"
  - "Image quality optimization | SNR, dynamic range, and MTF analysis using MATLAB, Imatest, and Qualcomm ISP tools."
  - "Hardware/software co-design | Integrated optical, sensor, and ISP solutions with structured bring-up, calibration, tolerance analysis"
  - "Supplier coordination | ODM and module partner management through validation, manufacturing constraints, and ramp-up"

${noFabricationBlock()}

${bannedListBlock()}`,

  cl_what_i_bring: `[ANTCV TASK: cl_what_i_bring — What I Bring section of a COVER LETTER]

This is DIFFERENT from a CV "Core Competencies" section. Do not conflate them.
- What I Bring (CL)        = FORWARD-looking. About this specific opportunity. Focus areas are role-aspects drawn from the job description; expertise rows describe how the candidate would deliver on each.
- Core Competencies (CV)   = backward-looking inventory of capabilities, role-independent. Do NOT produce that here.

OUTPUT: a 4-row table (5 or 6 if the JD is broad). Each row: { Focus Area: 1-4 words, Strategic Expertise: 1-2 sentences }.
- Focus Area = an aspect of the ROLE/COMPANY drawn from the job description (NOT a generic skill name). Examples: "Image Quality Optimization", "Hardware/Software Co-design", "Manufacturing & Supplier Coordination", "Systematic Problem Resolution", "Functional Safety Compliance", "Customer Change Governance".
- Strategic Expertise = how this candidate would deliver in that area, citing relevant prior experience but framed as offer ("Hands-on with autofocus systems, SNR/DR analysis, and ISP tuning using Qualcomm tools, Imatest, and structured measurements").

Examples (from approved cover letter for an Optics/Camera Engineer role):
  - "Image Quality Optimization | Hands-on with autofocus systems, SNR/DR analysis, and ISP tuning using Qualcomm tools, Imatest, and structured measurements."
  - "Hardware/Software Co-design | Multidisciplinary leadership across optics, sensors, FPGA electronics, and embedded systems, with validation tied to measurable criteria"
  - "Manufacturing & Supplier Coordination | ODM partnership management, tolerance analysis, yield optimisation, and production acceptance criteria through structured validation"
  - "Systematic Problem Resolution | Root cause analysis using lab data, measurements, and systematic validation for bring-up, alignment, and performance deviations"

CRITICAL: a Focus Area drawn from the JD is fine. The Strategic Expertise that follows it MUST be grounded in the candidate's actual experience. If the candidate's history doesn't actually cover a focus area you've drawn from the JD, drop that area; do NOT invent fit.

${noFabricationBlock()}

${bannedListBlock()}`,

  cv_profile: `[ANTCV TASK: cv_profile — Profile section of a CV]

OUTPUT: 2-3 tight sentences plus an optional final "Work style: …" clause. Calm, specific, impressive in substance. Numerical metrics are OPTIONAL and should be used sparingly — a profile that reads as impressive through CONCRETE DOMAIN PROSE (specific sectors, technologies, methods) is stronger than one padded with manufactured numbers.

Pattern (in order):
1. IDENTITY — what kind of professional this person is, in their own terms. ("Camera architect and electro-optics engineer")
2. SCOPE — sectors, technologies, and a single duration anchor if natural. ("with 15+ years in consumer cameras, defence electro-optics, and nanotechnology")
3. CAPABILITIES & DISTINCTIVENESS — what they specifically do well; what makes them different from others with the same title. ("Experience spans camera architecture, optics, image sensors, ISP analysis, image quality validation, calibration, and production readiness. Strong in linking design decisions to measured performance, with hands-on experience in supplier coordination, tolerance analysis, camera bring-up, and multidisciplinary development.")
4. OPTIONAL closing — "Work style: <short clause>" — if a clear posture exists in the source. ("Work style: Structured, data-driven engineer focused on validation & alignment.")

Use strong plain verbs: "led", "built", "anchored", "delivered", "shipped", "designed", "owned", "spans". Avoid manufactured metrics — at most ONE natural duration like "15+ years" or "two decades". Forbidden: hype words, vague "wealth of experience", filler transitions.

If the source data is thin, lean on domains worked across, technologies anchored, decisions owned, sustained involvement (years on programmes), interfaces managed. Specificity in the SUBJECT MATTER beats specificity in the numbers.

${noFabricationBlock()}

${bannedListBlock()}`,

  cl_who_i_am: `[ANTCV TASK: cl_who_i_am — WHO I AM section of a COVER LETTER]

OUTPUT: 2-4 sentences in first person ("I am…", "My experience covers…", "Over time, my role has moved into…"). The opening identity statement of the cover letter; sets the candidate's professional self-description before the rest of the letter goes into role-fit details.

Pattern:
1. IDENTITY — what kind of professional ("I am a systems and electro-optics engineer with 15+ years…").
2. DOMAINS — sectors, technologies, application areas the candidate has actually worked in.
3. TRAJECTORY (optional) — how the role has evolved over time ("Over time, my role has moved from hands-on development into leading work across architecture, requirements, suppliers, and stakeholders").

Two real approved examples (different roles, both grounded in the same source CV):

Example A (Optics/Camera Engineer role):
  "Throughout my career, I have established myself as a system architect and electro-optics engineer working extensively with camera systems, optics, sensors, and ISP-related analysis. My experience spans translating complex imaging requirements into practical, high-performing products that meet rigorous performance and manufacturability standards. I have consistently connected advanced optical methodologies to tangible outcomes across consumer, automotive, and defence applications."

Example B (Project Manager / Naval & Defence role):
  "I am a systems and electro-optics engineer with 15+ years of experience across sensing, imaging, hardware development, validation, and change governance. My work has covered automotive LiDAR, camera and display systems, defence electro-optics, and research environments. Over time, my role has moved from hands-on development into leading work across architecture, requirements, suppliers, stakeholders, and delivery decisions."

Notice in Example B: the role is for NAVAL & DEFENCE programmes. The candidate's actual domain is AUTOMOTIVE LiDAR and DEFENCE ELECTRO-OPTICS. The output names those real domains. It does NOT claim "marine systems" or "naval programmes background" or "radar/sonar experience" — even though the JD probably mentions them — because those are not in the candidate's source.

${noFabricationBlock()}

${bannedListBlock()}`,

  cl_why_this_position: `[ANTCV TASK: cl_why_this_position — WHY THIS POSITION section of a COVER LETTER]

OUTPUT: 2-4 sentences explaining what about THIS role and THIS company drew the candidate. Specific to the listing — generic "I am excited about" content is a failure.

Pattern:
1. Name a specific aspect of the role/company that fits the candidate. (Drawn from the JD, named accurately.)
2. Anchor that fit in the candidate's actual experience or working preference.
3. Optionally, name a value/cultural element from the listing that resonates.

Real approved example (Sigma Connectivity / Optics Engineer):
  "Sigma Connectivity's focus on challenging multi-disciplinary connectivity projects aligns precisely with my experience in complex imaging systems. Your emphasis on working across competence areas — from optics through electronics to software development — matches my background leading cross-functional teams and managing the intricate trade-offs that define successful camera products. The opportunity to work on miniaturized systems while maintaining system-level ownership particularly appeals to my experience linking design decisions to tested performance and practical delivery."

Real approved example (HBK / Project Manager Naval & Defence):
  "This role combines people leadership, technical depth, agile execution, and delivery responsibility in a way that fits me well. It calls for someone who can bring hardware, software, firmware, and test together as one team while improving capability, quality, and pace. HBK's focus on ownership, collaboration, continuous improvement, and Safety First also fits the kind of environment I value and try to build."

The HBK example is for NAVAL & DEFENCE PROGRAMMES but does not claim naval/marine experience. It anchors fit in working style ("complex technical work across disciplines") and values ("ownership, collaboration, Safety First") — both of which ARE in the candidate's source.

${noFabricationBlock()}

${bannedListBlock()}`,

  cl_how_i_would_contribute: `[ANTCV TASK: cl_how_i_would_contribute — HOW I WOULD CONTRIBUTE section of a COVER LETTER]

OUTPUT: 3-6 bullets, each beginning with a present-participle or gerund verb ("Leading…", "Coordinating…", "Building…", "Supporting…"), describing concrete contributions the candidate would make in this role. Optionally close with a 1-2 sentence summary of the overall posture.

Each bullet:
- Starts with a verb (Leading / Coordinating / Building / Supporting / Establishing / Implementing / Creating / Managing / Keeping).
- Names a SPECIFIC activity tied to the role.
- Grounds in the candidate's real capability — never invents tools, certifications, or domains.

Real approved example (Optics/Camera Engineer):
  - "Establishing camera architecture frameworks that balance optical performance, module constraints, and manufacturing feasibility through systematic trade-off analysis and validation"
  - "Implementing structured image quality workflows using simulation, lab characterization, and ISP optimization to achieve measurable performance targets across varied use cases"
  - "Building supplier coordination processes that translate design requirements into manufacturable solutions with clear acceptance criteria and tolerance control"
  - "Creating systematic troubleshooting and validation approaches that accelerate bring-up cycles and reduce performance deviation through data-driven root cause analysis"

Real approved example (Project Manager / HBK):
  - "Leading complex technical projects with clear scope, priorities, risks, and follow-through"
  - "Coordinating engineering, operations, suppliers, and customers around shared plans"
  - "Supporting bids, change requests, and solution definition with structured decision material"
  - "Keeping schedule, quality, and compliance visible through clear reporting and review flow"
  - "Managing scope changes and trade-offs with stakeholders across the project lifecycle"
  - "Supporting delivery under pressure with clear decisions, documentation, and communication"

${noFabricationBlock()}

${bannedListBlock()}`,

  cl_foundation: `[ANTCV TASK: cl_foundation — FOUNDATION section of a COVER LETTER]

OUTPUT: two short paragraphs labelled "Hands-on:" and "Professionally:". Establishes the candidate's grounding — what they can do at the technical level (Hands-on) and how they show up at the professional level (Professionally).

Hands-on paragraph:
- Concrete technical work the candidate has actually done.
- Specific tools, environments, methods drawn from the source CV.
- Past tense ("I built…", "I developed…", "I led…").

Professionally paragraph:
- Working posture, decision-making style, communication strengths.
- Where the candidate operates best in an organization.
- Present tense ("I work best where…", "I bring…").

Real approved example (Optics/Camera Engineer):
  Hands-on: My hands-on foundation includes leading a 7-engineer smartphone optics team at Sigma Connectivity in Lund, Sweden, from concept to production. I developed complete optical subsystems, implemented tolerance analysis and validation workflows, built comprehensive EO labs for calibration and testing, and managed image-quality optimization using MATLAB, Imatest, and Qualcomm ISP tools.
  Professionally: My foundation includes electro-optical development at Meprolight, where I built lab capability for qualification and handoff, established alignment and calibration procedures, and developed low-light, thermal, SWIR, and multispectral imaging systems.

Real approved example (Project Manager / HBK):
  Hands-on: Earlier in my career, I worked close to hardware and physics, building labs and test methods for sensing systems across optics, mechanics, electronics, firmware, software, and test.
  Professionally: Today, I work best where technical depth meets structured delivery. I bring calm execution, clear communication, and the ability to align disciplines around sound decisions.

${noFabricationBlock()}

${bannedListBlock()}`,

  cl_general: `[ANTCV TASK: cl_general — Cover Letter content (section unspecified)]

You are generating part of a cover letter. The candidate's standard CL structure has these sections, in order: WHO I AM, WHAT I BRING (table or paragraph), WHY THIS POSITION, HOW I WOULD CONTRIBUTE (bullets), FOUNDATION (Hands-on / Professionally). Match whichever section the user's prompt asks for.

Closing line is "Kind regards," followed by the candidate's name. Never use "I look forward to hearing from you" or similar filler closings.

${noFabricationBlock()}

${bannedListBlock()}`,
};

// ------------------------------------------------------------------
// Task detection.
// Looks at all message content (system + user turns) for signature
// strings. Requires both a task keyword and a generation verb to
// avoid false positives on e.g. discussion or analysis requests that
// happen to mention "Profile" or "Selected Outcomes".
// ------------------------------------------------------------------

function collectAllText(parsed) {
  // Anthropic format: { system: string|array, messages: [{role, content}] }
  // OpenAI format:    { messages: [{role: 'system'|'user'|..., content}] }
  // Gemini format:    { systemInstruction: ..., contents: [{role, parts:[{text}]}] }
  // We support all three even though the PWA usually sends Anthropic.
  const parts = [];

  const sys = parsed.system;
  if (typeof sys === 'string') parts.push(sys);
  else if (Array.isArray(sys)) {
    for (const item of sys) {
      if (typeof item === 'string') parts.push(item);
      else if (item && typeof item.text === 'string') parts.push(item.text);
    }
  }

  if (parsed.systemInstruction) {
    const si = parsed.systemInstruction;
    if (typeof si === 'string') parts.push(si);
    else if (si.parts) {
      for (const p of si.parts) if (p && typeof p.text === 'string') parts.push(p.text);
    } else if (typeof si.text === 'string') parts.push(si.text);
  }

  const messages = Array.isArray(parsed.messages) ? parsed.messages : [];
  for (const m of messages) {
    if (!m) continue;
    const c = m.content;
    if (typeof c === 'string') parts.push(c);
    else if (Array.isArray(c)) {
      for (const block of c) {
        if (typeof block === 'string') parts.push(block);
        else if (block && typeof block.text === 'string') parts.push(block.text);
      }
    }
  }

  // Gemini contents
  if (Array.isArray(parsed.contents)) {
    for (const c of parsed.contents) {
      if (c && Array.isArray(c.parts)) {
        for (const p of c.parts) if (p && typeof p.text === 'string') parts.push(p.text);
      }
    }
  }

  return parts.join('\n');
}

export function detectCVTask(parsed) {
  const text = collectAllText(parsed).toLowerCase();
  if (!text) return null;

  // Generation verbs anywhere in the prompt.
  const isGen = /\b(generate|generat\w+|compose|writ\w+|produce|draft\w*|create|enrich\w*|expand\w*|rewrite|regenerate|fill in|fill out)\b/.test(text);
  if (!isGen) return null;

  // Cover-letter context flag — used to disambiguate sections that
  // could otherwise be CV. ("Profile" appears in both CV and CL/LinkedIn
  // contexts; "What I Bring" only in CL; the rest are CL-named.)
  const isCLContext = /\b(cover\s+letter|application\s+letter|cl_table|cl_section|cl_general)\b/.test(text);

  // ---- CL-specific section signatures ------------------------------
  // Most-specific first. Section names are capitalized in the PWA
  // template ("WHO I AM", "WHAT I BRING") so we match the lowercased
  // form with word-boundary anchors.

  if (/\bwhat\s+i\s+bring\b/.test(text)) return 'cl_what_i_bring';

  // CL paraphrased: cover-letter context + competency-like table phrasing
  // (no literal "what i bring" string). Catches PWA prompts that ask for
  // a focus-area / strategic-expertise table tailored to the JD.
  if (isCLContext && /\b(focus\s+area|strategic\s+expertise|competenc\w+|what\s+i\s+offer)\b/.test(text)) {
    return 'cl_what_i_bring';
  }

  if (/\bwho\s+i\s+am\b/.test(text)) return 'cl_who_i_am';
  if (/\bwhy\s+this\s+(position|role|opportunity|company)\b/.test(text)) return 'cl_why_this_position';
  if (/\bhow\s+i\s+would\s+contribute\b/.test(text)) return 'cl_how_i_would_contribute';
  if (isCLContext && /\bfoundation\b/.test(text)) return 'cl_foundation';
  if (isCLContext && /\b(hands.?on|professionally)\s*[:—–-]/.test(text)) return 'cl_foundation';

  // ---- CV-specific section signatures ------------------------------
  if (/\bselected\s+outcomes?\b/.test(text)) return 'cv_outcomes';
  if (/\bcore\s+competenc(?:y|ies)\b/.test(text)) return 'cv_core_competencies';

  // Profile detection — must be CV context AND mention the section.
  if (/\bprofile\b/.test(text) && /\b(cv|résumé|resume|candidate)\b/.test(text)) return 'cv_profile';

  // ---- Catch-all for unspecified CL content ------------------------
  // If the prompt is clearly cover-letter related but doesn't match any
  // specific section above, return cl_general so the no-fabrication
  // and editorial blocks still apply. Better to over-augment than
  // under-augment when CL hallucinations are the failure mode we just
  // got bitten by.
  if (isCLContext) return 'cl_general';

  return null;
}

// ------------------------------------------------------------------
// Augment a parsed body with the task-specific system prompt.
// Mutates and returns the parsed object. Caller is responsible for
// re-stringifying.
// ------------------------------------------------------------------
export function applyTaskAugmentation(parsed, task) {
  const aug = TASK_AUGMENTATIONS[task];
  if (!aug) return parsed;

  // Anthropic Messages format: top-level `system` field.
  if ('system' in parsed || Array.isArray(parsed.messages)) {
    const existing = parsed.system;
    if (typeof existing === 'string') {
      parsed.system = `${aug}\n\n---\n\n${existing}`;
    } else if (Array.isArray(existing)) {
      // Array-of-blocks form: prepend an extra block.
      parsed.system = [{ type: 'text', text: aug }, ...existing];
    } else {
      parsed.system = aug;
    }
    return parsed;
  }

  // Gemini: systemInstruction
  if (parsed.contents !== undefined || parsed.systemInstruction !== undefined) {
    const existing = parsed.systemInstruction;
    if (existing && Array.isArray(existing.parts)) {
      parsed.systemInstruction = {
        ...existing,
        parts: [{ text: aug }, ...existing.parts],
      };
    } else if (typeof existing === 'string') {
      parsed.systemInstruction = `${aug}\n\n---\n\n${existing}`;
    } else if (existing && typeof existing.text === 'string') {
      parsed.systemInstruction = { ...existing, text: `${aug}\n\n---\n\n${existing.text}` };
    } else {
      parsed.systemInstruction = { parts: [{ text: aug }] };
    }
    return parsed;
  }

  // OpenAI: prepend a system message.
  if (Array.isArray(parsed.messages)) {
    // (already handled above via `system in parsed` branch when present)
  } else {
    parsed.messages = [];
  }

  return parsed;
}

// ------------------------------------------------------------------
// Top-level augment-and-stringify. Returns:
//   { bodyText, task }
// where `task` is the detected task name or null. The caller can use
// `task` to set a response header (X-AntCV-Task) for observability.
// ------------------------------------------------------------------
export function augmentBodyText(bodyText) {
  let parsed;
  try { parsed = JSON.parse(bodyText); }
  catch { return { bodyText, task: null }; }
  if (!parsed || typeof parsed !== 'object') return { bodyText, task: null };

  const task = detectCVTask(parsed);
  if (!task) return { bodyText, task: null };

  applyTaskAugmentation(parsed, task);
  return { bodyText: JSON.stringify(parsed), task };
}
