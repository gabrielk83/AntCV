#!/usr/bin/env python3
"""echo_check.py — ECHO-CHECK-001 (TEXT-GUARDS-001, 2026-11-05).

Tier-0 check for text a draft hands back from the job ad, and for cover-letter
sentences reused from earlier letters. Recruiters read both as generated.

  LIFT       5+ consecutive (stemmed) words shared with the job ad, with at least two
             content words that are not allowed keywords. FAIL.
  NEAR-LIFT  a draft sentence whose character 5-grams sit >= 70 % inside one job-ad
             sentence, or whose word LCS covers >= 60 % of it: a lift with a word or
             an inflection swapped. WARN.
  REUSE      a letter sentence (8+ words) found in an earlier letter, exactly or with
             word-3-shingle Jaccard >= 0.6. Salutations, sign-offs and the "My goal"
             frame are allowed. FAIL.

Hard keywords (tools, methods, certificates, the job title, the company) are SUPPOSED
to be reused, because ATS matching is literal: a shared span of three words or fewer
made of allowed keywords is never flagged. Openly quoted text is skipped.

Semantic closeness to the ad is the point of tailoring, so it is never flagged here;
embeddings may only pair sentences in a later tier.

Usage:
  python echo_check.py --draft CL.pdf --jd jd.txt [--letters DIR] [--ignore "Ibsen Photonics"]
                       [--keywords "NPI,Zemax"] [--lang da] [--json]
Exit 1 on a LIFT or a REUSE.
"""
import argparse
import glob
import json
import os
import re
import sys

import guard_common as G


def _toks(text, lang):
    return [G.stem(w, lang) for w in G.words(text)]


def _shared_runs(a, b, n):
    """Maximal runs in token list a of length >= n whose every n-gram occurs in b."""
    grams = {tuple(b[i:i + n]) for i in range(len(b) - n + 1)}
    hit = [False] * len(a)
    for i in range(len(a) - n + 1):
        if tuple(a[i:i + n]) in grams:
            for j in range(i, i + n):
                hit[j] = True
    runs, i = [], 0
    while i < len(a):
        if hit[i]:
            j = i
            while j < len(a) and hit[j]:
                j += 1
            runs.append((i, j))
            i = j
        else:
            i += 1
    return runs


def _char5(s):
    s = re.sub(r"\s+", " ", s.lower()).strip()
    return {s[i:i + 5] for i in range(len(s) - 4)}


def _lcs(a, b):
    if not a or not b:
        return 0
    prev = [0] * (len(b) + 1)
    for x in a:
        cur = [0]
        for j, y in enumerate(b):
            cur.append(prev[j] + 1 if x == y else max(prev[j + 1], cur[j]))
        prev = cur
    return prev[-1]


def _shingles(toks, k=3):
    return {tuple(toks[i:i + k]) for i in range(len(toks) - k + 1)}


def _norm_sentence(s):
    return " ".join(w.lower() for w in G.words(s))


def _allowed_set(keywords, ignore, lang):
    out = set()
    for phrase in list(keywords) + list(ignore):
        out.update(_toks(phrase, lang))
    return out


