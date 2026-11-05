// =================================================================
//  posting-guard.js — deterministic integrity gate for third-party
//  posting text (fetched JD pages, pasted JDs, user messages).
//
//  POSTING-GUARD-001 (2026-11-05). JS port of tools/posting_guard.py
//  from ai-job-search (https://github.com/ai-job-search-dev/ai-job-search),
//  plus the gaps its open issues report and the fixes its open PRs carry:
//    #766 / PR #767  URLs in href/src of hidden elements are reported
//                    (navigation chrome exempt)
//    #785            more hiding tricks (font-size <= 2px, off-screen
//                    -999px, clip-path inset(50%), scale(0), opacity
//                    below 0.1, visibility:collapse, closed <dialog>,
//                    low-contrast inline colours), more phrasings
//                    ("disregard prior guidance", "you are now a ... bot",
//                    digit-for-letter spellings), hidden blocks that hold
//                    salary or requirement wording are counted, classes
//                    hidden by the page's own <style> are counted (kept)
//    #798 / PR #801  empty input reports "no text", never "clean"
//
//  What it does:
//    * hidden HTML is removed before text extraction; its content is
//      scanned and counted, never passed on
//    * invisible characters (zero-width, bidi controls, soft hyphen,
//      BOM, Unicode tag characters, variation selectors) are removed;
//      the three UK subdivision flag emoji are kept whole
//    * text spelled in tag characters or variation-selector runs is
//      decoded and scanned like hidden content
//    * instruction-shaped lines and Latin/Cyrillic/Greek mixed-script
//      words are reported, never removed: a DevOps JD says "SSH"
//
//  It advises; it never blocks. Removal is the defence; the verdict
//  line is for the user.
//
//  Calibration against upstream, on purpose:
//    * script/style blocks are removed but not scanned: analytics URLs
//      and "process.env" in bundled JS raised alarms on clean pages
//    * a zero-width character counts as "inside a word" when the nearest
//      VISIBLE neighbours are letters, so a run of two still flags
//    * U+2028/U+2029 become "\n" instead of being deleted, so the words
//      on either side stay apart
//    * a duplicated attribute keeps its first value, as browsers do
//    * a single Greek letter on a short Latin unit (um, kOhm) is not a
//      mixed-script word; photonics JDs write "10 µm" with Greek mu
//
//  Mirror: workers/demo-proxy/src/posting-guard.js is byte-identical
//  (test/posting-guard.test.mjs checks).
//
//  Ported code: MIT License
//
//  Copyright (c) 2026 Mads Lorentzen
//
//  Permission is hereby granted, free of charge, to any person obtaining a copy
//  of this software and associated documentation files (the "Software"), to deal
//  in the Software without restriction, including without limitation the rights
//  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
//  copies of the Software, and to permit persons to whom the Software is
//  furnished to do so, subject to the following conditions:
//
//  The above copyright notice and this permission notice shall be included in all
//  copies or substantial portions of the Software.
//
//  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
//  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
//  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
//  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
//  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
//  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
//  SOFTWARE.
// =================================================================

const EXCERPT = 120;
const LINE_MAX = 200;

export const NO_TEXT_VERDICT = 'posting_guard: no text - nothing was gated';

// ─── Invisible characters ────────────────────────────────────────

const ZERO_WIDTH = new Set(['\u200B', '\u200C', '\u200D', '\u2060', '\u2061', '\u2062', '\u2063', '\u2064']);
const BIDI = new Set(['\u200E', '\u200F', '\u202A', '\u202B', '\u202C', '\u202D', '\u202E', '\u2066', '\u2067', '\u2068', '\u2069']);
const BIDI_TAMPER = new Set(['\u202D', '\u202E', '\u2066', '\u2067', '\u2068', '\u2069']); // overrides and isolates
const FORMAT = new Set(['\u00AD', '\u2028', '\u2029']); // soft hyphen, line/paragraph separators
const BOM = '\uFEFF';
// U+E0000-U+E007F: the Unicode "tags" block, one invisible code point per
// ASCII character. A payload written in it never renders and reads as the
// ASCII it mirrors to a model ("ASCII smuggling").
const isTag = (cp) => cp >= 0xE0000 && cp <= 0xE007F;
// Variation selectors pick a glyph variant and render as nothing on their own;
// a run of them carries one byte each. A lone one (the VS16 in a heart emoji)
// is encoding noise; a run is a payload.
const isVariation = (cp) => (cp >= 0xFE00 && cp <= 0xFE0F) || (cp >= 0xE0100 && cp <= 0xE01EF);
const ANY_INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2028\u2029\u2060-\u2064\u2066-\u2069\uFEFF\uFE00-\uFE0F\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;
const REMOVED = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF\uFE00-\uFE0F\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;
const TAG_RUN = /[\u{E0000}-\u{E007F}]+/gu;
const VARIATION_RUN = /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]{2,}/gu;
// The one legitimate use of tag characters: the England, Scotland and Wales
// flags. Matched in full and kept; anything else in the block counts and alarms.
const RGI_TAG_FLAG = /\u{1F3F4}\u{E0067}\u{E0062}(?:\u{E0065}\u{E006E}\u{E0067}|\u{E0073}\u{E0063}\u{E0074}|\u{E0077}\u{E006C}\u{E0073})\u{E007F}/gu;
const NONPRINTABLE = /[\p{Cc}\p{Cf}\p{Cs}\p{Co}\p{Cn}\p{Zl}\p{Zp}]|(?! )\p{Zs}/gu;
const LETTER = /\p{L}/u;

