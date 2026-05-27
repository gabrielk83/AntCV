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

declare global {
  interface Window {
    AntcvObservability?: {
      version: string;
      readBuffer: () => readonly ObservabilityEntry[];
      clearBuffer: () => void;
      setVerbose: (on: boolean) => void;
      isVerbose: () => boolean;
    };
  }
}

export function exposeObservabilityApi(): void {
  window.AntcvObservability = {
    version: '1.50.5',
    readBuffer,
    clearBuffer,
    setVerbose: (on: boolean) => {
      try { localStorage.setItem('antcv:observability-verbose', on ? '1' : '0'); } catch { /* */ }
    },
    isVerbose: readVerboseFlag,
  };
}
