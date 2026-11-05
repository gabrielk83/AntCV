"""JT-EARLIER-CAREER-RESULTS-DUP-001 (2026-11-05): the captured skeleton carries
the app's own stored merges (a merged "A & B" role next to its on:false
constituents). compact_jd_aware merged the constituents itself (_ROLE_MERGE)
and kept the app's merged copy too, so PEAK Wind app 3527 stored Innoviz twice
and Meprolight twice inside Earlier career; the export promoted the second
Meprolight line to "Results:". Drives the REAL compact_jd_aware.

Run:  python scripts/job-tracker/test_merge_products.py
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

def role(rid, title, co, years, on=True, cur=False):
    return {"id": rid, "title": title, "company": co, "years": years, "on": on,
            "isCurrent": cur, "bullets": [f"{title} work on project delivery {rid}."], "results": None}

# The skeleton shape of 2026-10-04 (synthetic text, real id/span/flag layout).
ROLES = [
    role("kanzen", "Product / Project Expert", "Co K", "2022 - 2026 (present)", cur=True),
    role("innoviz-ccr", "Change Request Lead", "Co I", "2020 - 2025", on=False),
    role("innoviz-ccr-2", "Change Request Lead & System Architect", "Co I", "2017 - 2025"),
    role("innoviz-sa", "System Architect", "Co I", "2017 - 2020", on=False),
    role("sirin", "Senior Optics Engineer", "Co S", "2014 - 2017"),
    role("mepro-tl", "Electro-Optics Team Leader", "Co M", "2013 - 2014", on=False),
    role("mepro-tl-2", "Electro-Optics Team Leader & R&D Electro-Optics Engineer", "Co M", "2010 - 2014"),
    role("mepro-eng", "R&D Electro-Optics Engineer", "Co M", "2010 - 2013", on=False),
    role("tau-security", "Security Guard", "Co T", "2010", on=False),
    role("tau-research", "Research Assistant", "Co T", "2007 - 2010", on=False),
    role("tau-research-2", "Research Assistant & Teaching Assistant", "Co T", "2006 - 2010", on=False),
    role("tau-teaching", "Teaching Assistant", "Co T", "2006 - 2010", on=False),
    role("idf", "Computer Systems Administrator", "Co D", "2001 - 2003"),
    role("volunteer-wolves", "Team Operations Manager (foreningsarbejde)", "Co V", "2023 - present"),
    role("tau-security__merged", "Security Guard & Research Assistant & Students Council Representative",
         "Co T", "2005 - 2010"),
    role("tau-council", "Students Council Representative", "Co T", "2005 - 2007", on=False),
]

cv = [{"id": "experience", "type": "experience", "roles": [dict(r) for r in ROLES]}]
gr.compact_jd_aware(cv, [], "project delivery requirements change request product")
out = cv[0]["roles"]
ids = [r.get("id") for r in out]
ec = next((r for r in out if r.get("id") == "earlier-career"), None)
ec_lines = (ec or {}).get("bullets") or []
print("roles:", ids)
print("earlier career:", ec_lines)

companies = [r.get("company") for r in out if r.get("id") != "earlier-career"]
check("Innoviz appears once", companies.count("Co I") == 1, companies)
check("the app's merged copy innoviz-ccr-2 is not printed", "innoviz-ccr-2" not in ids, ids)
check("Earlier career exists", ec is not None, ids)
mepro = companies.count("Co M") + len([l for l in ec_lines if "Co M" in l])
check("Meprolight appears once (full role or Earlier career line)", mepro == 1, (companies, ec_lines))
ta = [l for l in ec_lines if "Teaching Assistant" in l and "Council" not in l]
check("Research & Teaching Assistant appears once", len(ta) <= 1, ec_lines)
covers = [c for r in out for c in (r.get("__covers") or [])]
for pid in ("innoviz-ccr-2", "mepro-tl-2"):
    check(f"dropped {pid} is declared in a __covers list", pid in covers, covers)

# Control: a merged title with only ONE same-company role inside its span stays.
solo = [role("a", "Lead & Architect", "Co Z", "2015 - 2020"), role("b", "Lead", "Co Z", "2016 - 2020")]
kept, dropped = gr._drop_merge_products([dict(r) for r in solo])
check("control: a merged title with one constituent is kept", [r["id"] for r in kept] == ["a", "b"] and not dropped,
      [r["id"] for r in kept])
# Control: "R&D" alone is not a merged title.
rd = [role("c", "R&D Engineer", "Co Y", "2010 - 2014"), role("d", "Engineer", "Co Y", "2010 - 2012"),
      role("e", "Tester", "Co Y", "2012 - 2014")]
kept, dropped = gr._drop_merge_products([dict(r) for r in rd])
check("control: 'R&D' is not a merged-title marker", len(kept) == 3, [r["id"] for r in kept])

print(f"\n{'ALL PASS' if not fails else f'{fails} FAIL'}")
sys.exit(1 if fails else 0)
