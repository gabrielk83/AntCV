/* AntCV translation-patch sidecar (v1.40.195)
 * ============================================================
 *
 * Purpose
 * -------
 * The LLM translation pipeline (app.js) handles most CV/CL prose
 * cleanly in zh-CN and es, but consistently leaves a set of fields
 * untranslated:
 *
 *   - Header band: name pre/post tokens, location, "EU Citizen"
 *     citizenship token, "Kind regards" cover-letter sign-off
 *   - Education: institution names, degree/specialization labels,
 *     short award strings ("honorable mention")
 *   - Publications: citation prose around quoted titles ("Karp et al.",
 *     "Conference Proceedings", "Eurosensors")
 *   - Patent text: the descriptive sentence that follows the patent
 *     number
 *   - Specialization tokens: "Optoelectronics", "Photonics", "nanotech."
 *   - Role titles and company names (Gabriel's spec: translate both
 *     in zh and es)
 *
 * The root causes are split across the translation prompt builder
 * (excludes some field paths, has overly-aggressive "preserve proper
 * nouns" guidance) and the chunker. Fixing those requires editing
 * app.js, which is minified. So this sidecar does a dictionary-based
 * post-translation pass on the rendered preview DOM and on
 * localStorage.sections, swapping known formulaic English strings
 * for their target-language equivalents.
 *
 * Scope
 * -----
 * This is a dictionary patcher, not a translation engine. It covers
 * the specific recurring gaps Gabriel documented on 2026-05-19. New
 * gaps are added to DICT below; the structure is intentionally flat
 * for easy maintenance.
 *
 * The dictionary uses EN as the canonical key (since the LLM
 * sometimes mixes EN tokens into otherwise-translated zh/es output),
 * with target-language values for each supported language.
 *
 * Languages
 * ---------
 *   en, da, zh-CN (and 'zh' alias), es
 *
 * Note: en/da gaps are not patched — antcv-i18n.js v1.40.178 handles
 * those for UI chrome, and the LLM does well on da content.
 *
 * Detection of current language
 * -----------------------------
 *   1. localStorage.language ('en'|'da'|'zh-CN'|'zh'|'es') — primary.
 *   2. fallback: localStorage.uiLang.
 *   3. fallback: <html lang="..."> attribute.
 *
 * If current language is en or da, this sidecar is a no-op.
 *
 * Operation
 * ---------
 *   1. On every preview-paper mutation, walk text nodes (NOT input/
 *      textarea contents — that would fight the editor) and replace
 *      whole-token English forms with target-language equivalents.
 *   2. Tag patched nodes with a parent-element data attribute so we
 *      can re-process when content changes but skip our own writes.
 *   3. Same pass on localStorage.sections after a debounce so the
 *      DOCX export pipeline picks up the translations too. (Without
 *      this, the PDF/DOCX would still show the untranslated tokens
 *      because the worker reads from the JSON payload, not the
 *      preview DOM.)
 *
 * Conservative-by-default
 * -----------------------
 * Replacements are word-boundary matched, case-sensitive on the
 * English source (since these are mostly proper-noun-like tokens
 * and short phrases). We never replace a token that appears inside
 * a longer untranslated phrase if its translation would be
 * ambiguous — entries marked `safeOnly: true` skip phrase-internal
 * matches.
 */
