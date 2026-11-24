#!/usr/bin/env python3
"""jd_archive.py — JT-DOC-SIZE-001 (2026-11-24): keep the job-tracker doc under D1's row limit.

The tracker is ONE JSON string per user in D1 (job_tracker.doc). D1 caps a string and a
table row at 2,000,000 bytes; above it every PUT /api/job-tracker fails with
d1_write_failed. At rev 393 the doc was 1,803,683 bytes, 1,241,810 of them ad texts
(doc.jd), and three quarters of those belong to rows that are closed.

This tool moves the ad text of a closed row out of the live doc into
application_snapshot (kind 'jd_archive', insert-only, per user, already in the account
copy and the account delete). The row, its status, flag, url, queue, support and every
other map stay as they are. Nothing is deleted: the text is read back from the archive
and compared before the doc is touched, and `restore` puts it back word for word.

A short marker replaces the text. It is a VALUE, not a removed key, on purpose: both
mergers (job-tracker-sync.py _merge_uk_dict, the island's mergeDocs.ts) union keys, so a
removed key comes back from the first stale copy. A changed value with an unchanged
local copy takes the server side. The marker is under 200 characters, which every reader
already treats as "no job ad stored".

A row qualifies only when EVERY reader skips it. The readers disagree on "closed":
check-postings.py looks at the band, discover-positions.py eligibility at the status,
gen-runner.py and the island at either. So: Archive band AND an "Archive ..." status.
Rows with an application, a package, a submitted version, an interview or a follow-up
stay (the app sends doc.jd to the application when the owner reopens one), and so do
pinned and armed rows and rows closed less than --min-age-days ago.

Commands:
  plan [--min-age-days 14] [--json]         read-only: what would move, sizes before/after
  apply --expect-rev N [--min-age-days 14]  backup, archive, verify, then one rev-guarded PUT
  show --uk UK                              print an archived ad text
  restore --uk UK [--uk UK2]                put it back into the doc (rev-guarded)
"""
import argparse
import copy
import datetime
import hashlib
import importlib.util
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# Twins of JT_DOC_LIMIT_BYTES / JT_DOC_WARN_BYTES in workers/access-relay/src/index.js
# (job-tracker-size-guard.test.mjs fails when they differ).
LIMIT_BYTES = 2_000_000
WARN_BYTES = 1_800_000

KIND = "jd_archive"
MIN_AGE_DAYS = 14
MIN_CHARS = 400                        # a shorter text saves nothing worth a marker
ARCHIVE_BAND = "D9D9D9"
COL_COMPANY, COL_ROLE, COL_STATUS, COL_FLAG, COL_UK, COL_BAND = 1, 2, 8, 10, 11, 12

_STUB_RE = re.compile(r"^\[Job ad archived \d{4}-\d{2}-\d{2}, \d+ characters\.")
_CLOSED_RE = re.compile(r"closed (20\d\d-\d\d-\d\d)", re.I)
_SENT_RE = re.compile(r"submitted|applied|interview|offer|drafted", re.I)


# ------------------------------------------------------------------ sizes

