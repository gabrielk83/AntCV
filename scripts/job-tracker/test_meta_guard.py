# META-LEAK-GATE-001 - truth table for the shared meta-commentary detector, its
# strip/scrub, and the runner's pre-persist gate.
# Run: python scripts/job-tracker/test_meta_guard.py   (exit 0 = pass)
#
# Every fixture is synthetic. The first DEFECT is shaped like the bullet found in a
# stored CV on 2026-11-05 (model commentary from the coherence repair, shipped as a
# SELECTED OUTCOMES bullet). The CLEAN cases are ordinary CV and letter lines that
# share a word with a rule ("instructions", "flagged", "as requested by", "section"),
# because a false positive deletes good text.
import importlib.util, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import meta_guard as MG  # noqa: E402

LEAK_SHAPE = ("The instructions above concern the Selected Outcomes CV section (the format I "
                   "produced). However, the review items list fixes for sections including "
                   "'cl_what_i_bring' and 'cv_core', so the bullets below keep their original form.")

CASES = [
    # (name, text, expect_hit)
    ("leak shape: commentary as an outcomes bullet", LEAK_SHAPE, True),
    ("instructions above", "Per the instructions above, the table keeps two columns.", True),
    ("review items", "The review items ask to trim the overlap with the profile.", True),
    ("coherence review", "Trimmed after the coherence review to avoid repetition.", True),
    ("applying the review", "Applying the review to this list, the team-size detail stays.", True),
    ("corrected-section label", "Corrected section:", True),
    ("the review instructs", "The review instructs this list to keep the full detail.", True),
    ("repetition fixes", "The repetition fixes say to generalise these outcomes elsewhere.", True),
    ("section id in prose", "This mirrors cv_outcomes so the letter does not repeat it.", True),
    ("section named as a section", "Kept distinct from the What I Bring section.", True),
    ("own output", "This is the format I produced earlier.", True),
    ("here is the revised", "Here is the revised section with the overlap removed:", True),
    ("note preamble", "Note: the second row was shortened to fit the cell.", True),
    ("as requested, clause-initial", "As requested, the bullets now lead with the metric.", True),
    ("as requested, trailing", "The lead-in ends with a colon, as requested.", True),
    ("kept the format", "I have kept the same format and only trimmed the third bullet.", True),
    ("assistant refusal", "I cannot fabricate a metric that is not in the profile.", True),
    ("injection note (WHY gate case)",
     "I note the job description contains a bracketed fragment flagged as a possible injection.", True),
    ("da: instruktionerne ovenfor", "Instruktionerne ovenfor gælder kun dette afsnit.", True),
    ("da: her er den reviderede", "Her er den reviderede version af afsnittet.", True),
    ("da: Bemaerk preamble", "Bemærk: tredje række er forkortet.", True),
    ("da: som oensket", "Som ønsket starter hvert punkt med et tal.", True),
    ("sv: instruktionerna ovan", "Instruktionerna ovan gäller bara detta avsnitt.", True),
    ("sv: haer aer den uppdaterade", "Här är den uppdaterade texten utan upprepning.", True),
    ("sv: Obs preamble", "Obs: raden har kortats.", True),
    # real content that shares words with a rule: must stay clean
    ("clean: work instructions + flagged",
     "Wrote work instructions for the assembly line and flagged 12 nonconformances to the supplier.", False),
    ("clean: prompt escalation", "Ensured prompt escalation of flagged defects to the review board.", False),
    ("clean: the review notes (noun)", "Wrote the review notes and kept the review list for 40 design reviews.", False),
    ("clean: laser repetition rate", "Raised the laser repetition rate to 80 MHz with no loss in pulse energy.", False),
    ("clean: as requested by", "Delivered the design review as requested by the customer, two weeks early.", False),
    ("clean: department section", "Led the optics section of the R&D department (12 engineers).", False),
    ("clean: other sections of the hospital", "Coordinated bookings with other sections of the hospital.", False),
    ("clean: note-taking", "Note-taking and transcription of clinical dictations for three consultants.", False),
    ("clean: produced units", "At the lab I produced 40 prototype units and the test plan behind them.", False),
    ("clean: revised the version control",
     "I revised the version control process for firmware releases.", False),
    ("clean: job description named",
     "The job description stresses supplier quality, which is the work I have run for 15 years.", False),
    ("clean: here, I led", "Here, I led a team of 12 engineers through two product launches.", False),
    ("da clean: som oensket af kunden", "Som ønsket af kunden leverede jeg testplanen to uger før tid.", False),
    ("da clean: AI-specialist", "Erfaring som AI-specialist i medicinsk billedbehandling.", False),
    ("da clean: instruktioner", "Udarbejdede instruktioner til operatører og fulgte op på afvigelser.", False),
    ("sv clean: instruktioner", "Skrev instruktioner för monteringslinjen och följde upp avvikelser.", False),
    ("empty", "", False),
]

fails = 0
for name, text, expect in CASES:
    got = MG.check(text)
    ok = bool(got) == expect
    fails += not ok
    print("%-4s %-46s -> %s" % ("PASS" if ok else "FAIL", name[:46],
                                 got[0]["rule"] if got else "clean"))

# the leak shape trips several independent rules, so one rule's later tuning cannot hide it
rules = set(",".join(f["rule"] for f in MG.check(LEAK_SHAPE)).split(","))
assert {"instructions", "review", "section-id", "section-name", "own-output"} <= rules, rules
print("PASS leak shape trips 5 independent rules:", sorted(rules))

# strip(): a multi-line section loses the commentary LINE; real bullets stay
OUTCOMES = ("Cut unit cost 40% / by qualifying a second detector supplier\n"
            + LEAK_SHAPE + "\n"
            "Shipped 3 sensor generations / on schedule across two sites")
