#!/usr/bin/env python3
"""fact_guard.py — FACT-GUARD-001 (TEXT-GUARDS-001, 2026-11-05).

Tier-0 deterministic grounding check of a finished CV or cover letter against the
candidate kernel. It lists what a reviewer must confirm:

  number      a figure in the draft that no kernel figure supports (after Danish /
              Swedish / English number formats, k / M / mio. multipliers, number words,
              year ranges like 2017-20, and hedged rounding DOWN: "over 40" from 45)
  credential  certified / autoriseret / legitimerad ... with no kernel support
  name        a capitalised name or acronym mid-sentence found nowhere in the kernel
              (FAIL) or only in the job ad (WARN: fine for the employer's own names,
              a fabrication when it is claimed as the candidate's skill)

The job ad NEVER grounds a number or a credential: a JD figure or "PMP certified"
requirement must not make the same words true of the candidate (the proxy's
numberGrounding rule, workers/proxy/src/source-fractures.js).

What it cannot see: invented wording with no number, name or credential in it. It
complements the LLM supervisor (workers/proxy/src/supervisor.js); it never replaces it.

Usage:
  python fact_guard.py --draft CV.pdf --kernel kernel.json [--jd jd.txt] [--lang da] [--json]
Exit 1 when anything FAILs.
"""
import argparse
import json
import re
import sys

import guard_common as G

_MULT = [(re.compile(r"^(?:k|tusind|thousand)$", re.I), 1e3),
         (re.compile(r"^(?:m|mio\.?|mill?\.?|million|millioner|miljoner|mn)$", re.I), 1e6),
         (re.compile(r"^(?:bn|b|mia\.?|mdr\.?|billion|milliarder|miljarder)$", re.I), 1e9)]
_NUM = re.compile(
    r"(?<![\w.,])(\d{1,3}(?:[.,   ]\d{3})+(?:[.,]\d+)?|\d+(?:[.,]\d+)?)"
    r"(?:\s?(%|(?:mio|mill?|mia|mdr)\b\.?|(?:k|m|million|millioner|miljoner|mn|bn|billion|milliarder|"
    r"miljarder|tusind|thousand)\b))?"
    r"(\+)?", re.I)
_YEAR_RANGE = re.compile(r"\b((?:19|20)\d{2})\s*[-–—]\s*(\d{2})\b(?![-–—./\d])")
# Dates, phones, e-mails and URLs carry digits that are not claims.
_NOISE = re.compile(
    r"\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b|"
    r"\b\d{1,2}\.?\s+(?:jan|feb|mar|apr|maj|may|jun|jul|aug|sep|okt|oct|nov|dec)\w*\.?\s+\d{4}\b|"
    r"\+?\d[\d  -]{7,}\d|\S+@\S+|https?://\S+|www\.\S+", re.I)