def doc_bytes(value):
    """UTF-8 bytes of the JSON the relay stores (JSON.stringify: no spaces, no \\u escapes)."""
    return len(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8", "surrogatepass"))


def size_lines(doc, label="cloud doc"):
    """The size line, plus the warning block past WARN_BYTES and any reopened row that
    still holds a marker. Printed by job-tracker-sync.py status / pull."""
    n = doc_bytes(doc)
    out = ["%s size: %s bytes (%.1f%% of D1's %s-byte row limit)"
           % (label, format(n, ","), 100.0 * n / LIMIT_BYTES, format(LIMIT_BYTES, ","))]
    if n > WARN_BYTES:
        jd = doc.get("jd") if isinstance(doc.get("jd"), dict) else {}
        out.append("WARNING JT-DOC-SIZE-001: past %s bytes, %s left; above the limit every tracker save fails. "
                   "Ad texts take %s bytes. See what can move out: python scripts/job-tracker/jd_archive.py plan"
                   % (format(WARN_BYTES, ","), format(max(0, LIMIT_BYTES - n), ","), format(doc_bytes(jd), ",")))
    back = reopened(doc)
    if back:
        out.append("NOTE: %d open row(s) hold an archived ad text, so nothing can be generated from them. "
                   "Restore: python scripts/job-tracker/jd_archive.py restore %s"
                   % (len(back), " ".join("--uk " + uk for uk in back[:8])))
    return out


# ------------------------------------------------------------------ rows

def make_stub(chars, day):
    return "[Job ad archived %s, %d characters. Nothing is lost: jd_archive.py restore --uk <row key>]" % (
        day.isoformat(), chars)


def is_stub(text):
    return isinstance(text, str) and bool(_STUB_RE.match(text))


def _rows(doc):
    for row in doc.get("rows") or []:
        if isinstance(row, list) and len(row) > COL_BAND and row[COL_UK]:
            yield row


def _cell(row, i):
    return str(row[i] if len(row) > i and row[i] is not None else "")


def _map(doc, key):
    m = doc.get(key)
    return m if isinstance(m, dict) else {}


def closed_for_all(row):
    """Closed for EVERY reader (see the module docstring), not just for one of them."""
    return _cell(row, COL_BAND).upper() == ARCHIVE_BAND and _cell(row, COL_STATUS).startswith("Archive")


def closed_for_any(row):
    """gen-runner.py is_closed_row() / the island's isClosedRow(): a row the lists hide."""
    return (_cell(row, COL_BAND).upper() == ARCHIVE_BAND
            or bool(re.search(r"rejected|archive|closed|withdrawn|declined|no response|hired", _cell(row, COL_STATUS), re.I))
            or bool(re.match(r"^\s*dropped\b", _cell(row, COL_FLAG), re.I)))


def reopened(doc):
    jd = _map(doc, "jd")
    return [row[COL_UK] for row in _rows(doc) if is_stub(jd.get(row[COL_UK])) and not closed_for_any(row)]


def _day(s):
    try:
        return datetime.date.fromisoformat(str(s)[:10])
    except (TypeError, ValueError):
        return None


def closed_on(doc, row):
    """The newest closing date on record: the sweep's archived_on, 'closed YYYY-MM-DD' in
    the flag, or the last Archive entry of status_history. None when nothing dates it."""
    uk = row[COL_UK]
    pc = _map(doc, "postingcheck").get(uk)
    days = [_day((pc or {}).get("archived_on")) if isinstance(pc, dict) else None]
    days += [_day(d) for d in _CLOSED_RE.findall(_cell(row, COL_FLAG))]
    hist = _map(doc, "status_history").get(uk)
    for e in hist if isinstance(hist, list) else []:
        if isinstance(e, dict) and str(e.get("status") or "").startswith("Archive"):
            days.append(_day(e.get("date")))
    days = [d for d in days if d]
    return max(days) if days else None


def why_kept(doc, row, today, min_age=MIN_AGE_DAYS):
    """'' when the row's ad text may move, else the reason it stays."""
    uk = row[COL_UK]
    text = _map(doc, "jd").get(uk)
    if not text:
        return "no ad text"
    if is_stub(text):
        return "already archived"
    if not closed_for_all(row):
        return "closed for some readers only" if closed_for_any(row) else "open"
    if not isinstance(text, str) or len(text) <= MIN_CHARS:
        return "short or not text"
    art = _map(doc, "artifacts").get(uk)
    if isinstance(art, dict) and (art.get("application_id") or art.get("cv_export_url")):
        return "has an application"
    for key, why in (("submitted", "submitted version"), ("interview", "interview"),
                     ("interview_next", "interview"), ("followups", "follow-up")):
        if _map(doc, key).get(uk):
            return "has a " + why
    flag = _cell(row, COL_FLAG)
    if "\U0001F4E6" in flag or "\U0001F4E8" in flag:
        return "packaged by hand"
    hist = _map(doc, "status_history").get(uk)
    if any(_SENT_RE.search(str((e or {}).get("status") or "")) for e in (hist if isinstance(hist, list) else [])
           if isinstance(e, dict)):
        return "was drafted or sent"
    if _map(doc, "pin").get(uk):
        return "pinned"
    if _map(doc, "queue").get(uk):
        return "armed"
    day = closed_on(doc, row)
    if day is None:
        return "no closing date"
    if (today - day).days < min_age:
        return "closed under %d days ago" % min_age
    return ""


def select(doc, today, min_age=MIN_AGE_DAYS):
    jd = _map(doc, "jd")
    return [{"uk": row[COL_UK], "company": _cell(row, COL_COMPANY), "role": _cell(row, COL_ROLE),
             "status": _cell(row, COL_STATUS), "closed": closed_on(doc, row).isoformat(),
             "url": str(_map(doc, "urls").get(row[COL_UK]) or ""), "jd": jd[row[COL_UK]],
             "bytes": doc_bytes(jd[row[COL_UK]])}
            for row in _rows(doc) if not why_kept(doc, row, today, min_age)]


def with_stubs(doc, texts, today):
    """A copy of doc with doc.jd[uk] replaced by the marker for every uk in texts."""
    out = copy.deepcopy(doc)
    for uk, text in texts.items():
        out["jd"][uk] = make_stub(len(text), today)
    return out


def changed_paths(a, b):
    """Every top-level key, or jd key, that differs between two docs."""
    out = []
    for k in sorted(set(a) | set(b)):
        if a.get(k) == b.get(k) and (k in a) == (k in b):
            continue
        if k == "jd" and isinstance(a.get(k), dict) and isinstance(b.get(k), dict):
            out += ["jd." + u for u in sorted(set(a[k]) | set(b[k])) if a[k].get(u) != b[k].get(u)]
        else:
            out.append(k)
    return out


# ------------------------------------------------------------------ network

class Stop(Exception):
    """Nothing further is written."""


class Relay:
    """The live relay, through discover-positions.py's request helper (token, timeouts)."""

    def __init__(self):
        spec = importlib.util.spec_from_file_location("discover_positions", os.path.join(HERE, "discover-positions.py"))
        self._dp = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self._dp)

    def get_doc(self):
        return self._dp.get_doc()

    def put_doc(self, doc, base_rev):
        return self._dp.put_doc(doc, base_rev)

    def snapshots(self, uk):
        from urllib.parse import quote
        code, b = self._dp._req("/api/application-snapshots?uk=" + quote(uk, safe=""))
        if code != 200:
            raise Stop("snapshot list failed for %s: %s %s" % (uk, code, str(b)[:200]))
        return b.get("snapshots") or []

    def snapshot_text(self, sid):
        code, b = self._dp._req("/api/application-snapshots/%d" % int(sid))
        if code != 200:
            raise Stop("snapshot %s not readable: %s %s" % (sid, code, str(b)[:200]))
        return (((b.get("snapshot") or {}).get("data") or {}).get("posting") or {}).get("jd_text")

    def post(self, pick):
        code, b = self._dp._req("/api/application-snapshots", "POST", {
            "uk": pick["uk"], "kind": KIND,
            "posting": {"url": pick["url"], "jd_text": pick["jd"], "company": pick["company"], "role": pick["role"]}})
        if code == 400 and "invalid_kind" in str(b):
            raise Stop("the relay does not accept kind %r yet: deploy access-relay first" % KIND)
        if code != 201:
            raise Stop("archive write failed for %s: %s %s" % (pick["uk"], code, str(b)[:200]))
        return b["snapshot"]["id"]


