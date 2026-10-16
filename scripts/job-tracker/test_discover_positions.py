# DISCOVER-URLKEY-QUERY-001 - the discovered-ledger URL key must keep the query
# parameters that carry an ad's identity. Run:
#   python scripts/job-tracker/test_discover_positions.py   (exit 0 = pass)
#
# Network-free: get_doc / put_doc are stubbed so cmd_add runs end to end on an
# in-memory doc. The case that found the bug: two HR-Manager ads differ only in
# ?cid=&ProjectId=, and the second one was skipped as "duplicate/already-proposed".
import importlib.util
import io
import json
import os
import sys
import tempfile
from contextlib import redirect_stdout

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("dp", os.path.join(HERE, "discover-positions.py"))
dp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(dp)

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


FMI = ("https://candidate.hr-manager.net/ApplicationInit.aspx"
       "?cid=3010&ProjectId=171037&DepartmentId=20125&MediaId=4735")
OTHER = ("https://candidate.hr-manager.net/ApplicationInit.aspx"
         "?cid=1694&ProjectId=143818&DepartmentId=18818&MediaId=5")

# ---- the key itself ---------------------------------------------------------
check("two hr-manager ads yield distinct keys", dp._norm_url(FMI) != dp._norm_url(OTHER), True)
check("the key carries cid + ProjectId, lower-cased, sorted",
      dp._norm_url(FMI), "candidate.hr-manager.net/applicationinit.aspx?cid=3010&projectid=171037")
check("MediaId / DepartmentId (channel, not identity) are not in the key",
      "mediaid" in dp._norm_url(FMI) or "departmentid" in dp._norm_url(FMI), False)
check("the same ad through another channel collapses to one key",
      dp._norm_url(FMI), dp._norm_url(FMI.replace("MediaId=4735", "MediaId=1")))
check("parameter order does not matter",
      dp._norm_url("https://x.dk/a?ProjectId=1&cid=2"), dp._norm_url("https://x.dk/a?cid=2&ProjectId=1"))
check("a utm_-only query still collapses to the path key",
      dp._norm_url("https://www.jobindex.dk/vis-job/h1708079?utm_source=x&utm_medium=y"),
      "jobindex.dk/vis-job/h1708079")
check("a path-only URL keys exactly as before (legacy ledger keys still match)",
      dp._norm_url("https://www.jobindex.dk/vis-job/h1708079/#top"), "jobindex.dk/vis-job/h1708079")
check("tracking params beside an id are dropped, the id kept",
      dp._norm_url("https://dk.indeed.com/viewjob?jk=abc123&from=serp&utm_campaign=z"),
      "dk.indeed.com/viewjob?jk=abc123")
check("SuccessFactors req id is identity",
      dp._norm_url("https://jobs.danfoss.com/job/x/career?company=danfoss&career_job_req_id=51342&career_ns=job_listing")
      != dp._norm_url("https://jobs.danfoss.com/job/x/career?company=danfoss&career_job_req_id=51343&career_ns=job_listing"),
      True)
check("an empty id value is ignored", dp._norm_url("https://x.dk/a?id=&cid=5"), "x.dk/a?cid=5")
check("None / blank input", (dp._norm_url(None), dp._norm_url("  ")), ("", ""))

# ---- _existing_keys: tracked rows + ledger ---------------------------------
doc = {
    "rows": [[1, "Some Employer", "Projektleder", "Kbh", "", "", "", "OPEN", "Identified", "", "", "some_employer", "E2EFDA"]],
    "urls": {"some_employer": OTHER},
    "discovered": {
        # a legacy ledger entry: path-only key, the full url stored beside it
        "candidate.hr-manager.net/applicationinit.aspx": {"first_seen": "2026-09-01", "uk": "some_employer",
                                                          "company": "Some Employer", "role": "Projektleder",
                                                          "url": OTHER},
    },
}
keys, uks = dp._existing_keys(doc)
check("the tracked hr-manager ad is a key", dp._norm_url(OTHER) in keys, True)
check("the FMI ad is NOT a key", dp._norm_url(FMI) in keys, False)
check("a legacy path-only ledger key is kept verbatim", "candidate.hr-manager.net/applicationinit.aspx" in keys, True)
check("a legacy ledger entry is re-keyed from its stored url", dp._norm_url(OTHER) in keys, True)
# ledger-only: the owner deleted the proposed row, so the ad lives in the ledger alone
THIRD = "https://candidate.hr-manager.net/ApplicationInit.aspx?cid=2222&ProjectId=99&MediaId=5"
doc_led = {"rows": [], "urls": {}, "discovered": {
    "candidate.hr-manager.net/applicationinit.aspx": {"first_seen": "2026-09-01", "uk": "gone",
                                                      "company": "Gone", "role": "X", "url": THIRD}}}
keys_led, _ = dp._existing_keys(doc_led)
check("a ledger-only legacy entry still blocks its own ad through the stored url",
      dp._norm_url(THIRD) in keys_led, True)
check("...but no longer blocks a different ad on the same host", dp._norm_url(FMI) in keys_led, False)


# ---- cmd_add end to end on the real function --------------------------------
def run_add(doc0, cands):
    state = {"doc": json.loads(json.dumps(doc0)), "puts": []}

    def fake_get():
        return 7, json.loads(json.dumps(state["doc"]))

    def fake_put(d, base_rev):
        state["puts"].append((base_rev, d))
        state["doc"] = d
        return 200, {"ok": True, "rev": base_rev + 1}

    g, p = dp.get_doc, dp.put_doc
    dp.get_doc, dp.put_doc = fake_get, fake_put
    try:
        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
            json.dump(cands, f)
            path = f.name
        buf = io.StringIO()
        with redirect_stdout(buf):
            dp.cmd_add(type("A", (), {"candidates": path})())
    finally:
        dp.get_doc, dp.put_doc = g, p
        os.unlink(path)
    tail = [ln for ln in buf.getvalue().splitlines() if ln.startswith("JSON ")]
    return json.loads(tail[-1][5:]) if tail else {}, buf.getvalue(), state


cands = [
    {"company": "FMI", "role": "Teknisk projektleder til Forsvarets data- og AI-projekter",
     "location": "Ballerup", "url": FMI, "why": "test"},
    {"company": "Some Employer", "role": "Projektleder (again)", "url": OTHER, "why": "same ad, new title"},
]
res, out, st = run_add(doc, cands)
check("cmd_add ADDS the FMI ad (different ProjectId on the same host)", res.get("added"), 1)
check("cmd_add still SKIPS the already-tracked hr-manager ad", res.get("skipped"), 1)
check("the skip reason is the dedup, not a missing field", "duplicate/already-proposed" in out, True)
led = st["doc"].get("discovered") or {}
check("the new ledger key carries the FMI identity",
      "candidate.hr-manager.net/applicationinit.aspx?cid=3010&projectid=171037" in led, True)
check("the ledger entry stores the full url for future re-keying",
      (led.get("candidate.hr-manager.net/applicationinit.aspx?cid=3010&projectid=171037") or {}).get("url"), FMI)
check("the proposed row is unarmed (queue=False, the hard safety gate)",
      (st["doc"].get("queue") or {}).get("fmi"), False)
# re-running the same candidates is a no-op: the ledger now blocks the FMI ad too
res2, out2, _ = run_add(st["doc"], cands)
check("a second run with the same candidates adds nothing", (res2.get("added"), res2.get("skipped")), (0, 2))

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - discover-positions url key keeps ad identity, drops tracking (%d checks)" %
      sum(1 for ln in open(__file__, encoding="utf-8") if ln.lstrip().startswith("check(")))
