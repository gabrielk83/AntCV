#!/usr/bin/env python3
"""ats_text.py — ATS-TEXT-LAYER-001 (2026-11-05, from ai-job-search's /apply step 5d).

An ATS reads the PDF's embedded text layer, not the rendered page. A two-column margin
CV (AntCV's default) can look right and still parse as noise. This checks the text
layer of an exported PDF the way a parser meets it:

  text present   at least 50 words extract (not an image-only page)       FAIL
  glyphs         (cid:N) markers or U+FFFD replacement characters         FAIL
                 private-use characters (icon fonts: the parser sees junk) WARN
  contact        the e-mail (and phone digits) appear as LITERAL text, not
                 only behind an icon or a hyperlink                       FAIL / WARN
  reading order  in content-stream order the two columns do not interleave:
                 one switch (sidebar then main, or main then sidebar) is
                 clean; 3-5 switches on a page WARN; more FAIL

Usage:
  python ats_text.py CV.pdf [--email a@b.dk] [--phone "+45 12 34 56 78"] [--sidebar-ratio 0.36] [--json]
Exit 1 when anything FAILs.
"""
import argparse
import json
import re
import sys

_EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
_PUA = re.compile("[-]")


def _fitz():
    try:
        import pymupdf as fitz  # PyMuPDF >= 1.24 (PYMUPDF-IMPORT-001)
    except ImportError:
        import fitz
    return fitz


def _split_x(blocks, width, ratio=None):
    """The x of the column gutter, or None for a one-column page. With no ratio given,
    the first x between 25 % and 50 % of the width that no block crosses and that has
    3+ blocks on each side."""
    cands = [ratio] if ratio else [r / 100 for r in range(25, 51)]
    for r in cands:
        x = width * r
        left = [b for b in blocks if b[2] <= x]
        right = [b for b in blocks if b[0] >= x]
        crossing = [b for b in blocks if b[0] < x < b[2]]
        if len(left) >= 3 and len(right) >= 3 and len(crossing) <= (1 if ratio else 0):
            return x
    return None


def _lines(page):
    """(x0, y0, x1, y1, text) per text LINE in content-stream order. Lines, not blocks:
    PyMuPDF merges a sidebar line and a main line on the same baseline into one block,
    which hides exactly the interleaving this check looks for."""
    out = []
    for b in page.get_text("dict", sort=False)["blocks"]:
        for ln in b.get("lines", []):
            t = "".join(s["text"] for s in ln["spans"]).strip()
            if len(t) >= 3:
                out.append(tuple(ln["bbox"]) + (t,))
    return out


def column_switches(page, ratio=None):
    """Switches between the columns in content-stream order, or None (one column)."""
    lines = _lines(page)
    x = _split_x(lines, page.rect.width, ratio)
    if x is None:
        return None
    sides = ["L" if (b[0] + b[2]) / 2 < x else "R" for b in lines]
    return sum(1 for a, b in zip(sides, sides[1:]) if a != b)


def check_doc(d, email=None, phone=None, sidebar_ratio=None):
    """[{item, status, detail}] over an open PyMuPDF document."""
    text = "\n".join(d[p].get_text() for p in range(d.page_count))
    rows = []
    add = lambda i, s, det="": rows.append({"item": i, "status": s, "detail": det})
    n_words = len(text.split())
    add("text present", "OK" if n_words >= 50 else "FAIL", "%d words extract" % n_words)
    cid, fffd, pua = text.count("(cid:"), text.count("�"), len(_PUA.findall(text))
    add("no garbled glyphs", "FAIL" if (cid or fffd) else "WARN" if pua else "OK",
        "(cid:) x%d, U+FFFD x%d, private-use x%d" % (cid, fffd, pua))
    low = text.lower()
    if email:
        add("e-mail as literal text", "OK" if email.lower() in low else "FAIL",
            email if email.lower() in low else "%s is not in the text layer" % email)
    else:
        found = _EMAIL.search(text)
        add("e-mail as literal text", "OK" if found else "WARN", found.group(0) if found else "no e-mail in the text layer")
    if phone:
        want = re.sub(r"\D", "", phone)[-8:]
        have = re.sub(r"\D", "", text)
        add("phone as literal text", "OK" if want and want in have else "WARN",
            phone if want in have else "%s is not in the text layer" % phone)
    worst, detail = 0, []
    for p in range(d.page_count):
        sw = column_switches(d[p], sidebar_ratio)
        if sw is not None:
            worst = max(worst, sw)
            detail.append("p%d: %d switch%s" % (p + 1, sw, "" if sw == 1 else "es"))
    add("reading order (columns do not interleave)",
        "FAIL" if worst > 5 else "WARN" if worst >= 3 else "OK",
        "; ".join(detail) or "one column")
    return rows


def check_pdf(path_or_bytes, **kw):
    fitz = _fitz()
    d = fitz.open(stream=path_or_bytes, filetype="pdf") if isinstance(path_or_bytes, (bytes, bytearray)) \
        else fitz.open(path_or_bytes)
    return check_doc(d, **kw)


def summary(rows):
    bad = [r for r in rows if r["status"] != "OK"]
    return "ATS text layer: " + ("OK" if not bad else "; ".join("%s %s" % (r["status"], r["item"]) for r in bad))


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Check a CV PDF's text layer the way an ATS reads it")
    ap.add_argument("pdf")
    ap.add_argument("--email")
    ap.add_argument("--phone")
    ap.add_argument("--sidebar-ratio", type=float, default=None)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    rows = check_pdf(a.pdf, email=a.email, phone=a.phone, sidebar_ratio=a.sidebar_ratio)
    if a.json:
        print(json.dumps(rows, ensure_ascii=False, indent=1))
    else:
        for r in rows:
            print("%-5s %-42s %s" % (r["status"], r["item"], r["detail"]))
    sys.exit(1 if any(r["status"] == "FAIL" for r in rows) else 0)


if __name__ == "__main__":
    main()
