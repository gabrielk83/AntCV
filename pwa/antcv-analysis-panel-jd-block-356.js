/* AntCV Analysis-panel embedded JD block (v1.40.358)
 * ============================================================================
 *
 * Goal
 * ----
 * Put the JD-analysis INPUT controls (paste textarea + PDF/Word/Image upload +
 * a single "Analyse JD" button) INSIDE the in-app Analysis panel.
 *   - NO analysis captured yet -> the JD block IS the visible content.
 *   - An analysis IS present    -> the JD block sits BELOW the rendered result.
 *
 * v1.40.358
 * ---------
 * Clean rewrite. The branch copy had become corrupted (two conflicting
 * findAnalysisPanel definitions merged from parallel worktrees, leaving a
 * syntax error that stopped the whole sidecar from parsing). This version:
 *   - single, correct findAnalysisPanel() with two strategies;
 *   - TIGHTENED empty-state ancestor selection: instead of a fixed 6-hop
 *     climb, it climbs only while the ancestor stays a plausible panel column
 *     (bounded width growth, not the app shell, does not also contain the
 *     topbar / "Application history" controls), and picks the nearest scroll-
 *     ish container. This stops the block attaching to an oversized wrapper.
 *
 * Never edits app.js. Additive, idempotent, removable in one <script> line.
 *
 * Dependencies (from antcv-recheck-fit.js):
 *   window.AntcvRecheckFit._extractTextFromFile(file) -> Promise<string>
 *   window.AntcvRecheckFit._postJdAnalysis(proxyUrl, body) -> {status,body,raw}
 *   window.AntcvRecheckFit._renderJdAnalysis(container, data, T)
 * a single "Analyse JD" button) INSIDE the in-app Analysis panel — not in the
 * separate recheck-fit modal, and NOWHERE ELSE.
 *   - When NO analysis is captured yet  -> the JD block IS the visible content.
 *   - When an analysis IS present       -> the JD block sits BELOW the rendered
 *     analysis result.
 *
 * Placement contract (v1.40.356-d)
 * --------------------------------
 * The block MUST live only inside the editor side/bottom panel that app.js
 * renders for the Analysis view:
 *   desktop -> .antcv-editor-side-panel    (data-antcv-app-panel="desktop-side-panel")
 *   mobile  -> .antcv-mobile-bottom-panel  (data-antcv-app-panel="mobile-bottom-panel")
 * That SAME container is reused for the Section panel, so we inject ONLY when
 * the panel currently shows analysis content (the "📊 Application Analysis"
 * heading or the "Generate a CV first…" empty-state). We anchor to that exact
 * container and NEVER climb the DOM tree. Consequences (all intended):
 *   - desktop: block sits in the lower part of the right-side panel;
 *   - mobile: block sits in the bottom panel;
 *   - switching to the Section panel does NOT show it;
 *   - toggling the preview (which closes the side/bottom panel) hides it;
 *   - it never bleeds into the sidebar, the candidate band, or the setup view.
 *
 * Behaviour (user spec)
 * ---------------------
 *   - ONE unified block, NO tabs. A single run does BOTH analyses:
 *       * POST /api/recheck-fit   -> fit_score, summary, strengths, gaps
 *       * POST /api/jd-analysis   -> recruiter, red_flags, questions
 *     and merges ALL of it (rendered in-panel + written into `rationale`).
 *
 * Why a separate sidecar
 * ----------------------
 * The Analysis panel is rendered by app.js (minified, not hand-editable). This
 * sidecar only INJECTS a child block into that panel and reuses the transport
 * + renderers exposed by antcv-recheck-fit.js via window.AntcvRecheckFit. It
 * never edits app.js. Additive, idempotent, removable in one <script> line.
 *
 * History
 * -------
 * v1.40.356-b: target the heading leaf (the original matched the outermost
 *   wrapper, pushing the block off-screen).
 * v1.40.356-c: repair a botched auto-merge that left a brace unclosed so the
 *   file failed to parse ("Unexpected token ')'").
 * v1.40.356-d: remove the greedy empty-state DOM-climb that injected into a
 *   top-level container (the block spread across the sidebar / setup view).
 *   Anchor strictly to .antcv-editor-side-panel / .antcv-mobile-bottom-panel,
 *   and only when that panel shows analysis content.
 */
