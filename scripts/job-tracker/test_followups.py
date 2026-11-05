# FOLLOWUP-001 — follow-up dates for submitted applications.
# Run: python scripts/job-tracker/test_followups.py   (exit 0 = pass)
# Network-free: get_doc / put_doc are stubbed; the doc is synthetic.
import datetime
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("fu", os.path.join(HERE, "followups.py"))
fu = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fu)

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


def row(uk, status, company="Acme Optics", role="Project Manager"):
    return [1, company, role, "Copenhagen", "", "Weekly", "T1", "OPEN", status, "", "", uk, "FFF2CC"]


D = datetime.date
TODAY = D(2026, 11, 20)
doc = {"rows": [row("acme", "Submitted"), row("beta", "Submitted", "Beta A/S"), row("gamma", "Interview"),
                row("delta", "CV/CL drafted"), row("eps", "Submitted", "Eps ApS")],
       "urls": {"acme": "https://acme.example/job/1"}, "notes": {"acme": {"hm": "Jens Hansen"}},
       "artifacts": {"acme": {"application_id": 4711}},
       "followups": {"beta": {"submitted": "2026-11-15", "submitted_source": "owner"},
                     "eps": {"submitted": "2026-10-01", "submitted_source": "owner",
                             "sent": ["2026-10-12", "2026-10-25"]}}}

got = fu.stamp(doc, D(2026, 11, 1))
check("stamp: only Submitted rows with no date get today", got, ["acme"])
check("stamp: marked as first-seen (a lower bound)", doc["followups"]["acme"],
      {"submitted": "2026-11-01", "submitted_source": "first-seen"})
check("stamp: an owner date is never overwritten", fu.stamp(doc, TODAY), [])

d = fu.due(doc, TODAY)
check("due: 19 quiet days -> due; 5 days -> not yet; two follow-ups -> never a third; interview -> no",
      [r["uk"] for r in d], ["acme"])
check("due: carries what drafting needs", (d[0]["quiet_days"], d[0]["hiring_manager"], d[0]["posting"],
                                            d[0]["application_id"], d[0]["sent"]),
      (19, "Jens Hansen", "https://acme.example/job/1", 4711, 0))

fu.log(doc, "acme", D(2026, 11, 20))
check("log: a follow-up resets the quiet clock (beta, owner date 11-15, is due on 11-25)",
      [r["uk"] for r in fu.due(doc, D(2026, 11, 25))], ["beta"])
d = {r["uk"]: r for r in fu.due(doc, D(2026, 12, 1))}
check("due: 11 days after the first follow-up -> due again, flagged as the last one",
      (d["acme"]["sent"], d["acme"]["last_allowed"], d["acme"]["since_kind"], d["acme"]["quiet_days"]),
      (1, True, "follow-up", 11))
check("due: most quiet first", [r["uk"] for r in fu.due(doc, D(2026, 12, 1))], ["beta", "acme"])
fu.log(doc, "acme", D(2026, 12, 1))
try:
    fu.log(doc, "acme", D(2026, 12, 20))
    third = "logged"
except ValueError:
    third = "refused"
check("log: a third follow-up is refused", third, "refused")
fu.log(doc, "gamma", D(2026, 11, 21), "thanks")
check("log: a thank-you note is logged apart from follow-ups", doc["followups"]["gamma"], {"thanks": ["2026-11-21"]})
try:
    fu.log(doc, "nope", TODAY)
    unknown = "logged"
except KeyError:
    unknown = "refused"
check("log: an unknown urlkey is refused", unknown, "refused")

doc2 = {"rows": [row("x", "Submitted")], "followups": {"x": {"submitted": "snart"}}}
check("due: an unreadable date is reported, never guessed", "date_problem" in fu.due(doc2, TODAY)[0], True)
fu.set_submitted(doc2, "x", D(2026, 10, 1))
check("set-submitted: owner date replaces it", doc2["followups"]["x"], {"submitted": "2026-10-01",
                                                                       "submitted_source": "owner"})

# rev-safe write: a 409 re-reads and re-applies once
state = {"rev": 1, "doc": {"rows": [row("r1", "Submitted")]}, "puts": 0}


def fake_get():
    return state["rev"], json.loads(json.dumps(state["doc"]))


def fake_put(d, rev):
    state["puts"] += 1
    if state["puts"] == 1:
        state["rev"] = 2
        return 409, {"rev": 2}
    state["doc"] = d
    return 200, {"rev": 3}


g, p = fu.get_doc, fu.put_doc
fu.get_doc, fu.put_doc = fake_get, fake_put
try:
    fu._write(lambda dd: fu.stamp(dd, TODAY))
finally:
    fu.get_doc, fu.put_doc = g, p
check("write: 409 -> re-read and re-apply, then one 200", (state["puts"], state["doc"]["followups"]["r1"]["submitted"]),
      (2, "2026-11-20"))

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - followups (%d checks)" % sum(1 for ln in open(__file__, encoding="utf-8") if ln.lstrip().startswith("check(")))
