#!/usr/bin/env python3
"""export_docx.py — headless CV+CL export to DOCX (+ PDF for verification).

Builds each application's byte-exact payload (the app's own buildPayload) and
POSTs it to the deployed docx-worker: /generate -> .docx, /generate-pdf -> .pdf.
Verifies the PDF (page count, AI notice on last page, banned dashes) via the
export_pdfs verifier. Owner 2026-07-15: DOCX deliverables for the regenerated
queued apps.

Usage:
  python export_docx.py --apps 807,806 --out "C:/Users/karpg/Downloads/dir"
"""
import argparse, json, os, sys, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import measure_density as MD
import export_pdfs as EP


def render(payload, endpoint, timeout=180):
    gr = MD._gen_runner()
    data = json.dumps(payload).encode()
    req = urllib.request.Request(gr.DOCX_WORKER + endpoint, data=data, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "User-Agent": gr.UA, "Origin": gr.ORIGIN})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apps", required=True, help="comma-separated application ids")
    ap.add_argument("--out", required=True)
    ap.add_argument("--docs", default="cv,cl")
    ap.add_argument("--no-pdf", action="store_true", help="skip the PDF verification render")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    rows = []
    for app_id in [int(a) for a in args.apps.split(",") if a.strip()]:
        for doc in args.docs.split(","):
            try:
                payload, a = MD.payload_for_app(app_id, doc=doc)
                company = str(a.get("jd_company") or "app").replace(" ", "_").replace("/", "-")[:24]
                base = f"{app_id}_{company}_{doc.upper()}"
                # DOCX (the deliverable)
                docx = render(payload, "/generate")
                dpath = os.path.join(args.out, base + ".docx")
                open(dpath, "wb").write(docx)
                status, pages = "OK", "-"
                if not args.no_pdf:
                    pdf = render(payload, "/generate-pdf")
                    open(os.path.join(args.out, base + ".pdf"), "wb").write(pdf)
                    v = EP.verify_pdf(pdf, payload, doc)
                    pages = v["pages"]
                    flags = []
                    if v["blank_pages"]: flags.append("BLANK p" + ",".join(map(str, v["blank_pages"])))
                    if not v["notice_last_page"]: flags.append("NO-NOTICE")
                    if doc == "cv" and v["spine_bottom"] is False: flags.append("SPINE-GAP")
                    if v["banned_dashes"]: flags.append("BANNED-DASH " + ",".join(f"{k}x{n}" for k, n in v["banned_dashes"].items()))
                    status = "OK" if not flags else "; ".join(flags)
                rows.append({"app": app_id, "doc": doc, "docx": base + ".docx", "pages": pages, "status": status})
                print(f"{app_id} {doc}: {base}.docx ({len(docx)//1024}KB) pages={pages} {status}", flush=True)
            except Exception as e:
                rows.append({"app": app_id, "doc": doc, "docx": "-", "pages": "-", "status": f"FAILED {str(e)[:70]}"})
                print(f"{app_id} {doc}: FAILED {str(e)[:90]}", flush=True)
    json.dump(rows, open(os.path.join(args.out, "_docx_report.json"), "w", encoding="utf-8"), indent=1)
    print("report ->", os.path.join(args.out, "_docx_report.json"))


if __name__ == "__main__":
    main()
