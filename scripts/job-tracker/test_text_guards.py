# TEXT-GUARDS-001 — fact_guard.py, echo_check.py, ats_text.py truth table.
# Run: python scripts/job-tracker/test_text_guards.py   (exit 0 = pass)
#
# Network-free and synthetic: the kernel below is an invented candidate (no real
# candidate data in tests, CLAUDE.md). The ATS cases build their PDFs with PyMuPDF.
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

import ats_text  # noqa: E402
import echo_check as E  # noqa: E402
import fact_guard as F  # noqa: E402
import guard_common as G  # noqa: E402

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


KERNEL = {"identity": {"name": "Ada Nielsen", "email": "ada@example.dk"},
          "history": [
              {"employer": "Lumen Optics", "title": "Hardware Project Manager", "from": "2017", "to": "2020",
               "notes": "Led NPI of 12 laser modules; cut test time by 35%; budget EUR 2.2M; team of 45."},
              {"employer": "Photon Labs", "title": "Optical Engineer", "from": "2014", "to": "2017",
               "notes": "Designed beam combining optics in Zemax. Prøve i dansk 2."}],
          "certs": ["PRINCE2 Foundation (certified 2019)"]}
KT = "\n".join(G.flatten(KERNEL))


def kinds(res, kind=None, sev=None):
    return sorted(r["token"] for r in res if (kind is None or r["kind"] == kind) and (sev is None or r["severity"] == sev))


# ---- numbers -------------------------------------------------------------------
r = F.check("At Lumen Optics I led NPI of 12 laser modules and cut test time by 35%.", KT, lang="en")
check("fact: kernel figures pass", kinds(r, "number"), [])
r = F.check("At Lumen Optics I led NPI of 14 laser modules and cut test time by 50%.", KT, lang="en")
check("fact: changed figures fail", kinds(r, "number", "FAIL"), ["14", "50%"])
r = F.check("Som projektleder hos Lumen Optics styrede jeg et budget på 2,2 mio. EUR.", KT, lang="da")
check("fact: Danish decimal comma + mio. = the kernel's 2.2M", kinds(r, "number"), [])
r = F.check("Jeg ledede NPI af tolv lasermoduler hos Lumen Optics.", KT, lang="da")
check("fact: a Danish number word matches the kernel's 12", kinds(r, "number"), [])
r = F.check("I led a team of more than 40 engineers at Lumen Optics.", KT, lang="en")
check("fact: hedged rounding DOWN passes (over 40 from 45)", kinds(r, "number"), [])
r = F.check("I led a team of 50 engineers at Lumen Optics.", KT, lang="en")
check("fact: rounding UP fails", kinds(r, "number", "FAIL"), ["50"])
r = F.check("Hardware Project Manager at Lumen Optics 2017-20, then a new chapter.", KT, lang="en")
check("fact: a year range 2017-20 reads as 2017 and 2020", kinds(r, "number"), [])
r = F.check("I bring 6 years of hardware project management from Lumen Optics.", KT, lang="en")
check("fact: years of experience within the career span are derived, not invented",
      kinds(r, "number"), [])
r = F.check("Contact me on +45 12 34 56 78 or ada@example.dk from 05.11.2026 onwards please.", KT, lang="en")
check("fact: phones, e-mails and dates are not claims", kinds(r, "number"), [])
r = F.check("I will cut your test time by 40% in my first year at your company.", KT, lang="en")
check("fact: an intent sentence is a promise, not a claim", kinds(r), [])
r = F.check("Experience leading a team of 45 people in 2015 and 2019.", KT, lang="en")
check("fact: years inside the kernel's first..last year pass", kinds(r, "number"), [])
r = F.check("I will be ready to start in 2031 if that suits the team schedule.", KT, lang="en")
check("fact: (intent sentences are skipped even with a year)", kinds(r), [])
r = F.check("Senior architect at Lumen Optics from 2031 onwards in the laser group.", KT, lang="en")
check("fact: a year after the kernel's last year fails", kinds(r, "number", "FAIL"), ["2031"])
r = F.check("I also did lab work at Lumen Optics in 2012 as a student intern there.", KT, lang="en")
check("fact: a year the kernel does not hold fails", kinds(r, "number", "FAIL"), ["2012"])

