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

export function readPackageState(): PackageState {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const packageId = normalisePackageId(pi.stylePackage);
  const quickAlt = normaliseQuickAlt(pi.stylePackageQuickAlt);
  // "Custom" is signalled by either an explicit string flag or a
  // customStyleConfig blob present with a saved timestamp.
  const explicit = typeof pi.stylePackage === 'string' && pi.stylePackage.toLowerCase() === 'custom';
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

  try {
    window.dispatchEvent(
      new CustomEvent('antcv:package-changed', { detail: merged }),
    );
  } catch { /* */ }

  return merged;
}

export function applyPackageToBody(state: PackageState | null = null): PackageState {
  const s = state ?? readPackageState();
  try {
    document.body.setAttribute('data-package', s.packageId);
    document.body.setAttribute('data-package-quick-alt', s.quickAlt);
    if (s.isCustom) document.body.setAttribute('data-package-custom', '1');
    else document.body.removeAttribute('data-package-custom');
  } catch { /* */ }
  return s;
}

let installed = false;

export function installPackageBodyBinding(): void {
  if (installed) return;
  installed = true;

  applyPackageToBody();

  // Listen for cross-tab / in-tab changes so the body attribute always
  // mirrors localStorage. The vanilla app may write personalInfo directly
  // without going through our setters.
  window.addEventListener('storage', (ev) => {
    if (ev.key === 'personalInfo' || ev.key === 'antcv:package-state') {
      applyPackageToBody();
    }
  });
  window.addEventListener('antcv:package-changed', (ev) => {
    const detail = (ev as CustomEvent<PackageState>).detail;
    if (detail) applyPackageToBody(detail);
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
