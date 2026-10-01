#!/usr/bin/env python3
"""COURSE-CHECKLIST-DEFAULT-001 - The Checklist (course compendium p 22) runs
by default on every CV the job-tracker pipeline produces. No network: the
gen-runner relay/proxy calls and the export renderer are stubbed.
Run: python test_checklist_default.py  (exit 0 = green).

Proves:
  - gen-runner `run` writes checklist_<uk>.md/.json beside the review bundle by
    default, puts a one-line summary in index.json, and --no-checklist turns it off;
  - a crash inside the checklist never breaks generation (bundle + index still written);
  - export_pdfs writes <name>.checklist.md/.json beside every CV PDF by default;
  - the report keeps the 8 p 22 group headings verbatim, one line per item;
  - sections_to_text reads AntCV structured cv_sections (profile, roles, bullets).
"""
import argparse, importlib.util, json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import course_checklist as CC

_spec = importlib.util.spec_from_file_location("genrun_chk", os.path.join(HERE, "gen-runner.py"))
G = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(G)

_n = 0
_fail = 0


def ok(name, cond):
    global _n, _fail
    _n += 1
    print(("PASS " if cond else "FAIL ") + name)
    if not cond:
        _fail += 1


P22 = ["1. Overall", "2. Structure & Layout", "3. Profile (Top Section)", "4. Experience (Most Important)",
       "5. Education", "6. Skills / Competencies", "7. Personal", "8. Final Check"]

JD = ("Technical Project Manager at NKT Photonics. Run laser systems projects from concept to delivery, "
      "risk assessment, resource allocation, fiber lasers, quantum technology, laser systems. ") * 3

CV_SECTIONS = [
    {"id": "profile", "title": "Profile", "type": "rich_block",
     "items": [{"b": "", "t": "NKT Photonics needs laser systems delivered.\nI cut cycle time by 30%.\n"
                              "Risk assessment is my daily tool.\nI lead optical engineers.\n"
                              "Resource allocation across teams.", "bullets": []}]},
    {"id": "experience", "title": "Experience", "type": "experience",
     "roles": [{"title": "Project Manager", "company": "Lasers A/S", "years": "2020 - present",
                "bullets": ["Delivered 14 laser systems projects on time", "Reduced rework by 40%"]},
               {"title": "Engineer", "company": "Optics ApS", "years": "2015 - 2020",
                "bullets": ["Shipped 3 fiber lasers to production"]}]},
    {"id": "core_comp", "title": "Skills", "type": "table",
     "rows": [["Focus Area", "Strategic Expertise"], ["Delivery", "Gate reviews"]]},
    {"id": "hidden_x", "title": "Secret", "hidden": True, "content": "should not appear"},
]
PI = {"name": "Anna Example", "email": "anna@example.com", "phone": "+45 12 34 56 78",
      "linkedin": "linkedin.com/in/anna"}


def test_sections_to_text_and_report():
    text = CC.sections_to_text(CV_SECTIONS, PI)
    ok("flatten: contact header first", text.splitlines()[0] == "Anna Example")
    ok("flatten: hidden section skipped", "should not appear" not in text)
    ok("flatten: role line carries its years", "Project Manager Lasers A/S 2020 - present" in text)
    ok("flatten: role bullets are bullets", "• Reduced rework by 40%" in text)
    rows = CC.check_cv(text, JD, "NKT Photonics", "Technical Project Manager")
    st = {r["item"]: r["status"] for r in rows}
    ok("flatten: profile found", st.get("5-10 lines") == CC.OK)
    ok("flatten: experience newest first",
       next(r for r in rows if r["item"] == "Chronological order")["status"] == CC.OK)
    ok("flatten: contact OK", st.get("Contact info + LinkedIn") == CC.OK)

    d = tempfile.mkdtemp(prefix="chk-")
    rep = CC.save_report(text, d, "x", JD, "NKT Photonics", "Technical Project Manager", pages=2, source="unit")
    ok("report: md + json written", rep and os.path.isfile(rep["md"]) and os.path.isfile(rep["json"]))
    md = open(rep["md"], encoding="utf8").read()
    ok("report: 8 p22 headings verbatim, in order",
       [ln[3:] for ln in md.splitlines() if ln.startswith("## ")] == P22)
    item_lines = [ln for ln in md.splitlines() if ln.startswith("- **")]
    ok("report: one line per checklist item", len(item_lines) == len(rows))
    ok("report: every line carries a status",
       all(any(f"**{s}**" in ln for s in (CC.OK, CC.WARN, CC.FAIL, CC.MANUAL)) for ln in item_lines))
    js = json.load(open(rep["json"], encoding="utf8"))
    ok("report: json groups == p22", js["groups"] == P22 and {r["group"] for r in js["rows"]} == set(P22))
    ok("report: summary line", rep["summary"].startswith("checklist p22: OK="))

    # never raises: out_dir is a FILE, so makedirs fails
    blocker = os.path.join(d, "afile")
    open(blocker, "w").close()
    logs = []
    ok("report: error -> None, logged, no raise",
       CC.save_report(text, blocker, "y", log=logs.append) is None and "[checklist] skipped" in logs[0])


