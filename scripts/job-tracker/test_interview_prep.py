# INTERVIEW-PREP-001 — interview prep pack + mock interview, model-free parts.
# Run: python scripts/job-tracker/test_interview_prep.py   (exit 0 = pass)
# Synthetic doc and pack; no network, no LLM (stubbed).
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass
import interview_prep as IP  # noqa: E402

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


DOC = {"rows": [[1, "Lumen Optics A/S", "Hardware PM", "Farum", "", "", "", "", "Interview", "", "", "lumen", ""]],
       "jd": {"lumen": "We need a hardware PM for laser NPI."},
       "notes": {"lumen": {"hm": "Jens Hansen"}},
       "artifacts": {"lumen": {"application_id": 4711}},
       "submitted": {"lumen": {"application_id": 4700, "date": "2026-10-20"}},
       "financials": {"lumen": {"summary": "Lumen Optics A/S annual report ...: net result DKK 4.4m.",
                                "angles": {"questions": ["What breaks first as you scale?"],
                                           "interview": {"likely_questions": ["How have you handled a ramp-up?"],
                                                         "rehearse": ["A ramp-up story with volumes."]}}}},
       "eligibility": {"lumen": {"verdict": "FLAG", "kind": "clearance to obtain", "quote": "..."}},
       "status_history": {"lumen": [{"status": "Submitted", "date": "2026-10-20"}, {"status": "Interview", "date": "2026-11-01",
                                                                                   "stage": "screening"}]},
       "history": [{"at": "2026-09-01", "what": "legacy doc-level log"}],
       "envelope": [["Salary", "~60,000 DKK/month", "55,000-75,000 DKK/mo by scope"], ["Commuting", "45 min", ""]]}
seen = []
ctx = IP.gather(DOC, "lumen", "1st", "KERNEL", lambda app: seen.append(app) or ("CV TEXT", "CL TEXT"), "web")
check("gather: the FROZEN submitted version wins over the latest generated application",
      (seen, ctx["submitted"]["application_id"], ctx["submitted"]["frozen"]), ([4700], 4700, True))
check("gather: hiring manager, eligibility, stage history, salary envelope carried",
      (ctx["hiring_manager"], ctx["eligibility"]["verdict"], len(ctx["history"]), ctx["salary_envelope"]),
      ("Jens Hansen", "FLAG", 2, "~60,000 DKK/month / 55,000-75,000 DKK/mo by scope"))
check("gather: annual-report angles feed the pack", ctx["financials"]["interview"]["rehearse"], ["A ramp-up story with volumes."])
doc2 = json.loads(json.dumps(DOC))
del doc2["submitted"]
ctx2 = IP.gather(doc2, "lumen", "1st", "", lambda app: ("cv", "cl"))
check("gather: no frozen version -> the latest generated application, marked not frozen",
      (ctx2["submitted"]["application_id"], ctx2["submitted"]["frozen"]), (4711, False))
try:
    IP.gather(DOC, "nope", "1st")
    missing = "found"
except KeyError:
    missing = "refused"
check("gather: unknown urlkey refused", missing, "refused")
u = IP.user_turn(ctx)
check("prompt: carries the submitted texts, the figures and the salary envelope",
      all(s in u for s in ("CV TEXT", "CL TEXT", "net result DKK 4.4m", "55,000-75,000", "How have you handled a ramp-up?")),
      True)
check("system prompt: no fix-the-CV advice, salary always, kernel-only stories",
      all(s in IP.SYS for s in ('No "fix the CV"', "Salary ALWAYS", "KERNEL")), True)

PACK = IP.parse_pack('noise {"summary": "PM for laser NPI; this stage tests delivery.",'
                     '"likely_questions": [{"q": "Tell me about an NPI you led", "why": "core", "answer_outline": ["12 modules"],'
                     ' "proof": "Led NPI of 12 laser modules"}],'
                     '"star_stories": [{"title": "Laser NPI", "situation": "s", "task": "t", "action": "a", "result": "r",'
                     ' "proof": "kernel", "fits": ["NPI"]}],'
                     '"consistency": [{"claim": "cut test time 35%", "if_asked": "explain the fixture"}],'
                     '"questions_to_ask": ["What breaks first as you scale?"],'
                     '"salary": {"ask": "What is the band?", "if_asked_first": "Around 60k", "envelope": "55-75k"},'
                     '"checklist": ["Print the ad", "Two STAR stories ready"],'
                     '"mock_interview": {"opening": "Let us start.", "questions": [{"q": "Why us?", "follow_up": "And?",'
                     ' "good_answer": "links to scaling"}, {"q": "Biggest failure?", "follow_up": "", "good_answer": "owns it"}],'
                     ' "rubric": ["specific", "honest"]}} trailing')
check("parse: JSON is pulled out of surrounding text", PACK["summary"].startswith("PM for laser NPI"), True)
ctx["uk"] = "lumen"
md = IP.to_md(PACK, ctx)
check("md: tabs present in order, empty tabs skipped",
      [ln for ln in md.splitlines() if ln.startswith("## ")],
      ["## Likely questions", "## Your stories", "## What they read", "## Ask them", "## Salary", "## Mock interview",
       "## Checklist"])
check("md: checklist is tick-off, financial summary quoted on top",
      ("- [ ] Two STAR stories ready" in md, "> Lumen Optics A/S annual report" in md), (True, True))
h = IP.to_html(PACK, ctx)
check("html: self-contained, tabs + tap-to-open cards + checklist", ("<details>" in h, 'role="tab"' in h,
                                                                      'type="checkbox"' in h, "http" not in h.split("<body>")[1]),
      (True, True, True, True))
check("html: text is escaped", "<script>alert" not in IP.to_html({"summary": "<script>alert(1)</script>"}, ctx), True)

answers = iter(["We scaled from 10 to 100 units", "", "q"])
out = []
log = IP.mock(PACK, "KERNEL", ask=lambda _: next(answers), say=out.append, llm=lambda s, u: "Score 4/5. Good.")
check("mock: one answer recorded with feedback, then the user quits", [(e["q"], e["feedback"]) for e in log],
      [("Why us?", "Score 4/5. Good.")])
check("mock: follow-up shown after the feedback", "Follow-up they may ask: And?" in out, True)
check("history: status_history wins; the legacy history ARRAY is never read as a row's list",
      (len(IP.status_history(DOC, "lumen")), IP.status_history({"history": [1, 2]}, "lumen"),
       IP.status_history({"history": {"lumen": [{"status": "Submitted"}]}}, "lumen")),
      (2, [], [{"status": "Submitted"}]))
check("salary line: read from the envelope row", IP.salary_line({"envelope": [["Løn", "50k", ""]]}), "50k")

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - interview prep (%d checks)" % sum(1 for ln in open(__file__, encoding="utf-8")
                                                if ln.lstrip().startswith("check(")))
