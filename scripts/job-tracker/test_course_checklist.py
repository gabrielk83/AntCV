#!/usr/bin/env python3
"""Self-test for course_checklist.py (COURSE-CV-CHECKLIST-001) — pure units,
no relay/network. Run: python test_course_checklist.py  (exit 0 = green).

Each FAIL/WARN rule is shown firing on a bad CV and staying quiet on a good one.
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import course_checklist as CC

_n = 0
_fail = 0


def ok(name, cond):
    global _n, _fail
    _n += 1
    if cond:
        print("PASS " + name)
    else:
        _fail += 1
        print("FAIL " + name)


JD = """Technical Project Manager, Quantum Systems. NKT Photonics builds ultra-stable fiber lasers
for quantum technology. You will run laser systems projects from concept to delivery, own risk
assessment and resource allocation, and lead optical, mechanical and electronics engineers.
Fiber lasers experience is a plus. You keep timeline, budget and quality on track and act as
primary point of contact for customers on laser systems."""

GOOD = """Anna Example
Technical Project Manager | Laser Systems & Quantum
anna@example.com  +45 12 34 56 78  linkedin.com/in/anna
Profile
NKT Photonics is taking fiber lasers into quantum technology.
I bring 12 years of laser systems projects from concept to delivery.
I cut prototype cycle time by 30% while keeping budget and quality.
I lead optical, mechanical and electronics engineers as one team.
Risk assessment and resource allocation are my daily tools.
You get a primary point of contact customers trust.
Experience
Project Manager — Lasers A/S   2020 – present
• Delivered 14 fiber lasers projects on timeline, 0 budget overruns
• Reduced rework by 40% with gate reviews
• Led risk assessment for quantum customers
Engineer — Optics ApS   2015 – 2020
• Shipped 3 laser systems to production
• Improved yield from 70% to 92%
Education
M.Sc. Physics — DTU   2013 – 2015
B.Sc. Physics — DTU   2010 – 2013
Skills
Project management, Laser systems, Risk assessment, Stakeholder management
Languages
English: fluent. Danish: upper-intermediate
Interests
Climbing, sourdough baking
References available upon request
"""

BAD = """Bob Example
Engineer
bob@example
Profile
I am looking for a role where I can grow my career goals.
Experience
Engineer — Optics ApS   2015 – 2020
• Responsible for lab equipment
• Attended meetings
Project Manager — Lasers A/S   2020 – present
• Handled tasks
Education
B.Sc. Physics — DTU   2010 – 2013
M.Sc. Physics — DTU   2013 – 2015
Languages
English C2, Danish B2
Personal
Married, two children
"""


def status(rows, item):
    return next(r["status"] for r in rows if r["item"] == item)


def test_good():
    rows = CC.check_cv(GOOD, JD, company="NKT Photonics", title="Technical Project Manager", pages=2, has_photo=True)
    fails = [r for r in rows if r["status"] == CC.FAIL]
    ok("good: no FAIL rows", not fails)
    ok("good: keywords OK", status(rows, "Uses keywords from the job post") == CC.OK)
    ok("good: headline OK", status(rows, "Catchy, relevant headline") == CC.OK)
    ok("good: profile 5-10 lines", status(rows, "5-10 lines") == CC.OK)
    ok("good: profile names company", status(rows, "Motivation: why them / this role") == CC.OK)
    ok("good: employer-focused", status(rows, "Written for the employer") == CC.OK)
    ok("good: experience reverse-chrono", status(rows, "Chronological order") == CC.OK)
    ok("good: results bullets", status(rows, "Bullets are results, not tasks") == CC.OK)
    ok("good: language words", status(rows, "Language levels in words") == CC.OK)
    ok("good: no private details", status(rows, "No overly private details") == CC.OK)
    ok("good: contact OK", status(rows, "Contact info + LinkedIn") == CC.OK)
    ok("good: references OK", status(rows, "'References available upon request'") == CC.OK)


def test_bad():
    rows = CC.check_cv(BAD, JD, company="NKT Photonics", title="Technical Project Manager", pages=3, has_photo=False)
    ok("bad: 3 pages FAIL", status(rows, "Max 1-2 pages") == CC.FAIL)
    ok("bad: company missing WARN", status(rows, "Tailored to the company") == CC.WARN)
    ok("bad: keywords FAIL", status(rows, "Uses keywords from the job post") == CC.FAIL)
    ok("bad: self-focused profile WARN", status(rows, "Written for the employer") == CC.WARN)
    exp_order = [r for r in rows if r["item"] == "Chronological order"]
    ok("bad: experience out of order FAIL", exp_order[0]["status"] == CC.FAIL)
    ok("bad: education out of order FAIL", exp_order[1]["status"] == CC.FAIL)
    ok("bad: task bullets WARN", status(rows, "Bullets are results, not tasks") == CC.WARN)
    ok("bad: CEFR letters only FAIL", status(rows, "Language levels in words") == CC.FAIL)
    ok("bad: private details WARN", status(rows, "No overly private details") == CC.WARN)
    ok("bad: contact FAIL", status(rows, "Contact info + LinkedIn") == CC.FAIL)
    ok("bad: references FAIL", status(rows, "'References available upon request'") == CC.FAIL)


def test_mixed_language_level():
    # Gabriel's own CV wrote "Danish (B2 / FVU Trin 3)" next to worded levels: a WARN, not a FAIL.
    rows = CC.check_cv("Languages\nEnglish: native. Danish (B2 / FVU Trin 3)\n")
    ok("mixed: letters beside words WARN", status(rows, "Language levels in words") == CC.WARN)


def test_no_inputs_is_manual():
    rows = CC.check_cv(GOOD)
    ok("no jd: keywords MANUAL", status(rows, "Uses keywords from the job post") == CC.MANUAL)
    ok("no pages: page count MANUAL", status(rows, "Max 1-2 pages") == CC.MANUAL)


def test_read_txt_and_docx():
    d = tempfile.mkdtemp()
    p = os.path.join(d, "cv.txt")
    with open(p, "w", encoding="utf8") as f:
        f.write(GOOD)
    text, pages, photo = CC.read_cv(p)
    ok("read txt", "NKT Photonics" in text and pages is None)
    import zipfile
    q = os.path.join(d, "cv.docx")
    body = "".join(f"<w:p><w:r><w:t>{line}</w:t></w:r></w:p>" for line in ["Profile", "Hello there"])
    with zipfile.ZipFile(q, "w") as z:
        z.writestr("word/document.xml", f"<w:document><w:body>{body}</w:body></w:document>")
    text, pages, photo = CC.read_cv(q)
    ok("read docx paragraphs", text.splitlines() == ["Profile", "Hello there"] and photo is False)


def test_antcv_slogan_profile_and_referees():
    """AntCV puts a slogan where PROFILE was and names referees with
    'contact details available upon request' (course pointer)."""
    cv = """Anna Example
