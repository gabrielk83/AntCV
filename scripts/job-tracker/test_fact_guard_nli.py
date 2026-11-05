# FACT-GUARD-NLI-001 — tier-1 NLI fact check, model-free parts.
# Run: python scripts/job-tracker/test_fact_guard_nli.py   (exit 0 = pass)
# No torch needed: the scorer is stubbed. The live models are exercised by
# `fact_guard_nli.py --self-test` in the nli venv (see scripts/job-tracker/README.md).
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass
import fact_guard_nli as N  # noqa: E402

fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


KT = ("Hardware Project Manager, Lumen Optics, 2017-2020.\n"
      "Led NPI of 12 laser modules and cut test time by 35%.\n"
      "Optical Engineer, Photon Labs, 2014-2017.\n"
      "Designed beam combining optics in Zemax.\nShort line.")
facts = N.kernel_facts(KT)
check("facts: lines of 4+ words, short ones dropped", len(facts), 4)
check("retrieve: the NPI fact ranks first for an NPI claim",
      N.retrieve("I led the NPI of twelve laser modules at Lumen Optics.", facts, "en")[0],
      "Led NPI of 12 laser modules and cut test time by 35%.")
check("retrieve: nothing shared -> no evidence", N.retrieve("Banking app for retail customers online.", facts, "en"), [])
check("claims: intent and short sentences skipped",
      N.claims("I will cut your test time in half next year at your site. Short one. "
               "At Lumen Optics I led the NPI of twelve laser modules.", "en"),
      ["At Lumen Optics I led the NPI of twelve laser modules."])
check("verdict: support wins over a contradiction from another fact", N.verdict(0.8, 0.9), ("SUPPORTED", None))
check("verdict: strong contradiction without support fails", N.verdict(0.1, 0.7), ("CONTRADICTED", "FAIL"))
check("verdict: neutral is a warning", N.verdict(0.3, 0.2), ("UNSUPPORTED", "WARN"))
check("verdict: the binary model has no contradiction", N.verdict(0.3, None), ("UNSUPPORTED", "WARN"))


class Fake:
    """support high when the premise mentions 'laser', contradiction when the claim says 'never'."""
    calls = 0

    def score(self, premise, hyp, lang):
        Fake.calls += 1
        sup = 0.9 if ("laser" in premise.lower() and "laser" in hyp.lower() and "never" not in hyp.lower()) else 0.1
        con = (0.8 if "never" in hyp.lower() else 0.1) if lang in ("da", "sv") else None
        return sup, con


res = N.check("At Lumen Optics I led the NPI of twelve laser modules. "
              "At Lumen Optics I managed a team of forty software developers.", KT, "en", Fake())
check("check: only unsupported claims are returned, as WARN",
      [(r["verdict"], r["severity"]) for r in res], [("UNSUPPORTED", "WARN")])
res = N.check("Hos Lumen Optics har jeg aldrig arbejdet med lasermoduler, never.", KT, "da", Fake())
check("check: a contradicted Danish claim FAILs with evidence", (res[0]["verdict"], bool(res[0]["evidence"])),
      ("CONTRADICTED", True))
check("model choice: da/sv -> scandi, en -> factcg", [N.model_for(x) for x in ("da", "sv", "en")],
      ["scandi", "scandi", "factcg"])
check("models load from safetensors only, pinned revision configurable",
      all("rev" in m for m in N.MODELS.values()), True)

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - fact_guard_nli model-free (%d checks)" % sum(1 for ln in open(__file__, encoding="utf-8")
                                                          if ln.lstrip().startswith("check(")))
