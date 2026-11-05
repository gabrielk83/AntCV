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
def _lang(jd):
    return dp._language_gate(jd)[0]


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

# ---- DISCOVERY-EVIDENCE-GATE-001 (owner 2026-11-01): real cases from that day ---------
G = dp._evidence_gate
check("gate: AI trainer with chatbot tuning and no PM/BA/supplier/HW need is rejected",
      bool(G({"role": "AI Trainer, Forretningsudvikling",
              "why": "Chatbot / AI use-case design, workshops, prompt and answer-quality tuning, rollout"})), True)
check("gate: AI governance role with no qualifier is rejected",
      bool(G({"role": "AI Governance Specialist med systemansvar",
              "why": "AI governance, guidance and processes for responsible AI use; documentation"})), True)
check("gate: an AI adoption lead is rejected",
      bool(G({"role": "Senior AI Adoption Lead", "why": "owns the AI adoption programme, training"})), True)
check("gate: a web / MarTech 'Digital Product Specialist' is rejected",
      bool(G({"role": "Digital Product Specialist",
              "why": "Owns webshop, CDP and MarTech day to day: backlog, requirements"})), True)
check("gate: AI enablement INSIDE hardware R&D passes (owner rule: hardware need)",
      G({"role": "AI Enablement Specialist - Engineering Productivity",
         "why": "AI across workflows with mechanical, electronics and optics engineers"}), None)
check("gate: an AI role that needs serious product management passes (owner rule)",
      G({"role": "AI Innovation Lead", "jd": "You own the product roadmap as product manager"}), None)
check("gate: an AI role with supplier / vendor control passes (owner rule)",
      G({"role": "AI Strategist", "why": "vendor selection and supplier follow-up for AI platforms"}), None)
check("gate: an ordinary engineering role is never touched",
      G({"role": "Hardware Solution Architect", "why": "endoscopy camera platforms"}), None)
check("gate: an explicit override with a reason lets a row through",
      G({"role": "AI Trainer", "override_gate": True, "override_reason": "owner asked"}), None)
check("gate: an override WITHOUT a reason does not count",
      bool(G({"role": "AI Trainer", "override_gate": True})), True)
res3, out3, st3 = run_add({"rows": [], "urls": {}}, [
    {"company": "Alka Forsikring", "role": "AI Trainer", "url": "https://x.dk/1", "why": "chatbot tuning"},
    {"company": "Ambu", "role": "Hardware Solution Architect", "url": "https://x.dk/2", "why": "endoscopy"}])
check("gate: add() skips the no-fit and adds the engineering row", (res3.get("added"), res3.get("skipped")), (1, 1))
check("gate: the skip reason names the evidence gate", "evidence gate" in out3, True)

# ---- DISCOVERY-EVIDENCE-GATE-002 (owner 2026-11-01, round 2) ---------------------------
PM = {"role": "Product Manager", "why": "product roadmap, business analysis, supplier follow-up"}
for co in ("Nykredit", "Danske Bank", "Nordea Danmark", "Ikano Bank", "Mastercard", "YouSee",
           "Tryg Forsikring", "PFA Pension"):
    check("gate2: %s is a banking / insurance / payments / telecom employer" % co,
          bool(G(dict(PM, company=co))), True)
check("gate2: CIP (infrastructure fund, owner asked for it) is not a bank",
      G(dict(PM, company="CIP Fund Solutions")), None)
check("gate2: a hardware employer with 'Bang' in its name is not a bank",
      G(dict(PM, company="Bang & Olufsen")), None)
check("gate2: VELUX is a construction-product employer",
      bool(G(dict(PM, company="VELUX"))), True)
check("gate2: a posting that wants a building-industry background is rejected",
      bool(G(dict(PM, company="Some Co", jd="You have a background in the construction industry."))), True)
check("gate2: Danish 'erfaring fra byggebranchen' is rejected",
      bool(G(dict(PM, company="Some Co", jd="Du har erfaring fra byggebranchen og salg."))), True)
