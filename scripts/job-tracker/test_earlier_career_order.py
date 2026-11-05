"""EARLIER-CAREER-CHRONO-001 (2026-11-02): _select_and_summarize pinned the
"Earlier career" summary LAST even when a role it kept in full is older than the
summary. PEAK Wind app 3527: IDF 2001-2003 (kept on JD relevance) printed above
"Earlier career 2005 - 2014", and the course checklist failed Chronological
order ([2022, 2017, 2017, 2014, 2001, 2010, 2010, 2006]). The summary now sorts
by its end year like any role; it only goes last on a tie or when it is the
oldest entry. Drives the REAL gen-runner functions.

Run:  python scripts/job-tracker/test_earlier_career_order.py
"""
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("gr", os.path.join(HERE, "gen-runner.py"))
gr = importlib.util.module_from_spec(spec); spec.loader.exec_module(gr)

fails = 0
def check(name, ok, detail=""):
    global fails
    print(("PASS " if ok else "FAIL ") + name + (f"  ({detail})" if detail and not ok else ""))
    if not ok: fails += 1

def role(rid, title, years, bullets, cur=False):
    return {"id": rid, "title": title, "company": "Co " + rid, "years": years,
            "isCurrent": cur, "bullets": bullets, "results": None}

JD = "data analytics reporting IT infrastructure backup users project delivery requirements"
ROLES = [
    role("kanzen", "Product / Project Expert", "2022 - 2026", ["project delivery requirements reporting"], cur=True),
    role("innoviz", "System Architect", "2020 - 2025", ["requirements traceability delivery"]),
    role("innoviz-2", "Optical Engineer", "2017 - 2020", ["optics design delivery"]),
    role("sirin", "Senior Optics Engineer", "2014 - 2017", ["camera display project"]),
    role("mepro", "Electro-Optics Engineer", "2010 - 2014", ["optics characterisation"]),
    role("guard", "Security Guard", "2010", ["access incidents"]),
    role("ta", "Research Assistant", "2006 - 2010", ["devices tests"]),
    role("idf", "Computer Systems Administrator", "2001 - 2003",
         ["IT infrastructure users backup data reporting analytics IT infrastructure"]),
]

kw = gr._jd_kw(JD)
out = gr._select_and_summarize([dict(r) for r in ROLES], kw, keep=6)
ids = [r.get("id") for r in out]
ends = [gr._yr(r.get("years")) for r in out]
print("order:", list(zip(ids, ends)))

check("an Earlier career summary is built", "earlier-career" in ids, ids)
check("the old IT role is kept in full (the case under test)", "idf" in ids, ids)
check("entries run newest first by end year", all(a >= b for a, b in zip(ends, ends[1:])), ends)
if "earlier-career" in ids and "idf" in ids:
    check("Earlier career sits above the older 2001-2003 role",
          ids.index("earlier-career") < ids.index("idf"), ids)

# Control: no detailed role older than the summary -> the summary stays last.
plain = [r for r in ROLES if r["id"] != "idf"] + [role("x", "Intern", "2008 - 2009", ["devices"])]
out2 = gr._select_and_summarize([dict(r) for r in plain], gr._jd_kw("project delivery requirements reporting"), keep=6)
ids2 = [r.get("id") for r in out2]
check("control: summary is last when it is the oldest entry", ids2[-1] == "earlier-career", ids2)

# Tie: a kept role ending the same year as the summary stays above it.
tie = [r.get("id") for r in sorted(
    [{"id": "earlier-career", "years": "2005 - 2014"}, {"id": "mepro", "years": "2010 - 2014"}],
    key=gr._role_order_key)] if hasattr(gr, "_role_order_key") else []
check("tie on end year: the full role sorts above the summary", tie == ["mepro", "earlier-career"], tie)

print("\n%d failure(s)" % fails)
sys.exit(1 if fails else 0)
