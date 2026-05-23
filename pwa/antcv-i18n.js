/* AntCV i18n sidecar (v1.40.172)
 * ============================================================
 *
 * Provides UI-string translations for the four supported app
 * languages: en / da / es / zh. Other AntCV sidecars call
 * `window.AntcvI18n.t(key, fallbackEn)` to render UI text in the
 * user's chosen language.
 *
 * Distinct from the CV-content translation pipeline (which lives
 * in app.js and uses the `fe` / `feI18n` dictionaries plus the
 * LLM translation flow). This sidecar is ONLY about the chrome
 * around the CV — sidecar panels, buttons, hints, audit labels.
 *
 * Storage convention
 * ------------------
 * The setup-language picker writes to localStorage["antcv:setup:lang"]
 * with a 2-character code. Recognised values: en, da, es, zh.
 * Anything else falls back to 'en'.
 *
 * Resolution order in t(key, fallbackEn):
 *   1. STRINGS[key][lang] if present + non-empty → return it
 *   2. STRINGS[key].en if present → return it
 *   3. fallbackEn argument if given → return it
 *   4. Return key as-is (visible breadcrumb)
 *
 * That order means a partially-translated dictionary still works:
 * any key missing a translation for the active language silently
 * falls through to English, never breaks the UI.
 */
