// Enabled-languages preferences — read / write / event-dispatch helpers.
//
// This is a faithful port of the equivalent helpers in
// pwa/antcv-stability-core-334.js (lines 82-110) so every other sidecar that
// listens for changes — antcv-language-prefs.js, antcv-lang-bar-filter.js,
// antcv-i18n.js — keeps working without modification.

export type LangCode = 'en' | 'da' | 'es' | 'zh';

export interface LangOption {
  code: LangCode;
  label: string;
}

export const LANGS: readonly LangOption[] = [
  { code: 'en', label: 'English' },
  { code: 'da', label: 'Danish' },
  { code: 'es', label: 'Spanish' },
  { code: 'zh', label: 'Chinese' },
];

// Matches DEFAULT_LANGS in antcv-stability-core-334.js v1.40.339.
export const DEFAULT_LANGS: readonly LangCode[] = ['en', 'da'];

export const LANG_OPEN_KEY = 'antcv:settings:languages-expanded';

const ALLOWED = new Set<string>(LANGS.map((l) => l.code));

function readJSON<T = unknown>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function validLangs(arr: unknown): LangCode[] {
  const list = Array.isArray(arr) ? arr : [];
  const cleaned = list
    .map((x) => String(x ?? '').trim().toLowerCase())
    .filter((x): x is LangCode => ALLOWED.has(x));
  const deduped = Array.from(new Set(cleaned));
  return deduped.length ? deduped : DEFAULT_LANGS.slice();
}

interface PrefsShape { enabledLanguages?: unknown; visibleLanguages?: unknown }
interface PersonalInfoShape {
  stylePrefs?: { visibleLanguages?: unknown; enabledLanguages?: unknown; languageBar?: unknown };
}

export function readEnabledLangs(): LangCode[] {
  const prefs = readJSON<PrefsShape>('antcv:prefs') ?? {};
  const pi = readJSON<PersonalInfoShape>('personalInfo') ?? {};
  const sp = pi.stylePrefs ?? {};
  return validLangs(
    readJSON('enabledLanguages') ||
      readJSON('antcv:enabledLanguages') ||
      prefs.enabledLanguages ||
      sp.visibleLanguages ||
      sp.enabledLanguages,
  );
}

interface AntcvLanguagePrefsDefaults { save?: (next: LangCode[]) => void }
interface AntcvLanguagePrefs { set?: (next: LangCode[]) => void }
interface AntcvLangBarFilter { _applyAll?: () => void }

declare global {
  interface Window {
    AntcvLanguagePrefsDefaults?: AntcvLanguagePrefsDefaults;
    AntcvLanguagePrefs?: AntcvLanguagePrefs;
    AntcvLangBarFilter?: AntcvLangBarFilter;
  }
}

export function writeEnabledLangs(arr: unknown): LangCode[] {
  const next = validLangs(arr);
  const raw = JSON.stringify(next);

  // Mirror writes — every key that antcv-stability-core-334.js wrote.
  try { localStorage.setItem('enabledLanguages', raw); } catch { /* */ }
  try { localStorage.setItem('antcv:enabledLanguages', raw); } catch { /* */ }
  try { localStorage.setItem('antcv:visibleLanguages', raw); } catch { /* */ }
  try {
    const p = readJSON<PrefsShape>('antcv:prefs') ?? {};
    p.enabledLanguages = next;
    p.visibleLanguages = next;
    localStorage.setItem('antcv:prefs', JSON.stringify(p));
  } catch { /* */ }
  try {
    const pi = readJSON<PersonalInfoShape>('personalInfo') ?? {};
    pi.stylePrefs = pi.stylePrefs ?? {};
    pi.stylePrefs.visibleLanguages = next;
    pi.stylePrefs.enabledLanguages = next;
    pi.stylePrefs.languageBar = next;
    localStorage.setItem('personalInfo', JSON.stringify(pi));
  } catch { /* */ }

  try { window.AntcvLanguagePrefsDefaults?.save?.(next); } catch { /* */ }
  try { window.AntcvLanguagePrefs?.set?.(next); } catch { /* */ }

  try {
    window.dispatchEvent(new StorageEvent('storage', { key: 'enabledLanguages', newValue: raw }));
  } catch { /* */ }
  try {
    window.dispatchEvent(
      new CustomEvent('antcv:enabled-languages-changed', {
        detail: { enabledLanguages: next, visibleLanguages: next, scope: 'topbar-only' },
      }),
    );
  } catch { /* */ }
  try {
    window.dispatchEvent(
      new CustomEvent('antcv:language-prefs-changed', {
        detail: { enabledLanguages: next, visibleLanguages: next, scope: 'topbar-only' },
      }),
    );
  } catch { /* */ }

  try { window.AntcvLangBarFilter?._applyAll?.(); } catch { /* */ }

  return next;
}

export function readLangExpanded(): boolean {
  try {
    const v = localStorage.getItem(LANG_OPEN_KEY);
    if (v === null) return false; // default collapsed — per §5 hotfix item 1
    return v === '1' || v === 'true';
  } catch {
    return false;
  }
}

export function writeLangExpanded(v: boolean): void {
  try { localStorage.setItem(LANG_OPEN_KEY, v ? '1' : '0'); } catch { /* */ }
}
