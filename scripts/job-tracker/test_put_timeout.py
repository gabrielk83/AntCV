# JT-PUT-SLOW-UPLINK-001 - a full job-tracker doc PUT must get a timeout that
# scales with the body, so a slow uplink does not lose a sweep at the PUT.
# Run: python scripts/job-tracker/test_put_timeout.py (exit 0 = pass)
#
# Network-free. Drives the REAL _req of check-postings, discover-positions,
# job-tracker-sync and gen-runner with urlopen stubbed, and records the timeout
# each one hands to urlopen. The 2026-10-30 position-discovery run lost two
# sweeps' verdicts: a 1.37 MB PUT at 17-33 KB/s ran past the fixed 60 s timeout.
import importlib.util
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))


def load(name, fname):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, fname))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    mod._token = lambda: "test-token"
    if hasattr(mod, "_save_token"):
        mod._save_token = lambda t: None
    return mod


fails = []


def check(name, ok, detail):
    if not ok:
        fails.append("%s: %s" % (name, detail))


class _Resp:
    status = 200
    headers = {}

    def read(self):
        return b'{"rev": 1}'

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False


seen = []


def fake_open(req, timeout=0):
    seen.append((req.get_method(), len(req.data or b""), timeout))
    return _Resp()


urllib.request.urlopen = fake_open

# A doc the size the relay served on 2026-10-30 (1,374,012 bytes).
BIG = {"doc": {"rows": ["x" * 1000] * 1370}, "base_rev": 1}
BIG_LEN = len(json.dumps(BIG).encode())
assert BIG_LEN > 1_300_000, BIG_LEN

cp = load("cp", "check-postings.py")
dp = load("dp", "discover-positions.py")
sy = load("jtsync", "job-tracker-sync.py")
gr = load("genrun", "gen-runner.py")

cases = [
    ("check-postings", 60, lambda b: cp._req("/api/job-tracker", "PUT", b), lambda: cp._req("/api/job-tracker")),
    ("discover-positions", 60, lambda b: dp._req("/api/job-tracker", "PUT", b), lambda: dp._req("/api/job-tracker")),
    ("job-tracker-sync", 30, lambda b: sy._req("PUT", b), lambda: sy._req("GET")),
    ("gen-runner", 120, lambda b: gr._req(gr.RELAY, "/api/job-tracker", "PUT", b), lambda: gr._req(gr.RELAY, "/api/job-tracker")),
]

for name, floor, put, get in cases:
    seen.clear()
    put(BIG)
    m, n, t = seen[-1]
    check(name + " big PUT method", m == "PUT", m)
    # 10 KB/s floor: a 1.37 MB body gets >= 130 s, well past every fixed default.
    check(name + " big PUT timeout scales", t >= n / (10 * 1024) and t > floor, "timeout %r for %d bytes" % (t, n))
    seen.clear()
    put({"doc": {}, "base_rev": 1})
    check(name + " small PUT keeps floor", seen[-1][2] == floor, "timeout %r, floor %r" % (seen[-1][2], floor))
    seen.clear()
    get()
    check(name + " GET keeps floor", seen[-1] == ("GET", 0, floor), repr(seen[-1]))

if fails:
    print("FAIL test_put_timeout (%d)" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS test_put_timeout (%d checks, PUT body %d bytes)" % (len(cases) * 4, BIG_LEN))
