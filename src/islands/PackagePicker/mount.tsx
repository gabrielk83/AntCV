// Mount the PackagePicker inside Settings → LAYOUT (moved out of Personal in
// v1.50.95). The native Layout subtab owns package SELECTION and the
// quick-alternatives (the colour pairs on each STYLE PACKAGE button), so this
// island does NOT re-implement a selector — it (a) enriches each native
// package button with its primary colours + photo-shape glyph (the
// "elegant small" treatment that used to live on the Personal-tab cards) and
// (b) renders an explanation-only card (context="layout") immediately below
// the STYLE PACKAGE section. Personal carries no visual-package control.

import { createRoot, type Root } from 'react-dom/client';
import { createElement } from 'react';
import { PackagePicker } from './PackagePicker';
import {
  findAdvancedStyleButton,
  findDoneButton,
  findSectionBlockBeforeNext,
  findSettingsRoot,
  isLayoutSubtab,
} from '../../lib/settings-dom';
import { applyPackageToBody, exposePackageDebugApi, installPackageBodyBinding } from '../../lib/body-package';
import { PACKAGES, PACKAGE_IDS } from '../../lib/packages';

const MOUNT_ID = 'antcv-react-package-picker';
const DECO_ATTR = 'data-antcv-pkg-deco';

// Native Layout-subtab section headers (literal uppercase). The Layout subtab
// is block-flow (not the order-based flex column Personal uses), so we anchor
// the card immediately after the STYLE PACKAGE section block — proven to be a
// top-level section because SIDEBAR POSITION follows it.
// VISUAL-PKG-001: the native heading was relabelled "STYLE PACKAGE" → "Visual
// package" (app.src.js + app.js mirror). Accept BOTH spellings so the anchor
// survives during/after rollout and across cached app.js bundles.
const STYLE_PACKAGE_RE = /^(STYLE PACKAGE|Visual package)$/i;
// Contains-match: the following section's full textContent is "SIDEBAR
// POSITION" + its button labels, so this must not be anchored with $.
const SIDEBAR_POSITION_RE = /SIDEBAR POSITION/i;

interface MountState { root: Root | null; container: HTMLElement | null }
const state: MountState = { root: null, container: null };

function ensureMountContainer(settingsRoot: HTMLElement): HTMLElement {
  let container = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (!container) {
    container = document.createElement('div');
    container.id = MOUNT_ID;
    container.setAttribute('data-antcv-react-mount', 'package-picker');
  }

  // Primary anchor: immediately after the native STYLE PACKAGE section, so the
  // Quick-alt / Custom card reads as a continuation of the package buttons.
  const styleSection = findSectionBlockBeforeNext(settingsRoot, STYLE_PACKAGE_RE, SIDEBAR_POSITION_RE);
  if (styleSection) {
    if (container.previousElementSibling !== styleSection) {
      styleSection.insertAdjacentElement('afterend', container);
    }
    return container;
  }

  // Fallbacks: above the "Open Advanced → Style" hand-off button, else above Done.
  if (container.parentElement) return container;
  const advBtn = findAdvancedStyleButton(settingsRoot);
  if (advBtn && advBtn.parentElement) {
    advBtn.parentElement.insertBefore(container, advBtn);
    return container;
  }
  const done = findDoneButton(settingsRoot);
  if (done && done.parentElement) {
    done.parentElement.insertBefore(container, done);
  } else {
    settingsRoot.appendChild(container);
  }
  return container;
}

// ─── native STYLE PACKAGE button enrichment ───────────────────────────────
//
// The native buttons render the package name only. We append each package's
// primary-colour swatches + a photo-shape glyph below the name — the compact
// version of the old Personal-tab PackageCard. Plain DOM (not React) so it
// rides on top of app.js's own buttons without owning their click wiring;
// idempotent via DECO_ATTR and re-applied by the observer if app.js repaints.

function shapeGlyphSvg(shape: string, color: string, size = 16): string {
  const half = size / 2;
  // Filled silhouette in the package's primary colour with a light outline —
  // far more distinguishable at a glance than a thin same-colour stroke.
  const common = `fill="${color}" fill-opacity="0.9" stroke="rgba(255,255,255,.85)" stroke-width="1.4"`;
  let inner: string;
  switch (shape) {
    case 'square':
      inner = `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" ${common}/>`;
      break;
    case 'rounded-square':
      inner = `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="2.5" ${common}/>`;
      break;
    case 'rounded':
      inner = `<rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${(half / 1.7).toFixed(1)}" ${common}/>`;
      break;
    case 'hexagon': {
      const r = half - 1.2;
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i + Math.PI / 6;
        pts.push(`${(half + r * Math.cos(a)).toFixed(1)},${(half + r * Math.sin(a)).toFixed(1)}`);
      }
      inner = `<polygon points="${pts.join(' ')}" ${common}/>`;
      break;
    }
    default:
      inner = `<circle cx="${half}" cy="${half}" r="${half - 1.2}" ${common}/>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-hidden="true" style="display:inline-block;flex:0 0 auto">${inner}</svg>`;
}

