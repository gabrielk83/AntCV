/* AntCV Analysis-panel JD input block (v1.40.356)
 * ============================================================================
 *
 * Goal (user spec)
 * ----------------
 * The JD-analysis INPUT block (label + textarea + PDF/Word/Image upload +
 * "Analyse JD" button) must live INSIDE the in-app Analysis panel, not only in
 * the floating recheck-fit modal. Requirements:
 *   - Always visible in the Analysis panel, even when NO analysis is captured
 *     yet (empty state).
 *   - When an analysis result IS present, the input block sits BELOW the
 *     result (so it is used to compare the generated CV against an existing
 *     JD / run a fresh analysis).
 *
 * Approach
 * --------
 * The Analysis panel is rendered by app.js (the "\uD83D\uDCCA Application Analysis"
 * container). We do not edit app.js. This sidecar injects an additive block at
 * the BOTTOM of that container and keeps it there idempotently. The block
 * reuses the existing .antcv-rf-* classes (injected by antcv-recheck-fit.js)
 * so styling matches the modal exactly.
 *
 * The "Analyse JD" button + upload buttons delegate to the existing
 * window.AntcvRecheckFit internals:
 *   - _extractTextFromFile(file)  — PDF/Word/Txt/Image → text
 *   - _postJdAnalysis(proxyUrl, body)  → { recruiter, questions, red_flags }
 *   - _renderJdAnalysis(container, data, T)  — render into our own results node
 * and also merge { recruiter, red_flags } into localStorage 'rationale' +
 * dispatch antcv:rationale-merge so the app.js-rendered panel above refreshes.
 *
 * Why a sibling block rather than re-using the modal
 * --------------------------------------------------
 * The modal is a separate overlay. The user wants the inputs embedded in the
 * panel itself. Embedding avoids the modal entirely for the common case and
 * keeps the analysis result + its JD input in one scroll.
 *
 * Additive, idempotent, observer-driven. Removable in one <script> line.
 */