def archived_text(net, uk):
    """(snapshot id, text) of the newest archive of this row, or (None, None)."""
    ids = [s["id"] for s in net.snapshots(uk) if s.get("kind") == KIND]
    return (max(ids), net.snapshot_text(max(ids))) if ids else (None, None)


def write_backup(folder, rev, doc, now=None):
    """The whole doc to a local file, read back and compared. Returns the path."""
    os.makedirs(folder, exist_ok=True)
    stamp = (now or datetime.datetime.now()).strftime("%Y%m%d-%H%M%S")
    path = os.path.join(folder, "job_tracker_rev%s_%s.json" % (rev, stamp))
    body = json.dumps(doc, ensure_ascii=False, separators=(",", ":")).encode("utf-8", "surrogatepass")
    with open(path, "wb") as f:
        f.write(body)
        f.flush()
        os.fsync(f.fileno())
    with open(path, "rb") as f:
        back = f.read()
    if hashlib.sha256(back).digest() != hashlib.sha256(body).digest() \
            or json.loads(back.decode("utf-8", "surrogatepass")) != doc:
        raise Stop("the backup at %s does not read back as the doc; nothing written" % path)
    return path


# ------------------------------------------------------------------ commands

def run_apply(net, expect_rev, today, min_age, backup_dir, say=print):
    rev, doc = net.get_doc()
    if rev != expect_rev:
        raise Stop("the doc moved: it is at rev %s and the plan was for rev %s. Run plan again; nothing written."
                   % (rev, expect_rev))
    picks = select(doc, today, min_age)
    if not picks:
        say("nothing to move")
        return None
    before = doc_bytes(doc)
    path = write_backup(backup_dir, rev, doc)
    say("backup (verified): %s" % path)
    texts, reused = {}, 0
    for n, p in enumerate(picks, 1):
        sid, have = archived_text(net, p["uk"])
        if have == p["jd"]:
            reused += 1
        else:
            sid = net.post(p)
            if net.snapshot_text(sid) != p["jd"]:
                raise Stop("archive of %s (snapshot %s) does not read back word for word; the doc is untouched"
                           % (p["uk"], sid))
        texts[p["uk"]] = p["jd"]
        if n % 25 == 0:
            say("  archived and verified %d of %d" % (n, len(picks)))
    say("archived and verified %d ad text(s)%s" % (len(texts), " (%d were already there)" % reused if reused else ""))
    for _ in range(4):
        new = with_stubs(doc, texts, today)
        stray = set(changed_paths(doc, new)) - {"jd." + uk for uk in texts}
        if stray:
            raise Stop("the edit would touch %s; nothing written" % ", ".join(sorted(stray)))
        code, body = net.put_doc(new, rev)
        if code == 200:
            break
        if code != 409:
            raise Stop("PUT failed: %s %s; the doc is untouched, the archive copies stay" % (code, str(body)[:200]))
        # Another writer saved meanwhile. Keep only the rows that still qualify with the same text.
        rev, doc = net.get_doc()
        still = {p["uk"]: p["jd"] for p in select(doc, today, min_age)}
        dropped = [uk for uk in texts if still.get(uk) != texts[uk]]
        texts = {uk: t for uk, t in texts.items() if uk not in dropped}
        say("  the doc moved to rev %s; %d row(s) no longer qualify" % (rev, len(dropped)))
        if not texts:
            raise Stop("no row qualifies any more; nothing written")
    else:
        raise Stop("the doc kept moving (409 x4); nothing written")
    rev2, after = net.get_doc()
    if rev2 == body.get("rev") and after != new:
        raise Stop("read-back differs from what was sent: %s. Backup: %s" % (", ".join(changed_paths(new, after))[:300], path))
    missing = [uk for uk in texts if not is_stub(_map(after, "jd").get(uk))]
    if missing:
        raise Stop("not shortened after the write: %s. Backup: %s" % (", ".join(missing[:10]), path))
    rep = {"rows": len(texts), "rev_before": rev, "rev_after": rev2, "bytes_before": before,
           "bytes_after": doc_bytes(after), "backup": path}
    say("doc rev %s -> %s, %s -> %s bytes (%.1f%% of the limit), %d ad texts moved"
        % (rev, rev2, format(before, ","), format(rep["bytes_after"], ","),
           100.0 * rep["bytes_after"] / LIMIT_BYTES, rep["rows"]))
    return rep