function decorateNativePackageButtons(settingsRoot: HTMLElement): void {
  // Map normalised display name → package, so we only touch the real buttons.
  const byName = new Map<string, (typeof PACKAGES)[keyof typeof PACKAGES]>();
  for (const id of PACKAGE_IDS) {
    byName.set(PACKAGES[id].displayName.replace(/[ \t\n\r]+/g, ' ').trim().toLowerCase(), PACKAGES[id]);
  }
  const mount = document.getElementById(MOUNT_ID);
  const swatch = (c: string): string =>
    `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${c};box-shadow:0 0 0 1px rgba(0,0,0,.25)"></span>`;

  for (const btn of Array.from(settingsRoot.querySelectorAll('button')) as HTMLButtonElement[]) {
    if (mount && mount.contains(btn)) continue;            // never our own card
    if (btn.hasAttribute('data-antcv-package-card')) continue; // legacy React card
    const text = (btn.textContent ?? '').replace(/[ \t\n\r]+/g, ' ').trim().toLowerCase();

    // The Custom button carries its own one-line explanation (moved here from
    // the LayoutNotes card so it sits beside the control it describes). Shrunk,
    // package-agnostic, idempotent.
    if (text.startsWith('custom')) {
      if (!btn.querySelector('[data-antcv-custom-note]')) {
        const note = document.createElement('span');
        note.setAttribute('data-antcv-custom-note', '1');
        note.style.cssText =
          'display:block;margin-top:4px;font-size:9px;line-height:1.3;font-weight:500;' +
          'opacity:.6;text-transform:none;letter-spacing:0;white-space:normal';
        note.textContent = 'Auto when you edit beyond the package range.';
        btn.style.display = 'flex';
        btn.style.flexDirection = 'column';
        btn.style.alignItems = 'flex-start';
        btn.appendChild(note);
      }
      continue;
    }

    const pkg = byName.get(text);
    if (!pkg) continue;                                     // skip non-package buttons
    if (btn.querySelector(`[${DECO_ATTR}]`)) continue;      // idempotent

    const strip = document.createElement('span');
    strip.setAttribute(DECO_ATTR, '1');
    strip.style.cssText = 'display:flex;align-items:center;gap:3px;margin-top:5px';
    // Hover / long-press tooltip explaining the row.
    strip.title =
      `${pkg.displayName} — palette swatches: base, primary, interactive, bullet, glyph. ` +
      `Right glyph = profile-photo shape (${pkg.shape}).`;
    strip.innerHTML =
      swatch(pkg.base) + swatch(pkg.primary) + swatch(pkg.interactive) + swatch(pkg.bullet) + swatch(pkg.glyph) +
      '<span style="width:4px"></span>' + shapeGlyphSvg(pkg.shape, pkg.primary, 16);

    // Stack the name over the swatch strip without disturbing the native pill.
    btn.style.display = 'flex';
    btn.style.flexDirection = 'column';
    btn.style.alignItems = 'flex-start';
    btn.style.gap = '0';
    btn.appendChild(strip);
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
  const settingsRoot = findSettingsRoot();
  if (!settingsRoot) {
    unmountIfMounted();
    return;
  }
  if (!isLayoutSubtab(settingsRoot)) {
    unmountIfMounted();
    return;
  }
  try { decorateNativePackageButtons(settingsRoot); } catch (e) { console.warn('[PackagePicker] button enrich failed', e); }
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
    state.root.render(createElement(PackagePicker, { context: 'layout' }));
  }
}

let booted = false;
let observer: MutationObserver | null = null;

export function mountPackagePickerIsland(): void {
  if (booted) return;
  booted = true;

  // Ensure body[data-package="..."] is in place immediately — even before
  // the picker UI mounts — so the CSS variable bundle is active.
  try { installPackageBodyBinding(); } catch (e) { console.warn('[PackagePicker] body binding failed', e); }
  try { exposePackageDebugApi(); } catch (e) { console.warn('[PackagePicker] debug API failed', e); }
  try { applyPackageToBody(); } catch (e) { console.warn('[PackagePicker] initial apply failed', e); }

  try { applyOnce(); } catch (e) { console.warn('[PackagePicker] initial mount failed', e); }

  let pending = false;
  observer = new MutationObserver(() => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      try { applyOnce(); } catch (e) { console.warn('[PackagePicker] applyOnce failed', e); }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });

  (window as unknown as { __antcvReactPackagePickerTeardown?: () => void })
    .__antcvReactPackagePickerTeardown = () => {
    try { observer?.disconnect(); } catch { /* */ }
    observer = null;
    unmountIfMounted();
    booted = false;
  };
}