function isInvisibleCp(cp) {
  const ch = String.fromCodePoint(cp);
  return ZERO_WIDTH.has(ch) || BIDI.has(ch) || FORMAT.has(ch) || ch === BOM || isTag(cp) || isVariation(cp);
}

// Nearest visible code point from index i, walking in direction step (+1/-1).
function visibleNeighbour(text, i, step) {
  while (i >= 0 && i < text.length) {
    if (step < 0 && i > 0) {
      const lo = text.charCodeAt(i);
      if (lo >= 0xDC00 && lo <= 0xDFFF) i--; // land on the high surrogate
    }
    const cp = text.codePointAt(i);
    if (!isInvisibleCp(cp)) return String.fromCodePoint(cp);
    i += step > 0 ? (cp > 0xFFFF ? 2 : 1) : -1;
  }
  return '';
}

function decodeTagRun(run) {
  let s = '';
  for (const ch of run) {
    const c = ch.codePointAt(0) - 0xE0000;
    if (c >= 0x20 && c < 0x7F) s += String.fromCharCode(c);
  }
  return s.trim();
}

function decodeVariationRun(run) {
  const bytes = [];
  for (const ch of run) {
    const cp = ch.codePointAt(0);
    bytes.push(cp <= 0xFE0F ? cp - 0xFE00 : cp - 0xE0100 + 16);
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(bytes)).replace(NONPRINTABLE, '').trim();
}

const stripChars = (s) => s.replace(REMOVED, '').replace(/[\u2028\u2029]/g, '\n');

/**
 * Remove invisible characters; nothing else changes.
 *
 * @returns {{ text: string, removed: number, invisible_chars: object,
 *             invisible_flagged: number, invisible_text: string[] }}
 *   removed            characters removed or replaced (0 = text unchanged)
 *   invisible_chars    counts by category: zero_width, bidi, format, bom, tag, variation
 *   invisible_flagged  zero-width or BOM between two letters (a split word) and
 *                      any bidi override or isolate: tampering, not noise
 *   invisible_text     what tag-character and variation-selector runs spell
 */
export function stripInvisible(input) {
  const text = typeof input === 'string' ? input : '';
  const counts = {};
  let flagged = 0;
  let removed = 0;
  const invisibleText = [];
  if (!text) return { text, removed, invisible_chars: counts, invisible_flagged: flagged, invisible_text: invisibleText };

  const flagSpans = [];
  for (const m of text.matchAll(RGI_TAG_FLAG)) flagSpans.push([m.index, m.index + m[0].length]);
  const unflagged = flagSpans.length ? text.replace(RGI_TAG_FLAG, '') : text;

  for (const m of unflagged.matchAll(ANY_INVISIBLE)) {
    const ch = m[0];
    const cp = ch.codePointAt(0);
    const key = ZERO_WIDTH.has(ch) ? 'zero_width' : BIDI.has(ch) ? 'bidi' : FORMAT.has(ch) ? 'format'
      : ch === BOM ? 'bom' : isTag(cp) ? 'tag' : 'variation';
    counts[key] = (counts[key] || 0) + 1;
    removed++;
    if (BIDI_TAMPER.has(ch)) {
      flagged++;
    } else if (ZERO_WIDTH.has(ch) || ch === BOM) {
      const before = visibleNeighbour(unflagged, m.index - 1, -1);
      const after = visibleNeighbour(unflagged, m.index + ch.length, 1);
      if (LETTER.test(before) && LETTER.test(after)) flagged++;
    }
  }
  if (!removed) return { text, removed, invisible_chars: counts, invisible_flagged: flagged, invisible_text: invisibleText };

  for (const m of unflagged.matchAll(TAG_RUN)) {
    const s = decodeTagRun(m[0]);
    if (s) invisibleText.push(s.slice(0, LINE_MAX));
  }
  for (const m of unflagged.matchAll(VARIATION_RUN)) {
    const s = decodeVariationRun(m[0]);
    if (s) invisibleText.push(s.slice(0, LINE_MAX));
  }

  let out;
  if (flagSpans.length) {
    // Strip around the flags so the visible emoji survive intact.
    const parts = [];
    let last = 0;
    for (const [a, b] of flagSpans) {
      parts.push(stripChars(text.slice(last, a)), text.slice(a, b));
      last = b;
    }
    parts.push(stripChars(text.slice(last)));
    out = parts.join('');
  } else {
    out = stripChars(text);
  }
  return { text: out, removed, invisible_chars: counts, invisible_flagged: flagged, invisible_text: invisibleText };
}

