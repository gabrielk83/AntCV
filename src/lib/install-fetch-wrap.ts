// install-fetch-wrap.ts — outermost fetch wrap that injects
// `_antcv_writing_style` into outgoing LLM-shaped requests.
//
// Installed in main.tsx via installWritingStyleFetchWrap(). Runs AFTER
// every other defer-loaded sidecar's wrap, so this wrap sits OUTERMOST
// (last installed = first executed for the outgoing direction). That
// means body modifications here survive every existing wrapper's
// processing and land in the upstream worker's body untouched.
//
// Detection: any POST whose body parses as JSON and contains a
// `messages` array or a top-level `system` string is treated as an
// LLM-shaped call. Non-LLM POSTs (cloud sync, kernel extraction) parse
// but lack those fields, and our injection skips them. The worker side
// reads `_antcv_writing_style` and strips it before forwarding to the
// upstream LLM provider — see workers/proxy/src/index.js.
//
// The values injected come from personalInfo.writingPrefs +
// personalInfo.layoutPrefs (written by WritingStylePicker in
// src/islands/WritingStylePicker/). When neither is populated yet, we
// still inject defaults so the worker can build a coherent style
// preamble — defaults match the Gabriel-migration first-run values.

import { readLayoutPrefs, readWritingPrefs } from './writing-prefs';
import { normaliseLangCode } from './writing-systems';
import { readExportPrefs } from './export-prefs';
import { entryFromResponse, hasWritingEngineHeaders, recordEntry } from './observability';

interface AntcvWritingStylePayload {
  writingStyle: string;
  toneChips: string[];
  extraBannedWords: Record<string, string[]>;
  extraBannedPhrases: Record<string, string[]>;
  extraConstraints: unknown[];
  targetPages: number;
  sectionFormat: string;
  target_language: string;
  package: string;
  ats: boolean;
}

interface PersonalInfoBlob {
  stylePackage?: unknown;
  topLanguage?: unknown;
  target_language?: unknown;
}

function readActivePackageId(): string {
  try {
    const pi = JSON.parse(localStorage.getItem('personalInfo') ?? '{}') as PersonalInfoBlob;
    const v = pi.stylePackage;
    return typeof v === 'string' && v ? v : 'copenhagen-modern';
  } catch {
    return 'copenhagen-modern';
  }
}

function readActiveLanguage(): string {
  try {
    // Preferred sources for the language the user is currently composing in.
    const pi = JSON.parse(localStorage.getItem('personalInfo') ?? '{}') as PersonalInfoBlob;
    const candidates: unknown[] = [
      localStorage.getItem('antcv:editor-language')?.replace(/"/g, ''),
      pi.target_language,
      pi.topLanguage,
      JSON.parse(localStorage.getItem('antcv:enabledLanguages') ?? '[]')[0],
      'en',
    ];
    for (const c of candidates) {
      if (typeof c === 'string' && c) return normaliseLangCode(c);
    }
    return 'en';
  } catch {
    return 'en';
  }
}

function buildWritingStylePayload(): AntcvWritingStylePayload {
  const wp = readWritingPrefs();
  const lp = readLayoutPrefs();
  const ep = readExportPrefs();
  return {
    writingStyle: wp.style,
    toneChips: wp.chips,
    extraBannedWords: wp.extraBannedWords,
    extraBannedPhrases: wp.extraBannedPhrases,
    extraConstraints: wp.extraConstraints,
    targetPages: lp.targetPages,
    sectionFormat: 'default', // Per-section override is wired in Pass 4 (editor line sliders).
    target_language: readActiveLanguage(),
    package: readActivePackageId(),
    ats: ep.ats,
  };
}

function isLlmShapedBody(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;
  return (
    Array.isArray(obj.messages) ||
    typeof obj.system === 'string' ||
    Array.isArray(obj.contents) ||
    !!obj.systemInstruction
  );
}

async function readBodyAsText(input: BodyInit | null | undefined): Promise<string | null> {
  if (input == null) return null;
  if (typeof input === 'string') return input;
  if (input instanceof Blob) {
    try { return await input.text(); } catch { return null; }
  }
  if (input instanceof ArrayBuffer) {
    try { return new TextDecoder().decode(input); } catch { return null; }
  }
  if (ArrayBuffer.isView(input)) {
    try { return new TextDecoder().decode(input as ArrayBufferView); } catch { return null; }
  }
  if (typeof FormData !== 'undefined' && input instanceof FormData) {
    return null; // multipart — leave alone
  }
  if (typeof URLSearchParams !== 'undefined' && input instanceof URLSearchParams) {
    return null;
  }
  return null;
}

interface MarkedFetch { __antcvWritingStyleFetchWrap?: true }

let installed = false;

/**
 * Installs the outgoing-body injection wrap. Idempotent — safe to call
 * multiple times. Returns true if a wrap was installed this call.
 */
export function installWritingStyleFetchWrap(): boolean {
  if (installed) return false;
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') return false;
  const existing = window.fetch as typeof fetch & MarkedFetch;
  if (existing.__antcvWritingStyleFetchWrap) {
    installed = true;
    return false;
  }

  const inner = existing.bind(window);

  // Observability tap — record any response that carries our X-AntCV-*
  // headers. Used by both the modified-body path (POSTs) and the
  // passthrough path so we never miss a proxy response.
  const tapResponse = async (input: RequestInfo | URL, p: Promise<Response>): Promise<Response> => {
    let res: Response;
    try { res = await p; } catch (e) { throw e; }
    try {
      if (hasWritingEngineHeaders(res.headers)) {
        recordEntry(entryFromResponse(input, res));
      }
    } catch (e) {
      // Observability must never break the response.
      try { console.warn('[antcv-observability] recordEntry failed', e); } catch { /* */ }
    }
    return res;
  };

  const wrapped: typeof fetch & MarkedFetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    try {
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (method !== 'POST') return tapResponse(input, inner(input as RequestInfo, init));

      // Pull the body text we can read non-destructively.
      let bodySource: BodyInit | null | undefined;
      if (init && init.body !== undefined) {
        bodySource = init.body as BodyInit | null;
      } else if (input instanceof Request) {
        try { bodySource = await input.clone().text(); } catch { bodySource = null; }
      } else {
        bodySource = null;
      }

      const text = await readBodyAsText(bodySource ?? null);
      if (!text) return tapResponse(input, inner(input as RequestInfo, init));

      let parsed: unknown;
      try { parsed = JSON.parse(text); }
      catch { return tapResponse(input, inner(input as RequestInfo, init)); }

      if (!isLlmShapedBody(parsed)) return tapResponse(input, inner(input as RequestInfo, init));
      const obj = parsed as Record<string, unknown>;
      if (obj._antcv_writing_style) {
        // Already injected — pass through unchanged but still tap.
        return tapResponse(input, inner(input as RequestInfo, init));
      }

      obj._antcv_writing_style = buildWritingStylePayload();
      const newBody = JSON.stringify(obj);

      if (input instanceof Request) {
        const newReq = new Request(input, { body: newBody });
        return tapResponse(input, inner(newReq, init));
      }
      const newInit: RequestInit = { ...(init ?? {}), body: newBody };
      return tapResponse(input, inner(input as RequestInfo, newInit));
    } catch (e) {
      // Wrap must never break the underlying fetch — log and pass through.
      console.warn('[writing-style-fetch-wrap] failed', e);
      return inner(input as RequestInfo, init);
    }
  };
  wrapped.__antcvWritingStyleFetchWrap = true;
  window.fetch = wrapped;
  installed = true;
  return true;
}

export function isWritingStyleFetchWrapInstalled(): boolean {
  return installed;
}