(function () {
  'use strict';

  var VERSION = '1.40.356';
  if (window.__antcvAnalysisJdInput356 === VERSION) return;
  window.__antcvAnalysisJdInput356 = VERSION;

  var BLOCK_ID = 'antcv-analysis-jd-input-356';
  var ANALYSIS_HEADING = '\uD83D\uDCCA Application Analysis';
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
  function readSectionsSummary() {
    try {
      var raw = localStorage.getItem('cv_pwa_sections') || localStorage.getItem('sections');
      if (!raw) return '';
      return JSON.stringify(JSON.parse(raw)).slice(0, 8000);
    } catch (_) { return ''; }
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
    try { window.dispatchEvent(new CustomEvent('antcv:rationale-merge', { detail: { source: 'analysis-jd-input-356' } })); }
    catch (_) {}
  }

  function T() {
    var da = readLanguage() === 'da';
    return da ? {
      heading: 'Analysér et jobopslag',
      sub: 'Indsæt eller upload et jobopslag for at sammenligne med det genererede CV.',
      jdLabel: 'Jobopslag (indsæt teksten)',
      placeholder: 'Jobopslag (indsæt teksten)…',
      uploadLabel: 'Eller upload:',
      pdf: 'PDF', word: 'Word', image: 'Billede',
      run: 'Analysér JD',
      running: 'Analyserer…',
      reading: 'Læser {file}…',
      fileErr: 'Filfejl: {err}',
      noProxy: 'Proxy-URL er ikke konfigureret. Åbn Indstillinger.',
      tooShort: 'Indsæt jobopslag på mindst 50 tegn.',
    } : {
      heading: 'Analyse a job description',
      sub: 'Paste or upload a JD to compare it against the generated CV.',
      jdLabel: 'Job description (paste here)',
      placeholder: 'Job description (paste here)…',
      uploadLabel: 'Or upload:',
      pdf: 'PDF', word: 'Word', image: 'Image',
      run: 'Analyse JD',
      running: 'Analysing…',
      reading: 'Reading {file}…',
      fileErr: 'File error: {err}',
      noProxy: 'Proxy URL is not configured. Open Settings.',
      tooShort: 'Paste a job description of at least 50 characters.',
    };
  }

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        if (k === 'style' && typeof attrs[k] === 'object') { for (var s in attrs[k]) e.style[s] = attrs[k][s]; }
        else if (k === 'className') e.className = attrs[k];
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

  // Find the app.js-rendered Analysis panel container (the element whose
  // text begins with the "\uD83D\uDCCA Application Analysis" heading). We return the
  // outermost "card" container so our block appends after all results.
  function findAnalysisPanel() {
    var divs = document.querySelectorAll('div');
    for (var i = 0; i < divs.length; i++) {
      var d = divs[i];
      // Heading node text starts with the marker; its parent is the panel body.
      var t = (d.textContent || '');
      if (t.indexOf(ANALYSIS_HEADING) === 0) {
        // d is likely the heading div; climb to a container that holds the
        // whole analysis (the .fade wrapper in app.js). Prefer a parent with
        // class 'fade', else the heading's parent.
        var p = d;
        for (var hop = 0; hop < 4 && p; hop++) {
          if (p.classList && p.classList.contains('fade')) return p;
          p = p.parentElement;
        }
        return d.parentElement || d;
      }
    }
    return null;
  }

  function buildBlock() {
    var t = T();
    var proxyUrl = readProxyUrl();

    var wrap = el('div', { id: BLOCK_ID, className: 'fade', style: {
      marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #e8e8e8',
    }});

    wrap.appendChild(el('div', { style: {
      fontSize: '10px', fontWeight: '700', color: '#283556', letterSpacing: '0.8px',
      marginBottom: '4px', textTransform: 'uppercase',
    }, text: t.heading }));
    wrap.appendChild(el('div', { style: {
      fontSize: '11px', color: '#6b7280', marginBottom: '8px', lineHeight: '1.4',
    }, text: t.sub }));

    var jdField = el('textarea', { className: 'antcv-rf-textarea', placeholder: t.placeholder });
    jdField.style.minHeight = '110px';
    wrap.appendChild(jdField);

    // Upload row
    var fileInput = el('input', { type: 'file', accept: '.pdf,.doc,.docx,.txt,image/*', style: { display: 'none' } });
    var status = el('div', { className: 'antcv-rf-upload-status' });
    var errorBox = el('div', { className: 'antcv-rf-error', style: { display: 'none', marginTop: '8px' } });

    function showError(msg) { errorBox.textContent = msg; errorBox.style.display = 'block'; }
    function clearError() { errorBox.style.display = 'none'; }

    fileInput.addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (!file) return;
      clearError();
      status.textContent = t.reading.replace('{file}', file.name);
      var api = window.AntcvRecheckFit;
      if (!api || typeof api._extractTextFromFile !== 'function') {
        status.textContent = '';
        showError('Extractor unavailable — refresh and retry.');
        return;
      }
      api._extractTextFromFile(file).then(function (text) {
        if (!text || text.length < 20) throw new Error('File parsed but contained no usable text.');
        jdField.value = text;
        status.textContent = '';
      }).catch(function (e) {
        status.textContent = '';
        showError(t.fileErr.replace('{err}', String((e && e.message) || e)));
      });
    });

    function uploadBtn(label, accept) {
      var b = el('button', { className: 'antcv-rf-upload-btn', type: 'button', text: label });
      b.addEventListener('click', function () { fileInput.setAttribute('accept', accept); fileInput.click(); });
      return b;
    }
    var uploadRow = el('div', { className: 'antcv-rf-upload-row' },
      el('span', { className: 'antcv-rf-upload-label', text: t.uploadLabel }),
      uploadBtn(t.pdf, '.pdf'),
      uploadBtn(t.word, '.doc,.docx'),
      uploadBtn(t.image, 'image/*'),
      fileInput
    );
    wrap.appendChild(uploadRow);
    wrap.appendChild(status);
    wrap.appendChild(errorBox);

    // Results node for this block's own analyse output.
    var resultsArea = el('div', { className: 'antcv-rf-results', style: { marginTop: '10px' } });

    var runBtn = el('button', { className: 'antcv-rf-runbtn', type: 'button', text: t.run, style: { marginTop: '12px' } });
    runBtn.addEventListener('click', function () {
      clearError();
      resultsArea.innerHTML = '';
      var px = readProxyUrl();
      if (!px) { showError(t.noProxy); return; }
      var jd = (jdField.value || '').trim();
      if (jd.length < 50) { showError(t.tooShort); return; }
      var api = window.AntcvRecheckFit;
      if (!api || typeof api._postJdAnalysis !== 'function') { showError('Analyser unavailable — refresh and retry.'); return; }

      runBtn.disabled = true;
      var prev = runBtn.textContent;
      runBtn.textContent = t.running;
      api._postJdAnalysis(px, {
        jd_text: jd,
        candidate_summary: readSectionsSummary(),
        search_recruiter: true,
      }).then(function (resp) {
        var status2 = resp && resp.status;
        var body = resp && resp.body;
        if (status2 !== 200 || !body || !body.ok) {
          var msg = (body && (body.error || body.hint)) || (resp && resp.raw && resp.raw.slice(0, 200)) || ('HTTP ' + status2);
          showError(msg);
          return;
        }
        var data = body.analysis || body;
        // Render locally.
        if (typeof api._renderJdAnalysis === 'function') {
          api._renderJdAnalysis(resultsArea, data, _modalT());
        }
        // Merge recruiter + red_flags into rationale so the app.js panel above
        // also reflects them.
        var merged = readRationale() || {};
        if (data.recruiter !== undefined) merged.recruiter = data.recruiter;
        merged.red_flags = (data.red_flags !== undefined) ? data.red_flags : (merged.red_flags || []);
        if (data.questions_in_jd !== undefined) merged.questions_in_jd = data.questions_in_jd;
        else if (data.questions !== undefined) merged.questions_in_jd = data.questions;
        merged._jdAnalysisMergedAt = Date.now();
        if (writeRationale(merged)) fireMerge();
      }).catch(function (e) {
        showError(String((e && e.message) || e));
      }).then(function () {
        runBtn.disabled = false;
        runBtn.textContent = prev;
      });
    });
    wrap.appendChild(runBtn);
    wrap.appendChild(resultsArea);

    return wrap;
  }

  // Minimal label set for _renderJdAnalysis (it only reads recruiter/questions/
  // red-flags labels). Reuse the modal's language via a small shim.
  function _modalT() {
    var da = readLanguage() === 'da';
    return da ? {
      recruiter: 'Rekrutterer', questions: 'Spørgsmål at stille', redFlags: 'Røde flag',
      noRecruiter: 'Ingen tydelig rekrutterer fundet i opslaget.',
      noQuestions: 'Ingen forslag til spørgsmål.', noRedFlags: 'Ingen røde flag fundet.',
    } : {
      recruiter: 'Recruiter', questions: 'Questions to ask', redFlags: 'Red flags',
      noRecruiter: 'No clear recruiter info found in the JD.',
      noQuestions: 'No suggested questions.', noRedFlags: 'No red flags found.',
    };
  }

  function ensureBlock() {
    var panel = findAnalysisPanel();
    if (!panel) return; // Analysis view not open.
    var existing = panel.querySelector('#' + BLOCK_ID) || document.getElementById(BLOCK_ID);
    if (existing) {
      // Make sure it is the LAST child of the panel (below results).
      if (existing.parentElement === panel && panel.lastElementChild !== existing) {
        panel.appendChild(existing);
      } else if (existing.parentElement !== panel) {
        // Panel re-rendered; move our block into the new panel.
        panel.appendChild(existing);
      }
      return;
    }
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
  [200, 600, 1500, 3000].forEach(function (d) { setTimeout(schedule, d); });

  try {
    new MutationObserver(schedule).observe(document.body || document.documentElement, {
      childList: true, subtree: true,
    });
  } catch (_) {}

  window.addEventListener('antcv:sections-updated', schedule);
  window.addEventListener('antcv:rationale-merge', schedule);

  window.AntcvAnalysisJdInput356 = { version: VERSION, ensureBlock: ensureBlock };

  try { console.debug('[analysis-jd-input-356] installed v' + VERSION); } catch (_) {}
})();
