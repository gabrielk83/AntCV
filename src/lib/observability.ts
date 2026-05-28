// observability.ts — circular buffer + CustomEvent dispatch for the
// X-AntCV-* response headers the proxy worker attaches to writing-style
// generations.
//
// The headers themselves are set by:
//   - v1.50.1: X-AntCV-Writing-Style, X-AntCV-Target-Language,
//     X-AntCV-Tone-Chips, X-AntCV-Task (X-AntCV-Task was pre-existing).
//   - v1.50.2: X-AntCV-Sce-Banned-Words, X-AntCV-Sce-Banned-Phrases,
//     X-AntCV-Sce-Clean, X-AntCV-Ats-Applied.
//   - v1.50.3: X-AntCV-Sce-Attempts, X-AntCV-Flagged.
//
// install-fetch-wrap.ts wraps the response side and feeds each
// observed proxy response into recordEntry(). Anything that wants to
// surface these — console, dispatcher breadcrumbs, future SCE-violation
// dashboard — reads from window.AntcvObservability or subscribes to
// the 'antcv:writing-engine-response' CustomEvent.

export interface ObservabilityEntry {
  ts: number;                       // ms-epoch when the response landed
  url: string;                      // request URL (origin + pathname; query stripped)
  status: number;
  task: string | null;              // X-AntCV-Task
  writingStyle: string | null;      // X-AntCV-Writing-Style
  targetLanguage: string | null;    // X-AntCV-Target-Language
  toneChips: string[];              // X-AntCV-Tone-Chips comma-split
  sceBannedWords: number;           // 0 when header absent or non-numeric
  sceBannedPhrases: number;
  sceClean: boolean | null;         // null when header absent
  sceAttempts: number | null;       // 1, 2, 3 — null when header absent
  flagged: boolean;                 // X-AntCV-Flagged === '1'
  atsApplied: boolean;              // X-AntCV-Ats-Applied === '1'
  sanitizedPatterns: number;        // X-AntCV-Sanitized-Patterns (injection defense)
}

const BUFFER_LIMIT = 50;
const buffer: ObservabilityEntry[] = [];

