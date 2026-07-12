/**
 * antcv-bullet-targets.js — per-bullet line-target picker (SHIP 1)
 *
 * Background
 * ──────────
 * app.js's compress and enrich prompts already include DIMENSION-AWARE
 * BULLET LENGTH instructions: each bullet must land in exactly one of
 * three "buckets" (1-line / 2-line / 3-line), and the LLM picks the
 * bucket per bullet based on content.
 *
 * Sometimes you want to override that — e.g. "bullet 3 of role X must
 * always be 1-line"; "bullet 1 of role Y should expand to 2-line". This
 * sidecar lets you set a per-bullet target on the section panel.
 *
 * SHIP 1 (this file) — UI + storage only
 *
 *   Renders a small strip of pill buttons below each bullet textarea
 *   in the section panel (one button per bullet line). Each button
 *   cycles through targets:
 *
 *       A  → 1L → 2L → 3L → A
 *
 *   Selected targets are stored in localStorage under the key
 *   `antcv:bullet-targets` with a structured shape (see STORAGE below).
 *
 * SHIP 2 (not in this file) — wires the targets to the compress and
 * enrich prompts. The cv-proxy will accept a `bullet_targets` field
 * alongside the existing payload and inject "this bullet MUST be N
 * lines" instructions into the system prompt.
 *
 * Storage shape
 * ─────────────
 *   localStorage["antcv:bullet-targets"] = JSON.stringify({
 *     [sectionId]: {
 *       [roleIdxInSection]: {  // "_" if not an experience-role bullet
 *         [bulletIdx]: "1L" | "2L" | "3L"
 *       }
 *     }
 *   })
 *
 *   - sectionId comes from the section panel row's React-side
 *     `data-section-row-index` mapped through `cv_pwa_sections`. We
 *     don't use the panel-row index directly because row order changes
 *     when sections are reordered.
 *   - roleIdxInSection is the position of the role textarea among all
 *     bullet textareas inside the section row, 0-indexed.
 *   - bulletIdx is the position within the role's bullets, 0-indexed.
 *   - "auto" target = key absent (not "auto" string), to keep storage
 *     compact.
 *
 * Why this design
 * ───────────────
 *   - sectionId is stable across reordering and re-renders.
 *   - role index works because app.js's role IDs (r1, r2, ...) live in
 *     React state and aren't on the DOM. The role's POSITION inside
 *     the section IS stable as long as the user doesn't reorder roles
 *     between sessions (and SHIP 2 will resolve position → role.id by
 *     reading cv_pwa_sections at prompt-build time).
 *   - bulletIdx maps directly to a line in the textarea.
 *
 * Boundary in SHIP 1
 * ──────────────────
 *   - Experience-role bullets only (`textarea[placeholder="Bullets
 *     (one per line)"]`). Text_bullets and bullets section types
 *     have different editors and will land in a SHIP 1 follow-up.
 *   - No prompt integration yet — the buttons are UI-only.
 */