(function () {
  'use strict';

  const SCRIPT_VERSION = '1.40.172';
  if (window.__antcvI18nInstalled) return;
  window.__antcvI18nInstalled = SCRIPT_VERSION;

  // ─── Translation table ──────────────────────────────────────────
  // Each entry has en (canonical English) + da (Danish) + es
  // (LATAM Spanish business register) + zh (Simplified Chinese,
  // mainland formal business register, full-width punctuation).
  const STRINGS = {
    'common.close':                       { en: 'Close',                                                                                  da: 'Luk',                                                                                       es: 'Cerrar',                                                                                       zh: '关闭' },
    'common.refresh':                     { en: 'Refresh',                                                                                da: 'Opdater',                                                                                   es: 'Actualizar',                                                                                   zh: '刷新' },
    'common.reset':                       { en: 'Reset',                                                                                  da: 'Nulstil',                                                                                   es: 'Restablecer',                                                                                  zh: '重置' },
    'common.copy':                        { en: 'Copy',                                                                                   da: 'Kopier',                                                                                    es: 'Copiar',                                                                                       zh: '复制' },

    // ─── Tone helper sidecar (v1.40.169 i18n migration) ────────────
    'tone.custom_slot':                   { en: 'Custom slot',                                                                            da: 'Brugerdefineret plads',                                                                     es: 'Espacio personalizado',                                                                        zh: '自定义槽位' },
    'tone.custom':                        { en: 'Custom',                                                                                 da: 'Brugerdef.',                                                                                es: 'Personal.',                                                                                    zh: '自定义' },
    'tone.advanced':                      { en: 'Advanced Tone',                                                                          da: 'Avanceret tone',                                                                            es: 'Tono avanzado',                                                                                zh: '高级语气' },

    // ─── Format-prefs panel ────────────────────────────────────────
    'format.section_formats':             { en: 'SECTION FORMATS',                                                                        da: 'SEKTIONSFORMATER',                                                                          es: 'FORMATOS DE SECCIÓN',                                                                          zh: '章节格式' },
    'format.shape':                       { en: 'Shape',                                                                                  da: 'Form',                                                                                      es: 'Forma',                                                                                        zh: '形状' },
    'format.contour':                     { en: 'Contour',                                                                                da: 'Kontur',                                                                                    es: 'Contorno',                                                                                     zh: '轮廓' },
    'format.shadow':                      { en: 'Shadow',                                                                                 da: 'Skygge',                                                                                    es: 'Sombra',                                                                                       zh: '阴影' },
    'format.note_immediate':              {
      en: 'Format choices are saved with your profile and applied immediately. Future Generate runs will respect these preferences.',
      da: 'Formatvalg gemmes med din profil og anvendes med det samme. Fremtidige Generér-kørsler vil respektere disse præferencer.',
      es: 'Las opciones de formato se guardan en tu perfil y se aplican de inmediato. Las próximas generaciones respetarán estas preferencias.',
      zh: '格式选项会与您的个人资料一同保存，并立即生效。后续生成时将遵循这些偏好设置。',
    },

    // ─── Format explainer tiles ────────────────────────────────────
    'explainer.show':                     { en: 'Show me what each format looks like',                                                    da: 'Vis mig, hvordan hvert format ser ud',                                                      es: 'Muéstrame cómo se ve cada formato',                                                            zh: '展示每种格式的样式' },
    'explainer.paragraph':                { en: 'Paragraph',                                                                              da: 'Afsnit',                                                                                    es: 'Párrafo',                                                                                      zh: '段落' },
    'explainer.paragraph_desc':           { en: 'Pure prose. Best when the content reads naturally as a few sentences in a row.',
                                            da: 'Ren prosa. Bedst når indholdet læses naturligt som nogle få sætninger i træk.',
                                            es: 'Prosa pura. Ideal cuando el contenido fluye naturalmente como varias oraciones seguidas.',
                                            zh: '纯文字段落。适用于内容自然成段、连贯成句的情况。' },
    'explainer.bullets':                  { en: 'Bullets',                                                                                da: 'Punktopstilling',                                                                           es: 'Viñetas',                                                                                      zh: '项目符号' },
    'explainer.bullets_desc':             { en: 'Plain \u25aa markers. Best for short, parallel items.',
                                            da: 'Almindelige \u25aa markører. Bedst til korte, parallelle punkter.',
                                            es: 'Marcadores \u25aa simples. Ideal para elementos cortos y paralelos.',
                                            zh: '使用 \u25aa 标记。适用于简短、并列的条目。' },
    'explainer.emoji_bullets':            { en: 'Emoji bullets',                                                                          da: 'Emoji-punkter',                                                                             es: 'Viñetas con emoji',                                                                            zh: '表情符号项目' },
    'explainer.emoji_bullets_desc':       { en: 'Each bullet gets an emoji picked to fit its content (\ud83d\udcc9 for "reduced", \ud83d\ude80 for "launched"\u2026).',
                                            da: 'Hvert punkt får en emoji valgt efter indholdet (\ud83d\udcc9 for "reduceret", \ud83d\ude80 for "lanceret"\u2026).',
                                            es: 'Cada viñeta recibe un emoji elegido según su contenido (\ud83d\udcc9 para "reducido", \ud83d\ude80 para "lanzado"\u2026).',
                                            zh: '每个条目根据内容自动配上表情符号（\ud83d\udcc9 表示"降低"，\ud83d\ude80 表示"启动"\u2026\u2026）。' },
    'explainer.hybrid_1':                 { en: 'Hybrid 1',                                                                               da: 'Hybrid 1',                                                                                  es: 'Híbrido 1',                                                                                    zh: '混合 1' },
    'explainer.hybrid_1_desc':            { en: 'Intro line, then plain bullets. Frames the bullets with one factual setup sentence.',
                                            da: 'Indledning, derefter almindelige punkter. Rammer punkterne ind med én faktuel åbnersætning.',
                                            es: 'Línea introductoria, seguida de viñetas simples. Enmarca las viñetas con una oración fáctica de apertura.',
                                            zh: '一句引言，后接普通项目符号。用一句事实性陈述为后续要点定调。' },
    'explainer.hybrid_2':                 { en: 'Hybrid 2',                                                                               da: 'Hybrid 2',                                                                                  es: 'Híbrido 2',                                                                                    zh: '混合 2' },
    'explainer.hybrid_2_desc':            { en: 'Intro line, then emoji bullets. Same shape as Hybrid 1 with content-fitted emojis.',
                                            da: 'Indledning, derefter emoji-punkter. Samme form som Hybrid 1 med indholdstilpassede emojis.',
                                            es: 'Línea introductoria, seguida de viñetas con emoji. Mismo formato que Híbrido 1, con emojis acordes al contenido.',
                                            zh: '一句引言，后接表情符号项目。结构与混合 1 相同，但配以内容相关的表情符号。' },
    'explainer.hybrid_3':                 { en: 'Hybrid 3',                                                                               da: 'Hybrid 3',                                                                                  es: 'Híbrido 3',                                                                                    zh: '混合 3' },
    'explainer.hybrid_3_desc':            { en: 'Intro + emoji bullets + closing line. Full narrative arc for cover-letter sections.',
                                            da: 'Indledning + emoji-punkter + afsluttende linje. Fuld fortællebue til ansøgningssektioner.',
                                            es: 'Introducción + viñetas con emoji + línea de cierre. Arco narrativo completo para secciones de carta de presentación.',
                                            zh: '引言 + 表情符号项目 + 结语。为求职信章节构建完整的叙述弧。' },
    'explainer.table':                    { en: 'Two-column table',                                                                       da: 'To-kolonners tabel',                                                                        es: 'Tabla de dos columnas',                                                                        zh: '两栏表格' },
    'explainer.table_desc':               { en: 'Key/value pairs. Best for Core Competencies and What I Bring.',
                                            da: 'Nøgle/værdi-par. Bedst til Kernekompetencer og Hvad jeg medbringer.',
                                            es: 'Pares clave/valor. Ideal para Competencias clave y Qué aporto.',
                                            zh: '键值对结构。适用于核心能力和我能带来什么等章节。' },
    'explainer.tail':                     {
      en: 'Each section can be set independently — choose Paragraph for Profile, Emoji bullets for Selected Outcomes, Table for Core Competencies, and so on. Format choices are saved with your profile and applied immediately.',
      da: 'Hver sektion kan indstilles uafhængigt — vælg Afsnit til Profil, Emoji-punkter til Udvalgte Resultater, Tabel til Kernekompetencer, og så videre. Formatvalg gemmes med din profil og anvendes med det samme.',
      es: 'Cada sección se puede configurar de manera independiente — elige Párrafo para Perfil, Viñetas con emoji para Resultados destacados, Tabla para Competencias clave, y así sucesivamente. Las opciones de formato se guardan con tu perfil y se aplican de inmediato.',
      zh: '每个章节都可独立设置 —— 个人简介选择段落格式，主要成果选择表情符号项目，核心能力选择表格格式，依此类推。格式选项随个人资料一同保存并立即生效。',
    },

    // ─── Emoji controls ────────────────────────────────────────────
    'emoji.default_tooltip':              { en: 'Default emoji for this section. Used when a bullet has no per-item emoji.',
                                            da: 'Standardemoji for denne sektion. Bruges når et punkt ikke har sin egen emoji.',
                                            es: 'Emoji predeterminado para esta sección. Se usa cuando una viñeta no tiene un emoji propio.',
                                            zh: '本章节的默认表情符号。当某条目未单独指定表情时使用。' },
    'emoji.refit_tooltip':                { en: 'Refit all bullet emojis to match each line\u2019s content',
                                            da: 'Tilpas alle punkt-emojis så de matcher hver linjes indhold',
                                            es: 'Reajustar todos los emojis de viñeta para que coincidan con el contenido de cada línea',
                                            zh: '重新匹配所有条目的表情符号，使其与每行内容相符' },

    // ─── Audit labels ──────────────────────────────────────────────
    'audit.banned_label':                 { en: 'banned-word audit',                                                                      da: 'forbudte-ord-revision',                                                                     es: 'auditoría de palabras prohibidas',                                                             zh: '禁用词审核' },
    'audit.llm_label':                    { en: 'LLM audit',                                                                              da: 'LLM-revision',                                                                              es: 'auditoría de LLM',                                                                             zh: 'LLM 审核' },
  };

  // ─── Language selection ─────────────────────────────────────────
  // v1.40.172: extended from {en, da} → {en, da, es, zh}. Reads the
  // setup-language picker first; falls back to the language-bar
  // active language for users who never visited the onboarding
  // wizard.
  const SUPPORTED = ['en', 'da', 'es', 'zh'];

  function readLang() {
    try {
      // Primary: setup-language picker (onboarding wizard)
      const v = (localStorage.getItem('antcv:setup:lang') || '').trim().toLowerCase();
      if (SUPPORTED.indexOf(v) >= 0) return v;
      // Secondary: language-bar active language. The bar persists
      // its value as JSON-stringified — try parsing.
      try {
        const j = localStorage.getItem('language');
        if (j) {
          const parsed = JSON.parse(j);
          const code = String(parsed || '').trim().toLowerCase();
          if (SUPPORTED.indexOf(code) >= 0) return code;
        }
      } catch (_) {}
      return 'en';
    } catch (_) { return 'en'; }
  }

  // ─── Lookup ─────────────────────────────────────────────────────
  function t(key, fallbackEn) {
    const lang = readLang();
    const entry = STRINGS[key];
    if (entry) {
      if (lang !== 'en' && typeof entry[lang] === 'string' && entry[lang].trim()) return entry[lang];
      if (typeof entry.en === 'string' && entry.en) return entry.en;
    }
    if (typeof fallbackEn === 'string' && fallbackEn) return fallbackEn;
    return key;
  }

  function has(key, lang) {
    const l = lang || readLang();
    const e = STRINGS[key];
    return !!(e && typeof e[l] === 'string' && e[l].trim());
  }

  function missing(lang) {
    const l = lang || readLang();
    const out = [];
    Object.keys(STRINGS).forEach(function (k) {
      if (!has(k, l)) out.push(k);
    });
    return out;
  }

  // ─── Public API ─────────────────────────────────────────────────
  window.AntcvI18n = {
    version:   SCRIPT_VERSION,
    lang:      readLang,
    t:         t,
    has:       has,
    missing:   missing,
    STRINGS:   STRINGS,
    SUPPORTED: SUPPORTED,
  };
})();
