/* AntCV Overlay
 * ============================================================
 * A standalone script that adds three pieces of UI on top of the
 * existing AntCV PWA without modifying its React bundle:
 *
 *   1. Supervisor post-check overlay
 *      - Intercepts fetch() responses from cv-proxy LLM calls
 *      - When the response is for a CV/CL generation task, POSTs the
 *        content back to /api/supervisor/check
 *      - Renders a fixed-position panel listing deviations
 *      - Provides "Auto-fix" (re-runs with auto_repair: true) and
 *        "Dismiss" buttons
 *
 *   2. DocX Word-compatibility warning
 *      - Reads X-AntCV-Post-Process-Status from docx export response
 *      - If status != ok|skipped, shows a banner: "file exported —
 *        may experience issues in MS Word"
 *
 *   3. Reset-for-new-JD helper
 *      - Provides a floating "Reset CV content for new JD" button
 *      - On click: shows confirmation, then clears the in-memory
 *        section CONTENT (not headings, not settings, not photo)
 *      - Implementation works against the React-managed state by
 *        dispatching events the PWA listens for, with localStorage
 *        cleanup as a fallback
 *
 * Installation:
 *   <script src="antcv-overlay.js" defer></script>
 *
 * Configuration (window.AntCVOverlayConfig before script tag, optional):
 *   {
 *     cvProxyOrigin: 'https://your-cv-proxy.workers.dev',
 *     docxWorkerOrigin: 'https://your-docx-worker.workers.dev',
 *     enabled: { supervisor: true, wordWarning: true, resetButton: true, jdAnalysis: true, fusionButton: true },
 *     sourceCvLocalStorageKey: 'antcv:sections',  // for grounding
 *     contentLocalStorageKeys: [                  // keys to wipe on reset
 *       'antcv:sections',
 *       'antcv:meta:profile',
 *       'antcv:meta:outcomes',
 *     ],
 *     position: 'bottom-right',
 *   }
 *
 * The script defaults are tuned for the current AntCV PWA layout. The
 * config object lets you re-target storage keys if your bundle uses
 * different names — inspect localStorage in DevTools to confirm.
 */
