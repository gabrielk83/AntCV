#!/usr/bin/env python3
"""JOBTRACKER-PULL-CLOBBERS-LOCAL-SUPPORT-001 - `pull` must not delete local work.

`push` always had a row-level 3-way merge; `pull` had none and wrote the cloud
doc straight over the local file. On 2026-08-20 the local doc held 34 `support`
blocks of role intel the cloud lacked - one nightly `pull --render` would have
destroyed all of them. Neither side's merge covered the uk-keyed dicts at all.

Network-free: _req is stubbed. No candidate data.

Run: python scripts/job-tracker/test_sync_merge.py
"""
import importlib.util, json, os, sys, tempfile

_D = tempfile.mkdtemp(prefix="antcv-sync-test-")
os.environ["JOB_DOC"] = os.path.join(_D, "job_tracker_doc.json")
os.environ.pop("JOB_BUILD", None)
os.environ.pop("JOB_XLSX", None)

SYNC = os.path.join(os.path.dirname(os.path.abspath(__file__)), "job-tracker-sync.py")
_spec = importlib.util.spec_from_file_location("jtsync", SYNC)
S = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(S)


def _row(uk, note=""):
    return [1, "Co", "Role" + note, "", "", "", "", "", "", "", "", uk, ""]


def _write(path, obj):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f)


def test_pull_keeps_local_only_entries():
    base = {"rows": [_row("a")], "support": {"a": "base-a"}, "jd": {}}
    # local added intel for two rows the cloud has never seen
    local = {"rows": [_row("a")], "support": {"a": "base-a", "b": "local-b", "c": "local-c"},
             "jd": {"b": "local jd"}}
    cloud = {"rows": [_row("a"), _row("z")], "support": {"a": "base-a", "z": "cloud-z"}, "jd": {}}
    _write(S.DOC, local); _write(S.SNAP, {"rev": 5, "doc": base})
    S._req = lambda method="GET", body=None: (200, {"rev": 6, "doc": cloud})
    S.cmd_pull()
    got = json.load(open(S.DOC, encoding="utf-8"))
    assert got["support"] == {"a": "base-a", "b": "local-b", "c": "local-c", "z": "cloud-z"}, got["support"]
    assert got["jd"] == {"b": "local jd"}, got["jd"]
    assert {r[11] for r in got["rows"]} == {"a", "z"}, got["rows"]
    snap = json.load(open(S.SNAP, encoding="utf-8"))
    assert snap["rev"] == 6 and snap["doc"] == cloud, "snapshot must record the CLOUD, not the merge"
    print("PASS: pull keeps local-only entries and still takes the cloud's new ones.")


def test_pull_conflict_prefers_local_and_reports():
    base = {"rows": [_row("a")], "support": {"a": "base"}}
    local = {"rows": [_row("a")], "support": {"a": "LOCAL"}}
    cloud = {"rows": [_row("a")], "support": {"a": "CLOUD"}}
    _write(S.DOC, local); _write(S.SNAP, {"rev": 1, "doc": base})
    S._req = lambda method="GET", body=None: (200, {"rev": 2, "doc": cloud})
    S.cmd_pull()
    got = json.load(open(S.DOC, encoding="utf-8"))
    assert got["support"]["a"] == "LOCAL", got["support"]
    # remote-only change (local untouched since base) must take the CLOUD value
    _write(S.DOC, {"rows": [_row("a")], "support": {"a": "base"}})
    _write(S.SNAP, {"rev": 1, "doc": base})
    S.cmd_pull()
    got = json.load(open(S.DOC, encoding="utf-8"))
    assert got["support"]["a"] == "CLOUD", got["support"]
    print("PASS: both-changed -> local wins; cloud-only change -> cloud wins.")


def test_pull_force_overwrites():
    local = {"rows": [_row("a")], "support": {"a": "LOCAL", "keepme": "x"}}
    cloud = {"rows": [_row("a")], "support": {"a": "CLOUD"}}
    _write(S.DOC, local); _write(S.SNAP, {"rev": 1, "doc": local})
    S._req = lambda method="GET", body=None: (200, {"rev": 2, "doc": cloud})
    S.cmd_pull(force=True)
    got = json.load(open(S.DOC, encoding="utf-8"))
    assert got == cloud, got
    print("PASS: --force still takes the cloud wholesale.")


def test_push_409_merge_keeps_cloud_only_entries():
    base = {"rows": [_row("a")], "support": {"a": "base"}}
    local = {"rows": [_row("a")], "support": {"a": "base", "mine": "local"}}
    cloud = {"rows": [_row("a")], "support": {"a": "base", "theirs": "cloud"}}
    merged, conflicts = S._merge(base, local, cloud)
    assert merged["support"] == {"a": "base", "mine": "local", "theirs": "cloud"}, merged["support"]
    assert not conflicts, conflicts
    print("PASS: a 409 push merge no longer drops cloud-only entries either.")


