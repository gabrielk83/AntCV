/* antcv-kernel-ingest.js — IMPORT-INGEST / CONFLICT / GAP (kernel v2 §4)
 * ============================================================================
 * Deterministic, UI-free ingestion ENGINE for shaping an uploaded CV (already
 * extracted to text) into the v2 kernel schema, and for create/append-merge into
 * an existing kernel. Pure functions — no DOM, no localStorage, no network — so it
 * is fully node-testable and cannot brick the app. The file→text extraction
 * (docx/pdf/OCR) and the wizard/modal UI wire ONTO this engine in later slices.
 *
 * HARD RULE (brief §4b/4c): STRUCTURAL INFERENCE ONLY. We infer isCurrent from a
 * date, flag merge CANDIDATES, detect source language, apply new-user defaults — and
 * we NEVER invent outcomes, proof points, scope, or metrics. Absent substantive
 * content is a GAP, surfaced for the user, never auto-filled.
 *
 * IDs: IMPORT-INGEST-001 (extract + structural inference), IMPORT-CONFLICT-001
 * (keep-both-and-flag, never auto-overwrite metrics), IMPORT-GAP-001 (flag, ask,
 * never fabricate), ONBOARD-LANG-001 (new-user activeDefaults = detected sourceLang).
 */

// ── small helpers ───────────────────────────────────────────────────────────
const PRESENT_RE = /\b(present|nu(v[ae]rende)?|current|ongoing|today|heute|actuel|aktuell)\b/i;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const DATE_SPAN_RE = /((?:19|20)\d{2})\s*[–—\-to]+\s*((?:19|20)\d{2}|present|nu(?:v[ae]rende)?|current|ongoing|today)/i;
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const hasMetric = (s) => /\d|%|×|\bx\b|€|\$|£/.test(String(s || ''));

// ── source language detection (best-effort, lightweight) ─────────────────────
const LANG_HINTS = {
  da: /\b(og|til|med|virksomhed|erfaring|ansvar|udvikling|projekt|nuværende|års)\b/gi,
  es: /\b(y|de|con|empresa|experiencia|desarrollo|proyecto|actualidad|años)\b/gi,
  de: /\b(und|mit|für|unternehmen|erfahrung|entwicklung|projekt|jahre)\b/gi,
  fr: /\b(et|avec|pour|entreprise|expérience|développement|projet|ans)\b/gi,
};
export function detectSourceLang(text) {
  const t = String(text || '');
  let best = 'en', bestN = 0;
  for (const [lang, re] of Object.entries(LANG_HINTS)) {
    const n = (t.match(re) || []).length;
    if (n > bestN) { bestN = n; best = lang; }
  }
  // require a minimum signal before overriding the English default.
  return bestN >= 3 ? best : 'en';
}