# ── gen-runner default hook ─────────────────────────────────────────────────
def _row(rank, uk, role, company):
    return [rank, role, company, "", "", "", "", "", "", "", "", uk, ""]


DOC = {"rows": [_row(1, "nkt_tpm", "Technical Project Manager", "NKT Photonics")],
       "gen": {"nkt_tpm": "high"}, "queue": {"nkt_tpm": True}, "jd": {"nkt_tpm": JD * 4},
       "urls": {}, "support": {}, "signals": {}, "notes": {}, "artifacts": {}}


def _stub_runner():
    G.get_doc = lambda: (1, DOC)
    G.load_kernel = lambda *a, **k: {"identity": PI, "history": {}}
    G.compact_profile = lambda k: {"identity": PI}
    G.research = lambda *a, **k: ""
    G.capture_brand_for = lambda r: None
    G.prior_app_digest = lambda c: None
    G._same_job_baseline = lambda *a, **k: None
    G.build_plan = lambda profile, meta, tier: ({"cv_profile": {}}, G.MODEL_HIGH)
    G.drive = lambda *a, **k: {"status": "done", "coherence": {"state": "done"}, "sections": {
        "cv_profile": {"state": "done", "title": "Profile",
                       "result": "NKT Photonics gets a delivery lead.\nI cut cycle time by 30%."},
        "cl_why": {"state": "done", "title": "Why", "result": "cover letter text"}}}


def _parse(argv):
    """Build args through gen-runner's real argparse (so the default is the shipped one)."""
    got = {}
    real = G.cmd_run
    G.cmd_run = lambda a: got.setdefault("a", a)
    old = sys.argv
    try:
        sys.argv = ["gen-runner.py"] + argv
        G.main()
    finally:
        sys.argv, G.cmd_run = old, real
    return got["a"]


