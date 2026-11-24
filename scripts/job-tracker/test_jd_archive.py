#!/usr/bin/env python3
"""JT-DOC-SIZE-001 - the doc size guard and the ad-text archive.

Network-free: an in-memory relay stands in for /api/job-tracker and
/api/application-snapshots. No candidate data.

Run: python scripts/job-tracker/test_jd_archive.py
"""
import contextlib, copy, datetime, importlib.util, io, json, os, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
_D = tempfile.mkdtemp(prefix="antcv-jd-archive-")
os.environ["JOB_DOC"] = os.path.join(_D, "job_tracker_doc.json")
os.environ.pop("JOB_BUILD", None)
os.environ.pop("JOB_XLSX", None)
sys.path.insert(0, HERE)


def _load(name, fname):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, fname))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


JA = _load("jd_archive_t", "jd_archive.py")
S = _load("jtsync", "job-tracker-sync.py")
GR = _load("genrun", "gen-runner.py")
CP = _load("checkpost", "check-postings.py")
DP = _load("discover", "discover-positions.py")

TODAY = datetime.date(2026, 11, 24)
AD = "Vi søger en optikingeniør – „krav“: 5 års erfaring.\r\n" + "Ansøgningsfrist 2027-01-15. Lorem ipsum dolor. " * 40


def row(uk, status="Archive / closed", band="D9D9D9", flag="closed 2026-10-01: not a fit", rank=1):
    return [rank, "Co " + uk, "Role " + uk, "", "", "", "", "OPEN", status, "", flag, uk, band]


def doc_with(*rows, **maps):
    d = {"version": 2, "rows": list(rows), "envelope": [["Salary", "x"]],
         "urls": {r[11]: "https://jobs.example/" + r[11] for r in rows},
         "jd": {r[11]: AD + r[11] for r in rows},
         "queue": {}, "artifacts": {}, "support": {r[11]: "ROLE: " + r[11] for r in rows}}
    d.update(maps)
    return d


class FakeRelay:
    """GET/PUT with rev, insert-only snapshots. before_put runs once, as another writer would."""

    def __init__(self, doc, rev=393):
        self.doc, self.rev, self.snaps, self.puts, self.posts = copy.deepcopy(doc), rev, [], 0, 0
        self.before_put = None
        self.corrupt = None

    def get_doc(self):
        return self.rev, copy.deepcopy(self.doc)

    def put_doc(self, doc, base_rev):
        if self.before_put:
            hook, self.before_put = self.before_put, None
            hook(self)
        if base_rev != self.rev:
            return 409, {"error": "conflict"}
        self.doc, self.rev, self.puts = json.loads(json.dumps(doc)), self.rev + 1, self.puts + 1
        return 200, {"ok": True, "rev": self.rev}

    def snapshots(self, uk):
        return [{"id": s["id"], "kind": s["kind"]} for s in self.snaps if s["uk"] == uk]

    def snapshot_text(self, sid):
        return next(s["text"] for s in self.snaps if s["id"] == sid)

    def post(self, pick):
        self.posts += 1
        text = pick["jd"] if self.corrupt != pick["uk"] else pick["jd"][:-1]
        self.snaps.append({"id": len(self.snaps) + 1, "uk": pick["uk"], "kind": JA.KIND, "text": text})
        return len(self.snaps)


def _apply(net, rev=393, min_age=14):
    said = []
    folder = tempfile.mkdtemp(prefix="bk-", dir=_D)
    rep = JA.run_apply(net, rev, TODAY, min_age, folder, say=said.append)
    return rep, said, folder


def _stops(fn, needle):
    try:
        fn()
    except JA.Stop as e:
        assert needle in str(e), "stopped for another reason: %s" % e
        return
    raise AssertionError("expected a stop containing %r" % needle)


# ---------------------------------------------------------------- what may move

