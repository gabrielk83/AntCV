#!/usr/bin/env python3
"""Self-test for the 2026-10-01 owner rules - pure units, no relay/network.
Run: python test_impact_types.py  (exit 0 = green).

Covers:
  - RESULTS-IMPACT-TYPES-001  results classify into Performance / Deliverables /
                              Improvements / Audience; the JD's most-asked type
                              wins when JD relevance ties; a digit still beats
                              no digit for the Results fallback
  - LANGUAGES-ORDER-001       Danish, English, Spanish, Hebrew; others after
  - ROLE-BODY-NOTE-001        the Trackman body says internship, role line kept
"""
import sys

import measure_density as MD
import quality_pass as QP

GR = MD._gen_runner()
_n = 0
_fail = 0


def check(name, ok, detail=""):
    global _n, _fail
    _n += 1
    if ok:
        print("PASS " + name)
    else:
        _fail += 1
        print("FAIL " + name + (" - " + detail if detail else ""))


# -- impact types ---------------------------------------------------------
t = GR._impact_types
check("performance: from-to cut", "performance" in t("Cut the change cycle from about 250 days to about 10."))
check("performance: multiplier", "performance" in t("Cut LiDAR unit cost 10x by substitute selection."))
check("deliverables: built", "deliverables" in t("Built the PMA template for supplier hardware."))
check("improvements: standardised", "improvements" in t("Standardised gate reviews across in-house and supplier work."))
check("audience: users across machines", "audience" in t("Backup for 100 users across 150 machines."))
check("deliverables: noun-led result", "deliverables" in t("PMA template v2, supplier one-pager and a pilot project."))
check("audience: money and revenue", "audience" in t("Supported an $8M customer NRE program, about 30% of FY2025 revenue."))
check("audience: guests", "audience" in t("Club events drawing 300 guests."))
check("descriptor is not audience", "audience" not in t("Coordinated a 7-person optics team."))

jd_cost = "We need someone to keep cost, schedule and budget on plan, with quality and lead time KPIs."
d = GR._jd_impact_demand(jd_cost)
check("JD demand: performance tops a cost JD", d.get("performance") == 1.0, str(d))
check("JD demand: floor keeps other types", min(d.values()) >= 0.25, str(d))
check("no JD, no demand", GR._jd_impact_demand("") == {})

jdkw = GR._jd_kw(jd_cost)
role = {"bullets": [
    "Built the supplier one-pager for 3 projects.",
    "Cut supplier lead time from 12 weeks to 7.",
    "Wrote the onboarding guide."]}
GR._fit_role(role, jdkw, max_bullets=3, demand=d)
check("fallback Results picks the JD's type among numbered lines",
      "lead time" in str(role.get("results")), str(role.get("results")))

role2 = {"bullets": ["Built the template.", "Ran reviews for 4 teams.", "Cut cost 30% on the sensor."]}
GR._fit_role(role2, GR._jd_kw(""), max_bullets=1, demand={})
check("no JD: prior first-digit behaviour holds", role2.get("results") == "Ran reviews for 4 teams.",
      str(role2.get("results")))

# -- languages order ------------------------------------------------------
cv = [{"id": "languages", "items": [{"l": "English", "v": "native"}, {"l": "Hebrew", "v": "native"},
                                    {"l": "Spanish", "v": "professional"}, {"l": "Danish", "v": "B2"}]}]
rep = []
QP.rule_languages_order(cv, rep)
check("languages: Danish, English, Spanish, Hebrew",
      [i["l"] for i in cv[0]["items"]] == ["Danish", "English", "Spanish", "Hebrew"])
rep2 = []
QP.rule_languages_order(cv, rep2)
check("languages: idempotent", rep2 == [])

# -- Trackman internship --------------------------------------------------
cv = [{"type": "experience", "roles": [
    {"title": "Project Manager, Hardware Development & Supply", "company": "Trackman A/S",
     "bullets": ["Hardware Project Management: Own the PMA template."], "results": "PMA template v2."},
    {"title": "Product / Project Expert", "company": "Kanzen", "bullets": ["Offers: Scope."]}]}]
rep = []
QP.rule_role_body_notes(cv, rep)
QP.rule_role_body_notes(cv, rep)
r = cv[0]["roles"]
check("trackman: label says internship", r[0]["bullets"][0] == "Hardware Project Management (internship): Own the PMA template.",
      r[0]["bullets"][0])
check("trackman: role line kept", r[0]["title"] == "Project Manager, Hardware Development & Supply")
check("trackman: once only", len(rep) == 1, str(rep))
check("other roles untouched", r[1]["bullets"][0] == "Offers: Scope.")

print(f"\n{_n - _fail}/{_n} passed")
sys.exit(1 if _fail else 0)