(function () {
  'use strict';

  const SCRIPT_VERSION = '1.51.375';
  const STORAGE_KEY = 'antcv:bullet-targets';
  const STYLE_ID = 'antcv-bullet-targets-styles';
  const STRIP_MARKER = 'data-antcv-bullet-target-strip';
  const TEXTAREA_MARKER = 'data-antcv-bullet-target-hooked';

  const TARGETS = ['1L', '2L', '3L']; // empty / absent = auto
  const NEXT_AFTER = { '': '1L', '1L': '2L', '2L': '3L', '3L': '' };
  const SECTION_ROW_SELECTOR = '[data-section-row-index]';
  const BULLET_TEXTAREA_SELECTOR =
    'textarea[placeholder="Bullets (one per line)"]';

  // ─── Storage helpers ──────────────────────────────────────────────

  function readStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function writeStore(obj) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    } catch (e) {
      console.warn('[antcv-bullet-targets] storage write failed:', e);
    }
  }

  function getTarget(sectionId, roleKey, bulletIdx) {
    const store = readStore();
    const byRole = store[sectionId];
    if (!byRole) return '';
    const byBullet = byRole[roleKey];
    if (!byBullet) return '';
    const val = byBullet[String(bulletIdx)];
    if (val && TARGETS.indexOf(val) >= 0) return val;
    return '';
  }

  function setTarget(sectionId, roleKey, bulletIdx, value) {
    const store = readStore();
    if (!store[sectionId]) store[sectionId] = {};
    if (!store[sectionId][roleKey]) store[sectionId][roleKey] = {};
    const slot = store[sectionId][roleKey];
    const k = String(bulletIdx);
    if (!value || TARGETS.indexOf(value) < 0) {
      delete slot[k];
    } else {
      slot[k] = value;
    }
    // Compact empties up the tree.
    if (Object.keys(slot).length === 0) delete store[sectionId][roleKey];
    if (Object.keys(store[sectionId]).length === 0) delete store[sectionId];
    writeStore(store);
  }

  // Drop targets for bullet indices that no longer exist (i.e. the
  // user removed lines). Called after re-rendering.
  function pruneTargets(sectionId, roleKey, currentCount) {
    const store = readStore();
    const slot = store[sectionId] && store[sectionId][roleKey];
    if (!slot) return;
    let changed = false;
    for (const k of Object.keys(slot)) {
      if (Number(k) >= currentCount) {
        delete slot[k];
        changed = true;
      }
    }
    if (changed) {
      if (Object.keys(slot).length === 0) delete store[sectionId][roleKey];
      if (Object.keys(store[sectionId] || {}).length === 0) delete store[sectionId];
      writeStore(store);
    }
  }

  // ─── Section / role identification ────────────────────────────────
  //
  // Walks up from the textarea to find the section row, then maps the
  // section-panel index to a stable section ID via `cv_pwa_sections`.
  // The role index is computed as the position of this textarea among
  // all bullet textareas inside the section row.
  //
  // We try multiple localStorage keys for section data because app.js
  // has used different keys across versions (`sections`, `antcv:sections`,
  // `cv_pwa_sections`). The first match wins.

  function readSectionsLs() {
    const keys = ['cv_pwa_sections', 'sections', 'antcv:sections'];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && (Array.isArray(parsed.cv) || Array.isArray(parsed.cl))) {
          return parsed;
        }
      } catch (_) {}
    }
    return null;
  }

  // Read the current section "panel" (CV vs CL) by inspecting the
  // document. The first sidebar row in the panel matches a section
  // title in one of the docs.
  function detectActiveDoc() {
    const all = readSectionsLs();
    if (!all) return 'cv';
    // Find the first section row in the panel and read its title.
    const firstRow = document.querySelector(
      SECTION_ROW_SELECTOR + '[data-section-row-loc="sidebar"]'
    );
    if (!firstRow) return 'cv';
    const titleEl = firstRow.querySelector('div');
    const title = (titleEl && titleEl.textContent || '').trim().toLowerCase();
    if (!title) return 'cv';
    for (const doc of ['cv', 'cl']) {
      const sections = all[doc] || [];
      for (const s of sections) {
        const sTitle = (s && s.title || '').trim().toLowerCase();
        if (sTitle && title.startsWith(sTitle.slice(0, 6))) {
          return doc;
        }
      }
    }
    return 'cv';
  }

  function resolveSectionId(sectionRow) {
    if (!sectionRow) return null;
    const idxAttr = sectionRow.getAttribute('data-section-row-index');
    const idx = Number(idxAttr);
    if (!Number.isFinite(idx)) return null;
    const loc = sectionRow.getAttribute('data-section-row-loc') || 'main';
    const all = readSectionsLs();
    if (!all) return null;
    const doc = detectActiveDoc();
    const sections = all[doc] || [];
    // Count rows in the same loc to map index correctly. Section rows
    // are rendered per-loc with their own index space.
    const inLoc = sections.filter(s => s && s.loc === loc);
    const section = inLoc[idx];
    return section && section.id ? section.id : null;
  }

  // Identify the role textarea's position among bullet textareas
  // inside its section row.
  function roleIndexInSection(textarea, sectionRow) {
    if (!sectionRow) return 0;
    const allBullets = sectionRow.querySelectorAll(BULLET_TEXTAREA_SELECTOR);
    for (let i = 0; i < allBullets.length; i++) {
      if (allBullets[i] === textarea) return i;
    }
    return 0;
  }

  // ─── Styles ───────────────────────────────────────────────────────

  function injectStylesOnce() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      [${STRIP_MARKER}] {
        display: flex;
        flex-wrap: wrap;
        gap: 3px;
        margin: 3px 0 6px 0;
        padding: 0;
        align-items: center;
      }
      [${STRIP_MARKER}] .antcv-bt-label {
        font-size: 9px;
        color: #888;
        margin-right: 3px;
        font-weight: 600;
        letter-spacing: 0.3px;
        text-transform: uppercase;
      }
      [${STRIP_MARKER}] button.antcv-bt-pill {
        font-size: 9px;
        font-weight: 700;
        padding: 1px 5px;
        height: 18px;
        min-width: 22px;
        line-height: 1;
        border-radius: 3px;
        border: 1px solid #01B7BB;
        background: rgba(1,183,187,0.06);
        color: #01B7BB;
        cursor: pointer;
        font-family: Calibri, Arial, sans-serif;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 2px;
        transition: background-color 0.12s, color 0.12s;
      }
      [${STRIP_MARKER}] button.antcv-bt-pill:hover {
        background: rgba(1,183,187,0.18);
      }
      [${STRIP_MARKER}] button.antcv-bt-pill.antcv-bt-active {
        background: #01B7BB;
        color: #fff;
      }
      [${STRIP_MARKER}] button.antcv-bt-pill.antcv-bt-empty {
        background: transparent;
        color: #999;
        border-color: #ccc;
      }
      [${STRIP_MARKER}] .antcv-bt-num {
        font-size: 8px;
        opacity: 0.7;
        font-weight: 500;
      }
      @media print {
        [${STRIP_MARKER}] { display: none !important; }
      }
    `;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ─── Strip rendering ──────────────────────────────────────────────

  // Count the number of bullets in the textarea content. Lines that
  // are entirely whitespace still count — they're real slots that may
  // get filled. Trailing single-newline doesn't count (split returns
  // an empty trailing element).
  function countBullets(textarea) {
    const v = String(textarea.value || '');
    if (!v) return 0;
    const lines = v.split('\n');
    // Strip a single trailing empty line (cursor at end after newline).
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return Math.max(1, lines.length); // at least 1 slot if there's any content
  }

  function buildPill(sectionId, roleKey, bulletIdx) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'antcv-bt-pill';
    btn.setAttribute('data-antcv-bt-bullet', String(bulletIdx));
    const current = getTarget(sectionId, roleKey, bulletIdx);
    refreshPill(btn, current, bulletIdx);
    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const cur = getTarget(sectionId, roleKey, bulletIdx);
      const next = NEXT_AFTER[cur] || '';
      setTarget(sectionId, roleKey, bulletIdx, next);
      refreshPill(btn, next, bulletIdx);
    });
    return btn;
  }

  function refreshPill(btn, target, bulletIdx) {
    const num = String(bulletIdx + 1);
    btn.textContent = '';
    const numSpan = document.createElement('span');
    numSpan.className = 'antcv-bt-num';
    numSpan.textContent = num;
    btn.appendChild(numSpan);
    const labelSpan = document.createElement('span');
    labelSpan.textContent = target || 'A';
    btn.appendChild(labelSpan);
    btn.classList.toggle('antcv-bt-active', !!target);
    btn.classList.toggle('antcv-bt-empty', !target);
    btn.title = target
      ? `Bullet ${num}: locked to ${target.replace('L', '-line')}. Click to cycle.`
      : `Bullet ${num}: auto target (LLM picks bucket). Click to lock 1-line.`;
  }

  function buildStrip(textarea) {
    const sectionRow = textarea.closest(SECTION_ROW_SELECTOR);
    if (!sectionRow) return null;
    const sectionId = resolveSectionId(sectionRow);
    if (!sectionId) return null;
    const roleIdx = roleIndexInSection(textarea, sectionRow);
    const roleKey = String(roleIdx);

    const strip = document.createElement('div');
    strip.setAttribute(STRIP_MARKER, '1');
    strip.setAttribute('data-antcv-bt-section', sectionId);
    strip.setAttribute('data-antcv-bt-role', roleKey);

    const label = document.createElement('span');
    label.className = 'antcv-bt-label';
    label.textContent = 'Line target:';
    strip.appendChild(label);

    const count = countBullets(textarea);
    for (let i = 0; i < count; i++) {
      strip.appendChild(buildPill(sectionId, roleKey, i));
    }
    pruneTargets(sectionId, roleKey, count);
    return strip;
  }

  function refreshStripContent(strip, textarea) {
    if (!strip) return;
    const sectionId = strip.getAttribute('data-antcv-bt-section');
    const roleKey = strip.getAttribute('data-antcv-bt-role');
    if (!sectionId || roleKey === null) return;
    const count = countBullets(textarea);
    // Remove existing pills (keep the label as first child).
    const pills = strip.querySelectorAll('button.antcv-bt-pill');
    for (let i = 0; i < pills.length; i++) {
      pills[i].parentNode.removeChild(pills[i]);
    }
    for (let i = 0; i < count; i++) {
      strip.appendChild(buildPill(sectionId, roleKey, i));
    }
    pruneTargets(sectionId, roleKey, count);
  }

  // ─── Textarea hookup ──────────────────────────────────────────────

  function hookTextarea(textarea) {
    if (!textarea) return;
    if (textarea.getAttribute(TEXTAREA_MARKER) === '1') return;
    // Only hook if a section row containing it is identifiable.
    const sectionRow = textarea.closest(SECTION_ROW_SELECTOR);
    if (!sectionRow) return;
    textarea.setAttribute(TEXTAREA_MARKER, '1');

    let strip = buildStrip(textarea);
    if (!strip) {
      // Couldn't resolve section ID — don't attach but allow retry on
      // next mutation cycle.
      textarea.removeAttribute(TEXTAREA_MARKER);
      return;
    }
    textarea.parentNode.insertBefore(strip, textarea.nextSibling);

    // Update strip when textarea content changes (lines added/removed).
    const onInput = () => {
      const current = textarea.nextElementSibling;
      if (current && current.getAttribute(STRIP_MARKER) === '1') {
        refreshStripContent(current, textarea);
      }
    };
    textarea.addEventListener('input', onInput);
    textarea.addEventListener('change', onInput);

    // Store the listener so we can detach if React replaces the
    // textarea (we'll just let GC clean up when the node leaves DOM).
  }

  function scanAndHook() {
    try {
      const textareas = document.querySelectorAll(BULLET_TEXTAREA_SELECTOR);
      for (let i = 0; i < textareas.length; i++) {
        hookTextarea(textareas[i]);
      }
      // Clean up orphan strips (sibling textarea removed by React).
      const orphanStrips = document.querySelectorAll(
        '[' + STRIP_MARKER + '="1"]'
      );
      for (let i = 0; i < orphanStrips.length; i++) {
        const strip = orphanStrips[i];
        const prev = strip.previousElementSibling;
        if (!prev || prev.tagName !== 'TEXTAREA') {
          strip.parentNode && strip.parentNode.removeChild(strip);
        }
      }
    } catch (e) {
      console.warn('[antcv-bullet-targets] scan failed:', e);
    }
  }

  // ─── Boot ─────────────────────────────────────────────────────────

  function init() {
    injectStylesOnce();
    scanAndHook();
    // React remounts section rows on edits and reorders. Watch the
    // body and re-scan when the DOM changes. Debounce so we don't
    // run on every keystroke.
    let timer = null;
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        scanAndHook();
      }, 80);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ════════════════════════════════════════════════════════════════
  // SHIP 2 — wire per-bullet targets into compress/enrich prompts
  // (v1.40.136)
  // ════════════════════════════════════════════════════════════════
  //
  // SHIP 1 (v1.40.132) stored the targets in localStorage but didn't
  // affect the LLM output. SHIP 2 closes the loop: when an outbound
  // request to an LLM proxy carries a compress/enrich system prompt,
  // we inspect it, look up the stored targets for the role being
  // processed, and append per-bullet line-count overrides to the
  // system prompt. The LLM then honours the locked targets instead
  // of picking buckets on its own.
  //
  // Why a fetch wrapper instead of a cv-proxy update
  // ────────────────────────────────────────────────
  // The prompts are built inside app.js (minified, immutable) and
  // sent directly to provider-specific proxy URLs (proxyUrl for
  // Anthropic, openaiProxyUrl, mistralProxyUrl, geminiProxyUrl).
  // Injecting from this sidecar means: works against the four
  // existing proxies as-is, no cv-proxy migration, no risk of
  // version mismatch. The injected text is plain English appended
  // to the system prompt — every LLM handles it identically.
  //
  // Scope (matches SHIP 1)
  // ──────────────────────
  // Experience-role bullets only. The system prompt for those calls
  // contains the literal substring `"experience_role"` plus
  // `roleId":"<rN>"`, which gives us both the operation type and the
  // role identity. text_bullets / bullets / table operations are
  // skipped — those will be SHIP 1's follow-up.

  // The four localStorage keys app.js uses to point at provider proxies.
  const PROXY_URL_KEYS = [
    'proxyUrl', 'openaiProxyUrl', 'mistralProxyUrl', 'geminiProxyUrl',
  ];

  // Read a single proxyUrl key, unwrapping any JSON-string wrap.
  function readProxyUrlKey(key) {
    try {
      let raw = localStorage.getItem(key) || '';
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'string') raw = parsed;
      } catch (_) {}
      raw = String(raw).trim().replace(/\/+$/, '');
      return raw || null;
    } catch (_) { return null; }
  }

  function readAllProxyUrls() {
    const urls = [];
    for (const k of PROXY_URL_KEYS) {
      const u = readProxyUrlKey(k);
      if (u) urls.push(u);
    }
    return urls;
  }

  // Read the doc-state sections from localStorage. Both `sections`
  // and `cv_pwa_sections` shapes are tolerated. Returns null if
  // nothing usable is present.
  function readDocSections() {
    const keys = ['cv_pwa_sections', 'sections', 'antcv:sections'];
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed && (Array.isArray(parsed.cv) || Array.isArray(parsed.cl))) {
          return parsed;
        }
      } catch (_) {}
    }
    return null;
  }

  // Locate a role by its `id` string and return the section that
  // owns it plus the role's position within the section's roles
  // array. Returns null if not found.
  function findRoleHome(roleId) {
    const all = readDocSections();
    if (!all) return null;
    for (const doc of ['cv', 'cl']) {
      const sections = all[doc] || [];
      for (const section of sections) {
        const roles = Array.isArray(section && section.roles) ? section.roles : null;
        if (!roles) continue;
        for (let i = 0; i < roles.length; i++) {
          if (roles[i] && roles[i].id === roleId) {
            return {
              doc,
              sectionId: section.id,
              roleIdx: i,
              bulletCount: Array.isArray(roles[i].bullets) ? roles[i].bullets.length : 0,
            };
          }
        }
      }
    }
    return null;
  }

  // Inspect a system prompt and decide whether it's a compress or
  // enrich call we should annotate. Returns `{roleId, sectionType}`
  // or null. The two distinctive markers are:
  //   - "DIMENSION-AWARE BULLET LENGTH" — present in every per-bullet
  //     line-budgeted prompt
  //   - `"experience_role"` — narrows to per-role compress/enrich
  //     (this is SHIP 1's scope; multi-role and text_bullets land
  //     in a follow-up)
  // The roleId is extracted from the literal `roleId":"<rN>"` schema
  // example embedded in the prompt.
  function classifySystemPrompt(content) {
    if (typeof content !== 'string') return null;
    if (content.indexOf('DIMENSION-AWARE BULLET LENGTH') < 0) return null;
    if (content.indexOf('"experience_role"') < 0) return null;
    const m = /roleId"\s*:\s*"([^"]+)"/.exec(content);
    if (!m) return null;
    return { roleId: m[1], sectionType: 'experience_role' };
  }

  // Translate the stored {sectionId → roleIdxInSection → bulletIdx →
  // target} into a flat {bulletIdx → target} for a specific role,
  // dropping entries that no longer correspond to real bullets.
  function targetsForRole(sectionId, roleIdx, bulletCount) {
    const store = readStore();
    const bySection = store[sectionId];
    if (!bySection) return null;
    const byRole = bySection[String(roleIdx)];
    if (!byRole) return null;
    const out = {};
    for (const k of Object.keys(byRole)) {
      const i = Number(k);
      if (Number.isFinite(i) && i >= 0 && i < bulletCount && TARGETS.indexOf(byRole[k]) >= 0) {
        out[i] = byRole[k];
      }
    }
    return Object.keys(out).length ? out : null;
  }

  // Build the override block to append to the system prompt. The
  // language mirrors the existing prompt's tone — short imperatives,
  // explicit char ranges, mention of FORBIDDEN ranges so the LLM
  // doesn't aim mid-bucket. 3-LINE is not in the source prompts; we
  // extrapolate from the 1L/2L definitions (≈64-68 chars per line at
  // Calibri 10.5pt main column → 3L ≈ 175-200 chars).
  function buildOverrideBlock(targets, bulletCount) {
    const lines = [''];
    lines.push('');
    lines.push('PER-BULLET LINE TARGETS (override the DIMENSION-AWARE BULLET LENGTH bucket choice above):');
    for (let i = 0; i < bulletCount; i++) {
      const t = targets[i];
      if (!t) continue;
      const num = i + 1;
      if (t === '1L') {
        lines.push(' - Bullet ' + num + ': MUST be exactly 1 line, 55-65 chars. FORBIDDEN: 66+ chars.');
      } else if (t === '2L') {
        lines.push(' - Bullet ' + num + ': MUST be exactly 2 lines, 110-130 chars. Fill line 1 AND line 2 (to within ~10 chars of the end). FORBIDDEN: 70-105 chars (half-empty line 2) or 135+ chars (wraps to 3 lines).');
      } else if (t === '3L') {
        lines.push(' - Bullet ' + num + ': MUST be exactly 3 lines, 175-200 chars. Fill all three lines. FORBIDDEN: 135-170 chars (half-empty line 3) or 205+ chars (wraps to 4 lines).');
      }
    }
    lines.push('These per-bullet locks OVERRIDE the bucket choice above. Honour them strictly.');
    return lines.join('\n');
  }

  // The main injection step. Given a JSON string body and the system
  // message it contains, return a modified body string with the
  // override block appended to the system content. If anything looks
  // off (not JSON, not a compress/enrich call, no targets for this
  // role), returns null to signal "pass through unchanged".
  function maybeInjectIntoBody(bodyText) {
    if (typeof bodyText !== 'string') return null;
    if (bodyText.indexOf('DIMENSION-AWARE BULLET LENGTH') < 0) {
      return null; // fast reject before paying for JSON.parse
    }
    let body;
    try { body = JSON.parse(bodyText); }
    catch (_) { return null; }
    if (!body || !Array.isArray(body.messages)) return null;
    const sysIdx = body.messages.findIndex(m => m && m.role === 'system');
    if (sysIdx < 0) return null;
    const sysMsg = body.messages[sysIdx];
    const classification = classifySystemPrompt(sysMsg.content);
    if (!classification) return null;
    const home = findRoleHome(classification.roleId);
    if (!home || home.bulletCount === 0) return null;
    const targets = targetsForRole(home.sectionId, home.roleIdx, home.bulletCount);
    if (!targets) return null;
    const block = buildOverrideBlock(targets, home.bulletCount);
    body.messages[sysIdx] = { ...sysMsg, content: sysMsg.content + block };
    return JSON.stringify(body);
  }

  // Test whether a URL points at a known LLM proxy. A request is
  // only annotated if its target host matches one of the configured
  // proxy URLs — keeps us out of unrelated traffic (cloud sync,
  // analytics, /api/active prefetches, etc.).
  function isLlmProxyUrl(url) {
    if (!url) return false;
    let urlStr;
    try { urlStr = String(url); } catch (_) { return false; }
    const proxies = readAllProxyUrls();
    for (const p of proxies) {
      if (!p) continue;
      if (urlStr.indexOf(p) === 0) return true;
      // Tolerate a proxy stored with no trailing slash vs URL with one
      if (urlStr.indexOf(p + '/') === 0) return true;
    }
    return false;
  }

  function urlFromArgs(args) {
    if (!args || !args.length) return '';
    const first = args[0];
    if (!first) return '';
    if (typeof first === 'string') return first;
    if (typeof first.url === 'string') return first.url;
    try { return String(first); } catch (_) { return ''; }
  }

  // Body normalisation. Supports the common case where opts.body is a
  // string. Blob/ArrayBuffer/FormData bodies are out of scope —
  // app.js's provider functions all build string bodies, so this is
  // fine in practice.
  function readStringBody(opts) {
    if (!opts || opts.body == null) return null;
    return typeof opts.body === 'string' ? opts.body : null;
  }

  // The interceptor itself. Wraps window.fetch idempotently — if
  // already wrapped (e.g., by privacy-LED), we wrap again so both
  // sidecars get a chance, with our marker preventing double-wrap
  // from this same script.
  function instrumentFetchOnce() {
    if (typeof window.fetch !== 'function') return;
    if (window.fetch.__antcvBulletTargetsWrapped === true) return;
    const orig = window.fetch;
    const wrapped = function (...args) {
      try {
        const url = urlFromArgs(args);
        if (isLlmProxyUrl(url)) {
          const opts = args[1] || (args[0] && args[0].method ? args[0] : null);
          const bodyText = readStringBody(opts);
          if (bodyText) {
            // SHIP 3 first (width calibration), SHIP 2 second (per-bullet
            // locks) — both are append-only to the same system prompt.
            const widthMod = maybeInjectWidthHint(bodyText);
            const modified = maybeInjectIntoBody(widthMod || bodyText) || widthMod;
            if (modified) {
              // Build a fresh opts object so we don't mutate the
              // caller's reference. Preserve everything else.
              const newOpts = { ...(opts || {}), body: modified };
              // If headers carried Content-Length, replace with the
              // new length so server-side framing stays correct.
              if (newOpts.headers) {
                const h = newOpts.headers;
                const isPlainHeaders = h && typeof h === 'object' && !Array.isArray(h) && !(h instanceof Headers);
                if (isPlainHeaders) {
                  for (const k of Object.keys(h)) {
                    if (k.toLowerCase() === 'content-length') {
                      h[k] = String(new TextEncoder().encode(modified).length);
                    }
                  }
                }
              }
              if (typeof args[0] === 'string') {
                args = [args[0], newOpts];
              } else {
                args[1] = newOpts;
              }
            }
          }
        }
      } catch (_) { /* fail open — pass through unchanged on any error */ }
      return orig.apply(this, args);
    };
    wrapped.__antcvBulletTargetsWrapped = true;
    window.fetch = wrapped;
  }

  // ════════════════════════════════════════════════════════════════
  // SHIP 3 — WIDTH-TARGET-HINTS-001 (GOLD-TARGET-LAYOUT-DENSITY-001,
  // v1.51.375)
  // ════════════════════════════════════════════════════════════════
  //
  // The DIMENSION-AWARE BULLET LENGTH blocks in app.js's enrich prompts
  // hardcode "Calibri 10.5pt ≈ 64-68 chars per line" — blind to the
  // CURRENT sidebar ratio, indents, and body font, so bullets tuned to
  // those numbers land as 2-3-word runt lines whenever the layout
  // differs. This ship measures the real chars-per-line for the live
  // main column (same DXA model as antcv-orphan-export-preflight
  // mirrors from the docx-worker) and appends a WIDTH CALIBRATION
  // block that overrides the hardcoded figures. It also fires on the
  // Fit-it/compress prompts, which carry no width guidance at all.
  //
  // No app.js change: the same fetch wrapper as SHIP 2.

  const WIDTH_MARKERS = [
    'DIMENSION-AWARE BULLET LENGTH',
    'Compress this CV/cover letter section',
  ];
  const WIDTH_BLOCK_TAG = 'WIDTH CALIBRATION';
  const PAGE_W_DXA = 11906;      // A4, zero page margins (worker model)
  const PX_PER_DXA = 1 / 15;
  const DEFAULT_BODY_PT = 10.5;  // worker main-body default

  let cplCache = { sig: null, cpl: 0 };

  function readJsonLs(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const v = JSON.parse(raw);
      return v == null ? fallback : v;
    } catch (_) { return fallback; }
  }

  function currentGeometry() {
    const sc = readJsonLs('styleConfig', {}) || {};
    let ratio = parseFloat(localStorage.getItem('cvSidebarRatio'));
    if (!(ratio > 0.1 && ratio < 0.7)) ratio = 0.36;
    const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
    return {
      ratio: ratio,
      mainEdgeIndent: num(sc.mainEdgeIndent, 14),   // px
      bulletIndent: num(sc.bulletIndent, 20),       // px
      seamGap: num(sc.seamGap, 6),                  // px
      font: (typeof sc.mainBodyFont === 'string' && sc.mainBodyFont) || 'Calibri',
      pt: DEFAULT_BODY_PT,
    };
  }

  // chars-per-line for a main-column bullet at the live geometry.
  // Width mirrors the worker: cellW = PAGE_W − sidebar − 2·edgeIndent −
  // seam; bullet text width = cellW − bulletIndent. Char width comes
  // from a canvas measurement of CV-like prose at the export font size
  // (pt → px at 4/3, the same conversion the export preflight uses).
  function measureCharsPerLine() {
    const g = currentGeometry();
    const sig = [g.ratio, g.mainEdgeIndent, g.bulletIndent, g.seamGap, g.font, g.pt].join('|');
    if (cplCache.sig === sig && cplCache.cpl > 0) return cplCache.cpl;
    let avg = 0;
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return 0;
      ctx.font = (g.pt * 4 / 3) + 'px "' + g.font + '", Calibri, sans-serif';
      const sample = 'Design and characterise low-light optical systems, supplier ' +
                     'qualification plans and measured validation procedures for production.';
      avg = ctx.measureText(sample).width / sample.length;
    } catch (_) { return 0; }
    if (!(avg > 0)) return 0;
    const cellWpx = (PAGE_W_DXA - Math.round(PAGE_W_DXA * g.ratio)
                     - 2 * g.mainEdgeIndent * 15 - g.seamGap * 15) * PX_PER_DXA;
    const bulletWpx = cellWpx - g.bulletIndent;
    const cpl = Math.round(bulletWpx / avg);
    if (!(cpl > 20 && cpl < 200)) return 0;
    cplCache = { sig: sig, cpl: cpl };
    return cpl;
  }

  function buildWidthBlock(cpl) {
    const g = currentGeometry();
    const b = (linesMinusOne, frac) => Math.round((linesMinusOne + frac) * cpl);
    const r = {
      l1: [b(0, 0.70), b(0, 0.97)],
      l2: [b(1, 0.70), b(1, 0.97)],
      l3: [b(2, 0.70), b(2, 0.97)],
    };
    return '\n\n' + WIDTH_BLOCK_TAG + ' (measured from the CURRENT column width and body font — ' +
      'these numbers OVERRIDE any chars-per-line figures above): one full rendered line here = ' +
      cpl + ' chars (' + g.font + ' ' + g.pt + 'pt, main column at the live sidebar ratio ' + g.ratio + '). ' +
      'Every bullet/paragraph must END ON A FULL LINE: its last line must reach at least 60% of ' +
      'the column width. Valid total lengths: 1-LINE = ' + r.l1[0] + '-' + r.l1[1] + ' chars; ' +
      '2-LINE = ' + r.l2[0] + '-' + r.l2[1] + ' chars; 3-LINE = ' + r.l3[0] + '-' + r.l3[1] + ' chars. ' +
      'FORBIDDEN dead zones: ' + (r.l1[1] + 3) + '-' + (r.l2[0] - 3) + ' and ' +
      (r.l2[1] + 3) + '-' + (r.l3[0] - 3) + ' chars — those wrap into a short dangling last line.';
  }

  // Append the calibration block to the request's system prompt. Handles
  // both prompt carriers: an OpenAI-style {role:"system"} message and an
  // Anthropic-style top-level `system` string (the compress cascade uses
  // provider-specific bodies). Returns the modified body string or null.
  function maybeInjectWidthHint(bodyText) {
    if (typeof bodyText !== 'string') return null;
    let marked = false;
    for (const m of WIDTH_MARKERS) {
      if (bodyText.indexOf(m) >= 0) { marked = true; break; }
    }
    if (!marked || bodyText.indexOf(WIDTH_BLOCK_TAG) >= 0) return null;
    const cpl = measureCharsPerLine();
    if (!cpl) return null;
    let body;
    try { body = JSON.parse(bodyText); } catch (_) { return null; }
    if (!body || typeof body !== 'object') return null;
    const block = buildWidthBlock(cpl);
    if (typeof body.system === 'string' && body.system) {
      body.system += block;
      return JSON.stringify(body);
    }
    if (Array.isArray(body.messages)) {
      const si = body.messages.findIndex(m => m && m.role === 'system' && typeof m.content === 'string');
      if (si >= 0) {
        body.messages[si] = { ...body.messages[si], content: body.messages[si].content + block };
        return JSON.stringify(body);
      }
      // no system carrier: the marker lives in a user turn (compress) —
      // append there so the calibration still reaches the model.
      const ui = body.messages.findIndex(m => m && m.role === 'user' &&
        typeof m.content === 'string' && WIDTH_MARKERS.some(t => m.content.indexOf(t) >= 0));
      if (ui >= 0) {
        body.messages[ui] = { ...body.messages[ui], content: body.messages[ui].content + block };
        return JSON.stringify(body);
      }
    }
    return null;
  }

  function bootSidecar() {
    init();                  // styles + panel strip injection (SHIP 1)
    instrumentFetchOnce();   // fetch interceptor (SHIP 2 + SHIP 3)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootSidecar);
  } else {
    setTimeout(bootSidecar, 0);
  }

  // Test/debug API
  window.AntcvBulletTargets = {
    version: SCRIPT_VERSION,
    _readStore: readStore,
    _writeStore: writeStore,
    _getTarget: getTarget,
    _setTarget: setTarget,
    _countBullets: countBullets,
    _resolveSectionId: resolveSectionId,
    _roleIndexInSection: roleIndexInSection,
    _detectActiveDoc: detectActiveDoc,
    _scan: scanAndHook,
    // SHIP 2 internals exposed for tests
    _classifySystemPrompt: classifySystemPrompt,
    _findRoleHome: findRoleHome,
    _targetsForRole: targetsForRole,
    _buildOverrideBlock: buildOverrideBlock,
    _maybeInjectIntoBody: maybeInjectIntoBody,
    _isLlmProxyUrl: isLlmProxyUrl,
    _instrumentFetchOnce: instrumentFetchOnce,
    // SHIP 3 internals exposed for tests
    _currentGeometry: currentGeometry,
    _measureCharsPerLine: measureCharsPerLine,
    _buildWidthBlock: buildWidthBlock,
    _maybeInjectWidthHint: maybeInjectWidthHint,
  };
})();