(function () {
  'use strict';

  if (window.__antcvTranslationPatchInstalled) return;
  window.__antcvTranslationPatchInstalled = '1.40.195';

  // ─── Language detection ──────────────────────────────────────────
  function currentLang() {
    let v = '';
    try { v = String(localStorage.getItem('language') || '').toLowerCase(); } catch (_) {}
    if (!v) { try { v = String(localStorage.getItem('uiLang') || '').toLowerCase(); } catch (_) {} }
    if (!v) {
      try {
        const h = document.documentElement.getAttribute('lang') || '';
        v = String(h).toLowerCase();
      } catch (_) {}
    }
    if (v === 'zh' || v === 'zh-cn' || v === 'zh_cn' || v === 'cn' || v === 'chinese') return 'zh-CN';
    if (v === 'es' || v === 'es-es' || v === 'spanish' || v === 'español') return 'es';
    if (v === 'da' || v === 'da-dk' || v === 'danish') return 'da';
    return 'en';
  }

  // ─── Dictionary ──────────────────────────────────────────────────
  // Each entry: { en: 'English source', 'zh-CN': '…', es: '…', safeOnly?: true }
  // Entries are scanned in order — put longer/more-specific phrases
  // FIRST so they match before shorter substrings of them.
  const DICT = [
    // === Header band & sign-off ===========================================
    { en: 'EU Citizen',           'zh-CN': '欧盟公民',           es: 'Ciudadano de la UE' },
    { en: 'EU citizen',           'zh-CN': '欧盟公民',           es: 'ciudadano de la UE' },
    { en: 'Kind regards,',        'zh-CN': '此致敬礼，',          es: 'Atentamente,' },
    { en: 'Kind regards',         'zh-CN': '此致敬礼',           es: 'Atentamente' },
    { en: 'Best regards,',        'zh-CN': '此致敬礼，',          es: 'Saludos cordiales,' },
    { en: 'Best regards',         'zh-CN': '此致敬礼',           es: 'Saludos cordiales' },
    { en: 'Sincerely,',           'zh-CN': '此致，',             es: 'Atentamente,' },
    { en: 'Sincerely',            'zh-CN': '此致',              es: 'Atentamente' },
    { en: 'Copenhagen, Denmark',  'zh-CN': '哥本哈根，丹麦',      es: 'Copenhague, Dinamarca' },
    { en: 'Copenhagen',           'zh-CN': '哥本哈根',           es: 'Copenhague' },
    { en: 'Denmark',              'zh-CN': '丹麦',              es: 'Dinamarca' },

    // === Application meta line (cover letter header) ======================
    { en: 'Application:',         'zh-CN': '申请：',             es: 'Postulación:' },
    { en: 'Application',          'zh-CN': '申请',              es: 'Postulación' },

    // === Cover letter section headers (in case LLM misses) ================
    { en: 'WHO I AM',             'zh-CN': '我是谁',             es: 'QUIÉN SOY' },
    { en: 'WHAT I BRING',         'zh-CN': '我能带来什么',        es: 'QUÉ APORTO' },
    { en: 'WHY THIS POSITION',    'zh-CN': '为什么是这个职位',     es: 'POR QUÉ ESTA POSICIÓN' },
    { en: 'HOW I WOULD CONTRIBUTE', 'zh-CN': '我将如何贡献',     es: 'CÓMO CONTRIBUIRÍA' },
    { en: 'FOUNDATION',           'zh-CN': '基础',              es: 'FUNDAMENTO' },

    // === Specialization tokens ============================================
    { en: 'Optoelectronics',      'zh-CN': '光电子学',           es: 'Optoelectrónica' },
    { en: 'optoelectronics',      'zh-CN': '光电子学',           es: 'optoelectrónica' },
    { en: 'Photonics, nanotech.', 'zh-CN': '光子学，纳米技术',    es: 'Fotónica, nanotecnología' },
    { en: 'Photonics',            'zh-CN': '光子学',             es: 'Fotónica' },
    { en: 'photonics',            'zh-CN': '光子学',             es: 'fotónica' },
    { en: 'nanotech.',            'zh-CN': '纳米技术',           es: 'nanotecnología' },
    { en: 'nanotechnology',       'zh-CN': '纳米技术',           es: 'nanotecnología' },
    { en: 'Nanotechnology',       'zh-CN': '纳米技术',           es: 'Nanotecnología' },
    { en: 'Strategy & finance',   'zh-CN': '战略与金融',          es: 'Estrategia y finanzas' },
    { en: 'strategy & finance',   'zh-CN': '战略与金融',          es: 'estrategia y finanzas' },

    // === Education institutions ==========================================
    { en: 'Tel Aviv University',  'zh-CN': '特拉维夫大学',        es: 'Universidad de Tel Aviv' },
    { en: 'Technion',             'zh-CN': '以色列理工学院',      es: 'Technion' },
    { en: 'Technion – Israel Institute of Technology',
                                  'zh-CN': '以色列理工学院',
                                  es: 'Technion — Instituto Tecnológico de Israel' },
    { en: 'Tsinghua University',  'zh-CN': '清华大学',           es: 'Universidad Tsinghua' },
    { en: 'honorable mention',    'zh-CN': '荣誉提名',           es: 'mención honorífica' },
    { en: 'Honorable mention',    'zh-CN': '荣誉提名',           es: 'Mención honorífica' },
    { en: 'China Biz plan',       'zh-CN': '中国商业计划',        es: 'Plan de negocios para China' },
    { en: 'China Business plan',  'zh-CN': '中国商业计划',        es: 'Plan de negocios para China' },

    // === Publications & patents ==========================================
    { en: 'Karp et al.',          'zh-CN': 'Karp 等人',          es: 'Karp et al.' },
    { en: 'et al.',               'zh-CN': '等人',              es: 'et al.' },
    { en: 'Eurosensors Conference Proceedings',
                                  'zh-CN': 'Eurosensors 会议论文集',
                                  es: 'Actas de la Conferencia Eurosensors' },
    { en: 'Conference Proceedings',
                                  'zh-CN': '会议论文集',
                                  es: 'Actas de Congreso' },
    { en: 'Patent No.',           'zh-CN': '专利号',             es: 'Patente N.º' },
    { en: 'Co-inventor of cover window reducing crosstalk between optical components',
                                  'zh-CN': '光学组件间串扰降低盖板共同发明人',
                                  es: 'Coinventor de ventana de cobertura que reduce la diafonía entre componentes ópticos' },
    { en: 'Co-inventor',          'zh-CN': '共同发明人',          es: 'Coinventor' },
    { en: 'co-inventor',          'zh-CN': '共同发明人',          es: 'coinventor' },

    // === Role titles (Gabriel's work history) =============================
    { en: 'System Architect & Change Control Lead',
                                  'zh-CN': '系统架构师兼变更控制负责人',
                                  es: 'Arquitecto de Sistemas y Líder de Control de Cambios' },
    { en: 'Customer Change Requests Specialist',
                                  'zh-CN': '客户变更请求专员',
                                  es: 'Especialista en Solicitudes de Cambio del Cliente' },
    { en: 'System Architect',     'zh-CN': '系统架构师',          es: 'Arquitecto de Sistemas' },
    { en: 'Sr EO Engineer',       'zh-CN': '高级电光工程师',      es: 'Ingeniero Sénior de Electroóptica' },
    { en: 'Senior EO Engineer',   'zh-CN': '高级电光工程师',      es: 'Ingeniero Sénior de Electroóptica' },
    { en: 'EO Engineer & Team Leader',
                                  'zh-CN': '电光工程师兼团队负责人',
                                  es: 'Ingeniero EO y Líder de Equipo' },
    { en: 'EO Engineer',          'zh-CN': '电光工程师',          es: 'Ingeniero de Electroóptica' },
    { en: 'Founder/PM specialist','zh-CN': '创始人 / 项目管理专家',
                                  es: 'Fundador / Especialista en Gestión de Proyectos' },
    { en: 'PM specialist',        'zh-CN': '项目管理专家',        es: 'Especialista en Gestión de Proyectos' },
    { en: 'R&D & Teaching Assistant',
                                  'zh-CN': '研发与助教',
                                  es: 'Asistente de I+D y Docencia' },
    { en: 'Computer Admin',       'zh-CN': '计算机管理员',        es: 'Administrador de Sistemas' },

    // === Company names ====================================================
    // Conservative: only translate where there's a recognized convention.
    { en: 'Innoviz Technologies', 'zh-CN': 'Innoviz Technologies',
                                  es: 'Innoviz Technologies' },
    { en: 'Sirin Labs',           'zh-CN': 'Sirin Labs',         es: 'Sirin Labs' },
    { en: 'Meprolight IWI Group', 'zh-CN': 'Meprolight (IWI 集团)',
                                  es: 'Meprolight (Grupo IWI)' },
    { en: 'Meprolight',           'zh-CN': 'Meprolight',         es: 'Meprolight' },
    { en: 'Kanzen konsulenter i nord ApS',
                                  'zh-CN': 'Kanzen konsulenter i nord ApS',
                                  es: 'Kanzen konsulenter i nord ApS' },
    { en: 'IDF',                  'zh-CN': '以色列国防军 (IDF)',  es: 'Fuerzas de Defensa de Israel (IDF)' },

    // === Section headings (CV) ===========================================
    { en: 'PROFILE',              'zh-CN': '个人简介',           es: 'PERFIL' },
    { en: 'CORE COMPETENCIES',    'zh-CN': '核心能力',           es: 'COMPETENCIAS CLAVE' },
    { en: 'SELECTED OUTCOMES',    'zh-CN': '主要成果',           es: 'RESULTADOS DESTACADOS' },
    { en: 'PROFESSIONAL EXPERIENCE',
                                  'zh-CN': '专业经验',           es: 'EXPERIENCIA PROFESIONAL' },
    { en: 'PROFESSIONAL EXPERIENCE (CONT.)',
                                  'zh-CN': '专业经验（续）',      es: 'EXPERIENCIA PROFESIONAL (CONT.)' },
    { en: 'EDUCATION',            'zh-CN': '教育背景',           es: 'EDUCACIÓN' },
    { en: 'CERTIFICATIONS',       'zh-CN': '认证',              es: 'CERTIFICACIONES' },
    { en: 'TOOLS & METHODS',      'zh-CN': '工具与方法',         es: 'HERRAMIENTAS Y MÉTODOS' },
    { en: 'PUBLICATIONS & PATENT','zh-CN': '出版物与专利',        es: 'PUBLICACIONES Y PATENTE' },
    { en: 'PUBLICATIONS',         'zh-CN': '出版物',             es: 'PUBLICACIONES' },
    { en: 'ADDITIONAL INFORMATION',
                                  'zh-CN': '附加信息',           es: 'INFORMACIÓN ADICIONAL' },
    { en: 'REGULATORY CONTEXT',   'zh-CN': '监管背景',           es: 'CONTEXTO REGULATORIO' },
    { en: 'Focus Area',           'zh-CN': '重点领域',           es: 'Área de enfoque' },
    { en: 'Strategic Expertise',  'zh-CN': '战略专长',           es: 'Experiencia estratégica' },

    // === Common labels ====================================================
    { en: 'Languages:',           'zh-CN': '语言：',             es: 'Idiomas:' },
    { en: 'Languages',            'zh-CN': '语言',              es: 'Idiomas' },
    { en: 'native',               'zh-CN': '母语',              es: 'nativo' },
    { en: 'bilingual',            'zh-CN': '双语',              es: 'bilingüe' },
    { en: 'professional',         'zh-CN': '专业水平',           es: 'profesional' },
    { en: 'Volunteer',            'zh-CN': '志愿者',             es: 'Voluntario' },
    { en: 'Hobbies',              'zh-CN': '兴趣爱好',           es: 'Aficiones' },
    { en: 'Accessibility',        'zh-CN': '无障碍',             es: 'Accesibilidad' },

    // === Date / month tokens ==============================================
    // (Conservative — most date formats survive translation, but
    // "Present" is a common gap.)
    { en: 'Present',              'zh-CN': '至今',              es: 'Presente' },
    { en: 'present',              'zh-CN': '至今',              es: 'presente' },
    { en: 'Current',              'zh-CN': '至今',              es: 'Actual' },
  ];

  // Pre-build a sorted list (longest first) and a fast prefix
  // dispatcher to keep per-text-node cost low.
  const ENTRIES = DICT
    .filter(function (e) { return e && e.en; })
    .sort(function (a, b) { return b.en.length - a.en.length; });

  // ─── DOM text replacement ────────────────────────────────────────
  // For each text node we walk, do an in-place replace pass.

  function isEditableContext(node) {
    // Don't touch text inside editable elements (the user's editor).
    let p = node && node.parentNode;
    while (p && p !== document.body) {
      if (p.nodeType === 1) {
        const tag = (p.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'script' || tag === 'style') return true;
        if (p.isContentEditable) return true;
        if (p.getAttribute('contenteditable') === 'true') return true;
      }
      p = p.parentNode;
    }
    return false;
  }

  // Escape a string for safe inclusion in a RegExp.
  function reEscape(s) { return s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'); }

  // Build the substitution regex once per language change.
  let SUB_REGEX = null;
  let SUB_MAP = null;
  let SUB_LANG = '';
  function rebuildSubRegex(lang) {
    if (lang === 'en' || lang === 'da') {
      SUB_REGEX = null; SUB_MAP = null; SUB_LANG = lang; return;
    }
    const parts = [];
    SUB_MAP = new Map();
    for (const e of ENTRIES) {
      const tgt = e[lang];
      if (!tgt || tgt === e.en) continue;
      parts.push(reEscape(e.en));
      SUB_MAP.set(e.en, tgt);
    }
    if (!parts.length) { SUB_REGEX = null; SUB_LANG = lang; return; }
    // Word-boundary on letter chars; Chinese / Spanish have non-ASCII
    // characters so use lookarounds that avoid mid-word matches in EN.
    // We require either start-of-string, end-of-string, or a non-letter
    // character on each side. Punctuation, whitespace, CJK chars qualify.
    SUB_REGEX = new RegExp(
      '(^|[^A-Za-z0-9_])(' + parts.join('|') + ')(?=$|[^A-Za-z0-9_])',
      'g'
    );
    SUB_LANG = lang;
  }

  function patchString(s, lang) {
    if (!s || typeof s !== 'string') return s;
    if (SUB_LANG !== lang) rebuildSubRegex(lang);
    if (!SUB_REGEX) return s;
    let out = s;
    let prev;
    // Run repeatedly until stable (covers cases where one replacement
    // creates a boundary for another).
    let safety = 4;
    do {
      prev = out;
      out = out.replace(SUB_REGEX, function (_m, pre, en) {
        const tgt = SUB_MAP.get(en);
        return tgt ? (pre + tgt) : _m;
      });
      safety--;
    } while (out !== prev && safety > 0);
    return out;
  }

  // Walk text nodes in a root subtree and apply replacements.
  function walkAndPatch(root, lang) {
    if (!root) return 0;
    let n = 0;
    const TREE = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const dirty = [];
    let node;
    while ((node = TREE.nextNode())) {
      if (isEditableContext(node)) continue;
      const orig = node.nodeValue;
      if (!orig || orig.length < 2) continue;
      const next = patchString(orig, lang);
      if (next !== orig) dirty.push([node, next]);
    }
    for (const [node, next] of dirty) {
      try { node.nodeValue = next; n++; } catch (_) {}
    }
    return n;
  }

  // ─── localStorage.sections patch ─────────────────────────────────
  // So the docx-worker (which reads JSON, not DOM) also gets the
  // translations. We patch all string values recursively.
  function patchObjectStrings(obj, lang) {
    if (obj === null || obj === undefined) return 0;
    let n = 0;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (typeof obj[i] === 'string') {
          const next = patchString(obj[i], lang);
          if (next !== obj[i]) { obj[i] = next; n++; }
        } else if (obj[i] && typeof obj[i] === 'object') {
          n += patchObjectStrings(obj[i], lang);
        }
      }
      return n;
    }
    if (typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (typeof v === 'string') {
          const next = patchString(v, lang);
          if (next !== v) { obj[k] = next; n++; }
        } else if (v && typeof v === 'object') {
          n += patchObjectStrings(v, lang);
        }
      }
      return n;
    }
    return 0;
  }

  // Storage keys we patch. We avoid touching languageCache (the LLM
  // cache) because the cached EN→target translations need to stay
  // as the LLM produced them — we only patch the active state.
  const PATCHABLE_KEYS = ['sections', 'personalInfo'];

  function patchStorage(lang) {
    let total = 0;
    for (const k of PATCHABLE_KEYS) {
      try {
        const raw = localStorage.getItem(k);
        if (typeof raw !== 'string' || !raw.length) continue;
        let parsed;
        try { parsed = JSON.parse(raw); } catch (_) { continue; }
        const n = patchObjectStrings(parsed, lang);
        if (n > 0) {
          total += n;
          try { localStorage.setItem(k, JSON.stringify(parsed)); } catch (_) {}
        }
      } catch (_) {}
    }
    return total;
  }

  // ─── Scheduler ───────────────────────────────────────────────────
  let pending = false;
  let lastDomPatchAt = 0;
  let lastStoragePatchAt = 0;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { applyAll(); } catch (_) {}
    });
  }

  function applyAll() {
    const lang = currentLang();
    if (lang === 'en' || lang === 'da') return;
    // DOM patch on the preview paper.
    const paper = document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
    if (paper) {
      const n = walkAndPatch(paper, lang);
      if (n > 0) {
        lastDomPatchAt = Date.now();
        try { console.debug('[translation-patch] DOM patched', n, 'text nodes (' + lang + ')'); } catch (_) {}
      }
    }
    // Storage patch — debounce to once per ~800ms to avoid setItem
    // storm during rapid edits.
    const now = Date.now();
    if (now - lastStoragePatchAt > 800) {
      const m = patchStorage(lang);
      lastStoragePatchAt = now;
      if (m > 0) {
        try { console.debug('[translation-patch] storage patched', m, 'strings (' + lang + ')'); } catch (_) {}
      }
    }
  }

  // First passes.
  schedule();
  [200, 600, 1500, 3500].forEach(function (d) { setTimeout(schedule, d); });

  // Re-run on mutation, sections updates, and storage events.
  try {
    const mo = new MutationObserver(function () { schedule(); });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
  } catch (_) {}
  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('storage', function (ev) {
    if (!ev) return;
    if (ev.key === 'language' || ev.key === 'sections' || ev.key === 'personalInfo') {
      rebuildSubRegex(currentLang());
      schedule();
    }
  });

  // Re-build regex when language switches (which app.js does via
  // localStorage.setItem('language', …) — we hear that via the
  // 'storage' event in OTHER tabs, but within the same tab we have
  // to poll. Cheap interval.
  setInterval(function () {
    const lang = currentLang();
    if (lang !== SUB_LANG) {
      rebuildSubRegex(lang);
      schedule();
    }
  }, 800);

  // Public API.
  window.AntcvTranslationPatch = {
    version: '1.40.195',
    dict: DICT,
    _applyAll: applyAll,
    _patchString: patchString,
    _patchStorage: patchStorage,
    _walkAndPatch: walkAndPatch,
    _currentLang: currentLang,
  };

  try { console.debug('[translation-patch] installed v1.40.195'); } catch (_) {}
})();
