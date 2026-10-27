# POSTING-TRANSPORT-RETRY-001 - a transport error (TLS reset, timeout) on the
# relay must not kill check-postings with a traceback.
# Run: python scripts/job-tracker/test_transport_retry.py (exit 0 = pass)
#
# Network-free. Drives the REAL _req, get_doc, put_doc and cmd_check with
# urlopen stubbed. The 2026-10-27 nightly sweep died on WinError 10054 at the
# first GET, before one URL was probed.
import argparse
import contextlib
import importlib.util
import io
import json
import os
import sys
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("cp", os.path.join(HERE, "check-postings.py"))
cp = importlib.util.module_from_spec(spec)
spec.loader.exec_module(cp)

U = "https://careers.example.com/jobs/1234-optical-pm"
fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


class _Resp:
    def __init__(self, status, body):
        self.status, self._b = status, json.dumps(body).encode()

    def read(self):
        return self._b

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


calls, sleeps = [], []


def opener(script):
    """urlopen stand-in: each call pops the next step for its method.
    A step is an exception instance (raised) or (status, body)."""
    def fake_open(req, timeout=0):
        m = req.get_method()
        calls.append(m)
        step = script[m].pop(0)
        if isinstance(step, BaseException):
            raise step
        return _Resp(*step)
    return fake_open


def reset10054():
    return urllib.error.URLError(ConnectionResetError(10054, "forcibly closed by the remote host"))


DOC = {"rows": [[7, "Acme", "Optical PM", "Copenhagen", "", "Proposed", "strong", "OPEN",
                 "Identified (posting saved)", "Review", "why", "acme", "DDEBF7"]],
       "urls": {"acme": U}, "queue": {}, "postingcheck": {}}

_orig = (urllib.request.urlopen, cp._token, cp.time.sleep, cp.probe)
cp._token = lambda: "t"
cp.time.sleep = lambda s: sleeps.append(s)
try:
    # 1. One reset, then 200: the GET retries and returns the doc.
    calls.clear(); sleeps.clear()
    urllib.request.urlopen = opener({"GET": [reset10054(), (200, {"rev": 5, "doc": DOC})]})
    err = io.StringIO()
    with contextlib.redirect_stderr(err):
        rev, doc = cp.get_doc()
    check("GET after one TLS reset returns the doc", (rev, len(doc.get("rows", []))), (5, 1))
    check("GET made two attempts with one backoff", (calls, sleeps), (["GET", "GET"], [2.0]))
    check("the retry is logged to stderr", "[transport] GET /api/job-tracker" in err.getvalue(), True)

    # 2. Resets on every attempt: a 599, not a traceback; get_doc exits cleanly.
    calls.clear(); sleeps.clear()
    urllib.request.urlopen = opener({"GET": [reset10054(), TimeoutError("read"), ConnectionResetError(10054, "x")]})
    with contextlib.redirect_stderr(io.StringIO()):
        c, b = cp._req("/api/job-tracker")
    check("three transport failures -> synthetic 599", c, 599)
    check("the 599 body names the last error", b.get("error", "").startswith("transport_failed: ConnectionResetError"), True)
    check("GET gives up after retries=2 (3 attempts)", len(calls), 3)
    urllib.request.urlopen = opener({"GET": [reset10054(), reset10054(), reset10054()]})
    rc = None
    with contextlib.redirect_stderr(io.StringIO()):
        try:
            cp.get_doc()
        except SystemExit as e:
            rc = str(e.code)
    check("get_doc on a dead relay exits with a message naming 599", rc is not None and "599" in rc, True)

    # 3. An HTTP error is not a transport error: no retry, body kept.
    calls.clear()
    def http409(req, timeout=0):
        calls.append(req.get_method())
        raise urllib.error.HTTPError(req.full_url, 409, "x", {}, io.BytesIO(b'{"rev":7,"doc":{}}'))
    urllib.request.urlopen = http409
    c, b = cp._req("/api/job-tracker", "PUT", {"doc": {}, "base_rev": 6})
    check("HTTP 409 returns at once with its body", (c, b.get("rev"), len(calls)), (409, 7, 1))

    # 4. A PUT is never retried: a dropped PUT may have landed.
    calls.clear(); sleeps.clear()
    urllib.request.urlopen = opener({"PUT": [reset10054(), (200, {"rev": 9})]})
    c, b = cp.put_doc(DOC, 5)
    check("PUT transport error -> 599 after ONE attempt", (c, calls, sleeps), (599, ["PUT"], []))

    # 5. End to end on the REAL cmd_check: GET reset+200, probe, PUT reset.
    #    The verdicts still print and the exit names the 599.
    calls.clear(); sleeps.clear()
    cp.probe = lambda url, timeout: (404, url, "")
    urllib.request.urlopen = opener({"GET": [reset10054(), (200, {"rev": 11, "doc": DOC})],
                                     "PUT": [reset10054()]})
    out, err, rc = io.StringIO(), io.StringIO(), None
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            cp.cmd_check(argparse.Namespace(apply=True, json=False, limit=0, only="", timeout=1))
        except SystemExit as e:
            rc = str(e.code)
    log = out.getvalue()
    check("cmd_check survives the GET reset and probes the row", "checked 1 row(s)" in log, True)
    check("cmd_check reports the PUT as NOT written", "doc rev 11 (NOT written: PUT failed: 599" in log, True)
    check("cmd_check exits with the 599 put_error", rc is not None and "599" in rc, True)
    check("one PUT attempt only", calls.count("PUT"), 1)
finally:
    urllib.request.urlopen, cp._token, cp.time.sleep, cp.probe = _orig

if fails:
    print("FAIL (%d):" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS - check-postings relay transport retry (GET x3, PUT x1, 599 not traceback)")
