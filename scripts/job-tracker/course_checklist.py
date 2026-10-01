#!/usr/bin/env python3
"""course_checklist.py — COURSE-CV-CHECKLIST-001: the Improve Business Academy
"Effective Job Creation Strategies" CV checklist (compendium p 22) as a check
over a FINISHED CV, i.e. the text a recruiter sees.

Each of the 8 checklist groups maps to OK / WARN / FAIL where text can decide
it, and MANUAL where only a person can (tone, photo quality, "why you").
Checks read the rendered document, not cv_sections, so they apply to any CV:
an AntCV export, a house-style PDF, or a classmate's DOCX.

Usage:
  python course_checklist.py --cv CV.pdf --jd jd.txt [--company "NKT Photonics"] [--title "Technical Project Manager"] [--json]

Inputs: --cv takes .pdf (PyMuPDF, else the pdftotext CLI), .docx or .txt.
Exit code: 1 when any item FAILs, else 0.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import zipfile

OK, WARN, FAIL, MANUAL = "OK", "WARN", "FAIL", "MANUAL"

_STOP = set("""a about above after all also an and any are as at be been being both but by can could do does
during each etc for from had has have having he her his how i if in into is it its just may me more most must my
no not of on or our out over own per same she should so some such than that the their them then there these they
this those through to too under up us very was we were what when where which while who will with within would you
your yours across able ability well new work working role team teams position job candidate experience years year
strong good great including include includes like other others based help make making want looking join day
og i at en et er til af for med på som der det de har vi du din dit dine vores eller ikke kan skal""".split())

_SECTION_HEADS = {
    "profile": r"profile|profil|summary|about me|professional summary|om mig",
    "experience": r"experience|erfaring|employment|work history|career|professional experience|erhvervserfaring",
    "education": r"education|uddannelse|academic",
    "skills": r"skills|competenc|kompetence|technical arsenal|tools",
    "languages": r"languages|sprog",
    "interests": r"interests|interesser|personal|hobbies|fritid|beyond work",
}
_YEAR_RANGE = re.compile(r"\b((?:19|20)\d{2})\s*(?:[-–—]|to|til)\s*((?:19|20)\d{2}|present|now|nu|today|d\.d\.)", re.I)
_CEFR = re.compile(r"\b[ABC][12]\b")
_LEVEL_WORDS = re.compile(r"native|mother tongue|fluent|proficient|professional|advanced|upper[- ]intermediate|"
                          r"intermediate|conversational|basic|beginner|modersmål|flydende|godt|grundlæggende", re.I)
_SELF_FOCUS = re.compile(r"\b(i am looking for|i'?m looking for|i want to|i wish to|my goal is|my career goals?|"
                         r"seeking a (?:position|role|job)|looking for a (?:position|role|job)|"
                         r"opportunity to grow|i hope to)\b", re.I)
_PRIVATE = re.compile(r"\b(marital status|married|divorced|date of birth|born on|cpr|religion|"
                      r"children|health|diagnos\w*|hearing|disabilit\w*|pregnan\w*)\b", re.I)
_RESULT = re.compile(r"\d|%|\b(reduced|increased|cut|saved|grew|improved|delivered|launched|shipped|won|"
                     r"halved|doubled|achieved|raised|lowered|shortened|reduc\w+|øge\w*|reducere\w*|leverede)\b", re.I)
_BULLET = re.compile(r"^\s*(?:[•●▪◦\-–*·]|\d+[.)])\s+")
_REFS = re.compile(r"referen\w*[^.\n]{0,40}(request|forespørgsel|anmodning|available|tilgængelig)|"
                   r"(request|forespørgsel)[^.\n]{0,30}referen", re.I)


# ── text extraction ─────────────────────────────────────────────────────────
def read_cv(path):
    """Return (text, pages, has_image_on_p1). pages/images are None when unknown."""
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        try:
            import fitz  # PyMuPDF
            d = fitz.open(path)
            text = "\n".join(d[p].get_text() for p in range(d.page_count))
            return text, d.page_count, bool(d[0].get_images()) if d.page_count else False
        except ImportError:
            if not shutil.which("pdftotext"):
                raise SystemExit("PDF input needs PyMuPDF (pip install pymupdf) or the pdftotext CLI")
            text = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True).stdout
            return text, text.count("\f") + (0 if text.endswith("\f") else 1), None
    if ext == ".docx":
        with zipfile.ZipFile(path) as z:
            xml = z.read("word/document.xml").decode("utf8")
            imgs = any(n.startswith("word/media/") for n in z.namelist())
        paras = re.findall(r"<w:p[ >].*?</w:p>", xml, re.S)
        text = "\n".join("".join(re.findall(r"<w:t[^>]*>([^<]*)</w:t>", p)) for p in paras)
        return text, None, imgs
    with open(path, encoding="utf8") as f:
        return f.read(), None, None


def split_sections(text):
    """Map section name -> its lines. Lines before the first heading go to 'header'."""
    out, cur = {"header": []}, "header"
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        hit = None
        if len(line) <= 40:
            for name, pat in _SECTION_HEADS.items():
                if re.fullmatch(r"(?:[A-ZÆØÅ&\s/]+:?\s*)?(?:%s)[\w\s&/-]*:?" % pat, line, re.I):
                    hit = name
                    break
        if hit:
            cur = hit
            out.setdefault(cur, [])
        else:
            out.setdefault(cur, []).append(line)
    return out


def jd_keywords(jd, n=15):
    """Top JD terms: two-word phrases that repeat, then single words, by frequency."""
    words = [w for w in re.findall(r"[a-zæøåA-ZÆØÅ][a-zæøåA-ZÆØÅ0-9+#/-]{2,}", jd)]
    low = [w.lower() for w in words]
    freq = {}
    for w in low:
        if w not in _STOP:
            freq[w] = freq.get(w, 0) + 1
    bi = {}
    for a, b in zip(low, low[1:]):
        if a not in _STOP and b not in _STOP:
            bi[a + " " + b] = bi.get(a + " " + b, 0) + 1
    phrases = [p for p, c in sorted(bi.items(), key=lambda x: -x[1]) if c >= 2][:5]
    covered = set(w for p in phrases for w in p.split())
    singles = [w for w, c in sorted(freq.items(), key=lambda x: (-x[1], x[0])) if w not in covered]
    return (phrases + singles)[:n]


def _start_years(lines):
    return [int(m.group(1)) for line in lines for m in [_YEAR_RANGE.search(line)] if m]


def _reverse_chrono(years):
    return all(a >= b for a, b in zip(years, years[1:]))


# ── the checklist ───────────────────────────────────────────────────────────
def check_cv(text, jd="", company=None, title=None, pages=None, has_photo=None):
    """Return a list of {group, item, status, detail} rows, in checklist order."""
    rows = []
    add = lambda g, i, s, d="": rows.append({"group": g, "item": i, "status": s, "detail": d})
    sec = split_sections(text)
    flat = " ".join(text.split())
    low = flat.lower()

    # 1. Overall
    g = "1 Overall"
    if company:
        add(g, "Tailored to the company", OK if company.lower() in low else WARN,
            "company named" if company.lower() in low else f"'{company}' never appears in the CV")
    else:
        add(g, "Tailored to the company", MANUAL, "pass --company to check")
    if jd.strip():
        kws = jd_keywords(jd)
        hit = [k for k in kws if k in low]
        pct = round(100 * len(hit) / len(kws)) if kws else 0
        miss = [k for k in kws if k not in hit][:6]
        add(g, "Uses keywords from the job post", OK if pct >= 60 else WARN if pct >= 40 else FAIL,
            f"{len(hit)}/{len(kws)} ({pct}%) of top job-post terms; missing: {', '.join(miss) or 'none'}")
    else:
        add(g, "Uses keywords from the job post", MANUAL, "pass --jd to check")
    head = " ".join(sec.get("header", [])[:6]).lower()
    if title:
        tw = [w for w in re.findall(r"\w+", title.lower()) if w not in _STOP]
        share = [w for w in tw if w in head]
        add(g, "Catchy, relevant headline", OK if len(share) >= max(1, len(tw) // 2) else WARN,
            f"headline shares {len(share)}/{len(tw)} words with the job title")
    else:
        add(g, "Catchy, relevant headline", MANUAL, "pass --title to check relevance")
    add(g, "Answers: why you for this role?", MANUAL, "read the profile as the recruiter")

    # 2. Structure & layout
    g = "2 Structure & layout"
    if pages is None:
        add(g, "Max 1-2 pages", MANUAL, "page count unknown for this input")
    else:
        add(g, "Max 1-2 pages", OK if pages <= 2 else FAIL, f"{pages} page(s)")
    add(g, "Clean, simple, easy to scan", MANUAL)
    if has_photo is None:
        add(g, "Photo is a good headshot", MANUAL)
    else:
        add(g, "Photo is a good headshot", MANUAL if has_photo else WARN,
            "photo found; judge quality by eye" if has_photo else "no photo (fine only if the employer discourages one)")
    found = [s for s in _SECTION_HEADS if s in sec]
    bullets = sum(1 for line in text.splitlines() if _BULLET.match(line))
    add(g, "Clear headings and bullet points", OK if len(found) >= 3 and bullets >= 5 else WARN,
        f"{len(found)} standard headings, {bullets} bullets")
    add(g, "Consistent formatting", MANUAL)

    # 3. Profile
    g = "3 Profile"
    prof = sec.get("profile")
    if not prof:
        add(g, "Profile section present", FAIL, "no Profile/Summary heading found")
    else:
        n = len(prof)
        add(g, "5-10 lines", OK if 5 <= n <= 10 else WARN, f"{n} line(s) as rendered")
        ptxt = " ".join(prof)
        if company:
            add(g, "Motivation: why them / this role", OK if company.lower() in ptxt.lower() else WARN,
                "names the company" if company.lower() in ptxt.lower() else "profile never names the company")
        else:
            add(g, "Motivation: why them / this role", MANUAL)
        add(g, "Qualifications with a past result", OK if re.search(r"\d", ptxt) else WARN,
            "has a number" if re.search(r"\d", ptxt) else "no quantified result in the profile")
        add(g, "Mentions the value you bring", MANUAL)
        m = _SELF_FOCUS.search(ptxt)
        add(g, "Written for the employer", WARN if m else OK, f"'{m.group(0)}'" if m else "")

    # 4. Experience
    g = "4 Experience"
    exp = sec.get("experience", [])
    ys = _start_years(exp)
    if len(ys) < 2:
        add(g, "Chronological order", MANUAL, "fewer than 2 dated roles found")
    else:
        add(g, "Chronological order", OK if _reverse_chrono(ys) else FAIL,
            "newest first" if _reverse_chrono(ys) else f"start years out of order: {ys}")
    add(g, "Relevant roles and results only", MANUAL)
    eb = [line for line in exp if _BULLET.match(line)]
    if eb:
        res = sum(1 for b in eb if _RESULT.search(b))
        pct = round(100 * res / len(eb))
        add(g, "Bullets are results, not tasks", OK if pct >= 50 else WARN,
            f"{res}/{len(eb)} bullets ({pct}%) carry a number or result verb")
    else:
        add(g, "Bullets are results, not tasks", WARN, "no bullets in Experience")

    # 5. Education
    g = "5 Education"
    ys = _start_years(sec.get("education", []))
    if len(ys) < 2:
        add(g, "Chronological order", MANUAL, "fewer than 2 dated entries found")
    else:
        add(g, "Chronological order", OK if _reverse_chrono(ys) else FAIL,
            "newest first" if _reverse_chrono(ys) else f"start years out of order: {ys}")
    add(g, "Relevant focus / results / methods", MANUAL)

    # 6. Skills
    g = "6 Skills"
    add(g, "Aligned with role, 4-6 items", MANUAL if "skills" in sec else WARN,
        "" if "skills" in sec else "no Skills/Competencies heading found")
    langs = " ".join(sec.get("languages", []))
    if not langs:
        add(g, "Language levels in words", WARN, "no Languages section found")
    else:
        bare = [m.group(0) for m in _CEFR.finditer(langs)]
        if bare and not _LEVEL_WORDS.search(langs):
            add(g, "Language levels in words", FAIL, f"levels as letters only: {', '.join(bare)}")
        elif bare:
            add(g, "Language levels in words", WARN, f"letters next to words ({', '.join(bare)}); the course asks for words only")
        else:
            add(g, "Language levels in words", OK)

    # 7. Personal
    g = "7 Personal"
    add(g, "Shows some personality", OK if "interests" in sec else WARN,
        "" if "interests" in sec else "no Interests/Personal section found")
    priv = sorted(set(m.group(0).lower() for m in _PRIVATE.finditer(flat)))
    add(g, "No overly private details", WARN if priv else OK,
        f"check: {', '.join(priv)}" if priv else "")

    # 8. Final check
    g = "8 Final check"
    dup = next((m for line in text.splitlines() for m in [re.search(r"\b(\w{3,}) \1\b", line, re.I)] if m), None)
    add(g, "No spelling mistakes", WARN if dup else MANUAL,
        f"repeated word '{dup.group(0)}'" if dup else "run a spell checker")
    email = re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", flat)
    phone = re.search(r"\+?\d[\d\s-]{7,}\d", flat)
    li = "linkedin.com" in low
    missing = [n for n, v in (("email", email), ("phone", phone), ("LinkedIn", li)) if not v]
    add(g, "Contact info + LinkedIn", OK if not missing else FAIL, "missing: " + ", ".join(missing) if missing else "")
    add(g, "'References available upon request'", OK if _REFS.search(flat) else FAIL,
        "" if _REFS.search(flat) else "line not found")
    return rows


def main():
    ap = argparse.ArgumentParser(description="Course CV checklist (compendium p 22) over a finished CV.")
    ap.add_argument("--cv", required=True, help=".pdf, .docx or .txt")
    ap.add_argument("--jd", help="job post as a .txt file")
    ap.add_argument("--company")
    ap.add_argument("--title", help="the job title from the post")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    text, pages, photo = read_cv(a.cv)
    jd = open(a.jd, encoding="utf8").read() if a.jd else ""
    rows = check_cv(text, jd, a.company, a.title, pages, photo)
    if a.json:
        print(json.dumps(rows, ensure_ascii=False, indent=2))
    else:
        g0 = None
        for r in rows:
            if r["group"] != g0:
                g0 = r["group"]
                print("\n" + g0)
            print(f"  {r['status']:<6} {r['item']}" + (f"  ({r['detail']})" if r["detail"] else ""))
        tally = {s: sum(1 for r in rows if r["status"] == s) for s in (OK, WARN, FAIL, MANUAL)}
        print("\n" + "  ".join(f"{k}={v}" for k, v in tally.items()))
    sys.exit(1 if any(r["status"] == FAIL for r in rows) else 0)


if __name__ == "__main__":
    main()