def check(draft, jd="", letters=(), keywords=(), ignore=(), lang=None):
    """[{kind, severity, text, match}] for one draft. `letters` = texts of earlier letters."""
    lang = lang or G.detect_lang(draft)
    R = G.rules()
    T = R["thresholds"]
    sw = {G.stem(w, lang) for w in G.stopwords(lang)} | G.stopwords(lang)
    allowed = _allowed_set(keywords, ignore, lang)
    tmpl = [t.lower() for t in R["template_allowlist"]]
    draft = G.strip_quoted(draft)
    out = []

    jd_sents = G.sentences(jd)
    jd_tok = _toks(jd, lang)
    for sent in G.sentences(draft):
        st = _toks(sent, lang)
        words = G.words(sent)
        # LIFT: runs of >= lift_min_tokens shared stemmed words
        for i, j in _shared_runs(st, jd_tok, T["lift_min_tokens"]):
            content = [t for t in st[i:j] if t not in sw and t not in allowed]
            if len(content) >= T["lift_min_content"]:
                out.append({"kind": "LIFT", "severity": "FAIL", "text": " ".join(words[i:j]),
                            "match": "job ad", "sentence": sent[:160]})
        if len(st) < T["near_lift_min_tokens"] or any(k["kind"] == "LIFT" and k["sentence"] == sent[:160] for k in out):
            continue
        # NEAR-LIFT: against the closest job-ad sentence, keywords removed
        core = " ".join(w for w, s in zip(words, st) if s not in allowed)
        c5 = _char5(core)
        best = (0.0, 0.0, "")
        for js in jd_sents:
            jt = _toks(js, lang)
            if len(jt) < 4:
                continue
            cont = len(c5 & _char5(js)) / len(c5) if c5 else 0.0
            lcs = _lcs([t for t in st if t not in allowed], jt) / max(1, len([t for t in st if t not in allowed]))
            if (cont, lcs) > best[:2]:
                best = (cont, lcs, js)
        if best[0] >= T["near_lift_char5_containment"] or best[1] >= T["near_lift_lcs_ratio"]:
            out.append({"kind": "NEAR-LIFT", "severity": "WARN", "text": sent[:160],
                        "match": best[2][:160], "sentence": sent[:160],
                        "score": {"char5": round(best[0], 2), "lcs": round(best[1], 2)}})

    # REUSE across earlier letters
    if letters:
        past_norm, past_sh = set(), []
        for txt in letters:
            for s in G.sentences(txt):
                past_norm.add(_norm_sentence(s))
                past_sh.append((s, _shingles([w.lower() for w in G.words(s)])))
        for sent in G.sentences(draft):
            ws = [w.lower() for w in G.words(sent)]
            if len(ws) < T["reuse_min_tokens"] or any(t in sent.lower() for t in tmpl):
                continue
            if _norm_sentence(sent) in past_norm:
                out.append({"kind": "REUSE", "severity": "FAIL", "text": sent[:160], "match": "identical",
                            "sentence": sent[:160]})
                continue
            sh = _shingles(ws)
            for ps, psh in past_sh:
                if sh and psh:
                    jac = len(sh & psh) / len(sh | psh)
                    if jac >= T["reuse_jaccard_word3"]:
                        out.append({"kind": "REUSE", "severity": "FAIL", "text": sent[:160],
                                    "match": ps[:160], "sentence": sent[:160], "score": {"jaccard": round(jac, 2)}})
                        break
    return out


def load_letters(spec, exclude=None):
    """Texts of earlier letters: a directory (pdf/docx/txt/md, recursive) or a glob."""
    if not spec:
        return []
    paths = glob.glob(os.path.join(spec, "**", "*"), recursive=True) if os.path.isdir(spec) else glob.glob(spec)
    out = []
    for p in sorted(paths):
        if not os.path.isfile(p) or os.path.splitext(p)[1].lower() not in (".pdf", ".docx", ".txt", ".md"):
            continue
        if exclude and os.path.abspath(p) == os.path.abspath(exclude):
            continue
        try:
            out.append(G.read_text(p))
        except Exception:                                     # noqa: BLE001
            continue
    return out


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Tier-0 echo check: lifts from the job ad, reuse across letters")
    ap.add_argument("--draft", required=True)
    ap.add_argument("--jd", default=None)
    ap.add_argument("--letters", default=None, help="directory or glob of earlier cover letters")
    ap.add_argument("--keywords", default="", help="comma-separated hard keywords allowed to repeat")
    ap.add_argument("--ignore", action="append", default=[], help="phrase allowed to repeat (company, title)")
    ap.add_argument("--lang", choices=["en", "da", "sv"], default=None)
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    jd = open(a.jd, encoding="utf-8").read() if a.jd else ""
    kws = [k.strip() for k in a.keywords.split(",") if k.strip()]
    res = check(G.read_text(a.draft), jd, load_letters(a.letters, exclude=a.draft), kws, a.ignore, a.lang)
    if a.json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        for r in res:
            print("%-9s %s\n          <- %s" % (r["kind"], r["text"][:110], r["match"][:110]))
        print("%d LIFT, %d NEAR-LIFT, %d REUSE" % tuple(sum(r["kind"] == k for r in res)
                                                        for k in ("LIFT", "NEAR-LIFT", "REUSE")))
    sys.exit(1 if any(r["severity"] == "FAIL" for r in res) else 0)


if __name__ == "__main__":
    main()
