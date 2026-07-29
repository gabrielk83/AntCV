#!/usr/bin/env python3
"""Self-test for CL-V5-STRUCT-001 in the nightly generator — pure units, no network.
Run: python test_cl_v5_structure.py  (exit 0 = green).

v5 cover-letter sequence (docs/plan/AntCV_Generation_Upgrade_Plan_2026-07-17.md §1):
  greeting -> opening -> why -> role_view -> bring -> contribute -> who -> closure

Covers:
  - the section asks exist and the retired one is gone
  - the "How I see the role" ask states employer-problem-only (structural separation)
  - the WHO I AM ask carries the four end-block labels
  - build_structured_sections emits the v5 order from a PRE-v5 skeleton, creates
    role_view, parses the who end-block, and hides the legacy foundation section
"""
import importlib.util
import os
import sys

_here = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location("genrunner", os.path.join(_here, "gen-runner.py"))
_gr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_gr)

fails = []
def check(name, cond):
    print(("PASS " if cond else "FAIL ") + name)
    if not cond: fails.append(name)

# ---------------------------------------------------------------- section asks
asks = {k: ask for (k, _title, ask) in _gr.CL_SECTIONS}
check("ask: cl_how_i_see_role exists", "cl_how_i_see_role" in asks)
check("ask: cl_foundation retired", "cl_foundation" not in asks)
check("ask: role-view is employer-problem-only",
      "NO candidate evidence" in asks.get("cl_how_i_see_role", "")
      and "NO proposed solution" in asks.get("cl_how_i_see_role", ""))
check("ask: role-view asks for exactly three rows",
      "EXACTLY THREE rows" in asks.get("cl_how_i_see_role", ""))
check("ask: bring asks for exactly three EVIDENCE rows",
      "EXACTLY THREE rows" in asks.get("cl_what_i_bring", ""))
check("ask: who carries the four end-block labels",
      all(lab in asks.get("cl_who_i_am", "")
          for lab in ("Professional summary", "How I operate", "Eligibility", "My goal")))
check("ask: eligibility is never inferred from residence/citizenship",
      "NEVER infer eligibility or clearance from residence or citizenship" in asks.get("cl_who_i_am", ""))

# ------------------------------------------------------- overlay onto a PRE-v5 skeleton
def rb(sid, title):
    return {"id": sid, "title": title, "loc": "main", "on": True,
            "type": "rich_block", "items": [{"b": "", "t": "x"}]}

PRE_V5 = {
    "cv": [],
    # deliberately the OLD order, with no role_view and a live foundation section
    "cl": [rb("greeting", "Greeting"), rb("opening", "Opening"), rb("who", "WHO I AM"),
           rb("bring", "WHAT I BRING"), rb("why", "WHY THIS POSITION"),
           rb("contribute", "HOW I WOULD CONTRIBUTE"), rb("foundation", "FOUNDATION"),
           {"id": "closure", "title": "Closure", "loc": "main", "on": True,
            "type": "text", "content": "x"}],
}
PRE_V5["cl"][0] = {"id": "greeting", "title": "Greeting", "loc": "main", "on": True,
                   "type": "text", "content": "Dear team,"}

GEN = {s["id"]: s for s in [
    {"id": "cl_opening", "result": "I am applying for the SBC Project Manager position."},
    {"id": "cl_why_this_position", "result": "It combines optical systems and project control."},
    {"id": "cl_how_i_see_role", "result":
        "The work appears to centre on three connected priorities:\n"
        "Controlled SBC development | Turn customer needs into clear scope, evidence and gates.\n"
        "Alignment across organisations | Align customers, partners and engineers on interfaces.\n"
        "Scalable optical development | Turn lab learning into repeatable prototypes."},
    {"id": "cl_what_i_bring", "result":
        "Technical depth, project discipline and team direction relevant to these challenges:\n"
        "Evidence-led decisions | Connect measured optical behaviour to architecture trade-offs.\n"
        "Cost mitigation | Led substitute qualification that cut LiDAR unit cost by 90 per cent.\n"
        "Project direction | Chaired a CCB that cut the change cycle from 250 to 10 days."},
    {"id": "cl_how_i_would_contribute", "result":
        "I would bring this approach, adapting tools and rhythm with the team:\n"
        "- Review the demonstrator, requirements and lead-time risks, then agree priorities.\n"
        "- Turn customer meetings and test results into traceable actions with owners.\n"
        "- Coordinate beam paths, thermal constraints and supplier timing with specialists."},
    {"id": "cl_who_i_am", "result":
        "I work best where technical uncertainty, people and delivery decisions move together.\n"
        "Professional summary: Over 15 years in electro-optical hardware and project governance.\n"
        "How I operate: Calm and structured, I make data-led decisions and follow up openly.\n"
        "Eligibility: Copenhagen-based EU citizen with a clean criminal record.\n"
        "My goal: Build a repeatable SBC programme with visible risks, ownership and proof."},
    {"id": "cl_closure", "result": "I would welcome a talk on how my optical background could help."},
]}

cv, cl = _gr.build_structured_sections(PRE_V5, GEN, "Ibsen Photonics", "Project Manager", language="en")
ids = [s["id"] for s in cl]
check("order: v5 sequence emitted from a pre-v5 skeleton",
      ids == ["greeting", "opening", "why", "role_view", "bring",
              "contribute", "who", "foundation", "closure"])

rv = next((s for s in cl if s["id"] == "role_view"), None)
check("role_view: created", rv is not None)
if rv:
    check("role_view: lead + exactly three employer bullets", len(rv["items"]) == 4)
    check("role_view: lead-in row is a paragraph, data rows are bullets",
          not rv["items"][0].get("mk") and all(i.get("mk") for i in rv["items"][1:]))
    check("role_view: lead text ends with a colon", rv["items"][0]["t"].rstrip().endswith(":"))
    check("role_view: carries no candidate 'I'", " I " not in " ".join(i["t"] for i in rv["items"][1:]))

who = next((s for s in cl if s["id"] == "who"), None)
check("who: parsed into the four-row end-block", who is not None and len(who["items"]) == 5)
if who:
    check("who: labels in v5 order",
          [i["b"] for i in who["items"]] ==
          ["Who I am", "Professional summary", "How I operate", "Eligibility", "My goal"])

fnd = next((s for s in cl if s["id"] == "foundation"), None)
check("foundation: legacy section hidden, not deleted", fnd is not None and fnd.get("on") is False)

print()
print(f"CL-V5-STRUCTURE SELF-TEST: {'FAILED: ' + ', '.join(fails) if fails else 'all checks passed'}")
sys.exit(1 if fails else 0)
