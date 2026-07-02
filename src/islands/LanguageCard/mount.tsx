// Mount / unmount the React LanguageCard inside the Settings → Personal subtab.
//
// During Pass 1 transition both this bundle AND antcv-stability-core-334.js
// are loaded. We defer to the legacy card (id "antcv-stability-personal-languages")
// when it's present so the two never fight over the same DOM region. Pass 1
// cleanup (task #8) removes the stability-core <script> tag from index.html;
// from then on this island becomes the sole owner.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { LanguageCard } from './LanguageCard';
import {
  findDoneButton,
  findSettingsFlexColumn,
  findSettingsRoot,
  isPersonalSubtab,
} from '../../lib/settings-dom';

const REACT_CARD_ID = 'antcv-react-personal-languages';
const LEGACY_CARD_ID = 'antcv-stability-personal-languages';

// Native Personal-subtab section headers (literal uppercase) used to locate
// the order-based flex column the sections live in.
const PERSONAL_LABELS = [/^WRITING STYLE$/i, /^ADVANCED TONE$/i, /^BANNED WORDS$/i];

// CSS order slot: WRITING STYLE=25, ADVANCED TONE=30, BANNED WORDS=40.
// 27 lands Languages immediately after the WRITING STYLE label (before
// Advanced Tone / Banned Words) per SETTINGS-HEAD-001 — "after the style
// selector, before the banned words".
const LANGUAGES_ORDER = '27';

interface MountState {
  root: Root | null;
  container: HTMLElement | null;
}

const state: MountState = { root: null, container: null };

function legacyCardPresent(): boolean {
  return !!document.getElementById(LEGACY_CARD_ID);
}

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let container = document.getElementById(REACT_CARD_ID) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = REACT_CARD_ID;
    container.setAttribute('data-antcv-react-mount', 'language-card');
    container.style.order = LANGUAGES_ORDER;
  }

  // Primary anchor: the order-based flex column that holds the native Personal
  // sections. Mount INTO it and let CSS `order` place the card after the
  // writing-style / tone group and immediately before Banned Words. DOM
  // position inside the column is irrelevant — `order` decides — so we only
  // (re)attach when our node has been dropped (e.g. app.js re-rendered the
  // column), which keeps the observer from thrashing.
  const column = findSettingsFlexColumn(settingsRoot, PERSONAL_LABELS);
  if (column) {
    container.style.order = LANGUAGES_ORDER;
    if (container.parentElement !== column) column.appendChild(container);
    return container;
  }

  // Fallback (column not detected): just before the Settings "Done" button.
  if (container.parentElement) return container;
  const done = findDoneButton(settingsRoot);
  if (done && done.parentElement) {
    done.parentElement.insertBefore(container, done);
  } else {
    settingsRoot.appendChild(container);
  }
  return container;
}

function hideStrayLanguageBlocks(settingsRoot: HTMLElement): void {
  // Any DOM-rendered "LANGUAGES IN THE TOP BAR" block that isn't our own
  // container — collapse it. Belt-and-braces for the case where a third
  // sidecar inserts a duplicate.
  const all = Array.from(settingsRoot.querySelectorAll<HTMLElement>('*'));
  for (const el of all) {
    const txt = (el.textContent ?? '').replace(/[ \t\n\r]+/g, ' ').trim().slice(0, 500);
    if (!/^LANGUAGES IN THE TOP BAR/i.test(txt)) continue;
    if (el.id === REACT_CARD_ID || el.closest(`#${REACT_CARD_ID}`)) continue;
    if (el.id === LEGACY_CARD_ID || el.closest(`#${LEGACY_CARD_ID}`)) continue;

    let n: HTMLElement = el;
    let best: HTMLElement = el;
    for (let i = 0; i < 8 && n.parentElement && n.parentElement !== settingsRoot; i++) {
      n = n.parentElement;
      const t = (n.textContent ?? '').replace(/[ \t\n\r]+/g, ' ').trim().slice(0, 1800);
      if (/LANGUAGES IN THE TOP BAR/i.test(t)) best = n;
      try {
        const r = n.getBoundingClientRect();
        if (r.width > 180 && r.height > 24 && r.height < 850) best = n;
      } catch { /* */ }
      if (n.querySelectorAll && n.querySelectorAll('input,select,textarea,button').length > 18) break;
    }
    if (best.id === REACT_CARD_ID || best.id === LEGACY_CARD_ID) continue;
    best.setAttribute('data-antcv-hidden-language-stray', '1');
    best.style.setProperty('display', 'none', 'important');
    best.style.setProperty('visibility', 'hidden', 'important');
    best.style.setProperty('height', '0', 'important');
    best.style.setProperty('margin', '0', 'important');
    best.style.setProperty('padding', '0', 'important');
    best.style.setProperty('overflow', 'hidden', 'important');
  }
}