check("gate2: 'byggeriet' in company boilerplate is not a background requirement",
      G(dict(PM, company="Lemvigh-Müller",
             jd="Vi hjælper kunder i industrien, byggeriet og installationsbranchen.")), None)
check("gate2: medical-device experience as a must is rejected",
      bool(G(dict(PM, company="Medtech A/S",
                  jd="Requirements. At least 5 years of experience with medical device development is required."))), True)
check("gate2: Danish 'erfaring med medicinsk udstyr er et krav' is rejected",
      bool(G(dict(PM, company="Medico ApS", jd="Erfaring med medicinsk udstyr er et krav."))), True)
check("gate2: 'medical devices or another regulated industry' passes",
      G(dict(PM, company="Medtech A/S",
             jd="You have 5+ years of experience from medical devices or another regulated industry.")), None)
check("gate2: medical experience as nice-to-have passes",
      G(dict(PM, company="Medtech A/S", jd="Experience with ISO 13485 is an advantage.")), None)
check("gate2: Coloplast-style 'might also bring' passes",
      G(dict(PM, company="Coloplast",
             jd="You might also bring medical device experience, but it is not required")), None)
check("gate2: a medtech posting that only builds devices (no experience must) passes",
      G(dict(PM, company="Ambu", jd="You will architect medical devices that must meet IEC 60601.")), None)
check("gate2: a jobindex url with a teaser-length jd is skipped",
      bool(G(dict(PM, company="Elma Instruments", url="https://www.jobindex.dk/vis-job/h1712000",
                  jd="Kommerciel produktchef til måleinstrumenter."))), True)
check("gate2: a jobindex url with the full source posting passes",
      G(dict(PM, company="Elma Instruments", url="https://www.jobindex.dk/vis-job/h1712000",
             jd="Produktansvar for måleinstrumenter, leverandørstyring og sortiment. " * 12)), None)
check("gate2: a non-jobindex url with no jd is not affected by the teaser rule",
      G(dict(PM, company="Hamamatsu", url="https://www.linkedin.com/jobs/view/1")), None)

# ---- GATE-003 + DEADLINE-RELEVANCE-001 (owner 2026-11-01) ------------------------------
LEMVIGH_JD = ("Har du erfaring med bygningsautomation, CTS/BMS, KNX eller integrerede bygningssystemer? "
              "Du har en teknisk baggrund inden for el, automation eller bygningsstyring og erfaring fra f.eks. "
              "en producent, installatør, systemintegrator.")
check("gate3: Lemvigh-Mueller building-automation background is rejected",
      bool(G(dict(PM, company="Lemvigh-Müller", jd=LEMVIGH_JD))), True)
check("gate3: STIL public-sector IT business analyst with no hardware core is rejected",
      bool(G({"company": "Styrelsen for It og Læring", "role": "Teknisk forretningsanalytiker med interesse for AI",
              "why": "Business analyst on critical exam/test IT systems: requirements, testing, stakeholder work"})), True)
check("gate3: a business analyst at a hardware employer is not touched",
      G({"company": "Hamamatsu Photonics", "role": "BI Business Analyst", "why": "laser products, supplier data"}), None)
check("gate3: pay noted below the floor is rejected",
      bool(G(dict(PM, company="Some Co", fit="State pay scale, likely below the 55k floor (salary risk)"))), True)
import datetime as _dt
_past = (_dt.date.today() - _dt.timedelta(days=3)).strftime("%d.%m.%Y")
_today = _dt.date.today().strftime("%d.%m.%Y")
_future = (_dt.date.today() + _dt.timedelta(days=20)).strftime("%d.%m.%Y")
check("deadline: a deadline three days ago is rejected",
      bool(G(dict(PM, company="Some Co", jd="Ansøgningsfrist: " + _past))), True)
check("deadline: a deadline TODAY is rejected (owner: same day counts as passed)",
      bool(G(dict(PM, company="Some Co", jd="Ansøgningsfrist: " + _today))), True)