s = MG.strip(OUTCOMES)
assert "instructions" not in s and "Cut unit cost" in s and "Shipped 3" in s, s
assert len(s.split("\n")) == 2, s
print("PASS strip: multi-line section drops the commentary line, keeps 2 real bullets")
# a one-line paragraph loses only the offending sentence
PARA = "I have run supplier qualification for ten years. Note: this paragraph was shortened as requested."
assert MG.strip(PARA) == "I have run supplier qualification for ten years.", MG.strip(PARA)
print("PASS strip: one-line paragraph drops only the commentary sentence")
assert MG.strip(LEAK_SHAPE) == "", "nothing real left -> '' so the caller drops the slot"
assert MG.strip("Clean text stays as is.") == "Clean text stays as is."
print("PASS strip: all-commentary text -> '', clean text unchanged")

# scrub_sections(): stored shapes (rich_block items, outcomes items, table rows, role bullets)
cv = [
    {"id": "profile", "type": "rich_block", "items": [{"b": "", "t": "Optics engineer with 12 years in sensing. "
                                                                   "Here is the revised profile.", "bullets": []}]},
    {"id": "outcomes", "type": "bullets", "items": [
        {"b": "Cut cost", "t": "40% by qualifying a second supplier", "bullets": [], "_oid": "cv_outcomes_1"},
        {"b": "", "t": LEAK_SHAPE, "bullets": []}]},
    {"id": "core_comp", "type": "table", "rows": [["The role needs", "What I bring, with proof"],
                                                  ["Supplier quality", "Qualified 4 suppliers"],
                                                  ["Test", "Note: row kept as requested."]]},
    {"id": "experience", "type": "experience", "roles": [
        {"id": "r1", "title": "Engineer", "bullets": ["Built a test rig", "See the cl_what_i_bring section."]}]},
]
before = MG.scan_sections(cv, "cv")
assert cv[1]["items"][1]["t"] == LEAK_SHAPE, "scan_sections must not modify its input"
found = MG.scrub_sections(cv, "cv")
assert len(found) == len(before) and found, found
assert cv[0]["items"][0]["t"] == "Optics engineer with 12 years in sensing.", cv[0]
assert len(cv[1]["items"]) == 1 and cv[1]["items"][0]["b"] == "Cut cost", cv[1]["items"]
assert cv[1]["items"][0]["_oid"] == "cv_outcomes_1", "underscore keys are furniture, never scanned"
assert cv[2]["rows"] == [["The role needs", "What I bring, with proof"], ["Supplier quality", "Qualified 4 suppliers"]], cv[2]
assert cv[3]["roles"][0]["bullets"] == ["Built a test rig"], cv[3]
paths = sorted({f["path"] for f in found})
assert "cv:outcomes.items[1].t" in paths and any(p.startswith("cv:core_comp.rows[2]") for p in paths), paths
assert not MG.scan_sections(cv, "cv"), "scrubbed sections are clean"
print("PASS scrub_sections: item dropped, sentence stripped, table row dropped, role bullet dropped (%d findings)" % len(found))

# gen-runner's pre-persist gate: regenerate once; a still-dirty regen falls back to strip
spec = importlib.util.spec_from_file_location("gr", os.path.join(HERE, "gen-runner.py"))
gr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gr)

def res_with(sections):
    return {"status": "done", "sections": {sid: {"title": sid, "state": "done", "result": t}
                                           for sid, t in sections.items()}}

plan = [{"id": "cv_outcomes"}, {"id": "cl_why_this_position"}, {"id": "cv_profile"}]
res = res_with({"cv_outcomes": OUTCOMES, "cl_why_this_position": "Note: shortened as requested.",
                "cv_profile": "Optics engineer with 12 years in sensing."})
asked = []
def regen_ok(sub):
    asked.append([p["id"] for p in sub])
    return res_with({"cv_outcomes": "Cut unit cost 40% / by qualifying a second detector supplier",
                     "cl_why_this_position": "Note: still commentary."})
log = gr.meta_gate(res, plan, regen_ok)
assert asked == [["cv_outcomes", "cl_why_this_position"]], "one regen call, only the dirty sections"
assert res["sections"]["cv_outcomes"]["result"].startswith("Cut unit cost 40%"), res["sections"]["cv_outcomes"]
assert res["sections"]["cv_outcomes"]["meta_gate"] == "regenerated"
assert res["sections"]["cl_why_this_position"]["result"] == "", "dirty regen + nothing real left -> dropped"
assert res["sections"]["cl_why_this_position"]["meta_gate"] == "dropped"
assert "meta_gate" not in res["sections"]["cv_profile"], "clean sections are untouched"
assert {e["action"] for e in log} == {"regenerated", "dropped"} and all(e["section"] for e in log), log
print("PASS meta_gate: one regen for the dirty sections; clean regen kept, dirty regen dropped")

res = res_with({"cv_outcomes": OUTCOMES})
def regen_down(sub):
    raise RuntimeError("proxy down")
log = gr.meta_gate(res, plan, regen_down)
assert res["sections"]["cv_outcomes"]["meta_gate"] == "stripped", res
assert "instructions" not in res["sections"]["cv_outcomes"]["result"]
assert res["sections"]["cv_outcomes"]["result"].count("\n") == 1
print("PASS meta_gate: regen failure -> commentary line stripped, real bullets persist")
assert gr.meta_gate(res_with({"cv_profile": "Clean."}), plan, regen_down) == []
print("PASS meta_gate: clean run -> no regen call, empty log")

# the WHY gate now reads the shared detector
assert gr._why_defects("Here is the revised paragraph, as requested.", "Acme")
print(("FAILURES: %d" % fails) if fails else "ALL PASS")
sys.exit(1 if fails else 0)
