/* AntCV Data Importer (v1.0)
 * ============================================================
 * Adds an "Import user settings from raw data" feature without
 * touching the React bundle. Loads as a sibling to antcv-overlay.js.
 *
 * What it does
 * ------------
 *   - Floating 📥 button (bottom-left by default)
 *   - On click: opens a modal explaining the feature
 *   - File picker accepts .json, .pdf, .docx, .png, .jpg, .jpeg, .webp
 *   - Routes each file to the right localStorage slot:
 *       JSON (full settings export) → top-level merge
 *       JSON (personalInfo fragment) → personalInfo merge
 *       LinkedIn PDF                 → profileDoc + personalInfo + memoryDigest
 *       CV PDF/DOCX                  → personalInfo + memoryDigest
 *       VIA assessment PDF           → personalInfo.workStyle + stylePrefs
 *       Banned-words DOCX            → wordsDoc + stylePrefs.banned_*
 *       Skills DOCX                  → skillsDoc + personalInfo.tools
 *       Publication / patent PDF     → personalInfo.publicationsStructured
 *       Image                        → photo (after resize)
 *   - Diff modal with per-field checkboxes
 *   - On accept: writes via the PWA's JSON-encoded localStorage scheme,
 *     fires a storage event so the React app re-hydrates
 *
 * Architecture
 * ------------
 *   - Vanilla JS, no React dependencies
 *   - Reads/writes localStorage using the PWA's convention:
 *       set: localStorage.setItem(k, JSON.stringify(v))
 *       get: JSON.parse(localStorage.getItem(k))
 *   - LLM calls go through the cv-proxy (resolved from localStorage
 *     proxyUrl) using the same shape as the rest of the PWA expects
 *     — endpoint /v1/messages, JSON body with model + messages
 *   - PDF text via PDF.js if available on window; DOCX text via
 *     window.loadMammoth() which the PWA already exposes
 *
 * Config (window.AntCVImporterConfig before script tag, optional):
 *   {
 *     proxyUrl: 'https://cv-proxy.workers.dev',   // override LS lookup
 *     position: 'bottom-left',
 *     maxPdfChars: 18000,
 *     anchorSettingsTab: true,                    // also inject a
 *                                                  // block into the
 *                                                  // Personal tab
 *   }
 */
