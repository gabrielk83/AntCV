// wizardState — derived, triple-state view of the onboarding wizard status.
//
// Replaces the bare `wizardCompleted` boolean with three semantic values:
//   - 'new'        — wizard has never been completed
//   - 'skipped'    — user explicitly dismissed the wizard
//   - 'completed'  — wizard ran to the end
//
// Pass 1 P0-4 (§7 step 4 of AntCV_Plan_v2_LockedSources.md). We do NOT
// introduce a new persisted key — wizardState is *derived* from the existing
// wizardCompleted / antcv:wizardCompleted localStorage flags plus the
// `antcv-just-deleted` cookie set by antcv-cloud-delete-296.js. Reusing the
// existing keys avoids needing to update antcv-cloud-restore-filter-298.js's
// strip list and keeps the cloud-restore semantics intact.
//
// Hotfix §5 item #5 ("Block wizardCompleted writes during post-delete TTL")
// was deliberately reverted in v1.40.335-hotfix-b because its host file
// (antcv-onboarding.js) is no longer loaded. The proper fix is here: we
// monkey-patch Storage.prototype.setItem to refuse writes of `wizardCompleted`
// (and aliases) while the just-deleted cookie is fresh. The cookie has a 24 h
// TTL, the guard returns to silent passthrough as soon as the cookie expires.

export type WizardState = 'new' | 'skipped' | 'completed';

const COMPLETED_KEYS = new Set<string>([
  'wizardCompleted',
  'antcv:wizardCompleted',
  'wizardComplete',
  'wizard_completed',
  'onboardingCompleted',
  'onboarding_completed',
]);

const SKIPPED_KEYS = new Set<string>([
  'wizardSkipped',
  'antcv:wizardSkipped',
  'wizard_skipped',
]);

const JUST_DELETED_COOKIE = 'antcv-just-deleted';
const POST_DELETE_TTL_MS = 24 * 60 * 60 * 1000; // matches the cookie max-age in antcv-cloud-delete-296.js

function readCookie(name: string): string | null {
  try {
    const parts = document.cookie ? document.cookie.split(';') : [];
    for (const raw of parts) {
      const trimmed = raw.trim();
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      if (trimmed.slice(0, eq) !== name) continue;
      return decodeURIComponent(trimmed.slice(eq + 1));
    }
    return null;
  } catch {
    return null;
  }
}

export function postDeleteTtlActive(): boolean {
  const raw = readCookie(JUST_DELETED_COOKIE);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  if (!Number.isFinite(ts) || ts <= 0) return false;
  return Date.now() - ts < POST_DELETE_TTL_MS;
}

function truthyStorageValue(v: unknown): boolean {
  if (v == null) return false;
  const s = String(v);
  if (s === 'false' || s === '"false"' || s === '0' || s === 'null' || s === '') return false;
  return true;
}

function readFlag(keys: Set<string>): boolean {
  try {
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (truthyStorageValue(v)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function readWizardCompletedFlag(): boolean {
  return readFlag(COMPLETED_KEYS);
}

export function readWizardSkippedFlag(): boolean {
  return readFlag(SKIPPED_KEYS);
}

export function getWizardState(): WizardState {
  if (postDeleteTtlActive()) return 'new';
  if (readWizardCompletedFlag()) return 'completed';
  if (readWizardSkippedFlag()) return 'skipped';
  return 'new';
}

interface SetItemOriginal {
  (key: string, value: string): void;
}

let guardInstalled = false;

export function installWizardStateGuard(): void {
  if (guardInstalled) return;
  if (typeof window === 'undefined') return;
  // Detect environments where Storage.prototype is missing or already
  // hard-frozen by some other layer.
  const proto = Storage.prototype;
  if (!proto || typeof proto.setItem !== 'function') return;

  const original = proto.setItem as SetItemOriginal;

  // Mark the wrapper so we can detect double-install across hot reloads.
  interface MarkedSetItem extends SetItemOriginal { __antcvWizardStateGuard?: true }
  if ((original as MarkedSetItem).__antcvWizardStateGuard) {
    guardInstalled = true;
    return;
  }

  function wrapped(this: Storage, key: string, value: string): void {
    // Only guard localStorage writes — sessionStorage scoping is per-tab
    // and used by the deletion path itself.
    if (this === window.localStorage) {
      const isCompletedFlag = COMPLETED_KEYS.has(key);
      const isSkippedFlag = SKIPPED_KEYS.has(key);
      if ((isCompletedFlag || isSkippedFlag) && truthyStorageValue(value) && postDeleteTtlActive()) {
        try {
          console.info('[wizard-state] blocked write of', key, '— post-delete TTL is active');
        } catch { /* */ }
        return;
      }
    }
    return original.call(this, key, value);
  }
  (wrapped as MarkedSetItem).__antcvWizardStateGuard = true;
  proto.setItem = wrapped as Storage['setItem'];
  guardInstalled = true;
}

export function isWizardStateGuardInstalled(): boolean {
  return guardInstalled;
}

// Test / debug API — exposed on window so the §5.1 smoke test can verify
// the guard is installed without poking the internals.
declare global {
  interface Window {
    AntcvWizardState?: {
      version: string;
      getState: () => WizardState;
      postDeleteTtlActive: () => boolean;
      guardInstalled: () => boolean;
    };
  }
}

export function exposeDebugApi(): void {
  window.AntcvWizardState = {
    version: '1.50.0-pass1',
    getState: getWizardState,
    postDeleteTtlActive,
    guardInstalled: isWizardStateGuardInstalled,
  };
}