function unmountIfMounted(): void {
  if (state.root) {
    try { state.root.unmount(); } catch { /* */ }
    state.root = null;
  }
  if (state.container && state.container.parentElement) {
    try { state.container.parentElement.removeChild(state.container); } catch { /* */ }
  }
  state.container = null;
}

function applyOnce(): void {
  if (legacyCardPresent()) {
    // Stability-core owns the card during the transition; stand down.
    unmountIfMounted();
    return;
  }

  // #4 (1.50.555, owner): the Writing-Style island now hosts the LanguageCard
  // INLINE (above Banned). When that embedded card is present, the standalone
  // stands down to avoid a duplicate. The embedded card is nested inside the
  // writing-style island; the standalone lives in its own #REACT_CARD_ID, so
  // this selector matches only the embedded one.
  if (document.querySelector('[data-antcv-react-island="writing-style-picker"] [data-antcv-react-island="language-card"]')) {
    unmountIfMounted();
    return;
  }

  const settingsRoot = findSettingsRoot();
  if (!settingsRoot) {
    unmountIfMounted();
    return;
  }

  if (!isPersonalSubtab(settingsRoot)) {
    unmountIfMounted();
    return;
  }

  hideStrayLanguageBlocks(settingsRoot);

  const container = ensureMountContainer(settingsRoot);
  if (state.container !== container) {
    if (state.root) {
      try { state.root.unmount(); } catch { /* */ }
      state.root = null;
    }
    state.container = container;
  }
  if (!state.root) {
    state.root = createRoot(container);
    state.root.render(createElement(LanguageCard));
  }
}

// Scope the MutationObserver to <body>, not document.documentElement.
// Pass 1 exit criterion: zero observers on documentElement.
function startBodyObserver(): MutationObserver {
  const target = document.body;
  let pending = false;
  const obs = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    // STICKY-LEAK-005: setTimeout, not rAF — rAF never fires in a background
    // tab, freezing this loop with `pending` stuck true (stranded island).
    setTimeout(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[LanguageCard] applyOnce failed', e); }
    }, 60);
  });
  obs.observe(target, { childList: true, subtree: true, attributes: false });
  return obs;
}

let booted = false;
let observer: MutationObserver | null = null;

export function mountLanguageCardIsland(): void {
  if (booted) return;
  booted = true;

  // Initial paint may not have happened yet; try once now, then keep watching.
  try { applyOnce(); } catch (e) { console.warn('[LanguageCard] initial applyOnce failed', e); }
  observer = startBodyObserver();

  // Listen for the tab-state events the rest of the app emits, so we react
  // immediately rather than waiting for a DOM mutation.
  const refresh = () => { try { applyOnce(); } catch { /* */ } };
  window.addEventListener('antcv:settings-route', refresh);
  window.addEventListener('antcv:language-prefs-changed', refresh);
  // Hook for tests to forcibly tear down.
  (window as unknown as { __antcvReactLanguageCardTeardown?: () => void }).__antcvReactLanguageCardTeardown = () => {
    try { observer?.disconnect(); } catch { /* */ }
    observer = null;
    unmountIfMounted();
    booted = false;
  };
}