(function () {
  'use strict';

  // ─── Config ────────────────────────────────────────────────────
  const userCfg = (typeof window !== 'undefined' && window.AntCVOverlayConfig) || {};

  // v1.17 — hydrate routing URLs from the PWA's localStorage so the overlay
  // works without the host explicitly setting AntCVOverlayConfig.cvProxyOrigin.
  // The PWA stores `proxyUrl` as a JSON-encoded string (h.set wraps with
  // JSON.stringify). Strip surrounding quotes and trailing slashes.
  function readLsString(key) {
    try {
      let v = localStorage.getItem(key);
      if (!v) return '';
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      return v.replace(/\/+$/, '');
    } catch (_) { return ''; }
  }
  const lsProxyUrl  = readLsString('proxyUrl');
  const lsDocxUrl   = readLsString('docxWorkerUrl') || readLsString('antcv:docxWorker');
  // v1.18 — was too strict ("must end in .workers.dev"), which rejected
  // legitimate Cloudflare Worker custom domains and the relay-config
  // override. The only failure mode we need to prevent is the original
  // bug: a relative URL falling through to the Pages origin and giving
  // a 405. So reject (a) empty, (b) non-https, (c) the same hostname as
  // the current page (which means we'd be POSTing to ourselves), and
  // (d) any *.pages.dev hostname. Everything else is allowed.
  function isValidProxyUrl(u) {
    if (!u || typeof u !== 'string') return false;
    try {
      const p = new URL(u);
      if (p.protocol !== 'https:') return false;
      if (typeof location !== 'undefined' && p.hostname === location.hostname) return false;
      if (/\.pages\.dev$/i.test(p.hostname)) return false;
      return true;
    } catch (_) { return false; }
  }
  // Kept as a thin alias so the rest of this file can stay readable;
  // tests in older bundles reference this name.
  function isWorkerUrl(u) { return isValidProxyUrl(u); }

  // v1.40.3 — re-read URLs from localStorage on every call site. The
  // earlier "hydrate once at boot" approach caused a stale-empty
  // CFG.cvProxyOrigin whenever the user configured the proxy AFTER
  // the overlay script had already loaded (which is what happens on
  // a fresh install: the wizard runs after script load and writes
  // proxyUrl, but CFG was already locked in as empty). Symptom was a
  // misleading "CV proxy URL not usable. Stored value: <correct URL>"
  // shown by runJDAnalysis. This helper is cheap and idempotent.
  function refreshUrlsFromLS() {
    const p = readLsString('proxyUrl');
    if (p && isValidProxyUrl(p)) CFG.cvProxyOrigin = p;
    const d = readLsString('docxWorkerUrl') || readLsString('antcv:docxWorker');
    if (d && isValidProxyUrl(d)) CFG.docxWorkerOrigin = d;
  }

  const CFG = Object.assign({
    cvProxyOrigin: '',  // configure in Settings → Advanced → Routing
    docxWorkerOrigin: '',  // configure in Settings → Advanced → Routing
    enabled: { supervisor: true, wordWarning: true, resetButton: true, jdAnalysis: true, fusionButton: true },
    sourceCvLocalStorageKey: 'antcv:sections',
    contentLocalStorageKeys: [
      // Adjust these to match the actual keys your PWA uses for
      // section CONTENT (not settings, not photo, not heading text).
      // Run `Object.keys(localStorage).filter(k=>k.startsWith('antcv'))`
      // in DevTools to discover the live keys.
      'antcv:sections',
      'antcv:meta:profile',
      'antcv:meta:outcomes',
      'antcv:meta:competencies',
      'antcv:meta:experience',
      'antcv:cv:content',
      'antcv:cl:content',
    ],
    position: 'bottom-right',
    // The PWA's own action bar lives in the bottom ~80px on most
    // viewports, plus a "Section" selector that sits a bit higher.
    // Pushing the overlay up by 160px clears both without intruding
    // on the preview. Override per-site if your bottom toolbar is
    // larger or you want the overlay flush to the edge.
    bottomOffset: 100,
    rightOffset: 56,
    topOffset: 16,
    leftOffset: 16,
    // Reset button starts as a compact 40x40 circular icon. Click
    // expands it to show the full label. This keeps the overlay
    // out of the way until the user reaches for it.
    resetButtonCollapsed: true,
  }, userCfg, { enabled: Object.assign({}, { supervisor: true, wordWarning: true, resetButton: true, jdAnalysis: true, fusionButton: true }, userCfg.enabled || {}) });

  // v1.17 — apply LS fallbacks if the caller didn't pass URLs. The host
  // SHOULD pass these explicitly, but in practice index.html ships with
  // empty defaults and users configure routing inside the PWA → those
  // values land in localStorage, never in window.AntCVOverlayConfig.
  if (!CFG.cvProxyOrigin && isWorkerUrl(lsProxyUrl))   CFG.cvProxyOrigin   = lsProxyUrl;
  if (!CFG.docxWorkerOrigin && isWorkerUrl(lsDocxUrl)) CFG.docxWorkerOrigin = lsDocxUrl;

  // ─── BRAND constants (v1.50.20) ────────────────────────────────
  // Bucket 2 hex-extraction: every hex literal that previously lived
  // inline in the CSS template / cssText calls below is now sourced
  // from this single named object. This is editor / sidecar chrome,
  // not document content — so the colours stay consistent across all
  // visual packages and don't map to package CSS variables. Future
  // colour adjustments are now a single-source edit.
  var BRAND = {
    // navy family (primary brand, headings, primary button)
    navy:            '#283556',
    navyDeep:        '#1f2a44',  // primary button hover
    navyText:        '#1a2433',  // body text on light bg

    // neutrals
    white:           '#fff',
    black:           '#000',
    bgHover:         '#f5f5f5',  // secondary button hover
    borderLight:     '#d0d8e0',  // panel borders
    borderFaint:     '#ccc',     // spinner / muted dividers
    separator:       '#eef0f3',  // panel header underline
    mutedStrong:     '#666',     // panel close button
    mutedText:       '#555',     // banner / summary body text

    // teal family (success / accent)
    teal:            '#00746E',
    tealBgLight:     '#e7f4f3',  // low-severity / success chip bg
    subtleBg:        '#f7f9fc',  // deviation card bg
    infoBg:          '#f0f4f8',  // summary card bg

    // warning family
    warning:         '#d9a23a',  // border + accent
    warningBg:       '#fff5e1',  // banner / medium-sev bg
    warningTextDeep: '#8a4a00',  // ungrounded answer text

    // danger family
    danger:          '#b8001f',
    dangerDeep:      '#8a0017',  // hover / fail score text
    dangerBg:        '#fdecea',  // warning banner + high-sev bg

    // score chips (pass / warn / fail)
    scorePassBg:     '#c8e6c9',
    scorePassText:   '#1b5e20',
    scoreWarnBg:     '#ffe0b2',
    scoreWarnText:   '#6d4c11',
    scoreFailBg:     '#ffcdd2',
    // scoreFailText reuses dangerDeep (#8a0017)
  };

  // ─── CSS ───────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .antcv-overlay {
      position: fixed; z-index: 99999;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px; color: ${BRAND.navyText};
      max-width: min(440px, calc(100vw - 32px));
      display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
    }
    .antcv-overlay-bottom-right { bottom: ${CFG.bottomOffset}px; right: ${CFG.rightOffset}px; }
    .antcv-overlay-bottom-left  { bottom: ${CFG.bottomOffset}px; left:  ${CFG.leftOffset}px; align-items: flex-start; }
    .antcv-overlay-top-right    { top:    ${CFG.topOffset}px;    right: ${CFG.rightOffset}px; }
    .antcv-overlay-top-left     { top:    ${CFG.topOffset}px;    left:  ${CFG.leftOffset}px; align-items: flex-start; }

    /* Hide overlay before PWA has any content. This covers both the
       initial upload screen and any post-reset state where the user
       hasn't yet generated CV/CL content. !important so it overrides
       any inline display: that might be applied by panel animations. */
    .antcv-overlay-hidden { display: none !important; }

    .antcv-btn {
      background: ${BRAND.navy}; color: ${BRAND.white}; border: none; padding: 8px 12px;
      border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .antcv-btn:hover { background: ${BRAND.navyDeep}; }
    .antcv-btn.antcv-btn-secondary { background: ${BRAND.white}; color: ${BRAND.navy}; border: 1px solid ${BRAND.navy}; }
    .antcv-btn.antcv-btn-secondary:hover { background: ${BRAND.bgHover}; }
    .antcv-btn.antcv-btn-danger { background: ${BRAND.danger}; }
    .antcv-btn.antcv-btn-danger:hover { background: ${BRAND.dangerDeep}; }
    .antcv-btn.antcv-btn-success { background: ${BRAND.teal}; }

    /* Compact icon-only button — the default reset button state.
       40x40 circle that sits unobtrusively in the corner. Click
       expands to the labeled version. */
    .antcv-fab {
      width: 40px; height: 40px; border-radius: 20px;
      background: ${BRAND.white}; color: ${BRAND.navy}; border: 1px solid ${BRAND.navy};
      cursor: pointer; font-size: 18px; font-weight: 500;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      display: flex; align-items: center; justify-content: center;
      padding: 0; line-height: 1;
      opacity: 0.85; transition: opacity 0.15s, background 0.15s;
    }
    .antcv-fab:hover { opacity: 1; background: ${BRAND.bgHover}; }
    /* Busy state: the FAB icon swaps to an hourglass and pulses
       gently. Pulse rather than spin because the hourglass char
       looks awkward rotating, and pulse is less attention-stealing
       in the user's peripheral vision while a 30s LLM call runs. */
    .antcv-fab-busy {
      cursor: wait !important;
      pointer-events: none; /* prevent re-click while busy */
      animation: antcv-fab-busy-pulse 1.4s ease-in-out infinite;
    }
    @keyframes antcv-fab-busy-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.55; transform: scale(0.92); }
    }
    .antcv-fab-labeled {
      width: auto; border-radius: 20px; padding: 0 14px 0 12px; height: 36px;
      font-size: 12px; gap: 6px;
    }

    .antcv-panel {
      background: ${BRAND.white}; border: 1px solid ${BRAND.borderLight}; border-radius: 8px;
      padding: 14px; max-width: 420px; box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      margin-top: 8px;
      /* Cap to ~70% of viewport height so long analyses (lots of
         questions, lots of red flags, recruiter snippets) scroll
         internally instead of growing the overlay container off
         the screen behind the PWA's bottom action bar. */
      max-height: calc(100vh - ${CFG.bottomOffset + CFG.topOffset + 24}px);
      overflow-y: auto;
      overflow-x: hidden;
    }
    .antcv-panel-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 10px;
      /* v1.08: Sticky so the × stays reachable when long analyses
         force the panel to scroll internally (lots of questions +
         red flags + recruiter info can easily exceed viewport
         height even with the panel's own max-height cap). */
      position: sticky; top: -14px; /* match panel padding-top */
      background: ${BRAND.white}; z-index: 2;
      padding-top: 14px; margin-top: -14px;
      padding-bottom: 6px; border-bottom: 1px solid ${BRAND.separator};
    }
    .antcv-panel-title { font-weight: 600; font-size: 14px; color: ${BRAND.navy}; }
    .antcv-panel-close { background: none; border: none; cursor: pointer; font-size: 16px; color: ${BRAND.mutedStrong}; padding: 0 4px; }
    .antcv-panel-close:hover { color: ${BRAND.black}; }

    .antcv-banner {
      background: ${BRAND.warningBg}; border: 1px solid ${BRAND.warning}; border-left: 4px solid ${BRAND.warning};
      padding: 10px 14px; border-radius: 4px; margin-bottom: 8px; max-width: 420px;
    }
    .antcv-banner-warning { background: ${BRAND.dangerBg}; border-color: ${BRAND.danger}; }
    .antcv-banner-title { font-weight: 600; margin-bottom: 4px; }
    .antcv-banner-body { font-size: 12px; color: ${BRAND.mutedText}; }

    .antcv-deviation { margin-bottom: 8px; padding: 8px; background: ${BRAND.subtleBg}; border-radius: 4px; border-left: 3px solid ${BRAND.borderFaint}; }
    .antcv-deviation.sev-high   { border-left-color: ${BRAND.danger}; background: ${BRAND.dangerBg}; }
    .antcv-deviation.sev-medium { border-left-color: ${BRAND.warning}; background: ${BRAND.warningBg}; }
    .antcv-deviation.sev-low    { border-left-color: ${BRAND.teal}; background: ${BRAND.tealBgLight}; }
    .antcv-deviation-type { font-weight: 600; font-size: 11px; text-transform: uppercase; color: ${BRAND.navy}; letter-spacing: 0.5px; }
    .antcv-deviation-evidence { margin: 4px 0; font-size: 12px; }
    .antcv-deviation-fix { font-size: 12px; color: ${BRAND.mutedText}; font-style: italic; }

    .antcv-actions { display: flex; gap: 6px; margin-top: 10px; }

    .antcv-summary {
      font-size: 12px; color: ${BRAND.mutedText}; margin-bottom: 8px; padding: 6px;
      background: ${BRAND.infoBg}; border-radius: 4px;
    }
    .antcv-score { display: inline-block; padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 11px; margin-left: 6px; }
    .antcv-score.pass { background: ${BRAND.scorePassBg}; color: ${BRAND.scorePassText}; }
    .antcv-score.warn { background: ${BRAND.scoreWarnBg}; color: ${BRAND.scoreWarnText}; }
    .antcv-score.fail { background: ${BRAND.scoreFailBg}; color: ${BRAND.dangerDeep}; }

    .antcv-spinner {
      display: inline-block; width: 12px; height: 12px; border: 2px solid ${BRAND.borderFaint};
      border-top-color: ${BRAND.navy}; border-radius: 50%; animation: antcv-spin 0.8s linear infinite;
    }
    @keyframes antcv-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(style);

  // ─── Root container ────────────────────────────────────────────
  const root = document.createElement('div');
  root.className = 'antcv-overlay antcv-overlay-' + CFG.position;
  document.body.appendChild(root);

  // ─── Visibility gate: hide overlay until the PWA has content ────
  // The FAB buttons (↺ reset, 🎓 analyze JD, 🔀 fusion) all act on
  // generated CV/CL content — they're meaningless on the upload /
  // setup screen. Keep the overlay invisible until the PWA reaches
  // a state where there's something to act on.
  //
  // Signals we read (all from localStorage, since the PWA writes
  // these as React state changes):
  //   - "step": one of upload, generating, analysis, edit, preview,
  //             sections. We hide on "upload" (the initial setup
  //             screen) and missing/empty. Show on every other
  //             value because each of those states has content.
  //   - "sections": JSON with cv:[…] and cl:[…]. If either array is
  //                 empty OR every item's content matches the
  //                 PWA's `[placeholder text]` pattern, treat as
  //                 "no content yet" and hide.
  //
  // We poll every 1.5s because:
  //   - The PWA doesn't dispatch a custom event when step changes
  //   - The `storage` event doesn't fire for same-window updates
  //   - DOM-mutation observers add complexity for marginal gain
  // 1.5s is below human reaction time for a state change like
  // "click Preview" and well within tolerable polling cost.
  function isContentReady() {
    let step = null;
    try {
      const raw = localStorage.getItem('step');
      if (raw) step = JSON.parse(raw);
    } catch (_) {}
    // Hide on the very initial upload screen
    if (!step || step === 'upload') return false;
    // For any non-upload step, also confirm sections actually has
    // editable content (not just placeholder text from a template).
    let sections;
    try {
      const raw = localStorage.getItem('sections');
      if (!raw) return false;
      sections = JSON.parse(raw);
    } catch (_) { return false; }
    if (!sections || typeof sections !== 'object') return false;
    const cv = Array.isArray(sections.cv) ? sections.cv : [];
    const cl = Array.isArray(sections.cl) ? sections.cl : [];
    if (cv.length === 0 && cl.length === 0) return false;
    // Check if any section has non-placeholder content. Placeholder
    // text in the PWA is bracketed: "[Profile text — 2-3 sentences…]".
    // Real content is text without surrounding brackets.
    const hasReal = sec => {
      if (!sec || sec.on === false) return false;
      // text / text_inline sections
      if (typeof sec.content === 'string') {
        const t = sec.content.trim();
        if (t && !(t.startsWith('[') && t.endsWith(']'))) return true;
      }
      // list / labeled_list / education / experience sections
      if (Array.isArray(sec.items) && sec.items.length > 0) {
        for (const it of sec.items) {
          if (typeof it === 'string') {
            const t = it.trim();
            if (t && !(t.startsWith('[') && t.endsWith(']'))) return true;
          } else if (it && typeof it === 'object') {
            for (const key of ['v', 'value', 'deg', 'degree', 'sch', 'school', 'content']) {
              const v = it[key];
              if (typeof v === 'string') {
                const t = v.trim();
                if (t && !(t.startsWith('[') && t.endsWith(']'))) return true;
              }
            }
          }
        }
      }
      // foundation section
      for (const key of ['hands_on', 'professionally']) {
        const v = sec[key];
        if (typeof v === 'string') {
          const t = v.trim();
          if (t && !(t.startsWith('[') && t.endsWith(']'))) return true;
        }
      }
      return false;
    };
    return cv.some(hasReal) || cl.some(hasReal);
  }

  function updateOverlayVisibility() {
    const ready = isContentReady();
    // Toggle a class on the root rather than display:none directly,
    // so panels (like JD analysis result) that are children of root
    // continue to follow the same visibility rule consistently.
    root.classList.toggle('antcv-overlay-hidden', !ready);
  }

  // Initial check + poll. The poll handle is kept on root so a
  // hot-reload doesn't accumulate intervals. (Not strictly needed
  // for a single-load PWA but cheap insurance.)
  if (root._antcvVisibilityTimer) clearInterval(root._antcvVisibilityTimer);
  updateOverlayVisibility();
  root._antcvVisibilityTimer = setInterval(updateOverlayVisibility, 1500);

  function el(tag, cls, content) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (content !== undefined) {
      if (typeof content === 'string') e.textContent = content;
      else if (Array.isArray(content)) content.forEach(c => c && e.appendChild(c));
      else if (content instanceof Node) e.appendChild(content);
    }
    return e;
  }

  // ─── FAB busy-state helpers ────────────────────────────────────
  // Swap the FAB icon to an hourglass and add a pulse animation
  // while a backing action is in progress. Save the original icon on
  // the element so we can restore it without callers needing to
  // remember what it was. Idempotent — calling setFabBusy on an
  // already-busy button is a no-op.
  //
  // The icon swap is preferred over an overlaid spinner because the
  // FABs are small (40×40) and an additional spinner element would
  // crowd or misalign with the existing icon. Replacing the icon
  // entirely is the cleanest signal that the button is doing work,
  // and ⏳ is a near-universal "wait" hint across cultures.
  function setFabBusy(btn) {
    if (!btn || btn.dataset.antcvOriginalIcon !== undefined) return;
    btn.dataset.antcvOriginalIcon = btn.textContent;
    btn.textContent = '⏳';
    btn.classList.add('antcv-fab-busy');
    btn.setAttribute('aria-busy', 'true');
  }
  function setFabIdle(btn) {
    if (!btn || btn.dataset.antcvOriginalIcon === undefined) return;
    btn.textContent = btn.dataset.antcvOriginalIcon;
    delete btn.dataset.antcvOriginalIcon;
    btn.classList.remove('antcv-fab-busy');
    btn.removeAttribute('aria-busy');
  }

  // ─── State ─────────────────────────────────────────────────────
  let lastCheckedOutput = '';   // de-dup so we don't double-check the same text
  let supervisorBusy = false;

  // ─── Word-compat banner (item 2) ───────────────────────────────
  function showWordWarning(status, replacements, markersRemaining, errorDetail) {
    if (!CFG.enabled.wordWarning) return;
    const banner = el('div', 'antcv-banner antcv-banner-warning');
    const title = el('div', 'antcv-banner-title', 'DocX exported — may experience issues in MS Word');
    const body = el('div', 'antcv-banner-body');
    let detail;
    if (status === 'partial') {
      detail = `Post-process completed partially: ${replacements} replacement(s), ${markersRemaining} marker(s) remaining. Continuation pages may show literal "__ANTCV_CONT_N__" text next to section headings. The file is well-formed and should open in MS Word, but you may want to regenerate.`;
    } else if (status === 'failed') {
      detail = `Post-process failed and the worker fell back to the unprocessed DOCX. The file should open in MS Word, LibreOffice, and Google Docs, but the "(Cont.)" suffix on continuation-page headings is not present.${errorDetail ? ' Detail: ' + errorDetail : ''}`;
    } else {
      detail = `Post-process status: ${status}. The file should open correctly but please verify in MS Word.`;
    }
    body.textContent = detail;

    const close = el('button', 'antcv-panel-close', '×');
    close.onclick = () => banner.remove();
    const header = el('div', 'antcv-panel-header', [
      el('div', 'antcv-banner-title', 'File exported — may have issues in MS Word'),
      close,
    ]);
    banner.innerHTML = '';
    banner.appendChild(header);
    banner.appendChild(body);
    root.insertBefore(banner, root.firstChild);
    setTimeout(() => banner.remove(), 20000);
  }

  // ─── Supervisor panel (item 1) ─────────────────────────────────
  function showSupervisorPanel(task, candidateOutput, result) {
    if (!CFG.enabled.supervisor) return;
    const panel = el('div', 'antcv-panel');

    const close = el('button', 'antcv-panel-close', '×');
    close.onclick = () => panel.remove();
    const scoreClass = result.score >= 85 ? 'pass' : result.score >= 70 ? 'warn' : 'fail';
    const header = el('div', 'antcv-panel-header', [
      el('div', 'antcv-panel-title', `Supervisor: ${task}`),
      close,
    ]);
    const scoreSpan = el('span', 'antcv-score ' + scoreClass, String(result.score));
    header.firstChild.appendChild(scoreSpan);
    panel.appendChild(header);

    if (result.summary) {
      panel.appendChild(el('div', 'antcv-summary', result.summary));
    }

    const devs = result.deviations || [];
    if (devs.length === 0) {
      panel.appendChild(el('div', 'antcv-banner', '✓ No issues flagged.'));
    } else {
      devs.slice(0, 10).forEach(d => {
        const div = el('div', 'antcv-deviation sev-' + (d.severity || 'low'));
        div.appendChild(el('div', 'antcv-deviation-type', `${d.severity || 'low'} · ${d.type}`));
        div.appendChild(el('div', 'antcv-deviation-evidence', d.evidence || ''));
        if (d.fix) div.appendChild(el('div', 'antcv-deviation-fix', '→ ' + d.fix));
        panel.appendChild(div);
      });
    }

    if (devs.length > 0 && result.repair_prompt) {
      const actions = el('div', 'antcv-actions');
      const autoFix = el('button', 'antcv-btn antcv-btn-success', 'Auto-fix');
      autoFix.onclick = async () => {
        autoFix.disabled = true;
        autoFix.innerHTML = '<span class="antcv-spinner"></span> Repairing…';
        const repaired = await runSupervisorRepair(task, candidateOutput);
        if (repaired && repaired.repaired_output) {
          // Copy repaired text to clipboard for the user to paste in
          try { await navigator.clipboard.writeText(repaired.repaired_output); } catch (_) {}
          autoFix.textContent = 'Copied to clipboard';
        } else {
          autoFix.textContent = 'Repair failed';
        }
      };
      actions.appendChild(autoFix);

      const dismiss = el('button', 'antcv-btn antcv-btn-secondary', 'Accept anyway');
      dismiss.onclick = () => panel.remove();
      actions.appendChild(dismiss);
      panel.appendChild(actions);
    }

    root.insertBefore(panel, root.firstChild);
  }

  async function runSupervisor(task, candidateOutput) {
    if (!CFG.enabled.supervisor) return null;
    if (supervisorBusy) return null;
    if (!candidateOutput || candidateOutput.length < 10) return null;
    if (candidateOutput === lastCheckedOutput) return null;
    lastCheckedOutput = candidateOutput;
    supervisorBusy = true;

    refreshUrlsFromLS();
    const sourceCv = getSourceCV();

    try {
      const res = await fetch(CFG.cvProxyOrigin + '/api/supervisor/check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          candidate_output: candidateOutput,
          source_cv: sourceCv,
        }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      supervisorBusy = false;
      if (data.ok && !data.passed) {
        showSupervisorPanel(task, candidateOutput, data);
      }
      return data;
    } catch (e) {
      supervisorBusy = false;
      return null;
    }
  }

  async function runSupervisorRepair(task, candidateOutput) {
    refreshUrlsFromLS();
    const sourceCv = getSourceCV();
    try {
      const res = await fetch(CFG.cvProxyOrigin + '/api/supervisor/check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          candidate_output: candidateOutput,
          source_cv: sourceCv,
          auto_repair: true,
        }),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function getSourceCV() {
    // Best-effort grounding-source resolution. Tries the configured
    // localStorage key first; falls back to scanning visible CV text
    // in the DOM. The PWA's actual structure varies by version, so
    // we cast a wide net.
    try {
      const raw = localStorage.getItem(CFG.sourceCvLocalStorageKey);
      if (raw) return raw;
    } catch (_) {}
    // Fallback: serialize all keys that look like CV content
    try {
      const parts = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('antcv') && (k.includes('section') || k.includes('content') || k.includes('meta'))) {
          parts.push(localStorage.getItem(k));
        }
      }
      if (parts.length > 0) return parts.join('\n');
    } catch (_) {}
    return '';
  }

  // ─── JD analysis (recruiter + questions + red flags) ───────────
  let jdAnalysisBusy = false;
  // Top-scope FAB references so the busy-state helpers can flip
  // their icons from inside async handlers without needing to be
  // passed the element each time. Assigned when the FABs are
  // created near the end of this IIFE.
  let jdAnalyzeFab = null;
  let fusionFab = null;

  async function runJDAnalysis(jdText) {
    if (jdAnalysisBusy) return null;
    if (!jdText || jdText.length < 80) {
      alert('No JD text found.\n\nUpload a JD in the PWA first (the overlay will capture it from the LLM calls), or paste the text into the panel that appears when you click the 🔍 button.');
      return null;
    }
    refreshUrlsFromLS();
    // v1.18 — fail fast with a diagnostic message instead of POSTing
    // to the current Pages origin (which returns 405). The previous
    // version's filter was too strict and rejected valid custom-domain
    // proxies. Now we only reject the cases that we know fail.
    if (!isValidProxyUrl(CFG.cvProxyOrigin)) {
      const cur = CFG.cvProxyOrigin || readLsString('proxyUrl') || '';
      let reason = 'No URL stored.';
      if (cur) {
        try {
          const p = new URL(cur);
          if (p.protocol !== 'https:') reason = `Not https: ${cur}`;
          else if (p.hostname === location.hostname) reason = `Same hostname as the page itself: ${cur}`;
          else if (/\.pages\.dev$/i.test(p.hostname)) reason = `Points at a Cloudflare Pages domain: ${cur}`;
          else reason = `Stored value: ${cur}`;
        } catch (_) { reason = `Stored value is not a valid URL: ${cur}`; }
      }
      showJDAnalysisError(
        'Worker URL not usable for JD analysis. ' + reason + ' ' +
        'Open ⚙ Settings → Account → Cloudflare Worker URL to paste your relay URL, ' +
        'or re-run the setup wizard from Settings → Sync → Re-run setup wizard.'
      );
      return null;
    }
    jdAnalysisBusy = true;
    setFabBusy(jdAnalyzeFab);
    showJDAnalysisLoading();
    try {
      const sourceCv = getSourceCV();
      const res = await fetch(CFG.cvProxyOrigin + '/api/jd-analysis', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jd_text: jdText,
          candidate_summary: sourceCv.slice(0, 8000),
          search_recruiter: true,
        }),
      });
      jdAnalysisBusy = false;
      setFabIdle(jdAnalyzeFab);

      // v1.17 — read body exactly once, then decide whether it parses as
      // JSON. The previous pattern (.json() in try, .text() in catch)
      // threw "body stream already read" whenever the body was partially
      // consumed before the JSON parser failed.
      const raw = await res.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (_) { data = null; }

      if (!res.ok) {
        const hint = (data && (data.hint || data.error)) || raw.slice(0, 300) || res.statusText;
        showJDAnalysisError(`Analysis failed (${res.status}). ${hint}`);
        return null;
      }
      if (!data) {
        showJDAnalysisError(`Analysis returned a non-JSON response. First 200 bytes: ${raw.slice(0, 200)}`);
        return null;
      }
      if (data.ok) {
        showJDAnalysisPanel(data);
        return data;
      }
      showJDAnalysisError(data.error || 'Unknown error');
      return null;
    } catch (e) {
      jdAnalysisBusy = false;
      setFabIdle(jdAnalyzeFab);
      showJDAnalysisError(String(e && e.message || e));
      return null;
    }
  }

  // Remove any previous JD analysis panel before showing a new one.
  function dropJDAnalysisPanels() {
    root.querySelectorAll('[data-antcv-jd-panel]').forEach(n => n.remove());
  }

  function showJDAnalysisLoading() {
    dropJDAnalysisPanels();
    const panel = el('div', 'antcv-panel');
    panel.setAttribute('data-antcv-jd-panel', '1');
    panel.appendChild(el('div', 'antcv-panel-title', '🔍 Analyzing JD…'));
    panel.appendChild(el('div', 'antcv-summary', 'Extracting recruiter, questions, and red flags. This usually takes 2-4 seconds.'));
    root.insertBefore(panel, root.firstChild);
  }

  function showJDAnalysisError(msg) {
    dropJDAnalysisPanels();
    const panel = el('div', 'antcv-panel');
    panel.setAttribute('data-antcv-jd-panel', '1');
    const close = el('button', 'antcv-panel-close', '×');
    close.onclick = () => panel.remove();
    const header = el('div', 'antcv-panel-header', [
      el('div', 'antcv-panel-title', 'JD analysis failed'),
      close,
    ]);
    panel.appendChild(header);
    panel.appendChild(el('div', 'antcv-deviation sev-high', msg));
    root.insertBefore(panel, root.firstChild);
  }

  // Render the structured analysis result from /api/jd-analysis.
  // Renders sections: Recruiter, Questions in JD, Company/Role,
  // Red flags. Each is optional — missing sections are suppressed.
  function showJDAnalysisPanel(data) {
    dropJDAnalysisPanels();
    const a = data.analysis || {};
    const panel = el('div', 'antcv-panel');
    panel.setAttribute('data-antcv-jd-panel', '1');
    panel.style.maxWidth = '480px';

    const close = el('button', 'antcv-panel-close', '×');
    close.onclick = () => panel.remove();
    const titleStr = a.role?.title
      ? `🔍 ${a.role.title}${a.company?.name ? ' · ' + a.company.name : ''}`
      : '🔍 JD analysis';
    panel.appendChild(el('div', 'antcv-panel-header', [
      el('div', 'antcv-panel-title', titleStr),
      close,
    ]));

    if (a.summary) {
      panel.appendChild(el('div', 'antcv-summary', a.summary));
    }

    // ── Recruiter card ──
    // v1.40.7 — guard against placeholder/garbage recruiter names. The
    // LLM sometimes lifts phrases like "If you have any", "Contact us",
    // or arbitrary HR-page copy and reports them as the recruiter's
    // name. The red-flags section already catches this; the recruiter
    // card shouldn't.
    function isPlausibleRecruiterName(name) {
      if (!name || typeof name !== 'string') return false;
      const t = name.trim();
      if (t.length < 3 || t.length > 80) return false;
      const bad = [
        /^if you\b/i, /^contact (us|our)\b/i, /^for more\b/i, /^visit\b/i,
        /^click\b/i, /^learn more\b/i, /^apply\b/i, /^send (us|your)\b/i,
        /\bif you have\b/i, /\?/, /\bany questions?\b/i, /\bnotice\b/i,
        /^hr\b/i, /^the (hr|hiring|recruitment) team\b/i,
        /\b(team|department|office)$/i,
      ];
      if (bad.some(rx => rx.test(t))) return false;
      // Person name heuristic: 2+ tokens, at least 2 start uppercase.
      const tokens = t.split(/\s+/);
      if (tokens.length < 2) return false;
      const cap = tokens.filter(s => /^[A-ZÆØÅÄÖÜÉÈÊÀÂÇÑ]/.test(s)).length;
      return cap >= 2;
    }
    const recruiterIsPlausible =
      a.recruiter &&
      (isPlausibleRecruiterName(a.recruiter.name) || a.recruiter.email || a.recruiter.linkedin);
    if (recruiterIsPlausible) {
      const card = el('div', 'antcv-deviation sev-low');
      card.appendChild(el('div', 'antcv-deviation-type', 'Recruiter'));
      const lines = [];
      if (a.recruiter.name)  lines.push(`<b>${escapeHtml(a.recruiter.name)}</b>`);
      if (a.recruiter.title) lines.push(escapeHtml(a.recruiter.title));
      if (a.recruiter.email) lines.push(`<a href="mailto:${encodeURIComponent(a.recruiter.email)}" style="color:${BRAND.navy}">${escapeHtml(a.recruiter.email)}</a>`);
      const lin = a.recruiter.linkedin || a.recruiter.web_signals?.linkedin_url;
      if (lin) {
        const partial = a.recruiter.web_signals && a.recruiter.web_signals.linkedin_match_strong === false ? ' (partial match — verify)' : '';
        lines.push(`<a href="${encodeURIComponent(lin)}" target="_blank" rel="noopener" style="color:${BRAND.navy}">LinkedIn${escapeHtml(partial)}</a>`);
      }
      if (a.recruiter.notes) lines.push(escapeHtml(a.recruiter.notes));
      if (a.recruiter.web_signals?.snippets?.length) {
        lines.push(`<small style="color:${BRAND.mutedStrong}">Web: ${escapeHtml(a.recruiter.web_signals.snippets[0].slice(0, 180))}</small>`);
      }
      const div = document.createElement('div');
      div.className = 'antcv-deviation-evidence';
      div.innerHTML = lines.join('<br>');
      card.appendChild(div);
      panel.appendChild(card);
    } else if (a.recruiter === null || (a.recruiter && !recruiterIsPlausible)) {
      const card = el('div', 'antcv-deviation sev-medium');
      card.appendChild(el('div', 'antcv-deviation-type', 'Recruiter'));
      card.appendChild(el('div', 'antcv-deviation-evidence', 'No named recruiter in the JD. Apply via the role posting; the JD did not give a personal contact.'));
      panel.appendChild(card);
    }

    // ── Questions in JD ──
    if (Array.isArray(a.questions_in_jd) && a.questions_in_jd.length > 0) {
      const block = el('div', 'antcv-deviation sev-low');
      block.appendChild(el('div', 'antcv-deviation-type', `Questions in JD (${a.questions_in_jd.length})`));
      const list = document.createElement('div');
      list.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 6px;';
      for (const q of a.questions_in_jd) {
        const qDiv = document.createElement('div');
        qDiv.style.cssText = `padding: 6px; background: ${BRAND.white}; border-left: 3px solid ${BRAND.teal}; border-radius: 3px;`;
        qDiv.innerHTML = `<div style="font-weight:600;font-size:12px;margin-bottom:4px">Q. ${escapeHtml(q.question)}</div>` +
          `<div style="font-size:12px;color:${q.grounded ? BRAND.navyText : BRAND.warningTextDeep}">A. ${escapeHtml(q.suggested_answer || '(no answer)')}</div>` +
          (q.grounded ? '' : `<div style="font-size:10px;color:${BRAND.warningTextDeep};margin-top:4px">⚠ not grounded in your CV — fill in manually</div>`);
        list.appendChild(qDiv);
      }
      block.appendChild(list);
      panel.appendChild(block);
    }

    // ── Role/company keywords (compact) ──
    if (a.role?.keywords?.length) {
      const card = el('div', 'antcv-deviation sev-low');
      card.appendChild(el('div', 'antcv-deviation-type', 'Top keywords'));
      const div = document.createElement('div');
      div.className = 'antcv-deviation-evidence';
      div.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';
      a.role.keywords.slice(0, 12).forEach(k => {
        const chip = document.createElement('span');
        chip.style.cssText = `background:${BRAND.tealBgLight};color:${BRAND.teal};padding:2px 8px;border-radius:10px;font-size:11px;`;
        chip.textContent = k;
        div.appendChild(chip);
      });
      card.appendChild(div);
      panel.appendChild(card);
    }

    // ── Red flags ──
    if (Array.isArray(a.red_flags) && a.red_flags.length > 0) {
      const card = el('div', 'antcv-deviation sev-medium');
      card.appendChild(el('div', 'antcv-deviation-type', `Red flags (${a.red_flags.length})`));
      const ul = document.createElement('ul');
      ul.style.cssText = 'margin: 4px 0 0 14px; font-size: 12px; padding: 0;';
      a.red_flags.forEach(f => {
        const li = document.createElement('li');
        li.style.marginBottom = '3px';
        li.textContent = f;
        ul.appendChild(li);
      });
      card.appendChild(ul);
      panel.appendChild(card);
    }

    // ── Action row ──
    const actions = el('div', 'antcv-actions');

    // "Append to cover letter" — only shown when the analysis actually
    // returned questions. Appends them as an editable labeled_list
    // section at the end of ct.cl with pageBreakBefore so it lands on
    // its own last page in the docx output. The PWA's existing
    // section editor handles editing — these become regular sections.
    const hasQs = Array.isArray(a.questions_in_jd) && a.questions_in_jd.length > 0;
    if (hasQs) {
      const appendBtn = el('button', 'antcv-btn antcv-btn-success', 'Append to cover letter');
      appendBtn.title = 'Add these questions + answers as a new last page in the cover letter, fully editable';
      appendBtn.onclick = () => {
        const result = appendQuestionsToCoverLetter(a.questions_in_jd);
        if (result.ok) {
          // v1.07: NO reload. The previous approach (window.location.replace)
          // wiped out the in-memory JD analysis (the `vo` rationale state
          // in the React tree) and any overlay-side cache of the JD text,
          // so coming back to the JD panel forced a full re-analysis. It
          // also had a race condition: if React's debounced sections-save
          // useEffect had a pending timer at the moment of reload, it
          // would overwrite the freshly-appended jd_questions section
          // with stale in-memory state right before the navigation, so
          // after reload the section was simply gone.
          //
          // Instead: dispatch a custom event. The React app subscribes
          // to `antcv:sections-updated` and re-reads localStorage,
          // updating its in-memory section state without unmounting.
          // The JD analysis stays alive. The user sees the new
          // QUESTIONS FROM THE JD section appear at the bottom of BODY
          // immediately.
          try {
            window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
              detail: { source: 'jd-questions-append', added: result.added }
            }));
          } catch (e) {
            console.warn('antcv: dispatchEvent failed', e);
          }
          appendBtn.textContent = `\u2713 Added ${result.added} \u2014 see CL editor`;
          appendBtn.disabled = true;
          appendBtn.classList.remove('antcv-btn-success');
          appendBtn.classList.add('antcv-btn-secondary');
        } else {
          alert('Could not append questions: ' + result.error);
        }
      };
      actions.appendChild(appendBtn);
    }

    // Only attach the action row when there's an Append button to
    // show. The previous "Copy as text" + "Close" buttons sat below
    // the panel content and got hidden under the PWA's bottom bar
    // at 100% zoom anyway — neither was reliable nor essential. The
    // × button at the top of the panel is sufficient to close.
    // (Copy-to-clipboard is rarely needed since the user can copy
    // any specific field directly from the panel text.)
    if (actions.childNodes.length > 0) {
      panel.appendChild(actions);
    }

    // Bottom spacer — adds breathing room below the last card so
    // that the visible content doesn't butt up against the bottom
    // edge of the panel (which itself sits just above the PWA's
    // bottom bar). Empty div with height — purely a layout reserve.
    const spacer = document.createElement('div');
    spacer.style.cssText = 'height: 18px; flex-shrink: 0;';
    panel.appendChild(spacer);

    root.insertBefore(panel, root.firstChild);
  }

  // Append a structured questions+answers section to the cover letter
  // in localStorage. Returns { ok, added } on success or { ok:false,
  // error } on failure.
  //
  // Implementation notes:
  // - Reads the "sections" key (the PWA's primary state store).
  // - If a previous jd_questions section exists, REPLACES it rather
  //   than stacking duplicates. The user expects re-running analysis
  //   on a new JD to refresh the questions, not pile them up.
  // - The new section uses `type: 'labeled_list'` (already supported
  //   by the PWA's CL renderer with full editor support) and carries
  //   `pageBreakBefore: true` so the docx worker pushes it onto a
  //   fresh last page. The PDF preview won't honor the page break
  //   without a print-template patch (separate item) — but the
  //   section IS editable and appears at the end of the CL in the
  //   in-app preview regardless.
  function appendQuestionsToCoverLetter(questions) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return { ok: false, error: 'No questions to append.' };
    }
    let raw;
    try { raw = localStorage.getItem('sections'); }
    catch (e) { return { ok: false, error: 'Could not read sections from storage: ' + e.message }; }
    if (!raw) return { ok: false, error: 'No sections in storage yet — load a CV first.' };
    let sections;
    try { sections = JSON.parse(raw); }
    catch (e) { return { ok: false, error: 'sections JSON is malformed: ' + e.message }; }
    if (!sections || typeof sections !== 'object' || !Array.isArray(sections.cl)) {
      return { ok: false, error: 'sections.cl is missing or not an array.' };
    }

    // Build the new section. Each question becomes a labeled item
    // with the question as label and the suggested answer as value.
    // Items the JD analysis flagged as not-grounded get an inline
    // "[verify]" cue so the user knows to edit them before sending.
    const items = questions.map(q => {
      const label = String(q.question || '').trim();
      let value = String(q.suggested_answer || '').trim();
      if (q.grounded === false && value) {
        value = '[verify] ' + value;
      }
      return { l: label, v: value };
    }).filter(it => it.l);

    if (items.length === 0) {
      return { ok: false, error: 'All question entries were empty after trim.' };
    }

    const newSection = {
      id: 'jd_questions',
      title: 'QUESTIONS FROM THE JD',
      loc: 'main',
      on: true,
      type: 'labeled_list',
      pageBreakBefore: true,
      items: items,
    };

    // Replace any pre-existing jd_questions section so re-running
    // analysis doesn't stack duplicates.
    sections.cl = sections.cl.filter(s => s && s.id !== 'jd_questions');
    sections.cl.push(newSection);

    try { localStorage.setItem('sections', JSON.stringify(sections)); }
    catch (e) { return { ok: false, error: 'Failed to save sections: ' + e.message }; }

    return { ok: true, added: items.length };
  }

  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }

  function formatAnalysisAsText(a) {
    const lines = [];
    if (a.role?.title) lines.push(`Role: ${a.role.title}`);
    if (a.company?.name) lines.push(`Company: ${a.company.name}`);
    if (a.summary) lines.push(`\n${a.summary}`);
    if (a.recruiter && a.recruiter.name) {
      lines.push(`\nRecruiter: ${a.recruiter.name}`);
      if (a.recruiter.title) lines.push(`  Title: ${a.recruiter.title}`);
      if (a.recruiter.email) lines.push(`  Email: ${a.recruiter.email}`);
      if (a.recruiter.linkedin) lines.push(`  LinkedIn: ${a.recruiter.linkedin}`);
    }
    if (a.questions_in_jd?.length) {
      lines.push('\nQuestions:');
      a.questions_in_jd.forEach((q, i) => {
        lines.push(`  ${i+1}. Q: ${q.question}`);
        lines.push(`     A: ${q.suggested_answer}${q.grounded ? '' : ' (NOT grounded)'}`);
      });
    }
    if (a.red_flags?.length) {
      lines.push('\nRed flags:');
      a.red_flags.forEach(f => lines.push(`  - ${f}`));
    }
    return lines.join('\n');
  }

  // Shows a paste textarea when no JD has been captured yet.
  function showJDPastePrompt() {
    dropJDAnalysisPanels();
    const panel = el('div', 'antcv-panel');
    panel.setAttribute('data-antcv-jd-panel', '1');
    const close = el('button', 'antcv-panel-close', '×');
    close.onclick = () => panel.remove();
    panel.appendChild(el('div', 'antcv-panel-header', [
      el('div', 'antcv-panel-title', '🔍 Paste JD text to analyze'),
      close,
    ]));
    panel.appendChild(el('div', 'antcv-summary',
      'No JD captured yet. Paste the JD here (or upload one in the PWA first, then click 🔍 again).'
    ));
    const ta = document.createElement('textarea');
    ta.style.cssText = `width: 100%; min-height: 140px; padding: 8px; border: 1px solid ${BRAND.borderLight}; border-radius: 4px; font-family: monospace; font-size: 11px; resize: vertical;`;
    ta.placeholder = 'Paste job description here…';
    panel.appendChild(ta);
    const actions = el('div', 'antcv-actions');
    const run = el('button', 'antcv-btn antcv-btn-success', 'Analyze');
    run.onclick = () => {
      const text = (ta.value || '').trim();
      if (text.length < 80) { alert('Paste at least 80 characters of JD text.'); return; }
      runJDAnalysis(text);
    };
    actions.appendChild(run);
    const dismiss = el('button', 'antcv-btn antcv-btn-secondary', 'Cancel');
    dismiss.onclick = () => panel.remove();
    actions.appendChild(dismiss);
    panel.appendChild(actions);
    root.insertBefore(panel, root.firstChild);
    // Auto-focus the textarea so the user can paste immediately
    setTimeout(() => ta.focus(), 50);
  }

  // ─── Fetch interceptor ─────────────────────────────────────────
  // Wraps window.fetch so we can observe LLM responses without
  // patching the React bundle. The interceptor is non-blocking:
  // the original response is returned to the caller unchanged.
  // Track the most recently observed JD-likely text from intercepted
  // fetch requests. The PWA wraps JD text inside an LLM call for
  // tasks like parse_jd, consensus_poll, extract_keywords. We pluck
  // the JD out of those bodies opportunistically so the Analyze JD
  // button can run without asking the user to re-paste.
  let lastCapturedJD = null;
  let lastCapturedJDAt = 0;

  // Heuristic: extract the largest plausible JD payload from a
  // request body. The PWA-side body is a JSON object with a
  // `messages` array; the user message content is usually the JD
  // text wrapped in a small instruction prefix. We pull each user
  // message, look for the LARGEST block of plain text, and return
  // that as the candidate.
  //
  // GUARDRAIL: when the PWA generates a CV, it sends the candidate's
  // own profile, work history, certifications etc. as the user
  // message body. Without rejection logic we'd capture that as "JD"
  // and feed the user's own CV back to /api/jd-analysis on the next
  // 🔍 click — the analyzer then correctly reports "this is candidate
  // profile data, not a JD". Filter those out by looking for
  // CV-specific signals (section headers, personal info, the user's
  // own name) and refusing to capture when they're present.
  function looksLikeCV(text) {
    if (!text) return false;
    const lower = text.toLowerCase();
    // CV section headers — every CV has at least 2-3 of these.
    const cvSections = [
      'selected outcomes',
      'core competencies',
      'professional experience',
      'tools & methods', 'tools and methods',
      'regulatory context',
      'publications & patent', 'publications and patent',
      'additional information',
      'work style',
      'core competences',
    ];
    let sectionHits = 0;
    for (const s of cvSections) {
      if (lower.includes(s)) sectionHits++;
    }
    if (sectionHits >= 2) return true;
    // CV-shaped headers like "PROFILE" plus contact line signals.
    const headerSignals =
      /\bPROFILE\b/.test(text) +
      /\bSELECTED OUTCOMES\b/.test(text) +
      /\bPROFESSIONAL EXPERIENCE\b/.test(text) +
      /\bCORE COMPETENCIES\b/.test(text);
    if (headerSignals >= 2) return true;
    // The user's full name (from personalInfo) — if the bundle
    // is configured for a specific person, this is a strong CV signal.
    // We read the name from window.localStorage via the same key
    // the PWA uses ("personalInfo"). Don't fail-open if storage is
    // unavailable.
    try {
      const piRaw = localStorage.getItem('personalInfo') || '';
      if (piRaw) {
        const pi = JSON.parse(piRaw);
        if (pi && typeof pi.name === 'string' && pi.name.length >= 6) {
          if (text.includes(pi.name)) return true;
        }
      }
    } catch (_) {}
    return false;
  }

  function extractJDFromRequestBody(bodyText) {
    if (!bodyText || typeof bodyText !== 'string' || bodyText.length < 200) return null;
    try {
      const body = JSON.parse(bodyText);
      const msgs = Array.isArray(body.messages) ? body.messages : [];
      let best = '';
      for (const m of msgs) {
        if (!m || (m.role !== 'user' && m.role !== undefined)) continue;
        const c = m.content;
        if (typeof c === 'string') {
          if (c.length > best.length) best = c;
        } else if (Array.isArray(c)) {
          for (const block of c) {
            if (block && block.type === 'text' && typeof block.text === 'string') {
              if (block.text.length > best.length) best = block.text;
            }
          }
        }
      }
      if (best.length < 200) return null;
      // Reject CV-shaped content — see looksLikeCV() comment above.
      if (looksLikeCV(best)) return null;
      // Strip any obvious wrapper preamble like "Analyze this JD:" or
      // "Here is the job description:" so the user sees the cleanest
      // captured text. Conservative — only strip recognised patterns.
      let cleaned = best
        .replace(/^[^]*?(job description|JD)[: \n]+/i, '')
        .replace(/^[^]*?paste the[^:]+:[\s\n]+/i, '')
        .trim();
      if (cleaned.length < 200) cleaned = best.trim();
      return cleaned;
    } catch (_) { return null; }
  }

  const origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    const url = typeof input === 'string' ? input : (input && input.url) || '';

    // Don't try to inspect non-OK responses or non-cv-proxy/docx-worker calls
    const proxyUrl = (function(){ try { return (localStorage.getItem('proxyUrl')||'').replace(/^"|"$/g,''); } catch(_){ return ''; } })();
    const isCvProxy = url.includes(CFG.cvProxyOrigin) || url.includes('/v1/messages') || (proxyUrl && url.includes(new URL(proxyUrl).hostname));
    const isDocxWorker = url.includes(CFG.docxWorkerOrigin);

    // Capture JD-likely text from request bodies BEFORE the fetch
    // round-trip. Cheaper than cloning the response, and gives us
    // JD content even when the LLM call fails (which is common for
    // long JDs that exceed token limits).
    if (isCvProxy && init && init.body && typeof init.body === 'string') {
      const captured = extractJDFromRequestBody(init.body);
      if (captured) {
        const prevLen = lastCapturedJD ? lastCapturedJD.length : 0;
        // Accept the capture if it's the first one, OR longer than what
        // we have, OR strongly looks like a JD on stronger signals (in
        // case the user pastes a fresh JD that's shorter than a CV body
        // we'd captured earlier).
        const lower = captured.toLowerCase();
        const jdScore =
          (lower.includes('responsibilities') ? 2 : 0) +
          (lower.includes('requirements') || lower.includes('qualifications') ? 2 : 0) +
          (lower.includes('you will') ? 1 : 0) +
          (lower.includes('we are looking') ? 1 : 0) +
          (lower.includes('about us') || lower.includes('about the role') ? 1 : 0);
        const fresh = (Date.now() - lastCapturedJDAt) > 60_000;
        const shouldReplace =
          prevLen === 0 ||
          captured.length > prevLen ||
          (jdScore >= 2 && fresh);
        if (shouldReplace) {
          lastCapturedJD = captured;
          lastCapturedJDAt = Date.now();
        }
      }
    }

    const response = await origFetch(input, init);

    if (!response.ok) return response;

    // ── Item 2: DocX export warning header
    if (isDocxWorker && CFG.enabled.wordWarning) {
      const status = response.headers.get('X-AntCV-Post-Process-Status');
      const wc = response.headers.get('X-AntCV-Word-Compatible');
      if (status && status !== 'ok' && status !== 'skipped') {
        const replacements = response.headers.get('X-AntCV-Cont-Replacements') || '0';
        const markers = response.headers.get('X-AntCV-Markers-Remaining') || '0';
        const err = response.headers.get('X-AntCV-Post-Process-Error') || null;
        showWordWarning(status, replacements, markers, err);
      }
      return response;
    }

    // ── Item 1: Supervisor post-check
    if (isCvProxy && CFG.enabled.supervisor) {
      const task = response.headers.get('X-AntCV-Task');
      if (task) {
        // Clone so caller still gets a fresh body
        const clone = response.clone();
        clone.text().then(body => {
          const extracted = extractLLMText(body);
          if (extracted) runSupervisor(task, extracted);
        }).catch(() => {});
      }
    }

    return response;
  };

  // Expose for the JD analyze button — read-only access to the most
  // recent captured JD plus its timestamp.
  function getCapturedJD() {
    if (!lastCapturedJD) return null;
    return { text: lastCapturedJD, capturedAt: lastCapturedJDAt };
  }

  function extractLLMText(body) {
    if (!body || typeof body !== 'string') return null;
    // Anthropic non-streaming: { content: [{ type: 'text', text: '...' }] }
    // Anthropic streaming (SSE): newline-delimited "data: { ... }" lines
    // OpenAI/Mistral/Gemini-normalized: { choices: [{ message: { content: '...' } }] }
    try {
      // Streaming first — most common for Anthropic
      if (body.includes('event: content_block_delta') || body.startsWith('event:') || body.includes('"type":"content_block_delta"')) {
        let combined = '';
        for (const line of body.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          try {
            const obj = JSON.parse(line.slice(6));
            if (obj.type === 'content_block_delta' && obj.delta && obj.delta.text) {
              combined += obj.delta.text;
            } else if (obj.delta && typeof obj.delta.text === 'string') {
              combined += obj.delta.text;
            }
          } catch (_) {}
        }
        if (combined) return combined.trim();
      }
      const obj = JSON.parse(body);
      if (Array.isArray(obj.content)) {
        return obj.content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
      }
      if (Array.isArray(obj.choices) && obj.choices[0]?.message?.content) {
        return String(obj.choices[0].message.content).trim();
      }
    } catch (_) {}
    return null;
  }

  // ─── Reset-for-new-JD button (item 4) ──────────────────────────
  if (CFG.enabled.resetButton) {
    // Compact circular icon by default. Tap/click once to expand into
    // the labeled version; tap/click again (now showing label) to
    // trigger the actual reset. This double-action avoids ANY chance
    // of accidental data loss from a stray click in the corner.
    // When the supervisor or word-compat banners are showing the
    // overlay container grows; the reset button stays anchored to the
    // bottom of the stack thanks to the flex layout.
    const btn = el('button', 'antcv-fab', '↺');
    btn.title = 'Reset CV content for new JD';
    btn.setAttribute('aria-label', 'Reset CV content for new JD');
    let expanded = !CFG.resetButtonCollapsed;
    const collapse = () => {
      btn.className = 'antcv-fab';
      btn.textContent = '↺';
      btn.title = 'Reset CV content for new JD (click to expand)';
      expanded = false;
    };
    const expand = () => {
      btn.className = 'antcv-fab antcv-fab-labeled';
      btn.textContent = '↺ Reset CV for new JD';
      btn.title = 'Click again to confirm and reset';
      expanded = true;
      // Auto-collapse after 5s if the user doesn't act
      setTimeout(() => { if (expanded) collapse(); }, 5000);
    };
    if (!expanded) collapse();
    btn.onclick = (ev) => {
      if (!expanded) { expand(); return; }
      const ok = confirm(
        'Reset CV section content before loading a new JD?\n\n' +
        'This clears the Profile, Outcomes, Core Competencies, and any other ' +
        'role-specific content you typed or generated. Settings, headings, ' +
        'photo, and your editorial preferences (banned words, layout, colours) ' +
        'are KEPT.\n\n' +
        'Tip: use this every time you load a new JD to avoid carrying claims ' +
        'between roles.'
      );
      if (!ok) { collapse(); return; }
      const cleared = [];
      for (const key of CFG.contentLocalStorageKeys) {
        try {
          if (localStorage.getItem(key) !== null) {
            localStorage.removeItem(key);
            cleared.push(key);
          }
        } catch (_) {}
      }
      // Dispatch a custom event the PWA can listen for (if it ever
      // adds such a listener). Harmless if no one's listening.
      window.dispatchEvent(new CustomEvent('antcv:reset-content', { detail: { cleared } }));
      // Force reload so React re-reads the cleared storage
      const reload = confirm(
        `Cleared ${cleared.length} content key(s).\n\n` +
        'Reload the page now so the editor re-initialises with template defaults? ' +
        '(Recommended — without reload, in-memory React state will overwrite the cleared storage on next render.)'
      );
      if (reload) location.reload();
    };
    root.appendChild(btn);
  }

  // ─── JD analyze button (🎓) ─────────────────────────────────────
  // Icon is the graduation cap rather than a magnifying glass since
  // the magnifying glass is already used elsewhere in the PWA UI for
  // a different action — the inspector / academic-researcher framing
  // is a better match anyway for what the button actually does
  // (extracts recruiter, questions, red flags from the JD).
  if (CFG.enabled.jdAnalysis !== false) {
    const jb = el('button', 'antcv-fab', '🎓');
    jb.title = 'Analyze JD (recruiter + questions + red flags)';
    jb.setAttribute('aria-label', 'Analyze JD');
    jdAnalyzeFab = jb;
    jb.onclick = () => {
      // Try the captured JD first; fall back to paste prompt
      const captured = getCapturedJD();
      if (captured && captured.text && captured.text.length > 200) {
        runJDAnalysis(captured.text);
      } else {
        showJDPastePrompt();
      }
    };
    root.appendChild(jb);
  }

  // ─── Fusion CL→CV button (🔀) ───────────────────────────────────
  // Triggers the PWA's existing Fusion handler by finding its button
  // in the DOM via the title attribute (which is unique and stable
  // across minified rebuilds — the title text is part of the source
  // code, not a minifiable identifier) and clicking it. This avoids
  // patching the React bundle to expose the handler globally.
  //
  // What Fusion does (per the PWA's own help text): reads the current
  // cover letter and weaves its JD-specific signals (concrete
  // examples, framings) into the CV PROFILE and SELECTED OUTCOMES,
  // so recruiters who only read the CV still get the strongest
  // tailored framing.
  if (CFG.enabled.fusionButton !== false) {
    const fb = el('button', 'antcv-fab', '🔀');
    fb.title = 'Fusion CL→CV (weave cover letter signals into CV)';
    fb.setAttribute('aria-label', 'Fusion CL to CV');
    fusionFab = fb;
    fb.onclick = () => {
      // The PWA's Fusion button has a long, unique title attribute
      // that starts with this fragment. The substring is more robust
      // than a class match (which would break on next minify) or an
      // exact title match (which would break if the help text is
      // edited even slightly).
      const TITLE_FRAGMENT = 'Read the current cover letter and weave';
      const buttons = document.querySelectorAll('button[title]');
      let fusionBtn = null;
      for (const b of buttons) {
        if ((b.getAttribute('title') || '').startsWith(TITLE_FRAGMENT)) {
          fusionBtn = b;
          break;
        }
      }
      if (!fusionBtn) {
        // Fusion button isn't currently mounted in the DOM (the PWA only
        // mounts it when the Analysis tab is active and rationale exists).
        // Try the window-exposed handler instead.
        if (typeof window.AntcvFusion === 'function') {
          // Set busy state on the FAB
          fb.disabled = true;
          fb.textContent = '⏳';
          fb.title = 'Fusion running…';
          Promise.resolve(window.AntcvFusion()).catch(() => {}).finally(() => {
            fb.disabled = false;
            fb.textContent = '🔀';
            fb.title = 'Fusion CL→CV (weave cover letter signals into CV)';
          });
          return;
        }
        alert(
          'Fusion needs a CV and cover letter with content first.\n\n' +
          'Generate both, then try Fusion again.'
        );
        return;
      }
      if (fusionBtn.disabled) {
        alert(
          'Fusion is currently disabled.\n\n' +
          'It needs both a cover letter and a CV with content. Generate ' +
          'both first, then try Fusion.'
        );
        return;
      }
      // Set the FAB to busy state BEFORE clicking — the PWA's
      // fusion handler is async and takes 5-30s. Track completion
      // by watching the PWA's own button: it's `disabled: qn` where
      // qn is the React busy-state flag. When the PWA sets qn=true
      // we know fusion is running; when it transitions back to
      // false, fusion is done (success OR failure — both restore
      // the button). 90s hard cap to guarantee the FAB never gets
      // stuck on hourglass if the PWA's state machine misfires.
      setFabBusy(fb);
      fusionBtn.click();
      const startedAt = Date.now();
      let sawDisabled = false;
      const tick = setInterval(() => {
        const elapsed = Date.now() - startedAt;
        if (fusionBtn.disabled) {
          sawDisabled = true;
        } else if (sawDisabled) {
          // PWA's busy flag has cleared — fusion is done.
          clearInterval(tick);
          setFabIdle(fb);
        } else if (elapsed > 3000) {
          // The PWA never entered its busy state within 3s of our
          // click. Either it failed silently or the click didn't
          // register. Clear the busy state so the FAB isn't stuck
          // on hourglass forever.
          clearInterval(tick);
          setFabIdle(fb);
        }
        if (elapsed > 90000) {
          // Hard timeout — fusion shouldn't take longer than this.
          clearInterval(tick);
          setFabIdle(fb);
        }
      }, 300);
    };
    root.appendChild(fb);
  }

  console.info('[antcv-overlay] loaded; supervisor=' + CFG.enabled.supervisor +
    ' wordWarning=' + CFG.enabled.wordWarning + ' resetButton=' + CFG.enabled.resetButton +
    ' jdAnalysis=' + (CFG.enabled.jdAnalysis !== false) +
    ' fusionButton=' + (CFG.enabled.fusionButton !== false));
})();