def test_only_rows_every_reader_skips_may_move():
    assert JA.why_kept(doc_with(row("a")), row("a"), TODAY) == "", "the control row must qualify"
    cases = {
        "open": row("a", "Identified (posting saved)", "E2EFDA"),
        "closed for some readers only": row("a", "Archive / closed", "DDEBF7"),
        "packaged by hand": row("a", flag="\U0001F4E6 Package 1043 | closed 2026-10-01"),
        "no closing date": row("a", flag="Rejected (Salary): other candidate"),
        "closed under 14 days ago": row("a", flag="⌛ posting closed 2026-11-18 (gone: 404)"),
    }
    for want, r in cases.items():
        assert JA.why_kept(doc_with(r), r, TODAY) == want, (want, JA.why_kept(doc_with(r), r, TODAY))
    # band says closed, status does not: discover-positions' eligibility sweep still reads it
    r = row("a", "Identified (posting saved)", "D9D9D9")
    assert JA.why_kept(doc_with(r), r, TODAY) == "closed for some readers only"
    r = row("a", "Rejected", "D9D9D9")
    assert JA.why_kept(doc_with(r), r, TODAY) == "closed for some readers only", "an employer rejection was an application"
    r = row("a")
    for want, maps in {
        "has an application": {"artifacts": {"a": {"application_id": 7}}},
        "has a submitted version": {"submitted": {"a": {"snapshot_id": 1}}},
        "has a interview": {"interview": {"a": {"md": "x"}}},
        "has a follow-up": {"followups": {"a": {"submitted": "2026-09-01"}}},
        "was drafted or sent": {"status_history": {"a": [{"date": "2026-09-01", "status": "Submitted"}]}},
        "pinned": {"pin": {"a": True}},
        "armed": {"queue": {"a": True}},
        "already archived": {"jd": {"a": JA.make_stub(5000, TODAY)}},
        "short or not text": {"jd": {"a": "x" * 300}},
        "no ad text": {"jd": {}},
    }.items():
        got = JA.why_kept(doc_with(r, **maps), r, TODAY)
        assert got == want, (want, got)
    print("PASS: a row moves only when every reader skips it and nothing was ever sent for it.")


def test_the_newest_closing_date_counts():
    r = row("a", flag="closed 2026-08-01: x")
    d = doc_with(r, postingcheck={"a": {"archived_on": "2026-11-20"}})
    assert JA.closed_on(d, r) == datetime.date(2026, 11, 20)
    d = doc_with(r, status_history={"a": [{"date": "2026-11-22", "status": "Archive / closed"}]})
    assert JA.closed_on(d, r) == datetime.date(2026, 11, 22)
    assert JA.why_kept(d, r, TODAY).startswith("closed under")
    assert JA.why_kept(d, r, TODAY, min_age=0) == ""
    print("PASS: the newest closing date on record decides the 14 days.")


# ---------------------------------------------------------------- the marker

def test_marker_reads_as_no_ad_text_everywhere():
    stub = JA.make_stub(123456, TODAY)
    assert JA.is_stub(stub) and not JA.is_stub(AD) and not JA.is_stub("") and not JA.is_stub(None)
    assert len(stub) < 200, "the island tests length > 200"
    assert GR.jd_content_len(stub) <= 200, "gen-runner tests jd_content_len > 200"
    assert CP.deadlines.find_deadline(stub, TODAY) is None, "the marker's date must not read as a deadline"
    print("PASS: the marker (%d characters) reads as 'no ad text' and as no deadline." % len(stub))


def _live_reads(d):
    """Everything the nightly and discovery derive from the doc's ad texts."""
    probed = []
    for r in d["rows"]:                        # check-postings.probe_rows' own gate
        uk = CP.row_uk(r)
        if (d["urls"].get(uk) or "").strip() and not CP.is_archived(r):
            probed.append((uk, str(CP.deadlines.find_deadline(str(d["jd"].get(uk) or ""), TODAY))))
    return {"eligible": GR.eligible_rows(d), "eligible_forced": GR.eligible_rows(d, force=True),
            "eligible_by_name": GR.eligible_rows(d, only={r[11] for r in d["rows"]}),
            "unqueued": GR.unqueued_ready_rows(d), "armed": GR.armed_with_app_rows(d),
            "owner_packaged": GR.owner_packaged_rows(d), "eligibility": DP.eligibility_sweep(d),
            "sweep": probed, "known": [sorted(map(str, k)) for k in DP._existing_keys(d)]}


def test_nightly_reads_the_same_rows_before_and_after():
    d = doc_with(row("gone"), row("gone2", "Archive / not a fit"),
                 row("live", "Identified (posting saved)", "E2EFDA", ""),
                 row("armed", "Not started", "DDEBF7", ""),
                 row("sent", "Submitted", "DDEBF7", "\U0001F4E6 Package 1"),
                 row("half", "Archive / closed", "DDEBF7"),
                 row("band", "Identified (posting saved)", "D9D9D9"),
                 queue={"live": False, "armed": True, "gone": False})
    picks = {p["uk"]: p["jd"] for p in JA.select(d, TODAY)}
    assert set(picks) == {"gone", "gone2"}, picks.keys()
    after = JA.with_stubs(d, picks, TODAY)
    assert _live_reads(d) == _live_reads(after), "the trim changed what the nightly reads"
    assert JA.changed_paths(d, after) == ["jd.gone", "jd.gone2"], JA.changed_paths(d, after)
    # negative control: the same comparison must see a live row's text going missing
    broken = JA.with_stubs(d, {"armed": d["jd"]["armed"]}, TODAY)
    assert _live_reads(d) != _live_reads(broken), "the comparison is blind"
    print("PASS: eligibility, the sweep, the ready lists and the dedup keys are identical after the trim.")


