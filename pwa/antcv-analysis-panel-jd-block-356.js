/* AntCV Analysis-panel embedded JD block (v1.40.357)
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
 * v1.40.357 fix
 * -------------
 * The original findAnalysisPanel() matched ONLY a container whose heading text
 * contained "Application Analysis". But in the EMPTY state (the exact case we
 * are fixing) that heading is NOT rendered — the panel only shows the bar-chart
 * icon and "Generate a CV first to see the analysis." So the block never
 * attached and the panel stayed empty.
 *
 * findAnalysisPanel() now tries TWO strategies:
 *   1. The "Application Analysis" heading container (analysis-present state).
 *   2. The empty-state container, located by its message text ("Generate a CV
 *      first to see the analysis" / Danish equivalent), then climbing to a
 *      stable panel ancestor to inject into.
 *
 * Behaviour (user spec)
 * ---------------------
 *   - ONE unified block, NO tabs. A single run does BOTH analyses:
 *       * POST /api/recheck-fit   -> fit_score, summary, strengths, gaps,
 *                                    suggested_edits
 *       * POST /api/jd-analysis   -> recruiter, red_flags, questions
 *     and merges ALL of it.
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
 *
 * v1.40.356-b: fix findAnalysisPanel — it returned the OUTERMOST div whose
 * descendant text contained "Application Analysis", so the block was appended
 * to a large wrapper (pushed off-screen / into a React-rerendered region) and
 * never appeared. Now it targets the heading LEAF and returns its parent.
 */
(function () {
  'use strict';

  var VERSION = '1.40.356-b';
  if (window.__antcvAnalysisPanelJdBlock356 === VERSION) return;
  window.__antcvAnalysisPanelJdBlock356 = VERSION;

  var BLOCK_ID = 'antcv-analysis-panel-jd-block';
  var STYLE_ID = 'antcv-analysis-panel-jd-block-css';
  var RATIONALE_KEY = 'rationale';

  // Empty-state message fragments (EN + DA). Kept lowercase for compare.
  var EMPTY_MARKERS = [
    'generate a cv first',
    'see the analysis',
    'generér et cv',
    'generer et cv',
    'for at se analysen'
  ];

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

  function previewPaper() {
    return document.querySelector('.antcv-preview-paper, [data-antcv-preview-paper]');
  }

  // Strategy 1: the analysis-present panel, keyed by its heading text.
  function findByHeading() {
  // Find the Analysis panel container by its app.js heading text.
  //
  // The heading is a div whose OWN text is "📊 Application Analysis" (a short
  // leaf, not a big wrapper). The previous implementation walked every div and
  // returned the first one whose first child contained that text — but because
  // textContent matches recursively and ancestors come first in document
  // order, that returned a large OUTER wrapper. Appending the block there
  // pushed it far below the visible panel (or into a region React re-renders),
  // so it never showed.
  //
  // Fix: locate the heading LEAF precisely (its own trimmed text starts with
  // "Application Analysis", ignoring the emoji, and it is short), then return
  // its PARENT — the panel body that holds the rendered analysis. Prefer the
  // LAST match in document order (innermost / most-recently-mounted panel).
  function findAnalysisPanel() {
    var nodes = document.querySelectorAll('div');
    var headings = [];
    for (var i = 0; i < nodes.length; i++) {
      var head = nodes[i].querySelector && nodes[i].querySelector(':scope > div');
      if (head && (head.textContent || '').indexOf('Application Analysis') >= 0) {
        return nodes[i];
      }
      var node = nodes[i];
      var txt = (node.textContent || '').replace(/\s+/g, ' ').trim();
      if (txt.indexOf('Application Analysis') < 0) continue;
      // Must be the heading LEAF, not a wrapper: short text and few element
      // children (the heading div itself, possibly with an inline icon span).
      var stripped = txt.replace(/[^\x20-\x7E]/g, '').trim(); // drop emoji
      if (stripped.indexOf('Application Analysis') !== 0) continue;
      if (stripped.length > 40) continue;            // a wrapper would be long
      if (node.children && node.children.length > 1) continue; // leaf-ish
      headings.push(node);
    }
    if (!headings.length) return null;
    // Innermost / latest heading; its parent is the panel body.
    var heading = headings[headings.length - 1];
    return heading.parentNode && heading.parentNode.nodeType === 1
      ? heading.parentNode
      : heading;
  }

  // Strategy 2: the EMPTY-state panel, keyed by its message text. We find the
  // smallest element whose text matches an empty-state marker, then climb to a
  // panel-like ancestor (a block container that is NOT the whole app shell and
  // NOT inside the rendered document) to inject into.
  function findByEmptyState() {
    var paper = previewPaper();
    var nodes = document.querySelectorAll('div, p, span');
    var marker = null;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.children && n.children.length > 3) continue;
      var tc = (n.textContent || '').toLowerCase();
      if (tc.length > 120) continue;
      var hit = false;
      for (var m = 0; m < EMPTY_MARKERS.length; m++) {
        if (tc.indexOf(EMPTY_MARKERS[m]) >= 0) { hit = true; break; }
      }
      if (!hit) continue;
      if (paper && paper.contains(n)) continue;
      marker = n;
      break;
    }
    if (!marker) return null;

    var cur = marker;
    var hops = 0;
    var best = marker.parentElement || marker;
    while (cur && hops < 6) {
      var p = cur.parentElement;
      if (!p) break;
      if (p === document.body || p.id === 'root' || p.tagName === 'HTML') break;
      best = p;
      cur = p;
      hops++;
    }
    return best;
  }

  function findAnalysisPanel() {
    return findByHeading() || findByEmptyState();
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

  // Hide the native empty-state placeholder once our block is present, so the
  // panel does not show both "Generate a CV first" AND our input block.
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
    var existing = panel.querySelector('#' + BLOCK_ID);
    if (existing) { hideEmptyPlaceholder(panel); return; }
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
