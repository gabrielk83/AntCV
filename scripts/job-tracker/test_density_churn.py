#!/usr/bin/env python3
"""DENSITY-REORDER-CHURN-001 — the two-try cap must follow the ITEM, not the string.

Drives the REAL `fit_density` loop network-free: `measure_density`'s render and
measure calls are stubbed, and `llm_refit` is replaced by a permuting stub that
mimics what the live `reorder` gate accepts — the same word multiset, a
different order, and a wrap that never actually improves.

Pre-fix, `attempts` was keyed by the item's own text, so every ACCEPTED rewrite
minted a fresh key with a fresh pair of tries and the pubs line was re-asked
once per iteration for the whole run (live: iters 1,2,3,4 in the Kaleido run,
2026-08-26, ending back where it started). Post-fix the chain root binds them.

Run: python scripts/job-tracker/test_density_churn.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import measure_density as MD          # noqa: E402
import density_fit as DF              # noqa: E402

PUB = ("A Nanomanipulator with Integrated Mechanical De-amplifier for Testing "
       "Nanostructures Under Tension - Ya'akobovitz, A., Karp, G.A., Hanein, Y., "
       "Krylov, S., Microsystem Technologies, 2010")


def _runt(text):
    """One rewritable pubs runt, shaped like a live measurer item."""
    return {"sec": "pubs", "kind": "item", "policy": "reorder", "text": text,
            "lines": 2, "trim_chars": 0, "add_lo": 4, "add_hi": 12,
            "add_min": 4, "add_wrap": 30, "path": ["cv", 0, "items", 0]}


def _report(text):
    r = _runt(text)
    return {"items": [r], "runts": [r], "stretched": [], "cell_cascades": [],
            "table_values_max_lines": 1, "quality_pct": 80.0, "pages": 2,
            "runt_count": 1, "rewritable_runts": 1, "defect_count": 1,
            "max_sidebar_gap": 0.0}


def run(iters=6):
    """Return (n_llm_asks, n_iterations_logged) for a pubs line that only ever
    gets permuted back and forth."""
    cv = [{"id": "pubs", "type": "rich_block", "loc": "main", "on": True,
           "items": [{"b": "", "t": PUB, "bullets": []}], "bullets": []}]
    cl = []
    state = {"text": PUB, "asks": 0}

    def fake_measure(pdf, payload, style_budget=None):
        return _report(state["text"])

    def fake_refit(items, language="en", facts="", n_families=None):
        """Accept every ask as a PERMUTATION — exactly what the reorder gate
        allows (same token multiset, small length drift) and exactly what the
        live run produced four times in a row."""
        state["asks"] += len(items)
        got = {}
        for it in items:
            words = it["text"].split(" ")
            k = 3 + (state["asks"] % 5)
            got[it["id"]] = " ".join(words[k:] + words[:k])
        return got, {}

    MD.render_pdf = lambda payload, timeout=150: b"%PDF-stub"
    MD.measure = fake_measure
    MD._build_doc = lambda gr, job: {"stub": True}
    MD._gen_runner = lambda: {"stub": True}
    DF.llm_refit = fake_refit

    def fake_write_back(root, measured, new):
        if measured != state["text"]:
            return 0
        state["text"] = new
        return 1
    DF.write_back = fake_write_back
    DF.write_back_fixture = lambda old_norm, new_text: 0

    _cv, _cl, out = DF.fit_density(cv, cl, {}, {}, {}, "en", doc="cv",
                                   max_iters=iters, verbose=False,
                                   fix_pins=False, effort="thorough")
    return state["asks"], len([l for l in out["log"] if l.startswith("iter ")])


def main():
    asks, iters = run(iters=6)
    bad = []
    # The item gets its two honest tries and no more, however many iterations
    # the effort profile allows. Pre-fix this was one ask per iteration (6).
    if asks > 2:
        bad.append(f"pubs line asked {asks} times over {iters} iterations "
                   f"— the two-try cap did not follow the item (expected <= 2)")
    if asks < 1:
        bad.append("pubs line was never asked — the stub loop did not run")
    # The permutation-detector itself.
    if not DF._same_tokens("a b, c.", "c a b"):
        bad.append("_same_tokens missed a pure permutation")
    if DF._same_tokens("a b c", "a b c d"):
        bad.append("_same_tokens accepted a text that gained a word")
    for line in bad:
        print("FAIL: " + line)
    print("test_density_churn: %s (asks=%d over %d iters, 3 checks)"
          % ("FAIL" if bad else "PASS", asks, iters))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