def _to_float(raw, lang):
    s = raw.replace(" ", " ").replace(" ", " ")
    if lang in ("da", "sv"):
        # 1.200 / 1 200 = thousands; 1,5 = decimal
        s = s.replace(" ", "")
        if re.fullmatch(r"\d{1,3}(?:\.\d{3})+(?:,\d+)?", s):
            s = s.replace(".", "")
        s = s.replace(",", ".")
    else:
        s = s.replace(" ", "")
        if re.fullmatch(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?", s):
            s = s.replace(",", "")
        elif re.fullmatch(r"\d+,\d+", s):
            s = s.replace(",", ".")
    try:
        return float(s)
    except ValueError:
        return None


def numbers(text, lang):
    """[(value, surface, kind)] for every figure, after removing dates/phones/urls."""
    text = _NOISE.sub(" ", text or "")

    def _expand(m):                                   # 2017-20 -> "2017 2020"
        a = int(m.group(1))
        b = int(str(a)[:2] + m.group(2))
        return "%d %d" % (a, b) if b >= a else m.group(0)
    text = _YEAR_RANGE.sub(_expand, text)
    out = []
    for m in _NUM.finditer(text):
        v = _to_float(m.group(1), lang)
        if v is None:
            continue
        unit = (m.group(2) or "").strip()
        kind = "pct" if unit == "%" else "num"
        for rx, mult in _MULT:
            if unit and rx.match(unit):
                v *= mult
        if kind == "num" and v.is_integer() and 1900 <= v <= 2100 and not unit:
            kind = "year"
        out.append((v, m.group(0).strip(), kind))
    for w in G.words(text):
        n = G.rules()["number_words"].get(lang, {}).get(w.lower())
        if n:
            out.append((float(n), w, "word"))
    return out


def kernel_numbers(kernel_text):
    """Kernel figures read with BOTH conventions, so '1.200' in a Danish note and
    '1,200' in an English one both count."""
    vals = set()
    for lang in ("en", "da", "sv"):
        vals.update(v for v, _, _ in numbers(kernel_text, lang))
    return vals


def _career_years(kernel_text):
    """(first, last) year the kernel mentions, or None."""
    years = [int(y) for y in re.findall(r"\b(19[5-9]\d|20[0-4]\d)\b", kernel_text)]
    return (min(years), max(years)) if years else None


def _hedged(sentence, surface):
    low = sentence.lower()
    if surface.endswith("+"):
        return True
    return any(re.search(r"(?<!\w)" + re.escape(h) + r"(?!\w)", low) for h in G.rules()["hedge_words"])


def _supported(v, kind, sentence, surface, kvals, years):
    if any(abs(v - k) <= 1e-6 * max(1.0, abs(k)) for k in kvals):
        return True
    if kind == "year":
        # a year inside the kernel's first..last year is inside a documented role; a
        # year outside it is not (cannot pair years to roles without the structure)
        return bool(years) and years[0] <= v <= years[1]
    low = sentence.lower()
    span = (years[1] - years[0] + 1) if years else 0
    if kind in ("num", "word") and span and v <= span and re.search(
            r"\b(years?|yrs|år|års|årig\w*)\b", low):
        return True                                   # derived: years of experience
    if _hedged(sentence, surface):
        floor = G.rules()["thresholds"]["hedge_round_down_floor"]
        return any(k >= v >= k * floor for k in kvals)  # rounded DOWN only, never up
    return False


_CAP = re.compile(r"^[A-ZÆØÅÄÖÜ][\w&.+#/-]*$|^[A-Z0-9]{2,}[\w&+#-]*$")


def _is_intent(sentence):
    low = sentence.lower()
    return any(low.startswith(m) or (" " + m + " ") in low for m in G.rules()["intent_markers"])


def check(draft, kernel_text, jd="", lang=None):
    """[{kind, severity, token, sentence}] for one draft."""
    lang = lang or G.detect_lang(draft)
    R = G.rules()
    kvals = kernel_numbers(kernel_text)
    span = _career_years(kernel_text)
    k_low = kernel_text.lower()
    k_tok = {w.lower() for w in G.words(kernel_text)} | {G.stem(w, lang) for w in G.words(kernel_text)}
    jd_tok = {w.lower() for w in G.words(jd)} | {G.stem(w, lang) for w in G.words(jd)}
    allow = {a.lower() for a in R["name_allowlist"]}
    creds = sorted({c for L in R["credential_words"].values() for c in L}, key=len, reverse=True)
    small = R["thresholds"]["small_number_skip"]
    out, seen = [], set()

    def add(kind, sev, tok, sent):
        key = (kind, tok.lower())
        if key not in seen:
            seen.add(key)
            out.append({"kind": kind, "severity": sev, "token": tok, "sentence": sent[:160]})

    for sent in G.sentences(G.strip_quoted(draft)):
        if _is_intent(sent):
            continue                                    # a promise, not a claim
        for v, surface, kind in numbers(sent, lang):
            if kind != "year" and v <= small:
                continue
            if not _supported(v, kind, sent, surface, kvals, span):
                add("number", "FAIL", surface, sent)
        low = sent.lower()
        for c in creds:
            if re.search(r"(?<!\w)" + re.escape(c) + r"(?!\w)", low):
                root = c[: max(5, len(c) - 3)]
                if root not in k_low:
                    add("credential", "FAIL", c, sent)
        toks = G.words(sent)
        if len(toks) < 5:                               # headings and labels, not prose
            continue
        for i, w in enumerate(toks):
            if i == 0 or not _CAP.match(w) or w.lower() in allow or w.isdigit():
                continue
            base = re.sub(r"(?:'s|’s|s)$", "", w)
            cands = {w.lower(), base.lower(), G.stem(w, lang)}
            if cands & k_tok:
                continue
            add("name", "WARN" if cands & jd_tok else "FAIL", w, sent)
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Tier-0 fact guard: draft vs kernel (FACT-GUARD-001)")
    ap.add_argument("--draft", required=True, help=".pdf / .docx / .txt")
    ap.add_argument("--kernel", required=True, help="kernel JSON (any shape; every string is read)")
    ap.add_argument("--jd", default=None, help="job ad text file (grounds names only, WARN)")
    ap.add_argument("--lang", choices=["en", "da", "sv"], default=None)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    with open(a.kernel, encoding="utf-8") as f:
        ktext = "\n".join(G.flatten(json.load(f)))
    jd = open(a.jd, encoding="utf-8").read() if a.jd else ""
    res = check(G.read_text(a.draft), ktext, jd, a.lang)
    if a.json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        for r in res:
            print("%-4s %-10s %-24s %s" % (r["severity"], r["kind"], r["token"][:24], r["sentence"][:90]))
        print("%d FAIL, %d WARN" % (sum(r["severity"] == "FAIL" for r in res),
                                    sum(r["severity"] == "WARN" for r in res)))
    sys.exit(1 if any(r["severity"] == "FAIL" for r in res) else 0)


if __name__ == "__main__":
    main()
