/* AntCV Personality / Work Style sidecar (v1.40.3)
 * ============================================================
 * Adds a "Work style & personality" block to the Personal tab in
 * Settings, and a "Apply to CV's Work Style section" action that
 * pushes the synthesised result into the CV's work_style section.
 *
 * Why this exists as a sidecar (not in app.js)
 * --------------------------------------------
 * The React bundle is minified and the personalInfo skeleton in
 * app.js doesn't declare a workStyle field. The data importer
 * already writes personalInfo.workStyle when a VIA Character
 * Strengths PDF is imported, but there is no UI to inspect, edit,
 * or apply that data — and no way to enter it manually without a
 * VIA PDF. This sidecar fills both gaps without touching the
 * minified bundle.
 *
 * Data model (lives at localStorage.personalInfo.workStyle)
 * ---------------------------------------------------------
 *   keywords         : string[]     // user-entered word-cloud chips
 *   strengths        : string[]     // VIA-style top strengths (chips)
 *   notes            : string       // free-text working-style notes
 *   summary          : string       // synthesised 1-2 sentence sketch
 *                                   // pushed into the CV work_style
 *                                   // section when "Apply" is hit
 *   tonalGuidance    : string       // optional tone hint (from VIA)
 *   appendToCV       : boolean      // default true
 *   source           : 'manual'|'via-pdf'|'synthesized'
 *   lastAppliedAt    : number       // timestamp of last CV write
 *
 * UI
 * --
 *   1) Two chip inputs: keywords + strengths (type, Enter or comma
 *      to add, click ✕ on a chip to remove).
 *   2) A "Working-style notes" textarea.
 *   3) A "Summary that will land in the CV" textarea (auto-composed
 *      on first open, editable, regenerable).
 *   4) Buttons: Compose summary (template-based, local, no LLM),
 *      Apply to CV (writes into sections.cv[work_style].content +
 *      dispatches antcv:sections-updated), Sync from VIA (copies
 *      from the imported VIA payload if one is present).
 *
 * Storage convention
 * ------------------
 * Matches the rest of the PWA: localStorage.setItem(key,
 * JSON.stringify(value)).
 */
