import { useEffect } from 'react';
import { useModalNav, type SettingsRouteIntent } from './useModalNav';

// Headless component — exposes the modal-nav API on window so callers
// outside the React bundle (other sidecars, app.js) can request routes.
// Replaces the routeSettings / forceRoute / openAppHistorySettings trio
// from pwa/antcv-stability-core-334.js.
//
// Notably this does NOT call raiseSettings() — the z-index ramp introduced
// in stability-core is removed at Pass 1. Modal stacking relies on the
// canonical --z-overlay-max value (see §8.7 modal stacking test).

declare global {
  interface Window {
    _antcvOpenSettingsRoute?: (intent: SettingsRouteIntent) => void;
    AntcvReactSettingsRouter?: {
      version: string;
      openSettings: (intent?: SettingsRouteIntent) => void;
    };
  }
}

const VERSION = '1.50.0-pass1';

export function SettingsRouter(): null {
  const nav = useModalNav();

  useEffect(() => {
    // Preserve the existing API surface so callers in antcv-settings-front-327.js
    // and elsewhere keep working. The legacy stability-core implementation
    // (if loaded) used to set this same symbol; if it set it AFTER us, our
    // hook is replaced — that is OK during the transition because either
    // implementation behaves equivalently. After Pass 1 cleanup deletes
    // stability-core, our hook is the sole writer.
    const prev = window._antcvOpenSettingsRoute;
    window._antcvOpenSettingsRoute = (intent: SettingsRouteIntent) => nav.openSettings(intent);
    window.AntcvReactSettingsRouter = {
      version: VERSION,
      openSettings: (intent?: SettingsRouteIntent) => nav.openSettings(intent),
    };

    // Also re-fire when an in-flight route is found in sessionStorage on mount
    // (handles the case where a caller stored the intent before the bundle
    // booted).
    try {
      const stored = sessionStorage.getItem('antcv:settings-route');
      if (stored) {
        const parsed = JSON.parse(stored) as SettingsRouteIntent & { at?: number };
        const at = parsed.ts ?? parsed.at ?? 0;
        if (at && Date.now() - at < 2000) nav.openSettings(parsed);
      }
    } catch { /* */ }

    return () => {
      if (window._antcvOpenSettingsRoute && window._antcvOpenSettingsRoute === window._antcvOpenSettingsRoute) {
        // Restore prior implementation so we don't strand callers if React unmounts.
        window._antcvOpenSettingsRoute = prev;
      }
    };
  }, [nav]);

  return null;
}