def run_restore(net, uks, say=print):
    texts = {}
    for uk in uks:
        sid, text = archived_text(net, uk)
        if not text:
            raise Stop("no archived ad text for %s" % uk)
        texts[uk] = text
    for _ in range(4):
        rev, doc = net.get_doc()
        jd = _map(doc, "jd")
        held = [uk for uk in texts if jd.get(uk) and not is_stub(jd[uk])]
        if held:
            raise Stop("already has an ad text, not overwritten: %s" % ", ".join(held))
        if not all(any(r[COL_UK] == uk for r in _rows(doc)) for uk in texts):
            raise Stop("no such row: %s" % ", ".join(uk for uk in texts if not any(r[COL_UK] == uk for r in _rows(doc))))
        new = copy.deepcopy(doc)
        new.setdefault("jd", {}).update(texts)
        if doc_bytes(new) > LIMIT_BYTES:
            raise Stop("restoring would put the doc above %s bytes" % format(LIMIT_BYTES, ","))
        code, body = net.put_doc(new, rev)
        if code == 200:
            say("restored %d ad text(s), rev %s -> %s" % (len(texts), rev, body.get("rev")))
            return body.get("rev")
        if code != 409:
            raise Stop("PUT failed: %s %s" % (code, str(body)[:200]))
    raise Stop("the doc kept moving (409 x4); nothing written")


