# COMPANY-FINANCIALS-001 — annual-report figures from Virk open data.
# Run: python scripts/job-tracker/test_company_financials.py   (exit 0 = pass)
# Network-free: the Virk index answer and the XBRL are synthetic, shaped like the real
# ones fetched on 2026-11-05 (Danish fsa taxonomy, gzip-served XML).
import datetime
import gzip
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass
import company_financials as CF  # noqa: E402

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


XBRL = """<?xml version="1.0" encoding="UTF-8"?>
<xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance">
 <xbrli:context id="c1"><xbrli:entity><xbrli:identifier scheme="http://www.dcca.dk/cvr">12345678</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:context id="c2"><xbrli:entity><xbrli:identifier scheme="http://www.dcca.dk/cvr">12345678</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2024-01-01</xbrli:startDate><xbrli:endDate>2024-12-31</xbrli:endDate></xbrli:period></xbrli:context>
 <xbrli:context id="c3"><xbrli:entity><xbrli:identifier scheme="http://www.dcca.dk/cvr">12345678</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:instant>2025-12-31</xbrli:instant></xbrli:period></xbrli:context>
 <xbrli:context id="c4"><xbrli:entity><xbrli:identifier scheme="http://www.dcca.dk/cvr">12345678</xbrli:identifier></xbrli:entity>
  <xbrli:period><xbrli:startDate>2025-01-01</xbrli:startDate><xbrli:endDate>2025-12-31</xbrli:endDate></xbrli:period>
  <xbrli:scenario><xbrldi:explicitMember dimension="x">y</xbrldi:explicitMember></xbrli:scenario></xbrli:context>
 <xbrli:unit id="u1"><xbrli:measure>iso4217:DKK</xbrli:measure></xbrli:unit>
 <gsd:NameOfReportingEntity contextRef="c1">Lumen Optics A/S</gsd:NameOfReportingEntity>
 <gsd:IdentificationNumberCvrOfReportingEntity contextRef="c1">12345678</gsd:IdentificationNumberCvrOfReportingEntity>
 <fsa:GrossProfitLoss contextRef="c4" decimals="0" unitRef="u1">1</fsa:GrossProfitLoss>
 <fsa:GrossProfitLoss contextRef="c1" decimals="0" unitRef="u1">48200000</fsa:GrossProfitLoss>
 <fsa:GrossProfitLoss contextRef="c2" decimals="0" unitRef="u1">40100000</fsa:GrossProfitLoss>
 <fsa:ProfitLossFromOrdinaryOperatingActivities contextRef="c1" decimals="0" unitRef="u1">6100000</fsa:ProfitLossFromOrdinaryOperatingActivities>
 <fsa:ProfitLoss contextRef="c1" decimals="0" unitRef="u1">4400000</fsa:ProfitLoss>
 <fsa:ProfitLoss contextRef="c2" decimals="0" unitRef="u1">-900000</fsa:ProfitLoss>
 <fsa:Equity contextRef="c3" decimals="0" unitRef="u1">21500000</fsa:Equity>
 <fsa:AverageNumberOfEmployees contextRef="c1" decimals="INF" unitRef="u2">85</fsa:AverageNumberOfEmployees>
 <fsa:AverageNumberOfEmployees contextRef="c2" decimals="INF" unitRef="u2">70</fsa:AverageNumberOfEmployees>
</xbrli:xbrl>"""
INDEX = {"hits": {"hits": [
    {"_source": {"cvrNummer": 12345678, "offentliggoerelsestype": "regnskab",
                 "regnskab": {"regnskabsperiode": {"startDato": "2025-01-01", "slutDato": "2025-12-31"}},
                 "dokumenter": [{"dokumentType": "AARSRAPPORT", "dokumentMimeType": "application/xhtml+xml",
                                 "dokumentUrl": "http://regnskaber.virk.dk/x.xhtm"},
                                {"dokumentType": "AARSRAPPORT", "dokumentMimeType": "application/xml",
                                 "dokumentUrl": "http://regnskaber.virk.dk/x.xml"}]}}]}}
asked = []


def getter(url, timeout=30):
    asked.append(url)
    if "offentliggoerelser" in url:
        return json.dumps(INDEX).encode()
    if url.endswith("x.xml"):
        return gzip.decompress(gzip.compress(XBRL.encode()))
    if "cvrapi" in url:
        return json.dumps({"error": "QUOTA_EXCEEDED"}).encode()
    raise AssertionError("unexpected url " + url)


f = CF.parse_xbrl(XBRL, "2025-01-01", "2025-12-31")
check("xbrl: name and CVR from the filing", (f["name"], f["cvr"]), ("Lumen Optics A/S", "12345678"))
check("xbrl: the undimensioned current-year fact wins over a dimensioned one",
      f["gross_profit"], 48200000.0)
check("xbrl: instant facts (equity) read at the period end", f["equity"], 21500000.0)
check("xbrl: prior year from the context ending the day before",
      (f["prior"]["gross_profit"], f["prior"]["net_result"], f["prior"]["employees"]), (40100000.0, -900000.0, 70.0))
