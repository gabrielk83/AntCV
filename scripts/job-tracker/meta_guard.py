#!/usr/bin/env python3
"""meta_guard.py — META-LEAK-GATE-001 (TEXT-GUARDS-001 family, 2026-11-05).

Tier-0 detector for model meta-commentary: the model talking ABOUT its task, its
prompt or the review instead of writing the section. Real CV or letter prose never
does this, so any hit is a FAIL.

Found 2026-11-05: a stored CV carried a visible SELECTED OUTCOMES bullet that read
"The instructions above concern the Selected Outcomes CV section (the format I
produced). However, the review items list fixes for sections including
'cl_what_i_bring' ...". The proxy's coherence repair wrote it; its
stripRepairMeta belt drops only LEADING narration lines with its own pattern
list. The runner's only detector (_WHY_META_RX) checked the cover letter's WHY
section and nothing else. This module is that detector, widened, for every
cv_* / cl_* section.

  check(text)            [{kind, severity, rule, token, sentence}] per offending line/sentence
  hits(text)             [(rule, matched text)]
  strip(text)            text without the offending lines (multi-line) or sentences (one line);
                         '' when fewer than three words are left
  scrub_sections(secs)   remove commentary from stored-shape sections IN PLACE; returns findings
  scan_sections(secs)    the same findings without touching secs (the read-only sweep)

English, Danish, Swedish. Precision first: each rule needs a phrase real prose does
not use ("the instructions above", "review items", a cv_/cl_ section id), because a
false positive deletes good text.

Usage:
  python meta_guard.py --draft CV.pdf [--json]      exit 1 on any hit
"""
import argparse
import copy
import json
import re
import sys

_NOT_BY = r"(?!\s+(?:by|from|of)\b)"   # "as requested by the customer" is real content

