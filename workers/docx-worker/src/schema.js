// Minimal hand-rolled validator. Keeps the worker dependency-free
// (no ajv or zod), gives clear error messages, and rejects payloads
// before they reach docx-js where errors are opaque.

const VALID_TYPES = new Set([
  'text', 'text_inline', 'text_bullets', 'foundation',
  'bullets', 'table', 'experience',
  'list', 'list_italic', 'labeled_list', 'education',
]);

const VALID_DOC = new Set(['cv', 'cl']);
const VALID_LOC = new Set(['main', 'sidebar']);
const VALID_LANG = new Set(['en', 'da']);
const VALID_LAYOUT = new Set(['two_column', 'linear']);

export function validatePayload(p) {
  const errs = [];

  if (!p || typeof p !== 'object') {
    return ['payload must be a JSON object'];
  }

  if (p.schema_version && p.schema_version !== '1.0') {
    errs.push(`unsupported schema_version: ${p.schema_version} (this worker speaks 1.0)`);
  }

  if (!VALID_DOC.has(p.doc)) {
    errs.push(`doc must be one of: cv, cl (got: ${JSON.stringify(p.doc)})`);
  }

  if (p.language && !VALID_LANG.has(p.language)) {
    errs.push(`language must be one of: en, da`);
  }

  if (p.layout && !VALID_LAYOUT.has(p.layout)) {
    errs.push(`layout must be one of: two_column, linear`);
  }

  if (!p.personal_info || typeof p.personal_info !== 'object') {
    errs.push('personal_info object is required');
  } else {
    const pi = p.personal_info;
    if (pi.photo_b64 && typeof pi.photo_b64 !== 'string') {
      errs.push('personal_info.photo_b64 must be a base64 string');
    }
    if (pi.photo_b64 && pi.photo_b64.length > 1_500_000) {
      // Raised from 350KB → 1.5MB (Jan 2026). The v1.05 PWA bake
      // produces 600×600 PNGs with a 1pt teal stroke, which can
      // exceed 256KB decoded when the source photo has high-detail
      // backgrounds. 1.5MB b64 ≈ 1.1MB binary covers any realistic
      // headshot at 600×600 or 800×800 with comfortable headroom
      // while still rejecting an accidentally-pasted full-document
      // PDF or multi-megapixel raw photo.
      errs.push('personal_info.photo_b64 too large (max ~1.1MB decoded)');
    }
  }

  if (!Array.isArray(p.sections)) {
    errs.push('sections must be an array');
    return errs; // can't validate further without it
  }

  p.sections.forEach((s, i) => {
    const ctx = `sections[${i}]`;
    if (!s || typeof s !== 'object') {
      errs.push(`${ctx} must be an object`);
      return;
    }
    if (typeof s.id !== 'string' || !s.id) {
      errs.push(`${ctx}.id must be a non-empty string`);
    }
    if (typeof s.title !== 'string') {
      errs.push(`${ctx}.title must be a string`);
    }
    if (s.loc && !VALID_LOC.has(s.loc)) {
      errs.push(`${ctx}.loc must be one of: main, sidebar`);
    }
    if (!VALID_TYPES.has(s.type)) {
      errs.push(`${ctx}.type must be one of: ${[...VALID_TYPES].join(', ')} (got: ${s.type})`);
      return;
    }

    // Type-specific shape checks
    switch (s.type) {
      case 'text':
      case 'text_inline':
        if (s.content != null && typeof s.content !== 'string') {
          errs.push(`${ctx}.content must be a string`);
        }
        break;

      case 'text_bullets':
        if (s.intro != null && typeof s.intro !== 'string') errs.push(`${ctx}.intro must be string`);
        if (s.items != null && !Array.isArray(s.items)) errs.push(`${ctx}.items must be array`);
        if (s.closing != null && typeof s.closing !== 'string') errs.push(`${ctx}.closing must be string`);
        break;

      case 'foundation':
        if (s.hands_on != null && typeof s.hands_on !== 'string') errs.push(`${ctx}.hands_on must be string`);
        if (s.professionally != null && typeof s.professionally !== 'string') errs.push(`${ctx}.professionally must be string`);
        break;

      case 'bullets':
        if (!Array.isArray(s.items)) errs.push(`${ctx}.items must be an array`);
        break;

      case 'table':
        if (!Array.isArray(s.rows)) errs.push(`${ctx}.rows must be an array`);
        else {
          s.rows.forEach((r, j) => {
            if (!Array.isArray(r)) errs.push(`${ctx}.rows[${j}] must be an array of cells`);
          });
        }
        break;

      case 'experience':
        if (!Array.isArray(s.roles)) errs.push(`${ctx}.roles must be an array`);
        else {
          s.roles.forEach((r, j) => {
            if (!r || typeof r !== 'object') {
              errs.push(`${ctx}.roles[${j}] must be an object`);
              return;
            }
            if (typeof r.title !== 'string') errs.push(`${ctx}.roles[${j}].title must be string`);
            if (r.bullets != null && !Array.isArray(r.bullets)) {
              errs.push(`${ctx}.roles[${j}].bullets must be array`);
            }
          });
        }
        break;

      case 'list':
      case 'list_italic':
        if (!Array.isArray(s.items)) errs.push(`${ctx}.items must be an array`);
        break;

      case 'labeled_list':
        if (!Array.isArray(s.items)) errs.push(`${ctx}.items must be an array`);
        else {
          s.items.forEach((it, j) => {
            if (!it || typeof it !== 'object') {
              errs.push(`${ctx}.items[${j}] must be {l, v}`);
            }
          });
        }
        break;

      case 'education':
        if (!Array.isArray(s.items)) errs.push(`${ctx}.items must be an array`);
        else {
          s.items.forEach((it, j) => {
            if (!it || typeof it !== 'object') {
              errs.push(`${ctx}.items[${j}] must be {deg, sch}`);
            }
          });
        }
        break;
    }
  });

  return errs;
}