// ── 4a: parse already-extracted CV TEXT into a draft kernel ──────────────────
// Heuristic, format-tolerant. Recognises an EXPERIENCE block and roles carrying a
// year span; lines under a role become its scope[]. Conservative: anything it is
// unsure about is left absent (→ a GAP), never guessed.
const SECTION_HEADS = {
  experience: /^(work experience|professional experience|experience|employment|work history|erhvervserfaring|erfaring)\s*:?\s*$/i,
  education: /^(education|uddannelse|academic)\s*:?\s*$/i,
  skills: /^(skills|tools|tools (&|and) methods|kompetencer|technical skills)\s*:?\s*$/i,
};
export function parseTextToDraft(text) {
  const lines = String(text || '').split(/\r?\n/).map((l) => l.replace(/\s+$/, ''));
  const draft = { personalInfo: {}, experience: [], education: [], _rawLang: detectSourceLang(text) };
  // personalInfo — email/phone/name from the head.
  const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0];
  const phone = (text.match(/(\+?\d[\d\s().-]{6,}\d)/) || [])[0];
  if (email) draft.personalInfo.email = email;
  if (phone) draft.personalInfo.phone = phone.trim();
  const firstReal = lines.find((l) => l.trim() && !/@|\d{3}/.test(l));
  if (firstReal) draft.personalInfo.name = firstReal.trim();

  // walk sections
  let section = null;
  let cur = null;
  const pushRole = () => { if (cur && (cur.title || cur.company)) draft.experience.push(cur); cur = null; };
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;
    let head = null;
    for (const [k, re] of Object.entries(SECTION_HEADS)) if (re.test(line)) head = k;
    if (head) { pushRole(); section = head; continue; }
    if (section !== 'experience') continue;
    const span = line.match(DATE_SPAN_RE);
    const isBullet = /^[\-•*·●▪]/.test(raw) || /^\s{2,}\S/.test(raw);
    if (span && !isBullet) {
      // a new role header line: "Title — Company (2020 – Present)" / "Title, Company  2020-2023"
      pushRole();
      const start = span[1];
      const endRaw = span[2];
      const isCurrent = PRESENT_RE.test(endRaw);
      const head2 = line.replace(span[0], '').replace(/[()–—|,;:•]+\s*$/, '').replace(/^\s*[|,;:]\s*/, '').trim();
      // split title / company on the first " — ", " - ", " at ", ", " or " | "
      const m = head2.split(/\s+[–—|]\s+|\s+-\s+|\s+at\s+|\s*,\s*/);
      cur = {
        title: (m[0] || '').trim(),
        company: (m.slice(1).join(', ') || '').trim(),
        start, end: isCurrent ? 'present' : endRaw,
        isCurrent, on: true, scope: [], outcomes: [], proofPoints: [],
      };
    } else if (cur) {
      const t = line.replace(/^[\-•*·●▪]\s*/, '').trim();
      if (t) cur.scope.push(t);
    }
  }
  pushRole();
  return draft;
}

// ── 4b/4e: structural inference + new-user defaults (NO fabrication) ──────────
const IDF_HIDE_RE = /\b(idf|military|army|navy|conscript|national service|security guard|dormitor|student council|students council|teaching assistant)\b/i;
export function inferStructural(draft, opts = {}) {
  const out = JSON.parse(JSON.stringify(draft || {}));
  const exp = Array.isArray(out.experience) ? out.experience : (out.experience = []);
  exp.forEach((r) => {
    // isCurrent from the date flag (never invent) — only set if not already explicit.
    if (typeof r.isCurrent !== 'boolean') r.isCurrent = PRESENT_RE.test(String(r.end || ''));
    if (typeof r.on !== 'boolean') r.on = true;
    // GEN-IDF-001 default hide heuristic — a DEFAULT the user can flip, not a delete.
    if (IDF_HIDE_RE.test(((r.title || '') + ' ' + (r.company || '')))) r.on = false;
    // langInvariantTokens — best-effort: proper nouns already present (company) + any
    // metric-bearing token in scope. Never translated downstream. User can correct.
    if (!Array.isArray(r.langInvariantTokens)) r.langInvariantTokens = [];
    if (r.company && r.langInvariantTokens.indexOf(r.company) < 0) r.langInvariantTokens.push(r.company);
  });
  // merge-group CANDIDATES (do NOT auto-merge): same company + overlapping years.
  out._mergeCandidates = [];
  for (let i = 0; i < exp.length; i++) for (let j = i + 1; j < exp.length; j++) {
    if (norm(exp[i].company) && norm(exp[i].company) === norm(exp[j].company) && yearsOverlap(exp[i], exp[j])) {
      out._mergeCandidates.push([exp[i].id || i, exp[j].id || j]);
    }
  }
  // new-user defaults (ONBOARD-LANG-001): only when creating, never inherit owner's set.
  const lang = opts.sourceLang || out._rawLang || detectSourceLang(JSON.stringify(out));
  if (!out.tenseMode) out.tenseMode = 'auto';
  if (!out.language) out.language = { sourceLang: lang, activeDefaults: [lang] };
  return out;
}
function yearsNums(r) { return [r.start, r.end].map((x) => { const m = String(x || '').match(YEAR_RE); return m ? +m[0] : (PRESENT_RE.test(String(x)) ? 9999 : null); }).filter((n) => n != null); }
function yearsOverlap(a, b) { const ya = yearsNums(a), yb = yearsNums(b); if (!ya.length || !yb.length) return false; return Math.min(...ya) <= Math.max(...yb) && Math.min(...yb) <= Math.max(...ya); }