def test_outcome_maps_survive_a_merge():
    # OUTCOME-RECORD-001: status_history / followups / financials are written to the
    # cloud by the PWA and the scripts. Outside UK_DICT_FIELDS a top-level key came
    # from LOCAL only, so a pull-then-push would have dropped all three.
    base = {"rows": [_row("a")]}
    local = {"rows": [_row("a")], "status_history": {"b": [{"status": "Submitted", "date": "2026-11-01"}]}}
    cloud = {"rows": [_row("a")],
             "status_history": {"a": [{"status": "Interview", "date": "2026-11-04", "stage": "1st"}]},
             "followups": {"a": {"submitted": "2026-10-20", "submitted_source": "owner", "sent": []}},
             "financials": {"a": {"summary": "Acme annual report: revenue DKK 1.0m."}}}
    merged, conflicts = S._merge(base, local, cloud)
    assert set(merged["status_history"]) == {"a", "b"}, merged["status_history"]
    assert merged["followups"] == cloud["followups"], merged.get("followups")
    assert merged["financials"] == cloud["financials"], merged.get("financials")
    assert not conflicts, conflicts
    # SUBMITTED-VERSION-001 / INTERVIEW-PREP-001 / the clearance gate: same rule.
    for f in ("submitted", "interview", "interview_next", "eligibility"):
        assert f in S.UK_DICT_FIELDS, f
    print("PASS: status_history / followups / financials (+ submitted, interview, eligibility) survive a merge.")


def test_legacy_history_list_does_not_crash_the_merge():
    # OUTCOME-RECORD-002: the first doc design kept a workbook history[] LIST at
    # doc.history. It is not a uk-keyed field, and a list value in a uk-keyed field
    # is kept whole instead of crashing pull / push.
    assert "history" not in S.UK_DICT_FIELDS
    legacy = [{"week": "2026-W27"}]
    base = {"rows": [_row("a")], "history": legacy}
    merged, conflicts = S._merge(base, {"rows": [_row("a")], "history": legacy}, {"rows": [_row("a")], "history": legacy})
    assert merged["history"] == legacy, merged["history"]
    got, cf = S._merge_uk_dict({}, {"followups": ["odd"]}, {"followups": {"a": {}}}, "followups")
    assert got == ["odd"] and not cf, got
    got, cf = S._merge_uk_dict({}, {}, {"followups": ["odd"]}, "followups")
    assert got == ["odd"] and not cf, got
    print("PASS: a list-valued doc key is kept whole, never crashes the merge.")


def test_render_does_not_replace_cloud_support_with_a_stub():
    # RENDER-SUPPORT-CLOBBER-001: the build re-emits the doc with support derived
    # from the row alone. A cloud research block must survive the render, a
    # local-only block must survive it, and only a key neither side has takes
    # the derived stub. The stub must not look like a local edit to the next pull.
    build = os.path.join(_D, "fake_build.py")
    with open(build, "w", encoding="utf-8") as f:
        f.write("import json, os\n"
                "p = os.environ['JOB_DOC']\n"
                "d = json.load(open(p, encoding='utf-8'))\n"
                "d['support'] = {r[11]: 'ROLE: stub ' + r[11] for r in d['rows']}\n"
                "json.dump(d, open(p, 'w', encoding='utf-8'))\n")
    rich = "ROLE: Co - Role\n" + "research line\n" * 40
    rows = [_row("a"), _row("b"), _row("c")]
    base = {"rows": rows, "support": {"a": rich}}
    local = {"rows": rows, "support": {"a": "ROLE: stub a", "b": "local intel b"}}
    cloud = {"rows": rows, "support": {"a": rich}}
    _write(S.DOC, local); _write(S.SNAP, {"rev": 7, "doc": base})
    S._req = lambda method="GET", body=None: (200, {"rev": 7, "doc": cloud})
    old_build, old_xlsx = S.BUILD, S.XLSX
    S.BUILD, S.XLSX = build, None
    try:
        S.cmd_pull(render=True)
    finally:
        S.BUILD, S.XLSX = old_build, old_xlsx
    got = json.load(open(S.DOC, encoding="utf-8"))["support"]
    assert got["a"] == rich, "cloud research block replaced by the render stub: %r" % got["a"][:40]
    assert got["b"] == "local intel b", got["b"]
    assert got["c"] == "ROLE: stub c", got["c"]
    print("PASS: render keeps cloud + local-only support blocks; the stub fills only empty keys.")