(function () {
  'use strict';

  // ─── Storage helpers (PWA convention) ───────────────────────────
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
        // Trigger storage event so other tabs / overlays react. Note:
        // same-tab storage events don't fire natively, but our PWA
        // listens for antcv:sections-updated for the sections key, so
        // we dispatch that explicitly when we write sections.
        window.dispatchEvent(new StorageEvent('storage', { key, newValue: JSON.stringify(value) }));
      } catch (e) { console.error('[personality] set failed', key, e); }
    },
  };

  const DEFAULT_WS = {
    keywords: [],
    strengths: [],
    notes: '',
    summary: '',
    tonalGuidance: '',
    appendToCV: true,
    source: null,
    lastAppliedAt: 0,
  };

  function readWorkStyle() {
    const pi = Store.get('personalInfo', {}) || {};
    return Object.assign({}, DEFAULT_WS, pi.workStyle || {});
  }

  function writeWorkStyle(ws) {
    const pi = Store.get('personalInfo', {}) || {};
    pi.workStyle = ws;
    Store.set('personalInfo', pi);
  }

  // ─── Summary synthesis ───────────────────────────────────────────
  // Local template-based composer. The user can edit the result
  // freely afterwards, or hit ✨ Enrich on the work_style section in
  // the editor to send it through the LLM.
  function composeSummary(ws) {
    const kws = (ws.keywords || []).filter(s => s && String(s).trim()).slice(0, 5);
    const sts = (ws.strengths || []).filter(s => s && String(s).trim()).slice(0, 4);
    const notes = String(ws.notes || '').trim();

    const parts = [];
    if (kws.length) {
      const list = kws.length === 1 ? kws[0]
                 : kws.length === 2 ? kws.join(' and ')
                 : kws.slice(0, -1).join(', ') + ', and ' + kws[kws.length - 1];
      parts.push(capitalize(list) + ' in approach.');
    }
    if (notes) {
      // Append the user's notes verbatim — they've written it for the CV.
      parts.push(notes.endsWith('.') ? notes : notes + '.');
    }
    if (sts.length) {
      const list = sts.length === 1 ? sts[0]
                 : sts.length === 2 ? sts.join(' and ')
                 : sts.slice(0, -1).join(', ') + ', and ' + sts[sts.length - 1];
      parts.push('Top strengths: ' + list + '.');
    }
    return parts.join(' ').trim();
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  // ─── Sections write ──────────────────────────────────────────────
  // The PWA stores sections under either `sections` (post v1.30) or
  // `cv_pwa_sections` (legacy). Write to both keys to be safe, then
  // dispatch antcv:sections-updated which the React app listens for.
  function applyToCV(ws) {
    const summary = (ws.summary || composeSummary(ws)).trim();
    if (!summary) return { ok: false, error: 'No summary to apply. Add keywords, strengths, or notes first.' };

    let wrote = false;
    for (const k of ['sections', 'cv_pwa_sections']) {
      const cur = Store.get(k, null);
      if (!cur || !cur.cv) continue;
      const idx = cur.cv.findIndex(s => s && s.id === 'work_style');
      if (idx < 0) continue;
      const next = Object.assign({}, cur);
      next.cv = cur.cv.map((s, i) => i === idx
        ? Object.assign({}, s, { content: summary, on: true })
        : s);
      Store.set(k, next);
      wrote = true;
    }
    if (!wrote) return { ok: false, error: 'No work_style section found. Generate a CV first, then re-apply.' };

    // Tell the React layer to re-hydrate from sections immediately.
    window.dispatchEvent(new CustomEvent('antcv:sections-updated', {
      detail: { source: 'personality-sidecar', target: 'work_style' },
    }));

    ws.lastAppliedAt = Date.now();
    writeWorkStyle(ws);
    return { ok: true };
  }

  // ─── VIA sync ────────────────────────────────────────────────────
  // The data importer writes personalInfo.workStyle = { strengths,
  // virtues, summary, tonalGuidance, source } when a VIA PDF is
  // accepted. This copies those fields into the sidecar's view
  // without clobbering the user's own keywords/notes.
  function syncFromVIA() {
    const pi = Store.get('personalInfo', {}) || {};
    const imported = pi.workStyle || {};
    const current  = readWorkStyle();
    let changed = false;

    if (Array.isArray(imported.strengths) && imported.strengths.length) {
      // Importer stores strengths as [{name, rank, score}, ...] —
      // normalise to plain string names.
      const names = imported.strengths
        .map(s => typeof s === 'string' ? s : (s && s.name))
        .filter(Boolean)
        .slice(0, 8);
      if (names.length && JSON.stringify(names) !== JSON.stringify(current.strengths)) {
        current.strengths = names;
        changed = true;
      }
    }
    if (imported.summary && !current.summary) {
      current.summary = imported.summary;
      changed = true;
    }
    if (imported.tonalGuidance && imported.tonalGuidance !== current.tonalGuidance) {
      current.tonalGuidance = imported.tonalGuidance;
      changed = true;
    }
    if (changed) {
      current.source = 'via-pdf';
      writeWorkStyle(current);
    }
    return { ok: true, changed };
  }

  // ─── UI: scoped CSS ──────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    .antcv-ws-block {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px dashed rgba(255, 255, 255, 0.12);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .antcv-ws-block h4 {
      margin: 0 0 4px 0;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.4px;
      text-transform: uppercase;
      color: #01B7BB;
    }
    .antcv-ws-block .antcv-ws-desc {
      font-size: 11px;
      line-height: 1.5;
      color: rgba(255, 255, 255, 0.55);
      margin-bottom: 12px;
    }
    .antcv-ws-row { margin-bottom: 10px; }
    .antcv-ws-label {
      display: block;
      font-size: 10px;
      color: rgba(255, 255, 255, 0.55);
      margin-bottom: 4px;
      font-weight: 600;
      letter-spacing: 0.3px;
    }
    .antcv-ws-chip-wrap {
      display: flex; flex-wrap: wrap; gap: 4px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      min-height: 32px;
    }
    .antcv-ws-chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 2px 8px;
      background: rgba(1, 183, 187, 0.18);
      border: 1px solid rgba(1, 183, 187, 0.45);
      border-radius: 12px;
      color: #fff;
      font-size: 11px;
      line-height: 1.4;
    }
    .antcv-ws-chip-x {
      cursor: pointer;
      color: rgba(255, 255, 255, 0.7);
      font-size: 10px;
      padding: 0 2px;
    }
    .antcv-ws-chip-x:hover { color: #ffb4b4; }
    .antcv-ws-chip-input {
      flex: 1;
      min-width: 80px;
      background: transparent;
      border: none;
      outline: none;
      color: #fff;
      font-size: 12px;
      font-family: inherit;
      padding: 2px 4px;
    }
    .antcv-ws-textarea {
      width: 100%;
      box-sizing: border-box;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 6px;
      color: #fff;
      font-size: 12px;
      font-family: inherit;
      padding: 7px 10px;
      resize: vertical;
      min-height: 56px;
    }
    .antcv-ws-toggle {
      display: flex; align-items: center; gap: 8px;
      cursor: pointer;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.7);
      margin: 4px 0 8px;
    }
    .antcv-ws-toggle input { accent-color: #01B7BB; }
    .antcv-ws-actions {
      display: flex; gap: 6px; flex-wrap: wrap;
      margin-top: 6px;
    }
    .antcv-ws-btn {
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      background: rgba(1, 183, 187, 0.12);
      border: 1px solid rgba(1, 183, 187, 0.6);
      color: #01B7BB;
    }
    .antcv-ws-btn:hover { background: rgba(1, 183, 187, 0.2); }
    .antcv-ws-btn.secondary {
      background: rgba(255, 255, 255, 0.06);
      border-color: rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.75);
    }
    .antcv-ws-btn.primary {
      background: #01B7BB;
      color: #fff;
      border-color: #01B7BB;
    }
    .antcv-ws-btn.primary:hover { background: #00a3a6; }
    .antcv-ws-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .antcv-ws-status {
      font-size: 10px;
      color: rgba(126, 255, 212, 0.85);
      margin-top: 6px;
      min-height: 12px;
    }
    .antcv-ws-status.err { color: #ffb4b4; }
  `;
  document.head.appendChild(style);

  // ─── UI: chip input ──────────────────────────────────────────────
  function buildChipInput(initial, placeholder, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'antcv-ws-chip-wrap';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'antcv-ws-chip-input';
    input.placeholder = placeholder;

    let chips = Array.isArray(initial) ? initial.slice() : [];

    function renderChips() {
      // Remove old chip nodes (keep input)
      Array.from(wrap.querySelectorAll('.antcv-ws-chip')).forEach(n => n.remove());
      chips.forEach((c, i) => {
        const chip = document.createElement('span');
        chip.className = 'antcv-ws-chip';
        const text = document.createElement('span');
        text.textContent = c;
        const x = document.createElement('span');
        x.className = 'antcv-ws-chip-x';
        x.textContent = '✕';
        x.title = 'Remove';
        x.addEventListener('click', () => {
          chips.splice(i, 1);
          renderChips();
          onChange(chips.slice());
        });
        chip.appendChild(text);
        chip.appendChild(x);
        wrap.insertBefore(chip, input);
      });
    }

    function commit() {
      const v = input.value.trim().replace(/,$/, '').trim();
      if (!v) { input.value = ''; return; }
      if (!chips.includes(v)) {
        chips.push(v);
        onChange(chips.slice());
      }
      input.value = '';
      renderChips();
    }

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Backspace' && !input.value && chips.length) {
        chips.pop();
        renderChips();
        onChange(chips.slice());
      }
    });
    input.addEventListener('blur', commit);

    wrap.appendChild(input);
    renderChips();

    wrap.addEventListener('click', (e) => {
      if (e.target === wrap) input.focus();
    });

    return {
      el: wrap,
      setValue(arr) {
        chips = Array.isArray(arr) ? arr.slice() : [];
        renderChips();
      },
      getValue() { return chips.slice(); },
    };
  }

  // ─── UI: main block ──────────────────────────────────────────────
  function buildBlock() {
    const ws = readWorkStyle();

    const root = document.createElement('details');
    root.className = 'antcv-ws-block';
    root.dataset.antcvPersonalityBlock = '1';
    // closed by default — keeps Personal tab compact

    const summary = document.createElement('summary');
    summary.className = 'antcv-ws-summary';
    summary.style.cssText = 'cursor:pointer;user-select:none;color:rgba(255,255,255,0.5);font-size:9px;letter-spacing:0.8px;margin-bottom:4px;text-transform:uppercase;font-weight:600';
    summary.textContent = 'Work style & personality';
    root.appendChild(summary);

    const desc = document.createElement('div');
    desc.className = 'antcv-ws-desc';
    desc.innerHTML = "Words and strengths that describe how you operate. Used to populate the CV's <b>Work Style</b> section and to inform LLM prompts. A VIA character-strengths PDF imported through the importer fills the Strengths chips automatically.";
    root.appendChild(desc);

    // Keywords row
    const kwRow = document.createElement('div');
    kwRow.className = 'antcv-ws-row';
    const kwLabel = document.createElement('label');
    kwLabel.className = 'antcv-ws-label';
    kwLabel.textContent = 'Keywords (how you work — type a word, press Enter)';
    kwRow.appendChild(kwLabel);
    const kwChips = buildChipInput(ws.keywords, 'e.g. methodical, evidence-driven, calm under pressure',
      (next) => { const w = readWorkStyle(); w.keywords = next; w.source = w.source || 'manual'; writeWorkStyle(w); });
    kwRow.appendChild(kwChips.el);
    root.appendChild(kwRow);

    // Strengths row
    const stRow = document.createElement('div');
    stRow.className = 'antcv-ws-row';
    const stLabel = document.createElement('label');
    stLabel.className = 'antcv-ws-label';
    stLabel.textContent = 'Strengths (top 3–6 — auto-filled by VIA import, or type your own)';
    stRow.appendChild(stLabel);
    const stChips = buildChipInput(ws.strengths, 'e.g. Judgement, Perseverance, Curiosity',
      (next) => { const w = readWorkStyle(); w.strengths = next; w.source = w.source || 'manual'; writeWorkStyle(w); });
    stRow.appendChild(stChips.el);
    root.appendChild(stRow);

    // Notes row
    const ntRow = document.createElement('div');
    ntRow.className = 'antcv-ws-row';
    const ntLabel = document.createElement('label');
    ntLabel.className = 'antcv-ws-label';
    ntLabel.textContent = 'Working-style notes (1–3 sentences in your own words)';
    ntRow.appendChild(ntLabel);
    const ntArea = document.createElement('textarea');
    ntArea.className = 'antcv-ws-textarea';
    ntArea.rows = 2;
    ntArea.placeholder = 'e.g. Prefers writing decisions down and circulating them. Comfortable disagreeing in writing.';
    ntArea.value = ws.notes || '';
    ntArea.addEventListener('input', () => {
      const w = readWorkStyle();
      w.notes = ntArea.value;
      w.source = w.source || 'manual';
      writeWorkStyle(w);
    });
    ntRow.appendChild(ntArea);
    root.appendChild(ntRow);

    // Summary row (what the CV gets)
    const smRow = document.createElement('div');
    smRow.className = 'antcv-ws-row';
    const smLabel = document.createElement('label');
    smLabel.className = 'antcv-ws-label';
    smLabel.textContent = 'Summary that lands in the CV (edit freely)';
    smRow.appendChild(smLabel);
    const smArea = document.createElement('textarea');
    smArea.className = 'antcv-ws-textarea';
    smArea.rows = 3;
    smArea.placeholder = 'Click Compose to draft from the chips and notes above, then refine here.';
    smArea.value = ws.summary || '';
    smArea.addEventListener('input', () => {
      const w = readWorkStyle();
      w.summary = smArea.value;
      writeWorkStyle(w);
    });
    smRow.appendChild(smArea);
    root.appendChild(smRow);

    // Toggle: append on generate (kept for forward use — the
    // sections-updated event fires only on explicit Apply right now,
    // but generate hooks can read this flag.)
    const toggle = document.createElement('label');
    toggle.className = 'antcv-ws-toggle';
    const tcb = document.createElement('input');
    tcb.type = 'checkbox';
    tcb.checked = ws.appendToCV !== false;
    tcb.addEventListener('change', () => {
      const w = readWorkStyle();
      w.appendToCV = tcb.checked;
      writeWorkStyle(w);
    });
    toggle.appendChild(tcb);
    toggle.appendChild(document.createTextNode('Append to the CV Work Style section when I click Apply'));
    root.appendChild(toggle);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'antcv-ws-actions';

    const composeBtn = document.createElement('button');
    composeBtn.type = 'button';
    composeBtn.className = 'antcv-ws-btn secondary';
    composeBtn.textContent = '📝 Compose summary';
    composeBtn.title = 'Build a draft summary from your keywords, strengths, and notes (local, no LLM).';
    composeBtn.addEventListener('click', () => {
      const w = readWorkStyle();
      const draft = composeSummary(w);
      if (!draft) { setStatus('Add keywords, strengths, or notes first.', true); return; }
      w.summary = draft;
      w.source = w.source === 'via-pdf' ? 'via-pdf' : 'synthesized';
      writeWorkStyle(w);
      smArea.value = draft;
      setStatus('Composed. Edit above, then hit Apply.', false);
    });
    actions.appendChild(composeBtn);

    // v1.40.30: "Sync from VIA import" and "Apply to CV" buttons removed.
    // Apply is now folded into the Personal tab's top "Apply to user profile"
    // button (it calls window.AntcvPersonality.applyToCV when the
    // "Append to the CV Work Style section" checkbox is on). VIA sync runs
    // automatically when a VIA PDF is imported via the QUICK START flow.

    root.appendChild(actions);

    const status = document.createElement('div');
    status.className = 'antcv-ws-status';
    root.appendChild(status);

    function setStatus(msg, isError) {
      status.textContent = msg;
      status.classList.toggle('err', !!isError);
      if (msg && !isError) setTimeout(() => { if (status.textContent === msg) status.textContent = ''; }, 4000);
    }

    return root;
  }

  // ─── Inject into Personal tab ────────────────────────────────────
  // The Personal tab is rendered by React component `yl` whose root
  // shows a descriptive paragraph that starts with "Your name,
  // contact details, work history, education, and skills.". We use
  // that string as our anchor — find its container in the open
  // Settings dialog and append our block after the rendered fields.
  const ANCHOR_TEXT = /Your name, contact details, work history/i;

  function findPersonalPanel() {
    // Settings dialog has been opened iff Personal copy text is in
    // the DOM. Walk for the smallest containing div.
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const t = (node.textContent || '').trim();
        if (t && ANCHOR_TEXT.test(t)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_SKIP;
      },
    });
    const tNode = walker.nextNode();
    if (!tNode) return null;
    // Walk up to find the surrounding panel (the closest DIV that
    // contains the personal-info form). The React panel is `yl`,
    // structured as a wrapper div containing a description div then
    // the form fields. Anchor's parent is the description div; the
    // panel is the grandparent.
    const desc = tNode.parentElement;
    if (!desc) return null;
    return desc.parentElement || desc;
  }

  function injectBlock() {
    const panel = findPersonalPanel();
    if (!panel) return false;
    // Already injected and still in DOM?
    if (panel.querySelector('[data-antcv-personality-block="1"]')) return true;
    // It's possible an old block is detached if React re-rendered;
    // remove any stale ones first.
    Array.from(document.querySelectorAll('[data-antcv-personality-block="1"]')).forEach(n => {
      if (!n.isConnected || !panel.contains(n)) n.remove();
    });
    panel.appendChild(buildBlock());
    return true;
  }

  let mutObserver = null;
  function startObserver() {
    injectBlock();
    if (mutObserver) return;
    mutObserver = new MutationObserver(() => {
      if (startObserver._pending) return;
      startObserver._pending = true;
      requestAnimationFrame(() => {
        startObserver._pending = false;
        injectBlock();
      });
    });
    mutObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }

  // v1.40.9 — robust re-mount on data updates. The earlier version
  // could miss because (a) the Personal panel wasn't open when the
  // listener fired, (b) injectBlock's already-injected guard could
  // skip when an old block was still detached in DOM, or (c) buildBlock
  // read workStyle before the importer's Store.set had committed.
  //
  // This version:
  //   - logs what readWorkStyle returns so the failure mode is visible
  //   - removes EVERY existing block, not just one
  //   - forces a rebuild via direct buildBlock call (bypassing the
  //     already-injected guard)
  //   - retries on the next animation frame in case the panel mounts
  //     just after the event fires
  //   - listens for storage events too (cross-tab safety)
  //   - exposes refresh() on the public API for manual recovery
  let _lastBlockSig = null;
  function blockSig(ws) {
    return [
      (ws.keywords || []).join(''),
      (ws.strengths || []).join(''),
      ws.notes || '',
      ws.summary || '',
    ].join('');
  }
  function forceRebuild(reason) {
    try {
      const ws = readWorkStyle();
      // v1.40.296-loopgate — idempotency gate. forceRebuild runs on every
      // antcv:sections-updated; its remove+append of the block is a DOM
      // mutation that wakes the whole sidecar herd, one of which re-emits
      // sections-updated → a ~12/sec re-render loop (HIWC-RERENDER-LOOP-001).
      // When the block data is unchanged AND a single block is already
      // present + connected in the current panel, skip the rebuild entirely:
      // it would produce identical DOM, so this is behaviour-preserving and
      // it removes the per-cycle mutation that pumps the loop.
      const sig = blockSig(ws);
      const existing = Array.from(document.querySelectorAll('[data-antcv-personality-block="1"]'));
      if (sig === _lastBlockSig && existing.length === 1 && existing[0].isConnected) {
        const p = findPersonalPanel();
        if (p && p.contains(existing[0])) return true;
      }
      console.info('[antcv-personality] forceRebuild', reason, {
        kw: (ws.keywords || []).length,
        st: (ws.strengths || []).length,
        notes: (ws.notes || '').length,
        summary: (ws.summary || '').length,
      });
      existing.forEach(n => { if (n.parentElement) n.parentElement.removeChild(n); });
      _lastBlockSig = sig;
      const panel = findPersonalPanel();
      if (!panel) {
        // Panel not visible right now — next MutationObserver tick will
        // catch it when the user opens Settings → Personal.
        return false;
      }
      panel.appendChild(buildBlock());
      return true;
    } catch (e) {
      console.warn('[antcv-personality] forceRebuild failed:', e);
      return false;
    }
  }

  // v1.40.296 — Coalesce rapid-fire rebuilds and skip when the
  // workStyle sub-object hasn't actually changed.
  //
  // Background: every Store.set('personalInfo', ...) dispatches a
  // synthetic StorageEvent with key='personalInfo' (see Store.set
  // above), and any external write that goes through a wrapped
  // setItem (e.g. antcv-shape-guard for the bundle's u.set calls)
  // can trigger the same listener path. During a translation the
  // bundle writes meta repeatedly (name, role, subtitle, company)
  // and each write fires the listener — but workStyle (keywords,
  // strengths, notes, summary) is never the value being mutated
  // by translation. The old behaviour rebuilt the panel for every
  // write, producing the "9× forceRebuild storage:personalInfo"
  // burst Gabriel saw. Now we hash the workStyle sub-object and
  // only rebuild if the hash actually changed.
  //
  // We also coalesce all triggers (storage + sections-updated)
  // through a single requestAnimationFrame so two triggers in the
  // same tick collapse into one rebuild.
  let _lastWorkStyleHash = null;
  function workStyleHash(ws) {
    if (!ws) return '';
    // Stable shape: order matters so we can string-compare.
    return [
      (ws.keywords  || []).join('|'),
      (ws.strengths || []).join('|'),
      String(ws.notes   || ''),
      String(ws.summary || ''),
    ].join('||');
  }
  // Initialise the cache so the very first storage event fires a
  // rebuild only if there's actually a change vs the boot state.
  try { _lastWorkStyleHash = workStyleHash(readWorkStyle()); } catch (_) { _lastWorkStyleHash = null; }

  let _rebuildScheduled = false;
  let _pendingReason = '';
  function maybeForceRebuild(reason) {
    // Cheap pre-check: skip if workStyle subfields haven't changed.
    let h;
    try { h = workStyleHash(readWorkStyle()); } catch (_) { h = null; }
    if (h !== null && h === _lastWorkStyleHash) {
      // The triggering write was for some other personalInfo field
      // (meta from translation, identity restored from cloud, etc.).
      // The personality panel reflects only the workStyle sub-object,
      // so there is nothing to rebuild here.
      return;
    }
    _lastWorkStyleHash = h;
    _pendingReason = reason;
    if (_rebuildScheduled) return;
    _rebuildScheduled = true;
    requestAnimationFrame(() => {
      _rebuildScheduled = false;
      forceRebuild(_pendingReason);
      _pendingReason = '';
    });
  }

  window.addEventListener('antcv:sections-updated', (ev) => {
    // sections-updated implies workStyle MAY have changed via the
    // applyToCV path. Bypass the hash gate here because applyToCV
    // both writes workStyle AND emits this event in sequence —
    // by the time the rAF fires the hash already matches and the
    // gate would skip the rebuild. Use the legacy direct path.
    maybeForceRebuildBypassHash('antcv:sections-updated ' + ((ev && ev.detail && ev.detail.source) || ''));
  });

  function maybeForceRebuildBypassHash(reason) {
    try { _lastWorkStyleHash = workStyleHash(readWorkStyle()); } catch (_) {}
    _pendingReason = reason;
    if (_rebuildScheduled) return;
    _rebuildScheduled = true;
    requestAnimationFrame(() => {
      _rebuildScheduled = false;
      forceRebuild(_pendingReason);
      _pendingReason = '';
    });
  }

  window.addEventListener('storage', (ev) => {
    if (ev && ev.key === 'personalInfo') {
      maybeForceRebuild('storage:personalInfo');
    }
  });

  // ─── Public API ──────────────────────────────────────────────────
  window.AntcvPersonality = {
    read:        readWorkStyle,
    write:       writeWorkStyle,
    compose:     composeSummary,
    applyToCV:   () => applyToCV(readWorkStyle()),
    syncFromVIA: syncFromVIA,
    refresh:     () => forceRebuild('manual'),
  };
})();
