import { useCallback, useEffect, useRef, useState } from 'react';
import { findSettingsRoot, getTabState, isElementVisible } from '../../lib/settings-dom';

// useModalNav — single source of truth for the Settings modal route. Replaces
// the routeSettings / forceRoute pair in pwa/antcv-stability-core-334.js
// (lines 207-251) plus the equivalent retry cascade in
// pwa/antcv-settings-front-327.js. No z-index ramping — Pass 1 exit criterion
// "Zero z-index: !important over --z-overlay-max" excludes that path.

export type SettingsTier = 'standard' | 'advanced' | 'admin';
export type SettingsSubtab =
  | 'account'
  | 'personal'
  | 'layout'
  | 'application-history'
  | 'sync'
  | 'adv-styles'
  | 'routing'
  | 'api-keys'
  | 'general'
  | 'demo'
  | 'users'
  | 'analytics';

export interface SettingsRouteIntent {
  tier?: SettingsTier;
  subtab?: SettingsSubtab;
  source?: string;
  ts?: number;
}

interface NormalisedIntent {
  tier: SettingsTier;
  subtab: SettingsSubtab | '';
  source: string;
  ts: number;
}

const SUBTAB_REGEX: Record<SettingsSubtab, RegExp> = {
  account: /^Account$/i,
  personal: /^(Personal|User)$/i,
  layout: /^Layout$/i,
  'application-history': /^Application history$/i,
  sync: /^Sync$/i,
  'adv-styles': /^Adv\. Styles$/i,
  routing: /^Routing$/i,
  'api-keys': /^API Keys$/i,
  general: /^General$/i,
  demo: /^Demo$/i,
  users: /^Users$/i,
  analytics: /^Analytics$/i,
};

const TIER_REGEX: Record<SettingsTier, RegExp> = {
  standard: /^STANDARD$/i,
  advanced: /^ADVANCED$/i,
  admin: /^ADMIN$/i,
};

const ROUTE_TTL_MS = 2000;
const RETRY_DELAYS_MS = [0, 60, 140, 300, 700, 1200];

function normalise(intent: SettingsRouteIntent): NormalisedIntent {
  // Accept legacy aliases ('apps' → 'application-history', 'user' → 'personal').
  let sub = intent.subtab ?? '';
  if ((sub as string) === 'apps') sub = 'application-history';
  if ((sub as string) === 'user') sub = 'personal';
  return {
    tier: intent.tier ?? 'standard',
    subtab: sub as NormalisedIntent['subtab'],
    source: intent.source ?? 'react-islands',
    ts: intent.ts ?? Date.now(),
  };
}

function clickByText(root: Element, re: RegExp): boolean {
  const buttons = Array.from(root.querySelectorAll('button,[role="button"],a'));
  for (const b of buttons) {
    if (!isElementVisible(b)) continue;
    const txt = (b.textContent ?? '').replace(/[ \t\n\r]+/g, ' ').trim();
    if (re.test(txt)) {
      try { (b as HTMLElement).click(); return true; } catch { /* */ }
    }
  }
  return false;
}

function applyIntent(intent: NormalisedIntent): boolean {
  const root = findSettingsRoot();
  if (!root) return false;
  const st = getTabState(root);
  if (st.top !== intent.tier) {
    clickByText(root, TIER_REGEX[intent.tier]);
  }
  if (intent.subtab) {
    // After the tier click the DOM may not have updated yet; allow the next
    // RAF to re-query the root before sub-tab click.
    requestAnimationFrame(() => {
      const r2 = findSettingsRoot() ?? root;
      clickByText(r2, SUBTAB_REGEX[intent.subtab as SettingsSubtab]);
    });
  }
  return true;
}

export interface ModalNavApi {
  intent: NormalisedIntent | null;
  openSettings: (intent?: SettingsRouteIntent) => void;
  clearIntent: () => void;
}

export function useModalNav(): ModalNavApi {
  const [intent, setIntent] = useState<NormalisedIntent | null>(null);
  const timeoutsRef = useRef<number[]>([]);

  const clearIntent = useCallback(() => {
    setIntent(null);
    try { sessionStorage.removeItem('antcv:settings-route'); } catch { /* */ }
  }, []);

  const openSettings = useCallback((next?: SettingsRouteIntent) => {
    const n = normalise(next ?? {});
    try {
      sessionStorage.setItem('antcv:settings-route', JSON.stringify(n));
      localStorage.setItem('settingsTab', n.tier === 'advanced' ? 'advanced' : 'standard');
      if (n.subtab) localStorage.setItem('settingsSubTab', n.subtab);
    } catch { /* */ }
    setIntent(n);

    // Defer to app.js's existing modal open call. Some sidecars (and app.js
    // itself) read the sessionStorage intent on next render.
    try {
      const openFn = (window as unknown as { _antcvOpenSettings?: () => void })._antcvOpenSettings;
      if (typeof openFn === 'function') openFn();
    } catch (e) {
      console.warn('[useModalNav] _antcvOpenSettings call failed', e);
    }
  }, []);

  // Drive the retry cascade off the intent state.
  useEffect(() => {
    if (!intent) return;

    // Bail if the intent is older than the TTL.
    if (Date.now() - intent.ts > ROUTE_TTL_MS) {
      clearIntent();
      return;
    }

    const timeouts: number[] = [];
    for (const delay of RETRY_DELAYS_MS) {
      const id = window.setTimeout(() => {
        try { applyIntent(intent); } catch (e) {
          console.warn('[useModalNav] applyIntent failed', e);
        }
      }, delay);
      timeouts.push(id);
    }
    // Final clear after TTL.
    const clearId = window.setTimeout(() => {
      // Compare to current intent — don't clear a newer one.
      setIntent((cur) => (cur && cur.ts === intent.ts ? null : cur));
    }, ROUTE_TTL_MS + 100);
    timeouts.push(clearId);
    timeoutsRef.current = timeouts;

    return () => {
      timeoutsRef.current.forEach((id) => clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, [intent, clearIntent]);

  return { intent, openSettings, clearIntent };
}