# ---- the job ad never grounds a number or a credential --------------------------
JD = "We need a PMP certified project manager with 10 years in Zemax and Ibsen Photonics products."
r = F.check("As a PMP certified manager with 10 years in optics I fit Ibsen Photonics well.", KT, JD, lang="en")
check("fact: a JD number does not ground the draft", "10" in kinds(r, "number", "FAIL"), True)
check("fact: a JD credential does not ground the draft (PMP; 'certified' is grounded by PRINCE2)",
      kinds(r, "credential", "FAIL"), ["pmp"])
check("fact: PMP named only in the JD is a WARN, not a pass", "PMP" in kinds(r, "name", "WARN"), True)
r = F.check("I am PRINCE2 certified and worked with Zemax daily at Photon Labs.", KT, lang="en")
check("fact: kernel credentials and names pass", (kinds(r, "credential"), kinds(r, "name")), ([], []))
r = F.check("I hold a Six Sigma Black Belt from my years at Lumen Optics.", KT, lang="en")
check("fact: an invented credential fails", "six sigma" in kinds(r, "credential", "FAIL"), True)
r = F.check("I worked closely with Trumpf and Coherent on the laser modules at Lumen Optics.", KT, lang="en")
check("fact: names found nowhere fail", kinds(r, "name", "FAIL"), ["Coherent", "Trumpf"])
r = F.check("Hos Lumen Optics ledede jeg Lumen Optics' NPI med tolv moduler.", KT, lang="da")
check("fact: Danish genitive of a kernel name passes", kinds(r, "name"), [])
check("fact: a heading line is not prose", kinds(F.check("Core Competencies Overview", KT, lang="en")), [])
r = F.check("Jeg er uddannet lægesekretær og legitimerad sjuksköterska med erfaring.", KT, lang="da")
check("fact: Danish and Swedish credential words are read", kinds(r, "credential", "FAIL"),
      ["legitimerad", "uddannet"])

# ---- number parsing per language ------------------------------------------------
check("numbers: Danish 1.200 is twelve hundred", [v for v, _, _ in F.numbers("1.200 enheder", "da")], [1200.0])
check("numbers: English 1.200 is one point two", [v for v, _, _ in F.numbers("1.200 units", "en")], [1.2])
check("numbers: Swedish 20 000 with a narrow space", [v for v, _, _ in F.numbers("20 000 kr", "sv")], [20000.0])
check("numbers: 2.2M scales", [v for v, _, _ in F.numbers("EUR 2.2M", "en")], [2200000.0])
check("numbers: English 'to' is not two", [v for v, _, _ in F.numbers("went to Aarhus", "en")], [])

# ---- echo check ------------------------------------------------------------------
JD2 = ("You will drive new product introduction for our laser platforms from concept to volume. "
       "You thrive in a fast-paced environment where you take ownership of complex cross-functional projects. "
       "Experience with Zemax and ISO 13485 is an advantage.")
r = E.check("I thrive in a fast-paced environment where I take ownership of complex cross-functional projects.",
            JD2, lang="en")
check("echo: a lifted clause (pronoun swapped) is a LIFT", [x["kind"] for x in r][:1], ["LIFT"])
r = E.check("At Lumen Optics I ran NPI with Zemax and ISO 13485 for twelve laser modules.", JD2,
            keywords=["Zemax", "ISO 13485", "NPI", "laser"], lang="en")
check("echo: hard keywords repeating is fine", r, [])
r = E.check('As your posting says, "take ownership of complex cross-functional projects" is the job.', JD2, lang="en")
check("echo: openly quoted text is skipped", [x["kind"] for x in r], [])
r = E.check("Driving new product introductions for laser platforms from concept to volume is what I do.",
            JD2, lang="en")
