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


if __name__ == "__main__":
    test_pull_keeps_local_only_entries()
    test_pull_conflict_prefers_local_and_reports()
    test_pull_force_overwrites()
    test_push_409_merge_keeps_cloud_only_entries()
    print("\nOK - 4/4")
    sys.exit(0)
