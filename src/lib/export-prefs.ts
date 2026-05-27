// export-prefs.ts — read/write helpers for personalInfo.exportPrefs.
//
// v1.50.4 introduces a small per-user export preferences object that
// captures choices the worker's writing-style engine needs to know about
// but that don't fit on personalInfo.writingPrefs or .layoutPrefs:
//
//   { ats: boolean,           // request ATS-safe generation + glyph convert
//     legacyAtsTier: boolean   // force Calibri body (legacy parsers)
//   }
//
// install-fetch-wrap.ts reads these on each outgoing LLM POST and puts
// them in the _antcv_writing_style payload that the worker parses.

export interface ExportPrefs {
  ats: boolean;
  legacyAtsTier: boolean;
}

interface PersonalInfoBlob {
  exportPrefs?: Partial<ExportPrefs>;
}

const DEFAULT: ExportPrefs = { ats: false, legacyAtsTier: false };

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

export function readExportPrefs(): ExportPrefs {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const e = pi.exportPrefs ?? {};
  return {
    ats: e.ats === true,
    legacyAtsTier: e.legacyAtsTier === true,
  };
}

export function writeExportPrefs(patch: Partial<ExportPrefs>): ExportPrefs {
  const pi = readJSON<PersonalInfoBlob>('personalInfo') ?? {};
  const prev = readExportPrefs();
  const merged: ExportPrefs = { ...prev, ...patch };
  pi.exportPrefs = merged;
  writeJSON('personalInfo', pi);
  try {
    window.dispatchEvent(new CustomEvent('antcv:export-prefs-changed', { detail: merged }));
  } catch { /* */ }
  return merged;
}

export function defaultExportPrefs(): ExportPrefs {
  return { ...DEFAULT };
}