check("deadline: a deadline in three weeks passes",
      G(dict(PM, company="Some Co", jd="Ansøgningsfrist: " + _future)), None)

# ---- LANGUAGE-GATE-001 (2026-11-05): on record EN/HE native, ES full professional, DA B1 ----
check("language: fluent German required -> FAIL", _lang("Fluent German is required for customer calls."), "FAIL")
check("language: Swedish requirement in Swedish -> FAIL", _lang("Flytande svenska i tal och skrift krävs."), "FAIL")
check("language: the gate rejects a FAIL candidate, quoting the line",
      "language gate" in (G(dict(PM, company="Some Co", jd="Du taler og skriver flydende tysk.")) or ""), True)
check("language: a German COMPANY or OEM is not a language requirement",
      (_lang("Experience with German automotive OEMs is required."), _lang("Tysk virksomhed søger PM. Krav: 5 år.")),
      ("PASS", "PASS"))
check("language: an undeclared language as an advantage passes", _lang("German language skills are an advantage."),
      "PASS")
check("language: any Danish requirement at B1 -> FLAG", _lang("Du taler og skriver flydende dansk."), "FLAG")
check("language: Danish in the alternatives -> FLAG, not FAIL",
      _lang("You speak Danish, Swedish or Norwegian fluently."), "FLAG")
check("language: Danish as a plus -> PASS", _lang("Danish language skills are a plus."), "PASS")
check("language: fluent English -> PASS (native)", _lang("Fluent English, written and spoken, is required."), "PASS")
check("language: Spanish required -> PASS, native Spanish -> FLAG (full professional on record)",
      (_lang("Spanish language skills are required."), _lang("Native Spanish speaker required.")), ("PASS", "FLAG"))
check("language: the ad being written in Danish is not a requirement",
      _lang("Vi søger en projektleder til vores optikafdeling i Farum. Du har erfaring med NPI."), "PASS")

# ---- STALE-POSTING-001 + MASS-POSTING-001 --------------------------------------
check("posted: ISO, dd.mm.yyyy and RSS pubDate all parse",
      [dp._posted_day(s) for s in ("2026-09-01", "01.09.2026", "Tue, 01 Sep 2026 00:00:00 +0200", "snart")],
      [_dt.date(2026, 9, 1)] * 3 + [None])
check("stale: 40 days old -> warning; 10 days -> none; no date -> none",
      [bool(dp._stale_note({"posted": str(_dt.date(2026, 9, 1) + _dt.timedelta(days=d))}, _dt.date(2026, 10, 11)))
       for d in (0, 30)] + [dp._stale_note({}, _dt.date(2026, 10, 11))],
      [True, False, None])
OPT = {"company": "Lumen Optics A/S", "why": "optics NPI", "fit": "T2",
       "jd": "Optical engineer for NPI. " * 40 + "Du taler og skriver flydende dansk."}
res, out, state = run_add({"rows": [], "urls": {}, "discovered": {}}, [
    dict(OPT, role="Optical Engineer - Aarhus", location="Aarhus", url="https://lumen.example/j/1",
         posted="2026-01-02"),
    dict(OPT, role="Optical Engineer - Kolding", location="Kolding", url="https://lumen.example/j/2"),
    dict(OPT, role="Test Engineer", location="Aarhus", url="https://lumen.example/j/3", cvr="12345678")])
check("cvr seeds financials[uk] for the annual-report lookup",
      list(state["doc"].get("financials", {}).values()), [{"cvr": "12345678", "cvr_source": "posting"}])
check("mass posting: one row per role; the repeat in another city is skipped",
      (res.get("added"), "mass posting" in out), (2, True))
flag0 = state["doc"]["rows"][0][10]
check("mass posting: the kept row lists both places", "posted identically in 2 locations: Aarhus, Kolding" in flag0, True)
check("language FLAG lands on the row flag with the declared level", "on record: Danish B1" in flag0, True)
check("stale posting lands on the row flag", "⚠ posted 2026-01-02" in flag0, True)

