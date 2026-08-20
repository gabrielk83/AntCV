#!/usr/bin/env python3
"""PROVIDER-FALLBACK-CHAIN-001 - gen-runner provider fallback.

A provider out of credit is a PROVIDER outage, not a BATCH outage. On
2026-08-20 the job-tracker nightly killed its whole queue on an Anthropic
"credit balance is too low" 400 while OpenAI, Gemini and Mistral were all
healthy on the same proxy. gen-runner now retires the dead provider for the
run and re-drives the row on the next model in the tier's chain, aborting
only when every provider in that chain is exhausted.

Network-free: drive() and the doc/kernel fetches are stubbed, so this
exercises the REAL cmd_run loop. No candidate data.

Run: python scripts/job-tracker/test_provider_fallback.py
"""
import argparse, importlib.util, os, sys, tempfile

GENRUN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "gen-runner.py")
_spec = importlib.util.spec_from_file_location("genrun", GENRUN)
G = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(G)


def _row(rank, uk, role, company):
    return [rank, role, company, "", "", "", "", "", "", "", "", uk, ""]


DOC = {
    "rows": [_row(1, "rowa", "Role A", "Co A"), _row(2, "rowb", "Role B", "Co B")],
    "gen": {"rowa": "high", "rowb": "high"},
    "queue": {"rowa": True, "rowb": True},
    "jd": {"rowa": "JD A " * 200, "rowb": "JD B " * 200},
    "urls": {}, "support": {}, "signals": {}, "notes": {}, "artifacts": {},
}


def _install_stubs(exhausted, calls):
    G.get_doc = lambda: (1, DOC)
    G.load_kernel = lambda *a, **k: {"identity": {"name": "T"}, "history": {}}
    G.compact_profile = lambda k: {"identity": {"name": "T"}}
    G.research = lambda *a, **k: ""
    G.capture_brand_for = lambda r: None
    G.prior_app_digest = lambda c: None
    G._same_job_baseline = lambda *a, **k: None
    G.build_plan = lambda profile, meta, tier: ({"summary": {"body": {}}}, G.MODEL_HIGH)

    def fake_drive(sections, provider, model, **kw):
        calls.append((provider, model))
        if provider in exhausted:
            return {"status": "error", "sections": {},
                    "error": "Your credit balance is too low to access the API"}
        return {"status": "done", "coherence": {"state": "done"},
                "sections": {"summary": {"state": "done", "result": "ok"}}}
    G.drive = fake_drive


def _args(out):
    return argparse.Namespace(row=None, kernel_file=None, out=out, provider="anthropic",
                              max_high=5, max_quick=10, persist=False, measure=False,
                              max_pages=2, dry=False, force=False, research=False, brand=False)


def main():
    high, quick = G._chain_for("high"), G._chain_for("quick")
    assert [p for _m, p in high] == ["anthropic", "openai", "gemini", "mistral"], high
    assert [p for _m, p in quick] == ["openai", "gemini", "mistral"], quick
    assert len({p for _m, p in high}) == len(high), "chain must be provider-deduped"
    print("chain high :", high)
    print("chain quick:", quick)

    out = tempfile.mkdtemp(prefix="antcv-genrun-test-")

    # 1) one dead provider -> both rows still generate, on the fallback
    calls = []
    _install_stubs({"anthropic"}, calls)
    G.cmd_run(_args(out))
    provs = [p for p, _m in calls]
    assert provs == ["anthropic", "openai", "openai"], (
        "expected fall-through then a sticky fallback for row 2, got %r" % (provs,))
    print("PASS: one dead provider retires for the run; both rows generate on the fallback.")

    # 2) every provider dead -> abort, after trying each exactly once
    calls = []
    _install_stubs({"anthropic", "openai", "gemini", "mistral"}, calls)
    G.cmd_run(_args(out))
    provs = [p for p, _m in calls]
    assert provs == ["anthropic", "openai", "gemini", "mistral"], provs
    print("PASS: every provider exhausted -> batch aborts after one pass of the chain.")
    print("\nOK - 2/2")


if __name__ == "__main__":
    sys.exit(main())