check("xbrl: absent tags stay absent (small companies file no revenue)", "revenue" in f, False)
s = CF.summary(f)
check("summary: growth between two positive years", "gross profit DKK 48.2m (+20% y/y)" in s, True)
check("summary: no % against a loss year; the prior figure instead",
      "net result DKK 4.4m (prior year DKK -900k)" in s, True)
check("summary: says where the figures come from", "Erhvervsstyrelsen filing via Virk" in s, True)
check("cvr: read only next to a CVR label", CF.cvr_from_text("Tlf 12345678 · CVR-nr.: 87654321 · CVR 11223344"),
      ["87654321", "11223344"])
check("name: legal forms and 'Danmark' ignored", (CF.name_matches("Lumen Optics", "LUMEN OPTICS A/S"),
                                                   CF.name_matches("Lumen Optics Danmark", "Lumen Optics ApS"),
                                                   CF.name_matches("Acme", "Lumen Optics A/S")), (True, True, False))
res = CF.lookup("Lumen Optics", cvr="12345678", getter=getter)
check("lookup: given CVR -> newest annual XML (not the xhtml), parsed", (res["cvr_source"], res["name_ok"],
                                                                         res["financials"]["employees"]),
      ("given", True, 85.0))
check("lookup: the XML url fetched, the xhtml one skipped", [u for u in asked if "regnskaber" in u],
      ["http://regnskaber.virk.dk/x.xml"])
res = CF.lookup("Acme Robotics", cvr="12345678", getter=getter)
check("lookup: a filing under another name is flagged, never silent", "CHECK: filed under" in res["summary"], True)
res = CF.lookup("Lumen Optics", getter=getter, research=lambda n: "Lumen Optics A/S, CVR 12345678, Farum")
check("lookup: no CVR given, register unset, cvrapi over quota -> a CVR in research snippets",
      (res.get("cvr"), res.get("cvr_source")), ("12345678", "web research"))
res = CF.lookup("Nobody ApS", getter=getter, research=lambda n: "no number here")
check("lookup: no CVR anywhere -> an error saying what to pass", "pass --cvr" in res.get("error", ""), True)
check("register: no credentials -> skipped", CF.cvr_from_register("Lumen Optics"), None)

doc = {"rows": [[1, "Lumen Optics", "PM", "", "", "", "", "", "Identified (posting saved)", "", "", "lumen", ""]],
       "financials": {"lumen": {"cvr": "12345678", "cvr_source": "posting"}}}
out = CF.enrich(doc, ["lumen"], datetime.date(2026, 11, 5), getter=getter)
rec = doc["financials"]["lumen"]
check("enrich: the posting's CVR is used and kept", (rec["cvr"], rec["name_ok"], rec["figures"]["equity"]),
      ("12345678", True, 21500000.0))
check("enrich: summary stored and returned", out["lumen"] == rec["summary"] and bool(rec["summary"]), True)
n_before = len(asked)
CF.enrich(doc, ["lumen"], datetime.date(2026, 12, 1), getter=getter)
check("enrich: a record under 90 days old is not fetched again", len(asked), n_before)

# ---- FIN-ANGLES-001: figures -> recruiter questions, letter angle, interview prep ----------
check("signals: the synthetic filing reads as gross-profit growth, a turnaround and hiring",
      [k for k, _ in CF.signals(f)], ["turnaround", "growth", "hiring"])
LOSS = {"currency": "DKK", "revenue": 80e6, "operating_result": -3e6, "net_result": -12.4e6, "equity": -2e6,
        "assets": 40e6, "employees": 50, "prior": {"revenue": 90e6, "net_result": -1e6, "employees": 60}}
keys = [k for k, _ in CF.signals(LOSS)]
check("signals: loss (second year), decline, thin margin, negative equity, shrinking",
      keys, ["loss", "decline", "thin_margin", "negative_equity", "shrinking"])
check("signals: the loss reads as an amount, not a minus sign", CF.signals(LOSS)[0][1],
      "net loss of DKK 12.4m (second loss year)")
a = CF.angles(LOSS)
check("angles: one recruiter question per signal", len(a["questions"]), 5)
check("angles: negative equity gives no letter angle (a risk for the candidate, not a pitch)",
      len(a["cl_angles"]), 4)
check("angles: the loss angle says lead with cost/time proof and never mention the loss",
      ("cost" in a["cl_angles"][0], "never mention the loss" in a["cl_angles"][0]), (True, True))
check("angles: interview prep gets likely questions and what to rehearse",
      (len(a["interview"]["likely_questions"]), len(a["interview"]["rehearse"])), (5, 5))
check("angles: a quiet year gives nothing", CF.angles({"currency": "DKK", "net_result": 5e6, "prior": {"net_result": 4e6}}),
      {"signals": [], "questions": [], "cl_angles": [], "interview": {"likely_questions": [], "rehearse": []}})
res = CF.lookup("Lumen Optics", cvr="12345678", getter=getter)
check("lookup: angles ride along with the summary", res["angles"]["signals"][0].startswith("back to profit"), True)
res = CF.lookup("Acme Robotics", cvr="12345678", getter=getter)
check("lookup: a filing under another name gives no angles (never pitch on another firm's figures)",
      res["angles"]["questions"], [])

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - company financials (%d checks)" % sum(1 for ln in open(__file__, encoding="utf-8")
                                                   if ln.lstrip().startswith("check(")))
