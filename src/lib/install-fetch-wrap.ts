// install-fetch-wrap.ts — outermost fetch wrap that injects writing-style
// + c2pa visual-disclosure context into outgoing requests.
//
// Installed in main.tsx via installWritingStyleFetchWrap(). Runs AFTER
// every other defer-loaded sidecar's wrap, so this wrap sits OUTERMOST
// (last installed = first executed for the outgoing direction). That
// means body modifications here survive every existing wrapper's
// processing and land in the upstream worker's body untouched.
//
// Two injection paths:
//
//   1. LLM-shaped POSTs — body has `messages` / `system` / `contents` /
//      `systemInstruction`. We add a top-level `_antcv_writing_style`
//      field carrying the active writing style, chips, banned lists,
//      target language, package, and ATS flag. The proxy worker reads
//      it, prepends a §4.7 system preamble, then deletes the field
//      before forwarding upstream. See workers/proxy/src/index.js.
//
//   2. C2PA-shaped POSTs (v1.50.10) — body has `asset_base64` +
//      `asset_kind` (the c2pa SignRequest signature). We add a top-
//      level `visual: { package, package_base_color }` field carrying
//      the active package id + its `base` hex. The c2pa worker embeds
//      these in the `com.antcv.ai_disclosure.visual` assertion of the
//      C2PA manifest. See workers/c2pa-worker/src/index.ts.
//
// Non-LLM, non-c2pa POSTs (cloud sync, kernel extraction, etc.) parse
// but match neither detector and pass through untouched.

import { readLayoutPrefs, readWritingPrefs } from './writing-prefs';
import { normaliseLangCode } from './writing-systems';
import { readExportPrefs } from './export-prefs';
import { entryFromResponse, hasWritingEngineHeaders, recordEntry } from './observability';
import { PACKAGES, normalisePackageId, type PackageId } from './packages';

interface AntcvWritingStylePayload {
  writingStyle: string;
  toneChips: string[];
  extraBannedWords: Record<string, string[]>;
  extraBannedPhrases: Record<string, string[]>;
  extraConstraints: unknown[];
  targetPages: number;
  sectionFormat: string;
  /** v1.50.14 — per-section overrides from the LayoutPicker. */
  sectionFormats: Record<string, string>;
  /** v1.50.14 — per-section line-limit hints from the LayoutPicker. */
  sectionLineLimits: Record<string, number>;
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
    // v1.50.14 — `sectionFormat` is the legacy single-section field kept
    // for backward compat with older workers. New behaviour reads the
    // sectionFormats / sectionLineLimits maps below.
    sectionFormat: 'default',
    sectionFormats: { ...(lp.sectionFormats ?? {}) },
    sectionLineLimits: { ...(lp.lineLimits ?? {}) },
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

/**
 * v1.50.10 — detect c2pa-worker /sign payloads. The worker's SignRequest
 * (workers/c2pa-worker/src/index.ts) requires `asset_base64` + `asset_kind`
 * — checking those two is enough to recognise the shape without false
 * positives against any other POST.
 */
function isC2paShapedBody(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const obj = payload as Record<string, unknown>;
  return (
    typeof obj.asset_base64 === 'string' &&
    typeof obj.asset_kind === 'string'
  );
}

interface AntcvC2paVisualPayload {
  package: PackageId;
  package_base_color: string;
}

/**
 * Build the `visual` field for an outgoing c2pa /sign POST. Reads the
 * active package id from personalInfo.stylePackage (via the shared
 * normaliser) and looks up its locked `base` hex from packages/registry.json
 * (via src/lib/packages.ts).
 */
function buildC2paVisualPayload(): AntcvC2paVisualPayload {
  const id = normalisePackageId(readActivePackageId());
  return {
    package: id,
    package_base_color: PACKAGES[id].base,
  };
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

      const obj = parsed as Record<string, unknown>;

      // Path 1 — LLM-shaped POST: inject writing-style context.
      if (isLlmShapedBody(obj)) {
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
      }

      // Path 2 — C2PA-shaped POST: inject visual context (v1.50.10).
      if (isC2paShapedBody(obj)) {
        if (obj.visual && typeof obj.visual === 'object') {
          // Caller already supplied visual context — don't overwrite.
          return tapResponse(input, inner(input as RequestInfo, init));
        }
        obj.visual = buildC2paVisualPayload();
        const newBody = JSON.stringify(obj);
        if (input instanceof Request) {
          const newReq = new Request(input, { body: newBody });
          return tapResponse(input, inner(newReq, init));
        }
        const newInit: RequestInit = { ...(init ?? {}), body: newBody };
        return tapResponse(input, inner(input as RequestInfo, newInit));
      }

      // Neither shape — pass through.
      return tapResponse(input, inner(input as RequestInfo, init));
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
