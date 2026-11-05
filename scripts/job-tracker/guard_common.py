#!/usr/bin/env python3
"""guard_common.py — TEXT-GUARDS-001 shared text handling for fact_guard.py and echo_check.py.

Tier-0 (deterministic, no model, no network) building blocks, tuned for the three
languages AntCV writes in: English, Danish, Swedish. Word lists and thresholds live
in guard_rules.json so a later JS port reads the same values.

Ported in spirit from ai-job-search PRs #783 (fact_guard) and #807 (echo_check),
MIT licence, Copyright (c) 2026 Mads Lorentzen. Changed for
AntCV: Danish/Swedish number formats, number words, stemming and credential words;
the job ad never grounds a number or a credential (the proxy's numberGrounding rule).
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
RULES_PATH = os.path.join(HERE, "guard_rules.json")
_RULES = None


def rules():
    global _RULES
    if _RULES is None:
        with open(RULES_PATH, encoding="utf-8") as f:
            _RULES = json.load(f)
    return _RULES


def read_text(path):
    """Text of a .pdf / .docx / .txt / .md (course_checklist.read_cv does the formats)."""
    import course_checklist as CC
    return CC.read_cv(path)[0]


def flatten(obj, out=None):
    """Every string in a JSON value (the kernel), in document order."""
    out = [] if out is None else out
    if isinstance(obj, str):
        out.append(obj)
    elif isinstance(obj, dict):
        for v in obj.values():
            flatten(v, out)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            flatten(v, out)
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        out.append(str(obj))
    return out


_WORD = re.compile(r"[^\W_]+(?:[-'’][^\W_]+)*", re.U)


def words(text):
    return _WORD.findall(text or "")


def detect_lang(text):
    """'en' | 'da' | 'sv' by stopword hits; ties go to English."""
    toks = [w.lower() for w in words(text)]
    best, score = "en", -1
    for lang in ("en", "da", "sv"):
        sw = set(rules()["stopwords"][lang])
        n = sum(1 for t in toks if t in sw)
        if n > score:
            best, score = lang, n
    return best


_SUFFIX = {
    "da": ("erne", "ene", "ers", "ets", "ens", "er", "en", "et", "e", "s"),
    "sv": ("arna", "orna", "erna", "arne", "ens", "ets", "ar", "or", "er", "en", "et", "a", "s"),
    "en": ("ings", "ing", "ies", "ied", "ed", "es", "s"),
}


def stem(word, lang):
    """Light suffix stripping: enough to match 'projektlederen' with 'projektleder'
    and 'managing' with 'manage', not a real stemmer. Keeps a stem of 3+ letters."""
    w = word.lower().replace("’", "'")
    if w.endswith("'s"):
        w = w[:-2]
    for suf in _SUFFIX.get(lang, _SUFFIX["en"]):
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            return w[: -len(suf)]
    return w


def stopwords(lang):
    return set(rules()["stopwords"].get(lang, [])) | set(rules()["stopwords"]["en"])


_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-ZÆØÅÄÖ0-9\"“])|\n+|\s*[•●▪◦]\s*")


def sentences(text):
    """Sentence-ish units: sentence ends, line breaks and bullet glyphs all split."""
    return [s.strip() for s in _SENT.split(text or "") if s and s.strip()]


_QUOTED = re.compile(r"[\"“”„«»][^\"“”„«»]{3,200}[\"“”„«»]")


def strip_quoted(text):
    """Openly quoted text is a citation, not a claim or a lift."""
    return _QUOTED.sub(" ", text or "")