RULES = [
    # the prompt as an object
    ("instructions",
     r"\b(?:the|these|those|your|my)\s+(?:above|below|following|previous|original|earlier)\s+instructions?\b"
     r"|\binstructions?\s+(?:above|below)\b"),
    # the coherence review leaking through its repair
    ("review",
     r"\breview[- ]items?\b|\b(?:coherence|cross-section)\s+review\b"
     r"|\b(?:per|following|according\s+to|apply|applying|applied)\s+the\s+review\b"
     # verbs only: "the review notes / lists" can be a real noun phrase in a QA CV
     r"|\bthe\s+review(?:'s)?\s+(?:listed|asks|asked|flagged|says|said|wants|keeps|kept|instructs|instructed"
     r"|directs|directed|fix\s+instructions)\b"
     r"|\brepetition\s+(?:fix(?:es)?|items?)\b"
     r"|\bthe\s+issues\s+(?:above|below|listed|raised)\b|\bauthoritative\s+source\b"),
    # internal section ids (cv_outcomes, cl_what_i_bring) never belong in prose
    ("section-id", r"(?<![\w-])(?:cv|cl)_[a-z]+(?:_[a-z]+)*\b"),
    # a section named as a section of the document
    ("section-name",
     r"\b(?:selected\s+outcomes|core\s+competencies|what\s+i\s+bring|why\s+this\s+position|who\s+i\s+am"
     r"|how\s+i\s+see\s+the\s+role|how\s+i\s+(?:would|will)\s+contribute|work\s+style)"
     r"\s+(?:cv\s+|cl\s+|cover[- ]letter\s+)?section\b"
     r"|\b(?:this|the|that|other|each|every)\s+(?:cv|cover[- ]letter|letter)\s+sections?\b"),
    # the model describing its own output
    ("own-output",
     r"\b(?:format|section|output|response|answer)\s+(?:that\s+)?i(?:'ve|\s+have|\s+had)?\s+(?:just\s+)?"
     r"(?:produced|generated|returned|wrote|written|provided|gave)\b"
     r"|\bi(?:'ve|\s+have)?\s+(?:produced|generated|returned|rewritten|revised|written)\s+(?:the|this|a|an)\s+"
     r"(?:(?:revised|corrected|updated|rewritten|shorter|tighter|requested|new|final)\s+)?(?:version|section|output|response)"
     r"(?=\s*(?:$|[.,;:!)\]]|\s(?:above|below|here)\b))"
     r"|\bi(?:'ve|\s+have)?\s+kept\s+(?:the\s+)?(?:same\s+|exact\s+|original\s+)?(?:format|structure|wording)\b"
     r"|\b(?:my|your)\s+previous\s+(?:version|draft|output|response|answer)\b"),
    ("here-is",
     r"\bhere(?:'s|\s+is|\s+are)\s+(?:the|a|an|my|your)\s+"
     r"(?:revised|corrected|updated|rewritten|tightened|shortened|improved|requested|version|section|draft|output|response)\b"
     r"|^\s*(?:below|above)\s+is\s+(?:the|a|an|my)\b"
     r"|^\s*(?:revised|corrected|updated|rewritten|final)\s+(?:version|section|text|draft|output)\s*:"),
    ("as-requested",
     r"(?:^|[.!?;:(]\s*)as\s+(?:you\s+)?(?:requested|instructed|asked)\b" + _NOT_BY +
     r"|\bas\s+(?:you\s+)?requested\s*[,.;:)]"
     r"|\bas\s+per\s+(?:your|the)\s+(?:request|instructions?|brief|prompt)\b"),
    ("note-preamble",
     r"^\s*[*_(\[]*\s*(?:note|nb|n\.b\.|editor'?s\s+note|disclaimer|bemærk|bemaerk|obs|notera|observera)\s*[*_]*\s*[:!]"
     r"|\(\s*(?:note|nb|bemærk|obs)\s*:"),
    ("assistant",
     r"\bas\s+an\s+ai\b|\bas\s+a\s+(?:large\s+)?language\s+model\b|\bthe\s+(?:user|system)\s+(?:prompt|message)\b"
     r"|\b(?:possible|prompt|attempted)\s+injection\b|\bi\s+have\s+ignored\s+(?:it|that|this)\b"
     r"|\bi\s+(?:cannot|can't|can\s+not|will\s+not|won'?t)\s+(?:comply|fabricate|invent)\b"
     r"|\b(?:i\s+(?:have\s+)?)?drafted\s+(?:only\s+)?from\s+the\s+(?:legitimate|real|actual)\b"
     r"|^\s*(?:sure|certainly|of\s+course|absolutely)\s*[,!]\s"
     r"|\bthe\s+(?:job\s+description|job\s+posting|job\s+ad(?:vert)?|listing|prompt)\b[^.]{0,140}"
     r"\b(?:injection|bracketed|fragment|boilerplate|excerpt|placeholder)\b"),
    ("da",
     r"\b(?:instruktionerne|instrukserne|anvisningerne)\s+(?:ovenfor|herover|nedenfor)\b"
     r"|\bovenstående\s+(?:instruktioner|instrukser|anvisninger)\b"
     r"|\bher\s+er\s+(?:den|det|de)\s+(?:reviderede|rettede|opdaterede|omskrevne|ønskede|forbedrede)\b"
     r"|(?:^|[.!?;:(]\s*)som\s+(?:ønsket|anmodet|bedt\s+om)\b(?!\s+af\b)|\bsom\s+du\s+(?:bad\s+om|ønskede)\b"
     r"|\bjeg\s+har\s+(?:produceret|genereret|omskrevet)\s+(?:denne|dette|den|det)\s+(?:sektion|afsnit|version|tekst|output)\b"
     r"|\b(?:review|gennemgangs?)-?punkterne\b|\bsom\s+(?:en\s+)?sprogmodel\b|\bsom\s+en\s+ai(?![\w-])"
     r"|\b(?:dette|denne)\s+(?:cv|ansøgnings)-?(?:sektion|afsnit)\b"),
    ("sv",
     r"\binstruktionerna\s+(?:ovan|nedan)\b|\bovanstående\s+instruktioner\b"
     r"|\bhär\s+(?:är|kommer)\s+(?:den|det|de)\s+(?:reviderade|korrigerade|uppdaterade|omskrivna|önskade|förbättrade)\b"
     r"|(?:^|[.!?;:(]\s*)som\s+(?:efterfrågat|önskat|begärt)\b(?!\s+av\b)|\bsom\s+du\s+bad\s+om\b"
     r"|\bjag\s+har\s+(?:producerat|genererat|skrivit\s+om)\s+(?:detta|denna|den|det)\s+(?:avsnitt|sektion|version|text)\b"
     r"|\bgranskningspunkterna\b|\bsom\s+(?:en\s+)?språkmodell\b|\bsom\s+en\s+ai(?![\w-])"),
]
_RX = [(name, re.compile(rx, re.I | re.M)) for name, rx in RULES]
_SENT = re.compile(r"(?<=[.!?])\s+")
_WORD = re.compile(r"[^\W_]+", re.U)


