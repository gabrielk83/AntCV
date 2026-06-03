/* AntCV Analysis-panel embedded JD block (v1.40.356)
 * ============================================================================
 *
 * Goal (user spec)
 * ----------------
 * Put the JD-analysis INPUT controls (paste textarea + PDF/Word/Image upload +
 * a single "Analyse JD" button) INSIDE the in-app Analysis panel — not in the
 * separate recheck-fit modal. Placement:
 *   - When NO analysis is captured yet  -> the JD block IS the visible content
 *     (so the user can paste/upload a JD and run it).
 *   - When an analysis IS present       -> the JD block sits BELOW the rendered
 *     analysis result (used to compare the generated CV against an existing JD).
 *
 * Behaviour (user spec)
 * ---------------------
 *   - ONE unified block, NO tabs. A single run does BOTH analyses:
 *       * POST /api/recheck-fit   -> fit_score, summary, strengths, gaps,
 *                                    suggested_edits
 *       * POST /api/jd-analysis   -> recruiter, red_flags, questions
 *     and merges ALL of it.
 *   - Results: rendered IN-PANEL immediately (Option A), AND written into the
 *     persisted `rationale` object so app.js's native panel render picks them
 *     up too once its recruiter/red-flags render blocks ship. (The deployed
 *     app.js does not yet render recruiter/red_flags, so in-panel render is
 *     what the user sees today.)
 *
 * Why a separate sidecar
 * ----------------------
 * The Analysis panel is rendered by app.js (minified, not hand-editable). This
 * sidecar only INJECTS a child block into that panel's DOM and reuses the
 * transport + renderers already exposed by antcv-recheck-fit.js via
 * window.AntcvRecheckFit. It never edits app.js. Additive, idempotent,
 * removable in one <script> line.
 *
 * Dependencies
 * ------------
 *   window.AntcvRecheckFit._extractTextFromFile(file) -> Promise<string>
 *   window.AntcvRecheckFit._postJdAnalysis(proxyUrl, body) -> {status,body,raw}
 *   window.AntcvRecheckFit._renderJdAnalysis(container, data, T)
 * Plus its own recheck-fit POST (same endpoint app.js/recheck use) and an
 * in-block renderer for fit/strengths/gaps so we do not depend on app.js.
 */
(function () {
  'use strict';

  var VERSION = '1.40.356';
  if (window.__antcvAnalysisPanelJdBlock356 === VERSION) return;
  window.__antcvAnalysisPanelJdBlock356 = VERSION;

  var BLOCK_ID = 'antcv-analysis-panel-jd-block';
  var STYLE_ID = 'antcv-analysis-panel-jd-block-css';
  var RATIONALE_KEY = 'rationale';

  // ---- storage helpers ----
  function readProxyUrl() {
    try {
      var raw = localStorage.getItem('proxyUrl');
      if (!raw) return '';
      try { return String(JSON.parse(raw)).trim().replace(/\/+$/, ''); }
      catch (_) { return String(raw).trim().replace(/\/+$/, ''); }
    } catch (_) { return ''; }
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
      upload: 'Eller upload:',
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
      upload: 'Or upload:',
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
      + '#' + BLOCK_ID + ' .apjb-textarea{width:100%;min-height:96px;padding:8px 10px;font-family:Georgia,serif;font-size:12.5px;line-height:1.45;color:#333;border:1px solid #d0d2d6;border-radius:6px;resize:vertical;box-sizing:border-box;}'
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

  // Find the Analysis panel container by its app.js heading text.
  function findAnalysisPanel() {
    var nodes = document.querySelectorAll('div');
    for (var i = 0; i < nodes.length; i++) {
      var t = nodes[i].textContent || '';
      // The heading is the first child text node "📊 Application Analysis".
      var head = nodes[i].querySelector && nodes[i].querySelector(':scope > div');
      if (head && (head.textContent || '').indexOf('Application Analysis') >= 0) {
        return nodes[i];
      }
    }
    return null;
  }

  // Local recheck-fit POST (the recheck-fit sidecar keeps postRecheckFit
  // private, so we issue our own; same endpoint + shape).
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

  // In-panel renderer for fit/strengths/gaps (Option A: do not depend on
  // app.js). Recruiter/red-flags/questions reuse the recheck-fit sidecar's
  // renderJdAnalysis into the same results container.
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
    var fileInput = el('input', { type: 'file', accept: '.pdf,.doc,.docx,.txt,image/*', style: { display: 'none' } });
    fileInput.addEventListener('change', async function (ev) {
      var f = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!f) return;
      status.textContent = t.reading.replace('{file}', f.name);
      try {
        var rf = window.AntcvRecheckFit;
        if (!rf || typeof rf._extractTextFromFile !== 'function') throw new Error('extractor unavailable');
        var text = await rf._extractTextFromFile(f);
        if (!text || text.length < 20) throw new Error('no usable text');
        ta.value = text;
        status.textContent = '';
      } catch (e) {
        status.textContent = t.fileErr.replace('{err}', String((e && e.message) || e));
      }
    });
    function upBtn(label, accept) {
      return el('button', { className: 'apjb-upbtn', type: 'button', onClick: function () { fileInput.setAttribute('accept', accept); fileInput.click(); } }, label);
    }
    var uprow = el('div', { className: 'apjb-uprow' },
      el('span', { className: 'apjb-uplabel' }, t.upload),
      upBtn(t.pdf, '.pdf'), upBtn(t.word, '.doc,.docx'), upBtn(t.image, 'image/*'), fileInput);
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
        // Run BOTH endpoints in parallel.
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

        // Render in-panel (Option A).
        if (fit) renderFit(results, fit, t);
        if (jdA && rf && typeof rf._renderJdAnalysis === 'function') {
          rf._renderJdAnalysis(results, jdA, {
            recruiter: t.recruiter, questions: t.questions, redFlags: t.redFlags,
            noRecruiter: t.noRecruiter, noQuestions: t.noQuestions, noRedFlags: t.noRedFlags,
          });
        }

        // Merge everything into rationale (forward-compat with native render).
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
    if (!panel) return;
    // Already present in this panel?
    var existing = panel.querySelector('#' + BLOCK_ID);
    if (existing) return;
    // Remove any stale copy elsewhere (panel re-mounted).
    var stale = document.getElementById(BLOCK_ID);
    if (stale && stale.parentNode) stale.parentNode.removeChild(stale);
    injectStyles();
    // Append at the END of the panel so it sits BELOW any rendered analysis.
    panel.appendChild(buildBlock());
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
  [300, 800, 1800, 3500].forEach(function (d) { setTimeout(schedule, d); });
  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
  window.addEventListener('antcv:rationale-merge', schedule);
  window.addEventListener('antcv:sections-updated', schedule);

  window.AntcvAnalysisPanelJdBlock356 = { version: VERSION, ensure: ensureBlock };
  try { console.debug('[analysis-panel-jd-block-356] installed v' + VERSION); } catch (_) {}
})();
