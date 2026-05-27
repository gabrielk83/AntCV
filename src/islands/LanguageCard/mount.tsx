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
import { findDoneButton, findSettingsRoot, isPersonalSubtab } from '../../lib/settings-dom';

const REACT_CARD_ID = 'antcv-react-personal-languages';
const LEGACY_CARD_ID = 'antcv-stability-personal-languages';

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
  if (container) return container;

  container = document.createElement('div');
  container.id = REACT_CARD_ID;
  container.setAttribute('data-antcv-react-mount', 'language-card');

  // Same anchoring logic as antcv-stability-core-334.js insertTarget(): try
  // to insert just before the Settings "Done" button so the card hangs at
  // the bottom of the Personal tab content.
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
    requestAnimationFrame(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[LanguageCard] applyOnce failed', e); }
    });
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