def hits(text):
    """[(rule, matched text)] for every rule that fires on text."""
    t = str(text or "")
    out = []
    for name, rx in _RX:
        m = rx.search(t)
        if m:
            out.append((name, m.group(0).strip()))
    return out


def _units(text):
    """Lines, then sentences inside each line: the unit a finding quotes and strip() removes."""
    for ln in str(text or "").split("\n"):
        for s in _SENT.split(ln.strip()):
            if s.strip():
                yield s.strip()


def check(text):
    """[{kind, severity, rule, token, sentence}] for one draft; [] when clean."""
    out = []
    if not hits(text):
        return out
    for u in _units(text):
        h = hits(u)
        if h:
            out.append({"kind": "META", "severity": "FAIL", "rule": ",".join(n for n, _ in h),
                        "token": h[0][1][:60], "sentence": u[:160]})
    if not out:   # a match that spans a sentence break: quote the text itself
        h = hits(text)
        out.append({"kind": "META", "severity": "FAIL", "rule": ",".join(n for n, _ in h),
                    "token": h[0][1][:60], "sentence": str(text).strip()[:160]})
    return out


def strip(text):
    """Text without its commentary. A multi-line section (bullets, table rows, labelled
    lines) loses whole lines; a one-line paragraph loses only the offending sentences.
    Returns '' when fewer than three words are left, so the caller can drop the slot."""
    t = str(text or "")
    if not hits(t):
        return t
    lines = t.split("\n")
    if sum(1 for ln in lines if ln.strip()) > 1:
        out = "\n".join(ln for ln in lines if not hits(ln)).strip()
    else:
        out = " ".join(s for s in _SENT.split(t.strip()) if s.strip() and not hits(s)).strip()
    if hits(out):   # a match that spanned a sentence break
        out = ""
    return out if len(_WORD.findall(out)) >= 3 else ""


_SKIP_KEYS = {"id", "type", "loc"}


def _scrub(node, path, found, row=False):
    """node without commentary, or None to drop it from its parent list."""
    if isinstance(node, str):
        f = check(node)
        if not f:
            return node
        clean = strip(node)
        action = "stripped" if clean else "dropped"
        found.extend(dict(x, path=path, action=action) for x in f)
        return clean or None
    if isinstance(node, list):
        out = []
        for i, v in enumerate(node):
            nv = _scrub(v, "%s[%d]" % (path, i), found)
            if nv is None:
                if row:
                    return None   # a table row that lost a cell is broken: drop it whole
                continue
            out.append(nv)
        return out
    if isinstance(node, dict):
        for k in list(node):
            v = node[k]
            if k in _SKIP_KEYS or k.startswith("_") or not isinstance(v, (str, list, dict)):
                continue
            if k == "rows" and isinstance(v, list):
                nv = [r for r in (_scrub(x, "%s.rows[%d]" % (path, i), found, row=True)
                                  for i, x in enumerate(v)) if r is not None]
            else:
                nv = _scrub(v, "%s.%s" % (path, k), found)
            if nv is None:
                if k == "t" and "id" not in node:
                    return None   # an item ({b, t}) whose body was commentary: drop the item
                nv = ""
            node[k] = nv
        return node
    return node


def scrub_sections(secs, doc="cv"):
    """Remove commentary from a stored-shape section list (cv_sections / cl_sections)
    IN PLACE. Findings carry path ('cv:outcomes.items[3].t') and action."""
    found = []
    for s in secs or []:
        if isinstance(s, dict):
            _scrub(s, "%s:%s" % (doc, s.get("id") or "?"), found)
    return found


def scan_sections(secs, doc="cv"):
    """scrub_sections' findings without changing secs."""
    return scrub_sections(copy.deepcopy(secs or []), doc)


def main():
    ap = argparse.ArgumentParser(description="model meta-commentary in a CV or cover letter")
    ap.add_argument("--draft", required=True, help=".pdf / .docx / .txt / .md")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    import guard_common as G
    res = check(G.read_text(a.draft))
    if a.json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        for r in res:
            print("FAIL %-14s %-24s %s" % (r["rule"][:14], r["token"][:24], r["sentence"][:90]))
        print("%d FAIL" % len(res))
    sys.exit(1 if res else 0)


if __name__ == "__main__":
    main()
