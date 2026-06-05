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

  var VERSION = '1.50.153-upload-jd';
  if (window.__antcvAnalysisPanelJdBlock356 === VERSION) return;
  window.__antcvAnalysisPanelJdBlock356 = VERSION;

  var BLOCK_ID = 'antcv-analysis-panel-jd-block';
  var STYLE_ID = 'antcv-analysis-panel-jd-block-css';
  var RATIONALE_KEY = 'rationale';

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
    var da = readLanguage() === 'da';
    return da ? {
      heading: 'Analysér mod et jobopslag',
      jdLabel: 'Jobopslag (indsæt teksten)',
      upload: 'Eller upload:', uploadJd: '⬆ Upload jobopslag',
      pdf: 'PDF', word: 'Word', image: 'Billede',
      run: 'Analysér JD', running: 'Analyserer…',
      reading: 'Læser {file}…',
      fileErr: 'Filfejl: {err}',
      noProxy: 'Proxy-URL er ikke konfigureret. Åbn Indstillinger.',
      jdShort: 'Indsæt et jobopslag på mindst 50 tegn.',
      compareHint: 'Sammenlign det genererede CV med et eksisterende jobopslag.',
      emptyHint: 'Indsæt eller upload et jobopslag for at køre analysen.',
      fitScore: 'Match-score', strengths: 'Styrker', gaps: 'Mangler',
      recruiter: 'Rekrutterer', redFlags: 'Røde flag', questions: 'Spørgsmål at stille',
      noRecruiter: 'Ingen tydelig rekrutterer fundet.', noRedFlags: 'Ingen røde flag fundet.',
      noQuestions: 'Ingen forslag til spørgsmål.', done: 'Analyse opdateret.',
    } : {
      heading: 'Analyse against a job description',
      jdLabel: 'Job description (paste here)',
      upload: 'Or upload:', uploadJd: '⬆ Upload JD',
      pdf: 'PDF', word: 'Word', image: 'Image',
      run: 'Analyse JD', running: 'Analysing…',
      reading: 'Reading {file}…',
      fileErr: 'File error: {err}',
      noProxy: 'Proxy URL is not configured. Open Settings.',
      jdShort: 'Paste a job description of at least 50 characters.',
      compareHint: 'Compare the generated CV against an existing job description.',
      emptyHint: 'Paste or upload a job description to run the analysis.',
      fitScore: 'Fit score', strengths: 'Strengths', gaps: 'Gaps',
      recruiter: 'Recruiter', redFlags: 'Red flags', questions: 'Questions to ask',
      noRecruiter: 'No clear recruiter info found.', noRedFlags: 'No red flags found.',
      noQuestions: 'No suggested questions.', done: 'Analysis updated.',
    };
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
    var hasAnalysis = !!(rationale && (rationale.summary || rationale.strengths || rationale.gaps || rationale.fit_score !== undefined || rationale.recruiter !== undefined));

    var wrap = el('div', { id: BLOCK_ID });
    wrap.appendChild(el('div', { className: 'apjb-heading' }, t.heading));
    wrap.appendChild(el('div', { className: 'apjb-hint' }, hasAnalysis ? t.compareHint : t.emptyHint));

    var ta = el('textarea', { className: 'apjb-textarea', placeholder: t.jdLabel + '…' });
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
    var uprow = el('div', { className: 'apjb-uprow' },
      upBtn(t.uploadJd, '.pdf,.doc,.docx,.txt,.json,image/*'), fileInput);
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
      if (jd.length < 50) { errBox.textContent = t.jdShort; errBox.style.display = 'block'; return; }
      var cvSections = readSections('cv_pwa_sections');
      var clSections = readSections('cl_pwa_sections');

      runBtn.disabled = true; runBtn.textContent = t.running;
      try {
        var summaryStr = cvSections ? JSON.stringify(cvSections).slice(0, 8000) : '';
        var rfBody = { jd_text: jd, cv_sections: cvSections || [], doc_target: clSections ? 'both' : 'cv' };
        if (clSections) rfBody.cl_sections = clSections;

        var rf = window.AntcvRecheckFit;
        var pFit = postRecheckFit(proxyUrl, rfBody).catch(function () { return null; });
        var pJd = (rf && typeof rf._postJdAnalysis === 'function')
          ? rf._postJdAnalysis(proxyUrl, { jd_text: jd, candidate_summary: summaryStr, search_recruiter: true }).catch(function () { return null; })
          : Promise.resolve(null);

        var resFit = await pFit;
        var resJd = await pJd;

        var fit = (resFit && resFit.status === 200 && resFit.body && resFit.body.ok) ? resFit.body.analysis : null;
        var jdA = (resJd && resJd.status === 200 && resJd.body && resJd.body.ok) ? (resJd.body.analysis || resJd.body) : null;

        if (fit) renderFit(results, fit, t);
        if (jdA && rf && typeof rf._renderJdAnalysis === 'function') {
          rf._renderJdAnalysis(results, jdA, {
            recruiter: t.recruiter, questions: t.questions, redFlags: t.redFlags,
            noRecruiter: t.noRecruiter, noQuestions: t.noQuestions, noRedFlags: t.noRedFlags,
          });
        }

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
        }
        merged._jdAnalysisMergedAt = Date.now();
        if (writeRationale(merged)) fireMerge();

        if (!fit && !jdA) {
          errBox.textContent = 'Analysis failed — check the connection and try again.';
          errBox.style.display = 'block';
        } else {
          okBox.textContent = t.done; okBox.style.display = 'block';
        }
      } catch (e) {
        errBox.textContent = String((e && e.message) || e); errBox.style.display = 'block';
      } finally {
        runBtn.disabled = false; runBtn.textContent = t.run;
      }
    });

    wrap.appendChild(runBtn);
    wrap.appendChild(errBox);
    wrap.appendChild(okBox);
    wrap.appendChild(results);
    return wrap;
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
    if (existing) { hideEmptyPlaceholder(panel); return; }
    // Remove any stale copy elsewhere before injecting fresh.
    var stale = document.getElementById(BLOCK_ID);
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
    injectStyles();
    panel.appendChild(buildBlock());
    hideEmptyPlaceholder(panel);
  }

  var pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      try { ensureBlock(); } catch (_) {}
    });
  }

  schedule();
  [300, 800, 1800, 3500, 6000].forEach(function (d) { setTimeout(schedule, d); });
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
