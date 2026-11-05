#!/usr/bin/env python3
"""posting_guard.py - invisible-character gate for third-party posting text.

POSTING-GUARD-001 (2026-11-05). The character half of tools/posting_guard.py
from ai-job-search (https://github.com/ai-job-search-dev/ai-job-search). The
HTML half and the instruction scan live in workers/proxy/src/posting-guard.js,
which every fetched JD passes through. Discovery rows (titles, companies,
teasers) only need the characters gone: job_sources._text calls
strip_invisible.

Removed and counted: zero-width characters, bidi controls, soft hyphen, BOM,
Unicode tag characters (U+E0000-U+E007F; the England, Scotland and Wales flag
emoji are kept whole) and variation selectors. Flagged as tampering: a
zero-width character or BOM between two letters, any bidi override or
isolate. Text spelled in tag characters or in a run of variation selectors is
decoded into invisible_text, since what it spells is the payload.

Calibrated like the JS port: the neighbours of a zero-width character are the
nearest VISIBLE ones (a run of two still flags), and U+2028/U+2029 become
newlines instead of being deleted.

Network-free test: scripts/job-tracker/test_posting_guard.py

Ported code: MIT License

Copyright (c) 2026 Mads Lorentzen

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
"""
import re

LINE_MAX = 200

ZERO_WIDTH = "\u200b\u200c\u200d\u2060\u2061\u2062\u2063\u2064"
BIDI = "\u200e\u200f\u202a\u202b\u202c\u202d\u202e\u2066\u2067\u2068\u2069"
BIDI_TAMPER = "\u202d\u202e\u2066\u2067\u2068\u2069"  # overrides and isolates
FORMAT = "\u00ad\u2028\u2029"  # soft hyphen, line/paragraph separators
BOM = "\ufeff"
ANY_INVISIBLE = re.compile(
    "[\u00ad\u200b-\u200f\u202a-\u202e\u2028\u2029\u2060-\u2064\u2066-\u2069\ufeff"
    "\ufe00-\ufe0f\U000e0000-\U000e007f\U000e0100-\U000e01ef]"
)
REMOVED = re.compile(
    "[\u00ad\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff"
    "\ufe00-\ufe0f\U000e0000-\U000e007f\U000e0100-\U000e01ef]"
)
TAG_RUN = re.compile("[\U000e0000-\U000e007f]+")
VARIATION_RUN = re.compile("[\ufe00-\ufe0f\U000e0100-\U000e01ef]{2,}")
# The one legitimate use of tag characters: the England, Scotland and Wales
# flags (black flag, tag letters gbeng/gbsct/gbwls, cancel tag).
RGI_TAG_FLAG = re.compile(
    "\U0001f3f4\U000e0067\U000e0062(?:\U000e0065\U000e006e\U000e0067"
    "|\U000e0073\U000e0063\U000e0074|\U000e0077\U000e006c\U000e0073)\U000e007f"
)


def _is_tag(o: int) -> bool:
    return 0xE0000 <= o <= 0xE007F


def _invisible(ch: str) -> bool:
    o = ord(ch)
    return (ch in ZERO_WIDTH or ch in BIDI or ch in FORMAT or ch == BOM or _is_tag(o)
            or 0xFE00 <= o <= 0xFE0F or 0xE0100 <= o <= 0xE01EF)


def _neighbour(text: str, i: int, step: int) -> str:
    """Nearest visible character from index i in direction step."""
    while 0 <= i < len(text):
        if not _invisible(text[i]):
            return text[i]
        i += step
    return ""


def _strip(text: str) -> str:
    return REMOVED.sub("", text).replace("\u2028", "\n").replace("\u2029", "\n")


def strip_invisible(text):
    """Remove invisible characters; nothing else changes.

    Returns (text, findings) with findings = {"invisible_chars": {category: n},
    "invisible_flagged": n, "invisible_text": [decoded, ...], "removed": n}.
    """
    text = text or ""
    counts = {}
    flagged = 0
    invisible_text = []
    flags = list(RGI_TAG_FLAG.finditer(text))
    unflagged = RGI_TAG_FLAG.sub("", text) if flags else text
    for m in ANY_INVISIBLE.finditer(unflagged):
        ch, i = m.group(0), m.start()
        key = ("zero_width" if ch in ZERO_WIDTH else "bidi" if ch in BIDI else "format" if ch in FORMAT
               else "bom" if ch == BOM else "tag" if _is_tag(ord(ch)) else "variation")
        counts[key] = counts.get(key, 0) + 1
        if ch in BIDI_TAMPER:
            flagged += 1
        elif ch in ZERO_WIDTH or ch == BOM:
            if _neighbour(unflagged, i - 1, -1).isalpha() and _neighbour(unflagged, i + 1, 1).isalpha():
                flagged += 1
    for run in TAG_RUN.findall(unflagged):
        decoded = "".join(chr(ord(c) - 0xE0000) for c in run if 0x20 <= ord(c) - 0xE0000 < 0x7F).strip()
        if decoded:
            invisible_text.append(decoded[:LINE_MAX])
    for run in VARIATION_RUN.findall(unflagged):
        data = bytes(ord(c) - 0xFE00 if ord(c) <= 0xFE0F else ord(c) - 0xE0100 + 16 for c in run)
        decoded = "".join(c for c in data.decode("utf-8", errors="replace") if c.isprintable()).strip()
        if decoded:
            invisible_text.append(decoded[:LINE_MAX])
    if flags:
        # Strip around the flags so the visible emoji survive intact.
        pieces, last = [], 0
        for m in flags:
            pieces.append(_strip(text[last:m.start()]))
            pieces.append(m.group(0))
            last = m.end()
        pieces.append(_strip(text[last:]))
        out = "".join(pieces)
    else:
        out = _strip(text)
    return out, {"invisible_chars": counts, "invisible_flagged": flagged,
                 "invisible_text": invisible_text, "removed": sum(counts.values())}