# SYNC-ENVELOPE-STALE-001 ------------------------------------------------------
_SAL = ["Salary", "60k", "55-75k", "Below 55k needs an offset."]
_SAL_APP = ["Salary", "60k", "55-75k", "Below 55k needs an offset.  -  [2026-11-01] rejected X"]
_TTL = ["Title", "TPM", "Specialist", "No junior title."]


def _pull(base, local, cloud):
    _write(S.DOC, local); _write(S.SNAP, {"rev": 1, "doc": base})
    S._req = lambda method="GET", body=None: (200, {"rev": 2, "doc": cloud})
    S.cmd_pull()
    return json.load(open(S.DOC, encoding="utf-8"))


def test_pull_takes_the_cloud_envelope_edit():
    d = lambda env: {"rows": [_row("a")], "envelope": env}
    # the owner edited one dimension in the app, local untouched since base
    other = ["Salary", "62k", "58-78k", "Reworded in the app."]
    got = _pull(d([_SAL, _TTL]), d([_SAL, _TTL]), d([other, _TTL]))
    assert got["envelope"] == [other, _TTL], got["envelope"]
    # an earlier pull already recorded the cloud as base and kept the stale local copy
    got = _pull(d([_SAL_APP, _TTL]), d([_SAL, _TTL]), d([_SAL_APP, _TTL]))
    assert got["envelope"] == [_SAL_APP, _TTL], got["envelope"]
    # no local envelope at all
    got = _pull(d([_SAL]), {"rows": [_row("a")]}, d([_SAL]))
    assert got["envelope"] == [_SAL], got
    print("PASS: an app-side envelope edit reaches the local doc, stuck stale copy included.")


def test_envelope_local_edits_survive():
    d = lambda env: {"rows": [_row("a")], "envelope": env}
    mine = ["Title", "TPM", "Specialist or lead", "No junior title."]
    merged, cf = S._merge(d([_SAL, _TTL]), d([_SAL, mine]), d([_SAL_APP, _TTL]))
    assert merged["envelope"] == [_SAL_APP, mine] and not cf, (merged["envelope"], cf)
    theirs = ["Title", "TPM", "Manager", "No junior title."]
    merged, cf = S._merge(d([_TTL]), d([mine]), d([theirs]))
    assert merged["envelope"] == [mine] and cf == ["envelope[Title](local-wins)"], (merged["envelope"], cf)
    extra = ["Pets", "yes", "", ""]
    merged, cf = S._merge(d([_SAL]), d([_SAL, extra]), d([_SAL]))
    assert merged["envelope"] == [_SAL, extra] and not cf, merged["envelope"]
    merged, cf = S._merge(d([_SAL, extra]), d([_SAL, extra]), d([_SAL]))
    assert merged["envelope"] == [_SAL] and not cf, merged["envelope"]
    merged, cf = S._merge(d([_SAL]), d([_SAL]), {"rows": [_row("a")]})
    assert merged["envelope"] == [_SAL] and not cf, merged["envelope"]
    print("PASS: a local envelope edit survives; a real both-changed dimension is reported.")


def test_cloud_only_top_level_keys_survive():
    cloud = {"rows": [_row("a")], "postingcheck": {"a": {"misses": 1}}, "newmap": {"a": 1}}
    got = _pull({"rows": [_row("a")]}, {"rows": [_row("a")]}, cloud)
    assert got.get("postingcheck") == cloud["postingcheck"], got
    assert got.get("newmap") == {"a": 1}, got
    # a stale local strike count takes the cloud's
    cloud2 = {"rows": [_row("a")], "postingcheck": {"a": {"misses": 0}}}
    got = _pull(cloud, {"rows": [_row("a")], "postingcheck": {"a": {"misses": 1}}}, cloud2)
    assert got["postingcheck"] == {"a": {"misses": 0}}, got
    print("PASS: cloud-only top-level keys (postingcheck strikes) survive a merge.")


# SYNC-SUPPORT-STUB-001 --------------------------------------------------------
def _frow(uk, fit="Fit text.", flag="Flag line"):
    return [1, "Co", "Role", "", "", "Proposed", fit, "", "", "", flag, uk, ""]


def _stub(row):
    # byte for byte what build_workbook.py _support_for() derives from a row
    parts = ["ROLE: %s \u2014 %s (%s)" % (row[1], row[2], row[4])]
    if row[6]: parts.append("FIT: " + row[6])
    if row[10]: parts.append("FLAG/RISK: " + row[10])
    return "\n".join(parts)


