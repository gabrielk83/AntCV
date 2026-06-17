// Enabled-languages preferences — read / write / event-dispatch helpers.
//
// This is a faithful port of the equivalent helpers in
// pwa/antcv-stability-core-334.js (lines 82-110) so every other sidecar that
// listens for changes — antcv-language-prefs.js, antcv-lang-bar-filter.js,
// antcv-i18n.js — keeps working without modification.

// SPELLERS-MATRIX-001 (owner 2026-06-17): the full available-language set for
// the selector. The first four (en/da/es/zh) are the original set; the rest
// were added so every language the owner listed is selectable AND gets the
// matching spelling dictionary (see LanguageCard SPELL_UI + the spell engine's
// SPELL map). Generation output language follows the DEFAULT (first) language.
export type LangCode =
  | 'en' | 'da' | 'es' | 'zh'
  | 'fr' | 'de' | 'it' | 'ar' | 'fa' | 'he'
  | 'ru' | 'tr' | 'ku' | 'sw' | 'am'
  | 'fo' | 'kl' | 'vi' | 'th' | 'zu'
  | 'sv' | 'no' | 'fi';

export interface LangOption {
  code: LangCode;
  label: string;
}

export const LANGS: readonly LangOption[] = [
  { code: 'en', label: 'English' },
  { code: 'da', label: 'Danish' },
  { code: 'sv', label: 'Swedish' },
  { code: 'no', label: 'Norwegian' },
  { code: 'fi', label: 'Finnish' },
  { code: 'es', label: 'Spanish' },
  { code: 'zh', label: 'Chinese' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'ar', label: 'Arabic' },
  { code: 'fa', label: 'Farsi' },
  { code: 'he', label: 'Hebrew' },
  { code: 'ru', label: 'Russian' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ku', label: 'Kurdish' },
  { code: 'sw', label: 'Swahili' },
  { code: 'zu', label: 'Zulu' },
  { code: 'am', label: 'Amharic' },
  { code: 'fo', label: 'Faroese' },
  { code: 'kl', label: 'Greenlandic' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
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
