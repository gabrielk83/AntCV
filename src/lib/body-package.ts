// Applies body[data-package="..."] and body[data-package-quick-alt="..."]
// so the per-package CSS variable bundle in pwa/antcv-packages-registry.css
// takes effect. Plan §2.3: "Every token is a CSS custom property on :root,
// swapped by data-package='...' on <body>."
//
// Quick alternative is a sibling attribute — the CSS file's selectors can
// be extended to read it (e.g. body[data-package-quick-alt="alt1"]) when
// the alt-pair tokens need to flow into specific element styles.

import {
  DEFAULT_PACKAGE,
  type PackageId,
  type QuickAlt,
  normalisePackageId,
  normaliseQuickAlt,
} from './packages';

interface PersonalInfoBlob {
  stylePackage?: unknown;
  stylePackageQuickAlt?: unknown;
  customStyleConfig?: unknown;
  customStyleSavedAt?: unknown;
}

function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* */ }
}

export interface PackageState {
  packageId: PackageId;
  quickAlt: QuickAlt;
  isCustom: boolean;
}

// The native app.js STYLE PACKAGE picker (what Settings shows) owns selection
// and writes the TOP-LEVEL `stylePackage` localStorage key — it does NOT update
// personalInfo.stylePackage. Reading only personalInfo therefore lagged behind
// the selected package after a reload (palette stuck on the previous style until
// a re-click). Prefer the native key so the applied body[data-package] palette
// always matches the selection Settings displays.
function readNativeStylePackage(): string | null {
  try {
    const raw = localStorage.getItem('stylePackage');
    if (!raw) return null;
    try {
      const v = JSON.parse(raw);
      if (typeof v === 'string' && v.trim()) return v.trim();
    } catch {
      // Stored unquoted — use the raw string.
      if (raw.trim()) return raw.trim();
    }
  } catch { /* */ }
  return null;
}

export function readPackageState(): PackageState {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const native = readNativeStylePackage();
  const source: unknown = native ?? pi.stylePackage;
  const packageId = normalisePackageId(source);
  const quickAlt = normaliseQuickAlt(pi.stylePackageQuickAlt);
  // "Custom" is signalled by either an explicit string flag or a
  // customStyleConfig blob present with a saved timestamp.
  const explicit = typeof source === 'string' && source.toLowerCase() === 'custom';
  const hasCustomConfig = !!pi.customStyleConfig && !!pi.customStyleSavedAt;
  return { packageId, quickAlt, isCustom: explicit || hasCustomConfig };
}

export function writePackageState(next: Partial<PackageState>): PackageState {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const prev = readPackageState();
  const merged: PackageState = { ...prev, ...next };
  pi.stylePackage = merged.packageId;
  pi.stylePackageQuickAlt = merged.quickAlt;
  if (!merged.isCustom) {
    // Clear stale custom blob — saving back into a package implies the
    // user has exited Custom mode.
    pi.customStyleConfig = null;
    pi.customStyleSavedAt = null;
  }
  writeJSON('personalInfo', pi);
  // Keep the native top-level key in sync so a later reload (which reads the
  // native key first) restores the same palette, and the native Settings UI
  // agrees with the island.
  if (!merged.isCustom) {
    try { localStorage.setItem('stylePackage', JSON.stringify(merged.packageId)); } catch { /* */ }
  }

  try {
    window.dispatchEvent(
      new CustomEvent('antcv:package-changed', { detail: merged }),
    );
  } catch { /* */ }

  return merged;
}

function setAttrIfChanged(name: string, value: string | null): void {
  try {
    const cur = document.body.getAttribute(name);
    if (value === null) { if (cur !== null) document.body.removeAttribute(name); }
    else if (cur !== value) document.body.setAttribute(name, value);
  } catch { /* */ }
}

export function applyPackageToBody(state: PackageState | null = null): PackageState {
  const s = state ?? readPackageState();
  // Idempotent: only write when the attribute actually changes, so frequent
  // re-applies (delayed restore catch-up) can't feed a mutation loop.
  setAttrIfChanged('data-package', s.packageId);
  setAttrIfChanged('data-package-quick-alt', s.quickAlt);
  setAttrIfChanged('data-package-custom', s.isCustom ? '1' : null);
  return s;
}

let installed = false;

export function installPackageBodyBinding(): void {
  if (installed) return;
  installed = true;

  applyPackageToBody();

  // The native key / personalInfo may be restored from cloud AFTER this island
  // mounts (cloud-restore writes via setItem, which does NOT fire a same-tab
  // storage event). Re-apply on a few delayed ticks so the palette catches up
  // to the restored selection without waiting for a click. Idempotent, so these
  // are no-ops once the value is stable.
  [150, 500, 1200, 3000].forEach((d) => {
    setTimeout(() => { try { applyPackageToBody(); } catch { /* */ } }, d);
  });

  // Listen for cross-tab / in-tab changes so the body attribute always
  // mirrors localStorage. The vanilla app may write the native `stylePackage`
  // key or personalInfo directly without going through our setters.
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'personalInfo' || ev.key === 'antcv:package-state' || ev.key === 'stylePackage') {
      applyPackageToBody();
    }
  });
  window.addEventListener('antcv:package-changed', (ev) => {
    const detail = (ev as CustomEvent<PackageState>).detail;
    if (detail) applyPackageToBody(detail);
  });
  // Cloud-restore / generation re-renders broadcast this; re-apply so a palette
  // restored after mount is reflected even on the same tab.
  window.addEventListener('antcv:sections-updated', () => {
    try { applyPackageToBody(); } catch { /* */ }
  });
}

// Test / debug API on window so the §8.8 independence test can read /
// flip the active package from outside React.
declare global {
  interface Window {
    AntcvPackageState?: {
      version: string;
      read: () => PackageState;
      write: (next: Partial<PackageState>) => PackageState;
      apply: (state?: PackageState | null) => PackageState;
      packages: readonly PackageId[];
      defaultPackage: PackageId;
    };
  }
}

import { PACKAGE_IDS } from './packages';

export function exposePackageDebugApi(): void {
  window.AntcvPackageState = {
    version: '1.50.0-pass2',
    read: readPackageState,
    write: writePackageState,
    apply: applyPackageToBody,
    packages: PACKAGE_IDS,
    defaultPackage: DEFAULT_PACKAGE,
  };
}