def test_row_stub_never_counts_as_local_intel():
    plain, grown = _frow("a"), _frow("b", flag="closed 2026-11-22\nOld flag")
    # b's stub was derived before the sweep prepended the closure line
    old_b = _stub(_frow("b", flag="Old flag"))
    real = _stub(_frow("c")) + "\nWHY BEST FIT: typed by hand"
    other = _stub(_frow("d")).replace("Fit text.", "A different fit, edited locally.")
    rows = [plain, grown, _frow("c"), _frow("d")]
    local = {"rows": rows, "support": {"a": _stub(plain), "b": old_b, "c": real, "d": other}}
    cloud = {"rows": rows, "support": {}}
    got = _pull(cloud, local, cloud)["support"]
    assert got == {"c": real, "d": other}, got
    print("PASS: a block that only restates its row is not local intel; real blocks stay.")


def test_row_stub_never_beats_a_cloud_block():
    row = _frow("a")
    rich = _stub(row) + "\nWHY BEST FIT: research\nSALARY EXPECTATION: 60k"
    d = lambda sup, r=row: {"rows": [r], "support": sup}
    # the cloud gained a real block for a row the last render had stubbed
    merged, cf = S._merge(d({}), d({"a": _stub(row)}), d({"a": rich}))
    assert merged["support"] == {"a": rich} and not cf, (merged["support"], cf)
    # the stub replaced a block the snapshot already knew
    merged, cf = S._merge(d({"a": rich}), d({"a": _stub(row)}), d({"a": rich}))
    assert merged["support"] == {"a": rich} and not cf, (merged["support"], cf)
    # the row's fit cell was rewritten in the cloud after the stub was made
    merged, cf = S._merge(d({}), d({"a": _stub(row)}), d({"a": rich}, _frow("a", fit="New fit.")))
    assert merged["support"] == {"a": rich} and not cf, (merged["support"], cf)
    # an import-xlsx edit changed the local row; the stub still matches the cloud row
    merged, cf = S._merge(d({}), d({"a": _stub(row)}, _frow("a", fit="Xlsx fit.")), d({"a": rich}))
    assert merged["support"] == {"a": rich} and not cf, (merged["support"], cf)
    # a real local edit still wins and is reported
    mine = _stub(row) + "\nNEED: my note"
    merged, cf = S._merge(d({}), d({"a": mine}), d({"a": rich}))
    assert merged["support"] == {"a": mine} and cf == ["support[a](local-wins)"], (merged["support"], cf)
    print("PASS: a row stub never beats a cloud block; a real local edit still does.")


def test_render_leaves_no_row_stub_behind():
    build = os.path.join(_D, "fake_build2.py")
    with open(build, "w", encoding="utf-8") as f:
        f.write("import json, os\n"
                "p = os.environ['JOB_DOC']\n"
                "d = json.load(open(p, encoding='utf-8'))\n"
                "d['support'] = {r[11]: 'ROLE: %s \u2014 %s (%s)\\nFIT: %s\\nFLAG/RISK: %s'"
                " % (r[1], r[2], r[4], r[6], r[10]) for r in d['rows']}\n"
                "d['support']['t5'] += '\\nNEED: hard-coded Top-5 detail'\n"
                "json.dump(d, open(p, 'w', encoding='utf-8'))\n")
    rows = [_frow("a"), _frow("b"), _frow("c"), _frow("t5")]
    local = {"rows": rows, "support": {"b": "local intel b"}}
    cloud = {"rows": rows, "support": {"a": "cloud research a"}}
    _write(S.DOC, local); _write(S.SNAP, {"rev": 7, "doc": cloud})
    S._req = lambda method="GET", body=None: (200, {"rev": 7, "doc": cloud})
    old = S.BUILD, S.XLSX
    S.BUILD, S.XLSX = build, None
    try:
        S.cmd_pull(render=True)
    finally:
        S.BUILD, S.XLSX = old
    got = json.load(open(S.DOC, encoding="utf-8"))["support"]
    assert got == {"a": "cloud research a", "b": "local intel b",
                   "t5": _stub(_frow("t5")) + "\nNEED: hard-coded Top-5 detail"}, got
    print("PASS: a render leaves no row stub in the local doc; a non-derived build block stays.")


if __name__ == "__main__":
    test_pull_keeps_local_only_entries()
    test_pull_conflict_prefers_local_and_reports()
    test_pull_force_overwrites()
    test_push_409_merge_keeps_cloud_only_entries()
    test_outcome_maps_survive_a_merge()
    test_legacy_history_list_does_not_crash_the_merge()
    test_render_does_not_replace_cloud_support_with_a_stub()
    test_pull_takes_the_cloud_envelope_edit()
    test_envelope_local_edits_survive()
    test_cloud_only_top_level_keys_survive()
    test_row_stub_never_counts_as_local_intel()
    test_row_stub_never_beats_a_cloud_block()
    test_render_leaves_no_row_stub_behind()
    print("\nOK - 13/13")
    sys.exit(0)