check("echo: an inflection-swapped lift is still caught", bool(r) and r[0]["kind"] in ("LIFT", "NEAR-LIFT"), True)
JD_DA = "Du trives i et omskifteligt miljø, hvor du tager ejerskab for komplekse tværfaglige projekter."
r = E.check("Jeg trives i et omskifteligt miljø hvor jeg tager ejerskab for komplekse tværfaglige projekter.",
            JD_DA, lang="da")
check("echo: Danish lift caught", [x["kind"] for x in r][:1], ["LIFT"])
OLD = ["Dear hiring team. In my years at Lumen Optics I learned that a test plan is only as good as "
       "the failure it was written to catch. Kind regards, Ada"]
r = E.check("In my years at Lumen Optics I learned that a test plan is only as good as the failure it was "
            "written to catch.", "", letters=OLD, lang="en")
check("echo: a sentence reused from an earlier letter is REUSE", [x["kind"] for x in r], ["REUSE"])
r = E.check("Kind regards and thank you for reading my application to your team today.", "", letters=OLD, lang="en")
check("echo: sign-offs are allowed to repeat", r, [])

# ---- ATS text layer ----------------------------------------------------------------
fitz = ats_text._fitz()


def two_col_pdf(interleave):
    d = fitz.open()
    pg = d.new_page(width=595, height=842)
    side = ["Contact", "ada@example.dk", "+45 12 34 56 78", "Skills", "Zemax and optics", "Languages", "English"]
    main = ["Profile: hardware project manager with laser NPI background and test experience.",
            "Experience: Lumen Optics, Hardware Project Manager, 2017 to 2020, twelve laser modules.",
            "Led NPI of laser modules and cut test time by a third across three product lines.",
            "Photon Labs, Optical Engineer, 2014 to 2017, beam combining optics in Zemax daily.",
            "Education: MSc in physics with a thesis on fibre lasers and their thermal limits.",
            "Certifications: PRINCE2 Foundation and a short course in design of experiments.",
            "Interests: open-water swimming and a local maker space with a laser cutter."]
    ys = [80 + 90 * i for i in range(7)]
    order = [(s, m) for s, m in zip(side, main)]
    if interleave:
        for (s, m), y in zip(order, ys):
            pg.insert_textbox(fitz.Rect(30, y, 190, y + 80), s, fontsize=9)
            pg.insert_textbox(fitz.Rect(230, y, 570, y + 80), m, fontsize=9)
    else:
        for (s, _), y in zip(order, ys):
            pg.insert_textbox(fitz.Rect(30, y, 190, y + 80), s, fontsize=9)
        for (_, m), y in zip(order, ys):
            pg.insert_textbox(fitz.Rect(230, y, 570, y + 80), m, fontsize=9)
    return d


def status(rows, item):
    return next(r["status"] for r in rows if r["item"].startswith(item))


clean = ats_text.check_doc(two_col_pdf(False), email="ada@example.dk", phone="+45 12 34 56 78")
check("ats: sidebar then main reads as one switch -> OK", status(clean, "reading order"), "OK")
check("ats: e-mail and phone are literal text", (status(clean, "e-mail"), status(clean, "phone")), ("OK", "OK"))
check("ats: no garbled glyphs", status(clean, "no garbled"), "OK")
mixed = ats_text.check_doc(two_col_pdf(True), email="ada@example.dk")
check("ats: columns interleaving line by line -> FAIL", status(mixed, "reading order"), "FAIL")
gone = ats_text.check_doc(two_col_pdf(False), email="someone@else.dk")
check("ats: an e-mail missing from the text layer -> FAIL", status(gone, "e-mail"), "FAIL")
d = fitz.open()
d.new_page().insert_text((50, 80), "Short page")
check("ats: an image-only / near-empty PDF -> FAIL", status(ats_text.check_doc(d), "text present"), "FAIL")
check("ats: summary names what is wrong", "FAIL reading order" in ats_text.summary(mixed), True)

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - text guards: fact_guard, echo_check, ats_text (%d checks)" %
      sum(1 for ln in open(__file__, encoding="utf-8") if ln.lstrip().startswith("check(")))