// ── 4c: gap detection (IMPORT-GAP-001) — flag, never fabricate ───────────────
export function detectGaps(kernel) {
  const exp = (kernel && Array.isArray(kernel.experience)) ? kernel.experience : [];
  const gaps = [];
  exp.forEach((r, i) => {
    const missing = [];
    if (!(Array.isArray(r.scope) && r.scope.length)) missing.push('scope');
    if (!(Array.isArray(r.outcomes) && r.outcomes.filter((o) => o && (o.result || o.title)).length)) missing.push('outcomes');
    if (!(Array.isArray(r.proofPoints) && r.proofPoints.length)) missing.push('proofPoints');
    if (!String(r.start || '').trim() || !String(r.end || '').trim()) missing.push('dates');
    if (missing.length) gaps.push({ id: r.id || i, role: r.title || ('role ' + (i + 1)), company: r.company || '', missing });
  });
  return gaps;
}

// ── 4d: create vs append/merge with keep-both-and-flag (IMPORT-CONFLICT-001) ──
function sameRole(a, b) {
  if (a.id && b.id && a.id === b.id) return true;
  return norm(a.title) && norm(a.title) === norm(b.title) && norm(a.company) === norm(b.company) && yearsOverlap(a, b);
}
export function mergeKernels(existing, incoming) {
  if (!existing || !Array.isArray(existing.experience) || !existing.experience.length) {
    return { kernel: incoming, mode: 'create', conflicts: [], added: (incoming.experience || []).map((r) => r.id || r.title) };
  }
  const merged = JSON.parse(JSON.stringify(existing));
  merged.experience = Array.isArray(merged.experience) ? merged.experience : [];
  const conflicts = [];
  const added = [];
  (incoming.experience || []).forEach((inc) => {
    const idx = merged.experience.findIndex((ex) => sameRole(ex, inc));
    if (idx < 0) { merged.experience.push(inc); added.push(inc.id || inc.title); return; }
    const ex = merged.experience[idx];
    // CONFLICT on any differing date / title / metric → KEEP BOTH (existing value
    // stays) + FLAG for the resolution modal. NEVER auto-overwrite, especially metrics.
    const fields = [];
    if (norm(ex.title) !== norm(inc.title)) fields.push({ field: 'title', existing: ex.title, incoming: inc.title });
    if (String(ex.start) !== String(inc.start) || String(ex.end) !== String(inc.end)) fields.push({ field: 'dates', existing: ex.start + '–' + ex.end, incoming: inc.start + '–' + inc.end });
    const exMetric = (ex.outcomes || []).map((o) => o && o.result).filter(hasMetric).join(' | ');
    const incMetric = (inc.outcomes || []).map((o) => o && o.result).filter(hasMetric).join(' | ');
    if (exMetric !== incMetric && incMetric) fields.push({ field: 'metrics', existing: exMetric, incoming: incMetric });
    if (fields.length) conflicts.push({ id: ex.id || inc.id || inc.title, role: ex.title, company: ex.company, fields });
    // non-conflicting NEW prose/scope merges in (additive, no overwrite).
    const exScope = new Set((ex.scope || []).map(norm));
    (inc.scope || []).forEach((s) => { if (s && !exScope.has(norm(s))) (ex.scope = ex.scope || []).push(s); });
  });
  return { kernel: merged, mode: 'merge', conflicts, added };
}