# ---- ELIGIBILITY-GATE-001 (owner on record: EU citizen, eligible for DDIS review, no clearance) ----
EG = dp._eligibility_gate
check("eligibility: Danish citizenship required -> FAIL",
      EG("Du skal have dansk statsborgerskab for at kunne ansættes.")[0], "FAIL")
check("eligibility: 'must be a US citizen' -> FAIL", EG("Applicants must be a US citizen.")[0], "FAIL")
check("eligibility: EU citizenship required -> PASS for an EU citizen",
      EG("EU citizenship is required for this position in Lyngby.")[0], "PASS")
check("eligibility: an active clearance the hire must already hold -> FAIL",
      EG("You must hold an active NATO SECRET security clearance.")[:3:2], ("FAIL", "clearance held"))
check("eligibility: a clearance to obtain -> FLAG, quoted",
      EG("Du skal kunne sikkerhedsgodkendes efter gældende regler.")[0], "FLAG")
check("eligibility: ITAR US persons -> FAIL", EG("Due to ITAR, applicants must be U.S. persons with clearance.")[0], "FAIL")
check("eligibility: a defence employer saying nothing -> UNVERIFIED",
      EG("We build radar systems for naval platforms.", "Terma A/S")[0], "UNVERIFIED")
check("eligibility: a civil employer saying nothing -> PASS", EG("We build spectrometers.", "Ibsen Photonics")[0], "PASS")
check("eligibility: defence named as acceptable background is not a defence employer",
      EG("Experience from medtech, aerospace or defence is an advantage. We make ostomy products.", "Coloplast")[0],
      "PASS")
check("eligibility: a customer named in the body is not the employer",
      EG("Our customers include Saab and Volvo. You design locks.", "ASSA ABLOY")[0], "PASS")
check("eligibility: two sentences about defence work in the body -> UNVERIFIED",
      EG("You will build radar for military platforms. Our defence programmes run for decades.", "MITS Industries")[0],
      "UNVERIFIED")
check("eligibility: 'Danish customers' is not a citizenship rule",
      EG("You will support Danish customers; experience is required.")[0], "PASS")
check("eligibility: the gate rejects a FAIL candidate with the reason",
      "eligibility gate" in (G(dict(PM, company="Some Co", jd="Dansk statsborgerskab er et krav.")) or ""), True)
res, out, state = run_add({"rows": [], "urls": {}, "discovered": {}}, [
    dict(OPT, role="Systems Engineer", company="Terma A/S", url="https://terma.example/j/9",
         jd="Systems engineer for radar. " * 40 + "You must be able to obtain a security clearance.")])
flag9 = state["doc"]["rows"][0][10]
sw = dp.eligibility_sweep({"rows": [[1, "Terma A/S", "SE", "", "", "", "", "", "Identified (posting saved)", "", "", "t1", ""],
                                    [2, "Old Co", "PM", "", "", "", "", "", "Archive / closed", "", "", "o1", ""],
                                    [3, "Ibsen", "LE", "", "", "", "", "", "Submitted", "", "", "i1", ""]],
                           "jd": {"t1": "Radar work. You must hold an active security clearance.",
                                  "o1": "Dansk statsborgerskab er et krav.", "i1": "Spectrometers."}})
check("eligibility sweep: live rows only, PASS rows left out", {k: v["verdict"] for k, v in sw.items()}, {"t1": "FAIL"})
check("eligibility: a FLAG lands on the row and in doc.eligibility",
      ("⚠ eligibility flag (clearance to obtain)" in flag9,
       list(state["doc"]["eligibility"].values())[0]["verdict"]), (True, "FLAG"))

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - discover-positions url key keeps ad identity, drops tracking (%d checks)" %
      sum(1 for ln in open(__file__, encoding="utf-8") if ln.lstrip().startswith("check(")))