(function () {
  'use strict';

  // ─── Config ─────────────────────────────────────────────────────
  const userCfg = (typeof window !== 'undefined' && window.AntCVImporterConfig) || {};
  const CFG = Object.assign({
    proxyUrl: '',
    position: 'bottom-left',
    maxPdfChars: 18000,
    anchorSettingsTab: true,
    bottomOffset: 100,
    leftOffset: 16,
  }, userCfg);

  function readLsString(key) {
    try {
      let v = localStorage.getItem(key);
      if (!v) return '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return v;
    } catch (_) { return ''; }
  }

  function resolveProxyUrl() {
    if (CFG.proxyUrl) return CFG.proxyUrl.replace(/\/+$/, '');
    const v = readLsString('proxyUrl').replace(/\/+$/, '');
    return v || '';
  }

  // ─── Storage helpers (PWA's JSON-encoded convention) ────────────
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        if (raw == null) return fallback;
        return JSON.parse(raw);
      } catch (_) { return fallback; }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        // Trigger a storage event so other tabs / parts react.
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(value) }));
      } catch (e) { console.error('[importer] set failed', key, e); }
    },
  };

  // Top-level keys the importer can write to. Anything outside this set
  // is ignored when merging a full settings JSON, as a defence-in-depth.
  const ALLOWED_TOP_KEYS = new Set([
    'photo', 'profileDoc', 'skillsDoc', 'wordsDoc', 'danishDoc',
    'memoryDigest', 'memoryDigestHash', 'personalInfo',
    'language', 'navyColor', 'fontSizes', 'lineTargets',
    'cvTableRatio', 'clTableRatio', 'consensusEnabled',
    'formatSettings', 'contactFieldDefinitions',
    // DIRECT-JSON-IMPORT-001 (owner 2026-06-14): a dropped JSON that carries a
    // full `sections` block (cv/cl) is imported VERBATIM - the cv/cl arrays
    // REPLACE the stored ones (mergePath returns the source array when there is
    // no dedup key for sections.cv/sections.cl), so merged roles, corrected
    // dates, and new sidebar subsections (Languages, Interests) survive intact
    // instead of being re-derived by the LLM parser.
    'sections',
  ]);

  // ─── File-kind detection ────────────────────────────────────────
  const KIND_FROM_NAME = [
    [/linkedin.*\.pdf$/i,                                  'linkedin-pdf'],
    [/(via|character.?strengths).*\.pdf$/i,                'via-pdf'],
    [/work.?example|portfolio|case.?stud/i,                'work-examples-pdf'],
    [/patent|publication/i,                                'publication-pdf'],
    [/(cv|resume|curriculum).*\.(pdf|docx)$/i,             'cv-doc'],
    [/skills?.*\.docx$/i,                                  'skills-docx'],
    [/(disliked|banned|avoid).*words?|words.*avoid/i,      'words-docx'],
    [/danish|dansk/i,                                      'danish-docx'],
  ];

  function detectFromContent(text) {
    const t = text.slice(0, 2000);
    if (/character strengths report|signature strengths|^\s*via\b/i.test(t)) return 'via-pdf';
    if (/words and phrases to avoid|buzzwords and vague corporate/i.test(t)) return 'words-docx';
    if (/patent application publication|claim \d+|cover window/i.test(t))    return 'publication-pdf';
    if (/work history|professional experience|professional summary/i.test(t)) return 'cv-doc';
    return null;
  }

  function detectKind(file, sampleText) {
    const ext  = (file.name.split('.').pop() || '').toLowerCase();
    const name = file.name.toLowerCase();
    if (ext === 'json') return 'json';
    if (['png','jpg','jpeg','webp'].indexOf(ext) >= 0) return 'image';
    for (const [re, kind] of KIND_FROM_NAME) if (re.test(name)) return kind;
    if (sampleText) {
      const sniff = detectFromContent(sampleText);
      if (sniff) return sniff;
    }
    if (ext === 'pdf')  return 'generic-pdf';
    if (ext === 'docx') return 'generic-docx';
    return 'unsupported';
  }

  // ─── Banned-words parser ─────────────────────────────────────────
  function parseBannedWordsDoc(text) {
    const lines = text.split(/\n+/).map(s => s.trim()).filter(Boolean);
    const out = { words: [], phrases: [], patterns: [] };
    let bucket = 'words';
    for (const line of lines) {
      const low = line.toLowerCase();
      if (/^(words and phrases to avoid|buzzwords|cv, profile|formatting, punctuation)/.test(low)) {
        bucket = 'words'; continue;
      }
      if (/^(artificial|self-promoting|sentence patterns)/.test(low)) {
        bucket = 'phrases'; continue;
      }
      if (/^(structural|tone|formatting)/.test(low)) {
        bucket = 'patterns'; continue;
      }
      if (low.includes('compiled from') || low.includes('this document captures')) continue;
      if (line.endsWith('…') || line.endsWith('...')) {
        out.phrases.push(line);
      } else if (line.split(/\s+/).length > 5) {
        out.patterns.push(line);
      } else {
        out.words.push(line);
      }
    }
    return out;
  }

  // ─── Text extraction ─────────────────────────────────────────────
  async function fileToBase64(file) {
    const buf = await file.arrayBuffer();
    let bin = '';
    const bytes = new Uint8Array(buf);
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  }

  async function fileToDataURL(file) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(file);
    });
  }

  async function extractPdfText(file) {
    // The PWA exposes window.pdfjsLib once loaded (it uses PDF.js).
    if (!window.pdfjsLib && window.loadPdfjs) {
      try { await window.loadPdfjs(); } catch (_) {}
    }
    if (!window.pdfjsLib) {
      throw new Error('PDF.js not loaded. Open a CV in the main app first so PDF.js initialises, then retry.');
    }
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await window.pdfjsLib.getDocument({ data }).promise;
    let out = '';
    const limit = Math.min(pdf.numPages, 15);
    for (let i = 1; i <= limit; i++) {
      const page = await pdf.getPage(i);
      const tc   = await page.getTextContent();
      out += tc.items.map(it => it.str).join(' ') + '\n';
    }
    return out;
  }

  async function extractDocxText(file) {
    if (!window.loadMammoth) {
      throw new Error('mammoth not loaded. Open a DOCX export option in the main app first to initialise it, then retry.');
    }
    const mammoth = await window.loadMammoth();
    const ab = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: ab });
    return result.value || '';
  }

  // ─── LLM call (via cv-proxy /v1/messages) ───────────────────────
  async function callLLM(prompt) {
    const url = resolveProxyUrl();
    if (!url) throw new Error('No proxy URL configured. Open Settings → API and set the cv-proxy URL.');
    const body = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    };
    const res = await fetch(url + '/v1/messages', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`LLM error ${res.status}: ${raw.slice(0, 300)}`);
    let j; try { j = JSON.parse(raw); } catch { throw new Error('Non-JSON LLM response: ' + raw.slice(0, 200)); }
    const content = j.content && j.content[0] && j.content[0].text;
    if (!content) throw new Error('Empty LLM response');
    return content;
  }

  function repairAndParseJSON(text) {
    // Strip code fences and prose preamble.
    let t = text.trim();
    t = t.replace(/^```(?:json)?\s*/, '').replace(/\s*```\s*$/, '');
    const start = t.indexOf('{');
    const end   = t.lastIndexOf('}');
    if (start >= 0 && end > start) t = t.slice(start, end + 1);
    try { return JSON.parse(t); }
    catch (e) {
      // Try trailing-comma repair.
      const repaired = t.replace(/,(\s*[}\]])/g, '$1');
      return JSON.parse(repaired);
    }
  }

  // ─── Per-kind handlers ───────────────────────────────────────────
  async function handleJSON(file) {
    const txt = await file.text();
    const obj = repairAndParseJSON(txt);
    // CONSOLIDATION (1.50.332 DATA-IMPORT-001): a dropped .json that is an AntcvBackup
    // envelope (plain or encrypted) is a full backup-RESTORE, not a field merge.
    // Delegate to the backup-restore library (antcv-data-import-331), which decrypts
    // if needed, confirms the overwrite, restores localStorage losslessly, and reloads.
    // This makes the floating 📥 importer the single import entry point.
    if (window.AntcvIsBackupEnvelope && window.AntcvIsBackupEnvelope(obj) && typeof window.AntcvDataImport === 'function') {
      let pass;
      if (obj._antcvBackupEncrypted === 1) {
        try { pass = window.prompt('This backup is encrypted. Enter its passphrase:'); } catch (_) { pass = null; }
        if (pass == null) return { proposed: {}, summary: 'Restore cancelled' };
      }
      const r = await window.AntcvDataImport(obj, { passphrase: pass, confirm: true, reload: true });
      return {
        proposed: {},
        summary: r.ok ? ('✓ Backup restored (' + r.restored + ' items) — reloading…')
          : (r.cancelled ? 'Restore cancelled' : ('✗ ' + (r.error || 'Restore failed'))),
      };
    }
    const isFullExport = !!(obj.personalInfo || obj.formatSettings || obj.appMeta);
    const proposed = {};
    if (isFullExport) {
      for (const k of Object.keys(obj)) {
        if (ALLOWED_TOP_KEYS.has(k)) proposed[k] = obj[k];
      }
    } else {
      // Fragment shape — assume personalInfo
      proposed.personalInfo = obj;
    }
    return { proposed, summary: isFullExport ? 'Full settings export' : 'Personal fragment' };
  }

  async function handleImage(file) {
    // Resize to max 512px on the long edge to keep localStorage manageable.
    const dataUrl = await fileToDataURL(file);
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = rej;
      im.src = dataUrl;
    });
    const max = 512;
    const ratio = Math.min(1, max / Math.max(img.width, img.height));
    if (ratio >= 1) {
      return { proposed: { photo: dataUrl }, summary: `Profile photo (${Math.round(file.size/1024)} KB)` };
    }
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    cv.getContext('2d').drawImage(img, 0, 0, w, h);
    const out = cv.toDataURL('image/png');
    return { proposed: { photo: out }, summary: `Profile photo (resized to ${w}×${h})` };
  }

  const PERSONAL_PROMPT = (text, stylePrefs) => `You extract structured CV data from raw text. Return JSON only — no prose, no markdown fences.

Schema (omit any field the source does not support; do not invent):
{
  "name": "string", "firstName": "string", "lastName": "string",
  "location": "string", "city": "string", "country": "string", "citizenship": "string",
  "email": "string", "phone": "string", "linkedin": "string", "headline": "string",
  "background": "string (10-20 line plain summary)",
  "education": [{ "deg": "string", "sch": "string" }],
  "certifications": ["string"],
  "publications": ["string with <b> wrapping titles"],
  "publicationsStructured": [{ "name": "string", "details": "string", "visible": true }],
  "experience": [{ "role": "string", "company": "string", "years": "YYYY-YYYY", "bullets": ["string","string","string"] }],
  "tools": ["string"],
  "regulatory": [{ "group": "string" } /* or */, { "l": "string", "v": "string" }]
}

Rules:
- Treat the user's banned words and phrases below as HARD exclusions. Do not produce them.
- Do NOT extract availability / notice-period / working-hours / internship-or-trial-period lines (e.g. "Availability: Available up to 20 hours per week. Open to internship or trial period"). These are job-specific and must never be imported into the profile.
- Three bullets per role maximum. Concrete actions and outcomes.
- LinkedIn canonical form: "linkedin.com/in/<slug>" (strip scheme and query).
- If experience has more than 8 roles, keep the 8 most recent.

User style preferences:
${JSON.stringify(stylePrefs || {})}

Source text:
${text}`;

  const VIA_PROMPT = (text) => `You extract a work-style profile from a VIA Character Strengths assessment. Return JSON only.

Schema:
{
  "strengths": [{ "name": "string", "rank": number, "score": number }],
  "virtues":   [{ "name": "string", "rank": number, "score": number }],
  "summary":   "2-3 sentence plain-language work-style sketch suitable for a cover letter",
  "tonalGuidance": "1 sentence describing tone implications",
  "source": "report title + date"
}

Do not invent scores. Omit fields that are not stated in the source.

Source:
${text}`;

  const MEMORY_PROMPT = (text) => `Summarise the following document into a 6-12 line MEMORY PROFILE for a CV-writing assistant. Plain prose, no bullets, no headings. Focus on enhanced experience, specific tools/skills/methods, and style cues to preserve.

Source:
${text}`;

  async function handleLinkedInPDF(file) {
    const [b64, text] = await Promise.all([fileToBase64(file), extractPdfText(file)]);
    const stylePrefs = (Store.get('personalInfo', {}) || {}).stylePrefs || {};
    const extracted  = repairAndParseJSON(await callLLM(PERSONAL_PROMPT(text.slice(0, CFG.maxPdfChars), stylePrefs)));
    const digest     = await callLLM(MEMORY_PROMPT(text.slice(0, 12000)));
    return {
      proposed: {
        profileDoc: { name: file.name, b64, type: 'pdf' },
        personalInfo: extracted,
        memoryDigest: digest.trim(),
      },
      summary: `LinkedIn → profileDoc + ${Object.keys(extracted).length} personal fields + memory digest`,
    };
  }

  async function handleVIA(file) {
    const text = await extractPdfText(file);
    const ws   = repairAndParseJSON(await callLLM(VIA_PROMPT(text.slice(0, CFG.maxPdfChars))));
    const proposed = {
      personalInfo: { workStyle: ws },
    };
    if (ws.tonalGuidance) {
      proposed.personalInfo.stylePrefs = { preferred_tone: ws.tonalGuidance };
    }
    const topStrengths = (ws.strengths || []).slice(0, 3).map(s => s.name).filter(Boolean).join(', ');
    return { proposed, summary: `Work style → top: ${topStrengths || 'unknown'}` };
  }

  async function handleCV(file) {
    const ext  = (file.name.split('.').pop() || '').toLowerCase();
    const text = ext === 'pdf' ? await extractPdfText(file) : await extractDocxText(file);
    const stylePrefs = (Store.get('personalInfo', {}) || {}).stylePrefs || {};
    const extracted  = repairAndParseJSON(await callLLM(PERSONAL_PROMPT(text.slice(0, CFG.maxPdfChars), stylePrefs)));
    const digest     = await callLLM(MEMORY_PROMPT(text.slice(0, 12000)));
    return {
      proposed: { personalInfo: extracted, memoryDigest: digest.trim() },
      summary:  `CV → personal fields + memory digest`,
    };
  }

  async function handlePublication(file) {
    const text = await extractPdfText(file);
    const firstLine = text.split(/\n/).find(l => l.trim().length > 20) || file.name;
    return {
      proposed: {
        personalInfo: {
          publicationsStructured: [{
            name: firstLine.trim().slice(0, 160),
            details: 'Imported from PDF — edit details inline',
            visible: true,
          }],
        },
      },
      summary: `Publication candidate: ${firstLine.slice(0, 60)}…`,
    };
  }

  async function handleSkillsDOCX(file) {
    const content = await extractDocxText(file);
    return {
      proposed: { skillsDoc: { name: file.name, content, type: 'docx' } },
      summary: `Skills doc → ${content.length} chars`,
    };
  }

  async function handleWordsDOCX(file) {
    const content = await extractDocxText(file);
    const parsed  = parseBannedWordsDoc(content);
    return {
      proposed: {
        wordsDoc: { name: file.name, content, type: 'docx' },
        personalInfo: {
          stylePrefs: {
            banned_words:    parsed.words.join(', '),
            banned_phrases:  parsed.phrases.join(', '),
            banned_patterns: parsed.patterns.join(' | '),
          },
        },
      },
      summary: `Words doc → ${parsed.words.length} words, ${parsed.phrases.length} phrases, ${parsed.patterns.length} patterns`,
    };
  }

  async function handleDanishDOCX(file) {
    const content = await extractDocxText(file);
    return {
      proposed: { danishDoc: { name: file.name, content, type: 'docx' } },
      summary: `Danish doc → ${content.length} chars`,
    };
  }

  const HANDLERS = {
    'json':              handleJSON,
    'image':             handleImage,
    'linkedin-pdf':      handleLinkedInPDF,
    'via-pdf':           handleVIA,
    'cv-doc':            handleCV,
    'publication-pdf':   handlePublication,
    'work-examples-pdf': handlePublication,
    'skills-docx':       handleSkillsDOCX,
    'words-docx':        handleWordsDOCX,
    'danish-docx':       handleDanishDOCX,
    'generic-pdf':       handleCV,
    'generic-docx':      handleCV,
  };

  const KIND_LABELS = {
    'json':              'Settings JSON',
    'image':             'Profile photo',
    'linkedin-pdf':      'LinkedIn profile PDF',
    'via-pdf':           'VIA character strengths',
    'cv-doc':            'CV / résumé',
    'publication-pdf':   'Publication / patent',
    'work-examples-pdf': 'Work examples',
    'skills-docx':       'Skills list',
    'words-docx':        'Banned words list',
    'danish-docx':       'Danish reference',
    'generic-pdf':       'Generic PDF (treated as CV)',
    'generic-docx':      'Generic DOCX (treated as CV)',
    'unsupported':       'Unsupported',
  };

  // ─── Deep merge with policy ──────────────────────────────────────
  const DEDUP_KEYS = {
    'personalInfo.education':              e => `${e.deg}|${e.sch}`,
    'personalInfo.certifications':         s => String(s).toLowerCase().trim(),
    'personalInfo.tools':                  s => String(s).toLowerCase().trim(),
    'personalInfo.regulatory':             r => r.group ? `g:${r.group}` : `${r.l}|${r.v}`,
    'personalInfo.publications':           s => String(s).replace(/<[^>]+>/g, '').toLowerCase().slice(0, 80),
    'personalInfo.publicationsStructured': p => (p.name || '').toLowerCase().slice(0, 80),
    'personalInfo.contactItems':           c => c.key,
    'personalInfo.additional':             a => `${a.l}|${a.v}`,
  };

  function mergePath(target, source, path) {
    if (source === undefined || source === null) return target;
    if (Array.isArray(source)) {
      const dedup = DEDUP_KEYS[path];
      if (!dedup) return source;
      const seen = new Map();
      for (const item of (target || [])) if (item != null) seen.set(dedup(item), item);
      for (const item of source) if (item != null) seen.set(dedup(item), item);
      return Array.from(seen.values());
    }
    if (typeof source === 'object') {
      const out = Object.assign({}, target || {});
      for (const k of Object.keys(source)) {
        out[k] = mergePath(out[k], source[k], path ? `${path}.${k}` : k);
      }
      return out;
    }
    if (typeof source === 'string' && source.trim() === '') return target;
    return source;
  }

  // ─── Diff flattening ─────────────────────────────────────────────
  function flatten(obj, prefix, out) {
    out = out || {};
    if (obj == null) return out;
    if (Array.isArray(obj)) { out[prefix] = `[${obj.length} item${obj.length === 1 ? '' : 's'}]`; return out; }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) flatten(obj[k], prefix ? `${prefix}.${k}` : k, out);
      return out;
    }
    const s = typeof obj === 'string' ? obj : String(obj);
    out[prefix] = s.length > 120 ? s.slice(0, 120) + '…' : s;
    return out;
  }

  function getCurrentSettings() {
    const out = {};
    for (const k of ALLOWED_TOP_KEYS) {
      const v = Store.get(k, undefined);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }

  // ─── BRAND constants (v1.50.23) ──────────────────────────────────
  // Bucket 2 hex-extraction. The data-import modal + FAB is editor
  // chrome — palette stays constant across all 7 visual packages.
  // 22+ inline hex literals → single named map. Roles:
  var BRAND = {
    teal:        '#00746E',  // FAB bg + heading
    tealBright:  '#01B7BB',  // FAB hover, primary button, busy text
    white:       '#fff',
    navy:        '#283556',  // secondary button, code text
    navyText:    '#1a2433',  // modal body text
    bodyMuted:   '#444',     // blurb text
    mutedDark:   '#666',     // staged-file summary, empty diff
    mutedSoft:   '#888',     // diff "before" column
    subtleBg:    '#fbfcfd',  // files-list card bg
    borderLight: '#d6dde3',  // files-list border
    tableHead:   '#f5f7f9',  // diff table thead bg
    borderMed:   '#ddd',     // diff table borders
    borderFaint: '#eee',     // diff row borders
    successBg:   '#f0faf3',  // new-row bg
    warningBg:   '#fff8e8',  // changed-row bg
    errorBg:     '#fdecea',  // error banner bg
    errorBorder: '#f5c2c0',  // error banner border
    errorText:   '#a33',     // error banner text + per-file error
  };

  // ─── UI ──────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .antcv-import-fab {
      position: fixed; z-index: 99998;
      bottom: ${CFG.bottomOffset}px; left: ${CFG.leftOffset}px;
      width: 44px; height: 44px; border-radius: 50%;
      background: ${BRAND.teal}; color: ${BRAND.white}; border: none; cursor: pointer;
      font-size: 18px; box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s;
    }
    .antcv-import-fab:hover { background: ${BRAND.tealBright}; }

    .antcv-import-backdrop {
      position: fixed; inset: 0; z-index: 2147483300;
      background: rgba(20, 28, 44, 0.55);
      display: flex; align-items: flex-start; justify-content: center;
      padding: 5vh 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .antcv-import-modal {
      background: ${BRAND.white}; color: ${BRAND.navyText};
      max-width: 720px; width: 100%; max-height: 90vh; overflow: auto;
      border-radius: 10px; padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.25);
    }
    .antcv-import-modal h2 {
      margin: 0 0 6px; color: ${BRAND.teal}; font-size: 18px; font-weight: 600;
    }
    .antcv-import-modal .antcv-import-blurb {
      color: ${BRAND.bodyMuted}; font-size: 13px; line-height: 1.5; margin-bottom: 14px;
    }
    .antcv-import-modal .antcv-import-files {
      background: ${BRAND.subtleBg}; border: 1px solid ${BRAND.borderLight}; border-radius: 6px;
      padding: 12px; margin-bottom: 12px;
    }
    .antcv-import-modal .antcv-import-staged {
      font-size: 13px; margin: 10px 0;
    }
    .antcv-import-modal .antcv-import-staged ul {
      margin: 6px 0 0; padding-left: 20px;
    }
    .antcv-import-modal table.antcv-diff {
      width: 100%; border-collapse: collapse; font-size: 12px;
    }
    .antcv-import-modal table.antcv-diff th {
      background: ${BRAND.tableHead}; text-align: left; padding: 6px;
      position: sticky; top: 0; border-bottom: 1px solid ${BRAND.borderMed};
    }
    .antcv-import-modal table.antcv-diff td {
      padding: 4px 6px; border-top: 1px solid ${BRAND.borderFaint}; vertical-align: top;
    }
    .antcv-import-modal table.antcv-diff tr.new { background: ${BRAND.successBg}; }
    .antcv-import-modal table.antcv-diff tr.change { background: ${BRAND.warningBg}; }
    .antcv-import-modal .antcv-diff-wrap {
      max-height: 320px; overflow: auto; border: 1px solid ${BRAND.borderMed}; border-radius: 6px;
    }
    .antcv-import-modal .antcv-import-actions {
      margin-top: 14px; display: flex; gap: 8px; justify-content: flex-end;
    }
    .antcv-import-modal button.primary {
      background: ${BRAND.tealBright}; color: ${BRAND.white}; border: none; padding: 8px 16px;
      border-radius: 5px; cursor: pointer; font-size: 13px; font-weight: 500;
    }
    .antcv-import-modal button.secondary {
      background: ${BRAND.white}; color: ${BRAND.navy}; border: 1px solid ${BRAND.navy};
      padding: 8px 16px; border-radius: 5px; cursor: pointer; font-size: 13px;
    }
    .antcv-import-modal button:disabled { opacity: 0.5; cursor: not-allowed; }
    .antcv-import-modal .antcv-import-err {
      background: ${BRAND.errorBg}; border: 1px solid ${BRAND.errorBorder}; color: ${BRAND.errorText};
      padding: 8px 10px; border-radius: 5px; margin: 8px 0; font-size: 12px;
    }
    .antcv-import-modal .antcv-import-busy {
      color: ${BRAND.tealBright}; font-size: 13px; margin: 12px 0;
    }
    .antcv-import-modal code { font-size: 11px; color: ${BRAND.navy}; }
  `;
  document.head.appendChild(style);

  const EXPLANATION =
    'Drop in JSON, PDF, DOCX, or image files containing facts about you — a LinkedIn profile, a CV, a banned-words list, a VIA character-strengths assessment, a profile photo, or a previous settings export — and AntCV will route each file to the right slot, propose the changes, and let you accept or reject each one before anything is written. Nothing is overwritten silently. (Restoring a full AntCV backup file — incl. an encrypted one — does a complete restore after a confirmation.)';

  let modalState = null;

  function openModal() {
    if (modalState) return;
    const backdrop = document.createElement('div');
    backdrop.className = 'antcv-import-backdrop';
    backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });

    const modal = document.createElement('div');
    modal.className = 'antcv-import-modal';

    modal.innerHTML = `
      <h2>Import user settings from raw data</h2>
      <div class="antcv-import-blurb">${EXPLANATION}</div>
      <div class="antcv-import-files">
        <input type="file" multiple accept=".json,.pdf,.docx,.png,.jpg,.jpeg,.webp" id="antcv-import-input">
      </div>
      <div id="antcv-import-status"></div>
      <div id="antcv-import-staged"></div>
      <div id="antcv-import-diff"></div>
      <div class="antcv-import-actions">
        <button class="secondary" id="antcv-import-cancel">Close</button>
        <button class="primary" id="antcv-import-apply" disabled>Apply selected changes</button>
      </div>
    `;
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    modalState = { backdrop, modal, staged: [], selected: {}, combined: {} };

    modal.querySelector('#antcv-import-input').addEventListener('change', e => handleFiles(e.target.files));
    modal.querySelector('#antcv-import-cancel').addEventListener('click', closeModal);
    modal.querySelector('#antcv-import-apply').addEventListener('click', applyChanges);
  }

  function closeModal() {
    if (!modalState) return;
    modalState.backdrop.remove();
    modalState = null;
  }

  function setStatus(html) {
    if (!modalState) return;
    modalState.modal.querySelector('#antcv-import-status').innerHTML = html;
  }

  async function handleFiles(fileList) {
    if (!modalState) return;
    setStatus('<div class="antcv-import-busy">Reading and structuring files…</div>');
    modalState.modal.querySelector('#antcv-import-apply').disabled = true;
    const results = [];
    for (const file of Array.from(fileList)) {
      try {
        // Quick content sniff for files with ambiguous names.
        let sample = '';
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const nameHit = KIND_FROM_NAME.some(([re]) => re.test(file.name.toLowerCase()));
        if (!nameHit) {
          try {
            if (ext === 'pdf')  sample = (await extractPdfText(file)).slice(0, 2000);
            if (ext === 'docx') sample = (await extractDocxText(file)).slice(0, 2000);
          } catch (_) {}
        }
        const kind    = detectKind(file, sample);
        const handler = HANDLERS[kind];
        if (!handler) {
          results.push({ file, kind, error: 'Unsupported file type' });
          continue;
        }
        const r = await handler(file);
        results.push({ file, kind, summary: r.summary, proposed: r.proposed });
      } catch (err) {
        console.error('[importer]', file.name, err);
        results.push({ file, kind: 'error', error: String(err.message || err) });
      }
    }
    modalState.staged = results;
    renderStaged();
    setStatus('');
  }

  function renderStaged() {
    if (!modalState) return;
    const stagedDiv = modalState.modal.querySelector('#antcv-import-staged');
    const lines = modalState.staged.map(s => {
      const safeName = String(s.file.name).replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
      if (s.error) return `<li style="color:${BRAND.errorText}"><code>${safeName}</code> → ${s.error}</li>`;
      const label = KIND_LABELS[s.kind] || s.kind;
      return `<li><code>${safeName}</code> → <strong>${label}</strong> · <span style="color:${BRAND.mutedDark}">${s.summary || ''}</span></li>`;
    }).join('');
    stagedDiv.innerHTML = lines ? `<div class="antcv-import-staged"><strong>Detected files:</strong><ul>${lines}</ul></div>` : '';

    // Build combined proposal from non-error results
    modalState.combined = modalState.staged.reduce((acc, s) => s.proposed ? mergePath(acc, s.proposed, '') : acc, {});
    renderDiff();
  }

  function renderDiff() {
    if (!modalState) return;
    const diffDiv = modalState.modal.querySelector('#antcv-import-diff');
    const current  = getCurrentSettings();
    const proposed = mergePath(current, modalState.combined, '');

    const flatCur = flatten(current, '');
    const flatProp = flatten(proposed, '');
    const rows = [];
    for (const key of Object.keys(flatProp)) {
      const before = flatCur[key];
      const after  = flatProp[key];
      if (String(before) === String(after)) continue;
      rows.push({ key, before, after, kind: before === undefined ? 'new' : 'change' });
    }

    if (!rows.length) {
      diffDiv.innerHTML = `<div style="padding:8px;color:${BRAND.mutedDark};font-size:13px">No changes to apply.</div>`;
      modalState.modal.querySelector('#antcv-import-apply').disabled = true;
      return;
    }

    // Default: every row selected
    modalState.selected = {};
    rows.forEach(r => { modalState.selected[r.key] = true; });

    const html = `
      <div class="antcv-diff-wrap">
        <table class="antcv-diff">
          <thead><tr><th style="width:28px"></th><th>Field</th><th>Current</th><th>Proposed</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr class="${r.kind}" data-key="${r.key.replace(/"/g, '&quot;')}">
                <td><input type="checkbox" checked data-toggle="${r.key.replace(/"/g, '&quot;')}"></td>
                <td><code>${r.key}</code></td>
                <td style="color:${BRAND.mutedSoft}">${r.before === undefined ? '—' : escapeHtml(String(r.before))}</td>
                <td>${escapeHtml(String(r.after))}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
    diffDiv.innerHTML = html;
    diffDiv.querySelectorAll('input[type="checkbox"][data-toggle]').forEach(cb => {
      cb.addEventListener('change', e => {
        const k = e.target.getAttribute('data-toggle');
        modalState.selected[k] = e.target.checked;
      });
    });
    modalState.modal.querySelector('#antcv-import-apply').disabled = false;
  }

  function escapeHtml(s) {
    return s.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  }

  function getByPath(obj, path) {
    return path.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
  }
  function setByPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] == null || typeof cur[parts[i]] !== 'object') cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }

  function applyChanges() {
    if (!modalState) return;
    // Filter the combined proposal to only checked leaves.
    const flat = flatten(modalState.combined, '');
    const filtered = {};
    for (const key of Object.keys(flat)) {
      if (modalState.selected[key] === false) continue;
      const v = getByPath(modalState.combined, key);
      if (v !== undefined) setByPath(filtered, key, v);
    }

    // Merge per top-level key into the current value, then write back.
    const writes = [];
    for (const k of Object.keys(filtered)) {
      if (!ALLOWED_TOP_KEYS.has(k)) continue;
      const cur = Store.get(k, undefined);
      const merged = mergePath(cur, filtered[k], k);
      Store.set(k, merged);
      writes.push(k);
    }

    // v1.40.8 — JSON-fragment imports that carry `experience: [...]` get
    // their roles plumbed into sections.cv as well. Previously, dropping
    // a JSON like Anita's set personalInfo.experience but the React app
    // reads experience from sections.cv.experience.roles, so it never
    // appeared in the CV. We do this AFTER the personalInfo write so we
    // re-read the post-merge value (rather than guessing from filtered).
    try {
      // DIRECT-JSON-IMPORT-001 (owner 2026-06-14): if the import carried a full
      // `sections` block, it already set the experience roles verbatim - do NOT
      // re-plumb the (possibly stale) personalInfo.experience over the freshly
      // imported sections, which would undo merged roles + corrected dates.
      const piNow = filtered.sections ? null : Store.get('personalInfo', null);
      const expArr = piNow && Array.isArray(piNow.experience) ? piNow.experience : null;
      if (expArr && expArr.length) {
        const slug = (s, i) => 'r' + (i + 1);
        const newRoles = expArr.map((e, i) => ({
          id:      e && e.id     ? String(e.id)     : slug(0, i),
          title:   String((e && (e.title || e.role)) || '').trim(),
          company: String((e && e.company) || '').trim(),
          years:   String((e && (e.years || e.dates || ''))).trim() ||
                   [e && e.startDate, e && e.endDate].filter(Boolean).join(' – '),
          on:      true,
          bullets: Array.isArray(e && e.bullets)
                    ? e.bullets.map(b => String(b || '').trim()).filter(Boolean)
                    : (e && e.description ? [String(e.description).trim()] : []),
        })).filter(r => r.title || r.company);

        if (newRoles.length) {
          const sections = Store.get('sections', null);
          if (sections && sections.cv && Array.isArray(sections.cv)) {
            const expIdx = sections.cv.findIndex(s => s && (s.id === 'experience' || s.type === 'experience'));
            if (expIdx >= 0) {
              sections.cv[expIdx] = { ...sections.cv[expIdx], roles: newRoles };
              Store.set('sections', sections);
              writes.push('sections.cv.experience');
            }
          }
        }
      }
    } catch (e) {
      console.warn('[antcv-data-importer] experience→sections plumbing failed:', e);
    }

    closeModal();
    // v1.40.3 — tell the React app to re-read state from localStorage
    // immediately, so the sidebar (tools/certs/education/publications/
    // additional) and personal-panel fields show the imported values
    // without a manual reload. The app already listens for both
    // antcv:sections-updated and the storage event; we fire both.
    try {
      window.dispatchEvent(new CustomEvent('antcv:sections-updated', { detail: { source: 'data-importer', writes } }));
    } catch (_) {}
    for (const k of writes) {
      try { window.dispatchEvent(new StorageEvent('storage', { key: k, newValue: localStorage.getItem(k) })); } catch (_) {}
    }
    setTimeout(() => {
      alert(`Imported ${writes.length} settings group${writes.length === 1 ? '' : 's'}: ${writes.join(', ')}.\n\nIf any panel still shows the old values, reload the page.`);
    }, 50);
  }

  // ─── Mount ───────────────────────────────────────────────────────
  function mountFab() {
    if (document.querySelector('.antcv-import-fab')) return;
    const btn = document.createElement('button');
    btn.className = 'antcv-import-fab';
    btn.title = 'Import settings from raw data';
    btn.textContent = '📥';
    btn.addEventListener('click', openModal);
    document.body.appendChild(btn);
  }

  // v1.0.1 — hook the existing in-Settings button. The React bundle
  // ships a "📄 Import profile from Word or PDF" button in the
  // Personal tab whose file input is hard-wired to .pdf,.doc,.docx.
  // Rather than touching the minified bundle, we watch for that
  // button to appear, hide it, and inject our own button in the
  // same spot that opens the importer modal (which already supports
  // JSON, images, DOCX, and PDF). React re-renders happily over the
  // top — the observer re-applies on the next mount.
  const BUTTON_TEXT_MATCH = /Import profile from Word or PDF/;
  function hookSettingsButton() {
    // Find any element whose text content matches. Walk the tree
    // via TreeWalker to keep this cheap on large DOMs.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, {
      acceptNode(node) {
        if (node.dataset && node.dataset.antcvImportHooked) return NodeFilter.FILTER_REJECT;
        if (node.dataset && node.dataset.antcvImportReplacement) return NodeFilter.FILTER_REJECT;
        const tag = node.tagName;
        if (tag !== 'BUTTON' && tag !== 'LABEL' && tag !== 'DIV') return NodeFilter.FILTER_SKIP;
        const txt = (node.textContent || '').trim();
        if (txt && BUTTON_TEXT_MATCH.test(txt) && txt.length < 200) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      // Find the closest interactive element. Often the React button
      // is a <label> wrapping an <input type="file">. We want to
      // replace the visible clickable element, not just the text.
      const clickable = node.closest('label, button') || node;
      if (clickable.dataset.antcvImportHooked) continue;
      clickable.dataset.antcvImportHooked = '1';
      // Hide the original
      clickable.style.display = 'none';
      // Make a replacement that matches the original's visual feel
      const replacement = document.createElement('button');
      replacement.type = 'button';
      replacement.dataset.antcvImportReplacement = '1';
      replacement.textContent = '📥 Import profile from Word, PDF, JSON, or image';
      // Hard-coded styling — do NOT read from getComputedStyle of the
      // hidden source element; some browsers return useless values for
      // display:none nodes and the text ends up black.
      replacement.style.cssText = `
        display: block; width: 100%;
        padding: 8px 12px;
        background: rgba(1, 183, 187, 0.18);
        border: 1px solid rgba(1, 183, 187, 0.5);
        border-radius: 6px;
        color: ${BRAND.tealBright};
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        text-align: center;
        margin-bottom: 8px;
      `;
      replacement.addEventListener('mouseenter', () => {
        replacement.style.background = 'rgba(1, 183, 187, 0.28)';
      });
      replacement.addEventListener('mouseleave', () => {
        replacement.style.background = 'rgba(1, 183, 187, 0.18)';
      });
      replacement.addEventListener('click', openModal);
      clickable.parentNode.insertBefore(replacement, clickable.nextSibling);

      // Also update the descriptive line right below, if present.
      // The original reads "Reads any .docx or .pdf CV …". We add a
      // sibling note saying JSON + image are now supported too.
      const parent = clickable.parentNode;
      const siblings = parent ? Array.from(parent.children) : [];
      for (const sib of siblings) {
        const t = (sib.textContent || '').trim();
        if (/Reads any \.docx or \.pdf CV/i.test(t) && !sib.dataset.antcvImportNote) {
          sib.dataset.antcvImportNote = '1';
          const note = document.createElement('div');
          note.style.cssText = 'margin-top:4px;color:rgba(1,183,187,0.85);font-size:11px;line-height:1.4';
          note.textContent = 'JSON settings exports, profile photos (PNG/JPG), VIA character-strengths PDFs, and banned-words DOCX files are also accepted. Drop one or several at once and review the diff before applying.';
          sib.parentNode.insertBefore(note, sib.nextSibling);
        }
      }
    }
  }

  let hookObserver = null;
  function startHookObserver() {
    hookSettingsButton(); // initial pass
    if (hookObserver) return;
    hookObserver = new MutationObserver(() => {
      // Debounce by scheduling on next animation frame.
      if (startHookObserver._pending) return;
      startHookObserver._pending = true;
      requestAnimationFrame(() => {
        startHookObserver._pending = false;
        hookSettingsButton();
      });
    });
    hookObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { startHookObserver(); });
  } else {
    startHookObserver();
  }

  // Expose for debugging / programmatic invocation
  window.AntCVImporter = { open: openModal, close: closeModal };
})();