// ── orchestrator: text + existing → { kernel, conflicts, gaps, mode } ─────────
export function ingest(text, existingKernel, opts = {}) {
  const draft = parseTextToDraft(text);
  const incoming = inferStructural(draft, { sourceLang: opts.sourceLang || draft._rawLang });
  const { kernel, mode, conflicts, added } = mergeKernels(existingKernel, incoming);
  const gaps = detectGaps(kernel);
  return { kernel, mode, conflicts, added, gaps, sourceLang: incoming.language && incoming.language.sourceLang };
}

// ── Slice 2: file → text (browser-only; reuses the app's PDF.js + mammoth) ───
// Defined but never called at import time, so node tests of the PURE functions
// above are unaffected. txt/json paths are node-testable with a File-like stub.
export function detectImportKind(file) {
  const name = String((file && file.name) || '').toLowerCase();
  const type = String((file && file.type) || '').toLowerCase();
  if (/\.json$/.test(name) || /application\/json/.test(type)) return 'json';
  if (/\.(txt|md|text)$/.test(name) || /text\/plain/.test(type)) return 'text';
  if (/\.docx$/.test(name) || /wordprocessingml/.test(type)) return 'docx';
  if (/\.pdf$/.test(name) || /pdf/.test(type)) return 'pdf';
  if (/\.(png|jpe?g|webp)$/.test(name) || /^image\//.test(type)) return 'image';
  return 'unknown';
}
export async function extractTextFromFile(file) {
  const kind = detectImportKind(file);
  if (kind === 'text' || kind === 'json') return await file.text();
  if (kind === 'docx') {
    if (typeof window === 'undefined' || !window.loadMammoth) throw new Error('DOCX support not ready — open a DOCX export in the app once to load mammoth, then retry.');
    const mammoth = await window.loadMammoth();
    const ab = await file.arrayBuffer();
    return (await mammoth.extractRawText({ arrayBuffer: ab })).value || '';
  }
  if (kind === 'pdf') {
    if (typeof window === 'undefined') throw new Error('PDF extraction requires the browser.');
    if (!window.pdfjsLib && window.loadPdfjs) { try { await window.loadPdfjs(); } catch (_) {} }
    if (!window.pdfjsLib) throw new Error('PDF support not ready — open a CV in the app once to load PDF.js, then retry.');
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    let out = ''; const lim = Math.min(pdf.numPages, 20);
    for (let i = 1; i <= lim; i++) { const pg = await pdf.getPage(i); const tc = await pg.getTextContent(); out += tc.items.map((it) => it.str).join(' ') + '\n'; }
    return out;
  }
  if (kind === 'image') {
    // OCR path: the JD OCR sidecar exposes a recogniser when loaded.
    if (typeof window !== 'undefined' && window.AntcvOcrImage) return await window.AntcvOcrImage(file);
    throw new Error('Image OCR not ready — for now export your CV as .docx, .pdf, or .txt.');
  }
  throw new Error('Unsupported file for kernel import. Use .docx, .pdf, .txt, or a kernel .json.');
}
// extract → ingest. A raw kernel .json bypasses the heuristic parser (it is already
// the schema) and goes straight to create/merge.
export async function ingestFile(file, existingKernel, opts = {}) {
  if (detectImportKind(file) === 'json') {
    let obj = null; try { obj = JSON.parse(await file.text()); } catch (_) {}
    if (obj && Array.isArray(obj.experience)) {
      const incoming = inferStructural(obj, opts);
      const { kernel, mode, conflicts, added } = mergeKernels(existingKernel, incoming);
      return { kernel, mode, conflicts, added, gaps: detectGaps(kernel), sourceLang: incoming.language && incoming.language.sourceLang };
    }
  }
  return ingest(await extractTextFromFile(file), existingKernel, opts);
}

// browser global (UI slices call window.AntcvKernelIngest); harmless in node.
try { if (typeof window !== 'undefined') window.AntcvKernelIngest = { ingest, ingestFile, extractTextFromFile, detectImportKind, parseTextToDraft, inferStructural, detectGaps, mergeKernels, detectSourceLang }; } catch (_) {}