function readHeaderInt(headers: Headers, name: string): number {
  const raw = headers.get(name);
  if (raw == null) return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function readHeaderBool(headers: Headers, name: string): boolean {
  return headers.get(name) === '1';
}

function readHeaderString(headers: Headers, name: string): string | null {
  const v = headers.get(name);
  return v == null || v === '' ? null : v;
}

function readHeaderClean(headers: Headers): boolean | null {
  const v = headers.get('X-AntCV-Sce-Clean');
  if (v == null) return null;
  return v === '1';
}

function readHeaderAttempts(headers: Headers): number | null {
  const v = headers.get('X-AntCV-Sce-Attempts');
  if (v == null) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function readHeaderToneChips(headers: Headers): string[] {
  const v = headers.get('X-AntCV-Tone-Chips');
  if (!v) return [];
  return v.split(',').map((x) => x.trim()).filter(Boolean);
}

function shortUrl(input: RequestInfo | URL): string {
  try {
    let url: URL;
    if (input instanceof URL) url = input;
    else if (input instanceof Request) url = new URL(input.url);
    else url = new URL(String(input), window.location.href);
    return url.origin + url.pathname;
  } catch {
    return String(input);
  }
}

/**
 * Has any of the writing-engine response headers we care about. We use
 * this to decide whether to record the response in the buffer; non-
 * writing-engine responses (PWA shell GETs, static assets, etc.) are
 * silently ignored.
 */
export function hasWritingEngineHeaders(headers: Headers): boolean {
  return (
    headers.has('X-AntCV-Writing-Style') ||
    headers.has('X-AntCV-Sce-Clean') ||
    headers.has('X-AntCV-Sce-Attempts') ||
    headers.has('X-AntCV-Task')
  );
}

export function entryFromResponse(input: RequestInfo | URL, res: Response): ObservabilityEntry {
  const h = res.headers;
  return {
    ts: Date.now(),
    url: shortUrl(input),
    status: res.status,
    task: readHeaderString(h, 'X-AntCV-Task'),
    writingStyle: readHeaderString(h, 'X-AntCV-Writing-Style'),
    targetLanguage: readHeaderString(h, 'X-AntCV-Target-Language'),
    toneChips: readHeaderToneChips(h),
    sceBannedWords: readHeaderInt(h, 'X-AntCV-Sce-Banned-Words'),
    sceBannedPhrases: readHeaderInt(h, 'X-AntCV-Sce-Banned-Phrases'),
    sceClean: readHeaderClean(h),
    sceAttempts: readHeaderAttempts(h),
    flagged: readHeaderBool(h, 'X-AntCV-Flagged'),
    atsApplied: readHeaderBool(h, 'X-AntCV-Ats-Applied'),
    sanitizedPatterns: readHeaderInt(h, 'X-AntCV-Sanitized-Patterns'),
  };
}

export function recordEntry(entry: ObservabilityEntry, opts: { verbose?: boolean } = {}): void {
  buffer.push(entry);
  if (buffer.length > BUFFER_LIMIT) buffer.shift();

  // CustomEvent so app.js (and future dashboards) can subscribe without
  // polling the buffer.
  try {
    window.dispatchEvent(new CustomEvent('antcv:writing-engine-response', { detail: entry }));
  } catch { /* */ }

  if (opts.verbose || readVerboseFlag()) {
    try {
      const parts: string[] = [];
      if (entry.writingStyle) parts.push(`style=${entry.writingStyle}`);
      if (entry.targetLanguage) parts.push(`lang=${entry.targetLanguage}`);
      if (entry.toneChips.length) parts.push(`chips=[${entry.toneChips.join(',')}]`);
      if (entry.sceAttempts != null) parts.push(`sceAttempts=${entry.sceAttempts}`);
      if (entry.sceClean != null) parts.push(`sceClean=${entry.sceClean ? 'yes' : 'NO'}`);
      if (entry.sceBannedWords > 0) parts.push(`bannedW=${entry.sceBannedWords}`);
      if (entry.sceBannedPhrases > 0) parts.push(`bannedP=${entry.sceBannedPhrases}`);
      if (entry.flagged) parts.push('FLAGGED');
      if (entry.atsApplied) parts.push('ATS-applied');
      if (entry.task) parts.push(`task=${entry.task}`);
      const head = `[antcv-observability] ${entry.url} (${entry.status})`;
      console.info(parts.length ? `${head} ${parts.join(' · ')}` : head);
    } catch { /* */ }
  }
}

function readVerboseFlag(): boolean {
  try {
    const v = localStorage.getItem('antcv:observability-verbose');
    return v === '1' || v === 'true';
  } catch { return false; }
}

export function readBuffer(): readonly ObservabilityEntry[] {
  return buffer.slice();
}

export function clearBuffer(): void {
  buffer.length = 0;
}

/**
 * v1.50.24 — build a self-contained diagnostic snapshot that's safe to
 * share in bug reports. Includes the response-header buffer, build
 * version stamps from window globals, and the user's current
 * writing-engine preferences (style id + chip list — but NOT the
 * banned-word lists or extraConstraints, because those can contain
 * names of people, companies, or other PII).
 */
export interface ObservabilitySnapshot {
  v: '1';                            // snapshot format version
  generatedAt: string;               // ISO timestamp
  antcvVersion: string | null;       // window.ANTCV_VERSION
  islandsVersion: string | null;     // window.__antcvReactIslandsBooted
  userAgent: string;
  language: string | null;           // navigator.language
  url: string;                       // location.origin + pathname
  entries: ObservabilityEntry[];     // the full circular buffer
  prefs: {
    writingStyle: string | null;
    toneChips: string[];
    targetPages: number | null;
    activePackage: string | null;
    legacyAtsTier: boolean;
  };
}

function readPiPath<T>(getter: (pi: Record<string, unknown>) => T): T | null {
  try {
    const raw = localStorage.getItem('personalInfo');
    if (!raw) return null;
    const pi = JSON.parse(raw) as Record<string, unknown>;
    return getter(pi);
  } catch {
    return null;
  }
}

function buildPrefsSnapshot(): ObservabilitySnapshot['prefs'] {
  const writingStyle = readPiPath((pi) => {
    const wp = pi.writingPrefs as Record<string, unknown> | undefined;
    const v = wp && typeof wp.style === 'string' ? wp.style : null;
    return v;
  });
  const toneChips = readPiPath((pi) => {
    const wp = pi.writingPrefs as Record<string, unknown> | undefined;
    const v = wp && Array.isArray(wp.chips)
      ? wp.chips.filter((c): c is string => typeof c === 'string')
      : [];
    return v;
  }) ?? [];
  const targetPages = readPiPath((pi) => {
    const lp = pi.layoutPrefs as Record<string, unknown> | undefined;
    const v = lp && typeof lp.targetPages === 'number' ? lp.targetPages : null;
    return v;
  });
  const activePackage = readPiPath((pi) => {
    return typeof pi.stylePackage === 'string' ? pi.stylePackage : null;
  });
  const legacyAtsTier = readPiPath((pi) => {
    const ep = pi.exportPrefs as Record<string, unknown> | undefined;
    return !!(ep && ep.legacyAtsTier === true);
  }) ?? false;
  return { writingStyle, toneChips, targetPages, activePackage, legacyAtsTier };
}

export function buildSnapshot(): ObservabilitySnapshot {
  return {
    v: '1',
    generatedAt: new Date().toISOString(),
    antcvVersion: typeof window !== 'undefined' && typeof window.ANTCV_VERSION === 'string'
      ? window.ANTCV_VERSION
      : null,
    islandsVersion: typeof window !== 'undefined' && typeof window.__antcvReactIslandsBooted === 'string'
      ? window.__antcvReactIslandsBooted
      : null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    language: typeof navigator !== 'undefined' ? navigator.language : null,
    url: typeof location !== 'undefined' ? location.origin + location.pathname : '',
    entries: readBuffer().slice(),
    prefs: buildPrefsSnapshot(),
  };
}

/**
 * Copy the snapshot as pretty-printed JSON to the clipboard. Returns
 * a Promise that resolves true on success, false on failure (e.g.
 * Permissions API rejected, no Clipboard API available).
 */
export async function copySnapshot(): Promise<boolean> {
  const json = JSON.stringify(buildSnapshot(), null, 2);
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(json);
      return true;
    }
  } catch { /* fall through to legacy path */ }
  // Legacy fallback for browsers without Clipboard API (or when the
  // page is not focused, which can reject writeText).
  try {
    const ta = document.createElement('textarea');
    ta.value = json;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Trigger a browser download of the snapshot as a .json file.
 * Filename includes the ISO timestamp so multiple snapshots don't
 * collide.
 */
export function downloadSnapshot(): void {
  try {
    const json = JSON.stringify(buildSnapshot(), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `antcv-observability-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    try { console.warn('[antcv-observability] downloadSnapshot failed', e); } catch { /* */ }
  }
}

declare global {
  interface Window {
    ANTCV_VERSION?: string;
    AntcvObservability?: {
      version: string;
      readBuffer: () => readonly ObservabilityEntry[];
      clearBuffer: () => void;
      setVerbose: (on: boolean) => void;
      isVerbose: () => boolean;
      // v1.50.24 — diagnostic-snapshot helpers
      buildSnapshot: () => ObservabilitySnapshot;
      copySnapshot: () => Promise<boolean>;
      downloadSnapshot: () => void;
    };
  }
}

export function exposeObservabilityApi(): void {
  window.AntcvObservability = {
    version: '1.50.24',
    readBuffer,
    clearBuffer,
    setVerbose: (on: boolean) => {
      try { localStorage.setItem('antcv:observability-verbose', on ? '1' : '0'); } catch { /* */ }
    },
    isVerbose: readVerboseFlag,
    buildSnapshot,
    copySnapshot,
    downloadSnapshot,
  };
}
