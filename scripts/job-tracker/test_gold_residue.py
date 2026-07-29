#!/usr/bin/env python3
"""Self-test runner for the gold-residue rows 82/86 fixes — pure units only,
no relay/network. Run: python test_gold_residue.py  (exit 0 = green).

Covers:
  - ROLE-CANON-AUDIT-LEG-001  gold_audit.role_canon_issues
  - PUB-AUTHORS-FIRST-001      quality_pass._canon_pub (authors-first, no colon)
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import gold_audit as GA
import measure_density as MD
import quality_pass as QP

_n = 0
_fail = 0


def ok(name, cond):
    global _n, _fail
    _n += 1
    if cond:
        print("PASS " + name)
    else:
        _fail += 1
        print("FAIL " + name)


# ── Item A: role-canon export audit leg ──────────────────────────────────────
G = MD.gold_rules()


def _exp(roles):
    return [{"type": "experience", "roles": roles}]


def test_role_canon():
    # clean en — no issues
    cv = _exp([{"id": "kanzen", "title": "Product / Project Expert"},
               {"id": "innoviz-sa", "title": "System Architect"}])
    mis, dup = GA.role_canon_issues(cv, "en", G)
    ok("role_canon: clean en passes", not mis and not dup)

    # clean da/es/zh renderings pass on their own language
    ok("role_canon: clean da passes",
       GA.role_canon_issues(_exp([{"id": "idf", "title": "It-systemadministrator"}]), "da", G) == ([], []))
    ok("role_canon: clean es passes",
       GA.role_canon_issues(_exp([{"id": "idf", "title": "Administrador de Sistemas Informáticos"}]), "es", G) == ([], []))
    ok("role_canon: clean zh passes",
       GA.role_canon_issues(_exp([{"id": "idf", "title": "计算机系统管理员"}]), "zh", G) == ([], []))

    # an en title on a da document is a mismatch (title drift caught)
    mis, dup = GA.role_canon_issues(_exp([{"id": "idf", "title": "Computer Systems Administrator"}]), "da", G)
    ok("role_canon: en-title-on-da flagged", len(mis) == 1 and not dup)

    # backfill twin id (idf-2) resolves to the same canon and passes
    ok("role_canon: -N suffix twin resolves",
       GA.role_canon_issues(_exp([{"id": "idf-2", "title": "Computer Systems Administrator"}]), "en", G) == ([], []))

    # deliberate MERGE (more '&'-segments than canon.en) is exempt, never a fail
    ok("role_canon: merged title exempt",
       GA.role_canon_issues(_exp([{"id": "innoviz-sa", "title": "System Architect & Change Control Lead"}]), "en", G) == ([], []))

    # duplicate canonical identity (kanzen + kanzen-2) — one_visible_per_canonical_id
    mis, dup = GA.role_canon_issues(_exp([
        {"id": "kanzen", "title": "Product / Project Expert"},
        {"id": "kanzen-2", "title": "Product / Project Expert"},
    ]), "en", G)
    ok("role_canon: duplicate canonical id flagged", not mis and dup == ["kanzenx2"])

    # he/am/ar keep the translate output — the title check is skipped
    ok("role_canon: he skips title check",
       GA.role_canon_issues(_exp([{"id": "idf", "title": "arbitrary hebrew rendering"}]), "he", G) == ([], []))

    # a non-canon id (r1 gen schema at an unpinned position) is ignored, no crash
    ok("role_canon: unpinned id ignored",
       GA.role_canon_issues(_exp([{"id": "r1", "title": "Whatever"}]), "en", G) == ([], []))

    # no experience section / empty — never throws
    ok("role_canon: no experience section safe", GA.role_canon_issues([], "en", G) == ([], []))


# ── Item B: authors-first publication reorder ────────────────────────────────
def _words(s):
    return QP._pub_words(s)


def test_pub_authors_first():
    src = "Karp, G., Cohen, B., Nanomanipulator for scanning probe microscopy - Microsystem Technologies, 2010"
    out = QP._canon_pub(src)
    ok("pub: authors-first reordered to Title - Authors, Journal, Year",
       out == "Nanomanipulator for scanning probe microscopy - Karp, G., Cohen, B., Microsystem Technologies, 2010")

    # every word survives (token-multiset guard)
    ok("pub: token multiset preserved", _words(out) == _words(src))

    # idempotent — the canonical output no longer matches, so a re-run is a no-op
    ok("pub: idempotent (re-run returns None)", QP._canon_pub(out) is None)

    # single author + en-dash separator
    ok("pub: single author + en-dash",
       QP._canon_pub("Doe, J.A., Nanomanipulator design – Journal of Microsystems, 2012")
       == "Nanomanipulator design - Doe, J.A., Journal of Microsystems, 2012")

    # a hyphenated title word is NOT a split point (spaced '-' only)
    hy = "Roe, K., Electro-optics benchmarking method - Optics Letters, 2015"
    ok("pub: hyphenated title word not split",
       QP._canon_pub(hy) == "Electro-optics benchmarking method - Roe, K., Optics Letters, 2015")

    # journal-first path is untouched by the new branch
    ok("pub: journal-first still reorders",
       QP._canon_pub("Microsystem Technologies, 2010 - Karp, G.: Nanomanipulator")
       == "Nanomanipulator - Karp, G., Microsystem Technologies, 2010")

    # a plain non-citation string does not match
    ok("pub: non-citation untouched", QP._canon_pub("Some plain sentence without a citation shape") is None)


if __name__ == "__main__":
    test_role_canon()
    test_pub_authors_first()
    print(f"\nGOLD-RESIDUE SELF-TEST: {_n - _fail}/{_n} checks passed")
    sys.exit(1 if _fail else 0)