def test_gen_runner_default_and_optout():
    _stub_runner()
    out = tempfile.mkdtemp(prefix="genrun-chk-")
    a = _parse(["run", "--row", "nkt_tpm", "--out", out, "--no-research", "--no-brand"])
    ok("gen-runner: checklist on by default", a.checklist is True)
    G.cmd_run(a)
    md = os.path.join(out, "checklist_nkt_tpm.md")
    ok("gen-runner: checklist md beside bundle", os.path.isfile(md) and os.path.isfile(os.path.join(out, "gen_nkt_tpm.json")))
    ok("gen-runner: checklist json written", os.path.isfile(os.path.join(out, "checklist_nkt_tpm.json")))
    idx = json.load(open(os.path.join(out, "index.json"), encoding="utf8"))
    ok("gen-runner: index carries the one-line summary",
       idx[0].get("checklist", {}).get("summary", "").startswith("checklist p22:"))
    ok("gen-runner: review-only scope uses cv_* sections only",
       "cover letter text" not in open(md, encoding="utf8").read())

    out2 = tempfile.mkdtemp(prefix="genrun-nochk-")
    a2 = _parse(["run", "--row", "nkt_tpm", "--out", out2, "--no-research", "--no-brand", "--no-checklist"])
    ok("gen-runner: --no-checklist parses to False", a2.checklist is False)
    G.cmd_run(a2)
    ok("gen-runner: --no-checklist writes no checklist",
       not any(f.startswith("checklist_") for f in os.listdir(out2)))
    ok("gen-runner: --no-checklist still generates", os.path.isfile(os.path.join(out2, "gen_nkt_tpm.json")))

    # a crash inside the checklist must not break generation
    out3 = tempfile.mkdtemp(prefix="genrun-crash-")
    real = CC.check_cv
    CC.check_cv = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("boom"))
    try:
        G.cmd_run(_parse(["run", "--row", "nkt_tpm", "--out", out3, "--no-research", "--no-brand"]))
        survived = True
    except Exception:
        survived = False
    finally:
        CC.check_cv = real
    ok("gen-runner: checklist crash does not break the run", survived)
    ok("gen-runner: bundle + index still written after a checklist crash",
       os.path.isfile(os.path.join(out3, "gen_nkt_tpm.json")) and os.path.isfile(os.path.join(out3, "index.json")))

    # persisted run checks the FINAL structured CV
    out4 = tempfile.mkdtemp(prefix="genrun-persist-")
    G.persist_preflight = lambda *a, **k: None
    G.persist_application = lambda *a, **k: {"cv": CV_SECTIONS, "pages": 2}
    G._req = lambda *a, **k: (200, {})
    G.put_doc = lambda *a, **k: (200, {"rev": 2})
    G.cmd_run(_parse(["run", "--row", "nkt_tpm", "--out", out4, "--no-research", "--no-brand", "--persist"]))
    js = json.load(open(os.path.join(out4, "checklist_nkt_tpm.json"), encoding="utf8"))
    ok("gen-runner: persist -> checklist over the final CV (pages known)",
       js["pages"] == 2 and js["source"].startswith("persisted CV"))


# ── export_pdfs default hook ────────────────────────────────────────────────
def test_export_pdfs_default():
    try:
        import fitz
    except ImportError:
        print("SKIP export_pdfs test (PyMuPDF missing)"); return
    import export_pdfs as EP
    import measure_density as MD
    d = fitz.open()
    pg = d.new_page()
    pg.insert_text((50, 72), CC.sections_to_text(CV_SECTIONS, PI).replace("•", "-"), fontsize=9)
    pdf = d.tobytes()
    MD.payload_for_app = lambda app_id, doc="cv": ({}, {"jd_text": JD, "jd_company": "NKT Photonics",
                                                        "jd_role": "Technical Project Manager"})
    MD.render_pdf = lambda payload: pdf
    MD._gen_runner = lambda: G
    EP.verify_pdf = lambda *a, **k: {"pages": 1, "blank_pages": [], "notice_last_page": True,
                                     "spine_bottom": None, "banned_dashes": {}}
    for flag, expect in (([], True), (["--no-checklist"], False)):
        out = tempfile.mkdtemp(prefix="exp-chk-")
        old = sys.argv
        sys.argv = ["export_pdfs.py", "--apps", "7", "--out", out] + flag
        try:
            EP.main()
        finally:
            sys.argv = old
        have = os.path.isfile(os.path.join(out, "7_NKT_Photonics_CV.checklist.md"))
        ok(f"export_pdfs {' '.join(flag) or 'default'}: checklist beside CV PDF = {expect}", have == expect)
        ok(f"export_pdfs {' '.join(flag) or 'default'}: CL gets no checklist",
           not os.path.isfile(os.path.join(out, "7_NKT_Photonics_CL.checklist.md")))
        rep = json.load(open(os.path.join(out, "_export_report.json"), encoding="utf8"))
        cv_row = next(r for r in rep if r["doc"] == "cv")
        ok(f"export_pdfs {' '.join(flag) or 'default'}: report summary {'set' if expect else 'empty'}",
           bool(cv_row.get("checklist")) == expect)


if __name__ == "__main__":
    test_sections_to_text_and_report()
    test_gen_runner_default_and_optout()
    test_export_pdfs_default()
    print(f"\n{_n - _fail}/{_n} passed")
    sys.exit(1 if _fail else 0)