Technical Project Manager | Laser Systems
anna@example.com  linkedin.com/in/anna
FROM FIRST PROTOTYPE TO QUANTUM DELIVERY
Who I Am: I am a technical project manager with 12 years in laser systems.
How I Work: I put decisions in writing and stay calm in the lab.
What I Bring: NKT Photonics builds fiber lasers. I will cut cycle time by 30%.
PROFESSIONAL EXPERIENCE
Project Manager - Lasers A/S  2020 - present
References  Jane Doe, Head of R&D, Lasers A/S and John Roe, CTO, Optics ApS - contact details available upon request.
"""
    r = {(x["group"], x["item"]): x for x in CC.check_cv(cv, JD, company="NKT Photonics")}
    ok("slogan profile found (no FAIL)", r.get(("3. Profile (Top Section)", "Profile section present")) is None
       and r[("3. Profile (Top Section)", "5-10 lines")]["detail"].startswith("3 line"))
    ok("slogan profile names the company", r[("3. Profile (Top Section)", "Motivation: why them / this role")]["status"] == "OK")
    ok("named referees + 'upon request' pass", r[("8. Final Check", "'References available upon request'")]["status"] == "OK")
    bad = cv.replace("Who I Am:", "I am:").replace(" - contact details available upon request", "")
    r2 = {(x["group"], x["item"]): x for x in CC.check_cv(bad, JD, company="NKT Photonics")}
    ok("no 'Who I Am' and no heading still FAILs", r2[("3. Profile (Top Section)", "Profile section present")]["status"] == "FAIL")
    ok("referees without 'upon request' still FAIL", r2[("8. Final Check", "'References available upon request'")]["status"] == "FAIL")


if __name__ == "__main__":
    test_good()
    test_bad()
    test_mixed_language_level()
    test_no_inputs_is_manual()
    test_read_txt_and_docx()
    test_antcv_slogan_profile_and_referees()
    print(f"\n{_n - _fail}/{_n} passed")
    sys.exit(1 if _fail else 0)