function fold(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\u00A0\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** stripInvisible, then fold whitespace. */
export function cleanText(input) {
  const r = stripInvisible(input);
  return { ...r, text: fold(r.text) };
}

// ─── Entities ────────────────────────────────────────────────────

// Named references that encode an invisible character. Case-sensitive, as in HTML.
const INVISIBLE_ENTITIES = {
  shy: '\u00AD', zwj: '\u200D', zwnj: '\u200C', lrm: '\u200E', rlm: '\u200F',
  ZeroWidthSpace: '\u200B', NegativeVeryThinSpace: '\u200B', NegativeThinSpace: '\u200B',
  NegativeMediumSpace: '\u200B', NegativeThickSpace: '\u200B', NoBreak: '\u2060',
  af: '\u2061', ApplyFunction: '\u2061', it: '\u2062', InvisibleTimes: '\u2062',
  ic: '\u2063', InvisibleComma: '\u2063',
};
const INVISIBLE_ENTITY = new RegExp('&(' + Object.keys(INVISIBLE_ENTITIES).join('|') + ');', 'g');

/** Decode only the named references for invisible characters (e.g. &shy;), so stripInvisible sees them. */
export function decodeInvisibleEntities(s) {
  return s.replace(INVISIBLE_ENTITY, (_, name) => INVISIBLE_ENTITIES[name]);
}

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00A0',
  colon: ':', semi: ';', lpar: '(', rpar: ')', comma: ',', period: '.', sol: '/', bsol: '\\',
  excl: '!', num: '#', percnt: '%', lowbar: '_', equals: '=', Tab: '\t', NewLine: '\n',
  hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', rsquo: '\u2019', lsquo: '\u2018',
  rdquo: '\u201D', ldquo: '\u201C', bull: '\u2022', middot: '\u00B7', euro: '\u20AC', pound: '\u00A3',
  ...INVISIBLE_ENTITIES,
};

function codePoint(n) {
  return n > 0 && n <= 0x10FFFF && !(n >= 0xD800 && n <= 0xDFFF) ? String.fromCodePoint(n) : '\uFFFD';
}