(function () {
  'use strict';

  var VERSION = '1.51.361-analysis-on-open';
  if (window.__antcvAnalysisPanelJdBlock356 === VERSION) return;
  window.__antcvAnalysisPanelJdBlock356 = VERSION;

  var BLOCK_ID = 'antcv-analysis-panel-jd-block';
  var STYLE_ID = 'antcv-analysis-panel-jd-block-css';
  var RATIONALE_KEY = 'rationale';
  // OPEN-ANALYSIS-AUTORUN-001: fingerprint of the last auto-analysed JD, so
  // each JD gets AT MOST one automatic run (reopens and panel re-injections
  // never re-spend the LLM calls).
  var AUTORUN_KEY = 'antcv:apjbAutoAnalysed';
  function jdFingerprint(s) {
    s = String(s || '');
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return s.length + ':' + h;
  }
  function rationaleHasAnalysis(r) {
    return !!(r && (r.summary || r.strengths || r.gaps || r.fit_score !== undefined || r.recruiter !== undefined));
  }

  // Empty-state message fragments (EN + DA), lowercase for compare.
  var EMPTY_MARKERS = [
    'generate a cv first',
    'see the analysis',
    'generer et cv',
    'for at se analysen'
  ];
  // Text that means we have climbed OUT of the panel into the app shell.
  var SHELL_MARKERS = [
    'application history',
    'current file',
    'switch to advanced',
    'open advanced'
  ];

  function readProxyUrl() {
    try {
      var raw = localStorage.getItem('proxyUrl');
      var v = '';
      if (raw) {
        try { v = String(JSON.parse(raw)); } catch (_) { v = String(raw); }
      }
      v = v.trim().replace(/\/+$/, '');
      if (v) return v;
      // Demo / shared mode: localStorage.proxyUrl is empty (the user never set a
      // proxy) but the JD /api/* endpoints run on the access-relay, whose base
      // lives in window.ANTCV_RELAY_URL (relay-config.json). Fall back to it so
      // "Analyse JD" works in demo instead of erroring "Proxy URL not configured".
      if (typeof window !== 'undefined' && typeof window.ANTCV_RELAY_URL === 'string') {
        var rel = window.ANTCV_RELAY_URL.trim().replace(/\/+$/, '');
        if (rel) return rel;
      }
    } catch (_) {}
    return '';
  }
  function readSections(key) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return null;
      var p = JSON.parse(raw);
      return Array.isArray(p) ? p : null;
    } catch (_) { return null; }
  }
  // OPEN-ANALYSIS-AUTORUN-001: the app's live section store ({cv,cl}) — the
  // ACTIVE application's own content, unlike the legacy cv_pwa_sections
  // mirror which can lag behind an application switch.
  function readLiveSections() {
    try {
      var raw = localStorage.getItem('sections');
      if (!raw) return null;
      var p = JSON.parse(raw);
      return p && typeof p === 'object' && (Array.isArray(p.cv) || Array.isArray(p.cl)) ? p : null;
    } catch (_) { return null; }
  }
  // Template skeletons carry "[placeholder]" strings — a section list only
  // counts as a real CV/CL when some content string is NOT a placeholder.
  function sectionsHaveContent(list) {
    if (!Array.isArray(list) || !list.length) return false;
    var KEYS = ['content', 'text', 't', 'items', 'rows', 'left', 'right', 'intro', 'closing'];
    var found = false;
    function walk(v) {
      if (found || v == null) return;
      if (typeof v === 'string') {
        var q = v.trim();
        if (q && q.charAt(0) !== '[') found = true;
        return;
      }
      if (Array.isArray(v)) { for (var i = 0; i < v.length; i++) walk(v[i]); return; }
      if (typeof v === 'object') { for (var k = 0; k < KEYS.length; k++) { if (KEYS[k] in v) walk(v[KEYS[k]]); } }
    }
    for (var i = 0; i < list.length; i++) {
      var s = list[i];
      if (s && s.on !== false) walk(s);
    }
    return found;
  }
  function readLanguage() {
    try {
      var raw = localStorage.getItem('language');
      if (!raw) return 'en';
      try { return String(JSON.parse(raw)).toLowerCase(); }
      catch (_) { return String(raw).toLowerCase(); }
    } catch (_) { return 'en'; }
  }
  function readRationale() {
    try {
      var raw = localStorage.getItem(RATIONALE_KEY);
      if (!raw) return null;
      var v = JSON.parse(raw);
      return v && typeof v === 'object' ? v : null;
    } catch (_) { return null; }
  }
  function writeRationale(obj) {
    try { localStorage.setItem(RATIONALE_KEY, JSON.stringify(obj)); return true; }
    catch (_) { return false; }
  }
  function fireMerge() {
    try { window.dispatchEvent(new CustomEvent('antcv:rationale-merge', { detail: { source: 'analysis-panel-jd-block-356' } })); }
    catch (_) {}
  }

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'style' && typeof attrs[k] === 'object') { for (var s in attrs[k]) e.style[s] = attrs[k][s]; }
        else if (k === 'className') e.className = attrs[k];
        else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        else if (k === 'text') e.textContent = attrs[k];
        else e.setAttribute(k, attrs[k]);
      }
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return e;
  }

  function T() {
    // ANALYSIS-PANEL-I18N-001 (owner 2026-07-12): labels in EVERY app language
    // (was en/da only). The panel language follows the opened application; a
    // language without a dict here falls back to English — when a new language
    // is added in Settings, add its block to LABELS below.
    var DA = {
      heading: 'Analysér mod et jobopslag',
      jdLabel: 'Jobopslag (indsæt teksten)',
      upload: 'Eller upload:', uploadJd: '⬆ Upload jobopslag',
      pdf: 'PDF', word: 'Word', image: 'Billede',
      run: 'Analysér JD', running: 'Analyserer…',
      reading: 'Læser {file}…',
      fileErr: 'Filfejl: {err}',
      urlPh: '🔗 Indsæt JD-URL (HR-on, Workday, Greenhouse, Lever, LinkedIn…)',
      fetching: 'Henter JD…',
      urlErr: 'Kunne ikke hente jobopslaget fra URL’en.',
      noProxy: 'Proxy-URL er ikke konfigureret. Åbn Indstillinger.',
      jdShort: 'Indsæt et jobopslag på mindst 50 tegn.',
      compareHint: 'Sammenlign det genererede CV med et eksisterende jobopslag.',
      emptyHint: 'Indsæt eller upload et jobopslag for at køre analysen.',
      fitScore: 'Match-score', strengths: 'Styrker', gaps: 'Mangler',
      recruiter: 'Rekrutterer', redFlags: 'Røde flag', questions: 'Spørgsmål at stille',
      noRecruiter: 'Ingen tydelig rekrutterer fundet.', noRedFlags: 'Ingen røde flag fundet.',
      noQuestions: 'Ingen forslag til spørgsmål.', done: 'Analyse opdateret.',
    };
    var EN = {
      heading: 'Analyse against a job description',
      jdLabel: 'Job description (paste here)',
      upload: 'Or upload:', uploadJd: '⬆ Upload JD',
      pdf: 'PDF', word: 'Word', image: 'Image',
      run: 'Analyse JD', running: 'Analysing…',
      reading: 'Reading {file}…',
      fileErr: 'File error: {err}',
      urlPh: '🔗 Paste JD URL (HR-on, Workday, Greenhouse, Lever, LinkedIn…)',
      fetching: 'Fetching JD…',
      urlErr: 'Could not fetch the job description from that URL.',
      noProxy: 'Proxy URL is not configured. Open Settings.',
      jdShort: 'Paste a job description of at least 50 characters.',
      compareHint: 'Compare the generated CV against an existing job description.',
      emptyHint: 'Paste or upload a job description to run the analysis.',
      fitScore: 'Fit score', strengths: 'Strengths', gaps: 'Gaps',
      recruiter: 'Recruiter', redFlags: 'Red flags', questions: 'Questions to ask',
      noRecruiter: 'No clear recruiter info found.', noRedFlags: 'No red flags found.',
      noQuestions: 'No suggested questions.', done: 'Analysis updated.',
    };
    var ES = {
      heading: 'Analizar contra una oferta de empleo',
      jdLabel: 'Oferta de empleo (pegar aquí)',
      upload: 'O subir:', uploadJd: '⬆ Subir oferta',
      pdf: 'PDF', word: 'Word', image: 'Imagen',
      run: 'Analizar oferta', running: 'Analizando…',
      reading: 'Leyendo {file}…',
      fileErr: 'Error de archivo: {err}',
      urlPh: '🔗 Pegar URL de la oferta (HR-on, Workday, Greenhouse, Lever, LinkedIn…)',
      fetching: 'Obteniendo la oferta…',
      urlErr: 'No se pudo obtener la oferta desde esa URL.',
      noProxy: 'La URL del proxy no está configurada. Abre Configuración.',
      jdShort: 'Pega una oferta de al menos 50 caracteres.',
      compareHint: 'Compara el CV generado con una oferta de empleo existente.',
      emptyHint: 'Pega o sube una oferta de empleo para ejecutar el análisis.',
      fitScore: 'Puntuación de ajuste', strengths: 'Fortalezas', gaps: 'Carencias',
      recruiter: 'Reclutador', redFlags: 'Señales de alerta', questions: 'Preguntas para hacer',
      noRecruiter: 'No se encontró información clara del reclutador.', noRedFlags: 'Sin señales de alerta.',
      noQuestions: 'Sin preguntas sugeridas.', done: 'Análisis actualizado.',
    };
    var ZH = {
      heading: '对照职位描述进行分析',
      jdLabel: '职位描述（粘贴到此处）',
      upload: '或上传：', uploadJd: '⬆ 上传职位描述',
      pdf: 'PDF', word: 'Word', image: '图片',
      run: '分析职位描述', running: '分析中…',
      reading: '正在读取 {file}…',
      fileErr: '文件错误：{err}',
      urlPh: '🔗 粘贴职位链接（HR-on、Workday、Greenhouse、Lever、LinkedIn…）',
      fetching: '正在获取职位描述…',
      urlErr: '无法从该链接获取职位描述。',
      noProxy: '未配置代理地址。请打开设置。',
      jdShort: '请粘贴至少 50 个字符的职位描述。',
      compareHint: '将生成的简历与现有职位描述进行对比。',
      emptyHint: '粘贴或上传职位描述以运行分析。',
      fitScore: '匹配度', strengths: '优势', gaps: '差距',
      recruiter: '招聘负责人', redFlags: '风险提示', questions: '建议提问',
      noRecruiter: '未找到明确的招聘负责人信息。', noRedFlags: '未发现风险提示。',
      noQuestions: '暂无建议提问。', done: '分析已更新。',
    };
    var HE = {
      heading: 'ניתוח מול תיאור משרה',
      jdLabel: 'תיאור המשרה (הדביקו כאן)',
      upload: 'או העלאה:', uploadJd: '⬆ העלאת תיאור משרה',
      pdf: 'PDF', word: 'Word', image: 'תמונה',
      run: 'ניתוח משרה', running: 'מנתח…',
      reading: 'קורא את {file}…',
      fileErr: 'שגיאת קובץ: {err}',
      urlPh: '🔗 הדביקו קישור למשרה (HR-on, Workday, Greenhouse, Lever, LinkedIn…)',
      fetching: 'מוריד את תיאור המשרה…',
      urlErr: 'לא ניתן להוריד את תיאור המשרה מהקישור.',
      noProxy: 'כתובת הפרוקסי אינה מוגדרת. פתחו הגדרות.',
      jdShort: 'הדביקו תיאור משרה של 50 תווים לפחות.',
      compareHint: 'השוו את קורות החיים שנוצרו מול תיאור משרה קיים.',
      emptyHint: 'הדביקו או העלו תיאור משרה כדי להריץ את הניתוח.',
      fitScore: 'ציון התאמה', strengths: 'חוזקות', gaps: 'פערים',
      recruiter: 'מגייס/ת', redFlags: 'דגלים אדומים', questions: 'שאלות לשאול',
      noRecruiter: 'לא נמצא מידע ברור על המגייס.', noRedFlags: 'לא נמצאו דגלים אדומים.',
      noQuestions: 'אין שאלות מוצעות.', done: 'הניתוח עודכן.',
    };
    var AM = {
      heading: 'ከሥራ ማስታወቂያ ጋር ማነጻጸር',
      jdLabel: 'የሥራ ማስታወቂያ (እዚህ ይለጥፉ)',
      upload: 'ወይም ይጫኑ:', uploadJd: '⬆ የሥራ ማስታወቂያ ይጫኑ',
      pdf: 'PDF', word: 'Word', image: 'ምስል',
      run: 'ማስታወቂያ ተንትን', running: 'በመተንተን ላይ…',
      reading: '{file} በማንበብ ላይ…',
      fileErr: 'የፋይል ስህተት: {err}',
      urlPh: '🔗 የማስታወቂያ አገናኝ ይለጥፉ (HR-on, Workday, Greenhouse, Lever, LinkedIn…)',
      fetching: 'ማስታወቂያውን በማምጣት ላይ…',
      urlErr: 'ከዚያ አገናኝ ማስታወቂያውን ማምጣት አልተቻለም።',
      noProxy: 'የፕሮክሲ አድራሻ አልተዋቀረም። ቅንብሮችን ይክፈቱ።',
      jdShort: 'ቢያንስ 50 ቁምፊ ያለው ማስታወቂያ ይለጥፉ።',
      compareHint: 'የተፈጠረውን CV ካለ የሥራ ማስታወቂያ ጋር ያነጻጽሩ።',
      emptyHint: 'ትንተናውን ለማካሄድ ማስታወቂያ ይለጥፉ ወይም ይጫኑ።',
      fitScore: 'የመመጣጠን ውጤት', strengths: 'ጥንካሬዎች', gaps: 'ክፍተቶች',
      recruiter: 'ቀጣሪ', redFlags: 'ማስጠንቀቂያዎች', questions: 'መጠየቅ ያለባቸው ጥያቄዎች',
      noRecruiter: 'ግልጽ የቀጣሪ መረጃ አልተገኘም።', noRedFlags: 'ማስጠንቀቂያ አልተገኘም።',
      noQuestions: 'የተጠቆሙ ጥያቄዎች የሉም።', done: 'ትንተናው ተዘምኗል።',
    };
    var LABELS = { da: DA, es: ES, zh: ZH, he: HE, am: AM };
    var L = String(readLanguage() || 'en').slice(0, 2);
    return LABELS[L] ? Object.assign({}, EN, LABELS[L]) : EN;
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = ''
      + '#' + BLOCK_ID + '{margin-top:16px;padding-top:14px;border-top:1px solid #e8e8e8;font-family:Calibri,Arial,sans-serif;}'
      + '#' + BLOCK_ID + ' .apjb-heading{font-size:12px;font-weight:700;color:#283556;letter-spacing:.4px;text-transform:uppercase;margin-bottom:8px;}'
      + '#' + BLOCK_ID + ' .apjb-hint{font-size:11px;color:#6b7280;margin-bottom:8px;line-height:1.4;}'
      // v1.50.74 — JD textarea halved (96->48) so it stops hiding the rows
      // below it; still user-resizable. The host side/bottom panels are made
      // scrollable so the Analyse button + results stay reachable on mobile.
      + '#' + BLOCK_ID + ' .apjb-textarea{width:100%;min-height:48px;padding:8px 10px;font-family:Georgia,serif;font-size:12.5px;line-height:1.45;color:#333;border:1px solid #d0d2d6;border-radius:6px;resize:vertical;box-sizing:border-box;}'
      + '.antcv-editor-side-panel,.antcv-mobile-bottom-panel{overflow-y:auto;-webkit-overflow-scrolling:touch;}'
      + '#' + BLOCK_ID + ' .apjb-textarea:focus{outline:none;border-color:#01B7BB;box-shadow:0 0 0 3px rgba(1,183,187,.18);}'
      + '#' + BLOCK_ID + ' .apjb-uprow{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;}'
      + '#' + BLOCK_ID + ' .apjb-uplabel{font-size:11px;color:#6b7280;font-weight:600;}'
      + '#' + BLOCK_ID + ' .apjb-upbtn{font-size:11px;font-weight:600;padding:4px 10px;background:#fff;color:#283556;border:1px solid #283556;border-radius:4px;cursor:pointer;}'
      + '#' + BLOCK_ID + ' .apjb-upbtn:hover{background:#f5f5f5;}'
      + '#' + BLOCK_ID + ' .apjb-url{flex:1 1 160px;min-width:0;padding:5px 8px;font-family:Georgia,serif;font-size:11px;color:#333;border:1px solid #d0d2d6;border-radius:4px;box-sizing:border-box;}'
      + '#' + BLOCK_ID + ' .apjb-url:focus{outline:none;border-color:#01B7BB;box-shadow:0 0 0 3px rgba(1,183,187,.18);}'
      + '#' + BLOCK_ID + ' .apjb-status{font-size:11px;color:#6b7280;margin-top:4px;min-height:14px;}'
      + '#' + BLOCK_ID + ' .apjb-run{margin-top:10px;padding:9px 16px;font-size:12.5px;font-weight:700;color:#fff;background:#00746E;border:none;border-radius:6px;cursor:pointer;}'
      + '#' + BLOCK_ID + ' .apjb-run:hover{background:#01B7BB;}'
      + '#' + BLOCK_ID + ' .apjb-run:disabled{background:#999;cursor:wait;}'
      + '#' + BLOCK_ID + ' .apjb-err{margin-top:8px;padding:8px 10px;background:#ffe9ec;color:#c22b50;border:1px solid #f59e0b;border-radius:6px;font-size:11.5px;}'
      + '#' + BLOCK_ID + ' .apjb-ok{margin-top:8px;padding:6px 10px;background:#eaf7f7;color:#07545e;border-left:3px solid #00746E;border-radius:4px;font-size:11.5px;}'
      + '#' + BLOCK_ID + ' .apjb-results{margin-top:12px;}';
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  function previewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  function containsShellMarker(node) {
    var tc = (node.textContent || '').toLowerCase();
    for (var i = 0; i < SHELL_MARKERS.length; i++) {
      if (tc.indexOf(SHELL_MARKERS[i]) >= 0) return true;
    }
    return false;
  }

  // Strategy 1: analysis-present panel, keyed by the heading LEAF
  // "Application Analysis"; return its parent (the panel body).
  function findByHeading() {
    var nodes = document.querySelectorAll('div');
    var headings = [];
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var txt = (node.textContent || '').replace(/[ \t\r\n]+/g, ' ').trim();
      if (txt.indexOf('Application Analysis') < 0) continue;
      var stripped = txt.replace(/[^\x20-\x7E]/g, '').trim(); // drop emoji
      if (stripped.indexOf('Application Analysis') !== 0) continue;
      if (stripped.length > 40) continue;                 // wrapper would be long
      if (node.children && node.children.length > 1) continue; // leaf-ish
      headings.push(node);
    }
    if (!headings.length) return null;
    var heading = headings[headings.length - 1];
    return (heading.parentNode && heading.parentNode.nodeType === 1) ? heading.parentNode : heading;
  }

  // v1.50.58 — single, correct panel finder (repairs the merge-corrupted
  // region that left a stray `marker` reference + duplicate definition, which
  // broke the whole sidecar with "Unexpected token ')'").
  //
  // The Analysis content (both the "Application Analysis" heading AND the
  // empty-state "Generate a CV first..." message) is rendered by app.js inside
  // the editor side-panel container:
  //   desktop -> .antcv-editor-side-panel   (data-antcv-app-panel="desktop-side-panel")
  //   mobile  -> .antcv-mobile-bottom-panel (data-antcv-app-panel="mobile-bottom-panel")
  // The SAME container is reused for the Section panel, so we inject ONLY when
  // the panel currently holds analysis content. We anchor to that exact
  // container (no DOM climb) so the block stays in the side/bottom panel and
  // never bleeds into the sidebar or the Section view.
  var PANEL_SEL = '.antcv-editor-side-panel, .antcv-mobile-bottom-panel, [data-antcv-app-panel]';

  function panelShowsAnalysis(panel) {
    if (!panel) return false;
    var txt = (panel.textContent || '');
    if (txt.indexOf('Application Analysis') >= 0) return true; // analysis present
    var low = txt.toLowerCase();
    for (var m = 0; m < EMPTY_MARKERS.length; m++) {
      if (low.indexOf(EMPTY_MARKERS[m]) >= 0) return true;      // empty state
    }
    return false;
  }

  function findAnalysisPanel() {
    var paper = previewPaper();
    var panels = document.querySelectorAll(PANEL_SEL);
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      // Never inject into something inside the rendered document/preview.
      if (paper && (paper.contains(p) || p.contains(paper))) continue;
      if (panelShowsAnalysis(p)) return p;
    }
    // Fallback: the heading-leaf strategy (covers layouts that do not expose
    // the data-antcv-app-panel container).
    return findByHeading();
  }

  async function postRecheckFit(proxyUrl, body) {
    var r = await fetch(proxyUrl + '/api/recheck-fit', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    var parsed = null;
    try { parsed = await r.json(); } catch (_) {}
    return { status: r.status, body: parsed };
  }

  function renderFit(container, a, t) {
    if (!a || typeof a !== 'object') return;
    var score = Math.max(0, Math.min(1, Number(a.fit_score) || 0));
    container.appendChild(el('div', { style: { fontSize: '11px', fontWeight: '700', color: '#00746E', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: '4px' } },
      t.fitScore + ' — ' + Math.round(score * 100) + '%'));
    var bar = el('div', { style: { position: 'relative', height: '14px', background: 'linear-gradient(to right,#c22b50 0%,#f59e0b 40%,#00746E 75%)', borderRadius: '7px', overflow: 'hidden', margin: '4px 0 12px' } });
    bar.appendChild(el('div', { style: { position: 'absolute', top: '-2px', height: '18px', width: '3px', background: '#283556', border: '1px solid #fff', borderRadius: '2px', left: (score * 100).toFixed(1) + '%', transform: 'translateX(-50%)' } }));
    container.appendChild(bar);
    if (a.summary) container.appendChild(el('div', { style: { fontSize: '12px', lineHeight: '1.5', color: '#333', background: '#f7fafa', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px' } }, a.summary));
    var strengths = Array.isArray(a.strengths) ? a.strengths : [];
    var gaps = Array.isArray(a.gaps) ? a.gaps : [];
    if (strengths.length) {
      container.appendChild(el('div', { style: { fontSize: '11px', fontWeight: '700', color: '#00746E', textTransform: 'uppercase', letterSpacing: '.5px', margin: '4px 0 4px' } }, t.strengths + ' (' + strengths.length + ')'));
      var su = el('ul', { style: { margin: '0 0 10px', paddingLeft: '18px', fontSize: '12px', lineHeight: '1.5' } });
      strengths.forEach(function (x) { var li = el('li', null); var b = el('b', null, x.skill || ''); li.appendChild(b); if (x.evidence) li.appendChild(document.createTextNode(' — ' + x.evidence)); su.appendChild(li); });
      container.appendChild(su);
    }
    if (gaps.length) {
      container.appendChild(el('div', { style: { fontSize: '11px', fontWeight: '700', color: '#c22b50', textTransform: 'uppercase', letterSpacing: '.5px', margin: '4px 0 4px' } }, t.gaps + ' (' + gaps.length + ')'));
      var gu = el('ul', { style: { margin: '0 0 10px', paddingLeft: '18px', fontSize: '12px', lineHeight: '1.5' } });
      gaps.forEach(function (x) { var li = el('li', null); var b = el('b', null, x.missing || ''); li.appendChild(b); if (x.jd_mention) li.appendChild(document.createTextNode(' — ' + x.jd_mention)); gu.appendChild(li); });
      container.appendChild(gu);
    }
  }

  function hideEmptyPlaceholder(panel) {
    if (!panel) return;
    var nodes = panel.querySelectorAll('div, p, span');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.id === BLOCK_ID || (n.closest && n.closest('#' + BLOCK_ID))) continue;
      if (n.children && n.children.length > 1) continue;
      var tc = (n.textContent || '').toLowerCase();
      if (tc.length > 120) continue;
      for (var m = 0; m < EMPTY_MARKERS.length; m++) {
        if (tc.indexOf(EMPTY_MARKERS[m]) >= 0) {
          n.setAttribute('data-antcv-jd-empty-hidden', '1');
          n.style.display = 'none';
          break;
        }
      }
    }
  }

  function buildBlock() {
    var t = T();
    var rationale = readRationale();
    var hasAnalysis = rationaleHasAnalysis(rationale);

    var wrap = el('div', { id: BLOCK_ID });
    wrap.appendChild(el('div', { className: 'apjb-heading' }, t.heading));
    wrap.appendChild(el('div', { className: 'apjb-hint' }, hasAnalysis ? t.compareHint : t.emptyHint));

    var ta = el('textarea', { className: 'apjb-textarea', placeholder: t.jdLabel + '…' });
    // OPEN-JD-VISIBLE-001 (owner 2026-07-12): an application opened from the
    // Job Tracker (or any cloud restore) mirrors its JD in antcv:lastJdText —
    // prefill it here so the analysis eats the SAME JD without a re-paste.
    try {
      var lastJd = String(localStorage.getItem('antcv:lastJdText') || '').trim();
      if (lastJd.length >= 50) ta.value = lastJd;
    } catch (_) {}
    wrap.appendChild(ta);

    var status = el('div', { className: 'apjb-status' });
    // v1.50.153 — one "Upload JD" input accepting every JD-bearing format.
    // PDF/DOCX/TXT/image go through AntcvRecheckFit._extractTextFromFile (the
    // shared extractor — same pdf.js→garbled→LLM→vision-OCR cascade the
    // Generate/wizard uploads use). JSON (a saved application export) is parsed
    // locally and its JD text pulled out.
    var fileInput = el('input', { type: 'file', accept: '.pdf,.doc,.docx,.txt,.json,image/*', style: { display: 'none' } });
    fileInput.addEventListener('change', async function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      status.textContent = t.reading.replace('{file}', f.name);
      try {
        var ext = (f.name.split('.').pop() || '').toLowerCase();
        var text;
        if (ext === 'json') {
          var raw = await f.text();
          try {
            var j = JSON.parse(raw);
            text = j.jd_text || j.jd || j.description ||
                   (j.application && (j.application.jd_text || j.application.jd)) ||
                   (typeof j === 'string' ? j : JSON.stringify(j, null, 2));
          } catch (_) { text = raw; }
        } else {
          var rf = window.AntcvRecheckFit;
          if (!rf || typeof rf._extractTextFromFile !== 'function') throw new Error('extractor unavailable');
          text = await rf._extractTextFromFile(f);
        }
        if (!text || String(text).length < 20) throw new Error('no usable text');
        ta.value = text;
        status.textContent = '';
      } catch (e) {
        status.textContent = t.fileErr.replace('{err}', String((e && e.message) || e));
      }
    });
    function upBtn(label, accept) {
      return el('button', { className: 'apjb-upbtn', type: 'button', onClick: function () { fileInput.setAttribute('accept', accept); fileInput.click(); } }, label);
    }
    // v1.50.153 — single "Upload JD" button (replaces the PDF/Word/Image trio).
    // Accepts every supported format incl. JSON; the OS picker filters by it.
    // OPEN-JD-VISIBLE-001: a JD-URL input sits next to it — same placeholder
    // and same /api/fetch-jd-url pipeline as the main upload-step URL field.
    // "Analyse JD" fetches the URL first when the textarea is empty.
    var urlInput = el('input', { className: 'apjb-url', type: 'url', placeholder: t.urlPh });
    var uprow = el('div', { className: 'apjb-uprow' },
      upBtn(t.uploadJd, '.pdf,.doc,.docx,.txt,.json,image/*'), urlInput, fileInput);
    wrap.appendChild(uprow);
    wrap.appendChild(status);

    var errBox = el('div', { className: 'apjb-err', style: { display: 'none' } });
    var okBox = el('div', { className: 'apjb-ok', style: { display: 'none' } });
    var results = el('div', { className: 'apjb-results' });

    var runBtn = el('button', { className: 'apjb-run', type: 'button' }, t.run);
    runBtn.addEventListener('click', async function () {
      errBox.style.display = 'none'; okBox.style.display = 'none'; results.innerHTML = '';
      var proxyUrl = readProxyUrl();
      if (!proxyUrl) { errBox.textContent = t.noProxy; errBox.style.display = 'block'; return; }
      var jd = (ta.value || '').trim();
      // OPEN-JD-VISIBLE-001: URL given + no pasted text → fetch the JD from the
      // URL first (same proxy endpoint as the main "Fetch JD" flow), fill the
      // textarea, then continue straight into the analysis.
      var jdUrl = (urlInput.value || '').trim();
      if (jdUrl && jd.length < 50) {
        runBtn.disabled = true; runBtn.textContent = t.fetching;
        try {
          var fres = await fetch(proxyUrl + '/api/fetch-jd-url', {
            method: 'POST', credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: jdUrl }),
          });
          var fjson = null;
          try { fjson = await fres.json(); } catch (_) {}
          if (fres.ok && fjson && fjson.ok !== false && fjson.text && String(fjson.text).trim().length >= 50) {
            ta.value = String(fjson.text);
            jd = ta.value.trim();
            status.textContent = '';
          } else {
            errBox.textContent = t.urlErr + ((fjson && (fjson.error || fjson.wall_hint)) ? ' ' + (fjson.error || fjson.wall_hint) : '');
            errBox.style.display = 'block';
            return;
          }
        } catch (e) {
          errBox.textContent = t.urlErr + ' ' + String((e && e.message) || e);
          errBox.style.display = 'block';
          return;
        } finally {
          runBtn.disabled = false; runBtn.textContent = t.run;
        }
      }
      if (jd.length < 50) { errBox.textContent = t.jdShort; errBox.style.display = 'block'; return; }
      // OPEN-ANALYSIS-AUTORUN-001: the ACTIVE application's live sections win;
      // the legacy cv_pwa_sections mirror is only consulted when no live store
      // exists at all. A live store WITHOUT real content (fresh template after
      // a Job-Tracker Open) means this application has no CV yet — the fit
      // half is skipped instead of scoring the JD against a template or a
      // PREVIOUS application's leftovers; the JD-analysis half still runs.
      var live = readLiveSections();
      var cvSections = null, clSections = null;
      if (live) {
        if (sectionsHaveContent(live.cv)) cvSections = live.cv;
        if (sectionsHaveContent(live.cl)) clSections = live.cl;
      } else {
        cvSections = readSections('cv_pwa_sections');
        clSections = readSections('cl_pwa_sections');
      }

      runBtn.disabled = true; runBtn.textContent = t.running;
      try {
        var summaryStr = cvSections ? JSON.stringify(cvSections).slice(0, 8000) : '';
        var rfBody = { jd_text: jd, cv_sections: cvSections || [], doc_target: clSections ? 'both' : 'cv' };
        if (clSections) rfBody.cl_sections = clSections;

        var rf = window.AntcvRecheckFit;
        var pFit = cvSections
          ? postRecheckFit(proxyUrl, rfBody).catch(function () { return null; })
          : Promise.resolve(null);
        var pJd = (rf && typeof rf._postJdAnalysis === 'function')
          ? rf._postJdAnalysis(proxyUrl, { jd_text: jd, candidate_summary: summaryStr, search_recruiter: true }).catch(function () { return null; })
          : Promise.resolve(null);

        var resFit = await pFit;
        var resJd = await pJd;

        var fit = (resFit && resFit.status === 200 && resFit.body && resFit.body.ok) ? resFit.body.analysis : null;
        var jdA = (resJd && resJd.status === 200 && resJd.body && resJd.body.ok) ? (resJd.body.analysis || resJd.body) : null;

        if (fit) renderFit(results, fit, t);
        // UPPER-REPORT-REORG-001 (owner 2026-07-03): the lower Recruiter /
        // Questions / Red-flags cards (rf._renderJdAnalysis) are GONE from this
        // block — the same data now renders in the upper report (app.js
        // Recruiter + Red Flags sections; antcv-analysis-report-pdf-360.js
        // fills Recruiter-empty + Questions inside #antcv-analysis-report).
        // The rationale merge below still feeds them. renderFit stays as
        // in-place run feedback.

        var merged = readRationale() || {};
        if (fit) {
          if (fit.summary !== undefined) merged.summary = fit.summary;
          if (fit.fit_score !== undefined) merged.fit_score = fit.fit_score;
          if (fit.strengths !== undefined) merged.strengths = fit.strengths;
          if (fit.gaps !== undefined) merged.gaps = fit.gaps;
          if (fit.suggested_edits !== undefined) merged.suggested_edits = fit.suggested_edits;
        }
        if (jdA) {
          if (jdA.recruiter !== undefined) merged.recruiter = jdA.recruiter;
          merged.red_flags = (jdA.red_flags !== undefined) ? jdA.red_flags : (merged.red_flags || []);
          if (jdA.questions !== undefined) merged.questions_in_jd = jdA.questions;
          else if (jdA.questions_in_jd !== undefined) merged.questions_in_jd = jdA.questions_in_jd;
          // v1.50.146 — honesty-first fields for the Analysis report PDF
          // (antcv-analysis-report-pdf-360.js). Produced by the same
          // jd-analysis pass; merged here so the panel + export see them.
          if (jdA.assumptions !== undefined) merged.assumptions = jdA.assumptions;
          if (jdA.recommendations !== undefined) merged.recommendations = jdA.recommendations;
          if (jdA.confidence_notes !== undefined) merged.confidence_notes = jdA.confidence_notes;
          // MARKET-FIT-QUAL-BRIDGE-001 (2026-08-16): carry the two fields the
          // relay's cluster pipeline consumes — persistQualifications reads
          // rationale.qualifications, the app.js category resolver reads
          // rationale.category. jd-analysis.js has produced both since 935f220,
          // but this hand-written field list dropped them, which is why
          // jd_count ("Based on N jobs in this category") stayed 0 everywhere.
          if (Array.isArray(jdA.qualifications) && jdA.qualifications.length) merged.qualifications = jdA.qualifications;
          if (typeof jdA.category === 'string' && jdA.category.trim() && jdA.category !== 'unsolicited') merged.category = jdA.category.trim();
        }
        merged._jdAnalysisMergedAt = Date.now();
        if (writeRationale(merged)) fireMerge();

        if (!fit && !jdA) {
          errBox.textContent = 'Analysis failed — check the connection and try again.';
          errBox.style.display = 'block';
        } else {
          okBox.textContent = t.done; okBox.style.display = 'block';
          // OPEN-ANALYSIS-AUTORUN-001: persist the analysis on the application
          // ROW (partial PUT — the relay whitelists rationale). The restore
          // applies the row's rationale LAST, so a local-only merge would be
          // clobbered on the next Open; landing it on the row makes the
          // analysis reappear in the panel every time the app is reopened.
          try {
            var appId = window.AntcvJdScope && window.AntcvJdScope.getCurrentAppId && window.AntcvJdScope.getCurrentAppId();
            if (appId && /^\d+$/.test(String(appId))) {
              fetch(proxyUrl + '/api/applications/' + appId, {
                method: 'PUT', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rationale: merged }),
              }).catch(function () {});
            }
          } catch (_) {}
        }
      } catch (e) {
        errBox.textContent = String((e && e.message) || e); errBox.style.display = 'block';
      } finally {
        runBtn.disabled = false; runBtn.textContent = t.run;
      }
    });

    // Enter in the URL field = fetch + analyse (one keystroke, same handler).
    urlInput.addEventListener('keydown', function (ev) {
      if (ev.key === 'Enter') { ev.preventDefault(); runBtn.click(); }
    });

    wrap.appendChild(runBtn);
    wrap.appendChild(errBox);
    wrap.appendChild(okBox);
    wrap.appendChild(results);

    // OPEN-ANALYSIS-AUTORUN-001 (owner 2026-07-12: "if we already have a JD
    // analysis I expect ... I would see the JD analysis content in the
    // analysis panel"). An application opened with a JD but no analysis
    // fields in its rationale gets ONE automatic Analyse JD run, so the
    // panel fills itself instead of showing the empty state. Decision is
    // deferred + re-read so a cloud restore that lands a real rationale a
    // beat later wins (then nothing runs); the fingerprint key caps it at
    // one run per JD ever.
    setTimeout(function () {
      try {
        if (rationaleHasAnalysis(readRationale())) return;
        var jdNow = (ta.value || '').trim();
        if (jdNow.length < 50) return;
        var fp = jdFingerprint(jdNow);
        if (localStorage.getItem(AUTORUN_KEY) === fp) return;
        localStorage.setItem(AUTORUN_KEY, fp);
        runBtn.click();
      } catch (_) {}
    }, 2500);

    return wrap;
  }

  // ANALYSE-JD-BUTTON-POS-001 (owner 2026-06-10): the Analyse-JD action now
  // ALSO renders side-by-side with "Download analysis" in the 360 EXPORT &
  // DETAIL row (an .arx-analyse proxy that clicks our real .apjb-run). While
  // that row button exists, hide our in-block copy so there is exactly one
  // visible Analyse-JD control; if 360 is absent/fails, ours comes right back
  // on the next scheduler pass. Also pin the order: JD inputs ABOVE the
  // report/action block, so the flow reads input → actions.
  function syncWithReportBlock(panel) {
    var blk = panel.querySelector('#' + BLOCK_ID);
    if (!blk) return;
    var rb = blk.querySelector('.apjb-run');
    if (rb) rb.style.display = document.querySelector('#antcv-analysis-report .arx-analyse') ? 'none' : '';
    var rep = panel.querySelector('#antcv-analysis-report');
    if (rep && rep.previousElementSibling !== blk && rep.parentNode === blk.parentNode) {
      blk.parentNode.insertBefore(blk, rep);
    }
  }

  function ensureBlock() {
    var panel = findAnalysisPanel();
    if (!panel) {
      // Panel not showing analysis (Section view / preview-only / closed):
      // remove any stale block so it never lingers outside the analysis panel.
      var orphan = document.getElementById(BLOCK_ID);
      if (orphan && orphan.parentNode) orphan.parentNode.removeChild(orphan);
      return;
    }
    var existing = panel.querySelector('#' + BLOCK_ID);
    if (existing) { hideEmptyPlaceholder(panel); syncWithReportBlock(panel); return; }
    // Remove any stale copy elsewhere before injecting fresh.
    var stale = document.getElementById(BLOCK_ID);
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
    injectStyles();
    panel.appendChild(buildBlock());
    hideEmptyPlaceholder(panel);
    syncWithReportBlock(panel);
  }

  // AUTO-ANALYSE-ON-JD-LOAD-001 (owner 2026-07-19): OPEN-ANALYSIS-AUTORUN-001 above only
  // fires from inside buildBlock() — i.e. once the user has OPENED the Analysis panel.
  // The owner wants the analysis to run automatically WHEN A JD IS LOADED, without
  // opening the panel first ("execute the jd analysis ... not wait for pressing analyse
  // JD, even in fresh generations"). This headless runner does the same network +
  // rationale-merge the in-panel Run button does, minus the UI, and the scheduler fires
  // it once per JD. The shared AUTORUN_KEY fingerprint caps it at ONE LLM run per JD, so
  // it never double-spends with the in-panel autorun or a later generation.
  var __headlessRunning = false;
  async function runHeadlessJdAnalysis(jd, proxyUrl) {
    var live = readLiveSections();
    var cvSections = null, clSections = null;
    if (live) {
      if (sectionsHaveContent(live.cv)) cvSections = live.cv;
      if (sectionsHaveContent(live.cl)) clSections = live.cl;
    } else {
      cvSections = readSections('cv_pwa_sections');
      clSections = readSections('cl_pwa_sections');
    }
    var summaryStr = cvSections ? JSON.stringify(cvSections).slice(0, 8000) : '';
    var rfBody = { jd_text: jd, cv_sections: cvSections || [], doc_target: clSections ? 'both' : 'cv' };
    if (clSections) rfBody.cl_sections = clSections;
    var rf = window.AntcvRecheckFit;
    var pFit = cvSections ? postRecheckFit(proxyUrl, rfBody).catch(function () { return null; }) : Promise.resolve(null);
    var pJd = (rf && typeof rf._postJdAnalysis === 'function')
      ? rf._postJdAnalysis(proxyUrl, { jd_text: jd, candidate_summary: summaryStr, search_recruiter: true }).catch(function () { return null; })
      : Promise.resolve(null);
    var resFit = await pFit, resJd = await pJd;
    var fit = (resFit && resFit.status === 200 && resFit.body && resFit.body.ok) ? resFit.body.analysis : null;
    var jdA = (resJd && resJd.status === 200 && resJd.body && resJd.body.ok) ? (resJd.body.analysis || resJd.body) : null;
    if (!fit && !jdA) return false;
    var merged = readRationale() || {};
    if (fit) {
      if (fit.summary !== undefined) merged.summary = fit.summary;
      if (fit.fit_score !== undefined) merged.fit_score = fit.fit_score;
      if (fit.strengths !== undefined) merged.strengths = fit.strengths;
      if (fit.gaps !== undefined) merged.gaps = fit.gaps;
      if (fit.suggested_edits !== undefined) merged.suggested_edits = fit.suggested_edits;
    }
    if (jdA) {
      if (jdA.recruiter !== undefined) merged.recruiter = jdA.recruiter;
      merged.red_flags = (jdA.red_flags !== undefined) ? jdA.red_flags : (merged.red_flags || []);
      if (jdA.questions !== undefined) merged.questions_in_jd = jdA.questions;
      else if (jdA.questions_in_jd !== undefined) merged.questions_in_jd = jdA.questions_in_jd;
      if (jdA.assumptions !== undefined) merged.assumptions = jdA.assumptions;
      if (jdA.recommendations !== undefined) merged.recommendations = jdA.recommendations;
      if (jdA.confidence_notes !== undefined) merged.confidence_notes = jdA.confidence_notes;
      // MARKET-FIT-QUAL-BRIDGE-001: same carry as the in-panel merge above.
      if (Array.isArray(jdA.qualifications) && jdA.qualifications.length) merged.qualifications = jdA.qualifications;
      if (typeof jdA.category === 'string' && jdA.category.trim() && jdA.category !== 'unsolicited') merged.category = jdA.category.trim();
    }
    merged._jdAnalysisMergedAt = Date.now();
    if (writeRationale(merged)) fireMerge();
    // ANALYSIS-ROW-PERSIST-HEADLESS-001 (2026-08-16): the in-panel Run button
    // PUTs the merged rationale onto the application ROW (OPEN-ANALYSIS-
    // AUTORUN-001) but this headless clone never did — and since AUTO-ANALYSE-
    // ON-JD-LOAD-001 made headless the NORMAL path, the analysis lived only in
    // device-local storage and every reopen came up empty. Same partial PUT,
    // same best-effort contract.
    try {
      var hAppId = window.AntcvJdScope && window.AntcvJdScope.getCurrentAppId && window.AntcvJdScope.getCurrentAppId();
      if (hAppId && /^\d+$/.test(String(hAppId))) {
        fetch(proxyUrl + '/api/applications/' + hAppId, {
          method: 'PUT', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rationale: merged }),
        }).catch(function () {});
      }
    } catch (_) {}
    return true;
  }
  function maybeAutoRunOnJdLoad() {
    try {
      if (__headlessRunning) return;
      if (rationaleHasAnalysis(readRationale())) return;         // already analysed → nothing to do
      var jd = '';
      try { jd = String(localStorage.getItem('antcv:lastJdText') || '').trim(); } catch (_) {}
      if (jd.length < 50) return;                                 // no real JD loaded yet
      var fp = jdFingerprint(jd);
      if (localStorage.getItem(AUTORUN_KEY) === fp) return;       // this JD already auto-run once
      var proxyUrl = readProxyUrl();
      if (!proxyUrl) return;
      localStorage.setItem(AUTORUN_KEY, fp);                      // claim BEFORE the async call so it can't double-fire
      __headlessRunning = true;
      runHeadlessJdAnalysis(jd, proxyUrl).catch(function () {}).then(function () { __headlessRunning = false; });
    } catch (_) { __headlessRunning = false; }
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { ensureBlock(); } catch (_) {}
      try { maybeAutoRunOnJdLoad(); } catch (_) {}
    });
  }

  schedule();
  [300, 800, 1800, 3500, 6000].forEach(function (d) { setTimeout(schedule, d); });
  // AUTO-ANALYSE-ON-JD-LOAD-001: a slow poll catches a JD attached AFTER boot (URL fetch /
  // file upload / tracker Open mirror it to antcv:lastJdText) even when no DOM mutation
  // reaches the observer; self-limits — stops once an analysis exists for the loaded JD.
  var __aaPoll = setInterval(function () {
    try { maybeAutoRunOnJdLoad(); } catch (_) {}
  }, 3000);
  window.addEventListener('antcv:jd-loaded', maybeAutoRunOnJdLoad);
  try {
    new MutationObserver(function (records) {
      var meaningful = false;
      for (var r = 0; r < records.length; r++) {
        if (records[r].type === 'attributes' && records[r].attributeName === 'data-antcv-jd-empty-hidden') continue;
        meaningful = true; break;
      }
      if (meaningful) schedule();
    }).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  window.addEventListener('antcv:rationale-merge', schedule);
  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvAnalysisPanelJdBlock356 = { version: VERSION, ensure: ensureBlock, _findPanel: findAnalysisPanel };
  try { console.debug('[analysis-panel-jd-block-356] installed v' + VERSION); } catch (_) {}
})();
