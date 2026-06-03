// Mount the ExportOptionsCard inside Settings -> Layout, immediately ABOVE
// the "Open Advanced -> Style ..." hand-off button (moved from Personal in
// v1.50.x). The card is collapsible and collapsed by default.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { ExportOptionsCard } from './ExportOptionsCard';
import {
  findAdvancedStyleButton,
  findDoneButton,
  findSettingsRoot,
  isLayoutSubtab,
} from '../../lib/settings-dom';

const MOUNT_ID = 'antcv-react-export-options';

let root: Root | null = null;
let container: HTMLElement | null = null;

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let c = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (c) {
    // Re-anchor if React has re-rendered the Layout subtab and the button
    // moved relative to our container.
    const advBtn = findAdvancedStyleButton(settingsRoot);
    if (advBtn) {
      // The button is usually wrapped; anchor before the outermost wrapper
      // that is a direct-ish sibling region, else before the button itself.
      const anchor = anchorForButton(advBtn);
      if (anchor && anchor.parentElement && c.nextSibling !== anchor) {
        try { anchor.parentElement.insertBefore(c, anchor); } catch { /* */ }
      }
    }
    return c;
  }
  c = document.createElement('div');
  c.id = MOUNT_ID;
  c.setAttribute('data-antcv-react-mount', 'export-options');

  const advBtn = findAdvancedStyleButton(settingsRoot);
  if (advBtn) {
    const anchor = anchorForButton(advBtn);
    if (anchor && anchor.parentElement) {
      anchor.parentElement.insertBefore(c, anchor);
      return c;
    }
  }
  // Fallback: just above the Done button, else append to the settings root.
  const done = findDoneButton(settingsRoot);
  if (done && done.parentElement) {
    done.parentElement.insertBefore(c, done);
  } else {
    settingsRoot.appendChild(c);
  }
  return c;
}

// The Advanced-Style button may be wrapped in a layout div. Insert our card
// before the highest ancestor of the button that is still a direct child of
// the same column the button lives in (so the card sits visually just above
// the button, not nested inside its wrapper). We climb at most 2 levels and
// never past an element that contains more than the button-ish content.
function anchorForButton(btn: Element): Element {
  let node: Element = btn;
  let hops = 0;
  while (hops < 2) {
    const p = node.parentElement;
    if (!p) break;
    // Stop if the parent holds substantially more than just the button.
    if (p.children.length > 1) break;
    node = p;
    hops++;
  }
  return node;
}

function unmountIfMounted(): void {
  if (root) { try { root.unmount(); } catch { /* */ } root = null; }
  if (container && container.parentElement) {
    try { container.parentElement.removeChild(container); } catch { /* */ }
  }
  container = null;
}

function applyOnce(): void {
  const settingsRoot = findSettingsRoot();
  if (!settingsRoot || !isLayoutSubtab(settingsRoot)) {
    unmountIfMounted();
    return;
  }
  const next = ensureMountContainer(settingsRoot);
  if (container !== next) {
    if (root) { try { root.unmount(); } catch { /* */ } root = null; }
    container = next;
  }
  if (!root) {
    root = createRoot(container);
    root.render(createElement(ExportOptionsCard));
  }
}

let booted = false;
let observer: MutationObserver | null = null;

export function mountExportOptionsIsland(): void {
  if (booted) return;
  booted = true;

  try { applyOnce(); } catch (e) { console.warn('[ExportOptions] initial mount failed', e); }
  let pending = false;
  observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[ExportOptions] applyOnce failed', e); }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  (window as unknown as { __antcvReactExportOptionsTeardown?: () => void })
    .__antcvReactExportOptionsTeardown = () => {
    try { observer?.disconnect(); } catch { /* */ }
    observer = null;
    unmountIfMounted();
    booted = false;
  };
}