// Read entities the way a browser reads an attribute or text node, so
// "display&#58;none" and "display&colon;none" hide what they hide.
function unescapeHtml(s) {
  return s
    .replace(/&#[xX]([0-9a-fA-F]+);?/g, (_, h) => codePoint(parseInt(h, 16)))
    .replace(/&#(\d+);?/g, (_, d) => codePoint(parseInt(d, 10)))
    .replace(/&([A-Za-z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

// ─── Hidden HTML ─────────────────────────────────────────────────

const PRESTRIP = /<!DOCTYPE[^>]*>|<\?[^>]*\?>/gi;
// One pass, so whichever starts first wins: a "<!--" inside a script string
// must not swallow the page, and a "<script" inside a comment is a comment.
const COMMENT_OR_BLOCK = /<!--[\s\S]*?(?:-->|$)|<(script|style|noscript|svg|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi;
const SCANNED_BLOCKS = new Set(['noscript', 'svg', 'template']); // comments too; script/style are code
const TAG_RE = /<(\/?)([a-zA-Z][\w:-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTR_RE = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'wbr', 'source', 'area', 'base', 'col', 'embed', 'param', 'track']);
const BLOCK = new Set(['p', 'div', 'li', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'br', 'section', 'article',
  'header', 'footer', 'table', 'thead', 'tbody', 'blockquote', 'pre', 'dd', 'dt', 'dl', 'nav', 'main',
  'aside', 'figure', 'form', 'fieldset', 'legend', 'address', 'hr', 'td', 'th', 'option', 'dialog', 'details']);
const IMPLIED_END = new Set(['p', 'li', 'dd', 'dt', 'tr', 'td', 'th', 'option']); // an open one is closed by a sibling
const CLOSES_P = new Set([...BLOCK].filter((n) => n !== 'br')); // an open <p> is closed by any block-level opener
const HTML_HINT = /<\s*(html|body|div|p)\b/i;
const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;
// A dropped block that reads like part of the JD itself (#785, the other
// direction): a collapsed accordion or an aria-hidden duplicate can hold the
// real salary or requirements. Counted, so the user can paste the visible JD.
const SUBSTANTIVE = /\b(?:salary|compensation|requirements?|qualifications?|responsibilities|we offer|benefits|løn|lønn|lön|krav|kvalifikationer|kvalifikasjoner|ansvarsområder|arbetsuppgifter|vi tilbyder|vi erbjuder)\b|(?:\u20AC|\$|\u00A3)\s?\d|\b(?:dkk|sek|nok|eur|usd|gbp)\s?\d|\b\d[\d.,]*\s?(?:kr|dkk|sek|nok|eur|usd|gbp)\b/i;

function parseAttrs(raw) {
  const out = Object.create(null);
  for (const m of raw.matchAll(ATTR_RE)) {
    const name = m[1].toLowerCase();
    if (name in out) continue; // a browser keeps the first of a duplicated attribute
    out[name] = m[2] ?? m[3] ?? m[4] ?? '';
  }
  return out;
}

// The style attribute as a browser reads it: entities decoded, CSS comments
// gone, one value per property (the last declaration wins).
function declarations(styleAttr) {
  const decl = Object.create(null);
  const css = unescapeHtml(styleAttr || '').replace(CSS_COMMENT, '');
  for (const part of css.split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const prop = part.slice(0, i).trim().toLowerCase();
    const value = part.slice(i + 1).replace(/!\s*important\s*$/i, '').trim().toLowerCase();
    if (prop) decl[prop] = value;
  }
  return decl;
}

function length(value) {
  const m = /^(-?(?:\d+\.?\d*|\.\d+))(px|pt|em|rem|%|vw|vh)?$/.exec(String(value || '').trim());
  if (!m) return null;
  const n = parseFloat(m[1]);
  const unit = m[2] || 'px';
  const px = unit === 'px' ? n : unit === 'pt' ? n * 4 / 3 : unit === 'em' || unit === 'rem' ? n * 16 : null;
  return { n, unit, px };
}

const NAMED_COLORS = {
  white: [255, 255, 255], black: [0, 0, 0], silver: [192, 192, 192], gray: [128, 128, 128], grey: [128, 128, 128],
  red: [255, 0, 0], green: [0, 128, 0], blue: [0, 0, 255], yellow: [255, 255, 0], navy: [0, 0, 128],
};
const COLOR_TOKEN = /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^)]*\)|\b(?:transparent|white|black|silver|gray|grey|red|green|blue|yellow|navy)\b/;

// { rgb: [r,g,b] | null, a } or null when the value is not a colour we read.
function parseColor(value) {
  const v = String(value || '').trim();
  if (!v) return null;
  if (v === 'transparent') return { rgb: null, a: 0 };
  let m = /^#([0-9a-f]{3,8})$/.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = h.split('').map((c) => c + c).join('');
    if (h.length !== 6 && h.length !== 8) return null;
    const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    return { rgb, a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
  }
  m = /^(rgba?|hsla?)\(([^)]*)\)$/.exec(v);
  if (m) {
    const parts = m[2].split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const a = parts.length > 3 ? (parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3])) : 1;
    if (Number.isNaN(a)) return null;
    if (m[1].startsWith('hsl')) return { rgb: null, a };
    const rgb = parts.slice(0, 3).map((p) => (p.endsWith('%') ? parseFloat(p) * 2.55 : parseFloat(p)));
    return rgb.some(Number.isNaN) ? null : { rgb, a };
  }
  if (NAMED_COLORS[v]) return { rgb: NAMED_COLORS[v], a: 1 };
  return null;
}

function luminance([r, g, b]) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// Inline text and background colour, inherited down the open-element stack.
// Only inline styles are read; a colour set by a stylesheet is unknown.
function paint(decl, parent) {
  let fg = parent ? parent.fg : null;
  let bg = parent ? parent.bg : null;
  let painted = false;
  if ('color' in decl) {
    const c = parseColor(decl.color);
    fg = c && c.rgb ? c.rgb : null;
    painted = true;
  }
  const bgValue = decl['background-color'] ?? decl.background;
  if (bgValue !== undefined) {
    painted = true;
    if (/url\(|gradient/.test(bgValue)) {
      bg = null;
    } else {
      const tok = COLOR_TOKEN.exec(bgValue);
      const c = tok ? parseColor(tok[0]) : null;
      if (c && c.a > 0) bg = c.rgb; // a transparent background shows the parent's
    }
  }
  return { fg, bg, painted };
}

function hiddenByStyle(d) {
  if (/^none\b/.test(d.display || '')) return true;
  if (/^(?:hidden|collapse)\b/.test(d.visibility || '')) return true;
  if (d.opacity !== undefined) {
    const m = /^(\d*\.?\d+)(%)?$/.exec(d.opacity);
    if (m && (m[2] ? parseFloat(m[1]) / 100 : parseFloat(m[1])) < 0.1) return true;
  }
  if (d['font-size'] !== undefined) {
    const L = length(d['font-size']);
    if (L && (L.n <= 0 || (L.px !== null && L.px <= 2) || (L.unit === '%' && L.n <= 12.5))) return true;
  }
  if (d.color !== undefined) {
    const c = parseColor(d.color);
    if (c && c.a < 0.1) return true;
  }
  if (d.clip !== undefined) {
    const m = /rect\(([^)]*)\)/.exec(d.clip);
    if (m) {
      const v = m[1].split(/[\s,]+/).filter(Boolean).map((x) => length(x));
      // rect(top, right, bottom, left): a zero-area box shows nothing
      if (v.length === 4 && v.every((x) => x && x.px !== null)) {
        const [t, r, b, l] = v.map((x) => x.px);
        if (b <= t || r <= l) return true;
      }
    }
  }
  if (d['clip-path'] !== undefined) {
    const cp = d['clip-path'];
    const inset = /inset\(\s*(\d+(?:\.\d+)?)%/.exec(cp);
    if (inset && parseFloat(inset[1]) >= 50) return true;
    if (/(?:circle|ellipse)\(\s*0(?:\.0+)?(?:px|%)?\s*[)a ]/.test(cp)) return true;
  }
  if (d.transform !== undefined && /\bscale[xy]?\(\s*0(?:\.0+)?\s*[,)]/.test(d.transform)) return true;
  if (d.scale !== undefined && /^0(?:\.0+)?(?:\s|$)/.test(d.scale)) return true;
  for (const prop of ['left', 'top', 'right', 'text-indent']) {
    const L = length(d[prop]);
    if (!L) continue;
    if (L.px !== null && L.px <= -999) return true;
    if ((L.unit === '%' || L.unit === 'vw' || L.unit === 'vh') && L.n <= -100) return true;
  }
  // A box collapsed to nothing with its overflow clipped hides its content as
  // surely as display:none. Either half alone is everyday layout CSS.
  const clipped = ['overflow', 'overflow-x', 'overflow-y'].some((p) => /^(?:hidden|clip)\b/.test(d[p] || ''));
  if (clipped) {
    for (const prop of ['height', 'width', 'max-height', 'max-width']) {
      const L = length(d[prop]);
      if (L && (L.n <= 0 || (L.px !== null && L.px <= 1))) return true;
    }
  }
  return false;
}

// Classes a <style> block hides with a top-level rule (".x { display:none }").
// Reported, not removed: the page may show them again from a media query or
// a stylesheet we never fetch, so dropping them could drop the real JD.
function cssHiddenClasses(markup) {
  const out = new Set();
  for (const m of markup.matchAll(/<style\b[^>]*>([\s\S]*?)(?:<\/style\s*>|$)/gi)) {
    const css = m[1].replace(CSS_COMMENT, '');
    let depth = 0;
    let start = 0;
    let selector = '';
    let atRule = false;
    for (let i = 0; i < css.length; i++) {
      const c = css[i];
      if (c === '{') {
        if (depth === 0) {
          selector = css.slice(start, i).split(';').pop().trim(); // drop a preceding @import/@charset
          atRule = selector.startsWith('@');
          start = i + 1;
        }
        depth++;
      } else if (c === '}') {
        depth = Math.max(0, depth - 1);
        if (depth === 0) {
          if (!atRule && hiddenByStyle(declarations(css.slice(start, i)))) {
            for (const sel of selector.split(',')) {
              const cls = /^\.([\w-]+)$/.exec(sel.trim());
              if (cls) out.add(cls[1]);
            }
          }
          start = i + 1;
        }
      }
    }
  }
  return out;
}

function hiddenElement(name, attrs, decl, painted) {
  if ('hidden' in attrs) return true;
  if ((attrs['aria-hidden'] || '').trim().toLowerCase() === 'true') return true;
  if (name === 'dialog' && !('open' in attrs)) return true; // a closed <dialog> is not rendered
  if (hiddenByStyle(decl)) return true;
  // Text the same colour as its background (contrast under 1.25:1).
  return !!(painted && painted.painted && painted.fg && painted.bg && contrast(painted.fg, painted.bg) < 1.25);
}

/**
 * Remove hidden elements from markup. Visible markup is returned with its tags
 * intact so the caller's own extraction runs unchanged.
 *
 * The walker keeps a name stack with HTML5 implied end tags, so a stray closer
 * cannot end a hidden element early and an unclosed <li> or <p> inside one
 * cannot swallow the rest of the page; a "/>" on a non-void tag is ignored, as
 * browsers do; unterminated comments and script/style blocks run to the end.
 *
 * @returns {{ html: string, hidden_blocks: string[], hidden_text: string,
 *             hidden_substantive: number, css_hidden_kept: number }}
 */
export function dropHiddenHtml(markup) {
  let src = typeof markup === 'string' ? markup : '';
  const hiddenParts = [];
  const hiddenBlocks = [];
  let substantive = 0;
  let cssKept = 0;
  const cssClasses = cssHiddenClasses(src);

  const collect = (block) => {
    const inner = block.replace(/<!--|-->/g, ' ').replace(/<[^>]+>/g, ' ');
    hiddenParts.push(unescapeHtml(inner));
    return ' ';
  };
  src = src.replace(PRESTRIP, ' ');
  src = src.replace(COMMENT_OR_BLOCK, (m, tag) => (!tag || SCANNED_BLOCKS.has(tag.toLowerCase()) ? collect(m) : ' '));

  const visible = [];
  const hiddenBuf = [];
  const stack = []; // open elements, innermost last: { name, fg, bg, nav }
  let hiddenAt = -1; // stack index of the element that started the hidden run
  let cssAt = -1;
  let pos = 0;

  const collectUrls = (raw) => {
    for (const u of unescapeHtml(raw).match(URL_RE) || []) hiddenParts.push(u);
  };
  const flushHidden = () => {
    const block = fold(unescapeHtml(hiddenBuf.join('')));
    hiddenBuf.length = 0;
    hiddenAt = -1;
    if (block) {
      // Clean before cutting, or a run of invisible characters at the front
      // would leave an empty excerpt. The raw block goes to hidden_text, where
      // guardText counts and decodes its invisible characters.
      hiddenBlocks.push(cleanText(block).text.slice(0, EXCERPT));
      hiddenParts.push(block);
      if (SUBSTANTIVE.test(block)) substantive++;
    }
  };
  const popTo = (index) => {
    stack.length = index;
    if (cssAt >= index) cssAt = -1;
    if (hiddenAt >= index) flushHidden();
  };
  const lastIndex = (name) => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].name === name) return i;
    return -1;
  };

  // No tag ends after the last ">": match only up to it, so a tail of bare
  // "<" characters costs one pass instead of one scan to the end per "<".
  const tagZone = src.slice(0, src.lastIndexOf('>') + 1);
  for (const m of tagZone.matchAll(TAG_RE)) {
    (hiddenAt < 0 ? visible : hiddenBuf).push(src.slice(pos, m.index));
    pos = m.index + m[0].length;
    const name = m[2].toLowerCase();
    const raw = m[3];
    if (hiddenAt >= 0 && BLOCK.has(name)) hiddenBuf.push('\n');

    if (m[1] === '/') {
      const hiddenStart = hiddenAt;
      const index = lastIndex(name);
      if (index >= 0) popTo(index); // a closer with no matching opener is ignored
      // Keep the closer when it ends an element outside the hidden run.
      if (hiddenStart < 0 || (index >= 0 && index < hiddenStart)) visible.push(m[0]);
      continue;
    }

    const attrs = parseAttrs(raw);
    if (VOID.has(name)) {
      const parent = stack[stack.length - 1];
      const own = hiddenAt < 0 && hiddenElement(name, attrs, declarations(attrs.style), null);
      if ((hiddenAt >= 0 || own) && !(parent && parent.nav)) collectUrls(raw);
      if (hiddenAt < 0 && !own) visible.push(m[0]);
      continue;
    }
    if (IMPLIED_END.has(name) && stack.length && stack[stack.length - 1].name === name) {
      popTo(stack.length - 1); // a sibling closes the open one
    } else if (CLOSES_P.has(name) && stack.length && stack[stack.length - 1].name === 'p') {
      popTo(stack.length - 1);
    }
    const parent = stack[stack.length - 1];
    const decl = declarations(attrs.style);
    const painted = paint(decl, parent);
    const own = hiddenAt < 0 && hiddenElement(name, attrs, decl, painted);
    // Navigation targets are chrome, not payload (PR #767).
    const nav = !!(parent && parent.nav) || name === 'nav' || (attrs.role || '').trim().toLowerCase() === 'navigation';
    if ((hiddenAt >= 0 || own) && !nav) collectUrls(raw);
    stack.push({ name, fg: painted.fg, bg: painted.bg, nav });
    if (own) {
      hiddenAt = stack.length - 1;
    } else if (hiddenAt < 0) {
      visible.push(m[0]);
      if (cssAt < 0 && cssClasses.size && (attrs.class || '').split(/\s+/).some((c) => cssClasses.has(c))) {
        cssAt = stack.length - 1;
        cssKept++;
      }
    }
  }
  (hiddenAt < 0 ? visible : hiddenBuf).push(src.slice(pos));
  if (hiddenAt >= 0) flushHidden();

  return {
    html: visible.join(''),
    hidden_blocks: hiddenBlocks,
    hidden_text: hiddenParts.join('\n'),
    hidden_substantive: substantive,
    css_hidden_kept: cssKept,
  };
}