def test_marker_survives_both_sync_merges():
    full = doc_with(row("a"), row("b", "Not started", "E2EFDA", ""))
    cloud = JA.with_stubs(full, {"a": full["jd"]["a"]}, TODAY)
    merged, conflicts = S._merge(full, full, cloud)
    assert JA.is_stub(merged["jd"]["a"]) and merged["jd"]["b"] == full["jd"]["b"] and not conflicts
    # why the text is shortened and the key kept: a REMOVED key comes back from the stale copy
    cloud2 = copy.deepcopy(full)
    del cloud2["jd"]["a"]
    merged2, _ = S._merge(full, full, cloud2)
    assert merged2["jd"]["a"] == full["jd"]["a"], "if this changes, removing the key would be safe too"
    print("PASS: an unchanged local copy takes the marker; a removed key would have come back.")


# ---------------------------------------------------------------- apply

def test_apply_moves_the_text_and_nothing_else():
    d = doc_with(row("a"), row("b", "Not started", "E2EFDA", ""), row("c", "Archive / not a fit"))
    net = FakeRelay(d)
    rep, said, folder = _apply(net)
    assert rep["rows"] == 2 and net.rev == 394 and net.puts == 1
    assert JA.changed_paths(d, net.doc) == ["jd.a", "jd.c"]
    assert net.doc["rows"] == d["rows"], "no row data or status changes"
    assert rep["bytes_before"] == JA.doc_bytes(d) and rep["bytes_after"] == JA.doc_bytes(net.doc) < rep["bytes_before"]
    assert {s["uk"]: s["text"] for s in net.snaps} == {"a": d["jd"]["a"], "c": d["jd"]["c"]}
    back = json.loads(open(rep["backup"], encoding="utf-8").read())
    assert back == d and os.path.dirname(rep["backup"]) == folder, "the backup is the whole doc as it was"
    # a second run has nothing to do
    assert _apply(net, rev=394)[0] is None and net.rev == 394
    print("PASS: apply moves the text, keeps every row, and the backup is the whole doc.")


def test_apply_refuses_a_doc_that_moved():
    net = FakeRelay(doc_with(row("a")))
    _stops(lambda: _apply(net, rev=392), "the doc moved")
    assert net.puts == 0 and net.posts == 0
    print("PASS: a plan made on another rev writes nothing.")


def test_a_copy_that_does_not_read_back_stops_before_the_doc():
    net = FakeRelay(doc_with(row("a"), row("c")))
    net.corrupt = "c"
    _stops(lambda: _apply(net), "does not read back word for word")
    assert net.puts == 0 and net.rev == 393 and net.doc["jd"]["a"].startswith("Vi søger")
    print("PASS: one bad archive copy stops the run with the doc untouched.")


def test_a_bad_backup_stops_before_anything():
    net = FakeRelay(doc_with(row("a")))
    real = JA.json.loads
    JA.json.loads = lambda *a, **k: {"not": "the doc"}
    try:
        _stops(lambda: _apply(net), "does not read back as the doc")
    finally:
        JA.json.loads = real
    assert net.puts == 0 and net.posts == 0
    print("PASS: an unreadable backup stops the run before the first write.")


def test_409_keeps_the_other_writer_and_drops_a_reopened_row():
    net = FakeRelay(doc_with(row("a"), row("c"), row("e")))

    def other(n):
        n.rev += 1
        n.doc["rows"][1][8], n.doc["rows"][1][12] = "Not started", "E2EFDA"      # c reopened
        n.doc["jd"]["e"] = "a new ad text the owner pasted " * 30                # e replaced
        n.doc["signals"] = {"a": "typed meanwhile"}
    net.before_put = other
    rep, said, _ = _apply(net)
    assert rep["rows"] == 1 and JA.is_stub(net.doc["jd"]["a"])
    assert net.doc["jd"]["c"] == AD + "c", "a reopened row keeps its ad text"
    assert net.doc["jd"]["e"].startswith("a new ad text"), "a replaced ad text is never overwritten"
    assert net.doc["signals"] == {"a": "typed meanwhile"}, "the other writer's edit survives"
    print("PASS: on a rev conflict the other save survives and changed rows are left alone.")


