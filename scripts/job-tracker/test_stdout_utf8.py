# JT-STDOUT-ENCODING-001 - gen-runner.py and job-tracker-sync.py pin stdout to
# UTF-8, as check-postings / job_sources / discover-positions already do.
# Run: python scripts/job-tracker/test_stdout_utf8.py   (exit 0 = pass)
#
# Why this exists: the nightly reads `gen-runner.py list` through a pipe. On
# Windows a pipe defaults to cp1252, so "Lemvigh-Møller" arrives as byte 0xf8
# (the 2026-10-26 run read "Lemvigh-M�ller"), and a letter outside cp1252 ("ő",
# "→") raises UnicodeEncodeError in print() and kills list/run/health.
# Each child runs the REAL main() under a forced cp1252 codepage; only the
# network call is stubbed.
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))

# A red run prints the fixtures; keep the report itself printable.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except (AttributeError, ValueError):
    pass

COMPANY = "Københavns Optik"
ROLE = "Produktchef til Frø og Kőr"

fails = []
CHECKS = 0


def check(name, got, want):
    global CHECKS
    CHECKS += 1
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


def run_child(script, body, extra_env=None):
    child = "\n".join([
        "import importlib.util, sys",
        "sys.path.insert(0, %a)" % HERE,
        "spec = importlib.util.spec_from_file_location('m', sys.argv[1])",
        "m = importlib.util.module_from_spec(spec)",
        "spec.loader.exec_module(m)"] + body)
    env = dict(os.environ, PYTHONIOENCODING="cp1252")
    env.pop("PYTHONUTF8", None)
    env.update(extra_env or {})
    return subprocess.run([sys.executable, "-c", child, os.path.join(HERE, script)],
                          capture_output=True, env=env)


def utf8(raw):
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError as e:
        return "NOT UTF-8: %s" % e


# gen-runner list: one eligible row (no queue entry, no artifact, real JD).
row = [7, COMPANY, ROLE, "Copenhagen", "", "", "", "OPEN", "New", "Apply", "", "kbh_optik", "DDEBF7"]
p = run_child("gen-runner.py", [
    "m.get_doc = lambda: (1, {'rows': [%a], 'jd': {'kbh_optik': 'x' * 400}})" % row,
    "sys.argv = ['gen-runner.py', 'list']",
    "m.main()"])
check("gen-runner list exits 0 under a cp1252 pipe", p.returncode, 0)
out = utf8(p.stdout)
check("gen-runner list bytes are UTF-8, company intact", COMPANY in out, True)
check("gen-runner list bytes are UTF-8, role intact", ROLE[:26] in out, True)

# gen-runner health: a dead pointer names the company.
p = run_child("gen-runner.py", [
    "m.get_doc = lambda: (1, {'rows': [%a], 'artifacts': {'kbh_optik': {'application_id': 9}}})" % row,
    "m.cloud_app_ids = lambda: set()",
    "sys.argv = ['gen-runner.py', 'health']",
    "try:\n    m.main()\nexcept SystemExit as e:\n    sys.exit(0 if e.code == 1 else 3)"])
check("gen-runner health reaches its dead-pointer exit under a cp1252 pipe", p.returncode, 0)
check("gen-runner health bytes are UTF-8, company intact", COMPANY in utf8(p.stdout), True)

# job-tracker-sync status: prints the local doc path, which can carry any letter.
doc_path = os.path.join(HERE, "no-such-dir", ROLE, "job_tracker_doc.json")
p = run_child("job-tracker-sync.py", [
    "m._req = lambda method, body=None: (200, {'rev': 1})",
    "sys.argv = ['job-tracker-sync.py', 'status']",
    "m.main()"], {"JOB_DOC": doc_path, "JOB_SNAP": doc_path + ".snap"})
check("job-tracker-sync status exits 0 under a cp1252 pipe", p.returncode, 0)
check("job-tracker-sync status bytes are UTF-8, path intact", ROLE in utf8(p.stdout), True)

if fails:
    print("FAIL %d/%d" % (len(fails), CHECKS))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS %d/%d" % (CHECKS, CHECKS))