// Visible markup to text, for guard() on raw HTML. fetch-jd-url has its own.
function markupToText(markup) {
  const cut = markup.lastIndexOf('>') + 1; // as in dropHiddenHtml: no tag ends past the last ">"
  const text = markup.slice(0, cut).replace(TAG_RE, (m, _c, name) => (BLOCK.has(name.toLowerCase()) ? '\n' : '')) + markup.slice(cut);
  return fold(unescapeHtml(text));
}

// ─── Scan ────────────────────────────────────────────────────────

const URL_RE = /https?:\/\/[^\s<>"')\]]+/g;
const INSTRUCTION_PATTERNS = [
  /\bignore (?:all|any|the|previous|prior|above|earlier)\b/i,
  // The same instruction with its other two verbs. These take an explicit
  // object ("previous instructions"), because "forget the" and "disregard
  // the" are ordinary prose.
  /\b(?:disregard|forget)(?: all| any| the| your| my)? (?:previous|prior|above|earlier|preceding|initial|original|system) (?:instructions?|prompts?|guidance|rules|directions|directives|context)\b/i,
  /\byou are (?:an?|the) (?:ai(?![\w-])|ai (?:assistant|agent|model|language model)|assistant|llm|language model)\b/i,
  // "You are now a helpful recruiting bot": a persona noun within a few words.
  /\byou are now (?:an?|the|my) (?:[\w-]+ ){0,3}?(?:bot|chatbot|assistant|ai|agent|model|llm|gpt|persona)\b/i,
  /\bsystem prompt\b/i,
  // "do not tell the user": the verb straight onto "the user" (not "the
  // user's"). Narrow on purpose: "never disclose user data" is privacy prose.
  /\b(?:do not|don['\u2019]?t|never) (?:tell|inform) the user\b(?!['\u2019]s)/i,
  /\b(?:do not|don['\u2019]?t|never) (?:mention|reveal|disclose) (?:this|these|that|it|any of this|the (?:above|following|previous))\b[^.\n]{0,30}\bto the user\b/i,
  /\b(?:run|execute) the following (?:command|commands|script|code|shell|instruction|instructions|steps)\b/i,
  // "As an AI" flags unless a job-title noun follows within a few words, the
  // way AI job ads introduce the role ("As an AI Engineer").
  /\bas an ai(?![\w-])(?![\s/&]+(?:[\w&/-]+\s+){0,3}?(?:engineer|developer|researcher|scientist|architect|specialist|lead|consultant|manager|analyst|intern|trainer|expert|strategist|designer|tester|owner|programmer)s?\b)/i,
  /^\s*(?:assistant|system|user)\s*:/i,
  /<\|/,
  /\[INST\]/i,
  /###\s*(?:system|instruction)/i,
  /\b(?:curl|wget|ssh|scp)\b/i,
  /\.env\b/i,
  /settings\.json/i,
  /allowed-tools/i,
  /\btool_use\b|\bfunction_call\b/i,
];
// Digit-for-letter spellings ("Ign0re a11 ru1es"). A line holding a token that
// mixes letters with 0/1/3/4/5/7/@/$ is also matched in a skeleton form:
// those characters mapped to letters, and every "l" read as "i" so 1 can be
// either. The patterns get the same l->i map. Same length, so the match index
// still points into the original line.
const LEET = { 0: 'o', 1: 'i', 3: 'e', 4: 'a', 5: 's', 7: 't', '@': 'a', $: 's' };
// Tokenize, then test each token: one pass, no backtracking over long runs.
const ALNUM_TOKEN = /[A-Za-z0-9@$]+/g;
const MIXED = /[A-Za-z][013457@$]|[013457@$][A-Za-z]/;
const SKELETON_PATTERNS = INSTRUCTION_PATTERNS.map((p) => new RegExp(p.source.replace(/l/g, 'i').replace(/L/g, 'I'), p.flags));
const hasLeet = (line) => (line.match(ALNUM_TOKEN) || []).some((tok) => MIXED.test(tok));
const skeleton = (line) => line
  .replace(ALNUM_TOKEN, (tok) => (MIXED.test(tok) ? tok.replace(/[013457@$]/g, (c) => LEET[c]) : tok))
  .replace(/[lL]/g, (c) => (c === 'l' ? 'i' : 'I'));

const WORD = /[\p{L}\p{M}\p{N}_]+/gu;
const LATIN = /[A-Za-z]/;
const CONFUSABLE = /[\u0400-\u04FF\u0370-\u03FF]/;
const GREEK_UNIT = /^(?:[\u0370-\u03FF][A-Za-z]{0,4}|[A-Za-z]{1,4}[\u0370-\u03FF])$/u;
const LINE_SPLIT = /\r\n|[\n\r\v\f\x1c-\x1e\x85\u2028\u2029]/;

// Up to LINE_MAX characters of the line, always including position at, so
// the quote shows the match even in a long paragraph.
function excerpt(line, at) {
  if (line.length <= LINE_MAX) return line;
  const lead = Math.floor(LINE_MAX / 3);
  let start = Math.max(0, at - lead);
  const end = Math.min(line.length, start + LINE_MAX);
  start = Math.max(0, end - LINE_MAX);
  return (start ? '\u2026' : '') + line.slice(start, end) + (end < line.length ? '\u2026' : '');
}

function firstMatch(patterns, line) {
  for (const p of patterns) {
    const m = p.exec(line);
    if (m) return m;
  }
  return null;
}

/** Instruction-shaped lines, hidden URLs, visible URL count, mixed-script words. */
export function scan(visible, hidden) {
  const seen = new Set();
  const instructionLike = [];
  for (const line of `${visible}\n${hidden}`.split(LINE_SPLIT)) {
    const stripped = line.trim();
    if (!stripped || seen.has(stripped)) continue;
    let match = firstMatch(INSTRUCTION_PATTERNS, stripped);
    if (!match && hasLeet(stripped)) match = firstMatch(SKELETON_PATTERNS, skeleton(stripped));
    if (match) {
      seen.add(stripped);
      instructionLike.push(excerpt(stripped, match.index));
    }
  }
  const hiddenUrls = [];
  for (const u of hidden.match(URL_RE) || []) if (!hiddenUrls.includes(u)) hiddenUrls.push(u);
  const homoglyphs = [];
  for (const word of `${visible}\n${hidden}`.match(WORD) || []) {
    if (LATIN.test(word) && CONFUSABLE.test(word) && !GREEK_UNIT.test(word) && !homoglyphs.includes(word)) homoglyphs.push(word);
  }
  return {
    instruction_like: instructionLike,
    hidden_urls: hiddenUrls,
    visible_url_count: (visible.match(URL_RE) || []).length,
    homoglyph_runs: homoglyphs,
  };
}

// ─── Verdict ─────────────────────────────────────────────────────

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** One line for the user. Alarms only on signals of targeting; hidden blocks and URLs are context. */
export function verdict(f) {
  const alarms = [];
  let n = (f.instruction_like || []).length;
  if (n) alarms.push(plural(n, 'instruction-like line', 'instruction-like lines'));
  n = Number(f.redacted) || 0;
  if (n) alarms.push(plural(n, 'injection pattern redacted', 'injection patterns redacted'));
  n = Number(f.invisible_flagged) || 0;
  if (n) alarms.push(plural(n, 'invisible character inside words', 'invisible characters inside words'));
  n = Number((f.invisible_chars || {}).tag) || 0;
  if (n) alarms.push(plural(n, 'tag character (text hidden from the reader)', 'tag characters (text hidden from the reader)'));
  n = (f.invisible_text || []).length;
  if (n) alarms.push(plural(n, 'string spelled in invisible characters', 'strings spelled in invisible characters'));
  n = (f.homoglyph_runs || []).length;
  if (n) alarms.push(plural(n, 'mixed-script word', 'mixed-script words'));

  const context = [];
  n = (f.hidden_blocks || []).length;
  if (n) context.push(plural(n, 'hidden block', 'hidden blocks'));
  n = (f.hidden_urls || []).length;
  if (n) context.push(plural(n, 'hidden URL', 'hidden URLs'));
  const removed = context.join(' and ');

  const notes = [];
  n = Number(f.hidden_substantive) || 0;
  if (n) notes.push(`${plural(n, 'removed block reads', 'removed blocks read')} like salary or requirements - paste the visible JD if it looks incomplete`);
  n = Number(f.css_hidden_kept) || 0;
  if (n) notes.push(`${plural(n, 'element', 'elements')} hidden by page CSS kept`);
  const tail = notes.length ? ` [${notes.join('; ')}]` : '';

  let line;
  if (alarms.length) {
    line = `posting_guard: \u26A0 ${alarms.join(', ')} - review before continuing`;
    if (removed) line += ` (${removed} removed)`;
  } else if (f.empty) {
    line = NO_TEXT_VERDICT + (removed ? ` (${removed} removed)` : '');
  } else if (removed) {
    line = `posting_guard: clean (${removed} removed, none instruction-like)`;
  } else {
    line = 'posting_guard: clean';
  }
  return line + tail;
}

function emptyFindings() {
  return {
    hidden_blocks: [], hidden_substantive: 0, css_hidden_kept: 0, invisible_chars: {}, invisible_flagged: 0,
    invisible_text: [], instruction_like: [], hidden_urls: [], visible_url_count: 0, homoglyph_runs: [],
    empty: true, verdict: NO_TEXT_VERDICT,
  };
}

/**
 * The tail of the gate: strip invisible characters from the visible text and
 * from what dropHiddenHtml removed, scan both, write the verdict.
 *
 * @param {string} visibleText  extracted text (tags already gone)
 * @param {object} [dropped]    dropHiddenHtml() result, if HTML was cleaned
 * @returns {{ text: string, findings: object }}
 */
export function guardText(visibleText, dropped) {
  const d = dropped || {};
  const tf = stripInvisible(typeof visibleText === 'string' ? visibleText : '');
  const hf = stripInvisible(d.hidden_text || '');
  // Invisible characters inside hidden content count and alarm like visible
  // ones; what they spell is hidden content: scanned, never passed on.
  const counts = { ...tf.invisible_chars };
  for (const [k, n] of Object.entries(hf.invisible_chars)) counts[k] = (counts[k] || 0) + n;
  const invisibleText = [...tf.invisible_text, ...hf.invisible_text];
  const hiddenText = [hf.text, ...invisibleText].join('\n');
  const findings = {
    hidden_blocks: d.hidden_blocks || [],
    hidden_substantive: d.hidden_substantive || 0,
    css_hidden_kept: d.css_hidden_kept || 0,
    invisible_chars: counts,
    invisible_flagged: tf.invisible_flagged + hf.invisible_flagged,
    invisible_text: invisibleText,
    ...scan(tf.text, hiddenText),
    empty: !tf.text.trim(),
  };
  findings.verdict = verdict(findings);
  return { text: tf.text, findings };
}

/**
 * Run the whole gate on raw input. mode: 'html', 'text' or 'auto'.
 * Empty or whitespace-only input returns NO_TEXT_VERDICT, never "clean" (#798).
 */
export function guard(raw, mode = 'auto') {
  if (typeof raw !== 'string' || !raw.trim()) return { text: '', findings: emptyFindings() };
  const html = mode === 'html' || (mode === 'auto' && HTML_HINT.test(raw));
  if (!html) {
    const r = guardText(raw);
    return { text: fold(r.text), findings: r.findings };
  }
  const dropped = dropHiddenHtml(raw);
  const r = guardText(markupToText(dropped.html), dropped);
  return { text: fold(r.text), findings: r.findings };
}

/** Counts and the verdict line: what an API response or a log carries. Excerpts stay server-side. */
export function guardSummary(f) {
  return {
    verdict: f.verdict,
    hidden_blocks: (f.hidden_blocks || []).length,
    hidden_substantive: f.hidden_substantive || 0,
    hidden_urls: (f.hidden_urls || []).length,
    css_hidden_kept: f.css_hidden_kept || 0,
    instruction_like: (f.instruction_like || []).length,
    invisible_chars: { ...(f.invisible_chars || {}) },
    invisible_flagged: f.invisible_flagged || 0,
    invisible_text: (f.invisible_text || []).length,
    homoglyph_runs: (f.homoglyph_runs || []).length,
    visible_url_count: f.visible_url_count || 0,
  };
}