def plan_report(doc, rev, today, min_age):
    picks = select(doc, today, min_age)
    kept = {}
    for row in _rows(doc):
        why = why_kept(doc, row, today, min_age)
        if why and why not in ("no ad text", "open"):
            n, b = kept.get(why, (0, 0))
            kept[why] = (n + 1, b + doc_bytes(_map(doc, "jd").get(row[COL_UK]) or ""))
    after = with_stubs(doc, {p["uk"]: p["jd"] for p in picks}, today)
    return {"rev": rev, "bytes_before": doc_bytes(doc), "bytes_after": doc_bytes(after), "rows": len(picks),
            "jd_bytes_before": doc_bytes(_map(doc, "jd")), "jd_bytes_after": doc_bytes(_map(after, "jd")),
            "kept_closed": kept, "picks": [{k: p[k] for k in p if k != "jd"} for p in picks]}


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="Move ad texts of closed rows out of the job-tracker doc (JT-DOC-SIZE-001)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("plan")
    p.add_argument("--min-age-days", type=int, default=MIN_AGE_DAYS)
    p.add_argument("--json", action="store_true")
    a = sub.add_parser("apply")
    a.add_argument("--expect-rev", type=int, required=True, help="the rev `plan` printed")
    a.add_argument("--min-age-days", type=int, default=MIN_AGE_DAYS)
    a.add_argument("--backup-dir", default=os.path.join(os.path.expanduser("~"), ".antcv", "job_tracker_backups"))
    s = sub.add_parser("show")
    s.add_argument("--uk", required=True)
    r = sub.add_parser("restore")
    r.add_argument("--uk", action="append", required=True)
    args = ap.parse_args()
    today = datetime.date.today()
    net = Relay()
    try:
        if args.cmd == "plan":
            rev, doc = net.get_doc()
            rep = plan_report(doc, rev, today, args.min_age_days)
            if args.json:
                print(json.dumps(rep, ensure_ascii=False, indent=1))
                return
            print("doc rev %s" % rev)
            for line in size_lines(doc):
                print(line)
            print("would move %d ad text(s): %s -> %s bytes (%.1f%% of the limit); ad texts %s -> %s bytes"
                  % (rep["rows"], format(rep["bytes_before"], ","), format(rep["bytes_after"], ","),
                     100.0 * rep["bytes_after"] / LIMIT_BYTES,
                     format(rep["jd_bytes_before"], ","), format(rep["jd_bytes_after"], ",")))
            for why, (n, b) in sorted(rep["kept_closed"].items(), key=lambda kv: -kv[1][1]):
                print("  stays: %3d row(s), %9s bytes  %s" % (n, format(b, ","), why))
            print("apply with: python scripts/job-tracker/jd_archive.py apply --expect-rev %s" % rev)
        elif args.cmd == "apply":
            run_apply(net, args.expect_rev, today, args.min_age_days, args.backup_dir)
        elif args.cmd == "show":
            sid, text = archived_text(net, args.uk)
            if not text:
                raise Stop("no archived ad text for %s" % args.uk)
            print(text)
        else:
            run_restore(net, args.uk)
    except Stop as e:
        sys.exit("STOP: %s" % e)


if __name__ == "__main__":
    main()
