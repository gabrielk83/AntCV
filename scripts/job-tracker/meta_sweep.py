#!/usr/bin/env python3
"""meta_sweep.py — META-LEAK-GATE-001 read-only sweep of stored applications.

Runs meta_guard over every stored application the account can read: cv_sections,
cl_sections, the subtitle (specialisation line) and meta.slogan. GET requests only,
through gen-runner's _req (the fetch measure_density.job_context_for_app uses). It
never edits or regenerates an application; the owner decides what to fix.

Ids: GET /api/applications (the 200 most recently updated) plus every
artifacts[uk].application_id in the tracker doc, so older generated applications
are swept too. Each hit is joined to its tracker row (uk, status) when one points
at it.

The report quotes stored application text, so it goes OUTSIDE the repo:
~/.antcv/meta_sweep_<date>.json + .md by default.

Usage:
  python meta_sweep.py [--ids 101,102] [--out DIR]
Exit 1 when any application has a hit, 2 when the application list cannot be read.
"""
import argparse
import importlib.util
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import meta_guard as MG  # noqa: E402


def _gen_runner():
    spec = importlib.util.spec_from_file_location("gen_runner", os.path.join(HERE, "gen-runner.py"))
    mod = importlib.util.module_from_spec(spec)
    sys.modules["gen_runner"] = mod
    spec.loader.exec_module(mod)
    return mod


def _j(v, d):
    if isinstance(v, str):
        try:
            return json.loads(v)
        except ValueError:
            return d
    return v if v is not None else d


def scan_app(a):
    """[{section, rule, text}] for one application row as GET /api/applications/:id returns it."""
    found = MG.scan_sections(_j(a.get("cv_sections"), []), "cv") + MG.scan_sections(_j(a.get("cl_sections"), []), "cl")
    meta = _j(a.get("meta"), {}) or {}
    for path, text in (("subtitle", a.get("subtitle")), ("meta.slogan", meta.get("slogan") if isinstance(meta, dict) else None)):
        found += [dict(f, path=path) for f in MG.check(text or "")]
    return [{"section": f["path"], "rule": f["rule"], "text": f["sentence"][:100]} for f in found]


def main():
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except (AttributeError, ValueError):
        pass
    ap = argparse.ArgumentParser(description="read-only sweep of stored applications for model meta-commentary")
    ap.add_argument("--ids", help="comma-separated application ids (default: every id the account can see)")
    ap.add_argument("--out", default=os.path.join(os.path.expanduser("~"), ".antcv"),
                    help="report directory; keep it outside the repo (default ~/.antcv)")
    a = ap.parse_args()
    gr = _gen_runner()

    rows_by_app = {}
    try:
        _rev, doc = gr.get_doc()
        byuk = {gr.row_uk(r): r for r in (doc.get("rows") or [])}
        for uk, art in (doc.get("artifacts") or {}).items():
            if isinstance(art, dict) and art.get("application_id"):
                r = byuk.get(uk)
                rows_by_app[str(art["application_id"])] = {
                    "uk": uk, "status": str(r[8]) if r and len(r) > 8 else ""}
    except Exception as e:
        print(f"tracker doc not read ({str(e)[:80]}); hits will carry no row status")

    if a.ids:
        ids = [i.strip() for i in a.ids.split(",") if i.strip()]
    else:
        listed = gr.cloud_app_ids()
        if listed is None:
            print("GET /api/applications failed")
            sys.exit(2)
        ids = sorted(listed | set(rows_by_app), key=lambda i: int(i) if i.isdigit() else 0, reverse=True)
    print(f"sweeping {len(ids)} applications (read-only)")

    hits, unreadable = [], []
    for n, app_id in enumerate(ids, 1):
        c, b = gr._req(gr.RELAY, f"/api/applications/{app_id}")
        if c != 200:
            unreadable.append({"id": app_id, "http": c})
            continue
        row = b.get("application") or b
        for h in scan_app(row):
            rec = {"id": app_id, "company": row.get("jd_company") or "", "role": row.get("jd_role") or "",
                   "updated": time.strftime("%Y-%m-%d", time.gmtime((row.get("updated_at") or 0) / 1000)),
                   **rows_by_app.get(str(app_id), {"uk": "", "status": ""}), **h}
            hits.append(rec)
            print(f"   HIT {app_id} {rec['section']} [{rec['rule']}] {rec['text']!r}")
        if n % 25 == 0:
            print(f"   ... {n}/{len(ids)}")
        time.sleep(0.1)

    os.makedirs(a.out, exist_ok=True)
    stem = os.path.join(a.out, "meta_sweep_" + time.strftime("%Y-%m-%d"))
    report = {"generated": time.strftime("%Y-%m-%dT%H:%M:%S"), "swept": len(ids),
              "apps_with_hits": len({h["id"] for h in hits}), "hits": hits, "unreadable": unreadable}
    with open(stem + ".json", "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    with open(stem + ".md", "w", encoding="utf-8") as f:
        f.write("# Meta-commentary sweep %s\n\n" % report["generated"])
        f.write("Read-only (META-LEAK-GATE-001). %d applications swept, %d with hits, %d unreadable.\n"
                "Nothing was edited or regenerated.\n\n" % (len(ids), report["apps_with_hits"], len(unreadable)))
        f.write("| App | Row status | Company / role | Section | Rule | First 100 characters |\n|---|---|---|---|---|---|\n")
        for h in hits:
            cell = lambda s: str(s).replace("|", "/").replace("\n", " ")
            f.write("| %s | %s | %s / %s | %s | %s | %s |\n" % (
                h["id"], cell(h["status"]), cell(h["company"])[:40], cell(h["role"])[:40],
                h["section"], h["rule"], cell(h["text"])))
    print(f"{len(ids)} swept, {report['apps_with_hits']} with hits, {len(unreadable)} unreadable -> {stem}.md")
    sys.exit(1 if hits else 0)


if __name__ == "__main__":
    main()
