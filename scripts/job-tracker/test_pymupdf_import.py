# PYMUPDF-IMPORT-001 - the job-tracker tools load PyMuPDF as `pymupdf`, not
# through the deprecated `fitz` alias.
# Run: python scripts/job-tracker/test_pymupdf_import.py (exit 0 = pass)
#
# PyMuPDF 1.28 prints "The `fitz` API is deprecated and will be removed" on
# every `import fitz`. When the alias goes, gen-runner / cl_fit / cv_fit would
# set _HAVE_FITZ = False and skip the measure-and-fit loop WITHOUT an error,
# and export_pdfs.verify_pdf / measure_density.measure would crash. This test
# blocks the `fitz` alias (sys.modules["fitz"] = None) and drives the real
# modules and functions. Network-free.
import ast
import glob
import importlib
import importlib.util
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
fails = []


def check(name, got, want):
    if got != want:
        fails.append("%s\n    got:  %r\n    want: %r" % (name, got, want))


try:
    import pymupdf
except ImportError:
    print("SKIP test_pymupdf_import (PyMuPDF missing)")
    sys.exit(0)

# --- 1. the legacy alias is gone: every loader must still find PyMuPDF
sys.modules["fitz"] = None  # `import fitz` now raises ImportError
for name in ("measure_density", "density_fit", "cl_fit", "cv_fit"):
    sys.modules.pop(name, None)
for name in ("cl_fit", "cv_fit"):
    m = importlib.import_module(name)
    check("%s._HAVE_FITZ without the fitz alias" % name, m._HAVE_FITZ, True)
    check("%s.fitz is pymupdf" % name, getattr(m, "fitz", None) is pymupdf, True)

spec = importlib.util.spec_from_file_location("gr_pymupdf", os.path.join(HERE, "gen-runner.py"))
gr = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gr)
check("gen-runner._HAVE_FITZ without the fitz alias", gr._HAVE_FITZ, True)

d = pymupdf.open()
for i in range(2):
    pg = d.new_page()
    pg.insert_text((50, 72), "Page %d body text for the probe. AI notice line." % (i + 1), fontsize=9)
pdf = d.tobytes()

import export_pdfs as EP
try:
    out = EP.verify_pdf(pdf, {}, "cl")
    check("export_pdfs.verify_pdf pages", out.get("pages"), 2)
    check("export_pdfs.verify_pdf notice on last page", out.get("notice_last_page"), True)
except ImportError as e:
    fails.append("export_pdfs.verify_pdf raised ImportError: %s" % e)

import measure_density as MD
try:
    rep = MD.measure(pdf, {})
    check("measure_density.measure pages", rep.get("pages"), 2)
except ImportError as e:
    fails.append("measure_density.measure raised ImportError: %s" % e)
del sys.modules["fitz"]

# --- 2. structural guard: no bare `import fitz` outside a pymupdf-first try
def bare_fitz_imports(path):
    tree = ast.parse(open(path, encoding="utf-8").read(), path)
    guarded = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Try):
            first = [a for s in node.body if isinstance(s, ast.Import) for a in s.names]
            if any(a.name == "pymupdf" and a.asname == "fitz" for a in first):
                for h in node.handlers:
                    for s in ast.walk(h):
                        if isinstance(s, ast.Import):
                            guarded.add(s.lineno)
    return [n.lineno for n in ast.walk(tree)
            if isinstance(n, ast.Import) and any(a.name == "fitz" for a in n.names)
            and n.lineno not in guarded]


for path in sorted(glob.glob(os.path.join(HERE, "*.py"))):
    bad = bare_fitz_imports(path)
    check("bare `import fitz` in %s" % os.path.basename(path), bad, [])

# --- 3. no deprecation line on stdout from a gen-runner load
code = ("import importlib.util,sys;sys.path.insert(0,%r);"
        "s=importlib.util.spec_from_file_location('g',%r);m=importlib.util.module_from_spec(s);"
        "s.loader.exec_module(m);print('HAVE', m._HAVE_FITZ)") % (HERE, os.path.join(HERE, "gen-runner.py"))
r = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, timeout=120)
check("gen-runner load prints no fitz deprecation", "deprecated" in (r.stdout + r.stderr), False)
check("gen-runner load in a subprocess finds PyMuPDF", "HAVE True" in r.stdout, True)

if fails:
    print("FAIL test_pymupdf_import (%d)" % len(fails))
    for f in fails:
        print("  - " + f)
    sys.exit(1)
print("PASS test_pymupdf_import")