def test_rerun_after_a_failure_does_not_store_a_text_twice():
    net = FakeRelay(doc_with(row("a"), row("c")))
    put = net.put_doc
    net.put_doc = lambda doc, rev: (500, {"error": "d1_write_failed"})
    _stops(lambda: _apply(net), "PUT failed")
    assert net.posts == 2
    net.put_doc = put
    rep, said, _ = _apply(net)
    assert rep["rows"] == 2 and net.posts == 2, "the copies from the failed run are reused"
    print("PASS: a rerun reuses the archive copies.")


def test_restore_returns_the_text_word_for_word():
    d = doc_with(row("a"), row("b", "Not started", "E2EFDA", ""))
    net = FakeRelay(d)
    _apply(net)
    JA.run_restore(net, ["a"], say=lambda *_: None)
    assert net.doc == d, JA.changed_paths(d, net.doc)
    _stops(lambda: JA.run_restore(net, ["a"], say=lambda *_: None), "already has an ad text")
    _stops(lambda: JA.run_restore(net, ["b"], say=lambda *_: None), "no archived ad text")
    print("PASS: restore gives back the original doc and never overwrites a text.")


# ---------------------------------------------------------------- the size guard

def _status(doc, local=None):
    S._req = lambda method="GET", body=None: (200, {"rev": 393, "doc": doc})
    for p in (S.DOC, S.SNAP):
        if os.path.exists(p):
            os.remove(p)
    if local is not None:
        json.dump(local, open(S.DOC, "w", encoding="utf-8"))
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        S.cmd_status()
    return out.getvalue()


def _sized(n):
    d = {"rows": [], "jd": {"a": ""}}
    d["jd"]["a"] = "x" * (n - JA.doc_bytes(d))
    assert JA.doc_bytes(d) == n
    return d


def test_status_warns_past_the_threshold():
    quiet = _status(_sized(JA.WARN_BYTES))
    assert "cloud doc size: 1,800,000 bytes (90.0% of D1's 2,000,000-byte row limit)" in quiet, quiet
    assert "WARNING" not in quiet, "exactly at the threshold is not past it"
    loud = _status(_sized(JA.WARN_BYTES + 1))
    assert "WARNING JT-DOC-SIZE-001" in loud and "199,999 left" in loud and "jd_archive.py plan" in loud, loud
    assert "local doc size: 1,900,000 bytes" in _status({"rows": []}, local=_sized(1_900_000))
    print("PASS: status names the size and warns past 1.8 MB, for the cloud doc and the local one.")


def test_bytes_match_what_d1_counts():
    d = {"jd": {"a": "æøå – „x“ \U0001F4E6"}, "n": 1, "t": True, "z": None}
    js = '{"jd":{"a":"æøå – „x“ \U0001F4E6"},"n":1,"t":true,"z":null}'
    assert JA.doc_bytes(d) == len(js.encode("utf-8"))
    print("PASS: the size is UTF-8 bytes of the compact JSON the relay stores.")


def test_pull_and_push_show_the_warning():
    big = _sized(1_850_000)
    S._req = lambda method="GET", body=None: (200, {"rev": 5, "doc": big})
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        S.cmd_pull()
    assert "WARNING JT-DOC-SIZE-001" in out.getvalue()
    S._req = lambda method="GET", body=None: (200, {"rev": 6, "size_warning": "job-tracker doc is 1850000 bytes"})
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        S.cmd_push()
    assert "WARNING JT-DOC-SIZE-001: job-tracker doc is 1850000 bytes" in out.getvalue()
    S._req = lambda method="GET", body=None: (200, {"rev": 7, "doc": {"rows": []}})
    for p in (S.DOC, S.SNAP):
        os.remove(p)
    out = io.StringIO()
    with contextlib.redirect_stdout(out):
        S.cmd_pull()
    assert "WARNING" not in out.getvalue() and "size" not in out.getvalue(), "a small doc adds no line to the nightly log"
    print("PASS: pull (which the nightly runs) and push show the warning; a small doc adds nothing.")


def test_a_reopened_row_with_a_marker_is_named():
    d = doc_with(row("a", "Not started", "E2EFDA", ""))
    d["jd"]["a"] = JA.make_stub(5000, TODAY)
    assert JA.reopened(d) == ["a"]
    assert "restore --uk a" in "\n".join(JA.size_lines(d))
    d["rows"][0] = row("a")
    assert JA.reopened(d) == []
    print("PASS: a reopened row that still holds a marker is named with its restore command.")


if __name__ == "__main__":
    failed = 0
    for name, fn in sorted(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
            except Exception as e:  # noqa: BLE001 - report every belt, then exit 1
                failed += 1
                print("FAIL: %s: %s: %s" % (name, type(e).__name__, str(e)[:400]))
    sys.exit(1 if failed else 0)
